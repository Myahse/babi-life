import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, type Pose } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'
import { StaticMerge } from '../world3d/staticMerge'
import { Arc, Line } from './marks'
import { grassMaterial, Net, turf } from './looks'
import type { Game } from './game'
import { t as tr } from '../lib/i18n'

// The console's eleven-a-side ground (game.ts FIELDS[11]): a lined pitch in
// mown stripes inside the running track, two goals with their nets, the
// corner flags, the boards round the pitch with the game's own brands, and
// the stands in orange, white and green, in rows of seats, packed with people
// who sway and jump up for a goal; the giant screens with the score; four
// floodlight towers; and the referee in black, following the play. The near
// stand is left low so the camera sees over it.

const BOX = new THREE.BoxGeometry(1, 1, 1)
const flat = (color: string) => new THREE.MeshLambertMaterial({ color })
const white = flat('#f8f9fa')

/** The boards' brands, all the game's own. */
const BRANDS: [string, string, string][] = [
  ['WAYE', '#1d4ed8', '#ffffff'],
  ['GBAIRAI', '#7048e8', '#ffffff'],
  ['TIKITOKO', '#141416', '#ff4d8d'],
  ['BABIGRAM', '#e8590c', '#ffffff'],
  ['GOLVO', '#2b8a3e', '#ffffff'],
  [tr('BABI BURGER'), '#c92a2a', '#ffd43b'],
  ['BET225', '#0b7285', '#ffffff'],
  ['PARISFOOT', '#ffd43b', '#141416'],
]

