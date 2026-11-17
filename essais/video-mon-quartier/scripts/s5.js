// Shot 5 (210 frames, 7 s): riding along behind a woro-woro through the quartier, the traffic round it; the toast
// « Koffi visite ton quartier » at frame 120.
S.cam5 = S.ease + `
const car = globalThis.__roamCars[globalThis.__chase].r.at
const s = globalThis.__s5 ?? (globalThis.__s5 = { p: [car.x, car.z], h: null, last: [car.x, car.z] })
const dx = car.x - s.last[0], dz = car.z - s.last[1]
s.last = [car.x, car.z]
if (Math.hypot(dx, dz) > 0.02) {
  const h = Math.atan2(dx, dz)
  if (s.h === null) s.h = h
  let d = h - s.h
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  s.h += d * 0.06
}
const h = s.h ?? 0
s.p[0] += (car.x - s.p[0]) * 0.2
s.p[1] += (car.z - s.p[1]) * 0.2
const f = [Math.sin(h), Math.cos(h)], side = [Math.cos(h), -Math.sin(h)]
return { pos: [s.p[0] - f[0] * 13 + side[0] * 4, 6.5, s.p[1] - f[1] * 13 + side[1] * 4], look: [s.p[0] + f[0] * 10, 1.2, s.p[1] + f[1] * 10], fov: 50 }`
S.s5run = async () => {
  const fs = await import('fs')
  fs.rmSync(S.F + 's5', { recursive: true, force: true })
  await S.page.evaluate((i) => ((globalThis.__chase = i), (globalThis.__s5 = null)), S.chase ?? 10)
  await S.keep(['[data-overlay-host]'], ['[data-lot-bar]', '[data-yield]'])
  return await S.capture('s5', 210, {
    cam: S.cam5,
    clean: true,
    pre: 12,
    before: async (i) => {
      if (i === 120) {
        await S.page.evaluate(() => window.dispatchEvent(new CustomEvent('babi:quartier-visit-in', { detail: { from: 'koffi', name: 'Koffi' } })))
        await S.wait(400)
      }
    },
  })
}
return 'ok'
