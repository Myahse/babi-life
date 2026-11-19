const fs = await import('fs')
const runLoad = async () => { const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor; return new AsyncFunction('L', 'S', 'log', fs.readFileSync('/tmp/claude-0/land/video-vie-amoureuse/scripts/load.js', 'utf8'))(L, S, log) }
const P = JSON.parse(fs.readFileSync('/tmp/claude-0/land/video-vie-amoureuse/scripts/players.json', 'utf8'))
L.psql(`UPDATE sims SET life = jsonb_set(life, '{amour,hello}', '""') WHERE id = '${P.Awa.sim.id}'`)
S.who = 'Awa'; S.q = S.toastQ ?? ''; S.settle = 300; S.pre = null; S.hold = true; S.holdMs = S.toastHold ?? 30000
await L.call(P.Awa.token, `/sims/${P.Awa.sim.id}/tester`, 'POST', { action: 'needs' }).catch(() => {})
await runLoad()
await S.css('body.clean .toast-card, body.clean .toast-card *{visibility:visible!important}')
let seen = -1
const st = []
const r = await S.tapShot('toast', S.toastN ?? 700, [], { each: async (i) => {
  if (i === 15) { S.hold = false; log('released ' + (await S.releaseAmour())) }
  await S.page.evaluate(() => __clean(true))
  const s = await S.page.evaluate(() => { const s = window.__overlays.state(); return [s.toasts.map((x) => x.title + ':' + x.shownAt).join(','), document.querySelectorAll('.toast-card').length, JSON.stringify(s.hold), s.holder] })
  if (s[0]) st.push(i + ' ' + JSON.stringify(s))
  const has = /Mon cœur/.test(s[0]) && s[1] > 0
  if (has && seen < 0) seen = i
  if (seen >= 0 && i - seen > 120) return 'stop'
} })
r.seen = seen
r.st = st.slice(0, 40)
return r
