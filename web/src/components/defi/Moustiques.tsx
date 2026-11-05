import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { sceneDpr, weakDevice } from '../../lib/device'
import { haptic } from '../../lib/native'
import { sfx } from '../../lib/sfx'
import { clamp, Count, useCount, useKeys, useLoop } from './arcade'
import { t } from '../../lib/i18n'

// La borne d'arcade de la salle: « Moustiques ! », the shooting game of the
// nights by the lagoon. The bombe PAF at the bottom sprays by itself; the
// finger slides it left and right (or the arrows). The mosquitoes come down
// in swarms, swaying, now and then one dives at you; the tiger ones take
// three sprays; the coil (a green spiral, caught) sprays three ways for a
// while; one let through costs ten points. Three bites and it's over. At 45
// seconds the Gros Moustique comes: it drops its larvae, and takes sixty sprays.
// Drawn in 3D, the game's blocks: the lane of the night over the lagoon seen
// from just behind the bombe, the mosquitoes coming at you out of the dark,
// their wings beating, bursting in red cubes.

const W = 360
const H = 540
const Y = H - 46 // the bombe
const TIME = 60
const BOSS_AT = 45
// How big the mosquitoes are drawn (and hit), the boss's too.
const K = 1.6
const KB = 4.4

type Bug = { x: number; y: number; hp: number; tiger: boolean; dive: number; phase: number; boss?: boolean; max?: number }
type Shot = { x: number; y: number; vx: number; vy: number; foe?: boolean }

/** Points as a score out of 100 (a full game well played, the boss down, is near 3 000). */
export const bugScore = (points: number) => Math.round(clamp(points / 30, 0, 100))

