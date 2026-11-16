"""Sound: effects only, no music. Everything is synthesised (numpy / scipy), nothing is sampled.

  typing      soft, low 'thock' of a damped keyboard, one per keystroke on the timeline
  run         a small button click
  scan        the picture 'fills up': trickling bubbles whose pitch rises as the scan nears the bottom,
              over a quiet breath of air; bright rows of the image add fine glints
  done        a soft pop per channel, and a gentle bloom when the last channel lands
"""
import sys
import wave
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

from timeline import ease_scan

SR = 48000

# ---- mix balance (linear gains into the buses) --------------------------------
G_KEY = 0.185       # typing
G_WATER = 0.085     # trickle during a scan
G_AIR = 0.20        # breath under the trickle
G_GLINT = 0.042     # glints on bright rows
G_POP = 0.26        # channel landed
G_WHOOSH = 0.20     # a picture is wiped away
TARGET_LUFS = -18.0
CEILING = 0.82      # sample peak after mastering (about -1.7 dBFS)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, 'low', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x)


class Bus:
    """Stereo buffer with equal-power panning."""

    def __init__(self, dur):
        self.n = int(dur * SR)
        self.buf = np.zeros((2, self.n))

    def add(self, t, sig, gain=1.0, pan=0.0):
        i = int(round(t * SR))
        if i >= self.n or i < 0:
            return
        L = min(len(sig), self.n - i)
        a = (pan + 1) * np.pi / 4
        self.buf[0, i:i + L] += sig[:L] * gain * np.cos(a) * 1.4142
        self.buf[1, i:i + L] += sig[:L] * gain * np.sin(a) * 1.4142

    def add_stereo(self, t, l, r, gain=1.0):
        i = int(round(t * SR))
        L = min(len(l), self.n - i)
        if L > 0:
            self.buf[0, i:i + L] += l[:L] * gain
            self.buf[1, i:i + L] += r[:L] * gain

    def room(self, rng, size, wet, damp):
        """Diffuse tail: exponentially decaying noise, different for each ear."""
        n = int(size * SR)
        t = np.arange(n) / SR
        out = np.empty_like(self.buf)
        for c in range(2):
            ir = rng.standard_normal(n) * np.exp(-t * 6.9 / size)
            ir[:int(0.004 * SR)] = 0                              # short pre-delay keeps transients clean
            ir = lp(ir, damp)
            ir /= np.sqrt((ir ** 2).sum()) + 1e-12
            out[c] = self.buf[c] + wet * fftconvolve(self.buf[c], ir)[:self.n]
        self.buf = out
        return self


# ------------------------------------------------------------------ one-shots
def fade(y, ms=12.0):
    """Every one-shot ends on zero: no clicks from a cut-off tail."""
    k = min(len(y), int(ms * 1e-3 * SR))
    y[-k:] *= np.linspace(1.0, 0.0, k)
    return y


