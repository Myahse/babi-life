import { useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Gamepad2, Lock, Mail, Smartphone, Sparkles, UserRound } from 'lucide-react'
import { api } from '../lib/api'
import type { Look, User } from '../lib/types'
import { useSession } from '../store/session'
import { useWorld } from '../store/world'
import { Scene } from '../components/Scene'
import { Portrait } from '../avatar/portrait'
import { Logo } from '../components/ui'
import { UsernameField } from '../components/UsernameField'
import { suggestFrom } from '../lib/username'

const GOOGLE_ENABLED = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)

const CROWD: { look: Look; gender: 'femme' | 'homme'; size: number }[] = [
  { gender: 'homme', size: 120, look: { skin: '#6e4024', hair: 'short', hairColor: '#141010', outfit: 'jersey', outfitColor: '#ff7a00', beard: 'bouc' } },
  { gender: 'femme', size: 136, look: { skin: '#8a5532', hair: 'headwrap', hairColor: '#141010', outfit: 'pagne', outfitColor: '#ff7a00', accessory: 'earrings', pattern: 'cercles' } },
  { gender: 'homme', size: 126, look: { skin: '#a46c42', hair: 'locks', hairColor: '#2e1b12', outfit: 'boubou', outfitColor: '#00a862', accessory: 'chain' } },
]

