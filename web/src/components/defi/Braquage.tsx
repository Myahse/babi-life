import { useState } from 'react'
import { t } from '../../lib/i18n'
import type { Jeu } from './jeux/types'
import { JeuDefi } from './jeux'

// Le braquage (backend game/braquage.go, the update « braquages »): the till's robbery is played as the
// getaway (running down the street, the notes dropped picked up, the police's handcuffs dodged); the
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

const FUITE: Jeu = {
  engine: 'course',
  title: t('La fuite'),
  how: t('Cours dans les rues : ramasse les billets que tu as fait tomber, évite les menottes de la police. Plus tu vas loin, moins ils ont de chances de t’attraper.'),
  decor: 'bitume',
  mode: 'pied',
  good: 'billet',
  bad: 'menottes',
  target: 12,
}

export function BraquageDefi({ bank, onEnd }: { /** A bank (the vault, then the getaway); else a till (the getaway). */ bank: boolean; onEnd: (score: number) => void }) {
  const [vault, setVault] = useState<number | null>(bank ? null : -1)
  if (vault === null)
    return <JeuDefi key="coffre" act={{ id: 'braquer-banque:coffre', icon: 'siren', label: t('Le coffre') }} jeu={COFFRE} onEnd={(s) => setVault(s)} />
  return <JeuDefi key="fuite" act={{ id: 'braquer:fuite', icon: 'siren', label: t('La fuite') }} jeu={FUITE} onEnd={(s) => onEnd(vault >= 0 ? Math.round((vault + s) / 2) : s)} />
}
