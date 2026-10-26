import { rumble, stickOwner, useGamepad } from '../../lib/gamepad'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Flame, Trophy } from 'lucide-react'
import { haptic } from '../../lib/native'
import { sfx } from '../../lib/sfx'
import { useEngine } from '../../audio/engine'
import { useKeys } from './arcade'
import { autoDrive, createRace, LAPS, raceScore, RIVALS, standing, stepRace, type Race, type RaceEvent, type Rival } from './race/engine'
import { RaceCanvas } from './race/Scene'

// La course à deux, on the console of the salle de jeux: your car against
// a driver of the city, two laps of a street circuit of the Plateau and the
// lagoon at dusk, through the traffic (race/engine.ts, race/Scene.tsx). The
// car goes by itself; ◀ ▶ steer, « Frein » brakes (held into a bend at
// speed: a drift, its mini-turbo when let go), « Nitro » takes a third of
// the gauge, which fills by grazing the traffic, drifting, following close.

const BEATEN = 'babi.course.beaten'
const nf1 = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function beaten(): string[] {
  try {
    return JSON.parse(localStorage.getItem(BEATEN) ?? '[]')
  } catch {
    return []
  }
}

export function CourseDefi({ onEnd, onStart }: { onEnd: (score: number) => void; /** The rival chosen: the race is on (or off again). */ onStart?: (on: boolean) => void }) {
  const [rival, setRival] = useState<Rival | null>(null)
  useEffect(() => {
    onStart?.(!!rival)
    return () => onStart?.(false)
  }, [rival, onStart])
  if (!rival) return <Pick onPick={setRival} />
  return <Drive rival={rival} onEnd={onEnd} />
}

