import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Droplets, Minus, Plus, Sprout, Sun } from 'lucide-react'
import { t as tr } from '../../../lib/i18n'
import { haptic } from '../../../lib/native'
import { snd } from '../../defi/jeux/juice'
import { B } from '../../../world3d/espace/blocs'
import { clamp, Frame, Tap, type Ended } from './Frame'
import { Fused } from './Fused'
import type { GameProps } from './types'

// La serre (backend game.SerreJeuID, « mars-serre-jours »): the dome's greenhouse at the Colonie Harmattan, a few
// sols (Martian days) lived in one sitting. Each sol the recycler gives so much water and the panels so much lamp
// time, never enough for all six crops: give each its share (a plant half fed still grows a little and keeps
// well; one left with nothing wilts, and comes back slowly), then « Sol suivant ». A dust storm one sol: no sun
// through the dome, the lamps have to do it all. The harvest, counted against the best that could be grown, is
// the score.

type Crop = { name: string; water: number; light: number; color: string; fruit: string }
const CROPS: Crop[] = [
  { name: tr('Manioc'), water: 2, light: 1, color: '#2f9e44', fruit: '#e9d8a6' },
  { name: tr('Piment'), water: 1, light: 2, color: '#37b24d', fruit: '#e03131' },
  { name: tr('Gombo'), water: 2, light: 2, color: '#40c057', fruit: '#94d82d' },
  { name: tr('Salade'), water: 1, light: 1, color: '#69db7c', fruit: '#b2f2bb' },
  { name: tr('Tomate'), water: 2, light: 2, color: '#2b8a3e', fruit: '#f03e3e' },
  { name: tr('Haricot'), water: 1, light: 1, color: '#51cf66', fruit: '#a9e34b' },
]
const SOLS = 5
/** Each sol's water (litres, the recycler's), lamp time (the panels'), and the sun through the dome (each crop). */
const DAYS = [
  { water: 6, lamps: 3, sun: 1 },
  { water: 6, lamps: 3, sun: 1 },
  { water: 6, lamps: 5, sun: 0, storm: true },
  { water: 8, lamps: 3, sun: 1 },
  { water: 6, lamps: 3, sun: 1 },
]

type Plot = { w: number; l: number; health: number; growth: number }
const freshPlots = (): Plot[] => CROPS.map(() => ({ w: 0, l: 0, health: 1, growth: 0 }))

/** How well a crop is fed this sol (0..1): its water and its light (the sun's and the lamps'), the scarcer. */
const fed = (c: Crop, p: Plot, sun: number) => Math.min(1, p.w / c.water, (p.l + sun) / c.light)

/** The best harvest the sols allow (each sol's water and lamps spread as well as can be): the score's 100. */
function bestHarvest() {
  let total = 0
  for (const d of DAYS) {
    // Greedy by what one more unit adds (water, then lamps), the crops' own needs capping it.
    const p = CROPS.map(() => ({ w: 0, l: 0 }))
    for (let k = 0; k < d.water; k++) {
      let bi = -1
      let bg = 0
      CROPS.forEach((c, i) => {
        if (p[i].w >= c.water) return
        const g = 1 / c.water
        if (g > bg) ((bg = g), (bi = i))
      })
      if (bi >= 0) p[bi].w++
    }
    for (let k = 0; k < d.lamps; k++) {
      let bi = -1
      let bg = 0
      CROPS.forEach((c, i) => {
        const need = c.light - d.sun
        if (p[i].l >= need) return
        const before = Math.min(1, p[i].w / c.water, (p[i].l + d.sun) / c.light)
        const after = Math.min(1, p[i].w / c.water, (p[i].l + 1 + d.sun) / c.light)
        if (after - before > bg) ((bg = after - before), (bi = i))
      })
      if (bi >= 0) p[bi].l++
    }
    total += CROPS.reduce((s, c, i) => s + Math.min(1, p[i].w / c.water, (p[i].l + d.sun) / c.light), 0)
  }
  return total
}

