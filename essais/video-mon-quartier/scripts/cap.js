// S.capture(dir, n, { cam: 'js body of (t, i, sim) => {pos, look, fov} | null', before(i), after(i), from, clean })
const fs = await import('fs')
S.F = '/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/vmq/frames/'
S.capture = async (name, n, o = {}) => {
  const page = S.page
  const dir = S.F + name
  fs.mkdirSync(dir, { recursive: true })
  await page.evaluate(() => vclock.on())
  if (o.clean !== undefined) await page.evaluate((c) => __clean(c), o.clean)
  await page.evaluate((src) => (globalThis.__camFn = src ? new Function('t', 'i', 'sim', src) : null), o.cam ?? null)
  for (let k = 0; k < (o.pre ?? 0); k++) {
    await page.evaluate(() => {
      const g = globalThis.__simGroup?.current
      const sim = g ? [g.position.x, g.position.y, g.position.z, g.rotation.y] : null
      if (globalThis.__camFn) globalThis.__videoCam = globalThis.__camFn(0, 0, sim)
      vclock.step()
    })
    await L.sleep(250)
  }
  if (o.go) await o.go()
  const t0 = Date.now()
  for (let i = o.from ?? 0; i < n; i++) {
    if (o.before) await o.before(i)
    await page.evaluate((i) => {
      const g = globalThis.__simGroup?.current
      const sim = g ? [g.position.x, g.position.y, g.position.z, g.rotation.y] : null
      if (globalThis.__camFn) globalThis.__videoCam = globalThis.__camFn(i / 30, i, sim)
      vclock.step()
    }, i)
    if (o.after) await o.after(i)
    await page.screenshot({ path: `${dir}/${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 93, timeout: 0 })
    if (i % 10 === 0) console.log(name, i, '/', n, Math.round((Date.now() - t0) / 1000) + 's')
  }
  return { name, n, s: Math.round((Date.now() - t0) / 1000) }
}
// Eased: 0..1
S.ease = 'const E = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x)); const L = (a, b, k) => a + (b - a) * k;'
// A tap ring at (x, y) css px, at its frame k (0..12) — drawn as a DOM ring, shown over the game.
S.tapRing = async (x, y, k) => {
  await S.page.evaluate(({ x, y, k }) => {
    let el = document.getElementById('vtap')
    if (!el) {
      el = document.createElement('div')
      el.id = 'vtap'
      el.style.cssText = 'position:fixed;z-index:99999;pointer-events:none;border-radius:50%;border:3px solid rgba(255,255,255,.95);background:rgba(255,255,255,.35);box-shadow:0 0 0 2px rgba(0,0,0,.25)'
      document.body.appendChild(el)
    }
    if (k < 0 || k > 12) return void (el.style.display = 'none')
    const r = 14 + k * 1.6
    el.style.display = 'block'
    el.style.opacity = String(1 - k / 13)
    el.style.left = x - r + 'px'
    el.style.top = y - r + 'px'
    el.style.width = el.style.height = 2 * r + 'px'
  }, { x, y, k })
}
S.box = async (sel) => {
  const b = await S.page.locator(sel).first().boundingBox()
  return b ? [b.x + b.width / 2, b.y + b.height / 2] : null
}
return 'ok'
