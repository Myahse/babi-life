import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Sim } from '../../lib/types'
import { Character } from '../Character'
import { Suited } from '../../components/espace/jeux/common'
import { buildCalao, buildPirogue, calaoMaterial, litMaterial, mergeBoxes, metalMaterial, CALAO_COLORS, type BoxTag } from './calao'
import { setSky, useSkyDome } from './flightBits'

// Le Centre d'entraînement Astrélia (Sassandra; backend game/espaceCarriere.go, kind « astrelia-entrainement »):
// its great hall cut away in blocks, under its roof trusses and their light panels: the centrifuge's long arm
// turning on its ringed platform, beside its glass control booth; the deep pool with a station module's mock-up
// down in it, its gantry crane and a diver; the Pirogue simulator (the kit's own capsule) on its six jacks and
// its console; the classroom of the concours with its screens and its board; the canteen's counter and its menu.
// Through the bay window, the beach, its palms, the sea, and the Calao on its pad at the end of the beach. The
// agency's banner and the missions' patches on the walls (no national flag). Trainees in the Astrélia suit go
// about; the Sim stands where what it does is done. The still blocks are merged by material (a few draws).

/** Where each part of the hall is (x, z), and what's done there. */
const SPOTS: Record<string, { p: [number, number, number]; r: number }> = {
  centri: { p: [-2.4, 0, 2.8], r: -0.9 },
  piscine: { p: [3.6, 0, 4.2], r: -0.4 },
  simu: { p: [0.2, 0, -1.2], r: 0 },
  classe: { p: [-3.6, 0, -2.6], r: 0.3 },
  cantine: { p: [4.6, 0, -2.4], r: -0.6 },
  entree: { p: [0, 0, 4.2], r: Math.PI },
}
const spotOf = (id?: string) =>
  !id ? 'entree' : /centrifugeuse/.test(id) ? 'centri' : /piscine|survie/.test(id) ? 'piscine' : /parabolique|physique|work/.test(id) ? 'simu' : /concours|systemes|medicale/.test(id) ? 'classe' : /cantine|douche|chambre/.test(id) ? 'cantine' : 'entree'

type B = [number, number, number, number, number, number, string, BoxTag?]
const { orange, navy } = CALAO_COLORS
const HORNBILL = ['..oo...', '.oooo..', 'kkkwkk.', '.kkkkkk', '..kk.kk', '..k...k']

/** The agency's hornbill in blocks on a wall facing +x (at x), its cells `cell` big. */
function hornbillX(b: B[], x: number, cy: number, cz: number, cell: number) {
  HORNBILL.forEach((row, r) => [...row].forEach((ch, k) => ch !== '.' && b.push([x, cy - r * cell, cz + (k - 3) * cell, 0.03, cell, cell, ch === 'o' ? orange : ch === 'w' ? navy : '#ffffff'])))
}

