import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Download, Flag, LogOut, Megaphone, Users } from 'lucide-react'
import { PubAdminPanel } from './Pub'

// /admin: everything Babi Life's team manages, behind one key (ADMIN_KEY on
// the API; each part's own key works too):
// - Pub: the advertisers' send links and campaigns (backend/internal/ads);
// - Signalements: what players reported in Gbairai, the stories and
//   Tikitoko, with the message or the photo; delete it, or close the report
//   (backend/internal/sims/gbairai.go, Moderation);
// - Liste d'attente: how many signed up, and the list as CSV (waitlist).
// The key stays in the tab only (sessionStorage); the page is never indexed.

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'
const STORE = 'babi.adminKey'

type Tab = 'pub' | 'signalements' | 'liste'
const TABS: { id: Tab; label: string; icon: typeof Flag }[] = [
  { id: 'pub', label: 'Pub', icon: Megaphone },
  { id: 'signalements', label: 'Signalements', icon: Flag },
  { id: 'liste', label: "Liste d'attente", icon: Users },
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

export function Admin() {
  const { search } = useLocation()
  const navigate = useNavigate()
  const tab = (new URLSearchParams(search).get('tab') as Tab) || 'pub'
  const [key, setKey] = useState(read)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Never in a search engine.
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
      // The reports need the key: a cheap way to check it.
      await call('/moderation/reports', typed)
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

  return (
    <div className="street worn min-h-full">
      <header className="bg-[var(--brown)] text-[var(--cream)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <Link to="/admin" className="paint text-[26px]">
            Babi Life <span className="text-[var(--ochre)]">Admin</span>
          </Link>
          {key && (
            <button className="flex items-center gap-1.5 text-[13px] font-extrabold" onClick={leave}>
              <LogOut size={15} /> Fermer
            </button>
          )}
        </div>
        {key && (
          <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`/admin?tab=${t.id}`)}
                className={`flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-[14px] font-extrabold ${tab === t.id ? 'bg-[var(--cream)] text-[var(--brown)]' : 'text-[var(--cream)]/80'}`}
              >
                <t.icon size={15} /> {t.label}
              </button>
            ))}
          </nav>
        )}
      </header>
      <div className="ci-stripe" aria-hidden />
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-14">
        {!key ? (
          <form className="mx-auto flex max-w-sm flex-col gap-3 border-2 border-[var(--brown)] bg-[var(--cream)] p-5" onSubmit={open}>
            <h1 className="paint text-[34px]">Espace admin</h1>
            <p className="text-[14px] font-bold">La clé admin (ADMIN_KEY sur Render) ouvre la pub, les signalements et la liste d'attente.</p>
            <input className="input text-base" type="password" autoComplete="current-password" placeholder="Clé admin" value={typed} onChange={(e) => setTyped(e.target.value)} />
            {error && <p className="text-sm font-bold text-[var(--rust)]">{error}</p>}
            <button className="sign-btn">Ouvrir</button>
          </form>
        ) : tab === 'signalements' ? (
          <Reports adminKey={key} />
        ) : tab === 'liste' ? (
          <Waitlist adminKey={key} />
        ) : (
          <PubAdminPanel adminKey={key} />
        )}
      </main>
    </div>
  )
}

type Report = { id: number; reporter: string; reporterName: string; reported: string; reportedName: string; messageId?: number; storyId?: number; postId?: number; excerpt: string; reason: string; at: string }

