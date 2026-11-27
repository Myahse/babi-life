import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Blocks } from '../open/ruePrincesse'
import { blocksMat } from '../open/kit3d'
import type { At } from '../open/shoreline'
import { People, usePeople } from '../open/villeKit'
import { appatam, at, claie, field, grenier, motoculteur, outils, pen, puits, sacs, type DrawStage } from './parts'
import { Herd } from './betes'
import { INSTANCED, Troupeau } from './troupeau'
import { fieldStage, fermeMinute, fermeNow, onFermeNow, type Champ } from '../../lib/ferme'
import { FIELD, PEN, PENS } from './travail'

// The village plots in the street (the update « agriculture », open/landmarks.tsx): four fields of the village's
// own crops, each at its own stage (one just ploughed, one sprouting, one grown, one ripe), the pens and their
// animals wandering (troupeau.tsx, instanced), the appatam where the planters rest, the well, the motoculteur,
// the grenier, the claies; the villagers at work on their fields (avatar/ferme.ts's gestures). When the player
// holds a plot here (the Sim's farm, from the server: every plot at its own village), the first field is theirs,
// as it is; while the Sim works it (travail.ts), the rows it has done so far show their next stage, row by row
// along its way; the paid farmhand tends it when the Sim is away. Frame: +z the street.

type Look = {
  crops: [string, string, string, string]
  beasts: [string, string]
  north?: boolean
}
const LOOKS: Record<string, Look> = {
  'ferme-gonate': {
    crops: ['cacao', 'banane', 'manioc', 'mais'],
    beasts: ['poules', 'chevres'],
  },
  'ferme-sangouine': {
    crops: ['cafe', 'riz', 'banane', 'piment'],
    beasts: ['poules', 'porcs'],
  },
  'ferme-djebonoua': {
    crops: ['igname', 'mais', 'anacarde', 'gombo'],
    beasts: ['moutons', 'boeufs'],
  },
  'ferme-karakoro': {
    crops: ['coton', 'mil', 'karite', 'sorgho'],
    beasts: ['boeufs', 'pintades'],
    north: true,
  },
  'ferme-attiegouakro': {
    crops: ['igname', 'manioc', 'aubergine', 'mais'],
    beasts: ['tilapia', 'poules'],
  },
  'ferme-gabiadji': {
    crops: ['hevea', 'palmier', 'cacao', 'tomate'],
    beasts: ['porcs', 'tilapia'],
  },
  'ferme-ebimpe': {
    crops: ['tomate', 'gombo', 'piment', 'aubergine'],
    beasts: ['lapins', 'poules'],
  },
  'ferme-akandje': {
    crops: ['tomate', 'manioc', 'gombo', 'palmier'],
    beasts: ['tilapia', 'lapins'],
  },
  'ferme-bama': {
    crops: ['riz', 'coton', 'mil', 'karite'],
    beasts: ['boeufs', 'moutons'],
    north: true,
  },
  'ferme-ejisu': {
    crops: ['cacao', 'palmier', 'banane', 'manioc'],
    beasts: ['poules', 'chevres'],
  },
  'ferme-loire': {
    crops: ['tomate', 'mais', 'tomate', 'mais'],
    beasts: ['moutons', 'lapins'],
  },
  'ferme-iowa': {
    crops: ['mais', 'mais', 'mais', 'tomate'],
    beasts: ['boeufs', 'porcs'],
  },
}
const STAGES: DrawStage[] = [4, 2, 3, 1]
const FW = FIELD.w
const FD = FIELD.d
const TREES = new Set(['cacao', 'cafe', 'anacarde', 'hevea', 'palmier', 'karite'])
const AGAIN: Record<string, number> = { cacao: 3, cafe: 3, anacarde: 4, hevea: 2, palmier: 3, karite: 3 }
const DAYS: Record<string, number> = { cacao: 8, cafe: 8, anacarde: 7, hevea: 9, palmier: 8, karite: 6 }

/** The field as the act being done leaves it (what each row shows once the Sim is past it). */
function after(c: Champ, act: string, crop?: string): Champ {
  switch (act) {
    case 'defricher':
      return { ...c, stage: 'defriche' }
    case 'labourer':
      return { ...c, stage: 'laboure' }
    case 'semer':
      return { stage: 'pousse', crop: crop ?? c.crop, growth: 0 }
    case 'desherber':
      return { ...c, weeds: false }
    case 'traiter':
      return { ...c, pest: false }
    case 'recolter':
      return c.crop && TREES.has(c.crop) ? { ...c, stage: 'pousse', growth: (DAYS[c.crop] ?? 8) - (AGAIN[c.crop] ?? 3), weeds: false } : { stage: 'defriche' }
  }
  return c
}

