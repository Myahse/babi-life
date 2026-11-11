import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Banknote, Briefcase, Eye, House, School, Star, Trophy, Users, X } from 'lucide-react'
import { api } from '../lib/api'
import { sfx } from '../lib/sfx'
import { haptic } from '../lib/native'
import { iconFor } from './icons'
import { IconTile } from './ui'
import { amount, clock, duration, lifeOf, weekdayOf } from '../game/rules'
import { setExpression } from '../avatar/expressions'
import type { ActionResult, Furniture, Sim, World, WorkDay, WorkEvent, WorkStyle } from '../lib/types'
import { useLife, type PieOption } from '../game/lifeMode'
import { t as tr } from '../lib/i18n'

// Le mode vie's lived work day, on screen (the update « mode-vie », backend sims/boulot.go): the work card
// while the Sim is out at work or at school (the day's progress, the performance or the school grade, how
// it works now, the shift's event and its two answers, the colleagues, the job's tasks), the moment it's
// time to go (the ride is coming: « Y aller », « Pas aujourd'hui », or off by itself with free will), and
// back home the day's summary (the pay counted up, the performance moved, the mood) with, when it comes,
// the promotion's moment (the new title, the raise, the mood, the wish fulfilled). The server decides all.

const WORK: [string, string] = ['#74c0fc', '#1c7ed6']
const SCHOOL: [string, string] = ['#ffd43b', '#f08c00']
const GOOD = '#2f9e44'
const BAD = '#e03131'

/** The styles and events, read once (backend GET /boulot). */
type Info = { styles: WorkStyle[]; schoolStyles: WorkStyle[]; events: WorkEvent[]; schoolEvents: WorkEvent[] }
let info: Info | null = null
let asked: Promise<Info | null> | null = null
function useWorkInfo() {
  const [v, setV] = useState(info)
  useEffect(() => {
    if (info) return
    const p = (asked ??= api
      .workInfo()
      .then((r) => (info = r))
      .catch(() => ((asked = null), null)))
    let on = true
    p.then((r) => on && setV(r))
    return () => void (on = false)
  }, [])
  return v
}

/** The school grade's letter (backend game.Grade). */
export const gradeOf = (g: number) => (g >= 85 ? 'A' : g >= 70 ? 'B' : g >= 50 ? 'C' : g >= 30 ? 'D' : 'F')

/** The performance a full shift in each style brings (backend game/boulot.go): the arrows by each. */
const trend = (perf: number) => (perf >= 3 ? 2 : perf > 0 ? 1 : perf < 0 ? -1 : 0)

function Trend({ n }: { n: number }) {
  if (!n) return <span className="text-[10px] font-extrabold text-black/40">=</span>
  const Up = n > 0 ? ArrowUp : ArrowDown
  return (
    <span className="flex" style={{ color: n > 0 ? GOOD : BAD }}>
      {[...Array(Math.abs(n))].map((_, i) => (
        <Up key={i} size={11} strokeWidth={3.4} className={i ? '-ml-1.5' : ''} />
      ))}
    </span>
  )
}

function Bar({ value, color, ghost }: { value: number; color: string; ghost?: number }) {
  return (
    <span className="relative block h-2 overflow-hidden rounded-full bg-black/10">
      {ghost !== undefined && <span className="absolute inset-y-0 left-0 rounded-full opacity-35" style={{ width: `${Math.max(0, Math.min(1, ghost)) * 100}%`, background: color }} />}
      <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </span>
  )
}

/**
 * The card while the Sim is out (an activity with a Shift): its place, the time left, the performance
 * (the next promotion's bar) or the grade, the four ways of working (the one now lit; a tap changes it,
 * at once on screen and on the server), the event when it comes (two answers), the colleagues.
 */
