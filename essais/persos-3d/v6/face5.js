// Round 5 faces: nothing is redrawn. The model's own painted face is the art; it is warped a little (Live2D-style
// mesh warp of the unwrapped face), lids of the character's own skin close over the painted eye along its outline,
// and optionally the face cross-fades to expression frames painted by the same image model (aligned by landmarks).
import * as THREE from 'three'
import * as F4 from './face4.js'
const CELL = F4.CELL, GN = 26
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), lerp = (a, b, u) => a + (b - a) * u

function tri (g, img, s, d) { // textured triangle, src px -> dest px
  const [s0, s1, s2] = s, [d0, d1, d2] = d
  const den = s0[0] * (s1[1] - s2[1]) + s1[0] * (s2[1] - s0[1]) + s2[0] * (s0[1] - s1[1]); if (Math.abs(den) < 1e-6) return
  const sol = (k) => [(d0[k] * (s1[1] - s2[1]) + d1[k] * (s2[1] - s0[1]) + d2[k] * (s0[1] - s1[1])) / den, (d0[k] * (s2[0] - s1[0]) + d1[k] * (s0[0] - s2[0]) + d2[k] * (s1[0] - s0[0])) / den, (d0[k] * (s1[0] * s2[1] - s2[0] * s1[1]) + d1[k] * (s2[0] * s0[1] - s0[0] * s2[1]) + d2[k] * (s0[0] * s1[1] - s1[0] * s0[1])) / den]
  const [a, c, e] = sol(0), [b, dd, f] = sol(1), cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3
  g.save(); g.beginPath()
  for (const [i, p] of [d0, d1, d2].entries()) { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; const x = p[0] + dx / l * 0.8, y = p[1] + dy / l * 0.8; i ? g.lineTo(x, y) : g.moveTo(x, y) }
  g.closePath(); g.clip(); g.transform(a, b, c, dd, e, f); g.drawImage(img, 0, 0); g.restore()
}

