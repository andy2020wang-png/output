"""Sound by code: instruments, effects and mixing primitives. Everything is numpy maths, no samples."""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
rng = np.random.default_rng(20261026)


def T(d):
    return np.arange(int(d * SR)) / SR


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, 'low', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x)


def noise(d):
    return rng.standard_normal(int(d * SR))


def adsr(n, a=.01, d=.1, s=.7, r=.2):
    t = np.arange(n) / SR
    dur = n / SR
    e = np.where(t < a, t / max(a, 1e-4), np.where(t < a + d, 1 - (1 - s) * (t - a) / max(d, 1e-4), s))
    rel = np.clip((dur - t) / max(r, 1e-4), 0, 1)
    return e * rel


def note(name_or_midi):
    if isinstance(name_or_midi, (int, float)):
        return 440 * 2 ** ((name_or_midi - 69) / 12)
    names = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
    s = name_or_midi
    k = names[s[0]]
    i = 1
    if len(s) > 2 or (len(s) == 2 and s[1] in '#b'):
        if s[1] == '#':
            k += 1; i = 2
        elif s[1] == 'b':
            k -= 1; i = 2
    octv = int(s[i:])
    return 440 * 2 ** ((k + 12 * (octv + 1) - 69) / 12)


# ---------------------------------------------------------------- instruments
def modal(f, d, partials, decay, bright=1.0, inharm=0.0, glide=None, phase_jit=True):
    """Struck/plucked string or bar as a sum of decaying partials.
    partials: list of relative amplitudes; decay: base decay rate (1/s), higher partials decay faster."""
    t = T(d)
    if glide is not None:  # glide: (f_end, time)
        f_t = f + (glide[0] - f) * np.clip(t / glide[1], 0, 1) ** .6
        ph = 2 * np.pi * np.cumsum(f_t) / SR
    else:
        ph = 2 * np.pi * f * t
    y = np.zeros_like(t)
    for k, a in enumerate(partials, start=1):
        ratio = k * np.sqrt(1 + inharm * k * k)
        if f * ratio > SR / 2.2:
            break
        p0 = rng.uniform(0, 2 * np.pi) if phase_jit else 0
        y += a * bright ** (k - 1) * np.sin(ph * ratio + p0) * np.exp(-t * decay * (1 + .35 * (k - 1) ** 1.3))
    att = np.clip(t / .003, 0, 1)
    return y * att


def harp(f, d=2.2, v=1.0):
    return v * .35 * modal(f, d, [1, .55, .32, .2, .12, .07, .04], 1.6, bright=.95)


def lyre(f, d=1.6, v=1.0):
    return v * .3 * modal(f, d, [1, .7, .5, .38, .25, .16, .1, .06], 2.6, bright=.97, inharm=.0004)


def guqin(f, d=2.6, v=1.0, slide=None):
    y = modal(f, d, [1, .5, .22, .14, .08, .05], 1.1, bright=.9, glide=slide)
    return v * .38 * y


def zheng(f, d=2.2, v=1.0):
    return v * .3 * modal(f, d, [1, .8, .55, .4, .28, .18, .12, .08], 1.8, bright=.98, inharm=.0002)


def pipa(f, d=1.0, v=1.0, trem=0):
    if not trem:
        return v * .3 * modal(f, d, [1, .9, .6, .45, .3, .2, .12], 3.2, bright=.98)
    out = np.zeros(int(d * SR))
    step = 1 / trem
    for i in range(int(d / step)):
        s = modal(f, d - i * step, [1, .9, .6, .45, .3, .2], 5, bright=.98) * (.6 + .4 * (i % 2))
        out[int(i * step * SR):int(i * step * SR) + len(s)] += s[:len(out) - int(i * step * SR)]
    return v * .2 * out


def oud(f, d=1.6, v=1.0):
    return v * .32 * lp(modal(f, d, [1, .75, .5, .35, .22, .14, .08], 2.2, bright=.95), 3500)


def lute(f, d=1.6, v=1.0):
    return v * .3 * modal(f, d, [1, .6, .4, .25, .16, .1], 2.4, bright=.94)


def piano(f, d=1.6, v=1.0):
    t = T(d)
    y = modal(f, d, [1, .6, .4, .3, .2, .14, .1, .07, .05], 1.3, bright=.96, inharm=.0006)
    y += .15 * bp(noise(d), 1000, 5000) * np.exp(-t * 60)
    return v * .3 * y


