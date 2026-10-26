"""The full score, synthesised from the timeline. Every chapter gets its own instruments and mode; the 我-在-这-里 motif
(scale degrees 5-3-2-1) returns in each era's timbre; scene cues trigger synthesised effects; the outro writes
"我在这里" into the spectrum and re-exports the spectrogram the outro scene displays.

usage: python3 audio/score.py <timeline.json> <out_dir>
timeline.json = output of `node render/render.js info` ({total, scenes:[{id,start,end,trans,cues}]})"""
import sys, os, json, base64, wave
import numpy as np
from dsp import *
from scipy.signal import stft

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, 'fonts/NotoSerifSC-900.ttf')
BPM = 96
B = 60 / BPM
BAR = 4 * B
RHY = [B, B / 2, B / 2, 2 * B]          # motif rhythm
R = np.random.default_rng(7)

MODES = {  # semitone offsets from D
    'minpent': [0, 3, 5, 7, 10], 'majpent': [0, 2, 4, 7, 9], 'phrydom': [0, 1, 4, 5, 7, 8, 10],
    'dorian': [0, 2, 3, 5, 7, 9, 10], 'major': [0, 2, 4, 5, 7, 9, 11], 'minor': [0, 2, 3, 5, 7, 8, 10],
    'lydian': [0, 2, 4, 6, 7, 9, 11],
}
D2 = 38  # midi of D2


def m(midi):
    return note(midi)


def deg(mode, i, octave=4):
    """scale degree i (0-based, may exceed) in mode, rooted on D of the given octave"""
    sc = MODES[mode]
    o, k = divmod(i, len(sc))
    return 12 * (octave + 1) + 2 + sc[k] + 12 * o


def motif_notes(third, second, octave=4):
    """5-3-2-1 with an era-specific third and second (semitones above D)"""
    base = 12 * (octave + 1) + 2
    return [base + 7, base + third, base + second, base]


class Score:
    def __init__(self, total):
        self.mus = Track(total + 2)
        self.sfx = Track(total + 2)

    def play(self, at, sig, g=1.0):
        self.mus.add(at, sig, g)

    def fx(self, at, sig, g=1.0):
        self.sfx.add(at, sig, g)

    def motif(self, at, inst, notes, g=1.0, stretch=1.8, **kw):
        t = at
        for n, d in zip(notes, RHY):
            self.play(t, inst(m(n), d * stretch, **kw), g)
            t += d


# ------------------------------------------------------------------ effects for scene cues
def fx_rope(v=1.0, d=.7):
    t = T(d)
    am = .5 + .5 * np.sin(2 * np.pi * (18 + 10 * t) * t)
    return v * .3 * bp(noise(d), 300, 2500) * am * np.sin(np.pi * t / d) ** .7


def fx_paper(v=1.0, d=.5):
    t = T(d)
    y = bp(noise(d), 2500, 9000) * np.sin(np.pi * t / d) * .25
    for p in R.integers(0, len(t) - 400, 9):
        y[p:p + 300] += R.standard_normal(300) * np.exp(-np.arange(300) / 60) * .4
    return v * hp(y, 1500)


def fx_type(v=1.0):
    t = T(.12)
    return v * (.35 * np.sin(2 * np.pi * 3200 * t) * np.exp(-t * 90) + .3 * bp(noise(.12), 1500, 6000) * np.exp(-t * 120))


def fx_splash(v=1.0):
    t = T(.6)
    return v * .4 * lp(noise(.6), 2500) * np.exp(-t * 7) * np.clip(t / .01, 0, 1)


def mixs(*sigs):
    """sum signals of different lengths"""
    out = np.zeros(max(len(x) for x in sigs))
    for x in sigs:
        out[:len(x)] += x
    return out


def fx_beep(v=1.0, f=880):
    return pulse(f, .16, v * 2.2, duty=.5, vol_steps=False)


