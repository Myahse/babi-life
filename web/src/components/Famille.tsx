import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Baby, Cake, DoorOpen, Flower2, HeartHandshake, House, UserPlus, Users, X } from 'lucide-react'
import type { ActionResult, FamKid, Famille as Fam, Friend, Look, Sim } from '../lib/types'
import { api } from '../lib/api'
import { sfx } from '../lib/sfx'
import { haptic } from '../lib/native'
import { sceneDpr } from '../lib/device'
import { reactToResult, setExpression } from '../avatar/expressions'
import { randomLook } from '../avatar/options'
import type { Pose } from '../avatar/Human'
import { Character } from '../world3d/Character'
import { Box } from '../world3d/props'
import { Balloons } from '../world3d/interior/doings'
import { rng } from '../world3d/themes'
import { hostedNow } from '../world3d/FamilyHome'
import { Confetti } from './GrowUpParty'
import { Sheet } from './Sheet'
import { IconTile } from './ui'
import { Portrait } from '../avatar/portrait'
import { setLifeExtras, type PieOption } from '../game/lifeMode'
import { bellyOf, elderLook, famOf, heirsOf, isSenior, kidLook, stageLabel, visitorLook } from '../game/famille'
import { clock } from '../game/rules'
import { t as tr } from '../lib/i18n'

// Le mode vie's generations and visitors on screen (the update « mode-vie », backend sims/famille.go decides it
// all; the house's people in 3D are world3d/FamilyHome.tsx). Here: the wheel's new choices (the Sim tapped:
// « Inviter à la maison », « Ma famille »; the partner: « Essayer d'avoir un bébé », fade to black; a child or
// an elder: a hug, a game; the visitor: serve food or drinks, show the house, dames, see them off), the knock at
// the door and « Ouvrir la porte », the family's sheet (ages, the baby on its way, « vieillesse douce »,
// « Passer à la génération suivante »), and the big moments as little 3D scenes at home: a birthday's cake
// and candles, the newborn welcomed (and named), the farewell of someone gone, the house handed down.

const SOCIAL: [string, string] = ['#ff8fb1', '#e0245e']
const HOST: [string, string] = ['#ffd27a', '#e08a00']
const FAMILY: [string, string] = ['#9ad7ff', '#2b7bd6']

type Scene = { kind: 'party'; who: string; name: string; stage: string; years: number; at: number } | { kind: 'arrival'; kid: FamKid } | { kind: 'farewell'; f: NonNullable<Fam['farewell']> }

