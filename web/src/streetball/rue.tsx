import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rng } from '../world3d/themes'
import { StaticMerge } from '../world3d/staticMerge'
import { Palm } from '../world3d/props'
import type { Game } from './game'
import { Net, paint } from './looks'
import { Quarter } from './scene'
import { t as tr } from '../lib/i18n'

// Le foot de rue's ground (game.ts Rules.street): a patch of beaten red
// earth between the houses, worn bare where everybody runs, an old concrete
// slab or two, the lines in chalk and old paint; low block walls round it
// (the ball comes back off them), the two little goals of welded iron set in
// gaps at the ends, a few bricks at their feet; palms, the electric pole,
// a stack of tyres; the quarter close round it. And the Gbê's fire behind
// the ball (le basket de rue's too).

const BOX = new THREE.BoxGeometry(1, 1, 1)
const flat = (color: string) => new THREE.MeshLambertMaterial({ color })

/** The ground: red earth, bare and darker where it's played on, a slab, pebbles, tufts by the walls, the chalk. */
function earth(hx: number, hz: number) {
  const W = 1024
  const H = Math.round((W * hz) / hx)
  return paint(`rue-earth${hx}x${hz}`, W, H, (g) => {
    const r = rng('rue-earth')
    const k = W / (hx * 2)
    // World (x, z) to the canvas.
    const at = (x: number, z: number): [number, number] => [(x + hx) * k, (z + hz) * k]
    g.fillStyle = '#b36a3f'
    g.fillRect(0, 0, W, H)
    for (let i = 0; i < 60000; i++) {
      const v = r()
      g.fillStyle = v < 0.5 ? 'rgba(90,40,20,0.10)' : v < 0.85 ? 'rgba(235,170,120,0.10)' : 'rgba(60,30,15,0.18)'
      g.fillRect(r() * W, r() * H, 2, 2)
    }
    const blot = (x: number, z: number, rad: number, color: string) => {
      const [cx, cy] = at(x, z)
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, rad * k)
      grad.addColorStop(0, color)
      grad.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'))
      g.fillStyle = grad
      g.fillRect(cx - rad * k, cy - rad * k, rad * k * 2, rad * k * 2)
    }
    // Lighter dust, then bare and dark where it's played on: the middle and the goalmouths.
    for (let i = 0; i < 14; i++) blot((r() - 0.5) * hx * 2, (r() - 0.5) * hz * 2, 1.5 + r() * 3, 'rgba(214,150,100,0.35)')
    blot(0, 0, 4.5, 'rgba(110,55,30,0.35)')
    for (const s of [-1, 1]) {
      blot(s * (hx - 2.2), 0, 2.6, 'rgba(100,50,28,0.45)')
      blot(s * (hx - 5), (r() - 0.5) * 4, 2.5, 'rgba(110,55,30,0.25)')
    }
    // A puddle's dried mark.
    blot(-hx * 0.35, hz * 0.45, 1.2, 'rgba(70,40,30,0.35)')
    // The old concrete slabs, cracked, their edges broken.
    for (const [x, z, w, d] of [
      [hx * 0.28, -hz * 0.42, 3.2, 2.4],
      [-hx * 0.55, -hz * 0.1, 2.2, 1.6],
    ]) {
      const [cx, cy] = at(x, z)
      g.fillStyle = '#8f8a84'
      g.beginPath()
      g.moveTo(cx - (w / 2) * k, cy - (d / 2) * k)
      for (let e = 0; e < 4; e++) {
        const [ex, ey] = [[1, -1], [1, 1], [-1, 1], [-1, -1]][e]
        g.lineTo(cx + ((ex * w) / 2) * k + (r() - 0.5) * 10, cy + ((ey * d) / 2) * k + (r() - 0.5) * 10)
      }
      g.closePath()
      g.fill()
      for (let i = 0; i < 900; i++) {
        g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'
        g.fillRect(cx + (r() - 0.5) * w * k, cy + (r() - 0.5) * d * k, 2, 2)
      }
      g.strokeStyle = 'rgba(40,35,30,0.7)'
      g.lineWidth = 1.5
      g.beginPath()
      g.moveTo(cx - (w / 2) * k * 0.8, cy)
      g.lineTo(cx, cy + (r() - 0.5) * d * k * 0.5)
      g.lineTo(cx + (w / 2) * k * 0.7, cy - d * k * 0.2)
      g.stroke()
    }
    // Pebbles and bits of brick.
    for (let i = 0; i < 260; i++) {
      g.fillStyle = r() < 0.6 ? '#7d746b' : '#9b4a2a'
      const s = 2 + r() * 3
      g.fillRect(r() * W, r() * H, s, s * 0.8)
    }
    // Tufts of grass along the walls, where nobody runs.
    for (let i = 0; i < 70; i++) {
      const edge = r() < 0.5
      const x = edge ? (r() - 0.5) * hx * 2 : (r() < 0.5 ? -1 : 1) * (hx - 0.2 - r() * 0.6)
      const z = edge ? (r() < 0.5 ? -1 : 1) * (hz - 0.2 - r() * 0.7) : (r() - 0.5) * hz * 2
      const [cx, cy] = at(x, z)
      for (let j = 0; j < 14; j++) {
        g.fillStyle = r() < 0.5 ? '#6f8f3a' : '#4f7a2e'
        g.fillRect(cx + (r() - 0.5) * 18, cy + (r() - 0.5) * 12, 2, 4)
      }
    }
    // The lines: the middle one in old white paint, worn through; the spot; the goal areas drawn in chalk, by hand.
    g.lineCap = 'round'
    const chalk = (pts: [number, number][], alpha: number, wd: number) => {
      g.strokeStyle = `rgba(245,240,230,${alpha})`
      g.lineWidth = wd
      g.beginPath()
      pts.forEach(([x, z], i) => {
        const [cx, cy] = at(x, z)
        if (i) g.lineTo(cx + (r() - 0.5) * 3, cy + (r() - 0.5) * 3)
        else g.moveTo(cx, cy)
      })
      g.stroke()
    }
    for (let z = -hz + 0.6; z < hz - 0.6; z += 0.5) if (r() < 0.75) chalk([[0, z], [0.02, z + 0.45]], 0.55 + r() * 0.25, 4)
    const [sx, sy] = at(0, 0)
    g.fillStyle = 'rgba(245,240,230,0.7)'
    g.beginPath()
    g.arc(sx, sy, 0.18 * k, 0, Math.PI * 2)
    g.fill()
    for (const s of [-1, 1]) {
      const arc: [number, number][] = []
      for (let a = -Math.PI / 2; a <= Math.PI / 2 + 0.01; a += 0.15) arc.push([s * (hx - 1.2 - Math.cos(a) * 2.6), Math.sin(a) * 3])
      chalk(arc, 0.5, 3)
      // A cross in chalk for the spot.
      chalk([[s * (hx - 4.2) - 0.15, -0.15], [s * (hx - 4.2) + 0.15, 0.15]], 0.6, 3)
      chalk([[s * (hx - 4.2) - 0.15, 0.15], [s * (hx - 4.2) + 0.15, -0.15]], 0.6, 3)
    }
  })
}

