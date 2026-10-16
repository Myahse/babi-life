import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Baby, Check, Hammer, MapPinned, Shirt, Smartphone, UserRound, Users, type LucideIcon } from 'lucide-react'
import { Scene } from '../components/Scene'
import { Portrait } from '../avatar/portrait'
import { IconTile, Logo } from '../components/ui'
import { useWorld } from '../store/world'
import { CROWD } from './Title'
import { Community, Share } from '../components/WaitlistShare'
import { Consent } from '../components/Consent'
import { InstallButton } from '../components/InstallButton'
import { Discover } from '../components/Discover'
import { firebaseConfigured, googleCancelled, signInWithGoogle } from '../lib/google'

// The wish list (/liste): before the game opens, people leave a first name
// and an e-mail or a WhatsApp number to hear when it does. The flyer's QR
// code and the video lead here (?src=flyer, ?src=video say which).

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

/** The communes offered while the world data isn't there (it lists them all). */
const ABIDJAN = ['Abobo', 'Adjamé', 'Attécoubé', 'Cocody', 'Koumassi', 'Marcory', 'Plateau', 'Port-Bouët', 'Treichville', 'Yopougon', 'Bingerville', 'Songon', 'Anyama']

const PROMISES: { icon: LucideIcon; colors: [string, string]; title: string; text: string }[] = [
  { icon: Shirt, colors: ['#b39dff', '#7b5cff'], title: 'Ton Sim en blocs', text: 'Pagne wax, boubou, survêt, coiffures : un Sim carré à ton style.' },
  { icon: Hammer, colors: ['#ffa040', '#ff7a00'], title: 'Ta maison, bloc par bloc', text: 'Banco, planches, parpaing, tôle… puis brique, carreaux et marbre.' },
  { icon: MapPinned, colors: ['#69e2a0', '#00a862'], title: 'Les vrais quartiers', text: "Abidjan en vrai, avec tes amis dans la même rue, au même moment." },
]

type Done = { name: string; count: number; already: boolean }