function Plant({ crop, plot, i, picked, onPick }: { crop: Crop; plot: Plot; i: number; picked: boolean; onPick: () => void }) {
  const g = useRef<THREE.Group>(null)
  const x = (i % 3) * 2.6 - 2.6
  const z = Math.floor(i / 3) * 2.8 - 1.4
  useFrame(({ clock }) => {
    if (g.current) g.current.rotation.z = Math.sin(clock.elapsedTime * 1.3 + i) * 0.03 * plot.health
  })
  const h = 0.25 + Math.min(1.8, plot.growth * 0.38)
  const wilt = plot.health < 0.5
  const leaf = wilt ? '#a9a15a' : crop.color
  return (
    <group position={[x, 0, z]} onClick={(e) => (e.stopPropagation(), onPick())}>
      {/* The planter, its soil, its tag; the glow of the one picked */}
      <B p={[0, 0.3, 0]} s={[2, 0.6, 2]} c={picked ? '#ff922b' : '#868e96'} />
      <B p={[0, 0.62, 0]} s={[1.8, 0.06, 1.8]} c={plot.w > 0 ? '#5c3d1e' : '#8a6a4a'} />
      {plot.w > 0 && [...Array(plot.w)].map((_, k) => <B key={k} p={[-0.7 + k * 0.3, 0.68, 0.85]} s={[0.18, 0.08, 0.08]} c="#4dabf7" glow />)}
      <group ref={g} position={[0, 0.65, 0]}>
        <B p={[0, h / 2, 0]} s={[0.14, h, 0.14]} c={wilt ? '#8f8a4a' : '#2b8a3e'} />
        {[...Array(Math.max(1, Math.round(1 + plot.growth)))].map((_, k) => {
          const y = 0.2 + (k / Math.max(1, plot.growth + 1)) * h
          const s = (k % 2 ? 1 : -1) * (wilt ? 0.25 : 0.35)
          return <B key={k} p={[s, y, (k % 3) * 0.1 - 0.1]} s={[0.55, wilt ? 0.06 : 0.12, 0.35]} c={leaf} r={[0, k, wilt ? s * 1.5 : 0]} />
        })}
        {plot.growth >= 2.5 && [...Array(Math.min(4, Math.floor(plot.growth - 1.5)))].map((_, k) => <B key={k} p={[(k % 2 ? 0.3 : -0.3), h * 0.5 + k * 0.15, 0.25]} s={[0.2, 0.2, 0.2]} c={crop.fruit} />)}
      </group>
      {/* Its lamp, lit as much as it's given */}
      <B p={[0, 3.3, 0]} s={[1.6, 0.12, 0.4]} c={plot.l > 0 ? '#f783ac' : '#495057'} glow={plot.l > 0} />
      {plot.l > 0 && <B p={[0, 2.1, 0]} s={[1.4, 2.2, 1.4]} c="#f783ac" glow o={0.08 * plot.l} />}
    </group>
  )
}

function Dome({ storm }: { storm: boolean }) {
  return (
    <group>
      <B p={[0, -0.1, 0]} s={[12, 0.2, 9]} c="#dee2e6" />
      {/* The dome's frame and its panes; Mars outside, red, (orange, a storm) */}
      {[-5.8, 5.8].map((x) => <B key={x} p={[x, 2.5, 0]} s={[0.2, 5, 9]} c="#ced4da" o={0.4} />)}
      <B p={[0, 2.5, -4.4]} s={[12, 5, 0.2]} c="#e7f5ff" o={0.18} />
      {[-4, -1.3, 1.3, 4].map((x) => <B key={x} p={[x, 2.5, -4.35]} s={[0.12, 5, 0.12]} c="#adb5bd" />)}
      {[-3, 0, 3].map((z) => <B key={z} p={[0, 5.1, z]} s={[12, 0.15, 0.15]} c="#adb5bd" />)}
      <B p={[0, 0, -30]} s={[120, 0.2, 50]} c={storm ? '#b5542a' : '#c1440e'} />
      {[...Array(9)].map((_, i) => <B key={i} p={[-40 + i * 10 + (i % 3) * 2, 1 + (i % 2), -22 - (i % 4) * 6]} s={[3 + (i % 3), 2 + (i % 2) * 2, 3]} c="#a63c12" />)}
      <B p={[10, 3, -50]} s={[40, 8, 4]} c="#8a3510" />
      {/* The recycler's tank, its water level; the panel box */}
      <group position={[5.1, 0, 3.6]}>
        <B p={[0, 1, 0]} s={[1, 2, 1]} c="#f1f3f5" />
        <B p={[0, 0.9, 0.51]} s={[0.6, 1.4, 0.02]} c="#4dabf7" glow />
      </group>
      <B p={[-5.2, 1.2, 3.6]} s={[0.8, 1.4, 0.8]} c="#495057" />
      <B p={[-5.2, 1.5, 4.01]} s={[0.4, 0.2, 0.02]} c="#fab005" glow />
    </group>
  )
}

