import { useState } from 'react'
import { Check, Copy, MessageCircle, Users } from 'lucide-react'
import { t } from '../lib/i18n'

/** The Babi Life group on WhatsApp. */
export const WHATSAPP_COMMUNITY = 'https://chat.whatsapp.com/Lg3fgekmf6z6fS3J5jPZPi'

export function Community({ className = t('btn btn-soft w-full') }: { className?: string }) {
  return (
    <a className={className} href={WHATSAPP_COMMUNITY} target="_blank" rel="noreferrer">
      <Users size={18} strokeWidth={2.6} /> {t('Rejoindre la communauté')}
    </a>
  )
}

/** Tell the others: WhatsApp first (that's where Babi talks), or copy the link. */
export function Share() {
  const [copied, setCopied] = useState(false)
  const link = `${location.origin}/liste`
  const text = t('Babi Life arrive : crée ton perso, construis ta maison et vis Abidjan avec nous. Inscris-toi : {link}', { link })
  return (
    <div className="mt-1 flex w-full flex-col gap-2">
      <Community />
      <a className="btn btn-emerald w-full" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
        <MessageCircle size={18} strokeWidth={2.6} /> {t('Partager sur WhatsApp')}
      </a>
      <button className="btn btn-soft w-full" onClick={() => navigator.clipboard?.writeText(link).then(() => setCopied(true))}>
        {copied ? <Check size={18} strokeWidth={2.6} /> : <Copy size={18} strokeWidth={2.6} />} {copied ? t('Lien copié') : t('Copier le lien')}
      </button>
    </div>
  )
}
