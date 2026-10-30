import { Link } from 'react-router-dom'
import { t } from '../lib/i18n'

/** Both boxes are required before a name and a contact can be kept. */
export function Consent({ terms, privacy, onTerms, onPrivacy }: { terms: boolean; privacy: boolean; onTerms: (v: boolean) => void; onPrivacy: (v: boolean) => void }) {
  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[var(--color-canvas)] px-3 py-2.5 text-left text-sm font-bold">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-orange)]" checked={terms} onChange={(e) => onTerms(e.target.checked)} />
        <span>
          {t("J'accepte les")} <Link to="/conditions" className="text-[var(--color-ink)] underline" onClick={(e) => e.stopPropagation()}>{t("conditions d'utilisation")}</Link>.
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[var(--color-canvas)] px-3 py-2.5 text-left text-sm font-bold">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-orange)]" checked={privacy} onChange={(e) => onPrivacy(e.target.checked)} />
        <span>
          {t("J'accepte que mon prénom et mon contact soient gardés pour me prévenir de l'ouverture, selon la")} <Link to="/confidentialite" className="text-[var(--color-ink)] underline" onClick={(e) => e.stopPropagation()}>{t('politique de confidentialité')}</Link>.
        </span>
      </label>
    </div>
  )
}
