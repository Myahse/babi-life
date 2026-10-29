import { useEffect, useState } from 'react'
import { Beer, Banana, Fish, Sparkles, GraduationCap, ShoppingCart, Trophy, Waves, Coffee, Gamepad2, Car, Swords, Joystick, X, Baby, Blocks, Footprints, Music, type LucideIcon } from 'lucide-react'
import { api } from '../lib/api'
import { haptic } from '../lib/native'
import type { ActionResult, Look } from '../lib/types'
import { IconTile } from './ui'
import { ChallengeButton } from './SharedCard'
import { TeaDefi } from './defi/Tea'
import { CoursesDefi } from './defi/Courses'
import { SkiDefi } from './defi/Ski'
import { FootDefi } from './defi/Foot'
import { CourseDefi } from './defi/Course'
import { CombatDefi } from './defi/Combat'
import { MoustiquesDefi } from './defi/Moustiques'
import { EcoleDefi } from './defi/Ecole'
import { CoucouDefi, CubesDefi, HochetDefi, PasDefi } from './defi/Bebe'
import { GESTES, GestesDefi, gesteOf, type GesteKind } from './defi/Gestes'
import { GarbaDefi } from './defi/Garba'
import { setLifted } from '../world3d/chatFraming'
import { BarDefi } from './defi/Bar'
import { DodoDefi } from './defi/Reve'
import { AllocoDefi } from './defi/Alloco'

// Les défis: while making tea at the grin, water-skiing off Île Boulay, doing
// the shopping or playing at the salle de jeux vidéo (the foot, the car race,
// the fighting game, the arcade's mosquitoes: real games there), the player
// can take it on as a little game with an action button (components/defi/*). How it's played first, the game, then the score
// out of 100 and what it earned (backend sims/defi.go: once each time, a small
// bonus, the best score kept as a record to beat).

export type DefiKind = 'the' | 'ski' | 'courses' | 'foot' | 'course' | 'combat' | 'arcade' | 'ecole' | 'coucou' | 'cubes' | 'pas' | 'hochet' | 'bagarre' | GesteKind | 'geste' | 'garba' | 'alloco' | 'bar'
/** The baby's games (the update « bebe-jeux »). */
export const BABY_DEFIS = new Set<DefiKind>(['coucou', 'cubes', 'pas', 'hochet'])
/** The home's gestures (the update « gestes-maison »): played, the action is done. */
export const GESTE_DEFIS = new Set<DefiKind>([...(Object.keys(GESTES) as GesteKind[]), 'geste', 'garba', 'alloco', 'bar'])

/** The défi of an activity (backend sims/defi.go defiFor says the same), or null. The pousse-pousse's tea is served: no défi. */
export const defiOf = (interactionId?: string): DefiKind | null =>
  ({ 'street-grin': 'the', 'chat-grin': 'the', 'ski-boulay': 'ski', supermarche: 'courses', courses: 'courses', 'console-foot': 'foot', 'console-defi': 'foot', 'tournoi-console': 'foot', 'console-course': 'course', 'console-combat': 'combat', 'borne-arcade': 'arcade', 'maison-foot': 'foot', 'maison-course': 'course', 'maison-combat': 'combat', 'aller-ecole': 'ecole', coucou: 'coucou', cubes: 'cubes', 'premiers-pas': 'pas', hochet: 'hochet', 'bagarre-bebe': 'bagarre', 'eat-garba': 'garba', 'eat-alloco': 'alloco', 'drink-with-friends': 'bar' } as Record<string, DefiKind>)[interactionId ?? ''] ?? gesteOf(interactionId)

/** The foot's three ways: a match, the challenge where the loser pays, the Saturday tournament. */
const footMode = (interactionId?: string) => (interactionId === 'console-defi' ? 'defi' : interactionId === 'tournoi-console' ? 'tournoi' : 'match')
const FOOT: Record<ReturnType<typeof footMode>, { title: string; button: string; how: string }> = {
  match: { title: 'Babi Foot à la console', button: 'Jouer à Babi Foot', how: 'Match rapide : le format (5 contre 5 au maracana ou 11 contre 11 au stade), les deux équipes, la difficulté, la durée. Ou la Coupe : huit équipes, élimination directe, un nul aux tirs au but ou au but en or.' },
  defi: { title: 'Le défi du quartier', button: 'Jouer le défi', how: 'Contre le caïd du quartier : gagné, il te paie ta mise ; perdu, tu paies.' },
  tournoi: { title: 'Le tournoi du samedi', button: 'Jouer le tournoi', how: 'Quart, demi, finale, chaque équipe plus forte que la précédente ; un nul se joue au but en or. La coupe : 2 000 Djai ; la finale : 800. Un tournoi par jour.' },
}

