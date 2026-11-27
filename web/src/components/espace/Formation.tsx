import { useState } from 'react'
import { Award, Check, ChevronDown, ChevronUp, Rocket } from 'lucide-react'
import { api } from '../../lib/api'
import type { Interaction, PlaceKind, Sim } from '../../lib/types'
import type { Act } from '../../screens/phoneApps'
import { iconFor } from '../icons'
import { ENTRAINEMENT_KIND, ESPACE_CAREERS, SIEGE_KIND } from '../../lib/espace'
import { INDOOR, SCENES } from '../../world3d/Interior'
import { t as tr, tx } from '../../lib/i18n'

// La formation d'Astrélia (backend game/espaceCarriere.go, sims/espaceFormation.go): at the Centre d'entraînement
// of Sassandra, the way to the brevet in one card: the concours written, the five selection drills, the contract
// signed, the stay's three modules, the brevet; the tourists' « formation express ». Each drill is played
// (components/espace/jeux); under 50 it doesn't count. The place's menu shows only what's the Sim's to do now
// (formationShows).

// The centre is a scene of its own (world3d/espace/CentreEntrainement.tsx); the siège at the Plateau, an office inside.
SCENES.add(ENTRAINEMENT_KIND)
INDOOR.add(SIEGE_KIND)

/** The centre's place (backend game.EntrainementID). */
export const CENTRE_ID = 'sassandra-entrainement'
const ECRIT = 'astrelia-concours-ecrit'
const SELECTION = ['selection-physique', 'selection-centrifugeuse', 'selection-piscine', 'selection-survie', 'selection-medicale']
/** The stay's modules (backend game.FormationModules). */
const MODULES = (): { name: string; steps: string[] }[] => [
  { name: tr('Les bases'), steps: ['module-systemes', 'module-centrifugeuse', 'module-piscine'] },
  { name: tr('L’apesanteur'), steps: ['module-parabolique', 'module-piscine', 'module-physique'] },
  { name: tr('Le retour sur Terre'), steps: ['module-centrifugeuse', 'module-survie', 'module-systemes'] },
]
const TOURIST = ['touriste-centrifugeuse', 'touriste-survie']
const LIFE = ['entrainement-cantine', 'entrainement-douche', 'entrainement-chambre']
/** The careers that fly free (backend game.Missions). */
const FLY = ['astronaute', 'tourisme-spatial']
const PASS = 50

/** The actions a Sim may see at the centre (or the pad's express training): only what's its to do now. */
export function formationShows(id: string, sim: Sim): boolean {
  const e = sim.life?.espace
  const f = e?.formation
  const done = !!f?.selected || !!f?.brevet
  if (id === ECRIT) return !done && (f?.ecrit ?? 0) < PASS
  if (SELECTION.includes(id)) return !done && (f?.ecrit ?? 0) >= PASS && (f?.drills?.[id] ?? 0) < PASS
  if (id.startsWith('module-')) {
    const st = f?.stay
    if (!st || sim.career !== 'astronaute') return false
    const m = MODULES()[Math.min(st.module, 2)]
    return m.steps.includes(id) && !st.done.includes(id)
  }
  if (TOURIST.includes(id)) return !e?.training && !f?.brevet && (!!e?.ticket || FLY.includes(sim.career ?? '')) && !f?.tourist?.includes(id)
  if (LIFE.includes(id)) return ESPACE_CAREERS.includes(sim.career ?? '') || !!f?.stay
  return true
}

/** « Sélection : la centrifugeuse » → « La centrifugeuse » (the card says which part it's in). */
const short = (label: string) => {
  const l = label.replace(/^(Sélection|Formation express|Formation|Selection|Express training|Training) ?: /, '')
  return l.charAt(0).toUpperCase() + l.slice(1)
}

