import { useEffect, useMemo, useState } from 'react'
import { Grid3x3, Handshake, Heart, HeartCrack, LogOut, Phone, Send, ShieldAlert, UserPlus, Users, Wallet, Zap } from 'lucide-react'
import { api } from '../lib/api'
import type { Friend, Player, Sim, World } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { lifeOf } from '../game/rules'
import type { Act } from './phoneApps'
import { joinableActivity } from '../components/Players'
import { OutingPlanner, friendLook } from './OutingPlanner'
import { t, tx } from '../lib/i18n'

/**
 * Amis: the people the Sim knows, met at school, at football, at the maquis…
 * and, for some teenagers, the bande of the quarter and what it leads to.
 */
export function FriendsApp({ world, sim, act, onPay, onDames }: { world: World; sim: Sim; act: Act; /** Send money to a player friend (opens Waye). */ onPay?: (p: Player) => void; /** Challenge a player friend to a game of dames. */ onDames?: (p: Player) => void }) {
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
            <Users size={14} /> {t('La bande du quartier')}
          </div>
          <p className="mt-1 text-sm leading-snug font-bold">{t("« Viens avec nous, on va te montrer la vie. » De l'argent facile, des frères… et la police au bout.")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="btn btn-soft !py-2 !text-sm" onClick={() => act('Refuser la bande', 'x', 'social', () => api.gang(sim.id, 'refuser'))}>
              {t('Refuser')}
            </button>
            <button className="btn !bg-[#d81b3f] !py-2 !text-sm" onClick={() => act('Rejoindre la bande', 'users', 'social', () => api.gang(sim.id, 'accepter'))}>
              {t('Rejoindre')}
            </button>
          </div>
        </div>
      )}

      {sim.gang === 'member' && (
        <div className="rounded-[22px] bg-[#1d1d24] p-4 text-white">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-display text-lg font-extrabold">
              <Users size={18} /> {t('La bande')}
            </span>
            {record > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-[#d81b3f] px-2 py-0.5 text-[11px] font-extrabold">
                <ShieldAlert size={12} /> {tx('Casier : {record}', { record })}
              </span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="btn btn-soft !py-2 !text-sm" disabled={busy} onClick={() => act('Zoner avec la bande', 'users', 'social', () => api.gang(sim.id, 'zoner'))}>
              <Users size={16} /> {t('Zoner')}
            </button>
            <button className="btn !bg-[#d81b3f] !py-2 !text-sm" disabled={busy} onClick={() => act('Un coup avec la bande', 'zap', 'social', () => api.gang(sim.id, 'coup'))}>
              <Zap size={16} /> {t('Faire un coup')}
            </button>
          </div>
          <p className="mt-2 text-xs font-bold text-white/70">{tx("Un coup rapporte vite, mais la police t'attrape une fois sur {0} environ ({risk} %) : garde à vue, et ça reste sur le casier, qui ferme le bureau, la mairie, l'école et la santé à 18 ans.", { 0: Math.max(1, Math.round(100 / risk)), risk })}</p>
          <button className="mt-2 flex items-center gap-1 text-xs font-extrabold text-white/80" onClick={() => act('Quitter la bande', 'log-out', 'social', () => api.gang(sim.id, 'quitter'))}>
            <LogOut size={13} /> {t('Quitter la bande')}
          </button>
        </div>
      )}

      {record > 0 && sim.gang !== 'member' && (
        <p className="flex items-center gap-1.5 rounded-xl bg-[#ffeef1] px-3 py-2 text-xs font-extrabold text-[#d81b3f]">
          <ShieldAlert size={14} /> {tx('Casier judiciaire : {record} arrestation{0}', { record, 0: record > 1 ? 's' : '' })}
        </p>
      )}

      <OutingPlanner world={world} sim={sim} act={act} />

      <PlayerFriends world={world} sim={sim} act={act} onPay={onPay} onDames={onDames} />

      <div className="label">{t('Tes amis du quartier')}</div>
      {friends.length === 0 ? (
        <p className="text-sm font-bold text-[var(--color-ink-soft)]">{t("Personne encore. Va à l'école, joue au foot, sors au maquis : on se fait des amis en faisant des choses ensemble.")}</p>
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
  const look = useMemo(() => friendLook(f), [f])
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
            {f.gang && <span className="rounded-full bg-[#1d1d24] px-1.5 py-0.5 text-[9px] text-white">{t('BANDE')}</span>}
            {f.partner && <span className="rounded-full bg-[#e0245e] px-1.5 py-0.5 text-[9px] text-white">❤ {f.home ? t('VIT AVEC TOI') : 'ENSEMBLE'}</span>}
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

/**
 * Friends made with other players: the requests to answer, who's online and
 * where; invite them over to what the Sim is doing, wherever they are, or
 * send them money with Waye.
 */
function PlayerFriends({ world, sim, act, onPay, onDames }: { world: World; sim: Sim; act: Act; onPay?: (p: Player) => void; onDames?: (p: Player) => void }) {
  const [around, setAround] = useState<{ friends: Player[]; requests: Player[] } | null>(null)
  const load = () =>
    api
      .around(sim.id)
      .then((a) => setAround({ friends: a.friends, requests: a.requests ?? [] }))
      .catch(() => setAround({ friends: [], requests: [] }))
  useEffect(() => {
    void load()
  }, [sim.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!around) return null
  const { friends, requests } = around
  const communeName = (p: Player) => world.cities.find((c) => c.id === p.city)?.communes.find((c) => c.id === p.commune)?.name ?? ''
  const tag = (p: Player) => (p.username ? `@${p.username}` : p.firstName)
  const canInvite = joinableActivity(sim)
  const grown = lifeOf(world, sim).stage?.id === 'adulte'
  const answer = (p: Player, a: 'accepter' | 'refuser') => act(a === 'accepter' ? t('Ami·e avec {0}', { 0: tag(p) }) : t('Refuser'), a === 'accepter' ? 'user-plus' : 'x', 'social', () => api.answerFriend(sim.id, p.id, a)).then(() => load())
  return (
    <>
      {requests.length > 0 && (
        <>
          <div className="label">{t("Demandes d'ami·es")}</div>
          <ul className="space-y-2">
            {requests.map((p) => (
              <li key={p.id} className="rounded-2xl bg-[#e9f9ef] p-3">
                <div className="flex items-center gap-3">
                  <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-[#dbeafe] to-[#93c5fd]">
                    <Portrait look={p.look} gender={p.gender} framing="head" />
                  </span>
                  <div className="min-w-0 flex-1 text-sm font-extrabold">{tag(p)} {t('veut être ton ami·e')}</div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button className="btn btn-soft !py-1.5 !text-xs" onClick={() => void answer(p, 'refuser')}>
                    {t('Non merci')}
                  </button>
                  <button className="btn !bg-[#0f9d58] !py-1.5 !text-xs" onClick={() => void answer(p, 'accepter')}>
                    <UserPlus size={14} /> {t('Accepter')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="label">{t('Tes amis joueurs')}</div>
      {friends.length === 0 ? (
        <p className="text-sm font-bold text-[var(--color-ink-soft)]">{t("Les persos en bleu dans la rue sont d'autres joueurs : salue-les, puis « Ajouter en ami·e ». Entre ami·es, vous vous écrivez, vous vous envoyez de l'argent et vous vous invitez de n'importe où.")}</p>
      ) : (
        <ul className="space-y-2">
          {friends.map((p) => (
            <li key={p.id} className="rounded-2xl border border-[var(--color-line)] bg-white p-3">
              <div className="flex items-center gap-3">
                <span className="relative block h-11 w-11 shrink-0">
                  <span className="block h-11 w-11 overflow-hidden rounded-full bg-gradient-to-b from-[#dbeafe] to-[#93c5fd]">
                    <Portrait look={p.look} gender={p.gender} framing="head" />
                  </span>
                  <span className={`absolute right-0 bottom-0 h-3 w-3 rounded-full ring-2 ring-white ${p.online ? 'bg-[#00b86b]' : 'bg-[#adb5bd]'}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-display text-base leading-tight font-extrabold">
                    {tag(p)}
                    {p.couple && <span className="rounded-full bg-[#e0245e] px-1.5 py-0.5 text-[9px] text-white">{t('❤ ENSEMBLE')}</span>}
                  </div>
                  <div className="truncate text-[11px] font-bold text-[var(--color-ink-soft)]">
                    {p.online ? (p.activity ? `${p.activity.label} · ${p.activity.placeName}` : t('En ligne · {0}', { 0: communeName(p) })) : t('Hors ligne · {0}', { 0: communeName(p) })}
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-canvas)]">
                    <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${p.friendship}%` }} />
                  </div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button className="btn !bg-[#2563eb] !py-1.5 !text-xs" disabled={!canInvite} onClick={() => act(`Inviter ${tag(p)}`, 'send', 'social', () => api.inviteFriend(sim.id, p.id))}>
                  <Send size={14} /> {t('Inviter')}
                </button>
                <button className="btn !bg-[#1aa6e6] !py-1.5 !text-xs" disabled={!onPay} onClick={() => onPay?.(p)}>
                  <Wallet size={14} /> {t('Waye')}
                </button>
                <button className="btn !bg-[#7a4a22] !py-1.5 !text-xs" disabled={!onDames || p.stage === 'enfant'} onClick={() => onDames?.(p)}>
                  <Grid3x3 size={14} /> {t('Dames')}
                </button>
              </div>
              <CoupleLine p={p} free={!friends.some((x) => x.couple)} grown={grown && p.stage === 'adulte'} onCouple={(a, label) => act(label, 'heart', 'social', () => api.couple(sim.id, p.id, a)).then(() => load())} />
            </li>
          ))}
        </ul>
      )}
      {friends.length > 0 && (
        <p className="text-[11px] leading-snug font-bold text-[var(--color-ink-soft)]">
          {canInvite ? t("Inviter, c'est proposer de venir faire « {label} » avec toi : ton ami·e reçoit l'invitation où qu'il ou elle soit.", { label: sim.activity!.interaction.label }) : t("Pour inviter un·e ami·e, commence d'abord une activité dans un lieu (le maquis, le terrain, la plage…), puis invite-le ou la à venir.")}
        </p>
      )}
    </>
  )
}

/**
 * Together with a player friend (backend sims/couple.go): their answer to
 * give, the one sent, breaking it off, or asking, between adults, one couple
 * of players at a time.
 */
function CoupleLine({ p, free, grown, onCouple }: { p: Player; free: boolean; grown: boolean; onCouple: (a: 'proposer' | 'accepter' | 'refuser' | 'rompre', label: string) => void }) {
  const who = p.username ? `@${p.username}` : p.firstName
  if (p.coupleRequest === 'received')
    return (
      <div className="mt-2 rounded-xl bg-[#ffe3ec] p-2">
        <div className="text-xs font-extrabold text-[#c2255c]">{who} {t('te demande de sortir ensemble ❤')}</div>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <button className="btn btn-soft !py-1.5 !text-xs" onClick={() => onCouple('refuser', 'Rester ami·es')}>
            {t('Restons ami·es')}
          </button>
          <button className="btn !bg-[#e0245e] !py-1.5 !text-xs" onClick={() => onCouple('accepter', `Ensemble avec ${who}`)}>
            <Heart size={14} /> {t('Oui')}
          </button>
        </div>
      </div>
    )
  if (p.couple)
    return (
      <button className="mt-2 flex items-center gap-1 text-xs font-extrabold text-[#c2255c]" onClick={() => onCouple('rompre', `Rompre avec ${who}`)}>
        <HeartCrack size={13} /> {t('Rompre')}
      </button>
    )
  if (p.coupleRequest === 'sent') return <div className="mt-2 text-xs font-bold text-[var(--color-ink-soft)]">{t('Demande ❤ envoyée : en attente de sa réponse.')}</div>
  if (!grown || !free) return null
  return (
    <button className="btn btn-soft mt-2 w-full !py-1.5 !text-xs !text-[#c2255c]" onClick={() => onCouple('proposer', `Sortir avec ${who}`)}>
      <Heart size={14} /> {t('Lui proposer de sortir ensemble')}
    </button>
  )
}
