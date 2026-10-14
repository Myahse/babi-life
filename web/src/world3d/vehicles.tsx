import * as THREE from 'three'
import { Human, NoShadows } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import { Mat } from './props'

// Abidjan's traffic, modelled on what drives there: the woro-woro and the
// orange taxi compteur are small saloons (Corolla-style), the gbaka a Hiace-
// type minibus with its roof rack and its apprenti at the open door, private
// cars are saloons or SUVs, and the motos the cheap Chinese bikes, with their
// rider. Bodies are side profiles extruded across the width. Real size, in
// metres, nose towards +x.

export type VehicleKind = 'taxi' | 'woro' | 'gbaka' | 'car' | 'moto'

type Pt = [number, number]
type Model = { body: THREE.BufferGeometry; glass: THREE.BufferGeometry; len: number; wide: number; wheelX: number; wheelR: number; pillars: number[] }

const cache = new Map<string, Model>()

function extrude(points: Pt[], depth: number, bevel = 0.05) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)))
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 4 })
  g.translate(0, 0, -depth / 2)
  g.computeVertexNormals()
  return g
}

function model(type: 'saloon' | 'suv' | 'minibus'): Model {
  const hit = cache.get(type)
  if (hit) return hit
  let m: Model
  if (type === 'saloon') {
    // Boot, rear window, roof, windscreen, bonnet.
    const wide = 1.66
    m = {
      len: 4.4,
      wide,
      wheelX: 1.32,
      wheelR: 0.31,
      pillars: [-0.28],
      body: extrude([[-2.2, 0.32], [-2.2, 0.82], [-2.08, 0.95], [-1.35, 1.0], [-0.85, 1.42], [0.32, 1.44], [0.98, 1.0], [2.04, 0.86], [2.2, 0.66], [2.2, 0.32]], wide),
      glass: extrude([[-1.28, 1.02], [-0.82, 1.38], [0.3, 1.4], [0.93, 1.02]], wide + 0.2, 0),
    }
  } else if (type === 'suv') {
    const wide = 1.82
    m = {
      len: 4.6,
      wide,
      wheelX: 1.45,
      wheelR: 0.37,
      pillars: [-1.0, 0.05],
      body: extrude([[-2.3, 0.42], [-2.3, 1.05], [-2.22, 1.78], [0.62, 1.8], [1.25, 1.12], [2.24, 0.98], [2.3, 0.78], [2.3, 0.42]], wide),
      glass: extrude([[-2.15, 1.18], [-2.1, 1.7], [0.58, 1.72], [1.15, 1.14]], wide + 0.2, 0),
    }
  } else {
    // A Hiace-type minibus: box body, short sloping nose.
    const wide = 1.9
    m = {
      len: 5.3,
      wide,
      wheelX: 1.75,
      wheelR: 0.34,
      pillars: [-1.6, -0.5, 0.6],
      body: extrude([[-2.65, 0.38], [-2.65, 2.0], [1.9, 2.02], [2.55, 1.2], [2.65, 0.95], [2.65, 0.38]], wide, 0.06),
      glass: extrude([[-2.5, 1.28], [-2.5, 1.86], [1.84, 1.88], [2.42, 1.28]], wide + 0.2, 0),
    }
  }
  cache.set(type, m)
  return m
}

