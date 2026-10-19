import { useEffect, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { freezeWorldTime, worldTime } from '../lib/worldClock'
import { whereabouts } from '../world3d/whereabouts'
import { Landmark } from '../world3d/open/landmarks'
import { PARTIES, Party, partyLevel, usePartySound } from '../world3d/open/party'
import { NightScene, type NightKind } from '../world3d/open/nightStreet'
import { SkyDome } from '../world3d/open/sky'
import { StreetLights } from '../world3d/open/streetlights'
import { Nav } from '../world3d/open/nav'
import { buildChunk } from '../world3d/open/meshes'
import { makeWorldMaterials } from '../world3d/open/OpenWorld'
import { litShare } from '../world3d/open/textures'
import { blockRing } from '../world3d/open/voxel'
import { Vehicle, setVehicleNight } from '../world3d/vehicles'
import { Dressing } from '../world3d/open/dressing'
import type { ChunkData } from '../world3d/open/tiles'
import type { XZ } from '../world3d/open/geo'
import type { Npc } from '../world3d/open/OpenWorld'

// Night labs (city.html):
// ?view=party&id=yop-rue-princesse|cocody-blockhauss-maquis (&t= seconds on the
// shared clock, default a Friday 23 h; &sim=x,z the Sim in the landmark's
// frame, to see the crowd react; &cam=, &look=) the party night at a spot;
// ?view=nightstreet&kind=porch|kiosque|dames|couple|gardien (&cam) one scene of the quarters after dark;
// ?view=nightcity (&hour=23 &cam &look) buildings, street lights, signs, cars and the sky at night.

const q = new URLSearchParams(location.search)
const vec = (k: string, d: string) => (q.get(k) ?? d).split(',').map(Number) as [number, number, number]
/** A Friday, 23 h, on the shared clock (its epoch is a Monday). */
const FRIDAY_23 = 4 * 86400 + 23 * 3600

function Night({ children, cam, look, far = 6000 }: { children: React.ReactNode; cam: [number, number, number]; look: [number, number, number]; far?: number }) {
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: cam, fov: 50, far }} style={{ width: '100vw', height: '100vh', background: '#141a3d' }}>
      <hemisphereLight args={['#7484c4', '#3a3a56', 1.3]} />
      <directionalLight position={[60, 110, 35]} intensity={0.6} color="#8fa8ff" />
      <fog attach="fog" args={['#1d2552', 400, 5200]} />
      <SkyDome night dusk={false} />
      {children}
      <OrbitControls target={look} />
    </Canvas>
  )
}

export function PartyLab() {
  const id = q.get('id') ?? 'yop-rue-princesse'
  const t = Number(q.get('t') ?? FRIDAY_23)
  freezeWorldTime(t)
  // Let the clock run from there (the dancers dance, the beams sweep).
  const [start] = useState(() => performance.now())
  useEffect(() => {
    let raf = 0
    const loop = () => {
      freezeWorldTime(t + (performance.now() - start) / 1000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [t, start])
  const sim = vec('sim', '0,30,0')
  whereabouts.sim = [sim[0], sim[1]]
  whereabouts.simPose = 'idle'
  const [called, setCalled] = useState<string | null>(null)
  const sound = usePartySound()
  return (
    <>
      <Night cam={vec('cam', id === 'yop-rue-princesse' ? '22,26,48' : '30,28,46')} look={vec('look', '0,2,0')}>
        <Landmark id={id} night />
        <Party id={id} night simGender="femme" onCall={(npc: Npc, text) => setCalled(`${npc.name} : « ${text} »`)} onTalk={(npc: Npc) => setCalled(`Tu parles à ${npc.name}`)} />
        {/* The Sim, a marker where &sim puts it */}
        <mesh position={[sim[0], 0.9, sim[1]]}>
          <cylinderGeometry args={[0.3, 0.3, 1.8, 10]} />
          <meshBasicMaterial color="#ff7a00" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[400, 400]} />
          <meshLambertMaterial color="#5a5048" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, id === 'yop-rue-princesse' ? 32 : 27]}>
          <planeGeometry args={[400, 9]} />
          <meshLambertMaterial color="#3b3d43" />
        </mesh>
      </Night>
      <div className="pointer-events-none fixed top-2 left-2 rounded-xl bg-white/90 px-3 py-2 text-[13px] font-bold">
        {PARTIES[id] ? `Fête ${Math.round(partyLevel(t) * 100)} % · son ${Math.round(sound.level * 100)} %` : 'pas une fête'}
        {called && <div className="text-[var(--color-orange)]">{called}</div>}
      </div>
    </>
  )
}

