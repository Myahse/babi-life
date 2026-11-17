p = '/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/vmq/compose.py'
s = open(p).read()
s = s.replace("""for si, s in enumerate(edl['segments']):
    d = F + s['dir']""", """def ease(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


for si, s in enumerate(edl['segments']):
    if 'still' in s:
        # A still with a slow push-in (Ken Burns): zoom z0 -> z1 round (cx, cy) (fractions of the image), taps
        # [[frame, x, y]] drawn as rings (x, y fractions).
        for i in range(s['n']):
            k = ease(i / max(1, s['n'] - 1))
            z = s.get('z0', 1.0) + (s.get('z1', 1.08) - s.get('z0', 1.0)) * k
            tap = None
            for f0, tx, ty in s.get('taps', []):
                if 0 <= i - f0 <= 12:
                    tap = (tx, ty, i - f0)
            src = s['still'] if s['still'].startswith('/') else F + s['still']
            seq.append((src, s.get('mode', 'full'), si, {'z': z, 'cx': s.get('cx', 0.5), 'cy': s.get('cy', 0.5), 'tap': tap}))
        continue
    d = F + s['dir']""")
s = s.replace("seq.append((f'{d}/{idx:04d}.jpg', s.get('mode', 'full'), si))", "seq.append((f'{d}/{idx:04d}.jpg', s.get('mode', 'full'), si, None))")
s = s.replace("seq.append((f'{d}/{a + n - 1:04d}.jpg', s.get('mode', 'full'), si))", "seq.append((f'{d}/{a + n - 1:04d}.jpg', s.get('mode', 'full'), si, None))")
s = s.replace("""for f, (path, mode, si) in enumerate(seq):
    im = Image.open(path).convert('RGB')
    if im.size != (W, H):""", """stills = {}
for f, (path, mode, si, ex) in enumerate(seq):
    if ex:
        if path not in stills:
            stills[path] = Image.open(path).convert('RGB')
        src = stills[path]
        sw, sh = src.size
        # The largest crop of the screen's shape, zoomed in by z, round (cx, cy).
        ch = min(sh, sw * H / W) / ex['z']
        cw = ch * W / H
        x0 = min(max(0, ex['cx'] * sw - cw / 2), sw - cw)
        y0 = min(max(0, ex['cy'] * sh - ch / 2), sh - ch)
        im = src.resize((W, H), Image.LANCZOS, box=(x0, y0, x0 + cw, y0 + ch))
        if ex['tap']:
            tx, ty, k = ex['tap']
            px, py = (tx * sw - x0) * W / cw, (ty * sh - y0) * H / ch
            r = (14 + k * 1.6) * 3
            a = int(255 * (1 - k / 13))
            ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            dr = ImageDraw.Draw(ov)
            dr.ellipse([px - r, py - r, px + r, py + r], fill=(255, 255, 255, int(a * 0.35)), outline=(255, 255, 255, a), width=9)
            im = Image.alpha_composite(im.convert('RGBA'), ov).convert('RGB')
    else:
        im = Image.open(path).convert('RGB')
    if im.size != (W, H):""")
open(p, 'w').write(s)
