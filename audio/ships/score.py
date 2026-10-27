"""Score for 科技树 02 · 造船: one continuous piece at 96 BPM, 60 bars = 30 八拍 = 150 s (+2.5 s ring-out).
Form, after the sound review: two waves that follow the story.
  Wave 1 builds from the canoe to the ship of the line (the height of sail).
  Steam is a breath with a new machine rhythm and new harmony that leans into wave 2.
  Wave 2 runs ironclad -> nuclear carrier; the carrier thins to choir and heartbeat, then VI-VII-I lifts into E major.
Every join is a musical gesture on the last beat that lands on the next downbeat; only three hinges use the
air swell. Effects sit in three layers (bed, rhythm, hero) at set distances under the music, and the music
dips 2.5 dB under each hero hit.
usage: python3 score.py <out_dir>  -> mix.wav (-14 LUFS, <= -1 dBTP), music.wav, effects.wav, cues.json, report.json"""
import os, sys, json, subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly
from scipy.ndimage import minimum_filter1d, uniform_filter1d
from epic import (SR, N, mix, hp, bp, strings, spicc, brass, choir, organ, pad, flute, reed, horn_lur, pluck,
                  taiko, frame_drum, timpani, snare_soft, boom, riser, braam, heartbeat, hall, Bus, harshness)
import sfx as X

BPM = 96
B = 60 / BPM
BAR = 4 * B
TAIL = 2.5

PC = {'C': 0, 'C#': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'Bb': 10, 'B': 11}
CHORDS = {'Dm': 'D F A', 'Bb': 'Bb D F', 'F': 'F A C', 'C': 'C E G', 'Gm': 'G Bb D', 'A': 'A C# E',
          'Em': 'E G B', 'G': 'G B D', 'D': 'D F# A', 'E': 'E G# B'}


def tones(ch):
    return [PC[n] for n in CHORDS[ch].split()]


def voicing(ch, lo, hi):
    return [m for m in range(lo, hi + 1) if m % 12 in tones(ch)]


def root(ch, octave=2):
    return tones(ch)[0] + 12 * (octave + 1)


def expand(chords):
    """per-bar chord list ('C|D' splits a bar) -> [(beat, beats, chord)]"""
    out = []
    for i, c in enumerate(chords):
        parts = c.split('|')
        for j, p in enumerate(parts):
            out.append((i * 4 + j * 4 / len(parts), 4 / len(parts), p))
    return out


def chord_at(segs, beat):
    return next(c for b0, L, c in reversed(segs) if b0 <= beat + 1e-9)


PROG = ['Dm', 'Bb', 'F', 'C']
THEME = {   # (beat, length in beats, note)
    'A': [(0, 2, 'D5'), (2, 1, 'E5'), (3, 1, 'F5'), (4, 3, 'D5'), (7, 1, 'C5'), (8, 2, 'C5'), (10, 1, 'A4'), (11, 1, 'C5'), (12, 4, 'E5')],
    'B': [(0, 2, 'A5'), (2, 1, 'G5'), (3, 1, 'F5'), (4, 3, 'F5'), (7, 1, 'D5'), (8, 2, 'F5'), (10, 2, 'A5'), (12, 3, 'G5'), (15, 1, 'E5')],
    'S': [(0, 2, 'D5'), (2, 2, 'F5'), (4, 3, 'C5'), (7, 1, 'A4'), (8, 2, 'Bb4'), (10, 2, 'D5'), (12, 4, 'C#5')],       # Bb F Gm A
    'C': [(0, 2, 'D5'), (2, 1, 'Bb4'), (3, 1, 'D5'), (4, 3, 'F5'), (7, 1, 'D5'), (8, 2, 'E5'), (10, 2, 'G5'), (12, 4, 'A5')],  # Gm Bb C Dm
    'N': [(0, 2, 'E5'), (2, 1, 'F#5'), (3, 1, 'G5'), (4, 2, 'E5'), (6, 2, 'F#5'), (8, 4, 'G#5'), (12, 2, 'B5'), (14, 2, 'E6')],  # Em C|D E E
    'O': [(0, 4, 'E5'), (4, 2, 'D5'), (6, 1, 'E5'), (7, 1, 'F5'), (8, 3, 'D5'), (11, 1, 'C5'), (12, 4, 'E5')],          # A Dm Bb C
}

