// Shot 4 (252 frames, 8.4 s), all in the quartier's view (shown inset): a free lot, « Construire », « Maquis »,
// « Placer », the new maquis's pin and card, then « Gérer » with the day's earnings and the level.
const page = S.page
const fs = await import('fs')
fs.rmSync(S.F + 's4', { recursive: true, force: true })
const notes = []
await page.evaluate(() => (vclock.on(), (globalThis.__camFn = null), (globalThis.__videoCam = null), __clean(false)))
await S.keep([])
// Into the view from the street's bar, settled.
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
  await L.sleep(3000)
}
await page.evaluate(() => vclock.off())
await L.sleep(3000)
{
  const x = await boxOf(page.locator('[data-quartier-vue] [aria-label="Fermer"]'))
  notes.push(['close card', x])
  if (x) await page.mouse.click(x[0], x[1])
}
await L.sleep(2500)
await page.evaluate(() => vclock.on())
await S.step(20, 100)
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
  6: () => tapAt(6, page.locator('[data-lot="lot:1"]'), 'lot'),
  10: () => click('lot'),
  32: () => tapAt(32, page.locator('button', { hasText: /^\s*Construire ici\s*$/ }), 'construire'),
  36: async () => (await click('construire'), await S.wait(1500)),
  58: () => tapAt(58, page.locator('button', { hasText: /^\s*Maquis\s*\d/ }), 'maquis'),
  62: () => click('maquis'),
  84: () => tapAt(84, page.locator('button', { hasText: /^\s*Placer/ }), 'placer'),
  88: async () => (await click('placer'), await S.wait(3000)),
  110: async () => await S.wait(1500),
  118: () => tapAt(118, page.locator('[data-lot="lot:1"]'), 'maquis pin'),
  122: async () => (await click('maquis pin'), await S.wait(800)),
  160: () => tapAt(160, page.locator('button', { hasText: /^\s*Gérer\s*$/ }), 'gerer'),
  164: async () => (await click('gerer'), await S.wait(1500)),
}
const r = await S.capture('s4', 252, {
  before: async (i) => {
    if (plan[i]) await plan[i]()
    if (tap) {
      await S.tapRing(tap.at[0], tap.at[1], i - tap.i)
      if (i - tap.i > 12) (tap = null), await S.tapRing(0, 0, -1)
    }
  },
})
await S.tapRing(0, 0, -1)
return [r, notes]
