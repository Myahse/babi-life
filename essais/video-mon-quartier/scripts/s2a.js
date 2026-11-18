// Shot 2a (84 frames, 2.8 s): a new player of Cocody, its quartier's view and « Choisis le plan de ton quartier »:
// Plan 2, then Plan 3 tapped (the world redrawn each time).
const fs = await import('fs')
const page0 = S.page
if (S.ctx) await S.ctx.close().catch(() => {})
const p = JSON.parse(fs.readFileSync('/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/vmq/pl-cocody.json', 'utf8'))
const { page, ctx } = await L.open(S.b, p, { query: '?hour=17', video: { dpr: 2, noArrow: true } })
S.page = page
S.ctx = ctx
await L.waitFor(page, () => !!globalThis.__vueReady)
await L.sleep(3000)
await page.getByRole('button', { name: 'Pas maintenant' }).click({ timeout: 1500 }).catch(() => {})
await L.sleep(1000)
const notes = []
fs.rmSync(S.F + 's2a', { recursive: true, force: true })
let tap = null
const boxOf = async (sel) => {
  const b = await page.locator(sel).first().boundingBox()
  return b ? [b.x + b.width / 2, b.y + b.height / 2] : null
}
await page.evaluate(() => vclock.on())
await S.step(6, 100)
const plan = {
  8: async () => (tap = { i: 8, at: await boxOf('[data-plan="1"]') }),
  12: async () => {
    await page.evaluate(() => (globalThis.__vueReady = null))
    await page.mouse.click(tap.at[0], tap.at[1])
    const t0 = Date.now()
    while (Date.now() - t0 < 20000 && !(await page.evaluate(() => !!globalThis.__vueReady))) await S.wait(200)
    await S.wait(300)
    notes.push(['plan 2', Date.now() - t0, await page.evaluate(() => document.querySelector('[data-plans]')?.textContent)])
  },
  44: async () => (tap = { i: 44, at: await boxOf('[data-plan="2"]') }),
  48: async () => {
    await page.evaluate(() => (globalThis.__vueReady = null))
    await page.mouse.click(tap.at[0], tap.at[1])
    const t0 = Date.now()
    while (Date.now() - t0 < 20000 && !(await page.evaluate(() => !!globalThis.__vueReady))) await S.wait(200)
    await S.wait(300)
    notes.push(['plan 3', Date.now() - t0, await page.evaluate(() => document.querySelector('[data-plans]')?.textContent)])
  },
}
const r = await S.capture('s2a', 84, {
  before: async (i) => {
    if (plan[i]) await plan[i]()
    if (tap && tap.at) {
      await S.tapRing(tap.at[0], tap.at[1], i - tap.i)
      if (i - tap.i > 12) (tap = null), await S.tapRing(0, 0, -1)
    }
  },
})
await S.tapRing(0, 0, -1)
return [r, notes]
