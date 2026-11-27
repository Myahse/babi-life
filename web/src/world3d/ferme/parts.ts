import type { At } from '../open/shoreline'
import { put, shade, strawRoof, type Part } from '../open/kit3d'

// La ferme en blocs (the update « agriculture »; FermeScene.tsx for the phone's app, FermeLandmark.tsx for the
// village plots in the street): every fixed piece written once as blocks (kit3d's Part), set down many times,
// all of a scene's in one list drawn at once (ruePrincesse.tsx Blocks: one draw call). Sizes in metres, the
// front to +z. The crops by their stage: 0 the bare earth (ploughed or not), 1 the shoots, 2 half grown, 3 grown,
// 4 ripe (the fruit, the cobs, the pods). The motoculteur is the game's own brand, Kabako.

export type DrawStage = 0 | 1 | 2 | 3 | 4

const LEAF = ['#2f9e44', '#37b24d', '#2b8a3e', '#40c057']
const DRY = '#c9a25a'
const SOIL = '#7a4a2a'
const SOIL_WET = '#5a3218'
const RIDGE = '#8a5634'

/** One plant of a crop at a stage, its foot at the origin. */
export function plant(crop: string, stage: DrawStage, r: () => number): Part[] {
  if (stage === 0) return []
  const g = LEAF[Math.floor(r() * LEAF.length)]
  const k = stage === 1 ? 0.3 : stage === 2 ? 0.65 : 1
  switch (crop) {
    case 'mais':
    case 'mil':
    case 'sorgho':
    case 'riz': {
      const h = (crop === 'riz' ? 0.8 : crop === 'mais' ? 2 : 2.2) * k
      const top = crop === 'riz' ? '#e0b64a' : crop === 'mil' ? '#a0703a' : crop === 'sorgho' ? '#9c3b1e' : '#f2c84b'
      const out: Part[] = [
        [0, h / 2, 0, 0.07, h, 0.07, stage === 4 && crop === 'riz' ? '#c9a25a' : '#4c8a3a'],
        [0.12, h * 0.45, 0, 0.3 * k + 0.05, 0.04, 0.08, g, 0.5],
        [-0.12, h * 0.7, 0, 0.3 * k + 0.05, 0.04, 0.08, g, -0.5],
      ]
      if (crop === 'riz') out.push([0.08, h * 0.5, 0.06, 0.04, h * 0.8, 0.04, g], [-0.06, h * 0.45, -0.05, 0.04, h * 0.7, 0.04, g])
      if (stage === 4) out.push(crop === 'mais' ? [0.1, h * 0.55, 0.06, 0.12, 0.32, 0.12, top] : [0, h + 0.1, 0, 0.12, 0.28, 0.12, top])
      return out
    }
    case 'coton':
      return [
        [0, 0.4 * k, 0, 0.06, 0.8 * k, 0.06, '#4c6a3a'],
        [0, 0.7 * k, 0, 0.55 * k, 0.35 * k, 0.55 * k, stage === 4 ? '#6a8a4a' : g],
        ...(stage === 4
          ? ([
              [0.18, 0.95, 0.1, 0.14, 0.14, 0.14, '#ffffff'],
              [-0.15, 0.85, -0.08, 0.14, 0.14, 0.14, '#f8f9fa'],
              [0.02, 1.02, -0.15, 0.13, 0.13, 0.13, '#ffffff'],
            ] as Part[])
          : []),
      ]
    case 'tomate':
    case 'piment':
    case 'aubergine':
    case 'gombo': {
      const fruit = crop === 'tomate' ? '#e03131' : crop === 'piment' ? '#f03e3e' : crop === 'aubergine' ? '#5f3dc4' : '#82c91e'
      const h = (crop === 'gombo' ? 1.1 : 0.6) * k
      const out: Part[] = [
        [0, h / 2, 0, 0.06, h, 0.06, '#4c8a3a'],
        [0, h * 0.75, 0, 0.5 * k + 0.1, 0.3 * k + 0.06, 0.5 * k + 0.1, g],
      ]
      if (crop === 'tomate' && stage >= 2) out.push([0.32, h * 0.6, 0, 0.04, h * 1.2, 0.04, '#a47148'])
      if (stage === 4) out.push([0.2, h * 0.6, 0.15, 0.12, 0.12, 0.12, fruit], [-0.18, h * 0.5, -0.1, 0.12, 0.12, 0.12, fruit], [0.05, h * 0.85, -0.2, 0.1, crop === 'gombo' ? 0.22 : 0.1, 0.1, fruit])
      if (stage === 3) out.push([0.15, h * 0.85, 0.1, 0.06, 0.06, 0.06, '#fff3bf'])
      return out
    }
    case 'igname':
      // The butte, the stake, the vine up it.
      return [
        [0, 0.15, 0, 0.6, 0.3, 0.6, RIDGE],
        [0, 0.35 + 0.6 * k, 0, 0.05, 1.4 * k, 0.05, '#a47148'],
        [0.05, 0.4 + 0.5 * k, 0.04, 0.22 * k + 0.08, 0.7 * k + 0.1, 0.22 * k + 0.08, g],
        ...(stage === 4 ? ([[0.25, 0.12, 0.2, 0.35, 0.16, 0.2, '#b08a56']] as Part[]) : []),
      ]
    case 'manioc':
      return [
        [0, 0.8 * k, 0, 0.07, 1.6 * k, 0.07, '#8a6a4a'],
        [0, 1.6 * k, 0, 0.7 * k + 0.1, 0.12, 0.7 * k + 0.1, g],
        [0, 1.2 * k, 0, 0.5 * k + 0.1, 0.1, 0.5 * k + 0.1, shade(g, 0.08), 0.7],
        ...(stage === 4 ? ([[0.25, 0.06, 0.1, 0.5, 0.12, 0.14, '#c08a4a', 0.4]] as Part[]) : []),
      ]
    case 'banane':
      return [
        [0, 1 * k, 0, 0.22, 2 * k, 0.22, '#7a9a4a'],
        [0.45 * k, 2 * k, 0, 1.2 * k, 0.08, 0.4, g, 0.3],
        [-0.45 * k, 2.1 * k, 0, 1.2 * k, 0.08, 0.4, shade(g, -0.06), -0.3],
        [0, 2.15 * k, 0.4 * k, 0.4, 0.08, 1.1 * k, g],
        ...(stage === 4
          ? ([
              [0.2, 1.4, 0.15, 0.32, 0.5, 0.32, '#94d82d'],
              [0.2, 1.1, 0.15, 0.1, 0.3, 0.1, '#5c3a21'],
            ] as Part[])
          : []),
      ]
    case 'cacao':
    case 'cafe':
    case 'anacarde':
    case 'karite': {
      const tall = crop === 'karite' ? 3 : crop === 'anacarde' ? 2.4 : crop === 'cafe' ? 1.4 : 2.2
      const h = tall * (stage === 1 ? 0.25 : stage === 2 ? 0.55 : 1)
      const crown = crop === 'karite' ? 2.2 : crop === 'cafe' ? 0.9 : 1.6
      const fruit = crop === 'cacao' ? ['#e8b81a', '#e0701a'] : crop === 'cafe' ? ['#c92a2a', '#e03131'] : crop === 'anacarde' ? ['#f59f00', '#e8590c'] : ['#a9e34b', '#82c91e']
      const out: Part[] = [
        [0, h * 0.4, 0, 0.16 * (h / tall + 0.3), h * 0.8, 0.16 * (h / tall + 0.3), '#6e5640'],
        [0, h * 0.85, 0, crown * (h / tall), h * 0.4, crown * (h / tall), g],
      ]
      if (stage >= 3) out.push([0.2, h, 0.2, crown * 0.6, h * 0.25, crown * 0.6, shade(g, 0.08)])
      if (stage === 4)
        for (let i = 0; i < 4; i++) {
          const a = i * 1.6
          const onTrunk = crop === 'cacao'
          out.push([Math.cos(a) * (onTrunk ? 0.14 : crown * 0.45), onTrunk ? 0.5 + i * 0.25 : h * 0.75, Math.sin(a) * (onTrunk ? 0.14 : crown * 0.45), onTrunk ? 0.14 : 0.12, onTrunk ? 0.24 : 0.12, onTrunk ? 0.14 : 0.12, fruit[i % 2]])
        }
      return out
    }
    case 'hevea': {
      const h = 3.6 * (stage === 1 ? 0.25 : stage === 2 ? 0.55 : 1)
      const out: Part[] = [
        [0, h * 0.45, 0, 0.2, h * 0.9, 0.2, '#9a8a74'],
        [0, h * 0.9, 0, 1.1 * (h / 3.6), h * 0.3, 1.1 * (h / 3.6), g],
      ]
      // The cut in the bark and the cup of latex.
      if (stage >= 3) out.push([0, 0.9, 0.11, 0.2, 0.04, 0.02, '#e9ecef', 0.3], [0, 0.7, 0.16, 0.1, 0.08, 0.1, stage === 4 ? '#f8f9fa' : '#adb5bd'])
      return out
    }
    case 'palmier': {
      const h = 2.6 * (stage === 1 ? 0.2 : stage === 2 ? 0.5 : 1)
      const out: Part[] = [[0, h / 2, 0, 0.3, h, 0.3, '#8a6440']]
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        out.push([Math.cos(a) * 0.6 * (h / 2.6 + 0.3), h, Math.sin(a) * 0.6 * (h / 2.6 + 0.3), 1.2 * (h / 2.6 + 0.2), 0.06, 0.25, i % 2 ? g : shade(g, -0.08), -a])
      }
      if (stage === 4) out.push([0.2, h - 0.25, 0.1, 0.3, 0.3, 0.3, '#c92a2a'], [-0.2, h - 0.3, -0.05, 0.28, 0.28, 0.28, '#e8590c'])
      return out
    }
  }
  return [[0, 0.2 * k, 0, 0.3 * k, 0.4 * k, 0.3 * k, g]]
}

