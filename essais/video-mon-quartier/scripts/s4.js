// Shot 4 (252 frames, 8.4 s): at a free lot, « Construire ici », the sheet, « Maquis », « Placer », the maquis there,
// then « Gérer » with the day's earnings and the level.
const page = S.page
const fs = await import('fs')
fs.rmSync(S.F + 's4', { recursive: true, force: true })
const ST = [142, -72]
const LOT = [128, -73]
await page.evaluate(() => (vclock.on(), (globalThis.__videoCam = null)))
await S.place(ST, LOT)
await S.keep(['[data-lot-bar]'])
await S.step(30, 120)
S.cam4 = S.ease + `
if (i < 108) return { pos: [151.5, 7.2, -64.8], look: [134.5, 0.8, -72.5], fov: 45 }
const k = E((i - 108) / 59)
const az = L(0.95, 1.6, Math.min(1, (i - 108) / 59) * 0.6 + k * 0.4)
const r = L(26, 22, k)
return { pos: [128 + Math.sin(az) * r, L(13, 10, k), -73 + Math.cos(az) * r], look: [128, 2.2, -73], fov: 45 }`
const notes = []
let tap = null
const ring = async (i) => {
  if (!tap) return S.tapRing(0, 0, -1)
  await S.tapRing(tap.at[0], tap.at[1], i - tap.i)
  if (i - tap.i > 12) tap = null
}
const tapOn = async (i, loc) => {
  const b = await loc.boundingBox()
  if (!b) return notes.push(['no box', i])
  tap = { i, at: [b.x + b.width / 2, b.y + b.height / 2] }
}
const r = await S.capture('s4', 252, {
  cam: S.cam4,
  clean: true,
  before: async (i) => {
    if (i === 24) await tapOn(i, page.locator('[data-lot-bar] [aria-label="Construire ici"]'))
    if (i === 28) {
      await page.locator('[data-lot-bar] [aria-label="Construire ici"]').click({ force: true, timeout: 3000 }).catch((e) => notes.push(['construire', String(e).slice(0, 100)]))
      await L.sleep(1500)
    }
    if (i === 42) await page.evaluate(() => __clean(false))
    if (i === 50) {
      const it = page.locator('button', { hasText: 'Maquis' }).first()
      await it.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {})
      await tapOn(i, it)
    }
    if (i === 54) await page.locator('button', { hasText: 'Maquis' }).first().click({ force: true, timeout: 3000 }).catch((e) => notes.push(['maquis', String(e).slice(0, 100)]))
    if (i === 74) await tapOn(i, page.locator('button', { hasText: 'Placer' }).first())
    if (i === 78) {
      await page.locator('button', { hasText: 'Placer' }).first().click({ force: true, timeout: 3000 }).catch((e) => notes.push(['placer', String(e).slice(0, 100)]))
      await L.sleep(2500)
    }
    if (i === 100) await L.sleep(2000)
    if (i === 108) (await page.evaluate(() => __clean(true)), await S.keep([]))
    if (i === 160) {
      // « Gérer » from the lot bar (hidden in the clean frames), so its sheet is coming in at the cut.
      const g = page.locator('[data-lot-bar] button', { hasText: 'Gérer' }).first()
      const n = await g.count()
      notes.push(['gerer buttons', n, await page.evaluate(() => document.querySelector('[data-lot-bar]')?.textContent)])
      if (n) await g.click({ force: true, timeout: 3000 }).catch((e) => notes.push(['gerer', String(e).slice(0, 100)]))
      await L.sleep(2000)
    }
    if (i === 168) await page.evaluate(() => __clean(false))
    await ring(i)
  },
})
await S.tapRing(0, 0, -1)
return [r, notes]
