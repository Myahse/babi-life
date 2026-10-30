import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, MapPinned, Smartphone, UserRound } from 'lucide-react'
import { useWorld } from '../store/world'
import { Community, Share } from '../components/WaitlistShare'
import { Consent } from '../components/Consent'
import { InstallButton } from '../components/InstallButton'
import { homeScreenApp, useGameOpen } from '../lib/launch'
import { useFeatures } from '../lib/features'
import { Discover, Trailer } from '../components/Discover'
import { firebaseConfigured, googleBlocked, googleCancelled, googleRedirectResult, preloadGoogle, signInWithGoogle } from '../lib/google'
import { lang, setLang, t as tr, tx } from '../lib/i18n'

// The wish list: before the game opens, people leave a first name and an
// e-mail or a WhatsApp number to hear when it does. /liste is the landing
// (what the game is, Awa's tour, the clips); the form is on its own page,
// /liste/inscription, opened from the buttons. Both are painted like the
// signs of Abidjan's streets (index.css, .street). The flyer's QR
// code and the video lead here (?src=flyer, ?src=video say which).

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

/** The communes offered while the world data isn't there (it lists them all). */
const ABIDJAN = [tr('Abobo'), tr('Adjamé'), tr('Attécoubé'), tr('Cocody'), tr('Koumassi'), tr('Marcory'), 'Plateau', tr('Port-Bouët'), tr('Treichville'), tr('Yopougon'), tr('Bingerville'), tr('Songon'), tr('Anyama')]

type Done = { name: string; count: number; already: boolean }

