import { create } from 'zustand'
import type { DefiKind } from '../components/Defi'
import type { ActionResult } from './types'

// Sharing what one does in the game with the others: a bet or Loto ticket, a défi's score to
// beat. A message carries it as a token the chat draws as a card (components/SharedCard.tsx):
// « [ticket:bet:ref:sig] » (signed by the server: backend sims/tickets.go), « [defi:the:87] ».
// Outside the game (WhatsApp…), a défi goes as a link that opens it (/jeu?defi=the&score=87&par=Awa).

export const TICKET = /^\[ticket:(bet|loto):([a-z]+):([a-z]{10})\]$/
/** The défis one can challenge someone to: the ones played on their own (not a gesture over an action, a street happening). */
export const SHAREABLE: readonly DefiKind[] = ['the', 'ski', 'courses', 'foot', 'course', 'combat', 'arcade', 'ecole', 'coucou', 'cubes', 'pas', 'hochet', 'garba', 'alloco', 'bar']
export const DEFI = new RegExp(`^\\[defi:(${SHAREABLE.join('|')}):(\\d{1,3})\\]$`)
/** A challenge to play against the sender (update « jeux-en-ligne », backend sims/pvp.go writes it): « [jeu:dames:<match>] ». */
export const JEU = /^\[jeu:(foot|course|combat|arcade|the|courses|dames|huit|awale|ludo|gode):([a-z0-9]{4,40})\]$/

export type Challenge = { kind: DefiKind; score: number; from: string }
/** Something to send: the token for the chats, and for outside the game a text and its link. */
export type Sharing = { title: string; body: string; link?: { text: string; url: string } }

type ShareState = {
  /** The player's Sim (for « Jouer le même », the messages sent). */
  simId: string | null
  firstName: string
  /** What the server answered, applied to the Sim (Play's apply: its money, its activity). */
  apply?: (r: ActionResult) => void
  sharing: Sharing | null
  challenge: Challenge | null
  share: (s: Sharing | null) => void
  challengeWith: (c: Challenge | null) => void
}

export const useShare = create<ShareState>((set) => ({
  simId: null,
  firstName: '',
  sharing: null,
  challenge: null,
  share: (sharing) => set({ sharing }),
  challengeWith: (challenge) => set({ challenge }),
}))

/** The défi as a message, and as a link for outside the game. */
export function defiSharing(kind: DefiKind, score: number, title: string): Sharing {
  const { firstName } = useShare.getState()
  const url = `${location.origin}/jeu?defi=${kind}&score=${score}&par=${encodeURIComponent(firstName)}`
  return { title: 'Défier quelqu’un', body: `[defi:${kind}:${score}]`, link: { text: `${firstName} a fait ${score}/100 au défi « ${title} » dans Babi Life. Tu peux faire mieux ? 😏`, url } }
}

/** A défi in the address (a link opened): to take on, then the address cleaned. */
export function challengeInAddress(): Challenge | null {
  const q = new URLSearchParams(location.search)
  const kind = q.get('defi')
  const score = Number(q.get('score'))
  if (!kind || !SHAREABLE.includes(kind as DefiKind) || !(score >= 0 && score <= 100)) return null
  return { kind: kind as DefiKind, score: Math.round(score), from: (q.get('par') ?? '').slice(0, 30) || 'Quelqu’un' }
}
