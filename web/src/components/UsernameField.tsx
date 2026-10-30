import { useEffect, useRef } from 'react'
import { AtSign, Check, LoaderCircle, X } from 'lucide-react'
import { useUsernameCheck } from '../lib/username'
import { t } from '../lib/i18n'

/** The username input: a spinner while checking, a check when free, a cross and a shake when taken, then free alternatives. */
export function UsernameField({ value, onChange, first, last, autoFocus }: { value: string; onChange: (v: string) => void; first?: string; last?: string; autoFocus?: boolean }) {
  const { status, suggestions } = useUsernameCheck(value, first, last)
  const wrap = useRef<HTMLDivElement>(null)
  const prev = useRef(status)
  useEffect(() => {
    if (status === prev.current) return
    prev.current = status
    const el = wrap.current
    if (!el || status !== 'taken') return
    el.classList.remove('motion-shake')
    void el.offsetWidth // restart the animation
    el.classList.add('motion-shake')
  }, [status])

  const hint = {
    idle: t('Ton nom dans le jeu, visible par tous.'),
    invalid: t('3 à 24 caractères : lettres, chiffres, _ ou .'),
    checking: t('On vérifie…'),
    available: t('Disponible !'),
    taken: t('Déjà pris. Essaie :'),
  }[status]

  return (
    <div>
      <div ref={wrap} className="relative">
        <AtSign size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[var(--color-ink-soft)]" />
        <input
          className={`input h-[52px] !pr-12 !pl-11 text-base ${status === 'taken' || status === 'invalid' ? '!border-[#ff4d6d]' : status === 'available' ? '!border-[var(--color-emerald)]' : ''}`}
          placeholder={t('Pseudo')}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={24}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\s/g, ''))}
          aria-label={t('Pseudo')}
          aria-invalid={status === 'taken' || status === 'invalid'}
          autoFocus={autoFocus}
          required
        />
        <span className="absolute top-1/2 right-4 -translate-y-1/2" aria-hidden>
          {status === 'checking' && <LoaderCircle size={20} className="animate-spin text-[var(--color-ink-soft)]" />}
          {status === 'available' && (
            <span className="motion-pop grid h-6 w-6 place-items-center rounded-full bg-[var(--color-emerald)] text-white">
              <Check size={15} strokeWidth={3.4} />
            </span>
          )}
          {(status === 'taken' || status === 'invalid') && (
            <span className="motion-pop grid h-6 w-6 place-items-center rounded-full bg-[#ff4d6d] text-white">
              <X size={15} strokeWidth={3.4} />
            </span>
          )}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-1">
        <span className={`text-xs font-bold ${status === 'available' ? 'text-[var(--color-emerald-deep)]' : status === 'taken' || status === 'invalid' ? 'text-[#d81b3f]' : 'text-[var(--color-ink-soft)]'}`} role="status">
          {hint}
        </span>
        {suggestions.map((s, i) => (
          <button key={s} type="button" onClick={() => onChange(s)} className="motion-pop rounded-full bg-[#e3f9ee] px-2.5 py-1 text-xs font-extrabold text-[var(--color-emerald-deep)]" style={{ animationDelay: `${i * 70}ms` }}>
            @{s}
          </button>
        ))}
      </div>
    </div>
  )
}
