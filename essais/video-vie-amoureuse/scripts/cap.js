// S.capture(name, n, { before(i), after(i), clean }) + helpers (v3's cap.js/keep.js, for this video's folders).
const fs = await import('fs')
S.W = '/tmp/claude-0/land/video-vie-amoureuse/'
S.F = S.W + 'frames/'
S.P = S.W + 'prev/'
fs.mkdirSync(S.P, { recursive: true })
S.capture = async (name, n, o = {}) => {
  const page = S.page
  const dir = S.F + name
  fs.mkdirSync(dir, { recursive: true })
  await page.evaluate(() => vclock.on())
  const t0 = Date.now()
  for (let i = o.from ?? 0; i < n; i++) {
    if (o.before) { const r = await o.before(i); if (r === 'stop') return { name, n: i, stopped: true } }
    await page.evaluate(() => vclock.step())
    if (o.after) await o.after(i)
    await page.screenshot({ path: `${dir}/${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 93, timeout: 0 })
    if (i % 30 === 0) console.log(name, i, '/', n, Math.round((Date.now() - t0) / 1000) + 's')
  }
  return { name, n, s: Math.round((Date.now() - t0) / 1000) }
}
S.step = async (n = 1, ms = 1000 / 30) => {
  for (let i = 0; i < n; i++) await S.page.evaluate((ms) => vclock.step(ms), ms)
}
S.shot = async (name) => {
  await S.page.screenshot({ path: `${S.P}${name}.jpg`, type: 'jpeg', quality: 80, timeout: 0 })
  return name
}
S.css = async (txt) => {
  await S.page.evaluate((txt) => {
    let st = document.getElementById('vcss')
    if (!st) { st = document.createElement('style'); st.id = 'vcss'; document.head.appendChild(st) }
    st.textContent = txt
  }, txt)
}
// A tap ring drawn in the page at (x, y) css px, frame k (0..12).
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
// A DOM click in the page itself (no actionability wait on the paused clock).
S.click = async (sel) => S.page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return false; e.click(); return true }, sel)
return 'ok'