export function Waitlist({ form = false }: { form?: boolean }) {
  const navigate = useNavigate()
  // The page's name in the tab and in search results.
  useEffect(() => void (document.title = tr('Babi Life · Joue à la vie à Abidjan, gratuit')), [])
  const world = useWorld((s) => s.world)
  const communes = world ? [...new Set(world.cities.flatMap((c) => c.communes.map((x) => x.name)))].sort((a, b) => a.localeCompare(b, 'fr')) : ABIDJAN
  const source = new URLSearchParams(location.search).get('src') ?? ''
  const [first, setFirst] = useState('')
  const [contact, setContact] = useState('')
  const [commune, setCommune] = useState('')
  const [beta, setBeta] = useState(true)
  const [website, setWebsite] = useState('') // unseen: only bots fill it
  const [terms, setTerms] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    fetch(`${BASE}/waitlist/count`)
      .then((r) => r.json())
      .then((d: { count: number }) => setCount(d.count))
      .catch(() => undefined)
  }, [])

  async function send(body: { firstName: string; contact: string; idToken?: string }) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${BASE}/waitlist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, commune, beta, source, website, terms, privacy }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? tr('Inscription impossible pour le moment'))
      setDone({ name: body.firstName.trim(), count: data.count ?? 0, already: !!data.already })
    } catch (err) {
      setError(err instanceof Error && err.message !== 'Failed to fetch' ? err.message : tr('Pas de réseau : réessaie dans un instant.'))
    } finally {
      setBusy(false)
    }
  }

  function join(e: React.FormEvent) {
    e.preventDefault()
    if (!terms || !privacy) {
      setError(tr('Coche les conditions et la confidentialité.'))
      return
    }
    void send({ firstName: first, contact })
  }

  // Firebase ready before the tap (Safari opens Google's window only straight from it); back from Google (the
  // home-screen app's way, the boxes were ticked before going), the sign-up sent.
  useEffect(() => {
    if (!firebaseConfigured) return
    preloadGoogle()
    googleRedirectResult().then(
      (account) => account && (setFirst(account.firstName), setContact(account.email), void send({ firstName: account.firstName, contact: account.email, idToken: account.token })),
      () => setError(tr('Connexion Google impossible')),
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function google() {
    setError(null)
    if (!terms || !privacy) {
      setError(tr('Coche les conditions et la confidentialité.'))
      return
    }
    try {
      const account = await signInWithGoogle()
      setFirst(account.firstName)
      setContact(account.email)
      await send({ firstName: account.firstName, contact: account.email, idToken: account.token })
    } catch (err) {
      if (googleCancelled(err)) setError(tr('Connexion Google annulée'))
      else if (googleBlocked(err)) setError(tr('Le navigateur a bloqué la fenêtre Google : touche encore le bouton'))
      else setError(tr('Connexion Google impossible'))
    }
  }

  /** To the sign-up page (keeping ?src=, which says where the visitor came from). */
  function toForm() {
    navigate(`/liste/inscription${location.search}`)
    scrollTo(0, 0)
  }

  // The form, on its own page (/liste/inscription).
  const card = (
    <section className="w-full border-2 border-[var(--brown)] bg-[var(--cream)] p-5 sm:p-6">
      {done ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-[var(--ci-green)] text-[var(--cream)]">
            <Check size={34} strokeWidth={3} />
          </span>
          <h2 className="paint text-[34px]">{done.already ? tr('Tu es déjà sur la liste, {name} !', { name: done.name }) : tr("C'est noté, {name} !", { name: done.name })}</h2>
          <p className="text-[16px] font-bold">
            {tx('On te prévient dès que Babi Life ouvre{0}. {1}', { 0: beta ? tr(', et tu pourras tester avant tout le monde') : '', 1: done.count > 1 && tr(' Vous êtes déjà {0} sur la liste.', { 0: done.count.toLocaleString('fr-FR') }) })}
          </p>
          <Share />
          <InstallButton sign className="mt-1" />
        </div>
      ) : (
        <form className="flex flex-col gap-2.5" onSubmit={join}>
          {count !== null && count > 0 && <p className="chalk-hand text-[24px] text-[var(--ci-green)]">{tx('Déjà {0} sur la liste !', { 0: count.toLocaleString('fr-FR') })}</p>}
          <h2 className="paint text-[40px]">{tr("Je m'inscris")}</h2>
          <p className="mb-1 text-[15px] font-bold">{tr('Gratuit. Juste pour être prévenu·e quand ça ouvre.')}</p>
          <Consent terms={terms} privacy={privacy} onTerms={setTerms} onPrivacy={setPrivacy} />
          {firebaseConfigured && (
            <>
              <button type="button" className="btn btn-white w-full" disabled={busy || !terms || !privacy} onClick={() => void google()}>
                <GoogleMark /> {tr('Continuer avec Google')}
              </button>
              <div className="flex items-center gap-3 text-xs font-extrabold">
                <span className="h-px flex-1 bg-[var(--brown)]/25" />
                {tr('ou avec ton e-mail')}
                <span className="h-px flex-1 bg-[var(--brown)]/25" />
              </div>
            </>
          )}
          <label className="relative">
            <UserRound size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[var(--color-ink-soft)]" />
            <input className="input !pl-11 text-base" placeholder={tr('Prénom')} autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} aria-label={tr('Prénom')} required maxLength={60} />
          </label>
          <label className="relative">
            <Smartphone size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[var(--color-ink-soft)]" />
            <input className="input !pl-11 text-base" placeholder={tr('E-mail ou numéro WhatsApp')} autoComplete="email" inputMode="email" value={contact} onChange={(e) => setContact(e.target.value)} aria-label={tr('E-mail ou numéro WhatsApp')} required />
          </label>
          <label className="relative">
            <MapPinned size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[var(--color-ink-soft)]" />
            <input className="input !pl-11 text-base" placeholder={tr('Ta commune (facultatif)')} list="communes" value={commune} onChange={(e) => setCommune(e.target.value)} aria-label={tr('Ta commune')} maxLength={60} />
            <datalist id="communes">
              {communes.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="flex cursor-pointer items-center gap-3 bg-[var(--wall)] px-3 py-2.5 text-sm font-bold">
            <input type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--rust)]" checked={beta} onChange={(e) => setBeta(e.target.checked)} />
            {tr('Je veux tester le jeu avant tout le monde')}
          </label>
          {/* Not for people: bots fill every field they find */}
          <input className="hidden" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden />
          {error && <p className="bg-[#f6d9cf] px-3 py-2 text-sm font-bold text-[var(--rust)]" role="alert">{error}</p>}
          <button className="sign-btn mt-1 w-full" disabled={busy || !terms || !privacy}>
            {busy ? tr('Un instant…') : tr("M'inscrire sur la liste")}
          </button>
          <p className="text-center text-xs font-bold">{tr("Ton contact sert seulement à te prévenir de l'ouverture. Pas de pub, pas de revente.")}</p>
          <Community />
        </form>
      )}
    </section>
  )

  return (
    <div className="street worn min-h-full overflow-x-clip">
      {/* The name over the door, as on a boutique, and the flag's stripe */}
      <header className="bg-[var(--turq)] text-[var(--cream)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <Link to={`/liste${location.search}`} className="paint flex items-center gap-2.5 text-[26px]" aria-label={tr('Babi Life')}>
            <svg width="20" height="28" viewBox="0 0 40 56" aria-hidden>
              <path d="M20 54C14 45 4 36 4 20a16 16 0 0 1 32 0c0 16-10 25-16 34Z" fill="#fbf5e6" />
              <circle cx="20" cy="20" r="7" fill="#0b6b3d" />
            </svg>
            {tr('Babi')} <span className="text-[var(--ochre)]">{tr('Life')}</span>
          </Link>
          <span className="text-[13px] font-extrabold">{tr('Sortie le mercredi 28 octobre · Gratuit')}</span>
        </div>
      </header>
      <div className="ci-stripe" aria-hidden />
      <Opening />

      {form ? (
        <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pt-6 pb-12">
          <Link to={`/liste${location.search}`} className="inline-flex w-fit items-center gap-1.5 text-[15px] font-extrabold underline-offset-4 hover:underline">
            <ArrowLeft size={16} strokeWidth={2.6} /> {tr('Découvrir le jeu')}
          </Link>
          {card}
        </main>
      ) : (
        <main>
          {/* ---------- Painted straight on the wall ---------- */}
          <section className="mx-auto grid max-w-5xl items-center gap-8 px-4 pt-8 pb-6 md:grid-cols-[1.3fr_0.7fr] md:pt-14">
            <div>
              <h1 className="paint m-0 text-[clamp(56px,15vw,124px)] text-[var(--rust)] [text-shadow:3px_3px_0_var(--ochre)]">
                {tr('Gnambro')}
                <br />
                {tr('ou laté ?')}
                <br />
                <span className="text-[var(--turq)] [text-shadow:3px_3px_0_var(--mint)]">{tr('Le sort décide.')}</span>
              </h1>
              <p className="mt-5 max-w-md text-[19px] font-extrabold">{tr("Tu ne choisis pas ta famille : elle est tirée au sort à ta naissance. Ensuite, ta vie se joue sur la vraie carte d'Abidjan, avec ton téléphone dans le jeu : Waye, Gnango, Gbairai, Tikitoko… À toi de jouer.")}</p>
              <p className="chalk-hand mt-1 text-[30px] text-[var(--ci-green)]">{tr('Fait ici, pour nous.')}</p>
              {/* The release date, painted like a sticker on the wall */}
              <p className="paint mt-3 inline-block -rotate-2 rounded-md bg-[var(--ochre)] px-3 py-1 text-[22px] whitespace-nowrap text-[var(--brown)]">{tr('Sortie le 28 octobre')}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                {/* Make one's perso now and be born into a family: kept for the opening */}
                <Link to={`/liste/creer${location.search}`} className="sign-btn">
                  {tr('Crée ton perso')}
                </Link>
                <button className="sign-btn alt" onClick={toForm}>
                  {tr("M'inscrire")}
                </button>
              </div>
              {/* The app on the home screen (PWA): it opens right here, full screen. Only shown when the phone can install it. */}
              <InstallButton sign className="mt-3 max-w-xs" />
            </div>
            <Trailer className="justify-self-center rotate-[1.5deg]" />
          </section>

          {/* ---------- The landing: the board, the steps, Awa's walk, the clips, the questions ---------- */}
          <Discover onJoin={toForm} count={count} />
        </main>
      )}

      <div className="ci-stripe" aria-hidden />
      <footer className="bg-[var(--brown)] text-[var(--cream)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-x-4 gap-y-2 px-4 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[14px] font-extrabold">
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span>{tr('Babi Life')}</span>
            <Link to="/conditions" className="underline">
              {tr('Conditions')}
            </Link>
            <Link to="/confidentialite" className="underline">
              {tr('Confidentialité')}
            </Link>
            {/* The other language (in the game: « Réglages »). */}
            <button className="underline" onClick={() => setLang(lang() === 'en' ? 'fr' : 'en')}>
              {lang() === 'en' ? 'Français' : 'English'}
            </button>
            {/* The app on the home screen has no address bar to type /testeur in, and on an iPhone it doesn't share Safari's storage: the testers go in from here */}
            {homeScreenApp() && (
              <Link to="/testeur" className="opacity-50">
                {tr('Testeur')}
              </Link>
            )}
          </span>
          <span className="chalk-hand text-[26px] text-[var(--ochre)]">{tr('Fait à Abidjan')}</span>
        </div>
      </footer>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/**
 * The opening, as set in the admin (« L'ouverture de Babi Life »): the time left, to the second; once
 * it's come, the way in. Nothing while no hour is set.
 */
function Opening() {
  const feats = useFeatures()
  const open = useGameOpen()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const at = feats.opening ? new Date(feats.opening).getTime() : null
  if (open)
    return (
      <div className="bg-[var(--ci-green)] px-4 py-3 text-center text-[var(--cream)]">
        <span className="text-[17px] font-extrabold">{tr("C'est ouvert !")} </span>
        <Link to="/jeu" className="ml-2 inline-block rounded-md bg-[var(--cream)] px-3 py-1 text-[15px] font-extrabold text-[var(--brown)]">
          {tr('Entrer dans Babi Life')}
        </Link>
      </div>
    )
  if (!at) return null
  const left = Math.max(0, Math.floor((at - now) / 1000))
  const [h, m, s] = [Math.floor(left / 3600), Math.floor((left % 3600) / 60), left % 60]
  const hour = new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Abidjan' })
  const day = new Date(at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Abidjan' })
  return (
    <div className="bg-[var(--brown)] px-4 py-3 text-center text-[var(--cream)]">
      <p className="text-[14px] font-extrabold opacity-90">
        {tx('Ouverture le {day} à {0}', { day, 0: hour.replace(':', 'h') })}
      </p>
      <p className="paint text-[34px] leading-tight tabular-nums">{left > 0 ? tr('{0}{1} min {2} s', { 0: h > 0 ? `${h} h ` : '', 1: String(m).padStart(2, '0'), 2: String(s).padStart(2, '0') }) : tr("C'est l'heure !")}</p>
    </div>
  )
}
