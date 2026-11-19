// Opens S.who's game (players.json) with S.q, no activity going on, no PNJ invites; waits for the street.
if (S.ctx) await S.ctx.close().catch(() => {})
const P = JSON.parse((await import('fs')).readFileSync('/tmp/claude-0/land/video-vie-amoureuse/scripts/players.json', 'utf8'))
const p = P[S.who ?? 'Awa']
await L.call(p.token, `/sims/${p.sim.id}/stop`, 'POST', {}).catch(() => {})
if (S.pre) await S.pre(p)
const { page, ctx } = await L.open(S.b, p, { query: S.q ?? '', video: { dpr: S.dpr ?? 3, noArrow: true }, extra: { 'babi-testeur': '1', ...(S.extra ?? {}) } })
await page.route('**/around', async (r) => {
  const res = await r.fetch()
  const j = await res.json().catch(() => null)
  if (j && j.invites) j.invites = []
  await r.fulfill({ response: res, body: JSON.stringify(j) })
})
S.page = page
if (S.holdAmour && S.hold) await S.holdAmour(page)
S.simId = p.sim.id
S.ctx = ctx
const ms = await L.waitFor(page, () => !!globalThis.__streetReady || document.body.innerText.includes('Que faire'), 600000)
await L.sleep(S.settle ?? 4000)
for (const n of ['Pas maintenant', 'Plus tard']) await page.getByRole('button', { name: n }).click({ timeout: 1000 }).catch(() => {})
await S.shot('load')
return { ms }
