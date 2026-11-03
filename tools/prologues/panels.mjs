// The comic's panels of the stories' prologues (web/src/components/prologue/PrologueBD.tsx): each shot
// drawn once, a little past its middle, from the lab page (web/prologue.html ?id=&shot=), as a JPEG in
// web/public/prologues/<story>/<shot>.jpg, in its panel's shape. A panel already drawn is kept unless
// --force, or --only names its story. Needs the web app's dependencies (cd web && npm ci) and marketing's
// (Playwright: cd marketing && npm ci).
//
//   node tools/prologues/panels.mjs [--only cour-hantee] [--force]
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const { chromium } = await import(join(root, 'marketing', 'node_modules', 'playwright-core', 'index.mjs'))
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}
const ONLY = arg('only')?.split(',')
const FORCE = process.argv.includes('--force')
const PORT = 5241
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: join(root, 'web'), stdio: 'ignore' })
process.on('exit', () => vite.kill())
for (let i = 0; i < 90; i++) {
  try {
    if ((await fetch(`http://127.0.0.1:${PORT}/prologue.html`)).ok) break
  } catch {}
  await new Promise((r) => setTimeout(r, 500))
}
const executablePath = process.env.CHROMIUM || ['/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/google-chrome'].find((p) => existsSync(p))
const b = await chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
// The panels' shapes (PrologueBD: the first wide, every third a little less tall).
const shape = (n) => (n === 0 ? [800, 450] : n % 3 === 2 ? [800, 500] : [800, 600])
const scripts = join(root, 'web', 'src', 'components', 'prologue', 'scenarios')
for (const f of readdirSync(scripts).filter((f) => f.endsWith('.json')).sort()) {
  const s = JSON.parse(readFileSync(join(scripts, f), 'utf8'))
  if (ONLY && !ONLY.includes(s.id)) continue
  const out = join(root, 'web', 'public', 'prologues', s.id)
  mkdirSync(out, { recursive: true })
  for (const [n, shot] of s.shots.entries()) {
    const file = join(out, `${n}.jpg`)
    if (existsSync(file) && !FORCE) continue
    const [width, height] = shape(n)
    const p = await b.newPage({ viewport: { width, height } })
    await p.goto(`http://127.0.0.1:${PORT}/prologue.html?id=${s.id}&shot=${n}&t=${(shot.dur * 0.6).toFixed(2)}`, { waitUntil: 'networkidle' })
    await p.waitForTimeout(4500)
    await p.screenshot({ path: file, type: 'jpeg', quality: 80, timeout: 120000 })
    await p.close()
    console.log(`${s.id} ${n} : dessinée`)
  }
}
await b.close()
process.exit(0)
