import { building, doneAt } from '../game/chantier'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Check, Crown, Eye, EyeOff, Hammer, Home as HomeIcon, Lock, Move, Pickaxe, RotateCw, Star, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { kindOf, type ActionResult, type Block, type Furniture, type HousePlan, type Material, type Piece, type Plot, type Sim, type World } from '../lib/types'
import { keyOpen, useFeatures } from '../lib/features'
import { iconFor } from './icons'
import { amount } from '../game/rules'
import { Character } from '../world3d/Character'
import { House, materialTexture } from '../world3d/build/House'
import { FurnitureSet, downstairs } from '../world3d/build/Furniture'
import { Zones } from '../world3d/build/Zones'
import { LotFence, ownerColor } from '../world3d/build/Fence'
import { LotOffers } from './Lots'
import { Coin } from './ui'
import { t, tx } from '../lib/i18n'

// Building one's own house, Minecraft-style, on the lot the Sim bought (its
// size in m² is the space to build on): tap the ground or the face of a block
// to put a block there, or switch to « Casser » to take one down (half its
// price back). Basic materials are there from the start; better ones unlock
// as the house grows. « Meubles » puts the basic furniture in (« Tourner »
// turns it a quarter); with a bed under a roof and toilets, « Emménager »
// moves the Sim in: no more rent. Edits are saved in small batches, paid from
// the Sim's money, and everyone in the commune sees the house on its lot.

/** The editor's shelves: the rooms, and the very best pieces all together. */
const SHELVES = [
  ['tout', t('Tout')],
  ['chambre', t('Chambre')],
  ['salon', t('Salon')],
  ['cuisine', t('Cuisine')],
  ['bain', t('Salle de bain')],
  ['deco', t('Déco')],
  ['prestige', t('Prestige')],
] as const
type Shelf = (typeof SHELVES)[number][0]

type Cell = [number, number, number]
const key = ([x, y, z]: Cell) => `${x},${y},${z}`

