// Hand in hand (avatar/Human.tsx HandInHand): the Sim and the one it's with, walking side by side. Whoever
// knows where the other is (Walker.tsx's Trail for a partner along on an outing, Players.tsx for one's
// partner who is another player, close by in the street) says which of the Sim's arms holds their hand.

/** The Sim's own hand: -1 its -x arm, 1 its +x arm, 0 none (read each frame by its rig). */
export const simHand = { side: 0 }

/** Who set the Sim's hand last: only they let go of it (two of them can't fight over it). */
let holder: string | null = null
export function holdSimHand(who: string, side: number) {
  if (side) {
    holder = who
    simHand.side = side
  } else if (holder === who) {
    holder = null
    simHand.side = 0
  }
}

/** How far apart (m, middle to middle) two people walk hand in hand. */
export const HAND_GAP = 0.62
