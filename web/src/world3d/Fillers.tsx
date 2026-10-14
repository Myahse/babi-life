import { useMemo } from 'react'
import * as THREE from 'three'
import { rng, type Filler } from './themes'
import { Box, Mat, Palm, Sign, Tree } from './props'
import { Vehicle } from './vehicles'

// The buildings that fill a commune around the places you can visit. Each
// fits a 14 m lot centred on the origin, front (+Z) facing its street, and
// varies with its seed so no two streets look the same.

type P = { seed: number; night: boolean; height: number }
const PASTEL = ['#f6d7a7', '#f4b6a6', '#b8e0d2', '#d6c2f0', '#fbe39b', '#a9d6f5', '#f7c6d9', '#c7e9b0', '#ffd8a8']
const BRIGHT = ['#ff7a00', '#00a862', '#2a6cf0', '#d6336c', '#7b5cff', '#f2b705', '#e8590c']
const SIGNS = ['ALIMENTATION', 'CABINE', 'PHARMACIE', 'COIFFURE', 'MOBILE MONEY', 'QUINCAILLERIE', 'BOUTIQUE', 'GARBADROME', 'COUTURE', 'TELEPHONE', 'PRESSING', 'BOULANGERIE']
const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length)]

/* ---------- Facade textures ---------- */

const texCache = new Map<string, THREE.CanvasTexture>()
function facade(kind: 'glass' | 'concrete' | 'lit', base: string) {
  const key = `${kind}|${base}`
  let t = texCache.get(key)
  if (t) return t
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = kind === 'lit' ? '#000' : base
  g.fillRect(0, 0, 128, 128)
  const r = rng(key)
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      if (kind === 'glass') {
        g.fillStyle = (x + y) % 3 ? '#9fd3f2' : '#7dbbe6'
        g.fillRect(x * 32 + 2, y * 32 + 3, 28, 26)
        g.fillStyle = 'rgba(255,255,255,0.35)'
        g.fillRect(x * 32 + 4, y * 32 + 5, 8, 22)
      } else if (kind === 'concrete') {
        g.fillStyle = '#5c7b99'
        g.fillRect(x * 32 + 8, y * 32 + 9, 16, 15)
      } else if (r() < 0.45) {
        g.fillStyle = r() < 0.7 ? '#ffd27a' : '#fff1c1'
        g.fillRect(x * 32 + (base === 'glass' ? 2 : 8), y * 32 + (base === 'glass' ? 3 : 9), base === 'glass' ? 28 : 16, base === 'glass' ? 26 : 15)
      }
    }
  t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  texCache.set(key, t)
  return t
}

/** A box whose four sides show a repeating facade (windows lit at night). */
function Facade({ p, s, kind, base, night }: { p: [number, number, number]; s: [number, number, number]; kind: 'glass' | 'concrete'; base: string; night: boolean }) {
  const mats = useMemo(() => {
    const per = kind === 'glass' ? 3.4 : 3.2 // metres per window row/column
    const make = (w: number) => {
      const map = facade(kind, base).clone()
      map.repeat.set(w / (per * 4), s[1] / (per * 4))
      map.needsUpdate = true
      const lit = facade('lit', kind).clone()
      lit.repeat.copy(map.repeat)
      lit.needsUpdate = true
      return new THREE.MeshLambertMaterial({ map, emissive: night ? '#ffffff' : '#000000', emissiveMap: lit, emissiveIntensity: night ? 1 : 0 })
    }
    const side = make(s[2])
    const front = make(s[0])
    const roof = new THREE.MeshLambertMaterial({ color: '#8d99a6' })
    return [side, side, roof, roof, front, front]
  }, [kind, base, night, s])
  return (
    <mesh position={p} material={mats} castShadow receiveShadow>
      <boxGeometry args={s} />
    </mesh>
  )
}

/* ---------- Building types ---------- */

