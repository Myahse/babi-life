import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Trash2 } from 'lucide-react'
import { api, errorText } from '../lib/api'
import { useSession } from '../store/session'
import { IconTile } from './ui'
import { t } from '../lib/i18n'

// « Réglages » › « Supprimer mon compte »: what goes, that it's for good, the
// password (or the username, for a Google account) typed again, then the
// account is deleted on the server (backend internal/account), the phone signed
// out, and the home page says it's done (components/AccountGone.tsx).
// Always there, never behind an update: Google Play and the law ask for it.

export function DeleteAccount({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate()
  const signOut = useSession((s) => s.signOut)
  const [check, setCheck] = useState<{ password: boolean; word?: string } | null>(null)
  const [value, setValue] = useState('')
  const [sure, setSure] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api.deleteInfo().then(setCheck, (e) => setError(errorText(e)))
  }, [])

  const go = async () => {
    if (!check) return
    setBusy(true)
    setError(null)
    try {
      await api.deleteAccount(check.password ? { password: value } : { confirm: value })
      signOut()
      navigate('/?compte=supprime', { replace: true })
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 p-4">
      <button className="inline-flex items-center gap-1 text-[14px] font-extrabold text-[var(--color-ink-soft)]" onClick={onBack}>
        <ChevronLeft size={18} strokeWidth={2.6} /> {t('Réglages')}
      </button>
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center gap-3">
          <IconTile icon={Trash2} colors={['#ff8a9b', '#e11d48']} size={42} />
          <h2 className="font-display text-[19px] leading-tight font-extrabold">{t('Supprimer mon compte')}</h2>
        </div>
        <p className="mt-3 text-[14px] leading-snug font-extrabold text-[var(--color-rose)]">{t("C'est définitif : rien ne pourra être récupéré.")}</p>
        <p className="mt-2 text-[13px] font-extrabold">{t('Ce qui est effacé :')}</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] leading-snug font-bold text-[var(--color-ink-soft)]">
          <li>{t('ton compte : nom, e-mail, pseudo, mot de passe ou lien Google, langue ;')}</li>
          <li>{t('ton perso et toute sa vie : argent, maison, véhicules, amis, couple, famille, journal ;')}</li>
          <li>{t('tes posts, stories, photos, vidéos, commentaires et likes ;')}</li>
          <li>{t('tes idées, tes signalements, tes appareils connectés et tes notifications ;')}</li>
          <li>{t("ton inscription sur la liste d'attente, s'il y en a une avec ton e-mail.")}</li>
        </ul>
        <p className="mt-2 text-[13px] leading-snug font-bold text-[var(--color-ink-soft)]">{t('Les autres joueurs ne te voient plus. Les messages que tu as envoyés restent chez les personnes qui les ont reçus, signés « Compte supprimé », sans ton nom ni ta photo.')}</p>
        <p className="mt-2 text-[13px] leading-snug font-bold text-[var(--color-ink-soft)]">{t('Tes achats (Djai, habits, pass) ne sont pas remboursés. Une trace de chaque paiement est gardée, sans ton nom, pour la comptabilité.')}</p>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        {!check && !error && <p className="text-[13px] font-bold text-[var(--color-ink-soft)]">{t('Chargement…')}</p>}
        {check && (
          <>
            <label className="block text-[13px] font-extrabold" htmlFor="delete-confirm">
              {check.password ? t('Ton mot de passe, pour confirmer') : t('Tape « {word} » pour confirmer', { word: check.word ?? '' })}
            </label>
            <input
              id="delete-confirm"
              className="input mt-1.5 text-base"
              type={check.password ? 'password' : 'text'}
              autoComplete={check.password ? 'current-password' : 'off'}
              autoCapitalize="none"
              spellCheck={false}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <label className="mt-3 flex items-start gap-2 text-[13px] leading-snug font-bold">
              <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-rose)]" checked={sure} onChange={(e) => setSure(e.target.checked)} />
              {t("J'ai compris : mon compte et mon perso seront supprimés pour toujours.")}
            </label>
          </>
        )}
        {error && <p className="mt-3 text-sm font-bold text-[var(--color-rose)]">{error}</p>}
        <button className="btn mt-4 w-full !bg-[var(--color-rose)]" disabled={!check || !sure || !value.trim() || busy} onClick={() => void go()}>
          {busy ? t('Suppression…') : t('Supprimer définitivement')}
        </button>
        <button className="btn btn-soft mt-2 w-full" onClick={onBack}>
          {t('Annuler')}
        </button>
      </div>
    </div>
  )
}
