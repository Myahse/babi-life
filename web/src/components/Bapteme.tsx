import { useEffect, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Gift, PartyPopper } from 'lucide-react'
import type { ActionResult, Sim } from '../lib/types'
import { api } from '../lib/api'
import { sceneDpr } from '../lib/device'
import { randomLook } from '../avatar/options'
import { familyCast } from '../avatar/Family'
import { Character } from '../world3d/Character'
import { Box } from '../world3d/props'
import { rng } from '../world3d/themes'
import type { Pose } from '../avatar/Human'

// The baptism (the update « bapteme »): once, in the baby's first days. The
// family's courtyard under the bâche, the plastic chairs in a ring, the
// tantes and the tontons dancing, the grand-mère holding the baby and
// whispering its name; then the presents (backend sims/bapteme.go). Seen as
// a little film, a line at a time, the camera turning slowly round.

const LINES = (name: string) => [
  'Dans la cour, sous la bâche, toute la famille est là : les tantes, les tontons, les voisins.',
  'La grand-mère te prend dans ses bras et te murmure ton nom à l’oreille…',
  `« ${name} ! » Tout le monde applaudit, les you-yous fusent.`,
  'On danse, on mange l’attiéké et le poulet braisé, on te couvre de bisous.',
]

function Turn() {
  useFrame(({ camera, clock }) => {
    // Under the bâche, a slow turn round the grand-mère and the baby, from just outside the ring.
    const a = 0.2 + Math.sin(clock.elapsedTime * 0.06) * 0.7
    camera.position.set(Math.sin(a) * 4.6, 2.3, Math.cos(a) * 4.6)
    camera.lookAt(0, 0.95, 0)
  })
  return null
}

/** The courtyard, the family and the guests (line: how far the film has gone; from the third line on, they dance). Also in the baby video (lab/bebeFilm.tsx). */
export function BaptemeSet({ sim, line }: { sim: Pick<Sim, 'id' | 'look' | 'gender' | 'family'>; line: number }) {
  const cast = useMemo(() => familyCast(sim.family ?? 'poignon', sim.look), [sim.family, sim.look])
  // The guests: the same ones each time for this baby.
  const guests = useMemo(() => {
    const r = rng(`bapteme:${sim.id}`)
    return [...Array(8)].map((_, i) => {
      const gender: 'femme' | 'homme' = i % 2 ? 'homme' : 'femme'
      const l = randomLook(gender, r)
      return { gender, look: { ...l, outfit: gender === 'femme' ? 'pagne' : 'boubou', accessory: 'none' }, pose: (['dance', 'clap', 'dance', 'cheer'] as Pose[])[i % 4] }
    })
  }, [sim.id])
  const granny = useMemo(() => ({ ...cast.maman.look, hair: 'headwrap', outfit: 'pagne', outfitColor: '#7b2cbf', skin: cast.maman.look.skin }), [cast])
  return (
    <>
      <hemisphereLight args={['#fff6e8', '#8a6a40', 1.3]} />
      <directionalLight position={[5, 10, 6]} intensity={1.3} />
      {/* The courtyard's red earth, the bâche over it on its poles, the ring of chairs */}
      <Box p={[0, -0.05, 0]} s={[16, 0.1, 16]} c="#c98a52" />
      <Box p={[0, 3.4, 0]} s={[12, 0.08, 10]} c="#f2f2f2" />
      {[-5.9, 5.9].map((x) => [-4.9, 4.9].map((z) => <Box key={`${x}${z}`} p={[x, 1.7, z]} s={[0.08, 3.4, 0.08]} c="#9aa1a8" />))}
      {[...Array(10)].map((_, i) => {
        const a = (i / 10) * Math.PI * 2
        // The plastic chairs: the seat, the back (turned to the middle)
        const c = i % 2 ? '#e8590c' : '#1971c2'
        return (
          <group key={i} position={[Math.cos(a) * 3.4, 0, Math.sin(a) * 2.8]} rotation={[0, -a - Math.PI / 2, 0]}>
            <Box p={[0, 0.42, 0]} s={[0.42, 0.05, 0.4]} c={c} />
            <Box p={[0, 0.68, -0.19]} s={[0.42, 0.5, 0.04]} c={c} />
            {[-0.18, 0.18].map((x) => [-0.17, 0.17].map((z) => <Box key={`${x}${z}`} p={[x, 0.2, z]} s={[0.04, 0.42, 0.04]} c={c} />))}
          </group>
        )
      })}
      {/* The grand-mère in the middle, the baby in her arms; papa and maman beside them */}
      <group position={[0, 0, 0]}>
        <Character look={granny} gender="femme" stage="adulte" pose="hug" marker={false} seed={31} />
        <group position={[0, 0.95, 0.28]} rotation={[-0.5, 0, 0]}>
          <Character look={sim.look} gender={sim.gender} stage="bebe" pose="idle" marker={false} seed={1} />
        </group>
      </group>
      <group position={[-1.1, 0, 0.2]} rotation={[0, 0.5, 0]}>
        <Character look={cast.papa.look} gender="homme" stage="adulte" pose={line >= 2 ? 'cheer' : 'clap'} marker={false} seed={32} />
      </group>
      <group position={[1.1, 0, 0.2]} rotation={[0, -0.5, 0]}>
        <Character look={cast.maman.look} gender="femme" stage="adulte" pose={line >= 2 ? 'cheer' : 'clap'} marker={false} seed={33} />
      </group>
      {guests.map((g, i) => {
        // In an arc behind the grand-mère (the camera's side stays open, she and the baby in full view).
        const a = Math.PI + 0.25 + (i / (guests.length - 1)) * (Math.PI - 0.5)
        return (
          <group key={i} position={[Math.cos(a) * 2.6, 0, Math.sin(a) * 2.0]} rotation={[0, -a - Math.PI / 2, 0]}>
            <Character look={g.look} gender={g.gender} stage="adulte" pose={line >= 2 ? g.pose : 'clap'} marker={false} seed={40 + i} />
          </group>
        )
      })}
    </>
  )
}

