"""Compute the Buddhabrot (pieces/9a_buddhabrot.cpp) on several cores and store the result.

    python3 tools/9a_split.py [cores] [workdir]

The piece on its own needs close to five hours on one core. This runs tools/9a_split.cpp once per
core, adds up the tables and writes exactly the bytes the piece prints, into the work directory and
into cache/ (where piece.py looks before it computes anything).
To check: run the piece itself and compare its output with the stored one, see README."""
import os
import sys
import lzma
import subprocess
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from piece import Piece, PIECES, CACHE

cores = int(sys.argv[1]) if len(sys.argv) > 1 else os.cpu_count()
work = sys.argv[2] if len(sys.argv) > 2 else '/tmp/codeart_work'
p = Piece(os.path.join(PIECES, '9a_buddhabrot.cpp'), work)
run = os.path.join(work, '9a_split')
os.makedirs(run, exist_ok=True)
exe = os.path.join(run, '9a_split.bin')
subprocess.run(p.cxx.split() + [os.path.join(HERE, '9a_split.cpp'), '-o', exe], check=True)
if not p._guard_ok(exe):
    raise SystemExit("GR's table is not the last static object in this build")

jobs = []
for w in range(cores):
    out = open(os.path.join(run, f'part{w}.f32'), 'wb')
    err = open(os.path.join(run, f'part{w}.log'), 'w')
    jobs.append(subprocess.Popen([exe, str(w), str(cores)], stdout=out, stderr=err))
for w, j in enumerate(jobs):
    if j.wait():
        raise SystemExit(f'share {w} failed')

# add the tables; every cell is a whole number
c = np.zeros((1024, 1024), np.float64)
for w in range(cores):
    part = np.fromfile(os.path.join(run, f'part{w}.f32'), np.float32).reshape(1024, 1024)
    assert (part == np.round(part)).all()
    c += part
print('largest count %d, smallest %d' % (c.max(), c.min()))
# single precision counts whole numbers exactly up to 2^24. An orbit that never escapes adds up to
# 499,999 to a cell before it is taken out again, so below this limit the piece, counting in one
# long run, reaches exactly these sums; cells above it are far past 1023 and print as 1023 anyway.
print('order of the additions cannot matter:', bool(c.max() + 5e5 < 2 ** 24 and c.min() - 5e5 > -2 ** 24))

# what the piece prints: for pixel (i, j) the sample is c[i][j], capped at 1023, as a 16-bit integer
v = np.where(c > 1023, 1023, np.trunc(c)).astype(np.int64) & 1023
samples = np.repeat(v.T[:, :, None], 3, axis=2).astype('<u2')           # row j, column i; red = green = blue
ppm = b'P6\n1024 1024\n1023\n' + samples.tobytes()
out = os.path.join(work, f'{p.file}_{p.key}.ppm')
open(out, 'wb').write(ppm)
os.makedirs(CACHE, exist_ok=True)
with lzma.open(os.path.join(CACHE, f'{p.file}_{p.key}.ppm.xz'), 'wb', preset=9) as f:
    f.write(ppm)
print('stored', out)