export function WorkCard({ sim, world, onResult, tasks, following, onFollow }: { sim: Sim; world: World; onResult: (res: ActionResult) => void; /** The job's tasks (Play's JobTasks), under a button. */ tasks?: ReactNode; following: boolean; onFollow: () => void }) {
  const a = sim.activity
  const sh = a?.shift
  const data = useWorkInfo()
  const [style, setStyle] = useState(sh?.style ?? 'normal')
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const [open, setOpen] = useState(true)
  const [showTasks, setShowTasks] = useState(false)
  useEffect(() => setStyle(sh?.style ?? 'normal'), [sh?.style])
  const school = !!sh?.school
  const due = !!sh?.event && sh.choice < 0 && sim.gameMinutes >= (sh.eventAt ?? Infinity)
  // The event come: a bell and a buzz, the card opened.
  useEffect(() => {
    if (!due) return
    sfx.bell(2)
    haptic('medium')
    setOpen(true)
    setExpression('me', 'surprised', 2500)
  }, [due])
  if (!a || !sh) return null
  const career = world.careers.find((c) => c.id === sim.career)
  const styles = (school ? data?.schoolStyles : data?.styles) ?? []
  const ev = due ? (school ? data?.schoolEvents : data?.events)?.find((e) => e.id === sh.event) : undefined
  const left = Math.max(0, a.end - sim.gameMinutes)
  const done = Math.min(1, Math.max(0, (sim.gameMinutes - a.start) / Math.max(1, a.end - a.start)))
  const need = (sim.careerLevel + 1) * 10
  const grade = sim.life?.work?.grade || 50
  const people = (school ? sim.life?.work?.classmates : sim.life?.work?.colleagues) ?? []
  const colors = school ? SCHOOL : WORK
  const pick = async (id: string) => {
    if (busy || id === style) return
    const was = style
    setStyle(id)
    haptic('light')
    sfx.pop()
    setExpression('me', id === 'dur' ? 'focused' : id === 'collegues' ? 'laugh' : id === 'minimum' ? 'calm' : 'smile', 2500)
    setBusy(true)
    try {
      onResult(await api.workStyle(sim.id, id))
    } catch {
      setStyle(was)
    } finally {
      setBusy(false)
    }
  }
  const answer = async (i: number) => {
    if (busy) return
    setBusy(true)
    haptic('light')
    try {
      const res = await api.workChoice(sim.id, i)
      onResult(res)
      setSaid(res.outcome?.text ?? null)
      setExpression('me', /bafouill|Mauvaise|crie|Trou noir|froide|moue/.test(res.outcome?.text ?? '') ? 'disappointed' : 'proud', 3000)
      setTimeout(() => setSaid(null), 5000)
    } catch {
      // (Already answered elsewhere: the next refresh says so.)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="pointer-events-auto absolute right-[76px] bottom-[max(0.75rem,var(--sab,env(safe-area-inset-bottom)))] left-3 z-30 mx-auto max-w-[440px] sm:right-auto sm:left-1/2 sm:w-[440px] sm:-translate-x-1/2">
      {ev && (
        <div className="animate-pop mb-2 rounded-3xl bg-white p-3 shadow-xl ring-4 ring-[#ffd43b]">
          <div className="flex items-start gap-2.5">
            <IconTile icon={iconFor(ev.icon)} colors={SCHOOL} size={38} radius={13} />
            <p className="flex-1 pt-0.5 font-display text-[15px] leading-snug font-extrabold">{ev.text}</p>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {ev.choices.map((c, i) => (
              <button key={i} disabled={busy} className="flex min-h-12 items-center justify-center gap-1.5 rounded-2xl px-2 py-2 text-[13px] leading-tight font-extrabold text-white shadow active:scale-95 disabled:opacity-60" style={{ background: i ? '#7a8099' : colors[1] }} onClick={() => answer(i)}>
                {(() => {
                  const I = iconFor(c.icon)
                  return <I size={16} strokeWidth={2.6} className="shrink-0" />
                })()}
                <span>
                  {c.label}
                  {c.skill && <span className="block text-[10px] font-bold opacity-80">{tr('Selon ta compétence')}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {said && <div className="animate-pop mb-2 rounded-2xl bg-white px-3 py-2 text-[13px] font-bold shadow-lg">{said}</div>}
      <div className="hud rounded-3xl p-2.5">
        <button className="flex w-full items-center gap-2 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <IconTile icon={school ? School : iconFor(career?.icon ?? 'briefcase')} colors={colors} size={34} radius={12} />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[13px] font-extrabold">{school ? tr("À l'école") : tr('Au travail · {0}', { 0: career?.levels[sim.careerLevel]?.title ?? '' })}</span>
            <span className="block text-[11px] font-bold text-black/55">{tr('Encore {0}', { 0: duration(left) })}</span>
          </span>
          <span className="w-24 shrink-0">
            <Bar value={done} color={colors[1]} />
          </span>
        </button>
        {open && (
          <>
            <div className="mt-2 flex items-center gap-2 px-0.5">
              {school ? (
                <>
                  <span className="text-[11px] font-extrabold text-black/60">{tr('Performance scolaire')}</span>
                  <span className="grid h-6 w-6 place-items-center rounded-lg text-[13px] font-extrabold text-white" style={{ background: grade >= 70 ? GOOD : grade >= 50 ? '#f08c00' : BAD }}>
                    {gradeOf(grade)}
                  </span>
                  <span className="flex-1">
                    <Bar value={grade / 100} color={grade >= 70 ? GOOD : grade >= 50 ? '#f08c00' : BAD} />
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[11px] font-extrabold text-black/60">{tr('Performance')}</span>
                  <span className="flex-1">
                    <Bar value={sim.performance / need} color={GOOD} />
                  </span>
                  <span className="tnum text-[11px] font-extrabold text-black/60">
                    {sim.performance}/{need}
                  </span>
                </>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {styles.map((s) => {
                const I = iconFor(s.icon)
                const on = s.id === style
                return (
                  <button key={s.id} disabled={busy && !on} className={`flex min-h-11 items-center gap-1.5 rounded-2xl px-2 py-1.5 text-left transition active:scale-95 ${on ? 'text-white shadow' : 'bg-white/70 text-black'}`} style={on ? { background: colors[1] } : undefined} onClick={() => pick(s.id)} aria-pressed={on} title={s.hint}>
                    <I size={16} strokeWidth={2.6} className="shrink-0" />
                    <span className="min-w-0 flex-1 text-[12px] leading-tight font-extrabold">{s.label}</span>
                    {!on && <Trend n={trend(s.perf)} />}
                  </button>
                )
              })}
            </div>
            <p className="mt-1.5 px-1 text-[11px] font-bold text-black/55">{styles.find((s) => s.id === style)?.hint}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {people.map((p) => (
                <span key={p.name} className="flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 text-[11px] font-extrabold">
                  <Users size={11} strokeWidth={3} className="text-black/45" /> {p.name}
                  <span className="h-1.5 w-8 overflow-hidden rounded-full bg-black/10">
                    <span className="block h-full rounded-full bg-[#ff8fb1]" style={{ width: `${p.friendship}%` }} />
                  </span>
                </span>
              ))}
              <span className="flex-1" />
              {tasks && (
                <button className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-extrabold active:scale-95" onClick={() => setShowTasks((v) => !v)}>
                  <Briefcase size={11} strokeWidth={3} className="mr-1 inline" />
                  {tr('Tâches')}
                </button>
              )}
              <button className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-extrabold active:scale-95" onClick={onFollow}>
                {following ? <House size={11} strokeWidth={3} className="mr-1 inline" /> : <Eye size={11} strokeWidth={3} className="mr-1 inline" />}
                {following ? tr('Voir la maison') : school ? tr("Suivre à l'école") : tr('Suivre au travail')}
              </button>
            </div>
            {showTasks && tasks && <div className="mt-2">{tasks}</div>}
          </>
        )}
      </div>
    </div>
  )
}

/** The game day of a game minute. */
const dayOf = (m: number) => Math.floor(m / (24 * 60))
const skipKey = (id: string) => `babi.boulot.skip.${id}`
function skipped(id: string) {
  try {
    return Number(localStorage.getItem(skipKey(id)) ?? -1)
  } catch {
    return -1
  }
}

/**
 * Time to go now (at home, nothing being done): to work in the shift's hours, a child to school (7 to 9 on
 * a weekday); not gone yet today, nor put off (« Pas aujourd'hui »). Free will waits meanwhile (Play).
 */
export function timeToGo(sim: Sim, world: World): 'work' | 'school' | null {
  if (sim.activity) return null
  const h = clock(sim.gameMinutes).hour
  const day = dayOf(sim.gameMinutes)
  if (dayOf(sim.life?.work?.last?.at ?? -1e9) === day || skipped(sim.id) === day) return null
  const career = world.careers.find((c) => c.id === sim.career)
  const st = lifeOf(world, sim).stage?.id ?? 'adulte'
  if ((st === 'enfant' || st === 'ado') && weekdayOf(sim.gameMinutes) < 5 && h >= 7 && h < 9) return 'school'
  if (career && h >= career.minHour && h < career.maxHour) return 'work'
  return null
}

/**
 * Time to go: « Y aller », or « Pas aujourd'hui »; with free will on, off by itself after a few seconds
 * (the ride doesn't wait). onGo starts it (the server says no if it's not the time: then not again today).
 */
export function TimeToGo({ sim, world, onGo }: { sim: Sim; world: World; onGo: (school: boolean) => Promise<boolean> }) {
  const { freeWill } = useLife()
  const [, setTick] = useState(0)
  const [count, setCount] = useState<number | null>(null)
  const [going, setGoing] = useState(false)
  const now = timeToGo(sim, world)
  const school = now === 'school'
  const show = !!now && !going
  const skipToday = () => {
    try {
      localStorage.setItem(skipKey(sim.id), String(dayOf(sim.gameMinutes)))
    } catch {
      // (No storage: asked again on the next page.)
    }
    setTick((n) => n + 1)
  }
  const go = async () => {
    setGoing(true)
    haptic('light')
    const ok = await onGo(school)
    if (!ok) skipToday()
    setGoing(false)
  }
  // With free will: a few seconds' count, then off.
  useEffect(() => {
    if (!show || !freeWill) return setCount(null)
    setCount(8)
    const t = setInterval(() => setCount((n) => (n === null ? null : n - 1)), 1000)
    return () => clearInterval(t)
  }, [show, freeWill])
  useEffect(() => {
    if (count === 0) void go()
  }, [count]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!show) return null
  return (
    <div className="animate-pop pointer-events-auto absolute bottom-[calc(max(0.75rem,var(--sab,env(safe-area-inset-bottom)))+5.5rem+var(--hud-lift,0px))] left-3 right-[76px] z-30 mx-auto flex max-w-[420px] items-center gap-2 rounded-3xl bg-white p-2.5 shadow-xl ring-4 ring-[#74c0fc]">
      <IconTile icon={school ? School : Briefcase} colors={school ? SCHOOL : WORK} size={38} radius={13} />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[13px] font-extrabold">{school ? tr("C'est l'heure de l'école !") : tr("C'est l'heure du travail !")}</span>
        <span className="block text-[11px] font-bold text-black/55">{count !== null ? tr('Départ dans {0} s', { 0: Math.max(0, count) }) : school ? tr('Le car de l’école arrive') : tr('Ton transport arrive')}</span>
      </span>
      <button className="rounded-2xl px-3 py-2.5 text-[13px] font-extrabold text-white shadow active:scale-95" style={{ background: WORK[1] }} onClick={go} disabled={going}>
        {tr('Y aller')}
      </button>
      <button className="grid h-10 w-10 place-items-center rounded-2xl bg-black/5 active:scale-95" onClick={skipToday} aria-label={tr("Pas aujourd'hui")} title={tr("Pas aujourd'hui")}>
        <X size={18} strokeWidth={2.8} />
      </button>
    </div>
  )
}

/** The summary of the day last told (this browser): shown once. */
const seenKey = (id: string) => `babi.boulot.vu.${id}`
function seenAt(id: string) {
  try {
    return Number(localStorage.getItem(seenKey(id)) ?? 0)
  } catch {
    return 0
  }
}

/** The day not told yet (back from work or school), if any. */
export function unseenDay(sim: Sim): WorkDay | null {
  const last = sim.life?.work?.last
  return last && last.at > seenAt(sim.id) && !sim.activity?.shift ? last : null
}

/** The pay counted up to its sum, once. */
function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const t0 = performance.now()
    let raf = 0
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 900)
      setV(Math.round(to * (1 - (1 - k) * (1 - k))))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to])
  return <>{amount(v)}</>
}

const BLOCKS = [...Array(14)].map((_, i) => ({ x: Math.cos(i * 2.1) * (90 + (i % 4) * 30), y: Math.sin(i * 2.1) * (70 + (i % 3) * 30) - 20, s: 8 + (i % 3) * 4, c: ['#ffd43b', '#74c0fc', '#69db7c', '#ff8fb1', '#ffa94d'][i % 5], d: (i % 5) * 40 }))

/**
 * Back home: the day's summary (the pay counted up, a bonus, the performance moved on its bar or the
 * grade, the mood it left, what came of the event); a promotion first, big: the new title, the raise,
 * the mood, the wish fulfilled, blocks flying, the Sim cheering.
 */
export function BackHome({ sim, world, day, onClose }: { sim: Sim; world: World; day: WorkDay; onClose: () => void }) {
  const [promo, setPromo] = useState(!!day.promo)
  const closed = useRef(false)
  useEffect(() => {
    if (day.promo) {
      sfx.win(true)
      haptic('success')
      setExpression('me', 'cheer', 5000)
    } else {
      if (day.pay > 0) sfx.coins(4)
      haptic('light')
      setExpression('me', day.perf < 0 ? 'tired' : 'smile', 3500)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => {
    if (closed.current) return
    closed.current = true
    try {
      localStorage.setItem(seenKey(sim.id), String(day.at))
    } catch {
      // (No storage: told again next time.)
    }
    onClose()
  }
  if (promo && day.promo) {
    const p = day.promo
    return (
      <div className="pointer-events-auto absolute inset-0 z-[47] grid place-items-center bg-black/35 px-4" onClick={() => setPromo(false)}>
        <div className="relative w-full max-w-[360px]">
          {BLOCKS.map((k, i) => (
            <span key={i} className="animate-wish-block absolute top-1/2 left-1/2 rounded-[3px]" style={{ width: k.s, height: k.s, background: k.c, boxShadow: 'inset -2px -2px 0 rgba(0,0,0,0.22), inset 2px 2px 0 rgba(255,255,255,0.35)', ['--x' as string]: `${k.x}px`, ['--y' as string]: `${k.y}px`, animationDelay: `${150 + k.d}ms` }} />
          ))}
          <div className="animate-pop rounded-[28px] bg-white p-4 text-center shadow-2xl ring-4 ring-[#ffd43b]">
            <div className="flex justify-center">
              <IconTile icon={Trophy} colors={SCHOOL} size={56} radius={18} />
            </div>
            <p className="mt-2 text-[12px] font-extrabold tracking-wide text-[#c06a00] uppercase">{tr('Promotion !')}</p>
            <p className="font-display text-[22px] leading-tight font-extrabold">{p.title}</p>
            <p className="mt-0.5 text-[12px] font-bold text-black/50">{tr('Avant : {0}', { 0: p.from })}</p>
            <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-[#ebfbee] px-3 py-2">
              <Banknote size={18} strokeWidth={2.6} style={{ color: GOOD }} />
              <span className="tnum text-[15px] font-extrabold" style={{ color: GOOD }}>
                {tr('{0} F par service', { 0: amount(p.pay) })}
              </span>
              <span className="tnum text-[12px] font-extrabold text-black/45">(+{amount(p.pay - p.was)})</span>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              <span className="rounded-full bg-[#ebfbee] px-2.5 py-1 text-[12px] font-extrabold" style={{ color: GOOD }}>
                {tr('Promu·e !')} +3
              </span>
              {p.wish && (
                <span className="flex items-center gap-1 rounded-full bg-[#fff9db] px-2.5 py-1 text-[12px] font-extrabold text-[#c06a00]">
                  <Star size={12} strokeWidth={3} fill="#ff9800" /> {tr('Envie réalisée : Obtenir une promotion')}
                </span>
              )}
            </div>
            <button className="mt-3 w-full rounded-2xl py-3 text-[15px] font-extrabold text-white shadow active:scale-95" style={{ background: SCHOOL[1] }} onClick={() => setPromo(false)}>
              {tr('Génial !')}
            </button>
          </div>
        </div>
      </div>
    )
  }
  const career = world.careers.find((c) => c.id === sim.career)
  const need = day.need || 1
  return (
    <div className="animate-pop pointer-events-auto absolute right-[76px] bottom-[calc(max(0.75rem,var(--sab,env(safe-area-inset-bottom)))+5.5rem+var(--hud-lift,0px))] left-3 z-30 mx-auto max-w-[420px] rounded-3xl bg-white p-3 shadow-xl ring-4" style={{ ['--tw-ring-color' as string]: day.school ? '#ffd43b' : '#74c0fc' }}>
      <div className="flex items-center gap-2.5">
        <IconTile icon={day.school ? School : iconFor(career?.icon ?? 'briefcase')} colors={day.school ? SCHOOL : WORK} size={38} radius={13} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[11px] font-extrabold tracking-wide text-black/45 uppercase">{day.school ? tr("De retour de l'école") : tr('De retour du travail')}</span>
          <span className="block truncate font-display text-[16px] font-extrabold">{day.place ?? ''}</span>
        </span>
        <button className="grid h-9 w-9 place-items-center rounded-2xl bg-black/5 active:scale-95" onClick={close} aria-label={tr('Fermer')}>
          <X size={17} strokeWidth={2.8} />
        </button>
      </div>
      {!day.school && (
        <div className="mt-2.5 flex items-center gap-2 rounded-2xl bg-[#ebfbee] px-3 py-2">
          <Banknote size={18} strokeWidth={2.6} style={{ color: GOOD }} />
          <span className="tnum flex-1 text-[16px] font-extrabold" style={{ color: GOOD }}>
            +<CountUp to={day.pay} /> F
          </span>
          {!!day.bonus && (
            <span className="tnum text-[12px] font-extrabold" style={{ color: GOOD }}>
              {tr('Prime +{0} F', { 0: amount(day.bonus) })}
            </span>
          )}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 px-0.5">
        {day.school ? (
          <>
            <span className="text-[12px] font-extrabold text-black/60">{tr('Performance scolaire')}</span>
            <span className="grid h-6 w-6 place-items-center rounded-lg text-[13px] font-extrabold text-white" style={{ background: (day.grade ?? 50) >= 70 ? GOOD : (day.grade ?? 50) >= 50 ? '#f08c00' : BAD }}>
              {gradeOf(day.grade ?? 50)}
            </span>
            <span className="flex-1">
              <Bar value={(day.grade ?? 50) / 100} ghost={(day.gradeWas ?? 50) / 100} color={(day.grade ?? 50) >= (day.gradeWas ?? 50) ? GOOD : BAD} />
            </span>
          </>
        ) : (
          <>
            <span className="text-[12px] font-extrabold text-black/60">{tr('Performance')}</span>
            <span className="flex-1">
              <Bar value={day.promo ? 0 : day.now / need} ghost={day.promo ? undefined : (day.now - day.perf) / need} color={day.perf >= 0 ? GOOD : BAD} />
            </span>
          </>
        )}
        <span className="tnum text-[12px] font-extrabold" style={{ color: day.perf >= 0 ? GOOD : BAD }}>
          {day.perf > 0 ? '+' : ''}
          {day.perf}
        </span>
      </div>
      {day.moodLabel && (
        <p className="mt-2 inline-flex rounded-full px-2.5 py-1 text-[12px] font-extrabold" style={{ background: day.mood === 'mauvaise-journee' || day.mood === 'tard' || day.mood === 'puni' ? '#fff0f0' : '#ebfbee', color: day.mood === 'mauvaise-journee' || day.mood === 'tard' || day.mood === 'puni' ? BAD : GOOD }}>
          {day.moodLabel}
        </p>
      )}
      {day.result && <p className="mt-1.5 text-[12px] font-bold text-black/60">{day.result}</p>}
      {day.promo && <p className="mt-1.5 text-[12px] font-extrabold text-[#c06a00]">{tr('Promu·e : {0}', { 0: day.promo.title })}</p>}
    </div>
  )
}

/** The finest piece of the house that is this object (as the server reckons it: backend sims/objets.go objPiece). */
function pieceOf(world: World, sim: Sim, base: string): Furniture | undefined {
  const plain = world.furniture?.find((f) => f.id === base)
  if (sim.housing !== 'maison') return plain
  const rank = (t?: string) => (t === 'prestige' ? 2 : t === 'confort' ? 1 : 0)
  let best = plain
  for (const id of sim.furnished ?? []) {
    const f = world.furniture?.find((x) => x.id === id)
    if (f && (f.id === base || f.base === base) && rank(f.tier) >= rank(best?.tier)) best = f
  }
  return best
}

/** What the repairman asks (backend game.RepairmanCost). */
export const repairmanCost = (price: number) => Math.round((3000 + price * 0.025) / 500) * 500

/** The broken objects' names, as the server says them (backend game/objets.go). */
const BROKEN: Record<string, string> = {
  tele: tr('La télé est en panne'),
  console: tr("La console ne s'allume plus"),
  frigo: tr('Le frigo fuit et ne refroidit plus'),
  gaziniere: tr('La gazinière fume'),
  douche: tr("Fuite d'eau à la douche"),
  wc: tr('Les toilettes sont bouchées'),
  lavabo: tr("Fuite d'eau au lavabo"),
}

/** The objects whose actions they block (backend game/objets.go Uses). */
const USES: Record<string, (id: string) => boolean> = {
  tele: (id) => id === 'watch-tv',
  console: (id) => id.startsWith('maison-'),
  frigo: (id) => id === 'frigo' || id.startsWith('frigo-'),
  gaziniere: (id) => id === 'cook-attieke' || id === 'cuisiner-kedjenou',
  douche: (id) => id === 'shower',
  wc: (id) => id === 'toilettes',
  lavabo: (id) => id === 'dents' || id === 'miroir-discours',
}

export const isBroken = (sim: Sim, obj: string) => !!sim.life?.objects?.[obj]?.broken

/** The object an action is done on that's broken now, if any. */
export const brokenFor = (sim: Sim, id: string) => Object.keys(USES).find((o) => USES[o](id) && isBroken(sim, o))

/**
 * The house's list of what can be done, as le mode vie has it: what's done on a broken thing out of it
 * (free will won't go for it), and « Réparer … » only for what's broken (the repairman not on his way).
 */
export function withObjects(sim: Sim, items: { id: string }[]) {
  return items.filter((it) => {
    if (it.id.startsWith('reparer-')) {
      const o = it.id.slice(8)
      return isBroken(sim, o) && !sim.life?.objects?.[o]?.pro
    }
    return !brokenFor(sim, it.id)
  })
}

/**
 * The wheel of a broken object (LifeHome): « Réparer » (by oneself: the bricolage decides), « Appeler un
 * réparateur » (paid, he comes), or, he's on his way, just that; null when it isn't broken.
 */
export function brokenWheel(sim: Sim, world: World, kind: string, repair: PieOption | undefined, onResult: (res: ActionResult) => void): PieOption[] | null {
  const st = sim.life?.objects?.[kind]
  if (!st?.broken) return null
  const RED: [string, string] = ['#ffa8a8', '#e03131']
  const PRO: [string, string] = ['#8ce99a', '#2f9e44']
  const none = { kind: 'act' as const, id: 'none', label: '', icon: '', colors: RED }
  if (st.pro) return [{ id: 'pro', label: tr('Le réparateur arrive'), icon: 'wrench', colors: PRO, why: tr('Il est en route'), order: none }]
  const kid = (lifeOf(world, sim).stage?.id ?? 'adulte') !== 'adulte'
  const cost = kid ? 0 : repairmanCost(pieceOf(world, sim, kind)?.price ?? 0)
  const opts: PieOption[] = []
  if (repair) opts.push({ ...repair, label: tr('Réparer soi-même'), note: tr('Selon le bricolage') })
  opts.push({
    id: 'reparateur',
    label: cost ? tr('Appeler un réparateur · {0} F', { 0: amount(cost) }) : tr('Demander à papa d’appeler le réparateur'),
    icon: 'phone',
    colors: PRO,
    why: sim.money < cost ? tr('Pas assez de Djai') : undefined,
    order: none,
    run: () =>
      void api
        .repairman(sim.id, kind)
        .then((res) => {
          onResult(res)
          haptic('light')
          sfx.ring()
        })
        .catch(() => undefined),
  })
  opts.push({ id: 'broken', label: BROKEN[kind] ?? tr('En panne'), icon: 'zap', colors: RED, why: tr('En panne'), order: none })
  return opts
}

/** A small shock when a repair went wrong: the face, a buzz (once per moodlet). */
export function useShock(sim: Sim) {
  const at = sim.life?.moodlets?.find((m) => m.id === 'decharge')?.until
  const seen = useRef<number | undefined>(at)
  useEffect(() => {
    if (!at || at === seen.current) return
    seen.current = at
    setExpression('me', 'hurt', 2500)
    haptic('heavy')
    sfx.punch()
  }, [at])
}

/** The shock's face and buzz, at home (useShock). */
export function Shock({ sim }: { sim: Sim }) {
  useShock(sim)
  return null
}
