import { useEffect, useRef, useState } from 'react'
import { Beer, BookOpen, Briefcase, Check, Coffee, Hand, HandCoins, HandHelping, Heart, HeartCrack, House, Laugh, Lightbulb, MapPin, MessagesSquare, Scissors, Smartphone, Smile, Sparkles, Trophy, Users, Utensils, X, type LucideIcon } from 'lucide-react'
import type { Npc } from '../world3d/open/OpenWorld'
import type { Friend } from '../lib/types'
import { greetingsFor, helloFrom } from '../lib/nouchi'
import { IconTile } from './ui'

// Talking to someone in the street (tap them): their first name, what they
// do, how well you get on, and a conversation that goes on as long as you
// like (until they have to go): what you say (in groups: greet, chat, ask,
// offer, tease) and what they answer, one after the other. The server decides
// the answers, and they can go either way; on the street they react to it
// (world3d/open/npcReact.ts). This phone remembers who you've met.

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
      { id: 'compliment', label: 'Faire un compliment', icon: Sparkles, hint: '3 min · ça fait toujours plaisir… presque' },
      { id: 'histoire', label: 'Demander une histoire', icon: BookOpen, hint: '10 min · contes et souvenirs du quartier' },
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
      { id: 'aide', label: 'Proposer un coup de main', icon: HandHelping, hint: '15 min · un petit billet en retour, parfois' },
      { id: 'numero', label: 'Échanger les numéros', icon: Smartphone, hint: 'Peut devenir un·e ami·e' },
    ],
  },
  {
    id: 'taquiner',
    label: 'Taquiner',
    colors: ['#ff7ad9', '#b02bd6'],
    topics: [
      { id: 'chambrer', label: 'Chambrer', icon: Smile, hint: 'Ça rigole… ou ça vexe' },
      { id: 'defi', label: 'Pierre-feuille-ciseaux', icon: Scissors, hint: '4 min · le perdant danse' },
      { id: 'drague', label: 'Draguer', icon: Heart, hint: 'Adultes · ça passe ou ça casse' },
    ],
  },
]

// Romance, between adults only: the Sim grown up, the person met as an adult
// (their number taken), and the player who said once they're 18 or over.
const LOVE = { id: 'coeur', label: 'Cœur', colors: ['#ff8fb1', '#e0245e'] as [string, string] }
function loveTopics(friend: Friend | undefined): Topic[] {
  if (!friend?.adult) return []
  if (!friend.partner) return [{ id: 'sortir', label: 'Lui demander de sortir ensemble', icon: Heart, hint: 'Plus vous êtes proches, plus c’est oui' }]
  return [
    ...(friend.home ? [] : [{ id: 'emmenager', label: 'Lui proposer de venir vivre chez toi', icon: House, hint: 'Vous vivrez ensemble à la maison' }]),
    { id: 'rompre', label: 'Rompre', icon: HeartCrack, hint: 'C’est fini entre vous' },
  ]
}

/** What they answered, and how they took it. */
export type Reply = { text: string; mood?: 'good' | 'bad' | 'bye' }
type Line = { who: 'me' | 'them'; text: string; mood?: Reply['mood'] }

// What they do, from their seed (always the same for the same person).
const JOBS = {
  femme: ['Vendeuse de garba', 'Couturière', 'Coiffeuse', 'Étudiante', 'Infirmière', "Vendeuse d'attiéké", 'Commerçante au marché', 'Institutrice', 'Caissière', 'Gérante de maquis', 'Esthéticienne', 'Vendeuse de pagnes'],
  homme: ['Chauffeur de gbaka', 'Apprenti gbaka', 'Mécanicien', 'Étudiant', 'Tailleur', 'Vigile', 'Menuisier', 'Vendeur de crédit', 'Livreur à moto', 'Maçon', 'Instituteur', 'Coiffeur', 'Boutiquier'],
}
export const jobOf = (npc: Pick<Npc, 'gender' | 'seed'>) => JOBS[npc.gender][npc.seed % JOBS[npc.gender].length]

// Who you've met: how many times, and how well you get on (0 to 5).
type Memory = { met: number; rapport: number }
const memKey = (id: string) => `babi.npc.${id}`
function recall(id: string): Memory {
  try {
    const m = JSON.parse(localStorage.getItem(memKey(id)) ?? '') as Memory
    return { met: m.met || 0, rapport: Math.min(5, Math.max(0, m.rapport || 0)) }
  } catch {
    return { met: 0, rapport: 1 }
  }
}
function remember(id: string, m: Memory) {
  try {
    localStorage.setItem(memKey(id), JSON.stringify(m))
  } catch {
    // Private browsing: they forget you, that's all.
  }
}

/** A light colour (a white shirt, a yellow pagne): the initial on it goes dark. */
function light(c?: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(c ?? '')
  if (!m) return false
  const n = parseInt(m[1], 16)
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 170
}

