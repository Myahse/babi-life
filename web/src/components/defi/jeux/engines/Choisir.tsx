import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../../../lib/native'
import { gesture } from '../../../../world3d/gesture'
import { Box } from '../../../../world3d/props'
import { Prop } from '../props'
import { JeuShell, Stage, scoreOf } from '../Shell'
import type { EngineProps, Item } from '../types'

// Pick the one asked (the garba's bassine, made for every action): the things lie on the decor, someone
// calls one (« Le pagne wax ! »), tap it before another customer's hand takes it. A few rounds.

type Lying = { key: number; item: Item; x: number; z: number; vx: number; vz: number; r: number }

/** Another hand, coming down on the thing: the arm, the palm, the fingers. */
function OtherHand({ x, z }: { x: number; z: number }) {
  const g = useRef<THREE.Group>(null)
  const t = useRef(0)
  useFrame((_, dt) => {
    t.current += dt
    if (g.current) g.current.position.y = Math.max(0.6, 3.2 - t.current * 8)
  })
  return (
    <group ref={g} position={[x, 3.2, z]}>
      <Box p={[0, 0.1, 0]} s={[0.6, 0.18, 0.7]} c="#7b4a2a" />
      {[-0.21, -0.07, 0.07, 0.21].map((dx) => (
        <Box key={dx} p={[dx, 0.06, 0.48]} s={[0.12, 0.12, 0.34]} c="#7b4a2a" />
      ))}
      <Box p={[0, 0.25, -1.1]} s={[0.46, 0.4, 1.6]} c="#3a6fb0" />
    </group>
  )
}

/** A thing lying there, drifting a little, turning: a tap picks it. */
function Thing({ l, onPick }: { l: Lying; onPick: () => void }) {
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    l.x += l.vx * dt
    l.z += l.vz * dt
    if (Math.abs(l.x) > 3) l.vx = -l.vx
    if (Math.abs(l.z) > 2.6) l.vz = -l.vz
    g.current?.position.set(l.x, 0, l.z)
  })
  return (
    <group ref={g} position={[l.x, 0, l.z]} rotation={[0, l.r, 0]} onPointerDown={(e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), onPick())}>
      <Prop id={l.item.prop} />
      {/* A wide hold round it: a finger finds it */}
      <mesh position={[0, 0.4, 0]} visible={false}>
        <boxGeometry args={[1.3, 1, 1.3]} />
      </mesh>
    </group>
  )
}

export function Choisir({ jeu, onEnd }: EngineProps<'choisir'>) {
  const rounds = jeu.rounds ?? 3
  const [round, setRound] = useState(0)
  const [lying, setLying] = useState<Lying[]>([])
  const [want, setWant] = useState<Item>(jeu.items[0])
  const [hand, setHand] = useState<{ x: number; z: number } | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const st = useRef({ got: 0, wrong: 0, key: 0, busy: false })
  // Each round, the things laid out afresh round the decor (two of each when there are few), one called.
  const lay = () => {
    const pool = jeu.items.length < 5 ? [...jeu.items, ...jeu.items] : jeu.items.slice(0, 8)
    const turn = Math.random() * Math.PI * 2
    setLying(
      pool.map((item, i) => {
        const a = turn + (i / pool.length) * Math.PI * 2
        const r = i % 2 ? 2.3 : 1.2
        return { key: st.current.key++, item, x: Math.cos(a) * r, z: Math.sin(a) * r * 0.85, vx: (Math.random() - 0.5) * 0.3, vz: (Math.random() - 0.5) * 0.3, r: Math.random() * 6 }
      }),
    )
    setWant(jeu.items[Math.floor(Math.random() * jeu.items.length)])
    st.current.busy = false
  }
  useEffect(lay, []) // eslint-disable-line react-hooks/exhaustive-deps
  const next = () => {
    if (st.current.busy) return
    st.current.busy = true
    if (round + 1 >= rounds) {
      setTimeout(() => onEnd(scoreOf(st.current.got, rounds, st.current.wrong)), 700)
      return
    }
    setRound(round + 1)
    setTimeout(lay, 600)
  }
  // Another hand comes for the one called: be quicker.
  useEffect(() => {
    const t = setTimeout(
      () => {
        const l = lying.find((q) => q.item.name === want.name)
        if (!l || st.current.busy) return
        setHand({ x: l.x, z: l.z })
        setTimeout(() => setHand(null), 600)
        setSaid('Quelqu’un d’autre l’a pris…')
        setTimeout(() => setSaid(null), 900)
        next()
      },
      3200 - round * 400,
    )
    return () => clearTimeout(t)
  }, [want, round, lying]) // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (l: Lying) => {
    if (st.current.busy) return
    if (l.item.name === want.name) {
      st.current.got++
      haptic('success')
      gesture('busy', 1000)
      setSaid(`${l.item.name} : c’est ça !`)
      setLying((ls) => ls.filter((q) => q.key !== l.key))
      next()
    } else {
      st.current.wrong++
      haptic('error')
      setSaid('Pas celui-là !')
    }
    setTimeout(() => setSaid(null), 900)
  }
  return (
    <JeuShell title={jeu.title} how={jeu.how} status={`${jeu.caller} : « ${want.name} ! » · ${round + 1}/${rounds}`} said={said}>
      <Stage decor={jeu.decor}>
        {lying.map((l) => (
          <Thing key={l.key} l={l} onPick={() => pick(l)} />
        ))}
        {hand && <OtherHand x={hand.x} z={hand.z} />}
      </Stage>
    </JeuShell>
  )
}

/** A game to try it on the lab page (?g=demo:choisir). */
export const demo: Extract<import('../types').Jeu, { engine: 'choisir' }> = {
  engine: 'choisir', title: 'Le bon pagne', how: 'La cliente demande un pagne : touche le bon avant la voisine.', decor: 'etal', caller: 'La cliente',
  items: [{ name: 'Le pagne wax', prop: 'pagne' }, { name: 'La robe', prop: 'robe' }, { name: 'Le boubou', prop: 'boubou' }, { name: 'La chemise', prop: 'chemise' }],
}
