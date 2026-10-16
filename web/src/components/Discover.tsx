import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Baby, Briefcase, Play, Sparkles, TrendingUp, type LucideIcon } from 'lucide-react'
import { IconTile } from './ui'
import { StreetStory } from './StreetStory'

// The landing on the wish list (/liste): what Babi Life is, how it works, and
// short clips from inside the game. The clips are cut from the « découverte »
// video (marketing/out), 360 × 640 and muted, in public/apercu/.

const STEPS: { icon: LucideIcon; colors: [string, string]; title: string; text: string }[] = [
  { icon: Sparkles, colors: ['#b39dff', '#7b5cff'], title: 'Crée ton perso', text: 'Teint, visage, coiffure, et des habits de chez nous : pagne wax, boubou, survêt, maillot.' },
  { icon: Baby, colors: ['#ffa040', '#ff7a00'], title: 'Nais dans une famille', text: "Tu ne choisis pas : gnambro, coulé, poignon, lagnon, laté ou debout. C'est tiré au sort, comme dans la vie." },
  { icon: Briefcase, colors: ['#69e2a0', '#00a862'], title: 'Vis ta vie à Babi', text: "Travaille, bouge en gbaka ou en Gnango, mange au maquis, cause avec les gens, fais la fête, fais du sport." },
  { icon: TrendingUp, colors: ['#7cc8ff', '#2f7cff'], title: 'Monte petit à petit', text: "Gagne ton argent, construis ta maison bloc par bloc, de la tôle jusqu'au marbre. Né gnambro, tu peux finir laté." },
]

const CLIPS: { id: string; title: string }[] = [
  { id: 'sim', title: 'Crée ton perso' },
  { id: 'look', title: 'Change de look' },
  { id: 'famille', title: 'Nais dans une famille' },
  { id: 'maison', title: 'Construis ta maison' },
  { id: 'gbaka', title: 'Monte dans le gbaka' },
  { id: 'gnango', title: 'Commande un Gnango' },
  { id: 'cause', title: 'Cause avec les gens' },
  { id: 'fete', title: 'Fais la fête' },
  { id: 'sport', title: 'Fais du sport' },
  { id: 'lieux', title: "Les vrais lieux d'Abidjan" },
  { id: 'telephone', title: 'Ton téléphone' },
]

const QUESTIONS: [string, string][] = [
  ["C'est quoi, Babi Life ?", "Un jeu de vie à Abidjan : les vraies communes, les vrais lieux, les gbakas, les maquis, notre façon de parler. Ton perso naît, grandit, travaille et se débrouille, en même temps que toi, à l'heure d'Abidjan."],
  ["C'est gratuit ?", "Oui. Le jeu est gratuit, et l'inscription sur la liste aussi."],
  ['Ça marche sur quel téléphone ?', "Sur ton téléphone, dans le navigateur, sans passer par un store. Tu peux aussi l'installer sur ton écran d'accueil avec le bouton « Installer l'app »."],
  ["Ça ouvre quand ?", "Bientôt. Inscris-toi : on te prévient en premier, et si tu le veux, tu testes avant tout le monde."],
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
    <figure className="w-[62vw] max-w-[230px] shrink-0 snap-center sm:w-auto sm:max-w-none">
      <video
        ref={ref}
        className="aspect-[9/16] w-full rounded-[22px] border border-white/10 bg-[#171a42] object-cover shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)]"
        src={`/apercu/${id}.mp4`}
        poster={`/apercu/${id}.jpg`}
        muted
        loop
        playsInline
        preload="none"
        aria-label={title}
      />
    </figure>
  )
}

/** The trailer: its picture first, then the video with its controls once tapped. */
function Trailer() {
  const [on, setOn] = useState(false)
  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[320px] overflow-hidden rounded-[28px] border border-white/15 bg-[#171a42] shadow-[0_30px_60px_-25px_rgba(0,0,0,0.9)]">
      {on ? (
        <video className="h-full w-full object-cover" src="/apercu/bande-annonce.mp4" poster="/apercu/bande-annonce.jpg" autoPlay controls playsInline />
      ) : (
        <button className="group relative h-full w-full" onClick={() => setOn(true)} aria-label="Regarder la bande-annonce">
          <img src="/apercu/bande-annonce.jpg" alt="" className="h-full w-full object-cover" loading="lazy" />
          <span className="absolute inset-0 grid place-items-center bg-black/25">
            <span className="grid h-20 w-20 place-items-center rounded-full bg-[var(--color-orange)] text-white shadow-lg transition group-hover:scale-110">
              <Play size={34} strokeWidth={2.6} className="ml-1" fill="currentColor" />
            </span>
          </span>
        </button>
      )}
    </div>
  )
}

