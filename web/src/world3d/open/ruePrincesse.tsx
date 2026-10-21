import { useMemo } from 'react'
import * as THREE from 'three'

// La Rue Princesse, Yopougon: a lane of maquis and night clubs on both sides,
// the maquis' names painted over the door, tables and plastic chairs out under
// the tin awnings, speakers stacked at the corners and strings of bulbs from
// one side to the other; the clubs dark, their names in neon, the bouncer at the
// rope and the red carpet out into the lane. The street is a place (one strolls
// it, sits at a terrace, dances in it) and its clubs are places of their own
// (backend world.Place.Parent: at their slot here). The real street was razed in
// August 2011 (« Pays propre »); the game keeps it as it is remembered. The
// names are invented.
//
// In blocks like the rest of the city: sizes go by 1.5 m, a storey is 3 m.
// The landmark's frame: +z toward the main road, where the arch stands.

const LANE = 7.5
const DEPTH = 9
const FRONT = 12
/** Where the lane runs: from the arch (+z) to the back. */
const LANE_Z: [number, number] = [-28.5, 27]

type Maquis = { name: string; wall: string; sign: string; ink: string; storeys: 1 | 2 }
const MAQUIS: Maquis[] = [
  { name: 'LE BAOBAB', wall: '#e8590c', sign: '#fff3bf', ink: '#862e00', storeys: 2 },
  { name: 'CHEZ TANTIE BINTOU', wall: '#2b8a3e', sign: '#ffffff', ink: '#1b5e20', storeys: 1 },
  { name: 'AMBIANCE FACILE', wall: '#1971c2', sign: '#ffe066', ink: '#0b3d91', storeys: 1 },
  { name: 'LE COIN CHAUD', wall: '#c2255c', sign: '#ffffff', ink: '#a61e4d', storeys: 2 },
  { name: 'ZOUGLOU CLUB', wall: '#5f3dc4', sign: '#ffd43b', ink: '#2b1a6b', storeys: 2 },
  { name: 'LE GBÊLÊ', wall: '#f08c00', sign: '#ffffff', ink: '#7a3d00', storeys: 1 },
  { name: 'MAQUIS PRESTIGE', wall: '#0c8599', sign: '#fff9db', ink: '#09505c', storeys: 1 },
  { name: 'LE SAINT-TROPEZ', wall: '#e03131', sign: '#ffffff', ink: '#8f1d1d', storeys: 2 },
]

/** Lettering in pixels: a small canvas drawn once, shown with hard edges. */
export function lettering(text: string, bg: string, ink: string, border = ink) {
  const h = 14
  const c = document.createElement('canvas')
  c.width = Math.max(48, text.length * 7 + 10)
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = bg
  g.fillRect(0, 0, c.width, h)
  g.fillStyle = border
  g.fillRect(0, 0, c.width, 1)
  g.fillRect(0, h - 1, c.width, 1)
  g.fillStyle = ink
  g.font = 'bold 11px monospace'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, c.width / 2, h / 2 + 1)
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.colorSpace = THREE.SRGBColorSpace
  return { t, aspect: c.width / h }
}

/** A sign that glows at night: its own picture, lit from inside. */
export function signMaterial(t: THREE.Texture) {
  return new THREE.MeshLambertMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0 })
}

export const BOX = new THREE.BoxGeometry(1, 1, 1)
export const PLANE = new THREE.PlaneGeometry(1, 1)

/** Many of the same block, placed once: one draw for all of them. */
export function Blocks({ at, material, color }: { at: { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }[]; material: THREE.Material; color?: boolean }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(BOX, material, at.length)
    const o = new THREE.Object3D()
    const col = new THREE.Color()
    at.forEach((b, i) => {
      o.position.set(...b.p)
      o.scale.set(...b.s)
      o.rotation.set(0, b.ry ?? 0, 0)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      if (color) m.setColorAt(i, col.set(b.c ?? '#ffffff'))
    })
    m.castShadow = true
    m.receiveShadow = true
    return m
  }, [at, material, color])
  return <primitive object={mesh} />
}

