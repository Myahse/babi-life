# Align the faces of an expression sheet to a head's unwrapped face cell (256 px) with a 3-point affine.
import sys, json
import numpy as np
from PIL import Image
name, lx, ly, rx, ry, mx, my, cw, chh = sys.argv[1], *map(float, sys.argv[2:10])
tb = [int(v) for v in sys.argv[10].split(',')]  # template box in the neutral cell: x0,y0,x1,y1 (rigid part: hairline)
lm = json.load(open(f't5/lm_{name}.json'))
im = Image.open(f'v5/{name}_sheet.png').convert('RGB'); g = np.asarray(im.convert('L'), dtype=np.float32)
tpl = g[tb[1]:tb[3], tb[0]:tb[2]]
names = ['neutral', 'smile', 'laugh', 'sad', 'surprised', 'closed']; out = {}
dst = np.array([[lm['l'][0], lm['l'][1], 1], [lm['r'][0], lm['r'][1], 1], [lm['m'][0], lm['m'][1], 1]])
for i, n in enumerate(names):
    ox, oy = (i % 3) * cw, (i // 3) * chh; best = (1e18, 0, 0)
    if i:
        for dy in range(-18, 19):
            for dx in range(-18, 19):
                x0, y0 = int(tb[0] + ox + dx), int(tb[1] + oy + dy); w = g[y0:y0 + tpl.shape[0], x0:x0 + tpl.shape[1]]
                if w.shape != tpl.shape: continue
                s = float(np.abs(w - tpl).mean())
                if s < best[0]: best = (s, dx, dy)
    ox += best[1]; oy += best[2]; out[n] = (ox, oy, round(best[0], 1) if i else 0)
    src = np.array([[lx + ox, ly + oy], [rx + ox, ry + oy], [mx + ox, my + oy]])
    cx = np.linalg.solve(dst, src[:, 0]); cy = np.linalg.solve(dst, src[:, 1])
    im.transform((256, 256), Image.AFFINE, (cx[0], cx[1], cx[2], cy[0], cy[1], cy[2]), resample=Image.BICUBIC).save(f'lab/v5/{name}_{n}.png')
print(out)
