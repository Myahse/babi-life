import { loadLang } from '../lib/i18n'

// The played actions' lab in the chosen language (localStorage babi.lang): the
// catalogue before the games' modules, which make their lists as they load (as main.tsx does).
void loadLang().then(() => import('./gestes'))