# id, bars, chords, config.  join = gesture on the last beat into the next shot
SECTIONS = [
    ('hook', 6, ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Bb'], {}),
    ('canoe', 4, PROG, dict(e=.30, lead=('flute', -12), theme='A', drums='paddle', drone=True, join='harp_gliss')),
    ('nile', 4, PROG, dict(e=.36, lead=('choir_o', -12), theme='B', arp='harp', drums='frame', join='timp_roll')),
    ('trireme', 4, PROG, dict(e=.44, lead=('reed', -12), theme='A', arp='lyre', drums='oar', ost='8', join='string_run')),
    ('longship', 4, PROG, dict(e=.52, lead=('lur', -24), theme='B', drums='taiko', ost='8', choir='m', join='harp_gliss')),
    ('fuchuan', 4, PROG, dict(e=.56, lead=('dizi', 0), theme='A', arp='zheng', drums='taiko', ost='8', join='string_run')),
    ('caravel', 4, PROG, dict(e=.64, lead=('choir_a', -12), theme='B', arp='lute', drums='taiko', ost='8', join='timp_roll')),
    ('lineship', 4, PROG, dict(e=.78, lead=('strings', 0), theme='A', drums='timp', ost='16', horns=True, choir='a', join='hinge')),
    ('steam', 4, ['Bb', 'F', 'Gm', 'A'], dict(e=.55, lead=('brass', -12), theme='S', drums='heave', ost='machine', join='snare_roll')),
    ('ironclad', 4, ['Gm', 'Bb', 'C', 'Dm'], dict(e=.70, lead=('trombone', -12), theme='C', drums='march', ost='16', horns=True, join='timp_roll')),
    ('dreadnought', 4, ['Gm', 'Bb', 'C', 'Dm'], dict(e=.84, lead=('brass', -12), theme='C', drums='epic', ost='16', horns=True, braam=True, join='string_run')),
    ('carrier', 4, PROG, dict(e=.92, lead=('strings_hi', 0), theme='A', drums='epic', ost='16', horns=True, choir='a', thin_end=True, join='hinge_quiet')),
    ('nuclear', 4, ['Em', 'C|D', 'E', 'E'], dict(e=1.0, lead=('tutti', -12), theme='N', drums='full', ost='16', horns=True, choir='a', braam=True, organ=True)),
    ('outro', 4, ['A', 'Dm', 'Bb', 'C'], dict(e=.30, lead=('flute', -12), theme='O', choir='u', recap=True)),
    ('end', 2, ['D', 'D'], {}),
]

# loudness arc (approximate short-term K-weighted level, relative dB; the final gain sets integrated -14 LUFS)
ARC = {'hook': -17, 'title': -13.5, 'canoe': -18.5, 'nile': -18, 'trireme': -17.5, 'longship': -17, 'fuchuan': -17,
       'caravel': -16.5, 'lineship': -15, 'steam': -16.5, 'ironclad': -15.5, 'dreadnought': -15, 'carrier': -14.5,
       'nuclear': -13, 'outro': -18, 'end': -17}
BED_UNDER, RHYTHM_UNDER, HERO_UNDER = 13.5, 9.0, 4.5      # LU below the music


def pres(x):
    """a little 0.8-1.5 kHz horn presence for the brass leads"""
    return x + .25 * bp(x, 800, 1500)


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
        return strings(m, d, v * 1.4, a=.12, r=.5, voices=8, bright=4600)
    if kind == 'strings_hi':
        return mix(strings(m, d, v * 1.3, a=.1, r=.5, voices=8, bright=4800), pres(brass(m - 12, d, v * .7, voices=3)))
    if kind == 'brass':
        return pres(brass(m, d, v * 1.2, voices=4, bright=2400))
    if kind == 'trombone':
        return pres(brass(m, d, v * 1.3, voices=4, dark=380, bright=1700))
    if kind == 'tutti':
        return mix(strings(m + 12, d, v * 1.1, a=.1, r=.6, voices=8, bright=4800), pres(brass(m, d, v * 1.1, voices=4)),
                   choir(m + 12, d, v * .6, 'a', voices=8, a=.15))
    raise KeyError(kind)


def drum_pattern(style, last):
    """(beat within bar, instrument, velocity). Timpani never doubles a taiko downbeat."""
    P = {
        'paddle': [(0, 'frame', .45), (2, 'frame', .35)],
        'frame': [(0, 'frame', .6), (1.5, 'frame', .3), (2, 'frame', .5), (3, 'frame', .35), (3.5, 'frame', .28)],
        'oar': [(0, 'taiko', .7), (2, 'taiko', .6), (1, 'frame', .25), (3, 'frame', .25)],
        'taiko': [(0, 'taiko', .8), (1.5, 'taiko', .38), (2, 'taiko', .6), (3, 'taiko', .48), (3.5, 'taiko', .34)],
        'timp': [(0, 'taiko', .75), (1.5, 'timp_r', .5), (2, 'timp_5', .5), (3, 'taiko', .45), (3.5, 'timp_r', .35)],
        'heave': [(0, 'taiko', .55), (2, 'frame', .3), (3.5, 'frame', .22)],
        'march': [(0, 'taiko', .7), (2, 'taiko', .55)] + [(b, 'snare', g) for b, g in
                  [(0, .6), (.5, .25), (1, .45), (1.5, .25), (1.75, .2), (2, .6), (2.5, .25), (3, .45), (3.5, .32), (3.75, .25)]],
        'epic': [(0, 'taiko', 1.0), (.75, 'taiko', .4), (1.5, 'taiko', .6), (2, 'taiko', .9), (2.5, 'timp_r', .5), (3, 'taiko', .7), (3.5, 'taiko', .55)],
    }
    P['full'] = P['epic'] + [(b / 2, 'frame', .25 + .1 * (b % 2 == 0)) for b in range(8)]
    hits = list(P[style])
    if last and style in ('taiko', 'epic', 'full', 'march', 'timp'):       # fill on the last beat
        hits = [h for h in hits if h[0] < 3] + [(3 + k * .25, 'taiko', .3 + .1 * k) for k in range(4)]
    return hits


def play_drum(bus, at, inst, v, ch):
    k = int(round(at / B))
    if inst == 'frame':
        bus.add(at, frame_drum(v, p=.15))
    elif inst == 'taiko':
        bus.add(at, taiko(v, f=56 + 4 * (k % 2), p=-.15 + .3 * (k % 2)))
    elif inst == 'timp_r':
        bus.add(at, timpani(root(ch, 2), v))
    elif inst == 'timp_5':
        bus.add(at, timpani(root(ch, 2) + 7, v))
    elif inst == 'snare':
        bus.add(at, snare_soft(v, p=.25))


def gesture(mus, t_end, kind, nxt_chord, e):
    """the last beat of a shot, landing on the next downbeat"""
    t0 = t_end - B
    if kind == 'harp_gliss':
        for i, m in enumerate(voicing(nxt_chord, 62, 86)[:8]):
            mus.add(t0 + i * B / 8, pluck(m, 'harp', .45 + .05 * i, p=-.5 + .14 * i))
    elif kind == 'timp_roll':
        for i in range(8):
            mus.add(t0 + i * B / 8, timpani(root(nxt_chord, 2), .1 + .05 * i, d=.8))
        mus.add(t_end, timpani(root(nxt_chord, 2), .4 + .3 * e))
    elif kind == 'string_run':
        scale = [N(x) for x in ('D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'C5')]
        for i, m in enumerate(scale + [voicing(nxt_chord, 69, 81)[0]]):
            mus.add(t0 + i * B / 8, spicc(m, .35 + .05 * i, d=.09, voices=5, bright=4200, p=.3))
    elif kind == 'snare_roll':
        for i in range(16):
            mus.add(t0 + i * B / 16, snare_soft(.08 + .03 * i, p=.2))
        mus.add(t_end, taiko(.5 + .3 * e))
    elif kind == 'hinge':
        mus.add(t0, riser(B, .5 + .6 * e))
        mus.add(t_end, boom(.3 + .5 * e))
    elif kind == 'hinge_quiet':                     # no boom: a braam plays on this downbeat
        mus.add(t0, riser(B, .9))


def section_music(mus, t0, sid, chords, cfg, nxt_chord):
    e = cfg.get('e', .5)
    segs = expand(chords)
    nb = len(chords)
    thin = cfg.get('thin_end')
    cut = 14 if thin else 99                     # from this beat only choir and heartbeat remain
    for b0, L, ch in segs:
        if b0 >= cut:
            continue
        tb, d = t0 + b0 * B, L * B
        dd = min(d, (cut - b0) * B)
        for m in voicing(ch, 50, 69):
            mus.add(tb, pad(m, dd, .45 + .45 * e))
        mus.add(tb, strings(root(ch, 2), dd, .5 + .5 * e, a=.2, r=.6, voices=5, bright=1800))
        if cfg.get('horns'):
            for m in voicing(ch, 53, 67):
                mus.add(tb, brass(m, dd, .35 * e, a=.25, r=.5, voices=2, dark=450, bright=1400, width=.8))
        if cfg.get('choir'):
            vw = cfg['choir']
            lo, hi = (45, 57) if vw == 'm' else (57, 72)
            for m in voicing(ch, lo, hi):
                mus.add(tb, choir(m, d, .38 + .3 * e, vw, voices=6))      # the choir carries through the thinned beats
        if cfg.get('organ'):
            for m in voicing(ch, 43, 64):
                mus.add(tb, organ(m, d, .45))
    if cfg.get('drone'):
        mus.add(t0, mix(pad(N('D2'), nb * BAR, .9, a=2.0, r=2.0), pad(N('A2'), nb * BAR, .6, a=2.0, r=2.0)))
    for i in range(nb):
        tb = t0 + i * BAR
        if cfg.get('arp'):
            for k in range(8):
                if i * 4 + k / 2 >= cut:
                    break
                seq = voicing(chord_at(segs, i * 4 + k / 2), 62, 81)
                m = seq[[0, 1, 2, 3, 4, 3, 2, 1][k] % len(seq)]
                mus.add(tb + k * B / 2, pluck(m, cfg['arp'], .55 + .25 * e, p=-.4 + .1 * k))
        ost = cfg.get('ost')
        if ost in ('8', 'machine'):
            for k in range(8):
                if i * 4 + k / 2 >= cut:
                    break
                r_ = root(chord_at(segs, i * 4 + k / 2), 2)
                if ost == '8':
                    mus.add(tb + k * B / 2, spicc(r_ + 12 * (k % 2), .5 + .4 * e * (1 if k % 2 == 0 else .7), p=-.2))
                else:       # steam: root and fifth, staccato, accents on 1 and 3
                    mus.add(tb + k * B / 2, spicc(r_ + (7 if k % 2 else 0) + 12, .55 if k % 4 == 0 else .35, d=.1, voices=4, p=.25))
        elif ost == '16':
            for beat in range(4):
                if i * 4 + beat >= cut:
                    break
                r_ = root(chord_at(segs, i * 4 + beat), 2)
                for off, g in [(0, 1.0), (.5, .6), (.75, .7)]:
                    mus.add(tb + (beat + off) * B, spicc(r_ + (12 if off == .5 else 0), .55 * g + .35 * e * g, d=.12, p=-.2))
                    mus.add(tb + (beat + off) * B, spicc(r_ + 19, .25 * g * e, d=.12, voices=3, p=.35))
        if cfg.get('drums'):
            for b_, inst, g in drum_pattern(cfg['drums'], i == nb - 1 and not thin):
                if i * 4 + b_ >= cut or (cfg.get('braam') and i == 0 and b_ == 0):
                    continue                        # a braam is the downbeat, nothing stacks on it
                play_drum(mus, tb + b_ * B, inst, g * (.5 + .5 * e), chord_at(segs, i * 4 + b_))
    if thin:
        mus.add(t0 + cut * B, heartbeat(.8))
        mus.add(t0 + (cut + 1) * B, heartbeat(.6))
    if cfg.get('lead'):
        kind, octv = cfg['lead']
        for b_, L, nm in THEME[cfg['theme']]:
            if b_ >= cut:
                continue
            L = min(L, cut - b_)
            mus.add(t0 + b_ * B, lead_note(kind, N(nm) + octv, L * B - .04, .55 + .45 * e))
    if cfg.get('braam'):
        mus.add(t0, braam(root(chords[0], 4), 3.4, .55 + .3 * e))
    if cfg.get('recap'):        # outro 八拍 2: one rising harp note per eighth, one for each of the 12 ships
        notes = [N(x) for x in ('D4', 'F4', 'A4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'C6', 'D6', 'E6')]
        for k, m in enumerate(notes):
            mus.add(t0 + 2 * BAR + k * B / 2, pluck(m, 'harp', .5, p=-.6 + .1 * k))
    if cfg.get('join') and nxt_chord:
        gesture(mus, t0 + nb * BAR, cfg['join'], nxt_chord, e)


def hook_music(mus, t0):
    # 八拍 1, the question: low pedal, a heartbeat, the series motif in the horn's middle register so that
    # phone speakers carry it, two soft timpani strokes for options A and B
    for m in (N('D2'), N('A2'), N('D3')):
        mus.add(t0, pad(m, 4 * BAR, .8, a=1.5, r=1.0))
    for i in range(2):
        mus.add(t0 + i * BAR, taiko(.45, f=52))
        for k in range(8):
            mus.add(t0 + i * BAR + k * B / 2, spicc(N('D2') + 12 * (k % 2), .32 if k % 2 == 0 else .2, p=-.2))
    for b_, L, nm in [(0, 2, 'D4'), (2, 1, 'E4'), (3, 1, 'F4'), (4, 4, 'A3')]:
        mus.add(t0 + b_ * B, brass(N(nm), L * B - .04, .55, voices=3, dark=500, bright=1500, a=.12))
    mus.add(t0 + 4 * B, timpani(N('A1'), .45))
    mus.add(t0 + 6 * B, timpani(N('D2'), .5))
    # 八拍 2, the reveal: Bb -> C, strings swell, a timpani roll grows into the title
    for i, ch in ((2, 'Bb'), (3, 'C')):
        for m in voicing(ch, 50, 72):
            mus.add(t0 + i * BAR, strings(m, BAR, .55 + .2 * (i - 2), a=.6, r=.4, voices=6, bright=3200))
        mus.add(t0 + i * BAR, strings(root(ch, 2), BAR, .8, a=.3, r=.4, bright=1800))
        for k in range(8):
            mus.add(t0 + i * BAR + k * B / 2, spicc(root(ch, 2) + 12 * (k % 2), .35 + .1 * (i - 2), p=-.2))
    for k in range(16):
        mus.add(t0 + 3 * BAR + k * B / 4, timpani(N('A1'), .12 + .4 * (k / 15) ** 1.5, d=1.0))
    mus.add(t0 + 4 * BAR - B, riser(B, 1.0))
    # 八拍 3, the title: the film's first tutti. The braam carries the low end, so nothing else hits the downbeat
    tt = t0 + 4 * BAR
    mus.add(tt, braam(N('D4'), 3.6, 1.0))
    for i, ch in ((4, 'Dm'), (5, 'Bb')):
        tb = t0 + i * BAR
        for m in voicing(ch, 50, 72):
            mus.add(tb, strings(m, BAR, .75, a=.08, r=.8, voices=6, bright=4200))
            mus.add(tb, choir(m, BAR, .45, 'a', voices=6, a=.2))
        for m in voicing(ch, 53, 67):
            mus.add(tb, brass(m, BAR, .55, a=.1, r=.8, voices=2, dark=450, bright=1600))
        for b_, inst, g in drum_pattern('epic', False):
            if i == 4 and b_ == 0:
                continue
            play_drum(mus, tb + b_ * B, inst, g * (.9 if i == 4 else .6), ch)
    for b_, L, nm in THEME['A'][:5]:
        mus.add(tt + b_ * B, lead_note('brass', N(nm) - 12, L * B - .04, .95))


def end_music(mus, t0):
    # the film resolves to D major: Bb-C-D, the same VI-VII-I lift as the climax, now at home
    for m in voicing('D', 50, 74):
        mus.add(t0, strings(m, 2 * BAR - .5, .7, a=.4, r=2.5, voices=6, bright=3000))
        mus.add(t0, choir(m, 2 * BAR - .5, .45, 'o', voices=6, a=.5, r=2.5))
    mus.add(t0, strings(N('D2'), 2 * BAR - .5, .9, a=.4, r=2.5, bright=1400))
    mus.add(t0, flute(N('A4'), 2 * BAR - .8, .5, r=1.5))
    mus.add(t0, timpani(N('D2'), .45))


def section_sfx(t0, sid, key_hz):
    """events (layer, time, signal); layers: bed = ambience, rhythm = repeating actions, hero = at most one per bar"""
    b = lambda k: t0 + k * B
    D = 4 * BAR + .8
    ev = []
    add = lambda layer, at, sig: ev.append((layer, at, sig))
    if sid == 'canoe':
        add('bed', t0, X.water(D, .55))
        for k in range(0, 16, 2):
            add('rhythm', b(k), X.paddle(.5, p=-.3 if k % 4 == 0 else .3))
    elif sid == 'nile':
        add('bed', t0, X.water(D, .4)); add('bed', t0, X.wind(D, .45))
        add('hero', b(8), X.sail_fill(.8))
    elif sid == 'trireme':
        add('bed', t0, X.water(D, .35))
        for k in range(0, 16, 2):
            add('rhythm', b(k), X.oar_stroke(.6, p=-.1 + .2 * (k % 4 == 0)))
    elif sid == 'longship':
        add('bed', t0, X.ocean(D, .6)); add('bed', t0, X.wind(D, .5, 100, 520))
        add('hero', b(3), X.creak(.9, p=-.4)); add('hero', b(11), X.creak(.8, p=.4, f=48))
    elif sid == 'fuchuan':
        add('bed', t0, X.water(D, .4))
        add('hero', b(4), X.gurgle(3.6, .8)); add('hero', b(13), X.creak(.7, p=.3))
    elif sid == 'caravel':
        add('bed', t0, X.ocean(D, .5)); add('bed', t0, X.wind(D, .45))
        add('hero', b(4), X.sail_fill(.6)); add('hero', b(8), X.creak(.6)); add('hero', b(12), X.sail_fill(.6))
    elif sid == 'lineship':
        add('bed', t0, X.ocean(D, .4))
        for i, k in enumerate((8, 9, 10, 11)):                 # four ships, one broadside per beat
            add('hero' if i == 0 else 'rhythm', b(k), X.cannon(.75, p=-.6 + .4 * i))
    elif sid == 'steam':
        add('bed', t0, X.churn(D, .6))
        for k in range(16):
            add('rhythm', b(k), X.wheel_splash(.25, p=-.3))     # a paddle float per beat; the wheel turns once per 八拍
        for k in (0, 4, 8, 12):
            add('hero', b(k), X.heave(.7))
    elif sid == 'ironclad':
        add('bed', t0, X.water(D, .3)); add('bed', b(2), X.rumble(6.0, .6, key_hz))
        add('hero', b(8), X.cannon(.5, p=-.5)); add('hero', b(10), X.thunk(.8, p=.2)); add('rhythm', b(12.5), X.thunk(.55, p=-.1))
    elif sid == 'dreadnought':
        add('bed', t0, X.ocean(D, .4)); add('bed', t0, X.rumble(D, .45, key_hz))
        add('bed', b(6), X.rumble(3.0, .5, key_hz * 2))          # turrets train, eased, before the salvo
        for j, off in enumerate((0, .05, .11)):
            add('hero' if j == 0 else 'rhythm', b(12) + off, X.cannon(.6, p=-.3 + .3 * j))
    elif sid == 'carrier':
        add('bed', t0, X.ocean(D, .4))
        for k in (4, 8, 12):                                     # one deck-run take-off per bar, propeller aircraft
            add('hero', b(k), X.prop_plane(.8))
    elif sid == 'nuclear':
        add('bed', t0, X.ocean(D, .5)); add('bed', t0, X.hum(D, .45, key_hz))
        add('rhythm', b(6), X.jet(.3, 4.0, .6, -.6))
    elif sid == 'outro':
        add('bed', t0, X.water(D, .45))
        for k in (0, 2, 4, 6):
            add('rhythm', b(k), X.paddle(.35 - .05 * k / 2, p=.2))
    elif sid == 'end':
        add('bed', t0, X.water(2 * BAR + TAIL, .3))
    return ev


# ---------------------------------------------------------------- loudness tools
def kweight(x):
    m = x.mean(0) if x.ndim == 2 else x
    m = hp(m, 100)
    return m + .6 * hp(m, 1500)


def lev(k, a, b):
    seg = k[max(int(a * SR), 0):int(b * SR)]
    return 10 * np.log10((seg ** 2).mean() + 1e-12)


def momentary(k):
    return 10 * np.log10(uniform_filter1d(k ** 2, int(.4 * SR)) + 1e-12)


def seg_gain(n, segs, gains, ramp=.06):
    """per-segment gain; each ramp finishes exactly on the segment's first downbeat"""
    g = np.ones(n)
    for i, (a, b) in enumerate(segs):
        g[int(a * SR):] = 10 ** (gains[i] / 20)
        if i:
            i0, i1 = int((a - ramp) * SR), int(a * SR)
            g[i0:i1] = np.linspace(10 ** (gains[i - 1] / 20), 10 ** (gains[i] / 20), i1 - i0)
    return g


def tp_limit(x, ceil, hold=.005):
    """true-peak limiter: 4x oversampled peak envelope, look-ahead minimum, then smoothing; never overshoots"""
    up = resample_poly(x, 4, 1, axis=1)
    pk = np.abs(up).max(0)
    pk = pk[:len(pk) // 4 * 4].reshape(-1, 4).max(1)
    pk = np.pad(pk, (0, max(0, x.shape[1] - len(pk))))[:x.shape[1]]
    g = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    L = int(hold * SR)
    g = uniform_filter1d(minimum_filter1d(g, 2 * L + 1), L)
    return x * g


def ffmpeg_loudness(path):
    j = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    j = json.loads(j[j.rindex('{'):j.rindex('}') + 1])
    return float(j['input_i']), float(j['input_tp']), float(j['input_lra'])


def write(path, x, bits=32):
    if bits == 24:
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s24le', path],
                       input=np.ascontiguousarray(x.T).astype(np.float32).tobytes(), check=True)
    else:
        wavfile.write(path, SR, np.ascontiguousarray(x.T).astype(np.float32))


def build():
    total = sum(n for _, n, _, _ in SECTIONS) * BAR
    n = int((total + TAIL) * SR)
    mus = Bus(total + TAIL)
    layers = {k: Bus(total + TAIL) for k in ('bed', 'rhythm', 'hero')}
    hero_times, cues, t = [], [], 0.0
    for i, (sid, nb, chords, cfg) in enumerate(SECTIONS):
        nxt_chord = expand(SECTIONS[i + 1][2])[0][2] if i + 1 < len(SECTIONS) else None
        if sid == 'hook':
            hook_music(mus, t)
            gesture(mus, t + nb * BAR, 'hinge', nxt_chord, .4)
        elif sid == 'end':
            end_music(mus, t)
        else:
            section_music(mus, t, sid, chords, cfg, nxt_chord)
        key_hz = 41.20 if sid == 'nuclear' else 36.71                 # machinery tuned to the key: E or D
        for layer, at, sig in section_sfx(t, sid, key_hz):
            layers[layer].add(at, sig)
            if layer == 'hero':
                hero_times.append(at)
        cues.append({'id': sid, 'start': round(t, 4), 'end': round(t + nb * BAR, 4), 'bars': nb})
        t += nb * BAR
    # music: loudness arc on the dry bus, then the hall
    segs, names = [], []
    for c in cues:
        if c['id'] == 'hook':
            segs += [(c['start'], c['start'] + 4 * BAR), (c['start'] + 4 * BAR, c['end'])]; names += ['hook', 'title']
        else:
            segs.append((c['start'], c['end'] + (TAIL if c['id'] == 'end' else 0))); names.append(c['id'])
    dry = mus.buf[:, :n]
    k = kweight(dry)
    gains = [float(np.clip(ARC[nm] - lev(k, a, b), -9, 9)) for nm, (a, b) in zip(names, segs)]
    music = hall(dry * seg_gain(n, segs, gains), 2.8, .3)
    # effects: each layer set per shot relative to the music, then a light hall
    km = kweight(music)
    mm = momentary(km)
    fx_out = np.zeros((2, n))
    report = {'arc_gain_dB': dict(zip(names, np.round(gains, 1).tolist())), 'fx_gain_dB': {}}
    fsegs = [(c['start'], c['end'] + (TAIL if c['id'] == 'end' else 0)) for c in cues]
    for layer, under in (('bed', BED_UNDER), ('rhythm', RHYTHM_UNDER), ('hero', HERO_UNDER)):
        x = layers[layer].buf[:, :n]
        kx = kweight(x)
        mx = momentary(kx)
        lg = []
        for (a, b) in fsegs:
            i0, i1 = int(a * SR), int(b * SR)
            if np.sqrt((kx[i0:i1] ** 2).mean()) < 1e-7:
                lg.append(0.0); continue
            if layer == 'hero':                 # loudest 400 ms of the hits against the music at that moment
                j = i0 + int(np.argmax(mx[i0:i1]))
                lg.append(float(np.clip(mm[j] - under - mx[j], -24, 12)))
            else:
                lg.append(float(np.clip(lev(km, a, b) - under - lev(kx, a, b), -24, 12)))
        fx_out += x * seg_gain(n, fsegs, lg)
        report['fx_gain_dB'][layer] = [round(v, 1) for v in lg]
    effects = hall(fx_out, 1.4, .12, damp=4000)
    # the music dips 2.5 dB under each hero hit (10 ms in, 100 ms hold, 150 ms out)
    duck = np.zeros(n)
    tt = np.arange(int(.3 * SR)) / SR
    shape = np.where(tt < .01, tt / .01, np.where(tt < .11, 1.0, np.clip(1 - (tt - .11) / .15, 0, 1)))
    for h in hero_times:
        i = int(h * SR)
        L = min(len(shape), n - i)
        duck[i:i + L] = np.maximum(duck[i:i + L], shape[:L])
    music = music * 10 ** (-2.5 * duck / 20)
    return music, effects, cues, total, report


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'out'
    os.makedirs(out, exist_ok=True)
    music, effects, cues, total, report = build()
    raw = music + effects
    raw = raw + .5 * hp(raw, 6500)                         # soft air shelf; every source is smooth up there
    raw = raw / (np.abs(raw).max() + 1e-9) * .5
    tmp = os.path.join(out, 'mix_raw.wav')
    write(tmp, raw)
    for _ in range(3):                                      # plain gain to -14 LUFS, peaks held under -1.3 dBTP
        I, TP, LRA = ffmpeg_loudness(tmp)
        g = 10 ** ((-14.0 - I) / 20)
        raw = tp_limit(raw, 10 ** (-1.3 / 20) / g) * g
        write(tmp, raw)
    I, TP, LRA = ffmpeg_loudness(tmp)
    write(os.path.join(out, 'mix.wav'), raw, 24)
    write(os.path.join(out, 'music.wav'), music / (np.abs(music).max() + 1e-9) * .7)
    write(os.path.join(out, 'effects.wav'), effects / (np.abs(effects).max() + 1e-9) * .7)
    json.dump({'bpm': BPM, 'beat': B, 'bar': BAR, 'total': total, 'tail': TAIL, 'sections': cues},
              open(os.path.join(out, 'cues.json'), 'w'), indent=1)
    report.update({'integrated_LUFS': I, 'true_peak_dBTP': TP, 'LRA': LRA,
                   'harshness': {'music': harshness(music), 'effects': harshness(effects), 'mix': harshness(raw)}})
    json.dump(report, open(os.path.join(out, 'report.json'), 'w'), indent=1, default=float)
    print(json.dumps(report, default=float))
