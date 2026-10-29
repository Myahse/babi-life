import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { GlassWater } from 'lucide-react'
import { Box } from '../../world3d/props'
import { Table3d } from './Table3d'
import { haptic } from '../../lib/native'
import { gesture } from '../../world3d/gesture'

// Le garba, played (the update « gestes-maison »). First at the garbadrome's
// bassine: the pieces of fried fish sizzle in the oil, the tantie calls one
// (« La darne de thon ! ») and you fish it out before the other customers' hands
// do. Then the plate: take the attiéké by hand (a pinch), « pommer » a ball in the hand
// (held: it packs, let go in the green), but every mouthful fills the throat: the
// attiéké doesn't go down easily. Too full and you choke (time lost): drink some
// water. Plate empty, the garba is eaten.

const PIECES = [
  { id: 'thon', name: 'La darne de thon', w: 74 },
  { id: 'chinchard', name: 'Le chinchard', w: 86 },
  { id: 'carpe', name: 'Le morceau de carpe', w: 70 },
  { id: 'tete', name: 'La tête de carpe', w: 64 },
] as const
type PieceId = (typeof PIECES)[number]['id']
type Piece = { key: number; kind: PieceId; x: number; y: number; vx: number; vy: number; rot: number }

const CRUST = '#a8601c'
const GOLD = '#d68a2e'
const FLESH = '#ecc79a'

/**
 * A piece of fried fish as it comes out of the oil, in the game's blocks: the
 * darne of thon (a thick round slice, the cut face pale, the backbone in the
 * middle), the length of chinchard (silver skin crisped, the tail, the cut end),
 * the chunk of carpe (its scales browned in rows), the carpe's head (the eye, the
 * open mouth, the gill). About a hand long.
 */
export function FishPiece({ kind }: { kind: PieceId }) {
  if (kind === 'thon')
    return (
      <group scale={[1, 1, 0.78]}>
        <mesh position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.55, 0.58, 0.28, 10]} />
          <meshLambertMaterial color={CRUST} flatShading />
        </mesh>
        <mesh position={[0, 0.285, 0]}>
          <cylinderGeometry args={[0.44, 0.48, 0.02, 10]} />
          <meshLambertMaterial color={FLESH} flatShading />
        </mesh>
        {[-0.24, -0.08, 0.08, 0.24].map((x) => (
          <Box key={x} p={[x, 0.3, 0]} s={[0.03, 0.01, 0.7]} c="#c98d55" />
        ))}
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.03, 8]} />
          <meshLambertMaterial color="#efe3cf" />
        </mesh>
        <Box p={[0, 0.32, 0]} s={[0.05, 0.02, 0.05]} c="#8a5a32" />
      </group>
    )
  if (kind === 'chinchard')
    return (
      <group>
        <Box p={[0, 0.13, 0]} s={[1.0, 0.26, 0.36]} c="#7d8893" />
        <Box p={[0.02, 0.27, 0]} s={[0.9, 0.04, 0.26]} c={GOLD} />
        <Box p={[0, 0.24, 0.12]} s={[0.92, 0.02, 0.04]} c="#e8e2d0" />
        <Box p={[-0.51, 0.13, 0]} s={[0.03, 0.24, 0.34]} c={FLESH} />
        <Box p={[-0.52, 0.13, 0]} s={[0.02, 0.06, 0.06]} c="#efe3cf" />
        <group position={[0.55, 0.13, 0]}>
          <mesh position={[0.1, 0, 0.1]} rotation={[0, 0.7, 0]}>
            <boxGeometry args={[0.3, 0.04, 0.1]} />
            <meshLambertMaterial color="#4a3524" flatShading />
          </mesh>
          <mesh position={[0.1, 0, -0.1]} rotation={[0, -0.7, 0]}>
            <boxGeometry args={[0.3, 0.04, 0.1]} />
            <meshLambertMaterial color="#4a3524" flatShading />
          </mesh>
        </group>
      </group>
    )
  if (kind === 'carpe')
    return (
      <group>
        <Box p={[0, 0.17, 0]} s={[0.8, 0.34, 0.6]} c={CRUST} />
        {[0, 1, 2].map((r) =>
          [0, 1, 2, 3].map((c) => <Box key={`${r}${c}`} p={[-0.27 + c * 0.18 + (r % 2) * 0.06, 0.35, -0.18 + r * 0.18]} s={[0.12, 0.03, 0.1]} c={(r + c) % 2 ? '#7a3d10' : GOLD} />),
        )}
        <Box p={[0.41, 0.17, 0]} s={[0.02, 0.28, 0.52]} c={FLESH} />
        <Box p={[-0.41, 0.17, 0]} s={[0.02, 0.28, 0.52]} c={FLESH} />
      </group>
    )
  return (
    <group>
      <Box p={[0, 0.18, 0]} s={[0.66, 0.36, 0.56]} c="#94511a" />
      <Box p={[-0.36, 0.14, 0]} s={[0.14, 0.24, 0.4]} c={CRUST} />
      <Box p={[-0.44, 0.12, 0]} s={[0.06, 0.08, 0.24]} c="#3a1a04" />
      <Box p={[0.06, 0.37, 0]} s={[0.04, 0.02, 0.5]} c="#5e2f0c" />
      <Box p={[-0.15, 0.3, 0.29]} s={[0.14, 0.14, 0.02]} c="#f2efe6" />
      <Box p={[-0.15, 0.3, 0.3]} s={[0.06, 0.06, 0.02]} c="#1a0e06" />
      <Box p={[-0.15, 0.3, -0.29]} s={[0.14, 0.14, 0.02]} c="#f2efe6" />
      <Box p={[0.34, 0.18, 0]} s={[0.02, 0.3, 0.48]} c={FLESH} />
    </group>
  )
}

