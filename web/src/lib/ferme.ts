// L'agriculture et l'élevage (the update « agriculture »; backend game/ferme.go, sims/ferme.go, world/ferme.go):
// the farm as the server keeps it (Sim.life.ferme) and the catalogue it sends with each act (FermeView), the
// keys, the careers, the places' activities. The app is components/ferme/FermeApp.tsx, the 3D world3d/ferme/.

export const FERME_KEY = 'agriculture'
export const FERME_APP_KEY = 'app:ferme'
export const FERME_KEYS = [FERME_KEY, FERME_APP_KEY]
/** The careers of the land (backend game.FermeCareers): hidden while the update is shut. */
export const FERME_CAREERS = ['agriculteur', 'eleveur', 'ouvrier-agricole', 'agronome', 'veterinaire']
/** The places' activities (backend game.FermeActIDs): may be hidden while the server hasn't answered. */
export const FERME_ACTS = ['ferme-coup-de-main', 'ferme-tour-champs', 'ferme-campement', 'ferme-appatam', 'coop-formation', 'coop-pesee', 'veto-tournee', 'veto-conseils']
/** The places' kinds. */
export const FERME_KIND = 'ferme'
export const COOP_KIND = 'cooperative'
export const VETO_KIND = 'veterinaire'

export type Zone = 'sud' | 'centre' | 'nord' | 'sahel' | 'tempere' | 'continental'
export type Meteo = 'pluie' | 'soleil' | 'harmattan' | 'froid'
export type Stage = 'friche' | 'defriche' | 'laboure' | 'pousse' | 'mur'

export type Culture = { id: string; label: string; icon: string; kind: 'vivrier' | 'maraicher' | 'rente' | 'perenne'; zones: Zone[]; seed: number; seedLabel: string; days: number; again?: number; sow?: number[]; season?: number[]; yield: number; unit: string; price: number; coop?: number; make?: string; about: string }
export type Produit = { id: string; label: string; icon: string; unit: string; price: number; coop?: number; from?: string; ratio?: number; days?: number; cost?: number; do?: string }
export type Bete = { id: string; label: string; young: string; icon: string; zones: Zone[]; price: number; min: number; sell: number; sellYoung: number; feed: number; feedLabel: string; graze?: boolean; product?: string; per?: number; every?: number; litter?: [number, number]; grow?: number; max: number; vet: number; herder?: number; pond?: boolean; pen: string; about: string }
export type Offre = { id: string; label: string; place?: string; city?: string; cityName?: string; home?: boolean; zone: Zone; rows: number; pens: number; rent?: number; price: number; crops: string[]; animals: string[]; about: string; open: boolean }

export type Champ = { stage: Stage; crop?: string; growth?: number; quality?: number; inSeason?: boolean; watered?: number; weeds?: boolean; weedAt?: number; pest?: boolean; score?: number; harvests?: number; sown?: number; dry?: number }
export type Enclos = { kind: string; adults: number; young?: number; youngAge?: number; birthIn?: number; fed?: number; watered?: number; grazed?: number; condition: number; tired?: boolean; sick?: boolean; eggs?: number; grown?: number }
export type Parcelle = { id: string; offre: string; owned?: boolean; rentUntil?: number; paid: number; hand?: boolean; champ: Champ; pens?: Enclos[] }
export type Ferme = { day: number; plots: Parcelle[]; grenier?: Record<string, number>; sechage?: { product: string; qty: number; ready: number }[]; next: number; earned?: number; born?: number; harvests?: number; news?: string[] }

/** What the act « voir » (and every act) sends back with the Sim. */
export type FermeView = {
  ferme: Ferme
  today: number
  month: number
  meteo: Record<string, [Meteo, Meteo]>
  rainy: Record<string, boolean>
  offres: Offre[]
  cultures: Culture[]
  produits: Produit[]
  betes: Bete[]
  left: number
  cap: number
  homeZone: Zone
  here: Record<string, boolean>
  rules: { clear: number; plough: number; treat: number; hand: number; rentDays: number; maxPlots: number }
}

export type FermeAct =
  | 'voir'
  | 'louer'
  | 'acheter'
  | 'renouveler'
  | 'rendre'
  | 'defricher'
  | 'labourer'
  | 'semer'
  | 'arroser'
  | 'desherber'
  | 'traiter'
  | 'recolter'
  | 'arracher'
  | 'manoeuvre'
  | 'transformer'
  | 'vendre'
  | 'betes'
  | 'nourrir'
  | 'abreuver'
  | 'paturage'
  | 'oeufs'
  | 'veterinaire'
  | 'vendre-betes'
  | 'pecher'
export type FermeBody = { plot?: string; offre?: string; crop?: string; kind?: string; product?: string; to?: 'marche' | 'coop'; qty?: number; score?: number; on?: boolean; hire?: boolean; young?: boolean }

/** A field's progress (0–1) to its harvest. */
export function growthOf(c: Champ, crop?: Culture) {
  if (!crop) return 0
  if (c.stage === 'mur') return 1
  if (c.stage !== 'pousse') return 0
  return Math.max(0, Math.min(1, (c.growth ?? 0) / crop.days))
}

/** The stage a crop's rows are drawn at (0 bare earth … 4 ripe), from its field. */
export function drawStage(c: Champ, crop?: Culture): 0 | 1 | 2 | 3 | 4 {
  if (c.stage === 'mur') return 4
  if (c.stage !== 'pousse') return 0
  const g = growthOf(c, crop)
  return g < 0.25 ? 1 : g < 0.6 ? 2 : 3
}

/** The farm last shown (the app's), for the village plots drawn in the street (world3d/ferme/FermeLandmark.tsx). */
let shown: Ferme | null = null
const subs = new Set<() => void>()
export function setFermeShown(f: Ferme | null) {
  shown = f
  subs.forEach((s) => s())
}
export const fermeShown = () => shown
export const onFermeShown = (f: () => void) => (subs.add(f), () => void subs.delete(f))
