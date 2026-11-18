import { browserOf, player, open, waitFor, sleep, call } from './lib.mjs'
import { writeFileSync } from 'fs'
const OUT = '/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/vmq/ex'
const commune = process.argv[2] ?? 'cocody'
const hour = process.argv[3] ?? '17.5'
const b = await browserOf()
const p = await player(commune, 'Awa')
writeFileSync(`${OUT}-${commune}-player.json`, JSON.stringify(p))
const { page } = await open(b, p, { query: `?hour=${hour}` })
const shot = (n) => page.screenshot({ path: `${OUT}-${commune}-${n}.jpg`, quality: 85, type: 'jpeg' }).then(() => console.log('shot', n))
await waitFor(page, () => !!globalThis.__vueReady)
await sleep(3000)
await page.getByRole('button', { name: 'Pas maintenant' }).click({ timeout: 1500 }).catch(() => {})
await shot('vue')
for (const v of [1, 2]) {
  await page.evaluate(() => (globalThis.__vueReady = null))
  await page.click(`[data-plan="${v}"]`)
  await waitFor(page, () => !!globalThis.__vueReady)
  await sleep(1500)
  await shot('plan' + v)
}
await page.click(`[data-plan="0"]`)
await sleep(4000)
await page.click('[data-plan-pick]')
await sleep(1500)
await shot('picked')
await page.click('[data-lot="home"]')
await sleep(800)
await shot('home-card')
await page.getByRole('button', { name: 'Y aller' }).click()
await page.evaluate(() => (globalThis.__streetReady = null))
const ms = await waitFor(page, () => !!globalThis.__streetReady && !!globalThis.__simGroup?.current, 600000)
console.log('street ready', ms)
await sleep(8000)
await shot('street')
// Timing: virtual steps.
await page.evaluate(() => vclock.on())
for (let i = 0; i < 3; i++) {
  const t0 = Date.now()
  await page.evaluate(() => vclock.step())
  const t1 = Date.now()
  await page.screenshot({ path: `${OUT}-${commune}-v${i}.jpg`, quality: 92, type: 'jpeg' })
  console.log('step', t1 - t0, 'shot', Date.now() - t1)
}
await page.evaluate(() => vclock.off())
console.log(JSON.stringify(await page.evaluate(() => ({ cam: globalThis.__quartier.getState().scene, sim: globalThis.__simGroup.current.position.toArray().map(Math.round), univ: Object.keys(globalThis.__quartier.getState().univ ?? {}) }))))
process.exit(0)