const TREES = new Set(['cacao', 'cafe', 'anacarde', 'karite', 'hevea', 'palmier', 'banane'])

/**
 * A field w × d (its middle at the origin): the soil (darker watered, ridged once ploughed), the rows of the crop
 * at its stage, the weeds, the pests' yellowed leaves. `rows` rows across the width.
 */
export function field(o: { crop?: string; stage: DrawStage; ploughed: boolean; cleared: boolean; rows: number; w: number; d: number; wet?: boolean; weeds?: boolean; pest?: boolean; seed?: number }): Part[] {
  let s = (o.seed ?? 7) * 9301 + 49297
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647
  const out: Part[] = []
  out.push([0, 0.04, 0, o.w, 0.08, o.d, o.cleared ? (o.wet ? SOIL_WET : SOIL) : '#6b8a3a'])
  if (!o.cleared) {
    // The bush: tall grass, shrubs, a dead tree.
    for (let i = 0; i < 46; i++) out.push([(r() - 0.5) * o.w * 0.95, 0.2 + r() * 0.2, (r() - 0.5) * o.d * 0.95, 0.2 + r() * 0.3, 0.35 + r() * 0.5, 0.2 + r() * 0.3, i % 3 ? (i % 2 ? '#5c8a2e' : '#74a03a') : DRY, r() * 3])
    return out
  }
  const tree = !!o.crop && TREES.has(o.crop)
  // The trees spaced as planted (a crown's width apart), the rest in its rows.
  const gap = o.crop === 'karite' || o.crop === 'anacarde' ? 2.8 : o.crop === 'cafe' ? 1.4 : 1.9
  const n = tree ? Math.max(2, Math.round(o.w / gap)) : Math.max(1, o.rows)
  const step = o.w / n
  const per = tree ? Math.max(2, Math.round(o.d / gap)) : Math.max(3, Math.floor(o.d / 0.6))
  for (let i = 0; i < n; i++) {
    const x = -o.w / 2 + step * (i + 0.5)
    if (o.ploughed && !tree) out.push([x, 0.12, 0, step * 0.55, 0.12, o.d * 0.96, o.wet ? shade(SOIL_WET, 0.05) : RIDGE])
    if (!o.crop || o.stage === 0) continue
    for (let j = 0; j < per; j++) {
      const z = -o.d / 2 + (o.d / per) * (j + 0.5)
      const parts = plant(o.crop, o.stage, r)
      for (const p of parts) {
        const sick = o.pest && r() < 0.25 && p[6].startsWith('#3') ? '#c0a030' : p[6]
        out.push([x + p[0] + (r() - 0.5) * 0.06, p[1] + (o.ploughed && !tree ? 0.16 : 0.06), z + p[2], p[3], p[4], p[5], sick, p[7]])
      }
    }
  }
  if (o.weeds) for (let i = 0; i < 20; i++) out.push([(r() - 0.5) * o.w * 0.95, 0.16, (r() - 0.5) * o.d * 0.95, 0.22, 0.2, 0.22, i % 2 ? '#74b816' : '#94d82d', r() * 3])
  if (o.pest) for (let i = 0; i < 6; i++) out.push([(r() - 0.5) * o.w * 0.8, 0.5, (r() - 0.5) * o.d * 0.8, 0.12, 0.05, 0.05, '#5c940d'])
  return out
}

