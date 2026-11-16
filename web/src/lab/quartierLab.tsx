// The quartier's sheets on their own (city.html?view=quartier&sheet=gerer|construire&sim=<id>), against the
// local API with the session in localStorage: to look at them at a phone's size without the street.

import { GererQuartier } from '../components/quartier/GererQuartier'
import { Construire } from '../components/quartier/Construire'

export function QuartierLab() {
  const q = new URLSearchParams(location.search)
  const sim = q.get('sim') ?? ''
  const props = { simId: sim, onClose: () => undefined, onPlace: (kind: string, slot: number) => console.log('place', kind, slot) }
  return (
    <div className="relative h-dvh w-full overflow-hidden" style={{ background: 'linear-gradient(#8fd0f4 0%, #cdeaf7 42%, #d7b98c 42%, #c9a676 100%)' }}>
      {q.get('sheet') === 'construire' ? <Construire {...props} /> : <GererQuartier {...props} />}
    </div>
  )
}
