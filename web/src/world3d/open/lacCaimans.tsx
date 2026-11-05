import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BOX, Blocks, lettering, signMaterial } from './ruePrincesse'
import { alongShore } from './shoreline'
import { CROCODILE, Herd, crocBrain, makeHerd, Waders, type Animal, type Brain } from './wildlife'
import { LowHuman } from '../../avatar/LowHuman'
import { NoShadows } from '../../avatar/Human'
import { TalkHuman } from '../Talkable'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { worldTime } from '../../lib/worldClock'
import { t as tr } from '../../lib/i18n'

// Le Lac aux caïmans, Yamoussoukro (the update « yakro-vivant »): the lakes round the presidential
// palace, where the sacred crocodiles live. As the game draws it: the bank of red earth and mud
// going down to the water, the crocodiles basking on it, mouths open in the sun, one getting up now
// and then to slide into the lake and drift there, its back and its eyes above the water; the low
// green rail people lean on, a few metres back, the sign; the palace's long cream wall and its
// gate behind; big trees, palms. In the late afternoon (16 h – 18 h) it's the feeding: the keeper
// in his blue overalls goes down to the water with the chickens, the crocodiles come out of the
// lake to him, jaws open, and the crowd gathers at the rail. The layout is the game's.
//
// The frame: places.ts sets it with its back to the lake's nearest shore (ON_SHORE): −z the water,
// +z the land. `shore`: the water's edge in this frame; without it, a straight bank and a lake of
// its own.

const SHORE_Z = -14
const RAIL = 9 // metres in from the water's edge
/** The feeding, at its hours (game minutes of the day): the keeper down at the water, the crocodiles to him. */
const FEED_FROM = 16 * 60
const FEED_TO = 18 * 60

