import { useState } from 'react'
import { Check, Download, Star, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import type { Sim, World } from '../lib/types'
import { AppLogo } from '../components/AppLogo'
import type { Act } from './phoneApps'

// Made-up store ratings, part of the game's world.
const RATING: Record<string, number> = { waye: 4.8, gnango: 4.3, idrive: 4.1, golvo: 4.4, gbairai: 4.6, tikitoko: 4.5 }

/** The phone's app store: install and remove the apps of the game. */
export function StoreApp({ world, sim, act, onOpen }: { world: World; sim: Sim; act: Act; onOpen: (id: string) => void }) {
  const [busy, setBusy] = useState<{ id: string; progress: number } | null>(null)
  const installed = (id: string) => sim.apps?.includes(id) ?? false

  const install = (id: string, name: string) => {
    // The download: a few seconds of progress, then the server installs it.
    setBusy({ id, progress: 0 })
    const t0 = Date.now()
    const tick = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / 2200)
      setBusy({ id, progress: p })
      if (p >= 1) {
        clearInterval(tick)
        act(`Installer ${name}`, 'download', '', () => api.setApp(sim.id, id, true)).finally(() => setBusy(null))
      }
    }, 80)
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-[linear-gradient(135deg,#3b5bfd,#7a5cff)] p-4 text-white">
        <div className="text-xs font-extrabold tracking-wider uppercase opacity-80">Babi Store</div>
        <div className="font-display text-2xl leading-tight font-extrabold">Les applis d'Abidjan</div>
        <div className="mt-1 text-sm font-bold opacity-85">Argent mobile, transport, repas livrés.</div>
      </div>
      <ul className="space-y-2">
        {(world.phoneApps ?? []).map((a) => {
          const on = installed(a.id)
          const loading = busy?.id === a.id
          return (
            <li key={a.id} className="rounded-2xl border border-[var(--color-line)] bg-white p-3">
              <div className="flex items-center gap-3">
                <AppLogo id={a.id} size={52} radius={15} />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-lg leading-tight font-extrabold">{a.name}</div>
                  <div className="truncate text-xs font-bold text-[var(--color-ink-soft)]">{a.tagline}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] font-extrabold text-[var(--color-ink-soft)]">
                    <span className="flex items-center gap-0.5">
                      <Star size={11} className="fill-[var(--color-gold)] text-[var(--color-gold)]" /> {RATING[a.id] ?? 4}
                    </span>
                    <span>{a.category}</span>
                    <span>{a.sizeMB} Mo</span>
                  </div>
                </div>
                {on ? (
                  <button className="btn btn-soft !px-4 !py-2 !text-sm" onClick={() => onOpen(a.id)}>
                    Ouvrir
                  </button>
                ) : (
                  <button className="btn !px-4 !py-2 !text-sm" disabled={!!busy} onClick={() => install(a.id, a.name)} aria-label={`Installer ${a.name}`}>
                    {loading ? `${Math.round(busy!.progress * 100)} %` : <Download size={16} />}
                    {!loading && 'Installer'}
                  </button>
                )}
              </div>
              {loading && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-canvas)]">
                  <div className="h-full rounded-full bg-[#3b5bfd]" style={{ width: `${busy!.progress * 100}%` }} />
                </div>
              )}
              <p className="mt-2 text-xs font-bold text-[var(--color-ink-soft)]">{a.about}</p>
              {on && (
                <div className="mt-2 flex items-center justify-between text-[11px] font-extrabold text-[var(--color-emerald-deep)]">
                  <span className="flex items-center gap-1">
                    <Check size={12} strokeWidth={3} /> Installée
                  </span>
                  <button className="flex items-center gap-1 text-[var(--color-ink-soft)]" onClick={() => act(`Désinstaller ${a.name}`, 'trash', '', () => api.setApp(sim.id, a.id, false))}>
                    <Trash2 size={12} /> Désinstaller
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
