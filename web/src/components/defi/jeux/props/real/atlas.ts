import * as THREE from 'three'

// « Mini-jeux réalistes », phase 2: the one small atlas every realistic prop of the played actions is
// painted from (512 px, 8 × 8 tiles of 64 texels, painted once, texel by texel, like the concept's
// kit). Most tiles are light detail (wood grain, brushed aluminium, a weave, fish scales…) multiplied
// by the colour each block gives its vertices, so one tile paints many things; a few are pictures in
// their own colours (the attiéké's grains, a bottle's invented label, the blackboard's chalk, a screen).

export const TILE = 64
export const ATLAS = 512
const PER_ROW = ATLAS / TILE

type RGB = [number, number, number]
type Painter = (set: (x: number, y: number, c: RGB) => void, h: (x: number, y: number, k?: number) => number, ctx: CanvasRenderingContext2D, ox: number, oy: number) => void

/** A stable hash of a texel (0..1). */
const hash = (x: number, y: number, k = 0) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453
  return s - Math.floor(s)
}
const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
const gray = (v: number): RGB => [v, v, v]
const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
const mul = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k]

/** Text drawn in pixels (no smoothing past the texel grid: the canvas' own font, small and bold). */
function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center') {
  ctx.save()
  ctx.font = `900 ${size}px system-ui, sans-serif`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.fillText(s, x, y)
  ctx.restore()
}

