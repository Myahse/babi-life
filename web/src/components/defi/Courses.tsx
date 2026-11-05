import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { fcfa } from '../../game/rules'
import { PRODUCTS } from './Pixels'
import { haptic } from '../../lib/native'
import { sfx } from '../../lib/sfx'
import { sceneDpr, weakDevice } from '../../lib/device'
import { t as tr } from '../../lib/i18n'

// Le défi des courses: the list in hand, the shelves going by as the trolley
// goes down the aisle (three of them, one way and the other), in 3D: each
// thing on the shelf built of the game's blocks (its little picture pushed out
// into cubes). A tap on a thing that's on the list takes it off the shelf: it
// flies into the trolley in front and lands on what's already in it; a thing
// that isn't costs time (it shakes, red). Everything found before the time's
// up, the quicker the better, nothing silly bought: that's good shopping. At
// the supermarket the list is longer than at the boutique.

const PER_ROW = 7
/** The shelves' speeds (m/s, one way and the other), their heights; the space between two things (m); a cube's size. */
const SPEEDS = [0.36, -0.44, 0.4]
const LEVELS = [0.98, 0.58, 0.18]
const SPACE = 0.27
const VOX = 0.02
const STRIP = PER_ROW * SPACE

const shuffle = <T,>(a: T[]) => {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

/** The score: what was found, time left once all was, few mistakes. */
export function coursesScore(found: number, wanted: number, left: number, time: number, mistakes: number) {
  const all = found >= wanted
  return Math.round(Math.max(0, Math.min(100, (found / wanted) * 70 + (all ? (left / time) * 20 : 0) + Math.max(0, 10 - mistakes * 4))))
}

/** A product's picture as cubes: each coloured cell one cube, centred, standing on its base. */
function voxels(id: string) {
  const p = PRODUCTS[id]
  const out: { x: number; y: number; c: THREE.Color }[] = []
  const h = p.rows.length
  const w = p.rows[0].length
  p.rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const col = p.palette[ch]
      if (col) out.push({ x: (x - (w - 1) / 2) * VOX, y: (h - 1 - y) * VOX + VOX / 2, c: new THREE.Color(col) })
    }),
  )
  return out
}

type Shared = { t: number; taken: Set<string>; squeezed: number; wrong: { row: number; slot: number; at: number } | null; fly: { id: string; from: THREE.Vector3; at: number; n: number }[] }

