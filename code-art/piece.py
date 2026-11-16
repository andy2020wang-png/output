"""A piece = one real C++ program whose three tweet-sized functions are the art.
The source file is the single source of truth: the video shows exactly the text that gets compiled.

A film = an ordered list of pieces, read from films.txt."""
import os
import re
import glob
import lzma
import hashlib
import subprocess
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
PIECES = os.path.join(HERE, 'pieces')
CACHE = os.path.join(HERE, 'cache')        # stored results of pieces that take hours (see @slow)
LIMIT = 140
CXX = 'g++ -O2 -std=c++11 -w'
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


def code_only(text):
    """Source text without comments and blank lines: what the result depends on."""
    out = []
    for line in text.split('\n'):
        line = re.sub(r'\s*//.*$', '', line).rstrip()
        if line.strip():
            out.append(line)
    return '\n'.join(out)


def decode(raw, read):
    """The program's sample stream -> (1024, 1024, 3) uint8, the way the entry's author looked at it.

    u8     8-bit template: the bytes are the picture.
    le16   10-bit template, each sample taken as the value the function returned, shown as value / 1023.
    be16   10-bit template read as a PPM file (high byte first, although the template wrote the low byte
           first), shown as value / 1023 and clipped at white.
    im16   as be16, but scaled the way ImageMagick does it: value * 65535 / 1023, wrapped to 16 bits,
           high byte shown. Values above the maximum wrap around instead of clipping."""
    p = 0
    for _ in range(3):
        p = raw.index(b'\n', p) + 1
    maxv = int(raw[:p].split()[-1])
    data = raw[p:]
    if read == 'u8':
        assert maxv == 255
        im = np.frombuffer(data, np.uint8).reshape(1024, 1024, 3)
    else:
        assert maxv == 1023
        v = np.frombuffer(data, '<u2' if read == 'le16' else '>u2').reshape(1024, 1024, 3).astype(np.float64)
        if read == 'im16':
            im = ((np.floor(v * 65535 / maxv + 0.5).astype(np.int64) % 65536) >> 8).astype(np.uint8)
        else:
            im = np.floor(np.clip(v / maxv, 0, 1) * 255).astype(np.uint8)
    return np.ascontiguousarray(im)


class Piece:
    def __init__(self, path, workdir):
        self.path = path
        self.file = os.path.splitext(os.path.basename(path))[0]
        self.id = self.file.split('_')[0]           # the selection number: 1a, 9a, 12 ...
        self.src = open(path, encoding='utf-8').read()
        meta = dict(re.findall(r'^// @(\w+) ?(.*)$', self.src, re.M))
        self.rank = int(meta['rank'])
        self.votes = int(meta['votes'])
        self.title = meta['title'].strip()
        self.author = meta['author'].strip()
        self.url = meta['url'].strip()
        self.license = meta['license'].strip()
        self.read = meta['read'].strip()             # u8 | le16 | be16 | im16, see decode()
        self.cxx = meta.get('cxx', CXX).strip()      # compiler command, if the piece needs a particular one
        self.slow = 'slow' in meta                   # takes hours: the result is kept in cache/
        assert '·' not in self.title and '.' not in self.title, self.title
        self.fns = []                                # [(signature, name, tweet text, author's line spans)] for red, green, blue
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
                raise SystemExit(f'{self.file}: {name} is {n} characters (> {LIMIT})')
        self.workdir = workdir
        os.makedirs(workdir, exist_ok=True)
        shell = open(os.path.join(PIECES, 'tweet.h'), encoding='utf-8').read()
        self.key = hashlib.sha1((code_only(self.src) + '\n--\n' + code_only(shell) + '\n--\n' + self.cxx).encode()).hexdigest()[:10]

    def _guard_ok(self, exe):
        """A piece built with TWEET_GUARD writes just past its last static table: check that the table
        really is the last thing in the program's static data, so those writes hit the guard pages."""
        syms = []
        for line in subprocess.run(['nm', '-n', '-S', exe], capture_output=True, text=True, check=True).stdout.split('\n'):
            f = line.split()
            if len(f) == 4 and f[2] in 'bB':
                syms.append((int(f[0], 16), int(f[1], 16), f[3]))
            elif len(f) == 3 and f[2] == '_end':
                end = int(f[0], 16)
        addr, size, name = max(syms, key=lambda s: s[1])
        return end - (addr + size) < 64

    def render(self):
        """-> (1024, 1024, 3) uint8. Compiles and runs the program unless its result is already there."""
        ppm = os.path.join(self.workdir, f'{self.file}_{self.key}.ppm')
        kept = os.path.join(CACHE, f'{self.file}_{self.key}.ppm.xz')
        if not os.path.exists(ppm) and os.path.exists(kept):
            with open(ppm + '.tmp', 'wb') as f:
                f.write(lzma.open(kept).read())
            os.replace(ppm + '.tmp', ppm)
        if not os.path.exists(ppm):
            exe = os.path.join(self.workdir, f'{self.file}.bin')
            subprocess.run(self.cxx.split() + [os.path.abspath(self.path), '-o', exe], check=True)
            if 'TWEET_GUARD' in code_only(self.src) and not self._guard_ok(exe):
                raise SystemExit(f'{self.file}: the table it writes past is not the last static object in this build')
            if self.slow:
                print(f'{self.file}: no stored result for this source, computing it now. This takes hours.', flush=True)
            with open(ppm + '.tmp', 'wb') as f:
                subprocess.run([exe], check=True, stdout=f)
            os.replace(ppm + '.tmp', ppm)
            if self.slow:
                os.makedirs(CACHE, exist_ok=True)
                with lzma.open(kept, 'wb', preset=9) as f:
                    f.write(open(ppm, 'rb').read())
        return decode(open(ppm, 'rb').read(), self.read)


class Film:
    def __init__(self, title, ids, cover, workdir):
        self.title = title                           # e.g. 程序的艺术 上
        self.name = title.replace(' ', '_')          # file name stem
        self.pieces = []
        for i in ids:
            hit = glob.glob(os.path.join(PIECES, i + '_*.cpp'))
            if len(hit) != 1:
                raise SystemExit(f'films.txt: piece {i} not found')
            self.pieces.append(Piece(hit[0], workdir))
        self.cover = ids.index(cover)                # which piece the cover shows
        assert '·' not in title


def load_films(workdir):
    """films.txt: one film per line:  title | piece numbers in running order | piece for the cover"""
    films = []
    for line in open(os.path.join(HERE, 'films.txt'), encoding='utf-8'):
        line = line.split('#')[0].strip()
        if line:
            title, ids, cover = [f.strip() for f in line.split('|')]
            films.append(Film(title, ids.split(), cover, workdir))
    return films


def load_film(workdir, which):
    """which: the film's title, or its last word (上 / 下), or its position (1, 2)."""
    films = load_films(workdir)
    for k, f in enumerate(films):
        if which in (f.title, f.name, f.title.split()[-1], str(k + 1)):
            return f
    raise SystemExit(f'no film "{which}" in films.txt')


if __name__ == '__main__':
    import sys
    work = sys.argv[1] if len(sys.argv) > 1 else '/tmp/codeart_work'
    films = load_films(work)
    for f in ([load_film(work, sys.argv[2])] if len(sys.argv) > 2 else films):
        print(f'{f.title}  ({len(f.pieces)} pieces, cover: {f.pieces[f.cover].id})')
        for p in f.pieces:
            im = p.render()
            print(f'  {p.id:4s} ▲{p.votes:<4d} {p.title} | {p.author}   [{p.read}]  chars {p.count}  mean RGB {im.reshape(-1, 3).mean(0).round(1)}')
