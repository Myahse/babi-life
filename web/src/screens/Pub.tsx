import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Eye, Upload } from 'lucide-react'
import { useWorld } from '../store/world'
import { contactLinks } from '../lib/contact'

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

type Status = {
  id: string
  advertiser: string
  contact?: string
  title: string
  type: 'image' | 'video'
  url: string
  communes: string[]
  starts: string
  ends: string
  status: 'pending' | 'approved' | 'rejected' | 'paused'
  paid: boolean
  price: number
  note: string
  views: number
  byCommune: Record<string, number>
  createdAt: string
}

const STATUS: Record<Status['status'], [string, string]> = {
  pending: ['En attente de vérification', 'var(--ochre)'],
  approved: ['Acceptée', 'var(--ci-green)'],
  rejected: ['Refusée', 'var(--rust)'],
  paused: ['En pause', '#6b5a4c'],
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Pas de réseau : réessaie dans un instant.')
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
            Babi <span className="text-[var(--ochre)]">Pub</span>
          </Link>
          <span className="text-[13px] font-extrabold">Les panneaux du jeu Babi Life</span>
        </div>
      </header>
      <div className="ci-stripe" aria-hidden />
      <main className="mx-auto max-w-4xl px-4 pt-6 pb-14">{children}</main>
    </div>
  )
}

/** The poster or the video, as it will hang on the billboard. */
function Preview({ type, url, className = '' }: { type: 'image' | 'video'; url: string; className?: string }) {
  return type === 'video' ? <video className={`w-full bg-[#26332c] object-cover ${className}`} src={url} muted loop playsInline autoPlay controls /> : <img className={`w-full bg-[#26332c] object-cover ${className}`} src={url} alt="" />
}

/* ---------- The front page: contact us first ---------- */

