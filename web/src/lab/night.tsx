import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
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
import { Human } from '../avatar/Human'
import { AWA_NIGHT, KEKE_NIGHT } from './paiyaLooks'
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

function Night({ children, cam, look, far = 6000, orbit = true }: { children: React.ReactNode; cam: [number, number, number]; look: [number, number, number]; far?: number; /** false: something else moves the camera (a film's take). */ orbit?: boolean }) {
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: cam, fov: 50, far }} style={{ width: '100vw', height: '100vh', background: '#141a3d' }}>
      <hemisphereLight args={['#7484c4', '#3a3a56', 1.3]} />
      <directionalLight position={[60, 110, 35]} intensity={0.6} color="#8fa8ff" />
      <fog attach="fog" args={['#1d2552', 400, 5200]} />
      <SkyDome night dusk={false} />
      {children}
      {orbit && <OrbitControls target={look} />}
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
        <Party id={id} night simGender="femme" onTalk={(npc: Npc) => setCalled(`Tu parles à ${npc.name}`)} />
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
  const ride = q.get('ride')
  return (
    <Night cam={vec('cam', '-70,22,70')} look={vec('look', '0,6,0')} orbit={!ride}>
      {ride && <Ride kind={ride} />}
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

/**
 * « Samedi, c'est paiya ! » (marketing/scripts/samedi-paiya.md), on the night boulevard, the camera
 * with it: &ride=limo Keke's white limousine down the boulevard; &ride=pickup it slows and stops
 * where Awa waits on the pavement, in her gold dress; &ride=gnango at 4 in the morning, the VTC (a
 * white saloon) stopping in front of the club for the two of them.
 */
function Ride({ kind }: { kind: string }) {
  const camera = useThree((s) => s.camera)
  const car = useRef<THREE.Group>(null)
  const [t, setT] = useState(0)
  useFrame(({ clock }) => {
    // &t0=: seconds held still first, so the people and cars have loaded when a film's take starts.
    const e = Math.max(0, clock.elapsedTime - Number(new URLSearchParams(location.search).get('t0') ?? 0))
    // Where the car is: driving on at 13 m/s, or slowing to a stop at 0 (eased over `stop` seconds).
    const stopAt = (from: number, stop: number) => (e >= stop ? 0 : from * Math.pow(1 - e / stop, 2))
    let x = 0
    if (kind === 'limo') x = -90 + e * 13
    else if (kind === 'pickup') x = stopAt(-42, 3.2)
    else x = 25.5 - stopAt(-38, 3)
    car.current?.position.setX(x)
    if (kind === 'limo') {
      camera.position.set(x - 7.5, 2.6 + Math.sin(e * 0.4) * 0.2, 7.2)
      camera.lookAt(x + 4, 1, 2.6)
    } else if (kind === 'pickup') {
      camera.position.set(2.6 - e * 0.15, 2.4, 13.5)
      camera.lookAt(0.4, 1.0, 4.6)
    } else {
      camera.position.set(18.6 + e * 0.2, 1.9, 0.6)
      camera.lookAt(22.6, 1.2, -5)
    }
    if (Math.floor(e * 10) !== Math.floor(t * 10)) setT(e)
  })
  const limo = kind !== 'gnango'
  const lane = limo ? 2.6 : -2.6
  return (
    <>
      <group ref={car} position={[0, 0, lane]}>
        <Vehicle p={[0, 0, 0]} r={limo ? 0 : Math.PI} kind="car" model={limo ? 'limo' : 'saloon'} color={limo ? '#111214' : '#f8f9fa'} seed={limo ? 3 : 8} />
      </group>
      {kind === 'pickup' && (
        <group position={[1.2, 0.15, 6.4]} rotation={[0, -0.5, 0]}>
          <Human look={AWA_NIGHT} gender="femme" pose={t < 2.6 ? 'phone' : 'wave'} seed={3} />
        </group>
      )}
      {kind === 'gnango' && (
        <>
          <group position={[20.6, 0.15, -5.6]} rotation={[0, 0.7, 0]}>
            <Human look={AWA_NIGHT} gender="femme" pose={t < 1.8 ? 'phone' : 'wave'} seed={3} />
          </group>
          <group position={[22.2, 0.15, -5.8]} rotation={[0, 0.2, 0]}>
            <Human look={KEKE_NIGHT} gender="homme" pose={t < 1.2 ? 'talk' : 'cheer'} seed={5} />
          </group>
        </>
      )}
    </>
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
