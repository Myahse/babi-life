import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import type { Look } from '../../lib/types'
import { api } from '../../lib/api'
import { rng } from '../themes'
import { BOX, Blocks, PLANE } from './ruePrincesse'
import { WavingFlag } from './flag'
import { t as tr } from '../../lib/i18n'

// The Palais présidentiel of the Plateau, on the boulevard by the lagoon: a
// long white palace of two floors behind its lawns and its gate, a columned
// porch in the middle under the flag, palms along the drive, the guards at
// the gate. Those in office (politics: the president, the ministers, the
// deputies) stand on its steps and its forecourt, with their name and title
// over them: that's where they sit. Frame: +z toward the boulevard.

type Block = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

const white = new THREE.MeshLambertMaterial({ color: '#f6f3ec' })
const dark = new THREE.MeshLambertMaterial({ color: '#2b3038' })
const gold = new THREE.MeshLambertMaterial({ color: '#c9a227' })
const paving = new THREE.MeshLambertMaterial({ color: '#d8d2c4', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const lawn = new THREE.MeshLambertMaterial({ color: '#4e9a3f', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
const palmLeaf = new THREE.MeshLambertMaterial({ color: '#2f7a3a', side: THREE.DoubleSide })

const W = 30 // half the palace's length
const D = 12 // half its depth
const H = 11
const FRONT = D
const FORECOURT = 26 // from the facade to the gate on the boulevard

/** The seal over the porch. */
function seal() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#f6f3ec'
  g.fillRect(0, 0, 256, 256)
  g.fillStyle = '#c9a227'
  g.beginPath()
  g.arc(128, 128, 100, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#f6f3ec'
  g.beginPath()
  g.arc(128, 128, 84, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#2b3038'
  g.font = 'bold 30px serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(tr('PRÉSIDENCE'), 128, 112)
  g.font = 'bold 22px serif'
  g.fillText(tr('DE LA RÉPUBLIQUE'), 128, 148)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshLambertMaterial({ map: t })
}

export function Presidence({ night }: { night: boolean }) {
  const crest = useMemo(seal, [])
  const blocks = useMemo(() => {
    const wh: Block[] = []
    const dk: Block[] = []
    // The plinth and the body: a long white block, its two floors of dark windows on every side.
    wh.push({ p: [0, 0.5, 0], s: [W * 2 + 3, 1, D * 2 + 3] })
    wh.push({ p: [0, H / 2 + 1, 0], s: [W * 2, H, D * 2] })
    for (const y of [4, 8.6]) {
      for (let x = -W + 3; x <= W - 3 + 0.01; x += 3) {
        if (Math.abs(x) < 7) continue // the porch
        dk.push({ p: [x, y, FRONT + 0.06], s: [1.6, 2.2, 0.1] }, { p: [x, y, -FRONT - 0.06], s: [1.6, 2.2, 0.1] })
      }
      for (let z = -D + 3; z <= D - 3 + 0.01; z += 3) dk.push({ p: [W + 0.06, y, z], s: [0.1, 2.2, 1.6] }, { p: [-W - 0.06, y, z], s: [0.1, 2.2, 1.6] })
    }
    // The porch: six columns ahead of the facade, their entablature, the wide steps up to the bronze doors.
    for (const x of [-6, -3.6, -1.2, 1.2, 3.6, 6]) wh.push({ p: [x, (H + 1) / 2, FRONT + 4], s: [0.8, H + 1, 0.8] })
    wh.push({ p: [0, H + 1.9, FRONT + 2.4], s: [15.5, 1.8, 5.2] })
    wh.push({ p: [0, H + 1.4, 0], s: [W * 2 + 1, 0.8, D * 2 + 1] })
    for (let i = 0; i < 6; i++) wh.push({ p: [0, 0.2 + i * 0.28, FRONT + 8 - i * 0.6], s: [16 - i * 0.5, 0.28, 1.2 + i * 0.6] })
    dk.push({ p: [0, 3.4, FRONT + 0.2], s: [5.2, 5.2, 0.3], c: '#6f5a2a' })
    // The flag's pole on the roof, lamps along the drive, the gate's pillars and railings on the boulevard.
    dk.push({ p: [0, H + 7, 0], s: [0.25, 11, 0.25], c: '#9aa0a6' })
    for (const x of [-10, 10]) for (const z of [FRONT + 12, FRONT + 20]) dk.push({ p: [x, 2.2, z], s: [0.2, 4.4, 0.2], c: '#9aa0a6' }, { p: [x, 4.6, z], s: [0.7, 0.5, 0.7], c: night ? '#fff1c2' : '#e9ecef' })
    for (const x of [-7.5, 7.5]) wh.push({ p: [x, 1.8, FRONT + FORECOURT + 0.5], s: [1.4, 3.6, 1.4] })
    for (const x of [-W - 1, W + 1]) dk.push({ p: [(x + (x > 0 ? 7.5 : -7.5)) / 2, 1, FRONT + FORECOURT + 0.5], s: [Math.abs(x) - 7.5 - 0.7, 2, 0.15], c: '#2b3038' })
    for (const z of [FRONT + 2, FRONT + FORECOURT - 2]) dk.push({ p: [-W - 1, 1, (z + (z === FRONT + 2 ? FRONT + FORECOURT - 2 : FRONT + 2)) / 2], s: [0.15, 2, FORECOURT - 4], c: '#2b3038' }, { p: [W + 1, 1, (z + (z === FRONT + 2 ? FRONT + FORECOURT - 2 : FRONT + 2)) / 2], s: [0.15, 2, FORECOURT - 4], c: '#2b3038' })
    return { wh, dk }
  }, [night])
  // The guards at the gate, a gardener on the lawn.
  const people = useMemo(() => {
    const r = rng('presidence')
    const one = (p: [number, number, number], ry: number, pose: Pose, outfit?: string) => {
      const gender: 'femme' | 'homme' = r() < 0.3 ? 'femme' : 'homme'
      const look = randomLook(gender, r)
      return { p, ry, pose, gender, look: outfit ? { ...look, outfit } : look, seed: r() * 100 }
    }
    return [one([-9.2, 0, FRONT + FORECOURT - 1], Math.PI, 'idle', 'gendarme'), one([9.2, 0, FRONT + FORECOURT - 1], Math.PI, 'idle', 'gendarme'), one([-20, 0, FRONT + 10], 0.6, 'busy')]
  }, [])
  const palms = useMemo(() => [-16, 16].flatMap((x) => [FRONT + 8, FRONT + 14, FRONT + 20].map((z) => [x, z] as [number, number])), [])
  return (
    <group>
      {/* The grounds: lawns either side of the paved drive up to the steps, a strip of paving along the facade */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, FRONT + FORECOURT / 2]} scale={[W * 2 + 4, FORECOURT + 1, 1]} geometry={PLANE} material={lawn} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, FRONT + FORECOURT / 2 + 1]} scale={[13, FORECOURT, 1]} geometry={PLANE} material={paving} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, FRONT + 5.5]} scale={[W * 2 + 2, 9, 1]} geometry={PLANE} material={paving} receiveShadow />
      <Blocks at={blocks.wh} material={white} color />
      <Blocks at={blocks.dk} material={dark} color />
      <mesh position={[0, H + 1.9, FRONT + 5.02]} scale={[3.2, 1.6, 1]} geometry={PLANE} material={crest} />
      <mesh position={[0, 3.4, FRONT + 0.36]} scale={[4.6, 4.8, 1]} geometry={PLANE} material={gold} />
      {/* The flag on its pole, rippling */}
      <group position={[0, H + 1.5, 0]}>
        <WavingFlag height={11} w={3.2} pole={false} seed={5} />
      </group>
      {palms.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 3.5, 0]} scale={[0.4, 7, 0.4]} geometry={BOX} material={dark} />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <mesh key={k} position={[Math.cos((k * Math.PI) / 3) * 1.4, 7.1, Math.sin((k * Math.PI) / 3) * 1.4]} rotation={[0.5, (-k * Math.PI) / 3, 0]} scale={[0.5, 0.08, 3]} geometry={BOX} material={palmLeaf} />
          ))}
        </group>
      ))}
      <NoShadows>
        {people.map((g, i) => (
          <group key={i} position={g.p} rotation={[0, g.ry, 0]}>
            <Human look={g.look} gender={g.gender} pose={g.pose} seed={g.seed} />
          </group>
        ))}
        <Government />
      </NoShadows>
    </group>
  )
}

