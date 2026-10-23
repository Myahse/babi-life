/** @jsxImportSource babi-dom */
import { useEffect, useRef, useState } from 'react'
import { ScrollView, useWindowDimensions, View } from 'react-native'
import { ArrowRight, Bell, UserRound } from 'lucide-react'
import { onBack } from '@web/lib/native'
import { history } from './dom/history'

// The app's welcome, instead of the website's wish list page: four pages to
// swipe through (what Babi Life is, in the wish list's painted-wall look and
// words), then where to go. Once seen, the app opens on its last page while
// the game is shut (the wish list's place); when it's open, on the game.
// Written with the game's own classes (this file's JSX is the game's: <div>
// → our elements), the swiping with React Native's own paging scroller.

const SEEN = 'babi.onboarded'

export const onboarded = () => {
  try {
    return localStorage.getItem(SEEN) === '1'
  } catch {
    return false
  }
}

type Page = { picture: number; kicker: string; title: string; accent: string; text: string }

const PAGES: Page[] = [
  { picture: require('../assets/onboarding/famille.jpg'), kicker: 'Bienvenue à Babi', title: 'Gnambro ou laté\u00a0?', accent: 'Le sort décide.', text: 'Tu ne choisis pas ta famille : elle est tirée au sort à ta naissance. Gnambro, coulé, poignon, lagnon, laté ou debout.' },
  { picture: require('../assets/onboarding/lieux.jpg'), kicker: 'La vraie carte', title: 'Les vrais lieux', accent: "d'Abidjan.", text: "Les vraies communes, les vrais quartiers : Siporex, Rue Princesse, le Plateau… Le jeu vit à l'heure d'Abidjan." },
  { picture: require('../assets/onboarding/gbaka.jpg'), kicker: 'Ta vie', title: 'Débrouille-toi', accent: 'Comme nous.', text: 'Boulot, gbaka, maquis, garba : ton perso grandit et se débrouille, en même temps que toi.' },
  { picture: require('../assets/onboarding/telephone.jpg'), kicker: 'Dans ta poche', title: 'Ton téléphone', accent: 'dans le jeu.', text: 'Waye pour payer, Gnango pour rentrer, Gbairai pour les nouvelles, Tikitoko pour les vidéos.' },
]
const LAST = PAGES.length - 1

/** open: the game is open to this phone (a tester's); done: on to it. */
export function Onboarding({ open, done }: { open: boolean; done: () => void }) {
  const { width, height } = useWindowDimensions()
  const scroller = useRef<ScrollView>(null)
  // Seen before: straight to the last page, where one goes on from.
  const [page, setPage] = useState(() => (onboarded() ? LAST : 0))
  const pageRef = useRef(page)
  pageRef.current = page

  // Where it opened (given once: the scroller is moved by hand or by go() after).
  const start = useRef({ x: page * width, y: 0 }).current
  // A page asked for (Suivant, Passer): the scroll on its way there doesn't change the page shown.
  const heading = useRef<number | null>(null)
  const go = (i: number) => {
    heading.current = i
    setPage(i)
    scroller.current?.scrollTo({ x: i * width, animated: true })
  }
  // The phone's back button: the page before, if there's one.
  useEffect(() => onBack(() => (pageRef.current > 0 ? (go(pageRef.current - 1), true) : false)), [width]) // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (to?: string) => {
    try {
      localStorage.setItem(SEEN, '1')
    } catch {
      /* nothing kept: seen again next time */
    }
    if (to) history.push(to)
    done()
  }

  // The picture as big as the screen leaves room for (small phones too).
  const short = height < 720
  const pictureW = Math.max(short ? 105 : 150, Math.min(250, width * 0.62, ((height - (short ? 530 : 470)) * 360) / 420))

  return (
    <div className="street worn flex h-full flex-col">
      <header className="bg-[var(--turq)] text-[var(--cream)]">
        <div className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <span className="paint flex items-center gap-2.5 text-[26px]">
            <svg width="20" height="28" viewBox="0 0 40 56" aria-hidden>
              <path d="M20 54C14 45 4 36 4 20a16 16 0 0 1 32 0c0 16-10 25-16 34Z" fill="#fbf5e6" />
              <circle cx="20" cy="20" r="7" fill="#0b6b3d" />
            </svg>
            Babi <span className="text-[var(--ochre)]">Life</span>
          </span>
          {page < LAST ? (
            <button type="button" className="text-[14px] font-extrabold opacity-90" onClick={() => go(LAST)}>
              Passer
            </button>
          ) : (
            <span className="text-[13px] font-extrabold">{open ? 'Gratuit' : 'Bientôt · Gratuit'}</span>
          )}
        </div>
      </header>
      <div className="ci-stripe" aria-hidden />

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        contentOffset={start}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const x = e.nativeEvent.contentOffset.x
          const i = Math.round(x / width)
          if (heading.current !== null) {
            if (Math.abs(x - heading.current * width) < 2) heading.current = null
            return
          }
          if (i !== pageRef.current && i >= 0 && i <= LAST) setPage(i)
        }}
      >
        {PAGES.map((p, i) => (
          <View key={p.kicker} style={{ width }}>
            <div className={`flex h-full flex-col px-6 ${short ? 'pt-3' : 'pt-5'}`}>
              <figure className={`taped m-0 self-center ${i % 2 ? 'rotate-[1.2deg]' : '-rotate-1'}`} style={{ width: pictureW }}>
                <img src={p.picture} alt="" className="block w-full" style={{ aspectRatio: 360 / 420 }} />
              </figure>
              <p className={`chalk-hand ${short ? 'mt-3' : 'mt-5'} text-[24px] leading-none text-[var(--ci-green)]`}>{p.kicker}</p>
              <h1 className={`paint m-0 mt-1 ${short ? 'text-[36px]' : 'text-[46px]'} text-[var(--rust)] [text-shadow:3px_3px_0_var(--ochre)]`}>
                {p.title}
                <br />
                <span className="text-[var(--turq)] [text-shadow:3px_3px_0_var(--mint)]">{p.accent}</span>
              </h1>
              <p className={`mt-3 ${short ? 'text-[15px]' : 'text-[16px]'} leading-snug font-extrabold`}>{p.text}</p>
            </div>
          </View>
        ))}
      </ScrollView>

      <footer className="flex flex-col gap-3 px-6 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-1.5" aria-hidden>
          {PAGES.map((p, i) => (
            <i key={p.kicker} className={`h-1.5 flex-1 ${i <= page ? 'bg-[var(--ochre)]' : 'bg-[var(--brown)]/15'}`} />
          ))}
        </div>
        {page < LAST ? (
          <button type="button" className="sign-btn w-full" onClick={() => go(page + 1)}>
            Suivant <ArrowRight size={20} strokeWidth={2.6} />
          </button>
        ) : open ? (
          <button type="button" className="sign-btn w-full" onClick={() => finish()}>
            C'est parti <ArrowRight size={20} strokeWidth={2.6} />
          </button>
        ) : (
          <>
            <button type="button" className="sign-btn w-full" onClick={() => finish('/liste/creer')}>
              <UserRound size={20} strokeWidth={2.6} /> Crée ton perso
            </button>
            <button type="button" className="sign-btn alt w-full" onClick={() => finish('/liste/inscription')}>
              <Bell size={19} strokeWidth={2.6} /> Préviens-moi à l'ouverture
            </button>
          </>
        )}
      </footer>
    </div>
  )
}
