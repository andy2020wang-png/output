"""Diegetic sound effects for 科技树 02 · 造船, designed to be soft: every effect is low-passed (most below
2 kHz, none above 4.5 kHz), starts with an attack of at least 8 ms, and avoids whistles, metal ringing and
white-noise bursts. All functions return stereo (2, n) arrays."""
import numpy as np
from epic import SR, RNG, T, lp, hp, bp, noise, pan


def _att(t, a):
    return np.sin(np.pi / 2 * np.clip(t / a, 0, 1)) ** 2


def _st(a, b=None, w=.6):
    """two decorrelated mono signals -> stereo with a given width"""
    b = a if b is None else b
    return np.stack([a * (1 + w) / 2 + b * (1 - w) / 2, b * (1 + w) / 2 + a * (1 - w) / 2])


def water(d, v=1.0, rate=.35):
    """lapping water: dark noise breathing in slow, irregular swells"""
    t = T(d)
    sw = .55 + .45 * np.sin(2 * np.pi * rate * t + RNG.uniform(0, 6)) * np.sin(2 * np.pi * rate * 1.618 * t)
    a, b = lp(bp(noise(d), 140, 2400), 1700), lp(bp(noise(d), 140, 2400), 1700)
    e = np.clip(t / .8, 0, 1) * np.clip((d - t) / .8, 0, 1)
    return v * .5 * _st(a, b) * sw * e


def ocean(d, v=1.0):
    """open sea: long wave washes, deeper than water()"""
    t = T(d)
    sw = .5 + .5 * np.sin(2 * np.pi * .12 * t) ** 2
    a, b = lp(noise(d), 1100), lp(noise(d), 1100)
    e = np.clip(t / 1.2, 0, 1) * np.clip((d - t) / 1.2, 0, 1)
    return v * .6 * _st(a, b, .8) * sw * e


def paddle(v=1.0, p=0.0):
    """paddle entering water: rounded splash, then a short pull"""
    t = T(.7)
    s = bp(noise(.7), 200, 2600) * _att(t, .015) * np.exp(-t * 9)
    pull = lp(noise(.7), 350) * _att(t, .12) * np.exp(-t * 4)
    return v * .55 * pan(lp(s + .8 * pull, 2600), p)


def oar_stroke(v=1.0, p=0.0):
    """many oars at once (trireme): low wooden thump plus a broad water push"""
    t = T(.9)
    thump = np.sin(2 * np.pi * np.cumsum(115 * (1 + .3 * np.exp(-t / .02))) / SR) * np.exp(-t * 16) * _att(t, .008)
    push = lp(bp(noise(.9), 150, 1200), 1000) * _att(t, .06) * np.exp(-t * 4.5)
    return v * .55 * pan(.6 * thump + push, p)


def wind(d, v=1.0, lo=140, hi=650):
    t = T(d)
    sw = .6 + .4 * np.sin(2 * np.pi * .21 * t + 1.3) * np.sin(2 * np.pi * .13 * t)
    a, b = bp(noise(d), lo, hi), bp(noise(d), lo, hi)
    e = np.clip(t / 1.0, 0, 1) * np.clip((d - t) / 1.0, 0, 1)
    return v * .45 * _st(a, b, .9) * sw * e


def sail_fill(v=1.0):
    """a sail catching the wind: soft canvas 'whump' and a swell of air"""
    t = T(1.6)
    whump = lp(noise(1.6), 220) * _att(t, .03) * np.exp(-t * 5)
    air = bp(noise(1.6), 200, 900) * _att(t, .35) * np.exp(-t * 1.6)
    return v * .7 * pan(1.4 * whump + .5 * air, 0)


def creak(v=1.0, d=.9, p=0.0, f=55):
    """timber under load: slow stick-slip pulses through a wooden body band"""
    t = T(d)
    rate = f * (1 + .25 * np.sin(np.pi * t / d))
    ph = np.cumsum(rate) / SR
    pulses = np.exp(-((ph - np.round(ph)) ** 2) / .002)
    y = bp(pulses, 180, 950) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    return v * .25 * pan(lp(y, 1100), p)