/** A fence of posts and two rails round w × d (an opening in front). */
export function fence(w: number, d: number, col = '#8a6a45', h = 1): Part[] {
  const out: Part[] = []
  const sides: [number, number, number, number][] = [
    [0, -d / 2, w, 0],
    [-w / 2, 0, d, Math.PI / 2],
    [w / 2, 0, d, Math.PI / 2],
    [-w / 4 - 0.4, d / 2, w / 2 - 0.8, 0],
    [w / 4 + 0.4, d / 2, w / 2 - 0.8, 0],
  ]
  for (const [x, z, len, ry] of sides) {
    out.push([x, h * 0.75, z, ry ? 0.06 : len, 0.07, ry ? len : 0.06, col], [x, h * 0.35, z, ry ? 0.06 : len, 0.07, ry ? len : 0.06, col])
    const posts = Math.max(2, Math.round(len / 1.2))
    for (let i = 0; i <= posts; i++) {
      const t = -len / 2 + (len / posts) * i
      out.push([x + (ry ? 0 : t), h / 2, z + (ry ? t : 0), 0.1, h, 0.1, shade(col, -0.1)])
    }
  }
  void put
  return out
}

/** The pen of a kind: the coop and its run, the hutches, the pigsty, the oxen's park, the pond. */
export function pen(kind: string, w = 3.4, d = 3): Part[] {
  const out: Part[] = [[0, 0.03, 0, w, 0.06, d, kind === 'tilapia' ? '#6b8a3a' : '#b08a5a']]
  switch (kind) {
    case 'poules':
    case 'pintades':
      // The coop: walls of planks, a tin roof, the ladder; the wire run round.
      out.push(
        [-w / 2 + 0.8, 0.6, -d / 2 + 0.7, 1.4, 1.2, 1.2, '#a47148'],
        [-w / 2 + 0.8, 1.28, -d / 2 + 0.7, 1.7, 0.08, 1.5, '#adb5bd', 0.05],
        [-w / 2 + 0.8, 0.45, -d / 2 + 1.33, 0.35, 0.45, 0.04, '#3a2616'],
        [-w / 2 + 0.8, 0.22, -d / 2 + 1.6, 0.3, 0.04, 0.6, '#8a6a45', 0],
        [w / 2 - 0.6, 0.1, d / 2 - 0.5, 0.6, 0.2, 0.3, '#868e96'],
        [w / 2 - 0.6, 0.16, d / 2 - 0.5, 0.5, 0.04, 0.2, '#e9c46a'],
      )
      for (const p of fence(w, d, '#ced4da', 0.9)) out.push(p)
      break
    case 'lapins':
      for (let i = 0; i < 3; i++) out.push([-1 + i * 1, 0.55, -d / 2 + 0.6, 0.9, 0.7, 0.8, '#a47148'], [-1 + i * 1, 0.57, -d / 2 + 1.01, 0.7, 0.5, 0.02, '#ced4da'], [-1 + i * 1, 0.95, -d / 2 + 0.6, 1, 0.08, 0.9, '#868e96'])
      for (const p of fence(w, d, '#8a6a45', 0.7)) out.push(p)
      break
    case 'porcs':
      out.push(
        [0, 0.35, -d / 2, w, 0.7, 0.2, '#ced4da'],
        [-w / 2, 0.35, 0, 0.2, 0.7, d, '#ced4da'],
        [w / 2, 0.35, 0, 0.2, 0.7, d, '#ced4da'],
        [-w / 4 - 0.4, 0.35, d / 2, w / 2 - 0.8, 0.7, 0.2, '#ced4da'],
        [w / 4 + 0.4, 0.35, d / 2, w / 2 - 0.8, 0.7, 0.2, '#ced4da'],
      )
      out.push([0, 1.3, -d / 2 + 0.6, w, 0.08, 1.4, '#adb5bd', 0.05], [-w / 2 + 0.5, 0.65, -d / 2 + 0.6, 0.1, 1.3, 0.1, '#868e96'], [w / 2 - 0.5, 0.65, -d / 2 + 0.6, 0.1, 1.3, 0.1, '#868e96'])
      out.push([0.6, 0.1, d / 2 - 0.6, 1, 0.2, 0.35, '#868e96'], [-0.8, 0.07, 0.4, 1.2, 0.04, 0.9, '#6b4a2a'])
      break
    case 'boeufs':
      // The park of branches, the trough, the herder's shelter.
      for (const p of fence(w, d, '#6b4a2a', 1.3)) out.push(p)
      out.push([w / 2 - 0.8, 0.2, -d / 2 + 0.5, 1.2, 0.3, 0.4, '#868e96'], [w / 2 - 0.8, 0.33, -d / 2 + 0.5, 1.1, 0.04, 0.3, '#4dabf7'])
      break
    case 'chevres':
    case 'moutons':
      for (const p of fence(w, d, '#8a6a45', 1)) out.push(p)
      out.push([-w / 2 + 0.7, 0.55, -d / 2 + 0.6, 1.2, 1.1, 1, '#c9a25a'], ...strawRoof(0.9, 0.5, 1.05, '#c9a25a', 2).map((p): Part => [p[0] - w / 2 + 0.7, p[1], p[2] - d / 2 + 0.6, p[3], p[4], p[5], p[6], p[7]]))
      out.push([w / 2 - 0.6, 0.12, d / 2 - 0.5, 0.7, 0.24, 0.3, '#868e96'])
      break
    case 'tilapia':
      // The pond dug in the ground: its banks of earth, the water, the feeding pontoon.
      out.push([0, 0.1, -d / 2 + 0.15, w, 0.2, 0.3, '#8a5634'], [0, 0.1, d / 2 - 0.15, w, 0.2, 0.3, '#8a5634'], [-w / 2 + 0.15, 0.1, 0, 0.3, 0.2, d, '#8a5634'], [w / 2 - 0.15, 0.1, 0, 0.3, 0.2, d, '#8a5634'])
      out.push([w / 2 - 0.3, 0.25, 0, 0.8, 0.06, 0.5, '#a47148'])
      break
  }
  return out
}

