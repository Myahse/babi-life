// Stills from given cameras: S.cams = [[name, pos, look, fov]]
const page = S.page
const D = '/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/vmq/'
await page.evaluate(() => __clean(true))
await page.evaluate(() => vclock.on())
const out = []
for (const [name, pos, look, fov] of S.cams) {
  await page.evaluate((c) => (globalThis.__videoCam = c), { pos, look, fov: fov ?? 45 })
  for (let i = 0; i < (S.warm ?? 4); i++) {
    await page.evaluate(() => vclock.step())
    await L.sleep(S.warmMs ?? 400)
  }
  const t0 = Date.now()
  await page.screenshot({ path: D + 'st-' + name + '.jpg', type: 'jpeg', quality: 85, timeout: 0 })
  out.push([name, Date.now() - t0])
}
return out
