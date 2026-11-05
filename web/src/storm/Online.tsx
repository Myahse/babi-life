import { useEffect, useMemo, useState } from 'react'
import { Check, Hourglass, MapPin, Swords, Zap } from 'lucide-react'
import type { Look } from '../lib/types'
import type { PvpOther } from '../lib/api'
import { sfx } from '../lib/sfx'
import { haptic } from '../lib/native'
import { Portrait } from '../avatar/portrait'
import { StormMatch, ROSTER, ARENA_INFO, heroLook, panel, menuBtn, type Hero } from './Game'
import { VersusCanvas, type FighterLook } from './Scene'
import { NO_PAD, SPECIAL_NAME } from './engine'
import type { StormNet } from './net'
import { ARENA_IDS } from './net'
import { t as tr, tx } from '../lib/i18n'

// Adjamé Storm 4 against a player (components/pvp/play.tsx): first the select
// screen on both phones at once, each its fighter (its own Sim or one of the
// characters), the first player also the arena, each seeing the other's choice
// as it changes; once both are locked in (or the time is up) the fight, with
// the same fighters, styles and specials on both phones (storm/net.ts).

/** Seconds to choose before the current choice is locked in by itself. */
const PICK_TIME = 30

type Me = { look: Look; gender: 'femme' | 'homme'; name: string }

/** The look of a roster fighter played by someone: their own Sim for « Toi »; the other in a second outfit when both took the same character. */
function lookOf(h: Hero, who: { look: Look; gender: 'femme' | 'homme' }, other: boolean, same: boolean): FighterLook {
  const l = heroLook(h, who)
  if (!other) return l
  if (h.id === 'toi') return { ...l, seed: 9 }
  return same ? { ...l, look: { ...l.look, outfitColor: '#4dabf7', bottomColor: '#f8f9fa' } } : l
}

