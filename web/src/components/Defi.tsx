import { useEffect, useState } from 'react'
import { ShoppingCart, Trophy, Waves, Coffee, type LucideIcon } from 'lucide-react'
import { api } from '../lib/api'
import { haptic } from '../lib/native'
import type { ActionResult } from '../lib/types'
import { IconTile } from './ui'
import { ChallengeButton } from './SharedCard'
import { TeaDefi } from './defi/Tea'
import { CoursesDefi } from './defi/Courses'
import { SkiDefi } from './defi/Ski'

// Les défis: while making tea at the grin, water-skiing off Île Boulay or doing
// the shopping, the player can take it on as a little game with an action
// button (components/defi/*). How it's played first, the game, then the score
// out of 100 and what it earned (backend sims/defi.go: once each time, a small
// bonus, the best score kept as a record to beat).

export type DefiKind = 'the' | 'ski' | 'courses'

/** The défi of an activity (backend sims/defi.go defiFor says the same), or null. The pousse-pousse's tea is served: no défi. */
export const defiOf = (interactionId?: string): DefiKind | null => ({ 'street-grin': 'the', 'chat-grin': 'the', 'ski-boulay': 'ski', supermarche: 'courses', courses: 'courses' } as Record<string, DefiKind>)[interactionId ?? ''] ?? null

const DEFIS: Record<DefiKind, { title: string; button: string; icon: LucideIcon; colors: [string, string]; how: string[]; bg: string }> = {
  the: {
    title: 'Le thé du grin',
    button: 'Défi : fais le thé',
    icon: Coffee,
    colors: ['#ff9a3c', '#c8641e'],
    how: ['Garde le doigt sur « Verser » : le thé coule, et la main lève la théière.', "Versé de haut, ça mousse… mais trop haut, ça éclabousse. Lâche, et reverse.", 'Remplis jusqu\'au trait et sers. Trois verres, comme au grin.'],
    bg: 'linear-gradient(#141735, #2a1c2c)',
  },
  ski: {
    title: 'Le slalom de Boulay',
    button: 'Défi : le slalom',
    icon: Waves,
    colors: ['#3ba7ff', '#1c6fd6'],
    how: ['Tiens ◀ ou ▶ pour te déporter derrière le bateau.', "Passe chaque bouée par l'extérieur.", 'Aux tremplins : reviens au milieu et touche « Sauter » juste avant.'],
    bg: 'transparent',
  },
  courses: {
    title: 'La liste de courses',
    button: 'Défi : la liste',
    icon: ShoppingCart,
    colors: ['#00b86b', '#00894f'],
    how: ['Les rayons défilent : touche ce qui est sur ta liste pour le mettre au panier.', "Pas d'achat en trop : chaque erreur coûte 2 secondes.", 'Tout trouvé, et vite : tu économises sur tes courses.'],
    bg: 'linear-gradient(#1b1f4b, #0f1230)',
  },
}

/** The défi to take on during the activity: a gold button under its card. */
export function DefiButton({ kind, onClick }: { kind: DefiKind; onClick: () => void }) {
  return (
    <button className="btn animate-pop mt-2 w-full !bg-[#ffc233] !py-2.5 !text-sm !text-[#16161c] shadow-[0_4px_0_#e09a00]" onClick={onClick}>
      <Trophy size={17} strokeWidth={2.6} /> {DEFIS[kind].button}
    </button>
  )
}

const stars = (score: number) => (score >= 85 ? 3 : score >= 50 ? 2 : score >= 15 ? 1 : 0)

