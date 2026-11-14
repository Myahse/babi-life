// Round 3 lab kit: work-arounds for fused Meshy characters (living face, zones, head x body mix, accessories, shared clips, IK).
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export const loadGLB = (url) => new Promise((ok, ko) => new GLTFLoader().load(url, ok, undefined, ko))
const grpOf = (n) => /head|neck/i.test(n) ? 'head' : /Foot|Toe/.test(n) ? 'feet' : /Hips|Leg/.test(n) ? 'lower' : 'upper'
const TW = 1024

// Skeleton.pose() ignores the transform of a root bone's non-bone parent (Meshy's Armature is scaled 0.01), so do it properly:
// at bind, bone.matrixWorld === inverse(boneInverse).
function bindPose (o, mesh) {
  o.updateMatrixWorld(true); const sk = mesh.skeleton; const m = new THREE.Matrix4(), pi = new THREE.Matrix4()
  sk.bones.forEach((b, i) => { b.parent.updateWorldMatrix(true, false); m.copy(sk.boneInverses[i]).invert(); pi.copy(b.parent.matrixWorld).invert().multiply(m).decompose(b.position, b.quaternion, b.scale); b.updateMatrix(); b.updateWorldMatrix(false, false) })
  o.updateMatrixWorld(true)
}
// Bind-pose world positions, dominant bone per vertex.
function analyse (ch) {
  const { mesh, o } = ch; const geo = mesh.geometry; const n = geo.attributes.position.count
  bindPose(o, mesh); mesh.skeleton.update()
  const P = new Float32Array(n * 3); const v = new THREE.Vector3()
  for (let i = 0; i < n; i++) { mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld); v.toArray(P, i * 3) }
  ch.P = P
}

export async function loadChar (url, height) {
  const g = await loadGLB(url); const o = g.scene; let mesh
  o.traverse((c) => { if (c.isSkinnedMesh) mesh = c; if (c.isMesh) { c.castShadow = c.receiveShadow = true; c.frustumCulled = false; c.material.side = THREE.FrontSide } })
  const holder = new THREE.Group(); holder.add(o)
  const ch = { g, o, holder, mesh, height, bones: {}, clips: {}, acts: {} }
  mesh.skeleton.bones.forEach((b) => { ch.bones[b.name] = b })
  analyse(ch)
  let lo = 1e9, hi = -1e9; for (let i = 1; i < ch.P.length; i += 3) { lo = Math.min(lo, ch.P[i]); hi = Math.max(hi, ch.P[i]) }
  o.scale.multiplyScalar(height / (hi - lo)); analyse(ch)
  lo = 1e9; let sx = 0; const n = ch.P.length / 3; for (let i = 0; i < n; i++) { lo = Math.min(lo, ch.P[i * 3 + 1]); sx += ch.P[i * 3] }
  o.position.y -= lo; o.position.x -= sx / n; analyse(ch)
  // per-vertex dominant bone group
  const si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight
  ch.dom = new Array(n); ch.grp = new Array(n)
  for (let i = 0; i < n; i++) { let b = 0, w = -1; for (let k = 0; k < 4; k++) { const ww = sw.getComponent(i, k); if (ww > w) { w = ww; b = si.getComponent(i, k) } } ch.dom[i] = mesh.skeleton.bones[b].name; ch.grp[i] = grpOf(ch.dom[i]) }
  ch.hipsBind = ch.bones.Hips.position.clone()
  ch.bindWorld = {}; for (const k in ch.bones) ch.bindWorld[k] = ch.bones[k].matrixWorld.clone()
  // texture pixels (glTF textures: flipY false, so pixel = uv * size)
  const cv = document.createElement('canvas'); cv.width = cv.height = TW; const cx = cv.getContext('2d', { willReadFrequently: true })
  cx.drawImage(mesh.material.map.image, 0, 0, TW, TW); ch.base = cx.getImageData(0, 0, TW, TW); ch.origMap = mesh.material.map
  ch.mixer = new THREE.AnimationMixer(o)
  // a container expressed in bind-pose world coordinates, riding the Head bone
  ch.headGroup = new THREE.Group(); attachBind(ch.headGroup, ch, 'Head')
  return ch
}
// Make `group` (whose children are authored in donor bind-pose world space) follow bone `name` of `ch`.
export function attachBind (group, ch, name, pre) {
  group.matrixAutoUpdate = false; group.matrix.copy(ch.bindWorld[name]).invert(); if (pre) group.matrix.multiply(pre)
  ch.bones[name].add(group)
}
export function addClip (ch, key, clip) { ch.clips[key] = clip; const a = ch.mixer.clipAction(clip); a.play(); a.setEffectiveWeight(0); ch.acts[key] = a }
// One clip set for every character on the same 24-bone rig: keep rotations, rescale the hip translation.
export function shareClip (clip, src, dst) {
  const ratio = dst.hipsBind.length() / src.hipsBind.length(); const tracks = []
  for (const t of clip.tracks) {
    const i = t.name.lastIndexOf('.'); const bone = t.name.slice(0, i), prop = t.name.slice(i + 1)
    if (!dst.bones[bone]) continue
    if (prop === 'quaternion') tracks.push(t)
    else if (prop === 'position' && bone === 'Hips') { const c = t.clone(); for (let k = 0; k < c.values.length; k++) c.values[k] *= ratio; tracks.push(c) }
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks)
}
export function setPose (ch, weights, t) { // weights: {key: w}
  for (const k in ch.acts) { const a = ch.acts[k]; const w = weights[k] || 0; a.setEffectiveWeight(w); if (w > 0) { const d = ch.clips[k].duration; a.time = ((t % d) + d) % d } }
  ch.mixer.update(0)
}

