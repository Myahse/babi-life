// Shots 2b/2c: another commune's quartier from the air (S.who = 'yopougon' | 'port-bouet', S.want = a word of the
// plan's edges to pick, e.g. 'mer'), a slow drift towards that edge.
const fs = await import('fs')
if (S.ctx) await S.ctx.close().catch(() => {})
const p = JSON.parse(fs.readFileSync(`/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/vmq/pl-${S.who}.json`, 'utf8'))
const { page, ctx } = await L.open(S.b, p, { query: '?hour=17', video: { dpr: 2, noArrow: true } })
S.page = page
S.ctx = ctx
const notes = []
await L.waitFor(page, () => !!globalThis.__vueReady)
await L.sleep(3000)
await page.getByRole('button', { name: 'Pas maintenant' }).click({ timeout: 1500 }).catch(() => {})
if (await page.locator('[data-plans]').count()) {
  let chosen = 0
  for (const v of [0, 1, 2]) {
    if (v) {
      await page.evaluate(() => (globalThis.__vueReady = null))
      await page.click(`[data-plan="${v}"]`)
      await L.waitFor(page, () => !!globalThis.__vueReady)
      await L.sleep(800)
    }
    const txt = await page.evaluate(() => document.querySelector('[data-plans]')?.textContent)
    notes.push([v, txt])
    if (S.want && txt.includes(S.want)) {
      chosen = v
      break
    }
  }
  if (chosen !== 2) {
    await page.evaluate(() => (globalThis.__vueReady = null))
    await page.click(`[data-plan="${chosen}"]`)
    await L.sleep(4000)
  }
  await page.click('[data-plan-pick]')
  await L.sleep(1500)
}
await page.click('[data-lot="home"]')
await L.sleep(800)
await page.getByRole('button', { name: 'Y aller' }).click()
await page.evaluate(() => (globalThis.__streetReady = null))
await L.waitFor(page, () => !!globalThis.__streetReady && !!globalThis.__simGroup?.current, 600000)
await L.sleep(8000)
await page.evaluate(() => window.dispatchEvent(new Event('videocam')))
await L.sleep(1000)
const u = await page.evaluate(() => {
  const u = globalThis.__quartier.getState().univ
  return { edges: u.edges, lim: u.lim, carrefour: u.carrefour }
})
notes.push(u)
return notes
