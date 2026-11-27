import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Sim } from '../../lib/types'
import { t as tr } from '../../lib/i18n'
import { isSpaceCity, LAUNCH_DEFAULTS } from '../../lib/espace'
import { buildCalao, setCalaoFlames, type CalaoParts } from './calao'
import { Pad } from './spatioport'
import { BlockPlanet, cloudGeometry, cloudMaterial, FlightCard, StarField, useTripClock } from './flightBits'
import { rumble } from './rumble'
import { Retour } from './Retour'

// A trip by rocket (trip.mode 'fusee', backend sims/espace.go): the launch from the pad, lived to the second on
// the trip's own clock. Before the launch (the preflight: the suit, the medical, the walk to the pad), the Calao
// on its pad, the arms swinging back; T-10, the countdown big on the screen; the ignition, the smoke, the lift-off
// and the rumble; the ascent through the clouds, the boosters let go at T+2:00, the escape tower (the Lourd's
// fairing) at 2:30, the first stage at 3:10 and the second lit, the sky going black and the Earth's curve; at
// 7:20 the Pirogue lets the second stage go, in orbit. The way back to Earth and the landings up there are
// Retour.tsx's. Every number is the game's (an 8-minute leg: game.LaunchLeg).

/** The ascent's events (seconds after ignition). */
export const ASCENT = { boosters: 120, tower: 150, stage1: 190, orbit: 440 }
const T = ASCENT

/** Altitude (km) and speed (km/h), s seconds after ignition. */
export const altKm = (s: number) => Math.min(210, 0.0009 * Math.max(0, s) ** 2)
const speedKmh = (s: number) => Math.min(27_600, Math.max(0, s) ** 1.62 * 1.2)

/** The pad's ground colour: the steppe's at Baïkonour, the coast's elsewhere. */
const GROUND: Record<string, { land: string; sea: string }> = {
  baikonour: { land: '#c9b48a', sea: '#c9b48a' },
  sassandra: { land: '#5d8f3e', sea: '#1d6fb8' },
  kourou: { land: '#3f7a35', sea: '#2a6a8c' },
  'cap-canaveral': { land: '#8aa35a', sea: '#2b74b0' },
}

/** The preflight's steps (before the countdown), each an equal share of it. */
const PREFLIGHT = () => [tr('Combinaison enfilée'), tr('Visite médicale'), tr('Marche vers la fusée'), tr('Installation dans la Pirogue'), tr('Écoutille fermée, vérifications')]

export function mmss(sec: number) {
  const a = Math.abs(Math.floor(sec))
  return `${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`
}

