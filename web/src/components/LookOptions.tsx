import type { LucideIcon } from 'lucide-react'
import type { Look } from '../lib/types'
import type { Choice } from '../avatar/options'
import { Portrait, type Framing } from '../avatar/portrait'

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
export function Options({ choices, value, onPick, look, gender, field, framing }: { choices: Choice[]; value: string; onPick: (id: string) => void; look: Required<Look>; gender: 'femme' | 'homme'; field: keyof Look; framing: Framing }) {
  return (
    <div className={`grid gap-2.5 ${framing === 'full' ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-4'}`}>
      {choices.map((c) => (
        <button key={c.id} className="tile flex flex-col items-center overflow-hidden pb-1.5" aria-pressed={value === c.id} onClick={() => onPick(c.id)}>
          <span className={`block w-full ${framing === 'full' ? 'aspect-[3/4]' : 'aspect-square'}`}>
            <Portrait look={{ ...look, [field]: c.id }} gender={gender} framing={framing} />
          </span>
          <span className="px-1 text-center text-[11px] leading-tight font-extrabold">{c.label}</span>
        </button>
      ))}
    </div>
  )
}

