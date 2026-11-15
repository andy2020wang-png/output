"""Picture: 1080x1920, 60 fps. Top = a thin frame in which the image is computed row by row,
bottom = the code that computes it. Every frame is a pure function of its frame number
(numpy + Pillow, no assets)."""
import os
import math
import subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from piece import load_all, LIMIT, HERE
from timeline import build, tokens, FPS

W, H = 1080, 1920
TOP = 1080                       # the picture area is the top 1080 px
IMG = 1024                       # pictures are shown pixel for pixel
IMG_X = IMG_Y = (TOP - IMG) // 2
BAR_Y, BAR_H = TOP, 86           # title bar of the code window
FS = 29                          # code font size
LINE_H = 50
CODE_X, CODE_Y = 34, BAR_Y + BAR_H + 42
COLS = 52                        # characters per code line that fit left of the TikTok buttons
SAFE_R = 934                     # nothing important right of this

# ---- palette -----------------------------------------------------------------
BG = (12, 15, 22)
BAR = (19, 23, 33)
RULE = (36, 42, 58)
INK = (224, 229, 240)
KW = (187, 154, 247)
FUN = (125, 207, 255)
MAC = (120, 220, 196)
NUM = (255, 184, 108)
OP = (140, 150, 180)
CM = (118, 130, 162)
SOFT = (206, 213, 228)
GOLD = (244, 196, 82)
CH = ((255, 96, 90), (92, 226, 122), (92, 168, 255))
CH_HOT = ((255, 150, 120), (190, 255, 170), (160, 210, 255))    # scanline core colours
RING = (29, 155, 240)
RING_WARN = (255, 212, 0)
TOP_BG = (9, 11, 17)
CANVAS_BG = (6, 8, 13)
FRAME = (196, 188, 168)
FRAME_HOT = (255, 246, 222)

KEYWORDS = {'unsigned', 'char', 'short', 'int', 'float', 'double', 'static', 'for', 'while', 'return', 'if', 'break', 'auto', 'define'}
MATHFN = {'log', 'fabs', 'abs', 'exp', 'sin', 'cos', 'sqrt', 'pow', 'atan2', 'rand', 'floor'}
MACROS = {'DIM', 'DM1', '_sq', '_cb', '_cr'}
CHAN = {'RD': 0, 'GR': 1, 'BL': 2, 'red_fn': 0, 'green_fn': 1, 'blue_fn': 2}

FONT_DIR = os.path.join(HERE, '..', 'fonts')


def _font(cands, size):
    for c in cands:
        for p in (c, os.path.join(FONT_DIR, c)):
            if os.path.exists(p):
                return ImageFont.truetype(p, size)
    raise SystemExit('font not found: ' + ', '.join(cands))


def mono(size, bold=False):
    w = 'Bold' if bold else 'Medium'
    return _font([f'/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-{w}.ttf',
                  f'JetBrainsMono-{w}.ttf',
                  '/usr/share/fonts/truetype/dejavu/DejaVuSansMono%s.ttf' % ('-Bold' if bold else ''),
                  'SpaceMono-%d.ttf' % (700 if bold else 400)], size)


def sans(size, weight=400):
    return _font([f'NotoSansSC-{weight}.ttf'], size)


def mix(c, bg, a):
    return tuple(int(round(bg[k] + (c[k] - bg[k]) * a)) for k in range(3))


def aa(w, h, fn, ss=4):
    """Antialiased RGBA tile: draw at ss x size, scale down."""
    im = Image.new('RGBA', (w * ss, h * ss), (0, 0, 0, 0))
    fn(ImageDraw.Draw(im), ss)
    return im.resize((w, h), Image.LANCZOS)


def classify(text):
    """-> [(index, token, colour)] for a piece of C++."""
    out, pos = [], 0
    for tk in tokens(text):
        if tk in KEYWORDS:
            c = KW
        elif tk in CHAN:
            c = CH[CHAN[tk]]
        elif tk in MATHFN:
            c = FUN
        elif tk in MACROS:
            c = MAC
        elif tk[0].isdigit() or (tk[0] == '.' and len(tk) > 1):
            c = NUM
        elif tk[0].isalpha() or tk[0] == '_':
            c = INK
        elif tk == '#':
            c = KW
        else:
            c = OP
        out.append((pos, tk, c))
        pos += len(tk)
    return out


