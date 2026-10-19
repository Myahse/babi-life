import { useState } from 'react'
import { FlaskConical, X } from 'lucide-react'
import { api } from '../lib/api'
import { testerPass } from '../lib/launch'
import type { Sim } from '../lib/types'
import type { Act } from '../screens/phoneApps'

const AGES: [string, string][] = [
  ['bebe', 'Bébé'],
  ['enfant', 'Enfant (3 ans)'],
  ['ado', 'Ado (12 ans)'],
  ['adulte', 'Adulte (18 ans)'],
]
const GIFTS = [10_000, 100_000, 1_000_000]

/**
 * The testers' toolbox (only on a browser opened with /testeur): everything
 * at once, without waiting. The server checks the code again
 * (backend/internal/sims/tester.go).
 */
export function TesterTools({ sim, act }: { sim: Sim; act: Act }) {
  const [open, setOpen] = useState(false)
  const pass = testerPass()
  if (!pass) return null
  const tap = (label: string, call: () => ReturnType<typeof api.tester>) => void act(label, 'sparkles', '', call)
  return (
    <>
      <button className="hud flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-extrabold" onClick={() => setOpen(true)} title="Outils testeur">
        <FlaskConical size={17} strokeWidth={2.6} className="text-[var(--color-orange)]" />
        <span className="max-sm:hidden">Testeur</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-3 sm:place-items-center" onClick={() => setOpen(false)}>
          <div className="w-full max-w-[400px] animate-up rounded-[26px] bg-white p-5 text-[var(--color-ink)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <div className="label">Mode testeur</div>
                <h2 className="font-display text-xl font-extrabold">Tout, tout de suite</h2>
              </div>
              <button className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-canvas)]" onClick={() => setOpen(false)} aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
            <Section title="Âge">
              {AGES.map(([id, label]) => (
                <Pill key={id} onClick={() => tap(label, () => api.tester(sim.id, pass, 'age', { stage: id }))}>
                  {label}
                </Pill>
              ))}
            </Section>
            <Section title="Djai">
              {GIFTS.map((n) => (
                <Pill key={n} onClick={() => tap('Djai', () => api.tester(sim.id, pass, 'money', { amount: n }))}>
                  + {n.toLocaleString('fr-FR')}
                </Pill>
              ))}
            </Section>
            <Section title="Le reste">
              <Pill onClick={() => tap('Besoins au max', () => api.tester(sim.id, pass, 'needs'))}>Besoins au max</Pill>
              <Pill disabled={!sim.activity} onClick={() => tap('Finir maintenant', () => api.tester(sim.id, pass, 'finish'))}>
                Finir maintenant
              </Pill>
              <Pill onClick={() => tap('Toutes les applis', () => api.tester(sim.id, pass, 'apps'))}>Toutes les applis</Pill>
            </Section>
            <p className="mt-4 text-xs font-bold text-[var(--color-ink-soft)]">Seulement sur ce navigateur, ouvert avec /testeur. Les joueurs ne voient pas ces outils.</p>
          </div>
        </div>
      )}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="label mb-2">{title}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function Pill({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="rounded-full bg-[var(--color-canvas)] px-3.5 py-2 text-sm font-extrabold transition enabled:active:scale-95 disabled:opacity-40" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}
