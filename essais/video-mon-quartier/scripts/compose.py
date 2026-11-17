# Builds the picture from the captured frames (edl.json): segments in order (full screen, or the game's screen inset
# over its own blurred frame), the captions popping in and out, the end card; pipes it to ffmpeg (H.264, 30 fps).
# python3 compose.py edl.json out.mp4 [cover.jpg cover_frame]
import json, sys, subprocess, os
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw

W, H = 1080, 1920
edl = json.load(open(sys.argv[1]))
out = sys.argv[2]
V = os.path.dirname(os.path.abspath(sys.argv[1]))
F = V + '/frames/'
OV = V + '/ov/'

# The timeline of source frames.
seq = []  # (path, mode, seg index)
for si, s in enumerate(edl['segments']):
    d = F + s['dir']
    a = s.get('from', 0)
    n = s['n']
    hold = s.get('hold', 0)
    for i in range(n):
        idx = a + i
        if s.get('speed'):
            idx = a + int(i * s['speed'])
        seq.append((f'{d}/{idx:04d}.jpg', s.get('mode', 'full'), si))
    for i in range(hold):
        seq.append((f'{d}/{a + n - 1:04d}.jpg', s.get('mode', 'full'), si))
total = len(seq)
print('frames', total, 'seconds', total / 30)

mask = Image.open(OV + 'mask.png').split()[-1]
IW, IH = mask.size
IX, IY = (W - IW) // 2, 345
shadow = Image.new('L', (W, H), 0)
ImageDraw.Draw(shadow).rounded_rectangle([IX, IY + 14, IX + IW, IY + IH + 14], 44, fill=150)
shadow = shadow.filter(ImageFilter.GaussianBlur(26))


def inset(im):
    bg = im.resize((W // 6, H // 6), Image.BILINEAR).filter(ImageFilter.GaussianBlur(5)).resize((W, H), Image.BILINEAR)
    bg = ImageEnhance.Brightness(bg).enhance(0.5)
    bg.paste((0, 0, 0), (0, 0), shadow)
    small = im.resize((IW, IH), Image.LANCZOS)
    bg.paste(small, (IX, IY), mask)
    return bg


caps = []
cache = {}
for c in edl['captions']:
    im = Image.open(OV + c['png'] + '.png').convert('RGBA')
    bbox = im.getbbox()
    caps.append((int(round(c['t0'] * 30)), int(round(c['t1'] * 30)), im, bbox, c.get('pop', True)))


def ease_out_back(x):
    c1 = 1.5
    return 1 + (c1 + 1) * (x - 1) ** 3 + c1 * (x - 1) ** 2


def put_caption(frame, im, bbox, k_in, k_out, pop):
    a = min(1.0, k_in) * min(1.0, k_out)
    if a <= 0:
        return
    if pop and k_in < 1:
        s = 0.82 + 0.18 * ease_out_back(k_in)
    else:
        s = 1.0
    crop = im.crop(bbox)
    if s != 1.0:
        crop = crop.resize((max(1, int(crop.width * s)), max(1, int(crop.height * s))), Image.BILINEAR)
    if a < 1:
        al = crop.split()[-1].point(lambda v: int(v * a))
        crop.putalpha(al)
    cx = (bbox[0] + bbox[2]) / 2
    cy = (bbox[1] + bbox[3]) / 2
    frame.alpha_composite(crop, (int(cx - crop.width / 2), int(cy - crop.height / 2)))


cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', '30', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', out]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
fades = edl.get('fades', {})  # frame index -> length: a dissolve from the previous frames into this one
prev_frames = []
cover_at = int(sys.argv[4]) if len(sys.argv) > 4 else -1
for f, (path, mode, si) in enumerate(seq):
    im = Image.open(path).convert('RGB')
    if im.size != (W, H):
        im = im.resize((W, H), Image.LANCZOS)
    if mode == 'inset':
        im = inset(im)
    frame = im.convert('RGBA')
    # A dissolve at a segment start: from the last frame before it, held.
    if str(f) in fades and prev_frames:
        held = prev_frames[-1]
    for start, ln in fades.items():
        start = int(start)
        if start <= f < start + ln and prev_frames:
            k = (f - start + 1) / (ln + 1)
            frame = Image.blend(held, frame, k)
    base = frame.copy()
    for t0, t1, cim, bbox, pop in caps:
        if t0 <= f < t1:
            put_caption(frame, cim, bbox, (f - t0 + 1) / 7, (t1 - f) / 5, pop)
    rgb = frame.convert('RGB')
    if f == cover_at:
        rgb.save(sys.argv[3], quality=92)
    p.stdin.write(rgb.tobytes())
    prev_frames = [base]
    if f % 60 == 0:
        print('frame', f, flush=True)
p.stdin.close()
p.wait()
print('done', out)
