import { useState } from 'react'
import { Beer, Briefcase, Coffee, Hand, HandCoins, Heart, Laugh, Lightbulb, MapPin, MessagesSquare, Smartphone, Smile, Trophy, Users, Utensils, X, type LucideIcon } from 'lucide-react'
import type { Npc } from '../world3d/open/OpenWorld'
import { greetingsFor, helloFrom } from '../lib/nouchi'
import { IconTile } from './ui'

// Talking to someone in the street: their first name, how they greet you,
// what you can say (in groups: greet, chat, ask, offer, tease), and what they
// answer (the server decides, and it can go either way).

type Topic = { id: string; label: string; icon: LucideIcon; hint: string }
const GROUPS: { id: string; label: string; colors: [string, string]; topics: Topic[] }[] = [
  {
    id: 'saluer',
    label: 'Saluer',
    colors: ['#ffa040', '#ff6a00'],
    topics: [{ id: 'dioula', label: 'Saluer en dioula', icon: Hand, hint: '« I ni sɔgɔma ! » · ça fait plaisir' }],
  },
  {
    id: 'causer',
    label: 'Causer',
    colors: ['#64b5ff', '#2a6cf0'],
    topics: [
      { id: 'famille', label: 'Demander la famille', icon: Users, hint: '8 min · les nouvelles de chez eux' },
      { id: 'gbairai', label: 'Faire le gbairai', icon: MessagesSquare, hint: '15 min · les nouvelles du quartier' },
      { id: 'foot', label: 'Parler foot', icon: Trophy, hint: 'Éléphants, Asec, Africa… attention aux disputes' },
      { id: 'blague', label: 'Lancer une blague', icon: Laugh, hint: 'Ça fait rire… ou pas' },
      { id: 'route', label: 'Demander le chemin', icon: MapPin, hint: '4 min' },
    ],
  },
  {
    id: 'demander',
    label: 'Demander',
    colors: ['#69e2a0', '#00a862'],
    topics: [
      { id: 'tombe', label: '« Tombe sur moi ! »', icon: Utensils, hint: 'Un garba offert… peut-être' },
      { id: 'djai', label: 'Demander un petit djai', icon: HandCoins, hint: 'Un petit prêt… peut-être' },
      { id: 'boulot', label: 'Demander un petit boulot', icon: Briefcase, hint: "Une heure de travail, s'il y en a" },
      { id: 'conseil', label: 'Demander conseil', icon: Lightbulb, hint: 'La sagesse des anciens' },
    ],
  },
  {
    id: 'proposer',
    label: 'Proposer',
    colors: ['#ffd54f', '#ffa000'],
    topics: [
      { id: 'grin', label: 'Proposer le thé au grin', icon: Coffee, hint: '30 min · on refait le monde' },
      { id: 'maquis', label: 'Inviter au maquis', icon: Beer, hint: 'Adultes · 2 000 à 3 000 Djai si on dit oui' },
      { id: 'numero', label: 'Échanger les numéros', icon: Smartphone, hint: 'Peut devenir un·e ami·e' },
    ],
  },
  {
    id: 'taquiner',
    label: 'Taquiner',
    colors: ['#ff7ad9', '#b02bd6'],
    topics: [
      { id: 'chambrer', label: 'Chambrer', icon: Smile, hint: 'Ça rigole… ou ça vexe' },
      { id: 'drague', label: 'Draguer', icon: Heart, hint: 'Adultes · ça passe ou ça casse' },
    ],
  },
]

export function ChatSheet({ npc, simGender, onSay, onClose }: { npc: Npc; simGender: 'femme' | 'homme'; onSay: (topic: string, label: string, said?: string) => Promise<string | null>; onClose: () => void }) {
  const [reply, setReply] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [group, setGroup] = useState(GROUPS[0].id)
  const hello = helloFrom(npc.seed, simGender)
  const say = async (id: string, label: string, said?: string) => {
    setBusy(true)
    const r = await onSay(id, label, said)
    setBusy(false)
    if (r) setReply(r)
  }
  const g = GROUPS.find((x) => x.id === group)!
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-[#0f1230]/40 backdrop-blur-[2px] lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up flex max-h-[82vh] w-full flex-col rounded-t-[28px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:w-[460px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-xl font-extrabold text-white" style={{ background: npc.look.outfitColor }}>
            {npc.name[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="label">Dans la rue</div>
            <div className="font-display text-[22px] leading-tight font-extrabold">{npc.name}</div>
          </div>
          <button className="icon-btn bg-[var(--color-canvas)]" onClick={onClose} aria-label="Fermer">
            <X size={22} strokeWidth={2.6} />
          </button>
        </div>
        {/* What they say */}
        <div className="mt-3 rounded-2xl rounded-tl-sm bg-[var(--color-canvas)] px-3.5 py-2.5 text-[15px] font-bold">{reply ?? `« ${hello} »`}</div>
        {reply ? (
          <button className="btn mt-3 w-full" onClick={onClose}>
            À plus, {npc.name} !
          </button>
        ) : (
          <>
            {/* The groups: greet, chat, ask, offer, tease */}
            <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist">
              {GROUPS.map((x) => (
                <button
                  key={x.id}
                  role="tab"
                  aria-selected={x.id === group}
                  className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-extrabold transition-colors"
                  style={x.id === group ? { background: x.colors[1], color: '#fff' } : { background: 'var(--color-canvas)', color: 'var(--color-ink-soft)' }}
                  onClick={() => setGroup(x.id)}
                >
                  {x.label}
                </button>
              ))}
            </div>
            <div className="mt-2 overflow-y-auto">
              {group === 'saluer' && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {greetingsFor(npc.gender).map((phrase) => (
                    <button key={phrase} className="tile px-3 py-2 text-[14px] font-extrabold disabled:opacity-50" disabled={busy} onClick={() => say('salut', `« ${phrase} » à ${npc.name}`, phrase)}>
                      « {phrase} »
                    </button>
                  ))}
                </div>
              )}
              <ul className="grid gap-1.5">
                {g.topics.map((t) => (
                  <li key={t.id}>
                    <button className="tile flex w-full items-center gap-3 p-2.5 text-left disabled:opacity-50" disabled={busy} onClick={() => say(t.id, `${t.label} avec ${npc.name}`)}>
                      <IconTile icon={t.icon} colors={g.colors} size={38} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-[15px] leading-tight font-extrabold">{t.label}</span>
                        <span className="text-xs font-bold text-[var(--color-ink-soft)]">{t.hint}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
