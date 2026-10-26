"""« Keke contre Awa »'s frames put together (jeux.mjs films them, then calls this): each slot from its
take (a short slide-in at each cut, as on a phone's feed), the overlay (captions, the duel's score,
the stickers, the end card) over everything.

    python3 jeux_compose.py out/video-frames/jeux/plan.json
"""

import json
import os
import sys

from PIL import Image

plan = json.load(open(sys.argv[1]))
FPS = plan['fps']
FRAMES = plan['frames']
W, H = 1080, 1920
TOTAL = round(plan['length'] * FPS)
SLIDE = 0.25
os.makedirs(plan['out'], exist_ok=True)
cache = {}


def frame(clip, i):
    """Frame i of a take (its last one if asked past it)."""
    d = os.path.join(FRAMES, clip)
    n = cache.setdefault(clip, len([f for f in os.listdir(d) if f.endswith('.jpg')]))
    if n == 0:
        return Image.new('RGB', (W, H), (15, 18, 48))
    i = max(0, min(n - 1, i))
    return Image.open(os.path.join(d, f'{i:05d}.jpg')).convert('RGB').resize((W, H))


slots = plan['slots']
over = os.path.join(FRAMES, 'overlay')
for f in range(TOTAL):
    t = f / FPS
    k = next(i for i, s in enumerate(slots) if s['from'] <= t < s['to'] or i == len(slots) - 1)
    s = slots[k]
    img = frame(s['clip'], s['start'] + round((t - s['from']) * FPS))
    # A cut to another take slides it up over the one before, for a quarter of a second.
    since = t - s['from']
    if k > 0 and since < SLIDE and slots[k - 1]['clip'] != s['clip']:
        p = slots[k - 1]
        before = frame(p['clip'], p['start'] + round((t - p['from']) * FPS))
        e = since / SLIDE
        y = round(H * (1 - (1 - (1 - e) ** 3)))
        before.paste(img, (0, y))
        img = before
    o = os.path.join(over, f'{f:05d}.png')
    if os.path.exists(o):
        ov = Image.open(o).convert('RGBA').resize((W, H))
        img = img.convert('RGBA')
        img.alpha_composite(ov)
        img = img.convert('RGB')
    img.save(os.path.join(plan['out'], f'{f:05d}.jpg'), quality=92)
    if f % 150 == 0:
        print(f'composed {f}/{TOTAL}', flush=True)
