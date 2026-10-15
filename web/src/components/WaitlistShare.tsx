import { useState } from 'react'
import { Check, Copy, MessageCircle } from 'lucide-react'

/** Tell the others: WhatsApp first (that's where Babi talks), or copy the link. */
export function Share() {
  const [copied, setCopied] = useState(false)
  const link = `${location.origin}/liste`
  const text = `Babi Life arrive : crée ton Sim, construis ta maison et vis Abidjan avec nous. Inscris-toi : ${link}`
  return (
    <div className="mt-1 flex w-full flex-col gap-2">
      <a className="btn btn-emerald w-full" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
        <MessageCircle size={18} strokeWidth={2.6} /> Partager sur WhatsApp
      </a>
      <button className="btn btn-soft w-full" onClick={() => navigator.clipboard?.writeText(link).then(() => setCopied(true))}>
        {copied ? <Check size={18} strokeWidth={2.6} /> : <Copy size={18} strokeWidth={2.6} />} {copied ? 'Lien copié' : 'Copier le lien'}
      </button>
    </div>
  )
}
