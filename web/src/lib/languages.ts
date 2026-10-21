import type { Sim } from './types'

// The languages of the street beside French (backend game/languages.go holds
// the same lists: a passer-by speaks the same languages here and on the
// server), and what the Sim says to greet in them, by the time of day.

export const LANGUAGES = [
  { id: 'dioula', label: 'Dioula' },
  { id: 'baoule', label: 'Baoulé' },
  { id: 'bete', label: 'Bété' },
  { id: 'senoufo', label: 'Sénoufo' },
  { id: 'malinke', label: 'Malinké' },
  { id: 'agni', label: 'Agni' },
  { id: 'attie', label: 'Attié' },
  { id: 'guere', label: 'Guéré' },
  { id: 'yacouba', label: 'Yacouba' },
  { id: 'gouro', label: 'Gouro' },
  { id: 'abron', label: 'Abron' },
  { id: 'ebrie', label: 'Ébrié' },
  { id: 'anglais', label: 'Anglais' },
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
      return h >= 4 && h < 10 ? 'I ni sɔ̀gɔma !' : h < 16.5 && h >= 10 ? 'I ni tere !' : h >= 16.5 && h < 19 ? 'I ni wula !' : 'I ni su !'
    case 'baoule': {
      const who = to === 'femme' ? 'Mmo' : 'Nja'
      return h >= 4 && h < 11 ? `${who} anyin o !` : h >= 11 && h < 17 ? `${who} aanti !` : `${who} anun o !`
    }
    case 'bete':
      return 'Ayo !'
    case 'anglais':
      return 'Hello! How are you?'
    default:
      return `(Tu salues en ${languageLabel(lang).toLowerCase()})`
  }
}

/** Taking leave in a language you share, else in French. */
export function goodbyeIn(shared: string | undefined, name: string): string {
  if (shared === 'dioula') return `K'an bɛ, ${name} !`
  if (shared === 'baoule') return `E wo aiman, ${name} !`
  if (shared === 'anglais') return `Bye, ${name}!`
  return `Au revoir, ${name}`
}