export function Title() {
  const signIn = useSession((s) => s.signIn)
  const world = useWorld((s) => s.world)
  const worldError = useWorld((s) => s.error)
  const navigate = useNavigate()
  const [devName, setDevName] = useState('Awa Koné')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [username, setUsername] = useState('')
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // The username follows the names until the person types one themselves.
  function pickName(f: string, l: string) {
    setFirst(f)
    setLast(l)
    if (!usernameTouched) setUsername(suggestFrom(f, l))
  }

  async function finish(p: Promise<{ token: string; user: User }>) {
    setBusy(true)
    setError(null)
    try {
      const { token, user } = await p
      signIn(token, user)
      navigate('/jeu')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-[var(--color-night)]">
      <Scene className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#120d36] via-[#120d36]/50 to-transparent" />

      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center px-5 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="animate-pop mt-4 sm:mt-10 lg:scale-125">
          <Logo size={92} />
        </div>
        <p className="animate-up mt-5 text-center lg:mt-9 lg:text-2xl font-display text-xl font-bold text-white/95 [text-shadow:0_2px_8px_rgba(0,0,0,0.35)]" style={{ animationDelay: '120ms' }}>
          Ta vie. Ton quartier. Ton Babi.
        </p>

        {/* The cast standing on the quay */}
        <div className="relative mt-auto flex items-end justify-center">
          {CROWD.map((c, i) => (
            <div key={i} className="animate-up -mx-3" style={{ animationDelay: `${200 + i * 120}ms` }}>
              <span className="block" style={{ width: c.size, height: c.size * 1.35 }}>
                <Portrait look={c.look} gender={c.gender} framing="full" />
              </span>
            </div>
          ))}
        </div>

        <section className="animate-up w-full rounded-3xl bg-white p-5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.7)]" style={{ animationDelay: '380ms' }}>
          {/* Se connecter / Créer un compte */}
          <div className="segmented mb-4" role="tablist">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => (setMode(m), setError(null))}
              >
                {m === 'login' ? 'Se connecter' : 'Créer un compte'}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {GOOGLE_ENABLED ? (
              <div className="flex h-[50px] justify-center [&>div]:w-full">
                <GoogleLogin
                  onSuccess={(r) => r.credential && finish(api.googleLogin(r.credential))}
                  onError={() => setError('Connexion Google annulée')}
                  shape="pill"
                  size="large"
                  text={mode === 'login' ? 'continue_with' : 'signup_with'}
                  width="360"
                />
              </div>
            ) : (
              <button className="btn btn-white w-full" disabled title="Ajoute VITE_GOOGLE_CLIENT_ID pour activer">
                <GoogleIcon /> {mode === 'login' ? 'Continuer avec Google' : "S'inscrire avec Google"}
              </button>
            )}

            <div className="flex items-center gap-3 text-xs font-extrabold text-[var(--color-ink-soft)]">
              <span className="h-px flex-1 bg-[var(--color-line)]" />
              ou avec ton e-mail
              <span className="h-px flex-1 bg-[var(--color-line)]" />
            </div>

            <form
              className="flex flex-col gap-2.5"
              onSubmit={(e) => {
                e.preventDefault()
                finish(mode === 'login' ? api.login(email, password) : api.register({ firstName: first, lastName: last, username, email, password }))
              }}
            >
              {mode === 'register' && (
                <div className="motion-stagger flex flex-col gap-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="relative">
                      <UserRound size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[var(--color-ink-soft)]" />
                      <input className="input !pl-11 text-base" placeholder="Prénom" autoComplete="given-name" value={first} onChange={(e) => pickName(e.target.value, last)} aria-label="Prénom" required />
                    </label>
                    <input className="input text-base" placeholder="Nom" autoComplete="family-name" value={last} onChange={(e) => pickName(first, e.target.value)} aria-label="Nom" required />
                  </div>
                  <UsernameField value={username} onChange={(v) => (setUsername(v), setUsernameTouched(true))} first={first} last={last} />
                </div>
              )}
              <label className="relative">
                <Mail size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[var(--color-ink-soft)]" />
                <input
                  className="input !pl-11 text-base"
                  type={mode === 'login' ? 'text' : 'email'}
                  placeholder={mode === 'login' ? 'E-mail ou pseudo' : 'E-mail'}
                  autoComplete={mode === 'login' ? 'username' : 'email'}
                  autoCapitalize="none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-label={mode === 'login' ? 'E-mail ou pseudo' : 'E-mail'}
                  required
                />
              </label>
              <label className="relative">
                <Lock size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[var(--color-ink-soft)]" />
                <input
                  className="input !pr-12 !pl-11 text-base"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'register' ? 'Mot de passe (8 caractères min.)' : 'Mot de passe'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  minLength={mode === 'register' ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-label="Mot de passe"
                  required
                />
                <button type="button" className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-[var(--color-ink-soft)]" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Cacher le mot de passe' : 'Afficher le mot de passe'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </label>
              {error && <p className="animate-pop rounded-xl bg-[#ffeef1] px-3 py-2 text-sm font-bold text-[#d81b3f]">{error}</p>}
              <button className="btn w-full" disabled={busy}>
                {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
              </button>
            </form>

            <p className="text-center text-sm font-bold text-[var(--color-ink-soft)]">
              {mode === 'login' ? 'Pas encore de compte ? ' : 'Déjà un compte ? '}
              <button className="font-extrabold text-[var(--color-orange)] hover:underline" onClick={() => (setMode(mode === 'login' ? 'register' : 'login'), setError(null))}>
                {mode === 'login' ? 'Inscris-toi' : 'Connecte-toi'}
              </button>
            </p>

            {world?.config.devLogin && (
              <details className="rounded-2xl bg-[var(--color-canvas)] px-3 py-2 text-sm">
                <summary className="cursor-pointer font-extrabold text-[var(--color-ink-soft)]">Mode test (local)</summary>
                <div className="mt-2 flex gap-2">
                  <input className="input h-[44px] min-w-0 flex-1 text-base" value={devName} onChange={(e) => setDevName(e.target.value)} aria-label="Nom du joueur test" />
                  <button className="btn btn-emerald shrink-0 px-4" disabled={busy || !devName.trim()} onClick={() => finish(api.devLogin(devName))}>
                    Jouer
                  </button>
                </div>
              </details>
            )}
          </div>

          {worldError && <p className="mt-3 rounded-xl bg-[#ffeef1] px-3 py-2 text-sm font-bold text-[#d81b3f]">Serveur injoignable : {worldError}</p>}

          <ul className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] leading-tight font-extrabold text-[var(--color-ink-soft)]">
            <li className="flex flex-col items-center gap-1">
              <Gamepad2 size={18} className="text-[var(--color-orange)]" />
              Gratuit
            </li>
            <li className="flex flex-col items-center gap-1">
              <Smartphone size={18} className="text-[var(--color-orange)]" />
              Mobile & PC
            </li>
            <li className="flex flex-col items-center gap-1">
              <Sparkles size={18} className="text-[var(--color-orange)]" />
              100 % ivoirien
            </li>
          </ul>
        </section>
      </main>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