/** The bassine is 6 wide (0..1 across it, as the pieces move). */
const PAN = 6
const at = (x: number, y: number): [number, number, number] => [(x - 0.5) * PAN, 0, (y - 0.5) * PAN]

/** The oil seething: bubbles coming up all over and bursting. */
function Sizzle() {
  const g = useRef<THREE.Group>(null)
  const spots = useRef([...Array(18)].map((_, i) => ({ a: i * 2.39, r: 0.3 + ((i * 7) % 10) / 10 * 2.1, p: (i * 0.37) % 1 })))
  useFrame((_, dt) => {
    g.current?.children.forEach((m, i) => {
      const s = spots.current[i]
      s.p = (s.p + dt * (0.9 + (i % 4) * 0.25)) % 1
      m.position.set(Math.cos(s.a) * s.r, 0.36, Math.sin(s.a) * s.r)
      m.scale.setScalar(0.04 + s.p * 0.1)
      ;((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - s.p)
    })
  })
  return (
    <group ref={g}>
      {spots.current.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial color="#fff1b8" transparent />
        </mesh>
      ))}
    </group>
  )
}

/** The smoke going up off the oil. */
function Smoke() {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    g.current?.children.forEach((m, i) => {
      const k = (clock.elapsedTime / 3 + i / 3) % 1
      m.position.set(-1.2 + i * 1.2, 0.6 + k * 3, -0.6 + Math.sin(k * 6 + i) * 0.3)
      m.scale.setScalar(0.4 + k * 0.9)
      ;((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.28 * (1 - k)
    })
  })
  return (
    <group ref={g}>
      {[0, 1, 2].map((i) => (
        <mesh key={i}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color="#ffffff" transparent depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

/** The bassine on its fire: the black iron, the handles, the oil, the glow under it. */
function Bassine() {
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[3.0, 2.5, 0.6, 24, 1, true]} />
        <meshLambertMaterial color="#2a2a2e" side={THREE.DoubleSide} flatShading />
      </mesh>
      <mesh position={[0, 0.41, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.0, 0.08, 6, 32]} />
        <meshLambertMaterial color="#45454c" />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[2.88, 2.88, 0.04, 32]} />
        <meshLambertMaterial color="#d88f1f" emissive="#b8660c" emissiveIntensity={0.35} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 3.25, 0.38, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.3, 0.07, 6, 12, Math.PI]} />
          <meshLambertMaterial color="#26262a" />
        </mesh>
      ))}
      <Box p={[0, -0.3, 0]} s={[4.6, 0.2, 4.6]} c="#3a2a1c" />
      <pointLight position={[0, -0.1, 0]} color="#ff8a2a" intensity={2} distance={6} />
    </group>
  )
}

/**
 * A hand coming down on a piece and taking it away: another customer's (from the far side, a blue
 * sleeve) or yours (from your side, your sleeve). Down, it closes on the piece, then off with it.
 */
