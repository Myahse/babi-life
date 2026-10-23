import type { CinemaFilm } from '../../lib/types'

// The film on a Kinéo screen: a little loop of shots drawn on a canvas, as the
// film would show them, in its colours. Its title first, then three shots its
// genre calls for: Abidjan at dusk over the lagoon, a chase down the road, two
// people talking with the subtitles, a maquis at night, the savanna, the red
// road up north, the divers under the lagoon. The same loop all the séance
// long (it starts over), as the screen's light on the room follows it.

export const REEL_W = 512
export const REEL_H = 218

type G = CanvasRenderingContext2D
type Shot = { draw: (g: G, t: number, f: CinemaFilm) => void; light: string }
const SHOT = 6
const TITLE = 4

/** The shots each genre is made of (after the title). */
const BY_GENRE: Record<string, string[]> = {
  Action: ['chase', 'city', 'chase'],
  Comédie: ['chase', 'talk', 'maquis'],
  Thriller: ['city', 'chase', 'talk'],
  Drame: ['talk', 'road', 'talk'],
  Animation: ['savane', 'road', 'savane'],
  Romance: ['maquis', 'talk', 'city'],
  Aventure: ['road', 'savane', 'road'],
}

/** The shots of this film: the genre's, the lagoon's divers for its lagoon story. */
export function shotsOf(f: CinemaFilm): string[] {
  const list = BY_GENRE[f.genre] ?? ['city', 'talk', 'chase']
  return /lagune|port/i.test(f.title) ? ['water', 'chase', 'water'] : list
}

/** The loop's length, in seconds. */
export const reelLength = (f: CinemaFilm) => TITLE + shotsOf(f).length * SHOT

/** Draws the film at `time` (seconds, looped); returns the colour its light casts on the room. */
export function drawReel(g: G, f: CinemaFilm, time: number): string {
  const shots = shotsOf(f)
  const t = ((time % reelLength(f)) + reelLength(f)) % reelLength(f)
  if (t < TITLE) {
    title(g, t, f)
    return f.colors[0]
  }
  const i = Math.floor((t - TITLE) / SHOT)
  const shot = SHOTS[shots[i]] ?? SHOTS.city
  const local = t - TITLE - i * SHOT
  shot.draw(g, local, f)
  // A cut: a few frames of black at each shot's start, as an edit.
  if (local < 0.12) fill(g, `rgba(0,0,0,${1 - local / 0.12})`, 0, 0, REEL_W, REEL_H)
  return shot.light
}

/* ---------- Drawing ---------- */

function fill(g: G, c: string | CanvasGradient, x: number, y: number, w: number, h: number) {
  g.fillStyle = c
  g.fillRect(x, y, w, h)
}
function vertical(g: G, top: string, bottom: string, y0 = 0, y1 = REEL_H) {
  const grad = g.createLinearGradient(0, y0, 0, y1)
  grad.addColorStop(0, top)
  grad.addColorStop(1, bottom)
  return grad
}
/** A small repeatable dice: the same skyline, the same stars, every loop. */
function dice(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}
/** One of the game's blocky people, standing at (x, y = the feet), `s` its height. */
function person(g: G, x: number, y: number, s: number, skin: string, shirt: string, legs: string, step = 0) {
  const u = s / 8
  fill(g, legs, x - u * 1.2, y - u * 3 + Math.max(0, step) * u, u, u * 3 - Math.max(0, step) * u)
  fill(g, legs, x + u * 0.2, y - u * 3 + Math.max(0, -step) * u, u, u * 3 - Math.max(0, -step) * u)
  fill(g, shirt, x - u * 1.5, y - u * 6, u * 3, u * 3.2)
  fill(g, skin, x - u, y - u * 8, u * 2, u * 2)
  fill(g, '#1b1410', x - u, y - u * 8.2, u * 2, u * 0.6)
}
function subtitle(g: G, text: string) {
  g.font = '700 15px sans-serif'
  g.textAlign = 'center'
  g.fillStyle = 'rgba(0,0,0,0.8)'
  g.fillText(text, REEL_W / 2 + 1, REEL_H - 13, REEL_W - 30)
  g.fillStyle = '#fff8dc'
  g.fillText(text, REEL_W / 2, REEL_H - 14, REEL_W - 30)
}

