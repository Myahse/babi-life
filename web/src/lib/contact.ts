import { t } from './i18n'
// How to reach Babi Life: on the Babi Pub page (/pub), advertisers contact us
// here first, before sending anything. Fill in each one as it exists; an
// empty one isn't shown.

export const CONTACT = {
  /** WhatsApp number, international, digits only: « 2250700000000 ». */
  whatsapp: '',
  email: '',
  /** Handles without the @. */
  tiktok: '',
  x: '',
  instagram: '',
  /** The page's address part: « babilife » for facebook.com/babilife. */
  facebook: '',
}

export type ContactLink = { id: keyof typeof CONTACT; label: string; href: string; shown: string }

/** The ways to reach us that are filled in, as links (the WhatsApp message and the e-mail's subject by what it's about). */
export function contactLinks(subject = t('Pub dans Babi Life'), message = t('Bonjour, je veux mettre une pub dans Babi Life.')): ContactLink[] {
  const c = CONTACT
  const out: ContactLink[] = []
  if (c.whatsapp) out.push({ id: 'whatsapp', label: t('WhatsApp'), href: `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(message)}`, shown: `+${c.whatsapp}` })
  if (c.email) out.push({ id: 'email', label: t('E-mail'), href: `mailto:${c.email}?subject=${encodeURIComponent(subject)}`, shown: c.email })
  if (c.tiktok) out.push({ id: 'tiktok', label: t('TikTok'), href: `https://www.tiktok.com/@${c.tiktok}`, shown: `@${c.tiktok}` })
  if (c.x) out.push({ id: 'x', label: 'X', href: `https://x.com/${c.x}`, shown: `@${c.x}` })
  if (c.instagram) out.push({ id: 'instagram', label: t('Instagram'), href: `https://www.instagram.com/${c.instagram}`, shown: `@${c.instagram}` })
  if (c.facebook) out.push({ id: 'facebook', label: t('Facebook'), href: `https://www.facebook.com/${c.facebook}`, shown: c.facebook })
  return out
}
