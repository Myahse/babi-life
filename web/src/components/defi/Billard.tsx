import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { sceneDpr } from '../../lib/device'
import { haptic } from '../../lib/native'
import { sfx } from '../../lib/sfx'
import { t as tr, tx } from '../../lib/i18n'
import { aiShot, aimHit, cue, groupOf, left, newGame, placeCue, POCKETS, R, restore, score, shoot, snapshot, step, TABLE, type Game, type Snap } from '../../billard/pool'

// Le billard américain du maquis (backend game.BillardID): the 8-ball against a regular of the place,
// on the table at the back (billard/pool.ts plays it). The table seen from above, its long side up the
// phone; the player touches where to aim (the line and the ghost ball show where the cue ball meets the
// first ball), sets the power, « Tirer ». After a foul the cue ball is in hand: touched down where one wants.
// Won, the score is 70 and up; lost, 10 a ball of one's own pocketed.

const FOES = [
  { id: 'konan', name: 'Konan', skill: 0.35, label: tr('Konan, le serveur') },
  { id: 'bamba', name: 'Bamba', skill: 0.62, label: tr('Bamba, l’habitué') },
  { id: 'gaoussou', name: 'Gaoussou', skill: 0.88, label: tr('Gaoussou, le requin du billard') },
]
// The balls' colours (1–7 solids, 9–15 the same as stripes, the 8 black).
const COLOURS = ['#ffffff', '#f2c40f', '#1f4fc4', '#d62828', '#6a2c91', '#f07a1a', '#1d8a3a', '#7a1e1e', '#111111']
const colourOf = (n: number) => (n === 0 ? COLOURS[0] : COLOURS[n > 8 ? n - 8 : n])

