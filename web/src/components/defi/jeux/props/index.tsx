import type { PropId } from '../types'
import { PROPS_A } from './partA'
import { PROPS_B } from './partB'
import { PROPS_C } from './partC'

// The games' 3D objects, all of them: in the game's own blocks (world3d/props Box, flat-shaded Lambert),
// about one unit across, standing on y = 0, centred, the front to +z.

const PROPS: Partial<Record<PropId, () => React.ReactElement>> = { ...PROPS_A, ...PROPS_B, ...PROPS_C }

/** One object of the games, by its id (a grey block if it's not made yet). */
export function Prop({ id }: { id: PropId }) {
  const P = PROPS[id]
  if (P) return <P />
  return (
    <mesh position={[0, 0.3, 0]}>
      <boxGeometry args={[0.6, 0.6, 0.6]} />
      <meshLambertMaterial color="#adb5bd" />
    </mesh>
  )
}
