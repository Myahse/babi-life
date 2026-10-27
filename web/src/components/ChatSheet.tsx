import { useEffect, useRef, useState } from 'react'
import { SendHorizontal, Beer, BookOpen, Briefcase, Check, Coffee, Grid3x3, Hand, HandCoins, HandHelping, Handshake, Heart, HeartCrack, House, Laugh, Lightbulb, MapPin, MessageCircleQuestion, MessagesSquare, Scissors, Smartphone, Smile, Sparkles, Trophy, Users, Utensils, X, type LucideIcon } from 'lucide-react'
import type { Npc } from '../world3d/open/OpenWorld'
import type { Friend } from '../lib/types'
import { greetingsFor, helloFrom } from '../lib/nouchi'
import { LANGUAGES, goodbyeIn, greetingIn, languageLabel, npcLanguages } from '../lib/languages'
import { IconTile } from './ui'
import { Portrait } from '../avatar/portrait'
import { Sheet } from './Sheet'

// Talking to someone in the street (tap them): their first name, what they
// do, how well you get on, and a conversation that goes on as long as you
// like (until they have to go): what you say (in groups: greet, chat, ask,
// offer, tease) and what they answer, one after the other. The server decides
// the answers, and they can go either way; on the street they react to it
// (world3d/open/npcReact.ts). This phone remembers who you've met.

