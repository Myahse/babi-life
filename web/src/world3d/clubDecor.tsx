import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { NoShadows } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import { rng } from './themes'
import { worldTime } from '../lib/worldClock'
import { lastBillets, useBillets } from './clubBillets'
import { TalkHuman } from './Talkable'

// The club inside (Interior's club room, 12 × 9, the camera from +x +z):
// the stage at the back with the DJ, his decks and the LED wall behind him
// with the club's name; the speaker stacks; the bar along the back wall on
// the left, its bottles lit from behind and its barman; the VIP corner on
// its carpet behind a velvet rope; the mirror ball, the moving beams and,
// on the full nights, the lasers and the smoke over the floor; and the
// dancers on their two podiums by the stage, a woman and a man, dressed for
// the show, who answer the notes thrown at them (the « Lancer des billets »
// button: clubBillets.ts). Each club its own: Zone 4 black and gold, the
// Rue Princesse a street club in the flag's colours with its garlands.

type Style = { name: string; colors: string[]; bar: string; barTop: string; carpet: string; rope: string; trim: string; bunting: boolean }
const STYLES: Record<string, Style> = {
  'marcory-zone4': { name: 'ZONE 4', colors: ['#d4af37', '#ff2d95', '#7a5cff', '#ffffff'], bar: '#141217', barTop: '#d4af37', carpet: '#5a0f1a', rope: '#b3122e', trim: '#d4af37', bunting: false },
  'yop-rue-princesse': { name: 'RUE PRINCESSE', colors: ['#f07a12', '#ffffff', '#0b9a52', '#ffe600'], bar: '#6b3a1e', barTop: '#c9883a', carpet: '#7a3a22', rope: '#f07a12', trim: '#0b9a52', bunting: true },
}
const PLAIN: Style = { name: 'BABI NIGHT', colors: ['#ff2d95', '#2ee6ff', '#ffe600', '#7a5cff'], bar: '#1b1530', barTop: '#2ee6ff', carpet: '#3d1b4a', rope: '#b3122e', trim: '#2ee6ff', bunting: false }
export const clubStyle = (placeId: string) => STYLES[placeId] ?? PLAIN

/** The podiums (by the stage): where the dancers are, and where the notes fly. */
export const PODIUMS: [number, number, number][] = [
  [-0.6, 0.6, -2.1],
  [3.6, 0.6, -2.1],
]

const M = (c: string, glow = 0) => new THREE.MeshStandardMaterial({ color: c, emissive: glow ? c : '#000000', emissiveIntensity: glow, roughness: 0.6 })

/** The LED wall behind the DJ: the club's name over an equaliser, redrawn as it plays. */
function LedWall({ style }: { style: Style }) {
  const { tex, draw } = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 256
    const g = c.getContext('2d')!
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    const draw = (time: number) => {
      g.fillStyle = '#05040a'
      g.fillRect(0, 0, 512, 256)
      // The bars dancing to the beat, in the club's colours
      for (let i = 0; i < 32; i++) {
        const h = (0.25 + 0.75 * Math.abs(Math.sin(time * 2.1 + i * 0.7) * Math.cos(time * 1.3 + i * 0.31))) * 150
        g.fillStyle = style.colors[i % style.colors.length]
        g.globalAlpha = 0.55
        g.fillRect(i * 16 + 2, 256 - h, 12, h)
      }
      g.globalAlpha = 1
      g.font = '900 64px sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      const k = Math.min(1, 470 / g.measureText(style.name).width)
      g.font = `900 ${Math.floor(64 * k)}px sans-serif`
      g.fillStyle = style.colors[Math.floor(time / 2) % style.colors.length]
      g.fillText(style.name, 256, 80)
      t.needsUpdate = true
    }
    return { tex: t, draw }
  }, [style])
  const last = useRef(0)
  useFrame(() => {
    const t = worldTime()
    if (t - last.current < 0.08) return
    last.current = t
    draw(t)
  })
  return (
    <mesh position={[1.5, 1.95, -4.36]}>
      <planeGeometry args={[3.6, 1.8]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  )
}