// The home's gestures: played over the house, the Sim seen making each one.
const DODO_HOW = ['Fais le lit, brosse-toi les dents, éteins la lumière, couche-toi : quelques flèches, et tu vois ton perso le faire.', 'Puis tu rêves, sur un matelas volant au-dessus d’Abidjan : touche pour monter, lâche pour descendre, attrape les étoiles (un mouton en vaut deux).', 'Les cauchemars (le moustique géant, la facture de la CIE, le maître et sa chicotte) te font perdre des étoiles ; trois, et tu te réveilles.']
const GESTE_HOW = ['Chaque étape est une combinaison de flèches : enchaîne-les avant la fin du temps.', 'Chaque flèche juste, ton perso fait le geste. Une erreur, et la combinaison recommence.', 'La dernière étape faite, c’est fait : pas besoin d’attendre.']
const DEFIS: Record<DefiKind, { title: string; button: string; icon: LucideIcon; colors: [string, string]; how: string[]; bg: string }> = {
  garba: {
    title: 'Le garba',
    button: 'Manger ton garba',
    icon: Fish,
    colors: ['#ffa94d', '#e8590c'],
    how: ['La tantie annonce un poisson : pioche-le dans l’huile avant les mains des autres clients.', 'Puis mange : pique les grains, ou tiens « Pommer » et lâche dans le vert pour une grosse boule.', 'L’attiéké ne passe pas facilement : surveille ta gorge et bois de l’eau, sinon tu t’étouffes.'],
    bg: 'transparent',
  },
  alloco: {
    title: 'L’alloco',
    button: 'Prendre ton alloco',
    icon: Banana,
    colors: ['#ffd43b', '#f08c00'],
    how: ['Avec un œuf ? 100 Djai de plus.', 'La tantie verse l’alloco : glisse le papier dessous et attrape tout.', 'Avec l’œuf : écaille-le, chaque morceau de coquille.'],
    bg: 'transparent',
  },
  bar: {
    title: 'Le pot au maquis',
    button: 'S’asseoir à la table',
    icon: Beer,
    colors: ['#ffd166', '#e8a400'],
    how: ['« Boire » une gorgée à la fois : l’ambiance monte… et l’alcool aussi.', 'Le verre vide : « Resservir » (une tournée, 500 Djai). « Billets » : lance l’argent, la table s’enflamme (payé).', 'Surveille l’alcool, bois de l’eau : au trait rouge, tu es soûl et la soirée finit mal. « Se lever » quand l’ambiance est au top.'],
    bg: 'transparent',
  },
  geste: { title: 'L’action', button: 'Jouer l’action', icon: Sparkles, colors: ['#ffc233', '#e09a00'], how: GESTE_HOW, bg: 'transparent' },
  ...(Object.fromEntries(Object.entries(GESTES).map(([k, g]) => [k, { ...g, how: k === 'dodo' ? DODO_HOW : GESTE_HOW, bg: 'transparent' }])) as Record<GesteKind, { title: string; button: string; icon: LucideIcon; colors: [string, string]; how: string[]; bg: string }>),
  the: {
    title: 'Le thé du grin',
    button: 'Défi : fais le thé',
    icon: Coffee,
    colors: ['#ff9a3c', '#c8641e'],
    how: ['Garde le doigt sur « Verser » : le thé coule, et la main lève la théière.', "Versé de haut, ça mousse… mais trop haut, ça éclabousse. Lâche, et reverse.", 'Remplis jusqu\'au trait et sers. Trois verres, comme au grin.'],
    bg: 'linear-gradient(#141735, #2a1c2c)',
  },
  ski: {
    title: 'Le slalom de Boulay',
    button: 'Défi : le slalom',
    icon: Waves,
    colors: ['#3ba7ff', '#1c6fd6'],
    how: ['Tiens ◀ ou ▶ pour te déporter derrière le bateau.', "Passe chaque bouée par l'extérieur.", 'Aux tremplins : reviens au milieu et touche « Sauter » juste avant.'],
    bg: 'transparent',
  },
  foot: {
    title: 'Le foot à la console',
    button: 'Jouer le match',
    icon: Gamepad2,
    colors: ['#ff9a3c', '#e8590c'],
    how: ['Le stick à gauche fait courir ton joueur, « Sprint » tenu le fait accélérer (il s\'essouffle).', '« Passe », « Profondeur », « Centre », « Crochet » ; « Tir » tenu charge la frappe, le stick vise.', 'Sans le ballon : « Changer » de joueur, « Tacle » pour le reprendre. L\'arbitre siffle les fautes.'],
    bg: '#0b1a10',
  },
  course: {
    title: 'La course à deux',
    button: 'Jouer la course',
    icon: Car,
    colors: ['#4dabf7', '#1c7ed6'],
    how: ['La voiture accélère toute seule : ◀ ▶ pour tourner, « Frein » avant les virages serrés.', 'Frein tenu en tournant vite : tu dérapes ; lâche, c\'est le mini-turbo. Les murs et les voitures te ralentissent.', 'Frôle les woro-woros et les gbakas, suis l\'autre de près : ta jauge de « Nitro » se remplit. Deux tours pour gagner.'],
    bg: '#0d1b2a',
  },
  combat: {
    title: 'Le combat de rue',
    button: 'Jouer le combat',
    icon: Swords,
    colors: ['#ff6b6b', '#c92a2a'],
    how: ['◀ ▶ pour bouger (deux fois vite : un pas rapide), ▲ pour sauter, ▼ pour t\'accroupir.', '« Poing » trois fois : jab, direct, uppercut. « Pied » : le coup de pied haut ; avec ▼ : le balayage.', '« Garde » tenue pare (accroupi pour les coups bas). Garde + Poing tout près : la saisie. Jauge pleine : « Super ». Deux rounds pour gagner.'],
    bg: '#120d24',
  },
  arcade: {
    title: 'Moustiques !',
    button: 'Jouer à la borne',
    icon: Joystick,
    colors: ['#b197fc', '#7048e8'],
    how: ['Glisse le doigt : la bombe PAF suit, et tire toute seule.', 'Les moustiques tigres prennent trois coups. Attrape la spirale verte : tir triple.', 'Trois piqûres et c\'est fini. À 45 secondes, le Gros Moustique arrive.'],
    bg: '#070a1c',
  },
  ecole: {
    title: 'La leçon du maître',
    button: 'Lever la main',
    icon: GraduationCap,
    colors: ['#4dabf7', '#1864ab'],
    how: ['Le maître pose six questions à la classe : calcul, français, la Côte d’Ivoire…', 'Lève la main : touche la bonne réponse parmi les trois.', 'Beaucoup de bonnes réponses : le maître te félicite, et ça compte pour le bac.'],
    bg: 'linear-gradient(#1b3a2c, #0f2219)',
  },
  coucou: {
    title: 'Coucou-caché',
    button: 'Jouer à coucou-caché',
    icon: Baby,
    colors: ['#ff8fb1', '#e64980'],
    how: ['Maman cache son visage dans ses mains.', 'Quand elle les ouvre (« Coucou ! »), touche « Rire » le plus vite possible.', 'Trop tôt, ça ne compte pas. Six fois.'],
    bg: 'linear-gradient(#ffb3c8, #e64980)',
  },
  cubes: {
    title: 'La tour de cubes',
    button: 'Jouer aux cubes',
    icon: Blocks,
    colors: ['#4dabf7', '#1c7ed6'],
    how: ['Le cube glisse d’un côté à l’autre : touche pour le lâcher.', 'Ce qui dépasse du cube du dessous tombe : le suivant est plus petit.', 'Huit cubes, la tour la plus large possible.'],
    bg: 'linear-gradient(#74c0fc, #1c7ed6)',
  },
  pas: {
    title: 'Les premiers pas',
    button: 'Faire ses premiers pas',
    icon: Footprints,
    colors: ['#69db7c', '#2f9e44'],
    how: ['Bébé marche vers papa, mais ça tangue !', 'Garde l’aiguille dans le vert : tiens « Pencher » du côté opposé.', 'Trop penché, boum, on tombe et on se relève. Vite et sans tomber : le meilleur score.'],
    bg: 'linear-gradient(#8ce99a, #2f9e44)',
  },
  hochet: {
    title: 'Le hochet en rythme',
    button: 'Secouer en rythme',
    icon: Music,
    colors: ['#b197fc', '#7048e8'],
    how: ['Un cercle se resserre sur l’anneau jaune, à chaque temps.', 'Secoue le hochet pile quand il le touche.', 'Douze temps : parfait, bien, presque… ou raté.'],
    bg: 'linear-gradient(#4b2e83, #2b1d4a)',
  },
  bagarre: {
    title: 'La bagarre de bébés',
    button: 'Se bagarrer !',
    icon: Swords,
    colors: ['#ff8fb1', '#e64980'],
    how: ['Le cousin veut ton jouet : défends-le ! Les mêmes coups que le combat de rue, en tout petit.', '◀ ▶ pour avancer à quatre pattes… enfin presque. « Poing » : les petites tapes ; « Pied » : le coup de pied de bébé.', '« Garde » tenue pare. Jauge pleine : la « Colère de bébé ». Deux rounds pour garder le jouet.'],
    bg: '#2a1838',
  },
  courses: {
    title: 'La liste de courses',
    button: 'Défi : la liste',
    icon: ShoppingCart,
    colors: ['#00b86b', '#00894f'],
    how: ['Les rayons défilent : touche ce qui est sur ta liste pour le mettre au panier.', "Pas d'achat en trop : chaque erreur coûte 2 secondes.", 'Tout trouvé, et vite : tu économises sur tes courses.'],
    bg: 'linear-gradient(#1b1f4b, #0f1230)',
  },
}

