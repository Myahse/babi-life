import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronLeft, Eye, EyeOff, Lock } from 'lucide-react'
import { Logo } from '../components/ui'
import { api } from '../lib/api'

/**
 * /mot-de-passe?token=…: the link of the « mot de passe oublié » e-mail
 * (backend auth/reset.go). A new password, once; then back to signing in.
 * Reachable before the waitlist gate (App.tsx): testers sign in too.
 */
export function ResetPassword() {
  const token = new URLSearchParams(useLocation().search).get('token') ?? ''
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="min-h-full bg-[var(--color-night)] text-white">
      <header className="mx-auto flex max-w-md items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <Logo size={32} />
        <Link to="/" className="inline-flex items-center gap-1 text-sm font-extrabold text-white/80">
          <ChevronLeft size={18} strokeWidth={2.6} /> Se connecter
        </Link>
      </header>
      <main className="mx-auto max-w-md px-5 py-8">
        <div className="card space-y-3 p-5 text-[var(--color-ink)]">
          <h1 className="font-display text-2xl font-extrabold">Nouveau mot de passe</h1>
          {!token ? (
            <p className="text-sm font-bold text-[var(--color-ink-soft)]">Ce lien est incomplet. Ouvre celui de l'e-mail en entier, ou redemande un e-mail depuis « Mot de passe oublié ? ».</p>
          ) : done ? (
            <>
              <p className="text-sm font-bold">{done}</p>
              <Link to="/" className="sign-btn block w-full text-center">
                Se connecter
              </Link>
            </>
          ) : (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault()
                setBusy(true)
                setError(null)
                try {
                  setDone((await api.resetPassword(token, password)).text)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Réessaie dans un instant')
                } finally {
                  setBusy(false)
                }
              }}
            >
              <p className="text-sm font-bold text-[var(--color-ink-soft)]">Choisis un nouveau mot de passe (8 caractères au moins). Tes appareils connectés seront déconnectés.</p>
              <label className="relative block">
                <Lock size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[var(--color-ink-soft)]" />
                <input className="input !pr-12 !pl-11 text-base" type={show ? 'text' : 'password'} placeholder="Nouveau mot de passe" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Nouveau mot de passe" required />
                <button type="button" className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-[var(--color-ink-soft)]" onClick={() => setShow(!show)} aria-label={show ? 'Cacher le mot de passe' : 'Afficher le mot de passe'}>
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </label>
              {error && (
                <p className="bg-[#f6d9cf] px-3 py-2 text-sm font-bold text-[var(--rust)]" role="alert">
                  {error}
                </p>
              )}
              <button className="sign-btn w-full" disabled={busy}>
                {busy ? 'Un instant…' : 'Enregistrer'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