/** The clubs of the street, at their slot (backend world.go inRue): instead of a maquis there. */
const CLUBS: Record<number, { name: string; neon: string }> = {
  3: { name: 'LE SAPHIR', neon: '#4dabf7' },
  4: { name: 'CLUB 225', neon: '#f783ac' },
  7: { name: 'NUIT DE YOP', neon: '#b197fc' },
}

/** Where each building stands: which side of the lane, and how far along. */
const SLOTS = MAQUIS.map((m, i) => {
  const side = i % 2 ? 1 : -1
  const k = Math.floor(i / 2)
  return { m, side, z: 19.5 - k * 13.5, club: CLUBS[i] }
})

/** A place in the street (a club) at its slot: its door on the lane and which way it faces, in the landmark's frame. */
export function rueSlot(slot: number): { door: [number, number]; rot: number } {
  const s = SLOTS[slot] ?? SLOTS[0]
  return { door: [s.side * (LANE / 2), s.z], rot: s.side > 0 ? -Math.PI / 2 : Math.PI / 2 }
}

/** The tables out in the lane (x, z), two in front of each maquis: the party nights seat people at them (party.tsx). */
export const RP_TABLES: [number, number][] = SLOTS.filter((s) => !s.club).flatMap(({ side, z }) => [-3, 3].map((dz): [number, number] => [-side * (LANE / 2 - 1.5), z + dz]))

/** What can't be walked through: the buildings either side of the lane, the arch's pillars. */
export const RUE_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  ...SLOTS.map((s) => ({ x: s.side * (LANE / 2 + DEPTH / 2), z: s.z, hw: DEPTH / 2, hd: FRONT / 2, rot: 0, top: s.m.storeys * 3 })),
  ...[-1, 1].map((s) => ({ x: s * (LANE / 2 + 0.75), z: LANE_Z[1] - 0.5, hw: 0.75, hd: 0.75, rot: 0, top: 6.3 })),
]

/** A club, built facing +z (the lane): dark, its name in neon, the doors under a canopy, the rope, the red carpet, the bouncer. */
function ClubFront({ name, neon, night }: { name: string; neon: string; night: boolean }) {
  const h = 6
  const mats = useMemo(() => {
    const sign = lettering(name, '#0b0b14', neon, neon)
    return { sign: signMaterial(sign.t), aspect: sign.aspect, glow: new THREE.MeshLambertMaterial({ color: neon, emissive: neon, emissiveIntensity: 0.2 }) }
  }, [name, neon])
  mats.sign.emissiveIntensity = night ? 1.2 : 0.3
  mats.glow.emissiveIntensity = night ? 1.1 : 0.2
  const front = DEPTH / 2
  return (
    <group>
      <mesh position={[0, h / 2, 0]} scale={[FRONT, h, DEPTH]} geometry={BOX} material={clubWall} castShadow receiveShadow />
      <mesh position={[0, h + 0.2, 0]} scale={[FRONT + 0.3, 0.4, DEPTH + 0.3]} geometry={BOX} material={roof} castShadow />
      {/* The neon name, the lines of light along the façade */}
      <mesh position={[0, 4.3, front + 0.08]} scale={[Math.min(FRONT - 1, 1.4 * mats.aspect), 1.4, 1]} geometry={PLANE} material={mats.sign} />
      {[2.9, 5.5].map((y) => (
        <mesh key={y} position={[0, y, front + 0.06]} scale={[FRONT - 0.4, 0.12, 0.1]} geometry={BOX} material={mats.glow} />
      ))}
      {/* The double doors, gold-framed, under a canopy */}
      <mesh position={[0, 1.3, front + 0.05]} scale={[2.6, 2.6, 0.1]} geometry={BOX} material={speaker} />
      <mesh position={[0, 2.75, front + 0.06]} scale={[3, 0.25, 0.14]} geometry={BOX} material={gold} />
      <mesh position={[0, 2.95, front + 1.2]} scale={[4, 0.15, 2.4]} geometry={BOX} material={speaker} castShadow />
      {/* The red carpet out into the lane, the rope on its posts */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, front + 2]} scale={[1.8, 4, 1]} geometry={PLANE} material={carpet} />
      {[-1.4, 1.4].map((x) =>
        [0.8, 2.6].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.5, front + z]} scale={[0.1, 1, 0.1]} geometry={BOX} material={gold} />
        )),
      )}
      {[-1.4, 1.4].map((x) => (
        <mesh key={x} position={[x, 0.85, front + 1.7]} scale={[0.06, 0.06, 1.8]} geometry={BOX} material={carpet} />
      ))}
    </group>
  )
}

