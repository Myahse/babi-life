import { CarTaxiFront, ChevronRight, Home, Map as MapIcon, MapPin, Motorbike, X } from 'lucide-react'
import { t as tr, tx } from '../lib/i18n'
import { IconTile } from './ui'
import type { BabiZone } from '../world3d/open/babiZones'
import { RIDES, rideFare, type RideKind } from '../world3d/moto'

// « babi-quartiers »: the world of Babi one real neighbourhood at a time (world3d/open/babiZones.ts). Over the street:
// where one is (the neighbourhood, its commune, who plays here; « Vue du quartier »: the map on it, its places marked), its edge (« Aller à côté », « La carte »), and the
// commune's neighbourhoods to go to by taxi.

/** Where one is: the neighbourhood and its commune, how many play here; a tap: the commune's neighbourhoods. */
export function ZoneBar({ zone, communeName, online, onPick, onLook, onHome }: { zone: BabiZone; communeName: string; online?: number; onPick: () => void; /** « Vue du quartier »: the map on it, its places marked. */ onLook: () => void; /** « mon-quartier » open: the way back to one's own quartier. */ onHome?: () => void }) {
  return (
    <div className="pointer-events-auto flex max-w-full flex-col items-start gap-1.5">
      <button className="hud pointer-events-auto flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-extrabold" onClick={onPick}>
        <MapPin size={13} strokeWidth={2.8} className="shrink-0 text-[#e8731f]" />
        <span className="truncate">{tx('{0} · {1}', { 0: zone.name, 1: communeName })}</span>
        {online !== undefined && (
          <>
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#2fb36b]" />
            <span className="tnum">{online}</span>
          </>
        )}
        <ChevronRight size={14} className="shrink-0 text-[var(--color-ink-soft)]" />
      </button>
      <button className="hud pointer-events-auto flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-extrabold" onClick={onLook}>
        <MapIcon size={13} strokeWidth={2.8} className="shrink-0 text-[#1c7a4a]" /> {tr('Vue du quartier')}
      </button>
      {onHome && (
        <button className="btn flex items-center gap-1.5 !bg-[#e8731f] !px-4 !py-2 !text-sm" onClick={onHome}>
          <Home size={15} /> {tr('Rentrer au quartier')}
        </button>
      )}
    </div>
  )
}