/** A ball's look: its colour (all round, or as a band on white for a stripe) and its number in a white disc. */
function ballTexture(n: number) {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = n > 8 ? '#f4f1e8' : colourOf(n)
  g.fillRect(0, 0, 128, 64)
  if (n > 8) {
    g.fillStyle = colourOf(n)
    g.fillRect(0, 18, 128, 28)
  }
  if (n > 0) {
    for (const x of [32, 96]) {
      g.fillStyle = '#ffffff'
      g.beginPath()
      g.arc(x, 32, 11, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#111111'
      g.font = 'bold 14px sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(String(n), x, 33)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// The table's frame: the game's x along the phone's height (3D -z), its z across (3D x).
const to3 = (x: number, z: number): [number, number, number] => [z, R, -x]
const from3 = (p: THREE.Vector3) => ({ x: -p.z, z: p.x })

function Table({ game, aim, power, onAim, onPlace, mine, low }: { game: React.RefObject<Game>; aim: React.RefObject<number>; power: number; onAim: (a: number) => void; onPlace: (x: number, z: number) => void; mine: boolean; /** The camera low behind the cue ball, along the aim (else the table from above). */ low: boolean }) {
  const balls = useRef<(THREE.Mesh | null)[]>([])
  const stick = useRef<THREE.Group>(null)
  const line = useRef<THREE.Mesh>(null)
  const ghost = useRef<THREE.Mesh>(null)
  // Where the ball hit goes, and the cue ball after it (without spin: at right angles).
  const objLine = useRef<THREE.Mesh>(null)
  const cueLine = useRef<THREE.Mesh>(null)
  const { camera } = useThree()
  const camAt = useRef(new THREE.Vector3(0, 3.55, 0.3))
  const lookAt = useRef(new THREE.Vector3())
  const textures = useMemo(() => [...Array(16)].map((_, n) => ballTexture(n)), [])
  const sphere = useMemo(() => new THREE.SphereGeometry(R, 20, 14), [])
  useFrame(() => {
    const g = game.current
    if (!g) return
    g.balls.forEach((b, i) => {
      const m = balls.current[i]
      if (!m) return
      m.visible = !b.in
      m.position.set(...to3(b.x, b.z))
      // Rolling: turned about the axis across its way, by the way gone.
      const v = Math.hypot(b.vx, b.vz)
      if (v > 0) m.rotateOnWorldAxis(new THREE.Vector3(-b.vx / v, 0, -b.vz / v).normalize(), (v / R) * (1 / 60))
    })
    const c = cue(g)
    const show = mine && !g.moving && g.winner === null
    const a = aim.current ?? 0
    if (stick.current) {
      stick.current.visible = !g.moving && g.winner === null
      stick.current.position.set(...to3(c.x, c.z))
      // (The game's angle in the table's frame: x→-z, z→x.)
      // (The cue behind the ball: its local -z the opposite of the aim, the aim (cos a, sin a) being (sin a, -cos a) here.)
      stick.current.rotation.set(0, Math.PI - a, 0)
      stick.current.children[0].position.z = -(0.05 + power * 0.18) - 0.7
    }
    const hit = aimHit(g, a)
    if (line.current) {
      line.current.visible = show
      const [x0, , z0] = to3(c.x, c.z)
      const [x1, , z1] = to3(hit.x, hit.z)
      const len = Math.hypot(x1 - x0, z1 - z0)
      line.current.position.set((x0 + x1) / 2, R + 0.001, (z0 + z1) / 2)
      line.current.scale.set(1, 1, len)
      line.current.rotation.set(0, Math.atan2(x1 - x0, z1 - z0), 0)
    }
    if (ghost.current) {
      ghost.current.visible = show && !!hit.ball
      ghost.current.position.set(...to3(hit.x, hit.z))
    }
    // A line from a point (the table's x, z) along a way, so long.
    const ray = (m: THREE.Mesh | null, x: number, z: number, dx: number, dz: number, len: number) => {
      if (!m) return
      m.visible = show && !!hit.ball && len > 0.01
      const [x0, , z0] = to3(x, z)
      const [x1, , z1] = to3(x + dx * len, z + dz * len)
      m.position.set((x0 + x1) / 2, R + 0.001, (z0 + z1) / 2)
      m.scale.set(1, 1, len)
      m.rotation.set(0, Math.atan2(x1 - x0, z1 - z0), 0)
    }
    if (hit.ball && hit.obj && hit.cue) {
      ray(objLine.current, hit.ball.x, hit.ball.z, hit.obj.x, hit.obj.z, 0.35)
      ray(cueLine.current, hit.x, hit.z, hit.cue.x, hit.cue.z, 0.3 * hit.cue.k)
    } else {
      if (objLine.current) objLine.current.visible = false
      if (cueLine.current) cueLine.current.visible = false
    }
    // The camera: above the table, or low behind the cue ball looking along the aim (eased either way).
    if (low && !g.moving) {
      const [cx, , cz] = to3(c.x, c.z)
      const dx = Math.sin(a)
      const dz = -Math.cos(a)
      camAt.current.set(cx - dx * 0.75, 0.42, cz - dz * 0.75)
      lookAt.current.set(cx + dx * 0.6, 0, cz + dz * 0.6)
    } else if (!low) {
      camAt.current.set(0, 3.55, 0.3)
      lookAt.current.set(0, 0, 0.02)
    }
    camera.position.lerp(camAt.current, 0.12)
    const want = new THREE.Matrix4().lookAt(camera.position, lookAt.current, camera.up)
    camera.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(want), 0.12)
  })
  const touch = (e: ThreeEvent<PointerEvent>) => {
    const g = game.current
    // (Only on one's own shot, the balls at rest.)
    if (!g || !mine) return
    const p = from3(e.point)
    if (g.inHand && e.type === 'pointerdown') return onPlace(p.x, p.z)
    const c = cue(g)
    onAim(Math.atan2(p.z - c.z, p.x - c.x))
  }
  const W = TABLE.h
  const L = TABLE.w
  return (
    <group>
      {/* The felt, its cushions and wooden frame, the six pockets */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} onPointerDown={touch} onPointerMove={(e) => e.buttons && touch(e)}>
        <planeGeometry args={[W + 0.4, L + 0.4]} />
        <meshLambertMaterial color="#14794a" />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * (W / 2 + 0.03), 0.03, 0]}>
            <boxGeometry args={[0.06, 0.06, L]} />
            <meshLambertMaterial color="#0f5e39" />
          </mesh>
          <mesh position={[0, 0.03, s * (L / 2 + 0.03)]}>
            <boxGeometry args={[W, 0.06, 0.06]} />
            <meshLambertMaterial color="#0f5e39" />
          </mesh>
          <mesh position={[s * (W / 2 + 0.13), 0.05, 0]}>
            <boxGeometry args={[0.14, 0.1, L + 0.4]} />
            <meshLambertMaterial color="#5a3317" />
          </mesh>
          <mesh position={[0, 0.05, s * (L / 2 + 0.13)]}>
            <boxGeometry args={[W + 0.4, 0.1, 0.14]} />
            <meshLambertMaterial color="#5a3317" />
          </mesh>
        </group>
      ))}
      {POCKETS.map((p, i) => {
        const [x, , z] = to3(p.x, p.z)
        return (
          // (Over the cushions and the frame: the hole seen whole at the corners.)
          <mesh key={i} position={[x, 0.102, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[p.r * 1.15, 20]} />
            <meshBasicMaterial color="#050505" />
          </mesh>
        )
      })}
      {/* The head spot and the foot spot */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.001, s * (L / 4)]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.008, 10]} />
          <meshBasicMaterial color="#d8f0e0" />
        </mesh>
      ))}
      {game.current?.balls.map((b, i) => (
        <mesh key={b.n} ref={(m) => void (balls.current[i] = m)} geometry={sphere}>
          <meshLambertMaterial map={textures[b.n]} />
        </mesh>
      ))}
      {/* The aiming line to the first ball, and where the cue ball meets it */}
      <mesh ref={line}>
        <boxGeometry args={[0.004, 0.001, 1]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.55} />
      </mesh>
      <mesh ref={objLine}>
        <boxGeometry args={[0.005, 0.001, 1]} />
        <meshBasicMaterial color="#ffcc33" transparent opacity={0.8} />
      </mesh>
      <mesh ref={cueLine}>
        <boxGeometry args={[0.004, 0.001, 1]} />
        <meshBasicMaterial color="#9fd3ff" transparent opacity={0.6} />
      </mesh>
      <mesh ref={ghost}>
        <sphereGeometry args={[R, 16, 10]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
      </mesh>
      {/* The cue */}
      <group ref={stick}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.014, 1.4, 10]} />
          <meshLambertMaterial color="#c9955a" />
        </mesh>
      </group>
    </group>
  )
}

