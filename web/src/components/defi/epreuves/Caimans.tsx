import { useEffect, useMemo, useState } from 'react'
import { Hud, beep, fx } from './kit'
import { Bust3D } from './bust'
import { setExpression, type Expression } from '../../../avatar/expressions'
import { t } from '../../../lib/i18n'

// « La bague des caïmans sacrés », chapter 3 (game/epreuves.go): at the maquis, before witnesses, Tonton
// Kouassi faces the uncle who kept the ring twenty years. The uncle is on his guard; every word counts.
// Four times he speaks, three answers each: the one that calms him (respect, patience, family), the one
// that leaves him cold, the one that hurts. His face shows where he is. Bring him to open his heart.

type Line = { uncle: string; answers: { text: string; mood: number; reply: string }[] }

const LINES = (): Line[] => [
  {
    uncle: t('« Vingt ans sans un mot, et tu viens me voir devant tout le monde ? Qu’est-ce que tu veux ? »'),
    answers: [
      { text: t('« Te saluer d’abord, Tonton. Les enfants de ta sœur te saluent. »'), mood: 2, reply: t('« … Ils vont bien ? »') },
      { text: t('« La bague. Tu sais très bien laquelle. »'), mood: -2, reply: t('« Toujours aussi pressé, toi. »') },
      { text: t('« Juste parler un peu. »'), mood: 0, reply: t('« Parle, alors. »') },
    ],
  },
  {
    uncle: t('« On dit dans la famille que j’ai volé cette bague. C’est ça que tu penses ? »'),
    answers: [
      { text: t('« Je ne juge personne. Je veux comprendre ce qui s’est passé. »'), mood: 2, reply: t('« Comprendre… Personne n’a jamais voulu comprendre. »') },
      { text: t('« Tout le monde le dit, Tonton. »'), mood: -2, reply: t('« Alors va avec tout le monde ! »') },
      { text: t('« Je n’en sais rien. »'), mood: 0, reply: t('« Hmm. »') },
    ],
  },
  {
    uncle: t('« Ta mère me l’avait confiée avant de partir. Puis on ne s’est plus parlé… La honte, tu connais ? »'),
    answers: [
      { text: t('« Oui. Moi aussi j’ai eu honte de ne jamais venir te voir. »'), mood: 2, reply: t('« … Tu es bien le fils de ta mère. »') },
      { text: t('« La honte, c’est pour ceux qui ont fait du mal. »'), mood: -2, reply: t('« Tu crois que je ne le sais pas ? »') },
      { text: t('« C’est du passé. »'), mood: 1, reply: t('« Le passé, il pèse. »') },
    ],
  },
  {
    uncle: t('« Les caïmans, la malédiction, tout ça… Tu y crois, toi ? »'),
    answers: [
      { text: t('« Je crois que le silence nous a fait plus de mal que les caïmans. »'), mood: 2, reply: t('« … Tiens. Elle est à toi. Pardonne-moi. »') },
      { text: t('« Si tu me rends la bague, la malédiction s’arrête. »'), mood: -1, reply: t('« Toujours la bague… »') },
      { text: t('« Les vieux disent que oui. »'), mood: 0, reply: t('« Les vieux disent beaucoup de choses. »') },
    ],
  },
]

/** The uncle's face, from cold anger to tears (avatar/expressions.ts): his real face in 3D (bust.tsx). */
const FACES: Expression[] = ['angry', 'annoyed', 'disgusted', 'neutral', 'smile', 'sad', 'cry']

export default function Caimans({ onEnd }: { onEnd: (score: number) => void }) {
  const lines = useMemo(() => LINES().map((l) => ({ ...l, answers: [...l.answers].sort(() => Math.random() - 0.5) })), [])
  const [k, setK] = useState(0)
  const [mood, setMood] = useState(0) // from -8 to 8
  const [reply, setReply] = useState<string | null>(null)
  const l = lines[Math.min(k, lines.length - 1)]
  const face = FACES[Math.round(((mood + 8) / 16) * (FACES.length - 1))]
  useEffect(() => setExpression('oncle', face, 600000), [face])

  const say = (a: Line['answers'][number], e: React.MouseEvent) => {
    if (reply) return
    const spot = fx.local(e)
    const m = Math.max(-8, Math.min(8, mood + a.mood))
    setMood(m)
    setReply(a.reply)
    if (a.mood >= 2) (fx.good(spot.x, spot.y - 40, '♥'), beep(660, 0.15, 0.1))
    else if (a.mood < 0) (fx.bad(spot.x, spot.y - 40), beep(180, 0.25, 0.1, { type: 'square' }))
    else beep(440, 0.1, 0.08)
    setTimeout(() => {
      setReply(null)
      if (k + 1 >= lines.length) {
        const score = Math.round(Math.max(0, Math.min(100, ((m + 8) / 16) * 100)))
        if (score >= 80) fx.win()
        onEnd(score)
      } else setK(k + 1)
    }, 1900)
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center bg-[linear-gradient(#3b2a1a,#1f140c)] px-4 text-white select-none">
      <Hud title={t('Les mots justes')} done={`${Math.min(k + 1, lines.length)}/${lines.length}`} />
      {/* The uncle across the table, his face */}
      <div className="mt-20 flex flex-col items-center">
        <div key={face} className="animate-pop h-40 w-40 overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_35%,#8d5a3b,#3b2a1a)] shadow-[0_0_0_6px_rgba(255,255,255,0.08)]">
          <Bust3D seed={1931} gender="homme" faceId="oncle" pose={face === 'cry' ? 'facepalm' : face === 'angry' ? 'rant' : 'idle'} over={{ hair: 'short', hairColor: '#cfcfcf', outfit: 'boubou', outfitColor: '#6b4423', beard: 'full', accessory: 'none' }} className="h-full w-full" cam={[0, 1.5, 1.5]} look={[0, 1.42, 0]} />
        </div>
        <div className="mt-1 text-xs font-extrabold text-white/60">{t('L’oncle')}</div>
        <div className="mt-2 h-2 w-44 overflow-hidden rounded-full bg-white/15">
          <div className="h-full bg-[linear-gradient(90deg,#e03131,#fab005,#2f9e44)] transition-all duration-500" style={{ width: `${((mood + 8) / 16) * 100}%` }} />
        </div>
      </div>
      <div key={`${k}${reply}`} className="animate-pop mt-4 w-full max-w-[400px] rounded-2xl bg-[#fff8e6] px-4 py-3 text-[15px] leading-snug font-bold text-[#3d2b1f] shadow">
        {reply ?? l.uncle}
      </div>
      <div className="mt-auto mb-[max(16px,env(safe-area-inset-bottom))] flex w-full max-w-[400px] flex-col gap-2">
        {l.answers.map((a, i) => (
          <button key={`${k}${i}`} disabled={!!reply} onClick={(e) => say(a, e)} className="rounded-2xl bg-white/95 px-4 py-3 text-left text-sm font-bold text-[#212529] shadow-[0_4px_0_rgba(0,0,0,0.35)] transition active:translate-y-0.5 disabled:opacity-50">
            {a.text}
          </button>
        ))}
      </div>
    </div>
  )
}
