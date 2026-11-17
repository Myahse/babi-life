// The two worlds (update « mon-quartier »): Babi, where everyone is, and the Sim's own neighbourhood
// (screens/Quartier.tsx). Chosen when the game opens (components/WorldChoice.tsx), once a visit: the
// choice is kept for the tab (sessionStorage), and the last one is offered first next time.

const NOW = 'babi.monde'
const LAST = 'babi.monde.dernier'

export type WorldName = 'babi' | 'quartier'

/** Already chosen in this tab (the choice isn't asked again). */
export function worldChosen() {
  try {
    return sessionStorage.getItem(NOW) !== null
  } catch {
    return true
  }
}

export function chooseWorld(w: WorldName) {
  try {
    sessionStorage.setItem(NOW, w)
    localStorage.setItem(LAST, w)
  } catch {
    // (Private browsing: asked again next time, nothing more.)
  }
}

/** The world chosen last time (offered first). */
export function lastWorld(): WorldName {
  try {
    return localStorage.getItem(LAST) === 'quartier' ? 'quartier' : 'babi'
  } catch {
    return 'babi'
  }
}