def wrap_line(seg, width, nice=True):
    """Break one statement line that is too long, only between tokens: after a statement when one ends
    in the second half of the row, otherwise after a comma or before an operator near the end of the row.
    -> [(start, end)]"""
    ops = set('+-*/%<>=&|?:')
    cuts, p = [], 0
    for tk in tokens(seg):
        p += len(tk)
        cuts.append((p, tk))
    nxt = lambda k: cuts[k + 1][1] if k + 1 < len(cuts) else ''
    out, pos = [], 0
    while len(seg) - pos > width:
        cand = [k for k, (b, _) in enumerate(cuts) if pos < b <= pos + width]
        good = [k for k in cand if nxt(k) not in (';', ',', ')', ']', '}') and cuts[k][1] not in ('(', '[')
                and not (cuts[k][1] in ops and nxt(k) in ops)] or cand
        pick = good[-1]
        if nice:
            tests = ((0.5, lambda k: cuts[k][1] in (';', '{', '}')),
                     (0.68, lambda k: cuts[k][1] == ','),
                     (0.68, lambda k: nxt(k) in ops and cuts[k][1] not in ops),
                     (0.68, lambda k: cuts[k][1] == ')'))
            for frac, test in tests:
                c = [k for k in good if cuts[k][0] >= pos + width * frac and test(k)]
                if c:
                    pick = c[-1]
                    break
        out.append((pos, cuts[pick][0]))
        pos = cuts[pick][0]
    out.append((pos, len(seg)))
    return out


def layout(text, spans, width, budget=5):
    """Rows for the code window. The author's own line breaks are kept; a line that does not fit is
    wrapped (with statement-friendly breaks if that stays within `budget` rows).
    -> [(start, end, indent)] index ranges into the tweet text."""
    def rows(nice):
        out = []
        for a, b, directive in spans:
            if directive:
                out.append((a, b, 0))
            else:
                out += [(a + x, a + y, 2) for x, y in wrap_line(text[a:b], width, nice)]
        return out
    good, plain = rows(True), rows(False)
    return good if len(good) <= max(len(plain), budget) else plain


