import { useEffect, useState } from 'react'
import { Bug, CheckCheck, Eye, Gamepad2, Lightbulb, MapPin, Send, Sparkles, type LucideIcon } from 'lucide-react'
import { ApiError, api } from '../lib/api'
import type { Idea, Sim } from '../lib/types'
import { Chip, IconTile } from '../components/ui'
import { t as tr, locale } from '../lib/i18n'

// « Idées »: every player can tell Babi Life what they'd like (an activity,
// a place to add, something broken, anything), see what they sent, and read
// what the team answered (the /admin page: Idées). Nothing is paid or won
// with it: it's the suggestion box.

const TOPICS: { id: Idea['topic']; label: string; icon: LucideIcon; colors: [string, string]; hint: string }[] = [
  { id: 'jeu', label: tr('Une activité'), icon: Gamepad2, colors: ['#c49bff', '#7048e8'], hint: tr('Un jeu, un métier, une chose à faire qui manque') },
  { id: 'lieu', label: tr('Un lieu'), icon: MapPin, colors: ['#ffa040', '#ff6a00'], hint: tr('Un endroit de la ville à ajouter ou à refaire') },
  { id: 'bug', label: tr('Un souci'), icon: Bug, colors: ['#ff8a9b', '#ff3d57'], hint: tr('Quelque chose qui ne marche pas comme il faut') },
  { id: 'autre', label: tr('Autre'), icon: Sparkles, colors: ['#69e2a0', '#00a862'], hint: tr('Tout le reste') },
]
export const topicOf = (t: Idea['topic']) => TOPICS.find((x) => x.id === t) ?? TOPICS[3]

/** Where an idea stands, as the player reads it. */
export const STATUS: Record<Idea['status'], { label: string; tone: 'neutral' | 'gold' | 'good' | 'bad' | 'dark' }> = {
  new: { label: tr('Envoyée'), tone: 'neutral' },
  read: { label: tr('Lue par l’équipe'), tone: 'dark' },
  kept: { label: tr('Retenue !'), tone: 'gold' },
  done: { label: tr('C’est fait !'), tone: 'good' },
  no: { label: tr('Pas pour l’instant'), tone: 'bad' },
}

const MAX = 600
const failure = (e: unknown) => (e instanceof ApiError ? e.message : tr('Pas de réseau : ton idée partira quand tu seras connecté·e. Réessaie dans un instant.'))

const when = (iso: string) => new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })

export function IdeasApp({ sim }: { sim: Sim }) {
  const [ideas, setIdeas] = useState<Idea[] | null>(null)
  const [topic, setTopic] = useState<Idea['topic']>('jeu')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [thanks, setThanks] = useState<string | null>(null)
  useEffect(() => {
    api
      .ideas()
      .then((r) => setIdeas(r.ideas))
      .catch(() => setIdeas([]))
  }, [])

  const send = async () => {
    const t = text.trim()
    if (t.length < 10 || sending) return
    setSending(true)
    setError(null)
    try {
      const r = await api.sendIdea(sim.id, topic, t)
      setIdeas((l) => [r.idea, ...(l ?? [])])
      setText('')
      setThanks(r.text)
    } catch (e) {
      setError(failure(e))
    } finally {
      setSending(false)
    }
  }
  const picked = topicOf(topic)

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-[22px] bg-[#fff8dc] p-4">
        <IconTile icon={Lightbulb} colors={['#ffe066', '#f5a000']} size={44} />
        <div className="min-w-0">
          <div className="font-display text-lg leading-tight font-extrabold">{tr('Babi Life se fait avec toi')}</div>
          <p className="mt-1 text-sm font-semibold text-[var(--color-ink-soft)]">{tr('Une activité qui manque, un lieu de ta commune à ajouter, un truc qui cloche : dis-le ici. L’équipe lit tout et te répond dans cette appli.')}</p>
        </div>
      </div>

      <section className="space-y-2">
        <h4 className="label">{tr('C’est à propos de…')}</h4>
        <div className="grid grid-cols-2 gap-2">
          {TOPICS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTopic(t.id)}
              aria-pressed={topic === t.id}
              className={`flex items-center gap-2 rounded-2xl p-2 text-left text-sm font-extrabold transition active:scale-[0.98] ${topic === t.id ? 'bg-[var(--color-ink)] text-white' : 'bg-[var(--color-canvas)] text-[var(--color-ink)]'}`}
            >
              <IconTile icon={t.icon} colors={t.colors} size={32} />
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs font-semibold text-[var(--color-ink-soft)]">{picked.hint}.</p>
      </section>

      <section className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
          rows={4}
          placeholder={tr('Ton idée, avec tes mots… Par exemple : « À Yopougon il manque le marché de nuit », « On devrait pouvoir vendre de l’attiéké au bord de la route ».')}
          className="input w-full resize-none text-[14px] font-semibold"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="tnum text-xs font-bold text-[var(--color-ink-soft)]">
            {text.trim().length < 10 ? tr('Au moins dix lettres') : `${text.length} / ${MAX}`}
          </span>
          <button type="button" className="btn !py-2 !text-sm" disabled={sending || text.trim().length < 10} onClick={() => void send()}>
            <Send size={15} /> {sending ? tr('Envoi…') : tr('Envoyer')}
          </button>
        </div>
        {error && <p className="rounded-xl bg-[#fff1f0] px-3 py-2 text-sm font-bold text-[#b42318]">{error}</p>}
        {thanks && !error && (
          <p className="flex items-center gap-2 rounded-xl bg-[#e9fbf0] px-3 py-2 text-sm font-bold text-[#0f7a3f]">
            <CheckCheck size={16} className="shrink-0" /> {thanks}
          </p>
        )}
      </section>

      <section>
        <h4 className="label mb-2">{tr('Tes idées envoyées')}</h4>
        {ideas === null ? (
          <p className="text-sm font-bold text-[var(--color-ink-soft)]">{tr('Chargement…')}</p>
        ) : ideas.length === 0 ? (
          <p className="text-sm font-bold text-[var(--color-ink-soft)]">{tr('Aucune pour l’instant. La première est pour toi !')}</p>
        ) : (
          <ul className="motion-stagger space-y-2">
            {ideas.map((i) => {
              const t = topicOf(i.topic)
              const st = STATUS[i.status] ?? STATUS.new
              return (
                <li key={i.id} className="rounded-[20px] bg-[var(--color-canvas)] p-3">
                  <div className="flex items-start gap-2.5">
                    <IconTile icon={t.icon} colors={t.colors} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold text-[var(--color-ink-soft)]">
                        <span>{t.label}</span>
                        <span>· {when(i.at)}</span>
                      </div>
                      <p className="mt-1 text-sm leading-snug font-semibold whitespace-pre-wrap">{i.text}</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Chip tone={st.tone}>{st.label}</Chip>
                  </div>
                  {i.reply && (
                    <div className="mt-2 flex items-start gap-2 rounded-2xl bg-white p-2.5">
                      <Eye size={15} className="mt-0.5 shrink-0 text-[var(--color-ink-soft)]" />
                      <p className="min-w-0 text-sm leading-snug font-semibold">
                        <span className="text-[var(--color-ink-soft)]">{tr('Babi Life :')} </span>
                        {i.reply}
                      </p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
