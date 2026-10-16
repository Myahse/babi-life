import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Check, ChevronsDown, MapPin } from 'lucide-react'
import { AppLogo } from './AppLogo'

// « Une journée dans ta rue », on the wish list: the street is pinned to the
// screen and scrolling walks down it through the day, from the morning café to
// the thé at night. The people are the game's own (world3d/open), living as
// they do in the game: the sellers call out, the customers eat and chat, the
// pupils walk, the boys play and step aside for the car.

const StreetScene = lazy(() => import('./StreetScene'))

export type Chapter = { id: 'cafe' | 'ecole' | 'gbaka' | 'sotra' | 'woro' | 'pasteur' | 'garba' | 'alloco' | 'foot' | 'gnango' | 'porc' | 'the' | 'couloir'; time: string; title: string; text: string; /** Awa shows her phone: paying with Waye, ordering a Gnango. */ phone?: 'waye' | 'gnango' }

/** The guide who walks you down the street, a Sim of the game. */
export const GUIDE = { name: 'Awa', gender: 'femme' as const, seed: 'guide-awa-3' }

/** What the guide shows and says at each stop, from the morning to the night. */
export const CHAPTERS: Chapter[] = [
  { id: 'cafe', time: '6 h', title: 'Le café au pousse-pousse', text: "On commence tôt ! Le café du matin, 150 F : on le boit debout, on cause un peu, et chacun part au boulot." },
  { id: 'ecole', time: '7 h', title: 'Les élèves en route', text: "Regarde les petits : tenue kaki et bleue, sac au dos. Ils vont à l'école à pied, en groupe." },
  { id: 'gbaka', time: '7 h 30', title: 'Le gbaka', text: "Le gbaka arrive, l'apprenti crie « Adjamé ! Adjamé ! ». Tu montes, tu te serres, tu paies l'apprenti en route." },
  { id: 'sotra', time: '8 h', title: "L'arrêt SITRA", text: "Ici on attend le bus : le 11, le 19, le 44. Quand il arrive, ça monte, ça descend. Toi aussi tu pourras le prendre." },
  { id: 'woro', time: '9 h', title: 'Le woro-woro', text: "Le woro-woro, c'est le taxi de la commune : tu lèves la main, il s'arrête, tu dis où tu vas. S'il va par là, tu montes." },
  { id: 'pasteur', time: '10 h', title: 'Le pasteur au bord de la route', text: "Lui, c'est le pasteur du coin : Bible en main, petit ampli. Ceux qui passent s'arrêtent un peu : « Amen ! »" },
  { id: 'garba', time: '12 h', title: 'Le garbadrome', text: "Le garba, c'est sacré ! Tout le monde se presse devant : « Donne-moi une grosse queue là-bas ! », « Donne-moi milieu là ! ». Dans l'huile bien chaud, ou dans la boîte : c'est toi qui choisis." },
  { id: 'alloco', time: '13 h', title: "L'alloco de la tantie", text: "Midi, on a faim ! L'alloco de la tantie, 300 F. Moi je paie avec Waye sur mon téléphone : c'est rapide, pas besoin de monnaie.", phone: 'waye' },
  { id: 'foot', time: '16 h', title: 'Le maracana du quartier', text: "Les gars jouent dans la rue, deux cailloux pour les buts. Une voiture arrive ? On se range… et ça reprend !" },
  { id: 'gnango', time: '18 h', title: 'Un Gnango pour rentrer', text: "Fatiguée de marcher ? Je commande un Gnango sur mon téléphone : le prix est fixé avant, et le chauffeur vient jusqu'à moi.", phone: 'gnango' },
  { id: 'porc', time: '19 h', title: 'Le porc au four', text: "Le soir, les tanties du four sont là, côte à côte. Ça fume, on découpe, on s'assoit et on mange. Tu viens ?" },
  { id: 'the', time: '21 h', title: 'Le thé bien mousseux', text: "On finit au thé, 100 F. On s'assoit autour du pousse-pousse et on cause jusqu'à tard." },
  { id: 'couloir', time: '22 h', title: 'Les couloirs, la nuit', text: "Attention dans les couloirs : les nouchis attendent ceux qui ne sont pas vigilants. Téléphone dans la poche, les yeux ouverts, et ils te laissent. Bienvenue à Babi !" },
]

