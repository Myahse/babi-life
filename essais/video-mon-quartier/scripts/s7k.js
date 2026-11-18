// Shot 7k (inset, 84 frames): in one's view, « Quartiers de tes amis » → Koffi: his quartier (Yopougon, niv. 5) drawn.
const page = S.page
await page.evaluate(() => (vclock.on(), (globalThis.__camFn = null), (globalThis.__videoCam = null), __clean(false)))
await S.keep([])
await S.step(150, 20)
const koffi = page.locator('button', { hasText: /Koffi/ })
return await S.uiShot('s7k', S.n7k ?? 84, {
  4: (h) => h.tapAt(4, koffi, 'koffi'),
  8: async (h) => {
    await page.evaluate(() => (globalThis.__vueReady = null))
    await h.click('koffi', 300)
    const t0 = Date.now()
    while (Date.now() - t0 < 30000 && !(await page.evaluate(() => !!globalThis.__vueReady))) await S.wait(250)
    await S.wait(800)
    h.notes.push(['ready', Date.now() - t0])
  },
})