/** What players reported: the message or the photo, and what to do with it. */
function Reports({ adminKey }: { adminKey: string }) {
  const [list, setList] = useState<Report[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = () => call<Report[]>('/moderation/reports', adminKey).then(setList, (e: Error) => setError(e.message))
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey])
  const resolve = async (r: Report, remove: boolean) => {
    try {
      await call(`/moderation/reports/${r.id}`, adminKey, { method: 'POST', body: JSON.stringify({ delete: remove }) })
      setList((l) => l?.filter((x) => x.id !== r.id) ?? l)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    }
  }
  return (
    <section>
      <h1 className="paint text-[40px]">Signalements ({list?.length ?? 0})</h1>
      <p className="text-[14px] font-bold">Ce que les joueurs ont signalé dans Gbairai, les stories et Tikitoko. La personne qui signale a déjà bloqué l'autre. « Supprimer » retire le message ou la photo pour tout le monde ; « Classer » ferme le signalement sans rien retirer.</p>
      {error && <p className="mt-2 text-sm font-bold text-[var(--rust)]">{error}</p>}
      {list?.length === 0 && <p className="mt-6 font-bold">Rien à traiter. 👌</p>}
      <div className="mt-4 flex flex-col gap-4">
        {list?.map((r) => (
          <div key={r.id} className="grid gap-4 border-2 border-[var(--brown)] bg-[var(--cream)] p-4 md:grid-cols-[220px_1fr]">
            <div className="bg-[#2b2f3a]">{r.storyId || r.postId ? <AdminPhoto adminKey={adminKey} query={r.storyId ? `story=${r.storyId}` : `post=${r.postId}`} /> : <p className="p-4 text-[15px] font-bold whitespace-pre-wrap text-[var(--cream)]">« {r.excerpt || '(pas de texte)'} »</p>}</div>
            <div className="flex flex-col gap-2 text-[14px] font-bold">
              <span className="slab w-fit bg-[var(--rust)] px-2 py-1 text-[var(--cream)]">{r.reason}</span>
              <span>
                {r.storyId ? 'Story' : r.postId ? 'Vidéo Tikitoko' : r.messageId ? 'Message Gbairai' : 'Personne'} de <b>{r.reportedName}</b>, signalé par {r.reporterName} · {new Date(r.at).toLocaleString('fr-FR')}
              </span>
              {(r.storyId || r.postId) && r.excerpt && <span>Légende : « {r.excerpt} »</span>}
              <span className="font-mono text-[11px] opacity-60">
                {r.reported} ← {r.reporter}
              </span>
              <div className="mt-1 flex flex-wrap gap-2">
                {(r.messageId || r.storyId || r.postId) && (
                  <button className="sign-btn !px-3 !py-2 !text-[14px]" onClick={() => void resolve(r, true)}>
                    Supprimer
                  </button>
                )}
                <button className="sign-btn alt !px-3 !py-2 !text-[14px]" onClick={() => void resolve(r, false)}>
                  Classer
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/** A reported photo, fetched with the key. */
function AdminPhoto({ adminKey, query }: { adminKey: string; query: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [gone, setGone] = useState(false)
  useEffect(() => {
    let made: string | null = null
    fetch(`${BASE}/moderation/photo?${query}`, { headers: { 'X-Admin-Key': adminKey } })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => setUrl((made = URL.createObjectURL(b))))
      .catch(() => setGone(true))
    return () => void (made && URL.revokeObjectURL(made))
  }, [adminKey, query])
  if (gone) return <p className="p-4 text-[14px] font-bold text-[var(--cream)]">Photo déjà supprimée ou expirée.</p>
  return url ? <img src={url} alt="Photo signalée" className="aspect-[4/3] w-full object-cover" /> : <div className="aspect-[4/3] animate-pulse" />
}

/** The wish list: how many, and the list to download. */
function Waitlist({ adminKey }: { adminKey: string }) {
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void call<{ count: number }>('/waitlist/count', adminKey).then((r) => setCount(r.count), (e: Error) => setError(e.message))
  }, [adminKey])
  const download = async () => {
    setError(null)
    try {
      const res = await fetch(`${BASE}/waitlist/export`, { headers: { 'X-Admin-Key': adminKey } })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Export impossible')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(await res.blob())
      a.download = `liste-attente-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    }
  }
  return (
    <section className="border-2 border-[var(--brown)] bg-[var(--cream)] p-5">
      <h1 className="paint text-[40px]">Liste d'attente</h1>
      <p className="paint mt-2 text-[56px] leading-none text-[var(--turq)]">{count === null ? '…' : count.toLocaleString('fr-FR')}</p>
      <p className="text-[14px] font-bold">inscrits</p>
      {error && <p className="mt-2 text-sm font-bold text-[var(--rust)]">{error}</p>}
      <button className="sign-btn turq mt-4 flex items-center gap-2" onClick={() => void download()}>
        <Download size={16} /> Télécharger la liste (CSV)
      </button>
      <p className="mt-2 text-[12px] font-bold opacity-70">Le fichier contient les contacts des inscrits : garde-le pour toi.</p>
    </section>
  )
}
