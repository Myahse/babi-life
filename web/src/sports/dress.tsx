import * as THREE from 'three'
import { AdBoards, B, Bag, Bottle, Chair, Cooler, Decal, Dressing, FenceRun, footprintsMat, lineWearMat, M, steelMat, Towel, wornMat } from '../streetball/decor'
import { DW, HL, POST_X, SERVICE } from './tennis'
import type { Volley } from './volley'

// « Mini-jeux réalistes », phase 2: tennis and volley's sets (streetball/decor.tsx's props), drawn
// only while the update is open. Outside the lines or flat on the ground: the play is untouched.

const ballMat = new THREE.MeshLambertMaterial({ color: '#d8f03c' })

/** The ball basket on its legs by the net: a wire cage full of balls. */
function BallBasket({ p }: { p: [number, number, number] }) {
  const wire = steelMat('#3d4249')
  return (
    <group position={p}>
      {[-0.17, 0.17].flatMap((x) => [-0.17, 0.17].map((z) => <B key={`${x}${z}`} p={[x, 0.35, z]} s={[0.02, 0.7, 0.02]} m={wire} cast={false} />))}
      {[0.42, 0.7].map((y) => (
        <group key={y}>
          <B p={[0, y, -0.17]} s={[0.36, 0.015, 0.015]} m={wire} cast={false} />
          <B p={[0, y, 0.17]} s={[0.36, 0.015, 0.015]} m={wire} cast={false} />
          <B p={[-0.17, y, 0]} s={[0.015, 0.015, 0.36]} m={wire} cast={false} />
          <B p={[0.17, y, 0]} s={[0.015, 0.015, 0.36]} m={wire} cast={false} />
        </group>
      ))}
      {[...Array(9)].map((_, i) => (
        <mesh key={i} position={[((i % 3) - 1) * 0.1, 0.47 + Math.floor(i / 3) * 0.06, (Math.floor(i / 3) - 1) * 0.1 + (i % 2) * 0.03]} material={ballMat}>
          <sphereGeometry args={[0.034, 8, 6]} />
        </mesh>
      ))}
    </group>
  )
}

/** The tennis court's set: the chain-link over the windscreens, the players' bags, bottles and towels at their chairs, the ball basket, the boards behind the far baseline, the clay scuffed where the players slide (or the hard court's lines worn). */
export function TennisSet({ clay }: { clay: boolean }) {
  const fx = DW + 3.66
  const fz = HL + 6.4
  const ground = clay ? '#c1532c' : '#2c5aa0'
  return (
    <Dressing>
      {(tier) => (
        <>
          {/* The fence over the windscreens: the far end and both sides (the near end is under the camera). */}
          <FenceRun a={[-fx, -fz - 0.05]} b={[fx, -fz - 0.05]} h={3.6} post="#1e4d2b" />
          <FenceRun a={[-fx - 0.05, -fz]} b={[-fx - 0.05, fz]} h={3.6} post="#1e4d2b" />
          <FenceRun a={[fx + 0.05, -fz]} b={[fx + 0.05, fz]} h={3.6} post="#1e4d2b" />
          <AdBoards a={[-7, -fz + 1.4]} b={[7, -fz + 1.4]} h={0.7} len={3.5} seed={1} />
          {/* At the players' chairs (by the umpire): racket bags, bottles, a towel, the cooler */}
          {[-1.6, 1.6].map((z, i) => (
            <group key={z} position={[-(POST_X + 1.5), 0, z]}>
              <Bag p={[-0.55, 0, 0]} rot={Math.PI / 2} c={i ? '#1d4ed8' : '#e03131'} band="#f8f9fa" />
              {tier !== 'simple' && (
                <>
                  <Bottle p={[0.4, 0, 0.35 * (i ? 1 : -1)]} k={i} />
                  <Bottle p={[0.45, 0, 0.5 * (i ? 1 : -1)]} k={i + 2} />
                  <Towel p={[0, 0.5, -0.3]} rot={Math.PI / 2} c="#f8f9fa" />
                </>
              )}
            </group>
          ))}
          {tier !== 'simple' && <Cooler p={[-(POST_X + 1.6), 0, 3.2]} rot={1.4} c="#2b8a3e" />}
          <BallBasket p={[POST_X + 0.6, 0, -2.2]} />
          {/* Where the players run and slide: behind the baselines' middle, the service boxes' corners */}
          {[-1, 1].map((s) => (
            <group key={s}>
              <Decal p={[0, 0.0105, s * (HL + 0.9)]} w={5} d={2.2} m={wornMat(clay ? '#9e3f1c' : '#244c88')} />
              {tier !== 'simple' && <Decal p={[s * 1.5, 0.0105, s * (SERVICE + 0.8)]} w={2} d={1.6} m={wornMat(clay ? '#a8441f' : '#27508f')} />}
            </group>
          ))}
          {!clay && <Decal p={[0, 0.0142, -HL]} w={DW * 2} d={0.1} m={lineWearMat(ground)} />}
          {!clay && <Decal p={[0, 0.0142, HL]} w={DW * 2} d={0.1} m={lineWearMat(ground)} />}
        </>
      )}
    </Dressing>
  )
}