/** The appatam (the shade of branches on four posts), a bench under it. */
export function appatam(): Part[] {
  return [
    ...[-1.1, 1.1].flatMap((x): Part[] => [
      [x, 1.1, -0.9, 0.14, 2.2, 0.14, '#6b4a2a'],
      [x, 1.1, 0.9, 0.14, 2.2, 0.14, '#6b4a2a'],
    ]),
    [0, 2.25, 0, 2.8, 0.18, 2.3, '#c9a25a'],
    [0.2, 2.38, 0.1, 2.4, 0.12, 1.9, '#b08a56', 0.1],
    [0, 0.4, 0, 1.8, 0.08, 0.4, '#8a6a3c'],
  ]
}

/** The well and its hand pump, the bucket. */
export function puits(): Part[] {
  return [
    [0, 0.35, 0, 1, 0.7, 1, '#adb5bd'],
    [0, 0.71, 0, 0.8, 0.02, 0.8, '#1971c2'],
    [0.45, 0.9, 0, 0.12, 1.1, 0.12, '#1c7ed6'],
    [0.45, 1.4, 0.18, 0.08, 0.08, 0.5, '#1c7ed6'],
    [-0.75, 0.15, 0.3, 0.3, 0.3, 0.3, '#f59f00'],
  ]
}

