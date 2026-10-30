import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, BellRing, Dices, Download, ExternalLink, Flag, Globe, ImagePlus, LayoutDashboard, Lightbulb, ListChecks, LogOut, Mail, Megaphone, MessageCircle, Package, RefreshCw, ScrollText, Search, Send, ShieldCheck, Smartphone, Trash2, Users, Video } from 'lucide-react'
import { PLACES, Preview, STATUS, type Place, type Status } from './Pub'

// /admin: everything Babi Life's team manages, behind one key (ADMIN_KEY on
// the API). A plain dashboard, not the game's look:
// - Tableau de bord: the numbers, the last things that happened;
// - Joueurs: every account and its Sim, searchable;
// - Journal: sign-ups, logins, new Sims, the wish list, reports, ads, and
//   what the team did (backend/internal/admin);
// - Annonces: a message from Babi Life in every Sim's phone;
// - WhatsApp: a message to the wish list's numbers, through WhatsApp's API
//   with an approved template, or by hand with click-to-chat links;
// - E-mails: the models of the game's e-mails (backend/internal/mail/news.go), seen as they'll
//   arrive, their words changed, a picture or a video added, a test, then to an audience (Brevo; admin/email.go);
// - Notifications: a notification on the players' phones (title, text, picture, the page it opens),
//   a test to one's own account, then to an audience, a few a day at most (admin/notify.go);
// - Liste d'attente, Pub (backend/internal/ads), Signalements (moderation);
// - Idées: what the players suggest from the phone (backend/internal/ideas), answered here;
// - Mises à jour: the features that ship closed, opened one by one (now or at a set time) (backend/internal/features);
// - Casino: the money games' « taux de retour », a level for all and one per game (backend/internal/odds), told in each game's rules.
// The key stays in the tab only (sessionStorage); the page is never indexed.

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'
const STORE = 'babi.adminKey'

type Tab = 'tableau' | 'joueurs' | 'journal' | 'annonces' | 'whatsapp' | 'emails' | 'notifs' | 'liste' | 'pub' | 'signalements' | 'idees' | 'majs' | 'casino'
const TABS: { id: Tab; label: string; icon: typeof Flag }[] = [
  { id: 'tableau', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'joueurs', label: 'Joueurs', icon: Users },
  { id: 'journal', label: 'Journal', icon: ScrollText },
  { id: 'annonces', label: 'Annonces', icon: Bell },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'emails', label: 'E-mails', icon: Mail },
  { id: 'notifs', label: 'Notifications', icon: BellRing },
  { id: 'liste', label: "Liste d'attente", icon: ListChecks },
  { id: 'pub', label: 'Pub', icon: Megaphone },
  { id: 'signalements', label: 'Signalements', icon: Flag },
  { id: 'idees', label: 'Idées', icon: Lightbulb },
  { id: 'majs', label: 'Mises à jour', icon: Package },
  { id: 'casino', label: 'Casino', icon: Dices },
]

async function call<T>(path: string, key: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), 'X-Admin-Key': key, ...init.headers } })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Pas de réseau : réessaie dans un instant.')
  return data as T
}

const read = () => {
  try {
    return sessionStorage.getItem(STORE) ?? ''
  } catch {
    return ''
  }
}
const when = (d: string) => new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const nf = (n: number) => n.toLocaleString('fr-FR')

/* ---------- The frame ---------- */

export function Admin() {
  const { search } = useLocation()
  const navigate = useNavigate()
  const tab = (new URLSearchParams(search).get('tab') as Tab) || 'tableau'
  const [key, setKey] = useState(read)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const m = document.createElement('meta')
    m.name = 'robots'
    m.content = 'noindex, nofollow'
    document.head.appendChild(m)
    document.title = 'Admin · Babi Life'
    return () => m.remove()
  }, [])

  const open = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await call('/admin/stats', typed)
      try {
        sessionStorage.setItem(STORE, typed)
      } catch {
        /* private mode: asked again next time */
      }
      setKey(typed)
    } catch (err) {
      setError(err instanceof Error && !/clé/i.test(err.message) ? err.message : 'Clé refusée.')
    }
  }
  const leave = () => {
    try {
      sessionStorage.removeItem(STORE)
    } catch {
      /* nothing kept */
    }
    setKey('')
    setTyped('')
  }

  if (!key)
    return (
      <div className="grid min-h-full place-items-center bg-[#f4f5f7] p-4 font-sans text-[#111827]">
        <form className="w-full max-w-sm rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-sm" onSubmit={open}>
          <div className="flex items-center gap-2 text-[#ea580c]">
            <ShieldCheck size={22} />
            <span className="text-sm font-semibold tracking-wide uppercase">Babi Life</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold">Espace admin</h1>
          <p className="mt-1 text-sm text-[#6b7280]">Entre la clé admin (ADMIN_KEY sur Render).</p>
          <input className="mt-4 w-full rounded-lg border border-[#d1d5db] px-3 py-2.5 text-base outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20" type="password" autoComplete="current-password" placeholder="Clé admin" value={typed} onChange={(e) => setTyped(e.target.value)} />
          {error && <p className="mt-2 text-sm text-[#dc2626]">{error}</p>}
          <button className="mt-4 w-full rounded-lg bg-[#111827] py-2.5 text-sm font-semibold text-white hover:bg-[#1f2937]">Ouvrir</button>
        </form>
      </div>
    )

  return (
    <div className="flex min-h-full bg-[#f4f5f7] font-sans text-[#111827] max-md:flex-col">
      <aside className="shrink-0 bg-[#111827] text-[#d1d5db] md:sticky md:top-0 md:h-screen md:w-60">
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-[15px] font-bold text-white">
            Babi Life <span className="text-[#fb923c]">Admin</span>
          </span>
          <button className="flex items-center gap-1 text-xs text-[#9ca3af] hover:text-white md:hidden" onClick={leave}>
            <LogOut size={14} /> Fermer
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(`/admin?tab=${t.id}`)}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium ${tab === t.id ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white'}`}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </nav>
        <button className="mx-3 mt-4 hidden items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#9ca3af] hover:text-white md:flex" onClick={leave}>
          <LogOut size={16} /> Fermer la session
        </button>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <h1 className="mb-6 text-2xl font-bold">{TABS.find((t) => t.id === tab)?.label}</h1>
        {tab === 'joueurs' ? (
          <Players k={key} />
        ) : tab === 'journal' ? (
          <Log k={key} />
        ) : tab === 'annonces' ? (
          <Announcements k={key} />
        ) : tab === 'whatsapp' ? (
          <WhatsApp k={key} />
        ) : tab === 'emails' ? (
          <Emails k={key} />
        ) : tab === 'notifs' ? (
          <Notifs k={key} />
        ) : tab === 'liste' ? (
          <Waitlist k={key} />
        ) : tab === 'pub' ? (
          <Pub k={key} />
        ) : tab === 'signalements' ? (
          <Reports k={key} />
        ) : tab === 'idees' ? (
          <Ideas k={key} />
        ) : tab === 'majs' ? (
          <Updates k={key} />
        ) : tab === 'casino' ? (
          <Casino k={key} />
        ) : (
          <Dashboard k={key} go={(t) => navigate(`/admin?tab=${t}`)} />
        )}
      </main>
    </div>
  )
}

/* ---------- Pieces ---------- */

function Card({ title, children, right, className = '' }: { title?: string; children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  )
}
const Btn = ({ tone = 'dark', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'dark' | 'light' | 'red' | 'orange' }) => (
  <button
    {...p}
    className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold disabled:opacity-40 ${
      { dark: 'bg-[#111827] text-white hover:bg-[#1f2937]', light: 'border border-[#d1d5db] bg-white hover:bg-[#f9fafb]', red: 'bg-[#dc2626] text-white hover:bg-[#b91c1c]', orange: 'bg-[#ea580c] text-white hover:bg-[#c2410c]' }[tone]
    } ${className}`}
  />
)
const Field = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20 ${p.className ?? ''}`} />
const Err = ({ e }: { e: string | null }) => (e ? <p className="mb-3 rounded-lg bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]">{e}</p> : null)
const Ok = ({ t }: { t: string | null }) => (t ? <p className="mb-3 rounded-lg bg-[#f0fdf4] px-3 py-2 text-sm text-[#15803d]">{t}</p> : null)

/* ---------- Tableau de bord ---------- */

type Stats = { users: number; sims: number; online: number; today: number; waitlist: number; phones: number; reports: number; campaigns: number; messages: number; tikiPosts: number; ideas: number }
type Entry = { kind: string; text: string; at: string }

function Dashboard({ k, go }: { k: string; go: (t: Tab) => void }) {
  const [s, setS] = useState<Stats | null>(null)
  const [log, setLog] = useState<Entry[]>([])
  const [e, setE] = useState<string | null>(null)
  useEffect(() => {
    call<Stats>('/admin/stats', k).then(setS, (x: Error) => setE(x.message))
    call<Entry[]>('/admin/log', k).then((l) => setLog(l.slice(0, 12)), () => undefined)
  }, [k])
  const tiles: [string, number | undefined, string, Tab?][] = [
    ['Comptes', s?.users, `${nf(s?.today ?? 0)} connectés en 24 h`, 'joueurs'],
    ['En ligne', s?.online, `${nf(s?.sims ?? 0)} persos en tout`, 'joueurs'],
    ["Liste d'attente", s?.waitlist, `${nf(s?.phones ?? 0)} numéros WhatsApp`, 'liste'],
    ['Signalements', s?.reports, 'à traiter', 'signalements'],
    ['Pubs en attente', s?.campaigns, 'à vérifier', 'pub'],
    ['Idées des joueurs', s?.ideas, 'pas encore lues', 'idees'],
    ['Messages Gbairai', s?.messages, 'en 24 h'],
    ['Vidéos Tikitoko', s?.tikiPosts, 'en 24 h'],
  ]
  return (
    <>
      <Err e={e} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([label, n, sub, t]) => (
          <button key={label} disabled={!t} onClick={() => t && go(t)} className="rounded-xl border border-[#e5e7eb] bg-white p-4 text-left shadow-sm enabled:hover:border-[#fdba74]">
            <div className="text-xs font-medium text-[#6b7280]">{label}</div>
            <div className={`mt-1 text-3xl font-bold ${label === 'Signalements' && n ? 'text-[#dc2626]' : ''}`}>{n === undefined ? '…' : nf(n)}</div>
            <div className="mt-0.5 text-xs text-[#9ca3af]">{sub}</div>
          </button>
        ))}
      </div>
      <Card title="Dernières activités" className="mt-6" right={<Btn tone="light" onClick={() => go('journal')}>Tout le journal</Btn>}>
        <LogList entries={log} />
      </Card>
    </>
  )
}

/* ---------- Joueurs ---------- */

