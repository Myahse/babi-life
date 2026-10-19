"""The gameplay video's sound (FILM=gameplay): a coupé-décalé-style beat made
here, with no sample, plus a whoosh on every cut and a cash register on every
money change. Writes out/son-gameplay.mp3, which video.mjs puts under the film.

The times follow FILMS.gameplay and MONEY in web/src/lab/poster.tsx.

    python3 beat.py
"""

import os
import subprocess
import wave

import numpy as np

SR = 44100
LENGTH = 39.0
BPM = 124
CUTS = [2.4, 4.8, 8.6, 11.8, 16.4, 21, 24.6, 29, 33.4]
CASH = [6.2, 19.7, 22.4, 26.4]
# The hook's words slammed on screen (TU NAIS…, GNAMBRO, TON BUT :, DEBOUT).
HITS = [0.15, 0.9, 2.55, 3.2]

beat = 60 / BPM
n = int(SR * LENGTH)
mix = np.zeros(n)
rng = np.random.default_rng(225)


def at(t, sound, gain=1.0):
    i = int(t * SR)
    if i >= n:
        return
    j = min(n, i + len(sound))
    mix[i:j] += sound[: j - i] * gain


def env(d, attack=0.002, decay=0.1):
    t = np.arange(int(d * SR)) / SR
    return np.minimum(1, t / attack) * np.exp(-t / decay)


def kick():
    d = 0.35
    t = np.arange(int(d * SR)) / SR
    f = 50 + 110 * np.exp(-t / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(d, 0.001, 0.12)


def clap():
    d = 0.2
    noise = rng.uniform(-1, 1, int(d * SR))
    # A few quick bursts, like hands.
    e = sum(env(d, 0.001, 0.012 if k < 2 else 0.06) * (k * 0.011 * SR < np.arange(int(d * SR))) for k in range(3))
    return np.diff(noise, prepend=0) * e * 0.6


def shaker(accent):
    d = 0.06
    noise = rng.uniform(-1, 1, int(d * SR))
    return np.diff(np.diff(noise, prepend=0), prepend=0) * env(d, 0.003, 0.015) * (0.22 if accent else 0.12)


def pluck(freq, d=0.28, bright=1.0):
    t = np.arange(int(d * SR)) / SR
    tone = np.sin(2 * np.pi * freq * t) + 0.5 * bright * np.sin(4 * np.pi * freq * t) + 0.2 * bright * np.sin(6 * np.pi * freq * t)
    return tone * env(d, 0.002, d / 3.5)


def bass(freq, d):
    t = np.arange(int(d * SR)) / SR
    tone = np.tanh(2.2 * np.sin(2 * np.pi * freq * t))
    return tone * env(d, 0.004, d / 1.6)


def whoosh(d=0.45):
    noise = rng.uniform(-1, 1, int(d * SR))
    t = np.arange(len(noise)) / SR
    # A rising band of noise: smooth the noise less and less as it goes.
    out = np.zeros_like(noise)
    acc = 0.0
    for i, x in enumerate(noise):
        a = 0.02 + 0.5 * (t[i] / d) ** 2
        acc += a * (x - acc)
        out[i] = acc
    return out * np.sin(np.pi * t / d) ** 2 * 1.6


def impact():
    return kick() * 1.3 + np.concatenate([clap(), np.zeros(int(0.15 * SR))])[: int(0.35 * SR)] * 0.8


def cash():
    # The register's bell, then the coins.
    ding = pluck(2093, 0.5, 0.3) * 0.5 + pluck(2637, 0.5, 0.3) * 0.4
    coins = np.zeros(int(0.5 * SR))
    for k in range(7):
        c = pluck(3000 + rng.uniform(0, 1800), 0.08, 0.2) * 0.25
        i = int((0.06 + k * 0.035) * SR)
        coins[i : i + len(c)] += c[: len(coins) - i]
    return ding + coins


# The groove: from the first cut to the outro's end (the hook has just its hits and a pad).
A, C, D, E, G = 220.0, 261.63, 293.66, 329.63, 392.0
LEAD = [E, G, A * 2, G, E, D, E, 0, C, D, E, G, E, D, C, 0]
BASS = [A / 2, A / 2, C / 2, C / 2, D / 2, D / 2, G / 4, G / 4]
start = 2.4
step = beat / 4
s = 0
t = start
while t < LENGTH - 0.3:
    pos = s % 16
    if pos in (0, 8) or (pos == 14 and (s // 16) % 2):
        at(t, kick(), 0.9)
    if pos in (4, 12):
        at(t, clap(), 0.8)
    at(t, shaker(pos % 4 == 2), 1.0)
    if pos % 2 == 0:
        f = BASS[(s // 8) % len(BASS)]
        if pos in (0, 6, 10):
            at(t, bass(f, step * 3), 0.35)
    # The lead (a guitar-like pluck, the coupé-décalé's) from the first step on, every 16th note.
    if t >= 4.8:
        f = LEAD[(s + (s // 32) * 2) % len(LEAD)]
        if f:
            at(t, pluck(f * 2, 0.22), 0.16)
            at(t + 0.004, pluck(f * 3, 0.18, 0.5), 0.05)
    s += 1
    t = start + s * step

# The hook: a low drone and the hits.
tt = np.arange(int(2.4 * SR)) / SR
at(0, (np.sin(2 * np.pi * 55 * tt) * 0.25 + np.sin(2 * np.pi * 110.5 * tt) * 0.08) * np.minimum(1, tt / 0.3))
for h in HITS:
    at(h, impact(), 0.9)
for c in CUTS:
    at(c - 0.3, whoosh(), 0.35)
    at(c, impact(), 0.5)
for c in CASH:
    at(c, cash(), 0.7)

# Fade out at the end, then normalise.
fade = int(2.0 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)
mix = np.tanh(mix * 1.2)
mix /= np.max(np.abs(mix)) / 0.89

here = os.path.dirname(os.path.abspath(__file__))
wav = os.path.join(here, 'out', 'son-gameplay.wav')
with wave.open(wav, 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
mp3 = os.path.join(here, 'out', 'son-gameplay.mp3')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-b:a', '160k', mp3], check=True)
os.remove(wav)
print('son →', mp3)
