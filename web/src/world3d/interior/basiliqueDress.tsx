import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { RealMesh, propMats, useRealBuilt, useRealTier } from '../../components/defi/jeux/props/real'
import type { Builder, Q, V } from '../../components/defi/jeux/props/real/kit'
import { Shaft } from '../batimentsRig'
import { BOX } from '../open/ruePrincesse'
import type { MiniTier } from '../minijeux'

// « Mini-jeux réalistes », phase 2: the Basilique's nave dressed for the guide's game (components/defi/
// Basilique.tsx: NaveBasilique with `dress`), only while the update is open. The place itself
// (BasiliqueInside, with « bâtiments réalistes »' patina) is left as it is: nothing here runs there.
// - the pews: seat, reclined back with its top rail, the carved ends, the hymnal shelf, the red
//   kneeler of the row behind; one merged pew instanced round the rings (one draw call). On the small
//   phones the old benches stay, with their ends added (one instanced block);
// - the dome's coffers: rows of recessed square panels round the dome's inside, shrinking as they
//   climb (one instanced coffer), gilt rosettes in them on « haute »; the cornice ring at the dome's
//   foot, the stone surrounds of the windows;
// - from « normal », the light through the stained glass: a shaft from each window on the sun's side,
//   coloured by its glass, down to the floor (batimentsRig's Shaft: additive, no light).

/** The nave's measures (BasiliqueInside's). */
const NAVE_R = 44
const WIN_Y = 6
const WIN_H = 13
const WIN_W = 6.4
const DOME_Y = 24
const DOME_R = NAVE_R + 2
const DOME_K = 1.4

/** Whether the nave is dressed: asked for (the guide's game) and the update open. */
export function useNaveDress(want: boolean): MiniTier {
  const tier = useRealTier()
  return want ? tier : 'off'
}

/** One pew in a bench's frame (its seat on the ring, the back outward along +z, its people facing -z). */
function pew(b: Builder, q: Q) {
  const wood = '#8a5a34'
  const dark = '#6e4426'
  const o = { tile: 'wood', sharp: true }
  b.box([0, 0.44, 0], [2.7, 0.06, 0.46], wood, o)
  b.box([0, 0.36, -0.215], [2.7, 0.1, 0.03], dark, o)
  b.box([0, 0.76, 0.29], [2.7, 0.56, 0.05], wood, { ...o, r: [0.08, 0, 0] })
  b.box([0, 1.06, 0.33], [2.76, 0.06, 0.1], dark, o)
  for (const sx of [-1, 1]) {
    b.box([sx * 1.38, 0.55, 0.05], [0.07, 1.1, 0.66], dark, o)
    // The carved end's top, rounded over.
    if (!q.lo) b.box([sx * 1.38, 1.12, 0.12], [0.09, 0.08, 0.36], wood, o)
  }
  if (q.lo) return
  // The hymnal shelf on its back, for the row behind; their kneeler, padded red, on two bars.
  b.box([0, 0.82, 0.38], [2.5, 0.04, 0.12], dark, o)
  b.box([0, 0.86, 0.44], [2.5, 0.08, 0.015], wood, o)
  b.box([0, 0.1, 0.95], [2.5, 0.07, 0.16], '#8a2b2b', { tile: 'fabric', sharp: true })
  for (const sx of [-1, 1]) b.box([sx * 1.28, 0.07, 0.68], [0.04, 0.04, 0.6], dark, o)
}

/** One coffer of the dome, 1 × 1 across, facing +z: the frame's ribs, the stepped recess, its rosette on « haute ». */
function coffer(b: Builder, q: Q) {
  const rib = '#f1f4f7'
  // Plain: a coffer is stretched over metres, a detail tile would show its texels big.
  const o = { tile: 'plain', sharp: true }
  // Two ribs a coffer (its neighbours give the other two): the dome's grid.
  b.box([0, 0.47, 0.1], [1, 0.08, 0.2], rib, o)
  b.box([0.47, 0, 0.1], [0.08, 1, 0.2], rib, o)
  b.box([0, 0, 0.005], [1, 1, 0.01], '#c3d0dc', o)
  if (!q.lo) {
    // The step inside the frame, the recess deeper and darker.
    for (const [x, y, w, h] of [[0, 0.38, 0.84, 0.05], [0, -0.38, 0.84, 0.05], [0.38, 0, 0.05, 0.84], [-0.38, 0, 0.05, 0.84]] as const) b.box([x, y, 0.06], [w, h, 0.1], '#d2dce6', o)
  }
  if (q.hi) b.box([0, 0, 0.04], [0.22, 0.22, 0.06], '#d9b34a', { tile: 'metal', sharp: true, r: [0, 0, Math.PI / 4] })
}

