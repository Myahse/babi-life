import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { sceneDpr } from '../../lib/device'
import { haptic } from '../../lib/native'
import { sfx } from '../../lib/sfx'
import { t as tr, tx } from '../../lib/i18n'
import { aiShot, aimHit, cue, groupOf, left, newGame, placeCue, POCKETS, R, restore, score, shoot, snapshot, step, TABLE, type Game, type Snap } from '../../billard/pool'

// Le billard américain du maquis (backend game.BillardID): the 8-ball against a regular of the place,
// on the table at the back (billard/pool.ts plays it). The table seen from above, its long side up the
// phone; the player touches where to aim (the line and the ghost ball show where the cue ball meets the
// first ball), sets the power, « Tirer ». After a foul the cue ball is in hand: touched down where one wants.
// Won, the score is 70 and up; lost, 10 a ball of one's own pocketed.

const FOES = [
  { id: 'konan', name: 'Konan', skill: 0.35, label: tr('Konan, le serveur') },
  { id: 'bamba', name: 'Bamba', skill: 0.62, label: tr('Bamba, l’habitué') },
  { id: 'gaoussou', name: 'Gaoussou', skill: 0.88, label: tr('Gaoussou, le requin du billard') },
]
// The balls' colours (1–7 solids, 9–15 the same as stripes, the 8 black).
const COLOURS = ['#ffffff', '#f2c40f', '#1f4fc4', '#d62828', '#6a2c91', '#f07a1a', '#1d8a3a', '#7a1e1e', '#111111']
const colourOf = (n: number) => (n === 0 ? COLOURS[0] : COLOURS[n > 8 ? n - 8 : n])

