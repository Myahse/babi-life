// The bonjour toast with nothing held back: does it come on its own? (polled from the page's start)
const fs = await import('fs')
const P = JSON.parse(fs.readFileSync('/tmp/claude-0/land/video-vie-amoureuse/scripts/players.json', 'utf8'))
L.psql(`UPDATE sims SET life = jsonb_set(life, '{amour,hello}', '""') WHERE id = '${P.Awa.sim.id}'`)
if (S.ctx) await S.ctx.close().catch(() => {})
const t0 = Date.now()
const { page, ctx } = await L.open(S.b, P.Awa, { query: '?hour=8', video: { dpr: 3, noArrow: true }, extra: { 'babi-testeur': '1' } })
S.page = page; S.ctx = ctx
let seen = null, street = null
for (let k = 0; k < 400 && !seen; k++) {
  await L.sleep(250)
  const r = await page.evaluate(() => [!!globalThis.__streetReady, [...document.querySelectorAll('.toast-card')].map((e) => e.textContent).join('|')]).catch(() => [false, ''])
  if (r[0] && !street) street = Date.now() - t0
  if (/Mon cœur/.test(r[1])) { seen = { after: Date.now() - t0, t: r[1].slice(0, 120) }; await S.shot('toastfree') }
}
return { street, seen, hello: L.psql(`SELECT life->'amour'->>'hello' FROM sims WHERE id = '${P.Awa.sim.id}'`) }
