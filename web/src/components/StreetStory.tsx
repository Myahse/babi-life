import { Suspense, lazy, useEffect, useRef, useState } from 'react'

// « Une journée dans ta rue », on the wish list: the street is pinned to the
// screen and scrolling walks down it through the day, from the morning café to
// the thé at night. The people are the game's own (world3d/open), living as
// they do in the game: the sellers call out, the customers eat and chat, the
// pupils walk, the boys play and step aside for the car.

const StreetScene = lazy(() => import('./StreetScene'))

export type Chapter = { id: 'cafe' | 'ecole' | 'sotra' | 'pasteur' | 'alloco' | 'foot' | 'porc' | 'the'; time: string; title: string; text: string }

/** The guide who walks you down the street, a Sim of the game. */
export const GUIDE = { name: 'Awa', gender: 'femme' as const, seed: 'guide-awa-3' }

/** What the guide shows and says at each stop, from the morning to the night. */
export const CHAPTERS: Chapter[] = [
  { id: 'cafe', time: '6 h', title: 'Le café au pousse-pousse', text: "On commence tôt ! Le café du matin, 150 F : on le boit debout, on cause un peu, et chacun part au boulot." },
  { id: 'ecole', time: '7 h', title: 'Les élèves en route', text: "Regarde les petits : tenue kaki et bleue, sac au dos. Ils vont à l'école à pied, en groupe." },
  { id: 'sotra', time: '8 h', title: "L'arrêt SOTRA", text: "Ici on attend le bus : le 11, le 19, le 44. Quand il arrive, ça monte, ça descend. Toi aussi tu pourras le prendre." },
  { id: 'pasteur', time: '10 h', title: 'Le pasteur au bord de la route', text: "Lui, c'est le pasteur du coin : Bible en main, petit ampli. Ceux qui passent s'arrêtent un peu : « Amen ! »" },
  { id: 'alloco', time: '13 h', title: "L'alloco de la tantie", text: "Midi, on a faim ! L'alloco de la tantie, 300 F. Tu t'assois sur le banc et tu manges en causant." },
  { id: 'foot', time: '16 h', title: 'Le maracana du quartier', text: "Les gars jouent dans la rue, deux cailloux pour les buts. Une voiture arrive ? On se range… et ça reprend !" },
  { id: 'porc', time: '19 h', title: 'Le porc au four', text: "Le soir, les tanties du four sont là, côte à côte. Ça fume, on découpe, on s'assoit et on mange. Tu viens ?" },
  { id: 'the', time: '21 h', title: 'Le thé bien mousseux', text: "On finit au thé, 100 F. On s'assoit autour du pousse-pousse et on cause jusqu'à tard. Bienvenue à Babi !" },
]

export function StreetStory() {
  const box = useRef<HTMLElement>(null)
  /** 0 at the first scene, CHAPTERS.length - 1 at the last: read by the 3D scene every frame. */
  const progress = useRef(0)
  const [chapter, setChapter] = useState(0)
  const [near, setNear] = useState(false)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const n = CHAPTERS.length
    const read = () => {
      const r = el.getBoundingClientRect()
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)))
      // Each scene holds for most of its share of the scroll, then the walk to the next.
      const c = Math.min(n - 1, p * n)
      const i = Math.floor(c)
      const u = c - i
      progress.current = i >= n - 1 ? n - 1 : i + smooth(Math.max(0, (u - 0.55) / 0.45))
      setChapter(Math.min(n - 1, Math.round(progress.current)))
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
    <section ref={box} className="relative -mx-5 lg:col-span-2 lg:mx-0" style={{ height: `${CHAPTERS.length * 85 + 40}svh` }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden lg:top-[5svh] lg:h-[90svh] lg:rounded-[32px] lg:border lg:border-white/10">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#2a2f6a,#0f1230)]" />
        {seen && (
          <Suspense fallback={null}>
            <StreetScene progress={progress} running={near} />
          </Suspense>
        )}
        {/* The heading, at the top */}
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-[#0f1230]/85 to-transparent px-5 pt-5 pb-10 lg:px-8 lg:pt-7">
          <p className="text-xs font-extrabold tracking-[0.14em] text-[var(--color-orange)] uppercase">Visite guidée · Une journée dans ta rue</p>
          <p className="mt-1 font-display text-2xl leading-tight font-extrabold sm:text-3xl">{GUIDE.name} te fait visiter son quartier.</p>
          <p className="mt-1 text-sm font-semibold text-white/75">Fais défiler : vous marchez ensemble, la journée avance.</p>
        </div>
        {/* What's going on, at the bottom */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0f1230]/95 via-[#0f1230]/70 to-transparent px-5 pt-16 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:px-8 lg:pb-8">
          <div key={c.id} className="animate-pop max-w-lg">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[var(--color-orange)] px-3 py-1 text-sm font-extrabold">{c.time}</span>
              <h3 className="font-display text-xl leading-tight font-extrabold sm:text-2xl">{c.title}</h3>
            </div>
            {/* The guide talking */}
            <p className="mt-2.5 rounded-[20px] rounded-tl-md bg-white px-4 py-3 text-[15px] leading-snug font-bold text-[var(--color-ink)] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)] sm:text-base">
              <span className="mb-0.5 block text-xs font-extrabold text-[var(--color-orange)]">{GUIDE.name}, ta guide</span>
              {c.text}
            </p>
          </div>
          <div className="mt-4 flex gap-1.5" aria-hidden>
            {CHAPTERS.map((x, i) => (
              <i key={x.id} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= chapter ? 'bg-[var(--color-orange)]' : 'bg-white/20'}`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
