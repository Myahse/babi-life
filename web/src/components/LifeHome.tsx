import { useEffect, useRef } from 'react'
import { api } from '../lib/api'
import type { Grocery, Interaction, Sim, World } from '../lib/types'
import { clock } from '../game/rules'
import { openSpot, useSceneActions } from '../world3d/sceneActions'
import { chooseFree, clearQueue, dropHead, enqueue, lastTap, lifeState, markStarted, openPie, people, routeToMember, setLifeHandlers, useLife, cancel, type Candidate, type LifeOrder, type PieOption, type Tapped } from '../game/lifeMode'
import type { Npc, Where } from '../world3d/talk'
import { LifeQueue, PieMenu } from './LifeHud'
import { SKILL_ACTS, STATUS, relOf, socialsFor, statusOf } from '../game/vie'
import { householdState, orderMember, useHousehold } from '../game/household'
import { HouseholdStrip, MemberQueue } from './Household'
import { t as tr } from '../lib/i18n'

// Le mode vie at home (the update « mode-vie », game/lifeMode.ts): what an object or someone of the
// family tapped offers (the wheel), the queue run in turn, and free will when nothing is asked. Every
// order goes through Play's own ways of doing things (interact, the fridge, the chat with papa and maman),
// so the server decides as ever; this only says what and when.

/** The things done at a piece of furniture (HomeInside's objects): not offered again when the Sim itself is tapped. */
const AT_OBJECTS = new Set(['sleep', 'nap', 'passer-nuit', 'shower', 'dents', 'toilettes', 'cook-attieke', 'aider-maison', 'watch-tv', 'maison-foot', 'maison-course', 'maison-combat', 'devoirs', 'nager', 'frigo', 'golvo'])
/** Never picked by free will: the day's big things (school, the crèche, the night together), a baby's mishaps and choices, the stories' épreuves. */
const NOT_FREE = /^(aller-ecole|creche|passer-nuit|caca|pipi|vomir|pleurer|jouets|premier-mot|bagarre-bebe|devoirs|epreuve-.*)$/
/** The words with papa or maman offered, and what each does to the needs (backend sims/parents.go), by age. */
const TALKS: { topic: string; label: string; icon: string; effect: Candidate['effect']; baby?: boolean; kid?: boolean }[] = [
  { topic: 'salut', label: tr('Saluer'), icon: 'hand', effect: { social: 6 }, kid: true },
  { topic: 'parent-calin', label: tr('Faire un câlin'), icon: 'heart', effect: { social: 18, fun: 4 }, baby: true, kid: true },
  { topic: 'parent-babiller', label: tr('Babiller'), icon: 'baby', effect: { social: 10, fun: 8 }, baby: true },
  { topic: 'parent-journee', label: tr('Raconter sa journée'), icon: 'messages-square', effect: { social: 12, fun: 4 }, kid: true },
  { topic: 'parent-conseil', label: tr('Demander un conseil'), icon: 'lightbulb', effect: { social: 10, fun: 2 }, kid: true },
  { topic: 'parent-poche', label: tr("Demander l'argent de poche"), icon: 'hand-coins', effect: { social: 2 }, kid: true },
]
const SOCIAL: [string, string] = ['#ff8fb1', '#e0245e']
const ANGRY: [string, string] = ['#9aa0b4', '#3b3f52']
const FRIDGE: [string, string] = ['#8fd3ff', '#2b7bd6']

/** Free will thinks this often (ms), and waits this long after the player last touched the screen or the last thing ended. */
const THINK = 2500
const IDLE_AFTER = 5000

