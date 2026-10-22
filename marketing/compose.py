"""The top 20's frames put together (top20.mjs films them, then calls this): the hook (four flashes of
what's coming), each activity swiping up over the one before as on a phone's feed, each for as long as
Awa's line on it, the last one (the football) going on under the end card, and the overlay (the
countdown, Awa's words) over everything.

    python3 compose.py out/video-frames/top20/plan.json

plan.json: fps, length, swipe, frames (the takes' folder), out, teaser [[clip, frame], …] and slots
[{clip, from, to, start, speed}, …]: each activity's time in the film, the frame of its take it starts
on (SWIPE before `from`, as it comes up) and how fast its take goes by (1 as filmed).
"""

import json
import os
import sys

from PIL import Image

plan = json.load(open(sys.argv[1]))
FPS = plan['fps']
SWIPE = plan['swipe']
FRAMES = plan['frames']
SLOTS = plan['slots']
W, H = 1080, 1920
TOTAL = round(plan['length'] * FPS)
HOOK = SLOTS[0]['from']
SNIP = round(HOOK * FPS / len(plan['teaser']))
os.makedirs(plan['out'], exist_ok=True)

cache = {}


def frame(clip, i):
    """Frame i of an activity's take (its last one if asked past it)."""
    d = os.path.join(FRAMES, clip)
    n = cache.setdefault(clip, len([f for f in os.listdir(d) if f.endswith('.jpg')]))
    i = max(0, min(n - 1, i))
    return Image.open(os.path.join(d, f'{i:05d}.jpg')).convert('RGB').resize((W, H))


def ease(k):
    return k * k * (3 - 2 * k)


def hook(i):
    """The hook: the teaser's flashes, a white flash on each cut."""
    k = min(len(plan['teaser']) - 1, i // SNIP)
    clip, start = plan['teaser'][k]
    img = frame(clip, start + i - k * SNIP)
    flash = max(0.0, 0.7 * (1 - (i - k * SNIP) / 4))
    if flash > 0:
        img = Image.blend(img, Image.new('RGB', (W, H), 'white'), flash)
    return img


def segment(t):
    """What's on at t: -1 the hook, then each activity (the last one going on under the end card)."""
    k = -1
    for j, s in enumerate(SLOTS):
        if t >= s['from']:
            k = j
    return k


def picture(k, i, t):
    """Activity k's picture at frame i (time t)."""
    if k < 0:
        return hook(i)
    s = SLOTS[k]
    return frame(s['clip'], s['start'] + round((t - (s['from'] - SWIPE)) * FPS * s.get('speed', 1)))


for i in range(TOTAL):
    t = i / FPS
    k = segment(t)
    img = picture(k, i, t)
    # The next activity coming up from the bottom over the last SWIPE of this one.
    nxt = k + 1
    if nxt < len(SLOTS):
        turn = SLOTS[nxt]['from']
        if turn - SWIPE <= t < turn:
            p = ease((t - (turn - SWIPE)) / SWIPE)
            both = Image.new('RGB', (W, H))
            both.paste(img, (0, -round(p * H)))
            both.paste(picture(nxt, i, t), (0, H - round(p * H)))
            img = both
    over = os.path.join(FRAMES, 'overlay', f'{i:05d}.png')
    if os.path.exists(over):
        o = Image.open(over).convert('RGBA').resize((W, H))
        img = img.convert('RGBA')
        img.alpha_composite(o)
        img = img.convert('RGB')
    img.save(os.path.join(plan['out'], f'{i:05d}.jpg'), quality=93)
    if i % 150 == 0:
        print(f'composed {i}/{TOTAL}', flush=True)
print('composed', TOTAL, 'frames →', plan['out'])
