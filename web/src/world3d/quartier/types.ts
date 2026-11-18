// The quartier's shapes (update « mon-quartier »), as the server sends them (lib/types.ts, backend sims/monquartier.go).
export type { HubView, QuartierBuilding, QuartierTodo, QuartierView } from '../../lib/types'

export type QuartierKind = 'maison' | 'boutique' | 'maquis' | 'grin' | 'salon' | 'cabine' | 'terrain' | 'arret_gbaka' | 'eclairage' | 'ecole' | 'pharmacie' | 'marche' | 'salle_fetes' | 'boite' | 'immeuble'
