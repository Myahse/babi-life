// Opens S.p's game with S.q (query) and S.dpr, then straight into the street.
if (S.ctx) await S.ctx.close().catch(() => {})
const p = S.p ?? JSON.parse((await import('fs')).readFileSync('/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/vmq/ex-cocody-player.json', 'utf8'))
S.p = p
const { page, ctx } = await L.open(S.b, p, { query: S.q ?? '?hour=17', video: { dpr: S.dpr ?? 2, noArrow: true } })
S.page = page
S.ctx = ctx
await L.waitFor(page, () => !!globalThis.__vueReady || !!globalThis.__streetReady)
await L.sleep(2500)
await page.getByRole('button', { name: 'Pas maintenant' }).click({ timeout: 1500 }).catch(() => {})
if (S.stayVue) return 'vue'
await page.click('[data-lot="home"]')
await L.sleep(800)
await page.getByRole('button', { name: 'Y aller' }).click()
await page.evaluate(() => (globalThis.__streetReady = null))
const ms = await L.waitFor(page, () => !!globalThis.__streetReady && !!globalThis.__simGroup?.current, 600000)
await L.sleep(8000)
await page.evaluate(() => window.dispatchEvent(new Event('videocam')))
// The world's clock moved to S.shiftTo (UTC hour, Abidjan time) of the next day it falls on: the street's people by day.
let shift = 0
if (S.shiftTo !== undefined) {
  const now = Date.now()
  const d = new Date(now)
  let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), Math.floor(S.shiftTo), Math.round((S.shiftTo % 1) * 60))
  if (t < now) t += 86400000
  shift = t - now
  await page.evaluate((s) => vclock.on(s), shift)
  await S.step(60, 120)
}
return { ms, shift }
