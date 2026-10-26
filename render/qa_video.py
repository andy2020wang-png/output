"""Automated checks on the finished film: duration, black frames, frozen stretches, brightness per chapter,
loudness, and a contact sheet every N seconds.  usage: python3 render/qa_video.py <video.mp4> <timeline.json> <outdir>"""
import sys, os, json, subprocess, re
from PIL import Image

video, tlp, out = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(out, exist_ok=True)
tl = json.load(open(tlp))


def ff(args):
    return subprocess.run(['ffmpeg', '-hide_banner'] + args, capture_output=True, text=True).stderr


dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]).strip())
print(f'duration {dur:.2f}s (timeline {tl["total"]}s)')

log = ff(['-i', video, '-vf', 'blackdetect=d=0.25:pix_th=0.06,freezedetect=n=0.002:d=3', '-an', '-f', 'null', '-'])
blacks = re.findall(r'black_start:([\d.]+) black_end:([\d.]+)', log)
freezes = re.findall(r'freeze_start: ([\d.]+).*?freeze_duration: ([\d.]+)', log, re.S)
print('black stretches ≥0.25s:', blacks or 'none')
print('frozen stretches ≥3s:', freezes or 'none')

# brightness per chapter (signalstats YAVG on 2 fps)
log = ff(['-i', video, '-vf', 'fps=2,signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-an', '-f', 'null', '-'])
vals = [float(v) for v in re.findall(r'YAVG=([\d.]+)', log)]
for s in tl['scenes']:
    seg = vals[int(s['start'] * 2):int(s['end'] * 2)]
    if seg:
        print(f"{s['id']:8s} YAVG mean {sum(seg) / len(seg):6.1f}  min {min(seg):6.1f}")

log = ff(['-i', video, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'])
print('loudness:', ' '.join(re.findall(r'(I:\s+[-\d.]+ LUFS|Peak:\s+[-\d.]+ dBFS)', log)[-2:]))

# contact sheet: one frame every 6 s, 8 per row, 240 px wide
step = 6
times = [t + 1.0 for t in range(0, int(dur), step)]
frames = []
for i, t in enumerate(times):
    p = os.path.join(out, f'c{i:03d}.jpg')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t), '-i', video, '-frames:v', '1', '-vf', 'scale=320:-1', p])
    frames.append(p)
cols = 8
rows = (len(frames) + cols - 1) // cols
sheet = Image.new('RGB', (cols * 320, rows * 180))
for i, p in enumerate(frames):
    if os.path.exists(p):
        sheet.paste(Image.open(p), ((i % cols) * 320, (i // cols) * 180))
for half in range(2):
    r0, r1 = half * ((rows + 1) // 2), min(rows, (half + 1) * ((rows + 1) // 2))
    sheet.crop((0, r0 * 180, cols * 320, r1 * 180)).save(os.path.join(out, f'contact_{half}.jpg'), quality=85)
print('contact sheets in', out)
