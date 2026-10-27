"""Score for 科技树 02 · 造船: one continuous piece at 96 BPM, 60 bars = 30 八拍 = 150 s.
Each ship is one section of 4 bars (two 八拍); the orchestra thickens era by era and the climax lands on
the nuclear carrier. The picture is built to this beat grid, so cue times are exported for the engine.
usage: python3 score.py <out_dir>            -> music.wav, sfx.wav, mix_raw.wav, cues.json, harshness.json"""
import os, sys, json
import numpy as np
from scipy.io import wavfile
from epic import (SR, mix, N, mtof, lp, hp, strings, spicc, brass, choir, organ, pad, flute, reed, horn_lur, pluck,
                  taiko, frame_drum, timpani, snare_soft, boom, riser, braam, hall, Bus, harshness)
import sfx as X

BPM = 96
B = 60 / BPM
BAR = 4 * B

PC = {'C': 0, 'C#': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}
CHORDS = {'Dm': 'D F A', 'Bb': 'Bb D F', 'F': 'F A C', 'C': 'C E G', 'Gm': 'G Bb D', 'A': 'A C# E',
          'Em': 'E G B', 'G': 'G B D', 'D': 'D F# A'}


def tones(ch):
    return [PC[n] for n in CHORDS[ch].split()]


def voicing(ch, lo, hi):
    return [m for m in range(lo, hi + 1) if m % 12 in tones(ch)]


def root(ch, octave=2):
    return tones(ch)[0] + 12 * (octave + 1)


PROG = ['Dm', 'Bb', 'F', 'C']
PROG_E = ['Em', 'C', 'G', 'D']
# themes: (beat, length in beats, note) over one 4-bar section of PROG
THEME = {
    'A': [(0, 2, 'D5'), (2, 1, 'E5'), (3, 1, 'F5'), (4, 3, 'D5'), (7, 1, 'C5'), (8, 2, 'C5'), (10, 1, 'A4'), (11, 1, 'C5'), (12, 4, 'E5')],
    'B': [(0, 2, 'A5'), (2, 1, 'G5'), (3, 1, 'F5'), (4, 3, 'F5'), (7, 1, 'D5'), (8, 2, 'F5'), (10, 2, 'A5'), (12, 3, 'G5'), (15, 1, 'E5')],
    'O': [(0, 3, 'F5'), (3, 1, 'E5'), (4, 4, 'C5'), (8, 2, 'E5'), (10, 2, 'G5'), (12, 4, 'D5')],
}

