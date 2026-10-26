"""Sound-direction demo: the 我-在-这-里 motif (degrees 5-3-2-1) re-orchestrated per era, then the spectrogram text.
usage: python3 audio/demo.py out.wav"""
import sys
import numpy as np
from dsp import *

BPM = 96
B = 60 / BPM            # beat
BAR = 4 * B             # 2.5 s
RHY = [B, B / 2, B / 2, 2 * B]   # motif rhythm: quarter, eighth, eighth, half
FONT = '/home/user/vibe-info-history/fonts/NotoSerifSC-900.ttf'


def motif(tr, at, notes, inst, gain=1.0, **kw):
    t = at
    for n, d in zip(notes, RHY):
        tr.add(t, inst(note(n), d * 1.8, **kw), gain)
        t += d


def era_cave(tr, t0):
    tr.add(t0, drone(note('D2'), 2 * BAR + 1), .9)
    for b in range(8):
        tr.add(t0 + b * B * 2, heartbeat(.8) if b % 2 == 0 else frame_drum(.35, 80))
    tr.add(t0 + .15, spray(.9)); tr.add(t0 + BAR + .2, spray(.8))
    for k in range(5):
        tr.add(t0 + .7 + k * .93, drip(.5))
    motif(tr, t0 + BAR * .0 + B, ['A4', 'F#4', 'E4', 'D4'], flute, .9, hollow=True, breath=.28)


def era_egypt(tr, t0):
    for b in range(8):  # doum-tek pattern on frame drum, sistrum shimmer on off-beats
        tr.add(t0 + b * B, frame_drum(.6 if b % 4 == 0 else .3, 95 if b % 4 == 0 else 140))
        s = bp(noise(.18), 5000, 12000) * np.exp(-T(.18) * 18) * .25
        tr.add(t0 + b * B + B / 2, s)
    for i, n in enumerate(['D3', 'A3', 'D4', 'F#4', 'A4', 'Bb4', 'A4', 'F#4']):
        tr.add(t0 + i * B / 2, harp(note(n), 2.0, .5))
    motif(tr, t0 + BAR, ['A4', 'F#4', 'Eb4', 'D4'], harp, 1.3)
    motif(tr, t0 + BAR, ['A5', 'F#5', 'Eb5', 'D5'], flute, .35, breath=.25)


def era_shang(tr, t0):
    tr.add(t0, fire(2 * BAR, .7))
    tr.add(t0 + .4, crack(1.0)); tr.add(t0 + 1.3, crack(.6))
    tr.add(t0, drone(note('D2'), 2 * BAR, .6))
    motif(tr, t0 + B * 2, ['A4', 'F#4', 'E4', 'D4'], bell, 1.4)
    tr.add(t0 + BAR + 2 * B, flute(note('A3'), 2.2, .6, hollow=True, breath=.3))


def era_dos(tr, t0):
    arp = ['D5', 'F5', 'A5', 'D6']
    for i in range(32):
        tr.add(t0 + i * B / 4, pulse(note(arp[i % 4]), B / 4, .45, duty=.125))
    for i in range(8):
        tr.add(t0 + i * B, tri(note('D3' if i < 4 else 'Bb2'), B * .9, .9))
        if i % 2 == 0:
            tr.add(t0 + i * B, kick(.5))
    tr.add(t0 + .1, seek(.7, 14, 70)); tr.add(t0 + BAR + 1.6, seek(.6, 8, 50))
    motif(tr, t0 + BAR, ['A5', 'F5', 'E5', 'D5'], pulse, 1.1, duty=.5)


def build():
    d = 8 * BAR + 4.5
    tr = Track(d)
    era_cave(tr, 0)
    era_egypt(tr, 2 * BAR)
    era_shang(tr, 4 * BAR)
    era_dos(tr, 6 * BAR)
    mix = reverb(tr.buf, 2.2, .22)
    # spectrogram text over a soft low pad
    t0 = 8 * BAR
    st, _ = spectro_text('我在这里', 4.0, font=FONT, level=.06)
    pd = lp(pad(note('D3'), 4.4, 1.0, bright=.5) + pad(note('A3'), 4.4, .7, bright=.5), 2500)
    i0 = int(t0 * SR)
    mix[i0:i0 + len(pd)] += pd[:len(mix) - i0] * .9
    mix[i0:i0 + len(st)] += st
    out = master(mix, -14)
    stereo = np.stack([out, np.roll(out, 24) * .98], axis=1)
    return stereo


if __name__ == '__main__':
    import wave
    y = build()
    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2')
    with wave.open(sys.argv[1], 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print('wrote', sys.argv[1], y.shape[0] / SR, 's')
