// Shot 4v (inset, ~3.7 s): in the quartier's view, the free lot 6 tapped, « Construire ici », « Maquis », « Placer ».
const page = S.page
await page.evaluate(() => (vclock.on(), (globalThis.__camFn = null), (globalThis.__videoCam = null), __clean(false)))
await S.keep([])
await S.step(10, 100)
const lot = page.locator('[data-lot="lot:6"]')
return await S.uiShot('s4v', S.n4v ?? 112, {
  4: (h) => h.tapAt(4, lot, 'lot'),
  8: async (h) => (await h.click('lot', 1200)),
  26: (h) => h.tapAt(26, page.locator('button', { hasText: /^\s*Construire ici\s*$/ }), 'construire'),
  30: async (h) => await h.click('construire', 1500),
  50: (h) => h.tapAt(50, page.locator('button', { hasText: /^\s*Maquis\s*\d/ }), 'maquis'),
  54: async (h) => await h.click('maquis', 600),
  72: (h) => h.tapAt(72, page.locator('button', { hasText: /^\s*Placer/ }), 'placer'),
  76: async (h) => (await h.click('placer', 3000)),
  90: async () => await S.wait(1500),
})