SFX = {
    'knot': lambda v: fx_rope(v, .35), 'rope': lambda v: fx_rope(v, .9), 'clay': thup, 'stylus': lambda v: scratch(v, .35),
    'fire': lambda v: fire(1.6, v), 'crack': crack, 'brush': lambda v: brush(v, .45), 'reed': lambda v: scratch(v * .8, .25),
    'harp': lambda v: harp(m(81), 1.5, v), 'bamboo': lambda v: woodblock(v, 1150), 'cord': lambda v: fx_rope(v * .8, .3),
    'ink': lambda v: drip(v * .6), 'drip': drip, 'water': fx_splash, 'paper': fx_paper, 'carve': lambda v: mixs(scratch(v, .3), woodblock(v * .3, 500)),
    'wood': lambda v: woodblock(v, 600), 'type': fx_type, 'press': press, 'punch': punch, 'bell': lambda v: ding(v, 1760),
    'tape': lambda v: whir(1.4, v), 'relay': relay, 'beep': fx_beep, 'seek': lambda v: seek(v, 10, 60), 'key': lambda v: tick(v * 1.2),
    'click': lambda v: relay(v * .7), 'spin': lambda v: spinup(1.6, v), 'disk': lambda v: spinup(2.0, v * .7, 90, 120),
    'fan': lambda v: hum(2.5, v * 2), 'blip': lambda v: glass(m(93), .5, v * .8), 'shutter': shutter,
    'chime': lambda v: glass(m(int(R.choice([86, 88, 90, 93, 95]))), 1.8, v), 'stamp': lambda v: mixs(thup(v), fx_paper(v * .4, .2)),
    'tick': tick, 'whoosh': lambda v: swell(.9, m(62), v * .8), 'impact': impact, 'heartbeat': heartbeat,
}


# ------------------------------------------------------------------ era music
def beats(t0, dur, step=B):
    n = int(dur / step + 1e-6)
    return [t0 + i * step for i in range(n)]


def music_hook(s, t0, dur):
    s.play(t0, lp(noise(dur), 700) * .01)
    s.play(t0 + 7.0, pad(m(50), 5.0, .9, bright=.45) + pad(m(57), 5.0, .7, bright=.45))
    s.motif(t0 + 7.2, piano, motif_notes(4, 2), .9, 2.2)
    for k, n in enumerate([62, 66, 69, 74]):
        s.play(t0 + 4.4 + k * .5, piano(m(n), 1.6, .35))


def music_knot(s, t0, dur):
    s.play(t0, drone(m(38), dur, .55))
    for i, t in enumerate(beats(t0 + .6, dur - .6)):
        if i % 4 in (0, 2):
            s.play(t, frame_drum(.42 if i % 4 == 0 else .22, 70))
    for i, t in enumerate(beats(t0 + 2 * BAR, dur - 2 * BAR - BAR, B / 2)):   # charango-like strum
        if i % 4 in (0, 1, 3):
            for k, n in enumerate([deg('minpent', 0, 4), deg('minpent', 2, 4), deg('minpent', 3, 4)]):
                s.play(t + k * .012, lyre(m(n), .5, .12))
    s.motif(t0 + .8, flute, motif_notes(3, 2, 5), .75, 2.0, hollow=True, breath=.3)
    s.motif(t0 + BAR * 4, flute, motif_notes(3, 2, 5), .6, 2.0, hollow=True, breath=.3)


def music_clay(s, t0, dur):
    s.play(t0, drone(m(38), dur, .5))
    reed = lambda f, d, v=1.0: lp(choir(f, d, v, 'a'), 2200) * 1.2
    s.play(t0 + .5, reed(m(50), dur - 1, .35))
    for i, t in enumerate(beats(t0, dur)):
        s.play(t, frame_drum(.38 if i % 2 == 0 else .18, 85 if i % 4 == 0 else 120))
    s.motif(t0 + .8, lyre, motif_notes(3, 1, 4), 1.1)
    for i, t in enumerate(beats(t0 + BAR * 2, BAR * 3, B / 2)):
        s.play(t, lyre(m(deg('phrydom', [0, 2, 4, 2, 1, 2, 0, -1][i % 8], 4)), .6, .35))


def music_papyrus(s, t0, dur):
    for i, t in enumerate(beats(t0, dur)):
        s.play(t, frame_drum(.5 if i % 4 == 0 else .25, 95 if i % 4 == 0 else 140))
        s.play(t + B / 2, bp(noise(.18), 5000, 12000) * np.exp(-T(.18) * 18) * .2)
    for k in range(int(dur / BAR)):
        for i, n in enumerate([50, 57, 62, 66, 69, 70, 69, 66]):
            s.play(t0 + k * BAR + i * B / 2, harp(m(n), 1.8, .32))
    s.motif(t0 + .8, harp, motif_notes(4, 1, 5), 1.2)
    s.motif(t0 + BAR * 3, flute, motif_notes(4, 1, 5), .35, breath=.25)


