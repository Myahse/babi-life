import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Gift, PackageOpen, Sparkles, X } from 'lucide-react'
import { api, errorText, type FriendGift, type Parrainage } from '../lib/api'
import type { ActionResult, Sim, World } from '../lib/types'
import { sceneDpr } from '../lib/device'
import { Box } from '../world3d/props'
import { FurnitureSet } from '../world3d/build/Furniture'
import { keyOpen, useFeatures } from '../lib/features'
import { Sheet } from './Sheet'
import { t as tr } from '../lib/i18n'

// The drawer of gifts (backend sims/parrainage.go): what the friends come by
// the player's link brought, wrapped. At home, a chest of drawers in the house
// (GiftChest, in world3d/HomeInside), its gifts on top and a pin when there's
// one; a tap opens the sheet (GiftsSheet), the same list as the phone's
// « Inviter » (InviteApp). Opened, the gift shows in 3D (GiftReveal: the lid
// flies off, the thing comes up) and goes where it belongs.

/** The paper of each gift (its id picks one), and its ribbon. */
const PAPERS: [string, string][] = [
  ['#e8590c', '#ffd43b'],
  ['#2f9e44', '#fff3bf'],
  ['#1c7ed6', '#ffffff'],
  ['#c2255c', '#ffe066'],
  ['#7048e8', '#ffd8a8'],
]
const paper = (id: number) => PAPERS[Math.abs(id) % PAPERS.length]

/** A wrapped box: the paper, the ribbon round it both ways, the bow on top. s: its size. */
export function Wrapped({ p = [0, 0, 0], s = 0.4, id = 0 }: { p?: [number, number, number]; s?: number; id?: number }) {
  const [c, r] = paper(id)
  const h = s * 0.8
  return (
    <group position={p}>
      <Box p={[0, h / 2, 0]} s={[s, h, s]} c={c} />
      <Box p={[0, h / 2, 0]} s={[s * 1.02, h * 1.01, s * 0.16]} c={r} />
      <Box p={[0, h / 2, 0]} s={[s * 0.16, h * 1.01, s * 1.02]} c={r} />
      <Box p={[-s * 0.13, h + s * 0.07, 0]} s={[s * 0.24, s * 0.14, s * 0.12]} c={r} r={0.5} />
      <Box p={[s * 0.13, h + s * 0.07, 0]} s={[s * 0.24, s * 0.14, s * 0.12]} c={r} r={-0.5} />
    </group>
  )
}

/** The chest of drawers, facing +z: its three drawers, the gifts on top (as many as wait, three at most). */
export function GiftChest({ count, onOpen }: { count: number; onOpen: () => void }) {
  const top = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (top.current) top.current.position.y = 0.885 + (count ? Math.max(0, Math.sin(clock.elapsedTime * 2.4)) * 0.05 : 0)
  })
  // (Its pin mounts a frame after the canvas: drei's <Html> loses the one mounted with it.)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const wood = '#9c6b3e'
  return (
    <group
      onClick={(e) => {
        if (e.delta > 6) return
        e.stopPropagation()
        onOpen()
      }}
    >
      <Box p={[0, 0.42, 0]} s={[0.9, 0.84, 0.5]} c={wood} />
      <Box p={[0, 0.86, 0]} s={[0.96, 0.05, 0.56]} c="#7a4e2a" />
      {[0.18, 0.44, 0.7].map((y, i) => (
        <group key={y}>
          <Box p={[0, y, 0.255]} s={[0.8, 0.2, 0.02]} c={i === 1 && count ? '#c98a4b' : '#b07b48'} />
          <Box p={[0, y, 0.275]} s={[0.12, 0.04, 0.03]} c="#e0b13a" />
        </group>
      ))}
      {[-0.4, 0.4].map((x) => (
        <Box key={x} p={[x, 0.02, 0]} s={[0.08, 0.04, 0.46]} c="#5c3a1e" />
      ))}
      <group ref={top} position={[0, 0.885, 0]}>
        {count > 0 && <Wrapped p={[-0.18, 0, 0]} s={0.32} id={1} />}
        {count > 1 && <Wrapped p={[0.2, 0, 0.02]} s={0.26} id={3} />}
        {count > 2 && <Wrapped p={[0.02, 0.26, 0]} s={0.2} id={4} />}
      </group>
      {ready && (
        <Html position={[0, count ? 1.75 : 1.35, 0]} center zIndexRange={[30, 0]}>
          <button className="flex flex-col items-center" onClick={onOpen} onPointerDown={(e) => e.stopPropagation()} aria-label={count ? tr('Tiroir à cadeaux : {count} à ouvrir', { count }) : tr('Tiroir à cadeaux')}>
            <span className="relative grid h-[38px] w-[38px] place-items-center rounded-full bg-[linear-gradient(#ff9a3d,#e8590c)] text-white" style={{ boxShadow: '0 0 0 2.5px #ffffff, 0 6px 14px -6px rgba(0,0,0,0.7)', opacity: count ? 1 : 0.75 }}>
              <Gift size={20} strokeWidth={2.6} />
              {count > 0 && <span className="absolute -top-1 -right-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#e03131] px-1 text-[10px] font-extrabold text-white">{count}</span>}
            </span>
            {count > 0 && <span className="mt-1 rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] font-extrabold whitespace-nowrap text-white">{tr('Tiroir à cadeaux')}</span>}
          </button>
        </Html>
      )}
    </group>
  )
}