/** A ball's look: its colour (all round, or as a band on white for a stripe) and its number in a white disc. */
function ballTexture(n: number) {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = n > 8 ? '#f4f1e8' : colourOf(n)
  g.fillRect(0, 0, 128, 64)
  if (n > 8) {
    g.fillStyle = colourOf(n)
    g.fillRect(0, 18, 128, 28)
  }
  if (n > 0) {
    for (const x of [32, 96]) {
      g.fillStyle = '#ffffff'
      g.beginPath()
      g.arc(x, 32, 11, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#111111'
      g.font = 'bold 14px sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(String(n), x, 33)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// The table's frame: the game's x along the phone's height (3D -z), its z across (3D x).
const to3 = (x: number, z: number): [number, number, number] => [z, R, -x]
const from3 = (p: THREE.Vector3) => ({ x: -p.z, z: p.x })

/** A canvas texture drawn once: the cloth's fuzz, the wood's grain. */
function paintTexture(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void, repeat: [number, number] = [1, 1]) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  paint(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(...repeat)
  return t
}
const cloth = () =>
  paintTexture(
    256,
    256,
    (g) => {
      g.fillStyle = '#167f4e'
      g.fillRect(0, 0, 256, 256)
      // The cloth's nap: thousands of specks a shade lighter or darker.
      for (let i = 0; i < 9000; i++) {
        const v = Math.random()
        g.fillStyle = v < 0.5 ? 'rgba(0,40,20,0.18)' : 'rgba(120,220,160,0.12)'
        g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random(), 1 + Math.random())
      }
    },
    [3, 6],
  )
const wood = (base: string) =>
  paintTexture(
    256,
    64,
    (g) => {
      g.fillStyle = base
      g.fillRect(0, 0, 256, 64)
      // The grain: long wavy lines, darker and lighter.
      for (let i = 0; i < 40; i++) {
        g.strokeStyle = i % 3 ? 'rgba(0,0,0,0.18)' : 'rgba(255,220,170,0.10)'
        g.lineWidth = 0.6 + Math.random() * 1.6
        g.beginPath()
        const y = Math.random() * 64
        g.moveTo(0, y)
        for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x / 30 + i) * 2.5)
        g.stroke()
      }
    },
    [4, 1],
  )

/** The cue: the blue-chalked tip, the white ferrule, the light maple shaft, the dark butt and its wrap; along its local -z from its tip at 0. */
function CueStick() {
  const parts: [number, number, number, string][] = [
    // [length, radius at the tip end, radius at the butt end, colour]
    [0.012, 0.0062, 0.0064, '#3f7fd6'],
    [0.028, 0.0064, 0.0066, '#f4f1e8'],
    [0.86, 0.0066, 0.0105, '#e3c48d'],
    [0.08, 0.0105, 0.011, '#1b1b1b'],
    [0.22, 0.011, 0.0125, '#2b2b2b'],
    [0.26, 0.0125, 0.0145, '#5a2410'],
    [0.012, 0.0145, 0.0145, '#111'],
  ]
  let z = 0
  return (
    <group>
      {parts.map(([len, r0, r1, c], i) => {
        const mid = z - len / 2
        z -= len
        return (
          <mesh key={i} position={[0, 0, mid]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[r0, r1, len, 14]} />
            <meshStandardMaterial color={c} roughness={i === 2 ? 0.45 : 0.3} metalness={0.05} />
          </mesh>
        )
      })}
    </group>
  )
}

function Table({ game, aim, power, onAim, onPlace, mine, low, struck }: {
  game: React.RefObject<Game>
  aim: React.RefObject<number>
  /** (A ref: the cue drawn back follows it without the table drawn again.) */
  power: React.RefObject<number>
  onAim: (a: number) => void
  onPlace: (x: number, z: number) => void
  mine: boolean
  /** The camera low behind the cue ball, along the aim (else the table from above). */
  low: boolean
  /** When the last shot was struck (performance.now()): the cue thrust through the ball. */
  struck?: React.RefObject<number>
}) {
  const balls = useRef<(THREE.Mesh | null)[]>([])
  const stick = useRef<THREE.Group>(null)
  const line = useRef<THREE.Mesh>(null)
  const ghost = useRef<THREE.Mesh>(null)
  // Where the ball hit goes, and the cue ball after it (without spin: at right angles).
  const objLine = useRef<THREE.Mesh>(null)
  const cueLine = useRef<THREE.Mesh>(null)
  const tray = useRef<(THREE.Mesh | null)[]>([])
  const { camera } = useThree()
  const camAt = useRef(new THREE.Vector3(0, 3.55, 0.3))
  const lookAt = useRef(new THREE.Vector3())
  const textures = useMemo(() => [...Array(16)].map((_, n) => ballTexture(n)), [])
  const sphere = useMemo(() => new THREE.SphereGeometry(R, 28, 20), [])
  const felt = useMemo(cloth, [])
  const rail = useMemo(() => wood('#5b2d12'), [])
  const floor = useMemo(() => wood('#3a2414'), [])
  // The balls going down: when each fell, from where, into which pocket (shown sinking a moment, then in the tray).
  const sunk = useRef(new Map<number, { t: number; x: number; z: number; px: number; pz: number }>())
  useFrame((_, dt) => {
    const g = game.current
    if (!g) return
    const now = performance.now()
    g.balls.forEach((b, i) => {
      const m = balls.current[i]
      if (!m) return
      if (b.in) {
        let s = sunk.current.get(i)
        if (!s) {
          const p = POCKETS.reduce((a, q) => (Math.hypot(q.x - b.x, q.z - b.z) < Math.hypot(a.x - b.x, a.z - b.z) ? q : a))
          s = { t: now, x: m.position.x, z: m.position.z, px: to3(p.x, p.z)[0], pz: to3(p.x, p.z)[2] }
          sunk.current.set(i, s)
        }
        // Into the mouth, then down the hole, a little smaller as it goes into the dark.
        const k = Math.min(1, (now - s.t) / 260)
        m.visible = k < 1
        m.position.set(s.x + (s.px - s.x) * Math.min(1, k * 1.6), R - k * k * R * 2.4, s.z + (s.pz - s.z) * Math.min(1, k * 1.6))
        m.scale.setScalar(1 - k * 0.35)
        return
      }
      if (sunk.current.delete(i)) m.scale.setScalar(1)
      m.visible = true
      m.position.set(...to3(b.x, b.z))
      // Rolling: turned about the axis across its way, by the way gone this frame.
      const v = Math.hypot(b.vx, b.vz)
      if (v > 0) m.rotateOnWorldAxis(new THREE.Vector3(-b.vx / v, 0, -b.vz / v).normalize(), (v / R) * Math.min(dt, 0.05))
    })
    // The balls down, lined up in the tray along the table's side, as they fell (once they've sunk).
    let k = 0
    g.balls.forEach((b, i) => {
      const m = tray.current[i]
      if (!m) return
      const s = sunk.current.get(i)
      m.visible = b.in && b.n !== 0 && (!s || now - s.t > 260)
      if (m.visible) m.position.set(TABLE.h / 2 + 0.27, -0.05, TABLE.w / 2 - 0.1 - k++ * (R * 2 + 0.006))
    })
    const c = cue(g)
    const show = mine && !g.moving && g.winner === null
    const a = aim.current ?? 0
    if (stick.current) {
      // The cue: drawn back as far as the power, thrust through the ball as it's struck, then put away.
      const since = (performance.now() - (struck?.current ?? -1e9)) / 1000
      const thrust = g.moving && since < 0.18
      stick.current.visible = (!g.moving || thrust) && g.winner === null
      if (!g.moving) stick.current.position.set(...to3(c.x, c.z))
      stick.current.rotation.set(0.06, Math.PI - a, 0)
      const back = 0.03 + (power.current ?? 0) * 0.26
      stick.current.children[0].position.z = thrust ? -back + Math.min(1, since / 0.06) * (back + 0.02) : -back
    }
    const hit = aimHit(g, a)
    if (line.current) {
      line.current.visible = show
      const [x0, , z0] = to3(c.x, c.z)
      const [x1, , z1] = to3(hit.x, hit.z)
      const len = Math.hypot(x1 - x0, z1 - z0)
      line.current.position.set((x0 + x1) / 2, R * 0.2, (z0 + z1) / 2)
      line.current.scale.set(1, 1, len)
      line.current.rotation.set(0, Math.atan2(x1 - x0, z1 - z0), 0)
    }
    if (ghost.current) {
      ghost.current.visible = show && !!hit.ball
      ghost.current.position.set(...to3(hit.x, hit.z))
    }
    // A line from a point (the table's x, z) along a way, so long.
    const ray = (m: THREE.Mesh | null, x: number, z: number, dx: number, dz: number, len: number) => {
      if (!m) return
      m.visible = show && !!hit.ball && len > 0.01
      const [x0, , z0] = to3(x, z)
      const [x1, , z1] = to3(x + dx * len, z + dz * len)
      m.position.set((x0 + x1) / 2, R * 0.2, (z0 + z1) / 2)
      m.scale.set(1, 1, len)
      m.rotation.set(0, Math.atan2(x1 - x0, z1 - z0), 0)
    }
    if (hit.ball && hit.obj && hit.cue) {
      ray(objLine.current, hit.ball.x, hit.ball.z, hit.obj.x, hit.obj.z, 0.35)
      ray(cueLine.current, hit.x, hit.z, hit.cue.x, hit.cue.z, 0.3 * hit.cue.k)
    } else {
      if (objLine.current) objLine.current.visible = false
      if (cueLine.current) cueLine.current.visible = false
    }
    // The camera: above the table; or low behind the cue ball along the aim, rising to follow it while it runs.
    const [cx, , cz] = to3(c.x, c.z)
    if (low && !g.moving) {
      const dx = Math.sin(a)
      const dz = -Math.cos(a)
      camAt.current.set(cx - dx * 0.75, 0.36, cz - dz * 0.75)
      lookAt.current.set(cx + dx * 0.6, 0, cz + dz * 0.6)
    } else if (low) {
      camAt.current.set(cx * 0.6, 1.25, cz * 0.6 + 1.1)
      lookAt.current.set(cx * 0.8, 0, cz * 0.8)
    } else {
      camAt.current.set(0, 3.55, 0.3)
      lookAt.current.set(0, 0, 0.02)
    }
    camera.position.lerp(camAt.current, low && g.moving ? 0.05 : 0.12)
    const want = new THREE.Matrix4().lookAt(camera.position, lookAt.current, camera.up)
    camera.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(want), 0.12)
  })
  // The top view: a tap aims straight at the point; a finger dragged turns the cue about the cue ball by the
  // way it moves round it (finer the further off it is), so the aim follows the finger without jumping.
  const drag = useRef<{ x: number; z: number; moved: number } | null>(null)
  const touch = (e: ThreeEvent<PointerEvent>) => {
    const g = game.current
    // (Only on one's own shot, the balls at rest.)
    if (!g || !mine) return
    const p = from3(e.point)
    if (g.inHand && e.type === 'pointerdown') return onPlace(p.x, p.z)
    // (In the 3D view the camera turns with the aim: a point touched would move under the finger and the aim
    // spin round. There, the finger dragged sideways turns the aim instead, below.)
    if (low || g.inHand) return
    const c = cue(g)
    if (e.type === 'pointerdown') {
      drag.current = { x: p.x, z: p.z, moved: 0 }
      return
    }
    const d = drag.current
    if (!d) return
    if (e.type === 'pointerup') {
      if (d.moved < 0.02) onAim(Math.atan2(p.z - c.z, p.x - c.x))
      drag.current = null
      return
    }
    const mx = p.x - d.x
    const mz = p.z - d.z
    const rx = d.x - c.x
    const rz = d.z - c.z
    const r = Math.hypot(rx, rz) || 1
    // The part of the move across the line to the cue ball turns the cue; along it, nothing.
    const across = (mx * -rz + mz * rx) / r
    d.moved += Math.hypot(mx, mz)
    d.x = p.x
    d.z = p.z
    if (d.moved < 0.02) return
    onAim((aim.current ?? 0) + across / Math.max(r, 0.5))
  }
  // The 3D view: dragging across the screen turns the aim about the cue ball (slower near the start of a drag,
  // for the fine aim), as one walks round the table.
  const { gl } = useThree()
  const mineRef = useRef(mine)
  mineRef.current = mine
  // (Held in refs: the drag carries on across the redraws each turn of the aim makes.)
  const aimTo = useRef(onAim)
  aimTo.current = onAim
  useEffect(() => {
    if (!low) return
    const el = gl.domElement
    let x: number | null = null
    const down = (e: PointerEvent) => void (x = e.clientX)
    const move = (e: PointerEvent) => {
      const g = game.current
      if (x === null || !g || !mineRef.current || g.inHand) return
      const dx = e.clientX - x
      x = e.clientX
      aimTo.current((aim.current ?? 0) + dx * (Math.abs(dx) < 4 ? 0.0012 : 0.004))
    }
    const up = () => void (x = null)
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [low, gl, aim, game])
  const W = TABLE.h
  const L = TABLE.w
  const RAIL = 0.075
  const CUSH = 0.045
  // The cushions between the pockets: on each long side, two (the middle pocket between them); on each short side, one.
  const gapC = 0.09
  const gapM = 0.07
  const longLen = L / 2 - gapC - gapM
  const cushions: { p: [number, number, number]; s: [number, number, number] }[] = [
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ p: [sx * (W / 2 + CUSH / 2), CUSH / 2, sz * (gapM + longLen / 2)] as [number, number, number], s: [CUSH, CUSH, longLen] as [number, number, number] }))),
    ...[-1, 1].map((sz) => ({ p: [0, CUSH / 2, sz * (L / 2 + CUSH / 2)] as [number, number, number], s: [W - gapC * 2, CUSH, CUSH] as [number, number, number] })),
  ]
  const diamonds: [number, number][] = [
    ...[-1, 1].flatMap((sx) => [-3, -2, -1, 1, 2, 3].map((k) => [sx * (W / 2 + CUSH + 0.055), (k * L) / 8] as [number, number])),
    ...[-1, 1].flatMap((sz) => [-1, 0, 1].map((k) => [(k * W) / 4, sz * (L / 2 + CUSH + 0.055)] as [number, number])),
  ]
  return (
    <group>
      {/* The light over the table: a lamp low over it (its shade seen from the side), its pool of light and the shadows under the balls */}
      <spotLight position={[0, 1.7, 0]} angle={0.95} penumbra={0.7} intensity={2.6} decay={0} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
      <ambientLight intensity={0.25} />
      <hemisphereLight args={['#fff2d8', '#2a1a10', 0.45]} />
      {low && (
        <group position={[0, 1.15, 0]}>
          <mesh>
            <boxGeometry args={[0.32, 0.1, 1.3]} />
            <meshStandardMaterial color="#1f5f3a" roughness={0.4} metalness={0.3} side={THREE.DoubleSide} />
          </mesh>
          {[-0.4, 0, 0.4].map((z) => (
            <mesh key={z} position={[0, -0.06, z]}>
              <sphereGeometry args={[0.035, 12, 8]} />
              <meshBasicMaterial color="#fff3cf" />
            </mesh>
          ))}
          {[-0.55, 0.55].map((z) => (
            <mesh key={z} position={[0, 0.6, z]}>
              <boxGeometry args={[0.006, 1.2, 0.006]} />
              <meshBasicMaterial color="#111" />
            </mesh>
          ))}
        </group>
      )}
      {/* The cloth (touched to aim), its cushions */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} onPointerDown={touch} onPointerMove={(e) => e.buttons && touch(e)} onPointerUp={touch} onPointerLeave={() => void (drag.current = null)} receiveShadow>
        <planeGeometry args={[W + 0.4, L + 0.4]} />
        <meshStandardMaterial map={felt} roughness={0.95} />
      </mesh>
      {cushions.map((c, i) => (
        <mesh key={i} position={c.p} receiveShadow castShadow>
          <boxGeometry args={c.s} />
          <meshStandardMaterial color="#0f6a3f" roughness={0.9} />
        </mesh>
      ))}
      {/* The wooden rails, their diamonds, the body under them, the legs, the floor of the maquis */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * (W / 2 + CUSH + 0.06), RAIL / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.12, RAIL, L + (CUSH + 0.12) * 2]} />
            <meshStandardMaterial map={rail} roughness={0.35} metalness={0.05} />
          </mesh>
          <mesh position={[0, RAIL / 2, s * (L / 2 + CUSH + 0.06)]} castShadow receiveShadow>
            <boxGeometry args={[W + CUSH * 2, RAIL, 0.12]} />
            <meshStandardMaterial map={rail} roughness={0.35} metalness={0.05} />
          </mesh>
        </group>
      ))}
      {diamonds.map(([x, z], i) => (
        <mesh key={i} position={[x, RAIL + 0.001, z]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
          <planeGeometry args={[0.016, 0.016]} />
          <meshStandardMaterial color="#f2eadb" roughness={0.2} metalness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, -0.16, 0]} castShadow>
        <boxGeometry args={[W + 0.42, 0.3, L + 0.42]} />
        <meshStandardMaterial map={rail} roughness={0.5} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (W / 2 + 0.06), -0.5, sz * (L / 2 + 0.02)]} castShadow>
            <boxGeometry args={[0.14, 0.6, 0.14]} />
            <meshStandardMaterial color="#2d160a" roughness={0.6} />
          </mesh>
        )),
      )}
      <mesh position={[0, -0.8, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial map={floor} roughness={0.8} />
      </mesh>
      {low &&
        // The maquis's walls, far, warm and dim; a framed poster, a neon.
        [
          [0, 0.6, -3.2, 0],
          [0, 0.6, 3.2, Math.PI],
          [-3.2, 0.6, 0, Math.PI / 2],
          [3.2, 0.6, 0, -Math.PI / 2],
        ].map(([x, y, z, r], i) => (
          <group key={i} position={[x, y, z]} rotation={[0, r, 0]}>
            <mesh>
              <planeGeometry args={[6.4, 2.8]} />
              <meshStandardMaterial color={i % 2 ? '#6b3a1f' : '#7a4524'} roughness={0.9} />
            </mesh>
            <mesh position={[i % 2 ? 1.4 : -1.2, 0.3, 0.01]}>
              <planeGeometry args={[0.7, 0.5]} />
              <meshBasicMaterial color={['#ff7a00', '#00b86b', '#ffcc33', '#e03131'][i]} />
            </mesh>
          </group>
        ))}
      {/* The six pockets: the hole, its leather liner */}
      {POCKETS.map((p, i) => {
        const [x, , z] = to3(p.x, p.z)
        return (
          <group key={i} position={[x, RAIL + 0.002, z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[p.r * 0.98, 24]} />
              <meshBasicMaterial color="#040404" />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <torusGeometry args={[p.r * 0.98, 0.008, 8, 24]} />
              <meshStandardMaterial color="#1c1410" roughness={0.5} metalness={0.2} />
            </mesh>
          </group>
        )
      })}
      {/* The head spot and the foot spot */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.001, s * (L / 4)]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.008, 10]} />
          <meshBasicMaterial color="#d8f0e0" />
        </mesh>
      ))}
      {game.current?.balls.map((b, i) => (
        <mesh key={b.n} ref={(m) => void (balls.current[i] = m)} geometry={sphere} castShadow>
          <meshStandardMaterial map={textures[b.n]} roughness={0.12} metalness={0.05} />
        </mesh>
      ))}
      {game.current?.balls.map((b, i) => (
        <mesh key={`t${b.n}`} ref={(m) => void (tray.current[i] = m)} geometry={sphere} visible={false}>
          <meshStandardMaterial map={textures[b.n]} roughness={0.2} />
        </mesh>
      ))}
      {/* The aiming line to the first ball, and where the cue ball meets it */}
      <mesh ref={line}>
        <boxGeometry args={[0.004, 0.001, 1]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.55} />
      </mesh>
      <mesh ref={objLine}>
        <boxGeometry args={[0.005, 0.001, 1]} />
        <meshBasicMaterial color="#ffcc33" transparent opacity={0.8} />
      </mesh>
      <mesh ref={cueLine}>
        <boxGeometry args={[0.004, 0.001, 1]} />
        <meshBasicMaterial color="#9fd3ff" transparent opacity={0.6} />
      </mesh>
      <mesh ref={ghost}>
        <sphereGeometry args={[R, 16, 10]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
      </mesh>
      {/* The cue */}
      <group ref={stick}>
        <group>
          <CueStick />
        </group>
      </group>
    </group>
  )
}

