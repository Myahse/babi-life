// Mon quartier (/quartier, update « mon-quartier », backend sims/quartier.go): the Sim's own neighbourhood,
// or a friend's (?of=<their Sim>). In 3D (world3d/quartier/QuartierScene.tsx): a tap walks there. The owner's
// « Construire »: a tool (road, water, tree, clear), a finger over the cells, the cost shown, « Valider » pays
// (a road over water is a bridge). « Visites »: those who ask to come in (yes or no), the neighbourhoods one
// can go to (friends', those who said yes) and the people one knows whose door one can knock at. « Babi »
// goes back to the world where everyone is.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Check, Construction, Droplets, Eraser, Home, Loader2, Lock, TreePine, Users, X } from 'lucide-react'
import { api, errorText } from '../lib/api'
import type { QuartierEntry, QuartierView, Sim } from '../lib/types'
import { amount } from '../game/rules'
import { keyOpen, useFeatures } from '../lib/features'
import { useLive } from '../lib/live'
import { Land, T, costOf, withPending } from '../world3d/quartier/grid'
import { QuartierScene } from '../world3d/quartier/QuartierScene'
import { chooseWorld } from '../store/monde'
import { useWorld } from '../store/world'
import { Coin } from '../components/ui'
import { t as tr, tx } from '../lib/i18n'

type Tool = 'r' | 'e' | 'a' | '.'

const TOOLS: { id: Tool; label: () => string; icon: typeof Construction; tone: string }[] = [
  { id: 'r', label: () => tr('Route'), icon: Construction, tone: '#4a4d55' },
  { id: 'e', label: () => tr('Eau'), icon: Droplets, tone: '#2a8fc4' },
  { id: 'a', label: () => tr('Arbre'), icon: TreePine, tone: '#2e7d32' },
  { id: '.', label: () => tr('Raser'), icon: Eraser, tone: '#8d6e63' },
]

