// Into Babi (Cocody, the big open city), in real time until its street is there.
const page = S.page
const notes = []
const loc = page.locator('button', { hasText: /Cocody/ })
const n = await loc.count()
let at = null
for (let k = n - 1; k >= 0; k--) {
  const b = await loc.nth(k).boundingBox()
  if (b && b.y >= 0 && b.y < 640) at = [b.x + b.width / 2, b.y + b.height / 2]
}
notes.push(['cocody at', at])
await page.evaluate(() => (globalThis.__streetReady = null))
if (at) await page.mouse.click(at[0], at[1])
await page.evaluate(() => vclock.off())
const t0 = Date.now()
await L.waitFor(page, () => !!globalThis.__streetReady && !!globalThis.__simGroup?.current && !globalThis.__quartier.getState().active, 900000).catch((e) => notes.push(String(e).slice(0, 100)))
notes.push(['city in', Date.now() - t0])
await L.sleep(20000)
await page.evaluate(() => window.dispatchEvent(new Event('videocam')))
await L.sleep(1000)
notes.push(await page.evaluate(() => ({ q: globalThis.__quartier.getState().active, sim: globalThis.__simGroup.current.position.toArray().map(Math.round), buttons: [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((t) => /Rentrer|quartier/.test(t)).slice(0, 5) })))
await page.evaluate(() => vclock.on())
await S.shot('city-ui')
return notes
