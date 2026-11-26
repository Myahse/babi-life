import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Look } from '../lib/types'
import { BlockHuman } from '../avatar/BlockHuman'
import { Baby, FullDetail, Human, NoShadows, type Pose } from '../avatar/Human'
import { BABY_OUTFITS, DEFAULT_LOOK, KID_OUTFITS, OUTFITS, OUTFIT_DEFAULT_COLOR, REAL_HAIRS, SKIN_TONES, TEEN_OUTFITS, WORLD_HAIRS, peopleLook, randomLook } from '../avatar/options'
import { lookAt as countryLookAt, setCountryLook } from '../world3d/countryStyle'
import { GROUP_NAMES, PEOPLES, setPeoplePlace } from '../world3d/peoples'
import { nameFor } from '../world3d/talk'
import { DetailHuman, detailCost } from '../avatar/DetailHuman'
import { atlasBytes, builtCount, builtMs } from '../avatar/detail/build'
import { realNow } from '../avatar/persos'
import { PlainLight, Stage, StudioLight } from '../avatar/Stage'
import { usePersos } from '../avatar/persos'

import { Portrait } from '../avatar/portrait'
import { FamilyScene } from '../avatar/Family'
import { sizeOf } from '../world3d/Character'
import { FaceMood, type Expression } from '../avatar/expressions'
import { freezeWorldTime } from '../lib/worldClock'

// Dev-only lab (/avatar.html) of « Des persos plus détaillés » (the update
// « sims-detailles », avatar/DetailHuman.tsx). ?open=sims-detailles or
// ?shut=sims-detailles sets the update in the views that go through the game's
// switch (avatar/Human.tsx); in this lab it is shut by default, like a server
// that hasn't answered.
//   (default) today's Sim (left of each pair) next to the detailed one (on the golden tile);
//             ?pose=idle|walk|wave|mix, ?view=front|three|face|game (&zoom=), ?only=0,2, ?spin, ?set=2
//   ?view=grid&age=adulte|enfant|ado|bebe&g=femme|homme   every outfit of that age (&acc=a;b,c &hair=a,b &from=&to= &cols= &zoom=)
//   ?view=crowd&n=60   a street's crowd walking about, its draw calls, triangles and frame rate
//   ?view=stage&i=     the creator's stage (&skin=hex without #, &hair=, &outfit=, &g=, &age=, &pose=, &acc=, &focus=face); ?view=portrait the still pictures (&one&i=&framing= one, in a 320 px window);
//   ?view=family&f=poignon the birth
//   ?view=faces expressions close up (&ex=, &skin=, &g=, &age=, &turn=)
//   ?view=skins (&focus=body) every skin tone under the creator's lights; ?view=hairs the hairdos of « persos-realistes » (&g=, &skin=, &turn=)

const q = new URLSearchParams(location.search)
const view = q.get('view') ?? 'front'
// &t= holds the animations' clock (still pictures, measures); window.labT(t) moves it.
if (q.get('t') !== null) freezeWorldTime(Number(q.get('t')))
;(window as unknown as { labT: (t: number) => void }).labT = (t: number) => freezeWorldTime(t)
const poseQ = q.get('pose') ?? 'mix'
const spin = q.has('spin')

type Sample = { name: string; look: Partial<Look>; gender: 'femme' | 'homme'; child?: boolean; pose: Pose }
const S = (name: string, look: Partial<Look>, gender: 'femme' | 'homme', pose: Pose, child = false): Sample => ({ name, look, gender, pose, child })