/** The tools leant on a post: the daba (the short hoe), the machette, the watering can. */
export function outils(): Part[] {
  return [
    // The daba: its handle, its wide blade.
    [0, 0.45, 0, 0.06, 0.9, 0.06, '#a47148', 0.3],
    [0.16, 0.06, 0.02, 0.3, 0.04, 0.22, '#868e96', 0.3],
    // The machette.
    [0.5, 0.1, 0.1, 0.12, 0.06, 0.05, '#3a2616'],
    [0.8, 0.07, 0.1, 0.5, 0.02, 0.1, '#ced4da', 0.05],
    // The arrosoir: the can, its spout, its handle.
    [-0.5, 0.18, 0.1, 0.35, 0.36, 0.25, '#2f9e44'],
    [-0.27, 0.3, 0.1, 0.3, 0.05, 0.05, '#2f9e44', 0.6],
    [-0.5, 0.42, 0.1, 0.25, 0.05, 0.05, '#2b8a3e'],
  ]
}

/** The motoculteur Kabako (the game's own brand): the engine, the two wheels, the long handlebars, the tiller. */
export function motoculteur(): Part[] {
  return [
    [0, 0.55, 0, 0.6, 0.45, 0.7, '#e8590c'],
    [0, 0.82, 0, 0.45, 0.12, 0.5, '#343a40'],
    [0, 0.6, 0.36, 0.5, 0.15, 0.02, '#ffd43b'],
    [-0.42, 0.35, 0, 0.16, 0.7, 0.7, '#212529'],
    [0.42, 0.35, 0, 0.16, 0.7, 0.7, '#212529'],
    [0, 0.95, -0.7, 0.06, 0.06, 1.2, '#495057', -0.35],
    [-0.3, 1.15, -1.25, 0.06, 0.06, 0.3, '#495057'],
    [0.3, 1.15, -1.25, 0.06, 0.06, 0.3, '#495057'],
    [0, 1.15, -1.3, 0.66, 0.06, 0.06, '#495057'],
    [0, 0.25, 0.55, 0.7, 0.3, 0.25, '#868e96'],
  ]
}