const M = {
  mud: new THREE.MeshLambertMaterial({ color: '#8a6a45', polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  earth: new THREE.MeshLambertMaterial({ color: '#b5653a', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  grass: new THREE.MeshLambertMaterial({ color: '#5f9e48', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  rail: new THREE.MeshLambertMaterial({ color: '#2f7a3a' }),
  wall: new THREE.MeshLambertMaterial({ color: '#efe3c8' }),
  cap: new THREE.MeshLambertMaterial({ color: '#2f6b4a' }),
  gate: new THREE.MeshLambertMaterial({ color: '#c9a54a' }),
  trunk: new THREE.MeshLambertMaterial({ color: '#7d6248' }),
  leaves: new THREE.MeshLambertMaterial({ color: '#ffffff' }),
  water: new THREE.MeshLambertMaterial({ color: '#3c6f6a', transparent: true, opacity: 0.92 }),
  chicken: new THREE.MeshLambertMaterial({ color: '#f1e9da' }),
}

/** Whether it's feeding time now (the shared clock: the same on every screen). */
export function feedingNow(minute = worldTime() / 60) {
  const m = ((minute % 1440) + 1440) % 1440
  return m >= FEED_FROM && m < FEED_TO
}

/** The crocodiles at feeding time: out of the water, up to the keeper's spot, jaws snapping. */
function feedBrain(base: Brain, feeding: { current: boolean }, spot: [number, number]): Brain {
  return (a, dt, time, sp) => {
    if (!feeding.current) return base(a, dt, time, sp)
    const tx = spot[0] + a.ox * 0.9
    const tz = spot[1] - 2 + Math.abs(a.oz) * 0.4
    const dx = tx - a.x
    const dz = tz - a.z
    const d = Math.hypot(dx, dz)
    const want = Math.atan2(dz, dx)
    a.h += Math.atan2(Math.sin(want - a.h), Math.cos(want - a.h)) * Math.min(1, dt * 1.5)
    a.gait += ((d > 0.8 ? 1.3 : 0) - a.gait) * Math.min(1, dt * 2)
    if (d > 0.8 && Math.cos(want - a.h) > 0.4) {
      a.x += Math.cos(a.h) * 0.9 * a.gait * dt
      a.z += Math.sin(a.h) * 0.9 * a.gait * dt
    }
    a.y += (0 - a.y) * Math.min(1, dt * 1.2)
    // Close by: facing the keeper, the jaws snapping open and shut.
    a.jaw = d < 2 ? Math.max(0, Math.sin(time * 3 + a.ox * 5)) : a.jaw * 0.95
    a.mode = 'climb'
    a.t = 5
  }
}

export function LacCaimans({ night, shore }: { night: boolean; shore?: [number, number][] }) {
  const line = useMemo<[number, number][]>(() => (shore && shore.length > 1 ? shore : [[-60, SHORE_Z], [60, SHORE_Z]]), [shore])
  const along = useMemo(() => alongShore(line), [line])
  const ground = useMemo(() => ({ mud: along.ribbon(-0.5, 4, 0.03), earth: along.ribbon(4, RAIL + 2.5, 0.04), grass: along.ribbon(RAIL + 2.5, 40, 0.035) }), [along])
  const signs = useMemo(() => {
    const l = lettering(tr('LAC AUX CAÏMANS SACRÉS'), '#1f4d2e', '#fff6d6', '#e8c35a')
    const w = lettering(tr('NE PAS FRANCHIR LA BARRIÈRE'), '#8a1c1c', '#ffffff')
    return { name: signMaterial(l.t), nameAspect: l.aspect, warn: signMaterial(w.t), warnAspect: w.aspect }
  }, [])
  signs.name.emissiveIntensity = night ? 0.6 : 0

  // The rail all along, its posts every 2.5 m.
  const rail = useMemo(() => {
    const posts = along.every(2.5, RAIL).map(([x, z]) => ({ p: [x, 0.55, z] as [number, number, number], s: [0.12, 1.1, 0.12] as [number, number, number] }))
    return [...posts, ...along.band(RAIL - 0.05, RAIL + 0.05, 1.05, 0.08), ...along.band(RAIL - 0.04, RAIL + 0.04, 0.55, 0.06)]
  }, [along])
  // Where the crocodiles lie basking (on the mud and the earth, below the rail), and the water's points they slide to.
  const bank = useMemo(() => along.every(3.2, 2.2).map(([x, z]) => [x, z] as [number, number]), [along])
  const deep = useMemo(() => along.every(2, -5).map(([x, z]) => [x, z] as [number, number]), [along])
  const toWater = useMemo(
    () =>
      (x: number, z: number): [number, number] => {
        let best = deep[0]
        let bd = Infinity
        for (const p of deep) {
          const d = (p[0] - x) ** 2 + (p[1] - z) ** 2
          if (d < bd) (bd = d), (best = p)
        }
        return best
      },
    [deep],
  )
  // The keeper's spot at feeding time: on the mud by the middle of the bank.
  const mid = useMemo(() => along.at(along.dMid, 3), [along])
  const feeding = useRef(feedingNow())
  const [feedOn, setFeedOn] = useState(feeding.current)
  const crocs = useMemo<Animal[]>(() => {
    const out = makeHerd('caimans-yakro', 11, [mid[0], mid[1]], 1, [0.9, 1.35])
    // Spread along the bank, a few already in the water.
    out.forEach((a, i) => {
      const [x, z] = i % 4 === 3 ? deep[(i * 7) % deep.length] : bank[(i * 5) % bank.length]
      a.x = x
      a.z = z
      a.ox = (i - 5) * 1.6
      a.oz = (i % 3) - 1
      a.mode = i % 4 === 3 ? 'swim' : 'bask'
      a.y = i % 4 === 3 ? -0.42 : 0
      a.t = 4 + i * 2.3
    })
    return out
  }, [bank, deep, mid])
  const brain = useMemo(() => feedBrain(crocBrain(bank, toWater), feeding, [mid[0], mid[1]]), [bank, toWater, mid])
  const last = useRef(0)
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 2) return
    last.current = clock.elapsedTime
    feeding.current = feedingNow()
    if (feeding.current !== feedOn) setFeedOn(feeding.current)
  })

  const trees = useMemo(() => {
    const r = rng('lac-caimans-arbres')
    const trunks: { p: [number, number, number]; s: [number, number, number] }[] = []
    const crowns: { p: [number, number, number]; s: [number, number, number]; ry: number; c: string }[] = []
    for (const [x, z] of along.every(17, 24, 6)) {
      const h = 7 + r() * 6
      trunks.push({ p: [x, h / 2, z], s: [0.8, h, 0.8] })
      const R = 4 + r() * 3
      crowns.push({ p: [x, h + 0.8, z], s: [R * 1.6, 2.4, R * 1.6], ry: r() * 3, c: ['#2f7a35', '#3b8a3e', '#276b2e'][Math.floor(r() * 3)] })
    }
    return { trunks, crowns }
  }, [along])
  // The palace's wall, back from the bank, and its gate.
  const wall = useMemo(() => along.band(34, 35, 2.2, 4.4), [along])
  const cap = useMemo(() => along.band(33.8, 35.2, 4.5, 0.3), [along])
  const gateAt = useMemo(() => along.at(along.dMid + 18, 34.5), [along])
  const signAt = useMemo(() => along.at(along.dMid - 6, RAIL + 0.9), [along])

  // People at the rail: a few always; at feeding time, the crowd.
  const people = useMemo(() => {
    const r = rng('lac-caimans-gens')
    const spots = along.every(1.7, RAIL + 0.8, 0)
    const centre = along.dMid
    return spots
      .map((p, i) => ({ p, d: Math.abs(i * 1.7 - centre) }))
      .filter((s) => s.d < 26)
      .map((s, i) => {
        const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
        return { at: s.p, look: randomLook(gender, r), gender, pose: (['film', 'idle', 'cheer', 'phone', 'touch', 'wave'] as const)[i % 6], seed: r() * 100, always: i % 5 === 0, kid: r() < 0.25 }
      })
  }, [along])
  const keeper = useMemo(() => randomLook('homme', rng('gardien-caimans')), [])

  return (
    <group>
      <mesh geometry={ground.mud} material={M.mud} receiveShadow />
      <mesh geometry={ground.earth} material={M.earth} receiveShadow />
      <mesh geometry={ground.grass} material={M.grass} receiveShadow />
      {/* Without the map's lake: a lake of its own beyond the bank */}
      {!shore && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, SHORE_Z - 40]} material={M.water}>
          <planeGeometry args={[140, 80]} />
        </mesh>
      )}
      <Blocks at={rail} material={M.rail} />
      <Blocks at={wall} material={M.wall} />
      <Blocks at={cap} material={M.cap} />
      <group position={[gateAt[0], 0, gateAt[1]]} rotation={[0, gateAt[2] + Math.PI, 0]}>
        <mesh geometry={BOX} position={[-3.4, 3, 0]} scale={[1.2, 6, 1.4]} material={M.wall} castShadow />
        <mesh geometry={BOX} position={[3.4, 3, 0]} scale={[1.2, 6, 1.4]} material={M.wall} castShadow />
        <mesh geometry={BOX} position={[0, 2.2, 0]} scale={[5.6, 4.4, 0.15]} material={M.gate} />
        <mesh geometry={BOX} position={[0, 6.3, 0]} scale={[8.4, 0.6, 1.6]} material={M.cap} />
      </group>
      {/* The sign by the rail */}
      <group position={[signAt[0], 0, signAt[1]]} rotation={[0, signAt[2] + Math.PI, 0]}>
        <mesh geometry={BOX} position={[-1.6, 1.2, 0]} scale={[0.12, 2.4, 0.12]} material={M.trunk} />
        <mesh geometry={BOX} position={[1.6, 1.2, 0]} scale={[0.12, 2.4, 0.12]} material={M.trunk} />
        <mesh position={[0, 2.25, 0.08]} material={signs.name}>
          <planeGeometry args={[3.6, 3.6 / signs.nameAspect]} />
        </mesh>
        <mesh position={[0, 1.45, 0.08]} material={signs.warn}>
          <planeGeometry args={[3.2, 3.2 / signs.warnAspect]} />
        </mesh>
      </group>
      <Blocks at={trees.trunks} material={M.trunk} />
      <Blocks at={trees.crowns} material={M.leaves} color />
      {/* The crocodiles */}
      <Herd species={CROCODILE} animals={crocs} brain={brain} far={220} />
      <Waders spots={along.every(23, -3, 9).map(([x, z, r]) => [x, z, r + Math.PI / 2] as [number, number, number])} />
      {/* The people at the rail; the keeper at feeding time, a chicken in his hand */}
      <NoShadows>
        {people
          .filter((p) => feedOn || p.always)
          .map((p, i) => (
            <group key={i} position={[p.at[0], 0, p.at[1]]} rotation={[0, p.at[2] + Math.PI, 0]} scale={p.kid ? 0.72 : 1}>
              <LowHuman look={p.look} gender={p.gender} pose={feedOn ? p.pose : 'idle'} seed={p.seed} />
            </group>
          ))}
      </NoShadows>
      {feedOn && (
        <group position={[mid[0], 0, mid[1]]} rotation={[0, mid[2] + Math.PI, 0]}>
          <TalkHuman id="gardien-caimans" look={{ ...keeper, outfit: 'bleu', outfitColor: '#1f4fa8' }} gender="homme" pose="throw" seed={3} />
          <mesh geometry={BOX} position={[0.5, 0.25, 0.4]} scale={[0.5, 0.5, 0.5]} material={M.gate} />
          <mesh geometry={BOX} position={[0.5, 0.55, 0.4]} scale={[0.36, 0.26, 0.24]} material={M.chicken} />
        </group>
      )}
    </group>
  )
}
