import { useEffect, useMemo, useState } from 'react'
import { Check, PartyPopper } from 'lucide-react'
import { api } from '../lib/api'
import type { Friend, Interaction, Player, Sim, World } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'
import { ageBlock, fcfa, lifeOf, openAt } from '../game/rules'
import type { Act } from './phoneApps'

/** Where one goes out with friends (the kinds of places; backend sims/outing.go says what may be). */
const OUT_KINDS = new Set(['maquis', 'cinema', 'beach', 'club', 'restaurant', 'sport', 'mall', 'culture', 'lagune', 'zoo', 'nature', 'karting', 'gym'])
/** Friends at most on one outing (backend maxOuting). */
const MAX = 4

/** A friend's face: the one they had when met, else one of their own. */
export const friendLook = (f: Friend) => f.look ?? randomLook(f.gender, rng(`friend${f.seed}`))

/**
 * Organiser une sortie: where (the places of the Sim's commune open now),
 * with whom (friends met in the game, who answer at once; player friends,
 * who get an invitation), and the bill: the Sim invites, the Sim pays.
 */
export function OutingPlanner({ world, sim, act }: { world: World; sim: Sim; act: Act }) {
  const [open, setOpen] = useState(false)
  const [where, setWhere] = useState<{ placeId: string; name: string; it: Interaction } | null>(null)
  const [who, setWho] = useState<string[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  useEffect(() => {
    if (open) api.around(sim.id).then((a) => setPlayers(a.friends), () => setPlayers([]))
  }, [open, sim.id])
  const stage = lifeOf(world, sim).stage?.id
  const choices = useMemo(() => {
    const commune = world.cities.find((c) => c.id === sim.city)?.communes.find((c) => c.id === sim.commune)
    return (commune?.places ?? [])
      .filter((p) => OUT_KINDS.has(p.kind))
      .flatMap((p) =>
        (world.kinds[p.kind]?.interactions ?? [])
          .filter((it) => it.cost >= 0 && (!it.places?.length || it.places.includes(p.id)) && (!it.faiths || it.faiths.includes(p.faith!)) && openAt(it, sim.gameMinutes) && !ageBlock(it, stage) && (!it.gender || it.gender === sim.gender))
          .map((it) => ({ placeId: p.id, name: p.name, it })),
      )
  }, [world, sim.city, sim.commune, sim.gameMinutes, sim.gender, stage])
  const friends = (sim.friends ?? []).filter((f) => !f.gang)
  const pick = (id: string) => setWho((w) => (w.includes(id) ? w.filter((x) => x !== id) : w.length < MAX ? [...w, id] : w))
  const npcCount = who.filter((id) => friends.some((f) => f.id === id)).length
  const bill = where ? where.it.cost * (1 + npcCount) : 0
  const busy = !!sim.activity

  if (!open)
    return busy ? (
      <p className="flex items-center gap-2 rounded-xl bg-[var(--color-canvas)] px-3 py-2 text-xs font-bold text-[var(--color-ink-soft)]">
        <PartyPopper size={15} /> Une sortie entre amis ? Termine d'abord ce que tu fais.
      </p>
    ) : (
      <button className="btn w-full !bg-[#ff7a00] !py-3" onClick={() => setOpen(true)}>
        <PartyPopper size={18} /> Organiser une sortie
      </button>
    )

  return (
    <div className="space-y-3 rounded-[22px] border border-[var(--color-line)] bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="font-display text-lg font-extrabold">Organiser une sortie</div>
        <button className="text-sm font-extrabold text-[var(--color-ink-soft)]" onClick={() => (setOpen(false), setWhere(null), setWho([]))}>
          Annuler
        </button>
      </div>

      <div className="label">Où ?</div>
      {choices.length === 0 ? (
        <p className="text-sm font-bold text-[var(--color-ink-soft)]">Rien d'ouvert dans le coin à cette heure. Reviens plus tard, ou va dans une autre commune.</p>
      ) : (
        <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
          {choices.map((c) => {
            const on = where?.placeId === c.placeId && where.it.id === c.it.id
            return (
              <li key={`${c.placeId}:${c.it.id}`}>
                <button className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-bold ${on ? 'border-[#ff7a00] bg-[#fff3e8]' : 'border-[var(--color-line)]'}`} onClick={() => setWhere(c)} aria-pressed={on}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-extrabold">{c.name}</span>
                    <span className="block truncate text-xs text-[var(--color-ink-soft)]">
                      {c.it.label}
                      {c.it.cost > 0 ? ` · ${fcfa(c.it.cost)} par personne` : ''}
                    </span>
                  </span>
                  {on && <Check size={18} className="text-[#ff7a00]" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="label">Avec qui ? ({who.length}/{MAX})</div>
      {friends.length + players.length === 0 ? (
        <p className="text-sm font-bold text-[var(--color-ink-soft)]">Pas encore d'amis à inviter : parle aux gens, échange les numéros.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {friends.map((f) => (
            <Pickable key={f.id} on={who.includes(f.id)} onClick={() => pick(f.id)} name={f.name} tag={f.partner ? '❤' : undefined}>
              <Portrait look={friendLook(f)} gender={f.gender} framing="head" />
            </Pickable>
          ))}
          {players.map((p) => (
            <Pickable key={p.id} on={who.includes(p.id)} onClick={() => pick(p.id)} name={p.username ? `@${p.username}` : p.firstName} tag="joueur">
              <Portrait look={p.look} gender={p.gender} framing="head" />
            </Pickable>
          ))}
        </div>
      )}

      {where && who.length > 0 && (
        <p className="text-xs font-bold text-[var(--color-ink-soft)]">
          {npcCount > 0 && `Ceux du quartier répondent tout de suite ; c'est toi qui invites${bill > 0 ? ` : jusqu'à ${fcfa(bill)}` : ''}. `}
          {who.length > npcCount && 'Les joueurs reçoivent une invitation pour te rejoindre.'}
        </p>
      )}
      <button
        className="btn w-full !py-3"
        disabled={!where || who.length === 0 || busy}
        onClick={async () => {
          if (!where) return
          const ok = await act(`Sortie : ${where.name}`, 'party-popper', 'social', () =>
            api.outing(sim.id, { placeId: where.placeId, interactionId: where.it.id, friends: who.filter((id) => friends.some((f) => f.id === id)), players: who.filter((id) => players.some((p) => p.id === id)) }),
          )
          if (ok) (setOpen(false), setWhere(null), setWho([]))
        }}
      >
        <PartyPopper size={18} /> On y va !
      </button>
    </div>
  )
}

function Pickable({ on, onClick, name, tag, children }: { on: boolean; onClick: () => void; name: string; tag?: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={`flex w-[72px] flex-col items-center gap-1 rounded-2xl border-2 p-1.5 ${on ? 'border-[#ff7a00] bg-[#fff3e8]' : 'border-transparent'}`}>
      <span className="relative block h-12 w-12 overflow-hidden rounded-full bg-gradient-to-b from-[#ffe7c7] to-[#ffb27a]">
        {children}
        {on && (
          <span className="absolute inset-0 grid place-items-center bg-[#ff7a00]/45">
            <Check size={22} className="text-white" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="w-full truncate text-center text-[11px] font-extrabold">{name}</span>
      {tag && <span className="-mt-1 text-[9px] font-extrabold text-[var(--color-ink-soft)] uppercase">{tag}</span>}
    </button>
  )
}