SECTIONS = [
    ('hook', 6, ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Bb'], {}),
    ('canoe', 4, PROG, dict(e=.30, lead=('flute', -12), theme='A', drums='paddle', drone=True)),
    ('nile', 4, PROG, dict(e=.38, lead=('choir_o', -12), theme='B', arp='harp', drums='frame')),
    ('trireme', 4, PROG, dict(e=.48, lead=('reed', -12), theme='A', arp='lyre', drums='oar', ost='8')),
    ('longship', 4, PROG, dict(e=.55, lead=('lur', -24), theme='B', drums='taiko', ost='8', choir='m')),
    ('fuchuan', 4, PROG, dict(e=.56, lead=('dizi', 0), theme='A', arp='zheng', drums='taiko', ost='8')),
    ('caravel', 4, PROG, dict(e=.62, lead=('choir_a', -12), theme='B', arp='lute', drums='taiko', ost='8')),
    ('lineship', 4, PROG, dict(e=.70, lead=('strings', 0), theme='A', drums='timp', ost='8', horns=True)),
    ('steam', 4, PROG, dict(e=.74, lead=('brass', -12), theme='B', drums='taiko', ost='16', horns=True)),
    ('ironclad', 4, PROG, dict(e=.80, lead=('trombone', -12), theme='A', drums='march', ost='16', horns=True)),
    ('dreadnought', 4, PROG, dict(e=.88, lead=('brass', -12), theme='B', drums='epic', ost='16', horns=True, braam=True)),
    ('carrier', 4, PROG, dict(e=.93, lead=('strings_hi', 0), theme='A', drums='epic', ost='16', horns=True, choir='a')),
    ('nuclear', 4, PROG_E, dict(e=1.0, lead=('tutti', -12), theme='B', drums='full', ost='16', horns=True, choir='a', braam=True, organ=True, key=2)),
    ('outro', 4, ['Bb', 'F', 'C', 'Dm'], dict(e=.30, lead=('flute', -12), theme='O', choir='u', outro=True)),
    ('end', 2, ['D', 'D'], {}),
]


def lead_note(kind, m, d, v):
    if kind == 'flute':
        return flute(m, d, v * 1.1)
    if kind == 'dizi':
        return flute(m, d, v, hollow=False)
    if kind == 'choir_o':
        return choir(m, d, v * 1.1, 'o', voices=5, a=.3)
    if kind == 'choir_a':
        return choir(m, d, v, 'a', voices=8, a=.25)
    if kind == 'reed':
        return reed(m, d, v)
    if kind == 'lur':
        return horn_lur(m, d, v * 1.2)
    if kind == 'strings':
        return strings(m, d, v * 1.4, a=.12, r=.5, voices=8, bright=3600)
    if kind == 'strings_hi':
        return mix(strings(m, d, v * 1.3, a=.1, r=.5, voices=8, bright=3800), brass(m - 12, d, v * .7, voices=3))
    if kind == 'brass':
        return brass(m, d, v * 1.2, voices=4, bright=2000)
    if kind == 'trombone':
        return brass(m, d, v * 1.3, voices=4, dark=380, bright=1500)
    if kind == 'tutti':
        return mix(strings(m + 12, d, v * 1.1, a=.1, r=.6, voices=8, bright=3800), brass(m, d, v * 1.1, voices=4),
                   choir(m + 12, d, v * .6, 'a', voices=8, a=.15))
    raise KeyError(kind)


def drum_pattern(style, bar_i, last):
    """(beat within bar, instrument, velocity)"""
    P = {
        'paddle': [(0, 'frame', .45), (2, 'frame', .35)],
        'frame': [(0, 'frame', .6), (1.5, 'frame', .3), (2, 'frame', .5), (3, 'frame', .35), (3.5, 'frame', .28)],
        'oar': [(0, 'taiko', .7), (2, 'taiko', .6), (1, 'frame', .25), (3, 'frame', .25)],
        'taiko': [(0, 'taiko', .8), (1.5, 'taiko', .38), (2, 'taiko', .6), (3, 'taiko', .48), (3.5, 'taiko', .34)],
        'timp': [(0, 'taiko', .7), (0, 'timp_r', .6), (2, 'timp_5', .5), (3.5, 'taiko', .35)],
        'march': [(0, 'taiko', .7), (2, 'taiko', .55)] + [(b, 'snare', g) for b, g in
                  [(0, .6), (.5, .25), (1, .45), (1.5, .25), (1.75, .2), (2, .6), (2.5, .25), (3, .45), (3.5, .32), (3.75, .25)]],
        'epic': [(0, 'taiko', 1.0), (.75, 'taiko', .4), (1.5, 'taiko', .6), (2, 'taiko', .9), (3, 'taiko', .7), (3.5, 'taiko', .55), (0, 'timp_r', .6)],
    }
    P['full'] = P['epic'] + [(b / 2, 'frame', .25 + .1 * (b % 2 == 0)) for b in range(8)]
    hits = list(P[style])
    if last and style in ('taiko', 'epic', 'full', 'march'):     # build into the next shot
        hits = [h for h in hits if h[0] < 3] + [(3 + k * .25, 'taiko', .35 + .12 * k) for k in range(4)]
    return hits


def play_drum(bus, at, inst, v, ch, key):
    if inst == 'frame':
        bus.add(at, frame_drum(v, p=.15))
    elif inst == 'taiko':
        bus.add(at, taiko(v, f=56 + 4 * (int(at / B) % 2), p=-.15 + .3 * (int(at / B) % 2)))
    elif inst == 'timp_r':
        bus.add(at, timpani(root(ch, 2) + key * 0, v))
    elif inst == 'timp_5':
        bus.add(at, timpani(root(ch, 2) + 7, v))
    elif inst == 'snare':
        bus.add(at, snare_soft(v, p=.25))


def section_music(mus, t0, sid, chords, cfg, nxt):
    e = cfg.get('e', .5)
    key = cfg.get('key', 0)
    nb = len(chords)
    # harmonic bed
    for i, ch in enumerate(chords):
        tb = t0 + i * BAR
        for m in voicing(ch, 50, 69):
            mus.add(tb, pad(m, BAR, .45 + .45 * e))
        mus.add(tb, strings(root(ch, 2), BAR, .5 + .5 * e, a=.2, r=.6, voices=5, bright=1600))
        if cfg.get('drone') and i == 0:
            mus.add(tb, mix(pad(N('D2'), nb * BAR, .9, a=2.0, r=2.0), pad(N('A2'), nb * BAR, .6, a=2.0, r=2.0)))
        if cfg.get('horns'):
            for m in voicing(ch, 53, 67):
                mus.add(tb, brass(m, BAR, .35 * e, a=.25, r=.5, voices=2, dark=450, bright=1300, width=.8))
        if cfg.get('choir'):
            vw = cfg['choir']
            lo, hi = (45, 57) if vw == 'm' else (57, 72)
            for m in voicing(ch, lo, hi):
                mus.add(tb, choir(m, BAR, .38 + .3 * e, vw, voices=6))
        if cfg.get('organ'):
            for m in voicing(ch, 43, 64):
                mus.add(tb, organ(m, BAR, .45))
        # arpeggio colour
        if cfg.get('arp'):
            seq = voicing(ch, 62, 81)
            order = [0, 1, 2, 3, 4, 3, 2, 1]
            for k in range(8):
                m = seq[order[k] % len(seq)]
                mus.add(tb + k * B / 2, pluck(m, cfg['arp'], .55 + .25 * e, p=-.4 + .1 * k))
        # low string ostinato
        if cfg.get('ost') == '8':
            r_ = root(ch, 2)
            for k in range(8):
                mus.add(tb + k * B / 2, spicc(r_ + 12 * (k % 2), .5 + .4 * e * (1 if k % 2 == 0 else .7), p=-.2))
        elif cfg.get('ost') == '16':
            r_ = root(ch, 2)
            for beat in range(4):
                for off, g in [(0, 1.0), (.5, .6), (.75, .7)]:
                    mus.add(tb + (beat + off) * B, spicc(r_ + (12 if off == .5 else 0), .55 * g + .35 * e * g, d=.12, p=-.2))
                    mus.add(tb + (beat + off) * B, spicc(r_ + 19, .25 * g * e, d=.12, voices=3, p=.35))
        # drums
        if cfg.get('drums'):
            for b_, inst, g in drum_pattern(cfg['drums'], i, i == nb - 1):
                play_drum(mus, tb + b_ * B, inst, g * (.5 + .5 * e), ch, key)
    # theme
    if cfg.get('lead'):
        kind, octv = cfg['lead']
        for b_, L, nm in THEME[cfg['theme']]:
            m = N(nm) + octv + key
            mus.add(t0 + b_ * B, lead_note(kind, m, L * B - .04, .55 + .45 * e))
    if cfg.get('braam'):
        mus.add(t0, braam(root(chords[0], 4) + 0, 3.4, .55 + .3 * e))
    # transition into the next shot: air swell on the last beat, low hit on the downbeat
    if nxt is not None and nxt.get('e') is not None:
        ne = nxt['e']
        mus.add(t0 + nb * BAR - B, riser(B, .5 + .7 * max(e, ne)))
        mus.add(t0 + nb * BAR, boom(.25 + .55 * ne))


def hook_music(mus, t0, chords):
    # bars 0-1: the question. A low pedal, a slow heartbeat, two soft timpani strokes for options A and B
    for m in (N('D2'), N('A2'), N('D3')):
        mus.add(t0, pad(m, 4 * BAR, .8, a=1.5, r=1.0))
    for i in range(2):
        mus.add(t0 + i * BAR, taiko(.45, f=52))
        for k in range(8):
            mus.add(t0 + i * BAR + k * B / 2, spicc(N('D2') + 12 * (k % 2), .32 if k % 2 == 0 else .2, p=-.2))
    mus.add(t0 + 4 * B, timpani(N('A1'), .45))
    mus.add(t0 + 6 * B, timpani(N('D2'), .5))
    # bars 2-3: the reveal. Bb -> C, strings swell, timpani roll grows into the title
    for i, ch in ((2, 'Bb'), (3, 'C')):
        for m in voicing(ch, 50, 72):
            mus.add(t0 + i * BAR, strings(m, BAR, .55 + .2 * (i - 2), a=.6, r=.4, voices=6, bright=2600))
        mus.add(t0 + i * BAR, strings(root(ch, 2), BAR, .8, a=.3, r=.4, bright=1500))
        for k in range(8):
            mus.add(t0 + i * BAR + k * B / 2, spicc(root(ch, 2) + 12 * (k % 2), .35 + .1 * (i - 2), p=-.2))
    for k in range(16):
        mus.add(t0 + 3 * BAR + k * B / 4, timpani(N('A1'), .12 + .4 * (k / 15) ** 1.5, d=1.0))
    mus.add(t0 + 4 * BAR - B, riser(B, 1.1))
    # bars 4-5: the title. First full tutti of the film
    tt = t0 + 4 * BAR
    mus.add(tt, braam(N('D4'), 3.6, 1.0))
    mus.add(tt, boom(1.0))
    for i, ch in ((4, 'Dm'), (5, 'Bb')):
        tb = t0 + i * BAR
        for m in voicing(ch, 50, 72):
            mus.add(tb, strings(m, BAR, .75, a=.08, r=.8, voices=6, bright=3000))
            mus.add(tb, choir(m, BAR, .45, 'a', voices=6, a=.2))
        for m in voicing(ch, 53, 67):
            mus.add(tb, brass(m, BAR, .55, a=.1, r=.8, voices=2, dark=450, bright=1500))
        for b_, inst, g in drum_pattern('epic', i, False):
            play_drum(mus, tb + b_ * B, inst, g * (.9 if i == 4 else .6), ch, 0)
    for b_, L, nm in THEME['A'][:5]:
        mus.add(tt + b_ * B, brass(N(nm) - 12, L * B - .04, 1.1, voices=4, bright=1900))
    mus.add(t0 + 6 * BAR - B, riser(B, .5))


def end_music(mus, t0):
    # Picardy third: the film resolves to D major
    for m in voicing('D', 50, 74):
        mus.add(t0, strings(m, 2 * BAR - .5, .7, a=.4, r=2.5, voices=6, bright=2400))
        mus.add(t0, choir(m, 2 * BAR - .5, .45, 'o', voices=6, a=.5, r=2.5))
    mus.add(t0, strings(N('D2'), 2 * BAR - .5, .9, a=.4, r=2.5, bright=1200))
    mus.add(t0, flute(N('A4'), 2 * BAR - .8, .5, r=1.5))
    mus.add(t0, timpani(N('D2'), .5))


def section_sfx(fx, t0, sid):
    b = lambda k: t0 + k * B
    D = 4 * BAR
    if sid == 'canoe':
        fx.add(t0, X.water(D + .8, .55))
        for k in range(0, 16, 2):
            fx.add(b(k), X.paddle(.5, p=-.3 if k % 4 == 0 else .3))
    elif sid == 'nile':
        fx.add(t0, X.water(D + .8, .4)); fx.add(t0, X.wind(D + .8, .45))
        fx.add(b(8), X.sail_fill(.8))
    elif sid == 'trireme':
        fx.add(t0, X.water(D + .8, .35))
        for k in range(0, 16, 2):
            fx.add(b(k), X.oar_stroke(.6, p=-.1 + .2 * (k % 4 == 0)))
    elif sid == 'longship':
        fx.add(t0, X.ocean(D + .8, .6)); fx.add(t0, X.wind(D + .8, .5, 100, 520))
        fx.add(b(3), X.creak(.7, p=-.4)); fx.add(b(11), X.creak(.6, p=.4, f=48))
    elif sid == 'fuchuan':
        fx.add(t0, X.water(D + .8, .4))
        fx.add(b(8), X.gurgle(3.6, .8)); fx.add(b(13), X.creak(.5, p=.3))
    elif sid == 'caravel':
        fx.add(t0, X.ocean(D + .8, .5)); fx.add(t0, X.wind(D + .8, .45))
        fx.add(b(4), X.sail_fill(.6)); fx.add(b(12), X.sail_fill(.6)); fx.add(b(8), X.creak(.5))
    elif sid == 'lineship':
        fx.add(t0, X.ocean(D + .8, .4))
        for i, k in enumerate((8, 9, 10, 11)):
            fx.add(b(k), X.cannon(.75, p=-.6 + .4 * i))
    elif sid == 'steam':
        fx.add(t0, X.water(D + .8, .35))
        for k in range(16):
            fx.add(b(k), X.chuff(.5 if k % 2 == 0 else .35, p=.1))
            fx.add(b(k + .5), X.wheel_splash(.3, p=-.3))
    elif sid == 'ironclad':
        fx.add(t0, X.water(D + .8, .3)); fx.add(b(2), X.rumble(6.0, .6, 42))
        fx.add(b(8), X.cannon(.5, p=-.5)); fx.add(b(10), X.thunk(.7, p=.2)); fx.add(b(12.5), X.thunk(.55, p=-.1))
    elif sid == 'dreadnought':
        fx.add(t0, X.ocean(D + .8, .4)); fx.add(t0, X.rumble(D + .5, .45, 50))
        for k in (8, 12):
            for j, off in enumerate((0, .05, .11)):
                fx.add(b(k) + off, X.cannon(.6, p=-.3 + .3 * j))
    elif sid == 'carrier':
        fx.add(t0, X.ocean(D + .8, .4))
        for k in (4, 8, 12):
            fx.add(b(k), X.catapult(.6)); fx.add(b(k) + .08, X.jet(.55, 3.0))
    elif sid == 'nuclear':
        fx.add(t0, X.ocean(D + .8, .5)); fx.add(t0, X.hum(D + .5, .45, 55))
        fx.add(b(6), X.jet(.3, 4.0, .6, -.6))
    elif sid == 'outro':
        fx.add(t0, X.water(D + .8, .45))
        for k in (0, 2, 4, 6):
            fx.add(b(k), X.paddle(.35 - .05 * k / 2, p=.2))
    elif sid == 'end':
        fx.add(t0, X.water(2 * BAR, .3))


# loudness arc (approximate K-weighted RMS, dB, relative): quiet dawn, steady climb, climax on the nuclear carrier
ARC = {'hook': -23, 'title': -16.5, 'canoe': -24, 'nile': -23, 'trireme': -22, 'longship': -21, 'fuchuan': -20.5,
       'caravel': -20, 'lineship': -19, 'steam': -18.5, 'ironclad': -18, 'dreadnought': -17, 'carrier': -16.5,
       'nuclear': -15, 'outro': -23, 'end': -21}


def kweight(x):
    m = x.mean(0)
    m = hp(m, 100)
    return m + .6 * hp(m, 1500)


def arc(buf, segs, ramp=.06):
    """scale each segment of the dry music bus to its ARC level; ramps finish exactly on each downbeat"""
    k = kweight(buf)
    g = np.ones(buf.shape[1])
    gains = []
    for sid, a, b in segs:
        seg = k[int(a * SR):int(b * SR)]
        cur = 10 * np.log10((seg ** 2).mean() + 1e-12)
        gains.append(np.clip(ARC[sid] - cur, -9, 9))
    for i, (sid, a, b) in enumerate(segs):
        g[int(a * SR):] = 10 ** (gains[i] / 20)
        if i:
            i0, i1 = int((a - ramp) * SR), int(a * SR)
            g0, g1 = 10 ** (gains[i - 1] / 20), 10 ** (gains[i] / 20)
            g[i0:i1] = np.linspace(g0, g1, i1 - i0)
    return buf * g, dict(zip([s_[0] for s_ in segs], np.round(gains, 1).tolist()))


def build():
    total = sum(n for _, n, _, _ in SECTIONS) * BAR
    mus, fx = Bus(total), Bus(total)
    cues, t = [], 0.0
    for i, (sid, nb, chords, cfg) in enumerate(SECTIONS):
        nxt = SECTIONS[i + 1][3] if i + 1 < len(SECTIONS) else None
        if sid == 'hook':
            hook_music(mus, t, chords)
        elif sid == 'end':
            end_music(mus, t)
        else:
            section_music(mus, t, sid, chords, cfg, nxt)
        section_sfx(fx, t, sid)
        cues.append({'id': sid, 'start': round(t, 4), 'end': round(t + nb * BAR, 4), 'bars': nb})
        t += nb * BAR
    n = int(total * SR) + int(3.0 * SR)
    segs = []
    for c in cues:
        if c['id'] == 'hook':
            segs += [('hook', c['start'], c['start'] + 4 * BAR), ('title', c['start'] + 4 * BAR, c['end'])]
        else:
            segs.append((c['id'], c['start'], c['end']))
    dry, gains = arc(mus.buf[:, :n], segs)
    print('arc gains', gains)
    music = hall(dry, 2.8, .3)
    effects = hall(fx.buf[:, :n], 1.4, .12, damp=3000)
    return music, effects, cues, total


def soften(x):
    """master: a soft air shelf above 6 kHz (about +4.5 dB; every source is smooth up there) and a soft knee"""
    x = x + .7 * hp(x, 6500)
    pk = np.abs(x).max() + 1e-9
    x = x / pk * .9
    return np.tanh(x * 1.1) / np.tanh(1.1) * .9


def write(path, x):
    wavfile.write(path, SR, np.ascontiguousarray(x.T).astype(np.float32))


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'out'
    os.makedirs(out, exist_ok=True)
    music, effects, cues, total = build()
    mix = soften(music + .55 * effects)
    write(os.path.join(out, 'music.wav'), soften(music))
    write(os.path.join(out, 'sfx.wav'), effects / (np.abs(effects).max() + 1e-9) * .5)
    write(os.path.join(out, 'mix_raw.wav'), mix)
    json.dump({'bpm': BPM, 'beat': B, 'bar': BAR, 'total': total, 'sections': cues}, open(os.path.join(out, 'cues.json'), 'w'), indent=1)
    rep = {'music': harshness(music), 'sfx': harshness(effects), 'mix': harshness(mix)}
    json.dump(rep, open(os.path.join(out, 'harshness.json'), 'w'), indent=1)
    print(json.dumps(rep), f'total {total:.1f}s')
