#!/usr/bin/env python3
"""Builds the game's two human models (femme, homme) from MakeHuman's data.

MakeHuman's base mesh, targets, skeleton and weights were released as CC0
(public domain) in September 2020: https://github.com/makehumancommunity/makehuman
(see LICENSE.ASSETS.md there). Nothing of MakeHuman's code is used: this
script reads its data files and writes a glTF binary per gender.

    git clone --depth 1 https://github.com/makehumancommunity/makehuman /tmp/mh
    python3 tools/avatar/build_makehuman.py /tmp/mh/makehuman/data web/public/models

What each model holds:
- the body of a young African adult (MakeHuman's macro targets: ethnicity
  African 100%, age 25, average muscle and weight, ideal proportions), its
  eyelashes, teeth, the hair cap and the skirt (MakeHuman's helper meshes);
- morph targets: the creator's body types (mince, fort, rond) and the age
  shapes (child, old), all brought back to the adult's height so the game's
  own scale stays in charge of the size;
- a skeleton reduced from MakeHuman's 163 bones to the ones the game moves
  (spine, neck, head, jaw, eyes, arms and fingers, legs and feet): the weights
  of the others go to their nearest kept ancestor. Bones have no rotation at
  rest, so a rotation about x, y or z is about the world's axes in the rest
  pose (the character faces +z);
- on the body, a `_ZONE` attribute (where the vertex is along the arm and the
  leg) that the game uses to paint the clothes with clean cut lines;
- in `extras`: the joints' positions, how each morph moves them, and a few
  landmarks (eyes, ears, chin, neck…) to fit the hair and accessories.
"""

import json
import os
import struct
import sys

import numpy as np

DATA = sys.argv[1] if len(sys.argv) > 1 else '/tmp/mh/makehuman/data'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'web/public/models'
# The game's heights at scale 1 (web/src/avatar/options.ts BASE_HEIGHT).
HEIGHT = {'femme': 1.65, 'homme': 1.76}
MH_GENDER = {'femme': 'female', 'homme': 'male'}
# MakeHuman's units are decimetres.
UNIT = 0.1

# --------------------------------------------------------------------- mesh


def load_obj(path):
    verts = []
    faces = []  # (vertex indices, group)
    group = None
    for line in open(path):
        if line.startswith('v '):
            verts.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('g '):
            group = line.split()[1]
        elif line.startswith('f '):
            faces.append(([int(t.split('/')[0]) - 1 for t in line.split()[1:]], group))
    return np.array(verts, dtype=np.float64), faces


def load_target(name, n):
    d = np.zeros((n, 3))
    path = os.path.join(DATA, 'targets', name + '.target')
    for line in open(path):
        if line.startswith('#') or not line.strip():
            continue
        i, x, y, z = line.split()
        d[int(i)] = (float(x), float(y), float(z))
    return d


BASE, FACES = load_obj(os.path.join(DATA, '3dobjs', 'base.obj'))
N = len(BASE)
_cache = {}


def T(name):
    if name not in _cache:
        _cache[name] = load_target(name, N)
    return _cache[name]


def shape(g, age='young', muscle='averagemuscle', weight='averageweight'):
    """The body for a gender, an age group and a build (MakeHuman's macro targets, each at full weight)."""
    s = BASE + T(f'macrodetails/african-{g}-{age}') + T(f'macrodetails/universal-{g}-{age}-{muscle}-{weight}')
    s = s + T(f'macrodetails/proportions/{g}-{age}-{muscle}-{weight}-idealproportions')
    return s


# ----------------------------------------------------------------- skeleton

SKEL = json.load(open(os.path.join(DATA, 'rigs', 'default.mhskel')))
BONES = SKEL['bones']
JOINTS = SKEL['joints']
WEIGHTS = json.load(open(os.path.join(DATA, 'rigs', 'default_weights.mhw')))['weights']