def bell(f, d=3.0, v=1.0):
    """bronze bell (编钟-like): inharmonic partials, strike transient"""
    t = T(d)
    ratios = [.5, 1, 1.19, 1.56, 2.0, 2.51, 2.66, 3.01]
    amps = [.45, 1, .5, .6, .35, .28, .2, .14]
    y = np.zeros_like(t)
    for r_, a in zip(ratios, amps):
        y += a * np.sin(2 * np.pi * f * r_ * t + rng.uniform(0, 6.28)) * np.exp(-t * (.9 + r_ * .9))
    y += .3 * bp(noise(d), 2000, 7000) * np.exp(-t * 80)
    return v * .22 * y


def glass(f, d=2.5, v=1.0):
    t = T(d)
    mod = np.sin(2 * np.pi * f * 3.5 * t) * 2.0 * np.exp(-t * 3)
    return v * .2 * np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 1.4) * np.clip(t / .002, 0, 1)


def flute(f, d=1.0, v=1.0, vib=5.0, breath=.18, hollow=False):
    t = T(d)
    fm = f * (1 + .006 * np.sin(2 * np.pi * vib * t) * np.clip(t / .3, 0, 1))
    ph = 2 * np.pi * np.cumsum(fm) / SR
    y = np.sin(ph) + (0 if hollow else .18 * np.sin(2 * ph) + .06 * np.sin(3 * ph))
    y += breath * bp(noise(d), f * .9, min(f * 4, 12000))
    return v * .3 * y * adsr(len(t), .07, .1, .85, .12)


def organ(f, d=2.0, v=1.0):
    t = T(d)
    y = sum(a * np.sin(2 * np.pi * f * k * t) for k, a in [(1, 1), (2, .5), (3, .3), (4, .25), (6, .12), (8, .1)])
    return v * .14 * y * adsr(len(t), .15, .2, .9, .4)


def choir(f, d=2.5, v=1.0, vowel='a'):
    t = T(d)
    fm = f * (1 + .005 * np.sin(2 * np.pi * 5.2 * t + 1))
    ph = np.cumsum(fm) / SR
    saw = 2 * (ph - np.floor(ph + .5))
    saw += .5 * (2 * ((ph * 1.003) - np.floor(ph * 1.003 + .5)))
    F = {'a': [(800, 1.0), (1150, .5), (2900, .25)], 'o': [(450, 1), (800, .45), (2830, .15)], 'u': [(325, 1), (700, .3), (2530, .1)]}[vowel]
    y = sum(a * bp(saw, fc * .88, fc * 1.12) for fc, a in F)
    return v * .5 * y * adsr(len(t), .35, .3, .9, .6)


def brass(f, d=.8, v=1.0):
    t = T(d)
    env = adsr(len(t), .04, .15, .75, .12)
    bright = np.clip(t / .06, 0, 1) * env
    y = np.zeros_like(t)
    for k in range(1, 16):
        if f * k > 14000:
            break
        y += (1 / k) * np.sin(2 * np.pi * f * k * t) * bright ** (.4 + .25 * k)
    return v * .3 * y * env


def pulse(f, d=.2, v=1.0, duty=.25, vol_steps=True):
    t = T(d)
    ph = (f * t) % 1
    y = np.where(ph < duty, 1.0, -1.0)
    env = adsr(len(t), .002, .05, .6, .03)
    if vol_steps:
        env = np.round(env * 15) / 15
    return v * .12 * y * env


def tri(f, d=.3, v=1.0):
    t = T(d)
    ph = (f * t) % 1
    y = 4 * np.abs(ph - .5) - 1
    y = np.round(y * 8) / 8
    return v * .2 * y * adsr(len(t), .002, .05, .8, .03)


def pad(f, d=4.0, v=1.0, detune=.006, n=4, bright=.6, a=.8, r=1.0):
    t = T(d)
    y = np.zeros_like(t)
    for j in range(n):
        fj = f * (1 + detune * (j - (n - 1) / 2))
        for k in range(1, 12):
            if fj * k > 9000:
                break
            y += (bright ** (k - 1)) / k * np.sin(2 * np.pi * fj * k * t + rng.uniform(0, 6.28))
    return v * .08 * y / n * adsr(len(t), a, .5, .9, r)


