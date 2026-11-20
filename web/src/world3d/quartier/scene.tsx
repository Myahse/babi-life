import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { XZ } from '../open/geo'
import type { Nav } from '../open/nav'
import { whereabouts } from '../whereabouts'
import { useQuartierWorld } from './store'
import { universEdge, type UniversInfo } from './univers/gen'
import { Backdrop } from './univers/backdrop'
import { xrayMaterial } from '../seeThrough'
import { QuartierElders } from './elders'

// « Mon quartier » in the 3D street (update « mon-quartier »): its own world's surroundings past its edges (the
// far ground, the hills, the city, the skyline: univers/backdrop.tsx), the arrow on the ground to « À faire
// maintenant », and whether the Sim has walked up to the world's edge (« Aller à Babi ? »). Mounted by
// world3d/open/OpenWorld.tsx; nothing here while the world isn't drawn.

const CHEVRONS = 6
const STEP = 3.2
const chevronGeo = (() => {
  const s = new THREE.Shape()
  s.moveTo(0, 0.9)
  s.lineTo(0.9, -0.3)
  s.lineTo(0.5, -0.6)
  s.lineTo(0, -0.05)
  s.lineTo(-0.5, -0.6)
  s.lineTo(-0.9, -0.3)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false })
  g.rotateX(-Math.PI / 2)
  return g
})()

/** The arrow on the ground: chevrons from the Sim along the streets towards « À faire maintenant », and a light where it is. */
function Arrow({ target, nav }: { target: XZ; nav: Nav | null }) {
  const group = useRef<THREE.Group>(null)
  const beacon = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff8a1f', transparent: true, opacity: 0.9, depthWrite: false }), [])
  // (Where a tree or a roof hides the light, it shows through them, fainter: seeThrough.tsx.)
  const xray = useMemo(() => xrayMaterial('#ff8a1f', 0.38), [])
  const way = useRef<{ from: XZ; pts: XZ[] } | null>(null)
  const at = useRef(0)
  useEffect(() => () => (mat.dispose(), xray.dispose()), [mat, xray])
  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const [sx, sz] = whereabouts.sim
    const left = Math.hypot(target[0] - sx, target[1] - sz)
    g.visible = left > 6
    if (beacon.current) beacon.current.visible = true
    if (!g.visible) return
    // The way along the streets, asked again once the Sim has gone a little off it.
    const w = way.current
    if (!w || Math.hypot(w.from[0] - sx, w.from[1] - sz) > 8) {
      const pts = nav?.nodes.length ? nav.path([sx, sz], target) : null
      way.current = { from: [sx, sz], pts: pts && pts.length > 1 ? pts : [[sx, sz], target] }
    }
    const pts = way.current!.pts
    at.current = (at.current + dt * 4) % STEP
    // Each chevron at its distance along the way from the Sim (sliding forward, as if leading).
    let seg = 0
    let done = 0
    let px = sx
    let pz = sz
    for (let i = 0; i < CHEVRONS; i++) {
      const c = g.children[i]
      const want = 2.5 + i * STEP + at.current
      let x = px
      let z = pz
      let dx = 0
      let dz = 1
      while (seg < pts.length - 1) {
        const [ax, az] = seg === 0 ? [sx, sz] : pts[seg]
        const [bx, bz] = pts[seg + 1]
        const len = Math.hypot(bx - ax, bz - az)
        if (len > 0.01) [dx, dz] = [(bx - ax) / len, (bz - az) / len]
        if (done + len >= want) {
          const k = want - done
          x = ax + dx * k
          z = az + dz * k
          break
        }
        done += len
        seg++
        x = bx
        z = bz
      }
      ;[px, pz] = [x, z]
      c.visible = want < left - 2
      c.position.set(x, 0.12, z)
      c.rotation.y = Math.atan2(dx, dz)
      ;(c as THREE.Mesh).scale.setScalar(i === 0 ? 0.7 + at.current / STEP / 3 : 1)
    }
  })
  return (
    <>
      <group ref={group}>
        {Array.from({ length: CHEVRONS }, (_, i) => (
          <mesh key={i} geometry={chevronGeo} material={mat} renderOrder={6} />
        ))}
      </group>
      <mesh ref={beacon} position={[target[0], 18, target[1]]} material={mat} renderOrder={6}>
        <cylinderGeometry args={[0.8, 0.8, 36, 8, 1, true]} />
        <mesh material={xray} renderOrder={7}>
          <cylinderGeometry args={[0.8, 0.8, 36, 8, 1, true]} />
        </mesh>
      </mesh>
    </>
  )
}

/** Whether the Sim is at the world's edge, looked at now and then (not every frame: a store write re-renders the HUD). */
function EdgeWatch({ u }: { u: UniversInfo }) {
  const last = useRef(0)
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 0.5) return
    last.current = clock.elapsedTime
    // (Right at it: on foot it stops there, a car a half-length short of it; not all along the boulevard or the edge street.)
    const out = universEdge(u, whereabouts.sim[0], whereabouts.sim[1]) < 5
    if (out !== useQuartierWorld.getState().outside) useQuartierWorld.setState({ outside: out })
  })
  useEffect(() => () => useQuartierWorld.setState({ outside: false }), [])
  return null
}

export function QuartierScene({ nav, water }: { nav: Nav | null; water: THREE.Material }) {
  const u = useQuartierWorld((q) => (q.active && q.scene === 'lot' ? q.univ : null))
  const target = useQuartierWorld((q) => q.target)
  if (!u) return null
  return (
    <>
      <Backdrop u={u} water={water} />
      <EdgeWatch u={u} />
      <QuartierElders u={u} nav={nav} />
      {target && <Arrow target={target} nav={nav} />}
    </>
  )
}
