# popcheck.py a.jpg b.jpg x0 y0 x1 y1: mean absolute difference of two frames inside a box (0..255).
import sys
from PIL import Image, ImageChops, ImageStat
a, b = Image.open(sys.argv[1]).convert('L'), Image.open(sys.argv[2]).convert('L')
box = tuple(int(v) for v in sys.argv[3:7])
print(round(ImageStat.Stat(ImageChops.difference(a.crop(box), b.crop(box))).mean[0], 2))
