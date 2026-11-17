import * as THREE from 'three'
import { ATLAS } from './textures'
import { t as tr } from '../../lib/i18n'
import { PHARMA_SIGNS, PROP_CELL, PROP_SIZE, SIGN_W, SIGNS_N, PROP, signXY } from './facadeProps'
import { goldenSky } from './lumiere'

// « Façades réalistes » (facades.ts): the façades' pixel art at twice the resolution of textures.ts
// (32 texels for 3 m, about 9 cm a texel), the same tiles in the same places of the same atlases, so
// the chunks' walls read them as they read the old ones (and the windows still go out one by one by
// the tile they're in: textures.ts windowsByHour). Painted once, on the first street drawn with the
// update open. The towers' glass and concrete grids, and the atlas of the walls' props (signs with
// invented names, AC units, claustra), with their night versions (only what glows).

const S = 32
type Px = (x: number, y: number, c: string) => void

/** A canvas painted texel by texel into ImageData (fast: no fillRect per texel), then a texture. */
function paint(w: number, h: number, draw: (px: Px, r: () => number, g: CanvasRenderingContext2D) => void, seed: number, smooth = false) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  const img = g.createImageData(w, h)
  const d = img.data
  let s = seed
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const cache = new Map<string, [number, number, number, number]>()
  const rgba = (col: string): [number, number, number, number] => {
    let v = cache.get(col)
    if (v) return v
    const k = new THREE.Color()
    let a = 255
    const m = /^rgba?\(([^)]+)\)$/.exec(col)
    if (m) {
      const p = m[1].split(',').map(Number)
      v = [p[0], p[1], p[2], p.length > 3 ? Math.round(p[3] * 255) : 255]
    } else {
      k.setStyle(col, THREE.NoColorSpace)
      v = [Math.round(k.r * 255), Math.round(k.g * 255), Math.round(k.b * 255), a]
    }
    a = v[3]
    cache.set(col, v)
    return v
  }
  const px: Px = (x, y, col) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const [R, G, B, A] = rgba(col)
    const i = (y * w + x) * 4
    d[i] = R
    d[i + 1] = G
    d[i + 2] = B
    d[i + 3] = A
  }
  draw(px, r, g)
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.magFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter
  t.minFilter = THREE.NearestMipmapLinearFilter
  t.anisotropy = 8
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return { t, c, g }
}

const rgb = (r: number, g: number, b: number) => `rgb(${Math.max(0, Math.min(255, Math.round(r)))},${Math.max(0, Math.min(255, Math.round(g)))},${Math.max(0, Math.min(255, Math.round(b)))})`

/**
 * Painted concrete as it ages in Abidjan: near white (the building's paint is the vertex colour over
 * it), grain, a few blotches, and a darker band at the floor line where the slab meets the wall.
 */
function concrete(px: Px, r: () => number, ox: number, oy: number) {
  const blot: [number, number, number][] = [...Array(3)].map(() => [r() * S, r() * S, 2 + r() * 5])
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let v = 236 + (r() - 0.5) * 9
      for (const [bx, by, br] of blot) if ((x - bx) ** 2 + (y - by) ** 2 < br * br && r() < 0.8) v -= 9
      px(ox + x, oy + y, rgb(v + 2, v - 1, v - 7))
    }
  for (let x = 0; x < S; x++) (px(ox + x, oy + S - 1, '#bdb4a6'), px(ox + x, oy + S - 2, '#cfc7ba'))
}

/** Rain and dirt run down from a sill or a unit: a ragged darker streak, fading. */
function streak(px: Px, r: () => number, x: number, y0: number, len: number, ox: number, oy: number) {
  for (let y = y0; y < Math.min(S - 2, y0 + len); y++) {
    if (r() < 0.25) continue
    const f = 1 - (y - y0) / len
    const v = 214 - f * 40
    px(ox + x, oy + y, rgb(v, v - 4, v - 12))
  }
}

