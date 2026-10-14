import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Player } from '../lib/types'
import { Character } from './Character'
import { EXTENT_X, SIDEWALK, type Lot } from './layout'
import { rng } from './themes'

// The other players in the commune, live: at the door of the place where
// they're busy, or strolling along the sidewalk. Their plumbob is blue, so
// real people stand out from the street's passers-by; tap their name to meet.

const PLAYER_BLUE = '#3b82f6'

export function OtherPlayers({ players, lots, labels, onPick }: { players: Player[]; lots: Lot[]; labels: boolean; onPick: (id: string) => void }) {
  return (
    <>
      {players.map((p) => {
        const lot = p.activity && lots.find((l) => l.id === p.activity!.placeId)
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
    return { r, x: (r() * 2 - 1) * (EXTENT_X - 30), z: side * SIDEWALK, tx: 0, wait: r() * 3, dx: (r() - 0.5) * 2.4, dz: 0.8 + r() * 0.8 }
  }, [player.id])
  const [walking, setWalking] = useState(false)
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    if (at) {
      g.position.set(at[0] + me.dx, 0, at[1] + Math.sign(at[1] || 1) * me.dz)
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
  const tag = player.username ? `@${player.username}` : player.firstName
  return (
    <group ref={ref}>
      <Character look={player.look} gender={player.gender} stage={player.stage} walking={walking} busy={!!at} moodColor={PLAYER_BLUE} seed={player.id.charCodeAt(0)} />
      {labels && (
        <Html position={[0, 2.45, 0]} center zIndexRange={[27, 20]}>
          <button className="rounded-md bg-[#2563eb] px-1.5 py-0.5 text-[11px] font-extrabold whitespace-nowrap text-white shadow-[0_4px_10px_-4px_rgba(0,0,0,0.5)] active:scale-95" onClick={() => onPick(player.id)}>
            {tag}
          </button>
        </Html>
      )}
    </group>
  )
}