// mode: 'A' warp only, 'B' expression frames only (cross-fade), 'AB' frames + warp micro-motion
export function buildFace5 (ch, atlas, cfg = {}, sheet = null) {
  const det = F4.buildFace4(ch, atlas, { ...cfg, trueNormals: true, bigPatch: true })
  const [col, row] = ch.face4Cell, F = ch.face4F, B = ch.face4B, I = det.I, m = det.mouth, A = det.ellA
  const rho = (e, x, y) => Math.hypot((x - e.cx) / e.rx, (y - e.cy) / e.ry)
  const Mk = (x, y) => { const v = clamp((1 - rho(A, x, y)) / 0.28, 0, 1); return v * v * (3 - 2 * v) }
  // feathered alpha of the patch
  const cvM = document.createElement('canvas'); cvM.width = cvM.height = CELL; { const g = cvM.getContext('2d'), im = g.createImageData(CELL, CELL); for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) { const i = (y * CELL + x) * 4; im.data[i + 3] = 255 * Mk(x, y) } g.putImageData(im, 0, 0) }
  // lids: per-column top/bottom of the painted eye blob
  const lids = {}
  for (const k of ['l', 'r']) {
    // lid outline = the painted eye's own outline (PCA ellipse of the painted eye blob, a touch larger)
    const e = det.eyes[k]; const th = (k === 'r' ? -1 : 1) * (e.th0 === undefined ? e.tilt : e.tilt), a0 = e.a0 * 1.22, b0 = e.b0 * 1.3, c = Math.cos(th), sn = Math.sin(th)
    const X = [], top = [], bot = []
    for (let x = Math.ceil(e.cx - a0 * Math.abs(c) - b0 * Math.abs(sn)); x <= e.cx + a0 * Math.abs(c) + b0 * Math.abs(sn); x++) {
      // intersect the vertical line with the rotated ellipse
      const dx = x - e.cx, A2 = (sn / a0) ** 2 + (c / b0) ** 2, B2 = 2 * dx * c * sn * (1 / a0 ** 2 - 1 / b0 ** 2), C2 = dx * dx * ((c / a0) ** 2 + (sn / b0) ** 2) - 1, D = B2 * B2 - 4 * A2 * C2; if (D < 0) continue
      X.push(x); top.push(e.cy + (-B2 - Math.sqrt(D)) / (2 * A2)); bot.push(e.cy + (-B2 + Math.sqrt(D)) / (2 * A2))
    }
    lids[k] = X.length > 6 ? { xs: X, top, bot } : null
  }
  // expression frames from the sheet, colour-matched to the painted face
  let frames = null
  if (sheet) {
    frames = {}
    const gF = F.getContext('2d', { willReadFrequently: true }), fd = gF.getImageData(0, 0, CELL, CELL).data
    const stat = (d) => { const s = [0, 0, 0]; let n = 0; for (let y = 0; y < CELL; y += 2) for (let x = 0; x < CELL; x += 2) { if (rho(A, x, y) > 0.9) continue; const i = (y * CELL + x) * 4; if (fd[i + 3] < 200 || d[i + 3] < 200) continue; const l = 0.3 * fd[i] + 0.59 * fd[i + 1] + 0.11 * fd[i + 2], sl = 0.3 * ch.face.skin[0] + 0.59 * ch.face.skin[1] + 0.11 * ch.face.skin[2]; if (l < 0.7 * sl || l > 1.5 * sl) continue; s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; n++ } return s.map((v) => v / Math.max(1, n)) }
    const ref = stat(fd); let gain = null
    for (const key of Object.keys(sheet)) {
      const cv = document.createElement('canvas'); cv.width = cv.height = CELL; const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(sheet[key], 0, 0, CELL, CELL)
      const im = g.getImageData(0, 0, CELL, CELL); if (!gain) { const s = stat(im.data); gain = ref.map((v, i) => v / Math.max(1, s[i])) }
      for (let i = 0; i < CELL * CELL; i++) { im.data[i * 4] *= gain[0]; im.data[i * 4 + 1] *= gain[1]; im.data[i * 4 + 2] *= gain[2] }
      g.putImageData(im, 0, 0); frames[key] = cv
    }
    ch.face5Gain = gain
  }
  const G = (x, y, cx, cy, sx, sy = sx) => Math.exp(-(((x - cx) / sx) ** 2) - (((y - cy) / sy) ** 2))
  const disp = (x, y, st) => {
    let dx = 0, dy = 0; const mw = m.mw, sm = st.smile || 0, op = st.open || 0
    for (const s of [-1, 1]) {
      const cxm = m.cx + s * mw, g = G(x, y, cxm, m.cy, 0.62 * mw)
      dy += -0.3 * mw * sm * g; dx += s * 0.1 * mw * Math.max(0, sm) * g - s * 0.2 * mw * (st.round || 0) * g
      if (sm > 0) dy += -0.1 * mw * sm * G(x, y, m.cx + s * 1.15 * mw, m.cy - 0.85 * mw, 0.8 * mw)
    }
    if (op > 0) { const t = Math.tanh((y - m.cy) / (0.07 * mw)); dy += op * 0.3 * mw * (t < 0 ? 0.3 * t : t) * G(x, y, m.cx, m.cy, 0.8 * mw, 0.85 * mw) }
    for (const [k, s] of [['l', -1], ['r', 1]]) {
      const e = det.eyes[k], bw = det.brows[k], a0 = e.a0, b0 = e.b0
      dy += -0.12 * I * (st.brow || 0) * G(x, y, bw.cx, bw.cy, 1.1 * bw.bl, 0.17 * I)
      const inx = bw.cx - s * 0.75 * bw.bl, outx = bw.cx + s * 0.75 * bw.bl
      dy += (-0.1 * I * (st.sadBrow || 0) + 0.09 * I * (st.angry || 0)) * G(x, y, inx, bw.cy, 0.5 * bw.bl, 0.16 * I) + 0.04 * I * (st.sadBrow || 0) * G(x, y, outx, bw.cy, 0.5 * bw.bl, 0.16 * I)
      dy += -0.8 * b0 * (st.squint || 0) * G(x, y, e.cx, e.cy + 0.95 * b0, 1.15 * a0, 0.85 * b0)
      dy += -0.45 * b0 * (st.eyeWide || 0) * G(x, y, e.cx, e.cy - 0.95 * b0, 1.1 * a0, 0.85 * b0) + 0.2 * b0 * (st.droop || 0) * G(x, y, e.cx + s * 0.8 * a0, e.cy - 0.5 * b0, 0.6 * a0, 0.8 * b0)
      const ge = G(x, y, e.cx, e.cy, 0.55 * a0, 0.75 * b0); dx += (st.gx || 0) * 0.17 * a0 * ge; dy += -(st.gy || 0) * 0.12 * b0 * ge
    }
    const k = Mk(x, y); return [dx * k, dy * k]
  }
  const g = atlas.g, step = CELL / GN
  const cvS = document.createElement('canvas'); cvS.width = cvS.height = CELL; const gS = cvS.getContext('2d')
  const gridOn = []; for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) if (Mk((i + 0.5) * step, (j + 0.5) * step) > 0 || Mk(i * step, j * step) > 0 || Mk((i + 1) * step, (j + 1) * step) > 0) gridOn.push([i, j])
  const V = new Float32Array((GN + 1) * (GN + 1) * 2)
  ch.face5Mode = cfg.mode || 'A'
  ch.drawFace5 = (st) => {
    const mode = ch.face5Mode
    // 1. source = painted face, or a blend towards expression frames
    let src = F
    if (frames && mode !== 'A') {
      gS.globalAlpha = 1; gS.clearRect(0, 0, CELL, CELL); gS.drawImage(frames.neutral, 0, 0) // the sheet's own neutral is the rest face, so nothing pops
      for (const [key, w] of Object.entries(st.frames || {})) if (w > 0.003 && frames[key]) { gS.globalAlpha = Math.min(1, w); gS.drawImage(frames[key], 0, 0) }
      gS.globalAlpha = 1; src = cvS
    }
    const warp = mode === 'B' ? { gx: 0 } : st
    g.save(); g.setTransform(1, 0, 0, 1, col * CELL, row * CELL); g.beginPath(); g.rect(0, 0, CELL, CELL); g.clip(); g.clearRect(0, 0, CELL, CELL)
    if (mode === 'B') g.drawImage(src, 0, 0); else {
      for (let j = 0; j <= GN; j++) for (let i = 0; i <= GN; i++) { const x = i * step, y = j * step, d = disp(x, y, warp), o = (j * (GN + 1) + i) * 2; V[o] = x + d[0]; V[o + 1] = y + d[1] }
      const P = (i, j) => { const o = (j * (GN + 1) + i) * 2; return [V[o], V[o + 1]] }
      for (const [i, j] of gridOn) { const x = i * step, y = j * step
        tri(g, src, [[x, y], [x + step, y], [x, y + step]], [P(i, j), P(i + 1, j), P(i, j + 1)]); tri(g, src, [[x + step, y], [x + step, y + step], [x, y + step]], [P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)]) }
    }
    // 2. lids: the character's own skin closes over the painted eye, following its outline; the lash line rides the edge
    const bl = mode === 'B' ? 0 : (st.blink || 0)
    if (bl > 0.02) for (const k of ['l', 'r']) {
      const L = lids[k]; if (!L) continue; const n = L.xs.length; const line = [], topl = []
      for (let i = 0; i < n; i++) { const x = L.xs[i], yl = L.top[i] - 1.5 + (L.bot[i] - L.top[i] + 3) * bl; const d = disp(x, yl, warp), d2 = disp(x, L.top[i] - 4, warp); line.push([x + d[0], yl + d[1]]); topl.push([x + d2[0], L.top[i] - 4 + d2[1]]) }
      g.save(); g.beginPath(); g.moveTo(topl[0][0] - 1.5, topl[0][1]); for (const p of topl) g.lineTo(p[0], p[1]); g.lineTo(line[n - 1][0] + 1.5, line[n - 1][1]); for (let i = n - 1; i >= 0; i--) g.lineTo(line[i][0], line[i][1]); g.closePath(); g.filter = 'blur(1.2px)'; g.clip(); g.drawImage(B, 0, 0); g.filter = 'none'; g.restore()
      if (cfg.noLash) continue
      g.strokeStyle = `rgba(18,9,6,${Math.min(1, 0.35 + bl)})`; g.lineWidth = 1.7; g.lineCap = g.lineJoin = 'round'; g.beginPath(); line.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke()
    }
    // 3. feathered patch
    g.globalCompositeOperation = 'destination-in'; g.drawImage(cvM, 0, 0); g.restore(); atlas.dirty = true
  }
  ch.face5 = { det, frames: !!frames, lids: Object.fromEntries(Object.entries(lids).map(([k, v]) => [k, v ? v.xs.length : 0])), grid: gridOn.length }
  return det
}