/** The games the phone's « Jeux » plays for practice, without network too (the ski needs the lagoon's 3D: not there). */
export const PRACTICE: DefiKind[] = ['foot', 'course', 'combat', 'arcade', 'the', 'courses']
/** A défi's name, icon and colours, for a list. */
export const defiLook = (kind: DefiKind) => ({ title: DEFIS[kind].title, icon: DEFIS[kind].icon, colors: DEFIS[kind].colors })

/** The défi to take on during the activity: a gold button under its card. */
export function DefiButton({ kind, interactionId, onClick }: { kind: DefiKind; interactionId?: string; onClick: () => void }) {
  return (
    <button className="btn animate-pop mt-2 w-full !bg-[#ffc233] !py-2.5 !text-sm !text-[#16161c] shadow-[0_4px_0_#e09a00]" onClick={onClick}>
      <Trophy size={17} strokeWidth={2.6} /> {kind === 'foot' ? FOOT[footMode(interactionId)].button : DEFIS[kind].button}
    </button>
  )
}

const stars = (score: number) => (score >= 85 ? 3 : score >= 50 ? 2 : score >= 15 ? 1 : 0)

/** The défi: how it's played, the game, the score and what it earned. */
export function DefiSheet({ kind, act, simId, big, older, interactionId, practice, send, challenge, me, onResult, onClose }: { /** Any action played as gestures: which (its name is the title, its icon its kind). */ act?: { id: string; label: string; icon: string }; /** At school, a teenager: the harder questions. */ older?: boolean; kind: DefiKind; simId: string; /** The player's Sim, to play as itself (the fight; the foot's career: its money, its commune). */ me?: { look: Look; gender: 'femme' | 'homme'; money?: number; homeCommune?: string }; /** Something bought along the way (a signing in the foot's career): the server's answer, applied to the Sim. */ onResult?: (r: ActionResult) => void; /** The shopping at the supermarket: the longer list. */ big?: boolean; /** The activity it's played during (the foot's match, challenge or tournament). */ interactionId?: string; /** Played from the phone's « Jeux », for practice: nothing sent, nothing earned. */ practice?: boolean; /** The score sent: the server's answer (applied to the Sim), or null if it failed. */ send?: (score: number, extra?: string) => Promise<ActionResult | null>; /** Taken on from someone's score (a message, a link): played for the fun of it, nothing sent. */ challenge?: { score: number; from: string }; onClose: () => void }) {
  const mode = footMode(challenge ? undefined : interactionId)
  const d = kind === 'foot' ? { ...DEFIS.foot, title: FOOT[mode].title, how: [...DEFIS.foot.how, FOOT[mode].how] } : kind === 'geste' && act ? { ...DEFIS.geste, title: act.label } : DEFIS[kind]
  const [phase, setPhase] = useState<'intro' | 'play' | 'result'>('intro')
  const [best, setBest] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [said, setSaid] = useState<string | null>(null)
  // The fight and the race: their opponent chosen, the match on (the close button moves out of the bars' way).
  const [inMatch, setInMatch] = useState(false)
  useEffect(() => {
    void api
      .defis(simId)
      .then((r) => setBest(r.best[kind] ?? 0))
      .catch(() => setBest(0))
  }, [simId, kind])
  const end = async (s: number, extra?: string) => {
    if (s >= 50) haptic('success')
    setScore(s)
    setPhase('result')
    if (practice) return setSaid(best && s > best ? 'Nouveau record d’entraînement ! Le vrai défi se joue sur place (la salle de jeux, le grin, le supermarché).' : 'Entraînement : rien n’est envoyé. Le vrai défi se joue sur place, et il rapporte.')
    if (challenge) return setSaid(s > challenge.score ? `Tu as battu ${challenge.from} (${challenge.score}) ! Renvoie-lui ton score.` : s === challenge.score ? `Égalité avec ${challenge.from} : ${s} partout !` : `${challenge.from} reste devant avec ${challenge.score}. Retente !`)
    const r = await send?.(s, extra)
    setSaid(r?.outcome.text.replace(/^Défi \d+\/100\. /, '') ?? null)
  }
  const ski = kind === 'ski'
  // Played over the scene (the house, the maquis): the picture lifted so the Sim is seen above the game.
  useEffect(() => {
    if (!GESTE_DEFIS.has(kind) || practice || challenge) return
    setLifted(true)
    return () => setLifted(false)
  }, [kind, practice, challenge])
  // Over the scene (the lagoon, the house): the intro dims it, the game leaves it seen.
  const over = ski || GESTE_DEFIS.has(kind)
  const n = stars(score)
  // On a computer, Échap leaves the game (nothing sent: it can be played again later).
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ background: phase === 'play' || !over ? d.bg : 'rgba(15,18,48,0.35)' }}>
      {phase === 'play' &&
        (kind === 'the' ? (
          <TeaDefi onEnd={(s) => void end(s)} />
        ) : kind === 'courses' ? (
          <CoursesDefi big={!!big} onEnd={(s) => void end(s)} />
        ) : kind === 'foot' ? (
          <FootDefi mode={mode} me={me} simId={simId} onResult={onResult} onQuit={onClose} onEnd={(s) => void end(s)} />
        ) : kind === 'course' ? (
          <CourseDefi onStart={setInMatch} onEnd={(s) => void end(s)} />
        ) : kind === 'combat' || kind === 'bagarre' ? (
          <CombatDefi me={me} baby={kind === 'bagarre'} onStart={setInMatch} onEnd={(s) => void end(s)} />
        ) : kind === 'arcade' ? (
          <MoustiquesDefi onEnd={(s) => void end(s)} />
        ) : kind === 'ecole' ? (
          <EcoleDefi older={!!older} onEnd={(s) => void end(s)} />
        ) : kind === 'coucou' ? (
          <CoucouDefi onEnd={(s) => void end(s)} />
        ) : kind === 'cubes' ? (
          <CubesDefi onEnd={(s) => void end(s)} />
        ) : kind === 'pas' ? (
          <PasDefi onEnd={(s) => void end(s)} />
        ) : kind === 'hochet' ? (
          <HochetDefi onEnd={(s) => void end(s)} />
        ) : kind === 'dodo' ? (
          <DodoDefi nap={interactionId === 'nap'} look={me?.look} gender={me?.gender} onEnd={(s) => void end(s)} />
        ) : kind === 'bar' ? (
          <BarDefi money={me?.money ?? 0} onEnd={(s, extra) => void end(s, extra)} />
        ) : kind === 'garba' ? (
          <GarbaDefi onEnd={(s) => void end(s)} />
        ) : kind === 'alloco' ? (
          <AllocoDefi onEnd={(s, egg) => void end(s, egg ? 'oeuf' : undefined)} />
        ) : GESTE_DEFIS.has(kind) ? (
          <GestesDefi kind={kind as GesteKind | 'geste'} act={act} look={me?.look} gender={me?.gender} onEnd={(s) => void end(s)} />
        ) : (
          <SkiDefi onEnd={(s) => void end(s)} />
        ))}
      {/* Left halfway: nothing sent, the défi can be taken on again */}
      {phase === 'play' && kind !== 'foot' && (
        <button className={`absolute right-2 z-20 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white ${inMatch && (kind === 'combat' || kind === 'bagarre') ? 'top-[96px]' : inMatch && kind === 'course' ? 'top-[150px]' : 'top-12'}`} onClick={onClose} aria-label="Quitter la partie">
          <X size={17} strokeWidth={2.6} />
        </button>
      )}
      {phase === 'intro' && (
        <div className={`flex flex-1 flex-col p-4 ${ski ? 'justify-end' : 'justify-center'}`}>
          <div className="card animate-pop mx-auto w-full max-w-[380px] p-4">
            <div className="flex items-center gap-3">
              <IconTile icon={d.icon} colors={d.colors} size={48} />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="label">Défi</div>
                <div className="font-display text-[19px] font-extrabold">{d.title}</div>
              </div>
              {!!best && (
                <span className="flex items-center gap-1 rounded-full bg-[#fff3c4] px-2.5 py-1 text-[12px] font-extrabold text-[#a06a00]">
                  <Trophy size={13} /> {best}
                </span>
              )}
            </div>
            {challenge && (
              <div className="mt-3 flex items-center gap-2 rounded-2xl bg-[#fff3c4] px-3 py-2 text-[13px] leading-snug font-extrabold text-[#7a5200]">
                <Trophy size={16} className="shrink-0" /> {challenge.from} a fait {challenge.score}/100. À toi de faire mieux !
              </div>
            )}
            <ol className="mt-3 space-y-1.5 text-[14px] leading-snug font-bold text-[var(--color-ink)]">
              {d.how.map((h, k) => (
                <li key={k} className="flex gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-canvas)] text-[11px] font-extrabold">{k + 1}</span>
                  {h}
                </li>
              ))}
            </ol>
            <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
              <button className="btn btn-soft !py-2.5 !text-sm" onClick={onClose}>
                Plus tard
              </button>
              <button className="btn !bg-[#ffc233] !py-2.5 !text-sm !text-[#16161c] shadow-[0_4px_0_#e09a00]" onClick={() => setPhase('play')}>
                <Trophy size={16} /> C'est parti !
              </button>
            </div>
          </div>
        </div>
      )}
      {phase === 'result' && (
        <div className="absolute inset-0 grid place-items-center bg-[#0f1230]/55 p-5">
          <div className="card animate-pop w-full max-w-[340px] p-5 text-center">
            <div className="label">{d.title}</div>
            <div className="mt-1 font-display text-[54px] leading-none font-extrabold">{score}</div>
            <div className="text-[13px] font-extrabold text-[var(--color-ink-soft)]">sur 100</div>
            <div className="mt-2 flex justify-center gap-1">
              {[0, 1, 2].map((k) => (
                <span key={k} className="animate-pop font-display text-[34px] leading-none" style={{ color: k < n ? '#ffc233' : '#dfe2ec', animationDelay: `${200 + k * 180}ms` }}>
                  ★
                </span>
              ))}
            </div>
            {best !== null && best > 0 && score > best && <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#fff3c4] px-3 py-1 text-[13px] font-extrabold text-[#a06a00]"><Trophy size={14} /> Nouveau record !</div>}
            <p className="mt-3 min-h-[40px] text-[14px] leading-snug font-bold text-[var(--color-ink)]">{said ?? '…'}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {challenge || practice ? (
                <button className="btn btn-soft !py-2.5 !text-sm" onClick={() => (setSaid(null), setPhase('play'))}>
                  Rejouer
                </button>
              ) : null}
              <button className={`btn !py-2.5 ${challenge || practice ? '' : 'col-span-2'}`} onClick={onClose}>
                Super !
              </button>
            </div>
            {/* (The home's gestures are no challenge to send: the action, done.) */}
            {!GESTE_DEFIS.has(kind) && <ChallengeButton kind={kind} score={score} title={d.title} />}
          </div>
        </div>
      )}
    </div>
  )
}
