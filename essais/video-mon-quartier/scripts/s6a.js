// Shot 6a (54 frames, inset): the quartier's view, « Aller à Babi », the sheet « Babi en ligne », Cocody tapped.
const page = S.page
const fs = await import('fs')
fs.rmSync(S.F + 's6a', { recursive: true, force: true })
const notes = []
await page.evaluate(() => (vclock.on(), (globalThis.__camFn = null), (globalThis.__videoCam = null), __clean(false)))
await S.keep([])
const boxOf = async (loc) => {
  const n = await loc.count()
  for (let k = n - 1; k >= 0; k--) {
    const b = await loc.nth(k).boundingBox()
    if (b && b.width > 0 && b.y >= 0 && b.y < 640) return [b.x + b.width / 2, b.y + b.height / 2]
  }
  return null
}
if (!(await page.locator('[data-quartier-vue]').count())) {
  const v = await boxOf(page.locator('[data-lot-bar] button', { hasText: 'Vue du quartier' }))
  if (v) await page.mouse.click(v[0], v[1])
  await page.evaluate(() => vclock.off())
  await L.sleep(4000)
  const x = await boxOf(page.locator('[data-quartier-vue] [aria-label="Fermer"]'))
  if (x) await page.mouse.click(x[0], x[1])
  await L.sleep(2500)
  await page.evaluate(() => vclock.on())
}
await S.step(10, 100)
let tap = null
const tapAt = async (i, loc, what) => {
  const at = await boxOf(loc)
  if (!at) return notes.push(['no box', what, i])
  tap = { i, at, what }
}
const click = async (what) => {
  if (!tap) return notes.push(['nothing to click', what])
  await page.mouse.click(tap.at[0], tap.at[1])
  await S.wait(60)
  notes.push(['click', what, tap.at.map(Math.round)])
}
const plan = {
  6: () => tapAt(6, page.locator('button', { hasText: /^\s*Aller à Babi\s*$/ }), 'babi'),
  10: async () => (await click('babi'), await S.wait(1500)),
  34: () => tapAt(34, page.locator('button', { hasText: /Cocody/ }), 'cocody'),
}
const r = await S.capture('s6a', 54, {
  before: async (i) => {
    if (plan[i]) await plan[i]()
    if (tap) {
      await S.tapRing(tap.at[0], tap.at[1], i - tap.i)
      if (i - tap.i > 12) (tap = null), await S.tapRing(0, 0, -1)
    }
  },
})
notes.push(await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((t) => /Cocody|Babi|Rentrer/.test(t)).slice(0, 12)))
return [r, notes]