export default function BuildMode({ world, sim, lot: wanted = 0, onResult, onClose }: { world: World; sim: Sim; /** Which of the Sim's lots (0: the one lived in, else the first). */ lot?: number; onResult: (res: ActionResult) => void; onClose: () => void }) {
  const H = world.plot?.h ?? 8
  const materials = world.materials ?? []
  const catalog = world.furniture ?? []
  const [plot, setPlot] = useState<Plot | null>(null)
  const [blocks, setBlocks] = useState<Block[] | null>(null)
  const [pieces, setPieces] = useState<Piece[]>([])
  const [built, setBuilt] = useState(0)
  const [tab, setTab] = useState<'plans' | 'materiaux' | 'meubles'>('materiaux')
  // « Plans »: a whole house in one go on the empty lot (game/plans.go); the one looked at is shown on the lot.
  const [preview, setPreview] = useState<HousePlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [pick, setPick] = useState(materials[0]?.id ?? 'banco')
  const [pickF, setPickF] = useState(catalog[0]?.id ?? 'lit')
  const [rot, setRot] = useState(0)
  const [mode, setMode] = useState<'place' | 'remove' | 'move'>('place')
  // The updates (lib/features.ts): the finer pieces, and moving a piece, once the team has opened them.
  const feats = useFeatures()
  const canMove = keyOpen(feats, 'deplacer-meubles')
  const shop = catalog.filter((f) => !f.key || keyOpen(feats, f.key))
  const [shelf, setShelf] = useState<Shelf>('tout')
  const shelved = shop.filter((f) => (shelf === 'tout' ? true : shelf === 'prestige' ? f.tier === 'prestige' : f.room === shelf))
  // « Déplacer »: the piece picked up (off the floor until it's put down again).
  const [carry, setCarry] = useState<Piece | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hover, setHover] = useState<Cell | null>(null)
  // « Voir dedans »: the roof and the top of the walls hidden, to furnish (as in a builder game).
  const [cut, setCut] = useState(false)
  // The lot being built on: the one asked for, then the one loaded (a lot just bought gets its id).
  const lotId = plot?.id || wanted
  const W = plot?.lot?.w ?? 0
  const D = plot?.lot?.d ?? 0
  const planOpened = useRef(false)
  const zones = plot?.zones ?? []
  const empty = !!blocks && !blocks.length && !pieces.length && !zones.length
  const plans = (world.lotPlans ?? []).filter((p) => p.w <= W && p.d <= D)
  /** A plan sits on the lot at the street side, in the middle (game/plans.go BuildPlan). */
  const planAt = (p: HousePlan): [number, number] => [Math.floor((W - p.w) / 2), D - p.d]
  const buildPlan = async (p: HousePlan) => {
    setBusy(true)
    setError(null)
    try {
      onResult(await api.buildPlan(sim.id, p.id, lotId))
      // The masons build it on the lot over time: back to the street, free meanwhile.
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('Pas de réseau'))
    } finally {
      setBusy(false)
    }
  }
  const clearLot = async () => {
    setBusy(true)
    setError(null)
    try {
      onResult(await api.clearPlot(sim.id, lotId))
      await reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('Pas de réseau'))
    } finally {
      setBusy(false)
    }
  }

  const reload = () =>
    api
      .plot(sim.id, lotId)
      .then((p) => {
        setPlot(p)
        setBlocks(p.blocks)
        setPieces(p.furniture ?? [])
        setBuilt(p.built)
        // An empty lot opens on the plans: a house in one go, or the first block by hand.
        if (!p.blocks.length && !(p.furniture ?? []).length && p.lot && !planOpened.current) {
          planOpened.current = true
          setTab('plans')
        }
      })
      .catch(() => setError(t('Le terrain ne charge pas. Réessaie.')))
  useEffect(() => void reload(), [sim.id, wanted]) // eslint-disable-line react-hooks/exhaustive-deps

  // Edits waiting to be saved: sent together a moment after the last tap.
  type Queue = { place: Map<string, Block>; remove: Map<string, Cell>; furnish: Map<string, Piece>; unfurnish: Map<string, Cell>; move: [Piece, Piece][] }
  const fresh = (): Queue => ({ place: new Map(), remove: new Map(), furnish: new Map(), unfurnish: new Map(), move: [] })
  const queue = useRef<Queue>(fresh())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pendingCost, setPendingCost] = useState(0)
  const priceOf = (id: string) => materials.find((m) => m.id === id)?.price ?? 0
  const piecePrice = (id: string) => catalog.find((f) => f.id === id)?.price ?? 0
  const flush = () => {
    timer.current = null
    const q = queue.current
    if (!q.place.size && !q.remove.size && !q.furnish.size && !q.unfurnish.size && !q.move.length) return
    queue.current = fresh()
    const place = [...q.place.values()]
    setPendingCost(0)
    api
      .build(sim.id, place, [...q.remove.values()], [...q.furnish.values()], [...q.unfurnish.values()], lotId, q.move)
      .then((res) => {
        onResult(res)
        void reload() // the new state, and whether one can move in now
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : t('Pas de réseau : rien n’a été enregistré.'))
        void reload()
      })
  }
  const later = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, 600)
  }
  // Leaving saves what's left.
  useEffect(() => () => void (timer.current && (clearTimeout(timer.current), flush())), []) // eslint-disable-line react-hooks/exhaustive-deps

  const grid = useMemo(() => new Map((blocks ?? []).map((b) => [key([b[0], b[1], b[2]]), b])), [blocks])
  // The cells the furniture fills.
  const footprint = (p: Piece) => {
    const f = catalog.find((x) => x.id === p[4])
    if (!f) return [] as Cell[]
    const [w, d] = p[3] % 2 ? [f.d, f.w] : [f.w, f.d]
    const out: Cell[] = []
    for (let y = 0; y < Math.max(1, f.h); y++) for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) out.push([p[0] + x, p[1] + y, p[2] + z])
    return out
  }
  const furnished = useMemo(() => new Set(pieces.flatMap((p) => footprint(p).map(key))), [pieces]) // eslint-disable-line react-hooks/exhaustive-deps
  const inside = ([x, y, z]: Cell) => x >= 0 && x < W && z >= 0 && z < D && y >= 0 && y < H
  const material = materials.find((m) => m.id === pick)
  const piece = catalog.find((f) => f.id === (carry ? carry[4] : pickF))
  const money = sim.money - pendingCost
  const placedSoFar = built + queue.current.place.size

  const place = (c: Cell) => {
    if (!blocks || !material || !inside(c) || grid.has(key(c)) || furnished.has(key(c))) return
    if (material.unlock > placedSoFar) return setError(t('{label} : construis encore {0} blocs pour le débloquer.', { label: material.label, 0: material.unlock - placedSoFar }))
    if (money < material.price) return setError(t("Pas assez d'argent pour ce bloc."))
    const b: Block = [c[0], c[1], c[2], material.id]
    queue.current.place.set(key(c), b)
    setPendingCost((p) => p + material.price)
    setBlocks([...blocks, b])
    setError(null)
    later()
  }
  /** Why a piece can't stand there ('' when it can). */
  const misfit = (p: Piece) => {
    const cells = footprint(p)
    if (cells.some((x) => !inside(x))) return t('Ça dépasse de ton terrain : tourne-le ou pose-le ailleurs.')
    if (cells.some((x) => grid.has(key(x)) || furnished.has(key(x)))) return t('Pas la place : il y a déjà quelque chose ici.')
    if (p[1] > 0 && cells.filter((x) => x[1] === p[1]).some((x) => !grid.has(key([x[0], x[1] - 1, x[2]])))) return t('Un meuble se pose sur le sol ou sur un plancher.')
    return ''
  }
  // The piece carried, put down here: for nothing (only where it stands changes).
  const putDown = (c: Cell) => {
    if (!carry) return
    const p: Piece = [c[0], c[1], c[2], rot, carry[4]]
    const why = misfit(p)
    if (why) return setError(why)
    const from = key([carry[0], carry[1], carry[2]])
    // Bought in this same batch: it's just bought here instead.
    if (queue.current.furnish.delete(from)) queue.current.furnish.set(key(c), p)
    else queue.current.move.push([carry, p])
    setPieces([...pieces, p])
    setCarry(null)
    setError(null)
    later()
  }
  const pickUp = (p: Piece) => {
    if (p[4] === 'escalier') return setError(t("L'escalier ne se déplace pas : enlève-le et repose-le."))
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setCarry(p)
    setRot(p[3])
    setPieces(pieces.filter((x) => x !== p))
    setError(null)
  }
  // Put back where it was (the move given up).
  const putBack = () => {
    if (!carry) return
    setPieces((ps) => [...ps, carry])
    setCarry(null)
    later()
  }
  const furnish = (c: Cell) => {
    if (mode === 'move') return putDown(c)
    if (!piece) return
    const p: Piece = [c[0], c[1], c[2], rot, piece.id]
    const why = misfit(p)
    if (why) return setError(why)
    if (money < piece.price) return setError(t("Pas assez d'argent pour ce meuble."))
    queue.current.furnish.set(key(c), p)
    setPendingCost((x) => x + piece.price)
    setPieces([...pieces, p])
    setError(null)
    later()
  }
  const remove = (c: Cell) => {
    const b = grid.get(key(c))
    if (!blocks || !b) return
    // Placed in this same batch: just not sent.
    if (queue.current.place.delete(key(c))) setPendingCost((p) => p - priceOf(b[3]))
    else {
      queue.current.remove.set(key(c), c)
      setPendingCost((p) => p - Math.floor(priceOf(b[3]) / 2))
    }
    setBlocks(blocks.filter((x) => x !== b))
    setError(null)
    later()
  }
  const unfurnish = (p: Piece) => {
    const k = key([p[0], p[1], p[2]])
    if (queue.current.furnish.delete(k)) setPendingCost((x) => x - piecePrice(p[4]))
    else {
      queue.current.unfurnish.set(k, [p[0], p[1], p[2]])
      setPendingCost((x) => x - Math.floor(piecePrice(p[4]) / 2))
    }
    setPieces(pieces.filter((x) => x !== p))
    setError(null)
    later()
  }

  // Where a tap lands: next to the face touched, or the block itself to break it.
  const put = (c: Cell) => (tab === 'meubles' ? furnish(c) : place(c))
  const onBlock = (c: Cell, n: Cell, e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return // that was a drag to turn the view
    if (mode === 'move' && !carry) return
    if (mode === 'remove') remove(c)
    else put([c[0] + n[0], c[1] + n[1], c[2] + n[2]])
  }
  const onGround = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6 || mode === 'remove' || (mode === 'move' && !carry)) return
    e.stopPropagation()
    put([Math.floor(e.point.x + W / 2), 0, Math.floor(e.point.z + D / 2)])
  }
  const onPiece = (p: Piece, e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return
    if (mode === 'move' && !carry) return (e.stopPropagation(), pickUp(p))
    if (mode !== 'remove') return
    e.stopPropagation()
    unfurnish(p)
  }
  const placing = mode === 'place' || (mode === 'move' && !!carry)
  const ghost = hover && (mode === 'remove' || (inside(hover) && !grid.has(key(hover)))) ? hover : null
  const ghostPiece: Piece | null = ghost && placing && tab === 'meubles' && piece ? [ghost[0], ghost[1], ghost[2], rot, piece.id] : null

  const moveIn = async () => {
    try {
      onResult(await api.moveIn(sim.id, lotId))
      void reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('Pas de réseau'))
    }
  }
  const kindAt = (p: Piece) => kindOf(catalog.find((f) => f.id === p[4]) ?? { id: p[4] })
  const hasBed = pieces.some((p) => kindAt(p) === 'lit' || kindAt(p) === 'natte')
  const hasWc = pieces.some((p) => kindAt(p) === 'wc')

  // No lot yet: buy one first, here where the Sim is.
  if (plot && !plot.lot)
    return (
      <div className="absolute inset-0 z-40 overflow-y-auto bg-[var(--color-canvas)] p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mx-auto max-w-md">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-2xl font-extrabold">{t('Ton terrain')}</h2>
            <button className="icon-btn bg-white" onClick={onClose} aria-label={t('Fermer')}>
              <X size={22} strokeWidth={2.6} />
            </button>
          </div>
          <p className="mb-3 text-sm font-bold text-[var(--color-ink-soft)]">{t("Pour bâtir ta maison, il te faut d'abord un terrain à toi. Sa taille, c'est la place que tu as pour construire.")}</p>
          <LotOffers
            sim={sim}
            buy={async (size, _label, where, upgrade, spot) => {
              try {
                onResult(await api.buyLot(sim.id, size, where, upgrade, spot))
                await reload()
                return true
              } catch (e) {
                setError(e instanceof ApiError ? e.message : t('Pas de réseau'))
                return false
              }
            }}
          />
          {error && <p className="mt-3 text-sm font-bold text-[#d81b3f]">{error}</p>}
        </div>
      </div>
    )

  // The masons still at it (game/chantier.ts): nothing to change till it's done; the Sim is free meanwhile.
  if (plot && building(plot))
    return (
      <div className="absolute inset-0 z-40 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={onClose}>
        <div className="sheet animate-up w-full rounded-t-[28px] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:w-[420px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
          <div className="label">{t('Chantier en cours')}</div>
          <div className="mt-1 font-display text-[22px] leading-tight font-extrabold">{t('Les maçons construisent ta maison')}</div>
          <p className="mt-2 text-sm leading-snug font-bold text-[var(--color-ink-soft)]">{tx("Ce sera fini à {0}. Ce n'est pas toi qui construis : va où tu veux en attendant, tu pourras meubler et emménager ensuite.", { 0: doneAt(plot) })}</p>
          <button className="btn mt-4 w-full" onClick={onClose}>
            {t("D'accord")}
          </button>
        </div>
      </div>
    )
  const span = Math.max(W, D, 12)
  return (
    <div className="absolute inset-0 z-40 bg-[#9fd8f5]">
      {plot?.lot && (
        <Canvas shadows dpr={[1, 2]} camera={{ position: [span * 0.9, span * 0.9, span * 1.25], fov: 40 }} onPointerMissed={() => setHover(null)}>
          <hemisphereLight args={['#ffffff', '#b8a27c', 1.2]} />
          <directionalLight position={[8, 14, 6]} intensity={1.8} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-span} shadow-camera-right={span} shadow-camera-top={span} shadow-camera-bottom={-span} />
          <ambientLight intensity={0.35} />
          {/* The lot: grass, a grid of one-metre squares, the street's earth round it */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={onGround} onPointerMove={(e) => (e.stopPropagation(), setHover(mode === 'remove' || (mode === 'move' && !carry) ? null : [Math.floor(e.point.x + W / 2), 0, Math.floor(e.point.z + D / 2)]))}>
            <planeGeometry args={[W, D]} />
            <meshLambertMaterial map={grass(W, D)} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
            <planeGeometry args={[W + 30, D + 30]} />
            <meshLambertMaterial color="#cbb38c" />
          </mesh>
          <group position={[-W / 2, 0, -D / 2]}>
            <LotFence w={W} d={D} color={ownerColor(sim.id)} name={t('Chez {firstName}', { firstName: sim.firstName })} />
            {zones.length > 0 && blocks && <Zones zones={zones} blocks={blocks} furniture={pieces} w={W} d={D} cut={cut} />}
            {/* A plan looked at, on the empty lot where it would stand */}
            {preview && empty && world.furniture && (
              <group position={[planAt(preview)[0], 0, planAt(preview)[1]]}>
                <House blocks={cut ? preview.blocks.filter((b) => b[1] < 2) : preview.blocks} materials={materials} />
                <FurnitureSet pieces={cut ? downstairs(preview.furniture) : preview.furniture} catalog={catalog} />
                <Zones zones={preview.zones} blocks={preview.blocks} furniture={preview.furniture} w={preview.w} d={preview.d} cut={cut} />
              </group>
            )}
            {blocks && <House blocks={cut ? blocks.filter((b) => b[1] < 2) : blocks} materials={materials} onBlock={onBlock} onHover={(c, n) => setHover(c && n && (mode === 'place' || (mode === 'move' && carry)) ? [c[0] + n[0], c[1] + n[1], c[2] + n[2]] : mode === 'move' ? null : c)} />}
            <FurnitureSet pieces={cut ? downstairs(pieces) : pieces} catalog={catalog} onPiece={onPiece} />
            {ghostPiece ? (
              <FurnitureSet pieces={[ghostPiece]} catalog={catalog} ghost />
            ) : (
              ghost && (
                <mesh position={[ghost[0] + 0.5, ghost[1] + 0.5, ghost[2] + 0.5]} raycast={() => null}>
                  <boxGeometry args={[1.02, 1.02, 1.02]} />
                  <meshBasicMaterial color={mode === 'remove' ? '#ff4d6d' : '#ffffff'} transparent opacity={0.35} depthWrite={false} />
                </mesh>
              )
            )}
          </group>
          {/* The Sim, beside the lot, for scale */}
          <group position={[W / 2 + 1.4, 0, 1]} rotation={[0, -Math.PI / 2, 0]}>
            <Character look={sim.look} gender={sim.gender} pose="idle" />
          </group>
          <OrbitControls makeDefault target={[0, 1.5, 0]} minPolarAngle={0.3} maxPolarAngle={1.45} minDistance={8} maxDistance={span * 3} />
        </Canvas>
      )}

      {/* Top: the lot, the money, moving in, and done */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex flex-col items-start gap-2">
          <div className="hud pointer-events-auto flex h-11 items-center gap-2 rounded-full px-4">
            <Hammer size={18} strokeWidth={2.6} className="text-[var(--color-orange)]" />
            <span className="font-display text-lg font-extrabold">{t('Mon terrain')}</span>
            {plot?.lot && (
              <span className="text-xs font-extrabold text-[var(--color-ink-soft)]">
                {tx('{area} m² · {W} × {D} m', { area: plot.lot.area, W, D })}
              </span>
            )}
          </div>
          {plot?.lot && !plot.home && (
            <div className="hud pointer-events-auto flex max-w-[min(320px,60vw)] flex-col gap-1.5 rounded-2xl p-2.5 text-xs font-extrabold">
              <span className="flex items-center gap-1.5">{hasBed ? <Check size={14} className="text-[var(--color-emerald)]" /> : <X size={14} className="text-[#d81b3f]" />} {t('Un lit (ou une natte) sous un toit')}</span>
              <span className="flex items-center gap-1.5">{hasWc ? <Check size={14} className="text-[var(--color-emerald)]" /> : <X size={14} className="text-[#d81b3f]" />} {t('Des toilettes')}</span>
              <button className="btn !py-2 !text-sm" disabled={!plot.livable} onClick={() => void moveIn()}>
                <HomeIcon size={15} /> {t('Emménager')}
              </button>
            </div>
          )}
          {plot?.home && <span className="hud rounded-full px-3 py-1.5 text-xs font-extrabold">{t('Tu habites ici · pas de loyer')}</span>}
          <button className="hud pointer-events-auto flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-extrabold" onClick={() => setCut((c) => !c)}>
            {cut ? <EyeOff size={15} /> : <Eye size={15} />} {cut ? t('Remettre le toit') : t('Voir dedans')}
          </button>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="hud flex h-11 items-center gap-1.5 rounded-full pr-4 pl-1.5">
            <Coin size={30} />
            <span className="tnum font-display text-lg font-extrabold">{amount(money)}</span>
          </div>
          <button className="icon-btn hud" onClick={onClose} aria-label={t('Terminer')}>
            <X size={22} strokeWidth={2.6} />
          </button>
        </div>
      </div>

      {/* Bottom: place or break, materials or furniture */}
      <div className="absolute inset-x-0 bottom-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {error && (
          <p className="sheet mx-auto mb-2 w-fit max-w-full rounded-2xl px-4 py-2 text-sm font-bold text-[#d81b3f]" role="status">
            {error}
          </p>
        )}
        <div className="sheet mx-auto max-w-[720px] rounded-[24px] p-2">
          <div className="mb-2 flex gap-1">
            {(
              [
                ['plans', t('Plans')],
                ['materiaux', t('Matériaux')],
                ['meubles', t('Meubles')],
              ] as const
            ).map(([id, label]) => (
              <button key={id} onClick={() => (putBack(), setTab(id), setMode('place'), id === 'meubles' && setCut(true), id !== 'plans' && setPreview(null))} className={`flex-1 rounded-xl py-1.5 text-sm font-extrabold ${tab === id ? 'bg-[var(--color-orange)] text-white' : 'bg-[var(--color-canvas)]'}`}>
                {label}
              </button>
            ))}
          </div>
          {tab === 'plans' ? (
            <div>
              <p className="mb-2 px-1 text-xs font-bold text-[var(--color-ink-soft)]">
                {empty
                  ? t('Choisis un plan : les maçons bâtissent tout, meubles compris, et tu peux encore tout changer bloc par bloc. Ou pars de zéro avec « Matériaux ».')
                  : t('Un plan se bâtit sur un terrain vide.')}
              </p>
              {!empty && !plot?.home && (
                <button className="btn mb-2 !bg-[var(--color-canvas)] !px-3 !py-2 !text-sm !text-[var(--color-ink)]" disabled={busy} onClick={() => void clearLot()}>
                  <Pickaxe size={15} /> {t('Tout démolir (la moitié revendue)')}
                </button>
              )}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {plans.map((p) => (
                  <div key={p.id} className={`flex w-[230px] shrink-0 flex-col rounded-2xl p-2.5 ${preview?.id === p.id ? 'bg-[#fff4e8] ring-2 ring-[var(--color-orange)]' : 'bg-[var(--color-canvas)]'}`}>
                    <button className="text-left" onClick={() => setPreview(preview?.id === p.id ? null : p)}>
                      <span className="block font-display text-[15px] leading-tight font-extrabold">{p.label}</span>
                      <span className="mt-0.5 block text-[11px] font-bold text-[var(--color-ink-soft)]">
                        {tx('{w} × {d} m · {rooms} chambre{0} {1}', { w: p.w, d: p.d, rooms: p.rooms, 0: p.rooms > 1 ? 's' : '', 1: p.pool ? t(' · piscine') : '' })}
                      </span>
                      <span className="mt-1 line-clamp-3 block text-[11px] leading-snug font-semibold">{p.hint}</span>
                    </button>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <span className="text-xs font-extrabold">{amount(p.cost)} {t('Djai')}</span>
                      <button className="btn !px-3 !py-1.5 !text-xs" disabled={busy || !empty || sim.money < p.cost} onClick={() => void buildPlan(p)}>
                        {sim.money < p.cost ? t('Trop cher') : t('Bâtir')}
                      </button>
                    </div>
                  </div>
                ))}
                {!plans.length && <p className="p-2 text-sm font-bold text-[var(--color-ink-soft)]">{t('Aucun plan ne tient sur ce terrain.')}</p>}
              </div>
            </div>
          ) : (
          <>
          {tab === 'meubles' && mode !== 'move' && (
            <div className="mb-1.5 flex gap-1 overflow-x-auto pb-0.5">
              {SHELVES.filter(([id]) => id === 'tout' || shop.some((f) => (id === 'prestige' ? f.tier === 'prestige' : f.room === id))).map(([id, label]) => (
                <button key={id} onClick={() => setShelf(id)} aria-pressed={shelf === id} className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold ${shelf === id ? 'bg-[var(--color-ink)] text-white' : 'bg-[var(--color-canvas)]'}`}>
                  {id === 'prestige' && <Crown size={12} strokeWidth={2.8} className={shelf === id ? 'text-[#ffd166]' : 'text-[#c99a00]'} />}
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-stretch gap-2">
            <div className="flex shrink-0 flex-col gap-1">
              {(
                [
                  ['place', Hammer, t('Poser')],
                  ['remove', Pickaxe, tab === 'meubles' ? t('Enlever') : t('Casser')],
                  ...(tab === 'meubles' && canMove ? ([['move', Move, t('Déplacer')]] as const) : []),
                ] as const
              ).map(([id, Icon, label]) => (
                <button key={id} onClick={() => (putBack(), setMode(id), setHover(null))} aria-pressed={mode === id} className={`flex h-11 w-[84px] items-center justify-center gap-1.5 rounded-2xl text-sm font-extrabold transition ${mode === id ? 'bg-[var(--color-ink)] text-white' : 'bg-[var(--color-canvas)]'}`}>
                  <Icon size={16} strokeWidth={2.6} /> {label}
                </button>
              ))}
              {tab === 'meubles' && (
                <button onClick={() => setRot((r) => (r + 1) % 4)} className="flex h-11 w-[84px] items-center justify-center gap-1.5 rounded-2xl bg-[var(--color-canvas)] text-sm font-extrabold">
                  <RotateCw size={16} strokeWidth={2.6} /> {t('Tourner')}
                </button>
              )}
            </div>
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
              {tab === 'materiaux'
                ? materials.map((m) => <MaterialTile key={m.id} m={m} picked={pick === m.id && mode === 'place'} locked={m.unlock > placedSoFar} toGo={m.unlock - placedSoFar} onPick={() => (setPick(m.id), setMode('place'))} />)
                : mode === 'move'
                  ? (
                      <p className="self-center px-2 text-sm font-bold text-[var(--color-ink-soft)]">
                        {carry ? t('{0} : touche où le poser (« Tourner » pour le tourner). Gratuit.', { 0: piece?.label ?? t('Le meuble') }) : t('Touche un meuble pour le prendre, puis touche où le poser.')}
                      </p>
                    )
                  : shelved.map((f) => <FurnitureTile key={f.id} f={f} picked={pickF === f.id && mode === 'place'} onPick={() => (setPickF(f.id), setMode('place'))} />)}
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  )
}

export function FurnitureTile({ f, picked, onPick, hired }: { f: Furniture; picked: boolean; onPick: () => void; /** A soirée's room (SoireeDeco): hired with the soirée, nothing to pay, nothing it does at home. */ hired?: boolean }) {
  const Icon = iconFor(f.icon)
  const kind = kindOf(f)
  const does = hired ? t('Pour la soirée') : f.unlocks?.includes('sleep') ? t('Dormir') : f.unlocks?.includes('cook-attieke') ? t('Cuisiner') : f.unlocks?.includes('watch-tv') ? t('La télé') : f.unlocks?.includes('shower') ? t('Se doucher') : f.unlocks?.includes('maison-foot') ? t('Jouer') : kind === 'wc' ? t('Pour emménager') : f.unlocks?.includes('dents') ? t('Les dents') : f.stock ? t('{stock} choses au frais', { stock: f.stock }) : t('Confort +{0}', { 0: Math.round(f.comfort * 100) })
  // Light swatches get a dark icon.
  const light = parseInt(f.color.slice(1, 3), 16) + parseInt(f.color.slice(3, 5), 16) + parseInt(f.color.slice(5, 7), 16) > 560
  return (
    <button onClick={onPick} className={`relative flex w-[84px] shrink-0 flex-col items-center gap-0.5 rounded-2xl p-1.5 transition active:scale-95 ${picked ? 'bg-[#fff4e8] ring-2 ring-[var(--color-orange)]' : f.tier === 'prestige' ? 'bg-[#fff8e1]' : 'bg-[var(--color-canvas)]'}`}>
      {f.tier && (
        <span className={`absolute top-1 right-1 grid h-4 w-4 place-items-center rounded-full ${f.tier === 'prestige' ? 'bg-[#1f1a17] text-[#ffd166]' : 'bg-white text-[#e0a100]'}`} title={f.tier === 'prestige' ? t('Prestige') : t('Confort')}>
          {f.tier === 'prestige' ? <Crown size={10} strokeWidth={3} /> : <Star size={10} strokeWidth={3} />}
        </span>
      )}
      <span className="grid h-10 w-10 place-items-center rounded-lg" style={{ background: f.color, color: light ? '#333' : '#fff', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)' }}>
        <Icon size={20} strokeWidth={2.4} />
      </span>
      <span className="w-full truncate text-center text-[11px] leading-tight font-extrabold">{f.label}</span>
      <span className="text-[10px] leading-none font-bold text-[var(--color-ink-soft)]">
        {hired ? `${f.w} × ${f.d} m` : `${amount(f.price)} · ${f.w * f.d} m²`}
      </span>
      <span className="w-full truncate text-center text-[9px] leading-none font-bold text-[var(--color-emerald)]">{does}</span>
    </button>
  )
}

function MaterialTile({ m, picked, locked, toGo, onPick }: { m: Material; picked: boolean; locked: boolean; toGo: number; onPick: () => void }) {
  const swatch = useMemo(() => (materialTexture(m).image as HTMLCanvasElement).toDataURL(), [m])
  return (
    <button onClick={onPick} disabled={locked} className={`flex w-[76px] shrink-0 flex-col items-center gap-1 rounded-2xl p-1.5 transition ${picked ? 'bg-[#fff4e8] ring-2 ring-[var(--color-orange)]' : 'bg-[var(--color-canvas)]'} ${locked ? 'opacity-55 grayscale-[0.6]' : 'active:scale-95'}`}>
      <span className="relative block h-10 w-10 rounded-lg shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" style={{ backgroundImage: `url(${swatch})`, backgroundSize: 'cover', imageRendering: 'pixelated' }}>
        {locked && <Lock size={16} strokeWidth={2.8} className="absolute inset-0 m-auto text-white drop-shadow" />}
      </span>
      <span className="w-full truncate text-center text-[11px] leading-tight font-extrabold">{m.label}</span>
      <span className="text-[10px] leading-none font-bold text-[var(--color-ink-soft)]">{locked ? t('à {toGo} blocs', { toGo }) : t('{0} Djai', { 0: amount(m.price) })}</span>
    </button>
  )
}

/** Grass with a faint grid of one-metre squares, pixel style. */
let grassTex: THREE.CanvasTexture | null = null
function grass(w: number, d: number) {
  if (!grassTex) {
    const c = document.createElement('canvas')
    c.width = c.height = 16
    const g = c.getContext('2d')!
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
        const k = n - Math.floor(n)
        g.fillStyle = x === 0 || y === 0 ? '#5d9a3e' : k > 0.8 ? '#7cc255' : k < 0.2 ? '#62a443' : '#6fb24b'
        g.fillRect(x, y, 1, 1)
      }
    grassTex = new THREE.CanvasTexture(c)
    grassTex.magFilter = grassTex.minFilter = THREE.NearestFilter
    grassTex.generateMipmaps = false
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping
    grassTex.colorSpace = THREE.SRGBColorSpace
  }
  grassTex.repeat.set(w, d)
  return grassTex
}
