// The other shots: « Mon cœur », the bonjour toast, the hug at the door, the pink card in Gbairai.
const fs = await import('fs')
const runLoad = async () => { const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor; return new AsyncFunction('L', 'S', 'log', fs.readFileSync('/tmp/claude-0/land/video-vie-amoureuse/scripts/load.js', 'utf8'))(L, S, log) }
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
const out = {}
const todo = S.todo2 ?? ['coeur', 'toast', 'porte', 'gbairai']
for (const k of todo) {
  if (k === 'coeur') {
    S.who = 'Awa'; S.q = '?app=coeur'; S.settle = 3000; S.pre = null
    await runLoad()
    await S.css('[data-mot="fier"]{display:none!important}')
    await S.shot('coeur-0')
    out.coeur = await S.tapShot('coeur', 330, [[50, '[data-coeur-action="Mot doux"]'], [95, '[data-mot="manque"]'], [215, '[data-coeur-action="Rendez-vous"]']], {
      each: async (i) => { if (i === 222) await S.page.evaluate(() => document.querySelector('[data-rdv-go]')?.scrollIntoView({ block: 'center', behavior: 'smooth' })) },
    })
  }
  if (k === 'toast') {
    S.who = 'Awa'; S.q = '?hour=8'; S.settle = 300
    S.pre = async (p) => L.psql(`UPDATE sims SET life = jsonb_set(life, '{amour,hello}', '""') WHERE id = '${p.sim.id}'`)
    await runLoad()
    let seen = -1
    out.toast = await S.tapShot('toast', 400, [], { each: async (i) => {
      const has = await S.page.evaluate(() => [...document.querySelectorAll('.toast-card')].some((e) => /Mon cœur/.test(e.textContent ?? '')))
      if (has && seen < 0) seen = i
      if (seen >= 0 && i - seen > 110) return 'stop'
    } })
    out.toast.seen = seen
  }
  if (k === 'porte') {
    S.who = 'Awa'; S.q = '?place=home&hour=19'; S.settle = 300; S.pre = null
    await runLoad()
    await S.css('body.clean [data-door-hug], body.clean [data-door-hug] *{visibility:visible!important}')
    await S.page.evaluate(() => __clean(true))
    let seen = -1
    out.porte = await S.tapShot('porte', 500, [], { each: async (i) => {
      const has = await S.page.evaluate(() => {
        for (const e of document.querySelectorAll('div,span,p,button')) if (e.children.length < 3 && /Nager dans la piscine/.test(e.textContent ?? '')) e.style.setProperty('display', 'none', 'important')
        return !!document.querySelector('[data-door-hug]')
      })
      if (has && seen < 0) seen = i
      if (seen >= 0 && i - seen > 100) return 'stop'
    } })
    out.porte.seen = seen
  }
  if (k === 'gbairai') {
    const P = JSON.parse(fs.readFileSync('/tmp/claude-0/land/video-vie-amoureuse/scripts/players.json', 'utf8'))
    await L.call(P.Mariam.token, `/sims/${P.Mariam.sim.id}/amour/mot`, 'POST', { id: 'bebe' }).catch((e) => log('mot ' + e))
    S.who = 'Koffi'; S.q = '?app=gbairai'; S.settle = 3000; S.pre = null
    await runLoad()
    await S.shot('gbairai-0')
    out.gbairai = await S.tapShot('gbairai', 150, [[30, '[data-vmot]']], { each: async (i) => {
      if (i === 26) await S.page.evaluate(() => { const e = [...document.querySelectorAll('button,[role=button],li,div')].reverse().find((x) => /Mot doux : Mon b/.test(x.textContent ?? '') && x.textContent.length < 200); if (e) e.setAttribute('data-vmot', '1') })
    } })
  }
  fs.writeFileSync('/tmp/claude-0/land/video-vie-amoureuse/shots.json', JSON.stringify(out))
}
return out
