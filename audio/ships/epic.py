"""Stereo orchestral synthesis for 科技树 02 · 造船. numpy maths only, no samples.
Rule from the director: nothing may sound harsh. Every voice is band-limited, low-passed well below
the ear's 2-5 kHz sensitivity peak where it can be, and has a non-zero attack. Signals are (2, n) arrays."""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
RNG = np.random.default_rng(20261027)


def T(d):
    return np.arange(int(round(d * SR))) / SR


def _f(x, sos):
    return sosfilt(sos, x, axis=-1)


def lp(x, f, order=2):
    return _f(x, butter(order, min(f, SR * .45), 'low', fs=SR, output='sos'))


def hp(x, f, order=2):
    return _f(x, butter(order, f, 'high', fs=SR, output='sos'))


def bp(x, lo, hi, order=2):
    return _f(x, butter(order, [lo, min(hi, SR * .45)], 'band', fs=SR, output='sos'))


def noise(d):
    return RNG.standard_normal(int(round(d * SR)))


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


_NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def N(s):
    """'D4' -> 62, 'Bb3' -> 58, 'F#5' -> 78"""
    k, i = _NAMES[s[0]], 1
    if s[1] in '#b':
        k += 1 if s[1] == '#' else -1
        i = 2
    return k + 12 * (int(s[i:]) + 1)


def pan(x, p):
    """mono -> stereo, constant power, p in [-1, 1]"""
    a = (np.clip(p, -1, 1) + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)])


def st(x):
    return x if x.ndim == 2 else pan(x, 0)


def mix(*sigs):
    """sum stereo signals of different lengths"""
    sigs = [st(s) for s in sigs]
    out = np.zeros((2, max(s.shape[1] for s in sigs)))
    for s in sigs:
        out[:, :s.shape[1]] += s
    return out


def note_env(n, d, a, r, s=1.0, dk=0.0):
    """attack a, optional decay rate dk toward sustain s, hold until d, release r (smooth curves)"""
    t = np.arange(n) / SR
    att = np.sin(np.pi / 2 * np.clip(t / max(a, 1e-3), 0, 1)) ** 2
    body = s + (1 - s) * np.exp(-t * dk) if dk else np.ones(n)
    rel = np.cos(np.pi / 2 * np.clip((t - d) / max(r, 1e-3), 0, 1)) ** 2
    return att * body * rel


def blsaw(freq):
    """band-limited sawtooth (polyBLEP) for a per-sample frequency array"""
    dt = np.asarray(freq, float) / SR
    ph = np.cumsum(dt) + RNG.uniform(0, 1)
    ph -= np.floor(ph)
    y = 2 * ph - 1
    m = ph < dt
    x = ph[m] / dt[m]
    y[m] -= x + x - x * x - 1
    m = ph > 1 - dt
    x = (ph[m] - 1) / dt[m]
    y[m] -= x * x + x + x + 1
    return y


def _vib(t, rate, depth, delay=.25):
    return 1 + depth * np.clip((t - delay) / .5, 0, 1) * np.sin(2 * np.pi * rate * t + RNG.uniform(0, 6.28))


# ---------------------------------------------------------------- sustained sections
def strings(m, d, v=1.0, a=.35, r=.8, voices=6, bright=5200, width=.8, vib=.0028):
    """string section: detuned band-limited saws, delayed vibrato, body filtering"""
    t = T(d + r)
    f0 = mtof(m)
    y = np.zeros((2, len(t)))
    for j in range(voices):
        f = f0 * (1 + RNG.normal(0, .0035)) * _vib(t, 5.0 + RNG.uniform(-.6, .6), vib)
        y += pan(blsaw(f), width * (-1 + 2 * j / max(voices - 1, 1)))
    y = lp(hp(y, 55), min(bright, f0 * 28), 2)
    y = y + .35 * bp(y, 250, 600)                       # wooden body warmth
    rosin = bp(np.stack([noise(d + r), noise(d + r)]), 2500, 9000) * .035 * min(1.0, f0 / 300)
    return v * .09 * (y + rosin) * note_env(len(t), d, a, r) / np.sqrt(voices)


