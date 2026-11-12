import { useEffect, useRef, useState } from 'react'
import { MapPin, Signpost } from 'lucide-react'
import type { Commune } from '../lib/types'
import { whereabouts } from '../world3d/whereabouts'
import { ZONES, ZONE_COLOURS, zoneAt } from '../world3d/open/quartiers'
import { t as tr } from '../lib/i18n'

// The name of where the Sim just walked into (the update « communes-detail »): a zone (« Zone
// industrielle de Yopougon », « Black Market », « Zone 4 ») or a carrefour (« Carrefour Sable »),
// come down from the top for a few seconds, the way a game names a new area. Asked once a second
// from where the Sim stands (whereabouts), nothing per frame; said once per entry, not again while it
// stays in it.

/** A carrefour holds this far round its point (metres). */
const AT_CARREFOUR = 45
const SHOWN = 3400

type Shown = { id: string; name: string; sub: string; colour: string; carrefour: boolean }

export function ZoneBanner({ commune, hidden }: { commune: Commune; hidden?: boolean }) {
  const [shown, setShown] = useState<Shown | null>(null)
  const [up, setUp] = useState(false)
  const inside = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const zones = ZONES.filter((z) => z.commune === commune.id)
    const corners = commune.places.filter((p) => p.kind === 'carrefour')
    inside.current = undefined
    let hide = 0
    const look = () => {
      const local = whereabouts.toLocal
      if (!local || !whereabouts.streetReady) return
      const at = whereabouts.sim
      const corner = corners.find((p) => {
        const [x, z] = local(p.lat, p.lng)
        return Math.hypot(x - at[0], z - at[1]) < AT_CARREFOUR
      })
      const zone = corner ? null : zoneAt(zones, at, local)
      const id = corner?.id ?? zone?.id ?? null
      // The first look only learns where the Sim already is (it was born there, it came by taxi): nothing said.
      const first = inside.current === undefined
      if (id === inside.current) return
      inside.current = id
      if (first || !id) return
      setShown(corner ? { id, name: corner.name, sub: tr('Carrefour · on s’y donne rendez-vous'), colour: '#0b5f36', carrefour: true } : { id, name: zone!.name, sub: commune.name, colour: ZONE_COLOURS[zone!.style][0], carrefour: false })
      setUp(true)
      clearTimeout(hide)
      hide = window.setTimeout(() => setUp(false), SHOWN)
    }
    const k = setInterval(look, 1000)
    return () => {
      clearInterval(k)
      clearTimeout(hide)
    }
  }, [commune])
  if (!shown) return null
  const Icon = shown.carrefour ? Signpost : MapPin
  return (
    <div className={`pointer-events-none absolute inset-x-0 top-[calc(7.5rem+var(--sat,env(safe-area-inset-top)))] z-10 flex justify-center px-6 transition-all duration-500 ease-[var(--ease-spring)] ${up && !hidden ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`} aria-live="polite">
      <div className="hud flex max-w-full items-center gap-2.5 rounded-2xl py-2 pr-4 pl-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: shown.colour }}>
          <Icon size={20} strokeWidth={2.6} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-[17px] leading-tight font-extrabold">{shown.name}</span>
          <span className="block truncate text-xs font-bold text-[var(--color-ink-soft)]">{shown.sub}</span>
        </span>
      </div>
    </div>
  )
}
