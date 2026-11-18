// Shot 6m (inset, 150 frames): « Aménager » in the quartier's view: water, a road over the canal (bridges), trees,
// « Valider ». Strokes are dragged one step per frame, a finger ring drawn where the pointer is.
const page = S.page
const fs = await import('fs')
await page.evaluate(() => vclock.off())
if (await page.locator('[data-amenager-panel]').count()) await page.click('[data-amenager-panel] [aria-label="Fermer"]')
await L.sleep(1500)
await page.evaluate(() => (vclock.on(), (globalThis.__camFn = null), (globalThis.__videoCam = null), __clean(false)))
await S.keep([])
await S.step(6, 100)
const name = 's6m'
fs.rmSync(S.F + name, { recursive: true, force: true })
const notes = []
const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
const strokes = [
  { tool: 'e', t: 18, a: 24, b: 42, from: [230, 125], to: [350, 118] },
  { tool: 'r', t: 48, a: 54, b: 76, from: [110, 330], to: [350, 330] },
  { tool: 'a', t: 82, a: 88, b: 108, from: [200, 385], to: [340, 420] },
]
let ring = null
const center = async (sel) => {
  const b = await page.locator(sel).first().boundingBox()
  return [b.x + b.width / 2, b.y + b.height / 2]
}
const r = await S.capture(name, 150, {
  before: async (i) => {
    if (i === 4) ring = { i, at: await center('[data-amenager]') }
    if (i === 8) { await page.mouse.click(...ring.at); await S.wait(1500) }
    for (const s of strokes) {
      if (i === s.t) ring = { i, at: await center(`[data-tool="${s.tool}"]`) }
      if (i === s.t + 3) { await page.mouse.click(...ring.at); await S.wait(100) }
      if (i >= s.a && i <= s.b) {
        const p = lerp(s.from, s.to, (i - s.a) / (s.b - s.a))
        if (i === s.a) { await page.mouse.move(...p); await page.mouse.down() } else await page.mouse.move(...p)
        if (i === s.b) await page.mouse.up()
        ring = { i, at: p, hold: true }
      }
    }
    if (i === 114) ring = { i, at: await center('[data-amenager-ok]') }
    if (i === 118) {
      notes.push(await page.locator('[data-amenager-panel]').innerText())
      await page.mouse.click(...ring.at)
      await S.wait(7000)
    }
    if (ring) {
      const k = ring.hold ? 0 : i - ring.i
      await S.tapRing(ring.at[0], ring.at[1], k)
      if (k > 12 || (ring.hold && i > ring.i)) (ring = null), await S.tapRing(0, 0, -1)
    }
  },
})
await S.tapRing(0, 0, -1)
return [r, notes]