/** `says`: what the Sim says for it (one picked each time), shown in its bubble. `lang`: a greeting in that language. */
type Topic = { id: string; label: string; icon: LucideIcon; hint: string; says?: string[]; lang?: string }
const GROUPS: { id: string; label: string; icon: LucideIcon; colors: [string, string]; topics: Topic[] }[] = [
  {
    id: 'saluer',
    label: 'Saluer',
    icon: Hand,
    colors: ['#ffa040', '#ff6a00'],
    // The greetings in the player's languages are added when the sheet opens.
    topics: [],
  },
  {
    id: 'causer',
    label: 'Causer',
    icon: MessagesSquare,
    colors: ['#64b5ff', '#2a6cf0'],
    topics: [
      { id: 'famille', label: 'Demander la famille', icon: Users, hint: '8 min · les nouvelles de chez eux', says: ['Et la famille, ça va ?', 'Comment va la maison ?', 'Les enfants vont bien ?'] },
      { id: 'gbairai', label: 'Faire le gbairai', icon: MessagesSquare, hint: '15 min · les nouvelles du quartier', says: ['Y a quoi comme gbairai ?', 'Raconte, ça dit quoi au quartier ?', 'Quoi de neuf dans le quartier ?'] },
      { id: 'foot', label: 'Parler foot', icon: Trophy, hint: 'Éléphants, Asec, Africa… attention aux disputes', says: ['Tu as vu le match d\'hier ?', 'Les Éléphants vont gagner samedi ?', 'Asec ou Africa, toi tu es où ?'] },
      // The joke itself (the one listening laughs, or not: the server's answer).
      {
        id: 'blague',
        label: 'Lancer une blague',
        icon: Laugh,
        hint: 'Ça fait rire… ou pas',
        says: [
          'Le maître demande à Koffi : « Tu as 500 F et tu demandes 500 F à ton papa, tu as combien ? » « 500 F, monsieur. » « Tu ne connais pas l\'addition ! » « Non, c\'est vous qui ne connaissez pas mon papa ! »',
          'Le docteur dit à Yao : « Il faut arrêter l\'attiéké le soir. » Yao : « D\'accord docteur, je vais le manger la nuit. »',
          'Le woro-woro tombe en panne. Le chauffeur : « Tout le monde descend pousser ! » Un passager : « Ah non, moi j\'ai payé une place assise ! »',
          'Pourquoi le chauffeur de gbaka ne joue jamais à cache-cache ? Parce qu\'on l\'entend crier « Adjamé ! » à trois rues.',
          'Un gaou arrive au Plateau, il voit la Pyramide et il dit : « Les Égyptiens sont venus jusqu\'ici ? »',
          'Ma tantie m\'a dit : « Choisis, c\'est le foot ou moi. » J\'ai demandé : « Ça dépend, c\'est quel match ? »',
          'Pourquoi le poisson de la lagune ne joue jamais au foot ? Il a trop peur du filet !',
        ],
      },
      { id: 'compliment', label: 'Faire un compliment', icon: Sparkles, hint: '3 min · ça fait toujours plaisir… presque', says: ['Ton habit là est joli dèh !', 'Tu as la classe aujourd\'hui !', 'Tu as un beau sourire, toi !'] },
      { id: 'histoire', label: 'Demander une histoire', icon: BookOpen, hint: '10 min · contes et souvenirs du quartier', says: ['Tu connais un conte ? Raconte !', 'Raconte-moi une histoire de chez toi.'] },
      { id: 'route', label: 'Demander le chemin', icon: MapPin, hint: '4 min', says: ['Pardon, c\'est par où le marché ?', 'Je cherche la pharmacie, c\'est où ?'] },
    ],
  },
  {
    id: 'demander',
    label: 'Demander',
    icon: MessageCircleQuestion,
    colors: ['#69e2a0', '#00a862'],
    topics: [
      { id: 'tombe', label: '« Tombe sur moi ! »', icon: Utensils, hint: 'Un garba offert… peut-être', says: ['Tombe sur moi, je suis fauché !', 'Eh, tombe sur moi un peu !'] },
      { id: 'djai', label: 'Demander un petit djai', icon: HandCoins, hint: 'Un petit prêt… peut-être', says: ['Tu peux me dépanner un petit djai ?', 'Prête-moi un peu, je rembourse demain !'] },
      { id: 'boulot', label: 'Demander un petit boulot', icon: Briefcase, hint: "Une heure de travail, s'il y en a", says: ['Y a pas un petit boulot pour moi ?', 'Si tu as un petit travail, je suis là !'] },
      { id: 'conseil', label: 'Demander conseil', icon: Lightbulb, hint: 'La sagesse des anciens', says: ['Je peux te demander un conseil ?', 'Toi qui connais la vie, dis-moi…'] },
    ],
  },
  {
    id: 'proposer',
    label: 'Proposer',
    icon: Handshake,
    colors: ['#ffd54f', '#ffa000'],
    topics: [
      { id: 'grin', label: 'Proposer le thé au grin', icon: Coffee, hint: '30 min · on refait le monde', says: ['On va au grin prendre le thé ?', 'Viens, on va boire le thé au grin !'] },
      { id: 'maquis', label: 'Inviter au maquis', icon: Beer, hint: 'Adultes · 2 000 à 3 000 Djai si on dit oui', says: ['On va au maquis ? C\'est moi qui paie !', 'Viens, on va s\'asseoir au maquis !'] },
      { id: 'aide', label: 'Proposer un coup de main', icon: HandHelping, hint: '15 min · un petit billet en retour, parfois', says: ['Je peux t\'aider ?', 'Donne, je vais t\'aider avec ça !'] },
      { id: 'numero', label: 'Échanger les numéros', icon: Smartphone, hint: 'Peut devenir un·e ami·e', says: ['On peut échanger les numéros ?', 'Donne ton numéro, on va se bipper !'] },
    ],
  },
  {
    id: 'taquiner',
    label: 'Taquiner',
    icon: Laugh,
    colors: ['#ff7ad9', '#b02bd6'],
    topics: [
      { id: 'chambrer', label: 'Chambrer', icon: Smile, hint: 'Ça rigole… ou ça vexe', says: ['Toi tu marches comme un gbaka en panne !', 'Eh, c\'est ta tête de dimanche ça ?'] },
      { id: 'defi', label: 'Pierre-feuille-ciseaux', icon: Scissors, hint: '4 min · le perdant danse', says: ['Pierre-feuille-ciseaux ! Le perdant danse !'] },
      { id: 'drague', label: 'Draguer', icon: Heart, hint: 'Adultes · ça passe ou ça casse', says: ['Toi tu as un charme hein !', 'On peut se connaître un peu ?'] },
    ],
  },
]

