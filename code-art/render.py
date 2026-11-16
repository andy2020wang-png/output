"""Picture: 1080x1920, 60 fps. Top = a thin frame in which the image is computed once, row by row.
Bottom = three lanes, one per colour channel: the small picture that channel contributes and the
function that computes it. The three functions are typed together while the scan runs.
Every frame is a pure function of its frame number (numpy + Pillow, no assets)."""
import os
import math
import subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from piece import load_all, HERE
from timeline import build, tokens, FPS

W, H = 1080, 1920
TOP = 1080                       # the picture area is the top 1080 px
IMG = 1024                       # pictures are shown pixel for pixel
IMG_X = IMG_Y = (TOP - IMG) // 2
BAR_Y, BAR_H = TOP, 86           # the strip between picture and code: three lights, the picture's name, its author
FS = 29                          # code font size
LINE_H = 51
LANE_X, LANE_Y = 34, BAR_Y + BAR_H + 24
THUMB = 4 * LINE_H               # channel picture: as tall as four lines of code
LANE_GAP = 22
CODE_X = LANE_X + THUMB + 20
SAFE_R = 934                     # nothing important right of this (TikTok buttons)

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
CH = ((255, 96, 90), (92, 226, 122), (92, 168, 255))
TOP_BG = (9, 11, 17)
CANVAS_BG = (6, 8, 13)
FRAME = (196, 188, 168)
FRAME_HOT = (255, 246, 222)
SCAN_HOT = (255, 240, 214)

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
    """Break a run of code that is too long, only between tokens: after a statement when one ends in
    the second half of the row, otherwise after a comma or before an operator near the end of the row.
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
            tests = ((0.6, lambda k: cuts[k][1] in (';', '{', '}')),
                     (0.75, lambda k: cuts[k][1] == ','),
                     (0.75, lambda k: nxt(k) in ops and cuts[k][1] not in ops),
                     (0.75, lambda k: cuts[k][1] == ')'))
            for frac, test in tests:
                c = [k for k in good if cuts[k][0] >= pos + width * frac and test(k)]
                if c:
                    pick = c[-1]
                    break
        out.append((pos, cuts[pick][0]))
        pos = cuts[pick][0]
    out.append((pos, len(seg)))
    return out


def layout(text, width):
    """Rows for one lane: the tweet text flowed into rows of at most `width` characters (a preprocessor
    line keeps a row to itself). Statement-friendly breaks are used when they do not cost a row.
    -> [(start, end)] index ranges into the tweet text."""
    def rows(nice):
        out, base = [], 0
        for seg in text.split('\n'):
            if seg.startswith('#'):
                out.append((base, base + len(seg)))
            else:
                out += [(base + a, base + b) for a, b in wrap_line(seg, width, nice)]
            base += len(seg) + 1
        return out
    good, plain = rows(True), rows(False)
    return good if len(good) <= len(plain) else plain


class Renderer:
    def __init__(self, pieces, tl):
        self.ps, self.tl = pieces, tl
        self.f_code = mono(FS)
        self.f_bold = mono(FS, True)
        self.cw = self.f_code.getlength('M')
        self.cols = int((SAFE_R + 6 - CODE_X) // self.cw)
        self.f_title = sans(36, 700)
        self.f_author = sans(29, 400)
        self.f_scan = mono(21, True)
        self.blank = self._blank()
        self.art = [p.render() for p in pieces]
        self.thumb = []                                   # per piece: three tinted channel pictures (THUMB px, float)
        for a in self.art:
            small = np.asarray(Image.fromarray(a).resize((THUMB, THUMB), Image.LANCZOS), np.float32) / 255.0
            self.thumb.append([small[..., k:k + 1] * np.array(CH[k], np.float32) for k in range(3)])
        self.top = self._top()
        self.bar = self._static_bar()
        self.rows = [[layout(f[2], self.cols) for f in p.fns] for p in pieces]
        self.tok = [[classify(f[2]) for f in p.fns] for p in pieces]
        for p in pieces:                                  # name on the left, author on the right: they must not meet
            assert 166 + self.f_title.getlength(p.title) + 40 < SAFE_R - self.f_author.getlength(p.author), p.title

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
        """-> (1024 px picture, scan (progress, y) or None, frame flash 0..1)"""
        tl = self.tl
        p, state, prog = tl.canvas(t)
        art = self.art[p]
        if state == 'wipe':                                            # finished picture erased bottom-up
            y = IMG * (1 - prog * prog * (3 - 2 * prog))
            yi = int(y)
            out = art.copy()
            out[yi:] = self.blank[yi:]
            r0, r1 = max(0, yi - 60), min(IMG, yi + 8)
            if r1 > r0:
                rows = np.arange(r0, r1, dtype=np.float32) + 0.5 - y
                prof = 0.9 * np.exp(-(rows / 1.8) ** 2) + 0.30 * np.exp(-np.abs(rows) / 16.0) * (rows < 2)
                add = prof[:, None, None] * np.array((255, 236, 200), np.float32) * min(1.0, prog / 0.08, (1 - prog) / 0.08)
                out[r0:r1] = np.clip(out[r0:r1].astype(np.float32) + add, 0, 255).astype(np.uint8)
            return out, None, 0.0
        if state == 'done':
            t_end = max((t1 for t0, t1, pp in tl.passes if pp == p and t1 <= t + 1e-9), default=-9.0)
            dt = t - t_end
            gain = 1.0 + 0.22 * math.exp(-dt / 0.16)
            out = np.clip(art.astype(np.float32) * gain, 0, 255).astype(np.uint8) if gain > 1.004 else art
            return out, None, math.exp(-dt / 0.35)
        y = prog * IMG                                                 # the one scan, top to bottom, all three channels
        yi = int(y)
        out = self.blank.copy()
        out[:yi] = art[:yi]
        if yi < IMG:                                                   # sub-pixel leading row
            f = y - yi
            out[yi] = (self.blank[yi] * (1 - f) + art[yi] * f).astype(np.uint8)
        g0 = max(0, yi - 150)                                          # freshly computed rows glow, then settle
        if yi > g0:
            dist = y - (np.arange(g0, yi, dtype=np.float32) + 0.5)
            gain = 1.0 + 0.85 * np.exp(-dist / 26.0)
            band = art[g0:yi].astype(np.float32) * gain[:, None, None]
            spill = np.clip(band - 255, 0, 255).max(-1, keepdims=True) * 0.45   # overshoot spills into white
            out[g0:yi] = np.clip(band + spill, 0, 255).astype(np.uint8)
        r0, r1 = max(0, yi - 6), min(IMG, yi + 46)                     # the scanline: bright core + falloff
        if r1 > r0:
            rows = np.arange(r0, r1, dtype=np.float32) + 0.5 - y
            prof = 0.95 * np.exp(-(rows / 1.7) ** 2) + 0.30 * np.exp(-np.abs(rows) / 13.0) * (rows > -2)
            src = art[min(IMG - 1, max(0, yi - 1))].astype(np.float32).mean(-1) / 255.0
            k = np.ones(31, np.float32) / 31
            along = 0.45 + 0.55 * np.convolve(np.pad(src, 15, mode='edge'), k, mode='valid')
            fade = min(1.0, (1 - prog) / 0.03, prog / 0.01 + 0.2)
            add = prof[:, None, None] * along[None, :, None] * np.array(SCAN_HOT, np.float32) * fade
            out[r0:r1] = np.clip(out[r0:r1].astype(np.float32) + add, 0, 255).astype(np.uint8)
        return out, (prog, y), 0.0

    def scan_label(self, frame, prog, y):
        """Small tag riding on the scanline: the row being computed."""
        f = self.f_scan
        txt = 'j = %d' % min(IMG - 1, int(prog * IMG))
        tw = int(f.getlength('j = 1023')) + 28
        th = 36
        tile = aa(tw, th, lambda d, s: d.rounded_rectangle([0, 0, tw * s - 1, th * s - 1], radius=10 * s,
                                                           fill=(8, 10, 16, 215), outline=FRAME + (235,), width=2 * s))
        ImageDraw.Draw(tile).text((14, th / 2 + 1), txt, font=f, fill=(240, 244, 252), anchor='lm')
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

    # ---------------------------------------------------------------- strip and lanes
    def _static_bar(self):
        im = Image.new('RGB', (W, BAR_H), BAR)
        d = ImageDraw.Draw(im)
        d.line([(0, 0), (W, 0)], fill=(44, 51, 70))
        d.line([(0, BAR_H - 1), (W, BAR_H - 1)], fill=RULE)
        return im

    def panel(self, t):
        tl = self.tl
        s = tl.snap(t)
        p = self.ps[s.piece]
        im = Image.new('RGB', (W, H - BAR_Y), BG)
        im.paste(self.bar, (0, 0))
        d = ImageDraw.Draw(im)
        cp, state, prog = tl.canvas(t)
        if cp != s.piece or state == 'wipe':
            state, prog = 'blank', 0.0
        t_end = max((t1 for t0, t1, pp in tl.passes if pp == s.piece and t1 <= t + 1e-9), default=-9.0)
        idle = t - s.t

        # ---- the strip: three lights, the picture's name, its author
        cy = BAR_H // 2
        for k in range(3):
            lit = state == 'done'
            pulse = max(0.0, 1 - (t - t_end) / 0.5) if lit else 0.0
            active = state == 'scan'
            R = 13

            def dot(dd, ss, k=k, lit=lit, pulse=pulse, active=active):
                c = 30 * ss
                if lit or active:
                    for r, a in ((26, 14), (21, 30), (17, 55)):
                        aa_ = int(a * (0.55 + 0.9 * pulse if lit else 0.35 + 0.35 * math.sin(t * 9.0 - k * 0.9) ** 2))
                        dd.ellipse([c - r * ss, c - r * ss, c + r * ss, c + r * ss], fill=CH[k] + (min(255, aa_),))
                if lit:
                    dd.ellipse([c - R * ss, c - R * ss, c + R * ss, c + R * ss], fill=mix(CH[k], (255, 255, 255), 1 - 0.35 * pulse) + (255,))
                else:
                    dd.ellipse([c - R * ss, c - R * ss, c + R * ss, c + R * ss], fill=mix(CH[k], BAR, 0.16) + (255,),
                               outline=mix(CH[k], BAR, 0.62 if active else 0.42) + (255,), width=int(2.5 * ss))
            tile = aa(60, 60, dot)
            im.paste(tile, (56 + 38 * k - 30, cy - 30), tile)
        d.text((166, cy - 2), p.title, font=self.f_title, fill=(238, 242, 250), anchor='lm')
        d.text((SAFE_R, cy - 1), p.author, font=self.f_author, fill=(186, 195, 216), anchor='rm')

        # ---- three lanes: channel picture + function, all three advancing together
        y = LANE_Y - BAR_Y
        for k in range(3):
            rows = self.rows[s.piece][k]
            lane_h = max(THUMB, len(rows) * LINE_H)
            # channel picture: what this function alone contributes
            th = np.empty((THUMB, THUMB, 3), np.float32)
            th[:] = np.array(mix(CH[k], BG, 0.07), np.float32)
            if state in ('scan', 'done'):
                yy = THUMB if state == 'done' else prog * THUMB
                yi = int(yy)
                th[:yi] = self.thumb[s.piece][k][:yi]
                if state == 'scan' and yi < THUMB:
                    th[yi] = np.array(mix(CH[k], (255, 255, 255), 0.6), np.float32)
            box = Image.fromarray(np.clip(th, 0, 255).astype(np.uint8))
            im.paste(box, (LANE_X, y))
            d.rectangle([LANE_X - 1, y - 1, LANE_X + THUMB, y + THUMB], outline=mix(CH[k], BG, 0.55))
            # the function body
            toks = self.tok[s.piece][k]
            n = s.n[k]
            cur = (0, 0)
            top = y + (lane_h - len(rows) * LINE_H) // 2             # fewer rows than the picture is tall: centre them
            for r, (a, b) in enumerate(rows):
                ry = top + r * LINE_H + 6
                for pos, tk, c in toks:
                    u, v = max(pos, a), min(pos + len(tk), b, n)
                    if u < v and tk[u - pos:v - pos].strip():
                        d.text((CODE_X + (u - a) * self.cw, ry), tk[u - pos:v - pos], font=self.f_bold if tk in CHAN else self.f_code, fill=c)
                if n > a or r == 0:
                    cur = (min(n, b) - a, r)
            if s.caret and (idle < 0.35 or (idle % 1.0) < 0.5):
                cx, cyy = CODE_X + cur[0] * self.cw, top + cur[1] * LINE_H + 6
                d.rectangle([cx, cyy + 3, cx + 3, cyy + FS + 9], fill=mix(CH[k], (255, 255, 255), 0.45))
            y += lane_h + LANE_GAP
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
