"""Timeline: what the code window shows and which sounds fire, second by second.
Picture (render.py) and sound (sfx.py) both read this, so they cannot drift apart.

The film runs through its pieces in the order films.txt gives. For every piece the
three functions are typed at the same time, and while they are typed the picture is computed once,
row by row from top to bottom, in the frame above: typing and scan start and end together.
Then the finished picture is held, wiped away, and the next piece starts.
The film opens on the finished last piece, so it loops."""
import re
import random
from dataclasses import dataclass, field

FPS = 60

# ---- pacing (seconds) -------------------------------------------------------
LEAD = 0.40       # opening hold on the finished last piece (identical to the closing frame)
WIPE = 0.32       # a finished picture is erased bottom-up
SCAN = 3.00       # three functions typed together = one scan of the whole picture
HOLD = 1.50       # finished picture before the wipe
LAST_HOLD = 2.20  # ... and at the very end
STROKE = 8        # characters per key-stroke

TOKEN = re.compile(r'[A-Za-z_]\w*|(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?|[ \t]+|\n|.')


def tokens(s):
    return TOKEN.findall(s)


def strokes(text, size=STROKE):
    """Split code into 'key-strokes' of roughly `size` characters, breaking at token edges."""
    out, cur = [], ''
    for tk in tokens(text):
        if len(tk) > size + 2:
            if cur:
                out.append(cur); cur = ''
            h = len(tk) // 2
            out += [tk[:h], tk[h:]]
        elif cur and len(cur) + len(tk) > size + 1:
            out.append(cur); cur = tk
        else:
            cur += tk
            if len(cur) >= size:
                out.append(cur); cur = ''
    if cur:
        out.append(cur)
    return out


def ease_scan(u):
    """Scanline position: constant speed with a short soft start and stop."""
    u = min(1.0, max(0.0, u))
    e = 0.08
    v = 1.0 / (1.0 - e)
    if u < e:
        return 0.5 * v * u * u / e
    if u > 1 - e:
        w = 1 - u
        return 1 - 0.5 * v * w * w / e
    return 0.5 * v * e + v * (u - e)


@dataclass(frozen=True)
class Snap:
    """Code window state, valid from time t until the next snapshot."""
    t: float
    piece: int = 0             # index in running order
    n: tuple = (0, 0, 0)       # characters typed so far in the red, green and blue function
    caret: bool = True


@dataclass
class Timeline:
    snaps: list = field(default_factory=list)
    keys: list = field(default_factory=list)      # (t, kind, pan)
    passes: list = field(default_factory=list)    # (t0, t1, piece): one scan of the whole picture
    wipes: list = field(default_factory=list)     # (t0, t1, piece being erased)
    done: list = field(default_factory=list)      # (t, piece): picture complete
    total: float = 0.0

    @property
    def frames(self):
        return int(round(self.total * FPS))

    def snap(self, t):
        lo, hi = 0, len(self.snaps) - 1
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if self.snaps[mid].t <= t + 1e-9:
                lo = mid
            else:
                hi = mid - 1
        return self.snaps[lo]

    def canvas(self, t):
        """-> (piece, state, progress): state is 'done' | 'scan' | 'wipe' | 'blank'."""
        for t0, t1, p in self.wipes:
            if t0 <= t < t1:
                return p, 'wipe', (t - t0) / (t1 - t0)
        cur = (self.passes[-1][2], 'done', 1.0)                 # before the first wipe: the last piece, finished
        for t0, t1, p in self.passes:
            if t >= t1:
                cur = (p, 'done', 1.0)
            elif t >= t0:
                return p, 'scan', ease_scan((t - t0) / (t1 - t0))
        return cur


def build(pieces, seed=20261115):
    rnd = random.Random(seed)
    tl = Timeline()
    n = len(pieces)
    tl.snaps.append(Snap(0.0, n - 1, tuple(pieces[-1].count), False))
    t = LEAD
    for k, p in enumerate(pieces):
        tl.wipes.append((t, t + WIPE, (k - 1) % n))
        tl.snaps.append(Snap(t, k, (0, 0, 0), True))
        t += WIPE
        # the three functions advance side by side: every stroke belongs to one of them,
        # placed by how far through its own function it is
        plan = []
        for ch in range(3):
            sts = strokes(p.fns[ch][2])
            done = 0
            for st in sts:
                done += len(st)
                plan.append((done / p.count[ch] + rnd.uniform(-0.012, 0.012), ch, len(st)))
        plan.sort()
        typed = [0, 0, 0]
        span = SCAN * 0.93
        for i, (_, ch, m) in enumerate(plan):
            tk = t + 0.03 + span * (i + 1) / len(plan) + rnd.uniform(-0.012, 0.012)
            typed[ch] += m
            tl.snaps.append(Snap(tk, k, tuple(typed), True))
            tl.keys.append((tk, 'key', round(rnd.uniform(-0.35, 0.35), 3)))
        assert typed == list(p.count)
        tl.passes.append((t, t + SCAN, k))
        t += SCAN
        tl.snaps.append(Snap(t, k, tuple(typed), False))
        tl.done.append((t, k))
        t += LAST_HOLD if k == n - 1 else HOLD
    tl.snaps.sort(key=lambda s: s.t)
    tl.keys.sort()
    tl.total = round(t * FPS) / FPS
    return tl


if __name__ == '__main__':
    import sys
    from piece import load_film
    film = load_film(sys.argv[1], sys.argv[2])
    ps = film.pieces
    tl = build(ps)
    print(f'{film.title}: total {tl.total:.2f}s  frames {tl.frames}  snaps {len(tl.snaps)}  keys {len(tl.keys)}')
    for (t0, t1, p), (s0, s1, q), (td, _) in zip(tl.wipes, tl.passes, tl.done):
        print('wipe %.2f-%.2f (erases %s)   scan %.2f-%.2f  %s   done %.2f' % (t0, t1, ps[p].title, s0, s1, ps[q].title, td))
