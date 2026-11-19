# mkedl.py: the shot list of « Vie amoureuse » (long and short cuts) -> edl.json / edl-court.json for compose.py, and
# plan.json / plan-court.json for mix.py (the voice clips and the sound bed, placed relative to their shot's start).
import json
W = '/tmp/claude-0/land/video-vie-amoureuse/'
F = W + 'frames/'

# id: segment (frames of 1/30 s)
SEG = {
    'A': {'dir': 'lagune', 'from': 753, 'n': 137},                                    # hook: sitting close by the water, sunset
    'B1': {'dir': 'coeur', 'from': 0, 'n': 138, 'speed': 0.33, 'mode': 'inset'},       # « Mon cœur »: the card
    'B2': {'dir': 'coeur', 'from': 46, 'n': 80, 'mode': 'inset'},                      # Mot doux -> « Tu me manques déjà » -> reply
    'G0': {'dir': 'gbairai', 'from': 14, 'n': 52, 'mode': 'inset'},                    # the pink card in Gbairai
    'B3': {'dir': 'coeur', 'from': 207, 'n': 75, 'mode': 'inset'},                     # Rendez-vous: where to take them
    'C': {'dir': 'maquis', 'from': 25, 'n': 105},                                      # the maquis: arrival and hug
    'D': {'dir': 'maquis', 'from': 148, 'n': 140},                                     # Mot doux -> heart eyes
    'E1': {'dir': 'glace', 'from': 222, 'n': 50},                                      # the pout
    'E2': {'dir': 'glace', 'from': 372, 'n': 55},                                      # the laugh
    'F1': {'dir': 'lagune', 'from': 4, 'n': 120},                                      # the lagoon at sunset: arrival, hug
    'F2': {'dir': 'lagune', 'from': 220, 'n': 45},                                     # heart eyes at sunset
    'G1': {'dir': 'maquis', 'from': 741, 'n': 80},                                     # la bise
    'G2': {'dir': 'lagune', 'from': 908, 'n': 75},                                     # the selfie, the polaroid
    'H1': {'dir': 'toast2', 'from': 196, 'n': 75},  # « Bonjour mon cœur »
    'H2': {'dir': 'porte', 'from': 190, 'n': 120, 'z': 1.55, 'cx': 0.6, 'cy': 0.34},   # the hug at the door
    'O': {'still': F + 'lagune/0800.jpg', 'n': 320, 'z0': 1.0, 'z1': 1.1, 'cx': 0.5, 'cy': 0.55},  # the testers' card
}
# (shot, t0, t1 (None: shot end; a shot id: that shot's end), png)
CAP = [
    ('A', 0.15, None, 'n-new'), ('A', 0.3, None, 'n1'),
    ('B1', 0.2, 2.3, 'n2a'), ('B1', 2.35, 'B1+', 'n2b'), ('B1', 0.2, None, 'k-coeur'),
    ('B2', 0.6, 2.0, 'n3a'), ('B2', 2.0, None, 'n3b'),
    ('G0', 0.1, None, 'k-gbairai'),
    ('B3', 0.1, None, 'n4'),
    ('C', 0.2, None, 'n5'), ('C', 0.2, None, 'k-maquis'),
    ('D', 0.1, 2.5, 'n6a'), ('D', 2.55, None, 'n6b'),
    ('E1', 0.2, 'E2', 'n7'), ('E1', 0.1, 'E2', 'k-glace'),
    ('F1', 0.3, None, 'n8'), ('F1', 0.2, 'F2', 'k-lagune'),
    ('G1', 0.2, None, 'n9a'), ('G2', 0.3, None, 'n9b'),
    ('H1', 0.15, None, 'n10a'), ('H2', 0.1, 2.75, 'n10b'), ('H2', 2.75, None, 'n10c'),
    ('O', 0.0, None, 'end-bg'), ('O', 0.5, None, 'end-s1'), ('O', 1.3, None, 'end-s2'),
    ('O', 2.1, None, 'end-s3'), ('O', 2.9, None, 'end-s4'), ('O', 4.6, None, 'end-cta'), ('O', 5.0, None, 'end-link'),
]
# the voice: (shot, at, take, from, to)
VOX = [
    ('A', 0.3, 'n1', 0, None), ('B1', 0.2, 'n2', 0, None), ('B2', 0.9, 'n3', 0, None), ('B3', 0.25, 'n4', 0, None),
    ('C', 0.25, 'n5', 0, None), ('D', 0.05, 'n6', 0, None), ('E1', 0.35, 'n7', 0, None), ('F1', 0.4, 'n8', 0, None),
    ('G1', 0.3, 'n9', 0, 1.25), ('G2', -0.4, 'n9', 1.25, None), ('H1', 0.1, 'n10', 0, 2.25), ('H2', 0.1, 'n10', 2.25, None),
    ('O', 0.4, 'n11', 0, None), ('O', 4.6, 'n12', 0, None),
]
# the sound bed: (shot, at, sound, from, to (None: end; 'shot': to the shot's end), gain dB, fade in, fade out, pan)
BED = [
    ('A', 0, 'amb-lagune', 0, 'shot', -8, 0.4, 0.5, 0), ('A', 0.0, 'whoosh', 0, None, -16, 0.02, 0.3, 0),
    ('B1', 0, 'chime', 0, None, -10, 0, 0.2, 0),
    ('B2', 0.13, 'tap', 0, None, -9, 0, 0.05, 0), ('B2', 0.2, 'pop', 0, None, -12, 0, 0.05, 0),
    ('B2', 1.63, 'tap', 0, None, -9, 0, 0.05, 0), ('B2', 1.95, 'heart', 0, None, -10, 0, 0.1, 0), ('B2', 2.2, 'chime', 0, None, -13, 0, 0.2, 0),
    ('G0', 0.53, 'tap', 0, None, -9, 0, 0.05, 0), ('G0', 0.62, 'heart', 0, None, -11, 0, 0.1, 0),
    ('B3', 0.27, 'tap', 0, None, -9, 0, 0.05, 0), ('B3', 0.35, 'pop', 0, None, -12, 0, 0.05, 0),
    ('C', -0.1, 'amb-maquis', 0, 'shot', -9, 0.2, 0.3, 0), ('C', 0.9, 'heart', 0, None, -12, 0, 0.1, 0),
    ('D', 0, 'amb-maquis', 3.5, 'shot', -12, 0.1, 0.3, 0), ('D', 1.07, 'tap', 0, None, -9, 0, 0.05, 0),
    ('D', 2.27, 'heart', 0, None, -8, 0, 0.1, 0), ('D', 2.5, 'heart', 0, None, -12, 0, 0.1, 0.2),
    ('E1', -0.05, 'amb-terrasse', 0, 'E2', -9, 0.2, 0.3, 0),
    ('F1', -0.1, 'amb-lagune', 3.0, 'F2', -8, 0.3, 0.4, 0), ('F1', 1.75, 'heart', 0, None, -13, 0, 0.1, 0),
    ('F2', 0.0, 'heart', 0, None, -9, 0, 0.1, 0), ('F2', 0.25, 'heart', 0, None, -13, 0, 0.1, -0.2),
    ('G1', -0.05, 'amb-maquis', 5.0, 'shot', -13, 0.2, 0.3, 0), ('G1', 0.65, 'bise', 0, None, -9, 0, 0.1, 0), ('G1', 0.8, 'heart', 0, None, -14, 0, 0.1, 0),
    ('G2', -0.05, 'amb-lagune', 6.0, 'shot', -12, 0.1, 0.4, 0), ('G2', 0.25, 'shutter', 0, None, -7, 0, 0.1, 0),
    ('H1', 0, 'amb-maison', 0, 'shot', -14, 0.2, 0.3, 0), ('H1', 0.0, 'chime', 0, None, -8, 0, 0.2, 0),
    ('H2', 0, 'amb-maison', 2.0, 'shot', -12, 0.2, 0.4, 0), ('H2', 1.3, 'heart', 0, None, -11, 0, 0.1, 0),
    ('O', -0.2, 'amb-lagune', 0, 'shot', -18, 0.6, 2.0, 0),
    ('O', 0.5, 'pop', 0, None, -14, 0, 0.05, 0), ('O', 1.3, 'pop', 0, None, -14, 0, 0.05, 0), ('O', 2.1, 'pop', 0, None, -14, 0, 0.05, 0),
    ('O', 2.9, 'pop', 0, None, -14, 0, 0.05, 0), ('O', 4.6, 'pop', 0, None, -11, 0, 0.05, 0),
]