type Win = 'alu' | 'naco' | 'grille' | 'shutters' | 'claustra' | 'ac' | 'flowers' | 'french' | 'tiles' | 'curtain'
const WALL_TILES: Win[] = ['alu', 'grille', 'shutters', 'ac', 'naco', 'curtain', 'grille', 'flowers', 'alu', 'claustra', 'naco', 'french', 'tiles', 'ac', 'naco', 'alu']
const GLOWS = ['#ffcf6b', '#ffd98c', '#ffe6b0', '#cfe8ff', '#b8d4ff']

/** One storey's tile of an Abidjan façade, by day or by night (black, and only the lit windows). */
function wallTile(kind: Win, px: Px, r: () => number, ox: number, oy: number, night: boolean, lit: boolean) {
  const day = !night
  if (day) concrete(px, r, ox, oy)
  else for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) px(ox + x, oy + y, '#000')
  const glow = GLOWS[Math.floor(r() * GLOWS.length)]
  const T = (x: number, y: number, c: string) => px(ox + x, oy + y, c)
  // An aluminium window: the frame, two sliding panes, the sky in the glass, the sill, the stains under it.
  const alu = (x0: number, y0: number, x1: number, y1: number, panes = 2) => {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const edge = x === x0 || x === x1 || y === y0 || y === y1
        const mull = panes > 1 && x === Math.round((x0 + x1) / 2)
        if (day) {
          const sky = (y - y0) / (y1 - y0)
          const glint = (x - x0) - (y - y0) * 0.6
          T(x, y, edge ? '#aeb5bc' : mull ? '#c5cbd1' : glint > 2 && glint < 4 ? '#9fb8cc' : rgb(70 + sky * -25, 98 + sky * -30, 128 + sky * -36))
        } else if (!edge && !mull && lit) T(x, y, glow)
      }
    if (day) {
      for (let x = x0 - 1; x <= x1 + 1; x++) (T(x, y1 + 1, '#ddd6ca'), T(x, y1 + 2, '#a89f92'))
      streak(px, r, x0, y1 + 3, 6 + Math.floor(r() * 6), ox, oy)
      streak(px, r, x1, y1 + 3, 4 + Math.floor(r() * 6), ox, oy)
    }
  }
  switch (kind) {
    case 'alu':
      alu(8, 8, 23, 21)
      break
    case 'curtain': {
      // Curtains drawn half across: a wax print behind the glass.
      alu(8, 8, 23, 21)
      const cloth = ['#c2255c', '#e8590c', '#2f9e44', '#1c7ed6'][Math.floor(r() * 4)]
      for (let y = 9; y <= 20; y++)
        for (let x = 9; x <= 13; x++) {
          if (day) T(x, y, (x + y) % 3 ? cloth : '#f2c14e')
          else if (lit) T(x, y, '#e0954a')
        }
      break
    }
    case 'grille':
      alu(8, 8, 23, 21)
      // Burglar bars, painted black, a curl at the top of each.
      if (day)
        for (let y = 7; y <= 22; y++)
          for (let x = 7; x <= 24; x++) if ((x - 7) % 3 === 0 || y === 7 || y === 22 || y === 14) T(x, y, (x - 7) % 3 === 0 && y === 8 ? '#3a3a3a' : '#1b1b1d')
      break
    case 'naco':
      // « Naco »: louvres of frosted glass in an aluminium frame, tilted open; light in thin lines at night.
      for (let y = 8; y <= 21; y++)
        for (let x = 8; x <= 23; x++) {
          const edge = x === 8 || x === 23 || y === 8 || y === 21 || x === 16
          if (day) T(x, y, edge ? '#a7aeb5' : (y - 8) % 2 ? '#2e3b45' : x < 12 ? '#c7d5dc' : '#b2c4cd')
          else if (!edge && (y - 8) % 2 === 0 && lit) T(x, y, '#e8b866')
        }
      if (day) for (let x = 7; x <= 24; x++) (T(x, 22, '#ddd6ca'), T(x, 23, '#a89f92'))
      if (day) streak(px, r, 12, 24, 5, ox, oy)
      break
    case 'shutters':
      alu(11, 8, 20, 21, 1)
      if (day) for (let y = 8; y <= 21; y++) for (const x of [6, 7, 8, 9, 22, 23, 24, 25]) T(x, y, y % 2 ? '#2f7d4a' : x === 6 || x === 25 ? '#1f5a33' : '#246b3d')
      break
    case 'claustra':
      // Breeze blocks airing a stairwell: a grid of cross-shaped holes.
      for (let y = 4; y <= 27; y++)
        for (let x = 6; x <= 25; x++) {
          const [u, v] = [(x - 6) % 5, (y - 4) % 6]
          const hole = (u === 2 && v > 0 && v < 5) || (v === 2 || v === 3 ? u > 0 && u < 4 : false)
          if (day) T(x, y, hole ? '#2c2925' : u === 0 || v === 0 ? '#cbc3b5' : '#e6dfd2')
          else if (hole && lit && r() < 0.8) T(x, y, '#b9873a')
        }
      break
    case 'ac':
      alu(8, 6, 23, 16)
      if (day) {
        // The split unit under the window: white case, a round fan, its pipe and the drip stain down the wall.
        for (let y = 19; y <= 25; y++)
          for (let x = 10; x <= 22; x++) {
            const fan = (x - 18) ** 2 + (y - 22) ** 2 <= 6
            T(x, y, x === 10 || x === 22 || y === 25 ? '#a4a9af' : fan ? ((x + y) % 2 ? '#5f656c' : '#80868d') : y === 19 ? '#fafbfc' : '#e9ecef')
          }
        for (let y = 26; y < S - 2; y++) T(21, y, '#8b8f94')
        for (let y = 26; y < S - 2; y++) if (r() < 0.7) T(20, y, '#b6ab98')
      }
      break
    case 'flowers':
      alu(8, 8, 23, 19)
      if (day) for (let x = 7; x <= 24; x++) (T(x, 22, '#7a5235'), T(x, 21, '#6a4529'), T(x, 20, r() < 0.45 ? '#3f8f3a' : r() < 0.5 ? '#e0464e' : '#f2c14e'))
      break
    case 'french':
      // A tall window onto a little balcony, its railing across, a pagne drying on it.
      alu(10, 4, 21, 27)
      if (day) {
        for (let x = 6; x <= 25; x++) (T(x, 19, '#2b2b2b'), x % 2 || [20, 21, 22, 23, 24, 25, 26].forEach((y) => T(x, y, '#2b2b2b')), T(x, 27, '#cfc7ba'), T(x, 28, '#a89f92'))
        const wax = ['#e8590c', '#7048e8', '#2f9e44'][Math.floor(r() * 3)]
        for (let y = 20; y <= 25; y++) for (let x = 14; x <= 19; x++) T(x, y, (x + y) % 2 ? wax : '#ffd43b')
      }
      break
    case 'tiles':
      // A panel of small tiles round the window (blue and white), as on many fronts of the quarters.
      if (day) for (let y = 3; y <= 27; y++) for (let x = 4; x <= 27; x++) T(x, y, (Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? '#3b6fb6' : '#eef2f6')
      alu(9, 8, 22, 21)
      break
  }
}

