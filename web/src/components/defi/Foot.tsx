import { useRef, useState } from 'react'
import { haptic } from '../../lib/native'
import { clamp, Count, PadButton, Stick, useCanvas, useCount, useKeys, useLoop } from './arcade'

// Le foot à la console, as it's played at the salle de jeux vidéo: three
// against three seen from above (a keeper and two in the field), the
// orange of the Éléphants against the boys of the quarter. The stick moves
// the one of yours nearest the ball (ringed in yellow); « Passe » gives it
// to the other, « Tir » shoots at the goal at the top (the stick aims it,
// left or right); without the ball, « Passe » is a tackle (a dash: it takes
// the ball, or you fall). The walls send the ball back, as on the console.
// A match is 80 seconds (the 90 minutes, sped up); the tournament is three
// (the quarter-final, the semi, the final), each side harder, a draw played
// on to the golden goal, then penalties.

const W = 360
const H = 540
const LEFT = 14
const RIGHT = W - 14
const TOP = 26
const BOTTOM = H - 26
const MID = W / 2
const MOUTH = 46 // half the goal's width
const MATCH = 80 // seconds
const GOLDEN = 25

type P = { x: number; y: number; vx: number; vy: number; fx: number; fy: number; team: 0 | 1; gk: boolean; stun: number; dash: number }
type Ball = { x: number; y: number; vx: number; vy: number; owner: number | null; cool: number; last: number | null; held: number }
type State = { ps: P[]; ball: Ball; goals: [number, number]; t: number; pause: number; said: string; ctrl: number; tackleCool: number; over: boolean; golden: boolean; kickoff: 0 | 1 }

export type FootRound = { name: string; diff: number; label?: string }
export const FOOT_MODES: Record<'match' | 'defi' | 'tournoi', FootRound[]> = {
  match: [{ name: 'Les gars du quartier', diff: 0.82 }],
  defi: [{ name: 'Le caïd du quartier', diff: 1 }],
  tournoi: [
    { name: "Les Lions d'Abobo", diff: 0.85, label: 'Quart de finale' },
    { name: 'Koumassi FC', diff: 0.97, label: 'Demi-finale' },
    { name: 'Yop City', diff: 1.1, label: 'Finale' },
  ],
}

const SPOTS: Record<0 | 1, [number, number][]> = {
  0: [[MID, BOTTOM - 14], [MID - 60, 380], [MID + 60, 410]],
  1: [[MID, TOP + 14], [MID - 60, 160], [MID + 60, 130]],
}

function kickoff(s: State, to: 0 | 1) {
  s.ps = ([0, 1] as const).flatMap((team) => SPOTS[team].map(([x, y], i): P => ({ x, y, vx: 0, vy: 0, fx: 0, fy: team === 0 ? -1 : 1, team, gk: i === 0, stun: 0, dash: 0 })))
  // The side kicking off: its first field player on the spot, the ball at his feet.
  const k = to === 0 ? 1 : 4
  s.ps[k].x = MID
  s.ps[k].y = H / 2 + (to === 0 ? 10 : -10)
  s.ball = { x: MID, y: H / 2, vx: 0, vy: 0, owner: k, cool: 0, last: k, held: 0 }
  s.ctrl = 1
  s.kickoff = to
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
/** Steer p toward (x, y) at speed v (px/s). */
function goTo(p: P, x: number, y: number, v: number) {
  const dx = x - p.x
  const dy = y - p.y
  const d = Math.hypot(dx, dy)
  if (d < 3) return void ((p.vx = 0), (p.vy = 0))
  p.vx = (dx / d) * v
  p.vy = (dy / d) * v
}

function kick(s: State, i: number, tx: number, ty: number, speed: number, spread = 0) {
  const p = s.ps[i]
  const b = s.ball
  let dx = tx - p.x
  let dy = ty - p.y
  const d = Math.hypot(dx, dy) || 1
  ;[dx, dy] = [dx / d, dy / d]
  const a = (Math.random() - 0.5) * spread
  ;[dx, dy] = [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)]
  b.owner = null
  b.x = p.x + dx * 10
  b.y = p.y + dy * 10
  b.vx = dx * speed
  b.vy = dy * speed
  b.cool = 0.25
  b.last = i
  p.fx = dx
  p.fy = dy
}