def spicc(m, v=1.0, d=.16, voices=4, bright=3400, p=0.0):
    """short bowed note for ostinati: 6 ms attack, quick decay, no click"""
    t = T(d + .25)
    f0 = mtof(m)
    y = np.zeros((2, len(t)))
    for j in range(voices):
        y += pan(blsaw(f0 * (1 + RNG.normal(0, .004)) * np.ones(len(t))), p + .5 * (-1 + 2 * j / max(voices - 1, 1)))
    y = lp(hp(y, 45), min(bright, f0 * 20), 2)
    e = note_env(len(t), d, .006, .12, s=.35, dk=14)
    return v * .11 * y * e / np.sqrt(voices)


def brass(m, d, v=1.0, a=.09, r=.45, voices=3, dark=560, bright=2400, p=0.0, width=.5, scoop=.018):
    """horn/trombone section; brightness follows the envelope and the dynamic, capped below 2 kHz"""
    t = T(d + r)
    f0 = mtof(m)
    y = np.zeros((2, len(t)))
    for j in range(voices):
        f = f0 * (1 + RNG.normal(0, .0028)) * (1 - scoop * np.exp(-t / .06)) * _vib(t, 4.6, .0012, .4)
        y += pan(blsaw(f), p + width * (-1 + 2 * j / max(voices - 1, 1)))
    e = note_env(len(t), d, a, r)
    w = np.clip(e * min(v, 1.2), 0, 1) ** 1.6
    out = lp(y, dark) * (1 - w) + lp(y, bright, 2) * w
    return v * .13 * hp(out, 40) * e / np.sqrt(voices)


_FORM = {'a': [(700, 1.0), (1150, .5), (2600, .14)], 'o': [(450, 1.0), (800, .45), (2600, .08)],
         'u': [(330, 1.0), (720, .28), (2400, .05)], 'm': [(260, 1.0), (1800, .04)]}


def choir(m, d, v=1.0, vowel='a', voices=6, a=.55, r=1.0, width=.9):
    t = T(d + r)
    f0 = mtof(m)
    src = np.zeros((2, len(t)))
    for j in range(voices):
        f = f0 * (1 + RNG.normal(0, .004)) * _vib(t, 5.4 + RNG.uniform(-.5, .5), .004, .3)
        src += pan(blsaw(f), width * (-1 + 2 * j / max(voices - 1, 1)))
    src += .05 * np.stack([lp(noise(d + r), 3000), lp(noise(d + r), 3000)])     # breath
    air = .02 * np.stack([bp(noise(d + r), 4500, 11000), bp(noise(d + r), 4500, 11000)])
    y = sum(g * bp(src, fc * .9, fc * 1.1) for fc, g in _FORM[vowel])
    y = lp(y, 7000) + air
    return v * .5 * y * note_env(len(t), d, a, r) / np.sqrt(voices)


def organ(m, d, v=1.0, a=.25, r=.8):
    t = T(d + r)
    f = mtof(m)
    y = sum(g * np.sin(2 * np.pi * f * k * t + RNG.uniform(0, 6.28)) for k, g in [(.5, .7), (1, 1), (2, .45), (3, .22), (4, .16), (6, .06)] if f * k < 5000)
    y = y * (1 + .03 * np.sin(2 * np.pi * 5.8 * t))
    return v * .12 * np.stack([y, np.roll(y, 40)]) * note_env(len(t), d, a, r)


def pad(m, d, v=1.0, a=1.2, r=1.5):
    """soft synthetic bed under everything (strings played sul tasto)"""
    return hp(strings(m, d, v * .8, a=a, r=r, voices=5, bright=3000, vib=.002), 110)


# ---------------------------------------------------------------- solo colour instruments
def flute(m, d, v=1.0, a=.08, r=.25, hollow=True, p=0.0):
    t = T(d + r)
    f = mtof(m) * _vib(t, 5.0, .005, .2)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) + (0 if hollow else .15 * np.sin(2 * ph))
    y += .12 * bp(noise(d + r), mtof(m) * .9, mtof(m) * 2.5)
    return v * .22 * pan(lp(y, 6500), p) * note_env(len(t), d, a, r)


def reed(m, d, v=1.0, a=.06, r=.2, p=0.0):
    """aulos-like double reed, kept dark: formants at 600 and 1300 Hz, nothing above 2.4 kHz"""
    t = T(d + r)
    f = mtof(m) * _vib(t, 5.6, .006, .15)
    s = blsaw(f)
    y = bp(s, 480, 760) + .5 * bp(s, 1100, 1500) + .3 * lp(s, 400)
    return v * .3 * pan(lp(y, 2400), p) * note_env(len(t), d, a, r)