const px = (ch, u, v) => { const x = Math.min(TW - 1, Math.max(0, Math.floor(u * TW))), y = Math.min(TW - 1, Math.max(0, Math.floor(v * TW))); const i = (y * TW + x) * 4; const d = ch.base.data; return [d[i], d[i + 1], d[i + 2]] }
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }

// ---- 1. Face: find the painted eyes/mouth, then lay a canvas-drawn face over them -------------------------------
export function findFace (ch, cfg = {}) {
  const { mesh, P } = ch; const idx = mesh.geometry.index.array, uv = mesh.geometry.attributes.uv
  const S = []; const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nrm = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3()
  const bary = [[.34, .33], [.6, .2], [.2, .6], [.2, .2], [.1, .45], [.45, .1], [.45, .45], [.8, .1], [.1, .8], [.1, .1]]
  ch.headTris = []
  for (let t = 0; t < idx.length; t += 3) {
    const i0 = idx[t], i1 = idx[t + 1], i2 = idx[t + 2]
    if (ch.grp[i0] !== 'head' || ch.grp[i1] !== 'head' || ch.grp[i2] !== 'head') continue
    a.fromArray(P, i0 * 3); b.fromArray(P, i1 * 3); c.fromArray(P, i2 * 3)
    nrm.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)).normalize(); ch.headTris.push([i0, i1, i2, nrm.z])
    if (nrm.z < 0.35) continue
    for (const [s, r] of bary) {
      const q = 1 - s - r
      const u = uv.getX(i0) * q + uv.getX(i1) * s + uv.getX(i2) * r, v = uv.getY(i0) * q + uv.getY(i1) * s + uv.getY(i2) * r
      S.push({ x: a.x * q + b.x * s + c.x * r, y: a.y * q + b.y * s + c.y * r, z: a.z * q + b.z * s + c.z * r, c: px(ch, u, v) })
    }
  }
  const hb = new THREE.Vector3().setFromMatrixPosition(ch.bindWorld.Head); const k = ch.height / 1.7
  const lum = (c) => (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 255
  const zmax = Math.max(...S.filter((s) => Math.abs(s.x - hb.x) < 0.05 * k && s.y > hb.y).map((s) => s.z))
  // eye whites: bright, unsaturated, on the front of the face (hair highlights are further back or far to the side)
  let W = S.filter((s) => lum(s.c) > 0.6 && (Math.max(...s.c) - Math.min(...s.c)) < 55 && Math.abs(s.x - hb.x) < 0.085 * k && s.y > hb.y + 0.02 * k && s.y < hb.y + 0.2 * k && s.z > zmax - 0.06 * k)
  let f
  if (W.length > 6) {
    const my = med(W.map((s) => s.y)); W = W.filter((s) => Math.abs(s.y - my) < 0.03 * k)
    const L = W.filter((s) => s.x < hb.x), R = W.filter((s) => s.x >= hb.x)
    if (L.length > 2 && R.length > 2) f = { lx: med(L.map((s) => s.x)), rx: med(R.map((s) => s.x)), ey: (med(L.map((s) => s.y)) + med(R.map((s) => s.y))) / 2, ez: Math.max(...W.map((s) => s.z)), auto: true, whites: W.length }
  }
  if (!f) f = { lx: hb.x - 0.03 * k, rx: hb.x + 0.03 * k, ey: hb.y + 0.09 * k, ez: zmax, auto: false }
  Object.assign(f, cfg.eyes || {})
  f.cx = (f.lx + f.rx) / 2; f.iod = f.rx - f.lx
  // mouth: the reddest horizontal band under the nose
  const bands = {}; for (const s of S) { if (Math.abs(s.x - f.cx) > 0.3 * f.iod) continue; const d = (f.ey - s.y) / f.iod; if (d < 0.6 || d > 1.6) continue; const kk = Math.round(d / 0.06); (bands[kk] = bands[kk] || []).push(s.c[0] / (s.c[1] + 8)) }
  const br = Object.entries(bands).filter(([, v]) => v.length > 3).map(([kk, v]) => [kk * 0.06, v.reduce((p, q) => p + q, 0) / v.length])
  let md = 1.0; if (br.length > 3) { const m = med(br.map((x) => x[1])); const best = br.reduce((p, q) => q[1] > p[1] ? q : p); if (best[1] > m * 1.06) { md = best[0]; f.mouthAuto = true } }
  f.my = f.ey - md * f.iod; if (cfg.my !== undefined) f.my = f.ey - cfg.my * f.iod
  const zAt = (x, y) => { let bz = f.ez, bd = 1e9; for (const s of S) { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (d < bd) { bd = d; bz = s.z } } return bz }
  f.mz = zAt(f.cx, f.my); f.zAt = zAt
  const cheeks = S.filter((s) => { const dx = Math.abs(s.x - f.cx) / f.iod, dy = (f.ey - s.y) / f.iod; return dx > 0.3 && dx < 0.75 && dy > 0.3 && dy < 0.7 })
  f.skin = cheeks.length ? [0, 1, 2].map((i) => med(cheeks.map((s) => s.c[i]))) : [110, 70, 45]
  // head half-width at eye level (for glasses arms / headphones)
  f.hw = Math.max(...S.filter((s) => Math.abs(s.y - f.ey) < 0.02 * k).map((s) => Math.abs(s.x - f.cx)))
  f.hw = Math.min(f.hw, 1.3 * f.iod)
  ch.face = f; return f
}
const FS = 256
export function buildFace (ch, opts = {}) {
  const f = ch.face; const { P, mesh } = ch; const uv = mesh.geometry.attributes.uv
  const top = f.ey + 0.8 * f.iod, bot = f.my - 0.6 * f.iod, cy = (top + bot) / 2, size = Math.max(2.7 * f.iod, top - bot)
  const pos = [], uvs = [], nor = []; const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3()
  // smooth normals for the offset
  const N = {}; for (const [i0, i1, i2] of ch.headTris) { a.fromArray(P, i0 * 3); b.fromArray(P, i1 * 3); c.fromArray(P, i2 * 3); n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)); for (const i of [i0, i1, i2]) { (N[i] = N[i] || new THREE.Vector3()).add(n) } }
  for (const [i0, i1, i2, nz] of ch.headTris) {
    if (nz < 0.05) continue
    const mx = (P[i0 * 3] + P[i1 * 3] + P[i2 * 3]) / 3, my = (P[i0 * 3 + 1] + P[i1 * 3 + 1] + P[i2 * 3 + 1]) / 3, mz = (P[i0 * 3 + 2] + P[i1 * 3 + 2] + P[i2 * 3 + 2]) / 3
    if (Math.abs(mx - f.cx) > 1.3 * f.iod || my > top || my < bot || mz < f.ez - 0.9 * f.iod) continue
    for (const i of [i0, i1, i2]) { const nn = N[i].clone().normalize(); pos.push(P[i * 3] + nn.x * 0.0012, P[i * 3 + 1] + nn.y * 0.0012, P[i * 3 + 2] + nn.z * 0.0012); nor.push(nn.x, nn.y, nn.z); uvs.push((P[i * 3] - f.cx) / size + 0.5, (P[i * 3 + 1] - cy) / size + 0.5) }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  const cv = document.createElement('canvas'); cv.width = cv.height = FS; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  const m = new THREE.Mesh(geo, mat); m.renderOrder = 2; m.frustumCulled = false; ch.headGroup.add(m)
  const U = FS / size // px per metre
  const X = (x) => ((x - f.cx) / size + 0.5) * FS, Y = (y) => (1 - ((y - cy) / size + 0.5)) * FS
  const I = f.iod * U; const skin = `rgb(${f.skin})`; const g = cv.getContext('2d')
  const eyeScale = opts.eyeScale || 1
  ch.faceMesh = m; ch.faceTris = pos.length / 9
  ch.drawFace = (s) => { // s: {blink, gx, gy, brow, tilt, smile, open, round, wide}
    g.clearRect(0, 0, FS, FS)
    const patch = (x, y, rx, ry) => { g.save(); g.translate(x, y); g.scale(rx, ry); const gr = g.createRadialGradient(0, 0, 0.5, 0, 0, 1); gr.addColorStop(0, skin); gr.addColorStop(1, `rgba(${f.skin},0)`); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, 7); g.fill(); g.restore() }
    const ey = Y(f.ey), mo = Y(f.my)
    for (const ex of [X(f.lx), X(f.rx)]) patch(ex, ey - 0.1 * I, 0.5 * I, 0.48 * I)
    patch(X(f.cx), mo, 0.62 * I, 0.36 * I)
    const rx = 0.235 * I * eyeScale, ry = 0.21 * I * eyeScale * (1 + 0.18 * (s.wide || 0))
    for (const side of [-1, 1]) {
      const ex = X(side < 0 ? f.lx : f.rx)
      g.save(); g.beginPath(); g.ellipse(ex, ey, rx, ry, 0, 0, 7); g.clip()
      g.fillStyle = '#f7f3ea'; g.fillRect(ex - rx, ey - ry, 2 * rx, 2 * ry)
      const ix = ex + (s.gx || 0) * rx * 0.42, iy = ey - (s.gy || 0) * ry * 0.35
      g.fillStyle = '#3b1f10'; g.beginPath(); g.arc(ix, iy, 0.155 * I * eyeScale, 0, 7); g.fill()
      g.fillStyle = '#6b3a1c'; g.beginPath(); g.arc(ix, iy, 0.12 * I * eyeScale, 0, 7); g.fill()
      g.fillStyle = '#0c0705'; g.beginPath(); g.arc(ix, iy, 0.07 * I * eyeScale, 0, 7); g.fill()
      g.fillStyle = '#fff'; g.beginPath(); g.arc(ix + 0.05 * I, iy - 0.06 * I, 0.035 * I * eyeScale, 0, 7); g.fill()
      // lids: upper lid comes down with blink, lower lid rises with smile/squint
      const lid = ey - ry + 2 * ry * (0.12 + 0.88 * (s.blink || 0)); g.fillStyle = skin; g.fillRect(ex - rx, ey - ry - 1, 2 * rx, lid - (ey - ry) + 1)
      g.strokeStyle = '#1a0d08'; g.lineWidth = 0.035 * I; g.beginPath(); g.moveTo(ex - rx, lid); g.lineTo(ex + rx, lid); g.stroke()
      const low = (s.squint || 0) * ry * 0.7; if (low > 0) { g.fillStyle = skin; g.fillRect(ex - rx, ey + ry - low, 2 * rx, low + 1) }
      g.restore()
      g.strokeStyle = '#1a0d08'; g.lineWidth = 0.03 * I; g.beginPath(); g.ellipse(ex, ey, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke()
      // brow
      const by = ey - ry - 0.13 * I - (s.brow || 0) * 0.1 * I, tl = (s.tilt || 0) * 0.09 * I * side
      g.strokeStyle = '#140a06'; g.lineWidth = 0.075 * I; g.lineCap = 'round'; g.beginPath(); g.moveTo(ex - side * rx * 0.95, by - Math.abs(tl)); g.quadraticCurveTo(ex, by - 0.07 * I, ex + side * rx * 0.95, by + 0.04 * I + Math.abs(tl) * 0.6); g.stroke() // inner end first (rises when sad)
    }
    // mouth
    const mx = X(f.cx), w = (0.36 - 0.14 * (s.round || 0)) * I, sm = (s.smile || 0) * 0.13 * I, op = (s.open || 0) * 0.3 * I
    g.lineCap = 'round'
    if (op > 0.02 * I) {
      g.beginPath(); g.moveTo(mx - w, mo - sm); g.quadraticCurveTo(mx, mo - sm * -0.4 - 0.04 * I, mx + w, mo - sm); g.quadraticCurveTo(mx, mo + sm + op * 1.9, mx - w, mo - sm); g.closePath()
      g.fillStyle = '#2a0508'; g.fill(); g.save(); g.clip()
      g.fillStyle = '#fbf6ee'; g.fillRect(mx - w, mo - sm - 0.06 * I, 2 * w, 0.13 * I + Math.max(0, sm) * 0.6)
      g.fillStyle = '#d9606a'; g.beginPath(); g.ellipse(mx, mo + sm + op * 0.95, w * 0.6, op * 0.45, 0, 0, 7); g.fill(); g.restore()
      g.strokeStyle = '#8a3a34'; g.lineWidth = 0.05 * I; g.stroke()
    } else {
      g.strokeStyle = '#4a1a14'; g.lineWidth = 0.055 * I; g.beginPath(); g.moveTo(mx - w, mo - sm); g.quadraticCurveTo(mx, mo + sm * 1.3, mx + w, mo - sm); g.stroke()
    }
    tex.needsUpdate = true
  }
  return m
}
export const EXPR = {
  neutral: { smile: 0.25, open: 0, brow: 0, tilt: 0 },
  smile: { smile: 1, open: 0, brow: 0.3, squint: 0.25 },
  laugh: { smile: 1, open: 1, brow: 0.6, squint: 0.75 },
  sad: { smile: -0.9, open: 0, brow: 0.2, tilt: 1 },
  surprised: { smile: 0, open: 0.9, round: 1, brow: 1, wide: 1 },
  talk: { smile: 0.3, open: 0.5, brow: 0.2 }
}
export const mixExpr = (a, b, u) => { const o = {}; for (const k of ['smile', 'open', 'brow', 'tilt', 'squint', 'round', 'wide']) o[k] = (a[k] || 0) * (1 - u) + (b[k] || 0) * u; return o }

