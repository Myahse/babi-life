import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Player } from '../lib/types'
import { Character } from './Character'
import { Pram } from './Pram'
import { EXTENT_X, SIDEWALK, type Lot } from './layout'
import { rng } from './themes'
import { sampleLive, type LivePose } from '../lib/live'
import { INDOOR, SCENES } from './Interior'
import { whereabouts } from './whereabouts'
import { Bicycle, Vehicle } from './vehicles'

// The other players in the commune, live: where they really are (lib/live.ts),
// or, until their position arrives, at the door of the place where they're
// busy or strolling along the sidewalk. Their marker (the pin) is blue, so
// real people stand out from the street's passers-by; tap their name to meet.

const PLAYER_BLUE = '#3b82f6'

export function OtherPlayers({ players, lots, labels, onPick }: { players: Player[]; lots: Lot[]; labels: boolean; onPick: (id: string) => void }) {
  return (
    <>
      {players.map((p) => {
        const lot = p.activity && lots.find((l) => l.id === p.activity!.placeId)
        // Busy inside a place (the maquis, the pharmacy, the office…), or down on the beach: they're in there, not in the street.
        if (lot && (INDOOR.has(lot.kind) || SCENES.has(lot.kind)) && lot.kind !== 'home') return null
        return <OtherPlayer key={p.id} player={p} at={lot ? lot.door : null} labels={labels} onPick={onPick} />
      })}
    </>
  )
}