export function LifeHome(p: {
  sim: Sim
  /** Where: 'home' (its objects, its family, its fridge, free will), or a place walked into (its pins only). */
  placeId: string
  world: World
  /** What can be done at home now (the place's list, as « Que faire ? »), why each can't, and its colours. */
  items: Interaction[]
  whyNot: (it: Interaction) => string | undefined
  note: (it: Interaction) => string
  colors: [string, string]
  /** Nothing in the way of the next order (no request going, nothing being done, no sheet open, in the house). */
  canStart: boolean
  /** The current activity's share done (0..1). */
  progress: number
  stage: string
  fridgeOn: boolean
  gameFor: (it: Interaction) => boolean
  start: (it: Interaction, auto: boolean) => Promise<boolean>
  eat: (item: string, auto: boolean) => Promise<boolean>
  talk: (npc: Npc, where: Where | undefined, topic: string) => Promise<void>
  openFridge: () => void
  openChat: (npc: Npc, where?: Where) => void
  stop: () => void
  /** The action under way has a game: played now, for a better result. */
  onPlay?: () => void
  /** The queue and the wheel shown (not over a game being played). */
  hud?: boolean
}) {
  const latest = useRef(p)
  latest.current = p
  const { queue, started, freeWill } = useLife()
  const head = queue[0] as LifeOrder | undefined
  // The fridge's stock (read when tapped and now and then for free will).
  const fridge = useRef<Record<string, number> | null>(null)
  const readFridge = async () => {
    if (!latest.current.fridgeOn) return null
    try {
      fridge.current = (await api.fridge(latest.current.sim.id)).stock
    } catch {
      fridge.current = null
    }
    return fridge.current
  }
  const bestIn = (stock: Record<string, number> | null, drink: boolean): Grocery | undefined => {
    const gs = (latest.current.world.groceries ?? []).filter((g) => !!g.drink === drink && (stock?.[g.id] ?? 0) > 0)
    return gs.sort((a, b) => (b.effect.hunger ?? 0) + (b.effect.energy ?? 0) - ((a.effect.hunger ?? 0) + (a.effect.energy ?? 0)))[0]
  }
  const actOption = (it: Interaction): PieOption => {
    const { whyNot, note, colors, gameFor } = latest.current
    return { id: it.id, label: it.label, icon: it.icon, colors, note: note(it), why: whyNot(it), game: gameFor(it), order: { kind: 'act', id: it.id, label: it.label, icon: it.icon, colors, it } }
  }
  const fridgeOrder = (g: Grocery): PieOption['order'] => ({ kind: 'fridge', id: `frigo-${g.id}`, item: g.id, label: g.label, icon: g.icon, colors: FRIDGE })

  // What a tap opens: the wheel round the spot, what can be done there.
  useEffect(() => {
    const object = async (o: Tapped) => {
      const { items, fridgeOn } = latest.current
      const at = { x: lastTap.x, y: lastTap.y }
      const opts: PieOption[] = []
      // Someone else of the house directed (game/household.ts): what an adult does at that piece, nothing to pay.
      const hh = householdState()
      const member = hh.members.find((m) => m.id === hh.selected)
      if (member && o.kind !== 'self') {
        for (const id of o.ids) {
          const it = items.find((x) => x.id === id)
          if (it && (!it.ages?.length || it.ages.includes('adulte')) && !NOT_FREE.test(it.id)) opts.push({ id: it.id, label: it.label, icon: it.icon, colors: latest.current.colors, order: { kind: 'act', id: it.id, label: it.label, icon: it.icon, colors: latest.current.colors, it } })
        }
        if (o.kind === 'frigo') opts.push({ id: 'eat', label: tr('Manger quelque chose'), icon: 'refrigerator', colors: FRIDGE, order: { kind: 'fridge', id: 'frigo', label: tr('Manger quelque chose'), icon: 'refrigerator', colors: FRIDGE } })
        if (!opts.length) opts.push({ id: 'none', label: tr('Rien à faire ici'), icon: 'circle-off', colors: ['#c3c8dc', '#7a8099'], why: tr('Pas pour {0}', { 0: member.name }), order: { kind: 'act', id: 'none', label: '', icon: '', colors: ['#c3c8dc', '#7a8099'] } })
        openPie({ ...at, title: `${member.name} · ${o.name}`, options: opts.slice(0, 9) })
        return
      }
      for (const id of o.ids) {
        if (id === 'frigo') continue
        const it = items.find((x) => x.id === id)
        if (it) opts.push(actOption(it))
      }
      if (o.kind === 'self') for (const it of items) if (!AT_OBJECTS.has(it.id) && !it.id.startsWith('epreuve-') && opts.length < 8) opts.push(actOption(it))
      if (o.kind === 'frigo' && fridgeOn) {
        const stock = await readFridge()
        const food = bestIn(stock, false)
        const drink = bestIn(stock, true)
        if (food) opts.push({ id: 'eat', label: tr('Manger : {0}', { 0: food.label }), icon: food.icon, colors: FRIDGE, game: latest.current.gameFor({ id: `frigo-${food.id}`, label: food.label, icon: food.icon, minutes: food.minutes, cost: 0, effect: { hunger: 0, energy: 0, hygiene: 0, social: 0, fun: 0 } }), order: fridgeOrder(food) })
        if (drink) opts.push({ id: 'drink', label: tr('Boire : {0}', { 0: drink.label }), icon: drink.icon, colors: FRIDGE, order: fridgeOrder(drink) })
        opts.push({ id: 'open', label: food || drink ? tr('Ouvrir le frigo') : tr('Le frigo est vide : le remplir'), icon: 'refrigerator', colors: FRIDGE, order: { kind: 'open', id: 'open-fridge', label: tr('Le frigo'), icon: 'refrigerator', colors: FRIDGE } })
      }
      if (!opts.length) opts.push({ id: 'none', label: tr('Rien à faire ici'), icon: 'circle-off', colors: ['#c3c8dc', '#7a8099'], why: tr('Pas maintenant'), order: { kind: 'act', id: 'none', label: '', icon: '', colors: ['#c3c8dc', '#7a8099'] } })
      // What can't be done now shows only when nothing can (greyed, with why): the wheel stays short.
      const now = opts.filter((x) => !x.why)
      openPie({ ...at, title: o.name, options: (now.length ? now : opts).slice(0, 9) })
    }
    const person = (npc: Npc, where?: Where) => {
      const { sim, stage } = latest.current
      const baby = stage === 'bebe'
      let opts: PieOption[]
      let title = npc.name
      if (npc.kin) {
        opts = TALKS.filter((x) => (baby ? x.baby : x.kid)).map((x) => ({ id: x.topic, label: x.label, icon: x.icon, colors: SOCIAL, order: { kind: 'chat', id: `chat:${npc.id}:${x.topic}`, label: x.label, icon: x.icon, colors: SOCIAL, npc, where, topic: x.topic } }))
        const k = sim.life?.kin?.[npc.id]
        title = `${npc.name} · ${STATUS[statusOf(k?.friendship ?? 60, k?.enemy)].label}`
      } else {
        // Someone met (le mode vie's relationships, game/vie.ts): what can be said to them now, from what they are to each other.
        const f = sim.friends?.find((x) => x.id === `p-${npc.id}`)
        const r = relOf(f)
        title = `${npc.name} · ${f ? STATUS[statusOf(r.friendship, r.enemy, f.partner)].label : tr('Inconnu·e')}`
        opts = socialsFor(f, stage === 'adulte' && (!f || !!f.adult), !!sim.friends?.some((x) => x.partner)).map((x) => {
          const colors = x.bad ? ANGRY : SOCIAL
          return { id: x.topic, label: x.label, icon: x.icon, colors, order: { kind: 'chat', id: `chat:${npc.id}:${x.topic}`, label: `${x.label} (${npc.name})`, icon: x.icon, colors, npc, where, topic: x.topic } }
        })
      }
      opts.push({ id: 'causer', label: tr('Discuter…'), icon: 'messages-square', colors: SOCIAL, order: { kind: 'chat', id: `open:${npc.id}`, label: tr('Discuter'), icon: 'messages-square', colors: SOCIAL, npc, where } })
      openPie({ x: lastTap.x, y: lastTap.y, title, options: opts })
    }
    // The house's objects at home only (elsewhere the place's pins are what one taps, below); the people wherever le mode vie runs.
    return setLifeHandlers((o) => void (latest.current.placeId === 'home' && object(o)), person)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // In a place (not home): a pin tapped (world3d/SpotActions) opens the wheel round it instead of the card.
  const { open: pinned } = useSceneActions()
  useEffect(() => {
    if (!pinned || p.placeId === 'home') return
    openSpot(null)
    const opts = pinned.map((a) => latest.current.items.find((it) => it.id === a.id)).filter((it): it is Interaction => !!it).map(actOption)
    const now = opts.filter((x) => !x.why)
    if (opts.length) openPie({ x: lastTap.x, y: lastTap.y, title: tr('Que faire ici ?'), options: (now.length ? now : opts).slice(0, 9) })
  }, [pinned]) // eslint-disable-line react-hooks/exhaustive-deps

  // The household (game/household.ts): with someone else picked on the strip, the wheel's orders are theirs
  // (a piece's action, something from the fridge); a word to someone is still the Sim's.
  const hh = useHousehold()
  const directing = p.placeId === 'home' && hh.selected !== 'self' && hh.members.some((m) => m.id === hh.selected)
  useEffect(() => {
    if (p.placeId !== 'home') return
    routeToMember((o) => {
      const { selected, members } = householdState()
      if (selected === 'self' || !members.some((m) => m.id === selected)) return false
      if (o.kind === 'act' && o.it) orderMember(selected, o.it, o.colors)
      else if (o.kind === 'fridge') orderMember(selected, { id: 'frigo', label: o.label, icon: o.icon, effect: { hunger: 45 }, minutes: 20 }, o.colors)
      else return false
      return true
    })
    return () => routeToMember(null)
  }, [p.placeId])

  // Gone from the house: the orders with it, the wheel shut.
  useEffect(
    () => () => {
      clearQueue()
      openPie(null)
    },
    [],
  )

  // The player asks something while free will's thing is being done: it gives way at once.
  useEffect(() => {
    if (head?.free && started === head.key && queue.some((q) => !q.free)) {
      cancel(head.key)
      latest.current.stop()
    }
  }, [queue, started]) // eslint-disable-line react-hooks/exhaustive-deps

  // The order under way: done once its activity is over (its time, its game, stopped).
  const running = useRef<number | null>(null)
  const lastEnd = useRef(0)
  const lastFree = useRef<string | null>(null)
  const activity = p.sim.activity?.kind === 'do' ? p.sim.activity.interaction.id : null
  useEffect(() => {
    if (running.current === null || !head || head.key !== running.current) return
    if (head.kind === 'act' || head.kind === 'fridge') {
      if (!activity && p.canStart) {
        running.current = null
        lastEnd.current = performance.now()
        dropHead()
      }
    }
  }, [activity, p.canStart, head?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // The next order's turn.
  useEffect(() => {
    if (!head || started === head.key || !p.canStart) return
    const o = head
    markStarted(o.key)
    running.current = o.key
    const done = () => {
      running.current = null
      lastEnd.current = performance.now()
      if (lifeState().queue[0]?.key === o.key) dropHead()
    }
    const { start, eat, talk, openFridge, openChat } = latest.current
    if (o.free) lastFree.current = o.id
    if (o.kind === 'act' && o.it) void start(o.it, !o.play).then((ok) => !ok && done())
    else if (o.kind === 'fridge' && o.item) void eat(o.item, !o.play).then((ok) => !ok && done())
    else if (o.kind === 'open') (openFridge(), done())
    else if (o.kind === 'chat' && o.npc && !o.topic) (openChat(o.npc, o.where), done())
    else if (o.kind === 'chat' && o.npc && o.topic) void talk(o.npc, o.where, o.topic).finally(done)
    else done()
  }, [head?.key, started, p.canStart]) // eslint-disable-line react-hooks/exhaustive-deps

  // Free will: on a timer, nothing asked, nothing being done, the player not touching the screen.
  useEffect(() => {
    if (!freeWill || latest.current.placeId !== 'home') return
    let fridgeRead = 0
    const think = () => {
      const { sim, items, whyNot, canStart } = latest.current
      const st = lifeState()
      const now = performance.now()
      if (st.queue.length || st.pie || !canStart || document.visibilityState !== 'visible') return
      if (now - lastTap.at < IDLE_AFTER || now - lastEnd.current < IDLE_AFTER) return
      // The fridge read now and then (not each time: a request).
      if (latest.current.fridgeOn && now - fridgeRead > 60_000) {
        fridgeRead = now
        void readFridge()
      }
      const cands: Candidate[] = []
      // (Le mode vie's moods, game/vie.ts: the house dirty, the cleaning wanted; the skills worked on when all is well.)
      const dirty = sim.life?.moodlets?.some((m) => m.id === 'maison-sale')
      for (const it of items) if (!NOT_FREE.test(it.id) && !whyNot(it)) cands.push({ id: it.id, effect: it.effect, cost: Math.max(0, it.cost), minutes: it.minutes, skill: SKILL_ACTS.has(it.id), bonus: dirty && it.id === 'faire-menage' ? 2.5 : 0 })
      const food = bestIn(fridge.current, false)
      if (food) cands.push({ id: `frigo-${food.id}`, effect: food.effect, cost: 0, minutes: food.minutes })
      const { hour } = clock(sim.gameMinutes)
      const night = hour >= 22 || hour < 6
      if (!night) for (const id of people.keys()) for (const x of TALKS) if ((latest.current.stage === 'bebe' ? x.baby : x.kid) && x.topic !== 'parent-poche') cands.push({ id: `chat:${id}:${x.topic}`, effect: x.effect, cost: 0, minutes: 5 })
      const pick = chooseFree(cands, sim.needs, sim.traits ?? [], hour, sim.money, lastFree.current, undefined, sim.mood?.score ?? 0)
      if (!pick) return
      if (pick.startsWith('chat:')) {
        const [, kind, who, topic] = pick.split(':')
        const person = people.get(`${kind}:${who}`)
        const x = TALKS.find((t) => t.topic === topic)
        if (person && x) enqueue({ kind: 'chat', id: pick, label: `${x.label} (${person.npc.name})`, icon: x.icon, colors: SOCIAL, npc: person.npc, where: person.where, topic, free: true })
      } else if (pick.startsWith('frigo-') && food) enqueue({ ...fridgeOrder(food), free: true })
      else {
        const it = items.find((x) => x.id === pick)
        if (it) enqueue({ ...actOption(it).order, free: true })
      }
    }
    const t = setInterval(think, THINK)
    return () => clearInterval(t)
  }, [freeWill]) // eslint-disable-line react-hooks/exhaustive-deps

  if (p.hud === false) return null
  return (
    <>
      {/* The household (game/household.ts): who's directed; their own queue in the Sim's place while they are. */}
      {p.placeId === 'home' && <HouseholdStrip sim={p.sim} stage={p.stage} />}
      {directing ? <MemberQueue /> : <LifeQueue progress={p.progress} onCancelCurrent={() => latest.current.stop()} onPlay={p.onPlay} doing={p.sim.activity?.kind === 'do' && p.sim.activity.placeId === p.placeId ? { label: p.sim.activity.interaction.label, icon: p.sim.activity.interaction.icon, colors: p.colors } : undefined} />}
      <PieMenu />
    </>
  )
}
