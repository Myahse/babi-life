// Explore the build flow: the Sim at a free lot near home, its bar, the Construire sheet.
const page = S.page
await page.evaluate(() => (vclock.on(), __clean(false), (globalThis.__videoCam = null)))
const lots = await page.evaluate(() => globalThis.__quartier.getState().univ.lots.map((l, i) => [i, l.street.map(Math.round), l.at.map(Math.round)]))
const pick = +(S.lotPick ?? 1)
const l = lots[pick]
await S.place(l[1], l[2])
await S.step(40, 150)
const bar = await page.evaluate(() => [document.querySelector('[data-lot-bar]')?.getAttribute('data-lot-bar'), document.querySelector('[data-lot-bar]')?.textContent])
await S.shot('e4-bar')
return { bar, lots: lots.slice(0, 12) }
