import { tint } from '../../avatar/textures'

// The baby's cot (the house inside: HomeInside; the house seen from the street: Walker), where the baby sleeps.

/**
 * The baby's cot, by the family's bed: a mattress raised in a frame of bars,
 * long the way the baby lies (its head towards -z from where it lies, like
 * a Sim in a bed).
 */
export function Crib() {
  const wood = '#d9b48a'
  const bars = []
  for (let k = -0.42; k <= 0.42; k += 0.105) for (const x of [-0.3, 0.3]) bars.push(<Box3 key={`${x}${k}`} p={[x, 0.55, -0.25 + k]} s={[0.025, 0.4, 0.025]} c={wood} />)
  for (let k = -0.22; k <= 0.22; k += 0.11) for (const z of [-0.75, 0.25]) bars.push(<Box3 key={`e${z}${k}`} p={[k, 0.55, z]} s={[0.025, 0.4, 0.025]} c={wood} />)
  return (
    <group>
      {/* The four posts on their feet, the frame under the mattress */}
      {[[-0.31, 0.26], [0.31, 0.26], [-0.31, -0.76], [0.31, -0.76]].map(([x, z], i) => (
        <Box3 key={i} p={[x, 0.39, z]} s={[0.05, 0.78, 0.05]} c={tint(wood, -0.12)} />
      ))}
      <Box3 p={[0, 0.25, -0.25]} s={[0.62, 0.06, 1.02]} c={tint(wood, -0.08)} />
      {/* The mattress and its sheet, the little pillow at the head */}
      <Box3 p={[0, 0.3, -0.25]} s={[0.56, 0.06, 0.96]} c="#f8f9fa" />
      <Box3 p={[0, 0.35, -0.62]} s={[0.3, 0.05, 0.16]} c="#ffc8dd" />
      {/* The bars, and the rail along the top */}
      {bars}
      {[-0.3, 0.3].map((x) => <Box3 key={x} p={[x, 0.76, -0.25]} s={[0.04, 0.04, 1.04]} c={wood} />)}
      {[-0.75, 0.25].map((z) => <Box3 key={z} p={[0, 0.76, z]} s={[0.64, 0.04, 0.04]} c={wood} />)}
    </group>
  )
}

function Box3({ p, s, c }: { p: [number, number, number]; s: [number, number, number]; c: string }) {
  return (
    <mesh position={p} castShadow>
      <boxGeometry args={s} />
      <meshLambertMaterial color={c} />
    </mesh>
  )
}