export function MoustiquesDefi({ onEnd }: { onEnd: (score: number) => void }) {
  const keys = useKeys()
  const n = useCount(3)
  const finger = useRef<number | null>(null)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const g = useRef({ x: W / 2, t: 0, fire: 0, bugs: [] as Bug[], shots: [] as Shot[], wave: 0, lives: 3, safe: 0, points: 0, combo: 0, comboT: 0, coil: 0, coilAt: null as { x: number; y: number } | null, boss: false, over: false, pops: [] as { x: number; y: number; t: number; text: string }[], splats: [] as { x: number; y: number; t: number; big: boolean; drops: [number, number][] }[], shake: 0 })
  const [hud, setHud] = useState({ lives: 3, points: 0, left: TIME, said: '', boss: 0 })

  const step = (dt: number) => {
    const s = g.current
    if (n > 0 || s.over) return
    s.t += dt
    // The bombe: under the finger, or by the arrows.
    const k = keys.current
    const dir = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0)
    if (finger.current !== null) s.x += clamp(finger.current - s.x, -520 * dt, 520 * dt)
    s.x = clamp(s.x + dir * 300 * dt, 18, W - 18)
    // It sprays by itself; three ways with the coil.
    s.fire -= dt
    s.coil = Math.max(0, s.coil - dt)
    if (s.fire <= 0) {
      s.fire = 0.2
      s.shots.push({ x: s.x, y: Y - 22, vx: 0, vy: -440 })
      if (s.coil > 0) s.shots.push({ x: s.x, y: Y - 22, vx: -130, vy: -420 }, { x: s.x, y: Y - 22, vx: 130, vy: -420 })
    }
    // The swarms: a new one every few seconds, bigger as it goes; the boss at 45 s.
    if (!s.boss && s.t < BOSS_AT && s.t > s.wave * 5.5) {
      const count = 5 + Math.min(5, s.wave)
      for (let i = 0; i < count; i++) {
        const tiger = (i + s.wave) % 5 === 0
        s.bugs.push({ x: 40 + (i * (W - 80)) / Math.max(1, count - 1), y: -20 - (i % 2) * 26, hp: tiger ? 3 : 1, tiger, dive: 0, phase: Math.random() * 6 })
      }
      s.wave++
      if (s.wave % 3 === 0) s.coilAt = { x: 40 + Math.random() * (W - 80), y: -10 }
    }
    if (!s.boss && s.t >= BOSS_AT) {
      s.boss = true
      s.bugs.push({ x: W / 2, y: -60, hp: 60, max: 60, tiger: true, dive: 0, phase: 0, boss: true })
      setHud((h) => ({ ...h, said: t('Le Gros Moustique !') }))
      setTimeout(() => setHud((h) => ({ ...h, said: '' })), 1500)
    }
    for (const b of s.bugs) {
      b.phase += dt
      if (b.boss) {
        b.y = Math.min(110, b.y + 40 * dt)
        b.x = W / 2 + Math.sin(b.phase * 0.9) * 120
        // Its larvae, dropped at the bombe.
        if (Math.random() < dt * 1.4) s.shots.push({ x: b.x, y: b.y + 30, vx: (s.x - b.x) * 0.5, vy: 170, foe: true })
        continue
      }
      if (b.dive) {
        // Diving at the bombe.
        b.y += 210 * dt
        b.x += clamp(s.x - b.x, -1, 1) * 90 * dt
      } else {
        b.y += (28 + s.wave * 2.5) * dt
        b.x += Math.sin(b.phase * 2.2) * 40 * dt
        if (b.y > 60 && Math.random() < dt * 0.12 * (1 + s.wave * 0.12)) b.dive = 1
      }
    }
    // Sprays and larvae.
    for (const sh of s.shots) {
      sh.x += sh.vx * dt
      sh.y += sh.vy * dt
    }
    for (const sh of s.shots) {
      if (sh.foe || sh.y < -10) continue
      for (const b of s.bugs) {
        if (b.hp <= 0 || Math.abs(sh.x - b.x) > (b.boss ? 50 : 19) || Math.abs(sh.y - b.y) > (b.boss ? 40 : 18)) continue
        sh.y = -100
        b.hp--
        if (b.boss && b.hp > 0 && Math.random() < 0.25) sfx.guard()
        if (b.hp <= 0) {
          s.combo = s.comboT > 0 ? s.combo + 1 : 1
          s.comboT = 0.9
          const pts = b.boss ? 300 : (b.tiger ? 30 : 10) * Math.min(3, s.combo)
          s.points += pts
          s.pops.push({ x: b.x, y: b.y, t: 0.7, text: `+${pts}` })
          // It bursts: a splat, its drops flying.
          s.splats.push({ x: b.x, y: b.y, t: 0.6, big: !!b.boss, drops: Array.from({ length: b.boss ? 18 : 7 }, () => [(Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2] as [number, number]) })
          if (s.splats.length > 12) s.splats.shift()
          b.boss ? (sfx.win(true), (s.shake = 0.6)) : sfx.pop()
          haptic(b.boss ? 'success' : 'light')
          if (b.boss) {
            // The boss down: what time is left counts too.
            s.points += Math.round((TIME - s.t) * 10)
            finish(t('Le Gros Moustique est tombé !'))
          }
        }
        break
      }
    }
    s.comboT = Math.max(0, s.comboT - dt)
    // The coil, falling: caught, three ways for 6 s.
    if (s.coilAt) {
      s.coilAt.y += 90 * dt
      if (Math.abs(s.coilAt.x - s.x) < 22 && Math.abs(s.coilAt.y - Y) < 24) {
        s.coil = 6
        s.coilAt = null
        sfx.coins(2)
        haptic('success')
        s.pops.push({ x: s.x, y: Y - 40, t: 1, text: t('Spirale !') })
      } else if (s.coilAt.y > H + 20) s.coilAt = null
    }
    // A bite: a mosquito (or a larva) on the bombe.
    s.safe = Math.max(0, s.safe - dt)
    if (s.safe <= 0) {
      const bit = s.bugs.find((b) => b.hp > 0 && Math.abs(b.x - s.x) < (b.boss ? 56 : 22) && Math.abs(b.y - Y) < (b.boss ? 56 : 24)) || s.shots.find((sh) => sh.foe && Math.abs(sh.x - s.x) < 16 && Math.abs(sh.y - Y) < 20)
      if (bit) {
        s.lives--
        s.safe = 1.5
        s.combo = 0
        s.shake = 0.35
        sfx.lose()
        haptic('error')
        if ('hp' in bit && !bit.boss) bit.hp = 0
        else if (!('hp' in bit)) bit.y = H + 50
        s.pops.push({ x: s.x, y: Y - 40, t: 0.9, text: t('Piqûre !') })
        if (s.lives <= 0) return finish(t('Trop de piqûres…'))
      }
    }
    // Let through: ten points lost.
    for (const b of s.bugs)
      if (b.hp > 0 && b.y >= H + 30) {
        s.points = Math.max(0, s.points - 10)
        s.combo = 0
        s.pops.push({ x: clamp(b.x, 20, W - 20), y: H - 20, t: 0.8, text: '−10' })
      }
    s.bugs = s.bugs.filter((b) => b.hp > 0 && b.y < H + 30)
    s.shots = s.shots.filter((sh) => sh.y > -20 && sh.y < H + 20)
    for (const p of s.pops) p.t -= dt
    s.pops = s.pops.filter((p) => p.t > 0)
    for (const p of s.splats) p.t -= dt
    s.splats = s.splats.filter((p) => p.t > 0)
    s.shake = Math.max(0, s.shake - dt)
    if (s.t >= TIME) return finish(t('Fin de la partie'))
    if (Math.round(s.t * 6) !== Math.round((s.t - dt) * 6)) {
      const boss = s.bugs.find((b) => b.boss)
      setHud((h) => ({ ...h, lives: s.lives, points: s.points, left: Math.max(0, Math.ceil(TIME - s.t)), boss: boss ? boss.hp / boss.max! : 0 }))
    }
  }
  const finish = (said: string) => {
    const s = g.current
    if (s.over) return
    s.over = true
    setHud((h) => ({ ...h, said, points: s.points, lives: s.lives }))
    setTimeout(() => onEnd(bugScore(s.points)), 1400)
  }

  useLoop(step)

  return (
    <div className="flex h-full flex-col bg-[#070a1c]">
      <div className="flex items-center justify-between px-3 pt-3 font-display font-extrabold text-white">
        <span className="text-lg">{'❤️'.repeat(Math.max(0, hud.lives))}{'🖤'.repeat(Math.max(0, 3 - hud.lives))}</span>
        <span className="rounded-lg bg-black/40 px-2.5 py-0.5 text-lg tabular-nums">{hud.points}</span>
        <span className="rounded-lg bg-black/40 px-2 py-0.5 text-sm tabular-nums">{hud.left} {t('s')}</span>
      </div>
      {hud.boss > 0 && (
        <div className="mx-3 mt-1.5 h-2 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-[#e03131]" style={{ width: `${hud.boss * 100}%` }} />
        </div>
      )}
      <div
        className="relative min-h-0 flex-1 touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          const r = e.currentTarget.getBoundingClientRect()
          pointer.current = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -(((e.clientY - r.top) / r.height) * 2 - 1) }
        }}
        onPointerMove={(e) => {
          if (!pointer.current) return
          const r = e.currentTarget.getBoundingClientRect()
          pointer.current = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -(((e.clientY - r.top) / r.height) * 2 - 1) }
        }}
        onPointerUp={() => ((pointer.current = null), (finger.current = null))}
        onPointerCancel={() => ((pointer.current = null), (finger.current = null))}
      >
        <div className="absolute inset-0">
          <Canvas dpr={sceneDpr} gl={{ antialias: !weakDevice }} camera={{ fov: 52, position: [0, 8.6, 1.6], near: 0.1, far: 60 }} onCreated={({ camera }) => camera.lookAt(0, 0, -3.1)}>
            <Lane g={g} pointer={pointer} finger={finger} />
          </Canvas>
        </div>
        <Count n={n} go={t('Pschiiit !')} />
        {hud.said && <div key={hud.said} className="animate-pop pointer-events-none absolute inset-x-0 top-1/3 px-4 text-center font-display text-[34px] leading-tight font-extrabold text-white [text-shadow:0_4px_0_rgba(0,0,0,0.5)]">{hud.said}</div>}
      </div>
      <p className="px-3 pt-1 pb-[max(0.75rem,var(--sab,env(safe-area-inset-bottom)))] text-center text-[12px] font-bold text-white/60">{t('Glisse le doigt pour déplacer la bombe : elle tire toute seule.')}</p>
    </div>
  )
}

