import * as THREE from 'three'

// Pixel-art textures, 16×16 like Minecraft's, drawn once at startup: no
// image files, and nearest-pixel filtering keeps them crisp and blocky.

type Painter = (px: (x: number, y: number, c: string) => void, r: () => number) => void

function texture(paint: Painter, seed = 1, w = 16, h = 16) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  let s = seed
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  paint((x, y, col) => ((g.fillStyle = col), g.fillRect(x, y, 1, 1)), r)
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestMipmapNearestFilter
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const noisy = (base: number[], spread: number): Painter => (px, r) => {
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const d = (r() - 0.5) * spread
      px(x, y, `rgb(${base.map((v) => Math.max(0, Math.min(255, Math.round(v + d)))).join(',')})`)
    }
}

// The façades are atlases of 16×16 tiles, one per 3 m of wall: the walls
// pick a different tile each block (and each building starts somewhere else
// in the atlas), so a street isn't one window repeated. ATLAS tiles across.
export const ATLAS = 4

type Px = (x: number, y: number, c: string) => void
const plaster = (px: Px, r: () => number) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.round((r() - 0.5) * 10)
    px(x, y, `rgb(${238 + d},${234 + d},${226 + d})`)
  }
  for (let x = 0; x < 16; x++) px(x, 15, '#d2cbbf') // the floor line
}

/** The kinds of window of an Abidjan façade. */
type Win = 'glass' | 'shutters' | 'louvres' | 'grille' | 'claustra' | 'ac' | 'flowers' | 'french'
const WALL_TILES: Win[] = ['glass', 'grille', 'shutters', 'ac', 'louvres', 'glass', 'grille', 'flowers', 'glass', 'claustra', 'shutters', 'french', 'grille', 'ac', 'louvres', 'glass']

/**
 * One window tile, by day (plaster, frame, glass, shutters…) or at night
 * (black, and only what glows: a lit window, light through the louvres or the
 * claustra's holes; some windows stay dark).
 */
function windowTile(kind: Win, px: Px, r: () => number, night: boolean, lit: boolean) {
  const glow = lit ? (r() < 0.75 ? '#ffcf6b' : '#cfe8ff') : '#000'
  const day = !night
  if (day) plaster(px, r)
  else for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, '#000')
  const glass = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const edge = x === x0 || x === x1 || y === y0 || y === y1
        if (day) px(x, y, edge ? '#5b4a3c' : x === Math.round((x0 + x1) / 2) ? '#5a6f86' : y < (y0 + y1) / 2 ? '#3d5677' : '#2c3f5a')
        else if (!edge) px(x, y, glow)
      }
    if (day) for (let x = x0 - 1; x <= x1 + 1; x++) px(x, y1 + 1, '#c4bcae') // the sill
  }
  switch (kind) {
    case 'glass':
      glass(4, 4, 11, 10)
      break
    case 'grille':
      // Burglar bars, painted black: everywhere in Abidjan.
      glass(4, 4, 11, 10)
      if (day) for (let y = 4; y <= 10; y++) for (let x = 5; x <= 10; x += 2) px(x, y, '#1e1e1e')
      if (day) for (let x = 4; x <= 11; x++) px(x, 7, '#1e1e1e')
      break
    case 'shutters':
      // Open wooden shutters, green, folded back on each side.
      glass(6, 4, 10, 10)
      if (day) for (let y = 4; y <= 10; y++) for (const x of [3, 4, 12, 13]) px(x, y, y % 2 ? '#2f7d4a' : '#246b3d')
      break
    case 'louvres':
      // Closed louvres (persiennes): light shows in thin lines at night.
      for (let y = 4; y <= 10; y++)
        for (let x = 4; x <= 11; x++) {
          const edge = x === 4 || x === 11 || y === 4 || y === 10
          if (day) px(x, y, edge ? '#5b4a3c' : y % 2 ? '#8a5a34' : '#6e4628')
          else if (!edge && y % 2 === 0) px(x, y, lit ? '#e0a94e' : '#000')
        }
      if (day) for (let x = 3; x <= 12; x++) px(x, 11, '#c4bcae')
      break
    case 'claustra':
      // Breeze blocks (claustra) airing a stairwell: a grid of holes.
      for (let y = 3; y <= 12; y++)
        for (let x = 3; x <= 12; x++) {
          const hole = (x - 3) % 3 !== 0 && (y - 3) % 3 !== 0
          if (day) px(x, y, hole ? '#3a3632' : '#dcd5c8')
          else if (hole) px(x, y, lit && r() < 0.7 ? '#b9873a' : '#000')
        }
      break
    case 'ac':
      // A window and its air conditioner underneath, a stain below it.
      glass(4, 3, 11, 8)
      if (day) {
        for (let y = 10; y <= 13; y++) for (let x = 5; x <= 10; x++) px(x, y, x === 5 || x === 10 || y === 13 ? '#a9adb3' : y === 11 && x > 6 && x < 9 ? '#6d7278' : '#eef0f2')
        px(8, 14, '#b8b0a2')
        px(8, 15, '#c0b8aa')
      }
      break
    case 'flowers':
      glass(4, 4, 11, 9)
      if (day) for (let x = 3; x <= 12; x++) (px(x, 11, '#7a5235'), px(x, 10, r() < 0.5 ? '#3f8f3a' : r() < 0.5 ? '#e0464e' : '#f2c14e'))
      break
    case 'french':
      // A tall window onto a little balcony, its railing across.
      glass(5, 2, 10, 13)
      if (day) for (let x = 3; x <= 12; x++) (px(x, 10, '#2b2b2b'), x % 2 || px(x, 11, '#2b2b2b'), x % 2 || px(x, 12, '#2b2b2b'), px(x, 14, '#bdb6aa'))
      break
  }
}

