import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { InstallButton } from '../components/InstallButton'
import { NotifyBanner } from '../components/NotifyPrompt'
import { Briefcase, CalendarDays, Languages, ChevronLeft, House, LogOut, MapPin, Monitor, MonitorSmartphone, Shirt, Share2, Smartphone, Sparkles, Trash2, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { api, type Device } from '../lib/api'
import type { JournalEvent, Sim } from '../lib/types'
import { useSession } from '../store/session'
import { findCommune, useWorld } from '../store/world'
import { Portrait } from '../avatar/portrait'
import { iconFor } from '../components/icons'
import { Chip, Coin, IconTile, MotiveRing, MoodPin, needColor } from '../components/ui'
import { NEEDS, amount, clock, housingOf, lifeOf, mood } from '../game/rules'
import { Journal } from './Play'
import { share as shareText } from '../lib/native'
import { aCommune, deNom } from '../lib/french'
import { LANGUAGES } from '../lib/languages'
import { t as tr, tx, locale } from '../lib/i18n'

export function Profile() {
  const world = useWorld((s) => s.world)!
  const { user, signOut } = useSession()
  const navigate = useNavigate()
  const [sim, setSim] = useState<(Sim & { journal: JournalEvent[] }) | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.sims().then((sims) => (sims.length ? api.sim(sims[0].id).then((r) => setSim({ ...r.sim, journal: r.journal })) : navigate('/creer')))
  }, [navigate])

  if (!sim) return <div className="h-full bg-[#fff4e8]" />

  const home = findCommune(world, sim.homeCity, sim.homeCommune)
  const here = findCommune(world, sim.city, sim.commune)
  const c = clock(sim.gameMinutes)
  const asp = world.aspirations.find((a) => a.id === sim.aspiration)
  const origin = world.origins.find((o) => o.id === sim.origin)
  const housing = housingOf(world, sim)
  const career = world.careers.find((x) => x.id === sim.career)
  // A child has no job to lose: at school (a baby, at home).
  const stage = lifeOf(world, sim).stage?.id ?? 'adulte'
  const jobless = stage === 'bebe' ? tr('Bébé') : stage === 'adulte' ? tr('Au chômage') : tr("À l'école")
  const earned = sim.journal.reduce((s, e) => s + Math.max(0, e.money), 0)
  const spent = Math.abs(sim.journal.reduce((s, e) => s + Math.min(0, e.money), 0))

  async function share() {
    const text = tr("Je vis {0} dans Babi Life ! Mon perso s'appelle {firstName} {lastName}.", { 0: aCommune(home.commune?.name ?? ''), firstName: sim!.firstName, lastName: sim!.lastName })
    try {
      if (!(await shareText(text, location.origin))) {
        await navigator.clipboard.writeText(`${text} ${location.origin}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      /* share sheet dismissed */
    }
  }

  async function removeSim() {
    if (!confirm(tr('Supprimer {firstName} pour toujours ?', { firstName: sim!.firstName }))) return
    await api.deleteSim(sim!.id)
    navigate('/creer', { viewTransition: true })
  }

  return (
    <div className="h-full overflow-y-auto bg-[#fff4e8]">
      {/* Hero: the Sim card, on the game's flat orange (no gradient), the flag's green under it */}
      <section className="relative overflow-hidden border-b-[6px] border-[var(--color-emerald)] bg-[var(--color-orange)] pb-16">
        <div className="mx-auto flex max-w-3xl items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:p-5">
          <Link to="/jeu" viewTransition className="icon-btn bg-white/90 shadow-lg" aria-label={tr('Retour au jeu')}>
            <ChevronLeft size={24} strokeWidth={2.6} />
          </Link>
          <button className="flex h-11 items-center gap-2 rounded-full bg-white/90 px-4 font-display font-extrabold shadow-lg active:scale-95" onClick={share}>
            <Share2 size={18} strokeWidth={2.6} /> {copied ? tr('Lien copié !') : tr('Partager')}
          </button>
        </div>
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 text-center text-white sm:flex-row sm:items-end sm:gap-6 sm:text-left">
          <div className="flex flex-col items-center">
            <MoodPin size={16} color={needColor(mood(sim.needs))} />
            <span className="block h-[220px] w-[165px]">
              <Portrait look={sim.look} gender={sim.gender} framing="full" stage={stage} />
            </span>
          </div>
          <div className="pb-4">
            <h1 className="font-display text-4xl leading-none font-extrabold">
              {sim.firstName} {sim.lastName}
            </h1>
            {user?.username && <div className="mt-1 font-display text-lg font-extrabold opacity-90">@{user.username}</div>}
            <Link to="/look" viewTransition className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-white/90 px-4 font-display font-extrabold text-[var(--color-ink)] shadow-lg active:scale-95">
              <Shirt size={18} strokeWidth={2.6} /> {tr('Changer de look')}
            </Link>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {origin && <Chip tone="dark">{origin.label}</Chip>}
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
          <Stat icon={House} colors={['#ffa040', '#ff6a00']} label={tr('Habite à')} value={home.commune?.name ?? '—'} sub={housing?.label} />
          <Stat icon={MapPin} colors={['#69e2a0', '#00a862']} label={tr('Est à')} value={here.commune?.name ?? '—'} sub={here.city?.name} />
          <Stat icon={CalendarDays} colors={['#b39dff', '#6c47ff']} label={tr("Aujourd'hui")} value={c.date} sub={`${c.weekday} · ${c.time}`} />
          <Stat icon={TrendingUp} colors={['#69e2a0', '#00a862']} label={tr('Gagné')} value={`${amount(earned)} Djai`} />
          <Stat icon={TrendingDown} colors={['#ff8a9b', '#ff3d57']} label={tr('Dépensé')} value={`${amount(spent)} Djai`} />
          <Stat icon={Briefcase} colors={['#64b5ff', '#2a6cf0']} label={tr('Métier')} value={career ? career.levels[sim.careerLevel].title : jobless} sub={career?.label} />
        </section>

        <section className="card flex items-center gap-3 p-4">
          <Coin size={44} />
          <div className="flex-1">
            <div className="label">{tr('Porte-monnaie')}</div>
            <div className="tnum font-display text-3xl leading-none font-extrabold">{amount(sim.money)} {tr('Djai')}</div>
            {sim.loan > 0 && <div className="text-xs font-extrabold text-[#d81b3f]">{tx('Microcrédit : {0} Djai à rembourser', { 0: amount(sim.loan) })}</div>}
          </div>
          <Link to="/jeu" viewTransition className="btn btn-emerald px-5">
            {tr('Jouer')}
          </Link>
        </section>

        <Spoken sim={sim} onChange={(languages) => setSim({ ...sim, languages })} />

        <section className="card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={18} className="text-[var(--color-orange)]" />
            <h2 className="font-display text-xl font-extrabold">{tr('La vie')} {deNom(sim.firstName)}</h2>
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
          <button className="btn btn-soft px-4" onClick={() => void api.endSession().catch(() => undefined).finally(() => (signOut(), navigate('/')))}>
            <LogOut size={18} /> {tr('Sortir')}
          </button>
        </section>

        <Devices />

        <InstallButton />
        {/* Notifications off here: turn them on (or how to, in the phone's settings) */}
        <NotifyBanner what={tr("quand un ami t'écrit, t'invite ou veut être ton ami")} />

        <button className="mx-auto flex items-center gap-1.5 text-sm font-extrabold text-[#d81b3f] hover:underline" onClick={removeSim}>
          <Trash2 size={15} /> {tr('Supprimer ce perso')}
        </button>
      </div>
    </div>
  )
}

/**
 * The languages the player speaks besides French: in the street, a passer-by
 * who speaks one of them answers a greeting in it (backend game/languages.go).
 * A tap adds or removes one, saved at once.
 */
function Spoken({ sim, onChange }: { sim: Sim; onChange: (languages: string[]) => void }) {
  const mine = sim.languages ?? []
  const [saving, setSaving] = useState(false)
  async function toggle(id: string) {
    const next = mine.includes(id) ? mine.filter((l) => l !== id) : mine.length < 6 ? [...mine, id] : mine
    setSaving(true)
    const r = await api.setLanguages(sim.id, next).catch(() => null)
    setSaving(false)
    if (r) onChange(r.languages)
  }
  return (
    <section className="card p-4">
      <div className="mb-1 flex items-center gap-2">
        <Languages size={18} className="text-[var(--color-orange)]" />
        <h2 className="font-display text-xl font-extrabold">{tr('Langues parlées')}</h2>
      </div>
      <p className="mb-3 text-sm font-bold text-[var(--color-ink-soft)]">{tr('Le français, et quoi d’autre ? Dans la rue, ceux qui parlent ta langue te répondent dedans.')}</p>
      <div className="flex flex-wrap gap-1.5">
        {LANGUAGES.map((l) => (
          <button key={l.id} disabled={saving} className={`rounded-full px-3 py-1.5 text-sm font-extrabold transition-colors disabled:opacity-60 ${mine.includes(l.id) ? 'bg-[var(--color-orange)] text-white' : 'bg-[var(--color-canvas)] text-[var(--color-ink-soft)]'}`} onClick={() => void toggle(l.id)}>
            {l.label}
          </button>
        ))}
      </div>
    </section>
  )
}

/**
 * The devices signed in to the account (a phone, a computer, the app), the one
 * in hand first: when each was last used, and « Déconnecter » to sign one
 * out (its game closes there), or all the others at once.
 */
function Devices() {
  const [list, setList] = useState<Device[] | null>(null)
  const [legacy, setLegacy] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const load = () =>
    void api
      .sessions()
      .then((r) => (setList(r.sessions), setLegacy(r.legacy)))
      .catch(() => setList([]))
  useEffect(load, [])
  const ago = (iso: string) => {
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    return m < 2 ? tr('en ce moment') : m < 60 ? tr('il y a {m} min', { m }) : m < 60 * 24 ? tr('il y a {0} h', { 0: Math.round(m / 60) }) : tr('il y a {0} j', { 0: Math.round(m / 1440) })
  }
  const others = (list ?? []).filter((d) => !d.current)
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <MonitorSmartphone size={18} className="text-[var(--color-orange)]" />
        <h2 className="font-display text-xl font-extrabold">{tr('Appareils connectés')}</h2>
      </div>
      {!list ? (
        <p className="text-sm font-bold text-[var(--color-ink-soft)]">{tr('Chargement…')}</p>
      ) : (
        <ul className="space-y-2">
          {legacy && (
            <li className="rounded-2xl bg-[var(--color-canvas)] p-3 text-xs font-bold text-[var(--color-ink-soft)]">{tr("Cet appareil s'est connecté avant la liste des appareils : reconnecte-toi pour qu'il y apparaisse.")}</li>
          )}
          {list.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-2xl bg-[var(--color-canvas)] p-3">
              <IconTile icon={/iphone|android|ipad/i.test(d.device) ? Smartphone : Monitor} colors={d.current ? ['#69e2a0', '#00a862'] : ['#b8c1d1', '#7a8599']} size={38} />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-sm font-extrabold">{d.device || tr('Appareil')}</div>
                <div className="text-xs font-bold text-[var(--color-ink-soft)]">{d.current ? tr('Cet appareil') : tr('Utilisé {0}', { 0: ago(d.lastSeen) })} {tr('· connecté le')} {new Date(d.createdAt).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}</div>
              </div>
              {!d.current && (
                <button
                  className="btn btn-soft !px-3 !py-2 !text-xs text-[#d81b3f] disabled:opacity-50"
                  disabled={busy === d.id}
                  onClick={async () => {
                    setBusy(d.id)
                    await api.revokeSession(d.id).catch(() => undefined)
                    setBusy(null)
                    setNote(`${d.device || 'Cet appareil'} est déconnecté.`)
                    load()
                  }}
                >
                  {tr('Déconnecter')}
                </button>
              )}
            </li>
          ))}
          {list.length === 0 && !legacy && <li className="text-sm font-bold text-[var(--color-ink-soft)]">{tr('Aucun appareil.')}</li>}
        </ul>
      )}
      {(others.length > 0 || legacy) && (
        <button
          className="mt-3 w-full rounded-2xl border border-[#f3c2cb] py-2.5 text-sm font-extrabold text-[#d81b3f] disabled:opacity-50"
          disabled={busy === 'all'}
          onClick={async () => {
            setBusy('all')
            const r = await api.revokeOthers().catch(() => null)
            setBusy(null)
            setNote(r ? `${r.signedOut} appareil${r.signedOut > 1 ? 's' : ''} déconnecté${r.signedOut > 1 ? 's' : ''}.` : "Ça n'a pas marché, réessaie.")
            load()
          }}
        >
          {tr('Déconnecter tous les autres appareils')}
        </button>
      )}
      {note && <p className="mt-2 text-xs font-bold text-[var(--color-ink-soft)]">{note}</p>}
    </section>
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

