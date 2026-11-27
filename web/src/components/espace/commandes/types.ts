import type { Look } from '../../../lib/types'

/** What each game of « espace-jeux » is given (host.tsx): its action's id, the score's sending, the close. */
export type GameProps = {
  id: string
  look?: Look
  /** The score sent once (backend sims/espaceJeux.go): the server's line. */
  send: (score: number) => Promise<string>
  onClose: () => void
}