const H2 = 'font-display text-3xl leading-tight font-extrabold sm:text-4xl'
const KICKER = 'text-xs font-extrabold tracking-[0.14em] text-[var(--color-orange)] uppercase'

export function Discover({ onJoin }: { onJoin: () => void }) {
  return (
    <div className="flex flex-col gap-16 lg:col-span-2 lg:gap-20">
      {/* ---------- How it works ---------- */}
      <section className="mt-6">
        <p className={KICKER}>Comment ça marche</p>
        <h2 className={`mt-2 ${H2}`}>Ta vie à Abidjan, en 4 temps</h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-[24px] border border-white/10 bg-[#171a42]/90 p-5 backdrop-blur">
              <span className="absolute top-4 right-5 font-display text-4xl font-extrabold text-white/10">{i + 1}</span>
              <IconTile icon={s.icon} colors={s.colors} size={48} />
              <h3 className="mt-3 font-display text-lg leading-tight font-extrabold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-snug font-semibold text-white/75">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- The guided walk down a street, driven by the scroll ---------- */}
      <StreetStory />

      {/* ---------- Inside the game ---------- */}
      <section>
        <p className={KICKER}>Dans le jeu</p>
        <h2 className={`mt-2 ${H2}`}>Regarde ce qui t'attend</h2>
        <p className="mt-2 max-w-xl text-sm font-semibold text-white/75 sm:text-base">Des scènes faites avec les persos et les lieux du jeu. Glisse pour tout voir.</p>
        <div className="-mx-5 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-3 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {CLIPS.map((c) => (
            <Clip key={c.id} {...c} />
          ))}
        </div>
      </section>

      {/* ---------- Trailer ---------- */}
      <section className="grid items-center gap-8 lg:grid-cols-2">
        <div className="text-center lg:text-left">
          <p className={KICKER}>Bande-annonce</p>
          <h2 className={`mt-2 ${H2}`}>Tu nais gnambro ou laté ?</h2>
          <p className="mx-auto mt-3 max-w-md text-base leading-relaxed font-semibold text-white/80 lg:mx-0">
            Dans Babi Life, ta famille est tirée au sort. Les uns commencent dans une baraque en tôle, les autres dans une villa avec piscine. Après, c'est toi qui te débrouilles.
          </p>
          <button className="btn mt-6 w-full max-w-sm" onClick={onJoin}>
            Je veux jouer <ArrowRight size={18} strokeWidth={2.6} />
          </button>
        </div>
        <Trailer />
      </section>

      {/* ---------- Questions ---------- */}
      <section className="mx-auto w-full max-w-3xl">
        <p className={`${KICKER} text-center`}>Questions</p>
        <h2 className={`mt-2 text-center ${H2}`}>Tu te demandes…</h2>
        <div className="mt-6 flex flex-col gap-2.5">
          {QUESTIONS.map(([q, a]) => (
            <details key={q} className="group rounded-[20px] border border-white/10 bg-[#171a42]/90 px-5 py-4 backdrop-blur">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-display text-[17px] font-extrabold">
                {q}
                <span className="text-2xl leading-none text-[var(--color-orange)] transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed font-semibold text-white/75">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ---------- Last call ---------- */}
      <section className="flex flex-col items-center rounded-[32px] bg-[linear-gradient(135deg,#ff8a1a,#ff5f3a)] px-6 py-10 text-center shadow-[0_30px_60px_-30px_rgba(255,120,30,0.8)]">
        <h2 className={H2}>Babi t'attend.</h2>
        <p className="mt-2 max-w-md text-base font-bold text-white/90">Inscris-toi maintenant, on te prévient en premier.</p>
        <button className="btn btn-white mt-6 w-full max-w-sm" onClick={onJoin}>
          M'inscrire sur la liste <ArrowRight size={18} strokeWidth={2.6} />
        </button>
      </section>
    </div>
  )
}