const SETS: Sample[][] = [
  [
    S('Awa — pagne wax, foulard', { outfit: 'pagne', hair: 'headwrap', accessory: 'earrings', pattern: 'cercles', outfitColor: '#ff7a00', skin: '#6e4024' }, 'femme', 'wave'),
    S('Koffi — costume', { outfit: 'suit', hair: 'degrade', accessory: 'none', beard: 'bouc', outfitColor: '#1f2a44', skin: '#583119', body: 'fort' }, 'homme', 'idle'),
    S('Yao — chemise pagne, dreads', { outfit: 'chemise-pagne', hair: 'locks', accessory: 'none', beard: 'moustache', pattern: 'losanges', outfitColor: '#00a862', skin: '#8a5532' }, 'homme', 'walk'),
    S('Aya — jean, afro', { outfit: 'casual', hair: 'afro', accessory: 'glasses,chain', outfitColor: '#d6336c', skin: '#a46c42', hairColor: '#2e1b12' }, 'femme', 'idle'),
    S('Fatou (enfant) — robe, nattes perlées', { outfit: 'robe-volants', hair: 'nattes-perles', accessory: 'none', outfitColor: '#f783ac', skin: '#4a2814' }, 'femme', 'wave', true),
    S('Vieux Bamba — grand boubou', { outfit: 'boubou', hair: 'short', accessory: 'none', beard: 'full', outfitColor: '#2a6cf0', skin: '#3f2210', hairColor: '#d8d2c8' }, 'homme', 'idle'),
  ],
  [
    S('Mariam — tresses, jean', { outfit: 'casual', hair: 'braids', accessory: 'earrings', outfitColor: '#00a862', skin: '#583119' }, 'femme', 'walk'),
    S('Adjoua — tissage, kaba', { outfit: 'kaba', hair: 'weave', accessory: 'bag', pattern: 'feuilles', outfitColor: '#7b5cff', skin: '#8a5532' }, 'femme', 'idle'),
    S('Ibrahim — imam, barbe longue', { outfit: 'imam', hair: 'bald', beard: 'longue', accessory: 'chapelet', outfitColor: '#f8f9fa', skin: '#4a2814' }, 'homme', 'idle'),
    S('Kader — survêt, casquette', { outfit: 'survet', hair: 'short', accessory: 'cap,watch', outfitColor: '#2a6cf0', skin: '#c28a5c' }, 'homme', 'wave'),
    S('Agent — policier', { outfit: 'policier', hair: 'short', accessory: 'sunglasses', outfitColor: '#8ec5ee', skin: '#6e4024' }, 'homme', 'idle'),
    S('Sœur Marie', { outfit: 'soeur', hair: 'bun', accessory: 'croix', outfitColor: '#5b6470', skin: '#a46c42' }, 'femme', 'idle'),
  ],
]
const set = SETS[Number(q.get('set') ?? 1) - 1] ?? SETS[0]
const only = q.get('only')?.split(',').map(Number)
const samples = only ? only.map((i) => set[i]).filter(Boolean) : set

const PAIR = 1.3 // metres between pairs
const IN = 0.62 // metres between today's and the detailed one

/** Slowly turns what's inside (?spin). */
function Turn({ children, k }: { children: React.ReactNode; k: number }) {
  const g = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (g.current && spin) g.current.rotation.y = s.clock.elapsedTime * 0.5 + k
  })
  return (
    <group ref={g} rotation={[0, k, 0]}>
      {children}
    </group>
  )
}

/** Counts what the GPU draws per Sim (meshes visible, triangles), once all is built. */
function Counter({ onCount }: { onCount: (s: string) => void }) {
  const { scene } = useThree()
  useEffect(() => {
    const id = setTimeout(() => {
      const rows: string[] = []
      for (const side of ['today', 'detail']) {
        let meshes = 0
        let tris = 0
        let n = 0
        scene.traverse((o) => {
          if (o.userData.side !== side) return
          n++
          o.traverse((c) => {
            const m = c as THREE.Mesh
            if (!m.isMesh) return
            let vis = true
            for (let p: THREE.Object3D | null = m; p; p = p.parent) if (!p.visible) vis = false
            if (!vis) return
            meshes++
            const g = m.geometry
            tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3
          })
        })
        rows.push(`${side === 'today' ? "aujourd'hui" : 'détaillé'} : ${(meshes / n).toFixed(1)} draw calls, ${Math.round(tris / n)} triangles par Sim`)
      }
      const c = samples.map((s) => detailCost(s.look as Look, s.gender, s.child ? 1.2 : 1))
      rows.push(`détaillé : ${Math.round(c.reduce((a, b) => a + b.boxes, 0) / c.length)} blocs fusionnés en ${Math.round(c.reduce((a, b) => a + b.meshes, 0) / c.length)} meshes, 1 matériau, atlas 256×(${c.map((x) => x.atlas).join(', ')})`)
      console.log('[lab] ' + rows.join(' | '))
      onCount(rows.join('\n'))
    }, 1500)
    return () => clearTimeout(id)
  }, [scene, onCount])
  return null
}