/** The tiles, in atlas order. Names are what the props ask for. */
const TILES: [string, Painter][] = [
  // Plain: a faint speckle, so even a painted block isn't flat.
  ['plain', (set, h) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(240 + (h(x, y) - 0.5) * 18)) }],
  // Wood: long grain along u, darker rings, a knot.
  ['wood', (set, h) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const ring = Math.sin((y + Math.sin(x * 0.09 + y * 0.05) * 3) * 0.9) * 0.5 + 0.5
        let v = 214 + ring * 26 + (h(x >> 2, y) - 0.5) * 16
        if (Math.hypot(x - 40, (y - 22) * 1.6) < 4) v -= 50
        set(x, y, gray(v))
      }
  }],
  // Enamel: glossy, a soft highlight band, chips near the rim (dark iron showing).
  ['enamel', (set, h) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        let c: RGB = gray(238 + (h(x, y) - 0.5) * 8 + (Math.abs(y - 20) < 3 ? 14 : 0))
        if ((y < 4 || y > 60) && h(x >> 1, y >> 1, 3) > 0.9) c = [40, 42, 52]
        if (h(x >> 1, y >> 1, 9) > 0.993) c = [48, 50, 60]
        set(x, y, c)
      }
  }],
  // Aluminium: brushed lines along u, dents.
  ['alu', (set, h) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) set(x, y, gray(208 + (h(0, y, 1) - 0.5) * 34 + (h(x, y) - 0.5) * 10 + (Math.hypot(x - 20, y - 40) < 5 ? -18 : 0)))
  }],
  // Soot: aluminium black at the bottom (v low) from the fire, fading up.
  ['soot', (set, h) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const up = y / TILE
        const black = Math.max(0, Math.min(1, (up - 0.35 + (h(x >> 2, 0, 4) - 0.5) * 0.3) * 2.2))
        set(x, y, gray((205 + (h(0, y, 1) - 0.5) * 30) * (1 - black * 0.85)))
      }
  }],
  // Plastic: very smooth, a moulding seam and a few scuffs.
  ['plastic', (set, h) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(236 + (h(x >> 3, y >> 3) - 0.5) * 10 + (y === 31 ? -16 : 0) + (h(x, y, 5) > 0.985 ? -30 : 0)))
  }],
  // Paper: fibres.
  ['paper', (set, h) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(246 + (h(x, y >> 1) - 0.5) * 12)) }],
  // Woven cotton: a fine over-under weave.
  ['fabric', (set, h) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(222 + ((x + (y >> 1)) % 2 === 0 ? 18 : -6) + ((y + (x >> 1)) % 4 === 0 ? -10 : 0) + (h(x, y) - 0.5) * 8))
  }],
  // Attiéké: steamed cassava semolina, every grain a texel in its shade of cream, a few yellower.
  ['attieke', (set, h) => {
    const C: RGB[] = [[255, 248, 220], [247, 236, 203], [239, 224, 180], [255, 253, 240], [232, 214, 160]]
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const c = C[Math.floor(h(x, y) * C.length)]
      set(x, y, (x + y) % 2 && h(x, y, 2) > 0.6 ? mul(c, 0.9) : c)
    }
  }],
  // Rice: long white grains on a soft shadow.
  ['rice', (set, h) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(220 + (h(x >> 1, y >> 2, 1) > 0.35 ? 30 : 0) + (h(x, y) - 0.5) * 10))
  }],
  // Fish scales: rows of half-moons, each with a darker edge.
  ['scales', (set, h) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const row = Math.floor(y / 5)
        const cx = ((x + (row % 2) * 3) % 6) - 3
        const cy = (y % 5) - 1
        const d = Math.hypot(cx, cy * 1.2)
        set(x, y, gray(232 + (d > 2.5 ? -46 : d > 1.8 ? -18 : 10) + (h(x, y) - 0.5) * 10))
      }
  }],
  // Grill marks: dark charred bars across, blistered skin between.
  ['grill', (set, h) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const bar = ((x + y) % 14) < 3
        let v = 226 + (h(x >> 1, y >> 1) - 0.5) * 40
        if (bar) v = 70 + h(x, y) * 30
        if (h(x >> 2, y >> 2, 6) > 0.9) v *= 0.7
        set(x, y, gray(v))
      }
  }],
  // Bread crust: mottled bake, floury patches.
  ['crust', (set, h) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(205 + (h(x >> 2, y >> 2) - 0.5) * 50 + (h(x, y) - 0.5) * 16 + (h(x >> 3, y >> 3, 3) > 0.8 ? 30 : 0)))
  }],
  // Fruit skin: fine pores, a blush toward one end.
  ['skin', (set, h) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(232 - (y / TILE) * 26 + (h(x, y) > 0.92 ? -26 : 0) + (h(x >> 2, y >> 2) - 0.5) * 12))
  }],
  // Leaf: a middle vein, side veins slanting.
  ['leaf', (set, h) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        let v = 214 + (h(x, y) - 0.5) * 16
        if (Math.abs(x - 32) < 1.2) v = 250
        else if ((y + Math.abs(x - 32) * 0.7) % 9 < 1.2) v = 238
        set(x, y, gray(v))
      }
  }],
  // Bathroom tiles: 16-texel squares, grout lines, a glaze highlight.
  ['tiles', (set, h) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const grout = x % 16 === 0 || y % 16 === 0
        set(x, y, grout ? gray(150) : gray(236 + (h(x >> 4, y >> 4) - 0.5) * 18 + ((x % 16) + (y % 16) < 6 ? 10 : 0)))
      }
  }],
  // The blackboard: worn green-black slate, chalk sums and a line of writing, the dust.
  ['chalkboard', (set, h, ctx, ox, oy) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, mix([34, 58, 46], [70, 94, 82], h(x >> 2, y >> 1) * 0.35 + (h(x, y) > 0.96 ? 0.6 : 0)))
    return () => {
      text(ctx, '2+3=5', ox + 22, oy + 14, 11, '#f1f3f5')
      text(ctx, '7×4=28', ox + 30, oy + 30, 10, '#f8f0c8')
      text(ctx, 'a b c', ox + 24, oy + 46, 10, '#e9ecef')
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.fillRect(ox + 40, oy + 50, 18, 8)
    }
  }],
  // A beer label: « Lagune », cream oval on red, invented.
  ['labelBeer', (set, _h, ctx, ox, oy) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, Math.hypot((x - 32) / 1.6, y - 32) < 15 ? [246, 236, 206] : [178, 30, 36])
    return () => {
      text(ctx, 'LAGUNE', ox + 32, oy + 30, 9, '#7a1010')
      text(ctx, 'BIÈRE', ox + 32, oy + 40, 6, '#7a1010')
    }
  }],
  // A soda label: « Kola Djè », yellow on green.
  ['labelSoda', (set, _h, ctx, ox, oy) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, y > 22 && y < 42 ? [250, 210, 40] : [30, 130, 70])
    return () => text(ctx, 'KOLA DJÈ', ox + 32, oy + 32, 9, '#174d2a')
  }],
  // A water sachet's print: « Eau Lagon », blue on clear.
  ['labelEau', (set, _h, ctx, ox, oy) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, y > 18 && y < 46 ? [40, 110, 200] : [232, 244, 252])
    return () => {
      text(ctx, 'EAU', ox + 32, oy + 27, 10, '#ffffff')
      text(ctx, 'LAGON', ox + 32, oy + 38, 9, '#ffffff')
    }
  }],
  // Cardboard: corrugation, a strip of brown tape across.
  ['cardboard', (set, h) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, Math.abs(y - 32) < 5 ? gray(196 + (h(x, y) - 0.5) * 10) : gray(232 + (x % 4 === 0 ? -8 : 0) + (h(x, y) - 0.5) * 14))
  }],
  // Concrete / cement: speckles, pores.
  ['cement', (set, h) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(214 + (h(x, y) - 0.5) * 34 + (h(x >> 2, y >> 2, 2) - 0.5) * 20 + (h(x, y, 3) > 0.97 ? -50 : 0))) }],
  // Painted metal: scratches, worn edges.
  ['metal', (set, h) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(232 + (h(x >> 3, y >> 3) - 0.5) * 10 + ((x - y * 2 + 200) % 37 === 0 && h(x, y, 2) > 0.4 ? 22 : 0) + (h(x, y, 5) > 0.985 ? -60 : 0)))
  }],
  // The tea's foam: little bubbles, white on cream.
  ['foam', (set, h) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, h(x, y) > 0.75 ? [255, 252, 240] : h(x, y, 2) > 0.85 ? [214, 190, 140] : [244, 232, 204]) }],
  // A sauce: glossy, oil beads of palm red, bits.
  ['sauce', (set, h) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      let v = 220 + (h(x >> 2, y >> 2) - 0.5) * 30
      if (h(x >> 1, y >> 1, 4) > 0.94) v = 255
      if (h(x, y, 7) > 0.97) v = 120
      set(x, y, gray(v))
    }
  }],
  // Alloco: one slice of fried plantain seen whole (fitted on its face): golden flesh, darker caramel round its rim, oil blisters.
  ['alloco', (set, h) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const d = Math.hypot(x - 31.5, y - 31.5) / 31
      let c: RGB = mix([240, 170, 44], [253, 204, 80], h(x >> 1, y >> 1) * 0.7 + (1 - d) * 0.3)
      if (d > 0.78) c = mix([140, 60, 8], [190, 96, 20], h(x, y))
      else if (d > 0.66) c = mix(c, [200, 110, 24], 0.6)
      if (h(x, y, 3) > 0.96) c = [255, 238, 160]
      set(x, y, c)
    }
  }],
  // A computer screen: a window, lines, a chart, in its own glow.
  ['screen', (set, h) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      let c: RGB = [30, 80, 150]
      if (y < 8) c = [20, 40, 80]
      else if (x > 4 && x < 40 && y > 12 && y < 58) c = (y - 14) % 6 < 2 && x < 10 + h(0, y >> 2) * 30 ? [200, 220, 245] : [235, 242, 250]
      else if (x >= 44 && x < 60 && y > 12) c = y > 58 - h(x >> 2, 0) * 40 ? [80, 200, 120] : [36, 90, 160]
      set(x, y, c)
    }
  }],
  // Keyboard keys: a grid of caps.
  ['keys', (set) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(x % 6 === 0 || y % 7 === 0 ? 70 : 230)) }],
  // A printed page: a title, lines of text, a stamp.
  ['page', (set, h) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      let v = 248
      if (y > 6 && y < 10 && x > 8 && x < 40) v = 60
      else if (y > 14 && (y - 14) % 5 < 2 && x > 6 && x < 58 - h(0, y) * 18) v = 140
      const d = Math.hypot(x - 48, y - 50)
      set(x, y, d < 8 && d > 6 ? [60, 80, 200] : gray(v))
    }
  }],
  // A school notebook page: blue lines, the red margin.
  ['ruled', (set, h) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, x === 10 ? [220, 60, 60] : y % 6 === 0 ? [150, 180, 230] : h(x, y) > 0.995 ? [60, 60, 120] : [250, 250, 248])
  }],
  // Kente / woven strips: bright warp bands with a block pattern.
  ['kente', (set) => {
    const C: RGB[] = [[240, 190, 30], [30, 120, 60], [200, 40, 30], [20, 20, 20]]
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const band = Math.floor(x / 8)
      const blk = Math.floor(y / 8)
      let c = C[(band + (blk % 2 ? 1 : 0)) % 4]
      if ((x % 8 === 0) || (y % 8 === 0 && band % 2)) c = mul(c, 0.7)
      if ((x + y) % 2 === 0) c = mul(c, 0.92)
      set(x, y, c)
    }
  }],
  // A cacao pod's skin: deep ridges along its length, bumps.
  ['pod', (set, h) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(214 + Math.cos((x / TILE) * Math.PI * 20) * 30 + (h(x >> 1, y >> 2) - 0.5) * 22)) }],
  // Cacao beans drying: brown ovals on the mat.
  ['beans', (set, h) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const cx = (x % 8) - 4
      const cy = (y % 6) - 3
      const on = Math.hypot(cx / 1.4, cy) < 2.4
      set(x, y, on ? mix([110, 60, 34], [150, 86, 50], h(x >> 3, y / 6)) : [70, 40, 22])
    }
  }],
  // Brick: courses of terracotta, mortar.
  ['brick', (set, h) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const row = Math.floor(y / 8)
      const mortar = y % 8 === 0 || (x + (row % 2) * 8) % 16 === 0
      set(x, y, mortar ? gray(214) : gray(200 + (h((x + (row % 2) * 8) >> 4, row) - 0.5) * 40 + (h(x, y) - 0.5) * 16))
    }
  }],
  // Earth: lumps and little stones.
  ['earth', (set, h) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(212 + (h(x >> 1, y >> 1) - 0.5) * 40 + (h(x >> 2, y >> 2, 4) > 0.9 ? 30 : 0))) }],
  // Sand: fine grains, a few darker and lighter ones, soft lumps (low contrast: it covers big grounds).
  ['sand', (set, h) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(232 + (h(x, y) - 0.5) * 16 + (h(x >> 3, y >> 3, 2) - 0.5) * 8 + (h(x, y, 5) > 0.97 ? -40 : h(x, y, 6) > 0.98 ? 18 : 0))) }],
  // Grass: blades in two greens, a few dry ones, the soil showing.
  ['grass', (set, h) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const blade = h(x, y >> 1) > 0.5
      set(x, y, gray(blade ? 236 + (h(x, y) - 0.5) * 20 : 196 + (h(x >> 1, y) - 0.5) * 24 + (h(x, y, 4) > 0.97 ? 40 : 0)))
    }
  }],
  // Meat: chicken skin, blistered, browner patches.
  ['meat', (set, h) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(220 + (h(x >> 2, y >> 2) - 0.5) * 50 + (h(x >> 1, y >> 1, 2) > 0.85 ? -40 : 0) + (h(x, y, 3) > 0.93 ? 25 : 0))) }],
  // A banknote, invented: « 5000 », the value big, a portrait-less design of a cocoa tree, the bank's band.
  ['note', (set, h, ctx, ox, oy) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, y < 8 || y > 56 ? [120, 70, 150] : mix([226, 206, 236], [200, 180, 220], h(x >> 1, y >> 1) * 0.6))
    return () => {
      text(ctx, '5000', ox + 32, oy + 24, 15, '#4a2668')
      text(ctx, 'BANQUE LAGUNE', ox + 32, oy + 42, 6, '#4a2668')
    }
  }],
  // A wax print: circles and dots, orange and indigo.
  ['wax', (set) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const cx = (x % 16) - 8
      const cy = (y % 16) - 8
      const d = Math.hypot(cx, cy)
      set(x, y, d < 3 ? [250, 200, 40] : d < 6 ? [230, 90, 20] : d < 7 ? [250, 240, 220] : [40, 50, 130])
    }
  }],
  // Straw: the broom's bristles, the mat's fibres.
  ['straw', (set, h) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(206 + (h(x, 0, 1) - 0.5) * 60 + (h(x, y) - 0.5) * 10)) }],
  // Sponge: holes.
  ['sponge', (set, h) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(h(x >> 1, y >> 1) > 0.8 ? 150 : 236 + (h(x, y) - 0.5) * 14)) }],
  // The calabash: a gourd's speckled skin, a carved band.
  ['gourd', (set, h) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(225 + (h(x >> 1, y >> 1) - 0.5) * 30 + (Math.abs(y - 32) < 2 || (Math.abs(y - 32) < 6 && (x + y) % 6 < 2) ? -70 : 0))) }],
  // Newspaper: columns of grey text, a headline, a photo.
  ['news', (set, h) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      let v = 236
      if (y < 9) v = h(x >> 1, 1) > 0.3 && y > 2 && y < 8 ? 40 : 236
      else if (x > 34 && y > 12 && y < 34) v = 100 + h(x >> 2, y >> 2) * 80
      else if (y % 3 === 0 && x % 16 < 14) v = 150
      set(x, y, gray(v))
    }
  }],
  // Screen glow for the phone / TV: a bright app grid.
  ['phone', (set) => {
    const C: RGB[] = [[255, 120, 40], [40, 180, 120], [60, 140, 255], [250, 210, 60]]
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const ix = Math.floor((x - 6) / 14)
      const iy = Math.floor((y - 8) / 14)
      const inIcon = x > 6 && x < 62 && y > 8 && y < 62 && (x - 6) % 14 < 10 && (y - 8) % 14 < 10
      set(x, y, inIcon ? C[(ix + iy * 4) % 4] : [24, 40, 70])
    }
  }],
  // Ivory soap / wax: a stamped name.
  ['soap', (set, h, ctx, ox, oy) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(238 + (h(x >> 2, y >> 2) - 0.5) * 10))
    return () => text(ctx, 'KAMA', ox + 32, oy + 32, 13, 'rgba(0,0,0,0.22)')
  }],
  // Water: ripples.
  ['water', (set, h) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(214 + Math.sin(x * 0.4 + Math.sin(y * 0.3) * 2) * 14 + (h(x, y) > 0.97 ? 40 : 0))) }],
  // Charcoal embers: black lumps, orange glow between.
  ['embers', (set, h) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, h(x >> 2, y >> 2) > 0.7 ? mix([255, 120, 20], [255, 200, 80], h(x, y)) : mix([20, 18, 16], [60, 54, 50], h(x >> 1, y >> 1))) }],
  // The cola nut / spice red speckle: piment's glossy skin.
  ['gloss', (set, h) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(220 + (Math.abs(y - 18) < 3 ? 35 : 0) + (h(x, y) - 0.5) * 10)) }],
  // Onion: thin rings / layers.
  ['onion', (set, h) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(230 + (x % 5 === 0 ? -30 : 0) + (h(x, y) - 0.5) * 10)) }],
  // Pineapple: diamond eyes.
  ['pine', (set) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const a = (x + y) % 8
      const b = (x - y + 64) % 8
      set(x, y, a === 0 || b === 0 ? gray(110) : a + b < 6 ? gray(250) : gray(214))
    }
  }],
  // Book cover: a title band, a spine line.
  ['book', (set, h, ctx, ox, oy) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, x < 6 ? gray(170) : y > 20 && y < 34 ? gray(250) : gray(220 + (h(x, y) - 0.5) * 12))
    return () => text(ctx, 'MATHS', ox + 35, oy + 27, 9, '#333')
  }],
  // Hair / thread on a spool: fine lines along u.
  ['thread', (set, h) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(220 + (y % 2 ? 24 : -10) + (h(x >> 3, y) - 0.5) * 12)) }],
  // A vegetable's flesh cut: seeds (tomato), radial.
  ['seeds', (set, h) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const a = Math.atan2(y - 32, x - 32)
      const r = Math.hypot(x - 32, y - 32)
      const lob = Math.cos(a * 4) > 0.3 && r > 8 && r < 22
      set(x, y, lob ? (h(x, y) > 0.8 ? [250, 230, 150] : [235, 140, 120]) : r > 26 ? [210, 40, 40] : [240, 90, 80])
    }
  }],
  // Tea: dark amber liquid with a lighter swirl.
  ['tea', (set, h) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, mix([110, 40, 10], [170, 80, 20], (Math.sin(Math.hypot(x - 32, y - 32) * 0.6) + 1) * 0.3 + h(x, y) * 0.1)) }],
  // Clothes' denim/twill: diagonal lines.
  ['twill', (set, h) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, gray(220 + ((x + y) % 4 < 2 ? 16 : -8) + (h(x, y) - 0.5) * 10)) }],
  // A crate's slats: horizontal planks with dark gaps, a stencil.
  ['crate', (set, h, ctx, ox, oy) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, y % 16 < 2 ? gray(120) : gray(226 + (h(x >> 3, y >> 4) - 0.5) * 20))
    return () => text(ctx, 'LAGUNE', ox + 32, oy + 40, 10, 'rgba(255,255,255,0.75)')
  }],
]