/**
 * The spin ball: the cue ball as the player sees it, touched where the cue will strike it: high for the coulé,
 * low for the rétro, left or right for the side effect.
 */
function SpinBall({ spin, side, set }: { spin: number; side: number; set: (spin: number, side: number) => void }) {
  const q = (v: number) => Math.round(Math.max(-1, Math.min(1, v)) * 4) / 4
  return (
    <button
      className="relative h-12 w-12 shrink-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffffff,#e9e4d6_60%,#bdb6a3)] shadow-[inset_0_-3px_6px_rgba(0,0,0,0.25)]"
      aria-label={tr('Effet')}
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        set(q((0.5 - (e.clientY - r.top) / r.height) * 2.4), q(((e.clientX - r.left) / r.width - 0.5) * 2.4))
      }}
    >
      <span className="absolute top-1/2 left-1/2 h-px w-8 -translate-x-1/2 bg-black/15" />
      <span className="absolute top-1/2 left-1/2 h-8 w-px -translate-y-1/2 bg-black/15" />
      <span className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2f6fd6] shadow" style={{ top: `${50 - spin * 38}%`, left: `${50 + side * 38}%` }} />
    </button>
  )
}
const spinWord = (spin: number, side: number) =>
  [spin > 0.1 ? tr('Coulé') : spin < -0.1 ? tr('Rétro') : '', side > 0.1 ? tr('à droite') : side < -0.1 ? tr('à gauche') : ''].filter(Boolean).join(' · ') || tr('Sans effet')

