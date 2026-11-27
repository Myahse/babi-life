import { lazy, Suspense, useEffect, useState, useSyncExternalStore, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import { Car, Gamepad2, Moon, Radar, Rocket, Sprout, Wrench, type LucideIcon } from 'lucide-react'
import type { ActionResult, Sim } from '../../../lib/types'
import { api } from '../../../lib/api'
import { t as tr } from '../../../lib/i18n'
import { ESPACE_JEUX, type EspaceJeuKind } from '../../../lib/espace'
import type { GameProps } from './types'

// The six games of « espace-jeux » (backend sims/espaceJeux.go) over the whole screen, whatever the scene (Play.tsx
// mounts this once, the update open): its action begun, the game opens (once), and a button brings it back while
// it's not played; once open it stays open when its action ends (its score still counts a little after).

const GAMES: Record<EspaceJeuKind, { load: () => Promise<{ default: ComponentType<GameProps> }>; icon: LucideIcon; label: () => string }> = {
  amarrage: { load: () => import('./Amarrage').then((m) => ({ default: m.Amarrage })), icon: Rocket, label: () => tr('Piloter l’amarrage') },
  alunissage: { load: () => import('./Alunissage').then((m) => ({ default: m.Alunissage })), icon: Moon, label: () => tr('Prendre les commandes') },
  margouillat: { load: () => import('./Margouillat').then((m) => ({ default: m.MargouillatJeu })), icon: Car, label: () => tr('Conduire le Margouillat') },
  serre: { load: () => import('./Serre').then((m) => ({ default: m.SerreJeu })), icon: Sprout, label: () => tr('Ouvrir la serre') },
  reparation: { load: () => import('./Reparation').then((m) => ({ default: m.Reparation })), icon: Wrench, label: () => tr('Sortir réparer') },
  controle: { load: () => import('./SalleControle').then((m) => ({ default: m.SalleControle })), icon: Radar, label: () => tr('Prendre la console') },
}
const LAZY = Object.fromEntries(Object.entries(GAMES).map(([k, g]) => [k, lazy(g.load)])) as unknown as Record<EspaceJeuKind, ComponentType<GameProps>>

/** The game open now (kept outside the scenes: the action's end doesn't close it). */
type Open = { kind: EspaceJeuKind; id: string; key: string } | null
let open: Open = null
const subs = new Set<() => void>()
const seen = new Set<string>()
const played = new Set<string>()
function setOpen(g: Open) {
  open = g
  subs.forEach((f) => f())
}
const useOpen = () => useSyncExternalStore((f) => (subs.add(f), () => void subs.delete(f)), () => open)

/** The game of an action (its id), if it's one of the six. */
export const jeuOfAction = (id?: string): EspaceJeuKind | undefined => (id ? ESPACE_JEUX[id] : undefined)

export function JeuxHost({ sim, onResult }: { sim: Sim; onResult?: (r: ActionResult) => void }) {
  const g = useOpen()
  const a = sim.activity?.kind === 'do' ? sim.activity : null
  const id = a?.interaction.id ?? ''
  const kind = jeuOfAction(id)
  const key = `${id}@${a?.start ?? 0}`
  const [, redraw] = useState(0)
  // Its action begun: the game opens by itself, once.
  useEffect(() => {
    if (!kind || seen.has(key) || played.has(key)) return
    seen.add(key)
    setOpen({ kind, id, key })
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  if (g) {
    const Game = LAZY[g.kind]
    const close = () => (setOpen(null), redraw((n) => n + 1))
    const send = (score: number) =>
      api.espaceJeu(sim.id, g.kind, score).then((r) => {
        played.add(g.key)
        onResult?.(r)
        return r.outcome.text
      })
    return createPortal(
      <Suspense fallback={<div className="fixed inset-0 z-[70] grid place-items-center bg-black"><span className="h-10 w-10 animate-spin rounded-full border-4 border-white border-t-transparent" /></div>}>
        <Game id={g.id} look={sim.look} send={send} onClose={close} />
      </Suspense>,
      document.body,
    )
  }
  // Just docked at the station (the Pirogue's arrival), idle: the docking flown by hand, from the capsule, offered.
  const v = sim.life?.espace?.voyage
  const docked = sim.city === 'station-akwaba' && !sim.activity && !!v?.arrived && sim.gameMinutes - v.arrived < 30 && !seen.has(`dock@${v.arrived}`)
  if (!kind && docked) {
    const k = `dock@${v!.arrived}`
    const fly = () => {
      seen.add(k)
      void api.interact(sim.id, 'akwaba-sas', 'station-amarrage').then((r) => onResult?.(r), () => redraw((n) => n + 1))
    }
    return createPortal(
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--sab,env(safe-area-inset-bottom))+9.5rem)] z-[60] flex justify-center gap-2">
        <button className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#ff7a00] px-5 py-3 text-sm font-extrabold text-white shadow-lg active:scale-95" onClick={fly}>
          <Rocket size={17} /> {tr('Refaire l’amarrage à la main')}
        </button>
        <button className="pointer-events-auto rounded-full bg-black/60 px-4 py-3 text-sm font-extrabold text-white" onClick={() => (seen.add(k), redraw((n) => n + 1))}>
          {tr('Plus tard')}
        </button>
      </div>,
      document.body,
    )
  }
  if (!kind || played.has(key)) return null
  const G = GAMES[kind]
  const Icon = G.icon ?? Gamepad2
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--sab,env(safe-area-inset-bottom))+9.5rem)] z-[60] flex justify-center">
      <button className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#ff7a00] px-5 py-3 text-sm font-extrabold text-white shadow-lg active:scale-95" onClick={() => setOpen({ kind, id, key })}>
        <Icon size={17} /> {G.label()}
      </button>
    </div>,
    document.body,
  )
}
