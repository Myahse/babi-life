import { Orbit, X } from 'lucide-react'
import type { Sim, World } from '../lib/types'
import { t as tr } from '../lib/i18n'
import { keyOpen, useFeatures } from '../lib/features'
import { cityOf, launchRules } from '../lib/espace'
import { amount } from '../game/rules'

// The solar system's map (the updates « espace-* », lib/espace.ts): workstream A's placeholder, the planets in a
// row of blocks, what's open, where the Sim is. D's SolarMap (the planets in 3D blocks) replaces it.

const BODIES: { id: string; name: () => string; color: string; size: number; dest?: string }[] = [
  { id: 'soleil', name: () => tr('Le Soleil'), color: '#ffd43b', size: 44 },
  { id: 'venus', name: () => tr('Vénus'), color: '#f2c48d', size: 20 },
  { id: 'terre', name: () => tr('La Terre'), color: '#1d5fb8', size: 22, dest: 'station' },
  { id: 'lune', name: () => tr('La Lune'), color: '#ced4da', size: 12, dest: 'lune' },
  { id: 'mars', name: () => tr('Mars'), color: '#c0392b', size: 16, dest: 'mars' },
  { id: 'jupiter', name: () => tr('Jupiter'), color: '#d9a066', size: 36 },
  { id: 'saturne', name: () => tr('Saturne'), color: '#e9d8a6', size: 30 },
]

export function SolarMap({ world, sim, onClose }: { world: World; sim: Sim; onClose: () => void }) {
  const feats = useFeatures()
  const rules = launchRules(world)
  const here = cityOf(world, sim.city)
  return (
    <div className="animate-up absolute inset-0 z-50 overflow-y-auto bg-[#02030a] p-4 pt-[max(1rem,var(--sat,env(safe-area-inset-top)))] text-white">
      <div className="flex items-center gap-2">
        <Orbit size={20} className="text-[#ff7a00]" />
        <h2 className="flex-1 text-lg font-extrabold">{tr('Le système solaire')}</h2>
        <button className="grid h-11 w-11 place-items-center rounded-full bg-white/10" onClick={onClose} aria-label={tr('Fermer')}>
          <X size={18} />
        </button>
      </div>
      <p className="mt-1 text-xs font-bold opacity-70">{tr('Tu es ici : {name}', { name: here?.name ?? sim.city })}</p>
      <div className="mt-6 flex items-end justify-center gap-3">
        {BODIES.map((b) => (
          <div key={b.id} className="flex flex-col items-center gap-1">
            <div style={{ width: b.size, height: b.size, background: b.color }} className="rounded-[3px] shadow-[inset_-4px_-4px_0_rgba(0,0,0,0.25)]" />
            <span className="text-[10px] font-bold opacity-80">{b.name()}</span>
          </div>
        ))}
      </div>
      <ul className="mt-6 grid gap-2">
        {rules.destinations.map((d) => {
          const open = keyOpen(feats, d.key)
          return (
            <li key={d.id} className="rounded-2xl bg-white/10 p-3">
              <div className="text-sm font-extrabold">{d.name}</div>
              <div className="text-xs font-bold opacity-75">{open ? tr('Ouvert · billet {price} F au pas de tir d’un spatioport', { price: amount(d.price) }) : tr('Bientôt')}</div>
            </li>
          )
        })}
        {[tr('Vénus'), tr('Jupiter'), tr('Saturne')].map((n) => (
          <li key={n} className="rounded-2xl bg-white/5 p-3 text-sm font-bold opacity-60">
            {n} · {tr('Bientôt')}
          </li>
        ))}
      </ul>
    </div>
  )
}
