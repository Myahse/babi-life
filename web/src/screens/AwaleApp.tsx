import { useEffect, useRef, useState } from 'react'
import { PvpButton } from '../components/pvp/PvpButton'
import { ChevronDown, RotateCcw } from 'lucide-react'
import type { Sim } from '../lib/types'
import { legal, move, newAwale, play, think, winner, type Awale } from '../game/awale'
import { t } from '../lib/i18n'

// Awalé 225 on the phone: the board of the old men under the tree, against
// the computer at three levels (how far it looks ahead). For nothing: no
// stake, the pleasure of the game. The rules: game/awale.ts.

const WOOD = 'linear-gradient(160deg,#9c6b3a,#4a2a12)'
const LEVELS = [
  { id: 2, label: t('Débutant'), who: t('Petit Yao') },
  { id: 4, label: t('Habitué'), who: t('Tantie Aya') },
  { id: 6, label: t('Vieux du grin'), who: t('Le vieux Kouamé') },
]

/** A hole's seeds as little dots (up to 12 drawn, the count beside). */
function Seeds({ n }: { n: number }) {
  const shown = Math.min(n, 12)
  return (
    <span className="flex max-w-[44px] flex-wrap items-center justify-center gap-[2px]">
      {[...Array(shown)].map((_, i) => (
        <span key={i} className="h-[7px] w-[7px] rounded-full bg-[radial-gradient(circle_at_35%_30%,#f3e6c8,#8a7a5a)] shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />
      ))}
    </span>
  )
}