/** Volley's set: on the beach the sand trodden all over, the bags and towels, chairs, a cooler; in the Palais the benches' bags, bottles and towels, boards along the sides. */
export function VolleySet({ g }: { g: Volley }) {
  const { hw, hl } = g
  const beach = !!g.rules.beach
  return (
    <Dressing>
      {(tier) =>
        beach ? (
          <>
            <Decal p={[0, 0.006, 0]} w={hw * 2 + 6} d={hl * 2 + 6} m={footprintsMat()} tile={4} />
            <Bag p={[hw + 2.2, 0, -2]} rot={0.6} c="#e8590c" band="#ffffff" />
            <Bag p={[hw + 2.4, 0, 2.6]} rot={-0.4} c="#1d4ed8" band="#ffd43b" open />
            <Towel p={[hw + 3, 0.001, 0.4]} rot={0.3} c="#ff8787" />
            <Chair p={[hw + 3.4, 0, -4]} rot={-Math.PI / 2} c="#f1f3f5" />
            {tier !== 'simple' && (
              <>
                <Towel p={[hw + 3.2, 0.001, -1]} rot={-0.2} c="#4dabf7" />
                <Cooler p={[hw + 2.6, 0, 4.5]} rot={0.8} c="#e03131" />
                <Bottle p={[hw + 2, 0, 3.4]} k={0} />
                <Bottle p={[hw + 2.1, 0.035, 3.7]} k={3} down />
                <Chair p={[hw + 3.6, 0, -5.2]} rot={-Math.PI / 2 - 0.3} c="#fcc419" />
                {/* Sandals left at the line */}
                <B p={[hw + 1.3, 0.015, -0.6]} s={[0.1, 0.03, 0.26]} m={M('#212529')} cast={false} />
                <B p={[hw + 1.45, 0.015, -0.55]} s={[0.1, 0.03, 0.26]} m={M('#212529')} r={[0, 0.4, 0]} cast={false} />
              </>
            )}
          </>
        ) : (
          <>
            {[-1, 1].map((s) => (
              <group key={s} position={[hw + 2.6, 0, s * 5]}>
                {[-1.4, 0, 1.4].map((z) => (
                  <Bag key={z} p={[0.6, 0, z]} rot={Math.PI / 2} c="#141416" band={s > 0 ? '#f77f00' : '#15803d'} />
                ))}
                {tier !== 'simple' &&
                  [-1.6, -0.6, 0.4, 1.4].map((z, k) => (
                    <group key={z}>
                      <Towel p={[0, 0.5, z]} rot={Math.PI / 2} c={k % 2 ? '#f8f9fa' : s > 0 ? '#f77f00' : '#15803d'} />
                      <Bottle p={[-0.45, 0, z + 0.2]} k={k} />
                    </group>
                  ))}
              </group>
            ))}
            <AdBoards a={[-hw - 2.2, hl + 1]} b={[-hw - 2.2, -hl - 1]} h={0.9} len={3} seed={2} />
            <AdBoards a={[-hw - 1, -hl - 3.2]} b={[hw + 1, -hl - 3.2]} h={0.9} len={3} seed={5} />
          </>
        )
      }
    </Dressing>
  )
}