function wallAtlas(night: boolean) {
  return paint(S * ATLAS, S * ATLAS, (px, r) => {
    WALL_TILES.forEach((kind, i) => wallTile(kind, px, r, (i % ATLAS) * S, Math.floor(i / ATLAS) * S, night, r() < 0.6))
  }, 3)
}

/** Ground floors of shops: a tiled front round a metal shutter, a shop open on its shelves, a painted sign band. At night only the open ones glow. */
function shopAtlas(night: boolean) {
  return paint(S * ATLAS, S, (px, r) => {
    const goods = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#ffffff', '#e67e22', '#9b59b6']
    for (let k = 0; k < ATLAS; k++) {
      const T: Px = (x, y, c) => px(k * S + x, y, c)
      if (night) {
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) T(x, y, '#000')
        if (k === 1 || k === 3) for (let y = 10; y < S - 1; y++) for (let x = 5; x < 27; x++) T(x, y, k === 3 && y > 21 ? '#000' : r() < 0.8 ? '#ffd68a' : '#c98a3a')
        // The painted sign over the open ones, under its bulb.
        if (k === 1) for (let x = 3; x < 29; x++) for (let y = 3; y < 7; y++) T(x, y, '#b08040')
        continue
      }
      concrete(T, r, 0, 0)
      // The tiled pilasters on each side (ceramic, the white and blue or the brown of the quarters).
      const [ta, tb] = k % 2 ? ['#ece6dc', '#8a5a3a'] : ['#f2f5f8', '#3b6fb6']
      for (let y = 8; y < S - 1; y++) for (const x of [0, 1, 2, 3, 28, 29, 30, 31]) T(x, y, (Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? ta : tb)
      // The sign band, painted on the wall, letters as blocks.
      const band = ['#c0392b', '#1f6fb5', '#2e8b57', '#e67e22'][k]
      for (let y = 2; y < 8; y++) for (let x = 2; x < 30; x++) T(x, y, y === 2 || y === 7 ? '#f4f1ea' : band)
      for (let x = 4; x < 28; x++) if (r() < 0.6 && x % 4 !== 3) for (let y = 4; y < 6; y++) T(x, y, '#fdf6e3')
      for (let x = 4; x < 28; x++) T(x, 8, '#4a4e55')
      if (k === 1) {
        // Open: set back in the dark, shelves of goods to the ceiling, the counter in front.
        for (let y = 9; y < S - 1; y++)
          for (let x = 4; x < 28; x++) T(x, y, x === 4 || x === 27 ? '#5b5f66' : y > 25 ? (y === 26 ? '#8a6040' : '#6b4a30') : (y - 9) % 4 === 0 ? '#7a5a3c' : r() < 0.62 ? goods[Math.floor(r() * goods.length)] : '#231e1b')
      } else if (k === 3) {
        // Half open: the shutter down to the knees, crates and sacks before it.
        for (let y = 9; y < S - 1; y++) for (let x = 4; x < 28; x++) T(x, y, x === 4 || x === 27 ? '#5b5f66' : y < 21 ? (r() < 0.35 ? goods[Math.floor(r() * goods.length)] : '#231e1b') : y % 2 ? '#9aa0a8' : '#7d838c')
        for (let y = 25; y < S - 1; y++) for (let x = 6; x < 13; x++) T(x, y, y === 25 ? '#d8c39a' : '#c4ab7c')
      } else {
        // Down: the ribbed shutter, painted, with its padlock and the grime at its foot.
        const [a, b] = k === 2 ? ['#3f7fbf', '#356da5'] : ['#9aa0a8', '#7d838c']
        for (let y = 9; y < S - 1; y++) for (let x = 4; x < 28; x++) T(x, y, x === 4 || x === 27 ? '#5b5f66' : y > S - 5 && r() < 0.4 ? '#6e665c' : y % 2 ? a : b)
        T(16, S - 3, '#d4af37')
        T(16, S - 4, '#d4af37')
      }
    }
  }, 29)
}

