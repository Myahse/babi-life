import { Baby, Bike, Briefcase, Bus, Car, Heart, Home } from 'lucide-react'
import type { PnjLife } from '../lib/types'
import { t, tn } from '../lib/i18n'

// A PNJ's life as its card tells it (update « pnj-vivants », backend sims/pnjvivants.go PnjLife): its
// home and quartier, its job, who it lives with and its kids, its car, moto or bike (or the woro-woro).
// The same every time one opens it: made up from its id on the server.

export function PnjFacts({ life, compact = false }: { life: PnjLife; /** One line per fact, small (the strip's card). */ compact?: boolean }) {
  const row = `flex min-w-0 items-center gap-1.5 ${compact ? 'text-[11px]' : 'text-[12px]'} font-bold text-[var(--color-ink-soft)]`
  const kids = life.kids ?? []
  const Ride = life.rideKind === 'velo' || life.rideKind === 'moto' ? Bike : life.ride ? Car : Bus
  return (
    <div className="mt-1.5 grid gap-0.5 rounded-xl bg-[#f3f0ff] px-2 py-1.5" data-pnj-life>
      <div className={row}>
        <Home size={13} className="shrink-0 text-[#7048e8]" />
        <span className="truncate">{life.quarter ? t('{0}, quartier {1}', { 0: life.home, 1: life.quarter }) : life.home}</span>
      </div>
      {life.job && (
        <div className={row}>
          <Briefcase size={13} className="shrink-0 text-[#7048e8]" />
          <span className="truncate">{life.level ? `${life.job} · ${life.level}` : life.job}</span>
        </div>
      )}
      {(life.partner || kids.length > 0) && (
        <div className={row}>
          {kids.length ? <Baby size={13} className="shrink-0 text-[#7048e8]" /> : <Heart size={13} className="shrink-0 text-[#7048e8]" />}
          <span className="truncate">
            {[life.partner && t('En couple avec {0}', { 0: life.partner }), kids.length > 0 && `${tn(kids.length, '{n} enfant', '{n} enfants')} : ${kids.map((k) => t('{0} ({1} ans)', { 0: k.name, 1: k.age })).join(', ')}`].filter(Boolean).join(' · ')}
          </span>
        </div>
      )}
      <div className={row}>
        <Ride size={13} className="shrink-0 text-[#7048e8]" />
        {life.ride && life.rideColor && <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/20" style={{ background: life.rideColor }} />}
        <span className="truncate">{life.ride ?? t('À pied et en woro-woro')}</span>
      </div>
    </div>
  )
}
