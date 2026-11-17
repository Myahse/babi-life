import { loadLang } from '../lib/i18n'

// The city lab in the chosen language (localStorage babi.lang): the catalogue
// before the scenes' modules, which draw their signs as they load (as main.tsx does).
void loadLang().then(() => import('./city'))
