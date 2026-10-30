import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { t } from '../lib/i18n'

// On the home page (Title, or the wish list before the opening) right after
// the account was deleted from the game (components/DeleteAccount.tsx: ?compte=supprime).
export function AccountGone() {
  const { search } = useLocation()
  const [shut, setShut] = useState(false)
  if (shut || new URLSearchParams(search).get('compte') !== 'supprime') return null
  return (
    <div className="px-4">
      <div role="status" className="mx-auto mt-4 flex max-w-6xl items-start gap-3 border-2 border-[var(--brown)] bg-[var(--cream)] px-4 py-3 text-[var(--brown)]">
        <Check size={22} strokeWidth={3} className="mt-0.5 shrink-0 text-[#00894f]" />
        <p className="min-w-0 flex-1 text-sm leading-snug font-bold">
          <b className="font-extrabold">{t('Ton compte a été supprimé.')}</b> {t("Ton perso et tout ce qui le concernait ont été effacés. Merci d'avoir joué à Babi Life !")}
        </p>
        <button aria-label={t('Fermer')} className="shrink-0" onClick={() => setShut(true)}>
          <X size={20} />
        </button>
      </div>
    </div>
  )
}
