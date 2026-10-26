"""Covers composed by code from art-only engine renders (NOTEXT=1) plus typography.
usage: python3 script/covers.py <art_dir> <out_dir>"""
import sys, os, glob
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = lambda name, size: ImageFont.truetype(os.path.join(ROOT, 'fonts', name), size)
SERIF9, SERIF7, SANS4, SANS7 = 'NotoSerifSC-900.ttf', 'NotoSerifSC-700.ttf', 'NotoSansSC-400.ttf', 'NotoSansSC-700.ttf'
PAPER, INK, RED, GREY = (242, 239, 232), (27, 23, 18), (176, 65, 46), (107, 98, 88)

art_dir, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
frames = {float(os.path.basename(f)[1:-4]): f for f in glob.glob(os.path.join(art_dir, 't*.png'))}
def at(t): return Image.open(frames[min(frames, key=lambda k: abs(k - t))]).convert('RGB')

# chapter → (global time, 16:9 focus box)
TILES = [
    ('结绳', 21.3, (160, 40, 1760, 940)), ('泥板', 42.75, (420, 20, 1500, 627)), ('莎草纸', 68.3, (360, 60, 1880, 915)),
    ('龟甲', 83.05, (400, 0, 1840, 810)), ('竹简', 94.2, (240, 0, 1680, 810)), ('造纸', 111.7, (480, 80, 1920, 890)),
    ('印刷术', 132.0, (360, 60, 1680, 802)), ('打孔卡', 164.55, (340, 40, 1840, 884)), ('磁带', 189.6, (100, 120, 1460, 885)),
    ('软盘', 218.2, (60, 120, 1660, 1020)), ('硬盘', 238.2, (480, 200, 1440, 740)), ('云', 253.35, (900, 120, 1920, 694)),
]


