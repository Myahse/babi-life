import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Look } from '../lib/types'
import { BlockHuman } from '../avatar/BlockHuman'
import { DetailHuman } from '../avatar/DetailHuman'
import { FullDetail, type Pose } from '../avatar/Human'
import { EXPRESSION_NAMES, FaceMood, gazeTarget, setSpeaking, type Expression } from '../avatar/expressions'
import { randomLook, SKIN_TONES } from '../avatar/options'
import { freezeWorldTime } from '../lib/worldClock'

// The faces' lab (city.html?view=visages): every expression on the two Sims (&r=block|detail, &look=n),
// several looks side by side (&mode=looks), a pair talking (&mode=talk), the eyes following a target
// (&mode=gaze). &t= holds the clock (the pictures).

const q = new URLSearchParams(location.search)
const seeded = (n: number) => () => ((n = (n * 16807) % 2147483647) / 2147483647)
const GREY = '#d8d2c8'

/** The looks shown: skin tones light to dark, a man, a woman, a child, an elder, a beard, glasses. */
function labLooks(): { look: Look; gender: 'femme' | 'homme'; head?: number; name: string }[] {
  const r = (g: 'femme' | 'homme', n: number) => randomLook(g, seeded(n))
  return [
    { look: { ...r('femme', 5), skin: SKIN_TONES[8], accessory: 'none' }, gender: 'femme', name: 'Femme' },
    { look: { ...r('homme', 9), skin: SKIN_TONES[11], beard: 'none', accessory: 'none' }, gender: 'homme', name: 'Homme' },
    { look: { ...r('homme', 21), skin: SKIN_TONES[3], beard: 'bouc', accessory: 'none' }, gender: 'homme', name: 'Barbe' },
    { look: { ...r('femme', 33), skin: SKIN_TONES[1], accessory: 'none' }, gender: 'femme', name: 'Claire' },
    { look: { ...r('homme', 41), skin: SKIN_TONES[6], beard: 'none', accessory: 'none' }, gender: 'homme', head: 1.3, name: 'Enfant' },
    { look: { ...r('femme', 52), skin: SKIN_TONES[10], hairColor: GREY, accessory: 'none' }, gender: 'femme', name: 'Ancienne' },
    { look: { ...r('homme', 64), skin: SKIN_TONES[9], hairColor: GREY, beard: 'full', accessory: 'none' }, gender: 'homme', name: 'Ancien' },
    { look: { ...r('femme', 77), skin: SKIN_TONES[12], accessory: 'none' }, gender: 'femme', name: 'Foncée' },
  ]
}

function Sim({ detail, look, gender, pose = 'idle', seed = 1, head, faceId }: { detail: boolean; look: Look; gender: 'femme' | 'homme'; pose?: Pose; seed?: number; head?: number; faceId?: string }) {
  return detail ? <DetailHuman look={look} gender={gender} pose={pose} seed={seed} headScale={head} full faceId={faceId} /> : <BlockHuman look={look} gender={gender} pose={pose} seed={seed} headScale={head} faceId={faceId} />
}

function Lights() {
  return (
    <>
      <color attach="background" args={['#a9d3f0']} />
      <hemisphereLight args={['#ffffff', '#b8a27c', 1.25]} />
      <directionalLight position={[2, 5, 8]} intensity={1.5} />
    </>
  )
}

const label = (text: string) => (
  <Html center position={[0, 1.74, 0]} zIndexRange={[10, 0]}>
    <span style={{ font: '700 12px sans-serif', background: '#fff', padding: '1px 5px', borderRadius: 4, whiteSpace: 'nowrap' }}>{text}</span>
  </Html>
)

/** Every expression, held, on one look: heads in a grid. */
function Grid({ detail, who }: { detail: boolean; who: ReturnType<typeof labLooks>[number] }) {
  const names = EXPRESSION_NAMES
  const cols = 8
  const rows = Math.ceil(names.length / cols)
  return (
    <Canvas orthographic dpr={[1, 2]} camera={{ position: [0, 0, 30], zoom: Number(q.get('zoom') ?? 330) }} style={{ width: '100vw', height: '100vh' }}>
      <Lights />
      {names.map((n, i) => {
        // Heads in rows, each row a little nearer than the one above (its bodies hide the bodies behind).
        const row = Math.floor(i / cols)
        return (
          <group key={n} position={[((i % cols) - (cols - 1) / 2) * 0.6, -(row - (rows - 1) / 2) * 0.62 - 1.45, row * 0.6]}>
            <FaceMood expression={n as Expression} still>
              <Sim detail={detail} look={who.look} gender={who.gender} head={who.head} />
            </FaceMood>
            {label(n)}
          </group>
        )
      })}
    </Canvas>
  )
}

