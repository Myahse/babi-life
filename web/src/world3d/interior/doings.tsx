import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Box } from '../props'
import { worldTime } from '../../lib/worldClock'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { OUTFIT_DEFAULT_COLOR, randomLook } from '../../avatar/options'
import type { Look } from '../../lib/types'

// More of what shows what the Sim is doing, round it (as ActionProps): the
// papers on a counter and the clerk's stamp, the market woman handing over
// the tomatoes, the dancers on the stage, the doctor at the bed, the mother
// with her baby, the room service on its tray… In the Sim's own frame: it
// faces +z (lying, +z is up and +y runs from the feet to the head).

const BOX = new THREE.BoxGeometry(1, 1, 1)
const seeded = (n: number) => () => ((n = (n * 16807) % 2147483647) / 2147483647)

/** Someone with the Sim (the clerk, the seller, the mother…): the same look every time (its seed). */
export function Person({ p, r = 0, pose, g, seed, outfit, look: given, scale }: { p: [number, number, number]; r?: number; pose: Pose; g: 'femme' | 'homme'; seed: number; outfit?: string; look?: Look; scale?: number }) {
  const look = useMemo(() => {
    if (given) return given
    const l = randomLook(g, seeded(seed))
    return outfit ? { ...l, outfit, outfitColor: OUTFIT_DEFAULT_COLOR[outfit] ?? l.outfitColor, accessory: 'none' } : l
  }, [g, seed, outfit, given])
  return (
    <group position={p} rotation={[0, r, 0]} scale={scale}>
      <NoShadows>
        <Human look={look} gender={g} pose={pose} seed={seed} />
      </NoShadows>
    </group>
  )
}

/** The gbairai: two of them at the Sim's sides, turned to it, one laughing, one telling theirs back (in its frame). */
export function Gossip() {
  return (
    <>
      <Person p={[-0.85, 0, -0.05]} r={Math.atan2(0.85, 0.05)} pose="laugh" g="femme" seed={171} />
      <Person p={[0.85, 0, -0.05]} r={Math.atan2(-0.85, 0.05)} pose="talk" g="femme" seed={172} />
    </>
  )
}

/** A word painted on a little board (the price on the slate, the slide on the screen). */
function useLabel(text: string, bg: string, fg: string, w = 256, h = 128) {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const x = c.getContext('2d')!
    x.fillStyle = bg
    x.fillRect(0, 0, w, h)
    x.fillStyle = fg
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    x.font = `800 ${h * 0.42}px sans-serif`
    const k = Math.min(1, (w * 0.9) / x.measureText(text).width)
    x.font = `800 ${h * 0.42 * k}px sans-serif`
    x.fillText(text, w / 2, h / 2)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshBasicMaterial({ map: t })
  }, [text, bg, fg, w, h])
}

/* ---------- At a counter: the mairie, the commissariat, the pharmacy, the gym's desk ---------- */


export type Papers = 'register' | 'stamp' | 'form' | 'typing' | 'map' | 'signup' | 'boxes' | 'advice'

/**
 * What's on the counter: the état-civil's big register being written in,
 * the légalisation's stamp coming down on each copy, the declaration filled
 * in line by line, the plainte typed out, the map of the quartier with the
 * way traced on it, the gym's form and its card slid across, the pharmacy's
 * prescription and the boxes put down one by one, the box shown and turned.
 */
