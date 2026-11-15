"""Timeline: what the code window shows and which sounds fire, second by second.
Picture (render.py) and sound (sfx.py) both read this, so they cannot drift apart.

The film is a countdown through the pieces. For every piece the three functions are typed one
after the other, and while a function is being typed its colour channel is computed row by row
in the frame above: typing and scan start and end together. Then the finished picture is held,
wiped away, and the next piece starts. The film opens on the finished last piece, so it loops."""
import re
import random
from dataclasses import dataclass, field

FPS = 60

# ---- pacing (seconds) -------------------------------------------------------
LEAD = 0.40       # opening hold on the finished last piece (identical to the closing frame)
WIPE = 0.32       # a finished picture is erased bottom-up
FN = 1.15         # one function typed = one colour channel scanned
GAP = 0.13        # function finished -> next function starts
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
    e = 0.10
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
    piece: int = 0        # index in running order
    fn: int = 0           # 0 red, 1 green, 2 blue
    n: int = 0            # characters of this function typed so far
    caret: bool = True


@dataclass
class Timeline:
    snaps: list = field(default_factory=list)
    keys: list = field(default_factory=list)      # (t, kind, pan)
    passes: list = field(default_factory=list)    # (t0, t1, piece, channel)
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
        """-> (piece, channels complete, channel being scanned or None, scan progress, wipe progress or None)"""
        for t0, t1, p in self.wipes:
            if t0 <= t < t1:
                return p, 3, None, 0.0, (t - t0) / (t1 - t0)
        cur = (self.passes[-1][2], 3, None, 0.0, None)          # before the first wipe: the last piece, finished
        for t0, t1, p, ch in self.passes:
            if t >= t1:
                cur = (p, ch + 1, None, 0.0, None)
            elif t >= t0:
                return p, ch, ch, ease_scan((t - t0) / (t1 - t0)), None
        return cur


def build(pieces, seed=20261115):
    rnd = random.Random(seed)
    tl = Timeline()
    n = len(pieces)
    last = pieces[-1]
    tl.snaps.append(Snap(0.0, n - 1, 2, last.count[2], False))
    t = LEAD
    for k, p in enumerate(pieces):
        tl.wipes.append((t, t + WIPE, (k - 1) % n))
        tl.snaps.append(Snap(t, k, 0, 0, True))
        t += WIPE
        for ch in range(3):
            text = p.fns[ch][2]
            plan = []
            for st in strokes(text):
                w = 1.0 + (0.5 if st.rstrip()[-1:] in ';)}' else 0.0)
                plan.append((w * rnd.uniform(0.8, 1.25), st))
            scale = FN * 0.92 / sum(w for w, _ in plan)
            tk, typed = t + 0.02, 0
            if ch:
                tl.snaps.append(Snap(t, k, ch, 0, True))
            for w, st in plan:
                tk += w * scale
                typed += len(st)
                tl.snaps.append(Snap(tk, k, ch, typed, True))
                tl.keys.append((tk, 'key', round(rnd.uniform(-0.35, 0.35), 3)))
            assert typed == p.count[ch]
            tl.passes.append((t, t + FN, k, ch))
            t += FN
            tl.snaps.append(Snap(t, k, ch, typed, False))
            if ch < 2:
                t += GAP
        tl.done.append((t, k))
        t += LAST_HOLD if k == n - 1 else HOLD
    tl.total = round(t * FPS) / FPS
    return tl


if __name__ == '__main__':
    import sys
    from piece import load_all
    ps = load_all(sys.argv[1] if len(sys.argv) > 1 else '/tmp/codeart_work')
    tl = build(ps)
    print(f'total {tl.total:.2f}s  frames {tl.frames}  snaps {len(tl.snaps)}  keys {len(tl.keys)}')
    for (t0, t1, p) in tl.wipes:
        print('wipe  %.2f - %.2f  erases %s' % (t0, t1, ps[p].title))
    for t0, t1, p, ch in tl.passes:
        print('scan  %.2f - %.2f  No.%d %s  ch %d' % (t0, t1, ps[p].rank, ps[p].title, ch))
    for t, p in tl.done:
        print('done  %.2f  %s' % (t, ps[p].title))
