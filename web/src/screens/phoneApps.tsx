// The economy apps of the in-game phone: Boulot and Logement (money is in Waye).
import { BadgeCheck, CalendarClock, Hammer, LandPlot, Clock3, Footprints, House, Map as MapIcon, TrendingUp, TriangleAlert } from 'lucide-react'
import { api, type LotWhere } from '../lib/api'
import { CommunePicker, LotOffers } from '../components/Lots'
import type { ActionResult, Commune, Plot, Sim, World } from '../lib/types'
import { iconFor, kindColors } from '../components/icons'
import { Chip, Coin, IconTile, Row } from '../components/ui'
import { DEPOSIT_WEEKS, OWN_HOUSE, actionLength, amount, duration, hours, housingOf, neededToPromote, untilSaturday } from '../game/rules'
import { useState } from 'react'
import { aCommune } from '../lib/french'

export type Act = (label: string, icon: string, kind: string, call: () => Promise<ActionResult>) => Promise<boolean>

type AppProps = { world: World; sim: Sim; commune: Commune; act: Act }

/* ---------- Boulot ---------- */

export function JobsApp({ world, sim, commune, act, onWalk, onMap, onAutoWork }: AppProps & { onWalk: (id: string) => void; onMap: () => void; /** The switch: to work by oneself as the hours come. */ onAutoWork: (on: boolean) => Promise<void> }) {
  const city = world.cities.find((c) => c.id === sim.city)!
  const career = world.careers.find((c) => c.id === sim.career)
  const gigs = city.communes.flatMap((cm) =>
    cm.places.flatMap((p) => world.kinds[p.kind].interactions.filter((it) => it.cost < 0).map((it) => ({ place: p, commune: cm, it }))),
  )

  const gigsDone = !!sim.today?.boulot?.max && sim.today.boulot.got >= sim.today.boulot.max
  return (
    <div className="space-y-4">
      <DayCard sim={sim} />
      {career ? (
        <CareerCard world={world} sim={sim} commune={commune} act={act} onWalk={onWalk} onMap={onMap} onAutoWork={onAutoWork} />
      ) : (
        <div className="rounded-[22px] bg-[#fff4e8] p-4">
          <div className="font-display text-lg font-extrabold">Tu cherches du travail</div>
          <p className="text-sm font-semibold text-[var(--color-ink-soft)]">Choisis un métier. Tu commences en bas de l'échelle, mais chaque service bien fait te rapproche d'une promotion.</p>
        </div>
      )}

      <section>
        <h4 className="label mb-2">{career ? 'Changer de métier' : 'Métiers'}</h4>
        <ul className="motion-stagger space-y-2">
          {world.careers
            .filter((c) => c.id !== sim.career)
            .map((c) => (
              <Row
                key={c.id}
                icon={iconFor(c.icon)}
                colors={kindColors(c.kind)}
                title={c.label}
                sub={`${c.levels[0].title} · ${hours(c)} · jusqu'à ${c.levels.at(-1)!.title}`}
                onClick={() => act(`Postuler en ${c.label.toLowerCase()}`, c.icon, c.kind, () => api.career(sim.id, c.id))}
              >
                <Chip tone="good">+{amount(c.levels[0].pay)} Djai</Chip>
              </Row>
            ))}
        </ul>
      </section>

      {gigs.length > 0 && (
        <section>
          <h4 className="label mb-2">Petits boulots</h4>
          {gigsDone && <p className="mb-2 text-sm font-bold text-[var(--color-ink-soft)]">Plus de petit boulot aujourd'hui : reviens demain.</p>}
          <ul className="motion-stagger space-y-2">
            {gigs.map(({ place, commune: cm, it }) => (
              <Row key={place.id + it.id} icon={iconFor(it.icon)} colors={kindColors(place.kind)} title={it.label} sub={`${place.name} · ${cm.name}`} onClick={() => (cm.id === commune.id ? onWalk(place.id) : onMap())}>
                <Chip tone="good">+{amount(-it.cost)} Djai</Chip>
              </Row>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/**
 * The day so far, against its limits (backend game/money.go): the shift paid
 * once a day, the petits boulots, all that's earned by playing. Djai stays
 * scarce: the counters say where the day stands, from midnight to midnight.
 */
function DayCard({ sim }: { sim: Sim }) {
  const t = sim.today
  if (!t) return null
  const shift = t.travail
  const gigs = t.boulot
  const total = t.total
  return (
    <div className="rounded-[22px] bg-[var(--color-canvas)] p-4">
      <div className="label mb-2">Ta journée</div>
      <div className="flex flex-wrap gap-1.5">
        {sim.career && <Chip tone={shift?.times ? 'neutral' : 'good'}>{shift?.times ? 'Service du jour fait' : 'Service du jour à faire'}</Chip>}
        {gigs?.max ? (
          <Chip tone={gigs.got >= gigs.max ? 'neutral' : 'good'}>
            Petits boulots : {amount(gigs.got)} / {amount(gigs.max)} Djai
          </Chip>
        ) : null}
        {total?.max ? (
          <Chip tone="neutral">
            <Coin size={13} /> Gagné en jouant : {amount(total.got)} / {amount(total.max)} Djai
          </Chip>
        ) : null}
      </div>
      <p className="mt-2 text-xs font-semibold text-[var(--color-ink-soft)]">Un service payé par jour, des petits boulots jusqu'à leur plafond, et au plus {amount(total?.max ?? 20000)} Djai gagnés en jouant par jour. Tout repart à zéro à minuit.</p>
    </div>
  )
}

function CareerCard({ world, sim, commune, act, onWalk, onMap, onAutoWork }: AppProps & { onWalk: (id: string) => void; onMap: () => void; onAutoWork: (on: boolean) => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const c = world.careers.find((x) => x.id === sim.career)!
  const level = c.levels[sim.careerLevel]
  const next = c.levels[sim.careerLevel + 1]
  const need = neededToPromote(sim.careerLevel)
  const city = world.cities.find((x) => x.id === sim.city)!
  const workplaces = city.communes.flatMap((cm) => cm.places.filter((p) => p.kind === c.kind || c.also?.includes(p.kind)).map((p) => ({ p, cm })))
  const colors = kindColors(c.kind)

  return (
    <div className="space-y-3">
      <div className="rounded-[22px] p-4 text-white" style={{ background: `linear-gradient(150deg, ${colors[0]}, ${colors[1]})` }}>
        <div className="flex items-center gap-3">
          <IconTile icon={iconFor(c.icon)} colors={['#ffffff55', '#ffffff22']} size={52} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="label !text-white/85">
              {c.label} · niveau {sim.careerLevel + 1}/{c.levels.length}
            </div>
            <div className="truncate font-display text-[22px] font-extrabold">{level.title}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip tone="dark">
            <Coin size={13} /> {amount(level.pay)} Djai / service
          </Chip>
          <Chip tone="dark">
            <Clock3 size={12} /> {hours(c)} · {duration(actionLength(c.minutes))}
          </Chip>
        </div>
        {next ? (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs font-extrabold">
              <span className="flex items-center gap-1">
                <TrendingUp size={13} /> Prochain : {next.title}
              </span>
              <span className="tnum">
                {Math.min(sim.performance, need)}/{need}
              </span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-black/20">
              <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${(Math.min(sim.performance, need) / need) * 100}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] font-bold text-white/85">Va au travail de bonne humeur : un perso content travaille mieux.</p>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-1.5 text-sm font-extrabold">
            <BadgeCheck size={16} /> Sommet de la carrière !
          </div>
        )}
      </div>

      {/* Going to work by itself: as the shift's hours come, at a workplace of the commune it's in (backend sims/jobs.go). */}
      <button
        role="switch"
        aria-checked={!!sim.autoWork}
        disabled={saving}
        onClick={async () => {
          setSaving(true)
          await onAutoWork(!sim.autoWork)
          setSaving(false)
        }}
        className="flex w-full items-center gap-3 rounded-[20px] bg-[#fff4e8] p-3 text-left"
      >
        <CalendarClock size={22} className="shrink-0 text-[var(--color-orange)]" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block font-display text-[15px] font-extrabold">Travail automatique</span>
          <span className="block text-xs font-bold text-[var(--color-ink-soft)]">Va au travail tout·e seul·e dès {hours(c).split('–')[0]}, s'il y a un lieu de travail dans la commune.</span>
        </span>
        <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${sim.autoWork ? 'bg-[var(--color-emerald)]' : 'bg-black/20'}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${sim.autoWork ? 'left-6' : 'left-1'}`} />
        </span>
      </button>

      <h4 className="label">Où travailler</h4>
      <ul className="motion-stagger space-y-2">
        {workplaces.map(({ p, cm }) => {
          const here = cm.id === commune.id
          return (
            <Row key={p.id} icon={iconFor(world.kinds[p.kind].icon)} colors={colors} title={p.name} sub={here ? `${cm.name} · tu es ici` : cm.name} onClick={() => (here ? onWalk(p.id) : onMap())}>
              {here ? <Footprints size={18} className="text-[var(--color-ink-soft)]" /> : <MapIcon size={18} className="text-[var(--color-ink-soft)]" />}
            </Row>
          )
        })}
        {workplaces.length === 0 && <p className="text-sm font-bold text-[var(--color-ink-soft)]">Pas de lieu de travail dans cette ville. Prends le car !</p>}
      </ul>
      <button className="btn btn-soft w-full" onClick={() => act('Démissionner', 'door-open', c.kind, () => api.career(sim.id, ''))}>
        Démissionner
      </button>
    </div>
  )
}

/* ---------- Logement ---------- */

export function HomeApp({ world, sim, commune, act, onBuild, onWalk, onMap }: AppProps & { onBuild?: (lot: number) => void; onWalk?: (id: string) => void; onMap?: () => void }) {
  const home = housingOf(world, sim)
  const homeCity = world.cities.find((c) => c.id === sim.homeCity)!
  const homeCommune = homeCity.communes.find((c) => c.id === sim.homeCommune)!
  // Where to rent: any commune of any town (where the Sim is at first).
  const [to, setTo] = useState<LotWhere>({ city: sim.city, commune: sim.commune })
  const toName = world.cities.find((c) => c.id === to.city)?.communes.find((c) => c.id === to.commune)?.name ?? commune.name
  const livesThere = to.city === sim.homeCity && to.commune === sim.homeCommune
  const due = untilSaturday(sim.gameMinutes)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[var(--color-orange)] p-4 text-white">
        <div className="flex items-center gap-3">
          <IconTile icon={iconFor(home.icon)} colors={['#ffffff55', '#ffffff22']} size={52} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="label !text-white/85">
              Chez toi · {homeCommune.name}, {homeCity.name}
            </div>
            <div className="truncate font-display text-[22px] font-extrabold">{home.label}</div>
          </div>
        </div>
        <p className="mt-2 text-sm leading-snug font-bold text-white/90">{home.hint}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {home.id === OWN_HOUSE ? (
            <Chip tone="dark">Propriétaire · pas de loyer</Chip>
          ) : (
            <>
              <Chip tone="dark">
                <Coin size={13} /> {amount(home.rent)} Djai / semaine
              </Chip>
              <Chip tone="dark">
                <CalendarClock size={12} /> Loyer samedi · dans {duration(due)}
              </Chip>
            </>
          )}
          <Chip tone="dark">Confort {Math.round(home.comfort * 100)} %</Chip>
        </div>
      </div>

      <MyLot world={world} sim={sim} act={act} onBuild={onBuild} onWalk={onWalk} onMap={onMap} />

      {sim.rentArrears > 0 && (
        <div className="flex items-center gap-3 rounded-[20px] bg-[#ffe8ec] p-3">
          <TriangleAlert className="shrink-0 text-[#d81b3f]" />
          <div className="min-w-0 flex-1 text-sm leading-snug font-bold text-[#a3122f]">
            Tu dois {amount(sim.rentArrears)} Djai au propriétaire. Encore un samedi sans payer et c'est l'expulsion.
          </div>
          <button className="btn shrink-0 !px-3 !py-2 !text-sm" disabled={sim.money < sim.rentArrears} onClick={() => act('Payer le propriétaire', 'house', 'home', () => api.repay(sim.id, 'rent', sim.rentArrears))}>
            Payer
          </button>
        </div>
      )}

      <section>
        <h4 className="label mb-1">Déménager</h4>
        <CommunePicker label="Où ?" sim={sim} where={to} onChange={setTo} mark={(c, cm) => (c === sim.homeCity && cm === sim.homeCommune ? 'chez toi' : '')} />
        <p className="mb-2 text-xs font-semibold text-[var(--color-ink-soft)]">Caution de {DEPOSIT_WEEKS} semaines de loyer à l'entrée. Ton nouveau chez-toi sera {aCommune(toName)}.</p>
        <ul className="motion-stagger space-y-2">
          {world.housings.map((h) => {
            const current = h.id === sim.housing && livesThere
            const deposit = h.rent * DEPOSIT_WEEKS
            const blocked = current || sim.rentArrears > 0 || sim.money < deposit
            return (
              <li key={h.id} className={`flex items-center gap-3 rounded-[20px] bg-[var(--color-canvas)] p-2.5 ${blocked && !current ? 'opacity-60' : ''}`}>
                <IconTile icon={iconFor(h.icon)} colors={kindColors('home')} size={46} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[16px] leading-tight font-extrabold">{h.label}</span>
                  <span className="block text-xs font-semibold text-[var(--color-ink-soft)]">
                    {amount(h.rent)} Djai/sem · confort {Math.round(h.comfort * 100)} %
                  </span>
                </span>
                {current ? (
                  <Chip tone="good">
                    <House size={12} /> Chez toi
                  </Chip>
                ) : (
                  <button className="btn shrink-0 !px-3 !py-2 !text-sm" disabled={blocked} onClick={() => act(`Emménager : ${h.label}`, h.icon, 'home', () => api.move(sim.id, h.id, to))}>
                    <Coin size={16} /> {amount(deposit)}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

/** Tes terrains: buy lots (from 18; two at most a commune), build on each, move into one, sell the others (sims/plot.go). */
function MyLot({ world, sim, act, onBuild, onWalk, onMap }: { world: World; sim: Sim; act: Act; onBuild?: (lot: number) => void; onWalk?: (id: string) => void; onMap?: () => void }) {
  const [lots, setLots] = useState<Plot[] | undefined>(undefined)
  const [more, setMore] = useState(false)
  const [version, setVersion] = useState(0)
  const [selling, setSelling] = useState<number | null>(null)
  const done = async (p: Promise<boolean>) => (await p) && setVersion((v) => v + 1)
  const buy = (size: string, label: string, where: LotWhere, upgrade?: number) => act(label, 'land-plot', 'home', () => api.buyLot(sim.id, size, where, upgrade))
  const has = !!lots?.length
  return (
    <section className="rounded-[20px] bg-[#eef8f1] p-3">
      <h4 className="label mb-2 flex items-center gap-1.5">
        <LandPlot size={14} /> {lots && lots.length > 1 ? `Tes terrains (${lots.length})` : 'Ton terrain'}
      </h4>
      {lots?.map((p) => {
        const lot = p.lot!
        // Where it is: in this commune (walk there), or elsewhere (go there first).
        const city = world.cities.find((c) => c.id === lot.city)
        const where = city?.communes.find((c) => c.id === lot.commune)?.name ?? lot.commune
        const here = sim.city === lot.city && sim.commune === lot.commune
        const built = p.blocks.length > 0 || p.furniture.length > 0
        return (
          <div key={p.id} className="mb-2 rounded-2xl bg-white/70 p-2.5">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block font-display text-[16px] font-extrabold">
                  {lot.area} m² {aCommune(where)}
                  {city && city.id !== 'abidjan' ? `, ${city.name}` : ''}
                </span>
                <span className="block text-xs font-semibold text-[var(--color-ink-soft)]">
                  {lot.w} × {lot.d} m · {p.home ? 'tu y habites : pas de loyer' : p.livable ? 'maison prête : tu peux emménager' : built ? 'chantier en cours' : 'terrain nu'}
                </span>
              </span>
              {p.home && (
                <Chip tone="good">
                  <House size={12} /> Chez toi
                </Chip>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {here && !p.home && onWalk ? (
                <button className="rounded-full bg-[#1f9a4a] px-3 py-1.5 text-xs font-extrabold text-white" onClick={() => onWalk(`plot:${p.key}`)}>
                  <MapIcon size={13} className="mr-1 inline" /> Y aller
                </button>
              ) : !here && onMap ? (
                <button className="rounded-full bg-[#1f9a4a] px-3 py-1.5 text-xs font-extrabold text-white" onClick={onMap}>
                  <MapIcon size={13} className="mr-1 inline" /> Y aller
                </button>
              ) : null}
              {onBuild && (
                <button className="rounded-full bg-[var(--color-orange)] px-3 py-1.5 text-xs font-extrabold text-white" onClick={() => onBuild(p.id)}>
                  <Hammer size={13} className="mr-1 inline" /> {p.home ? 'Modifier' : built ? 'Continuer' : 'Construire'}
                </button>
              )}
              {p.livable && !p.home && (
                <button className="rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-extrabold text-white" onClick={() => void done(act('Emménager', 'house', 'home', () => api.moveIn(sim.id, p.id)))}>
                  Emménager
                </button>
              )}
              {!p.home &&
                (selling === p.id ? (
                  <button className="rounded-full bg-[#d81b3f] px-3 py-1.5 text-xs font-extrabold text-white" onClick={() => (setSelling(null), void done(act('Vendre le terrain', 'land-plot', 'home', () => api.sellLot(sim.id, p.id))))}>
                    Vendre pour de bon ?
                  </button>
                ) : (
                  <button className="rounded-full bg-[var(--color-canvas)] px-3 py-1.5 text-xs font-extrabold" onClick={() => setSelling(p.id)}>
                    Vendre
                  </button>
                ))}
            </div>
          </div>
        )
      })}
      {has && (
        <button className="mb-1 text-xs font-extrabold text-[var(--color-orange)]" onClick={() => setMore((m) => !m)}>
          {more ? 'Masquer' : 'Acheter un autre terrain, ou agrandir ?'}
        </button>
      )}
      <div className={has && !more ? 'hidden' : ''}>
        <LotOffers sim={sim} buy={buy} onLoaded={setLots} version={version} />
      </div>
    </section>
  )
}