SIDES = ('.L', '.R')
KEEP = ['root', 'spine05', 'spine04', 'spine03', 'spine02', 'spine01', 'neck01', 'neck02', 'neck03', 'head', 'jaw', 'eye.L', 'eye.R']
for s in SIDES:
    KEEP += [b + s for b in ['clavicle', 'shoulder01', 'upperarm01', 'upperarm02', 'lowerarm01', 'lowerarm02', 'wrist', 'pelvis', 'upperleg01', 'upperleg02', 'lowerleg01', 'lowerleg02', 'foot']]
    KEEP += [f'finger{f}-{k}{s}' for f in range(1, 6) for k in range(1, 4)]
KEEP_SET = set(KEEP)


def kept_parent(b):
    p = BONES[b]['parent']
    while p and p not in KEEP_SET:
        p = BONES[p]['parent']
    return p


def kept(b):
    return b if b in KEEP_SET else kept_parent(b)


def joint(s, name):
    return s[JOINTS[name]].mean(axis=0)


def heads(s):
    return {b: joint(s, BONES[b]['head']) for b in KEEP}


# Merged weights: each vertex keeps its 4 strongest kept bones.
inf = [dict() for _ in range(N)]
for b, lst in WEIGHTS.items():
    k = kept(b)
    for v, w in lst:
        inf[v][k] = inf[v].get(k, 0) + w
BI = {b: i for i, b in enumerate(KEEP)}
JW = np.zeros((N, 4), dtype=np.uint8)
WW = np.zeros((N, 4), dtype=np.float32)
for v in range(N):
    top = sorted(inf[v].items(), key=lambda kv: -kv[1])[:4]
    tot = sum(w for _, w in top) or 1
    for k, (b, w) in enumerate(top):
        JW[v, k] = BI[b]
        WW[v, k] = w / tot

# ------------------------------------------------------------------ helpers


def normals(pos, tris):
    n = np.zeros_like(pos)
    a, b, c = pos[tris[:, 0]], pos[tris[:, 1]], pos[tris[:, 2]]
    fn = np.cross(b - a, c - a)
    for k in range(3):
        np.add.at(n, tris[:, k], fn)
    l = np.linalg.norm(n, axis=1, keepdims=True)
    l[l == 0] = 1
    return n / l


def chain_param(p, pts):
    """Where p lies along a chain of points: 0 at the first, 1 at the second… (nearest segment)."""
    best, bu = 1e9, 0.0
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        ab = b - a
        t = np.clip(np.dot(p - a, ab) / np.dot(ab, ab), 0, 1)
        d = np.linalg.norm(a + ab * t - p)
        if d < best:
            best, bu = d, i + t
    return bu


ARM = {b for b in KEEP if any(b.startswith(x) for x in ('upperarm', 'lowerarm', 'wrist', 'finger'))}
LEG = {b for b in KEEP if any(b.startswith(x) for x in ('upperleg', 'lowerleg', 'foot'))}

# The pieces of the model: MakeHuman's face groups.
PIECES = {
    'body': ['body'],
    'lashes': ['helper-l-eyelashes-1', 'helper-l-eyelashes-2', 'helper-r-eyelashes-1', 'helper-r-eyelashes-2'],
    'teeth': ['helper-upper-teeth', 'helper-lower-teeth'],
    'skirt': ['helper-skirt'],
}
# MakeHuman's hair helper is a long-hair proxy, not a cap: the game's hair is
# built on the scalp instead, the body's own faces above the hairline.


# ------------------------------------------------------------------- build