/** The hall: floor, walls, the bay window's frame, the trusses, the banner, the furniture that never moves. */
function hallBoxes(): B[] {
  const b: B[] = []
  // The floor: lino tiles in two light greys; the orange walkway to the doors, its white edges.
  for (let i = 0; i < 8; i++)
    for (let k = 0; k < 6; k++) {
      const x = -7 + i * 2
      const z = -5 + k * 2
      // (Not over the pool: x 2..6, z 0..4.)
      if ((x === 3 || x === 5) && (z === 1 || z === 3)) continue
      b.push([x, -0.1, z, 2, 0.2, 2, (i + k) % 2 ? '#e3e6ea' : '#d7dbe0'])
    }
  b.push([0, 0.006, 3.6, 1.3, 0.012, 4.8, '#ff922b'])
  for (const x of [-0.7, 0.7]) b.push([x, 0.008, 3.6, 0.08, 0.012, 4.8, '#ffffff'])
  // The back wall round the bay window, the window's navy frame and mullions.
  b.push([-5.6, 2.6, -6, 4.8, 5.2, 0.3, '#f1f3f5'])
  b.push([5.6, 2.6, -6, 4.8, 5.2, 0.3, '#f1f3f5'])
  b.push([0, 4.85, -6, 6.4, 0.7, 0.3, '#f1f3f5'])
  b.push([0, 0.3, -6, 6.4, 0.6, 0.3, '#f1f3f5'])
  for (const x of [-3.15, -1.05, 1.05, 3.15]) b.push([x, 2.55, -5.95, 0.12, 3.9, 0.2, navy])
  for (const y of [0.62, 2.4, 4.48]) b.push([0, y, -5.95, 6.4, 0.12, 0.2, navy])
  // The orange stripe round the walls at hand height.
  b.push([-5.6, 1.1, -5.84, 4.8, 0.18, 0.02, orange])
  b.push([5.6, 1.1, -5.84, 4.8, 0.18, 0.02, orange])
  // The left wall: the agency's banner (navy, its orange stripes, the hornbill), the missions' patches.
  b.push([-8, 2.6, 0, 0.3, 5.2, 12, '#e9ecef'])
  b.push([-7.83, 1.1, 0, 0.02, 0.18, 12, orange])
  b.push([-7.83, 3.3, -1.2, 0.03, 2.6, 3, navy])
  b.push([-7.81, 2.15, -1.2, 0.03, 0.14, 3, orange])
  b.push([-7.81, 1.98, -1.2, 0.03, 0.08, 3, '#ffa94d'])
  hornbillX(b, -7.79, 4.1, -1.2, 0.22)
  const patches = ['#ff7a00', '#1c3d6e', '#74c0fc', '#c92a2a', '#f2b632', '#2b8a3e']
  patches.forEach((c, i) => {
    b.push([-7.83, 3.2, 1.4 + i * 0.7, 0.03, 0.5, 0.5, '#ffffff'])
    b.push([-7.81, 3.2, 1.4 + i * 0.7, 0.03, 0.36, 0.36, c])
  })
  // The roof's truss along the back (the rest cut away, the camera above), its light panels.
  for (const z of [-5.2]) {
    b.push([0, 5.3, z, 16, 0.22, 0.22, '#adb5bd', 'm'])
    b.push([0, 5.75, z, 16, 0.12, 0.12, '#adb5bd', 'm'])
    for (let i = 0; i < 9; i++) b.push([-7.5 + i * 1.875, 5.52, z, 0.08, 0.46, 0.08, '#ced4da', 'm'])
    for (const x of [-5, 0, 5]) b.push([x, 5.15, z, 1.6, 0.08, 0.5, '#fff8e1', 'g'])
  }
  // The centrifuge's ringed platform (yellow and black dashes round the arm's sweep), its control booth.
  b.push([-5.6, 0.04, 0.6, 5.8, 0.08, 5.8, '#b5bcc4'])
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    b.push([-5.6 + Math.cos(a) * 2.75, 0.09, 0.6 + Math.sin(a) * 2.75, 0.55, 0.02, 0.55, i % 2 ? '#ffd43b' : '#343a40'])
  }
  b.push([-5.6, 0.25, 0.6, 1.2, 0.4, 1.2, '#495057', 'm'])
  b.push([-5.6, 0.6, 0.6, 0.9, 0.3, 0.9, '#5c636e', 'm'])
  b.push([-5.6, 0.62, 0.6, 0.95, 0.07, 0.95, orange])
  b.push([-7.1, 1, 4.6, 1.6, 2, 1.4, '#dee2e6'])
  b.push([-7.1, 1.4, 5.31, 1.3, 0.8, 0.03, '#8fc7ef', 'g'])
  b.push([-7.1, 2.05, 4.6, 1.7, 0.1, 1.5, navy])
  // The pool (x 2..6, z 0..4): its tiled rim (white, a blue edge), its ladder, the gantry crane over it.
  for (const z of [0, 4]) {
    b.push([4, 0.12, z, 4.3, 0.24, 0.3, '#f8f9fa'])
    b.push([4, 0.25, z, 4.3, 0.02, 0.32, '#4dabf7'])
  }
  for (const x of [2, 6]) b.push([x, 0.12, 2, 0.3, 0.24, 4.3, '#f8f9fa'])
  for (const y of [0.15, -0.1, -0.35]) b.push([5.8, y, 3, 0.06, 0.04, 0.5, '#ced4da', 'm'])
  for (const z of [0.1, 3.9]) {
    b.push([2.1, 2, z, 0.2, 4, 0.2, '#ffd43b'])
    b.push([5.9, 2, z, 0.2, 4, 0.2, '#ffd43b'])
    b.push([4, 4, z, 4, 0.25, 0.25, '#ffd43b'])
  }
  b.push([4, 4.1, 2, 0.4, 0.25, 4, '#fab005'])
  b.push([4, 3.6, 2, 0.06, 0.8, 0.06, '#495057', 'm'])
  // The simulator's six jacks, its base, its stairs, its console and screens.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    b.push([0.2 + Math.cos(a) * 0.7, 0.45, -3.2 + Math.sin(a) * 0.7, 0.14, 0.9, 0.14, '#868e96', 'm'])
  }
  b.push([0.2, 0.06, -3.2, 2.2, 0.12, 2.2, '#495057'])
  for (let i = 0; i < 4; i++) b.push([1.5 + i * 0.3, 0.1 + i * 0.22, -2.4, 0.3, 0.2 + i * 0.44, 0.7, '#adb5bd'])
  b.push([2.4, 0.55, -4.4, 1.2, 1.1, 0.7, '#343a40'])
  b.push([2.4, 1.25, -4.3, 1.1, 0.5, 0.05, '#69db7c', 'g'])
  b.push([2.4, 1.12, -4.02, 1.1, 0.06, 0.3, '#212529'])
  for (let i = 0; i < 5; i++) b.push([2.0 + i * 0.2, 1.17, -3.95, 0.08, 0.04, 0.08, i % 2 ? '#ff922b' : '#4dabf7', 'g'])
  // The classroom: the board (a blocky orbit drawn on it), the desks with their screens, the instructor's desk.
  b.push([-4.4, 2, -5.8, 3.4, 1.6, 0.08, '#2b3a2e'])
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    b.push([-4.4 + Math.cos(a) * 0.9, 2 + Math.sin(a) * 0.5, -5.75, 0.12, 0.12, 0.02, '#f8f9fa'])
  }
  b.push([-4.4, 2, -5.75, 0.3, 0.3, 0.02, '#4dabf7'])
  b.push([-3.5, 2.5, -5.75, 0.14, 0.14, 0.02, '#ffd43b'])
  for (const x of [-1, 0, 1])
    for (const z of [0, 1]) {
      const cx = -4.4 + x * 1.1
      const cz = -3.8 + z * 1.1
      b.push([cx, 0.7, cz, 0.85, 0.06, 0.5, '#c08a52'])
      b.push([cx, 0.35, cz, 0.08, 0.7, 0.08, '#868e96', 'm'])
      b.push([cx, 0.94, cz - 0.16, 0.42, 0.28, 0.03, '#212529'])
      b.push([cx, 0.94, cz - 0.14, 0.36, 0.22, 0.01, '#74c0fc', 'g'])
      b.push([cx, 0.42, cz + 0.42, 0.4, 0.06, 0.36, navy])
      b.push([cx, 0.62, cz + 0.6, 0.4, 0.36, 0.06, navy])
    }
  b.push([-2.6, 0.5, -5.2, 1.1, 1, 0.5, '#e9ecef'])
  b.push([-2.6, 1.02, -5.2, 1.15, 0.06, 0.55, orange])
  // The canteen: the counter and its trays, the menu board lit, the stools; the plants.
  b.push([5.6, 0.5, -3.8, 3.2, 1, 0.8, '#ced4da'])
  b.push([5.6, 1.03, -3.8, 3.3, 0.06, 0.9, orange])
  for (const x of [-1, 0, 1]) {
    b.push([5.6 + x, 1.12, -3.8, 0.5, 0.1, 0.38, '#f8f9fa'])
    b.push([5.6 + x, 1.19, -3.8, 0.3, 0.05, 0.22, ['#e8590c', '#82c91e', '#fab005'][x + 1]])
    b.push([5.6 + x, 0.3, -2.9, 0.06, 0.6, 0.06, '#868e96', 'm'])
    b.push([5.6 + x, 0.62, -2.9, 0.4, 0.06, 0.4, navy])
  }
  b.push([5.6, 2.6, -5.82, 2.4, 1.1, 0.04, '#212529'])
  for (let i = 0; i < 4; i++) b.push([5.6, 2.95 - i * 0.22, -5.79, 1.8 - (i % 2) * 0.5, 0.08, 0.01, '#fff3bf', 'g'])
  for (const [x, z] of [[-7.4, -5.4], [7.4, 5.4], [7.4, -1.2], [-1.4, -5.4]]) {
    b.push([x, 0.25, z, 0.5, 0.5, 0.5, '#8a5a32'])
    b.push([x, 0.75, z, 0.7, 0.5, 0.7, '#2f9e44'])
    b.push([x, 1.15, z, 0.45, 0.4, 0.45, '#40c057'])
  }
  return b
}