def paper(w, h, seed=3):
    rng = np.random.default_rng(seed)
    n = rng.standard_normal((h // 4 + 1, w // 4 + 1))
    n = np.array(Image.fromarray(((n - n.min()) / np.ptp(n) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), dtype=float) / 255
    fib = rng.standard_normal((h, w // 16 + 1)).repeat(16, 1)[:, :w] * .012
    base = np.array(PAPER, float)[None, None, :] / 255 * (0.975 + .035 * n[..., None] + fib[..., None])
    yy, xx = np.mgrid[0:h, 0:w]
    v = 1 - .10 * (((xx - w / 2) / w) ** 2 + ((yy - h / 2) / h) ** 2) * 2
    return Image.fromarray(np.clip(base * v[..., None] * 255, 0, 255).astype(np.uint8))


def tile(name, t, box, w, h):
    im = at(t).crop(box).resize((w, h), Image.LANCZOS)
    return im


def text(d, xy, s, font, fill, anchor='la', spacing=0):
    if not spacing:
        d.text(xy, s, font=font, fill=fill, anchor=anchor); return
    # letter-spaced text (anchor left or middle)
    widths = [d.textlength(c, font=font) for c in s]
    total = sum(widths) + spacing * (len(s) - 1)
    x = xy[0] - total / 2 if anchor[0] == 'm' else xy[0]
    for c, wd in zip(s, widths):
        d.text((x, xy[1]), c, font=font, fill=fill, anchor='l' + anchor[1]); x += wd + spacing


def shadowed(base, draw_fn, blur=10, alpha=150):
    sh = Image.new('L', base.size, 0)
    draw_fn(ImageDraw.Draw(sh), 255)
    sh = sh.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: v * alpha // 255)
    base.paste((10, 8, 6), (0, 0), sh)


def framed(canvas, im, x, y, label=None, lf=None):
    sh = Image.new('L', canvas.size, 0)
    ImageDraw.Draw(sh).rectangle([x + 4, y + 8, x + im.width + 4, y + im.height + 8], fill=110)
    canvas.paste((40, 30, 20), (0, 0), sh.filter(ImageFilter.GaussianBlur(9)))
    canvas.paste(im, (x, y))
    d = ImageDraw.Draw(canvas)
    d.rectangle([x, y, x + im.width - 1, y + im.height - 1], outline=(27, 23, 18, 60), width=1)
    if label:
        bw = d.textlength(label, font=lf) + 22
        d.rectangle([x, y + im.height - lf.size - 16, x + bw, y + im.height], fill=(27, 23, 18))
        d.text((x + 11, y + im.height - 8), label, font=lf, fill=PAPER, anchor='ls')


# ---------------------------------------------------------------- A: title + 12-era grid (16:9)
def cover_a():
    W, H = 1920, 1080
    c = paper(W, H, 5)
    d = ImageDraw.Draw(c)
    tw, th, g = 336, 189, 14
    gx, gy = W - 96 - (3 * tw + 2 * g), (H - (4 * th + 3 * g)) // 2
    lf = F(SANS7, 26)
    for i, (nm, t, box) in enumerate(TILES):
        framed(c, tile(nm, t, box, tw, th), gx + (i % 3) * (tw + g), gy + (i // 3) * (th + g), f'{i + 1:02d} {nm}', lf)
    d = ImageDraw.Draw(c)
    x = 96
    text(d, (x, 170), '科技树 01 · 记录', F(SANS4, 30), GREY, 'ls', 6)
    d.rectangle([x, 196, x + 60, 201], fill=RED)
    tf = F(SERIF9, 148)
    text(d, (x - 6, 400), '人类如何', tf, INK, 'ls', 10)
    text(d, (x - 6, 572), '记录信息', tf, INK, 'ls', 10)
    text(d, (x, 668), '从结绳到云端的 12 种记录方式', F(SERIF7, 40), GREY, 'ls')
    hf = F(SERIF9, 54)
    d.rectangle([x, 732, x + d.textlength('越先进的记录，', font=hf) + 6, 742], fill=None)
    text(d, (x, 806), '越先进的记录，', hf, RED, 'ls')
    text(d, (x, 880), '越难长久保存。', hf, RED, 'ls')
    c.save(os.path.join(out, '封面_横版A_16x9.png'))


# ---------------------------------------------------------------- B: clay vs hard disk contrast (16:9)
def cover_b():
    W, H = 1920, 1080
    c = Image.new('RGB', (W, H), (20, 16, 13))
    L = at(47.25).crop((420, 0, 1500, 1080)).resize((1080, 1080), Image.LANCZOS)    # tablet in Nineveh's fire
    Rt = at(246.4).crop((820, 0, 1900, 1080)).resize((1080, 1080), Image.LANCZOS)   # the platter, spinning down
    mask = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mask).polygon([(0, 0), (1010, 0), (910, H), (0, H)], fill=255)
    c.paste(Rt, (840, 0))
    c.paste(L, (0, 0), mask.crop((0, 0, 1080, 1080)))
    d = ImageDraw.Draw(c)
    d.line([(1010, 0), (910, H)], fill=RED, width=10)
    # darken top band and bottom band for type
    ov = Image.new('L', (W, H), 0)
    od = ImageDraw.Draw(ov)
    for y in range(0, 300):
        od.line([(0, y), (W, y)], fill=int(170 * (1 - y / 300) ** 1.3))
    for y in range(H - 330, H):
        od.line([(0, y), (W, y)], fill=int(200 * ((y - (H - 330)) / 330) ** 1.2))
    c.paste((12, 9, 7), (0, 0), ov)
    d = ImageDraw.Draw(c)
    hf = F(SERIF9, 92)
    head = '越先进的记录，越难长久保存'
    shadowed(c, lambda g, a: text(g, (W // 2, 150), head, hf, a, 'ms', 4), 14, 200)
    d = ImageDraw.Draw(c)
    text(d, (W // 2, 150), head, hf, (246, 238, 222), 'ms', 4)
    nf, lf, uf = F(SERIF9, 150), F(SERIF9, 56), F(SERIF7, 46)
    for cx, name, num, col in [(470, '泥板 · 已保存', '5,000+', (244, 190, 120)), (1450, '硬盘 · 预计', '2～5', (140, 228, 214))]:
        shadowed(c, lambda g, a, cx=cx, num=num: text(g, (cx, 930), num, nf, a, 'ms'), 16, 220)
        d = ImageDraw.Draw(c)
        text(d, (cx - 30, 790), name, lf, (246, 238, 222), 'ms', 6)
        nw = d.textlength(num, font=nf)
        text(d, (cx - 30, 930), num, nf, col, 'ms')
        text(d, (cx - 30 + nw / 2 + 14, 930), '年', uf, (246, 238, 222), 'ls')
    text(d, (W // 2, H - 44), '人类如何记录信息 · 科技树 01', F(SANS4, 30), (220, 210, 196), 'ms', 4)
    c.save(os.path.join(out, '封面_横版B_16x9.png'))


# ---------------------------------------------------------------- vertical 3:4
def cover_v():
    W, H = 1080, 1440
    c = paper(W, H, 9)
    d = ImageDraw.Draw(c)
    text(d, (W // 2, 118), '科技树 01 · 记录', F(SANS4, 32), GREY, 'ms', 6)
    d.rectangle([W // 2 - 30, 140, W // 2 + 30, 145], fill=RED)
    text(d, (W // 2, 292), '人类如何记录信息', F(SERIF9, 112), INK, 'ms', 6)
    text(d, (W // 2, 372), '越先进的记录，越难长久保存。', F(SERIF9, 50), RED, 'ms', 2)
    tw, th, g = 316, 178, 14
    gx = (W - (3 * tw + 2 * g)) // 2
    gy = 430
    lf = F(SANS7, 24)
    for i, (nm, t, box) in enumerate(TILES):
        framed(c, tile(nm, t, box, tw, th), gx + (i % 3) * (tw + g), gy + (i // 3) * (th + g), f'{i + 1:02d} {nm}', lf)
    d = ImageDraw.Draw(c)
    text(d, (W // 2, gy + 4 * th + 3 * g + 74), '从结绳到云端的 12 种记录方式', F(SERIF7, 40), GREY, 'ms', 2)
    c.save(os.path.join(out, '封面_竖版_3x4.png'))


cover_a(); cover_b(); cover_v()
print('ok')