function Daylight({ ground = true }: { ground?: boolean }) {
  return (
    <>
      <color attach="background" args={['#9fd8f5']} />
      {/* The street's daylight (Neighbourhood.tsx). */}
      <hemisphereLight args={['#ffffff', '#c9a46b', 1.15]} />
      <directionalLight position={[25, 40, 15]} intensity={1.6} color="#fff4e0" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
      {ground && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshLambertMaterial color="#d8c8ad" />
        </mesh>
      )}
    </>
  )
}

function Pairs() {
  const [count, setCount] = useState('')
  const n = samples.length
  const x0 = (-(n - 1) * PAIR) / 2
  const span = n * PAIR
  const cam: Record<string, { p: [number, number, number]; at: [number, number, number]; fov: number }> = {
    front: { p: [0, 1.0, span * 0.95 + 0.8], at: [0, 0.85, 0], fov: 30 },
    three: { p: [0, 2.2, span * 0.95 + 0.8], at: [0, 0.8, 0], fov: 30 },
    face: { p: [0, 1.52, (span + 0.2) * 1.42], at: [0, 1.4, 0], fov: 20 },
    game: { p: [30, 32, 30], at: [0, 0.7, 0], fov: 30 },
  }
  const c = cam[view] ?? cam.front
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', fontFamily: 'system-ui, sans-serif' }}>
      <Canvas shadows dpr={[1, 2]} orthographic={view === 'game'} camera={view === 'game' ? { position: [30, 32, 30], zoom: Number(q.get('zoom') ?? 17), near: -300, far: 600 } : { position: c.p, fov: c.fov }} gl={{ antialias: true }}>
        <Daylight />
        <group rotation={[0, view === 'game' ? Math.PI / 4 : 0, 0]}>
          {samples.map((s, i) => {
            const x = x0 + i * PAIR
            const pose = (poseQ === 'mix' ? s.pose : poseQ) as Pose
            const look = { ...DEFAULT_LOOK, ...s.look }
            const scale = s.child ? 0.62 : 1
            const hs = s.child ? 1.2 : 1
            const turn = view === 'three' ? 0.65 : view === 'face' ? 0.35 : 0
            return (
              <group key={i}>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x + IN / 2, 0.003, 0]} receiveShadow>
                  <planeGeometry args={[0.56, 0.56]} />
                  <meshLambertMaterial color="#e9c46a" />
                </mesh>
                {view !== 'face' && view !== 'game' && (
                  <Html position={[x, 0, 0.45]} center style={{ whiteSpace: 'nowrap', fontSize: 12, color: '#14213d', background: '#ffffffb0', padding: '1px 6px', borderRadius: 4, fontFamily: 'system-ui, sans-serif' }}>
                    {s.name}
                  </Html>
                )}
                <group position={[x - IN / 2, 0, 0]} scale={scale} userData={{ side: 'today' }}>
                  <Turn k={turn}>
                    <BlockHuman look={look} gender={s.gender} pose={pose} seed={i} headScale={hs} fitted speed={1.4} />
                  </Turn>
                </group>
                <group position={[x + IN / 2, 0, 0]} scale={scale} userData={{ side: 'detail' }}>
                  <Turn k={turn}>
                    <DetailHuman look={look} gender={s.gender} pose={pose} seed={i} headScale={hs} fitted speed={1.4} />
                  </Turn>
                </group>
              </group>
            )
          })}
        </group>
        <Counter onCount={setCount} />
        <OrbitControls target={c.at} />
      </Canvas>
      <div style={{ position: 'absolute', top: 10, left: 12, right: 12, color: '#14213d', fontSize: 14, lineHeight: 1.4, pointerEvents: 'none' }}>
        <b>Sim détaillé.</b> Dans chaque paire : à gauche le Sim d'aujourd'hui, à droite le détaillé (sur la dalle dorée).
        <div style={{ whiteSpace: 'pre', fontSize: 12, opacity: 0.8 }}>{count}</div>
      </div>
    </div>
  )
}

/* ---------- Every outfit of an age, through the game's switch ---------- */

