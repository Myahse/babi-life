import { useEffect, useState } from 'react'
import { CloudRain, ExternalLink, Landmark, Music, Newspaper, TrendingUp, Trophy, Users, type LucideIcon } from 'lucide-react'
import { api } from '../lib/api'
import type { NewsItem } from '../lib/types'
import { IconTile } from '../components/ui'
import { t as tr } from '../lib/i18n'

// "Infos": real headlines from Côte d'Ivoire, read by the server from RSS
// feeds. We show the title and the source, and link to the publisher.

const TOPICS: Record<NewsItem['topic'], { label: string; icon: LucideIcon; colors: [string, string] }> = {
  sport: { label: 'Sport', icon: Trophy, colors: ['#ffa040', '#ff6a00'] },
  politique: { label: tr('Politique'), icon: Landmark, colors: ['#8c9eff', '#3d4fd6'] },
  economie: { label: tr('Économie'), icon: TrendingUp, colors: ['#69e2a0', '#00a862'] },
  societe: { label: tr('Société'), icon: Users, colors: ['#64b5ff', '#2a6cf0'] },
  culture: { label: tr('Culture'), icon: Music, colors: ['#ff7ad9', '#b02bd6'] },
  meteo: { label: tr('Météo'), icon: CloudRain, colors: ['#4dd8e6', '#0097c4'] },
}

export const topicOf = (t: NewsItem['topic']) => TOPICS[t] ?? TOPICS.societe

function ago(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  if (!iso || Number.isNaN(ms) || ms < 0 || new Date(iso).getFullYear() < 2000) return ''
  const h = Math.floor(ms / 3.6e6)
  if (h < 1) return tr("à l'instant")
  if (h < 24) return tr('il y a {h} h', { h })
  const d = Math.floor(h / 24)
  return tr('il y a {d} j', { d })
}

export function NewsApp() {
  const [items, setItems] = useState<NewsItem[] | null>(null)
  const [topic, setTopic] = useState<NewsItem['topic'] | null>(null)
  useEffect(() => {
    api.news().then((r) => setItems(r.items)).catch(() => setItems([]))
  }, [])

  if (!items) return <p className="text-sm font-bold text-[var(--color-ink-soft)]">{tr('Chargement des infos…')}</p>
  if (!items.length)
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <IconTile icon={Newspaper} colors={['#c3c8dc', '#7a8099']} size={52} />
        <p className="text-sm font-bold text-[var(--color-ink-soft)]">{tr("Pas d'infos pour le moment. Reviens plus tard !")}</p>
      </div>
    )
  const shown = topic ? items.filter((i) => i.topic === topic) : items
  const present = [...new Set(items.map((i) => i.topic))]
  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3">
        {[null, ...present].map((t) => (
          <button
            key={t ?? 'all'}
            onClick={() => setTopic(t)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold transition ${topic === t ? 'bg-[var(--color-ink)] text-white' : 'bg-[var(--color-canvas)] text-[var(--color-ink-soft)]'}`}
          >
            {t ? topicOf(t).label : tr('Tout')}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {shown.map((n) => {
          const tp = topicOf(n.topic)
          return (
            <li key={n.id}>
              <a href={n.link} target="_blank" rel="noopener noreferrer" className="flex gap-3 rounded-[20px] bg-[var(--color-canvas)] p-2.5 transition hover:bg-[#eceef6] active:scale-[0.98]">
                <IconTile icon={tp.icon} colors={tp.colors} size={42} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-snug font-extrabold">{n.title}</span>
                  <span className="mt-1 flex items-center gap-1 text-[11px] font-bold text-[var(--color-ink-soft)]">
                    {n.source}
                    {ago(n.published) && <> · {ago(n.published)}</>}
                    <ExternalLink size={11} className="ml-auto shrink-0" />
                  </span>
                </span>
              </a>
            </li>
          )
        })}
      </ul>
      <p className="text-center text-[11px] font-semibold text-[var(--color-ink-soft)]">{tr("Titres de la presse ivoirienne. Touche un article pour le lire chez l'éditeur.")}</p>
    </div>
  )
}
