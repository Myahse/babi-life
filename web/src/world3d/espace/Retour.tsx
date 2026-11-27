import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Sim } from '../../lib/types'
import { t as tr } from '../../lib/i18n'
import { isSpaceCity, LAUNCH_DEFAULTS } from '../../lib/espace'
import { buildPirogue, calaoMaterial, mergeBoxes, setChutes, setFlame, setPlasma, CALAO_COLORS, type PirogueParts } from './calao'
import { BlockPlanet, cloudGeometry, cloudMaterial, FlightCard, StarField } from './flightBits'

// The way back (backend sims/espace.go spaceReturn, an 8-minute leg: game.ReturnLeg), and the landings up there
// (the Moon's, Mars's: game.LandingLeg). Back to Earth: the deorbit burn over the planet in blocks, the re-entry
// (the shield glowing, the sky going from black to blue), the two drogues, the three mains, then the splashdown
// off Sassandra, Kourou or Canaveral (the floats, the agency's boat coming alongside), or the steppe at
// Baïkonour (the retro-rockets' puff a second before, the dust, the recovery truck). Nobody is hurt: it always
// lands. Down onto the Moon or Mars: the lander's engine under it, the dust, Mars's parachute first.

/** The way back's events (seconds after the start of the leg). */
const R = { reentry: 40, drogues: 200, mains: 260, down: 468 }

/** Altitude (km) on the way back, s seconds in. */
function backKm(s: number): number {
  if (s < R.reentry) return 210
  if (s < R.drogues) return 210 - (200 * (s - R.reentry)) / (R.drogues - R.reentry)
  if (s < R.mains) return 10 - (7 * (s - R.drogues)) / (R.mains - R.drogues)
  return Math.max(0, 3 * (1 - (s - R.mains) / (R.down - R.mains)))
}
const backKmh = (s: number) => (s < R.reentry ? 27_500 : s < R.drogues ? 27_500 - (27_000 * (s - R.reentry)) / (R.drogues - R.reentry) : s < R.mains ? 300 : s < R.down ? 25 : 0)

/** The agency's recovery boat (white, its orange stripe, its cabin) and the steppe's six-wheeled truck. */
function boatBoxes(): [number, number, number, number, number, number, string][] {
  return [
    [0, 0.6, 0, 14, 1.6, 4.6, '#f4f4f1'],
    [0, 1.2, 2.31, 14, 0.4, 0.05, CALAO_COLORS.orange],
    [0, 1.2, -2.31, 14, 0.4, 0.05, CALAO_COLORS.orange],
    [6.8, 0.9, 0, 1.6, 1.2, 3.4, '#f4f4f1'],
    [-2, 2.8, 0, 5, 2.4, 3.6, '#e9ecef'],
    [-0.2, 3, 0, 0.05, 1, 3, '#5c7d99'],
    [-2, 4.3, 0, 5.2, 0.4, 3.8, CALAO_COLORS.navy],
    [-3.5, 5.6, 0, 0.2, 2.2, 0.2, '#868e96'],
    [-3, 6.3, 0, 1, 0.6, 0.06, CALAO_COLORS.orange],
  ]
}
function truckBoxes(): [number, number, number, number, number, number, string][] {
  const b: [number, number, number, number, number, number, string][] = [
    [0, 2.2, 0, 9, 2, 3, '#f4f4f1'],
    [3.4, 3.8, 0, 2.4, 1.8, 2.8, '#f4f4f1'],
    [4.62, 3.9, 0, 0.05, 1, 2.4, '#5c7d99'],
    [0, 2.4, 1.52, 9, 0.4, 0.05, CALAO_COLORS.orange],
    [-2, 4, 0, 3, 1.2, 2.6, '#868e96'],
  ]
  for (const x of [-3, 0, 3]) for (const z of [-1.5, 1.5]) b.push([x, 0.8, z, 1.6, 1.6, 0.6, '#2b2f36'])
  return b
}