function Tower({ seed, night, height }: P) {
  const r = rng(`t${seed}`)
  const h = (22 + r() * 34) * height
  const w = 8 + r() * 3
  const d = 8 + r() * 3
  return (
    <group>
      <Box p={[0, 1.6, 0]} s={[w + 2, 3.2, d + 2]} c="#e9ecef" />
      <Facade p={[0, 3.2 + h / 2, 0]} s={[w, h, d]} kind="glass" base={pick(r, ['#2f5f8a', '#3d6e75', '#46505e'])} night={night} />
      {r() < 0.5 ? <Box p={[0, 3.4 + h, 0]} s={[w * 0.6, 2.4, d * 0.6]} c="#c9d3dc" /> : <Box p={[0, 3.2 + h + 2.5, 0]} s={[0.25, 5, 0.25]} c="#868e96" />}
      <Box p={[0, 1.3, d / 2 + 1.02]} s={[3.2, 2.6, 0.1]} c="#16324f" />
    </group>
  )
}

function OfficeBlock({ seed, night, height }: P) {
  const r = rng(`o${seed}`)
  const floors = Math.max(2, Math.round((3 + Math.floor(r() * 5)) * Math.min(height, 1.2)))
  const h = floors * 3.2
  return (
    <group>
      <Facade p={[0, h / 2, -0.5]} s={[11, h, 9]} kind="concrete" base={pick(r, ['#e7e1d6', '#d8dee6', '#f1e3c8'])} night={night} />
      <Box p={[0, h + 0.3, -0.5]} s={[11.2, 0.6, 9.2]} c="#adb5bd" />
      <Box p={[0, 1.4, 4.05]} s={[3, 2.8, 0.1]} c="#1c3d5a" />
      <Palm p={[-5.5, 0, 5.5]} h={5} />
    </group>
  )
}

function Villa({ seed }: P) {
  const r = rng(`v${seed}`)
  const wall = pick(r, PASTEL)
  const two = r() < 0.6
  const roofRed = r() < 0.5
  return (
    <group>
      {/* Compound wall with a big gate */}
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * 4.6, 1, 6.6]} s={[4.6, 2, 0.3]} c="#efe6d6" />
      ))}
      <Box p={[0, 1, 6.6]} s={[4.4, 2, 0.15]} c={pick(r, ['#2b8a3e', '#1c3d5a', '#7a4b2a'])} />
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * 6.85, 1, 0]} s={[0.3, 2, 13.5]} c="#efe6d6" />
      ))}
      <Box p={[0, 1, -6.75]} s={[14, 2, 0.3]} c="#efe6d6" />
      {/* House */}
      <Box p={[-1, two ? 3.2 : 1.8, -2]} s={[8.5, two ? 6.4 : 3.6, 6]} c={wall} />
      {two && <Box p={[-1, 3.4, 1.4]} s={[5, 0.25, 1.2]} c="#f8f9fa" />}
      {roofRed ? (
        <mesh position={[-1, (two ? 6.4 : 3.6) + 1.1, -2]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[6.4, 2.2, 4]} />
          <Mat color="#c2502c" />
        </mesh>
      ) : (
        <Box p={[-1, (two ? 6.4 : 3.6) + 0.3, -2]} s={[8.8, 0.6, 6.3]} c="#f1f3f5" />
      )}
      {[-3.5, -1, 1.5].map((x) => (
        <Box key={x} p={[x, 2, 1.02]} s={[1.3, 1.4, 0.1]} c="#5aa9e6" />
      ))}
      <Box p={[-1, 1.1, 1.03]} s={[1.3, 2.2, 0.1]} c="#7a4b2a" />
      {r() < 0.5 ? <Box p={[4.4, 0.08, -3.5]} s={[3.4, 0.16, 5]} c="#3bc9db" /> : <Tree p={[4.5, 0, -3.5]} s={1.1} />}
      {r() < 0.6 && <Vehicle p={[3.6, 0, 3.4]} r={Math.PI / 2} kind="car" color={pick(r, ['#f8f9fa', '#212529', '#adb5bd', '#c92a2a'])} />}
      <Palm p={[-5.6, 0, 4.8]} h={5} />
    </group>
  )
}

