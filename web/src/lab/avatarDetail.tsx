import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Look } from '../lib/types'
import { BlockHuman } from '../avatar/BlockHuman'
import type { Pose } from '../avatar/Human'
import { DEFAULT_LOOK } from '../avatar/options'
import { DetailHuman, detailCost } from './detail/DetailHuman'

// Dev-only lab (/avatar.html): today's blocky Sim (left of each pair) next to
// the « détaillé » prototype (right, on the golden tile), in the street's
// daylight. ?pose=idle|walk|wave|mix (mix: a pose each), ?view=front|three|face|game (&zoom=),
// ?only=0,2,3 picks looks, ?spin turns them slowly, ?set=2 other looks.

const q = new URLSearchParams(location.search)
const view = q.get('view') ?? 'front'
const poseQ = q.get('pose') ?? 'mix'
const spin = q.has('spin')

type Sample = { name: string; look: Partial<Look>; gender: 'femme' | 'homme'; child?: boolean; pose: Pose }
const S = (name: string, look: Partial<Look>, gender: 'femme' | 'homme', pose: Pose, child = false): Sample => ({ name, look, gender, pose, child })

const SETS: Sample[][] = [
  [
    S('Awa — pagne wax, foulard', { outfit: 'pagne', hair: 'headwrap', accessory: 'earrings', pattern: 'cercles', outfitColor: '#ff7a00', skin: '#6e4024' }, 'femme', 'wave'),
    S('Koffi — costume', { outfit: 'suit', hair: 'degrade', accessory: 'none', beard: 'bouc', outfitColor: '#1f2a44', skin: '#583119', body: 'fort' }, 'homme', 'idle'),
    S('Yao — chemise pagne, dreads', { outfit: 'chemise-pagne', hair: 'locks', accessory: 'none', beard: 'moustache', pattern: 'losanges', outfitColor: '#00a862', skin: '#8a5532' }, 'homme', 'walk'),
    S('Aya — jean, afro', { outfit: 'casual', hair: 'afro', accessory: 'glasses,chain', outfitColor: '#d6336c', skin: '#a46c42', hairColor: '#2e1b12' }, 'femme', 'idle'),
    S('Fatou (enfant) — robe, nattes perlées', { outfit: 'robe-volants', hair: 'nattes-perles', accessory: 'none', outfitColor: '#f783ac', skin: '#4a2814' }, 'femme', 'wave', true),
    S('Vieux Bamba — grand boubou', { outfit: 'boubou', hair: 'short', accessory: 'none', beard: 'full', outfitColor: '#2a6cf0', skin: '#3f2210', hairColor: '#d8d2c8' }, 'homme', 'idle'),
  ],
  [
    S('Mariam — tresses, jean', { outfit: 'casual', hair: 'braids', accessory: 'earrings', outfitColor: '#00a862', skin: '#583119' }, 'femme', 'walk'),
    S('Adjoua — bantu knots, pagne', { outfit: 'pagne', hair: 'bantu', accessory: 'none', pattern: 'feuilles', outfitColor: '#7b5cff', skin: '#8a5532' }, 'femme', 'idle'),
    S('Ibrahim — boubou, barbe longue', { outfit: 'boubou', hair: 'bald', beard: 'longue', accessory: 'none', outfitColor: '#f4efe6', skin: '#4a2814' }, 'homme', 'idle'),
    S('Kader — macarons, tee', { outfit: 'casual', hair: 'puffs', accessory: 'watch', outfitColor: '#f2b705', skin: '#c28a5c' }, 'femme', 'wave'),
  ],
]
const set = SETS[Number(q.get('set') ?? 1) - 1] ?? SETS[0]
const only = q.get('only')?.split(',').map(Number)
const samples = only ? only.map((i) => set[i]).filter(Boolean) : set

const PAIR = 1.3 // metres between pairs
const IN = 0.62 // metres between today's and the detailed one

/** Slowly turns what's inside (?spin). */
function Turn({ children, k }: { children: React.ReactNode; k: number }) {
  const g = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (g.current && spin) g.current.rotation.y = s.clock.elapsedTime * 0.5 + k
  })
  return (
    <group ref={g} rotation={[0, k, 0]}>
      {children}
    </group>
  )
}

