import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Download, ExternalLink, Flag, LayoutDashboard, Lightbulb, ListChecks, LogOut, Megaphone, MessageCircle, Package, RefreshCw, ScrollText, Search, Send, ShieldCheck, Users } from 'lucide-react'
import { Preview, STATUS, type Status } from './Pub'

// /admin: everything Babi Life's team manages, behind one key (ADMIN_KEY on
// the API). A plain dashboard, not the game's look:
// - Tableau de bord: the numbers, the last things that happened;
// - Joueurs: every account and its Sim, searchable;
// - Journal: sign-ups, logins, new Sims, the wish list, reports, ads, and
//   what the team did (backend/internal/admin);
// - Annonces: a message from Babi Life in every Sim's phone;
// - WhatsApp: a message to the wish list's numbers, through WhatsApp's API
//   with an approved template, or by hand with click-to-chat links;
// - Liste d'attente, Pub (backend/internal/ads), Signalements (moderation);
// - Idées: what the players suggest from the phone (backend/internal/ideas), answered here;
// - Mises à jour: the features that ship closed, opened one by one (now or at a set time) (backend/internal/features).
// The key stays in the tab only (sessionStorage); the page is never indexed.

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'
const STORE = 'babi.adminKey'

type Tab = 'tableau' | 'joueurs' | 'journal' | 'annonces' | 'whatsapp' | 'liste' | 'pub' | 'signalements' | 'idees' | 'majs'
const TABS: { id: Tab; label: string; icon: typeof Flag }[] = [
  { id: 'tableau', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'joueurs', label: 'Joueurs', icon: Users },
  { id: 'journal', label: 'Journal', icon: ScrollText },
  { id: 'annonces', label: 'Annonces', icon: Bell },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'liste', label: "Liste d'attente", icon: ListChecks },
  { id: 'pub', label: 'Pub', icon: Megaphone },
  { id: 'signalements', label: 'Signalements', icon: Flag },
  { id: 'idees', label: 'Idées', icon: Lightbulb },
  { id: 'majs', label: 'Mises à jour', icon: Package },
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

/** Before launch: every tester's perso back to just after it was created, the accounts made ordinary players. */
function ResetTesters({ k, onDone }: { k: string; onDone: () => void }) {
  const [sure, setSure] = useState(false)
  const [e, setE] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
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
    </Card>
  )
}

type Player = { id: string; name: string; username: string; email: string; google: boolean; createdAt: string; lastLogin: string; sims: number; sim: string; commune: string; money: number; online: boolean; tester: boolean }

function Players({ k }: { k: string }) {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<{ users: Player[]; total: number } | null>(null)
  const [e, setE] = useState<string | null>(null)
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
      <ResetTesters k={k} onDone={() => setVersion((v) => v + 1)} />
      <Card>
        <Err e={e} />
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-[#9ca3af]" />
            <Field className="!pl-9" placeholder="Chercher un nom, un pseudo, un e-mail…" value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} />
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

type Update = { id: string; label: string; about: string; open: boolean; opensAt: string | null; openedAt: string | null; live: boolean }

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
  const load = () => call<{ features: Update[] }>('/admin/features', k).then((r) => setList(r.features), (x: Error) => setE(x.message))
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k])
  const set = async (u: Update, open: boolean, opensAt: string | null, said: string) => {
    setE(null)
    setOk(null)
    try {
      const r = await call<{ features: Update[] }>(`/admin/features/${u.id}`, k, { method: 'POST', body: JSON.stringify({ open, opensAt: opensAt ? new Date(opensAt).toISOString() : '' }) })
      setList(r.features)
      setOk(`${u.label} : ${said}`)
      setSure(null)
    } catch (x) {
      setE(x instanceof Error ? x.message : 'Erreur')
    }
  }
  const live = list.filter((u) => u.live).length
  return (
    <div className="space-y-4">
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
                    <>
                      <span className="text-sm text-[#374151]">L'ouvrir à tous les joueurs maintenant ?</span>
                      <Btn tone="light" onClick={() => setSure(null)}>
                        Annuler
                      </Btn>
                      <Btn tone="orange" onClick={() => void set(u, true, null, 'ouverte')}>
                        Oui, ouvrir
                      </Btn>
                    </>
                  ) : (
                    <>
                      <Btn tone="orange" onClick={() => setSure(u.id)}>
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

/* ---------- WhatsApp ---------- */

type WaCampaign = { id: number; template: string; audience: string; total: number; sent: number; failed: number; status: 'running' | 'done' | 'stopped'; at: string; errors?: string[] }
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
                    <span className="text-sm">Envoyer « {template} » à {nf(target)} numéros ?</span>
                    <Btn tone="light" onClick={() => setSure(false)}>
                      Annuler
                    </Btn>
                    <Btn tone="orange" onClick={() => void post({ template, lang, audience }, (r) => `Envoi lancé : ${nf(r.total ?? 0)} numéros.`)}>
                      <Send size={14} /> Oui, envoyer
                    </Btn>
                  </>
                ) : (
                  <Btn tone="orange" disabled={!template || !target || running} onClick={() => setSure(true)}>
                    <Send size={14} /> Envoyer à {nf(target)} numéros
                  </Btn>
                )}
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
                      {nf(c.sent)} envoyés · {nf(c.failed)} échecs · {nf(c.total)} en tout · {c.status === 'running' ? 'en cours…' : c.status === 'stopped' ? 'arrêté' : 'terminé'}
                    </span>
                    {c.status === 'running' && (
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

type Invite = { code: string; label: string; createdAt: string; usedAt: string | null; campaign: string | null }

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
  const update = async (id: string, change: Partial<Pick<Status, 'status' | 'paid' | 'price' | 'note'>>) => {
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
                ) : (
                  <button className="text-xs font-semibold text-[#ea580c]" onClick={() => void navigator.clipboard?.writeText(linkOf(i.code))}>
                    Copier le lien
                  </button>
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

function Campaign({ c, onChange }: { c: Status; onChange: (change: Partial<Pick<Status, 'status' | 'paid' | 'price' | 'note'>>) => void }) {
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
          {c.starts} → {c.ends} · {c.communes.length ? c.communes.join(', ') : 'partout'} · {nf(c.views)} vues
        </div>
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
