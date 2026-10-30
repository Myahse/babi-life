import { useState } from 'react'
import { X, type LucideIcon } from 'lucide-react'
import { fcfa } from '../game/rules'
import { IconTile } from './ui'
import { t } from '../lib/i18n'

/** The least one may put on a game, when one plays for money. */
export const MIN_STAKE = 100
const USUAL = [500, 1000, 2000, 5000, 10000, 20000]

/**
 * How much to put on a game (dames, 8 américain): any amount typed, or a
 * usual one in a tap, or « Pour le plaisir ». No more than one has, nor than
 * the other side allows (max). What's typed stays as typed; it's checked,
 * not changed under the fingers.
 */
export function StakeSheet({ label, against, icon, colors, note, max, money, onPick, onClose }: { label: string; against: string; icon: LucideIcon; colors: [string, string]; /** How the pot is shared. */ note: string; max: number; money: number; onPick: (stake: number) => void; onClose: () => void }) {
  const [text, setText] = useState('')
  const amount = Number(text) || 0
  const why = !text ? '' : amount < MIN_STAKE ? t('{0} au moins', { 0: fcfa(MIN_STAKE) }) : amount > max ? t('{0} au plus pour cette partie', { 0: fcfa(max) }) : amount > money ? t("Tu n'as pas assez") : ''
  const usual = USUAL.filter((v) => v <= max)
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-[#0f1230]/25 lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up w-full rounded-t-[28px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:w-[420px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <IconTile icon={icon} colors={colors} size={44} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="label">{label}</div>
            <div className="truncate font-display text-[17px] font-extrabold">{t('avec')} {against}</div>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-canvas)]" onClick={onClose} aria-label={t('Fermer')}>
            <X size={18} />
          </button>
        </div>
        <p className="mt-3 text-sm font-bold text-[var(--color-ink-soft)]">{t('On joue pour combien ?')} {note}</p>
        <label className="mt-3 flex items-center gap-2 rounded-2xl bg-[var(--color-canvas)] px-4 py-3">
          <span className="label">{t('Mise')}</span>
          <input
            inputMode="numeric"
            autoFocus
            placeholder="0"
            value={text}
            onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && !why && amount > 0 && onPick(amount)}
            className="min-w-0 flex-1 bg-transparent text-right font-display text-2xl font-extrabold outline-none"
            aria-label={t('Mise en Djai')}
          />
          <span className="text-sm font-extrabold text-[var(--color-ink-soft)]">{t('Djai')}</span>
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {usual.map((v) => (
            <button key={v} className={`flex-auto rounded-full px-3 py-1.5 text-[13px] font-extrabold disabled:opacity-40 ${amount === v ? 'bg-[var(--color-ink)] text-white' : 'bg-[var(--color-canvas)]'}`} disabled={v > money} onClick={() => setText(String(v))}>
              {fcfa(v)}
            </button>
          ))}
        </div>
        <p className="mt-1.5 h-4 text-xs font-bold text-[#d81b3f]">{why}</p>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <button className="btn btn-soft !py-2.5 !text-sm" onClick={() => onPick(0)}>
            {t('Pour le plaisir')}
          </button>
          <button className="btn !py-2.5 !text-sm" style={{ background: colors[1] }} disabled={!amount || !!why} onClick={() => onPick(amount)}>
            {amount && !why ? t('Miser {0}', { 0: fcfa(amount) }) : t('Miser')}
          </button>
        </div>
      </div>
    </div>
  )
}