/** Where each office stands: the president at the top of the steps, the ministers on the terrace, the deputies on the drive. */
function seatOf(office: string, i: number): { p: [number, number, number]; ry: number; pose: Pose } {
  if (office === 'president') return { p: [0, 1.75, FRONT + 5.6], ry: 0, pose: 'wave' }
  if (office.startsWith('ministre:')) return { p: [-10.5 + (i % 8) * 3, 0.1, FRONT + 9.5], ry: 0, pose: i % 3 === 0 ? 'phone' : 'talk' }
  const k = i % 14
  const side = k % 2 === 0 ? -1 : 1
  return { p: [side * (8 + Math.floor(k / 2) * 0.4), 0.05, FRONT + 13 + Math.floor(k / 2) * 2.2], ry: side * 0.9, pose: k % 3 === 1 ? 'idle' : 'talk' }
}

type Seated = { office: string; label: string; name: string; gender: 'femme' | 'homme'; look: Look }

/** Those in office now, standing where they sit (politics: GET /politics/government), looked up again now and then. */
function Government() {
  const [list, setList] = useState<Seated[]>([])
  useEffect(() => {
    let gone = false
    const load = () =>
      api
        .government()
        .then((r) => !gone && setList(r.holders.filter((h) => !h.office.startsWith('maire:')).map((h) => ({ office: h.office, label: h.label, name: h.name, gender: h.gender, look: h.look }))))
        .catch(() => undefined)
    void load()
    const t = setInterval(load, 5 * 60 * 1000)
    return () => {
      gone = true
      clearInterval(t)
    }
  }, [])
  let ministers = 0
  let deputies = 0
  return (
    <>
      {list.map((h) => {
        const seat = seatOf(h.office, h.office === 'president' ? 0 : h.office.startsWith('ministre:') ? ministers++ : deputies++)
        return (
          <group key={h.office} position={seat.p} rotation={[0, seat.ry, 0]}>
            <Human look={h.look} gender={h.gender} pose={seat.pose} seed={h.office.length} />
            <Html position={[0, 2.35, 0]} center zIndexRange={[25, 0]}>
              <div className="pointer-events-none rounded-md bg-[#1b1b2f]/85 px-1.5 py-0.5 text-center text-[10px] leading-tight font-extrabold whitespace-nowrap text-white">
                <div>{h.name}</div>
                <div className="text-[#ffd36e]">{h.label}</div>
              </div>
            </Html>
          </group>
        )
      })}
    </>
  )
}

/** What a visitor can't walk through: the palace and the gate's pillars (its frame). */
export const PRESIDENCE_SOLID = [
  { x: 0, z: 0, hw: W + 1.5, hd: D + 1.5, rot: 0, top: H },
  { x: -7.5, z: FRONT + FORECOURT + 0.5, hw: 0.7, hd: 0.7, rot: 0, top: 3.6 },
  { x: 7.5, z: FRONT + FORECOURT + 0.5, hw: 0.7, hd: 0.7, rot: 0, top: 3.6 },
]
