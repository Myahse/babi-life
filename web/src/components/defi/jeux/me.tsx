import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Look } from '../../../lib/types'
import { Human, NoShadows, type Pose } from '../../../avatar/Human'
import { lookAt } from '../../../avatar/options'
import { DEFAULT_LOOK } from '../Scenes'

// The player's own Sim in the games (the update « avatar-jeux »): the penalty, the free throws, the mic
// are played by it, its real look, in the game's own blocks. The look is given once, round the game
// (JeuDefi); without one (the lab), a Sim of the town.

export type JeuMe = { look: Look; gender: 'femme' | 'homme' }
const Me = createContext<JeuMe | null>(null)
export const JeuMeProvider = ({ me, children }: { me?: JeuMe; children: ReactNode }) => <Me.Provider value={me ?? null}>{children}</Me.Provider>

/** The Sim's height in the sport games: a little smaller than the town's, so the goal and the hoop keep their size beside it. */
export const SIM_SCALE = 0.62

/** The player's Sim, posed; `hold` is in its right hand. */
export function MySim({ pose, hold, p = [0, 0, 0], r = 0, scale = 1, seed = 7 }: { pose: Pose; hold?: ReactNode; p?: [number, number, number]; r?: number; scale?: number; seed?: number }) {
  const me = useContext(Me)
  const look = useMemo(() => lookAt(me?.look ?? DEFAULT_LOOK), [me?.look])
  return (
    <group position={p} rotation={[0, r, 0]} scale={scale}>
      <NoShadows>
        <Human look={look} gender={me?.gender ?? 'homme'} pose={pose} seed={seed} hold={hold} fitted full />
      </NoShadows>
    </group>
  )
}