const geos = new Map<string, THREE.BufferGeometry>()
const geo = (k: string, f: () => [number, number, number, number, number, number, string][]) => geos.get(k) ?? (geos.set(k, mergeBoxes(f())), geos.get(k)!)
const dustGeo = new THREE.BoxGeometry(1, 1, 1)
const DUST = 24

/** The dust (or the spray) round where it touches down: blocks spreading and fading. */
function Dust({ color, since, lasts = 25 }: { color: string; since: () => number; lasts?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }), [color])
  useEffect(() => () => mat.dispose(), [mat])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }), [])
  useFrame(() => {
    const k = since()
    const me = mesh.current
    if (!me) return
    me.visible = k > 0 && k < lasts
    if (!me.visible) return
    for (let i = 0; i < DUST; i++) {
      const a = (i / DUST) * Math.PI * 2
      const out = 2 + k * (1.2 + (i % 4) * 0.4)
      tmp.p.set(Math.cos(a) * out, 0.6 + (i % 3) * 0.5 + k * 0.08, Math.sin(a) * out)
      const sz = 1.2 + k * 0.25 + (i % 3) * 0.4
      tmp.s.set(sz, sz * 0.7, sz)
      tmp.m.compose(tmp.p, tmp.q, tmp.s)
      me.setMatrixAt(i, tmp.m)
    }
    me.instanceMatrix.needsUpdate = true
    mat.opacity = 0.8 * Math.max(0, 1 - k / lasts)
  })
  return <instancedMesh ref={mesh} args={[dustGeo, mat, DUST]} frustumCulled={false} visible={false} />
}