export function Quartier() {
  const navigate = useNavigate()
  const feats = useFeatures()
  const of = new URLSearchParams(location.search).get('of') ?? undefined
  const [sim, setSim] = useState<Sim | null>(null)
  const [view, setView] = useState<QuartierView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [painting, setPainting] = useState(false)
  const [tool, setTool] = useState<Tool>('r')
  const [pending, setPending] = useState<Map<number, string>>(new Map())
  const [busy, setBusy] = useState(false)
  const [visits, setVisits] = useState<QuartierEntry[] | null>(null)
  const [visitsOpen, setVisitsOpen] = useState(false)

  useEffect(() => void (document.title = tr('Mon quartier · Babi Life')), [])
  useEffect(() => {
    api.sims().then(
      (list) => (list.length ? api.sim(list[0].id).then((r) => setSim(r.sim)) : navigate('/creer', { replace: true })),
      (e) => setError(errorText(e, tr('Erreur'))),
    )
  }, [navigate])
  const load = useCallback(() => {
    if (!sim) return
    api.quartier(sim.id, of).then(setView, (e) => setError(errorText(e, tr('Erreur'))))
  }, [sim?.id, of]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(load, [load])
  // Those who ask to come in, now and then (the owner's).
  useEffect(() => {
    if (!view?.mine) return
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [view?.mine, load])
  useLive(view && !view.locked ? sim?.id : undefined, 'quartier', view?.owner ?? '', view?.owner)
  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => setNote(null), 4500)
    return () => clearTimeout(t)
  }, [note])

  const land = useMemo(() => (view?.grid && view.size && view.cell ? new Land(withPending(view.grid, view.size, pending), view.size, view.cell) : null), [view?.grid, view?.size, view?.cell, pending])
  const prices = view?.prices ?? {}
  const marked = useMemo(() => new Set(pending.keys()), [pending])
  const cost = useMemo(() => {
    if (!view?.grid) return 0
    let n = 0
    for (const [i, t] of pending) n += costOf(view.grid[i], t, prices)
    return n
  }, [pending, view?.grid, prices])
  // The hour in Abidjan (GMT); in development, ?hour=10 sets it.
  const hour = useMemo(() => {
    const asked = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('hour') ?? NaN) : NaN
    return Number.isFinite(asked) ? asked : new Date().getUTCHours()
  }, [])
  const night = hour < 6 || hour >= 19
  const world = useWorld((s) => s.world)

  const paint = useCallback(
    (cells: number[]) => {
      if (!view?.grid) return
      setPending((was) => {
        let next: Map<number, string> | null = null
        for (const i of cells) {
          const base = view.grid![i]
          const c = costOf(base, tool, prices)
          const had = was.get(i)
          if (c === 0 && had === undefined) continue
          if (had === tool) continue
          if (!next) next = new Map(was)
          if (c === 0) next.delete(i)
          else if (next.size < (view.max ?? 400)) next.set(i, tool)
        }
        return next ?? was
      })
    },
    [view?.grid, view?.max, tool, prices],
  )

  const validate = async () => {
    if (!sim || !pending.size) return
    setBusy(true)
    try {
      const cells = [...pending].map(([i, tile]) => ({ x: i % view!.size!, y: Math.floor(i / view!.size!), tile }))
      const res = await api.quartierPaint(sim.id, cells)
      setSim(res.sim)
      setNote(res.outcome.text)
      setPending(new Map())
      load()
    } catch (e) {
      setNote(errorText(e, tr('Erreur')))
    } finally {
      setBusy(false)
    }
  }

  const openVisits = () => {
    setVisitsOpen(true)
    if (sim) api.quartiers(sim.id).then((r) => setVisits(r.quartiers), () => setVisits([]))
  }
  const ask = async (owner: string) => {
    if (!sim) return
    try {
      const res = await api.quartierAsk(sim.id, owner)
      setNote(res.outcome.text)
      setVisits((v) => v?.map((e) => (e.owner === owner ? { ...e, asked: true } : e)) ?? v)
      if (view?.locked) setView({ ...view, asked: true })
    } catch (e) {
      setNote(errorText(e, tr('Erreur')))
    }
  }
  const answer = async (from: string, ok: boolean) => {
    if (!sim) return
    try {
      const res = await api.quartierAnswer(sim.id, from, ok)
      setNote(res.outcome.text)
      load()
    } catch (e) {
      setNote(errorText(e, tr('Erreur')))
    }
  }
  const toBabi = () => (chooseWorld('babi'), navigate('/jeu'))
  const go = (owner?: string) => {
    setVisitsOpen(false)
    setPainting(false)
    setPending(new Map())
    setView(null)
    navigate(owner && owner !== sim?.id ? `/quartier?of=${encodeURIComponent(owner)}` : '/quartier')
  }

  if (feats && !keyOpen(feats, 'mon-quartier'))
    return (
      <Screen>
        <p className="font-display text-2xl font-extrabold text-white">{tr('Mon quartier arrive bientôt.')}</p>
        <button className="btn mt-4" onClick={toBabi}>
          <Building2 size={18} /> {tr('Aller à Babi')}
        </button>
      </Screen>
    )
  if (error)
    return (
      <Screen>
        <p className="font-bold text-white">{error}</p>
        <button className="btn mt-4" onClick={toBabi}>
          <Building2 size={18} /> {tr('Aller à Babi')}
        </button>
      </Screen>
    )
  if (!sim || !view)
    return (
      <Screen>
        <Loader2 className="animate-spin text-white" size={34} />
      </Screen>
    )
  if (view.locked)
    return (
      <Screen>
        <Lock size={40} className="text-white" />
        <h1 className="mt-3 text-center font-display text-[26px] font-extrabold text-white">{tr('Le quartier de {name}', { name: view.ownerName })}</h1>
        <p className="mt-2 max-w-sm text-center font-bold text-white/85">{view.asked ? tr('Tu as demandé à entrer : attends sa réponse.') : tr('Seuls ses ami·es y entrent librement. Demande-lui d’entrer.')}</p>
        <div className="mt-4 flex gap-2">
          {!view.asked && (
            <button className="btn" onClick={() => void ask(view.owner)}>
              {tr('Demander à entrer')}
            </button>
          )}
          <button className="btn btn-soft" onClick={() => go()}>
            <Home size={18} /> {tr('Chez moi')}
          </button>
        </div>
        {note && <p className="mt-4 rounded-2xl bg-white px-4 py-2 text-sm font-bold">{note}</p>}
      </Screen>
    )

  const me = { id: sim.id, name: sim.firstName, gender: sim.gender, look: sim.look }
  const title = view.mine ? tr('Mon quartier') : tr('Le quartier de {name}', { name: view.ownerName })
  const waiting = view.requests?.length ?? 0
  return (
    <div className="relative h-full overflow-hidden bg-[var(--color-night)] select-none">
      {land && <QuartierScene land={land} me={me} people={view.people ?? []} ownerId={view.owner} commune={view.commune ?? sim.commune} boards={view.boards ?? []} night={night} hour={hour} house={view.house} materials={world?.materials} painting={painting} onPaint={paint} marked={marked} />}

      {/* The top: whose it is, the money, the ways out. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,var(--sat,env(safe-area-inset-top)))]">
        <div className="hud pointer-events-auto rounded-2xl px-3.5 py-2">
          <div className="font-display text-[17px] leading-tight font-extrabold">{title}</div>
          <div className="flex items-center gap-1 text-sm font-extrabold">
            <Coin size={15} /> {amount(sim.money)}
          </div>
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <button className="hud flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-extrabold" onClick={toBabi}>
            <Building2 size={17} className="text-[var(--color-orange)]" /> {tr('Babi')}
          </button>
          {!view.mine && (
            <button className="hud flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-extrabold" onClick={() => go()}>
              <Home size={17} className="text-[var(--color-emerald)]" /> {tr('Chez moi')}
            </button>
          )}
          <button className="hud relative flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-extrabold" onClick={openVisits}>
            <Users size={17} className="text-[#3b82f6]" /> {tr('Visites')}
            {waiting > 0 && <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#ff3d57] px-1 text-[11px] text-white">{waiting}</span>}
          </button>
        </div>
      </div>

      {/* « Construire » (the owner's): the tools, the cells marked, what it costs. */}
      {view.mine && (
        <div className="absolute inset-x-0 bottom-0 z-20 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {!painting ? (
            <div className="flex justify-center">
              <button className="btn !px-6" onClick={() => setPainting(true)}>
                <Construction size={18} /> {tr('Construire')}
              </button>
            </div>
          ) : (
            <div className="hud mx-auto max-w-lg rounded-[22px] p-3">
              <div className="grid grid-cols-4 gap-2">
                {TOOLS.map((k) => (
                  <button key={k.id} className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-xs font-extrabold ${tool === k.id ? 'bg-[var(--color-ink)] text-white' : 'bg-black/5'}`} onClick={() => setTool(k.id)}>
                    <k.icon size={20} style={{ color: tool === k.id ? '#fff' : k.tone }} />
                    {k.label()}
                    <span className="text-[10px] opacity-75">{amount(prices[k.id] ?? 0)}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-center text-[11px] font-bold text-[var(--color-ink-soft)]">{tx('Glisse le doigt sur le terrain ; deux doigts pour bouger la vue. Une route sur l’eau fait un pont ({0} la case).', { 0: amount(prices[T.bridge] ?? 0) })}</p>
              <div className="mt-2 flex items-center gap-2">
                <button className="btn btn-soft !px-3 !py-2 !text-sm" onClick={() => (setPainting(false), setPending(new Map()))} aria-label={tr('Fermer')}>
                  <X size={16} />
                </button>
                <span className="min-w-0 flex-1 text-center text-sm font-extrabold">{pending.size ? tx('{0} cases · {1}', { 0: pending.size, 1: amount(cost) }) : tr('Rien de marqué')}</span>
                <button className="btn !px-4 !py-2 !text-sm" disabled={!pending.size || busy || cost > sim.money} onClick={() => void validate()}>
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {cost > sim.money ? tr('Pas assez') : tr('Valider')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {note && (
        <div className="pointer-events-none absolute inset-x-0 top-28 z-30 flex justify-center px-4">
          <p className="max-w-md rounded-2xl bg-white px-4 py-2 text-center text-sm font-bold shadow-lg">{note}</p>
        </div>
      )}

      {/* « Visites »: the knocks at the door, the neighbourhoods to go to. */}
      {visitsOpen && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setVisitsOpen(false)}>
          <div className="max-h-[80%] w-full max-w-md overflow-y-auto rounded-t-[26px] bg-white p-4 sm:rounded-[26px]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-xl font-extrabold">{tr('Visites')}</h3>
              <button className="grid h-9 w-9 place-items-center rounded-full bg-black/5" onClick={() => setVisitsOpen(false)} aria-label={tr('Fermer')}>
                <X size={18} />
              </button>
            </div>
            {view.mine && waiting > 0 && (
              <section className="mb-3">
                <h4 className="label mb-1">{tr('Ils demandent à entrer')}</h4>
                <ul className="space-y-1.5">
                  {view.requests!.map((r) => (
                    <li key={r.sim} className="flex items-center gap-2 rounded-2xl bg-black/5 p-2">
                      <span className="min-w-0 flex-1 truncate font-extrabold">{r.name}</span>
                      <button className="btn !px-3 !py-1.5 !text-xs" onClick={() => void answer(r.sim, true)}>
                        {tr('Accepter')}
                      </button>
                      <button className="btn btn-soft !px-3 !py-1.5 !text-xs" onClick={() => void answer(r.sim, false)}>
                        {tr('Refuser')}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <h4 className="label mb-1">{tr('Les quartiers des autres')}</h4>
            {!visits ? (
              <Loader2 className="animate-spin" />
            ) : visits.length === 0 ? (
              <p className="text-sm font-bold text-[var(--color-ink-soft)]">{tr('Fais-toi des ami·es à Babi : leurs quartiers s’ouvrent à toi.')}</p>
            ) : (
              <ul className="space-y-1.5">
                {visits.map((v) => (
                  <li key={v.owner} className="flex items-center gap-2 rounded-2xl bg-black/5 p-2">
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate font-extrabold">{v.name}</span>
                      <span className="block text-[11px] font-bold text-[var(--color-ink-soft)]">{v.friend ? tr('Ami·e') : v.open ? tr('Te laisse entrer') : tr('Tu le connais')}</span>
                    </span>
                    {v.open ? (
                      <button className="btn !px-3 !py-1.5 !text-xs" disabled={!v.built} onClick={() => go(v.owner)}>
                        {v.built ? tr('Y aller') : tr('Pas encore construit')}
                      </button>
                    ) : v.asked ? (
                      <span className="text-xs font-extrabold text-[var(--color-ink-soft)]">{tr('Demande envoyée')}</span>
                    ) : (
                      <button className="btn btn-soft !px-3 !py-1.5 !text-xs" onClick={() => void ask(v.owner)}>
                        {tr('Demander')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center bg-[var(--color-night)] p-6">{children}</div>
}
