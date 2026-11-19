const fs = await import('fs')
const run = async (f) => { const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor; return new AsyncFunction('L', 'S', 'log', fs.readFileSync('/tmp/claude-0/land/video-vie-amoureuse/scripts/' + f, 'utf8'))(L, S, log) }
S.toastQ = '?hour=8'; S.toastN = 420
const a = await run('toast.js'); delete a.st
S.hold = false
const P = JSON.parse(fs.readFileSync('/tmp/claude-0/land/video-vie-amoureuse/scripts/players.json', 'utf8'))
await L.call(P.Awa.token, `/sims/${P.Awa.sim.id}/tester`, 'POST', { action: 'needs' }).catch(() => {})
const b = await run('porte.js')
return { a, b }
