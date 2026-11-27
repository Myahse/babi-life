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

export function Combinaison({ look, walk = 0, reach = 0, empty = false }: { look?: Look; /** The legs' swing (-1..1). */ walk?: number; /** The right arm raised (0..1): holding on, fixing. */ reach?: number; /** Hung on its rack, nobody in it. */ empty?: boolean }) {
  const hood = hoodOf(look)
  const skin = look?.skin ?? '#8d5524'
  return (
    <group>
      {/* Legs and boots */}
      {[-1, 1].map((s) => (
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
        <group key={s} position={[s * 0.46, 1.52, 0]} rotation={[s > 0 ? -reach * 2.2 : -walk * 0.4, 0, s * 0.12]}>
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
