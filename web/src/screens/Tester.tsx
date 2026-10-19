import { useEffect, useState } from 'react'
import { FlaskConical, KeyRound, LogOut, Play } from 'lucide-react'
import { isTester, setTester } from '../lib/launch'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

/**
 * /testeur: the team's way into the game before launch, on any browser.
 * The admin key is checked by the server (as on /admin); then this browser
 * plays the whole game, while everyone else still sees the wish list. The
 * page isn't linked anywhere and isn't indexed.
 */
export default function Tester() {
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const already = isTester()

  useEffect(() => {
    const m = document.createElement('meta')
    m.name = 'robots'
    m.content = 'noindex, nofollow'
    document.head.appendChild(m)
    document.title = 'Testeur · Babi Life'
    return () => m.remove()
  }, [])

  const enter = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(`${BASE}/admin/stats`, { headers: { 'X-Admin-Key': key.trim() } })
      if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'Clé incorrecte.' : 'Le serveur ne répond pas : réessaie.')
      setTester(true)
      // A fresh load, so the whole game opens.
      location.replace('/jeu')
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Pas de réseau.')
    } finally {
      setBusy(false)
    }
  }
  const leave = () => {
    setTester(false)
    location.replace('/')
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-[#141416] p-4 text-white">
      <div className="w-full max-w-[380px] rounded-[28px] bg-white p-6 text-[var(--color-ink)] shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fff1e3] text-[var(--color-orange)]">
            <FlaskConical size={24} />
          </span>
          <div>
            <div className="label">Avant le lancement</div>
            <h1 className="font-display text-2xl leading-tight font-extrabold">Accès testeur</h1>
          </div>
        </div>
        {already ? (
          <>
            <p className="mt-4 text-sm font-bold text-[var(--color-ink-soft)]">Ce navigateur est en mode testeur : tout le jeu est ouvert ici. Les autres voient toujours la liste d'attente.</p>
            <div className="mt-4 grid gap-2">
              <button className="btn" onClick={() => location.replace('/jeu')}>
                <Play size={18} /> Jouer
              </button>
              <button className="btn btn-soft" onClick={leave}>
                <LogOut size={18} /> Quitter le mode testeur
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={enter} className="mt-4 grid gap-3">
            <p className="text-sm font-bold text-[var(--color-ink-soft)]">Entre la clé d'administration pour ouvrir tout le jeu sur ce navigateur.</p>
            <label className="grid gap-1">
              <span className="label">Clé</span>
              <span className="flex items-center gap-2 rounded-2xl bg-[var(--color-canvas)] px-3">
                <KeyRound size={16} className="text-[var(--color-ink-soft)]" />
                <input className="min-w-0 flex-1 bg-transparent py-3 text-[15px] font-bold outline-none" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} aria-label="Clé d'administration" />
              </span>
            </label>
            {error && <p className="text-sm font-bold text-[#d81b3f]">{error}</p>}
            <button className="btn" disabled={busy || !key.trim()}>
              {busy ? 'Vérification…' : 'Ouvrir le jeu'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
