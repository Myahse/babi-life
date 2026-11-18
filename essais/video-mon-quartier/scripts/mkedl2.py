# mkedl2.py: writes edl2.json (long cut) and edl2s.json (short cut) and their voice plans from one shot list, captions
# and voice placed relative to the start of their shot (so a shot's length can change without redoing the times).
import json
V = '/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/vmq/'
BV = '/tmp/claude-0/land/mon-quartier-univers/babi-ville.png'

# id: segment
SEG = {
    'A': {'dir': 's1', 'n': 126, 'speed': 0.857},
    'B': {'dir': 's2a', 'n': 84, 'hold': 12, 'mode': 'inset'},
    'C': {'dir': 's4v', 'from': 20, 'n': 78, 'mode': 'inset'},
    'D': {'dir': 's4r', 'from': 14, 'n': 100},
    'E': {'dir': 's4g', 'n': 84, 'mode': 'inset'},
    'F': {'dir': 's5m', 'n': 96},
    'G': {'dir': 's5e', 'n': 90},
    'H': {'dir': 'sRg', 'n': 48},
    'I': {'dir': 's6m', 'from': 8, 'n': 126, 'mode': 'inset'},
    'J1': {'dir': 's7k', 'n': 9, 'mode': 'inset'},
    'J2': {'dir': 's7k', 'from': 14, 'n': 52, 'mode': 'inset'},
    'K': {'dir': 's6a', 'from': 4, 'n': 32, 'mode': 'inset'},
    'L': {'dir': 's7', 'n': 62},
    'M': {'still': BV, 'n': 54, 'z0': 1.0, 'z1': 1.05, 'cx': 0.5, 'cy': 0.42, 'taps': [[14, 0.272, 0.414]], 'mode': 'inset'},
    'N1': {'dir': 'sRl', 'n': 48},
    'N2': {'dir': 's4r', 'from': 108, 'n': 33},
    'O': {'still': 's1/0107.jpg', 'n': 360, 'z0': 1.0, 'z1': 1.1, 'cx': 0.5, 'cy': 0.6},
}
# (shot, t0 from its start, t1 from its start (None: its end), png, pop)
CAP = [
    ('A', 0.15, None, 'n-new', True), ('A', 0.3, 1.95, 'n1a', True), ('A', 2.0, None, 'n1b', True),
    ('B', 0.25, None, 'n2', True),
    ('C', 0.1, None, 'n3a', True), ('D', 0.15, 3.2, 'n3b', True),
    ('E', 0.15, None, 'n4', True),
    ('F', 0.2, None, 'n5a', True), ('G', 0.2, 2.6, 'n5b', True),
    ('H', 0.1, None, 'k-gbaka', True),
    ('I', 0.1, 2.5, 'n6a', True), ('I', 2.55, None, 'n6b', True), ('I', 0.1, None, 'k-amenager', True),
    ('J1', 0.1, 'J2', 'n7a', True), ('J2', 0.2, None, 'k-koffi', True),
    ('K', 0.1, 'L', 'n7b', True), ('L', 0.2, None, 'k-babi', True),
    ('M', 0.1, None, 'n7c', True),
    ('N1', 0.1, 'N2', 'n-real', True), ('N1', 0.2, 'N2', 'k-real', True),
    ('O', 0.0, None, 'end-bg', False), ('O', 0.5, None, 'end-s1', True), ('O', 1.3, None, 'end-s2', True),
    ('O', 2.1, None, 'end-s3', True), ('O', 2.9, None, 'end-s4', True), ('O', 4.6, None, 'end-cta', True), ('O', 5.0, None, 'end-link', True),
]
# (shot, at from its start, file, from, to)
VOX = [
    ('A', 0.35, 'n1', 0, None), ('B', 0.35, 'n2', 0, None),
    ('C', 0.15, 'n3', 0, 1.2), ('D', 0.2, 'n3', 1.25, None),
    ('E', 0.25, 'n4', 0, None),
    ('F', 0.2, 'n5', 0, 2.8), ('G', 0.25, 'n5', 2.8, None),
    ('I', 0.1, 'n6', 0, None),
    ('J1', 0.15, 'n7', 0, 1.1), ('K', 0.15, 'n7', 1.15, 1.98), ('M', 0.1, 'n7', 2.05, None),
    ('O', 0.4, 'n8', 0, None), ('O', 4.4, 'n9', 0, 2.72),
]

def build(order, name, cap_skip=(), vox_skip=(), over=None):
    over = over or {}
    segs, start, f = [], {}, 0
    for k in order:
        s = dict(SEG[k], **over.get(k, {}))
        start[k] = f
        f += s['n'] + s.get('hold', 0)
        segs.append(s)
    end = {k: start[k] + SEG[k]['n'] + SEG[k].get('hold', 0) + over.get(k, {}).get('n', SEG[k]['n']) - SEG[k]['n'] for k in order}
    total = f
    caps = []
    for k, a, b, png, pop in CAP:
        if k not in start or png in cap_skip:
            continue
        t0 = start[k] / 30 + a
        if b is None:
            t1 = end[k] / 30
        elif isinstance(b, str):
            t1 = end[b] / 30 if b in end else end[k] / 30
        else:
            t1 = start[k] / 30 + b
        if k == 'O':
            t1 = total / 30 + 0.1
        caps.append({'png': png, 't0': round(t0, 2), 't1': round(t1, 2), 'pop': pop})
    vox = [[fn, a, b, round(start[k] / 30 + at, 2)] for k, at, fn, a, b in VOX if k in start and (k, fn, a) not in vox_skip]
    fades = {str(start['O']): 12}
    json.dump({'segments': segs, 'fades': fades, 'captions': caps}, open(V + name + '.json', 'w'), indent=1)
    json.dump(vox, open(V + name + '-voice.json', 'w'))
    print(name, total, round(total / 30, 2), 's')
    return total

build(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J1', 'J2', 'K', 'L', 'M', 'N1', 'N2', 'O'], 'edl2')
# The short cut (~25 s): the hook, the maquis built and rising, the living quartier, « Aménager », the testers' card.
build(['A', 'C', 'D', 'F', 'G', 'I', 'O'], 'edl2s', cap_skip=('n-new',),
      over={'D': {'n': 84}, 'F': {'n': 72}, 'G': {'n': 66}, 'I': {'from': 20, 'n': 112}, 'O': {'n': 255}})
