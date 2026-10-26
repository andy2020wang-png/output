"""Score for the confirmation sample: hook → cave → papyrus → oracle → floppy (37.5 s), synced to scene cue times.
usage: python3 audio/sample.py out.wav"""
import sys
import numpy as np
from dsp import *
from demo import B, BAR, RHY, motif, FONT

HOOK, CAVE, PAP, ORA, FLO = 0.0, 10.0, 17.5, 25.0, 32.5
END = 37.5


def hook(tr):
    tr.add(0, lp(noise(10), 900) * .015)                          # quiet paper room tone
    for i in range(4):
        tr.add(.45 + i * .14, woodblock(.55, 700 + i * 120))       # card pops
    for k in range(3):
        tr.add(1.05 + k * .75, woodblock(.8, 1500))                # 3-2-1
    tr.add(3.45, bell(note('D3'), 3.0, .9)); tr.add(3.45, impact(.35))
    for i in range(4):
        tr.add(3.8 + i * .22, tick(.6))
    for n, (f, d) in enumerate(zip(['A4', 'F#4', 'E4', 'D4'], RHY)):
        tr.add(7.0 + sum(RHY[:n]), piano(note(f), d * 2.2, .8))
    tr.add(7.0, piano(note('D3'), 3.0, .5)); tr.add(7.0, piano(note('A3'), 3.0, .35))


def cave(tr):
    t0 = CAVE
    tr.add(t0, drone(note('D2'), 3 * BAR + .5), .9)
    for b in range(12):
        tr.add(t0 + b * B * 1, heartbeat(.7) if b % 2 == 0 else frame_drum(.25, 80))
    for at in (.25, .55, .85, 1.15, 1.4, 1.65):
        tr.add(t0 + at - .05, spray(.75))
    for k in range(6):
        tr.add(t0 + 2.1 + k * .91, drip(.45))
    motif(tr, t0 + BAR, ['A4', 'F#4', 'E4', 'D4'], flute, .9, hollow=True, breath=.28)
    tr.add(t0 + 2 * BAR + B, flute(note('D4'), 2.4, .6, hollow=True, breath=.3))


def papyrus(tr):
    t0 = PAP
    tr.add(t0 - .3, fire(1.0, .5))                                 # burn transition
    for b in range(12):
        tr.add(t0 + b * B, frame_drum(.55 if b % 4 == 0 else .28, 95 if b % 4 == 0 else 140))
        tr.add(t0 + b * B + B / 2, bp(noise(.18), 5000, 12000) * np.exp(-T(.18) * 18) * .22)
    for i, n in enumerate(['D3', 'A3', 'D4', 'F#4', 'A4', 'Bb4', 'A4', 'F#4']):
        tr.add(t0 + i * B / 2, harp(note(n), 2.0, .45))
    for c in range(8):
        tr.add(t0 + .5 + c * .55, brush(.35, .35))
    motif(tr, t0 + BAR, ['A4', 'F#4', 'Eb4', 'D4'], harp, 1.3)
    motif(tr, t0 + BAR, ['A5', 'F#5', 'Eb5', 'D5'], flute, .3, breath=.25)
    for i, n in enumerate(['D4', 'Eb4', 'F#4', 'A4']):
        tr.add(t0 + 2 * BAR + i * B, harp(note(n), 2.2, .6))


def oracle(tr):
    t0 = ORA
    tr.add(t0, fire(3 * BAR, .55))
    for i in range(4):
        tr.add(t0 + .7 + i * .35, crack(.9 - i * .12))
    for k in range(8):
        tr.add(t0 + 2.0 + k * .32, scratch(.5, .3))
    tr.add(t0, drone(note('D2'), 3 * BAR, .5))
    motif(tr, t0 + BAR, ['A4', 'F#4', 'E4', 'D4'], bell, 1.4)
    tr.add(t0 + 2 * BAR, flute(note('A3'), 2.4, .55, hollow=True, breath=.3))
    tr.add(t0 + 2 * BAR + B * 2, bell(note('D3'), 2.5, .8))


def floppy(tr):
    t0 = FLO
    arp = ['D5', 'F5', 'A5', 'D6']
    for i in range(32):
        tr.add(t0 + i * B / 4, pulse(note(arp[i % 4]), B / 4, .4, duty=.125))
    for i in range(8):
        tr.add(t0 + i * B, tri(note('D3' if i < 4 else 'Bb2'), B * .9, .9))
        if i % 2 == 0:
            tr.add(t0 + i * B, kick(.5))
    for i in range(8):                                             # terminal lines typing
        for c in range(6):
            tr.add(t0 + .4 + i * .55 + c * .06, tick(.25))
    tr.add(t0 + 1.2, seek(.7, 14, 70))
    motif(tr, t0 + BAR, ['A5', 'F5', 'E5', 'D5'], pulse, 1.0, duty=.5)


def build():
    tr = Track(END + 1)
    hook(tr); cave(tr); papyrus(tr); oracle(tr); floppy(tr)
    mix = reverb(tr.buf, 2.0, .2)
    # cave section gets a bigger room
    i0, i1 = int(CAVE * SR), int(PAP * SR)
    mix[i0:i1] = reverb(tr.buf[i0:i1], 3.5, .35)[:i1 - i0]
    out = master(mix[:int(END * SR)], -14)
    fade = np.clip((END - np.arange(len(out)) / SR) / .4, 0, 1)
    out *= fade
    return np.stack([out, np.roll(out, 24) * .98], axis=1)


if __name__ == '__main__':
    import wave
    y = build()
    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2')
    with wave.open(sys.argv[1], 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print('wrote', sys.argv[1], y.shape[0] / SR, 's')