/** On the pad: from the preflight to a few seconds after lift-off. */
function PadScene({ spaceport, padId, night, secs }: { spaceport: string; padId: string; night: boolean; secs: () => number }) {
  const ground = GROUND[spaceport] ?? GROUND.sassandra
  const clock = () => {
    const s = secs()
    return { since: s / 60, until: -s / 60 }
  }
  useFrame(({ camera, clock: c }) => {
    const s = secs()
    if (s < -10) {
      // The preflight: slowly round the pad.
      const a = c.elapsedTime * 0.05 + 0.6
      camera.position.set(Math.cos(a) * 110, 38, Math.sin(a) * 110)
      camera.lookAt(0, 22, 0)
    } else if (s < 3) {
      // The countdown: low by the trench, looking up at the engines and the tower.
      camera.position.set(34, 6 + (s + 10) * 0.2, 62)
      camera.lookAt(0, 18, 0)
    } else {
      const y = 1.5 + 1.6 * Math.max(0, s - 3) ** 2.1
      const shake = Math.max(0, 1 - (s - 3) / 9) * 0.6
      camera.position.set(60 + Math.sin(c.elapsedTime * 40) * shake, 4 + Math.cos(c.elapsedTime * 37) * shake, 120)
      camera.lookAt(0, y + 20, 0)
    }
  })
  return (
    <>
      <color attach="background" args={[night ? '#0c1630' : '#7fb8ec']} />
      <fog attach="fog" args={[night ? '#0c1630' : '#a9d1f2', 300, 1400]} />
      <hemisphereLight args={[night ? '#4a5a8a' : '#ffffff', night ? '#1a1a22' : '#8a7a60', night ? 0.5 : 1.2]} />
      <directionalLight position={[60, 90, 40]} intensity={night ? 0.2 : 1.5} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[3000, 3000]} />
        <meshLambertMaterial color={ground.land} />
      </mesh>
      {/* The sea beyond the trench (downrange); the steppe all round at Baïkonour. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 900]}>
        <planeGeometry args={[3000, 1400]} />
        <meshLambertMaterial color={ground.sea} />
      </mesh>
      <Pad id={padId} night={night} clock={clock} />
    </>
  )
}

/** The ascent, from the clouds to the orbit: the rocket stays still, the world falls away under it. */
function Ascent({ spaceport, model, secs }: { spaceport: string; model: 'calao-1' | 'calao-lourd'; secs: () => number }) {
  const calao = useMemo<CalaoParts>(() => buildCalao(model), [model])
  const scene = useThree((st) => st.scene)
  const rocket = useRef<THREE.Group>(null)
  const ground = useRef<THREE.Mesh>(null)
  const clouds = useRef<THREE.Mesh>(null)
  const planet = useRef<THREE.Group>(null)
  const sky = useMemo(() => new THREE.Color(), [])
  const black = useMemo(() => new THREE.Color('#02030a'), [])
  const focus = useMemo(() => new THREE.Vector3(), [])
  const [stars, setStars] = useState(0)
  const debris = useRef<{ o: THREE.Object3D; v: THREE.Vector3; at: number }[]>([])
  const staged = useRef(new Set<string>())
  const cloudGeo = useMemo(() => cloudGeometry(6000, 60), [])
  const g = GROUND[spaceport] ?? GROUND.sassandra
  useEffect(() => () => debris.current.forEach((d) => d.o.removeFromParent()), [])
  useFrame(({ camera, clock }, dt) => {
    const s = secs()
    const r = rocket.current
    if (!r) return
    const alt = altKm(s) * 1000
    // Pitching over downrange as it climbs.
    r.rotation.z = -Math.min(1.15, Math.max(0, s - 15) / 330)
    // Let go: what has burnt out (attached to the scene, it falls away); late (the view opened past it), gone.
    const drop = (key: string, at: number, obj: THREE.Object3D | undefined, push: THREE.Vector3) => {
      if (!obj || staged.current.has(key) || s < at) return
      staged.current.add(key)
      if (s - at > 4) {
        obj.visible = false
        return
      }
      scene.attach(obj)
      debris.current.push({ o: obj, v: push, at: s })
    }
    calao.boosters.forEach((b, i) => drop(`b${i}`, T.boosters, b, new THREE.Vector3(b.position.x * 0.8 || (i % 2 ? 2 : -2), -6, b.position.z * 0.8)))
    drop('tower', T.tower, calao.tower, new THREE.Vector3(6, 14, 0))
    calao.fairing?.forEach((f, i) => drop(`f${i}`, T.tower, f, new THREE.Vector3(i ? -6 : 6, -2, 0)))
    drop('s1', T.stage1, calao.stage1, new THREE.Vector3(0, -9, 0))
    drop('s2', T.orbit, calao.stage2.children.find((c) => (c as THREE.Mesh).isMesh), new THREE.Vector3(-3, -4, 0))
    for (const d of debris.current) {
      d.v.y -= 6 * dt
      d.o.position.addScaledVector(d.v, dt)
      d.o.rotation.z += dt * 0.25
      d.o.rotation.x += dt * 0.1
      if (s - d.at > 14) d.o.visible = false
    }
    // The core and the boosters, then the second stage; once in orbit, nothing burns.
    setCalaoFlames(calao, s < T.stage1 ? 1 : 0, s < T.boosters ? 1 : 0, s >= T.stage1 + 3 && s < T.orbit ? 1 : 0, clock.elapsedTime, 14 + Math.min(14, s / 10))
    // The world below: the ground's plane falling away, the clouds passed, then the planet and its curve.
    if (ground.current) {
      ground.current.position.y = -alt * 0.25 - 40
      ground.current.visible = alt < 14_000
    }
    if (clouds.current) {
      clouds.current.position.y = 500 - alt * 0.25
      clouds.current.visible = alt < 14000
    }
    if (planet.current) {
      planet.current.visible = alt > 12_000
      // Its top far ahead, low on the screen, sinking as it climbs (the curve showing more).
      const k = Math.min(1, (alt - 12_000) / 150_000)
      planet.current.position.set(0, -1600 - 20 - k * 260, -1100)
    }
    sky.set('#7fb8ec').lerp(black, Math.min(1, alt / 45_000))
    scene.background = sky
    const st = Math.min(1, Math.max(0, (alt - 25_000) / 25_000))
    if (Math.abs(st - stars) > 0.05 || (st === 1 && stars < 1)) setStars(st)
    // The camera follows what's left of it (the core, then the second stage, then the Pirogue), from the side
    // and a little above, the planet's curve low on the screen; shaking low down.
    const shake = Math.max(0, 1 - s / 90) * 0.35
    const orbit = s >= T.orbit
    const focusY = orbit ? calao.seams.capsule + 2 : s >= T.stage1 ? (calao.seams.stage2 + calao.seams.capsule) / 2 + 2 : 22
    focus.set(0, focusY, 0)
    r.updateMatrixWorld()
    r.localToWorld(focus)
    const far = orbit ? 0.45 : s >= T.stage1 ? 0.7 : 1
    camera.position.set(focus.x + 30 * far + Math.sin(clock.elapsedTime * 30) * shake, focus.y + 14 * far, focus.z + 62 * far)
    camera.lookAt(focus.x, focus.y - 4 * far, focus.z)
  })
  return (
    <>
      <hemisphereLight args={['#ffffff', '#5a6a80', 1.1]} />
      <directionalLight position={[80, 60, 50]} intensity={1.6} />
      <group ref={rocket}>
        <primitive object={calao.root} />
      </group>
      <mesh ref={ground} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20000, 20000]} />
        <meshLambertMaterial color={g.sea} fog={false} />
      </mesh>
      <mesh ref={clouds} geometry={cloudGeo} material={cloudMaterial()} />
      <group ref={planet} visible={false}>
        <BlockPlanet radius={1600} cells={40} rotation={[0.2, 0, Math.PI / 2]} />
      </group>
      {stars > 0 && <StarField opacity={stars} />}
    </>
  )
}