export function StreetStory() {
  const box = useRef<HTMLElement>(null)
  /** 0 at the first scene, CHAPTERS.length - 1 at the last: read by the 3D scene every frame. */
  const progress = useRef(0)
  const [chapter, setChapter] = useState(0)
  const [near, setNear] = useState(false)
  const [seen, setSeen] = useState(false)
  /** Has the visitor started scrolling the tour? Until then, say how it works. */
  const [moved, setMoved] = useState(false)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const n = CHAPTERS.length
    const read = () => {
      const r = el.getBoundingClientRect()
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)))
      // Each scene holds for a part of its share of the scroll, then the walk to the next (long enough not to rush).
      const c = Math.min(n - 1, p * n)
      const i = Math.floor(c)
      const u = c - i
      progress.current = i >= n - 1 ? n - 1 : i + smooth(Math.max(0, (u - 0.4) / 0.6))
      setChapter(Math.min(n - 1, Math.round(progress.current)))
      if (p > 0.04) setMoved(true)
    }
    read()
    addEventListener('scroll', read, { passive: true })
    addEventListener('resize', read)
    // The 3D only runs while the street is on screen (or about to be).
    const watch = new IntersectionObserver(([e]) => {
      setNear(e.isIntersecting)
      if (e.isIntersecting) setSeen(true)
    }, { rootMargin: '50% 0px' })
    watch.observe(el)
    return () => {
      removeEventListener('scroll', read)
      removeEventListener('resize', read)
      watch.disconnect()
    }
  }, [])

  const c = CHAPTERS[chapter]
  return (
    <section ref={box} className="relative -mx-4 sm:mx-0" style={{ height: `${CHAPTERS.length * 120 + 40}svh` }}>
      {/* The street in a painted frame; the words on cream signs over it */}
      <div className="sticky top-0 h-[100svh] overflow-hidden sm:top-[5svh] sm:h-[90svh] sm:border-[6px] sm:border-[var(--brown)]">
        <div className="absolute inset-0 bg-[#26332c]" />
        {seen && (
          <Suspense fallback={null}>
            <StreetScene progress={progress} running={near} />
          </Suspense>
        )}
        {/* The heading, at the top */}
        <div className="pointer-events-none absolute top-3 left-3 max-w-[calc(100%-1.5rem)] bg-[var(--cream)] px-4 py-3 sm:top-5 sm:left-5">
          <p className="chalk-hand text-[22px] leading-none text-[var(--rust)]">Visite guidée</p>
          <p className="paint mt-1 text-[26px] sm:text-[32px]">{GUIDE.name} te fait visiter son quartier</p>
          <p className="mt-1 text-[13px] font-extrabold">Fais défiler : vous marchez ensemble, la journée avance.</p>
        </div>
        {/* Awa's phone, when she uses it */}
        {c.phone && <Phone key={c.phone} app={c.phone} />}
        {/* How it works, until the visitor scrolls */}
        {!moved && (
          <div className="pointer-events-none absolute inset-x-0 top-[34%] flex justify-center">
            <span className="flex flex-col items-center gap-1 bg-[var(--brown)] px-5 py-3 text-center text-[var(--cream)]">
              <span className="slab text-[16px]">Fais défiler pour avancer</span>
              <ChevronsDown size={28} strokeWidth={2.6} className="animate-bounce text-[var(--ochre)]" />
            </span>
          </div>
        )}
        {/* What's going on, at the bottom: what Awa says, on a cream sign */}
        <div className="pointer-events-none absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:inset-x-5 sm:bottom-5">
          <div key={c.id} className="animate-pop max-w-xl bg-[var(--cream)] px-4 pt-3 pb-3.5">
            <div className="flex items-center gap-2.5">
              <span className="slab bg-[var(--rust)] px-2.5 py-1 text-[15px] text-[var(--cream)]">{c.time}</span>
              <h3 className="paint text-[24px] sm:text-[28px]">{c.title}</h3>
            </div>
            <p className="mt-2 text-[15px] leading-snug font-bold sm:text-base">
              <span className="chalk-hand mr-1 text-[22px] leading-none text-[var(--turq)]">{GUIDE.name} :</span>
              {c.text}
            </p>
            {chapter < CHAPTERS.length - 1 && (
              <p className="mt-2 flex items-center gap-1 text-[12px] font-extrabold opacity-70">
                <ChevronsDown size={14} strokeWidth={2.8} className="animate-bounce" /> Continue à défiler : la suite de la journée
              </p>
            )}
            <div className="mt-2.5 flex gap-1" aria-hidden>
              {CHAPTERS.map((x, i) => (
                <i key={x.id} className={`h-1.5 flex-1 transition-colors ${i <= chapter ? 'bg-[var(--ochre)]' : 'bg-[var(--brown)]/15'}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

/** Awa's phone screen: paying the tantie with Waye, or her Gnango on its way. */
function Phone({ app }: { app: 'waye' | 'gnango' }) {
  return (
    <div className="animate-pop pointer-events-none absolute top-[150px] right-4 w-[158px] rounded-[26px] bg-[#141416] p-1.5 shadow-[0_20px_40px_-18px_rgba(0,0,0,0.9)] sm:top-[170px] sm:right-8 sm:w-[190px]">
      <div className="rounded-[21px] bg-white px-3 pt-3 pb-3.5 text-[var(--color-ink)]">
        <div className="flex items-center gap-2">
          <AppLogo id={app} size={30} radius={9} />
          <span className="font-display text-[15px] font-extrabold">{app === 'waye' ? 'Waye' : 'Gnango'}</span>
        </div>
        {app === 'waye' ? (
          <>
            <p className="mt-2.5 text-[11px] font-bold text-[var(--color-ink-soft)]">Payer · Tantie alloco</p>
            <p className="font-display text-2xl font-extrabold">300 F</p>
            <p className="mt-2 flex items-center justify-center gap-1 rounded-full bg-[#e6f8ef] py-1.5 text-[12px] font-extrabold text-[var(--color-emerald-deep)]">
              <Check size={14} strokeWidth={3} /> Payé
            </p>
          </>
        ) : (
          <>
            <div className="relative mt-2.5 h-14 overflow-hidden rounded-xl bg-[#e9edf3]">
              <i className="absolute top-1/2 left-2 h-1 w-[70%] -translate-y-1/2 rounded-full bg-[#ffd166]" />
              <MapPin size={18} strokeWidth={2.6} className="absolute top-1/2 right-3 -translate-y-1/2 text-[var(--color-orange)]" />
            </div>
            <p className="mt-2 text-[12px] font-extrabold">Chauffeur trouvé</p>
            <p className="text-[11px] font-bold text-[var(--color-ink-soft)]">Arrive dans 2 min</p>
            <p className="mt-1.5 rounded-full bg-[#141416] py-1 text-center text-[11px] font-extrabold text-[#ffd166]">Prix fixé : 1 500 F</p>
          </>
        )}
      </div>
    </div>
  )
}