def build(gender):
    g = MH_GENDER[gender]
    base = shape(g)
    # Feet on the ground, at the game's height, in metres.
    BODY = sorted({v for f, gr in FACES if gr == 'body' for v in f})
    lo, hi = base[BODY, 1].min(), base[BODY, 1].max()
    k = HEIGHT[gender] / ((hi - lo) * UNIT)

    def norm(s, keep_height=False):
        """Ground it, scale it to metres; a child or old body is brought to the adult's height."""
        slo, shi = s[BODY, 1].min(), s[BODY, 1].max()
        f = k * ((hi - lo) / (shi - slo) if keep_height else 1)
        out = (s - [0, slo, 0]) * UNIT * f
        return out

    rest = norm(base)
    morphs = {
        'mince': norm(shape(g, weight='minweight')),
        'fort': norm(shape(g, muscle='maxmuscle')),
        'rond': norm(shape(g, weight='maxweight')),
        'child': norm(shape(g, age='child'), keep_height=True),
        'old': norm(shape(g, age='old')),
    }
    J = heads(rest)
    jdelta = {m: {b: (heads(s)[b] - J[b]).round(5).tolist() for b in KEEP} for m, s in morphs.items()}

    # Clothes zones on the body: how far along the arm (0 shoulder, 1 elbow,
    # 2 wrist, 3 fingertips) and the leg (0 hip, 1 knee, 2 ankle, 3 toes);
    # -1 when the vertex isn't on it.
    zone = np.full((N, 2), -1.0, dtype=np.float32)
    for side in SIDES:
        arm = [J['upperarm01' + side], J['lowerarm01' + side], J['wrist' + side], joint(rest, BONES['finger3-3' + side]['tail'])]
        leg = [J['upperleg01' + side], J['lowerleg01' + side], J['foot' + side], joint(rest, BONES['toe3-1' + side]['tail'])]
        for v in range(N):
            wa = sum(w for b, w in inf[v].items() if b in ARM and b.endswith(side))
            wl = sum(w for b, w in inf[v].items() if b in LEG and b.endswith(side))
            tot = sum(inf[v].values()) or 1
            if wa / tot > 0.5:
                zone[v, 0] = chain_param(rest[v], arm)
            if wl / tot > 0.5:
                zone[v, 1] = chain_param(rest[v], leg)

    # The scalp: head vertices above a hairline that runs from the forehead
    # (above the brows) down to the nape, round the ears.
    eye_y = J['eye.L'][1]
    centre = np.mean([rest[v] for v in range(N) if inf[v].get('head', 0) > 0.5], axis=0)
    ear_y = eye_y - 0.012

    def scalp(v):
        if inf[v].get('head', 0) + inf[v].get('jaw', 0) < 0.5:
            return False
        x, y, z = rest[v] - [0, 0, 0]
        front = np.clip((z - centre[2] + 0.02) / 0.09, 0, 1)
        line = J['head'][1] + 0.01 + (eye_y + 0.05 - J['head'][1] - 0.01) * front
        # The temples come lower than the middle of the forehead.
        line -= 0.012 * np.clip((abs(x) - 0.03) / 0.03, 0, 1) * front
        if abs(x) > 0.058 and abs(y - ear_y) < 0.04 and -0.045 < z - centre[2] < 0.035:
            return False
        return y > line

    is_scalp = np.array([scalp(v) for v in range(N)])
    PIECES['scalp'] = None

    pieces = {}
    for name, groups in PIECES.items():
        if name == 'scalp':
            quads = [f for f, gr in FACES if gr == 'body' and all(is_scalp[v] for v in f)]
        else:
            quads = [f for f, gr in FACES if gr in groups]
        used = sorted({v for f in quads for v in f})
        remap = {v: i for i, v in enumerate(used)}
        tris = []
        for f in quads:
            f = [remap[v] for v in f]
            tris += [[f[0], f[1], f[2]]] + ([[f[0], f[2], f[3]]] if len(f) == 4 else [])
        tris = np.array(tris, dtype=np.uint32)
        idx = np.array(used)
        p = rest[idx]
        n = normals(p, tris)
        targets = []
        for m in morphs:
            mp = morphs[m][idx]
            targets.append((mp - p, normals(mp, tris) - n))
        edge = None
        if name == 'scalp':
            # How far each vertex is from the hairline, in rings of the mesh
            # (0 on the edge, 1 four rings in): the hair thins out to the edge.
            from collections import Counter, defaultdict
            count = Counter()
            nb = defaultdict(set)
            for f in quads:
                f = [remap[v] for v in f]
                for a, b in zip(f, f[1:] + f[:1]):
                    count[(min(a, b), max(a, b))] += 1
                    nb[a].add(b)
                    nb[b].add(a)
            dist = np.full(len(idx), 99)
            front = [v for (a, b), c in count.items() if c == 1 for v in (a, b)]
            for v in front:
                dist[v] = 0
            ring = 0
            while front:
                ring += 1
                nxt = []
                for v in front:
                    for w in nb[v]:
                        if dist[w] > ring:
                            dist[w] = ring
                            nxt.append(w)
                front = nxt
            edge = np.clip(dist / 4.0, 0, 1).astype(np.float32)
        pieces[name] = dict(pos=p, nrm=n, tris=tris, joints=JW[idx], weights=WW[idx], zone=zone[idx] if name == 'body' else None, edge=edge, targets=targets)

    # Landmarks to fit the hair and the accessories (rest pose, metres).
    body_verts = {v for f, gr in FACES if gr == 'body' for v in f}
    body = rest[sorted(body_verts)]
    head_pts = rest[[v for v in sorted(body_verts) if inf[v].get('head', 0) + inf[v].get('jaw', 0) > 0.5]]
    landmarks = {
        'headTop': [float(J['head'][0]), float(head_pts[:, 1].max()), float(J['head'][2])],
        'headCenter': head_pts.mean(axis=0).tolist(),
        'headSize': (head_pts.max(axis=0) - head_pts.min(axis=0)).tolist(),
        'eyeL': J['eye.L'].tolist(),
        'eyeR': J['eye.R'].tolist(),
        'jaw': J['jaw'].tolist(),
        'chin': head_pts[head_pts[:, 1].argmin()].tolist(),
        'nose': head_pts[head_pts[:, 2].argmax()].tolist(),
        'neck': J['neck01'].tolist(),
        'neckTop': J['head'].tolist(),
        'shoulderL': J['upperarm01.L'].tolist(),
        'shoulderR': J['upperarm01.R'].tolist(),
        'chest': J['spine02'].tolist(),
        'waist': J['spine04'].tolist(),
        'hips': J['root'].tolist(),
        'height': float(body[:, 1].max()),
    }
    # Ears: the furthest head vertices to each side, at eye height.
    band = head_pts[np.abs(head_pts[:, 1] - J['eye.L'][1]) < 0.04]
    landmarks['earL'] = band[band[:, 0].argmax()].tolist()
    landmarks['earR'] = band[band[:, 0].argmin()].tolist()
    # The face's own points (MakeHuman's face bones, not kept as bones): the
    # mouth (oris), eyelids (orbicularis), brows (oculi)…
    face = ('oris', 'orbicularis', 'oculi', 'levator', 'risorius', 'temporalis')
    landmarks['face'] = {b: np.round(joint(rest, BONES[b]['head']), 5).tolist() for b in BONES if b.startswith(face)}
    extras = {
        'source': 'MakeHuman (CC0, makehumancommunity/makehuman), African young adult',
        'bones': KEEP,
        'parents': [kept_parent(b) for b in KEEP],
        'joints': {b: J[b].round(5).tolist() for b in KEEP},
        'morphs': list(morphs),
        'jointDeltas': jdelta,
        'landmarks': {k2: (np.round(v, 5).tolist() if isinstance(v, list) else v if isinstance(v, dict) else round(v, 5)) for k2, v in landmarks.items()},
    }
    return pieces, J, extras


