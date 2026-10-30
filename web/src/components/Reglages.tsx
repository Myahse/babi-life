import { useState } from 'react'
import { Languages, RotateCw, Smartphone } from 'lucide-react'
import { canLock, landscapeOn, setLandscape, useLandscape, usePortraitNow } from '../lib/landscape'
import { IconTile } from './ui'
import { lang, LANGS, setLang, t, type Lang } from '../lib/i18n'

// The phone's « Réglages » app: how the game is shown on this phone. Held
// sideways (lib/landscape.ts): the whole screen, the street wider. And the
// game's language (lib/i18n.ts): French, or English.

export function ReglagesApp() {
  const on = useLandscape()
  const [note, setNote] = useState<string | null>(null)
  const [picked, setPicked] = useState<Lang>(lang())
  const choose = (l: Lang) => {
    if (l === picked) return
    setPicked(l)
    // The game loads again in it (its lists are made as it loads).
    setLang(l)
  }
  const toggle = async () => {
    const next = !landscapeOn()
    const done = await setLandscape(next)
    setNote(next && !done ? t('Tourne ton téléphone sur le côté : le jeu suit.') : null)
  }
  return (
    <div className="space-y-3 p-4">
      <button className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-black/5" onClick={() => void toggle()}>
        <IconTile icon={Smartphone} colors={['#ffa040', '#ff6a00']} size={42} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block font-display text-[16px] font-extrabold">{t('Jouer en paysage')}</span>
          <span className="block text-[12.5px] font-bold text-[var(--color-ink-soft)]">{t("Le téléphone sur le côté, le jeu sur tout l'écran.")}</span>
        </span>
        <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-[var(--color-emerald)]' : 'bg-black/15'}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
        </span>
      </button>
      <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center gap-3">
          <IconTile icon={Languages} colors={['#3aa6ff', '#2563eb']} size={42} />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block font-display text-[16px] font-extrabold">{t('Langue')}</span>
            <span className="block text-[12.5px] font-bold text-[var(--color-ink-soft)]">{t('Le jeu dans ta langue.')}</span>
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('Langue')}>
          {LANGS.map((l) => (
            <button
              key={l.id}
              role="radio"
              aria-checked={picked === l.id}
              className={`rounded-xl px-3 py-2.5 text-[14.5px] font-extrabold transition ${picked === l.id ? 'bg-[var(--color-ink)] text-white' : 'bg-black/5 text-[var(--color-ink)]'}`}
              onClick={() => choose(l.id)}
            >
              {l.native}
            </button>
          ))}
        </div>
        {picked !== lang() && <p className="mt-2 text-[12px] font-bold text-[var(--color-ink-soft)]">{picked === 'en' ? t('Switching to English…') : t('On passe en français…')}</p>}
      </div>
      {(note || (on && !canLock())) && (
        <p className="flex items-center gap-2 rounded-2xl bg-[#fff4e6] p-3 text-[13px] font-bold text-[var(--color-ink)]">
          <RotateCw size={18} className="shrink-0 text-[var(--color-orange)]" /> {note ?? t('Ton téléphone ne tourne pas tout seul : tiens-le sur le côté, le jeu suit.')}
        </p>
      )}
    </div>
  )
}

/** Over the game, while the landscape is asked for and the phone is upright where the browser can't turn it. */
export function LandscapeHint() {
  const on = useLandscape()
  const portrait = usePortraitNow()
  const [shut, setShut] = useState(false)
  if (!on || !portrait || canLock() || shut) return null
  return (
    <button className="fixed inset-x-4 bottom-28 z-[70] mx-auto flex max-w-[360px] items-center gap-3 rounded-2xl bg-[#0f1230]/90 p-3 text-left text-white shadow-xl" onClick={() => setShut(true)}>
      <RotateCw size={26} className="shrink-0 text-[#ffc233]" />
      <span className="text-[13.5px] leading-snug font-extrabold">{t('Tourne ton téléphone sur le côté pour jouer en paysage.')}</span>
    </button>
  )
}
