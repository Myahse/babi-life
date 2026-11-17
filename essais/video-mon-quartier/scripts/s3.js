// Shot 3 (9 s): Awa walking towards the camera on her street, then the camera rises straight over her and out over
// the whole quartier, turning to the lagoon and the Plateau (south).
S.cam3 = S.ease + `
const A = 2.4, T = 9
const s = globalThis.__s3 ?? (globalThis.__s3 = { at: sim.slice(0, 3) })
s.at[0] += (sim[0] - s.at[0]) * 0.25
s.at[2] += (sim[2] - s.at[2]) * 0.25
const k = E((t - A) / (T - A))
const d = 8.5 * Math.pow(430 / 8.5, k)
const pol = k < 0.3 ? L(1.12, 0.3, E(k / 0.3)) : L(0.3, 1.12, E((k - 0.3) / 0.7))
const az = 1.19 + 0.06 * Math.min(t, A) / A + 1.99 * E(k)
const k2 = Math.pow((d - 8.5) / 421.5, 1.7)
const tgt = [L(s.at[0], 80, k2), L(1.1, 0, k2), L(s.at[2], 220, k2)]
const hz = Math.sin(pol) * d
return { pos: [tgt[0] + Math.sin(az) * hz, tgt[1] + Math.cos(pol) * d, tgt[2] + Math.cos(az) * hz], look: tgt, fov: 45 }`
S.walk3 = async () => {
  return await S.page.evaluate(() => {
    globalThis.__s3 = null
    const g = globalThis.__simGroup.current
    const want = [g.position.x + 40, g.position.z]
    const n = globalThis.__nav.nearest(want, 20)
    const to = n ? n.at : want
    globalThis.__walkTo?.(to[0], to[1])
    return [g.position.x, g.position.z, to]
  })
}
return 'ok'