/** The earth round the ground (the street outside the walls): red dust, pebbles, tyre tracks; it repeats. */
function dust() {
  return paint(
    'rue-dust',
    256,
    256,
    (g) => {
      const r = rng('rue-dust')
      g.fillStyle = '#a65f39'
      g.fillRect(0, 0, 256, 256)
      for (let i = 0; i < 9000; i++) {
        const v = r()
        g.fillStyle = v < 0.5 ? 'rgba(80,35,15,0.14)' : v < 0.9 ? 'rgba(230,165,115,0.12)' : 'rgba(110,105,100,0.5)'
        g.fillRect(r() * 256, r() * 256, 2, 2)
      }
      g.strokeStyle = 'rgba(70,35,20,0.18)'
      g.lineWidth = 6
      for (const y of [70, 92]) {
        g.beginPath()
        g.moveTo(0, y)
        g.bezierCurveTo(90, y + 12, 170, y - 12, 256, y)
        g.stroke()
      }
    },
    [24, 20],
  )
}

/** The block walls: grey blocks and their mortar, a band of old paint, the quarter's words painted on. */
function blocks(key: string, len: number, h: number, words: string[], band: string) {
  const W = 1024
  const H = Math.max(32, Math.round((W * h) / len))
  return paint(`rue-wall${key}`, W, H, (g) => {
    const r = rng(`rue-wall${key}`)
    const k = W / len
    g.fillStyle = '#a7a39b'
    g.fillRect(0, 0, W, H)
    // The blocks (40 by 20), each a little different.
    for (let y = 0, row = 0; y < H; y += 0.2 * k, row++)
      for (let x = row % 2 ? -0.2 * k : 0; x < W; x += 0.4 * k) {
        const v = 150 + Math.floor(r() * 30)
        g.fillStyle = `rgb(${v},${v - 3},${v - 10})`
        g.fillRect(x + 1, y + 1, 0.4 * k - 2, 0.2 * k - 2)
      }
    // The paint, over the bottom part, flaking.
    g.fillStyle = band
    g.globalAlpha = 0.85
    g.fillRect(0, H * 0.35, W, H * 0.65)
    g.globalAlpha = 1
    for (let i = 0; i < 160; i++) {
      g.fillStyle = 'rgba(170,165,155,0.9)'
      g.fillRect(r() * W, H * 0.35 + r() * H * 0.6, 3 + r() * 10, 2 + r() * 6)
    }
    // The red earth splashed up the foot by the rains.
    const foot = g.createLinearGradient(0, H * 0.7, 0, H)
    foot.addColorStop(0, 'rgba(150,70,35,0)')
    foot.addColorStop(1, 'rgba(150,70,35,0.6)')
    g.fillStyle = foot
    g.fillRect(0, H * 0.7, W, H * 0.3)
    // The words, in big painted letters.
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    words.forEach((w, i) => {
      g.font = tr("900 {0}px 'Baloo 2', Impact, sans-serif", { 0: Math.round(H * 0.42) })
      g.fillStyle = ['#ffd43b', '#ffffff', '#ff8200', '#69db7c'][i % 4]
      g.strokeStyle = 'rgba(20,20,20,0.6)'
      g.lineWidth = 4
      const x = ((i + 0.5) / words.length) * W + (r() - 0.5) * 60
      g.strokeText(w, x, H * 0.66, W / words.length - 30)
      g.fillText(w, x, H * 0.66, W / words.length - 30)
    })
  })
}

