import { useEffect, useState } from 'react'
import { FlaskConical, KeyRound, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { isTester, isTesterCode, setTester, testerAnswered, testerPass, testerTyped } from '../lib/launch'
import { useSession } from '../store/session'
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
 * The testers' toolbox: everything at once, without waiting. It belongs to a
 * tester account (users.tester, set with the testers' code or from /admin),
 * and shows on a browser opened with /testeur too. The server checks the
 * account again on each tap (backend/internal/sims/tester.go).
 */
export function TesterTools({ sim, act }: { sim: Sim; act: Act }) {
  const token = useSession((s) => s.token)
  const user = useSession((s) => s.user)
  const signIn = useSession((s) => s.signIn)
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const account = !!user?.tester

  // The code kept on this browser: the tools work with it even before the account is a tester's.
  const [pass, setPass] = useState(testerPass)
  const become = async (code: string, typed: boolean) => {
    const u = await api.becomeTester(code, typed)
    if (token) signIn(token, u)
  }
  // A browser opened with /testeur makes the account signed in on it a tester's;
  // a tester account keeps this browser past the wish list.
  useEffect(() => {
    if (account) {
      if (!isTester()) setTester(true)
    } else if (testerPass()) {
      become(testerPass(), testerTyped()).then(
        () => testerAnswered(),
        (x) => {
          // The tests are over for this account (the testers' reset) and the code was only kept: the toolbox asks
          // for it again. The game stays open here: sending the person back to the wish list mid-game, without a
          // word, was taken for a bug (and before launch, it shut the game for them).
          if (x instanceof ApiError && x.status === 403) {
            testerAnswered(true)
            setPass('')
            setError('Les tests ont été remis à zéro pour ton compte : entre le code testeur pour retrouver les outils.')
          }
        },
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account])

  if (!account && !isTester()) return null
  const tap = (label: string, call: () => ReturnType<typeof api.tester>) => void act(label, 'sparkles', '', call)
  const unlock = async () => {
    setError(null)
    // The code is checked here first, so a server that is asleep or not yet
    // updated isn't taken for a wrong code.
    if (!(await isTesterCode(typed))) {
      setError('Code incorrect.')
      return
    }
    setTester(true, typed)
    setPass(typed.trim())
    try {
      await become(typed, true)
      testerAnswered()
    } catch (x) {
      setError(
        x instanceof ApiError && x.status === 404
          ? "Code bon, outils ouverts sur ce navigateur. Ton compte deviendra testeur tout seul dans peu de temps."
          : x instanceof ApiError
            ? `Code bon, outils ouverts sur ce navigateur. Le serveur a répondu : ${x.message}`
            : 'Code bon, outils ouverts sur ce navigateur. Le serveur ne répond pas pour le compte : réessaie plus tard.',
      )
    }
  }
  return (
    <>
      <button className="hud flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-extrabold" onClick={() => setOpen(true)} title="Outils testeur">
        <FlaskConical size={17} strokeWidth={2.6} className="text-[var(--color-orange)]" />
        <span className="max-sm:hidden short:hidden">Testeur</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-3 sm:place-items-center" onClick={() => setOpen(false)}>
          <div className="w-full max-w-[400px] animate-up rounded-[26px] bg-white p-5 text-[var(--color-ink)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <div className="label">{account ? 'Compte testeur' : 'Mode testeur'}</div>
                <h2 className="font-display text-xl font-extrabold">Tout, tout de suite</h2>
              </div>
              <button className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-canvas)]" onClick={() => setOpen(false)} aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
            {!account && !pass ? (
              <div className="mt-4 grid gap-2">
                <p className="text-sm font-bold text-[var(--color-ink-soft)]">Entre le code testeur une fois : ton compte devient un compte testeur, sur tous tes appareils.</p>
                <span className="flex items-center gap-2 rounded-2xl bg-[var(--color-canvas)] px-3">
                  <KeyRound size={16} className="text-[var(--color-ink-soft)]" />
                  <input className="min-w-0 flex-1 bg-transparent py-3 text-[15px] font-bold outline-none" type="password" autoComplete="off" value={typed} onChange={(e) => (setTyped(e.target.value), setError(null))} onKeyDown={(e) => e.key === 'Enter' && void unlock()} aria-label="Code testeur" />
                </span>
                {error && <p className="text-sm font-bold text-[#d81b3f]">{error}</p>}
                <button className="btn" disabled={!typed.trim()} onClick={() => void unlock()}>
                  Activer le compte testeur
                </button>
              </div>
            ) : (
              <>
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
              </>
            )}
            {error && pass && <p className="mt-3 text-xs font-bold text-[var(--color-ink-soft)]">{error}</p>}
            <p className="mt-4 text-xs font-bold text-[var(--color-ink-soft)]">Réservé aux comptes testeurs : les joueurs ne voient pas ces outils.</p>
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