/** Outside the bay window: the beach and its palms, the sea, the pad's tower and its masts. */
function outsideBoxes(): B[] {
  const b: B[] = [
    [0, -0.3, -24, 120, 0.2, 36, '#e6cf9c'],
    [0, -0.35, -80, 400, 0.1, 80, '#1c7ed6'],
    [0, -0.32, -42.5, 120, 0.1, 3, '#f8f9fa'],
    [0, -0.3, 24, 120, 0.2, 60, '#7a9a52'],
  ]
  for (const [x, z, h] of [[-12, -14, 6], [-7, -20, 7], [10, -16, 6.5], [16, -22, 5.5], [-18, -26, 6]]) {
    for (let k = 0; k < 5; k++) b.push([x + k * 0.12, (k + 0.5) * (h / 5), z, 0.4, h / 5, 0.4, k % 2 ? '#8a6a46' : '#7a5c3c'])
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.push([x + 0.6 + dx * 1.2, h, z + dz * 1.2, dx ? 2.2 : 0.7, 0.25, dz ? 2.2 : 0.7, '#3f8f3a'])
  }
  // The pad far off (at the beach's end): its red-and-white tower, two masts.
  for (let i = 0; i < 8; i++) b.push([10, 1.5 + i * 3, -36, 3, 3, 3, i % 2 ? '#f1f3f5' : '#c92a2a'])
  for (const x of [-2, 22]) b.push([x, 15, -36, 0.4, 30, 0.4, '#a5a9ad'])
  return b
}