// ---- 2d + 4. Zones from bones + colour: per-zone roughness, recolouring, skin tint ---------------------------------
const Z = { none: 0, skin: 1, hair: 2, top: 3, bottom: 4, shoes: 5, gold: 6, headwear: 7 }
export function buildZones (ch) {
  const { mesh } = ch; const idx = mesh.geometry.index.array, uv = mesh.geometry.attributes.uv
  if (!ch.face) findFace(ch)
  const cv = document.createElement('canvas'); cv.width = cv.height = TW; const g = cv.getContext('2d', { willReadFrequently: true })
  const col = { head: '#ff0000', upper: '#00ff00', lower: '#0000ff', feet: '#ffff00' }
  for (let t = 0; t < idx.length; t += 3) {
    const cnt = {}; for (let k = 0; k < 3; k++) cnt[ch.grp[idx[t + k]]] = (cnt[ch.grp[idx[t + k]]] || 0) + 1
    const gname = Object.keys(cnt).reduce((p, q) => cnt[q] > cnt[p] ? q : p)
    g.fillStyle = g.strokeStyle = col[gname]; g.lineWidth = 2; g.beginPath()
    for (let k = 0; k < 3; k++) { const x = uv.getX(idx[t + k]) * TW, y = uv.getY(idx[t + k]) * TW; k ? g.lineTo(x, y) : g.moveTo(x, y) }
    g.closePath(); g.fill(); g.stroke()
  }
  const zd = g.getImageData(0, 0, TW, TW).data; const bd = ch.base.data; const zone = new Uint8Array(TW * TW)
  const sk = ch.face.skin, ss = sk[0] + sk[1] + sk[2], sr = sk[0] / ss, sg = sk[1] / ss, sl = ss / 3
  const count = new Array(8).fill(0)
  for (let i = 0; i < TW * TW; i++) {
    const a = zd[i * 4 + 3]; if (a < 100) continue
    const R = zd[i * 4], G = zd[i * 4 + 1], B = zd[i * 4 + 2]; const part = (R > 128 && G > 128) ? 'feet' : R > 128 ? 'head' : G > 128 ? 'upper' : 'lower'
    const r = bd[i * 4], gg = bd[i * 4 + 1], b = bd[i * 4 + 2], s = r + gg + b + 1, l = s / 3, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b)
    const isSkin = Math.hypot(r / s - sr, gg / s - sg) < 0.04 && l > sl * 0.3 && l < sl * 1.9
    const isGold = r > 150 && gg > 110 && b < gg * 0.75 && (mx - mn) > 70 && r > gg && (r - gg) < 90
    let z
    if (isGold && part !== 'feet') z = Z.gold
    else if (isSkin) z = Z.skin
    else if (part === 'head') z = (l < 60 || (mx - mn) < 40) ? Z.hair : Z.headwear
    else z = part === 'upper' ? Z.top : part === 'lower' ? Z.bottom : Z.shoes
    zone[i] = z; count[z]++
  }
  ch.zone = zone; ch.zoneCount = count
}
export function splitMaterial (ch, on = true) {
  const mat = ch.mesh.material
  if (!on) { mat.roughnessMap = null; mat.roughness = 0.55; mat.needsUpdate = true; return }
  if (!ch.roughTex) {
    const R = { [Z.none]: 0.6, [Z.skin]: 0.62, [Z.hair]: 0.26, [Z.top]: 0.9, [Z.bottom]: 0.9, [Z.shoes]: 0.5, [Z.gold]: 0.25, [Z.headwear]: 0.8 }
    const cv = document.createElement('canvas'); cv.width = cv.height = TW; const g = cv.getContext('2d'); const im = g.createImageData(TW, TW)
    for (let i = 0; i < TW * TW; i++) { const v = Math.round(R[ch.zone[i]] * 255); im.data[i * 4] = 0; im.data[i * 4 + 1] = v; im.data[i * 4 + 2] = 0; im.data[i * 4 + 3] = 255 }
    g.putImageData(im, 0, 0); ch.roughTex = new THREE.CanvasTexture(cv); ch.roughTex.flipY = false
  }
  mat.roughnessMap = ch.roughTex; mat.roughness = 1; mat.needsUpdate = true
}
const rgb2hsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4 } return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx / 255] }
const hsv2rgb = (h, s, v) => { const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c; const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return [(r + m) * 255, (g + m) * 255, (b + m) * 255] }
// spec: { top: {hue: deg, sat: mul, val: mul}, bottom: ..., shoes: ..., hair: ..., skin: [r,g,b] target }
export function recolour (ch, spec, src) {
  const from = src || ch.base; const cv = document.createElement('canvas'); cv.width = cv.height = TW; const g = cv.getContext('2d'); const im = g.createImageData(TW, TW); const d = im.data, bd = from.data
  const ops = {}; for (const k in spec) ops[Z[k]] = spec[k]
  const sk = ch.face.skin
  for (let i = 0; i < TW * TW; i++) {
    let r = bd[i * 4], gg = bd[i * 4 + 1], b = bd[i * 4 + 2]; const op = ops[ch.zone[i]]
    if (op) {
      if (Array.isArray(op)) { r = r * op[0] / sk[0]; gg = gg * op[1] / sk[1]; b = b * op[2] / sk[2] } else {
        const [h, s, v] = rgb2hsv(r, gg, b); [r, gg, b] = hsv2rgb((h + (op.hue || 0) + 360) % 360, Math.min(1, s * (op.sat === undefined ? 1 : op.sat)), Math.min(1, v * (op.val === undefined ? 1 : op.val)))
      }
    }
    d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255
  }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(cv); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; return t
}
export function pixelsOf (tex) { const cv = document.createElement('canvas'); cv.width = cv.height = TW; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(tex.image, 0, 0, TW, TW); return cx.getImageData(0, 0, TW, TW) }

