import type { Recipe } from './kit'

// « Mini-jeux réalistes »: the arcade's mosquito game (components/defi/Moustiques.tsx), the lagoon at
// night, in the concept's blocks: the spray can « PAF ! » the player moves, the lane's banks (mud,
// mangrove roots and leaves, reeds, a moored pirogue), the far shore's buildings with their lit
// windows and its palms. In that scene's units (the lane 4.5 wide, the far shore 18 away).

export const LAGOON: Record<string, Recipe> = {
  /** The spray can, as the scene holds it (0.5 across, 0.9 tall, standing on y = 0): the printed body, the domed shoulder, the cap's nozzle. */
  'moustiques-bombe': (b, q) => {
    b.cyl([0, 0.43, 0], 0.25, 0.86, '#ffffff', { tile: 'spray', fit: true, seg: q.lo ? 10 : 16, open: true })
    b.cyl([0, 0.0, 0], 0.25, 0.02, '#c92a2a', { tile: 'alu', seg: q.lo ? 10 : 16 })
    b.ball([0, 0.86, 0], 0.25, '#c92a2a', { tile: 'gloss', seg: q.lo ? 10 : 16, half: true, s: [1, 0.35, 1] })
    b.cyl([0, 0.98, 0], 0.13, 0.12, '#adb5bd', { tile: 'plastic', seg: 10 })
    b.box([0, 1.07, -0.06], [0.1, 0.08, 0.16], '#495057', { tile: 'plastic' })
    b.cyl([0, 1.07, -0.15], 0.02, 0.03, '#111111', { seg: 6, r: [Math.PI / 2, 0, 0] })
  },

  /** The lane's two banks and the far shore. */
  'moustiques-set': (b, q) => {
    const X = 2.45
    for (const s of [-1, 1]) {
      // The mud bank, its water's edge.
      b.box([s * (X + 0.5), 0.02, -2.8], [1.0, 0.1, 8], '#3a3020', { tile: 'earth' })
      b.box([s * (X + 0.02), 0.03, -2.8], [0.06, 0.04, 8], '#55603a', { tile: 'grass' })
      for (let k = 0; k < (q.lo ? 6 : 9); k++) {
        const z = 0.6 - k * 0.85
        const x = s * (X + 0.15 + (k % 2) * 0.12)
        if (k % 3 === 1) {
          // A mangrove: the stilt roots arching into the water, the dark leaves over.
          for (let r = 0; r < (q.lo ? 2 : 4); r++) {
            const a = (r / 4) * Math.PI * 2 + k
            b.cyl([x + Math.cos(a) * 0.08, 0.14, z + Math.sin(a) * 0.08], 0.018, 0.32, '#4a3a28', { tile: 'wood', seg: 5, r: [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4] })
          }
          b.cyl([x, 0.38, z], 0.03, 0.3, '#4a3a28', { tile: 'wood', seg: 5 })
          b.ball([x, 0.6, z], 0.26, '#24502c', { tile: 'leaf', seg: 7, s: [1, 0.7, 1] })
          if (!q.lo) b.ball([x - s * 0.15, 0.55, z + 0.15], 0.18, '#2f6b3a', { tile: 'leaf', seg: 6 })
        } else {
          // A clump of reeds, leaning a little, a few with their seed heads.
          const n = q.lo ? 3 : 6
          for (let r = 0; r < n; r++) {
            const h = 0.3 + ((r * 7 + k) % 4) * 0.08
            b.box([x + (r - n / 2) * 0.03, h / 2, z + ((r * 3) % 5) * 0.03 - 0.06], [0.02, h, 0.02], r % 2 ? '#2f6b3a' : '#3d7a40', { tile: 'straw', r: [0, 0, s * (0.05 + (r % 3) * 0.06)] })
            if (r % 3 === 0) b.box([x + (r - n / 2) * 0.03 + s * h * 0.06, h + 0.04, z + ((r * 3) % 5) * 0.03 - 0.06], [0.03, 0.08, 0.03], '#6b4a2a', { tile: 'straw' })
          }
        }
      }
    }
    // A pirogue moored at the left bank, its rope to a stake.
    b.lathe([-X - 0.2, 0.02, -3.6], [[0.001, 0], [0.12, 0], [0.17, 0.08], [0.18, 0.14]], '#5a3d22', { tile: 'wood', seg: 10, s: [1, 1, 4.5], inside: '#3a2614' })
    b.cyl([-X - 0.55, 0.2, -3.0], 0.03, 0.4, '#4a3a28', { tile: 'wood', seg: 5 })
    // The far shore: the Plateau's blocks against the night, their windows lit, palms between.
    for (let k = 0; k < 14; k++) {
      const x = -12 + k * 1.9
      const w = 0.6 + (k % 2) * 0.4
      const h = 0.4 + (k % 4) * 0.5 + (k === 7 ? 1.4 : 0)
      b.box([x, h / 2, -18], [w, h, 0.6], '#1b2a5a', { tile: 'cement' })
      const rows = Math.floor(h / 0.22)
      const cols = Math.max(2, Math.floor(w / 0.18))
      b.on('glow')
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          if ((r * 5 + c * 3 + k) % (q.lo ? 4 : 3) !== 0) continue
          b.box([x - w / 2 + (c + 0.5) * (w / cols), 0.12 + r * 0.22, -17.69], [0.08, 0.1, 0.02], (r + c + k) % 4 ? '#ffcf70' : '#fff3c4')
        }
      b.on('solid')
      if (k % 3 === 1 && !q.lo) {
        b.cyl([x + 1, 0.5, -17.6], 0.04, 1.0, '#141c30', { seg: 5 })
        for (let f = 0; f < 5; f++) b.box([x + 1 + Math.cos(f * 1.26) * 0.25, 1.0, -17.6 + Math.sin(f * 1.26) * 0.25], [0.5, 0.03, 0.1], '#141c30', { r: [0, -f * 1.26, -0.4] })
      }
    }
    // The shore's long low line under the buildings.
    b.box([0, 0.05, -17.8], [30, 0.1, 1.2], '#101830', { tile: 'earth' })
  },

  /** What drifts down the lane with the current (the scene scrolls it, 7.5 long, two copies end to end): water hyacinth rafts, their lilac flowers, a coconut husk, a lost sandal. Low on the water, kept to the edges so the mosquitoes stay readable. */
  'moustiques-drift': (b, q) => {
    const rafts: [number, number, number][] = [[-1.9, -0.6, 0.5], [1.7, -2.4, 0.4], [-1.5, -4.3, 0.35], [2.0, -5.9, 0.45], [0.9, -6.9, 0.25]]
    for (const [x, z, r] of rafts.slice(0, q.lo ? 3 : 5)) {
      const n = q.lo ? 4 : 7
      for (let i = 0; i < n; i++) {
        const a = i * 2.39
        const d = Math.sqrt(i / n) * r
        b.ball([x + Math.cos(a) * d, 0.04, z + Math.sin(a) * d * 0.7], 0.11 + (i % 3) * 0.03, i % 2 ? '#3d8a3e' : '#4f9e43', { tile: 'leaf', seg: 6, s: [1, 0.45, 1], r: [0, a, 0] })
      }
      b.cyl([x + 0.05, 0.14, z], 0.012, 0.2, '#3d8a3e', { seg: 4 })
      b.cone([x + 0.05, 0.27, z], 0.05, 0.14, '#b197fc', { tile: 'fabric', seg: 6 })
    }
    b.ball([-0.8, 0.05, -3.4], 0.12, '#7a5a34', { tile: 'straw', seg: 7, s: [1.2, 0.6, 1] })
    if (!q.lo) b.box([0.4, 0.015, -1.6], [0.12, 0.02, 0.26], '#1c7ed6', { tile: 'plastic', r: [0, 0.6, 0] })
  },
}