/** Counts what the GPU draws per Sim (meshes visible, triangles), once all is built. */
function Counter({ onCount }: { onCount: (s: string) => void }) {
  const { scene } = useThree()
  useEffect(() => {
    const id = setTimeout(() => {
      const rows: string[] = []
      for (const side of ['today', 'detail']) {
        let meshes = 0
        let tris = 0
        let n = 0
        scene.traverse((o) => {
          if (o.userData.side !== side) return
          n++
          o.traverse((c) => {
            const m = c as THREE.Mesh
            if (!m.isMesh) return
            let vis = true
            for (let p: THREE.Object3D | null = m; p; p = p.parent) if (!p.visible) vis = false
            if (!vis) return
            meshes++
            const g = m.geometry
            tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3
          })
        })
        rows.push(`${side === 'today' ? "aujourd'hui" : 'détaillé'} : ${(meshes / n).toFixed(1)} draw calls, ${Math.round(tris / n)} triangles par Sim`)
      }
      const c = samples.map((s) => detailCost(s.look as Look, s.gender, !!s.child))
      rows.push(`détaillé : ${Math.round(c.reduce((a, b) => a + b.boxes, 0) / c.length)} blocs fusionnés en ${Math.round(c.reduce((a, b) => a + b.meshes, 0) / c.length)} meshes, 1 matériau, atlas 256²`)
      console.log('[lab] ' + rows.join(' | '))
      onCount(rows.join('\n'))
    }, 1500)
    return () => clearTimeout(id)
  }, [scene, onCount])
  return null
}

function Lab() {
  const [count, setCount] = useState('')
  const n = samples.length
  const x0 = (-(n - 1) * PAIR) / 2
  const span = n * PAIR
  const cam: Record<string, { p: [number, number, number]; at: [number, number, number]; fov: number }> = {
    front: { p: [0, 1.0, span * 0.95 + 0.8], at: [0, 0.85, 0], fov: 30 },
    three: { p: [0, 2.2, span * 0.95 + 0.8], at: [0, 0.8, 0], fov: 30 },
    face: { p: [0, 1.52, (span + 0.2) * 1.42], at: [0, 1.4, 0], fov: 20 },
    // The street's camera: orthographic from the same corner, ?zoom= pixels a metre (17 by default on a computer, pinch for more).
    game: { p: [30, 32, 30], at: [0, 0.7, 0], fov: 30 },
  }
  const c = cam[view] ?? cam.front
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', fontFamily: 'system-ui, sans-serif' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        orthographic={view === 'game'}
        camera={view === 'game' ? { position: [30, 32, 30], zoom: Number(q.get('zoom') ?? 17), near: -300, far: 600 } : { position: c.p, fov: c.fov }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#9fd8f5']} />
        {/* The street's daylight (Neighbourhood.tsx). */}
        <hemisphereLight args={['#ffffff', '#c9a46b', 1.15]} />
        <directionalLight position={[25, 40, 15]} intensity={1.6} color="#fff4e0" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <meshLambertMaterial color="#d8c8ad" />
        </mesh>
        {/* Seen from the street's corner, the row turns to face it. */}
        <group rotation={[0, view === 'game' ? Math.PI / 4 : 0, 0]}>
        {samples.map((s, i) => {
          const x = x0 + i * PAIR
          const pose = (poseQ === 'mix' ? s.pose : poseQ) as Pose
          const look = { ...DEFAULT_LOOK, ...s.look }
          const scale = s.child ? 0.62 : 1
          const hs = s.child ? 1.2 : 1
          // The 3/4 view turns everyone, so the sides show too.
          const turn = view === 'three' ? 0.65 : view === 'face' ? 0.35 : 0
          return (
            <group key={i}>
              {/* The detailed one stands on a golden tile. */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x + IN / 2, 0.003, 0]} receiveShadow>
                <planeGeometry args={[0.56, 0.56]} />
                <meshLambertMaterial color="#e9c46a" />
              </mesh>
              {view !== 'face' && view !== 'game' && (
                <Html position={[x, 0, 0.45]} center style={{ whiteSpace: 'nowrap', fontSize: 12, color: '#14213d', background: '#ffffffb0', padding: '1px 6px', borderRadius: 4, fontFamily: 'system-ui, sans-serif' }}>
                  {s.name}
                </Html>
              )}
              <group position={[x - IN / 2, 0, 0]} scale={scale} userData={{ side: 'today' }}>
                <Turn k={turn}>
                  <BlockHuman look={look} gender={s.gender} pose={pose} seed={i} headScale={hs} fitted speed={1.4} />
                </Turn>
              </group>
              <group position={[x + IN / 2, 0, 0]} scale={scale} userData={{ side: 'detail' }}>
                <Turn k={turn}>
                  <DetailHuman look={look} gender={s.gender} pose={pose} seed={i} headScale={hs} speed={1.4} />
                </Turn>
              </group>
            </group>
          )
        })}
        </group>
        <Counter onCount={setCount} />
        <OrbitControls target={c.at} />
      </Canvas>
      <div style={{ position: 'absolute', top: 10, left: 12, right: 12, color: '#14213d', fontSize: 14, lineHeight: 1.4, pointerEvents: 'none' }}>
        <b>Sim détaillé — prototype.</b> Dans chaque paire : à gauche le Sim d'aujourd'hui, à droite le détaillé (sur la dalle dorée).
        <div style={{ whiteSpace: 'pre', fontSize: 12, opacity: 0.8 }}>{count}</div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Lab />)