function Grid() {
  const age = q.get('age') ?? 'adulte'
  const gender = (q.get('g') ?? 'femme') as 'femme' | 'homme'
  const all = age === 'bebe' ? BABY_OUTFITS : age === 'enfant' ? [...KID_OUTFITS, ...OUTFITS.filter((o) => !['soutane', 'pasteur', 'imam', 'blouse', 'bleu', 'policier', 'gendarme', 'cuisinier', 'infirmier', 'vigile', 'soeur'].includes(o.id))] : age === 'ado' ? TEEN_OUTFITS : OUTFITS
  const list = all.slice(Number(q.get('from') ?? 0), Number(q.get('to') ?? all.length))
  const cols = Number(q.get('cols') ?? (age === 'bebe' ? 5 : 12))
  const size = age === 'bebe' ? null : age === 'adulte' ? null : sizeOf(age)
  const hairs = (q.get('hair') ?? '').split(',').filter(Boolean)
  const accs = (q.get('acc') ?? '').split(';').filter(Boolean)
  const gap = age === 'bebe' ? 0.75 : 1.05
  const rows = Math.ceil(list.length / cols)
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas dpr={[1, 2]} orthographic camera={{ position: [0, 0, 40], zoom: Number(q.get('zoom') ?? (age === 'bebe' ? 220 : 128)), near: -100, far: 200 }} gl={{ antialias: true }}>
        <Daylight ground={false} />
        <group position={[(-(cols - 1) * gap) / 2, 0, 0]}>
          {list.map((o, i) => {
            const [c, r] = [i % cols, Math.floor(i / cols)]
            const look: Look = { ...DEFAULT_LOOK, outfit: o.id, outfitColor: OUTFIT_DEFAULT_COLOR[o.id] ?? DEFAULT_LOOK.outfitColor, hair: hairs[i % (hairs.length || 1)] ?? (gender === 'femme' ? 'braids' : 'short'), accessory: accs[i % (accs.length || 1)] ?? 'none', skin: ['#6e4024', '#a46c42', '#4a2814', '#8a5532', '#c28a5c'][i % 5], pattern: ['cercles', 'losanges', 'feuilles', 'kente', 'points', 'zigzag'][i % 6] }
            const rowH = age === 'bebe' ? 0.75 : age === 'adulte' ? 2.2 : 1.6
            const y = (rows / 2 - 1 - r) * rowH + 0.15
            return (
              <group key={o.id} position={[c * gap, y, 0]}>
                {age === 'bebe' ? (
                  <Baby look={look} gender={gender} fitted pose="idle" seed={i} />
                ) : size ? (
                  <group scale={size.scale}>
                    <Human look={look} gender={gender} fitted full pose="idle" seed={i} headScale={size.head} />
                  </group>
                ) : (
                  <Human look={look} gender={gender} full pose="idle" seed={i} />
                )}
                <Html position={[0, -0.08, 0.3]} center style={{ whiteSpace: 'nowrap', fontSize: 11, color: '#14213d', background: '#ffffffc0', padding: '0 4px', borderRadius: 3, fontFamily: 'system-ui, sans-serif' }}>
                  {o.label}
                </Html>
              </group>
            )
          })}
        </group>
      </Canvas>
    </div>
  )
}

/* ---------- A crowded street: draw calls, triangles, frame rate ---------- */