/** One maquis, built facing +z (the lane); the caller turns it. */
function MaquisFront({ m, night, seed }: { m: Maquis; night: boolean; seed: number }) {
  const h = m.storeys * 3
  const mats = useMemo(() => {
    const sign = lettering(m.name, m.sign, m.ink)
    return {
      wall: new THREE.MeshLambertMaterial({ color: m.wall }),
      trim: new THREE.MeshLambertMaterial({ color: '#f1ece2' }),
      inside: new THREE.MeshLambertMaterial({ color: '#2b2118', emissive: '#ffb347', emissiveIntensity: 0 }),
      sign: signMaterial(sign.t),
      aspect: sign.aspect,
    }
  }, [m])
  mats.inside.emissiveIntensity = night ? 0.55 : 0
  mats.sign.emissiveIntensity = night ? 0.9 : 0
  const signW = Math.min(FRONT - 1.5, 1.1 * mats.aspect)
  const front = DEPTH / 2
  return (
    <group>
      {/* The walls, a band of plaster at the foot and along the roof */}
      <mesh position={[0, h / 2, 0]} scale={[FRONT, h, DEPTH]} geometry={BOX} material={mats.wall} castShadow receiveShadow />
      <mesh position={[0, 0.375, front + 0.01]} scale={[FRONT, 0.75, 0.05]} geometry={BOX} material={mats.trim} />
      <mesh position={[0, h + 0.2, 0]} scale={[FRONT + 0.3, 0.4, DEPTH + 0.3]} geometry={BOX} material={roof} castShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, h + 0.6, s * (DEPTH / 2)]} scale={[FRONT + 0.3, 0.4, 0.3]} geometry={BOX} material={mats.trim} />
      ))}
      {/* A black water tank on the roof, as on every other house in Abidjan */}
      {seed % 3 !== 1 && (
        <group position={[(seed % 2 ? 1 : -1) * 3, h + 0.4, -1.5]}>
          <mesh position={[0, 0.75, 0]} scale={[0.6, 0.6, 0.6]} geometry={BOX} material={post} castShadow />
          <mesh position={[0, 1.9, 0]} scale={[1.5, 1.8, 1.5]} geometry={BOX} material={speaker} castShadow />
        </group>
      )}
      {/* Open to the lane: the room inside, warm at night */}
      <mesh position={[0, 1.4, front + 0.02]} scale={[FRONT - 3, 2.6, 1]} geometry={PLANE} material={mats.inside} />
      {/* Upstairs: two windows with their shutters */}
      {m.storeys === 2 &&
        [-3, 3].map((x) => (
          <group key={x} position={[x, 4.5, front + 0.03]}>
            <mesh scale={[1.5, 1.5, 1]} geometry={PLANE} material={mats.inside} />
            <mesh position={[0, 0, 0.02]} scale={[1.8, 0.15, 0.1]} geometry={BOX} material={mats.trim} />
          </group>
        ))}
      {/* The name over the door */}
      <mesh position={[0, 3.6 + (m.storeys - 1) * 2.55, front + 0.08]} scale={[signW, 1.1, 1]} geometry={PLANE} material={mats.sign} />
      {/* The tin awning on its posts */}
      <group position={[0, 2.85, front + 1.5]} rotation={[0.08, 0, 0]}>
        <mesh scale={[FRONT, 0.12, 3]} geometry={BOX} material={awning} castShadow receiveShadow />
      </group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (FRONT / 2 - 0.3), 1.35, front + 2.8]} scale={[0.18, 2.7, 0.18]} geometry={BOX} material={post} castShadow />
      ))}
      {/* Speakers stacked at the corner, the bass at the bottom */}
      <group position={[(seed % 2 ? -1 : 1) * (FRONT / 2 - 1), 0, front + 0.7]}>
        <mesh position={[0, 0.6, 0]} scale={[0.9, 1.2, 0.8]} geometry={BOX} material={speaker} castShadow />
        <mesh position={[0, 1.6, 0]} scale={[0.7, 0.8, 0.6]} geometry={BOX} material={speaker} castShadow />
        <mesh position={[0, 0.6, 0.41]} scale={[0.5, 0.5, 1]} geometry={PLANE} material={cone} />
        <mesh position={[0, 1.6, 0.31]} scale={[0.35, 0.35, 1]} geometry={PLANE} material={cone} />
      </group>
    </group>
  )
}