function Grab({ x, z, mine, children }: { x: number; z: number; mine?: boolean; /** What it takes (it shows in the hand once it's got there). */ children?: React.ReactNode }) {
  const g = useRef<THREE.Group>(null)
  const held = useRef<THREE.Group>(null)
  const t = useRef(0)
  const from = mine ? 1 : -1
  useFrame((_, dt) => {
    t.current += dt
    const k = t.current
    const o = g.current
    if (!o) return
    // Down (0.3 s), a beat on the piece, then up and back where it came from.
    const down = Math.min(1, k / 0.3)
    const up = Math.max(0, (k - 0.4) / 0.4)
    o.position.set(x, 3 - 2.55 * down + 3 * up, z + from * (1.5 * (1 - down) + 2.5 * up))
    if (held.current) held.current.visible = k > 0.3
  })
  const skin = mine ? '#6e4024' : '#7b4a2a'
  return (
    <group ref={g} position={[x, 3, z + from * 1.5]} rotation={[0, mine ? Math.PI : 0, 0]}>
      <Box p={[0, 0.1, 0]} s={[0.6, 0.18, 0.7]} c={skin} />
      {[-0.21, -0.07, 0.07, 0.21].map((dx) => (
        <Box key={dx} p={[dx, 0.06, 0.48]} s={[0.12, 0.12, 0.34]} c={skin} />
      ))}
      <Box p={[0.34, 0.05, 0.2]} s={[0.12, 0.12, 0.3]} c={skin} />
      <Box p={[0, 0.25, -1.1]} s={[0.46, 0.4, 1.6]} c={mine ? '#ff7a00' : '#3a6fb0'} />
      <group ref={held} position={[0, -0.25, 0.25]} visible={false}>
        {children}
      </group>
    </group>
  )
}

const ROUNDS = 3

export function GarbaDefi({ onEnd }: { onEnd: (score: number) => void }) {
  const [phase, setPhase] = useState<'pan' | 'plate'>('pan')
  const pts = useRef({ pan: 0 })
  return phase === 'pan' ? <Pan onDone={(s) => ((pts.current.pan = s), setPhase('plate'))} /> : <Plate onDone={(s) => onEnd(Math.round(pts.current.pan * 0.4 + s * 0.6))} />
}