function seeded(n: number) {
  let s = n
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

function Walker({ look, gender, seed, r, x, z }: { look: Look; gender: 'femme' | 'homme'; seed: number; r: number; x: number; z: number }) {
  const g = useRef<THREE.Group>(null)
  useFrame((s) => {
    const t = s.clock.elapsedTime * (0.25 + (seed % 5) * 0.03) + seed
    if (!g.current) return
    g.current.position.set(x + Math.cos(t) * r, 0, z + Math.sin(t) * r)
    g.current.rotation.y = -t
  })
  return (
    <group ref={g}>
      <Human look={look} gender={gender} pose="walk" seed={seed} speed={1.3} />
    </group>
  )
}

/** Logs the frame's draw calls and triangles, and the frame rate, every two seconds (window.__stats). */
function Stats({ onStats }: { onStats: (s: string) => void }) {
  const gl = useThree((s) => s.gl)
  const acc = useRef({ frames: 0, since: performance.now(), calls: 0, tris: 0 })
  useEffect(() => {
    gl.info.autoReset = true
  }, [gl])
  useFrame(() => {
    const a = acc.current
    a.frames++
    a.calls = gl.info.render.calls
    a.tris = gl.info.render.triangles
    const now = performance.now()
    if (now - a.since > 2000) {
      const fps = (a.frames * 1000) / (now - a.since)
      const row = { fps: Math.round(fps * 10) / 10, calls: a.calls, tris: a.tris, built: builtCount(), ms: builtMs(), textures: gl.info.memory.textures, atlasMB: Math.round(atlasBytes() / 1e5) / 10, real: realNow }
      ;(window as unknown as { __stats: unknown[] }).__stats = [...((window as unknown as { __stats?: unknown[] }).__stats ?? []), row]
      onStats(`${row.fps} img/s · ${row.calls} draw calls · ${row.tris} triangles · ${row.built} looks construits en ${row.ms} ms · ${row.textures} textures (atlas réalistes ${row.atlasMB} Mo) · ${row.real} persos réalistes`)
      a.frames = 0
      a.since = now
    }
  })
  return null
}

function Crowd() {
  const n = Number(q.get('n') ?? 60)
  const [stats, setStats] = useState('')
  // « persos-monde »: &lat=&lng=(&commune=) the street of that place (its country's look, its people); &names their first names; window.__looks what was drawn.
  if (q.get('lat')) {
    const [lat, lng] = [Number(q.get('lat')), Number(q.get('lng'))]
    setCountryLook(countryLookAt(lat, lng))
    setPeoplePlace(lat, lng, q.get('commune') ?? '')
  }
  const people = useMemo(() => {
    const rnd = seeded(7)
    return [...Array(n)].map((_, i) => {
      const gender = rnd() < 0.5 ? 'femme' : 'homme'
      // NPCs share looks: a third wear one of a few common ones.
      const look = randomLook(gender, seeded(i % 3 === 0 ? 1 + (i % 4) : 100 + i))
      // &spread=: how wide the square they walk in (m); 40 by default.
      const spread = Number(q.get('spread') ?? 40)
      return { gender, look, seed: i, r: 1 + rnd() * 3, x: (rnd() - 0.5) * spread, z: (rnd() - 0.5) * spread } as const
    })
  }, [n])
  ;(window as unknown as { __looks: unknown }).__looks = people.map((p) => p.look)
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', fontFamily: 'system-ui, sans-serif' }}>
      <Canvas shadows dpr={1} camera={{ position: (q.get('cam')?.split(',').map(Number) as [number, number, number] | undefined) ?? [11, 10, 14], fov: 45 }} gl={{ antialias: true }}>
        <Daylight />
        {/* The player, casting its shadow; the passers-by don't (as in the street) */}
        <Human look={{ ...DEFAULT_LOOK }} gender="femme" pose="idle" />
        <NoShadows>
          {people.map((p) => (
            <Walker key={p.seed} {...p} />
          ))}
          {q.has('names') &&
            people.map((p) => (
              <Html key={`n${p.seed}`} position={[p.x, 2.15, p.z]} center style={{ whiteSpace: 'nowrap', fontSize: 11, fontWeight: 700, color: '#14213d', background: '#ffffffd0', padding: '0 4px', borderRadius: 4, fontFamily: 'system-ui, sans-serif' }}>
                {nameFor(p.gender, p.seed * 7, p.look)}
              </Html>
            ))}
        </NoShadows>
        <Stats onStats={setStats} />
        <OrbitControls target={[0, 0.8, 0]} />
      </Canvas>
      <div style={{ position: 'absolute', top: 10, left: 12, color: '#14213d', fontSize: 14 }}>
        <b>{n} passants</b> — {stats}
      </div>
    </div>
  )
}

/* ---------- The creator's stage, the still pictures, the birth ---------- */

