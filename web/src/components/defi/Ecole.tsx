import { useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import { haptic } from '../../lib/native'
import { t, tx } from '../../lib/i18n'

// La leçon du maître (« Aller à l'école »): he asks the class, the Sim puts its
// hand up. Six questions of its age, three answers each: sums and times tables,
// French, the country (Abidjan, Yamoussoukro, the flag), what's around; for a
// teenager, harder (percentages, squares, history, science). The score: the
// share of good answers.

type Q = { q: string; a: string[]; ok: number }

const shuffle = <T,>(a: T[]) => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map(([, v]) => v)
const pick = (n: number) => Math.floor(Math.random() * n)

/** A sum, a subtraction or a times table, the wrong answers close to the right one. */
function sum(older: boolean): Q {
  const kind = pick(3)
  let q = ''
  let r = 0
  if (kind === 0) {
    const [a, b] = older ? [12 + pick(60), 9 + pick(40)] : [1 + pick(9), 1 + pick(9)]
    ;[q, r] = [`${a} + ${b} = ?`, a + b]
  } else if (kind === 1) {
    const [a, b] = older ? [40 + pick(60), 5 + pick(35)] : [6 + pick(12), 1 + pick(5)]
    ;[q, r] = [`${a} − ${b} = ?`, a - b]
  } else {
    const [a, b] = older ? [6 + pick(7), 6 + pick(7)] : [2 + pick(4), 1 + pick(9)]
    ;[q, r] = [`${a} × ${b} = ?`, a * b]
  }
  const wrong = shuffle([r + 1, r - 1, r + 2, r + 10, r - 2].filter((x) => x >= 0 && x !== r)).slice(0, 2)
  const a = shuffle([r, ...wrong]).map(String)
  return { q, a, ok: a.indexOf(String(r)) }
}

const KIDS: Q[] = [
  { q: t("Quelle est la capitale politique de la Côte d'Ivoire ?"), a: [t('Yamoussoukro'), t('Abidjan'), t('Bouaké')], ok: 0 },
  { q: t('Les couleurs du drapeau ivoirien ?'), a: [t('Orange, blanc, vert'), t('Rouge, jaune, vert'), t('Bleu, blanc, rouge')], ok: 0 },
  { q: t('Combien de jours dans une semaine ?'), a: ['5', '7', '10'], ok: 1 },
  { q: t('Le contraire de « grand » ?'), a: [t('Fort'), t('Petit'), t('Long')], ok: 1 },
  { q: t('Lequel est un fruit ?'), a: [t('La mangue'), t('Le gbaka'), t('La chaise')], ok: 0 },
  { q: t("Combien de pattes a l'araignée Kacou Ananzè ?"), a: ['6', '8', '4'], ok: 1 },
  { q: t('Le pluriel de « un cheval » ?'), a: [t('Des chevals'), t('Des chevaux'), t('Des chevaus')], ok: 1 },
  { q: t("Notre équipe nationale de foot s'appelle…"), a: [t('Les Lions'), t('Les Éléphants'), t('Les Aigles')], ok: 1 },
  { q: t('Le soleil se lève à…'), a: [t("L'est"), t("L'ouest"), t('Au nord')], ok: 0 },
  { q: t('Combien font une dizaine ?'), a: ['5', '12', '10'], ok: 2 },
  { q: t('Quel animal donne le lait ?'), a: [t('La vache'), t('Le poulet'), t('Le poisson')], ok: 0 },
  { q: t('On écrit avec…'), a: [t('Un crayon'), t('Une cuillère'), t('Un seau')], ok: 0 },
]
const TEENS: Q[] = [
  { q: t("En quelle année la Côte d'Ivoire est-elle devenue indépendante ?"), a: ['1945', '1960', '1975'], ok: 1 },
  { q: t("Qui fut le premier président de la Côte d'Ivoire ?"), a: [t('Félix Houphouët-Boigny'), t('Henri Konan Bédié'), t('Laurent Gbagbo')], ok: 0 },
  { q: t("Quel océan borde la Côte d'Ivoire ?"), a: [t("L'océan Indien"), t("L'océan Atlantique"), t("L'océan Pacifique")], ok: 1 },
  { q: t("La lagune d'Abidjan s'appelle…"), a: [t('La lagune Aby'), t('La lagune Ébrié'), t('La lagune Tagba')], ok: 1 },
  { q: t('10 % de 500, ça fait…'), a: ['5', '50', '100'], ok: 1 },
  { q: t('Combien font 7² ?'), a: ['14', '49', '77'], ok: 1 },
  { q: t('H₂O, c’est…'), a: [t("L'eau"), t("L'air"), t('Le sel')], ok: 0 },
  { q: t('La planète la plus proche du Soleil ?'), a: [t('Mars'), t('Vénus'), t('Mercure')], ok: 2 },
  { q: t('Le participe passé de « prendre » ?'), a: [t('Prendu'), t('Pris'), t('Prit')], ok: 1 },
  { q: t('Le cœur pompe…'), a: [t('Le sang'), t("L'air"), t('La lymphe seulement')], ok: 0 },
  { q: t('Un triangle a combien de côtés ?'), a: ['3', '4', '5'], ok: 0 },
  { q: t('La Côte d’Ivoire est le premier producteur mondial de…'), a: [t('Café'), t('Cacao'), t('Coton')], ok: 1 },
]

/** The six questions of the lesson: two sums, four from the subjects (answers shuffled). */
export function lesson(older: boolean): Q[] {
  const bank = shuffle(older ? TEENS : KIDS).slice(0, 4).map((x) => {
    const order = shuffle(x.a.map((_, i) => i))
    return { q: x.q, a: order.map((i) => x.a[i]), ok: order.indexOf(x.ok) }
  })
  return shuffle([sum(older), sum(older), ...bank])
}

export function EcoleDefi({ older, onEnd }: { /** A teenager (collège, lycée): the harder questions. */ older: boolean; onEnd: (score: number) => void }) {
  const qs = useMemo(() => lesson(older), [older])
  const [k, setK] = useState(0)
  const [right, setRight] = useState(0)
  const [chose, setChose] = useState<number | null>(null)
  const q = qs[k]
  const answer = (i: number) => {
    if (chose !== null) return
    setChose(i)
    const good = i === q.ok
    haptic(good ? 'success' : 'error')
    const total = right + (good ? 1 : 0)
    if (good) setRight(total)
    setTimeout(() => {
      if (k + 1 >= qs.length) return onEnd(Math.round((total / qs.length) * 100))
      setChose(null)
      setK(k + 1)
    }, 1100)
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
      {/* The blackboard, the chalk question */}
      <div className="w-full max-w-md rounded-[20px] border-[10px] border-[#6b4426] bg-[#2f5d46] p-5 text-center shadow-[inset_0_0_30px_rgba(0,0,0,0.35)]">
        <div className="text-[12px] font-extrabold tracking-wider text-white/60 uppercase">
          {tx('Question {0} / {length}', { 0: k + 1, length: qs.length })}
        </div>
        <div className="mt-2 font-display text-[22px] leading-snug font-extrabold text-[#f8f9fa]">{q.q}</div>
      </div>
      <div className="grid w-full max-w-md gap-2">
        {q.a.map((a, i) => {
          const state = chose === null ? '' : i === q.ok ? 'bg-[#d3f9d8] ring-2 ring-[#2b8a3e]' : i === chose ? 'bg-[#ffe3e3] ring-2 ring-[#e03131]' : 'opacity-60'
          return (
            <button key={a} className={`tile flex w-full items-center justify-between px-4 py-3 text-left text-[16px] font-extrabold transition active:scale-[0.98] ${state}`} onClick={() => answer(i)} disabled={chose !== null}>
              {a}
              {chose !== null && i === q.ok && <Check size={20} strokeWidth={3} className="text-[#2b8a3e]" />}
              {chose === i && i !== q.ok && <X size={20} strokeWidth={3} className="text-[#e03131]" />}
            </button>
          )
        })}
      </div>
      <div className="text-sm font-extrabold text-white/80">
        {tx('{right} bonne{0} réponse{0}', { right, 0: right > 1 ? 's' : '' })}
      </div>
    </div>
  )
}
