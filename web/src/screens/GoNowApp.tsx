import { useEffect, useState } from 'react'
import { Heart, Hotel, MapPin } from 'lucide-react'
import { api, errorText } from '../lib/api'
import { useSession } from '../store/session'
import type { ActionResult, Sim } from '../lib/types'
import { amount } from '../game/rules'
import { Chip, Row } from '../components/ui'
import { t as tr, tx } from '../lib/i18n'
import type { Act } from './phoneApps'

// GoNow: adult night booking (backend sims/gonow.go). 18+ + adult_at. Real 3D scenes.

type Service = { id: string; label: string; about: string; price: number; hotel: number; minutes: number }
type Profile = { id: string; name: string; commune: string; about: string; tier: string; gender: 'femme' | 'homme'; seed: number }
type View = { adult: boolean; profiles: Profile[]; services: Service[]; prices: Record<string, Record<string, number>> }

type Props = { sim: Sim; act: Act; onConfirmAdult: () => Promise<void>; onResult: (r: ActionResult) => void }

export function GoNowApp({ sim, act, onConfirmAdult, onResult }: Props) {
  const adult = useSession((s) => !!s.user?.adult)
  const [view, setView] = useState<View | null>(null)
  const [pick, setPick] = useState<Profile | null>(null)
  const [where, setWhere] = useState<'app' | 'hotel'>('app')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void api.gonow(sim.id).then(setView).catch((e) => setErr(errorText(e, tr('Erreur'))))
  }, [sim.id])

  if (!adult) {
    return (
      <div className="-mx-3 -mt-1 min-h-full p-4 text-white" style={{ background: 'radial-gradient(circle at 50% 0%, #6b1f4a, #1a0814 60%)' }}>
        <Brand />
        <p className="mt-4 rounded-2xl bg-black/30 p-4 text-sm font-bold">{tr('GoNow, c’est à partir de 18 ans. Tu confirmes ton âge une fois pour le compte.')}</p>
        <button className="btn mt-3 w-full !py-2" onClick={() => void onConfirmAdult()}>
          {tr('J’ai 18 ans ou plus')}
        </button>
      </div>
    )
  }
  if (!view) return <p className="p-3 text-sm font-bold text-[var(--color-ink-soft)]">{err || '…'}</p>

  const book = async (svc: Service) => {
    if (!pick) return
    setBusy(true)
    setErr('')
    try {
      const res = await api.gonowBook(sim.id, pick.id, svc.id, where)
      onResult(res)
      void act(tr('{label} · {name}', { label: svc.label, name: pick.name }), 'heart', 'club', async () => res)
    } catch (e) {
      setErr(errorText(e, tr('Erreur')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="-mx-3 -mt-1 min-h-full space-y-3 p-3 pb-8 text-white" style={{ background: 'radial-gradient(circle at 40% 0%, #8a2a5a, #1a0814 55%)' }}>
      <Brand />
      {!pick ? (
        <>
          <p className="text-sm font-bold text-white/75">{tr('Choisis quelqu’un. La scène se joue en 3D — rien n’est flouté.')}</p>
          <ul className="space-y-2">
            {view.profiles.map((p) => (
              <button key={p.id} type="button" onClick={() => setPick(p)} className="flex w-full items-start gap-3 rounded-2xl bg-white/10 p-3 text-left transition active:scale-[0.99]">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#ff7ab0] to-[#c2185b] font-display text-lg font-extrabold">{p.name[0]}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[17px] font-extrabold">{p.name}</div>
                  <div className="flex flex-wrap gap-1 text-xs font-bold text-white/65">
                    <span className="inline-flex items-center gap-0.5"><MapPin size={11} /> {p.commune}</span>
                    <Chip tone="dark">{p.tier}</Chip>
                  </div>
                  <p className="mt-1 text-[13px] font-semibold text-white/80">{p.about}</p>
                </div>
              </button>
            ))}
          </ul>
        </>
      ) : (
        <>
          <button type="button" className="text-sm font-extrabold text-white/70" onClick={() => setPick(null)}>← {pick.name}</button>
          <p className="text-sm font-bold text-white/75">{pick.about}</p>
          <div className="flex gap-2">
            <button type="button" disabled={pick.tier === 'suite'} className={`flex-1 rounded-2xl px-3 py-2 text-sm font-extrabold ${where === 'app' ? 'bg-white text-[#6b1f4a]' : 'bg-white/10'}`} onClick={() => setWhere('app')}>
              {tr('Près de toi')}
            </button>
            <button type="button" className={`flex-1 rounded-2xl px-3 py-2 text-sm font-extrabold ${where === 'hotel' ? 'bg-white text-[#6b1f4a]' : 'bg-white/10'}`} onClick={() => setWhere('hotel')}>
              <Hotel size={14} className="mr-1 inline" /> {tr('Hôtel')}
            </button>
          </div>
          {pick.tier === 'suite' && <p className="text-xs font-bold text-[#ffb4d4]">{tr('Ce profil ne se voit qu’à l’hôtel.')}</p>}
          <ul className="space-y-2">
            {view.services.map((svc) => {
              const price = where === 'hotel' ? svc.hotel : (view.prices[pick.id]?.[svc.id] ?? svc.price)
              return (
                <Row key={svc.id} icon={Heart} colors={['#ff7ab0', '#c2185b']} title={svc.label} sub={svc.about} onClick={() => !busy && void book(svc)}>
                  <Chip tone="good">{tx('{0} Djai', { 0: amount(price) })}</Chip>
                </Row>
              )
            })}
          </ul>
        </>
      )}
      {err && <p className="rounded-2xl bg-[#ffe3e3] p-3 text-sm font-bold text-[#c92a2a]">{err}</p>}
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#ff7ab0] to-[#c2185b] shadow-lg">
        <Heart size={22} fill="#fff" color="#fff" />
      </div>
      <div>
        <div className="font-display text-xl font-extrabold">GoNow</div>
        <div className="text-xs font-bold text-white/60">{tr('18+ · scènes en 3D')}</div>
      </div>
    </div>
  )
}