// Caught in the middle of something, a first time: they answer from there.
const BUSY_HELLO: Record<string, string[]> = {
  'en train de danser': ['Tu danses avec moi ou tu regardes seulement ?', 'Eh, laisse-moi finir ce pas, après on cause !'],
  'en train de boire un verre': ['Assieds-toi, on boit un coup ! Ça dit quoi ?', "Tu prends quoi ? Ici la bière est bien glacée."],
  'en train de manger': ['Tu viens manger ? Bon appétit à toi aussi !', 'Pardon, la bouche est pleine… Ça va ?'],
  'en prière': ['Amen… Oui, je t’écoute.'],
  'en train de parler tout seul': ['Toi aussi tu les entends ? Non ? Bon…', 'Eh, ils m’ont volé mon pays ! … Pardon, tu disais ?'],
  'au téléphone': ['Attends, je raccroche… Voilà, ça dit quoi ?', 'Je te rappelle ! … Oui, bonjour ?'],
  'au travail': ['Dis vite, le patron regarde !', 'Je suis au boulot là, mais on peut causer un peu.'],
  "en train d'ambiancer": ['Ehhh, c’est chaud ici ! Tu es venu·e ambiancer aussi ?'],
  'en train de travailler les billets': ['Approche ! Le travaillement, c’est pour les vrais !'],
}

/** How they greet you: a first time (from what they're doing, if they're busy), or « you again ». */
function greeting(npc: Npc, simGender: 'femme' | 'homme', m: Memory): string {
  const busy = npc.doing ? BUSY_HELLO[npc.doing] : undefined
  if (m.met === 0 && busy) return busy[npc.seed % busy.length]
  if (m.met === 0) return helloFrom(npc.seed, simGender)
  const toi = simGender === 'femme' ? 'ma sœur' : 'mon frère'
  if (m.rapport >= 4) return `Eh ${toi} ! Mon ami${simGender === 'femme' ? 'e' : ''} ! Viens, viens, on cause !`
  if (m.rapport <= 0) return 'Encore toi ? Bon… dis vite.'
  return ['Te revoilà !', `On se connaît, ${toi} ! Ça dit quoi ?`, "Ah, c'est toi encore ! Ça va un peu ?"][m.met % 3]
}

