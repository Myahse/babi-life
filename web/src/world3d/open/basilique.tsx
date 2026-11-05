import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BOX, Blocks } from './ruePrincesse'
import { LowHuman } from '../../avatar/LowHuman'
import { NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'

/**
 * Basilique Notre-Dame de la Paix (Yamoussoukro, Pierre Fakhoury, 1989): a dome about 158 m high with
 * its lantern and its cross, on a drum of stained glass ringed by columns, raised on its podium; two
 * curved colonnades of double columns embracing the esplanade, after St Peter's in Rome. Seen from the
 * whole town (landmarks.tsx SKYLINE). Its 7 400 m² of stained glass glow at night, the dome lit from
 * below. Pilgrims and visitors cross the esplanade in the day. The proportions are estimates.
 * Frame: +z the esplanade, toward the avenue; the rotunda at z −50.
 */

/** The rotunda's middle (its frame), its drum's radius, the ring of columns. */
export const ROTUNDA = { z: -50, drum: 46, ring: 54, podium: 63 }

/** A panel of stained glass in pixels: bands of blue, a figure in warm colours, gold above. */
function glassPanel(seed: number, w = 64, h = 32) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  let s = seed
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const blues = ['#1f4fa8', '#2a6fd6', '#16357a', '#3b82d8', '#1aa3b8']
  for (let y = 0; y < h; y += 2)
    for (let x = 0; x < w; x += 2) {
      g.fillStyle = r() < 0.8 ? blues[Math.floor(r() * blues.length)] : ['#f2b51d', '#d62f2f', '#f4e2a0', '#7a3fb0'][Math.floor(r() * 4)]
      g.fillRect(x, y, 2, 2)
    }
  // Lead between the panels, and a figure in each.
  g.fillStyle = '#121218'
  for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 1, h)
  for (let x = 4; x < w; x += 8) {
    g.fillStyle = ['#f4e2a0', '#d62f2f', '#f07a1a', '#ffffff'][Math.floor(r() * 4)]
    g.fillRect(x - 1, h * 0.35, 3, h * 0.5)
    g.fillStyle = '#f4e2a0'
    g.fillRect(x - 1, h * 0.25, 3, 2)
  }
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.wrapS = THREE.RepeatWrapping
  t.repeat.set(12, 1)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** The esplanade's paving: pale marble, darker bands radiating from the rotunda. */
