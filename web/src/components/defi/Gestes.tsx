import { useEffect, useRef, useState } from 'react'
import { Annoyed, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Baby, Bath, BedDouble, CookingPot, Droplets, Frown, Heart, Milk, ShowerHead, Soup, Utensils, Volleyball, type LucideIcon } from 'lucide-react'
import { haptic } from '../../lib/native'
import { gesture, setHomeStep, useHomeArrived } from '../../world3d/gesture'
import { SEATED, type Pose } from '../../avatar/Human'
import type { Look } from '../../lib/types'
import { StepScene, type SceneId } from './Scenes'
import { RECIPES } from './recipes'
import { t, tx } from '../../lib/i18n'

// The home's everyday things played (the update « gestes-maison »): the shower,
// the cooking, the meal, going to bed, playing in the yard, and the baby's day
// (the bottle, the porridge, the bath, the cuddle, caca, pipi…). Each is a few steps
// (« Se savonner les bras », « Retourner le poisson »…), each step a combination
// of arrows to chain (no clock: take the time it takes). Every arrow right, the Sim makes
// the step's gesture in the house behind (world3d/gesture.ts); a wrong one and
// the combination starts again. When the last step is done, so is the action:
// the server counts all of it at once (backend sims/defi.go homeDone).

export type GesteKind = 'douche' | 'cuisine' | 'repas' | 'dodo' | 'cour' | 'biberon' | 'bouillie' | 'bain' | 'calin' | 'caca' | 'pipi' | 'vomir' | 'pleurer'
type Dir = 'up' | 'down' | 'left' | 'right'
type Step = { label: string; combo: Dir[]; pose: Pose; /** What it is, seen being done (Scenes.tsx: the lab page; in the game, the house itself). */ scene?: SceneId; /** Where in the house it's done (a spot of world3d/homeSpots.ts), standing by it or as the spot has it. */ at?: string; standing?: boolean }

const U: Dir = 'up'
const D: Dir = 'down'
const L: Dir = 'left'
const R: Dir = 'right'

