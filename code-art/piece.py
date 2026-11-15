"""A piece = one real C++ program whose three tweet-sized functions are the art.
The source file is the single source of truth: the video shows exactly the text that gets compiled."""
import os
import re
import glob
import hashlib
import subprocess
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
LIMIT = 140
SIG = re.compile(r'^[ \t]*((?:unsigned )?(?:char|short))\s+(RD|GR|BL|red_fn|green_fn|blue_fn)\s*\(int i,\s*int j\)\s*\{', re.M)


def tweet_text(body):
    """A function body as it would be tweeted: indentation and line breaks removed, except the line
    break a preprocessor directive needs. Also returns where the author's own lines sit in that text.
    -> (text, [(start, end, is_directive)])"""
    lines = [l.strip() for l in body.split('\n') if l.strip()]
    out, spans = '', []
    for k, l in enumerate(lines):
        if l.startswith('#'):
            if out and not out.endswith('\n'):
                out += '\n'
            spans.append((len(out), len(out) + len(l), True))
            out += l + ('\n' if k < len(lines) - 1 else '')
        else:
            spans.append((len(out), len(out) + len(l), False))
            out += l
    return out, spans


class Piece:
    def __init__(self, path, workdir):
        self.path = path
        self.id = os.path.splitext(os.path.basename(path))[0]
        self.src = open(path, encoding='utf-8').read()
        meta = dict(re.findall(r'^// @(\w+) (.+)$', self.src, re.M))
        self.rank = int(meta['rank'])
        self.votes = int(meta['votes'])
        self.title = meta['title'].strip()
        self.author = meta['author'].strip()
        self.url = meta['url'].strip()
        self.license = meta['license'].strip()
        self.read = meta['read'].strip()            # u8 | le16 | be16: how the sample stream becomes a picture
        self.fns = []                               # [(signature, name, tweet text, author's line spans)] for red, green, blue
        for m in SIG.finditer(self.src):
            depth, k = 1, m.end()
            while depth:
                depth += (self.src[k] == '{') - (self.src[k] == '}')
                k += 1
            self.fns.append((m.group(0).strip(), m.group(2)) + tweet_text(self.src[m.end():k - 1]))
        if len(self.fns) != 3:
            raise SystemExit(f'{path}: expected 3 functions, found {len(self.fns)}')
        self.count = [len(f[2]) for f in self.fns]
        for (sig, name, text, spans), n in zip(self.fns, self.count):
            if n > LIMIT:
                raise SystemExit(f'{self.id}: {name} is {n} characters (> {LIMIT})')
        self.workdir = workdir
        os.makedirs(workdir, exist_ok=True)

    def render(self):
        """Compile and run the program -> (1024, 1024, 3) uint8, decoded the way the entry was shown."""
        deps = self.src + open(os.path.join(os.path.dirname(os.path.abspath(self.path)), 'tweet.h'), encoding='utf-8').read()
        tag = hashlib.sha1(deps.encode()).hexdigest()[:10]
        ppm = os.path.join(self.workdir, f'{self.id}_{tag}.ppm')
        if not os.path.exists(ppm):
            exe = os.path.join(self.workdir, f'{self.id}.bin')
            subprocess.run(['g++', '-O2', '-std=c++11', '-w', os.path.abspath(self.path), '-o', exe], check=True)
            with open(ppm + '.tmp', 'wb') as f:
                subprocess.run([exe], check=True, stdout=f)
            os.replace(ppm + '.tmp', ppm)
        raw = open(ppm, 'rb').read()
        p = 0
        for _ in range(3):
            p = raw.index(b'\n', p) + 1
        maxv = int(raw[:p].split()[-1])
        data = raw[p:]
        if self.read == 'u8':
            assert maxv == 255
            im = np.frombuffer(data, np.uint8).reshape(1024, 1024, 3)
        else:
            assert maxv == 1023
            v = np.frombuffer(data, '<u2' if self.read == 'le16' else '>u2').reshape(1024, 1024, 3).astype(np.float64)
            im = np.floor(np.clip(v / maxv, 0, 1) * 255).astype(np.uint8)
        return np.ascontiguousarray(im)


def load_all(workdir, pattern=None):
    """All pieces of the film, in running order: lowest rank number last (a countdown to the top-voted entry)."""
    files = sorted(glob.glob(pattern or os.path.join(HERE, 'pieces', '[0-9]*_*.cpp')))
    ps = [Piece(f, workdir) for f in files]
    return sorted(ps, key=lambda p: -p.rank)


if __name__ == '__main__':
    import sys
    work = sys.argv[1] if len(sys.argv) > 1 else '/tmp/codeart_work'
    for p in load_all(work):
        im = p.render()
        print(f'No.{p.rank}  ▲{p.votes}  {p.title} — {p.author}   [{p.read}]  chars {p.count}  mean RGB {im.reshape(-1, 3).mean(0).round(1)}')
        for sig, name, text, spans in p.fns:
            print('     ', sig, '|', text.replace('\n', ' ⏎ ')[:150])