const awning = new THREE.MeshLambertMaterial({ color: '#a9b0b6' })
const roof = new THREE.MeshLambertMaterial({ color: '#9c968c' })
const post = new THREE.MeshLambertMaterial({ color: '#5c4630' })
const speaker = new THREE.MeshLambertMaterial({ color: '#1c1c1e' })
const cone = new THREE.MeshLambertMaterial({ color: '#4a4a4f', side: THREE.DoubleSide })
const furniture = new THREE.MeshLambertMaterial({ color: '#ffffff' })
const clubWall = new THREE.MeshLambertMaterial({ color: '#1b1b26' })
const gold = new THREE.MeshLambertMaterial({ color: '#d4a017' })
const carpet = new THREE.MeshLambertMaterial({ color: '#b3122e' })
const BULB_COLOURS = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#f783ac', '#ff922b']

export function RuePrincesse({ night }: { night: boolean }) {
  const [z0, z1] = LANE_Z
  const mats = useMemo(() => {
    const arch = lettering('RUE PRINCESSE', '#1a1a2e', '#ff9f1c', '#ffd43b')
    const yop = lettering('YOP CITY', '#f77f00', '#ffffff', '#ffffff')
    return {
      lane: new THREE.MeshLambertMaterial({ color: '#8d8478', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      ground: new THREE.MeshLambertMaterial({ color: '#b9895a', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      pillar: new THREE.MeshLambertMaterial({ color: '#f1ece2' }),
      arch: signMaterial(arch.t),
      archAspect: arch.aspect,
      yop: signMaterial(yop.t),
      yopAspect: yop.aspect,
      bulbDay: new THREE.MeshLambertMaterial({ color: '#ffffff' }),
      bulbNight: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      cable: new THREE.MeshLambertMaterial({ color: '#222222' }),
    }
  }, [])
  mats.arch.emissiveIntensity = night ? 1 : 0
  mats.yop.emissiveIntensity = night ? 0.8 : 0

  // Tables and chairs out in the lane, in each maquis' colour of plastic.
  const furnitureAt = useMemo(() => {
    const out: { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }[] = []
    const plastic = ['#ffffff', '#e03131', '#1971c2', '#2b8a3e', '#f08c00']
    SLOTS.forEach(({ side, z, club }, i) => {
      if (club) return // a club has its carpet out, not tables
      const x = -side * (LANE / 2 - 1.5) // out from the front, under the awning
      const c = plastic[i % plastic.length]
      for (const dz of [-3, 3]) {
        const tz = z + dz
        out.push({ p: [x, 0.72, tz], s: [0.9, 0.06, 0.9], c }, { p: [x, 0.36, tz], s: [0.12, 0.72, 0.12], c })
        for (const [ox, oz] of [[0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]] as const) {
          const ry = Math.atan2(-ox, -oz)
          out.push({ p: [x + ox, 0.23, tz + oz], s: [0.45, 0.46, 0.45], ry, c }) // seat and legs, a block
          out.push({ p: [x + ox * 1.25, 0.6, tz + oz * 1.25], s: oz ? [0.45, 0.55, 0.08] : [0.08, 0.55, 0.45], c }) // the back
        }
      }
    })
    return out
  }, [])

  // Strings of bulbs across the lane, sagging, every few metres.
  const { bulbs, cables } = useMemo(() => {
    const bulbs: { p: [number, number, number]; s: [number, number, number]; c: string }[] = []
    const cables: { p: [number, number, number]; s: [number, number, number] }[] = []
    let n = 0
    for (let z = z1 - 3; z > z0 + 2; z -= 4.5) {
      const steps = 8
      for (let i = 0; i <= steps; i++) {
        const u = i / steps
        const x = (u - 0.5) * (LANE + 2)
        const y = 4.6 - Math.sin(u * Math.PI) * 0.7
        if (i > 0 && i < steps) bulbs.push({ p: [x, y - 0.18, z], s: [0.2, 0.2, 0.2], c: BULB_COLOURS[n++ % BULB_COLOURS.length] })
      }
      cables.push({ p: [0, 4.3, z], s: [LANE + 2, 0.04, 0.04] })
    }
    return { bulbs, cables }
  }, [z0, z1])

  const length = z1 - z0
  return (
    <group>
      {/* The ground of the block, and the lane down the middle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, (z0 + z1) / 2]} scale={[LANE + 2 * DEPTH + 6, length + 4, 1]} geometry={PLANE} material={mats.ground} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, (z0 + z1) / 2]} scale={[LANE, length, 1]} geometry={PLANE} material={mats.lane} receiveShadow />

      {SLOTS.map(({ m, side, z, club }, i) => (
        <group key={m.name} position={[side * (LANE / 2 + DEPTH / 2), 0, z]} rotation={[0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
          {club ? <ClubFront name={club.name} neon={club.neon} night={night} /> : <MaquisFront m={m} night={night} seed={i} />}
        </group>
      ))}

      <Blocks at={furnitureAt} material={furniture} color />
      <Blocks at={cables} material={mats.cable} />
      <Blocks key={night ? 'n' : 'd'} at={bulbs} material={night ? mats.bulbNight : mats.bulbDay} color />

      {/* The arch over the way in, its name lit at night, YOP CITY beneath */}
      <group position={[0, 0, z1 - 0.5]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (LANE / 2 + 0.75), 3.15, 0]} scale={[1.5, 6.3, 1.5]} geometry={BOX} material={mats.pillar} castShadow />
        ))}
        <mesh position={[0, 7.05, 0]} scale={[LANE + 4.5, 1.5, 1.6]} geometry={BOX} material={speaker} castShadow />
        {[1, -1].map((s) => (
          <group key={s} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
            <mesh position={[0, 7.05, 0.81]} scale={[Math.min(LANE + 4, 1.3 * mats.archAspect), 1.3, 1]} geometry={PLANE} material={mats.arch} />
            <mesh position={[0, 5.85, 0.2]} scale={[0.75 * mats.yopAspect, 0.75, 1]} geometry={PLANE} material={mats.yop} />
          </group>
        ))}
        {/* The flag stripes on the pillars */}
        {[-1, 1].map((s) =>
          ['#f77f00', '#ffffff', '#009e60'].map((c, i) => (
            <mesh key={`${s}${c}`} position={[s * (LANE / 2 + 0.75), 1 + i * 0.6, 0.76]} scale={[1.5, 0.6, 1]} geometry={PLANE}>
              <meshLambertMaterial color={c} />
            </mesh>
          )),
        )}
      </group>
    </group>
  )
}
