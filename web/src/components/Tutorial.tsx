import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Check, ChevronRight, X } from 'lucide-react'
import { Portrait } from '../avatar/portrait'
import { randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'
import { whereabouts } from '../world3d/whereabouts'
import { haptic } from '../lib/native'

// Le tuto: the first time in the game, Koffi, a big brother of the quarter,
// shows the beginner round, a step at a time: the needs, walking, « Où aller ? »,
// going into a place, the activities and their défis, the phone, the map, the
// people. Each step points at what it's about (a ring round it on the screen);
// some are done by doing them (a few steps walked, « Où aller ? » opened…),
// the others with « Suivant ». It can be skipped, and seen again from the
// Encyclo (openTutorial). It takes over from the first two tips (FirstSteps).

const KEY = 'babi.tuto'
const FIRST = 'babi.firstSteps'
const read = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const write = (k: string) => {
  try {
    localStorage.setItem(k, 'done')
  } catch {
    /* private window */
  }
}
/** A beginner: never seen the tuto (nor the first tips, for players from before it). */
export const beginner = () => read(KEY) !== 'done' && read(FIRST) !== 'done'

let asked = false
const listeners = new Set<() => void>()
/** From the Encyclo: the tuto again. */
export const openTutorial = () => ((asked = true), listeners.forEach((f) => f()))
const closeTutorial = () => ((asked = false), listeners.forEach((f) => f()))
export const useTutorialAsked = () => useSyncExternalStore((f) => (listeners.add(f), () => void listeners.delete(f)), () => asked)

/** What the game is showing, for the steps done by doing them. */
export type TutoState = { whereTo: boolean; placeId: string | null; overlay: string | null; /** A place's « Que faire ? » open. */ menu?: boolean }

type Step = { id: string; title: string; text: (desk: boolean) => string; /** What it points at (data-tour). */ target?: string; /** What to do, for it to move on. */ task?: string; done?: (s: TutoState & { moved: number }) => boolean }

// Two chapters: growing up at the family's home (from birth), then adult life (at 18, or straight
// away for a Sim made grown up). Each one once; the Encyclo shows the one of the Sim's age again.
const CHILDHOOD: Step[] = [
  { id: 'bienvenue', title: 'Akwaba à Babi !', text: () => "Moi c'est Koffi, du quartier. Ici c'est Abidjan, et c'est ta vie depuis le berceau. Le temps passe quand tu joues : appli fermée, ton perso t'attend." },
  { id: 'besoins', title: 'Tes besoins', target: 'besoins', text: () => "Ces cinq ronds : manger, l'énergie, la propreté, les amis et le moral. Ils baissent avec le temps. Quand un rond passe au rouge, occupe-toi de lui !" },
  { id: 'maison', title: 'La maison de tes parents', target: 'que-faire', text: () => "Tu vis chez papa et maman. Les icônes au-dessus des meubles, c'est ce qu'on fait ici : le biberon, la bouillie, le bain avec maman, dormir… Plus tard les devoirs et l'école.", task: 'Entre chez toi et touche « Que faire ? ».', done: (s) => !!s.menu },
  { id: 'parents', title: 'Papa et maman', text: () => "Ils sont là toute la journée : maman à la cuisine aux repas, papa au salon le soir. Touche-les pour leur parler : un câlin, ta journée, un conseil… et même l'argent de poche !" },
  { id: 'grandir', title: 'Tu grandis pour de vrai', text: () => "Tu grandis en jouant : bébé pendant 24 h de jeu, puis enfant et ado pendant 24 h de jeu (l'école en semaine le matin). Appli fermée, ton âge t'attend. Un bébé a vite faim, sommeil et besoin d'un câlin : occupe-toi de lui ! À 18 ans tu quittes la maison avec l'argent de départ de ta famille : le boulot, ton logement, ta vie." },
  { id: 'fin', title: "C'est toi le boss !", text: () => "Le reste tu le découvres en vivant. Je reviens te voir à tes 18 ans pour la suite. Pour revoir ce tuto : l'Encyclo, dans ton téléphone." },
]
const ADULTHOOD: Step[] = [
  { id: 'bienvenue', title: 'Te voilà grand·e !', text: () => "C'est encore Koffi. Maintenant c'est ta vie d'adulte à Abidjan : tu travailles, tu sors, tu te fais des amis, à ton rythme. Le temps passe quand tu joues : appli fermée, ton perso t'attend." },
  { id: 'besoins', title: 'Tes besoins', target: 'besoins', text: () => "Ces cinq ronds : manger, l'énergie, la propreté, les amis et le moral. Ils baissent avec le temps. Quand un rond passe au rouge, occupe-toi de lui !" },
  {
    id: 'marcher',
    title: 'Marcher',
    target: 'vue',
    text: (desk) => (desk ? 'Marche avec les flèches (ou ZQSD), Maj pour courir. Ou clique sur le sol : ton perso y va. Glisse avec la souris pour tourner la vue.' : 'Touche le sol : ton perso y va. Ce bouton change la vue ; en vue épaule, un rond apparaît pour marcher. Glisse l\'écran pour tourner la vue.'),
    task: 'Fais quelques pas.',
    done: (s) => s.moved > 4,
  },
  { id: 'ou-aller', title: 'Où aller ?', target: 'ou-aller', text: () => "Tous les lieux du quartier sont là : le maquis, le marché, l'église ou la mosquée, ton futur boulot…", task: 'Touche « Où aller ? ».', done: (s) => s.whereTo },
  { id: 'lieu', title: 'Un lieu', text: () => "Choisis un lieu : ton perso y marche (si c'est loin, une moto-taxi te propose de t'emmener). Arrivé, touche son panneau : tu vois tout ce qu'on peut y faire.", task: 'Ouvre un lieu.', done: (s) => !!s.placeId },
  { id: 'activite', title: 'Les activités', text: () => "Chaque activité prend du temps et remplit tes besoins, ou te paie au boulot. Pendant certaines, un bouton doré « Défi » te propose un petit jeu : faire le thé, le slalom en ski nautique, la liste de courses…" },
  { id: 'phone', title: 'Ton téléphone', target: 'phone', text: () => 'Boulot pour trouver un travail, Logement pour ta maison, et le Store pour les applis : taxis, livraison, Bolide pour ton vélo, ta moto ou ta voiture, les jeux…', task: 'Ouvre ton téléphone.', done: (s) => s.overlay === 'phone' },
  { id: 'carte', title: 'La carte', target: 'carte', text: () => "La carte d'Abidjan et du pays : touche une autre commune pour y aller, en woro-woro, en taxi ou avec ton propre véhicule. Le chauffeur vient te chercher.", task: 'Ouvre la carte.', done: (s) => s.overlay === 'map' },
  { id: 'gens', title: 'Les gens', text: () => "Touche quelqu'un dans la rue pour lui parler. Au grin, on joue aux dames et au 8 américain ; tes amis du jeu t'écrivent sur Gbairai." },
  { id: 'fin', title: "C'est toi le boss !", text: () => "Tu sais l'essentiel, le reste tu le découvres en vivant. Pour revoir ce tuto : l'Encyclo, dans ton téléphone. On se voit au grin !" },
]
/** The chapter for the Sim's age. */
export type Chapter = 'enfance' | 'adulte'
const CHAPTERS: Record<Chapter, Step[]> = { enfance: CHILDHOOD, adulte: ADULTHOOD }
/** The adult chapter, seen (the childhood one is KEY, the first tuto). */
const ADULT_KEY = 'babi.tuto.adulte'
/** Grown up, the adult chapter not seen yet (after a childhood played here). */
export const adultChapterDue = () => read(KEY) === 'done' && read(ADULT_KEY) !== 'done'

export const KOFFI = { ...randomLook('homme', rng('koffi-guide')), outfit: 'jersey', outfitColor: '#ff7a00', accessory: 'cap' }
const mouse = () => typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches

export function Tutorial({ state, onEnd, chapter = 'adulte' }: { state: TutoState; onEnd: () => void; /** Growing up at home, or an adult's life. */ chapter?: Chapter }) {
  const STEPS = CHAPTERS[chapter]
  const [k, setK] = useState(0)
  const [bravo, setBravo] = useState(false)
  const desk = useMemo(mouse, [])
  const step = STEPS[k]
  // How far the Sim walked since the step began.
  const from = useRef<[number, number]>([...whereabouts.sim])
  const [moved, setMoved] = useState(0)
  useEffect(() => {
    from.current = [...whereabouts.sim]
    setMoved(0)
    if (!step.done) return
    const t = setInterval(() => setMoved(Math.hypot(whereabouts.sim[0] - from.current[0], whereabouts.sim[1] - from.current[1])), 300)
    return () => clearInterval(t)
  }, [k]) // eslint-disable-line react-hooks/exhaustive-deps
  // Where the thing it's about is on the screen.
  const [ring, setRing] = useState<DOMRect | null>(null)
  useEffect(() => {
    const find = () => setRing(step.target ? (document.querySelector(`[data-tour="${step.target}"]`)?.getBoundingClientRect() ?? null) : null)
    find()
    const t = setInterval(find, 400)
    return () => clearInterval(t)
  }, [step.target])
  const end = () => {
    write(KEY)
    write(FIRST)
    if (chapter === 'adulte') write(ADULT_KEY)
    closeTutorial()
    onEnd()
  }
  const next = () => (k + 1 < STEPS.length ? setK(k + 1) : end())
  // Done by doing it: « Bravo », and on.
  const did = !!step.done?.({ ...state, moved })
  useEffect(() => {
    if (!did || bravo) return
    haptic('success')
    setBravo(true)
    const t = setTimeout(() => (setBravo(false), next()), 1100)
    return () => clearTimeout(t)
  }, [did]) // eslint-disable-line react-hooks/exhaustive-deps
  // The card away from what it points at: up top when that's low on the screen.
  const top = !!ring && ring.top + ring.height / 2 > window.innerHeight / 2
  return (
    <>
      {ring && (
        <span className="pointer-events-none fixed z-[70] rounded-[24px] border-4 border-[#ffc233]" style={{ left: ring.left - 6, top: ring.top - 6, width: ring.width + 12, height: ring.height + 12, boxShadow: '0 0 0 9999px rgba(15,18,48,0.28)', animation: 'tuto-ring 1.4s ease-in-out infinite' }} />
      )}
      <div className={`pointer-events-auto fixed left-1/2 z-[71] w-[min(400px,calc(100vw-20px))] -translate-x-1/2 ${top ? 'top-[max(0.75rem,env(safe-area-inset-top))]' : 'bottom-[calc(6.25rem+env(safe-area-inset-bottom))]'}`}>
        <div key={step.id} className="card animate-pop p-3">
          <div className="flex items-start gap-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-[#ffd36e] to-[#ff8a3d] ring-2 ring-white">
              <Portrait look={KOFFI} gender="homme" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="label">Koffi · {k + 1}/{STEPS.length}</span>
                <button className="ml-auto grid h-7 w-7 place-items-center rounded-full bg-[var(--color-canvas)]" onClick={end} aria-label="Passer le tuto" title="Passer le tuto">
                  <X size={15} />
                </button>
              </div>
              <div className="font-display text-[17px] leading-tight font-extrabold">{step.title}</div>
              <p className="mt-1 text-[13.5px] leading-snug font-bold text-[var(--color-ink)]">{step.text(desk)}</p>
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex flex-1 gap-1">
              {STEPS.map((s, i) => (
                <span key={s.id} className={`h-1.5 flex-1 rounded-full ${i < k ? 'bg-[var(--color-emerald)]' : i === k ? 'bg-[var(--color-orange)]' : 'bg-[var(--color-canvas)]'}`} />
              ))}
            </div>
          </div>
          {step.task ? (
            <div className={`mt-2.5 flex items-center gap-2 rounded-2xl px-3 py-2 text-[13.5px] font-extrabold ${bravo ? 'bg-[#d3f9d8] text-[#2b8a3e]' : 'bg-[#fff3c4] text-[#8a5a00]'}`}>
              {bravo ? <Check size={17} strokeWidth={3} /> : <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[#ff7a00]" />}
              <span className="flex-1">{bravo ? 'Bravo !' : `À toi : ${step.task}`}</span>
              {!bravo && (
                <button className="text-[12px] font-extrabold text-[var(--color-ink-soft)] underline" onClick={next}>
                  Plus tard
                </button>
              )}
            </div>
          ) : (
            <button className="btn mt-2.5 w-full !py-2.5 !text-sm" onClick={next}>
              {k + 1 < STEPS.length ? (
                <>
                  Suivant <ChevronRight size={16} />
                </>
              ) : (
                "C'est parti !"
              )}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
