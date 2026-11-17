import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { toLatLng, toLocal, type Origin, type XZ } from '../open/geo'
import type { Nav } from '../open/nav'
import { whereabouts } from '../whereabouts'
import { useQuartierWorld } from './store'

// « Mon quartier » in the 3D street (update « mon-quartier »): the lot played, the haze wall round its street
// front, the arrow on the ground to « À faire maintenant » when it's on this lot, and whether the Sim has walked
// off it. Mounted by world3d/open/OpenWorld.tsx; nothing here while no lot is played.

/** Where the lot played is in this street's metres (one's home: the home the Sim walks out of), and the home's place for the quartier's view. */
export function useQuartierCentre(origin: Origin, homeAt: XZ | undefined) {
  const active = useQuartierWorld((q) => q.active && q.scene === 'lot')
  const visiting = useQuartierWorld((q) => q.visiting)
  const lot = useQuartierWorld((q) => q.lot)
  const hx = homeAt?.[0]
  const hz = homeAt?.[1]
  // (One's own home, as the street drew it: the quartier's view and its lots are set round it.)
  useEffect(() => {
    if (hx == null || hz == null || visiting) return
    const ll = toLatLng(origin, [hx, hz])
    const was = useQuartierWorld.getState().homeLL
    if (!was || Math.abs(was.lat - ll.lat) > 1e-6 || Math.abs(was.lng - ll.lng) > 1e-6) useQuartierWorld.setState({ homeLL: ll })
  }, [origin.lat, origin.lng, hx, hz, visiting]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!active || !lot) return void useQuartierWorld.setState({ local: null })
    const local: XZ = lot.kind === 'home' && !visiting && hx != null && hz != null ? [hx, hz] : toLocal(origin, lot.lat, lot.lng)
    useQuartierWorld.setState({ local })
  }, [active, visiting, lot?.id, lot?.lat, lot?.lng, origin.lat, origin.lng, hx, hz]) // eslint-disable-line react-hooks/exhaustive-deps
  // « À faire maintenant »'s place, when it's on this lot.
  const goal = useQuartierWorld((q) => (q.visiting ? undefined : q.view?.todo?.target))
  const local = useQuartierWorld((q) => q.local)
  const r = useQuartierWorld((q) => q.lotR)
  useEffect(() => {
    const at = active && goal && local ? toLocal(origin, goal.lat, goal.lng) : null
    useQuartierWorld.setState({ target: at && Math.hypot(at[0] - local![0], at[1] - local![1]) < r ? at : null })
  }, [active, goal?.lat, goal?.lng, local, origin.lat, origin.lng, r]) // eslint-disable-line react-hooks/exhaustive-deps
}

const EDGE_H = 70
const edgeVertex = `
varying float vH;
#include <fog_pars_vertex>
void main() {
  vH = position.y / ${EDGE_H.toFixed(1)} + 0.5;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`
const edgeFragment = `
uniform vec3 tint;
varying float vH;
void main() {
  // Thick at the ground, thinning up into the sky.
  gl_FragColor = vec4(tint, 0.96 * (1.0 - smoothstep(0.35, 1.0, vH)));
}`

/** The haze wall round the lot: the streets beyond aren't loaded, so the eye is kept from them. */
function Edge({ at, r }: { at: XZ; r: number }) {
  const scene = useThree((s) => s.scene)
  const mat = useMemo(() => new THREE.ShaderMaterial({ uniforms: { tint: { value: new THREE.Color('#d9e4ea') } }, vertexShader: edgeVertex, fragmentShader: edgeFragment, transparent: true, depthWrite: false, side: THREE.DoubleSide }), [])
  const geo = useMemo(() => new THREE.CylinderGeometry(r + 25, r + 25, EDGE_H, 64, 1, true), [r])
  useEffect(() => () => (mat.dispose(), geo.dispose()), [mat, geo])
  // Coloured as the haze of the hour (the fog's colour), so it melts into the sky.
  useFrame(() => {
    const f = scene.fog as THREE.Fog | null
    if (f) mat.uniforms.tint.value.copy(f.color)
  })
  return <mesh geometry={geo} material={mat} position={[at[0], EDGE_H / 2 - 2, at[1]]} renderOrder={5} frustumCulled={false} />
}

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
  const way = useRef<{ from: XZ; pts: XZ[] } | null>(null)
  const at = useRef(0)
  useEffect(() => () => mat.dispose(), [mat])
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
      </mesh>
    </>
  )
}

/** Whether the Sim is off the lot, looked at now and then (not every frame: a store write re-renders the HUD). */
function OutsideWatch({ at, r }: { at: XZ; r: number }) {
  const last = useRef(0)
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 0.5) return
    last.current = clock.elapsedTime
    const out = Math.hypot(whereabouts.sim[0] - at[0], whereabouts.sim[1] - at[1]) > r
    if (out !== useQuartierWorld.getState().outside) useQuartierWorld.setState({ outside: out })
  })
  return null
}

export function QuartierScene({ nav }: { nav: Nav | null }) {
  const active = useQuartierWorld((q) => q.active && q.scene === 'lot')
  const local = useQuartierWorld((q) => q.local)
  const r = useQuartierWorld((q) => q.lotR)
  const target = useQuartierWorld((q) => q.target)
  if (!active || !local) return null
  return (
    <>
      <Edge at={local} r={r} />
      <OutsideWatch at={local} r={r} />
      {target && <Arrow target={target} nav={nav} />}
    </>
  )
}
