// Walkable straight lines near the roundabout with nothing tall within 14 m (a clear pull-up), heading east.
return await S.page.evaluate(() => {
  const nav = globalThis.__nav
  const c = globalThis.__quartier.getState().univ.carrefour
  const tall = (x, z, r) => {
    let h = 0
    for (let a = -r; a <= r; a += 3) for (let b = -r; b <= r; b += 3) h = Math.max(h, nav.roofAt ? nav.roofAt(x + a, z + b) : 0)
    return h
  }
  const out = []
  for (let dx = -120; dx <= 120; dx += 6)
    for (let dz = -120; dz <= 120; dz += 6) {
      const x = c[0] + dx, z = c[1] + dz
      let ok = true
      for (let s = 0; s <= 30; s += 3) if (!nav.walkable(x + s, z)) ok = false
      if (!ok) continue
      const h = Math.max(tall(x, z, 14), tall(x + 15, z, 14), tall(x + 30, z, 14))
      if (h < 0.5) out.push([Math.round(x), Math.round(z), Math.round(Math.hypot(dx, dz))])
    }
  out.sort((a, b) => a[2] - b[2])
  return { c, n: out.length, near: out.slice(0, 15), roofFn: !!nav.roofAt }
})
