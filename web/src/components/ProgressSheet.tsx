import { Check, Lock, Star, X } from 'lucide-react'
import type { Progress, Sim, World } from '../lib/types'
import { iconFor } from './icons'
import { IconTile } from './ui'

// The level and the skills (backend game/progress.go): every activity done
// brings XP, the level goes up; the skills it trains go up with it, and their
// levels unlock things (new actions, more from what they train). Some skills
// open only at a player's level.

/** The bar under a level: how far into it, how much to the next. */
function Bar({ into, next, color }: { into: number; next: number; color: string }) {
  const k = next > 0 ? Math.min(1, into / next) : 1
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-black/10">
      <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.round(k * 100)}%`, background: color }} />
    </span>
  )
}

/** The level counter in the HUD, under the profile: the level, the bar to the next. */
export function LevelPill({ progress, onOpen }: { progress?: Progress; onOpen: () => void }) {
  const p = progress ?? { level: 1, into: 0, next: 100 }
  return (
    <button className="hud pointer-events-auto flex w-[150px] items-center gap-2 rounded-full py-1 pr-3 pl-1 text-left transition active:scale-95 sm:w-[170px]" onClick={onOpen} aria-label={`Niveau ${p.level}`}>
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#ffd54f] to-[#ff9f1a] font-display text-[13px] font-extrabold text-[#5a3a00] shadow-[inset_0_-2px_0_rgba(0,0,0,0.15)]">{p.level}</span>
      <span className="min-w-0 flex-1 leading-none">
        <span className="mb-1 block text-[10px] font-extrabold tracking-wider text-[var(--color-ink-soft)] uppercase">Niveau {p.level}</span>
        <Bar into={p.into} next={p.next} color="linear-gradient(90deg,#ffb020,#ff6a00)" />
      </span>
    </button>
  )
}

export function ProgressSheet({ world, sim, onClose }: { world: World; sim: Sim; onClose: () => void }) {
  const p = sim.progress ?? { xp: 0, level: 1, into: 0, next: 100, skills: [] }
  const skills = world.skills ?? []
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up max-h-[85%] w-full overflow-y-auto rounded-t-[28px] pb-[max(1rem,env(safe-area-inset-bottom))] lg:w-[480px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-[#ffb020] to-[#ff6a00] p-4 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/25 font-display text-[30px] font-extrabold shadow-[inset_0_-3px_0_rgba(0,0,0,0.15)]">{p.level}</span>
            <div className="min-w-0 flex-1">
              <div className="label !text-white/80">Ta progression</div>
              <div className="font-display text-[24px] leading-tight font-extrabold">Niveau {p.level}</div>
              <div className="mt-1.5">
                <Bar into={p.into} next={p.next} color="#ffffff" />
              </div>
              <div className="mt-1 text-[12px] font-extrabold text-white/85">
                {p.into} / {p.next} XP jusqu'au niveau {p.level + 1}
              </div>
            </div>
            <button className="icon-btn self-start bg-white/20 text-white" onClick={onClose} aria-label="Fermer">
              <X size={22} strokeWidth={2.6} />
            </button>
          </div>
          <p className="mt-3 text-[13px] leading-snug font-bold text-white/90">Chaque activité menée au bout rapporte de l'XP (une heure ≈ 20 XP) et entraîne ses compétences. Leurs niveaux débloquent de nouvelles actions.</p>
        </div>
        <div className="grid gap-2.5 p-4">
          {skills.map((s) => {
            const v = p.skills.find((x) => x.id === s.id) ?? { level: 0, into: 0, next: 60, unlocked: !s.unlock }
            return (
              <div key={s.id} className={`rounded-[20px] p-3 ${v.unlocked ? 'bg-[var(--color-canvas)]' : 'bg-[var(--color-canvas)] opacity-70'}`}>
                <div className="flex items-center gap-3">
                  <IconTile icon={v.unlocked ? iconFor(s.icon) : Lock} colors={v.unlocked ? ['#ffd54f', '#ff8a00'] : ['#c9ccd6', '#8a8fa3']} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-[16px] font-extrabold">{s.label}</span>
                      <span className="text-[12px] font-extrabold text-[var(--color-ink-soft)]">{v.unlocked ? `niv. ${v.level}/10` : `s'ouvre au niveau ${s.unlock}`}</span>
                    </div>
                    <div className="truncate text-[12px] font-bold text-[var(--color-ink-soft)]">{s.hint}</div>
                    {v.unlocked && (
                      <div className="mt-1.5">
                        <Bar into={v.level >= 10 ? 1 : v.into} next={v.level >= 10 ? 1 : v.next} color="linear-gradient(90deg,#ffb020,#ff6a00)" />
                      </div>
                    )}
                  </div>
                </div>
                <ul className="mt-2 grid gap-1 pl-1">
                  {s.perks.map((pk) => {
                    const got = v.unlocked && v.level >= pk.level
                    return (
                      <li key={pk.text} className={`flex items-center gap-1.5 text-[12.5px] font-bold ${got ? 'text-[#0a7a3e]' : 'text-[var(--color-ink-soft)]'}`}>
                        {got ? <Check size={14} strokeWidth={3} className="shrink-0" /> : <Star size={13} strokeWidth={2.6} className="shrink-0 opacity-60" />}
                        <span className="min-w-0">
                          {pk.level > 0 && <span className="mr-1 rounded-full bg-black/5 px-1.5 text-[11px]">niv. {pk.level}</span>}
                          {pk.text}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
