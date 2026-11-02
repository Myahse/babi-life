import { BookOpen, Check, Moon, Navigation, Plane, Sparkles, Square, Volume2 } from 'lucide-react'
import { Portrait } from '../avatar/portrait'
import { randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'
import { HistAwaFace as AwaFace } from './histoiresWorld'
import PLAN from './histoiresPlan.json'
import MOTS from './histoiresMots.json'
import { BORDERS, MAP, onMap } from './histoiresCarte'

// « Les histoires se racontent » (FILM=histoires, marketing/scripts/histoires.md):
// Awa shows the quartier's stories and their prologues read aloud. Drawn over the
// film's 3D scenes (lab/poster.tsx), at the film's time t: the phone's « Demandes »
// app as in the game (components/ErrandsApp.tsx), « Écouter » tapped, then four
// prologues as the game reads them, their words lit one by one as they're said,
// the choice among three, the trips, the Djai, the comments.
// The times follow the sound: histoiresPlan.json (marketing/histoires-son.py) and
// histoiresMots.json (marketing/histoires-mots.mjs).

export type HistScreen = 'hello' | 'quartier' | 'ecouter' | 'conte' | 'awa' | 'choix' | 'voyage' | 'djai' | 'laquelle'

const clamp01 = (k: number) => Math.max(0, Math.min(1, k))
const ease = (k: number) => k * k * (3 - 2 * k)
const fadeIn = (t: number, at: number, d = 0.3) => clamp01((t - at) / d)
const pop = (t: number, at: number, d = 0.45) => {
  const k = ease(fadeIn(t, at, d))
  return {
    opacity: k,
    transform: `translateY(${(1 - k) * 24}px) scale(${0.85 + 0.15 * k})`,
  }
}

/** The film's times: Awa's lines and the prologues, one after the other (marketing/histoires-son.py). */
const AT = Object.fromEntries(PLAN.pieces.map((p) => [p.id, p]))
const at = (id: string) => AT[id].from

/** What each piece of the sound shows: its scene (lab/histoiresWorld.tsx) and what's drawn over it. */
const SHOW: Record<string, [string, HistScreen]> = {
  hello: ['hist:terrasse', 'hello'],
  quartier: ['hist:grin', 'quartier'],
  ecouter: ['hist:grin', 'ecouter'],
  'cour-hantee': ['hist:cour', 'conte'],
  rire: ['hist:pari', 'awa'],
  'dent-de-man': ['hist:pari', 'conte'],
  coeur: ['hist:grin', 'awa'],
  'kone-petit-fils': ['hist:grin-retour', 'conte'],
  mystere: ['hist:maudit', 'awa'],
  'maquis-maudit': ['hist:maudit', 'conte'],
  choix: ['hist:terrasse-tel', 'choix'],
  voyage: ['hist:ciel', 'voyage'],
  djai: ['hist:terrasse-djai', 'djai'],
  laquelle: ['hist:terrasse', 'laquelle'],
}

/** The film for lab/poster.tsx: a shot a piece of the sound, each running to the next, then the end card. */
export const HIST_FILM = {
  shots: [
    ...PLAN.pieces.map((p, i) => ({
      from: i ? p.from : 0,
      to: PLAN.pieces[i + 1]?.from ?? PLAN.outro,
      scene: SHOW[p.id][0],
      hist: SHOW[p.id][1],
    })),
    { from: PLAN.outro, to: PLAN.length, scene: 'hist:fin' },
  ],
  intro: 0,
  outro: PLAN.outro,
  length: PLAN.length,
}

/** Awa's words on screen: the line they're in, and when in it. */
const CAPS: [number, string][] = (
  [
    ['hello', 0.1, 'La famille ! C’est Awa 👋🏾'],
    ['hello', 2.0, 'Y a du nouveau dans Babi Life…'],
    ['hello', 4.3, 'Et ça là, c’est fort ! 🔥'],
    ['quartier', 0.1, 'Les histoires du quartier 📖'],
    ['quartier', 1.55, 'Chaque jour, quelqu’un vient te voir avec son histoire'],
    ['quartier', 4.4, 'Et le lendemain, il revient avec la suite !'],
    ['ecouter', 0, 'Maintenant, tu appuies sur «\u00a0Écouter\u00a0»…'],
    ['ecouter', 2.6, '… et je te raconte tout 🤫'],
    ['rire', 0, 'Y a des histoires qui font peur… 😱'],
    ['rire', 2.95, '… et d’autres qui font rire ! 😂'],
    ['coeur', 0, 'Des histoires qui touchent le cœur… 🥹'],
    ['mystere', 0, 'Et des mystères… de sorcellerie ! 👀'],
    ['choix', 0, '25 histoires !'],
    ['choix', 1.5, 'C’est toi qui choisis la prochaine, parmi trois'],
    ['voyage', 0, 'Certaines t’emmènent en voyage ✈️'],
    ['djai', 0, 'Chaque chapitre te rapporte jusqu’à 2 000 Djai 💰'],
    ['laquelle', 0, 'Alors, tu commences par laquelle ?'],
    ['laquelle', 1.9, 'Dis-moi en commentaire 👇🏾'],
    ['laquelle', 3.1, 'Allez, à toi de jouer !'],
  ] as [string, number, string][]
).map(([id, k, text]) => [at(id) + k, text])

type Tale = {
  id: string
  title: string
  giver: string
  role: string
  gender: 'femme' | 'homme'
  mood: string
  words: [string, number][]
}

/** The four prologues heard, by when they start (film time): their words and when each is said (histoires-mots.mjs). */
const TALES: Record<number, Tale> = Object.fromEntries(
  (
    [
      {
        id: 'cour-hantee',
        title: 'La cour hantée',
        giver: 'Maman Brigitte',
        role: 'Propriétaire de la cour',
        gender: 'femme',
        mood: '#1b2a6b',
      },
      {
        id: 'dent-de-man',
        title: 'Le défi de la Dent de Man',
        giver: 'Boris',
        role: '« Coach sportif »',
        gender: 'homme',
        mood: '#7a3b00',
      },
      {
        id: 'kone-petit-fils',
        title: 'Le petit-fils du vieux Koné',
        giver: 'Le vieux Koné',
        role: 'Le thé du grin',
        gender: 'homme',
        mood: '#6b4a00',
      },
      {
        id: 'maquis-maudit',
        title: 'Le maquis maudit',
        giver: 'Tantie Bintou',
        role: 'Le maquis du coin',
        gender: 'femme',
        mood: '#5c0a0a',
      },
    ] as Omit<Tale, 'words'>[]
  ).map((tale) => [
    at(tale.id),
    {
      ...tale,
      words: (MOTS as unknown as Record<string, { words: [string, number][] }>)[tale.id].words,
    },
  ]),
)

function Face({ name, gender, size }: { name: string; gender: 'femme' | 'homme'; size: number }) {
  return (
    <div className="shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-[#ffd36e] to-[#ff8a3d] ring-2 ring-white" style={{ width: size, height: size }}>
      <Portrait look={randomLook(gender, rng(`errand:${name}`))} gender={gender} />
    </div>
  )
}

/** Sound bars moving, as long as the voice is playing. */
function Bars({ t, color = '#a86800', n = 5, h = 18 }: { t: number; color?: string; n?: number; h?: number }) {
  return (
    <span className="flex items-end gap-[3px]" style={{ height: h }}>
      {Array.from({ length: n }, (_, i) => (
        <i
          key={i}
          className="block w-[4px] rounded-full"
          style={{
            background: color,
            height: h * (0.3 + 0.7 * Math.abs(Math.sin(t * (7 + i * 1.7) + i * 1.3))),
          }}
        />
      ))}
    </span>
  )
}

/** The phone, and in it the « Demandes » app. */
function Phone({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="w-[370px] rounded-[48px] bg-[#141416] p-2.5 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.8)]" style={style}>
      <div className="overflow-hidden rounded-[40px] bg-white font-sans text-[var(--color-ink)]">
        <div className="flex items-center gap-2 border-b border-black/5 px-5 pt-6 pb-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#ff8a3d] text-white">
            <BookOpen size={20} strokeWidth={2.6} />
          </span>
          <span className="font-display text-[22px] font-extrabold">Demandes</span>
        </div>
        <div className="p-3.5">{children}</div>
      </div>
    </div>
  )
}

const KONE = {
  title: 'Le petit-fils du vieux Koné',
  giver: 'Le vieux Koné',
  role: 'Le thé du grin',
  prologue: 'Au grin du quartier, sous le manguier, le vieux Koné sert le thé depuis quarante ans. Tout le monde le respecte, mais personne ne sait qu’il compte les jours…',
}

/** The story under way, as ErrandsApp's StoryCard shows it: day 1, then the next day. */
function StoryCard({ t, day2, listen }: { t: number; day2?: boolean; listen?: 'idle' | 'playing' }) {
  return (
    <div className="rounded-2xl bg-gradient-to-b from-[#fff3d6] to-[#ffe7b3] p-3.5 shadow-[inset_0_0_0_2px_#ffd36e]">
      <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-extrabold tracking-wide text-[#a86800] uppercase">
        <BookOpen size={15} strokeWidth={2.6} /> Histoire · chapitre {day2 ? 2 : 1} sur 4
      </div>
      <div className="font-display text-[22px] leading-tight font-extrabold">{KONE.title}</div>
      {!day2 && <p className="mt-1.5 text-[15px] leading-snug font-semibold text-[#7a5200] italic">{KONE.prologue}</p>}
      {!day2 && listen && (
        <span className={`mt-2 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[15px] font-extrabold ${listen === 'playing' ? 'bg-[#ff8a3d] text-white' : 'bg-[#fff8e1] text-[#a86800]'}`}>
          {listen === 'playing' ? <Square size={15} strokeWidth={2.8} /> : <Volume2 size={17} strokeWidth={2.6} />} {listen === 'playing' ? 'Arrêter' : 'Écouter'}
          {listen === 'playing' && <Bars t={t} color="#fff" h={14} n={4} />}
        </span>
      )}
      <div className="mt-2.5 flex items-center gap-3">
        <Face name={KONE.giver} gender="homme" size={52} />
        <div className="min-w-0 flex-1">
          <div className="font-display text-[18px] leading-tight font-extrabold">{KONE.giver}</div>
          <div className="text-[13px] font-bold text-[var(--color-ink-soft)]">{KONE.role}</div>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[13px] font-extrabold text-[#a86800]">+800 Djai</span>
      </div>
      <p className="mt-2.5 rounded-2xl bg-white p-3 text-[15px] leading-snug font-bold">
        « {day2 ? 'Il arrive à l’aéroport ce soir ! Aide-moi à préparer la cour, je veux qu’il soit fier de son grand-père.' : 'Mon petit-fils arrive de France. Va m’acheter du bon thé au marché, je veux le recevoir comme il faut.'} »
      </p>
      <div className="mt-2.5 flex items-center justify-center gap-2 rounded-full bg-[var(--color-orange)] py-2 text-[16px] font-extrabold text-white">
        <Navigation size={17} strokeWidth={2.6} /> Y aller
      </div>
    </div>
  )
}

/** A finger coming to tap, and its ripple. */
function Tap({ t, at, x, y }: { t: number; at: number; x: number; y: number }) {
  const come = ease(clamp01((t - at + 0.7) / 0.7))
  const r = clamp01((t - at) / 0.45)
  return (
    <>
      {t > at && r < 1 && (
        <i
          className="absolute block rounded-full border-4 border-white"
          style={{
            left: x - 10 - r * 30,
            top: y - 10 - r * 30,
            width: 20 + r * 60,
            height: 20 + r * 60,
            opacity: 1 - r,
          }}
        />
      )}
      <span
        className="absolute text-[64px]"
        style={{
          left: x - 18 + (1 - come) * 120,
          top: y - 8 + (1 - come) * 160,
          opacity: come,
          transform: `scale(${t > at && t < at + 0.15 ? 0.9 : 1})`,
        }}
      >
        👆🏾
      </span>
    </>
  )
}

/** A prologue being told: the story's card at the top, its words lit as they're said. */
function Conte({ t, from, tale }: { t: number; from: number; tale: Tale }) {
  const local = t - from
  // The line on screen: the words of the current sentence (about seven at a time).
  const said = tale.words.filter(([, at]) => at <= local + 0.05).length
  const start = Math.max(0, Math.floor(Math.max(0, said - 1) / 7) * 7)
  const line = tale.words.slice(start, start + 7)
  const cursed = tale.words.find(([w]) => /travaill/i.test(w))?.[1] ?? 99
  const curse = local > cursed - 0.05 && local < cursed + 0.95
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 45%, transparent 35%, ${tale.mood}cc 100%)`,
        }}
      />
      <div className="absolute inset-x-0 top-0 h-[34%] bg-gradient-to-b from-black/75 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-black/85 to-transparent" />
      <div className="absolute inset-x-0 top-[6%] flex flex-col items-center gap-3 px-6 text-center">
        <div className="flex items-center gap-2 rounded-full bg-[#ffd36e] px-4 py-1.5 font-sans text-[18px] font-extrabold tracking-wide text-[#6b4400] uppercase" style={pop(t, from + 0.05)}>
          <BookOpen size={20} strokeWidth={2.8} /> Histoire du quartier
        </div>
        <div className="font-display text-[46px] leading-[1.02] font-extrabold drop-shadow-[0_4px_10px_rgba(0,0,0,0.7)]" style={pop(t, from + 0.2)}>
          {tale.title}
        </div>
        <div className="mt-1 flex items-center gap-3 rounded-full bg-black/45 py-1.5 pr-4 pl-1.5 backdrop-blur" style={pop(t, from + 0.4)}>
          <Face name={tale.giver} gender={tale.gender} size={44} />
          <span className="font-sans text-[19px] font-extrabold">{tale.giver}</span>
          <Bars t={t} color="#ffd36e" h={20} />
          <Volume2 size={22} strokeWidth={2.6} className="text-[#ffd36e]" />
        </div>
      </div>
      {curse && (
        <div className="absolute inset-x-0 top-[40%] flex justify-center">
          <div
            className="font-display text-[84px] font-extrabold text-[#ff2b2b] drop-shadow-[0_0_30px_rgba(255,0,0,0.8)]"
            style={{
              transform: `scale(${1.25 - 0.25 * ease(clamp01((local - cursed) / 0.25))}) rotate(${Math.sin(local * 60) * 2}deg)`,
              opacity: clamp01((cursed + 0.95 - local) / 0.2),
            }}
          >
            TRAVAILLÉ
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-[9%] flex justify-center px-8">
        <p className="text-center font-display text-[40px] leading-[1.12] font-extrabold drop-shadow-[0_3px_8px_rgba(0,0,0,0.9)]">
          {line.map(([w, at], i) => (
            <span
              key={start + i}
              style={{
                color: at <= local + 0.05 ? (/travaill/i.test(w) ? '#ff3b3b' : '#ffd36e') : 'rgba(255,255,255,0.55)',
              }}
            >
              {w}{' '}
            </span>
          ))}
        </p>
      </div>
      <div className="absolute bottom-[3.2%] left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 font-sans text-[15px] font-extrabold text-white/85">🔊 Lu dans le jeu</div>
    </>
  )
}

const OFFERS = [
  {
    id: 'chimpanze',
    title: 'L’évasion de Zézé',
    giver: 'Monsieur Gnagne',
    role: 'Soigneur au zoo',
    gender: 'homme' as const,
    chapters: 4,
  },
  {
    id: 'mami-wata',
    title: 'La lumière sur la lagune',
    giver: 'Akpa',
    role: 'Pêcheur',
    gender: 'homme' as const,
    chapters: 4,
  },
  {
    id: 'caimans',
    title: 'La bague des caïmans sacrés',
    giver: 'Tonton Kouassi',
    role: 'Chauffeur de woro-woro',
    gender: 'homme' as const,
    chapters: 5,
    trip: 'Yamoussoukro',
  },
]

/** « Choisis ta prochaine histoire »: three, each with its « Écouter ». */
function Choice({ t, from }: { t: number; from: number }) {
  const local = t - from
  const picked = local > 3.7
  return (
    <div className="rounded-2xl bg-gradient-to-b from-[#fff3d6] to-[#ffe7b3] p-3 shadow-[inset_0_0_0_2px_#ffd36e]">
      <div className="flex items-center gap-1.5 text-[12px] font-extrabold tracking-wide text-[#a86800] uppercase">
        <Sparkles size={15} strokeWidth={2.6} /> Nouvelle histoire
      </div>
      <div className="font-display text-[21px] leading-tight font-extrabold">Choisis ta prochaine histoire</div>
      <div className="mt-2 space-y-2">
        {OFFERS.map((o, i) => (
          <div
            key={o.id}
            className="rounded-2xl bg-white p-2.5"
            style={{
              ...pop(t, from + 0.5 + i * 0.35),
              outline: picked && i === 0 ? '3px solid var(--color-orange)' : undefined,
            }}
          >
            <div className="flex items-center gap-2.5">
              <Face name={o.giver} gender={o.gender} size={42} />
              <div className="min-w-0 flex-1">
                <div className="font-display text-[17px] leading-tight font-extrabold">{o.title}</div>
                <div className="truncate text-[12.5px] font-bold text-[var(--color-ink-soft)]">
                  {o.giver} · {o.role}
                </div>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] font-extrabold">
              <span className="flex items-center gap-1 rounded-full bg-[#fff8e1] px-2.5 py-1 text-[#a86800]">
                <Volume2 size={13} strokeWidth={2.6} /> Écouter
              </span>
              <span className="rounded-full bg-[var(--color-canvas)] px-2 py-1 text-[var(--color-ink-soft)]">{o.chapters} chapitres</span>
              {o.trip && (
                <span className="flex items-center gap-1 rounded-full bg-[#e7f5ff] px-2 py-1 text-[#1971c2]">
                  <Plane size={12} strokeWidth={2.8} /> Voyage : {o.trip}
                </span>
              )}
            </div>
            {i === 0 && (
              <div className="mt-2 flex items-center justify-center gap-2 rounded-full bg-[var(--color-orange)] py-1.5 text-[14px] font-extrabold text-white">
                {picked ? <Check size={16} strokeWidth={3} /> : <BookOpen size={16} strokeWidth={2.6} />} {picked ? 'C’est parti !' : 'Commencer cette histoire'}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// The map of the trips: Côte d'Ivoire and its neighbours (lab/histoiresCarte.ts, Natural Earth),
// Abidjan, and the cities the stories go to, each reached as Awa names it.
const ABIDJAN: [number, number] = [-4.02, 5.35]
const TRIPS: {
  name: string
  at: number
  p: [number, number]
  story: string
  dx?: number
}[] = [
  { name: 'Man', at: 1.75, p: [-7.55, 7.41], story: 'Le mariage attaché' },
  {
    name: 'Yamoussoukro',
    at: 2.45,
    p: [-5.28, 6.82],
    story: 'Les caïmans sacrés',
    dx: 10,
  },
  { name: 'San-Pédro', at: 3.45, p: [-6.64, 4.75], story: 'Le bateau fantôme' },
]
/** Other towns, for the eye. */
const TOWNS: [string, [number, number]][] = [
  ['Bouaké', [-5.03, 7.69]],
  ['Korhogo', [-5.63, 9.46]],
  ['Daloa', [-6.45, 6.88]],
  ['Odienné', [-7.56, 9.51]],
  ['Bondoukou', [-2.8, 8.04]],
]
const NEIGHBOURS: [string, [number, number]][] = [
  ['LIBÉRIA', [-8.55, 5.55]],
  ['GUINÉE', [-8.55, 10.2]],
  ['MALI', [-6.6, 11.05]],
  ['BURKINA FASO', [-3.75, 10.75]],
  ['GHANA', [-2.45, 7.0]],
]

function Voyage({ t, from }: { t: number; from: number }) {
  const local = t - from
  const [ax, ay] = onMap(ABIDJAN)
  return (
    <div className="absolute inset-x-0 top-[13.5%] flex justify-center" style={pop(t, from, 0.5)}>
      <div className="relative overflow-hidden rounded-[36px] border-[5px] border-white bg-[#0f4c81] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.8)]">
        <svg width={MAP.w} height={MAP.h} viewBox={`0 0 ${MAP.w} ${MAP.h}`} style={{ display: 'block' }}>
          <defs>
            <linearGradient id="mer" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3aa0e0" />
              <stop offset="1" stopColor="#0d5c9e" />
            </linearGradient>
            <clipPath id="ci">
              <path d={BORDERS.ci} />
            </clipPath>
            <filter id="ombre" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#062a4a" floodOpacity="0.55" />
            </filter>
          </defs>
          <rect width={MAP.w} height={MAP.h} fill="url(#mer)" />
          {/* The sea's ripples */}
          {Array.from({ length: 7 }, (_, i) => (
            <path key={i} d={`M${20 + ((i * 67) % 380)},${420 + (i % 3) * 22} q12,-8 24,0 t24,0`} fill="none" stroke="#9fd4ff" strokeOpacity={0.45} strokeWidth={2.5} strokeLinecap="round" transform={`translate(${Math.sin(local * 1.5 + i) * 4},0)`} />
          ))}
          <text x={MAP.w * 0.42} y={MAP.h - 26} textAnchor="middle" fontSize={17} fontStyle="italic" fontWeight={700} fill="#cfe8ff" fontFamily="Nunito, sans-serif">
            Golfe de Guinée
          </text>
          {/* The neighbours, quiet */}
          {['liberia', 'guinee', 'mali', 'burkina', 'ghana'].map((k) => (
            <path key={k} d={BORDERS[k]} fill="#e9dcc0" stroke="#c9b893" strokeWidth={1.5} strokeLinejoin="round" />
          ))}
          {NEIGHBOURS.map(([name, p]) => {
            const [x, y] = onMap(p)
            return (
              <text key={name} x={x} y={y} textAnchor="middle" fontSize={13} fontWeight={800} letterSpacing={1.5} fill="#a8946a" fontFamily="Nunito, sans-serif">
                {name}
              </text>
            )
          })}
          {/* Côte d'Ivoire: the flag's colours inside its true outline */}
          <g filter="url(#ombre)">
            <path d={BORDERS.ci} fill="#fff7e6" />
          </g>
          <g clipPath="url(#ci)" opacity={0.42}>
            <rect x={0} y={0} width={MAP.w * 0.42} height={MAP.h} fill="#ff8200" />
            <rect x={MAP.w * 0.42} y={0} width={MAP.w * 0.2} height={MAP.h} fill="#ffffff" />
            <rect x={MAP.w * 0.62} y={0} width={MAP.w * 0.38} height={MAP.h} fill="#009a44" />
          </g>
          <path d={BORDERS.ci} fill="none" stroke="#ffffff" strokeWidth={3.5} strokeLinejoin="round" />
          {TOWNS.map(([name, p]) => {
            const [x, y] = onMap(p)
            return (
              <g key={name} opacity={0.75}>
                <circle cx={x} cy={y} r={3.5} fill="#5c4a2e" />
                <text x={x} y={y - 7} textAnchor="middle" fontSize={12.5} fontWeight={800} fill="#5c4a2e" fontFamily="Nunito, sans-serif">
                  {name}
                </text>
              </g>
            )
          })}
          {/* The trips: a dotted flight from Abidjan, the plane on it, the city's pin */}
          {TRIPS.map((c) => {
            const [x, y] = onMap(c.p)
            const k = ease(clamp01((local - c.at + 0.75) / 0.75))
            if (k <= 0) return null
            const mx = (ax + x) / 2 - (y - ay) * 0.25
            const my = (ay + y) / 2 - Math.abs(x - ax) * 0.35
            const q = (u: number) => [(1 - u) * (1 - u) * ax + 2 * (1 - u) * u * mx + u * u * x, (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * my + u * u * y]
            const [px, py] = q(k)
            const [qx, qy] = q(Math.min(1, k + 0.02))
            const angle = (Math.atan2(qy - py, qx - px) * 180) / Math.PI
            const landed = k > 0.98
            const label = c.name.length * 9.5 + 22
            return (
              <g key={c.name}>
                <path d={`M${ax},${ay} Q${mx},${my} ${x},${y}`} fill="none" stroke="#e8590c" strokeWidth={3.5} strokeDasharray="2 9" strokeLinecap="round" opacity={0.35 + 0.65 * k} />
                {!landed && (
                  <text x={px} y={py} fontSize={30} textAnchor="middle" dominantBaseline="central" transform={`rotate(${angle + 45} ${px} ${py})`}>
                    ✈️
                  </text>
                )}
                {landed && (
                  <g
                    style={{
                      transform: `translate(${x}px, ${y}px) scale(${0.6 + 0.4 * ease(clamp01((local - c.at) / 0.3))})`,
                    }}
                  >
                    <path d="M0,0 C-11,-14 -13,-20 -13,-25 A13,13 0 1 1 13,-25 C13,-20 11,-14 0,0 Z" fill="#e8590c" stroke="#fff" strokeWidth={3} />
                    <circle cx={0} cy={-25} r={5} fill="#fff" />
                    <g transform={`translate(${(c.dx ?? 0) - label / 2},-66)`}>
                      <rect width={label} height={28} rx={14} fill="#161a2b" />
                      <text x={label / 2} y={19.5} textAnchor="middle" fontSize={17} fontWeight={800} fill="#fff" fontFamily="Baloo 2, sans-serif">
                        {c.name}
                      </text>
                    </g>
                  </g>
                )}
              </g>
            )
          })}
          {/* Abidjan, where everyone starts */}
          <g transform={`translate(${ax},${ay})`}>
            <circle r={13 + 4 * Math.sin(local * 4)} fill="#00b86b" opacity={0.3} />
            <circle r={9} fill="#00b86b" stroke="#fff" strokeWidth={3.5} />
            <rect x={-4} y={14} width={78} height={26} rx={13} fill="#00b86b" />
            <text x={35} y={32} textAnchor="middle" fontSize={16} fontWeight={800} fill="#fff" fontFamily="Baloo 2, sans-serif">
              Abidjan
            </text>
          </g>
        </svg>
        <div className="absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-sans text-[17px] font-extrabold text-[#1971c2] shadow">
          <Plane size={18} strokeWidth={2.8} /> Voyage
        </div>
        <div className="flex min-h-[104px] flex-col gap-1.5 bg-[#0d5c9e] px-4 pt-1 pb-3 font-sans">
          {TRIPS.map((c) =>
            local > c.at + 0.25 ? (
              <div key={c.name} className="self-start rounded-full bg-[#161a2b]/80 px-3 py-1 text-[16px] font-extrabold text-white" style={pop(local, c.at + 0.25, 0.3)}>
                <span className="text-[#ffd36e]">{c.name}</span> · {c.story}
              </div>
            ) : null,
          )}
        </div>
      </div>
    </div>
  )
}

const COMMENTS: [number, string, string][] = [
  [0.5, 'kouame.yop', 'La cour hantée direct 😱😱'],
  [1.3, 'fanta_225', 'Moi c’est Zézé le chimpanzé 😂'],
  [2.1, 'le_vrai_boris', 'Je monte la Dent de Man en 2 h, pariez 💪🏾'],
  [2.9, 'tantie.adjoua', 'Le maquis maudit, c’est travaillé oh 👀'],
  [3.7, 'pepe_yao_78', 'Le marathon de Pépé Yao, on dit quoi ? 🏃🏾‍♂️'],
]

/** Over each shot of the film: Awa's corner and words, and what the shot shows. */
export function HistoiresOverlay({ t, from, screen }: { t: number; from: number; screen?: HistScreen }) {
  const local = t - from
  const tale = screen === 'conte' ? TALES[from] : undefined
  const cap = [...CAPS].reverse().find(([at]) => at <= t)
  // Not over a story being told (nor just before it starts).
  const capOn = cap && !tale && t - cap[0] < 6 && !PLAN.pieces.some((p) => p.story && t > p.from - 0.35 && t < p.to + 0.45)
  return (
    <>
      {tale && <Conte t={t} from={from} tale={tale} />}
      {!tale && (
        <div className="absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/55 to-transparent px-6 pt-8 pb-12 font-sans">
          <span className="block h-14 w-14 overflow-hidden rounded-full border-[3px] border-[#ff7a00] bg-[#ffd8a8]">
            <AwaFace t={t} size={56} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[26px] leading-none font-extrabold">awa.babi</div>
            <div className="mt-1 text-[18px] font-bold text-white/80">Les histoires du quartier 📖</div>
          </div>
          <span className="flex items-center gap-1.5 rounded-lg bg-[var(--color-orange)] px-3 py-1.5 text-[20px] font-extrabold">
            <Volume2 size={20} strokeWidth={2.8} /> NOUVEAU
          </span>
        </div>
      )}
      {/* The hook: the feature's name, big */}
      {screen === 'hello' && t > 1.8 && (
        <div
          className="absolute inset-x-0 top-[12%] flex flex-col items-center gap-2 px-6 pt-4 pb-8 text-center"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, rgba(15,18,48,${0.8 * fadeIn(t, 1.9, 0.4)}) 30%, transparent 72%)`,
          }}
        >
          <div className="rounded-xl bg-[#ffd36e] px-4 py-1 font-sans text-[22px] font-extrabold tracking-wide text-[#6b4400] uppercase" style={pop(t, 1.9)}>
            Nouveau dans Babi Life
          </div>
          <div className="font-display text-[60px] leading-[0.98] font-extrabold drop-shadow-[0_6px_14px_rgba(0,0,0,0.6)]" style={pop(t, 2.3)}>
            Les histoires
            <br />
            <span className="text-[#ffd36e]">se racontent 🔊</span>
          </div>
        </div>
      )}
      {/* Awa in her corner, when she isn't in the scene herself */}
      {screen === 'awa' && (
        <div className="absolute top-[13%] right-5 h-[150px] w-[118px] overflow-hidden rounded-[24px] border-[4px] border-white/90 bg-[#ffb37a] shadow-[0_16px_40px_-14px_rgba(0,0,0,0.7)]" style={pop(t, from)}>
          <AwaFace t={t} size={150} talking />
        </div>
      )}
      {/* The phone: the story under way, day 1 then day 2; then « Écouter » tapped */}
      {(screen === 'quartier' || screen === 'ecouter') && (
        <div className="absolute inset-x-0 top-[17%] flex justify-center">
          <div
            className="relative"
            style={{
              transform: screen === 'ecouter' ? `scale(${1 + 0.12 * ease(clamp01(local / 0.8))}) translateY(${screen === 'ecouter' && local > 4.6 ? (local - 4.6) * 400 : 0}px)` : undefined,
              opacity: screen === 'ecouter' ? 1 - clamp01((local - 4.9) / 0.5) : 1,
            }}
          >
            <Phone style={screen === 'quartier' ? pop(t, from, 0.5) : undefined}>
              {screen === 'quartier' && local > 4.2 ? (
                <div style={{ opacity: fadeIn(local, 4.2) }}>
                  <div className="mb-2 flex items-center justify-center gap-2 rounded-full bg-[#1b1d2a] py-1.5 text-[15px] font-extrabold text-[#ffd36e]">
                    <Moon size={16} strokeWidth={2.6} /> Le lendemain…
                  </div>
                  <StoryCard t={t} day2 />
                </div>
              ) : (
                <StoryCard t={t} listen={screen === 'ecouter' ? (local > 1.85 ? 'playing' : 'idle') : undefined} />
              )}
            </Phone>
            {screen === 'ecouter' && <Tap t={local} at={1.85} x={92} y={250} />}
          </div>
        </div>
      )}
      {screen === 'choix' && (
        <>
          <div className="absolute inset-x-0 top-[13%] flex justify-start pl-8">
            <div className="font-display text-[86px] leading-none font-extrabold text-[#ffd36e] drop-shadow-[0_6px_14px_rgba(0,0,0,0.6)]" style={pop(t, from)}>
              {Math.min(25, Math.max(1, Math.round(25 * ease(clamp01(local / 1.2)))))}
              <span className="ml-2 text-[40px] text-white">histoires</span>
            </div>
          </div>
          <div className="absolute inset-x-0 top-[27%] flex justify-center">
            <Phone style={pop(t, from + 0.2, 0.5)}>
              <Choice t={t} from={from} />
            </Phone>
            <Tap t={local} at={3.7} x={168} y={232} />
          </div>
        </>
      )}
      {screen === 'voyage' && <Voyage t={t} from={from} />}
      {screen === 'djai' && (
        <div className="absolute inset-x-0 top-[24%] flex flex-col items-center gap-4">
          {Array.from({ length: 14 }, (_, i) => {
            const y = ((local * 380 + i * 97) % 900) - 120
            return (
              <span
                key={i}
                className="absolute text-[46px]"
                style={{
                  left: `${(i * 37) % 92}%`,
                  top: y,
                  transform: `rotate(${local * 200 + i * 40}deg)`,
                  opacity: clamp01(local / 0.4),
                }}
              >
                🪙
              </span>
            )
          })}
          <div className="rounded-[28px] bg-white px-8 py-4 text-center text-[var(--color-ink)] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)]" style={pop(t, from + 0.2)}>
            <div className="font-sans text-[22px] font-extrabold text-[var(--color-ink-soft)]">Chaque chapitre</div>
            <div className="font-display text-[72px] leading-none font-extrabold text-[#e67700]">+{(Math.round((2000 * ease(clamp01((local - 1.6) / 1.0))) / 50) * 50).toLocaleString('fr-FR').replace(/ /g, ' ')}</div>
            <div className="font-display text-[34px] font-extrabold">Djai</div>
          </div>
        </div>
      )}
      {screen === 'laquelle' && (
        <div className="absolute inset-x-0 top-[16%] flex flex-col gap-2.5 px-6">
          {COMMENTS.map(([at, who, text]) =>
            local > at ? (
              <div key={who} className="flex max-w-[86%] items-start gap-2.5 rounded-2xl bg-black/55 px-3.5 py-2.5 font-sans backdrop-blur" style={pop(local, at, 0.35)}>
                <Face name={who} gender={who.includes('fanta') || who.includes('tantie') ? 'femme' : 'homme'} size={36} />
                <div>
                  <div className="text-[15px] font-extrabold text-white/70">{who}</div>
                  <div className="text-[20px] leading-tight font-extrabold">{text}</div>
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}
      {capOn && (
        <div className="absolute inset-x-0 bottom-[7%] flex justify-center px-9">
          <div className="rounded-2xl bg-white px-5 py-2.5 text-center text-[32px] leading-tight font-extrabold text-[var(--color-ink)] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6)]" style={{ opacity: fadeIn(t, cap[0], 0.2) }}>
            {cap[1]}
          </div>
        </div>
      )}
    </>
  )
}
