import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { sceneDpr } from '../../lib/device'
import { haptic } from '../../lib/native'
import { sfx } from '../../lib/sfx'
import { t as tr, tx } from '../../lib/i18n'
import { aiShot, aimHit, cue, groupOf, left, newGame, placeCue, POCKETS, R, score, shoot, step, TABLE, type Game } from '../../billard/pool'

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

function Table({ game, aim, power, onAim, onPlace, mine }: { game: React.RefObject<Game>; aim: React.RefObject<number>; power: number; onAim: (a: number) => void; onPlace: (x: number, z: number) => void; mine: boolean }) {
  const balls = useRef<(THREE.Mesh | null)[]>([])
  const stick = useRef<THREE.Group>(null)
  const line = useRef<THREE.Mesh>(null)
  const ghost = useRef<THREE.Mesh>(null)
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
  })
  const touch = (e: ThreeEvent<PointerEvent>) => {
    const g = game.current
    if (!g || g.moving || g.winner !== null || g.turn !== 0) return
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

export function BillardDefi({ onEnd, onStart }: { onEnd: (score: number) => void; onStart?: (on: boolean) => void }) {
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
      </div>
    )
  return <Match foe={foe} onEnd={onEnd} />
}

function Match({ foe, onEnd }: { foe: (typeof FOES)[number]; onEnd: (score: number) => void }) {
  const game = useRef<Game>(newGame(Math.floor(Math.random() * 1000) + 1))
  // (At the rack, to begin with.)
  const aim = useRef(0)
  const [power, setPower] = useState(0.55)
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
        const was = gm.shot.potted.length
        step(gm, dt)
        if (gm.shot.potted.length > was && now - sounded > 120) (sfx.chip(), (sounded = now))
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
          shoot(gm, s.angle, s.power)
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
    shoot(g, aim.current, power)
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
      <div className="grid grid-cols-2 gap-2 px-3 pt-12 pb-1 text-[12px] font-extrabold">
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
            onAim={(a) => ((aim.current = a), redraw())}
            onPlace={(x, z) => {
              placeCue(g, x, z)
              g.inHand = false
              redraw()
            }}
          />
        </Canvas>
      </div>
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
            {tr('Terminer')}
          </button>
        </div>
      )}
    </div>
  )
}
