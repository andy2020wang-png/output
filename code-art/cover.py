"""Cover: the film's cover picture in a frame on a dark gallery wall, with the words 程序的艺术.

1080x1920. Everything that matters sits inside the central 1080x1440 (3:4), the part profile grids
on TikTok and Douyin show; that part is also written as its own file.
Drawn by code (numpy + Pillow): the frame is lit like a real one (light from above, a little from the
left), the picture is the piece's own output, shown unchanged except for the mat's shadow along its
top and left edges.

    python3 cover.py <workdir> <film> <out.png>        also writes <out>_3x4.png"""
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

from piece import load_film, HERE

W, H = 1080, 1920
GRID = (240, 1680)                   # rows a 3:4 profile grid shows
TITLE = '程序的艺术'
FONT_DIR = os.path.join(HERE, '..', 'fonts')

ART = 744                            # picture size on the cover
MAT, BEVEL = 52, 7                   # mat width, width of its bevelled opening
SLIP = 7                             # gold slip between moulding and mat
MOULD = 34                           # moulding width
INNER = MOULD + SLIP + MAT           # frame edge -> picture edge
OUTER = ART + 2 * INNER
TITLE_SIZE, TITLE_TRACK, TITLE_GAP = 124, 30, 112
SS = 3                               # supersampling of the frame

LIGHT = np.array([-0.30, -0.80, 0.52]); LIGHT /= np.linalg.norm(LIGHT)
HALF = LIGHT + np.array([0, 0, 1.0]); HALF /= np.linalg.norm(HALF)

STYLE = dict(
    font='NotoSerifSC-900.ttf',
    title=(236, 229, 214),
    wall=(14, 14, 17), spot=(70, 62, 52),
    mould=dict(base=(0.085, 0.080, 0.075), ka=1.0, kd=1.3, ks=0.55, shin=30, spec=(1.0, 0.97, 0.92)),
    slip=dict(base=(0.72, 0.56, 0.30), ka=0.40, kd=0.85, ks=0.85, shin=16, spec=(1.0, 0.92, 0.70)),
    mat=dict(base=(0.905, 0.893, 0.868), ka=0.62, kd=0.55, ks=0.0, shin=1, spec=(0, 0, 0)),
    bevel=dict(base=(0.985, 0.980, 0.970), ka=0.55, kd=0.60, ks=0.0, shin=1, spec=(0, 0, 0)),
)


def font(name, size):
    return ImageFont.truetype(os.path.join(FONT_DIR, name), size)


def shade(nx, ny, nz, m):
    """Lambert + Blinn-Phong for unit normals (arrays) and a material dict -> (..., 3) in 0..1"""
    ndl = np.clip(nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2], 0, None)
    ndh = np.clip(nx * HALF[0] + ny * HALF[1] + nz * HALF[2], 0, None)
    base, spec = np.array(m['base']), np.array(m['spec'])
    return base * (m['ka'] + m['kd'] * ndl)[..., None] + spec * (m['ks'] * ndh ** m['shin'])[..., None]


def layout():
    """-> (title top, frame top): title, gap and frame centred in the 3:4 grid area"""
    total = TITLE_SIZE + TITLE_GAP + OUTER
    top = GRID[0] + (GRID[1] - GRID[0] - total) // 2
    return top, top + TITLE_SIZE + TITLE_GAP


def wall(style, frame_top):
    """Dark wall with a warm spotlight above the frame -> (H, W, 3) float 0..255, light map (H, W) 0..1"""
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    cy = frame_top + OUTER * 0.30
    light = np.exp(-((x - W / 2) / 620) ** 2 - ((y - cy) / 860) ** 2)
    rng = np.random.default_rng(20261116)
    img = np.array(style['wall'], np.float32) + np.array(style['spot'], np.float32) * light[..., None]
    img += rng.normal(0, 0.9, (H, W, 1)).astype(np.float32)          # fine grain: no banding in the dark gradient
    return img, light