export function BillardDefi({ onEnd, onStart, phone, extra }: { onEnd: (score: number) => void; onStart?: (on: boolean) => void; /** In the phone's « Billard 225 » app: no close button over it, « Rejouer » at the end. */ phone?: boolean; /** Under the opponents (the app's « Jouer contre un joueur »). */ extra?: React.ReactNode }) {
  const [foe, setFoe] = useState<(typeof FOES)[number] | null>(null)
  useEffect(() => {
    onStart?.(!!foe)
    return () => onStart?.(false)
  }, [foe, onStart])
  if (!foe)
    return (
      <div className="grid gap-2 p-4">
        <p className="text-center text-[13px] font-bold text-white/80">{tr('Le billard américain du maquis : rentre ta famille de billes (les pleines ou les rayées), puis la noire. Touche la table pour viser, règle la force, tire.')}</p>
        {FOES.map((f) => (
          <button key={f.id} className="rounded-2xl bg-white/12 px-4 py-3 text-left font-extrabold text-white transition active:scale-[0.98]" onClick={() => setFoe(f)}>
            {f.label}
            <span className="block text-[12px] font-bold text-white/60">{f.skill < 0.5 ? tr('Facile') : f.skill < 0.8 ? tr('Moyen') : tr('Fort')}</span>
          </button>
        ))}
        {extra}
      </div>
    )
  return <Match foe={foe} onEnd={onEnd} phone={phone} />
}

