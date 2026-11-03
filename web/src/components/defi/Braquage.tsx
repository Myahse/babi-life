import { useState } from 'react'
import { t } from '../../lib/i18n'
import type { Jeu } from './jeux/types'
import { JeuDefi } from './jeux'
import { FuiteDefi } from './Fuite'

// Le braquage (backend game/braquage.go, the update « braquages »): the till's robbery is played as the
// getaway (Fuite.tsx: the ruelles by night to the moto, the police's torches dodged); the
// bank's, the vault first (the dial turned on the beat), then the getaway. The score (the two averaged
// at a bank) goes to the server, which decides with the place, the hour, the commissariat nearby, the
// record and the plan whether the police catch the Sim. Played on the games' own engines (jeux/).

const COFFRE: Jeu = {
  engine: 'rythme',
  title: t('Le coffre'),
  how: t('Tourne la molette du coffre au bon moment : chaque cran juste te rapproche des billets. Une erreur, et l’alarme risque de partir.'),
  decor: 'bureau',
  lanes: ['cle', 'piece', 'billet'],
  notes: 16,
}

export function BraquageDefi({ bank, onEnd }: { /** A bank (the vault, then the getaway); else a till (the getaway). */ bank: boolean; onEnd: (score: number) => void }) {
  const [vault, setVault] = useState<number | null>(bank ? null : -1)
  if (vault === null)
    return <JeuDefi key="coffre" act={{ id: 'braquer-banque:coffre', icon: 'siren', label: t('Le coffre') }} jeu={COFFRE} onEnd={(s) => setVault(s)} />
  return <FuiteDefi key="fuite" onEnd={(s) => onEnd(vault >= 0 ? Math.round((vault + s) / 2) : s)} />
}
