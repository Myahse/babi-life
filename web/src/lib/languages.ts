import type { Sim } from './types'
import { t } from './i18n'

// The languages of the street beside French (backend game/languages.go holds
// the same lists: a passer-by speaks the same languages here and on the
// server), and what the Sim says to greet in them, by the time of day.

export const LANGUAGES = [
  { id: 'dioula', label: t('Dioula') },
  { id: 'baoule', label: t('Baoulé') },
  { id: 'bete', label: t('Bété') },
  { id: 'senoufo', label: t('Sénoufo') },
  { id: 'malinke', label: t('Malinké') },
  { id: 'agni', label: t('Agni') },
  { id: 'attie', label: t('Attié') },
  { id: 'guere', label: t('Guéré') },
  { id: 'yacouba', label: t('Yacouba') },
  { id: 'gouro', label: t('Gouro') },
  { id: 'abron', label: t('Abron') },
  { id: 'ebrie', label: t('Ébrié') },
  { id: 'anglais', label: t('Anglais') },
] as const

export const languageLabel = (id: string) => LANGUAGES.find((l) => l.id === id)?.label ?? id

const MOTHER = ['baoule', 'baoule', 'baoule', 'baoule', 'baoule', 'dioula', 'dioula', 'dioula', 'dioula', 'malinke', 'malinke', 'senoufo', 'senoufo', 'bete', 'bete', 'agni', 'attie', 'guere', 'yacouba', 'ebrie']

/** What a passer-by speaks besides French: their mother tongue, Dioula six times in ten (always for a Malinké), English one time in ten. */
export function npcLanguages(seed: number): string[] {
  const s = Math.abs(Math.floor(seed))
  const m = MOTHER[s % MOTHER.length]
  const out = [m]
  if (m !== 'dioula' && (m === 'malinke' || Math.floor(s / 20) % 10 < 6)) out.push('dioula')
  if (Math.floor(s / 200) % 10 === 0) out.push('anglais')
  return out
}

/** The Sim's greeting in a language, at that hour, to a man or a woman (Dioula and Baoulé after the courses; the rest without words the game is sure of). */
export function greetingIn(lang: string, gameMinutes: number, to: Sim['gender']): string {
  const h = (gameMinutes / 60) % 24
  switch (lang) {
    case 'dioula':
      return h >= 4 && h < 10 ? t('I ni sɔ̀gɔma !') : h < 16.5 && h >= 10 ? t('I ni tere !') : h >= 16.5 && h < 19 ? t('I ni wula !') : t('I ni su !')
    case 'baoule': {
      const who = to === 'femme' ? t('Mmo') : t('Nja')
      return h >= 4 && h < 11 ? t('{who} anyin o !', { who }) : h >= 11 && h < 17 ? t('{who} aanti !', { who }) : t('{who} anun o !', { who })
    }
    case 'bete':
      return t('Ayo !')
    case 'anglais':
      return t('Hello! How are you?')
    default:
      return t('(Tu salues en {0})', { 0: languageLabel(lang).toLowerCase() })
  }
}

/** Taking leave in a language you share, else in French. */
export function goodbyeIn(shared: string | undefined, name: string): string {
  if (shared === 'dioula') return t("K'an bɛ, {name} !", { name })
  if (shared === 'baoule') return t('E wo aiman, {name} !', { name })
  if (shared === 'anglais') return t('Bye, {name}!', { name })
  return t('Au revoir, {name}', { name })
}
