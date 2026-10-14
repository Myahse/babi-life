import * as THREE from 'three'

// Pixel-art textures, 16×16 like Minecraft's, drawn once at startup: no
// image files, and nearest-pixel filtering keeps them crisp and blocky.

type Painter = (px: (x: number, y: number, c: string) => void, r: () => number) => void

function texture(paint: Painter, seed = 1) {
  const c = document.createElement('canvas')
  c.width = c.height = 16
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

/** A storey of wall: plaster, and a window with its frame. White, tinted per building. */
const wall: Painter = (px, r) => {
  noisy([236, 232, 224], 18)(px, r)
  for (let y = 4; y < 11; y++)
    for (let x = 4; x < 12; x++) px(x, y, x === 4 || x === 11 || y === 4 || y === 10 ? '#6b5a4a' : x === 8 || y === 7 ? '#5a6f86' : y < 7 ? '#3a5170' : '#2c3f5a')
  for (let x = 3; x < 13; x++) px(x, 11, '#bdb6aa') // sill
  for (let x = 0; x < 16; x++) px(x, 15, '#c9c2b6') // floor line
}

/** The same storey at night: only the window glows. */
const lights: Painter = (px, r) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, '#000')
  for (let y = 5; y < 10; y++) for (let x = 5; x < 11; x++) px(x, y, r() < 0.15 ? '#a8742a' : '#ffcf6b')
}

/** A ground-floor shop: the sign over the door, the rolled-down metal shutter. */
const shop: Painter = (px, r) => {
  noisy([236, 232, 224], 18)(px, r)
  for (let x = 0; x < 16; x++) for (let y = 1; y < 4; y++) px(x, y, y === 2 && x > 2 && x < 13 && r() < 0.7 ? '#c0392b' : '#f4f1ea') // the painted sign
  for (let y = 5; y < 16; y++)
    for (let x = 2; x < 14; x++) px(x, y, x === 2 || x === 13 ? '#5b5f66' : y % 2 ? '#9aa0a8' : '#7d838c') // shutter ribs
  for (let x = 1; x < 15; x++) px(x, 4, '#4a4e55')
}

/** A home's ground floor: a door and a barred window. */
const house: Painter = (px, r) => {
  noisy([236, 232, 224], 18)(px, r)
  for (let y = 4; y < 16; y++) for (let x = 2; x < 7; x++) px(x, y, x === 2 || x === 6 || y === 4 ? '#4e3424' : r() < 0.1 ? '#6e4a30' : '#7a5235')
  px(5, 10, '#d4af37')
  for (let y = 5; y < 10; y++) for (let x = 9; x < 14; x++) px(x, y, x === 9 || x === 13 || y === 5 || y === 9 ? '#5a4a3a' : x === 11 ? '#2b2b2b' : '#2c3f5a')
  for (let x = 0; x < 16; x++) px(x, 15, '#b9b1a3')
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
    wall: texture(wall, 3),
    lights: texture(lights, 5),
    roof: texture(noisy([168, 168, 160], 26), 7),
    shop: texture(shop, 29),
    inst: texture(inst, 35),
    entrance: texture(entrance, 37),
    house: texture(house, 31),
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