def music_oracle(s, t0, dur):
    s.play(t0, drone(m(38), dur, .45))
    s.motif(t0 + .8, bell, motif_notes(4, 2, 4), 1.3, 2.4)
    s.play(t0 + BAR * 2, flute(m(57), 3.0, .5, hollow=True, breath=.35))
    s.play(t0 + BAR * 3.2, flute(m(54), 2.5, .45, hollow=True, breath=.35))
    for k in range(1, int(dur / BAR)):
        s.play(t0 + k * BAR, bell(m(38 + 12), 3.0, .45))


def music_bamboo(s, t0, dur):
    s.motif(t0 + .8, guqin, motif_notes(4, 2, 4), 1.2, 2.4)
    for k in range(1, int(dur / BAR)):
        n = deg('majpent', [4, 2, 3, 1, 0][k % 5], 3)
        s.play(t0 + k * BAR, guqin(m(n), 2.6, .7, slide=(m(n) * 1.0595, .4)))
        s.play(t0 + k * BAR + B * 2, guqin(m(n + 7), 1.8, .4))
    for t in beats(t0 + BAR, dur - BAR, B * 2):
        s.play(t, woodblock(.18, 1100))
    s.play(t0 + BAR * 2, flute(m(66), 3.5, .35, breath=.3))


def music_paper(s, t0, dur):
    for k in range(int(dur / BAR)):
        base = t0 + k * BAR
        for i, n in enumerate([62, 64, 66, 69, 71, 74, 76, 78]):       # guzheng glissando at bar starts
            s.play(base + i * .035, zheng(m(n), 1.4, .18))
        s.play(base + B * 2, zheng(m(deg('majpent', [4, 3, 1, 2][k % 4], 4)), 2.0, .5))
    s.motif(t0 + .8, zheng, motif_notes(4, 2, 5), 1.0)
    s.play(t0, lp(pad(m(50), dur, .7, bright=.4), 1800))


def music_print(s, t0, dur, segs):
    a = t0 + segs[2][0] - .6     # Song section
    b = t0 + segs[4][0] - .6     # Mainz section
    # Tang: pipa
    s.motif(t0 + .8, pipa, motif_notes(4, 2, 4), 1.2)
    for t in beats(t0 + BAR, a - t0 - BAR, B):
        s.play(t, pipa(m(deg('majpent', int(R.integers(0, 5)), 4)), .8, .35))
    s.play(a - .2, pipa(m(62), 1.2, .6, trem=16))
    # Song: xiao + guqin
    s.play(a, flute(m(57), 2.2, .5, breath=.3)); s.play(a + 2.4, flute(m(54), 2.0, .45, breath=.3))
    s.play(a, guqin(m(50), 3.0, .6)); s.play(a + BAR, guqin(m(45), 3.0, .5))
    # Mainz: organ + lute
    for k, ch in enumerate([[50, 57, 62, 66], [55, 59, 62, 67], [57, 61, 64, 69], [50, 57, 62, 66]]):
        for n in ch:
            s.play(b + k * BAR, organ(m(n), BAR * .98, .32))
    s.motif(b + .3, lute, motif_notes(4, 2, 4), 1.1)


def music_punch(s, t0, dur, segs):
    fire_at = t0 + segs[4][0]
    for k, t in enumerate(beats(t0, fire_at - t0 - .3, B / 2)):     # music-box arpeggio + clockwork tick
        n = [62, 66, 69, 74, 69, 66][k % 6] + 12
        s.play(t, glass(m(n), .9, .25))
        s.play(t, tick(.12))
    s.motif(t0 + .8, glass, motif_notes(4, 2, 5), .9, 2.0)
    s.play(fire_at, lp(pad(m(41), t0 + dur - fire_at, .8, bright=.4), 900))
    s.play(fire_at, drone(m(38), t0 + dur - fire_at, .4))


def music_tape(s, t0, dur):
    vib = lambda f, d, v=1.0: glass(f, d, v * .7) + .5 * modal(f, d, [1, .1], 2.0) * v
    for k, t in enumerate(beats(t0 + .6, dur - .6, B / 2)):
        n = [62, 69, 66, 69, 64, 69, 66, 71][k % 8]
        s.play(t, vib(m(n), .5, .22))
        if k % 2 == 0:
            s.play(t, np.sin(2 * np.pi * m(38) * T(.4)) * np.exp(-T(.4) * 6) * .25)
    s.motif(t0 + .8, vib, motif_notes(4, 2, 5), .9)


