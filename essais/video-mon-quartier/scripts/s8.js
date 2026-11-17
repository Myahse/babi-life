// Shot 8 (66 frames, inset): the city's screen as played, the bar « Rentrer au quartier » tapped.
const page = S.page
const fs = await import('fs')
fs.rmSync(S.F + 's8', { recursive: true, force: true })
await page.getByRole('button', { name: 'Pas maintenant' }).click({ timeout: 1500 }).catch(() => {})
await page.evaluate(() => ((globalThis.__camFn = null), (globalThis.__videoCam = null), __clean(false)))
await S.step(30, 150)
const loc = page.locator('button', { hasText: /Rentrer/ })
const b = (await loc.count()) ? await loc.first().boundingBox() : null
const at = b ? [b.x + b.width / 2, b.y + b.height / 2] : null
const r = await S.capture('s8', 66, {
  before: async (i) => {
    if (at && i >= 34 && i <= 47) await S.tapRing(at[0], at[1], i - 34)
    if (i === 48) await S.tapRing(0, 0, -1)
  },
})
return [r, at, await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((t) => /Rentrer|Babi/.test(t)))]