export function Waitlist() {
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
      if (!res.ok) throw new Error(data.error ?? 'Inscription impossible pour le moment')
      setDone({ name: body.firstName.trim(), count: data.count ?? 0, already: !!data.already })
    } catch (err) {
      setError(err instanceof Error && err.message !== 'Failed to fetch' ? err.message : 'Pas de réseau : réessaie dans un instant.')
    } finally {
      setBusy(false)
    }
  }

  function join(e: React.FormEvent) {
    e.preventDefault()
    if (!terms || !privacy) {
      setError('Coche les conditions et la confidentialité.')
      return
    }
    void send({ firstName: first, contact })
  }

  async function google() {
    setError(null)
    if (!terms || !privacy) {
      setError('Coche les conditions et la confidentialité.')
      return
    }
    try {
      const account = await signInWithGoogle()
      setFirst(account.firstName)
      setContact(account.email)
      await send({ firstName: account.firstName, contact: account.email, idToken: account.token })
    } catch (err) {
      if (googleCancelled(err)) setError('Connexion Google annulée')
      else setError('Connexion Google impossible')
    }
  }

  /** Up to the sign-up card, the first field ready. */
  function toForm() {
    document.getElementById('liste')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => document.querySelector<HTMLInputElement>('#liste input')?.focus({ preventScroll: true }), 450)
  }

  return (
    <div className="relative min-h-full overflow-x-clip bg-[var(--color-night)] text-white">
      <div className="pointer-events-none fixed inset-0">
        <Scene className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f1230]/70 via-[#0f1230]/35 to-[#0f1230]/95" />
        {/* On a wide screen the words are on the left: shade that side */}
        <div className="absolute inset-0 hidden bg-gradient-to-r from-[#0f1230]/90 via-[#0f1230]/45 to-transparent lg:block" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-2 lg:px-8 lg:pt-6">
        <Logo size={36} />
        <span className="text-xs font-extrabold text-white/70">Gratuit · 100 % ivoirien</span>
      </header>

      <main className="relative z-10 mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-5 pb-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-x-12 lg:gap-y-14 lg:px-8 lg:pt-10">
        {/* ---------- Hero ---------- */}
        <section className="motion-stagger flex flex-col items-center text-center lg:items-start lg:text-left">
          <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-extrabold backdrop-blur lg:mt-0">
            <span className="flex overflow-hidden rounded-[3px]" aria-hidden>
              <i className="block h-3 w-1.5 bg-[#ff8200]" />
              <i className="block h-3 w-1.5 bg-white" />
              <i className="block h-3 w-1.5 bg-[#009a44]" />
            </span>
            Bientôt · Liste d'attente
          </span>
          <h1 className="mt-4 font-display text-[44px] leading-[0.95] font-extrabold tracking-[-0.02em] sm:text-6xl lg:text-7xl">
            Ta vie.
            <br />
            Ton quartier.
            <br />
            <span className="text-[var(--color-orange)]">Ton Babi.</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed font-semibold text-white/85 lg:text-lg">
            Babi Life arrive : crée ton Sim dès maintenant et découvre dans quelle famille il naît, des plus gnambro aux plus laté. On te prévient en premier à l'ouverture.
          </p>
          {/* Make one's Sim now and be born into a family: kept for the opening */}
          <Link to={`/liste/creer${location.search}`} className="btn mt-6 w-full max-w-sm">
            <Baby size={20} strokeWidth={2.6} /> Crée ton Sim, découvre ta famille
          </Link>
          {/* The app on the home screen (PWA): it opens right here, full screen. Only shown when the phone can install it. */}
          <InstallButton className="mt-3 max-w-sm" />
          <button
            className="mt-3 text-sm font-extrabold text-white/80 underline-offset-4 hover:underline lg:hidden"
            onClick={toForm}
          >
            Ou juste m'inscrire <ArrowRight size={14} strokeWidth={2.6} className="inline" />
          </button>
          {/* The cast, standing on a warm glow */}
          <div className="relative mt-8 flex items-end justify-center lg:mt-10 lg:justify-start" aria-hidden>
            <span className="absolute -bottom-3 left-1/2 h-10 w-[115%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(255,138,26,0.55),rgba(255,138,26,0))] lg:left-[45%]" />
            {CROWD.map((c, i) => (
              <span key={i} className="relative -mx-2 block" style={{ width: `min(${c.size * 1.15}px, ${Math.round(c.size / 4.2)}vw)`, aspectRatio: '1 / 1.35' }}>
                <Portrait look={c.look} gender={c.gender} framing="full" />
              </span>
            ))}
          </div>
        </section>

        {/* ---------- Sign-up card ---------- */}
        <section id="liste" className="card scroll-mt-6 w-full self-start p-5 text-[var(--color-ink)] lg:p-6">
          {done ? (
            <div className="motion-stagger flex flex-col items-center gap-3 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-[var(--color-emerald)] text-white">
                <Check size={34} strokeWidth={3} />
              </span>
              <h2 className="font-display text-2xl font-extrabold">{done.already ? `Tu es déjà sur la liste, ${done.name} !` : `C'est noté, ${done.name} !`}</h2>
              <p className="text-sm font-semibold text-[var(--color-ink-soft)]">
                On te prévient dès que Babi Life ouvre{beta ? ', et tu pourras tester avant tout le monde' : ''}.
                {done.count > 1 && ` Vous êtes déjà ${done.count.toLocaleString('fr-FR')} sur la liste.`}
              </p>
              <Share />
              <InstallButton className="mt-1" />
            </div>
          ) : (
            <form className="flex flex-col gap-2.5" onSubmit={join}>
              {count !== null && count > 0 && (
                <span className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#e6f8ef] px-3 py-1 text-xs font-extrabold text-[var(--color-emerald-deep)]">
                  <Users size={14} strokeWidth={2.6} /> Déjà {count.toLocaleString('fr-FR')} inscrit·e{count > 1 ? '·s' : ''}
                </span>
              )}
              <h2 className="font-display text-2xl leading-tight font-extrabold">Je m'inscris</h2>
              <p className="-mt-1 mb-1 text-sm font-semibold text-[var(--color-ink-soft)]">Gratuit. Juste pour être prévenu·e quand ça ouvre.</p>
              <Consent terms={terms} privacy={privacy} onTerms={setTerms} onPrivacy={setPrivacy} />
              {firebaseConfigured && (
                <>
                  <button type="button" className="btn btn-white w-full" disabled={busy || !terms || !privacy} onClick={() => void google()}>
                    <GoogleMark /> Continuer avec Google
                  </button>
                  <div className="flex items-center gap-3 text-xs font-extrabold text-[var(--color-ink-soft)]">
                    <span className="h-px flex-1 bg-[var(--color-line)]" />
                    ou avec ton e-mail
                    <span className="h-px flex-1 bg-[var(--color-line)]" />
                  </div>
                </>
              )}
              <label className="relative">
                <UserRound size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[var(--color-ink-soft)]" />
                <input className="input !pl-11 text-base" placeholder="Prénom" autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} aria-label="Prénom" required maxLength={60} />
              </label>
              <label className="relative">
                <Smartphone size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[var(--color-ink-soft)]" />
                <input className="input !pl-11 text-base" placeholder="E-mail ou numéro WhatsApp" autoComplete="email" inputMode="email" value={contact} onChange={(e) => setContact(e.target.value)} aria-label="E-mail ou numéro WhatsApp" required />
              </label>
              <label className="relative">
                <MapPinned size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[var(--color-ink-soft)]" />
                <input className="input !pl-11 text-base" placeholder="Ta commune (facultatif)" list="communes" value={commune} onChange={(e) => setCommune(e.target.value)} aria-label="Ta commune" maxLength={60} />
                <datalist id="communes">
                  {communes.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-[var(--color-canvas)] px-3 py-2.5 text-sm font-bold">
                <input type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--color-orange)]" checked={beta} onChange={(e) => setBeta(e.target.checked)} />
                Je veux tester le jeu avant tout le monde
              </label>
              {/* Not for people: bots fill every field they find */}
              <input className="hidden" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden />
              {error && <p className="animate-pop rounded-xl bg-[#ffeef1] px-3 py-2 text-sm font-bold text-[#d81b3f]" role="alert">{error}</p>}
              <button className="btn mt-1 w-full" disabled={busy || !terms || !privacy}>
                {busy ? 'Un instant…' : "M'inscrire sur la liste"} <ArrowRight size={18} strokeWidth={2.6} />
              </button>
              <p className="text-center text-xs font-semibold text-[var(--color-ink-soft)]">Ton contact sert seulement à te prévenir de l'ouverture. Pas de pub, pas de revente.</p>
              <Community />
            </form>
          )}
        </section>

        {/* ---------- What's coming ---------- */}
        <ul className="grid gap-3 sm:grid-cols-3 lg:col-span-2">
          {PROMISES.map((p) => (
            <li key={p.title} className="flex items-start gap-3 rounded-[24px] border border-white/10 bg-[#171a42]/90 p-4 backdrop-blur">
              <IconTile icon={p.icon} colors={p.colors} size={48} />
              <span className="min-w-0">
                <span className="block font-display text-[17px] leading-tight font-extrabold">{p.title}</span>
                <span className="mt-1 block text-sm leading-snug font-semibold text-white/75">{p.text}</span>
              </span>
            </li>
          ))}
        </ul>

        {/* ---------- The landing: how it works, clips from the game, the trailer, questions ---------- */}
        <Discover onJoin={toForm} />
      </main>

      <footer className="relative z-10 mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center lg:flex-row lg:justify-between lg:px-8 lg:text-left">
        <Logo size={28} />
        <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-bold text-white/60 lg:justify-end">
          <Link to="/conditions" className="underline">Conditions</Link>
          <Link to="/confidentialite" className="underline">Confidentialité</Link>
          <span>lifeinbabi.com · Fait à Abidjan</span>
        </span>
      </footer>
      <div className="relative z-10 flex h-1.5" aria-hidden>
        <i className="flex-1 bg-[#ff8200]" />
        <i className="flex-1 bg-white" />
        <i className="flex-1 bg-[#009a44]" />
      </div>
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