// ---- 2b. Head x body --------------------------------------------------------------------------------------------
function neckCut (ch) {
  const nk = new THREE.Vector3().setFromMatrixPosition(ch.bindWorld.neck), hd = new THREE.Vector3().setFromMatrixPosition(ch.bindWorld.Head)
  const y = nk.y + 0.55 * (hd.y - nk.y); let sx = 0, sz = 0, n = 0; const pts = []
  for (let i = 0; i < ch.P.length / 3; i++) if (ch.grp[i] === 'head' && Math.abs(ch.P[i * 3 + 1] - y) < 0.012 * ch.height / 1.7) { sx += ch.P[i * 3]; sz += ch.P[i * 3 + 2]; n++; pts.push(i) }
  const cx = n ? sx / n : nk.x, cz = n ? sz / n : nk.z; let r = 0; for (const i of pts) r += Math.hypot(ch.P[i * 3] - cx, ch.P[i * 3 + 2] - cz)
  ch.cut = { y, cx, cz, r: n ? r / n : 0.04 }; return ch.cut
}
const isHeadBone = (n) => /^(Head|head_end|headfront)$/.test(n)
// Remove the head triangles of `ch` (keeps the neck stub).
export function removeHead (ch) {
  const c = ch.cut || neckCut(ch); const geo = ch.mesh.geometry = ch.mesh.geometry.clone(); const idx = geo.index.array; const keep = []
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t], idx[t + 1], idx[t + 2]]
    const allHead = v.every((i) => isHeadBone(ch.dom[i])), above = v.every((i) => ch.grp[i] === 'head' && ch.P[i * 3 + 1] > c.y)
    if (!(allHead || above)) keep.push(...v)
  }
  geo.setIndex(keep); return idx.length / 3 - keep.length / 3
}
// The head of `ch` (face + hair + a bit of neck) as a rigid mesh authored in its bind-pose world space.
export function headPiece (ch) {
  const c = ch.cut || neckCut(ch); const idx = ch.mesh.geometry.index.array; const uv = ch.mesh.geometry.attributes.uv; const pos = [], uvs = []
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t], idx[t + 1], idx[t + 2]]
    const allHead = v.every((i) => isHeadBone(ch.dom[i])), above = v.every((i) => ch.grp[i] === 'head' && ch.P[i * 3 + 1] > c.y - 0.015)
    if (allHead || above) for (const i of v) { pos.push(ch.P[i * 3], ch.P[i * 3 + 1], ch.P[i * 3 + 2]); uvs.push(uv.getX(i), uv.getY(i)) }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); { const acc = new Map(), nn = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3(), nor = new Float32Array(pos.length)
    const key = (i) => pos[i * 3].toFixed(5) + ',' + pos[i * 3 + 1].toFixed(5) + ',' + pos[i * 3 + 2].toFixed(5)
    for (let t = 0; t < pos.length / 9; t++) { A.fromArray(pos, t * 9); B.fromArray(pos, t * 9 + 3); Cc.fromArray(pos, t * 9 + 6); nn.crossVectors(B.sub(A), Cc.sub(A)); for (let k = 0; k < 3; k++) { const kk = key(t * 3 + k); if (!acc.has(kk)) acc.set(kk, new THREE.Vector3()); acc.get(kk).add(nn) } }
    for (let i = 0; i < pos.length / 3; i++) { const v = acc.get(key(i)).clone().normalize(); v.toArray(nor, i * 3) }
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)) }
  const m = new THREE.Mesh(geo, ch.mesh.material); m.castShadow = m.receiveShadow = true; m.frustumCulled = false
  m.userData.tris = pos.length / 9; return m
}
// Put donor's head (its headGroup: head piece, face overlay, accessories) on body's Head bone.
export function mountHead (donor, body, opts = {}) {
  const a = donor.cut || neckCut(donor), b = body.cut || neckCut(body)
  const s = opts.scale || Math.min(1.06, Math.max(0.95, b.r / a.r))
  const M = new THREE.Matrix4().makeTranslation(b.cx, b.y, b.cz).multiply(new THREE.Matrix4().makeScale(s, s, s)).multiply(new THREE.Matrix4().makeTranslation(-a.cx, -a.y, -a.cz))
  donor.headGroup.removeFromParent(); attachBind(donor.headGroup, body, 'Head', M)
  // collar: a necklace ring on the neck bone hides the seam
  const ring = new THREE.Mesh(new THREE.TorusGeometry(b.r * 1.12, b.r * 0.2, 8, 20), new THREE.MeshStandardMaterial({ color: opts.collar || '#e2b23c', roughness: 0.3 }))
  ring.rotation.x = Math.PI / 2 + 0.18; ring.position.set(b.cx, b.y - 0.004, b.cz); ring.castShadow = true
  const grp = new THREE.Group(); grp.add(ring); attachBind(grp, body, 'neck'); return { scale: s, ring }
}

