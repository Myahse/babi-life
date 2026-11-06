import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Portrait } from '../avatar/portrait'
import { iconFor } from './icons'
import { IconTile, needColor } from './ui'
import { haptic } from '../lib/native'
import { sfx } from '../lib/sfx'
import { cancelMember, householdTick, selectMember, useHousehold } from '../game/household'
import { lifeState } from '../game/lifeMode'
import { clock, mood } from '../game/rules'
import type { Needs, Sim } from '../lib/types'
import { t as tr } from '../lib/i18n'

// Le mode vie: the household strip (the update « mode-vie », game/household.ts). At home with others (papa
// and maman, the partner living there), their portraits on the side, the Sim's first: a tap picks who the
// wheel's orders go to. The one picked shows its own queue at the top, in the queue's place; the others,
// the Sim included, live by their free will meanwhile. The household's beat runs here, every two seconds.

const NEED_LABEL: Record<keyof Needs, string> = { hunger: tr('a faim'), energy: tr('est fatigué·e'), hygiene: tr('veut se laver'), social: tr('veut de la compagnie'), fun: tr("s'ennuie") }

export function HouseholdStrip({ sim, stage }: { sim: Sim; stage: string }) {
  const { members, selected, needs } = useHousehold()
  // The household's beat: the members' orders and free will, never per frame.
  const minute = useRef(sim.gameMinutes)
  minute.current = sim.gameMinutes
  useEffect(() => {
    if (!members.length) return
    const t = setInterval(() => document.visibilityState === 'visible' && householdTick(Date.now(), lifeState().freeWill, clock(minute.current).hour), 2000)
    return () => clearInterval(t)
  }, [members.length])
  if (!members.length) return null
  const pick = (id: string) => {
    haptic('light')
    sfx.pop()
    selectMember(id)
  }
  const face = (on: boolean) => `pointer-events-auto relative grid h-12 w-12 place-items-center rounded-full p-[3px] transition-transform active:scale-90 ${on ? 'scale-110' : 'opacity-85'}`
  return (
    <div className="pointer-events-none absolute left-3 z-30 flex flex-col items-start gap-2 top-[max(13.25rem,calc(var(--sat,env(safe-area-inset-top))+12.75rem))] lg:left-5 lg:top-[12.5rem]">
      <span className="hud rounded-full px-2 py-0.5 text-[10px] font-extrabold text-[var(--color-ink-soft)]">{tr('Qui diriger ?')}</span>
      <button className={face(selected === 'self')} style={{ background: selected === 'self' ? 'var(--color-orange)' : needColor(mood(sim.needs)) }} onClick={() => pick('self')} aria-label={tr('Diriger {0}', { 0: sim.firstName })}>
        <span className="block h-full w-full overflow-hidden rounded-full border-2 border-white bg-gradient-to-b from-[#ffe7c7] to-[#ffb27a]">
          <Portrait look={sim.look} gender={sim.gender} framing="head" stage={stage} />
        </span>
      </button>
      {members.map((m) => {
        const n = needs[m.id]
        return (
          <button key={m.id} className={face(selected === m.id)} style={{ background: selected === m.id ? 'var(--color-orange)' : needColor(n ? mood(n) : 80) }} onClick={() => pick(m.id)} aria-label={tr('Diriger {0}', { 0: m.name })}>
            <span className="block h-full w-full overflow-hidden rounded-full border-2 border-white bg-gradient-to-b from-[#e3f1ff] to-[#9cc7ff]">
              <Portrait look={m.look} gender={m.gender} framing="head" stage="adulte" />
            </span>
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-1.5 text-[9px] leading-tight font-extrabold whitespace-nowrap text-white">{m.name}</span>
          </button>
        )
      })}
    </div>
  )
}

/** The member picked: their orders at the top, in the queue's place (a tap takes one off), and what they need most. */
export function MemberQueue() {
  const { members, selected, queues, doing, needs } = useHousehold()
  const m = members.find((x) => x.id === selected)
  if (!m) return null
  const q = queues[m.id] ?? []
  const d = doing[m.id]
  const n = needs[m.id]
  const low = n ? (Object.keys(n) as (keyof Needs)[]).sort((a, b) => n[a] - n[b])[0] : null
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[max(8.25rem,calc(var(--sat,env(safe-area-inset-top))+7.75rem))] z-30 flex flex-col items-center gap-1 px-3 lg:top-[7.5rem]">
      <div className="hud pointer-events-auto flex max-w-full items-center gap-1.5 rounded-full p-1.5 pr-2">
        <span className="grid h-11 shrink-0 place-items-center rounded-full bg-[var(--color-orange)] px-2.5 text-[11px] leading-tight font-extrabold text-white">{m.name}</span>
        {q.length === 0 && <span className="px-1 text-[12px] font-extrabold text-[var(--color-ink-soft)]">{tr('Touche un objet : {0} y va', { 0: m.name })}</span>}
        {q.map((o) => (
          <button key={o.key} className="animate-pop relative grid h-11 w-11 shrink-0 place-items-center active:scale-90" onClick={() => (haptic('light'), cancelMember(m.id, o.key))} aria-label={tr('Annuler : {0}', { 0: o.label })}>
            <IconTile icon={iconFor(o.icon)} colors={o.colors} size={o.key === d?.key ? 38 : 34} radius={19} style={{ boxShadow: o.free ? '0 0 0 2px #ffffff, 0 0 0 4px rgba(255,255,255,0.35)' : '0 0 0 2px #ffffff' }} />
            {o.key === d?.key && <span className="absolute inset-0 animate-spin rounded-full border-[2.5px] border-transparent border-t-[var(--color-orange)] [animation-duration:1.6s]" />}
            <span className="absolute -top-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/70 text-white">
              <X size={10} strokeWidth={3.2} />
            </span>
          </button>
        ))}
      </div>
      {n && low && n[low] < 50 && <span className="hud rounded-full px-2.5 py-0.5 text-[11px] font-extrabold">{`${m.name} ${NEED_LABEL[low]}`}</span>}
    </div>
  )
}
