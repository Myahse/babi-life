import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { api, errorText } from '../lib/api'
import { t } from '../lib/i18n'
import { ContactEmail, LegalFrame } from './Legal'

// /suppression-compte: the public page Google Play links to. How to delete
// one's account from the game, what goes, and, for someone who can't sign in
// any more, a form asking the team to do it (backend account.Requests, seen
// on /admin › « Suppressions »). Open to everyone, before and after the opening.

export function AccountDeletion() {
  useEffect(() => void (document.title = t('Supprimer son compte · Babi Life')), [])
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [note, setNote] = useState('')
  const [website, setWebsite] = useState('') // unseen: only bots fill it
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.askDeletion({ email: email.trim(), username: username.trim(), note: note.trim(), website })
      setSent(true)
    } catch (x) {
      setError(errorText(x))
    } finally {
      setBusy(false)
    }
  }

  return (
    <LegalFrame>
      <h1 className="font-display text-3xl leading-tight font-extrabold">{t('Supprimer son compte Babi Life')}</h1>
      <p>{t('Tu peux supprimer ton compte Babi Life quand tu veux, gratuitement. C’est définitif : ton compte et ton perso ne pourront pas être récupérés.')}</p>

      <h2 className="font-display pt-3 text-xl leading-tight font-extrabold">{t('Depuis le jeu (le plus rapide)')}</h2>
      <ol className="list-decimal space-y-2 pl-5">
        <li>{t('Connecte-toi sur lifeinbabi.com ou dans l’appli Android.')}</li>
        <li>{t('Ouvre le téléphone de ton perso, puis l’appli « Réglages ».')}</li>
        <li>{t('Tout en bas : « Supprimer mon compte ».')}</li>
        <li>{t('Confirme avec ton mot de passe (ou, pour un compte Google, en tapant ton pseudo). C’est fait tout de suite.')}</li>
      </ol>

      <h2 className="font-display pt-3 text-xl leading-tight font-extrabold">{t('Ce qui est effacé')}</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>{t('Ton compte : nom, e-mail, pseudo, mot de passe ou lien Google, langue, appareils connectés et notifications.')}</li>
        <li>{t('Ton perso et toute sa vie : argent, maison, véhicules, amis, couple, journal, partis et gangs.')}</li>
        <li>{t('Tes messages Gbairai (aussi du côté des autres joueurs), tes posts, stories, photos, vidéos, commentaires, idées et signalements.')}</li>
        <li>{t("Ton inscription sur la liste d'attente avec le même e-mail.")}</li>
      </ul>
      <h2 className="font-display pt-3 text-xl leading-tight font-extrabold">{t('Ce qui est gardé')}</h2>
      <p>{t("La trace de tes paiements (montant, date, référence), sans ton nom ni ton perso, le temps exigé par les règles comptables (jusqu'à 10 ans). Les achats ne sont pas remboursés. Si tu t'es désinscrit·e des e-mails, ton adresse reste sur la liste à ne plus jamais écrire.")}</p>

      <h2 className="font-display pt-3 text-xl leading-tight font-extrabold">{t('Tu ne peux plus te connecter ?')}</h2>
      {sent ? (
        <p className="flex items-start gap-2 rounded-xl bg-[#e7f7ee] p-3 font-bold text-[#0b6b3d]" role="status">
          <Check size={20} strokeWidth={3} className="mt-0.5 shrink-0" />
          {t('Demande reçue. On vérifie que le compte est bien le tien (on peut t’écrire à cet e-mail), puis on le supprime, sous 30 jours au plus.')}
        </p>
      ) : (
        <form className="space-y-3" onSubmit={(e) => void send(e)}>
          <p>{t("Demande-nous de le supprimer : donne l'e-mail du compte et ton pseudo. L'équipe vérifie que c'est bien le tien, puis le supprime.")}</p>
          <label className="block">
            <span className="text-xs font-extrabold">{t("L'e-mail du compte")}</span>
            <input className="input mt-1 text-base" type="email" required autoComplete="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs font-extrabold">{t('Ton pseudo (si tu t’en souviens)')}</span>
            <input className="input mt-1 text-base" autoComplete="username" autoCapitalize="none" maxLength={40} value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs font-extrabold">{t('Un mot pour l’équipe (facultatif)')}</span>
            <textarea className="input mt-1 !h-24 py-2 text-base" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {/* Hidden from people: only bots fill it */}
          <input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
          {error && <p className="text-sm font-bold text-[var(--color-rose)]">{error}</p>}
          <button className="btn w-full" disabled={busy || !email.trim()}>
            {busy ? t('Envoi…') : t('Demander la suppression')}
          </button>
        </form>
      )}
      <p>
        {t('Une question ? Écris-nous :')} <ContactEmail />. {t('Le détail de ce que le jeu garde est dans la')} <Link to="/confidentialite" className="underline">{t('politique de confidentialité')}</Link>.
      </p>
    </LegalFrame>
  )
}