/** The stage, the DJ's desk, its two decks turning and the mixer, the laptop; the DJ himself. */
function DjBooth({ style, placeId }: { style: Style; placeId: string }) {
  const decks = useRef<THREE.Group>(null)
  useFrame(() => {
    decks.current?.children.forEach((d, i) => (d.rotation.y = worldTime() * (i ? -3.3 : 3.3)))
  })
  const dj = useMemo(() => ({ ...randomLook('homme', rng(`dj${placeId}`)), outfit: 'blouson', accessory: 'sunglasses' }), [placeId])
  return (
    <group>
      <mesh position={[1.5, 0.175, -3.75]} material={M('#141416')}>
        <boxGeometry args={[3.8, 0.35, 1.4]} />
      </mesh>
      <mesh position={[1.5, 0.36, -3.06]} material={M(style.trim, 1.2)}>
        <boxGeometry args={[3.8, 0.04, 0.04]} />
      </mesh>
      {/* The desk, its lit front */}
      <mesh position={[1.5, 0.85, -3.35]} material={M('#1b1b1f')}>
        <boxGeometry args={[2.2, 1, 0.6]} />
      </mesh>
      <mesh position={[1.5, 0.75, -3.04]} material={M(style.colors[0], 1)}>
        <boxGeometry args={[2.1, 0.08, 0.02]} />
      </mesh>
      <group ref={decks}>
        {[0.95, 2.05].map((x) => (
          <mesh key={x} position={[x, 1.37, -3.35]} material={M('#0d0d10')}>
            <cylinderGeometry args={[0.24, 0.24, 0.03, 20]} />
          </mesh>
        ))}
      </group>
      <mesh position={[1.5, 1.38, -3.35]} material={M('#2a2a30')}>
        <boxGeometry args={[0.35, 0.05, 0.4]} />
      </mesh>
      <mesh position={[1.5, 1.5, -3.5]} rotation={[-0.4, 0, 0]} material={M('#cfe8ff', 0.6)}>
        <boxGeometry args={[0.4, 0.26, 0.02]} />
      </mesh>
      <group position={[1.5, 0.35, -4.0]}>
        <TalkHuman id={`dj-${placeId}`} look={dj} gender="homme" pose="dance" seed={7} />
      </group>
    </group>
  )
}