function Match({ foe, onEnd, phone }: { foe: (typeof FOES)[number]; onEnd: (score: number) => void; phone?: boolean }) {
  const game = useRef<Game>(newGame(Math.floor(Math.random() * 1000) + 1))
  // (At the rack, to begin with.)
  const aim = useRef(0)
  const [power, setPower] = useState(0.55)
  // The spin: where the cue strikes the cue ball (-1 low: rétro, +1 high: coulé).
  const [spin, setSpin] = useState(0)
  const [low, setLow] = useState(false)
  const [, render] = useState(0)
  const redraw = () => render((n) => n + 1)
  const g = game.current
  // The table running: the balls moved on each frame; the regular's turn played after a moment.
  useEffect(() => {
    let last = performance.now()
    let wait = 0
    let id = 0
    let sounded = 0
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const gm = game.current
      if (gm.moving) {
        step(gm, dt)
        // The sounds of the table: the balls clicking (louder when hard), the cushions, the pockets.
        const fx = gm.fx
        if (fx.pocket) sfx.pop()
        else if (fx.click && now - sounded > 40) (sfx.tick(fx.hard ? 2.2 : 1.6), (sounded = now))
        else if (fx.rail && now - sounded > 60) (sfx.tick(0.6), (sounded = now))
        Object.assign(fx, { click: 0, rail: 0, pocket: 0, hard: 0 })
        if (!gm.moving) {
          redraw()
          if (gm.winner !== null) haptic(gm.winner === 0 ? 'success' : 'heavy')
        }
      } else if (gm.turn === 1 && gm.winner === null) {
        wait += dt
        if (gm.inHand && wait > 0.4) (placeCue(gm, -TABLE.w / 4, 0), (gm.inHand = false), redraw())
        if (wait > 1.3) {
          wait = 0
          const s = aiShot(gm, foe.skill)
          aim.current = s.angle
          shoot(gm, s.angle, s.power, s.spin)
          sfx.chip()
          redraw()
        }
      } else wait = 0
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [foe.skill])
  const mine = g.turn === 0 && !g.moving && g.winner === null
  const fire = () => {
    if (!mine || g.inHand) return
    shoot(g, aim.current, power, spin)
    haptic('light')
    sfx.chip()
    redraw()
  }
  const nudge = (d: number) => ((aim.current += d), redraw())
  const groupName = (side: 0 | 1) => (g.groups[side] === 'pleines' ? tr('pleines') : g.groups[side] === 'rayees' ? tr('rayées') : tr('table ouverte'))
  const pot = (side: 0 | 1) =>
    g.groups[side]
      ? g.balls.filter((b) => groupOf(b.n) === g.groups[side]).map((b) => (
          <span key={b.n} className="inline-block h-3 w-3 rounded-full border border-black/30" style={{ background: colourOf(b.n), opacity: b.in ? 0.25 : 1 }} />
        ))
      : null
  return (
    <div className="flex h-full flex-col bg-[#0b2a1b] text-white">
      {/* Who plays, their balls, what the last shot did */}
      <div className={`grid grid-cols-2 gap-2 px-3 pb-1 text-[12px] font-extrabold ${phone ? 'pt-3' : 'pt-12'}`}>
        {([0, 1] as const).map((side) => (
          <div key={side} className={`rounded-xl px-2.5 py-1.5 ${g.turn === side && g.winner === null ? 'bg-[#ffcc33] text-[#3a2600]' : 'bg-white/10'}`}>
            <div>
              {side === 0 ? tr('Toi') : foe.name} · {groupName(side)}
            </div>
            <div className="mt-0.5 flex gap-0.5">{pot(side)}</div>
          </div>
        ))}
      </div>
      <div className="h-6 px-3 text-center text-[13px] font-extrabold text-[#ffe08a]">{g.winner === null ? (g.inHand && g.turn === 0 ? tr('Bille en main : touche la table pour poser la blanche.') : g.said || (g.turn === 1 ? tx('{0} joue…', { 0: foe.name }) : g.breakShot ? tr('À toi de casser !') : tr('À toi.'))) : g.said}</div>
      <div className="relative min-h-0 flex-1">
        <Canvas dpr={sceneDpr} camera={{ position: [0, 3.55, 0.3], fov: 42 }} onCreated={({ camera }) => camera.lookAt(0, 0, 0.02)} style={{ touchAction: 'none' }}>
          <hemisphereLight args={['#fff8e8', '#3b2a18', 1.1]} />
          <directionalLight position={[0.5, 4, 1]} intensity={1.1} />
          <Table
            game={game}
            aim={aim}
            power={power}
            mine={mine}
            low={low}
            onAim={(a) => ((aim.current = a), redraw())}
            onPlace={(x, z) => {
              placeCue(g, x, z)
              g.inHand = false
              redraw()
            }}
          />
        </Canvas>
      </div>
      {g.winner === null && (
        <div className="flex items-center justify-between px-3 pt-2">
          {/* The cue ball as the player sees it: touched high for the coulé, low for the rétro */}
          <div className="flex items-center gap-2">
            <button
              className="relative h-12 w-12 rounded-full bg-[#f4f1e8] shadow-inner"
              aria-label={tr('Effet')}
              onPointerDown={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                const y = (e.clientY - r.top) / r.height
                setSpin(Math.round(Math.max(-1, Math.min(1, (0.5 - y) * 2.4)) * 4) / 4)
              }}
            >
              <span className="absolute left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d62828]" style={{ top: `${50 - spin * 38}%` }} />
            </button>
            <span className="text-[11px] leading-tight font-extrabold text-white/75">
              {spin > 0.1 ? tr('Coulé') : spin < -0.1 ? tr('Rétro') : tr('Sans effet')}
              <span className="block text-[10px] font-bold text-white/45">{tr('touche la bille')}</span>
            </span>
          </div>
          <button className="rounded-full bg-white/15 px-3 py-2 text-[12px] font-extrabold" onClick={() => setLow((v) => !v)}>
            {low ? tr('Vue de dessus') : tr('Vue 3D')}
          </button>
        </div>
      )}
      {g.winner === null ? (
        <div className="flex items-center gap-2 px-3 pt-2 pb-5">
          <button className="h-11 w-11 rounded-full bg-white/15 text-lg font-extrabold" onClick={() => nudge(-0.006)} aria-label={tr('Viser à gauche')} disabled={!mine}>
            ‹
          </button>
          <button className="h-11 w-11 rounded-full bg-white/15 text-lg font-extrabold" onClick={() => nudge(0.006)} aria-label={tr('Viser à droite')} disabled={!mine}>
            ›
          </button>
          <label className="flex min-w-0 flex-1 flex-col text-[11px] font-extrabold text-white/70">
            {tx('Force {0} %', { 0: Math.round(power * 100) })}
            <input type="range" min={5} max={100} value={Math.round(power * 100)} onChange={(e) => setPower(Number(e.target.value) / 100)} className="accent-[#ffcc33]" />
          </label>
          <button className="rounded-full bg-[#ffcc33] px-5 py-3 font-extrabold text-[#3a2600] disabled:opacity-40" disabled={!mine || g.inHand} onClick={fire}>
            {tr('Tirer')}
          </button>
        </div>
      ) : (
        <div className="px-4 pt-2 pb-6 text-center">
          <div className="font-display text-[24px] font-extrabold">{g.winner === 0 ? tr('Gagné !') : tx('{0} gagne', { 0: foe.name })}</div>
          <div className="text-[13px] font-bold text-white/70">{tx('{0} de tes billes rentrées, {1} pour lui', { 0: g.groups[0] ? 7 - left(g, 0) : 0, 1: g.groups[1] ? 7 - left(g, 1) : 0 })}</div>
          <button className="btn mt-3 w-full !py-3" onClick={() => onEnd(score(g))}>
            {phone ? tr('Rejouer') : tr('Terminer')}
          </button>
        </div>
      )}
    </div>
  )
}

