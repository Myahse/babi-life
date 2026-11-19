import { useEffect, useState } from 'react'
import { Baby, Banknote, Briefcase, Check, Crown, Handshake, HeartHandshake, House, Lightbulb, Lock, MapPin, PiggyBank, Sparkles, Trophy, Users, type LucideIcon } from 'lucide-react'
import { api, errorText } from '../lib/api'
import type { ActionResult, FamilyRank, HeirOption, HeritageState, Look, Sim } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'
import { elderLook, famOf, kidLook, stageLabel } from '../game/famille'
import { generationLabel, heirKindLabel, heirLook, jalonHint, jalonLabel, playedLabel, tierLabel } from '../game/heritage'
import { sfx } from '../lib/sfx'
import { haptic } from '../lib/native'
import { reactToResult } from '../avatar/expressions'
import { locale, t } from '../lib/i18n'

// « Ma famille » (the update « heritage », backend sims/heritage.go): the lineage played generation after
// generation. Four tabs: the tree (the generations handed down, the Sim, its children and the baby on its
// way), the jalons (the age in hours played, the five goals, who would take over and what would come down,
// « Passer la main »), the elders (advice, the weekly blessing from their pot, a visit), the great families
// (the ten of the highest renom, and one's own place). The ceremony itself is components/heritage/Passation.

type Tab = 'jalons' | 'arbre' | 'anciens' | 'familles'
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
  useEffect(() => void load(), [sim.id, gen]) // eslint-disable-line react-hooks/exhaustive-deps
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
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[11px] font-extrabold tracking-wider uppercase opacity-90">{generationLabel(st.generation)}</div>
          <div className="truncate font-display text-[21px] font-extrabold">{t('Famille {name}', { name: sim.lastName })}</div>
          <div className="flex items-center gap-1 text-[13px] font-bold">
            <Crown size={13} /> {t('Renommée {n}', { n: st.renom })}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-black/[0.05] p-1" role="tablist">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={`rounded-xl px-1 py-2 text-[12px] leading-tight font-extrabold transition ${tab === id ? 'bg-white shadow-sm' : 'text-[var(--color-ink-soft)]'}`}
            onClick={() => (haptic('light'), setTab(id), setSaid(null))}
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
      {tab === 'anciens' && <Anciens sim={sim} st={st} busy={busy} call={call} />}
      {tab === 'familles' && <Familles sim={sim} />}
    </div>
  )
}

type Call = (f: () => Promise<ActionResult>, after?: (r: ActionResult) => void) => Promise<ActionResult | null>

function Jalons({ sim, st, busy, call }: { sim: Sim; st: HeritageState; busy: boolean; call: Call }) {
  const [heir, setHeir] = useState<HeirOption>(st.heirs[0])
  const [ask, setAsk] = useState(false)
  useEffect(() => setHeir((h) => st.heirs.find((x) => x.id === h?.id) ?? st.heirs[0]), [st])
  const p = st.played
  const span = p.normal || 1
  const pct = Math.min(100, (100 * p.lived) / span)
  const early = (100 * p.early) / span
  const floor = new Date(st.floorAt)
  const waiting = floor.getTime() > Date.now()
  const f = (n: number) => `${n.toLocaleString(locale())} F`
  const pass = () =>
    void call(
      () => api.passation(sim.id, { heir: heir.id, look: heirLook(heir, sim.look), gen: st.generation }),
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
                  {heirKindLabel(h.kind, h.gender)} · {t('{n} ans', { n: h.years })} · {t('{n} % de l’héritage', { n: h.share })}
                </span>
              </span>
            </button>
          ))}
        </div>
        {heir?.kind === 'neveu' && <p className="mt-1.5 text-[12px] leading-snug font-bold text-[var(--color-ink-soft)]">{t('Pas d’enfant de 18 ans : un neveu ou une nièce porte le nom. Pour un enfant à toi, en couple à la maison ou à l’orphelinat (dès 25 ans).')}</p>}
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
          <Face look={kidLook(k, sim.look)} gender={k.gender} stage={k.stage} name={k.name} line={`${k.adopted ? t('Adopté·e') + ' · ' : ''}${stageLabel(k.stage)} · ${t('{n} ans', { n: k.years ?? 0 })}`} />
        </div>
      ))}
      {f?.expecting && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-[#ffe9f1] p-2 pl-8">
          <Baby size={20} className="text-[#e0245e]" />
          <span className="text-[13px] font-extrabold">{f.expecting.adopt ? t('Un enfant arrive de l’orphelinat') : f.expecting.mother ? t('Un bébé en route') : t('Une adoption en cours')}</span>
        </div>
      )}
      {!f?.kids?.length && !f?.expecting && <p className="px-1 py-1 text-[12.5px] leading-snug font-bold text-[var(--color-ink-soft)]">{t('Pas encore d’enfant. En couple à la maison : « Essayer d’avoir un bébé ». Ou adopte à l’orphelinat, dès 25 ans (dossier 50 000 F).')}</p>}
      {canBaby && (
        <button className="btn btn-soft mt-1 w-full" disabled={busy} onClick={tryBaby}>
          <Baby size={18} /> {t("Essayer d'avoir un bébé")}
        </button>
      )}
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
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[14px] font-extrabold">{t('Famille {name}', { name: r.lastName })}</span>
        <span className="block text-[12px] font-bold text-[var(--color-ink-soft)]">
          {generationLabel(r.generation)} · {r.name}
        </span>
      </span>
      <span className="flex items-center gap-1 text-[14px] font-extrabold" style={{ color: GOLD[1] }}>
        <Crown size={14} /> {r.renom}
      </span>
    </div>
  )
}
