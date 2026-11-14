// Round 4 living faces: a thin decal over the face, one shared canvas atlas for every character.
// Per head: painted features are located in the texture, erased by inpainting the skin around them, and redrawn
// (almond eyes with lids, brows, lips) in the shape and colours the painted face had.
import * as THREE from 'three'
const CELL = 256, COLS = 4, ROWS = 2, TW = 1024
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), lerp = (a, b, u) => a + (b - a) * u
const lumOf = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b
const css = (c, k = 1, a = 1) => `rgba(${Math.round(clamp(c[0] * k, 0, 255))},${Math.round(clamp(c[1] * k, 0, 255))},${Math.round(clamp(c[2] * k, 0, 255))},${a})`

export class FaceAtlas {
  constructor () {
    this.cv = document.createElement('canvas'); this.cv.width = CELL * COLS; this.cv.height = CELL * ROWS; this.g = this.cv.getContext('2d')
    this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.generateMipmaps = false; this.tex.minFilter = THREE.LinearFilter
    this.mat = new THREE.MeshStandardMaterial({ map: this.tex, transparent: true, depthWrite: false, roughness: 0.62, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    this.n = 0; this.dirty = false; this.uploads = 0
  }
  flush () { if (this.dirty) { this.tex.needsUpdate = true; this.dirty = false; this.uploads++ } }
}

function drawTri (g, img, s, d) { // textured triangle: src px -> dest px
  const [s0, s1, s2] = s, [d0, d1, d2] = d
  const den = s0[0] * (s1[1] - s2[1]) + s1[0] * (s2[1] - s0[1]) + s2[0] * (s0[1] - s1[1]); if (Math.abs(den) < 1e-6) return
  const sol = (k) => [(d0[k] * (s1[1] - s2[1]) + d1[k] * (s2[1] - s0[1]) + d2[k] * (s0[1] - s1[1])) / den, (d0[k] * (s2[0] - s1[0]) + d1[k] * (s0[0] - s2[0]) + d2[k] * (s1[0] - s0[0])) / den, (d0[k] * (s1[0] * s2[1] - s2[0] * s1[1]) + d1[k] * (s2[0] * s0[1] - s0[0] * s2[1]) + d2[k] * (s0[0] * s1[1] - s1[0] * s0[1])) / den]
  const [a, c, e] = sol(0), [b, dd, f] = sol(1)
  const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3
  g.save(); g.beginPath()
  for (const [i, p] of [d0, d1, d2].entries()) { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; const x = p[0] + dx / l * 0.9, y = p[1] + dy / l * 0.9; i ? g.lineTo(x, y) : g.moveTo(x, y) }
  g.closePath(); g.clip(); g.transform(a, b, c, dd, e, f); g.drawImage(img, 0, 0); g.restore()
}
function pca (pts) {
  let mx = 0, my = 0; for (const [x, y] of pts) { mx += x; my += y } mx /= pts.length; my /= pts.length
  let xx = 0, yy = 0, xy = 0; for (const [x, y] of pts) { xx += (x - mx) ** 2; yy += (y - my) ** 2; xy += (x - mx) * (y - my) }
  const th = 0.5 * Math.atan2(2 * xy, xx - yy), c = Math.cos(th), s = Math.sin(th)
  let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (const [x, y] of pts) { const u = (x - mx) * c + (y - my) * s, v = -(x - mx) * s + (y - my) * c; a0 = Math.min(a0, u); a1 = Math.max(a1, u); b0 = Math.min(b0, v); b1 = Math.max(b1, v) }
  const um = (a0 + a1) / 2, vm = (b0 + b1) / 2
  return { cx: mx + um * c - vm * s, cy: my + um * s + vm * c, a: (a1 - a0) / 2, b: (b1 - b0) / 2, th, n: pts.length }
}

export function buildFace4 (ch, atlas, cfg = {}) {
  const f = ch.face, P = ch.P, uvA = ch.mesh.geometry.attributes.uv
  const cell = atlas.n++, col = cell % COLS, row = Math.floor(cell / COLS)
  // cylindrical projection around the head's vertical axis: no stretching towards the temples
  const ax = f.cx, az = f.ez - 1.25 * f.iod, R = 1.25 * f.iod
  const top = f.ey + 0.95 * f.iod, bot = f.my - 0.7 * f.iod, cy = (top + bot) / 2, S = Math.max(3.0 * f.iod, (top - bot) * 1.04)
  const proj = (x, y, z) => [(Math.atan2(x - ax, z - az) * R / S + 0.5) * CELL, (0.5 - (y - cy) / S) * CELL]
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3()
  const N = {}; for (const [i0, i1, i2] of ch.headTris) { a.fromArray(P, i0 * 3); b.fromArray(P, i1 * 3); c.fromArray(P, i2 * 3); n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)); for (const i of [i0, i1, i2]) (N[i] = N[i] || new THREE.Vector3()).add(n) }
  const pos = [], nor = [], uvs = [], tris = [], cand = []; let t0facing = 0
  for (const [i0, i1, i2] of ch.headTris) {
    const d = [], s = []; let ok = true
    for (const i of [i0, i1, i2]) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; if (z <= az) { ok = false; break } const p = proj(x, y, z); if (p[0] < 2 || p[0] > CELL - 2 || p[1] < 2 || p[1] > CELL - 2) { ok = false; break } d.push(p); s.push([uvA.getX(i) * TW, uvA.getY(i) * TW]) }
    if (!ok) continue
    // facing outwards from the head axis, and how far out it is (painter's order)
    a.fromArray(P, i0 * 3); b.fromArray(P, i1 * 3); c.fromArray(P, i2 * 3); n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a))
    const mxx = (a.x + b.x + c.x) / 3 - ax, mzz = (a.z + b.z + c.z) / 3 - az; t0facing = n.x * mxx + n.z * mzz
    cand.push({ s, d, v: [i0, i1, i2], rad: Math.hypot(mxx, mzz) + (t0facing <= 0 ? -1 : 0) }) // inward-facing ones are painted first
  }
  // keep only what is visible from outside: paint ids far-to-near, see which survive
  cand.sort((p, q2) => p.rad - q2.rad)
  { const cvI = document.createElement('canvas'); cvI.width = cvI.height = CELL; const gI = cvI.getContext('2d', { willReadFrequently: true })
    cand.forEach((t, k) => { const id = k + 1; gI.fillStyle = `rgb(${id & 255},${(id >> 8) & 255},${(id >> 16) & 255})`; gI.beginPath(); gI.moveTo(t.d[0][0], t.d[0][1]); gI.lineTo(t.d[1][0], t.d[1][1]); gI.lineTo(t.d[2][0], t.d[2][1]); gI.closePath(); gI.fill() })
    const idd = gI.getImageData(0, 0, CELL, CELL).data
    const idAt = (x, y) => { const i = (Math.round(clamp(y, 0, CELL - 1)) * CELL + Math.round(clamp(x, 0, CELL - 1))) * 4; if (idd[i + 3] < 255) return 0; const id = idd[i] | (idd[i + 1] << 8) | (idd[i + 2] << 16); return id <= cand.length ? id : 0 }
    // hidden = something clearly further out (> 4 mm) covers its centre and its three inner points
    cand.forEach((t, k) => { const [p0, p1, p2] = t.d; const pts = [[(p0[0] + p1[0] + p2[0]) / 3, (p0[1] + p1[1] + p2[1]) / 3]]; for (const p of t.d) pts.push([(p[0] + pts[0][0]) / 2, (p[1] + pts[0][1]) / 2])
      t.vis = !pts.every(([x, y]) => { const id = idAt(x, y); return id && id !== k + 1 && cand[id - 1].rad > t.rad + 0.004 }) }) }
  for (const t of cand) {
    const { s, d } = t, [i0, i1, i2] = t.v
    tris.push([s, d]); const g0 = pos.length
    ;[i0, i1, i2].forEach((i, k) => { const nn = N[i].clone().normalize(); pos.push(P[i * 3] + nn.x * 0.001, P[i * 3 + 1] + nn.y * 0.001, P[i * 3 + 2] + nn.z * 0.001); const rl = Math.hypot(P[i * 3] - ax, P[i * 3 + 2] - az) || 1; const sn = nn.clone().multiplyScalar(0.45).add(e1.set((P[i * 3] - ax) / rl, 0.05, (P[i * 3 + 2] - az) / rl).multiplyScalar(0.55)).normalize(); nor.push(sn.x, sn.y, sn.z); uvs.push((col * CELL + d[k][0]) / (CELL * COLS), 1 - (row * CELL + d[k][1]) / (CELL * ROWS)) })
    t.g0 = g0 / 3; t.cxy = [(d[0][0] + d[1][0] + d[2][0]) / 3, (d[0][1] + d[1][1] + d[2][1]) / 3]
  }

  // F: the painted face, unwrapped into the cell
  const bc = document.createElement('canvas'); bc.width = bc.height = TW; bc.getContext('2d').putImageData(ch.base, 0, 0)
  const cvF = document.createElement('canvas'); cvF.width = cvF.height = CELL; const gF = cvF.getContext('2d', { willReadFrequently: true })
  for (const [s, d] of tris) drawTri(gF, bc, s, d)
  const F = gF.getImageData(0, 0, CELL, CELL).data
  const valid = (x, y) => x >= 0 && y >= 0 && x < CELL && y < CELL && F[(y * CELL + x) * 4 + 3] > 200
  const pix = (x, y) => { const i = (y * CELL + x) * 4; return [F[i], F[i + 1], F[i + 2]] }
  const sk = f.skin, sl = lumOf(...sk), sr = sk[0] / (sk[1] + 8)
  const isDark = (x, y) => { if (!valid(x, y)) return false; const p = pix(x, y); return lumOf(...p) < 0.6 * sl }
  const isBright = (x, y) => { if (!valid(x, y)) return false; const p = pix(x, y); return lumOf(...p) > 1.45 * sl && (Math.max(...p) - Math.min(...p)) < 0.5 * Math.max(...p) }
  const isRed = (x, y) => { if (!valid(x, y)) return false; const p = pix(x, y); const l = lumOf(...p); return p[0] / (p[1] + 8) > sr * 1.1 && l > 0.45 * sl && l < 1.6 * sl }
  // connected components of `test` inside a box
  const comps = (test, x0, y0, x1, y1) => {
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(CELL - 1, Math.ceil(x1)); y1 = Math.min(CELL - 1, Math.ceil(y1))
    const w = x1 - x0 + 1, h = y1 - y0 + 1; if (w <= 0 || h <= 0) return []
    const seen = new Uint8Array(w * h), out = []
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (seen[(y - y0) * w + x - x0] || !test(x, y)) continue
      const st = [[x, y]], pts = []; seen[(y - y0) * w + x - x0] = 1
      while (st.length) { const [px, py] = st.pop(); pts.push([px, py]); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const qx = px + dx, qy = py + dy; if (qx < x0 || qy < y0 || qx > x1 || qy > y1) continue; const k = (qy - y0) * w + qx - x0; if (seen[k] || !test(qx, qy)) continue; seen[k] = 1; st.push([qx, qy]) } }
      out.push(pts)
    }
    return out
  }
  const rough = { l: proj(f.lx, f.ey, f.zAt(f.lx, f.ey)), r: proj(f.rx, f.ey, f.zAt(f.rx, f.ey)), m: proj(f.cx, f.my, f.mz) }
  const I = rough.r[0] - rough.l[0], mid = (rough.l[0] + rough.r[0]) / 2
  const det = { eyes: {}, brows: {}, notes: [] }
  for (const [key, side] of [['l', -1], ['r', 1]]) {
    const [ex, ey] = rough[key]; const x0 = side < 0 ? ex - 0.52 * I : Math.max(mid + 0.06 * I, ex - 0.52 * I), x1 = side < 0 ? Math.min(mid - 0.06 * I, ex + 0.52 * I) : ex + 0.52 * I
    const cs = comps((x, y) => isDark(x, y) || isBright(x, y), x0, ey - 0.2 * I, x1, ey + 0.24 * I).filter((p) => p.length > 6)
    let best = null; for (const p of cs) { const near = p.some(([x, y]) => Math.hypot(x - ex, y - ey) < 0.2 * I); const sc = p.length * (near ? 3 : 1); if (!best || sc > best.sc) best = { p, sc } }
    let e = best ? pca(best.p) : null
    if (!e || e.a < 0.12 * I || e.a > 0.46 * I || e.b < 0.03 * I || e.b > 0.3 * I) { det.notes.push('eye ' + key + ' fallback'); e = { cx: ex, cy: ey, a: 0.27 * I, b: 0.1 * I, th: 0, fb: true } }
    if (Math.abs(e.th) > 0.6) e.th = 0
    e.tilt = side > 0 ? -e.th : e.th; det.eyes[key] = e
    // brow: dark blob above the eye
    const et = e.cy - e.b, bx0 = side < 0 ? ex - 0.6 * I : Math.max(mid + 0.02 * I, ex - 0.6 * I), bx1 = side < 0 ? Math.min(mid - 0.02 * I, ex + 0.6 * I) : ex + 0.6 * I
    const bs = comps(isDark, bx0, et - 0.5 * I, bx1, et - 0.03 * I).filter((p) => p.length > 8).map((p) => ({ p, q: pca(p) }))
    let bb = null; for (const o of bs) { if (o.q.b > 0.16 * I || o.q.a < 0.1 * I) continue; const d = Math.hypot(o.q.cx - ex, o.q.cy - (et - 0.2 * I)); const sc = o.p.length / (1 + d / (0.15 * I)); if (!bb || sc > bb.sc) bb = { ...o, sc } }
    let bw
    if (bb) { let cr = 0, cg = 0, cb = 0; for (const [x, y] of bb.p) { const p = pix(x, y); cr += p[0]; cg += p[1]; cb += p[2] } bw = { cx: bb.q.cx, cy: bb.q.cy, bl: clamp(bb.q.a, 0.2 * I, 0.42 * I), th: clamp(bb.q.b * 2, 0.045 * I, 0.11 * I), phi: side > 0 ? bb.q.th : -bb.q.th, col: [cr / bb.p.length, cg / bb.p.length, cb / bb.p.length] } } else { det.notes.push('brow ' + key + ' fallback'); bw = { cx: ex, cy: et - 0.2 * I, bl: 0.3 * I, th: 0.06 * I, phi: 0.1, col: [22, 12, 8], fb: true } }
    if (Math.abs(bw.phi) > 0.5) bw.phi = 0.1
    det.brows[key] = bw
  }
  // symmetric shape (keep each side's own position)
  const avg = (k, o) => { const l = o.l, r = o.r; const v = (l.fb && !r.fb) ? r[k] : (r.fb && !l.fb) ? l[k] : (l[k] + r[k]) / 2; l[k] = r[k] = v }
  for (const k of ['a', 'b', 'tilt']) avg(k, det.eyes); for (const k of ['bl', 'th', 'phi']) avg(k, det.brows)
  const ecy = (det.eyes.l.cy + det.eyes.r.cy) / 2; if (Math.abs(det.eyes.l.cy - det.eyes.r.cy) > 0.08 * I) det.eyes.l.cy = det.eyes.r.cy = ecy
  const E = cfg.eye || {}
  for (const k of ['l', 'r']) {
    const e = det.eyes[k]; e.a0 = e.a; e.b0 = e.b
    e.a = (E.a ? E.a * I : clamp(e.a * 1.12, 0.22 * I, 0.36 * I)); e.b = E.b ? E.b * I : clamp(e.b * 1.4, 0.32 * e.a, 0.62 * e.a)
    e.tilt = E.tilt !== undefined ? E.tilt : clamp(e.tilt, -0.08, 0.42)
    e.lidRest = E.lid !== undefined ? E.lid : 0.3; e.lashes = !!E.lashes; e.iris = E.iris || 1
    if (E.dy) e.cy += E.dy * I; if (E.spread) e.cx += (k === 'l' ? -1 : 1) * E.spread * I
    const bw = det.brows[k]; const B = cfg.brow || {}; if (B.th) bw.th = B.th * I; if (B.dy) bw.cy += B.dy * I; if (B.phi !== undefined) bw.phi = B.phi; if (B.bl) bw.bl = B.bl * I
    if (bw.cy > e.cy - e.b - 0.1 * I) bw.cy = e.cy - e.b - 0.14 * I
  }
  // mouth
  const [mx0, my0] = rough.m
  const ms = comps((x, y) => isRed(x, y) || isDark(x, y) || isBright(x, y), mx0 - 0.62 * I, my0 - 0.2 * I, mx0 + 0.62 * I, my0 + 0.26 * I).filter((p) => p.length > 10)
  let mb = null; for (const p of ms) { const near = p.some(([x, y]) => Math.hypot(x - mx0, y - my0) < 0.18 * I); const sc = p.length * (near ? 3 : 1); if (!mb || sc > mb.sc) mb = { p, sc } }
  const M = cfg.mouth || {}; let m
  if (mb) {
    let x0 = 1e9, x1 = -1e9, sy = 0, cr = 0, cg = 0, cb = 0, nr = 0
    for (const [x, y] of mb.p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); sy += y; if (isRed(x, y)) { const p = pix(x, y); cr += p[0]; cg += p[1]; cb += p[2]; nr++ } }
    m = { cx: (x0 + x1) / 2, cy: sy / mb.p.length, mw: clamp((x1 - x0) / 2, 0.24 * I, 0.52 * I), lip: nr > 15 ? [cr / nr, cg / nr, cb / nr] : null, redPx: nr }
  } else { det.notes.push('mouth fallback'); m = { cx: mx0, cy: my0, mw: 0.36 * I, lip: null, fb: true } }
  if (!m.lip) m.lip = [sk[0] * 0.92, sk[1] * 0.72, sk[2] * 0.78]
  if (M.lip) m.lip = M.lip; if (M.mw) m.mw = M.mw * I; if (M.dy) m.cy += M.dy * I
  m.tu = (M.tu || 0.13) * m.mw; m.tl = (M.tl || 0.2) * m.mw
  det.mouth = m; det.I = I

  // inpaint: feathered ellipses around the painted (and the redrawn) features, filled from the skin just outside them
  const ell = []
  for (const k of ['l', 'r']) { const e = det.eyes[k], bw = det.brows[k]; const t = Math.min(bw.cy - bw.th * 1.6 - 0.2 * I, e.cy - e.b - 0.4 * I), bt = e.cy + e.b + 0.12 * I; ell.push({ cx: (e.cx + bw.cx) / 2, cy: (t + bt) / 2, rx: Math.max(e.a0 * 1.25, e.a, bw.bl) * 1.4 + 0.1 * I, ry: (bt - t) / 2 + 0.08 * I }) }
  ell.push({ cx: m.cx, cy: m.cy + 0.09 * I, rx: m.mw * 1.42 + 0.06 * I, ry: 0.38 * I })
  const rho = (e, x, y) => Math.hypot((x - e.cx) / e.rx, (y - e.cy) / e.ry)
  // decal geometry: only the triangles under the three feathered patches
  { const keep = cand.filter((t) => ell.some((e) => rho(e, t.cxy[0], t.cxy[1]) < 1.12 || t.d.some((p) => rho(e, p[0], p[1]) < 1.0))); const P2 = [], N2 = [], U2 = []
    for (const t of keep) for (let k = 0; k < 3; k++) { const i = t.g0 + k; P2.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); N2.push(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]); U2.push(uvs[i * 2], uvs[i * 2 + 1]) }
    pos.length = 0; nor.length = 0; uvs.length = 0; pos.push(...P2); nor.push(...N2); uvs.push(...U2); det.decalTris = keep.length }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  const mesh = new THREE.Mesh(geo, atlas.mat); mesh.renderOrder = 2; mesh.frustumCulled = false; ch.headGroup.add(mesh)
  const samples = []
  for (const e of ell) for (let k = 0; k < 96; k++) for (const rr of [1.05, 1.13]) {
    const x = Math.round(e.cx + Math.cos(k / 96 * 6.2832) * e.rx * rr), y = Math.round(e.cy + Math.sin(k / 96 * 6.2832) * e.ry * rr)
    if (!valid(x, y) || ell.some((o) => o !== e && rho(o, x, y) < 1.03)) continue
    let r = 0, g = 0, bq = 0, cnt = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (valid(x + dx, y + dy)) { const p = pix(x + dx, y + dy); r += p[0]; g += p[1]; bq += p[2]; cnt++ }
    r /= cnt; g /= cnt; bq /= cnt; const l = lumOf(r, g, bq); if (l < 0.62 * sl || l > 1.6 * sl || Math.abs(r / (g + 8) - sr) > 0.22 * sr) continue
    samples.push([x, y, r, g, bq])
  }
  det.samples = samples.length
  const cvB = document.createElement('canvas'); cvB.width = cvB.height = CELL; const gB = cvB.getContext('2d'); const im = gB.createImageData(CELL, CELL)
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    let mk = 0; for (const e of ell) mk = Math.max(mk, clamp((1 - rho(e, x, y)) / 0.2, 0, 1)); if (mk <= 0 || !valid(x, y)) continue
    let r = 0, g = 0, bq = 0, ws = 0
    if (samples.length > 10) for (const s of samples) { const d2 = (s[0] - x) ** 2 + (s[1] - y) ** 2 + 2; const w = 1 / (d2 * Math.sqrt(d2)); r += s[2] * w; g += s[3] * w; bq += s[4] * w; ws += w } else { r = sk[0]; g = sk[1]; bq = sk[2]; ws = 1 }
    const i = (y * CELL + x) * 4; im.data[i] = r / ws; im.data[i + 1] = g / ws; im.data[i + 2] = bq / ws; im.data[i + 3] = 255 * mk * mk * (3 - 2 * mk)
  }
  gB.putImageData(im, 0, 0)
  // local skin colour next to each feature (lids, lips shading)
  const at = (x, y) => { const i = (Math.round(clamp(y, 0, CELL - 1)) * CELL + Math.round(clamp(x, 0, CELL - 1))) * 4; return im.data[i + 3] > 100 ? [im.data[i], im.data[i + 1], im.data[i + 2]] : sk }
  for (const k of ['l', 'r']) det.eyes[k].skin = at(det.eyes[k].cx, det.eyes[k].cy)
  m.skin = at(m.cx, m.cy)
  ch.face4 = det; ch.face4Mesh = mesh; ch.face4Tris = det.decalTris; ch.face4F = cvF; ch.face4B = cvB

  const g = atlas.g
  const drawEye = (e, side, st) => {
    const a = e.a, b = e.b * (1 + 0.24 * (st.eyeWide || 0)), tilt = e.tilt - (st.droop || 0) * 0.22
    g.save(); g.translate(e.cx, e.cy); g.scale(side, 1); g.rotate(-tilt)
    const inY = 0.14 * b, outY = -0.04 * b
    let L = clamp(e.lidRest + (st.lidAdd || 0) - (st.gy || 0) * 0.14, 0.02, 1); L = lerp(L, 1, Math.max(st.blink || 0, st.closeHappy || 0)); const closed = L > 0.9
    const happy = (st.closeHappy || 0) > 0.5 && (st.blink || 0) < 0.5
    const lidCtl = lerp(-1.38 * b, 0.95 * b, L)
    const lowCtl = lerp(1.08 * b, -0.1 * b, (st.squint || 0) * 0.7)
    if (!closed) {
      g.save(); g.beginPath(); g.moveTo(-a, inY); g.bezierCurveTo(-0.45 * a, -1.38 * b, 0.4 * a, -1.38 * b, a, outY); g.bezierCurveTo(0.45 * a, 1.05 * b, -0.4 * a, 1.12 * b, -a, inY); g.closePath(); g.clip()
      const gr0 = g.createLinearGradient(0, -b, 0, b); gr0.addColorStop(0, '#d9cfc4'); gr0.addColorStop(0.5, '#f1eadf'); gr0.addColorStop(1, '#e6dccf'); g.fillStyle = gr0; g.fillRect(-a - 3, -2 * b - 3, 2 * a + 6, 4 * b + 6)
      const ri = Math.min(1.04 * e.b, 0.5 * a) * e.iris, ix = (st.gx || 0) * side * 0.3 * a, iy = -(st.gy || 0) * 0.26 * b + 0.04 * b
      const gr = g.createRadialGradient(ix, iy + 0.25 * ri, ri * 0.15, ix, iy, ri); gr.addColorStop(0, '#8a5226'); gr.addColorStop(0.7, '#57301a'); gr.addColorStop(0.86, '#2a160c'); gr.addColorStop(1, '#170b06')
      g.fillStyle = gr; g.beginPath(); g.arc(ix, iy, ri, 0, 7); g.fill()
      g.fillStyle = '#090504'; g.beginPath(); g.arc(ix, iy, ri * 0.46, 0, 7); g.fill()
      g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.arc(ix - 0.34 * ri * side, iy - 0.36 * ri, ri * 0.2, 0, 7); g.fill()
      // soft shadow under the upper lid, then the lid itself
      g.strokeStyle = 'rgba(20,8,4,0.3)'; g.lineWidth = 0.6 * b; g.beginPath(); g.moveTo(-a, inY); g.bezierCurveTo(-0.45 * a, lidCtl, 0.4 * a, lidCtl, a, outY); g.stroke()
      g.fillStyle = css(e.skin, 0.84); g.beginPath(); g.moveTo(-a - 4, -3 * b); g.lineTo(-a - 4, inY); g.lineTo(-a, inY); g.bezierCurveTo(-0.45 * a, lidCtl, 0.4 * a, lidCtl, a, outY); g.lineTo(a + 4, outY); g.lineTo(a + 4, -3 * b); g.closePath(); g.fill()
      if ((st.squint || 0) > 0.02) { g.fillStyle = css(e.skin, 0.95); g.beginPath(); g.moveTo(a + 4, 3 * b); g.lineTo(a + 4, outY); g.lineTo(a, outY); g.bezierCurveTo(0.45 * a, lowCtl, -0.4 * a, lowCtl + 0.07 * b, -a, inY); g.lineTo(-a - 4, inY); g.lineTo(-a - 4, 3 * b); g.closePath(); g.fill() }
      g.restore()
      g.strokeStyle = 'rgba(28,12,6,0.5)'; g.lineWidth = Math.max(0.9, 0.09 * e.b); g.lineCap = 'round'; g.beginPath(); g.moveTo(a, outY); g.bezierCurveTo(0.45 * a, lowCtl, -0.4 * a, lowCtl + 0.07 * b, -a, inY); g.stroke()
    }
    const cc = closed ? (happy ? -0.8 * b : 0.8 * b) : lidCtl
    g.strokeStyle = '#150b07'; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = Math.max(1.5, (e.lashes ? 0.3 : 0.2) * e.b); g.beginPath(); g.moveTo(-a, inY + (closed && happy ? 0.3 * b : 0)); g.bezierCurveTo(-0.45 * a, cc, 0.4 * a, cc, a, outY + (closed && happy ? 0.3 * b : 0)); if (e.lashes && !happy) g.lineTo(a * 1.2, outY - 0.34 * b); g.stroke()
    g.restore()
  }
  const drawBrow = (bw, side, st) => {
    g.save(); g.translate(bw.cx, bw.cy - (st.brow || 0) * 0.12 * I + (st.angry || 0) * 0.07 * I); g.scale(side, 1); g.rotate(bw.phi + (st.sadBrow || 0) * 0.36 - (st.angry || 0) * 0.42)
    const l = bw.bl, t = bw.th, ar = 0.55 * t
    g.fillStyle = css(bw.col, 0.9); g.beginPath(); g.moveTo(-l, -0.55 * t); g.quadraticCurveTo(0.1 * l, -0.6 * t - 2 * ar, l, 0); g.quadraticCurveTo(0.1 * l, 0.5 * t - 1.7 * ar, -l, 0.55 * t); g.quadraticCurveTo(-l - 0.5 * t, 0, -l, -0.55 * t); g.fill(); g.restore()
  }
  const drawMouth = (st) => {
    const sm = st.smile || 0, op = st.open || 0, wd = st.mWide || 0, rd = st.round || 0, mw = m.mw
    const W = mw * (1 + 0.14 * Math.max(0, sm) + 0.12 * wd - 0.42 * rd), tu = m.tu * (1 - 0.25 * wd), tl = m.tl * (1 - 0.2 * wd)
    const cyc = -sm * 0.22 * mw, yu = Math.max(0, sm) * 0.07 * mw - 0.08 * mw * op, yl = yu + op * (0.6 + 0.25 * rd) * mw
    const q = (ym, x) => g.quadraticCurveTo(0, 2 * ym - cyc, x, cyc)
    g.save(); g.translate(m.cx, m.cy)
    if (op > 0.05) {
      g.beginPath(); g.moveTo(-W, cyc); q(yu, W); q(yl, -W); g.closePath(); g.fillStyle = '#2b090b'; g.fill(); g.save(); g.clip()
      const tt = (0.15 + 0.1 * wd) * mw * Math.min(1, op * 3)
      g.fillStyle = '#f4efe6'; g.beginPath(); g.moveTo(-W, cyc); q(yu, W); q(yu + tt, -W); g.closePath(); g.fill()
      if (op > 0.3) { g.fillStyle = '#c4505a'; g.beginPath(); g.ellipse(0, yl - 0.04 * mw, W * 0.55, (yl - yu) * 0.38, 0, 0, 7); g.fill() }
      g.restore()
    }
    g.fillStyle = css(m.lip, 0.86); g.beginPath(); g.moveTo(-W, cyc); q(yu - tu, W); q(yu, -W); g.closePath(); g.fill()
    g.fillStyle = css(m.lip, 1.0); g.beginPath(); g.moveTo(-W, cyc); q(yl, W); q(yl + tl, -W); g.closePath(); g.fill()
    g.strokeStyle = 'rgba(255,235,225,0.22)'; g.lineWidth = tl * 0.3; g.lineCap = 'round'; g.beginPath(); g.moveTo(-W * 0.35, cyc * 0.3 + yl + tl * 0.45); g.lineTo(W * 0.35, cyc * 0.3 + yl + tl * 0.45); g.stroke()
    g.strokeStyle = css(m.lip, 0.38); g.lineWidth = Math.max(1.1, 0.045 * mw); g.beginPath(); g.moveTo(-W, cyc); q(yu, W); g.stroke()
    g.fillStyle = css(m.skin, 0.6); for (const s of [-1, 1]) { g.beginPath(); g.arc(s * (W + 0.03 * mw), cyc - 0.01 * mw, 0.035 * mw + Math.max(0, sm) * 0.02 * mw, 0, 7); g.fill() }
    g.restore()
  }
  ch.drawFace4 = (st) => {
    g.save(); g.setTransform(1, 0, 0, 1, col * CELL, row * CELL); g.beginPath(); g.rect(0, 0, CELL, CELL); g.clip(); g.clearRect(0, 0, CELL, CELL); g.drawImage(cvB, 0, 0)
    drawEye(det.eyes.l, -1, st); drawEye(det.eyes.r, 1, st); drawBrow(det.brows.l, -1, st); drawBrow(det.brows.r, 1, st); drawMouth(st)
    g.restore(); atlas.dirty = true
  }
  // debug view: painted face with what was detected
  ch.face4Debug = () => { const cv = document.createElement('canvas'); cv.width = CELL * 2; cv.height = CELL; const d = cv.getContext('2d'); d.fillStyle = '#404'; d.fillRect(0, 0, CELL * 2, CELL); d.drawImage(cvF, 0, 0); d.drawImage(cvF, CELL, 0); d.drawImage(cvB, CELL, 0)
    d.lineWidth = 1; for (const k of ['l', 'r']) { const e = det.eyes[k], bw = det.brows[k]; d.strokeStyle = '#0f0'; d.beginPath(); d.ellipse(e.cx, e.cy, e.a0, e.b0, (k === 'r' ? -1 : 1) * e.tilt, 0, 7); d.stroke(); d.strokeStyle = '#0ff'; d.beginPath(); d.ellipse(bw.cx, bw.cy, bw.bl, bw.th / 2, (k === 'r' ? 1 : -1) * bw.phi, 0, 7); d.stroke() }
    d.strokeStyle = '#ff0'; d.strokeRect(m.cx - m.mw, m.cy - 3, 2 * m.mw, 6); d.fillStyle = '#f0f'; for (const s of samples) d.fillRect(s[0], s[1], 1, 1); return cv.toDataURL() }
  return det
}