const STEPS: Record<GesteKind, Step[]> = {
  douche: [
    { label: t('Ouvrir l’eau'), combo: [U, U, R], pose: 'busy', scene: 'eau', at: 'shower' },
    { label: t('Se savonner les bras'), combo: [L, R, L, R], pose: 'wash', scene: 'savon', at: 'shower' },
    { label: t('Frotter le dos'), combo: [D, U, D, U], pose: 'wash', scene: 'dos', at: 'shower' },
    { label: t('Le shampooing'), combo: [U, L, U, R], pose: 'wash', scene: 'shampooing', at: 'shower' },
    { label: t('Rincer'), combo: [D, D, D], pose: 'wash', scene: 'rincer', at: 'shower' },
    { label: t('Se sécher'), combo: [R, L, R, L, U], pose: 'busy', scene: 'secher', at: 'shower' },
  ],
  cuisine: [
    { label: t('Écailler le poisson'), combo: [L, L, R, R], pose: 'cook', at: 'cook-attieke' },
    { label: t('Piment, oignon, cube'), combo: [U, R, D], pose: 'cook', at: 'cook-attieke' },
    { label: t('Allumer le feu'), combo: [D, U, D], pose: 'busy', at: 'cook-attieke' },
    { label: t('Retourner le poisson'), combo: [U, U, D], pose: 'cook', at: 'cook-attieke' },
    { label: t('Égrener l’attiéké'), combo: [L, R, L, R, D], pose: 'cook', at: 'cook-attieke' },
    { label: t('Servir l’assiette'), combo: [R, U], pose: 'hero', at: 'cook-attieke' },
  ],
  repas: [
    { label: t('Se laver les mains'), combo: [L, R, L], pose: 'wash' },
    { label: t('Première bouchée'), combo: [U, D], pose: 'snack' },
    { label: t('Bien mâcher'), combo: [U, D, U, D], pose: 'snack' },
    { label: t('Boire un coup'), combo: [U, R], pose: 'drink' },
    { label: t('Finir l’assiette'), combo: [D, U, D, U, D], pose: 'snack' },
  ],
  // Then the dream (Reve.tsx): the night is played there.
  dodo: [
    { label: t('Faire le lit'), combo: [L, R, L], pose: 'busy', scene: 'lit', at: 'sleep', standing: true },
    { label: t('Se brosser les dents'), combo: [U, D, U, D], pose: 'brush', scene: 'dents', at: 'dents' },
    { label: t('Éteindre la lumière'), combo: [U, R], pose: 'busy', scene: 'lumiere', at: 'sleep', standing: true },
    { label: t('Se coucher'), combo: [D, D], pose: 'sleep', scene: 'coucher', at: 'sleep' },
  ],
  cour: [
    { label: t('Jongler avec le ballon'), combo: [U, U, U], pose: 'kick', at: 'jouer-cour' },
    { label: t('Dribbler le copain'), combo: [L, R, L], pose: 'dribble', at: 'jouer-cour' },
    { label: t('Tirer au but !'), combo: [D, U, R], pose: 'shoot', at: 'jouer-cour' },
    { label: t('Saute-mouton'), combo: [U, D, U, D], pose: 'leap', at: 'jouer-cour' },
    { label: t('La marelle'), combo: [R, U, R, U, R], pose: 'leap', at: 'jouer-cour' },
    { label: t('La danse de la victoire'), combo: [L, R, U, D], pose: 'dance', at: 'jouer-cour' },
  ],
  // The baby's day, with papa and maman.
  biberon: [
    { label: t('Attraper le biberon'), combo: [U, U], pose: 'drink' },
    { label: t('Téter, téter'), combo: [D, U, D, U], pose: 'drink' },
    { label: t('Le petit rot'), combo: [R, L], pose: 'busy' },
  ],
  bouillie: [
    { label: t('Ouvrir grand la bouche'), combo: [U, D], pose: 'snack' },
    { label: t('Avaler'), combo: [D, D, U], pose: 'snack' },
    { label: t('Encore une cuillère'), combo: [U, D, U, D], pose: 'snack' },
    { label: t('Maman essuie la bouche'), combo: [L, R], pose: 'busy' },
  ],
  bain: [
    { label: t('Splash !'), combo: [L, R, L, R], pose: 'wash' },
    { label: t('Le savon qui glisse'), combo: [U, D, U], pose: 'wash' },
    { label: t('Les petits canards'), combo: [R, R, L], pose: 'cheer' },
    { label: t('Dans la serviette'), combo: [U, U], pose: 'busy' },
  ],
  calin: [
    { label: t('Tendre les bras'), combo: [U, U], pose: 'hug' },
    { label: t('Un gros câlin'), combo: [L, R, L, R], pose: 'hug' },
    { label: t('Un bisou'), combo: [U, D], pose: 'hug' },
  ],
  caca: [
    { label: t('Pousser…'), combo: [D, D, D], pose: 'toilet' },
    { label: t('Pousser encore !'), combo: [D, U, D, D], pose: 'toilet' },
    { label: t('Appeler maman'), combo: [U, U], pose: 'wave' },
    { label: t('La couche propre'), combo: [L, R, L], pose: 'busy' },
  ],
  pipi: [
    { label: t('Ça presse !'), combo: [D, D], pose: 'toilet' },
    { label: t('Pipi !'), combo: [D, U, D], pose: 'toilet' },
    { label: t('Appeler papa'), combo: [U, U], pose: 'wave' },
  ],
  vomir: [
    { label: t('Le ventre gargouille'), combo: [L, R, L], pose: 'busy' },
    { label: t('Bleuh !'), combo: [D, D], pose: 'rant' },
    { label: t('Maman nettoie'), combo: [R, L, R], pose: 'busy' },
    { label: t('Un câlin pour consoler'), combo: [U, U], pose: 'hug' },
  ],
  pleurer: [
    { label: t('Snif, snif'), combo: [U, D], pose: 'rant' },
    { label: t('Ouiiin !'), combo: [U, U, U], pose: 'rant' },
    { label: t('Maman arrive'), combo: [R, L], pose: 'hug' },
    { label: t('Se calmer dans ses bras'), combo: [D, D, D], pose: 'hug' },
  ],
}

