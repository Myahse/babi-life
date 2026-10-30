import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Shield, Star, Trophy, Zap } from 'lucide-react'
import { CLUBS, foeFor, kitsFor, LEVELS, NATIONS, teamOf } from './teams'
import { keyOpen, useFeatures } from '../../../lib/features'
import { t as tr, tx } from '../../../lib/i18n'

// Babi Foot, the console's football « à la FIFA »: the hub's menu (a quick
// match, the cup, the career), and where a match is set up (the format, the two sides and
// their shirts, the difficulty, the length; the cup's draws) before the
// kick-off. The last choices are kept on the phone.

/** A draw in the cup: penalties, or played on to the golden goal. */
export type Draw = 'pens' | 'golden'
export type Setup = { size: 5 | 11; mine: string; theirs: string; level: number; length: number; draw?: Draw }

const KEY = 'babi.foot.setup'
/** The lengths offered, in seconds: shorter for the five's maracana. */
export const LENGTHS: Record<5 | 11, number[]> = { 5: [120, 240, 360], 11: [240, 360, 480] }

export function loadSetup(): Setup {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Setup | null
    if (s && (s.size === 5 || s.size === 11) && teamOf(s.mine) && teamOf(s.theirs)) return s
  } catch {
    /* nothing kept: the defaults */
  }
  return { size: 5, mine: 'babi', theirs: 'yop', level: 1, length: 1 }
}

function saveSetup(s: Setup) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* private mode: not kept */
  }
}

/** The match's rules for the engine (streetball/game.ts), from the setup: a draw settled (the cup) or not; `harder` the cup's later rounds. */
export function rulesOf(s: Setup, draw?: Draw, harder = 1) {
  const me = teamOf(s.mine)
  const them = teamOf(s.theirs)
  return { size: s.size, referee: true, switching: true, length: LENGTHS[s.size][s.length] ?? LENGTHS[s.size][1], foe: foeFor((LEVELS[s.level]?.foe ?? 1) * harder, me, them), golden: draw === 'golden', shootout: draw === 'pens' }
}

/** A shirt, in its colour (a black one outlined in light, to be seen on the pitch's green). */
export function Shirt({ color, size = 34 }: { color: string; size?: number }) {
  const sum = parseInt(color.slice(1, 3), 16) + parseInt(color.slice(3, 5), 16) + parseInt(color.slice(5, 7), 16)
  return (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      <path d="M13 4 L5 9 L2 18 L9 20 L9 37 L31 37 L31 20 L38 18 L35 9 L27 4 Q20 9 13 4 Z" fill={color} stroke={sum > 600 ? '#adb5bd' : sum < 160 ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.25)'} strokeWidth="1.5" />
    </svg>
  )
}

export function Stars({ n, size = 11 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex">
      {[0, 1, 2, 3, 4].map((k) => (
        <Star key={k} size={size} className={k < n ? 'fill-[#ffd43b] text-[#ffd43b]' : 'text-white/25'} />
      ))}
    </span>
  )
}

/** Choosing a side: clubs or nations, a row of shirts. */
function TeamPicker({ label, value, onPick, other }: { label: string; value: string; onPick: (id: string) => void; other: string }) {
  const [tab, setTab] = useState<'club' | 'nation'>(teamOf(value).kind)
  const list = tab === 'club' ? CLUBS : NATIONS
  const t = teamOf(value)
  return (
    <div className="rounded-[20px] bg-white/8 p-3 ring-1 ring-white/10">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-extrabold tracking-wide text-white/60 uppercase">{label}</span>
        <span className="ml-auto flex rounded-full bg-black/30 p-0.5 text-[11px] font-extrabold">
          {(['club', 'nation'] as const).map((k) => (
            <button key={k} className={`rounded-full px-2.5 py-1 ${tab === k ? 'bg-white text-[#0b2e1a]' : 'text-white/70'}`} onClick={() => setTab(k)}>
              {k === 'club' ? tr('Clubs') : tr('Nations')}
            </button>
          ))}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <Shirt color={t.home} />
        <div className="min-w-0">
          <div className="truncate font-display text-[18px] leading-tight font-extrabold">{t.name}</div>
          <Stars n={t.stars} />
        </div>
      </div>
      <div className="no-scrollbar -mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 pb-0.5">
        {list.map((x) => (
          <button
            key={x.id}
            disabled={x.id === other}
            className={`flex shrink-0 flex-col items-center rounded-2xl px-2 py-1.5 text-[10.5px] font-extrabold transition ${x.id === value ? 'bg-white text-[#0b2e1a]' : 'bg-black/25 text-white/85'} disabled:opacity-30`}
            onClick={() => onPick(x.id)}
          >
            <Shirt color={x.home} size={26} />
            {x.short}
          </button>
        ))}
      </div>
    </div>
  )
}

