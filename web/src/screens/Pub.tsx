import { errorText } from '../lib/api'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Eye, Upload } from 'lucide-react'
import { useWorld } from '../store/world'
import { contactLinks } from '../lib/contact'
import { keyOpen, useFeatures } from '../lib/features'
import { t as tr, tx } from '../lib/i18n'

// Babi Pub (/pub): the ads on the game's billboards. An advertiser contacts
// Babi Life first (WhatsApp, e-mail, TikTok, X… : lib/contact.ts) and agrees
// the price; Babi Life then makes a send link (/pub/envoi/<code>, used once).
// There the advertiser sends the poster or the short video, says where
// (communes) and when; the file goes straight into the bucket (the API signs
// the upload only for a valid link), the campaign waits for Babi Life to
// check it. A private link follows it:
// pending, approved, refused, and how often players saw it. The admin
// (/admin, tab Pub: screens/Admin.tsx) approves, refuses, pauses, marks paid.
// The API: backend/internal/ads.

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

export type Status = {
  id: string
  advertiser: string
  contact?: string
  title: string
  type: 'image' | 'video'
  url: string
  communes: string[]
  starts: string
  ends: string
  /** On its first day from, on its last day until (« 08:00 », Abidjan time). */
  startTime?: string
  endTime?: string
  places?: Place[]
  link?: string
  appName?: string
  icon?: string
  status: 'pending' | 'approved' | 'rejected' | 'paused'
  paid: boolean
  price: number
  note: string
  views: number
  byCommune: Record<string, number>
  createdAt: string
}

/** Where an ad shows (backend ads.Places). */
export type Place = 'panneaux' | 'tikitoko' | 'babigram' | 'telephone'
export const PLACES: Record<Place, [string, string]> = {
  panneaux: [tr('Les panneaux de la rue'), tr('Sur les panneaux, les sucettes et les écrans LED des communes choisies.')],
  tikitoko: [tr('Entre les vidéos de Tikitoko'), tr('En plein écran, entre les vidéos, avec ton bouton « En savoir plus ».')],
  babigram: [tr('Dans le fil de Babigram'), tr('Un post « Sponsorisé » dans le fil, avec ton bouton « En savoir plus ».')],
  telephone: [tr('Ton appli sur le téléphone'), tr("Ton icône sur l'écran d'accueil du téléphone du jeu : un toucher ouvre ton appli ou ton site.")],
}
/** « du 1 nov. à 08:00 au 15 nov. à 20:00 ». */
export const when = (s: Pick<Status, 'starts' | 'ends' | 'startTime' | 'endTime'>) => {
  const from = s.startTime && s.startTime !== '00:00' ? ` à ${s.startTime}` : ''
  const to = s.endTime && s.endTime !== '24:00' ? ` à ${s.endTime}` : ''
  return tr('du {0}{from} au {1}{to}', { 0: fr(s.starts), from, 1: fr(s.ends), to })
}

export const STATUS: Record<Status['status'], [string, string]> = {
  pending: [tr('En attente de vérification'), 'var(--ochre)'],
  approved: [tr('Acceptée'), 'var(--ci-green)'],
  rejected: [tr('Refusée'), 'var(--rust)'],
  paused: [tr('En pause'), '#6b5a4c'],
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? tr('Pas de réseau : réessaie dans un instant.'))
  return data as T
}

const today = () => new Date().toISOString().slice(0, 10)
const plusDays = (d: string, n: number) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10)
const fr = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

/** The page's frame, painted like the wish list. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="street worn min-h-full">
      <header className="bg-[var(--turq)] text-[var(--cream)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <Link to="/pub" className="paint text-[26px]">
            {tr('Babi')} <span className="text-[var(--ochre)]">{tr('Pub')}</span>
          </Link>
          <span className="text-[13px] font-extrabold">{tr('Les panneaux du jeu Babi Life')}</span>
        </div>
      </header>
      <div className="ci-stripe" aria-hidden />
      <main className="mx-auto max-w-4xl px-4 pt-6 pb-14">{children}</main>
    </div>
  )
}

/** The poster or the video, as it will hang on the billboard. */
export function Preview({ type, url, className = '' }: { type: 'image' | 'video'; url: string; className?: string }) {
  return type === 'video' ? <video className={`w-full bg-[#26332c] object-cover ${className}`} src={url} muted loop playsInline autoPlay controls /> : <img className={`w-full bg-[#26332c] object-cover ${className}`} src={url} alt="" />
}