/** The dome's cornice, the windows' stone surrounds (one merged mesh). */
function frames(b: Builder, q: Q) {
  const stone = '#e8e1d2'
  b.ring([0, DOME_Y - 0.2, 0], NAVE_R + 0.6, 0.45, stone, { tile: 'cement', seg: q.lo ? 48 : 72 })
  if (!q.lo) b.ring([0, DOME_Y + 0.4, 0], NAVE_R + 0.75, 0.25, '#d9cfbd', { tile: 'cement', seg: 72 })
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const at = (u: number, y: number, d = 0): V => [Math.sin(a) * (NAVE_R + 0.2 - d) + Math.cos(a) * u, y, Math.cos(a) * (NAVE_R + 0.2 - d) - Math.sin(a) * u]
    const r: V = [0, a, 0]
    for (const u of [-WIN_W / 2 - 0.2, WIN_W / 2 + 0.2]) b.box(at(u, WIN_Y + WIN_H / 2), [0.4, WIN_H + 0.8, 0.5], stone, { tile: 'cement', r })
    b.box(at(0, WIN_Y - 0.2), [WIN_W + 0.8, 0.4, 0.7], stone, { tile: 'cement', r })
    // The pointed arch over the window: two blocks leaning in.
    for (const sd of [-1, 1]) b.box(at(sd * (WIN_W / 4), WIN_Y + WIN_H + 0.9), [WIN_W / 2 + 0.6, 0.4, 0.5], stone, { tile: 'cement', r: [0, a, sd * -0.28] })
  }
}

const tmpO = new THREE.Object3D()
const tmpM = new THREE.Matrix4()
const vx = new THREE.Vector3()
const vy = new THREE.Vector3()
const vz = new THREE.Vector3()

/** An instanced mesh of a merged geometry at these matrices (made once, freed on unmount). */
function useInstances(geo: THREE.BufferGeometry | null, mat: THREE.Material, mats: THREE.Matrix4[]) {
  const mesh = useMemo(() => {
    if (!geo) return null
    const m = new THREE.InstancedMesh(geo, mat, mats.length)
    mats.forEach((x, i) => m.setMatrixAt(i, x))
    m.computeBoundingSphere()
    return m
  }, [geo, mat, mats])
  useEffect(() => () => mesh?.dispose(), [mesh])
  return mesh
}

/** The coffers' places: rows round the dome's inside, each turned to face in, as wide and tall as its share of the dome. */
function cofferMatrices() {
  const out: THREE.Matrix4[] = []
  const rows = 9
  const e0 = 0.05
  const de = 0.13
  for (let row = 0; row < rows; row++) {
    const e = e0 + (row + 0.5) * de
    // Fewer coffers up high, where the dome narrows.
    const cols = [56, 56, 52, 48, 44, 40, 34, 28, 22][row]
    const R = DOME_R - 0.25
    const w = (Math.PI * 2 * R * Math.cos(e)) / cols
    const h = Math.hypot(R * Math.sin(e), DOME_K * R * Math.cos(e)) * de
    for (let c = 0; c < cols; c++) {
      const az = (c / cols) * Math.PI * 2
      const p = new THREE.Vector3(R * Math.cos(e) * Math.sin(az), DOME_Y + DOME_K * R * Math.sin(e), R * Math.cos(e) * Math.cos(az))
      // Facing in: against the ellipsoid's normal; up: along the meridian.
      vz.set(-p.x / (DOME_R * DOME_R), -(p.y - DOME_Y) / (DOME_K * DOME_K * DOME_R * DOME_R), -p.z / (DOME_R * DOME_R)).normalize()
      vy.set(-Math.sin(e) * Math.sin(az), DOME_K * Math.cos(e), -Math.sin(e) * Math.cos(az)).normalize()
      vx.crossVectors(vy, vz).normalize()
      vy.crossVectors(vz, vx)
      tmpM.makeBasis(vx.multiplyScalar(w), vy.multiplyScalar(h), vz)
      tmpM.setPosition(p)
      out.push(tmpM.clone())
    }
  }
  return out
}