def horn_lur(m, d, v=1.0, p=0.0):
    """long natural horn: slower attack, deeper scoop, very dark"""
    return brass(m, d, v, a=.22, r=.8, voices=2, dark=380, bright=1100, p=p, width=.2, scoop=.04)


def _modal(f, d, partials, decay, bright=1.0, inharm=0.0):
    t = T(d)
    y = np.zeros_like(t)
    for k, g in enumerate(partials, start=1):
        ratio = k * np.sqrt(1 + inharm * k * k)
        if f * ratio > 9000:
            break
        y += g * bright ** (k - 1) * np.sin(2 * np.pi * f * ratio * t + RNG.uniform(0, 6.28)) * np.exp(-t * decay * (1 + .35 * (k - 1) ** 1.3))
    return y * np.sin(np.pi / 2 * np.clip(t / .004, 0, 1)) ** 2


def pluck(m, kind='harp', v=1.0, p=0.0, d=None):
    f = mtof(m)
    spec = {'harp': ([1, .5, .28, .16, .09, .05], 1.3, .95, 0, 2.6),
            'lyre': ([1, .65, .45, .3, .2, .12, .07], 2.2, .96, .0004, 1.8),
            'zheng': ([1, .75, .5, .36, .24, .15, .1], 1.6, .97, .0002, 2.4),
            'lute': ([1, .55, .36, .22, .14, .08], 2.4, .94, 0, 1.6)}[kind]
    y = _modal(f, d or spec[4], spec[0], spec[1], spec[2], spec[3])
    return v * .3 * pan(lp(y, 7000), p)


# ---------------------------------------------------------------- percussion (all soft-skinned, no cymbals)
def taiko(v=1.0, f=58, d=2.2, p=0.0):
    t = T(d)
    bend = 1 + .3 * np.exp(-t / .035)
    ph = 2 * np.pi * f * np.cumsum(bend) / SR
    y = sum(g * np.sin(ph * r_) * np.exp(-t * k) for r_, g, k in [(1, 1, 3.2), (1.59, .45, 6), (2.14, .2, 9), (2.65, .1, 13)])
    skin = lp(noise(d), 1700) * np.exp(-t / .018)
    y = (y + .35 * skin) * np.sin(np.pi / 2 * np.clip(t / .002, 0, 1)) ** 2
    return v * .55 * pan(lp(y, 4000), p)


def frame_drum(v=1.0, f=95, p=0.0):
    t = T(.9)
    body = np.sin(2 * np.pi * np.cumsum(f * (1 + .25 * np.exp(-t / .02))) / SR) * np.exp(-t * 7)
    skin = bp(noise(.9), 300, 1400) * np.exp(-t / .012)
    y = (body + .25 * skin) * np.sin(np.pi / 2 * np.clip(t / .002, 0, 1)) ** 2
    return v * .45 * pan(lp(y, 4000), p)


def timpani(m, v=1.0, d=3.0, p=0.0):
    t = T(d)
    f = mtof(m)
    y = sum(g * np.sin(2 * np.pi * f * r_ * t + RNG.uniform(0, 6)) * np.exp(-t * k) for r_, g, k in [(1, 1, 1.4), (1.5, .55, 2.2), (1.98, .35, 3), (2.44, .15, 4.5)])
    mallet = lp(noise(d), 700) * np.exp(-t / .015)
    y = (y + .4 * mallet) * np.sin(np.pi / 2 * np.clip(t / .003, 0, 1)) ** 2
    return v * .5 * pan(y, p)


def snare_soft(v=1.0, p=0.0):
    """field drum played softly: low snare wires, rounded with a 3.2 kHz low-pass"""
    t = T(.45)
    body = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 22)
    wires = bp(noise(.45), 350, 2600) * np.exp(-t * 16)
    y = (.6 * body + .7 * wires) * np.sin(np.pi / 2 * np.clip(t / .004, 0, 1)) ** 2
    return v * .3 * pan(lp(y, 3200), p)


