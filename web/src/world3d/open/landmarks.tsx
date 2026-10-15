import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Airport } from './airport'
import { RuePrincesse } from './ruePrincesse'
import { GareSiporex, PlaceFicgayo } from './yopougon'

// Landmarks the map alone can't draw: their shape is what people know them
// by. Built from published descriptions; sizes are estimates for the game.

/** The game places drawn as landmarks, and the ground they need cleared (metres). */
export const LANDMARKS: Record<string, number> = {
  'plateau-cathedrale': 34,
  'plateau-pyramide': 34,
  'plateau-stade': 105,
  'cocody-hotel-ivoire': 75,
  'yakro-basilique': 130,
  'pb-aeroport': 150,
  'cocody-oranjo': 42,
  'yop-rue-princesse': 32,
  'yop-gare-siporex': 36,
  'yop-ficgayo': 46,
}

/** The landmark's model, by place. */
export function Landmark({ id, night }: { id: string; night: boolean }) {
  switch (id) {
    case 'plateau-cathedrale':
      return <Cathedral />
    case 'plateau-pyramide':
      return <Pyramide night={night} />
    case 'plateau-stade':
      return <Stadium />
    case 'cocody-hotel-ivoire':
      return <HotelIvoire night={night} />
    case 'yakro-basilique':
      return <Basilica />
    case 'pb-aeroport':
      return <Airport night={night} />
    case 'cocody-oranjo':
      return <OranjoVillage night={night} />
    case 'yop-rue-princesse':
      return <RuePrincesse night={night} />
    case 'yop-gare-siporex':
      return <GareSiporex night={night} />
    case 'yop-ficgayo':
      return <PlaceFicgayo night={night} />
    default:
      return null
  }
}