export function AwaleApp({ sim }: { sim: Sim }) {
  const [level, setLevel] = useState(LEVELS[1])
  const [game, setGame] = useState<Awale>(() => newAwale(0))
  // While seeds are being sown: the holes as shown, the hole lit.
  const [shown, setShown] = useState<{ holes: number[]; at: number } | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const [rules, setRules] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  /** Sow from a hole, seed by seed, then the game after the move. */
  function sow(g: Awale, from: number, then: (next: Awale) => void) {
    const h = g.holes.slice()
    let n = h[from]
    h[from] = 0
    let i = from
    const step = () => {
      if (n === 0) {
        const r = play(g, from)
        const next = move(g, from)
        if (r.taken) setSaid(t('{0} {taken} graine{1} !', { 0: g.turn === 0 ? t('Tu prends') : `${level.who} prend`, taken: r.taken, 1: r.taken > 1 ? 's' : '' }))
        setShown(null)
        setGame(next)
        then(next)
        return
      }
      i = (i + 1) % 12
      if (i !== from) {
        h[i]++
        n--
      }
      setShown({ holes: h.slice(), at: i })
      timer.current = setTimeout(step, 130)
    }
    setShown({ holes: h.slice(), at: from })
    timer.current = setTimeout(step, 130)
  }
  const computer = (g: Awale) => {
    if (g.over || g.turn !== 1) return
    timer.current = setTimeout(() => sow(g, think(g, level.id), () => {}), 650)
  }
  const tap = (i: number) => {
    if (shown || game.turn !== 0 || !legal(game).includes(i)) return
    setSaid(null)
    sow(game, i, computer)
  }
  const restart = () => {
    clearTimeout(timer.current)
    setShown(null)
    setSaid(null)
    setGame(newAwale(0))
  }
  const holes = shown?.holes ?? game.holes
  const can = !shown && game.turn === 0 ? legal(game) : []
  const w = game.over ? winner(game) : null

  const hole = (i: number) => (
    <button key={i} onClick={() => tap(i)} disabled={!can.includes(i)} className={`relative grid aspect-square place-items-center rounded-full bg-[radial-gradient(circle_at_50%_35%,#3a2312,#5c3a1e_70%,#7a522c)] shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)] transition ${shown?.at === i ? 'ring-2 ring-[#ffd166]' : can.includes(i) ? 'ring-2 ring-white/50' : ''}`}>
      <Seeds n={holes[i]} />
      <span className="absolute -bottom-1 rounded-full bg-black/55 px-1.5 text-[10px] font-extrabold text-white">{holes[i]}</span>
    </button>
  )

  return (
    <div className="-mx-3 -mt-2">
      <div className="px-4 pt-2 pb-4 text-white" style={{ background: WOOD }}>
        <div className="font-display text-2xl font-extrabold tracking-wide">{t('AWALÉ 225')}</div>
        <div className="text-sm font-bold opacity-85">{t('Les graines du grin, contre')} {level.who}</div>
      </div>
      <div className="px-3 pt-3 pb-4">
        <PvpButton game="awale" className="mb-3" />
        <div className="mb-3 flex gap-1.5">
          {LEVELS.map((l) => (
            <button key={l.id} onClick={() => (setLevel(l), restart())} className={`flex-1 rounded-full px-2 py-1.5 text-xs font-extrabold ${l.id === level.id ? 'bg-[#8a4b1f] text-white' : 'bg-[var(--color-canvas)] text-[var(--color-ink-soft)]'}`}>
              {l.label}
            </button>
          ))}
        </div>

        <div className="rounded-[22px] p-3 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)]" style={{ background: 'linear-gradient(180deg,#b9824a,#8a5a2b)' }}>
          <div className="mb-1 flex items-center justify-between text-[12px] font-extrabold text-white/90">
            <span>{level.who}</span>
            <span className="rounded-full bg-black/30 px-2">{game.store[1]} {t('graines')}</span>
          </div>
          {/* The other's row, right to left from the player: holes 11 … 6. */}
          <div className="grid grid-cols-6 gap-1.5">{[11, 10, 9, 8, 7, 6].map(hole)}</div>
          <div className="my-2 h-[3px] rounded-full bg-black/20" />
          <div className="grid grid-cols-6 gap-1.5">{[0, 1, 2, 3, 4, 5].map(hole)}</div>
          <div className="mt-1 flex items-center justify-between text-[12px] font-extrabold text-white/90">
            <span>{sim.firstName} {t('(toi)')}</span>
            <span className="rounded-full bg-black/30 px-2">{game.store[0]} {t('graines')}</span>
          </div>
        </div>

        <p className="mt-3 min-h-[20px] text-center text-sm font-extrabold text-[var(--color-ink)]">
          {w !== null ? (w === 0 ? t('Tu as gagné, {0} à {1} !', { 0: game.store[0], 1: game.store[1] }) : w === 1 ? t('{who} gagne, {0} à {1}.', { who: level.who, 0: game.store[1], 1: game.store[0] }) : t('Match nul, 24 partout.')) : said ?? (shown ? '…' : game.turn === 0 ? t('À toi : touche un trou de ta rangée.') : t('{who} réfléchit…', { who: level.who }))}
        </p>
        {(game.over || game.moves > 0) && (
          <button className="btn mt-2 w-full !bg-[#8a4b1f] !py-2.5" onClick={restart}>
            <RotateCcw size={16} /> {game.over ? t('Rejouer') : t('Recommencer')}
          </button>
        )}

        <button className="mt-4 flex w-full items-center justify-between rounded-2xl bg-[var(--color-canvas)] px-3 py-2.5 text-left" onClick={() => setRules(!rules)}>
          <span className="font-display text-[15px] font-extrabold">{t('Les règles')}</span>
          <ChevronDown size={18} className={rules ? 'rotate-180' : ''} />
        </button>
        {rules && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-snug font-bold text-[var(--color-ink-soft)]">
            <li>{t('Deux rangées de six trous, quatre graines dans chacun : ta rangée est en bas.')}</li>
            <li>{t("Prends toutes les graines d'un de tes trous et sème-les une par une, dans le sens inverse des aiguilles d'une montre. Avec 12 graines ou plus, on saute le trou de départ.")}</li>
            <li>{t("Si la dernière graine tombe chez l'autre et fait 2 ou 3, tu les prends, et aussi les trous juste avant chez lui qui ont 2 ou 3.")}</li>
            <li>{t("On ne prend pas tout : un coup qui viderait toute la rangée de l'autre ne prend rien.")}</li>
            <li>{t("Si l'autre n'a plus de graines, tu dois lui en donner si tu peux.")}</li>
            <li>{t('Le premier à 25 graines gagne ; si plus personne ne peut jouer, chacun garde ce qui est de son côté.')}</li>
          </ul>
        )}
      </div>
    </div>
  )
}
