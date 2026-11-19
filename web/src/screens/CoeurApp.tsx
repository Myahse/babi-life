import { useEffect, useState } from 'react'
import { CalendarHeart, Footprints, Heart, HeartHandshake, IceCreamCone, Map as MapIcon, MessageCircleHeart, MessagesSquare, Sparkles, Sunset, Utensils, UsersRound } from 'lucide-react'
import { api, errorText } from '../lib/api'
import type { ActionResult, Commune, Look, Sim } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'
import { MOTS_DOUX, motOf, type AmourResult, type AmourView, type DateKindId } from '../game/amour'
import { DATE_KINDS } from '../game/amourDates'
import { t, locale } from '../lib/i18n'

// « Mon cœur » (the update « vie-amoureuse », backend sims/amour.go): one's partner (their face, how long
// together, the love as it reads now, the next anniversary), what to do for them (a date, a mot doux, a
// câlin at home), the thread with the partner met in the game (their « Bonjour mon cœur »), the last dates.
// With nobody yet: how love is found in Babi.

const PINK: [string, string] = ['#ff8fb1', '#d6336c']
const DATE_ICON: Record<DateKindId, typeof Utensils> = { 'rdv-maquis': Utensils, 'rdv-lagune': Sunset, 'rdv-glace': IceCreamCone }