/** A small pixel texture painted once, repeated over a facade. */
function pixels(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void, repeat: [number, number] = [1, 1]) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  paint(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(...repeat)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * A facade of floors: a band of glass under a band of concrete, with fins;
 * and its night version, where only some of the windows are lit.
 */
function floorsTexture(glass: string, wall: string, fin: string, floors: number, bays: number) {
  const paint = (night: boolean) => (g: CanvasRenderingContext2D) => {
    g.fillStyle = night ? '#000000' : wall
    g.fillRect(0, 0, 8, 8)
    g.fillStyle = night ? '#ffffff' : glass
    g.fillRect(1, 3, 7, 4)
    g.fillStyle = night ? '#000000' : fin
    g.fillRect(0, 0, 1, 8)
  }
  return { map: pixels(8, 8, paint(false), [bays, floors]), lights: pixels(8, 8, paint(true), [bays, floors]) }
}

/** A lit-at-night facade material. */
function facade(t: ReturnType<typeof floorsTexture>) {
  return new THREE.MeshLambertMaterial({ map: t.map, emissiveMap: t.lights, emissive: '#ffd27a', emissiveIntensity: 0 })
}

/**
 * Hôtel Ivoire (Cocody, architects Heinz Fenchel and Thomas Leitersdorf): the low main
 * building of 1963 along the lagoon and the tower of 1969–70, about 100 m,
 * with Le Toit d'Abidjan, its restaurant, at the top. The floor count and
 * the plan here are estimates.
 */
function HotelIvoire({ night }: { night: boolean }) {
  const white = useMemo(() => new THREE.MeshLambertMaterial({ color: '#f1eee6' }), [])
  const tower = useMemo(() => {
    return facade(floorsTexture('#35506e', '#ece8de', '#d9d3c4', 26, 12))
  }, [])
  const side = useMemo(() => {
    return facade(floorsTexture('#35506e', '#ece8de', '#d9d3c4', 26, 5))
  }, [])
  const wing = useMemo(() => {
    return facade(floorsTexture('#3c5a78', '#f3efe6', '#c9b9a0', 5, 28))
  }, [])
  const crown = useMemo(() => new THREE.MeshLambertMaterial({ color: '#1d2b3c', emissive: '#ffcf6a', emissiveIntensity: 0 }), [])
  const pool = useMemo(() => new THREE.MeshLambertMaterial({ color: '#3fb6e0' }), [])
  for (const m of [tower, side, wing]) m.emissiveIntensity = night ? 0.6 : 0
  crown.emissiveIntensity = night ? 0.5 : 0
  const H = 94
  return (
    <group>
      {/* The tower: a slab, its long faces to the lagoon and the street */}
      <group position={[18, 0, -10]}>
        <mesh position={[0, H / 2, 0]} castShadow receiveShadow material={[side, side, white, white, tower, tower]}>
          <boxGeometry args={[42, H, 16]} />
        </mesh>
        {/* Le Toit d'Abidjan: the restaurant on the roof, glazed all round */}
        <mesh position={[0, H + 3, 0]} material={crown} castShadow>
          <boxGeometry args={[38, 5, 14]} />
        </mesh>
        <mesh position={[0, H + 5.8, 0]} material={white}>
          <boxGeometry args={[44, 0.8, 18]} />
        </mesh>
        <mesh position={[14, H + 10, 0]} material={white}>
          <cylinderGeometry args={[0.3, 0.3, 8, 6]} />
        </mesh>
      </group>
      {/* The main building of 1963: long and low, by the water */}
      <mesh position={[-20, 9, -30]} castShadow receiveShadow material={[white, white, white, white, wing, wing]}>
        <boxGeometry args={[100, 18, 18]} />
      </mesh>
      <mesh position={[-20, 18.4, -30]} material={white}>
        <boxGeometry args={[103, 0.8, 21]} />
      </mesh>
      {/* The entrance canopy on the street side, and the pool */}
      <mesh position={[18, 4.2, 4]} material={white} castShadow>
        <boxGeometry args={[24, 0.6, 12]} />
      </mesh>
      {[-10, 10].map((x) => (
        <mesh key={x} position={[18 + x, 2, 9]} material={white}>
          <boxGeometry args={[0.6, 4, 0.6]} />
        </mesh>
      ))}
      <mesh position={[-30, 0.08, -2]} rotation={[-Math.PI / 2, 0, 0]} material={pool}>
        <planeGeometry args={[34, 14]} />
      </mesh>
      <mesh position={[-30, 0.04, -2]} rotation={[-Math.PI / 2, 0, 0]} material={white}>
        <planeGeometry args={[40, 20]} />
      </mesh>
    </group>
  )
}

/**
 * La Pyramide (Plateau, Rinaldo Olivieri, 1973): fifteen storeys stepping
 * back toward the top, about 62 m, around a hollow core. Here every face
 * steps back alike, a simplification of the real plan.
 */
function Pyramide({ night }: { night: boolean }) {
  const concrete = useMemo(() => new THREE.MeshLambertMaterial({ color: '#cfc6b5' }), [])
  const glass = useMemo(() => {
    return facade(floorsTexture('#2d3f52', '#2d3f52', '#b8ad98', 1, 10))
  }, [])
  const green = useMemo(() => new THREE.MeshLambertMaterial({ color: '#4f8a3a' }), [])
  glass.emissiveIntensity = night ? 0.55 : 0
  const STOREY = 3.9
  const HOLE = 7
  const levels = [...Array(15)].map((_, i) => {
    const w = 46 - i * 2.5
    return { y: i * STOREY, w }
  })
  return (
    <group>
      {levels.map(({ y, w }, i) => {
        // A storey: glass set back under a concrete slab, the planted terrace
        // of the storey below showing in front; a ring around the hollow core.
        const band = (w - HOLE) / 2
        const off = HOLE / 2 + band / 2
        return (
          <group key={i} position={[0, y, 0]}>
            {[
              [0, off, w, band],
              [0, -off, w, band],
              [off, 0, band, HOLE],
              [-off, 0, band, HOLE],
            ].map(([x, z, sx, sz], k) => (
              <group key={k}>
                <mesh position={[x, STOREY / 2, z]} material={glass} castShadow receiveShadow>
                  <boxGeometry args={[sx - (k < 2 ? 2 : 1), STOREY - 0.6, sz - (k < 2 ? 1 : 0)]} />
                </mesh>
                <mesh position={[x, STOREY - 0.3, z]} material={concrete} castShadow receiveShadow>
                  <boxGeometry args={[sx, 0.6, sz]} />
                </mesh>
              </group>
            ))}
            {i > 0 && (
              <mesh position={[0, 0.05, 0]} material={green}>
                <boxGeometry args={[w + 1.2, 0.1, w + 1.2]} />
              </mesh>
            )}
          </group>
        )
      })}
      {/* The crown and its mast */}
      <mesh position={[0, 15 * STOREY + 0.5, 0]} material={concrete} castShadow>
        <boxGeometry args={[10, 1, 10]} />
      </mesh>
      <mesh position={[0, 15 * STOREY + 2.5, 0]} material={concrete}>
        <cylinderGeometry args={[0.25, 0.4, 4, 6]} />
      </mesh>
    </group>
  )
}

/**
 * Stade Félix-Houphouët-Boigny (Plateau, renovated for the CAN 2023):
 * a closed oval bowl under a roof ring held by 40 cantilevered beams. The
 * dimensions are estimates.
 */
function Stadium() {
  const SX = 1.25 // the oval: stretched along the pitch
  const seats = useMemo(() => {
    const t = pixels(1, 12, (g) => {
      ;['#f08a24', '#f08a24', '#ffffff', '#ffffff', '#2f9a4a', '#2f9a4a', '#f08a24', '#f08a24', '#ffffff', '#ffffff', '#2f9a4a', '#2f9a4a'].forEach((c, y) => ((g.fillStyle = c), g.fillRect(0, y, 1, 1)))
    })
    return new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide })
  }, [])
  const shell = useMemo(() => new THREE.MeshLambertMaterial({ color: '#e9e4da', side: THREE.DoubleSide }), [])
  const roof = useMemo(() => new THREE.MeshLambertMaterial({ color: '#f6f6f2', side: THREE.DoubleSide }), [])
  const steel = useMemo(() => new THREE.MeshLambertMaterial({ color: '#c7ccd2' }), [])
  const pitch = useMemo(() => {
    const t = pixels(210, 136, (g) => {
      for (let x = 0; x < 210; x += 15) {
        g.fillStyle = (x / 15) % 2 ? '#3f9a45' : '#47a84c'
        g.fillRect(x, 0, 15, 136)
      }
      g.strokeStyle = '#ffffff'
      g.lineWidth = 1
      g.strokeRect(1.5, 1.5, 207, 133)
      g.beginPath()
      g.moveTo(105, 1)
      g.lineTo(105, 135)
      g.stroke()
      g.beginPath()
      g.arc(105, 68, 18, 0, Math.PI * 2)
      g.stroke()
      g.strokeRect(1.5, 28, 33, 80)
      g.strokeRect(175.5, 28, 33, 80)
    })
    t.magFilter = THREE.LinearFilter
    return new THREE.MeshLambertMaterial({ map: t })
  }, [])
  const track = useMemo(() => new THREE.MeshLambertMaterial({ color: '#b5533c' }), [])

  // The bowl, turned around the middle: tiers rising from the track to the top.
  const bowl = useMemo(() => {
    const g = new THREE.LatheGeometry([new THREE.Vector2(52, 0.2), new THREE.Vector2(53, 2.5), new THREE.Vector2(77, 22)], 64)
    g.scale(SX, 1, 1)
    return g
  }, [])
  const outer = useMemo(() => {
    const g = new THREE.CylinderGeometry(79, 80, 23, 64, 1, true)
    g.translate(0, 11.5, 0)
    g.scale(SX, 1, 1)
    return g
  }, [])
  const ring = useMemo(() => {
    const g = new THREE.LatheGeometry([new THREE.Vector2(62, 27.5), new THREE.Vector2(84, 25)], 64)
    g.scale(SX, 1, 1)
    return g
  }, [])
  const floor = useMemo(() => {
    const g = new THREE.CircleGeometry(53, 48)
    g.rotateX(-Math.PI / 2)
    g.scale(SX, 1, 1)
    return g
  }, [])
  const beams = useMemo(
    () =>
      [...Array(40)].map((_, i) => {
        const a = (i / 40) * Math.PI * 2
        const [c, s] = [Math.cos(a), Math.sin(a)]
        // From the mast outside the bowl up and in over the stands.
        return { foot: [c * 84 * SX, s * 84] as [number, number], tip: [c * 62 * SX, s * 62] as [number, number] }
      }),
    [],
  )
  return (
    <group>
      <mesh geometry={floor} position={[0, 0.5, 0]} material={track} receiveShadow />
      <mesh position={[0, 0.7, 0]} rotation={[-Math.PI / 2, 0, 0]} material={pitch} receiveShadow>
        <planeGeometry args={[105, 68]} />
      </mesh>
      <mesh geometry={bowl} material={seats} receiveShadow castShadow />
      <mesh geometry={outer} material={shell} castShadow receiveShadow />
      <mesh geometry={ring} material={roof} castShadow />
      {beams.map(({ foot, tip }, i) => {
        const a = new THREE.Vector3(foot[0], 0, foot[1])
        const top = new THREE.Vector3(foot[0], 30, foot[1])
        const b = new THREE.Vector3(tip[0], 27.6, tip[1])
        const mid = top.clone().add(b).multiplyScalar(0.5)
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), b.clone().sub(top).normalize())
        return (
          <group key={i}>
            <mesh position={a.clone().setY(15)} material={steel} castShadow>
              <boxGeometry args={[1, 30, 1]} />
            </mesh>
            <mesh position={mid} quaternion={q} material={steel} castShadow>
              <boxGeometry args={[top.distanceTo(b), 1.2, 0.8]} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/**
 * Basilique Notre-Dame de la Paix (Yamoussoukro, Pierre Fakhoury, 1989): a
 * dome about 158 m high with its cross, on a ring of columns, and two curved
 * colonnades embracing the esplanade, after St Peter's in Rome. The
 * proportions here are estimates.
 */
function Basilica() {
  const stone = useMemo(() => new THREE.MeshLambertMaterial({ color: '#efe9dc' }), [])
  const dome = useMemo(() => new THREE.MeshLambertMaterial({ color: '#c9d4dc' }), [])
  const glass = useMemo(() => new THREE.MeshLambertMaterial({ color: '#5a7ea6' }), [])
  const gold = useMemo(() => new THREE.MeshLambertMaterial({ color: '#d9b34a', emissive: '#5a4300', emissiveIntensity: 0.3 }), [])
  const paving = useMemo(() => {
    const t = pixels(8, 8, (g) => {
      g.fillStyle = '#d8d0c0'
      g.fillRect(0, 0, 8, 8)
      g.fillStyle = '#c4baa6'
      g.fillRect(0, 0, 8, 1)
      g.fillRect(0, 0, 1, 8)
    }, [40, 36])
    return new THREE.MeshLambertMaterial({ map: t })
  }, [])

  const cupola = useMemo(() => {
    const g = new THREE.SphereGeometry(46, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2)
    g.scale(1, 1.55, 1)
    return g
  }, [])
  const pediment = useMemo(() => {
    const t = new THREE.Shape()
    t.moveTo(-22, 0)
    t.lineTo(22, 0)
    t.lineTo(0, 9)
    t.closePath()
    return new THREE.ExtrudeGeometry(t, { depth: 14, bevelEnabled: false })
  }, [])
  const columns = useRef<THREE.InstancedMesh>(null)
  const beams = useRef<THREE.InstancedMesh>(null)
  // The columns: a ring round the drum, and the two arms of the colonnade.
  const { posts, spans } = useMemo(() => {
    const posts: [number, number, number, number][] = [] // x, z, base, height
    const spans: [number, number, number, number, number][] = [] // x, z, y, angle, length
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * Math.PI * 2
      posts.push([Math.cos(a) * 54, -50 + Math.sin(a) * 54, 6, 24])
    }
    const [cx, cz] = [0, 62]
    for (const side of [-1, 1])
      for (const R of [76, 84]) {
        const n = 26
        let prev: [number, number] | null = null
        for (let k = 0; k <= n; k++) {
          const t = Math.PI - 0.72 + (1.44 * k) / n
          const p: [number, number] = [side * -Math.cos(t) * -R, cz + Math.sin(t) * R]
          posts.push([p[0] + cx, p[1], 0, 16])
          if (prev) spans.push([(p[0] + prev[0]) / 2, (p[1] + prev[1]) / 2, 17, -Math.atan2(p[1] - prev[1], p[0] - prev[0]), Math.hypot(p[0] - prev[0], p[1] - prev[1]) + 0.4])
          prev = p
        }
      }
    return { posts, spans }
  }, [])
  useEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    posts.forEach(([x, z, y, h], i) => columns.current?.setMatrixAt(i, m.compose(new THREE.Vector3(x, y + h / 2, z), q, new THREE.Vector3(1, h, 1))))
    spans.forEach(([x, z, y, a, l], i) => beams.current?.setMatrixAt(i, m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(l, 2, 9.5))))
    if (columns.current) columns.current.instanceMatrix.needsUpdate = true
    if (beams.current) beams.current.instanceMatrix.needsUpdate = true
  }, [posts, spans])

  return (
    <group>
      {/* The esplanade, embraced by the colonnades */}
      <mesh position={[0, 0.07, 40]} rotation={[-Math.PI / 2, 0, 0]} material={paving} receiveShadow>
        <planeGeometry args={[200, 180]} />
      </mesh>
      <instancedMesh ref={columns} args={[undefined, undefined, posts.length]} material={stone} castShadow>
        <cylinderGeometry args={[1.1, 1.3, 1, 10]} />
      </instancedMesh>
      <instancedMesh ref={beams} args={[undefined, undefined, spans.length]} material={stone} castShadow>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <group position={[0, 0, -50]}>
        {/* The podium and its steps */}
        <mesh position={[0, 3, 0]} material={stone} castShadow receiveShadow>
          <cylinderGeometry args={[62, 64, 6, 48]} />
        </mesh>
        {/* The drum behind the columns, its windows of stained glass */}
        <mesh position={[0, 20, 0]} material={stone} castShadow>
          <cylinderGeometry args={[46, 46, 28, 48]} />
        </mesh>
        <mesh position={[0, 20, 0]} material={glass}>
          <cylinderGeometry args={[46.3, 46.3, 14, 48, 1, true]} />
        </mesh>
        {/* The entablature on the ring of columns */}
        <mesh position={[0, 31.5, 0]} material={stone} castShadow>
          <cylinderGeometry args={[57, 57, 3, 48]} />
        </mesh>
        <mesh position={[0, 37, 0]} material={stone} castShadow>
          <cylinderGeometry args={[47, 49, 8, 48]} />
        </mesh>
        {/* The dome, the lantern and the cross */}
        <mesh geometry={cupola} position={[0, 41, 0]} material={dome} castShadow />
        {[...Array(16)].map((_, i) => (
          <mesh key={i} position={[0, 41, 0]} rotation={[0, (i / 16) * Math.PI * 2, 0]} material={stone}>
            <torusGeometry args={[46.2, 0.5, 4, 24, Math.PI / 2]} />
          </mesh>
        ))}
        <mesh position={[0, 41 + 71 + 9, 0]} material={stone} castShadow>
          <cylinderGeometry args={[7, 8, 18, 16]} />
        </mesh>
        <mesh position={[0, 41 + 71 + 18, 0]} material={dome}>
          <sphereGeometry args={[7.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <group position={[0, 41 + 71 + 26, 0]}>
          <mesh position={[0, 0, 0]} material={gold}>
            <sphereGeometry args={[1.6, 10, 8]} />
          </mesh>
          <mesh position={[0, 9, 0]} material={gold}>
            <boxGeometry args={[1.2, 17, 1.2]} />
          </mesh>
          <mesh position={[0, 13, 0]} material={gold}>
            <boxGeometry args={[8, 1.2, 1.2]} />
          </mesh>
        </group>
        {/* The portico toward the esplanade: columns under a pediment */}
        <mesh position={[0, 7, 66]} material={stone} receiveShadow>
          <boxGeometry args={[44, 2, 16]} />
        </mesh>
        {[-18, -10.8, -3.6, 3.6, 10.8, 18].map((x) => (
          <mesh key={x} position={[x, 18, 72]} material={stone} castShadow>
            <cylinderGeometry args={[1.3, 1.5, 20, 10]} />
          </mesh>
        ))}
        <mesh position={[0, 18, 63]} material={stone} castShadow>
          <boxGeometry args={[40, 20, 4]} />
        </mesh>
        <mesh position={[0, 29.5, 67]} material={stone} castShadow>
          <boxGeometry args={[44, 3, 14]} />
        </mesh>
        <mesh geometry={pediment} position={[0, 31, 60]} material={stone} castShadow />
      </group>
    </group>
  )
}

/**
 * Cathédrale Saint-Paul (Plateau, Aldo Spirito, 1985): its cross-shaped tower
 * leans out over the lagoon, held to the church by seven cables. The tower's
 * height (~70 m) comes from a single source; the nave's shape here is a
 * simplification. Local +z is the street side.
 */
export function Cathedral() {
  const white = useMemo(() => new THREE.MeshLambertMaterial({ color: '#f4f1ea' }), [])
  const panel = useMemo(() => new THREE.MeshLambertMaterial({ color: '#2f6fb0' }), [])
  const glass = useMemo(() => new THREE.MeshLambertMaterial({ color: '#f2c14e', emissive: '#7a4f00', emissiveIntensity: 0.25 }), [])
  const cable = useMemo(() => new THREE.MeshBasicMaterial({ color: '#4a4f57' }), [])

  // The nave: a wedge rising toward the tower at the back.
  const nave = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-22, 0)
    shape.lineTo(22, 0)
    shape.lineTo(14, 38)
    shape.lineTo(-14, 38)
    shape.closePath()
    const g = new THREE.ExtrudeGeometry(shape, { depth: 9, bevelEnabled: false })
    g.rotateX(-Math.PI / 2)
    // Slope the roof: higher toward the back (the tower).
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i)
      if (y > 0.5) p.setY(i, 9 + (-p.getZ(i) / 38) * 14)
    }
    g.computeVertexNormals()
    return g
  }, [])

  // The tower leans forward, toward the lagoon, its top ~70 m up.
  const lean = 0.2
  const H = 68
  const top = new THREE.Vector3(0, H * Math.cos(lean), -38 + Math.sin(lean) * H)
  const anchors = [-12, -8, -4, 0, 4, 8, 12].map((x) => new THREE.Vector3(x, 9 + ((-(-38 + 6)) / 38) * 14, -32 + Math.abs(x) * 0.2))
  return (
    // Centred on its plot: the forecourt at the front, the tower at the back.
    <group position={[0, 0, 15]}>
      <mesh geometry={nave} material={white} castShadow receiveShadow />
      {/* Ceramic panels along the walls, and the stained glass */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 18.2, 4.5, -19]} rotation={[0, s * 0.205, 0]} material={panel}>
          <boxGeometry args={[0.2, 3, 34]} />
        </mesh>
      ))}
      <mesh position={[0, 5, 0.05]} material={glass}>
        <boxGeometry args={[30, 6, 0.1]} />
      </mesh>
      {/* The steps and the forecourt */}
      <mesh position={[0, 0.25, 4]} material={white} receiveShadow>
        <boxGeometry args={[34, 0.5, 8]} />
      </mesh>
      {/* The tower: a tall shaft leaning out, and the cross at its top */}
      <group position={[0, 0, -38]} rotation={[lean, 0, 0]}>
        <mesh position={[0, H / 2, 0]} material={white} castShadow>
          <boxGeometry args={[4, H, 4]} />
        </mesh>
        <mesh position={[0, H - 12, 0]} material={white} castShadow>
          <boxGeometry args={[22, 3.5, 3.5]} />
        </mesh>
      </group>
      {/* Seven cables from the tower down to the church */}
      {anchors.map((a, i) => {
        const mid = a.clone().add(top).multiplyScalar(0.5)
        const len = a.distanceTo(top)
        const dir = top.clone().sub(a).normalize()
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
        return (
          <mesh key={i} position={mid} quaternion={q} material={cable}>
            <cylinderGeometry args={[0.12, 0.12, len, 5]} />
          </mesh>
        )
      })}
    </group>
  )
}

