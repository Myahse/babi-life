import { useEffect, useRef, useState } from 'react'
import { Play } from 'lucide-react'
import { StreetStory } from './StreetStory'

// The landing on the wish list (/liste), painted like the signs of Abidjan's
// streets (index.css, .street): the maquis board, the steps on a mint wall,
// Awa's walk, short clips from inside the game pinned like photos (the
// trailer is in the hero, Waitlist.tsx), the questions, and the « Inscris-toi ici » sign. The clips are cut
// from the « découverte » video (marketing/out), 360 × 640 and muted, in
// public/apercu/.

/** What things cost in the game, on the maquis board (the game's own prices). */
const MENU: [string, string][] = [
  ['Café du pousse-pousse', '150 F'],
  ['Alloco de la tantie', '300 F'],
  ['Garba, grosse queue', '1 000 F'],
  ['Gbaka pour Adjamé', '300 F'],
  ['Porc au four', '1 500 F'],
  ['Thé bien mousseux', '100 F'],
]

const STEPS: [string, string][] = [
  ['Crée ton perso', 'Teint, coiffure, pagne, boubou, survêt. Comme toi, ou comme tu veux.'],
  ['Tu nais quelque part', "Ta famille est tirée au sort : gnambro, coulé, poignon, lagnon, laté ou debout. Baraque en tôle ou villa, c'est la vie."],
  ['Débrouille-toi', "Boulot, gbaka, maquis, garba, maison bloc par bloc. En même temps que toi, à l'heure d'Abidjan."],
]

const CLIPS: { id: string; title: string }[] = [
  { id: 'sim', title: 'Ton perso' },
  { id: 'look', title: 'Le look' },
  { id: 'famille', title: 'La famille' },
  { id: 'maison', title: 'Ta maison' },
  { id: 'gbaka', title: 'Le gbaka' },
  { id: 'gnango', title: 'Un Gnango' },
  { id: 'cause', title: 'On cause' },
  { id: 'fete', title: 'Le maquis' },
  { id: 'sport', title: 'Le sport' },
  { id: 'lieux', title: 'Les vrais lieux' },
  { id: 'telephone', title: 'Ton téléphone' },
]

const QUESTIONS: [string, string][] = [
  ["C'est quoi, Babi Life ?", "Un jeu de vie à Abidjan : les vraies communes, les vrais lieux, les gbakas, les maquis, notre façon de parler. Ton perso naît, grandit, travaille et se débrouille, en même temps que toi, à l'heure d'Abidjan."],
  ["C'est gratuit ?", "Oui. Le jeu est gratuit, et l'inscription sur la liste aussi."],
  ['Sur quel téléphone ?', "Sur ton téléphone, dans le navigateur, sans passer par un store. Tu peux aussi l'installer sur ton écran d'accueil."],
  ['Ça ouvre quand ?', 'Bientôt. Inscris-toi : on te prévient en premier, et si tu veux, tu testes avant tout le monde.'],
  ['Mon perso créé maintenant, je le garde ?', "Oui. Le perso que tu crées aujourd'hui, et la famille où il est né, t'attendent à l'ouverture."],
]

/** Plays while on screen, stops when scrolled away (saves the battery and the data). */
function Clip({ id, title }: { id: string; title: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const video = ref.current
    if (!video || !('IntersectionObserver' in window)) return
    const watch = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) void video.play().catch(() => undefined)
        else video.pause()
      },
      { threshold: 0.4 },
    )
    watch.observe(video)
    return () => watch.disconnect()
  }, [])
  return (
    <figure className="taped m-0 w-[58vw] max-w-[220px] shrink-0 snap-center odd:-rotate-1 even:rotate-[0.8deg] sm:w-auto sm:max-w-none">
      <video ref={ref} className="block aspect-[9/16] w-full bg-[#26332c] object-cover" src={`/apercu/${id}.mp4`} poster={`/apercu/${id}.jpg`} muted loop playsInline preload="none" aria-label={title} />
      <figcaption className="cap">{title}</figcaption>
    </figure>
  )
}

