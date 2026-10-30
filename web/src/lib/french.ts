import { lang } from './i18n'
// A commune's name after « à » and « de ». The Plateau is the one that takes its article, as said
// in Abidjan (« au Plateau », « la mairie du Plateau »); before a vowel « de » elides (« d'Abobo »).
// In English (lib/i18n.ts), the sentences around them are written for « in Cocody », « of Cocody ».

/** « à Cocody », « au Plateau » (English: « in Cocody »). */
export function aCommune(name: string) {
  if (lang() === 'en') return `in ${name}`
  return name === 'Plateau' ? 'au Plateau' : `à ${name}`
}

/** « de Cocody », « d'Abobo », « du Plateau » (English: « of Cocody »). */
export function deCommune(name: string) {
  if (lang() === 'en') return `of ${name}`
  if (name === 'Plateau') return 'du Plateau'
  return /^[AEIOUÉÈÊ]/.test(name) ? `d'${name}` : `de ${name}`
}

/** The same at the start of a sentence: « Au Plateau », « À Cocody ». */
export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** « de » before a first name: « de Kofi », « d'Awa » (English: « of Kofi »). */
export function deNom(name: string) {
  if (lang() === 'en') return `of ${name}`
  return /^[AEIOUYÉÈÊ]/i.test(name) ? `d'${name}` : `de ${name}`
}
