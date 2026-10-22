import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Airport } from './airport'
import { RuePrincesse, rueSlot } from './ruePrincesse'
import { GareSiporex, PlaceFicgayo } from './yopougon'
import { PalaisDesSports } from './treichville'
import { MarcheAdjame } from './adjame'
import { HotelIvoire } from './hotelIvoire'
import { HotelPoulman } from './poulman'
import { HotelNoum } from './noum'
import { HotelAzale } from './azale'
import { HotelRabisson } from './rabisson'
import { StadiumLive } from './stadiumLive'
import { Zoo } from './zoo'
import { BlockhaussMaquis } from './blockhauss'
import { Cathedral } from './cathedral'
import { MosqueM6 } from './mosqueM6'
import { ParcExpo } from './parcExpo'
import { Playce } from './playce'
import { PlayceMarcory } from './playceMarcory'
import { TOUR_F_FACING, TourF, TourFFar } from './tourF'
import type { StadiumEvent } from '../../lib/stadium'
import type { Obstacle } from '../obstacles'

// Landmarks the map alone can't draw: their shape is what people know them
// by. Built from published descriptions; sizes are estimates for the game.

/** The game places drawn as landmarks, and the ground they need cleared (metres). */
export const LANDMARKS: Record<string, number> = {
  'plateau-cathedrale': 62,
  'treich-mosquee-m6': 62,
  'plateau-pyramide': 34,
  'plateau-stade': 105,
  'cocody-hotel-ivoire': 75,
  'plateau-poulman': 42,
  'plateau-noum': 42,
  'marcory-azale': 40,
  'pb-rabisson': 56,
  'yakro-basilique': 130,
  'pb-aeroport': 150,
  'cocody-oranjo': 42,
  'cocody-playce': 62,
  'marcory-playce': 60,
  'yop-rue-princesse': 32,
  'yop-gare-siporex': 36,
  'yop-ficgayo': 46,
  'treich-palais': 45,
  'adjame-forum': 52,
  'cocody-zoo': 86,
  'cocody-blockhauss-maquis': 27,
  'portbouet-parc-expo': 60,
  'plateau-tour-f': 40,
}

/** The landmarks' own grounds in their frame (x from, x to, z from, z to; +z the street): no ad board stands on them (the PlaYce's car park). */
export const LANDMARK_GROUND: Record<string, [number, number, number, number]> = {
  'cocody-playce': [-51, 51, -34, 37],
  'marcory-playce': [-49, 49, -36, 35],
}

/** Grounds where the game builds none of its own houses (the map's buildings stay): a fairground, metres round the place. */
export const NO_FILL: Record<string, number> = {
  'portbouet-parc-expo': 290,
}

/** Where a place inside a landmark is (its door on the landmark's ground, which way it faces), in the landmark's frame. */
export function slotIn(parent: string, slot: number): { door: [number, number]; rot: number } | null {
  return parent === 'yop-rue-princesse' ? rueSlot(slot) : null
}

/** The landmarks one walks round freely on arriving (the park, the hotel's grounds, the street, the forecourts), before picking what to do. */
export const GROUNDS = new Set(['cocody-zoo', 'cocody-hotel-ivoire', 'yop-rue-princesse', 'adjame-forum', 'yop-ficgayo', 'yop-gare-siporex', 'cocody-blockhauss-maquis'])

/** The ones under the sky (a maquis by the lagoon, a street of maquis, a square, a gare, a market): one walks there, never into a room. */
export const OPEN_AIR = new Set([...GROUNDS].filter((id) => id !== 'cocody-hotel-ivoire'))

/** Landmarks seen from the whole city, over the roofs of the other communes: their far model, turned as in their own. */
export const SKYLINE = new Set(['plateau-tour-f'])

/** No further than this (the fog has them all by then). */
export const SKYLINE_FAR = 5500

