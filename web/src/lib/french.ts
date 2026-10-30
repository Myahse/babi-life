import { t } from './i18n'
// A commune's name after « à » and « de ». The Plateau is the one that takes its article, as said
// in Abidjan (« au Plateau », « la mairie du Plateau »); before a vowel « de » elides (« d'Abobo »).

/** « à Cocody », « au Plateau ». */
export function aCommune(name: string) {
  return name === 'Plateau' ? t('au Plateau') : `à ${name}`
}

/** « de Cocody », « d'Abobo », « du Plateau ». */
export function deCommune(name: string) {
  if (name === 'Plateau') return t('du Plateau')
  return /^[AEIOUÉÈÊ]/.test(name) ? `d'${name}` : `de ${name}`
}

/** The same at the start of a sentence: « Au Plateau », « À Cocody ». */
export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** « de » before a first name: « de Kofi », « d'Awa ». */
export function deNom(name: string) {
  return /^[AEIOUYÉÈÊ]/i.test(name) ? `d'${name}` : `de ${name}`
}
