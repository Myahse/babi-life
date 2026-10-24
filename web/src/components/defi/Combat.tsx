import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { haptic } from '../../lib/native'
import { clamp, Count, hold, PadButton, useCanvas, useCount, useKeys, useLoop } from './arcade'

// Le jeu de combat, manette contre manette: two fighters face to face in a
// street of Treichville at night, the crowd round them. ◀ ▶ move; « Poing »
// is quick and short, « Pied » slower and further, « Garde » held takes the
// blows (a scratch gets through); each blow fills the jauge, and full, the
// « Coupé-décalé » goes off: a dash that hurts. Two rounds won take the match
// (45 seconds a round: at the bell, the most life left wins it).

const W = 360
const H = 300
const GROUND = 252
const ROUND = 45
const RIVAL = "Le Boss d'Adjamé"

type Move = 'punch' | 'kick' | 'super'
type State = 'idle' | 'walk' | Move | 'block' | 'hit' | 'ko'
type F = { x: number; vx: number; hp: number; state: State; t: number; stun: number; meter: number; landed: boolean; face: 1 | -1; ai: number; blockFor: number }
const MOVES: Record<Move, { start: number; active: number; rec: number; range: number; dmg: number; stun: number; knock: number }> = {
  punch: { start: 0.07, active: 0.08, rec: 0.16, range: 42, dmg: 6, stun: 0.25, knock: 30 },
  kick: { start: 0.15, active: 0.1, rec: 0.28, range: 56, dmg: 11, stun: 0.35, knock: 60 },
  super: { start: 0.1, active: 0.38, rec: 0.3, range: 46, dmg: 22, stun: 0.6, knock: 150 },
}
const busy = (f: F) => f.state === 'punch' || f.state === 'kick' || f.state === 'super' || f.state === 'hit' || f.state === 'ko'

/** The match as a score: won 2–0 from 80, 2–1 from 62 (more with life left); lost, by the blows given. */
export function fightScore(won: number, lost: number, hpLeft: number, dealt: number) {
  if (won >= 2) return Math.round(Math.min(100, (lost === 0 ? 80 : 62) + hpLeft / 5))
  return Math.round(won === 1 ? 30 + Math.min(15, dealt / 14) : Math.min(25, dealt / 8))
}