const PEOPLE: { look: Look; gender: 'femme' | 'homme'; stage?: string }[] = [
  { look: { ...DEFAULT_LOOK }, gender: 'femme' },
  { look: { ...DEFAULT_LOOK, outfit: 'suit', outfitColor: '#1f2a44', hair: 'degrade', beard: 'bouc', accessory: 'watch', skin: '#583119' }, gender: 'homme' },
  { look: { ...DEFAULT_LOOK, outfit: 'casual', outfitColor: '#d6336c', hair: 'afro', accessory: 'glasses,chain', skin: '#a46c42' }, gender: 'femme' },
  { look: { ...DEFAULT_LOOK, outfit: 'boubou', outfitColor: '#2a6cf0', hair: 'short', hairColor: '#d8d2c8', beard: 'full', accessory: 'kufi', skin: '#3f2210' }, gender: 'homme' },
  { look: { ...DEFAULT_LOOK, outfit: 'tee-short', outfitColor: '#f2b705', hair: 'couettes', accessory: 'cartable,barrettes', skin: '#6e4024' }, gender: 'femme', stage: 'enfant' },
  { look: { ...DEFAULT_LOOK, outfit: 'grenouillere', outfitColor: '#bde0fe', hair: 'puffs', accessory: 'tetine,bonnet-bebe', skin: '#8a5532' }, gender: 'femme', stage: 'bebe' },
]

function Pictures() {
  if (q.has('one'))
    return (
      <div style={{ width: 320, height: 320 }}>
        <Portrait look={PEOPLE[Number(q.get('i') ?? 0)].look} gender={PEOPLE[Number(q.get('i') ?? 0)].gender} stage={PEOPLE[Number(q.get('i') ?? 0)].stage} framing={(q.get('framing') ?? 'bust') as 'bust'} />
      </div>
    )
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 160px)', gap: 8, padding: 12, background: '#f3e9dc', fontFamily: 'system-ui, sans-serif' }}>
      {(['head', 'bust', 'full'] as const).flatMap((framing) =>
        PEOPLE.map((p, i) => (
          <div key={`${framing}${i}`} style={{ width: 160, height: 160, borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
            <Portrait look={p.look} gender={p.gender} framing={framing} stage={p.stage} />
          </div>
        )),
      )}
    </div>
  )
}

/* ---------- Every skin tone (or every new hairdo) under the creator's lights ---------- */

/** ?view=skins (&focus=body): the 13 skin tones side by side under the creator's lights, the swatch under each; ?view=hairs the hairdos of « persos-realistes » (&g=homme, &skin=). */
function Lineup({ hairs }: { hairs?: boolean }) {
  const real = usePersos() !== 'off'
  const body = q.get('focus') === 'body'
  const g = (q.get('g') ?? 'femme') as 'femme' | 'homme'
  // « persos-monde »: &set=monde the planet's hairdos (&hc= their colour).
  const items = hairs ? (q.get('set') === 'monde' ? WORLD_HAIRS : REAL_HAIRS).map((h) => ({ key: h.id, label: h.label, look: { ...DEFAULT_LOOK, outfit: 'casual', outfitColor: '#d6336c', accessory: 'none', hair: h.id, skin: '#' + (q.get('skin') ?? '6e4024'), pattern: 'losanges', hairColor: '#' + (q.get('hc') ?? '141010'), wrapColor: h.id === 'turban' ? '#1c3f94' : h.id === 'hijab' ? '#7a1f3d' : '' } })) : SKIN_TONES.map((s) => ({ key: s, label: s, look: { ...DEFAULT_LOOK, outfit: 'casual', outfitColor: '#d6336c', accessory: 'none', hair: 'short', skin: s } }))
  // &n= the first n only, &outfit= &pattern= &skin= what they wear (a walk cycle: &n=1&focus=body&pose=walk&turn=1.3&outfit=pagne).
  const over: Partial<Look> = {}
  if (q.get('outfit')) over.outfit = q.get('outfit')!
  if (q.get('pattern')) over.pattern = q.get('pattern')!
  if (q.get('ocolor')) over.outfitColor = '#' + q.get('ocolor')
  if (q.get('hair') && !hairs) over.hair = q.get('hair')!
  for (const it of items) Object.assign(it.look, over, !hairs && q.get('skin') ? { skin: '#' + q.get('skin') } : {})
  items.splice(Number(q.get('n') ?? items.length))
  const cols = Number(q.get('cols') ?? Math.min(items.length, hairs ? 4 : 13))
  const gap = hairs ? 0.75 : 0.5
  const rowH = body ? 2.1 : hairs ? 1.1 : 0.9
  const rows = Math.ceil(items.length / cols)
  const turn = Number(q.get('turn') ?? 0)
  return (
    <div style={{ width: '100vw', height: '100vh', background: 'linear-gradient(#fff3e0, #ffd8a8)' }}>
      <Canvas shadows={real ? 'soft' : true} dpr={[1, 2]} orthographic camera={{ position: [0, body ? 1 : 1.5, 10], zoom: Number(q.get('zoom') ?? (body ? 60 : 180)) }} gl={{ antialias: true, alpha: true }} onCreated={({ camera }) => camera.lookAt(0, body ? 1 : 1.5, 0)}>
        {real ? <StudioLight /> : <PlainLight />}
        <FullDetail.Provider value>
          {items.map((it, i) => {
            const [c, r] = [i % cols, Math.floor(i / cols)]
            const x = (c - (cols - 1) / 2) * gap
            const y = ((rows - 1) / 2 - r) * rowH - (hairs ? 0.15 : 0)
            return (
              <group key={it.key} position={[x, y, 0]} rotation={[0, turn, 0]}>
                <Human look={it.look} gender={g} pose={(q.get('pose') ?? 'idle') as Pose} seed={0} />
                {!hairs && !q.has('n') && (
                  <mesh position={[0, body ? -0.1 : 1.18, 0.4]}>
                    <planeGeometry args={[0.3, 0.08]} />
                    <meshBasicMaterial color={it.label} toneMapped={false} />
                  </mesh>
                )}
                {hairs && (
                  <Html position={[0, 1.02, 0.4]} center style={{ whiteSpace: 'nowrap', fontSize: 11, color: '#14213d', background: '#ffffffc0', padding: '0 4px', borderRadius: 3, fontFamily: 'system-ui, sans-serif' }}>
                    {it.label}
                  </Html>
                )}
              </group>
            )
          })}
        </FullDetail.Provider>
      </Canvas>
    </div>
  )
}