def gurgle(d=2.4, v=1.0, p=0.0):
    """water flooding a compartment: low rushing plus round bubbles (pitched below 700 Hz)"""
    t = T(d)
    rush = lp(bp(noise(d), 90, 700), 500) * _att(t, .25) * np.clip((d - t) / .6, 0, 1)
    bub = np.zeros_like(t)
    for _ in range(int(d * 9)):
        t0 = RNG.uniform(0, d - .2)
        f0 = RNG.uniform(220, 520)
        tt = t[t >= t0] - t0
        bub[t >= t0] += np.sin(2 * np.pi * f0 * (1 + 1.2 * tt) * tt) * np.exp(-tt * 28) * _att(tt, .006) * RNG.uniform(.2, .5)
    return v * .5 * pan(rush + .35 * lp(bub, 900), p)


def cannon(v=1.0, p=0.0, d=3.0):
    """distant cannon: deep thud with a long, dark roll; no crack"""
    t = T(d)
    sub = np.sin(2 * np.pi * np.cumsum(46 + 40 * np.exp(-t / .06)) / SR) * np.exp(-t * 2.4)
    body = lp(noise(d), 420) * np.exp(-t * 3.2)
    roll = lp(noise(d), 180) * _att(t, .25) * np.exp(-t * 1.1)
    y = (sub + .7 * body + .5 * roll) * _att(t, .01)
    return v * .6 * pan(y, p)


def chuff(v=1.0, p=0.0):
    """steam exhaust beat, rounded"""
    t = T(.45)
    y = lp(bp(noise(.45), 120, 1300), 1000) * _att(t, .02) * np.exp(-t * 9)
    return v * .45 * pan(y, p)


def wheel_splash(v=1.0, p=0.0):
    t = T(.8)
    y = lp(bp(noise(.8), 150, 2400), 2000) * _att(t, .03) * np.exp(-t * 5)
    return v * .45 * pan(y, p)


def rumble(d, v=1.0, f=48):
    """machinery or turret drive: low harmonic hum with slow movement"""
    t = T(d)
    y = sum(g * np.sin(2 * np.pi * f * k * t + RNG.uniform(0, 6)) for k, g in [(1, 1), (2, .5), (3, .25), (4, .12)])
    y *= 1 + .2 * np.sin(2 * np.pi * .7 * t)
    y += .4 * lp(noise(d), 160)
    e = np.clip(t / .6, 0, 1) * np.clip((d - t) / .6, 0, 1)
    return v * .3 * pan(lp(y, 420), 0) * e


def thunk(v=1.0, p=0.0):
    """shell glancing off armour, heard through the hull: low modal knock, no ring"""
    t = T(1.0)
    y = sum(g * np.sin(2 * np.pi * f * t) * np.exp(-t * k) for f, g, k in [(150, 1, 9), (330, .5, 14), (560, .25, 20)])
    y = (y + .4 * lp(noise(1.0), 600) * np.exp(-t * 18)) * _att(t, .008)
    return v * .55 * pan(lp(y, 1100), p)


def jet(v=1.0, d=3.0, p0=-.8, p1=.8):
    """aircraft leaving the deck: rumble that swells and passes, capped at 1.6 kHz, no whine"""
    t = T(d)
    u = t / d
    lvl = np.exp(-((u - .4) ** 2) / .05)
    x = noise(d)
    dark, bright = lp(x, 300), lp(bp(x, 200, 1600), 1600)
    y = (dark * .8 + bright * .5 * lvl) * lvl
    pp = p0 + (p1 - p0) * u
    a = (pp + 1) * np.pi / 4
    return v * .7 * np.stack([y * np.cos(a), y * np.sin(a)])


def catapult(v=1.0):
    t = T(1.2)
    thud = np.sin(2 * np.pi * np.cumsum(70 * (1 + .4 * np.exp(-t / .03))) / SR) * np.exp(-t * 7) * _att(t, .01)
    rush = lp(noise(1.2), 700) * _att(t, .05) * np.exp(-t * 3)
    return v * .5 * pan(thud + .6 * rush, 0)


def hum(d, v=1.0, f=60):
    """reactor / ship's power: steady, very low"""
    return rumble(d, v * .7, f)