/**
 * The cue pulled back to shoot: drag down along it, the power rising (the cue on the table drawn back as
 * far); let go, the shot. Back up to nothing: no shot.
 */
/** The fine aim: a ribbed wheel along the left of the table, rolled up or down to turn the cue a hair. */
function FineAim({ onTurn, disabled }: { onTurn: (d: number) => void; disabled: boolean }) {
  const from = useRef<number | null>(null)
  const [roll, setRoll] = useState(0)
  return (
    <div
      className={`absolute top-3 bottom-3 left-2 z-10 w-9 overflow-hidden rounded-full border border-white/15 bg-black/35 ${disabled ? 'opacity-40' : ''}`}
      style={{ touchAction: 'none' }}
      aria-label={tr('Visée fine')}
      onPointerDown={(e) => {
        if (disabled) return
        e.currentTarget.setPointerCapture(e.pointerId)
        from.current = e.clientY
      }}
      onPointerMove={(e) => {
        if (from.current === null) return
        const dy = e.clientY - from.current
        from.current = e.clientY
        setRoll((r) => r + dy)
        onTurn(dy * 0.0009)
      }}
      onPointerUp={() => void (from.current = null)}
      onPointerCancel={() => void (from.current = null)}
    >
      <div className="absolute inset-1 rounded-full" style={{ backgroundImage: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.32) 0 2px, rgba(0,0,0,0.25) 2px 9px)', backgroundPositionY: `${roll}px` }} />
      <div className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(0,0,0,0.7),transparent_30%,transparent_70%,rgba(0,0,0,0.7))]" />
    </div>
  )
}

