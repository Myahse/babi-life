import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { PvpButton } from '../components/pvp/PvpButton'
import { ChevronDown, RotateCcw } from 'lucide-react'
import type { Sim } from '../lib/types'
import { legal, move, newAwale, think, winner, type Awale } from '../game/awale'
import { AwaleBoard, type AwaleMove } from '../components/table/AwaleBoard'
import { tableMood } from '../components/table/Faces'
import { sfx } from '../lib/sfx'
import { reactToResult } from '../avatar/expressions'
import { t } from '../lib/i18n'

const TableFaces = lazy(() => import('../components/table/Faces'))

// Awalé 225 on the phone: the board of the old men under the tree, against
// the computer at three levels (how far it looks ahead). For nothing: no
// stake, the pleasure of the game. The rules: game/awale.ts. The board
// (components/table/AwaleBoard.tsx) sows seed by seed; the one across the
// table is seen (components/table/Faces.tsx): it thinks, its hand hovers over
// a hole or two before it picks, it smiles when it takes and sulks when taken.

const WOOD = 'linear-gradient(160deg,#9c6b3a,#4a2a12)'
const LEVELS = [
  { id: 2, label: t('Débutant'), who: t('Petit Yao'), gender: 'homme' as const, slow: 500 },
  { id: 4, label: t('Habitué'), who: t('Tantie Aya'), gender: 'femme' as const, slow: 800 },
  { id: 6, label: t('Vieux du grin'), who: t('Le vieux Kouamé'), gender: 'homme' as const, slow: 1200 },
]

const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms))

export function AwaleApp({ sim }: { sim: Sim }) {
  const [level, setLevel] = useState(LEVELS[1])
  const [game, setGame] = useState<Awale>(() => newAwale(0))
  // The move being sown (the board plays it out), and a new board for each game.
  const [sown, setSown] = useState<AwaleMove | null>(null)
  const [round, setRound] = useState(0)
  const [sowing, setSowing] = useState(false)
  // The hole the other's hand hovers over while it chooses.
  const [hint, setHint] = useState<number | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const [rules, setRules] = useState(false)
  const keyRef = useRef(0)
  const roundRef = useRef(0)
  const them = `awale-${level.id}`

  /** A move: the board sows it, the game is already the one after. */
  const sow = (g: Awale, from: number) => {
    setSaid(null)
    setSowing(true)
    setSown({ before: g, from, key: ++keyRef.current })
    setGame(move(g, from))
  }
  /** The other's turn: it thinks (its face, its hand going over a hole or two), then sows. */
  const computer = async (g: Awale) => {
    const r = roundRef.current
    tableMood(them, 'think', level.slow + 1500)
    await wait(350)
    const pick = think(g, level.id)
    const options = legal(g)
    // A hesitation or two over other holes, as a hand does, then the one it picks.
    const tries = options.length > 1 ? Math.min(2, Math.floor(Math.random() * 3)) : 0
    for (let k = 0; k < tries; k++) {
      setHint(options[Math.floor(Math.random() * options.length)])
      await wait(level.slow * 0.45 + Math.random() * 200)
      if (r !== roundRef.current) return
    }
    setHint(pick)
    await wait(level.slow * 0.5)
    if (r !== roundRef.current) return
    setHint(null)
    sow(g, pick)
  }
  const onSown = (_key: number, taken: number) => {
    const mover = sown?.before.turn ?? 0
    if (taken) {
      setSaid(t('{0} {taken} graine{1} !', { 0: mover === 0 ? t('Tu prends') : `${level.who} prend`, taken, 1: taken > 1 ? 's' : '' }))
      tableMood(them, mover === 1 ? (taken >= 4 ? 'great' : 'good') : taken >= 4 ? 'surprised' : 'bad')
    }
    setSowing(false)
    if (game.over) {
      const w = winner(game)
      tableMood(them, w === 1 ? 'won' : w === 0 ? 'lost' : 'calm', 6000)
      if (w === 0) sfx.win()
      else if (w === 1) sfx.lose()
      reactToResult('me', w === 0 ? 'won' : w === 1 ? 'lost' : 'ok')
    } else if (game.turn === 1) void computer(game)
  }
  const tap = (i: number) => {
    if (sowing || game.turn !== 0 || !legal(game).includes(i)) return
    sow(game, i)
  }
  const restart = () => {
    roundRef.current++
    setRound((n) => n + 1)
    setSown(null)
    setSowing(false)
    setHint(null)
    setSaid(null)
    setGame(newAwale(0))
  }
  useEffect(() => () => void roundRef.current++, [])
  const can = !sowing && game.turn === 0 ? legal(game) : []
  const w = game.over && !sowing ? winner(game) : null

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

        {/* The one across the board */}
        <Suspense fallback={<div className="h-[84px]" />}>
          <TableFaces people={[{ id: them, name: level.who, gender: level.gender }]} playing={game.turn === 1 && !game.over ? them : null} height={84} className="-mb-2" />
        </Suspense>
        <AwaleBoard key={`board-${round}`} game={game} move={sown} bottom={0} can={can} hint={hint} topName={level.who} bottomName={`${sim.firstName} ${t('(toi)')}`} onTap={tap} onSown={onSown} />

        <p key={`said-${said ?? game.turn}`} className="animate-pop mt-3 min-h-[20px] text-center text-sm font-extrabold text-[var(--color-ink)]">
          {w !== null ? (w === 0 ? t('Tu as gagné, {0} à {1} !', { 0: game.store[0], 1: game.store[1] }) : w === 1 ? t('{who} gagne, {0} à {1}.', { who: level.who, 0: game.store[1], 1: game.store[0] }) : t('Match nul, 24 partout.')) : (said ?? (sowing ? '…' : game.turn === 0 ? t('À toi : touche un trou de ta rangée.') : t('{who} réfléchit…', { who: level.who })))}
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
