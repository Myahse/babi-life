import { useMemo } from 'react'
import * as THREE from 'three'
import { Human, NoShadows } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { BOX, Blocks, PLANE } from './ruePrincesse'
import { WavingFlag } from './flag'
import { t as tr } from '../../lib/i18n'

// The Palais de justice of the Plateau, on the boulevard Angoulvant, across
// from the cathedral: a long pale building of four floors set back behind
// its forecourt, a colonnade of tall slim pillars along its front holding a
// wide frieze with its name, the steps up to the doors in the middle, the
// flag on its roof; bands of dark windows between the pillars. Sizes are
// the game's estimates. Frame: +z toward the boulevard.

type Block = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

const stone = new THREE.MeshLambertMaterial({ color: '#e8e2d4' })
const dark = new THREE.MeshLambertMaterial({ color: '#2f3640' })
const bronze = new THREE.MeshLambertMaterial({ color: '#7d6a3e' })
const paving = new THREE.MeshLambertMaterial({ color: '#cfc8bb', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const lawn = new THREE.MeshLambertMaterial({ color: '#4e9a3f', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
const hedge = new THREE.MeshLambertMaterial({ color: '#3f7f34' })

const W = 27 // half the building's length
const D = 11 // half its depth
const H = 17.5
const FRONT = D // the facade's z
const FORECOURT = 14 // from the facade to the gate on the boulevard

/** The name across the frieze, carved. */
function frieze() {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 96
  const g = c.getContext('2d')!
  g.fillStyle = '#ddd6c6'
  g.fillRect(0, 0, 1024, 96)
  g.fillStyle = '#4a4336'
  g.font = 'bold 46px serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(tr('PALAIS DE JUSTICE'), 512, 50)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return new THREE.MeshLambertMaterial({ map: t })
}

export function PalaisJustice({ night }: { night: boolean }) {
  const sign = useMemo(frieze, [])
  const blocks = useMemo(() => {
    const st: Block[] = []
    const dk: Block[] = []
    // The body, on a plinth; the dark window bands of its four floors on every side.
    st.push({ p: [0, 0.4, 0], s: [W * 2 + 2, 0.8, D * 2 + 2] })
    st.push({ p: [0, H / 2 + 0.8, 0], s: [W * 2, H, D * 2] })
    for (let f = 0; f < 4; f++) {
      const y = 2.6 + f * 4.1
      dk.push({ p: [0, y, FRONT + 0.06], s: [W * 2 - 2, 1.8, 0.1] }, { p: [0, y, -FRONT - 0.06], s: [W * 2 - 2, 1.8, 0.1] })
      dk.push({ p: [W + 0.06, y, 0], s: [0.1, 1.8, D * 2 - 2] }, { p: [-W - 0.06, y, 0], s: [0.1, 1.8, D * 2 - 2] })
    }
    // The colonnade: slim pillars a little ahead of the facade, the frieze they hold, the roof slab over it.
    for (let x = -W + 2; x <= W - 2 + 0.01; x += 4) st.push({ p: [x, (H + 0.8) / 2, FRONT + 2.4], s: [0.7, H + 0.8, 0.7] })
    st.push({ p: [0, H + 1.6, FRONT + 1.4], s: [W * 2 + 1, 1.6, 3.6] })
    st.push({ p: [0, H + 0.9, 0], s: [W * 2 + 1, 0.2, D * 2 + 4.8] })
    // The steps up to the doors in the middle, the doors in bronze.
    for (let i = 0; i < 5; i++) st.push({ p: [0, 0.2 + i * 0.3, FRONT + 5.2 - i * 0.6], s: [14 - i * 0.6, 0.3, 1.2 + i * 0.6] })
    dk.push({ p: [0, 2.6, FRONT + 0.2], s: [6, 4.4, 0.3], c: '#7d6a3e' })
    // The flag's pole on the roof, the lamps either side of the steps.
    dk.push({ p: [0, H + 6, 0], s: [0.2, 9, 0.2], c: '#8a8f96' })
    for (const x of [-9, 9]) dk.push({ p: [x, 2, FRONT + 6], s: [0.2, 4, 0.2], c: '#8a8f96' }, { p: [x, 4.2, FRONT + 6], s: [0.7, 0.5, 0.7], c: night ? '#fff1c2' : '#e9ecef' })
    // The forecourt's hedges along the sides, the gate's pillars on the boulevard.
    for (const x of [-W - 1, W + 1]) st.push({ p: [x, 0.6, FRONT + FORECOURT / 2 + 1], s: [1, 1.2, FORECOURT - 2], c: '#3f7f34' })
    for (const x of [-7, 7]) st.push({ p: [x, 1.4, FRONT + FORECOURT + 1], s: [1.2, 2.8, 1.2] })
    return { st, dk }
  }, [night])
  // On the steps and the forecourt: lawyers in their robes, a gendarme at the gate, people waiting.
  const people = useMemo(() => {
    const r = rng('palais-justice')
    const one = (p: [number, number, number], ry: number, pose: 'idle' | 'talk' | 'phone' | 'busy' | 'walk', outfit?: string) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      const look = randomLook(gender, r)
      return { p, ry, pose, gender, look: outfit ? { ...look, outfit } : look, seed: r() * 100 }
    }
    return [
      one([-3, 1.5, FRONT + 4], 0.4, 'talk', 'soutane'), one([-1.6, 1.5, FRONT + 4.2], -2.6, 'talk', 'soutane'),
      one([5, 0, FRONT + 8], 2.8, 'phone', 'suit'), one([-10, 0, FRONT + 10], 0.3, 'idle'), one([-11.5, 0, FRONT + 10.4], -1.9, 'talk'),
      one([8.5, 0, FRONT + FORECOURT - 0.5], Math.PI, 'busy', 'gendarme'),
    ]
  }, [])
  return (
    <group>
      {/* The forecourt: paving to the boulevard, lawns either side of the way in */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, FRONT + FORECOURT / 2 + 1]} scale={[W * 2 + 4, FORECOURT + 2, 1]} geometry={PLANE} material={lawn} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, FRONT + FORECOURT / 2 + 1]} scale={[16, FORECOURT + 2, 1]} geometry={PLANE} material={paving} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, FRONT + 3.4]} scale={[W * 2 + 4, 5, 1]} geometry={PLANE} material={paving} receiveShadow />
      <Blocks at={blocks.st} material={stone} color />
      <Blocks at={blocks.dk} material={dark} color />
      <mesh position={[0, H + 1.6, FRONT + 3.22]} scale={[W * 2 - 4, 1.3, 1]} geometry={PLANE} material={sign} />
      <mesh position={[0, 2.6, FRONT + 0.36]} scale={[5.6, 4, 1]} geometry={PLANE} material={bronze} />
      {/* The flag on its pole, rippling */}
      <group position={[0, H + 1.5, 0]}>
        <WavingFlag height={9} w={3} pole={false} seed={2} />
      </group>
      <mesh position={[W + 1, 1.3, FRONT + FORECOURT / 2 + 1]} scale={[1, 0.1, 1]} geometry={BOX} material={hedge} visible={false} />
      <NoShadows>
        {people.map((g, i) => (
          <group key={i} position={g.p} rotation={[0, g.ry, 0]}>
            <Human look={g.look} gender={g.gender} pose={g.pose} seed={g.seed} />
          </group>
        ))}
      </NoShadows>
    </group>
  )
}

/** What a visitor can't walk through: the building and the gate's pillars (its frame). */
export const PALAIS_SOLID = [
  { x: 0, z: 0, hw: W + 1, hd: D + 1, rot: 0, top: H },
  { x: -7, z: FRONT + FORECOURT + 1, hw: 0.6, hd: 0.6, rot: 0, top: 2.8 },
  { x: 7, z: FRONT + FORECOURT + 1, hw: 0.6, hd: 0.6, rot: 0, top: 2.8 },
]