export function CoeurApp({ sim, commune, onResult, onWalk, onMap }: { sim: Sim; commune: Commune; onResult: (r: ActionResult) => void; onWalk: (placeId: string) => void; onMap: () => void }) {
  const [v, setV] = useState<AmourView | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [sheet, setSheet] = useState<'mot' | 'rdv' | null>(null)
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const took = (r: AmourResult) => {
    onResult(r)
    setV(r.data)
    if (r.outcome.text) setSaid(r.outcome.text)
  }
  useEffect(() => {
    api
      .amour(sim.id)
      .then((r) => (onResult(r), setV(r.data)))
      .catch((e) => setErr(errorText(e, t('« Mon cœur » ne répond pas. Réessaie.'))))
  }, [sim.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const call = async (f: () => Promise<AmourResult>) => {
    setBusy(true)
    try {
      took(await f())
    } catch (e) {
      setSaid(errorText(e, t('Pas possible')))
    } finally {
      setBusy(false)
      setSheet(null)
    }
  }
  if (err) return <p className="p-3 text-sm font-bold text-[var(--color-ink-soft)]">{err}</p>
  if (!v) return <p className="p-3 text-sm font-bold text-[var(--color-ink-soft)]">…</p>
  const p = v.partner
  if (!p) return <Alone requests={v.requests} />
  const look: Look = p.look ?? randomLook(p.gender, rng(`partner${p.id}`))
  const npc = p.kind === 'pnj'
  const date = (n: number) => new Date(n * 1000).toLocaleDateString(locale(), { day: 'numeric', month: 'long' })
  // (The dates had with this partner: a past love's stay in the past.)
  const dates = v.dates.filter((d) => d.with === p.name)
  return (
    <div className="space-y-3 pt-2" data-coeur>
      {/* The partner's card */}
      <div className="overflow-hidden rounded-[24px] text-white shadow-[0_10px_24px_-14px_rgba(214,51,108,0.8)]" style={{ background: 'linear-gradient(155deg,#ff8fb1 0%,#e64980 55%,#a61e4d 100%)' }}>
        <div className="flex items-center gap-3 p-3.5">
          <div className="h-[74px] w-[74px] shrink-0 overflow-hidden rounded-full bg-[#ffe3ec] ring-[3px] ring-white/90">
            <Portrait look={look} gender={p.gender} framing="head" />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-[11px] font-extrabold tracking-wider uppercase opacity-85">{p.stageLabel || t('Ensemble')}</div>
            <div className="truncate font-display text-[22px] font-extrabold">{p.name}</div>
            <div className="text-[13px] font-bold opacity-95">{p.days <= 1 ? t('Ensemble depuis aujourd’hui') : t('Ensemble depuis {n} jours', { n: p.days })}</div>
          </div>
        </div>
        {/* The love meter */}
        <div className="px-3.5 pb-3.5">
          <div className="mb-1 flex items-center justify-between text-[12px] font-extrabold">
            <span className="flex items-center gap-1">
              <Heart size={13} className="fill-white" /> {t('Votre amour')}
            </span>
            <span>{p.love} / 100</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/25" role="meter" aria-valuenow={p.love} aria-valuemin={0} aria-valuemax={100} aria-label={t('Votre amour')}>
            <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${p.love}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] font-bold">
            {v.next && (
              <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5">
                <CalendarHeart size={13} /> {t('{label} : dans {n} j ({date})', { label: v.next.label, n: v.next.days, date: date(v.next.at) })}
              </span>
            )}
            {p.foyer && <span className="rounded-full bg-white/20 px-2 py-0.5">{t('Vit avec toi')}</span>}
          </div>
          {p.langLabel && (
            <p className="mt-2 text-[12px] leading-snug font-semibold opacity-95">
              <Sparkles size={12} className="mr-1 inline" />
              {t('Ce qui {0} touche le plus : {what}', { 0: p.gender === 'femme' ? t('la') : t('le'), what: p.langLabel })}
            </p>
          )}
        </div>
      </div>

      {/* What to do for them */}
      <div className="grid grid-cols-3 gap-2">
        <Action icon={HeartHandshake} label={t('Rendez-vous')} disabled={!npc || busy} onClick={() => setSheet(sheet === 'rdv' ? null : 'rdv')} />
        <Action icon={MessageCircleHeart} label={t('Mot doux')} sub={`${v.mots}/${v.motsMax}`} disabled={busy || v.mots >= v.motsMax} onClick={() => setSheet(sheet === 'mot' ? null : 'mot')} />
        <Action icon={Heart} label={t('Câlin')} disabled={!v.calin || busy} onClick={() => void call(() => api.amourCalin(sim.id))} />
      </div>
      {!npc && <p className="text-[12px] font-bold text-[var(--color-ink-soft)]">{t('Entre joueurs, les rendez-vous arrivent bientôt. Ton mot doux arrive dans Gbairai.')}</p>}
      {npc && !v.calin && v.calinWhy && <p className="text-[12px] font-bold text-[var(--color-ink-soft)]">{t('Câlin : {why}', { why: v.calinWhy })}</p>}
      {said && (
        <p key={said} className="animate-pop rounded-2xl bg-[#fff0f6] px-3 py-2 text-[13.5px] font-bold text-[#a61e4d]">
          {said}
        </p>
      )}

      {sheet === 'mot' && (
        <div className="animate-pop rounded-[20px] border border-[#ffd6e3] bg-[#fff8fb] p-2.5">
          <div className="label mb-1.5">{npc ? t('Un mot doux pour {name}', { name: p.name }) : t('Un mot doux dans Gbairai pour {name}', { name: p.name })}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {MOTS_DOUX.map((m) => (
              <button key={m.id} className="rounded-2xl bg-white px-2.5 py-2 text-left text-[13px] leading-tight font-bold text-[#a61e4d] shadow-sm active:scale-[0.97]" onClick={() => void call(() => api.amourMot(sim.id, m.id))} data-mot={m.id}>
                {m.text()}
              </button>
            ))}
          </div>
        </div>
      )}

      {sheet === 'rdv' && (
        <div className="animate-pop space-y-1.5 rounded-[20px] border border-[#ffd6e3] bg-[#fff8fb] p-2.5">
          <div className="label">{t('Où l’emmener ?')}</div>
          {(Object.keys(DATE_KINDS) as DateKindId[]).map((id) => {
            const k = DATE_KINDS[id]
            const place = commune.places.find((pl) => pl.kind === k.place)
            const Icon = DATE_ICON[id]
            return (
              <button key={id} className="flex w-full items-center gap-3 rounded-2xl bg-white p-2.5 text-left shadow-sm active:scale-[0.99]" onClick={() => (place ? onWalk(place.id) : onMap())} data-rdv-go={id}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: `linear-gradient(150deg, ${PINK[0]}, ${PINK[1]})` }}>
                  <Icon size={20} />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block font-display text-[15px] font-extrabold">{k.label()}</span>
                  <span className="block truncate text-[12px] font-bold text-[var(--color-ink-soft)]">
                    {place ? t('{place} · « {label} » sur place', { place: place.name, label: id === 'rdv-maquis' ? t('Dîner en amoureux') : id === 'rdv-lagune' ? t('Balade en amoureux au bord de l’eau') : t('Une glace en amoureux') }) : t('Pas dans ta commune : voir la carte')}
                  </span>
                </span>
                {place ? <Footprints size={18} className="text-[#d6336c]" /> : <MapIcon size={18} className="text-[#d6336c]" />}
              </button>
            )
          })}
        </div>
      )}

      {/* The thread with the partner met in the game */}
      {npc && v.thread.length > 0 && (
        <section>
          <h4 className="label mb-1.5 flex items-center gap-1">
            <MessagesSquare size={13} /> {t('Vos messages')}
          </h4>
          <div className="space-y-1.5 rounded-[20px] bg-[#fdf2f6] p-2.5" data-coeur-thread>
            {v.thread.slice(-8).map((m) => {
              const mot = motOf(m.body)
              return (
                <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                  <p className={`max-w-[84%] rounded-2xl px-3 py-1.5 text-[13.5px] leading-snug font-semibold ${m.mine ? 'rounded-tr-none bg-[#e64980] text-white' : 'rounded-tl-none bg-white text-[var(--color-ink)] shadow-sm'}`}>
                    {mot ? (
                      <>
                        <Heart size={12} className="mr-1 inline fill-current" />
                        {mot.text()}
                      </>
                    ) : (
                      m.body
                    )}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* The last dates */}
      {dates.length > 0 && (
        <section>
          <h4 className="label mb-1.5">{t('Vos derniers rendez-vous')}</h4>
          <ul className="space-y-1.5">
            {dates.map((d) => (
              <li key={d.at} className="flex items-center gap-2.5 rounded-2xl border border-[var(--color-line)] bg-white p-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#fff0f6] text-[#d6336c]">
                  <Heart size={17} className="fill-current" />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[14px] font-extrabold">{d.title}</span>
                  <span className="block truncate text-[12px] font-bold text-[var(--color-ink-soft)]">
                    {d.place} · {date(d.at)}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-[#fff0f6] px-2 py-0.5 text-[12px] font-extrabold text-[#d6336c]">+{d.love}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Action({ icon: Icon, label, sub, disabled, onClick }: { icon: typeof Heart; label: string; sub?: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button disabled={disabled} onClick={onClick} className={`flex min-h-[78px] flex-col items-center justify-center gap-1 rounded-[20px] bg-[#fff0f6] p-2 text-[#a61e4d] transition active:scale-[0.96] ${disabled ? 'opacity-45 grayscale-[0.5]' : ''}`} data-coeur-action={label}>
      <Icon size={24} />
      <span className="text-[13px] leading-none font-extrabold">{label}</span>
      {sub && <span className="text-[11px] leading-none font-bold opacity-70">{sub}</span>}
    </button>
  )
}

/** Nobody yet: how love is found in Babi, warmly. */
function Alone({ requests }: { requests: number }) {
  const steps: { icon: typeof Heart; title: string; text: string }[] = [
    { icon: UsersRound, title: t('Parle aux gens'), text: t('Dans la rue, au maquis, au grin : touche quelqu’un et causez. Échangez vos numéros, revoyez-vous.') },
    { icon: Sparkles, title: t('Drague un peu'), text: t('Quand vous êtes proches, ose la drague, un compliment, une invitation à sortir.') },
    { icon: HeartHandshake, title: t('Demande de sortir ensemble'), text: t('Dans la discussion : « Lui demander de sortir ensemble ». Entre joueurs : dans l’appli Amis.') },
  ]
  return (
    <div className="space-y-3 pt-2" data-coeur-empty>
      <div className="rounded-[24px] p-4 text-white" style={{ background: 'linear-gradient(155deg,#ffb3c8 0%,#e64980 100%)' }}>
        <Heart size={30} className="fill-white" />
        <div className="mt-1 font-display text-[21px] leading-tight font-extrabold">{t('Ton cœur est libre')}</div>
        <p className="mt-1 text-[13.5px] leading-snug font-semibold opacity-95">{t('Pas encore d’amoureux ou d’amoureuse ? À Babi, l’amour se trouve en vivant : voici comment.')}</p>
      </div>
      <ul className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 rounded-2xl border border-[var(--color-line)] bg-white p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fff0f6] text-[#d6336c]">
              <s.icon size={20} />
            </span>
            <span className="min-w-0 leading-snug">
              <span className="block font-display text-[15px] font-extrabold">{s.title}</span>
              <span className="block text-[12.5px] font-semibold text-[var(--color-ink-soft)]">{s.text}</span>
            </span>
          </li>
        ))}
      </ul>
      {requests > 0 && <p className="rounded-2xl bg-[#fff0f6] px-3 py-2 text-[13px] font-bold text-[#a61e4d]">{requests > 1 ? t('{n} demandes t’attendent dans l’appli Amis ❤', { n: requests }) : t('Une demande t’attend dans l’appli Amis ❤')}</p>}
    </div>
  )
}
