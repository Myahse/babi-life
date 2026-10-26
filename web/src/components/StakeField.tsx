import { useEffect, useState } from 'react'

const nf = (n: number) => n.toLocaleString('fr-FR')
const short = (n: number) => (n >= 1000 ? `${n / 1000}k` : String(n))

/** Whether an amount is one a game takes: from its least usual stake to its most (or `max`). */
export const stakeOK = (v: number, usual: number[], max = usual[usual.length - 1]) => v >= usual[0] && v <= max

/**
 * A game's stake on its dark table (the machines, the bingo, the casino): a
 * usual amount in a tap, or any amount typed, from the game's least to its
 * most (backend game.StakeIn). What's typed stays as typed while typing;
 * it's checked, not changed under the fingers.
 */
/** The two looks: on a dark table (the casino, the machines), on a light card (the bingo). */
const LOOK = {
  dark: { chip: 'bg-white/12 text-white', on: 'bg-[#ffcc33] text-[#5a1a00]', field: 'bg-white/10', typed: 'bg-white/20 ring-2 ring-[#ffcc33]/70', ink: 'text-white', soft: 'text-white/70', bad: 'text-[#ffb3b3]' },
  light: { chip: 'bg-[#f1ecfb] text-[#4c1d95]', on: 'bg-[#7b2ff7] text-white', field: 'bg-[#f1ecfb]', typed: 'bg-[#f1ecfb] ring-2 ring-[#7b2ff7]/60', ink: 'text-[#1b1d21]', soft: 'text-[#6b7083]', bad: 'text-[#d81b3f]' },
}

export function StakeField({
  usual,
  value,
  onChange,
  money,
  max,
  label = 'Ou tape ta mise',
  disabled,
  chips = true,
  look = 'dark',
}: {
  usual: number[]
  value: number
  onChange: (v: number) => void
  /** What the Sim has (a stake above it is told). */
  money?: number
  /** The most, if not the last usual stake. */
  max?: number
  label?: string
  disabled?: boolean
  /** false: the field alone (the table shows its own chips). */
  chips?: boolean
  look?: keyof typeof LOOK
}) {
  const k = LOOK[look]
  const [text, setText] = useState(String(value))
  useEffect(() => {
    if ((Number(text) || 0) !== value) setText(String(value))
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  const lo = usual[0]
  const hi = max ?? usual[usual.length - 1]
  const why = value < lo ? `${nf(lo)} Djai au moins` : value > hi ? `${nf(hi)} Djai au plus` : money !== undefined && value > money ? "Tu n'as pas assez" : ''
  return (
    <div>
      {chips && (
        <div className="mb-2 flex items-center gap-1.5">
          {usual.map((s) => (
            <button key={s} className={`flex-1 rounded-full py-2 text-[12.5px] font-extrabold transition ${value === s ? k.on : k.chip}`} disabled={disabled} onClick={() => onChange(s)}>
              {short(s)}
            </button>
          ))}
        </div>
      )}
      <label className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 ${usual.includes(value) ? k.field : k.typed}`}>
        <span className={`shrink-0 text-[11.5px] font-extrabold ${k.soft}`}>{label}</span>
        <input
          inputMode="numeric"
          value={text}
          disabled={disabled}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
            setText(digits)
            onChange(Number(digits) || 0)
          }}
          onFocus={(e) => e.target.select()}
          // The field's own ring shows the focus (the page's orange outline would sit inside it).
          style={{ outline: 'none' }}
          className={`w-0 min-w-0 flex-1 bg-transparent text-right text-[15px] font-extrabold outline-none ${k.ink}`}
          aria-label="Mise en Djai"
        />
        <span className={`shrink-0 text-[12px] font-bold ${k.soft}`}>Djai</span>
      </label>
      {why && <p className={`mt-1 text-center text-[11.5px] font-bold ${k.bad}`}>{why}</p>}
    </div>
  )
}