/** The friends' gifts of the account, asked again every little while (none while the update is closed). */
export function useFriendGifts(simId: string | undefined) {
  const feats = useFeatures()
  const on = !!simId && feats.known && keyOpen(feats, 'parrainage')
  const [view, setView] = useState<Parrainage | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!on) return setView(null)
    let live = true
    const load = () => api.parrainage(simId!).then((v) => live && setView(v), () => undefined)
    void load()
    const t = setInterval(load, 90_000)
    return () => ((live = false), clearInterval(t))
  }, [on, simId, tick])
  return { on, view, reload: () => setTick((n) => n + 1), wrapped: view?.gifts.filter((g) => !g.opened).length ?? 0 }
}

/** What came out of the gift, in blocks: a piece of clothing, something for the fridge, the decoration itself, Djai. */
function Inside({ gift, world }: { gift: FriendGift; world: World }) {
  if (gift.kind === 'deco' && world.furniture) {
    const f = world.furniture.find((x) => x.id === gift.item)
    if (f) {
      const k = 1.15 / Math.max(f.w, f.d, f.h)
      return (
        <group scale={k} position={[(-f.w * k) / 2, 0, (-f.d * k) / 2]}>
          <FurnitureSet pieces={[[0, 0, 0, 0, f.id]]} catalog={world.furniture} />
        </group>
      )
    }
  }
  if (gift.kind === 'habit') {
    const p = world.clothes?.find((x) => x.id === gift.item)
    if (p?.kind === 'accessoire') {
      const c = p.accessoryColor ?? '#d4af37'
      return (
        <group>
          <Box p={[0, 0.18, 0]} s={[0.5, 0.3, 0.5]} c={c} />
          <Box p={[0, 0.06, 0.3]} s={[0.5, 0.05, 0.3]} c={c} />
          <Box p={[0, 0.36, 0]} s={[0.12, 0.08, 0.12]} c="#ffffff" />
        </group>
      )
    }
    const top = p?.outfitColor ?? '#ff7a00'
    const bottom = p?.bottomColor ?? '#1f2a44'
    return (
      <group>
        {/* The shirt, folded on the trousers. */}
        <Box p={[0, 0.08, 0]} s={[0.7, 0.14, 0.5]} c={bottom} />
        <Box p={[0, 0.25, 0]} s={[0.76, 0.2, 0.54]} c={top} />
        <Box p={[0, 0.36, 0.2]} s={[0.3, 0.04, 0.1]} c={p?.shoeColor ?? '#ffffff'} />
        <Box p={[-0.3, 0.36, -0.05]} s={[0.12, 0.03, 0.42]} c={top} />
        <Box p={[0.3, 0.36, -0.05]} s={[0.12, 0.03, 0.42]} c={top} />
      </group>
    )
  }
  if (gift.kind === 'frigo') {
    const g = world.groceries?.find((x) => x.id === gift.item)
    const n = Math.max(1, Math.min(3, gift.amount ?? 1))
    const c = g?.id === 'bissap' ? '#a61e4d' : g?.id === 'gnamakoudji' ? '#f2c94c' : g?.id === 'sucrerie' ? '#e8590c' : g?.id === 'eau' ? '#a5d8ff' : '#f1f3f5'
    return (
      <group>
        {[...Array(n)].map((_, i) =>
          g?.drink ? (
            <group key={i} position={[(i - (n - 1) / 2) * 0.32, 0, 0]}>
              <Box p={[0, 0.3, 0]} s={[0.22, 0.6, 0.22]} c={c} />
              <Box p={[0, 0.66, 0]} s={[0.1, 0.12, 0.1]} c="#ffffff" />
            </group>
          ) : (
            <group key={i} position={[(i - (n - 1) / 2) * 0.42, 0, 0]}>
              <Box p={[0, 0.06, 0]} s={[0.38, 0.12, 0.38]} c="#ffffff" />
              <Box p={[0, 0.16, 0]} s={[0.3, 0.1, 0.3]} c={g?.id === 'garba' || g?.id === 'attieke-poisson' ? '#f8f0c8' : g?.id === 'alloco-poulet' ? '#e8a33b' : g?.id === 'glace' ? '#ffc9de' : '#8fd18b'} />
            </group>
          ),
        )}
      </group>
    )
  }
  // Djai: a pile of coins.
  return (
    <group>
      {[...Array(6)].map((_, i) => (
        <mesh key={i} position={[(i % 2) * 0.04 - 0.02, 0.05 + i * 0.09, 0]}>
          <cylinderGeometry args={[0.28, 0.28, 0.08, 10]} />
          <meshLambertMaterial color={i % 2 ? '#f2c230' : '#e0a91a'} flatShading />
        </mesh>
      ))}
      <mesh position={[0.45, 0.05, 0.1]}>
        <cylinderGeometry args={[0.28, 0.28, 0.08, 10]} />
        <meshLambertMaterial color="#f2c230" flatShading />
      </mesh>
    </group>
  )
}

