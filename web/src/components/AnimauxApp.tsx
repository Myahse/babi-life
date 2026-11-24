import { useCallback, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { api, errorText, type Pet, type PetKind, type PetsState } from '../lib/api'
import type { Sim } from '../lib/types'
import type { Act } from '../screens/phoneApps'
import { sceneDpr } from '../lib/device'
import { Box } from '../world3d/props'
import { PetModel } from '../world3d/pets'
import { amount } from '../game/rules'
import { t, tx } from '../lib/i18n'
import { usePets } from '../lib/pets'

// « Animaux » (the update « animaux », backend sims/animaux.go): the Sim's animals in its yard, in 3D at the
// top (alive: the dog wagging, the hens pecking), then each one's card (its hunger, its spirits, how much it
// loves you, what to do with it), then the ones to adopt. Left hungry a day, it runs off: « Le chercher ».

const EMOJI: Record<PetKind['id'], string> = { chien: '🐕', chat: '🐈', poules: '🐔', mouton: '🐏' }
const MOOD: Record<Pet['mood'], () => string> = {
  parti: () => t('a fugué'),
  affame: () => t('a faim !'),
  triste: () => t('s’ennuie'),
  heureux: () => t('aux anges'),
  ok: () => t('ça va'),
}
// Where each kind stands in the yard.
const SPOT: Record<PetKind['id'], [number, number, number]> = { chien: [-0.5, 0, 0.75], chat: [0.9, 0.62, -0.5], poules: [1.25, 0, 0.75], mouton: [-1.5, 0, -0.55] }

export function AnimauxApp({ sim, act }: { sim: Sim; act: Act }) {
  const [state, setState] = useState<PetsState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [naming, setNaming] = useState<{ kind: PetKind; name: string } | null>(null)
  const load = useCallback(
    () =>
      void api.animaux(sim.id).then(
        (r) => (setState(r), usePets.setState({ pets: r.pets })),
        (e) => setError(errorText(e, t('Pas possible pour le moment'))),
      ),
    [sim.id],
  )
  useEffect(load, [load])
  // The cooldowns tick: the card says « dans 12 min ».
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  const run = async (label: string, icon: string, call: () => ReturnType<typeof api.petAct>) => {
    const ok = await act(label, icon, 'social', call)
    if (ok) load()
  }

  if (error) return <p className="px-6 py-10 text-center text-sm font-bold text-[var(--color-ink-soft)]">{error}</p>
  if (!state) return <p className="py-10 text-center text-sm font-bold text-[var(--color-ink-soft)]">{t('Les animaux arrivent…')}</p>
  const have = new Set(state.pets.map((p) => p.kind))
  const toAdopt = state.kinds.filter((k) => !have.has(k.id))
  return (
    <div className="space-y-3">
      {/* The yard in 3D: the animals at home */}
      <div className="relative h-[190px] overflow-hidden rounded-[22px] bg-[linear-gradient(#bfe3ff,#e7f5ff)]">
        <Canvas dpr={sceneDpr} camera={{ position: [0, 2.3, 4.2], fov: 38 }} onCreated={({ camera }) => camera.lookAt(0, 0.3, 0)}>
          <hemisphereLight args={['#fff7e6', '#6b5a40', 1.15]} />
          <directionalLight position={[3, 6, 4]} intensity={1.3} />
          {/* The yard: the beaten earth, the wall, the mango tree's shade, the cat's step */}
          <Box p={[0, -0.05, 0]} s={[6, 0.1, 3.4]} c="#d9b98a" />
          <Box p={[0, 0.5, -1.7]} s={[6, 1, 0.15]} c="#f4e2b8" />
          <Box p={[0.9, 0.3, -0.5]} s={[0.8, 0.6, 0.6]} c="#a47148" />
          <Box p={[2.3, 1.4, -1.2]} s={[0.25, 2.8, 0.25]} c="#7a5230" />
          <mesh position={[2.3, 2.9, -1.2]}>
            <icosahedronGeometry args={[0.9, 0]} />
            <meshStandardMaterial color="#2b8a3e" roughness={0.9} />
          </mesh>
          {state.pets
            .filter((p) => !p.away)
            .map((p) => (
              <PetModel key={p.id} kind={p.kind} p={SPOT[p.kind]} r={p.kind === 'chat' ? -0.4 : 0.4} mood={p.mood} seed={p.fedDays} />
            ))}
        </Canvas>
        {!state.pets.length && <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[13px] font-extrabold text-[#5c3a21]">{t('La cour est vide… adopte ton premier animal !')}</div>}
        {state.tabaski && <div className="absolute top-2 left-2 rounded-full bg-[#2b8a3e] px-3 py-1 text-[12px] font-black text-white">🐏 {t('Bonne fête de Tabaski !')}</div>}
      </div>

      {/* Each animal */}
      {state.pets.map((p) => {
        const k = state.kinds.find((x) => x.id === p.kind)
        if (!k) return null
        const wait = (id: string) => (p.next?.[id] && p.next[id] > now ? Math.ceil((p.next[id] - now) / 60000) : 0)
        return (
          <div key={p.id} className="rounded-[22px] bg-white p-3.5 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fff4e6] text-3xl">{EMOJI[p.kind]}</span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate font-display text-[17px] font-extrabold">{p.name}</span>
                <span className={`block text-[12.5px] font-bold ${p.mood === 'heureux' ? 'text-[#2b8a3e]' : p.mood === 'ok' ? 'text-[var(--color-ink-soft)]' : 'text-[#e03131]'}`}>
                  {k.label} · {MOOD[p.mood]()}
                </span>
              </span>
              <span className="text-right text-[11px] font-extrabold text-[#d6336c]">
                ♥ {p.bond}
                <span className="block text-[10px] font-bold text-[var(--color-ink-soft)]">{t('affection')}</span>
              </span>
            </div>
            {p.away ? (
              <div className="mt-3 rounded-2xl bg-[#fff0f0] p-3">
                <p className="text-[13px] font-bold text-[#7a1c1c]">{tx('{name} est parti·e : trop longtemps le ventre vide. Fais le tour du quartier pour le retrouver.', { name: p.name })}</p>
                <button className="btn mt-2 w-full !py-2 !text-sm" disabled={wait('chercher') > 0} onClick={() => run(t('Chercher {name}', { name: p.name }), 'search', () => api.petAct(sim.id, p.id, 'chercher'))}>
                  🔎 {t('Le chercher dans le quartier')}
                </button>
              </div>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Gauge label={t('Faim')} value={p.hunger} color="#f08c00" />
                  <Gauge label={t('Moral')} value={p.spirits} color="#1c7ed6" />
                </div>
                {p.kind === 'poules' && <p className="mt-2 text-[12.5px] font-bold text-[var(--color-ink-soft)]">🥚 {tx('{n} œuf(s) à ramasser', { n: p.eggs ?? 0 })}</p>}
                {p.kind === 'mouton' && <p className="mt-2 text-[12.5px] font-bold text-[var(--color-ink-soft)]">💰 {tx('Il vaut {price} F au marché à bétail · nourri {n} jour(s)', { price: amount(p.worth ?? 0), n: p.fedDays ?? 0 })}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="rounded-full bg-[#f08c00] px-3.5 py-2 text-[13px] font-extrabold text-white active:scale-95 disabled:opacity-45"
                    disabled={p.hunger >= 90 || sim.money < k.food}
                    onClick={() => run(t('Nourrir {name}', { name: p.name }), 'utensils', () => api.petAct(sim.id, p.id, 'nourrir'))}
                  >
                    🍽️ {tx('{food} · {price} F', { food: k.foodLabel, price: amount(k.food) })}
                  </button>
                  {k.acts.map((a) => {
                    const w = wait(a.id)
                    const off = a.id === 'oeufs' ? !p.eggs : w > 0
                    return (
                      <button key={a.id} className="rounded-full bg-[#e7f5ff] px-3.5 py-2 text-[13px] font-extrabold text-[#1864ab] active:scale-95 disabled:opacity-45" disabled={off} onClick={() => run(a.label, a.icon, () => api.petAct(sim.id, p.id, a.id))}>
                        {a.label}
                        {w > 0 ? ` · ${tx('dans {n} min', { n: w })}` : ''}
                      </button>
                    )
                  })}
                  {p.kind === 'mouton' && state.tabaski && (
                    <button className="rounded-full bg-[#2b8a3e] px-3.5 py-2 text-[13px] font-extrabold text-white active:scale-95" onClick={() => run(t('La fête de Tabaski'), 'party-popper', () => api.petAct(sim.id, p.id, 'tabaski'))}>
                      🎉 {t('Fêter la Tabaski en famille')}
                    </button>
                  )}
                  {p.kind === 'mouton' && (
                    <button className="rounded-full bg-black/5 px-3.5 py-2 text-[13px] font-extrabold text-[var(--color-ink)] active:scale-95" onClick={() => run(t('Vendre {name}', { name: p.name }), 'banknote', () => api.petAct(sim.id, p.id, 'vendre'))}>
                      {tx('Le vendre {price} F', { price: amount(p.worth ?? 0) })}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )
      })}

      {/* To adopt */}
      {toAdopt.length > 0 && state.pets.length < state.max && (
        <div>
          <div className="label mb-1.5">{t('Adopter')}</div>
          <div className="grid gap-2">
            {toAdopt.map((k) => (
              <div key={k.id} className="rounded-[22px] bg-white p-3.5 shadow-sm ring-1 ring-black/5">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e6fcf5] text-3xl">{EMOJI[k.id]}</span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block font-display text-[16px] font-extrabold">{k.label}</span>
                    <span className="block text-[12px] font-bold text-[var(--color-ink-soft)]">{tx('{price} F · puis {food} F le repas', { price: amount(k.price), food: amount(k.food) })}</span>
                  </span>
                </div>
                <p className="mt-2 text-[12.5px] leading-snug font-semibold text-[var(--color-ink)]">{k.about}</p>
                {naming?.kind.id === k.id ? (
                  <div className="mt-2.5 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {k.names.map((n) => (
                        <button key={n} className={`rounded-full px-3 py-1 text-[12.5px] font-extrabold ${naming.name === n ? 'bg-[var(--color-ink)] text-white' : 'bg-black/5'}`} onClick={() => setNaming({ kind: k, name: n })}>
                          {n}
                        </button>
                      ))}
                    </div>
                    <input className="w-full rounded-xl bg-black/5 px-3 py-2 text-sm font-bold" maxLength={20} value={naming.name} onChange={(e) => setNaming({ kind: k, name: e.target.value })} placeholder={t('Son nom')} />
                    <button className="btn w-full !py-2.5 !text-sm" disabled={sim.money < k.price || !naming.name.trim()} onClick={() => (run(t('Adopter {name}', { name: naming.name }), 'heart', () => api.adoptPet(sim.id, k.id, naming.name.trim())), setNaming(null))}>
                      {sim.money < k.price ? t('Pas assez d’argent') : tx('Adopter {name} · {price} F', { name: naming.name, price: amount(k.price) })}
                    </button>
                  </div>
                ) : (
                  <button className="btn btn-soft mt-2.5 w-full !py-2 !text-sm" onClick={() => setNaming({ kind: k, name: k.names[Math.floor(Math.random() * k.names.length)] })}>
                    {t('Choisir son nom')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Gauge({ label, value, color }: { label: string; value: number; color: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div>
      <div className="flex justify-between text-[11px] font-extrabold text-[var(--color-ink-soft)]">
        <span>{label}</span>
        <span>{Math.round(v)}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/10">
        <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: v < 25 ? '#e03131' : color }} />
      </div>
    </div>
  )
}