/**
 * Oranjo Village, the game's name for Orange Village (Cocody, Riviera Golf,
 * Koffi & Diabaté Architectes, 2022): seven levels in rings 68 m across under
 * a perforated double skin shaped like a golf ball. The sphere's proportions
 * are an estimate.
 */
function OranjoVillage({ night }: { night: boolean }) {
  const R = 36
  const CY = -6 // the ball's centre, below the ground: a cap of it stands
  const skin = useMemo(() => {
    // White, pierced with round holes like a golf ball's dimples.
    const t = pixels(16, 16, (g) => {
      g.fillStyle = '#f7f7f4'
      g.fillRect(0, 0, 16, 16)
      g.globalCompositeOperation = 'destination-out'
      g.beginPath()
      g.arc(8, 8, 5, 0, Math.PI * 2)
      g.fill()
    }, [56, 18])
    return new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide })
  }, [])
  const cap = useMemo(() => new THREE.SphereGeometry(R, 56, 20, 0, Math.PI * 2, 0, Math.acos(-CY / R)), [])
  const glass = useMemo(() => new THREE.MeshLambertMaterial({ color: '#36576f', emissive: '#ffd27a', emissiveIntensity: 0 }), [])
  const slab = useMemo(() => new THREE.MeshLambertMaterial({ color: '#efece6' }), [])
  const brand = useMemo(() => new THREE.MeshLambertMaterial({ color: '#ff7900', emissive: '#ff7900', emissiveIntensity: 0.2 }), [])
  glass.emissiveIntensity = night ? 0.5 : 0
  brand.emissiveIntensity = night ? 0.8 : 0.2
  const levels = [...Array(7)].map((_, i) => {
    const y = i * 4
    return { y, r: Math.sqrt(R * R - (y + 2 - CY) ** 2) - 3 }
  })
  return (
    <group>
      {levels.map(({ y, r }, i) => (
        <group key={i} position={[0, y, 0]}>
          <mesh position={[0, 2, 0]} material={glass} castShadow>
            <cylinderGeometry args={[r - 1, r - 1, 3.5, 40]} />
          </mesh>
          <mesh position={[0, 3.8, 0]} material={slab} castShadow receiveShadow>
            <cylinderGeometry args={[r, r, 0.5, 40]} />
          </mesh>
        </group>
      ))}
      <mesh geometry={cap} position={[0, CY, 0]} material={skin} castShadow />
      {/* The orange band at the foot, and the forecourt */}
      <mesh position={[0, 0.6, 0]} material={brand}>
        <cylinderGeometry args={[Math.sqrt(R * R - CY * CY) + 0.3, Math.sqrt(R * R - CY * CY) + 0.3, 1.2, 56, 1, true]} />
      </mesh>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[42, 48]} />
        <meshLambertMaterial color="#cfc8b8" />
      </mesh>
    </group>
  )
}
