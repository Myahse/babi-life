const page = S.page
await page.evaluate(() => vclock.on())
await page.evaluate((src) => (globalThis.__camFn = new Function('t', 'i', 'sim', src)), S.cam3)
await S.walk3()
const out = []
for (let i = 0; i < 160; i++) {
  const r = await page.evaluate((i) => {
    const g = globalThis.__simGroup.current
    const sim = [g.position.x, g.position.y, g.position.z, g.rotation.y]
    const c = globalThis.__camFn(i / 30, i, sim)
    globalThis.__videoCam = c
    vclock.step()
    return [i, sim.map((v) => +v.toFixed(1)), c.pos.map((v) => +v.toFixed(1)), c.look.map((v) => +v.toFixed(1)), g.visible, g.parent?.type]
  }, i)
  if (i % 10 === 0) out.push(r)
  await L.sleep(30)
}
return out