export function ChatSheet({ npc, simGender, onSay, onClose, friend, grownUp, adultAccount, onConfirmAdult }: {
  npc: Npc
  simGender: 'femme' | 'homme'
  onSay: (topic: string, label: string, said?: string) => Promise<Reply | null>
  onClose: () => void
  /** Them in the Sim's friends (their number taken), with where you are together. */
  friend?: Friend
  /** The Sim is an adult. */
  grownUp?: boolean
  /** The player said they're 18 or over. */
  adultAccount?: boolean
  onConfirmAdult?: () => Promise<void>
}) {
  // What you were to them before (for the greeting), and now: met once more.
  const [before] = useState(() => recall(npc.id))
  const [mem, setMem] = useState<Memory>(() => ({ met: before.met + 1, rapport: before.met === 0 ? 1 : before.rapport }))
  const [lines, setLines] = useState<Line[]>(() => [{ who: 'them', text: greeting(npc, simGender, before) }])
  const [used, setUsed] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [gone, setGone] = useState(false)
  const [group, setGroup] = useState(GROUPS[0].id)
  const log = useRef<HTMLDivElement>(null)
  useEffect(() => remember(npc.id, mem), [npc.id, mem])
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' })
  }, [lines, busy])
  const say = async (id: string, label: string, said?: string) => {
    setBusy(true)
    setLines((l) => [...l, { who: 'me', text: said ? `« ${said} »` : label }])
    const r = await onSay(id, `${label} avec ${npc.name}`, said)
    setBusy(false)
    if (!r) return setLines((l) => l.slice(0, -1))
    setLines((l) => [...l, { who: 'them', text: r.text, mood: r.mood }])
    setUsed((u) => (u.includes(id) ? u : [...u, id]))
    if (r.mood === 'bye') return setGone(true)
    if (r.mood) {
      const step = r.mood === 'good' ? 1 : -1
      setMem((m) => ({ ...m, rapport: Math.min(5, Math.max(0, m.rapport + step)) }))
    }
  }
  const love = loveTopics(friend)
  const groups = grownUp ? [...GROUPS, { ...LOVE, topics: love }] : GROUPS
  const g = groups.find((x) => x.id === group) ?? GROUPS[0]
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-[#0f1230]/15 lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up flex max-h-[68vh] w-full flex-col rounded-t-[28px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:w-[460px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-xl font-extrabold" style={{ background: npc.look.outfitColor ?? '#ff7a00', color: light(npc.look.outfitColor) ? '#141416' : '#ffffff' }}>
            {npc.name[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="label truncate">
              {jobOf(npc)} · {npc.doing ? `${npc.doing} · ` : ''}{mem.met <= 1 ? '1re rencontre' : `Vu·e ${mem.met} fois`}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-display text-[22px] leading-tight font-extrabold">{npc.name}</span>
              <span className="flex gap-0.5" aria-label={`Entente ${mem.rapport} sur 5`}>
                {[0, 1, 2, 3, 4].map((k) => (
                  <Heart key={k} size={13} strokeWidth={2.6} className={k < mem.rapport ? 'fill-[var(--color-rose)] text-[var(--color-rose)]' : 'text-black/15'} />
                ))}
              </span>
            </div>
          </div>
          <button className="icon-btn bg-[var(--color-canvas)]" onClick={onClose} aria-label="Fermer">
            <X size={22} strokeWidth={2.6} />
          </button>
        </div>
        {/* The conversation so far */}
        <div ref={log} className="mt-3 flex max-h-[24vh] min-h-[64px] flex-col gap-1.5 overflow-y-auto pr-0.5">
          {lines.map((l, i) => (
            <div
              key={i}
              className={
                l.who === 'me'
                  ? 'max-w-[85%] self-end rounded-2xl rounded-br-sm bg-[var(--color-orange)] px-3.5 py-2 text-[14px] font-extrabold text-white'
                  : `max-w-[90%] self-start rounded-2xl rounded-tl-sm border-2 bg-[var(--color-canvas)] px-3.5 py-2 text-[15px] font-bold ${l.mood === 'good' ? 'border-[var(--color-emerald)]/35' : l.mood === 'bad' ? 'border-[var(--color-rose)]/35' : 'border-transparent'}`
              }
            >
              {l.who === 'them' && !l.text.startsWith('«') && !l.text.includes(npc.name) ? `« ${l.text} »` : l.text}
            </div>
          ))}
          {busy && (
            <div className="flex gap-1 self-start rounded-2xl rounded-tl-sm bg-[var(--color-canvas)] px-3.5 py-3" aria-label={`${npc.name} répond`}>
              {[0, 1, 2].map((k) => (
                <span key={k} className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-ink-soft)]" style={{ animationDelay: `${k * 0.15}s` }} />
              ))}
            </div>
          )}
        </div>
        {gone ? (
          <button className="btn mt-3 w-full" onClick={onClose}>
            À plus, {npc.name} !
          </button>
        ) : (
          <>
            {/* The groups: greet, chat, ask, offer, tease */}
            <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist">
              {groups.map((x) => (
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
            <div className="mt-2 min-h-0 overflow-y-auto">
              {group === 'saluer' && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {greetingsFor(npc.gender).map((phrase, i) => (
                    <button key={phrase + i} className="tile px-3 py-2 text-[14px] font-extrabold disabled:opacity-50" disabled={busy} onClick={() => say('salut', 'Saluer', phrase)}>
                      « {phrase} »
                    </button>
                  ))}
                </div>
              )}
              {g.id === 'coeur' && !adultAccount && (
                <div className="mb-2 rounded-2xl bg-[#fff0f4] p-3 text-sm font-bold">
                  <p>Les relations amoureuses sont réservées aux joueurs de 18 ans et plus.</p>
                  <button className="btn mt-2 w-full !py-2" onClick={() => void onConfirmAdult?.()}>
                    J’ai 18 ans ou plus
                  </button>
                </div>
              )}
              {g.id === 'coeur' && adultAccount && !love.length && (
                <p className="mb-2 rounded-2xl bg-[#fff0f4] p-3 text-sm font-bold text-[var(--color-ink-soft)]">Faites d’abord connaissance : échangez vos numéros (Proposer), et causez souvent.</p>
              )}
              {g.id === 'coeur' && friend?.partner && <p className="mb-2 text-center text-sm font-extrabold text-[#e0245e]">❤ Vous êtes ensemble{friend.home ? ' · vous vivez ensemble' : ''}</p>}
              <ul className={`grid gap-1.5 ${g.id === 'coeur' && !adultAccount ? 'hidden' : ''}`}>
                {g.topics.map((t) => (
                  <li key={t.id}>
                    <button className="tile flex w-full items-center gap-3 p-2.5 text-left disabled:opacity-50" disabled={busy} onClick={() => say(t.id, t.label)}>
                      <IconTile icon={t.icon} colors={g.colors} size={38} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-[15px] leading-tight font-extrabold">{t.label}</span>
                        <span className="text-xs font-bold text-[var(--color-ink-soft)]">{used.includes(t.id) ? 'Déjà dit : ça risque de lasser' : t.hint}</span>
                      </span>
                      {used.includes(t.id) && <Check size={18} strokeWidth={3} className="shrink-0 text-[var(--color-emerald)]" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <button className="mt-3 w-full rounded-2xl bg-[var(--color-canvas)] py-2.5 text-sm font-extrabold text-[var(--color-ink-soft)]" onClick={onClose}>
              Au revoir, {npc.name}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
