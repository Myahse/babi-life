import type { Look } from '../../lib/types'

// The Astrélia spacesuit in blocks (the spacewalk, the Moon's and Mars's walks): white, the agency's orange
// bands, the oxygen pack on the back, the helmet's gold visor raised enough to see the face. It fits every look:
// whatever the hairdo it goes under the helmet, and a hijab or a turban becomes a soft hood in its own colour,
// worn under the helmet round the face. About the height of a grown-up Sim (2.1 units).

const WHITE = '#f4f5f2'
const GREY = '#c9ccd1'
const ORANGE = '#ff7a00'

/** The hood's colour under the helmet (a hijab, a turban), or null (the hair just goes under). */
export function hoodOf(look?: Look): string | null {
  if (!look) return null
  if (look.hair === 'hijab' || look.hair === 'turban' || look.hair === 'covered' || look.hair === 'headwrap') return look.wrapColor || look.outfitColor || '#334155'
  return null
}

export function Combinaison({ look, walk = 0, reach = 0, empty = false, sit = false }: { look?: Look; /** The legs' swing (-1..1). */ walk?: number; /** The right arm raised (0..1): holding on, fixing. */ reach?: number; /** Hung on its rack, nobody in it. */ empty?: boolean; /** Sitting (a rover's seat): the thighs forward at the hips' height (0.85), the shins down to the floor, both hands forward on the controls. */ sit?: boolean }) {
  const hood = hoodOf(look)
  const skin = look?.skin ?? '#8d5524'
  return (
    <group>
      {/* Sitting: the thighs forward, the shins down, the boots flat on the floor */}
      {sit &&
        [-1, 1].map((s) => (
          <group key={s} position={[s * 0.2, 0, 0]}>
            <mesh position={[0, 0.85, 0.2]}>
              <boxGeometry args={[0.3, 0.32, 0.56]} />
              <meshLambertMaterial color={WHITE} />
            </mesh>
            <mesh position={[0, 0.5, 0.42]}>
              <boxGeometry args={[0.3, 0.62, 0.32]} />
              <meshLambertMaterial color={WHITE} />
            </mesh>
            <mesh position={[0, 0.42, 0.42]}>
              <boxGeometry args={[0.32, 0.08, 0.34]} />
              <meshLambertMaterial color={ORANGE} />
            </mesh>
            <mesh position={[0, 0.1, 0.48]}>
              <boxGeometry args={[0.34, 0.14, 0.42]} />
              <meshLambertMaterial color={GREY} />
            </mesh>
          </group>
        ))}
      {/* Legs and boots */}
      {!sit && [-1, 1].map((s) => (
        <group key={s} position={[s * 0.2, 0.85, 0]} rotation={[s * walk * 0.5, 0, 0]}>
          <mesh position={[0, -0.42, 0]}>
            <boxGeometry args={[0.3, 0.8, 0.32]} />
            <meshLambertMaterial color={WHITE} />
          </mesh>
          <mesh position={[0, -0.5, 0]}>
            <boxGeometry args={[0.32, 0.08, 0.34]} />
            <meshLambertMaterial color={ORANGE} />
          </mesh>
          <mesh position={[0, -0.82, 0.04]}>
            <boxGeometry args={[0.34, 0.14, 0.42]} />
            <meshLambertMaterial color={GREY} />
          </mesh>
        </group>
      ))}
      {/* Body, its chest box, the agency's band */}
      <mesh position={[0, 1.22, 0]}>
        <boxGeometry args={[0.72, 0.8, 0.46]} />
        <meshLambertMaterial color={WHITE} />
      </mesh>
      <mesh position={[0, 1.12, 0.24]}>
        <boxGeometry args={[0.36, 0.22, 0.06]} />
        <meshLambertMaterial color={GREY} />
      </mesh>
      {[0.12, 0.04].map((y, i) => (
        <mesh key={y} position={[i ? 0.1 : -0.1, 1.12 + y - 0.06, 0.28]}>
          <boxGeometry args={[0.06, 0.06, 0.02]} />
          <meshBasicMaterial color={i ? '#2ecc71' : '#e03131'} />
        </mesh>
      ))}
      <mesh position={[0, 1.42, 0]}>
        <boxGeometry args={[0.74, 0.08, 0.48]} />
        <meshLambertMaterial color={ORANGE} />
      </mesh>
      {/* The oxygen pack */}
      <mesh position={[0, 1.25, -0.36]}>
        <boxGeometry args={[0.62, 0.78, 0.26]} />
        <meshLambertMaterial color={GREY} />
      </mesh>
      {/* Arms (the right one may reach up) */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.46, 1.52, 0]} rotation={[sit ? -1.05 : s > 0 ? -reach * 2.2 : -walk * 0.4, 0, sit ? s * 0.04 : s * 0.12]}>
          <mesh position={[0, -0.34, 0]}>
            <boxGeometry args={[0.24, 0.68, 0.26]} />
            <meshLambertMaterial color={WHITE} />
          </mesh>
          <mesh position={[0, -0.72, 0]}>
            <boxGeometry args={[0.26, 0.16, 0.26]} />
            <meshLambertMaterial color={GREY} />
          </mesh>
        </group>
      ))}
      {/* The helmet: the face (or the hood round it) behind the visor */}
      <group position={[0, 1.88, 0]}>
        <mesh>
          <boxGeometry args={[0.6, 0.56, 0.58]} />
          <meshLambertMaterial color={WHITE} />
        </mesh>
        {!empty && hood && (
          <mesh position={[0, 0, 0.27]}>
            <boxGeometry args={[0.44, 0.42, 0.04]} />
            <meshLambertMaterial color={hood} />
          </mesh>
        )}
        {!empty && (
          <mesh position={[0, -0.02, 0.29]}>
            <boxGeometry args={hood ? [0.28, 0.28, 0.04] : [0.42, 0.36, 0.04]} />
            <meshLambertMaterial color={skin} />
          </mesh>
        )}
        {!empty &&
          [-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.07, 0.03, 0.315]}>
              <boxGeometry args={[0.05, 0.05, 0.01]} />
              <meshBasicMaterial color="#1b1b1b" />
            </mesh>
          ))}
        {/* The visor's glass, and its gold shade raised on top */}
        <mesh position={[0, -0.02, 0.33]}>
          <boxGeometry args={[0.5, 0.4, 0.02]} />
          <meshLambertMaterial color={empty ? '#c9a227' : '#9bd1ff'} transparent opacity={empty ? 0.95 : 0.28} />
        </mesh>
        <mesh position={[0, 0.22, 0.3]}>
          <boxGeometry args={[0.52, 0.1, 0.06]} />
          <meshLambertMaterial color="#c9a227" />
        </mesh>
        <mesh position={[0.32, 0.12, 0]}>
          <boxGeometry args={[0.06, 0.1, 0.1]} />
          <meshBasicMaterial color="#fff3bf" />
        </mesh>
      </group>
    </group>
  )
}

