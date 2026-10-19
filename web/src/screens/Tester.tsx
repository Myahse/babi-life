import { useEffect, useState } from 'react'
import { FlaskConical, KeyRound, LogOut, Play } from 'lucide-react'
import { isTester, isTesterCode, setTester, testerPass } from '../lib/launch'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

/** Drops the offline copy of the site (service worker and its caches), then opens the page. */
async function freshStart(to: string) {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? []
    await Promise.all(regs.map((r) => r.unregister()))
    const keys = (await window.caches?.keys()) ?? []
    await Promise.all(keys.map((k) => caches.delete(k)))
  } catch {
    /* no service worker here: nothing to drop */
  }
  location.replace(to)
}

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
  // A tester from before the toolbox has no code kept: they type it once more.
  const already = isTester() && !!testerPass()

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
      // The testers' code is checked right here; the admin key goes to the server.
      if (await isTesterCode(key)) {
        setTester(true, key)
        await freshStart('/jeu')
        return
      }
      let res: Response
      try {
        res = await fetch(`${BASE}/admin/stats`, { headers: { 'X-Admin-Key': key.trim() } })
      } catch {
        // No answer at all: the server is waking up (Render), or it doesn't accept this site (ALLOWED_ORIGINS).
        throw new Error(`Le serveur ne répond pas (${new URL(BASE).host}). S'il dormait, réessaie dans une minute ; sinon ${location.origin} doit être dans ALLOWED_ORIGINS sur Render.`)
      }
      if (res.status === 401) throw new Error("Code incorrect.")
      if (!res.ok) throw new Error(`Le serveur a répondu ${res.status} : réessaie dans un instant.`)
      setTester(true, key)
      // A fresh load of a fresh copy: the offline cache may still hold the
      // version from before this page existed, which only knows the wish list.
      await freshStart('/jeu')
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Pas de réseau.')
    } finally {
      setBusy(false)
    }
  }
  const leave = () => {
    setTester(false)
    void freshStart('/')
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
            <p className="mt-4 text-sm font-bold text-[var(--color-ink-soft)]">Ce navigateur est en mode testeur : tout le jeu est ouvert ici, avec la boîte à outils testeur dans le jeu (bouton « Testeur » en haut : changer d'âge, des Djai, besoins au max, finir tout de suite, toutes les applis). Les autres voient toujours la liste d'attente.</p>
            <div className="mt-4 grid gap-2">
              <button className="btn" onClick={() => void freshStart('/jeu')}>
                <Play size={18} /> Jouer
              </button>
              <button className="btn btn-soft" onClick={leave}>
                <LogOut size={18} /> Quitter le mode testeur
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={enter} className="mt-4 grid gap-3">
            <p className="text-sm font-bold text-[var(--color-ink-soft)]">Entre le code testeur (ou la clé d'administration) pour ouvrir tout le jeu sur ce navigateur.</p>
            <label className="grid gap-1">
              <span className="label">Code</span>
              <span className="flex items-center gap-2 rounded-2xl bg-[var(--color-canvas)] px-3">
                <KeyRound size={16} className="text-[var(--color-ink-soft)]" />
                <input className="min-w-0 flex-1 bg-transparent py-3 text-[15px] font-bold outline-none" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} aria-label="Code testeur" />
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