/** A "cour commune": low rental rooms around a shared yard. */
function Cour({ seed }: P) {
  const r = rng(`c${seed}`)
  const units = 2 + Math.floor(r() * 2)
  return (
    <group>
      <Box p={[0, 0.03, 0]} s={[13.5, 0.06, 13.5]} c="#c9a77c" />
      {[...Array(units)].map((_, i) => {
        const x = -4.4 + i * (8.8 / Math.max(1, units - 1))
        const wall = pick(r, PASTEL)
        const h = 2.8 + r() * 0.6
        return (
          <group key={i} position={[units === 1 ? 0 : x, 0, -2.5 + (i % 2) * -1]}>
            <Box p={[0, h / 2, 0]} s={[4.2, h, 5]} c={wall} />
            {/* Corrugated tin roof */}
            <mesh position={[0, h + 0.35, 0]} rotation={[0.12, 0, 0]} castShadow>
              <boxGeometry args={[4.6, 0.1, 5.6]} />
              <Mat color={r() < 0.3 ? '#a5522c' : '#9aa5b1'} />
            </mesh>
            <Box p={[0.9, 1, 2.52]} s={[1, 2, 0.08]} c={pick(r, BRIGHT)} />
            <Box p={[-1.1, 1.5, 2.52]} s={[0.9, 0.9, 0.08]} c="#3d4f63" />
          </group>
        )
      })}
      {/* Laundry line, a water drum, the yard tree */}
      <Box p={[-3, 1.6, 3.4]} s={[0.06, 0.06, 4]} c="#495057" />
      {[0, 1, 2].map((i) => (
        <Box key={i} p={[-3, 1.2, 2 + i * 1.2]} s={[0.05, 0.8, 0.8]} c={pick(r, BRIGHT)} />
      ))}
      <mesh position={[3.8, 0.5, 4.5]} castShadow>
        <cylinderGeometry args={[0.45, 0.45, 1, 10]} />
        <Mat color="#2a6cf0" />
      </mesh>
      {r() < 0.7 && <Tree p={[4.8, 0, 1]} s={0.9} />}
      {r() < 0.5 && (
        <mesh position={[-4.2, 4.1, -2.5]} rotation={[0.4, 0.6, 0]}>
          <cylinderGeometry args={[0.6, 0.6, 0.08, 12]} />
          <Mat color="#f1f3f5" />
        </mesh>
      )}
    </group>
  )
}

/** Shops on the ground floor, flats above, a painted sign. */
function Shop({ seed, night }: P) {
  const r = rng(`s${seed}`)
  const floors = 1 + Math.floor(r() * 3)
  const wall = pick(r, PASTEL)
  const awning = pick(r, BRIGHT)
  const h = floors * 3.1
  return (
    <group>
      <Box p={[0, h / 2, -1.5]} s={[12, h, 9]} c={wall} />
      <Box p={[0, h + 0.2, -1.5]} s={[12.3, 0.4, 9.3]} c="#e9ecef" />
      {/* Shop fronts */}
      {[-3.5, 0.5, 4].map((x, i) => (
        <group key={x}>
          <Box p={[x, 1.2, 3.02]} s={[3, 2.4, 0.1]} c={night ? '#ffd27a' : '#2b2f45'} glow={night ? 0.8 : 0} />
          <mesh position={[x, 2.75, 3.6]} rotation={[0.45, 0, 0]} castShadow>
            <boxGeometry args={[3.3, 0.08, 1.4]} />
            <Mat color={i % 2 ? awning : '#f8f9fa'} />
          </mesh>
        </group>
      ))}
      <Sign p={[0, Math.min(h, 3.1) + 0.6, 3.1]} w={6} text={pick(r, SIGNS)} bg={awning} />
      {/* Balconies upstairs */}
      {[...Array(floors - 1)].flatMap((_, f) =>
        [-3.5, 0.5, 4].map((x) => (
          <group key={`${f}${x}`}>
            <Box p={[x, 3.1 * (f + 1) + 1.5, 3.02]} s={[1.6, 1.6, 0.1]} c="#5aa9e6" />
            <Box p={[x, 3.1 * (f + 1) + 0.55, 3.5]} s={[2.4, 0.15, 1]} c="#e9ecef" />
          </group>
        )),
      )}
      {r() < 0.6 && <Box p={[5.6, 0.45, 4.6]} s={[1.4, 0.9, 0.8]} c={pick(r, BRIGHT)} />}
    </group>
  )
}

