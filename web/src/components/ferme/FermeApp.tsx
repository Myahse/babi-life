import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Canvas } from '@react-three/fiber'
import { X } from 'lucide-react'
import { api, errorText } from '../../lib/api'
import type { Sim } from '../../lib/types'
import type { Act } from '../../screens/phoneApps'
import { sceneDpr } from '../../lib/device'
import { amount } from '../../game/rules'
import { monthName, t, tx } from '../../lib/i18n'
import { Chip, Coin } from '../ui'
import { JeuMeProvider } from '../defi/jeux/me'
import { DRYING, HAND_ACTS, MILKED, drawStage, growthOf, setFermeShown, type Bete, type Culture, type Enclos, type FermeAct, type FermeBody, type FermeView, type Meteo, type Offre, type Parcelle } from '../../lib/ferme'
import { FermeScene, type ScenePlot } from '../../world3d/ferme/FermeScene'

// « Ferme » (the update « agriculture », backend sims/ferme.go): the Sim's plots in villages round the towns and
// its yard at home, each in 3D at the top (the field's rows at their stage, the pens, the weather of the day),
// then what it needs today, its next harvest, the animals, the grenier and its sales (capped a day: the rest
// waits), and the plots one can rent or buy. A few acts are short games (the sowing in line, the eggs, the herd;
// the cocoa's harvest is Daloa's own game): their score only shapes the act a little.

const SemisJeu = lazy(() => import('./jeux').then((m) => ({ default: m.SemisJeu })))
const OeufsJeu = lazy(() => import('./jeux').then((m) => ({ default: m.OeufsJeu })))
const TroupeauJeu = lazy(() => import('./jeux').then((m) => ({ default: m.TroupeauJeu })))
const CacaoDefi = lazy(() => import('../defi/Cacao').then((m) => ({ default: m.CacaoDefi })))

const CROP: Record<string, string> = {
  cacao: '🫘',
  cafe: '☕',
  anacarde: '🥜',
  hevea: '🌳',
  palmier: '🌴',
  karite: '🌰',
  igname: '🍠',
  manioc: '🥔',
  banane: '🍌',
  riz: '🌾',
  mais: '🌽',
  mil: '🌾',
  sorgho: '🌾',
  coton: '☁️',
  tomate: '🍅',
  piment: '🌶️',
  aubergine: '🍆',
  gombo: '🫛',
}
const BEAST: Record<string, string> = {
  poules: '🐔',
  pintades: '🐦',
  lapins: '🐇',
  chevres: '🐐',
  moutons: '🐑',
  porcs: '🐖',
  boeufs: '🐂',
  tilapia: '🐟',
}
const PRODUCT: Record<string, string> = {
  'feves-sechees': '🫘',
  'cafe-seche': '☕',
  attieke: '🍚',
  'huile-rouge': '🫙',
  'beurre-karite': '🧈',
  'riz-blanc': '🍚',
  oeufs: '🥚',
  'oeufs-pintade': '🥚',
  tilapia: '🐟',
}
const SKY: Record<Meteo, string> = {
  pluie: '🌧️',
  soleil: '☀️',
  harmattan: '🌫️',
  froid: '❄️',
}
const SKY_SAID: Record<Meteo, () => string> = {
  pluie: () => t('pluie'),
  soleil: () => t('soleil'),
  harmattan: () => t('harmattan'),
  froid: () => t('froid : rien ne pousse'),
}
const STAGE: Record<string, () => string> = {
  friche: () => t('En friche'),
  defriche: () => t('Défrichée'),
  laboure: () => t('Labourée, prête à semer'),
  pousse: () => t('Ça pousse'),
  mur: () => t('Prêt à récolter !'),
}

type Game = {
  kind: 'semis' | 'oeufs' | 'troupeau' | 'cacao'
  arg?: string
  then: (score: number) => void
}