export function Counter({ kind, top }: { kind: Papers; /** The counter top's height (the spots stand ~0.8 m from its middle). */ top: number }) {
  const moving = useRef<THREE.Group>(null)
  const lines = useRef<THREE.Group>(null)
  const items = useRef<THREE.Group>(null)
  useFrame(() => {
    const t = worldTime()
    const m = moving.current
    if (m) {
      if (kind === 'register') m.position.set(-0.05 + ((t * 0.12) % 0.22), 0.06 + Math.abs(Math.sin(t * 9)) * 0.01, -0.12 + (Math.floor(t * 0.55) % 5) * 0.03)
      if (kind === 'stamp') {
        // Up, a pause, down hard on the paper: thump.
        const k = (t * 0.8) % 1
        m.position.set(0.08, 0.05 + (k < 0.7 ? 0.16 : k < 0.8 ? 0.16 * (1 - (k - 0.7) / 0.1) : 0), -0.05)
      }
      if (kind === 'form') m.position.set(-0.08 + ((t * 0.2) % 0.16), 0.03, -0.06 + (Math.floor(t * 1.2) % 6) * 0.025)
      if (kind === 'typing') m.position.x = 0.12 - ((t * 0.08) % 0.24)
      if (kind === 'map') m.position.set(Math.sin(t * 0.6) * 0.14, 0.04, Math.cos(t * 0.45) * 0.08 - 0.02)
      if (kind === 'signup') m.position.z = 0.12 - Math.min(1, ((t * 0.15) % 1) * 2) * 0.32
      if (kind === 'advice') {
        m.rotation.y = t * 0.8
        m.position.y = 0.22 + Math.sin(t * 1.2) * 0.03
      }
    }
    // The lines written so far (the declaration), the boxes put down so far (the pharmacy).
    if (lines.current) lines.current.children.forEach((l, i) => (l.visible = i < (Math.floor(t * 1.2) % 7)))
    if (items.current) items.current.children.forEach((b, i) => (b.visible = i < (Math.floor(t * 0.5) % 6)))
  })
  return (
    <group position={[0, top, 0.62]}>
      {kind === 'register' && (
        <>
          {/* The register open, its two pages, the stamp of the mairie on the side */}
          <Box p={[-0.13, 0.02, -0.05]} s={[0.26, 0.03, 0.34]} c="#f4ecd8" />
          <Box p={[0.13, 0.02, -0.05]} s={[0.26, 0.03, 0.34]} c="#f8f1e0" />
          <Box p={[0, 0.012, -0.05]} s={[0.56, 0.02, 0.38]} c="#7a1f2b" />
          {[...Array(6)].map((_, i) => (
            <Box key={i} p={[0.13, 0.037, -0.17 + i * 0.045]} s={[0.2, 0.004, 0.008]} c="#5a5f6a" />
          ))}
          <group ref={moving}>
            <Box p={[0, 0, 0]} s={[0.012, 0.012, 0.14]} c="#1d4ed8" />
          </group>
          <Box p={[0.38, 0.04, 0.05]} s={[0.21, 0.01, 0.15]} c="#ffffff" />
        </>
      )}
      {kind === 'stamp' && (
        <>
          {/* The copies, the ink pad, the stamp; the ones done in a pile */}
          <Box p={[0.05, 0.01, -0.05]} s={[0.21, 0.01, 0.29]} c="#ffffff" />
          <Box p={[0.05, 0.016, 0.02]} s={[0.06, 0.004, 0.06]} c="#3b5bdb" />
          <Box p={[-0.28, 0.025, -0.05]} s={[0.21, 0.05, 0.29]} c="#f1f3f5" />
          <Box p={[0.32, 0.015, 0.05]} s={[0.12, 0.02, 0.08]} c="#1c2a6b" />
          <group ref={moving}>
            <Box p={[0, 0.02, 0]} s={[0.07, 0.03, 0.05]} c="#3a3f4b" />
            <Box p={[0, 0.08, 0]} s={[0.03, 0.09, 0.03]} c="#8a5a32" />
            <Box p={[0, 0.13, 0]} s={[0.05, 0.03, 0.05]} c="#8a5a32" />
          </group>
        </>
      )}
      {(kind === 'form' || kind === 'typing') && (
        <>
          <Box p={[0, 0.006, -0.02]} s={[0.21, 0.01, 0.29]} c="#ffffff" />
          <group ref={kind === 'form' ? lines : undefined}>
            {[...Array(6)].map((_, i) => (
              <Box key={i} p={[0, 0.013, -0.1 + i * 0.03]} s={[0.15, 0.003, 0.008]} c="#495057" />
            ))}
          </group>
          {/* The card one shows: the ID, the one lost has no more */}
          <Box p={[-0.24, 0.01, 0.06]} s={[0.085, 0.006, 0.055]} c="#f08c00" />
          {kind === 'form' && (
            <group ref={moving}>
              <Box p={[0, 0, 0]} s={[0.012, 0.012, 0.13]} c="#1d4ed8" />
            </group>
          )}
          {kind === 'typing' && (
            // The old typewriter of the commissariat, the paper going along, the keys clattering.
            <group position={[0.05, 0, -0.25]}>
              <Box p={[0, 0.05, 0]} s={[0.36, 0.1, 0.24]} c="#2b2f3a" />
              <group ref={moving}>
                <Box p={[0, 0.13, -0.08]} s={[0.4, 0.05, 0.05]} c="#1c1c1e" />
                <Box p={[0, 0.2, -0.08]} s={[0.2, 0.12, 0.005]} c="#ffffff" />
              </group>
              {[...Array(8)].map((_, i) => (
                <Box key={i} p={[-0.13 + i * 0.037, 0.1 + (Math.sin(i * 3.1) > 0.4 ? 0.005 : 0), 0.06]} s={[0.025, 0.012, 0.025]} c="#e9ecef" />
              ))}
            </group>
          )}
        </>
      )}
      {kind === 'map' && (
        <>
          {/* The plan of the commune, its streets, the lagoon; the pen tracing the way */}
          <Box p={[0, 0.006, -0.05]} s={[0.5, 0.01, 0.36]} c="#f3ecd2" />
          <Box p={[0.16, 0.012, -0.12]} s={[0.16, 0.003, 0.12]} c="#74c0fc" />
          {[-0.12, 0, 0.12].map((x) => (
            <Box key={x} p={[x, 0.013, -0.05]} s={[0.012, 0.003, 0.34]} c="#ffffff" />
          ))}
          {[-0.12, 0.04].map((z) => (
            <Box key={z} p={[0, 0.013, z]} s={[0.48, 0.003, 0.012]} c="#ffffff" />
          ))}
          <Box p={[-0.12, 0.016, 0.04]} s={[0.03, 0.006, 0.03]} c="#e03131" />
          <group ref={moving}>
            <Box p={[0, 0, 0]} s={[0.012, 0.012, 0.13]} c="#e03131" />
          </group>
        </>
      )}
      {kind === 'signup' && (
        <>
          <Box p={[-0.15, 0.006, -0.05]} s={[0.21, 0.01, 0.29]} c="#ffffff" />
          <Box p={[-0.15, 0.012, -0.12]} s={[0.15, 0.003, 0.04]} c="#e03131" />
          {/* The member's card, slid across to the Sim; a bottle of water on the side */}
          <group ref={moving} position={[0.15, 0.008, 0]}>
            <Box p={[0, 0, 0]} s={[0.085, 0.006, 0.055]} c="#212529" />
            <Box p={[0.02, 0.004, 0]} s={[0.03, 0.002, 0.04]} c="#e03131" />
          </group>
          <Box p={[0.38, 0.09, -0.1]} s={[0.06, 0.18, 0.06]} c="#a5d8ff" />
        </>
      )}
      {kind === 'boxes' && (
        <>
          <Box p={[-0.22, 0.006, 0.05]} s={[0.15, 0.01, 0.21]} c="#ffffff" />
          <group ref={items}>
            {[[0.02, -0.05, '#4dabf7'], [0.12, -0.04, '#ff8787'], [0.05, 0.06, '#ffffff'], [0.15, 0.07, '#69db7c'], [0.09, 0.0, '#ffd43b']].map(([x, z, c], i) => (
              <Box key={i} p={[x as number, 0.04 + (i % 2) * 0.005, z as number]} s={[0.08, 0.07 - (i % 3) * 0.01, 0.11]} c={c as string} />
            ))}
          </group>
          {/* The bag with its green cross, waiting for them */}
          <Box p={[0.38, 0.12, 0]} s={[0.2, 0.24, 0.1]} c="#ffffff" />
          <Box p={[0.38, 0.14, 0.051]} s={[0.06, 0.02, 0.002]} c="#2f9e44" />
          <Box p={[0.38, 0.14, 0.051]} s={[0.02, 0.06, 0.002]} c="#2f9e44" />
        </>
      )}
      {kind === 'advice' && (
        <>
          {/* The box shown and turned, how to take it written on the leaflet */}
          <group ref={moving} position={[0, 0.22, 0.12]}>
            <Box p={[0, 0, 0]} s={[0.12, 0.08, 0.05]} c="#4dabf7" />
            <Box p={[0, 0, 0.026]} s={[0.08, 0.02, 0.002]} c="#ffffff" />
          </group>
          <Box p={[-0.2, 0.006, 0.02]} s={[0.15, 0.01, 0.21]} c="#fff9db" />
        </>
      )}
    </group>
  )
}