/**
 * « persos-monde »: ?view=monde the planet's faces, one of each people (world3d/peoples.ts), heads and shoulders under the
 * creator's lights (&seed= another draw, &cols=, &zoom=, &only=group,group).
 */
function World() {
  const real = usePersos() !== 'off'
  const groups = q.get('only')?.split(',') ?? Object.keys(PEOPLES)
  const cols = Number(q.get('cols') ?? 6)
  const rows = Math.ceil(groups.length / cols)
  const seed = Number(q.get('seed') ?? 1)
  const items = useMemo(
    () =>
      groups.map((group, i) => {
        const gender: 'femme' | 'homme' = (i + seed) % 2 ? 'homme' : 'femme'
        const rnd = seeded(seed * 97 + i * 13)
        const base = { ...randomLook(gender, rnd, null), outfit: 'casual', outfitColor: ['#2a6cf0', '#d6336c', '#00a862', '#f2b705', '#7b5cff', '#ff7a00'][i % 6], accessory: 'none' }
        return { group, gender, look: peopleLook(base, gender, [{ group, weight: 1, own: true }], rnd) }
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const step = Number(q.get('step') ?? 0.85)
  const rowH = Number(q.get('rowh') ?? 2.05)
  return (
    <div style={{ width: '100vw', height: '100vh', background: 'linear-gradient(#fff3e0, #ffd8a8)' }}>
      <Canvas shadows={real ? 'soft' : true} dpr={[1, 2]} orthographic camera={{ position: [0, 1.0, 10], zoom: Number(q.get('zoom') ?? 100) }} gl={{ antialias: true, alpha: true }} onCreated={({ camera }) => camera.lookAt(0, 1.0, 0)}>
        {real ? <StudioLight /> : <PlainLight />}
        <FullDetail.Provider value>
          {items.map((it, i) => {
            const [c, r] = [i % cols, Math.floor(i / cols)]
            return (
              <group key={it.group} position={[(c - (cols - 1) / 2) * step, ((rows - 1) / 2 - r) * rowH, 0]} rotation={[0, Number(q.get('turn') ?? 0.3), 0]}>
                <Human look={it.look} gender={it.gender} pose="idle" seed={0} />
                <Html position={[0, Number(q.get('ly') ?? -0.08), 0.4]} center style={{ whiteSpace: 'nowrap', fontSize: 11, fontWeight: 700, color: '#14213d', background: '#ffffffd0', padding: '0 4px', borderRadius: 3, fontFamily: 'system-ui, sans-serif' }}>
                  {GROUP_NAMES[it.group]?.[it.gender][(i + seed) % 6] ?? ''} · {it.group}
                </Html>
              </group>
            )
          })}
        </FullDetail.Provider>
      </Canvas>
    </div>
  )
}

/** ?view=faces: expressions held, heads close up under the creator's lights (&ex=a,b,… &skin= &g= &age=enfant|ado &turn= &cols=). */
function Faces() {
  const real = usePersos() !== 'off'
  const ex = (q.get('ex') ?? 'neutral,smile,laugh,surprised,sad,angry,love,shout').split(',') as Expression[]
  const cols = Number(q.get('cols') ?? 2)
  const rows = Math.ceil(ex.length / cols)
  const age = q.get('age')
  const size = age ? sizeOf(age) : null
  const g = (q.get('g') ?? 'femme') as 'femme' | 'homme'
  const look: Look = { ...DEFAULT_LOOK, outfit: 'casual', outfitColor: '#2a6cf0', accessory: 'none', hair: q.get('hair') ?? (g === 'femme' ? 'braids' : 'short'), skin: '#' + (q.get('skin') ?? '6e4024'), beard: q.get('beard') ?? 'none' }
  const headY = size ? 1.36 * size.scale + 0.16 * size.head * size.scale : 1.52
  const step = 0.55 * (size ? size.head * size.scale : 1)
  return (
    <div style={{ width: '100vw', height: '100vh', background: 'linear-gradient(#fff3e0, #ffd8a8)' }}>
      <Canvas shadows={real ? 'soft' : true} dpr={[1, 2]} orthographic camera={{ position: [0, headY, 10], zoom: Number(q.get('zoom') ?? 300) / (size ? size.head * size.scale : 1) }} gl={{ antialias: true, alpha: true }} onCreated={({ camera }) => camera.lookAt(0, headY, 0)}>
        {real ? <StudioLight /> : <PlainLight />}
        <FullDetail.Provider value>
          {ex.map((n, i) => {
            const [c, r] = [i % cols, Math.floor(i / cols)]
            return (
              <group key={n} position={[(c - (cols - 1) / 2) * step, ((rows - 1) / 2 - r) * step, r * 0.8]} rotation={[0, Number(q.get('turn') ?? 0.45), 0]}>
                <FaceMood expression={n} still>
                  {size ? (
                    <group scale={size.scale}>
                      <Human look={look} gender={g} fitted pose="idle" seed={0} headScale={size.head} />
                    </group>
                  ) : (
                    <Human look={look} gender={g} pose="idle" seed={0} />
                  )}
                </FaceMood>
              </group>
            )
          })}
        </FullDetail.Provider>
      </Canvas>
    </div>
  )
}

function Lab() {
  if (view === 'faces') return <Faces />
  if (view === 'monde') return <World />
  if (view === 'skins') return <Lineup />
  if (view === 'hairs') return <Lineup hairs />
  if (view === 'grid') return <Grid />
  if (view === 'crowd') return <Crowd />
  if (view === 'portrait') return <Pictures />
  if (view === 'stage') {
    const p0 = PEOPLE[Number(q.get('i') ?? 0)] ?? PEOPLE[0]
    // &skin=, &hair=, &outfit=, &g=, &pose=, &acc= change the person shown (the pictures of « persos-realistes »).
    const over: Partial<Look> = {}
    for (const k of ['skin', 'hair', 'outfit', 'pattern', 'beard'] as const) if (q.get(k)) over[k] = (k === 'skin' ? '#' : '') + q.get(k)!
    if (q.get('acc')) over.accessory = q.get('acc')!
    const p = { ...p0, look: { ...p0.look, ...over }, gender: (q.get('g') ?? p0.gender) as 'femme' | 'homme' }
    return (
      <div style={{ width: '100vw', height: '100vh', background: 'linear-gradient(#fff3e0, #ffd8a8)' }}>
        <Stage look={p.look} gender={p.gender} stage={q.get('age') ?? p.stage} focus={(q.get('focus') ?? 'body') as 'body'} pose={(q.get('pose') ?? 'idle') as Pose} />
      </div>
    )
  }
  if (view === 'family')
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#bfe3f5' }}>
        <FamilyScene familyId={q.get('f') ?? 'poignon'} look={PEOPLE[Number(q.get('i') ?? 2)].look} gender="femme" className="h-full w-full" />
      </div>
    )
  return <Pairs />
}

createRoot(document.getElementById('root')!).render(<Lab />)