function wallAtlas(night: boolean): Painter {
  return (px, r) => {
    WALL_TILES.forEach((kind, i) => {
      const [ox, oy] = [(i % ATLAS) * 16, Math.floor(i / ATLAS) * 16]
      windowTile(kind, (x, y, c) => px(ox + x, oy + y, c), r, night, r() < 0.55)
    })
  }
}

/** Ground floors of shops: shutters down, a shop open on its goods, painted signs. At night only the open shops glow. */
const shopAtlas = (night: boolean): Painter => (px, r) => {
  if (night) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16 * ATLAS; x++) px(x, y, '#000')
    for (let y = 5; y < 16; y++) for (let x = 3; x < 13; x++) (px(16 + x, y, r() < 0.8 ? '#ffd68a' : '#c98a3a'), y < 11 && px(48 + x, y, '#e8b866'))
    return
  }
  const signs = ['#c0392b', '#1f6fb5', '#2e8b57', '#e67e22']
  for (let k = 0; k < ATLAS; k++) {
    const t: Px = (x, y, c) => px(k * 16 + x, y, c)
    plaster(t, r)
    // The painted sign over the front.
    for (let x = 0; x < 16; x++) for (let y = 1; y < 4; y++) t(x, y, y === 2 && x > 2 && x < 13 && r() < 0.75 ? signs[k] : '#f4f1ea')
    for (let x = 1; x < 15; x++) t(x, 4, '#4a4e55')
    if (k === 1) {
      // Open: a dark shop, shelves of bright goods.
      for (let y = 5; y < 16; y++)
        for (let x = 2; x < 14; x++) t(x, y, x === 2 || x === 13 ? '#5b5f66' : y % 3 === 0 ? '#6b4a30' : r() < 0.5 ? ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#ffffff'][Math.floor(r() * 5)] : '#2a2522')
    } else if (k === 3) {
      // Half open: the shutter up to the knees, the shop behind.
      for (let y = 5; y < 16; y++) for (let x = 2; x < 14; x++) t(x, y, x === 2 || x === 13 ? '#5b5f66' : y < 11 ? (r() < 0.3 ? '#d9a441' : '#2a2522') : y % 2 ? '#9aa0a8' : '#7d838c')
    } else {
      // Down: the ribbed metal shutter.
      for (let y = 5; y < 16; y++) for (let x = 2; x < 14; x++) t(x, y, x === 2 || x === 13 ? '#5b5f66' : y % 2 ? (k === 2 ? '#3f7fbf' : '#9aa0a8') : k === 2 ? '#356da5' : '#7d838c')
    }
  }
}

/** Ground floors of homes: a door and a barred window, a metal gate, two windows. */
const houseAtlas: Painter = (px, r) => {
  for (let k = 0; k < ATLAS; k++) {
    const t: Px = (x, y, c) => px(k * 16 + x, y, c)
    plaster(t, r)
    const door = (x0: number, col: string, dark: string) => {
      for (let y = 4; y < 16; y++) for (let x = x0; x < x0 + 5; x++) t(x, y, x === x0 || x === x0 + 4 || y === 4 ? dark : r() < 0.1 ? dark : col)
      t(x0 + 3, 10, '#d4af37')
    }
    const window = (x0: number) => {
      for (let y = 5; y < 10; y++) for (let x = x0; x < x0 + 5; x++) t(x, y, x === x0 || x === x0 + 4 || y === 5 || y === 9 ? '#5a4a3a' : (x - x0) % 2 === 0 ? '#1e1e1e' : '#2c3f5a')
      for (let x = x0 - 1; x < x0 + 6; x++) t(x, 10, '#c4bcae')
    }
    if (k === 0) (door(2, '#7a5235', '#4e3424'), window(9))
    if (k === 1) {
      // The courtyard's metal gate (portail), painted.
      for (let y = 3; y < 16; y++) for (let x = 1; x < 15; x++) t(x, y, x === 1 || x === 14 || y === 3 || x === 8 ? '#1d3f6e' : y % 3 === 0 ? '#2a5a9a' : '#3570b8')
    }
    if (k === 2) (window(2), window(9))
    if (k === 3) (door(9, '#2f7d4a', '#1f5a33'), window(2))
    for (let x = 0; x < 16; x++) t(x, 15, '#b9b1a3')
  }
}