/* ---------- At the market ---------- */

const PRODUCE = ['#e03131', '#f08c00', '#2f9e44', '#ffd43b', '#862e9c', '#e8590c']

/**
 * Doing the market: the basket on the arm filling up as the seller behind
 * her stall hands over a tomato, an onion…; haggling, the price on her slate
 * coming down as they talk; selling, the Sim's own heaps on the table and
 * a customer in front of it.
 */
export function Market({ how }: { how: 'buy' | 'bargain' | 'sell' }) {
  const handed = useRef<THREE.Group>(null)
  const basket = useRef<THREE.Group>(null)
  const prices = [useLabel('1 500 F', '#2b2f3a', '#ffffff'), useLabel('1 000 F', '#2b2f3a', '#ffffff'), useLabel('750 F', '#2b2f3a', '#ffd43b')]
  const slate = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const t = worldTime()
    // From the seller's hand into the basket, an arc, every few seconds.
    const k = (t * 0.33) % 1
    if (handed.current) {
      const e = Math.min(1, k / 0.4)
      handed.current.visible = k < 0.4
      handed.current.position.set(-0.25 * e, 1.15 - e * 0.35 + Math.sin(e * Math.PI) * 0.25, 1.45 - e * 1.2)
    }
    if (basket.current) basket.current.children.forEach((c, i) => (c.visible = i < 1 + (Math.floor(t * 0.33) % 6)))
    if (slate.current) slate.current.material = prices[Math.floor(t / 3.5) % 3]
  })
  if (how === 'sell')
    return (
      <group>
        {/* Behind the Sim's own stall: the scale, the tin of coins, a customer pointing at the tomatoes */}
        <group position={[0.55, 1.0, 0.75]}>
          <Box p={[0, 0.04, 0]} s={[0.2, 0.08, 0.14]} c="#c92a2a" />
          <Box p={[0, 0.1, 0]} s={[0.22, 0.02, 0.18]} c="#c3c7cf" />
        </group>
        <Box p={[-0.6, 1.05, 0.7]} s={[0.18, 0.1, 0.14]} c="#5c7cfa" />
        <Person p={[0.15, 0, 1.95]} r={Math.PI} pose="talk" g="femme" seed={61} />
      </group>
    )
  return (
    <group>
      {/* The seller behind her stall, facing the Sim */}
      <Person p={[0, 0, 1.85]} r={Math.PI} pose={how === 'bargain' ? 'rant' : 'busy'} g="femme" seed={43} />
      {how === 'bargain' ? (
        // Her slate, the price going down.
        <group position={[0.55, 1.3, 1.2]} rotation={[0, Math.PI, 0]}>
          <Box p={[0, 0, -0.01]} s={[0.36, 0.22, 0.02]} c="#8a5a32" />
          <mesh ref={slate} position={[0, 0, 0.002]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[0.32, 0.18]} />
          </mesh>
        </group>
      ) : (
        <group ref={handed}>
          <mesh>
            <sphereGeometry args={[0.05, 8, 6]} />
            <meshLambertMaterial color="#e03131" />
          </mesh>
        </group>
      )}
      {/* The basket at the Sim's side, filling up */}
      <group position={[-0.32, 0.55, 0.15]}>
        <Box p={[0, 0, 0]} s={[0.36, 0.22, 0.26]} c="#c08a3e" />
        <Box p={[0, 0.2, 0]} s={[0.03, 0.2, 0.03]} c="#8a5a32" />
        <group ref={basket}>
          {[[-0.1, -0.05], [0.08, 0.05], [0.02, -0.06], [-0.08, 0.07], [0.11, -0.04], [0, 0.02]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.13, z]}>
              <sphereGeometry args={[0.05, 8, 6]} />
              <meshLambertMaterial color={PRODUCE[i]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}

/* ---------- The culture hall, the cinema ---------- */

/**
 * The show on the stage (3.2 m in front of the seat, 0.55 up): the dancers
 * in their pagnes, the djembé, the spotlights sweeping over them.
 */
export function Show() {
  const beams = useRef<THREE.Group>(null)
  useFrame(() => {
    const t = worldTime()
    beams.current?.children.forEach((b, i) => (b.rotation.z = Math.sin(t * 0.7 + i * 2) * 0.35))
  })
  return (
    <group position={[0.6, 0.55, 3.2]} rotation={[0, Math.PI, 0]}>
      <Person p={[-1.4, 0, 0.1]} r={0.3} pose="dance" g="femme" seed={71} outfit="pagne" />
      <Person p={[1.3, 0, 0]} r={-0.3} pose="dance" g="femme" seed={73} outfit="pagne" />
      <Person p={[2.3, 0, -0.4]} r={-0.5} pose="busy" g="homme" seed={79} />
      {/* The djembé in front of the drummer */}
      <mesh position={[2.3, 0.3, 0.05]}>
        <cylinderGeometry args={[0.17, 0.11, 0.6, 12]} />
        <meshLambertMaterial color="#8a4b2a" />
      </mesh>
      <group ref={beams} position={[0, 2.6, 0.6]}>
        {['#ffd43b', '#ff6b9a', '#74c0fc'].map((c, i) => (
          <group key={c} position={[-1.4 + i * 1.4, 0, 0]}>
            <mesh position={[0, -1.3, 0]}>
              <coneGeometry args={[0.55, 2.6, 16, 1, true]} />
              <meshBasicMaterial color={c} transparent opacity={0.16} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

/** The exhibition: the paintings on the wall in front, a mask on its plinth, another visitor looking; the Sim takes its photo. */
export function Gallery() {
  const paintings: [number, number, number, number, string, string][] = [
    [-1.3, 1.6, 0.7, 0.9, '#e8590c', '#1f6fb5'],
    [0, 1.7, 1.1, 0.8, '#2b8a3e', '#ffd43b'],
    [1.3, 1.55, 0.6, 0.8, '#7b2d26', '#f4efe6'],
  ]
  return (
    <group>
      {paintings.map(([x, y, w, h, a, b], i) => (
        <group key={i} position={[x, y, 1.55]}>
          <Box p={[0, 0, 0]} s={[w + 0.08, h + 0.08, 0.04]} c="#c9a227" />
          <Box p={[0, 0, -0.025]} s={[w, h, 0.02]} c={a} />
          <Box p={[w * 0.15, -h * 0.1, -0.04]} s={[w * 0.45, h * 0.5, 0.01]} c={b} />
        </group>
      ))}
      {/* A Baoulé mask on its plinth */}
      <group position={[1.1, 0, 0.6]}>
        <Box p={[0, 0.5, 0]} s={[0.4, 1, 0.4]} c="#f8f9fa" />
        <Box p={[0, 1.22, 0]} s={[0.18, 0.4, 0.08]} c="#5c3d22" />
        <Box p={[0, 1.28, 0.045]} s={[0.12, 0.03, 0.01]} c="#2b1a0e" />
      </group>
      <Person p={[-1.2, 0, 0.7]} r={0.4} pose="idle" g="homme" seed={83} />
    </group>
  )
}

/** At the cinema with the pop-corn: the box on the lap, the soda in the armrest; the film's light on the faces. */
export function Cinema({ popcorn }: { popcorn: boolean }) {
  const light = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const t = worldTime()
    if (light.current) light.current.intensity = 2.5 + Math.sin(t * 3.1) * 0.8 + Math.sin(t * 7.3) * 0.5
  })
  return (
    <group>
      <pointLight ref={light} position={[0, 1.6, 2.2]} distance={6} decay={2} color="#cfe3ff" />
      {popcorn && (
        <>
          <group position={[0, 0.6, 0.28]}>
            <Box p={[0, 0, 0]} s={[0.16, 0.2, 0.12]} c="#e03131" />
            <Box p={[0, 0, 0.061]} s={[0.04, 0.2, 0.002]} c="#ffffff" />
            {[[-0.04, 0], [0.03, 0.02], [0, -0.03], [0.05, -0.02]].map(([x, z], i) => (
              <Box key={i} p={[x, 0.12, z]} s={[0.05, 0.05, 0.05]} c="#fff3bf" />
            ))}
          </group>
          <Box p={[0.32, 0.62, 0.1]} s={[0.08, 0.16, 0.08]} c="#1c7ed6" />
          <Box p={[0.33, 0.74, 0.1]} s={[0.012, 0.1, 0.012]} c="#ffffff" />
        </>
      )}
    </group>
  )
}

/* ---------- School, university, office ---------- */

/** On the desk: the books of the library, piled and open; the exam sheet and the clock; the newspaper of the ads. */
export function Desk({ what }: { what: 'books' | 'exam' | 'paper' }) {
  const hand = useRef<THREE.Group>(null)
  useFrame(() => {
    if (hand.current) hand.current.rotation.z = -worldTime() * 0.4
  })
  return (
    <group position={[0, 0.77, 0.52]}>
      {what === 'books' && (
        <>
          <Box p={[-0.13, 0.015, 0]} s={[0.22, 0.02, 0.3]} c="#f8f1e0" />
          <Box p={[0.1, 0.015, 0]} s={[0.22, 0.02, 0.3]} c="#f4ecd8" />
          {['#1f6fb5', '#c92a2a', '#2b8a3e', '#f08c00'].map((c, i) => (
            <Box key={c} p={[0.4, 0.025 + i * 0.05, -0.02 + (i % 2) * 0.02]} s={[0.2, 0.045, 0.28]} c={c} />
          ))}
        </>
      )}
      {what === 'exam' && (
        <>
          <Box p={[0, 0.006, 0]} s={[0.21, 0.01, 0.29]} c="#ffffff" />
          <Box p={[0, 0.012, -0.11]} s={[0.17, 0.003, 0.03]} c="#343a40" />
          {[...Array(5)].map((_, i) => (
            <Box key={i} p={[0, 0.012, -0.05 + i * 0.035]} s={[0.15, 0.003, 0.006]} c="#868e96" />
          ))}
          {/* The clock on the corner of the desk, going round */}
          <group position={[0.35, 0.07, -0.1]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 0.02, 16]} />
              <meshLambertMaterial color="#ffffff" />
            </mesh>
            <group ref={hand} position={[0, 0, 0.012]}>
              <Box p={[0, 0.025, 0]} s={[0.006, 0.05, 0.004]} c="#e03131" />
            </group>
          </group>
        </>
      )}
      {what === 'paper' && (
        // Fraternité Matin open at the ads, a page turned up.
        <group rotation={[-0.5, 0, 0]} position={[0, 0.1, -0.05]}>
          <Box p={[-0.17, 0, 0]} s={[0.33, 0.005, 0.42]} c="#f1f3f5" />
          <Box p={[0.17, 0, 0]} s={[0.33, 0.005, 0.42]} c="#e9ecef" />
          {[...Array(6)].map((_, i) => (
            <Box key={i} p={[i < 3 ? -0.17 : 0.17, 0.004, -0.15 + (i % 3) * 0.12]} s={[0.26, 0.002, 0.08]} c="#adb5bd" />
          ))}
        </group>
      )}
    </group>
  )
}

/** The coffee at one's desk, steaming. */
export function Coffee() {
  const puffs = useRef<THREE.Group>(null)
  useFrame(() => {
    const t = worldTime()
    puffs.current?.children.forEach((p, i) => {
      const k = (t * 0.5 + i / 3) % 1
      p.position.set(Math.sin(i * 2 + t) * 0.02, 0.12 + k * 0.25, 0)
      p.scale.setScalar(0.03 + k * 0.05)
    })
  })
  return (
    <group position={[0.12, 0.77, 0.45]}>
      <Box p={[0, 0.05, 0]} s={[0.08, 0.1, 0.08]} c="#ffffff" />
      <Box p={[0, 0.098, 0]} s={[0.065, 0.005, 0.065]} c="#5c3317" />
      <Box p={[0.055, 0.05, 0]} s={[0.03, 0.05, 0.015]} c="#ffffff" />
      <group ref={puffs}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={BOX}>
            <meshBasicMaterial color="#ffffff" transparent opacity={0.3} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/**
 * The talk: its slide on the board at the front (the one speaking is the
 * room's own, there already).
 */
export function Conference({ at }: { at: [number, number, number] }) {
  const slide = useLabel('CONFÉRENCE', '#1c3a6b', '#ffffff', 512, 256)
  return (
    <group position={at} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, 0, 0.05]} material={slide}>
        <planeGeometry args={[2.4, 1.2]} />
      </mesh>
    </group>
  )
}

/* ---------- The hospital ---------- */

/** The doctor at the bed, in her blouse, the stethoscope on the chest: from the lying Sim's frame, back up. */
export function Doctor() {
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <Person p={[0.75, -0.62, -1.1]} r={-Math.PI / 2} pose="busy" g="femme" seed={91} outfit="blouse" />
    </group>
  )
}

/** Visiting a patient: the bouquet and the basket of fruit on the bedside table. */
export function Visit() {
  return (
    <group position={[-0.75, 0, 0.3]}>
      <Box p={[0, 0.3, 0]} s={[0.45, 0.6, 0.4]} c="#dee2e6" />
      <Box p={[-0.08, 0.7, 0]} s={[0.08, 0.2, 0.08]} c="#74c0fc" />
      {['#ff6b9a', '#ffd43b', '#ff8787'].map((c, i) => (
        <mesh key={c} position={[-0.08 + (i - 1) * 0.05, 0.86 + (i % 2) * 0.04, 0]}>
          <sphereGeometry args={[0.04, 8, 6]} />
          <meshLambertMaterial color={c} />
        </mesh>
      ))}
      <Box p={[0.11, 0.65, 0.02]} s={[0.18, 0.1, 0.14]} c="#c08a3e" />
      {['#f08c00', '#ffd43b', '#2f9e44'].map((c, i) => (
        <mesh key={c} position={[0.06 + i * 0.05, 0.73, 0.02]}>
          <sphereGeometry args={[0.035, 8, 6]} />
          <meshLambertMaterial color={c} />
        </mesh>
      ))}
    </group>
  )
}

/* ---------- The hairdresser, the tailor, the manicure ---------- */

/** The manicure: the little table with the bottles of varnish, the one doing the nails on her stool beside, the file going. */
export function Manicure() {
  const file = useRef<THREE.Mesh>(null)
  useFrame(() => {
    if (file.current) file.current.position.x = 0.32 + Math.sin(worldTime() * 8) * 0.03
  })
  return (
    <group>
      <Box p={[0.5, 0.55, 0.32]} s={[0.4, 0.04, 0.35]} c="#ffffff" />
      <Box p={[0.5, 0.27, 0.32]} s={[0.05, 0.54, 0.05]} c="#adb5bd" />
      {['#c2255c', '#e64980', '#862e9c', '#ffd8a8'].map((c, i) => (
        <Box key={c} p={[0.38 + i * 0.08, 0.61, 0.42]} s={[0.035, 0.08, 0.035]} c={c} />
      ))}
      <mesh ref={file} position={[0.32, 0.6, 0.25]}>
        <boxGeometry args={[0.1, 0.008, 0.02]} />
        <meshLambertMaterial color="#f8f9fa" />
      </mesh>
      <Box p={[1.0, 0.22, 0.3]} s={[0.4, 0.44, 0.4]} c="#c2255c" />
      <Person p={[1.0, 0.06, 0.3]} r={-Math.PI / 2} pose="eat" g="femme" seed={97} />
    </group>
  )
}

/** The fitting at the tailor's: the master on one knee, pinning the hem, the mirror beside. */
export function Fitting() {
  const pin = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const t = worldTime()
    if (pin.current) pin.current.position.set(Math.sin(t * 0.8) * 0.2, 0.55 + Math.abs(Math.sin(t * 3)) * 0.04, 0.2)
  })
  return (
    <group>
      <Person p={[0, 0, 0.62]} r={Math.PI} pose="pray" g="homme" seed={101} />
      <mesh ref={pin}>
        <boxGeometry args={[0.012, 0.05, 0.012]} />
        <meshLambertMaterial color="#c3c7cf" />
      </mesh>
      {/* The tape round the master's neck, the mirror on its stand */}
      <group position={[-1.0, 0, 0.3]} rotation={[0, 0.6, 0]}>
        <Box p={[0, 0.95, 0]} s={[0.6, 1.7, 0.05]} c="#8a5a32" />
        <Box p={[0, 0.95, 0.03]} s={[0.5, 1.6, 0.01]} c="#cfe8ff" />
      </group>
    </group>
  )
}

