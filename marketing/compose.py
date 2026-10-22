"""The top 10's frames put together (top10.mjs films them, then calls this): the hook (four flashes of
what's coming), each activity swiping up over the one before as on a phone's feed, the last one (the
football) going on under the end card, and the overlay (the countdown, Awa's words) over everything.

    python3 compose.py out/video-frames/top10/plan.json
"""

import json
import os
import sys

from PIL import Image

plan = json.load(open(sys.argv[1]))
FPS = plan['fps']
HOOK, EACH, SWIPE = plan['hook'], plan['each'], plan['swipe']
FRAMES = plan['frames']
CLIPS = plan['clips']
W, H = 1080, 1920
TOTAL = round(plan['length'] * FPS)
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
    """What's on at t: -1 the hook, 0–9 the activities (the last one going on under the end card)."""
    if t < HOOK:
        return -1
    return min(len(CLIPS) - 1, int((t - HOOK) / EACH))


def picture(k, i, t):
    """Segment k's picture at frame i (time t)."""
    if k < 0:
        return hook(i)
    start = HOOK + k * EACH - SWIPE
    return frame(CLIPS[k], round((t - start) * FPS))


for i in range(TOTAL):
    t = i / FPS
    k = segment(t)
    img = picture(k, i, t)
    # The next activity coming up from the bottom over the last SWIPE of this one.
    nxt = k + 1
    turn = HOOK + nxt * EACH
    if nxt < len(CLIPS) and turn - SWIPE <= t < turn:
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
