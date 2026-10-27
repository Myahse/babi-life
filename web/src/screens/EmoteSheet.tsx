import { useEffect, useState } from 'react'
import { Lock, X } from 'lucide-react'
import { api, errorText } from '../lib/api'
import type { ActionResult, Emote, Sim, World } from '../lib/types'
import type { Pose } from '../avatar/Human'
import { playEmote } from '../world3d/emoteNow'

// The « Émotes » sheet: every emote as a tile. The free ones and the ones
// bought play at a tap (the Sim does it in the street, the other players see
// it); the others show their price, and a tap buys them (once, kept).

export function EmoteSheet({ world, sim, onClose, onResult }: { world: World; sim: Sim; onClose: () => void; /** A purchase went through: the Sim (its money) comes back. */ onResult: (res: ActionResult) => void }) {
  const [owned, setOwned] = useState<string[] | null>(null)
  const [buying, setBuying] = useState<Emote | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void api.emotes(sim.id).then((r) => setOwned(r.owned)).catch(() => setOwned([]))
  }, [sim.id])
  const list = world.emotes ?? []
  const has = (e: Emote) => e.price === 0 || !!owned?.includes(e.id)
  const play = (e: Emote) => {
    playEmote(e.id as Pose, e.seconds)
    onClose()
  }
  const buy = async (e: Emote) => {
    setBusy(true)
    setError(null)
    try {
      const res = await api.buyEmote(sim.id, e.id)
      onResult(res)
      setOwned((o) => [...(o ?? []), e.id])
      setBuying(null)
    } catch (err) {
      setError(errorText(err, "L'achat n'est pas passé"))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-[#0f1230]/45 sm:items-center" onClick={onClose}>
      <div className="sheet animate-up max-h-[80%] w-full overflow-y-auto rounded-t-[28px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:w-[440px] sm:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="flex-1 font-display text-xl font-extrabold">Émotes</h2>
          <span className="text-xs font-extrabold text-[var(--color-ink-soft)]">{Math.floor(sim.money).toLocaleString('fr-FR')} Djai</span>
          <button className="icon-btn bg-[var(--color-canvas)]" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>
        {buying ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <span className="text-6xl">{buying.emoji}</span>
            <div className="font-display text-lg font-extrabold">{buying.label}</div>
            <p className="text-sm font-bold text-[var(--color-ink-soft)]">À toi pour toujours, pour {buying.price.toLocaleString('fr-FR')} Djai.</p>
            {error && <p className="text-xs font-bold text-[var(--color-rose)]">{error}</p>}
            <div className="flex w-full gap-2">
              <button className="btn btn-soft flex-1" onClick={() => (setBuying(null), setError(null))}>
                Pas maintenant
              </button>
              <button className="btn flex-1 disabled:opacity-50" disabled={busy || sim.money < buying.price} onClick={() => void buy(buying)}>
                {sim.money < buying.price ? 'Pas assez de Djai' : busy ? '…' : `Acheter · ${buying.price.toLocaleString('fr-FR')}`}
              </button>
            </div>
          </div>
        ) : (
          <div className="motion-stagger grid grid-cols-4 gap-2">
            {list.map((e) => {
              const mine = has(e)
              return (
                <button key={e.id} disabled={owned === null && e.price > 0} onClick={() => (mine ? play(e) : setBuying(e))} className={`relative flex flex-col items-center gap-1 rounded-2xl p-2 active:scale-95 ${mine ? 'bg-[var(--color-canvas)]' : 'bg-[#fff4e8]'}`}>
                  <span className={`text-3xl ${mine ? '' : 'opacity-60'}`}>{e.emoji}</span>
                  <span className="line-clamp-2 text-center text-[11px] leading-tight font-extrabold">{e.label}</span>
                  {!mine && (
                    <span className="flex items-center gap-0.5 rounded-full bg-[var(--color-orange)] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                      <Lock size={9} strokeWidth={3} /> {e.price >= 1000 ? `${e.price / 1000} k` : e.price}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
