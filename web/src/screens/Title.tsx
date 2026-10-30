import { useEffect, useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { inApp, nativeGoogleSignIn } from '../lib/native'
import { Link, useNavigate } from 'react-router-dom'
import { InstallButton } from '../components/InstallButton'
import { useOnline } from '../lib/pwa'
import { Clock3, Eye, EyeOff, Lock, Mail, MapPinned, Newspaper, Shirt, UserRound, type LucideIcon } from 'lucide-react'
import { api, ApiError, errorText } from '../lib/api'
import type { Look, User } from '../lib/types'
import { useSession } from '../store/session'
import { useWorld } from '../store/world'
import { Portrait } from '../avatar/portrait'
import { IconTile } from '../components/ui'
import { UsernameField } from '../components/UsernameField'
import { suggestFrom } from '../lib/username'
import { useGameOpen } from '../lib/launch'
import { contactLinks } from '../lib/contact'
import { parrainDone } from '../lib/parrain'
import { firebaseConfigured, firebaseFromGoogle, googleBlocked, googleCancelled, googleRedirectResult, preloadGoogle, signInWithGoogle } from '../lib/google'
import { lang, setLang, t } from '../lib/i18n'
import { useLangChoice } from '../lib/features'
import { AccountGone } from '../components/AccountGone'

const GOOGLE_ENABLED = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)

export const CROWD: { look: Look; gender: 'femme' | 'homme'; size: number }[] = [
  { gender: 'homme', size: 112, look: { skin: '#6e4024', hair: 'short', hairColor: '#141010', outfit: 'debardeur', outfitColor: '#f8f9fa', accessory: 'capback', accessoryColor: '#ff7a00', marks: 'pansement' } },
  { gender: 'femme', size: 128, look: { skin: '#8a5532', hair: 'headwrap', hairColor: '#141010', outfit: 'pagne', outfitColor: '#ff7a00', accessory: 'earrings', pattern: 'cercles' } },
  { gender: 'homme', size: 118, look: { skin: '#a46c42', hair: 'locks', hairColor: '#2e1b12', outfit: 'boubou', outfitColor: '#00a862', accessory: 'chain' } },
  { gender: 'femme', size: 110, look: { skin: '#583119', hair: 'braids', hairColor: '#141010', outfit: 'survet', outfitColor: '#7b5cff', accessory: 'none' } },
]

const FEATURES: { icon: LucideIcon; colors: [string, string]; title: string; text: string }[] = [
  { icon: Clock3, colors: ['#ffa040', '#ff7a00'], title: t("À l'heure d'Abidjan"), text: t('Le jour, la nuit, le samedi du loyer : ton perso vit en temps réel, même quand tu fermes l’app.') },
  { icon: MapPinned, colors: ['#69e2a0', '#00a862'], title: t('Tout le pays'), text: t('Plateau, Yopougon, Cocody, Bouaké, Grand-Bassam… Prends un taxi ou le car pour bouger.') },
  { icon: Shirt, colors: ['#b39dff', '#7b5cff'], title: t('Ton style'), text: t('Pagne wax, boubou, survêt, débardeur, coiffures, couleurs libres et même les bobos.') },
  { icon: Newspaper, colors: ['#64b5ff', '#2a6cf0'], title: t('La vraie actu'), text: t('Les infos du pays arrivent sur le téléphone de ton perso, et la rue a sa vie : mariages, matchs, maquis.') },
]

// A phone's screen (either way up) or the app: the sign-in alone, made to fit without scrolling.
const PHONE = '(max-width: 640px), (max-height: 520px)'
const phoneScreen = () => typeof matchMedia !== 'undefined' && matchMedia(PHONE).matches

function useCompact() {
  const [on, setOn] = useState(() => inApp() || phoneScreen())
  useEffect(() => {
    if (inApp() || typeof matchMedia === 'undefined') return
    const mq = matchMedia(PHONE)
    const changed = () => setOn(mq.matches)
    mq.addEventListener('change', changed)
    return () => mq.removeEventListener('change', changed)
  }, [])
  return on
}

