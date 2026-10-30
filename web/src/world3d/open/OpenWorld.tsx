import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from 'react'
import { sceneDpr, weakDevice } from '../../lib/device'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Cinematic } from '../cinematic'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { PerformanceMonitor } from '@react-three/drei'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { useNpcReaction } from './npcReact'
import { randomLook } from '../../avatar/options'
import { OWN_HOUSE, homePlanFor, lifeOf, minuteOf, openAt } from '../../game/rules'
import { HAPPENING_DOOR, HAPPENING_ROLES, HAPPENING_X, HappeningMarker, HappeningScene, JamOnRoad, STOPS_TRAFFIC } from '../Happenings'
import { jamAlong } from './jam'
import { MovingJam } from './jamCars'
import { keyOpen, useFeatures } from '../../lib/features'
import { pavementLine, routeFor, useRoutes } from './ways'
import { underHud } from '../hudClear'
import { HOME_ID, type Lot } from '../layout'
import { LotView, type Props } from '../Neighbourhood'
import { useSignTexture } from '../props'
import type { Commune, Place, Plot, Soiree, World } from '../../lib/types'
import { keyOpen, useFeatures } from '../../lib/features'
import { entryLabel, partyLine } from '../../game/soirees'
import { api } from '../../lib/api'
import { House } from '../build/House'
import { CutHouse } from '../build/CutHouse'
import { FurnitureSet, downstairs } from '../build/Furniture'
import { iconFor, kindColors } from '../../components/icons'
import { IconTile } from '../../components/ui'
import { Html } from '@react-three/drei'
import { Bande } from '../Nightlife'
import { OtherPlayers } from '../Players'
import { rng } from '../themes'
import { lotAt } from './lotSpot'
import { APPRENTI, CAR_COLORS, GBAKA_DOOR, Vehicle, type VehicleKind } from '../vehicles'
import { Walker, type WalkNav } from '../Walker'
import { LotGhost } from './lotGhost'
import { lotClip } from './lotClip'
import { Shelterer, useRain } from './rainRun'
import { useLotPlace } from '../../store/lotPlace'
import { homeSpotsOf } from '../homeSpots'
import { LotGround, Zones } from '../build/Zones'
import { LotFence, fenceRuns, ownerColor } from '../build/Fence'
import { whereabouts } from '../whereabouts'
import { Snapper } from '../snapshot'
import { TripDrop } from './tripDrop'
import { ChatFraming } from '../chatFraming'
import { CHUNK_ZOOM, hash, tileBox, tileOf, toLatLng, toLocal, type Box, type Origin, type XZ } from './geo'
import { FOOT, Nav } from './nav'
import { weather } from './weathering'
import { along, anchorNode, DRIVABLE, round, routeLength, turnTo, useCellsAround, type Round } from './shared'
import { ParkedVehicle } from './parkedVehicle'
import { useParked } from '../drive'
import { blockedAhead, giveWay, holdJunctions, junctionsOf, lightsOf, litJunctions, queueOf, redAhead, report, spotTaken, stopForPapers, TrafficLights, waiting, type Junction, type Light } from './trafficFlow'
import { inTheWay, resolvePlaces, spaceFields, type PlaceSpot, type Resolved } from './places'
import { SportField } from './field'
import { FuelStation } from './station'
import { ZOO_SOLID } from './zoo'
import { PALAIS_SOLID } from './palaisJustice'
import { PRESIDENCE_SOLID } from './presidence'
import { PALAIS_CULTURE_SOLID } from './palaisCulture'
import { MUSEE_SOLID } from './musee'
import { TOUR_IVOIRE_SOLID } from './tourIvoire'
import { ASSEMBLEE_SOLID } from './assemblee'
import { GRAND_MARCHE_SOLID } from './grandMarche'
import { IVOIRE_SOLID } from './hotelIvoire'
import { POULMAN_SOLID } from './poulman'
import { NOUM_SOLID } from './noum'
import { AZALE_SOLID } from './azale'
import { RABISSON_SOLID } from './rabisson'
import { CATHEDRAL_SOLID } from './cathedral'
import { Courier } from './courier'
import { MOSQUE_M6_SOLID } from './mosqueM6'
import { clearObstacles, moveObstacle, setObstacles, type Obstacle } from '../obstacles'
import { Solid } from '../Solid'
import { FarLandmark, LANDMARK_FRONT, LANDMARKS, Landmark, NO_FILL, SKYLINE, SKYLINE_FAR, STADIUM_SOLID, slotIn } from './landmarks'
import { RUE_SOLID } from './ruePrincesse'
import { PLAYCE_SOLID } from './playce'
import { PLAYCE_MARCORY_SOLID } from './playceMarcory'
import { CAPSUD_SOLID } from './capsud'
import { Boats } from './boats'
import { StreetStalls } from './stalls'
import { SotraStops } from './sotra'
import { StreetFootball } from './streetFoot'
import { StreetPeople } from './streetPeople'
import { StreetNouchis } from './nouchis'
import { CommuneMarkers } from './communeMarkers'
import { Billboards } from './billboards'
import { JoinIn } from './joinIn'
import { StreetLife, type Taken } from './streetlife'
import { Landing, SkyPlanes, TakeOff } from './airport'
import { TripRide } from './tripRide'
import { StreetLights } from './streetlights'
import { PARTIES, Party } from './party'
import { PartyFront } from './soiree'
import { Chantier, building } from './chantier'
import { NightStreet } from './nightStreet'
import { BRIDGE_LABEL, bridgeKind } from './bridgeNames'
import { BridgeSights } from './bridges'
import { BridgeLife } from './bridgeLife'
import { matchPoi } from './poiMatch'
import { Dressing } from './dressing'
import { SkyDome, skyTone } from './sky'
import { setVehicleNight } from '../vehicles'

const RICH = typeof navigator === 'undefined' || (navigator.hardwareConcurrency ?? 4) > 4
import { litShare, makeTextures, rippleNormals, windowsByHour } from './textures'
import { FAR_ZOOM, type ChunkData, type FarBlock } from './tiles'
import type { ChunkRequest } from './chunkJob'
import { requestKey } from './chunkCache'
import { startChunkWorker, type ChunkWorker } from './chunkWorker'
import { serverNow, worldTime } from '../../lib/worldClock'
import { cutsAround, inCut, zoneOf, type PowerCut } from '../power'
import { CUTS } from './textures'
import { RainSky } from './rainSky'
import { NPC_NAMES, type Npc } from '../talk'
import { CITY_FAR, FarGrow } from '../../avatar/LowHuman'

/** Bloom at night, downloaded only on phones that show it. */
const NightBloom = lazy(() => import('../effects').then((m) => ({ default: m.NightBloom })))

// The open world: the real Abidjan around the Sim, like Minecraft's — it
// loads chunk by chunk (one map tile, ~610 m) as the Sim walks, and fades
// into the haze at the edge. Streets and buildings come from OpenStreetMap
// (through Mapbox); the game's places stand on the real streets nearest to
// where they really are.

/** A place from the map (world/osm.go on the server), not one of the game's own. */
export const isMapPlace = (id: string) => id.includes('-osm-')
/** A player's soirée (backend sims/party.go): placed on the main thread, not by the chunks' worker. */
const isSoiree = (id: string) => id.startsWith('soiree:')
/** Metres around the Sim within which the map's places show their sign. */
const MAP_SIGNS = 90
/** How many places, the nearest, show their name over the street. */
const NAMED = 6
const LOAD_RADIUS = 700 // metres around the Sim (or where the camera looks)
const DROP_RADIUS = 1500
const FAR_RADIUS = 4500 // the horizon, in plain big tiles
const FAR_DROP = 7000
const PARALLEL = 3
const HAPPENING_KEY = 'happening'

type Loaded = { data: ChunkData; geos: Record<string, THREE.BufferGeometry>; resolved: Resolved[]; /** what it was made of (chunkCache.requestKey): the same request finds it in BUILT */ mem: string }

// The chunks built while the page lives, by what they were made of: a street
// left and come back to (another commune and back by taxi, the profile and
// back, a chunk gone out of range and in again) stands at once, without the
// worker, the database or the network. The oldest go when there are too many
// (their geometry freed, unless a street still draws it).
const BUILT = new Map<string, Loaded>()
const BUILT_MAX = 60
function keepBuilt(c: Loaded, drawn: Map<string, Loaded>) {
  BUILT.delete(c.mem)
  BUILT.set(c.mem, c)
  while (BUILT.size > BUILT_MAX) {
    const [mem, old] = BUILT.entries().next().value as [string, Loaded]
    BUILT.delete(mem)
    if (drawn.get(old.data.key) !== old) for (const g of Object.values(old.geos)) g.dispose()
  }
}
const SNAPS = 'babi.snaps.v2.'
/**
 * The key a commune's finds are kept under: its id and where the game's data
 * puts its approximate places. Moved in the data (or found by other rules,
 * v2), a place's old find isn't kept: it was the stadium on its bus stop for
 * good, whatever the data said after.
 */
function snapKey(commune: Commune) {
  let h = 0
  for (const p of commune.places) if (p.real && p.approx) for (const ch of `${p.id}@${p.lat},${p.lng};`) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0
  return `${commune.id}.${(h >>> 0).toString(36)}`
}
function loadSnaps(key: string): Map<string, XZ> {
  try {
    // The commune's finds kept under another key (other data, other rules) go.
    const commune = key.slice(0, key.indexOf('.'))
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i) ?? ''
      if (k !== SNAPS + key && /^babi\.snaps\.v\d+\.([^.]+)/.exec(k)?.[1] === commune) localStorage.removeItem(k)
    }
    const raw = localStorage.getItem(SNAPS + key)
    const list = raw ? (JSON.parse(raw) as [string, number, number][]) : []
    return new Map(list.filter((e) => Array.isArray(e) && typeof e[0] === 'string' && Number.isFinite(e[1]) && Number.isFinite(e[2])).map(([id, x, z]) => [id, [x, z] as XZ]))
  } catch {
    return new Map()
  }
}
function saveSnaps(key: string, snaps: Map<string, XZ>) {
  try {
    localStorage.setItem(SNAPS + key, JSON.stringify([...snaps].map(([id, [x, z]]) => [id, Math.round(x * 10) / 10, Math.round(z * 10) / 10])))
  } catch {
    // No room, or private browsing: found again next time.
  }
}
/** A chunk made of something else now (a house built, a place found elsewhere): forgotten and freed. */
function forgetBuilt(c: Loaded) {
  if (BUILT.get(c.mem) === c) BUILT.delete(c.mem)
  for (const g of Object.values(c.geos)) g.dispose()
}

/** A plot with a house clears the map's buildings this far around (metres). */
const PLOT_CLEAR = 12
/** Where a Sim lives in its commune (angle, distance from the centre): the same on every phone. */
function homeSpot(simId: string): [number, number] {
  const r = rng(`home${simId}`)
  return [r() * Math.PI * 2, 120 + r() * 260]
}
/** A lot's size (the plots from before lots are 12 × 12). */
/** Inside the house, its blocks from this height up are hidden (the cutaway). */
const CUT_HEIGHT = 3
/** Where the Sim is (for the cutaway: the walls between it and the camera come down). */
const simVec = new THREE.Vector3()
const simPoint = () => simVec.set(whereabouts.sim[0], whereabouts.simY, whereabouts.sim[1])
const lotSize = (p: Plot): [number, number] => [p.lot?.w ?? 12, p.lot?.d ?? 12]
/** How far a lot clears the map's buildings round it. */
const lotClear = (p: Plot) => Math.max(PLOT_CLEAR, Math.hypot(...lotSize(p)) / 2 + 3)

/** What casts a shadow: the buildings, not the roads. */
const SOLID = new Set(['walls', 'inst', 'entrance', 'shop', 'house', 'trim', 'roofs', 'tin'])
/** Drawn only near the view: the buildings' small parts, the stepped tin roofs (plain slopes, tinLow, further off), the shade at the walls' foot. */
const NEAR_ONLY = new Set(['trim', 'tin', 'contact'])

// No screen-space ambient occlusion here: over kilometres of view its depth
// buffer is too coarse and it blackens the ground. The buildings carry their
// own shade (darker walls near the ground, a dark band at their foot).

/** The sun, and its shadows, over wherever the camera looks. */
function Sun({ night, dusk, dim = 1 }: { night: boolean; dusk: boolean; /** Under the rain clouds, less sun. */ dim?: number }) {
  const light = useRef<THREE.DirectionalLight>(null)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const l = light.current
    if (!l) return
    scene.add(l.target)
    return () => void scene.remove(l.target)
  }, [scene])
  // The shadow map is drawn ten times a second rather than every frame (it
  // means drawing the whole city around once more), and at once when the
  // light moves with the Sim.
  const gl = useThree((s) => s.gl)
  const since = useRef(0)
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    return () => void (gl.shadowMap.autoUpdate = true)
  }, [gl])
  useFrame((_, dt) => {
    const l = light.current
    if (!l || !controls) return
    const t = controls.target
    // Snap to whole metres so the shadows don't shimmer as the Sim walks.
    const [x, z] = [Math.round(t.x), Math.round(t.z)]
    const moved = l.target.position.x !== x || l.target.position.z !== z
    l.position.set(x + 60, 110, z + 35)
    l.target.position.set(x, 0, z)
    since.current += dt
    if (moved || since.current > 0.1) {
      since.current = 0
      gl.shadowMap.needsUpdate = true
    }
  })
  return (
    <directionalLight
      ref={light}
      castShadow
      intensity={(night ? 0.6 : dusk ? 1.1 : 1.7) * dim}
      color={night ? '#8fa8ff' : dusk ? '#ffb38a' : '#fff4e0'}
      shadow-mapSize={weakDevice ? [1024, 1024] : [2048, 2048]}
      shadow-camera-left={-90}
      shadow-camera-right={90}
      shadow-camera-top={90}
      shadow-camera-bottom={-90}
      shadow-camera-far={300}
      shadow-bias={-0.0006}
      shadow-normalBias={0.04}
    />
  )
}

