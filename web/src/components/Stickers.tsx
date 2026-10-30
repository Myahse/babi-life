import { cardPreview } from './SharedCard'
import { t as tr } from '../lib/i18n'

// Gbairai's stickers and emoji. A sticker is sent as a short message,
// « [sticker:id] » (the server lets it through like any text), and drawn big
// in the chat: a picture made of emoji and the word of the street that goes
// with it, as everybody sends them in Abidjan. The emoji are a panel of the
// ones used most, put into the message.

export type Sticker = { id: string; emoji: string; text: string; bg: string; fg?: string }

export const STICKERS: Sticker[] = [
  { id: 'on-dit-quoi', emoji: '👋😎', text: tr('On dit quoi ?'), bg: '#ff7a00' },
  { id: 'cest-comment', emoji: '🤙', text: tr('C’est comment ?'), bg: '#00a862' },
  { id: 'yako', emoji: '🫂', text: tr('Yako !'), bg: '#7b5cff' },
  { id: 'ca-va-aller', emoji: '🙏✨', text: tr('Ça va aller'), bg: '#1c7ed6' },
  { id: 'cest-doux', emoji: '😋🔥', text: tr('C’est doux !'), bg: '#e8590c' },
  { id: 'woyo', emoji: '😂😂', text: tr('Woyo !'), bg: '#f2c94c', fg: '#3a2a00' },
  { id: 'dja-foule', emoji: '🕺💃', text: tr('Dja foule !'), bg: '#d6336c' },
  { id: 'gbaka', emoji: '🚐💨', text: tr('Je suis dans gbaka'), bg: '#f4c430', fg: '#3a2a00' },
  { id: 'tu-es-ou', emoji: '📍🤔', text: tr('Tu es où ?'), bg: '#495057' },
  { id: 'bonne-arrivee', emoji: '🏠❤️', text: tr('Bonne arrivée'), bg: '#2f9e44' },
  { id: 'garba', emoji: '🐟🍚', text: tr('Garba time !'), bg: '#c2410c' },
  { id: 'allez-elephants', emoji: '🐘🇨🇮', text: tr('Allez les Éléphants !'), bg: '#ff8200' },
  { id: 'prends-ca', emoji: '💸💸', text: tr('Prends ça !'), bg: '#0c8599' },
  { id: 'cest-pas-facile', emoji: '😮‍💨', text: tr('C’est pas facile hein'), bg: '#868e96' },
  { id: 'merci-beaucoup', emoji: '🙏🏾', text: tr('Grand merci !'), bg: '#5f3dc4' },
  { id: 'bonne-nuit', emoji: '🌙😴', text: tr('Bonne nuit'), bg: '#1b1e3d' },
]

const STICKER = /^\[sticker:([a-z0-9-]+)\]$/

/** What a card a deleted account had sent became (backend 098_deleted_chats.sql). */
export const WITHDRAWN = '[retire]'

/** The sticker a message is, if it's one. */
export function stickerOf(body: string) {
  const m = STICKER.exec(body.trim())
  return m ? STICKERS.find((s) => s.id === m[1]) : undefined
}

/** What a message says in a list or a notification: a sticker by its words. */
export function previewOf(body: string) {
  const s = stickerOf(body)
  if (body.trim() === WITHDRAWN) return tr('Contenu retiré')
  return s ? tr('Sticker : {emoji} {text}', { emoji: s.emoji, text: s.text }) : (cardPreview(body) ?? body)
}

/** A sticker, drawn big in the chat (or small in the picker). */
export function StickerView({ s, small }: { s: Sticker; small?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-[22px] text-center shadow-[0_6px_16px_-8px_rgba(0,0,0,0.5)] ${small ? 'h-[78px] w-[78px] gap-0.5 p-1' : 'h-[136px] w-[136px] -rotate-2 gap-1 p-2'}`}
      style={{ background: s.bg, color: s.fg ?? '#ffffff', border: '3px solid #ffffff' }}
    >
      <span className={small ? 'text-[24px] leading-none' : 'text-[46px] leading-none'}>{s.emoji}</span>
      <span className={`font-display leading-tight font-extrabold ${small ? 'text-[10px]' : 'text-[16px]'}`}>{s.text}</span>
    </div>
  )
}

/** The emoji used most, by row. */
export const EMOJI = [
  '😂', '🤣', '😍', '🥰', '😘', '😎', '🤩', '😅', '😊', '🙂', '😉', '😜',
  '😭', '😢', '😤', '😡', '🤔', '🙄', '😴', '🤤', '😳', '🥺', '😱', '🤯',
  '👍', '👎', '👏', '🙏', '🙌', '💪', '🤝', '✌️', '👌', '🤙', '👋', '🫶',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '🔥', '✨', '💯', '🎉',
  '⚽', '🏀', '🎾', '🐘', '🇨🇮', '🎶', '🕺', '💃', '🍚', '🐟', '🍗', '🍺',
  '🚐', '🚕', '🏠', '📱', '💸', '💰', '☀️', '🌙', '🌧️', '⏰', '📍', '🎁',
]

/** The panel under the message box: emoji, or stickers. */
export function EmojiPanel({ tab, onTab, onEmoji, onSticker }: { tab: 'emoji' | 'stickers'; onTab: (t: 'emoji' | 'stickers') => void; onEmoji: (e: string) => void; onSticker: (s: Sticker) => void }) {
  return (
    <div className="mb-2 rounded-2xl bg-[var(--color-canvas)] p-2">
      <div className="mb-2 flex gap-1">
        {(
          [
            ['emoji', tr('😊 Emoji')],
            ['stickers', tr('🖼️ Stickers')],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => onTab(id)} className={`flex-1 rounded-xl py-1.5 text-xs font-extrabold ${tab === id ? 'bg-[#f0590c] text-white' : 'bg-white'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'emoji' ? (
        <div className="grid max-h-40 grid-cols-8 gap-0.5 overflow-y-auto">
          {EMOJI.map((e) => (
            <button key={e} type="button" onClick={() => onEmoji(e)} className="grid h-9 place-items-center rounded-lg text-[22px] active:scale-90 active:bg-white">
              {e}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid max-h-48 grid-cols-[repeat(auto-fill,minmax(78px,1fr))] justify-items-center gap-2 overflow-y-auto pb-1">
          {STICKERS.map((s) => (
            <button key={s.id} type="button" onClick={() => onSticker(s)} className="active:scale-95" aria-label={s.text}>
              <StickerView s={s} small />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
