import { useEffect, useState } from 'react'
import { ChevronRight, Utensils, BedDouble, ShowerHead, Users, PartyPopper, BookOpen, HandHelping, Sparkles, MapPin, type LucideIcon } from 'lucide-react'
import { api } from '../lib/api'
import type { ErrandStep, NeedKey, Sim } from '../lib/types'
import { keyOpenNow } from '../lib/features'
import { t } from '../lib/i18n'

// « Et maintenant, je fais quoi ? » never asked: under the profile, the next thing to do, one line, and a
// tap takes the Sim there. In order: a need that's run out (hungry, worn out, dirty…), the story's step,
// a demande of the quartier, a need running low, else a story to pick. Asked again as the journal moves.

export type Goal = { icon: LucideIcon; label: string; text: string; color: string; go: { kind: string; city?: string; /** A place to walk to by its id (a city's landmark). */ place?: string } | { app: 'demandes' } }

// What a need asks for, and where (the kind of place the phone walks to).
const NEED_GOAL: Record<NeedKey, () => Omit<Goal, 'label'>> = {
  hunger: () => ({ icon: Utensils, text: t('Va manger un garba au maquis'), color: '#e8590c', go: { kind: 'maquis' } }),
  energy: () => ({ icon: BedDouble, text: t('Rentre dormir chez toi'), color: '#5f3dc4', go: { kind: 'home' } }),
  hygiene: () => ({ icon: ShowerHead, text: t('Rentre prendre une douche'), color: '#1c7ed6', go: { kind: 'home' } }),
  social: () => ({ icon: Users, text: t('Va voir du monde au maquis'), color: '#2f9e44', go: { kind: 'maquis' } }),
  fun: () => ({ icon: PartyPopper, text: t('Va t’amuser dans la rue d’ambiance'), color: '#d6336c', go: { kind: 'rue' } }),
}
const NEED_LABEL: Record<NeedKey, () => string> = {
  hunger: () => t('Tu as faim'),
  energy: () => t('Tu es épuisé·e'),
  hygiene: () => t('Tu sens un peu…'),
  social: () => t('Tu te sens seul·e'),
  fun: () => t('Tu t’ennuies'),
}

/**
 * What to discover in a city once its update is open (backend game/villes2.go): arrived by the coach or the
 * plane, nothing pressing, the chip points at one of its places, a different one each game day.
 */
const DISCOVER: Record<string, { key: string; places: [string, string, () => string][] }> = {
  'san-pedro': {
    key: 'sanpedro-vivant',
    places: [
      ['sp-port', 'office', () => t('Va voir le port du cacao et ses grues')],
      ['sp-peche', 'peche', () => t('Va voir rentrer les pirogues au port de pêche')],
      ['sp-monogaga', 'beach', () => t('Va te baigner à la plage de Monogaga')],
      ['sp-tai-excursions', 'excursion', () => t('Prépare ta journée en forêt de Taï')],
      ['sp-bardot', 'rue', () => t('Va faire l’ambiance au Bardot')],
    ],
  },
  korhogo: {
    key: 'korhogo-vivant',
    places: [
      ['korhogo-waraniene', 'artisans', () => t('Va tisser avec les tisserands de Waraniéné')],
      ['korhogo-mont', 'nature', () => t('Monte sur le rocher du mont Korhogo')],
      ['korhogo-marche', 'market', () => t('Trouve une vraie toile de Korhogo au marché')],
      ['korhogo-fakaha', 'artisans', () => t('Va voir les peintres de Fakaha')],
      ['korhogo-koni', 'artisans', () => t('Va voir les forgerons de Koni')],
    ],
  },
}
const discoverGoal = (sim: Sim): Goal | null => {
  const d = DISCOVER[sim.city]
  if (!d || !keyOpenNow(d.key)) return null
  const [place, kind, text] = d.places[Math.floor(sim.gameMinutes / 1440) % d.places.length]
  return { icon: MapPin, label: t('À découvrir ici'), text: text(), color: '#0ca678', go: { kind, place } }
}

const lowest = (sim: Sim, under: number): NeedKey | null => {
  const keys = (['hunger', 'energy', 'hygiene', 'social', 'fun'] as NeedKey[]).filter((k) => sim.needs[k] < under).sort((a, b) => sim.needs[a] - sim.needs[b])
  return keys[0] ?? null
}
const needGoal = (k: NeedKey): Goal => ({ ...NEED_GOAL[k](), label: NEED_LABEL[k]() })
const stepGoal = (step: ErrandStep, label: string, icon: LucideIcon, color: string): Goal => ({ icon, label, text: step.text, color, go: { kind: step.kind, city: step.city } })

/** The next thing to do, from the Sim and its demandes (null: nothing to say). */
export function useNextGoal(sim: Sim | null, key: unknown): Goal | null {
  const [errands, setErrands] = useState<Awaited<ReturnType<typeof api.errands>> | null>(null)
  const id = sim?.id
  useEffect(() => {
    if (!id) return
    let live = true
    api
      .errands(id)
      .then((r) => live && setErrands(r))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [id, key])
  if (!sim) return null
  const urgent = lowest(sim, 22)
  if (urgent) return needGoal(urgent)
  const story = errands?.story
  if (story && !story.waiting && story.steps[story.step]) {
    const step = story.steps[story.step]
    return stepGoal(step, step.epreuve ? t('L’épreuve de « {title} »', { title: story.title }) : t('Ton histoire · « {title} »', { title: story.title }), step.epreuve ? Sparkles : BookOpen, step.epreuve ? '#f08c00' : '#7048e8')
  }
  const errand = errands?.errands.find((e) => !e.done && e.steps[e.step])
  if (errand) return stepGoal(errand.steps[errand.step], t('{giver} te demande', { giver: errand.giver }), HandHelping, '#2b8a3e')
  const low = lowest(sim, 45)
  if (low) return needGoal(low)
  if (!story && errands?.choices?.length && !errands.startsTomorrow) return { icon: BookOpen, label: t('Une histoire t’attend'), text: t('Choisis ta prochaine histoire'), color: '#7048e8', go: { app: 'demandes' } }
  return discoverGoal(sim)
}

/** The chip: the goal in a line, and « Y aller ». */
export function NextGoal({ goal, onGo, className = '' }: { goal: Goal; onGo: (g: Goal) => void; className?: string }) {
  const Icon = goal.icon
  return (
    <button key={goal.text} onClick={() => onGo(goal)} className={`hud animate-pop pointer-events-auto flex max-w-[min(78vw,360px)] items-center gap-2 rounded-2xl py-1.5 pr-2 pl-1.5 text-left transition active:scale-95 ${className}`} aria-label={`${goal.label} : ${goal.text}`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: goal.color }}>
        <Icon size={19} strokeWidth={2.6} />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[11px] font-extrabold text-[var(--color-ink-soft)]">{goal.label}</span>
        <span className="block truncate text-[13.5px] font-extrabold">{goal.text}</span>
      </span>
      <span className="flex shrink-0 items-center rounded-full bg-[var(--color-ink)] py-1 pr-1.5 pl-2.5 text-[11px] font-extrabold text-white">
        {t('Y aller')}
        <ChevronRight size={14} strokeWidth={3} />
      </span>
    </button>
  )
}
