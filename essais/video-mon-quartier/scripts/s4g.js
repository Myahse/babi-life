// Shot 4g (inset, ~3 s): « Gérer », the day's earnings, « Encaisser » tapped on the maquis.
const page = S.page
await page.evaluate(() => (vclock.on(), (globalThis.__camFn = null), (globalThis.__videoCam = null), __clean(false)))
await S.keep([])
await S.step(4, 100)
return await S.uiShot('s4g', S.n4g ?? 96, {
  2: (h) => h.tapAt(2, page.locator('button', { hasText: /^\s*Gérer\s*$/ }), 'gerer'),
  6: async (h) => await h.click('gerer', 1500),
  40: (h) => h.tapAt(40, page.locator('button', { hasText: /Encaisser/ }), 'encaisser'),
  44: async (h) => await h.click('encaisser', 2000),
})
