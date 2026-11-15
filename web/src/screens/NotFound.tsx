import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/ui'
import { t } from '../lib/i18n'

/**
 * An address the site doesn't have. Vercel sends every path to index.html, so the answer is still a 200:
 * the page says so to people, and « noindex » to search engines (put back as it was on leaving).
 */
export function NotFound() {
  useEffect(() => {
    document.title = t('Page introuvable · Babi Life')
    const meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]') ?? document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'robots' }))
    const was = meta.content
    meta.content = 'noindex'
    return () => void (meta.content = was)
  }, [])
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-5 bg-[var(--color-night)] px-5 py-10 text-center text-white">
      <Logo size={40} />
      <div className="card w-full max-w-md p-6 text-[var(--color-ink)]">
        <p className="font-display text-5xl font-extrabold text-[var(--color-orange)]">404</p>
        <h1 className="font-display mt-2 text-2xl leading-tight font-extrabold">{t('Page introuvable')}</h1>
        <p className="mt-2 text-sm font-semibold text-[var(--color-ink-soft)]">{t('Cette adresse ne mène nulle part à Babi. Le lien est peut-être ancien, ou mal écrit.')}</p>
        <Link to="/" className="btn mt-5 w-full">
          {t("Retour à l'accueil")}
        </Link>
      </div>
    </div>
  )
}