function Pick({ onPick }: { onPick: (r: Rival) => void }) {
  const done = useMemo(beaten, [])
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,#7a3b2e,#1a1030)] px-4 pt-14 pb-6 text-white">
      <div className="text-center font-display text-[26px] leading-tight font-extrabold">Contre qui tu cours ?</div>
      <p className="mt-1 text-center text-[13px] font-bold text-white/70">Deux tours du Plateau, au coucher du soleil.</p>
      <div className="mt-4 space-y-2.5">
        {RIVALS.map((r, k) => (
          <button key={r.id} className="flex w-full items-center gap-3 rounded-[22px] bg-white/10 p-3 text-left ring-1 ring-white/10 transition active:scale-[0.98]" onClick={() => onPick(r)}>
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl" style={{ background: r.color }}>
              <svg viewBox="0 0 40 24" className="w-10">
                <path d="M3 17 L6 10 Q8 7 12 7 L26 7 Q30 7 33 11 L37 13 Q38 14 38 16 L38 18 L3 18 Z" fill="#fff" opacity="0.92" />
                <circle cx="11" cy="18" r="3.4" fill="#16161c" />
                <circle cx="30" cy="18" r="3.4" fill="#16161c" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 font-display text-[18px] leading-tight font-extrabold">
                {r.name}
                {done.includes(r.id) && <Trophy size={15} className="text-[#ffc233]" />}
              </span>
              <span className="block text-[12.5px] leading-snug font-bold text-white/70">{r.about}</span>
              <span className="mt-1 flex items-center gap-1 text-[11.5px] font-extrabold text-[#ffc233]">
                {[0, 1, 2].map((s) => (
                  <Flame key={s} size={13} className={s <= k ? '' : 'opacity-25'} />
                ))}
                <span className="ml-1 text-white/60">jusqu'à {[70, 85, 100][k]} points</span>
              </span>
            </span>
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-2xl bg-black/25 p-3 text-[12.5px] leading-snug font-bold text-white/75">
        <div className="mb-1 font-extrabold text-white">Comment on gagne</div>
        La voiture accélère toute seule. Freine avant les virages serrés ; garde « Frein » appuyé en tournant vite pour déraper, et lâche : mini-turbo. Frôle les woro-woros et les gbakas sans les toucher, suis l'autre de près : ta jauge de
        nitro se remplit.
      </div>
    </div>
  )
}

type Hud = { lap: number; first: boolean; kmh: number; nitro: number; time: number; said: string; saidAt: number; count: number }

function Drive({ rival, onEnd }: { rival: Rival; onEnd: (score: number) => void }) {
  const R = useRef<Race>(createRace(rival))
  const keys = useKeys()
  const pad = useRef({ steer: 0, brake: false, nitro: false })
  const ended = useRef(false)
  const engine = useEngine()
  const rank = RIVALS.indexOf(rival)
  const [hud, setHud] = useState<Hud>({ lap: 1, first: false, kmh: 0, nitro: 0.34, time: -3, said: '', saidAt: -9, count: 3 })
  const shown = useRef(hud)
  // A controller: the left stick (or the cross) steers, LT or B brakes (and drifts), A, RT or Y the nitro.
  const padStick = useMemo(() => stickOwner(), [])
  const padBrake = useRef(false)
  useGamepad((g) => {
    const p = pad.current
    const dx = (g.held.has('right') ? 1 : 0) - (g.held.has('left') ? 1 : 0)
    padStick(g.lx || dx, 0, (x) => (p.steer = x))
    const brake = g.lt > 0.3 || g.held.has('b') || g.held.has('rb') || g.held.has('lb')
    if (brake !== padBrake.current) p.brake = brake
    padBrake.current = brake
    if (g.pressed.has('a') || g.pressed.has('rt') || g.pressed.has('y')) p.nitro = true
  })
  // In development, the race for the test pilot in the browser.
  if (import.meta.env.DEV) Object.assign(globalThis, { __course: R })
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!e.repeat && (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyN' || e.code === 'ShiftLeft')) pad.current.nitro = true
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])
  // The circuit seen from above, for the little map.
  const map = useMemo(() => {
    const tr = R.current.track
    let [x0, x1, z0, z1] = [Infinity, -Infinity, Infinity, -Infinity]
    for (let i = 0; i < tr.n; i++) ((x0 = Math.min(x0, tr.x[i])), (x1 = Math.max(x1, tr.x[i])), (z0 = Math.min(z0, tr.z[i])), (z1 = Math.max(z1, tr.z[i])))
    const k = 84 / Math.max(x1 - x0, z1 - z0)
    const at = (x: number, z: number): [number, number] => [8 + (x - x0) * k, 8 + (z - z0) * k]
    let d = ''
    for (let i = 0; i < tr.n; i += 8) {
      const [a, b] = at(tr.x[i], tr.z[i])
      d += `${i ? 'L' : 'M'}${a.toFixed(1)} ${b.toFixed(1)}`
    }
    return { d: d + 'Z', at }
  }, [])

  const onFrame = (dt: number): RaceEvent[] => {
    const r = R.current
    const k = keys.current
    const p = pad.current
    const steer = Math.max(-1, Math.min(1, p.steer + (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0)))
    // The screen's right is the driver's right: the side vector, the other way round from the heading's sin.
    let input = { steer: -steer, brake: p.brake || k.has('ArrowDown') || k.has('KeyS') || k.has('Space'), nitro: p.nitro }
    // In the lab, ?auto: the car drives itself (to look round the circuit).
    if (import.meta.env.DEV && location.search.includes('auto')) input = autoDrive(r, r.cars[0], { ...rival, skill: 1, eyes: 1, nitro: 1 })
    p.nitro = false
    const before = r.time
    stepRace(r, dt, input, rival)
    const evs = r.events.splice(0)
    const me = r.cars[0]
    engine(me.speed * 0.8, me.boost > 0)
    // The count before the start, beeped.
    for (const n of [-3, -2, -1, 0]) if (before < n && r.time >= n) n < 0 ? sfx.tick(1) : sfx.tick(2)
    let said = ''
    for (const e of evs) {
      if (!e.me && e.kind !== 'pass' && e.kind !== 'finish') continue
      if (e.kind === 'crash' || e.kind === 'wall' || e.kind === 'bump') rumble(e.kind === 'crash' ? 0.9 : 0.45, e.kind === 'crash' ? 350 : 120)
      if (e.kind === 'crash') {
        sfx.fall()
        haptic('heavy')
        said = e.text ?? 'Aïe !'
      } else if (e.kind === 'wall') {
        sfx.guard()
        haptic(e.big ? 'medium' : 'light')
      } else if (e.kind === 'bump') sfx.guard()
      else if (e.kind === 'graze') {
        sfx.swish()
        said = 'Frôlé ! +nitro'
      } else if (e.kind === 'turbo') {
        sfx.swish(true)
        said = e.big ? 'Super mini-turbo !' : 'Mini-turbo !'
      } else if (e.kind === 'nitro') {
        sfx.rise()
        haptic('medium')
      } else if (e.kind === 'lap') {
        sfx.bell()
        said = 'Dernier tour !'
      } else if (e.kind === 'pass') said = e.me ? 'Tu le doubles !' : 'Il te double !'
      else if (e.kind === 'finish' && e.me) said = standing(r).first ? 'Victoire !' : '2e place'
      else if (e.kind === 'finish') said = `${rival.name} a fini`
    }
    const st = me.progress >= r.cars[1].progress
    const next: Hud = {
      lap: Math.min(LAPS, me.lap + 1),
      first: me.finished !== null ? standing(r).first : st,
      kmh: Math.round(me.speed * 3.6),
      nitro: Math.round(me.nitro * 100) / 100,
      time: Math.floor(Math.max(0, r.time) * 10) / 10,
      said: said || shown.current.said,
      saidAt: said ? r.time : shown.current.saidAt,
      count: r.time < 0 ? Math.ceil(-r.time) : r.time < 0.8 ? 0 : -1,
    }
    const s = shown.current
    if (next.kmh !== s.kmh || next.lap !== s.lap || next.first !== s.first || next.nitro !== s.nitro || next.time !== s.time || next.saidAt !== s.saidAt || next.count !== s.count) {
      shown.current = next
      setHud(next)
    }
    if (r.over && !ended.current) {
      ended.current = true
      const { first, gap } = standing(r)
      if (first)
        try {
          localStorage.setItem(BEATEN, JSON.stringify([...new Set([...beaten(), rival.id])]))
        } catch {
          /* private mode: not kept */
        }
      first ? sfx.win(gap > 3) : sfx.lose()
      haptic(first ? 'success' : 'error')
      setTimeout(() => onEnd(raceScore(first, gap, rank)), 1800)
    }
    return evs
  }

  const t = R.current.time
  const r = R.current
  const saying = hud.said && t - hud.saidAt < 1.3
  const [mx, mz] = map.at(r.cars[0].x, r.cars[0].z)
  const [ox, oz] = map.at(r.cars[1].x, r.cars[1].z)
  const hold = (on: () => void, off: () => void) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => (e.currentTarget.setPointerCapture(e.pointerId), on()),
    onPointerUp: off,
    onPointerCancel: off,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  })
  const steerBtn = (d: -1 | 1) =>
    hold(
      () => (pad.current.steer = d),
      () => pad.current.steer === d && (pad.current.steer = 0),
    )
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#1a1030]">
      <div className="absolute inset-0">
        <RaceCanvas R={R} onFrame={onFrame} />
      </div>
      {/* The race: place, lap, time; the little map. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-3 pt-3 text-white">
        <div className="space-y-1">
          <div className={`rounded-xl px-3 py-0.5 font-display text-[30px] leading-tight font-extrabold shadow-[0_3px_0_rgba(0,0,0,0.35)] ${hud.first ? 'bg-[#ffc233] text-[#16161c]' : 'bg-[#1c7ed6]'}`}>{hud.first ? '1er' : '2e'}</div>
          <div className="rounded-lg bg-black/45 px-2 py-0.5 font-display text-[14px] font-extrabold">
            Tour {hud.lap}/{LAPS}
          </div>
          <div className="rounded-lg bg-black/45 px-2 py-0.5 font-display text-[14px] font-extrabold tabular-nums">{nf1(hud.time)} s</div>
        </div>
        <svg viewBox="0 0 100 100" className="mt-9 h-[96px] w-[96px] rounded-2xl bg-black/40 p-1">
          <path d={map.d} fill="none" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="3.5" strokeLinejoin="round" />
          <circle cx={ox} cy={oz} r="4.2" fill={rival.color} stroke="#fff" strokeWidth="1.2" />
          <circle cx={mx} cy={mz} r="4.6" fill="#ff7a00" stroke="#fff" strokeWidth="1.5" />
        </svg>
      </div>
      {hud.count >= 0 && (
        <div key={hud.count} className="animate-pop pointer-events-none absolute inset-x-0 top-[28%] text-center font-display text-[78px] leading-none font-extrabold text-white [text-shadow:0_5px_0_rgba(0,0,0,0.45)]">
          {hud.count > 0 ? hud.count : 'Partez !'}
        </div>
      )}
      {saying && (
        <div key={hud.saidAt} className="animate-pop pointer-events-none absolute inset-x-0 top-[22%] text-center font-display text-[34px] leading-none font-extrabold text-white [text-shadow:0_4px_0_rgba(0,0,0,0.5)]">
          {hud.said}
        </div>
      )}
      {/* The speed and the nitro. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[132px] flex flex-col items-center text-white">
        <div className="font-display text-[44px] leading-none font-extrabold tabular-nums [text-shadow:0_3px_0_rgba(0,0,0,0.5)]">{hud.kmh}</div>
        <div className="text-[11px] font-extrabold tracking-widest text-white/80">KM/H</div>
        <div className="mt-1.5 flex gap-1">
          {[0, 1, 2].map((s) => {
            const fill = Math.max(0, Math.min(1, (hud.nitro - s / 3) * 3))
            return (
              <span key={s} className="h-2.5 w-12 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/40">
                <span className="block h-full bg-[linear-gradient(90deg,#3bc9db,#7048e8)]" style={{ width: `${fill * 100}%` }} />
              </span>
            )
          })}
        </div>
      </div>
      {/* The pad. */}
      <div className="absolute inset-x-0 bottom-0 flex h-[124px] items-center justify-between gap-2 px-4 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-2">
          {([-1, 1] as const).map((d) => (
            <button
              key={d}
              className="grid h-[78px] w-[78px] touch-none place-items-center rounded-full bg-white/90 text-[#16161c] shadow-[0_5px_0_rgba(0,0,0,0.3)] select-none active:translate-y-1"
              {...steerBtn(d)}
              aria-label={d < 0 ? 'À gauche' : 'À droite'}
            >
              {d < 0 ? <ChevronLeft size={40} strokeWidth={3} /> : <ChevronRight size={40} strokeWidth={3} />}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <button
            className="grid h-[70px] w-[70px] touch-none place-items-center rounded-full bg-[#495057] font-display text-[14px] font-extrabold text-white shadow-[0_5px_0_rgba(0,0,0,0.35)] select-none active:translate-y-1"
            {...hold(
              () => (pad.current.brake = true),
              () => (pad.current.brake = false),
            )}
          >
            Frein
          </button>
          <button
            className={`grid h-[84px] w-[84px] touch-none place-items-center rounded-full bg-[linear-gradient(160deg,#3bc9db,#7048e8)] font-display text-[15px] font-extrabold text-white shadow-[0_5px_0_rgba(0,0,0,0.35)] select-none active:translate-y-1 ${hud.nitro < 0.33 ? 'opacity-40' : ''}`}
            {...hold(
              () => (pad.current.nitro = true),
              () => undefined,
            )}
          >
            Nitro
          </button>
        </div>
      </div>
    </div>
  )
}