/** The bassine: the called piece, fished out before the other hands. */
function Pan({ onDone }: { onDone: (score: number) => void }) {
  const [pieces, setPieces] = useState<Piece[]>([])
  const piecesRef = useRef<Piece[]>([])
  piecesRef.current = pieces
  const [want, setWant] = useState<PieceId>('thon')
  const [round, setRound] = useState(0)
  const [hand, setHand] = useState<{ x: number; y: number; kind: PieceId; mine?: boolean; key: number } | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const st = useRef({ got: 0, wrong: 0, key: 0, busy: false })
  // A fresh batch out of the oil each round: two of each, drifting in the sizzle.
  const fill = () => {
    const ps: Piece[] = []
    // Spread round the bassine (each on its own bit of oil), not heaped in the middle.
    const n = PIECES.length * 2
    const turn = Math.random() * Math.PI * 2
    PIECES.forEach((p, j) =>
      [0, 1].forEach((i) => {
        const a = turn + ((j * 2 + i) / n) * Math.PI * 2
        const r = i ? 0.26 : 0.14
        ps.push({ key: st.current.key++, kind: p.id, x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r, vx: (Math.random() - 0.5) * 0.06, vy: (Math.random() - 0.5) * 0.06, rot: Math.random() * 360 })
      }),
    )
    setPieces(ps)
    setWant(PIECES[Math.floor(Math.random() * PIECES.length)].id)
    st.current.busy = false
  }
  useEffect(fill, [])
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000)
      last = t
      setPieces((ps) =>
        ps.map((p) => {
          let { x, y, vx, vy } = p
          x += vx * dt
          y += vy * dt
          // Kept in the round of the bassine.
          const dx = x - 0.5
          const dy = y - 0.5
          if (Math.hypot(dx, dy) > 0.33) {
            vx = -vx
            vy = -vy
            x = 0.5 + dx * 0.97
            y = 0.5 + dy * 0.97
          }
          return { ...p, x, y, vx, vy, rot: p.rot + vx * 40 * dt }
        }),
      )
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  // Another customer's hand comes for the piece you want: be quicker.
  useEffect(() => {
    const t = setTimeout(() => {
      const p = piecesRef.current.find((q) => q.kind === want)
      if (!p || st.current.busy) return
      setHand({ x: p.x, y: p.y, kind: p.kind, key: p.key })
      setTimeout(() => setHand(null), 900)
      setPieces((ps) => ps.filter((q) => q.key !== p.key))
    }, 2600 - round * 400)
    return () => clearTimeout(t)
  }, [want, round, pieces.length])
  const next = () => {
    if (st.current.busy) return
    st.current.busy = true
    if (round + 1 >= ROUNDS) {
      const s = st.current
      return setTimeout(() => onDone(Math.max(0, Math.round((s.got / ROUNDS) * 100 - s.wrong * 10))), 700)
    }
    setRound(round + 1)
    setTimeout(fill, 500)
  }
  const pick = (p: Piece) => {
    if (st.current.busy) return
    if (p.kind === want) {
      st.current.got++
      haptic('success')
      gesture('busy', 1200)
      setSaid(`${PIECES.find((f) => f.id === want)!.name}, dans le plat !`)
      // Your hand goes in and takes it out of the oil.
      setHand({ x: p.x, y: p.y, kind: p.kind, mine: true, key: p.key })
      setTimeout(() => setHand(null), 900)
      setPieces((ps) => ps.filter((q) => q.key !== p.key))
      next()
    } else {
      st.current.wrong++
      haptic('error')
      setSaid('Pas celui-là !')
    }
    setTimeout(() => setSaid(null), 900)
  }
  useEffect(() => {
    if (pieces.length && !pieces.some((p) => p.kind === want) && !st.current.busy) {
      setSaid('Un autre client l’a pris…')
      setTimeout(() => setSaid(null), 900)
      next()
    }
  }, [pieces, want]) // eslint-disable-line react-hooks/exhaustive-deps

  const f = PIECES.find((x) => x.id === want)!
  return (
    // The game in the bottom of the screen, the Sim seen above (the picture lifted: world3d/chatFraming.tsx).
    <div className="absolute inset-0 flex flex-col items-center justify-end gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" style={{ background: 'linear-gradient(rgba(27,18,12,0) 0%, rgba(27,18,12,0) 34%, rgba(27,18,12,0.88) 50%)' }}>
      <div className="card flex items-center gap-3 px-4 py-2">
        <span className="label whitespace-nowrap">La tantie</span>
        <span className="font-display text-[17px] leading-tight font-extrabold">« {f.name} ! »</span>
      </div>
      <div className="text-[13px] font-extrabold text-white/80">
        Morceau {round + 1}/{ROUNDS} · pioche-le avant les autres clients
      </div>
      {/* The bassine on the fire, the pieces in the oil: tap the one called */}
      <div className="relative aspect-square w-[min(92vw,46vh,420px)] short:w-[min(60vw,64vh)]">
        <Table3d className="!absolute inset-0">
          <Bassine />
          <Sizzle />
          <Smoke />
          {pieces.map((p) => (
            <group key={p.key} position={[at(p.x, p.y)[0], 0.3, at(p.x, p.y)[2]]} rotation={[0, (p.rot * Math.PI) / 180, 0]} onPointerDown={(e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), pick(p))}>
              <FishPiece kind={p.kind} />
              {/* A wide invisible hold round each piece: a finger finds it */}
              <mesh visible={false}>
                <boxGeometry args={[1.2, 0.8, 1.0]} />
              </mesh>
            </group>
          ))}
          {hand && (
            <Grab key={hand.key} x={at(hand.x, hand.y)[0]} z={at(hand.x, hand.y)[2]} mine={hand.mine}>
              <FishPiece kind={hand.kind} />
            </Grab>
          )}
        </Table3d>
      </div>
      <div className="h-6 text-[15px] font-extrabold text-[#ffd76a]">{said}</div>
    </div>
  )
}

/** One pinch of attiéké: a little heap of grains in their shades of cream. */
function Clump({ seed }: { seed: number }) {
  return (
    <group>
      {[...Array(7)].map((_, i) => {
        const a = seed * 1.7 + i * 2.39
        const r = (i % 3) * 0.09
        return <Box key={i} p={[Math.cos(a) * r, 0.06 + (i % 2) * 0.05 + (i === 0 ? 0.06 : 0), Math.sin(a) * r]} s={[0.12, 0.1, 0.12]} c={['#fff8dc', '#f7eccb', '#efe0b4', '#fffdf0'][(seed + i) % 4]} />
      })}
    </group>
  )
}

/** The plate is 6 wide (0..1 across it, as the pinches lie). */
const PLATE = 6
const on = (x: number, y: number): [number, number, number] => [(x - 0.5) * PLATE, 0.12, (y - 0.5) * PLATE]

