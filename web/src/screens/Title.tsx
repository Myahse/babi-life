import { useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { useNavigate } from 'react-router-dom'
import { InstallButton } from '../components/InstallButton'
import { useOnline } from '../lib/pwa'
import { ArrowRight, Clock3, Eye, EyeOff, Lock, Mail, MapPinned, Newspaper, Shirt, UserRound, type LucideIcon } from 'lucide-react'
import { api } from '../lib/api'
import type { Look, User } from '../lib/types'
import { useSession } from '../store/session'
import { useWorld } from '../store/world'
import { Scene } from '../components/Scene'
import { Portrait } from '../avatar/portrait'
import { IconTile, Logo, LogoMark } from '../components/ui'
import { UsernameField } from '../components/UsernameField'
import { suggestFrom } from '../lib/username'

const GOOGLE_ENABLED = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)

const CROWD: { look: Look; gender: 'femme' | 'homme'; size: number }[] = [
  { gender: 'homme', size: 112, look: { skin: '#6e4024', hair: 'short', hairColor: '#141010', outfit: 'debardeur', outfitColor: '#f8f9fa', accessory: 'capback', accessoryColor: '#ff7a00', marks: 'pansement' } },
  { gender: 'femme', size: 128, look: { skin: '#8a5532', hair: 'headwrap', hairColor: '#141010', outfit: 'pagne', outfitColor: '#ff7a00', accessory: 'earrings', pattern: 'cercles' } },
  { gender: 'homme', size: 118, look: { skin: '#a46c42', hair: 'locks', hairColor: '#2e1b12', outfit: 'boubou', outfitColor: '#00a862', accessory: 'chain' } },
  { gender: 'femme', size: 110, look: { skin: '#583119', hair: 'braids', hairColor: '#141010', outfit: 'survet', outfitColor: '#7b5cff', accessory: 'none' } },
]

const FEATURES: { icon: LucideIcon; colors: [string, string]; title: string; text: string }[] = [
  { icon: Clock3, colors: ['#ffa040', '#ff7a00'], title: "À l'heure d'Abidjan", text: 'Le jour, la nuit, le samedi du loyer : ton Sim vit en temps réel, même quand tu fermes l’app.' },
  { icon: MapPinned, colors: ['#69e2a0', '#00a862'], title: 'Tout le pays', text: 'Plateau, Yopougon, Cocody, Bouaké, Grand-Bassam… Prends un taxi ou le car pour bouger.' },
  { icon: Shirt, colors: ['#b39dff', '#7b5cff'], title: 'Ton style', text: 'Pagne wax, boubou, survêt, débardeur, coiffures, couleurs libres et même les bobos.' },
  { icon: Newspaper, colors: ['#64b5ff', '#2a6cf0'], title: 'La vraie actu', text: 'Les infos du pays arrivent sur le téléphone de ton Sim, et la rue a sa vie : mariages, matchs, maquis.' },
]

export function Title() {
  const signIn = useSession((s) => s.signIn)
  const world = useWorld((s) => s.world)
  const worldError = useWorld((s) => s.error)
  const navigate = useNavigate()
  const online = useOnline()
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
      navigate('/jeu', { viewTransition: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible')
    } finally {
      setBusy(false)
    }
  }

  // Hero buttons open the card in the right mode and bring it into view.
  function openCard(m: 'login' | 'register') {
    setMode(m)
    setError(null)
    document.getElementById('compte')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => document.querySelector<HTMLInputElement>('#compte input')?.focus({ preventScroll: true }), 450)
  }

  return (
    <div className="relative min-h-full overflow-x-hidden bg-[var(--color-night)] text-white">
      {/* Key art stays behind while the page scrolls */}
      <div className="pointer-events-none fixed inset-0">
        <Scene className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f1230]/55 via-[#0f1230]/20 to-[#0f1230]/90" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-2 lg:px-8 lg:pt-6">
        <Logo size={36} />
        <button className="rounded-xl px-3 py-2 text-sm font-extrabold text-white/90 transition hover:bg-white/10" onClick={() => openCard('login')}>
          Se connecter
        </button>
      </header>

      <main className="relative z-10 mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-5 pb-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-12 lg:px-8 lg:pt-10">
        {/* ---------- Hero ---------- */}
        <section className="motion-stagger flex flex-col items-center text-center lg:items-start lg:text-left">
          <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-extrabold backdrop-blur lg:mt-0">
            <span className="flex overflow-hidden rounded-[3px]" aria-hidden>
              <i className="block h-3 w-1.5 bg-[#ff8200]" />
              <i className="block h-3 w-1.5 bg-white" />
              <i className="block h-3 w-1.5 bg-[#009a44]" />
            </span>
            Gratuit · 100 % ivoirien
          </span>
          <h1 className="mt-4 font-display text-[44px] leading-[0.95] font-extrabold tracking-[-0.02em] sm:text-6xl lg:text-7xl">
            Ta vie.
            <br />
            Ton quartier.
            <br />
            <span className="text-[var(--color-orange)]">Ton Babi.</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed font-semibold text-white/85 lg:text-lg">
            Crée ton Sim, choisis ton quartier et vis la Côte d'Ivoire à l'heure d'Abidjan : boulot, maquis, taxi, mariages dans la rue et vraie actu.
          </p>
          <div className="mt-6 flex w-full max-w-sm flex-col gap-2.5 sm:flex-row lg:max-w-none">
            <button className="btn sm:flex-1 lg:flex-none lg:px-7" onClick={() => openCard('register')}>
              Créer mon Sim <ArrowRight size={18} strokeWidth={2.6} />
            </button>
            <button className="btn btn-white !border-white/25 !bg-white/10 !text-white backdrop-blur hover:!bg-white/20 sm:flex-1 lg:flex-none lg:px-7" onClick={() => openCard('login')}>
              J'ai déjà un compte
            </button>
          </div>

          {/* The cast */}
          <div className="mt-6 flex items-end justify-center lg:justify-start" aria-hidden>
            {CROWD.map((c, i) => (
              <span key={i} className="-mx-2 block" style={{ width: `min(${c.size}px, ${Math.round(c.size / 4.9)}vw)`, aspectRatio: '1 / 1.35' }}>
                <Portrait look={c.look} gender={c.gender} framing="full" />
              </span>
            ))}
          </div>
        </section>

        {/* ---------- Account card ---------- */}
        <section id="compte" className="card scroll-mt-6 w-full self-start p-5 text-[var(--color-ink)] lg:p-6">
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

          <InstallButton className="mt-3" />
          {worldError && online && <p className="mt-3 rounded-xl bg-[#ffeef1] px-3 py-2 text-sm font-bold text-[#d81b3f]">Serveur injoignable : {worldError}</p>}
        </section>
      </main>

      {/* ---------- What you'll live ---------- */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-[max(2rem,env(safe-area-inset-bottom))] lg:px-8 lg:pb-14">
        <h2 className="mb-4 text-center font-display text-2xl font-extrabold lg:text-left">Ce qui t'attend</h2>
        <ul className="motion-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-2xl border border-white/12 bg-white/[0.07] p-4 backdrop-blur">
              <IconTile icon={f.icon} colors={f.colors} size={40} />
              <h3 className="mt-3 font-display text-lg leading-tight font-extrabold">{f.title}</h3>
              <p className="mt-1 text-sm leading-snug font-semibold text-white/75">{f.text}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 flex items-center justify-center gap-2 text-xs font-bold text-white/55">
          <LogoMark size={18} /> Babi Life · fait à Abidjan
        </p>
      </section>
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
