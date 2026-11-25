import { useEffect } from 'react'
import { ExternalLink, Megaphone, X } from 'lucide-react'
import { useVitrine } from '../lib/vitrine'
import { t } from '../lib/i18n'

// La vitrine (the update « pub-vitrine »): the ad of the board tapped, big (its poster, or its video playing),
// the advertiser and the title, a button to its site or its app; the tap counted for the advertiser (by
// commune and day, nobody tracked: backend ads.Clicked). An empty board: « Ta pub ici », the way to Babi Pub.

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

export function Vitrine() {
  const { ad, empty, commune, close } = useVitrine()
  useEffect(() => {
    if (!ad) return
    void fetch(`${BASE}/ads/clicks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commune, id: ad.id }), keepalive: true }).catch(() => undefined)
  }, [ad, commune])
  if (!ad && !empty) return null
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 p-3 sm:items-center" onClick={close}>
      <div className="animate-pop w-full max-w-md overflow-hidden rounded-[26px] bg-white text-[#1b1b2f] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative bg-black">
          {ad ? (
            ad.type === 'video' ? (
              <video src={ad.url} className="max-h-[55vh] w-full object-contain" autoPlay muted loop playsInline controls />
            ) : (
              <img src={ad.url} alt={ad.title} className="max-h-[55vh] w-full object-contain" />
            )
          ) : (
            <div className="grid h-48 place-items-center bg-[#ff8200] text-center">
              <div>
                <Megaphone size={44} className="mx-auto text-white" />
                <p className="mt-2 text-3xl font-black text-[#1b1b2f]">{t('TA PUB ICI')}</p>
              </div>
            </div>
          )}
          <button className="absolute top-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white" onClick={close} aria-label={t('Fermer')}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 p-4">
          {ad ? (
            <>
              <div className="flex items-center gap-3">
                {ad.icon && <img src={ad.icon} alt="" className="h-11 w-11 rounded-[10px] object-cover" />}
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold tracking-wide text-[#5c5f73] uppercase">{t('Vitrine')}</p>
                  <p className="truncate text-lg font-black">{ad.advertiser}</p>
                  {ad.title && <p className="text-sm font-bold text-[#5c5f73]">{ad.title}</p>}
                </div>
              </div>
              {ad.link && (
                <a className="btn w-full justify-center" href={ad.link} target="_blank" rel="noopener noreferrer sponsored">
                  <ExternalLink size={16} /> {ad.appName ? t('Ouvrir {app}', { app: ad.appName }) : t('Voir le site')}
                </a>
              )}
              <p className="text-center text-[11px] font-bold text-[#5c5f73]">{t('Publicité · Babi Pub')}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold">{t('Ce panneau est libre. Les joueurs passent devant tous les jours : mets-y ton affiche ou ta vidéo, et ta vitrine s’ouvre quand ils le touchent.')}</p>
              <a className="btn w-full justify-center" href="/pub" target="_blank" rel="noopener noreferrer">
                <Megaphone size={16} /> {t('Mettre ma pub ici')}
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
