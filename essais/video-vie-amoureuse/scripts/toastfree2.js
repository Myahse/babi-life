// Films the bonjour toast with nothing held back: the clock goes virtual as the game asks for « Mon cœur ».
const fs = await import('fs')
const P = JSON.parse(fs.readFileSync('/tmp/claude-0/land/video-vie-amoureuse/scripts/players.json', 'utf8'))
L.psql(`UPDATE sims SET life = jsonb_set(life, '{amour,hello}', '""') WHERE id = '${P.Awa.sim.id}'`)
await L.call(P.Awa.token, `/sims/${P.Awa.sim.id}/tester`, 'POST', { action: 'needs' }).catch(() => {})
if (S.ctx) await S.ctx.close().catch(() => {})
const { page, ctx } = await L.open(S.b, P.Awa, { query: '?hour=8', video: { dpr: 3, noArrow: true }, extra: { 'babi-testeur': '1' } })
S.page = page; S.ctx = ctx
await page.route('**/around', async (r) => { const res = await r.fetch(); const j = await res.json().catch(() => null); if (j && j.invites) j.invites = []; await r.fulfill({ response: res, body: JSON.stringify(j) }) })
await page.waitForRequest((r) => /\/amour$/.test(r.url()) && r.method() === 'GET', { timeout: 120000 })
await page.evaluate(() => vclock.on())
await S.css('body.clean .toast-card, body.clean .toast-card *{visibility:visible!important}')
let seen = -1
const r = await S.tapShot('toast2', 600, [], { each: async (i) => {
  await page.evaluate(() => __clean(true))
  const has = await page.evaluate(() => [...document.querySelectorAll('.toast-card')].some((e) => /Mon cœur/.test(e.textContent ?? '')))
  if (has && seen < 0) seen = i
  if (seen >= 0 && i - seen > 90) return 'stop'
} })
r.seen = seen
return r