function boardTexture() {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 64
  const g = c.getContext('2d')!
  BRANDS.forEach(([name, bg, fg], i) => {
    const x = i * 128
    g.fillStyle = bg
    g.fillRect(x, 0, 128, 64)
    g.fillStyle = fg
    g.font = '800 24px sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(name, x + 64, 33, 120)
  })
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** The pitch, its lines and the track round it. */
function Pitch11({ g }: { g: Game }) {
  const F = g.field
  // The grass's blades (looks.tsx), the mown stripes lighter.
  const grass = grassMaterial('#45a451')
  const stripe = grassMaterial('#52b35e')
  const track = useMemo(() => flat('#b5553a'), [])
  const apron = useMemo(() => flat('#7a8a6a'), [])
  const [bx, bz] = F.box
  const six: [number, number] = [bx * 0.37, F.mouth + 5]
  const stripes = Math.round((F.x * 2) / 7)
  const w = (F.x * 2) / stripes
  const turfs = useMemo(() => ({ all: turf(F.x * 2 + 8, F.z * 2 + 7, 0, 0, 5), stripes: [...Array(stripes)].map((_, i) => (i % 2 ? null : turf(w, F.z * 2, -F.x + (i + 0.5) * w, 0, 5))) }), [F, stripes, w])
  return (
    <group>
      <mesh geometry={BOX} material={apron} position={[0, -0.06, 0]} scale={[F.x * 2 + 60, 0.1, F.z * 2 + 60]} receiveShadow />
      <mesh geometry={BOX} material={track} position={[0, -0.02, 0]} scale={[F.x * 2 + 22, 0.04, F.z * 2 + 18]} receiveShadow />
      <mesh geometry={turfs.all} material={grass} position={[0, 0.03, 0]} receiveShadow />
      {turfs.stripes.map((t, i) => t && <mesh key={i} geometry={t} material={stripe} position={[-F.x + (i + 0.5) * w, 0.033, 0]} receiveShadow />)}
      <Line a={[-F.x, -F.z]} b={[F.x, -F.z]} w={0.14} />
      <Line a={[-F.x, F.z]} b={[F.x, F.z]} w={0.14} />
      <Line a={[-F.x, -F.z]} b={[-F.x, F.z]} w={0.14} />
      <Line a={[F.x, -F.z]} b={[F.x, F.z]} w={0.14} />
      <Line a={[0, -F.z]} b={[0, F.z]} w={0.14} />
      <Arc at={[0, 0]} r={8} from={0} to={Math.PI * 2} />
      {[-1, 1].map((s) => (
        <group key={s}>
          {/* The box and the six-yard box, the spot, the arc */}
          <Line a={[s * F.x, -bz]} b={[s * (F.x - bx), -bz]} w={0.14} />
          <Line a={[s * F.x, bz]} b={[s * (F.x - bx), bz]} w={0.14} />
          <Line a={[s * (F.x - bx), -bz]} b={[s * (F.x - bx), bz]} w={0.14} />
          <Line a={[s * F.x, -six[1]]} b={[s * (F.x - six[0]), -six[1]]} w={0.14} />
          <Line a={[s * F.x, six[1]]} b={[s * (F.x - six[0]), six[1]]} w={0.14} />
          <Line a={[s * (F.x - six[0]), -six[1]]} b={[s * (F.x - six[0]), six[1]]} w={0.14} />
          <Arc at={[s * (F.x - F.spot), 0]} r={0.25} from={0} to={Math.PI * 2} />
          <Arc at={[s * (F.x - F.spot), 0]} r={8} from={s > 0 ? Math.PI * 0.73 : -Math.PI * 0.27} to={s > 0 ? Math.PI * 1.27 : Math.PI * 0.27} />
        </group>
      ))}
    </group>
  )
}

/** A goal: posts, bar and its net going back; the net gives where the ball hits it (looks.tsx Net). */
function Goals({ g }: { g: Game }) {
  const F = g.field
  return (
    <>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * F.x, 0, 0]}>
          {[-F.mouth, F.mouth].map((z) => (
            <mesh key={z} geometry={BOX} material={white} position={[0, F.bar / 2, z]} scale={[0.14, F.bar, 0.14]} castShadow />
          ))}
          <mesh geometry={BOX} material={white} position={[0, F.bar, 0]} scale={[0.14, 0.14, F.mouth * 2 + 0.14]} castShadow />
          <Net mouth={F.mouth} bar={F.bar} depth={2.2} dir={s as 1 | -1} ball={() => g.ball} at={s * F.x} />
        </group>
      ))}
      {/* The corner flags */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`} position={[sx * F.x, 0, sz * F.z]}>
            <mesh geometry={BOX} material={white} position={[0, 0.75, 0]} scale={[0.05, 1.5, 0.05]} />
            <mesh geometry={BOX} position={[0.22 * -sx, 1.35, 0]} scale={[0.42, 0.28, 0.02]}>
              <meshLambertMaterial color="#ff8200" />
            </mesh>
          </group>
        )),
      )}
    </>
  )
}

/** The boards along the touchlines and behind the goals. */
function Boards({ g }: { g: Game }) {
  const F = g.field
  const mat = useMemo(() => {
    const t = boardTexture()
    return new THREE.MeshBasicMaterial({ map: t })
  }, [])
  const runs: { at: [number, number]; len: number; rot: number }[] = [
    { at: [0, -F.z - 4], len: F.x * 2 + 8, rot: 0 },
    { at: [-F.x - 5, 0], len: F.z * 2, rot: Math.PI / 2 },
    { at: [F.x + 5, 0], len: F.z * 2, rot: -Math.PI / 2 },
  ]
  return (
    <>
      {runs.map((r, i) => {
        const m = mat.clone()
        m.map = mat.map!.clone()
        m.map.repeat.set(r.len / 64, 1)
        m.map.needsUpdate = true
        return (
          <mesh key={i} material={m} position={[r.at[0], 0.5, r.at[1]]} rotation={[0, r.rot, 0]}>
            <planeGeometry args={[r.len, 1]} />
          </mesh>
        )
      })}
    </>
  )
}

/** The stands: three tiers stepping up and back, each in three rows of seats (a row a step), in the national colours. */
function Stands({ g }: { g: Game }) {
  const F = g.field
  const blocks = useMemo(() => {
    const out: { p: [number, number, number]; s: [number, number, number]; c: string }[] = []
    const SEATS = ['#ff8200', '#f8f9fa', '#009e60']
    // Every other row a shade darker: the seats read as rows from afar.
    const SHADE: Record<string, string> = { '#ff8200': '#e06f00', '#f8f9fa': '#d9dde1', '#009e60': '#00854f' }
    // Far side (behind the play, as the camera sees it), the two ends; the near side only its lowest tier.
    const sides: { len: number; off: number; along: 'x' | 'z'; sign: number; tiers: number }[] = [
      { len: F.x * 2 + 26, off: F.z + 12, along: 'x', sign: -1, tiers: 3 },
      { len: F.z * 2 + 18, off: F.x + 13, along: 'z', sign: -1, tiers: 3 },
      { len: F.z * 2 + 18, off: F.x + 13, along: 'z', sign: 1, tiers: 3 },
      { len: F.x * 2 + 26, off: F.z + 12, along: 'x', sign: 1, tiers: 1 },
    ]
    for (const s of sides)
      for (let t = 0; t < s.tiers; t++) {
        const depth = 7
        const h = 2.2 + t * 3.2
        for (let row = 0; row < 3; row++) {
          // A step 2.1 m deep (the last one to the tier's back), 0.9 m above the one in front.
          const d0 = s.off + t * depth + row * 2.1
          const dd = row === 2 ? depth - 4.2 : 2.1
          const hh = h + row * 0.9
          const c = row % 2 ? SHADE[SEATS[t % 3]] : SEATS[t % 3]
          if (s.along === 'x') out.push({ p: [0, hh / 2, s.sign * (d0 + dd / 2)], s: [s.len, hh, dd], c })
          else out.push({ p: [s.sign * (d0 + dd / 2), hh / 2, 0], s: [dd, hh, s.len], c })
        }
      }
    return out
  }, [F])
  const mats = useMemo(() => new Map([...new Set(blocks.map((b) => b.c))].map((c) => [c, flat(c)])), [blocks])
  const roof = useMemo(() => flat('#adb5bd'), [])
  const pillar = useMemo(() => flat('#6c757d'), [])
  const back = F.z + 12 + 21
  return (
    <group>
      {blocks.map((b, i) => (
        <mesh key={i} geometry={BOX} material={mats.get(b.c)} position={b.p} scale={b.s} receiveShadow />
      ))}
      {/* The roofs over the main stand and the two ends, on their pillars */}
      <mesh geometry={BOX} material={roof} position={[0, 15.5, -(F.z + 12 + 12)]} scale={[F.x * 2 + 26, 0.5, 26]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={BOX} material={roof} position={[s * (F.x + 13 + 12), 15.5, 0]} scale={[26, 0.5, F.z * 2 + 18]} />
      ))}
      {[-0.8, -0.4, 0, 0.4, 0.8].map((k) => (
        <mesh key={k} geometry={BOX} material={pillar} position={[k * (F.x + 13), 7.75, -back]} scale={[0.6, 15.5, 0.6]} />
      ))}
      {[-1, 1].flatMap((s) =>
        [-0.7, 0, 0.7].map((k) => <mesh key={`${s}${k}`} geometry={BOX} material={pillar} position={[s * (F.x + 13 + 21), 7.75, k * (F.z + 9)]} scale={[0.6, 15.5, 0.6]} />),
      )}
    </group>
  )
}

/** The giant screens over the stands: the two sides' names, the score, the minutes played. */
function Screens({ g, teams }: { g: Game; teams?: [string, string] }) {
  const F = g.field
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 160
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  const shown = useRef('')
  useFrame(() => {
    const min = Math.max(0, Math.floor(g.time / 60))
    const sec = Math.max(0, Math.floor(g.time % 60))
    const key = `${g.score[0]}-${g.score[1]}-${min}-${sec}`
    if (key === shown.current) return
    shown.current = key
    const c = tex.image as HTMLCanvasElement
    const x = c.getContext('2d')!
    x.fillStyle = '#0b0d1a'
    x.fillRect(0, 0, 512, 160)
    x.fillStyle = '#ff8200'
    x.fillRect(0, 0, 512, 10)
    x.fillStyle = '#ffffff'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    const [a, b] = (teams ?? ['DOMICILE', tr('EXTÉRIEUR')]).map((n) => n.toUpperCase())
    x.font = '800 30px sans-serif'
    x.fillText(a, 128, 62, 210)
    x.fillText(b, 384, 62, 210)
    x.font = '900 64px sans-serif'
    x.fillText(`${g.score[0]} - ${g.score[1]}`, 256, 64)
    x.font = '700 28px sans-serif'
    x.fillStyle = '#ffd43b'
    x.fillText(`${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`, 256, 128)
    tex.needsUpdate = true
  })
  const frame = useMemo(() => flat('#212529'), [])
  const spots: { p: [number, number, number]; rot: number }[] = [
    { p: [0, 21, -(F.z + 12 + 24)], rot: 0 },
    { p: [-(F.x + 13 + 24), 21, 0], rot: Math.PI / 2 },
    { p: [F.x + 13 + 24, 21, 0], rot: -Math.PI / 2 },
  ]
  return (
    <>
      {spots.map((s, i) => (
        <group key={i} position={s.p} rotation={[0, s.rot, 0]}>
          <mesh geometry={BOX} material={frame} position={[0, 0, -0.35]} scale={[17, 5.8, 0.6]} />
          <mesh position={[0, 0, 0]}>
            <planeGeometry args={[16, 5]} />
            <meshBasicMaterial map={tex} toneMapped={false} />
          </mesh>
          <mesh geometry={BOX} material={frame} position={[0, -5.5, -0.35]} scale={[0.6, 6, 0.6]} />
        </group>
      ))}
    </>
  )
}

/** The people in the stands: one little block each, in the colour of their shirt; up on their feet for a goal. */
function People({ g }: { g: Game }) {
  const F = g.field
  const tiers = useRef<THREE.InstancedMesh[]>([])
  const seats = useMemo(() => {
    const r = rng('stade-crowd')
    const SHIRTS = ['#ff8200', '#ffffff', '#009e60', '#ff8200', '#1d4ed8', '#ffd43b', '#e03131', '#343a40', '#ff8200', '#ffffff']
    const out: { p: [number, number, number]; c: string; tier: number }[][] = [[], [], []]
    const rows = (len: number, off: number, along: 'x' | 'z', sign: number, maxTier: number) => {
      for (let t = 0; t < maxTier; t++) {
        const y = 2.2 + t * 3.2
        const off0 = off + t * 7
        for (let row = 0; row < 3; row++)
          for (let u = -len / 2 + 1; u < len / 2 - 1; u += 1.1 + r() * 0.6) {
            if (r() < 0.12) continue
            const d = sign * (off0 + 1 + row * 2.1)
            const p: [number, number, number] = along === 'x' ? [u, y + 0.4 + row * 0.9, d] : [d, y + 0.4 + row * 0.9, u]
            out[t].push({ p, c: SHIRTS[Math.floor(r() * SHIRTS.length)], tier: t })
          }
      }
    }
    rows(F.x * 2 + 22, F.z + 12, 'x', -1, 3)
    rows(F.z * 2 + 14, F.x + 13, 'z', -1, 3)
    rows(F.z * 2 + 14, F.x + 13, 'z', 1, 3)
    rows(F.x * 2 + 22, F.z + 12, 'x', 1, 1)
    return out
  }, [F])
  const geo = useMemo(() => new THREE.BoxGeometry(0.5, 0.8, 0.4), [])
  const headGeo = useMemo(() => new THREE.BoxGeometry(0.32, 0.32, 0.32).translate(0, 0.58, 0), [])
  // Each one sways on its feet at its own beat (in the shader: thousands of them, no work each frame).
  const time = useMemo(() => ({ value: 0 }), [])
  const sway = (m: THREE.Material) => {
    m.onBeforeCompile = (s) => {
      s.uniforms.uTime = time
      s.vertexShader = tr('uniform float uTime;\n') + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed.y += max(0.0, sin(uTime * 2.6 + float(gl_InstanceID) * 2.399)) * 0.07;')
    }
    return m
  }
  const mat = useMemo(() => sway(new THREE.MeshLambertMaterial({ color: '#ffffff' })), [])
  const headMat = useMemo(() => sway(new THREE.MeshLambertMaterial({ color: '#ffffff' })), [])
  const heads = useRef<THREE.InstancedMesh[]>([])
  const groups = useRef<THREE.Group[]>([])
  const built = useRef(false)
  useFrame((_, dt) => {
    time.value += dt
    if (!built.current) {
      built.current = true
      const o = new THREE.Object3D()
      const col = new THREE.Color()
      const SKIN = ['#4a2c1a', '#5c3a24', '#6e4024', '#3b2214', '#7a4a2c', '#2e1a10']
      seats.forEach((list, t) => {
        const m = tiers.current[t]
        const h = heads.current[t]
        if (!m || !h) return
        list.forEach((s, i) => {
          o.position.set(...s.p)
          o.updateMatrix()
          m.setMatrixAt(i, o.matrix)
          m.setColorAt(i, col.set(s.c))
          h.setMatrixAt(i, o.matrix)
          h.setColorAt(i, col.set(SKIN[i % SKIN.length]))
        })
        for (const x of [m, h]) {
          x.instanceMatrix.needsUpdate = true
          if (x.instanceColor) x.instanceColor.needsUpdate = true
        }
      })
    }
    // A goal: the stands jump.
    const last = g.moments[g.moments.length - 1]
    const up = last && last.kind === 'goal' && g.time - last.t < 3 ? Math.abs(Math.sin((g.time - last.t) * 9)) * 0.35 : 0
    groups.current.forEach((m, t) => m && (m.position.y = up * (t === 1 ? 0.8 : 1)))
  })
  return (
    <>
      {seats.map((list, t) => (
        <group key={t} ref={(x) => void (x && (groups.current[t] = x))}>
          <instancedMesh ref={(m) => void (m && (tiers.current[t] = m))} args={[geo, mat, Math.max(1, list.length)]} frustumCulled={false} />
          <instancedMesh ref={(m) => void (m && (heads.current[t] = m))} args={[headGeo, headMat, Math.max(1, list.length)]} frustumCulled={false} />
        </group>
      ))}
    </>
  )
}

/** The floodlight towers at the four corners. */
function Lights({ g }: { g: Game }) {
  const F = g.field
  const pole = useMemo(() => flat('#868e96'), [])
  const lamp = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff9db' }), [])
  return (
    <>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`} position={[sx * (F.x + 22), 0, sz * (F.z + 22)]}>
            <mesh geometry={BOX} material={pole} position={[0, 17, 0]} scale={[0.8, 34, 0.8]} />
            <mesh geometry={BOX} material={lamp} position={[-sx * 0.6, 34, -sz * 0.6]} rotation={[0, Math.atan2(-sx, -sz), 0]} scale={[5, 3, 0.4]} />
          </group>
        )),
      )}
    </>
  )
}

