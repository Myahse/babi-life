import { Hand, Soup, Baby, Briefcase } from 'lucide-react'
import { api } from '../lib/api'
import type { Sim, Voisin } from '../lib/types'
import type { Act } from '../screens/phoneApps'
import { Portrait } from '../avatar/portrait'
import { visitorLook } from '../game/famille'
import { amount } from '../game/rules'
import { t } from '../lib/i18n'

// « Voisins » (the update « voisins-vivants », backend sims/voisins.go): the cour's three families, each on
// its card: their faces, their name, trade and character, the children; the bond with the Sim (a bar and a
// word); what they came to ask (yes / no); greeting them (once a day), bringing them a dish; their news.

const TRAIT: Record<string, () => string> = {
  bavard: () => t('Bavard·e'),
  serviable: () => t('Serviable'),
  fetard: () => t('Fêtard·e'),
  pieux: () => t('Pieux·se'),
  discret: () => t('Discret·e'),
  curieux: () => t('Curieux·se'),
}

function lienLabel(l: number) {
  if (l >= 80) return t('Comme la famille')
  if (l >= 50) return t('Bons voisins')
  if (l >= 20) return t('Voisins')
  return t('En froid')
}
const lienColor = (l: number) => (l >= 80 ? '#2b8a3e' : l >= 50 ? '#74b816' : l >= 20 ? '#f59f00' : '#e03131')

const DISH = 1000

export function VoisinsApp({ sim, act }: { sim: Sim; act: Act }) {
  const houses = sim.life?.voisins?.houses ?? []
  const day = Math.floor(sim.gameMinutes / 1440)
  const run = (label: string, icon: string, house: number, what: 'saluer' | 'plat' | 'oui' | 'non') => void act(label, icon, 'social', () => api.voisinAct(sim.id, house, what))

  if (!houses.length) return <p className="px-6 py-10 text-center text-sm font-bold text-[var(--color-ink-soft)]">{t('Tes voisins emménagent… reviens dans un instant.')}</p>
  return (
    <div className="space-y-3">
      <p className="px-1 text-xs font-bold text-[var(--color-ink-soft)]">{t('Les familles de ta cour. Salue-les, rends-leur service : le lien se construit jour après jour.')}</p>
      {houses.map((h) => (
        <Card key={h.id} h={h} day={day} money={sim.money} run={run} />
      ))}
    </div>
  )
}

function Face({ seed, gender }: { seed: number; gender: 'femme' | 'homme' }) {
  return (
    <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-white bg-gradient-to-b from-[#e3f1ff] to-[#9cc7ff] shadow-sm">
      <Portrait look={visitorLook({ seed, gender })} gender={gender} framing="head" stage="adulte" />
    </div>
  )
}

function Card({ h, day, money, run }: { h: Voisin; day: number; money: number; run: (label: string, icon: string, house: number, what: 'saluer' | 'plat' | 'oui' | 'non') => void }) {
  const greeted = h.greeted === day
  const dished = h.dished === day
  const first = h.name.split(' ')[0]
  return (
    <div className="space-y-2 rounded-[22px] bg-[var(--color-card)] p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex -space-x-3">
          <Face seed={h.seed} gender={h.gender} />
          {h.partner && h.pSeed != null && h.pGender && <Face seed={h.pSeed} gender={h.pGender} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-black">{t('Les {name}', { name: h.family })}</p>
          <p className="truncate text-xs font-bold text-[var(--color-ink-soft)]">
            {h.partner ? `${first} & ${h.partner}` : first} · {TRAIT[h.trait]?.() ?? h.trait}
          </p>
          <p className="flex items-center gap-2 text-[11px] font-bold text-[var(--color-ink-soft)]">
            <span className="flex items-center gap-0.5">
              <Briefcase size={11} /> {t(h.job)}
            </span>
            {h.kids > 0 && (
              <span className="flex items-center gap-0.5">
                <Baby size={11} /> {h.kids === 1 ? t('1 enfant') : t('{n} enfants', { n: h.kids })}
              </span>
            )}
          </p>
        </div>
      </div>
      <div>
        <div className="flex justify-between text-[11px] font-extrabold">
          <span style={{ color: lienColor(h.lien) }}>{lienLabel(h.lien)}</span>
          {h.owe ? <span className="text-[var(--color-ink-soft)]">{t('Te doit {m}', { m: amount(h.owe) })}</span> : null}
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/10">
          <div className="h-full rounded-full transition-[width]" style={{ width: `${h.lien}%`, background: lienColor(h.lien) }} />
        </div>
      </div>
      {h.ask && (
        <div className="space-y-2 rounded-2xl bg-[#fff4e6] p-2.5">
          <p className="text-sm font-bold">{t(h.ask.text)}</p>
          <div className="flex gap-2">
            <button className="btn flex-1 !px-2 !py-1.5 !text-xs" disabled={money < (h.ask.amount ?? 0)} onClick={() => run(t(h.ask!.yes), 'hand-heart', h.id, 'oui')}>
              {t(h.ask.yes)}
            </button>
            <button className="btn-ghost flex-1 rounded-full bg-white !px-2 !py-1.5 text-xs font-extrabold" onClick={() => run(t(h.ask!.no), 'x', h.id, 'non')}>
              {t(h.ask.no)}
            </button>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button className="btn flex-1 !px-2 !py-1.5 !text-xs" disabled={greeted} onClick={() => run(t('Saluer les {name}', { name: h.family }), 'hand', h.id, 'saluer')}>
          <Hand size={14} /> {greeted ? t('Salué·e') : t('Saluer')}
        </button>
        <button className="btn flex-1 !px-2 !py-1.5 !text-xs" disabled={dished || money < DISH} onClick={() => run(t('Apporter un plat'), 'soup', h.id, 'plat')}>
          <Soup size={14} /> {dished ? t('Plat apporté') : t('Apporter un plat · {m}', { m: amount(DISH) })}
        </button>
      </div>
      {!!h.news?.length && (
        <ul className="space-y-1 border-t border-black/5 pt-2">
          {h.news.slice(0, 3).map((n, i) => (
            <li key={i} className="text-xs font-semibold text-[var(--color-ink-soft)]">
              • {t(n.text)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