/** The trailer, pinned like a photo: its picture first, then the video with its controls once tapped. */
export function Trailer({ className = '' }: { className?: string }) {
  const [on, setOn] = useState(false)
  return (
    <figure className={`taped m-0 w-full max-w-[290px] ${className}`}>
      <div className="relative aspect-[9/13] overflow-hidden bg-[#26332c]">
        {on ? (
          <video className="h-full w-full object-cover" src="/apercu/bande-annonce.mp4" poster="/apercu/bande-annonce.jpg" autoPlay controls playsInline />
        ) : (
          <button className="group relative h-full w-full" onClick={() => setOn(true)} aria-label="Regarder la bande-annonce">
            <img src="/apercu/bande-annonce.jpg" alt="" className="h-full w-full object-cover" loading="lazy" />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-[var(--rust)] text-[var(--cream)] transition group-hover:scale-105">
                <Play size={28} strokeWidth={2.6} className="ml-1" fill="currentColor" />
              </span>
            </span>
          </button>
        )}
      </div>
      <figcaption className="cap">Tu nais gnambro ou laté ?</figcaption>
    </figure>
  )
}

export function Discover({ onJoin, count }: { onJoin: () => void; count: number | null }) {
  return (
    <>
      {/* ---------- The maquis board: what things cost in the game ---------- */}
      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="ardoise px-5 pt-5 pb-4 sm:px-7">
          <h2 className="chalk-hand m-0 text-[44px] leading-none">Au menu à Babi</h2>
          <ul className="chalk-hand mt-3 text-[26px] sm:text-[28px]">
            {MENU.map(([what, price]) => (
              <li key={what} className="flex items-baseline gap-2">
                {what}
                <i className="flex-1 -translate-y-1.5 border-b-2 border-dotted border-white/40" aria-hidden />
                <b className="text-[#f5d06b]">{price}</b>
              </li>
            ))}
          </ul>
          <p className="chalk-hand mt-2 text-[22px] text-[#bfe3cf]">On paie avec Waye. Crédit pas encore.</p>
        </div>
      </section>

      {/* ---------- The steps, painted on a mint wall ---------- */}
      <section className="worn bg-[var(--mint)] py-10">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="paint m-0 text-[clamp(38px,10vw,64px)] text-[var(--ci-green)]">Comment on fait ?</h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {STEPS.map(([title, text], i) => (
              <li key={title}>
                <span className="slab block text-[56px] leading-none text-[var(--cream)] [text-shadow:3px_3px_0_var(--ci-green)]">{i + 1}.</span>
                <h3 className="paint mt-2 text-[26px]">{title}</h3>
                <p className="mt-1 text-[16px] font-bold">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Awa's walk down her street, driven by the scroll ---------- */}
      <div className="mx-auto max-w-6xl px-4 py-10">
        <StreetStory />
      </div>

      {/* ---------- Inside the game: the clips, pinned like photos ---------- */}
      <section className="mx-auto max-w-5xl px-4 py-6">
        <h2 className="paint m-0 text-[clamp(36px,9vw,60px)] text-[var(--turq)] [text-shadow:2px_2px_0_var(--mint)]">Ce qui se passe dans le jeu</h2>
        <p className="mt-2 text-[16px] font-bold">Des scènes faites avec les persos et les lieux du jeu. Glisse pour tout voir.</p>
        <div className="-mx-4 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pt-2 pb-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-x-4 sm:gap-y-6 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {CLIPS.map((c) => (
            <Clip key={c.id} {...c} />
          ))}
        </div>
      </section>

      {/* ---------- Questions, plainly ---------- */}
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h2 className="paint m-0 text-[clamp(36px,9vw,56px)]">Tu te demandes…</h2>
        <dl className="mt-6 flex flex-col gap-5">
          {QUESTIONS.map(([q, a]) => (
            <div key={q} className="border-t-2 border-[var(--brown)]/15 pt-4">
              <dt className="slab text-[19px] text-[var(--turq)]">{q}</dt>
              <dd className="m-0 mt-1 text-[16px] leading-relaxed font-bold">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------- The « ICI » sign ---------- */}
      <section className="mx-auto max-w-5xl px-4 pt-4 pb-12">
        <div className="worn bg-[var(--ochre)] px-6 py-8 sm:px-9">
          <h2 className="paint m-0 text-[clamp(48px,12vw,96px)]">
            Inscris-toi <span className="text-[var(--rust)]">ici</span>
          </h2>
          <p className="mt-3 max-w-md text-[18px] font-extrabold">On te prévient dès que ça ouvre. Tu peux même tester avant tout le monde.</p>
          {count !== null && count > 0 && <p className="chalk-hand mt-1 text-[26px]">Déjà {count.toLocaleString('fr-FR')} sur la liste !</p>}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button className="sign-btn" onClick={onJoin}>
              M'inscrire
            </button>
            <span className="slab bg-[var(--turq)] px-3 py-2 text-[18px] text-[var(--cream)]">lifeinbabi.com/liste</span>
          </div>
        </div>
      </section>
    </>
  )
}