/* ---------- Against a player (components/pvp/play.tsx) ---------- */

/** A shot as sent to the other phone: where the cue ball was put down (ball in hand), the angle, the power, the spin, and the table once it came to rest. */
export type BillardMove = { pl?: [number, number]; a: number; p: number; s: number; st: Snap }

/**
 * Billard 225 against a player, shot by shot: seat 0 breaks. Each shot is played here and sent with the
 * table as it came to rest (snapshot); the other phone plays the same shot to show it, then puts the table
 * exactly as it was sent, so both see the same balls whatever their phone's arithmetic.
 */
export function BillardVersus({ seat, meId, me, them, moves, seed, left, busy, err, send, onOver }: {
  seat: 0 | 1
  /** This player's sim (its own shots come back from the server: put down, not played again). */
  meId: string
  me: string
  them: string
  moves: { by: string; m: BillardMove }[]
  /** The rack's seed (the same on both phones). */
  seed: number
  /** Seconds left for whoever plays. */
  left: number
  busy: boolean
  err: string | null
  send: (m: BillardMove, next: number) => void
  onOver: (winnerSeat: number) => void
}) {
  const game = useRef<Game>(newGame(seed))
  const aim = useRef(seat === 0 ? 0 : Math.PI)
  const [power, setPower] = useState(0.55)
  const [spin, setSpin] = useState(0)
  const [low, setLow] = useState(false)
  const [, render] = useState(0)
  const redraw = () => render((n) => n + 1)
  // The moves taken in so far; the snapshot to land on once the shot being shown has run.
  const applied = useRef(0)
  const landing = useRef<Snap | null>(null)
  // My own shot being played: what to send once the balls stop.
  const mine = useRef<Omit<BillardMove, 'st'> | null>(null)
  const placed = useRef<[number, number] | undefined>(undefined)
  const told = useRef(false)
  const g = game.current
  // The other's shots as they come: the earlier ones put down at once, the last one played out.
  useEffect(() => {
    const gm = game.current
    if (moves.length <= applied.current) return
    for (let k = applied.current; k < moves.length; k++) {
      const mv = moves[k].m
      const last = k === moves.length - 1
      if (!last || moves[k].by === meId || mine.current || gm.moving) {
        restore(gm, mv.st)
        continue
      }
      if (mv.pl) placeCue(gm, mv.pl[0], mv.pl[1])
      aim.current = mv.a
      shoot(gm, mv.a, mv.p, mv.s)
      landing.current = mv.st
    }
    applied.current = moves.length
    redraw()
  }, [moves.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let last = performance.now()
    let id = 0
    let sounded = 0
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const gm = game.current
      if (gm.moving) {
        step(gm, dt)
        const fx = gm.fx
        if (fx.pocket) sfx.pop()
        else if (fx.click && now - sounded > 40) (sfx.tick(fx.hard ? 2.2 : 1.6), (sounded = now))
        else if (fx.rail && now - sounded > 60) (sfx.tick(0.6), (sounded = now))
        Object.assign(fx, { click: 0, rail: 0, pocket: 0, hard: 0 })
        if (!gm.moving) {
          // My shot at rest: sent with the table as it is. The other's: the table put exactly as sent.
          if (mine.current) {
            send({ ...mine.current, st: snapshot(gm) }, gm.turn)
            mine.current = null
          } else if (landing.current) {
            restore(gm, landing.current)
            landing.current = null
          }
          redraw()
        }
      }
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // The game over (the 8 down): said once.
  useEffect(() => {
    if (g.winner === null || g.moving || told.current) return
    told.current = true
    haptic(g.winner === seat ? 'success' : 'heavy')
    onOver(g.winner)
  })
  const myTurn = g.turn === seat && !g.moving && g.winner === null && !busy && !mine.current
  const fire = () => {
    if (!myTurn || g.inHand) return
    mine.current = { pl: placed.current, a: aim.current, p: power, s: spin }
    placed.current = undefined
    shoot(g, aim.current, power, spin)
    haptic('light')
    sfx.chip()
    redraw()
  }
  const side = (k: 0 | 1) => (k === seat ? tr('Toi') : them)
  const groupName = (k: 0 | 1) => (g.groups[k] === 'pleines' ? tr('pleines') : g.groups[k] === 'rayees' ? tr('rayées') : tr('table ouverte'))
  const balls = (k: 0 | 1) =>
    g.groups[k]
      ? g.balls.filter((b) => groupOf(b.n) === g.groups[k]).map((b) => <span key={b.n} className="inline-block h-3 w-3 rounded-full border border-black/30" style={{ background: colourOf(b.n), opacity: b.in ? 0.25 : 1 }} />)
      : null
  const said = g.winner !== null ? (g.winner === seat ? tr('La noire dans la poche : partie gagnée !') : tx('{0} gagne', { 0: them })) : err || (g.inHand && g.turn === seat ? tr('Bille en main : touche la table pour poser la blanche.') : g.said || (g.turn === seat ? (g.breakShot ? tr('À toi de casser !') : tr('À toi.')) : tx('{0} joue…', { 0: them })))
  return (
    <div className="flex h-full flex-col bg-[#0b2a1b] text-white" data-pvp="billard">
      <div className="grid grid-cols-2 gap-2 px-3 pt-12 pb-1 text-[12px] font-extrabold">
        {(seat === 0 ? ([0, 1] as const) : ([1, 0] as const)).map((k) => (
          <div key={k} className={`rounded-xl px-2.5 py-1.5 ${g.turn === k && g.winner === null ? 'bg-[#ffcc33] text-[#3a2600]' : 'bg-white/10'}`}>
            <div>
              {k === seat ? me : side(k)} · {groupName(k)}
              {g.turn === k && g.winner === null && !g.moving ? ` · ${left} s` : ''}
            </div>
            <div className="mt-0.5 flex gap-0.5">{balls(k)}</div>
          </div>
        ))}
      </div>
      <div className="h-6 px-3 text-center text-[13px] font-extrabold text-[#ffe08a]">{said}</div>
      <div className="relative min-h-0 flex-1">
        <Canvas dpr={sceneDpr} camera={{ position: [0, 3.55, 0.3], fov: 42 }} style={{ touchAction: 'none' }}>
          <hemisphereLight args={['#fff8e8', '#3b2a18', 1.1]} />
          <directionalLight position={[0.5, 4, 1]} intensity={1.1} />
          <Table
            game={game}
            aim={aim}
            power={power}
            mine={myTurn}
            low={low}
            onAim={(a) => ((aim.current = a), redraw())}
            onPlace={(x, z) => {
              placeCue(g, x, z)
              const c = cue(g)
              placed.current = [c.x, c.z]
              g.inHand = false
              redraw()
            }}
          />
        </Canvas>
      </div>
      {g.winner === null && (
        <div className="flex items-center justify-between px-3 pt-2">
          <div className="flex items-center gap-2">
            <button
              className="relative h-12 w-12 rounded-full bg-[#f4f1e8] shadow-inner"
              aria-label={tr('Effet')}
              onPointerDown={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                setSpin(Math.round(Math.max(-1, Math.min(1, (0.5 - (e.clientY - r.top) / r.height) * 2.4)) * 4) / 4)
              }}
            >
              <span className="absolute left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d62828]" style={{ top: `${50 - spin * 38}%` }} />
            </button>
            <span className="text-[11px] leading-tight font-extrabold text-white/75">{spin > 0.1 ? tr('Coulé') : spin < -0.1 ? tr('Rétro') : tr('Sans effet')}</span>
          </div>
          <button className="rounded-full bg-white/15 px-3 py-2 text-[12px] font-extrabold" onClick={() => setLow((v) => !v)}>
            {low ? tr('Vue de dessus') : tr('Vue 3D')}
          </button>
        </div>
      )}
      {g.winner === null && (
        <div className="flex items-center gap-2 px-3 pt-2 pb-5">
          <button className="h-11 w-11 rounded-full bg-white/15 text-lg font-extrabold" onClick={() => ((aim.current -= 0.006), redraw())} aria-label={tr('Viser à gauche')} disabled={!myTurn}>
            ‹
          </button>
          <button className="h-11 w-11 rounded-full bg-white/15 text-lg font-extrabold" onClick={() => ((aim.current += 0.006), redraw())} aria-label={tr('Viser à droite')} disabled={!myTurn}>
            ›
          </button>
          <label className="flex min-w-0 flex-1 flex-col text-[11px] font-extrabold text-white/70">
            {tx('Force {0} %', { 0: Math.round(power * 100) })}
            <input type="range" min={5} max={100} value={Math.round(power * 100)} onChange={(e) => setPower(Number(e.target.value) / 100)} className="accent-[#ffcc33]" />
          </label>
          <button className="rounded-full bg-[#ffcc33] px-5 py-3 font-extrabold text-[#3a2600] disabled:opacity-40" disabled={!myTurn || g.inHand} onClick={fire}>
            {tr('Tirer')}
          </button>
        </div>
      )}
    </div>
  )
}
