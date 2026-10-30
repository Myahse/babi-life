"""A video's sound: a coupé-décalé-style beat made here, with no sample, plus
a whoosh on every cut, a hit on every word slammed on screen, a cash register
on every money change (and for the trailer, the crowd at the goal). Writes
out/son-<film>.mp3, which video.mjs puts under the film (under Awa's voice,
when there is one).

The times follow FILMS.<film> (and MONEY for gameplay) in web/src/lab/poster.tsx.

    python3 beat.py               # gameplay
    FILM=top20 TIMES=out/video-frames/top20/plan.json python3 beat.py    # « 20 trucs à faire dans Babi Life »
"""

import json
import os
import subprocess
import wave

import numpy as np

SR = 44100
FILM = os.environ.get('FILM', 'gameplay')
BPM = 124
if FILM == 'top20':
    # The times of top20.mjs, measured on Awa's voice (its plan.json): the hook, the twenty
    # activities, the end card.
    plan = json.load(open(os.environ['TIMES']))
    BPM = 128
    LENGTH = plan['length']
    CUTS = [s['from'] for s in plan['slots']] + [plan['outro']]
    hook = plan['slots'][0]['from']
    # The hook's flashes.
    TICKS = [hook * k / 4 for k in (1, 2, 3)]
    # TU T'ENNUIES ?, 20 TRUCS, À FAIRE…; the basket (N°2) and the goal (N°1), as they land.
    HITS = [0.15, 0.75, 1.3] + plan['payoffs']
    CASH = []
    CROWD = plan['payoffs'][-1:]
    GROOVE, LEAD_FROM = hook, plan['slots'][1]['from']
elif FILM == 'sortie-officielle':
    # « Babi Life est sorti ! » (vie.mjs FILM=sortie): its takes on Awa's voice (55.95 s), the end card.
    BPM = 122
    takes = [3.4, 2.5, 1.1, 3.5, 1.9, 3.1, 5.0, 1.8, 1.4, 4.8, 5.7, 3.7, 3.1, 2.9, 2.2, 2.3, 2.7, 6.0]
    CUTS = [round(sum(takes[:i]), 2) for i in range(1, len(takes))]
    LENGTH = round(sum(takes), 2)
    TICKS = []
    # C'EST SORTI !, then the two numbers slammed on the city.
    HITS = [0.3, 1.2, CUTS[12] + 0.1, CUTS[13] + 0.1]
    # Waye; the drawer's gift opened.
    CASH = [CUTS[10] + 1.6, CUTS[15] + 1.4]
    # The Gbê in the net (the foot's take), the players all there.
    CROWD = [CUTS[8] + 3.5, CUTS[11] + 0.4]
    GROOVE, LEAD_FROM = 0.0, 0.0
elif FILM == 'vie':
    # « Ta vie dans Babi Life » (vie.mjs): its takes on Awa's voice (out/voix-vie.mp3, 51 s), the end card (5.9 s).
    BPM = 116
    takes = [3.2, 4.4, 4.2, 4.4, 3.6, 2.4, 2.4, 4.2, 4.0, 6.0, 1.6, 3.2, 0.8, 1.2, 5.9]
    CUTS = [round(sum(takes[:i]), 2) for i in range(1, len(takes))]
    LENGTH = round(sum(takes), 2)
    TICKS = []
    # The title, then « 3 ans ! » slammed on.
    HITS = [0.4, CUTS[5] + 1.0]
    # « Tu paies une fois ».
    CASH = [CUTS[8] + 5.2]
    # The Gbê in the net.
    CROWD = [CUTS[9] + 0.5]
    GROOVE, LEAD_FROM = 0.0, CUTS[4]
elif FILM == 'bebe':
    # « Tout ce que ton bébé peut faire » (FILMS.bebe): a gentler groove, the cuts, and the
    # baby's real laughs, cries and babble (web/public/audio/bebe/) where the film shows them.
    BPM = 112
    LENGTH = 78.5
    CUTS = [4.24, 10.96, 18, 24, 27.4, 30.4, 33.16, 34.88, 39, 46.24, 52.48, 57.24, 62.72, 66.16, 72.44]
    TICKS = []
    HITS = [0.8, 1.3, 1.8]
    CASH = []
    CROWD = []
    GROOVE, LEAD_FROM = 4.24, 4.24
