"""« Les histoires se racontent » (FILM=histoires): the film's sound.

Awa's lines (out/voix-histoires/<id>.mp3, made by histoires-voix.mjs) and, between them,
excerpts of four prologues as the game reads them (web/public/audio/histoires/), one after
the other: out/voix-histoires.mp3. Under it, a soft groove made here (no sample): a warm
pad, a balafon-like pluck, a light kick and shaker, which drops to a low, dark drone while a
story is told, with a whoosh on every cut: out/son-histoires.mp3. video.mjs mixes the two.

Prints the times of every piece: FILMS.histoires in web/src/lab/poster.tsx follows them.

    python3 histoires-son.py
"""

import json
import os
import subprocess

import numpy as np

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
STORIES = os.path.join(HERE, '..', 'web', 'public', 'audio', 'histoires')

# In order: Awa's line, or a story and the seconds of its prologue kept (cut on the words' pauses).
PLAN = [
    ('hello',),
    ('quartier',),
    ('ecouter',),
    ('cour-hantee', 7.9, 13.75),  # « Il se passe des choses la nuit… que personne ne veut louer. »
    ('rire',),
    ('dent-de-man', 0.0, 7.45),  # « Boris se dit coach sportif… depuis des années ! »
    ('coeur',),
    ('kone-petit-fils', 8.6, 15.4),  # « Son petit-fils… à la hauteur. »
    ('mystere',),
    ('maquis-maudit', 8.95, 13.95),  # « Un mot circule… un sort au maquis. »
    ('choix',),
    ('voyage',),
    ('djai',),
    ('laquelle',),
]
GAP, AROUND_STORY, OUTRO = 0.25, 0.45, 6.0


def load(path, start=0.0, end=None):
    args = ['ffmpeg', '-loglevel', 'error', '-ss', str(start)] + (['-to', str(end)] if end else []) + ['-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-']
    a = np.frombuffer(subprocess.run(args, capture_output=True, check=True).stdout, dtype=np.float32).copy()
    # Short fades, so a cut never clicks.
    f = min(len(a) // 4, int(0.03 * SR))
    a[:f] *= np.linspace(0, 1, f)
    a[-f:] *= np.linspace(1, 0, f)
    return a


pieces, t = [], 0.0
for p in PLAN:
    story = len(p) == 3
    if story:
        t += AROUND_STORY - GAP
        a = load(os.path.join(STORIES, f'{p[0]}.mp3'), p[1], p[2]) * 0.95
    else:
        a = load(os.path.join(OUT, 'voix-histoires', f'{p[0]}.mp3'))
    pieces.append({'id': p[0], 'story': story, 'from': round(t, 2), 'to': round(t + len(a) / SR, 2), 'audio': a})
    t += len(a) / SR + (AROUND_STORY if story else GAP)
outro = round(t + 0.2, 2)
length = round(outro + OUTRO, 2)

voice = np.zeros(int(length * SR) + SR, dtype=np.float32)
for p in pieces:
    i = int(p['from'] * SR)
    voice[i : i + len(p['audio'])] += p['audio']

# ---- The bed ----
n = len(voice)
T = np.arange(n) / SR
rng = np.random.default_rng(7)
BPM = 104
beat = 60 / BPM


def env(d, attack=0.004, decay=0.2):
    k = np.arange(int(d * SR)) / SR
    return np.minimum(1, k / attack) * np.exp(-k / decay)


def put(dst, at, s, gain=1.0):
    i = int(at * SR)
    if i >= len(dst):
        return
    s = s[: len(dst) - i]
    dst[i : i + len(s)] += s * gain


groove = np.zeros(n, dtype=np.float32)
dark = np.zeros(n, dtype=np.float32)
# A minor progression, one chord a bar: Am, F, C, G.
CHORDS = [[220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [196.0, 261.63, 329.63], [196.0, 246.94, 293.66]]
bar = 4 * beat
for b in range(int(length / bar) + 1):
    t0 = b * bar
    chord = CHORDS[b % 4]
    k = np.arange(int(bar * SR)) / SR
    pad = sum(np.sin(2 * np.pi * f * k) + 0.3 * np.sin(2 * np.pi * 2.003 * f * k) for f in chord) / 3
    put(groove, t0, pad * np.minimum(1, k / 0.4) * np.minimum(1, (bar - k) / 0.3), 0.16)
    for s in range(8):
        at = t0 + s * beat / 2
        # The kick on 1 and 3, the shaker on every eighth.
        if s in (0, 4):
            kk = np.arange(int(0.25 * SR)) / SR
            put(groove, at, np.sin(2 * np.pi * (50 + 70 * np.exp(-kk * 30)) * kk) * np.exp(-kk * 12), 0.5)
        sh = rng.standard_normal(int(0.05 * SR)) * env(0.05, 0.002, 0.012)
        put(groove, at, np.diff(sh, prepend=0), 0.10 if s % 2 else 0.05)
        # The balafon: a note of the chord on some eighths.
        if s in (0, 3, 5, 6):
            f = chord[(s + b) % 3] * 2
            kk = np.arange(int(0.35 * SR)) / SR
            put(groove, at, (np.sin(2 * np.pi * f * kk) + 0.4 * np.sin(2 * np.pi * 3.9 * f * kk) * np.exp(-kk * 40)) * np.exp(-kk * 9), 0.13)
# The stories' drone: low A and its fifth, beating slowly, a wind on top.
dark += (np.sin(2 * np.pi * 55 * T) + 0.6 * np.sin(2 * np.pi * 82.6 * T) + 0.4 * np.sin(2 * np.pi * 110.4 * T)) * 0.12
wind = np.convolve(rng.standard_normal(n), np.ones(60) / 60, mode='same')
dark += wind * (0.5 + 0.5 * np.sin(2 * np.pi * 0.15 * T)) * 0.25


# How much of each: the groove under Awa, the drone under a story (smooth turns).
def ramp(at_list, d=0.5):
    m = np.zeros(n, dtype=np.float32)
    for a, b in at_list:
        m[int(a * SR) : int(b * SR)] = 1
    k = int(d * SR)
    return np.convolve(m, np.ones(k) / k, mode='same')


in_story = ramp([(p['from'] - 0.3, p['to'] + 0.2) for p in pieces if p['story']])
bed = groove * (1 - in_story) + dark * in_story
# The end card: the groove a little louder, then out.
bed *= 1 + 0.5 * ramp([(outro, length)])
bed *= np.clip((length - T) / 1.5, 0, 1)
# A whoosh on every cut.
for p in pieces[1:]:
    d = 0.5
    w = rng.standard_normal(int(d * SR))
    w = np.convolve(w, np.ones(8) / 8, mode='same') * np.sin(np.pi * np.arange(len(w)) / len(w)) ** 2
    put(bed, p['from'] - d * 0.7, w, 0.35)
put(bed, outro, rng.standard_normal(int(0.5 * SR)) * env(0.5, 0.01, 0.12), 0.4)


def write(a, name):
    a = a / max(1e-6, np.abs(a).max()) * 0.95
    path = os.path.join(OUT, name)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-t', str(length), '-c:a', 'libmp3lame', '-b:a', '192k', path], input=a.astype(np.float32).tobytes(), check=True)
    return path


write(voice, 'voix-histoires.mp3')
# The bed comes out at full scale: video.mjs puts it at 0.32 under the voice, so here it is set a little louder.
write(bed, 'son-histoires.mp3')
print(json.dumps({'pieces': [{k: v for k, v in p.items() if k != 'audio'} for p in pieces], 'outro': outro, 'length': length}, indent=1))