export function FamilleVie({ sim, home, onResult }: { sim: Sim; /** In one's own house seen in 3D, le mode vie on (Play's lifeHere). */ home: boolean; onResult: (res: ActionResult) => void }) {
  const f = famOf(sim)
  const [sheet, setSheet] = useState<null | 'famille' | 'inviter'>(null)
  const [fade, setFade] = useState<null | { text?: string }>(null)
  const [say, setSay] = useState<string | null>(null)
  const [scene, setScene] = useState<Scene | null>(null)
  const [later, setLater] = useState(false)
  const [busy, setBusy] = useState(false)
  const latest = useRef({ sim, f })
  latest.current = { sim, f }

  const call = async (action: string, body: Parameters<typeof api.famille>[2] = {}) => {
    setBusy(true)
    try {
      const res = await api.famille(latest.current.sim.id, action, body)
      onResult(res)
      if (res.outcome?.text) setSay(res.outcome.text)
      return res
    } catch (e) {
      haptic('error')
      setSay(e instanceof Error ? e.message : tr('Pas maintenant'))
      return null
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    if (!say) return
    const k = setTimeout(() => setSay(null), 4200)
    return () => clearTimeout(k)
  }, [say])

  // Trying for a baby: the lights go down, nothing is shown; the news after.
  const tryBaby = () => {
    setFade({})
    sfx.pop()
    void call('bebe').then((res) => {
      setTimeout(() => {
        setFade({ text: res?.outcome?.text })
        if (res && latest.current.sim.life?.famille?.expecting) reactToResult('me', 'bigwin')
      }, 2200)
      setTimeout(() => setFade(null), 5200)
    })
  }

  // The wheel's new choices (game/lifeMode.ts setLifeExtras): read when a wheel opens, from the latest Sim.
  useEffect(() => {
    setLifeExtras({
      self: () => {
        const { sim, f } = latest.current
        const opts: PieOption[] = []
        if (sim.housing) opts.push(run('inviter', tr('Inviter à la maison'), 'door-open', FAMILY, () => setSheet('inviter')))
        if (f) opts.push(run('famille', tr('Ma famille'), 'users', FAMILY, () => setSheet('famille')))
        return opts
      },
      person: (npc) => {
        const { sim, f } = latest.current
        const partner = sim.friends?.find((x) => x.partner && x.home)
        if (partner && npc.id === partner.id.replace(/^p-/, '') && f && f.stage !== 'senior' && !f.expecting) return { options: [run('bebe', tr("Essayer d'avoir un bébé"), 'baby', SOCIAL, tryBaby)] }
        if (npc.id.startsWith('kid:')) {
          const k = f?.kids?.find((x) => `kid:${x.id}` === npc.id)
          if (!k) return null
          const opts = [run('calin', k.stage === 'bebe' ? tr('Bercer') : k.stage === 'enfant' ? tr('Jouer avec') : tr('Discuter'), k.stage === 'bebe' ? 'baby' : k.stage === 'enfant' ? 'volleyball' : 'messages-square', SOCIAL, () => void call('calin', { who: k.id }).then((r) => r && setExpression(npc.id, 'laugh', 3000)))]
          if (k.stage !== 'ado' && k.stage !== 'adulte') opts.push(run('calin2', tr('Faire un câlin'), 'heart', SOCIAL, () => void call('calin', { who: k.id })))
          if (k.stage === 'adulte') opts.push(run('relais', tr('Lui passer la main'), 'house', FAMILY, () => setSheet('famille')))
          return { only: true, title: `${k.name} · ${stageLabel(k.stage)} · ${tr('{n} ans', { n: k.years ?? 0 })}`, options: opts }
        }
        if (npc.id.startsWith('elder:')) {
          const e = f?.elders?.find((x) => `elder:${x.id}` === npc.id)
          if (!e) return null
          return { only: true, title: `${e.name} · ${tr('{n} ans', { n: e.years ?? 0 })}`, options: [run('histoires', tr('Écouter ses histoires'), 'book-open', SOCIAL, () => void call('calin', { who: e.id })), run('calin', tr('Faire un câlin'), 'heart', SOCIAL, () => void call('calin', { who: e.id }))] }
        }
        const v = f?.visit
        if (v && v.state === 'dedans' && npc.id === v.who.replace(/^p-/, '')) {
          const opts = HOSTS.filter((h) => !v.done?.includes(h.id)).map((h) => run(h.id, h.label, h.icon, HOST, () => void call('accueil', { act: h.id }).then((r) => r && (hostedNow(h.id), setExpression(npc.id, 'laugh', 3500), sfx.coins(1)))))
          opts.push(run('raccompagner', tr('Raccompagner'), 'door-open', FAMILY, () => void call('raccompagner')))
          return { options: opts, title: `${v.name} · ${tr('en visite')}` }
        }
        return null
      },
    })
    return () => setLifeExtras({})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // The knock at the door (or the bell, for the one invited), again now and then while they wait.
  const v = f?.visit
  const knockKey = v?.state === 'porte' && home ? `${v.who}:${v.at}` : ''
  useEffect(() => {
    if (!knockKey) return
    const invited = latest.current.f?.visit?.kind === 'invite'
    const ring = () => (invited ? sfx.doorbell() : sfx.knock(), haptic('medium'))
    ring()
    let n = 0
    const k = setInterval(() => (++n < 4 ? ring() : clearInterval(k)), 7000)
    return () => clearInterval(k)
  }, [knockKey])

  // The big moments, shown when at home (a passing, the house handed down: wherever the Sim is).
  // (A scene seen isn't shown again while the server's answer is on its way.)
  const seen = useRef(new Set<string>())
  useEffect(() => {
    if (scene || !f) return
    if (f.farewell && !seen.current.has(`f${f.farewell.at}`)) setScene({ kind: 'farewell', f: f.farewell })
    else if (!home) return
    else if (f.arrival) {
      const kid = f.kids?.find((k) => k.id === f.arrival)
      if (kid && !seen.current.has(`a${kid.id}`)) setScene({ kind: 'arrival', kid })
    } else if (f.party && !seen.current.has(`p${f.party.at}`)) setScene({ kind: 'party', ...f.party })
  }, [f?.farewell?.at, f?.arrival, f?.party?.at, home, scene]) // eslint-disable-line react-hooks/exhaustive-deps

  const heir = heirsOf(f).sort((a, b) => a.born - b.born)[0]
  return (
    <>
      {/* At the door */}
      {v?.state === 'porte' && home && !scene && (
        <div className="pointer-events-none absolute inset-x-3 top-[max(9.5rem,calc(var(--sat,env(safe-area-inset-top))+9rem))] z-40 mx-auto max-w-sm">
          <div className="card animate-up pointer-events-auto flex items-center gap-3 p-3">
            <span className="animate-knock grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#ffe2b0] text-[#a35a00]">
              <DoorOpen size={22} strokeWidth={2.6} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-tight font-extrabold">{v.kind === 'invite' ? tr('Ding-dong ! {name} est là', { name: v.name }) : tr('Toc toc ! {name} est à la porte', { name: v.name })}</p>
              <p className="text-[12px] font-bold text-[var(--color-ink-soft)]">{v.kind === 'invite' ? tr('Ton invité·e arrive') : tr('Une visite surprise')}</p>
            </div>
          </div>
          <div className="pointer-events-auto mt-2 flex gap-2">
            <button className="btn flex-1 !py-2.5" disabled={busy} onClick={() => (haptic('medium'), sfx.pop(), void call('ouvrir').then((r) => r && reactToResult('me', 'won')))}>
              <DoorOpen size={18} /> {tr('Ouvrir la porte')}
            </button>
            <button className="btn btn-soft !py-2.5" disabled={busy} onClick={() => void call('refuser')}>
              {tr('Pas maintenant')}
            </button>
          </div>
        </div>
      )}
      {/* The visitor in: who, and till when */}
      {v?.state === 'dedans' && home && !scene && (
        <div className="pointer-events-none absolute left-1/2 top-[max(12.5rem,calc(var(--sat,env(safe-area-inset-top))+12rem))] z-30 -translate-x-1/2">
          <span className="hud rounded-full px-3 py-1 text-[12px] font-extrabold whitespace-nowrap">{tr('{name} est en visite · repart vers {h}', { name: v.name, h: clockLabel(v.until ?? 0) })}</span>
        </div>
      )}
      {/* The senior's last days: when the player is ready, the farewell, and the child takes over */}
      {f?.last && home && !later && !scene && heir && (
        <div className="pointer-events-none absolute inset-x-3 top-[max(9.5rem,calc(var(--sat,env(safe-area-inset-top))+9rem))] z-40 mx-auto max-w-sm">
          <div className="card animate-up pointer-events-auto p-3">
            <p className="text-[15px] leading-snug font-extrabold">{tr('{name} a vécu une longue et belle vie.', { name: sim.firstName })}</p>
            <p className="mt-1 text-[13px] leading-snug font-bold text-[var(--color-ink-soft)]">{tr('Quand tu es prêt·e : toute la famille se réunit pour lui dire au revoir, et {heir} reprend la maison.', { heir: heir.name })}</p>
            <div className="mt-2.5 flex gap-2">
              <button className="btn flex-1 !py-2.5" disabled={busy} onClick={() => void call('adieu', { kid: heir.id, look: kidLook(heir, sim.look) })}>
                <Flower2 size={18} /> {tr('Dire au revoir')}
              </button>
              <button className="btn btn-soft !py-2.5" onClick={() => setLater(true)}>
                {tr('Pas encore')}
              </button>
            </div>
          </div>
        </div>
      )}
      {say && (
        <div className="pointer-events-none absolute inset-x-3 bottom-[calc(max(0.75rem,var(--sab,env(safe-area-inset-bottom)))+6rem+var(--hud-lift,0px))] z-[46] mx-auto max-w-sm text-center">
          <span className="animate-pop inline-block rounded-2xl bg-black/75 px-3.5 py-2 text-[13px] font-extrabold text-white">{say}</span>
        </div>
      )}
      {fade && (
        <div className="pointer-events-none fixed inset-0 z-[85] grid place-items-center bg-[#05060f] animate-fade">
          <div className="px-8 text-center text-white/90">
            <div className="text-5xl">{fade.text ? '💞' : '🌙'}</div>
            <p className="mt-3 font-display text-xl font-extrabold">{fade.text ?? tr('Un moment rien qu’à deux…')}</p>
          </div>
        </div>
      )}
      {sheet === 'famille' && f && <FamilySheet sim={sim} f={f} busy={busy} onClose={() => setSheet(null)} call={call} />}
      {sheet === 'inviter' && <InviteSheet sim={sim} busy={busy} onClose={() => setSheet(null)} onInvite={(who) => void call('inviter', { who }).then((r) => r && setSheet(null))} />}
      {scene && <MomentScene sim={sim} scene={scene} call={call} onEnd={() => (seen.current.add(scene.kind === 'farewell' ? `f${scene.f.at}` : scene.kind === 'party' ? `p${scene.at}` : `a${scene.kid.id}`), setScene(null))} />}
    </>
  )
}

/** The hosting acts (backend game/famille.go HostActs). */
const HOSTS = [
  { id: 'manger', label: tr('Servir à manger'), icon: 'utensils' },
  { id: 'boire', label: tr('Servir à boire'), icon: 'cup-soda' },
  { id: 'visite', label: tr('Faire visiter la maison'), icon: 'house' },
  { id: 'dames', label: tr('Jouer aux dames'), icon: 'grid-3x3' },
]

const run = (id: string, label: string, icon: string, colors: [string, string], go: () => void): PieOption => ({ id, label, icon, colors, run: go, order: { kind: 'act', id, label, icon, colors } })

const clockLabel = (m: number) => {
  const { hour } = clock(m)
  const minute = ((m % 60) + 60) % 60
  return minute ? `${hour} h ${String(minute).padStart(2, '0')}` : `${hour} h`
}

/** The family: who's who and their ages, the baby on its way, « vieillesse douce », the house handed down. */
function FamilySheet({ sim, f, busy, onClose, call }: { sim: Sim; f: Fam; busy: boolean; onClose: () => void; call: (a: string, b?: Parameters<typeof api.famille>[2]) => Promise<ActionResult | null> }) {
  const [ask, setAsk] = useState<FamKid | null>(null)
  const e = f.expecting
  const left = e ? Math.max(0, e.due - sim.gameMinutes) : 0
  const row = (key: string, look: Look, gender: 'femme' | 'homme', stage: string, name: string, line: string, extra?: React.ReactNode) => (
    <div key={key} className="flex items-center gap-2.5 rounded-2xl bg-black/[0.035] p-2">
      <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-white bg-gradient-to-b from-[#e3f1ff] to-[#9cc7ff]">
        <MiniPortrait look={look} gender={gender} stage={stage} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-extrabold">{name}</p>
        <p className="text-[12px] font-bold text-[var(--color-ink-soft)]">{line}</p>
      </div>
      {extra}
    </div>
  )
  return (
    <Sheet onClose={onClose} className="max-w-md p-4" z="z-50">
      {(close) => (
        <>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-lg font-extrabold">{tr('Famille {name}', { name: sim.lastName })}</h2>
            <button className="grid h-9 w-9 place-items-center rounded-full bg-black/5 active:scale-90" onClick={close} aria-label={tr('Fermer')}>
              <X size={18} strokeWidth={2.8} />
            </button>
          </div>
          <div className="max-h-[56vh] space-y-1.5 overflow-y-auto overscroll-contain">
            {row('me', sim.look, sim.gender, 'adulte', sim.firstName, `${stageLabel(f.stage)} · ${tr('{n} ans', { n: f.years ?? 18 })}${f.generation ? ` · ${tr('{n}e génération', { n: (f.generation ?? 0) + 1 })}` : ''}`)}
            {e && (
              <div className="flex items-center gap-2.5 rounded-2xl bg-[#ffe9f1] p-2">
                <IconTile icon={Baby} colors={SOCIAL} size={40} radius={20} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-extrabold">{e.mother ? tr('Un bébé en route') : tr('Une adoption en cours')}</p>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-[#e0245e]" style={{ width: `${Math.round(100 * (1 - left / Math.max(1, e.due - e.since)))}%` }} />
                  </div>
                  <p className="mt-0.5 text-[12px] font-bold text-[var(--color-ink-soft)]">{left > 24 * 60 ? tr('Il arrive dans {n} jours', { n: Math.ceil(left / 1440) }) : tr('Il arrive dans {n} h', { n: Math.max(1, Math.ceil(left / 60)) })}</p>
                </div>
              </div>
            )}
            {(f.kids ?? []).map((k) =>
              row(k.id, kidLook(k, sim.look), k.gender, k.stage ?? 'bebe', k.name, `${stageLabel(k.stage)} · ${tr('{n} ans', { n: k.years ?? 0 })}`, k.stage === 'adulte' ? (
                <button className="btn !px-3 !py-1.5 !text-xs" disabled={busy} onClick={() => setAsk(k)}>
                  <House size={14} /> {tr('Passer la main')}
                </button>
              ) : undefined),
            )}
            {(f.elders ?? []).map((el) => row(el.id, elderLook(el), el.gender, 'adulte', el.name, `${el.kin === 'papa' ? tr('Papa') : tr('Maman')} · ${stageLabel(el.stage)} · ${tr('{n} ans', { n: el.years ?? 0 })}`))}
            {(f.memorials ?? []).map((m) => row(`m${m.at}`, elderLook({ look: m.look, seed: m.seed, gender: m.gender, stage: 'senior' }), m.gender, 'adulte', m.name, tr('Parti·e à {n} ans · sa photo est au salon', { n: m.years })))}
            {!(f.kids ?? []).length && !e && <p className="px-1 py-2 text-[13px] font-bold text-[var(--color-ink-soft)]">{tr('Pas encore d’enfant. En couple à la maison, touche ta moitié : « Essayer d’avoir un bébé ».')}</p>}
            <label className="mt-1 flex items-center gap-2.5 rounded-2xl bg-black/[0.035] p-2.5">
              <input type="checkbox" className="h-5 w-5 accent-[var(--color-orange)]" checked={!!f.gentle} disabled={busy} onChange={(ev) => void call('douce', { on: ev.target.checked })} />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-extrabold">{tr('Vieillesse douce')}</span>
                <span className="block text-[12px] leading-snug font-bold text-[var(--color-ink-soft)]">{tr('Les anciens vieillissent, les cheveux blanchissent, mais personne ne s’en va.')}</span>
              </span>
            </label>
          </div>
          {ask && (
            <div className="mt-3 rounded-2xl bg-[#fff4e0] p-3">
              <p className="text-[14px] leading-snug font-extrabold">{tr('Passer à la génération suivante ?')}</p>
              <p className="mt-1 text-[12px] leading-snug font-bold text-[var(--color-ink-soft)]">{tr('Tu joueras {heir} : la maison, le nom {last}, les trois quarts de l’argent (les dettes payées d’abord). {name} reste à la maison avec la famille.', { heir: ask.name, last: sim.lastName, name: sim.firstName })}</p>
              <div className="mt-2 flex gap-2">
                <button className="btn flex-1 !py-2" disabled={busy} onClick={() => void call('relais', { kid: ask.id, look: kidLook(ask, sim.look) }).then((r) => r && close())}>
                  <HeartHandshake size={16} /> {tr('Passer à la génération suivante')}
                </button>
                <button className="btn btn-soft !py-2" onClick={() => setAsk(null)}>
                  {tr('Annuler')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Sheet>
  )
}

/** « Inviter à la maison »: the people met in the game; the player friends come to a soirée. */
function InviteSheet({ sim, busy, onClose, onInvite }: { sim: Sim; busy: boolean; onClose: () => void; onInvite: (who: string) => void }) {
  const friends = (sim.friends ?? []).filter((x) => !x.enemy && !(x.partner && x.home)).sort((a, b) => b.friendship - a.friendship)
  return (
    <Sheet onClose={onClose} className="max-w-md p-4" z="z-50">
      {(close) => (
        <>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-lg font-extrabold">{tr('Inviter à la maison')}</h2>
            <button className="grid h-9 w-9 place-items-center rounded-full bg-black/5 active:scale-90" onClick={close} aria-label={tr('Fermer')}>
              <X size={18} strokeWidth={2.8} />
            </button>
          </div>
          <div className="max-h-[52vh] space-y-1.5 overflow-y-auto overscroll-contain">
            {friends.map((x) => (
              <button key={x.id} className="flex w-full items-center gap-2.5 rounded-2xl bg-black/[0.035] p-2 text-left active:scale-[0.98]" disabled={busy} onClick={() => (haptic('light'), onInvite(x.id))}>
                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-white bg-gradient-to-b from-[#ffe7c7] to-[#ffb27a]">
                  <MiniPortrait look={friendLook(x)} gender={x.gender} stage="adulte" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-extrabold">{x.name}</span>
                  <span className="block text-[12px] font-bold text-[var(--color-ink-soft)]">{tr('Amitié {n}/100', { n: x.friendship })}</span>
                </span>
                <UserPlus size={18} className="text-[var(--color-orange)]" />
              </button>
            ))}
            {!friends.length && <p className="px-1 py-2 text-[13px] font-bold text-[var(--color-ink-soft)]">{tr('Personne à inviter encore : fais des rencontres dans la rue, au maquis, au marché.')}</p>}
            <p className="px-1 pt-1 text-[12px] leading-snug font-bold text-[var(--color-ink-soft)]">{tr('Tes amis joueurs : organise une soirée chez toi, ils voient les lumières et viennent.')}</p>
          </div>
        </>
      )}
    </Sheet>
  )
}

const friendLook = (x: Friend): Look => x.look ?? visitorLook({ seed: x.seed, gender: x.gender })

/** A face in a circle (the game's own portrait of the Sim). */
function MiniPortrait({ look, gender, stage }: { look: Look; gender: 'femme' | 'homme'; stage: string }) {
  return <Portrait look={look} gender={gender} framing="head" stage={stage} />
}

/** The camera slowly round the scene. */
function Turn({ r: r0 = 4.4, y = 2 }: { r?: number; y?: number }) {
  useFrame(({ camera, clock, size }) => {
    // (A phone held upright: further back, the whole family in the narrow frame.)
    const r = size.width < size.height ? r0 * 1.45 : r0
    const a = 0.15 + Math.sin(clock.elapsedTime * 0.08) * 0.5
    camera.position.set(Math.sin(a) * r, y, Math.cos(a) * r)
    camera.lookAt(0, 0.9, 0)
  })
  return null
}

/** The birthday cake: layers, icing, the candles (their flames out once blown). */
function CakeProp({ lit }: { lit: boolean }) {
  const flames = useRef<THREE_Group>(null)
  useFrame(({ clock }) => {
    if (flames.current) flames.current.scale.y = 1 + Math.sin(clock.elapsedTime * 18) * 0.15
  })
  return (
    <group>
      <Box p={[0, 0.38, 0]} s={[0.9, 0.76, 0.6]} c="#8a5a33" />
      <Box p={[0, 0.85, 0]} s={[0.46, 0.18, 0.46]} c="#f4d7e6" />
      <Box p={[0, 0.98, 0]} s={[0.32, 0.12, 0.32]} c="#ffffff" />
      <Box p={[0, 0.93, 0.235]} s={[0.46, 0.04, 0.01]} c="#e0245e" />
      {[-0.1, 0, 0.1].map((x) => (
        <Box key={x} p={[x, 1.1, 0]} s={[0.025, 0.12, 0.025]} c="#4dabf7" />
      ))}
      {lit && (
        <group ref={flames}>
          {[-0.1, 0, 0.1].map((x) => (
            <mesh key={x} position={[x, 1.19, 0]}>
              <boxGeometry args={[0.03, 0.05, 0.03]} />
              <meshBasicMaterial color="#ffcf3b" />
            </mesh>
          ))}
        </group>
      )}
    </group>
  )
}
type THREE_Group = import('three').Group

type Cast = { look: Look; gender: 'femme' | 'homme'; stage: string; old?: boolean; belly?: number; id: string }

/** The house's people for a scene: the Sim, the partner at home, the children, the elders. */
function castOf(sim: Sim): Cast[] {
  const f = famOf(sim)
  const out: Cast[] = [{ id: 'self', look: sim.look, gender: sim.gender, stage: 'adulte', old: isSenior(sim), belly: bellyOf(sim) }]
  const p = sim.friends?.find((x) => x.partner && x.home)
  if (p) out.push({ id: 'partner', look: p.look ?? randomLook(p.gender, rng(`partner${p.id}`)), gender: p.gender, stage: 'adulte' })
  for (const k of f?.kids ?? []) out.push({ id: k.id, look: kidLook(k, sim.look), gender: k.gender, stage: k.stage ?? 'bebe' })
  for (const e of f?.elders ?? []) out.push({ id: e.id, look: elderLook(e), gender: e.gender, stage: 'adulte', old: e.stage === 'senior' })
  return out
}

/** A birthday, a newborn, a farewell: the family in the courtyard, a few seconds of 3D, the words, and on. */
function MomentScene({ sim, scene, call, onEnd }: { sim: Sim; scene: Scene; call: (a: string, b?: Parameters<typeof api.famille>[2]) => Promise<ActionResult | null>; onEnd: () => void }) {
  const [done, setDone] = useState(false)
  const [name, setName] = useState(scene.kind === 'arrival' ? scene.kid.name : '')
  const cast = useMemo(() => castOf(sim), []) // eslint-disable-line react-hooks/exhaustive-deps
  // Who is in the middle: the one whose birthday it is, the newborn, the parent handing down (or no one: their photo).
  const middle = scene.kind === 'party' ? (scene.who === 'self' ? cast[0] : cast.find((c) => c.id === scene.who)) : scene.kind === 'arrival' ? cast.find((c) => c.id === scene.kid.id) : undefined
  const others = cast.filter((c) => c !== middle)
  const gone = scene.kind === 'farewell' && scene.f.gone
  const evening = scene.kind === 'farewell'
  const finish = () => {
    if (scene.kind === 'farewell') void call('vu')
    onEnd()
  }
  const blow = () => {
    sfx.blow()
    haptic('heavy')
    setDone(true)
    reactToResult('me', 'bigwin')
    void call('fete')
  }
  const welcome = () => {
    sfx.win()
    setDone(true)
    void call('nommer', { kid: (scene as { kid: FamKid }).kid.id, name: name.trim() || (scene as { kid: FamKid }).kid.name })
  }
  useEffect(() => {
    if (scene.kind === 'farewell') sfx.bell(1)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const pose = (i: number): Pose => (scene.kind === 'farewell' ? (gone ? (['idle', 'pray', 'idle', 'hug'] as Pose[])[i % 4] : (['clap', 'wave', 'clap'] as Pose[])[i % 3]) : done ? (['cheer', 'dance', 'clap'] as Pose[])[i % 3] : 'clap')
  const title = scene.kind === 'party' ? tr('Joyeux anniversaire, {name} !', { name: scene.name }) : scene.kind === 'arrival' ? tr('Bienvenue à la maison !') : gone ? tr('Au revoir, {name}', { name: scene.f.name }) : tr('La maison passe à {heir}', { heir: scene.f.heir ?? '' })
  return (
    <div className="fixed inset-0 z-[80] flex flex-col" style={{ background: evening ? '#3b2a4a' : '#f7d9a8' }}>
      <div className="relative min-h-0 flex-1">
        <Canvas dpr={sceneDpr} camera={{ fov: 45 }}>
          <Turn />
          <hemisphereLight args={[evening ? '#ffd2a8' : '#fff6e8', evening ? '#3a2a50' : '#8a6a40', evening ? 0.9 : 1.3]} />
          <directionalLight position={[5, 10, 6]} intensity={evening ? 0.8 : 1.3} color={evening ? '#ffb37a' : '#ffffff'} />
          <Box p={[0, -0.05, 0]} s={[16, 0.1, 16]} c={evening ? '#8a5a3c' : '#c98a52'} />
          <Box p={[0, 0.6, -3.2]} s={[9, 1.2, 0.2]} c="#e9d8b8" />
          <Box p={[-2.6, 1.2, -2.4]} s={[0.35, 2.4, 0.35]} c="#6b4423" />
          <Box p={[-2.6, 2.7, -2.4]} s={[2.2, 1.0, 2.0]} c="#2f7d32" />
          {scene.kind === 'party' && (
            <>
              <group position={[1.7, 0, -1.3]}>
                <Balloons />
              </group>
              <group position={[0.75, 0, 0.55]} rotation={[0, -0.5, 0]}>
                <CakeProp lit={!done} />
              </group>
            </>
          )}
          {scene.kind === 'arrival' && <Box p={[0, 0.02, 0.1]} s={[1.3, 0.04, 0.9]} c="#e8a33d" />}
          {gone && (
            <group position={[0, 0, 0.2]}>
              <Box p={[0, 0.45, 0]} s={[0.7, 0.9, 0.45]} c="#6b4423" />
              <Box p={[0, 1.15, 0]} s={[0.46, 0.56, 0.05]} c="#c9a227" />
              <Box p={[0, 1.15, 0.03]} s={[0.38, 0.48, 0.01]} c="#e8dcc8" />
              <group position={[0, 0.93, 0.04]} scale={0.22}>
                <Character look={scene.f.look ? { ...scene.f.look, hairColor: '#d9d6d0' } : randomLook(scene.f.gender, rng('m'))} gender={scene.f.gender} pose="idle" marker={false} seed={3} />
              </group>
              {[-0.28, 0.28].map((x) => (
                <mesh key={x} position={[x, 1.0, 0.1]}>
                  <boxGeometry args={[0.05, 0.16, 0.05]} />
                  <meshLambertMaterial color="#fff6e0" emissive="#ffcf6b" emissiveIntensity={0.8} />
                </mesh>
              ))}
            </group>
          )}
          {scene.kind === 'farewell' && !gone && (
            <group position={[0, 0, 0.2]}>
              <Character look={scene.f.look ?? randomLook(scene.f.gender, rng('e'))} gender={scene.f.gender} pose="hug" marker={false} seed={4} old />
            </group>
          )}
          {middle && (
            <group position={[0, 0, scene.kind === 'party' ? -0.05 : 0.1]}>
              <Character look={middle.look} gender={middle.gender} stage={middle.stage} pose={middle.stage === 'bebe' ? 'idle' : done ? 'cheer' : 'idle'} marker={false} seed={1} old={middle.old} belly={middle.belly} />
            </group>
          )}
          {others.map((c, i) => {
            const n = others.length
            const a = Math.PI + 0.45 + (n === 1 ? 0.5 : i / (n - 1)) * (Math.PI - 0.9)
            return (
              <group key={c.id} position={[Math.cos(a) * Math.min(1.9, 0.9 + 0.22 * n), 0, Math.sin(a) * 1.3 - 0.3]} rotation={[0, -a - Math.PI / 2, 0]}>
                <Character look={c.look} gender={c.gender} stage={c.stage} pose={c.stage === 'bebe' ? 'idle' : pose(i)} marker={false} seed={20 + i} old={c.old} belly={c.belly} />
              </group>
            )
          })}
          {done && scene.kind !== 'farewell' && <Confetti />}
        </Canvas>
        <div className="pointer-events-none absolute inset-x-0 top-[max(1rem,var(--sat,env(safe-area-inset-top)))] text-center">
          <span className="rounded-full bg-black/45 px-4 py-2 text-[13px] font-extrabold tracking-wider text-white uppercase">{title}</span>
        </div>
      </div>
      <div className="bg-white px-5 pt-4 pb-[max(1.25rem,var(--sab,env(safe-area-inset-bottom)))]">
        {scene.kind === 'party' && (
          <>
            <p key={String(done)} className="animate-pop min-h-[3rem] text-[16px] leading-snug font-extrabold text-[var(--color-ink)]">
              {done ? tr('Bravo ! {name} a {n} ans. Toute la famille chante, les photos, le gâteau partagé.', { name: scene.name, n: scene.years }) : tr('{n} ans ! La famille est réunie autour du gâteau. Fais un vœu…', { n: scene.years })}
            </p>
            {done ? (
              <button className="btn mt-3 w-full" onClick={onEnd}>
                <Users size={18} /> {tr('Merci la famille !')}
              </button>
            ) : (
              <button className="btn mt-3 w-full" onClick={blow}>
                <Cake size={18} /> {tr('Souffler les bougies')}
              </button>
            )}
          </>
        )}
        {scene.kind === 'arrival' && (
          <>
            <p className="min-h-[2.5rem] text-[16px] leading-snug font-extrabold text-[var(--color-ink)]">{done ? tr('{name} est à la maison. Toute la famille veille sur ce petit trésor.', { name: name.trim() || scene.kid.name }) : scene.kid.gender === 'femme' ? tr("C'est une petite fille ! Comment s'appelle-t-elle ?") : tr("C'est un petit garçon ! Comment s'appelle-t-il ?")}</p>
            {done ? (
              <button className="btn mt-3 w-full" onClick={onEnd}>
                <Baby size={18} /> {tr('Youpi !')}
              </button>
            ) : (
              <div className="mt-3 flex gap-2">
                <input className="input min-w-0 flex-1" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} aria-label={tr('Son prénom')} />
                <button className="btn" onClick={welcome}>
                  {tr('Bienvenue !')}
                </button>
              </div>
            )}
          </>
        )}
        {scene.kind === 'farewell' && (
          <>
            <p className="text-[15px] leading-snug font-extrabold text-[var(--color-ink)]">
              {gone ? tr('{name} s’est éteint·e paisiblement, à {n} ans. Toute la famille est réunie pour lui dire au revoir. Sa photo restera au salon.', { name: scene.f.name, n: scene.f.years }) : tr('{name} confie la maison à {heir}, et reste vivre avec la famille.', { name: scene.f.name, heir: scene.f.heir ?? '' })}
            </p>
            {scene.f.heir && <p className="mt-1.5 text-[13px] leading-snug font-bold text-[var(--color-ink-soft)]">{tr('{heir} reprend la maison et le nom de la famille, avec {money} F.', { heir: scene.f.heir, money: (scene.f.money ?? 0).toLocaleString('fr-FR') })}</p>}
            <button className="btn mt-3 w-full" onClick={finish}>
              {gone ? <Flower2 size={18} /> : <HeartHandshake size={18} />} {scene.f.heir ? tr('Continuer avec {heir}', { heir: scene.f.heir }) : tr('Continuer')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