class Renderer:
    def __init__(self, pieces, tl):
        self.ps, self.tl = pieces, tl
        self.f_code = mono(FS)
        self.f_bold = mono(FS, True)
        self.cw = self.f_code.getlength('M')
        self.f_count = mono(27)
        self.f_rank = mono(28, True)
        self.f_votes = mono(24)
        self.f_scan = mono(21, True)
        self.f_src = mono(19)
        self.blank = self._blank()
        self.stage = []                                   # per piece: nothing, R, R+G, R+G+B (1024 px, uint8)
        for p in pieces:
            art = p.render()
            st = [self.blank]
            for k in range(3):
                s = art.copy()
                s[..., k + 1:] = 0
                st.append(s)
            self.stage.append(st)
        self.top = self._top()
        self.bar = self._static_bar()
        self.rows = [[layout(f[2], f[3], COLS - 2) for f in p.fns] for p in pieces]
        self.tok = [[classify(f[2]) for f in p.fns] for p in pieces]
        self.head = [[classify(f[0]) for f in p.fns] for p in pieces]
        for p in pieces:
            assert len('// %s · %s' % (p.title, p.author)) <= COLS, p.title

    # ---------------------------------------------------------------- picture area
    def _blank(self):
        """The empty canvas inside the frame: near black with a faint 64 px pixel grid."""
        im = Image.new('RGB', (IMG, IMG), CANVAS_BG)
        d = ImageDraw.Draw(im)
        for k in range(1, 16):
            c = (13, 16, 24) if k % 4 else (18, 22, 32)
            d.line([(k * 64, 0), (k * 64, IMG)], fill=c)
            d.line([(0, k * 64), (IMG, k * 64)], fill=c)
        return np.asarray(im).copy()

    def _frame_tile(self, colour, glow):
        """The thin border around the picture, as an RGBA layer over the whole picture area."""
        def draw(d, s):
            a = (IMG_X - 9) * s
            b = (IMG_X + IMG + 9) * s - 1
            if glow > 0:
                for wd, al in ((9, 26), (6, 44), (4, 70)):
                    d.rectangle([a - wd * s // 2, a - wd * s // 2, b + wd * s // 2, b + wd * s // 2], outline=colour + (int(al * glow),), width=wd * s)
            d.rectangle([a, a, b, b], outline=colour + (255,), width=2 * s)
        return aa(TOP, TOP, draw, ss=2)

    def _top(self):
        im = Image.new('RGB', (W, TOP), TOP_BG)
        im.paste(self._frame_tile(FRAME, 0), (0, 0), self._frame_tile(FRAME, 0))
        hot = np.asarray(self._frame_tile(FRAME_HOT, 1.0), np.float32)      # the lit frame, blended in when a picture completes
        self.hot_rgb, self.hot_a = hot[..., :3], hot[..., 3:4] / 255.0
        return np.asarray(im).copy()

    def _flash(self, out, k):
        """Light the frame up by k (0..1). Only the four strips around the picture are touched."""
        a, b = IMG_Y, IMG_Y + IMG
        for ys, xs in ((slice(0, a), slice(0, TOP)), (slice(b, TOP), slice(0, TOP)), (slice(a, b), slice(0, IMG_X)), (slice(a, b), slice(IMG_X + IMG, TOP))):
            al = self.hot_a[ys, xs] * k
            out[ys, xs] = (out[ys, xs] * (1 - al) + self.hot_rgb[ys, xs] * al).astype(np.uint8)

    def picture(self, t):
        """-> (1024 px picture, scan info or None, frame flash 0..1)"""
        tl = self.tl
        p, done, ch, prog, wipe = tl.canvas(t)
        st = self.stage[p]
        flash = 0.0
        if wipe is not None:                                           # finished picture erased bottom-up
            y = IMG * (1 - wipe * wipe * (3 - 2 * wipe))
            yi = int(y)
            out = st[3].copy()
            out[yi:] = self.blank[yi:]
            r0, r1 = max(0, yi - 60), min(IMG, yi + 8)
            if r1 > r0:
                rows = np.arange(r0, r1, dtype=np.float32) + 0.5 - y
                prof = 0.9 * np.exp(-(rows / 1.8) ** 2) + 0.30 * np.exp(-np.abs(rows) / 16.0) * (rows < 2)
                add = prof[:, None, None] * np.array((255, 236, 200), np.float32) * min(1.0, wipe / 0.08, (1 - wipe) / 0.08)
                out[r0:r1] = np.clip(out[r0:r1].astype(np.float32) + add, 0, 255).astype(np.uint8)
            return out, None, 0.0
        if ch is None:
            out = st[done]
            if done:
                t_end = max((t1 for t0, t1, pp, c in tl.passes if pp == p and c == done - 1 and t1 <= t + 1e-9), default=-9.0)
                dt = t - t_end
                amp, tau = (0.26, 0.16) if done == 3 else (0.14, 0.10)
                gain = 1.0 + amp * math.exp(-dt / tau)
                if gain > 1.004:
                    out = np.clip(out.astype(np.float32) * gain, 0, 255).astype(np.uint8)
                if done == 3:
                    flash = math.exp(-dt / 0.35)
            return out, None, flash
        prev, new = st[ch], st[ch + 1]
        y = prog * IMG
        yi = int(y)
        out = prev.copy()
        out[:yi] = new[:yi]
        if yi < IMG:                                                   # sub-pixel leading row
            f = y - yi
            out[yi] = (prev[yi] * (1 - f) + new[yi] * f).astype(np.uint8)
        g0 = max(0, yi - 150)                                          # freshly computed rows glow, then settle
        if yi > g0:
            dist = y - (np.arange(g0, yi, dtype=np.float32) + 0.5)
            gain = 1.0 + 1.1 * np.exp(-dist / 28.0)
            band = new[g0:yi, :, ch].astype(np.float32) * gain[:, None]
            out[g0:yi, :, ch] = np.clip(band, 0, 255).astype(np.uint8)
            lift = (np.clip(band - 255, 0, 255) * 0.5)[..., None]       # overshoot spills into white
            out[g0:yi] = np.clip(out[g0:yi].astype(np.float32) + lift, 0, 255).astype(np.uint8)
        r0, r1 = max(0, yi - 6), min(IMG, yi + 46)                     # the scanline: bright core + falloff
        if r1 > r0:
            rows = np.arange(r0, r1, dtype=np.float32) + 0.5 - y
            prof = 0.95 * np.exp(-(rows / 1.7) ** 2) + 0.34 * np.exp(-np.abs(rows) / 13.0) * (rows > -2)
            src = new[min(IMG - 1, max(0, yi - 1)), :, ch].astype(np.float32) / 255.0
            k = np.ones(31, np.float32) / 31
            along = 0.45 + 0.55 * np.convolve(np.pad(src, 15, mode='edge'), k, mode='valid')
            fade = min(1.0, (1 - prog) / 0.03, prog / 0.01 + 0.2)
            add = prof[:, None, None] * along[None, :, None] * np.array(CH_HOT[ch], np.float32) * fade
            out[r0:r1] = np.clip(out[r0:r1].astype(np.float32) + add, 0, 255).astype(np.uint8)
        return out, (p, ch, prog, y), 0.0

    def scan_label(self, frame, p, ch, prog, y):
        """Small tag riding on the scanline: the call being evaluated for this row, e.g. RD(i,512)."""
        f = self.f_scan
        name, rest = self.ps[p].fns[ch][1], '(i,%d)' % min(IMG - 1, int(prog * IMG))
        tw = int(f.getlength(name + '(i,1023)')) + 28
        th = 36
        tile = aa(tw, th, lambda d, s: d.rounded_rectangle([0, 0, tw * s - 1, th * s - 1], radius=10 * s,
                                                           fill=(8, 10, 16, 215), outline=CH[ch] + (235,), width=2 * s))
        d = ImageDraw.Draw(tile)
        d.text((14, th / 2 + 1), name, font=f, fill=CH[ch], anchor='lm')
        d.text((14 + f.getlength(name), th / 2 + 1), rest, font=f, fill=(240, 244, 252), anchor='lm')
        ty = IMG_Y + int(y) - th - 10
        if ty < 190:
            ty = IMG_Y + int(y) + 14
        a = min(1.0, prog / 0.03, (1 - prog) / 0.03)
        self._paste(frame, tile, IMG_X + 14, ty, a)

    @staticmethod
    def _paste(frame, tile, x, y, alpha=1.0):
        t = np.asarray(tile, np.float32)
        h, w = t.shape[:2]
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(frame.shape[1], x + w), min(frame.shape[0], y + h)
        if x1 <= x0 or y1 <= y0:
            return
        t = t[y0 - y:y1 - y, x0 - x:x1 - x]
        a = t[..., 3:4] / 255.0 * alpha
        frame[y0:y1, x0:x1] = (frame[y0:y1, x0:x1] * (1 - a) + t[..., :3] * a).astype(np.uint8)

    # ---------------------------------------------------------------- code window
    def _static_bar(self):
        im = Image.new('RGB', (W, BAR_H), BAR)
        d = ImageDraw.Draw(im)
        d.line([(0, 0), (W, 0)], fill=(44, 51, 70))
        d.line([(0, BAR_H - 1), (W, BAR_H - 1)], fill=RULE)
        d.text((166, BAR_H // 2 - 2), '程序与艺术', font=sans(36, 700), fill=(238, 242, 250), anchor='lm')
        d.line([(372, 26), (372, BAR_H - 26)], fill=(58, 66, 88), width=2)
        return im

    def _text(self, d, y, items, start, end, indent, n=10 ** 9):
        """Draw tokens [(index, token, colour)] that fall into [start, end), up to character n."""
        for pos, tk, c in items:
            a, b = max(pos, start), min(pos + len(tk), end, n)
            if a >= b:
                continue
            part = tk[a - pos:b - pos]
            if part.strip():
                bold = tk in CHAN
                d.text((CODE_X + (indent + a - start) * self.cw, y), part, font=self.f_bold if bold else self.f_code, fill=c)

    def panel(self, t):
        tl = self.tl
        s = tl.snap(t)
        p = self.ps[s.piece]
        im = Image.new('RGB', (W, H - BAR_Y), BG)
        im.paste(self.bar, (0, 0))
        d = ImageDraw.Draw(im)
        cp, done, ch, prog, wipe = tl.canvas(t)
        if cp != s.piece or wipe is not None:
            done, ch = 0, None
        oy = CODE_Y - BAR_Y
        ly = lambda k: oy + k * LINE_H

        # ---- credit line, signature, body, closing brace
        x = float(CODE_X)
        for text, c, f in (('// ', CM, self.f_code), (p.title, SOFT, self.f_code), (' · ', CM, self.f_code), (p.author, CM, self.f_code)):
            d.text((x, ly(0)), text, font=f, fill=c)
            x += self.cw * len(text)
        sig = p.fns[s.fn][0]
        self._text(d, ly(1), self.head[s.piece][s.fn], 0, len(sig), 0)
        rows = self.rows[s.piece][s.fn]
        toks = self.tok[s.piece][s.fn]
        cur = (rows[0][2], 0)                                        # caret: (column, row)
        for r, (a, b, ind) in enumerate(rows):
            self._text(d, ly(2 + r), toks, a, b, ind, s.n)
            if s.n >= a:
                cur = (ind + min(s.n, b) - a, r)
        d.text((CODE_X, ly(2 + len(rows))), '}', font=self.f_code, fill=OP)
        idle = t - s.t
        if s.caret and (idle < 0.35 or (idle % 1.0) < 0.5):
            cx, cy = CODE_X + cur[0] * self.cw, ly(2 + cur[1])
            d.rectangle([cx, cy + 3, cx + 3, cy + LINE_H - 12], fill=(248, 250, 255))
        d.text((CODE_X, H - BAR_Y - 302), 'codegolf.stackexchange.com/q/35569 · CC BY-SA', font=self.f_src, fill=(74, 84, 110))

        # ---- title bar: channel lights, rank and votes, character ring
        cy = BAR_H // 2
        for k in range(3):
            lit = done > k
            pulse = 0.0
            if lit:
                t_end = max((t1 for t0, t1, pp, c in tl.passes if pp == s.piece and c == k and t1 <= t + 1e-9), default=-9.0)
                pulse = max(0.0, 1 - (t - t_end) / 0.5)
            active = (ch == k)
            R = 13

            def dot(dd, ss, k=k, lit=lit, pulse=pulse, active=active):
                c = 30 * ss
                if lit or active:
                    for r, a in ((26, 14), (21, 30), (17, 55)):
                        aa_ = int(a * (0.55 + 0.9 * pulse if lit else 0.35 + 0.35 * math.sin(t * 9.0) ** 2))
                        dd.ellipse([c - r * ss, c - r * ss, c + r * ss, c + r * ss], fill=CH[k] + (min(255, aa_),))
                if lit:
                    dd.ellipse([c - R * ss, c - R * ss, c + R * ss, c + R * ss], fill=mix(CH[k], (255, 255, 255), 1 - 0.35 * pulse) + (255,))
                else:
                    dd.ellipse([c - R * ss, c - R * ss, c + R * ss, c + R * ss], fill=mix(CH[k], BAR, 0.16) + (255,),
                               outline=mix(CH[k], BAR, 0.62 if active else 0.42) + (255,), width=int(2.5 * ss))
            tile = aa(60, 60, dot)
            im.paste(tile, (56 + 38 * k - 30, cy - 30), tile)

        d.text((392, cy + 1), 'No.%d' % p.rank, font=self.f_rank, fill=GOLD, anchor='lm')
        vx = 392 + self.f_rank.getlength('No.%d' % p.rank) + 26
        tri = aa(18, 18, lambda dd, ss: dd.polygon([(9 * ss, 2 * ss), (17 * ss, 15 * ss), (1 * ss, 15 * ss)], fill=(150, 160, 188, 255)))
        im.paste(tri, (int(vx), cy - 9), tri)
        d.text((vx + 24, cy + 1), '%d' % p.votes, font=self.f_votes, fill=(170, 179, 204), anchor='lm')

        n = s.n
        frac = min(1.0, n / LIMIT)
        rc = RING if n < LIMIT - 20 else (RING_WARN if n <= LIMIT else (244, 33, 46))

        def ring(dd, ss):
            c, r, wd = 24 * ss, 17 * ss, 5 * ss
            dd.ellipse([c - r, c - r, c + r, c + r], outline=(47, 54, 74, 255), width=wd)
            if frac > 0:
                dd.arc([c - r, c - r, c + r, c + r], -90, -90 + 360 * frac, fill=rc + (255,), width=wd)
        tile = aa(48, 48, ring)
        tw = self.f_count.getlength('000/%d' % LIMIT)
        rx = int(SAFE_R - tw - 58)
        im.paste(tile, (rx, cy - 24), tile)
        num = '%d' % n
        d.text((rx + 56 + self.f_count.getlength('000') - self.f_count.getlength(num), cy + 1), num, font=self.f_count,
               fill=mix(rc, (255, 255, 255), 0.55) if n else (120, 130, 158), anchor='lm')
        d.text((rx + 56 + self.f_count.getlength('000'), cy + 1), '/%d' % LIMIT, font=self.f_count, fill=(120, 130, 158), anchor='lm')
        return im

    # ---------------------------------------------------------------- frame
    def frame(self, n):
        t = n / FPS
        out = np.empty((H, W, 3), np.uint8)
        out[:TOP] = self.top
        pic, scan, flash = self.picture(t)
        out[IMG_Y:IMG_Y + IMG, IMG_X:IMG_X + IMG] = pic
        if flash > 0.02:                                               # the frame lights up when a picture is complete
            self._flash(out, flash)
        if scan:
            self.scan_label(out, *scan)
        out[TOP:] = np.asarray(self.panel(t))
        return out


def encode_cmd(path, fps=FPS, crf=15, preset='slow'):
    return ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(fps), '-i', '-',
            '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int+full_chroma_inp,format=yuv420p',
            '-c:v', 'libx264', '-preset', preset, '-crf', str(crf), '-profile:v', 'high', '-level', '4.2',
            '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
            '-g', str(fps * 2), '-movflags', '+faststart', path]


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('work')
    ap.add_argument('--stills', help='comma separated times in seconds')
    ap.add_argument('--cover', help='write a cover image (the closing frame) to this path')
    ap.add_argument('--out', help='output dir for stills / path for video')
    ap.add_argument('--crf', type=int, default=15)
    a = ap.parse_args()
    pieces = load_all(a.work)
    tl = build(pieces)
    r = Renderer(pieces, tl)
    if a.cover:
        Image.fromarray(r.frame(tl.frames - 1)).save(a.cover, optimize=True)
    if a.stills:
        os.makedirs(a.out, exist_ok=True)
        for ts in a.stills.split(','):
            n = int(round(float(ts) * FPS))
            Image.fromarray(r.frame(n)).save(os.path.join(a.out, 'f%05d.png' % n))
        return
    if not a.out:
        return
    ff = subprocess.Popen(encode_cmd(a.out, crf=a.crf), stdin=subprocess.PIPE)
    for n in range(tl.frames):
        ff.stdin.write(r.frame(n).tobytes())
    ff.stdin.close()
    if ff.wait():
        raise SystemExit('ffmpeg failed')


if __name__ == '__main__':
    main()