function PullCue({ power, onShoot, disabled }: { power: React.RefObject<number>; onShoot: () => void; disabled: boolean }) {
  const from = useRef<number | null>(null)
  const [pulling, setPulling] = useState(false)
  // (Its own state: only the bar is drawn again as the cue comes back, not the table.)
  const [shown, show] = useState(power.current ?? 0.55)
  const set = (v: number) => ((power.current = v), show(v))
  return (
    <div
      className={`absolute top-3 right-2 bottom-3 z-10 flex w-12 flex-col items-center rounded-full bg-black/35 py-2 ${disabled ? 'opacity-40' : ''}`}
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        if (disabled) return
        e.currentTarget.setPointerCapture(e.pointerId)
        from.current = e.clientY
        setPulling(true)
        set(0.05)
      }}
      onPointerMove={(e) => {
        if (from.current === null) return
        const h = e.currentTarget.getBoundingClientRect().height
        set(Math.max(0.05, Math.min(1, (e.clientY - from.current) / (h * 0.75))))
      }}
      onPointerUp={() => {
        if (from.current === null) return
        from.current = null
        setPulling(false)
        if ((power.current ?? 0) > 0.08) onShoot()
      }}
      onPointerCancel={() => ((from.current = null), setPulling(false))}
    >
      <span className="text-[9px] font-extrabold text-white/80">{pulling ? `${Math.round(shown * 100)}%` : tr('Tire')}</span>
      <div className="relative mt-1 w-3 flex-1 overflow-hidden rounded-full bg-white/15">
        <div className="absolute inset-x-0 top-0 rounded-full bg-[linear-gradient(180deg,#ffe27a,#ff7a00,#e03131)]" style={{ height: `${shown * 100}%` }} />
      </div>
      <span className="mt-1 text-[14px] text-white/70">↓</span>
    </div>
  )
}

