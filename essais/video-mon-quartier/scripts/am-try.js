const page = S.page
const cnt = async () => +(((await page.locator('[data-amenager-panel]').innerText()).match(/(\d+) cases/) || [0, 0])[1])
const stroke = async (a, b, n = 20) => { await page.mouse.move(...a); await page.mouse.down(); for (let i = 0; i <= n; i++) { await page.mouse.move(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n); await L.sleep(30) } await page.mouse.up() }
const C = [
  ['e', [20, 300], [20, 410]], ['e', [200, 400], [350, 400]], ['e', [230, 120], [350, 120]], ['e', [10, 130], [120, 160]],
  ['r', [60, 420], [130, 320]], ['r', [120, 330], [350, 330]], ['r', [150, 300], [350, 380]],
  ['a', [10, 120], [170, 120]], ['a', [250, 60], [350, 160]], ['a', [5, 200], [20, 280]], ['a', [200, 380], [340, 420]],
]
const out = []
for (const [t, a, b] of C) {
  await page.click(`[data-tool="${t}"]`)
  const n0 = await cnt()
  await stroke(a, b)
  await L.sleep(200)
  out.push([t, a, b, (await cnt()) - n0])
  await page.click('[data-amenager-panel] [aria-label="Fermer"]'); await L.sleep(500)
  await page.click('[data-amenager]'); await L.sleep(1200)
}
await S.shot('am11')
return out
