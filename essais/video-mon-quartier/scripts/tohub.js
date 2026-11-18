// From the street to the sheet « Babi en ligne » (no capture), in real time.
const page = S.page
await page.evaluate(() => (vclock.off(), (globalThis.__videoCam = null), __clean(false)))
const boxOf = async (loc) => {
  const n = await loc.count()
  for (let k = n - 1; k >= 0; k--) {
    const b = await loc.nth(k).boundingBox()
    if (b && b.width > 0 && b.y >= 0 && b.y < 640) return [b.x + b.width / 2, b.y + b.height / 2]
  }
  return null
}
const v = await boxOf(page.locator('[data-lot-bar] button', { hasText: 'Vue du quartier' }))
if (v) await page.mouse.click(v[0], v[1])
await L.sleep(4000)
const x = await boxOf(page.locator('[data-quartier-vue] [aria-label="Fermer"]'))
if (x) await page.mouse.click(x[0], x[1])
await L.sleep(1500)
const b = await boxOf(page.locator('button', { hasText: /^\s*Aller à Babi\s*$/ }))
if (b) await page.mouse.click(b[0], b[1])
await L.sleep(2500)
return [v, x, b]
