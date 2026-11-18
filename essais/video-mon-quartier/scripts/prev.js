// S.preview(name, camSrc, idxs, warm): one still per index (the camera at that index), into prev/
const fs = await import('fs')
S.preview = async (name, cam, idxs, warm = 3) => {
  const page = S.page
  const D = '/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/vmq/prev/'
  fs.mkdirSync(D, { recursive: true })
  await page.evaluate(() => (vclock.on(), __clean(true)))
  await page.evaluate((src) => (globalThis.__camFn = new Function('t', 'i', 'sim', src)), cam)
  const out = []
  for (const i of idxs) {
    for (let k = 0; k < warm; k++) {
      await page.evaluate((i) => {
        const g = globalThis.__simGroup?.current
        const sim = g ? [g.position.x, g.position.y, g.position.z, g.rotation.y] : null
        globalThis.__videoCam = globalThis.__camFn(i / 30, i, sim)
        vclock.step()
      }, i)
      await L.sleep(500)
    }
    const t0 = Date.now()
    await page.screenshot({ path: `${D}${name}-${i}.jpg`, type: 'jpeg', quality: 80, timeout: 0 })
    out.push([i, Date.now() - t0])
  }
  return out
}
return 'ok'
