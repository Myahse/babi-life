import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronLeft, Dice5, House, LogOut, MapPin, Share2, Sparkles, Trash2, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { api } from '../lib/api'
import type { JournalEvent, Sim } from '../lib/types'
import { useSession } from '../store/session'
import { findCommune, useWorld } from '../store/world'
import { SimAvatar } from '../components/SimAvatar'
import { iconFor } from '../components/icons'
import { Chip, Coin, IconTile, MotiveRing, Plumbob, needColor } from '../components/ui'
import { NEEDS, amount, clock, mood } from '../game/rules'
import { Journal } from './Play'

export function Profile() {
  const world = useWorld((s) => s.world)!
  const { user, signOut } = useSession()
  const navigate = useNavigate()
  const [sim, setSim] = useState<(Sim & { journal: JournalEvent[] }) | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.sims().then((sims) => (sims.length ? api.sim(sims[0].id).then(setSim) : navigate('/creer')))
  }, [navigate])

  if (!sim) return <div className="h-full bg-[var(--color-canvas)]" />

  const home = findCommune(world, sim.homeCity, sim.homeCommune)
  const here = findCommune(world, sim.city, sim.commune)
  const c = clock(sim.gameMinutes)
  const asp = world.aspirations.find((a) => a.id === sim.aspiration)
  const earned = sim.journal.reduce((s, e) => s + Math.max(0, e.money), 0)
  const spent = Math.abs(sim.journal.reduce((s, e) => s + Math.min(0, e.money), 0))

  async function share() {
    const text = `Je vis à ${home.commune?.name} dans Ivoire Life ! Mon Sim s'appelle ${sim!.firstName} ${sim!.lastName}.`
    try {
      if (navigator.share) await navigator.share({ title: 'Ivoire Life', text, url: location.origin })
      else {
        await navigator.clipboard.writeText(`${text} ${location.origin}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      /* share sheet dismissed */
    }
  }

  async function removeSim() {
    if (!confirm(`Supprimer ${sim!.firstName} pour toujours ?`)) return
    await api.deleteSim(sim!.id)
    navigate('/creer')
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--color-canvas)]">
      {/* Hero: the Sim card */}
      <section className="relative overflow-hidden bg-[radial-gradient(120%_90%_at_50%_0%,#ffe7c7_0%,#ffb27a_45%,#ff7a59_75%,#c94a6a_100%)] pb-16">
        <div className="mx-auto flex max-w-3xl items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:p-5">
          <Link to="/jeu" className="icon-btn bg-white/90 shadow-lg" aria-label="Retour au jeu">
            <ChevronLeft size={24} strokeWidth={2.6} />
          </Link>
          <button className="flex h-11 items-center gap-2 rounded-full bg-white/90 px-4 font-display font-extrabold shadow-lg active:scale-95" onClick={share}>
            <Share2 size={18} strokeWidth={2.6} /> {copied ? 'Lien copié !' : 'Partager'}
          </button>
        </div>
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 text-center text-white sm:flex-row sm:items-end sm:gap-6 sm:text-left">
          <div className="flex flex-col items-center">
            <Plumbob size={16} color={needColor(mood(sim.needs))} />
            <SimAvatar look={sim.look} gender={sim.gender} size={150} />
          </div>
          <div className="pb-4">
            <h1 className="font-display text-4xl leading-none font-extrabold [text-shadow:0_2px_0_rgba(0,0,0,0.12)]">
              {sim.firstName} {sim.lastName}
            </h1>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {asp && (
                <Chip tone="dark">
                  {(() => {
                    const I = iconFor(asp.icon)
                    return <I size={12} />
                  })()}
                  {asp.label}
                </Chip>
              )}
              {sim.traits.map((t) => {
                const o = world.traits.find((x) => x.id === t)
                return o ? <Chip key={t} tone="dark">{o.label}</Chip> : null
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="relative mx-auto -mt-12 max-w-3xl space-y-4 px-4 pb-10">
        <section className="card grid grid-cols-5 gap-1 p-4">
          {NEEDS.map((n) => (
            <MotiveRing key={n.key} value={sim.needs[n.key]} icon={n.icon} label={n.label} size={52} />
          ))}
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat icon={House} colors={['#ffa040', '#ff6a00']} label="Habite à" value={home.commune?.name ?? '—'} sub={home.city?.name} />
          <Stat icon={MapPin} colors={['#69e2a0', '#00a862']} label="Est à" value={here.commune?.name ?? '—'} sub={here.city?.name} />
          <Stat icon={CalendarDays} colors={['#b39dff', '#6c47ff']} label="Calendrier" value={`Jour ${c.day}`} sub={c.weekday} />
          <Stat icon={TrendingUp} colors={['#69e2a0', '#00a862']} label="Gagné" value={`${amount(earned)} F`} />
          <Stat icon={TrendingDown} colors={['#ff8a9b', '#ff3d57']} label="Dépensé" value={`${amount(spent)} F`} />
          <Stat icon={Dice5} colors={['#ffd54f', '#ffa000']} label="Imprévus" value={String(sim.journal.filter((e) => e.kind === 'random').length)} sub={plural(sim.journal.filter((e) => e.kind === 'interaction').length, 'activité')} />
        </section>

        <section className="card flex items-center gap-3 p-4">
          <Coin size={44} />
          <div className="flex-1">
            <div className="label">Porte-monnaie</div>
            <div className="tnum font-display text-3xl leading-none font-extrabold">{amount(sim.money)} F</div>
          </div>
          <Link to="/jeu" className="btn btn-emerald px-5">
            Jouer
          </Link>
        </section>

        <section className="card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={18} className="text-[var(--color-orange)]" />
            <h2 className="font-display text-xl font-extrabold">La vie de {sim.firstName}</h2>
          </div>
          <Journal events={sim.journal} />
        </section>

        <section className="card flex items-center gap-3 p-4">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-12 w-12 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-ink)] font-display text-xl font-extrabold text-white">{user?.name.slice(0, 1)}</span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-lg leading-tight font-extrabold">{user?.name}</div>
            <div className="truncate text-xs font-bold text-[var(--color-ink-soft)]">{user?.email}</div>
          </div>
          <button className="btn btn-soft px-4" onClick={() => (signOut(), navigate('/'))}>
            <LogOut size={18} /> Sortir
          </button>
        </section>

        <button className="mx-auto flex items-center gap-1.5 text-sm font-extrabold text-[#d81b3f] hover:underline" onClick={removeSim}>
          <Trash2 size={15} /> Supprimer ce Sim
        </button>
      </div>
    </div>
  )
}

function Stat({ icon, colors, label, value, sub }: { icon: LucideIcon; colors: [string, string]; label: string; value: string; sub?: string }) {
  return (
    <div className="card flex items-center gap-3 p-3">
      <IconTile icon={icon} colors={colors} size={40} />
      <div className="min-w-0">
        <div className="label truncate">{label}</div>
        <div className="truncate font-display text-lg leading-tight font-extrabold">{value}</div>
        {sub && <div className="truncate text-xs font-bold text-[var(--color-ink-soft)]">{sub}</div>}
      </div>
    </div>
  )
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`
