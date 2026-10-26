"""QA contact sheet for one scene: title moment + the middle of every subtitle card (or given times).
usage: python3 render/qa_sheet.py <id> <outdir> [t1,t2,...]"""
import sys, os, json, subprocess, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sid, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
if len(sys.argv) > 3:
    times = [float(x) for x in sys.argv[3].split(',')]
else:
    js = open(os.path.join(ROOT, 'engine/data/script.js')).read()
    data = json.loads(js[js.index('{'):js.rindex('};') + 1])
    ch = next((c for c in data['chapters'] if c['id'] == sid), None)
    if ch:
        times = [1.8] + [round((a + b) / 2, 2) for a, b in ch['segs']]
    elif sid == 'hook':
        times = [0.0, 2.0, 4.8, 9.0, 12.2]
    else:
        times = [3.6, 8.3, 12.7, 17.5, 22.4, 27.7, 34.0]
d = os.path.join(out, sid)
for f in glob.glob(os.path.join(d, '*.png')):
    os.remove(f)
env = dict(os.environ, NODE_PATH=subprocess.check_output(['npm', 'root', '-g'], text=True).strip())
r = subprocess.run(['node', os.path.join(ROOT, 'render/render.js'), 'stills', d, ','.join(map(str, times)), sid],
                   env=env, capture_output=True, text=True)
errs = [l for l in r.stderr.splitlines() if not l.startswith('t=')]
if errs:
    print('STDERR:', '\n'.join(errs[:10]))
ms = [int(l.split()[-1][:-2]) for l in r.stderr.splitlines() if l.startswith('t=')]
pngs = sorted(glob.glob(os.path.join(d, 't*.png')))
cols = 3
from PIL import Image
rows = (len(pngs) + cols - 1) // cols
sheet_im = Image.new('RGB', (640 * cols, 360 * rows), (0, 0, 0))
for i, p in enumerate(pngs):
    sheet_im.paste(Image.open(p).convert('RGB').resize((640, 360)), ((i % cols) * 640, (i // cols) * 360))
sheet = os.path.join(out, f'{sid}_sheet.jpg')
sheet_im.save(sheet, quality=88)
print(sheet, 'times', times, 'ms/frame', ms)