/** A field's blocks from its state, `w` wide (its rows of it) and its middle at x. */
function drawn(out: At[], c: Champ, x: number, z: number, w: number, rows: number, wet: boolean, seed: number) {
  if (w <= 0.01 || rows <= 0) return
  at(out, x, z, field({ crop: c.crop, stage: fieldStage(c), ploughed: c.stage !== 'friche' && c.stage !== 'defriche', cleared: c.stage !== 'friche', rows, w, d: FD, wet: wet && c.stage === 'pousse', weeds: c.weeds, pest: c.pest, seed }))
}

export function FermeLandmark({ id, night }: { id: string; night: boolean }) {
  void night
  const look = LOOKS[id] ?? LOOKS['ferme-gonate']
  const now = useSyncExternalStore(onFermeNow, fermeNow)
  const own = now.ferme?.plots.find((p) => `ferme-${p.offre}` === id)
  const work = now.work && `ferme-${now.work.offre}` === id ? now.work : null
  // While the Sim works here: the rows done so far, looked at again every two seconds (the shared clock).
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!work) return
    const k = setInterval(() => setTick((n) => n + 1), 2000)
    return () => clearInterval(k)
  }, [work])
  const minute = fermeMinute()
  const progress = work ? Math.max(0, Math.min(1, (minute - work.start) / Math.max(1, work.end - work.start))) : 0
  const done = work ? Math.floor(progress * FIELD.rows + 0.001) : 0
  const today = Math.floor((now.minute || minute) / 1440)
  const mat = useMemo(blocksMat, [])
  const blocks = useMemo(() => {
    const out: At[] = []
    out.push({
      p: [0, -0.04, -6],
      s: [44, 0.08, 34],
      c: look.north ? '#b8a45a' : '#6b9a3a',
    })
    // The path in from the street, between the fields.
    out.push({ p: [0, 0, 4], s: [3, 0.04, 26], c: '#b08a5a' })
    for (let i = 0; i < 4; i++) {
      const x = i % 2 ? 7 : -7
      const z = i < 2 ? -3 : -12
      if (i === 0 && own) {
        const c = own.champ
        const wet = c.watered === today
        if (work && work.plot === own.id && ['defricher', 'labourer', 'semer', 'arroser', 'desherber', 'traiter', 'recolter'].includes(work.act)) {
          // The rows the Sim has done (from the path's side, along its way) at their next stage; the rest as they were.
          const a = after(c, work.act, work.crop)
          const wAfter = (FW / FIELD.rows) * done
          drawn(out, a, x + FW / 2 - wAfter / 2, z, wAfter, done, wet || work.act === 'arroser', 3)
          drawn(out, c, x - FW / 2 + (FW - wAfter) / 2, z, FW - wAfter, FIELD.rows - done, wet, 5)
        } else drawn(out, c, x, z, FW, FIELD.rows, wet, 3)
        // Its sign: a post and a white board.
        out.push(
          {
            p: [x - FW / 2 - 0.4, 0.8, z + FD / 2],
            s: [0.12, 1.6, 0.12],
            c: '#6b4a2a',
          },
          {
            p: [x - FW / 2 - 0.4, 1.5, z + FD / 2 + 0.07],
            s: [1, 0.6, 0.06],
            c: '#f8f9fa',
          },
        )
        continue
      }
      at(
        out,
        x,
        z,
        field({
          crop: look.crops[i],
          stage: STAGES[i],
          ploughed: true,
          cleared: true,
          rows: 7,
          w: FW,
          d: FD,
          wet: i === 1,
          seed: i + 11,
        }),
      )
    }
    // The pens, to the sides of the path in front.
    at(out, PENS[0][0], PENS[0][1], pen(own?.pens?.[0]?.kind ?? look.beasts[0], PEN.w, PEN.d))
    at(out, PENS[1][0], PENS[1][1], pen(own?.pens?.[1]?.kind ?? look.beasts[1], PEN.w, PEN.d))
    at(out, -15, -6, appatam(), 0.3, 0, 1.4)
    at(out, 15.5, -4, puits())
    at(out, 3.2, 6.5, outils(), 0.4)
    // (The motoculteur, out of its corner while the Sim ploughs with it.)
    if (!(work?.act === 'labourer' && work.hire)) at(out, -3.6, 9, motoculteur(), 2.4)
    at(out, 16, -11, grenier(!!look.north), -0.3)
    at(out, 16, -8.6, sacs(6 + Math.min(3, Math.ceil(Object.values(now.ferme?.grenier ?? {}).reduce((a, b) => a + b, 0) / 40))))
    // The claies: the Sim's own harvest drying on the first (spread as it works), the village's on the second.
    const drying = now.ferme?.sechage?.[0]?.product ?? (work?.act === 'transformer' ? work.product : undefined)
    at(out, -16, -12, claie(drying === 'cafe-seche' ? '#a61e1e' : drying || !own ? (look.crops.includes('cafe') ? '#a61e1e' : '#6b3a1a') : '#c9a25a'), 0.2)
    at(out, -16, -15.5, claie('#e9c46a'), 0.2)
    // The trees kept for shade at the edges.
    for (let i = 0; i < 6; i++) {
      const x = i % 2 ? 20 : -20
      const z = -18 + i * 4.5
      out.push(
        { p: [x, 2.4, z], s: [0.5, 4.8, 0.5], c: '#6e5640' },
        {
          p: [x, 5.4, z],
          s: [4, 2, 3.6],
          c: look.north ? '#6a8a3a' : '#2f6a30',
        },
        { p: [x + 0.4, 6.6, z], s: [2.6, 1.2, 2.6], c: '#3c7a36' },
      )
    }
    return out
  }, [look, own, work, done, today, now.ferme]) // eslint-disable-line react-hooks/exhaustive-deps
  void tick
  // The villagers at work on their own fields (the hoe, the weeding, the watering, the sowing), one resting, one
  // carrying; the herder by the oxen's park.
  const people = usePeople(`ferme-${id}`, [
    { p: [7.6, 0, -1.2], ry: Math.PI, pose: 'desherber' },
    {
      p: [-6.4, 0, -9.2],
      ry: Math.PI,
      pose: 'arroser',
      dress: { outfit: 'pagne', outfitColor: '#2f9e44' },
    },
    { p: [8.2, 0, -9.4], ry: Math.PI, pose: 'semer', dress: { outfit: 'pagne', outfitColor: '#e8590c' } },
    { p: [4.6, 0, -13.5], ry: Math.PI / 2, pose: 'daba', gender: 'homme' },
    { p: [-14.6, 0, -5.4], ry: 0.4, pose: 'sitground', gender: 'homme' },
    {
      p: [14.5, 0, 3.8],
      ry: Math.PI,
      pose: 'carry',
      dress: { outfit: 'pagne', outfitColor: '#e8590c' },
    },
  ])
  // The village's picker on the ripe first field when it isn't the player's; the farmhand on the player's when
  // they pay one and aren't at work there themselves.
  const picker = usePeople(`ferme-${id}-p`, [{ p: [-7, 0, -1], ry: 0.2, pose: 'cueillir' }])
  const hand = usePeople(`ferme-${id}-m`, [{ p: [FIELD.x + 1.8, 0, FIELD.z + 1.5], ry: Math.PI, pose: 'desherber', gender: 'homme', dress: { outfit: 'bleu', outfitColor: '#1971c2' } }])
  const herds = own?.pens?.length
    ? own.pens.slice(0, 2).map((e) => ({
        kind: e.kind,
        n: e.adults,
        young: e.young ?? 0,
        tired: e.tired,
      }))
    : look.beasts.map((k) => ({ kind: k, n: 5, young: 1, tired: false }))
  return (
    <group>
      <Blocks at={blocks} material={mat} color />
      {herds.map((h, i) => {
        const [px, pz] = PENS[i]
        // Led to the pasture (« mener le troupeau »): round behind the fields, then home.
        const led = work?.act === 'paturage' && work.kind === h.kind
        const side = px < 0 ? -1 : 1
        const outAt: [number, number][] | undefined = led
          ? [
              [side * 19 - px, 2 - pz],
              [side * 19 - px, -17 - pz],
              [0 - px, -20 - pz],
              [-side * 10 - px, -19 - pz],
            ]
          : undefined
        return (
          <group key={h.kind + i} position={[px, 0, pz]}>
            {INSTANCED.has(h.kind) ? <Troupeau kind={h.kind} n={h.n} young={h.young} tired={h.tired} w={PEN.w} d={PEN.d} seed={i * 5 + 1} out={outAt} /> : <Herd kind={h.kind} n={h.n} young={h.young} tired={h.tired} w={PEN.w} d={PEN.d} seed={i * 5} />}
          </group>
        )
      })}
      <People list={people} />
      {!own && <People list={picker} />}
      {own?.hand && !work && <People list={hand} />}
    </group>
  )
}