export function BillardDefi({ onEnd, onStart, phone, extra }: { onEnd: (score: number) => void; onStart?: (on: boolean) => void; /** In the phone's « Billard 225 » app: no close button over it, « Rejouer » at the end. */ phone?: boolean; /** Under the opponents (the app's « Jouer contre un joueur »). */ extra?: React.ReactNode }) {
  const [foe, setFoe] = useState<(typeof FOES)[number] | null>(null)
  useEffect(() => {
    onStart?.(!!foe)
    return () => onStart?.(false)
  }, [foe, onStart])
  if (!foe)
    return (
      <div className="grid gap-2 p-4">
        <p className="text-center text-[13px] font-bold text-white/80">{tr('Le billard américain du maquis : rentre ta famille de billes (les pleines ou les rayées), puis la noire. Glisse sur la table pour viser, tire la queue vers le bas et lâche pour jouer.')}</p>
        {FOES.map((f) => (
          <button key={f.id} className="rounded-2xl bg-white/12 px-4 py-3 text-left font-extrabold text-white transition active:scale-[0.98]" onClick={() => setFoe(f)}>
            {f.label}
            <span className="block text-[12px] font-bold text-white/60">{f.skill < 0.5 ? tr('Facile') : f.skill < 0.8 ? tr('Moyen') : tr('Fort')}</span>
          </button>
        ))}
        {extra}
      </div>
    )
  return <Match foe={foe} onEnd={onEnd} phone={phone} />
}