/** Old two-storey house with an arcade, as in Treichville or Grand-Bassam. */
function Colonial({ seed }: P) {
  const r = rng(`k${seed}`)
  const wall = pick(r, ['#f2c879', '#e9a87c', '#f1e3c8', '#d9e8d0', '#f4c2a1'])
  return (
    <group>
      <Box p={[0, 3.2, -1.5]} s={[11, 6.4, 8]} c={wall} />
      <Box p={[0, 3.25, 2.75]} s={[11.2, 0.3, 0.5]} c="#f8f9fa" />
      {[-5, -2.5, 0, 2.5, 5].map((x) => (
        <Box key={x} p={[x, 1.6, 2.7]} s={[0.4, 3.2, 0.4]} c="#f8f9fa" />
      ))}
      {[-3.75, -1.25, 1.25, 3.75].map((x) => (
        <group key={x}>
          <Box p={[x, 4.8, 2.52]} s={[1.2, 2, 0.1]} c={pick(r, ['#2b8a3e', '#1c7ed6', '#7a4b2a'])} />
          <Box p={[x, 1.4, 2.52]} s={[1.3, 2.4, 0.1]} c="#7a4b2a" />
        </group>
      ))}
      <Box p={[0, 3.6, 3.4]} s={[11, 0.12, 1.6]} c="#c2502c" />
      <mesh position={[0, 7.4, -1.5]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[8, 2.2, 4]} />
        <Mat color="#b5482a" />
      </mesh>
      {r() < 0.5 && <Palm p={[5.8, 0, 5]} h={6} />}
    </group>
  )
}

/** Round huts with thatched roofs (the north, Korhogo). */
function Huts({ seed }: P) {
  const r = rng(`h${seed}`)
  const n = 2 + Math.floor(r() * 3)
  return (
    <group>
      <Box p={[0, 0.03, 0]} s={[13, 0.06, 13]} c="#c99a62" />
      {[...Array(n)].map((_, i) => {
        const a = (i / n) * Math.PI * 2 + r()
        const x = Math.cos(a) * 3.8
        const z = Math.sin(a) * 3.8 - 0.5
        const rad = 1.6 + r() * 0.6
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, 1.2, 0]} castShadow>
              <cylinderGeometry args={[rad, rad * 1.05, 2.4, 14]} />
              <Mat color={pick(r, ['#b5774a', '#c48a55', '#a8683d'])} />
            </mesh>
            <mesh position={[0, 3.3, 0]} castShadow>
              <coneGeometry args={[rad * 1.35, 2.4, 14]} />
              <Mat color="#c9a15a" />
            </mesh>
            <Box p={[0, 0.85, rad * 0.98]} s={[0.8, 1.7, 0.1]} c="#4a2e1a" />
          </group>
        )
      })}
      {/* Low earth wall */}
      {[[0, 6.6, 13, 0.5], [6.6, 0, 0.5, 13], [-6.6, 0, 0.5, 13]].map(([x, z, w, d], i) => (
        <Box key={i} p={[x, 0.6, z]} s={[w, 1.2, d]} c="#b98552" />
      ))}
    </group>
  )
}

