// The video: 25 s, 1080 × 1920 (WhatsApp status, TikTok, Reels), drawn frame
// by frame from the game's own Sims (web/src/lab/poster.tsx) so it's smooth
// even on a slow machine, then put together by ffmpeg into an MP4.
//
// Needs the web app's dependencies (cd web && npm ci) and ffmpeg.

import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'
import { HERE, OUT, SHORT, URL, browser } from './shared.mjs'

const FPS = Number(process.env.FPS ?? 24)
const PORT = 5233
const frames = path.join(OUT, 'video-frames')
fs.rmSync(frames, { recursive: true, force: true })
fs.mkdirSync(frames, { recursive: true })

// The game's dev server, for the poster page.
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: path.join(HERE, '../web'), stdio: 'ignore' })
const stop = () => vite.kill()
process.on('exit', stop)
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`http://127.0.0.1:${PORT}/poster.html`)).ok) break
  } catch {}
  await new Promise((r) => setTimeout(r, 500))
}

const qr = await QRCode.toDataURL(`${URL}?src=video`, { margin: 1, width: 440, color: { dark: '#161a2b', light: '#ffffff' } })
const b = await browser()
const page = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.error('page:', String(e)))
await page.goto(`http://127.0.0.1:${PORT}/poster.html?video&t=0`, { waitUntil: 'networkidle' })
await page.waitForFunction(() => !!window.__frame && !!window.__length)
await page.evaluate(([qr, url]) => window.__setOutro(qr, url, false), [qr, SHORT])
const length = await page.evaluate(() => window.__length)
const total = Math.round(length * FPS)
const started = Date.now()
for (let i = 0; i < total; i++) {
  await page.evaluate((t) => window.__frame(t), i / FPS)
  await page.screenshot({ path: path.join(frames, `${String(i).padStart(5, '0')}.png`) })
  if (i % 48 === 0) console.log(`frame ${i}/${total} (${Math.round((Date.now() - started) / 1000)} s)`)
}
await b.close()
stop()

const mp4 = path.join(OUT, 'babi-life-video-1080x1920.mp4')
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, '%05d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'slow', '-movflags', '+faststart', mp4])
// A poster frame for the link preview (the outro, with the QR code).
fs.copyFileSync(path.join(frames, `${String(total - 12).padStart(5, '0')}.png`), path.join(OUT, 'babi-life-video-cover.png'))
fs.rmSync(frames, { recursive: true, force: true })
console.log('video →', mp4)