export function NightStreetLab() {
  const kind = (q.get('kind') ?? 'porch') as NightKind
  freezeWorldTime(Number(q.get('t') ?? FRIDAY_23 - 2 * 3600))
  return (
    <Night cam={vec('cam', '4,4,9')} look={vec('look', '0,1,0')}>
      <NightScene kind={kind} seed={`lab:${kind}`} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshLambertMaterial color="#8a6a4c" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 5]}>
        <planeGeometry args={[80, 6]} />
        <meshLambertMaterial color="#3b3d43" />
      </mesh>
    </Night>
  )
}

const rect = (x: number, z: number, w: number, d: number): XZ[] => [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2]]

export function NightCityLab() {
  const hour = Number(q.get('hour') ?? 23)
  const mats = useMemo(() => makeWorldMaterials(), [])
  useEffect(() => {
    mats.walls.emissiveIntensity = 0.95
    mats.shop.emissiveIntensity = 0.8
    mats.walls.userData.litShare.value = litShare(hour)
    mats.water.specular.set('#8a9ccc')
    mats.water.shininess = 140
    mats.water.color.set('#5a6a90')
    setVehicleNight(true)
  }, [mats, hour])
  const chunk = useMemo<ChunkData>(() => {
    const buildings: { ring: XZ[]; height: number }[] = []
    // Two rows of buildings along a boulevard, a side street, the lagoon behind.
    for (let i = 0; i < 9; i++) {
      const x = -120 + i * 28
      buildings.push({ ring: rect(x, -22, 20, 14), height: [9, 15, 6, 21, 12, 9, 27, 6, 15][i] })
      buildings.push({ ring: rect(x + 6, 24, 18, 14), height: [6, 12, 18, 9, 6, 24, 9, 12, 6][i] })
    }
    return {
      key: 'nightlab',
      tx: 0,
      ty: 0,
      box: { x0: -160, z0: -160, x1: 160, z1: 160 },
      roads: [
        { cls: 'primary', pts: [[-160, 0], [160, 0]], width: 12, paved: true, bridge: false },
        { cls: 'street', pts: [[-6, -160], [-6, 160]], width: 7, paved: true, bridge: false },
      ],
      buildings: buildings.map((b, i) => {
        const c = b.ring.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4] as XZ, [0, 0] as XZ)
        return { ring: blockRing(b.ring, [], c), holes: [], height: b.height, c, tint: (i * 0.37) % 1 }
      }),
      areas: [{ kind: 'water', rings: [[[-160, 60], [160, 60], [160, 160], [-160, 160]]] }],
      trees: [],
      palms: [],
      aeroways: [],
      pois: [],
    }
  }, [])
  const meshes = useMemo(() => buildChunk(chunk, () => false), [chunk])
  const nav = useMemo(() => new Nav([chunk]), [chunk])
  whereabouts.sim = [0, 0]
  return (
    <Night cam={vec('cam', '-70,22,70')} look={vec('look', '0,6,0')}>
      {Object.entries(meshes).map(([name, g]) => {
        const m = (mats as unknown as Record<string, THREE.Material>)[name]
        return g && m ? <mesh key={name} geometry={g} material={m} /> : null
      })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[8000, 8000]} />
        <meshLambertMaterial color="#cbb38c" />
      </mesh>
      <StreetLights nav={nav} night />
      <Traffic />
      {/* A pharmacy and a maquis along the boulevard */}
      <group position={[-40, 0, -15]}>
        <Dressing kind="pharmacie" seed={0.3} night />
      </group>
      <group position={[20, 0, -15]}>
        <Dressing kind="club" seed={0.5} night />
      </group>
    </Night>
  )
}

/** Cars going both ways down the boulevard, near and far (their lights on). */
function Traffic() {
  const cars = useMemo(() => [...Array(16)].map((_, i) => ({ dir: i % 2 ? 1 : -1, off: i * 41, kind: (['taxi', 'car', 'woro', 'gbaka', 'moto'] as const)[i % 5] })), [])
  const [t, setT] = useState(0)
  useFrame(() => setT(worldTime()))
  return (
    <>
      {cars.map((c, i) => {
        const x = ((((t * 9 + c.off) % 640) + 640) % 640) - 320
        return <Vehicle key={i} p={[c.dir * x, 0, c.dir * 2.6]} r={c.dir > 0 ? 0 : Math.PI} kind={c.kind} seed={i} />
      })}
    </>
  )
}