function Match({ foe, onEnd, phone }: { foe: (typeof FOES)[number]; onEnd: (score: number) => void; phone?: boolean }) {
  const game = useRef<Game>(newGame(Math.floor(Math.random() * 1000) + 1))
  // (At the rack, to begin with.)
  const aim = useRef(0)
  const power = useRef(0.55)
  // The spin: where the cue strikes the cue ball (-1 low: rétro, +1 high: coulé).
  const [spin, setSpin] = useState(0)
  const [side, setSide] = useState(0)
  // When the last shot was struck (the cue's thrust).
  const struck = useRef(-1e9)
  const [low, setLow] = useState(false)
  const [, render] = useState(0)
  const redraw = () => render((n) => n + 1)
  const g = game.current
  // The table running: the balls moved on each frame; the regular's turn played after a moment.
  useEffect(() => {
    let last = performance.now()
    let wait = 0
    let id = 0
    let sounded = 0
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const gm = game.current
      if (gm.moving) {
        step(gm, dt)
        // The sounds of the table: the balls clicking (louder when hard), the cushions, the pockets.
        const fx = gm.fx
        if (fx.pocket) sfx.pop()
        else if (fx.click && now - sounded > 40) (sfx.tick(fx.hard ? 2.2 : 1.6), (sounded = now))
        else if (fx.rail && now - sounded > 60) (sfx.tick(0.6), (sounded = now))
        Object.assign(fx, { click: 0, rail: 0, pocket: 0, hard: 0 })
        if (!gm.moving) {
          redraw()
          if (gm.winner !== null) haptic(gm.winner === 0 ? 'success' : 'heavy')
        }
      } else if (gm.turn === 1 && gm.winner === null) {
        wait += dt
        if (gm.inHand && wait > 0.4) (placeCue(gm, -TABLE.w / 4, 0), (gm.inHand = false), redraw())
        if (wait > 1.3) {
          wait = 0
          const s = aiShot(gm, foe.skill)
          aim.current = s.angle
          struck.current = performance.now()
          shoot(gm, s.angle, s.power, s.spin)
          sfx.chip()
          redraw()
        }
      } else wait = 0
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [foe.skill])
  const mine = g.turn === 0 && !g.moving && g.winner === null
  const fire = () => {
    if (!mine || g.inHand) return
    struck.current = performance.now()
    shoot(g, aim.current, power.current, spin, side)
    haptic('light')
    sfx.chip()
    redraw()
  }
  const nudge = (d: number) => void (aim.current += d)
  const groupName = (side: 0 | 1) => (g.groups[side] === 'pleines' ? tr('pleines') : g.groups[side] === 'rayees' ? tr('rayées') : tr('table ouverte'))
  const pot = (side: 0 | 1) =>
    g.groups[side]
      ? g.balls.filter((b) => groupOf(b.n) === g.groups[side]).map((b) => (
          <span key={b.n} className="inline-block h-3 w-3 rounded-full border border-black/30" style={{ background: colourOf(b.n), opacity: b.in ? 0.25 : 1 }} />
        ))
      : null
  return (
    <div className="flex h-full flex-col bg-[#0b2a1b] text-white">
      {/* Who plays, their balls, what the last shot did */}
      <div className={`grid grid-cols-2 gap-2 px-3 pb-1 text-[12px] font-extrabold ${phone ? 'pt-3' : 'pt-12'}`}>
        {([0, 1] as const).map((side) => (
          <div key={side} className={`rounded-xl px-2.5 py-1.5 ${g.turn === side && g.winner === null ? 'bg-[#ffcc33] text-[#3a2600]' : 'bg-white/10'}`}>
            <div>
              {side === 0 ? tr('Toi') : foe.name} · {groupName(side)}
            </div>
            <div className="mt-0.5 flex gap-0.5">{pot(side)}</div>
          </div>
        ))}
      </div>
      <div className="h-6 px-3 text-center text-[13px] font-extrabold text-[#ffe08a]">{g.winner === null ? (g.inHand && g.turn === 0 ? tr('Bille en main : touche la table pour poser la blanche.') : g.said || (g.turn === 1 ? tx('{0} joue…', { 0: foe.name }) : g.breakShot ? tr('À toi de casser !') : tr('À toi.'))) : g.said}</div>
      <div className="relative min-h-0 flex-1">
        <Canvas shadows dpr={sceneDpr} camera={{ position: [0, 3.55, 0.3], fov: 42 }} onCreated={({ camera }) => camera.lookAt(0, 0, 0.02)} style={{ touchAction: 'none' }}>
          <Table
            game={game}
            aim={aim}
            power={power}
            mine={mine}
            low={low}
            struck={struck}
            onAim={(a) => void (aim.current = a)}
            onPlace={(x, z) => {
              placeCue(g, x, z)
              g.inHand = false
              redraw()
            }}
          />
        </Canvas>
        {/* The fine aim on the left; pull the cue back along the right side and let go to shoot (or « Tirer » below) */}
        <FineAim onTurn={nudge} disabled={!mine || g.inHand} />
        <PullCue power={power} onShoot={fire} disabled={!mine || g.inHand} />
      </div>
      {g.winner === null && (
        <div className="flex items-center justify-between px-3 pt-2">
          <div className="flex items-center gap-2">
            <SpinBall spin={spin} side={side} set={(a, b) => (setSpin(a), setSide(b))} />
            <span className="text-[11px] leading-tight font-extrabold text-white/75">
              {spinWord(spin, side)}
              <span className="block text-[10px] font-bold text-white/45">{tr('touche la bille')}</span>
            </span>
          </div>
          <button className="rounded-full bg-white/15 px-3 py-2 text-[12px] font-extrabold" onClick={() => setLow((v) => !v)}>
            {low ? tr('Vue de dessus') : tr('Vue 3D')}
          </button>
        </div>
      )}
      {g.winner === null ? (
        <div className="flex items-center gap-2 px-3 pt-1.5 pb-4">
          <span className="min-w-0 flex-1 text-[11px] leading-tight font-bold text-white/55">{tr('Glisse sur la table pour viser, la molette à gauche pour la visée fine, tire la queue à droite.')}</span>
          <button className="rounded-full bg-[#ffcc33] px-5 py-3 font-extrabold text-[#3a2600] disabled:opacity-40" disabled={!mine || g.inHand} onClick={fire}>
            {tr('Tirer')}
          </button>
        </div>
      ) : (
        <div className="px-4 pt-2 pb-6 text-center">
          <div className="font-display text-[24px] font-extrabold">{g.winner === 0 ? tr('Gagné !') : tx('{0} gagne', { 0: foe.name })}</div>
          <div className="text-[13px] font-bold text-white/70">{tx('{0} de tes billes rentrées, {1} pour lui', { 0: g.groups[0] ? 7 - left(g, 0) : 0, 1: g.groups[1] ? 7 - left(g, 1) : 0 })}</div>
          <button className="btn mt-3 w-full !py-3" onClick={() => onEnd(score(g))}>
            {phone ? tr('Rejouer') : tr('Terminer')}
          </button>
        </div>
      )}
    </div>
  )
}

/* ---------- Against a player (components/pvp/play.tsx) ---------- */

/** A shot as sent to the other phone: where the cue ball was put down (ball in hand), the angle, the power, the spin, and the table once it came to rest. */
export type BillardMove = { pl?: [number, number]; a: number; p: number; s: number; /** The side spin. */ d?: number; st: Snap }

/**
 * Billard 225 against a player, shot by shot: seat 0 breaks. Each shot is played here and sent with the
 * table as it came to rest (snapshot); the other phone plays the same shot to show it, then puts the table
 * exactly as it was sent, so both see the same balls whatever their phone's arithmetic.
 */
export function BillardVersus({ seat, meId, me, them, moves, seed, left, busy, err, send, onOver }: {
  seat: 0 | 1
  /** This player's sim (its own shots come back from the server: put down, not played again). */
  meId: string
  me: string
  them: string
  moves: { by: string; m: BillardMove }[]
  /** The rack's seed (the same on both phones). */
  seed: number
  /** Seconds left for whoever plays. */
  left: number
  busy: boolean
  err: string | null
  send: (m: BillardMove, next: number) => void
  onOver: (winnerSeat: number) => void
}) {
  const game = useRef<Game>(newGame(seed))
  const aim = useRef(seat === 0 ? 0 : Math.PI)
  const power = useRef(0.55)
  const [spin, setSpin] = useState(0)
  const [side, setSide] = useState(0)
  // When the last shot was struck (the cue's thrust).
  const struck = useRef(-1e9)
  const [low, setLow] = useState(false)
  const [, render] = useState(0)
  const redraw = () => render((n) => n + 1)
  // The moves taken in so far; the snapshot to land on once the shot being shown has run.
  const applied = useRef(0)
  const landing = useRef<Snap | null>(null)
  // My own shot being played: what to send once the balls stop.
  const mine = useRef<Omit<BillardMove, 'st'> | null>(null)
  const placed = useRef<[number, number] | undefined>(undefined)
  const told = useRef(false)
  const g = game.current
  // The other's shots as they come: the earlier ones put down at once, the last one played out.
  useEffect(() => {
    const gm = game.current
    if (moves.length <= applied.current) return
    for (let k = applied.current; k < moves.length; k++) {
      const mv = moves[k].m
      const last = k === moves.length - 1
      if (!last || moves[k].by === meId || mine.current || gm.moving) {
        restore(gm, mv.st)
        continue
      }
      if (mv.pl) placeCue(gm, mv.pl[0], mv.pl[1])
      aim.current = mv.a
      struck.current = performance.now()
      shoot(gm, mv.a, mv.p, mv.s, mv.d ?? 0)
      landing.current = mv.st
    }
    applied.current = moves.length
    redraw()
  }, [moves.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let last = performance.now()
    let id = 0
    let sounded = 0
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const gm = game.current
      if (gm.moving) {
        step(gm, dt)
        const fx = gm.fx
        if (fx.pocket) sfx.pop()
        else if (fx.click && now - sounded > 40) (sfx.tick(fx.hard ? 2.2 : 1.6), (sounded = now))
        else if (fx.rail && now - sounded > 60) (sfx.tick(0.6), (sounded = now))
        Object.assign(fx, { click: 0, rail: 0, pocket: 0, hard: 0 })
        if (!gm.moving) {
          // My shot at rest: sent with the table as it is. The other's: the table put exactly as sent.
          if (mine.current) {
            send({ ...mine.current, st: snapshot(gm) }, gm.turn)
            mine.current = null
          } else if (landing.current) {
            restore(gm, landing.current)
            landing.current = null
          }
          redraw()
        }
      }
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // The game over (the 8 down): said once.
  useEffect(() => {
    if (g.winner === null || g.moving || told.current) return
    told.current = true
    haptic(g.winner === seat ? 'success' : 'heavy')
    onOver(g.winner)
  })
  const myTurn = g.turn === seat && !g.moving && g.winner === null && !busy && !mine.current
  const fire = () => {
    if (!myTurn || g.inHand) return
    mine.current = { pl: placed.current, a: aim.current, p: power.current, s: spin, d: side }
    placed.current = undefined
    struck.current = performance.now()
    shoot(g, aim.current, power.current, spin, side)
    haptic('light')
    sfx.chip()
    redraw()
  }
  const who = (k: 0 | 1) => (k === seat ? tr('Toi') : them)
  const groupName = (k: 0 | 1) => (g.groups[k] === 'pleines' ? tr('pleines') : g.groups[k] === 'rayees' ? tr('rayées') : tr('table ouverte'))
  const balls = (k: 0 | 1) =>
    g.groups[k]
      ? g.balls.filter((b) => groupOf(b.n) === g.groups[k]).map((b) => <span key={b.n} className="inline-block h-3 w-3 rounded-full border border-black/30" style={{ background: colourOf(b.n), opacity: b.in ? 0.25 : 1 }} />)
      : null
  const said = g.winner !== null ? (g.winner === seat ? tr('La noire dans la poche : partie gagnée !') : tx('{0} gagne', { 0: them })) : err || (g.inHand && g.turn === seat ? tr('Bille en main : touche la table pour poser la blanche.') : g.said || (g.turn === seat ? (g.breakShot ? tr('À toi de casser !') : tr('À toi.')) : tx('{0} joue…', { 0: them })))
  return (
    <div className="flex h-full flex-col bg-[#0b2a1b] text-white" data-pvp="billard">
      <div className="grid grid-cols-2 gap-2 px-3 pt-12 pb-1 text-[12px] font-extrabold">
        {(seat === 0 ? ([0, 1] as const) : ([1, 0] as const)).map((k) => (
          <div key={k} className={`rounded-xl px-2.5 py-1.5 ${g.turn === k && g.winner === null ? 'bg-[#ffcc33] text-[#3a2600]' : 'bg-white/10'}`}>
            <div>
              {k === seat ? me : who(k)} · {groupName(k)}
              {g.turn === k && g.winner === null && !g.moving ? ` · ${left} s` : ''}
            </div>
            <div className="mt-0.5 flex gap-0.5">{balls(k)}</div>
          </div>
        ))}
      </div>
      <div className="h-6 px-3 text-center text-[13px] font-extrabold text-[#ffe08a]">{said}</div>
      <div className="relative min-h-0 flex-1">
        <Canvas shadows dpr={sceneDpr} camera={{ position: [0, 3.55, 0.3], fov: 42 }} style={{ touchAction: 'none' }}>
          <Table
            game={game}
            aim={aim}
            power={power}
            mine={myTurn}
            low={low}
            struck={struck}
            onAim={(a) => void (aim.current = a)}
            onPlace={(x, z) => {
              placeCue(g, x, z)
              const c = cue(g)
              placed.current = [c.x, c.z]
              g.inHand = false
              redraw()
            }}
          />
        </Canvas>
        {/* The fine aim on the left; pull the cue back along the right side and let go to shoot */}
        <FineAim onTurn={(d) => void (aim.current += d)} disabled={!myTurn || g.inHand} />
        <PullCue power={power} onShoot={fire} disabled={!myTurn || g.inHand} />
      </div>
      {g.winner === null && (
        <div className="flex items-center justify-between px-3 pt-2">
          <div className="flex items-center gap-2">
            <SpinBall spin={spin} side={side} set={(a, b) => (setSpin(a), setSide(b))} />
            <span className="text-[11px] leading-tight font-extrabold text-white/75">{spinWord(spin, side)}</span>
          </div>
          <button className="rounded-full bg-white/15 px-3 py-2 text-[12px] font-extrabold" onClick={() => setLow((v) => !v)}>
            {low ? tr('Vue de dessus') : tr('Vue 3D')}
          </button>
        </div>
      )}
      {g.winner === null && (
        <div className="flex items-center gap-2 px-3 pt-1.5 pb-4">
          <span className="min-w-0 flex-1 text-[11px] leading-tight font-bold text-white/55">{tr('Glisse sur la table pour viser, la molette à gauche pour la visée fine, tire la queue à droite.')}</span>
          <button className="rounded-full bg-[#ffcc33] px-5 py-3 font-extrabold text-[#3a2600] disabled:opacity-40" disabled={!myTurn || g.inHand} onClick={fire}>
            {tr('Tirer')}
          </button>
        </div>
      )}
    </div>
  )
}
