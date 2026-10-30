import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Pose } from '../../../../avatar/Human'
import { MySim } from '../me'
import { Prop } from '../props'
import { Who } from '../Shell'
import type { Host, PropId } from '../types'

// At the mic (the update « avatar-jeux »): the player's own Sim, a microphone in its fist, in front of
// the crowd (the kids of the match, the tournament's public). It listens; picked, the line is said into
// the mic, the free arm going; right, the crowd jumps and cheers and the Sim pumps its arm; wrong, the
// crowd stays flat, or boos. Seen from the front, three-quarters, the crowd on the right.

const SIM: [number, number, number] = [-0.85, 0, -0.45]
const CROWD: [number, number][] = [[0.25, -1.65], [1.0, -1.55], [1.75, -1.3], [0.6, -0.75], [1.4, -0.5]]
/** The camera: in front of the Sim, a little to its side, the crowd in view. */
export const MIC_CAM = { cam: [-0.1, 1.75, 4.4] as [number, number, number], look: [0.3, 0.85, -0.6] as [number, number, number], fov: 46 }
/** The crowd's mood (Repondre's MoodBar), beside them; the heart, over them. */
export const MIC_BAR: [number, number, number] = [2.2, 0.35, -1.2]
export const MIC_HEART: [number, number, number] = [1.0, 1.75, -0.5]

const HANDLE = new THREE.CylinderGeometry(0.024, 0.018, 0.17, 8)
const HEAD = new THREE.SphereGeometry(0.048, 10, 8)
const RING = new THREE.CylinderGeometry(0.036, 0.036, 0.025, 10)
const black = new THREE.MeshLambertMaterial({ color: '#1c1c20' })
const grille = new THREE.MeshLambertMaterial({ color: '#b4b9c0', flatShading: true })
const band = new THREE.MeshLambertMaterial({ color: '#e03131' })

/** A hand mic, through the fist: the grille out the thumb's side, which the 'mic' pose brings to the mouth (hanging, it points ahead). */
function HandMic() {
  return (
    <group position={[0, -0.02, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh geometry={HANDLE} material={black} />
      <mesh geometry={RING} material={band} position={[0, 0.09, 0]} />
      <mesh geometry={HEAD} material={grille} position={[0, 0.13, 0]} />
    </group>
  )
}

type Beat = 'wait' | 'speak' | 'good' | 'bad'
const BOO: Pose[] = ['rant', 'idle', 'facepalm', 'rant', 'shrug']

/** The Sim at the mic and the crowd in front of it. `said`: the line picked was right, wrong, or none yet. */
export function MicCrowd({ crowd, said, beat }: { crowd: { who: Host; prop?: PropId }; said: boolean | null; beat: number }) {
  const [now, setNow] = useState<Beat>('wait')
  const t = useRef(0)
  useEffect(() => void (t.current = 0), [beat])
  useFrame((_, dt) => {
    t.current += dt
    const b: Beat = said === null ? 'wait' : t.current < 0.75 ? 'speak' : said ? 'good' : 'bad'
    if (b !== now) setNow(b)
  })
  const face = (x: number, z: number) => Math.atan2(SIM[0] - x, SIM[2] - z)
  const me: Pose = now === 'wait' ? 'idle' : now === 'speak' ? 'mic' : now === 'good' ? 'shout' : 'shrug'
  return (
    <group>
      {crowd.prop && (
        <group position={[0.5, 0, -2.9]} scale={1.7}>
          <Prop id={crowd.prop} />
        </group>
      )}
      {/* Turned halfway between the crowd and us: they see its face, so do we. */}
      <MySim p={SIM} r={0.95} pose={me} hold={<HandMic />} />
      {CROWD.map(([x, z], i) => (
        <Who key={i} host={crowd.who} seed={41 + i * 5} p={[x, 0, z]} r={face(x, z)} pose={now === 'good' ? 'cheer' : now === 'bad' ? BOO[i] : i === 2 ? 'talk' : i % 2 ? 'clap' : 'idle'} />
      ))}
    </group>
  )
}
