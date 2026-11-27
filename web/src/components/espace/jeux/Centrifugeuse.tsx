import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Box } from '../../../world3d/props'
import { JeuShell, Stage, scoreOf } from '../../defi/jeux/Shell'
import { juice, snd } from '../../defi/jeux/juice'
import { haptic } from '../../../lib/native'
import { t as tr } from '../../../lib/i18n'
import { HoldButton, Suited, levelOf } from './common'

// La centrifugeuse (backend game/espaceCarriere.go: selection-, module-, touriste-centrifugeuse): the long arm
// turns, the gondola at its end; the instructor calls a band of G, up to 8 G for the training (6 for the
// selection, 4 for the tourists). Hold to speed the arm up, let go to slow it: keep the gauge in the green.
// Too high, the view greys a little and the arm slows by itself (nobody is hurt).

/** The bands called, one after the other (their centre in G), by level. */
const BANDS = { touriste: [2, 3, 4], selection: [2.5, 4, 5.5, 6], module: [3, 5, 6.5, 8] } as const
const PHASE = 5.5 // seconds per band
const MAX_G = 9

type Live = { g: number; holding: boolean; band: number; t: number; over: boolean }

function Machine({ live }: { live: { current: Live } }) {
  const arm = useRef<THREE.Group>(null)
  const mats = useRef<(THREE.MeshLambertMaterial | null)[]>([])
  const col = new THREE.Color()
  useFrame((_, dt) => {
    const l = live.current
    if (arm.current) arm.current.rotation.y += dt * (0.4 + Math.sqrt(Math.max(0, l.g - 1)) * 1.9)
    // The G gauge: a column of 18 blocks, the band in green, the level lit.
    mats.current.forEach((m, i) => {
      if (!m) return
      const g = ((i + 0.5) / mats.current.length) * MAX_G
      const inBand = Math.abs(g - l.band) <= 0.75
      const lit = g <= l.g
      col.set(lit ? (g > l.band + 0.75 ? '#ff5c7a' : inBand ? '#2fd158' : '#ffb020') : inBand ? '#1d6b33' : '#3a3f4a')
      m.color.copy(col)
      m.emissive.copy(col)
      m.emissiveIntensity = lit ? 0.45 : 0.1
    })
  })
  return (
    <group>
      {/* The hall's floor ring, the hub */}
      <Box p={[0, 0.05, 0]} s={[7.6, 0.1, 6.6]} c="#ced4da" />
      <Box p={[-1, 0.35, 0]} s={[0.9, 0.7, 0.9]} c="#495057" />
      <group ref={arm} position={[-1, 0.75, 0]}>
        <Box p={[1.4, 0, 0]} s={[2.8, 0.22, 0.3]} c="#868e96" />
        <Box p={[-0.5, 0, 0]} s={[1, 0.22, 0.3]} c="#868e96" />
        {/* The counterweight, the gondola with its trainee */}
        <Box p={[-1.05, 0, 0]} s={[0.5, 0.5, 0.5]} c="#343a40" />
        <group position={[2.9, -0.1, 0]}>
          <Box p={[0, 0.25, 0]} s={[0.9, 0.9, 0.8]} c="#ffffff" />
          <Box p={[0, 0.25, 0.41]} s={[0.5, 0.4, 0.02]} c="#74c0fc" glow={0.2} />
          <Box p={[0, -0.22, 0]} s={[0.95, 0.08, 0.85]} c="#ff7a00" />
          <group position={[0, -0.15, 0]} scale={0.4} rotation={[0, Math.PI / 2, 0]}>
            <Suited pose="sit" />
          </group>
        </group>
      </group>
      {/* The gauge, right */}
      <group position={[3.1, 0, -0.6]}>
        <Box p={[0, 1.8, -0.25]} s={[0.9, 3.7, 0.15]} c="#22252e" />
        {[...Array(18)].map((_, i) => (
          <mesh key={i} position={[0, 0.2 + i * 0.19, 0]}>
            <boxGeometry args={[0.6, 0.16, 0.3]} />
            <meshLambertMaterial ref={(m) => void (mats.current[i] = m)} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export function Centrifugeuse({ id, onEnd }: { id: string; onEnd: (score: number) => void }) {
  const level = levelOf(id)
  const bands: readonly number[] = BANDS[level]
  const total = bands.length * PHASE
  const live = useRef<Live>({ g: 1, holding: false, band: bands[0], t: 0, over: false })
  const inBand = useRef(0)
  const [view, setView] = useState<{ g: number; band: number; k: number }>({ g: 1, band: bands[0], k: 0 })
  const [said, setSaid] = useState<string | null>(null)
  const end = useRef(onEnd)
  end.current = onEnd
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let greyed = 0
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const l = live.current
      if (l.over) return
      l.t += dt
      const k = Math.min(bands.length - 1, Math.floor(l.t / PHASE))
      if (bands[k] !== l.band) {
        l.band = bands[k]
        snd.go()
        setSaid(tr('Palier suivant : {0} G !', { 0: bands[k] }))
      }
      // Held, the arm speeds up; let go, it slows; a little wobble all the time.
      l.g = Math.max(1, Math.min(MAX_G, l.g + (l.holding ? 1.9 : -1.4) * dt + Math.sin(l.t * 2.3) * 0.25 * dt))
      if (Math.abs(l.g - l.band) <= 0.75) inBand.current += dt
      if (l.g > l.band + 1.6 && now - greyed > 1800) {
        greyed = now
        juice.bad({ text: tr('La vue grise un peu : ralentis !'), soft: true })
        haptic('light')
      }
      setView({ g: l.g, band: l.band, k })
      if (l.t >= total) {
        l.over = true
        const s = scoreOf(inBand.current, total * 0.8)
        juice.finish(s, s >= 50 ? tr('Le corps a tenu les G : validé par le médecin.') : tr('Trop de temps hors du vert : on recommencera.'), (x) => end.current(x))
        return
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [bands, total])
  const hold = (on: boolean) => void (live.current.holding = on)
  const zone = Math.abs(view.g - view.band) <= 0.75
  return (
    <JeuShell
      title={level === 'touriste' ? tr('La centrifugeuse des voyageurs') : tr('La centrifugeuse')}
      how={tr('Maintiens pour accélérer le bras, lâche pour ralentir : garde l’aiguille des G dans la bande verte, palier après palier.')}
      goal={tr('Jusqu’à {0} G !', { 0: bands[bands.length - 1] })}
      status={tr('{0} G · palier {1}/{2} · cible {3} G', { 0: view.g.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), 1: view.k + 1, 2: bands.length, 3: view.band })}
      said={said}
      controls={
        <HoldButton onHold={hold} tone={zone ? '#00a862' : view.g > view.band ? '#ff3d57' : undefined}>
          {tr('Accélérer (maintenir)')}
        </HoldButton>
      }
    >
      <Stage decor="carrelage" cam={[0, 7.2, 8.2]} look={[0, 0.8, 0]} fov={44}>
        <Machine live={live} />
      </Stage>
    </JeuShell>
  )
}
