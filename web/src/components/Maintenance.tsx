import { useEffect, useState } from 'react'
import { SplashDancer } from './SplashDancer'
import { t } from '../lib/i18n'
import { WHATSAPP_COMMUNITY } from '../lib/contact'
import { useWorld } from '../store/world'
import { create } from 'zustand'

/** The maintenance page is up: the offline banner (« tu peux jouer ») would say the opposite, it stays hidden. */
export const useMaintenance = create<{ on: boolean }>(() => ({ on: false }))

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'
// How often the page asks again on its own, and how long one try may hang (a server that's down
// keeps the connection open without a word: the browser alone would wait for minutes).
const RETRY_MS = 20_000
const TRY_MS = 15_000

/** One try at the world, never hanging: true when the server answered with it (it's then loaded for the game). */
async function tryWorld() {
  const ctl = new AbortController()
  const stop = setTimeout(() => ctl.abort(), TRY_MS)
  try {
    const res = await fetch(`${BASE}/world`, { signal: ctl.signal })
    if (!res.ok) return false
    await useWorld.getState().load()
    return !!useWorld.getState().world
  } catch {
    return false
  } finally {
    clearTimeout(stop)
  }
}

/**
 * The server can't be reached (its database stopped, a deploy that failed): a calm page instead of a
 * loading that never ends. It asks again by itself every 20 s and lets the game in as soon as it answers.
 */
export function Maintenance() {
  const [trying, setTrying] = useState(false)
  const retry = async () => {
    if (trying) return
    setTrying(true)
    await tryWorld()
    setTrying(false)
  }
  useEffect(() => {
    useMaintenance.setState({ on: true })
    const id = setInterval(() => void tryWorld(), RETRY_MS)
    return () => (clearInterval(id), useMaintenance.setState({ on: false }))
  }, [])
  return (
    <div className="relative grid h-full w-full place-items-center overflow-auto bg-[#fff4e8] px-6 py-10 text-[var(--color-ink)]" role="status" aria-live="polite">
      <div className="flex max-w-sm flex-col items-center text-center">
        <SplashDancer size={92} />
        <h1 className="mt-5 text-2xl font-black">{t('Petite pause, on revient vite !')}</h1>
        <p className="mt-3 text-base font-semibold text-[var(--color-ink)]/70">{t("Babi Life est en maintenance pour quelques instants. Ton perso, ton argent et ta maison sont bien gardés : rien n'est perdu.")}</p>
        <p className="mt-2 text-sm font-semibold text-[var(--color-ink)]/55">{t('La page se relance toute seule dès que le jeu est de retour.')}</p>
        <button type="button" onClick={retry} disabled={trying} className="mt-6 w-full rounded-2xl bg-[var(--color-orange)] px-5 py-3.5 text-base font-black text-white shadow-[0_4px_0_rgba(0,0,0,0.18)] active:translate-y-0.5 disabled:opacity-60">
          {trying ? t('On regarde…') : t('Réessayer')}
        </button>
        <a href={WHATSAPP_COMMUNITY} target="_blank" rel="noreferrer" className="mt-3 w-full rounded-2xl bg-[#25d366] px-5 py-3.5 text-base font-black text-white shadow-[0_4px_0_rgba(0,0,0,0.18)]">
          {t('Les nouvelles sur la communauté WhatsApp')}
        </a>
      </div>
    </div>
  )
}
