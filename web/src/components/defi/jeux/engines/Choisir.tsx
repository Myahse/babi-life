import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { gesture } from '../../../../world3d/gesture'
import { Box } from '../../../../world3d/props'
import { Prop } from '../props'
import { JeuShell, Stage, scoreOf } from '../Shell'
import { Hand, useHand } from '../hand'
import { juice, snd } from '../juice'
import type { EngineProps, Item } from '../types'
import { t as tr } from '../../../../lib/i18n'

// Pick the one asked (the garba's bassine, made for every action): the things are tipped onto the
// decor (they fall, bounce, settle), someone calls one (« Le pagne wax ! »); touch it and your hand
// goes for it, before the other customer's hand coming down on it (seen coming, its shadow growing).
// A few rounds, the other hand quicker each time.

type Lying = { key: number; item: Item; x: number; z: number; y: number; vy: number; vx: number; vz: number; r: number; tilt: number; gone: boolean; shake: number }

/** Another hand, coming for the thing called: slowly down from above (its shadow growing on the table), then the grab. */
function OtherHand({ rival }: { rival: { current: { l: Lying | null; t0: number; t1: number } } }) {
  const g = useRef<THREE.Group>(null)
  const shadow = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const r = rival.current
    const o = g.current
    if (!o || !shadow.current) return
    const now = performance.now()
    const on = !!r.l && now > r.t0 && now < r.t1 + 650
    o.visible = on
    shadow.current.visible = on
    if (!on || !r.l) return
    const k = Math.min(1, (now - r.t0) / (r.t1 - r.t0))
    // Hovering down slowly, then quick on it at the end.
    const y = now < r.t1 ? 6 - k * k * 3.2 : Math.max(0.55, 2.8 - ((now - r.t1) / 140) * 2.3)
    o.position.set(r.l.x, y, r.l.z)
    shadow.current.position.set(r.l.x, 0.02, r.l.z)
    const s = 0.4 + k * 0.9
    shadow.current.scale.set(s, 1, s)
    ;(shadow.current.material as THREE.MeshBasicMaterial).opacity = 0.12 + k * 0.3
  })
  return (
    <>
      <group ref={g} visible={false}>
        <Box p={[0, 0.1, 0]} s={[0.6, 0.18, 0.7]} c="#7b4a2a" />
        {[-0.21, -0.07, 0.07, 0.21].map((dx) => (
          <Box key={dx} p={[dx, 0.02, 0.48]} s={[0.12, 0.12, 0.34]} c="#7b4a2a" />
        ))}
        <Box p={[0, 0.5, -1.1]} s={[0.46, 0.4, 1.6]} c="#3a6fb0" />
      </group>
      <mesh ref={shadow} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.6, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.2} depthWrite={false} />
      </mesh>
    </>
  )
}