else:
    LENGTH = 39.0
    CUTS = [2.4, 4.8, 8.6, 11.8, 16.4, 21, 24.6, 29, 33.4]
    TICKS = []
    # The hook's words slammed on screen (TU NAIS…, GNAMBRO, TON BUT :, DEBOUT).
    HITS = [0.15, 0.9, 2.55, 3.2]
    CASH = [6.2, 19.7, 22.4, 26.4]
    CROWD = []
    GROOVE, LEAD_FROM = 2.4, 4.8

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


def crowd(d=2.4):
    # A stadium roaring: noise, smoothed to a roar, swelling then dying down.
    noise = rng.uniform(-1, 1, int(d * SR))
    out = np.zeros_like(noise)
    acc = 0.0
    for i, x in enumerate(noise):
        acc += 0.08 * (x - acc)
        out[i] = acc
    t = np.arange(len(out)) / SR
    return out * np.minimum(1, t / 0.15) * np.exp(-np.maximum(0, t - 0.6) / 0.8) * 3


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
start = GROOVE
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
    if t >= LEAD_FROM:
        f = LEAD[(s + (s // 32) * 2) % len(LEAD)]
        if f:
            at(t, pluck(f * 2, 0.22), 0.16)
            at(t + 0.004, pluck(f * 3, 0.18, 0.5), 0.05)
    s += 1
    t = start + s * step

# The hook: a low drone and the hits.
tt = np.arange(int(GROOVE * SR)) / SR
at(0, (np.sin(2 * np.pi * 55 * tt) * 0.25 + np.sin(2 * np.pi * 110.5 * tt) * 0.08) * np.minimum(1, tt / 0.3))
for h in HITS:
    at(h, impact(), 0.9)
for c in CUTS:
    at(c - 0.3, whoosh(), 0.35)
    at(c, impact(), 0.5)
for c in TICKS:
    at(c, impact(), 0.3)
for c in CASH:
    at(c, cash(), 0.7)
for c in CROWD:
    at(c, crowd(), 0.6)

# The baby's voice, recorded (CC0, web/public/audio/bebe/SOURCES.md), over the groove.
BABY = [(10.7, 'rire-2')] if FILM == 'sortie-officielle' else [(1.0, 'rire-1'), (4.6, 'gazouille-1'), (14.9, 'pleurs-1'), (17.6, 'rire-2'), (20.4, 'rire-3')] if FILM == 'vie' else [(8.0, 'rire-1'), (13.2, 'pleurs-1'), (15.5, 'pleurs-2'), (21.5, 'rire-2'), (25.4, 'rire-1'), (26.6, 'rire-3'), (28.6, 'gazouille-1'),
        (31.8, 'rire-2'), (37.0, 'pleurs-3'), (42.0, 'gazouille-3'), (49.6, 'rire-3'), (54.0, 'gazouille-4'),
        (59.0, 'gazouille-5'), (61.4, 'rire-1'), (64.4, 'gazouille-6'), (68.0, 'gazouille-7')]
if FILM in ('bebe', 'vie', 'sortie-officielle'):
    clips = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'public', 'audio', 'bebe')
    for t, name in BABY:
        raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', os.path.join(clips, name + '.mp3'), '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], check=True, capture_output=True).stdout
        clip = np.frombuffer(raw, dtype='<f4').astype(float)[: int(3.2 * SR)]
        # A short fade at its end, so a long piece never cuts off sharp.
        f = min(len(clip), int(0.3 * SR))
        clip[-f:] *= np.linspace(1, 0, f)
        # The groove steps back while the baby is heard.
        i, j = int(t * SR), min(n, int(t * SR) + len(clip))
        mix[i:j] *= 0.45
        at(t, clip / max(1e-6, np.max(np.abs(clip))), 1.1)

# Fade out at the end, then normalise.
fade = int(2.0 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)
mix = np.tanh(mix * 1.2)
mix /= np.max(np.abs(mix)) / 0.89

here = os.path.dirname(os.path.abspath(__file__))
wav = os.path.join(here, 'out', f'son-{FILM}.wav')
with wave.open(wav, 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
mp3 = os.path.join(here, 'out', f'son-{FILM}.mp3')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-b:a', '160k', mp3], check=True)
os.remove(wav)
print('son →', mp3)