export function Bapteme({ sim, onResult, onEnd }: { sim: Sim; onResult: (r: ActionResult) => void; onEnd: () => void }) {
  const [line, setLine] = useState(0)
  const [gift, setGift] = useState<string | null>(null)
  const lines = LINES(sim.firstName)
  useEffect(() => {
    if (line >= lines.length - 1) return
    const k = setTimeout(() => setLine(line + 1), 4200)
    return () => clearTimeout(k)
  }, [line, lines.length])
  const thank = async () => {
    try {
      const r = await api.baptise(sim.id)
      onResult(r)
      setGift(r.outcome.text)
    } catch {
      onEnd()
    }
  }
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#f7d9a8]">
      <div className="relative min-h-0 flex-1">
        <Canvas dpr={sceneDpr} camera={{ fov: 45 }}>
          <Turn />
          <BaptemeSet sim={sim} line={line} />
        </Canvas>
        <div className="pointer-events-none absolute inset-x-0 top-[max(1rem,env(safe-area-inset-top))] text-center">
          <span className="rounded-full bg-black/45 px-4 py-2 text-[13px] font-extrabold tracking-wider text-white uppercase">Le baptême de {sim.firstName}</span>
        </div>
      </div>
      <div className="bg-white px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {gift ? (
          <>
            <p className="flex gap-2 text-[15px] leading-snug font-bold text-[var(--color-ink)]">
              <Gift size={20} className="mt-0.5 shrink-0 text-[var(--color-orange)]" /> {gift}
            </p>
            <button className="btn mt-4 w-full" onClick={onEnd}>
              Merci la famille !
            </button>
          </>
        ) : (
          <>
            <p key={line} className="animate-pop min-h-[3.5rem] text-[16px] leading-snug font-extrabold text-[var(--color-ink)]">
              {lines[line]}
            </p>
            <button className="btn mt-3 w-full" onClick={() => (line < lines.length - 1 ? setLine(line + 1) : void thank())}>
              {line < lines.length - 1 ? 'Suite' : (
                <>
                  <PartyPopper size={18} /> Ouvrir les cadeaux
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
