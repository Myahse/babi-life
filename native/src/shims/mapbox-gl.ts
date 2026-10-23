// Mapbox's web map: the app draws the offline board (the babel config gives it no token,
// GameMap.tsx), so this is never made; it's here for the bundle to resolve.
class Unavailable {
  constructor() {
    throw new Error('mapbox-gl is not in the app')
  }
}
const mapboxgl = { Map: Unavailable, Marker: Unavailable, Popup: Unavailable, LngLatBounds: Unavailable, accessToken: '' }
export default mapboxgl