def frame(style, light_at):
    """The frame as (OUTER, OUTER, 3) float 0..255 colour and (OUTER, OUTER) alpha (0 in the opening)."""
    S = OUTER * SS
    y, x = np.mgrid[0:S, 0:S].astype(np.float32)
    x = (x + 0.5) / SS
    y = (y + 0.5) / SS
    dist = np.stack([y, OUTER - y, x, OUTER - x])                    # to the top, bottom, left, right edge
    d = dist.min(0)
    side = dist.argmin(0)
    ox = np.choose(side, [0, 0, -1, 1]).astype(np.float32)           # outward direction of that side
    oy = np.choose(side, [-1, 1, 0, 0]).astype(np.float32)
    col = np.zeros((S, S, 3), np.float32)

    def profile(t, flat):
        """rounded profile across a strip, t 0 (outer) .. 1 (inner) -> normal"""
        c = np.cos(np.pi * np.clip(t, 0, 1))
        c = np.sign(c) * np.abs(c) ** flat
        nz = np.sqrt(np.clip(1 - c * c, 0, 1))
        return c * ox, c * oy, nz

    m = d < MOULD                                                    # black lacquer moulding
    nx, ny, nz = profile(d / MOULD, 1.6)
    col[m] = shade(nx, ny, nz, style['mould'])[m]
    s = (d >= MOULD) & (d < MOULD + SLIP)                             # gold slip
    nx, ny, nz = profile((d - MOULD) / SLIP, 1.0)
    col[s] = shade(nx, ny, nz, style['slip'])[s]
    mt = (d >= MOULD + SLIP) & (d < INNER - BEVEL)                    # mat
    one, zero = np.ones_like(d), np.zeros_like(d)
    col[mt] = shade(zero, zero, one, style['mat'])[mt]
    bv = (d >= INNER - BEVEL) & (d < INNER)                           # bevel: faces the opening and the viewer
    col[bv] = shade(-0.62 * ox, -0.62 * oy, 0.78 * one, style['bevel'])[bv]
    for edge in (MOULD, MOULD + SLIP):                                # fine dark joins between the parts
        col *= (1 - 0.55 * np.exp(-((d - edge) / 0.6) ** 2))[..., None]
    alpha = (d < INNER).astype(np.float32)
    col *= alpha[..., None]
    # down-sample
    col = col.reshape(OUTER, SS, OUTER, SS, 3).mean((1, 3))
    alpha = alpha.reshape(OUTER, SS, OUTER, SS).mean((1, 3))
    col = col / np.maximum(alpha, 1e-6)[..., None]
    col *= (0.72 + 0.42 * light_at)[..., None]                        # the spotlight falls on the frame too
    return np.clip(col * 255, 0, 255), alpha


def title(img, light, style, top):
    """程序的艺术, letter-spaced and centred on its ink, as lettering on the wall."""
    f = font(style['font'], TITLE_SIZE)
    xs, x = [], 0.0
    for c in TITLE:
        xs.append(x)
        x += f.getlength(c) + TITLE_TRACK
    ink0 = xs[0] + f.getbbox(TITLE[0], anchor='ls')[0]
    ink1 = xs[-1] + f.getbbox(TITLE[-1], anchor='ls')[2]
    off = W / 2 - (ink0 + ink1) / 2
    asc = -min(f.getbbox(c, anchor='ls')[1] for c in TITLE)          # cap height above the baseline
    mask = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(mask)
    for c, cx in zip(TITLE, xs):
        d.text((off + cx, top + asc), c, font=f, fill=255, anchor='ls')
    a = np.asarray(mask, np.float32)[..., None] / 255
    ink = np.array(style['title'], np.float32) * (0.86 + 0.18 * light[..., None])
    return img * (1 - a) + ink * a


def draw(art, style=STYLE):
    """art: (1024, 1024, 3) uint8 -> cover (H, W, 3) uint8"""
    t_top, f_top = layout()
    fx = (W - OUTER) // 2
    img, light = wall(style, f_top)
    # the frame's shadow on the wall: a soft one and a close contact one
    sil = Image.new('L', (W, H), 0)
    ImageDraw.Draw(sil).rectangle([fx + 12, f_top + 30, fx + OUTER + 12, f_top + OUTER + 30], fill=255)
    soft = np.asarray(sil.filter(ImageFilter.GaussianBlur(30)), np.float32) / 255
    sil = Image.new('L', (W, H), 0)
    ImageDraw.Draw(sil).rectangle([fx + 2, f_top + 6, fx + OUTER + 2, f_top + OUTER + 6], fill=255)
    near = np.asarray(sil.filter(ImageFilter.GaussianBlur(6)), np.float32) / 255
    img *= (1 - 0.72 * soft)[..., None] * (1 - 0.45 * near)[..., None]
    img = title(img, light, style, t_top)
    # the picture, with the mat's shadow along its top and left edge
    pic = np.asarray(Image.fromarray(art).resize((ART, ART), Image.LANCZOS), np.float32)
    k = np.arange(ART, dtype=np.float32)
    pic *= (1 - 0.40 * np.exp(-k / 5.0))[:, None, None]
    pic *= (1 - 0.20 * np.exp(-k / 5.0))[None, :, None]
    py, px = f_top + INNER, fx + INNER
    img[py:py + ART, px:px + ART] = pic
    col, alpha = frame(style, light[f_top:f_top + OUTER, fx:fx + OUTER])
    region = img[f_top:f_top + OUTER, fx:fx + OUTER]
    img[f_top:f_top + OUTER, fx:fx + OUTER] = region * (1 - alpha[..., None]) + col * alpha[..., None]
    return np.clip(np.round(img), 0, 255).astype(np.uint8)


def main():
    work, which, out = sys.argv[1], sys.argv[2], sys.argv[3]
    film = load_film(work, which)
    cover = draw(film.pieces[film.cover].render())
    os.makedirs(os.path.dirname(os.path.abspath(out)) or '.', exist_ok=True)
    Image.fromarray(cover).save(out, optimize=True)
    stem, ext = os.path.splitext(out)
    Image.fromarray(cover[GRID[0]:GRID[1]]).save(stem + '_3x4' + ext, optimize=True)
    print('cover', out, '+ 3:4', stem + '_3x4' + ext)


if __name__ == '__main__':
    main()
