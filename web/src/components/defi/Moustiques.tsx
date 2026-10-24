import { useRef, useState } from 'react'
import { haptic } from '../../lib/native'
import { clamp, Count, useCanvas, useCount, useKeys, useLoop } from './arcade'

// La borne d'arcade de la salle: « Moustiques ! », the shooting game of the
// nights by the lagoon. The bombe PAF at the bottom sprays by itself; the
// finger slides it left and right (or the arrows). The mosquitoes come down
// in swarms, swaying, now and then one dives at you; the tiger ones take
// three sprays; the coil (a green spiral, caught) sprays three ways for a
// while. Three bites and it's over. At 45 seconds the Gros Moustique comes:
// it drops its larvae, and takes forty sprays.

const W = 360
const H = 540
const Y = H - 46 // the bombe
const TIME = 60
const BOSS_AT = 45

type Bug = { x: number; y: number; hp: number; tiger: boolean; dive: number; phase: number; boss?: boolean; max?: number }
type Shot = { x: number; y: number; vx: number; vy: number; foe?: boolean }

/** Points as a score out of 100 (a full game well played is near 1 200). */
export const bugScore = (points: number) => Math.round(clamp(points / 12, 0, 100))

export function MoustiquesDefi({ onEnd }: { onEnd: (score: number) => void }) {
  const { ref, ctx } = useCanvas(W, H)
  const keys = useKeys()
  const n = useCount(3)
  const finger = useRef<number | null>(null)
  const g = useRef({ x: W / 2, t: 0, fire: 0, bugs: [] as Bug[], shots: [] as Shot[], wave: 0, lives: 3, safe: 0, points: 0, combo: 0, comboT: 0, coil: 0, coilAt: null as { x: number; y: number } | null, boss: false, over: false, pops: [] as { x: number; y: number; t: number; text: string }[] })
  const [hud, setHud] = useState({ lives: 3, points: 0, left: TIME, said: '', boss: 0 })

  const step = (dt: number) => {
    const s = g.current
    const c = ctx()
    if (n > 0 || s.over) return c && draw(c)
    s.t += dt
    // The bombe: under the finger, or by the arrows.
    const k = keys.current
    const dir = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0)
    if (finger.current !== null) s.x += clamp(finger.current - s.x, -520 * dt, 520 * dt)
    s.x = clamp(s.x + dir * 300 * dt, 18, W - 18)
    // It sprays by itself; three ways with the coil.
    s.fire -= dt
    s.coil = Math.max(0, s.coil - dt)
    if (s.fire <= 0) {
      s.fire = 0.16
      s.shots.push({ x: s.x, y: Y - 22, vx: 0, vy: -440 })
      if (s.coil > 0) s.shots.push({ x: s.x, y: Y - 22, vx: -130, vy: -420 }, { x: s.x, y: Y - 22, vx: 130, vy: -420 })
    }
    // The swarms: a new one every few seconds, bigger as it goes; the boss at 45 s.
    if (!s.boss && s.t < BOSS_AT && s.t > s.wave * 5.5) {
      const count = 5 + Math.min(5, s.wave)
      for (let i = 0; i < count; i++) {
        const tiger = (i + s.wave) % 5 === 0
        s.bugs.push({ x: 40 + (i * (W - 80)) / Math.max(1, count - 1), y: -20 - (i % 2) * 26, hp: tiger ? 3 : 1, tiger, dive: 0, phase: Math.random() * 6 })
      }
      s.wave++
      if (s.wave % 3 === 0) s.coilAt = { x: 40 + Math.random() * (W - 80), y: -10 }
    }
    if (!s.boss && s.t >= BOSS_AT) {
      s.boss = true
      s.bugs.push({ x: W / 2, y: -60, hp: 40, max: 40, tiger: true, dive: 0, phase: 0, boss: true })
      setHud((h) => ({ ...h, said: 'Le Gros Moustique !' }))
      setTimeout(() => setHud((h) => ({ ...h, said: '' })), 1500)
    }
    for (const b of s.bugs) {
      b.phase += dt
      if (b.boss) {
        b.y = Math.min(110, b.y + 40 * dt)
        b.x = W / 2 + Math.sin(b.phase * 0.9) * 120
        // Its larvae, dropped at the bombe.
        if (Math.random() < dt * 1.4) s.shots.push({ x: b.x, y: b.y + 30, vx: (s.x - b.x) * 0.5, vy: 170, foe: true })
        continue
      }
      if (b.dive) {
        // Diving at the bombe.
        b.y += 210 * dt
        b.x += clamp(s.x - b.x, -1, 1) * 90 * dt
      } else {
        b.y += (28 + s.wave * 2.5) * dt
        b.x += Math.sin(b.phase * 2.2) * 40 * dt
        if (b.y > 60 && Math.random() < dt * 0.06 * (1 + s.wave * 0.1)) b.dive = 1
      }
    }
    // Sprays and larvae.
    for (const sh of s.shots) {
      sh.x += sh.vx * dt
      sh.y += sh.vy * dt
    }
    for (const sh of s.shots) {
      if (sh.foe || sh.y < -10) continue
      for (const b of s.bugs) {
        if (b.hp <= 0 || Math.abs(sh.x - b.x) > (b.boss ? 34 : 13) || Math.abs(sh.y - b.y) > (b.boss ? 26 : 12)) continue
        sh.y = -100
        b.hp--
        if (b.hp <= 0) {
          s.combo = s.comboT > 0 ? s.combo + 1 : 1
          s.comboT = 0.9
          const pts = (b.boss ? 300 : b.tiger ? 30 : 10) * Math.min(4, s.combo)
          s.points += pts
          s.pops.push({ x: b.x, y: b.y, t: 0.7, text: `+${pts}` })
          haptic(b.boss ? 'success' : 'light')
          if (b.boss) {
            // The boss down: what time is left counts too.
            s.points += Math.round((TIME - s.t) * 10)
            finish('Le Gros Moustique est tombé !')
          }
        }
        break
      }
    }
    s.comboT = Math.max(0, s.comboT - dt)
    // The coil, falling: caught, three ways for 6 s.
    if (s.coilAt) {
      s.coilAt.y += 90 * dt
      if (Math.abs(s.coilAt.x - s.x) < 22 && Math.abs(s.coilAt.y - Y) < 24) {
        s.coil = 6
        s.coilAt = null
        haptic('success')
        s.pops.push({ x: s.x, y: Y - 40, t: 1, text: 'Spirale !' })
      } else if (s.coilAt.y > H + 20) s.coilAt = null
    }
    // A bite: a mosquito (or a larva) on the bombe.
    s.safe = Math.max(0, s.safe - dt)
    if (s.safe <= 0) {
      const bit = s.bugs.find((b) => b.hp > 0 && Math.abs(b.x - s.x) < (b.boss ? 40 : 16) && Math.abs(b.y - Y) < (b.boss ? 40 : 18)) || s.shots.find((sh) => sh.foe && Math.abs(sh.x - s.x) < 14 && Math.abs(sh.y - Y) < 16)
      if (bit) {
        s.lives--
        s.safe = 1.5
        s.combo = 0
        haptic('error')
        if ('hp' in bit && !bit.boss) bit.hp = 0
        else if (!('hp' in bit)) bit.y = H + 50
        s.pops.push({ x: s.x, y: Y - 40, t: 0.9, text: 'Piqûre !' })
        if (s.lives <= 0) return finish('Trop de piqûres…')
      }
    }
    s.bugs = s.bugs.filter((b) => b.hp > 0 && b.y < H + 30)
    s.shots = s.shots.filter((sh) => sh.y > -20 && sh.y < H + 20)
    for (const p of s.pops) p.t -= dt
    s.pops = s.pops.filter((p) => p.t > 0)
    if (s.t >= TIME) return finish('Fin de la partie')
    if (c) draw(c)
    if (Math.round(s.t * 6) !== Math.round((s.t - dt) * 6)) {
      const boss = s.bugs.find((b) => b.boss)
      setHud((h) => ({ ...h, lives: s.lives, points: s.points, left: Math.max(0, Math.ceil(TIME - s.t)), boss: boss ? boss.hp / boss.max! : 0 }))
    }
  }
  const finish = (said: string) => {
    const s = g.current
    if (s.over) return
    s.over = true
    setHud((h) => ({ ...h, said, points: s.points, lives: s.lives }))
    setTimeout(() => onEnd(bugScore(s.points)), 1400)
  }

  const draw = (c: CanvasRenderingContext2D) => {
    const s = g.current
    // The night over the lagoon: the sky, the moon, the water's glints.
    const sky = c.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, '#0b1030')
    sky.addColorStop(0.75, '#1b2a5a')
    sky.addColorStop(1, '#0e3a4a')
    c.fillStyle = sky
    c.fillRect(0, 0, W, H)
    c.fillStyle = '#fff3bf'
    c.beginPath()
    c.arc(300, 60, 22, 0, Math.PI * 2)
    c.fill()
    for (let k = 0; k < 30; k++) {
      c.fillStyle = 'rgba(255,255,255,0.6)'
      c.fillRect((k * 97) % W, (k * 53 + s.t * 20 * ((k % 3) + 1)) % (H - 80), 2, 2)
    }
    for (let k = 0; k < 8; k++) {
      c.fillStyle = 'rgba(160,220,255,0.25)'
      c.fillRect(((k * 61 + s.t * 30) % (W + 40)) - 20, H - 30 + (k % 3) * 8, 26, 2)
    }
    // The coil.
    if (s.coilAt) {
      c.strokeStyle = '#51cf66'
      c.lineWidth = 3
      c.beginPath()
      for (let a = 0; a < Math.PI * 5; a += 0.3) c.lineTo(s.coilAt.x + Math.cos(a + s.t * 4) * a * 1.4, s.coilAt.y + Math.sin(a + s.t * 4) * a * 1.4)
      c.stroke()
    }
    // The mosquitoes: the body, the stripes of the tiger ones, the wings beating.
    for (const b of s.bugs) {
      const k = b.boss ? 3 : 1
      const flap = Math.sin(b.phase * 40) > 0
      c.fillStyle = 'rgba(220,235,255,0.55)'
      c.beginPath()
      c.ellipse(b.x - 7 * k, b.y - 6 * k - (flap ? 3 : 0) * k, 7 * k, 3.5 * k, -0.5, 0, Math.PI * 2)
      c.ellipse(b.x + 7 * k, b.y - 6 * k - (flap ? 3 : 0) * k, 7 * k, 3.5 * k, 0.5, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#2b2b2b'
      c.fillRect(b.x - 2.5 * k, b.y - 8 * k, 5 * k, 16 * k)
      if (b.tiger) {
        c.fillStyle = '#f1f3f5'
        for (let y = -5; y < 8; y += 4) c.fillRect(b.x - 2.5 * k, b.y + y * k, 5 * k, 1.4 * k)
      }
      c.fillStyle = '#2b2b2b'
      c.fillRect(b.x - 0.6 * k, b.y + 8 * k, 1.2 * k, 7 * k)
      c.strokeStyle = '#2b2b2b'
      c.lineWidth = k
      for (const sx of [-1, 1]) {
        c.beginPath()
        c.moveTo(b.x, b.y)
        c.lineTo(b.x + sx * 9 * k, b.y + 7 * k)
        c.stroke()
      }
      if (b.boss) {
        c.fillStyle = '#e03131'
        c.fillRect(b.x - 6, b.y - 30, 4, 4)
        c.fillRect(b.x + 2, b.y - 30, 4, 4)
      }
    }
    // The sprays, the larvae.
    for (const sh of s.shots) {
      c.fillStyle = sh.foe ? '#8ce99a' : '#c5f6fa'
      c.beginPath()
      c.ellipse(sh.x, sh.y, sh.foe ? 4 : 2.5, sh.foe ? 6 : 5, 0, 0, Math.PI * 2)
      c.fill()
    }
    // The bombe PAF (blinking while it's been bitten).
    if (!(s.safe > 0 && Math.floor(s.t * 12) % 2)) {
      c.fillStyle = '#e03131'
      c.fillRect(s.x - 11, Y - 14, 22, 36)
      c.fillStyle = '#f8f9fa'
      c.fillRect(s.x - 11, Y - 2, 22, 12)
      c.fillStyle = '#e03131'
      c.font = "900 9px 'Baloo 2', system-ui, sans-serif"
      c.textAlign = 'center'
      c.fillText('PAF', s.x, Y + 7)
      c.fillStyle = '#adb5bd'
      c.fillRect(s.x - 6, Y - 20, 12, 6)
      c.fillStyle = '#495057'
      c.fillRect(s.x - 2, Y - 24, 4, 4)
      if (s.coil > 0) {
        c.strokeStyle = '#51cf66'
        c.lineWidth = 2
        c.strokeRect(s.x - 14, Y - 26, 28, 50)
      }
    }
    for (const p of s.pops) {
      c.globalAlpha = Math.min(1, p.t * 2)
      c.fillStyle = p.text.startsWith('+') ? '#ffd43b' : '#ff8787'
      c.font = "900 14px 'Baloo 2', system-ui, sans-serif"
      c.textAlign = 'center'
      c.fillText(p.text, p.x, p.y - (1 - p.t) * 24)
      c.globalAlpha = 1
    }
  }
  useLoop(step)

  return (
    <div className="flex h-full flex-col bg-[#070a1c]">
      <div className="flex items-center justify-between px-3 pt-3 font-display font-extrabold text-white">
        <span className="text-lg">{'❤️'.repeat(Math.max(0, hud.lives))}{'🖤'.repeat(Math.max(0, 3 - hud.lives))}</span>
        <span className="rounded-lg bg-black/40 px-2.5 py-0.5 text-lg tabular-nums">{hud.points}</span>
        <span className="rounded-lg bg-black/40 px-2 py-0.5 text-sm tabular-nums">{hud.left} s</span>
      </div>
      {hud.boss > 0 && (
        <div className="mx-3 mt-1.5 h-2 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-[#e03131]" style={{ width: `${hud.boss * 100}%` }} />
        </div>
      )}
      <div
        className="relative min-h-0 flex-1 touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          const r = e.currentTarget.querySelector('canvas')!.getBoundingClientRect()
          finger.current = ((e.clientX - r.left) / r.width) * W
        }}
        onPointerMove={(e) => {
          if (finger.current === null) return
          const r = e.currentTarget.querySelector('canvas')!.getBoundingClientRect()
          finger.current = ((e.clientX - r.left) / r.width) * W
        }}
        onPointerUp={() => (finger.current = null)}
        onPointerCancel={() => (finger.current = null)}
      >
        <div className="absolute inset-2 grid place-items-center">
          <canvas ref={ref} className="rounded-xl" />
        </div>
        <Count n={n} go="Pschiiit !" />
        {hud.said && <div key={hud.said} className="animate-pop pointer-events-none absolute inset-x-0 top-1/3 px-4 text-center font-display text-[34px] leading-tight font-extrabold text-white [text-shadow:0_4px_0_rgba(0,0,0,0.5)]">{hud.said}</div>}
      </div>
      <p className="px-3 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[12px] font-bold text-white/60">Glisse le doigt pour déplacer la bombe : elle tire toute seule.</p>
    </div>
  )
}