// ---- life ----------------------------------------------------------------------------------------------------------
const h = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
export function live5 (t, seed = 0) { // small saccades, natural blinks: ~45 ms close, ~80 ms open, sometimes double
  const T = 0.9, p = t / T + seed * 3.7, k = Math.floor(p), u = clamp((p - k) * T / 0.07, 0, 1), e = u * u * (3 - 2 * u)
  const tg = (k) => { const big = h(k * 3.1) > 0.8; const amp = big ? 1 : 0.35; return [(h(k) - 0.5) * 2 * amp, (h(k + 50) - 0.5) * 1.0 * amp] }
  const A = tg(k - 1), B = tg(k); let bl = 0; const BP = 3.1, kb = Math.floor(t / BP)
  for (const kk of [kb - 1, kb]) { const st = kk * BP + h(kk + 9 + seed) * 1.7; for (const off of (h(kk + 77 + seed) > 0.75 ? [0, 0.26] : [0])) { const d = t - st - off; if (d >= 0 && d < 0.125) bl = Math.max(bl, d < 0.045 ? d / 0.045 : 1 - (d - 0.045) / 0.08) } }
  return { gx: lerp(A[0], B[0], e), gy: lerp(A[1], B[1], e), blink: bl }
}
// small, soft expressions (warp amplitudes) and which sheet frame they cross-fade to
export const EXPR5 = {
  neutral: { smile: 0.05, f: null },
  smile: { smile: 0.75, squint: 0.35, brow: 0.1, f: 'smile' },
  laugh: { smile: 1, squint: 0.9, brow: 0.3, open: 0.6, f: 'laugh' },
  sad: { smile: -0.7, sadBrow: 1, droop: 0.6, f: 'sad' },
  surprised: { brow: 1, eyeWide: 0.8, open: 0.5, round: 0.6, f: 'surprised' },
  talk: { smile: 0.2, f: null }
}
const KEYS = ['smile', 'squint', 'brow', 'open', 'sadBrow', 'droop', 'eyeWide', 'round', 'angry']
export function mix5 (a, b, u) { const o = { frames: {} }; for (const k of KEYS) o[k] = (a[k] || 0) * (1 - u) + (b[k] || 0) * u; if (a.f) o.frames[a.f] = 1 - u; if (b.f) o.frames[b.f] = (o.frames[b.f] || 0) + u; if (b.f && a.f && a.f !== b.f) { o.frames[a.f] = 1; o.frames[b.f] = u } return o }
// In mode 'AB' the frame carries the expression, so the warp only adds micro-motion on top.
export function stateFor (ch, ex, lv, extra = {}) {
  const mode = ch.face5Mode; const st = { ...ex, ...lv, ...extra }
  if (mode === 'AB' && ch.face5.frames) { const w = Math.max(0, ...Object.values(ex.frames || {}), 0); for (const k of KEYS) st[k] = (st[k] || 0) * (1 - w); } 
  if (mode !== 'A' && ch.face5.frames) { st.frames = { ...(ex.frames || {}) }; if (!((ex.frames || {}).laugh > 0.4)) st.frames.closed = lv.blink || 0; st.blink = 0 }
  return st
}
// head and body life on top of the clip: nod, tilt, turn (radians) and a laugh bounce
const _q = new THREE.Quaternion(), _e = new THREE.Euler()
export function bodyLife (ch, o = {}) {
  const add = (name, x, y, z) => { const b = ch.bones[name]; if (!b) return; _q.setFromEuler(_e.set(x, y, z)); b.quaternion.multiply(_q) }
  add('Head', o.nod || 0, o.turn || 0, o.tilt || 0); add('neck', (o.nod || 0) * 0.4, (o.turn || 0) * 0.4, (o.tilt || 0) * 0.3)
  if (o.bounce) { add('Spine02', o.bounce * 0.05, 0, 0); add('LeftShoulder', 0, 0, -o.bounce * 0.07); add('RightShoulder', 0, 0, o.bounce * 0.07); add('Spine', -o.lean || 0, 0, 0) }
  if (o.lean) add('Spine01', o.lean, 0, 0)
}