// Romance, between adults only: the Sim grown up, the person met as an adult
// (their number taken), and the player who said once they're 18 or over.
const LOVE = { id: 'coeur', label: 'Cœur', icon: Heart, colors: ['#ff8fb1', '#e0245e'] as [string, string] }
function loveTopics(friend: Friend | undefined, taken?: string): Topic[] {
  if (!friend?.adult) return []
  // Already with someone else: it's cheating, and the quarter talks (backend sims/cheating.go).
  if (!friend.partner) return [{ id: 'sortir', label: 'Lui demander de sortir ensemble', icon: Heart, hint: taken ? `Tu es avec ${taken} : si ça se sait…` : 'Plus vous êtes proches, plus c’est oui', says: ['Et si on sortait ensemble, toi et moi ?'] }]
  return [
    ...(friend.home ? [] : [{ id: 'emmenager', label: 'Lui proposer de venir vivre chez toi', icon: House, hint: 'Vous vivrez ensemble à la maison', says: ['Viens vivre avec moi à la maison !'] }]),
    { id: 'rompre', label: 'Rompre', icon: HeartCrack, hint: 'C’est fini entre vous', says: ['Il faut qu’on parle… c’est fini entre nous.'] },
  ]
}

/** What goes with a line typed by the player: the conversation so far and who they are, for their answer. */
export type FreeTalk = { before: { who: 'me' | 'them'; text: string }[]; job: string; doing?: string; languages: string[]; rapport: number; met: number }

/** What they answered, and how they took it. */
export type Reply = { text: string; mood?: 'good' | 'bad' | 'bye' }
type Line = { who: 'me' | 'them'; text: string; mood?: Reply['mood'] }

// What they do, from their seed (always the same for the same person).
const JOBS = {
  femme: ['Vendeuse de garba', 'Couturière', 'Coiffeuse', 'Étudiante', 'Infirmière', "Vendeuse d'attiéké", 'Commerçante au marché', 'Institutrice', 'Caissière', 'Gérante de maquis', 'Esthéticienne', 'Vendeuse de pagnes'],
  homme: ['Chauffeur de gbaka', 'Apprenti gbaka', 'Mécanicien', 'Étudiant', 'Tailleur', 'Vigile', 'Menuisier', 'Vendeur de crédit', 'Livreur à moto', 'Maçon', 'Instituteur', 'Coiffeur', 'Boutiquier'],
}
/** Those in uniform are what their uniform says: the officer, the vigile, the priest. */
const UNIFORMS: Record<string, [string, string]> = { policier: ['Policier', 'Policière'], vigile: ['Vigile', 'Vigile'], soutane: ['Prêtre', 'Religieuse'], soeur: ['Religieuse', 'Religieuse'], imam: ['Fidèle de la mosquée', 'Fidèle de la mosquée'] }
export const jobOf = (npc: Pick<Npc, 'gender' | 'seed'> & { look?: { outfit?: string } }) => {
  const u = npc.look?.outfit ? UNIFORMS[npc.look.outfit] : undefined
  return u ? u[npc.gender === 'femme' ? 1 : 0] : JOBS[npc.gender][npc.seed % JOBS[npc.gender].length]
}

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

/** A light colour (a white shirt, a yellow pagne): the initial in it goes dark. */
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

/** Their answer, written out letter by letter as they say it (a tap shows it all). */
function Typed({ text, onType, onDone }: { text: string; onType?: () => void; onDone?: () => void }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    // About a second and a half for a long line, quicker for short ones.
    const step = Math.max(8, Math.min(28, 1400 / text.length))
    const t = setInterval(() => setN((k) => (k >= text.length ? (clearInterval(t), k) : k + 2)), step)
    return () => clearInterval(t)
  }, [text])
  useEffect(() => onType?.(), [n]) // eslint-disable-line react-hooks/exhaustive-deps
  const done = n >= text.length
  useEffect(() => void (done && onDone?.()), [done]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span onClick={() => setN(text.length)}>
      {text.slice(0, n)}
      {/* The rest kept in place (invisible), so the bubble doesn't grow line by line. */}
      {!done && <span className="opacity-0">{text.slice(n)}</span>}
    </span>
  )
}

