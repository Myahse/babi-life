import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { worldTime } from '../../lib/worldClock'
import { keyOpenNow } from '../../lib/features'
import { ESPACE_KEY, LAUNCH_DEFAULTS, launchesBetween, type Launch } from '../../lib/espace'
import { toLocal, type Origin } from './geo'

// The launches seen from the street (the update « espace », lib/espace.ts's timetable): within 300 km of a
// spaceport, for the minutes after a launch, a white plume climbing over the horizon (a glow by night).
// Workstream A's placeholder: C's own (the rumble a little later with the distance, the cargo's) replaces it.

const WITHIN_M = 300_000
const SHOWN_MIN = 6
const SKY_AT = 1500

function Plume({ origin, l, night }: { origin: Origin; l: Launch; night: boolean }) {
  const sp = LAUNCH_DEFAULTS.spaceports.find((s) => s.id === l.spaceport)!
  const at = PADS[sp.id]
  const g = useRef<THREE.Group>(null)
  const [x, z] = useMemo(() => {
    const [px, pz] = toLocal(origin, at[0], at[1])
    // Far off, set on the horizon in its direction.
    const d = Math.hypot(px, pz) || 1
    return [(px / d) * SKY_AT, (pz / d) * SKY_AT]
  }, [origin, at])
  useFrame(() => {
    if (!g.current) return
    const min = worldTime() / 60 - l.at
    g.current.visible = min >= 0 && min < SHOWN_MIN
    const k = Math.max(0, Math.min(1, min / SHOWN_MIN))
    g.current.scale.set(1, 0.05 + k, 1)
  })
  return (
    <group ref={g} position={[x, 0, z]}>
      <mesh position={[0, 300, 0]}>
        <boxGeometry args={[18, 600, 18]} />
        <meshBasicMaterial color={night ? '#ffcf8a' : '#f8f9fa'} transparent opacity={night ? 0.55 : 0.75} fog={false} />
      </mesh>
      <mesh position={[0, 600, 0]}>
        <boxGeometry args={[30, 30, 30]} />
        <meshBasicMaterial color={night ? '#ffb703' : '#ffffff'} fog={false} />
      </mesh>
    </group>
  )
}

// The pads' positions (backend world/espaceTerre.go).
const PADS: Record<string, [number, number]> = {
  sassandra: [4.988, -6.047],
  kourou: [5.255, -52.785],
  'cap-canaveral': [28.49, -80.575],
  baikonour: [45.95, 63.42],
}

/** The launches in sight from here now (asked every few seconds, not every frame). */
export function LaunchSky({ origin, night }: { origin: Origin; night: boolean }) {
  const near = useMemo(() => LAUNCH_DEFAULTS.spaceports.filter((s) => Math.hypot(...toLocal(origin, PADS[s.id][0], PADS[s.id][1])) < WITHIN_M).map((s) => s.id), [origin])
  const minute = Math.floor(worldTime() / 60)
  const shown = useMemo(() => (near.length && keyOpenNow(ESPACE_KEY) ? launchesBetween(minute - SHOWN_MIN - 60, minute + 60).filter((l) => near.includes(l.spaceport) && !l.scrub) : []), [near, Math.floor(minute / 30)]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {shown.map((l) => (
        <Plume key={`${l.spaceport}:${l.at}:${l.crewed}`} origin={origin} l={l} night={night} />
      ))}
    </>
  )
}
