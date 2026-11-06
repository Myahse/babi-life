import { useEffect, useRef, useState } from 'react'
import { Frown, Heart, Laugh, Meh, Smile, Star, Users, X } from 'lucide-react'
import { iconFor } from './icons'
import { IconTile } from './ui'
import { api } from '../lib/api'
import { sfx } from '../lib/sfx'
import { haptic } from '../lib/native'
import { duration } from '../game/rules'
import { CAREER_SKILL, SKILLS, STATUS, moodColor, openPanel, promotionSkill, skillById, skillProgress, useVie } from '../game/vie'
import type { ActionResult, Mood, Moodlet, Relation, Sim, World } from '../lib/types'
import { t as tr } from '../lib/i18n'
import { WishBursts, WishCards, WishPanel } from './Envies'

// Le mode vie's moods, skills and relationships on screen (the update « mode-vie », game/vie.ts; backend
// sims/vie.go keeps them all): a small group of round buttons on the side (the mood's face in its colour,
// with its moodlets' little icons beside it; the skills; the people), each opening its panel over the
// bottom bar, and the « +Cuisine » that pops when a skill rises. Nothing per frame: it draws when the
// Sim comes back from the server (or the minute turns, for the time left).

const GOOD: [string, string] = ['#7ee0a1', '#1f9d55']
const BAD: [string, string] = ['#ff9a9a', '#e03a3a']
const FACE = { ravi: Laugh, heureux: Smile, bien: Smile, contrarie: Meh, mal: Frown } as const