function paving() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#e4ddcd'
  g.fillRect(0, 0, 256, 256)
  g.strokeStyle = '#c9bfa9'
  g.lineWidth = 2
  // The rotunda at the top middle: lines fanning out from it, rings round it.
  for (let i = -8; i <= 8; i++) {
    g.beginPath()
    g.moveTo(128, -40)
    g.lineTo(128 + i * 40, 256)
    g.stroke()
  }
  for (let rr = 60; rr < 330; rr += 34) {
    g.beginPath()
    g.arc(128, -40, rr, 0, Math.PI)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

export function Basilica({ night }: { night: boolean }) {
  const mats = useMemo(
    () => ({
      stone: new THREE.MeshLambertMaterial({ color: '#efe9dc' }),
      shade: new THREE.MeshLambertMaterial({ color: '#dcd4c3' }),
      dome: new THREE.MeshLambertMaterial({ color: '#c9d4dc', emissive: '#ffe2a8', emissiveIntensity: 0 }),
      rib: new THREE.MeshLambertMaterial({ color: '#f4f1ea' }),
      glass: (() => {
        const t = glassPanel(17)
        return new THREE.MeshLambertMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.12 })
      })(),
      oculus: new THREE.MeshLambertMaterial({ color: '#3a5f86', emissive: '#ffd27a', emissiveIntensity: 0 }),
      gold: new THREE.MeshLambertMaterial({ color: '#d9b34a', emissive: '#5a4300', emissiveIntensity: 0.3 }),
      paving: new THREE.MeshLambertMaterial({ map: paving() }),
      lawn: new THREE.MeshLambertMaterial({ color: '#5f9e48', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      water: new THREE.MeshLambertMaterial({ color: '#4aa3c8' }),
      lamp: new THREE.MeshLambertMaterial({ color: '#fff4d0', emissive: '#ffd27a', emissiveIntensity: 0 }),
    }),
    [],
  )
  // At night: the glass lit from inside, the dome washed in warm light, the lamps of the esplanade.
  mats.glass.emissiveIntensity = night ? 1.1 : 0.12
  mats.dome.emissiveIntensity = night ? 0.22 : 0
  mats.oculus.emissiveIntensity = night ? 0.9 : 0
  mats.lamp.emissiveIntensity = night ? 1.4 : 0

  const cupola = useMemo(() => {
    const g = new THREE.SphereGeometry(ROTUNDA.drum, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2)
    g.scale(1, 1.55, 1)
    return g
  }, [])
  const columns = useRef<THREE.InstancedMesh>(null)
  const beams = useRef<THREE.InstancedMesh>(null)
  // The columns: a ring round the drum, and the two arms of the colonnade, in double rows.
  const { posts, spans } = useMemo(() => {
    const posts: [number, number, number, number][] = [] // x, z, base, height
    const spans: [number, number, number, number, number][] = [] // x, z, y, angle, length
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * Math.PI * 2
      posts.push([Math.cos(a) * ROTUNDA.ring, ROTUNDA.z + Math.sin(a) * ROTUNDA.ring, 6, 24])
    }
    const cz = 62
    for (const side of [-1, 1])
      for (const R of [76, 84]) {
        const n = 26
        let prev: [number, number] | null = null
        for (let k = 0; k <= n; k++) {
          const t = Math.PI - 0.72 + (1.44 * k) / n
          const p: [number, number] = [side * Math.cos(t) * R, cz + Math.sin(t) * R]
          posts.push([p[0], p[1], 0, 16])
          if (prev) spans.push([(p[0] + prev[0]) / 2, (p[1] + prev[1]) / 2, 17, -Math.atan2(p[1] - prev[1], p[0] - prev[0]), Math.hypot(p[0] - prev[0], p[1] - prev[1]) + 0.4])
          prev = p
        }
      }
    return { posts, spans }
  }, [])
  useEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    posts.forEach(([x, z, y, h], i) => columns.current?.setMatrixAt(i, m.compose(new THREE.Vector3(x, y + h / 2, z), q, new THREE.Vector3(1, h, 1))))
    spans.forEach(([x, z, y, a, l], i) => beams.current?.setMatrixAt(i, m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(l, 2, 9.5))))
    for (const im of [columns.current, beams.current]) {
      if (!im) continue
      im.instanceMatrix.needsUpdate = true
      // Its bounds from where its copies stand (not from before they were placed): else it's culled when zoomed in.
      im.computeBoundingSphere()
    }
  }, [posts, spans])

  // The round windows at the dome's foot, the lamps of the esplanade, the gardens either side.
  const oculi = useMemo(() => [...Array(24)].map((_, i) => (i / 24) * Math.PI * 2), [])
  const lamps = useMemo(() => {
    const out: { p: [number, number, number]; s: [number, number, number] }[] = []
    for (const x of [-30, 30]) for (let z = 20; z <= 120; z += 20) out.push({ p: [x, 2.5, z], s: [0.25, 5, 0.25] })
    return out
  }, [])
  const lampHeads = useMemo(() => lamps.map((l) => ({ p: [l.p[0], 5.2, l.p[2]] as [number, number, number], s: [0.8, 0.5, 0.8] as [number, number, number] })), [lamps])
  // The people on the esplanade: pilgrims in white, families, a guide and his group.
  const people = useMemo(() => {
    const r = rng('basilique-esplanade')
    return [...Array(26)].map((_, i) => {
      const gender: 'femme' | 'homme' = r() < 0.55 ? 'femme' : 'homme'
      const look = randomLook(gender, r)
      const group = i < 8
      const x = group ? -8 + (i % 4) * 1.4 : (r() - 0.5) * 90
      const z = group ? 30 + Math.floor(i / 4) * 1.5 : 15 + r() * 110
      return { p: [x, 0.1, z] as [number, number, number], ry: group ? Math.PI : r() * 6, look: i % 5 === 0 ? { ...look, outfit: 'boubou', outfitColor: '#f8f9fa' } : look, gender, pose: (group ? (i === 0 ? 'talk' : 'film') : (['walk', 'idle', 'phone', 'film', 'pray'] as Pose[])[i % 5]) as Pose, seed: r() * 100 }
    })
  }, [])

  return (
    <group>
      {/* The esplanade, embraced by the colonnades, and the lawns either side */}
      <mesh position={[0, 0.07, 40]} rotation={[-Math.PI / 2, 0, 0]} material={mats.paving} receiveShadow>
        <planeGeometry args={[200, 180]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 115, 0.06, -10]} rotation={[-Math.PI / 2, 0, 0]} material={mats.lawn} receiveShadow>
          <planeGeometry args={[30, 140]} />
        </mesh>
      ))}
      {/* The fountains in the middle of the esplanade */}
      {[-24, 24].map((x) => (
        <group key={x} position={[x, 0, 70]}>
          <mesh position={[0, 0.4, 0]} material={mats.shade}>
            <cylinderGeometry args={[6, 6.4, 0.8, 24]} />
          </mesh>
          <mesh position={[0, 0.82, 0]} material={mats.water}>
            <cylinderGeometry args={[5.4, 5.4, 0.05, 24]} />
          </mesh>
          <mesh position={[0, 2, 0]} material={mats.stone}>
            <cylinderGeometry args={[0.6, 0.9, 2.6, 10]} />
          </mesh>
        </group>
      ))}
      <instancedMesh ref={columns} args={[undefined, undefined, posts.length]} material={mats.stone} castShadow>
        <cylinderGeometry args={[1.1, 1.3, 1, 10]} />
      </instancedMesh>
      <instancedMesh ref={beams} args={[undefined, undefined, spans.length]} material={mats.stone} castShadow>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <group position={[0, 0, ROTUNDA.z]}>
        {/* The podium and its steps, all round */}
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 1 + i * 2, 0]} material={i % 2 ? mats.stone : mats.shade} castShadow receiveShadow>
            <cylinderGeometry args={[ROTUNDA.podium + 4 - i * 2, ROTUNDA.podium + 5 - i * 2, 2, 48]} />
          </mesh>
        ))}
        {/* The drum behind the columns, its stained glass all round */}
        <mesh position={[0, 20, 0]} material={mats.stone} castShadow>
          <cylinderGeometry args={[ROTUNDA.drum, ROTUNDA.drum, 28, 48]} />
        </mesh>
        <mesh position={[0, 19, 0]} material={mats.glass}>
          <cylinderGeometry args={[ROTUNDA.drum + 0.3, ROTUNDA.drum + 0.3, 18, 48, 1, true]} />
        </mesh>
        {/* The entablature on the ring of columns, the attic over it */}
        <mesh position={[0, 31.5, 0]} material={mats.stone} castShadow>
          <cylinderGeometry args={[ROTUNDA.ring + 3, ROTUNDA.ring + 3, 3, 48]} />
        </mesh>
        <mesh position={[0, 37, 0]} material={mats.shade} castShadow>
          <cylinderGeometry args={[47, 49, 8, 48]} />
        </mesh>
        {/* The round windows at the dome's foot (one instanced mesh) */}
        <Ring count={oculi.length} material={mats.oculus} at={(i, o) => (o.position.set(Math.sin(oculi[i]) * 49.1, 37, Math.cos(oculi[i]) * 49.1), o.rotation.set(0, oculi[i], 0))}>
          <circleGeometry args={[1.6, 10]} />
        </Ring>
        {/* The dome and its ribs, the lantern, the small dome and the cross */}
        <mesh geometry={cupola} position={[0, 41, 0]} material={mats.dome} castShadow />
        <Ring count={16} material={mats.rib} at={(i, o) => (o.position.set(0, 41, 0), o.rotation.set(0, (i / 16) * Math.PI * 2, 0), o.scale.set(1, 1.55, 1))}>
          <torusGeometry args={[ROTUNDA.drum + 0.2, 0.55, 4, 24, Math.PI / 2]} />
        </Ring>
        <mesh position={[0, 41 + 71 + 9, 0]} material={mats.stone} castShadow>
          <cylinderGeometry args={[7, 8, 18, 16]} />
        </mesh>
        <Blocks at={LANTERN} material={mats.oculus} />
        <mesh position={[0, 41 + 71 + 18, 0]} material={mats.dome}>
          <sphereGeometry args={[7.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <group position={[0, 41 + 71 + 26, 0]}>
          <mesh material={mats.gold}>
            <sphereGeometry args={[1.6, 10, 8]} />
          </mesh>
          <mesh geometry={BOX} position={[0, 9, 0]} scale={[1.2, 17, 1.2]} material={mats.gold} />
          <mesh geometry={BOX} position={[0, 13, 0]} scale={[8, 1.2, 1.2]} material={mats.gold} />
        </group>
        {/* The portico toward the esplanade: columns under a pediment, the great doors */}
        <mesh position={[0, 7, 66]} material={mats.stone} receiveShadow>
          <boxGeometry args={[44, 2, 16]} />
        </mesh>
        {[-18, -10.8, -3.6, 3.6, 10.8, 18].map((x) => (
          <mesh key={x} position={[x, 18, 72]} material={mats.stone} castShadow>
            <cylinderGeometry args={[1.3, 1.5, 20, 10]} />
          </mesh>
        ))}
        <mesh position={[0, 18, 63]} material={mats.stone} castShadow>
          <boxGeometry args={[40, 20, 4]} />
        </mesh>
        <mesh geometry={BOX} position={[0, 13, 65.1]} scale={[8, 12, 0.2]} material={mats.oculus} />
        <mesh position={[0, 29.5, 67]} material={mats.stone} castShadow>
          <boxGeometry args={[44, 3, 14]} />
        </mesh>
        <Pediment material={mats.stone} />
        {/* The steps down from the portico to the esplanade */}
        <Blocks at={STEPS} material={mats.stone} />
      </group>
      <Blocks at={lamps} material={mats.shade} />
      <Blocks at={lampHeads} material={mats.lamp} />
      <NoShadows>
        <Near within={260}>
        {people.map((p, i) => (
          <group key={i} position={p.p} rotation={[0, p.ry, 0]}>
            <LowHuman look={p.look} gender={p.gender} pose={p.pose} seed={p.seed} />
          </group>
        ))}
        </Near>
      </NoShadows>
    </group>
  )
}

