import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../../../lib/native'
import { gesture } from '../../../../world3d/gesture'
import { Box } from '../../../../world3d/props'
import { Prop } from '../props'
import { JeuShell, Stage, Who, scoreOf } from '../Shell'
import type { EngineProps, Host, Jeu, PropId } from '../types'
import { t as tr } from '../../../../lib/i18n'

// The questions (the lecture, the hearing, the sermon): someone of the place stands behind the decor,
// which is their desk, and asks; three answers. Each question in its turn; the score, the right ones.

const shuffle = <T,>(a: T[]) => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map(([, v]) => v)
const oneOf = (l: string[]) => l[Math.floor(Math.random() * l.length)]

/** Behind the one who asks (the wall, a board on it) and on the desk before them, by who they are. */
const SET: Record<Host, { wall: string; board?: 'tableau' | 'bois' | 'rideau'; desk: PropId }> = {
  prof: { wall: '#e8dcc0', board: 'tableau', desk: 'livre' }, juge: { wall: '#5a3a22', board: 'bois', desk: 'marteau' }, imam: { wall: '#e6f0e8', board: 'rideau', desk: 'coran' },
  pasteur: { wall: '#efe4d2', board: 'rideau', desk: 'bible' }, pretre: { wall: '#ece6da', board: 'bois', desk: 'bible' }, medecin: { wall: '#e3f1f4', desk: 'stethoscope' }, agent: { wall: '#dfe4ea', desk: 'dossier' },
  policier: { wall: '#cfd8e3', desk: 'badge' }, chef: { wall: '#d9dde6', desk: 'dossier' }, guide: { wall: '#f1dfb8', board: 'tableau', desk: 'drapeau' }, collegue: { wall: '#dfe4ea', desk: 'ordinateur' },
  ami: { wall: '#f3d9b1', desk: 'telephone' }, amie: { wall: '#f6d6dc', desk: 'telephone' }, client: { wall: '#e9ecef', desk: 'billet' }, cliente: { wall: '#f6e2c8', desk: 'sac' }, vendeuse: { wall: '#f6e2c8', desk: 'caisse-enregistreuse' },
  patient: { wall: '#e3f1f4', desk: 'medicament' }, electeur: { wall: '#ffe8cc', desk: 'bulletin' }, enfant: { wall: '#fff3bf', desk: 'cahier' }, maman: { wall: '#f6e2c8', desk: 'marmite' }, papa: { wall: '#e9ddc7', desk: 'journal' },
  touriste: { wall: '#e7f5ff', desk: 'appareil-photo' }, vieux: { wall: '#e9ddc7', desk: 'calebasse' }, serveur: { wall: '#f1f3f5', desk: 'menu' },
}

// The one who asks stands on a floor below the decor, just behind it: its top is their desk.
const AT: [number, number, number] = [0, -1.0, -3.95]

function Backdrop({ host }: { host: Host }) {
  const s = SET[host]
  return (
    <group>
      <Box p={[0, 0.6, -5.2]} s={[9, 4.4, 0.2]} c={s.wall} />
      <Box p={[0, -1.05, -4.4]} s={[9, 0.1, 2]} c="#7a5a3c" />
      {s.board === 'tableau' && (
        <group position={[0, -0.9, -4.95]} scale={2.6}>
          <Prop id="tableau-noir" />
        </group>
      )}
      {s.board === 'bois' && (
        <group>
          <Box p={[0, 0.85, -5.05]} s={[3.6, 2.2, 0.1]} c="#7b4a2a" />
          <Box p={[0, 0.85, -5]} s={[3.2, 1.9, 0.06]} c="#9a6a3c" />
          {[-0.4, 0, 0.4].map((x, i) => (
            <Box key={x} p={[x, 1.75, -4.96]} s={[0.4, 0.12, 0.04]} c={['#f77f00', '#ffffff', '#009e60'][i]} />
          ))}
        </group>
      )}
      {s.board === 'rideau' && [-1.6, -0.8, 0, 0.8, 1.6].map((x, i) => <Box key={x} p={[x, 0.6, -5.05]} s={[0.8, 3.6, 0.1 + (i % 2) * 0.06]} c={i % 2 ? '#2f9e44' : '#37b24d'} />)}
    </group>
  )
}

/** The one who asks: swaying a little as they speak, a hop for a right answer, a shake for a wrong one. */
function Asker({ host, pose, beat }: { host: Host; pose: 'talk' | 'cheer' | 'rant'; beat: number }) {
  const g = useRef<THREE.Group>(null)
  const t = useRef(0)
  useEffect(() => void (t.current = 0), [beat])
  useFrame((_, dt) => {
    t.current += dt
    const k = t.current
    if (!g.current) return
    g.current.position.y = AT[1] + (pose === 'cheer' ? Math.max(0, Math.sin(Math.min(k, 0.6) * Math.PI * 1.67)) * 0.12 : 0)
    g.current.rotation.y = pose === 'rant' ? Math.sin(k * 26) * Math.max(0, 0.5 - k) * 0.3 : Math.sin(k * 0.8) * 0.05
  })
  return (
    <group ref={g} position={AT}>
      <Who host={host} seed={7} pose={pose} />
    </group>
  )
}

