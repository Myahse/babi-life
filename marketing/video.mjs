// The videos (FILM=lancement, 25 s; FILM=bouger, 31 s; FILM=bande-annonce,
// the trailer, 30 s; FILM=decouverte, everything there is to do, 71 s; FILM=live,
// Awa streaming the game on her voice, out/voix-live.mp3, 96 s; FILM=merci, Awa
// thanking the community for 1 500 followers, 52 s, voice out/voix-merci.mp3 when there), 1080 × 1920 (WhatsApp status, TikTok, Reels), drawn frame
// by frame from the game's own persos (web/src/lab/poster.tsx) so it's smooth
// even on a slow machine, then put together by ffmpeg into an MP4.
//
// Needs the web app's dependencies (cd web && npm ci) and ffmpeg.

import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'
import { HERE, OUT, SHORT, URL, browser } from './shared.mjs'

const FPS = Number(process.env.FPS ?? 24)
/** Which film: lancement (the launch), bouger (gbaka, Gnango, Rue Princesse), bande-annonce (the trailer) or decouverte (the tour). */
const FILM = process.env.FILM ?? 'lancement'
const PORTS = { lancement: 5233, bouger: 5235, 'bande-annonce': 5236, decouverte: 5237, live: 5239, merci: 5240 }
const NAME = FILM === 'lancement' ? 'babi-life-video' : `babi-life-video-${FILM}`
const SRC = FILM === 'lancement' ? 'video' : `video-${FILM}`
const PORT = PORTS[FILM] ?? 5238
const frames = path.join(OUT, 'video-frames', FILM)
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

const qr = await QRCode.toDataURL(`${URL}?src=${SRC}`, { margin: 1, width: 440, color: { dark: '#161a2b', light: '#ffffff' } })
const b = await browser()
const page = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.error('page:', String(e)))
await page.goto(`http://127.0.0.1:${PORT}/poster.html?video=${FILM}&t=0`, { waitUntil: 'networkidle' })
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

const mp4 = path.join(OUT, `${NAME}-1080x1920.mp4`)
// The live and « merci » have a voice when its file is there (the others are silent: music is added in CapCut or InShot).
const voice = path.join(OUT, `voix-${FILM}.mp3`)
// (padded with silence: the film runs to its end even when the voice is shorter)
const sound = fs.existsSync(voice) ? ['-i', voice, '-af', 'apad', '-c:a', 'aac', '-b:a', '160k', '-shortest'] : []
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, '%05d.png'), ...sound, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'slow', '-movflags', '+faststart', mp4])
// A poster frame for the link preview (the outro, with the QR code).
fs.copyFileSync(path.join(frames, `${String(total - 12).padStart(5, '0')}.png`), path.join(OUT, `${NAME}-cover.png`))
fs.rmSync(frames, { recursive: true, force: true })
console.log('video →', mp4)