function Bloc({ p, s, c, glow }: { p: [number, number, number]; s: [number, number, number]; c: string; glow?: boolean }) {
  return (
    <mesh position={p}>
      <boxGeometry args={s} />
      {glow ? <meshBasicMaterial color={c} toneMapped={false} /> : <meshLambertMaterial color={c} />}
    </mesh>
  )
}

/**
 * A rover's driving seat and its controls, in the suit's own units (in the same group as a sitting Combinaison,
 * its origin on the floor): the padded seat at the hips' height, its high back behind the oxygen pack, the
 * console in front with its screen and the yoke under both hands.
 */
export function SiegePilote() {
  return (
    <group>
      {/* The seat: its frame, its cushion, its back and headrest, an orange strap across */}
      <Bloc p={[0, 0.3, -0.13]} s={[0.9, 0.6, 0.6]} c="#495057" />
      <Bloc p={[0, 0.64, -0.13]} s={[1.0, 0.1, 0.74]} c="#343a40" />
      <Bloc p={[0, 1.28, -0.58]} s={[1.0, 1.2, 0.16]} c="#343a40" />
      <Bloc p={[0, 1.98, -0.6]} s={[0.56, 0.3, 0.14]} c="#495057" />
      <Bloc p={[0, 1.4, -0.49]} s={[1.02, 0.1, 0.04]} c={ORANGE} />
      {/* The console: its screen (the map of the crater), its lamps, the yoke on its column */}
      <Bloc p={[0, 0.6, 1.0]} s={[1.1, 1.2, 0.36]} c={GREY} />
      <Bloc p={[0, 1.22, 1.0]} s={[1.14, 0.06, 0.4]} c="#868e96" />
      <Bloc p={[0, 0.95, 0.81]} s={[0.6, 0.32, 0.02]} c="#66d9e8" glow />
      <Bloc p={[-0.38, 0.95, 0.81]} s={[0.08, 0.08, 0.02]} c="#51cf66" glow />
      <Bloc p={[0.38, 0.95, 0.81]} s={[0.08, 0.08, 0.02]} c="#ffd43b" glow />
      <Bloc p={[0, 1.2, 0.76]} s={[0.1, 0.1, 0.24]} c="#495057" />
      <Bloc p={[0, 1.18, 0.63]} s={[0.86, 0.08, 0.08]} c="#212529" />
    </group>
  )
}