export function Quiz({ jeu, onEnd }: EngineProps<'quiz'>) {
  const qs = jeu.questions
  const [k, setK] = useState(0)
  const [chose, setChose] = useState<number | null>(null)
  const [pose, setPose] = useState<'talk' | 'cheer' | 'rant'>('talk')
  const [said, setSaid] = useState<string | null>(null)
  const [marks, setMarks] = useState<boolean[]>([])
  const st = useRef({ right: 0, over: false })
  const [q, answers, ok] = qs[k]
  // The answers in another order every question (the right one isn't always first).
  const order = useMemo(() => shuffle(answers.map((_, i) => i)), [k]) // eslint-disable-line react-hooks/exhaustive-deps
  const answer = (i: number) => {
    if (chose !== null || st.current.over) return
    setChose(i)
    const good = i === ok
    if (good) st.current.right++
    haptic(good ? 'success' : 'error')
    gesture(good ? 'cheer' : 'talk', 1200)
    setPose(good ? 'cheer' : 'rant')
    setMarks((m) => [...m, good])
    setSaid(good ? oneOf([tr('Bonne réponse !'), tr('Exactement !'), tr('Bravo, c’est ça !')]) : tr('Non… c’était « {0} ».', { 0: answers[ok] }))
    setTimeout(
      () => {
        setSaid(null)
        if (k + 1 >= qs.length) {
          st.current.over = true
          onEnd(scoreOf(st.current.right, qs.length))
          return
        }
        setChose(null)
        setPose('talk')
        setK(k + 1)
      },
      good ? 1100 : 1700,
    )
  }
  return (
    <JeuShell
      title={jeu.title}
      how={jeu.how}
      status={
        <span className="block">
          <span className="text-[11px] tracking-wider uppercase">
            Question {k + 1}/{qs.length}
          </span>
          <span className="mt-0.5 block font-display text-[16px] leading-snug [text-wrap:balance] text-[var(--color-ink)]">{q}</span>
        </span>
      }
      said={said}
      controls={order.map((i) => {
        const look = chose === null ? '' : i === ok ? '!bg-[#d3f9d8] ring-2 ring-[#2b8a3e]' : i === chose ? '!bg-[#ffe3e3] ring-2 ring-[#e03131]' : 'opacity-50'
        return (
          <button key={`${k}-${i}`} className={`tile flex min-h-[60px] flex-1 items-center justify-center px-2 py-2 text-center text-[14px] leading-tight font-extrabold text-[var(--color-ink)] transition active:scale-[0.97] ${look}`} onClick={() => answer(i)} aria-disabled={chose !== null}>
            {answers[i]}
          </button>
        )
      })}
    >
      <Stage decor={jeu.decor} cam={[0, 0.3, -1.95]} look={[0, 0.5, -3.95]} fov={38}>
        <Backdrop host={jeu.host} />
        <Asker host={jeu.host} pose={pose} beat={k * 2 + (chose === null ? 0 : 1)} />
        {/* On the desk, their thing; up on the wall, a block for each question (yellow the one asked, then green or red) */}
        <group position={[0.42, 0, -3.42]} rotation={[0, -0.5, 0]} scale={0.3}>
          <Prop id={SET[jeu.host].desk} />
        </group>
        {qs.map((_, i) => (
          <Box key={i} p={[-0.95 + i * 0.17, 1.22, -5.02]} s={[0.12, 0.12, 0.12]} c={marks[i] === undefined ? (i === k ? '#ffd43b' : '#f8f9fa') : marks[i] ? '#2f9e44' : '#e03131'} />
        ))}
      </Stage>
    </JeuShell>
  )
}

/** A game to try it on the lab page (?g=demo:quiz). */
export const demo: Extract<Jeu, { engine: 'quiz' }> = {
  engine: 'quiz', title: tr('Le cours d’éco'), how: tr('Le prof interroge l’amphi : touche la bonne réponse.'), decor: 'bureau', host: 'prof',
  questions: [
    [tr('La monnaie qu’on utilise à Abidjan ?'), [tr('Le franc CFA'), tr('Le naira'), tr('Le cédi')], 0],
    [tr('Ce que la Côte d’Ivoire exporte le plus ?'), [tr('Le café'), tr('Le cacao'), tr('Le coton')], 1],
    [tr('Tu vends 10 garbas à 500 F. Ta recette ?'), [tr('500 F'), tr('5 000 F'), tr('50 000 F')], 1],
    [tr('Les prix montent partout, c’est…'), [tr('L’inflation'), tr('La récession'), tr('Le bénéfice')], 0],
    [tr('Tes gains moins tes dépenses, c’est…'), [tr('Le chiffre d’affaires'), tr('Le bénéfice'), tr('La taxe')], 1],
  ],
}
