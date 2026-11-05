import { setExpression, type Expression } from '../avatar/expressions'
import { sfx } from '../lib/sfx'
import { cheerCrowd } from './scenery'
import { t as tr } from '../lib/i18n'
import type { Tennis, TMoment } from './tennis'
import type { Volley, VMoment } from './volley'

// What tennis and volleyball give the ear and the eye besides the play (TennisMatch.tsx, VolleyMatch.tsx
// call frame() after each step): the strings' « pock », the ball on the clay or the hard court, the line
// judge's call, the crowd's applause, the volleyball's slap and the sand's puff; the players' faces at each
// moment (expressions.ts, as the streetball's feel.ts); the commentator's line, in French with the words of
// here (never the same twice in a row); the replay asked after a big point (played by the match, alone).

type Line = (v: { name: string }) => string
const last = new Map<string, Line>()
function pick(key: string, list: Line[] | undefined, name: string) {
  if (!list?.length) return null
  let l = list[Math.floor(Math.random() * list.length)]
  if (l === last.get(key) && list.length > 1) l = list[(list.indexOf(l) + 1) % list.length]
  last.set(key, l)
  return l({ name })
}

const TENNIS: Partial<Record<TMoment['kind'] | 'start' | 'end', Line[]>> = {
  start: [() => tr('Bienvenue au court central ! Le public est installé, place au jeu.'), () => tr('Les deux joueurs sont prêts. Silence s’il vous plaît… Jeu !')],
  ace: [(v) => tr('ACE ! {name} n’a même pas laissé le temps de voir la balle !', v), (v) => tr('Service gagnant de {name}, c’est un missile !', v), (v) => tr('Ace ! {name} sert comme un pro de Roland-Garros.', v)],
  df: [(v) => tr('Double faute de {name}… La pression monte.', v), (v) => tr('Aïe, {name} offre le point. Double faute.', v)],
  winner: [(v) => tr('Coup gagnant de {name} ! Personne ne pouvait aller chercher ça.', v), (v) => tr('Quelle frappe de {name} ! Le public d’Abidjan se lève !', v), (v) => tr('{name} trouve la ligne, c’est propre, c’est net !', v), (v) => tr('Wouyé ! {name} a tout lâché, coup gagnant !', v)],
  out: [(v) => tr('Faute ! La balle de {name} est sortie.', v), (v) => tr('Juste dehors ! {name} n’y croit pas.', v)],
  net: [(v) => tr('Dans le filet… {name} a manqué de hauteur.', v), (v) => tr('Le filet dit non à {name}.', v)],
  volley: [(v) => tr('{name} monte au filet, belle volée !', v), (v) => tr('Volée de {name}, bien placée.', v)],
  smash: [(v) => tr('SMASH de {name} ! Il a écrasé ça !', v), (v) => tr('{name} attendait la balle haute : smash, c’est fini !', v)],
  lob: [(v) => tr('Le lob de {name} ! Ça monte, ça monte…', v), (v) => tr('{name} tente le lob par-dessus.', v)],
  drop: [(v) => tr('Amortie de {name} ! Toute en douceur.', v), (v) => tr('Petite amortie de {name}, c’est vicieux ça !', v)],
  game: [(v) => tr('Jeu pour {name}.', v), (v) => tr('{name} tient son jeu, tranquille.', v)],
  break: [(v) => tr('Break ! {name} prend le service adverse !', v), (v) => tr('{name} fait le break, le match bascule !', v)],
  set: [(v) => tr('Set pour {name} ! Quelle performance.', v)],
  match: [(v) => tr('Jeu, set et match ! {name} l’emporte, bravo !', v), (v) => tr('C’est terminé ! {name} remporte la partie !', v)],
  deuce: [() => tr('Égalité ! Ça se dispute sec.'), () => tr('Encore égalité, personne ne lâche !')],
  adv: [(v) => tr('Avantage {name}. Une balle pour conclure.', v)],
  tiebreak: [() => tr('Jeu décisif ! Les nerfs vont parler.')],
  rally: [() => tr('Quel échange ! Le public retient son souffle.'), () => tr('Ça ne lâche rien, quel rallye !')],
  change: [() => tr('Changement de côté. Petite gorgée d’eau, on repart.')],
}