function Wheels({ x, r, wide }: { x: number; r: number; wide: number }) {
  return (
    <>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`} position={[sx * x, r, sz * (wide / 2 - 0.06)]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh>
              <cylinderGeometry args={[r, r, 0.22, 14]} />
              <Mat color="#1b1b20" />
            </mesh>
            <mesh position={[0, sz * -0.115, 0]}>
              <cylinderGeometry args={[r * 0.55, r * 0.55, 0.02, 12]} />
              <Mat color="#c3c7cf" />
            </mesh>
          </group>
        )),
      )}
    </>
  )
}

/** Lights, bumpers, plates and mirrors, at both ends. */
function Trim({ len, wide, y, mirrorX, mirrorY }: { len: number; wide: number; y: number; mirrorX: number; mirrorY: number }) {
  const h = len / 2
  return (
    <>
      {/* Bumpers */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (h + 0.04), 0.42, 0]}>
          <boxGeometry args={[0.1, 0.2, wide - 0.08]} />
          <Mat color="#2b2f36" />
        </mesh>
      ))}
      {/* Headlights and tail lights */}
      {[-1, 1].map((sz) => (
        <group key={sz}>
          <mesh position={[h + 0.03, y, sz * (wide / 2 - 0.25)]}>
            <boxGeometry args={[0.06, 0.13, 0.3]} />
            <Mat color="#fff6cc" emissive="#fff6cc" intensity={0.6} />
          </mesh>
          <mesh position={[-h - 0.03, y, sz * (wide / 2 - 0.22)]}>
            <boxGeometry args={[0.06, 0.12, 0.26]} />
            <Mat color="#d7263d" emissive="#d7263d" intensity={0.4} />
          </mesh>
          {/* Mirrors */}
          <mesh position={[mirrorX, mirrorY, sz * (wide / 2 + 0.1)]}>
            <boxGeometry args={[0.12, 0.1, 0.12]} />
            <Mat color="#1b1b20" />
          </mesh>
        </group>
      ))}
      {/* Grille and plates (white, black letters) */}
      <mesh position={[h + 0.035, y - 0.05, 0]}>
        <boxGeometry args={[0.04, 0.16, 0.6]} />
        <Mat color="#1b1b20" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (h + 0.1), 0.42, 0]}>
          <boxGeometry args={[0.02, 0.11, 0.42]} />
          <Mat color="#f4f4f4" />
        </mesh>
      ))}
    </>
  )
}

function Car4({ type, body, trim, roofSign }: { type: 'saloon' | 'suv'; body: string; trim?: string; roofSign?: boolean }) {
  const m = model(type)
  return (
    <group>
      <mesh geometry={m.body} castShadow>
        <Mat color={body} />
      </mesh>
      <mesh geometry={m.glass}>
        <Mat color="#26303d" />
      </mesh>
      {/* Door pillars over the glass */}
      {m.pillars.map((x) => (
        <mesh key={x} position={[x, type === 'suv' ? 1.44 : 1.2, 0]}>
          <boxGeometry args={[0.1, type === 'suv' ? 0.56 : 0.4, m.wide + 0.22]} />
          <Mat color={body} />
        </mesh>
      ))}
      {/* A woro-woro's lower band in a second colour (Abobo, Port-Bouët) */}
      {trim && (
        <mesh position={[0, 0.42, 0]}>
          <boxGeometry args={[m.len - 0.15, 0.2, m.wide + 0.16]} />
          <Mat color={trim} />
        </mesh>
      )}
      {/* The taxi compteur's sign */}
      {roofSign && (
        <mesh position={[-0.25, 1.57, 0]}>
          <boxGeometry args={[0.55, 0.18, 0.3]} />
          <Mat color="#ffe066" emissive="#ffe066" intensity={0.3} />
        </mesh>
      )}
      <Wheels x={m.wheelX} r={m.wheelR} wide={m.wide} />
      <Trim len={m.len} wide={m.wide} y={type === 'suv' ? 0.85 : 0.72} mirrorX={type === 'suv' ? 1.1 : 0.9} mirrorY={type === 'suv' ? 1.18 : 1.02} />
    </group>
  )
}

// The gbaka's apprenti hangs out of the sliding door, calling the stops and
// waving at people on the sidewalk.
const APPRENTI = { ...randomLook('homme', () => 0.37), outfit: 'jersey', outfitColor: '#ff8200', hair: 'short', accessory: 'capback' }

function Gbaka({ body, stripe }: { body: string; stripe: string }) {
  const m = model('minibus')
  return (
    <group>
      <mesh geometry={m.body} castShadow>
        <Mat color={body} />
      </mesh>
      <mesh geometry={m.glass}>
        <Mat color="#26303d" />
      </mesh>
      {m.pillars.map((x) => (
        <mesh key={x} position={[x, 1.57, 0]}>
          <boxGeometry args={[0.1, 0.6, m.wide + 0.22]} />
          <Mat color={body} />
        </mesh>
      ))}
      {/* The painted band along the side */}
      <mesh position={[-0.2, 1.08, 0]}>
        <boxGeometry args={[m.len - 0.5, 0.18, m.wide + 0.16]} />
        <Mat color={stripe} />
      </mesh>
      {/* The sliding door, always open */}
      <mesh position={[0.95, 1.1, m.wide / 2 + 0.08]}>
        <boxGeometry args={[0.95, 1.45, 0.04]} />
        <Mat color="#151820" />
      </mesh>
      {/* Roof rack and luggage */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[-0.4, 2.12, s * 0.8]}>
          <boxGeometry args={[3.6, 0.06, 0.06]} />
          <Mat color="#3a3f4b" />
        </mesh>
      ))}
      {[[-1.5, '#7a5230', 0.5], [-0.6, '#2a6cf0', 0.35], [0.4, '#c92a2a', 0.45]].map(([x, c, h]) => (
        <mesh key={x as number} position={[x as number, 2.08 + (h as number) / 2, 0]}>
          <boxGeometry args={[0.8, h as number, 1.2]} />
          <Mat color={c as string} />
        </mesh>
      ))}
      <Wheels x={m.wheelX} r={m.wheelR} wide={m.wide} />
      <Trim len={m.len} wide={m.wide} y={0.82} mirrorX={2.2} mirrorY={1.3} />
      <NoShadows>
        <group position={[1.0, 0.55, m.wide / 2 + 0.32]} rotation={[0, Math.PI / 2, -0.22]}>
          <Human look={APPRENTI} gender="homme" pose="wave" seed={2} />
        </group>
      </NoShadows>
    </group>
  )
}

const RIDER = { ...randomLook('homme', () => 0.81), outfit: 'casual', accessory: 'cap' }

function Moto({ color }: { color: string }) {
  return (
    <group>
      {[-0.62, 0.62].map((x) => (
        <group key={x} position={[x, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.3, 0.3, 0.1, 14]} />
            <Mat color="#1b1b20" />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.12, 0.12, 0.11, 8]} />
            <Mat color="#c3c7cf" />
          </mesh>
        </group>
      ))}
      {/* Frame, tank, seat, fork, handlebar, headlight */}
      <mesh position={[0, 0.55, 0]} rotation={[0, 0, 0.12]}>
        <boxGeometry args={[1.05, 0.12, 0.12]} />
        <Mat color="#3a3f4b" />
      </mesh>
      <mesh position={[0.18, 0.78, 0]}>
        <boxGeometry args={[0.45, 0.22, 0.3]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[-0.32, 0.8, 0]}>
        <boxGeometry args={[0.6, 0.1, 0.28]} />
        <Mat color="#1b1b20" />
      </mesh>
      <mesh position={[0.56, 0.72, 0]} rotation={[0, 0, -0.35]}>
        <boxGeometry args={[0.06, 0.8, 0.06]} />
        <Mat color="#c3c7cf" />
      </mesh>
      <mesh position={[0.68, 1.08, 0]}>
        <boxGeometry args={[0.06, 0.05, 0.66]} />
        <Mat color="#1b1b20" />
      </mesh>
      <mesh position={[0.74, 0.92, 0]}>
        <boxGeometry args={[0.08, 0.12, 0.16]} />
        <Mat color="#fff6cc" emissive="#fff6cc" intensity={0.6} />
      </mesh>
      {/* The rider, seated, hands on the bars */}
      <NoShadows>
        <group position={[-0.25, 0.42, 0]} rotation={[0, Math.PI / 2, 0]}>
          <Human look={RIDER} gender="homme" pose="sit" seed={4} />
        </group>
      </NoShadows>
    </group>
  )
}

/** Abidjan's traffic: orange taxi compteur, woro-woro, gbaka, cars and motos. */
export function Vehicle({ p, r = 0, kind = 'taxi', color, trim, seed = 0 }: { p: [number, number, number]; r?: number; kind?: VehicleKind; color?: string; trim?: string; seed?: number }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      {kind === 'moto' ? (
        <Moto color={color ?? '#c92a2a'} />
      ) : kind === 'gbaka' ? (
        <Gbaka body={color ?? '#f4c430'} stripe={trim ?? '#00a862'} />
      ) : kind === 'car' ? (
        <Car4 type={seed % 3 === 0 ? 'suv' : 'saloon'} body={color ?? '#e9ecef'} />
      ) : (
        <Car4 type="saloon" body={color ?? (kind === 'taxi' ? '#ff7a00' : '#e9ecef')} trim={kind === 'woro' ? trim : undefined} roofSign={kind === 'taxi'} />
      )}
    </group>
  )
}