export function Pub() {
  const links = contactLinks()
  return (
    <Shell>
      <h1 className="paint m-0 text-[clamp(44px,11vw,80px)] text-[var(--rust)] [text-shadow:3px_3px_0_var(--ochre)]">Ta pub dans Babi</h1>
      <p className="mt-3 max-w-xl text-[18px] font-extrabold">Les joueurs passent tous les jours devant les panneaux du jeu, dans leur commune. Mets-y ton affiche ou ta vidéo.</p>
      <ol className="mt-5 grid gap-3 text-[15px] font-bold sm:grid-cols-2 lg:grid-cols-4">
        {['Tu nous contactes : dis-nous ce que tu veux montrer, où et quand.', "On s'entend sur le prix et le paiement (Waye, Orange Money…).", "On t'envoie ton lien personnel pour envoyer l'affiche ou la vidéo.", "On vérifie, elle passe sur les panneaux, et ton lien montre les vues."].map((t, i) => (
          <li key={i} className="bg-[var(--cream)] p-4">
            <span className="slab text-[30px] text-[var(--turq)]">{i + 1}.</span> {t}
          </li>
        ))}
      </ol>
      <section className="mt-8 bg-[var(--ochre)] px-6 py-7">
        <h2 className="paint m-0 text-[clamp(38px,9vw,64px)]">
          Contacte-<span className="text-[var(--rust)]">nous</span>
        </h2>
        <p className="mt-2 max-w-lg text-[17px] font-extrabold">Avant d'envoyer quoi que ce soit, parle-nous de ta pub. On te répond vite.</p>
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
          <p className="chalk-hand mt-4 text-[28px]">Nos contacts arrivent très bientôt ici.</p>
        )}
      </section>
      <p className="mt-6 text-[14px] font-bold opacity-80">Pas de tabac, pas de paris pour les mineurs, rien de choquant : on refuse ce qui ne passerait pas sur un vrai panneau d'Abidjan.</p>
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
        <p className="text-[18px] font-extrabold">Un instant…</p>
      </Shell>
    )
  if (invite === 'bad')
    return (
      <Shell>
        <h1 className="paint text-[40px]">Ce lien n'est plus valable</h1>
        <p className="mt-2 max-w-lg text-[17px] font-bold">Un lien d'envoi ne sert qu'une fois. Contacte-nous et on t'en donne un nouveau.</p>
        <Link to="/pub" className="sign-btn mt-5">
          Nous contacter
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
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!file) return setError('Choisis ton affiche ou ta vidéo.')
    if (!everywhere && where.length === 0) return setError('Choisis au moins une commune, ou « Partout ».')
    try {
      setProgress(0)
      const up = await call<{ key: string; url: string }>('/ads/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, type: file.type, size: file.size }) })
      // Straight into the bucket, with the progress shown.
      await new Promise<void>((resolve, reject) => {
        const x = new XMLHttpRequest()
        x.open('PUT', up.url)
        x.setRequestHeader('Content-Type', file.type)
        x.upload.onprogress = (ev) => ev.lengthComputable && setProgress(ev.loaded / ev.total)
        x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error("L'envoi du fichier a échoué : réessaie.")))
        x.onerror = () => reject(new Error("L'envoi du fichier a échoué : vérifie ta connexion."))
        x.send(file)
      })
      const c = await call<{ token: string }>('/ads/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, advertiser, contact, title, key: up.key, type: file.type, communes: everywhere ? [] : where, starts, ends }),
      })
      setSent(c.token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible')
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
          <h1 className="paint mt-4 text-[44px]">C'est reçu !</h1>
          <p className="mt-2 text-[17px] font-bold">On vérifie ta pub. Elle passe sur les panneaux du jeu dès qu'elle est acceptée et que le paiement convenu est reçu.</p>
          <p className="mt-4 text-[15px] font-extrabold">Garde ce lien : il montre où en est ta pub, et combien de joueurs l'ont vue.</p>
          <p className="mt-2 break-all bg-[var(--wall)] px-3 py-2 font-mono text-[14px]">{link}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="sign-btn" onClick={() => void navigator.clipboard?.writeText(link)}>
              Copier le lien
            </button>
            <Link to={`/pub/suivi/${sent}`} className="sign-btn alt">
              Voir ma pub
            </Link>
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <h1 className="paint m-0 text-[clamp(40px,10vw,68px)] text-[var(--rust)] [text-shadow:3px_3px_0_var(--ochre)]">Envoie ta pub</h1>
      <p className="mt-2 max-w-xl text-[17px] font-extrabold">{label ? `Lien d'envoi pour ${label}. ` : ''}Ce lien ne sert qu'une fois : envoie le bon fichier.</p>
      <form className="mt-8 flex flex-col gap-4 border-2 border-[var(--brown)] bg-[var(--cream)] p-5 sm:p-6" onSubmit={send}>
        <label className="flex flex-col gap-1.5 text-[15px] font-extrabold">
          Ton affiche ou ta vidéo
          <span className="text-[13px] font-bold opacity-75">Image JPG, PNG ou WebP (5 Mo au plus), ou vidéo MP4 (40 Mo au plus, 30 secondes conseillées). Format paysage : 2 de large pour 1 de haut.</span>
          <span className="flex cursor-pointer items-center gap-2 bg-[var(--wall)] px-4 py-3">
            <Upload size={18} /> {file ? file.name : 'Choisir le fichier'}
            <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,video/mp4" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </span>
        </label>
        {file && preview && (
          <div className="mx-auto w-full max-w-lg bg-[#2b2f3a] p-2">
            <Preview type={file.type.startsWith('video') ? 'video' : 'image'} url={preview} className="aspect-[2/1]" />
            <p className="mt-1 text-center text-[12px] font-bold text-[var(--cream)]">Comme sur le panneau</p>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="input text-base" placeholder="Annonceur (ton nom ou ta marque)" value={advertiser} onChange={(e) => setAdvertiser(e.target.value)} required maxLength={80} />
          <input className="input text-base" placeholder="E-mail ou numéro WhatsApp" value={contact} onChange={(e) => setContact(e.target.value)} required />
        </div>
        <input className="input text-base" placeholder="Titre de la pub (ex. Garba Chez Tanti, Yop)" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={80} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[15px] font-extrabold">Où ?</legend>
          <label className="flex items-center gap-2 text-[15px] font-bold">
            <input type="checkbox" className="h-5 w-5 accent-[var(--rust)]" checked={everywhere} onChange={(e) => setEverywhere(e.target.checked)} /> Partout, dans toutes les communes
          </label>
          {!everywhere && (
            <div className="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto bg-[var(--wall)] p-3 sm:grid-cols-3">
              {communes.length === 0 && <span className="text-[14px] font-bold">Chargement des communes…</span>}
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
            Du
            <input type="date" className="input text-base" value={starts} min={today()} onChange={(e) => setStarts(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1 text-[15px] font-extrabold">
            Au
            <input type="date" className="input text-base" value={ends} min={starts} max={plusDays(starts, 92)} onChange={(e) => setEnds(e.target.value)} required />
          </label>
        </div>
        <p className="text-[13px] font-bold opacity-80">Pas de tabac, pas de paris pour les mineurs, rien de choquant : on refuse ce qui ne passerait pas sur un vrai panneau d'Abidjan.</p>
        {error && (
          <p className="bg-[#f6d9cf] px-3 py-2 text-sm font-bold text-[var(--rust)]" role="alert">
            {error}
          </p>
        )}
        <button className="sign-btn w-full" disabled={progress !== null}>
          {progress === null ? 'Envoyer ma pub' : `Envoi… ${Math.round(progress * 100)} %`}
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
  useEffect(() => {
    call<Status>(`/ads/campaigns/${encodeURIComponent(token)}`).then(setS, (e: Error) => setError(e.message))
  }, [token])
  return (
    <Shell>
      <Link to="/pub" className="inline-flex items-center gap-1.5 text-[15px] font-extrabold">
        <ArrowLeft size={16} /> Babi Pub
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
              {s.status === 'approved' && !s.paid && ' · en attente du paiement'}
            </p>
            {s.note && <p className="mt-3 bg-[var(--cream)] px-3 py-2 text-[15px] font-bold">{s.note}</p>}
            <p className="mt-3 text-[15px] font-bold">
              Du {fr(s.starts)} au {fr(s.ends)} · {s.communes.length ? s.communes.map(name).join(', ') : 'toutes les communes'}
            </p>
            <p className="mt-4 flex items-center gap-2 text-[22px] font-extrabold">
              <Eye /> {s.views.toLocaleString('fr-FR')} vue{s.views > 1 ? 's' : ''}
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
            <p className="mt-3 text-[13px] font-bold opacity-75">Une vue : un joueur est passé devant un panneau pendant que ta pub y était. Personne n'est suivi : on compte seulement, par commune et par jour.</p>
          </div>
        </div>
      )}
    </Shell>
  )
}

/* ---------- The admin: Babi Life checks, approves, marks paid ---------- */

/** The ads' admin, inside /admin (screens/Admin.tsx): the send links, then the campaigns. */
export function PubAdminPanel({ adminKey }: { adminKey: string }) {
  const [list, setList] = useState<Status[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = async () => {
    setError(null)
    try {
      setList(await call<Status[]>('/ads/admin', { headers: { 'X-Admin-Key': adminKey } }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    }
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey])
  const update = async (id: string, change: Partial<Pick<Status, 'status' | 'paid' | 'price' | 'note'>>) => {
    try {
      await call<void>(`/ads/admin/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey }, body: JSON.stringify(change) })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    }
  }
  return (
    <>
      <Invites adminKey={adminKey} />
      <h2 className="paint mt-10 text-[40px]">Les campagnes ({list?.length ?? 0})</h2>
      {error && <p className="mt-2 text-sm font-bold text-[var(--rust)]">{error}</p>}
      <div className="mt-4 flex flex-col gap-5">
        {list?.map((c) => (
          <AdminRow key={c.id} c={c} onChange={(ch) => void update(c.id, ch)} />
        ))}
        {list?.length === 0 && <p className="font-bold">Pas encore de campagne.</p>}
      </div>
    </>
  )
}

function AdminRow({ c, onChange }: { c: Status; onChange: (change: Partial<Pick<Status, 'status' | 'paid' | 'price' | 'note'>>) => void }) {
  const [price, setPrice] = useState(String(c.price || ''))
  const [note, setNote] = useState(c.note)
  return (
    <div className="grid gap-4 border-2 border-[var(--brown)] bg-[var(--cream)] p-4 md:grid-cols-[260px_1fr]">
      <div className="bg-[#2b2f3a] p-1.5">{c.url ? <Preview type={c.type} url={c.url} className="aspect-[2/1]" /> : <p className="p-4 text-[var(--cream)]">Bucket non branché</p>}</div>
      <div className="flex flex-col gap-2 text-[14px] font-bold">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="paint text-[26px]">{c.title}</span>
          <span>{c.advertiser}</span>
          <span className="opacity-75">{c.contact}</span>
        </div>
        <span>
          {c.starts} → {c.ends} · {c.communes.length ? c.communes.join(', ') : 'partout'} · {c.views.toLocaleString('fr-FR')} vues
        </span>
        <span className="slab w-fit px-2 py-1 text-[var(--cream)]" style={{ background: STATUS[c.status][1] }}>
          {STATUS[c.status][0]}
          {c.paid ? ' · payée' : ' · non payée'}
        </span>
        <div className="flex flex-wrap gap-2">
          <button className="sign-btn turq !px-3 !py-2 !text-[14px]" onClick={() => onChange({ status: 'approved' })}>
            Accepter
          </button>
          <button className="sign-btn !px-3 !py-2 !text-[14px]" onClick={() => onChange({ status: 'rejected', note })}>
            Refuser
          </button>
          <button className="sign-btn alt !px-3 !py-2 !text-[14px]" onClick={() => onChange({ status: 'paused' })}>
            Pause
          </button>
          <button className="sign-btn alt !px-3 !py-2 !text-[14px]" onClick={() => onChange({ paid: !c.paid })}>
            {c.paid ? 'Marquer non payée' : 'Marquer payée'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <input className="input !w-40 text-base" inputMode="numeric" placeholder="Prix (F)" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
          <input className="input min-w-0 flex-1 text-base" placeholder="Note pour l'annonceur" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="sign-btn alt !px-3 !py-2 !text-[14px]" onClick={() => onChange({ price: Number(price || 0), note })}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

type Invite = { code: string; label: string; createdAt: string; usedAt: string | null; campaign: string | null }

/** The send links: one per advertiser Babi Life agreed with, each used once. */
function Invites({ adminKey }: { adminKey: string }) {
  const [list, setList] = useState<Invite[]>([])
  const [label, setLabel] = useState('')
  const [made, setMade] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const linkOf = (code: string) => `${location.origin}/pub/envoi/${code}`
  const load = () => call<Invite[]>('/ads/admin/invites', { headers: { 'X-Admin-Key': adminKey } }).then(setList, (e: Error) => setError(e.message))
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey])
  const make = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const r = await call<{ code: string }>('/ads/admin/invites', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey }, body: JSON.stringify({ label }) })
      setMade(linkOf(r.code))
      setLabel('')
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }
  return (
    <section className="border-2 border-[var(--brown)] bg-[var(--cream)] p-5">
      <h2 className="paint text-[32px]">Liens d'envoi</h2>
      <p className="text-[14px] font-bold">Quand le prix est convenu avec un annonceur, crée son lien et envoie-le lui (WhatsApp, e-mail…). Il ne sert qu'une fois.</p>
      <form className="mt-3 flex flex-wrap gap-2" onSubmit={make}>
        <input className="input min-w-0 flex-1 text-base" placeholder="Pour qui ? (ex. Garba Chez Tanti, 2 semaines Yop)" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} />
        <button className="sign-btn turq">Créer le lien</button>
      </form>
      {error && <p className="mt-2 text-sm font-bold text-[var(--rust)]">{error}</p>}
      {made && (
        <div className="mt-3 flex flex-wrap items-center gap-2 bg-[var(--wall)] px-3 py-2">
          <span className="min-w-0 flex-1 font-mono text-[13px] break-all">{made}</span>
          <button className="sign-btn alt !px-3 !py-1.5 !text-[13px]" onClick={() => void navigator.clipboard?.writeText(made)}>
            Copier
          </button>
        </div>
      )}
      {list.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5 text-[14px] font-bold">
          {list.map((i) => (
            <li key={i.code} className="flex flex-wrap items-center gap-x-3 border-t border-[var(--brown)]/15 pt-1.5">
              <span className="min-w-0 flex-1">{i.label || 'Sans nom'}</span>
              <span className="opacity-70">{new Date(i.createdAt).toLocaleDateString('fr-FR')}</span>
              {i.usedAt ? (
                <span className="text-[var(--ci-green)]">Utilisé</span>
              ) : (
                <button className="underline" onClick={() => void navigator.clipboard?.writeText(linkOf(i.code))}>
                  Copier le lien
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