/* ---------- The front page: contact us first ---------- */

export function Pub() {
  useEffect(() => void (document.title = tr('Babi Pub · Ta pub dans Babi Life, le jeu d’Abidjan')), [])
  const links = contactLinks()
  return (
    <Shell>
      <h1 className="paint m-0 text-[clamp(44px,11vw,80px)] text-[var(--rust)] [text-shadow:3px_3px_0_var(--ochre)]">{tr('Ta pub dans Babi')}</h1>
      <p className="mt-3 max-w-xl text-[18px] font-extrabold">{tr('Les joueurs passent tous les jours devant les panneaux du jeu, dans leur commune. Mets-y ton affiche ou ta vidéo.')}</p>
      <ol className="mt-5 grid gap-3 text-[15px] font-bold sm:grid-cols-2 lg:grid-cols-4">
        {[tr('Tu nous contactes : dis-nous ce que tu veux montrer, où et quand.'), tr("On s'entend sur le prix et le paiement (Waye, Orange Money…)."), tr("On t'envoie ton lien personnel pour envoyer l'affiche ou la vidéo."), tr('On vérifie, elle passe sur les panneaux, et ton lien montre les vues.')].map((t, i) => (
          <li key={i} className="bg-[var(--cream)] p-4">
            <span className="slab text-[30px] text-[var(--turq)]">{i + 1}.</span> {t}
          </li>
        ))}
      </ol>
      <section className="mt-8 bg-[var(--ochre)] px-6 py-7">
        <h2 className="paint m-0 text-[clamp(38px,9vw,64px)]">
          {tr('Contacte-')}<span className="text-[var(--rust)]">{tr('nous')}</span>
        </h2>
        <p className="mt-2 max-w-lg text-[17px] font-extrabold">{tr("Avant d'envoyer quoi que ce soit, parle-nous de ta pub. On te répond vite.")}</p>
        {links.length ? (
          <div className="mt-5 flex flex-wrap gap-3">
            {links.map((l) => (
              <a key={l.id} href={l.href} target="_blank" rel="noreferrer" className={`sign-btn ${l.id === 'whatsapp' ? 'turq' : l.id === 'email' ? '' : 'alt'}`}>
                {l.label}
                <span className="font-sans text-[14px] font-bold opacity-85">{l.shown}</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="chalk-hand mt-4 text-[28px]">{tr('Nos contacts arrivent très bientôt ici.')}</p>
        )}
      </section>
      <p className="mt-6 text-[14px] font-bold opacity-80">{tr("Pas de tabac, pas de paris pour les mineurs, rien de choquant : on refuse ce qui ne passerait pas sur un vrai panneau d'Abidjan.")}</p>
    </Shell>
  )
}

/* ---------- Sending an ad, with the link Babi Life gave ---------- */

export function PubSend({ code }: { code: string }) {
  const [invite, setInvite] = useState<{ label: string; ready: boolean } | 'bad' | null>(null)
  useEffect(() => {
    call<{ label: string; ready: boolean }>(`/ads/invite/${encodeURIComponent(code)}`).then(setInvite, () => setInvite('bad'))
  }, [code])
  if (invite === null)
    return (
      <Shell>
        <p className="text-[18px] font-extrabold">{tr('Un instant…')}</p>
      </Shell>
    )
  if (invite === 'bad')
    return (
      <Shell>
        <h1 className="paint text-[40px]">{tr("Ce lien n'est plus valable")}</h1>
        <p className="mt-2 max-w-lg text-[17px] font-bold">{tr("Un lien d'envoi ne sert qu'une fois. Contacte-nous et on t'en donne un nouveau.")}</p>
        <Link to="/pub" className="sign-btn mt-5">
          {tr('Nous contacter')}
        </Link>
      </Shell>
    )
  return <SendForm code={code} label={invite.label} />
}

function SendForm({ code, label }: { code: string; label: string }) {
  const world = useWorld((s) => s.world)
  const communes = useMemo(() => (world ? world.cities.flatMap((c) => c.communes.map((x) => ({ id: x.id, name: x.name, city: c.name }))) : []), [world])
  const [file, setFile] = useState<File | null>(null)
  const [advertiser, setAdvertiser] = useState('')
  const [contact, setContact] = useState('')
  const [title, setTitle] = useState('')
  const [where, setWhere] = useState<string[]>([])
  const [everywhere, setEverywhere] = useState(true)
  const [starts, setStarts] = useState(today())
  const [ends, setEnds] = useState(plusDays(today(), 30))
  const [startTime, setStartTime] = useState('00:00')
  const [endTime, setEndTime] = useState('23:59')
  // Where: the billboards, and (features « pubs-applis ») Tikitoko, Babigram, the phone.
  const feats = useFeatures()
  const apps = keyOpen(feats, 'pubs-applis')
  const [places, setPlaces] = useState<Place[]>(['panneaux'])
  const [link, setLink] = useState('')
  const [appName, setAppName] = useState('')
  const [icon, setIcon] = useState<File | null>(null)
  const iconPreview = useMemo(() => (icon ? URL.createObjectURL(icon) : null), [icon])
  useEffect(() => () => void (iconPreview && URL.revokeObjectURL(iconPreview)), [iconPreview])
  const onPhone = places.includes('telephone')
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!file) return setError(tr('Choisis ton affiche ou ta vidéo.'))
    if (!everywhere && where.length === 0) return setError(tr('Choisis au moins une commune, ou « Partout ».'))
    if (places.length === 0) return setError(tr('Choisis où passe ta pub.'))
    if (onPhone && (!link || !appName || !icon)) return setError(tr("Pour le téléphone : le lien, le nom et l'icône de ton appli."))
    try {
      setProgress(0)
      // The phone's icon first (a small square image), then the ad itself.
      let iconKey = ''
      if (onPhone && icon) {
        const up = await call<{ key: string; url: string }>('/ads/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, type: icon.type, size: icon.size }) })
        const res = await fetch(up.url, { method: 'PUT', headers: { 'Content-Type': icon.type }, body: icon })
        if (!res.ok) throw new Error(tr("L'envoi de l'icône a échoué : réessaie."))
        iconKey = up.key
      }
      const up = await call<{ key: string; url: string }>('/ads/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, type: file.type, size: file.size }) })
      // Straight into the bucket, with the progress shown.
      await new Promise<void>((resolve, reject) => {
        const x = new XMLHttpRequest()
        x.open('PUT', up.url)
        x.setRequestHeader('Content-Type', file.type)
        x.upload.onprogress = (ev) => ev.lengthComputable && setProgress(ev.loaded / ev.total)
        x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error(tr("L'envoi du fichier a échoué : réessaie."))))
        x.onerror = () => reject(new Error(tr("L'envoi du fichier a échoué : vérifie ta connexion.")))
        x.send(file)
      })
      const c = await call<{ token: string }>('/ads/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, advertiser, contact, title, key: up.key, type: file.type, communes: everywhere ? [] : where, starts, ends, startTime, endTime, places, link, appName: onPhone ? appName : '', iconKey }),
      })
      setSent(c.token)
    } catch (err) {
      setError(errorText(err, tr('Envoi impossible')))
    } finally {
      setProgress(null)
    }
  }

  if (sent) {
    const link = `${location.origin}/pub/suivi/${sent}`
    return (
      <Shell>
        <div className="border-2 border-[var(--brown)] bg-[var(--cream)] p-6">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--ci-green)] text-[var(--cream)]">
            <Check size={30} strokeWidth={3} />
          </span>
          <h1 className="paint mt-4 text-[44px]">{tr("C'est reçu !")}</h1>
          <p className="mt-2 text-[17px] font-bold">{tr("On vérifie ta pub. Elle passe sur les panneaux du jeu dès qu'elle est acceptée et que le paiement convenu est reçu.")}</p>
          <p className="mt-4 text-[15px] font-extrabold">{tr("Garde ce lien : il montre où en est ta pub, et combien de joueurs l'ont vue.")}</p>
          <p className="mt-2 break-all bg-[var(--wall)] px-3 py-2 font-mono text-[14px]">{link}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="sign-btn" onClick={() => void navigator.clipboard?.writeText(link)}>
              {tr('Copier le lien')}
            </button>
            <Link to={`/pub/suivi/${sent}`} className="sign-btn alt">
              {tr('Voir ma pub')}
            </Link>
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <h1 className="paint m-0 text-[clamp(40px,10vw,68px)] text-[var(--rust)] [text-shadow:3px_3px_0_var(--ochre)]">{tr('Envoie ta pub')}</h1>
      <p className="mt-2 max-w-xl text-[17px] font-extrabold">{label ? tr("Lien d'envoi pour {label}. ", { label }) : ''}{tr("Ce lien ne sert qu'une fois : envoie le bon fichier.")}</p>
      <form className="mt-8 flex flex-col gap-4 border-2 border-[var(--brown)] bg-[var(--cream)] p-5 sm:p-6" onSubmit={send}>
        <label className="flex flex-col gap-1.5 text-[15px] font-extrabold">
          {tr('Ton affiche ou ta vidéo')}
          <span className="text-[13px] font-bold opacity-75">{tr('Image JPG, PNG ou WebP (5 Mo au plus), ou vidéo MP4 (40 Mo au plus, 30 secondes conseillées). Format paysage : 2 de large pour 1 de haut.')}</span>
          <span className="flex cursor-pointer items-center gap-2 bg-[var(--wall)] px-4 py-3">
            <Upload size={18} /> {file ? file.name : tr('Choisir le fichier')}
            <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,video/mp4" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </span>
        </label>
        {file && preview && (
          <div className="mx-auto w-full max-w-lg bg-[#2b2f3a] p-2">
            <Preview type={file.type.startsWith('video') ? 'video' : 'image'} url={preview} className="aspect-[2/1]" />
            <p className="mt-1 text-center text-[12px] font-bold text-[var(--cream)]">{tr('Comme sur le panneau')}</p>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="input text-base" placeholder={tr('Annonceur (ton nom ou ta marque)')} value={advertiser} onChange={(e) => setAdvertiser(e.target.value)} required maxLength={80} />
          <input className="input text-base" placeholder={tr('E-mail ou numéro WhatsApp')} value={contact} onChange={(e) => setContact(e.target.value)} required />
        </div>
        <input className="input text-base" placeholder={tr('Titre de la pub (ex. Garba Chez Tanti, Yop)')} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={80} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[15px] font-extrabold">{tr('Où ?')}</legend>
          <label className="flex items-center gap-2 text-[15px] font-bold">
            <input type="checkbox" className="h-5 w-5 accent-[var(--rust)]" checked={everywhere} onChange={(e) => setEverywhere(e.target.checked)} /> {tr('Partout, dans toutes les communes')}
          </label>
          {!everywhere && (
            <div className="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto bg-[var(--wall)] p-3 sm:grid-cols-3">
              {communes.length === 0 && <span className="text-[14px] font-bold">{tr('Chargement des communes…')}</span>}
              {communes.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-[14px] font-bold">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--rust)]" checked={where.includes(c.id)} onChange={(e) => setWhere((w) => (e.target.checked ? [...w, c.id] : w.filter((x) => x !== c.id)))} />
                  {c.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[15px] font-extrabold">
            {tr('Du')}
            <input type="date" className="input text-base" value={starts} min={today()} onChange={(e) => setStarts(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1 text-[15px] font-extrabold">
            {tr('Au')}
            <input type="date" className="input text-base" value={ends} min={starts} max={plusDays(starts, 92)} onChange={(e) => setEnds(e.target.value)} required />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[15px] font-extrabold">
            {tr('À partir de (le premier jour)')}
            <input type="time" className="input text-base" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1 text-[15px] font-extrabold">
            {tr("Jusqu'à (le dernier jour)")}
            <input type="time" className="input text-base" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
          </label>
        </div>
        <p className="-mt-2 text-[13px] font-bold opacity-75">
          {tx("Ta pub passe {0} (heure d'Abidjan), sans arrêt entre les deux.", { 0: when({ starts, ends, startTime, endTime }) })}
        </p>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[15px] font-extrabold">{tr('Dans le jeu, où ?')}</legend>
          {(Object.keys(PLACES) as Place[])
            .filter((p) => p === 'panneaux' || apps)
            .map((p) => (
              <label key={p} className="flex items-start gap-2 text-[15px] font-bold">
                <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--rust)]" checked={places.includes(p)} onChange={(e) => setPlaces((l) => (e.target.checked ? [...l, p] : l.filter((x) => x !== p)))} />
                <span>
                  {PLACES[p][0]}
                  <span className="block text-[13px] font-bold opacity-75">{PLACES[p][1]}</span>
                </span>
              </label>
            ))}
        </fieldset>
        <label className="flex flex-col gap-1.5 text-[15px] font-extrabold">
          {tx('Ton lien {0}', { 0: onPhone ? '' : '(facultatif)' })}
          <span className="text-[13px] font-bold opacity-75">{tr("Ton site, ta page, ton appli sur le Play Store ou l'App Store : un toucher sur « En savoir plus » l'ouvre.")}</span>
          <input type="url" className="input text-base" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} required={onPhone} maxLength={300} />
        </label>
        {onPhone && (
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="flex flex-col gap-1.5 text-[15px] font-extrabold">
              {tr("Le nom de ton appli sous l'icône")}
              <input className="input text-base" placeholder={tr('ex. Garba Express')} value={appName} onChange={(e) => setAppName(e.target.value)} required maxLength={18} />
            </label>
            <label className="flex cursor-pointer items-center gap-3 text-[15px] font-extrabold">
              <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[13px] bg-[var(--wall)]">
                {iconPreview ? <img src={iconPreview} alt="" className="h-full w-full object-cover" /> : <Upload size={20} />}
              </span>
              <span>
                {tr('Ton icône')}
                <span className="block text-[13px] font-bold opacity-75">{tr('Image carrée, PNG ou JPG')}</span>
              </span>
              <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp" onChange={(e) => setIcon(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        )}
        <p className="text-[13px] font-bold opacity-80">{tr("Pas de tabac, pas de paris pour les mineurs, rien de choquant : on refuse ce qui ne passerait pas sur un vrai panneau d'Abidjan.")}</p>
        {error && (
          <p className="bg-[#f6d9cf] px-3 py-2 text-sm font-bold text-[var(--rust)]" role="alert">
            {error}
          </p>
        )}
        <button className="sign-btn w-full" disabled={progress !== null}>
          {progress === null ? tr('Envoyer ma pub') : tr('Envoi… {0} %', { 0: Math.round(progress * 100) })}
        </button>
      </form>
    </Shell>
  )
}

/* ---------- Following an ad ---------- */

export function PubFollow({ token }: { token: string }) {
  const world = useWorld((s) => s.world)
  const name = (id: string) => world?.cities.flatMap((c) => c.communes).find((c) => c.id === id)?.name ?? id
  const [s, setS] = useState<Status | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = () => call<Status>(`/ads/campaigns/${encodeURIComponent(token)}`).then(setS, (e: Error) => setError(e.message))
  useEffect(() => void load(), [token]) // eslint-disable-line react-hooks/exhaustive-deps
  // Paying: on GeniusPay's page (Wave, Orange Money, MTN, Moov, a card), then back here (?achat=…), asked
  // every few seconds until GeniusPay has said its word.
  const [paying, setPaying] = useState(false)
  const [pay, setPay] = useState<{ status: string; credited: boolean; failed: boolean } | null>(null)
  useEffect(() => {
    const q = new URLSearchParams(location.search)
    const id = q.get('achat')
    if (!id) return
    const failed = q.get('echec') === '1'
    history.replaceState(null, '', location.pathname)
    let stop = false
    let tries = 0
    const ask = () =>
      call<{ status: string; credited: boolean }>(`/ads/campaigns/${encodeURIComponent(token)}/pay/${encodeURIComponent(id)}`, { method: 'POST' })
        .then((p) => {
          if (stop) return
          setPay({ ...p, failed })
          if (!p.credited && (p.status === 'pending' || p.status === 'processing') && tries++ < 40) setTimeout(ask, 3000)
          else void load()
        })
        .catch((e: Error) => !stop && setError(e.message))
    void ask()
    return () => void (stop = true)
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps
  const payNow = async () => {
    setPaying(true)
    setError(null)
    try {
      const { url } = await call<{ id: string; url: string }>(`/ads/campaigns/${encodeURIComponent(token)}/pay`, { method: 'POST' })
      location.assign(url)
    } catch (e) {
      setError((e as Error).message)
      setPaying(false)
    }
  }
  return (
    <Shell>
      <Link to="/pub" className="inline-flex items-center gap-1.5 text-[15px] font-extrabold">
        <ArrowLeft size={16} /> {tr('Babi Pub')}
      </Link>
      {error && <p className="mt-6 text-[18px] font-extrabold">{error}</p>}
      {s && (
        <div className="mt-4 grid gap-6 md:grid-cols-[1fr_1fr]">
          <div className="bg-[#2b2f3a] p-2">{s.url && <Preview type={s.type} url={s.url} className="aspect-[2/1]" />}</div>
          <div>
            <h1 className="paint m-0 text-[40px]">{s.title}</h1>
            <p className="text-[16px] font-bold">{s.advertiser}</p>
            <p className="slab mt-3 inline-block px-3 py-1.5 text-[16px] text-[var(--cream)]" style={{ background: STATUS[s.status][1] }}>
              {STATUS[s.status][0]}
              {s.status === 'approved' && !s.paid && tr(' · en attente du paiement')}
            </p>
            {pay && (
              <p className="mt-3 bg-[var(--cream)] px-3 py-2 text-[15px] font-bold" role="status">
                {pay.credited ? tr('Paiement reçu, merci ! Ta pub passera sur les panneaux à ses dates.') : pay.status === 'pending' || pay.status === 'processing' ? (pay.failed ? tr("Le paiement n'est pas passé : tu peux réessayer.") : tr('Paiement en cours : dès que GeniusPay le confirme, ta pub est réglée.')) : tr("Le paiement n'a pas abouti : rien n'a été débité, tu peux réessayer.")}
              </p>
            )}
            {s.status === 'approved' && !s.paid && s.price >= 200 && !pay?.credited && (
              <div className="mt-3">
                <button className="sign-btn" disabled={paying} onClick={() => void payNow()}>
                  {paying ? tr('Vers GeniusPay…') : tr('Payer {0} F CFA en ligne', { 0: s.price.toLocaleString('fr-FR') })}
                </button>
                <p className="mt-1.5 text-[13px] font-bold opacity-75">{tr('Wave, Orange Money, MTN, Moov ou carte, sur la page sécurisée de GeniusPay. On peut aussi régler avec nous comme convenu.')}</p>
              </div>
            )}
            {s.note && <p className="mt-3 bg-[var(--cream)] px-3 py-2 text-[15px] font-bold">{s.note}</p>}
            <p className="mt-3 text-[15px] font-bold">
              {when(s).replace(/^du/, 'Du')} · {s.communes.length ? s.communes.map(name).join(', ') : tr('toutes les communes')}
            </p>
            <p className="mt-1 text-[15px] font-bold">{(s.places?.length ? s.places : (['panneaux'] as Place[])).map((p) => PLACES[p][0]).join(' · ')}</p>
            {s.link && (
              <p className="mt-1 truncate text-[14px] font-bold">
                {tr('Lien :')} <a href={s.link} target="_blank" rel="noopener noreferrer" className="underline">{s.link}</a>
              </p>
            )}
            {s.icon && (
              <p className="mt-2 flex items-center gap-2 text-[14px] font-bold">
                <img src={s.icon} alt="" className="h-10 w-10 rounded-[9px] object-cover" /> {s.appName}
              </p>
            )}
            <p className="mt-4 flex items-center gap-2 text-[22px] font-extrabold">
              <Eye /> {tx('{0} vue{1}', { 0: s.views.toLocaleString('fr-FR'), 1: s.views > 1 ? 's' : '' })}
            </p>
            {Object.keys(s.byCommune).length > 0 && (
              <ul className="mt-2 text-[15px] font-bold">
                {Object.entries(s.byCommune)
                  .sort((a, b) => b[1] - a[1])
                  .map(([c, n]) => (
                    <li key={c}>
                      {name(c)} : {n.toLocaleString('fr-FR')}
                    </li>
                  ))}
              </ul>
            )}
            <p className="mt-3 text-[13px] font-bold opacity-75">{tr("Une vue : un joueur a vu ta pub, sur un panneau, entre ses vidéos, dans son fil ou sur son téléphone. Personne n'est suivi : on compte seulement, par commune et par jour.")}</p>
          </div>
        </div>
      )}
    </Shell>
  )
}