/** Some expressions on every look, both Sims. */
function Looks() {
  const looks = useMemo(labLooks, [])
  const show: Expression[] = (q.get('ex')?.split(',') as Expression[]) ?? ['neutral', 'smile', 'laugh', 'sad', 'cry', 'angry', 'surprised', 'love']
  return (
    <Canvas orthographic dpr={[1, 2]} camera={{ position: [0, 0, 40], zoom: Number(q.get('zoom') ?? 150) }} style={{ width: '100vw', height: '100vh' }}>
      <Lights />
      {looks.map((w, j) =>
        show.map((n, i) =>
          [false, true].map((detail) => (
            <group key={`${j}${n}${detail}`} position={[(i - (show.length - 1) / 2) * 0.95 + (detail ? 0.4 : -0.0), -(j - (looks.length - 1) / 2) * 0.82 - 1.5, detail ? -0.001 : 0]} scale={0.95}>
              {!detail && (
                <FaceMood expression={n} still>
                  <group position={[-0.2, 0, 0]}>
                    <Sim detail={false} look={w.look} gender={w.gender} head={w.head} />
                  </group>
                </FaceMood>
              )}
              {detail && (
                <FaceMood expression={n} still>
                  <group position={[-0.17, 0, 0]}>
                    <Sim detail look={w.look} gender={w.gender} head={w.head} />
                  </group>
                </FaceMood>
              )}
            </group>
          )),
        ),
      )}
    </Canvas>
  )
}

/** Two people talking, turns taken (Human talkAt): the speaker's mouth moving, the listener nodding and smiling. */
function Talk({ detail }: { detail: boolean }) {
  const looks = useMemo(labLooks, [])
  // The lab's own speaker, saying something now and then (setSpeaking), the other looking at them.
  useEffect(() => {
    const id = setInterval(() => setSpeaking('lab-a', 2600), 5000)
    setSpeaking('lab-a', 2600)
    return () => clearInterval(id)
  }, [])
  const cam = q.get('cam') === 'far' ? ([2.6, 1.9, 3.6] as const) : ([0, 1.62, 2.3] as const)
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [...cam], fov: 40 }} onCreated={({ camera }) => camera.lookAt(0, 1.5, 0)} style={{ width: '100vw', height: '100vh' }}>
      <Lights />
      <TargetAt name="lab-a" at={[-0.42, 1.55, 0]} />
      <TargetAt name="lab-b" at={[0.42, 1.55, 0]} />
      <group position={[-0.42, 0, 0]} rotation={[0, 0.9, 0]}>
        <Sim detail={detail} look={looks[0].look} gender="femme" pose="idle" seed={3} faceId="lab-a" />
      </group>
      <group position={[0.42, 0, 0]} rotation={[0, -0.9, 0]}>
        <Sim detail={detail} look={looks[1].look} gender="homme" pose="talk" seed={8} faceId="lab-b" />
      </group>
    </Canvas>
  )
}

function TargetAt({ name, at }: { name: string; at: [number, number, number] }) {
  useEffect(() => {
    gazeTarget(name, 3).set(...at)
  }, [name, at])
  return null
}

/** The eyes following a ball going round. */
function Gaze({ detail }: { detail: boolean }) {
  const looks = useMemo(labLooks, [])
  const ball = useRef<THREE.Mesh>(null)
  const at = useMemo(() => gazeTarget('lab-ball', 6, 1), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    at.set(Math.sin(t * 0.9) * 1.6, 1.5 + Math.sin(t * 1.7) * 0.9, 1.4)
    ball.current?.position.copy(at)
  })
  return (
    <>
      <mesh ref={ball}>
        <sphereGeometry args={[0.08, 16, 12]} />
        <meshLambertMaterial color="#ffffff" />
      </mesh>
      {looks.slice(0, 3).map((w, i) => (
        <group key={i} position={[(i - 1) * 0.7, 0, 0]}>
          <Sim detail={detail} look={w.look} gender={w.gender} seed={i + 1} />
        </group>
      ))}
    </>
  )
}

export function VisagesLab() {
  const fixed = q.get('t')
  if (fixed !== null) freezeWorldTime(Number(fixed))
  ;(window as unknown as { labT: (t: number) => void }).labT = (t: number) => freezeWorldTime(t)
  const detail = q.get('r') === 'detail'
  const mode = q.get('mode') ?? 'grid'
  const who = labLooks()[Number(q.get('look') ?? 0)]
  return (
    <FullDetail.Provider value>
      {mode === 'looks' ? (
        <Looks />
      ) : mode === 'talk' ? (
        <Talk detail={detail} />
      ) : mode === 'gaze' ? (
        <Canvas dpr={[1, 2]} camera={{ position: [0, 1.6, 2.6], fov: 40 }} onCreated={({ camera }) => camera.lookAt(0, 1.5, 0)} style={{ width: '100vw', height: '100vh' }}>
          <Lights />
          <Gaze detail={detail} />
        </Canvas>
      ) : (
        <Grid detail={detail} who={who} />
      )}
    </FullDetail.Provider>
  )
}