/** How well you get on, as five hearts: one won pops and floats up, one lost breaks off. */
function Hearts({ rapport }: { rapport: number }) {
  const prev = useRef(rapport)
  const [change, setChange] = useState<{ k: number; up: boolean; id: number } | null>(null)
  useEffect(() => {
    if (rapport !== prev.current) setChange({ k: Math.max(rapport, prev.current) - 1, up: rapport > prev.current, id: Date.now() })
    prev.current = rapport
  }, [rapport])
  return (
    <span className="relative flex gap-0.5" aria-label={`Entente ${rapport} sur 5`}>
      {[0, 1, 2, 3, 4].map((k) => (
        <span key={k} className="relative">
          <Heart size={14} strokeWidth={2.6} className={`${k < rapport ? 'fill-[var(--color-rose)] text-[var(--color-rose)]' : 'text-black/15'} ${change?.k === k ? 'motion-gram-like' : ''}`} key={change?.k === k ? change.id : 0} />
          {change?.k === k && (
            <span key={change.id} className="motion-heart-up pointer-events-none absolute -top-1 left-1/2 -ml-2">
              {change.up ? <Heart size={16} className="fill-[var(--color-rose)] text-[var(--color-rose)]" /> : <HeartCrack size={16} className="text-[var(--color-ink-soft)]" />}
            </span>
          )}
        </span>
      ))}
    </span>
  )
}