/** How the hair is done, by the style: the tool and how it goes over the head. */
type Move = { tool: 'clippers' | 'razor' | 'scissors' | 'comb' | 'needle'; at: [number, number, number]; sweep: [number, number, number]; speed: number }
const MOVES: Record<string, Move> = {
  degrade: { tool: 'clippers', at: [0, 1.18, -0.17], sweep: [0.12, 0.05, 0.05], speed: 1.3 },
  'boule-a-zero': { tool: 'clippers', at: [0, 1.28, -0.14], sweep: [0.12, 0.06, 0.1], speed: 0.9 },
  'coupe-courte': { tool: 'scissors', at: [0.04, 1.3, -0.1], sweep: [0.08, 0.02, 0.06], speed: 1.8 },
  iroquoise: { tool: 'clippers', at: [0.11, 1.22, -0.12], sweep: [0.01, 0.06, 0.09], speed: 1.1 },
  'taille-barbe': { tool: 'razor', at: [0.09, 1.07, 0.08], sweep: [0.02, 0.05, 0.03], speed: 1.6 },
  tresses: { tool: 'comb', at: [0.05, 1.22, -0.2], sweep: [0.03, 0.015, 0.01], speed: 6 },
  nattes: { tool: 'comb', at: [-0.05, 1.25, -0.18], sweep: [0.06, 0.01, 0.01], speed: 5 },
  vanilles: { tool: 'comb', at: [0.08, 1.2, -0.18], sweep: [0.02, 0.03, 0.01], speed: 7 },
  macarons: { tool: 'comb', at: [0.12, 1.24, -0.12], sweep: [0.03, 0.03, 0.02], speed: 4 },
  tissage: { tool: 'needle', at: [0, 1.24, -0.2], sweep: [0.1, 0.04, 0.02], speed: 2.2 },
  chignon: { tool: 'comb', at: [0, 1.33, -0.16], sweep: [0.05, 0.04, 0.02], speed: 2.5 },
  carre: { tool: 'scissors', at: [0.12, 1.1, -0.05], sweep: [0.02, 0.01, 0.1], speed: 1.7 },
}
const TOOL: Record<Move['tool'], { s: [number, number, number]; c: string }> = {
  clippers: { s: [0.05, 0.035, 0.1], c: '#1d1d1f' },
  razor: { s: [0.015, 0.02, 0.09], c: '#c3c7cf' },
  scissors: { s: [0.02, 0.012, 0.11], c: '#adb5bd' },
  comb: { s: [0.03, 0.12, 0.012], c: '#141416' },
  needle: { s: [0.008, 0.008, 0.09], c: '#c3c7cf' },
}