# --------------------------------------------------------------------- glTF


class GLB:
    def __init__(self):
        self.bin = bytearray()
        self.views = []
        self.accessors = []

    def add(self, arr, comp, typ, target=None, minmax=False, normalized=False):
        arr = np.ascontiguousarray(arr)
        while len(self.bin) % 4:
            self.bin.append(0)
        off = len(self.bin)
        self.bin += arr.tobytes()
        view = {'buffer': 0, 'byteOffset': off, 'byteLength': arr.nbytes}
        if target:
            view['target'] = target
        self.views.append(view)
        count = arr.shape[0] if typ != 'SCALAR' else arr.size
        acc = {'bufferView': len(self.views) - 1, 'componentType': comp, 'count': int(count), 'type': typ}
        if normalized:
            acc['normalized'] = True
        if minmax:
            acc['min'] = arr.min(axis=0).astype(float).tolist()
            acc['max'] = arr.max(axis=0).astype(float).tolist()
        self.accessors.append(acc)
        return len(self.accessors) - 1


FLOAT, U8, U16, U32 = 5126, 5121, 5123, 5125


def quant_weights(w):
    """Weights as bytes (0-255) that still add up to exactly 255."""
    q = np.floor(w * 255).astype(np.int32)
    rest = 255 - q.sum(axis=1)
    q[np.arange(len(q)), np.argmax(w, axis=1)] += rest
    return q.astype(np.uint8)
