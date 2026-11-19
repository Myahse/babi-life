const fs = await import('fs')
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
const run = (f) => new AsyncFunction('L', 'S', 'log', fs.readFileSync('/tmp/claude-0/land/video-vie-amoureuse/scripts/' + f, 'utf8'))(L, S, log)
S.tapShot = null
await run('shotsdef.js')
S.porteClean = true
return await run('porte.js')