// ---- animation helpers ---------------------------------------------------------------------------------------------
const h = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
// small saccades, an occasional wide glance, natural blinks (fast close, slower open, sometimes double)
export function live (t, seed = 0) {
  const T = 0.8, p = t / T + seed * 3.7, k = Math.floor(p), u = clamp((p - k) * T / 0.07, 0, 1), e = u * u * (3 - 2 * u)
  const tg = (k) => { const big = h(k * 3.1) > 0.78; const amp = big ? 1 : 0.32; return [(h(k) - 0.5) * 2 * amp, (h(k + 50) - 0.5) * 1.1 * amp] }
  const A = tg(k - 1), B = tg(k); let bl = 0; const BP = 2.7, kb = Math.floor(t / BP)
  for (const kk of [kb - 1, kb]) { const st = kk * BP + h(kk + 9 + seed) * 1.5; for (const off of (h(kk + 77 + seed) > 0.72 ? [0, 0.3] : [0])) { const d = t - st - off; if (d >= 0 && d < 0.21) bl = Math.max(bl, d < 0.055 ? d / 0.055 : 1 - (d - 0.055) / 0.155) } }
  return { gx: lerp(A[0], B[0], e), gy: lerp(A[1], B[1], e), blink: bl }
}
export const EXPR4 = {
  neutral: { smile: 0.3 },
  smile: { lidAdd: 0.05, squint: 0.5, smile: 1, brow: 0.15 },
  laugh: { closeHappy: 1, smile: 1, open: 0.7, mWide: 0.5, brow: 0.4 },
  sad: { lidAdd: 0.13, droop: 1, sadBrow: 1, smile: -0.9, brow: 0.1 },
  surprised: { lidAdd: -0.32, eyeWide: 1, brow: 1, open: 0.55, round: 0.75 },
  angry: { lidAdd: 0.1, angry: 1, smile: -0.5 }
}
const KEYS = ['lidAdd', 'squint', 'closeHappy', 'droop', 'eyeWide', 'brow', 'sadBrow', 'angry', 'smile', 'open', 'mWide', 'round']
export const mix4 = (a, b, u) => { const o = {}; for (const k of KEYS) o[k] = (a[k] || 0) * (1 - u) + (b[k] || 0) * u; return o }
// lip-sync loop: M A E O U visemes
const VIS = [[0, 0, 0], [0.8, 0.15, 0], [0.3, 0.9, 0], [0, 0, 0], [0.55, 0, 0.9], [0.75, 0.2, 0], [0.22, 0, 1], [0.35, 0.8, 0], [0, 0, 0], [0.7, 0.1, 0.2]]
export function viseme (t) { const p = t / 0.125, k = Math.floor(p), u = p - k, e = u * u * (3 - 2 * u), A = VIS[k % VIS.length], B = VIS[(k + 1) % VIS.length]; return { open: lerp(A[0], B[0], e), mWide: lerp(A[1], B[1], e), round: lerp(A[2], B[2], e) } }
