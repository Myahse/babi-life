const cine = '[data-rdv] > div:last-child{display:none!important} [data-rdv] button[aria-label]{visibility:hidden!important} [data-rdv] .pointer-events-none.absolute.inset-x-0{visibility:hidden!important}'
const fs = await import('fs')
const runLoad = async (q) => { S.who = 'Awa'; S.q = q; const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor; return new AsyncFunction('L', 'S', 'log', fs.readFileSync('/tmp/claude-0/land/video-vie-amoureuse/scripts/load.js', 'utf8'))(L, S, log) }
const out = {}
const todo = S.todo ?? ['lagune', 'maquis', 'glace']
for (const k of todo) {
  if (k === 'lagune') {
    await runLoad('?place=cocody-baie')
    let on = false
    out.lagune = await S.date('lagune', 'Balade en amoureux', ['mot', 'ecouter', 'ecouter', 'mot'], { read: [45, 45, 45, 45], tail: 80, each: async (i, st) => { const want = st.phase === 'final' || st.phase === 'pose'; if (want !== on) { on = want; await S.css(want ? cine : '') } } })
  }
  if (k === 'maquis') {
    await runLoad('?place=cocody-danga')
    out.maquis = await S.date('maquis', 'Dîner en amoureux', ['mot', 'ecouter', 'blague', 'mot'], { read: [45, 30, 45, 45], tail: 80 })
  }
  if (k === 'glace') {
    await runLoad('?place=cocody-sococe')
    out.glace = await S.date('glace', 'Une glace en amoureux', ['ecouter', 'ecouter', 'mot', 'mot'], { read: [45, 45, 45, 45], tail: 80 })
  }
  fs.writeFileSync('/tmp/claude-0/land/video-vie-amoureuse/go-all.json', JSON.stringify(out))
}
return out
