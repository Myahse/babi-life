import { useCallback, useEffect, useState } from 'react'
import { Check, Hand, Send, UserPlus, Users, X } from 'lucide-react'
import { api } from '../lib/api'
import type { Around, Invite, Player, Sim } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { iconFor } from './icons'
import { IconTile } from './ui'
import type { Act } from '../screens/phoneApps'

// Babi Life is played online: the other players whose Sims are in the same
// commune show up in the street. Players meet through set gestures only
// (greet, invite, join), never free text.

const STAGES: Record<string, string> = { bebe: 'Bébé', enfant: 'Enfant', ado: 'Ado', adulte: 'Adulte' }
const EMPTY: Around = { players: [], friends: [], invites: [] }

/** Who's around, polled while the game is open. */
export function usePlayers(simId: string | undefined, where: string) {
  const [around, setAround] = useState<Around>(EMPTY)
  const refresh = useCallback(() => {
    if (!simId) return
    api
      .around(simId)
      .then(setAround)
      .catch(() => undefined)
  }, [simId])
  useEffect(() => {
    refresh()
    const t = setInterval(() => document.visibilityState === 'visible' && refresh(), 15000)
    return () => clearInterval(t)
  }, [refresh, where])
  return [around, refresh] as const
}

/** Something others can come and share: not a trip, a shift, home or a cell. */
export function joinableActivity(sim: Sim) {
  const a = sim.activity
  return !!a && a.kind === 'do' && !a.career && !['home', 'commissariat', 'ami', 'bande'].includes(a.placeId ?? '') && a.end > sim.gameMinutes
}

const tagOf = (p: Player) => (p.username ? `@${p.username}` : p.firstName)

/** The HUD chip: how many players are in the commune. */
export function PlayersChip({ count, invites, onOpen }: { count: number; invites: number; onOpen: () => void }) {
  return (
    <button className="hud pointer-events-auto relative flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-extrabold transition active:scale-95" onClick={onOpen}>
      <Users size={18} strokeWidth={2.6} className="text-[#2563eb]" />
      <span className="tnum">{count}</span>
      <span className="max-sm:hidden">joueur{count > 1 ? 's' : ''} ici</span>
      {invites > 0 && <span className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--color-rose)] px-1 text-[11px] text-white ring-2 ring-white">{invites}</span>}
    </button>
  )
}

/** An invitation that just arrived, over the street. */
export function InviteBanner({ invite, onAnswer }: { invite: Invite; onAnswer: (answer: 'accepter' | 'refuser') => void }) {
  return (
    <div className="card animate-pop absolute top-[5.5rem] left-1/2 z-30 w-[min(380px,calc(100vw-24px))] -translate-x-1/2 p-3 lg:top-24">
      <div className="flex items-center gap-3">
        <IconTile icon={UserPlus} colors={['#60a5fa', '#2563eb']} size={42} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="label">{invite.fromName} t'invite</div>
          <div className="font-display text-[15px] font-extrabold">{invite.label}</div>
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <button className="btn btn-soft !py-2 !text-sm" onClick={() => onAnswer('refuser')}>
          Pas maintenant
        </button>
        <button className="btn !bg-[#2563eb] !py-2 !text-sm" onClick={() => onAnswer('accepter')}>
          <Check size={16} /> J'arrive
        </button>
      </div>
    </div>
  )
}