const iron = flat('#b23a1f')
const brick = flat('#a24a2a')
const pole = flat('#6b4a2e')
const tyre = flat('#1c1c1e')

/** A little goal of welded iron set in the gap of the end wall: red posts and bar, the net behind on its frame, bricks at its feet. */
function Cage({ g, s }: { g: Game; s: 1 | -1 }) {
  const { x, mouth, bar } = g.field
  return (
    <group position={[s * x, 0, 0]}>
      {[-mouth, mouth].map((z) => (
        <mesh key={z} geometry={BOX} material={iron} position={[0, bar / 2, z]} scale={[0.08, bar, 0.08]} castShadow />
      ))}
      <mesh geometry={BOX} material={iron} position={[0, bar, 0]} scale={[0.08, 0.08, mouth * 2 + 0.08]} castShadow />
      {[-mouth - 0.18, mouth + 0.18].map((z) => (
        <group key={z}>
          <mesh geometry={BOX} material={brick} position={[s * 0.08, 0.06, z]} scale={[0.4, 0.12, 0.2]} castShadow />
          <mesh geometry={BOX} material={brick} position={[s * 0.1, 0.18, z + 0.02]} scale={[0.38, 0.12, 0.19]} rotation={[0, 0.2, 0]} />
        </group>
      ))}
    </group>
  )
}

