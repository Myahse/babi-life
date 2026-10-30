import { Lock, type LucideIcon } from 'lucide-react'
import type { Look } from '../lib/types'
import { MAX_ACCESSORIES, accessoriesOf, toggleAccessory, type Choice } from '../avatar/options'
import { Portrait, type Framing } from '../avatar/portrait'
import { t, tx } from '../lib/i18n'

// The pieces of the look editors (the creator and « Changer de look »).

export function Section({ title, right, icon: Icon, children }: { title: string; right?: React.ReactNode; icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <span className="label flex items-center gap-1.5">
          {Icon && <Icon size={13} />}
          {title}
        </span>
        {right}
      </div>
      {children}
    </section>
  )
}

/** A grid of options, each shown as a picture of the Sim wearing it. */
export function Options({ choices, value, onPick, look, gender, field, framing, stage }: { choices: Choice[]; value: string; onPick: (id: string) => void; look: Required<Look>; gender: 'femme' | 'homme'; field: keyof Look; framing: Framing; /** Pictured at its age. */ stage?: string }) {
  return (
    <div className={`grid gap-2.5 ${framing === 'full' ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-4'}`}>
      {choices.map((c) => (
        <button key={c.id} className="tile flex flex-col items-center overflow-hidden pb-1.5" aria-pressed={value === c.id} onClick={() => onPick(c.id)}>
          <span className={`block w-full ${framing === 'full' ? 'aspect-[3/4]' : 'aspect-square'}`}>
            <Portrait look={{ ...look, [field]: c.id }} gender={gender} framing={framing} stage={stage} />
          </span>
          <span className="px-1 text-center text-[11px] leading-tight font-extrabold">{c.label}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * The accessories: several at once (glasses, a bag, a watch…), one per place
 * on the body, five at most. A tap puts one on or takes it off; each picture
 * shows the Sim with it added to what it already wears.
 */
export function AccessoryOptions({ choices, value, onPick, look, gender, locked, stage }: { choices: Choice[]; value: string; onPick: (accessory: string) => void; look: Required<Look>; gender: 'femme' | 'homme'; /** Not this Sim's (the Pack Prestige's crown): shown, with a lock, not picked. */ locked?: Set<string>; /** Pictured at its age. */ stage?: string }) {
  const worn = accessoriesOf({ accessory: value })
  return (
    <div>
      <p className="mb-2 text-xs font-bold text-[var(--color-ink-soft)]">
        {tx("Jusqu'à {MAX_ACCESSORIES} à la fois, un par endroit (tête, yeux, oreilles, cou, poignet, sac) · {length}/{MAX_ACCESSORIES}", { MAX_ACCESSORIES, length: worn.length })}
      </p>
      <div className="grid grid-cols-4 gap-2.5">
        {choices.map((c) => {
          const on = c.id === 'none' ? worn.length === 0 : worn.includes(c.id)
          const shut = !!locked?.has(c.id) && !on
          return (
            <button key={c.id} className="tile relative flex flex-col items-center overflow-hidden pb-1.5 disabled:opacity-60" aria-pressed={on} disabled={shut} title={shut ? t('Avec le Pack Prestige (Boutique)') : undefined} onClick={() => onPick(toggleAccessory(value, c.id))}>
              <span className="block aspect-square w-full">
                <Portrait look={{ ...look, accessory: c.id === 'none' ? 'none' : on ? value : toggleAccessory(value, c.id) }} gender={gender} framing="bust" stage={stage} />
              </span>
              <span className="px-1 text-center text-[11px] leading-tight font-extrabold">{c.label}</span>
              {shut && (
                <span className="absolute top-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-[#ffd43b] text-[#141416]">
                  <Lock size={11} strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

