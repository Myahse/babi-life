import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { worldTime } from '../../lib/worldClock'
import type { Soiree } from '../../lib/types'
import { rng } from '../themes'
import { soireeColours } from '../../game/soirees'
import { BEAM_GEO, fade } from './party'
import { BOX, lettering } from './ruePrincesse'
import { t as tr } from '../../lib/i18n'

// A player's soirée (backend sims/party.go) seen from the street, at the
// host's house: three beams sweeping the sky over it (seen from far, like
// the Rue Princesse's), its name lit over the gate, the speakers thumping
// either side, a string of bulbs, and people dancing out front. Inside it's
// a club (Interior, the host's name on the LED wall). Local frame: the door
// at the origin, +z toward the street.


const BEAMS: [number, number, number][] = [[-3.5, 0.4, -2], [3.5, 0.4, -2], [0, 0.4, -5]]

const beamMat = new THREE.MeshBasicMaterial({
  map: fade([[0, 'rgba(255,255,255,0)'], [0.55, 'rgba(255,255,255,0.16)'], [0.9, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0.7)']]),
  transparent: true,
  opacity: 0.4,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  fog: false,
})
const black = new THREE.MeshLambertMaterial({ color: '#141416' })
const cone = new THREE.MeshLambertMaterial({ color: '#4a4a4f' })
const pole = new THREE.MeshLambertMaterial({ color: '#555559' })

function Beams({ colours, night }: { colours: string[]; night: boolean }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(BEAM_GEO, beamMat, BEAMS.length)
    const c = new THREE.Color()
    BEAMS.forEach((_, i) => m.setColorAt(i, c.set(colours[i % colours.length])))
    m.frustumCulled = false
    m.renderOrder = 5
    return m
  }, [colours])
  const o = useMemo(() => new THREE.Object3D(), [])
  const at = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    const t = worldTime()
    // A haze up close, the beams from afar; fainter by day.
    const d = mesh.getWorldPosition(at).distanceTo(camera.position)
    beamMat.opacity = (night ? 0.42 : 0.16) * Math.min(1, Math.max(0.25, (d - 12) / 50))
    BEAMS.forEach(([x, y, z], i) => {
      o.position.set(x, y, z)
      o.rotation.set(Math.sin(t * 0.5 + i * 2.1) * 0.45, 0, Math.cos(t * 0.37 + i * 2.9) * 0.45)
      // Narrower than the Rue Princesse's: a house, not a whole street.
      o.scale.set(0.55, 0.8, 0.55)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return <primitive object={mesh} />
}

/** A tower of two speakers, its bass thumping on the beat. */
function Speaker({ p }: { p: [number, number, number] }) {
  const bass = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const k = ((worldTime() * 126) / 60) % 1
    const s = 0.5 + Math.max(0, 1 - k * 4) * 0.08
    bass.current?.scale.set(s, s, 0.02)
  })
  return (
    <group position={p}>
      <mesh geometry={BOX} material={black} position={[0, 0.6, 0]} scale={[0.9, 1.2, 0.7]} />
      <mesh geometry={BOX} material={black} position={[0, 1.6, 0]} scale={[0.75, 0.8, 0.6]} />
      <mesh ref={bass} geometry={BOX} material={cone} position={[0, 0.6, 0.36]} scale={[0.5, 0.5, 0.02]} />
      <mesh geometry={BOX} material={cone} position={[0, 1.6, 0.31]} scale={[0.35, 0.35, 0.02]} />
    </group>
  )
}

/** The bulbs over the gate, in the theme's colours, blinking in turn. */
function Bulbs({ colours, night }: { colours: string[]; night: boolean }) {
  const mats = useMemo(() => colours.map((c) => new THREE.MeshBasicMaterial({ color: c })), [colours])
  const dim = useMemo(() => new THREE.MeshLambertMaterial({ color: '#77777c' }), [])
  const refs = useRef<(THREE.Mesh | null)[]>([])
  useFrame(() => {
    const k = Math.floor(worldTime() * 2.1)
    refs.current.forEach((m, i) => {
      if (m) m.material = night || (i + k) % 3 === 0 ? mats[(i + k) % mats.length] : dim
    })
  })
  return (
    <>
      {[...Array(11)].map((_, i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)} geometry={BOX} material={dim} position={[-4 + i * 0.8, 3.1 - Math.sin((i / 10) * Math.PI) * 0.4, 1.6]} scale={[0.14, 0.14, 0.14]} />
      ))}
      {[-4.3, 4.3].map((x) => (
        <mesh key={x} geometry={BOX} material={pole} position={[x, 1.55, 1.6]} scale={[0.08, 3.1, 0.08]} />
      ))}
    </>
  )
}

/** The guests dancing out front, and one filming. */
function Dancers({ seed, guests }: { seed: string; guests: number }) {
  const people = useMemo(() => {
    const r = rng(`soiree${seed}`)
    const n = Math.min(7, 3 + guests)
    return [...Array(n)].map((_, i) => {
      const gender: 'femme' | 'homme' = r() < 0.55 ? 'femme' : 'homme'
      const a = i * 2.39996
      const d = 1 + Math.sqrt(i) * 0.9
      const pose: Pose = i === n - 1 ? 'film' : i % 4 === 3 ? 'cheer' : 'dance'
      return { gender, look: randomLook(gender, r), p: [Math.cos(a) * d * 1.4, 0, 3.4 + Math.sin(a) * d * 0.6] as [number, number, number], r: Math.PI + (r() - 0.5) * 1.2, pose, seed: r() * 100 }
    })
  }, [seed, guests])
  return (
    <NoShadows>
      {people.map((p, i) => (
        <group key={i} position={p.p} rotation={[0, p.r, 0]}>
          <Human look={p.look} gender={p.gender} pose={p.pose} seed={p.seed} />
        </group>
      ))}
    </NoShadows>
  )
}

export function PartyFront({ party, night, entry }: { party: Soiree; night: boolean; /** « soiree-deco »: the entry under the name (« ENTRÉE LIBRE », « ENTRÉE 2 000 DJAI »). */ entry?: string }) {
  const colours = soireeColours(party.theme)
  const sign = useMemo(() => lettering(tr('{0} · CHEZ {1}', { 0: party.title.toUpperCase(), 1: party.hostName.toUpperCase() }), '#14101f', colours[0], colours[1]), [party.title, party.hostName, colours])
  const board = useMemo(() => (entry ? lettering(entry.toUpperCase(), '#14101f', colours[1], colours[2] ?? colours[0]) : null), [entry, colours])
  return (
    <group>
      <Beams colours={colours} night={night} />
      <Bulbs colours={colours} night={night} />
      <Speaker p={[-3.2, 0, 1.2]} />
      <Speaker p={[3.2, 0, 1.2]} />
      {/* The name over the gate, lit */}
      <mesh position={[0, 4.2, 1.6]}>
        <planeGeometry args={[sign.aspect * 0.7, 0.7]} />
        <meshBasicMaterial map={sign.t} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {/* The entry, on a board under it */}
      {board && (
        <mesh position={[0, 3.55, 1.62]}>
          <planeGeometry args={[board.aspect * 0.42, 0.42]} />
          <meshBasicMaterial map={board.t} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {night && <pointLight position={[0, 3, 3]} intensity={18} distance={14} color={colours[0]} />}
      <Dancers seed={party.id} guests={party.guests} />
    </group>
  )
}
