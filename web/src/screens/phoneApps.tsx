// The economy apps of the in-game phone: Boulot, Logement and Mobile Money.
import { BadgeCheck, CalendarClock, Clock3, Footprints, House, Map as MapIcon, TrendingUp, TriangleAlert } from 'lucide-react'
import { api } from '../lib/api'
import type { ActionResult, Commune, JournalEvent, Sim, World } from '../lib/types'
import { iconFor, kindColors } from '../components/icons'
import { Chip, Coin, IconTile, Row } from '../components/ui'
import { DEPOSIT_WEEKS, LOAN_INSTALLMENT, amount, duration, hours, neededToPromote, untilSaturday } from '../game/rules'

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
        <ul className="space-y-2">
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
                <Chip tone="good">+{amount(c.levels[0].pay)} F</Chip>
              </Row>
            ))}
        </ul>
      </section>

      {gigs.length > 0 && (
        <section>
          <h4 className="label mb-2">Petits boulots</h4>
          <ul className="space-y-2">
            {gigs.map(({ place, commune: cm, it }) => (
              <Row key={place.id + it.id} icon={iconFor(it.icon)} colors={kindColors(place.kind)} title={it.label} sub={`${place.name} · ${cm.name}`} onClick={() => (cm.id === commune.id ? onWalk(place.id) : onMap())}>
                <Chip tone="good">+{amount(-it.cost)} F</Chip>
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
  const workplaces = city.communes.flatMap((cm) => cm.places.filter((p) => p.kind === c.kind).map((p) => ({ p, cm })))
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
            <Coin size={13} /> {amount(level.pay)} F / service
          </Chip>
          <Chip tone="dark">
            <Clock3 size={12} /> {hours(c)} · {duration(c.minutes)}
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
            <p className="mt-1.5 text-[11px] font-bold text-white/85">Va au travail de bonne humeur : un Sim content travaille mieux.</p>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-1.5 text-sm font-extrabold">
            <BadgeCheck size={16} /> Sommet de la carrière !
          </div>
        )}
      </div>

      <h4 className="label">Où travailler</h4>
      <ul className="space-y-2">
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

export function HomeApp({ world, sim, commune, act }: AppProps) {
  const home = world.housings.find((h) => h.id === sim.housing)!
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
          <Chip tone="dark">
            <Coin size={13} /> {amount(home.rent)} F / semaine
          </Chip>
          <Chip tone="dark">
            <CalendarClock size={12} /> Loyer samedi · dans {duration(due)}
          </Chip>
          <Chip tone="dark">Confort {Math.round(home.comfort * 100)} %</Chip>
        </div>
      </div>

      {sim.rentArrears > 0 && (
        <div className="flex items-center gap-3 rounded-[20px] bg-[#ffe8ec] p-3">
          <TriangleAlert className="shrink-0 text-[#d81b3f]" />
          <div className="min-w-0 flex-1 text-sm leading-snug font-bold text-[#a3122f]">
            Tu dois {amount(sim.rentArrears)} F au propriétaire. Encore un samedi sans payer et c'est l'expulsion.
          </div>
          <button className="btn shrink-0 !px-3 !py-2 !text-sm" disabled={sim.money < sim.rentArrears} onClick={() => act('Payer le propriétaire', 'house', 'home', () => api.repay(sim.id, 'rent', sim.rentArrears))}>
            Payer
          </button>
        </div>
      )}

      <section>
        <h4 className="label mb-1">Déménager à {commune.name}</h4>
        <p className="mb-2 text-xs font-semibold text-[var(--color-ink-soft)]">Caution de {DEPOSIT_WEEKS} semaines de loyer à l'entrée. Ton nouveau chez-toi sera ici, à {commune.name}.</p>
        <ul className="space-y-2">
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
                    {amount(h.rent)} F/sem · confort {Math.round(h.comfort * 100)} %
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

/* ---------- Mobile Money ---------- */

export function BankApp({ sim, act, journal, renderJournal }: { sim: Sim; act: Act; journal: JournalEvent[]; renderJournal: (events: JournalEvent[]) => React.ReactNode }) {
  const earned = journal.reduce((s, e) => s + Math.max(0, e.money), 0)
  const spent = Math.abs(journal.reduce((s, e) => s + Math.min(0, e.money), 0))
  const installment = Math.min(LOAN_INSTALLMENT, sim.loan)

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-[var(--color-gold)] p-4 text-[#5a3a00]">
        <div className="label !text-[#7a5200]">Solde</div>
        <div className="tnum font-display text-4xl leading-none font-extrabold">{amount(sim.money)} F</div>
        <div className="mt-3 flex gap-4 text-xs font-extrabold">
          <span>↑ {amount(earned)} F reçus</span>
          <span>↓ {amount(spent)} F dépensés</span>
        </div>
      </div>

      {sim.loan > 0 && (
        <div className="rounded-[22px] bg-[#ffe8ec] p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="label !text-[#a3122f]">Microcrédit</div>
              <div className="tnum font-display text-2xl leading-none font-extrabold text-[#d81b3f]">{amount(sim.loan)} F</div>
            </div>
            <Chip tone="bad">−{amount(LOAN_INSTALLMENT)} F chaque samedi</Chip>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="btn btn-soft !py-2 !text-sm" disabled={sim.money < installment} onClick={() => act('Rembourser le microcrédit', 'hand-coins', 'market', () => api.repay(sim.id, 'loan', installment))}>
              Rembourser {amount(installment)}
            </button>
            <button className="btn !py-2 !text-sm" disabled={sim.money < sim.loan} onClick={() => act('Solder le microcrédit', 'hand-coins', 'market', () => api.repay(sim.id, 'loan', sim.loan))}>
              Tout solder
            </button>
          </div>
        </div>
      )}

      {renderJournal(journal.filter((e) => e.money !== 0))}
    </div>
  )
}
