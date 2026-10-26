import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Skull, Trophy } from 'lucide-react'
import { haptic } from '../../lib/native'
import { sfx } from '../../lib/sfx'
import type { Look } from '../../lib/types'
import { randomLook } from '../../avatar/options'
import { Portrait } from '../../avatar/portrait'
import { rng } from '../../world3d/themes'
import { hold, useKeys } from './arcade'
import { aiPad, FOES, newMind, type Foe } from './combat/ai'
import { createFight, fightScore, NO_PAD, ROUND_TIME, stepFight, type Fight, type FightEvent, type Pad } from './combat/engine'
import { FightCanvas, type FighterLook } from './combat/Scene'

// Le combat de rue, on the console of the salle de jeux: your own Sim
// against a fighter of the street (combat/ai.ts), in a road of Treichville at
// night (combat/Scene.tsx), by the rules of combat/engine.ts. ◀ ▶ move (twice
// quickly: a dash), ▲ jumps, ▼ crouches; « Poing » chains jab, cross,
// uppercut; « Pied » is the high kick (▼: the sweep); « Garde » held takes
// the blows (crouching for the low ones), with « Poing » close in it throws;
// the gauge full, « Super ». Two rounds won take the match.

type Me = { look: Look; gender: 'femme' | 'homme' }
const BEATEN = 'babi.combat.beaten'

/** How the street's fighters look (on top of a look drawn from their seed). */
const FOE_LOOK: Record<Foe['id'], Partial<Look>> = {
  yao: { body: 'mince', height: 0.95, outfit: 'debardeur', outfitColor: '#f6c445', bottomColor: '#2b3a67', hair: 'degrade', skin: '#7a4a2a', beard: 'none' },
  go: { body: 'mince', height: 1.02, outfit: 'jogging', outfitColor: '#ff3d7f', bottomColor: '#1d1d24', hair: 'cornrows', hairColor: '#1a1010', skin: '#5b3620' },
  boss: { body: 'fort', height: 1.1, outfit: 'blouson', outfitColor: '#1f2937', bottomColor: '#111827', hair: 'bald', skin: '#3e2516' },
}
const foeLook = (f: Foe): Look => ({ ...randomLook(f.gender, rng(`foe-${f.id}`)), ...FOE_LOOK[f.id] })

function beaten(): string[] {
  try {
    return JSON.parse(localStorage.getItem(BEATEN) ?? '[]')
  } catch {
    return []
  }
}

export function CombatDefi({ onEnd, me }: { onEnd: (score: number) => void; me?: Me }) {
  const [foe, setFoe] = useState<Foe | null>(null)
  if (!foe) return <Pick onPick={setFoe} />
  return <Match foe={foe} me={me} onEnd={onEnd} />
}

/* ---------- Who to fight ---------- */