export function CoursesDefi({ big, onEnd }: { /** At the supermarket: a longer list, a little more time. */ big: boolean; onEnd: (score: number) => void }) {
  const time = big ? 34 : 24
  const ids = Object.keys(PRODUCTS)
  const want = useMemo(() => shuffle(ids).slice(0, big ? 6 : 4), []) // eslint-disable-line react-hooks/exhaustive-deps
  // The shelves: every thing on the list somewhere, among others.
  const rows = useMemo(() => {
    const others = ids.filter((id) => !want.includes(id))
    const pool = shuffle([...want, ...shuffle([...others, ...others]).slice(0, PER_ROW * 3 - want.length)])
    return [0, 1, 2].map((r) => pool.slice(r * PER_ROW, (r + 1) * PER_ROW))
  }, [want]) // eslint-disable-line react-hooks/exhaustive-deps
  const [found, setFound] = useState<string[]>([])
  const [wrong, setWrong] = useState(false)
  const mistakes = useRef(0)
  const lost = useRef(0)
  const t0 = useRef(performance.now())
  const [now, setNow] = useState(performance.now())
  const over = useRef(false)
  const shared = useRef<Shared>({ t: 0, taken: new Set(), squeezed: 0, wrong: null, fly: [] })

  const elapsed = (now - t0.current) / 1000 + lost.current
  const left = Math.max(0, time - elapsed)
  const finish = (n = found.length) => {
    if (over.current) return
    over.current = true
    setTimeout(() => onEnd(coursesScore(n, want.length, left, time, mistakes.current)), 900)
  }
  // The clock, a few times a second (the shelves move on their own, in the 3D).
  useEffect(() => {
    const iv = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(iv)
  }, [])
  useEffect(() => {
    if (left <= 0) finish()
  }, [left <= 0]) // eslint-disable-line react-hooks/exhaustive-deps

  /** A thing touched on a shelf (its row, its place on it, where it was). */
  const take = (row: number, slot: number, at: THREE.Vector3, raw: number) => {
    if (over.current) return
    const id = rows[row][slot % PER_ROW]
    const sh = shared.current
    if (want.includes(id) && !found.includes(id)) {
      const next = [...found, id]
      haptic(next.length === want.length ? 'success' : 'light')
      sfx.pop()
      setFound(next)
      sh.taken.add(id)
      sh.fly.push({ id, from: at.clone(), at: sh.t, n: next.length - 1 })
      if (next.length === want.length) finish(next.length)
    } else {
      // Not on the list (or already in the trolley): two seconds lost.
      haptic('error')
      mistakes.current++
      lost.current += 2
      sh.wrong = { row, slot: raw, at: sh.t }
      setWrong(true)
      setTimeout(() => setWrong(false), 700)
    }
  }
  const total = found.reduce((s, id) => s + PRODUCTS[id].price, 0)
  return (
    <div className="relative flex h-full flex-col">
      {/* The list, and the time */}
      <div className="px-3 pt-3">
        <div className="rounded-[18px] bg-[#fffaf0] p-2.5 text-[var(--color-ink)] shadow-[0_6px_16px_-8px_rgba(0,0,0,0.5)]" style={{ backgroundImage: 'repeating-linear-gradient(#fffaf0 0 21px, #e7e9f2 21px 22px)' }}>
          <div className="mb-1 font-display text-[13px] font-extrabold tracking-wider text-[#e05a00]">{tr('LA LISTE')}</div>
          <div className="flex flex-wrap gap-1.5">
            {want.map((id) => {
              const got = found.includes(id)
              const main = Object.values(PRODUCTS[id].palette)[0]
              return (
                <span key={id} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] font-extrabold transition-colors ${got ? 'bg-[#d3f9d8] text-[#2b8a3e] line-through' : 'bg-white'}`}>
                  <span className="h-3 w-3 rounded-[3px]" style={{ background: main }} />
                  {PRODUCTS[id].name}
                  {got && ' ✓'}
                </span>
              )
            })}
          </div>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full transition-[width] duration-100" style={{ width: `${(left / time) * 100}%`, background: left < 6 ? '#e03131' : left < 12 ? '#ffc233' : '#00b86b' }} />
        </div>
        <div className="mt-1 flex justify-between text-[12px] font-extrabold text-white/80">
          <span>
            {Math.ceil(left)} {tr('s')}
          </span>
          <span>{wrong ? <span className="text-[#ff8787]">{tr('Pas sur la liste ! −2 s')}</span> : `${found.length} / ${want.length}`}</span>
        </div>
      </div>

      {/* The aisle in 3D: three shelves going by, the trolley in front. */}
      <div className="relative mx-3 my-2 min-h-0 flex-1 overflow-hidden rounded-[22px]" style={{ background: 'linear-gradient(#f4efe4, #e6dccb)' }}>
        <Canvas dpr={sceneDpr} gl={{ alpha: true, antialias: !weakDevice }} camera={{ position: [0, 0.6, 2.1], fov: 50 }} onCreated={({ camera }) => camera.lookAt(0, 0.42, 0)}>
          <hemisphereLight args={['#ffffff', '#b8a07a', 1.2]} />
          <directionalLight position={[1, 2, 2]} intensity={1.1} />
          <Aisle rows={rows} shared={shared} onTake={take} />
        </Canvas>
        <div className="pointer-events-none absolute right-3 bottom-2 text-right text-[#16161c]">
          <div className="text-[11px] font-extrabold opacity-70">{tr('Au panier')}</div>
          <div className="font-display text-[19px] font-extrabold">{fcfa(total)}</div>
        </div>
      </div>
      <div className="pb-[max(0.6rem,var(--sab,env(safe-area-inset-bottom)))]" />
    </div>
  )
}

const box = new THREE.BoxGeometry(1, 1, 1)
const WOOD = new THREE.MeshLambertMaterial({ color: '#8a5a32' })
const METAL = new THREE.MeshLambertMaterial({ color: '#9aa3b5' })
const RED = new THREE.MeshLambertMaterial({ color: '#e03131' })
const BACK = new THREE.MeshLambertMaterial({ color: '#d8ccb4' })
const BAD = new THREE.MeshBasicMaterial({ color: '#e03131', transparent: true, opacity: 0.4, depthWrite: false })
const M4 = new THREE.Matrix4()
const Q = new THREE.Quaternion()
const S = new THREE.Vector3()
const P = new THREE.Vector3()
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.06)
const ray = new THREE.Raycaster()
const hit = new THREE.Vector3()
const ndc = new THREE.Vector2()
/** Where the trolley is, and where the n-th thing lands in it. */
const TROLLEY = new THREE.Vector3(-0.05, -0.2, 0.7)
const slotIn = (n: number) => new THREE.Vector3(TROLLEY.x - 0.12 + (n % 3) * 0.12, TROLLEY.y + 0.2 + Math.floor(n / 3) * 0.1, TROLLEY.z - 0.04 + ((n >> 1) % 2) * 0.05)

function Aisle({ rows, shared, onTake }: { rows: string[][]; shared: React.RefObject<Shared>; onTake: (row: number, slot: number, at: THREE.Vector3, raw: number) => void }) {
  const { camera, gl } = useThree()
  // One block of cubes for each shelf (three copies of its seven things side by side, so it loops); the flying things, one each.
  const vox = useMemo(() => Object.fromEntries(Object.keys(PRODUCTS).map((id) => [id, voxels(id)])), [])
  const shelves = useRef<(THREE.InstancedMesh | null)[]>([])
  const groups = useRef<(THREE.Group | null)[]>([])
  const flyMesh = useRef<(THREE.InstancedMesh | null)[]>([])
  const bad = useRef<THREE.Mesh>(null)
  const counts = useMemo(() => rows.map((r) => r.reduce((n, id) => n + vox[id].length, 0) * 3), [rows, vox])
  // Where each copy of each thing is on its shelf; the cubes set once.
  useEffect(() => {
    rows.forEach((row, r) => {
      const m = shelves.current[r]
      if (!m) return
      let k = 0
      for (let copy = 0; copy < 3; copy++)
        row.forEach((id, i) => {
          const x0 = (copy * PER_ROW + i) * SPACE - STRIP
          for (const v of vox[id]) {
            M4.makeScale(VOX, VOX, VOX * 3).setPosition(x0 + v.x, v.y, 0)
            m.setMatrixAt(k, M4)
            m.setColorAt(k, v.c)
            k++
          }
        })
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    })
  }, [rows, vox])
  const offset = (r: number, t: number) => (((t * SPEEDS[r]) % STRIP) + STRIP) % STRIP
  // A tap: which shelf, which thing on it (from where the shelf has gone by now).
  useEffect(() => {
    const el = gl.domElement
    const down = (e: PointerEvent) => {
      const b = el.getBoundingClientRect()
      ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -(((e.clientY - b.top) / b.height) * 2 - 1))
      ray.setFromCamera(ndc, camera)
      if (!ray.ray.intersectPlane(plane, hit)) return
      const r = LEVELS.findIndex((y) => hit.y > y - 0.03 && hit.y < y + 0.26)
      if (r < 0) return
      const sh = shared.current
      const x = hit.x + offset(r, sh.t) + STRIP
      const slot = Math.round(x / SPACE)
      if (Math.abs(x - slot * SPACE) > SPACE * 0.48) return
      const id = rows[r][((slot % PER_ROW) + PER_ROW) % PER_ROW]
      if (sh.taken.has(id)) return
      onTake(r, ((slot % PER_ROW) + PER_ROW) % PER_ROW, new THREE.Vector3(slot * SPACE - STRIP - offset(r, sh.t), LEVELS[r] + 0.1, 0), slot)
    }
    el.addEventListener('pointerdown', down)
    return () => el.removeEventListener('pointerdown', down)
  }, [gl, camera, rows, onTake, shared])
  useFrame((_, dt) => {
    const sh = shared.current
    if (!sh) return
    sh.t += dt
    rows.forEach((row, r) => {
      const g = groups.current[r]
      if (g) g.position.x = -offset(r, sh.t)
      // A thing taken: gone from the shelf (all its copies), its cubes squeezed to nothing.
      const m = shelves.current[r]
      if (m && sh.taken.size !== sh.squeezed) {
        let k = 0
        let changed = false
        for (let copy = 0; copy < 3; copy++)
          row.forEach((id) => {
            const n = vox[id].length
            if (sh.taken.has(id)) {
              for (let j = 0; j < n; j++) {
                m.getMatrixAt(k + j, M4)
                M4.decompose(P, Q, S)
                if (S.x > 0) ((S.set(0, 0, 0), M4.compose(P, Q, S), m.setMatrixAt(k + j, M4)), (changed = true))
              }
            }
            k += n
          })
        if (changed) m.instanceMatrix.needsUpdate = true
      }
    })
    sh.squeezed = sh.taken.size
    // The things flying into the trolley: an arc, then they land and settle on the pile.
    sh.fly.forEach((f, i) => {
      const m = flyMesh.current[i]
      if (!m) return
      const u = Math.min(1, (sh.t - f.at) / 0.55)
      const to = slotIn(f.n)
      P.lerpVectors(f.from, to, u)
      P.y += Math.sin(u * Math.PI) * 0.35
      // A little bounce as it lands.
      if (u >= 1) P.y = to.y + Math.max(0, Math.sin((sh.t - f.at - 0.55) * 18) * 0.03 * Math.exp(-(sh.t - f.at - 0.55) * 8))
      m.position.copy(P)
      m.rotation.set(u < 1 ? u * 4 : 0, u < 1 ? u * 6 : 0.3 * f.n, 0)
      m.scale.setScalar(1 - 0.35 * u)
      m.visible = true
    })
    // A wrong thing: a red glow on it, a shake.
    if (bad.current) {
      const w = sh.wrong
      const on = !!w && sh.t - w.at < 0.6
      bad.current.visible = on
      if (on && w) bad.current.position.set(w.slot * SPACE - STRIP - offset(w.row, sh.t) + Math.sin((sh.t - w.at) * 60) * 0.01, LEVELS[w.row] + 0.1, 0.02)
    }
  })
  // Flying meshes: one per thing that can be on the list (six at most).
  const flyIds = shared.current?.fly.map((f) => f.id) ?? []
  return (
    <group>
      {/* The back of the shelving, its boards; the price strips along them. */}
      <mesh geometry={box} material={BACK} position={[0, 0.6, -0.16]} scale={[6, 1.5, 0.04]} />
      {LEVELS.map((y) => (
        <group key={y}>
          <mesh geometry={box} material={WOOD} position={[0, y - 0.015, -0.04]} scale={[6, 0.03, 0.3]} />
          <mesh geometry={box} material={RED} position={[0, y - 0.03, 0.115]} scale={[6, 0.035, 0.01]} />
        </group>
      ))}
      {rows.map((_, r) => (
        <group key={r} ref={(el) => void (groups.current[r] = el)} position={[0, LEVELS[r], 0]}>
          <instancedMesh ref={(el) => void (shelves.current[r] = el)} args={[box, undefined, counts[r]]} frustumCulled={false}>
            <meshLambertMaterial />
          </instancedMesh>
        </group>
      ))}
      <mesh ref={bad} geometry={box} material={BAD} scale={[0.24, 0.24, 0.12]} visible={false} />
      {/* The trolley in front: the wire basket, the handle. */}
      <group position={[TROLLEY.x, TROLLEY.y, TROLLEY.z]}>
        <mesh geometry={box} material={METAL} position={[0, 0, 0]} scale={[0.46, 0.02, 0.22]} />
        <mesh geometry={box} material={METAL} position={[0, 0.1, 0.11]} scale={[0.46, 0.2, 0.012]} />
        <mesh geometry={box} material={METAL} position={[0, 0.1, -0.11]} scale={[0.46, 0.2, 0.012]} />
        <mesh geometry={box} material={METAL} position={[-0.23, 0.1, 0]} scale={[0.012, 0.2, 0.22]} />
        <mesh geometry={box} material={METAL} position={[0.23, 0.1, 0]} scale={[0.012, 0.2, 0.22]} />
        <mesh geometry={box} material={RED} position={[0.3, 0.22, 0]} scale={[0.03, 0.03, 0.26]} />
      </group>
      {flyIds.map((id, i) => (
        <instancedMesh key={`${id}${i}`} ref={(el) => void (flyMesh.current[i] = el)} args={[box, undefined, vox[id].length]} visible={false} onUpdate={(m) => setFly(m, vox[id])}>
          <meshLambertMaterial />
        </instancedMesh>
      ))}
    </group>
  )
}

/** A flying thing's cubes, set once. */
function setFly(m: THREE.InstancedMesh, v: { x: number; y: number; c: THREE.Color }[]) {
  if (m.userData.set) return
  m.userData.set = true
  v.forEach((c, k) => {
    M4.makeScale(VOX, VOX, VOX * 3).setPosition(c.x, c.y - 0.1, 0)
    m.setMatrixAt(k, M4)
    m.setColorAt(k, c.c)
  })
  m.instanceMatrix.needsUpdate = true
  if (m.instanceColor) m.instanceColor.needsUpdate = true
}