export const TILE_IDS = Object.fromEntries(TILES.map(([n], i) => [n, i])) as Record<string, number>
export type TileName = (typeof TILES)[number][0]

/** The tile's corner in uv (0..1, v up as three reads canvas textures with flipY) and its size, inset 2 texels (no bleed from the neighbours). */
export function tileRect(name: string): [u0: number, v0: number, size: number] {
  const i = TILE_IDS[name] ?? 0
  const tx = i % PER_ROW
  const ty = Math.floor(i / PER_ROW)
  const inset = 2 / ATLAS
  return [tx / PER_ROW + inset, 1 - (ty + 1) / PER_ROW + inset, 1 / PER_ROW - inset * 2]
}

let atlas: THREE.CanvasTexture | null = null
/** The atlas, painted on first use, kept (one 512 px texture for every prop of every game). */
export function propAtlas(): THREE.CanvasTexture {
  if (atlas) return atlas
  const cv = document.createElement('canvas')
  cv.width = cv.height = ATLAS
  const ctx = cv.getContext('2d')!
  const img = ctx.createImageData(ATLAS, ATLAS)
  const after: (() => void)[] = []
  TILES.forEach(([, paint], i) => {
    const ox = (i % PER_ROW) * TILE
    const oy = Math.floor(i / PER_ROW) * TILE
    const set = (x: number, y: number, c: RGB) => {
      const k = ((oy + y) * ATLAS + ox + x) * 4
      img.data[k] = clamp(c[0])
      img.data[k + 1] = clamp(c[1])
      img.data[k + 2] = clamp(c[2])
      img.data[k + 3] = 255
    }
    const r = (paint as (...a: unknown[]) => (() => void) | void)(set, (x: number, y: number, k = 0) => hash(x, y, k + i * 13), ctx, ox, oy)
    if (r) after.push(r)
  })
  ctx.putImageData(img, 0, 0)
  // The texts and marks over their tiles, once the texels are down.
  for (const f of after) f()
  atlas = new THREE.CanvasTexture(cv)
  atlas.colorSpace = THREE.SRGBColorSpace
  atlas.magFilter = THREE.NearestFilter
  atlas.minFilter = THREE.LinearMipmapLinearFilter
  atlas.anisotropy = 2
  return atlas
}
