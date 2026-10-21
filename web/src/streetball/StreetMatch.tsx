import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { RotateCcw, Trophy, Users, X } from 'lucide-react'
import type { Look } from '../lib/types'
import { randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'
import { LENGTH, NO_INPUT, buttons, createGame, outcome, step, type Game, type Input, type Sport, type Stats } from './game'
import { BallView, Crowd, Follow, Ground, PlayerView, upright } from './scene'
import { likesFor } from '../world3d/fans'
import { serverNow } from '../lib/worldClock'
import { MatchNet, fetchMatch, leaveMatch, type CourtEntry, type CourtMatch } from './online'

// The street match the player plays (game.ts, scene.tsx): opened when the
// Sim plays basketball or football. Three minutes, the score, the moves.
// Phone: the stick on the left; Passe, Tir, Crochet and Défense on the right.
// Keyboard: arrows / WASD / ZQSD to run, Space to shoot, J (or X) to pass,
// K (or C) for the crossover, L (or E) to defend (held: the stance).

export type MatchResult = { sport: Sport; score: [number, number]; result: 'win' | 'loss' | 'draw'; stats: Stats }

type Props = {
  sport: Sport
  name: string
  look: Look
  gender: 'femme' | 'homme'
  onExit: (r: MatchResult | null) => void
  /** The labs: the same match every time. */
  seed?: number
  /** At a court: the match with the other players there (streetball/online.ts). */
  online?: { token: string; simId: string; match: CourtMatch }
}

/** The two teams' kits: the player's team in orange, the others in green (or blue on the court). */
const KITS: Record<Sport, [string, string]> = { basket: ['#ff7a00', '#1d4ed8'], foot: ['#ff7a00', '#009e60'] }
const KEEPER = '#141416'

const mmss = (s: number) => {
  const t = Math.max(0, Math.ceil(s))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

type Hud = { score: [number, number]; left: number; time: number; flash: string | null; has: boolean; dunk: boolean; over: boolean; clear: boolean; /** At a court, seconds before the whistle (the others are coming). */ waiting: number }

function hudOf(g: Game, waiting = 0): Hud {
  const b = buttons(g)
  const me = g.ps[g.me]
  return {
    score: [g.score[0], g.score[1]],
    left: LENGTH - Math.max(0, g.time),
    time: g.time,
    flash: g.flash?.text ?? null,
    has: b.has,
    dunk: b.dunk,
    over: g.phase === 'over',
    // Basketball: won back under the basket, the player's team has to take it out past the arc.
    clear: g.sport === 'basket' && !g.cleared && g.poss === me.team && g.phase === 'play',
    waiting,
  }
}

export default function StreetMatch({ sport, name, look, gender, onExit, seed, online }: Props) {
  const [round, setRound] = useState(0)
  const game = useMemo(() => {
    let s = (seed ?? Math.floor(Math.random() * 1e9)) + round * 7919
    const r = () => {
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const g = createGame(sport, name, r)
    // At a court the player holds the place the match gave it.
    if (online) {
      const mine = online.match.entries.find((e) => e.sim === online.simId)
      if (mine && g.ps[mine.slot]) {
        g.ps[g.me].human = false
        g.ps[g.me].name = g.ps[mine.slot].name
        g.me = mine.slot
        g.ps[g.me].human = true
        g.ps[g.me].name = name
      }
    }
    return g
  }, [sport, name, seed, round, online])
  // The other players at the court: who's there (polled), and the line to them.
  const [entries, setEntries] = useState<CourtEntry[]>(online?.match.entries ?? [])
  // Opened in an effect (not a memo) so it's closed with the screen, and opened again if React mounts it twice.
  const [net, setNet] = useState<MatchNet | null>(null)
  useEffect(() => {
    if (!online) return
    const n = new MatchNet(online.token, online.simId, online.match.id)
    setNet(n)
    return () => {
      n.close()
      setNet(null)
    }
  }, [online])
  useEffect(() => {
    if (!online) return
    const t = setInterval(() => fetchMatch(online.token, online.match.id).then((m) => m && setEntries(m.entries)), 3000)
    return () => clearInterval(t)
  }, [online])
  // The players who came play their place; one who went is the AI's again.
  useEffect(() => {
    if (!net) return
    const fix = () => {
      for (const p of game.ps) {
        const e = entries.find((x) => x.slot === p.id)
        p.human = p.id === game.me || (!!e && net.here(e.sim))
        if (e && p.id !== game.me) p.name = e.name
      }
    }
    fix()
    const t = setInterval(fix, 1000)
    return () => clearInterval(t)
  }, [net, entries, game])
  // In development, the match is reachable from the console (the labs drive it).
  if (import.meta.env.DEV) (globalThis as { streetMatch?: Game }).streetMatch = game
  // The players' looks: the player's own, in the team's colours; the others, the quarter's faces.
  const looks = useMemo(() => {
    const r = rng(`street-${sport}`)
    return game.ps.map((p) => {
      const kit = p.keeper ? KEEPER : KITS[sport][p.team]
      const outfit = sport === 'basket' ? 'basket' : 'jersey'
      if (p.id === game.me) return { look: { ...look, outfit, outfitColor: kit, accessory: 'none' }, gender }
      const e = entries.find((x) => x.slot === p.id)
      if (e) return { look: { ...e.look, outfit, outfitColor: kit, accessory: 'none' }, gender: e.gender }
      const g: 'femme' | 'homme' = sport === 'basket' && r() < 0.25 ? 'femme' : 'homme'
      const base = randomLook(g, r)
      return { look: { ...base, outfit, outfitColor: kit, accessory: 'none', hair: base.hair === 'headwrap' ? 'short' : base.hair }, gender: g }
    })
  }, [game, sport, look, gender, entries])
  const input = useRef<Input>({ ...NO_INPUT })
  const touch = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches, [])
  const [hud, setHud] = useState<Hud>(() => hudOf(game))
  useKeyboard(input)
  const sceneSeed = `${sport}-${seed ?? 'street'}`

  return (
    <div className="fixed inset-0 z-50 touch-none bg-[#9fd3f2] select-none">
      <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 50, near: 0.3, far: 400, position: [0, 9, 14] }}>
        <color attach="background" args={['#9fd3f2']} />
        <fog attach="fog" args={['#9fd3f2', 60, 180]} />
        <hemisphereLight args={['#ffffff', '#8a7a5c', 1.15]} />
        <directionalLight position={[18, 30, 14]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24} />
        <Suspense fallback={null}>
          <Ground g={game} seed={sceneSeed} />
          {game.ps.map((p, i) => (
            <PlayerView key={`${round}-${p.id}`} g={game} i={i} look={looks[i].look} gender={looks[i].gender} />
          ))}
          <BallView g={game} />
          <Crowd g={game} seed={sceneSeed} />
        </Suspense>
        <Loop game={game} input={input} onHud={setHud} net={net} entries={entries} start={online?.match.start ?? 0} simId={online?.simId ?? ''} />
        <Follow g={game} />
      </Canvas>

      {/* The score, the clock */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2 rounded-2xl bg-[#0f1230]/75 px-3 py-2 text-white">
          <span className="h-4 w-4 rounded-sm" style={{ background: KITS[sport][0] }} />
          <span className="font-display text-3xl leading-none font-extrabold tabular-nums">{hud.score[0]}</span>
          <span className="text-lg font-extrabold opacity-60">-</span>
          <span className="font-display text-3xl leading-none font-extrabold tabular-nums">{hud.score[1]}</span>
          <span className="h-4 w-4 rounded-sm" style={{ background: KITS[sport][1] }} />
          <span className="ml-2 rounded-lg bg-white/15 px-2 py-0.5 text-sm font-extrabold tabular-nums">{mmss(hud.left)}</span>
        </div>
        <button
          className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-[#0f1230]/70 text-white"
          onClick={() => {
            if (online) void leaveMatch(online.token, online.simId, online.match.id)
            onExit(null)
          }}
          aria-label="Quitter le match"
        >
          <X size={22} />
        </button>
      </div>
      {hud.clear && <div className="pointer-events-none absolute top-[max(4.6rem,calc(env(safe-area-inset-top)+4rem))] left-1/2 -translate-x-1/2 rounded-xl bg-[#0f1230]/70 px-3 py-1 text-xs font-extrabold whitespace-nowrap text-white">Ressors la balle derrière l'arc !</div>}

      {hud.time < 1 && hud.waiting <= 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div key={Math.ceil(-hud.time)} className="animate-up font-display text-[110px] leading-none font-extrabold text-white drop-shadow-[0_6px_0_rgba(0,0,0,0.35)]">
            {hud.time < 0 ? Math.ceil(-hud.time) : 'Jouez !'}
          </div>
        </div>
      )}
      {hud.flash && hud.time >= 1 && !hud.over && (
        <div className="pointer-events-none absolute inset-x-0 top-[max(4.8rem,calc(env(safe-area-inset-top)+4.2rem))] text-center">
          <span key={hud.flash} className="animate-up inline-block rounded-2xl bg-[#ffd43b] px-4 py-2 font-display text-2xl font-extrabold text-[#141416] shadow-lg">
            {hud.flash}
          </span>
        </div>
      )}

      {!hud.over && <Pad input={input} hud={hud} sport={sport} touch={touch} />}
      {online && hud.waiting > 0 && <Waiting entries={entries} cap={online.match.cap} left={hud.waiting} sport={sport} />}

      {hud.over && (
        <Result
          game={game}
          onExit={() => {
            if (online) void leaveMatch(online.token, online.simId, online.match.id)
            onExit({ sport, score: [game.score[0], game.score[1]], result: outcome(game), stats: { ...game.stats } })
          }}
          // At a court the next match is the court's: back on from the street.
          onReplay={
            online
              ? undefined
              : () => {
                  input.current = { ...NO_INPUT }
                  setRound((r) => r + 1)
                }
          }
        />
      )}
    </div>
  )
}

/** The match steps every frame (in small steps, so a slow phone plays the same); the HUD is refreshed ten times a second. */
function Loop({ game, input, onHud, net, entries, start, simId }: { game: Game; input: React.MutableRefObject<Input>; onHud: (h: Hud) => void; net: MatchNet | null; entries: CourtEntry[]; start: number; simId: string }) {
  const acc = useRef(0)
  const sent = useRef(0)
  const said = useRef<string | null>(null)
  const size = useThree((s) => s.size)
  useFrame((_, dtRaw) => {
    const total = Math.min(Math.max(dtRaw, 0), 0.25)
    const steps = Math.max(1, Math.ceil(total / (1 / 60)))
    const dt = total / steps
    // Football on a phone held upright: the camera looks up the pitch, so up the screen is +x and right is +z.
    const inp = input.current
    const turned = game.sport === 'foot' && upright(size)
    const mine = turned ? { ...inp, mx: -inp.mz, mz: inp.mx } : { ...inp }
    // At a court: nothing moves before the whistle; then the first player
    // there runs the match, the others draw what it sends.
    const waiting = net ? Math.max(0, (start - serverNow()) / 1000) : 0
    const boss = net ? net.host(entries) : simId
    const host = boss === simId
    if (net) net.press(inp)
    if (waiting <= 0 && boss) {
      if (host) {
        const others = net?.inputs(entries)
        for (let i = 0; i < steps; i++) {
          step(game, dt, i === 0 ? mine : { ...mine, pass: false, shoot: false, skill: false, defend: false }, others)
          // The others' presses count once, on the first small step.
          if (i === 0 && others) for (const [k, v] of others) others.set(k, { ...v, pass: false, shoot: false, skill: false, defend: false })
        }
        if (net && game.flash && game.flash.text !== said.current) net.say(game.flash.text)
        said.current = game.flash?.text ?? null
      } else if (!net!.apply(game, boss)) {
        // The match's phone has gone quiet: this one plays on from where it was.
        for (let i = 0; i < steps; i++) step(game, dt, i === 0 ? mine : { ...mine, pass: false, shoot: false, skill: false, defend: false }, net!.inputs(entries))
      }
    }
    // The buttons are presses, not holds.
    inp.pass = inp.shoot = inp.skill = inp.defend = false
    if (net) {
      sent.current += total
      if (sent.current > 0.075) {
        sent.current = 0
        const me = game.ps[game.me]
        net.send(mine, [me.x, me.z], host && waiting <= 0 ? game : null)
      }
    }
    acc.current += total
    if (acc.current > 0.1) {
      acc.current = 0
      onHud(hudOf(game, waiting))
    }
  })
  return null
}

/** Before the whistle at a court: who has come, how many places are left, the countdown. */
function Waiting({ entries, cap, left, sport }: { entries: CourtEntry[]; cap: number; left: number; sport: Sport }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[max(5rem,calc(env(safe-area-inset-top)+4.5rem))] grid place-items-center px-4">
      <div className="sheet animate-up w-full max-w-sm rounded-[24px] p-4">
        <div className="flex items-center gap-2 font-display text-lg font-extrabold">
          <Users size={20} className="text-[var(--color-orange)]" />
          {sport === 'foot' ? 'Match de foot' : 'Match de basket'} dans {Math.ceil(left)} s
        </div>
        <div className="mt-1 text-xs font-bold text-[var(--color-muted)]">
          {entries.length}/{cap} joueurs · les places libres sont prises par les gars du quartier. Tes amis te rejoignent en venant jouer ici.
        </div>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {entries.map((e) => (
            <li key={e.sim} className="motion-rise rounded-full bg-[var(--color-canvas)] px-2.5 py-1 text-xs font-extrabold">
              {e.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** The keyboard: arrows / WASD / ZQSD, Space shoot, J or X pass, K or C crossover, L or E defend. */
function useKeyboard(input: React.MutableRefObject<Input>) {
  useEffect(() => {
    const keys = new Set<string>()
    const apply = () => {
      const i = input.current
      const x = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') || keys.has('KeyQ') ? 1 : 0)
      const z = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') || keys.has('KeyZ') ? 1 : 0)
      const l = Math.hypot(x, z) || 1
      i.mx = x / l
      i.mz = z / l
      i.guard = keys.has('KeyL') || keys.has('KeyE')
    }
    const down = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault()
      if (!e.repeat) {
        if (e.code === 'Space') input.current.shoot = true
        if (e.code === 'KeyJ' || e.code === 'KeyX') input.current.pass = true
        if (e.code === 'KeyK' || e.code === 'KeyC') input.current.skill = true
        if (e.code === 'KeyL' || e.code === 'KeyE') input.current.defend = true
      }
      keys.add(e.code)
      apply()
    }
    const up = (e: KeyboardEvent) => {
      keys.delete(e.code)
      apply()
    }
    const blur = () => {
      keys.clear()
      apply()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [input])
}

/** The stick: drag the knob to run; it springs back on release. */
function Stick({ input }: { input: React.MutableRefObject<Input> }) {
  const base = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0, on: false })
  const release = () => {
    input.current.mx = input.current.mz = 0
    setKnob({ x: 0, y: 0, on: false })
  }
  const move = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect()
    const R = r.width * 0.38
    let dx = e.clientX - (r.left + r.width / 2)
    let dy = e.clientY - (r.top + r.height / 2)
    const d = Math.hypot(dx, dy)
    if (d > R) [dx, dy] = [(dx / d) * R, (dy / d) * R]
    setKnob({ x: dx, y: dy, on: true })
    const m = Math.hypot(dx, dy) / R
    const k = m < 0.12 ? 0 : (m - 0.12) / 0.88 / (m || 1)
    input.current.mx = (dx / R) * k
    input.current.mz = (dy / R) * k
  }
  useEffect(() => () => void (input.current.mx = input.current.mz = 0), [input])
  return (
    <div
      ref={base}
      role="slider"
      aria-label="Courir"
      aria-valuetext={knob.on ? 'en course' : 'à l’arrêt'}
      className="pointer-events-auto relative grid h-32 w-32 shrink-0 touch-none place-items-center rounded-full border-4 border-white/50 bg-[#0f1230]/35"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        move(e)
      }}
      onPointerMove={(e) => knob.on && move(e)}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span className="block h-14 w-14 rounded-full bg-[#ff8200] shadow-[0_6px_16px_-6px_rgba(224,90,0,0.9)]" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  )
}

/** The four moves on the right; their labels follow what they do now (with the ball or without). */
function Pad({ input, hud, sport, touch }: { input: React.MutableRefObject<Input>; hud: Hud; sport: Sport; touch: boolean }) {
  const press = (k: 'pass' | 'shoot' | 'skill' | 'defend') => (e: React.PointerEvent) => {
    e.preventDefault()
    input.current[k] = true
    if (k === 'defend') input.current.guard = true
  }
  const lift = () => (input.current.guard = false)
  const btn = 'pointer-events-auto grid place-items-center rounded-full font-display font-extrabold shadow-[0_6px_0_rgba(0,0,0,0.25)] active:translate-y-[3px] active:shadow-[0_3px_0_rgba(0,0,0,0.25)] transition-opacity'
  const off = 'opacity-45'
  const basket = sport === 'basket'
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Stick input={input} />
      <div className="flex flex-col items-end gap-2">
        {!touch && <span className="text-right text-[11px] font-bold text-white drop-shadow">Flèches courir · Espace tir · J passe · K crochet · L défense</span>}
        <div className="grid grid-cols-2 gap-3">
          <button className={`${btn} h-16 w-16 bg-[#2563eb] text-sm text-white`} onPointerDown={press('pass')}>
            {hud.has ? 'Passe' : 'Appelle'}
          </button>
          <button className={`${btn} h-20 w-20 text-base text-white ${hud.dunk ? 'animate-pulse bg-[#e11d48]' : 'bg-[#ff8200]'} ${!hud.has && !basket ? off : ''}`} onPointerDown={press('shoot')}>
            {hud.dunk ? 'Dunk !' : hud.has ? 'Tir' : basket ? 'Saut' : 'Tir'}
          </button>
          <button className={`${btn} h-16 w-16 bg-[#ffd43b] text-xs text-[#141416] ${hud.has ? '' : off}`} onPointerDown={press('skill')}>
            {basket ? 'Crossover' : 'Crochet'}
          </button>
          <button className={`${btn} h-16 w-16 bg-[#16a34a] text-xs text-white ${hud.has ? off : ''}`} onPointerDown={press('defend')} onPointerUp={lift} onPointerCancel={lift} onPointerLeave={lift}>
            Défense
          </button>
        </div>
      </div>
    </div>
  )
}

/** The final whistle: the score, what the player did, what the people filming made of it. */
function Result({ game, onExit, onReplay }: { game: Game; onExit: () => void; onReplay?: () => void }) {
  const r = outcome(game)
  const s = game.stats
  const foot = game.sport === 'foot'
  const lines: [string, number][] = (
    foot
      ? [
          ['Buts', s.goals],
          ['Passes décisives', s.assists],
          ['Ballons récupérés', s.steals],
          ['Chevilles cassées', s.ankles],
        ]
      : [
          ['Points', s.points],
          ['Dunks', s.dunks],
          ['Passes décisives', s.assists],
          ['Interceptions', s.steals],
          ['Contres', s.blocks],
          ['Chevilles cassées', s.ankles],
        ]
  ) as [string, number][]
  // The player's best moment, filmed from the fence.
  const best = s.dunks ? 'ton dunk' : s.goals ? 'ton but' : s.ankles ? 'ta cheville cassée' : s.blocks ? 'ton contre' : null
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#0f1230]/60 p-4">
      <div className="sheet animate-up w-full max-w-sm rounded-[28px] p-5">
        <div className="flex items-center gap-2">
          <Trophy size={22} className="text-[var(--color-orange)]" />
          <div className="font-display text-2xl font-extrabold">{r === 'win' ? 'Victoire !' : r === 'loss' ? 'Défaite…' : 'Match nul'}</div>
        </div>
        <div className="mt-2 flex items-center justify-center gap-3 font-display text-4xl font-extrabold tabular-nums">
          <span className="h-5 w-5 rounded" style={{ background: KITS[game.sport][0] }} />
          {game.score[0]} - {game.score[1]}
          <span className="h-5 w-5 rounded" style={{ background: KITS[game.sport][1] }} />
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-1.5">
          {lines.map(([k, v]) => (
            <li key={k} className="flex items-center justify-between rounded-xl bg-[var(--color-canvas)] px-3 py-1.5 text-sm font-extrabold">
              <span className="text-xs">{k}</span>
              <span className="tabular-nums">{v}</span>
            </li>
          ))}
        </ul>
        {best && <p className="mt-2 rounded-xl bg-[#fff1f5] px-3 py-2 text-xs font-bold text-[#9d174d]">Au bord du terrain, on a filmé {best} : posté sur Tikitoko, ♥ {likesFor(game.score[0] + s.points + s.goals * 3)}</p>}
        <div className={`mt-4 grid gap-2 ${onReplay ? 'grid-cols-2' : ''}`}>
          <button className="btn btn-soft" onClick={onExit}>
            Sortir
          </button>
          {onReplay && (
            <button className="btn" onClick={onReplay}>
              <RotateCcw size={18} /> Rejouer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