function title(g: G, t: number, f: CinemaFilm) {
  const grad = g.createLinearGradient(0, 0, REEL_W, REEL_H)
  grad.addColorStop(0, f.colors[0])
  grad.addColorStop(1, f.colors[1])
  fill(g, grad, 0, 0, REEL_W, REEL_H)
  fill(g, 'rgba(0,0,0,0.3)', 0, 0, REEL_W, REEL_H)
  g.textAlign = 'center'
  // « Kinéo présente », then the title coming up.
  g.globalAlpha = Math.max(0, Math.min(1, t / 0.6)) * Math.max(0, Math.min(1, (2 - t) / 0.4))
  g.font = '700 16px sans-serif'
  g.fillStyle = '#ffffff'
  g.fillText('KINÉO PRÉSENTE', REEL_W / 2, REEL_H / 2 + 6)
  g.globalAlpha = Math.max(0, Math.min(1, (t - 1.8) / 0.7))
  g.font = '900 38px sans-serif'
  g.fillStyle = '#ffffff'
  g.fillText(f.title, REEL_W / 2, REEL_H / 2 + 4 + (1 - g.globalAlpha) * 10, REEL_W - 40)
  g.font = '600 13px sans-serif'
  g.fillStyle = 'rgba(255,255,255,0.85)'
  g.fillText(f.tagline, REEL_W / 2, REEL_H / 2 + 34, REEL_W - 60)
  g.globalAlpha = 1
}