/** Ground floors of homes: a door and a naco window, a painted metal gate, two windows, a green door; a tiled soubassement. */
function houseAtlas() {
  return paint(S * ATLAS, S, (px, r) => {
    for (let k = 0; k < ATLAS; k++) {
      const T: Px = (x, y, c) => px(k * S + x, y, c)
      concrete(T, r, 0, 0)
      const door = (x0: number, col: string, dark: string) => {
        for (let y = 7; y < S - 1; y++) for (let x = x0; x < x0 + 10; x++) T(x, y, x === x0 || x === x0 + 9 || y === 7 ? dark : (y - 7) % 6 === 0 || x === x0 + 5 ? dark : col)
        T(x0 + 7, 19, '#d4af37')
      }
      const naco = (x0: number) => {
        for (let y = 9; y < 20; y++) for (let x = x0; x < x0 + 10; x++) T(x, y, x === x0 || x === x0 + 9 || y === 9 || y === 19 ? '#a7aeb5' : (y - 9) % 2 ? '#2e3b45' : '#c3d1d8')
        for (let y = 8; y <= 20; y++) for (let x = x0 - 1; x <= x0 + 10; x += 3) T(x, y, '#1b1b1d')
        for (let x = x0 - 1; x < x0 + 11; x++) (T(x, 21, '#ddd6ca'), T(x, 22, '#a89f92'))
        streak(T, r, x0 + 2, 23, 5, 0, 0)
      }
      if (k === 0) (door(3, '#7a5235', '#4e3424'), naco(18))
      if (k === 1) {
        // The courtyard's metal gate (portail), painted, with its sun pattern.
        for (let y = 5; y < S - 1; y++) for (let x = 2; x < 30; x++) T(x, y, x === 2 || x === 29 || y === 5 || x === 16 ? '#1d3f6e' : y < 11 ? ((x + y) % 3 ? '#3570b8' : '#e3b341') : y % 4 === 0 ? '#2a5a9a' : '#3570b8')
      }
      if (k === 2) (naco(3), naco(18))
      if (k === 3) (door(18, '#2f7d4a', '#1f5a33'), naco(4))
      // The tiled soubassement (in front of a door, the gate: none).
      for (let y = S - 4; y < S; y++) for (let x = 0; x < S; x++) if (k === 2 || (k === 0 && x > 13) || (k === 3 && x < 17)) T(x, y, (x + y) % 2 ? '#b98d6a' : '#a87a58')
    }
  }, 31)
}