// Every other action (the update « gestes-maison » plays them all, backend sims/defi.go gesteOK): its
// steps made from what it is, read from its icon (eating, drinking, dancing, praying, a sport…), each
// combination drawn from its name, so the same action is always played the same way.
type Kind = 'manger' | 'boire' | 'fete' | 'sport' | 'prier' | 'voir' | 'achat' | 'causer' | 'soin' | 'repos' | 'faire'
const BY_ICON: Record<Kind, string[]> = {
  manger: ['utensils', 'fish', 'drumstick', 'hamburger', 'sandwich', 'ice-cream-cone', 'cake', 'soup', 'apple', 'banana', 'citrus', 'cherry', 'popcorn', 'flame', 'chef-hat'],
  boire: ['cup-soda', 'beer', 'coffee', 'milk', 'martini', 'glass-water', 'droplet'],
  fete: ['music', 'party-popper', 'disc-3', 'drum', 'piano', 'drama', 'crown'],
  sport: ['volleyball', 'trophy', 'dumbbell', 'footprints', 'bike', 'mountain', 'waves', 'sailboat', 'swords'],
  prier: ['church', 'moon', 'hand-heart', 'heart-handshake'],
  voir: ['tv', 'clapperboard', 'camera', 'eye', 'landmark', 'castle', 'bird', 'paw-print', 'sunset', 'tree-palm', 'palette', 'library', 'book-open', 'newspaper', 'flower-2'],
  achat: ['shopping-bag', 'shopping-basket', 'shopping-cart', 'store', 'shirt', 'scissors', 'gem', 'sparkles', 'brush-cleaning'],
  causer: ['users', 'messages-square', 'megaphone', 'phone', 'smartphone', 'handshake', 'heart', 'gift', 'mail'],
  soin: ['stethoscope', 'pill', 'syringe', 'heart-pulse', 'hospital'],
  repos: ['sofa', 'bed', 'bed-single', 'armchair', 'umbrella'],
  faire: [],
}
const PLAN: Record<Kind, [string, Pose][]> = {
  manger: [[t('Se servir'), 'busy'], [t('Première bouchée'), 'snack'], [t('Savourer'), 'snack'], [t('Finir le plat'), 'snack']],
  boire: [[t('Prendre le verre'), 'drink'], [t('Trinquer !'), 'cheer'], [t('Une bonne gorgée'), 'drink'], [t('Le dernier fond'), 'drink']],
  fete: [[t('Entrer dans le rythme'), 'dance'], [t('Le pas de danse'), 'dance'], [t('Faire le show'), 'cheer'], [t('Le final'), 'hero']],
  sport: [['S’échauffer', 'busy'], ['Accélérer', 'run'], ['Le geste parfait', 'leap'], ['Souffler un coup', 'hero']],
  prier: [[t('Se recueillir'), 'pray'], [t('Prier'), 'pray'], [t('Chanter'), 'cheer'], [t('Amen'), 'pray']],
  voir: [[t('Regarder bien'), 'film'], [t('Prendre une photo'), 'film'], [t('S’émerveiller'), 'cheer'], [t('Montrer aux autres'), 'wave']],
  achat: [[t('Choisir'), 'busy'], [t('Essayer'), 'hero'], [t('Négocier le prix'), 'talk'], [t('Payer'), 'busy']],
  causer: [[t('Saluer'), 'wave'], [t('Causer'), 'talk'], [t('Rire ensemble'), 'cheer'], [t('Se dire au revoir'), 'wave']],
  soin: [[t('Expliquer ce qui ne va pas'), 'talk'], [t('Se laisser soigner'), 'busy'], [t('Respirer fort'), 'idle'], [t('Dire merci'), 'wave']],
  repos: [[t('S’installer'), 'sit'], [t('Se détendre'), 'sit'], [t('Souffler'), 'sit'], [t('Se relever en forme'), 'hero']],
  faire: [[t('S’y mettre'), 'busy'], [t('Bien s’appliquer'), 'busy'], [t('Accélérer la cadence'), 'busy'], [t('Finir proprement'), 'hero']],
}
const kindOfIcon = (icon: string): Kind => (Object.keys(BY_ICON) as Kind[]).find((k) => BY_ICON[k].includes(icon)) ?? 'faire'

