# python3 sheet.py out.jpg dir idx,idx,...  -> a contact sheet of those frames (and the mean frame-to-frame change).
import sys, os
from PIL import Image, ImageChops, ImageStat
out, d, idx = sys.argv[1], sys.argv[2], [int(x) for x in sys.argv[3].split(',')]
w = 360
ims = [Image.open(f'{d}/{i:04d}.jpg').resize((w, 640)) for i in idx]
W = Image.new('RGB', (w * len(ims), 640))
for i, im in enumerate(ims):
    W.paste(im, (w * i, 0))
W.save(out, quality=85)
# Jumps: the biggest frame-to-frame differences (pops, cuts).
files = sorted(f for f in os.listdir(d) if f.endswith('.jpg'))
diffs = []
prev = None
for f in files:
    im = Image.open(f'{d}/{f}').resize((135, 240)).convert('L')
    if prev is not None:
        diffs.append((round(ImageStat.Stat(ImageChops.difference(im, prev)).mean[0], 1), f))
    prev = im
diffs.sort(reverse=True)
print('n', len(files), 'median', sorted(x[0] for x in diffs)[len(diffs) // 2] if diffs else 0, 'top', diffs[:6])