const geos = new Map<string, THREE.BufferGeometry>()
const geoOf = (key: string, f: () => B[]) => {
  let g = geos.get(key)
  if (!g) {
    const l = f()
    g = l.length ? mergeBoxes(l) : new THREE.BufferGeometry()
    geos.set(key, g)
  }
  return g
}
/** Blocks merged by how they're drawn: painted, metal, lit (three draws). */
function Merged({ k, f }: { k: string; f: () => B[] }) {
  return (
    <>
      <mesh geometry={geoOf(`${k}:`, () => f().filter((x) => !x[7]))} material={calaoMaterial()} castShadow receiveShadow />
      <mesh geometry={geoOf(`${k}:m`, () => f().filter((x) => x[7] === 'm'))} material={metalMaterial()} castShadow />
      <mesh geometry={geoOf(`${k}:g`, () => f().filter((x) => x[7] === 'g'))} material={litMaterial()} />
    </>
  )
}

/** The centrifuge's arm: a truss, the counterweight, the gondola (its window, its stripe, its beacon), turning. */
function armBoxes(): B[] {
  const b: B[] = [
    [1.2, 0.08, 0.1, 2.4, 0.08, 0.08, '#868e96', 'm'],
    [1.2, -0.08, -0.1, 2.4, 0.08, 0.08, '#868e96', 'm'],
    [-0.6, 0, 0, 1.2, 0.2, 0.26, '#868e96', 'm'],
    [-1.2, 0, 0, 0.5, 0.5, 0.5, '#343a40'],
    [-1.2, 0.26, 0, 0.52, 0.04, 0.52, orange],
    [2.5, 0, 0, 0.8, 0.8, 0.7, '#ffffff'],
    [2.5, 0, 0, 0.86, 0.62, 0.56, '#f1f3f5'],
    [2.5, 0, 0.36, 0.4, 0.34, 0.02, '#74c0fc', 'g'],
    [2.5, -0.2, 0.37, 0.5, 0.05, 0.02, navy],
    [2.5, -0.42, 0, 0.86, 0.08, 0.76, orange],
    [2.5, 0.45, 0, 0.12, 0.1, 0.12, '#ff4d4d', 'g'],
  ]
  for (const x of [0.3, 0.8, 1.3, 1.8]) b.push([x, 0, 0, 0.06, 0.2, 0.24, '#adb5bd', 'm'])
  return b
}

