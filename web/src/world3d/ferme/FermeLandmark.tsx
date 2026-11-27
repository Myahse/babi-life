import { useMemo, useSyncExternalStore } from 'react'
import { Blocks } from '../open/ruePrincesse'
import { blocksMat } from '../open/kit3d'
import type { At } from '../open/shoreline'
import { People, usePeople } from '../open/villeKit'
import { appatam, at, claie, field, grenier, motoculteur, outils, pen, puits, sacs, type DrawStage } from './parts'
import { Herd } from './betes'
import { fermeShown, onFermeShown } from '../../lib/ferme'

// The village plots in the street (the update « agriculture », open/landmarks.tsx): four fields of the village's
// own crops, each at its own stage (one just ploughed, one sprouting, one grown, one ripe), the pens and their
// animals, the appatam where the planters rest, the well, the motoculteur, the grenier, the claies; the villagers
// at work. When the player has a plot here (the « Ferme » app last opened), the first field is theirs, as it is.
// Frame: +z the street.

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
const FW = 9
const FD = 7

export function FermeLandmark({ id, night }: { id: string; night: boolean }) {
  void night
  const look = LOOKS[id] ?? LOOKS['ferme-gonate']
  const mine = useSyncExternalStore(onFermeShown, fermeShown)
  const own = mine?.plots.find((p) => `ferme-${p.offre}` === id)
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
        const g = c.growth ?? 0
        const stage: DrawStage = c.stage === 'mur' ? 4 : c.stage !== 'pousse' ? 0 : g < 1 ? 1 : g < 3 ? 2 : 3
        at(
          out,
          x,
          z,
          field({
            crop: c.crop,
            stage,
            ploughed: c.stage !== 'friche' && c.stage !== 'defriche',
            cleared: c.stage !== 'friche',
            rows: 7,
            w: FW,
            d: FD,
            weeds: c.weeds,
            pest: c.pest,
            seed: 3,
          }),
        )
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
    at(out, -14.5, 6, pen(own?.pens?.[0]?.kind ?? look.beasts[0], 5, 4.4))
    at(out, 14.5, 6, pen(own?.pens?.[1]?.kind ?? look.beasts[1], 5, 4.4))
    at(out, -15, -6, appatam(), 0.3, 0, 1.4)
    at(out, 15.5, -4, puits())
    at(out, 3.2, 6.5, outils(), 0.4)
    at(out, -3.6, 9, motoculteur(), 2.4)
    at(out, 16, -11, grenier(!!look.north), -0.3)
    at(out, 16, -8.6, sacs(6))
    at(out, -16, -12, claie(look.crops.includes('cafe') ? '#a61e1e' : '#6b3a1a'), 0.2)
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
  }, [look, own])
  const people = usePeople(`ferme-${id}`, [
    { p: [-7, 0, -1], ry: 0.2, pose: 'pick' },
    {
      p: [7.5, 0, -11],
      ry: 2.6,
      pose: 'pick',
      dress: { outfit: 'pagne', outfitColor: '#2f9e44' },
    },
    { p: [-14.6, 0, -5.4], ry: 0.4, pose: 'sitground', gender: 'homme' },
    {
      p: [14.5, 0, 3.8],
      ry: Math.PI,
      pose: 'carry',
      dress: { outfit: 'pagne', outfitColor: '#e8590c' },
    },
  ])
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
      {herds.map((h, i) => (
        <group key={h.kind + i} position={[i ? 14.5 : -14.5, 0, 6]}>
          <Herd kind={h.kind} n={h.n} young={h.young} tired={h.tired} w={5} d={4.4} seed={i * 5} />
        </group>
      ))}
      <People list={people} />
    </group>
  )
}
