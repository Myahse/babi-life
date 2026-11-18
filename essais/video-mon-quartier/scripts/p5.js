// A quick look at the chase: 3 stills a second apart (stepping the frames between).
await S.page.evaluate((i) => ((globalThis.__chase = i), (globalThis.__s5 = null), vclock.on(), __clean(true)), S.chase ?? 10)
await S.keep(['[data-overlay-host]'], ['[data-lot-bar]', '[data-yield]'])
await S.page.evaluate((src) => (globalThis.__camFn = new Function('t', 'i', 'sim', src)), S.cam5)
const out = []
for (let i = 0; i < 91; i++) {
  await S.page.evaluate((i) => ((globalThis.__videoCam = globalThis.__camFn(i / 30, i, null)), vclock.step()), i)
  await L.sleep(i % 45 === 0 ? 400 : 60)
  if (i % 45 === 0) {
    await S.shot('s5-' + i)
    out.push(await S.page.evaluate(() => globalThis.__videoCam.pos.map(Math.round)))
  }
}
return out