/** Market tables under parasols. */
function Stalls({ seed }: P) {
  const r = rng(`m${seed}`)
  return (
    <group>
      <Box p={[0, 0.04, 0]} s={[13.5, 0.08, 13.5]} c="#d8c3a0" />
      {[...Array(6)].map((_, i) => {
        const x = -4.4 + (i % 3) * 4.4
        const z = -3 + Math.floor(i / 3) * 5.5
        const u = pick(r, BRIGHT)
        return (
          <group key={i} position={[x, 0, z]}>
            <Box p={[0, 0.45, 0]} s={[2.4, 0.9, 1.4]} c="#a0794f" />
            {[-0.7, 0, 0.7].map((dx, j) => (
              <mesh key={j} position={[dx, 1.05, 0]}>
                <icosahedronGeometry args={[0.25, 0]} />
                <Mat color={['#e03131', '#f59f00', '#2f9e44', '#fab005'][(i + j) % 4]} />
              </mesh>
            ))}
            <Box p={[0, 1.4, 0]} s={[0.06, 2.8, 0.06]} c="#555" />
            <mesh position={[0, 2.8, 0]} castShadow>
              <coneGeometry args={[1.8, 0.7, 8]} />
              <Mat color={u} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function Park({ seed }: P) {
  const r = rng(`p${seed}`)
  return (
    <group>
      <Box p={[0, 0.05, 0]} s={[13.5, 0.1, 13.5]} c="#6fbf5a" />
      <Box p={[0, 0.07, 0]} s={[1.6, 0.1, 13.5]} c="#e6d3ad" />
      {[[-4, -3], [4, -4], [-4.5, 4], [4.2, 3.5]].map(([x, z], i) => (r() < 0.5 ? <Tree key={i} p={[x, 0, z]} s={1 + r() * 0.4} /> : <Palm key={i} p={[x, 0, z]} h={5 + r() * 2} />))}
      {[-1.6, 1.6].map((x) => (
        <Box key={x} p={[x, 0.4, 0]} s={[0.5, 0.15, 1.8]} c="#8a5a2b" />
      ))}
      <mesh position={[0, 0.5, -5]}>
        <cylinderGeometry args={[1.2, 1.4, 1, 16]} />
        <Mat color="#ced4da" />
      </mesh>
    </group>
  )
}

function Church({ seed }: P) {
  const r = rng(`e${seed}`)
  return (
    <group>
      <Box p={[0, 3, -1.5]} s={[7, 6, 10]} c={pick(r, ['#f8f9fa', '#f1e3c8'])} />
      <mesh position={[0, 7.1, -1.5]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[6, 2.2, 4]} />
        <Mat color="#adb5bd" />
      </mesh>
      <Box p={[0, 6, 3.6]} s={[2.2, 12, 2.2]} c="#f8f9fa" />
      <Box p={[0, 12.8, 3.6]} s={[0.25, 1.6, 0.25]} c="#495057" />
      <Box p={[0, 12.9, 3.6]} s={[1, 0.25, 0.25]} c="#495057" />
    </group>
  )
}

function Warehouse({ seed }: P) {
  const r = rng(`w${seed}`)
  return (
    <group>
      <Box p={[0, 3, -2]} s={[12, 6, 8]} c="#cfd4da" />
      <mesh position={[0, 6.1, -2]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[4, 4, 12, 16, 1, false, 0, Math.PI]} />
        <Mat color="#9aa5b1" />
      </mesh>
      <Box p={[0, 2.2, 2.05]} s={[5, 4.4, 0.1]} c="#495057" />
      {[-3, 3].map((x) => (
        <Box key={x} p={[x, 1.3, 4.6]} s={[2.4, 2.6, 6]} c={pick(r, ['#c92a2a', '#1c7ed6', '#2b8a3e', '#e8590c'])} />
      ))}
    </group>
  )
}

const BY_TYPE: Record<Filler, (p: P) => React.ReactElement> = {
  tower: Tower,
  office: OfficeBlock,
  villa: Villa,
  cour: Cour,
  shop: Shop,
  colonial: Colonial,
  hut: Huts,
  stall: Stalls,
  park: Park,
  church: Church,
  warehouse: Warehouse,
}

export function FillerBuilding({ type, ...p }: P & { type: Filler }) {
  const C = BY_TYPE[type]
  return <C {...p} />
}
