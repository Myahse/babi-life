// Hand-drawn, simplified shapes of the Ébrié lagoon around Abidjan for the
// offline map, drawn to agree with the bridges in backend/internal/world/roads.go (Natural Earth has no lagoon at this scale). [lng, lat] pairs.
// Mapbox shows the real geography once a token is configured.

export const LAGOON: [number, number][] = [
  // North shore, west to east: Songon, Yopougon, the baie du Banco (the 4th
  // bridge crosses it), the Plateau's south tip (the two old bridges), the
  // baie de Cocody (the Alassane-Ouattara bridge), the Riviera (the HKB).
  [-4.3, 5.3], [-4.22, 5.31], [-4.15, 5.318], [-4.11, 5.322], [-4.085, 5.318], [-4.07, 5.322], [-4.062, 5.33],
  [-4.0575, 5.335], [-4.056, 5.35], [-4.052, 5.357], [-4.048, 5.35], [-4.0485, 5.335],
  [-4.04, 5.325], [-4.03, 5.317], [-4.024, 5.3145], [-4.017, 5.3145], [-4.0105, 5.317],
  [-4.0108, 5.322], [-4.0112, 5.328], [-4.01, 5.335], [-4.008, 5.341], [-4.004, 5.344], [-4.0035, 5.339],
  [-4.0052, 5.332], [-4.0055, 5.325], [-4.002, 5.32],
  [-3.99, 5.3255], [-3.985, 5.3275], [-3.97, 5.327], [-3.95, 5.326], [-3.92, 5.325], [-3.88, 5.328], [-3.84, 5.33],
  [-3.8, 5.322], [-3.75, 5.312], [-3.7, 5.3], [-3.7, 5.29],
  // Back west along Petit-Bassam's north shore (Koumassi, Marcory, Treichville),
  // down the port channel, then the lagoon south of Yopougon. Port-Bouët is on
  // the same land as Koumassi: no water between them.
  [-3.76, 5.292], [-3.82, 5.298], [-3.88, 5.305], [-3.915, 5.306], [-3.93, 5.309], [-3.95, 5.313], [-3.97, 5.315],
  [-3.99, 5.3145], [-4.005, 5.313], [-4.01, 5.3125], [-4.019, 5.311], [-4.026, 5.306], [-4.03, 5.295], [-4.028, 5.28],
  [-4.02, 5.272], [-4.05, 5.28], [-4.1, 5.288], [-4.16, 5.29], [-4.22, 5.288], [-4.3, 5.284],
]

/** Petit-Bassam: Treichville, Marcory, Koumassi, Port-Bouët. */
export const PETIT_BASSAM: [number, number][] = [
  [-4.026, 5.306], [-4.019, 5.311], [-4.01, 5.3125], [-4.005, 5.313], [-3.99, 5.3145], [-3.97, 5.315], [-3.95, 5.313],
  [-3.93, 5.309], [-3.915, 5.306], [-3.92, 5.29], [-3.94, 5.281], [-3.965, 5.279], [-3.99, 5.28], [-4.01, 5.283], [-4.028, 5.29],
]

/** The ocean shore from Jacqueville to past Grand-Bassam, west to east. */
export const ABIDJAN_COAST: [number, number][] = [
  [-4.45, 5.2], [-4.3, 5.218], [-4.2, 5.229], [-4.1, 5.236], [-4.02, 5.241], [-3.95, 5.243], [-3.88, 5.236],
  [-3.82, 5.222], [-3.77, 5.2], [-3.73, 5.188], [-3.68, 5.182], [-3.6, 5.183], [-3.55, 5.182],
]