/** A thing tipped out: it falls, bounces, settles, drifts a little; touched, it's taken. */
function Thing({ l, onPick }: { l: Lying; onPick: () => void }) {
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt0) => {
    const dt = juice.dt(Math.min(0.05, dt0))
    const o = g.current
    if (!o) return
    if (l.y > 0 || l.vy > 0) {
      l.vy -= 18 * dt
      l.y += l.vy * dt
      if (l.y <= 0) {
        l.y = 0
        // A bounce, smaller each time, then still.
        l.vy = l.vy < -2 ? -l.vy * 0.32 : 0
        if (l.vy) l.tilt = (Math.random() - 0.5) * 0.4
        else l.tilt *= 0.3
      }
    } else {
      l.x += l.vx * dt
      l.z += l.vz * dt
      if (Math.abs(l.x) > 3) l.vx = -l.vx
      if (Math.abs(l.z) > 2.6) l.vz = -l.vz
    }
    l.shake = Math.max(0, l.shake - dt * 2.5)
    o.visible = !l.gone
    o.position.set(l.x + Math.sin(l.shake * 40) * l.shake * 0.25, l.y + l.shake * 0.4, l.z)
    o.rotation.set(l.tilt, l.r, l.tilt * 0.5)
  })
  return (
    <group ref={g} position={[l.x, l.y, l.z]} onPointerDown={(e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), onPick())}>
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
  const [said, setSaid] = useState<string | null>(null)
  const hand = useHand([2.7, 1.3, 2.7])
  const rival = useRef<{ l: Lying | null; t0: number; t1: number }>({ l: null, t0: 0, t1: 0 })
  const st = useRef({ got: 0, wrong: 0, key: 0, busy: false, called: 0 })
  const say = (s: string) => {
    setSaid(s)
    setTimeout(() => setSaid((v) => (v === s ? null : v)), 900)
  }
  // Each round, the things tipped out afresh round the decor (two of each when there are few), one called.
  const lay = (r: number) => {
    const pool = jeu.items.length < 5 ? [...jeu.items, ...jeu.items] : jeu.items.slice(0, 8)
    const turn = Math.random() * Math.PI * 2
    const ls = pool.map((item, i) => {
      const a = turn + (i / pool.length) * Math.PI * 2
      const rr = i % 2 ? 2.3 : 1.2
      return { key: st.current.key++, item, x: Math.cos(a) * rr, z: Math.sin(a) * rr * 0.85, y: 2.2 + Math.random() * 1.6, vy: 0, vx: (Math.random() - 0.5) * 0.3, vz: (Math.random() - 0.5) * 0.3, r: Math.random() * 6, tilt: 0, gone: false, shake: 0 }
    })
    setLying(ls)
    snd.thud(0.7)
    const w = jeu.items[Math.floor(Math.random() * jeu.items.length)]
    setWant(w)
    // Called once they've landed; the other hand comes after, quicker each round.
    setTimeout(() => {
      juice.say(`« ${w.name} ! »`, [0.5, 0.16], '#ffffff', true)
      st.current.called = performance.now()
      const l = ls.find((q) => q.item.name === w.name) ?? null
      const wait = 2900 - r * 380
      rival.current = { l, t0: performance.now() + wait * 0.35, t1: performance.now() + wait }
      st.current.busy = false
    }, 450)
  }
  useEffect(() => {
    st.current.busy = true
    lay(0)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const next = (r: number) => {
    st.current.busy = true
    rival.current.l = rival.current.t1 > performance.now() ? null : rival.current.l
    if (r + 1 >= rounds) {
      const s = st.current
      setTimeout(() => juice.finish(scoreOf(s.got, rounds, s.wrong), s.got === rounds && !s.wrong ? tr('Plus rapide que tout le monde !') : s.got ? tr('{got} sur {rounds}, bien vu', { got: s.got, rounds }) : tr('Les autres ont été plus rapides…'), onEnd), 450)
      return
    }
    setTimeout(() => {
      setRound(r + 1)
      lay(r + 1)
    }, 550)
  }
  // The other hand gets there first: it's gone.
  useEffect(() => {
    const id = setInterval(() => {
      const rv = rival.current
      if (st.current.busy || !rv.l || performance.now() < rv.t1 + 140) return
      rv.l.gone = true
      setSaid(null)
      juice.bad({ at: [rv.l.x, 0.6, rv.l.z], text: tr('Trop tard !'), soft: true })
      say(tr('Quelqu’un d’autre l’a pris…'))
      next(round)
    }, 50)
    return () => clearInterval(id)
  }, [round]) // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (l: Lying) => {
    const s = st.current
    if (s.busy || l.gone) return
    snd.tap()
    if (l.item.name === want.name) {
      s.got++
      s.busy = true
      const quick = performance.now() - s.called < 1100
      // The hand goes for it, closes on it, brings it back.
      hand.hold(null).close(false).reach([l.x, 0.75, l.z + 0.2], {
        then: () => {
          l.gone = true
          hand.close(true).hold(l.item.prop)
          juice.good({ at: [l.x, 0.6, l.z], text: quick ? tr('Rapide !') : tr('Pris !'), perfect: quick })
          gesture('busy', 1000)
        },
      })
      hand.back(0.3, () => hand.hold(null).close(false))
      rival.current.l = null
      say(tr('{name} : c’est ça !', { name: l.item.name }))
      next(round)
    } else {
      s.wrong++
      l.shake = 1
      hand.reach([l.x, 0.9, l.z + 0.3], { dur: 0.14 }).back(0.22)
      juice.bad({ at: [l.x, 0.7, l.z], text: tr('Pas celui-là !'), soft: true })
    }
  }
  return (
    <JeuShell title={jeu.title} how={jeu.how} goal={tr('Touche ce qu’on appelle, vite !')} status={`${jeu.caller} : « ${want.name} ! » · ${round + 1}/${rounds}`} said={said}>
      <Stage decor={jeu.decor}>
        {lying.map((l) => (
          <Thing key={l.key} l={l} onPick={() => pick(l)} />
        ))}
        <OtherHand rival={rival} />
        <Hand ctl={hand} scale={1.15} />
      </Stage>
    </JeuShell>
  )
}

/** A game to try it on the lab page (?g=demo:choisir). */
export const demo: Extract<import('../types').Jeu, { engine: 'choisir' }> = {
  engine: 'choisir', title: tr('Le bon pagne'), how: tr('La cliente demande un pagne : touche le bon avant la voisine.'), decor: 'etal', caller: tr('La cliente'),
  items: [{ name: tr('Le pagne wax'), prop: 'pagne' }, { name: tr('La robe'), prop: 'robe' }, { name: tr('Le boubou'), prop: 'boubou' }, { name: tr('La chemise'), prop: 'chemise' }],
}
