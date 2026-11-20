import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Human, NoShadows } from '../../avatar/Human'
import { elderLook } from '../../game/famille'
import type { PublicElder } from '../../lib/types'
import type { XZ } from '../open/geo'
import type { Nav } from '../open/nav'
import { Box } from '../props'
import { whereabouts } from '../whereabouts'
import { useQuartierWorld } from './store'
import type { UniversInfo } from './univers/gen'

// The family's elders in Mon quartier (update « heritage », backend sims/heritage2.go): on a wooden bench on
// the pavement in front of the house, watching the street. Walk up to them and « Saluer » shows in the
// quartier's corner of the HUD (screens/Play.tsx reads `elderNear`). Two at most; once gone « au village »
// the server no longer sends them. A few boxes and one or two Sims: nothing per frame but a distance.

/** Within this of the bench (m), the elders can be greeted. */
const NEAR = 4.5

/** Where the bench stands: on the pavement in front of the house, a little to the side of its path, facing the street. */
function benchSpot(u: UniversInfo, nav: Nav | null): { at: XZ; face: number } {
  const f = u.home
  const d = Math.hypot(f.at[0] - f.street[0], f.at[1] - f.street[1]) || 1
  // o: from the street to the house; s: along the street.
  const [ox, oz] = [(f.at[0] - f.street[0]) / d, (f.at[1] - f.street[1]) / d]
  const [sx, sz] = [-oz, ox]
  const face = Math.atan2(-ox, -oz)
  for (const k of [7, 6.2, 7.8, 5.4])
    for (const side of [2.6, -2.6, 3.4, -3.4]) {
      const x = f.at[0] - ox * k + sx * side
      const z = f.at[1] - oz * k + sz * side
      if (!nav || nav.walkable(x, z)) return { at: [x, z], face }
    }
  return { at: [f.at[0] - ox * 7 + sx * 2.6, f.at[1] - oz * 7 + sz * 2.6], face }
}

/** Whether the Sim is by the bench, looked at twice a second (a store write re-renders the HUD). */
function NearWatch({ at, elder }: { at: XZ; elder: PublicElder }) {
  const last = useRef(0)
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 0.5) return
    last.current = clock.elapsedTime
    const near = Math.hypot(whereabouts.sim[0] - at[0], whereabouts.sim[1] - at[1]) < NEAR
    const cur = useQuartierWorld.getState().elderNear
    if (near && cur?.id !== elder.id) useQuartierWorld.setState({ elderNear: { id: elder.id, name: elder.name } })
    else if (!near && cur) useQuartierWorld.setState({ elderNear: null })
  })
  useEffect(() => () => useQuartierWorld.setState({ elderNear: null }), [])
  return null
}

export function QuartierElders({ u, nav }: { u: UniversInfo; nav: Nav | null }) {
  const elders = useQuartierWorld((q) => (q.active && q.scene === 'lot' && !q.visiting ? q.view?.elders : undefined))
  const spot = useMemo(() => benchSpot(u, nav), [u, nav])
  const shown = useMemo(() => (elders ?? []).slice(0, 2).map((e) => ({ e, look: elderLook({ ...e, stage: e.stage ?? 'senior' }) })), [elders])
  if (!shown.length) return null
  return (
    <group position={[spot.at[0], 0, spot.at[1]]} rotation={[0, spot.face, 0]}>
      {/* The bench: a plank on two feet, its back */}
      <Box p={[0, 0.42, 0]} s={[1.7, 0.07, 0.42]} c="#8a5a32" />
      <Box p={[-0.72, 0.2, 0]} s={[0.08, 0.4, 0.38]} c="#6b4426" />
      <Box p={[0.72, 0.2, 0]} s={[0.08, 0.4, 0.38]} c="#6b4426" />
      <Box p={[0, 0.72, -0.19]} s={[1.7, 0.32, 0.05]} c="#8a5a32" />
      <NoShadows>
        {shown.map(({ e, look }, i) => (
          <group key={e.id} position={[shown.length === 1 ? 0 : i === 0 ? -0.42 : 0.42, 0, 0.02]}>
            <Human look={look} gender={e.gender} pose={i === 0 ? 'sit' : 'sitlaugh'} seed={53 + i} />
          </group>
        ))}
      </NoShadows>
      <NearWatch at={spot.at} elder={shown[0].e} />
    </group>
  )
}