/**
 * The towers' curtain wall, one storey a tile (it repeats up the tower): a dark spandrel at the slab,
 * glass in panes 1.5 m wide with their mullions, the sky reflected (lighter up the pane), some blinds
 * down. Its tint is the building's (vertex colour): blue, bronze, silver, green. At night the offices
 * left lit, cold white.
 */
function glassAtlas(night: boolean) {
  return paint(S * ATLAS, S, (px, r) => {
    for (let k = 0; k < ATLAS; k++) {
      const T: Px = (x, y, c) => px(k * S + x, y, c)
      const lit = r() < 0.55
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const spandrel = y >= S - 6
          const mull = x % 16 === 0 || x % 16 === 15
          const blind = !spandrel && (x >> 4) === (k & 1) && y < 10 && k > 1
          if (night) T(x, y, !spandrel && !mull && lit && !(blind && y % 2) ? (r() < 0.85 ? '#b9c9e2' : '#e8cf98') : '#000')
          else if (spandrel) T(x, y, y === S - 6 ? '#8e979f' : '#3c444c')
          else if (mull) T(x, y, '#b9c1c8')
          else if (blind) T(x, y, y % 2 ? '#d9dde0' : '#c4c9cd')
          else {
            const up = 1 - y / (S - 6)
            const sheen = ((x % 16) - y * 0.5 + 40) % 22 < 3
            T(x, y, sheen ? '#e6eef4' : rgb(150 + up * 70, 170 + up * 60, 188 + up * 50))
          }
        }
    }
  }, 41)
}

/**
 * The towers' glass at the golden hour (and the morning's gold): the sky painted in its panes (pale, a
 * day's) takes « lumière réaliste »'s warm sky instead (lumiere.ts goldenSky), the brighter the pane the
 * more, the mullions and spandrels kept; the offices lit at dusk a little warmer. Nothing changes by day,
 * at night, or without « lumière réaliste » (its warmth stays 0). Chained after windowsByHour and before
 * lotClip (their shader patches kept).
 */