/** The players in the commune: greet them, join them, invite them. */
export function PlayersSheet({ sim, around, communeName, focus, act, onClose }: { sim: Sim; around: Around; communeName: string; focus: string | null; act: Act; onClose: () => void }) {
  const canInvite = joinableActivity(sim)
  const busy = !!sim.activity
  const players = [...around.players].sort((a, b) => Number(b.id === focus) - Number(a.id === focus) || b.friendship - a.friendship)
  const answer = (inv: Invite, a: 'accepter' | 'refuser') => act(a === 'accepter' ? `Rejoindre ${inv.fromName}` : 'Refuser', a === 'accepter' ? 'users' : 'x', 'social', () => api.answerInvite(sim.id, inv.id, a))
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-[28px] pb-[max(1rem,env(safe-area-inset-bottom))] lg:w-[460px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 pb-2">
          <IconTile icon={Users} colors={['#60a5fa', '#2563eb']} size={48} />
          <div className="min-w-0 flex-1">
            <div className="label">En ligne à {communeName}</div>
            <div className="font-display text-[22px] leading-tight font-extrabold">Les joueurs ici</div>
          </div>
          <button className="icon-btn bg-[var(--color-canvas)]" onClick={onClose} aria-label="Fermer">
            <X size={22} strokeWidth={2.6} />
          </button>
        </div>
        <div className="space-y-2 overflow-y-auto px-4 pt-1 pb-2">
          {around.invites.map((inv) => (
            <div key={inv.id} className="rounded-2xl bg-[#eaf1ff] p-3">
              <div className="text-sm font-extrabold">
                {inv.fromName} t'invite : <span className="text-[#2563eb]">{inv.label}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button className="btn btn-soft !py-1.5 !text-xs" onClick={() => answer(inv, 'refuser')}>
                  Pas maintenant
                </button>
                <button className="btn !bg-[#2563eb] !py-1.5 !text-xs" disabled={busy} onClick={() => answer(inv, 'accepter')}>
                  J'arrive
                </button>
              </div>
            </div>
          ))}
          {players.length === 0 ? (
            <p className="py-4 text-sm font-bold text-[var(--color-ink-soft)]">Personne d'autre en ligne à {communeName} pour l'instant. Les joueurs des autres communes n'apparaissent que si tu vas chez eux.</p>
          ) : (
            players.map((p) => (
              <div key={p.id} className={`rounded-2xl border bg-white p-3 ${p.id === focus ? 'border-[#2563eb]' : 'border-[var(--color-line)]'}`}>
                <div className="flex items-center gap-3">
                  <span className="block h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-[#dbeafe] to-[#93c5fd]">
                    <Portrait look={p.look} gender={p.gender} framing="head" />
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="font-display text-base font-extrabold">
                      {tagOf(p)} <span className="text-xs text-[var(--color-ink-soft)]">· {p.firstName}, {STAGES[p.stage] ?? ''}</span>
                    </div>
                    <div className="flex items-center gap-1 truncate text-xs font-bold text-[var(--color-ink-soft)]">
                      {p.activity ? (
                        <>
                          <IconTile icon={iconFor(p.activity.icon)} colors={['#60a5fa', '#2563eb']} size={16} radius={5} /> {p.activity.label} · {p.activity.placeName}
                        </>
                      ) : (
                        'Se promène dans le quartier'
                      )}
                    </div>
                    {p.friendship > 0 && (
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-canvas)]">
                        <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${p.friendship}%` }} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <button className="btn btn-soft !px-1 !py-1.5 !text-xs" onClick={() => act(`Saluer ${tagOf(p)}`, 'hand', 'social', () => api.meet(sim.id, p.id, 'saluer'))}>
                    <Hand size={14} /> Saluer
                  </button>
                  <button className="btn btn-soft !px-1 !py-1.5 !text-xs" disabled={busy || !p.activity?.joinable} onClick={() => act(`Rejoindre ${tagOf(p)}`, 'users', 'social', () => api.meet(sim.id, p.id, 'rejoindre'))}>
                    <Users size={14} /> Rejoindre
                  </button>
                  <button className="btn !bg-[#2563eb] !px-1 !py-1.5 !text-xs" disabled={!canInvite} onClick={() => act(`Inviter ${tagOf(p)}`, 'send', 'social', () => api.meet(sim.id, p.id, 'inviter'))}>
                    <Send size={14} /> Inviter
                  </button>
                </div>
              </div>
            ))
          )}
          <p className="px-1 pt-1 text-[11px] leading-snug font-bold text-[var(--color-ink-soft)]">
            {canInvite ? `Inviter, c'est proposer de venir faire « ${sim.activity!.interaction.label} » avec toi.` : "Pour inviter, commence d'abord une activité dans un lieu du quartier."} Rejoindre, c'est faire la même chose au même endroit, à côté de la personne : l'amitié grandit plus vite ensemble.
          </p>
        </div>
      </div>
    </div>
  )
}