function Step({ it, ok, onClick, sub }: { it?: Interaction; ok: boolean; onClick?: () => void; sub?: string }) {
  if (!it) return null
  const Icon = iconFor(it.icon)
  return (
    <button disabled={ok || !onClick} data-formation-step={it.id} className={`flex items-center gap-2 rounded-2xl px-2.5 py-2 text-left text-[12.5px] leading-tight font-extrabold active:scale-95 ${ok ? 'bg-[#d3f9d8]' : onClick ? 'bg-[#e7f1ff] ring-2 ring-[#74a9e8]' : 'bg-black/[0.04] opacity-60'}`} onClick={onClick}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${ok ? 'bg-[var(--color-emerald)] text-white' : 'bg-white'}`}>{ok ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}</span>
      <span className="min-w-0">
        {short(it.label)}
        <span className="block text-[10.5px] font-bold text-[var(--color-ink-soft)]">{ok ? tr('Validé !') : (sub ?? tr('À jouer'))}</span>
      </span>
    </button>
  )
}

/** The centre's card: where the Sim is on the way to the brevet, each drill a tap away. */
export function FormationPanel({ sim, kinds, run, onSign }: { sim: Sim; kinds: Record<string, PlaceKind>; run: Act; /** Hired as a candidate (the Boulot app's call). */ onSign?: () => void }) {
  // Folded at first (the place's « Que faire ? » lists the same drills): the chip says where the Sim is.
  const [folded, setFolded] = useState(true)
  const e = sim.life?.espace
  const f = e?.formation
  const its = kinds[ENTRAINEMENT_KIND]?.interactions ?? []
  const it = (id: string) => its.find((x) => x.id === id)
  const play = (id: string) => {
    const x = it(id)
    if (x) void run(x.label, x.icon, ENTRAINEMENT_KIND, () => api.interact(sim.id, CENTRE_ID, x.id))
  }
  const busy = !!sim.activity
  const ecrit = (f?.ecrit ?? 0) >= PASS
  const passed = SELECTION.filter((id) => (f?.drills?.[id] ?? 0) >= PASS).length
  const st = f?.stay
  const astro = sim.career === 'astronaute'
  // Where it's at, one line on the chip.
  const where = f?.brevet
    ? tr('Brevet d’astronaute')
    : st && astro
      ? tx('Formation · module {0}/{1}', { 0: Math.min(st.module + 1, st.modules), 1: st.modules })
      : f?.selected
        ? tr('Sélectionné·e : signe !')
        : ecrit
          ? tx('Sélection · {0}/{1}', { 0: passed, 1: SELECTION.length })
          : e?.training
            ? tr('Formation express faite')
            : tr('Concours Astrélia')
  const progress = f?.brevet ? 1 : st && astro ? (st.module * 3 + st.done.length) / (st.modules * 3) : ((ecrit ? 1 : 0) + passed) / (SELECTION.length + 1)
  const sign = () =>
    void run(tr('Signer avec Astrélia'), 'rocket', ENTRAINEMENT_KIND, () => api.career(sim.id, 'astronaute')).then((ok) => ok && onSign?.())
  return (
    <div className={`pointer-events-none absolute inset-x-0 top-[max(4.75rem,calc(var(--sat,env(safe-area-inset-top))+4.25rem))] ${folded ? 'z-20' : 'z-40'} flex flex-col items-start gap-2 px-3`} data-formation>
      <button className="hud pointer-events-auto flex items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 text-[13px] font-extrabold" onClick={() => setFolded((x) => !x)} data-formation-chip>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#1c3d6e] text-white">{f?.brevet ? <Award size={15} strokeWidth={2.6} /> : <Rocket size={15} strokeWidth={2.6} />}</span>
        {where}
        <span className="h-1.5 w-12 overflow-hidden rounded-full bg-black/10">
          <span className="block h-full rounded-full bg-[#ff7a00] transition-[width] duration-500" style={{ width: `${progress * 100}%` }} />
        </span>
        {folded ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
      </button>
      {!folded && !busy && (
        <div className="sheet animate-up pointer-events-auto w-full max-w-[440px] rounded-[24px] p-3.5">
          <div className="text-[11px] font-extrabold tracking-wider text-[var(--color-ink-soft)] uppercase">{tr('Centre d’entraînement Astrélia')}</div>
          {f?.brevet ? (
            <>
              <div className="font-display text-[19px] leading-tight font-extrabold">{tr('Brevet d’astronaute Astrélia')}</div>
              <p className="text-[12.5px] font-bold text-[var(--color-ink-soft)]">
                {astro ? tx('Tes missions sont gratuites : la station dès Astronaute, la Lune dès Astronaute confirmé·e, Mars dès Commandant·e de bord. Missions accomplies : {0}.', { 0: f.missionsDone ?? 0 }) : tr('Ton brevet est dans l’appli Papiers. Signe comme astronaute dans l’appli Boulot pour voler en mission.')}
              </p>
              {!astro && (
                <button className="btn mt-2 w-full !py-2.5 text-[14px]" onClick={sign}>
                  {tr('Signer avec Astrélia')}
                </button>
              )}
            </>
          ) : st && astro ? (
            (() => {
              const m = MODULES()[Math.min(st.module, 2)]
              return (
                <>
                  <div className="font-display text-[19px] leading-tight font-extrabold">{tx('Module {0} sur {1} : « {2} »', { 0: st.module + 1, 1: st.modules, 2: m.name })}</div>
                  <p className="text-[12.5px] font-bold text-[var(--color-ink-soft)]">{tr('Chaque exercice se joue : 50 au moins pour qu’il compte. Les trois modules faits, le brevet.')}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {m.steps.map((id) => (
                      <Step key={id} it={it(id)} ok={st.done.includes(id)} onClick={() => play(id)} />
                    ))}
                  </div>
                </>
              )
            })()
          ) : f?.selected ? (
            <>
              <div className="font-display text-[19px] leading-tight font-extrabold">{tr('Sélectionné·e par Astrélia !')}</div>
              <p className="text-[12.5px] font-bold text-[var(--color-ink-soft)]">{tr('Signe ton contrat d’astronaute candidat·e : la formation (trois modules) commence aussitôt, ici au centre.')}</p>
              <button className="btn mt-2 w-full !py-2.5 text-[14px]" onClick={sign} data-formation-sign>
                {tr('Signer avec Astrélia')}
              </button>
            </>
          ) : (
            <>
              <div className="font-display text-[19px] leading-tight font-extrabold">{tr('Devenir astronaute')}</div>
              <p className="text-[12.5px] font-bold text-[var(--color-ink-soft)]">{tr('Le concours (bac C ou D), puis cinq épreuves de sélection. Chacune se joue : 50 au moins pour qu’elle compte.')}</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <Step it={it(ECRIT)} ok={ecrit} onClick={() => play(ECRIT)} sub={f?.ecrit ? tr('Meilleure note : {0}/100', { 0: f.ecrit }) : undefined} />
                {SELECTION.map((id) => (
                  <Step key={id} it={it(id)} ok={(f?.drills?.[id] ?? 0) >= PASS} onClick={ecrit ? () => play(id) : undefined} sub={ecrit ? undefined : tr('Après l’écrit')} />
                ))}
              </div>
            </>
          )}
          {/* The tourists' express training: with a ticket, two drills */}
          {!f?.brevet && (e?.ticket || FLY.includes(sim.career ?? '')) && (
            <div className="mt-3 border-t border-black/5 pt-2.5">
              <div className="text-[12.5px] font-extrabold">{e?.training ? tr('Formation express faite : bon vol !') : tr('Formation express des voyageurs (comprise dans le billet)')}</div>
              {!e?.training && (
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {TOURIST.map((id) => (
                    <Step key={id} it={it(id)} ok={!!f?.tourist?.includes(id)} onClick={() => play(id)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
