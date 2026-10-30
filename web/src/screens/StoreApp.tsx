import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Download, Search, Star, Trash2, X } from 'lucide-react'
import { api } from '../lib/api'
import type { PhoneApp, Sim, World } from '../lib/types'
import { AppLogo } from '../components/AppLogo'
import type { Act } from './phoneApps'
import { keyOpen, useFeatures } from '../lib/features'
import { t as tr } from '../lib/i18n'

// The phone's app store, laid out like the stores of real phones: a search,
// the tabs (for you, games, apps by kind, the ones on the phone), the featured
// ones up top, rows to slide through, the most downloaded, and each app's own
// page with its rating, its downloads and the big install button. The apps
// and their makers are the game's; ratings and downloads are made up, part
// of the game's world.

const PLAY = '#01875f' // the install buttons' green

const RATING: Record<string, number> = { waye: 4.8, gnango: 4.3, idrive: 4.1, golvo: 4.4, gbairai: 4.6, tikitoko: 4.5, babigram: 4.6, bet225: 4.2, parisfoot: 4.4, dodo: 4.4, kineo: 4.5, dames: 4.7, huit: 4.8, awale: 4.6, ludo: 4.7, gode: 4.5 }
const DOWNLOADS: Record<string, string> = { waye: tr('5 M+'), gnango: tr('1 M+'), idrive: tr('500 k+'), gbairai: tr('1 M+'), tikitoko: tr('5 M+'), babigram: tr('1 M+'), bet225: tr('1 M+'), parisfoot: tr('500 k+'), golvo: tr('500 k+'), dodo: tr('100 k+'), kineo: tr('100 k+'), dames: tr('100 k+'), huit: tr('500 k+'), awale: tr('100 k+'), ludo: tr('1 M+'), gode: tr('500 k+') }
/** Who's old enough for it, as the stores rate apps. */
const AGE: Record<string, string> = { bet225: '18+', parisfoot: '18+', tikitoko: '12+', babigram: '12+', gbairai: '12+', dodo: '12+' }
/** Made-up makers, by app. */
const MAKER: Record<string, string> = { waye: tr('Waye Mobile CI'), gnango: tr('Gnango Mobilité'), idrive: tr('iDrive Afrique'), gbairai: tr('Gbairai Studio'), tikitoko: tr('Tikitoko Média'), babigram: tr('Babigram Labs'), bet225: tr('Bet225 Gaming'), parisfoot: tr('ParisFoot SA'), golvo: tr('Garbaya Livraisons'), dodo: tr('Dodo Séjours'), kineo: tr('Kinéo Cinémas'), dames: tr('Grin Studio'), huit: tr('Maquis Games'), awale: tr('Grin Studio'), ludo: tr('Maquis Games'), gode: tr('Maquis Games') }
/** Up top on « Pour toi », in this order (when the world has them). */
const FEATURED = ['ludo', 'awale', 'huit', 'dames', 'kineo', 'tikitoko', 'dodo']

const downloads = (id: string) => DOWNLOADS[id] ?? tr('10 k+')
const order = (d: string) => parseFloat(d) * (d.includes('M') ? 1000 : 1)

type Tab = 'pour' | 'jeux' | 'applis' | 'mes'
const TABS: { id: Tab; label: string }[] = [
  { id: 'pour', label: tr('Pour toi') },
  { id: 'jeux', label: 'Jeux' },
  { id: 'applis', label: tr('Applis') },
  { id: 'mes', label: tr('Mes applis') },
]

