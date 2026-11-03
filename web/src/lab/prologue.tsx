import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import '../index.css'
import { Shot3D } from '../components/prologue/Shot3D'
import { PrologueFilm } from '../components/prologue/PrologueFilm'
import { PrologueBD } from '../components/prologue/PrologueBD'
import { loadScenario } from '../components/prologue/lines'
import type { Scenario } from '../components/prologue/types'

// A lab page for the stories' prologues (components/prologue): ?id=<story> plays the film; &bd=1 the
// comic; &shot=<n>&t=<s> one shot's still (tools/prologues/panels.mjs draws the comic's panels with it).
const q = new URLSearchParams(location.search)
const id = q.get('id') ?? 'cour-hantee'

function Lab() {
  const [s, setS] = useState<Scenario | null>(null)
  useEffect(() => void loadScenario(id).then(setS), [])
  if (!s) return null
  if (q.has('shot')) {
    const shot = s.shots[Number(q.get('shot'))]
    return (
      <div style={{ position: 'fixed', inset: 0 }}>
        <Canvas shadows dpr={2} camera={{ fov: 40, near: 0.1, far: 120 }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
          <Shot3D scenario={s} shot={shot} t={Number(q.get('t') ?? shot.dur / 2)} />
        </Canvas>
      </div>
    )
  }
  if (q.has('bd')) return <PrologueBD scenario={s} onClose={() => undefined} />
  return <PrologueFilm scenario={s} onClose={() => undefined} />
}

createRoot(document.getElementById('root')!).render(<Lab />)