/** The hub: a quick match, the cup (one under way to take up again), the career. */
export function HubMenu({ onQuick, onCup, onCareer, cupOn, onBack }: { onQuick: () => void; onCup: () => void; onCareer?: () => void; /** A cup under way: its round. */ cupOn: string | null; onBack?: () => void }) {
  const card = 'flex w-full items-center gap-3 rounded-[22px] bg-white/10 p-4 text-left ring-1 ring-white/12 transition active:scale-[0.98]'
  // The cup and the career come with their updates (lib/features.ts).
  const feats = useFeatures()
  const cupOpen = keyOpen(feats, 'foot-coupe')
  const careerOpen = keyOpen(feats, 'foot-carriere')
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,#1f7a3f,#0b2e1a_70%)] px-4 pt-12 pb-6 text-white">
      <div className="flex items-center gap-2">
        {onBack && (
          <button className="grid h-9 w-9 place-items-center rounded-full bg-black/30" onClick={onBack} aria-label={tr('Quitter')}>
            <ChevronLeft size={20} />
          </button>
        )}
        <div>
          <div className="font-display text-[30px] leading-none font-extrabold">{tr('Babi Foot')}</div>
          <div className="text-[12.5px] font-bold text-white/65">{tr('Le foot de la console, au maracana ou au stade')}</div>
        </div>
      </div>
      <div className="mt-6 space-y-2.5">
        <button className={card} onClick={onQuick}>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#ffd43b] text-[#16161c]">
            <Zap size={24} strokeWidth={2.6} />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-[19px] leading-tight font-extrabold">{tr('Match rapide')}</span>
            <span className="block text-[12.5px] font-bold text-white/65">{tr('Deux équipes, un match : tu choisis tout.')}</span>
          </span>
        </button>
        {cupOpen && (
          <button className={card} onClick={onCup}>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#ff922b] text-[#16161c]">
              <Trophy size={24} strokeWidth={2.6} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[19px] leading-tight font-extrabold">{tr('La Coupe')}</span>
              <span className="block text-[12.5px] font-bold text-white/65">{tr('Huit équipes, élimination directe : quarts, demies, finale.')}</span>
            </span>
            {cupOn && <span className="shrink-0 rounded-full bg-[#ffd43b] px-2.5 py-1 text-[11px] font-extrabold text-[#16161c]">{cupOn}</span>}
          </button>
        )}
        {onCareer && careerOpen && (
          <button className={card} onClick={onCareer}>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#74c0fc] text-[#16161c]">
              <Shield size={24} strokeWidth={2.6} />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-[19px] leading-tight font-extrabold">{tr('Carrière')}</span>
              <span className="block text-[12.5px] font-bold text-white/65">{tr('Le club de ton quartier : le championnat, le classement, les transferts.')}</span>
            </span>
          </button>
        )}
      </div>
    </div>
  )
}