/** The whole ground, baked where it doesn't move. */
export function Stadium({ g, teams }: { g: Game; teams?: [string, string] }) {
  return (
    <>
      <StaticMerge>
        <Pitch11 g={g} />
        <Stands g={g} />
        <Lights g={g} />
      </StaticMerge>
      <Boards g={g} />
      <Goals g={g} />
      <People g={g} />
      <Screens g={g} teams={teams} />
    </>
  )
}

/** The referee: in black, a little behind the play, running when it moves. */
export function Referee({ g }: { g: Game }) {
  const root = useRef<THREE.Group>(null)
  const last = useRef({ x: g.ref.x, z: g.ref.z })
  const [view, setView] = useState<{ pose: Pose; speed: number }>({ pose: 'idle', speed: 0 })
  const look = useMemo(() => ({ ...randomLook('homme', rng('arbitre')), outfit: 'jersey', outfitColor: '#141416', accessory: 'none', hair: 'short' }), [])
  useFrame((_, dt) => {
    const r = root.current
    if (!r || !g.referee) return
    r.position.set(g.ref.x, 0, g.ref.z)
    r.rotation.y = g.ref.face
    const sp = Math.hypot(g.ref.x - last.current.x, g.ref.z - last.current.z) / Math.max(dt, 1e-3)
    last.current = { x: g.ref.x, z: g.ref.z }
    const pose: Pose = sp > 3.4 ? 'run' : sp > 0.45 ? 'walk' : 'idle'
    const speed = Math.round(sp)
    if (pose !== view.pose || speed !== view.speed) setView({ pose, speed })
  })
  if (!g.referee) return null
  return (
    <group ref={root}>
      <Human look={look} gender="homme" pose={view.pose} seed={77} speed={view.speed || undefined} />
    </group>
  )
}