ARRAY, ELEMENTS = 34962, 34963


def write(gender, pieces, J, extras, path):
    g = GLB()
    names = list(pieces)
    materials = [{'name': n, 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0, 'roughnessFactor': 0.8}} for n in names]
    prims = []
    for i, n in enumerate(names):
        pc = pieces[n]
        attrs = {
            'POSITION': g.add(pc['pos'].astype(np.float32), FLOAT, 'VEC3', ARRAY, minmax=True),
            'NORMAL': g.add(pc['nrm'].astype(np.float32), FLOAT, 'VEC3', ARRAY),
            'JOINTS_0': g.add(pc['joints'].astype(np.uint8), U8, 'VEC4', ARRAY),
            'WEIGHTS_0': g.add(quant_weights(pc['weights']), U8, 'VEC4', ARRAY, normalized=True),
        }
        if pc['zone'] is not None:
            attrs['_ZONE'] = g.add(pc['zone'].astype(np.float32), FLOAT, 'VEC2', ARRAY)
        if pc['edge'] is not None:
            attrs['_EDGE'] = g.add(pc['edge'], FLOAT, 'SCALAR', ARRAY)
        targets = []
        # Morphs move the vertices only: their normals change too little to
        # be worth the download.
        for dp, _ in pc['targets']:
            targets.append({'POSITION': g.add(dp.astype(np.float32), FLOAT, 'VEC3', ARRAY, minmax=True)})
        prims.append({'attributes': attrs, 'indices': g.add(pc['tris'].astype(np.uint32).reshape(-1), U32, 'SCALAR', ELEMENTS), 'material': i, 'targets': targets})

    bones = extras['bones']
    nodes = []
    for b, p in zip(bones, extras['parents']):
        t = J[b] - (J[p] if p else 0)
        nodes.append({'name': b, 'translation': np.round(t, 6).tolist()})
    for i, p in enumerate(extras['parents']):
        if p:
            nodes[bones.index(p)].setdefault('children', []).append(i)
    ibm = np.zeros((len(bones), 16), dtype=np.float32)
    for i, b in enumerate(bones):
        m = np.eye(4)
        m[:3, 3] = -J[b]
        ibm[i] = m.T.reshape(-1)  # column-major
    ibm_acc = g.add(ibm, FLOAT, 'MAT4')
    mesh_node = len(nodes)
    nodes.append({'name': f'human-{gender}', 'mesh': 0, 'skin': 0})
    root = len(nodes)
    nodes.append({'name': f'human-{gender}-root', 'children': [mesh_node, bones.index('root')]})
    gltf = {
        'asset': {'version': '2.0', 'generator': 'babi-life tools/avatar/build_makehuman.py', 'copyright': 'MakeHuman data, CC0 1.0'},
        'scene': 0,
        'scenes': [{'nodes': [root], 'extras': extras}],
        'nodes': nodes,
        'meshes': [{'name': 'human', 'primitives': prims, 'weights': [0] * len(extras['morphs']), 'extras': {'targetNames': extras['morphs']}}],
        'skins': [{'joints': list(range(len(bones))), 'inverseBindMatrices': ibm_acc, 'skeleton': bones.index('root')}],
        'materials': materials,
        'buffers': [{'byteLength': len(g.bin)}],
        'bufferViews': g.views,
        'accessors': g.accessors,
    }
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    binary = bytes(g.bin) + b'\0' * (-len(g.bin) % 4)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binary)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        f.write(struct.pack('<II', len(binary), 0x004E4942) + binary)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for gender in ('femme', 'homme'):
        pieces, J, extras = build(gender)
        path = os.path.join(OUT, f'human-{gender}.glb')
        write(gender, pieces, J, extras, path)
        print(path, os.path.getsize(path) // 1024, 'KB', {n: len(p['tris']) for n, p in pieces.items()}, 'height', extras['landmarks']['height'])
