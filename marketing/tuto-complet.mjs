// « Le tuto Babi Life », the whole of it in one film: the seven episodes (tuto.mjs) one after the
// other, the first one's hook kept, then each episode from its first step to its last (its own
// hook and its end card « Épisode n : … » left out), the last one's end card at the end.
//
//   node tuto-complet.mjs   # after EP=1 … EP=7 node tuto.mjs → out/babi-life-tuto-complet-1080x1920.mp4

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { OUT } from './shared.mjs'

const EPISODES = [1, 2, 3, 4, 5, 6, 7]
const parts = EPISODES.map((n, k) => {
  const plan = JSON.parse(fs.readFileSync(path.join(OUT, 'video-frames', `tuto-ep${n}`, 'plan.json'), 'utf8'))
  const lines = plan.lines
  const from = k === 0 ? 0 : Math.max(0, lines[1].from - 0.25)
  const to = k === EPISODES.length - 1 ? plan.length : lines[lines.length - 1].from - 0.1
  return { file: path.join(OUT, `babi-life-tuto-ep${n}-1080x1920.mp4`), from, to }
})

const inputs = parts.flatMap((p) => ['-i', p.file])
const filters = parts.map((p, k) => `[${k}:v]trim=${p.from.toFixed(3)}:${p.to.toFixed(3)},setpts=PTS-STARTPTS[v${k}];[${k}:a]atrim=${p.from.toFixed(3)}:${p.to.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.04,afade=t=out:st=${(p.to - p.from - 0.06).toFixed(3)}:d=0.06[a${k}]`)
const chain = parts.map((_, k) => `[v${k}][a${k}]`).join('')
const out = path.join(OUT, 'babi-life-tuto-complet-1080x1920.mp4')
execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', `${filters.join(';')};${chain}concat=n=${parts.length}:v=1:a=1[v][a]`, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out])
const total = parts.reduce((s, p) => s + p.to - p.from, 0)
console.log(`→ ${out} (${total.toFixed(1)} s)`)