const VOLLEY: Partial<Record<VMoment['kind'] | 'start' | 'beach', Line[]>> = {
  start: [() => tr('Bienvenue au Palais des Sports ! Les équipes sont sur le terrain, coup de sifflet.'), () => tr('Les six de chaque côté sont prêts. Service !')],
  beach: [() => tr('Le soleil tape, le sable brûle : beach-volley au bord de la mer, c’est parti !'), () => tr('Deux contre deux pieds nus sur le sable. Que le meilleur duo gagne !')],
  kill: [(v) => tr('SMASH ! {name} a cassé le parquet !', v), (v) => tr('{name} frappe fort, le ballon est au sol !', v), (v) => tr('Attaque gagnante de {name}, imparable !', v), (v) => tr('Wouyééé ! {name} a smashé comme un marteau !', v)],
  ace: [(v) => tr('Ace ! Le service de {name} tombe dans le trou.', v), (v) => tr('Service gagnant de {name}, la réception n’a rien vu !', v)],
  stuff: [(v) => tr('CONTRE ! {name} a fermé la porte !', v), (v) => tr('Bloqué ! {name} renvoie ça au marché !', v), (v) => tr('Mur au filet ! {name} dit non !', v)],
  dig: [(v) => tr('Quelle défense de {name} ! Il est allé chercher ça au ras du sol.', v), (v) => tr('{name} plonge et sauve le ballon !', v)],
  tip: [(v) => tr('Petite feinte de {name} derrière le contre !', v)],
  rally: [() => tr('Quel échange ! Défense, relance, attaque, encore et encore !'), () => tr('Le public est debout, ce rallye est fou !')],
  setwon: [() => tr('Fin du set ! Les équipes changent de côté.')],
  match: [() => tr('C’est terminé ! Merci pour le spectacle.')],
  out: [(v) => tr('Dehors ! Le ballon de {name} est out.', v)],
  fault: [() => tr('Faute ! L’arbitre a vu.')],
  switch: [() => tr('Changement de côté.')],
}

const face = (key: string, e: Expression, ms = 2600) => setExpression(key, e, ms)

const STRIKES = new Set(['hit', 'volley', 'smash', 'lob', 'drop', 'spike', 'dig', 'bump', 'set', 'tip', 'free', 'stuff'])
const HARD = new Set(['smash', 'spike', 'stuff'])
type Struck = { moments: { kind: string; by: number; t: number; team?: number; text?: string }[]; me: number; judge: { text: string; t: number } | null; ps: readonly object[] }

/**
 * The contact's weight (the matches call it after each step, offline): how long to hold the match still now (a
 * hit-stop: a few hundredths, longer after the player's perfect stroke, which also gets its ping), and the stands
 * jumping up at a winner, an ace, a kill or a stuff block (more for the player's side).
 */
export function hitStop(g: Struck, s: { seen: number }) {
  let hold = 0
  for (; s.seen < g.moments.length; s.seen++) {
    const m = g.moments[s.seen]
    const mine = m.by === g.me
    if (STRIKES.has(m.kind)) {
      const perfect = mine && !!g.judge && g.judge.t === m.t && g.judge.text === 'Parfait'
      if (perfect) sfx.tick(1.6)
      hold = Math.max(hold, perfect ? 0.09 : mine ? 0.05 : HARD.has(m.kind) ? 0.045 : 0)
    }
    if (m.kind === 'winner' || m.kind === 'ace' || m.kind === 'kill' || m.kind === 'stuff') {
      const ours = mine || (m.team !== undefined && (g.ps[g.me] as { team?: number })?.team === m.team)
      cheerCrowd(ours ? 1 : 0.55)
    }
  }
  return hold
}

/** Tennis's sounds, faces and words. */
export class TennisFeel {
  comment: { text: string; k: number } | null = null
  /** A big point's replay to play (its moment's time): taken by the match. */
  replayAsk: number | null = null
  private seen = 0
  private opened = false
  private ended = false
  constructor(readonly g: Tennis) {}
  frame() {
    const g = this.g
    if (!this.opened && g.time > -2) {
      this.opened = true
      this.say('start', TENNIS.start, '')
    }
    if (this.comment && g.time - this.comment.k > 4.5) this.comment = null
    for (; this.seen < g.moments.length; this.seen++) this.moment(g.moments[this.seen])
    if (g.phase === 'over' && !this.ended) {
      this.ended = true
      sfx.applause(true)
      g.ps.forEach((p) => face(`tennis-${p.id}`, p.id === g.winner ? 'cheer' : 'sad', 6000))
    }
  }
  private say(key: string, list: Line[] | undefined, name: string) {
    const text = pick(`t-${key}`, list, name)
    if (text) this.comment = { text, k: this.g.time }
  }
  private moment(m: TMoment) {
    const g = this.g
    const p = g.ps[m.by]
    const name = p?.name ?? ''
    const id = `tennis-${m.by}`
    const foe = `tennis-${m.by === 0 ? 1 : 0}`
    const clay = g.rules.surface === 'clay'
    switch (m.kind) {
      case 'hit':
      case 'volley':
      case 'smash':
      case 'lob':
      case 'drop':
        sfx.racket(Math.min(1, (m.v ?? 15) / 40))
        if (m.kind !== 'hit') this.say(m.kind, TENNIS[m.kind], name)
        if (m.kind === 'hit' && m.text !== 'serve') face(id, 'effort', 700)
        break
      case 'bounce':
        sfx.courtBounce(clay, Math.min(1, (m.v ?? 4) / 8))
        break
      case 'out':
        sfx.lineCall()
        face(id, 'annoyed', 2200)
        this.say('out', TENNIS.out, name)
        break
      case 'net':
        face(id, 'disappointed', 2200)
        this.say('net', TENNIS.net, name)
        break
      case 'cord':
        sfx.ooh()
        break
      case 'fault':
        sfx.lineCall()
        break
      case 'ace':
        sfx.applause()
        face(id, 'proud', 2600)
        face(foe, 'surprised', 2000)
        this.say('ace', TENNIS.ace, name)
        if (m.by === g.me) this.replayAsk = m.t
        break
      case 'df':
        face(id, 'annoyed', 2600)
        this.say('df', TENNIS.df, name)
        break
      case 'winner':
        sfx.applause()
        face(id, 'cheer', 2600)
        face(foe, 'disappointed', 2200)
        this.say('winner', TENNIS.winner, name)
        // The player's winners, and the long rallies' end, get their replay.
        if (m.by === g.me || (m.v ?? 0) >= 7) this.replayAsk = m.t
        break
      case 'game':
      case 'break':
      case 'set':
      case 'match':
        if (m.kind !== 'game') sfx.applause(m.kind !== 'break')
        face(id, m.kind === 'game' ? 'proud' : 'cheer', 3000)
        this.say(m.kind, TENNIS[m.kind], m.text ?? name)
        break
      case 'deuce':
      case 'tiebreak':
      case 'change':
        this.say(m.kind, TENNIS[m.kind], name)
        break
      case 'adv':
        this.say('adv', TENNIS.adv, m.text ?? name)
        break
      case 'rally':
        sfx.applause()
        this.say('rally', TENNIS.rally, name)
        break
      case 'serve':
        face(id, 'concentrate', 1500)
        break
    }
  }
}