export function FermeApp({ sim, act, onClose }: { sim: Sim; act: Act; /** The phone put away (the Sim off to work at its plot, seen in 3D). */ onClose?: () => void }) {
  const [view, setView] = useState<FermeView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pick, setPick] = useState<string | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [sowing, setSowing] = useState(false)
  const [adding, setAdding] = useState(false)
  const load = useCallback(
    () =>
      void api.ferme(sim.id, 'voir').then(
        (r) => r.data && setView(r.data),
        (e) => setError(errorText(e, t('Pas possible pour le moment'))),
      ),
    [sim.id],
  )
  useEffect(load, [load])
  useEffect(() => setFermeShown(view?.ferme ?? null), [view])
  const run = async (label: string, icon: string, a: FermeAct, body: FermeBody = {}) => {
    let data: FermeView | undefined
    // At the plot, the work of the hands is the Sim's own, acted out there (backend sims/fermeTravail.go): the
    // drying on the claie of the plot it's at.
    const at = body.plot ?? (a === 'transformer' && DRYING.has(body.product ?? '') ? (view?.ferme.plots ?? []).find((p) => view?.here[p.id])?.id : undefined)
    const work = HAND_ACTS.has(a) && !!at && !!view?.here[at] && (a !== 'transformer' || DRYING.has(body.product ?? ''))
    const ok = await act(label, icon, 'life', () => api.ferme(sim.id, a, work ? { ...body, plot: at, work: true } : body).then((r) => ((data = r.data), r)))
    if (ok && data) setView(data)
    if (ok && work) onClose?.()
    return ok
  }

  if (error) return <p className="px-6 py-10 text-center text-sm font-bold text-[var(--color-ink-soft)]">{error}</p>
  if (!view) return <p className="py-10 text-center text-sm font-bold text-[var(--color-ink-soft)]">{t('La ferme se réveille…')}</p>
  const f = view.ferme
  const plots = f.plots ?? []
  const plot = plots.find((p) => p.id === pick) ?? plots.find((p) => view.here[p.id]) ?? plots[0]
  const offerOf = (p: Parcelle) => view.offres.find((o) => o.id === p.offre)
  const free = view.offres.filter((o) => o.open && !plots.some((p) => p.offre === o.id))
  const fields = plots.filter((p) => !offerOf(p)?.home).length
  const grenier = Object.entries(f.grenier ?? {}).filter(([, n]) => n > 0)
  const soldToday = view.cap - Math.min(view.cap, view.left)

  return (
    <div className="space-y-3">
      {/* The day: what's been sold, what's left to sell today, the season */}
      <div className="rounded-[22px] bg-[#fff4e6] p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-display text-[17px] font-extrabold">{t('Ma ferme')}</div>
            <div className="text-[12px] font-bold text-[var(--color-ink-soft)]">
              {tx('{month} · {n} récolte(s), {b} naissance(s) en tout', {
                month: monthName(view.month - 1),
                n: f.harvests ?? 0,
                b: f.born ?? 0,
              })}
            </div>
          </div>
          <Chip tone={view.left > 0 ? 'good' : 'neutral'}>
            <Coin size={13} />{' '}
            {tx('{0} / {1} Djai vendus', {
              0: amount(soldToday),
              1: amount(view.cap),
            })}
          </Chip>
        </div>
        <p className="mt-1.5 text-[11.5px] leading-snug font-semibold text-[var(--color-ink-soft)]">{tx('La ferme rapporte au plus {0} Djai par jour : ce que le marché n’achète pas aujourd’hui attend au grenier.', { 0: amount(view.cap) })}</p>
      </div>

      {!!f.news?.length && (
        <div className="rounded-[22px] bg-[#e6fcf5] p-3 text-[12.5px] leading-snug font-bold text-[#0b7285]">
          {f.news.map((n, i) => (
            <p key={i}>• {n}</p>
          ))}
        </div>
      )}

      {plots.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {plots.map((p) => {
            const o = offerOf(p)
            return (
              <button key={p.id} className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-extrabold ${p.id === plot?.id ? 'bg-[var(--color-ink)] text-white' : 'bg-black/5'}`} onClick={() => setPick(p.id)}>
                {o?.home ? '🏡 ' + t('Ma cour') : '🌱 ' + (o?.cityName ?? o?.label ?? '')}
              </button>
            )
          })}
        </div>
      )}

      {plot && offerOf(plot) && <PlotCard key={plot.id} view={view} sim={sim} plot={plot} offre={offerOf(plot)!} run={run} play={setGame} sowing={sowing} setSowing={setSowing} adding={adding} setAdding={setAdding} />}

      {/* The grenier and its sales */}
      {(grenier.length > 0 || !!f.sechage?.length) && (
        <div className="rounded-[22px] bg-white p-3.5 shadow-sm ring-1 ring-black/5">
          <div className="label mb-1.5">{t('Le grenier')}</div>
          <div className="space-y-2">
            {grenier.map(([id, n]) => {
              const c = view.cultures.find((x) => x.id === id)
              const p = view.produits.find((x) => x.id === id)
              const label = c?.label ?? p?.label ?? id
              const unit = c?.unit ?? p?.unit ?? ''
              const market = c?.price ?? p?.price ?? 0
              const coop = c?.coop ?? p?.coop ?? 0
              const make = c?.make ? view.produits.find((x) => x.id === c.make) : undefined
              return (
                <div key={id} className="rounded-2xl bg-[var(--color-canvas)] p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{CROP[id] ?? PRODUCT[id] ?? '📦'}</span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[14px] font-extrabold">{label}</span>
                      <span className="block text-[12px] font-bold text-[var(--color-ink-soft)]">
                        {n} {unit}
                      </span>
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {market > 0 && (
                      <Pill
                        tone="sell"
                        disabled={view.left < market}
                        onClick={() =>
                          run(t('Vendre au marché'), 'banknote', 'vendre', {
                            product: id,
                            to: 'marche',
                          })
                        }
                      >
                        {tx('Au marché · {0} F/{1}', {
                          0: amount(market),
                          1: unit,
                        })}
                      </Pill>
                    )}
                    {coop > 0 && (
                      <Pill tone="sell" disabled={view.left < coop} onClick={() => run(t('Vendre à la coopérative'), 'warehouse', 'vendre', { product: id, to: 'coop' })}>
                        {tx('À la coopérative Ensemble · {0} F/{1}', {
                          0: amount(coop),
                          1: unit,
                        })}
                      </Pill>
                    )}
                    {make && (
                      <Pill
                        onClick={() =>
                          run(make.do ?? make.label, 'sun', 'transformer', {
                            product: make.id,
                          })
                        }
                      >
                        {make.do}
                        {make.days ? ` · ${tx('{n} j', { n: make.days })}` : ''}
                      </Pill>
                    )}
                    {!market && !coop && !make && <span className="text-[12px] font-bold text-[var(--color-ink-soft)]">{t('Personne n’achète cela brut')}</span>}
                  </div>
                </div>
              )
            })}
            {f.sechage?.map((l, i) => {
              const p = view.produits.find((x) => x.id === l.product)
              return (
                <div key={i} className="flex items-center gap-2 rounded-2xl bg-[#fff9db] p-2.5 text-[12.5px] font-bold">
                  <span className="text-xl">☀️</span>
                  <span className="flex-1">
                    {tx('{qty} {unit} de {label} : prêt dans {n} jour(s)', {
                      qty: l.qty,
                      unit: p?.unit ?? '',
                      label: (p?.label ?? l.product).toLowerCase(),
                      n: Math.max(1, l.ready - view.today),
                    })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* The plots to rent or buy */}
      {free.length > 0 && (
        <div>
          <div className="label mb-1.5">{plots.length ? t('Une autre parcelle') : t('Commence ta ferme')}</div>
          <div className="grid gap-2">
            {free.map((o) => (
              <OfferCard key={o.id} o={o} view={view} sim={sim} full={!o.home && fields >= view.rules.maxPlots} run={run} />
            ))}
          </div>
        </div>
      )}

      {game &&
        createPortal(
          <div className="fixed inset-0 z-[80] bg-[radial-gradient(circle_at_50%_30%,#2b4a2a,#0f1a10)]">
            <JeuMeProvider
              me={{
                look: sim.look,
                gender: sim.gender === 'femme' ? 'femme' : 'homme',
              }}
            >
              <Suspense fallback={<div className="grid h-full place-items-center text-white">…</div>}>
                {game.kind === 'semis' && <SemisJeu crop={game.arg} onEnd={(s) => (setGame(null), game.then(s))} />}
                {game.kind === 'oeufs' && <OeufsJeu pintade={game.arg === 'pintades'} onEnd={(s) => (setGame(null), game.then(s))} />}
                {game.kind === 'troupeau' && <TroupeauJeu kind={game.arg} onEnd={(s) => (setGame(null), game.then(s))} />}
                {game.kind === 'cacao' && <CacaoDefi onEnd={(s) => (setGame(null), game.then(s))} />}
              </Suspense>
            </JeuMeProvider>
            <button className="absolute top-[max(0.75rem,var(--sat,env(safe-area-inset-top)))] right-3 grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white" aria-label={t('Fermer')} onClick={() => setGame(null)}>
              <X size={18} />
            </button>
          </div>,
          document.body,
        )}
    </div>
  )
}

type Run = (label: string, icon: string, a: FermeAct, body?: FermeBody) => Promise<boolean>

function Pill({ children, onClick, disabled, tone }: { children: ReactNode; onClick: () => void; disabled?: boolean; tone?: 'go' | 'sell' | 'warn' | 'soft' }) {
  const c = tone === 'go' ? 'bg-[#2b8a3e] text-white' : tone === 'sell' ? 'bg-[#fff3bf] text-[#7a5a00]' : tone === 'warn' ? 'bg-[#ffe3e3] text-[#c92a2a]' : tone === 'soft' ? 'bg-black/5 text-[var(--color-ink)]' : 'bg-[#e7f5ff] text-[#1864ab]'
  return (
    <button className={`rounded-full px-3.5 py-2 text-[13px] font-extrabold active:scale-95 disabled:opacity-45 ${c}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}

function Need({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-extrabold ${ok ? 'bg-[#ebfbee] text-[#2b8a3e]' : 'bg-[#fff0f0] text-[#c92a2a]'}`}>{children}</span>
}

function PlotCard({
  view,
  sim,
  plot,
  offre,
  run,
  play,
  sowing,
  setSowing,
  adding,
  setAdding,
}: {
  view: FermeView
  sim: Sim
  plot: Parcelle
  offre: Offre
  run: Run
  play: (g: Game) => void
  sowing: boolean
  setSowing: (b: boolean) => void
  adding: boolean
  setAdding: (b: boolean) => void
}) {
  const zone = offre.home ? view.homeZone : offre.zone
  const [today, tomorrow] = view.meteo[zone] ?? ['soleil', 'soleil']
  const c = plot.champ
  const crop = view.cultures.find((x) => x.id === c.crop)
  const here = !!view.here[plot.id]
  const active = !!plot.owned || (plot.rentUntil ?? 0) > view.today
  const watered = c.watered === view.today || today === 'pluie'
  const left = crop ? Math.max(0, Math.ceil(crop.days - (c.growth ?? 0))) : 0
  const scene: ScenePlot = useMemo(
    () => ({
      crop: c.crop,
      stage: drawStage(c, crop),
      ploughed: c.stage !== 'friche' && c.stage !== 'defriche',
      cleared: c.stage !== 'friche',
      rows: Math.min(offre.rows, 8),
      wet: watered && c.stage === 'pousse',
      weeds: c.weeds,
      pest: c.pest,
      pens: (plot.pens ?? []).map((e) => ({
        kind: e.kind,
        n: e.adults,
        young: e.young ?? 0,
        tired: e.tired,
      })),
      bags: Object.values(view.ferme.grenier ?? {}).reduce((a, b) => a + Math.ceil(b / 20), 0),
      drying: view.ferme.sechage?.[0]?.product,
      meteo: today,
      north: zone === 'nord' || zone === 'sahel',
      seed: Number(plot.id.replace(/\D/g, '')) || 1,
    }),
    [c, crop, offre.rows, watered, plot.pens, plot.id, view.ferme.grenier, view.ferme.sechage, today, zone],
  )
  const crops = offre.crops.map((id) => view.cultures.find((x) => x.id === id)).filter((x): x is Culture => !!x && x.zones.includes(zone))
  const beasts = offre.animals.map((id) => view.betes.find((x) => x.id === id)).filter((x): x is Bete => !!x && x.zones.includes(zone) && !(plot.pens ?? []).some((e) => e.kind === x.id))
  const where = offre.home ? t('chez toi') : (offre.cityName ?? '')
  return (
    <div className="rounded-[22px] bg-white shadow-sm ring-1 ring-black/5">
      <div className="relative h-[210px] overflow-hidden rounded-t-[22px] bg-[linear-gradient(#bfe3ff,#e7f5ff)]">
        <Canvas dpr={sceneDpr} camera={{ position: [0, 7.5, 10.5], fov: 40 }} onCreated={({ camera }) => camera.lookAt(0.6, 0, -0.6)}>
          <FermeScene plot={scene} />
        </Canvas>
        <div className="absolute top-2 left-2 flex gap-1.5">
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11.5px] font-extrabold">
            {SKY[today]} {t('Aujourd’hui')} : {SKY_SAID[today]()}
          </span>
          <span className="rounded-full bg-white/75 px-2.5 py-1 text-[11.5px] font-extrabold">
            {SKY[tomorrow]} {t('Demain')}
          </span>
        </div>
      </div>
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 leading-tight">
            <div className="truncate font-display text-[17px] font-extrabold">{offre.label}</div>
            <div className="text-[12px] font-bold text-[var(--color-ink-soft)]">
              {plot.owned
                ? t('À toi')
                : active
                  ? tx('Louée jusqu’au jour {0} (dans {1} j)', {
                      0: plot.rentUntil ?? 0,
                      1: Math.max(0, (plot.rentUntil ?? 0) - view.today),
                    })
                  : t('Loyer à renouveler')}{' '}
              · {tx('{0} rangs', { 0: offre.rows })}
              {view.rainy[zone] ? ` · ${t('saison des pluies')}` : ` · ${t('saison sèche')}`}
            </div>
          </div>
          {!here && <Chip tone="neutral">📍 {where}</Chip>}
        </div>
        {!here && (
          <p className="mt-2 rounded-2xl bg-[#fff9db] p-2.5 text-[12px] leading-snug font-bold text-[#7a5a00]">
            {offre.home ? t('Ta cour est chez toi : rentre à la maison pour t’en occuper.') : tx('Ta parcelle est à {0} : vas-y pour y travailler, ou paie un manœuvre qui s’en occupe chaque jour.', { 0: where })}
          </p>
        )}
        {!active && (
          <div className="mt-2">
            <Pill
              tone="go"
              disabled={sim.money < (offre.rent ?? 0)}
              onClick={() =>
                run(t('Renouveler le loyer'), 'calendar', 'renouveler', {
                  plot: plot.id,
                })
              }
            >
              {tx('Renouveler {0} j · {1} F', {
                0: view.rules.rentDays,
                1: amount(offre.rent ?? 0),
              })}
            </Pill>
          </div>
        )}

        {/* The field */}
        <div className="mt-3 rounded-2xl bg-[var(--color-canvas)] p-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{crop ? CROP[crop.id] : c.stage === 'friche' ? '🌿' : '🟫'}</span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-[14.5px] font-extrabold">{crop ? crop.label : t('Le champ')}</span>
              <span className={`block text-[12px] font-bold ${c.stage === 'mur' ? 'text-[#2b8a3e]' : 'text-[var(--color-ink-soft)]'}`}>
                {STAGE[c.stage]()}
                {crop && c.stage === 'pousse' ? ` · ${tx('récolte dans {n} jour(s) d’eau', { n: left })}` : ''}
                {crop && crop.kind === 'perenne' && (c.harvests ?? 0) > 0 ? ` · ${tx('{n} récolte(s)', { n: c.harvests ?? 0 })}` : ''}
              </span>
            </span>
          </div>
          {crop && c.stage !== 'friche' && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10">
              <div className="h-full rounded-full bg-[#2b8a3e] transition-all" style={{ width: `${Math.round(growthOf(c, crop) * 100)}%` }} />
            </div>
          )}
          {c.stage === 'pousse' && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Need ok={watered}>{today === 'pluie' ? t('💧 la pluie arrose') : watered ? t('💧 arrosé') : t('💧 à arroser aujourd’hui')}</Need>
              <Need ok={!c.weeds}>{c.weeds ? t('🌿 mauvaises herbes') : t('🌿 propre')}</Need>
              <Need ok={!c.pest}>{c.pest ? t('🐛 chenilles !') : t('🐛 sain')}</Need>
              {!c.inSeason && <Need ok={false}>{t('hors saison')}</Need>}
              {(c.dry ?? 0) > 0 && <Need ok={false}>{tx('{n} jour(s) sans eau', { n: c.dry ?? 0 })}</Need>}
            </div>
          )}
          {here && active && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {c.stage === 'friche' && (
                <>
                  <Pill
                    tone="go"
                    onClick={() =>
                      run(t('Défricher à la machette'), 'axe', 'defricher', {
                        plot: plot.id,
                      })
                    }
                  >
                    🔪 {t('Défricher à la machette')}
                  </Pill>
                  <Pill disabled={sim.money < view.rules.clear} onClick={() => run(t('Défricher avec les jeunes du village'), 'users', 'defricher', { plot: plot.id, hire: true })}>
                    {tx('Avec les jeunes du village · {0} F', {
                      0: amount(view.rules.clear),
                    })}
                  </Pill>
                </>
              )}
              {c.stage === 'defriche' && (
                <>
                  <Pill
                    tone="go"
                    onClick={() =>
                      run(t('Labourer à la daba'), 'shovel', 'labourer', {
                        plot: plot.id,
                      })
                    }
                  >
                    ⛏️ {t('Labourer à la daba')}
                  </Pill>
                  <Pill disabled={sim.money < view.rules.plough} onClick={() => run(t('Louer le motoculteur Kabako'), 'tractor', 'labourer', { plot: plot.id, hire: true })}>
                    {tx('Motoculteur Kabako · {0} F', {
                      0: amount(view.rules.plough),
                    })}
                  </Pill>
                </>
              )}
              {c.stage === 'laboure' && (
                <Pill tone="go" onClick={() => setSowing(!sowing)}>
                  🌱 {sowing ? t('Fermer') : t('Semer ou planter…')}
                </Pill>
              )}
              {c.stage === 'pousse' && (
                <>
                  <Pill
                    tone="go"
                    disabled={watered}
                    onClick={() =>
                      run(t('Arroser'), 'droplets', 'arroser', {
                        plot: plot.id,
                      })
                    }
                  >
                    🚿 {t('Arroser')}
                  </Pill>
                  <Pill
                    disabled={!c.weeds}
                    onClick={() =>
                      run(t('Désherber'), 'shovel', 'desherber', {
                        plot: plot.id,
                      })
                    }
                  >
                    🌿 {t('Désherber')}
                  </Pill>
                  <Pill
                    disabled={!c.pest || sim.money < view.rules.treat}
                    onClick={() =>
                      run(t('Traiter au neem'), 'spray-can', 'traiter', {
                        plot: plot.id,
                      })
                    }
                  >
                    {tx('🍃 Traiter au neem · {0} F', {
                      0: amount(view.rules.treat),
                    })}
                  </Pill>
                </>
              )}
              {c.stage === 'mur' && crop && (
                <Pill
                  tone="go"
                  onClick={() =>
                    crop.id === 'cacao'
                      ? play({
                          kind: 'cacao',
                          then: (s) =>
                            void run(t('Récolter'), 'wheat', 'recolter', {
                              plot: plot.id,
                              score: s,
                            }),
                        })
                      : void run(t('Récolter'), 'wheat', 'recolter', {
                          plot: plot.id,
                        })
                  }
                >
                  🧺 {crop.id === 'cacao' ? t('Récolter les cabosses (jeu)') : t('Récolter')}
                </Pill>
              )}
              {(c.stage === 'pousse' || c.stage === 'mur') && (
                <Pill
                  tone="soft"
                  onClick={() =>
                    confirm(t('Arracher ce champ ? La culture sera perdue.')) &&
                    void run(t('Arracher'), 'trash', 'arracher', {
                      plot: plot.id,
                    })
                  }
                >
                  {t('Arracher')}
                </Pill>
              )}
            </div>
          )}
          {sowing && here && active && c.stage === 'laboure' && (
            <div className="mt-2.5 grid gap-1.5">
              {crops.map((k) => {
                const inSow = !k.sow?.length || k.sow.includes(view.month)
                const cost = k.seed * offre.rows
                const go = (score: number) =>
                  void run(k.seedLabel, 'sprout', 'semer', {
                    plot: plot.id,
                    crop: k.id,
                    score,
                  }).then((ok) => ok && setSowing(false))
                return (
                  <div key={k.id} className="rounded-2xl bg-white p-2.5 ring-1 ring-black/5">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{CROP[k.id]}</span>
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block text-[13.5px] font-extrabold">
                          {k.label} {inSow ? <span className="text-[11px] text-[#2b8a3e]">· {t('en saison')}</span> : <span className="text-[11px] text-[#e8590c]">· {t('hors saison')}</span>}
                        </span>
                        <span className="block text-[11.5px] font-bold text-[var(--color-ink-soft)]">
                          {tx('{days} jours · {cost} F · ~{y} {unit}', {
                            days: k.days,
                            cost: amount(cost),
                            y: k.yield * offre.rows,
                            unit: k.unit,
                          })}
                          {k.again ? ` · ${tx('puis tous les {n} jours', { n: k.again })}` : ''}
                        </span>
                      </span>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-snug font-semibold">{k.about}</p>
                    <div className="mt-1.5 flex gap-1.5">
                      <Pill tone="go" disabled={sim.money < cost} onClick={() => (k.kind === 'perenne' ? go(70) : play({ kind: 'semis', arg: k.id, then: go }))}>
                        {k.kind === 'perenne' ? t('Planter') : t('Semer en ligne (jeu)')}
                      </Pill>
                      {k.kind !== 'perenne' && (
                        <Pill tone="soft" disabled={sim.money < cost} onClick={() => go(55)}>
                          {t('Semer vite fait')}
                        </Pill>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* The animals */}
        {(plot.pens ?? []).map((e) => {
          const b = view.betes.find((x) => x.id === e.kind)
          return b ? <PenCard key={e.kind} e={e} b={b} view={view} sim={sim} plot={plot} here={here && active} run={run} play={play} /> : null
        })}
        {here && active && beasts.length > 0 && (plot.pens ?? []).length < offre.pens && (
          <div className="mt-3">
            <Pill tone="soft" onClick={() => setAdding(!adding)}>
              {adding ? t('Fermer') : t('➕ Commencer un élevage')}
            </Pill>
            {adding && (
              <div className="mt-2 grid gap-1.5">
                {beasts.map((b) => (
                  <div key={b.id} className="rounded-2xl bg-[var(--color-canvas)] p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{BEAST[b.id]}</span>
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block text-[13.5px] font-extrabold">{b.label}</span>
                        <span className="block text-[11.5px] font-bold text-[var(--color-ink-soft)]">
                          {tx('{n} pour commencer · {price} F · {feed} F de nourriture par tête et par jour', {
                            n: b.min,
                            price: amount(b.min * b.price),
                            feed: amount(b.feed),
                          })}
                        </span>
                      </span>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-snug font-semibold">{b.about}</p>
                    <div className="mt-1.5">
                      <Pill
                        tone="go"
                        disabled={sim.money < b.min * b.price}
                        onClick={() =>
                          void run(b.label, 'paw-print', 'betes', {
                            plot: plot.id,
                            kind: b.id,
                            qty: b.min,
                          }).then((ok) => ok && setAdding(false))
                        }
                      >
                        {b.pond
                          ? tx('Lâcher {n} alevins', { n: b.min })
                          : tx('Acheter {n} au marché à bétail', {
                              n: b.min,
                            })}
                      </Pill>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* The plot's own: the farmhand, give back or sell */}
        {!offre.home && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-black/5 pt-3">
            <Pill tone={plot.hand ? 'go' : 'soft'} onClick={() => run(plot.hand ? t('Remercier le manœuvre') : t('Payer un manœuvre'), 'user', 'manoeuvre', { plot: plot.id, on: !plot.hand })}>
              {plot.hand
                ? tx('👷 Manœuvre payé ({0} F/jour) : arrêter', {
                    0: amount(view.rules.hand),
                  })
                : tx('👷 Un manœuvre · {0} F/jour', {
                    0: amount(view.rules.hand),
                  })}
            </Pill>
            <Pill
              tone="soft"
              onClick={() =>
                confirm(plot.owned ? t('Revendre cette parcelle ? (80 % de son prix)') : t('Rendre cette parcelle à son propriétaire ?')) &&
                void run(plot.owned ? t('Revendre la parcelle') : t('Rendre la parcelle'), 'log-out', 'rendre', { plot: plot.id })
              }
            >
              {plot.owned
                ? tx('Revendre · {0} F', {
                    0: amount(Math.round(offre.price * 0.8)),
                  })
                : t('Rendre la parcelle')}
            </Pill>
          </div>
        )}
      </div>
    </div>
  )
}

function PenCard({ e, b, view, sim, plot, here, run, play }: { e: Enclos; b: Bete; view: FermeView; sim: Sim; plot: Parcelle; here: boolean; run: Run; play: (g: Game) => void }) {
  const fed = e.fed === view.today || e.grazed === view.today
  const drank = e.watered === view.today || !!b.pond
  const heads = e.adults + (e.young ?? 0)
  const feed = b.feed * heads
  const body = { plot: plot.id, kind: b.id }
  return (
    <div className="mt-3 rounded-2xl bg-[var(--color-canvas)] p-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{BEAST[b.id]}</span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[14.5px] font-extrabold">
            {b.label} · {b.pond ? tx('{n} poissons', { n: e.adults }) : tx('{n} adulte(s)', { n: e.adults })}
            {e.young ? ` + ${e.young} ${b.young}` : ''}
          </span>
          <span className={`block text-[12px] font-bold ${e.sick || e.tired ? 'text-[#e03131]' : 'text-[var(--color-ink-soft)]'}`}>
            {e.sick
              ? t('Une bête est malade : appelle le vétérinaire')
              : e.tired
                ? t('Fatiguées : oubliées hier, elles produisent moins')
                : b.pond
                  ? tx('Pêche dans {n} jour(s) nourris', {
                      n: Math.max(0, (b.grow ?? 0) - (e.grown ?? 0)),
                    })
                  : b.every
                    ? tx('Prochaines naissances dans ~{n} jour(s) bien tenus', {
                        n: Math.max(1, e.birthIn ?? b.every),
                      })
                    : t('En forme')}
          </span>
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] font-extrabold text-[var(--color-ink-soft)]">
        <span>{t('Forme')}</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/10">
          <div
            className="h-full rounded-full"
            style={{
              width: `${e.condition}%`,
              background: e.condition < 45 ? '#e03131' : '#2b8a3e',
            }}
          />
        </div>
        <span>{e.condition}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Need ok={fed}>{fed ? t('🍽️ nourries') : t('🍽️ à nourrir')}</Need>
        {!b.pond && <Need ok={drank}>{drank ? t('💧 abreuvées') : t('💧 à abreuver')}</Need>}
        {!!e.eggs && <Need ok>{tx('🥚 {n} œufs à ramasser', { n: e.eggs })}</Need>}
      </div>
      {here && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Pill tone="go" disabled={fed || sim.money < feed} onClick={() => run(t('Nourrir'), 'wheat', 'nourrir', body)}>
            {tx('{food} · {price} F', {
              food: b.feedLabel.charAt(0).toUpperCase() + b.feedLabel.slice(1),
              price: amount(feed),
            })}
          </Pill>
          {!b.pond && (
            <Pill disabled={drank} onClick={() => run(t('Donner à boire'), 'droplets', 'abreuver', body)}>
              💧 {t('Donner à boire')}
            </Pill>
          )}
          {MILKED.has(b.id) && (
            <Pill disabled={e.milked === view.today} onClick={() => run(t('Traire'), 'milk', 'traire', body)}>
              🥛 {e.milked === view.today ? t('Traites ce matin') : t('Traire')}
            </Pill>
          )}
          {b.graze && (
            <Pill
              disabled={fed}
              onClick={() =>
                play({
                  kind: 'troupeau',
                  arg: b.id,
                  then: (s) =>
                    void run(t('Mener au pâturage'), 'footprints', 'paturage', {
                      ...body,
                      score: s,
                    }),
                })
              }
            >
              🌾{' '}
              {b.herder
                ? tx('Au pâturage avec le bouvier · {0} F (jeu)', {
                    0: amount(b.herder),
                  })
                : t('Mener au pâturage (jeu)')}
            </Pill>
          )}
          {!!b.product && !b.pond && (
            <Pill
              disabled={!e.eggs}
              onClick={() =>
                play({
                  kind: 'oeufs',
                  arg: b.id,
                  then: (s) =>
                    void run(t('Ramasser les œufs'), 'egg', 'oeufs', {
                      ...body,
                      score: s,
                    }),
                })
              }
            >
              🥚 {t('Ramasser les œufs (jeu)')}
            </Pill>
          )}
          {e.sick && (
            <Pill tone="warn" disabled={sim.career !== 'veterinaire' && sim.money < b.vet} onClick={() => run(t('Appeler le vétérinaire'), 'stethoscope', 'veterinaire', body)}>
              🩺 {sim.career === 'veterinaire' ? t('La soigner toi-même') : tx('Le vétérinaire · {0} F', { 0: amount(b.vet) })}
            </Pill>
          )}
          {b.pond && (
            <Pill tone="go" disabled={(e.grown ?? 0) < (b.grow ?? 0)} onClick={() => run(t('Pêcher l’étang'), 'fish', 'pecher', body)}>
              🎣 {t('Pêcher l’étang')}
            </Pill>
          )}
          {!b.pond && e.adults > (b.every ? 2 : 0) && (
            <Pill tone="sell" disabled={e.sick || view.left < b.sell} onClick={() => run(t('Vendre au marché à bétail'), 'banknote', 'vendre-betes', { ...body, qty: 1 })}>
              {tx('Vendre 1 adulte · {0} F', { 0: amount(b.sell) })}
            </Pill>
          )}
          {!b.pond && !!e.young && (
            <Pill
              tone="sell"
              disabled={e.sick || view.left < b.sellYoung}
              onClick={() =>
                run(t('Vendre les petits'), 'banknote', 'vendre-betes', {
                  ...body,
                  qty: e.young,
                  young: true,
                })
              }
            >
              {tx('Vendre les {young} · {0} F pièce', {
                young: b.young,
                0: amount(b.sellYoung),
              })}
            </Pill>
          )}
        </div>
      )}
    </div>
  )
}

function OfferCard({ o, view, sim, full, run }: { o: Offre; view: FermeView; sim: Sim; full: boolean; run: Run }) {
  const crops = o.crops.map((id) => CROP[id]).filter(Boolean)
  const animals = o.animals.map((id) => BEAST[id]).filter(Boolean)
  return (
    <div className="rounded-[22px] bg-white p-3.5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ebfbee] text-3xl">{o.home ? '🏡' : '🌱'}</span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block font-display text-[15.5px] font-extrabold">{o.label}</span>
          <span className="block text-[12px] font-bold text-[var(--color-ink-soft)]">
            {tx('{rows} rangs · {pens} élevage(s)', {
              rows: o.rows,
              pens: o.pens,
            })}{' '}
            · {crops.slice(0, 6).join('')} {animals.join('')}
          </span>
        </span>
      </div>
      <p className="mt-2 text-[12.5px] leading-snug font-semibold">{o.about}</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {o.home ? (
          <Pill tone="go" disabled={sim.money < o.price} onClick={() => run(t('Aménager la cour'), 'house', 'acheter', { offre: o.id })}>
            {tx('Aménager · {0} F', { 0: amount(o.price) })}
          </Pill>
        ) : full ? (
          <span className="text-[12px] font-bold text-[var(--color-ink-soft)]">{tx('Tu as déjà {0} parcelles.', { 0: view.rules.maxPlots })}</span>
        ) : (
          <>
            <Pill tone="go" disabled={sim.money < (o.rent ?? 0)} onClick={() => run(t('Louer la parcelle'), 'key', 'louer', { offre: o.id })}>
              {tx('Louer · {0} F pour {1} jours', {
                0: amount(o.rent ?? 0),
                1: view.rules.rentDays,
              })}
            </Pill>
            <Pill
              tone="soft"
              disabled={sim.money < o.price}
              onClick={() =>
                run(t('Acheter la parcelle'), 'landmark', 'acheter', {
                  offre: o.id,
                })
              }
            >
              {tx('Acheter · {0} F', { 0: amount(o.price) })}
            </Pill>
          </>
        )}
      </div>
    </div>
  )
}