/** At the neighbourhood's edge: the ones next to it, by taxi, or the map. */
export function ZoneEdge({ zone, near, onGo, onMap, onStay }: { zone: BabiZone; near: BabiZone[]; onGo: (z: BabiZone) => void; onMap: () => void; onStay: () => void }) {
  return (
    <div className="hud pointer-events-auto w-[min(100%,320px)] rounded-2xl p-3 text-left" data-edge>
      <div className="font-display text-[15px] leading-tight font-extrabold">{tr('Le bout de {0}', { 0: zone.name })}</div>
      <div className="mt-0.5 text-xs font-bold text-[var(--color-ink-soft)]">{tr('Pour aller plus loin, on prend un taxi.')}</div>
      <div className="mt-2 grid gap-1.5">
        {near.slice(0, 2).map((z) => (
          <button key={z.id} className="btn btn-soft flex items-center justify-center gap-1.5 !py-1.5 !text-xs" onClick={() => onGo(z)}>
            <CarTaxiFront size={14} /> <span className="truncate">{tr('Aller à {0}', { 0: z.name })}</span>
          </button>
        ))}
        <div className="grid grid-cols-2 gap-1.5">
          <button className="btn btn-soft !py-1.5 !text-xs" onClick={onStay}>
            {tr('Rester')}
          </button>
          <button className="btn flex items-center justify-center gap-1.5 !bg-[#1c7a4a] !py-1.5 !text-xs" onClick={onMap}>
            <MapIcon size={14} /> {tr('La carte')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** The commune's neighbourhoods: tap one to go there by taxi (the one one is in, marked). */
export function ZoneSheet({ zones, current, communeName, onGo, onMap, onClose }: { zones: BabiZone[]; current: BabiZone | null; communeName: string; onGo: (z: BabiZone) => void; onMap: () => void; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up flex max-h-[86vh] w-full flex-col overflow-hidden rounded-t-[28px] pb-[max(1rem,var(--sab,env(safe-area-inset-bottom)))] lg:w-[460px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 pb-2">
          <IconTile icon={MapPin} colors={['#ffa040', '#e8731f']} size={48} />
          <div className="min-w-0 flex-1">
            <div className="label">{communeName}</div>
            <div className="font-display text-[22px] leading-tight font-extrabold">{tr('Les quartiers')}</div>
            <div className="text-xs font-bold text-[var(--color-ink-soft)]">{tr('On y va en taxi.')}</div>
          </div>
          <button className="icon-btn bg-[var(--color-canvas)]" onClick={onClose} aria-label={tr('Fermer')}>
            <X size={22} strokeWidth={2.6} />
          </button>
        </div>
        <div className="space-y-1.5 overflow-y-auto px-4 pt-1 pb-2">
          {zones.map((z) => {
            const here = z.id === current?.id
            return (
              <button key={z.id} className="tile flex w-full items-center gap-3 p-2.5 text-left disabled:opacity-60" disabled={here} onClick={() => onGo(z)}>
                <IconTile icon={here ? MapPin : CarTaxiFront} colors={here ? ['#69e2a0', '#00a862'] : ['#ffd54f', '#ffa000']} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[15px] leading-tight font-extrabold">{z.name}</span>
                  <span className="text-xs font-bold text-[var(--color-ink-soft)]">{here ? tr('Tu es ici') : tr('En taxi')}</span>
                </span>
              </button>
            )
          })}
          <button className="btn btn-soft mt-1 flex w-full items-center justify-center gap-1.5" onClick={onMap}>
            <MapIcon size={16} /> {tr('Une autre commune : la carte')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** How one goes to another neighbourhood: behind a moto-taxi or in a taxi, the fare by the distance (backend sims/moto.go). */
export function ZoneRide({ zone, to, metres, money, onRide, onClose }: { zone: BabiZone; /** A place there, if that's where one goes. */ to?: string; metres: number; money: number; onRide: (kind: RideKind) => void; onClose: () => void }) {
  const km = (metres / 1000).toFixed(1).replace('.', ',')
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up flex w-full flex-col rounded-t-[28px] p-4 pb-[max(1rem,var(--sab,env(safe-area-inset-bottom)))] lg:w-[460px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <IconTile icon={CarTaxiFront} colors={['#ffd54f', '#ffa000']} size={48} />
          <div className="min-w-0 flex-1">
            <div className="label">{tx('{0} km', { 0: km })}</div>
            <div className="font-display text-[22px] leading-tight font-extrabold">{tr('Vers {0}', { 0: to ?? zone.name })}</div>
            {to && <div className="text-xs font-bold text-[var(--color-ink-soft)]">{zone.name}</div>}
          </div>
          <button className="icon-btn bg-[var(--color-canvas)]" onClick={onClose} aria-label={tr('Fermer')}>
            <X size={22} strokeWidth={2.6} />
          </button>
        </div>
        <div className="mt-3 grid gap-1.5">
          {(['moto', 'taxi'] as RideKind[]).map((k) => {
            const fare = rideFare(k, metres)
            return (
              <button key={k} className="tile flex w-full items-center gap-3 p-2.5 text-left disabled:opacity-50" disabled={money < fare} onClick={() => onRide(k)}>
                <IconTile icon={k === 'moto' ? Motorbike : CarTaxiFront} colors={k === 'moto' ? ['#ff8a80', '#c92a2a'] : ['#ffd54f', '#ffa000']} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[15px] leading-tight font-extrabold">{RIDES[k].name}</span>
                  <span className="text-xs font-bold text-[var(--color-ink-soft)]">{money < fare ? tr('Pas assez de Djai') : k === 'moto' ? tr('Le moins cher') : tr('Plus confortable')}</span>
                </span>
                <span className="tnum font-display text-[15px] font-extrabold">{tx('{0} F', { 0: fare.toLocaleString('fr-FR') })}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