function Pick({ onPick }: { onPick: (f: Foe) => void }) {
  const done = useMemo(beaten, [])
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,#3b1d5c,#120d24)] px-4 pt-14 pb-6 text-white">
      <div className="text-center font-display text-[26px] leading-tight font-extrabold">Choisis ton adversaire</div>
      <p className="mt-1 text-center text-[13px] font-bold text-white/70">Plus il est fort, plus la victoire rapporte.</p>
      <div className="mt-4 space-y-2.5">
        {FOES.map((f, k) => (
          <button key={f.id} className="flex w-full items-center gap-3 rounded-[22px] bg-white/10 p-3 text-left ring-1 ring-white/10 transition active:scale-[0.98]" onClick={() => onPick(f)}>
            <span className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-white/15">
              <Portrait look={foeLook(f)} gender={f.gender} framing="head" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 font-display text-[18px] leading-tight font-extrabold">
                {f.name}
                {done.includes(f.id) && <Trophy size={15} className="text-[#ffc233]" />}
              </span>
              <span className="block text-[12.5px] leading-snug font-bold text-white/70">{f.about}</span>
              <span className="mt-1 flex items-center gap-1 text-[11.5px] font-extrabold text-[#ffc233]">
                {[0, 1, 2].map((s) => (
                  <Skull key={s} size={13} className={s <= k ? '' : 'opacity-25'} />
                ))}
                <span className="ml-1 text-white/60">jusqu'à {[70, 85, 100][k]} points</span>
              </span>
            </span>
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-2xl bg-black/25 p-3 text-[12.5px] leading-snug font-bold text-white/75">
        <div className="mb-1 font-extrabold text-white">Les coups</div>
        Poing, Poing, Poing : la série qui finit en uppercut. Pied : le coup de pied haut (accroupi, on l'esquive). ▼ + Pied : le balayage. Garde + Poing de près : la saisie, qui passe la garde. Deux fois ◀ ou ▶ : un pas rapide. Jauge
        pleine : Super.
      </div>
    </div>
  )
}

/* ---------- The match ---------- */

type Hud = { hp: [number, number]; meter: [number, number]; clock: number; wins: [number, number]; round: number; combo: number; said: string; saidAt: number; note: string; noteAt: number }

function Match({ foe, me, onEnd }: { foe: Foe; me?: Me; onEnd: (score: number) => void }) {
  const F = useRef<Fight>(createFight())
  const mind = useRef(newMind())
  const keys = useKeys()
  const pad = useRef({ x: 0, up: false, down: false, guard: false, punch: false, kick: false, sup: false })
  const ended = useRef(false)
  const rank = FOES.indexOf(foe)
  const looks = useMemo<[FighterLook, FighterLook]>(() => {
    const mine = me ?? { look: randomLook('homme', rng('me')), gender: 'homme' as const }
    return [
      { look: mine.look, gender: mine.gender, seed: 3 },
      { look: foeLook(foe), gender: foe.gender, seed: foe.seed },
    ]
  }, [me, foe])
  const [hud, setHud] = useState<Hud>({ hp: [100, 100], meter: [0, 0], clock: ROUND_TIME, wins: [0, 0], round: 1, combo: 0, said: '', saidAt: 0, note: '', noteAt: 0 })
  const shown = useRef(hud)
  // The red under the life bar: what was just lost, catching up.
  const [trail, setTrail] = useState<[number, number]>([100, 100])
  useEffect(() => {
    const t = setTimeout(() => setTrail(hud.hp), 450)
    return () => clearTimeout(t)
  }, [hud.hp])
  // The keys' blows as presses (a tap shorter than a frame still counts).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'KeyJ') pad.current.punch = true
      else if (e.code === 'KeyK') pad.current.kick = true
      else if (e.code === 'Space') pad.current.sup = true
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])
  // In development, the fight for the test pilot in the browser.
  if (import.meta.env.DEV) Object.assign(globalThis, { __combat: F })

  const onFrame = (dt: number): FightEvent[] => {
    const fight = F.current
    const k = keys.current
    const p = pad.current
    const x = Math.max(-1, Math.min(1, p.x + (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0)))
    const mine: Pad = {
      x,
      up: p.up || k.has('ArrowUp') || k.has('KeyW'),
      down: p.down || k.has('ArrowDown') || k.has('KeyS'),
      guard: p.guard || k.has('KeyL') || k.has('ShiftLeft'),
      punch: p.punch,
      kick: p.kick,
      sup: p.sup,
    }
    p.punch = p.kick = p.sup = false
    const before = fight.saidAt
    // In the lab, ?dummy: the other one stands still (to look at the moves).
    const still = import.meta.env.DEV && location.search.includes('dummy')
    stepFight(fight, dt, [mine, still ? NO_PAD : aiPad(fight, 1, foe, mind.current)])
    const evs = fight.events.splice(0)
    if (fight.saidAt !== before && fight.said === 'Combat !') sfx.bell()
    let note = ''
    for (const e of evs) {
      const mineHit = e.by === 0
      if (e.kind === 'swing') sfx.swish(e.heavy)
      else if (e.kind === 'hit' || e.kind === 'counter' || e.kind === 'throw') {
        sfx.punch(e.heavy || e.kind !== 'hit')
        haptic(mineHit ? 'medium' : 'heavy')
        if (e.kind === 'counter') note = mineHit ? 'Contre !' : ''
        if (e.kind === 'throw' && mineHit) note = 'Saisie !'
      } else if (e.kind === 'block') sfx.guard()
      else if (e.kind === 'land' && e.heavy) sfx.fall()
      else if (e.kind === 'super') {
        sfx.rise()
        note = mineHit ? 'Coupé-décalé !' : ''
      } else if (e.kind === 'ko') sfx.bell(3)
    }
    // The bars and the words, when they change.
    const [a, b] = fight.f
    const next: Hud = {
      hp: [a.hp, b.hp],
      meter: [Math.floor(a.meter), Math.floor(b.meter)],
      clock: Math.ceil(fight.clock),
      wins: [fight.wins[0], fight.wins[1]],
      round: fight.round,
      combo: b.combo,
      said: fight.said,
      saidAt: fight.saidAt,
      note: note || shown.current.note,
      noteAt: note ? fight.time : shown.current.noteAt,
    }
    const s = shown.current
    if (
      next.hp[0] !== s.hp[0] ||
      next.hp[1] !== s.hp[1] ||
      next.meter[0] !== s.meter[0] ||
      next.meter[1] !== s.meter[1] ||
      next.clock !== s.clock ||
      next.combo !== s.combo ||
      next.saidAt !== s.saidAt ||
      next.noteAt !== s.noteAt ||
      next.wins[0] !== s.wins[0] ||
      next.wins[1] !== s.wins[1]
    ) {
      shown.current = next
      setHud(next)
    }
    // The match over: the score, a moment after the last word.
    if (fight.phase === 'over' && fight.phaseT > 2.2 && !ended.current) {
      ended.current = true
      const won = fight.wins[0] > fight.wins[1]
      if (won)
        try {
          localStorage.setItem(BEATEN, JSON.stringify([...new Set([...beaten(), foe.id])]))
        } catch {
          /* private mode: not kept */
        }
      haptic(won ? 'success' : 'error')
      onEnd(fightScore(fight.wins[0], fight.wins[1], a.hp, fight.dealt[0], rank))
    }
    return evs
  }

  const t = F.current.time
  const saying = hud.said && t - hud.saidAt < (hud.said === 'Combat !' ? 0.7 : 1.4)
  const noting = hud.note && t - hud.noteAt < 0.9
  const bar = (v: number, back: number, right: boolean) => (
    <div className={`relative h-[14px] flex-1 overflow-hidden rounded-[4px] bg-black/60 ring-2 ring-white/70 ${right ? '-scale-x-100' : ''}`}>
      <div className="absolute inset-y-0 left-0 bg-[#e03131] transition-[width] duration-300" style={{ width: `${back}%` }} />
      <div className="absolute inset-y-0 left-0" style={{ width: `${v}%`, background: v > 50 ? 'linear-gradient(#ffe066,#fab005)' : v > 25 ? 'linear-gradient(#ffc078,#fd7e14)' : 'linear-gradient(#ff8787,#e03131)' }} />
    </div>
  )
  const gauge = (v: number, right: boolean) => (
    <div className={`h-[7px] w-[46%] overflow-hidden rounded-full bg-black/55 ring-1 ring-white/30 ${right ? '-scale-x-100' : ''}`}>
      <div className={`h-full ${v >= 100 ? 'animate-pulse' : ''}`} style={{ width: `${v}%`, background: v >= 100 ? 'linear-gradient(90deg,#ff3d7f,#ffd43b)' : '#7048e8' }} />
    </div>
  )
  const pips = (n: number) => (
    <span className="flex gap-1">
      {[0, 1].map((k) => (
        <span key={k} className={`h-2.5 w-2.5 rounded-full ring-1 ring-white/60 ${k < n ? 'bg-[#ffc233]' : 'bg-black/40'}`} />
      ))}
    </span>
  )
  const dir = (d: -1 | 1) =>
    hold(
      () => (pad.current.x = d),
      () => pad.current.x === d && (pad.current.x = 0),
    )
  const key = 'grid touch-none place-items-center rounded-2xl bg-white/85 text-[#16161c] shadow-[0_4px_0_rgba(0,0,0,0.35)] select-none active:translate-y-0.5'
  const btn = (label: string, color: string, on: () => void, off?: () => void, dim?: boolean) => (
    <button
      className={`grid h-[60px] w-[60px] touch-none place-items-center rounded-full font-display text-[13px] leading-none font-extrabold text-white shadow-[0_4px_0_rgba(0,0,0,0.4)] select-none active:translate-y-0.5 ${dim ? 'opacity-40' : ''}`}
      style={{ background: color }}
      {...hold(on, off ?? (() => undefined))}
    >
      {label}
    </button>
  )
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0f0b22]">
      <div className="absolute inset-0">
        <FightCanvas F={F} looks={looks} onFrame={onFrame} />
      </div>
      {/* The Super: the street darkened for an instant. */}
      <div className="pointer-events-none absolute inset-0 bg-black transition-opacity duration-150" style={{ opacity: F.current.flash > 0 ? 0.25 : 0 }} />
      {/* The bars. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 px-3 pt-3 text-white">
        <div className="flex items-center gap-2">
          {bar(hud.hp[0], trail[0], false)}
          <span className="grid h-9 w-11 place-items-center rounded-lg bg-black/70 font-display text-[22px] font-extrabold tabular-nums ring-2 ring-white/60">{hud.clock}</span>
          {bar(hud.hp[1], trail[1], true)}
        </div>
        <div className="mt-1 flex items-center justify-between font-display text-[13px] font-extrabold [text-shadow:0_2px_0_rgba(0,0,0,0.6)]">
          <span className="flex items-center gap-1.5">TOI {pips(hud.wins[0])}</span>
          <span className="flex items-center gap-1.5">
            {pips(hud.wins[1])} {foe.name.toUpperCase()}
          </span>
        </div>
        <div className="mt-1 flex justify-between">
          {gauge(hud.meter[0], false)}
          {gauge(hud.meter[1], true)}
        </div>
        {hud.meter[0] >= 100 && <div className="mt-0.5 font-display text-[12px] font-extrabold text-[#ffd43b] [text-shadow:0_2px_0_rgba(0,0,0,0.6)]">SUPER prêt !</div>}
      </div>
      {/* The announcer, the combo, a counter. */}
      {saying && (
        <div
          key={hud.saidAt}
          className="animate-pop pointer-events-none absolute inset-x-0 top-[26%] text-center font-display text-[46px] leading-none font-extrabold text-white [text-shadow:0_5px_0_rgba(0,0,0,0.55)]"
          style={{ color: hud.said.startsWith('K.O') ? '#ffd43b' : hud.said === 'Défaite' ? '#ff8787' : undefined }}
        >
          {hud.said}
        </div>
      )}
      {hud.combo >= 2 && (
        <div key={hud.combo} className="animate-pop pointer-events-none absolute top-[17%] left-3 font-display text-[26px] leading-none font-extrabold text-[#ffd43b] [text-shadow:0_3px_0_rgba(0,0,0,0.6)]">
          {hud.combo} coups !
        </div>
      )}
      {noting && (
        <div key={hud.noteAt} className="animate-pop pointer-events-none absolute top-[17%] right-3 font-display text-[22px] leading-none font-extrabold text-[#ff8a5c] [text-shadow:0_3px_0_rgba(0,0,0,0.6)]">
          {hud.note}
        </div>
      )}
      {/* The pad. */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-3 pb-[max(0.9rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-3 grid-rows-3 gap-1">
          <span />
          <button
            className={`${key} h-[52px] w-[52px]`}
            {...hold(
              () => (pad.current.up = true),
              () => (pad.current.up = false),
            )}
            aria-label="Sauter"
          >
            <ChevronUp size={30} strokeWidth={3} />
          </button>
          <span />
          <button className={`${key} h-[52px] w-[52px]`} {...dir(-1)} aria-label="À gauche">
            <ChevronLeft size={30} strokeWidth={3} />
          </button>
          <span />
          <button className={`${key} h-[52px] w-[52px]`} {...dir(1)} aria-label="À droite">
            <ChevronRight size={30} strokeWidth={3} />
          </button>
          <span />
          <button
            className={`${key} h-[52px] w-[52px]`}
            {...hold(
              () => (pad.current.down = true),
              () => (pad.current.down = false),
            )}
            aria-label="S'accroupir"
          >
            <ChevronDown size={30} strokeWidth={3} />
          </button>
          <span />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {btn('Poing', '#e03131', () => (pad.current.punch = true))}
          {btn('Pied', '#1c7ed6', () => (pad.current.kick = true))}
          {btn(
            'Garde',
            '#495057',
            () => (pad.current.guard = true),
            () => (pad.current.guard = false),
          )}
          {btn('Super', '#ff3d7f', () => (pad.current.sup = true), undefined, hud.meter[0] < 100)}
        </div>
      </div>
    </div>
  )
}
