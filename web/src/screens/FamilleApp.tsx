import { useEffect, useState } from 'react'
import { Armchair, Award, Baby, Banknote, Briefcase, CalendarClock, Car, Check, Crown, Gem, Handshake, Heart, HeartHandshake, House, Lightbulb, Lock, MapPin, PiggyBank, Shirt, Sparkles, Trophy, Users, type LucideIcon } from 'lucide-react'
import { api, errorText } from '../lib/api'
import type { ActionResult, Crest, FamilyRank, HeirCouple, Heirloom, HeirloomChoice, HeirOption, HeritageState, Look, Sim } from '../lib/types'
import { CrestPicture } from '../components/heritage/Crest3D'
import { CREST_COLORS, CREST_EMBLEMS, CREST_SHAPES, DEFAULT_CREST, DEVISE_MAX, emblemLabel } from '../components/heritage/crestArt'
import { openRendezVous } from '../lib/rendezvous'
import { Portrait } from '../avatar/portrait'
import { randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'
import { elderLook, famOf, kidLook, stageLabel } from '../game/famille'
import { featLabel, generationLabel, heirKindLabel, heirLook, jalonHint, jalonLabel, playedLabel, tierLabel } from '../game/heritage'
import { sfx } from '../lib/sfx'
import { haptic } from '../lib/native'
import { reactToResult } from '../avatar/expressions'
import { locale, t } from '../lib/i18n'

// « Ma famille » (the update « heritage », backend sims/heritage.go): the lineage played generation after
// generation. Four tabs: the tree (the generations handed down, the Sim, its children and the baby on its
// way), the jalons (the age in hours played, the five goals, who would take over and what would come down,
// « Passer la main »), the elders (advice, the weekly blessing from their pot, a visit), the great families
// (the ten of the highest renom, and one's own place). The ceremony itself is components/heritage/Passation.

type Tab = 'jalons' | 'arbre' | 'heritage' | 'anciens' | 'familles'
const GOLD: [string, string] = ['#ffd36e', '#c98a00']
const JALON_ICONS: Record<string, LucideIcon> = { proprietaire: House, patron: Briefcase, fortune: Banknote, respecte: Handshake, famille: Users }

export function FamilleApp({ sim, onResult }: { sim: Sim; onResult: (r: ActionResult) => void }) {
  const [tab, setTab] = useState<Tab>('jalons')
  const [st, setSt] = useState<HeritageState | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const gen = famOf(sim)?.generation ?? 0
  const load = () =>
    api.heritage(sim.id).then(
      (s) => (setSt(s), setErr(null)),
      (e) => setErr(errorText(e, t('« Ma famille » ne répond pas. Réessaie.'))),
    )
  // The family brought up to date by the server first (a child of two players, the other parent's answer),
  // then read; again on each tab and every half minute while open (heritage2.go: nothing runs by itself).
  const sync = () =>
    api
      .ancien(sim.id, '-', 'sync')
      .then(onResult, () => undefined)
      .finally(() => void load())
  useEffect(() => void sync(), [sim.id, gen]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = setInterval(() => document.visibilityState === 'visible' && void sync(), 30_000)
    return () => clearInterval(k)
  }, [sim.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const call = async (f: () => Promise<ActionResult>, after?: (r: ActionResult) => void) => {
    setBusy(true)
    try {
      const r = await f()
      onResult(r)
      if (r.outcome?.text) setSaid(r.outcome.text)
      after?.(r)
      void load()
      return r
    } catch (e) {
      haptic('error')
      setSaid(errorText(e, t('Pas possible')))
      return null
    } finally {
      setBusy(false)
    }
  }
  if (err && !st) return <p className="p-3 text-sm font-bold text-[var(--color-ink-soft)]">{err}</p>
  if (!st) return <p className="p-3 text-sm font-bold text-[var(--color-ink-soft)]">…</p>
  const tabs: [Tab, string][] = [
    ['jalons', t('Jalons')],
    ['arbre', t('Arbre')],
    ['heritage', t('Héritage')],
    ['anciens', t('Anciens')],
    ['familles', t('Grandes familles')],
  ]
  return (
    <div className="space-y-3 pt-2" data-famille-app>
      {/* The family's banner: the name, the generation, the renom */}
      <div className="flex items-center gap-3 rounded-[22px] p-3 text-white shadow-[0_10px_24px_-14px_rgba(150,90,0,0.8)]" style={{ background: 'linear-gradient(150deg,#ffcf5a 0%,#e8890c 55%,#9c4a00 100%)' }}>
        <div className="h-[62px] w-[62px] shrink-0 overflow-hidden rounded-full bg-[#fff1cf] ring-[3px] ring-white/90">
          <Portrait look={sim.look} gender={sim.gender} framing="head" />
        </div>
        {/* The family's crest, once chosen (« Héritage ») */}
        {st.crest && (
          <span className="-ml-6 h-11 w-10 shrink-0 self-end drop-shadow-md" data-crest-banner>
            <CrestPicture crest={st.crest} />
          </span>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[11px] font-extrabold tracking-wider uppercase opacity-90">{generationLabel(st.generation)}</div>
          <div className="truncate font-display text-[21px] font-extrabold">{t('Famille {name}', { name: sim.lastName })}</div>
          {st.crest?.devise && <div className="truncate text-[12px] font-bold italic opacity-95">« {st.crest.devise} »</div>}
          <div className="flex items-center gap-1 text-[13px] font-bold">
            <Crown size={13} /> {t('Renommée {n}', { n: st.renom })}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1 rounded-2xl bg-black/[0.05] p-1" role="tablist">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={`rounded-xl px-0.5 py-2 text-[11.5px] leading-tight font-extrabold transition ${tab === id ? 'bg-white shadow-sm' : 'text-[var(--color-ink-soft)]'}`}
            onClick={() => (haptic('light'), setTab(id), setSaid(null), void sync())}
            data-famille-tab={id}
          >
            {label}
          </button>
        ))}
      </div>
      {said && (
        <p key={said} className="animate-pop rounded-2xl bg-[#fff4e0] px-3 py-2 text-[13.5px] font-bold text-[#8a4b00]">
          {said}
        </p>
      )}
      {tab === 'jalons' && <Jalons sim={sim} st={st} busy={busy} call={call} />}
      {tab === 'arbre' && <Arbre sim={sim} st={st} busy={busy} call={call} />}
      {tab === 'heritage' && <HeritageTab sim={sim} st={st} busy={busy} call={call} />}
      {tab === 'anciens' && <Anciens sim={sim} st={st} busy={busy} call={call} />}
      {tab === 'familles' && <Familles sim={sim} />}
    </div>
  )
}

type Call = (f: () => Promise<ActionResult>, after?: (r: ActionResult) => void) => Promise<ActionResult | null>

function Jalons({ sim, st, busy, call }: { sim: Sim; st: HeritageState; busy: boolean; call: Call }) {
  const [heir, setHeir] = useState<HeirOption>(st.heirs[0])
  const [ask, setAsk] = useState(false)
  // The heirloom handed down with the house (phase 3): one of the parent's things, or none.
  const [loom, setLoom] = useState<HeirloomChoice | null>(null)
  // (The heir chosen gone from the list, taken by the other parent: the question closes, never another heir silently.)
  useEffect(() => {
    const still = st.heirs.find((x) => x.id === heir?.id)
    if (!still) setAsk(false)
    setHeir(still ?? st.heirs[0])
  }, [st]) // eslint-disable-line react-hooks/exhaustive-deps
  const p = st.played
  const span = p.normal || 1
  const pct = Math.min(100, (100 * p.lived) / span)
  const early = (100 * p.early) / span
  const floor = new Date(st.floorAt)
  const waiting = floor.getTime() > Date.now()
  const f = (n: number) => `${n.toLocaleString(locale())} F`
  const pass = () =>
    void call(
      () => api.passation(sim.id, { heir: heir.id, look: heirLook(heir, sim.look), gen: st.generation, heirloom: loom ? { kind: loom.kind, item: loom.item } : undefined }),
      () => (sfx.bell(2), haptic('heavy'), reactToResult('me', 'bigwin')),
    ).then(() => setAsk(false))
  return (
    <div className="space-y-3">
      {/* The age, in hours played: 50 (early, with 3 jalons) and 60 marked */}
      <div className="rounded-[20px] bg-white p-3 shadow-sm">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-[17px] font-extrabold">{t('{n} ans', { n: st.years })}</span>
          <span className="text-[12px] font-bold text-[var(--color-ink-soft)]">{stageLabel(st.stage)}</span>
        </div>
        <div className="relative mt-2 h-3 rounded-full bg-black/[0.07]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#ffcf5a] to-[#e8890c] transition-[width] duration-700" style={{ width: `${pct}%` }} />
          <span className="absolute -top-1 h-5 w-0.5 rounded bg-[#2b8a3e]" style={{ left: `${early}%` }} />
          <span className="absolute -top-1 right-0 h-5 w-0.5 rounded bg-[#c92a2a]" />
        </div>
        <div className="relative mt-1 h-4 text-[11px] font-extrabold text-[var(--color-ink-soft)]">
          <span className="absolute -translate-x-1/2" style={{ left: `${early}%` }}>
            50
          </span>
          <span className="absolute right-0">60</span>
        </div>
        <p className="mt-1 text-[12.5px] leading-snug font-bold text-[var(--color-ink-soft)]">
          {p.lived >= p.normal ? t('Tu as l’âge de passer la main.') : t('Encore {d} de jeu avant tes 60 ans ({e} avant 50).', { d: playedLabel(p.normal - p.lived), e: playedLabel(Math.max(0, p.early - p.lived)) })} {t('Le temps ne passe que quand tu joues.')}
        </p>
        {waiting && <p className="mt-1 text-[12.5px] font-bold text-[#8a4b00]">{t('Cette génération dure au moins jusqu’au {date}.', { date: floor.toLocaleDateString(locale(), { day: 'numeric', month: 'long' }) })}</p>}
        {st.nudge && <p className="mt-1 text-[12.5px] font-bold text-[#c92a2a]">{st.nudge}</p>}
      </div>

      {/* The five jalons */}
      <div className="rounded-[20px] bg-white p-3 shadow-sm">
        <div className="label mb-1.5">{t('Jalons : {n} sur 5', { n: st.done })}</div>
        <ul className="space-y-1.5">
          {st.jalons.map((j) => {
            const Icon = JALON_ICONS[j.id] ?? Sparkles
            return (
              <li key={j.id} className={`flex items-center gap-2.5 rounded-2xl p-2 ${j.done ? 'bg-[#ebfbee]' : 'bg-black/[0.035]'}`} data-jalon={j.id}>
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${j.done ? 'bg-[#2b8a3e] text-white' : 'bg-white text-[var(--color-ink-soft)]'}`}>{j.done ? <Check size={18} strokeWidth={3} /> : <Icon size={18} />}</span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-[14px] font-extrabold">{jalonLabel(j.id)}</span>
                  <span className="block text-[12px] font-bold text-[var(--color-ink-soft)]">{jalonHint(j.id)}</span>
                </span>
              </li>
            )
          })}
        </ul>
        <p className="mt-1.5 text-[12px] font-bold text-[var(--color-ink-soft)]">{t('Avec 3 jalons, tu peux passer la main dès 50 ans.')}</p>
      </div>

      {/* What the generation did, written as it happened (renom counts it) */}
      {!!st.feats?.length && (
        <div className="rounded-[20px] bg-white p-3 shadow-sm" data-feats>
          <div className="label mb-1.5">{t('Les hauts faits de ta génération')}</div>
          <ul className="space-y-1">
            {st.feats.map((x) => (
              <li key={`${x.kind}${x.detail}`} className="flex items-center gap-2 text-[13px] font-bold">
                <Award size={15} className="shrink-0 text-[#e8890c]" />
                <span className="min-w-0 flex-1">{featLabel(x.kind, x.detail)}</span>
                <span className="text-[11px] text-[var(--color-ink-soft)]">{new Date(x.at).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Who takes over, and what comes down */}
      <div className="rounded-[20px] bg-white p-3 shadow-sm">
        <div className="label mb-1.5">{t('Qui reprend la maison')}</div>
        <div className="space-y-1.5">
          {st.heirs.map((h) => (
            <button key={h.id} className={`flex w-full items-center gap-2.5 rounded-2xl p-2 text-left transition active:scale-[0.99] ${heir?.id === h.id ? 'bg-[#fff4e0] ring-2 ring-[#e8890c]' : 'bg-black/[0.035]'}`} onClick={() => (haptic('light'), setHeir(h))} data-heir={h.id}>
              <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-white bg-gradient-to-b from-[#fff1cf] to-[#ffc96b]">
                <Portrait look={heirLook(h, sim.look)} gender={h.gender} framing="head" />
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[14px] font-extrabold">{h.name}</span>
                <span className="block text-[12px] font-bold text-[var(--color-ink-soft)]">
                  {heirKindLabel(h.kind, h.gender)}
                  {h.kind === 'filleul' && h.parent ? ` (${t('enfant de {name}', { name: h.parent })})` : h.kind === 'couple' && h.parent ? ` (${t('avec {name}', { name: h.parent })})` : ''} · {t('{n} ans', { n: h.years })} · {t('{n} % de l’héritage', { n: h.share })}
                </span>
              </span>
            </button>
          ))}
        </div>
        {heir?.kind === 'neveu' && <p className="mt-1.5 text-[12px] leading-snug font-bold text-[var(--color-ink-soft)]">{t('Pas d’enfant de 18 ans : un neveu ou une nièce porte le nom. Pour un enfant à toi, en couple à la maison ou à l’orphelinat (dès 25 ans).')}</p>}
        {heir?.kind === 'filleul' && <p className="mt-1.5 text-[12px] leading-snug font-bold text-[var(--color-ink-soft)]">{t('L’enfant de ton ami·e d’enfance prend le nom {last}, et {name} devient son tonton ou sa tata.', { last: sim.lastName, name: heir.parent ?? '' })}</p>}
        {heir?.kind === 'couple' && <p className="mt-1.5 text-[12px] leading-snug font-bold text-[var(--color-ink-soft)]">{t('Votre enfant à deux : le premier parent qui lui passe la main l’emmène. L’argent ne passe jamais d’une maison à l’autre.')}</p>}
        <ul className="mt-2.5 grid grid-cols-2 gap-1.5 text-[12.5px] font-bold">
          <Fig icon={Banknote} label={t('Héritage')} value={f(st.preview.heir)} tone="#2b8a3e" />
          <Fig icon={Lock} label={t('Droits de succession')} value={f(st.preview.fee)} tone={st.preview.fee ? '#c92a2a' : undefined} />
          <Fig icon={PiggyBank} label={t('Cagnotte de l’ancien')} value={f(st.preview.pot)} />
          <Fig icon={Crown} label={t('Renommée')} value={`+${st.preview.renom}`} tone="#e8590c" />
          <Fig icon={Users} label={t('Famille')} value={st.preview.tierFrom === st.preview.tierTo ? tierLabel(st.preview.tierTo) : `${tierLabel(st.preview.tierFrom)} → ${tierLabel(st.preview.tierTo)}`} />
          <Fig icon={House} label={t('Gardé')} value={t('maison, terrains, véhicules')} />
        </ul>
        <p className="mt-2 text-[12px] leading-snug font-bold text-[var(--color-ink-soft)]">{t('Les dettes ne passent jamais. L’héritier repasse ses diplômes et refait ses papiers ; il garde une part de ce que tu savais faire, et tes amis deviennent ses tontons et tatas.')}</p>
        {!ask ? (
          <button className="btn mt-3 w-full" disabled={!st.can || busy || !heir} onClick={() => (haptic('medium'), setAsk(true))} data-passer-la-main>
            <HeartHandshake size={18} /> {t('Passer la main')}
          </button>
        ) : (
          <div className="animate-pop mt-3 rounded-2xl bg-[#fff4e0] p-3">
            <p className="text-[14px] leading-snug font-extrabold">{t('Passer la main à {heir} ?', { heir: heir.name })}</p>
            <p className="mt-1 text-[12px] leading-snug font-bold text-[var(--color-ink-soft)]">{t('Tu joueras {heir} à partir de maintenant. {name} reste à la maison, parmi les anciens.', { heir: heir.name, name: sim.firstName })}</p>
            {!!st.choices?.length && <HeirloomPicker choices={st.choices} pick={loom} onPick={setLoom} from={sim.firstName} to={heir.name} />}
            <div className="mt-2 flex gap-2">
              <button className="btn flex-1 !py-2" disabled={busy} onClick={pass} data-passation-go>
                <HeartHandshake size={16} /> {t('Oui, passer la main')}
              </button>
              <button className="btn btn-soft !py-2" onClick={() => setAsk(false)}>
                {t('Annuler')}
              </button>
            </div>
          </div>
        )}
        {!st.can && st.why && <p className="mt-1.5 text-[12px] leading-snug font-bold text-[var(--color-ink-soft)]">{st.why}</p>}
      </div>
    </div>
  )
}

function Fig({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone?: string }) {
  return (
    <li className="rounded-2xl bg-black/[0.035] px-2.5 py-1.5 leading-tight">
      <span className="flex items-center gap-1 text-[11px] text-[var(--color-ink-soft)]">
        <Icon size={12} /> {label}
      </span>
      <span className="block truncate text-[14px] font-extrabold" style={{ color: tone }}>
        {value}
      </span>
    </li>
  )
}

/** One face in the tree. */
function Face({ look, gender, stage, name, line, me, dim }: { look: Look; gender: 'femme' | 'homme'; stage?: string; name: string; line: string; me?: boolean; dim?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-2xl p-2 ${me ? 'bg-[#fff4e0] ring-2 ring-[#e8890c]' : 'bg-black/[0.035]'} ${dim ? 'opacity-70' : ''}`}>
      <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-white bg-gradient-to-b from-[#e3f1ff] to-[#9cc7ff]">
        <Portrait look={look} gender={gender} framing="head" stage={stage} />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[14px] font-extrabold">{name}</span>
        <span className="block text-[12px] font-bold text-[var(--color-ink-soft)]">{line}</span>
      </span>
    </div>
  )
}

function Arbre({ sim, st, busy, call }: { sim: Sim; st: HeritageState; busy: boolean; call: Call }) {
  const f = famOf(sim)
  const partner = sim.friends?.find((x) => x.partner && x.home)
  const [fade, setFade] = useState<string | null>(null)
  const canBaby = !!partner && !f?.expecting && st.stage !== 'senior' && (f?.kids?.length ?? 0) < 6
  const tryBaby = () => {
    setFade('')
    sfx.pop()
    void call(() => api.famille(sim.id, 'bebe')).then((r) => {
      setTimeout(() => setFade(r?.outcome?.text ?? null), 1800)
      setTimeout(() => setFade(null), 4600)
    })
  }
  return (
    <div className="space-y-1.5">
      {st.history.map((g) => (
        <div key={g.n} className="relative pl-4">
          <span className="absolute top-0 bottom-[-6px] left-1.5 w-0.5 bg-[#e8c98a]" />
          <Face look={g.look ?? randomLook(g.gender, rng(`gen${g.n}`))} gender={g.gender} name={g.name} line={t('{g} · {n} ans · +{r} de renommée', { g: generationLabel(g.n), n: g.years, r: g.renom })} />
        </div>
      ))}
      <div className="relative pl-4">
        {st.history.length > 0 && <span className="absolute top-0 left-1.5 h-4 w-0.5 bg-[#e8c98a]" />}
        <Face look={sim.look} gender={sim.gender} name={`${sim.firstName} ${sim.lastName}`} line={`${generationLabel(st.generation)} · ${t('{n} ans', { n: st.years })}`} me />
      </div>
      {partner && (
        <div className="pl-8">
          <Face look={partner.look ?? randomLook(partner.gender, rng(`partner${partner.id}`))} gender={partner.gender} name={partner.name} line={t('Ta moitié, à la maison')} />
        </div>
      )}
      {(f?.kids ?? []).map((k) => (
        <div key={k.id} className="pl-8">
          <Face
            look={kidLook(k, sim.look)}
            gender={k.gender}
            stage={k.stage}
            name={k.name}
            dim={!!k.took}
            line={k.took ? t('A repris la maison de {name}', { name: k.took }) : `${k.adopted ? t('Adopté·e') + ' · ' : ''}${k.with ? t('avec {name}', { name: k.with }) + ' · ' : ''}${stageLabel(k.stage)} · ${t('{n} ans', { n: k.years ?? 0 })}`}
          />
        </div>
      ))}
      {f?.expecting && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-[#ffe9f1] p-2 pl-8">
          <Baby size={20} className="text-[#e0245e]" />
          <span className="text-[13px] font-extrabold">{f.expecting.adopt ? t('Un enfant arrive de l’orphelinat') : f.expecting.shared && f.expecting.kid?.with ? t('Un bébé en route avec {name}', { name: f.expecting.kid.with }) : f.expecting.mother ? t('Un bébé en route') : t('Une adoption en cours')}</span>
        </div>
      )}
      {!f?.kids?.length && !f?.expecting && <p className="px-1 py-1 text-[12.5px] leading-snug font-bold text-[var(--color-ink-soft)]">{t('Pas encore d’enfant. En couple à la maison : « Essayer d’avoir un bébé ». Ou adopte à l’orphelinat, dès 25 ans (dossier 50 000 F).')}</p>}
      {canBaby && (
        <button className="btn btn-soft mt-1 w-full" disabled={busy} onClick={tryBaby}>
          <Baby size={18} /> {t("Essayer d'avoir un bébé")}
        </button>
      )}
      {f?.arrival && <NameBaby sim={sim} busy={busy} call={call} />}
      {st.couple && <CoupleCard sim={sim} st={st} couple={st.couple} busy={busy} call={call} onFade={(text) => (setFade(''), setTimeout(() => setFade(text), 1800), setTimeout(() => setFade(null), 4600))} />}
      {fade !== null && (
        <div className="pointer-events-none fixed inset-0 z-[85] grid place-items-center bg-[#05060f] animate-fade">
          <div className="px-8 text-center text-white/90">
            <div className="text-5xl">{fade ? '💞' : '🌙'}</div>
            <p className="mt-3 font-display text-xl font-extrabold">{fade || t('Un moment rien qu’à deux…')}</p>
          </div>
        </div>
      )}
    </div>
  )
}

/** The newborn's first name: the one drawn by the server, kept or changed (also with le mode vie shut). */
function NameBaby({ sim, busy, call }: { sim: Sim; busy: boolean; call: Call }) {
  const f = famOf(sim)
  const kid = f?.kids?.find((k) => k.id === f.arrival)
  const [name, setName] = useState(kid?.name ?? '')
  useEffect(() => setName(kid?.name ?? ''), [kid?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!kid) return null
  const save = () => void call(() => api.famille(sim.id, 'nommer', { kid: kid.id, name: name.trim() || kid.name }), () => (sfx.pop(), haptic('medium'), reactToResult('me', 'won')))
  return (
    <div className="animate-pop mt-1 rounded-[20px] bg-[#ffe9f1] p-3" data-nommer>
      <div className="flex items-center gap-2.5">
        <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-white bg-gradient-to-b from-[#fff1f6] to-[#ffb3cf]">
          <Portrait look={kidLook(kid, sim.look)} gender={kid.gender} framing="head" stage="bebe" />
        </span>
        <p className="min-w-0 flex-1 text-[14px] leading-snug font-extrabold">{kid.with ? t('Bienvenue au bébé de {a} et {b} ! Son prénom ?', { a: sim.firstName, b: kid.with }) : t('Bienvenue au bébé ! Quel prénom lui donnes-tu ?')}</p>
      </div>
      <div className="mt-2 flex gap-2">
        <input className="min-w-0 flex-1 rounded-2xl border-2 border-white bg-white px-3 py-2 text-[15px] font-bold outline-none focus:border-[#e0245e]" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} aria-label={t('Prénom')} />
        <button className="btn !px-4 !py-2" disabled={busy || name.trim().length < 2} onClick={save}>
          <Check size={16} /> {t('C’est son prénom')}
        </button>
      </div>
    </div>
  )
}

/** The player one is with: making it official, then a baby, each asked of the other and said yes to (fade to black). */
function CoupleCard({ sim, st, couple, busy, call, onFade }: { sim: Sim; st: HeritageState; couple: HeirCouple; busy: boolean; call: Call; onFade: (text: string | null) => void }) {
  const f = famOf(sim)
  const official = couple.stage !== 'ensemble' && couple.stage !== ''
  const kind = official ? 'bebe' : 'officiel'
  const asking = couple.asking.includes(kind)
  const asked = couple.asked.includes(kind)
  const blocked = kind === 'bebe' && (!!f?.expecting || (f?.kids?.length ?? 0) >= 6 || st.stage === 'senior')
  const go = (action: 'demander' | 'accepter' | 'refuser' | 'annuler') =>
    void call(
      () => api.heritageCouple(sim.id, kind, action),
      (r) => {
        if (action === 'accepter' || (action === 'demander' && asking)) {
          if (kind === 'bebe') onFade(r.outcome?.text ?? null)
          sfx.bell(1)
          haptic('heavy')
          reactToResult('me', 'bigwin')
        } else haptic('light')
      },
    )
  return (
    <div className="mt-2 rounded-[20px] bg-white p-3 shadow-sm" data-couple-card>
      <div className="flex items-center gap-2.5">
        <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-white bg-gradient-to-b from-[#ffe3ec] to-[#ff9cbc]">
          <Portrait look={couple.look ?? randomLook(couple.gender, rng(`couple${couple.id}`))} gender={couple.gender} framing="head" />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[14px] font-extrabold">{couple.name}</span>
          <span className="flex items-center gap-1 text-[12px] font-bold text-[#e0245e]">
            <Heart size={12} fill="currentColor" /> {couple.stageLabel}
          </span>
        </span>
      </div>
      {asking ? (
        <div className="animate-pop mt-2 rounded-2xl bg-[#fff0f5] p-2.5">
          <p className="text-[13.5px] leading-snug font-extrabold">{kind === 'bebe' ? t('{name} aimerait avoir un bébé avec toi.', { name: couple.name }) : t('{name} veut officialiser votre couple.', { name: couple.name })}</p>
          <div className="mt-2 flex gap-2">
            <button className="btn flex-1 !py-2" disabled={busy || blocked} onClick={() => go('accepter')} data-couple-oui>
              <Heart size={16} /> {t('Oui')}
            </button>
            <button className="btn btn-soft !py-2" disabled={busy} onClick={() => go('refuser')}>
              {t('Pas maintenant')}
            </button>
          </div>
        </div>
      ) : asked ? (
        <div className="mt-2 flex items-center gap-2 rounded-2xl bg-black/[0.035] p-2.5">
          <p className="min-w-0 flex-1 text-[12.5px] font-bold text-[var(--color-ink-soft)]">{t('Demandé : {name} répond depuis son appli « Ma famille ».', { name: couple.name })}</p>
          <button className="text-[12px] font-extrabold text-[var(--color-ink-soft)] underline" disabled={busy} onClick={() => go('annuler')}>
            {t('Retirer')}
          </button>
        </div>
      ) : blocked && f?.expecting ? null : (
        <button className="btn btn-soft mt-2 w-full" disabled={busy || blocked} onClick={() => go('demander')} data-couple-demander={kind}>
          {kind === 'bebe' ? <Baby size={18} /> : <Heart size={18} />} {kind === 'bebe' ? t('Proposer d’avoir un bébé à {name}', { name: couple.name }) : t('Officialiser notre couple')}
        </button>
      )}
      <p className="mt-1.5 text-[11.5px] leading-snug font-bold text-[var(--color-ink-soft)]">{kind === 'bebe' ? t('Il faut le oui de vous deux. L’enfant est à vous deux : il grandit dans vos deux familles, au fil de votre temps de jeu.') : t('Un bébé à deux, c’est pour un couple officiel : demande-le, il ou elle répond.')}</p>
    </div>
  )
}

function Anciens({ sim, st, busy, call }: { sim: Sim; st: HeritageState; busy: boolean; call: Call }) {
  if (!st.elders.length) return <p className="px-1 py-2 text-[13px] leading-snug font-bold text-[var(--color-ink-soft)]">{t('Quand tu passeras la main, tu resteras à la maison parmi les anciens : un conseil, une bénédiction chaque semaine, une visite.')}</p>
  const days = (s: number) => Math.max(1, Math.ceil(s / 86400))
  return (
    <div className="space-y-2">
      {st.mentor && (
        <p className="flex items-center gap-1.5 rounded-2xl bg-[#e7f5ff] px-3 py-2 text-[12.5px] font-bold text-[#1c5d99]">
          <Lightbulb size={14} /> {t('{name} est maintenant ton mentor (appli Mentor).', { name: st.mentor.name })}
        </p>
      )}
      {st.elders.map((e) => (
        <div key={e.id} className="rounded-[20px] bg-white p-2.5 shadow-sm" data-ancien={e.id}>
          <div className="flex items-center gap-2.5">
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-white bg-gradient-to-b from-[#f3e8ff] to-[#c9a7ff]">
              <Portrait look={elderLook(e)} gender={e.gender} framing="head" />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[14px] font-extrabold">{e.name}</span>
              <span className="block text-[12px] font-bold text-[var(--color-ink-soft)]">
                {e.kin === 'papa' ? t('Papa') : t('Maman')} · {t('{n} ans', { n: e.years ?? 0 })}
                {e.gen ? ` · ${generationLabel(e.gen)}` : ''}
              </span>
              {e.village && (
                <span className="mt-0.5 flex items-center gap-1 text-[11.5px] font-extrabold text-[#8a4b00]">
                  <MapPin size={11} /> {t('Se repose au village')}
                </span>
              )}
            </span>
            <span className="text-right leading-tight">
              <span className="block text-[10.5px] font-extrabold text-[var(--color-ink-soft)] uppercase">{t('Cagnotte')}</span>
              <span className="text-[14px] font-extrabold">{(e.pot ?? 0).toLocaleString(locale())} F</span>
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <ElderBtn icon={Lightbulb} label={t('Conseil')} disabled={busy} onClick={() => void call(() => api.ancien(sim.id, e.id, 'conseil'))} />
            <ElderBtn
              icon={Sparkles}
              label={t('Bénédiction')}
              sub={e.blessIn > 0 ? t('dans {n} j', { n: days(e.blessIn) }) : !e.pot ? t('cagnotte vide') : undefined}
              disabled={busy || e.blessIn > 0 || !e.pot}
              onClick={() =>
                void call(
                  () => api.ancien(sim.id, e.id, 'benediction'),
                  () => (sfx.coins(3), haptic('medium'), reactToResult('me', 'won')),
                )
              }
            />
            <ElderBtn icon={HeartHandshake} label={t('Visite')} disabled={busy || !!e.village} onClick={() => void call(() => api.ancien(sim.id, e.id, 'visite'))} />
          </div>
        </div>
      ))}
      <p className="px-1 text-[12px] leading-snug font-bold text-[var(--color-ink-soft)]">{t('La bénédiction vient de la cagnotte de l’ancien : jusqu’à 5 000 F, une fois par semaine.')}</p>
    </div>
  )
}

function ElderBtn({ icon: Icon, label, sub, disabled, onClick }: { icon: LucideIcon; label: string; sub?: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button className="flex flex-col items-center rounded-2xl bg-[#fff4e0] px-1 py-2 text-[12px] leading-tight font-extrabold text-[#8a4b00] transition enabled:active:scale-95 disabled:opacity-45" disabled={disabled} onClick={() => (haptic('light'), onClick())}>
      <Icon size={18} />
      <span className="mt-0.5">{label}</span>
      {sub && <span className="text-[10.5px] font-bold opacity-80">{sub}</span>}
    </button>
  )
}

function Familles({ sim }: { sim: Sim }) {
  const [r, setR] = useState<{ top: FamilyRank[]; mine: FamilyRank } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    api.familles(sim.id).then(setR, (e) => setErr(errorText(e, t('Le classement ne répond pas.'))))
  }, [sim.id])
  if (err) return <p className="p-2 text-sm font-bold text-[var(--color-ink-soft)]">{err}</p>
  if (!r) return <p className="p-2 text-sm font-bold text-[var(--color-ink-soft)]">…</p>
  const inTop = r.top.some((x) => x.id === r.mine.id)
  return (
    <div className="space-y-1.5" data-classement>
      {!r.top.length && <p className="px-1 py-2 text-[13px] font-bold text-[var(--color-ink-soft)]">{t('Aucune famille n’a encore passé la main. La première sera en tête !')}</p>}
      {r.top.map((x) => (
        <Rank key={x.id} r={x} me={x.id === r.mine.id} />
      ))}
      {!inTop && (
        <>
          <div className="py-1 text-center text-[12px] font-extrabold text-[var(--color-ink-soft)]">…</div>
          <Rank r={r.mine} me />
        </>
      )}
      <p className="px-1 pt-1 text-[12px] leading-snug font-bold text-[var(--color-ink-soft)]">{t('La renommée grandit à chaque génération passée : patrimoine, terrains, immeubles, métier, mandats, diplômes, enfants, mariage, quartier.')}</p>
    </div>
  )
}

function Rank({ r, me }: { r: FamilyRank; me?: boolean }) {
  const medal = r.rank === 1 ? '#f0b400' : r.rank === 2 ? '#a5adb8' : r.rank === 3 ? '#c87533' : undefined
  return (
    <div className={`flex items-center gap-2.5 rounded-2xl p-2.5 ${me ? 'bg-[#fff4e0] ring-2 ring-[#e8890c]' : 'bg-black/[0.035]'}`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[14px] font-extrabold text-white" style={{ background: medal ?? 'var(--color-ink-soft)' }}>
        {medal ? <Trophy size={16} /> : (r.rank ?? '–')}
      </span>
      {r.crest && (
        <span className="h-10 w-9 shrink-0" data-rank-crest>
          <CrestPicture crest={r.crest} />
        </span>
      )}
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[14px] font-extrabold">{t('Famille {name}', { name: r.lastName })}</span>
        <span className="block truncate text-[12px] font-bold text-[var(--color-ink-soft)]">
          {generationLabel(r.generation)} · {r.name}
          {r.crest?.devise ? ` · « ${r.crest.devise} »` : ''}
        </span>
      </span>
      <span className="flex items-center gap-1 text-[14px] font-extrabold" style={{ color: GOLD[1] }}>
        <Crown size={14} /> {r.renom}
      </span>
    </div>
  )
}

const LOOM_ICONS: Record<Heirloom['kind'], LucideIcon> = { meuble: Armchair, vetement: Shirt, vehicule: Car }

/** « Objet de famille · Génération N ». */
export const heirloomBadge = (gens: number) => t('Objet de famille · Génération {n}', { n: gens })

/** At the passation: which of the parent's things goes down with the house (none, or one). */
function HeirloomPicker({ choices, pick, onPick, from, to }: { choices: HeirloomChoice[]; pick: HeirloomChoice | null; onPick: (c: HeirloomChoice | null) => void; from: string; to: string }) {
  return (
    <div className="mt-2.5" data-heirloom-picker>
      <div className="label mb-1 flex items-center gap-1">
        <Gem size={13} /> {t('Un objet de famille à transmettre')}
      </div>
      <div className="flex max-h-[148px] flex-wrap gap-1.5 overflow-y-auto">
        <button className={`rounded-full px-3 py-1.5 text-[12.5px] font-extrabold ${!pick ? 'bg-[#8a4b00] text-white' : 'bg-white'}`} onClick={() => (haptic('light'), onPick(null))}>
          {t('Aucun')}
        </button>
        {choices.map((c) => {
          const Icon = LOOM_ICONS[c.kind]
          const on = pick?.kind === c.kind && pick.item === c.item
          return (
            <button key={`${c.kind}:${c.item}`} className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-[12.5px] font-extrabold transition active:scale-95 ${on ? 'bg-[#8a4b00] text-white' : 'bg-white'}`} onClick={() => (haptic('light'), onPick(c))} data-heirloom={`${c.kind}:${c.item}`}>
              <Icon size={14} /> {c.label}
              {!!c.gens && <Crown size={12} className={on ? 'text-[#ffd36e]' : 'text-[#c98a00]'} />}
            </button>
          )
        })}
      </div>
      {pick && <p className="mt-1.5 text-[12px] leading-snug font-bold text-[#8a4b00] italic">{t('Gravé : « De {from} à {to} »', { from, to })} · {heirloomBadge((pick.gens ?? 0) + 1)}</p>}
    </div>
  )
}

/** « Héritage »: the family's crest and devise, its heirlooms, the weekly fête. */
function HeritageTab({ sim, st, busy, call }: { sim: Sim; st: HeritageState; busy: boolean; call: Call }) {
  return (
    <div className="space-y-3">
      <CrestEditor sim={sim} st={st} busy={busy} call={call} />
      <Heirlooms list={st.heirlooms ?? []} />
      {st.fete && <FeteCard st={st} />}
    </div>
  )
}

function CrestEditor({ sim, st, busy, call }: { sim: Sim; st: HeritageState; busy: boolean; call: Call }) {
  const [c, setC] = useState<Crest>(st.crest ?? DEFAULT_CREST)
  const [editing, setEditing] = useState(!st.crest)
  useEffect(() => {
    if (st.crest && !editing) setC(st.crest)
  }, [st.crest]) // eslint-disable-line react-hooks/exhaustive-deps
  const can = !!st.crestCan
  const set = (x: Partial<Crest>) => (haptic('light'), sfx.pop(), setC((o) => ({ ...o, ...x })))
  const save = () => void call(() => api.heritageCrest(sim.id, { ...c, devise: c.devise.trim() }), () => (sfx.bell(2), haptic('heavy'), reactToResult('me', 'bigwin'), setEditing(false)))
  return (
    <div className="rounded-[20px] bg-white p-3 shadow-sm" data-crest-editor>
      <div className="label mb-1.5">{t('Le blason de la famille')}</div>
      <div className="flex items-center gap-3">
        <span key={`${c.shape}${c.colors.join()}${c.emblem}`} className="animate-pop h-[104px] w-[92px] shrink-0">
          <CrestPicture crest={c} />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-display text-[17px] font-extrabold">{t('Famille {name}', { name: sim.lastName })}</div>
          {c.devise.trim() ? <div className="mt-0.5 text-[13px] font-bold text-[#8a4b00] italic">« {c.devise.trim()} »</div> : <div className="mt-0.5 text-[12px] font-bold text-[var(--color-ink-soft)]">{t('Pas encore de devise')}</div>}
          <div className="mt-1 text-[11.5px] font-bold text-[var(--color-ink-soft)]">{can ? t('Sur ta maison, dans le classement et sur ton profil. Une fois par génération.') : t('Choisi pour cette génération : ton héritier pourra le changer.')}</div>
        </div>
      </div>
      {can && !editing && (
        <button className="btn btn-soft mt-2 w-full" onClick={() => (haptic('light'), setEditing(true))}>
          {t('Changer le blason')}
        </button>
      )}
      {can && editing && (
        <div className="mt-2 space-y-2.5">
          <div className="grid grid-cols-2 gap-1.5">
            {CREST_SHAPES.map((sh) => (
              <button key={sh} className={`flex items-center gap-2 rounded-2xl p-1.5 text-[13px] font-extrabold ${c.shape === sh ? 'bg-[#fff4e0] ring-2 ring-[#e8890c]' : 'bg-black/[0.035]'}`} onClick={() => set({ shape: sh })} data-crest-shape={sh}>
                <span className="h-9 w-8">
                  <CrestPicture crest={{ ...c, shape: sh }} />
                </span>
                {sh === 'rond' ? t('Rond') : t('Bouclier')}
              </button>
            ))}
          </div>
          {[0, 1].map((i) => (
            <div key={i}>
              <div className="mb-1 text-[11.5px] font-extrabold text-[var(--color-ink-soft)]">{i === 0 ? t('Première couleur') : t('Deuxième couleur')}</div>
              <div className="flex flex-wrap gap-1.5">
                {CREST_COLORS.map((col) => (
                  <button
                    key={col}
                    aria-label={col}
                    className={`h-8 w-8 rounded-xl border-2 transition active:scale-90 ${c.colors[i] === col ? 'scale-110 border-[#8a4b00] shadow-md' : 'border-black/10'}`}
                    style={{ background: col }}
                    onClick={() => set({ colors: (i === 0 ? [col, c.colors[1]] : [c.colors[0], col]) as [string, string] })}
                    data-crest-color={`${i}:${col}`}
                  />
                ))}
              </div>
            </div>
          ))}
          <div>
            <div className="mb-1 text-[11.5px] font-extrabold text-[var(--color-ink-soft)]">{t('L’emblème')}</div>
            <div className="grid grid-cols-4 gap-1.5">
              {CREST_EMBLEMS.map((em) => (
                <button key={em} className={`flex flex-col items-center rounded-2xl p-1 text-[11px] font-extrabold ${c.emblem === em ? 'bg-[#fff4e0] ring-2 ring-[#e8890c]' : 'bg-black/[0.035]'}`} onClick={() => set({ emblem: em })} data-crest-emblem={em}>
                  <span className="h-11 w-10">
                    <CrestPicture crest={{ ...c, emblem: em }} />
                  </span>
                  {emblemLabel(em)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-[11.5px] font-extrabold text-[var(--color-ink-soft)]">
              <span>{t('La devise')}</span>
              <span>
                {c.devise.length}/{DEVISE_MAX}
              </span>
            </div>
            <input className="w-full rounded-2xl border-2 border-black/10 bg-white px-3 py-2 text-[15px] font-bold outline-none focus:border-[#e8890c]" value={c.devise} maxLength={DEVISE_MAX} placeholder={t('Ex. : Le travail paie')} onChange={(e) => setC((o) => ({ ...o, devise: e.target.value }))} data-crest-devise />
          </div>
          <button className="btn w-full" disabled={busy} onClick={save} data-crest-save>
            <Crown size={17} /> {t('Graver le blason')}
          </button>
          <p className="text-[11.5px] leading-snug font-bold text-[var(--color-ink-soft)]">{t('Une fois gravé, il reste jusqu’à la prochaine génération. La devise passe la modération du chat.')}</p>
        </div>
      )}
    </div>
  )
}

function Heirlooms({ list }: { list: Heirloom[] }) {
  return (
    <div className="rounded-[20px] bg-white p-3 shadow-sm" data-heirlooms>
      <div className="label mb-1.5">{t('Les objets de famille')}</div>
      {!list.length && <p className="text-[12.5px] leading-snug font-bold text-[var(--color-ink-soft)]">{t('Quand tu passeras la main, choisis un objet à transmettre : un meuble de la maison, un vêtement, un bijou ou un véhicule. Il ne se vendra plus, et chaque génération ajoute à sa renommée.')}</p>}
      <ul className="space-y-1.5">
        {list.map((h) => {
          const Icon = LOOM_ICONS[h.kind]
          return (
            <li key={`${h.kind}:${h.item}`} className="rounded-2xl bg-gradient-to-br from-[#fff7e6] to-[#ffe8b8] p-2.5" data-heirloom-item>
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#8a4b00] text-[#ffd36e] shadow-[0_0_12px_rgba(255,190,60,0.7)]">
                  <Icon size={20} />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[14px] font-extrabold">{h.label}</span>
                  <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-[#8a4b00] px-2 py-0.5 text-[10.5px] font-extrabold text-[#ffd36e]">
                    <Crown size={10} /> {heirloomBadge(h.gens)}
                  </span>
                </span>
              </div>
              {h.lines.map((l, i) => (
                <p key={i} className="mt-1 pl-1 text-[12px] font-bold text-[#8a4b00] italic">
                  ✦ {l}
                </p>
              ))}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function FeteCard({ st }: { st: HeritageState }) {
  const f = st.fete!
  const from = new Date(f.from)
  const day = from.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  return (
    <div className="overflow-hidden rounded-[20px] text-white shadow-sm" style={{ background: 'linear-gradient(150deg,#3b1f6b 0%,#7048e8 60%,#c98a00 130%)' }} data-fete>
      <div className="p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider uppercase opacity-90">
          <CalendarClock size={13} /> {f.live ? t('En ce moment') : t('Chaque dimanche soir')}
        </div>
        <div className="mt-0.5 font-display text-[18px] font-extrabold">{t('La Fête des grandes familles')}</div>
        <p className="mt-0.5 text-[12.5px] leading-snug font-bold opacity-95">{f.live ? t('Au Palais de la Culture de Treichville, jusqu’à {h} h. Viens montrer ta famille !', { h: new Date(f.until).getUTCHours() }) : t('{day}, {h} h, au Palais de la Culture de Treichville.', { day, h: from.getUTCHours() })}</p>
        <p className="mt-1 text-[12px] font-extrabold text-[#ffd36e]">{f.came ? t('Ta famille était là cette semaine : +{n} de renommée.', { n: f.renom }) : t('Venir : +{n} de renommée (une fois par semaine) et la bonne humeur.', { n: f.renom })}</p>
        <button className="mt-2 w-full rounded-2xl bg-white/95 py-2 text-[13.5px] font-extrabold text-[#3b1f6b] active:scale-[0.98]" onClick={() => (haptic('light'), openRendezVous())} data-fete-go>
          {f.live ? t('Y aller') : t('Voir les rendez-vous')}
        </button>
      </div>
      {!!f.week.length && (
        <div className="space-y-1 bg-black/20 p-2.5">
          <div className="text-[11px] font-extrabold tracking-wider uppercase opacity-90">{t('Les familles de la semaine')}</div>
          {f.week.map((x, i) => (
            <div key={x.sim} className="flex items-center gap-2 text-[13px] font-extrabold">
              <span className="w-4 text-center">{i + 1}</span>
              <span className="h-8 w-7 shrink-0">{x.crest ? <CrestPicture crest={x.crest} /> : <Crown size={18} className="mt-1.5 text-[#ffd36e]" />}</span>
              <span className="min-w-0 flex-1 truncate">{t('Famille {name}', { name: x.lastName })}</span>
              <span className="text-[#ffd36e]">+{x.gained}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