def drone(f, d, v=1.0):
    t = T(d)
    y = np.sin(2 * np.pi * f * t) + .5 * np.sin(2 * np.pi * f * 1.5 * t + .3) + .3 * np.sin(2 * np.pi * f * 2 * t)
    y *= 1 + .15 * np.sin(2 * np.pi * .2 * t)
    return v * .12 * y * adsr(len(t), 1.0, .5, 1, 1.0)


# ---------------------------------------------------------------- percussion & effects
def kick(v=1.0):
    t = T(.5)
    return v * .55 * np.sin(2 * np.pi * np.cumsum(42 + 70 * np.exp(-t * 30)) / SR) * np.exp(-t * 7.5)


def frame_drum(v=1.0, f=90):
    t = T(.6)
    body = np.sin(2 * np.pi * np.cumsum(f + 40 * np.exp(-t * 25)) / SR) * np.exp(-t * 8)
    slap = bp(noise(.6), 400, 2500) * np.exp(-t * 45)
    return v * .5 * (body + .35 * slap)


def heartbeat(v=1.0):
    out = np.zeros(int(.7 * SR))
    for off, a in [(0, 1), (.22, .7)]:
        t = T(.3)
        s = np.sin(2 * np.pi * np.cumsum(55 + 25 * np.exp(-t * 20)) / SR) * np.exp(-t * 14) * a
        out[int(off * SR):int(off * SR) + len(s)] += s
    return v * .6 * out


def woodblock(v=1.0, f=900):
    t = T(.25)
    return v * .5 * (np.sin(2 * np.pi * f * t) * np.exp(-t * 35) + .4 * bp(noise(.25), f, f * 3) * np.exp(-t * 90))


def tick(v=1.0):
    t = T(.06)
    return v * .4 * bp(noise(.06), 2500, 9000) * np.exp(-t * 160)


def spray(v=1.0, d=.55):
    t = T(d)
    env = np.clip(t / .04, 0, 1) * np.exp(-t * 3.2)
    return v * .35 * bp(noise(d), 1200, 7000) * env


def drip(v=1.0):
    t = T(.35)
    f = 900 + 1800 * np.clip(t / .03, 0, 1)
    return v * .35 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 28)


def thup(v=1.0):
    t = T(.3)
    return v * .5 * (lp(noise(.3), 600) * np.exp(-t * 30) * .8 + np.sin(2 * np.pi * 110 * t) * np.exp(-t * 25))


def crack(v=1.0):
    t = T(.5)
    y = bp(noise(.5), 1500, 12000, 1) * np.exp(-t * 40)
    for f in (2300, 3400, 5100):
        y += .4 * np.sin(2 * np.pi * f * t) * np.exp(-t * 30)
    return v * .6 * y


def fire(d, v=1.0):
    n = int(d * SR)
    rumble = lp(noise(d), 300) * .5
    cr = np.zeros(n)
    k = int(d * 18)
    for p in rng.integers(0, n - 2000, k):
        L = int(rng.integers(80, 700))
        cr[p:p + L] += rng.uniform(.2, 1) * rng.standard_normal(L) * np.exp(-np.arange(L) / (L / 4))
    cr = hp(cr, 1500)
    env = adsr(n, .6, .3, 1, .8)
    return v * .4 * (rumble + .6 * cr) * env


def waves(d, v=1.0):
    t = T(d)
    x = lp(noise(d), 1200)
    env = .5 + .5 * np.sin(2 * np.pi * t / 3.2 - 1.5) ** 2
    return v * .25 * x * env * adsr(len(t), .8, .2, 1, .8)


def brush(v=1.0, d=.4):
    t = T(d)
    u = t / d
    return v * .25 * bp(noise(d), 2000, 6000) * np.sin(np.pi * u) ** 1.5


def scratch(v=1.0, d=.6):
    t = T(d)
    am = (rng.random(int(d * 60)) > .4).astype(float)
    am = np.repeat(am, int(np.ceil(len(t) / len(am))))[:len(t)]
    return v * .2 * bp(noise(d), 3000, 9000) * lp(am, 40) * np.sin(np.pi * t / d)


