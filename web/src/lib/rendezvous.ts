// The week's rendez-vous (update « rendez-vous », components/RendezVous.tsx): opening the phone's app from
// anywhere (Gbairai's strip), kept apart from the app itself so the game screen loads it only when opened.

/** Opens the phone on the Rendez-vous app (screens/Play.tsx listens). */
export const RENDEZVOUS_OPEN = 'babi:rendezvous'
export const openRendezVous = () => window.dispatchEvent(new Event(RENDEZVOUS_OPEN))