function OtherPlayer({ player, at, labels, onPick }: { player: Player; at: [number, number] | null; labels: boolean; onPick: (id: string) => void }) {
  const ref = useRef<THREE.Group>(null)
  // Their own spot: by the door they're busy at (a little aside, so several
  // players don't stack up), or somewhere on a sidewalk.
  const me = useMemo(() => {
    const r = rng(`player${player.id}`)
    const side = r() < 0.5 ? -1 : 1
    return { r, x: (r() * 2 - 1) * (EXTENT_X - 30), z: side * SIDEWALK, tx: 0, wait: r() * 3, dx: (r() - 0.5) * 2.4, dz: 0.8 + r() * 0.8, walk: null as [number, number] | null, waved: -99, t: 0 }
  }, [player.id])
  // A PNJ player (backend sims/pnj.go) walks up to the place it's busy at, from a little way down the
  // street, each time it starts something new; and waves when one's Sim comes by.
  const [wave, setWave] = useState(false)
  const atKey = at ? `${at[0]},${at[1]}` : ''
  useEffect(() => {
    if (!player.npc || !at) return
    me.walk = [Math.max(-EXTENT_X + 10, Math.min(EXTENT_X - 10, at[0] + (me.r() < 0.5 ? -1 : 1) * (12 + me.r() * 16))), Math.sign(at[1] || 1) * SIDEWALK]
  }, [atKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const [walking, setWalking] = useState(false)
  const [livePose, setLivePose] = useState<LivePose | null>(null)
  const pace = useRef(0)
  const last = useRef<[number, number]>([0, 0])
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    // Where the player really is, live; otherwise (not connected yet, an
    // older app) by the door of their place or strolling on the sidewalk.
    const live = sampleLive(player.id)
    if (live?.p !== livePose) setLivePose(live?.p ?? null)
    if (live) {
      // Eased to where it should be (a late update nudges, it doesn't jerk); far off (a teleport, just seen), at once.
      const far = (live.x - g.position.x) ** 2 + (live.z - g.position.z) ** 2 > 64
      const k = far ? 1 : 1 - Math.exp(-14 * Math.min(dt, 0.1))
      g.position.set(g.position.x + (live.x - g.position.x) * k, g.position.y + (live.y - g.position.y) * k, g.position.z + (live.z - g.position.z) * k)
      g.rotation.y += Math.atan2(Math.sin(live.h - g.rotation.y), Math.cos(live.h - g.rotation.y)) * (far ? 1 : k)
      // How fast it goes (m/s), smoothed: a bike's wheels and pedals turn with it.
      const moved = far ? 0 : Math.hypot(g.position.x - last.current[0], g.position.z - last.current[1]) / Math.max(dt, 1e-3)
      pace.current += (Math.min(moved, 20) - pace.current) * (1 - Math.exp(-4 * Math.min(dt, 0.1)))
      last.current = [g.position.x, g.position.z]
      return
    }
    me.t += Math.min(dt, 0.1)
    if (player.npc) {
      // One's Sim close by: it turns to it and waves (now and then, not every step).
      const near = Math.hypot(g.position.x - whereabouts.sim[0], g.position.z - whereabouts.sim[1]) < 5
      if (near && me.t - me.waved > 30) {
        me.waved = me.t
        setWave(true)
        setTimeout(() => setWave(false), 2200)
      }
      if (near && me.t - me.waved < 2.2) g.rotation.y = Math.atan2(whereabouts.sim[0] - g.position.x, whereabouts.sim[1] - g.position.z)
    }
    if (at) {
      const tx = at[0] + me.dx
      const tz = at[1] + Math.sign(at[1] || 1) * me.dz
      if (me.walk) {
        // On its way there, along the sidewalk, then to the door.
        const [wx, wz] = me.walk
        const dx = tx - wx
        const dz = tz - wz
        const d = Math.hypot(dx, dz)
        if (d < 0.15) {
          me.walk = null
          setWalking(false)
        } else {
          const k = Math.min(d, 1.4 * Math.min(dt, 0.1)) / d
          me.walk = [wx + dx * k, wz + dz * k]
          if (!walking) setWalking(true)
          if (me.t - me.waved > 2.2) g.rotation.y = Math.atan2(dx, dz)
          g.position.set(me.walk[0], 0, me.walk[1])
          return
        }
      }
      g.position.set(tx, 0, tz)
      return
    }
    // Strolling: a few steps, a pause, a few steps back.
    const step = Math.min(dt, 0.1)
    if (me.wait > 0) {
      me.wait -= step
      if (me.wait <= 0) {
        me.tx = Math.max(-EXTENT_X + 10, Math.min(EXTENT_X - 10, me.x + (me.r() * 2 - 1) * 18))
        setWalking(true)
      }
    } else {
      const d = me.tx - me.x
      if (Math.abs(d) < 0.1) {
        me.wait = 3 + me.r() * 6
        setWalking(false)
      } else {
        me.x += Math.sign(d) * Math.min(Math.abs(d), 1.3 * step)
        g.rotation.y = d > 0 ? Math.PI / 2 : -Math.PI / 2
      }
    }
    g.position.set(me.x, 0, me.z)
  })
  // One's partner close by (a few steps): hearts rise over them.
  const [close, setClose] = useState(false)
  const wp = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    if (!player.couple || !ref.current) return
    ref.current.getWorldPosition(wp)
    const near = Math.hypot(wp.x - whereabouts.sim[0], wp.z - whereabouts.sim[1]) < 6
    if (near !== close) setClose(near)
  })
  // Their gang's tag before the name, their office after (politics).
  const tag = `${player.crew ? `[${player.crew}] ` : ''}${player.username ? `@${player.username}` : player.firstName}${player.title ? ` · ${player.title}` : ''}`
  return (
    <group ref={ref}>
      {player.stage === 'bebe' ? (
        // A baby out: in its pram, its maman (or the nounou) pushing, as for one's own.
        <Pram sim={player} walking={walking || livePose === 'walk' || livePose === 'run'} other moodColor={PLAYER_BLUE} speed={3.2} />
      ) : livePose === 'pedal' || livePose === 'moto' || livePose === 'drive' ? (
        // On their own wheels (Walker sends it): the bike pedalled at the speed it goes, the moto, the car.
        <Wheels kind={livePose} player={player} speed={pace} />
      ) : (
      <Character look={player.look} gender={player.gender} stage={player.stage} walking={walking} busy={!!at} pose={livePose ?? (wave ? 'wave' : undefined)} moodColor={PLAYER_BLUE} seed={player.id.charCodeAt(0)} speed={livePose === 'run' ? 8.5 : 3.2} />
      )}
      {close && <Hearts />}
      {labels && (
        <Html position={[0, 2.45, 0]} center zIndexRange={[27, 20]}>
          {/* One's partner (backend sims/couple.go): in pink, a heart; a PNJ player (sims/pnj.go): in violet */}
          <button className={`rounded-md px-1.5 py-0.5 text-[11px] font-extrabold whitespace-nowrap text-white shadow-[0_4px_10px_-4px_rgba(0,0,0,0.5)] active:scale-95 ${player.couple ? 'bg-[#e0245e]' : player.npc ? 'bg-[#7048e8]' : 'bg-[#2563eb]'}`} onClick={() => onPick(player.id)}>
            {player.couple ? `❤ ${tag}` : tag}
          </button>
        </Html>
      )}
    </group>
  )
}