/** The hairdresser's hand, its tool, going over the head the way the style is done. */
export function HairMoves({ id }: { id: string }) {
  const m = MOVES[id] ?? MOVES.degrade
  const tool = useRef<THREE.Group>(null)
  useFrame(() => {
    const t = worldTime() * m.speed
    const k = Math.sin(t * 3.1)
    tool.current?.position.set(m.at[0] + Math.sin(t) * m.sweep[0], m.at[1] + Math.abs(k) * m.sweep[1], m.at[2] + Math.sin(t * 0.7) * m.sweep[2])
    // The scissors snip.
    if (tool.current && m.tool === 'scissors') tool.current.rotation.y = Math.abs(Math.sin(t * 9)) * 0.4
  })
  return (
    <group ref={tool}>
      <Box p={[0, 0, 0]} s={TOOL[m.tool].s} c={TOOL[m.tool].c} />
      {m.tool === 'needle' && <Box p={[0, -0.04, 0.04]} s={[0.003, 0.08, 0.003]} c="#141416" />}
    </group>
  )
}

/* ---------- Celebrations ---------- */

/** The birthday: balloons tied to the chair, swaying. */
export function Balloons() {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const t = worldTime()
    g.current?.children.forEach((b, i) => (b.rotation.z = Math.sin(t * 0.9 + i) * 0.12))
  })
  return (
    <group ref={g} position={[0.35, 0.5, -0.2]}>
      {['#ff6b9a', '#ffd43b', '#4dabf7'].map((c, i) => (
        <group key={c} rotation={[0, i * 2.1, 0]}>
          <Box p={[0.05 * i, 0.55, 0]} s={[0.005, 1.1, 0.005]} c="#ffffff" />
          <mesh position={[0.05 * i, 1.2 + i * 0.08, 0]}>
            <sphereGeometry args={[0.13, 12, 10]} />
            <meshLambertMaterial color={c} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** The civil wedding: the one marrying beside the Sim, the mayor in the sash across the counter, the rice and petals falling. */
export function Wedding({ spouse }: { spouse?: { look: Look; gender: 'femme' | 'homme' } }) {
  const fall = useRef<THREE.InstancedMesh>(null)
  const o = useMemo(() => new THREE.Object3D(), [])
  const N = 40
  useFrame(() => {
    const t = worldTime()
    if (!fall.current) return
    for (let i = 0; i < N; i++) {
      const k = (t * 0.25 + i / N) % 1
      o.position.set(Math.sin(i * 7.1) * 1.1 + 0.35, 2.6 - k * 2.6, Math.sin(i * 3.7) * 0.6 - 0.2)
      o.rotation.set(t * 2 + i, t + i, 0)
      o.scale.setScalar(0.035)
      o.updateMatrix()
      fall.current.setMatrixAt(i, o.matrix)
    }
    fall.current.instanceMatrix.needsUpdate = true
  })
  return (
    <group>
      {spouse ? <Person p={[0.62, 0, 0]} pose="cheer" g={spouse.gender} seed={7} look={spouse.look} /> : <Person p={[0.62, 0, 0]} pose="cheer" g="homme" seed={107} />}
      {/* The sash on the mayor across the counter, in the colours */}
      <group position={[0, 0, 1.45]} rotation={[0, Math.PI, 0]}>
        <Person p={[0, 0, 0]} pose="talk" g="homme" seed={109} />
        {['#f08c00', '#ffffff', '#2f9e44'].map((c, i) => (
          <Box key={c} p={[-0.06 + i * 0.06, 1.3 - i * 0.06, 0.13]} s={[0.06, 0.5, 0.01]} c={c} r={0} />
        ))}
      </group>
      <instancedMesh ref={fall} args={[BOX, undefined, N]} frustumCulled={false}>
        <meshLambertMaterial color="#ffe3ee" />
      </instancedMesh>
    </group>
  )
}

/* ---------- The baby, the child ---------- */

/** The mother kneeling by her baby: holding the biberon, feeding the bouillie, washing, cuddling, shaking the rattle with it. */
export function Mother({ doing }: { doing: 'biberon' | 'bouillie' | 'bain' | 'calin' | 'hochet' }) {
  const spoon = useRef<THREE.Group>(null)
  const rattle = useRef<THREE.Group>(null)
  const hearts = useRef<THREE.Group>(null)
  const heart = useHeart()
  useFrame(() => {
    const t = worldTime()
    if (spoon.current) {
      // From the bowl to the baby's mouth and back.
      const k = (Math.sin(t * 1.6) + 1) / 2
      spoon.current.position.set(0, 0.42 + k * 0.05, 0.42 - k * 0.3)
    }
    if (rattle.current) {
      rattle.current.rotation.z = Math.sin(t * 14) * 0.5
      rattle.current.position.y = 0.36 + Math.sin(t * 3) * 0.04
    }
    hearts.current?.children.forEach((h, i) => {
      const k = (t * 0.4 + i / 3) % 1
      h.position.set(Math.sin(k * 6 + i) * 0.12, 0.6 + k * 0.9, 0.2)
      h.scale.setScalar(0.1 + k * 0.12)
      ;((h as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1 - k
    })
  })
  return (
    <group>
      <Person p={[0, 0, 0.75]} r={Math.PI} pose={doing === 'calin' ? 'hug' : 'pray'} g="femme" seed={113} />
      {doing === 'biberon' && (
        <group position={[0, 0.42, 0.17]} rotation={[-1.0, 0, 0]}>
          <Box p={[0, 0, 0]} s={[0.06, 0.16, 0.06]} c="#f8f9fa" />
          <Box p={[0, -0.03, 0]} s={[0.055, 0.08, 0.055]} c="#fff9db" />
          <Box p={[0, 0.1, 0]} s={[0.03, 0.04, 0.03]} c="#ffc078" />
        </group>
      )}
      {doing === 'bouillie' && (
        <>
          <Box p={[0.15, 0.48, 0.45]} s={[0.14, 0.06, 0.14]} c="#e9d8a6" />
          <group ref={spoon}>
            <Box p={[0, 0, 0]} s={[0.02, 0.01, 0.12]} c="#c3c7cf" />
          </group>
        </>
      )}
      {doing === 'hochet' && (
        <group ref={rattle} position={[0.1, 0.36, 0.2]}>
          <Box p={[0, 0, 0]} s={[0.02, 0.1, 0.02]} c="#ffd43b" />
          <mesh position={[0, 0.07, 0]}>
            <sphereGeometry args={[0.04, 10, 8]} />
            <meshLambertMaterial color="#ff6b9a" />
          </mesh>
        </group>
      )}
      {doing === 'calin' && (
        <group ref={hearts}>
          {[0, 1, 2].map((i) => (
            <mesh key={i}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial map={heart} transparent depthWrite={false} />
            </mesh>
          ))}
        </group>
      )}
      {doing === 'bain' && (
        // The basin round the baby, the water, the bubbles.
        <group>
          <Box p={[0, 0.14, 0]} s={[0.7, 0.28, 0.6]} c="#f08c00" />
          <Box p={[0, 0.27, 0]} s={[0.62, 0.03, 0.52]} c="#9fd8ff" />
          {[[-0.2, 0.12], [0.18, -0.15], [0.22, 0.14], [-0.15, -0.16]].map(([x, z], i) => (
            <Box key={i} p={[x, 0.31, z]} s={[0.07, 0.06, 0.07]} c="#ffffff" />
          ))}
        </group>
      )}
    </group>
  )
}

function useHeart() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 16
    const x = c.getContext('2d')!
    x.fillStyle = '#ff4d79'
    for (const [y, a, b] of [[3, 2, 6], [3, 9, 13], [4, 1, 14], [5, 1, 14], [6, 1, 14], [7, 2, 13], [8, 3, 12], [9, 4, 11], [10, 5, 10], [11, 6, 9], [12, 7, 8]]) x.fillRect(a, y, b - a + 1, 1)
    const t = new THREE.CanvasTexture(c)
    t.magFilter = THREE.NearestFilter
    return t
  }, [])
}

/** Playing in the yard: the ball kept up off the foot, a friend from the cour waiting for it. Sized for the child. */
export function YardBall({ scale }: { scale: number }) {
  const ball = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const k = (worldTime() * 1.4) % 1
    ball.current?.position.set(0.08, 0.35 + Math.sin(k * Math.PI) * 0.45, 0.32)
  })
  return (
    <group scale={scale}>
      <mesh ref={ball}>
        <sphereGeometry args={[0.13, 12, 10]} />
        <meshLambertMaterial color="#f4f4f4" />
      </mesh>
      <Person p={[0.4, 0, 1.6]} r={Math.PI + 0.3} pose="cheer" g="homme" seed={127} />
    </group>
  )
}

/** Off to school: the bag on the back, the water bottle at its side. Sized for the child. */
export function SchoolBag({ scale }: { scale: number }) {
  return (
    <group scale={scale}>
      <Box p={[0, 1.08, -0.2]} s={[0.36, 0.42, 0.16]} c="#1f6fb5" />
      <Box p={[0, 1.0, -0.29]} s={[0.26, 0.18, 0.03]} c="#ffd43b" />
      <Box p={[0.21, 0.98, -0.18]} s={[0.07, 0.18, 0.07]} c="#e03131" />
    </group>
  )
}

/* ---------- The hotel room ---------- */

export type Tray = 'petitdej' | 'club' | 'poisson' | 'glace' | 'cocktail'

/** Room service, on the desk: the tray, the silver cloche lifted beside it, and what was ordered on the plate. */
export function RoomService({ what }: { what: Tray }) {
  return (
    <group position={[0, 0.79, 0.5]}>
      <Box p={[0, 0.01, 0]} s={[0.56, 0.02, 0.36]} c="#c9c9c9" />
      <Box p={[0, 0.03, 0]} s={[0.3, 0.02, 0.26]} c="#ffffff" />
      <group position={[0.38, 0, -0.05]}>
        <mesh position={[0, 0.02, 0]}>
          <sphereGeometry args={[0.12, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshLambertMaterial color="#dee2e6" />
        </mesh>
      </group>
      {what === 'petitdej' && (
        <>
          <Box p={[-0.06, 0.06, 0]} s={[0.14, 0.05, 0.07]} c="#d9a35a" />
          <Box p={[0.08, 0.06, 0.05]} s={[0.06, 0.05, 0.06]} c="#fab005" />
          <Box p={[-0.2, 0.07, 0.1]} s={[0.07, 0.1, 0.07]} c="#ffffff" />
          <Box p={[-0.2, 0.118, 0.1]} s={[0.06, 0.005, 0.06]} c="#5c3317" />
          <Box p={[0.2, 0.09, 0.1]} s={[0.06, 0.14, 0.06]} c="#ff922b" />
        </>
      )}
      {what === 'club' && (
        <>
          {[-0.05, 0.05].map((x) => (
            <group key={x} position={[x, 0.07, 0]} rotation={[0, x * 6, 0]}>
              <Box p={[0, 0, 0]} s={[0.09, 0.07, 0.09]} c="#f1e3c8" />
              <Box p={[0, 0, 0]} s={[0.092, 0.02, 0.092]} c="#2f9e44" />
            </group>
          ))}
          {[...Array(5)].map((_, i) => (
            <Box key={i} p={[0.08 + (i % 3) * 0.02, 0.05, -0.07 + i * 0.012]} s={[0.012, 0.012, 0.08]} c="#fcc419" r={i * 0.4} />
          ))}
        </>
      )}
      {what === 'poisson' && (
        <>
          <Box p={[0, 0.06, 0]} s={[0.24, 0.05, 0.09]} c="#7a5230" />
          <Box p={[0.14, 0.06, 0]} s={[0.05, 0.07, 0.03]} c="#5c3d22" />
          <Box p={[-0.04, 0.06, 0.08]} s={[0.12, 0.05, 0.06]} c="#f2e6c9" />
        </>
      )}
      {what === 'glace' && (
        <>
          <Box p={[0, 0.08, 0]} s={[0.05, 0.1, 0.05]} c="#e9ecef" />
          {['#f783ac', '#fff3bf', '#8c5a3c'].map((c, i) => (
            <mesh key={c} position={[-0.03 + i * 0.03, 0.16 + (i % 2) * 0.02, 0]}>
              <sphereGeometry args={[0.04, 10, 8]} />
              <meshLambertMaterial color={c} />
            </mesh>
          ))}
        </>
      )}
      {what === 'cocktail' && <Cocktail p={[0, 0.03, 0]} />}
    </group>
  )
}

/** A cocktail glass: the stem, the cone of orange, the umbrella. */
export function Cocktail({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Box p={[0, 0.005, 0]} s={[0.07, 0.01, 0.07]} c="#e7f5ff" />
      <Box p={[0, 0.06, 0]} s={[0.01, 0.1, 0.01]} c="#e7f5ff" />
      <mesh position={[0, 0.15, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.06, 0.09, 12]} />
        <meshLambertMaterial color="#ff922b" transparent opacity={0.85} />
      </mesh>
      <Box p={[0.03, 0.22, 0]} s={[0.004, 0.1, 0.004]} c="#8a5a32" />
      <mesh position={[0.03, 0.27, 0]}>
        <coneGeometry args={[0.05, 0.03, 8]} />
        <meshLambertMaterial color="#e64980" />
      </mesh>
    </group>
  )
}

/** The bath with its foam, going up and down round the Sim. */
export function Foam() {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const t = worldTime()
    g.current?.children.forEach((b, i) => (b.position.y = 0.56 + Math.sin(t * 1.3 + i * 1.7) * 0.025))
  })
  // Over the water, the length of the tub (it runs the way the Sim faces), up to the rim.
  return (
    <group ref={g}>
      {[[-0.25, 0.55], [0.22, 0.35], [0, 0.7], [-0.3, -0.15], [0.28, -0.3], [0.1, 0.15], [-0.2, -0.55], [0.25, 0.65]].map(([x, z], i) => (
        <Box key={i} p={[x, 0.56, z]} s={[0.2, 0.08, 0.2]} c="#ffffff" />
      ))}
    </group>
  )
}

/* ---------- The casino, the shops ---------- */

/** At the casino's roulette: the wheel spinning, the ball going round it, the Sim's chips, the croupier across. */
export function Roulette() {
  const wheel = useRef<THREE.Group>(null)
  const ball = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const t = worldTime()
    if (wheel.current) wheel.current.rotation.y = t * 1.6
    // The ball slows into its slot, then it's thrown again.
    const k = (t * 0.12) % 1
    const a = -t * 5 * (1 - k * 0.8)
    ball.current?.position.set(1.6 + Math.cos(a) * 0.26, 0.93, 1.35 + Math.sin(a) * 0.26)
  })
  return (
    <group>
      <group ref={wheel} position={[1.6, 0.9, 1.35]}>
        <mesh>
          <cylinderGeometry args={[0.34, 0.36, 0.06, 24]} />
          <meshLambertMaterial color="#5a3a1a" />
        </mesh>
        {[...Array(12)].map((_, i) => (
          <Box key={i} p={[Math.cos((i / 12) * Math.PI * 2) * 0.2, 0.035, Math.sin((i / 12) * Math.PI * 2) * 0.2]} s={[0.08, 0.01, 0.08]} c={i % 2 ? '#c92a2a' : '#141416'} />
        ))}
        <Box p={[0, 0.06, 0]} s={[0.06, 0.06, 0.06]} c="#c9a227" />
      </group>
      <mesh ref={ball}>
        <sphereGeometry args={[0.02, 8, 6]} />
        <meshLambertMaterial color="#ffffff" />
      </mesh>
      {/* The Sim's chips, in piles, on the felt */}
      {[['#e03131', 5], ['#1c7ed6', 3], ['#fab005', 7]].map(([c, n], i) => (
        <group key={i} position={[0.55 + i * 0.12, 0.88, 0.85 + (i % 2) * 0.08]}>
          {[...Array(n as number)].map((_, j) => (
            <mesh key={j} position={[0, j * 0.012, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.01, 12]} />
              <meshLambertMaterial color={c as string} />
            </mesh>
          ))}
        </group>
      ))}
      <Person p={[1.6, 0, 2.55]} r={Math.PI} pose="talk" g="homme" seed={131} outfit="suit" />
    </group>
  )
}

/** Trying clothes on at the boutique: the dress held up against oneself, then the next one. */
export function Clothes() {
  const g = useRef<THREE.Group>(null)
  const colors = ['#2a6cf0', '#f08c00', '#7b5cff', '#2f9e44']
  useFrame(() => {
    const i = Math.floor(worldTime() / 4) % colors.length
    g.current?.children.forEach((c, j) => (c.visible = j === i))
  })
  return (
    <group position={[0.05, 0.75, 0.25]}>
      <Box p={[0, 0.72, 0]} s={[0.3, 0.02, 0.02]} c="#adb5bd" />
      <group ref={g}>
        {colors.map((c) => (
          <group key={c}>
            <Box p={[0, 0.45, 0]} s={[0.4, 0.5, 0.03]} c={c} />
            <Box p={[0, 0.1, 0]} s={[0.5, 0.3, 0.03]} c={c} />
            <Box p={[0, 0.45, 0.017]} s={[0.12, 0.4, 0.003]} c="#ffffff" />
          </group>
        ))}
      </group>
    </group>
  )
}