def boom(v=1.0, d=2.4):
    """low hit on a downbeat: pitched sub plus dark body, the replacement for any crash cymbal"""
    t = T(d)
    sub = np.sin(2 * np.pi * np.cumsum(38 + 34 * np.exp(-t / .08)) / SR) * np.exp(-t * 1.7)
    body = lp(noise(d), 260) * np.exp(-t * 4)
    y = (sub + .5 * body) * np.sin(np.pi / 2 * np.clip(t / .004, 0, 1)) ** 2
    return v * .7 * np.stack([y, y])


def riser(d=.625, v=1.0, f0=250, f1=1600):
    """air swell into a downbeat: band-limited noise whose band rises; ends with a 15 ms fade"""
    t = T(d)
    u = t / d
    x = np.stack([noise(d), noise(d)])
    lo_ = lp(x, f0)
    hi_ = lp(x, f1)
    y = lo_ * (1 - u) + hi_ * u
    e = u ** 2.4 * np.clip((d - t) / .015, 0, 1)
    return v * .12 * y * e


def braam(m, d=3.2, v=1.0):
    """low brass cluster with a slow filter swell, plus sub; saturation is re-filtered so it stays dark"""
    y = sum(brass(mm, d, 1.0, a=.06, r=1.2, voices=4, dark=300, bright=1500, width=.7, scoop=.03)
            for mm in (m - 24, m - 12, m - 5))
    t = T(d + 1.2)
    y = y * (1 + .25 * np.sin(np.pi * np.clip(t / d, 0, 1)))
    y = lp(np.tanh(2.2 * y) / 2.2, 1800)
    sub = np.sin(2 * np.pi * mtof(m - 36) * t) * np.exp(-t * .9) * np.clip(t / .01, 0, 1)
    return v * (y * 1.6 + .25 * np.stack([sub, sub]))


# ---------------------------------------------------------------- space and bus
def hall(x, size=2.8, mix=.28, damp=7000, pre=.025):
    """decorrelated stereo hall; the tail darkens with time so reflections never hiss"""
    n = int(size * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(x)
    for c in range(2):
        nz = RNG.standard_normal(n)
        early = lp(nz, damp) * np.exp(-t * 6.9 / size)
        late = lp(nz, damp * .45) * np.exp(-t * 6.9 / size)
        ir = early * np.exp(-t * 2.5) + late * (1 - np.exp(-t * 2.5))
        ir = np.concatenate([np.zeros(int(pre * SR)), ir])
        ir /= np.sqrt((ir ** 2).sum()) + 1e-9
        out[c] = fftconvolve(x[c], ir)[:x.shape[1]]
    out = out + .5 * hp(out, 5000)
    return x * (1 - mix) + out * mix * 1.3


class Bus:
    def __init__(self, d):
        self.buf = np.zeros((2, int(d * SR) + SR * 4))

    def add(self, at, sig, g=1.0):
        sig = st(sig)
        i = int(round(at * SR))
        if i < 0:
            sig, i = sig[:, -i:], 0
        L = min(sig.shape[1], self.buf.shape[1] - i)
        if L > 0:
            self.buf[:, i:i + L] += sig[:, :L] * g


def harshness(x):
    """report for the 'nothing harsh' rule: share of energy in 2-5 kHz and above 6 kHz, spectral centroid"""
    m = x.mean(0) if x.ndim == 2 else x
    S = np.abs(np.fft.rfft(m * np.hanning(len(m)))) ** 2
    f = np.fft.rfftfreq(len(m), 1 / SR)
    tot = S.sum() + 1e-20
    band = S[(f >= 2000) & (f < 5000)].sum() / tot
    high = S[f >= 6000].sum() / tot
    cen = (S * f).sum() / tot
    # worst 100 ms: how far the 2-5 kHz band rises above the signal's own full-band level at that moment
    w = int(.1 * SR)
    k = len(m) // w
    full = (m[:k * w].reshape(k, w) ** 2).mean(1)
    pres = (bp(m, 2000, 5000)[:k * w].reshape(k, w) ** 2).mean(1)
    ok = full > full.max() * 1e-3
    worst = 10 * np.log10(pres[ok] / full[ok] + 1e-12).max() if ok.any() else -99
    return {'2-5k_dB': round(10 * np.log10(band + 1e-12), 1), '6k+_dB': round(10 * np.log10(high + 1e-12), 1),
            'centroid_Hz': round(cen), 'worst100ms_2-5k_dB': round(float(worst), 1)}