function SpeakerStack({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      {[0.6, 1.8].map((y) => (
        <group key={y}>
          <mesh position={[0, y, 0]} material={M('#121214')}>
            <boxGeometry args={[0.9, 1.15, 0.75]} />
          </mesh>
          {[0.25, -0.2].map((dy) => (
            <mesh key={dy} position={[0, y + dy, 0.38]} rotation={[Math.PI / 2, 0, 0]} material={M('#2c2f36')}>
              <cylinderGeometry args={[dy > 0 ? 0.18 : 0.3, dy > 0 ? 0.18 : 0.3, 0.02, 18]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/** The bar along the back wall: the counter and its lit edge, the shelves of bottles lit from behind, the barman, the stools. */
function Bar({ style, placeId }: { style: Style; placeId: string }) {
  const bottles = useMemo(() => {
    const r = rng(`bar${placeId}`)
    return [...Array(18)].map((_, i) => ({ x: -5 + (i % 9) * 0.42, y: 1.35 + Math.floor(i / 9) * 0.55, c: ['#2f6b3a', '#7a1f2b', '#c9a227', '#3a5a8a', '#e8e3d6'][Math.floor(r() * 5)] }))
  }, [placeId])
  const barman = useMemo(() => ({ ...randomLook('homme', rng(`barman${placeId}`)), outfit: 'chemise', outfitColor: '#111111' }), [placeId])
  return (
    <group>
      {/* The back: lit shelves, the bottles */}
      <mesh position={[-3.3, 1.75, -4.42]} material={M(style.colors[2], 0.5)}>
        <boxGeometry args={[3.8, 1.4, 0.04]} />
      </mesh>
      {[1.2, 1.75].map((y) => (
        <mesh key={y} position={[-3.3, y, -4.3]} material={M('#d9dde2')}>
          <boxGeometry args={[3.8, 0.04, 0.25]} />
        </mesh>
      ))}
      {bottles.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, -4.3]} material={M(b.c)}>
          <cylinderGeometry args={[0.06, 0.06, 0.3, 8]} />
        </mesh>
      ))}
      {/* The counter, its top, its glowing edge */}
      <mesh position={[-3.4, 0.55, -3.6]} material={M(style.bar)}>
        <boxGeometry args={[3.6, 1.1, 0.6]} />
      </mesh>
      <mesh position={[-3.4, 1.12, -3.6]} material={M(style.barTop)}>
        <boxGeometry args={[3.7, 0.05, 0.7]} />
      </mesh>
      <mesh position={[-3.4, 0.08, -3.28]} material={M(style.trim, 1.2)}>
        <boxGeometry args={[3.6, 0.04, 0.02]} />
      </mesh>
      <group position={[-3.4, 0, -4.05]}>
        <TalkHuman id={`barman-${placeId}`} look={barman} gender="homme" pose="busy" seed={3} />
      </group>
      {[-1.6, -2.3].map((x) => (
        <group key={x} position={[x, 0, -3.05]}>
          <mesh position={[0, 0.7, 0]} material={M(style.barTop)}>
            <cylinderGeometry args={[0.2, 0.2, 0.06, 12]} />
          </mesh>
          <mesh position={[0, 0.35, 0]} material={M('#3a3f4b')}>
            <cylinderGeometry args={[0.04, 0.04, 0.7, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** The VIP corner: its carpet, the velvet rope on brass posts, open in the middle. */
function Vip({ style }: { style: Style }) {
  const posts = [-2.8, -1.4, 1.4, 2.8]
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4.5, 0.012, 0]}>
        <planeGeometry args={[3, 6.2]} />
        <meshStandardMaterial color={style.carpet} roughness={0.9} />
      </mesh>
      {posts.map((z) => (
        <group key={z} position={[-2.75, 0, z]}>
          <mesh position={[0, 0.5, 0]} material={M('#c9a227')}>
            <cylinderGeometry args={[0.04, 0.06, 1, 8]} />
          </mesh>
          <mesh position={[0, 1.02, 0]} material={M('#c9a227')}>
            <sphereGeometry args={[0.07, 8, 6]} />
          </mesh>
        </group>
      ))}
      {[
        [-2.8, -1.4],
        [1.4, 2.8],
      ].map(([a, b]) => (
        <mesh key={a} position={[-2.75, 0.85, (a + b) / 2]} material={M(style.rope)}>
          <boxGeometry args={[0.05, 0.05, b - a]} />
        </mesh>
      ))}
    </group>
  )
}

/** The mirror ball over the floor, the beams sweeping from the rig, the lasers and the smoke on the full nights. */
function Lights({ style, fill }: { style: Style; fill: number }) {
  const ball = useRef<THREE.Mesh>(null)
  const beams = useRef<THREE.Group>(null)
  const lasers = useRef<THREE.Group>(null)
  const spots = useRef<THREE.Group>(null)
  const beamMats = useMemo(() => style.colors.map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })), [style])
  const laserMat = useMemo(() => new THREE.MeshBasicMaterial({ color: style.colors[2], transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), [style])
  const smoke = useMemo(() => [...Array(10)].map((_, i) => ({ x: -0.8 + (i % 5) * 1.2, z: -1 + Math.floor(i / 5) * 2.2, s: 1 + (i % 3) * 0.4 })), [])
  const smokeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#b9a6ff', transparent: true, opacity: 0.08, depthWrite: false }), [])
  useFrame(() => {
    const t = worldTime()
    if (ball.current) ball.current.rotation.y = t * 0.6
    beams.current?.children.forEach((b, i) => {
      b.rotation.x = Math.sin(t * 0.9 + i * 1.3) * 0.5
      b.rotation.z = Math.cos(t * 0.7 + i) * 0.5
    })
    lasers.current?.children.forEach((l, i) => (l.rotation.y = Math.sin(t * 1.4 + i * 0.6) * 0.9))
    spots.current?.children.forEach((s, i) => {
      const light = s as THREE.PointLight
      light.color.set(style.colors[(Math.floor(t * 1.5) + i) % style.colors.length])
    })
  })
  const full = fill >= 0.5
  return (
    <group>
      <mesh ref={ball} position={[1.5, 2.75, 0.5]}>
        <icosahedronGeometry args={[0.32, 1]} />
        <meshStandardMaterial color="#e8e8ee" metalness={1} roughness={0.12} flatShading />
      </mesh>
      {/* The rig across the room, its beams */}
      <mesh position={[1.5, 3.05, -1]} material={M('#2a2a30')}>
        <boxGeometry args={[6, 0.08, 0.08]} />
      </mesh>
      <group ref={beams}>
        {[-0.8, 0.7, 2.3, 3.8].map((x, i) => (
          <group key={x} position={[x, 3, -1]}>
            <mesh position={[0, -1.5, 0]} material={beamMats[i % beamMats.length]}>
              <coneGeometry args={[0.7, 3, 16, 1, true]} />
            </mesh>
          </group>
        ))}
      </group>
      <group ref={spots}>
        {[0, 1, 2].map((i) => (
          <pointLight key={i} position={[-0.5 + i * 2, 2.6, 0.5]} intensity={8} distance={7} />
        ))}
      </group>
      {full && (
        <group ref={lasers} position={[1.5, 1.6, -3.1]}>
          {[...Array(7)].map((_, i) => (
            <mesh key={i} rotation={[0, 0, 0]} material={laserMat}>
              <boxGeometry args={[0.012, 0.012, 9]} />
            </mesh>
          ))}
        </group>
      )}
      {full &&
        smoke.map((s, i) => (
          <mesh key={i} position={[s.x, 0.25, s.z]} scale={[s.s, 0.35, s.s]} material={smokeMat}>
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
        ))}
    </group>
  )
}

/** The Rue Princesse's garlands of little flags, the colours of the country, across the room. */
function Bunting() {
  const flags = useMemo(() => [...Array(24)].map((_, i) => ({ x: -5.5 + (i % 12) * 1, z: i < 12 ? -2.5 : 1.5, c: ['#f07a12', '#ffffff', '#0b9a52'][i % 3] })), [])
  return (
    <group>
      {flags.map((f, i) => (
        <mesh key={i} position={[f.x, 2.85 - Math.sin(((i % 12) / 11) * Math.PI) * 0.25, f.z]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.16, 0.3, 3]} />
          <meshStandardMaterial color={f.c} />
        </mesh>
      ))}
    </group>
  )
}

/** The dancers on their podiums, dressed for the show; a throw of notes their way and they answer it. */
function Podiums({ style, placeId }: { style: Style; placeId: string }) {
  const looks = useMemo(() => {
    const r = rng(`podium${placeId}`)
    return [
      { ...randomLook('femme', r), outfit: 'robe', outfitColor: style.colors[0], accessory: 'earrings' },
      { ...randomLook('homme', r), outfit: 'bazin', outfitColor: '#ffffff', accessory: 'sunglasses' },
    ]
  }, [placeId, style])
  const b = useBillets()
  const [hype, setHype] = useState(false)
  useEffect(() => {
    if (!b.n) return
    setHype(true)
    const t = setTimeout(() => setHype(false), 2600)
    return () => clearTimeout(t)
  }, [b.n])
  return (
    <group>
      {PODIUMS.map((p, i) => (
        <group key={i}>
          <mesh position={[p[0], 0.3, p[2]]} material={M('#1b1b1f')}>
            <cylinderGeometry args={[0.5, 0.55, 0.6, 20]} />
          </mesh>
          <mesh position={[p[0], 0.61, p[2]]} material={M(style.trim, 1)}>
            <cylinderGeometry args={[0.5, 0.5, 0.02, 20]} />
          </mesh>
          <spotLight position={[p[0], 3, p[2] + 0.5]} target-position={[p[0], 0.6, p[2]]} intensity={hype ? 40 : 18} distance={5} angle={0.5} penumbra={0.5} color={style.colors[i % style.colors.length]} />
          <group position={p} rotation={[0, i ? -0.5 : 0.5, 0]}>
            <TalkHuman id={`podium-${placeId}-${i}`} look={looks[i]} gender={i ? 'homme' : 'femme'} pose={hype ? 'cheer' : 'dance'} seed={i + 11} />
          </group>
        </group>
      ))}
    </group>
  )
}

/** Everything the club room adds for the night (Interior draws the room, the sofas and the crowd). */
export function ClubDecor({ placeId, fill }: { placeId: string; fill: number }) {
  const style = clubStyle(placeId)
  return (
    <group>
      <LedWall style={style} />
      <DjBooth style={style} placeId={placeId} />
      <SpeakerStack p={[-0.9, 0, -3.95]} />
      <SpeakerStack p={[3.9, 0, -3.95]} />
      <Bar style={style} placeId={placeId} />
      <Vip style={style} />
      <Lights style={style} fill={fill} />
      {style.bunting && <Bunting />}
      {fill > 0 && (
        <NoShadows>
          <Podiums style={style} placeId={placeId} />
        </NoShadows>
      )}
    </group>
  )
}

/* ---------- The notes thrown: from the Sim's hand to the podiums ---------- */

const NOTES = 60
const noteGeo = new THREE.PlaneGeometry(0.16, 0.08)
const noteMat = new THREE.MeshLambertMaterial({ color: '#c8e6b0', side: THREE.DoubleSide })

/**
 * Inside the Sim's own group (Interior's WalkTo): each throw (the button) sends
 * a handful flying from its hand to the nearest podium, a bigger one for more
 * money; they flutter down there and lie a while.
 */
export function BilletsBurst() {
  const anchor = useRef<THREE.Group>(null)
  const mesh = useRef<THREE.InstancedMesh>(null)
  const seen = useRef(lastBillets().n)
  const notes = useRef<{ p: THREE.Vector3; v: THREE.Vector3; spin: number; born: number; landed: boolean }[]>([])
  const o = useMemo(() => new THREE.Object3D(), [])
  useFrame((_, dtIn) => {
    const dt = Math.min(dtIn, 0.05)
    const g = anchor.current
    const m = mesh.current
    if (!g || !m) return
    const b = lastBillets()
    if (b.n !== seen.current) {
      seen.current = b.n
      // Toward the nearer podium, in the Sim's own frame.
      const me = new THREE.Vector3()
      g.getWorldPosition(me)
      const [px, , pz] = PODIUMS.reduce((a, c) => (Math.hypot(c[0] - me.x, c[2] - me.z) < Math.hypot(a[0] - me.x, a[2] - me.z) ? c : a))
      const target = g.worldToLocal(new THREE.Vector3(px, 1.2, pz))
      const n = b.amount >= 10000 ? 36 : b.amount >= 5000 ? 22 : 10
      const r = rng(`throw${b.n}`)
      for (let i = 0; i < n; i++) {
        const dir = target.clone().sub(new THREE.Vector3(0.3, 1.72, 0.3))
        const flight = 0.9 + r() * 0.3
        notes.current.push({
          p: new THREE.Vector3(0.3, 1.72, 0.3),
          v: new THREE.Vector3(dir.x / flight + (r() - 0.5) * 1.2, dir.y / flight + 2.6 + r() * 0.8, dir.z / flight + (r() - 0.5) * 1.2),
          spin: 4 + r() * 8,
          born: performance.now() + i * 25,
          landed: false,
        })
      }
      notes.current = notes.current.slice(-NOTES)
    }
    const now = performance.now()
    notes.current = notes.current.filter((x) => now - x.born < 7000)
    notes.current.forEach((x, i) => {
      if (now >= x.born && !x.landed) {
        x.v.y -= 6 * dt
        // The air holds them once they fall: a flutter.
        if (x.v.y < -0.9) x.v.multiplyScalar(0.9)
        x.p.addScaledVector(x.v, dt)
        if (x.p.y <= 0.03) ((x.p.y = 0.03), (x.landed = true))
      }
      const t = (now - x.born) / 1000
      o.position.copy(x.p)
      o.rotation.set(x.landed ? -Math.PI / 2 : t * x.spin, t * x.spin * 0.7, 0)
      o.scale.setScalar(now < x.born ? 0 : 1)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    for (let i = notes.current.length; i < NOTES; i++) {
      o.scale.setScalar(0)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <group ref={anchor}>
      <instancedMesh ref={mesh} args={[noteGeo, noteMat, NOTES]} frustumCulled={false} />
    </group>
  )
}