/** The match's setup: format, sides, shirts, difficulty, length (the cup: no opponent, its draws); then the kick-off. */
export function MatchSetup({ title, onPlay, onBack, cup }: { title: string; onPlay: (s: Setup) => void; onBack?: () => void; /** The cup's: the opponents are drawn; a draw settled on penalties or the golden goal. */ cup?: boolean }) {
  const [s, set] = useState<Setup>(loadSetup)
  const up = (p: Partial<Setup>) => set((o) => ({ ...o, ...p }))
  // The eleven at the stadium comes with its update (lib/features.ts): till then, the five only.
  const feats = useFeatures()
  const eleven = keyOpen(feats, 'foot11')
  useEffect(() => {
    if (!eleven && s.size === 11) set((o) => ({ ...o, size: 5 }))
  }, [eleven, s.size])
  const me = teamOf(s.mine)
  const them = teamOf(s.theirs)
  const kits = useMemo(() => kitsFor(me, them), [me, them])
  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-[12.5px] font-extrabold transition ${on ? 'bg-[#ffd43b] text-[#16161c]' : 'bg-black/25 text-white/85'}`
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,#1f7a3f,#0b2e1a_70%)] px-4 pt-12 pb-6 text-white">
      <div className="flex items-center gap-2">
        {onBack && (
          <button className="grid h-9 w-9 place-items-center rounded-full bg-black/30" onClick={onBack} aria-label={tr('Retour')}>
            <ChevronLeft size={20} />
          </button>
        )}
        <div className="font-display text-[26px] leading-tight font-extrabold">{title}</div>
      </div>
      {/* The format: the five's walled maracana or the eleven at the stadium. */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(eleven ? ([5, 11] as const) : ([5] as const)).map((n) => (
          <button key={n} className={`rounded-[18px] p-3 text-left ring-2 transition ${s.size === n ? 'bg-white/15 ring-[#ffd43b]' : 'bg-black/20 ring-transparent'}`} onClick={() => up({ size: n })}>
            <svg viewBox="0 0 60 36" className="w-full">
              <rect x="1" y="1" width="58" height="34" rx="3" fill={n === 5 ? '#2f9e44' : '#37b24d'} stroke="#fff" strokeWidth="1.2" />
              <line x1="30" y1="1" x2="30" y2="35" stroke="#fff" strokeWidth="1" />
              <circle cx="30" cy="18" r="5" fill="none" stroke="#fff" strokeWidth="1" />
              {n === 11 && (
                <>
                  <rect x="1" y="10" width="8" height="16" fill="none" stroke="#fff" strokeWidth="1" />
                  <rect x="51" y="10" width="8" height="16" fill="none" stroke="#fff" strokeWidth="1" />
                </>
              )}
            </svg>
            <div className="mt-1.5 font-display text-[16px] leading-tight font-extrabold">
              {tx('{n} contre {n}', { n })}
            </div>
            <div className="text-[11.5px] font-bold text-white/65">{n === 5 ? tr('Le maracana, entre murs') : tr('Le grand stade, avec arbitre et touches')}</div>
          </button>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {/* The cup: any side, the others drawn among its own kind (clubs or nations). */}
        <TeamPicker label={tr('Ton équipe')} value={s.mine} other={cup ? '' : s.theirs} onPick={(id) => up({ mine: id, ...(id === s.theirs ? { theirs: s.mine } : {}) })} />
        {!cup && <TeamPicker label={tr('Adversaire')} value={s.theirs} other={s.mine} onPick={(id) => up({ theirs: id })} />}
      </div>
      {/* The two shirts as they'll be on the pitch. */}
      {!cup && (
        <div className="mt-3 flex items-center justify-center gap-3 rounded-[18px] bg-black/20 py-2">
          <Shirt color={kits[0]} size={40} />
          <span className="font-display text-[18px] font-extrabold text-white/70">{tr('contre')}</span>
          <Shirt color={kits[1]} size={40} />
        </div>
      )}
      {cup && (
        <div className="mt-3">
          <div className="text-[11px] font-extrabold tracking-wide text-white/60 uppercase">{tr('En cas de match nul')}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(
              [
                ['pens', tr('Tirs au but')],
                ['golden', tr('But en or')],
              ] as const
            ).map(([k, label]) => (
              <button key={k} className={chip((s.draw ?? 'pens') === k)} onClick={() => up({ draw: k })}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3">
        <div className="text-[11px] font-extrabold tracking-wide text-white/60 uppercase">{tr('Difficulté')}</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {LEVELS.map((l, k) => (
            <button key={l.id} className={chip(s.level === k)} onClick={() => up({ level: k })}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <div className="text-[11px] font-extrabold tracking-wide text-white/60 uppercase">{tr('Durée')}</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {LENGTHS[s.size].map((sec, k) => (
            <button key={sec} className={chip(s.length === k)} onClick={() => up({ length: k })}>
              {tx('{0} min', { 0: sec / 60 })}
            </button>
          ))}
        </div>
      </div>
      <button
        className="btn mt-5 w-full !bg-[#ffd43b] !py-3 !text-[#16161c] shadow-[0_4px_0_#e09a00]"
        onClick={() => {
          saveSetup(s)
          onPlay(s)
        }}
      >
        {tr("Coup d'envoi")}
      </button>
    </div>
  )
}