def press(v=1.0):
    t = T(1.0)
    creak = np.sin(2 * np.pi * np.cumsum(160 + 40 * np.sin(2 * np.pi * 7 * t)) / SR) * (t < .45) * np.sin(np.pi * np.clip(t / .45, 0, 1))
    creak = bp(creak * (1 + .5 * noise(1.0)), 200, 2000) * .3
    hit = np.zeros_like(t)
    i0 = int(.5 * SR)
    th = T(.5)
    s = (np.sin(2 * np.pi * np.cumsum(70 + 60 * np.exp(-th * 30)) / SR) * np.exp(-th * 9) + .5 * lp(noise(.5), 1500) * np.exp(-th * 25))
    hit[i0:i0 + len(s)] = s[:len(hit) - i0]
    return v * .6 * (creak + hit)


def shutter(v=1.0):
    out = np.zeros(int(.25 * SR))
    for off in (0, .09):
        t = T(.05)
        s = bp(noise(.05), 1500, 8000) * np.exp(-t * 120)
        out[int(off * SR):int(off * SR) + len(s)] += s
    return v * .6 * out


def morse(text, wpm=18, f=700, v=1.0):
    code = {'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.', 'G': '--.', 'H': '....', 'I': '..', 'J': '.---',
            'K': '-.-', 'L': '.-..', 'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.', 'S': '...', 'T': '-',
            'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-', 'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
            '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.'}
    u = 1.2 / wpm
    seq = []
    for w in text.upper().split():
        for ch in w:
            for s in code[ch]:
                seq.append((1 if s == '.' else 3, True)); seq.append((1, False))
            seq.append((2, False))
        seq.append((4, False))
    n = int(sum(a for a, _ in seq) * u * SR) + SR // 10
    out = np.zeros(n)
    pos = 0
    events = []
    for a, on in seq:
        L = int(a * u * SR)
        if on:
            t = np.arange(L) / SR
            env = np.clip(t / .004, 0, 1) * np.clip((L / SR - t) / .004, 0, 1)
            out[pos:pos + L] += np.sin(2 * np.pi * f * t) * env
            events.append((pos / SR, L / SR))
        pos += L
    return v * .25 * out, events


def relay(v=1.0):
    t = T(.04)
    return v * .5 * bp(noise(.04), 800, 6000) * np.exp(-t * 200)


def punch(v=1.0):
    t = T(.2)
    return v * .5 * (lp(noise(.2), 2500) * np.exp(-t * 50) + .6 * np.sin(2 * np.pi * 180 * t) * np.exp(-t * 40))


def ding(v=1.0, f=1760):
    return glass(f, 1.6, v * 1.4)


def projector(d, v=1.0):
    t = T(d)
    clicks = (np.sin(2 * np.pi * 18 * t) > .96).astype(float)
    y = bp(clicks + .02 * noise(d), 500, 4000) * .6 + .15 * np.sin(2 * np.pi * 60 * t)
    return v * .3 * y * adsr(len(t), .2, .1, 1, .3)


def whir(d, v=1.0, f0=60):
    t = T(d)
    return v * (.12 * bp(noise(d), 300, 3000) + .08 * np.sin(2 * np.pi * f0 * t)) * adsr(len(t), .3, .1, 1, .3)


def spinup(d=1.5, v=1.0, f0=40, f1=180):
    t = T(d)
    f = f0 + (f1 - f0) * (1 - np.exp(-t * 2.5))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return v * .12 * (np.sin(ph) + .4 * np.sin(2 * ph) + .25 * np.sin(5 * ph)) * adsr(len(t), .2, .1, 1, .3)


def seek(v=1.0, steps=10, rate=60):
    out = np.zeros(int((steps / rate + .1) * SR))
    for i in range(steps):
        t = T(.012)
        s = np.sign(np.sin(2 * np.pi * 300 * t)) * np.exp(-t * 300)
        p = int(i / rate * SR)
        out[p:p + len(s)] += s
    return v * .25 * lp(out, 4000)