/** The plate shaking with the coughs, its trimmings: the onion rings, the tomato, the piment, the thon. */
function PlateTable({ choke, left, children }: { choke: boolean; /** What's left of the plate (1 full, 0 eaten): the fish goes with the attiéké. */ left: number; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (g.current) g.current.position.x = choke ? Math.sin(clock.elapsedTime * 50) * 0.12 : 0
  })
  return (
    <group ref={g}>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[3.0, 2.6, 0.16, 32]} />
        <meshLambertMaterial color="#e9edf1" />
      </mesh>
      <mesh position={[0, 0.085, 0]}>
        <cylinderGeometry args={[2.4, 2.4, 0.02, 32]} />
        <meshLambertMaterial color="#fbfcfd" />
      </mesh>
      {[[1.3, -1.1], [1.6, -0.5]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.14, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.28, 0.06, 6, 14]} />
          <meshLambertMaterial color="#b0478a" />
        </mesh>
      ))}
      <mesh position={[0.4, 0.14, -1.6]}>
        <cylinderGeometry args={[0.32, 0.32, 0.06, 12]} />
        <meshLambertMaterial color="#e03131" />
      </mesh>
      <Box p={[-1.5, 0.16, 1.3]} s={[0.6, 0.12, 0.16]} c="#e03131" />
      <Box p={[-1.12, 0.18, 1.3]} s={[0.16, 0.06, 0.06]} c="#2b8a3e" />
      {/* The thon, eaten bite by bite along with the attiéké: a smaller piece each time, then only the bone */}
      {left > 0 ? (
        <group position={[1.3, 0.1, 1.2]} rotation={[0, 0.4, 0]} scale={[1.3 * (0.25 + 0.75 * left), 1.3, 1.3 * (0.35 + 0.65 * left)]}>
          <FishPiece kind="thon" />
        </group>
      ) : (
        <Box p={[1.3, 0.14, 1.2]} s={[0.5, 0.05, 0.08]} c="#efe3cf" />
      )}
      {children}
    </group>
  )
}

