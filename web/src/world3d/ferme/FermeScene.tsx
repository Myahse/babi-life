import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Blocks } from '../open/ruePrincesse'
import { blocksMat } from '../open/kit3d'
import type { At } from '../open/shoreline'
import { appatam, at, claie, field, grenier, motoculteur, outils, pen, puits, sacs, type DrawStage } from './parts'
import { Herd } from './betes'
import type { Meteo } from '../../lib/ferme'

// One plot of the farm in blocks, for the phone's « Ferme » app (components/ferme/FermeApp.tsx): the field and
// its rows at their stage, the pens with their animals, the appatam, the well, the tools, the Kabako motoculteur,
// the grenier's bags and the claies when something dries; the day's weather (the rain falling, the harmattan's
// haze, the winter's frost abroad). The fixed blocks are one draw call (Blocks); only the animals and the rain move.

export type ScenePlot = {
  crop?: string
  stage: DrawStage
  ploughed: boolean
  cleared: boolean
  rows: number
  wet?: boolean
  weeds?: boolean
  pest?: boolean
  pens: { kind: string; n: number; young: number; tired?: boolean }[]
  bags: number
  drying?: string
  meteo: Meteo
  north?: boolean
  seed: number
}

function Rain({ on }: { on: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const drops = useMemo(() => Array.from({ length: 160 }, (_, i) => [((i * 37) % 100) / 100 - 0.5, ((i * 53) % 100) / 100, ((i * 71) % 100) / 100 - 0.5] as const), [])
  const o = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const t = clock.elapsedTime
    drops.forEach(([x, y, z], i) => {
      o.position.set(x * 14, ((y * 6 - t * 7) % 6 + 6) % 6, z * 10)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  if (!on) return null
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, drops.length]}>
      <boxGeometry args={[0.02, 0.35, 0.02]} />
      <meshBasicMaterial color="#a5d8ff" transparent opacity={0.7} />
    </instancedMesh>
  )
}

export function FermeScene({ plot }: { plot: ScenePlot }) {
  const mat = useMemo(blocksMat, [])
  const fw = 5.4
  const fd = 4.2
  const blocks = useMemo(() => {
    const out: At[] = []
    // The ground round it: the grass (frosted abroad in winter, yellowed in the harmattan), the path.
    out.push({ p: [0, -0.06, 0], s: [22, 0.1, 16], c: plot.meteo === 'froid' ? '#dfe7ec' : plot.meteo === 'harmattan' || plot.north ? '#b8a45a' : '#6b9a3a' })
    out.push({ p: [0.4, -0.01, 4], s: [1.2, 0.02, 7], c: '#b08a5a' })
    at(out, -2.2, 0, field({ crop: plot.crop, stage: plot.stage, ploughed: plot.ploughed, cleared: plot.cleared, rows: plot.rows, w: fw, d: fd, wet: plot.wet, weeds: plot.weeds, pest: plot.pest, seed: plot.seed }))
    // The pens, one or two, to the right.
    plot.pens.slice(0, 2).forEach((p, i) => at(out, 3.6, -1.6 + i * 3.5, pen(p.kind)))
    // The appatam behind, the well, the tools, the motoculteur, the grenier and its bags, the claies.
    at(out, -2.4, -4.4, appatam())
    at(out, 1.2, -3.6, puits())
    at(out, 0.8, 2.6, outils(), 0.4)
    at(out, -5.8, 2.9, motoculteur(), 0.9)
    at(out, 6.6, -4.4, grenier(!!plot.north), -0.3)
    if (plot.bags > 0) at(out, 6.6, -2.4, sacs(plot.bags))
    if (plot.drying) at(out, 0.2, 4.4, claie(plot.drying === 'cafe-seche' ? '#a61e1e' : plot.drying === 'feves-sechees' ? '#6b3a1a' : '#e9c46a'), 0.1)
    // A few trees round the plot (the shade kept).
    for (const [x, z, h] of [
      [-8.5, -5, 4],
      [-8.8, 3.5, 3.2],
      [8.8, 2.5, 3.6],
      [9, -6.5, 4.4],
    ] as const) {
      out.push({ p: [x, h / 2, z], s: [0.35, h, 0.35], c: '#6e5640' }, { p: [x, h + 0.4, z], s: [2.6, 1.4, 2.4], c: plot.north ? '#6a8a3a' : '#2f6a30' }, { p: [x + 0.4, h + 1.1, z + 0.2], s: [1.6, 0.8, 1.6], c: '#3c7a36' })
    }
    return out
  }, [plot])
  return (
    <group>
      <hemisphereLight args={[plot.meteo === 'pluie' ? '#c9d6e3' : '#fff7e6', '#6b5a40', plot.meteo === 'pluie' ? 0.9 : 1.15]} />
      <directionalLight position={[5, 9, 6]} intensity={plot.meteo === 'pluie' ? 0.6 : 1.3} />
      {plot.meteo === 'harmattan' && <fog attach="fog" args={['#e9d8b4', 8, 26]} />}
      {plot.meteo === 'pluie' && <fog attach="fog" args={['#b7c4cf', 10, 30]} />}
      <Blocks at={blocks} material={mat} color />
      {plot.pens.slice(0, 2).map((p, i) => (
        <group key={p.kind} position={[3.6, 0, -1.6 + i * 3.5]}>
          <Herd kind={p.kind} n={p.n} young={p.young} tired={p.tired} seed={i * 3 + plot.seed} />
        </group>
      ))}
      <Rain on={plot.meteo === 'pluie'} />
    </group>
  )
}