def modem(d=2.4, v=1.0):
    """dial-up handshake caricature: answer tone with phase reversals, V.8 chirps, scrambled bursts"""
    t = T(d)
    y = np.zeros_like(t)
    a = (t < .7)
    ph_rev = np.where(np.floor(t / .45) % 2 == 0, 0, np.pi)
    y += a * np.sin(2 * np.pi * 2100 * t + ph_rev) * .5
    b = (t >= .7) & (t < 1.1)
    y += b * (np.sin(2 * np.pi * 980 * t) + np.sin(2 * np.pi * 1180 * t)) * .3
    c = (t >= 1.1) & (t < 1.5)
    y += c * np.sign(np.sin(2 * np.pi * (1200 + 600 * np.sin(2 * np.pi * 25 * t)) * t)) * .2
    dd = t >= 1.5
    y += dd * bp(noise(d), 600, 3400) * .5
    return v * .35 * y * adsr(len(t), .01, .1, 1, .1)


def hum(d, v=1.0):
    t = T(d)
    return v * (.06 * lp(noise(d), 500) + .03 * np.sin(2 * np.pi * 120 * t) + .02 * np.sin(2 * np.pi * 240 * t)) * adsr(len(t), .4, .1, 1, .4)


def swell(d=1.0, f=440, v=1.0):
    """tuned riser used on transitions instead of noise whooshes"""
    t = T(d)
    u = t / d
    y = sum(np.sin(2 * np.pi * f * k * t) / k for k in (1, 2, 3)) * u ** 2.2
    return v * .12 * y * np.clip((d - t) / .05, 0, 1)


def impact(v=1.0):
    t = T(2.5)
    sub = np.sin(2 * np.pi * (36 + 40 * np.exp(-t * 6)) * t) * np.exp(-t * 1.6)
    body = lp(noise(2.5), 900) * np.exp(-t * 5) * .5
    return v * .7 * (sub * .9 + body * .6)


# ---------------------------------------------------------------- space & mix
def reverb(x, size=2.0, mix=.25, damp=4000):
    n = int(size * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t * 6.9 / size)
    ir = lp(ir, damp)
    ir /= np.sqrt((ir ** 2).sum()) + 1e-9
    wet = fftconvolve(x, ir)[:len(x)]
    return x * (1 - mix) + wet * mix * 1.2


class Track:
    def __init__(self, d):
        self.buf = np.zeros(int(d * SR) + SR)

    def add(self, at, sig, gain=1.0):
        i = int(at * SR)
        if i >= len(self.buf):
            return
        L = min(len(sig), len(self.buf) - i)
        self.buf[i:i + L] += sig[:L] * gain


def spectro_text(text, d, f_lo=4000, f_hi=10000, font=None, level=.05):
    """Write text into the spectrogram: each image column is a time slice, each row a frequency band."""
    from PIL import Image, ImageDraw, ImageFont
    from scipy.signal import istft
    nper = 2048
    hop = nper // 4
    frames = int(d * SR / hop)
    bins = nper // 2 + 1
    df = SR / nper
    b_lo, b_hi = int(f_lo / df), int(f_hi / df)
    hgt = b_hi - b_lo
    img = Image.new('L', (frames, hgt), 0)
    ft = ImageFont.truetype(font, int(hgt * .9))
    dr = ImageDraw.Draw(img)
    bb = dr.textbbox((0, 0), text, font=ft)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    # stretch text across the duration
    tmp = Image.new('L', (tw + 4, th + 4), 0)
    ImageDraw.Draw(tmp).text((2 - bb[0], 2 - bb[1]), text, font=ft, fill=255)
    tmp = tmp.resize((int(frames * .92), int(hgt * .86)))
    img.paste(tmp, (int(frames * .04), int(hgt * .07)))
    m = np.asarray(img, dtype=float)[::-1] / 255.0  # row 0 = low frequency
    Z = np.zeros((bins, frames), dtype=complex)
    ph = rng.uniform(0, 2 * np.pi, (hgt, frames))
    Z[b_lo:b_hi] = m * np.exp(1j * ph)
    _, x = istft(Z, fs=SR, nperseg=nper, noverlap=nper - hop)
    x = x[:int(d * SR)]
    x /= np.abs(x).max() + 1e-9
    return x * level, m


def master(x, target_lufs=-14.0, ceiling=.89):
    """approximate loudness normalisation (K-weighting skipped: RMS-based) + soft clip"""
    # crude K-weight: high-shelf boost and low cut
    k = hp(x, 60)
    rms = np.sqrt(np.mean(k ** 2) + 1e-12)
    cur = 20 * np.log10(rms) - 0.691 + 3.0
    g = 10 ** ((target_lufs - cur) / 20)
    y = x * g
    return np.tanh(y / ceiling) * ceiling