const SHOTS: Record<string, Shot> = {
  /** Abidjan at dusk from across the lagoon: the Plateau's towers, the Pyramide, a pirogue crossing. */
  city: {
    light: '#ff9a5c',
    draw(g, t, f) {
      fill(g, vertical(g, '#2d2350', f.colors[0] === '#1d4ed8' ? '#20307a' : '#ff9e5e', 0, 140), 0, 0, REEL_W, 140)
      g.fillStyle = '#ffd27a'
      g.beginPath()
      g.arc(400, 118, 22, 0, Math.PI * 2)
      g.fill()
      const r = dice(7)
      const pan = t * 5
      for (let x = -20; x < REEL_W + 20; ) {
        const w = 14 + r() * 26
        const h = 30 + r() * 80
        fill(g, '#1a1830', x - pan, 140 - h, w, h)
        // The lit windows.
        for (let wy = 140 - h + 6; wy < 134; wy += 8) for (let wx = x + 3; wx < x + w - 4; wx += 6) if (r() < 0.45) fill(g, '#ffd98a', wx - pan, wy, 2.5, 3)
        x += w + 2 + r() * 8
      }
      // La Pyramide.
      g.fillStyle = '#1a1830'
      g.beginPath()
      g.moveTo(230 - pan, 140)
      g.lineTo(262 - pan, 76)
      g.lineTo(294 - pan, 140)
      g.fill()
      // The lagoon, the lights shaking in it.
      fill(g, vertical(g, '#2a3a6a', '#0d1630', 140, REEL_H), 0, 140, REEL_W, REEL_H - 140)
      for (let i = 0; i < 40; i++) fill(g, 'rgba(255,210,130,0.35)', ((i * 47) % REEL_W) + Math.sin(t * 3 + i) * 4, 146 + ((i * 13) % 60), 10 + (i % 4) * 4, 1.5)
      // The pirogue, a paddler standing in it.
      const px = -60 + t * 70
      g.fillStyle = '#3b2414'
      g.beginPath()
      g.moveTo(px, 178)
      g.lineTo(px + 70, 178)
      g.lineTo(px + 60, 186)
      g.lineTo(px + 8, 186)
      g.fill()
      person(g, px + 34, 178, 26, '#5b3a22', '#c92a2a', '#2b2b2b')
      fill(g, '#2b1a0e', px + 44, 156, 2, 30)
    },
  },
  /** Down the road flat out: the buildings going by, the lane's dashes, the gbaka (or the taxi) and who's after it. */
  chase: {
    light: '#ffc078',
    draw(g, t, f) {
      fill(g, vertical(g, '#7fb8e6', '#d8ecf7', 0, 120), 0, 0, REEL_W, 120)
      const far = (t * 60) % 120
      for (let i = -1; i < 6; i++) fill(g, ['#c9a27e', '#e8d3b0', '#9fb4c7'][(i + 3) % 3], i * 120 - far, 50 + (i % 2) * 20, 100, 70)
      const near = (t * 180) % 160
      for (let i = -1; i < 5; i++) {
        fill(g, ['#f2c14e', '#e76f51', '#2a9d8f', '#f4a261'][(i + 4) % 4], i * 160 - near, 70, 130, 60)
        for (let w = 0; w < 4; w++) fill(g, '#22303a', i * 160 - near + 12 + w * 30, 86, 16, 18)
      }
      fill(g, '#3d3d45', 0, 130, REEL_W, REEL_H - 130)
      const dash = (t * 420) % 80
      for (let x = -80; x < REEL_W + 80; x += 80) fill(g, '#f8f9fa', x - dash, 172, 40, 4)
      // The vehicle chased (a gbaka in a comedy, else a taxi), bouncing; behind it, the police.
      const comic = f.genre === 'Comédie'
      const bob = Math.sin(t * 22) * 1.5
      const vx = 250 + Math.sin(t * 0.9) * 30
      fill(g, comic ? '#f2b705' : '#ff7a00', vx, 136 + bob, comic ? 120 : 96, comic ? 36 : 26)
      fill(g, comic ? '#1f6f2e' : '#ffffff', vx, 150 + bob, comic ? 120 : 96, 4)
      fill(g, '#9ad1ff', vx + 10, 140 + bob, comic ? 90 : 60, 10)
      for (const wx of comic ? [18, 96] : [16, 74]) fill(g, '#111111', vx + wx, 160 + bob + (comic ? 10 : 0), 16, 10)
      const cx = 60 + Math.sin(t * 1.3) * 20
      fill(g, '#f8f9fa', cx, 144, 90, 24)
      fill(g, '#1c3d8f', cx, 154, 90, 5)
      fill(g, Math.floor(t * 6) % 2 ? '#ff2d2d' : '#2d6bff', cx + 36, 138, 18, 6)
      for (const wx of [14, 64]) fill(g, '#111111', cx + wx, 164, 14, 9)
      // Speed lines.
      for (let i = 0; i < 6; i++) fill(g, 'rgba(255,255,255,0.5)', ((i * 97 - t * 900) % REEL_W + REEL_W) % REEL_W, 130 + i * 12, 30, 1.5)
    },
  },
  /** Two of them face to face, by the window; the one talking moves their mouth; the subtitles below. */
  talk: {
    light: '#ffd8a8',
    draw(g, t, f) {
      fill(g, vertical(g, f.colors[1] === '#0b0b14' ? '#2a2a3a' : '#e9c99a', '#8a6a4a'), 0, 0, REEL_W, REEL_H)
      fill(g, '#9ad1ff', 200, 30, 112, 80)
      fill(g, '#5c3d22', 254, 30, 4, 80)
      fill(g, '#5c3d22', 200, 68, 112, 4)
      const speaker = Math.floor(t / 1.5) % 2
      const mouth = Math.abs(Math.sin(t * 13)) * 5
      const bust = (x: number, skin: string, shirt: string, talking: boolean, face: number) => {
        fill(g, shirt, x - 50, 130, 100, 90)
        fill(g, skin, x - 34, 50, 68, 72)
        fill(g, '#1b1410', x - 36, 44, 72, 16)
        fill(g, '#1b1410', x + face * 14 - 4, 78, 8, 8)
        fill(g, '#3a1d12', x + face * 10 - 9, 104, 18, talking ? 3 + mouth : 3)
      }
      bust(110, '#6e4024', f.colors[0], speaker === 0, 1)
      bust(400, '#8d5a35', '#f1f3f5', speaker === 1, -1)
      // What they say: the film's line, half each.
      const words = f.tagline.split(' ')
      const half = Math.ceil(words.length / 2)
      subtitle(g, `— ${(speaker === 0 ? words.slice(0, half) : words.slice(half)).join(' ') || '…'}`)
    },
  },
  /** A maquis at night: the strings of bulbs, the tables, the dancers; the singer in the middle. */
  maquis: {
    light: '#ff6bcb',
    draw(g, t, f) {
      fill(g, vertical(g, '#140a2a', f.colors[1]), 0, 0, REEL_W, REEL_H)
      for (let i = 0; i < 26; i++) {
        const x = i * 20 + 6
        const y = 22 + Math.sin(i * 0.6) * 8
        g.fillStyle = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7'][i % 4]
        g.globalAlpha = 0.6 + 0.4 * Math.sin(t * 5 + i)
        g.beginPath()
        g.arc(x, y, 3, 0, Math.PI * 2)
        g.fill()
      }
      g.globalAlpha = 1
      fill(g, '#2b1a2e', 0, 160, REEL_W, 60)
      for (const x of [40, 430]) {
        fill(g, '#6b4226', x, 150, 50, 8)
        fill(g, '#2f9e44', x + 8, 136, 6, 14)
        fill(g, '#e8590c', x + 30, 138, 6, 12)
      }
      const looks = [['#6e4024', '#d6336c', '#212529'], ['#8d5a35', '#1971c2', '#343a40'], ['#5b3a22', '#f08c00', '#212529'], ['#7a4a2a', '#2f9e44', '#495057']]
      looks.forEach(([skin, shirt, legs], i) => {
        const x = 130 + i * 70 + (i > 1 ? 60 : 0)
        person(g, x, 184 - Math.abs(Math.sin(t * 6 + i)) * 6, 52, skin, shirt, legs, Math.sin(t * 6 + i))
      })
      // The singer and the mic.
      person(g, 256, 182, 62, '#5b3a22', '#ffd43b', '#1b1410')
      fill(g, '#adb5bd', 262, 120, 3, 62)
      fill(g, '#343a40', 259, 116, 9, 7)
    },
  },
  /** The savanna in the sun: the acacias, the long grass, the little hare hopping across. */
  savane: {
    light: '#ffe066',
    draw(g, t) {
      fill(g, vertical(g, '#74c0fc', '#d0ebff', 0, 130), 0, 0, REEL_W, 130)
      g.fillStyle = '#ffe066'
      g.beginPath()
      g.arc(80, 40, 20, 0, Math.PI * 2)
      g.fill()
      fill(g, '#e9c46a', 0, 130, REEL_W, REEL_H - 130)
      const pan = (t * 30) % 260
      for (let i = -1; i < 3; i++) {
        const x = i * 260 + 120 - pan
        fill(g, '#5c3d22', x, 92, 6, 40)
        fill(g, '#2b8a3e', x - 34, 82, 74, 12)
        fill(g, '#2b8a3e', x - 20, 74, 46, 10)
      }
      // The hare: long ears, white tail, hopping.
      const hx = 80 + t * 55
      const hy = 176 - Math.abs(Math.sin(t * 6)) * 22
      fill(g, '#9c7a5b', hx - 16, hy - 16, 32, 16)
      fill(g, '#9c7a5b', hx + 10, hy - 26, 14, 14)
      fill(g, '#9c7a5b', hx + 12, hy - 44, 4, 18)
      fill(g, '#9c7a5b', hx + 18, hy - 42, 4, 16)
      fill(g, '#ffffff', hx - 20, hy - 14, 6, 6)
      fill(g, '#111111', hx + 18, hy - 22, 3, 3)
      for (let i = 0; i < 30; i++) fill(g, '#c9a227', ((i * 37 - t * 90) % REEL_W + REEL_W) % REEL_W, 190 + (i % 3) * 8, 3, 14)
    },
  },
  /** Up north on the red road: the hills, the palms going by, the old moto with the two brothers on it. */
  road: {
    light: '#ffa94d',
    draw(g, t) {
      fill(g, vertical(g, '#ffc078', '#ffe8cc', 0, 100), 0, 0, REEL_W, 100)
      g.fillStyle = '#6a994e'
      g.beginPath()
      g.moveTo(0, 100)
      for (let x = 0; x <= REEL_W; x += 16) g.lineTo(x, 88 - Math.sin(x / 60 + 1) * 14)
      g.lineTo(REEL_W, 100)
      g.fill()
      fill(g, '#a7c957', 0, 100, REEL_W, REEL_H - 100)
      // The laterite road to the vanishing point.
      g.fillStyle = '#b5532c'
      g.beginPath()
      g.moveTo(236, 100)
      g.lineTo(276, 100)
      g.lineTo(440, REEL_H)
      g.lineTo(72, REEL_H)
      g.fill()
      // Palms going by on both sides, growing as they come.
      for (let i = 0; i < 4; i++) {
        const k = ((t * 0.35 + i / 4) % 1) ** 2
        for (const side of [-1, 1]) {
          const x = 256 + side * (30 + k * 260)
          const y = 100 + k * 118
          const h = 10 + k * 90
          fill(g, '#7f5539', x - k * 3, y - h, 2 + k * 6, h)
          fill(g, '#2b8a3e', x - 6 - k * 30, y - h - 4, 12 + k * 60, 4 + k * 10)
        }
      }
      // The moto from behind, the two of them on it, swaying.
      const sway = Math.sin(t * 2.4) * 6
      fill(g, '#212529', 248 + sway, 186, 16, 26)
      fill(g, '#c92a2a', 238 + sway, 150, 36, 40)
      person(g, 256 + sway, 176, 60, '#5b3a22', '#1971c2', '#343a40')
      person(g, 256 + sway, 166, 58, '#6e4024', '#f08c00', '#343a40')
    },
  },
  /** Under the lagoon: the light coming down, the bubbles, the police divers by the crates of the port. */
  water: {
    light: '#3bc9db',
    draw(g, t) {
      fill(g, vertical(g, '#0f9d8a', '#0b1f2e'), 0, 0, REEL_W, REEL_H)
      g.globalAlpha = 0.18
      for (let i = 0; i < 5; i++) {
        g.fillStyle = '#c5f6fa'
        g.beginPath()
        const x = 60 + i * 100 + Math.sin(t + i) * 10
        g.moveTo(x, 0)
        g.lineTo(x + 30, 0)
        g.lineTo(x + 80, REEL_H)
        g.lineTo(x + 40, REEL_H)
        g.fill()
      }
      g.globalAlpha = 1
      fill(g, '#5c4a2e', 0, 196, REEL_W, 22)
      fill(g, '#8a6a3a', 380, 168, 50, 30)
      fill(g, '#6b4f2a', 380, 180, 50, 3)
      for (let d = 0; d < 2; d++) {
        const x = ((t * 40 + d * 160) % (REEL_W + 120)) - 80
        const y = 90 + d * 40 + Math.sin(t * 2 + d) * 6
        fill(g, '#212529', x, y, 70, 18)
        fill(g, '#fab005', x + 14, y - 8, 30, 8)
        fill(g, '#495057', x + 62, y - 2, 16, 14)
        fill(g, '#a5d8ff', x + 66, y + 1, 8, 6)
        fill(g, '#212529', x - 16 + Math.sin(t * 8 + d) * 4, y + 4, 18, 6)
      }
      for (let i = 0; i < 18; i++) {
        const y = (REEL_H - ((t * 50 + i * 37) % REEL_H)) | 0
        g.strokeStyle = 'rgba(220,250,255,0.7)'
        g.beginPath()
        g.arc(((i * 61) % REEL_W) + Math.sin(t * 3 + i) * 5, y, 2 + (i % 3), 0, Math.PI * 2)
        g.stroke()
      }
    },
  },
}