/** Back to Earth: the scene for the whole leg. */
function ReturnScene({ steppe, secs }: { steppe: boolean; secs: () => number }) {
  const pirogue = useMemo<PirogueParts>(() => buildPirogue(), [])
  const scene = useThree((st) => st.scene)
  const cap = useRef<THREE.Group>(null)
  const planet = useRef<THREE.Group>(null)
  const ground = useRef<THREE.Mesh>(null)
  const clouds = useRef<THREE.Mesh>(null)
  const boat = useRef<THREE.Group>(null)
  const sky = useMemo(() => new THREE.Color(), [])
  const c = useMemo(() => ({ black: new THREE.Color('#02030a'), deep: new THREE.Color('#1b2f5a'), blue: new THREE.Color('#8ec9f0') }), [])
  const [stars, setStars] = useState(1)
  const cloudGeo = useMemo(() => cloudGeometry(5000, 50, 9), [])
  useFrame(({ camera, clock }) => {
    const s = secs()
    const p = cap.current
    if (!p) return
    const km = backKm(s)
    const space = s < R.drogues
    // Out there: the deorbit burn (the retro-rockets' glow), then the shield hot; the planet coming up.
    setFlame(pirogue.retro, s < R.reentry ? 0.8 : s >= R.down - 1.5 && s < R.down && steppe ? 1 : 0, clock.elapsedTime, s < R.reentry ? 3 : 5)
    const heat = s < R.reentry || s >= R.drogues ? 0 : Math.sin((Math.PI * (s - R.reentry)) / (R.drogues - R.reentry))
    setPlasma(pirogue, heat, clock.elapsedTime)
    setChutes(pirogue, s < R.drogues || s > R.down + 4 ? 'none' : s < R.mains ? 'drogues' : 'mains', s < R.mains ? (s - R.drogues) / 4 : (s - R.mains) / 6)
    pirogue.floats.visible = !steppe && s >= R.down + 2
    // Heat shield down through the re-entry; swinging a little under the chutes; bobbing on the sea.
    p.rotation.z = space ? (s < R.reentry ? 1.2 : 0.15 * Math.sin(clock.elapsedTime * 3) * heat) : 0.05 * Math.sin(clock.elapsedTime * 0.8)
    const landed = s >= R.down
    p.position.y = landed ? (steppe ? 0.4 : 0.6 + 0.25 * Math.sin(clock.elapsedTime * 1.3)) : 0.4 + km * 1000 * 0.08
    if (planet.current) {
      planet.current.visible = space
      planet.current.position.y = -1720 + (1 - km / 210) * 140 + p.position.y
    }
    if (ground.current) ground.current.visible = !space
    if (clouds.current) {
      clouds.current.visible = !space && km > 1.2
      clouds.current.position.y = 160
    }
    const shake = heat * 0.5
    sky.copy(c.black).lerp(c.deep, Math.min(1, Math.max(0, (s - R.reentry) / 120)))
    if (!space) sky.copy(c.deep).lerp(c.blue, Math.min(1, (s - R.drogues) / 40))
    scene.background = sky
    const st = space ? Math.max(0, 1 - Math.max(0, s - 100) / 80) : 0
    if (Math.abs(st - stars) > 0.05 || (st === 0 && stars !== 0)) setStars(st)
    // The boat comes alongside, the truck drives up.
    if (boat.current) {
      boat.current.visible = s > R.down - 30
      const k = Math.min(1, Math.max(0, (s - (R.down - 30)) / 40))
      boat.current.position.set(60 - 44 * k, steppe ? 0 : 0.2 * Math.sin(clock.elapsedTime * 1.1), -14 + 4 * k)
    }
    // The camera: round the capsule out there, then under the chutes, then by the water.
    const y = p.position.y
    if (space) camera.position.set(12 + Math.sin(clock.elapsedTime * 47) * shake, y + 5 + Math.cos(clock.elapsedTime * 41) * shake, 18)
    else if (!landed) camera.position.set(34, y - 8, 56)
    else camera.position.set(22, 7, 30)
    camera.lookAt(0, landed ? 2 : y + (space ? 0 : 9), 0)
  })
  return (
    <>
      <hemisphereLight args={['#ffffff', steppe ? '#d8c8a0' : '#c8d6e6', 1.3]} />
      <directionalLight position={[60, 80, 40]} intensity={1.5} />
      <group ref={cap}>
        <primitive object={pirogue.root} />
      </group>
      <group ref={planet}>
        <BlockPlanet radius={1600} cells={40} rotation={[0, 0.4, Math.PI / 2]} />
      </group>
      <mesh ref={ground} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <planeGeometry args={[20000, 20000]} />
        <meshLambertMaterial color={steppe ? '#c9b48a' : '#1d6fb8'} />
      </mesh>
      <mesh ref={clouds} geometry={cloudGeo} material={cloudMaterial()} visible={false} />
      <group ref={boat} visible={false}>
        <mesh geometry={steppe ? geo('truck', truckBoxes) : geo('boat', boatBoxes)} material={calaoMaterial()} />
      </group>
      <Dust color={steppe ? '#b89e6e' : '#f1f7fb'} lasts={steppe ? 25 : 7} since={() => secs() - R.down} />
      {stars > 0 && <StarField opacity={stars} />}
    </>
  )
}

/** Down onto the Moon (or Mars): the lander's engine, the dust, Mars's parachute first. */
function DescentScene({ mars, secs, leg }: { mars: boolean; secs: () => number; leg: number }) {
  const pirogue = useMemo<PirogueParts>(() => buildPirogue(), [])
  const cap = useRef<THREE.Group>(null)
  const legs = useMemo(() => mergeBoxes([-1.9, 1.9].flatMap((x) => [-1.9, 1.9].map((z) => [x, -0.4, z, 0.25, 1.6, 0.25, '#ced4da'] as [number, number, number, number, number, number, string])).concat([-1.9, 1.9].flatMap((x) => [-1.9, 1.9].map((z) => [x, -1.25, z, 0.9, 0.12, 0.9, '#adb5bd'] as [number, number, number, number, number, number, string])))), [])
  useFrame(({ camera, clock }) => {
    const s = secs()
    const p = cap.current
    if (!p) return
    const touch = leg - 6
    const h = Math.max(0, 1 - s / touch) ** 1.6 * 900
    p.position.y = 1.4 + h
    setChutes(pirogue, mars && s < touch * 0.45 ? 'mains' : 'none', (s - 2) / 6)
    setFlame(pirogue.retro, s > touch * 0.45 && s < touch + 0.5 ? 1 : 0, clock.elapsedTime, 4 + Math.min(4, h / 40))
    camera.position.set(14, p.position.y + 3 - Math.min(2, h / 200), 22)
    camera.lookAt(0, p.position.y + 1, 0)
  })
  return (
    <>
      <color attach="background" args={[mars ? '#d9a98a' : '#02030a']} />
      <hemisphereLight args={['#ffffff', mars ? '#7a4a30' : '#444', 1]} />
      <directionalLight position={[60, 50, 30]} intensity={1.7} />
      <group ref={cap}>
        <primitive object={pirogue.root} />
        <mesh geometry={legs} material={calaoMaterial()} />
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6000, 6000]} />
        <meshLambertMaterial color={mars ? '#c1623a' : '#a9abb0'} />
      </mesh>
      {/* The Earth up in the black sky, seen from the Moon. */}
      {!mars && <BlockPlanet radius={60} cells={14} position={[-500, 420, -900]} />}
      {!mars && <StarField opacity={1} />}
      <Dust color={mars ? '#c98a5e' : '#c4c6ca'} since={() => secs() - (leg - 6) + 6} />
    </>
  )
}

