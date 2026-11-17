import { Box } from '../../../world3d/props'
import { useMondes } from '../../../world3d/mondes'

// The people of the épreuves' crowds (the gare routière, the concert): a person in the game's blocks,
// cheap enough to have twenty or thirty on a phone (a handful of boxes each, no textures). The group's
// first child holds the two legs (for the game to swing from the hips), the second the two arms (from the
// shoulders: raised when dancing); then the shirt, the head and its eyes, a cap, a backpack. `h`: how tall
// (1 ≈ a grown-up), `w`: how broad.

export type BlockLook = { shirt: string; pants: string; skin: string; cap?: string; bag?: string; h: number; w: number }

export function BlockPerson(look: BlockLook) {
  // « Mini-jeux réalistes »: the same person with its anatomy (same groups, so the games still swing them).
  const mondes = useMondes()
  return mondes !== 'off' ? <DetailedPerson {...look} /> : <PlainPerson {...look} />
}

/** Darker or lighter by `k` (a shade of a colour for the seams, the soles, the lips). */
function shade(c: string, k: number) {
  const n = parseInt(c.slice(1), 16)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)))
  return `#${((f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0')}`
}

/**
 * The crowd's person with its anatomy (« mini-jeux réalistes »), still a handful of chamfered blocks:
 * the legs with their shoes, the arms in their sleeves with hands, the belt and the collar, the hair,
 * the ears, the nose, the mouth. The look that tells them apart (shirt, cap, bag) is unchanged.
 */
function DetailedPerson({ shirt, pants, skin, cap, bag, h, w }: BlockLook) {
  const hip = h * 0.62
  const shoulder = hip + h * 0.5
  const head = h * 1.16 + 0.12
  return (
    <>
      <group position={[0, hip, 0]}>
        {[-1, 1].map((sx) => (
          <group key={sx} position={[sx * 0.07 * w, 0, 0]}>
            <Box p={[0, -h * 0.29, 0]} s={[0.1 * w, h * 0.58, 0.11]} c={pants} />
            <Box p={[0, -h * 0.6, 0.025]} s={[0.11 * w, h * 0.05, 0.16]} c="#2b2522" />
            <Box p={[0, -h * 0.617, 0.025]} s={[0.112 * w, 0.015, 0.162]} c="#d8d0c4" />
          </group>
        ))}
      </group>
      <group position={[0, shoulder, 0]}>
        {[-1, 1].map((sx) => (
          <group key={sx} position={[sx * 0.19 * w, 0, 0]}>
            <Box p={[0, -h * 0.08, 0]} s={[0.085, h * 0.17, 0.095]} c={shirt} />
            <Box p={[0, -h * 0.28, 0]} s={[0.065, h * 0.24, 0.075]} c={skin} />
            <Box p={[0, -h * 0.43, 0.005]} s={[0.07, h * 0.07, 0.06]} c={shade(skin, 0.92)} />
          </group>
        ))}
      </group>
      <Box p={[0, hip + h * 0.27, 0]} s={[0.3 * w, h * 0.54, 0.24]} c={shirt} />
      <Box p={[0, hip + h * 0.02, 0]} s={[0.305 * w, h * 0.05, 0.245]} c="#2a2420" />
      <Box p={[0, hip + h * 0.53, 0.06]} s={[0.12, 0.03, 0.13]} c={shade(shirt, 0.8)} />
      <Box p={[0, h * 1.16 + 0.01, 0]} s={[0.09, 0.05, 0.09]} c={skin} />
      <Box p={[0, head, 0]} s={[0.22, 0.24, 0.22]} c={skin} />
      {[-1, 1].map((sx) => (
        <Box key={sx} p={[sx * 0.115, head + 0.01, 0]} s={[0.02, 0.06, 0.04]} c={shade(skin, 0.9)} />
      ))}
      <Box p={[0.05, head + 0.03, 0.111]} s={[0.04, 0.035, 0.01]} c="#111" />
      <Box p={[-0.05, head + 0.03, 0.111]} s={[0.04, 0.035, 0.01]} c="#111" />
      <Box p={[0, head - 0.01, 0.116]} s={[0.035, 0.05, 0.02]} c={shade(skin, 0.88)} />
      <Box p={[0, head - 0.07, 0.111]} s={[0.07, 0.018, 0.01]} c={shade(skin, 0.6)} />
      {cap ? (
        <group>
          <Box p={[0, h * 1.16 + 0.26, 0]} s={[0.24, 0.08, 0.24]} c={cap} />
          <Box p={[0, h * 1.16 + 0.23, 0.15]} s={[0.2, 0.03, 0.12]} c={cap} />
        </group>
      ) : (
        <Box p={[0, head + 0.11, -0.01]} s={[0.23, 0.05, 0.23]} c="#1a1412" />
      )}
      {bag && (
        <group>
          <Box p={[0, hip + h * 0.3, -0.15]} s={[0.24 * w, h * 0.36, 0.13]} c={bag} />
          {[-1, 1].map((sx) => (
            <Box key={sx} p={[sx * 0.1 * w, hip + h * 0.36, 0.0]} s={[0.03, h * 0.4, 0.25]} c={shade(bag, 0.7)} />
          ))}
        </group>
      )}
    </>
  )
}

function PlainPerson({ shirt, pants, skin, cap, bag, h, w }: BlockLook) {
  const hip = h * 0.62
  const shoulder = hip + h * 0.5
  return (
    <>
      {/* Legs, from the hips */}
      <group position={[0, hip, 0]}>
        <group position={[-0.07 * w, 0, 0]}>
          <Box p={[0, -h * 0.31, 0]} s={[0.1 * w, h * 0.62, 0.11]} c={pants} />
        </group>
        <group position={[0.07 * w, 0, 0]}>
          <Box p={[0, -h * 0.31, 0]} s={[0.1 * w, h * 0.62, 0.11]} c={pants} />
        </group>
      </group>
      {/* Arms, from the shoulders */}
      <group position={[0, shoulder, 0]}>
        <group position={[-0.19 * w, 0, 0]}>
          <Box p={[0, -h * 0.22, 0]} s={[0.07, h * 0.44, 0.08]} c={skin} />
        </group>
        <group position={[0.19 * w, 0, 0]}>
          <Box p={[0, -h * 0.22, 0]} s={[0.07, h * 0.44, 0.08]} c={skin} />
        </group>
      </group>
      {/* The shirt, the head */}
      <Box p={[0, hip + h * 0.27, 0]} s={[0.3 * w, h * 0.54, 0.24]} c={shirt} />
      <Box p={[0, h * 1.16 + 0.12, 0]} s={[0.22, 0.24, 0.22]} c={skin} />
      <Box p={[0.05, h * 1.16 + 0.15, 0.111]} s={[0.04, 0.04, 0.01]} c="#111" />
      <Box p={[-0.05, h * 1.16 + 0.15, 0.111]} s={[0.04, 0.04, 0.01]} c="#111" />
      {cap && (
        <group>
          <Box p={[0, h * 1.16 + 0.26, 0]} s={[0.24, 0.08, 0.24]} c={cap} />
          <Box p={[0, h * 1.16 + 0.23, 0.15]} s={[0.2, 0.03, 0.12]} c={cap} />
        </group>
      )}
      {bag && <Box p={[0, hip + h * 0.3, -0.15]} s={[0.24 * w, h * 0.36, 0.13]} c={bag} />}
    </>
  )
}
