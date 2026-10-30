import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { t } from '../lib/i18n'

// « Les règles » of a money game, folded: a tap opens them. The game's
// « taux de retour » (lib/casino.ts) is said in there, not on the game's
// screen.

export function RulesFold({ children, label = t('Les règles') }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2 text-center">
      <button className="inline-flex items-center gap-1 text-[12px] font-extrabold text-white/60" onClick={() => setOpen(!open)} aria-expanded={open}>
        {label} <ChevronDown size={14} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="animate-pop mt-1 text-[11.5px] leading-snug font-bold text-white/55">{children}</p>}
    </div>
  )
}