/** A public building's storey: a long band of windows, a plain band between floors. */
const inst: Painter = (px, r) => {
  noisy([240, 238, 232], 12)(px, r)
  for (let y = 4; y < 12; y++)
    for (let x = 0; x < 16; x++) px(x, y, y === 4 || y === 11 || x % 5 === 0 ? '#59606b' : y < 8 ? '#6f8fae' : '#4f6f8f')
  for (let x = 0; x < 16; x++) (px(x, 13, '#cfcac0'), px(x, 14, '#cfcac0'))
}

/** A public building's ground floor: glazed doors in the middle, glass on each side. */
const entrance: Painter = (px, r) => {
  noisy([236, 233, 226], 12)(px, r)
  for (let y = 4; y < 16; y++)
    for (let x = 1; x < 15; x++) px(x, y, x === 1 || x === 14 || y === 4 || x === 5 || x === 10 ? '#4a515c' : x > 5 && x < 10 && y > 6 ? (x === 7 || x === 8 ? '#3f5f80' : '#5f86ab') : '#7d9bb8')
  for (let x = 0; x < 16; x++) px(x, 15, '#9a958c')
}

export function makeTextures() {
  return {
    wall: texture(wallAtlas(false), 3, 16 * ATLAS, 16 * ATLAS),
    // The night version: the same tiles, only what glows (some windows dark).
    lights: texture(wallAtlas(true), 3, 16 * ATLAS, 16 * ATLAS),
    // A flat concrete roof: four slabs and their joints, one with a faint
    // rain stain (32 px for two slabs each way, so it doesn't make a grid).
    roof: texture((px, r) => {
      for (let y = 0; y < 32; y++)
        for (let x = 0; x < 32; x++) {
          const d = Math.round((r() - 0.5) * 8)
          const joint = x % 16 === 0 || y % 16 === 0
          const stain = (x - 23) ** 2 / 3 + (y - 9) ** 2 < 10 && r() < 0.7
          const g = joint ? 165 : stain ? 180 : 197
          px(x, y, `rgb(${g + d},${g - 4 + d},${g - 11 + d})`)
        }
    }, 7, 32, 32),
    shop: texture(shopAtlas(false), 29, 16 * ATLAS, 16),
    shopLights: texture(shopAtlas(true), 29, 16 * ATLAS, 16),
    inst: texture(inst, 35),
    entrance: texture(entrance, 37),
    house: texture(houseAtlas, 31, 16 * ATLAS, 16),
    plaster: texture(noisy([238, 234, 226], 14), 33),
    tin: texture((px, r) => {
      // Corrugated sheet metal, the « tôle » of the courtyards.
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, x % 4 === 0 ? '#8e4a2c' : x % 4 === 2 ? '#e08a58' : `rgb(${196 + r() * 30},${104 + r() * 20},${66 + r() * 10})`)
    }, 9),
    asphalt: texture(noisy([64, 66, 74], 20), 11),
    pavement: texture((px, r) => {
      noisy([196, 188, 172], 16)(px, r)
      for (let i = 0; i < 16; i++) (px(i, 0, '#a59c8c'), px(0, i, '#a59c8c'), px(i, 8, '#a59c8c'), px(8, i, '#a59c8c'))
    }, 13),
    laterite: texture(noisy([184, 102, 58], 30), 15),
    grass: texture(noisy([104, 170, 72], 34), 17),
    sand: texture(noisy([236, 214, 160], 20), 19),
    water: texture(noisy([52, 150, 205], 22), 21),
    // Foam: broken white lines, clear between them (it shows the water).
    foam: texture((px, r) => {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const line = (y + Math.round(Math.sin(x / 2.5) * 1.5) + 16) % 8
          px(x, y, line < 2 && r() < 0.85 ? `rgba(255,255,255,${0.75 + r() * 0.25})` : r() < 0.06 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0)')
        }
    }, 29),
    pitch: texture((px, r) => {
      noisy([70, 160, 80], 14)(px, r)
      for (let i = 0; i < 16; i++) px(i, 0, '#f1f3f5')
    }, 23),
    bark: texture(noisy([110, 78, 46], 30), 25),
    leaves: texture((px, r) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, r() < 0.12 ? '#1f5a22' : `rgb(${40 + r() * 30},${120 + r() * 50},${40 + r() * 20})`)
    }, 27),
  }
}

export type Textures = ReturnType<typeof makeTextures>