def music_floppy(s, t0, dur):
    arp = [62, 65, 69, 74]
    for i, t in enumerate(beats(t0, dur, B / 4)):
        s.play(t, pulse(m(arp[i % 4] + 12), B / 4, .32, duty=.125))
    for i, t in enumerate(beats(t0, dur)):
        s.play(t, tri(m(38 if (i // 4) % 2 == 0 else 34), B * .9, .8))
        if i % 2 == 0:
            s.play(t, kick(.4))
        else:
            s.play(t, hp(noise(.08), 4000) * np.exp(-T(.08) * 50) * .2)
    s.motif(t0 + BAR, pulse, motif_notes(3, 2, 5), .9, 1.0, duty=.5)


def music_disk(s, t0, dur):
    stabs = [[50, 54, 57, 61], [55, 59, 62, 66], [57, 61, 64, 67]]
    for k in range(int(dur / BAR)):
        for n in stabs[k % 3]:
            s.play(t0 + k * BAR + B * 1.5, brass(m(n), .35, .45))
        for i in range(4):        # walking bass
            s.play(t0 + k * BAR + i * B, modal(m([38, 42, 45, 47][i]), .5, [1, .4, .15], 6) * .5)
    s.motif(t0 + .8, brass, motif_notes(4, 2, 4), .8, 1.4)
    s.play(t0 + dur * .55, pad(m(50), dur * .45, .8, bright=.5))


def music_cloud(s, t0, dur, segs):
    dark = t0 + segs[4][0]
    for k, t in enumerate(beats(t0 + .6, dark - t0 - .6, B / 2)):
        s.play(t, glass(m([74, 81, 78, 86][k % 4]), .4, .18))
        if k % 2 == 0:
            s.play(t, kick(.3))
    s.play(t0, pad(m(50), dark - t0, .9, bright=.55) + pad(m(57), dark - t0, .6, bright=.55))
    s.motif(t0 + .8, glass, motif_notes(4, 2, 5), .9, 2.0)
    s.play(dark, lp(pad(m(38), t0 + dur - dark, .9, bright=.3), 500))     # the dark age: everything drops away


def music_outro(s, t0, dur):
    s.play(t0 + .6, pad(m(50), 14, .8, bright=.45) + pad(m(57), 14, .6, bright=.45))
    s.motif(t0 + 1.2, piano, motif_notes(4, 2, 4), .8, 2.2)
    s.motif(t0 + 15.0, piano, motif_notes(4, 2, 4), .9, 2.6)
    s.play(t0 + 15.0, pad(m(45), 9, .7, bright=.4))
    for k in range(4):
        s.play(t0 + 15 + k * 1.25, heartbeat(.35))
    # spectrogram section: only low content so the text stays clean
    s.play(t0 + 24.6, lp(pad(m(38), 6.6, .9, bright=.35), 1500))
    s.motif(t0 + 31.2, piano, motif_notes(4, 2, 4), .9, 2.8)
    s.play(t0 + 31.2, pad(m(50), 6, .7, bright=.4))


ERA = {'hook': music_hook, 'knot': music_knot, 'clay': music_clay, 'papyrus': music_papyrus, 'oracle': music_oracle,
       'bamboo': music_bamboo, 'paper': music_paper, 'tape': music_tape, 'floppy': music_floppy, 'disk': music_disk,
       'outro': music_outro}


def load_segs():
    js = open(os.path.join(ROOT, 'engine/data/script.js')).read()
    data = json.loads(js[js.index('{'):js.rindex('};') + 1])
    return {c['id']: c['segs'] for c in data['chapters']}


def build(tl):
    total = tl['total']
    s = Score(total)
    segs = load_segs()
    for sc in tl['scenes']:
        t0, dur, sid = sc['start'], sc['end'] - sc['start'], sc['id']
        if sid in ('print', 'punch', 'cloud'):
            {'print': music_print, 'punch': music_punch, 'cloud': music_cloud}[sid](s, t0, dur, segs[sid])
        elif sid in ERA:
            ERA[sid](s, t0, dur)
        if sc.get('trans'):
            s.play(t0 - .9, swell(1.0, m(62), .9))           # tuned swell into every chapter
        for c in sc.get('cues', []):
            f = SFX.get(c.get('sfx'))
            if f:
                s.fx(t0 + c['t'], f(c.get('v', .8)))
    return s


def spectro_section(s, tl):
    """write the hidden text and return (start, end) of the analysis window in global time"""
    out = [x for x in tl['scenes'] if x['id'] == 'outro']
    if not out:
        return None
    t0 = out[0]['start'] + 24.8
    st, _ = spectro_text('我在这里', 4.5, font=FONT, level=.07)
    return (t0, t0 + 6.0), st


def level(x, tl, target=-23.0, maxboost=4.0, maxcut=4.0):
    """gentle per-scene levelling of the music stem with 0.6 s gain ramps"""
    g = np.ones(len(x))
    pts = []
    for sc in tl['scenes']:
        a, b = int(sc['start'] * SR), int(sc['end'] * SR)
        seg = x[a:b]
        if not len(seg):
            continue
        r = 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9)
        db = np.clip(target - r, -maxcut, maxboost)
        pts.append(((a + b) / 2, 10 ** (db / 20), a, b))
    for (c, gg, a, b) in pts:
        g[a:b] = gg
    ramp = int(.6 * SR)
    c = np.concatenate([[0.], np.cumsum(g)])           # moving average via cumulative sum (O(n))
    i = np.arange(len(g))
    lo, hi = np.clip(i - ramp // 2, 0, len(g)), np.clip(i + ramp // 2, 0, len(g))
    g = (c[hi] - c[lo]) / np.maximum(hi - lo, 1)
    return x * g


def write_wav(path, x):
    y = np.stack([x, np.roll(x, 24) * .98], axis=1)
    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


def export_spectro(mix, win):
    a, b = win
    x = mix[int(a * SR):int(b * SR)]
    f, t, Z = stft(x, fs=SR, nperseg=2048, noverlap=2048 - 512)
    mag = 20 * np.log10(np.abs(Z) + 1e-9)
    mag = mag[f <= 12000]
    mag = np.clip((mag - mag.max() + 80) / 80, 0, 1)
    ti = np.linspace(0, mag.shape[1] - 1, 640).astype(int)
    fi = np.linspace(0, mag.shape[0] - 1, 256).astype(int)
    img = (mag[fi][:, ti] * 255).astype(np.uint8)
    js = '// Spectrogram of the final mix, outro 24.8–30.8 s (time x frequency, 0–12 kHz, rows low→high). Generated by audio/score.py.\n'
    js += 'window.SPECTRO=' + json.dumps({'w': 640, 'h': 256, 'fmax': 12000, 'dur': b - a, 'text_t': [.6, 5.1], 'text_f': [4000, 10000],
                                          'b64': base64.b64encode(img.tobytes()).decode()}) + ';\n'
    open(os.path.join(ROOT, 'engine/data/spectro.js'), 'w').write(js)


if __name__ == '__main__':
    tl = json.load(open(sys.argv[1]))
    od = sys.argv[2]
    os.makedirs(od, exist_ok=True)
    s = build(tl)
    sec = spectro_section(s, tl)
    win = sec[0] if sec else None
    mus = reverb(s.mus.buf, 2.2, .22)
    sfx = reverb(s.sfx.buf, 1.2, .12)
    n = int(tl['total'] * SR)
    mus, sfx = mus[:n], sfx[:n]
    mus = level(mus, tl)
    sfx = lp(sfx, 13000, 2)   # soften click edges; AAC rings on full-band impulses
    if win:  # keep the music below 3 kHz while the hidden text plays
        a, b = int((win[0] - .2) * SR), int((win[1] + .2) * SR)
        mus[a:b] = lp(mus[a:b], 2500, 4)
    if win:  # the hidden text is added dry, after the reverbs, so its letters stay sharp in the spectrogram
        a, b = int((win[0] - .3) * SR), int((win[1] + .3) * SR)
        sfx[a:b] = lp(sfx[a:b], 2500, 4)          # keep effects below the text band too
        i0 = int((win[0] + .6) * SR)
        sfx[i0:i0 + len(sec[1])] += sec[1][:len(sfx) - i0]
    mix = mus * .8 + sfx
    write_wav(os.path.join(od, 'mix_raw.wav'), np.tanh(mix / .95) * .95)
    write_wav(os.path.join(od, 'sfx_raw.wav'), np.tanh(sfx / .95) * .95)
    if win:
        export_spectro(mix, win)
    print('ok', tl['total'], 's')