/** The unwrapping: the lid flies off, the paper falls open, what's inside comes up and turns; confetti. */
function Unwrap({ gift, world }: { gift: FriendGift; world: World }) {
  const lid = useRef<THREE.Group>(null)
  const sides = useRef<THREE.Group[]>([])
  const item = useRef<THREE.Group>(null)
  const bits = useRef<THREE.Group>(null)
  const t0 = useRef<number | null>(null)
  const [c, r] = paper(gift.id)
  const confetti = useMemo(() => [...Array(18)].map((_, i) => ({ a: (i / 18) * Math.PI * 2, v: 1.4 + (i % 4) * 0.35, c: PAPERS[i % PAPERS.length][i % 2] })), [])
  useFrame(({ clock }) => {
    if (t0.current === null) t0.current = clock.elapsedTime
    const t = clock.elapsedTime - t0.current
    // A little shake, then open.
    const open = Math.min(1, Math.max(0, (t - 0.7) / 0.5))
    const shake = t < 0.7 ? Math.sin(t * 40) * 0.05 * (t / 0.7) : 0
    if (lid.current) {
      lid.current.position.set(open * 0.7, 0.62 + open * 1.4 - open * open * 0.6, -open * 0.3)
      lid.current.rotation.set(-open * 1.2, 0, shake - open * 0.9)
    }
    // Each side falls outwards: the front and back about x, the right and left about z.
    sides.current.forEach((g, i) => {
      if (!g) return
      const a = open * 1.45
      if (i < 2) g.rotation.x = i === 0 ? a : -a
      else g.rotation.z = i === 2 ? -a : a
    })
    if (item.current) {
      const up = Math.min(1, Math.max(0, (t - 0.9) / 0.6))
      item.current.position.y = 0.05 + (1 - (1 - up) ** 3) * 0.75
      item.current.rotation.y = t * 0.8
      item.current.scale.setScalar(0.4 + up * 0.9)
    }
    if (bits.current) {
      const f = Math.max(0, t - 0.75)
      bits.current.visible = f > 0 && f < 2.2
      bits.current.children.forEach((b, i) => {
        const k = confetti[i]
        b.position.set(Math.cos(k.a) * k.v * f * 0.7, 0.7 + k.v * f - 2.4 * f * f, Math.sin(k.a) * k.v * f * 0.5)
        b.rotation.set(f * 6 + i, f * 4, 0)
      })
    }
  })
  const s = 1.1
  const h = 0.6
  return (
    <group>
      {/* The bottom of the box, its four sides that fall open (each hinged at the bottom), the lid. */}
      <Box p={[0, 0.02, 0]} s={[s, 0.04, s]} c={c} />
      {[0, 1, 2, 3].map((i) => (
        <group key={i} ref={(g) => void (g && (sides.current[i] = g))} position={i === 0 ? [0, 0, s / 2] : i === 1 ? [0, 0, -s / 2] : i === 2 ? [s / 2, 0, 0] : [-s / 2, 0, 0]}>
          <Box p={[0, h / 2, 0]} s={i < 2 ? [s, h, 0.04] : [0.04, h, s]} c={c} />
          <Box p={[0, h / 2, 0]} s={i < 2 ? [0.18, h, 0.05] : [0.05, h, 0.18]} c={r} />
        </group>
      ))}
      <group ref={lid} position={[0, h, 0]}>
        <Box p={[0, 0.05, 0]} s={[s * 1.06, 0.1, s * 1.06]} c={c} />
        <Box p={[0, 0.05, 0]} s={[s * 1.08, 0.11, 0.18]} c={r} />
        <Box p={[0, 0.05, 0]} s={[0.18, 0.11, s * 1.08]} c={r} />
        <Box p={[-0.16, 0.17, 0]} s={[0.3, 0.16, 0.14]} c={r} r={0.5} />
        <Box p={[0.16, 0.17, 0]} s={[0.3, 0.16, 0.14]} c={r} r={-0.5} />
      </group>
      <group ref={item} position={[0, 0.05, 0]} scale={0.4}>
        <Inside gift={gift} world={world} />
      </group>
      <group ref={bits} visible={false}>
        {confetti.map((k, i) => (
          <Box key={i} p={[0, 0, 0]} s={[0.07, 0.07, 0.02]} c={k.c} />
        ))}
      </group>
    </group>
  )
}