export function goldenGlass(m: THREE.MeshLambertMaterial | THREE.MeshStandardMaterial) {
  const before = m.onBeforeCompile.bind(m)
  const key = m.customProgramCacheKey?.bind(m)
  m.onBeforeCompile = (s, r) => {
    before(s, r)
    s.uniforms.uGoldenTint = goldenSky.tint
    s.uniforms.uGoldenK = goldenSky.k
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uGoldenTint;\nuniform float uGoldenK;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        #ifdef USE_MAP
          float goldenLum = dot( sampledDiffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
          float goldenSkyK = smoothstep( 0.32, 0.7, goldenLum ) * uGoldenK;
          diffuseColor.rgb = mix( diffuseColor.rgb, mix( uGoldenTint * goldenLum * 1.15, diffuseColor.rgb, 0.22 ), goldenSkyK );
        #endif`,
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= mix( vec3( 1.0 ), vec3( 1.0, 0.82, 0.62 ), uGoldenK );')
  }
  m.customProgramCacheKey = () => `${key ? key() : ''}|golden`
}

/** A tower of white concrete in a grid: deep-set windows (their reveal in shade) between the slabs and the piers. */
function gridAtlas(night: boolean) {
  return paint(S * ATLAS, S, (px, r) => {
    for (let k = 0; k < ATLAS; k++) {
      const T: Px = (x, y, c) => px(k * S + x, y, c)
      if (!night) concrete(T, r, 0, 0)
      else for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) T(x, y, '#000')
      for (const x0 of [3, 19]) {
        const lit = r() < 0.5
        for (let y = 6; y < 26; y++)
          for (let x = x0; x < x0 + 10; x++) {
            const reveal = x === x0 || y === 6
            if (night) T(x, y, !reveal && lit ? '#cfd8ea' : '#000')
            else T(x, y, reveal ? '#6d6a64' : y < 15 ? '#5b7894' : '#3f5a75')
          }
      }
    }
  }, 43)
}

// --- The walls' props: one atlas (facadeProps.ts lays out where each thing is) ---

/** The shops' names (invented), a sign each. */
const SIGN_NAMES = () => [
  [tr('QUINCAILLERIE ESPOIR'), tr('ciment · fer · peinture'), '#1f4fa8', '#ffffff'],
  [tr('BOULANGERIE LA GRÂCE'), tr('pain · pâtisserie'), '#8a4b20', '#ffe9b0'],
  [tr('ALIMENTATION CHEZ TANTIE'), tr('riz · huile · sucre'), '#c0392b', '#ffffff'],
  [tr('CABINE WAYE'), tr('dépôt · retrait · crédit'), '#f08c00', '#1b1b1d'],
  [tr('PHARMACIE DU LAGON'), tr('de garde ce soir'), '#1e8a4a', '#ffffff'],
  [tr('COIFFURE BÔ GARS'), tr('dégradé · barbe'), '#151515', '#ffd43b'],
  [tr('COUTURE MAMAN AYA'), tr('pagne · tailleur'), '#7048e8', '#ffffff'],
  [tr('PRESSING ÉCLAT'), tr('lavage · repassage'), '#1c7ed6', '#ffffff'],
  [tr('SUPÉRETTE NOUM'), tr('ouvert 7j/7'), '#2b8a3e', '#fff3bf'],
  [tr('GARBADROME LE BOSS'), tr('garba · alloco'), '#e8590c', '#ffffff'],
  [tr('ÉLECTRONIQUE GOLVO'), tr('téléphones · réparation'), '#343a40', '#74c0fc'],
  [tr('MAQUIS AKWABA SOIR'), tr('poisson braisé · attiéké'), '#0b5d3b', '#ffd43b'],
  [tr('PHARMACIE BEL AIR'), tr('ordonnances · conseils'), '#1e8a4a', '#ffffff'],
  [tr('PHARMACIE DES ROSES'), tr('ouverte 24h/24'), '#167a3e', '#ffffff'],
  [tr('MAQUIS LE JARDIN'), tr('braisé · boissons fraîches'), '#7a2e12', '#ffe066'],
  [tr('MAQUIS CHEZ ADJO'), tr('kedjenou · placali'), '#2b5d1e', '#ffffff'],
  [tr('BOUTIQUE LA PAIX'), tr('divers · crédit Waye'), '#e67700', '#ffffff'],
  [tr('SALON MAMIE COIFF'), tr('tresses · mèches'), '#c2255c', '#ffffff'],
  [tr('QUINCAILLERIE LE MARTEAU'), tr('outils · plomberie'), '#1864ab', '#ffffff'],
  [tr('RESTAURANT LE BAOBAB'), tr('cuisine ivoirienne'), '#5c3d1e', '#ffe9b0'],
] as const

