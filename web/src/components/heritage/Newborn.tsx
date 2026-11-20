import { useEffect, useState } from 'react'
import { Baby, Check } from 'lucide-react'
import type { ActionResult, Sim } from '../../lib/types'
import { api, errorText } from '../../lib/api'
import { CARD, useCard } from '../../lib/overlays'
import { famOf, kidLook } from '../../game/famille'
import { Portrait } from '../../avatar/portrait'
import { reactToResult } from '../../avatar/expressions'
import { sfx } from '../../lib/sfx'
import { haptic } from '../../lib/native'
import { t } from '../../lib/i18n'

// The newborn named with « heritage » open and le mode vie shut (components/Famille.tsx does it at home
// otherwise): a card over the game in its turn (lib/overlays.ts) the moment the baby is home, its first name
// drawn by the server, kept or changed. A child of two players is named for both families (backend
// sims/heritage2.go). « Plus tard » leaves it to « Ma famille » (its tree shows the same field).

export function Newborn({ sim, onResult }: { sim: Sim; onResult: (r: ActionResult) => void }) {
  const f = famOf(sim)
  const kid = f?.kids?.find((k) => k.id === f?.arrival)
  const [later, setLater] = useState<string | null>(null)
  const [name, setName] = useState(kid?.name ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => setName(kid?.name ?? ''), [kid?.id, kid?.name])
  const mine = useCard('naissance', CARD.arrival, !!kid && later !== kid.id)
  useEffect(() => {
    if (mine) (sfx.bell(1), haptic('medium'))
  }, [mine])
  if (!kid || !mine) return null
  const save = async () => {
    setBusy(true)
    try {
      onResult(await api.famille(sim.id, 'nommer', { kid: kid.id, name: name.trim() || kid.name }))
      sfx.pop()
      reactToResult('me', 'won')
      setLater(kid.id)
    } catch (e) {
      haptic('error')
      setErr(errorText(e, t('Pas possible')))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="fixed inset-0 z-[78] grid place-items-center bg-[#2d1f3d]/70 p-4 backdrop-blur-sm" data-newborn>
      <div className="card animate-up w-full max-w-sm p-5 text-center">
        <span className="mx-auto block h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-gradient-to-b from-[#fff1f6] to-[#ffb3cf] shadow-md">
          <Portrait look={kidLook(kid, sim.look)} gender={kid.gender} framing="head" stage="bebe" />
        </span>
        <div className="label mt-3 flex items-center justify-center gap-1.5 text-[#e0245e]">
          <Baby size={14} /> {t('Une naissance')}
        </div>
        <h2 className="mt-0.5 font-display text-[21px] leading-tight font-extrabold">{kid.with ? t('Le bébé de {a} et {b} est là !', { a: sim.firstName, b: kid.with }) : t('Bienvenue à la maison !')}</h2>
        <p className="mt-1 text-[13px] font-bold text-[var(--color-ink-soft)]">{kid.gender === 'femme' ? t('Une petite fille. Quel prénom lui donnes-tu ?') : t('Un petit garçon. Quel prénom lui donnes-tu ?')}</p>
        <input
          className="mt-3 w-full rounded-2xl border-2 border-black/10 bg-white px-3 py-2.5 text-center text-[17px] font-extrabold outline-none focus:border-[#e0245e]"
          value={name}
          maxLength={20}
          onChange={(e) => (setName(e.target.value), setErr(null))}
          onKeyDown={(e) => e.key === 'Enter' && void save()}
          aria-label={t('Prénom')}
        />
        {err && <p className="mt-1.5 text-[12.5px] font-bold text-[#c92a2a]">{err}</p>}
        <button className="btn mt-3 w-full" disabled={busy || name.trim().length < 2} onClick={() => void save()} data-newborn-ok>
          <Check size={18} /> {t('C’est son prénom')}
        </button>
        <button className="mt-2 text-[13px] font-extrabold text-[var(--color-ink-soft)]" onClick={() => setLater(kid.id)}>
          {t('Plus tard')}
        </button>
      </div>
    </div>
  )
}