/** The lantern's windows, the steps down from the portico. */
const LANTERN = [...Array(8)].map((_, i) => ({ p: [Math.sin((i / 8) * Math.PI * 2) * 7.6, 41 + 71 + 9, Math.cos((i / 8) * Math.PI * 2) * 7.6] as [number, number, number], s: [1.6, 10, 0.3] as [number, number, number], ry: (i / 8) * Math.PI * 2 }))
const STEPS = [0, 1, 2, 3, 4, 5].map((i) => ({ p: [0, 5.5 - i, 75 + i * 1.6] as [number, number, number], s: [40 + i * 2, 1, 1.6] as [number, number, number] }))

/** Copies of one shape, each placed by `at` (one draw call). */
function Ring({ count, material, at, children }: { count: number; material: THREE.Material; at: (i: number, o: THREE.Object3D) => void; children: React.ReactNode }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const o = new THREE.Object3D()
    for (let i = 0; i < count; i++) {
      o.position.set(0, 0, 0)
      o.rotation.set(0, 0, 0)
      o.scale.set(1, 1, 1)
      at(i, o)
      o.updateMatrix()
      ref.current?.setMatrixAt(i, o.matrix)
    }
    if (ref.current) (ref.current.instanceMatrix.needsUpdate = true), ref.current.computeBoundingSphere()
  }, [count, at])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} material={material}>
      {children}
    </instancedMesh>
  )
}

/** Shown only with the camera within this many metres (the people: from across the town, nobody sees them). */
function Near({ within, children }: { within: number; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null)
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    if (!g.current) return
    g.current.getWorldPosition(v)
    g.current.visible = camera.position.distanceTo(v) < within
  })
  return <group ref={g}>{children}</group>
}

function Pediment({ material }: { material: THREE.Material }) {
  const g = useMemo(() => {
    const t = new THREE.Shape()
    t.moveTo(-22, 0)
    t.lineTo(22, 0)
    t.lineTo(0, 9)
    t.closePath()
    return new THREE.ExtrudeGeometry(t, { depth: 14, bevelEnabled: false })
  }, [])
  return <mesh geometry={g} position={[0, 31, 60]} material={material} castShadow />
}