export function FarLandmark({ id, night }: { id: string; night: boolean }) {
  switch (id) {
    case 'plateau-tour-f':
      return (
        <group rotation={[0, TOUR_F_FACING, 0]}>
          <TourFFar night={night} />
        </group>
      )
    default:
      return null
  }
}

/** The landmark's model, by place. */
export function Landmark({ id, night, demo, open = true }: { id: string; night: boolean; /** The stadium: a made-up match or concert (the videos), instead of the agenda. */ demo?: StadiumEvent; /** Open now (its hours): closed, nobody visiting (the zoo). */ open?: boolean }) {
  switch (id) {
    case 'plateau-cathedrale':
      return <Cathedral night={night} />
    case 'treich-mosquee-m6':
      return <MosqueM6 night={night} />
    case 'plateau-pyramide':
      return <Pyramide night={night} />
    case 'portbouet-parc-expo':
      return <ParcExpo night={night} />
    case 'plateau-tour-f':
      return <TourF night={night} />
    case 'plateau-stade':
      return <Stadium place={id} night={night} demo={demo} />
    case 'cocody-hotel-ivoire':
      return <HotelIvoire night={night} />
    case 'plateau-poulman':
      return <HotelPoulman night={night} />
    case 'plateau-noum':
      return <HotelNoum night={night} />
    case 'marcory-azale':
      return <HotelAzale night={night} />
    case 'pb-rabisson':
      return <HotelRabisson night={night} />
    case 'yakro-basilique':
      return <Basilica />
    case 'pb-aeroport':
      return <Airport night={night} />
    case 'cocody-oranjo':
      return <OranjoVillage night={night} />
    case 'cocody-playce':
      return <Playce night={night} />
    case 'marcory-playce':
      return <PlayceMarcory night={night} />
    case 'yop-rue-princesse':
      return <RuePrincesse night={night} />
    case 'yop-gare-siporex':
      return <GareSiporex night={night} />
    case 'yop-ficgayo':
      return <PlaceFicgayo night={night} />
    case 'treich-palais':
      return <PalaisDesSports night={night} />
    case 'adjame-forum':
      return <MarcheAdjame night={night} />
    case 'cocody-zoo':
      return <Zoo night={night} open={open} />
    case 'cocody-blockhauss-maquis':
      return <BlockhaussMaquis night={night} />
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
 * La Pyramide (Plateau, Rinaldo Olivieri, 1973): fifteen storeys stepping
 * back toward the top, about 62 m, around a hollow core. Here every face
 * steps back alike, a simplification of the real plan.
 */
export function Pyramide({ night }: { night: boolean }) {
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
/** The bowl's outer oval (half-axes, metres): its wall, round the stands. */
const STADIUM_OVAL = { x: 80 * 1.25, z: 80 }

/** What a walker can't go through: the bowl, in slices across its oval. */
export const STADIUM_SOLID: Obstacle[] = [...Array(16)].map((_, i) => {
  const x = -STADIUM_OVAL.x + (i + 0.5) * ((2 * STADIUM_OVAL.x) / 16)
  return { x, z: 0, hw: STADIUM_OVAL.x / 16, hd: STADIUM_OVAL.z * Math.sqrt(1 - (x / STADIUM_OVAL.x) ** 2), rot: 0, top: 23 }
})

function Stadium({ place, night, demo }: { place: string; night: boolean; demo?: StadiumEvent }) {
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
      {/* A match or a concert, when one is on */}
      <StadiumLive place={place} night={night} demo={demo} />
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
    if (columns.current) {
      columns.current.instanceMatrix.needsUpdate = true
      // Its bounds from where its copies stand (not from before they were placed): else it's culled when zoomed in.
      columns.current.computeBoundingSphere()
    }
    if (beams.current) {
      beams.current.instanceMatrix.needsUpdate = true
      // Its bounds from where its copies stand (not from before they were placed): else it's culled when zoomed in.
      beams.current.computeBoundingSphere()
    }
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