/** The plate: the attiéké by hand, the balls « pommées », water for the throat. */
function Plate({ onDone }: { onDone: (score: number) => void }) {
  const [clumps, setClumps] = useState(() =>
    [...Array(24)].map((_, i) => {
      const a = (i / 24) * Math.PI * 2 * 2.6
      const r = 0.06 + ((i * 7) % 11) / 11 * 0.2
      return { i, x: 0.42 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r * 0.85 }
    }),
  )
  const [throat, setThroat] = useState(0)
  const [choke, setChoke] = useState(false)
  const [water, setWater] = useState(3)
  const [press, setPress] = useState<number | null>(null)
  const st = useRef({ t0: performance.now(), chokes: 0, done: false, key: 0 })
  // The mouthful being taken, by hand: a pinch (a tap), or the ball made in the palm (« pommer »).
  const [bite, setBite] = useState<{ key: number; x: number; z: number; ball: boolean } | null>(null)
  useEffect(() => {
    const t = setInterval(() => setThroat((v) => Math.max(0, v - 1.2)), 200)
    return () => clearInterval(t)
  }, [])
  const swallow = (n: number, fill: number, which?: number) => {
    if (choke || st.current.done) return
    // The pinch tapped first (then the rest of the heap, from its edge).
    if (which !== undefined) {
      const i = clumps.findIndex((c) => c.i === which)
      if (i > 0) clumps.unshift(...clumps.splice(i, 1))
    }
    const left = clumps.length - n
    // Seen taken: from where it was on the plate.
    const c0 = clumps[0]
    if (c0) {
      const [x, , z] = on(c0.x, c0.y)
      setBite({ key: st.current.key++, x, z, ball: n > 1 })
      setTimeout(() => setBite(null), 800)
    }
    setClumps((c) => c.slice(n))
    gesture('snack', 1000)
    const now = throat + fill
    if (now >= 100) {
      st.current.chokes++
      haptic('error')
      setChoke(true)
      setThroat(70)
      setTimeout(() => setChoke(false), 1600)
    } else setThroat(now)
    if (left <= 0) {
      st.current.done = true
      const secs = (performance.now() - st.current.t0) / 1000
      setTimeout(() => onDone(Math.max(0, Math.round(100 - Math.max(0, secs - 18) * 2.5 - st.current.chokes * 18))), 500)
    }
  }
  useEffect(() => {
    if (press === null) return
    const t = setInterval(() => setPress((p) => (p === null ? null : Math.min(1.1, p + 0.035))), 30)
    return () => clearInterval(t)
  }, [press !== null]) // eslint-disable-line react-hooks/exhaustive-deps
  const letGo = () => {
    if (press === null) return
    const good = press >= 0.55 && press <= 0.85
    setPress(null)
    if (good) {
      haptic('light')
      swallow(Math.min(clumps.length, 5), 26)
    } else swallow(Math.min(clumps.length, 1), 14)
  }
  const drink = () => {
    if (!water || choke) return
    setWater(water - 1)
    gesture('drink', 1200)
    setThroat((v) => Math.max(0, v - 45))
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" style={{ background: 'linear-gradient(rgba(27,18,12,0) 0%, rgba(27,18,12,0) 34%, rgba(27,18,12,0.88) 50%)' }}>
      <div className="card px-4 py-2 text-center">
        <div className="font-display text-[17px] font-extrabold">Mange ton garba !</div>
        <div className="text-[12.5px] font-bold text-[var(--color-ink-soft)]">Prends l’attiéké à la main, pomme une boule… et bois avant de t’étouffer.</div>
      </div>
      <div className="flex w-full max-w-[min(470px,60vh)] items-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className="relative h-44 w-5 overflow-hidden rounded-full bg-white/20">
            <div className={`absolute inset-x-0 bottom-0 rounded-full ${throat > 75 ? 'bg-[#ff3d57]' : 'bg-[#ffc233]'}`} style={{ height: `${Math.min(100, throat)}%` }} />
          </div>
          <span className="text-[10px] font-extrabold text-white/80">Gorge</span>
        </div>
        {/* The plate in 3D: tap the attiéké to take a pinch of it */}
        <div className="relative aspect-square flex-1">
          <Table3d className="!absolute inset-0" cam={[0, 7.4, 3.2]}>
            <PlateTable choke={choke} left={clumps.length / 24}>
              {bite &&
                (bite.ball ? (
                  <Grab key={bite.key} x={bite.x} z={bite.z} mine>
                    <mesh position={[0, 0.1, 0]}>
                      <sphereGeometry args={[0.28, 8, 6]} />
                      <meshLambertMaterial color="#f7eccb" flatShading />
                    </mesh>
                  </Grab>
                ) : (
                  // A pinch taken with the fingers (the attiéké is eaten by hand), a bit of thon with it now and then.
                  <Grab key={bite.key} x={bite.x} z={bite.z} mine>
                    <Box p={[0, 0.06, 0]} s={[0.22, 0.1, 0.2]} c="#f7eccb" />
                    {bite.key % 3 === 0 && <Box p={[0.05, 0.13, 0]} s={[0.12, 0.06, 0.1]} c="#a8601c" />}
                  </Grab>
                ))}
              {clumps.length > 0 && (
                <mesh position={[-0.5, 0.1, 0]} scale={[0.4 + (clumps.length / 24) * 0.6, 1, 0.4 + (clumps.length / 24) * 0.6]}>
                  <cylinderGeometry args={[1.5, 1.7, 0.14, 16]} />
                  <meshLambertMaterial color="#f1e4bb" />
                </mesh>
              )}
              {clumps.map((c) => (
                <group key={c.i} position={on(c.x, c.y)} onPointerDown={(e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), swallow(1, 9, c.i))}>
                  <Clump seed={c.i} />
                  <mesh visible={false}>
                    <boxGeometry args={[0.5, 0.4, 0.5]} />
                  </mesh>
                </group>
              ))}
            </PlateTable>
          </Table3d>
          {choke && <div className="pointer-events-none absolute inset-0 grid place-items-center font-display text-[28px] font-extrabold text-[#d81b3f] [text-shadow:0_2px_0_#fff]">Kof kof !</div>}
        </div>
      </div>
      <div className="flex w-full max-w-[470px] gap-2">
        <button
          className="btn flex-1 !py-3"
          onPointerDown={(e) => (e.preventDefault(), setPress(0))}
          onPointerUp={letGo}
          onPointerLeave={letGo}
          style={press !== null ? { background: press >= 0.55 && press <= 0.85 ? '#00a862' : press > 0.85 ? '#ff3d57' : undefined } : undefined}
        >
          {press === null ? 'Pommer (tiens)' : press > 0.85 ? 'Trop serré !' : press >= 0.55 ? 'Lâche !' : 'Pomme…'}
        </button>
        <button className="btn btn-soft !py-3" onClick={drink} disabled={!water}>
          <GlassWater size={18} /> Eau ({water})
        </button>
      </div>
      <div className="text-[13px] font-extrabold text-white/80">Encore {clumps.length} bouchées</div>
    </div>
  )
}