export default function StormOnline({ me, other, net, onOver }: { me: Me; other: PvpOther; net: StormNet; onOver: (won: boolean, gone?: boolean) => void }) {
  const [pick, setPick] = useState(net.style)
  const [arena, setArena] = useState(net.arena ?? 0)
  const [ready, setReady] = useState(false)
  // What's known of the other phone, read a few times a second.
  const [them, setThem] = useState({ style: -1, ready: false, arena: -1, there: false })
  const [left, setLeft] = useState(PICK_TIME)
  const [go, setGo] = useState<{ mine: number; theirs: number; arena: number } | null>(null)
  const versus = useMemo(() => ({ net, onOver }), [net, onOver])

  // The select screen's line: this phone's choice out, the other's in.
  useEffect(() => {
    if (go) return
    const start = performance.now()
    const t = setInterval(() => {
      net.send(NO_PAD)
      const s = { style: net.otherStyle, ready: net.otherReady, arena: net.hostArena, there: net.there }
      setThem((o) => (o.style === s.style && o.ready === s.ready && o.arena === s.arena && o.there === s.there ? o : s))
      setLeft(Math.max(0, PICK_TIME - Math.floor((performance.now() - start) / 1000)))
      if (net.gone) onOver(false, true)
    }, 120)
    return () => clearInterval(t)
  }, [net, go, onOver])

  // Time's up: the current choice, locked in.
  useEffect(() => {
    if (left === 0 && !ready) lockIn()
  })

  // Both locked in: the fight (the guest needs the host's arena, which comes with its lock).
  useEffect(() => {
    if (go || !ready || !them.ready || them.style < 0) return
    const a = net.host ? arena : net.arena
    if (a === null || a < 0) return
    sfx.bell(2)
    haptic('success')
    setGo({ mine: pick, theirs: Math.min(ROSTER.length - 1, them.style), arena: a })
  }, [go, ready, them, net, arena, pick])

  function lockIn() {
    if (ready) return
    net.style = pick
    if (net.host) net.arena = arena
    net.ready = true
    setReady(true)
    sfx.bell()
    haptic('medium')
  }

  if (go) {
    const a = ROSTER[go.mine]
    const b = ROSTER[go.theirs]
    return (
      <StormMatch
        looks={[lookOf(a, me, false, false), lookOf(b, other, true, a.id === b.id)]}
        styles={[a.style, b.style]}
        names={[me.name.toUpperCase(), other.name.toUpperCase()]}
        arena={ARENA_IDS[go.arena] ?? 'terrain'}
        level={0}
        versus={versus}
        onOver={() => undefined}
      />
    )
  }

  const hero = ROSTER[pick]
  const theirHero = them.style >= 0 ? ROSTER[them.style] : null
  const myLook = lookOf(hero, me, false, false)
  const theirLook = theirHero ? lookOf(theirHero, other, true, theirHero.id === hero.id) : null
  const shownArena = net.host ? arena : them.arena
  const ar = shownArena >= 0 ? ARENA_INFO[ARENA_IDS[shownArena] ?? 'terrain'] : null
  const choose = (k: number) => {
    if (ready) return
    sfx.tick(1 + k * 0.1)
    setPick(k)
    net.style = k
  }
  return (
    <div className={`flex h-full flex-col ${panel} text-white`} data-storm="select">
      <div className="flex items-center justify-between px-4 pt-12 pr-12">
        <div className="font-display text-[18px] leading-tight font-extrabold">{tr('Ton combattant')}</div>
        <div className={`grid h-9 w-9 place-items-center rounded-full font-display text-[16px] font-extrabold tabular-nums ring-2 ${left <= 5 && !ready ? 'animate-pulse bg-[#e03131] ring-white' : 'bg-black/40 ring-white/40'}`}>{left}</div>
      </div>
      <div className="relative min-h-0 flex-1">
        <VersusCanvas a={myLook} b={theirLook} />
        {/* The other's side: who it took, and whether it's locked in. */}
        <div className="pointer-events-none absolute top-1 right-3 flex flex-col items-end gap-1">
          <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-display text-[12px] font-extrabold ${them.ready ? 'bg-[#2f9e44]' : 'bg-black/50'}`}>
            {them.ready ? <Check size={13} /> : <Hourglass size={13} />} {them.ready ? tx('{name} est prêt·e', { name: other.name }) : tx('{name} choisit…', { name: other.name })}
          </span>
          {theirHero && <span className="rounded-full bg-black/45 px-2 py-0.5 text-[11.5px] font-extrabold text-white/85">{theirHero.id === 'toi' ? other.name : theirHero.name}</span>}
        </div>
        <div className="pointer-events-none absolute inset-x-3 bottom-1 rounded-2xl bg-black/45 px-3 py-2">
          <div className="font-display text-[18px] leading-tight font-extrabold">
            {hero.id === 'toi' ? tr('Toi') : hero.name} <span className="text-[12px] font-bold text-white/60">· {hero.from}</span>
          </div>
          <div className="text-[12.5px] leading-snug font-bold text-white/80">{hero.about}</div>
          <div className="mt-1 flex gap-3 text-[11px] font-extrabold text-[#ffd43b]">
            <span>
              {tr('Force')} {'▮'.repeat(Math.round(hero.style.pow * 5 - 2))}
            </span>
            <span>
              {tr('Vitesse')} {'▮'.repeat(Math.round(hero.style.spd * 5 - 2))}
            </span>
            <span className="flex items-center gap-0.5">
              <Zap size={11} /> {SPECIAL_NAME[hero.style.sp]}
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2 px-3 pt-2">
        {ROSTER.map((h, k) => {
          const l = heroLook(h, me)
          return (
            <button key={h.id} disabled={ready && k !== pick} className={`aspect-square overflow-hidden rounded-2xl bg-white/10 ring-2 transition ${pick === k ? 'scale-105 ring-[#ffd43b]' : 'ring-white/10'} ${ready && k !== pick ? 'opacity-30' : ''}`} onClick={() => choose(k)} aria-label={h.id === 'toi' ? tr('Toi') : h.name}>
              <Portrait look={l.look} gender={l.gender} framing="head" />
            </button>
          )
        })}
      </div>
      {/* The arena: the first player chooses it, the other sees it change. */}
      <div className="px-3 pt-2">
        {net.host ? (
          <div className="grid grid-cols-4 gap-1.5">
            {ARENA_IDS.map((id, k) => {
              const a = ARENA_INFO[id]
              return (
                <button key={id} disabled={ready} className={`rounded-xl px-1 py-1.5 text-center font-display text-[11.5px] leading-tight font-extrabold ring-2 ${arena === k ? 'ring-[#ffd43b]' : 'opacity-75 ring-transparent'}`} style={{ background: `linear-gradient(135deg, ${a.colors[0]}, ${a.colors[1]})` }} onClick={() => !ready && (sfx.tick(1.4), setArena(k), (net.arena = k))}>
                  {a.name}
                  <span className="block text-[10px] font-bold text-white/75">{a.where}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-extrabold" style={{ background: ar ? `linear-gradient(135deg, ${ar.colors[0]}, ${ar.colors[1]})` : 'rgba(255,255,255,0.1)' }}>
            <MapPin size={14} /> {ar ? `${ar.name} · ${ar.where}` : tx('{name} choisit l’arène…', { name: other.name })}
          </div>
        )}
      </div>
      <div className="px-3 pt-2 pb-[max(1rem,var(--sab,env(safe-area-inset-bottom)))]">
        <button disabled={ready} className={`${menuBtn} justify-center ${ready ? 'bg-[#2f9e44]' : 'bg-[#e03131]'}`} onClick={lockIn} data-storm="ready">
          {ready ? <Hourglass size={20} /> : <Swords size={20} />} {ready ? tx('En attente de {name}…', { name: other.name }) : tr('Prêt !')}
        </button>
      </div>
    </div>
  )
}