/** The match result as a score out of 100: a win from 65, by the goals between; a draw 50; a loss under 40. */
export function matchScore(mine: number, theirs: number) {
  const d = mine - theirs
  if (d > 0) return Math.min(100, 55 + d * 10 + Math.min(10, mine * 2))
  if (d === 0) return 50
  return Math.max(4, 42 - 12 * (-d - 1) + Math.min(6, mine * 3) - 6)
}

export function FootDefi({ mode, onEnd }: { mode: keyof typeof FOOT_MODES; onEnd: (score: number) => void }) {
  const rounds = FOOT_MODES[mode]
  const [round, setRound] = useState(0)
  const [between, setBetween] = useState<{ won: boolean; mine: number; theirs: number; pens?: string } | null>(null)
  const done = (mine: number, theirs: number, pens?: string) => {
    const won = mine > theirs || pens === 'won'
    if (rounds.length === 1) return onEnd(matchScore(mine, theirs))
    setBetween({ won, mine, theirs, pens })
  }
  const next = () => {
    const b = between!
    setBetween(null)
    // The tournament: a third for each round won, all of it for the cup; out, a little for how close.
    if (!b.won) return onEnd(Math.min(100, Math.round(round * 33 + matchScore(b.mine, b.theirs) / 10)))
    if (round + 1 >= rounds.length) return onEnd(100)
    setRound(round + 1)
  }
  return (
    <div className="relative h-full">
      <Match key={round} rival={rounds[round]} tournament={rounds.length > 1} onDone={done} />
      {between && (
        <div className="absolute inset-0 grid place-items-center bg-[#0b1a10]/70 p-5">
          <div className="card animate-pop w-full max-w-[320px] p-5 text-center">
            <div className="label">{rounds[round].label}</div>
            <div className="mt-1 font-display text-[30px] leading-tight font-extrabold">
              {between.mine} – {between.theirs}
            </div>
            {between.pens && <div className="text-xs font-extrabold text-[var(--color-ink-soft)]">Tirs au but : {between.pens === 'won' ? 'gagnés' : 'perdus'}</div>}
            <p className="mt-2 text-[15px] font-bold">
              {between.won ? (round + 1 >= rounds.length ? 'Champion du tournoi ! 🏆' : `Qualifié·e ! Prochain : ${rounds[round + 1].label}, contre ${rounds[round + 1].name}.`) : `Éliminé·e par ${rounds[round].name}.`}
            </p>
            <button className="btn mt-4 w-full" onClick={next}>
              {between.won && round + 1 < rounds.length ? 'Jouer le match suivant' : 'Voir le résultat'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Match({ rival, tournament, onDone }: { rival: FootRound; tournament: boolean; onDone: (mine: number, theirs: number, pens?: string) => void }) {
  const { ref, ctx } = useCanvas(W, H)
  const keys = useKeys()
  const stick = useRef({ x: 0, y: 0 })
  const press = useRef({ pass: false, shoot: false })
  const st = useRef<State>(null as unknown as State)
  if (!st.current) {
    st.current = { ps: [], ball: null as unknown as Ball, goals: [0, 0], t: 0, pause: 0, said: '', ctrl: 1, tackleCool: 0, over: false, golden: false, kickoff: 0 }
    kickoff(st.current, Math.random() < 0.5 ? 0 : 1)
  }
  const n = useCount(3)
  const [hud, setHud] = useState({ goals: [0, 0], min: 0, said: '', owning: false, golden: false })
  const diff = rival.diff

  const step = (dt: number) => {
    const s = st.current
    if (n > 0 || s.over) return draw(s)
    const b = s.ball
    if (s.pause > 0) {
      s.pause -= dt
      if (s.pause <= 0) {
        s.said = ''
        if (s.golden && s.goals[0] !== s.goals[1]) return finish(s)
        kickoff(s, s.kickoff)
      }
      return draw(s)
    }
    s.t += dt
    s.tackleCool = Math.max(0, s.tackleCool - dt)
    b.cool = Math.max(0, b.cool - dt)
    // The time: the 90 minutes; level in the tournament, the golden goal, then penalties.
    const end = MATCH + (s.golden ? GOLDEN : 0)
    if (s.t >= end) {
      if (tournament && !s.golden && s.goals[0] === s.goals[1]) {
        s.golden = true
        s.said = 'But en or !'
        s.pause = 1.4
        return draw(s)
      }
      return finish(s)
    }

    // Yours: the one with the ball, else the nearest the ball (changed only when the other is clearly nearer).
    const mine = [1, 2]
    if (b.owner === 1 || b.owner === 2) s.ctrl = b.owner
    else if (b.owner === null || s.ps[b.owner].team === 1) {
      const o = s.ctrl === 1 ? 2 : 1
      if (dist(s.ps[o], b) < dist(s.ps[s.ctrl], b) * 0.8) s.ctrl = o
    }
    const k = keys.current
    let sx = stick.current.x + (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0)
    let sy = stick.current.y + (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0)
    const sl = Math.hypot(sx, sy)
    if (sl > 1) (sx /= sl), (sy /= sl)
    const pass = press.current.pass || k.has('KeyX') || k.has('KeyK')
    const shoot = press.current.shoot || k.has('Space') || k.has('KeyJ')
    press.current.pass = false
    press.current.shoot = false
    const me = s.ps[s.ctrl]
    const owning = b.owner === s.ctrl

    // The player's hands.
    if (me.stun <= 0) {
      const v = me.dash > 0 ? 165 : owning ? 92 : 104
      if (me.dash > 0) ((me.vx = me.fx * v), (me.vy = me.fy * v))
      else ((me.vx = sx * v), (me.vy = sy * v))
      if (sl > 0.2 && me.dash <= 0) ((me.fx = sx / Math.max(1, sl)), (me.fy = sy / Math.max(1, sl)))
      if (owning && pass) {
        const o = s.ps[s.ctrl === 1 ? 2 : 1]
        kick(s, s.ctrl, o.x + o.vx * 0.35, o.y + o.vy * 0.35, 270, 0.12)
        haptic('light')
      } else if (owning && shoot) {
        const far = Math.abs(me.y - TOP)
        kick(s, s.ctrl, MID + sx * 38, TOP - 6, 400, 0.08 + far / 2600)
        haptic('medium')
      } else if (!owning && pass && s.tackleCool <= 0) {
        // The tackle: a dash the way it faces.
        me.dash = 0.28
        s.tackleCool = 0.7
        if (sl > 0.2) ((me.fx = sx / Math.max(1, sl)), (me.fy = sy / Math.max(1, sl)))
      }
    } else (me.vx = 0), (me.vy = 0)
    // A tackle that reaches the one with the ball: it's taken, or the tackler falls.
    if (me.dash > 0 && b.owner !== null && s.ps[b.owner].team === 1 && dist(me, s.ps[b.owner]) < 13) {
      const them = s.ps[b.owner]
      me.dash = 0
      if (Math.random() < 0.7 - (diff - 0.85) * 0.6) {
        them.stun = 0.6
        b.owner = s.ctrl
        b.last = s.ctrl
        haptic('success')
      } else (me.stun = 0.5), haptic('error')
    }

    // The others: yours who hasn't the stick, theirs, the keepers.
    const theirs = [4, 5]
    const own = b.owner === null ? null : s.ps[b.owner].team
    for (const i of mine) {
      if (i === s.ctrl) continue
      const p = s.ps[i]
      if (own === 0) goTo(p, b.x > MID ? MID - 70 : MID + 70, Math.max(TOP + 60, b.y - 100), 96)
      else if (own === 1) {
        const mark = s.ps[theirs.find((j) => j !== b.owner)!]
        goTo(p, (mark.x + MID) / 2, mark.y + 34, 92)
      } else goTo(p, b.x + (p.x < b.x ? -50 : 50), b.y + 60, 90)
    }
    const chaser = theirs.reduce((a, j) => (dist(s.ps[j], b) < dist(s.ps[a], b) ? j : a))
    for (const i of theirs) {
      const p = s.ps[i]
      const v = 88 * diff
      if (b.owner === i) {
        // With the ball: down toward your goal, weaving; a shot once near enough, a pass when pressed.
        const press0 = Math.min(...mine.map((j) => dist(s.ps[j], p)))
        if (p.y > BOTTOM - 150 && Math.random() < dt * 1.6 * diff) kick(s, i, MID + (Math.random() - 0.5) * 80, BOTTOM + 6, 330 * diff, 0.16)
        else if (press0 < 26 && Math.random() < dt * 1.2) {
          const o = s.ps[i === 4 ? 5 : 4]
          kick(s, i, o.x, o.y + 20, 250, 0.15)
        } else goTo(p, MID + Math.sin(s.t * 1.3 + i) * 70, BOTTOM, v * 0.9)
      } else if (own === 1) goTo(p, s.ps[b.owner!].x > MID ? MID - 70 : MID + 70, Math.min(BOTTOM - 70, s.ps[b.owner!].y + 80), v)
      else if (i === chaser) goTo(p, b.x, b.y - (own === 0 ? 6 : 0), v)
      else goTo(p, (b.x + MID) / 2, Math.max(TOP + 60, b.y - 70), v * 0.85)
      // Theirs tackle yours with the ball.
      if (b.owner !== null && s.ps[b.owner].team === 0 && !s.ps[b.owner].gk && dist(p, s.ps[b.owner]) < 12 && s.tackleCool <= 0 && Math.random() < dt * 2.4 * diff) {
        s.tackleCool = 0.6
        b.owner = i
        b.last = i
        haptic('error')
      }
    }
    // The keepers: along their line, after the ball, out a little when it's near.
    for (const [g, line, team] of [[0, BOTTOM - 14, 0], [3, TOP + 14, 1]] as const) {
      const p = s.ps[g]
      if (b.owner === g) {
        // Holds it a moment, then out to a field player.
        b.held += dt
        goTo(p, MID, line, 30)
        if (b.held > 0.8) {
          const to = team === 0 ? (dist(s.ps[1], p) < dist(s.ps[2], p) ? 2 : 1) : Math.random() < 0.5 ? 4 : 5
          kick(s, g, s.ps[to].x, s.ps[to].y, 260, 0.1)
          b.held = 0
        }
        continue
      }
      const near = Math.abs(b.y - line) < 90
      goTo(p, clamp(b.x, MID - MOUTH + 6, MID + MOUTH - 6), line + (near ? (team === 0 ? -14 : 14) : 0), (team === 0 ? 95 : 95 * diff))
    }
    for (const p of s.ps) {
      p.stun = Math.max(0, p.stun - dt)
      p.dash = Math.max(0, p.dash - dt)
      if (p.stun > 0) continue
      p.x = clamp(p.x + p.vx * dt, LEFT + 6, RIGHT - 6)
      p.y = clamp(p.y + p.vy * dt, TOP + 4, BOTTOM - 4)
      if (Math.hypot(p.vx, p.vy) > 5 && !(p === me && sl < 0.2)) {
        const l = Math.hypot(p.vx, p.vy)
        ;[p.fx, p.fy] = [p.vx / l, p.vy / l]
      }
    }

    // The ball: at the feet of whoever has it, else rolling, slowing, off the walls.
    if (b.owner !== null) {
      const p = s.ps[b.owner]
      b.x = p.x + p.fx * 8
      b.y = p.y + p.fy * 8
      b.vx = p.vx
      b.vy = p.vy
    } else {
      b.x += b.vx * dt
      b.y += b.vy * dt
      const f = Math.exp(-1.5 * dt)
      b.vx *= f
      b.vy *= f
      if (b.x < LEFT) ((b.x = LEFT), (b.vx = Math.abs(b.vx) * 0.7))
      if (b.x > RIGHT) ((b.x = RIGHT), (b.vx = -Math.abs(b.vx) * 0.7))
      const inMouth = Math.abs(b.x - MID) < MOUTH
      if (b.y < TOP) {
        if (inMouth) return goal(s, 0)
        ;((b.y = TOP), (b.vy = Math.abs(b.vy) * 0.7))
      }
      if (b.y > BOTTOM) {
        if (inMouth) return goal(s, 1)
        ;((b.y = BOTTOM), (b.vy = -Math.abs(b.vy) * 0.7))
      }
      // Who reaches it: a keeper near his goal saves (or not, on a hard shot), a player takes it.
      const speed = Math.hypot(b.vx, b.vy)
      for (let i = 0; i < s.ps.length; i++) {
        const p = s.ps[i]
        if (p.stun > 0 || (b.cool > 0 && b.last === i) || dist(p, b) > (p.gk ? 13 : 10)) continue
        if (p.gk) {
          const sure = speed < 200 ? 1 : p.team === 1 ? 0.55 + (diff - 0.85) * 1.2 : 0.62
          if (Math.random() < sure) ((b.owner = i), (b.held = 0), (b.last = i))
          else ((b.vx = (Math.random() - 0.5) * 260), (b.vy = (p.team === 0 ? -1 : 1) * 140), (b.cool = 0.3), (b.last = i))
          break
        }
        if (speed < 300 || p.team === s.ps[b.last ?? i].team) {
          b.owner = i
          b.last = i
          break
        }
      }
    }
    draw(s)
    if (Math.round(s.t * 4) !== Math.round((s.t - dt) * 4)) setHud({ goals: [...s.goals], min: Math.min(90 + (s.golden ? 30 : 0), Math.floor((s.t / MATCH) * 90)), said: s.said, owning: b.owner === s.ctrl, golden: s.golden })
  }

  const goal = (s: State, by: 0 | 1) => {
    s.goals[by]++
    s.said = by === 0 ? 'BUT !' : `But de ${rival.name}`
    s.pause = 1.6
    s.kickoff = by === 0 ? 1 : 0
    haptic(by === 0 ? 'success' : 'error')
    setHud((h) => ({ ...h, goals: [...s.goals], said: s.said }))
    draw(s)
  }
  const finish = (s: State) => {
    if (s.over) return
    s.over = true
    const [a, b] = s.goals
    // Level after the golden goal: penalties, a coin with a little weight for the better side.
    const pens = tournament && a === b ? (Math.random() < 0.55 - (rival.diff - 0.85) * 0.4 ? 'won' : 'lost') : undefined
    s.said = a > b || pens === 'won' ? 'Victoire !' : a === b ? 'Match nul' : 'Défaite'
    setHud((h) => ({ ...h, said: s.said }))
    setTimeout(() => onDone(a, b, pens), 1300)
  }

  const draw = (s: State) => {
    const c = ctx()
    if (!c) return
    // The pitch: its stripes, its lines, the goals.
    for (let y = 0; y < H; y += 36) {
      c.fillStyle = (y / 36) % 2 ? '#2f9e44' : '#37b24d'
      c.fillRect(0, y, W, 36)
    }
    c.strokeStyle = 'rgba(255,255,255,0.85)'
    c.lineWidth = 2
    c.strokeRect(LEFT, TOP, RIGHT - LEFT, BOTTOM - TOP)
    c.beginPath()
    c.moveTo(LEFT, H / 2)
    c.lineTo(RIGHT, H / 2)
    c.stroke()
    c.beginPath()
    c.arc(MID, H / 2, 40, 0, Math.PI * 2)
    c.stroke()
    c.strokeRect(MID - 80, TOP, 160, 64)
    c.strokeRect(MID - 80, BOTTOM - 64, 160, 64)
    for (const [y, d] of [[TOP, -14], [BOTTOM, 14]] as const) {
      c.fillStyle = 'rgba(255,255,255,0.25)'
      c.fillRect(MID - MOUTH, d < 0 ? y + d : y, MOUTH * 2, Math.abs(d))
      c.strokeStyle = 'rgba(255,255,255,0.55)'
      c.lineWidth = 0.7
      for (let x = MID - MOUTH; x <= MID + MOUTH; x += 6) {
        c.beginPath()
        c.moveTo(x, y)
        c.lineTo(x, y + d)
        c.stroke()
      }
      c.strokeStyle = '#fff'
      c.lineWidth = 3
      c.strokeRect(MID - MOUTH, d < 0 ? y + d : y, MOUTH * 2, Math.abs(d))
    }
    // The players: a shadow, the shirt, the head; yours with the stick ringed in yellow.
    for (let i = 0; i < s.ps.length; i++) {
      const p = s.ps[i]
      c.fillStyle = 'rgba(0,0,0,0.25)'
      c.beginPath()
      c.ellipse(p.x + 2, p.y + 3, 9, 6, 0, 0, Math.PI * 2)
      c.fill()
      if (i === s.ctrl) {
        c.strokeStyle = '#ffd43b'
        c.lineWidth = 3
        c.beginPath()
        c.arc(p.x, p.y, 13, 0, Math.PI * 2)
        c.stroke()
      }
      c.fillStyle = p.gk ? (p.team === 0 ? '#ffd43b' : '#9c36b5') : p.team === 0 ? '#ff7a00' : '#12a150'
      c.strokeStyle = p.team === 0 ? '#a34700' : '#0b5d2a'
      c.lineWidth = 2
      c.beginPath()
      c.arc(p.x, p.y, 9, 0, Math.PI * 2)
      c.fill()
      c.stroke()
      c.fillStyle = '#5a3418'
      c.beginPath()
      c.arc(p.x + p.fx * 2, p.y + p.fy * 2, 4.5, 0, Math.PI * 2)
      c.fill()
      if (p.stun > 0) {
        c.fillStyle = '#fff'
        c.font = '800 10px system-ui'
        c.fillText('✶', p.x - 4, p.y - 12)
      }
    }
    const b = s.ball
    c.fillStyle = 'rgba(0,0,0,0.3)'
    c.beginPath()
    c.ellipse(b.x + 2, b.y + 2, 4.5, 3, 0, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#fff'
    c.beginPath()
    c.arc(b.x, b.y, 4.5, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#212529'
    c.fillRect(b.x - 1.5, b.y - 1.5, 3, 3)
  }
  useLoop(step)

  return (
    <div className="flex h-full flex-col bg-[#0b1a10]">
      <div className="flex items-center justify-center gap-2 px-3 pt-3 font-display font-extrabold text-white">
        <span className="rounded-lg bg-[#ff7a00] px-2 py-0.5 text-sm">TOI</span>
        <span className="text-2xl tabular-nums">
          {hud.goals[0]} – {hud.goals[1]}
        </span>
        <span className="max-w-[40%] truncate rounded-lg bg-[#12a150] px-2 py-0.5 text-sm">{rival.name}</span>
        <span className="ml-1 rounded-lg bg-black/40 px-2 py-0.5 text-sm tabular-nums">{hud.golden ? 'B. en or' : `${hud.min}'`}</span>
      </div>
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-2 grid place-items-center">
          <canvas ref={ref} className="rounded-xl" />
        </div>
        <Count n={n} go="Coup d'envoi !" />
        {hud.said && <div key={hud.said + hud.goals.join()} className="animate-pop pointer-events-none absolute inset-x-0 top-1/3 text-center font-display text-[44px] font-extrabold text-white [text-shadow:0_4px_0_rgba(0,0,0,0.45)]">{hud.said}</div>}
      </div>
      <div className="flex h-[150px] shrink-0 items-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Stick value={stick.current} className="h-full flex-1 rounded-2xl bg-white/5" />
        <div className="flex flex-col items-center gap-2">
          <PadButton label={hud.owning ? 'Passe' : 'Tacle'} color="#1c7ed6" size={60} on={() => (press.current.pass = true)} />
          <PadButton label="Tir" color="#e03131" size={72} dim={!hud.owning} on={() => (press.current.shoot = true)} />
        </div>
      </div>
    </div>
  )
}