export function ChatSheet({ npc, simGender, onSay, onType, onClose, onBye, onDames, languages = [], onLanguages, gameMinutes = 0, friend, taken, grownUp, adultAccount, onConfirmAdult }: {
  npc: Npc
  simGender: 'femme' | 'homme'
  onSay: (topic: string, label: string, said?: string, lang?: string) => Promise<Reply | null>
  /** Saying anything, typed (an update: parler-libre); not there, only the topics. */
  onType?: (text: string, about: FreeTalk) => Promise<Reply | null>
  onClose: () => void
  /** « Au revoir »: the chat is over (not one more thing said). */
  onBye?: () => void
  /** One of the men of the grin: a game of dames with him. */
  onDames?: () => void
  /** The languages the player speaks besides French, and saving them. */
  languages?: string[]
  onLanguages?: (langs: string[]) => Promise<void>
  /** The game's clock: the greeting of the hour. */
  gameMinutes?: number
  /** Them in the Sim's friends (their number taken), with where you are together. */
  friend?: Friend
  /** The name of who the Sim is already together with, if anyone else. */
  taken?: string
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
  // They're saying their line (written out): their face nods.
  const [talking, setTalking] = useState(true)
  const log = useRef<HTMLDivElement>(null)
  useEffect(() => remember(npc.id, mem), [npc.id, mem])
  const scroll = () => log.current?.scrollTo({ top: log.current.scrollHeight })
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' })
  }, [lines, busy])
  // Their colours: the tint of the header from their clothes, the ring round their face from how you get on.
  const tint = /^#[0-9a-f]{6}$/i.test(npc.look.outfitColor ?? '') ? npc.look.outfitColor! : '#ff7a00'
  const ring = mem.rapport >= 4 ? 'linear-gradient(135deg,#3ee08f,#00a862)' : mem.rapport <= 1 ? 'linear-gradient(135deg,#ff8fa3,#e0245e)' : 'linear-gradient(135deg,#ffd76a,#ff9f1c)'
  const say = async (id: string, label: string, said?: string, lang?: string) => {
    setBusy(true)
    // What the Sim says, word for word (a greeting in a language the game has no words for: what it does).
    setLines((l) => [...l, { who: 'me', text: !said ? label : said.startsWith('(') ? said : `« ${said} »` }])
    const r = await onSay(id, `${label} avec ${npc.name}`, said, lang)
    setBusy(false)
    if (!r) return setLines((l) => l.slice(0, -1))
    setLines((l) => [...l, { who: 'them', text: r.text, mood: r.mood }])
    setTalking(true)
    setUsed((u) => (u.includes(id) ? u : [...u, id]))
    if (r.mood === 'bye') return setGone(true)
    if (r.mood) {
      const step = r.mood === 'good' ? 1 : -1
      setMem((m) => ({ ...m, rapport: Math.min(5, Math.max(0, m.rapport + step)) }))
    }
  }
  // Typed: said as it is, answered in their own words.
  const [draft, setDraft] = useState('')
  const typed = useRef<HTMLInputElement>(null)
  const sendFree = async () => {
    const text = draft.trim()
    if (!text || busy || !onType) return
    setDraft('')
    setBusy(true)
    const before = lines.map((l) => ({ who: l.who, text: l.text }))
    setLines((l) => [...l, { who: 'me', text }])
    const r = await onType(text, { before, job: jobOf(npc), doing: npc.doing, languages: theirs.map(languageLabel), rapport: mem.rapport, met: mem.met })
    setBusy(false)
    if (!r) return (setLines((l) => l.slice(0, -1)), setDraft(text))
    setLines((l) => [...l, { who: 'them', text: r.text, mood: r.mood }])
    setTalking(true)
    if (r.mood === 'bye') return setGone(true)
    if (r.mood) setMem((m) => ({ ...m, rapport: Math.min(5, Math.max(0, m.rapport + (r.mood === 'good' ? 1 : -1))) }))
    typed.current?.focus()
  }
  const love = loveTopics(friend, taken)
  // What they speak besides French; the greetings in the player's own languages.
  const theirs = npcLanguages(npc.seed)
  const shared = languages.find((l) => theirs.includes(l))
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<string[]>(languages)
  const greetings: Topic[] = languages.length
    ? languages.map((l) => ({ id: 'langue', lang: l, label: `Saluer en ${languageLabel(l).toLowerCase()}`, icon: Hand, hint: theirs.includes(l) ? `${greetingIn(l, gameMinutes, npc.gender)} · ${npc.name} le parle` : greetingIn(l, gameMinutes, npc.gender), says: [greetingIn(l, gameMinutes, npc.gender)] }))
    : [{ id: 'langues', label: 'Tu parles d’autres langues ?', icon: Hand, hint: 'Dioula, baoulé, bété… choisis les tiennes' }]
  const base = GROUPS.map((x) => (x.id === 'saluer' ? { ...x, topics: greetings } : x))
  const groups = grownUp ? [...base, { ...LOVE, topics: love }] : base
  const g = groups.find((x) => x.id === group) ?? groups[0]
  const pick = (t: Topic) => {
    if (t.id === 'langues') return setPicking(true)
    const line = t.says?.length ? t.says[(used.length + mem.met) % t.says.length] : undefined
    void say(t.id, t.label, line, t.lang)
  }
  return (
    <Sheet onClose={onClose} dim="bg-[#0f1230]/20" className="max-h-[70vh] p-4 lg:w-[460px]">
      {(close) => (
        <>
        {/* Who you're talking to: their face (nodding while they speak), what they do, how well you get on */}
        <div className="-mx-4 -mt-4 flex shrink-0 items-center gap-3 rounded-t-[28px] px-4 pt-6 pb-2 lg:rounded-t-[28px]" style={{ background: `linear-gradient(180deg, ${tint}2e, ${tint}00)` }}>
          <div className={`relative h-[64px] w-[64px] shrink-0 rounded-full p-[3px] ${talking && !busy ? 'motion-talk' : ''}`} style={{ background: ring }}>
            <div className="relative h-full w-full overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_35%,#fff6e6,#ffd9a8)]">
              <span className="absolute inset-0 grid place-items-center font-display text-2xl font-extrabold" style={{ color: light(tint) ? '#5b6178' : tint }}>
                {npc.name[0]}
              </span>
              <Portrait look={npc.look} gender={npc.gender} framing="head" className="absolute inset-0 h-full w-full scale-[1.15] object-cover" alt={npc.name} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-display text-[23px] leading-tight font-extrabold">{npc.name}</span>
              <Hearts rapport={mem.rapport} />
            </div>
            <div className="truncate text-[12.5px] font-extrabold text-[var(--color-ink-soft)]">
              {jobOf(npc)}
              {npc.doing ? ` · ${npc.doing}` : ''}
            </div>
            {/* What they speak besides French: a greeting in it pleases them */}
            <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] font-bold text-[var(--color-ink-soft)]">
              <span className="rounded-full bg-white/80 px-2 py-0.5">{mem.met <= 1 ? '1re rencontre' : `Vu·e ${mem.met} fois`}</span>
              <span className="truncate">
                Parle {theirs.map((l) => languageLabel(l).toLowerCase()).join(', ')}
                {shared ? ' · comme toi' : ''}
              </span>
            </div>
          </div>
          <button className="icon-btn self-start bg-white/80" onClick={close} aria-label="Fermer">
            <X size={22} strokeWidth={2.6} />
          </button>
        </div>
        {/* The conversation so far */}
        <div ref={log} className="mt-2 flex max-h-[24vh] min-h-[52px] shrink-0 flex-col gap-2 overflow-y-auto px-0.5 pt-1 pb-1">
          {lines.map((l, i) => {
            const text = l.who === 'them' && !l.text.startsWith('«') && !l.text.includes(npc.name) ? `« ${l.text} »` : l.text
            const last = i === lines.length - 1
            return l.who === 'me' ? (
              <div key={i} className="motion-bubble-me max-w-[85%] self-end rounded-[20px] rounded-br-md bg-[var(--color-orange)] px-3.5 py-2 text-[14px] font-extrabold text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]">
                {text}
              </div>
            ) : (
              <div key={i} className={`motion-bubble-them relative max-w-[90%] self-start rounded-[20px] rounded-tl-md border-2 bg-white px-3.5 py-2 text-[15px] leading-snug font-bold shadow-[0_6px_14px_-10px_rgba(15,18,48,0.5)] ${l.mood === 'good' ? 'border-[var(--color-emerald)]/45' : l.mood === 'bad' ? 'border-[var(--color-rose)]/45' : 'border-[var(--color-line)]'}`}>
                {last ? <Typed text={text} onType={scroll} onDone={() => setTalking(false)} /> : text}
              </div>
            )
          })}
          {busy && (
            <div className="motion-bubble-them flex gap-1 self-start rounded-[20px] rounded-tl-md border-2 border-[var(--color-line)] bg-white px-3.5 py-3" aria-label={`${npc.name} répond`}>
              {[0, 1, 2].map((k) => (
                <span key={k} className="motion-typing" style={{ animationDelay: `${k * 0.15}s` }} />
              ))}
            </div>
          )}
        </div>
        {/* Typing what you want to say, like in a messaging app */}
        {onType && !gone && (
          <form
            className="mt-2 flex shrink-0 items-center gap-2 rounded-[22px] border-2 border-[var(--color-line)] bg-white p-1 pl-3.5 transition-colors focus-within:border-[var(--color-orange)]"
            onSubmit={(e) => (e.preventDefault(), void sendFree())}
          >
            <input ref={typed} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={280} enterKeyHint="send" autoComplete="off" placeholder={`Écris à ${npc.name}…`} aria-label={`Écrire à ${npc.name}`} className="min-w-0 flex-1 bg-transparent py-2 text-[15px] font-bold outline-none placeholder:text-[#9aa0b4] focus-visible:outline-none" />
            <button type="submit" disabled={!draft.trim() || busy} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-white transition ${draft.trim() && !busy ? 'motion-pop bg-[var(--color-orange)] shadow-[inset_0_-3px_0_rgba(0,0,0,0.15)]' : 'bg-[#d6d9e5]'}`} aria-label="Envoyer">
              <SendHorizontal size={19} strokeWidth={2.6} />
            </button>
          </form>
        )}
        {gone ? (
          <button className="btn motion-pop mt-3 w-full shrink-0" onClick={close}>
            À plus, {npc.name} !
          </button>
        ) : (
          <>
            {/* The groups (greet, chat, ask, offer, tease, love), all in sight on one row: a scrolling row hid the last ones on small phones */}
            <div className="relative mt-3 flex shrink-0 rounded-[18px] bg-[var(--color-canvas)] p-1" role="tablist">
              {/* The pill under the group chosen, sliding from one to the other */}
              <span className="absolute top-1 bottom-1 left-1 rounded-[14px] bg-white shadow-[0_2px_8px_-3px_rgba(15,18,48,0.3),inset_0_-2px_0_rgba(15,18,48,0.06)]" style={{ width: `calc((100% - 8px) / ${groups.length})`, transform: `translateX(${groups.indexOf(g) * 100}%)`, transition: 'transform 0.42s var(--ease-spring)' }} aria-hidden />
              {groups.map((x) => {
                const on = x.id === g.id
                return (
                  <button key={x.id} role="tab" aria-selected={on} className="relative z-10 flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[14px] px-0.5 pt-1.5 pb-1" onClick={() => setGroup(x.id)}>
                    <x.icon size={21} strokeWidth={2.5} className={on ? 'motion-boing' : ''} style={{ color: on ? x.colors[1] : 'var(--color-ink-soft)', transition: 'color 0.2s' }} />
                    <span className="text-[10px] leading-tight font-extrabold whitespace-nowrap min-[360px]:text-[11px]" style={{ color: on ? x.colors[1] : 'var(--color-ink-soft)', transition: 'color 0.2s' }}>
                      {x.label}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
              {group === 'saluer' && (
                <div key="salut" className="motion-stagger mb-2 flex flex-wrap gap-1.5">
                  {greetingsFor(npc.gender).map((phrase) => (
                    <button key={phrase} className="tile flex-auto px-3 py-2 text-center text-[14px] font-extrabold disabled:opacity-50" disabled={busy} onClick={() => say('salut', 'Saluer', phrase)}>
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
              {/* The languages the player speaks, chosen here or in the profile */}
              {g.id === 'saluer' && picking && (
                <div className="mb-2 rounded-2xl bg-[var(--color-canvas)] p-3">
                  <p className="mb-2 text-sm font-extrabold">Tu parles quelles langues, à part le français ?</p>
                  <div className="flex flex-wrap gap-1.5">
                    {LANGUAGES.map((l) => (
                      <button key={l.id} className={`rounded-full px-3 py-1.5 text-sm font-extrabold ${picked.includes(l.id) ? 'bg-[var(--color-orange)] text-white' : 'bg-white text-[var(--color-ink-soft)]'}`} onClick={() => setPicked((p) => (p.includes(l.id) ? p.filter((x) => x !== l.id) : p.length < 6 ? [...p, l.id] : p))}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                  <button className="btn mt-2 w-full !py-2" onClick={() => void onLanguages?.(picked).then(() => setPicking(false))}>
                    C’est noté
                  </button>
                </div>
              )}
              {g.id === 'saluer' && languages.length > 0 && !picking && (
                <button className="mb-2 text-xs font-extrabold text-[var(--color-ink-soft)] underline" onClick={() => setPicking(true)}>
                  Mes langues
                </button>
              )}
              <ul key={g.id} className={`motion-stagger grid gap-1.5 ${g.id === 'coeur' && !adultAccount ? 'hidden' : ''}`}>
                {g.topics.map((t) => (
                  <li key={t.id + (t.lang ?? '')}>
                    <button className="tile flex w-full items-center gap-3 p-2.5 text-left shadow-[inset_0_-3px_0_rgba(15,18,48,0.05)] disabled:opacity-50" disabled={busy} onClick={() => pick(t)}>
                      <IconTile icon={t.icon} colors={g.colors} size={38} style={{ boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.15), inset 0 2px 0 rgba(255,255,255,0.3)' }} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-[15px] leading-tight font-extrabold">{t.label}</span>
                        <span className="text-xs font-bold text-[var(--color-ink-soft)]">{used.includes(t.id) && t.id !== 'langue' ? 'Déjà dit : ça risque de lasser' : t.hint}</span>
                      </span>
                      {used.includes(t.id) && t.id !== 'langue' && <Check size={18} strokeWidth={3} className="shrink-0 text-[var(--color-emerald)]" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            {/* One of the men of the grin: sit down at the board with him */}
            {onDames && (
              <button className="mt-3 flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#7a4a22] py-2.5 text-sm font-extrabold text-white" onClick={onDames}>
                <Grid3x3 size={16} /> Jouer aux dames avec {npc.name}
              </button>
            )}
            {/* Taking leave ends the chat there and then, in a language you share if you have one */}
            <button className="mt-3 w-full shrink-0 rounded-2xl bg-[var(--color-canvas)] py-2.5 text-sm font-extrabold text-[var(--color-ink-soft)]" onClick={onBye ?? close}>
              {goodbyeIn(shared, npc.name)}
            </button>
          </>
        )}
        </>
      )}
    </Sheet>
  )
}