/** A window's shaft: its glass' colour, its four corners, the light going in and down. */
const FIELD = (k: number) => (k === 3 || k === 9 || k === 10 ? '#ff5a46' : k === 6 ? '#4fd88a' : '#4f86ff')

/** The nave's dress (see the top of this file). `seats`: the benches' places, [x, z, angle]. */
export function NaveDress({ tier, seats }: { tier: MiniTier; seats: [number, number, number][] }) {
  const lo = tier === 'simple'
  const m = propMats(tier)
  const pews = useRealBuilt('basilique-pew', pew, tier)
  const coffers = useRealBuilt('basilique-coffer', coffer, tier)
  const pewMats = useMemo(
    () =>
      seats.map(([x, z, a]) => {
        tmpO.position.set(x, 0, z)
        tmpO.rotation.set(0, a, 0)
        tmpO.scale.set(1, 1, 1)
        tmpO.updateMatrix()
        return tmpO.matrix.clone()
      }),
    [seats],
  )
  // The small phones: the old benches stay (NaveBasilique), only their carved ends added, as plain blocks.
  const endMats = useMemo(
    () =>
      !lo
        ? []
        : seats.flatMap(([x, z, a]) =>
            [-1, 1].map((sx) => {
              tmpO.position.set(x + Math.cos(a) * sx * 1.42, 0.55, z - Math.sin(a) * sx * 1.42)
              tmpO.position.add(vx.set(Math.sin(a) * 0.05, 0, Math.cos(a) * 0.05))
              tmpO.rotation.set(0, a, 0)
              tmpO.scale.set(0.08, 1.1, 0.66)
              tmpO.updateMatrix()
              return tmpO.matrix.clone()
            }),
          ),
    [seats, lo],
  )
  const endMat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#6e4426' }), [])
  useEffect(() => () => endMat.dispose(), [endMat])
  const cofferM = useMemo(cofferMatrices, [])
  const pewMesh = useInstances(lo ? null : pews.solid, m.solid, pewMats)
  const endMesh = useInstances(lo ? BOX : null, endMat, endMats)
  const cofferMesh = useInstances(coffers.solid, m.solid, cofferM)
  const shafts = useMemo(
    () =>
      [0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 12) * Math.PI * 2
        const c = new THREE.Vector3(Math.sin(a) * (NAVE_R + 0.3), WIN_Y + WIN_H / 2, Math.cos(a) * (NAVE_R + 0.3))
        const t = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)).multiplyScalar(WIN_W / 2 - 0.2)
        const up = new THREE.Vector3(0, WIN_H / 2 - 0.3, 0)
        const quad = [c.clone().sub(t).sub(up), c.clone().add(t).sub(up), c.clone().add(t).add(up), c.clone().sub(t).add(up)].map((v) => [v.x, v.y, v.z] as [number, number, number])
        return { quad, dir: new THREE.Vector3(-Math.sin(a) * 0.6, -1, -Math.cos(a) * 0.6).normalize(), color: FIELD(i) }
      }),
    [],
  )
  return (
    <>
      {pewMesh && <primitive object={pewMesh} />}
      {endMesh && <primitive object={endMesh} />}
      {cofferMesh && <primitive object={cofferMesh} />}
      <RealMesh id="basilique-frames" recipe={frames} tier={tier} />
      {!lo && shafts.map((s, i) => <Shaft key={i} quad={s.quad} dir={s.dir} color={s.color} strength={tier === 'haute' ? 0.14 : 0.1} />)}
    </>
  )
}