function LookAt({ at }: { at: [number, number, number] }) {
  const camera = useThree((s) => s.camera)
  useEffect(() => camera.lookAt(...at), [camera, at])
  return null
}

const AIM: [number, number, number] = [0, 0.6, 0]

/** The unwrapping, in its own little scene. */
export function GiftReveal({ gift, world }: { gift: FriendGift; world: World }) {
  return (
    <div className="h-[230px] w-full overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_40%,#fff4d6,#ffd8a8)]">
      <Canvas dpr={sceneDpr} camera={{ position: [0, 1.9, 3.1], fov: 38 }} gl={{ alpha: true }}>
        <LookAt at={AIM} />
        <hemisphereLight args={['#ffffff', '#c9a27c', 1.2]} />
        <directionalLight position={[3, 6, 4]} intensity={1.4} />
        <Unwrap gift={gift} world={world} />
      </Canvas>
    </div>
  )
}

const KIND_WORD: Record<string, string> = { habit: tr('Dans ta garde-robe'), frigo: tr('Dans ton frigo'), deco: tr('Dans ta maison'), djai: tr('Dans ton porte-monnaie') }

/** When the gift came, in words. */
function when(at: string) {
  const m = Math.round((Date.now() - new Date(at).getTime()) / 60000)
  if (m < 60) return m <= 1 ? tr("à l'instant") : tr('il y a {m} min', { m })
  if (m < 24 * 60) return tr('il y a {0} h', { 0: Math.round(m / 60) })
  const d = Math.round(m / (24 * 60))
  return d === 1 ? 'hier' : tr('il y a {d} jours', { d })
}

