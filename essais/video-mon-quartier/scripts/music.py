# A light afro / coupe-decale-ish loop, synthesized (no samples): kick, clap, shaker, talking-drum toms,
# a palm-wine guitar-like pluck arpeggio and a round bass. Writes a stereo 44.1 kHz wav of the given length.
import sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter

SR = 44100
BPM = 118
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 48.0
OUT = sys.argv[1]
beat = 60 / BPM
s16 = beat / 4
N = int(DUR * SR)
L = np.zeros(N)
R = np.zeros(N)
rng = np.random.default_rng(7)


def add(sig, t, pan=0.0, gain=1.0):
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    L[i : i + len(sig)] += sig * (1 - pan) * 0.5 ** 0.5 * (1.0 if pan <= 0 else 1 - pan)
    R[i : i + len(sig)] += sig * (1 + pan) * 0.5 ** 0.5 * (1.0 if pan >= 0 else 1 + pan)


def env(n, a=0.002, d=0.2):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)
    return e


def kick():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 48 + 90 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env(n, 0.001, 0.12) * 0.9


def clap():
    n = int(0.25 * SR)
    noise = rng.standard_normal(n)
    b, a = butter(2, [900 / (SR / 2), 3500 / (SR / 2)], 'band')
    x = lfilter(b, a, noise)
    e = np.zeros(n)
    for k, off in enumerate([0, 0.011, 0.022]):
        i = int(off * SR)
        e[i:] += env(n - i, 0.001, 0.012 if k < 2 else 0.09)
    return x * e * 0.5


def shaker(acc):
    n = int(0.08 * SR)
    noise = rng.standard_normal(n)
    b, a = butter(2, 6000 / (SR / 2), 'high')
    return lfilter(b, a, noise) * env(n, 0.004 if acc else 0.008, 0.025) * (0.16 if acc else 0.09)


def tom(f0, d=0.18, bend=1.0):
    # The talking drum: a pitch that bends up or down as the string is squeezed.
    n = int(d * 1.6 * SR)
    t = np.arange(n) / SR
    f = f0 * (1 + (bend - 1) * np.minimum(1, t / 0.08))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) + 0.25 * np.sin(2 * ph)) * env(n, 0.002, d * 0.5) * 0.35


def pluck(freq, d=0.45):
    # Karplus-Strong: a bright, clean guitar-like note.
    n = int(d * SR)
    p = int(SR / freq)
    buf = rng.uniform(-1, 1, p)
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * 0.996
    return out * env(n, 0.001, d * 0.6) * 0.33


def bass(freq, d):
    n = int(d * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(4 * np.pi * freq * t)
    return x * env(n, 0.005, d * 0.7) * 0.42


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


# I - V - vi - IV in D major, one bar each.
chords = [[62, 66, 69, 74], [57, 61, 64, 69], [59, 62, 66, 71], [55, 59, 62, 67]]
roots = [38, 33, 35, 31]
bar = 4 * beat
arp = [0, 2, 1, 3, 2, 1, 3, 2]  # eighth-note pattern over the chord's notes
pl_cache = {}
nbars = int(DUR / bar) + 1
for b in range(nbars):
    t0 = b * bar
    c = chords[b % 4]
    intro = b < 1
    for q in range(4):
        tq = t0 + q * beat
        if not intro or q >= 2:
            add(kick(), tq, 0, 0.9 if q % 2 == 0 else 0.6)
        if q in (1, 3) and not intro:
            add(clap(), tq, 0.1, 0.8)
    for s in range(16):
        ts = t0 + s * s16 + (0.012 if s % 2 else 0)  # a little swing
        add(shaker(s % 4 == 2), ts, 0.35)
    if not intro:
        # Talking drum: a call on the last beat of every other bar.
        if b % 2 == 1:
            for k, (dt, f, bd) in enumerate([(3, 180, 1.25), (3.5, 150, 0.85), (3.75, 200, 1.1)]):
                add(tom(f, 0.16, bd), t0 + dt * beat, -0.3, 0.9)
        # Bass: root on 1, a push on the and-of-2, the fifth on 3.
        r = roots[b % 4]
        add(bass(hz(r), beat * 0.9), t0, 0, 1)
        add(bass(hz(r), beat * 0.45), t0 + 1.5 * beat, 0, 0.8)
        add(bass(hz(r + 7), beat * 0.9), t0 + 2 * beat, 0, 0.9)
        add(bass(hz(r + 12), beat * 0.4), t0 + 3.5 * beat, 0, 0.6)
    for e, idx in enumerate(arp):
        m = c[idx] + 12
        if m not in pl_cache:
            pl_cache[m] = pluck(hz(m))
        add(pl_cache[m], t0 + e * beat / 2 + (0.01 if e % 2 else 0), -0.25 if e % 2 else 0.25, 0.9 if e % 2 == 0 else 0.7)

mix = np.stack([L, R], 1)
# Fade in and out, soft limit.
fi = int(0.4 * SR)
fo = int(2.5 * SR)
mix[:fi] *= np.linspace(0, 1, fi)[:, None]
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = np.tanh(mix * 1.2)
mix /= np.max(np.abs(mix)) * 1.12
wavfile.write(OUT, SR, (mix * 32767).astype(np.int16))
print('ok', DUR)
