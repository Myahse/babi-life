import { useEffect, useRef, useState } from 'react'
import { Car, CarTaxiFront, Phone, PhoneOff } from 'lucide-react'
import { amount } from '../game/rules'
import { inkOn, type RideLook } from '../game/rides'
import { t as tr } from '../lib/i18n'

export type Call = { look: RideLook; mode: string; driver: string; plate: string; eta: number; fare: number; from: string; woro?: string }

const DRIVERS = [tr('Konan'), tr('Kouamé'), tr('Yao'), tr('Koffi'), tr('Drissa'), tr('Moussa'), tr('Seydou'), tr('Adama'), tr('Ibrahim'), tr('Serge'), tr('Didier'), tr('Brice'), tr('Lassina'), tr('Arouna')]

/** A driver for this booking: name, plate and how far away, picked at random. */
export function newCall(look: RideLook, mode: string, fare: number, from: string, woro?: string): Call {
  const r = (n: number) => Math.floor(Math.random() * n)
  const L = 'ABCDEFGHJKLMNPRSTUVWXYZ'
  return { look, mode, fare, from, woro, driver: DRIVERS[r(DRIVERS.length)], plate: `${1000 + r(9000)} ${L[r(L.length)]}${L[r(L.length)]} 01`, eta: 2 + r(6) }
}

function line(c: Call) {
  const eta = `${c.eta} minute${c.eta > 1 ? 's' : ''}`
  switch (c.mode) {
    case 'woro':
      return tr("Allô ? C'est {driver}, le woro-woro {0} de {from}. Je suis au carrefour, j'arrive dans {eta}. On complète les places et on part !", { driver: c.driver, 0: c.woro ?? '', from: c.from, eta })
    case 'compteur':
      return tr("Allô, c'est {driver}, ton taxi compteur. Je suis à {eta} de toi. Cherche le taxi orange, plaque {plate}.", { driver: c.driver, eta, plate: c.plate })
    case 'idrive':
      return tr("Allô, c'est {driver} d'iDrive. J'ai accepté ton prix de {0} Djai. J'arrive dans {eta}, plaque {plate}.", { driver: c.driver, 0: amount(c.fare), eta, plate: c.plate })
    default: {
      // In the better classes, the driver mentions what's waiting in the car.
      const extra = c.look.name.endsWith('Confort+') ? tr(" La clim est allumée et une bouteille d'eau vous attend.") : c.look.name.endsWith('Confort') ? tr(" La clim marche bien, vous allez être à l'aise.") : ''
      return tr("Allô, bonjour ! C'est {driver}, ton chauffeur {name}. Je suis en route, j'arrive dans {eta}. Plaque {plate}.{extra}", { driver: c.driver, name: c.look.name, eta, plate: c.plate, extra })
    }
  }
}

/** The phone rings: two short tones, like a call coming in. Silent if the browser refuses. */
function useRing(on: boolean) {
  useEffect(() => {
    if (!on) return
    let ctx: AudioContext | null = null
    try {
      ctx = new AudioContext()
    } catch {
      return
    }
    const ring = () => {
      if (!ctx) return
      const t = ctx.currentTime
      for (const [start, f] of [[0, 880], [0.25, 740]] as const) {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.frequency.value = f
        g.gain.setValueAtTime(0.0001, t + start)
        g.gain.exponentialRampToValueAtTime(0.12, t + start + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, t + start + 0.22)
        o.connect(g).connect(ctx.destination)
        o.start(t + start)
        o.stop(t + start + 0.24)
      }
      navigator.vibrate?.([200, 100, 200])
    }
    ring()
    const id = setInterval(ring, 1600)
    return () => {
      clearInterval(id)
      ctx?.close().catch(() => {})
    }
  }, [on])
}

/** The driver calls to say they're coming. */
export function DriverCall({ call, onClose, embedded }: { call: Call; onClose: () => void; embedded?: boolean }) {
  const [answered, setAnswered] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const closing = useRef(onClose)
  closing.current = onClose
  useRing(answered === null)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])
  // Nobody picks up after 20 s; after answering, the driver hangs up when done.
  useEffect(() => {
    const t = setTimeout(() => closing.current(), answered === null ? 20000 : 9000)
    return () => clearTimeout(t)
  }, [answered])

  const secs = answered === null ? 0 : Math.floor((now - answered) / 1000)
  const Icon = call.look.app ? Car : CarTaxiFront
  const role = call.look.app ? tr('Chauffeur {name}', { name: call.look.name }) : call.mode === 'woro' ? tr('Woro-woro de {from}', { from: call.from }) : call.look.name

  return (
    <div className={`absolute inset-0 z-[70] flex items-end justify-center p-3 sm:items-center ${embedded ? '' : 'bg-black/45 backdrop-blur-[2px]'}`} role="dialog" aria-modal="true" aria-label={tr('Appel de {driver}', { driver: call.driver })}>
      <div className="animate-pop w-full max-w-[360px] overflow-hidden rounded-[28px] bg-[linear-gradient(170deg,#262b63,#0f1230)] p-5 text-white shadow-2xl">
        <div className="text-center text-xs font-extrabold tracking-wider text-white/60 uppercase">{answered === null ? tr('Appel entrant…') : tr('En ligne · 0:{0}', { 0: String(secs).padStart(2, '0') })}</div>
        <div className="mt-4 flex flex-col items-center gap-2">
          <span className="relative grid h-20 w-20 place-items-center rounded-full border-4 border-white/90" style={{ background: call.look.color, boxShadow: call.look.trim ? `inset 0 -12px 0 ${call.look.trim}` : undefined }}>
            {answered === null && <span className="absolute inset-0 animate-ping rounded-full border-4 border-white/40" />}
            <Icon size={36} color={inkOn(call.look.color)} strokeWidth={2.2} />
          </span>
          <div className="font-display text-2xl font-extrabold">{call.driver}</div>
          <div className="text-sm font-bold text-white/70">{role}</div>
        </div>

        {answered !== null && <p className="animate-pop mt-4 rounded-2xl rounded-tl-sm bg-white/12 p-3 text-[15px] leading-snug font-bold">{line(call)}</p>}

        <div className="mt-5 flex justify-center gap-10">
          {answered === null ? (
            <>
              <CallButton label={tr('Refuser')} color="#ff4d6d" onClick={onClose} icon={<PhoneOff size={26} />} />
              <CallButton label={tr('Décrocher')} color="#00b86b" onClick={() => setAnswered(Date.now())} icon={<Phone size={26} />} ring />
            </>
          ) : (
            <CallButton label={tr('Raccrocher')} color="#ff4d6d" onClick={onClose} icon={<PhoneOff size={26} />} />
          )}
        </div>
      </div>
    </div>
  )
}

function CallButton({ label, color, onClick, icon, ring }: { label: string; color: string; onClick: () => void; icon: React.ReactNode; ring?: boolean }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 text-xs font-extrabold text-white/80">
      <span className={`grid h-16 w-16 place-items-center rounded-full text-white shadow-lg transition-transform active:scale-95 ${ring ? 'animate-bounce' : ''}`} style={{ background: color }}>
        {icon}
      </span>
      {label}
    </button>
  )
}
