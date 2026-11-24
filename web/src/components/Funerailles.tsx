import { useState } from 'react'
import { Flower2 } from 'lucide-react'
import { api, type Funeral } from '../lib/api'
import type { Look, Sim } from '../lib/types'
import type { Act } from '../screens/phoneApps'
import { Portrait } from '../avatar/portrait'
import { famOf, elderLook } from '../game/famille'
import { amount } from '../game/rules'
import { t } from '../lib/i18n'
import { useSante } from '../lib/sante'
import { lazyIn } from '../lib/lazyIn'
import type { Scenario, Shot } from './prologue/types'

// « Funérailles » (the update « cycle-vie », backend sims/funerailles.go): an elder of the family gone, the
// Sim chooses how to honour them: simple, « dignes » (the bâche, the choir all night) or the great funeral
// (the orchestra, the tee-shirts with their face). Paid less the family's cotisations; the renom grows. Then
// the ceremony as a little film (the prologues' engine): the church, the veillée, the orchestra, the sky.

const PrologueFilm = lazyIn(() => import('./prologue/PrologueFilm').then((m) => ({ default: m.PrologueFilm })))

type Gone = NonNullable<NonNullable<ReturnType<typeof famOf>>['memorials']>[number]

const DAY = 24 * 3600

export function FuneraillesApp({ sim, act }: { sim: Sim; act: Act }) {
  const health = useSante((st) => st.health)
  const [film, setFilm] = useState<Scenario | null>(null)
  const ms = famOf(sim)?.memorials ?? []
  const waiting = ms.filter((m) => !m.funeral && m.died)
  const given = ms.filter((m) => m.funeral)
  const funerals = health?.funerals ?? []
  const days = health?.funeralDays ?? 7

  const give = async (m: Gone, f: Funeral) => {
    const ok = await act(f.label, 'flower', 'social', () => api.funerailles(sim.id, m.at, f.id))
    if (ok) setFilm(ceremony(sim, m, f.id))
  }

  return (
    <div className="space-y-3">
      {film && <PrologueFilm scenario={film} onClose={() => setFilm(null)} />}
      {!waiting.length && <p className="px-6 py-8 text-center text-sm font-bold text-[var(--color-ink-soft)]">{t('Aucunes funérailles à organiser.')}</p>}
      {waiting.map((m) => {
        const left = Math.max(0, Math.ceil((m.died! + days * DAY - Date.now() / 1000) / DAY))
        return (
          <div key={m.at} className="space-y-2 rounded-[22px] bg-[var(--color-card)] p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 overflow-hidden rounded-full bg-[#dee2e6] grayscale">
                <Portrait look={elderLook({ look: m.look, seed: m.seed, gender: m.gender, stage: 'senior' }) as Look} gender={m.gender} framing="head" stage="senior" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-black">{m.name}</p>
                <p className="text-xs font-bold text-[var(--color-ink-soft)]">{t('Parti·e à {n} ans · encore {d} j pour ses funérailles', { n: m.years, d: left })}</p>
              </div>
            </div>
            {funerals.map((f) => (
              <button key={f.id} onClick={() => give(m, f)} disabled={sim.money < f.pays} className="w-full rounded-2xl bg-[var(--color-bg)] p-3 text-left disabled:opacity-50">
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-black">
                    <Flower2 size={16} /> {t(f.label)}
                  </span>
                  <span className="text-sm font-black">{amount(f.pays)}</span>
                </span>
                <span className="mt-1 block text-xs font-semibold text-[var(--color-ink-soft)]">{t(f.about)}</span>
                <span className="mt-1 block text-[11px] font-bold text-[var(--color-ink-soft)]">{t('Coût {cost} · la famille cotise {pct} % · +{r} renom', { cost: amount(f.cost), pct: Math.round(f.cotisations * 100), r: f.renom })}</span>
              </button>
            ))}
          </div>
        )
      })}
      {given.length > 0 && (
        <div className="rounded-[22px] bg-[var(--color-card)] p-3">
          <p className="mb-1 text-xs font-black uppercase text-[var(--color-ink-soft)]">{t('Ils reposent en paix')}</p>
          {given.map((m) => (
            <p key={m.at} className="text-sm font-bold">
              {m.name} · {t('{n} ans', { n: m.years })} · {m.funeral === 'famille' ? t('enterré·e par la famille') : t(funerals.find((f) => f.id === m.funeral)?.label ?? '')}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

/** The ceremony's film: the church, then the veillée (dignes, grandes), the orchestra (grandes), the sky. */
export function ceremony(sim: Sim, m: Gone, kind: string): Scenario {
  const black = '#212529'
  const cast: Scenario['cast'] = {
    narr: { name: '', gender: 'femme', look: {} },
    me: { name: sim.firstName, gender: sim.gender, look: { ...sim.look, outfitColor: black } },
    pasteur: { name: t('Le pasteur'), gender: 'homme', look: { outfit: 'boubou', outfitColor: '#f8f9fa', hairColor: '#d9d6d0' } },
    tante: { name: t('La tante'), gender: 'femme', look: { outfit: 'pagne', hair: 'headwrap', outfitColor: black } },
    oncle: { name: t('L’oncle'), gender: 'homme', look: { outfit: 'chemise', outfitColor: black } },
    cousine: { name: t('La cousine'), gender: 'femme', look: { outfit: 'robe', outfitColor: '#f8f9fa' } },
  }
  const shirt = { outfit: 'casual', outfitColor: '#f8f9fa' }
  if (kind === 'grande') {
    cast.danseur = { name: '', gender: 'homme', look: shirt }
    cast.danseuse = { name: '', gender: 'femme', look: { ...shirt, hair: 'puffs' } }
  }
  const shots: Shot[] = [
    {
      set: 'culte',
      dur: 6,
      cam: { from: [1.0, 2.3, 6.5], to: [0.3, 1.8, 5.1], look: [0, 1.2, -1.2] },
      actors: [
        { who: 'pasteur', at: [0, -1.6], pose: 'talk' },
        { who: 'me', at: [-0.5, 0.8], turn: Math.PI, pose: 'pray' },
        { who: 'tante', at: [0.5, 0.8], turn: Math.PI, pose: 'pray' },
        { who: 'oncle', at: [-1.2, 1.4], turn: Math.PI, pose: 'idle' },
        { who: 'cousine', at: [1.2, 1.4], turn: Math.PI, pose: 'pray' },
      ],
      line: { who: 'narr', text: t('Toute la famille s’est réunie pour dire au revoir à {name}, parti·e à {n} ans.', { name: m.name, n: m.years }) },
    },
    {
      set: 'culte',
      dur: 5,
      cam: { from: [0.3, 1.7, 1.2], to: [0.2, 1.65, 0.6], look: [0, 1.55, -1.6] },
      actors: [{ who: 'pasteur', at: [0, -1.6], pose: 'talk', then: [{ t: 2.5, pose: 'raise' }] }],
      line: { who: 'pasteur', text: t('{name} a semé l’amour dans cette famille. Aujourd’hui, nous récoltons.', { name: m.name }) },
    },
  ]
  if (kind !== 'simple') {
    shots.push({
      set: 'cour',
      mood: 'nuit',
      dur: 6,
      cam: { from: [-0.9, 1.6, 4.4], to: [-0.6, 1.6, 3.6], look: [0.2, 1.2, 0.2] },
      actors: [
        { who: 'tante', at: [-0.6, 0.2], pose: 'dance' },
        { who: 'cousine', at: [0.6, 0.2], pose: 'dance' },
        { who: 'oncle', at: [1.4, -0.4], pose: 'sit', y: 0 },
        { who: 'me', at: [0, 0.8], turn: 0.3, pose: 'idle', then: [{ t: 2.5, pose: 'hug' }] },
      ],
      line: { who: 'narr', text: t('La veillée : sous la bâche, la chorale a chanté jusqu’au matin.') },
    })
  } else {
    shots.push({
      set: 'cour',
      mood: 'jour',
      dur: 5,
      cam: { from: [0.6, 1.6, 3.8], to: [0.5, 1.6, 3.2], look: [0.2, 1.3, 0.2] },
      actors: [
        { who: 'me', at: [-0.3, 0.2], turn: 0.6, pose: 'hug' },
        { who: 'tante', at: [0.3, 0.2], turn: -0.6, pose: 'hug' },
      ],
      line: { who: 'narr', text: t('Simplement, entre proches, on s’est serré les uns contre les autres.') },
    })
  }
  if (kind === 'grande') {
    shots.push({
      set: 'rue',
      mood: 'soir',
      dur: 6,
      cam: { from: [1.3, 1.6, 4.2], to: [1.0, 1.6, 3.4], look: [0, 1.3, 0] },
      actors: [
        { who: 'danseur', at: [-0.8, 0], pose: 'dance' },
        { who: 'danseuse', at: [0.8, 0], pose: 'dance' },
        { who: 'me', at: [0, -0.6], pose: 'cheer' },
        { who: 'cousine', at: [1.6, -0.4], pose: 'dance' },
      ],
      line: { who: 'narr', text: t('L’orchestre, les tee-shirts à son effigie : tout le quartier est venu. On en parlera longtemps.') },
    })
  }
  shots.push({ set: 'ciel', dur: 5, cam: { from: [0, 0, 8], to: [0.6, -0.2, 7.4], look: [0, -0.6, 0] }, actors: [], line: { who: 'narr', text: t('Repose en paix, {name}.', { name: m.name }) } })
  return { silent: true, kicker: t('Repose en paix'), id: `funerailles-${m.at}`, title: t('Les funérailles de {name}', { name: m.name }), cast, shots }
}
