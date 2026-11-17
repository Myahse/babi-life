// Where to go when the game opens (update « mon-quartier », store/monde.ts): the world of Babi, where everyone
// is, or the Sim's own neighbourhood (screens/Quartier.tsx). Once a visit; « Mon quartier » in the street's
// buttons goes there any time, and « Babi » there comes back.

import { Building2, Trees } from 'lucide-react'
import { chooseWorld, lastWorld, type WorldName } from '../store/monde'
import { t as tr } from '../lib/i18n'

export function WorldChoice({ name, onPick }: { name: string; onPick: (w: WorldName) => void }) {
  const last = lastWorld()
  const pick = (w: WorldName) => (chooseWorld(w), onPick(w))
  const card = (w: WorldName, icon: React.ReactNode, title: string, text: string, tone: string) => (
    <button key={w} className={`flex w-full items-center gap-4 rounded-[24px] p-4 text-left text-white shadow-lg transition active:scale-[0.98] ${w === last ? 'ring-4 ring-white/70' : ''}`} style={{ background: tone }} onClick={() => pick(w)}>
      <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/20">{icon}</span>
      <span className="min-w-0">
        <span className="block font-display text-[22px] leading-tight font-extrabold">{title}</span>
        <span className="mt-1 block text-[14px] leading-snug font-bold opacity-90">{text}</span>
      </span>
    </button>
  )
  return (
    <div className="absolute inset-0 z-[80] grid place-items-center bg-[var(--color-night)]/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md">
        <h2 className="mb-1 text-center font-display text-[28px] font-extrabold text-white">{tr('Où va {name} ?', { name })}</h2>
        <p className="mb-4 text-center text-sm font-bold text-white/80">{tr('Deux mondes : choisis. Tu passes de l’un à l’autre quand tu veux.')}</p>
        <div className="space-y-3">
          {card('babi', <Building2 size={34} />, tr('Le monde de Babi'), tr('Abidjan et tout le monde : les rues, le travail, les amis, les maquis.'), 'linear-gradient(135deg,#ff8a00,#e65100)')}
          {card('quartier', <Trees size={34} />, tr('Mon quartier'), tr('Ton terrain à toi : ta maison, et tout le reste à construire. Tes ami·es y viennent.'), 'linear-gradient(135deg,#00b86b,#00796b)')}
        </div>
      </div>
    </div>
  )
}