/** The street's ground, its walls and goals, the quarter round it. */
export function StreetGround({ g, seed }: { g: Game; seed: string }) {
  const F = g.field
  const [hx, hz] = [F.x + 0.12, F.z + 0.75]
  const mats = useMemo(
    () => ({
      earth: new THREE.MeshLambertMaterial({ map: earth(hx + 1.2, hz + 1.2) }),
      far: new THREE.MeshLambertMaterial({ map: blocks('far', hx * 2, 1.25, [tr('BABI FOOT'), tr('YOP CITY'), tr('ATTIÉKÉ 100 F'), tr('DIEU EST GRAND')], '#3d7ea6') }),
      near: new THREE.MeshLambertMaterial({ map: blocks('near', hx * 2, 0.45, ['', '', ''], '#c98a3b') }),
      end: new THREE.MeshLambertMaterial({ map: blocks('end', hz - F.mouth - 0.1, 1.05, [tr('GBÊ')], '#d6584a') }),
      dirt: new THREE.MeshLambertMaterial({ map: dust() }),
    }),
    [hx, hz, F.mouth],
  )
  const props = useMemo(() => {
    const r = rng(`rue-props${seed}`)
    return {
      palms: [
        [-hx * 0.6 + r() * 2, -hz - 3.2],
        [hx * 0.45 + r() * 2, -hz - 3.8],
        [hx + 3.5, hz * 0.4],
      ] as [number, number][],
      tyres: [-hx + 0.9, hz + 0.9] as [number, number],
    }
  }, [hx, hz, seed])
  const endLen = hz - F.mouth - 0.1
  return (
    <>
      <StaticMerge>
        {/* The earth all round, and the pitch's own */}
        <mesh geometry={BOX} material={mats.dirt} position={[0, -0.05, 0]} scale={[110, 0.1, 90]} receiveShadow />
        <mesh material={mats.earth} position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[(hx + 1.2) * 2, (hz + 1.2) * 2]} />
        </mesh>
        {/* The walls: the far one low enough to lean on, the near one a kerb (the camera looks over it), the ends either side of the goals */}
        <mesh geometry={BOX} material={mats.far} position={[0, 0.625, -hz - 0.1]} scale={[hx * 2 + 0.4, 1.25, 0.2]} castShadow receiveShadow />
        <mesh geometry={BOX} material={mats.near} position={[0, 0.225, hz + 0.1]} scale={[hx * 2 + 0.4, 0.45, 0.2]} receiveShadow />
        {[-1, 1].map((s) =>
          [-1, 1].map((side) => (
            <mesh key={`${s}${side}`} geometry={BOX} material={mats.end} position={[s * (hx + 0.1), 0.525, side * (F.mouth + 0.1 + endLen / 2)]} scale={[0.2, 1.05, endLen]} rotation={[0, 0, 0]} castShadow receiveShadow />
          )),
        )}
        <Cage g={g} s={-1} />
        <Cage g={g} s={1} />
        {/* The electric pole at the corner, a stack of old tyres, palms over the wall */}
        <mesh geometry={BOX} material={pole} position={[hx + 1.2, 3.5, -hz - 1]} scale={[0.22, 7, 0.22]} castShadow />
        <mesh geometry={BOX} material={pole} position={[hx + 1.2, 6.6, -hz - 1]} scale={[1.4, 0.12, 0.12]} />
        {[0, 1, 2].map((i) => (
          <mesh key={i} material={tyre} position={[props.tyres[0] + (i === 2 ? 0.25 : i * 0.5), 0.12 + (i === 2 ? 0.22 : 0), props.tyres[1] + 0.35]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[0.28, 0.11, 6, 12]} />
          </mesh>
        ))}
        {props.palms.map((p, i) => (
          <Palm key={i} p={[p[0], 0, p[1]]} h={5.5 + i} lean={0.12 + i * 0.05} />
        ))}
        <Quarter hx={hx + 0.5} hz={hz + 0.5} seed={seed} gap={3.2} />
      </StaticMerge>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * F.x, 0, 0]}>
          <Net mouth={F.mouth} bar={F.bar} depth={0.75} dir={s as 1 | -1} ball={() => g.ball} at={s * F.x} />
        </group>
      ))}
    </>
  )
}

/** The Gbê: fire behind the ball as it goes, for a second or so. */
export function GbeTrail({ g }: { g: Game }) {
  const N = 9
  const trail = useRef<THREE.Group>(null)
  const past = useRef<[number, number, number][]>([])
  const mat = useMemo(() => [...Array(N)].map((_, i) => new THREE.MeshBasicMaterial({ color: i < 3 ? '#fff3bf' : i < 6 ? '#ffa94d' : '#e8590c', transparent: true, opacity: 0.85 - i * 0.08, depthWrite: false })), [])
  useFrame(() => {
    const t = trail.current
    if (!t) return
    const b = g.ball
    // (Le basket de rue's: in the hands of the dunker flying in too, or on the shot.)
    const on = g.sport === 'basket' ? g.time - g.gbe < 1.6 && g.time - g.gbe > 0.05 : g.time - g.gbe < 1.4 && g.time - g.gbe > 0.12 && Math.hypot(b.vx, b.vz) > 5
    t.visible = on
    if (!on) {
      past.current = []
      return
    }
    past.current.unshift([b.x, b.y, b.z])
    past.current.length = Math.min(past.current.length, N * 2)
    t.children.forEach((c, i) => {
      const p = past.current[Math.min(i * 2, past.current.length - 1)]
      c.position.set(p[0], p[1], p[2])
      const s = 0.2 - i * 0.016
      c.scale.set(s, s, s)
    })
  })
  return (
    <group ref={trail} visible={false}>
      {mat.map((m, i) => (
        <mesh key={i} material={m}>
          <sphereGeometry args={[1, 8, 6]} />
        </mesh>
      ))}
    </group>
  )
}
