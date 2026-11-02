// The city's prominent buildings on the map (MapboxMap), as the game builds them: their 3D models
// exported from the game's own (world3d/open/landmarks.tsx, the lab's ?view=glb) to public/landmarks/,
// each set where it stands, turned as in the game in the file itself (its front's way, `rot`: 0 = south, as
// world3d's rot; the lab bakes it in: ?view=glb&id=…&rot=…).
// Drawn bigger from afar so the commune's landmarks read at a glance; their real size close up.

export type Landmark3D = { id: string; lng: number; lat: number; /** The game's turn (radians, 0: facing south). */ rot: number }

export const LANDMARKS_3D: Landmark3D[] = [
  { id: 'plateau-tour-f', lng: -4.02222, lat: 5.33559, rot: 0 },
  { id: 'plateau-cathedrale', lng: -4.02006, lat: 5.33297, rot: 0 },
  { id: 'plateau-stade', lng: -4.01852, lat: 5.32831, rot: 0 },
  { id: 'plateau-pyramide', lng: -4.01643, lat: 5.32231, rot: 0 },
  { id: 'plateau-tribunal', lng: -4.02019, lat: 5.33133, rot: Math.PI },
  { id: 'plateau-presidence', lng: -4.02371, lat: 5.31921, rot: 0 },
  { id: 'plateau-assemblee', lng: -4.02015, lat: 5.32883, rot: 0 },
  { id: 'cocody-hotel-ivoire', lng: -4.00432, lat: 5.32648, rot: 0 },
  { id: 'cocody-rti', lng: -4.00214, lat: 5.3427, rot: 0 },
  { id: 'cocody-playce', lng: -3.93359, lat: 5.37353, rot: 0 },
  { id: 'treich-mosquee-m6', lng: -4.003406, lat: 5.310947, rot: 0 },
  { id: 'treich-palais-culture', lng: -4.01258, lat: 5.31226, rot: 0 },
  { id: 'marcory-capsud', lng: -3.98677, lat: 5.29827, rot: 0 },
  { id: 'koumassi-tour-ivoire', lng: -3.97274, lat: 5.29182, rot: 0 },
  { id: 'portbouet-parc-expo', lng: -3.94603, lat: 5.26465, rot: 2.758 },
  { id: 'pb-rabisson', lng: -3.93641, lat: 5.25895, rot: 1.169 },
  { id: 'pb-aeroport', lng: -3.93268, lat: 5.2544, rot: -2.015 },
  { id: 'yakro-basilique', lng: -5.29709, lat: 6.81133, rot: 0 },
]

/** The landmarks as map points, for the model layer. */
export function landmarkPoints(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: LANDMARKS_3D.map((l) => ({
      type: 'Feature',
      properties: { model: l.id, rot: (l.rot * 180) / Math.PI },
      geometry: { type: 'Point', coordinates: [l.lng, l.lat] },
    })),
  }
}