// ---- 2c. Accessories on bones (authored in bind-pose world space, fitted from the detected face) -----------------
export function addGlasses (ch, color = '#ff3b2f') {
  const f = ch.face, g = new THREE.Group(); const r = 0.36 * f.iod
  const frame = new THREE.MeshStandardMaterial({ color: '#1b1b1f', roughness: 0.3 }), lens = new THREE.MeshStandardMaterial({ color, roughness: 0.1, transparent: true, opacity: 0.72 })
  const z = Math.max(f.zAt(f.lx, f.ey), f.zAt(f.rx, f.ey), f.zAt(f.cx, f.ey)) + 0.012
  for (const x of [f.lx - 0.05 * f.iod, f.rx + 0.05 * f.iod]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.11, 6, 24), frame); t.position.set(x, f.ey, z); g.add(t)
    const l = new THREE.Mesh(new THREE.CircleGeometry(r, 24), lens); l.position.set(x, f.ey, z); g.add(l)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, f.iod * 1.3), frame); arm.position.set(x + Math.sign(x - f.cx) * r, f.ey, z - f.iod * 0.65); g.add(arm)
  }
  const br = new THREE.Mesh(new THREE.BoxGeometry(f.iod * 0.4, 0.006, 0.006), frame); br.position.set(f.cx, f.ey + r * 0.2, z); g.add(br)
  g.traverse((c) => { c.castShadow = true }); ch.headGroup.add(g); return g
}
export function addHeadphones (ch, color = '#19b5a5') {
  const f = ch.face, g = new THREE.Group(); const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3 }), dark = new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.5 })
  const R = f.hw * 1.12, earY = f.ey - 0.25 * f.iod, zc = f.ez - 1.25 * f.iod
  const band = new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.09, 8, 28, Math.PI), mat); band.position.set(f.cx, earY, zc); g.add(band)
  for (const s of [-1, 1]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.36, R * 0.36, R * 0.24, 20), mat); cup.rotation.z = Math.PI / 2; cup.position.set(f.cx + s * R, earY, zc); g.add(cup); const pad = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.3, R * 0.3, R * 0.12, 20), dark); pad.rotation.z = Math.PI / 2; pad.position.set(f.cx + s * (R - R * 0.12), earY, zc); g.add(pad) }
  g.traverse((c) => { c.castShadow = true }); ch.headGroup.add(g); return g
}
export function addCap (ch, color = '#2f6fdd') {
  const f = ch.face, g = new THREE.Group(); const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
  const R = f.hw * 1.1, y = f.ey + 0.55 * f.iod, zc = f.ez - 1.2 * f.iod
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat); dome.position.set(f.cx, y, zc); dome.scale.y = 0.85; g.add(dome)
  const visor = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.9, R * 0.9, 0.008, 20, 1, false, -Math.PI / 2, Math.PI), mat); visor.rotation.y = Math.PI / 2; visor.position.set(f.cx, y + 0.004, zc + R * 0.65); visor.scale.x = 1; g.add(visor)
  g.traverse((c) => { c.castShadow = true }); ch.headGroup.add(g); return g
}
export function addBag (ch, color = '#d4226b') {
  const g = new THREE.Group(); const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 }); const k = ch.height / 1.7
  const sp = new THREE.Vector3().setFromMatrixPosition(ch.bindWorld.Spine01 || ch.bindWorld.Spine), hp = new THREE.Vector3().setFromMatrixPosition(ch.bindWorld.Hips)
  let hwid = 0; for (let i = 0; i < ch.P.length / 3; i++) if (ch.grp[i] === 'lower' && Math.abs(ch.P[i * 3 + 1] - hp.y) < 0.03) hwid = Math.max(hwid, Math.abs(ch.P[i * 3] - hp.x))
  const cy = (sp.y + hp.y) / 2 + 0.1 * k, R = Math.max(0.19 * k, hwid * 1.5), tilt = 0.95
  const loop = new THREE.Group(); loop.position.set(hp.x, cy, hp.z); loop.rotation.z = tilt
  const strap = new THREE.Mesh(new THREE.TorusGeometry(R, 0.011 * k, 6, 32), mat); strap.rotation.x = Math.PI / 2; strap.scale.set(1, 0.5, 1); loop.add(strap); g.add(loop)
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.07 * k, 0.15 * k, 0.2 * k), mat); box.position.set(hp.x - Math.cos(tilt) * R - 0.03 * k, cy - Math.sin(tilt) * R - 0.03 * k, hp.z); g.add(box)
  g.traverse((c) => { c.castShadow = true }); attachBind(g, ch, 'Spine'); return g
}

// ---- 3d. Two-bone CCD IK: put a hand on a world-space target ----------------------------------------------------
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _bq = new THREE.Quaternion()
export function reach (ch, side, target, iters = 14) {
  const arm = ch.bones[side + 'Arm'], fore = ch.bones[side + 'ForeArm'], hand = ch.bones[side + 'Hand']
  for (let it = 0; it < iters; it++) for (const b of [fore, arm]) {
    b.parent.updateWorldMatrix(true, false); b.updateWorldMatrix(false, true)
    hand.getWorldPosition(_a); b.getWorldPosition(_b); _c.copy(target).sub(_b).normalize(); _a.sub(_b).normalize()
    _q.setFromUnitVectors(_a, _c); b.parent.getWorldQuaternion(_pq); b.getWorldQuaternion(_bq)
    b.quaternion.copy(_pq.invert().multiply(_q).multiply(_bq))
  }
  ch.o.updateMatrixWorld(true)
}
