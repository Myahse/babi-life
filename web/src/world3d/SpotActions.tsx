import { useEffect, useState } from 'react'
import { Html } from '@react-three/drei'
import { iconFor } from '../components/icons'
import { IconTile } from '../components/ui'
import { openSpot, useSceneActions, type SceneAction } from './sceneActions'

// Inside a place, what can be done there shows where it's done: a pin over
// the table, the counter, the pool, the seats by the glass (the scene says
// where each thing is: `where`), the things done at the same spot under one.
// Tap a pin, its things open (in a card on the screen: Play's SpotSheet); tap one, the Sim goes and does it. The rest of
// the room is free to walk about. What has no spot in the scene waits by
// the door (`entrance`).

type V3 = [number, number, number]

/** Spots closer than this (metres) are one: the things done at the same table, the same counter. */
const SAME = 1.6
/** The pins, always there (drei's <Html> breaks when one is taken away mid-scene: they're emptied instead). */
const SLOTS = 14
const AWAY: V3 = [0, -1000, 0]

export function SpotActions({ shown, where, entrance, lift = 2.3 }: { /** Walking about, nothing being done: the pins show. */ shown: boolean; where: (id: string) => V3 | null | undefined; entrance: V3; /** How far over the spot the pin floats (over the heads). */ lift?: number }) {
  const { actions } = useSceneActions()
  useEffect(() => {
    if (!shown) openSpot(null)
  }, [shown])
  // (And it loses whichever one mounts with the canvas: they mount a frame later, as Neighbourhood's labels.)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const groups: { at: V3; actions: SceneAction[] }[] = []
  for (const a of shown ? actions : []) {
    const p = where(a.id) ?? entrance
    const g = groups.find((x) => Math.hypot(x.at[0] - p[0], x.at[2] - p[2]) < SAME && Math.abs(x.at[1] - p[1]) < 1.5)
    if (g) g.actions.push(a)
    else groups.push({ at: p, actions: [a] })
  }
  if (!ready) return null
  return (
    <>
      {Array.from({ length: SLOTS }, (_, i) => {
        const g = groups[i]
        if (!g)
          return (
            <Html key={i} position={AWAY} center zIndexRange={[30, 0]}>
              {null}
            </Html>
          )
        const first = g.actions[0]
        const shut = g.actions.every((a) => a.why)
        return (
          <Html key={i} position={[g.at[0], g.at[1] + lift, g.at[2]]} center zIndexRange={[30, 0]}>
            <button className={`flex flex-col items-center ${shut ? 'opacity-60' : ''}`} onClick={() => openSpot(g.actions)} onPointerDown={(e) => e.stopPropagation()} aria-label={g.actions.map((a) => a.label).join(', ')}>
              <span className="relative">
                <IconTile icon={iconFor(first.icon)} colors={first.colors} size={38} radius={19} style={{ boxShadow: '0 0 0 2.5px #ffffff, 0 6px 14px -6px rgba(0,0,0,0.7)' }} />
                {g.actions.length > 1 && <span className="absolute -top-1 -right-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--color-orange)] px-1 text-[10px] font-extrabold text-white">{g.actions.length}</span>}
              </span>
              <span className="mt-1 max-w-[130px] truncate rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] font-extrabold text-white">{g.actions.length > 1 ? `${first.label} · +${g.actions.length - 1}` : first.label}</span>
            </button>
          </Html>
        )
      })}
    </>
  )
}
