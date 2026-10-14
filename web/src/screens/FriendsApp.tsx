import { useMemo } from 'react'
import { Handshake, LogOut, Phone, ShieldAlert, Users, Zap } from 'lucide-react'
import { api } from '../lib/api'
import type { Friend, Sim, World } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'
import { lifeOf } from '../game/rules'
import type { Act } from './phoneApps'

/**
 * Amis: the people the Sim knows, met at school, at football, at the maquis…
 * and, for some teenagers, the bande of the quarter and what it leads to.
 */
export function FriendsApp({ world, sim, act }: { world: World; sim: Sim; act: Act }) {
  const friends = [...(sim.friends ?? [])].sort((a, b) => b.friendship - a.friendship)
  const life = lifeOf(world, sim)
  const ownPhone = !life.minor || life.age >= 12
  const record = sim.record ?? 0
  // Mirrors game.CoupOutcome: every arrest makes the next likelier.
  const risk = Math.round(Math.min(1, 0.25 + 0.1 * record) * 100)
  const busy = !!sim.activity

  return (
    <div className="space-y-3">
      {sim.gang === 'invited' && (
        <div className="rounded-[22px] bg-[#1d1d24] p-4 text-white">
          <div className="flex items-center gap-2 text-xs font-extrabold tracking-wider text-white/70 uppercase">
            <Users size={14} /> La bande du quartier
          </div>
          <p className="mt-1 text-sm leading-snug font-bold">« Viens avec nous, on va te montrer la vie. » De l'argent facile, des frères… et la police au bout.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="btn btn-soft !py-2 !text-sm" onClick={() => act('Refuser la bande', 'x', 'social', () => api.gang(sim.id, 'refuser'))}>
              Refuser
            </button>
            <button className="btn !bg-[#d81b3f] !py-2 !text-sm" onClick={() => act('Rejoindre la bande', 'users', 'social', () => api.gang(sim.id, 'accepter'))}>
              Rejoindre
            </button>
          </div>
        </div>
      )}

      {sim.gang === 'member' && (
        <div className="rounded-[22px] bg-[#1d1d24] p-4 text-white">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-display text-lg font-extrabold">
              <Users size={18} /> La bande
            </span>
            {record > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-[#d81b3f] px-2 py-0.5 text-[11px] font-extrabold">
                <ShieldAlert size={12} /> Casier : {record}
              </span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="btn btn-soft !py-2 !text-sm" disabled={busy} onClick={() => act('Zoner avec la bande', 'users', 'social', () => api.gang(sim.id, 'zoner'))}>
              <Users size={16} /> Zoner
            </button>
            <button className="btn !bg-[#d81b3f] !py-2 !text-sm" disabled={busy} onClick={() => act('Un coup avec la bande', 'zap', 'social', () => api.gang(sim.id, 'coup'))}>
              <Zap size={16} /> Faire un coup
            </button>
          </div>
          <p className="mt-2 text-xs font-bold text-white/70">Un coup rapporte vite, mais la police t'attrape une fois sur {Math.max(1, Math.round(100 / risk))} environ ({risk} %) : garde à vue, et ça reste sur le casier, qui ferme le bureau, la mairie, l'école et la santé à 18 ans.</p>
          <button className="mt-2 flex items-center gap-1 text-xs font-extrabold text-white/80" onClick={() => act('Quitter la bande', 'log-out', 'social', () => api.gang(sim.id, 'quitter'))}>
            <LogOut size={13} /> Quitter la bande
          </button>
        </div>
      )}

      {record > 0 && sim.gang !== 'member' && (
        <p className="flex items-center gap-1.5 rounded-xl bg-[#ffeef1] px-3 py-2 text-xs font-extrabold text-[#d81b3f]">
          <ShieldAlert size={14} /> Casier judiciaire : {record} arrestation{record > 1 ? 's' : ''}
        </p>
      )}

      <div className="label">Tes amis</div>
      {friends.length === 0 ? (
        <p className="text-sm font-bold text-[var(--color-ink-soft)]">Personne encore. Va à l'école, joue au foot, sors au maquis : on se fait des amis en faisant des choses ensemble.</p>
      ) : (
        <ul className="space-y-2">
          {friends.map((f) => (
            <FriendRow key={f.id} f={f} world={world} canCall={ownPhone} busy={busy} onAct={(a, label) => act(`${label} ${f.name}`, a === 'appeler' ? 'phone' : 'users', 'social', () => api.friend(sim.id, f.id, a))} />
          ))}
        </ul>
      )}
    </div>
  )
}

function FriendRow({ f, world, canCall, busy, onAct }: { f: Friend; world: World; canCall: boolean; busy: boolean; onAct: (action: string, label: string) => void }) {
  const look = useMemo(() => randomLook(f.gender, rng(`friend${f.seed}`)), [f.seed, f.gender])
  const commune = world.cities.flatMap((c) => c.communes).find((c) => c.id === f.commune)?.name ?? ''
  const tone = f.friendship >= 60 ? '#00b86b' : f.friendship >= 30 ? '#ffa000' : '#ff4d6d'
  return (
    <li className="rounded-2xl border border-[var(--color-line)] bg-white p-3">
      <div className="flex items-center gap-3">
        <span className="block h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-[#ffe7c7] to-[#ffb27a]">
          <Portrait look={look} gender={f.gender} framing="head" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 font-display text-base leading-tight font-extrabold">
            {f.name}
            {f.gang && <span className="rounded-full bg-[#1d1d24] px-1.5 py-0.5 text-[9px] text-white">BANDE</span>}
          </div>
          <div className="text-[11px] font-bold text-[var(--color-ink-soft)]">{commune}</div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-canvas)]">
            <div className="h-full rounded-full" style={{ width: `${f.friendship}%`, background: tone }} />
          </div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(world.friendActions ?? []).map((a) => (
          <button key={a.id} className="btn btn-soft !py-1.5 !text-xs" disabled={busy || (a.phone && !canCall)} onClick={() => onAct(a.id, a.label)}>
            {a.id === 'appeler' ? <Phone size={14} /> : <Handshake size={14} />} {a.label}
          </button>
        ))}
      </div>
    </li>
  )
}
