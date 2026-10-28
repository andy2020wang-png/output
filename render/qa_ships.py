"""QA stills + contact sheet for one 造船 scene (EP=ships).
usage: python3 render/qa_ships.py <id> [t1,t2,...] [outdir]"""
import sys, os, json, subprocess, glob
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCR = '/tmp/claude-0/-home-user-output/18bc3977-43ba-588f-8be5-99bb7b1f733c/scratchpad/ships'
sid = sys.argv[1]
js = open(os.path.join(ROOT, 'engine/ep/ships/data/script.js')).read()
data = json.loads(js[js.index('{'):js.index('};') + 1])
ch = data['hook'] if sid == 'hook' else data['outro'] if sid == 'outro' else next(c for c in data['chapters'] if c['id'] == sid)
if len(sys.argv) > 2 and sys.argv[2]:
    times = [float(x) for x in sys.argv[2].split(',')]
elif sid == 'hook':
    times = [-0.6, 0.6, 3.0, 4.2, 6.5, 9.0, 10.6, 12.5, 14.6]
elif sid == 'outro':
    times = [-0.6, 0.8, 3.0, 5.4, 7.0, 8.9, 10.8, 13.0, 17.0]
else:
    ev = sorted({round(e['t'] + .05, 3) for e in ch['events'] if 0 <= e['t'] <= 9.3})
    times = sorted({-0.6, 0.9, 2.0, 3.2, 6.0, 9.0, 9.7} | set(ev[:6]))
out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(SCR, sid)
os.makedirs(out, exist_ok=True)
for f in glob.glob(os.path.join(out, 't*.png')):
    os.remove(f)
env = dict(os.environ, EP='ships', NODE_PATH=subprocess.check_output(['npm', 'root', '-g'], text=True).strip())
# local == global when rendering a single id; negative local times are rendered at t = 0 of a single-scene timeline
r = subprocess.run(['node', os.path.join(ROOT, 'render/render.js'), 'stills', out, ','.join(map(str, times)), sid],
                   env=env, capture_output=True, text=True)
errs = [l for l in r.stderr.splitlines() if not l.startswith('t=')]
if errs:
    print('STDERR:', '\n'.join(errs[:15]))
ms = [int(l.split()[-1][:-2]) for l in r.stderr.splitlines() if l.startswith('t=')]
pngs = sorted(glob.glob(os.path.join(out, 't*.png')), key=lambda p: float(os.path.basename(p)[1:-4]))
cols = 3
rows = (len(pngs) + cols - 1) // cols
sheet = Image.new('RGB', (640 * cols, 360 * rows), (0, 0, 0))
for i, p in enumerate(pngs):
    sheet.paste(Image.open(p).convert('RGB').resize((640, 360)), ((i % cols) * 640, (i // cols) * 360))
sp = os.path.join(out, f'{sid}_sheet.jpg')
sheet.save(sp, quality=86)
print(sp, 'times', times, 'ms/frame', ms)