/** Volleyball's. */
export class VolleyFeel {
  comment: { text: string; k: number } | null = null
  replayAsk: number | null = null
  private seen = 0
  private opened = false
  private ended = false
  constructor(readonly g: Volley) {}
  frame() {
    const g = this.g
    if (!this.opened && g.time > -2) {
      this.opened = true
      this.say('start', g.rules.beach ? VOLLEY.beach : VOLLEY.start, '')
    }
    if (this.comment && g.time - this.comment.k > 4.5) this.comment = null
    for (; this.seen < g.moments.length; this.seen++) this.moment(g.moments[this.seen])
    if (g.phase === 'over' && !this.ended) {
      this.ended = true
      sfx.whistle(true)
      sfx.applause(true)
      g.ps.forEach((p) => face(`volley-${p.id}`, p.team === g.winner ? 'cheer' : 'sad', 6000))
    }
  }
  private say(key: string, list: Line[] | undefined, name: string) {
    const text = pick(`v-${key}`, list, name)
    if (text) this.comment = { text, k: this.g.time }
  }
  private moment(m: VMoment) {
    const g = this.g
    const p = g.ps[m.by]
    const name = p?.name ?? ''
    const id = `volley-${m.by}`
    const team = (t: 0 | 1, e: Expression, ms = 2200) => g.ps.forEach((q) => q.team === t && face(`volley-${q.id}`, e, ms))
    switch (m.kind) {
      case 'serve':
        sfx.whistle()
        face(id, 'concentrate', 1500)
        break
      case 'spike':
        sfx.slap(1)
        face(id, 'shout', 900)
        break
      case 'bump':
      case 'dig':
      case 'free':
        sfx.slap(0.3)
        if (m.kind === 'dig' && m.text !== 'shank' && Math.random() < 0.35) this.say('dig', VOLLEY.dig, name)
        break
      case 'set':
        sfx.slap(0.15)
        break
      case 'tip':
        sfx.slap(0.1)
        this.say('tip', VOLLEY.tip, name)
        break
      case 'touch':
      case 'block':
        sfx.slap(0.4)
        break
      case 'stuff':
        sfx.slap(0.8)
        sfx.roar()
        face(id, 'shout', 2400)
        this.say('stuff', VOLLEY.stuff, name)
        if (p?.team === g.ps[g.me].team) this.replayAsk = m.t
        break
      case 'floor':
        if (g.rules.beach) sfx.sand()
        else sfx.dribble(true, 0.8)
        break
      case 'kill':
        sfx.roar()
        face(id, 'cheer', 2600)
        team(p.team === 0 ? 1 : 0, 'disappointed')
        this.say('kill', VOLLEY.kill, name)
        // The big spikes get their replay: the player's own, and the side's now and then.
        if (m.text === 'spike' && (m.by === g.me || (p.team === g.ps[g.me].team && Math.random() < 0.4))) this.replayAsk = m.t
        break
      case 'ace':
        sfx.applause()
        face(id, 'proud', 2600)
        this.say('ace', VOLLEY.ace, name)
        break
      case 'out':
        sfx.whistle()
        this.say('out', VOLLEY.out, name)
        break
      case 'fault':
        sfx.whistle()
        this.say('fault', VOLLEY.fault, name)
        break
      case 'point':
        if (m.v !== undefined) team(m.v as 0 | 1, 'grin', 1800)
        break
      case 'rally':
        sfx.applause()
        this.say('rally', VOLLEY.rally, name)
        break
      case 'setwon':
      case 'match':
        sfx.applause(true)
        this.say(m.kind, VOLLEY[m.kind], name)
        break
      case 'switch':
        this.say('switch', VOLLEY.switch, name)
        break
    }
  }
}
