// A long-lived browser driven over HTTP: POST a node async-function body; it gets (L, S) where L is lib.mjs and S a shared state.
import * as L from './lib.mjs'
import http from 'http'
const S = { b: await L.browserOf() }
globalThis.S = S
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
http
  .createServer((req, res) => {
    let body = ''
    req.on('data', (d) => (body += d))
    req.on('end', async () => {
      const logs = []
      const log = (...a) => logs.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '))
      try {
        const r = await new AsyncFunction('L', 'S', 'log', body)(L, S, log)
        res.end(logs.join('\n') + '\n=> ' + JSON.stringify(r ?? null) + '\n')
      } catch (e) {
        res.end(logs.join('\n') + '\nERR ' + (e.stack ?? e) + '\n')
      }
    })
  })
  .listen(9799, '127.0.0.1')
console.log('repl on 9799')
