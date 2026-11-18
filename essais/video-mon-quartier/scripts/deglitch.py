# deglitch.py dir: single-frame flickers (a shadow map missing for one frame) replaced by the blend of their
# neighbours: frame i differs a lot from both i-1 and i+1 while i-1 and i+1 are close. In place; lists what it fixed.
import os, sys
from PIL import Image, ImageChops, ImageStat
d = sys.argv[1]
thr = float(sys.argv[2]) if len(sys.argv) > 2 else 6
files = sorted(f for f in os.listdir(d) if f.endswith('.jpg'))
small = {f: Image.open(f'{d}/{f}').resize((135, 240)).convert('L') for f in files}
diff = lambda a, b: ImageStat.Stat(ImageChops.difference(small[a], small[b])).mean[0]
fixed = []
for k in range(1, len(files) - 1):
    a, b, c = files[k - 1], files[k], files[k + 1]
    ab, bc, ac = diff(a, b), diff(b, c), diff(a, c)
    if ab > thr and bc > thr and ac < 0.5 * min(ab, bc):
        im = Image.blend(Image.open(f'{d}/{a}').convert('RGB'), Image.open(f'{d}/{c}').convert('RGB'), 0.5)
        im.save(f'{d}/{b}', quality=93)
        small[b] = im.resize((135, 240)).convert('L')
        fixed.append((b, round(ab, 1), round(bc, 1), round(ac, 1)))
print('fixed', fixed)