export function SerreJeu({ send, onClose }: GameProps) {
  const best = useMemo(() => bestHarvest(), [])
  const [run, setRun] = useState(0)
  const [plots, setPlots] = useState<Plot[]>(freshPlots)
  const [sol, setSol] = useState(0)
  const [pick, setPick] = useState(0)
  const [harvest, setHarvest] = useState(0)
  const [said, setSaid] = useState<string | null>(null)
  const [ended, setEnded] = useState<Ended | null>(null)
  const day = DAYS[Math.min(sol, SOLS - 1)]
  const usedW = plots.reduce((s, p) => s + p.w, 0)
  const usedL = plots.reduce((s, p) => s + p.l, 0)
  const c = CROPS[pick]
  const p = plots[pick]
  const set = (i: number, f: (p: Plot) => Plot) => setPlots((ps) => ps.map((x, k) => (k === i ? f(x) : x)))
  const addW = (n: number) => {
    if (n > 0 && (usedW >= day.water || p.w >= c.water + 1)) return
    if (n < 0 && p.w <= 0) return
    snd.tap()
    set(pick, (x) => ({ ...x, w: x.w + n }))
  }
  const addL = (n: number) => {
    if (n > 0 && (usedL >= day.lamps || p.l >= c.light)) return
    if (n < 0 && p.l <= 0) return
    snd.tap()
    set(pick, (x) => ({ ...x, l: x.l + n }))
  }
  const nextSol = () => {
    let got = 0
    let wilted = 0
    let drowned = 0
    const after = plots.map((x, i) => {
      const cr = CROPS[i]
      const f = fed(cr, x, day.sun)
      got += f * x.health
      let health = x.health
      if (x.w > cr.water) ((health -= 0.15), drowned++)
      if (f < 0.5) ((health -= 0.3), wilted++)
      else health += 0.15
      return { w: 0, l: 0, health: clamp(health, 0.2, 1), growth: x.growth + f * x.health }
    })
    const total = harvest + got
    haptic('light')
    snd.whoosh(0.4)
    setPlots(after)
    setHarvest(total)
    setSaid(
      drowned
        ? tr('Trop d’eau dans un bac : les racines boivent la tasse.')
        : wilted
          ? tr('{n} plante(s) fanent un peu : il leur manquait trop.', { n: wilted })
          : tr('Sol {k} : tout le monde a poussé !', { k: sol + 1 }),
    )
    if (sol + 1 >= SOLS) {
      const score = Math.round(clamp((total / best) * 100, 1, 100))
      setEnded({ score, line: score >= 50 ? tr('La récolte est belle : manioc, piment, gombo et tomates pour la colonie.') : tr('Une petite récolte. La serre repartira mieux au prochain cycle : on recommence ?') })
    } else setSol(sol + 1)
  }
  const retry = () => {
    setPlots(freshPlots())
    setSol(0)
    setHarvest(0)
    setSaid(null)
    setEnded(null)
    setRun((n) => n + 1)
  }
  const sun = day.sun > 0
  return (
    <Frame
      key={run}
      title={tr('La serre d’Harmattan')}
      icon={Sprout}
      hint={
        <>
          {day.storm ? tr('Tempête de poussière : pas de soleil aujourd’hui, les lampes font tout. ') : ''}
          {tr('{name} : {w} L d’eau et {l} de lumière par sol ({sun}). Touche un bac pour le choisir.', { name: c.name, w: c.water, l: c.light, sun: sun ? tr('le soleil en donne 1') : tr('pas de soleil') })}
          {said ? ` ${said}` : ''}
        </>
      }
      gauges={[
        { label: tr('Sol'), value: ((sol + (ended ? 1 : 0)) / SOLS) * 100, text: `${Math.min(SOLS, sol + 1)}/${SOLS}`, tone: 'info' },
        { label: tr('Eau'), value: ((day.water - usedW) / day.water) * 100, text: tr('{n} L', { n: day.water - usedW }), tone: day.water - usedW === 0 ? 'warn' : 'info' },
        { label: tr('Lampes'), value: ((day.lamps - usedL) / day.lamps) * 100, text: `${day.lamps - usedL}`, tone: day.lamps - usedL === 0 ? 'warn' : 'ok' },
        { label: tr('Récolte'), value: (harvest / best) * 100, text: `${Math.round((harvest / best) * 100)} %`, tone: 'ok' },
      ]}
      controls={
        <>
          <div className="flex items-center gap-2 rounded-2xl bg-black/55 p-2 text-[12px] font-extrabold">
            <span className="w-16 shrink-0 truncate text-[#ffd76a]">{c.name}</span>
            <Droplets size={15} className="shrink-0 text-[#4dabf7]" />
            <Tap label={tr('Moins d’eau')} onTap={() => addW(-1)}><Minus size={16} /></Tap>
            <span className="w-8 text-center tabular-nums">{p.w}/{c.water}</span>
            <Tap label={tr('Plus d’eau')} onTap={() => addW(1)} tone="#1c7ed6"><Plus size={16} /></Tap>
            <Sun size={15} className="shrink-0 text-[#f783ac]" />
            <Tap label={tr('Moins de lampe')} onTap={() => addL(-1)}><Minus size={16} /></Tap>
            <span className="w-8 text-center tabular-nums">{p.l + day.sun}/{c.light}</span>
            <Tap label={tr('Plus de lampe')} onTap={() => addL(1)} tone="#c2255c"><Plus size={16} /></Tap>
          </div>
          <div className="flex gap-2">
            {CROPS.map((cr, i) => (
              <Tap key={i} tone={i === pick ? '#ff7a00' : '#ffffff22'} onTap={() => setPick(i)}>
                <span className="text-[10.5px]">{cr.name}</span>
              </Tap>
            ))}
          </div>
          <Tap tone="#2b8a3e" onTap={nextSol}>
            {sol + 1 >= SOLS ? tr('Récolter') : tr('Sol suivant')}
          </Tap>
        </>
      }
      ended={ended}
      onRetry={retry}
      send={send}
      onClose={onClose}
      bg={day.storm ? '#3a1a0c' : '#e8a46b'}
      cam={{ position: [0, 15, 12.5], fov: 50 }}
    >
      <color attach="background" args={[day.storm ? '#7a3a1a' : '#e8a46b']} />
      <fog attach="fog" args={[day.storm ? '#7a3a1a' : '#e8a46b', 20, 70]} />
      <ambientLight intensity={day.storm ? 0.5 : 0.75} />
      <directionalLight position={[6, 12, 4]} intensity={day.storm ? 0.4 : 1.3} color="#ffd8a8" />
      <CamLook />
      <Fused key={day.storm ? 'tempete' : 'clair'}>
        <Dome storm={!!day.storm} />
      </Fused>
      {CROPS.map((cr, i) => (
        <Plant key={i} crop={cr} plot={plots[i]} i={i} picked={i === pick} onPick={() => setPick(i)} />
      ))}
    </Frame>
  )
}

function CamLook() {
  useFrame(({ camera }) => camera.lookAt(0, -0.6, 0.6))
  return null
}
