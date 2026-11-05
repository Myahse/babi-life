import { Box } from '../../../world3d/props'

// The people of the épreuves' crowds (the gare routière, the concert): a person in the game's blocks,
// cheap enough to have twenty or thirty on a phone (a handful of boxes each, no textures). The group's
// first child holds the two legs (for the game to swing from the hips), the second the two arms (from the
// shoulders: raised when dancing); then the shirt, the head and its eyes, a cap, a backpack. `h`: how tall
// (1 ≈ a grown-up), `w`: how broad.

export type BlockLook = { shirt: string; pants: string; skin: string; cap?: string; bag?: string; h: number; w: number }

export function BlockPerson({ shirt, pants, skin, cap, bag, h, w }: BlockLook) {
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