/** The défi: how it's played, the game, the score and what it earned. */
export function DefiSheet({ kind, simId, big, send, challenge, onClose }: { kind: DefiKind; simId: string; /** The shopping at the supermarket: the longer list. */ big?: boolean; /** The score sent: the server's answer (applied to the Sim), or null if it failed. */ send?: (score: number) => Promise<ActionResult | null>; /** Taken on from someone's score (a message, a link): played for the fun of it, nothing sent. */ challenge?: { score: number; from: string }; onClose: () => void }) {
  const d = DEFIS[kind]
  const [phase, setPhase] = useState<'intro' | 'play' | 'result'>('intro')
  const [best, setBest] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [said, setSaid] = useState<string | null>(null)
  useEffect(() => {
    void api
      .defis(simId)
      .then((r) => setBest(r.best[kind] ?? 0))
      .catch(() => setBest(0))
  }, [simId, kind])
  const end = async (s: number) => {
    if (s >= 50) haptic('success')
    setScore(s)
    setPhase('result')
    if (challenge) return setSaid(s > challenge.score ? `Tu as battu ${challenge.from} (${challenge.score}) ! Renvoie-lui ton score.` : s === challenge.score ? `Égalité avec ${challenge.from} : ${s} partout !` : `${challenge.from} reste devant avec ${challenge.score}. Retente !`)
    const r = await send?.(s)
    setSaid(r?.outcome.text.replace(/^Défi \d+\/100\. /, '') ?? null)
  }
  const ski = kind === 'ski'
  const n = stars(score)
  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ background: phase === 'play' || !ski ? d.bg : 'rgba(15,18,48,0.35)' }}>
      {phase === 'play' && (kind === 'the' ? <TeaDefi onEnd={(s) => void end(s)} /> : kind === 'courses' ? <CoursesDefi big={!!big} onEnd={(s) => void end(s)} /> : <SkiDefi onEnd={(s) => void end(s)} />)}
      {phase === 'intro' && (
        <div className={`flex flex-1 flex-col p-4 ${ski ? 'justify-end' : 'justify-center'}`}>
          <div className="card animate-pop mx-auto w-full max-w-[380px] p-4">
            <div className="flex items-center gap-3">
              <IconTile icon={d.icon} colors={d.colors} size={48} />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="label">Défi</div>
                <div className="font-display text-[19px] font-extrabold">{d.title}</div>
              </div>
              {!!best && (
                <span className="flex items-center gap-1 rounded-full bg-[#fff3c4] px-2.5 py-1 text-[12px] font-extrabold text-[#a06a00]">
                  <Trophy size={13} /> {best}
                </span>
              )}
            </div>
            {challenge && (
              <div className="mt-3 flex items-center gap-2 rounded-2xl bg-[#fff3c4] px-3 py-2 text-[13px] leading-snug font-extrabold text-[#7a5200]">
                <Trophy size={16} className="shrink-0" /> {challenge.from} a fait {challenge.score}/100. À toi de faire mieux !
              </div>
            )}
            <ol className="mt-3 space-y-1.5 text-[14px] leading-snug font-bold text-[var(--color-ink)]">
              {d.how.map((h, k) => (
                <li key={k} className="flex gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-canvas)] text-[11px] font-extrabold">{k + 1}</span>
                  {h}
                </li>
              ))}
            </ol>
            <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
              <button className="btn btn-soft !py-2.5 !text-sm" onClick={onClose}>
                Plus tard
              </button>
              <button className="btn !bg-[#ffc233] !py-2.5 !text-sm !text-[#16161c] shadow-[0_4px_0_#e09a00]" onClick={() => setPhase('play')}>
                <Trophy size={16} /> C'est parti !
              </button>
            </div>
          </div>
        </div>
      )}
      {phase === 'result' && (
        <div className="absolute inset-0 grid place-items-center bg-[#0f1230]/55 p-5">
          <div className="card animate-pop w-full max-w-[340px] p-5 text-center">
            <div className="label">{d.title}</div>
            <div className="mt-1 font-display text-[54px] leading-none font-extrabold">{score}</div>
            <div className="text-[13px] font-extrabold text-[var(--color-ink-soft)]">sur 100</div>
            <div className="mt-2 flex justify-center gap-1">
              {[0, 1, 2].map((k) => (
                <span key={k} className="animate-pop font-display text-[34px] leading-none" style={{ color: k < n ? '#ffc233' : '#dfe2ec', animationDelay: `${200 + k * 180}ms` }}>
                  ★
                </span>
              ))}
            </div>
            {best !== null && best > 0 && score > best && <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#fff3c4] px-3 py-1 text-[13px] font-extrabold text-[#a06a00]"><Trophy size={14} /> Nouveau record !</div>}
            <p className="mt-3 min-h-[40px] text-[14px] leading-snug font-bold text-[var(--color-ink)]">{said ?? '…'}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {challenge ? (
                <button className="btn btn-soft !py-2.5 !text-sm" onClick={() => (setSaid(null), setPhase('play'))}>
                  Rejouer
                </button>
              ) : null}
              <button className={`btn !py-2.5 ${challenge ? '' : 'col-span-2'}`} onClick={onClose}>
                Super !
              </button>
            </div>
            <ChallengeButton kind={kind} score={score} title={d.title} />
          </div>
        </div>
      )}
    </div>
  )
}