export function LaunchView({ sim, night = false, onMap }: { sim: Sim; night?: boolean; onMap?: () => void }) {
  const minute = useTripClock(sim.gameMinutes)
  // Back to Earth, or down onto the Moon or Mars: Retour.tsx.
  if (isSpaceCity(sim.activity!.trip!.fromCity)) return <Retour sim={sim} onMap={onMap} minute={minute} />
  return <Launch sim={sim} night={night} onMap={onMap} minute={minute} />
}

function Launch({ sim, night, onMap, minute }: { sim: Sim; night: boolean; onMap?: () => void; minute: () => number }) {
  const a = sim.activity!
  const t = a.trip!
  const sp = LAUNCH_DEFAULTS.spaceports.find((x) => x.id === t.fromCity) ?? LAUNCH_DEFAULTS.spaceports[0]
  const dest = sim.life?.espace?.voyage?.dest ?? LAUNCH_DEFAULTS.destinations.find((d) => d.city === t.city)?.id ?? 'station'
  const model = dest === 'mars' ? 'calao-lourd' : 'calao-1'
  const departs = t.departs ?? a.start
  const secs = () => (minute() - departs) * 60
  // The card ticks four times a second (the countdown's seconds).
  const [s, setS] = useState(secs)
  useEffect(() => {
    const id = setInterval(() => setS((minute() - departs) * 60), 250)
    return () => clearInterval(id)
  }, [departs, minute])
  // The rumble at the ignition (heard only when lived then).
  const heard = useRef(false)
  useEffect(() => {
    if (!heard.current && s >= 0 && s < 4) {
      heard.current = true
      rumble(1, 16)
    }
  }, [s])
  const onPad = s < 12
  const share = Math.min(1, Math.max(0, (minute() - a.start) / Math.max(1, a.end - a.start)))
  const dName = LAUNCH_DEFAULTS.destinations.find((d) => d.id === dest)?.name ?? ''
  let line: string
  let big: string | undefined
  if (s < -10) {
    const steps = PREFLIGHT()
    const k = Math.min(steps.length - 1, Math.floor(((minute() - a.start) / Math.max(0.1, departs - a.start)) * steps.length))
    line = tr('Préparation : {step}. Décollage dans {t}', { step: steps[Math.max(0, k)], t: mmss(s) })
  } else if (s < 0) {
    big = `${Math.ceil(-s)}`
    line = tr('Compte à rebours : {n}…', { n: Math.ceil(-s) })
  } else if (s < 12) {
    big = s < 3 ? tr('Décollage !') : undefined
    line = tr('Allumage ! La {rocket} quitte le pas de tir de {name}', { rocket: model === 'calao-lourd' ? 'Calao Lourd' : 'Calao-1', name: sp.name })
  } else if (s < T.boosters) line = tr('Montée : la fusée traverse les nuages')
  else if (s < T.tower) line = tr('Séparation des boosters')
  else if (s < T.stage1) line = model === 'calao-lourd' ? tr('Largage de la coiffe : la Grande Pirogue à l’air libre') : tr('Largage de la tour de sauvetage')
  else if (s < T.stage1 + 40) line = tr('Séparation du premier étage, le deuxième s’allume')
  else if (s < T.orbit) line = tr('Le ciel devient noir, la courbe de la Terre apparaît')
  else line = dest === 'station' ? tr('En orbite ! La Pirogue se sépare et file vers la {name}', { name: dName }) : tr('En orbite ! Cap sur {name}', { name: dName })
  const data =
    s >= 0
      ? [
          { label: tr('Temps'), value: `T+${mmss(s)}` },
          { label: tr('Altitude'), value: `${altKm(s) < 10 ? altKm(s).toFixed(1).replace('.', ',') : Math.round(altKm(s))} km` },
          { label: tr('Vitesse'), value: `${Math.round(speedKmh(s)).toLocaleString('fr-FR')} km/h` },
        ]
      : undefined
  return (
    <div className="absolute inset-0 z-20 bg-black">
      <Canvas key={onPad ? 'pad' : 'ascent'} dpr={[1, 1.5]} camera={{ fov: 50, near: 0.5, far: 9000, position: [80, 30, 90] }}>
        {onPad ? <PadScene spaceport={sp.id} padId={sp.pad} night={night} secs={secs} /> : <Ascent spaceport={sp.id} model={model} secs={secs} />}
      </Canvas>
      <FlightCard title={a.interaction.label} share={share} line={line} onMap={onMap} big={big} data={data} />
    </div>
  )
}