def thock(rng, f0, level=1.0, click=1.0, body=1.0, dur=0.14):
    """One key bottoming out: a few fast-decaying inharmonic partials of the case + a 3 ms noise tick."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for ratio, amp, tau in ((1.0, 0.70, 0.021), (2.27, 0.80, 0.013), (3.86, 0.70, 0.0085), (6.4, 0.46, 0.0055), (9.7, 0.24, 0.0035)):
        f = f0 * ratio * rng.uniform(0.95, 1.05)
        y += body * amp * rng.uniform(0.75, 1.15) * np.sin(2 * np.pi * f * t + rng.uniform(0, 2 * np.pi)) * np.exp(-t / tau)
    y += 0.55 * body * bp(rng.standard_normal(n), 170, 950) * np.exp(-t / 0.013)   # the dull thud under the tone
    tick = bp(rng.standard_normal(n), 1400, 5200) * np.exp(-t / 0.0026)
    y += 1.0 * click * tick
    y += 0.06 * bp(rng.standard_normal(n), 450, 2000) * np.exp(-t / 0.028)         # felt / case rustle
    y *= np.clip(t / 0.0007, 0, 1)
    return level * fade(y)


def key(rng, kind='key'):
    """Down-stroke + quieter, slightly higher up-stroke."""
    if kind == 'enter':
        f0, lv, gap = rng.uniform(128, 148), 1.22, rng.uniform(0.085, 0.105)
    elif kind == 'note':
        f0, lv, gap = rng.uniform(190, 250), 0.70, rng.uniform(0.060, 0.085)
    else:
        f0, lv, gap = rng.uniform(176, 246), rng.uniform(0.80, 1.05), rng.uniform(0.055, 0.085)
    down = thock(rng, f0, lv, click=rng.uniform(0.75, 1.1))
    up = thock(rng, f0 * rng.uniform(1.12, 1.24), lv * rng.uniform(0.22, 0.32), click=0.6, body=0.8, dur=0.09)
    out = np.zeros(int(gap * SR) + len(up))
    out[:len(down)] += down
    out[int(gap * SR):] += up
    return out


def tick(rng, level=1.0):
    """Tiny selection tick."""
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    return level * fade(bp(rng.standard_normal(n), 2400, 7000) * np.exp(-t / 0.0013) + 0.25 * np.sin(2 * np.pi * 1250 * t) * np.exp(-t / 0.004))


def click(rng):
    """Run button: mouse-like down/up tick with a little plastic body, plus a soft pop."""
    n = int(0.26 * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for off, lv, f in ((0.0, 1.0, 820), (0.072, 0.5, 990)):
        i = int(off * SR)
        tt = t[:n - i]
        c = bp(rng.standard_normal(n - i), 1700, 5200) * np.exp(-tt / 0.002)
        b = np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.006) * 0.5
        y[i:] += lv * (c + b) * np.clip(tt / 0.0005, 0, 1)
    return fade(y)


def pop(f_hi=560.0, f_lo=330.0, tau=0.05, glide=0.045):
    """Soft bubble-like pop: a sine sliding down, gone in ~150 ms."""
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    f = f_lo + (f_hi - f_lo) * np.exp(-t / glide)
    return fade(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tau) * np.clip(t / 0.002, 0, 1))


def glint(rng, f, tau):
    n = int(min(0.4, tau * 7) * SR)
    t = np.arange(n) / SR
    return fade((np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.76 * t + 1.0) * np.exp(-t / (tau * 0.4))) * np.exp(-t / tau) * np.clip(t / 0.0012, 0, 1))


def moving_noise(rng, fc, width=0.42):
    """Noise seen through a band that follows the centre frequency fc[n] (mid and side signals)."""
    n = len(fc)
    src_m, src_s = rng.standard_normal(n), rng.standard_normal(n)
    out_m, out_s = np.zeros(n), np.zeros(n)
    for fb in np.geomspace(240, 4200, 12):
        w = np.exp(-0.5 * ((np.log2(fb) - np.log2(fc)) / width) ** 2)
        out_m += w * bp(src_m, fb / 1.19, fb * 1.19)
        out_s += w * bp(src_s, fb / 1.19, fb * 1.19)
    return out_m, out_s


# ------------------------------------------------------------------ the scan: filling with water and light
def scan_sound(rng, bus_water, bus_air, bus_glint, t0, dur, ch, rows, density=1.0, with_air=True):
    """rows: per image row, dict of 0..1 arrays 'mean' (brightness of the new channel) and 'spark' (very bright share)."""
    n = int((dur + 0.5) * SR)
    t = np.arange(n) / SR
    u = np.array([ease_scan(v) for v in np.clip(t / dur, 0, 1)])           # scan position per sample
    on = np.clip(t / 0.07, 0, 1) * np.clip((dur + 0.10 - t) / 0.16, 0, 1)   # fade in, fade out just after the end
    row = np.minimum((u * len(rows['mean'])).astype(int), len(rows['mean']) - 1)
    bright = rows['mean'][row]
    # --- breath of air: band of noise whose centre rises with the scan
    lift = 2 ** (ch * 0.30)                                               # each channel a little higher
    if with_air:
        air_m, air_s = moving_noise(rng, 330.0 * lift * (3.1 ** u))
        env = on * (0.55 + 0.45 * bright)
        env = lp(env, 12)
        air_m *= env; air_s *= env
        bus_air.add_stereo(t0, air_m + 0.45 * air_s, air_m - 0.45 * air_s, gain=G_AIR * (1.0, 1.1, 1.25)[ch])
    # --- trickle: many small bubbles (Minnaert resonance f = 3/r, radius in metres), smaller as the picture fills
    rate = 230.0 * density
    count = rng.poisson(rate * dur)
    for tb in np.sort(rng.uniform(0, dur, count)):
        ub = ease_scan(tb / dur)
        r_hi = 3.3e-3 * (0.60 ** ub) / lift
        r_lo = 1.0e-3 * (0.64 ** ub) / lift
        a = 1.9                                                           # power-law size distribution: many small, few big
        x = rng.uniform()
        r = (r_lo ** (1 - a) + x * (r_hi ** (1 - a) - r_lo ** (1 - a))) ** (1 / (1 - a))
        f = 3.0 / r
        d = 0.13 / r + 0.0072 * r ** -1.5                                 # damping (1/s)
        L = int(min(0.12, 6.0 / d) * SR)
        tt = np.arange(L) / SR
        rise = rng.uniform(0.04, 0.14)
        ph = 2 * np.pi * np.cumsum(f * (1 + rise * d * tt)) / SR
        amp = (r / 2e-3) ** 0.55 * rng.uniform(0.45, 1.0) * (1.0 + 0.45 * ub)
        g = float(on[min(n - 1, int(tb * SR))]) * (0.6 + 0.4 * float(bright[min(n - 1, int(tb * SR))]))
        bus_water.add(t0 + tb, amp * np.sin(ph) * np.exp(-d * tt), gain=G_WATER * g * (1.0, 1.22, 1.5)[ch], pan=rng.uniform(-0.7, 0.7))
    # --- glints: where the row holds very bright pixels, fine high pings
    spark = rows['spark'][row]
    lam = (3.0 + 60.0 * spark) * density                                  # events per second
    p = lam / SR
    hits = np.nonzero(rng.uniform(size=n) < p * on)[0]
    for i in hits:
        if i / SR > dur:
            continue
        f = float(np.exp(rng.uniform(np.log(2300), np.log(5600)))) * (1.0 + 0.12 * ch)
        bus_glint.add(t0 + i / SR, glint(rng, f, rng.uniform(0.02, 0.06)), gain=G_GLINT * rng.uniform(0.4, 1.0), pan=rng.uniform(-0.85, 0.85))


def row_stats(art):
    """Per channel: brightness and 'very bright' share of every image row, as the scan will meet them."""
    a = art.astype(np.float32) / 255.0
    out = []
    for ch in range(3):
        m = a[..., ch].mean(1)
        s = (a[..., ch] > 0.86).mean(1)
        k = np.ones(9) / 9
        out.append({'mean': np.convolve(m / (m.max() + 1e-9), k, mode='same'),
                    'spark': np.convolve(s / (s.max() + 1e-9), k, mode='same')})
    return out


def whoosh(rng, dur):
    """Falling breath of air: a finished picture is wiped away."""
    n = int((dur + 0.14) * SR)
    v = np.arange(n) / n
    m, sd = moving_noise(rng, 2900.0 * (0.17 ** v), width=0.55)
    env = np.sin(np.pi * v) ** 1.6
    return fade(m * env + 0.5 * sd * env), fade(m * env - 0.5 * sd * env)


def score(tl, arts, seed=20261115):
    """arts: the finished pictures (1024 x 1024 x 3, uint8) in running order."""
    rng = np.random.default_rng(seed)
    dur = tl.total
    keys, ui, water, air, shine, low = (Bus(dur) for _ in range(6))
    for t, kind, pan in tl.keys:
        keys.add(t, key(rng, kind), gain=G_KEY, pan=pan)
    for t0, t1, p in tl.wipes:
        l, r = whoosh(rng, t1 - t0)
        air.add_stereo(max(0.0, t0 - 0.05), l, r, gain=G_WHOOSH)
    stats = [row_stats(a) for a in arts]
    for t0, t1, p in tl.passes:                                            # one scan: the three channels pour together,
        for ch in range(3):                                                # each in its own register, one breath of air under them
            scan_sound(rng, water, air, shine, t0, t1 - t0, ch, stats[p][ch], density=0.45, with_air=(ch == 1))
    for tb, p in tl.done:                                                  # a picture is complete
        final = p == len(arts) - 1
        n = int(2.4 * SR)
        t = np.arange(n) / SR
        ui.add(tb, pop(840, 470, 0.06), gain=0.19)
        thump = np.sin(2 * np.pi * np.cumsum(58 + 62 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.17) * np.clip(t / 0.004, 0, 1)
        low.add(tb, fade(thump, 60), gain=0.25 if final else 0.12)
        tau = 0.55 if final else 0.28
        sw_l = bp(rng.standard_normal(n), 900, 5200) * np.clip(t / 0.10, 0, 1) * np.exp(-t / tau)
        sw_r = bp(rng.standard_normal(n), 900, 5200) * np.clip(t / 0.10, 0, 1) * np.exp(-t / tau)
        air.add_stereo(tb, fade(sw_l, 80), fade(sw_r, 80), gain=0.085 if final else 0.055)
        if final:                                                          # one quiet glass note, only at the very end
            ting = np.zeros(n)
            for ratio, amp, tk in ((1.0, 1.0, 0.50), (2.76, 0.42, 0.26), (5.40, 0.20, 0.15), (8.93, 0.08, 0.09)):
                ting += amp * np.sin(2 * np.pi * 1245 * ratio * t) * np.exp(-t / tk)
            shine.add(tb + 0.012, fade(ting * np.clip(t / 0.003, 0, 1), 200), gain=0.060)
        for k in range(34 if final else 14):                               # settling sparkle
            dt = rng.exponential(0.42 if final else 0.22)
            if dt < (1.7 if final else 0.9):
                f = float(np.exp(rng.uniform(np.log(2600), np.log(7000))))
                shine.add(tb + 0.03 + dt, glint(rng, f, rng.uniform(0.03, 0.09)), gain=G_GLINT * rng.uniform(0.3, 1.0), pan=rng.uniform(-0.9, 0.9))

    keys.buf = lp(keys.buf, 9000)
    keys.room(rng, 0.22, 0.11, 5000)
    ui.room(rng, 0.30, 0.14, 6000)
    water.buf = lp(hp(water.buf, 320), 7500)
    water.room(rng, 0.50, 0.16, 6000)
    air.room(rng, 0.9, 0.20, 5000)
    shine.buf = lp(shine.buf, 11000)
    shine.room(rng, 1.5, 0.34, 8000)
    mix = keys.buf + ui.buf + water.buf + air.buf + shine.buf + low.buf
    stems = {'keys': keys.buf, 'ui': ui.buf, 'water': water.buf, 'air': air.buf, 'shine': shine.buf, 'low': low.buf}
    return mix, stems


def lufs(x):
    """Integrated loudness, ITU-R BS.1770-4 (K-weighting, 400 ms blocks, absolute and relative gates), 48 kHz."""
    from scipy.signal import lfilter
    k = lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585], x, axis=1)
    k = lfilter([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621], k, axis=1)
    w, h = int(0.4 * SR), int(0.1 * SR)
    z = np.array([(k[:, i:i + w] ** 2).mean(1).sum() for i in range(0, k.shape[1] - w + 1, h)])
    l = -0.691 + 10 * np.log10(z + 1e-20)
    z = z[l > -70.0]
    rel = -0.691 + 10 * np.log10(z.mean()) - 10.0
    z = z[-0.691 + 10 * np.log10(z) > rel]
    return -0.691 + 10 * np.log10(z.mean())


def limiter(x, ceiling, look=0.002, release=0.075):
    """Look-ahead peak limiter (stereo-linked): the gain is already down when a transient arrives and
    recovers within a key-stroke, so peaks are turned down cleanly instead of being clipped."""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    need = np.minimum(1.0, ceiling / np.maximum(np.abs(x).max(0), 1e-9))
    L = max(1, int(look * SR))
    held = minimum_filter1d(need, size=2 * L + 1, mode='nearest')
    k = 1.0 - np.exp(-1.0 / (release * SR))
    g = np.empty_like(held)
    cur = 1.0
    for i, v in enumerate(held):
        cur += (1.0 - cur) * k
        if cur > v:
            cur = v
        g[i] = cur
    g = uniform_filter1d(g, size=L, mode='nearest')
    return x * g, g


def master(x, target=TARGET_LUFS, ceiling=CEILING):
    """Rumble filter, then gain + limiter iterated until the integrated loudness sits on target.
    The last 60 ms fade to silence so the film loops without a click."""
    y = hp(x, 55)
    k = int(0.06 * SR)
    y[:, -k:] *= np.linspace(1.0, 0.0, k)
    gain = 10 ** ((target - lufs(y)) / 20)
    for _ in range(5):
        out, g = limiter(y * gain, ceiling)
        gain *= 10 ** ((target - lufs(out)) / 20)
    out, g = limiter(y * gain, ceiling)
    return out, 20 * np.log10(gain), 20 * np.log10(g.min())


def write_wav(path, x, peak=None):
    x = np.asarray(x)
    if peak:
        x = x * (peak / (np.abs(x).max() + 1e-12))
    pcm = (np.clip(x, -1, 1).T * 32767.0).round().astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == '__main__':
    import os
    from piece import load_film
    from timeline import build
    film = load_film(sys.argv[1], sys.argv[2])
    tl = build(film.pieces)
    mix, stems = score(tl, [p.render() for p in film.pieces])
    out = sys.argv[3]
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    final, gain_db, gr_db = master(mix)
    write_wav(out, final)
    db = lambda v: 20 * np.log10(v + 1e-12)
    print('master : gain %+.1f dB  deepest limiting %.1f dB  peak %.1f dBFS  integrated %.1f LUFS' % (gain_db, gr_db, db(np.abs(final).max()), lufs(final)))
    print('raw mix: peak %.1f dBFS  rms %.1f dBFS  dur %.2fs' % (db(np.abs(mix).max()), db(np.sqrt((mix ** 2).mean())), mix.shape[1] / SR))
    for k, v in stems.items():
        print('  %-6s peak %6.1f dBFS  rms %6.1f dBFS' % (k, db(np.abs(v).max()), db(np.sqrt((v ** 2).mean()))))
        if len(sys.argv) > 4:
            write_wav(os.path.join(sys.argv[4], f'stem_{k}.wav'), v)
