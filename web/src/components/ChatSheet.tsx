import { useState } from 'react'
import { Hand, HandCoins, Heart, MessagesSquare, Smartphone, X, type LucideIcon } from 'lucide-react'
import type { Npc } from '../world3d/open/OpenWorld'
import { IconTile } from './ui'

// Talking to someone in the street: their first name, how they greet you,
// what you can say, and what they answer (the server decides).

const TOPICS: { id: string; label: string; icon: LucideIcon; hint: string }[] = [
  { id: 'salut', label: 'Saluer', icon: Hand, hint: '3 min · un peu de social' },
  { id: 'gbairai', label: 'Faire le gbairai', icon: MessagesSquare, hint: '15 min · les nouvelles du quartier' },
  { id: 'drague', label: 'Draguer', icon: Heart, hint: 'Adultes · ça passe ou ça casse' },
  { id: 'djai', label: 'Demander un petit djai', icon: HandCoins, hint: 'Un petit prêt… peut-être' },
  { id: 'numero', label: 'Échanger les numéros', icon: Smartphone, hint: 'Peut devenir un·e ami·e' },
]

const GREETINGS = ['On dit quoi ?', 'Bonne arrivée !', 'Ça va un peu ?', 'Y a quoi ?', 'Tu es dans le quartier aussi ?']

export function ChatSheet({ npc, onSay, onClose }: { npc: Npc; onSay: (topic: string, label: string) => Promise<string | null>; onClose: () => void }) {
  const [reply, setReply] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const hello = GREETINGS[npc.seed % GREETINGS.length]
  const say = async (id: string, label: string) => {
    setBusy(true)
    const r = await onSay(id, label)
    setBusy(false)
    if (r) setReply(r)
  }
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-[#0f1230]/40 backdrop-blur-[2px] lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up w-full rounded-t-[28px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:w-[440px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-xl font-extrabold text-white" style={{ background: npc.look.outfitColor }}>
            {npc.name[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="label">Dans la rue</div>
            <div className="font-display text-[22px] leading-tight font-extrabold">{npc.name}</div>
          </div>
          <button className="icon-btn bg-[var(--color-canvas)]" onClick={onClose} aria-label="Fermer">
            <X size={22} strokeWidth={2.6} />
          </button>
        </div>
        {/* What they say */}
        <div className="mt-3 rounded-2xl rounded-tl-sm bg-[var(--color-canvas)] px-3.5 py-2.5 text-[15px] font-bold">{reply ?? `« ${hello} »`}</div>
        {reply ? (
          <button className="btn mt-3 w-full" onClick={onClose}>
            À plus, {npc.name} !
          </button>
        ) : (
          <ul className="mt-3 grid gap-1.5">
            {TOPICS.map((t) => (
              <li key={t.id}>
                <button className="tile flex w-full items-center gap-3 p-2.5 text-left disabled:opacity-50" disabled={busy} onClick={() => say(t.id, `${t.label} avec ${npc.name}`)}>
                  <IconTile icon={t.icon} colors={['#ffa040', '#ff6a00']} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[15px] leading-tight font-extrabold">{t.label}</span>
                    <span className="text-xs font-bold text-[var(--color-ink-soft)]">{t.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
