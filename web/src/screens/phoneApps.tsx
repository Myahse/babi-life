// The economy apps of the in-game phone: Boulot and Logement (money is in Waye).
import { BadgeCheck, CalendarClock, Hammer, LandPlot, Clock3, Footprints, House, Map as MapIcon, TrendingUp, TriangleAlert } from 'lucide-react'
import { api } from '../lib/api'
import { LotOffers } from '../components/Lots'
import type { ActionResult, Commune, Lot, Sim, World } from '../lib/types'
import { iconFor, kindColors } from '../components/icons'
import { Chip, Coin, IconTile, Row } from '../components/ui'
import { DEPOSIT_WEEKS, OWN_HOUSE, actionLength, amount, duration, hours, housingOf, neededToPromote, untilSaturday } from '../game/rules'
import { useState } from 'react'

export type Act = (label: string, icon: string, kind: string, call: () => Promise<ActionResult>) => Promise<boolean>

type AppProps = { world: World; sim: Sim; commune: Commune; act: Act }

/* ---------- Boulot ---------- */

export function JobsApp({ world, sim, commune, act, onWalk, onMap }: AppProps & { onWalk: (id: string) => void; onMap: () => void }) {
  const city = world.cities.find((c) => c.id === sim.city)!
  const career = world.careers.find((c) => c.id === sim.career)
  const gigs = city.communes.flatMap((cm) =>
    cm.places.flatMap((p) => world.kinds[p.kind].interactions.filter((it) => it.cost < 0).map((it) => ({ place: p, commune: cm, it }))),
  )

  return (
    <div className="space-y-4">
      {career ? (
        <CareerCard world={world} sim={sim} commune={commune} act={act} onWalk={onWalk} onMap={onMap} />
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

function CareerCard({ world, sim, commune, act, onWalk, onMap }: AppProps & { onWalk: (id: string) => void; onMap: () => void }) {
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

export function HomeApp({ world, sim, commune, act, onBuild }: AppProps & { onBuild?: () => void }) {
  const home = housingOf(world, sim)
  const homeCity = world.cities.find((c) => c.id === sim.homeCity)!
  const homeCommune = homeCity.communes.find((c) => c.id === sim.homeCommune)!
  const livesHere = sim.city === sim.homeCity && sim.commune === sim.homeCommune
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

      <MyLot sim={sim} act={act} onBuild={onBuild} />

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
        <h4 className="label mb-1">Déménager à {commune.name}</h4>
        <p className="mb-2 text-xs font-semibold text-[var(--color-ink-soft)]">Caution de {DEPOSIT_WEEKS} semaines de loyer à l'entrée. Ton nouveau chez-toi sera ici, à {commune.name}.</p>
        <ul className="motion-stagger space-y-2">
          {world.housings.map((h) => {
            const current = h.id === sim.housing && livesHere
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
                  <button className="btn shrink-0 !px-3 !py-2 !text-sm" disabled={blocked} onClick={() => act(`Emménager : ${h.label}`, h.icon, 'home', () => api.move(sim.id, h.id))}>
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

/** Ton terrain: buy a lot (from 18), build on it, move in (sims/plot.go). */
function MyLot({ sim, act, onBuild }: { sim: Sim; act: Act; onBuild?: () => void }) {
  const [lot, setLot] = useState<Lot | null | undefined>(undefined)
  const [more, setMore] = useState(false)
  const own = sim.housing === OWN_HOUSE
  const buy = (size: string, label: string) => act(label, 'land-plot', 'home', () => api.buyLot(sim.id, size))
  return (
    <section className="rounded-[20px] bg-[#eef8f1] p-3">
      <h4 className="label mb-2 flex items-center gap-1.5">
        <LandPlot size={14} /> Ton terrain
      </h4>
      {lot && (
        <div className="mb-2">
          <p className="font-display text-[17px] leading-tight font-extrabold">
            {lot.area} m² ({lot.w} × {lot.d} m)
          </p>
          <p className="text-xs font-semibold text-[var(--color-ink-soft)]">{own ? 'Tu y habites : pas de loyer.' : 'Bâtis ta maison, meuble-la, puis emménage : fini le loyer.'}</p>
          {onBuild && (
            <button className="btn mt-2 w-full !py-2.5 !text-sm" onClick={onBuild}>
              <Hammer size={16} /> {own ? 'Modifier ma maison' : 'Construire et meubler'}
            </button>
          )}
          <button className="mt-2 text-xs font-extrabold text-[var(--color-orange)]" onClick={() => setMore((m) => !m)}>
            {more ? 'Masquer' : 'Un terrain plus grand ?'}
          </button>
        </div>
      )}
      <div className={lot && !more ? 'hidden' : ''}>
        <LotOffers sim={sim} buy={buy} onLoaded={setLot} />
      </div>
    </section>
  )
}
