import type { Builder, Recipe } from './kit'

// « Mini-jeux réalistes »: the alloco's own scene (components/defi/Alloco.tsx): the tantie's stall
// on the sand (her planks, the charcoal stove, the black pan of seething oil, her skimmer), the
// glossy slices, the paper cone of old newspaper, the hard-boiled egg on its enamel plate.

/** The stall, built for the square's size (w, h the visible field at z = 0; `top` the pan's height). */
export function allocoStall(w: number, h: number): Recipe {
  const Y = (y: number) => (0.5 - y) * h
  const X = (x: number) => (x - 0.5) * w
  const top = Y(0.1)
  return (b: Builder, q) => {
    // The sand, all the way down, its pebbles and a few dropped slices' oil spots.
    b.box([0, Y(0.62), -2], [w * 1.6, h * 0.8, 0.2], '#e6cf9c', { tile: 'sand' })
    if (!q.lo) for (let i = 0; i < 18; i++) b.box([X(((i * 37) % 100) / 100), Y(0.3 + ((i * 53) % 68) / 100), -1.88], [0.09, 0.07, 0.04], i % 3 ? '#b89a60' : '#9a8a70', { tile: 'cement', r: [0, 0, i] })
    // The stall's planks behind, their gaps.
    const n = 7
    for (let i = 0; i < n; i++) b.box([X((i + 0.5) / n) * 1.6, Y(0.12), -2.1], [(w * 1.6) / n - 0.05, h * 0.26, 0.2], i % 2 ? '#5a3a1e' : '#4a2e16', { tile: 'wood' })
    // The stove: a cut drum, its draught hole glowing with the coals.
    b.cyl([0, top - 0.6, -0.8], w * 0.3, 0.6, '#3a3a40', { tile: 'soot', seg: 16 })
    // The pan tipped to us: black-bottomed, its lip, the oil.
    b.lathe([0, top - 0.1755, -0.696], [[0.001, 0], [w * 0.27, 0], [w * 0.33, 0.4], [w * 0.335, 0.42]], '#2a2a2e', { tile: 'soot', seg: 20, r: [0.5, 0, 0] })
    b.ring([0, top + 0.19, -0.5], w * 0.333, 0.03, '#55565c', { tile: 'alu', seg: 24, r: [0.5, 0, 0] })
    b.on('glow').cyl([0, top + 0.18, -0.49], w * 0.32, 0.02, '#d88e24', { tile: 'sauce', seg: 20, r: [0.5, 0, 0] }).on('solid')
    // Her skimmer: the long handle, the perforated round.
    b.box([w * 0.3, top + 0.7, -0.2], [1.6, 0.07, 0.07], '#9aa1a8', { tile: 'alu', r: [0, 0, -0.5] })
    b.cyl([w * 0.3 - 0.74, top + 0.7 + 0.36, -0.2], 0.25, 0.04, '#aab0b6', { tile: 'alu', seg: 12, r: [0, 0, -0.5] })
    // The bowl of slices waiting, the bunch of ripe plantains.
    if (!q.lo) {
      b.lathe([-w * 0.36, top - 0.35, -0.3], [[0.001, 0], [0.3, 0], [0.45, 0.28], [0.47, 0.3]], '#d9480f', { tile: 'enamel', seg: 12 })
      for (let i = 0; i < 4; i++) b.box([-w * 0.36 + (i - 1.5) * 0.12, top - 0.02, -0.3], [0.1, 0.62, 0.12], '#e8b02a', { tile: 'skin', r: [0, 0, (i - 1.5) * 0.25] })
    }
  }
}

export const ALLOCO: Record<string, Recipe> = {
  /** A slice falling, frying: the oval cut on the slant, glossy gold, its caramel rim. */
  'alloco-slice': (b) => b.cyl([0, 0, 0], 0.3, 0.11, '#ffffff', { tile: 'alloco', fit: true, seg: 10, s: [1.25, 1, 0.9] }),

  /** The paper cone: a sheet of newspaper rolled up (its columns, a grease stain), at the scene's unit size (scaled to the field). */
  'alloco-paper': (b) => {
    b.cone([0, 0, 0], 1, 2, '#efe9dc', { tile: 'news', fit: true, seg: 12, r: [Math.PI + 0.25, 0, 0] })
    b.box([0.2, -0.1, 0.55], [0.4, 0.3, 0.01], '#d8b46a', { tile: 'sauce' })
  },

  /** The hard-boiled egg's enamel plate. */
  'alloco-plate': (b) => {
    b.lathe([0, -1.2, 0], [[0.001, 0], [1.25, 0], [1.3, 0.04], [1.5, 0.1], [1.52, 0.12]], '#f4f2ea', { tile: 'enamel', seg: 22 })
    b.ring([0, -1.08, 0], 1.5, 0.025, '#1c5fb0', { seg: 24 })
  },
}
