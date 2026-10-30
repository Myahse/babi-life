import { lang, loadLang } from './lib/i18n'

// The language's words before the game's modules load (they make their lists
// in it): nothing to wait for in French, the English catalogue otherwise.
document.documentElement.lang = lang()
void loadLang().then(() => {
  document.documentElement.lang = lang()
  return import('./boot')
})