export function CombatDefi({ onEnd }: { onEnd: (score: number) => void }) {
  const { ref, ctx } = useCanvas(W, H)
  const keys = useKeys()
  const ask = useRef({ dir: 0, punch: false, kick: false, guard: false, super: false })
  const n = useCount(3)
  const st = useRef({ me: fighter(110, 1), them: fighter(250, -1), t: 0, round: 1, won: 0, lost: 0, dealt: 0, pause: 0, over: false, said: '' })
  const [hud, setHud] = useState({ hp: [100, 100], meter: [0, 0], left: ROUND, round: 1, won: 0, lost: 0, said: '' })

  const step = (dt: number) => {
    const s = st.current
    const c = ctx()
    if (n > 0 || s.over) return c && draw(c, s)
    if (s.pause > 0) {
      s.pause -= dt
      if (s.pause <= 0) {
        if (s.won >= 2 || s.lost >= 2) return end(s)
        s.round++
        Object.assign(s.me, fighter(110, 1), { meter: s.me.meter })
        Object.assign(s.them, fighter(250, -1), { meter: s.them.meter })
        s.t = 0
        s.said = `Round ${s.round}`
        setTimeout(() => (s.said = ''), 900)
      }
      return c && draw(c, s)
    }
    s.t += dt
    const { me, them } = s
    // The player's hands (the pad, the keys).
    const k = keys.current
    const a = ask.current
    const dir = clamp(a.dir + (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0), -1, 1)
    const guard = a.guard || k.has('KeyL') || k.has('ArrowDown')
    act(me, dir, guard, a.punch || k.has('KeyJ'), a.kick || k.has('KeyK'), a.super || k.has('Space'))
    a.punch = a.kick = a.super = false
    for (const key of ['KeyJ', 'KeyK', 'Space']) k.delete(key)
    // The rival: a look every few tenths of a second (it reacts, a little late), then a choice.
    them.ai -= dt
    them.blockFor = Math.max(0, them.blockFor - dt)
    const gap = Math.abs(them.x - me.x)
    let tdir = 0
    let tguard = them.blockFor > 0
    let tp = false
    let tk = false
    let ts = false
    if (them.ai <= 0 && !busy(them)) {
      them.ai = 0.16 + Math.random() * 0.22
      const r = Math.random()
      if ((me.state === 'punch' || me.state === 'kick' || me.state === 'super') && me.t < MOVES[me.state].start + 0.05 && gap < 70 && r < 0.5) them.blockFor = 0.45
      else if (them.meter >= 100 && gap < 130 && r < 0.35) ts = true
      else if (gap < 50) tp = r < 0.55
      else if (gap < 62) tk = r < 0.5
      tguard = them.blockFor > 0
    }
    if (!tp && !tk && !ts && !tguard) tdir = gap > 48 ? (me.x > them.x ? 1 : -1) * (Math.random() < 0.9 ? 1 : 0) : Math.random() < 0.03 ? (me.x > them.x ? -1 : 1) : 0
    act(them, tdir, tguard, tp, tk, ts)
    for (const f of [me, them]) {
      f.t += dt
      const o = f === me ? them : me
      f.face = o.x > f.x ? 1 : -1
      if (f.state === 'walk') f.x += f.vx * dt
      if (f.state === 'super' && f.t > MOVES.super.start && f.t < MOVES.super.start + MOVES.super.active) f.x += f.face * 300 * dt
      // A move's end, a stun's end.
      if (f.state === 'punch' || f.state === 'kick' || f.state === 'super') {
        const m = MOVES[f.state]
        if (f.t >= m.start + m.active + m.rec) setState(f, 'idle')
      }
      if (f.state === 'hit' && f.t > f.stun) setState(f, 'idle')
    }
    // Apart, in the street.
    for (const f of [me, them]) f.x = clamp(f.x, 22, W - 22)
    if (Math.abs(me.x - them.x) < 34) {
      const push = (34 - Math.abs(me.x - them.x)) / 2
      const sgn = me.x < them.x ? -1 : 1
      me.x += sgn * push
      them.x -= sgn * push
    }
    // The blows that land.
    for (const [f, o] of [[me, them], [them, me]] as const) {
      if (f.state !== 'punch' && f.state !== 'kick' && f.state !== 'super') continue
      const m = MOVES[f.state]
      if (f.landed || f.t < m.start || f.t > m.start + m.active || o.state === 'ko') continue
      if ((o.x - f.x) * f.face <= 0 || Math.abs(o.x - f.x) > m.range) continue
      f.landed = true
      const blocked = o.state === 'block'
      const dmg = blocked ? (f.state === 'super' ? 5 : 1) : m.dmg
      o.hp = Math.max(0, o.hp - dmg)
      o.x += f.face * (blocked ? m.knock * 0.3 : m.knock) * 0.25
      f.meter = Math.min(100, f.meter + (blocked ? 4 : 12))
      o.meter = Math.min(100, o.meter + 6)
      if (f === me) s.dealt += dmg
      if (!blocked) {
        setState(o, 'hit')
        o.stun = m.stun
      }
      haptic(f === me ? (blocked ? 'light' : 'medium') : blocked ? 'light' : 'heavy')
      if (o.hp <= 0) {
        setState(o, 'ko')
        roundOver(s, o === them)
      }
    }
    if (s.pause <= 0 && s.t >= ROUND) roundOver(s, me.hp > them.hp, me.hp === them.hp)
    if (c) draw(c, s)
    if (Math.round(s.t * 8) !== Math.round((s.t - dt) * 8)) setHud({ hp: [me.hp, them.hp], meter: [me.meter, them.meter], left: Math.max(0, Math.ceil(ROUND - s.t)), round: s.round, won: s.won, lost: s.lost, said: s.said })
  }

  const roundOver = (s: typeof st.current, won: boolean, tie = false) => {
    if (s.pause > 0) return
    if (tie) (s.won++, s.lost++)
    else if (won) s.won++
    else s.lost++
    s.said = tie ? 'Égalité' : won ? (s.them.hp <= 0 ? 'K.O. !' : 'Round gagné') : s.me.hp <= 0 ? 'K.O.…' : 'Round perdu'
    s.pause = 1.8
    haptic(won ? 'success' : 'error')
    setHud((h) => ({ ...h, hp: [s.me.hp, s.them.hp], won: s.won, lost: s.lost, said: s.said }))
  }
  const end = (s: typeof st.current) => {
    if (s.over) return
    s.over = true
    const win = s.won >= 2 && s.won > s.lost
    s.said = win ? 'Victoire !' : 'Défaite'
    setHud((h) => ({ ...h, said: s.said }))
    setTimeout(() => onEnd(fightScore(win ? 2 : Math.min(1, s.won), s.lost, s.me.hp, s.dealt)), 1300)
  }
  useLoop(step)

  const bar = (v: number, right: boolean) => (
    <div className={`h-3 flex-1 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/30 ${right ? 'rotate-180' : ''}`}>
      <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${v}%`, background: v > 50 ? '#40c057' : v > 25 ? '#ffc233' : '#e03131' }} />
    </div>
  )
  return (
    <div className="flex h-full flex-col bg-[#120d24]">
      <div className="px-3 pt-3 text-white">
        <div className="flex items-center gap-2 font-display text-[13px] font-extrabold">
          <span className="w-12 truncate">TOI</span>
          {bar(hud.hp[0], false)}
          <span className="w-9 rounded-md bg-black/50 text-center text-base tabular-nums">{hud.left}</span>
          {bar(hud.hp[1], true)}
          <span className="w-12 truncate text-right">BOSS</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] font-extrabold">
          <span className="flex items-center gap-1">
            {[0, 1].map((k) => (
              <span key={k} className={`h-2.5 w-2.5 rounded-full ${k < hud.won ? 'bg-[#ffc233]' : 'bg-white/20'}`} />
            ))}
            <span className="ml-1 h-1.5 w-16 overflow-hidden rounded-full bg-white/15">
              <span className="block h-full" style={{ width: `${hud.meter[0]}%`, background: hud.meter[0] >= 100 ? '#ff3d7f' : '#7048e8' }} />
            </span>
          </span>
          <span className="text-white/70">
            Round {hud.round} · {RIVAL}
          </span>
          <span className="flex items-center gap-1">
            {[0, 1].map((k) => (
              <span key={k} className={`h-2.5 w-2.5 rounded-full ${k < hud.lost ? 'bg-[#ffc233]' : 'bg-white/20'}`} />
            ))}
          </span>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-2 grid place-items-center">
          <canvas ref={ref} className="rounded-xl" />
        </div>
        <Count n={n} go="Combat !" />
        {hud.said && <div key={hud.said + hud.round} className="animate-pop pointer-events-none absolute inset-x-0 top-1/3 text-center font-display text-[42px] font-extrabold text-white [text-shadow:0_4px_0_rgba(0,0,0,0.5)]">{hud.said}</div>}
      </div>
      <div className="flex h-[150px] shrink-0 items-center justify-between gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-2">
          {([-1, 1] as const).map((d) => (
            <button key={d} className="grid h-[66px] w-[66px] touch-none place-items-center rounded-full bg-white/90 text-[#16161c] shadow-[0_5px_0_rgba(0,0,0,0.3)] select-none active:translate-y-1" {...hold(() => (ask.current.dir = d), () => ask.current.dir === d && (ask.current.dir = 0))} aria-label={d < 0 ? 'Reculer' : 'Avancer'}>
              {d < 0 ? <ChevronLeft size={36} strokeWidth={3} /> : <ChevronRight size={36} strokeWidth={3} />}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <PadButton label="Poing" color="#e03131" size={58} on={() => (ask.current.punch = true)} />
          <PadButton label="Pied" color="#1c7ed6" size={58} on={() => (ask.current.kick = true)} />
          <PadButton label="Garde" color="#495057" size={58} on={() => (ask.current.guard = true)} off={() => (ask.current.guard = false)} />
          <PadButton label="Super" color="#ff3d7f" size={58} dim={hud.meter[0] < 100} on={() => (ask.current.super = true)} />
        </div>
      </div>
    </div>
  )
}

function fighter(x: number, face: 1 | -1): F {
  return { x, vx: 0, hp: 100, state: 'idle', t: 0, stun: 0, meter: 0, landed: false, face, ai: 0.5, blockFor: 0 }
}
function setState(f: F, s: State) {
  f.state = s
  f.t = 0
  f.landed = false
}
/** What a fighter does this frame: a move started, the guard, a step, or nothing (busy with a move). */
function act(f: F, dir: number, guard: boolean, punch: boolean, kick: boolean, sup: boolean) {
  if (busy(f)) return
  if (sup && f.meter >= 100) {
    f.meter = 0
    return setState(f, 'super')
  }
  if (punch) return setState(f, 'punch')
  if (kick) return setState(f, 'kick')
  if (guard) return f.state !== 'block' && setState(f, 'block')
  if (dir) {
    if (f.state !== 'walk') setState(f, 'walk')
    f.vx = dir * 110
  } else if (f.state !== 'idle') setState(f, 'idle')
}

function draw(c: CanvasRenderingContext2D, s: { me: F; them: F; t: number; said: string }) {
  // Treichville at night: the sky, the buildings and their windows, the maquis's sign, the red earth.
  const sky = c.createLinearGradient(0, 0, 0, GROUND)
  sky.addColorStop(0, '#1b1440')
  sky.addColorStop(1, '#5a2a5e')
  c.fillStyle = sky
  c.fillRect(0, 0, W, GROUND)
  for (const [x, w, h, col] of [[0, 70, 150, '#2b2350'], [66, 60, 120, '#33295c'], [124, 80, 170, '#2b2350'], [200, 64, 130, '#3a2e66'], [262, 98, 160, '#2b2350']] as const) {
    c.fillStyle = col
    c.fillRect(x, GROUND - h, w, h)
    for (let wy = GROUND - h + 14; wy < GROUND - 40; wy += 22)
      for (let wx = x + 8; wx < x + w - 12; wx += 18) {
        c.fillStyle = (wx * 7 + wy * 3) % 5 < 2 ? '#ffd27a' : '#1d1838'
        c.fillRect(wx, wy, 8, 10)
      }
  }
  c.fillStyle = '#ff3d7f'
  c.fillRect(150, GROUND - 120, 76, 20)
  c.fillStyle = '#fff'
  c.font = "900 13px 'Baloo 2', system-ui, sans-serif"
  c.textAlign = 'center'
  c.fillText('MAQUIS', 188, GROUND - 105)
  c.fillStyle = '#a0522d'
  c.fillRect(0, GROUND, W, H - GROUND)
  c.fillStyle = '#8b4513'
  for (let x = 0; x < W; x += 24) c.fillRect(x + ((x / 24) % 2) * 6, GROUND + 14, 10, 3)
  // The crowd at the front, heads bobbing.
  for (let k = 0; k < 14; k++) {
    const x = 8 + k * 26
    const y = H - 12 + Math.sin(s.t * 6 + k) * 2
    c.fillStyle = '#140f24'
    c.beginPath()
    c.arc(x, y - 16, 8, 0, Math.PI * 2)
    c.fill()
    c.fillRect(x - 11, y - 8, 22, 20)
  }
  for (const [f, top, flash] of [[s.them, '#12a150', s.them.state === 'hit'], [s.me, '#ff7a00', s.me.state === 'hit']] as const) person(c, f, top, flash)
}

/** A fighter, the game's block people: legs, body, arms, head, the pose of what it's doing. */
function person(c: CanvasRenderingContext2D, f: F, top: string, flash: boolean) {
  const skin = '#6e4024'
  const pants = '#1f2a44'
  const d = f.face
  c.save()
  c.translate(Math.round(f.x), GROUND)
  if (f.state === 'ko') {
    c.fillStyle = 'rgba(0,0,0,0.3)'
    c.fillRect(-40, -4, 80, 6)
    // Down on its back, the head away from the other.
    c.fillStyle = pants
    c.fillRect(d > 0 ? 6 : -46, -12, 40, 11)
    c.fillStyle = top
    c.fillRect(d > 0 ? -34 : -6, -16, 40, 15)
    c.fillStyle = skin
    c.fillRect(d > 0 ? -52 : 34, -18, 18, 16)
    c.restore()
    return
  }
  const m = f.state === 'punch' || f.state === 'kick' || f.state === 'super' ? MOVES[f.state] : null
  const out = m ? clamp(f.t / m.start, 0, 1) * (f.t < m.start + m.active ? 1 : clamp(1 - (f.t - m.start - m.active) / m.rec, 0, 1)) : 0
  const lean = f.state === 'hit' ? -6 * d : f.state === 'super' ? 8 * d : 0
  const bob = f.state === 'idle' ? Math.sin(f.t * 5) * 1.5 : 0
  const step = f.state === 'walk' ? Math.sin(f.t * 14) * 6 : 0
  c.fillStyle = 'rgba(0,0,0,0.35)'
  c.beginPath()
  c.ellipse(0, -2, 22, 5, 0, 0, Math.PI * 2)
  c.fill()
  // Legs (the front one out for a kick).
  c.fillStyle = pants
  c.fillRect(-12 + step, -40, 10, 40)
  if (f.state === 'kick') {
    c.fillRect(d > 0 ? 0 : -46 * out, -44, 10 + 36 * out, 11)
    c.fillStyle = '#e9ecef'
    c.fillRect(d > 0 ? 6 + 36 * out : -46 * out, -45, 8, 13)
  } else c.fillRect(2 - step, -40, 10, 40)
  // Body and head.
  c.fillStyle = flash && Math.floor(f.t * 20) % 2 ? '#ffffff' : top
  c.fillRect(-14 + lean, -82 + bob, 28, 44)
  c.fillStyle = skin
  c.fillRect(-10 + lean * 1.3, -104 + bob, 20, 22)
  c.fillStyle = '#141010'
  c.fillRect(-10 + lean * 1.3, -106 + bob, 20, 7)
  c.fillStyle = '#fff'
  c.fillRect(d > 0 ? 3 + lean * 1.3 : -7 + lean * 1.3, -96 + bob, 4, 3)
  // Arms: the guard up before the face, a punch thrown, both forward for the dash.
  c.fillStyle = skin
  if (f.state === 'block') {
    c.fillRect(d > 0 ? 8 : -20, -96, 12, 30)
    c.fillRect(d > 0 ? 2 : -14, -92, 12, 26)
  } else if (f.state === 'punch' || f.state === 'super') {
    const reach = (f.state === 'super' ? 30 : 34) * out
    c.fillRect(d > 0 ? 10 + lean : -10 - 10 - reach + lean, -78 + bob, 10 + reach, 9)
    c.fillStyle = '#e03131'
    c.fillRect(d > 0 ? 16 + reach + lean : -24 - reach + lean, -80 + bob, 10, 13)
    if (f.state === 'super') {
      c.fillStyle = 'rgba(255,61,127,0.45)'
      for (let k = 1; k <= 3; k++) c.fillRect(-14 - d * k * 14, -82, 28, 44)
    }
  } else {
    c.fillRect(d > 0 ? 12 : -22, -78 + bob, 10, 30)
    c.fillRect(d > 0 ? -18 : 8, -78 + bob, 10, 28)
  }
  c.restore()
}