/** A claie (the drying rack on its legs), its beans (cocoa brown, coffee red, else the colour). */
export function claie(col = '#6b3a1a'): Part[] {
  return [
    [-1, 0.4, -0.5, 0.08, 0.8, 0.08, '#6b4a2a'],
    [1, 0.4, -0.5, 0.08, 0.8, 0.08, '#6b4a2a'],
    [-1, 0.4, 0.5, 0.08, 0.8, 0.08, '#6b4a2a'],
    [1, 0.4, 0.5, 0.08, 0.8, 0.08, '#6b4a2a'],
    [0, 0.82, 0, 2.2, 0.06, 1.2, '#c9a25a'],
    [0, 0.87, 0, 2, 0.04, 1, col],
  ]
}

/** Jute bags piled (the harvest at the grenier): n of them. */
export function sacs(n: number): Part[] {
  const out: Part[] = []
  for (let i = 0; i < Math.min(n, 9); i++) out.push([(i % 3) * 0.7 - 0.7, 0.22 + Math.floor(i / 3) * 0.42, (i % 2) * 0.1, 0.62, 0.42, 0.82, ['#b08a56', '#a47f4c', '#bc9662'][i % 3]])
  return out
}

/** A round grenier on stilts (the north's), or the square store of planks. */
export function grenier(round: boolean): Part[] {
  if (round) return [[0, 0.3, 0, 0.2, 0.6, 0.2, '#6b4a2a'], [0, 1.2, 0, 1.6, 1.2, 1.6, '#b87a4b'], [0, 1.2, 0, 1.6, 1.2, 1.6, '#b87a4b', Math.PI / 4], ...strawRoof(1.2, 1.1, 1.8)]
  return [
    [0, 0.9, 0, 2.2, 1.8, 1.8, '#a47148'],
    [0, 1.9, 0, 2.6, 0.12, 2.2, '#adb5bd', 0.04],
    [0, 0.7, 0.91, 0.7, 1.3, 0.04, '#3a2616'],
  ]
}

/** Parts set down at (x, z, ry), raised y, onto out. */
export function at(out: At[], x: number, z: number, parts: Part[], ry = 0, y = 0, k = 1) {
  put(out, [x, z, ry], parts, y, k)
}
