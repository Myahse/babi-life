import { useSyncExternalStore } from 'react'

// What can be done in the place the Sim walks about, for the scene to show
// over the spots where it's done (SpotActions). Play writes it (the place's
// list, the same as « Que faire ? »), the scenes read it: they draw in their
// own canvas, so a store rather than a context.

/** One thing to do: why it can't be now (closed, too young, too dear…), else what it takes. */
export type SceneAction = { id: string; label: string; icon: string; colors: [string, string]; note: string; why?: string }

/** open: the things of the pin tapped, shown in a card on the screen (Play's SpotSheet), not at the pin (it could be at the edge). */
type State = { actions: SceneAction[]; pick: (id: string) => void; open: SceneAction[] | null }
let state: State = { actions: [], pick: () => undefined, open: null }
const subs = new Set<() => void>()

export function setSceneActions(actions: SceneAction[], pick: (id: string) => void) {
  // (A card open stays open, its things as they are now.)
  const open = state.open && actions.filter((a) => state.open!.some((o) => o.id === a.id))
  state = { actions, pick, open: open?.length ? open : null }
  subs.forEach((f) => f())
}

/** A pin tapped (its things), or the card closed (null). */
export function openSpot(open: SceneAction[] | null) {
  state = { ...state, open }
  subs.forEach((f) => f())
}

const subscribe = (f: () => void) => {
  subs.add(f)
  return () => void subs.delete(f)
}

export function useSceneActions(): State {
  return useSyncExternalStore(subscribe, () => state)
}