/** The open world's materials: walls, roofs, roads, water, grass, trees. */
export function makeWorldMaterials() {
  const t = makeTextures()
  const lambert = (map: THREE.Texture, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ map, ...extra })
  const m = {
    walls: lambert(t.wall, { vertexColors: true, emissiveMap: t.lights, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0 }),
    inst: lambert(t.inst, { vertexColors: true }),
    entrance: lambert(t.entrance, { vertexColors: true }),
    shop: lambert(t.shop, { vertexColors: true, emissiveMap: t.shopLights, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0 }),
    house: weather(lambert(t.house, { vertexColors: true }), 'walls'),
    trim: weather(lambert(t.plaster, { vertexColors: true, side: THREE.DoubleSide }), 'concrete'),
    kerb: lambert(t.plaster, { vertexColors: true }),
    roofs: weather(lambert(t.roof), 'roofs'),
    tin: weather(lambert(t.tin, { vertexColors: true, side: THREE.DoubleSide }), 'tin'),
    contact: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    asphalt: weather(lambert(t.asphalt, { vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 'asphalt'),
    laterite: lambert(t.laterite, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    pavement: weather(lambert(t.pavement, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 'pavement'),
    // Glossy water: the sun glints on ripples that drift (a normal map).
    water: new THREE.MeshPhongMaterial({ map: t.water, normalMap: rippleNormals(), normalScale: new THREE.Vector2(0.55, 0.55), shininess: 80, specular: new THREE.Color('#d8ecff'), transparent: true, opacity: 0.9 }),
    paint: weather(new THREE.MeshLambertMaterial({ color: '#f4f4f0', polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), 'paint'),
    foam: new THREE.MeshBasicMaterial({ map: t.foam, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    // The map's grass, sand and pitches lie over the ground, under a garden laid on them.
    green: lambert(t.grass, { polygonOffset: true, polygonOffsetFactor: 3, polygonOffsetUnits: 3 }),
    sand: lambert(t.sand, { polygonOffset: true, polygonOffsetFactor: 3, polygonOffsetUnits: 3 }),
    pitch: lambert(t.pitch, { polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 }),
    // Pushed back in the depth test: from afar, a few centimetres are too little to tell
    // the ground from the grass, the parks or a garden laid on it, and it showed through.
    ground: weather(new THREE.MeshLambertMaterial({ color: '#cbb38c', polygonOffset: true, polygonOffsetFactor: 6, polygonOffsetUnits: 6 }), 'ground'),
    bark: lambert(t.bark),
    leaves: lambert(t.leaves),
  }
  m.walls.userData.litShare = windowsByHour(m.walls)
  weather(m.walls, 'walls')
  weather(m.shop, 'walls')
  // A lot being set: what will be cleared for it goes from under it at once (lotClip.ts).
  for (const k of ['walls', 'inst', 'entrance', 'shop', 'house', 'trim', 'roofs', 'tin', 'contact'] as const) lotClip(m[k], 'buildings')
  lotClip(m.bark, 'instances')
  lotClip(m.leaves, 'instances')
  return m
}

export function OpenWorld(props: Props & { token: string; onFail: () => void; onLoaded?: () => void; onMapPlaces?: (places: Place[]) => void; onHomeSpots?: (ids: string[]) => void; onHomePlot?: (plot: Plot | undefined) => void }) {
  const night = props.hour < 6 || props.hour >= 19
  const dusk = props.hour >= 17 && props.hour < 19
  const sky = night ? '#141a3d' : dusk ? '#f7a072' : '#8ec9f0'
  const maxDpr = Math.min(sceneDpr[1], typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1)
  const [dpr, setDpr] = useState(Math.min(weakDevice ? 1 : 1.5, maxDpr))
  return (
    <Canvas shadows dpr={dpr} camera={{ position: [45, 48, 45], fov: 45, near: 0.5, far: 6000 }} style={{ background: sky, transition: 'background 1s' }} gl={{ antialias: true, stencil: true }} onCreated={({ gl, scene, camera }) => void (import.meta.env.DEV && Object.assign(window, { __gl: gl, __scene: scene, __camera: camera, __where: whereabouts }))}>
      <Snapper street />
      <ChatFraming />
      {/* The arrival's flight over the commune (world3d/cinematic.tsx) */}
      <Cinematic />
      {/* Resolution follows what the device can keep up with */}
      <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(0.75, d - 0.25))} onIncline={() => setDpr((d) => Math.min(maxDpr, d + 0.25))} flipflops={4} onFallback={() => setDpr(1)} />
      <Suspense fallback={null}>
        {/* The city seen from its usual height (80 m off): the people bulk up further away, as at the stadium, so they read as people. */}
        <FarGrow.Provider value={CITY_FAR}>
          <World {...props} night={night} dusk={dusk} sky={sky} />
        </FarGrow.Provider>
      </Suspense>
    </Canvas>
  )
}

/**
 * The horizon's coarse tiles (zoom 14) lie under the whole world, the near
 * chunks over them. Where a near chunk is, the horizon must not show: its
 * simplified coasts run over the land (the narrow strip on the road to
 * Bassam came out under water, houses and all). Each near chunk marks its
 * square in the stencil (CHUNK_MASK); the horizon's materials (farOf) are
 * only drawn where no near chunk is.
 */
const CHUNK_MASK = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp })
function farOf<T extends Record<string, THREE.Material>>(mats: T): T {
  return Object.fromEntries(
    Object.entries(mats).map(([k, m]) => {
      const f = m.clone()
      Object.assign(f, { stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilWriteMask: 0, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp })
      f.userData = m.userData
      // (A clone keeps neither: the windows going out by the hour, the wear, the roofs' paint.)
      f.onBeforeCompile = m.onBeforeCompile
      f.customProgramCacheKey = m.customProgramCacheKey
      return [k, f]
    }),
  ) as T
}

/** The far horizon's walls, by the hash of where they stand: the sand, cream and white of Abidjan, the glass of the towers. */
const FAR_WALLS = ['#efe6d6', '#e9dcc3', '#f3f1ec', '#d9cbb0', '#f0d9b5', '#e8d2c0', '#dfe4e8'].map((c) => new THREE.Color(c))
const FAR_GLASS = new THREE.Color('#b9cad9')
const FAR_BOX = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
const FAR_NIGHT = { value: 0 }
/**
 * The blocks' walls drawn by the shader, as the city's: rows of windows a storey apart (3 m), a
 * column every 2.6 m along each wall, from the first floor up; the roof a shade of its own; the foot
 * of the walls darker (the shade of the street); at night a part of the windows lit, warm, by
 * where they are (the same ones every night).
 */
const farBlockMat = new THREE.MeshLambertMaterial({ color: '#ffffff' })
farBlockMat.onBeforeCompile = (sh) => {
  sh.uniforms.uFarNight = FAR_NIGHT
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vFarL;\nvarying vec3 vFarN;\nvarying vec3 vFarW;')
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 farScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vFarW = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      #else
        vec3 farScale = vec3(1.0);
        vFarW = vec3(0.0);
      #endif
      vFarL = position * farScale;
      vFarN = normal;`,
    )
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vFarL;\nvarying vec3 vFarN;\nvarying vec3 vFarW;\nuniform float uFarNight;\nfloat farHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\nfloat farWin;')
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float farRoof = step(0.5, vFarN.y);
      float farAlong = abs(vFarN.x) > 0.5 ? vFarL.z : vFarL.x;
      float fy = fract(vFarL.y / 3.0);
      float fx = fract(farAlong / 2.6);
      farWin = (1.0 - farRoof) * step(0.3, fy) * step(fy, 0.78) * step(0.22, fx) * step(fx, 0.78) * step(2.6, vFarL.y);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.26, 0.31, 0.38), farWin * 0.7);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.76, 0.74), farRoof);
      diffuseColor.rgb *= mix(0.7, 1.0, smoothstep(0.0, 2.4, vFarL.y) + farRoof);`,
    )
    .replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float farLit = step(0.62, farHash(vec3(floor(farAlong / 2.6), floor(vFarL.y / 3.0), floor(vFarW.x + vFarW.z * 1.7))));
      totalEmissiveRadiance += uFarNight * farWin * farLit * vec3(1.0, 0.78, 0.45) * 0.85;`,
    )
}

/**
 * The city past the loaded streets (the horizon's tiles): its buildings as plain blocks, one draw
 * for a whole tile, their height from the map, their walls in the city's colours; none where a
 * near chunk stands (its own buildings are there). Before, past 700 m the city was flat.
 */
export function FarBlocks({ blocks, hide, night }: { blocks: FarBlock[]; hide: Box[]; night: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    blocks.forEach(([x, z, w, d, h, rot], i) => {
      const inNear = hide.some((b) => x > b.x0 - 4 && x < b.x1 + 4 && z > b.z0 - 4 && z < b.z1 + 4)
      o.position.set(x, 0, z)
      o.rotation.set(0, -rot, 0)
      o.scale.set(inNear ? 0 : w, inNear ? 0 : h, inNear ? 0 : d)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      const k = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1
      c.copy(h > 24 ? FAR_GLASS : FAR_WALLS[Math.floor(k * FAR_WALLS.length)])
      if (night) c.multiplyScalar(0.36)
      m.setColorAt(i, c)
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
    FAR_NIGHT.value = night ? 1 : 0
  }, [blocks, hide, night])
  return <instancedMesh ref={ref} args={[FAR_BOX, farBlockMat, blocks.length]} frustumCulled />
}

/**
 * The depth's precision over the whole city: the camera's near plane follows how far it is from
 * what it looks at (half a metre close up, a few metres from high over the city), so the far
 * streets and roofs don't flicker into each other (the near plane at 0.5 for a view 6 km deep).
 */
function DepthRange() {
  const camera = useThree((st) => st.camera) as THREE.PerspectiveCamera
  const controls = useThree((st) => st.controls) as unknown as { target?: THREE.Vector3 } | null
  useFrame(() => {
    const t = controls?.target
    const d = t ? camera.position.distanceTo(t) : camera.position.y
    const near = Math.min(4, Math.max(0.3, d * 0.02))
    if (Math.abs(near - camera.near) / camera.near > 0.15) {
      camera.near = near
      camera.updateProjectionMatrix()
    }
  })
  return null
}

function useMaterials(night: boolean, hour: number) {
  const mats = useMemo(makeWorldMaterials, [])
  const far = useMemo(() => farOf(mats), [mats])
  useEffect(() => {
    mats.walls.emissiveIntensity = night ? 0.95 : 0
    mats.shop.emissiveIntensity = night ? 0.8 : 0
    setVehicleNight(night)
    mats.foam.color.set(night ? '#8fa3c8' : '#ffffff')
    // At night the lagoon is dark and glossy: the moon and the lights glint on its ripples.
    mats.water.specular.set(night ? '#8a9ccc' : '#d8ecff')
    mats.water.shininess = night ? 140 : 80
    mats.water.color.set(night ? '#5a6a90' : '#ffffff')
    // The horizon's water and foam follow the near ones.
    far.water.specular.copy(mats.water.specular)
    far.water.shininess = mats.water.shininess
    far.water.color.copy(mats.water.color)
    far.foam.color.copy(mats.foam.color)
  }, [night, mats, far])
  // The windows go out one by one as the night goes on.
  useEffect(() => {
    mats.walls.userData.litShare.value = litShare(hour)
  }, [hour, mats])
  // The water moves: its ripples drift, and the foam comes and goes on the shore.
  useFrame(() => {
    const t = worldTime()
    // Offsets wrapped to one repeat: the shared clock is large, the GPU's floats are not.
    mats.water.map!.offset.set((t * 0.012) % 1, Math.sin(t * 0.35) * 0.04)
    mats.water.normalMap!.offset.set((t * 0.03) % 1, (t * 0.017) % 1)
    mats.foam.map!.offset.set((t * 0.02) % 1, Math.sin(t * 0.9) * 0.22)
    mats.foam.opacity = 0.55 + Math.sin(t * 0.9) * 0.35
    far.foam.opacity = mats.foam.opacity
  })
  return { mats, far }
}

function World({ world, commune, sim, hour, moodColor, goTo, onArrive, onPick, busy, night, dusk, happening, stationAt, indoors, nameTag, onNear, frozen, onLeave, delivery, onCollect, players, onPickPlayer, recenter, onFreeCamera, closeView, shoulderView, token, onFail, onLoaded, onStreetBuy, onRobbed, onTalk, talkingTo, plotsVersion, onMapPlaces, onHomeSpots, onHomePlot, parties }: Props & { night: boolean; dusk: boolean; sky: string; token: string; onFail: () => void; onLoaded?: () => void; onMapPlaces?: (places: Place[]) => void; onHomeSpots?: (ids: string[]) => void; onHomePlot?: (plot: Plot | undefined) => void }) {
  const origin = useMemo<Origin>(() => ({ lat: commune.lat, lng: commune.lng }), [commune.lat, commune.lng])
  // A lot set in the 3D world (store/lotPlace.ts): here, in this commune.
  const placing = useLotPlace((s) => s.placing)
  useEffect(() => {
    useLotPlace.setState({ shown: commune.id })
    return () => useLotPlace.setState({ shown: null, placing: null, ghost: null })
  }, [commune.id])
  const cityCommunes = useMemo(() => world.cities.find((c) => c.communes.some((m) => m.id === commune.id))?.communes ?? [commune], [world.cities, commune])
  // The landmarks seen from the whole city (the Tour F), where they stand in this commune's metres:
  // drawn far off while their own lot isn't (another commune, or its streets not loaded yet).
  const skyline = useMemo(() => cityCommunes.flatMap((m) => m.places.filter((p) => SKYLINE.has(p.id)).map((p) => ({ id: p.id, at: toLocal(origin, p.lat, p.lng) }))), [cityCommunes, origin])
  const { mats, far: farMats } = useMaterials(night, hour)
  const home = sim.homeCity === sim.city && sim.homeCommune === commune.id

  // The real places found on the map's points of interest, by name. Kept in the browser from one
  // visit to the next: the first chunks are then asked for with the places where they really are,
  // instead of being built once, then again when the map's points come in (two builds, two entries
  // in the cache, and the second visit finding the first's).
  const [snaps, setSnaps] = useState<Map<string, XZ>>(() => loadSnaps(snapKey(commune)))
  const snapsRef = useRef(snaps)
  snapsRef.current = snaps

  // Where the game's places are on the map, the Sim's home (somewhere in the
  // quarter, the same each time) and the spot of what's happening.
  // The houses players built on their plots, for the Sims who live here
  // (this player's own included): they stand where each one lives.
  const [plots, setPlots] = useState<Plot[] | null>(null)
  useEffect(() => {
    let alive = true
    const load = () =>
      api
        .plots(sim.id)
        .then((p) => alive && setPlots(p))
        .catch(() => alive && setPlots((p) => p ?? []))
    void load()
    const t = setInterval(load, 60000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [sim.id, commune.id, plotsVersion])
  const plotKey = (plots ?? []).map((p) => p.key).sort().join()
  // (A lot set somewhere else on the map: its house moves with it.)
  const plotPlaces = (plots ?? []).map((p) => `${p.key}@${p.lot?.lat ?? ''},${p.lot?.lng ?? ''}`).sort().join()
  // Where a soirée is: the house it's thrown in (resolved: one's own « Chez toi », the host's lot), else the host's home spot.
  const partyAt = (p: Soiree): { ref?: string; at: XZ } => {
    if (p.host === sim.id) return { ref: HOME_ID, at: [0, 0] }
    const lot = plots?.find((x) => x.simId === p.host && x.home)
    const [pa, pd] = homeSpot(p.host)
    return { ref: lot ? `plot:${lot.key}` : undefined, at: lot ? lotAt(origin, lot.key, lot.lot) : [Math.cos(pa) * pd, Math.sin(pa) * pd] }
  }
  const partyKey = (parties ?? []).map((p) => `${p.id}:${p.guests}:${plots?.find((x) => x.simId === p.host && x.home)?.key ?? ''}`).join()
  // The house the Sim lives in (one of its lots, here).
  const mine = plots?.find((p) => p.simId === sim.id && p.home && (p.blocks.length || p.furniture?.length))
  // Living in the house one built: it is « Chez toi ». Otherwise the house stands on its lot, apart.
  const livesOnLot = sim.housing === OWN_HOUSE
  // A place is open when something can be done there now (its hours): closed, nobody's there.
  const openNow = (kind: string) => world.kinds[kind]?.interactions.some((it) => openAt(it, sim.gameMinutes)) ?? true
  // Not in one's own house: the home of one's family or housing (game/plans.go), a whole
  // house with its rooms (a shack, a room in a cour commune… a villa with its pool), drawn
  // like a house one built, so one walks in and does things on its furniture.
  const familyPlot = useMemo<Plot | undefined>(() => {
    const plan = homePlanFor(world, sim)
    return plan ? { id: 0, key: sim.id, simId: sim.id, blocks: plan.blocks, furniture: plan.furniture, zones: plan.zones, built: 0, lot: { w: plan.w, d: plan.d, area: plan.w * plan.d, city: sim.homeCity, commune: sim.homeCommune, paid: 0 }, livable: true } : undefined
  }, [world, sim.id, sim.housing, sim.family, sim.homeCity, sim.homeCommune]) // eslint-disable-line react-hooks/exhaustive-deps
  const myPlot = livesOnLot ? mine : home ? familyPlot : undefined

  // The commune's places from the map (OpenStreetMap: thousands in Yopougon),
  // asked for around the Sim as it goes (see askMap below).
  const [mapList, setMapList] = useState<Place[]>([])
  useEffect(() => {
    onMapPlaces?.(mapList)
  }, [mapList]) // eslint-disable-line react-hooks/exhaustive-deps
  const places = useMemo(() => (mapList.length ? [...commune.places, ...mapList] : commune.places), [commune.places, mapList])

  const spots = useMemo<(PlaceSpot & { kind: string; name: string })[]>(() => {
    const [a, d] = homeSpot(sim.id)
    // Home: the lot one lives on (where it was set on the map, or drawn), else where the Sim's family lives.
    const homeAt: XZ = livesOnLot ? lotAt(origin, mine?.key ?? sim.id, mine?.lot) : [Math.cos(a) * d, Math.sin(a) * d]
    // A real place found on the map (by its name) stands where the map has it.
    const list: (PlaceSpot & { kind: string; name: string })[] = places.map((p) => ({ id: p.id, kind: p.kind, name: p.name, type: p.type, faith: p.faith, parent: p.parent, slot: p.slot, at: snaps.get(p.id) ?? toLocal(origin, p.lat, p.lng), landmark: LANDMARKS[p.id], front: LANDMARK_FRONT[p.id], noFill: NO_FILL[p.id] }))
    // A home with a house built on it clears its ground: the game draws the house.
    if (home) list.unshift({ id: HOME_ID, kind: 'home', name: 'Chez toi', at: homeAt, landmark: myPlot ? lotClear(myPlot) : livesOnLot ? PLOT_CLEAR : undefined })
    for (const id of plotKey ? plotKey.split(',') : []) {
      if (id === myPlot?.key && home && livesOnLot) continue
      const p = plots?.find((x) => x.key === id)
      list.push({ id: `plot:${id}`, kind: 'plot', name: p?.simId === sim.id ? 'Mon terrain' : '', at: lotAt(origin, id, p?.lot), landmark: p ? lotClear(p) : PLOT_CLEAR })
    }
    list.push({ id: HAPPENING_KEY, kind: 'happening', name: '', at: [35, -20] })
    // The soirées: at the host's house (one's own home, a player's lot), else where the host lives.
    for (const p of parties ?? []) {
      const at = partyAt(p)
      list.push({ id: `soiree:${p.id}`, kind: 'soiree', name: `${p.title} chez ${p.hostName}`, at: at.ref === HOME_ID ? homeAt : at.at })
    }
    return list
  }, [places, origin, home, sim.id, snaps, plotKey, plotPlaces, !!myPlot, livesOnLot, partyKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const plotsRef = useRef(plots)
  plotsRef.current = plots
  const mounted = useRef(performance.now())
  // A house appears or goes (built, or all taken down): the chunk it stands on
  // is built again, with its ground cleared or not.
  const plotSpots = useRef<Map<string, XZ>>(new Map())
  useEffect(() => {
    const now = new Map(spots.filter((x) => x.landmark && (x.kind === 'plot' || x.id === HOME_ID)).map((x) => [x.id, x.at]))
    const was = plotSpots.current
    plotSpots.current = now
    // Appeared, gone, or set somewhere else on the map (then both places).
    const moved = (id: string) => now.has(id) && was.has(id) && String(now.get(id)) !== String(was.get(id))
    const changed = [...new Set([...now.keys(), ...was.keys()])].filter((id) => now.has(id) !== was.has(id) || moved(id)).flatMap((id) => (moved(id) ? [now.get(id)!, was.get(id)!] : [(now.get(id) ?? was.get(id))!]))
    if (!changed.length) return
    // Home with a house moves from the real building to the plot: that one too.
    if (now.has(HOME_ID) !== was.has(HOME_ID)) {
      const r = resolved.get(HOME_ID)
      if (r) changed.push(r.center)
    }
    setChunks((m) => {
      const n = new Map(m)
      for (const [k, c] of m) {
        if (k.includes(':')) continue
        const { box } = c.data
        if (!changed.some(([x, z]) => x >= box.x0 - PLOT_CLEAR && x < box.x1 + PLOT_CLEAR && z >= box.z0 - PLOT_CLEAR && z < box.z1 + PLOT_CLEAR)) continue
        forgetBuilt(c)
        n.delete(k)
      }
      return n
    })
    setResolved((m) => {
      const n = new Map(m)
      for (const id of [...was.keys(), ...now.keys()]) if (now.has(id) !== was.has(id) || moved(id)) n.delete(id)
      return n
    })
  }, [spots]) // eslint-disable-line react-hooks/exhaustive-deps

  // Chunk streaming, around the Sim (or wherever the camera is looking).
  const [chunks, setChunks] = useState<Map<string, Loaded>>(new Map())
  // Only the chunks the sun's shadows reach (the light follows the view's
  // centre, ±90 m: SunLight) cast them. The shadow map is drawn again as the
  // Sim walks, and every chunk beyond was drawn into it for nothing: all its
  // buildings and trees, over a million triangles a time.
  // Likewise the buildings' small parts (plinths, ledges, parapets, tanks on
  // the roofs, awnings: the « trim »), the tin roofs' steps and the shade at
  // the walls' foot: only in the chunks near the view (NEAR_ONLY), too small
  // to make out from further off, where the roofs are plain slopes.
  const [shadowed, setShadowed] = useState<Set<string>>(new Set())
  const [detailed, setDetailed] = useState<Set<string>>(new Set())
  const [high, setHigh] = useState(false)
  const shadowTick = useRef(1)
  const view = useThree((s) => s.controls) as OrbitControlsImpl | null
  useFrame((_, dt) => {
    shadowTick.current += dt
    if (shadowTick.current < 0.5 || !view) return
    shadowTick.current = 0
    const { x, z } = view.target
    const within = (R: number) => [...chunks.values()].filter((c) => !c.data.key.includes(':') && x > c.data.box.x0 - R && x < c.data.box.x1 + R && z > c.data.box.z0 - R && z < c.data.box.z1 + R).map((c) => c.data.key)
    const same = (a: string[], b: Set<string>) => a.length === b.size && a.every((k) => b.has(k))
    const near = within(150)
    if (!same(near, shadowed)) setShadowed(new Set(near))
    const seen = within(200)
    if (!same(seen, detailed)) setDetailed(new Set(seen))
    // High over the city: the commune markers instead of the places' signs and the name tags.
    const up = view.object.position.y > 320
    if (up !== high) setHigh(up)
  })
  const [resolved, setResolved] = useState<Map<string, Resolved>>(new Map())
  const pending = useRef(new Map<number, { key: string; mem: string }>())
  // Chunks arrived (from the worker, or found in BUILT) and not drawn yet: drawn together a moment
  // later, one change of state for all (each was a whole new render of the street before), then
  // the next ones asked for at once (not at the next tick, half a second on).
  const arrived = useRef<Loaded[]>([])
  const arriving = useRef(new Set<string>())
  const flushing = useRef(false)
  const failed = useRef(new Map<string, number>())
  const failedAt = useRef(new Map<string, number>())
  const loadedOnce = useRef(false)
  const worker = useRef<ChunkWorker | null>(null)
  const nextId = useRef(1)
  // Sports places too close to another: no pitch laid out for them (only the map's own).
  const tight = useMemo(() => new Set(spaceFields(spots).filter((s) => s.noLayout).map((s) => s.id)), [spots])
  const tightRef = useRef(tight)
  tightRef.current = tight
  const focus = useRef<XZ>(spots.find((s) => s.id === stationAt)?.at ?? spots.find((s) => s.id === HOME_ID)?.at ?? [0, 0])

  useEffect(() => {
    const w = startChunkWorker()
    worker.current = w
    w.onmessage = (e) => {
      const got = pending.current.get(e.data.id)
      pending.current.delete(e.data.id)
      if (!got) return
      const { key, mem } = got
      if (e.data.error || !e.data.data) {
        failed.current.set(key, (failed.current.get(key) ?? 0) + 1)
        failedAt.current.set(key, performance.now())
        // Nothing loads yet (a bad network): say so, and keep trying (never the old classic street).
        if (!loadedOnce.current && failed.current.size >= 2) onFail()
        setTimeout(() => streamRef.current(), 4000)
        return
      }
      loadedOnce.current = true
      whereabouts.streetReady = true
      onLoaded?.()
      const geos: Record<string, THREE.BufferGeometry> = {}
      for (const [name, a] of Object.entries(e.data.meshes ?? {})) {
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(a.position, 3))
        g.setAttribute('uv', new THREE.BufferAttribute(a.uv, 2))
        g.setAttribute('normal', new THREE.BufferAttribute(a.normal, 3))
        if (a.color) g.setAttribute('color', new THREE.BufferAttribute(a.color, a.colorSize ?? 3))
        if (a.lotBc) g.setAttribute('lotBc', new THREE.BufferAttribute(a.lotBc, 3))
        g.setIndex(new THREE.BufferAttribute(a.index, 1))
        g.computeBoundingSphere()
        geos[name] = g
      }
      arrive({ data: e.data.data, geos, resolved: e.data.resolved ?? [], mem })
    }
    return () => w.terminate()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const arrive = (c: Loaded) => {
    arriving.current.add(c.data.key)
    arrived.current.push(c)
    if (flushing.current) return
    flushing.current = true
    setTimeout(() => {
      flushing.current = false
      const got = arrived.current
      arrived.current = []
      if (!got.length) return
      setChunks((m) => {
        const n = new Map(m)
        for (const c of got) {
          n.set(c.data.key, c)
          keepBuilt(c, n)
        }
        return n
      })
      // A place since found elsewhere on the map: a chunk's old answer for it is stale.
      const fresh = got.flatMap((c) => c.resolved).filter((r) => {
        const at = snapsRef.current.get(r.id)
        return !at || Math.hypot(r.center[0] - at[0], r.center[1] - at[1]) < 120
      })
      if (fresh.length) setResolved((m) => new Map([...m, ...fresh.map((r) => [r.id, r] as const)]))
    }, 30)
  }

  const chunksRef = useRef(chunks)
  // Look for the real places on the map's points of interest, as tiles come in;
  // a place found moves there, onto the building standing at that point.
  useEffect(() => {
    const pois = [...chunks.values()].flatMap((c) => c.data.pois ?? [])
    if (!pois.length) return
    let changed = false
    const next = new Map(snapsRef.current)
    for (const p of commune.places) {
      // A place the game's data already puts where the map has it (not approx) stays there.
      if (!p.real || !p.approx || isMapPlace(p.id)) continue
      const poi = matchPoi({ name: p.name, kind: p.kind, at: toLocal(origin, p.lat, p.lng) }, pois)
      const was = next.get(p.id)
      if (poi && (!was || Math.hypot(was[0] - poi.at[0], was[1] - poi.at[1]) > 1)) {
        next.set(p.id, poi.at)
        changed = true
      }
    }
    if (!changed) return
    // The tiles holding a place's old and new spot are built again, so its
    // building gets the look of what it is (a town hall, a hospital…).
    const stale = new Set<string>()
    for (const [id, at] of next) {
      if (snapsRef.current.get(id) === at) continue
      const p = places.find((x) => x.id === id)
      for (const pt of [at, p ? toLocal(origin, p.lat, p.lng) : null]) {
        if (!pt) continue
        const c = [...chunks.values()].find(({ data: { key, box } }) => !key.includes(':') && pt[0] >= box.x0 && pt[0] < box.x1 && pt[1] >= box.z0 && pt[1] < box.z1)
        if (c) stale.add(c.data.key)
      }
    }
    snapsRef.current = next
    setSnaps(next)
    saveSnaps(snapKey(commune), next)
    if (import.meta.env.DEV) Object.assign(window, { __snaps: next })
    if (stale.size)
      setChunks((m) => {
        const n = new Map(m)
        for (const k of stale) {
          const c = n.get(k)
          if (c) forgetBuilt(c)
          n.delete(k)
        }
        return n
      })
    // Places in chunks already loaded are placed again here, on the main thread.
    setResolved((m) => {
      const out = new Map(m)
      for (const [id, at] of next) {
        const r = out.get(id)
        if (r && Math.hypot(r.center[0] - at[0], r.center[1] - at[1]) < 60) continue
        const c = [...chunks.values()].find(({ data: { key, box } }) => !key.includes(':') && at[0] >= box.x0 && at[0] < box.x1 && at[1] >= box.z0 && at[1] < box.z1)
        const p = places.find((x) => x.id === id)
        if (!c || !p) {
          out.delete(id)
          continue
        }
        for (const x of resolvePlaces(c.data, [{ id, at, kind: p.kind, landmark: LANDMARKS[id], name: p.name, type: p.type, noLayout: tightRef.current.has(id) }])) out.set(x.id, x)
      }
      return out
    })
  }, [chunks, places, origin])
  chunksRef.current = chunks
  const streamRef = useRef(() => {})
  const stream = () => {
    const w = worker.current
    if (!w) return
    // The first chunks wait (a moment at most) for the houses, so they're cleared at once.
    if (plotsRef.current === null && performance.now() - mounted.current < 3000) return
    const [fx, fz] = focus.current
    const ll = toLatLng(origin, focus.current)
    const [cx, cy] = tileOf(ll.lat, ll.lng, CHUNK_ZOOM)
    const wanted: { key: string; tx: number; ty: number; d: number }[] = []
    for (let dx = -2; dx <= 2; dx++)
      for (let dy = -2; dy <= 2; dy++) {
        const [tx, ty] = [cx + dx, cy + dy]
        const b = tileBox(origin, tx, ty)
        const d = Math.hypot(Math.max(b.x0 - fx, 0, fx - b.x1), Math.max(b.z0 - fz, 0, fz - b.z1))
        if (d <= LOAD_RADIUS) wanted.push({ key: `${tx}/${ty}`, tx, ty, d })
      }
    wanted.sort((a, b) => a.d - b.d)
    // Then the horizon: the lagoon, the sea, the big roads, kilometres away.
    const [fxt, fyt] = tileOf(ll.lat, ll.lng, FAR_ZOOM)
    const horizon: typeof wanted = []
    for (let dx = -2; dx <= 2; dx++)
      for (let dy = -2; dy <= 2; dy++) {
        const [tx, ty] = [fxt + dx, fyt + dy]
        const b = tileBox(origin, tx, ty, FAR_ZOOM)
        const d = Math.hypot(Math.max(b.x0 - fx, 0, fx - b.x1), Math.max(b.z0 - fz, 0, fz - b.z1))
        if (d <= FAR_RADIUS) horizon.push({ key: `${FAR_ZOOM}:${tx}/${ty}`, tx, ty, d })
      }
    horizon.sort((a, b) => a.d - b.d)
    const busy = new Set([...pending.current.values()].map((p) => p.key))
    for (const c of [...wanted, ...horizon]) {
      if (pending.current.size >= PARALLEL) break
      // A piece that failed is asked again a little later each time (up to a minute), never given up on.
      const tries = failed.current.get(c.key) ?? 0
      if (chunksRef.current.has(c.key) || busy.has(c.key) || arriving.current.has(c.key) || (tries && performance.now() - (failedAt.current.get(c.key) ?? 0) < Math.min(60000, 3000 * tries))) continue
      const far = c.key.includes(':')
      // Another commune's landmark seen from here: the map's own building of it goes (its spot clears it in its commune).
      const clear = far ? [] : skyline.filter((x) => !spots.some((p) => p.id === x.id)).map((x) => ({ at: x.at, r: LANDMARKS[x.id] }))
      const places = far ? [] : spots.filter((x) => !isMapPlace(x.id) && !isSoiree(x.id) && !x.parent).map(({ id, at, kind, landmark, name, type }) => ({ id, at, kind, landmark, name, type, noLayout: tight.has(id) }))
      const mem = requestKey(origin, c.tx, c.ty, far ? FAR_ZOOM : 0, tileBox(origin, c.tx, c.ty, far ? FAR_ZOOM : undefined), places, clear)
      // Built already while the page lives: drawn again as it was, nothing asked.
      const built = BUILT.get(mem)
      if (built) {
        arrive(built)
        continue
      }
      const id = nextId.current++
      pending.current.set(id, { key: c.key, mem })
      const req: ChunkRequest = { id, origin, tx: c.tx, ty: c.ty, token, places, z: far ? FAR_ZOOM : undefined, clear }
      w.postMessage(req)
    }
    // Chunks too far are let go, like Minecraft's render distance.
    const far = [...chunksRef.current.values()].filter(({ data: { key, box: b } }) => Math.hypot(Math.max(b.x0 - fx, 0, fx - b.x1), Math.max(b.z0 - fz, 0, fz - b.z1)) > (key.includes(':') ? FAR_DROP : DROP_RADIUS))
    if (far.length) {
      // Their geometry stays in BUILT (freed when too many): back in range, they stand at once.
      setChunks((m) => {
        const n = new Map(m)
        for (const c of far) n.delete(c.data.key)
        return n
      })
    }
  }
  streamRef.current = stream
  useEffect(stream, [spots]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    for (const k of chunks.keys()) arriving.current.delete(k)
    stream()
  }, [chunks]) // eslint-disable-line react-hooks/exhaustive-deps

  // Going to a place that isn't loaded yet: load the chunks there first.
  const [walkTo, setWalkTo] = useState<Props['goTo']>(null)
  const away = useRef<XZ | null>(null)
  const handled = useRef<Props['goTo']>(null)
  const asked = useRef<string | null>(null)
  useEffect(() => {
    if (!goTo || handled.current === goTo) return
    if (goTo.placeId === 'happening' || resolvedRef.current.has(goTo.placeId)) {
      handled.current = goTo
      away.current = null
      setWalkTo(goTo)
      return
    }
    const s = spots.find((x) => x.id === goTo.placeId)
    if (!s) {
      // A place from the map further off, found by its name (« Où aller »): asked for, and gone to once it's here.
      if (isMapPlace(goTo.placeId) && asked.current !== goTo.placeId) {
        asked.current = goTo.placeId
        api
          .mapPlace(commune.id, goTo.placeId)
          .then(({ places: got }) => got.length && setMapList((was) => [...was.filter((p) => p.id !== goTo.placeId), ...got.map((p) => ({ ...p, real: true }))]))
          .catch(() => (asked.current = null))
      }
      return
    }
    handled.current = goTo
    away.current = s.at
    focus.current = s.at
    stream()
  }, [goTo, spots]) // eslint-disable-line react-hooks/exhaustive-deps
  const resolvedRef = useRef(resolved)
  resolvedRef.current = resolved
  useEffect(() => {
    if (goTo && away.current && resolved.has(goTo.placeId)) {
      away.current = null
      setWalkTo({ ...goTo })
    }
  }, [resolved, goTo])
  // The place walked to moved (the house got its lot once the plots came, the map's building was found):
  // the walk goes on to where it is now, not where it was.
  const walkedDoor = useRef<{ id: string; door: XZ } | null>(null)
  useEffect(() => {
    if (!walkTo) return
    const door = resolved.get(walkTo.placeId)?.door
    if (!door) return
    const was = walkedDoor.current
    walkedDoor.current = { id: walkTo.placeId, door }
    if (was?.id === walkTo.placeId && Math.hypot(was.door[0] - door[0], was.door[1] - door[1]) > 3) setWalkTo({ ...walkTo })
  }, [resolved, walkTo])

  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const tick = useRef(0)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 0.6) return
    tick.current = 0
    if (away.current) focus.current = away.current
    else if (controls) focus.current = [controls.target.x, controls.target.z]
    stream()
    askMap()
    const [hx, hz] = focus.current
    if (Math.hypot(hx - here[0], hz - here[1]) > 15) setHere([hx, hz])
  })

  // The map's places around the Sim: asked again every 400 m, kept (up to a
  // few thousand) so they don't vanish behind it.
  const mapAsked = useRef<XZ | null>(null)
  // A commune with a few hundred of them: all at once (« Où aller » lists every one, as many as its number says).
  const allAsked = useRef(false)
  const askMap = () => {
    if (!allAsked.current && (commune.mapCount ?? 0) > 0 && (commune.mapCount ?? 0) <= ALL_MAP_PLACES) {
      allAsked.current = true
      api
        .allPlaces(commune.id)
        .then(({ places: got }) => got.length && setMapList((was) => [...was.filter((p) => !got.some((g) => g.id === p.id)), ...got.map((p) => ({ ...p, real: true }))]))
        .catch(() => (allAsked.current = false))
    }
    const at = focus.current
    if (mapAsked.current && Math.hypot(at[0] - mapAsked.current[0], at[1] - mapAsked.current[1]) < 400) return
    mapAsked.current = at
    const ll = toLatLng(origin, at)
    api
      .mapPlaces(commune.id, ll.lat, ll.lng)
      .then(({ places: got }) => {
        if (!got.length) return
        setMapList((was) => {
          const m = new Map(was.map((p) => [p.id, p]))
          for (const p of got) m.set(p.id, { ...p, real: true })
          const all = [...m.values()]
          return all.length > 5000 ? all.slice(all.length - 5000) : all
        })
      })
      .catch(() => (mapAsked.current = null))
  }
  // Busy at a place from the map: that one first, wherever it is, and the
  // world loads around it.
  useEffect(() => {
    if (!stationAt || !isMapPlace(stationAt) || mapList.some((p) => p.id === stationAt)) return
    api
      .mapPlace(commune.id, stationAt)
      .then(({ places: got }) => got.length && setMapList((was) => [...was, ...got.map((p) => ({ ...p, real: true }))]))
      .catch(() => {})
  }, [stationAt]) // eslint-disable-line react-hooks/exhaustive-deps
  const toStation = useRef(false)
  useEffect(() => {
    if (toStation.current || !stationAt || !isMapPlace(stationAt) || performance.now() - mounted.current > 15000) return
    const s = spots.find((x) => x.id === stationAt)
    if (!s) return
    toStation.current = true
    focus.current = s.at
    stream()
  }, [spots]) // eslint-disable-line react-hooks/exhaustive-deps
  // Where the Sim is (to the nearest 15 m): the map's places show their sign up close only.
  const [here, setHere] = useState<XZ>(() => focus.current)

  // The map's places are put on their building here, on the main thread, in
  // the chunks already loaded: a real building (or one the game built in
  // the quarter) within 30 m, or nothing; they don't get a lot of their own.
  useEffect(() => {
    const todo = spots.filter((x) => isMapPlace(x.id) && !resolved.has(x.id))
    if (!todo.length) return
    const found: Resolved[] = []
    for (const c of chunks.values()) {
      if (c.data.key.includes(':')) continue
      const { box } = c.data
      const inside = todo.filter(({ at: [x, z] }) => x >= box.x0 && x < box.x1 && z >= box.z0 && z < box.z1)
      if (!inside.length) continue
      // A map place stands in a real building, or plays on its pitch.
      for (const r of resolvePlaces(c.data, inside.map(({ id, at, kind, name, type }) => ({ id, at, kind, name, type, noLayout: tight.has(id) })))) if (r.real || r.field || r.station) found.push(r)
    }
    if (found.length) setResolved((m) => new Map([...m, ...found.map((r) => [r.id, r] as const)]))
  }, [spots, chunks]) // eslint-disable-line react-hooks/exhaustive-deps

  // The few real buildings in the way of a game-made one don't block the way.
  const clears = useMemo(() => new Map(spots.filter((x) => x.landmark).map((x) => [x.id, x.landmark!])), [spots])
  const made = useMemo<XZ[]>(() => [...resolved.values()].filter((r) => !r.real && !r.field && !r.station && !clears.has(r.id) && !isSoiree(r.id)).map((r) => r.center), [resolved, clears])
  const marks = useMemo(() => [...resolved.values()].filter((r) => clears.has(r.id)).map((r) => ({ at: r.center, r: clears.get(r.id)! })), [resolved, clears])
  // The landmarks' buildings stand in their cleared ground's middle: the traffic keeps off the streets the map runs through there.
  const nav = useMemo(
    () =>
      new Nav(
        [...chunks.values()].filter((c) => !c.data.key.includes(':')).map((c) => c.data),
        (c, ring) => inTheWay(made, c, marks, ring),
        marks.map((m) => ({ at: m.at, r: m.r * 0.6 })),
        made,
        [...resolved.values()].flatMap((r) => (r.field ? [r.field] : [])),
      ),
    [chunks, made, marks, resolved],
  )

  // The soirées stand at the house they're thrown in (its resolved lot), else on the street nearest
  // where the host lives, facing it; they go when they end.
  useEffect(() => {
    const add: Resolved[] = []
    const ids = new Set((parties ?? []).map((p) => `soiree:${p.id}`))
    const gone = [...resolved.keys()].filter((id) => isSoiree(id) && !ids.has(id))
    for (const p of parties ?? []) {
      const id = `soiree:${p.id}`
      const at = partyAt(p)
      const ref = at.ref ? resolved.get(at.ref) : undefined
      const had = resolved.get(id)
      if (ref) {
        if (!had || had.door[0] !== ref.door[0] || had.door[1] !== ref.door[1]) add.push({ id, door: ref.door, center: ref.door, rot: ref.rot, roadAngle: ref.roadAngle })
        continue
      }
      if (had || at.ref) continue
      const n = nav.nodes.length ? nav.nearest(at.at, 120) : null
      if (!n) continue
      // Off the roadway, on the side of the house: the gate a few metres from the middle of the street.
      const [dx, dz] = [at.at[0] - n.at[0], at.at[1] - n.at[1]]
      const len = Math.hypot(dx, dz) || 1
      const k = Math.min(5, len) / len
      const door: XZ = [n.at[0] + dx * k, n.at[1] + dz * k]
      add.push({ id, door, center: door, rot: Math.atan2(-dx, -dz), roadAngle: 0 })
    }
    if (add.length || gone.length)
      setResolved((m) => {
        const out = new Map(m)
        for (const id of gone) out.delete(id)
        for (const r of add) out.set(r.id, r)
        return out
      })
  }, [partyKey, resolved, nav]) // eslint-disable-line react-hooks/exhaustive-deps

  // The ground the game gave away (its buildings, the landmarks, the fields, the stations, the lots): no street pitch or stall on it.
  const taken = useMemo<Taken[]>(
    () =>
      [...resolved.values()].map((r) => ({
        at: r.field?.at ?? r.center,
        r: r.field ? Math.hypot(r.field.len, r.field.wid) / 2 + 3 : clears.has(r.id) ? clears.get(r.id)! : r.id.startsWith('plot:') || r.id === HOME_ID ? 20 : r.station ? 16 : r.real ? 0 : 12,
      })).filter((t) => t.r > 0),
    [resolved, clears],
  )

  // The places inside a landmark (the clubs of the Rue Princesse): at their slot on its ground, once it stands.
  const placed = useMemo(() => {
    const out = new Map(resolved)
    for (const s of spots) {
      const p = s.parent ? resolved.get(s.parent) : undefined
      const at = p && slotIn(s.parent!, s.slot ?? 0)
      if (!p || !at) continue
      const [c, n] = [Math.cos(p.rot), Math.sin(p.rot)]
      const world = ([x, z]: XZ): XZ => [p.center[0] + x * c + z * n, p.center[1] - x * n + z * c]
      const rot = at.rot + p.rot
      const [dx, dz] = [Math.sin(rot), Math.cos(rot)]
      const door = world(at.door)
      out.set(s.id, { id: s.id, door: [door[0] + dx * 1.2, door[1] + dz * 1.2], center: [door[0] - dx * 4, door[1] - dz * 4], rot, roadAngle: p.roadAngle })
    }
    return out
  }, [resolved, spots])

  // The places, once they stand on a loaded street.
  const lots = useMemo<Lot[]>(
    () =>
      spots
        // Others' lots aren't places; one's own is (« Mon terrain »: on the mini-map, in « Où aller ? »).
        .filter((s) => s.id !== HAPPENING_KEY && (s.kind !== 'plot' || s.id === `plot:${sim.id}` || s.id.startsWith(`plot:${sim.id}:`)) && placed.has(s.id))
        .map((s, i) => {
          const r = placed.get(s.id)!
          return { id: s.id, kind: s.kind, name: s.name, faith: s.faith, child: !!s.parent, x: r.center[0], z: r.center[1], rot: r.rot, door: r.door, seed: i, height: r.real?.height, field: r.field, station: r.station }
        }),
    [spots, placed],
  )
  // Drawn: the game's places, and the map's thousands only near the Sim.
  const shown = useMemo(() => lots.filter((l) => !isMapPlace(l.id) || Math.hypot(l.x - here[0], l.z - here[1]) < MAP_SIGNS), [lots, here])
  // Not a wall of names over the street: the nearest places have their name,
  // the others round the Sim an icon, the rest nothing (the mini-map and
  // « Où aller ? » list them all). Home, and where the Sim is busy, always.
  // « soiree-deco »: a soirée's sign says its entry, its guests and since when, and is read from further off.
  const deco = keyOpen(useFeatures(), 'soiree-deco')
  const labelOf = useMemo(() => {
    const out = new Map<string, 'full' | 'icon'>()
    shown
      .map((l) => ({ id: l.id, d: Math.hypot(l.x - here[0], l.z - here[1]) }))
      .sort((a, b) => a.d - b.d)
      .forEach((l, i) => {
        if ((i < NAMED && l.d < 80) || (deco && isSoiree(l.id) && l.d < 160)) out.set(l.id, 'full')
        else if (l.d < 45) out.set(l.id, 'icon')
      })
    out.set(HOME_ID, 'full')
    if (stationAt) out.set(stationAt, 'full')
    return out
  }, [shown, here, stationAt, deco])
  const named = (id: string) => labels && labelOf.get(id) === 'full'
  const spot = resolved.get(HAPPENING_KEY)
  // A jam follows the real street (its bends, where it ends), not a straight line over the grass.
  const jam = useMemo(() => {
    if (happening?.id !== 'embouteillage' || !spot) return null
    const roads = [...chunks.values()].filter((c) => !c.data.key.includes(':')).flatMap((c) => c.data.roads)
    const found = jamAlong(roads, spot.door, 7.5, 6)
    return found.cars.length ? found : null
  }, [happening?.id, spot, chunks])
  const happeningLot = useMemo<Lot | null>(() => {
    if (!happening || !spot) return null
    // A jam: the Sim goes to the side of the big road it's on.
    if (jam) {
      const door: XZ = [jam.at[0] + 6, jam.at[1] + 6]
      return { id: 'happening', kind: 'happening', name: happening.label, x: door[0], z: door[1], rot: 0, door, seed: 0 }
    }
    // The scene is staged along a street: turn it to the real one.
    const [dx, dz] = [HAPPENING_DOOR[0] - HAPPENING_X, HAPPENING_DOOR[1]]
    const [c, s] = [Math.cos(spot.roadAngle), Math.sin(spot.roadAngle)]
    const door: XZ = [spot.door[0] + dx * c - dz * s, spot.door[1] + dx * s + dz * c]
    return { id: 'happening', kind: 'happening', name: happening.label, x: door[0], z: door[1], rot: 0, door, seed: 0 }
  }, [happening, spot, jam])
  const walkLots = useMemo(() => (happeningLot ? [...lots, happeningLot] : lots), [lots, happeningLot])
  // Joined in: the Sim's place in the scene (a chair, the crowd), turned to the real street like the scene.
  const joinRole = useMemo(() => {
    const r = happening && spot && !jam ? HAPPENING_ROLES[happening.id] : undefined
    if (!r || !spot) return null
    const [c, s] = [Math.cos(spot.roadAngle), Math.sin(spot.roadAngle)]
    const world = ([x, z]: XZ): XZ => [spot.door[0] + (x - HAPPENING_X) * c - z * s, spot.door[1] + (x - HAPPENING_X) * s + z * c]
    // On the move with the scene (the cortège): where the Sim's place in it is now, in the street's frame.
    const move = r.moving && ((t: number) => {
      const p = r.moving!(t)
      return { at: world([p.x, p.z]), heading: p.h - spot.roadAngle }
    })
    return { at: world(r.at), face: world(r.face), pose: r.pose, move: move || undefined }
  }, [happening, spot, jam])

  // For the mini-map and the « Où aller ? » list.
  useEffect(() => {
    whereabouts.places = walkLots.map((l) => ({ id: l.id, kind: l.kind, name: l.name, door: l.door }))
    // Development only (tests): the lots set down, with where each stands and faces.
    if (import.meta.env.DEV) Object.assign(globalThis, { __lots: () => walkLots.map((l) => ({ id: l.id, x: l.x, z: l.z, rot: l.rot, door: l.door })) })
    // The commune's places further than the streets loaded (its mairie at the other end, a forest 7 km off): there
    // too, where the map puts them; going there loads the streets round them first.
    const set = new Set(walkLots.map((l) => l.id))
    whereabouts.further = spots.filter((s) => s.name && !set.has(s.id) && s.kind !== 'plot' && s.kind !== 'happening' && s.id !== HOME_ID).map((s) => ({ id: s.id, kind: s.kind, name: s.name, door: s.at }))
    whereabouts.toLocal = (lat, lng) => toLocal(origin, lat, lng)
    // In development, every lot (the landmarks too), for tests in the browser.
    if (import.meta.env.DEV) Object.assign(window, { __lots: lots.map((l) => ({ id: l.id, kind: l.kind, x: l.x, z: l.z, rot: l.rot, door: l.door })) })
  }, [walkLots, lots, spots, origin])
  useEffect(() => {
    whereabouts.roads = nav.edges.map((e) => [nav.nodes[e.a], nav.nodes[e.b], e.width] as [XZ, XZ, number])
    if (import.meta.env.DEV) Object.assign(window, { __nav: nav })
    whereabouts.water = [...chunks.values()].flatMap((c) => c.data.areas.filter((a) => a.kind === 'water').map((a) => a.rings[0]))
    whereabouts.trees = [...chunks.values()].filter((c) => !c.data.key.includes(':')).flatMap((c) => [...c.data.trees, ...c.data.palms, ...(c.data.forest ?? [])])
  }, [nav, chunks])

  // The airport's runways (the horizon shows them too), and the big bridges
  // under the names everyone calls them by.
  const runways = useMemo(() => [...chunks.values()].flatMap((c) => (c.data.aeroways ?? []).filter((w) => w.cls === 'runway').map((w) => w.pts)), [chunks])
  const bridgeLabels = useMemo(() => {
    const best = new Map<string, { at: XZ; len: number }>()
    for (const c of chunks.values()) {
      if (c.data.key.includes(':')) continue
      for (const r of c.data.roads) {
        const kind = bridgeKind(r.name)
        if (!kind) continue
        const name = BRIDGE_LABEL[kind]
        for (let i = 1; i < r.pts.length; i++) {
          const [a, b] = [r.pts[i - 1], r.pts[i]]
          const len = Math.hypot(b[0] - a[0], b[1] - a[1])
          if (len > (best.get(name)?.len ?? 0)) best.set(name, { at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], len })
        }
      }
    }
    return [...best].map(([name, { at }]) => ({ name, at }))
  }, [chunks])
  const nearWater = useMemo(() => [...chunks.values()].filter((c) => !c.data.key.includes(':')).flatMap((c) => c.data.areas.filter((a) => a.kind === 'water').map((a) => a.rings)), [chunks])

  // The big landmarks can't be walked through (the Rue Princesse, the gares, the squares can).
  useEffect(() => {
    setObstacles(
      'landmarks',
      lots.flatMap((l) => {
        if (SOLID_LANDMARKS[l.id]) return [{ x: l.x, z: l.z, r: SOLID_LANDMARKS[l.id] }]
        // The grounds one walks through: their buildings, walls and cages, turned with the lot.
        const [c, s] = [Math.cos(l.rot), Math.sin(l.rot)]
        return (GROUNDS[l.id] ?? []).map((o): Obstacle => {
          const at = { x: l.x + o.x * c + o.z * s, z: l.z - o.x * s + o.z * c }
          return 'r' in o ? { ...at, r: o.r } : { ...o, ...at, rot: o.rot + l.rot }
        })
      }),
    )
    return () => clearObstacles('landmarks')
  }, [lots])
  // Nor the houses players built: each wall column (two blocks high or more), with its height for the close camera.
  useEffect(() => {
    const list: Obstacle[] = []
    for (const r of resolved.values()) {
      const owner = r.id === HOME_ID ? myPlot : r.id.startsWith('plot:') ? plots?.find((p) => `plot:${p.key}` === r.id) : undefined
      if (!owner) continue
      const [w, d] = lotSize(owner)
      // A column is a wall where it stands at body height (a block at y 1; a floor tile at
      // y 0 is walked on). A roof overhead leaves the floor under it free: the Sim walks in.
      const ys = new Map<string, Set<number>>()
      for (const [x, y, z] of owner.blocks) {
        const k = `${x},${z}`
        if (!ys.has(k)) ys.set(k, new Set())
        ys.get(k)!.add(y)
      }
      const [c, s] = [Math.cos(r.rot), Math.sin(r.rot)]
      const at = (u: number, v: number) => [r.center[0] + u * c + v * s, r.center[1] - u * s + v * c] as const
      for (const [k, set] of ys) {
        if (!set.has(1)) continue
        let h = 1
        while (set.has(h)) h++
        const [lx, lz] = k.split(',').map(Number)
        const [x, z] = at(lx + 0.5 - w / 2, lz + 0.5 - d / 2)
        list.push({ x, z, hw: 0.5, hd: 0.5, rot: r.rot, top: h })
      }
      // A player's clôture, the gate left open.
      if (r.id !== HOME_ID || livesOnLot)
        for (const f of fenceRuns(w, d)) {
          const [x, z] = at(f.x - w / 2, f.z - d / 2)
          list.push({ x, z, hw: f.along === 'x' ? f.len / 2 : 0.15, hd: f.along === 'x' ? 0.15 : f.len / 2, rot: r.rot, top: 1.4 })
        }
      // A pool is in the way (one doesn't walk into the water).
      for (const [zx, zz, zw, zd, k] of owner.zones ?? []) {
        if (k !== 'piscine') continue
        const [x, z] = at(zx + zw / 2 - w / 2, zz + zd / 2 - d / 2)
        list.push({ x, z, hw: zw / 2, hd: zd / 2, rot: r.rot, top: 0.7 })
      }
      // The furniture is in the way too (not a rug on the floor).
      const catalog = new Map((world.furniture ?? []).map((f) => [f.id, f]))
      for (const piece of owner.furniture ?? []) {
        const f = catalog.get(piece[4])
        if (!f || f.h < 0.2) continue
        const [fw, fd] = piece[3] % 2 ? [f.d, f.w] : [f.w, f.d]
        const [x, z] = at(piece[0] + fw / 2 - w / 2, piece[2] + fd / 2 - d / 2)
        list.push({ x, z, hw: fw / 2, hd: fd / 2, rot: r.rot, top: piece[1] + f.h })
      }
    }
    setObstacles('plots', list)
    return () => clearObstacles('plots')
  }, [resolved, myPlot, plots, world.plot, world.furniture, livesOnLot])

  // The Sim inside its own house: the roof and the top of the walls come off, as in the Sims.
  const [inside, setInside] = useState(false)
  const insideTick = useRef(0)
  useFrame((_, dt) => {
    insideTick.current += dt
    if (insideTick.current < 0.25) return
    insideTick.current = 0
    const r = resolved.get(HOME_ID)
    let now = false
    if (r && myPlot) {
      const [w, d] = lotSize(myPlot)
      const [dx, dz] = [whereabouts.sim[0] - r.center[0], whereabouts.sim[1] - r.center[1]]
      const [c, s] = [Math.cos(r.rot), Math.sin(r.rot)]
      const [u, v] = [dx * c - dz * s, dx * s + dz * c]
      // Under a roof of the house, not just on the lot.
      const [lx, lz] = [Math.floor(u + w / 2), Math.floor(v + d / 2)]
      now = Math.abs(u) < w / 2 && Math.abs(v) < d / 2 && myPlot.blocks.some(([x, y, z]) => x === lx && z === lz && y >= 2)
    }
    if (now !== inside) setInside(now)
  })
  // In one's own house, the things done at home are done on its furniture: sleeping
  // in the bed, the shower, cooking at the gazinière, the TV from the sofa.
  const homeSpots = useMemo(() => {
    const r = resolved.get(HOME_ID)
    return r && myPlot && myPlot.blocks.length && world.furniture ? homeSpotsOf(myPlot, lotSize(myPlot), r.center, r.rot, world.furniture) : {}
  }, [resolved, myPlot, world.furniture])
  const homeIds = Object.keys(homeSpots).sort().join()
  // A street scene joined (joinIn.tsx: the grin's tea, the causerie…): the Sim's place in it, while it lasts.
  // (One left long ago doesn't count: tea at a seller's cart is drunk standing there.)
  const joined = whereabouts.joined
  const joinedSpot = busy?.id && joined?.activity === busy.id && Math.hypot(joined.spot.from[0] - whereabouts.sim[0], joined.spot.from[1] - whereabouts.sim[1]) < 40 ? joined.spot : undefined
  const joinValue = useMemo(() => ({ go: onStreetBuy, doing: busy?.id }), [onStreetBuy, busy?.id])
  useEffect(() => {
    onHomeSpots?.(homeIds ? homeIds.split(',') : myPlot?.blocks.length ? [''] : [])
  }, [homeIds, !!myPlot?.blocks.length]) // eslint-disable-line react-hooks/exhaustive-deps
  // The house itself, for the screen inside it (world3d/HomeInside).
  useEffect(() => {
    onHomePlot?.(myPlot)
  }, [myPlot]) // eslint-disable-line react-hooks/exhaustive-deps

  const homeLot = lots.find((l) => l.id === HOME_ID)
  const walkNav = useMemo<WalkNav>(
    () => ({
      walkable: (x, z) => nav.walkable(x, z),
      route: (a, b) => nav.path(a, b),
      drive: (a, b) => nav.path(a, b, DRIVABLE),
      // To a place by car: to the kerb nearest its door, or a little further along another street
      // when that one is the shorter drive (the nearest street may be behind its block).
      driveTo: (a, door) => {
        const len = (w: XZ[]) => w.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - w[i - 1][0], q[1] - w[i - 1][1]) : 0), 0)
        let best: { way: XZ[]; cost: number } | null = null
        const seen = new Set<string>()
        for (const c of nav.near(door, 45, DRIVABLE)) {
          const k = `${Math.round(c.at[0] / 8)},${Math.round(c.at[1] / 8)}`
          if (seen.has(k)) continue
          seen.add(k)
          const way = nav.path(a, c.at, DRIVABLE)
          if (way) {
            const cost = len(way) + c.dist * 4
            if (!best || cost < best.cost) best = { way, cost }
          }
          if (seen.size >= 5) break
        }
        return best?.way ?? nav.path(a, door, DRIVABLE)
      },
      heightAt: (x, z) => nav.heightAt(x, z),
      roofAt: (x, z) => nav.roofAt(x, z),
      street: (p) => {
        const n = nav.nearest(p, 80)
        if (!n) return null
        const e = nav.edges[n.edge]
        const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
        return { at: n.at, dir: Math.atan2(b[0] - a[0], b[1] - a[1]), width: e.width }
      },
      start: homeLot?.door ?? (nav.nearest(focus.current)?.at as XZ | undefined),
    }),
    [nav, homeLot],
  )
  // The Sim appears once the street it starts on is there.
  const startId = stationAt && lots.some((l) => l.id === stationAt) ? stationAt : HOME_ID
  const ready = lots.some((l) => l.id === startId) || (!home && nav.nodes.length > 0) || (nav.nodes.length > 0 && !spots.some((s) => s.id === startId))

  const [shownLabels, setLabels] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setLabels(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const labels = shownLabels && !high

  // The jam crawls, and regulated at the junction it drives off (the update « circulation », jamCars.tsx);
  // gone, the street's traffic is back.
  const feats = useFeatures()
  const crawl = keyOpen(feats, 'circulation')
  const [clearing, setClearing] = useState<number | null>(null)
  const [flowing, setFlowing] = useState(false)
  const cleared = !!happening?.cleared
  useEffect(() => {
    setClearing(cleared ? performance.now() : null)
    setFlowing(false)
  }, [cleared, happening?.id])
  const stopsTraffic = !!happening && STOPS_TRAFFIC.has(happening.id) && !(cleared && (flowing || !jam || !crawl))
  const parked = useParked()
  const raining = happening?.id === 'pluie'
  // The street runs for cover (rainRun.tsx).
  useEffect(() => useRain.setState({ on: raining }), [raining])
  useEffect(() => () => useRain.setState({ on: false }), [])
  // Power cuts (world3d/power.ts): the zones round the Sim cut now, and the happening's « Délestage »
  // street's zone with them. Their windows go dark, their lamps out; the Sim in one, the night darker.
  const [cuts, setCuts] = useState<PowerCut[]>([])
  useEffect(() => {
    const tick = () => {
      const now = minuteOf(serverNow())
      const found = cutsAround(commune.id, whereabouts.sim[0], whereabouts.sim[1], now, 1)
      if (happening?.id === 'delestage' && spot && !inCut(found, spot.door[0], spot.door[1])) found.push({ ix: zoneOf(spot.door[0], spot.door[1])[0], iz: zoneOf(spot.door[0], spot.door[1])[1], start: now, end: now + 120 })
      setCuts((old) => (old.length === found.length && old.every((c, i) => c.ix === found[i].ix && c.iz === found[i].iz) ? old : found))
    }
    tick()
    const t = setInterval(tick, 20000)
    return () => clearInterval(t)
  }, [commune.id, happening?.id, spot])
  useEffect(() => {
    const u = mats.walls.userData
    cuts.slice(0, CUTS).forEach((c, i) => u.powerCuts.value[i].set(c.ix, c.iz))
    u.powerCutN.value = Math.min(CUTS, cuts.length)
  }, [cuts, mats])
  const dark = useMemo(() => (cuts.length ? (x: number, z: number) => !!inCut(cuts, x, z) : undefined), [cuts])
  const simInCut = night && !!inCut(cuts, whereabouts.sim[0], whereabouts.sim[1])
  // The near chunks' squares: the horizon's blocks don't stand in them (their own buildings are there).
  const nearBoxes = useMemo(() => [...chunks.values()].filter((c) => !c.data.key.includes(':')).map((c) => c.data.box), [chunks])
  return (
    <>
      <DepthRange />
      {/* Nights are blue but readable: the Sim and the streets stay visible on a phone. */}
      <hemisphereLight args={[night ? '#7484c4' : '#ffffff', night ? '#3a3a56' : '#b8a27c', (night ? 1.3 : 1.2) * (raining ? 0.7 : 1) * (simInCut ? 0.72 : 1)]} />
      <Sun night={night} dusk={dusk} dim={raining ? 0.35 : 1} />
      {/* The haze at the edge of the loaded world: Minecraft's render distance (closer and grey in the rain) */}
      <fog attach="fog" args={[raining ? (night ? '#2c313d' : '#8a96a3') : skyTone(night, dusk).horizon, raining ? 120 : 400, raining ? 1800 : 5200]} />
      {/* The downpour: over the whole commune, from its clouds */}
      {raining && <RainSky focus={focus} night={night} />}
      <NearPlane />
      <SkyDome night={night} dusk={dusk} rain={raining} />
      {/* At night, lamps, windows and headlights bloom a little (not on small phones) */}
      {night && RICH && (
        <Suspense fallback={null}>
          <NightBloom />
        </Suspense>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} material={mats.ground} receiveShadow>
        <planeGeometry args={[30000, 30000]} />
      </mesh>
      {/* Zoomed out: each commune's name on its pin */}
      <CommuneMarkers communes={cityCommunes} origin={origin} here={commune.id} />
      {/* Over the roofs, from the whole city: the Tour F, while its own lot isn't drawn here */}
      {skyline
        .filter((x) => !lots.some((l) => l.id === x.id) && Math.hypot(x.at[0] - here[0], x.at[1] - here[1]) < SKYLINE_FAR)
        .map((x) => (
          <group key={x.id} position={[x.at[0], 0, x.at[1]]}>
            <FarLandmark id={x.id} night={night} />
          </group>
        ))}

      {[...chunks.values()].map((c) => {
        const far = c.data.key.includes(':')
        const shade = !far && shadowed.has(c.data.key)
        return (
        <group key={c.data.key} position={[0, far ? -0.015 : 0, 0]}>
          {/* A near chunk's square in the stencil: the horizon isn't drawn under it */}
          {!far && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(c.data.box.x0 + c.data.box.x1) / 2, 0, (c.data.box.z0 + c.data.box.z1) / 2]} material={CHUNK_MASK} renderOrder={-100}>
              <planeGeometry args={[c.data.box.x1 - c.data.box.x0, c.data.box.z1 - c.data.box.z0]} />
            </mesh>
          )}
          {Object.entries(c.geos).map(([name, g]) => (
            <mesh key={name} name={name} geometry={g} material={(far ? farMats : mats)[(name === 'tinLow' ? 'tin' : name) as keyof typeof mats]} castShadow={shade && SOLID.has(name)} receiveShadow={!far && name !== 'contact'} visible={far || (NEAR_ONLY.has(name) ? detailed.has(c.data.key) : name !== 'tinLow' || !detailed.has(c.data.key))} />
          ))}
          {far && c.data.farBlocks?.length ? <FarBlocks blocks={c.data.farBlocks} hide={nearBoxes} night={night} /> : null}
          <Trees pts={c.data.trees} bark={mats.bark} leaves={mats.leaves} shadows={shade} />
          <Forest pts={c.data.forest ?? []} bark={mats.bark} />
          <Palms pts={c.data.palms ?? []} bark={mats.bark} leaves={mats.leaves} shadows={shade} />
          {c.data.stations?.map((st, i) => <FuelStation key={i} s={st} night={night} />)}
        </group>
        )
      })}

      {/* Houses built by players: this one's at home, the others' where they live */}
      {[...resolved.values()].map((r) => {
        const owner = r.id === HOME_ID ? myPlot : r.id.startsWith('plot:') ? plots?.find((p) => `plot:${p.key}` === r.id) : undefined
        return owner && world.materials ? (
          <group key={`house${r.id}`} position={[r.center[0], 0, r.center[1]]} rotation={[0, r.rot, 0]}>
            <group position={[-lotSize(owner)[0] / 2, 0, -lotSize(owner)[1] / 2]} onClick={r.id === HOME_ID ? (e) => (e.stopPropagation(), onPick(HOME_ID)) : undefined}>
              {/* A house from a plan still going up: its building site (open/chantier.tsx), the furniture once it's done */}
              {building(owner) ? (
                <Chantier plot={owner} materials={world.materials} w={lotSize(owner)[0]} d={lotSize(owner)[1]} />
              ) : r.id === HOME_ID && inside ? (
                <CutHouse blocks={owner.blocks} materials={world.materials} top={CUT_HEIGHT} look={simPoint} />
              ) : (
                <House blocks={owner.blocks} materials={world.materials} />
              )}
              {!building(owner) && owner.furniture?.length > 0 && world.furniture && <FurnitureSet pieces={r.id === HOME_ID && inside ? downstairs(owner.furniture, CUT_HEIGHT) : owner.furniture} catalog={world.furniture} />}
              {/* The ground: the rooms' floors, the yard or the lawn, the pool; a bare lot, its lawn and its corner posts */}
              {/* A lot a player owns: its clôture, in its owner's colour, the name over the gate */}
              {(r.id !== HOME_ID || livesOnLot) && <LotFence w={lotSize(owner)[0]} d={lotSize(owner)[1]} color={ownerColor(owner.simId)} name={`Chez ${owner.simId === sim.id ? sim.firstName : owner.firstName ?? ''}`} />}
              {owner.zones?.length ? (
                // The garden's plants and the pool's edge: not walked through.
                <Solid parts>
                  <Zones zones={owner.zones} blocks={owner.blocks} furniture={owner.furniture ?? []} w={lotSize(owner)[0]} d={lotSize(owner)[1]} cut={r.id === HOME_ID && inside} />
                </Solid>
              ) : (
                owner.lot && <LotGround w={lotSize(owner)[0]} d={lotSize(owner)[1]} />
              )}
            </group>
          </group>
        ) : null
      })}
      {shown.map((lot) =>
        lot.kind === 'soiree' ? (
          // A player's soirée: its beams, its sign, its speakers and its dancers at the gate.
          <group key={lot.id}>
            <group position={[lot.door[0], 0, lot.door[1]]} rotation={[0, lot.rot, 0]} onClick={(e) => (e.stopPropagation(), onPick(lot.id))}>
              {(() => {
                const p = parties?.find((x) => `soiree:${x.id}` === lot.id)
                return p ? <PartyFront party={p} night={night} entry={deco ? entryLabel(p.price) : undefined} /> : null
              })()}
            </group>
            <LotLabel lot={lot} world={world} label={labels && labelOf.get(lot.id)} onPick={onPick} y={6} sub={deco ? partyLine(parties?.find((x) => `soiree:${x.id}` === lot.id)) : undefined} />
          </group>
        ) : lot.kind === 'plot' ? (
          // One's own lot: its ground and clôture are drawn with the houses above; here only its name.
          <LotLabel key={lot.id} lot={lot} world={world} label={labels && labelOf.get(lot.id)} onPick={onPick} y={3} />
        ) : lot.id === HOME_ID && myPlot ? (
          <LotLabel key={lot.id} lot={lot} world={world} label={labels && labelOf.get(lot.id)} onPick={onPick} y={4} />
        ) : lot.child ? (
          // A club of the Rue Princesse: the street draws its front; here, its name.
          <LotLabel key={lot.id} lot={lot} world={world} label={labels && labelOf.get(lot.id)} onPick={onPick} y={7} />
        ) : lot.station ? (
          <LotLabel key={lot.id} lot={lot} world={world} label={labels && labelOf.get(lot.id)} onPick={onPick} y={7} />
        ) : lot.field ? (
          <group key={lot.id}>
            <SportField nav={nav} field={lot.field} seed={lot.id} night={night} withSim={stationAt === lot.id && !!busy?.id && /^play-/.test(busy.id)} onPick={() => onPick(lot.id)} />
            <LotLabel lot={lot} world={world} label={labels && labelOf.get(lot.id)} onPick={onPick} y={5} />
          </group>
        ) : LANDMARKS[lot.id] ? (
          <group key={lot.id}>
            <group position={[lot.x, 0, lot.z]} rotation={[0, lot.rot, 0]} onClick={(e) => (e.stopPropagation(), onPick(lot.id))}>
              {/* What's on its ground at body height can't be walked through (its own walls are in the landmarks' obstacles too) */}
              <Solid parts>
                <Landmark id={lot.id} night={night} open={openNow(lot.kind)} />
                {PARTIES[lot.id] && <Party id={lot.id} night={night} simGender={sim.gender} onTalk={onTalk} />}
              </Solid>
            </group>
            <LotLabel lot={lot} world={world} label={labels && labelOf.get(lot.id)} onPick={onPick} y={30} />
          </group>
        ) : lot.height ? (
          <PlaceSign key={lot.id} lot={lot} world={world} night={night} label={named(lot.id)} onPick={onPick} />
        ) : (
          <LotView key={lot.id} lot={lot} world={world} night={night} label={named(lot.id)} onPick={onPick} />
        ),
      )}
      {shown.map((lot) => {
        const g = resolved.get(lot.id)?.gate
        return g ? <CampusGate key={`gate${lot.id}`} name={lot.name} kind={lot.kind} at={g.at} rot={g.rot} width={g.width} night={night} /> : null
      })}
      {/* The cars stuck in it: walked round, not through */}
      {jam && crawl && !flowing && <MovingJam path={jam.path} width={jam.width} clearing={clearing} onCleared={() => setFlowing(true)} seed={commune.id} />}
      {jam && !crawl && (
        <Solid parts>
          <JamOnRoad cars={jam.cars} />
        </Solid>
      )}
      {happening && spot && (
        <group position={jam ? [jam.at[0] + HAPPENING_X, 0, jam.at[1]] : [spot.door[0], 0, spot.door[1]]} rotation={[0, jam ? 0 : -spot.roadAngle, 0]}>
          <group position={[-HAPPENING_X, 0, 0]}>
            {!raining && (
              <Solid parts>
                <HappeningScene id={happening.id} seed={commune.id} night={night} jam={!jam} />
              </Solid>
            )}
            {labels && !cleared && <HappeningMarker happening={happening} onPick={() => onPick('happening')} />}
          </group>
        </group>
      )}
      {sim.gang === 'member' && home && homeLot && (
        <group position={[homeLot.door[0] - 42, 0, homeLot.door[1] + 7.4]}>
          <Bande seed={commune.id} />
        </group>
      )}

      {nav.nodes.length > 0 && !stopsTraffic && <RoadTraffic nav={nav} focus={focus} seed={commune.id} woro={commune.woro} />}
      {/* The Sim's own vehicle, where it was left parked */}
      {parked && parked.sim === sim.id && parked.commune === commune.id && <ParkedVehicle p={parked} y={nav.heightAt(parked.x, parked.z)} />}
      <Boats water={nearWater} focus={focus} />
      {nav.nodes.length > 0 && <StreetLights nav={nav} night={night} dark={dark} />}
      {/* What the street does, joined with a tap once close (joinIn.tsx) */}
      <JoinIn.Provider value={joinValue}>
        {nav.nodes.length > 0 && <StreetLife nav={nav} seed={commune.id} night={night} taken={taken} />}
        {nav.nodes.length > 0 && night && <NightStreet nav={nav} seed={commune.id} />}
        {nav.nodes.length > 0 && <StreetFootball nav={nav} seed={commune.id} hour={hour} />}
        {nav.nodes.length > 0 && <StreetPeople nav={nav} seed={commune.id} />}
        {nav.nodes.length > 0 && <StreetStalls nav={nav} seed={commune.id} hour={hour} onBuy={onStreetBuy} />}
      </JoinIn.Provider>
      {nav.nodes.length > 0 && <SotraStops nav={nav} seed={commune.id} hour={hour} night={night} />}
      {nav.nodes.length > 0 && <StreetNouchis nav={nav} seed={commune.id} onRobbed={onRobbed} />}
      {nav.nodes.length > 0 && <Billboards nav={nav} seed={commune.id} night={night} places={lots} />}
      <TakeOff runways={runways} />
      <Landing runways={runways} />
      {/* Airliners high over the town, wherever the Sim is */}
      <SkyPlanes focus={focus} />
      <BridgeSights chunks={[...chunks.values()].map((c) => c.data)} night={night} />
      {/* The traffic on the near chunks' deck only: the far horizon's coarser pieces would set it beside the deck. */}
      <BridgeLife chunks={[...chunks.values()].filter((c) => !c.data.key.includes(':')).map((c) => c.data)} night={night} />
      {bridgeLabels.map((b) => (
        <Html key={b.name} position={[b.at[0], 12, b.at[1]]} center zIndexRange={[15, 0]}>
          <div className="flex items-center gap-1.5 rounded-xl border border-black/5 bg-white/95 px-2.5 py-1 text-[12.5px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_4px_12px_-6px_rgba(0,0,0,0.45)]">
            {b.name}
          </div>
        </Html>
      ))}
      {nav.nodes.length > 0 && <Passersby nav={nav} focus={focus} seed={commune.id} onTalk={onTalk} talkingTo={talkingTo} />}
      {players && players.length > 0 && <OtherPlayers players={players} lots={walkLots} labels={labels} onPick={(id) => onPickPlayer?.(id)} />}

      {placing && nav.nodes.length > 0 && (
        <LotGhost
          nav={nav}
          origin={origin}
          w={placing.w}
          d={placing.d}
          resolve={(at) => {
            const clear = Math.max(PLOT_CLEAR, Math.hypot(placing.w, placing.d) / 2 + 3)
            for (const c of chunks.values()) {
              const { key, box } = c.data
              if (key.includes(':') || at[0] < box.x0 || at[0] >= box.x1 || at[1] < box.z0 || at[1] >= box.z1) continue
              return resolvePlaces(c.data, [{ id: 'ghost', kind: 'plot', at, landmark: clear }])[0] ?? null
            }
            return null
          }}
          others={[...resolved.values()].filter((r) => (r.id.startsWith('plot:') || r.id === HOME_ID) && clears.has(r.id) && r.id !== `plot:${placing.moving}`).map((r) => ({ at: r.center, r: clears.get(r.id)! }))}
          seeds={spots.filter((x) => x.kind === 'plot' && x.id !== `plot:${placing.moving}`).map((x) => x.at)}
          named={spots.filter((x) => x.name && x.kind !== 'plot' && x.kind !== 'soiree' && x.id !== HOME_ID).map((x) => ({ name: x.name, at: x.at }))}
          onGhost={(ghost) => useLotPlace.setState({ ghost })}
        />
      )}
      {ready && (
        <Walker
          aerial={!!placing}
          hidden={indoors}
          perspective
          close={!!closeView}
          shoulder={!!shoulderView}
          stage={lifeOf(world, sim).stage?.id ?? 'adulte'}
          nameTag={nameTag}
          labels={labels}
          stationAt={stationAt ?? null}
          sim={sim}
          lots={walkLots}
          nav={walkNav}
          moodColor={moodColor}
          goTo={walkTo}
          onArrive={onArrive}
          busy={busy}
          homeSpot={busy?.id && stationAt === HOME_ID ? homeSpots[busy.id.startsWith('golvo-') ? 'golvo' : busy.id] : joinedSpot}
          onNear={onNear}
          frozen={!!frozen}
          onLeave={onLeave}
          recenter={recenter ?? 0}
          onFreeCamera={onFreeCamera}
          joinRole={joinRole}
        />
      )}
      {/* A trip booked to another commune: the driver comes up the streets, the Sim gets in, off they go */}
      {ready && nav.nodes.length > 0 && sim.activity?.kind === 'travel' && <TripRide sim={sim} nav={nav} world={world} />}
      {/* Just dropped off (a short ride, « trajet-court »): the taxi or the gbaka at the kerb, then off at full speed */}
      {ready && nav.nodes.length > 0 && <TripDrop nav={nav} world={world} />}
      {/* A Garbaya order on its way: the courier rides up to the Sim */}
      <Courier delivery={delivery ?? null} nav={nav} onCollect={onCollect} />
    </>
  )
}

/**
 * A place in a real building: its sign over the door, in the colours of its
 * kind, a little awning, and its name on top. The building itself is the
 * real one, as the map has it.
 */
function PlaceSign({ lot, world, night, label, onPick }: { lot: Lot & { height?: number }; world: World; night: boolean; label: boolean; onPick: (id: string) => void }) {
  const [a, b] = kindColors(lot.kind)
  const kind = world.kinds[lot.kind]
  const tex = useSignTexture(lot.kind === 'home' ? 'CHEZ TOI' : lot.name.toUpperCase(), b)
  const [dx, dz] = [Math.sin(lot.rot), Math.cos(lot.rot)]
  return (
    <group position={[lot.door[0] - dx * 1.15, 0, lot.door[1] - dz * 1.15]} rotation={[0, lot.rot, 0]}>
      <group onClick={(e) => (e.stopPropagation(), onPick(lot.id))}>
        {lot.kind !== 'home' && (
          <>
            <mesh position={[0, 3.35, 0.12]}>
              <boxGeometry args={[4.2, 0.8, 0.16]} />
              <meshLambertMaterial map={tex} emissive={night ? '#ffffff' : '#000000'} emissiveMap={tex} emissiveIntensity={night ? 0.6 : 0} />
            </mesh>
            <mesh position={[0, 2.75, 0.75]} rotation={[0.35, 0, 0]}>
              <boxGeometry args={[3.6, 0.08, 1.4]} />
              <meshLambertMaterial color={a} />
            </mesh>
          </>
        )}
        {/* What tells what the place is, in front of it */}
        <Solid parts>
          <Dressing kind={lot.kind} name={lot.name} faith={lot.faith} seed={lot.seed + lot.x * 0.01} night={night} />
        </Solid>
        {/* The door */}
        <mesh position={[0, 1.05, 0.06]}>
          <boxGeometry args={[1.2, 2.1, 0.08]} />
          <meshLambertMaterial color={lot.kind === 'home' ? '#6b4426' : '#3d4350'} />
        </mesh>
      </group>
      {label && (
        <Html position={[0, (lot.height ?? 6) + 2.2, -2]} center zIndexRange={[20, 0]}>
          <button
            onClick={() => onPick(lot.id)}
            className="flex items-center gap-1.5 rounded-xl border border-black/5 bg-white py-1 pr-2.5 pl-1 text-[12.5px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_4px_12px_-6px_rgba(0,0,0,0.45)] transition duration-200 hover:scale-110 active:scale-95"
          >
            <IconTile icon={iconFor(lot.kind === 'home' ? 'house' : kind?.icon ?? '')} colors={kindColors(lot.kind)} size={24} radius={8} />
            {lot.name}
          </button>
        </Html>
      )}
    </group>
  )
}

/** A campus gate on its street: two pillars, the name across the top. */
function CampusGate({ name, kind, at, rot, width, night }: { name: string; kind: string; at: XZ; rot: number; width: number; night: boolean }) {
  const [, b] = kindColors(kind)
  const tex = useSignTexture(name.toUpperCase(), b)
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, rot, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * width) / 2, 2.4, 0]} castShadow>
          <boxGeometry args={[1.2, 4.8, 1.2]} />
          <meshLambertMaterial color="#f3ead7" />
        </mesh>
      ))}
      <mesh position={[0, 5.1, 0]} castShadow>
        <boxGeometry args={[width + 1.6, 1.3, 0.9]} />
        <meshLambertMaterial color="#f3ead7" />
      </mesh>
      {[0.46, -0.46].map((z) => (
        <mesh key={z} position={[0, 5.1, z]} rotation={[0, z > 0 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[width + 0.8, 0.95]} />
          <meshLambertMaterial map={tex} emissive={night ? '#ffffff' : '#000000'} emissiveMap={tex} emissiveIntensity={night ? 0.5 : 0} />
        </mesh>
      ))}
    </group>
  )
}

/** A place's name floating over it. */
function LotLabel({ lot, world, label, onPick, y, sub }: { lot: Lot; world: World; label: false | 'full' | 'icon' | undefined; onPick: (id: string) => void; y: number; /** A second line under the name (a soirée's entry and guests). */ sub?: string }) {
  const box = useRef<HTMLDivElement>(null)
  // Under the HUD's buttons, the sign fades out (world3d/hudClear.ts): checked on a timer, the view isn't redrawn while nothing moves.
  useEffect(() => {
    const t = setInterval(() => {
      const el = box.current
      if (!el) return
      const hide = underHud(el.getBoundingClientRect())
      el.style.opacity = hide ? '0' : ''
      el.style.pointerEvents = hide ? 'none' : ''
    }, 250)
    return () => clearInterval(t)
  }, [])
  if (!label) return null
  const kind = world.kinds[lot.kind]
  return (
    <Html position={[lot.x, y, lot.z]} center zIndexRange={[20, 0]}>
      <div ref={box} className="transition-opacity duration-200">
      {label === 'icon' ? (
        <button onClick={() => onPick(lot.id)} aria-label={lot.name} title={lot.name} className="block rounded-[10px] border border-white/70 shadow-[0_3px_8px_-4px_rgba(0,0,0,0.5)] transition active:scale-95">
          <IconTile icon={iconFor(kind?.icon ?? '')} colors={kindColors(lot.kind)} size={22} radius={8} />
        </button>
      ) : (
        <button onClick={() => onPick(lot.id)} className="flex items-center gap-1.5 rounded-xl border border-black/5 bg-white py-1 pr-2.5 pl-1 text-[12.5px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_4px_12px_-6px_rgba(0,0,0,0.45)] transition duration-200 hover:scale-110 active:scale-95">
          <IconTile icon={iconFor(kind?.icon ?? '')} colors={kindColors(lot.kind)} size={24} radius={8} />
          {sub ? (
            <span className="text-left leading-tight">
              <span className="block">{lot.name}</span>
              <span className="block text-[10.5px] font-bold text-[#c2187a]">{sub}</span>
            </span>
          ) : (
            lot.name
          )}
        </button>
      )}
      </div>
    </Html>
  )
}

/** Minecraft trees: a trunk of blocks and a cube of leaves, instanced. */
/** Tree trunks are in the way of a Sim walking freely. */
function useSolidTrunks(pts: XZ[], r: number) {
  const key = useId()
  useEffect(() => {
    setObstacles(key, pts.map(([x, z]) => ({ x, z, r })))
    return () => clearObstacles(key)
  }, [key, pts, r])
}

export function Trees({ pts, bark, leaves, shadows = true }: { pts: XZ[]; bark: THREE.Material; leaves: THREE.Material; /** Cast shadows (only where the sun's shadows reach) */ shadows?: boolean }) {
  useSolidTrunks(pts, 0.6)
  const trunks = useRef<THREE.InstancedMesh>(null)
  const tops = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = new THREE.Matrix4()
    pts.forEach(([x, z], i) => {
      const h = 3 + ((i * 7) % 3)
      trunks.current?.setMatrixAt(i, m.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(1, h, 1)))
      tops.current?.setMatrixAt(i, m.compose(new THREE.Vector3(x, h + 1.2, z), new THREE.Quaternion(), new THREE.Vector3(4, 3, 4)))
    })
    if (trunks.current) {
      trunks.current.instanceMatrix.needsUpdate = true
      // Its bounds from where its copies stand (not from before they were placed): else it's culled when zoomed in.
      trunks.current.computeBoundingSphere()
    }
    if (tops.current) {
      tops.current.instanceMatrix.needsUpdate = true
      // Its bounds from where its copies stand (not from before they were placed): else it's culled when zoomed in.
      tops.current.computeBoundingSphere()
    }
  }, [pts])
  if (!pts.length) return null
  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, bark, pts.length]} castShadow={shadows}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={tops} args={[undefined, leaves, pts.length]} castShadow={shadows} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </>
  )
}

const FOREST_GREENS = ['#1f5f2a', '#2a6e2f', '#276b3a', '#33783a', '#1d5426', '#3b7f33'].map((c) => new THREE.Color(c))

/**
 * The forest (the Banco): tall trunks of blocks under a broad canopy, close
 * together, in several greens, a few giants standing out above the rest.
 * Thousands of them: no shadows of their own, the canopy does the shade.
 */
export function Forest({ pts, bark }: { pts: XZ[]; bark: THREE.Material }) {
  useSolidTrunks(pts, 0.7)
  const trunks = useRef<THREE.InstancedMesh>(null)
  const crowns = useRef<THREE.InstancedMesh>(null)
  const leaves = useMemo(() => new THREE.MeshLambertMaterial({ color: '#ffffff' }), [])
  useEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    pts.forEach(([x, z], i) => {
      const r = hash(x, z, 11)
      const giant = r > 0.9
      const h = giant ? 16 + r * 6 : 7 + r * 6
      const w = giant ? 9 : 5 + (i % 3)
      trunks.current?.setMatrixAt(i, m.compose(new THREE.Vector3(x, h / 2, z), q, new THREE.Vector3(giant ? 1.5 : 1, h, giant ? 1.5 : 1)))
      crowns.current?.setMatrixAt(i, m.compose(new THREE.Vector3(x, h + 1.5, z), q, new THREE.Vector3(w, giant ? 4.5 : 3 + (i % 2) * 1.5, w)))
      crowns.current?.setColorAt(i, FOREST_GREENS[Math.floor(hash(z, x, 5) * FOREST_GREENS.length)])
    })
    if (trunks.current) {
      trunks.current.instanceMatrix.needsUpdate = true
      // Its bounds from where its copies stand (not from before they were placed): else it's culled when zoomed in.
      trunks.current.computeBoundingSphere()
    }
    if (crowns.current) {
      crowns.current.instanceMatrix.needsUpdate = true
      if (crowns.current.instanceColor) crowns.current.instanceColor.needsUpdate = true
      crowns.current.computeBoundingSphere()
    }
  }, [pts])
  if (!pts.length) return null
  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, bark, pts.length]}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, leaves, pts.length]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </>
  )
}

/**
 * Coconut palms, Minecraft style: a leaning trunk of blocks, a crown of
 * long drooping leaves and a bunch of coconuts.
 */
export function Palms({ pts, bark, leaves, shadows = true }: { pts: XZ[]; bark: THREE.Material; leaves: THREE.Material; /** Cast shadows (only where the sun's shadows reach) */ shadows?: boolean }) {
  useSolidTrunks(pts, 0.45)
  const trunks = useRef<THREE.InstancedMesh>(null)
  const fronds = useRef<THREE.InstancedMesh>(null)
  const nuts = useRef<THREE.InstancedMesh>(null)
  const FRONDS = 6
  useEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    pts.forEach(([x, z], i) => {
      const h = 7 + ((i * 5) % 4)
      const lean = 0.12 + ((i * 3) % 5) * 0.05
      const dir = (i * 2.399) % (Math.PI * 2)
      // The trunk leans away from the wind; the crown sits on its top.
      q.setFromEuler(e.set(Math.cos(dir) * lean, 0, Math.sin(dir) * lean))
      const top = new THREE.Vector3(0, h, 0).applyQuaternion(q).add(new THREE.Vector3(x, 0, z))
      trunks.current?.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0, z).lerp(top, 0.5), q, new THREE.Vector3(0.55, h, 0.55)))
      for (let k = 0; k < FRONDS; k++) {
        const a = dir + (k / FRONDS) * Math.PI * 2
        const fq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, -0.45, 'YXZ'))
        const at = new THREE.Vector3(1.6, -0.55, 0).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0))).add(top)
        fronds.current?.setMatrixAt(i * FRONDS + k, m.compose(at, fq, new THREE.Vector3(3.6, 0.15, 0.9)))
      }
      nuts.current?.setMatrixAt(i, m.compose(top.clone().add(new THREE.Vector3(0, -0.5, 0)), q, new THREE.Vector3(0.9, 0.6, 0.9)))
    })
    for (const r of [trunks, fronds, nuts]) if (r.current) {
      r.current.instanceMatrix.needsUpdate = true
      // Its bounds from where its copies stand (not from before they were placed): else it's culled when zoomed in.
      r.current.computeBoundingSphere()
    }
  }, [pts])
  const nut = useMemo(() => new THREE.MeshLambertMaterial({ color: '#6b4a1e' }), [])
  if (!pts.length) return null
  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, bark, pts.length]} castShadow={shadows}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={fronds} args={[undefined, leaves, pts.length * FRONDS]} castShadow={shadows}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={nuts} args={[undefined, nut, pts.length]}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </>
  )
}

const CAR_CELL = 300
/** Up to this many places from the map in a commune, they all come at once (Yopougon has thousands: those round the Sim). */
const ALL_MAP_PLACES = 400
// Busy streets, like Abidjan's; fewer on a small phone (each one drives and draws).
const CARS_PER_CELL = RICH ? 5 : 3
const CAR_ROUND = 90 // seconds

/** Woro-woro, taxis, gbakas, motos and SITRA buses on the big streets around the Sim: the same ones on every screen. */
export function RoadTraffic({ nav, focus, seed, woro, perCell = CARS_PER_CELL }: { nav: Nav; focus: React.RefObject<XZ>; seed: string; woro?: { color?: string; trim?: string; none?: boolean }; /** cars in each cell (the lab puts more, to test the crossroads) */ perCell?: number }) {
  const cells = useCellsAround(focus, CAR_CELL)
  const routes = useRoutes(nav)
  const cars = useMemo(
    () =>
      cells.flatMap((cell) =>
        [...Array(perCell)].map((_, k) => {
          const r = rng(`otraffic${seed}|${cell.key}|${k}`)
          // Abidjan's streets are its taxis, woro-woros, gbakas and buses first (seven in ten); the people's
          // own cars after (saloons, berlines, SUVs, 4x4s, a limousine now and then: vehicles.tsx carModel).
          const kinds: VehicleKind[] = ['taxi', 'taxi', 'woro', 'woro', 'woro', 'gbaka', 'gbaka', 'sotra', 'sotra', 'car', 'car', 'car', 'moto']
          const drawn = kinds[Math.floor(r() * kinds.length)]
          const kind: VehicleKind = drawn === 'woro' && woro?.none ? 'taxi' : drawn
          return {
            id: `${seed}|${cell.key}|car${k}`,
            kind,
            color: kind === 'woro' ? woro?.color : kind === 'car' ? CAR_COLORS[Math.floor(r() * CAR_COLORS.length)] : undefined,
            trim: kind === 'woro' ? woro?.trim : undefined,
            seed: r() * 100,
            near: [cell.x0 + r() * CAR_CELL, cell.z0 + r() * CAR_CELL] as XZ,
            speed: kind === 'gbaka' ? 8 : kind === 'sotra' ? 7.5 : kind === 'moto' ? 11 : 9.5,
            offset: r() * CAR_ROUND,
          }
        }),
      ),
    [cells, seed, woro, perCell],
  )
  // Cars starting from the same street node would park at the same spot at the end of their round, one in the
  // other: each takes its place in line there (Car's `slot`).
  const slots = useMemo(() => {
    const seen = new Map<number, number>()
    return new Map(
      cars.map((c) => {
        const a = anchorNode(nav, c.near, c.kind === 'sotra' ? 9 : 7) ?? -1
        const k = seen.get(a) ?? 0
        seen.set(a, k + 1)
        return [c.id, k] as const
      }),
    )
  }, [cars, nav])
  // The lights at the big crossroads round the Sim, which the cars stop at.
  const lights = useMemo(() => lightsOf(nav, cells, CAR_CELL), [nav, cells])
  // The other crossroads, where they give way (trafficFlow.tsx giveWay).
  // (The lit ones too: there the lights say who goes, and nobody goes in across a car still crossing.)
  const junctions = useMemo(() => [...junctionsOf(nav, cells, CAR_CELL, lights), ...litJunctions(lights)], [nav, cells, lights])
  // (In development, for tests in the browser: the crossroads with and without lights.)
  if (import.meta.env.DEV) Object.assign(globalThis, { __junctions: junctions, __lights: lights })
  return (
    <>
      {cars.map((c) => (
        <Car key={c.id} car={c} slot={slots.get(c.id) ?? 0} nav={nav} routes={routes} lights={lights} junctions={junctions} />
      ))}
      <TrafficLights lights={lights} />
    </>
  )
}

/** Landmarks that are one solid building: how far round their middle they stand (metres). */
/** Landmarks one walks into, and what stands in the way there (in their own frame). */
const GROUNDS: Record<string, Obstacle[]> = { 'cocody-zoo': ZOO_SOLID, 'cocody-hotel-ivoire': IVOIRE_SOLID, 'plateau-poulman': POULMAN_SOLID, 'plateau-noum': NOUM_SOLID, 'marcory-azale': AZALE_SOLID, 'pb-rabisson': RABISSON_SOLID, 'plateau-cathedrale': CATHEDRAL_SOLID, 'plateau-stade': STADIUM_SOLID, 'plateau-tribunal': PALAIS_SOLID, 'plateau-presidence': PRESIDENCE_SOLID, 'treich-palais-culture': PALAIS_CULTURE_SOLID, 'plateau-musee': MUSEE_SOLID, 'koumassi-tour-ivoire': TOUR_IVOIRE_SOLID, 'plateau-assemblee': ASSEMBLEE_SOLID, 'treich-marche': GRAND_MARCHE_SOLID, 'treich-mosquee-m6': MOSQUE_M6_SOLID, 'yop-rue-princesse': RUE_SOLID, 'cocody-playce': PLAYCE_SOLID, 'marcory-playce': PLAYCE_MARCORY_SOLID, 'marcory-capsud': CAPSUD_SOLID }
const SOLID_LANDMARKS: Record<string, number> = { 'treich-palais': 34, 'plateau-pyramide': 28, 'cocody-oranjo': 34, 'yakro-basilique': 55, 'portbouet-parc-expo': 59, 'plateau-tour-f': 19 }

/** A vehicle's length and width, for what it blocks. */
const CAR_SIZE: Record<VehicleKind, [number, number]> = { taxi: [4.4, 1.7], woro: [4.4, 1.7], car: [4.5, 1.8], gbaka: [5.3, 1.9], moto: [1.9, 0.6], sotra: [11, 2.5] }

function Car({ car, slot, nav, routes, lights, junctions }: { car: { id: string; kind: VehicleKind; color?: string; trim?: string; seed: number; near: XZ; speed: number; offset: number }; /** its place in line where it parks (0: first) */ slot: number; nav: Nav; routes: Map<string, XZ[]>; lights: Light[]; junctions: Junction[] }) {
  const ref = useRef<THREE.Group>(null)
  // The SITRA keeps to the bigger roads (not only the 12 m ones: most quarters have none, and the
  // bus, finding no road, never showed).
  const wide = car.kind === 'sotra' ? 9 : 7
  const anchor = useMemo(() => anchorNode(nav, car.near, wide), [nav, car.near, wide])
  const gbaka = car.kind === 'gbaka'
  // The gbaka and the bus stop and go (at the stops); the others drive on.
  const stops = gbaka || car.kind === 'sotra'
  // The gbaka's leg, for its apprenti: seconds since it left (or since it stopped).
  const leg = useRef<GbakaLeg>({ moving: false, since: 99, go: 0 })
  // How far behind its schedule it is (seconds): the time spent waiting behind another car, or at a red light.
  const late = useRef(0)
  // How long it has been held up: past a while, it squeezes by (no two cars stuck nose to nose for ever).
  const held = useRef(0)
  // How fast it goes, from 0 to its own speed (1): it speeds up and brakes, never jumps from one to the other.
  const v = useRef(1)
  // The road it's on (how wide), looked at now and then: slower in the small streets.
  const road = useRef({ width: 10, t: -1 })
  // How far right of the route's line it is (left: negative): in its lane (2 m) one way, in the other lane
  // coming back, pulled over to the kerb when parked; eased, so the U-turn at the end crosses the road.
  const side = useRef<number | null>(null)
  useFrame((_, dtRaw) => {
    const g = ref.current
    if (!g) return
    const dt = Math.min(dtRaw, 0.1)
    // (The time since the last frame as it is, up to half a second: on a slow phone, a frame is long, and the car
    // must not go on through what it had stopped for.)
    const dtv = Math.min(dtRaw, 0.5)
    // Behind its schedule by what it didn't drive since the last frame, at the speed it had.
    late.current += dtv * (1 - v.current)
    const [l, w] = CAR_SIZE[car.kind]
    const reach = CAR_ROUND * 0.42 * car.speed
    const path = (n: number) => routeFor(routes, nav, `${car.id}|${n}`, anchor, 14, wide, reach)
    // Its place in line where it parks, at both ends of the round (none on a route too short for it).
    const gapOf = (len: number) => (len > slot * 14 + 30 ? slot * 7 : 0)
    const now = worldTime() - late.current
    const at = round(now, CAR_ROUND, car.offset, (n) => routeLength(path(n)) - 2 * gapOf(routeLength(path(n))), car.speed)
    const way = path(at.n)
    g.visible = way.length > 1
    if (!g.visible) return report(car.id, null)
    const len = routeLength(way)
    const gap = gapOf(len)
    // A gbaka pulls away and pulls in (an apprenti has to be able to run
    // after it): the same leg in the same time, eased at both ends.
    const d = gap + (stops ? eased(at, len - 2 * gap, car.speed, CAR_ROUND, car.offset, leg.current, now) : at.d)
    // Its way through a bend: the line through the points a few metres before and after (a corner is rounded,
    // the car doesn't swing its lane across it at the corner's point).
    const p0 = along(way, d)
    const [pa, pb] = [along(way, Math.max(0, d - 3)), along(way, Math.min(len, d + 3))]
    const p = { x: p0.x, z: p0.z, r: Math.hypot(pb.x - pa.x, pb.z - pa.z) > 0.5 ? Math.atan2(pb.x - pa.x, pb.z - pa.z) : p0.r }
    const heading = at.forward ? p.r : p.r + Math.PI
    // Drive on the right: shift to the right of the way it goes. At the end of its way it pulls over to the
    // kerb and goes into a yard (out of sight: two rounds ending at the same spot never park one in the
    // other, and nobody drives into a parked car); it comes out on the other side of the road, the way it
    // goes back, once nothing is on that spot.
    const lane = (at.forward ? 1 : -1) * (at.moving ? 2 : 3.9)
    if (side.current === null) side.current = lane
    const spot = (o: number): XZ => [p.x - Math.cos(p.r) * o, p.z + Math.sin(p.r) * o]
    let yard = false
    if (!at.moving) {
      side.current += (lane - side.current) * (1 - Math.exp(-3 * dt))
      yard = Math.abs(side.current - lane) < 0.3
    } else if (Math.sign(side.current) !== Math.sign(lane)) {
      if (spotTaken(car.id, ...spot(lane))) yard = true
      else side.current = lane
    } else side.current += (lane - side.current) * (1 - Math.exp(-2.5 * dt))
    if (yard) {
      // (Waiting to come out: its round held meanwhile.)
      if (at.moving) v.current = 0
      g.visible = false
      moveObstacle(car.id, null)
      return report(car.id, null)
    }
    const [x, z] = spot(side.current)
    const t = worldTime()
    if (t - road.current.t > 0.5) {
      const n = nav.nearest([p.x, p.z], 20)
      road.current = { width: n ? nav.edges[n.edge].width : 10, t }
    }
    // The code de la route. Waved over at a police checkpoint, it stops for its papers (the bus and the gbaka
    // with their passengers aren't); a red light just ahead; the car ahead too close (looked at a little
    // further, to brake in time); someone crossing in front of it (the Sim); a crossroads it gives way at.
    const papers = at.moving && !stops && stopForPapers(car.id, x, z, heading, l / 2, t)
    const red = at.moving && !papers && redAhead(lights, x, z, heading, l / 2, t)
    // (Looked at further on a slow phone: the car covers more before the next frame.)
    const ahead = at.moving && !papers && !red ? blockedAhead(car.id, x, z, heading, l / 2, 3 + car.speed * v.current * dtv) : null
    if (at.moving) holdJunctions(car.id, junctions, x, z, heading, l / 2, t)
    const [fx, fz] = [Math.sin(heading), Math.cos(heading)]
    const [sx, sz] = [whereabouts.sim[0] - x, whereabouts.sim[1] - z]
    const walker = at.moving && sx * fx + sz * fz > 0 && sx * fx + sz * fz < l / 2 + 7 && Math.abs(sx * fz - sz * fx) < w / 2 + 1
    const yieldTo = at.moving && !papers && !red && !ahead && !walker ? giveWay(car.id, junctions, x, z, heading, l / 2, road.current.width, v.current, t, held.current) : null
    // Behind a queue at a light, a checkpoint or a crossroads, it waits its turn; nose to nose with a car waiting
    // for it, one gets by after a moment; given way for a long while at a crossroads, it goes (giveWay's patience).
    const queue = ahead && queueOf(car.id, ahead)
    const waitFor = papers ? 'papers' : red ? 'red' : walker ? 'pieton' : (ahead ?? yieldTo)
    const stuck = (ahead && queue !== 'light') || yieldTo === 'prio'
    const blocked = papers || red || walker || (ahead && (queue === 'light' || held.current < (queue === 'jam' ? 3 : 8))) || !!yieldTo
    if (blocked) {
      if (stuck) held.current += dt
      waiting(car.id, waitFor ?? '')
    } else held.current = at.moving ? Math.max(0, held.current - dt * 4) : 0
    // How fast it wants to go: stopped, or slower in the small streets and in the bends.
    let want = 1
    if (blocked) want = 0
    else if (at.moving) {
      const next = along(way, at.forward ? d + 9 : d - 9)
      const bend = Math.abs(Math.atan2(Math.sin(next.r - p.r), Math.cos(next.r - p.r)))
      want = Math.min(road.current.width < 6.5 ? 0.6 : road.current.width < 8.5 ? 0.8 : 1, bend > 0.6 ? 0.45 : bend > 0.3 ? 0.7 : 1)
    }
    // Braking is quicker than speeding up.
    v.current += Math.max(-2.2 * dtv, Math.min(0.55 * dt, want - v.current))
    if (v.current < 0.02 && want === 0) v.current = 0
    g.position.set(x, nav.heightAt(x, z), z)
    // A U-turn at each end, eased so it isn't a snap.
    g.rotation.y = turnTo(g.rotation.y, heading - Math.PI / 2, 1 - Math.exp(-6 * dt))
    report(car.id, { x, z, h: heading, half: l / 2, wait: !at.moving ? 'parked' : blocked ? (waitFor ?? undefined) : undefined })
    // Nobody walks through it.
    moveObstacle(car.id, { x: g.position.x, z: g.position.z, hw: l / 2, hd: w / 2, rot: g.rotation.y })
  })
  useEffect(
    () => () => {
      moveObstacle(car.id, null)
      report(car.id, null)
    },
    [car.id],
  )
  return (
    <group ref={ref}>
      <Vehicle p={[0, 0, 0]} kind={car.kind} color={car.color} trim={car.trim} seed={car.seed} crew={!gbaka} />
      {gbaka && <Apprenti leg={leg} seed={car.seed} />}
    </group>
  )
}

/** Where a gbaka is in its leg: moving or stopped, for how long, and how long the leg takes. */
export type GbakaLeg = { moving: boolean; since: number; go: number; d?: (s: number) => number }

/** Distance after s seconds of a leg of L metres in go seconds: speeding up, cruising, slowing down. */
export function legProfile(go: number, L: number) {
  const ta = Math.min(GBAKA_EASE, go / 3)
  const v = L / (go - ta)
  return (s: number) => (s <= ta ? (v * s * s) / (2 * ta) : s >= go - ta ? L - (v * (go - s) ** 2) / (2 * ta) : v * (s - ta / 2))
}

/** Seconds to get up to speed, and to slow down. */
const GBAKA_EASE = 5

/**
 * The gbaka's distance along its leg: the same leg as round()'s, in the
 * same time, but pulling away slowly and pulling in slowly (a trapezoid of
 * speed), so the apprenti left on the sidewalk can catch it. Fills `leg`.
 */
function eased(at: Round, len: number, speed: number, cycle: number, offset: number, leg: GbakaLeg, now = worldTime()) {
  const u = now + offset
  const k = u - Math.floor(u / cycle) * cycle
  const go = Math.min(len / speed, cycle * 0.42)
  const wait = (cycle - 2 * go) / 2
  const L = go * speed
  const dist = legProfile(go, L)
  leg.go = go
  leg.d = dist
  if (at.moving) {
    const s = at.forward ? k : k - go - wait
    leg.moving = true
    leg.since = s
    const d = dist(Math.max(0, Math.min(go, s)))
    return at.forward ? d : L - d
  }
  leg.moving = false
  leg.since = at.forward ? k - go : k - 2 * go - wait
  return at.d
}

/**
 * The gbaka's apprenti. At the stop he's down on the sidewalk, calling the
 * destination. The gbaka pulls away without him; he sees it a beat late,
 * sprints after it, catches up with the door and leaps for it, and rides
 * hanging out of it, a hand on the frame, a foot on the step, waving at
 * people. Coming into the next stop he hops off before it has stopped.
 * All from the gbaka's own clock: the same chase on every screen.
 */
export function Apprenti({ leg, seed }: { leg: React.RefObject<GbakaLeg>; seed: number }) {
  const g = useRef<THREE.Group>(null)
  const [pose, setPose] = useState<Pose>('hang')
  const [runSpeed, setRunSpeed] = useState(6)
  const [dx, dy, dz] = GBAKA_DOOR
  const SIDE = dz + 1.1 // standing on the sidewalk, by the gbaka
  const BACK = -2.0 // at the back of it, taking the fares, calling
  const REACT = 1.0 + (seed % 1) * 0.4 // he notices it's leaving
  const CATCH = 3.2 // he has the door frame
  const LEAP = 0.55 // the jump, before he has it
  const OFF = 0.6 // hopping off, before the stop
  useFrame(() => {
    const o = g.current
    const l = leg.current
    if (!o || !l?.d) return
    const set = (x: number, y: number, z: number, ry: number, p: Pose) => {
      o.position.set(x, y, z)
      o.rotation.y = ry
      if (p !== pose) setPose(p)
    }
    const short = l.go < CATCH + 3 // too short a hop to get off
    if (short) return set(dx, dy, dz, Math.PI / 2, 'hang')
    if (!l.moving) {
      // Stopped: on the sidewalk by the door, turned to the people, calling.
      return set(BACK, 0, SIDE, 0, 'wave')
    }
    const s = l.since
    if (s >= l.go - OFF) {
      // Hopping off as it slows: from the step down onto the sidewalk.
      const j = Math.min(1, (s - (l.go - OFF)) / OFF)
      return set(dx + (BACK - dx) * j, dy * (1 - j) + Math.sin(Math.PI * j) * 0.35, dz + (SIDE - dz) * j, Math.PI / 2 - (Math.PI / 2) * j, j < 1 ? 'leap' : 'wave')
    }
    if (s < REACT) {
      // Still calling: the gbaka is already going (he stays where he is, it moves on).
      return set(BACK - l.d(s), 0, SIDE, 0, 'wave')
    }
    if (s < CATCH) {
      // Running after it: from where he stood to the door, while it pulls away.
      const k = (s - REACT) / (CATCH - REACT)
      const start = BACK - l.d(REACT)
      const speed = (dx - start + 0.1) / (CATCH - REACT) // how fast he gains on it
      if (Math.abs(speed + (l.d(CATCH) - l.d(REACT)) / (CATCH - REACT) - runSpeed) > 0.5) setRunSpeed(speed + (l.d(CATCH) - l.d(REACT)) / (CATCH - REACT))
      const x = start + (dx - start) * k
      const z = SIDE + (dz - SIDE) * Math.max(0, (k - 0.5) / 0.5)
      const jump = s > CATCH - LEAP ? (s - (CATCH - LEAP)) / LEAP : -1
      if (jump >= 0) return set(x, dy * jump + Math.sin(Math.PI * jump) * 0.45, z, Math.PI / 2, 'leap')
      return set(x, 0, z, Math.PI / 2, 'run')
    }
    // On board: hanging out of the door.
    set(dx, dy, dz, Math.PI / 2, 'hang')
  })
  return (
    <NoShadows>
      <group ref={g}>
        <Human look={APPRENTI} gender="homme" pose={pose} seed={seed} speed={pose === 'run' ? runSpeed : undefined} />
      </group>
    </NoShadows>
  )
}

export type { Npc } from '../talk'

const WALK_CELL = 150
const WALKERS_PER_CELL = 2
const WALK_ROUND = 140 // seconds

type Walk = { id: string; name: string; gender: 'femme' | 'homme'; look: ReturnType<typeof randomLook>; seed: number; side: number; near: XZ; speed: number; offset: number }

/**
 * People walking the streets around the Sim, the same people at the same
 * spot on every screen (see shared.ts). Each has a first name; tap one to
 * talk (they stop and turn to you). Now and then, one nearby calls out.
 */
function Passersby({ nav, focus, seed, onTalk, talkingTo }: { nav: Nav; focus: React.RefObject<XZ>; seed: string; onTalk?: (npc: Npc) => void; talkingTo?: string | null }) {
  const cells = useCellsAround(focus, WALK_CELL)
  const routes = useRoutes(nav)
  const people = useMemo<Walk[]>(
    () =>
      cells.flatMap((cell) =>
        [...Array(WALKERS_PER_CELL)].map((_, k) => {
          const r = rng(`opeople${seed}|${cell.key}|${k}`)
          const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
          const names = NPC_NAMES[gender]
          return {
            id: `${seed}-${cell.key}-${k}`,
            name: names[Math.floor(r() * names.length)],
            gender,
            look: randomLook(gender, r),
            seed: r() * 100,
            side: r() < 0.5 ? -1 : 1,
            near: [cell.x0 + r() * WALK_CELL, cell.z0 + r() * WALK_CELL] as XZ,
            speed: 1.1 + r() * 0.5,
            offset: r() * WALK_ROUND,
          }
        }),
      ),
    [cells, seed],
  )
  const refs = useRef(new Map<string, THREE.Group>())
  // (In development, for tests in the browser: where the passers-by are.)
  if (import.meta.env.DEV) Object.assign(globalThis, { __walkers: refs.current })
  // A line over someone's head (tapped from too far: « come closer »).
  const [said, setSaid] = useState<{ id: string; text: string } | null>(null)
  const reaction = useNpcReaction()
  useEffect(() => {
    if (!said) return
    const t = setTimeout(() => setSaid(null), 5000)
    return () => clearTimeout(t)
  }, [said])
  const talk = (p: Walk) => {
    const g = refs.current.get(p.id)
    if (!g || !onTalk) return
    if (Math.hypot(g.position.x - whereabouts.sim[0], g.position.z - whereabouts.sim[1]) > 40) return setSaid({ id: p.id, text: 'Approche, on va causer !' })
    onTalk({ id: p.id, name: p.name, gender: p.gender, seed: Math.floor(p.seed * 1000), look: p.look, doing: 'en train de marcher' })
  }
  return (
    <NoShadows>
      {people.map((p) => (
        <Passerby
          key={p.id}
          p={p}
          nav={nav}
          routes={routes}
          held={p.id === talkingTo || said?.id === p.id}
          talking={p.id === talkingTo}
          react={reaction?.id === p.id ? reaction.pose : undefined}
          refs={refs.current}
          onClick={() => talk(p)}
          bubble={
            said?.id === p.id && (
              <Html position={[0, 2.35, 0]} center zIndexRange={[25, 0]}>
                <button onClick={() => talk(p)} className="rounded-2xl rounded-bl-sm border border-black/5 bg-white px-3 py-1.5 text-[13px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_6px_14px_-8px_rgba(0,0,0,0.5)]">
                  <span className="text-[var(--color-orange)]">{p.name}</span> · {said.text}
                </button>
              </Html>
            )
          }
        />
      ))}
    </NoShadows>
  )
}

function Passerby({ p, nav, routes, held, talking, react, refs, onClick, bubble }: { p: Walk; nav: Nav; routes: Map<string, XZ[]>; held: boolean; /** in a conversation with the Sim: comes up to it, face to face */ talking: boolean; react?: Pose; refs: Map<string, THREE.Group>; onClick: () => void; bubble: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const anchor = useMemo(() => anchorNode(nav, p.near, FOOT), [nav, p.near])
  const [moving, setMoving] = useState(true)
  // The rain: off for cover, back when it stops (rainRun.tsx).
  const cover = useMemo(() => new Shelterer((p.seed % 7) - 3.5), [p.seed])
  const [rainPose, setRainPose] = useState<Pose | null>(null)
  useEffect(() => {
    const g = ref.current
    if (!g) return
    refs.set(p.id, g)
    return () => void refs.delete(p.id)
  }, [refs, p.id])
  // Back from a conversation: on along its way from where it had stopped (its clock held back by the time
  // stopped, `lag`), walking from where it stood to it at its own pace; no jump to where it would be by now.
  const back = useRef<{ x: number; z: number; t: number; dur: number } | null>(null)
  const lag = useRef(0)
  const since = useRef<number | null>(null)
  const [stepping, setStepping] = useState(false)
  useEffect(() => {
    if (!talking) return
    return () => {
      const g = ref.current
      if (g) back.current = { x: g.position.x, z: g.position.z, t: 0, dur: 0 }
      whereabouts.faceTo = null
    }
  }, [talking])
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    if (held) {
      since.current ??= worldTime()
      // The one you talk to (or who calls out to you) stops and turns to you;
      // in a conversation, comes up to you (a step apart, face to face).
      const [sx, sz] = whereabouts.sim
      const [dx, dz] = [sx - g.position.x, sz - g.position.z]
      const d = Math.hypot(dx, dz)
      const walk = talking && d > 1.15
      if (walk) {
        const step = Math.min(d - 1.1, 1.5 * Math.min(dt, 0.1))
        g.position.x += (dx / d) * step
        g.position.z += (dz / d) * step
        g.position.y = nav.heightAt(g.position.x, g.position.z)
      }
      if (walk !== stepping) setStepping(walk)
      g.rotation.y = turnTo(g.rotation.y, Math.atan2(dx, dz), walk ? 0.3 : 0.2)
      if (talking) whereabouts.faceTo = [g.position.x, g.position.z]
      return
    }
    if (since.current !== null) {
      lag.current += worldTime() - since.current
      since.current = null
    }
    const reach = WALK_ROUND * 0.42 * p.speed
    // On the pavement, always the same side of the street, across the streets on their zebra (pavementLine).
    const path = (n: number) => pavementLine(nav, routeFor(routes, nav, `${p.id}|${n}`, anchor, 6, FOOT, reach), p.side)
    const at = round(worldTime() - lag.current, WALK_ROUND, p.offset, (n) => routeLength(path(n)), p.speed)
    const way = path(at.n)
    g.visible = way.length > 1
    if (!g.visible) return
    const pt = along(way, at.d)
    g.position.set(pt.x, nav.heightAt(pt.x, pt.z), pt.z)
    const b = back.current
    if (b) {
      // As long as the way back takes at a walk.
      b.dur ||= Math.max(0.4, Math.hypot(pt.x - b.x, pt.z - b.z) / p.speed)
      b.t = Math.min(1, b.t + dt / b.dur)
      const [fx, fz] = [b.x + (pt.x - b.x) * b.t, b.z + (pt.z - b.z) * b.t]
      g.rotation.y = turnTo(g.rotation.y, Math.atan2(pt.x - b.x, pt.z - b.z), 0.25)
      g.position.x = fx
      g.position.z = fz
      g.position.y = nav.heightAt(fx, fz)
      if (!stepping) setStepping(true)
      if (b.t >= 1) {
        back.current = null
        setStepping(false)
      }
      return
    }
    g.rotation.y = turnTo(g.rotation.y, at.forward ? pt.r : pt.r + Math.PI, 0.25)
    if (at.moving !== moving) setMoving(at.moving)
    const c = cover.step(nav, [g.position.x, g.position.z], dt)
    if (c) {
      g.position.set(c.x, nav.heightAt(c.x, c.z), c.z)
      g.rotation.y = turnTo(g.rotation.y, c.r, 0.3)
    }
    if ((c?.pose ?? null) !== rainPose) setRainPose(c?.pose ?? null)
  })
  return (
    <group ref={ref} onClick={(e) => (e.stopPropagation(), onClick())}>
      <Human look={p.look} gender={p.gender} pose={stepping ? 'walk' : held ? (react ?? 'talk') : (rainPose ?? (moving ? 'walk' : 'idle'))} seed={p.seed} speed={rainPose === 'run' ? 1.6 : p.speed} />
      {bubble}
    </group>
  )
}

/**
 * The camera's near plane follows its height: a few tenths of a metre in the
 * shoulder view, a few metres when looking down on the city. The depth test's
 * precision depends on it, and from high up the ground, the grass, the roads
 * and their paint (a few centimetres apart) would otherwise flicker through
 * one another.
 */
function NearPlane() {
  useFrame(({ camera }) => {
    const c = camera as THREE.PerspectiveCamera
    const near = Math.min(4, Math.max(0.25, camera.position.y * 0.03))
    if (Math.abs(near - c.near) / c.near > 0.12) {
      c.near = near
      c.updateProjectionMatrix()
    }
  })
  return null
}
