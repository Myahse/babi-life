const fs = await import('fs')
// Taps planned as [frame, selector] (ring from frame f-3, the click at f), captured n frames.
S.tapShot = async (name, n, taps, o = {}) => {
  const page = S.page
  const dir = S.F + name
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  await page.evaluate(() => vclock.on())
  let ring = null
  for (let i = 0; i < n; i++) {
    for (const [f, sel] of taps) {
      if (i === f - 3) { const b = await S.box(sel); if (b) ring = [b[0], b[1], i]; else log('no ' + sel + ' at ' + i) }
      if (i === f) await S.click(sel)
    }
    if (ring) { const k = i - ring[2]; await S.tapRing(ring[0], ring[1], k); if (k > 12) ring = null }
    if (o.each) { const r = await o.each(i); if (r === 'stop') return { name, n: i } }
    await page.evaluate(() => vclock.step())
    await page.screenshot({ path: `${dir}/${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 93, timeout: 0 })
  }
  return { name, n }
}
return 1
