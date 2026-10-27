"""Animatic for review: the approved words at their real beat positions over the real score.
Not the film — a timing check. Shows each shot's name, era line, card, and an 8-count so the 八拍 grid is visible.
usage: python3 script/ships/animatic.py <cues.json> <out.mp4> <audio.wav>"""
import json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import subtitles as S

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
F = lambda n, s: ImageFont.truetype(os.path.join(ROOT, 'fonts', n), s)
W, H, FPS = 1280, 720, 30
TAIL = 2.5            # the final chord rings on under the end card
SERIF, SANS, SANSB = F('NotoSerifSC-900.ttf', 64), F('NotoSansSC-400.ttf', 24), F('NotoSansSC-700.ttf', 34)
BODY = F('NotoSerifSC-700.ttf', 36)
NAMES = {'hook': '开场', 'outro': '结尾', 'end': '片尾'} | {c['id']: c['title'] for c in S.CHAPTERS}

cues_path, out, audio = sys.argv[1:4]
cue = json.load(open(cues_path))
B, BAR = cue['beat'], cue['bar']
secs = cue['sections']
total = cue['total']
ch = {c['id']: c for c in S.CHAPTERS}


def alpha(t, a, b, f=.25):
    if t < a or t > b:
        return 0
    return min(1, (t - a) / f, (b - t) / f)


def card(d, text, y, a):
    if a <= 0:
        return
    lines = text.split('/')
    col = (int(240 * a), int(232 * a), int(214 * a))
    for i, ln in enumerate(lines):
        d.text((W // 2, y + i * 52), ln, font=BODY, fill=col, anchor='ma')


def frame(t):
    im = Image.new('RGB', (W, H), (14, 16, 20))
    d = ImageDraw.Draw(im)
    sec = next(s for s in secs if s['start'] <= t < s['end'] + 1e-9) if t < total else secs[-1]
    lt = t - sec['start']
    sid = sec['id']
    # 8-count of the current 八拍 and which of the shot's 八拍 we are in
    beat = int(lt / B)
    n8 = int(lt // (8 * B))
    for k in range(8):
        on = k == beat % 8
        x = W // 2 - 7 * 26 + k * 52
        d.ellipse([x - 9, 40 - 9, x + 9, 40 + 9], fill=(230, 170, 60) if on else (60, 64, 72))
        d.text((x, 62), str(k + 1), font=SANS, fill=(150, 150, 150), anchor='ma')
    d.text((40, 30), f'{NAMES[sid]}  ·  第 {n8 + 1} 个八拍', font=SANS, fill=(170, 170, 170))
    d.text((W - 40, 30), f'{t:5.1f} s', font=SANS, fill=(120, 120, 120), anchor='ra')
    if sid == 'hook':
        h = S.HOOK
        a = alpha(lt, .3, 2 * BAR - .1)
        card(d, h['question'], 250, a)
        for i, o in enumerate(h['options']):
            ao = alpha(lt, (4 + 2 * i) * B, 2 * BAR - .1)
            if ao:
                d.text((W // 2 - 120 + 240 * i, 400), o, font=SANSB, fill=(int(230 * ao), int(170 * ao), int(60 * ao)), anchor='ma')
        card(d, h['reveal'], 300, alpha(lt, 2 * BAR + .1, 4 * BAR - .1))
        a = alpha(lt, 4 * BAR, 6 * BAR - .15)
        if a:
            d.text((W // 2, 300), h['title'], font=SERIF, fill=(int(245 * a),) * 3, anchor='ma')
            d.text((W // 2, 400), h['subtitle'], font=SANSB, fill=(int(200 * a),) * 3, anchor='ma')
            d.text((W // 2, 460), h['series'], font=SANS, fill=(int(150 * a),) * 3, anchor='ma')
    elif sid in ch:
        c = ch[sid]
        a = alpha(lt, .15, 4 * B + .2)
        if a:
            d.text((W // 2, 260), c['title'], font=SERIF, fill=(int(245 * a),) * 3, anchor='ma')
            d.text((W // 2, 360), c['era'], font=SANS, fill=(int(190 * a),) * 3, anchor='ma')
        card(d, c['card'], 560, alpha(lt, 4 * B, 16 * B - .3))
    elif sid == 'outro':
        card(d, S.OUTRO[0], 300, alpha(lt, .2, 2 * BAR - .2))
        card(d, S.OUTRO[1], 300, alpha(lt, 2 * BAR + .1, 4 * BAR - .2))
    elif sid == 'end':
        a = alpha(lt, .2, 2 * BAR + TAIL)
        for i, s in enumerate(S.END_CARD):
            d.text((W // 2, 230 + i * 70), s, font=SERIF if i == 0 else SANS, fill=(int(235 * a),) * 3, anchor='ma')
    return im


n = int((total + TAIL) * FPS)
ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                       '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
                       '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', '-shortest', out], stdin=subprocess.PIPE)
for i in range(n):
    ff.stdin.write(frame(i / FPS).tobytes())
ff.stdin.close()
ff.wait()
print('ok', out)
