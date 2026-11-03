import type { Look } from '../../lib/types'
import type { Pose } from '../../avatar/Human'

// The stories' prologues (the update « histoires », backend game/stories.go): each story's opening
// told as a little film and as an animated comic, from one script (scenarios/<story id>.json): its
// cast, then its shots. The film (PrologueFilm) plays the shots in 3D with the game's detailed persos,
// the camera moving, the lines said (Lea the narrator, a voice for each character) and written under;
// the comic (PrologueBD) shows each shot as a panel (drawn once: public/prologues/<id>/<n>.jpg), its
// line in a bubble or the narrator's box. tools/voix/prologues.mjs records the lines.

export type Vec = [number, number, number]

/** Someone of the story: their name (said over their lines), how they look, their voice (ElevenLabs). */
export type CastMember = {
  name: string
  gender: 'femme' | 'homme'
  look: Partial<Look>
  voice?: string
  body?: Look['body']
}

/** One of the cast in a shot: where, which way, doing what; a pose then another; walking somewhere. */
export type Actor = {
  who: string
  at: [number, number]
  /** Facing (radians, 0: towards the camera's side, +z). */
  turn?: number
  pose: Pose
  /** Later in the shot (seconds from its start), another pose. */
  then?: { t: number; pose: Pose }[]
  /** Walking to there, from t (default 0), at speed m/s (default 1.2): facing the way, pose « walk ». */
  walk?: { to: [number, number]; from?: number; speed?: number }
  /** Sitting, standing… on something this high (a bench: 0). */
  y?: number
}

/** What's said over a shot: by the narrator (« narr ») or one of the cast; say: the words with the voice's tags ([whispers]…). */
export type Line = { who: string; text: string; say?: string }

export type Shot = {
  /** The set (sets.tsx) and its mood. */
  set: string
  mood?: string
  /** How long (s), at least: longer if its line takes longer to say. */
  dur: number
  /** The camera: from where to where over the shot, looking at what. */
  cam: { from: Vec; to?: Vec; look: Vec; lookTo?: Vec; fov?: number }
  actors: Actor[]
  line?: Line
  /** The comic: where the panel's bubble points (the speaker's side), and a word written big (« TOC TOC »). */
  bd?: { side?: 'left' | 'right'; sfx?: string }
}

export type Scenario = {
  id: string
  title: string
  cast: Record<string, CastMember>
  shots: Shot[]
  /** The last words on the screen, before playing (« À toi de jouer »). */
  end?: string
}
