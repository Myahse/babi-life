/** @jsxImportSource babi-dom */
import { useEffect, useRef, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import { ArrowRight } from 'lucide-react'
import { onBack } from '@web/lib/native'

// The app's welcome, the first time it opens: two short screens (a picture, a title, one line),
// « Passer » and the big button always in view, then the sign-in. Made for the app's landscape
// screen (the picture beside the words), and still fits a phone held upright.
// Written with the game's own classes (this file's JSX is the game's: <div> → our elements).

const SEEN = 'babi.onboarded'

export const onboarded = () => {
  try {
    return localStorage.getItem(SEEN) === '1'
  } catch {
    return false
  }
}

type Page = { picture: number; title: string; accent: string; text: string }

const PAGES: Page[] = [
  { picture: require('../assets/onboarding/famille.jpg'), title: 'Gnambro ou laté ?', accent: 'Le sort décide.', text: 'Ta famille est tirée au sort à ta naissance.' },
  { picture: require('../assets/onboarding/lieux.jpg'), title: 'Vis Babi', accent: "à l'heure d'Abidjan.", text: 'Les vrais quartiers, le boulot, le maquis, ton téléphone.' },
]
const LAST = PAGES.length - 1

/** done: on to the game (its sign-in, then the Sim's creation). */
export function Onboarding({ done }: { done: () => void }) {
  const { width, height } = useWindowDimensions()
  const [page, setPage] = useState(0)
  const pageRef = useRef(page)
  pageRef.current = page
  // The phone's back button: the page before, if there's one.
  useEffect(() => onBack(() => (pageRef.current > 0 ? (setPage(pageRef.current - 1), true) : false)), [])

  const finish = () => {
    try {
      localStorage.setItem(SEEN, '1')
    } catch {
      /* nothing kept: seen again next time */
    }
    done()
  }

  const wide = width > height
  const p = PAGES[page]
  // The picture as big as the screen leaves room for: beside the words lying down, above them upright.
  const pictureW = wide ? Math.min(240, (height - 200) * (360 / 420)) : Math.min(220, width * 0.55, (height - 380) * (360 / 420))

  return (
    <div className="street worn flex h-full flex-col pt-[env(safe-area-inset-top)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="ci-stripe !h-1" aria-hidden />
      <div className="flex items-center justify-between px-5 pt-2">
        <span className="paint flex items-center gap-2 text-[20px]">
          <svg width="14" height="20" viewBox="0 0 40 56" aria-hidden>
            <path d="M20 54C14 45 4 36 4 20a16 16 0 0 1 32 0c0 16-10 25-16 34Z" fill="#b5432c" />
            <circle cx="20" cy="20" r="7" fill="#fbf5e6" />
          </svg>
          Babi <span className="text-[var(--turq)]">Life</span>
        </span>
        <button type="button" className="px-2 py-1 text-[15px] font-extrabold underline underline-offset-4" onClick={finish}>
          Passer
        </button>
      </div>

      <div className={`flex min-h-0 flex-1 items-center justify-center gap-6 px-6 ${wide ? 'flex-row' : 'flex-col'}`}>
        {/* (The picture is the app's own file: a number, as React Native's pictures are; our <img> takes it.) */}
        <figure className={`taped m-0 shrink-0 ${page % 2 ? 'rotate-[1.2deg]' : '-rotate-1'}`} style={{ width: Math.max(90, pictureW) }}>
          <img src={p.picture as unknown as string} alt="" className="block w-full" style={{ aspectRatio: 360 / 420 }} />
        </figure>
        <div className={`flex flex-col ${wide ? 'max-w-[420px]' : 'items-center text-center'}`}>
          <h1 className="paint m-0 text-[34px] text-[var(--rust)] [text-shadow:2px_2px_0_var(--ochre)]">
            {p.title}
            <br />
            <span className="text-[var(--turq)] [text-shadow:2px_2px_0_var(--mint)]">{p.accent}</span>
          </h1>
          <p className="mt-2 text-[16px] leading-snug font-extrabold">{p.text}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 px-6">
        <div className="flex gap-1.5" aria-hidden>
          {PAGES.map((x, i) => (
            <i key={x.title} className={`h-2 w-6 ${i <= page ? 'bg-[var(--ochre)]' : 'bg-[var(--brown)]/15'}`} />
          ))}
        </div>
        {page < LAST ? (
          <button type="button" className="sign-btn flex-1 !py-3" onClick={() => setPage(page + 1)}>
            Suivant <ArrowRight size={20} strokeWidth={2.6} />
          </button>
        ) : (
          <button type="button" className="sign-btn flex-1 !py-3" onClick={finish}>
            Commencer <ArrowRight size={20} strokeWidth={2.6} />
          </button>
        )}
      </div>
    </div>
  )
}