/** The group of buttons and what they open. `top`: under the queue at home and in places. */
export function LifeButtons({ sim, world, onResult }: { sim: Sim; world: World; top?: boolean; /** A wish changed, a perk bought: the Sim the server sends back. */ onResult: (res: ActionResult) => void }) {
  const { panel } = useVie()
  const mood = sim.mood
  const color = moodColor(mood) ?? '#00b86b'
  const ms = [...(sim.life?.moodlets ?? [])].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
  // The mood's button bounces when the mood changes level.
  const [bump, setBump] = useState(0)
  const was = useRef(mood?.level)
  useEffect(() => {
    if (was.current && mood?.level && was.current !== mood.level) setBump((n) => n + 1)
    was.current = mood?.level
  }, [mood?.level])
  const Face = FACE[mood?.level ?? 'bien']
  const btn = (on: boolean) => `hud pointer-events-auto grid h-11 w-11 place-items-center rounded-full transition-transform active:scale-90 ${on ? 'ring-2 ring-[var(--color-orange)]' : ''}`
  return (
    <>
      {/* Above the Gbairai and phone buttons, bottom right: clear of the compass and the top bar on every screen
          (in a short landscape screen, in a row). */}
      <div className="pointer-events-none absolute right-3 bottom-[calc(max(0.75rem,var(--sab,env(safe-area-inset-bottom)))+9.25rem)] z-30 flex flex-col items-end gap-2 lg:right-5 lg:bottom-[10rem] short:flex-row-reverse short:items-center">
        <div className="flex items-center gap-1.5">
          {/* The moodlets that weigh most, small, beside it (the panel says why and how long). */}
          {ms.length > 0 && (
            <button className="hud pointer-events-auto flex h-9 items-center gap-1 rounded-full px-1.5 active:scale-95" onClick={() => (haptic('light'), openPanel('mood'))} aria-label={tr('Humeurs')}>
              {ms.slice(0, 3).map((m) => (
                <IconTile key={m.id + (m.reason ?? '')} icon={iconFor(m.icon)} colors={m.weight >= 0 ? GOOD : BAD} size={26} radius={13} className="animate-pop" />
              ))}
              {ms.length > 3 && <span className="pr-1 text-[11px] font-extrabold text-[var(--color-ink-soft)]">+{ms.length - 3}</span>}
            </button>
          )}
          <button key={bump} className={`${btn(panel === 'mood')} ${bump ? 'animate-bump' : ''}`} onClick={() => (haptic('light'), openPanel('mood'))} aria-label={tr('Humeur : {0}', { 0: mood?.label ?? tr('Ça va') })}>
            <span className="grid h-9 w-9 place-items-center rounded-full text-white" style={{ background: color }}>
              <Face size={21} strokeWidth={2.6} />
            </span>
          </button>
        </div>
        <button className={btn(panel === 'skills')} onClick={() => (haptic('light'), openPanel('skills'))} aria-label={tr('Compétences')}>
          <Star size={20} strokeWidth={2.6} className="text-[#ffa000]" />
        </button>
        <button className={btn(panel === 'relations')} onClick={() => (haptic('light'), openPanel('relations'))} aria-label={tr('Relations')}>
          <Users size={20} strokeWidth={2.6} className="text-[#e0245e]" />
        </button>
      </div>
      {/* The wishes (components/Envies.tsx): their small bar just over the mood button (the three buttons' 9.25rem stack
          and a gap), clear of the house's floor buttons; it opens their panel and the shop. On a short screen, over the row, the points only. */}
      <div className="pointer-events-none absolute right-3 bottom-[calc(max(0.75rem,var(--sab,env(safe-area-inset-bottom)))+19rem)] z-30 lg:right-5 lg:bottom-[19.75rem] short:bottom-[calc(max(0.75rem,var(--sab,env(safe-area-inset-bottom)))+12.25rem)]">
        <WishCards sim={sim} />
      </div>
      {panel && (
        <Sheet onClose={() => openPanel(null)} title={panel === 'mood' ? tr('Humeur') : panel === 'skills' ? tr('Compétences') : panel === 'envies' ? tr('Envies') : tr('Relations')}>
          {panel === 'mood' && <MoodPanel mood={mood} moodlets={ms} now={sim.gameMinutes} />}
          {panel === 'skills' && <SkillsPanel sim={sim} world={world} />}
          {panel === 'relations' && <RelationsPanel simId={sim.id} />}
          {panel === 'envies' && <WishPanel sim={sim} onResult={onResult} />}
        </Sheet>
      )}
      <SkillPops />
      <WishBursts />
    </>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-40" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card animate-up absolute inset-x-3 bottom-[calc(max(0.75rem,var(--sab,env(safe-area-inset-bottom)))+5.25rem)] mx-auto max-w-md p-3 lg:bottom-[7rem]">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold">{title}</h2>
          <button className="grid h-9 w-9 place-items-center rounded-full bg-black/5 active:scale-90" onClick={onClose} aria-label={tr('Fermer')}>
            <X size={18} strokeWidth={2.8} />
          </button>
        </div>
        <div className="max-h-[48vh] space-y-1.5 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  )
}

function MoodPanel({ mood, moodlets, now }: { mood?: Mood; moodlets: Moodlet[]; now: number }) {
  const color = moodColor(mood) ?? '#00b86b'
  return (
    <>
      <div className="flex items-center gap-2.5 rounded-2xl p-2" style={{ background: `${color}22` }}>
        <span className="grid h-10 w-10 place-items-center rounded-full text-white" style={{ background: color }}>
          {(() => {
            const F = FACE[mood?.level ?? 'bien']
            return <F size={22} strokeWidth={2.6} />
          })()}
        </span>
        <span className="leading-tight">
          <span className="block font-display text-base font-extrabold">{mood?.label ?? tr('Ça va')}</span>
          <span className="block text-[11.5px] font-bold text-[var(--color-ink-soft)]">{tr('Ce qui joue sur son humeur, et combien de temps')}</span>
        </span>
      </div>
      {moodlets.length === 0 && <p className="p-2 text-center text-[13px] font-bold text-[var(--color-ink-soft)]">{tr('Rien de spécial pour le moment.')}</p>}
      {moodlets.map((m) => (
        <div key={m.id + (m.reason ?? '')} className="tile flex items-center gap-2.5 p-2">
          <IconTile icon={iconFor(m.icon)} colors={m.weight >= 0 ? GOOD : BAD} size={36} radius={18} />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[14px] font-extrabold">{m.label}</span>
            <span className="block text-[11.5px] font-bold text-[var(--color-ink-soft)]">{m.need ? tr('Tant que ça dure') : tr('Encore {0}', { 0: duration(Math.max(1, m.until - now)) })}</span>
          </span>
          <span className={`font-display text-base font-extrabold ${m.weight >= 0 ? 'text-[#1f9d55]' : 'text-[#e03a3a]'}`}>{m.weight > 0 ? `+${m.weight}` : m.weight}</span>
        </div>
      ))}
    </>
  )
}

function SkillsPanel({ sim, world }: { sim: Sim; world: World }) {
  const pts = sim.life?.skills ?? {}
  const career = world.careers.find((c) => c.id === sim.career)
  const need = career ? CAREER_SKILL[career.id] : undefined
  const next = sim.careerLevel + 1
  const level = need ? skillProgress(pts[need] ?? 0).level : 0
  const asked = career && need && next < career.levels.length ? promotionSkill(next) : 0
  return (
    <>
      {career && need && asked > 0 && (
        <p className={`rounded-2xl p-2 text-[12px] font-extrabold ${level >= asked ? 'bg-[#1f9d55]/12 text-[#1f7a45]' : 'bg-[#ffa000]/15 text-[#a06000]'}`}>
          {tr('Pour devenir {0} : {1} niveau {2}', { 0: career.levels[next].title, 1: skillById(need)?.label ?? need, 2: asked })}
          {level >= asked ? ' ✓' : ''}
        </p>
      )}
      {SKILLS.map((s) => {
        const { level, share } = skillProgress(pts[s.id] ?? 0)
        return (
          <div key={s.id} className="tile flex items-center gap-2.5 p-2">
            <IconTile icon={iconFor(s.icon)} colors={s.colors} size={36} radius={12} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[14px] font-extrabold">{s.label}</span>
                <span className="tnum font-display text-[13px] font-extrabold">{tr('Niv. {0}', { 0: level })}<span className="text-[var(--color-ink-soft)]">/10</span></span>
              </span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-black/10">
                <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.round(share * 100)}%`, background: s.colors[1] }} />
              </span>
              <span className="mt-0.5 block truncate text-[11px] font-bold text-[var(--color-ink-soft)]">{s.hint}</span>
            </span>
          </div>
        )
      })}
    </>
  )
}

function RelationsPanel({ simId }: { simId: string }) {
  const [people, setPeople] = useState<Relation[] | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    let on = true
    api
      .relations(simId)
      .then((r) => on && setPeople(r.people))
      .catch(() => on && setErr(true))
    return () => void (on = false)
  }, [simId])
  if (err) return <p className="p-2 text-center text-[13px] font-bold text-[var(--color-ink-soft)]">{tr('Pas possible pour le moment.')}</p>
  if (!people) return <p className="p-2 text-center text-[13px] font-bold text-[var(--color-ink-soft)]">{tr('Un instant…')}</p>
  if (!people.length) return <p className="p-2 text-center text-[13px] font-bold text-[var(--color-ink-soft)]">{tr('Personne encore : va saluer les gens du quartier.')}</p>
  return (
    <>
      {people.map((p) => {
        const st = STATUS[p.status]
        return (
          <div key={p.kind + p.id} className="tile flex items-center gap-2.5 p-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-base font-extrabold text-white" style={{ background: st.color }}>
              {p.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[14px] font-extrabold">{p.name}</span>
                <span className="shrink-0 rounded-full px-1.5 py-px text-[10px] font-extrabold text-white" style={{ background: st.color }}>{st.label}</span>
                {p.kind !== 'pnj' && <span className="shrink-0 text-[10px] font-extrabold text-[var(--color-ink-soft)]">{p.kind === 'famille' ? tr('Famille') : tr('Joueur')}</span>}
              </span>
              <Gauge icon={<Smile size={11} strokeWidth={3} />} value={p.friendship} color="#1f9d55" label={tr('Amitié')} />
              {(p.romance > 0 || p.status === 'partenaire') && <Gauge icon={<Heart size={11} strokeWidth={3} />} value={p.romance} color="#e0245e" label={tr('Amour')} />}
            </span>
          </div>
        )
      })}
    </>
  )
}

function Gauge({ icon, value, color, label }: { icon: React.ReactNode; value: number; color: string; label: string }) {
  return (
    <span className="mt-1 flex items-center gap-1.5" aria-label={`${label} ${value}`} title={label}>
      <span style={{ color }}>{icon}</span>
      <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(2, value)}%`, background: color }} />
      </span>
      <span className="tnum w-6 text-right text-[10px] font-extrabold text-[var(--color-ink-soft)]">{value}</span>
    </span>
  )
}

/** « +Cuisine » over the scene when a skill rises; « Cuisine niveau 3 ! », bigger, with a sound, when a level is reached. */
function SkillPops() {
  const { pops } = useVie()
  const last = useRef(0)
  useEffect(() => {
    const p = pops[pops.length - 1]
    if (!p || p.key === last.current) return
    last.current = p.key
    if (p.level) (sfx.rise(), haptic('success'))
    else sfx.pop()
  }, [pops])
  if (!pops.length) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[38%] z-40 flex flex-col items-center gap-1.5">
      {pops.map((p) => {
        const s = skillById(p.skill)
        if (!s) return null
        return (
          <span key={p.key} className={`animate-skill flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display font-extrabold text-white shadow-lg ring-2 ring-white ${p.level ? 'text-[17px]' : 'text-[14px]'}`} style={{ background: s.colors[1] }}>
            <IconTile icon={iconFor(s.icon)} colors={['#fff', 'rgba(255,255,255,0.25)']} size={p.level ? 26 : 22} radius={11} />
            {p.level ? tr('{0} niveau {1} !', { 0: s.label, 1: p.level }) : `+${s.label.toLowerCase()}`}
          </span>
        )
      })}
    </div>
  )
}
