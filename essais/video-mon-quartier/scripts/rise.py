# rise.py src_dir dst_dir pop n_rise x0 y0 x1 y1: the building that appears at frame `pop` (the camera held still
# round it) comes up out of the ground over n_rise frames instead of popping in. Its pixels are those that changed
# from pop-1 to pop inside the box; while it rises, what was there before (pop-1) shows round it and it is cut at
# its own foot, with a little dust there. Every other frame is copied as is.
import os, sys, shutil
import numpy as np
from PIL import Image, ImageFilter

src, dst, pop, n = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
x0, y0, x1, y1 = (int(v) for v in sys.argv[5:9])
os.makedirs(dst, exist_ok=True)
frames = sorted(f for f in os.listdir(src) if f.endswith('.jpg'))
P = lambda i: f'{src}/{i:04d}.jpg'
before = np.asarray(Image.open(P(pop - 1)).convert('RGB')).astype(np.float32)
after = np.asarray(Image.open(P(pop)).convert('RGB')).astype(np.float32)
diff = np.abs(after - before).max(axis=2)
# The building's own shadow on the ground (the same colour, only darker) doesn't rise: it darkens in place.
ratio = (after + 4) / (before + 4)
shade = (ratio.max(axis=2) < 0.93) & (ratio.max(axis=2) - ratio.min(axis=2) < 0.12) & (before.mean(axis=2) > 60)
m = np.zeros(diff.shape, np.uint8)
m[y0:y1, x0:x1] = ((diff[y0:y1, x0:x1] > 22) & ~shade[y0:y1, x0:x1]) * 255
sh = np.zeros(diff.shape, np.float32)
sh[y0:y1, x0:x1] = shade[y0:y1, x0:x1]
sh = np.asarray(Image.fromarray((sh * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))).astype(np.float32) / 255
# The building: what changed (not its shadow), closed, its holes filled, its biggest piece only; the shade-like
# pixels inside it (walls the colour of the sand) are the building's.
from scipy import ndimage
bm = ndimage.binary_closing(m > 0, structure=np.ones((15, 15)))
bm = ndimage.binary_fill_holes(bm)
lab, nl = ndimage.label(bm)
if nl > 1:
    sizes = ndimage.sum(bm, lab, range(1, nl + 1))
    bm = np.isin(lab, [i + 1 for i, v in enumerate(sizes) if v > 0.05 * sizes.max()])
bm = ndimage.binary_dilation(bm, iterations=2)
mask = np.asarray(Image.fromarray((bm * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32) / 255
sh = sh * (1 - mask)
ys = np.where(mask.max(axis=1) > 0.5)[0]
top, foot = int(ys.min()), int(ys.max())
hgt = foot - top
print('mask rows', top, foot, 'area', int((mask > 0.5).sum()))
rng = np.random.default_rng(7)
cols = np.where(mask[foot - 6:foot + 1].max(axis=0) > 0.5)[0]
puffs = [(int(rng.choice(cols)), foot - int(rng.integers(0, 14)), float(rng.uniform(18, 46)), float(rng.uniform(0, 1))) for _ in range(28)] if len(cols) else []


def ease(x):
    x = min(1.0, max(0.0, x))
    return 1 - (1 - x) ** 3


for f in frames:
    i = int(f[:4])
    if not (pop <= i < pop + n):
        shutil.copyfile(f'{src}/{f}', f'{dst}/{f}')
        continue
    k = (i - pop) / n
    d = int(round((1 - ease(k)) * hgt * 1.02))
    cur = np.asarray(Image.open(P(i)).convert('RGB')).astype(np.float32)
    out = cur * (1 - mask[..., None]) + before * mask[..., None]
    out = out * (1 - (1 - ease(k)) * sh[..., None]) + before * (1 - ease(k)) * sh[..., None]
    # The building, its mask moved down by d, cut at its foot.
    sm = np.zeros_like(mask)
    sb = np.zeros_like(cur)
    if d < hgt:
        sm[d:] = mask[:-d] if d else mask
        sb[d:] = cur[:-d] if d else cur
        sm[foot + 1:] = 0
        out = sb * sm[..., None] + out * (1 - sm[..., None])
    im = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).convert('RGBA')
    # Dust at the foot, thickest while it comes up, gone by the end.
    a = max(0.0, 1 - k * 1.15)
    if a > 0 and puffs:
        ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
        px = ov.load()
        from PIL import ImageDraw
        dr = ImageDraw.Draw(ov)
        for (cx, cy, r, ph) in puffs:
            rr = r * (0.8 + 0.9 * k) * (0.8 + 0.4 * ph)
            yy = cy - 30 * k * (0.5 + ph)
            dr.ellipse([cx - rr, yy - rr * 0.7, cx + rr, yy + rr * 0.7], fill=(222, 196, 160, int(150 * a * (0.5 + 0.5 * ph))))
        ov = ov.filter(ImageFilter.GaussianBlur(6))
        im.alpha_composite(ov)
    im.convert('RGB').save(f'{dst}/{f}', quality=93)
print('ok', dst)