/** The gifts: the wrapped ones to open (« Grâce à Koffi »), then the last ones opened. Opening one shows it. */
export function GiftList({ world, sim, gifts, onResult, onOpened }: { world: World; sim: Sim; gifts: FriendGift[]; onResult: (r: ActionResult) => void; onOpened: () => void }) {
  const [busy, setBusy] = useState<number | null>(null)
  const [shown, setShown] = useState<{ gift: FriendGift; text: string } | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const wrapped = gifts.filter((g) => !g.opened)
  const opened = gifts.filter((g) => g.opened)
  const open = async (g: FriendGift) => {
    setBusy(g.id)
    setSaid(null)
    try {
      const r = await api.openGift(sim.id, g.id)
      onResult(r)
      setShown({ gift: r.outcome.data ?? { ...g, opened: true }, text: r.outcome.text })
      onOpened()
    } catch (e) {
      setSaid(errorText(e, tr('Le cadeau ne s’ouvre pas. Réessaie.')))
    } finally {
      setBusy(null)
    }
  }
  if (shown)
    return (
      <div className="space-y-3">
        <GiftReveal key={shown.gift.id} gift={shown.gift} world={world} />
        <div className="rounded-2xl bg-[#fff8e1] p-3">
          {shown.gift.rare && (
            <div className="mb-1 flex items-center gap-1 text-xs font-extrabold text-[#c98a00]">
              <Sparkles size={14} /> {tr('Cadeau rare !')}
            </div>
          )}
          <div className="font-display text-[18px] leading-tight font-extrabold">{shown.gift.label}</div>
          <p className="mt-1 text-[13.5px] leading-snug font-bold text-[var(--color-ink-soft)]">{shown.text}</p>
        </div>
        <button className="btn w-full" onClick={() => setShown(null)}>
          {wrapped.length ? tr('Super ! Encore {length} à ouvrir', { length: wrapped.length }) : tr('Super, merci !')}
        </button>
      </div>
    )
  return (
    <div className="space-y-3">
      {said && (
        <p className="rounded-2xl bg-[#ffe3e3] p-3 text-[13.5px] leading-snug font-bold text-[#c92a2a]" role="status">
          {said}
        </p>
      )}
      {wrapped.length > 0 ? (
        <ul className="grid gap-1.5">
          {wrapped.map((g) => {
            const [c, r] = paper(g.id)
            return (
              <li key={g.id} className="flex items-center gap-2.5 rounded-2xl bg-[var(--color-canvas)] p-2">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: c, color: r }}>
                  <Gift size={22} strokeWidth={2.6} />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[14.5px] font-extrabold">{tr('Grâce à')} {g.from}</span>
                  <span className="block truncate text-[11.5px] font-bold text-[var(--color-ink-soft)]">{tr('Emballé · arrivé')} {when(g.at)}</span>
                </span>
                <button className="btn shrink-0 !px-3.5 !py-2 !text-[13px]" disabled={busy !== null} onClick={() => void open(g)}>
                  <PackageOpen size={16} /> {busy === g.id ? '…' : tr('Ouvrir')}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="rounded-2xl bg-[var(--color-canvas)] p-3 text-[13.5px] leading-snug font-bold">{tr("Le tiroir est vide pour l'instant. Envoie ton lien à tes amis : chaque ami qui s'inscrit et joue un peu y laisse un cadeau pour toi.")}</p>
      )}
      {opened.length > 0 && (
        <section>
          <h4 className="label mb-1.5">{tr('Déjà ouverts')}</h4>
          <ul className="grid gap-1">
            {opened.map((g) => (
              <li key={g.id} className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 text-[12.5px] font-bold shadow-[inset_0_0_0_1.5px_var(--color-line)]">
                <Gift size={15} className="shrink-0 text-[var(--color-orange)]" />
                <span className="min-w-0 flex-1 truncate">
                  {g.label} <span className="text-[var(--color-ink-soft)]">{tr('· grâce à')} {g.from}</span>
                </span>
                <span className="shrink-0 text-[11px] text-[var(--color-ink-soft)]">{KIND_WORD[g.kind ?? ''] ?? ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/** The drawer opened at home: the gifts waiting in it. */
export function GiftsSheet({ world, sim, view, onResult, onOpened, onClose }: { world: World; sim: Sim; view: Parrainage | null; onResult: (r: ActionResult) => void; onOpened: () => void; onClose: () => void }) {
  const n = view?.gifts.filter((g) => !g.opened).length ?? 0
  return (
    <Sheet onClose={onClose} z="z-50" className="max-h-[86dvh] overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:w-[460px]">
      {(close) => (
        <>
          <div className="mb-3 flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(#ffb066,#e8590c)] text-white">
              <Gift size={26} strokeWidth={2.4} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[22px] leading-tight font-extrabold">{tr('Le tiroir à cadeaux')}</div>
              <div className="text-xs font-bold text-[var(--color-ink-soft)]">{view === null ? '…' : n ? tr('{n} cadeau{0} emballé{1} de tes amis', { n, 0: n > 1 ? 'x' : '', 1: n > 1 ? 's' : '' }) : tr('Les cadeaux de tes amis venus par ton lien')}</div>
            </div>
            <button className="icon-btn bg-[var(--color-canvas)]" onClick={close} aria-label={tr('Fermer')}>
              <X size={20} strokeWidth={2.6} />
            </button>
          </div>
          {view && <GiftList world={world} sim={sim} gifts={view.gifts} onResult={onResult} onOpened={onOpened} />}
        </>
      )}
    </Sheet>
  )
}
