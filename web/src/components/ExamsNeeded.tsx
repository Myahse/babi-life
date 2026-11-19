import { Check, GraduationCap, Lock, MapPin } from 'lucide-react'
import { examsBlock, workExams, workMissing } from '../game/examens'
import { useFeatures } from '../lib/features'
import { t as tr } from '../lib/i18n'
import type { Sim } from '../lib/types'
import { Chip, IconTile } from './ui'

/**
 * Les examens avant le travail (update « examens-avant-travail », game/examens.ts): the card that says a
 * career waits for its exams, which are done and which remain, and the way to the lycée to sit the next
 * one (en candidat libre). Nothing when the career can be worked (or the update is shut).
 */
export function ExamsNeeded({ sim, career, onLycee, compact }: { sim: Sim; career: string; /** To the lycée (walking there in the commune, else the Études app's list). */ onLycee: () => void; compact?: boolean }) {
  useFeatures()
  // (The title says the post waits: the sentence under it, without saying it again.)
  const why = examsBlock(sim, career, false)
  if (!why) return null
  const missing = workMissing(sim, career)
  const held = career === sim.career
  const next = missing[0] === 'bepc' ? 'BEPC' : 'BAC'
  return (
    <div className="rounded-[20px] bg-[#eef4ff] p-3" data-exams-needed={missing.join(',')}>
      <div className="flex items-start gap-3">
        <IconTile icon={held ? Lock : GraduationCap} colors={['#74c0fc', '#3b2fc9']} size={compact ? 40 : 44} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block font-display text-[15px] font-extrabold">{held ? tr('Ton poste t’attend') : tr('Examens à repasser')}</span>
          <span className="mt-0.5 block text-[12px] leading-snug font-bold text-[var(--color-ink-soft)]">{why}</span>
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {workExams(career).map((x) => {
          const done = !missing.includes(x)
          return (
            <Chip key={x} tone={done ? 'good' : 'neutral'}>
              {done ? <Check size={12} strokeWidth={3} /> : <Lock size={11} />} {x === 'bepc' ? 'BEPC' : 'BAC'} · {done ? tr('repassé') : tr('à repasser')}
            </Chip>
          )
        })}
      </div>
      <button className="btn mt-2.5 w-full !py-2 !text-[13px]" onClick={onLycee} data-exams-go>
        <MapPin size={15} /> {tr('Aller au lycée passer le {0}', { 0: next })}
      </button>
    </div>
  )
}
