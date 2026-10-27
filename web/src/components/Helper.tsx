import { Portrait } from '../avatar/portrait'
import { KOFFI } from './Tutorial'

// When something doesn't go through: Koffi, the big brother of the tuto,
// pops up beside the message, tilts his head and scratches it (« ça va
// aller »), so a refusal reads like a word from a friend, not a fault.

export function Helper({ size = 46, offline = false }: { size?: number; /** no network: he looks at his phone */ offline?: boolean }) {
  return (
    <span className="helper-in relative shrink-0" style={{ width: size, height: size }} aria-hidden>
      <span className="helper-think block h-full w-full overflow-hidden rounded-full bg-gradient-to-b from-[#ffd36e] to-[#ff8a3d] ring-2 ring-white shadow-[0_6px_14px_-8px_rgba(0,0,0,0.5)]">
        <Portrait look={KOFFI} gender="homme" />
      </span>
      <span className="helper-bubble absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-white font-display text-[13px] leading-none font-extrabold text-[var(--color-orange)] shadow">{offline ? '…' : '?'}</span>
    </span>
  )
}