/** Djai for every Sim at once (a gift, a fix after a bug), with a word in each Sim's journal. */
function GiveMoney({ k, onDone }: { k: string; onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [sure, setSure] = useState(false)
  const [e, setE] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const n = Math.floor(Number(amount.replace(/\s/g, '')))
  const valid = Number.isFinite(n) && n >= 1 && n <= 10_000_000
  const give = async () => {
    setE(null)
    try {
      const r = await call<{ reached: number }>('/admin/money', k, { method: 'POST', body: JSON.stringify({ amount: n, note }) })
      setOk(`${nf(n)} Djai donnés à ${nf(r.reached)} persos.`)
      setAmount('')
      setNote('')
      setSure(false)
      onDone()
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Erreur')
    }
  }
  return (
    <Card title="Donner des Djai à tout le monde" className="mb-6">
      <p className="mb-3 text-sm text-[#6b7280]">Chaque perso reçoit le montant tout de suite, avec un message « Babi Life t'offre … » dans son téléphone. C'est noté dans le journal.</p>
      <Err e={e} />
      <Ok t={ok} />
      <div className="flex flex-wrap items-center gap-2">
        <Field className="!w-40" inputMode="numeric" placeholder="Montant (Djai)" value={amount} onChange={(x) => (setAmount(x.target.value), setSure(false), setOk(null))} />
        <Field className="!w-auto min-w-0 flex-1" placeholder="Un mot (facultatif) : Bonne fête de Tabaski !" maxLength={200} value={note} onChange={(x) => (setNote(x.target.value), setSure(false))} />
        {sure ? (
          <span className="flex items-center gap-2">
            <span className="text-sm text-[#374151]">{nf(n)} Djai à chaque perso ?</span>
            <Btn tone="light" onClick={() => setSure(false)}>
              Annuler
            </Btn>
            <Btn tone="orange" onClick={() => void give()}>
              Oui, donner
            </Btn>
          </span>
        ) : (
          <Btn tone="orange" disabled={!valid} onClick={() => setSure(true)}>
            Donner à tous
          </Btn>
        )}
      </div>
    </Card>
  )
}

/** Every player's perso grown up at once to an age (never younger), on its next turn, its birthdays said. */
function GrowAll({ k }: { k: string }) {
  const [sure, setSure] = useState<'enfant' | 'ado' | 'adulte' | null>(null)
  const [e, setE] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const LABEL = { enfant: 'Enfant (3 ans)', ado: 'Ado (12 ans)', adulte: 'Adulte (18 ans)' }
  const grow = async (stage: 'enfant' | 'ado' | 'adulte') => {
    setE(null)
    try {
      const r = await call<{ sims: number }>('/admin/grow', k, { method: 'POST', body: JSON.stringify({ stage }) })
      setOk(`${nf(r.sims)} persos passent à ${LABEL[stage].toLowerCase()} à leur prochain passage (ceux déjà plus âgés ne changent pas).`)
      setSure(null)
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Erreur')
    }
  }
  return (
    <Card title="Faire grandir tout le monde" className="mb-6">
      <p className="mb-3 text-sm text-[#6b7280]">
        Tous les persos des joueurs passent d'un coup à cet âge, à leur prochain passage dans le jeu : leurs anniversaires sont dits, le premier téléphone à 12 ans, et à 18 ans le départ de la maison avec l'argent de la famille. Personne ne rajeunit : un perso déjà plus âgé ne change pas.
      </p>
      <Err e={e} />
      <Ok t={ok} />
      {sure ? (
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-[#374151]">Tout le monde passe à {LABEL[sure].toLowerCase()} ?</span>
          <Btn tone="light" onClick={() => setSure(null)}>
            Annuler
          </Btn>
          <Btn tone="orange" onClick={() => void grow(sure)}>
            Oui, faire grandir
          </Btn>
        </span>
      ) : (
        <span className="flex flex-wrap gap-2">
          {(['enfant', 'ado', 'adulte'] as const).map((st) => (
            <Btn key={st} tone="light" onClick={() => (setSure(st), setOk(null))}>
              {LABEL[st]}
            </Btn>
          ))}
        </span>
      )}
    </Card>
  )
}

/** Before launch: every tester's perso back to just after it was created, the accounts made ordinary players. */
function ResetTesters({ k, onDone }: { k: string; onDone: () => void }) {
  const [sure, setSure] = useState(false)
  const [e, setE] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  // Only the toolbox taken away: every tester an ordinary player at once, the persos kept.
  const [sureRevoke, setSureRevoke] = useState(false)
  const revoke = async () => {
    setE(null)
    try {
      const r = await call<{ revoked: number }>('/admin/testers/revoke', k, { method: 'POST' })
      setOk(`${nf(r.revoked)} comptes ne sont plus testeurs. Leurs persos restent comme ils sont.`)
      setSureRevoke(false)
      onDone()
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Erreur')
    }
  }
  const reset = async () => {
    setE(null)
    try {
      const r = await call<{ reset: number }>('/admin/testers/reset', k, { method: 'POST' })
      setOk(`${nf(r.reset)} persos remis à zéro. Les comptes testeurs sont redevenus des joueurs normaux.`)
      setSure(false)
      onDone()
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Erreur')
    }
  }
  return (
    <Card title="Remettre les testeurs à zéro" className="mb-6">
      <p className="mb-3 text-sm text-[#6b7280]">
        Les persos des comptes qui ont entré le code testeur (et ceux sur qui la boîte à outils a servi) redeviennent comme juste après leur création : même nom, même look, même famille, même lieu de naissance, mais bébés, sans argent, sans terrain, sans paris, sans publications ni amis, le journal vidé. Les comptes perdent la boîte à outils. Ça ne s'annule pas.
      </p>
      <Err e={e} />
      <Ok t={ok} />
      {sure ? (
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-[#374151]">Tout effacer pour les testeurs ?</span>
          <Btn tone="light" onClick={() => setSure(false)}>
            Annuler
          </Btn>
          <Btn tone="orange" onClick={() => void reset()}>
            Oui, remettre à zéro
          </Btn>
        </span>
      ) : (
        <Btn tone="orange" onClick={() => (setSure(true), setOk(null))}>
          Remettre les testeurs à zéro
        </Btn>
      )}
      <div className="mt-4 border-t border-[#f3f4f6] pt-4">
        <p className="mb-3 text-sm text-[#6b7280]">Ou seulement retirer le statut testeur à tout le monde d'un coup (la boîte à outils et l'accès avant l'ouverture), sans toucher aux persos. Le compte officiel Babi Life le garde.</p>
        {sureRevoke ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[#374151]">Retirer tous les testeurs ?</span>
            <Btn tone="light" onClick={() => setSureRevoke(false)}>
              Annuler
            </Btn>
            <Btn tone="orange" onClick={() => void revoke()}>
              Oui, retirer
            </Btn>
          </span>
        ) : (
          <Btn tone="light" onClick={() => (setSureRevoke(true), setOk(null))}>
            Retirer tous les testeurs
          </Btn>
        )}
      </div>
    </Card>
  )
}

type Player = { id: string; name: string; username: string; email: string; google: boolean; password: boolean; createdAt: string; lastLogin: string; sims: number; sim: string; commune: string; money: number; online: boolean; tester: boolean; official?: boolean }

function Players({ k }: { k: string }) {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<{ users: Player[]; total: number } | null>(null)
  const [e, setE] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  // Bumped after Djai are given, for the new amounts.
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => call<{ users: Player[]; total: number }>(`/admin/users?q=${encodeURIComponent(q)}&page=${page}`, k).then(setData, (x: Error) => setE(x.message)), 250)
    return () => clearTimeout(t)
  }, [k, q, page, version])
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 50))
  return (
    <>
      <GiveMoney k={k} onDone={() => setVersion((v) => v + 1)} />
      <GrowAll k={k} />
      <ResetTesters k={k} onDone={() => setVersion((v) => v + 1)} />
      <Card>
        <Err e={e} />
        <Ok t={ok} />
        <p className="mb-3 text-xs text-[#6b7280]">
          Quelqu'un ne sait plus avec quoi il s'est connecté ? Cherche son nom, son pseudo, son e-mail ou le nom de son perso, puis « Envoyer ses identifiants » : il reçoit son adresse, son pseudo, s'il entre avec Google ou un mot de passe, et un lien pour choisir un mot de passe.
        </p>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-[#9ca3af]" />
            <Field className="!pl-9" placeholder="Chercher un nom, un pseudo, un e-mail, un perso…" value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} />
          </div>
          <span className="text-sm text-[#6b7280]">{nf(data?.total ?? 0)} comptes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-[#e5e7eb] text-xs text-[#6b7280] uppercase">
              <tr>
                <th className="py-2 pr-3 font-medium">Joueur</th>
                <th className="py-2 pr-3 font-medium">E-mail</th>
                <th className="py-2 pr-3 font-medium">Perso</th>
                <th className="py-2 pr-3 text-right font-medium">Argent</th>
                <th className="py-2 pr-3 font-medium">Inscrit</th>
                <th className="py-2 font-medium">Dernière connexion</th>
                <th className="py-2 pl-3 font-medium">Testeur</th>
              </tr>
            </thead>
            <tbody>
              {data?.users.map((u) => (
                <tr key={u.id} className="border-b border-[#f3f4f6] last:border-0">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2 font-medium">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${u.online ? 'bg-[#22c55e]' : 'bg-[#d1d5db]'}`} title={u.online ? 'En ligne' : 'Hors ligne'} />
                      {u.name}
                    </div>
                    {u.username && <div className="pl-4 text-xs text-[#6b7280]">@{u.username}</div>}
                  </td>
                  <td className="py-2.5 pr-3 text-[#374151]">
                    {u.email} {u.google && <span className="ml-1 rounded bg-[#eef2ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#4338ca]">Google</span>}
                    {u.password && <span className="ml-1 rounded bg-[#f0fdf4] px-1.5 py-0.5 text-[10px] font-semibold text-[#15803d]">mot de passe</span>}
                    {u.email.includes('@') && (
                      <button
                        className="ml-2 text-xs font-semibold text-[#ea580c] hover:underline"
                        title="Lui envoyer par e-mail comment il se connecte, avec un lien pour choisir un mot de passe"
                        onClick={() => (setE(null), setOk(null), call<{ text: string }>(`/admin/users/${u.id}/identifiants`, k, { method: 'POST', body: '{}' }).then((r) => setOk(r.text), (x: Error) => setE(x.message)))}
                      >
                        Envoyer ses identifiants
                      </button>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">{u.sim ? `${u.sim} · ${u.commune}` : <span className="text-[#9ca3af]">pas de perso</span>}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{u.sim ? `${nf(u.money)} F` : '—'}</td>
                  <td className="py-2.5 pr-3 text-[#6b7280]">{when(u.createdAt)}</td>
                  <td className="py-2.5 text-[#6b7280]">{when(u.lastLogin)}</td>
                <td className="py-2.5 pl-3">
                  <button
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${u.tester ? 'bg-[#ffedd5] text-[#c2410c]' : 'bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]'}`}
                    title={u.tester ? 'Retirer le compte testeur' : 'En faire un compte testeur (outils dans le jeu)'}
                    onClick={() => call(`/admin/users/${u.id}/tester`, k, { method: 'POST', body: JSON.stringify({ tester: !u.tester }) }).then(() => setVersion((v) => v + 1), (x: Error) => setE(x.message))}
                  >
                    {u.tester ? 'Testeur' : 'Non'}
                  </button>
                  <button
                    className={`ml-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${u.official ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]'}`}
                    title={u.official ? 'Retirer le compte officiel' : 'En faire le compte officiel Babi Life (boîte à outils pour de bon, badge « Officiel ✓ », jamais remis à zéro)'}
                    onClick={() => call(`/admin/users/${u.id}/official`, k, { method: 'POST', body: JSON.stringify({ official: !u.official }) }).then(() => setVersion((v) => v + 1), (x: Error) => setE(x.message))}
                  >
                    {u.official ? 'Officiel ✓' : 'Officiel ?'}
                  </button>
                </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.users.length === 0 && <p className="py-6 text-center text-sm text-[#6b7280]">Aucun compte.</p>}
        </div>
        {pages > 1 && (
          <div className="mt-4 flex items-center justify-end gap-2 text-sm">
            <Btn tone="light" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Précédent
            </Btn>
            <span className="text-[#6b7280]">
              {page + 1} / {pages}
            </span>
            <Btn tone="light" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
              Suivant
            </Btn>
          </div>
        )}
      </Card>
    </>
  )
}

/* ---------- Journal ---------- */

const KINDS: Record<string, [string, string]> = {
  inscription: ['Inscription', '#2563eb'],
  connexion: ['Connexion', '#64748b'],
  perso: ['Perso', '#7c3aed'],
  liste: ["Liste d'attente", '#0d9488'],
  signalement: ['Signalement', '#dc2626'],
  pub: ['Pub', '#ea580c'],
  admin: ['Équipe', '#111827'],
}

function LogList({ entries }: { entries: Entry[] }) {
  if (!entries.length) return <p className="text-sm text-[#6b7280]">Rien pour le moment.</p>
  return (
    <ul className="divide-y divide-[#f3f4f6]">
      {entries.map((x, i) => (
        <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm">
          <span className="w-28 shrink-0 text-xs text-[#9ca3af] tabular-nums">{when(x.at)}</span>
          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: KINDS[x.kind]?.[1] ?? '#6b7280' }}>
            {KINDS[x.kind]?.[0] ?? x.kind}
          </span>
          <span className="min-w-0 max-sm:basis-full">{x.text}</span>
        </li>
      ))}
    </ul>
  )
}

function Log({ k }: { k: string }) {
  const [kind, setKind] = useState('')
  const [list, setList] = useState<Entry[] | null>(null)
  const [e, setE] = useState<string | null>(null)
  const load = () => call<Entry[]>(`/admin/log?kind=${kind}`, k).then(setList, (x: Error) => setE(x.message))
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, kind])
  return (
    <Card
      right={
        <Btn tone="light" onClick={() => void load()}>
          <RefreshCw size={14} /> Actualiser
        </Btn>
      }
    >
      <Err e={e} />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {[['', 'Tout'], ...Object.entries(KINDS).map(([id, [l]]) => [id, l])].map(([id, l]) => (
          <button key={id} onClick={() => setKind(id)} className={`rounded-full px-3 py-1 text-xs font-semibold ${kind === id ? 'bg-[#111827] text-white' : 'bg-[#f3f4f6] text-[#374151] hover:bg-[#e5e7eb]'}`}>
            {l}
          </button>
        ))}
      </div>
      {list ? <LogList entries={list} /> : <p className="text-sm text-[#6b7280]">Chargement…</p>}
    </Card>
  )
}

/* ---------- Annonces ---------- */

function Announcements({ k }: { k: string }) {
  const [text, setText] = useState('')
  const [list, setList] = useState<{ id: number; text: string; reached: number; at: string }[]>([])
  const [e, setE] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [sure, setSure] = useState(false)
  const load = () => call<typeof list>('/admin/announcements', k).then(setList, (x: Error) => setE(x.message))
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k])
  const send = async () => {
    setE(null)
    try {
      const r = await call<{ reached: number }>('/admin/announcements', k, { method: 'POST', body: JSON.stringify({ text }) })
      setOk(`Annonce envoyée à ${nf(r.reached)} persos.`)
      setText('')
      setSure(false)
      void load()
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Erreur')
    }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card title="Nouvelle annonce">
        <p className="mb-3 text-sm text-[#6b7280]">Elle arrive dans le téléphone de chaque perso (appli Messages), signée « Babi Life », et s'affiche à la prochaine ouverture du jeu.</p>
        <Err e={e} />
        <Ok t={ok} />
        <textarea
          value={text}
          onChange={(x) => (setText(x.target.value.slice(0, 400)), setSure(false), setOk(null))}
          rows={5}
          placeholder="Ex. : Ce samedi, grand match au stade Félix-Houphouët-Boigny à 16 h ! Babi Sporting contre Yop City FC."
          className="w-full rounded-lg border border-[#d1d5db] p-3 text-sm outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20"
        />
        <div className="mt-2 flex items-center justify-between text-xs text-[#9ca3af]">
          <span>{text.length}/400</span>
          {sure ? (
            <span className="flex items-center gap-2">
              <span className="text-sm text-[#374151]">Envoyer à tout le monde ?</span>
              <Btn tone="light" onClick={() => setSure(false)}>
                Annuler
              </Btn>
              <Btn tone="orange" onClick={() => void send()}>
                <Send size={14} /> Oui, envoyer
              </Btn>
            </span>
          ) : (
            <Btn tone="orange" disabled={!text.trim()} onClick={() => setSure(true)}>
              <Send size={14} /> Envoyer à tous
            </Btn>
          )}
        </div>
      </Card>
      <Card title="Déjà envoyées">
        {list.length === 0 && <p className="text-sm text-[#6b7280]">Aucune annonce.</p>}
        <ul className="space-y-3">
          {list.map((a) => (
            <li key={a.id} className="text-sm">
              <p>{a.text}</p>
              <p className="mt-0.5 text-xs text-[#9ca3af]">
                {when(a.at)} · {nf(a.reached)} persos
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

/* ---------- Mises à jour ---------- */

type Update = { id: string; label: string; about: string; /** for the team only */ note?: string; open: boolean; opensAt: string | null; openedAt: string | null; live: boolean }

/** An ISO time as the date-time field wants it (local), and back. */
const toField = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function Updates({ k }: { k: string }) {
  const [list, setList] = useState<Update[]>([])
  const [e, setE] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [sure, setSure] = useState<string | null>(null)
  const [dates, setDates] = useState<Record<string, string>>({})
  // « Prévenir les joueurs » on opening one now: off by default (it can open silently), its words prefilled.
  const [notice, setNotice] = useState<{ send: boolean; title: string; body: string }>({ send: false, title: '', body: '' })
  const load = () => call<{ features: Update[] }>('/admin/features', k).then((r) => setList(r.features), (x: Error) => setE(x.message))
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k])
  const set = async (u: Update, open: boolean, opensAt: string | null, said: string) => {
    setE(null)
    setOk(null)
    try {
      const notify = open && notice.send ? notice : undefined
      const r = await call<{ features: Update[]; notice?: string }>(`/admin/features/${u.id}`, k, { method: 'POST', body: JSON.stringify({ open, opensAt: opensAt ? new Date(opensAt).toISOString() : '', notify }) })
      setList(r.features)
      setOk(`${u.label} : ${said}${r.notice ? `. ${r.notice}` : ''}`)
      setSure(null)
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Erreur')
    }
  }
  const live = list.filter((u) => u.live).length
  // Everything at once (the launch, or a test): each one opened, the list read back at the end.
  const openAll = async () => {
    setE(null)
    try {
      // (Not the game's opening itself: that one has its own day and hour.)
      for (const u of list.filter((x) => !x.live && x.id !== 'ouverture')) await call(`/admin/features/${u.id}`, k, { method: 'POST', body: JSON.stringify({ open: true, opensAt: '' }) })
      await load()
      setOk('Tout est ouvert.')
      setSure(null)
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Erreur')
    }
  }
  return (
    <div className="space-y-4">
      {live < list.length && (
        <div className="flex items-center gap-2">
          {sure === '*' ? (
            <>
              <span className="text-sm text-[#374151]">Ouvrir les {list.length - live} mises à jour fermées à tous les joueurs ?</span>
              <Btn tone="light" onClick={() => setSure(null)}>
                Annuler
              </Btn>
              <Btn tone="orange" onClick={() => void openAll()}>
                Oui, tout ouvrir
              </Btn>
            </>
          ) : (
            <Btn tone="light" onClick={() => setSure('*')}>
              Tout ouvrir
            </Btn>
          )}
        </div>
      )}
      <p className="text-sm text-[#6b7280]">
        Chaque nouveauté arrive fermée : les joueurs ne la voient pas (ni bouton, ni activité, ni appli) et le serveur la refuse. Ouvre-les une par une, maintenant ou à une date, pour que le jeu ait des mises à jour au fil des semaines. À l'ouverture, chaque joueur voit une fois « Nouveau dans Babi Life » avec le texte ci-dessous. Ouvertes : {live}/{list.length}.
      </p>
      <Err e={e} />
      <Ok t={ok} />
      <ul className="space-y-3">
        {list.map((u) => {
          const date = dates[u.id] ?? toField(u.opensAt)
          return (
            <li key={u.id}>
              <Card title={u.label}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#374151]">{u.about}</p>
                    {u.note && <p className="mt-1 text-xs font-semibold text-[#b45309]">{u.note}</p>}
                    <p className="mt-1 text-xs text-[#9ca3af]">
                      {u.live ? `Avec les joueurs${u.openedAt ? ` depuis le ${when(u.openedAt)}` : u.opensAt ? ` depuis le ${when(u.opensAt)}` : ''}` : u.opensAt ? `Fermée : ouvre toute seule le ${when(u.opensAt)}` : 'Fermée'}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${u.live ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#f3f4f6] text-[#6b7280]'}`}>{u.live ? 'Ouverte' : 'Fermée'}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {u.live ? (
                    sure === u.id ? (
                      <>
                        <span className="text-sm text-[#374151]">La retirer aux joueurs ?</span>
                        <Btn tone="light" onClick={() => setSure(null)}>
                          Annuler
                        </Btn>
                        <Btn tone="orange" onClick={() => void set(u, false, null, 'fermée')}>
                          Oui, fermer
                        </Btn>
                      </>
                    ) : (
                      <Btn tone="light" onClick={() => setSure(u.id)}>
                        Fermer
                      </Btn>
                    )
                  ) : sure === u.id ? (
                    <div className="w-full space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input type="checkbox" checked={notice.send} onChange={(x) => setNotice({ ...notice, send: x.target.checked })} />
                        Prévenir les joueurs (une notification à tous ceux qui les ont activées)
                      </label>
                      {notice.send && (
                        <div className="grid gap-2 rounded-lg border border-[#e5e7eb] p-3">
                          <Field maxLength={65} value={notice.title} onChange={(x) => setNotice({ ...notice, title: x.target.value })} placeholder="Titre" />
                          <textarea maxLength={240} rows={2} value={notice.body} onChange={(x) => setNotice({ ...notice, body: x.target.value })} className="w-full rounded-lg border border-[#d1d5db] p-2 text-sm outline-none focus:border-[#ea580c]" />
                          <p className="text-xs text-[#9ca3af]">Compte dans les envois du jour (onglet Notifications). Un toucher ouvre le jeu, ou l'appli de la mise à jour.</p>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-[#374151]">L'ouvrir à tous les joueurs maintenant ?</span>
                        <Btn tone="light" onClick={() => setSure(null)}>
                          Annuler
                        </Btn>
                        <Btn tone="orange" onClick={() => void set(u, true, null, 'ouverte')}>
                          Oui, ouvrir{notice.send ? ' et prévenir' : ''}
                        </Btn>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Btn tone="orange" onClick={() => (setSure(u.id), setNotice({ send: false, title: `Nouveau : ${u.label}`.slice(0, 65), body: u.about.slice(0, 240) }))}>
                        Ouvrir maintenant
                      </Btn>
                      <span className="text-sm text-[#6b7280]">ou le</span>
                      <input
                        type="datetime-local"
                        value={date}
                        onChange={(x) => setDates((d) => ({ ...d, [u.id]: x.target.value }))}
                        className="rounded-lg border border-[#d1d5db] px-2 py-1.5 text-sm outline-none focus:border-[#ea580c]"
                      />
                      <Btn tone="light" disabled={!date || new Date(date).getTime() <= Date.now()} onClick={() => void set(u, false, date, `programmée le ${when(new Date(date).toISOString())}`)}>
                        Programmer
                      </Btn>
                      {u.opensAt && (
                        <Btn tone="light" onClick={() => (setDates((d) => ({ ...d, [u.id]: '' })), void set(u, false, null, 'programmation annulée'))}>
                          Annuler la date
                        </Btn>
                      )}
                    </>
                  )}
                </div>
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ---------- Casino ---------- */

type OddsRate = { id: string; label: string; rate: number; natural: number; set: boolean; own: boolean; /** the lowest it can be set to */ min?: number }
type OddsState = { games: OddsRate[]; level: number | null; history: { game: string; rate: number | null; at: string }[]; min: number; max: number }
const pc = (r: number) => `${(Math.round(r * 1000) / 10).toLocaleString('fr-FR')} %`

function Casino({ k }: { k: string }) {
  const [st, setSt] = useState<OddsState | null>(null)
  const [e, setE] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [level, setLevel] = useState(85)
  const [typed, setTyped] = useState<Record<string, string>>({})
  useEffect(() => {
    call<OddsState>('/admin/casino', k).then(
      (x) => (setSt(x), x.level !== null && setLevel(Math.round(x.level * 1000) / 10)),
      (x: Error) => setE(x.message),
    )
  }, [k])
  const set = async (game: string, rate: number | null, said: string) => {
    setE(null)
    setOk(null)
    try {
      setSt(await call<OddsState>(`/admin/casino/${encodeURIComponent(game)}`, k, { method: 'POST', body: JSON.stringify({ rate }) }))
      setOk(said)
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Erreur')
    }
  }
  if (!st) return <Err e={e} />
  const name = (id: string) => (id === '*' ? 'Tous les jeux' : (st.games.find((g) => g.id === id)?.label ?? id))
  const lo = st.min * 100
  const hi = st.max * 100
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#6b7280]">
        Le taux de retour, c'est ce qu'un jeu rend en moyenne pour 100 Djai misés : le reste, la maison le garde. Il est le même pour tous les joueurs, compte dès la prochaine partie (une partie commencée garde le sien) et s'affiche dans les règles de chaque jeu : on ne le cache pas, les joueurs
        peuvent acheter leurs Djai avec de l'argent réel. De {pc(st.min)} à {pc(st.max)} ; la roulette pas sous 50 %, le 21 et Babi Trade pas sous 55 % (en dessous ils ne pourraient plus rendre le taux annoncé) : un niveau pour tous plus bas les laisse à leur minimum, et c'est celui-là qu'ils affichent.
      </p>
      <Err e={e} />
      <Ok t={ok} />
      <Card title="Le niveau pour tous les jeux">
        <p className="mb-3 text-sm text-[#6b7280]">Il s'applique à chaque jeu qui n'a pas son propre réglage. {st.level === null ? "Aucun niveau : chaque jeu rend ce qu'il rendait d'origine." : `Niveau actuel : ${pc(st.level)}.`}</p>
        <div className="flex flex-wrap items-center gap-3">
          <input type="range" min={lo} max={hi} step={0.5} value={level} onChange={(x) => setLevel(Number(x.target.value))} className="w-64 accent-[#ea580c]" />
          <span className="w-16 text-sm font-bold">{level.toLocaleString('fr-FR')} %</span>
          <Btn tone="orange" onClick={() => void set('*', level / 100, `Niveau pour tous les jeux : ${level.toLocaleString('fr-FR')} %`)}>
            Appliquer à tous
          </Btn>
          {st.level !== null && (
            <Btn tone="light" onClick={() => void set('*', null, "Niveau retiré : chaque jeu rend ce qu'il rendait d'origine (sauf ceux réglés à part)")}>
              Retirer le niveau
            </Btn>
          )}
        </div>
      </Card>
      <Card title="Jeu par jeu">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#6b7280]">
                <th className="py-2">Jeu</th>
                <th>D'origine</th>
                <th>Maintenant</th>
                <th>Régler ce jeu</th>
              </tr>
            </thead>
            <tbody>
              {st.games.map((g) => {
                const v = typed[g.id] ?? ''
                const n = Number(v.replace(',', '.'))
                const gl = (g.min ?? st.min) * 100
                const good = v !== '' && n >= gl && n <= hi
                return (
                  <tr key={g.id} className="border-t border-[#f3f4f6]">
                    <td className="py-2 font-medium">{g.label}</td>
                    <td className="text-[#6b7280]">{pc(g.natural)}</td>
                    <td>
                      <span className="font-bold">{pc(g.rate)}</span>
                      <span className="ml-1.5 text-xs text-[#9ca3af]">{g.own ? 'réglé à part' : g.set ? 'niveau pour tous' : "d'origine"}</span>
                    </td>
                    <td>
                      <span className="flex flex-wrap items-center gap-1.5 py-1">
                        <input
                          value={v}
                          onChange={(x) => setTyped((t) => ({ ...t, [g.id]: x.target.value }))}
                          placeholder={`${gl}–${hi}`}
                          inputMode="decimal"
                          className="w-20 rounded-lg border border-[#d1d5db] px-2 py-1 outline-none focus:border-[#ea580c]"
                        />
                        <span className="text-xs text-[#6b7280]">%</span>
                        <Btn tone="light" disabled={!good} onClick={() => (setTyped((t) => ({ ...t, [g.id]: '' })), void set(g.id, n / 100, `${g.label} : ${n.toLocaleString('fr-FR')} %`))}>
                          Appliquer
                        </Btn>
                        {g.own && (
                          <Btn tone="light" onClick={() => void set(g.id, null, `${g.label} : suit le niveau pour tous`)}>
                            Remettre
                          </Btn>
                        )}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[#9ca3af]">
          Machines, tickets et bingo : leurs gains sont mis à l'échelle. L'Envol part plus ou moins tôt. Babi Trade paie 2 × le taux. Roulette et 21 gardent leurs gains habituels, moins une commission de la maison sur le gain net, dite au joueur à chaque résultat.
        </p>
      </Card>
      <Card title="Les derniers changements">
        {st.history.length === 0 && <p className="text-sm text-[#6b7280]">Aucun changement : chaque jeu rend ce qu'il rendait d'origine.</p>}
        <ul className="space-y-1.5">
          {st.history.map((c, i) => (
            <li key={i} className="text-sm">
              <span className="text-[#9ca3af]">{when(c.at)}</span> · {name(c.game)} : <span className="font-bold">{c.rate === null ? (c.game === '*' ? 'niveau retiré' : 'suit le niveau pour tous') : pc(c.rate)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

/* ---------- WhatsApp ---------- */

type WaCampaign = { id: number; template: string; audience: string; total: number; sent: number; failed: number; status: 'running' | 'scheduled' | 'done' | 'stopped'; at: string; errors?: string[]; sendAt?: string }
type WaState = { configured: boolean; numbers: number; beta: number; optouts: number; campaigns: WaCampaign[]; list?: { firstName: string; contact: string; beta: boolean }[] }

function WhatsApp({ k }: { k: string }) {
  const [st, setSt] = useState<WaState | null>(null)
  const [e, setE] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [template, setTemplate] = useState('')
  const [lang, setLang] = useState('fr')
  const [audience, setAudience] = useState<'liste' | 'beta'>('liste')
  const [test, setTest] = useState('')
  const [sure, setSure] = useState(false)
  const [optout, setOptout] = useState('')
  const [manual, setManual] = useState(false)
  // Later, by itself: the day and hour (the game's opening, say), else now.
  const [later, setLater] = useState('')
  const [text, setText] = useState("Bonjour {prénom} ! Babi Life ouvre bientôt : ta vie à Abidjan, dans ton téléphone. On te prévient dès que c'est prêt. (Réponds STOP pour ne plus recevoir de message.)")
  const load = () => call<WaState>(`/admin/whatsapp${manual ? '?numbers=1' : ''}`, k).then(setSt, (x: Error) => setE(x.message))
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, manual])
  // While a campaign runs, its progress every 3 s.
  const running = st?.campaigns.some((c) => c.status === 'running')
  useEffect(() => {
    if (!running) return
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])
  const post = async (body: object, done: (r: { text?: string; total?: number }) => string) => {
    setE(null)
    setOk(null)
    try {
      const r = await call<{ text?: string; total?: number }>('/admin/whatsapp', k, { method: 'POST', body: JSON.stringify(body) })
      setOk(done(r))
      setSure(false)
      void load()
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Erreur')
    }
  }
  const target = audience === 'beta' ? st?.beta ?? 0 : st?.numbers ?? 0
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Card title="Envoyer à la liste d'attente">
          <Err e={e} />
          <Ok t={ok} />
          <p className="mb-4 rounded-lg bg-[#fffbeb] px-3 py-2 text-xs text-[#92400e]">
            Les inscrits ont donné leur numéro « pour être prévenus de l'ouverture », pas pour de la pub : envoie seulement des nouvelles du jeu (ouverture, invitation à tester). Ceux qui répondent STOP vont dans la liste « ne plus écrire ».
          </p>
          {!st?.configured ? (
            <div className="rounded-lg border border-dashed border-[#d1d5db] p-4 text-sm text-[#374151]">
              <p className="font-semibold">L'API WhatsApp n'est pas branchée.</p>
              <p className="mt-1 text-[#6b7280]">
                Pour envoyer à tout le monde d'un coup : un compte WhatsApp Business sur Meta, un modèle de message approuvé, puis <code>WHATSAPP_TOKEN</code> et <code>WHATSAPP_PHONE_ID</code> sur Render. En attendant, envoie à la main avec les liens ci-dessous.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Modèle approuvé (nom dans WhatsApp Manager)
                <Field className="mt-1" placeholder="ouverture_babi" value={template} onChange={(x) => (setTemplate(x.target.value.trim()), setSure(false))} />
              </label>
              <label className="text-sm font-medium">
                Langue du modèle
                <Field className="mt-1" placeholder="fr" value={lang} onChange={(x) => setLang(x.target.value.trim())} />
              </label>
              <p className="text-xs text-[#6b7280] sm:col-span-2">Le {'{{1}}'} du modèle est remplacé par le prénom de chacun.</p>
              <div className="flex gap-2 sm:col-span-2">
                <Field placeholder="Ton numéro pour un test (+225…)" value={test} onChange={(x) => setTest(x.target.value)} />
                <Btn tone="light" disabled={!template || !test} onClick={() => void post({ template, lang, test }, (r) => r.text ?? 'Envoyé.')}>
                  Tester
                </Btn>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-[#f3f4f6] pt-3 sm:col-span-2">
                <select value={audience} onChange={(x) => (setAudience(x.target.value as 'liste' | 'beta'), setSure(false))} className="rounded-lg border border-[#d1d5db] px-3 py-2 text-sm">
                  <option value="liste">Toute la liste ({nf(st.numbers)})</option>
                  <option value="beta">Ceux qui veulent tester ({nf(st.beta)})</option>
                </select>
                {sure ? (
                  <>
                    <span className="text-sm">
                      {later ? `Programmer « ${template} » pour le ${when(new Date(later).toISOString())} ?` : `Envoyer « ${template} » à ${nf(target)} numéros ?`}
                    </span>
                    <Btn tone="light" onClick={() => setSure(false)}>
                      Annuler
                    </Btn>
                    <Btn tone="orange" onClick={() => void post(later ? { template, lang, audience, at: new Date(later).toISOString() } : { template, lang, audience }, (r) => (later ? `Envoi programmé : il partira tout seul le ${when(new Date(later).toISOString())}.` : `Envoi lancé : ${nf(r.total ?? 0)} numéros.`))}>
                      <Send size={14} /> {later ? 'Oui, programmer' : 'Oui, envoyer'}
                    </Btn>
                  </>
                ) : (
                  <Btn tone="orange" disabled={!template || !target || (running && !later)} onClick={() => setSure(true)}>
                    <Send size={14} /> {later ? 'Programmer' : `Envoyer à ${nf(target)} numéros`}
                  </Btn>
                )}
                <label className="flex items-center gap-2 text-sm text-[#374151]">
                  ou le
                  <input type="datetime-local" value={later} onChange={(x) => (setLater(x.target.value), setSure(false))} className="rounded-lg border border-[#d1d5db] px-2 py-1.5 text-sm" />
                </label>
                <p className="w-full text-xs text-[#6b7280]">Programmé, il part tout seul à l'heure dite (par exemple à l'ouverture du jeu), aux numéros qui ne l'ont pas encore reçu.</p>
              </div>
            </div>
          )}
        </Card>

        {!!st?.campaigns.length && (
          <Card title="Envois">
            <ul className="space-y-4">
              {st.campaigns.map((c) => (
                <li key={c.id} className="text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {c.template} · {c.audience === 'beta' ? 'testeurs' : 'toute la liste'}
                    </span>
                    <span className="text-xs text-[#9ca3af]">{when(c.at)}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#f3f4f6]">
                    <i className="block h-full bg-[#16a34a]" style={{ width: `${((c.sent + c.failed) / Math.max(1, c.total)) * 100}%` }} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-[#6b7280]">
                    <span>
                      {nf(c.sent)} envoyés · {nf(c.failed)} échecs · {nf(c.total)} en tout · {c.status === 'running' ? 'en cours…' : c.status === 'scheduled' ? `programmé le ${c.sendAt ? when(c.sendAt) : ''}` : c.status === 'stopped' ? 'arrêté' : 'terminé'}
                    </span>
                    {(c.status === 'running' || c.status === 'scheduled') && (
                      <button className="font-semibold text-[#dc2626]" onClick={() => void call(`/admin/whatsapp/${c.id}/stop`, k, { method: 'POST', body: '{}' }).then(load)}>
                        Arrêter
                      </button>
                    )}
                  </div>
                  {c.errors?.map((x) => (
                    <p key={x} className="mt-1 text-xs text-[#b91c1c]">
                      {x}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card title="Envoyer à la main" right={<Btn tone="light" onClick={() => setManual(!manual)}>{manual ? 'Masquer' : 'Afficher les numéros'}</Btn>}>
          <p className="text-sm text-[#6b7280]">Sans l'API : chaque lien ouvre WhatsApp avec ton message déjà écrit pour la personne ; tu n'as qu'à appuyer sur Envoyer. {'{prénom}'} est remplacé.</p>
          {manual && (
            <>
              <textarea value={text} onChange={(x) => setText(x.target.value)} rows={3} className="mt-3 w-full rounded-lg border border-[#d1d5db] p-3 text-sm" />
              <ul className="mt-3 max-h-[420px] divide-y divide-[#f3f4f6] overflow-y-auto">
                {st?.list?.map((p) => (
                  <li key={p.contact} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>
                      {p.firstName} <span className="text-[#9ca3af]">{p.contact}</span> {p.beta && <span className="ml-1 rounded bg-[#ecfeff] px-1.5 text-[10px] font-semibold text-[#0e7490]">testeur</span>}
                    </span>
                    <a className="inline-flex items-center gap-1 font-semibold text-[#16a34a]" target="_blank" rel="noreferrer" href={`https://wa.me/${p.contact.replace(/\D/g, '')}?text=${encodeURIComponent(text.replaceAll('{prénom}', p.firstName))}`}>
                      Ouvrir <ExternalLink size={13} />
                    </a>
                  </li>
                ))}
              </ul>
              {st?.list?.length === 0 && <p className="mt-3 text-sm text-[#6b7280]">Aucun numéro WhatsApp sur la liste.</p>}
            </>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Numéros">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-2xl font-bold">{nf(st?.numbers ?? 0)}</div>
              <div className="text-xs text-[#6b7280]">WhatsApp</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{nf(st?.beta ?? 0)}</div>
              <div className="text-xs text-[#6b7280]">testeurs</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{nf(st?.optouts ?? 0)}</div>
              <div className="text-xs text-[#6b7280]">STOP</div>
            </div>
          </div>
        </Card>
        <Card title="Ne plus écrire à…">
          <p className="mb-3 text-sm text-[#6b7280]">Quelqu'un a répondu STOP ? Ajoute son numéro : il ne recevra plus rien.</p>
          <div className="flex gap-2">
            <Field placeholder="+225…" value={optout} onChange={(x) => setOptout(x.target.value)} />
            <Btn
              tone="light"
              disabled={!optout}
              onClick={() =>
                void call('/admin/whatsapp/optout', k, { method: 'POST', body: JSON.stringify({ contact: optout }) }).then(
                  () => (setOptout(''), setOk('Numéro retiré de la liste.'), void load()),
                  (x: Error) => setE(x.message),
                )
              }
            >
              Retirer
            </Btn>
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ---------- E-mails ---------- */

type MailTemplate = { id: string; label: string; use: string; subject: string; preheader: string; tagline: string; title: string; text: string; button?: string; link?: string; note?: string; system?: boolean; image?: string; imageAlt?: string; video?: string; poster?: string }
type MailCampaign = { id: number; template: string; subject: string; audience: string; total: number; sent: number; failed: number; status: 'running' | 'done' | 'stopped'; at: string; errors?: string[] }
type MailState = { configured: boolean; counts: Record<string, number>; audiences: Record<string, string>; optouts: number; templates: MailTemplate[]; campaigns: MailCampaign[] }
type Words = Pick<MailTemplate, 'subject' | 'preheader' | 'title' | 'text' | 'button' | 'link' | 'note' | 'image' | 'imageAlt' | 'video' | 'poster'>
const AUDIENCES = ['liste', 'beta', 'joueurs', 'testeurs', 'tous']

function Emails({ k }: { k: string }) {
  const [st, setSt] = useState<MailState | null>(null)
  const [e, setE] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [pick, setPick] = useState('sortie')
  // The words of each model, as changed here (kept when going from one to another).
  const [edits, setEdits] = useState<Record<string, Words>>({})
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null)
  const [audience, setAudience] = useState('liste')
  const [test, setTest] = useState('')
  const [sure, setSure] = useState(false)
  const [optout, setOptout] = useState('')
  const load = () => call<MailState>(`/admin/email?template=${pick}`, k).then(setSt, (x: Error) => setE(x.message))
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, pick])
  const running = st?.campaigns.some((c) => c.status === 'running')
  useEffect(() => {
    if (!running) return
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])
  const tpl = st?.templates.find((t) => t.id === pick)
  const words: Words | null = tpl ? (edits[pick] ?? { subject: tpl.subject, preheader: tpl.preheader, title: tpl.title, text: tpl.text, button: tpl.button ?? '', link: tpl.link ?? '', note: tpl.note ?? '' }) : null
  const set = (f: keyof Words, v: string) => words && (setEdits({ ...edits, [pick]: { ...words, [f]: v } }), setSure(false))
  const setMany = (w: Partial<Words>) => words && (setEdits({ ...edits, [pick]: { ...words, ...w } }), setSure(false))
  // The e-mail as it will arrive, a moment after the words stop changing.
  useEffect(() => {
    if (!tpl || !words) return
    const t = setTimeout(() => {
      call<{ subject: string; html: string }>('/admin/email/preview', k, { method: 'POST', body: JSON.stringify({ template: pick, words }) }).then(
        (p) => (setPreview(p), setE(null)),
        (x: Error) => setE(x.message),
      )
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick, JSON.stringify(words), st?.templates.length])
  const post = async (body: object, done: (r: { text?: string; total?: number }) => string) => {
    setE(null)
    setOk(null)
    try {
      const r = await call<{ text?: string; total?: number }>('/admin/email', k, { method: 'POST', body: JSON.stringify(body) })
      setOk(done(r))
      setSure(false)
      void load()
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Erreur')
    }
  }
  const target = st?.counts[audience] ?? 0
  return (
    <div className="space-y-6">
      <Card title="Les modèles">
        <p className="mb-3 text-sm text-[#6b7280]">Tous les e-mails du jeu, dans son style. Choisis-en un, change ses mots si besoin : l'aperçu montre l'e-mail tel qu'il arrivera. {'{prénom}'} est remplacé par le prénom de chacun.</p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {st?.templates.map((t) => (
            <button key={t.id} onClick={() => (setPick(t.id), setSure(false))} className={`rounded-lg border p-3 text-left ${pick === t.id ? 'border-[#ea580c] bg-[#fff7ed]' : 'border-[#e5e7eb] hover:bg-[#f9fafb]'}`}>
              <div className="flex items-center justify-between gap-2 text-sm font-semibold">
                {t.label}
                {t.system && <span className="rounded bg-[#f3f4f6] px-1.5 text-[10px] font-semibold text-[#6b7280]">envoyé par le jeu</span>}
              </div>
              <div className="mt-1 text-xs text-[#6b7280]">{t.use}</div>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_minmax(360px,560px)]">
        <div className="space-y-6">
          {tpl && words && (
            <Card title={tpl.system ? `${tpl.label} (envoyé par le jeu)` : `Écrire : ${tpl.label}`} right={!tpl.system && edits[pick] ? <Btn tone="light" onClick={() => setEdits({ ...edits, [pick]: undefined as unknown as Words })}>Remettre le texte du modèle</Btn> : undefined}>
              <Err e={e} />
              <Ok t={ok} />
              {tpl.system ? (
                <p className="text-sm text-[#6b7280]">Celui-là part tout seul quand quelqu'un demande un nouveau mot de passe : il ne s'envoie pas d'ici. L'aperçu le montre tel qu'il arrive.</p>
              ) : (
                <div className="grid gap-3">
                  <label className="text-sm font-medium">
                    Objet
                    <Field className="mt-1" maxLength={150} value={words.subject} onChange={(x) => set('subject', x.target.value)} />
                  </label>
                  <label className="text-sm font-medium">
                    La ligne à côté de l'objet (aperçu dans la boîte mail)
                    <Field className="mt-1" maxLength={200} value={words.preheader} onChange={(x) => set('preheader', x.target.value)} />
                  </label>
                  <label className="text-sm font-medium">
                    Titre
                    <Field className="mt-1" maxLength={80} value={words.title} onChange={(x) => set('title', x.target.value)} />
                  </label>
                  <label className="text-sm font-medium">
                    Texte (une ligne vide entre deux paragraphes)
                    <textarea maxLength={5000} rows={8} value={words.text} onChange={(x) => set('text', x.target.value)} className="mt-1 w-full rounded-lg border border-[#d1d5db] p-3 text-sm outline-none focus:border-[#ea580c]" />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-medium">
                      Bouton (vide : pas de bouton)
                      <Field className="mt-1" maxLength={40} value={words.button ?? ''} onChange={(x) => set('button', x.target.value)} />
                    </label>
                    <label className="text-sm font-medium">
                      Lien du bouton (/jeu, ou https://…)
                      <Field className="mt-1" maxLength={300} value={words.link ?? ''} onChange={(x) => set('link', x.target.value)} />
                    </label>
                  </div>
                  <label className="text-sm font-medium">
                    Encadré (l'ardoise, facultatif)
                    <Field className="mt-1" maxLength={400} value={words.note ?? ''} onChange={(x) => set('note', x.target.value)} />
                  </label>
                  <MailMedia k={k} words={words} set={setMany} />
                </div>
              )}
            </Card>
          )}

          {tpl && !tpl.system && (
            <Card title="Envoyer">
              {!st?.configured ? (
                <div className="rounded-lg border border-dashed border-[#d1d5db] p-4 text-sm text-[#374151]">
                  <p className="font-semibold">L'e-mail n'est pas branché sur l'API.</p>
                  <p className="mt-1 text-[#6b7280]">
                    Sur Render (service API) : <code>BREVO_API_KEY</code> et <code>MAIL_FROM</code>, puis redéployer.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  <div className="flex gap-2">
                    <Field type="email" placeholder="Ton adresse pour un test" value={test} onChange={(x) => setTest(x.target.value)} />
                    <Btn tone="light" disabled={!test.includes('@')} onClick={() => void post({ template: pick, words, test }, (r) => r.text ?? 'Envoyé.')}>
                      Tester
                    </Btn>
                  </div>
                  <p className="rounded-lg bg-[#fffbeb] px-3 py-2 text-xs text-[#92400e]">
                    Seulement des nouvelles du jeu (sortie, nouveautés, événements), jamais de pub : les gens se sont inscrits pour être prévenus. Chaque e-mail a son lien « Ne plus recevoir ces e-mails ». Le plan gratuit de Brevo envoie 300 e-mails par jour : au-delà, les suivants échouent. Relance le même modèle le lendemain : il repart où il s'était arrêté (personne ne le reçoit deux fois). Les nombres ci-dessous comptent ceux qui ne l'ont pas encore reçu.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 border-t border-[#f3f4f6] pt-3">
                    <select value={audience} onChange={(x) => (setAudience(x.target.value), setSure(false))} className="rounded-lg border border-[#d1d5db] px-3 py-2 text-sm">
                      {AUDIENCES.map((a) => (
                        <option key={a} value={a}>
                          {st.audiences[a]} ({nf(st.counts[a] ?? 0)})
                        </option>
                      ))}
                    </select>
                    {sure ? (
                      <>
                        <span className="text-sm">
                          Envoyer « {words?.subject} » à {nf(target)} adresses ?
                        </span>
                        <Btn tone="light" onClick={() => setSure(false)}>
                          Annuler
                        </Btn>
                        <Btn tone="orange" onClick={() => void post({ template: pick, words, audience }, (r) => `Envoi lancé : ${nf(r.total ?? 0)} adresses.`)}>
                          <Send size={14} /> Oui, envoyer
                        </Btn>
                      </>
                    ) : (
                      <Btn tone="orange" disabled={!target || running} onClick={() => setSure(true)}>
                        <Send size={14} /> Envoyer à {nf(target)} adresses
                      </Btn>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}

          {!!st?.campaigns.length && (
            <Card title="Envois">
              <ul className="space-y-4">
                {st.campaigns.map((c) => (
                  <li key={c.id} className="text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {c.subject} · {st.audiences[c.audience] ?? c.audience}
                      </span>
                      <span className="text-xs text-[#9ca3af]">{when(c.at)}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#f3f4f6]">
                      <i className="block h-full bg-[#16a34a]" style={{ width: `${((c.sent + c.failed) / Math.max(1, c.total)) * 100}%` }} />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-[#6b7280]">
                      <span>
                        {nf(c.sent)} envoyés · {nf(c.failed)} échecs · {nf(c.total)} en tout · {c.status === 'running' ? 'en cours…' : c.status === 'stopped' ? 'arrêté' : 'terminé'}
                      </span>
                      {c.status === 'running' && (
                        <button className="font-semibold text-[#dc2626]" onClick={() => void call(`/admin/email/${c.id}/stop`, k, { method: 'POST', body: '{}' }).then(load)}>
                          Arrêter
                        </button>
                      )}
                    </div>
                    {c.errors?.map((x) => (
                      <p key={x} className="mt-1 text-xs text-[#b91c1c]">
                        {x}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Ne plus écrire à…">
            <p className="mb-3 text-sm text-[#6b7280]">
              Quelqu'un demande à ne plus recevoir d'e-mails autrement que par le lien ? Ajoute son adresse. ({nf(st?.optouts ?? 0)} désinscrits)
            </p>
            <div className="flex gap-2">
              <Field type="email" placeholder="adresse@exemple.com" value={optout} onChange={(x) => setOptout(x.target.value)} />
              <Btn
                tone="light"
                disabled={!optout.includes('@')}
                onClick={() =>
                  void call('/admin/email/optout', k, { method: 'POST', body: JSON.stringify({ email: optout }) }).then(
                    () => (setOptout(''), setOk('Adresse retirée : elle ne recevra plus rien.'), void load()),
                    (x: Error) => setE(x.message),
                  )
                }
              >
                Retirer
              </Btn>
            </div>
          </Card>
        </div>

        <Card title="Aperçu" className="xl:sticky xl:top-6 xl:self-start">
          {preview ? (
            <>
              <div className="mb-2 text-sm">
                <span className="text-[#6b7280]">Objet : </span>
                <span className="font-semibold">{preview.subject}</span>
              </div>
              <iframe title="Aperçu de l'e-mail" srcDoc={preview.html} sandbox="" className="h-[760px] w-full rounded-lg border border-[#e5e7eb] bg-white" />
            </>
          ) : (
            <p className="text-sm text-[#6b7280]">Chargement…</p>
          )}
        </Card>
      </div>
    </div>
  )
}

/* ---------- Médias des campagnes ---------- */

type Uploaded = { id: string; kind: 'image' | 'video'; url: string; page?: string }

/** A picture or a video straight into the bucket (backend admin/media.go), its progress told. */
async function uploadMedia(k: string, file: Blob, type: string, title: string, progress?: (p: number) => void): Promise<Uploaded> {
  const up = await call<Uploaded & { put: string }>('/admin/media', k, { method: 'POST', body: JSON.stringify({ type, size: file.size, title }) })
  await new Promise<void>((resolve, reject) => {
    const x = new XMLHttpRequest()
    x.open('PUT', up.put)
    x.setRequestHeader('Content-Type', type)
    x.upload.onprogress = (ev) => ev.lengthComputable && progress?.(ev.loaded / ev.total)
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error("L'envoi du fichier a échoué : réessaie.")))
    x.onerror = () => reject(new Error("L'envoi du fichier a échoué : vérifie ta connexion (ou les règles CORS du bucket)."))
    x.send(file)
  })
  return up
}

/**
 * A video's poster for an e-mail: a frame of the video (or the picture
 * given), as wide as the e-mail, with a play button drawn on it (mail apps
 * can't lay one over a picture), as a JPEG.
 */
async function posterOf(file: File): Promise<Blob> {
  const src = URL.createObjectURL(file)
  try {
    const el: HTMLVideoElement | HTMLImageElement = await new Promise((resolve, reject) => {
      if (file.type.startsWith('video/')) {
        const v = document.createElement('video')
        v.muted = true
        v.playsInline = true
        v.preload = 'auto'
        v.onloadedmetadata = () => (v.currentTime = Math.min(1, (v.duration || 2) / 3))
        v.onseeked = () => resolve(v)
        v.onerror = () => reject(new Error('Vidéo illisible : envoie un MP4.'))
        v.src = src
      } else {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = () => reject(new Error('Image illisible.'))
        i.src = src
      }
    })
    const w0 = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth
    const h0 = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight
    const w = Math.min(1032, w0 || 1032)
    const h = Math.round((w * (h0 || 581)) / (w0 || 1032))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')!
    g.drawImage(el, 0, 0, w, h)
    // The play button: a dark disc, a light triangle.
    const r = Math.max(28, Math.min(w, h) * 0.13)
    g.fillStyle = 'rgba(43, 29, 20, 0.78)'
    g.beginPath()
    g.arc(w / 2, h / 2, r, 0, Math.PI * 2)
    g.fill()
    g.lineWidth = Math.max(3, r * 0.08)
    g.strokeStyle = '#fbf5e6'
    g.stroke()
    g.fillStyle = '#fbf5e6'
    g.beginPath()
    g.moveTo(w / 2 - r * 0.32, h / 2 - r * 0.45)
    g.lineTo(w / 2 + r * 0.5, h / 2)
    g.lineTo(w / 2 - r * 0.32, h / 2 + r * 0.45)
    g.closePath()
    g.fill()
    return await new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("L'image n'a pas pu être faite."))), 'image/jpeg', 0.85))
  } finally {
    URL.revokeObjectURL(src)
  }
}

const IMAGE_TYPES = 'image/jpeg,image/png,image/webp'

/** Choosing a picture: sent at once, its address given back. */
function ImagePick({ k, url, onChange, label = 'Ajouter une image' }: { k: string; url: string; onChange: (url: string) => void; label?: string }) {
  const [p, setP] = useState<number | null>(null)
  const [e, setE] = useState<string | null>(null)
  const pick = async (f: File | undefined) => {
    if (!f) return
    setE(null)
    try {
      setP(0)
      const up = await uploadMedia(k, f, f.type, f.name, setP)
      onChange(up.url)
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Erreur')
    } finally {
      setP(null)
    }
  }
  return (
    <div>
      {url ? (
        <div className="flex items-start gap-3">
          <img src={url} alt="" className="h-20 w-32 rounded-lg border border-[#e5e7eb] object-cover" />
          <Btn tone="light" onClick={() => onChange('')}>
            <Trash2 size={14} /> Retirer
          </Btn>
        </div>
      ) : (
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-[#d1d5db] px-3.5 py-2 text-sm font-semibold hover:bg-[#f9fafb]">
          <ImagePlus size={15} /> {p !== null ? `Envoi… ${Math.round(p * 100)} %` : label}
          <input type="file" accept={IMAGE_TYPES} className="hidden" disabled={p !== null} onChange={(x) => void pick(x.target.files?.[0])} />
        </label>
      )}
      <p className="mt-1 text-xs text-[#9ca3af]">JPG, PNG ou WebP, 5 Mo au plus.</p>
      {e && <p className="mt-1 text-xs text-[#b91c1c]">{e}</p>}
    </div>
  )
}

/* ---------- Notifications ---------- */

type PushCampaign = { id: number; title: string; body: string; image?: string; url: string; audience: string; detail?: string; source: string; test: boolean; total: number; sent: number; failed: number; devices: number; status: 'running' | 'done' | 'stopped'; at: string }
type PushStatus = {
  web?: boolean
  app?: boolean
  subs?: { web: number; app: number; users: number }
  audiences: Record<string, string>
  counts: Record<string, number>
  communes: { id: string; name: string; players: number }[]
  campaigns: PushCampaign[]
  today: number
  tests: number
  limit: number
  testsLimit: number
}
const PUSH_AUDIENCES = ['tous', 'actifs', 'commune', 'adultes', 'testeurs']
// Pages of the game a tap can open (backend admin/notify.go: a page of the site only).
const PUSH_LINKS: [string, string][] = [
  ['/jeu', 'Le jeu'],
  ['/jeu?app=gbairai', 'Gbairai'],
  ['/jeu?app=bet225', 'Bet225'],
  ['/jeu?app=boutique', 'La boutique'],
  ['/jeu?app=tikitoko', 'Tikitoko'],
  ['/jeu?app=babigram', 'Babigram'],
  ['/jeu?app=guide', 'Le guide'],
  ['/jeu?app=inviter', 'Inviter des amis'],
]
const TEST_WHO = 'babi.adminPushTest'

/** A notification as it shows on an Android phone (roughly: each phone draws its own). */
function PushPreview({ title, body, image }: { title: string; body: string; image: string }) {
  return (
    <div className="rounded-2xl bg-[#1f2937] p-3">
      <div className="rounded-xl bg-white p-3 shadow">
        <div className="flex items-center gap-2 text-[11px] text-[#6b7280]">
          <img src="/pin-favicon-48.png" alt="" className="h-4 w-4" /> Babi Life · maintenant
        </div>
        <p className="mt-1 text-sm font-semibold break-words">{title || 'Le titre'}</p>
        <p className="text-sm break-words text-[#374151]">{body || 'Le texte de la notification.'}</p>
        {image && <img src={image} alt="" className="mt-2 max-h-48 w-full rounded-lg object-cover" />}
      </div>
      <p className="mt-2 text-center text-[11px] text-[#9ca3af]">L'image s'affiche en grand sur Android (appli et Chrome) et sur ordinateur ; sur iPhone, le titre et le texte seulement.</p>
    </div>
  )
}

function Notifs({ k }: { k: string }) {
  const [st, setSt] = useState<PushStatus | null>(null)
  const [e, setE] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [image, setImage] = useState('')
  const [url, setUrl] = useState('/jeu')
  const [audience, setAudience] = useState('tous')
  const [days, setDays] = useState(7)
  const [commune, setCommune] = useState('')
  const [who, setWho] = useState(() => {
    try {
      return localStorage.getItem(TEST_WHO) ?? ''
    } catch {
      return ''
    }
  })
  const [sure, setSure] = useState(false)
  const load = () => call<PushStatus>(`/admin/notify?days=${days}&commune=${encodeURIComponent(commune)}`, k).then(setSt, (x: Error) => setE(x.message))
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, days, commune])
  const running = st?.campaigns.some((c) => c.status === 'running' && !c.test)
  useEffect(() => {
    if (!running) return
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])
  const words = { title, body, image, url }
  const post = async (extra: object, done: (r: { text?: string; total?: number }) => string) => {
    setE(null)
    setOk(null)
    try {
      const r = await call<{ text?: string; total?: number }>('/admin/notify', k, { method: 'POST', body: JSON.stringify({ ...words, ...extra }) })
      setOk(done(r))
      setSure(false)
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Erreur')
    }
    // A failed test is in the list too.
    void load()
  }
  const test = () => {
    try {
      localStorage.setItem(TEST_WHO, who)
    } catch {
      /* not kept */
    }
    void post({ test: who }, (r) => r.text ?? 'Envoyé.')
  }
  const target = st?.counts[audience] ?? 0
  const ready = !!(st?.web || st?.app)
  const left = st ? Math.max(0, st.limit - st.today) : 0
  const filled = title.trim() !== '' && body.trim() !== ''
  const where = (c: PushCampaign) => (c.test ? `test à ${c.detail}` : `${st?.audiences[c.audience] ?? c.audience}${c.audience === 'actifs' ? ` (${c.detail} j)` : c.audience === 'commune' ? ` (${st?.communes.find((x) => x.id === c.detail)?.name ?? c.detail})` : ''}`)
  return (
    <div className="space-y-6">
      <Card title="Qui peut recevoir">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['Navigateurs', st?.subs?.web, Globe, st?.web ? 'Web Push branché' : 'Web Push non branché : VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY'],
            ['Appli Android', st?.subs?.app, Smartphone, st?.app ? 'Firebase branché' : 'Firebase non branché : FCM_SERVICE_ACCOUNT'],
            ['Joueurs joignables', st?.subs?.users, Users, 'au moins un téléphone ou navigateur abonné'],
          ].map(([label, n, Icon, note]) => {
            const I = Icon as typeof Globe
            return (
              <div key={label as string} className="rounded-lg border border-[#e5e7eb] p-3">
                <div className="flex items-center gap-2 text-sm text-[#6b7280]">
                  <I size={15} /> {label as string}
                </div>
                <div className="mt-1 text-2xl font-bold">{n === undefined ? '…' : nf(n as number)}</div>
                <div className="mt-0.5 text-xs text-[#9ca3af]">{note as string}</div>
              </div>
            )
          })}
        </div>
        <p className="mt-3 rounded-lg bg-[#fffbeb] px-3 py-2 text-xs text-[#92400e]">
          Un joueur reçoit les notifications seulement s'il a touché « Activer » dans le jeu, sur ce téléphone ou ce navigateur. Brave les bloque tant que « Utiliser les services Google pour la messagerie push » est coupé (Paramètres → Confidentialité et sécurité, ou brave://settings/privacy) ; sur iPhone, il faut ouvrir le jeu depuis l'écran d'accueil. Le jeu explique tout ça au joueur quand ça bloque.
        </p>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_minmax(320px,420px)]">
        <div className="space-y-6">
          <Card title="Écrire">
            <Err e={e} />
            <Ok t={ok} />
            <div className="grid gap-3">
              <label className="text-sm font-medium">
                Titre <span className="text-xs text-[#9ca3af]">({title.length}/65)</span>
                <Field className="mt-1" maxLength={65} value={title} onChange={(x) => (setTitle(x.target.value), setSure(false))} placeholder="Ce soir à Babi…" />
              </label>
              <label className="text-sm font-medium">
                Texte <span className="text-xs text-[#9ca3af]">({body.length}/240)</span>
                <textarea maxLength={240} rows={3} value={body} onChange={(x) => (setBody(x.target.value), setSure(false))} className="mt-1 w-full rounded-lg border border-[#d1d5db] p-3 text-sm outline-none focus:border-[#ea580c]" />
              </label>
              <div className="text-sm font-medium">
                Image (facultative)
                <div className="mt-1">
                  <ImagePick k={k} url={image} onChange={(u) => (setImage(u), setSure(false))} />
                </div>
              </div>
              <label className="text-sm font-medium">
                Ce qui s'ouvre quand on touche la notification
                <div className="mt-1 flex flex-wrap gap-2">
                  <select value={PUSH_LINKS.some(([v]) => v === url) ? url : ''} onChange={(x) => x.target.value && setUrl(x.target.value)} className="rounded-lg border border-[#d1d5db] px-3 py-2 text-sm">
                    {PUSH_LINKS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                    <option value="">Autre page…</option>
                  </select>
                  <Field className="min-w-0 flex-1" maxLength={300} value={url} onChange={(x) => setUrl(x.target.value)} placeholder="/jeu?app=…" />
                </div>
              </label>
            </div>
          </Card>

          <Card title="Envoyer">
            {!st ? (
              <p className="text-sm text-[#6b7280]">Chargement…</p>
            ) : !ready ? (
              <div className="rounded-lg border border-dashed border-[#d1d5db] p-4 text-sm text-[#374151]">
                <p className="font-semibold">Les notifications ne sont pas branchées sur l'API.</p>
                <p className="mt-1 text-[#6b7280]">
                  Sur Render (service API) : <code>VAPID_PUBLIC_KEY</code>, <code>VAPID_PRIVATE_KEY</code> (le site) et <code>FCM_SERVICE_ACCOUNT</code> (l'appli Android), puis redéployer.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                <div className="flex flex-wrap gap-2">
                  <Field className="min-w-0 flex-1" placeholder="Ton compte : e-mail, pseudo ou identifiant" value={who} onChange={(x) => setWho(x.target.value)} />
                  <Btn tone="light" disabled={!who.trim() || !filled || st.tests >= st.testsLimit} onClick={test}>
                    <BellRing size={14} /> M'envoyer un test
                  </Btn>
                </div>
                <p className="text-xs text-[#9ca3af]">
                  Le test part sur tous les téléphones et navigateurs où ce compte a activé les notifications ({st.tests}/{st.testsLimit} tests en 24 h).
                </p>
                <div className="flex flex-wrap items-center gap-2 border-t border-[#f3f4f6] pt-3">
                  <select value={audience} onChange={(x) => (setAudience(x.target.value), setSure(false))} className="rounded-lg border border-[#d1d5db] px-3 py-2 text-sm">
                    {PUSH_AUDIENCES.map((a) => (
                      <option key={a} value={a}>
                        {st.audiences[a]} ({nf(st.counts[a] ?? 0)})
                      </option>
                    ))}
                  </select>
                  {audience === 'actifs' && (
                    <label className="flex items-center gap-1.5 text-sm">
                      depuis
                      <Field type="number" min={1} max={90} value={days} onChange={(x) => setDays(Math.max(1, Math.min(90, Number(x.target.value) || 1)))} className="!w-20" />
                      jours
                    </label>
                  )}
                  {audience === 'commune' && (
                    <select value={commune} onChange={(x) => (setCommune(x.target.value), setSure(false))} className="rounded-lg border border-[#d1d5db] px-3 py-2 text-sm">
                      <option value="">Choisir la commune…</option>
                      {st.communes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({nf(c.players)})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {sure ? (
                    <>
                      <span className="text-sm">
                        Envoyer « {title} » à {nf(target)} joueurs ?
                      </span>
                      <Btn tone="light" onClick={() => setSure(false)}>
                        Annuler
                      </Btn>
                      <Btn tone="orange" onClick={() => void post({ audience, days, commune }, (r) => `Envoi lancé : ${nf(r.total ?? 0)} joueurs.`)}>
                        <Send size={14} /> Oui, envoyer
                      </Btn>
                    </>
                  ) : (
                    <Btn tone="orange" disabled={!target || !filled || running || !left || (audience === 'commune' && !commune)} onClick={() => setSure(true)}>
                      <Send size={14} /> Envoyer à {nf(target)} joueurs
                    </Btn>
                  )}
                  <span className="text-xs text-[#6b7280]">
                    {st.today}/{st.limit} envois en 24 h{left ? '' : ' : réessaie demain'}
                  </span>
                </div>
                <p className="rounded-lg bg-[#fffbeb] px-3 py-2 text-xs text-[#92400e]">
                  {st.limit} notifications par jour au plus (les « Prévenir les joueurs » des mises à jour comptent aussi) : trop, et les joueurs les coupent. Chacun la reçoit une fois, sur tous ses appareils.
                </p>
              </div>
            )}
          </Card>

          {!!st?.campaigns.length && (
            <Card title="Envois">
              <ul className="space-y-4">
                {st.campaigns.map((c) => (
                  <li key={c.id} className="text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {c.title} · {where(c)}
                        {c.source.startsWith('maj:') && <span className="ml-1.5 rounded bg-[#f3f4f6] px-1.5 text-[10px] font-semibold text-[#6b7280]">mise à jour</span>}
                        {c.image && <span className="ml-1.5 rounded bg-[#f3f4f6] px-1.5 text-[10px] font-semibold text-[#6b7280]">image</span>}
                      </span>
                      <span className="text-xs text-[#9ca3af]">{when(c.at)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[#6b7280]">{c.body}</p>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#f3f4f6]">
                      <i className="block h-full bg-[#16a34a]" style={{ width: `${((c.sent + c.failed) / Math.max(1, c.total)) * 100}%` }} />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-[#6b7280]">
                      <span>
                        {nf(c.sent)} joueurs atteints ({nf(c.devices)} appareils) · {nf(c.failed)} sans appareil valide · {nf(c.total)} en tout · {c.status === 'running' ? 'en cours…' : c.status === 'stopped' ? 'arrêté' : 'terminé'}
                      </span>
                      {c.status === 'running' && (
                        <button className="font-semibold text-[#dc2626]" onClick={() => void call(`/admin/notify/${c.id}/stop`, k, { method: 'POST', body: '{}' }).then(load)}>
                          Arrêter
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <Card title="Aperçu" className="xl:sticky xl:top-6 xl:self-start">
          <PushPreview title={title} body={body} image={image} />
        </Card>
      </div>
    </div>
  )
}

/** An e-mail's picture and video: sent to the bucket, shown in the preview. */
function MailMedia({ k, words, set }: { k: string; words: Words; set: (w: Partial<Words>) => void }) {
  const [p, setP] = useState<string | null>(null)
  const [e, setE] = useState<string | null>(null)
  const [poster, setPoster] = useState<File | null>(null)
  const sendVideo = async (f: File | undefined) => {
    if (!f) return
    setE(null)
    try {
      if (f.type !== 'video/mp4') throw new Error('Envoie une vidéo MP4 (40 Mo au plus).')
      if (f.size > 40 << 20) throw new Error('Vidéo trop lourde : 40 Mo au plus.')
      // Its poster first (a frame of it, or the picture chosen), with the play button drawn on it.
      setP('Image de la vidéo…')
      const still = await posterOf(poster ?? f)
      const img = await uploadMedia(k, still, 'image/jpeg', `${f.name} (image)`)
      const up = await uploadMedia(k, f, f.type, words.title || f.name, (x) => setP(`Envoi de la vidéo… ${Math.round(x * 100)} %`))
      await call(`/admin/media/${up.id}/poster`, k, { method: 'POST', body: JSON.stringify({ url: img.url }) })
      set({ video: up.page ?? '', poster: img.url })
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Erreur')
    } finally {
      setP(null)
    }
  }
  return (
    <div className="grid gap-3 rounded-lg border border-[#e5e7eb] p-3">
      <div className="text-sm font-medium">
        Image sous le texte (facultative)
        <div className="mt-1">
          <ImagePick k={k} url={words.image ?? ''} onChange={(u) => set({ image: u })} />
        </div>
      </div>
      <div className="text-sm font-medium">
        Vidéo (facultative)
        <p className="text-xs font-normal text-[#6b7280]">Les boîtes mail ne lisent pas les vidéos : l'e-mail montre son image avec un bouton ▶, qui ouvre la vidéo sur le site.</p>
        {words.video ? (
          <div className="mt-1 flex items-start gap-3">
            {words.poster && <img src={words.poster} alt="" className="h-20 w-32 rounded-lg border border-[#e5e7eb] object-cover" />}
            <div className="space-y-1">
              <a href={words.video} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#ea580c]">
                <ExternalLink size={12} /> La page de la vidéo
              </a>
              <div>
                <Btn tone="light" onClick={() => set({ video: '', poster: '' })}>
                  <Trash2 size={14} /> Retirer
                </Btn>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-[#d1d5db] px-3.5 py-2 text-sm font-semibold hover:bg-[#f9fafb]">
              <Video size={15} /> {p ?? 'Ajouter une vidéo (MP4)'}
              <input type="file" accept="video/mp4" className="hidden" disabled={p !== null} onChange={(x) => void sendVideo(x.target.files?.[0])} />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-normal text-[#6b7280]">
              <input type="file" accept={IMAGE_TYPES} className="hidden" onChange={(x) => setPoster(x.target.files?.[0] ?? null)} />
              <ImagePlus size={13} /> {poster ? `Image choisie : ${poster.name}` : 'Son image : une image de la vidéo, ou choisis-en une (avant la vidéo)'}
            </label>
          </div>
        )}
      </div>
      {(words.image || words.video) && (
        <label className="text-sm font-medium">
          Ce que dit l'image, pour ceux qui ne la voient pas
          <Field className="mt-1" maxLength={150} value={words.imageAlt ?? ''} onChange={(x) => set({ imageAlt: x.target.value })} placeholder="La fête au Plateau samedi" />
        </label>
      )}
      {e && <p className="text-xs text-[#b91c1c]">{e}</p>}
    </div>
  )
}

/* ---------- Liste d'attente ---------- */

function Waitlist({ k }: { k: string }) {
  const [s, setS] = useState<Stats | null>(null)
  const [e, setE] = useState<string | null>(null)
  useEffect(() => void call<Stats>('/admin/stats', k).then(setS, (x: Error) => setE(x.message)), [k])
  const download = async () => {
    setE(null)
    try {
      const res = await fetch(`${BASE}/waitlist/export`, { headers: { 'X-Admin-Key': k } })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Export impossible')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(await res.blob())
      a.download = `liste-attente-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Erreur')
    }
  }
  return (
    <Card className="max-w-xl">
      <Err e={e} />
      <div className="flex items-end gap-8">
        <div>
          <div className="text-4xl font-bold">{s ? nf(s.waitlist) : '…'}</div>
          <div className="text-sm text-[#6b7280]">inscrits</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{s ? nf(s.phones) : '…'}</div>
          <div className="text-sm text-[#6b7280]">avec WhatsApp</div>
        </div>
      </div>
      <Btn className="mt-5" onClick={() => void download()}>
        <Download size={15} /> Télécharger la liste (CSV)
      </Btn>
      <p className="mt-2 text-xs text-[#9ca3af]">Le fichier contient les contacts des inscrits : garde-le pour toi.</p>
    </Card>
  )
}

/* ---------- Pub ---------- */

type Invite = { code: string; label: string; createdAt: string; usedAt: string | null; revokedAt?: string | null; campaign: string | null }

function Pub({ k }: { k: string }) {
  const [list, setList] = useState<Status[] | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [label, setLabel] = useState('')
  const [made, setMade] = useState<string | null>(null)
  const [e, setE] = useState<string | null>(null)
  const linkOf = (code: string) => `${location.origin}/pub/envoi/${code}`
  const load = () => {
    call<Status[]>('/ads/admin', k).then(setList, (x: Error) => setE(x.message))
    call<Invite[]>('/ads/admin/invites', k).then(setInvites, () => undefined)
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k])
  // A send link taken back before it's used: it no longer works.
  const revoke = async (code: string) => {
    if (!confirm('Révoquer ce lien ? Il ne marchera plus.')) return
    try {
      await call(`/ads/admin/invites/${encodeURIComponent(code)}/revoke`, k, { method: 'POST' })
      load()
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Erreur')
    }
  }
  const update = async (id: string, change: Partial<Pick<Status, 'status' | 'paid' | 'price' | 'note' | 'link'>>) => {
    try {
      await call(`/ads/admin/${id}`, k, { method: 'POST', body: JSON.stringify(change) })
      load()
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Erreur')
    }
  }
  const make = async (ev: React.FormEvent) => {
    ev.preventDefault()
    try {
      const r = await call<{ code: string }>('/ads/admin/invites', k, { method: 'POST', body: JSON.stringify({ label }) })
      setMade(linkOf(r.code))
      setLabel('')
      load()
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Erreur')
    }
  }
  return (
    <div className="space-y-6">
      <Err e={e} />
      <Card title="Liens d'envoi">
        <p className="mb-3 text-sm text-[#6b7280]">Quand le prix est convenu avec un annonceur, crée son lien et envoie-le lui. Il ne sert qu'une fois.</p>
        <form className="flex flex-wrap gap-2" onSubmit={make}>
          <Field className="min-w-0 flex-1" placeholder="Pour qui ? (ex. Garba Chez Tanti, 2 semaines Yop)" value={label} onChange={(x) => setLabel(x.target.value)} maxLength={120} />
          <Btn tone="orange">Créer le lien</Btn>
        </form>
        {made && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#f9fafb] px-3 py-2">
            <code className="min-w-0 flex-1 text-xs break-all">{made}</code>
            <Btn tone="light" onClick={() => void navigator.clipboard?.writeText(made)}>
              Copier
            </Btn>
          </div>
        )}
        {invites.length > 0 && (
          <ul className="mt-4 divide-y divide-[#f3f4f6] text-sm">
            {invites.map((i) => (
              <li key={i.code} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1">{i.label || 'Sans nom'}</span>
                <span className="text-xs text-[#9ca3af]">{when(i.createdAt)}</span>
                {i.usedAt ? (
                  <span className="text-xs font-semibold text-[#16a34a]">Utilisé</span>
                ) : i.revokedAt ? (
                  <span className="text-xs font-semibold text-[#9ca3af]">Révoqué</span>
                ) : (
                  <>
                    <button className="text-xs font-semibold text-[#ea580c]" onClick={() => void navigator.clipboard?.writeText(linkOf(i.code))}>
                      Copier le lien
                    </button>
                    <button className="text-xs font-semibold text-[#dc2626]" onClick={() => void revoke(i.code)}>
                      Révoquer
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={`Campagnes (${list?.length ?? 0})`}>
        {list?.length === 0 && <p className="text-sm text-[#6b7280]">Pas encore de campagne.</p>}
        <div className="space-y-4">
          {list?.map((c) => (
            <Campaign key={c.id} c={c} onChange={(ch) => void update(c.id, ch)} />
          ))}
        </div>
      </Card>
    </div>
  )
}

function Campaign({ c, onChange }: { c: Status; onChange: (change: Partial<Pick<Status, 'status' | 'paid' | 'price' | 'note' | 'link'>>) => void }) {
  const [price, setPrice] = useState(String(c.price || ''))
  const [note, setNote] = useState(c.note)
  return (
    <div className="grid gap-4 rounded-lg border border-[#e5e7eb] p-4 md:grid-cols-[220px_1fr]">
      <div className="overflow-hidden rounded-md bg-[#111827]">{c.url ? <Preview type={c.type} url={c.url} className="aspect-[2/1]" /> : <p className="p-4 text-sm text-white/70">Bucket non branché</p>}</div>
      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-base font-semibold">{c.title}</span>
          <span>{c.advertiser}</span>
          <span className="text-[#6b7280]">{c.contact}</span>
        </div>
        <div className="text-[#6b7280]">
          {c.starts} {c.startTime ?? '00:00'} → {c.ends} {c.endTime ?? '24:00'} · {c.communes.length ? c.communes.join(', ') : 'partout'} · {nf(c.views)} vues
        </div>
        <div className="text-[#6b7280]">
          {(c.places?.length ? c.places : (['panneaux'] as Place[])).map((p) => PLACES[p][0]).join(' · ')}
          {c.appName && ` · appli « ${c.appName} »`}
        </div>
        {c.link && (
          <div className="flex items-center gap-2">
            {c.icon && <img src={c.icon} alt="" className="h-8 w-8 rounded-md object-cover" />}
            <a href={c.link} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-[#2563eb] underline">
              {c.link}
            </a>
            {/* A link gone bad (or not wanted): taken off, the ad stays, nothing opens on a tap; the phone's app goes. */}
            <button className="text-xs font-semibold text-[#dc2626]" onClick={() => confirm('Révoquer le lien de cette pub ? Le bouton « En savoir plus » et l\'appli du téléphone disparaissent.') && onChange({ link: '' })}>
              Révoquer le lien
            </button>
          </div>
        )}
        <span className="inline-block rounded px-2 py-0.5 text-xs font-semibold text-white" style={{ background: { pending: '#d97706', approved: '#16a34a', rejected: '#dc2626', paused: '#6b7280' }[c.status] }}>
          {STATUS[c.status][0]}
          {c.paid ? ' · payée' : ' · non payée'}
        </span>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => onChange({ status: 'approved' })}>Accepter</Btn>
          <Btn tone="red" onClick={() => onChange({ status: 'rejected', note })}>
            Refuser
          </Btn>
          <Btn tone="light" onClick={() => onChange({ status: 'paused' })}>
            Pause
          </Btn>
          <Btn tone="light" onClick={() => onChange({ paid: !c.paid })}>
            {c.paid ? 'Marquer non payée' : 'Marquer payée'}
          </Btn>
        </div>
        <div className="flex flex-wrap gap-2">
          <Field className="!w-36" inputMode="numeric" placeholder="Prix (F)" value={price} onChange={(x) => setPrice(x.target.value.replace(/\D/g, ''))} />
          <Field className="min-w-0 flex-1" placeholder="Note pour l'annonceur" value={note} onChange={(x) => setNote(x.target.value)} />
          <Btn tone="light" onClick={() => onChange({ price: Number(price || 0), note })}>
            Enregistrer
          </Btn>
        </div>
      </div>
    </div>
  )
}

/* ---------- Signalements ---------- */

type Report = { id: number; reporter: string; reporterName: string; reported: string; reportedName: string; messageId?: number; storyId?: number; postId?: number; grinId?: number; gramPostId?: number; gramCommentId?: number; snapId?: number; excerpt: string; reason: string; at: string }

function Reports({ k }: { k: string }) {
  const [list, setList] = useState<Report[] | null>(null)
  const [e, setE] = useState<string | null>(null)
  useEffect(() => void call<Report[]>('/moderation/reports', k).then(setList, (x: Error) => setE(x.message)), [k])
  const resolve = async (r: Report, remove: boolean) => {
    try {
      await call(`/moderation/reports/${r.id}`, k, { method: 'POST', body: JSON.stringify({ delete: remove }) })
      setList((l) => l?.filter((x) => x.id !== r.id) ?? l)
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Erreur')
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#6b7280]">Ce que les joueurs ont signalé dans Gbairai, les stories, Tikitoko et Babigram. Celui qui signale a déjà bloqué l'autre. « Supprimer » retire le contenu pour tout le monde ; « Classer » ferme le signalement.</p>
      <Err e={e} />
      {list?.length === 0 && <Card>Rien à traiter.</Card>}
      {list?.map((r) => (
        <Card key={r.id}>
          <div className="grid gap-4 md:grid-cols-[200px_1fr]">
            <div className="overflow-hidden rounded-md bg-[#111827]">
              {r.storyId || r.postId || r.snapId || (r.gramPostId && !r.gramCommentId) ? <AdminPhoto k={k} query={r.storyId ? `story=${r.storyId}` : r.postId ? `post=${r.postId}` : r.snapId ? `snap=${r.snapId}` : `gram=${r.gramPostId}`} /> : <p className="p-4 text-sm whitespace-pre-wrap text-white">« {r.excerpt || '(pas de texte)'} »</p>}
            </div>
            <div className="space-y-2 text-sm">
              <span className="inline-block rounded bg-[#fee2e2] px-2 py-0.5 text-xs font-semibold text-[#b91c1c]">{r.reason}</span>
              <p>
                {r.storyId ? 'Story' : r.snapId ? 'Snap Flashé' : r.postId ? 'Vidéo Tikitoko' : r.gramCommentId ? 'Commentaire Babigram' : r.gramPostId ? 'Photo Babigram' : r.grinId ? 'Message du grin' : r.messageId ? 'Message Gbairai' : 'Personne'} de <b>{r.reportedName}</b>, signalé par {r.reporterName} · <span className="text-[#6b7280]">{when(r.at)}</span>
              </p>
              {(r.storyId || r.postId || r.snapId || (r.gramPostId && !r.gramCommentId)) && r.excerpt && <p className="text-[#374151]">Légende : « {r.excerpt} »</p>}
              <div className="flex gap-2 pt-1">
                {(r.messageId || r.storyId || r.postId || r.grinId || r.gramPostId || r.snapId) && (
                  <Btn tone="red" onClick={() => void resolve(r, true)}>
                    Supprimer
                  </Btn>
                )}
                <Btn tone="light" onClick={() => void resolve(r, false)}>
                  Classer
                </Btn>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

/* ---------- Idées ---------- */

type Idea = { id: number; topic: 'jeu' | 'lieu' | 'bug' | 'autre'; text: string; status: 'new' | 'read' | 'kept' | 'done' | 'no'; reply: string; at: string; answeredAt?: string; user: string; simName: string }
const IDEA_TOPIC: Record<Idea['topic'], string> = { jeu: 'Activité', lieu: 'Lieu', bug: 'Souci', autre: 'Autre' }
const IDEA_STATUS: Record<Idea['status'], string> = { new: 'Nouvelle', read: 'Lue', kept: 'Retenue', done: 'Faite', no: 'Pas pour l’instant' }

function Ideas({ k }: { k: string }) {
  const [list, setList] = useState<Idea[] | null>(null)
  const [filter, setFilter] = useState<'open' | 'new' | 'kept' | 'done' | 'no' | 'all'>('open')
  const [e, setE] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState<number | null>(null)
  useEffect(() => void call<Idea[]>(`/admin/ideas?status=${filter}`, k).then(setList, (x: Error) => setE(x.message)), [k, filter])
  // A step on, or an answer (the status goes from « new » to « read » with it).
  const update = async (i: Idea, body: { status?: Idea['status']; reply?: string }) => {
    setBusy(i.id)
    setE(null)
    try {
      const got = await call<Idea>(`/admin/ideas/${i.id}`, k, { method: 'POST', body: JSON.stringify(body) })
      setList((l) => l?.map((x) => (x.id === i.id ? { ...x, ...got } : x)) ?? l)
      if (body.reply !== undefined) setDraft((d) => ({ ...d, [i.id]: '' }))
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Erreur')
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#6b7280]">Ce que les joueurs proposent depuis l’appli Idées de leur téléphone. Le joueur voit le statut et la réponse dans son appli : « Retenue » promet qu’on le fera, « Faite » dit que c’est dans le jeu, « Pas pour l’instant » ferme sans vexer.</p>
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['open', 'À traiter'],
            ['new', 'Nouvelles'],
            ['kept', 'Retenues'],
            ['done', 'Faites'],
            ['no', 'Refusées'],
            ['all', 'Toutes'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === id ? 'bg-[#111827] text-white' : 'bg-white text-[#374151] ring-1 ring-[#e5e7eb]'}`}>
            {label}
          </button>
        ))}
      </div>
      <Err e={e} />
      {list?.length === 0 && <Card>Rien ici.</Card>}
      {list?.map((i) => (
        <Card key={i.id}>
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-[#eef2ff] px-2 py-0.5 text-xs font-semibold text-[#3730a3]">{IDEA_TOPIC[i.topic] ?? 'Autre'}</span>
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${i.status === 'new' ? 'bg-[#fef3c7] text-[#92400e]' : i.status === 'kept' ? 'bg-[#dbeafe] text-[#1e40af]' : i.status === 'done' ? 'bg-[#dcfce7] text-[#166534]' : i.status === 'no' ? 'bg-[#fee2e2] text-[#991b1b]' : 'bg-[#f3f4f6] text-[#374151]'}`}>{IDEA_STATUS[i.status] ?? i.status}</span>
              <span className="text-[#6b7280]">
                {i.user}
                {i.simName ? ` (${i.simName})` : ''} · {when(i.at)}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-[#111827]">{i.text}</p>
            {i.reply && (
              <p className="rounded-lg bg-[#f9fafb] px-3 py-2 text-[#374151]">
                <b>Réponse :</b> {i.reply}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {i.status !== 'read' && i.status !== 'kept' && i.status !== 'done' && (
                <Btn tone="light" onClick={() => void update(i, { status: 'read' })}>
                  Lue
                </Btn>
              )}
              {i.status !== 'kept' && i.status !== 'done' && (
                <Btn tone="light" onClick={() => void update(i, { status: 'kept' })}>
                  Retenue
                </Btn>
              )}
              {i.status !== 'done' && (
                <Btn tone="dark" onClick={() => void update(i, { status: 'done' })}>
                  Faite
                </Btn>
              )}
              {i.status !== 'no' && i.status !== 'done' && (
                <Btn tone="red" onClick={() => void update(i, { status: 'no' })}>
                  Pas pour l’instant
                </Btn>
              )}
            </div>
            <div className="flex gap-2">
              <input value={draft[i.id] ?? ''} onChange={(x) => setDraft((d) => ({ ...d, [i.id]: x.target.value.slice(0, 400) }))} placeholder={i.reply ? 'Changer la réponse…' : 'Répondre au joueur (il la verra dans l’appli)…'} className="min-w-0 flex-1 rounded-lg border border-[#d1d5db] px-3 py-2 text-sm" />
              <Btn tone="dark" onClick={() => void update(i, { reply: draft[i.id] ?? '' })}>
                {busy === i.id ? '…' : 'Envoyer'}
              </Btn>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function AdminPhoto({ k, query }: { k: string; query: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [gone, setGone] = useState(false)
  useEffect(() => {
    let made: string | null = null
    fetch(`${BASE}/moderation/photo?${query}`, { headers: { 'X-Admin-Key': k } })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => setUrl((made = URL.createObjectURL(b))))
      .catch(() => setGone(true))
    return () => void (made && URL.revokeObjectURL(made))
  }, [k, query])
  const ratio = useMemo(() => 'aspect-[4/3] w-full object-cover', [])
  if (gone) return <p className="p-4 text-sm text-white/70">Photo déjà supprimée ou expirée.</p>
  return url ? <img src={url} alt="Photo signalée" className={ratio} /> : <div className="aspect-[4/3] animate-pulse" />
}