export function StoreApp({ world, sim, act, onOpen }: { world: World; sim: Sim; act: Act; onOpen: (id: string) => void }) {
  // The apps an update hasn't brought yet (lib/features.ts) aren't in the Store.
  const feats = useFeatures()
  const apps = (world.phoneApps ?? []).filter((a) => keyOpen(feats, `app:${a.id}`))
  const [tab, setTab] = useState<Tab>('pour')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  const [page, setPage] = useState<PhoneApp | null>(null)
  const [busy, setBusy] = useState<{ id: string; progress: number } | null>(null)
  const installed = (id: string) => sim.apps?.includes(id) ?? false

  const install = (a: PhoneApp) => {
    // The download: a few seconds of progress, then the server installs it.
    setBusy({ id: a.id, progress: 0 })
    const t0 = Date.now()
    const tick = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / 2200)
      setBusy({ id: a.id, progress: p })
      if (p >= 1) {
        clearInterval(tick)
        act(tr('Installer {name}', { name: a.name }), 'download', '', () => api.setApp(sim.id, a.id, true)).finally(() => setBusy(null))
      }
    }, 80)
  }
  const remove = (a: PhoneApp) => act(tr('Désinstaller {name}', { name: a.name }), 'trash', '', () => api.setApp(sim.id, a.id, false))

  /** Ouvrir, Installer, or how far the download has got. */
  const button = (a: PhoneApp, wide = false) => {
    const size = wide ? 'w-full py-3 text-[15px]' : 'px-4 py-1.5 text-[13px]'
    if (busy?.id === a.id) return <span className={`inline-flex items-center justify-center rounded-full border-2 font-extrabold ${size}`} style={{ borderColor: PLAY, color: PLAY }}>{Math.round(busy.progress * 100)} %</span>
    if (installed(a.id))
      return (
        <button className={`rounded-full border-2 font-extrabold ${size}`} style={{ borderColor: PLAY, color: PLAY }} onClick={(e) => (e.stopPropagation(), onOpen(a.id))}>
          {tr('Ouvrir')}
        </button>
      )
    return (
      <button className={`inline-flex items-center justify-center gap-1.5 rounded-full font-extrabold text-white disabled:opacity-50 ${size}`} style={{ background: PLAY }} disabled={!!busy} onClick={(e) => (e.stopPropagation(), install(a))} aria-label={tr('Installer {name}', { name: a.name })}>
        {wide && <Download size={17} />}
        {tr('Installer')}
      </button>
    )
  }

  if (page) {
    const a = apps.find((x) => x.id === page.id) ?? page
    return <AppPage a={a} on={installed(a.id)} busy={busy?.id === a.id ? busy.progress : null} button={button(a, true)} onBack={() => setPage(null)} onRemove={() => remove(a)} />
  }

  const games = apps.filter((a) => a.category === 'Jeux')
  const others = apps.filter((a) => a.category !== 'Jeux')
  const cats = [...new Set(others.map((a) => a.category))]
  const found = q.trim() ? apps.filter((a) => `${a.name} ${a.tagline} ${a.category}`.toLowerCase().includes(q.trim().toLowerCase())) : null
  const row = (a: PhoneApp, rank?: number) => <Row key={a.id} a={a} rank={rank} button={button(a)} onOpen={() => setPage(a)} />

  return (
    <div className="-mx-3 -mt-2">
      {/* The search, then the tabs */}
      <div className="sticky top-0 z-10 bg-white px-3 pt-1">
        <label className="flex items-center gap-2 rounded-full bg-[var(--color-canvas)] px-4 py-2.5">
          <Search size={18} className="shrink-0 text-[var(--color-ink-soft)]" />
          <input className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-[var(--color-ink-soft)]" placeholder={tr('Rechercher des applis et des jeux')} value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <button onClick={() => setQ('')} aria-label={tr('Effacer')}>
              <X size={16} className="text-[var(--color-ink-soft)]" />
            </button>
          )}
        </label>
        {!found && (
          <div className="mt-1 flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.id} className={`shrink-0 border-b-[3px] px-3 py-2 text-[13px] font-extrabold ${tab === t.id ? '' : 'border-transparent text-[var(--color-ink-soft)]'}`} style={tab === t.id ? { borderColor: PLAY, color: PLAY } : undefined} onClick={() => (setTab(t.id), setCat(null))}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-3 pt-2 pb-4">
        {found ? (
          <>
            <Section title={tr('{length} résultat{0}', { length: found.length, 0: found.length > 1 ? 's' : '' })} />
            {found.length ? <ul className="space-y-1">{found.map((a) => row(a))}</ul> : <p className="py-8 text-center text-sm font-bold text-[var(--color-ink-soft)]">{tr('Rien de ce nom dans le Store.')}</p>}
          </>
        ) : tab === 'pour' ? (
          <>
            {/* The featured ones, big, to slide through */}
            <div className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-1">
              {FEATURED.map((id) => apps.find((a) => a.id === id))
                .filter((a): a is PhoneApp => !!a)
                .map((a) => (
                  <button key={a.id} className="w-[86%] shrink-0 snap-start overflow-hidden rounded-[22px] text-left text-white shadow-[0_8px_18px_-10px_rgba(0,0,0,0.5)]" onClick={() => setPage(a)}>
                    <div className="relative h-28 p-4" style={{ background: BANNER[a.id] ?? 'linear-gradient(135deg,#3b5bfd,#7a5cff)' }}>
                      <div className="text-[11px] font-extrabold tracking-wider uppercase opacity-80">{a.category === 'Jeux' ? tr('Jeu du moment') : tr('À la une')}</div>
                      <div className="font-display mt-1 max-w-[70%] text-xl leading-tight font-extrabold">{a.tagline}</div>
                      <span className="absolute right-3 bottom-3">
                        <AppLogo id={a.id} size={52} radius={15} />
                      </span>
                    </div>
                    <div className="flex items-center gap-2 bg-white px-4 py-2.5 text-[var(--color-ink)]">
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-[15px] leading-tight font-extrabold">{a.name}</div>
                        <Stars a={a} />
                      </div>
                      {button(a)}
                    </div>
                  </button>
                ))}
            </div>

            <Section title={tr('Recommandé pour toi')} />
            <Strip apps={others.filter((a) => !installed(a.id))} onOpen={setPage} />

            {/* The kinds, to look through */}
            <div className="-mx-3 mt-4 flex gap-2 overflow-x-auto px-3">
              {[...cats, 'Jeux'].map((c) => (
                <button key={c} className="shrink-0 rounded-full border border-[var(--color-line)] px-3.5 py-1.5 text-[13px] font-extrabold" onClick={() => (c === 'Jeux' ? setTab('jeux') : (setTab('applis'), setCat(c)))}>
                  {c}
                </button>
              ))}
            </div>

            <Section title={tr('Les plus téléchargées')} />
            <ul className="space-y-1">{[...apps].sort((x, y) => order(downloads(y.id)) - order(downloads(x.id)) || (RATING[y.id] ?? 4) - (RATING[x.id] ?? 4)).slice(0, 5).map((a, i) => row(a, i + 1))}</ul>

            <Section title={tr('Jeux à essayer')} onMore={() => setTab('jeux')} />
            <Strip apps={games} onOpen={setPage} />
          </>
        ) : tab === 'jeux' ? (
          <>
            <Section title={tr('Jeux de chez nous')} />
            <ul className="space-y-1">{games.map((a) => row(a))}</ul>
          </>
        ) : tab === 'applis' ? (
          // The apps by kind, a section each (or the one kind picked).
          (cat ? [cat] : cats).map((c) => (
            <div key={c}>
              <Section title={c} onMore={cat ? undefined : () => setCat(c)} />
              <ul className="space-y-1">{others.filter((a) => a.category === c).map((a) => row(a))}</ul>
            </div>
          ))
        ) : (
          <>
            <Section title={tr('Sur ton téléphone · {length}', { length: apps.filter((a) => installed(a.id)).length })} />
            {apps.some((a) => installed(a.id)) ? (
              <ul className="space-y-1">
                {apps
                  .filter((a) => installed(a.id))
                  .map((a) => (
                    <li key={a.id} className="flex items-center gap-3 rounded-2xl p-2 active:bg-[var(--color-canvas)]" onClick={() => setPage(a)}>
                      <AppLogo id={a.id} size={48} radius={14} />
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-[15px] leading-tight font-extrabold">{a.name}</div>
                        <div className="text-[11px] font-bold text-[var(--color-ink-soft)]">{a.sizeMB} {tr('Mo · à jour')}</div>
                      </div>
                      <button className="icon-btn bg-[var(--color-canvas)]" onClick={(e) => (e.stopPropagation(), remove(a))} aria-label={tr('Désinstaller {name}', { name: a.name })}>
                        <Trash2 size={16} className="text-[var(--color-ink-soft)]" />
                      </button>
                      {button(a)}
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="py-8 text-center text-sm font-bold text-[var(--color-ink-soft)]">{tr("Aucune appli installée pour l'instant.")}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** The banners' colours, by app (the others take the store's). */
const BANNER: Record<string, string> = {
  huit: 'linear-gradient(135deg,#1f8a55,#073f24)',
  dames: 'linear-gradient(135deg,#b07a3c,#4a2a12)',
  awale: 'linear-gradient(135deg,#b9824a,#4a2a12)',
  ludo: 'linear-gradient(135deg,#e03131,#7a1020)',
  gode: 'linear-gradient(135deg,#8a5a2b,#22110a)',
  kineo: 'linear-gradient(135deg,#e63946,#6b0716)',
  tikitoko: 'linear-gradient(135deg,#25f4ee,#111 55%,#fe2c55)',
  dodo: 'linear-gradient(135deg,#8b5cf6,#4c1d95)',
}

function Section({ title, onMore }: { title: string; onMore?: () => void }) {
  return (
    <div className="mt-4 mb-2 flex items-center justify-between">
      <h4 className="font-display text-[17px] font-extrabold">{title}</h4>
      {onMore && (
        <button className="icon-btn bg-transparent" onClick={onMore} aria-label={tr('Voir tout : {title}', { title })}>
          <ArrowRight size={18} />
        </button>
      )}
    </div>
  )
}

function Stars({ a }: { a: PhoneApp }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-[var(--color-ink-soft)]">
      <span className="flex items-center gap-0.5">
        {RATING[a.id] ?? 4} <Star size={10} className="fill-current" />
      </span>
      <span>{a.sizeMB} {tr('Mo')}</span>
    </div>
  )
}

/** A row of apps to slide through, the big icon above the name. */
function Strip({ apps, onOpen }: { apps: PhoneApp[]; onOpen: (a: PhoneApp) => void }) {
  return (
    <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-1">
      {apps.map((a) => (
        <button key={a.id} className="w-[76px] shrink-0 text-left" onClick={() => onOpen(a)}>
          <AppLogo id={a.id} size={72} radius={20} />
          <div className="mt-1.5 line-clamp-2 text-[12px] leading-tight font-extrabold">{a.name}</div>
          <div className="flex items-center gap-0.5 text-[11px] font-bold text-[var(--color-ink-soft)]">
            {RATING[a.id] ?? 4} <Star size={9} className="fill-current" />
          </div>
        </button>
      ))}
    </div>
  )
}

/** One app in a list: its icon, name, kind and rating; the button on the right; its page on a tap. */
function Row({ a, rank, button, onOpen }: { a: PhoneApp; rank?: number; button: React.ReactNode; onOpen: () => void }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl p-2 active:bg-[var(--color-canvas)]" onClick={onOpen}>
      {rank && <span className="font-display w-4 shrink-0 text-center text-sm font-extrabold text-[var(--color-ink-soft)]">{rank}</span>}
      <AppLogo id={a.id} size={52} radius={15} />
      <div className="min-w-0 flex-1">
        <div className="font-display text-[15px] leading-tight font-extrabold">{a.name}</div>
        <div className="truncate text-[12px] font-bold text-[var(--color-ink-soft)]">{a.category} · {a.tagline}</div>
        <Stars a={a} />
      </div>
      {button}
    </li>
  )
}

/** The app's own page: who makes it, its figures, the big button, what it does, its rating. */
function AppPage({ a, on, busy, button, onBack, onRemove }: { a: PhoneApp; on: boolean; busy: number | null; button: React.ReactNode; onBack: () => void; onRemove: () => void }) {
  const rating = RATING[a.id] ?? 4
  // A spread of the stars that gives the rating (made up, like it).
  const bars = [5, 4, 3, 2, 1].map((n) => Math.max(0.04, Math.exp(-Math.abs(n - rating) * 1.6)))
  const most = Math.max(...bars)
  return (
    <div className="-mt-2">
      <button className="mb-2 flex items-center gap-1 text-[13px] font-extrabold" style={{ color: PLAY }} onClick={onBack}>
        <ArrowLeft size={16} strokeWidth={2.6} /> {tr('Le Store')}
      </button>
      <div className="flex items-center gap-4">
        <AppLogo id={a.id} size={76} radius={20} />
        <div className="min-w-0">
          <div className="font-display text-2xl leading-tight font-extrabold">{a.name}</div>
          <div className="text-[13px] font-extrabold" style={{ color: PLAY }}>
            {MAKER[a.id] ?? tr('Studio de Babi')}
          </div>
          <div className="text-[11px] font-bold text-[var(--color-ink-soft)]">{a.category}</div>
        </div>
      </div>
      {/* The figures, side by side */}
      <div className="mt-4 grid grid-cols-4 divide-x divide-[var(--color-line)] text-center">
        {[
          [<span key="r" className="flex items-center justify-center gap-0.5">{rating} <Star size={12} className="fill-current" /></span>, 'avis'],
          [downloads(a.id), tr('téléchargements')],
          [AGE[a.id] ?? '3+', tr('âge')],
          [tr('{sizeMB} Mo', { sizeMB: a.sizeMB }), 'taille'],
        ].map(([v, l], i) => (
          <div key={i} className="px-1">
            <div className="font-display text-[15px] font-extrabold">{v}</div>
            <div className="text-[10px] font-bold text-[var(--color-ink-soft)]">{l}</div>
          </div>
        ))}
      </div>
      <div className="mt-4">{button}</div>
      {busy !== null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-canvas)]">
          <div className="h-full rounded-full" style={{ width: `${busy * 100}%`, background: PLAY }} />
        </div>
      )}
      {on && (
        <button className="mt-2 flex w-full items-center justify-center gap-1.5 py-1.5 text-[13px] font-extrabold text-[var(--color-ink-soft)]" onClick={onRemove}>
          <Trash2 size={14} /> {tr('Désinstaller')}
        </button>
      )}
      {on && (
        <div className="mt-1 flex items-center justify-center gap-1 text-[12px] font-extrabold" style={{ color: PLAY }}>
          <Check size={13} strokeWidth={3} /> {tr('Installée sur ton téléphone')}
        </div>
      )}

      <Section title={tr('À propos de cette appli')} />
      <p className="text-[13px] font-extrabold">{a.tagline}</p>
      <p className="mt-1 text-[13px] leading-snug font-bold text-[var(--color-ink-soft)]">{a.about}</p>
      <span className="mt-2 inline-block rounded-full border border-[var(--color-line)] px-3 py-1 text-[12px] font-extrabold">{a.category}</span>

      <Section title={tr('Notes et avis')} />
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="font-display text-5xl leading-none font-extrabold">{rating}</div>
          <div className="mt-1 flex justify-center text-[var(--color-gold)]">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} size={11} className={n <= Math.round(rating) ? 'fill-current' : ''} />
            ))}
          </div>
          <div className="text-[10px] font-bold text-[var(--color-ink-soft)]">{downloads(a.id)}</div>
        </div>
        <div className="flex-1 space-y-1">
          {bars.map((b, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px] font-extrabold text-[var(--color-ink-soft)]">
              <span className="w-2">{5 - i}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-canvas)]">
                <div className="h-full rounded-full" style={{ width: `${(b / most) * 100}%`, background: PLAY }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