def build(order, name, over=None, cap_skip=(), vox_over=None):
    over = over or {}
    vox_over = vox_over or {}
    segs, start, end, f = [], {}, {}, 0
    for k in order:
        s = dict(SEG[k], **over.get(k, {}))
        start[k] = f
        f += s['n'] + s.get('hold', 0)
        end[k] = f
        segs.append(s)
    total = f
    nxt = {k: (order[i + 1] if i + 1 < len(order) else None) for i, k in enumerate(order)}
    caps = []
    for k, a, b, png in CAP:
        if k not in start or png in cap_skip:
            continue
        t0 = start[k] / 30 + a
        if b is None:
            t1 = end[k] / 30
        elif isinstance(b, str):
            kk = b.rstrip('+')
            t1 = (end[kk] if kk in end else end[k]) / 30
            if b.endswith('+') and nxt[k] == 'B2':
                t1 = start['B2'] / 30 + 0.55
        else:
            t1 = start[k] / 30 + b
        if k == 'O':
            t1 = total / 30 + 0.1
        caps.append({'png': png, 't0': round(t0, 2), 't1': round(t1, 2), 'pop': png != 'end-bg'})
    vox = []
    for k, at, take, a, b in VOX:
        if k in start:
            at = vox_over.get((k, take, a), at)
            vox.append([take, a, b, round(start[k] / 30 + at, 3)])
    bed = []
    for k, at, snd, a, b, g, fi, fo, pan in BED:
        if k not in start:
            continue
        t = start[k] / 30 + at
        if b == 'shot':
            b = a + (end[k] / 30 - t) + 0.25
        elif isinstance(b, str):
            b = a + ((end[b] if b in end else end[k]) / 30 - t) + 0.25
        bed.append([snd, a, b, round(max(0, t), 3), g, fi, fo, pan])
    fades = {str(start['O']): 12}
    for k in order[1:]:
        if k in ('C', 'F1', 'H1', 'E1', 'G1'):
            fades[str(start[k])] = 5
    json.dump({'segments': segs, 'fades': fades, 'captions': caps}, open(W + name + '.json', 'w'), indent=1)
    json.dump({'total': round(total / 30, 3), 'voice': vox, 'bed': bed, 'shots': {k: [round(start[k] / 30, 3), round(end[k] / 30, 3)] for k in order}}, open(W + name + '-plan.json', 'w'), indent=1)
    print(name, total, round(total / 30, 2), 's')


build(['A', 'B1', 'B2', 'G0', 'B3', 'C', 'D', 'E1', 'E2', 'F1', 'F2', 'G1', 'G2', 'H1', 'H2', 'O'], 'edl')
# The short cut (~30 s): the hook, « Mon cœur », the heart eyes at the maquis, the lagoon, the bise and the selfie, the card.
build(['A', 'B1', 'D', 'F1', 'G1', 'G2', 'O'], 'edl-court', cap_skip=('n-new',), over={'O': {'n': 270}, 'F1': {'n': 105}, 'B1': {'n': 160, 'speed': 0.28}})