function Centrifuge({ fast }: { fast: boolean }) {
  const arm = useRef<THREE.Group>(null)
  useFrame((_, dt) => void (arm.current && (arm.current.rotation.y += dt * (fast ? 3.2 : 0.5))))
  return (
    <group ref={arm} position={[-5.6, 1.05, 0.6]}>
      <Merged k="centre-arm" f={armBoxes} />
    </group>
  )
}

/** The pool's tiled basin, the station module's mock-up down in it, the water over them, a diver floating by. */
function poolBoxes(): B[] {
  return [
    [0, -1.25, 0, 3.8, 0.1, 3.8, '#1971c2'],
    [0, -1.19, 0.8, 3.4, 0.02, 0.2, '#0b4f8a'],
    [0, -0.6, -1.9, 3.8, 1.3, 0.05, '#4dabf7'],
    [0, -0.6, 1.9, 3.8, 1.3, 0.05, '#4dabf7'],
    [-1.9, -0.6, 0, 0.05, 1.3, 3.8, '#339af0'],
    [1.9, -0.6, 0, 0.05, 1.3, 3.8, '#339af0'],
    [0, -0.75, -0.6, 3, 0.8, 1, '#f1f3f5'],
    [0, -0.75, -0.6, 3, 0.6, 1.2, '#e9ecef'],
    [0, -0.75, -0.6, 0.2, 0.86, 1.22, orange],
    [-1.6, -0.75, -0.6, 0.2, 0.5, 0.5, '#adb5bd', 'm'],
    [0.8, -0.3, -0.6, 1.2, 0.04, 0.06, '#ffd43b'],
  ]
}
function Pool() {
  const diver = useRef<THREE.Group>(null)
  const water = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3fa2f0', transparent: true, opacity: 0.55, roughness: 0.15, metalness: 0.1, depthWrite: false }), [])
  useEffect(() => () => water.dispose(), [water])
  useFrame(({ clock }) => {
    if (diver.current) diver.current.position.y = -0.6 + Math.sin(clock.elapsedTime * 0.7) * 0.1
  })
  return (
    <group position={[4, 0, 2]}>
      <Merged k="centre-pool" f={poolBoxes} />
      <mesh position={[0, -0.1, 0]} material={water}>
        <boxGeometry args={[3.8, 0.04, 3.8]} />
      </mesh>
      <group ref={diver} position={[0.6, -0.6, 0.6]} rotation={[0, 0, Math.PI / 2]} scale={0.5}>
        <Suited pose="float" />
      </group>
    </group>
  )
}