const heartMat = new THREE.MeshBasicMaterial({ color: '#ff3d77', transparent: true })
const heartGeo = (() => {
  const h = new THREE.Shape()
  h.moveTo(0, -0.12)
  h.bezierCurveTo(-0.02, -0.06, -0.16, 0.0, -0.12, 0.08)
  h.bezierCurveTo(-0.09, 0.14, -0.02, 0.13, 0, 0.07)
  h.bezierCurveTo(0.02, 0.13, 0.09, 0.14, 0.12, 0.08)
  h.bezierCurveTo(0.16, 0.0, 0.02, -0.06, 0, -0.12)
  return new THREE.ShapeGeometry(h)
})()

/** A few hearts rising and fading over a player's partner, close by. */
function Hearts() {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock, camera }) => {
    const grp = g.current
    if (!grp) return
    grp.children.forEach((m, i) => {
      const k = (clock.elapsedTime * 0.5 + i / 3) % 1
      m.position.set(Math.sin(k * 6 + i * 2) * 0.25, 2.2 + k * 1.1, 0)
      m.scale.setScalar(1.2 + k)
      m.quaternion.copy(camera.quaternion)
    })
  })
  return (
    <group ref={g}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} geometry={heartGeo} material={heartMat} />
      ))}
    </group>
  )
}

/** Another player on their own wheels: a bike (they pedal, at the pace it goes), a moto, a car (whose is unknown here: a plain one). */
function Wheels({ kind, player, speed }: { kind: 'pedal' | 'moto' | 'drive'; player: Player; speed: React.RefObject<number> }) {
  const crank = useRef(0)
  const speedOf = useMemo(() => () => speed.current ?? 0, [speed])
  const clock = useMemo(() => () => crank.current, [])
  if (kind === 'drive')
    return (
      <group rotation={[0, -Math.PI / 2, 0]}>
        <Vehicle p={[0, 0, 0]} kind="car" seed={player.id.charCodeAt(0)} />
      </group>
    )
  const bike = kind === 'pedal'
  return (
    <>
      {/* The same setting as one's own (Walker): the bike at the Sim's size, the rider on the saddle */}
      <group rotation={[0, -Math.PI / 2, 0]} scale={bike ? 1.35 : 1}>{bike ? <Bicycle color={PLAYER_BLUE} speed={speedOf} crankAt={crank} /> : <Vehicle p={[0, 0, 0]} kind="moto" color={PLAYER_BLUE} crew={false} />}</group>
      <group position={[0, bike ? 0.82 : 0.42, bike ? -0.3 : -0.25]} rotation={[bike ? 0.3 : 0, 0, 0]}>
        <Character look={player.look} gender={player.gender} stage={player.stage} pose={bike ? 'pedal' : 'sit'} clock={bike ? clock : undefined} moodColor={PLAYER_BLUE} seed={player.id.charCodeAt(0)} />
      </group>
    </>
  )
}
