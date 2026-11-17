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
return { ms }