/** The Pirogue simulator: the kit's own capsule (calao.ts), under half-size, tilting on its jacks. */
function Simulator({ busy }: { busy: boolean }) {
  const cap = useRef<THREE.Group>(null)
  const p = useMemo(() => buildPirogue(), [])
  useFrame(({ clock }) => {
    if (!cap.current) return
    const t = clock.elapsedTime
    const k = busy ? 1 : 0.3
    cap.current.rotation.set(Math.sin(t * 0.9) * 0.06 * k, 0, Math.sin(t * 0.7 + 1) * 0.05 * k)
  })
  return (
    <group ref={cap} position={[0.2, 1.05, -3.2]}>
      <group scale={0.46} rotation={[0, -Math.PI / 2, 0]}>
        <primitive object={p.root} />
      </group>
    </group>
  )
}

/** The Calao far off on its pad: the agency's kit (calao.ts), at a third of its size. */
function FarCalao() {
  const calao = useMemo(() => buildCalao('calao-1'), [])
  return <primitive object={calao.root} position={[14, 0, -36]} scale={0.36} />
}

function Trainees() {
  const a = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (a.current) {
      a.current.position.x = -1.5 + Math.sin(t * 0.25) * 2.2
      a.current.rotation.y = Math.cos(t * 0.25) > 0 ? Math.PI / 2 : -Math.PI / 2
    }
  })
  return (
    <>
      <group ref={a} position={[-1.5, 0, 1.6]}>
        <Suited />
      </group>
      <group position={[-7.1, 0, 3.5]} rotation={[0, 0.4, 0]}>
        <Suited />
      </group>
      <group position={[1.6, 0, -1.4]} rotation={[0, -0.6, 0]}>
        <Suited />
      </group>
    </>
  )
}

/** The sky outside the window: the day's gradient, or the night's. */
function Sky({ night }: { night: boolean }) {
  const dome = useSkyDome()
  useEffect(() => {
    const u = (dome.material as THREE.ShaderMaterial).uniforms
    if (night) (u.top.value.set('#03081a'), u.mid.value.set('#0e1d40'), u.glow.value.set('#24375e'))
    else setSky(dome, 0)
  }, [dome, night])
  return <primitive object={dome} scale={0.05} />
}

export function CentreEntrainement({ sim, interactionId, night = false }: { sim: Sim; interactionId?: string; night?: boolean }) {
  const s = SPOTS[spotOf(interactionId)]
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false }), [])
  useEffect(() => () => glass.dispose(), [glass])
  return (
    <div className="absolute inset-0" data-centre-entrainement>
      <Canvas dpr={[1, 1.75]} shadows camera={{ fov: 50, near: 0.1, far: 600, position: [s.p[0] + 4, 7.5, s.p[2] + 11] }}>
        <color attach="background" args={[night ? '#0d1b2a' : '#cfe8ff']} />
        <Sky night={night} />
        <hemisphereLight args={['#ffffff', '#8c9aa8', night ? 0.7 : 1.1]} />
        <directionalLight position={[6, 12, 8]} intensity={night ? 0.5 : 1.4} castShadow shadow-mapSize={[1024, 1024]} />
        {night && <pointLight position={[0, 4.8, 0]} intensity={40} distance={18} color="#fff4d6" />}
        <Merged k="centre-hall" f={hallBoxes} />
        <Merged k="centre-outside" f={outsideBoxes} />
        <mesh position={[0, 2.55, -6]} material={glass}>
          <boxGeometry args={[6.4, 3.9, 0.04]} />
        </mesh>
        <FarCalao />
        <Centrifuge fast={/centrifugeuse/.test(interactionId ?? '')} />
        <Pool />
        <Simulator busy={/parabolique|physique|work/.test(interactionId ?? '')} />
        <Trainees />
        <group position={s.p} rotation={[0, s.r, 0]}>
          <Character look={sim.look} gender={sim.gender} marker={false} pose={interactionId ? 'busy' : 'idle'} />
        </group>
        <OrbitControls makeDefault target={[s.p[0] * 0.5, 1, s.p[2] * 0.5]} enablePan={false} minDistance={5} maxDistance={22} minPolarAngle={0.35} maxPolarAngle={1.3} enableDamping />
      </Canvas>
    </div>
  )
}