/* ---------- The lane in 3D ---------- */

type G = { x: number; t: number; bugs: Bug[]; shots: Shot[]; lives: number; safe: number; coil: number; coilAt: { x: number; y: number } | null; pops: { x: number; y: number; t: number; text: string }[]; splats: { x: number; y: number; t: number; big: boolean; drops: [number, number][] }[]; shake: number }

/** The game's units (x across, y down the screen) on the lagoon: x across, y towards the camera. */
const S = 1 / 80
const wx = (x: number) => (x - W / 2) * S
const wz = (y: number) => (y - Y) * S
const BUGS = 16
const SHOTS = 48
const DROPS = 12 * 18
const box = new THREE.BoxGeometry(1, 1, 1)
const BODY = new THREE.MeshLambertMaterial({ color: '#2b2b2b' })
const STRIPE = new THREE.MeshLambertMaterial({ color: '#f1f3f5' })
const WING = new THREE.MeshBasicMaterial({ color: '#dcebff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
const EYE = new THREE.MeshBasicMaterial({ color: '#ff2a2a' })
const M = new THREE.Matrix4()
const C = new THREE.Color()
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.25)
const ray = new THREE.Raycaster()
const hitP = new THREE.Vector3()
const ndc = new THREE.Vector2()
const popTex = new Map<string, THREE.CanvasTexture>()
function popTexture(text: string) {
  let tx = popTex.get(text)
  if (tx) return tx
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 96
  const g = c.getContext('2d')!
  g.font = "900 64px 'Baloo 2', system-ui, sans-serif"
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineWidth = 10
  g.strokeStyle = 'rgba(7,10,28,0.9)'
  g.strokeText(text, 128, 52)
  g.fillStyle = text.startsWith('+') ? '#ffd43b' : text.startsWith('−') || text.endsWith('!') ? '#ff8787' : '#8ce99a'
  g.fillText(text, 128, 52)
  tx = new THREE.CanvasTexture(c)
  tx.colorSpace = THREE.SRGBColorSpace
  popTex.set(text, tx)
  return tx
}

function Lane({ g, pointer, finger }: { g: React.RefObject<G>; pointer: React.RefObject<{ x: number; y: number } | null>; finger: React.MutableRefObject<number | null> }) {
  const { camera } = useThree()
  const bugs = useRef<(THREE.Group | null)[]>([])
  const shots = useRef<THREE.InstancedMesh>(null)
  const drops = useRef<THREE.InstancedMesh>(null)
  const can = useRef<THREE.Group>(null)
  const coil = useRef<THREE.Mesh>(null)
  const pops = useRef<(THREE.Sprite | null)[]>([])
  const water = useRef<THREE.Mesh>(null)
  const glints = useRef<THREE.Group>(null)
  const base = useMemo(() => camera.position.clone(), [camera])
  useFrame(({ clock }) => {
    const s = g.current
    if (!s) return
    const now = clock.elapsedTime
    // The finger, on the bombe's line.
    const p = pointer.current
    if (p) {
      ray.setFromCamera(ndc.set(p.x, p.y), camera)
      if (ray.ray.intersectPlane(plane, hitP)) finger.current = clamp(hitP.x / S + W / 2, 18, W - 18)
    }
    // A bite or the boss down: the camera shakes.
    camera.position.set(base.x + (s.shake > 0 ? (Math.random() - 0.5) * 0.3 * s.shake : 0), base.y + (s.shake > 0 ? (Math.random() - 0.5) * 0.3 * s.shake : 0), base.z)
    // The bombe: a little lean the way it moves, blinking while bitten.
    if (can.current) {
      const x = wx(s.x)
      can.current.rotation.z = clamp((can.current.position.x - x) * 4, -0.35, 0.35)
      can.current.position.set(x, 0, 0)
      can.current.visible = !(s.safe > 0 && Math.floor(s.t * 12) % 2)
    }
    // The mosquitoes: body, stripes, wings beating, red eyes when they dive.
    bugs.current.forEach((grp, i) => {
      if (!grp) return
      const b = s.bugs[i]
      grp.visible = !!b && b.hp > 0
      if (!b || b.hp <= 0) return
      const k = (b.boss ? KB : K) * 0.13
      grp.position.set(wx(b.x), 0.5 + Math.sin(b.phase * 3) * 0.05 + (b.boss ? 0.4 : 0), wz(b.y))
      grp.scale.setScalar(k)
      grp.rotation.set(b.dive ? 0.5 : 0.15, Math.sin(b.phase * 2.2) * 0.3, 0)
      const flap = Math.sin(b.phase * 40) * 0.6
      const [, , l, r, stripes, eyes] = grp.children
      l.rotation.z = 0.3 + flap
      r.rotation.z = -0.3 - flap
      stripes.visible = b.tiger
      eyes.visible = !!(b.boss || b.dive)
    })
    // The sprays and the larvae.
    const sm = shots.current
    if (sm) {
      let k = 0
      for (const sh of s.shots) {
        if (k >= SHOTS) break
        M.makeScale(sh.foe ? 0.09 : 0.05, sh.foe ? 0.09 : 0.05, sh.foe ? 0.12 : 0.18).setPosition(wx(sh.x), sh.foe ? 0.5 : 0.35, wz(sh.y))
        sm.setMatrixAt(k, M)
        sm.setColorAt(k, C.set(sh.foe ? '#8ce99a' : '#e3fafc'))
        k++
      }
      sm.count = k
      sm.instanceMatrix.needsUpdate = true
      if (sm.instanceColor) sm.instanceColor.needsUpdate = true
    }
    // The ones that burst: red cubes flying out and falling.
    const dm = drops.current
    if (dm) {
      let k = 0
      for (const sp of s.splats) {
        const e = 1 - sp.t / 0.6
        const r = (sp.big ? 1.0 : 0.4) * e
        for (const [dx, dy] of sp.drops) {
          if (k >= DROPS) break
          const sz = (sp.big ? 0.08 : 0.05) * (1 - e * 0.6)
          M.makeScale(sz, sz, sz).setPosition(wx(sp.x) + dx * r, Math.max(0.02, 0.5 + (sp.big ? 0.4 : 0) + Math.abs(dy) * r * 0.6 - 1.4 * e * e), wz(sp.y) + dy * r * 0.5)
          dm.setMatrixAt(k, M)
          k++
        }
      }
      dm.count = k
      dm.instanceMatrix.needsUpdate = true
    }
    if (coil.current) {
      coil.current.visible = !!s.coilAt
      if (s.coilAt) (coil.current.position.set(wx(s.coilAt.x), 0.3, wz(s.coilAt.y)), (coil.current.rotation.z = now * 4))
    }
    pops.current.forEach((sp, i) => {
      if (!sp) return
      const pp = s.pops[s.pops.length - 1 - i]
      sp.visible = !!pp
      if (!pp) return
      const m = sp.material as THREE.SpriteMaterial
      const tx = popTexture(pp.text)
      if (m.map !== tx) ((m.map = tx), (m.needsUpdate = true))
      m.opacity = Math.min(1, pp.t * 2)
      sp.position.set(wx(pp.x), 0.9 + (1 - pp.t) * 0.5, wz(pp.y))
    })
    // The water going by under the bombe: glints of the moon drifting down the lane.
    glints.current?.children.forEach((m, k) => {
      const z = ((now * 0.9 + k * 0.83) % 7.5) - 6.6
      m.position.set(((k * 37) % 9) * 0.5 - 2.2, 0.01, z)
    })
    if (water.current) (water.current.material as THREE.MeshStandardMaterial).color.setHSL(0.58, 0.55, 0.16 + Math.sin(now * 0.7) * 0.01)
  })
  return (
    <>
      <color attach="background" args={['#0b1030']} />
      <fog attach="fog" args={['#0b1030', 12, 30]} />
      <hemisphereLight args={['#8fa6ff', '#0e3a4a', 0.9]} />
      <directionalLight position={[3, 6, 4]} intensity={0.9} color="#fff3d6" />
      {/* The lagoon at night, the moon up there, the far bank's lights. */}
      <mesh ref={water} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -6]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#123a52" roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh position={[5, 6, -22]}>
        <circleGeometry args={[1.4, 16]} />
        <meshBasicMaterial color="#fff3bf" fog={false} />
      </mesh>
      {Array.from({ length: 14 }, (_, k) => (
        <mesh key={k} geometry={box} position={[-12 + k * 1.9, 0.2 + (k % 3) * 0.25, -18]} scale={[0.6 + (k % 2) * 0.4, 0.4 + (k % 4) * 0.5, 0.6]}>
          <meshBasicMaterial color={k % 3 ? '#ffcf70' : '#1b2a5a'} />
        </mesh>
      ))}
      {[-1, 1].map((side) =>
        Array.from({ length: 9 }, (_, k) => <mesh key={`${side}${k}`} geometry={box} position={[side * (W / 2 + 14) * S, 0.12 + (k % 3) * 0.05, -k * 0.85 + 0.6]} scale={[0.1, 0.3 + (k % 3) * 0.1, 0.1]}><meshLambertMaterial color="#2f6b3a" /></mesh>),
      )}
      <group ref={glints}>
        {Array.from({ length: 9 }, (_, k) => (
          <mesh key={k} geometry={box} scale={[0.35 + (k % 3) * 0.15, 0.01, 0.03]}>
            <meshBasicMaterial color="#a5d8ff" transparent opacity={0.35} />
          </mesh>
        ))}
      </group>
      {/* The bombe PAF: red, its white band, the nozzle. */}
      <group ref={can} scale={0.7}>
        <mesh geometry={box} position={[0, 0.45, 0]} scale={[0.5, 0.9, 0.5]}>
          <meshLambertMaterial color="#e03131" />
        </mesh>
        <mesh geometry={box} position={[0, 0.5, 0]} scale={[0.52, 0.26, 0.52]}>
          <meshLambertMaterial color="#f8f9fa" />
        </mesh>
        <mesh geometry={box} position={[0, 0.98, 0]} scale={[0.3, 0.14, 0.3]}>
          <meshLambertMaterial color="#adb5bd" />
        </mesh>
        <mesh geometry={box} position={[0, 1.08, -0.08]} scale={[0.1, 0.1, 0.2]}>
          <meshLambertMaterial color="#495057" />
        </mesh>
      </group>
      {/* The mosquitoes, a pool of them. */}
      {Array.from({ length: BUGS }, (_, i) => (
        <group key={i} ref={(el) => void (bugs.current[i] = el)} visible={false}>
          <mesh geometry={box} material={BODY} scale={[0.5, 0.5, 1.6]} />
          <mesh geometry={box} material={BODY} position={[0, -0.1, -1.3]} scale={[0.12, 0.12, 1.2]} />
          <mesh geometry={box} material={WING} position={[-0.9, 0.3, 0]} scale={[1.6, 0.04, 0.7]} />
          <mesh geometry={box} material={WING} position={[0.9, 0.3, 0]} scale={[1.6, 0.04, 0.7]} />
          <group>
            {[-0.4, 0, 0.4].map((z) => (
              <mesh key={z} geometry={box} material={STRIPE} position={[0, 0, z + 0.2]} scale={[0.52, 0.52, 0.12]} />
            ))}
          </group>
          <group>
            <mesh geometry={box} material={EYE} position={[-0.15, 0.15, -0.8]} scale={0.15} />
            <mesh geometry={box} material={EYE} position={[0.15, 0.15, -0.8]} scale={0.15} />
          </group>
        </group>
      ))}
      <instancedMesh ref={shots} args={[box, undefined, SHOTS]} frustumCulled={false}>
        <meshBasicMaterial />
      </instancedMesh>
      <instancedMesh ref={drops} args={[box, undefined, DROPS]} frustumCulled={false}>
        <meshLambertMaterial color="#c92a2a" />
      </instancedMesh>
      <mesh ref={coil} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[0.16, 0.035, 6, 16]} />
        <meshBasicMaterial color="#51cf66" />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <sprite key={i} ref={(el) => void (pops.current[i] = el)} scale={[0.9, 0.34, 1]} visible={false}>
          <spriteMaterial transparent depthTest={false} />
        </sprite>
      ))}
    </>
  )
}