/** The props' atlas, by day (`glow` false) or what glows at night (the signs' faces, the blade signs). */
export function propsAtlas(glow: boolean) {
  const names = SIGN_NAMES()
  const made = paint(PROP_SIZE, PROP_SIZE, (px, r) => {
    const fill = (x0: number, y0: number, w: number, h: number, f: (x: number, y: number) => string) => {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(x0 + x, y0 + y, f(x, y))
    }
    const C = PROP_CELL
    fill(0, 0, PROP_SIZE, PROP_SIZE, () => '#000')
    // The signs' boards: their colour, a frame, room for the letters (drawn after, as text).
    for (let i = 0; i < SIGNS_N; i++) {
      const [x0, y0] = signXY(i)
      const [, , bg] = names[i]
      const dim = '#' + new THREE.Color(bg).multiplyScalar(0.35).getHexString()
      fill(x0, y0, SIGN_W, C, (x, y) => (x < 2 || y < 2 || x >= SIGN_W - 2 || y >= C - 2 ? (glow ? '#000' : '#d8d8d8') : glow ? dim : bg))
      // A pharmacy's board: its green cross on white at the left (lit at night).
      if (PHARMA_SIGNS.includes(i)) fill(x0 + 4, y0 + 4, 24, 24, (x, y) => ((Math.abs(x - 11.5) < 3.5 && y > 2 && y < 21) || (Math.abs(y - 11.5) < 3.5 && x > 2 && x < 21) ? (glow ? '#2fbf5a' : '#2fbf5a') : glow ? '#000' : '#ffffff'))
    }
    if (glow) {
      // The blade signs' faces glow too.
      for (const cell of [PROP.blade, PROP.cross, PROP.cabine, PROP.bar]) fill(cell[0] * C + 2, cell[1] * C + 2, C - 4, C - 4, () => '#fff7e0')
      return
    }
    const at = (cell: readonly [number, number]) => [cell[0] * C, cell[1] * C] as const
    // An AC unit's front: white case, the round fan in its grille, the brand's strip.
    {
      const [x0, y0] = at(PROP.acFront)
      fill(x0, y0, C, C, (x, y) => {
        const fan = (x - 19) ** 2 + (y - 16) ** 2
        return x < 1 || y < 1 || x > C - 2 || y > C - 2 ? '#a4a9af' : fan < 100 ? (fan < 6 ? '#9aa0a8' : (x + y) % 3 === 0 ? '#4d535a' : '#7d838a') : x < 8 && y > 22 ? '#3b6fb6' : '#eceff1'
      })
    }
    fill(...at(PROP.white), C, C, () => rgb(232 + r() * 8, 234 + r() * 8, 236 + r() * 8))
    // Claustra: breeze blocks with round and cross holes.
    {
      const [x0, y0] = at(PROP.claustra)
      fill(x0, y0, C, C, (x, y) => {
        const [u, v] = [x % 8, y % 8]
        const hole = (u - 3.5) ** 2 + (v - 3.5) ** 2 < 6
        return u === 0 || v === 0 ? '#bfb7a8' : hole ? '#2c2925' : '#e7e0d3'
      })
    }
    fill(...at(PROP.metal), C, C, (x) => (x % 4 === 0 ? '#7a8087' : '#9aa0a7'))
    fill(...at(PROP.dish), C, C, (x, y) => ((x - 16) ** 2 + (y - 16) ** 2 < 180 ? ((x - 12) ** 2 + (y - 12) ** 2 < 30 ? '#ffffff' : '#e3e5e8') : '#c9ccd0'))
    // A window's cage of bars, on a dark window.
    fill(...at(PROP.cage), C, C, (x, y) => (x % 4 === 0 || y % 8 === 0 ? '#1b1b1d' : y < 16 ? '#3d5677' : '#2c3f5a'))
    // Blade signs: the mobile-money kiosk (Waye's orange), the pharmacy's green cross, a phone booth's.
    fill(...at(PROP.blade), C, C, (x, y) => (x < 2 || y < 2 || x > C - 3 || y > C - 3 ? '#ffffff' : (x - 16) ** 2 + (y - 13) ** 2 < 40 ? '#ffffff' : '#f08c00'))
    fill(...at(PROP.cross), C, C, (x, y) => ((Math.abs(x - 16) < 4 && y > 5 && y < 27) || (Math.abs(y - 16) < 4 && x > 5 && x < 27) ? '#2fbf5a' : '#f4f4f4'))
    fill(...at(PROP.cabine), C, C, (x, y) => (y < 9 ? '#c92a2a' : x > 6 && x < 26 && y > 12 && y < 27 ? '#ffe066' : '#ffffff'))
    // A maquis's: a glass of cold beer (its foam) on the green of the boards.
    fill(...at(PROP.bar), C, C, (x, y) => (x < 2 || y < 2 || x > C - 3 || y > C - 3 ? '#ffd43b' : x > 10 && x < 22 && y > 6 && y < 27 ? (y < 11 ? '#ffffff' : x === 11 || x === 21 ? '#f8f0c0' : '#f2a516') : x >= 22 && x < 25 && y > 12 && y < 21 ? '#f8f0c0' : '#0b5d3b'))
    fill(...at(PROP.wood), C, C, (x, y) => (y % 6 === 0 ? '#5c3f26' : rgb(122 + ((x * 7) % 11), 84 + ((x * 3) % 7), 52)))
    fill(...at(PROP.slab), C, C, () => rgb(198 + r() * 10, 194 + r() * 10, 186 + r() * 10))
    fill(...at(PROP.stripes), C, C, (x) => (Math.floor(x / 4) % 2 ? '#ffffff' : '#2e8b57'))
    fill(...at(PROP.stripes2), C, C, (x) => (Math.floor(x / 4) % 2 ? '#ffffff' : '#c0392b'))
  }, 47, true)
  // The names on the boards, as letters (the only text drawn: a sign must read).
  const g = made.g
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  for (let i = 0; i < SIGNS_N; i++) {
    const [x0, y0] = signXY(i)
    const [name, sub, , ink] = names[i]
    // (A pharmacy's text beside its cross.)
    const left = PHARMA_SIGNS.includes(i) ? 28 : 0
    const mid = x0 + left + (SIGN_W - left) / 2
    g.fillStyle = ink
    let size = 13
    g.font = `bold ${size}px sans-serif`
    while (size > 7 && g.measureText(name).width > SIGN_W - 10 - left) g.font = `bold ${--size}px sans-serif`
    g.fillText(name, mid, y0 + 12)
    g.font = '8px sans-serif'
    g.fillText(sub, mid, y0 + 24)
  }
  made.t.needsUpdate = true
  // (Small text: filtered, not blocky, so it stays legible.)
  made.t.magFilter = THREE.LinearFilter
  made.t.minFilter = THREE.LinearMipmapLinearFilter
  return made.t
}

/** The façades' textures with the update open (made once). */
let made: ReturnType<typeof build> | null = null
function build() {
  return {
    wall: wallAtlas(false).t,
    lights: wallAtlas(true).t,
    shop: shopAtlas(false).t,
    shopLights: shopAtlas(true).t,
    house: houseAtlas().t,
    glass: glassAtlas(false).t,
    glassLights: glassAtlas(true).t,
    grid: gridAtlas(false).t,
    gridLights: gridAtlas(true).t,
    props: propsAtlas(false),
    propsGlow: propsAtlas(true),
  }
}
export function facadeTextures() {
  return (made ??= build())
}