/** The way back to Earth (or down onto the Moon or Mars), with its card. */
export function Retour({ sim, onMap, minute }: { sim: Sim; onMap?: () => void; minute: () => number }) {
  const a = sim.activity!
  const t = a.trip!
  const down = isSpaceCity(t.city)
  const secs = () => (minute() - a.start) * 60
  const leg = (a.end - a.start) * 60
  const [s, setS] = useState(secs)
  useEffect(() => {
    const id = setInterval(() => setS((minute() - a.start) * 60), 500)
    return () => clearInterval(id)
  }, [a.start, minute])
  const share = Math.min(1, Math.max(0, s / Math.max(1, leg)))
  const sp = LAUNCH_DEFAULTS.spaceports.find((x) => x.id === t.city) ?? LAUNCH_DEFAULTS.spaceports[0]
  const steppe = sp.landing === 'steppe'
  const mars = t.city === 'mars'
  let line: string
  let data: { label: string; value: string }[] | undefined
  if (down) {
    const h = Math.round(Math.max(0, 1 - s / (leg - 6)) ** 1.6 * 15_000)
    line = s >= leg - 6 ? (mars ? tr('Posé·e sur Mars ! Le sas de la colonie s’ouvre') : tr('Alunissage ! La poussière retombe doucement')) : mars && s < (leg - 6) * 0.45 ? tr('Entrée dans le ciel de Mars : le parachute s’ouvre') : tr('Descente : le moteur freine, le sol approche')
    data = [{ label: tr('Altitude'), value: `${h.toLocaleString('fr-FR')} m` }]
  } else {
    if (s < R.reentry) line = tr('Freinage : la Pirogue quitte l’orbite')
    else if (s < R.drogues) line = tr('Rentrée dans l’atmosphère : le bouclier rougeoie')
    else if (s < R.mains) line = tr('Les parachutes de freinage s’ouvrent')
    else if (s < R.down) line = tr('Sous les trois grands parachutes')
    else line = steppe ? tr('Posé·e dans la steppe ! Les rétrofusées ont adouci le choc, l’équipe arrive') : tr('Amerrissage ! Le bateau d’Astrélia vient chercher la Pirogue')
    data = [
      { label: tr('Altitude'), value: `${(Math.round(backKm(s) * 10) / 10).toLocaleString('fr-FR')} km` },
      { label: tr('Vitesse'), value: `${Math.round(backKmh(s)).toLocaleString('fr-FR')} km/h` },
      { label: tr('Arrivée'), value: steppe ? tr('Steppe') : tr('Mer') },
    ]
  }
  return (
    <div className="absolute inset-0 z-20 bg-black">
      <Canvas dpr={[1, 1.5]} camera={{ fov: 50, near: 0.3, far: 9000, position: [14, 6, 20] }}>{down ? <DescentScene mars={mars} secs={secs} leg={leg} /> : <ReturnScene steppe={steppe} secs={secs} />}</Canvas>
      <FlightCard title={a.interaction.label} share={share} line={line} onMap={onMap} data={data} />
    </div>
  )
}