export function Title() {
  const compact = useCompact()
  const open = useGameOpen()
  const langChoice = useLangChoice()
  const signIn = useSession((s) => s.signIn)
  const world = useWorld((s) => s.world)
  const worldError = useWorld((s) => s.error)
  const navigate = useNavigate()
  const online = useOnline()
  const [devName, setDevName] = useState(t('Awa Koné'))
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  // « Mot de passe oublié » sent: what the server said.
  const [sent, setSent] = useState<string | null>(null)
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

  // Firebase ready before the tap (Safari opens Google's window only straight from it); back from Google, the account.
  useEffect(() => {
    if (!firebaseConfigured || inApp()) return
    preloadGoogle()
    googleRedirectResult().then(
      (account) => account && void finish(api.googleLogin(account.token)),
      () => setError(t('Connexion Google impossible')),
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function google() {
    setError(null)
    try {
      const account = await signInWithGoogle()
      await finish(api.googleLogin(account.token))
    } catch (err) {
      if (googleCancelled(err)) setError(t('Connexion Google annulée'))
      else if (googleBlocked(err)) setError(t('Le navigateur a bloqué la fenêtre Google : touche encore le bouton'))
      else setError(t('Connexion Google impossible'))
    }
  }

  // In the app, Google's sign-in is the phone's own (it won't open in a web view).
  async function appGoogle() {
    setError(null)
    let token: string | null
    try {
      token = await nativeGoogleSignIn()
    } catch (e) {
      setError((e as Error).message || t('Connexion Google impossible'))
      return
    }
    if (!token) return
    const signedIn = (async () => {
      try {
        return await api.googleLogin(firebaseConfigured ? await firebaseFromGoogle(token) : token)
      } catch (e) {
        console.warn('[google sign-in] refused by the server:', (e as Error)?.message)
        if (e instanceof ApiError && e.status === 401) throw new ApiError(401, t('Le serveur a refusé ce compte Google : réessaie, ou connecte-toi avec ton e-mail.'))
        throw e
      }
    })()
    await finish(signedIn)
  }

  function submit(e: { preventDefault: () => void }) {
    e.preventDefault()
    if (mode === 'forgot') {
      setBusy(true)
      setError(null)
      api
        .forgotPassword(email)
        .then((r) => setSent(r.text), (err) => setError(errorText(err, t('Réessaie dans un instant'))))
        .finally(() => setBusy(false))
      return
    }
    finish(mode === 'login' ? api.login(email, password) : api.register({ firstName: first, lastName: last, username, email, password }))
  }

  const googleLabel = mode !== 'register' ? t('Continuer avec Google') : t("S'inscrire avec Google")
  const googleButton = (cls: string) =>
    (GOOGLE_ENABLED || firebaseConfigured) && inApp() ? (
      <button type="button" className={`btn btn-white w-full ${cls}`} disabled={busy} onClick={() => void appGoogle()}>
        <GoogleIcon /> {googleLabel}
      </button>
    ) : firebaseConfigured ? (
      <button type="button" className={`btn btn-white w-full ${cls}`} disabled={busy} onClick={() => void google()}>
        <GoogleIcon /> {googleLabel}
      </button>
    ) : GOOGLE_ENABLED ? (
      <div className="flex h-[50px] justify-center [&>div]:w-full">
        <GoogleLogin
          onSuccess={(r) => r.credential && finish(api.googleLogin(r.credential))}
          onError={() => setError(t('Connexion Google annulée'))}
          shape="pill"
          size="large"
          text={mode !== 'register' ? 'continue_with' : 'signup_with'}
          width="360"
        />
      </div>
    ) : (
      <button className={`btn btn-white w-full ${cls}`} disabled title={t('Ajoute VITE_GOOGLE_CLIENT_ID pour activer')}>
        <GoogleIcon /> {googleLabel}
      </button>
    )

  async function finish(p: Promise<{ token: string; user: User }>) {
    setBusy(true)
    setError(null)
    try {
      const { token, user } = await p
      signIn(token, user)
      parrainDone()
      navigate(open ? '/jeu' : '/liste', { viewTransition: true })
    } catch (e) {
      setError(errorText(e, t('Connexion impossible')))
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

  const switchMode = (m: 'login' | 'register' | 'forgot') => (setMode(m), setError(null), setSent(null))
  const legal = (
    <p className="flex flex-wrap items-baseline justify-center gap-x-2.5 text-[10px] leading-tight font-bold opacity-70">
      <span>{t('© {year} Babi Life · Tous droits réservés', { year: new Date().getFullYear() })}</span>
      <Link to="/conditions" className="underline">
        {t('Conditions')}
      </Link>
      <Link to="/confidentialite" className="underline">
        {t('Confidentialité')}
      </Link>
      <Link to="/suppression-compte" className="underline">
        {t('Supprimer son compte')}
      </Link>
      {langChoice && (
        <button className="underline" onClick={() => setLang(lang() === 'en' ? 'fr' : 'en')}>
          {lang() === 'en' ? 'Français' : 'English'}
        </button>
      )}
      <span>
        {t('Version')} {String(import.meta.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7)}
      </span>
    </p>
  )

  // On a phone and in the app: one screen, no scrolling. Google first, then the e-mail and its
  // password, « Se connecter » / « Créer un compte » as a toggle; side by side when the phone lies down.
  if (compact)
    return (
      <div className="street worn flex min-h-dvh flex-col pt-[env(safe-area-inset-top)] pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        <div className="ci-stripe !h-1" aria-hidden />
        <AccountGone />
        <main className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col justify-center gap-3 px-4 py-2 landscape:flex-row landscape:items-center landscape:gap-6">
          <section className="flex flex-col gap-2.5 landscape:w-[42%]">
            <div className="flex items-baseline justify-between gap-3 landscape:flex-col landscape:items-start landscape:gap-0.5">
              <span className="paint flex items-center gap-2 text-[26px] short:text-[22px]" aria-label={t('Babi Life')}>
                <svg width="15" height="21" viewBox="0 0 40 56" aria-hidden>
                  <path d="M20 54C14 45 4 36 4 20a16 16 0 0 1 32 0c0 16-10 25-16 34Z" fill="#b5432c" />
                  <circle cx="20" cy="20" r="7" fill="#fbf5e6" />
                </svg>
                {t('Babi')} <span className="text-[var(--turq)]">{t('Life')}</span>
              </span>
              <span className="chalk-hand text-[20px] leading-none text-[var(--ci-green)]">{t('Le sort décide.')}</span>
            </div>
            {googleButton('!min-h-[46px] short:!min-h-[42px] !text-[16px]')}
            {error && (
              <p className="bg-[#f6d9cf] px-2.5 py-1.5 text-[13px] leading-snug font-bold text-[var(--rust)]" role="alert">
                {error}
              </p>
            )}
            {worldError && online && <p className="bg-[#f6d9cf] px-2.5 py-1 text-[12px] font-bold text-[var(--rust)]">{t('Serveur injoignable :')} {worldError}</p>}
            {world?.config.devLogin && (
              <details className="bg-[var(--wall)] px-2 py-1 text-[13px]">
                <summary className="cursor-pointer font-extrabold">{t('Mode test (local)')}</summary>
                <div className="mt-1.5 flex gap-2">
                  <input className="input !h-9 min-w-0 flex-1 text-base" value={devName} onChange={(e) => setDevName(e.target.value)} aria-label={t('Nom du joueur test')} />
                  <button className="btn btn-emerald !min-h-9 shrink-0 px-4" disabled={busy || !devName.trim()} onClick={() => finish(api.devLogin(devName))}>
                    {t('Jouer')}
                  </button>
                </div>
              </details>
            )}
            <div className="portrait:hidden">{legal}</div>
          </section>

          <section className="flex flex-col gap-2 landscape:flex-1">
            <div className="flex items-center gap-3 text-[11px] font-extrabold landscape:hidden">
              <span className="h-px flex-1 bg-[var(--brown)]/25" />
              {t('ou avec ton e-mail')}
              <span className="h-px flex-1 bg-[var(--brown)]/25" />
            </div>
            <div className="segmented !p-[3px]" role="tablist">
              {(['login', 'register'] as const).map((m) => (
                <button key={m} type="button" role="tab" className="!py-1.5 !text-[14px]" aria-selected={mode === m || (m === 'login' && mode === 'forgot')} onClick={() => switchMode(m)}>
                  {m === 'login' ? t('Se connecter') : t('Créer un compte')}
                </button>
              ))}
            </div>
            <form className="flex flex-col gap-1.5" onSubmit={submit}>
              {mode === 'register' && (
                <>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input className="input !h-10 text-base" placeholder={t('Prénom')} autoComplete="given-name" value={first} onChange={(e) => pickName(e.target.value, last)} aria-label={t('Prénom')} required />
                    <input className="input !h-10 text-base" placeholder={t('Nom')} autoComplete="family-name" value={last} onChange={(e) => pickName(first, e.target.value)} aria-label={t('Nom')} required />
                  </div>
                  <UsernameField compact value={username} onChange={(v) => (setUsername(v), setUsernameTouched(true))} first={first} last={last} />
                </>
              )}
              <div className={`grid gap-1.5 ${mode === 'register' ? 'landscape:grid-cols-2' : ''}`}>
                <label className="relative">
                  <Mail size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-ink-soft)]" />
                  <input
                    className="input !h-10 !pl-9 text-base"
                    type={mode !== 'register' ? 'text' : 'email'}
                    placeholder={mode !== 'register' ? t('E-mail ou pseudo') : t('E-mail')}
                    autoComplete={mode !== 'register' ? 'username' : 'email'}
                    autoCapitalize="none"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-label={mode !== 'register' ? t('E-mail ou pseudo') : t('E-mail')}
                    required
                  />
                </label>
                {mode !== 'forgot' && (
                  <label className="relative">
                    <Lock size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-ink-soft)]" />
                    <input
                      className="input !h-10 !pr-10 !pl-9 text-base"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={mode === 'register' ? t('Mot de passe (8 min.)') : t('Mot de passe')}
                      autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                      minLength={mode === 'register' ? 8 : undefined}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-label={t('Mot de passe')}
                      required
                    />
                    <button type="button" className="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-[var(--color-ink-soft)]" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? t('Cacher le mot de passe') : t('Afficher le mot de passe')}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </label>
                )}
              </div>
              {mode === 'forgot' && <p className="text-[12px] leading-snug font-bold">{sent ?? t('On t’envoie par e-mail comment te connecter, et un lien pour choisir un mot de passe.')}</p>}
              <button className="sign-btn mt-0.5 w-full !py-2.5 !text-[16px]" disabled={busy}>
                {busy ? t('Un instant…') : mode === 'login' ? t('Se connecter') : mode === 'forgot' ? t('Recevoir mes identifiants') : t('Créer mon compte')}
              </button>
              {mode === 'login' && (
                <button type="button" className="self-center text-[13px] font-extrabold text-[var(--rust)] underline underline-offset-4" onClick={() => switchMode('forgot')}>
                  {t('Mot de passe oublié ?')}
                </button>
              )}
              {mode === 'forgot' && (
                <button type="button" className="self-center text-[13px] font-extrabold text-[var(--rust)] underline underline-offset-4" onClick={() => switchMode('login')}>
                  {t('Retour à la connexion')}
                </button>
              )}
            </form>
          </section>
        </main>
        <div className="px-4 landscape:hidden">{legal}</div>
      </div>
    )

  return (
    <div className="street worn min-h-full overflow-x-clip">
      {/* The name over the door, as on the wish list (Waitlist.tsx), and the flag's stripe */}
      <header className="bg-[var(--turq)] text-[var(--cream)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <span className="paint flex items-center gap-2.5 text-[26px]" aria-label={t('Babi Life')}>
            <svg width="20" height="28" viewBox="0 0 40 56" aria-hidden>
              <path d="M20 54C14 45 4 36 4 20a16 16 0 0 1 32 0c0 16-10 25-16 34Z" fill="#fbf5e6" />
              <circle cx="20" cy="20" r="7" fill="#0b6b3d" />
            </svg>
            {t('Babi')} <span className="text-[var(--ochre)]">{t('Life')}</span>
          </span>
          <button className="text-[14px] font-extrabold underline-offset-4 hover:underline" onClick={() => openCard('login')}>
            {t('Se connecter')}
          </button>
        </div>
      </header>
      <div className="ci-stripe" aria-hidden />
      <AccountGone />

      <main className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-4 pt-8 pb-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start lg:gap-12 lg:pt-14">
        {/* ---------- Painted straight on the wall ---------- */}
        <section>
          <h1 className="paint m-0 text-[clamp(56px,13vw,112px)] text-[var(--rust)] [text-shadow:3px_3px_0_var(--ochre)]">
            {t('Gnambro')}
            <br />
            {t('ou laté ?')}
            <br />
            <span className="text-[var(--turq)] [text-shadow:3px_3px_0_var(--mint)]">{t('Le sort décide.')}</span>
          </h1>
          <p className="mt-5 max-w-md text-[19px] font-extrabold">{t("Ta famille est tirée au sort à ta naissance. Ensuite, vis la Côte d'Ivoire sur la vraie carte, à l'heure d'Abidjan : boulot, maquis, taxi, mariages dans la rue et vraie actu.")}</p>
          <p className="chalk-hand mt-1 text-[30px] text-[var(--ci-green)]">{t('Fait ici, pour nous.')}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="sign-btn" onClick={() => openCard('register')}>
              {t('Créer mon perso')}
            </button>
            <button className="sign-btn alt" onClick={() => openCard('login')}>
              {t("J'ai déjà un compte")}
            </button>
          </div>

          {/* The cast */}
          <div className="mt-6 flex items-end" aria-hidden>
            {CROWD.map((c, i) => (
              <span key={i} className="-mx-2 block" style={{ width: `min(${c.size}px, ${Math.round(c.size / 4.9)}vw)`, aspectRatio: '1 / 1.35' }}>
                <Portrait look={c.look} gender={c.gender} framing="full" />
              </span>
            ))}
          </div>
        </section>

        {/* ---------- Account card, a sign on the wall ---------- */}
        <section id="compte" className="w-full scroll-mt-6 border-2 border-[var(--brown)] bg-[var(--cream)] p-5 sm:p-6">
          <h2 className="paint mb-3 text-[40px]">{mode === 'login' ? t('Je me connecte') : mode === 'forgot' ? t('Identifiants oubliés') : t('Je crée mon compte')}</h2>
          {/* Se connecter / Créer un compte */}
          <div className="segmented mb-4" role="tablist">
            {(['login', 'register'] as const).map((m) => (
              <button key={m} role="tab" aria-selected={mode === m || (m === 'login' && mode === 'forgot')} onClick={() => (setMode(m), setError(null))}>
                {m === 'login' ? t('Se connecter') : t('Créer un compte')}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {googleButton('')}

            <div className="flex items-center gap-3 text-xs font-extrabold">
              <span className="h-px flex-1 bg-[var(--brown)]/25" />
              {t('ou avec ton e-mail')}
              <span className="h-px flex-1 bg-[var(--brown)]/25" />
            </div>

            <form
              className="flex flex-col gap-2.5"
              onSubmit={submit}
            >
              {mode === 'register' && (
                <div className="motion-stagger flex flex-col gap-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="relative">
                      <UserRound size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[var(--color-ink-soft)]" />
                      <input className="input !pl-11 text-base" placeholder={t('Prénom')} autoComplete="given-name" value={first} onChange={(e) => pickName(e.target.value, last)} aria-label={t('Prénom')} required />
                    </label>
                    <input className="input text-base" placeholder={t('Nom')} autoComplete="family-name" value={last} onChange={(e) => pickName(first, e.target.value)} aria-label={t('Nom')} required />
                  </div>
                  <UsernameField value={username} onChange={(v) => (setUsername(v), setUsernameTouched(true))} first={first} last={last} />
                </div>
              )}
              <label className="relative">
                <Mail size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[var(--color-ink-soft)]" />
                <input
                  className="input !pl-11 text-base"
                  type={mode !== 'register' ? 'text' : 'email'}
                  placeholder={mode !== 'register' ? t('E-mail ou pseudo') : t('E-mail')}
                  autoComplete={mode !== 'register' ? 'username' : 'email'}
                  autoCapitalize="none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-label={mode !== 'register' ? t('E-mail ou pseudo') : t('E-mail')}
                  required
                />
              </label>
              {mode === 'forgot' && <p className="text-sm font-bold">{sent ?? t('Ton e-mail (ou ton pseudo) : on t’envoie comment tu te connectes (Google ou mot de passe) et un lien pour choisir un mot de passe.')}</p>}
              {mode === 'forgot' && <LostAccount />}
              {mode !== 'forgot' && (
                <label className="relative">
                  <Lock size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[var(--color-ink-soft)]" />
                  <input
                    className="input !pr-12 !pl-11 text-base"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={mode === 'register' ? t('Mot de passe (8 caractères min.)') : t('Mot de passe')}
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    minLength={mode === 'register' ? 8 : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-label={t('Mot de passe')}
                    required
                  />
                  <button type="button" className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-[var(--color-ink-soft)]" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? t('Cacher le mot de passe') : t('Afficher le mot de passe')}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </label>
              )}
              {mode === 'login' && (
                <button type="button" className="self-end text-sm font-extrabold text-[var(--rust)] underline-offset-4 hover:underline" onClick={() => (setMode('forgot'), setError(null), setSent(null))}>
                  {t('Identifiants oubliés ?')}
                </button>
              )}
              {error && <p className="bg-[#f6d9cf] px-3 py-2 text-sm font-bold text-[var(--rust)]" role="alert">{error}</p>}
              <button className="sign-btn mt-1 w-full" disabled={busy}>
                {busy ? t('Un instant…') : mode === 'login' ? t('Se connecter') : mode === 'forgot' ? t('Recevoir mes identifiants') : t('Créer mon compte')}
              </button>
            </form>

            <p className="text-center text-sm font-bold">
              {mode === 'login' ? t('Pas encore de compte ? ') : mode === 'forgot' ? t('Ça te revient ? ') : t('Déjà un compte ? ')}
              <button className="font-extrabold text-[var(--rust)] underline-offset-4 hover:underline" onClick={() => (setMode(mode === 'login' ? 'register' : 'login'), setError(null))}>
                {mode === 'login' ? 'Inscris-toi' : 'Connecte-toi'}
              </button>
            </p>

            {world?.config.devLogin && (
              <details className="bg-[var(--wall)] px-3 py-2 text-sm">
                <summary className="cursor-pointer font-extrabold">{t('Mode test (local)')}</summary>
                <div className="mt-2 flex gap-2">
                  <input className="input h-[44px] min-w-0 flex-1 text-base" value={devName} onChange={(e) => setDevName(e.target.value)} aria-label={t('Nom du joueur test')} />
                  <button className="btn btn-emerald shrink-0 px-4" disabled={busy || !devName.trim()} onClick={() => finish(api.devLogin(devName))}>
                    {t('Jouer')}
                  </button>
                </div>
              </details>
            )}
          </div>

          <InstallButton sign className="mt-3" />
          {worldError && online && <p className="mt-3 bg-[#f6d9cf] px-3 py-2 text-sm font-bold text-[var(--rust)]">{t('Serveur injoignable :')} {worldError}</p>}
          <p className="mt-3 text-center text-[11px] font-bold opacity-50">{t('Version')} {String(import.meta.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7)}</p>
        </section>
      </main>

      {/* ---------- What you'll live ---------- */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <h2 className="paint mb-4 text-[44px] text-[var(--turq)]">{t("Ce qui t'attend")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <li key={f.title} className="border-2 border-[var(--brown)] bg-[var(--cream)] p-4">
              <IconTile icon={f.icon} colors={f.colors} size={40} radius={4} />
              <h3 className="slab mt-3 text-lg leading-tight">{f.title}</h3>
              <p className="mt-1 text-sm leading-snug font-bold">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="ci-stripe" aria-hidden />
      <footer className="bg-[var(--brown)] text-[var(--cream)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-x-4 gap-y-2 px-4 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[14px] font-extrabold">
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span>{t('© {year} Babi Life · Tous droits réservés', { year: new Date().getFullYear() })}</span>
            <Link to="/conditions" className="underline">
              {t('Conditions')}
            </Link>
            <Link to="/confidentialite" className="underline">
              {t('Confidentialité')}
            </Link>
            <Link to="/suppression-compte" className="underline">
              {t('Supprimer son compte')}
            </Link>
            {/* The other language, before even signing in (in the game: « Réglages »). */}
            {langChoice && (
              <button className="underline" onClick={() => setLang(lang() === 'en' ? 'fr' : 'en')}>
                {lang() === 'en' ? 'Français' : 'English'}
              </button>
            )}
          </span>
          <span className="chalk-hand text-[26px] text-[var(--ochre)]">{t('Fait à Abidjan')}</span>
        </div>
      </footer>
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

/**
 * Neither the e-mail nor the pseudo comes back: the team finds the account from
 * the perso's name (/admin, Joueurs, « Envoyer ses identifiants »).
 */
function LostAccount() {
  const links = contactLinks(t('Je ne retrouve plus mon compte Babi Life'), t("Bonjour, je ne retrouve plus mon compte Babi Life. Mon perso s'appelle : "))
  return (
    <p className="text-xs font-bold text-[var(--color-ink-soft)]">
      {t('Rien ne te revient, ni l’e-mail ni le pseudo ? Écris à l’équipe avec le nom de ton perso : on retrouve ton compte et on t’envoie tes identifiants.')}
      {links.map((l) => (
        <a key={l.id} href={l.href} target="_blank" rel="noreferrer" className="ml-1.5 font-extrabold text-[var(--rust)] underline">
          {l.label}
        </a>
      ))}
    </p>
  )
}