/** An action's steps when it has none of its own: its kind's, each combination drawn from its name. */
export function stepsFor(act: { id: string; icon: string }): Step[] {
  let h = 2166136261
  for (const ch of act.id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  const r = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296
  const dirs = [U, D, L, R]
  // Its own steps when written (recipes/), else its kind's.
  return (RECIPES[act.id] ?? PLAN[kindOfIcon(act.icon)]).map(([label, pose], k) => ({ label, pose, combo: Array.from({ length: 3 + Math.min(2, Math.floor(r() * 2) + (k > 1 ? 1 : 0)) }, () => dirs[Math.floor(r() * 4)]) }))
}

/** Whether an activity with no défi of its own is played: the server's rule (sims/defi.go gesteOK): every one, the work too, but a talk. */
const GESTE_NOT = ['machine-maquis', 'machine-casino', 'passer-nuit', 'petit-travaillement', 'travaillement', 'grand-travaillement', 'aller-ecole', 'creche', 'play-basket', 'street-basket', 'play-football', 'play-foot11', 'street-foot', 'boutique-mode', 'boutique-wax', 'course-kart', 'jouets', 'premier-mot', 'buy-food']
/** The street happenings joined that are a match of their own. */
const GESTE_NOT_LABELS = [t('Jouer avec eux'), t('Jouer un match')]
export const gesteOK = (a: { kind: string; career?: string; placeKind?: string; seance?: unknown; interaction: { id: string; label?: string; cost: number; minutes: number } }) =>
  a.kind === 'do' && a.placeKind !== 'chat' && !GESTE_NOT.includes(a.interaction.id) && !(a.interaction.id === 'join' && GESTE_NOT_LABELS.includes(a.interaction.label ?? '')) && !a.seance

/** Each one's title, icon and colours, and the button that starts it. */
export const GESTES: Record<GesteKind, { title: string; button: string; icon: LucideIcon; colors: [string, string] }> = {
  douche: { title: t('La douche'), button: t('Prendre ta douche'), icon: ShowerHead, colors: ['#4dabf7', '#1c7ed6'] },
  cuisine: { title: t('L’attiéké-poisson'), button: t('Cuisiner'), icon: CookingPot, colors: ['#ff9a3c', '#e8590c'] },
  repas: { title: t('Le repas'), button: t('Manger'), icon: Utensils, colors: ['#ffa94d', '#f76707'] },
  dodo: { title: t('Au lit !'), button: t('Aller au lit'), icon: BedDouble, colors: ['#7048e8', '#3b1d6e'] },
  cour: { title: t('La cour'), button: t('Jouer dans la cour'), icon: Volleyball, colors: ['#69db7c', '#2f9e44'] },
  biberon: { title: t('Le biberon'), button: t('Boire le biberon'), icon: Milk, colors: ['#ffd8a8', '#f59f00'] },
  bouillie: { title: t('La bouillie'), button: t('Manger la bouillie'), icon: Soup, colors: ['#ffc078', '#e8590c'] },
  bain: { title: t('Le bain'), button: t('Prendre le bain'), icon: Bath, colors: ['#74c0fc', '#1c7ed6'] },
  calin: { title: t('Le câlin'), button: t('Faire un câlin'), icon: Heart, colors: ['#ff8fb1', '#e64980'] },
  caca: { title: t('Caca !'), button: t('Faire caca'), icon: Baby, colors: ['#d9a066', '#8a5a2b'] },
  pipi: { title: t('Pipi !'), button: t('Faire pipi'), icon: Droplets, colors: ['#ffe066', '#f08c00'] },
  vomir: { title: t('Bleuh…'), button: t('Vomir'), icon: Frown, colors: ['#a9e34b', '#5c940d'] },
  pleurer: { title: t('Ouiiin !'), button: t('Pleurer'), icon: Annoyed, colors: ['#91a7ff', '#4263eb'] },
}

/** The gestures of an activity (backend sims/defi.go defiFor says the same), or null. */
export const gesteOf = (interactionId?: string): GesteKind | null =>
  interactionId?.startsWith('frigo-')
    ? 'repas'
    : (({ shower: 'douche', 'cook-attieke': 'cuisine', sleep: 'dodo', nap: 'dodo', 'chambre-dormir': 'dodo', 'logement-dormir': 'dodo', 'nuit-hotel': 'dodo', 'jouer-cour': 'cour', biberon: 'biberon', bouillie: 'bouillie', 'bain-bebe': 'bain', calin: 'calin', caca: 'caca', pipi: 'pipi', vomir: 'vomir', pleurer: 'pleurer' } as Record<string, GesteKind>)[interactionId ?? ''] ?? null)

const ICON: Record<Dir, LucideIcon> = { up: ArrowUp, down: ArrowDown, left: ArrowLeft, right: ArrowRight }
const KEYS: Record<string, Dir> = { ArrowUp: U, ArrowDown: D, ArrowLeft: L, ArrowRight: R, w: U, s: D, a: L, d: R, z: U, q: L }

export function GestesDefi({ kind, act, look, gender, scenes, prep, onEnd }: { /** Only the first steps: getting it ready, the action itself then played as its game (Action.tsx). */ prep?: number; kind: GesteKind | 'geste'; /** The perso itself, seen in the scenes of its steps. */ look?: Look; gender?: 'femme' | 'homme'; /** Its steps seen in little scenes of their own (the lab page, away from the house); in the game, the house shows them. */ scenes?: boolean; /** Any other action: its steps made from it (stepsFor). */ act?: { id: string; icon: string }; onEnd: (score: number) => void }) {
  const [steps] = useState(() => (kind === 'geste' ? stepsFor(act ?? { id: '', icon: '' }) : STEPS[kind]).slice(0, prep ?? 99))
  const [k, setK] = useState(0)
  const [got, setGot] = useState(0)
  const [miss, setMiss] = useState(false)
  const [flash, setFlash] = useState(false)
  const st = useRef({ mistakes: 0, scores: [] as number[], done: false })
  // The Sim gets ready: the first step's gesture.
  useEffect(() => gesture(steps[0].pose, 1500), [steps])
  // At home, each step done where it's done (world3d/HomeInside.tsx walks the Sim there); over, as before.
  useEffect(() => {
    const st = steps[k]
    setHomeStep(st?.at ? { at: st.at, pose: st.pose, standing: st.standing } : null)
  }, [k, steps])
  useEffect(() => () => setHomeStep(null), [])

  const next = (score: number) => {
    const s = st.current
    s.scores.push(score)
    s.mistakes = 0
    setFlash(true)
    setTimeout(() => setFlash(false), 500)
    if (k + 1 >= steps.length) {
      s.done = true
      const total = Math.round(s.scores.reduce((a, b) => a + b, 0) / steps.length)
      setTimeout(() => onEnd(total), 700)
      return
    }
    setK(k + 1)
    setGot(0)
    gesture(steps[k + 1].pose, 1500)
  }

  // In the house, the step waits until the Sim has walked to where it's done.
  const arrived = useHomeArrived()
  const going = !!steps[k]?.at && arrived === false
  const press = (dir: Dir) => {
    const s = st.current
    if (s.done || going) return
    const step = steps[k]
    if (step.combo[got] !== dir) {
      // Wrong: the combination starts again.
      s.mistakes++
      haptic('error')
      setMiss(true)
      setTimeout(() => setMiss(false), 280)
      setGot(0)
      return
    }
    haptic('light')
    // (A seated pose isn't made standing in the air: the place's own animation goes on.)
    if (!SEATED.includes(step.pose)) gesture(step.pose, 1800)
    if (got + 1 < step.combo.length) return setGot(got + 1)
    // The whole combination: the mistakes make its score (no clock).
    next(Math.max(20, 100 - s.mistakes * 20))
  }

  // On a computer: the arrow keys (or ZQSD / WASD).
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const dir = KEYS[e.key]
      if (dir) {
        e.preventDefault()
        press(dir)
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  const step = steps[k]
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {/* What's being done, seen as the arrows go: the bed made, the brush scrubbing, the light going out */}
      {scenes && step.scene && (
        <div className="card pointer-events-auto mx-auto mb-2 w-full max-w-[560px] overflow-hidden p-1.5">
          <div className="h-[min(26vh,190px)] overflow-hidden rounded-xl">
            <StepScene id={step.scene} k={got / step.combo.length} look={look} gender={gender} />
          </div>
        </div>
      )}
      <div className="pointer-events-auto mx-auto flex w-full max-w-[560px] items-end gap-3 short:max-w-[720px]">
        {/* The step, its combination */}
        <div className={`card min-w-0 flex-1 p-3 ${miss ? 'motion-shake' : ''}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="label">
              {tx('Étape {0}/{length}', { 0: k + 1, length: steps.length })}
            </span>
            <span className="flex gap-1">
              {steps.map((_, i) => (
                <span key={i} className={`h-2 w-2 rounded-full ${i < k ? 'bg-[var(--color-emerald)]' : i === k ? 'bg-[var(--color-orange)]' : 'bg-black/10'}`} />
              ))}
            </span>
          </div>
          <div className="mt-1 font-display text-[19px] leading-tight font-extrabold short:text-[17px]">{step.label}</div>
          {going && <div className="text-[12.5px] font-extrabold text-[var(--color-ink-soft)]">{t('Ton perso y va…')}</div>}
          <div className={`mt-2 flex flex-wrap gap-1.5 ${going ? 'opacity-40' : ''}`}>
            {step.combo.map((d, i) => {
              const Icon = ICON[d]
              return (
                <span key={i} className={`grid h-10 w-10 place-items-center rounded-xl transition ${i < got ? 'bg-[var(--color-emerald)] text-white' : i === got ? 'bg-[var(--color-orange)] text-white motion-pop' : 'bg-[var(--color-canvas)] text-[var(--color-ink-soft)]'}`}>
                  <Icon size={22} strokeWidth={3} />
                </span>
              )
            })}
          </div>
          {flash && <div className="mt-1.5 text-[13px] font-extrabold text-[var(--color-emerald-deep)]">{t('Bien joué !')}</div>}
        </div>
        {/* The four arrows, under the thumb */}
        <div className="grid shrink-0 grid-cols-3 grid-rows-3 gap-1">
          {(
            [
              [U, 'col-start-2 row-start-1'],
              [L, 'col-start-1 row-start-2'],
              [R, 'col-start-3 row-start-2'],
              [D, 'col-start-2 row-start-3'],
            ] as const
          ).map(([d, at]) => {
            const Icon = ICON[d]
            return (
              <button key={d} className={`${at} grid h-14 w-14 place-items-center rounded-2xl bg-white text-[var(--color-ink)] shadow-[0_4px_0_rgba(15,18,48,0.25)] active:translate-y-[3px] active:shadow-none short:h-12 short:w-12`} onPointerDown={(e) => (e.preventDefault(), press(d))} aria-label={{ up: t('Haut'), down: t('Bas'), left: t('Gauche'), right: t('Droite') }[d]}>
                <Icon size={26} strokeWidth={3} />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
