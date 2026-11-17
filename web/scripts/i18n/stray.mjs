// The French that reaches the player without t(): string and template literals that read as
// French sentences (two French words, or one and an accent) outside a t(), tx() or tn() call.
// The codemod (wrap.mjs) skips what it can't be sure of; this lists it to look at by hand.
//
//   node scripts/i18n/stray.mjs [files…]     file:line and the text
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'
import { walkFiles } from './wrap.mjs'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SRC = path.join(ROOT, 'src')
// Not the player's: the team's admin, the labs, the tests, the i18n itself, the NPC model's prompts.
const SKIP = /(\/lab\/|\/screens\/Admin|\/screens\/admin\/|\/lib\/i18n|\/i18n\/|\.test\.|\.d\.ts$|\.native\.|\/lib\/french\.ts$)/
const WORD = /(?:^|(?<=[\s'’(«]))(le|la|les|une|des|du|tu|ton|ta|tes|il|elle|et|au|aux|est|pour|avec|pas|sur|dans|qui|que|ça|cette|chez|plus|je|mon|nous|vous|ils|leur|à|ou|mais|ici|encore)(?=[\s'’,.!?:)»]|$)/gi
const ACCENT = /[àâéèêëîïôùûçœ]/i
const frenchy = (s) => {
  const n = (s.match(WORD) || []).length
  return n >= 2 || (n === 1 && ACCENT.test(s))
}
// Calls whose string arguments are not shown: logs, keys, comparisons, the NPC model's prompt.
const QUIET = /^(console\.\w+|localStorage\.\w+|sessionStorage\.\w+|\w+\.(startsWith|endsWith|includes|indexOf|split|replace|replaceAll|match|test|getItem|setItem|removeItem|querySelector|querySelectorAll|addEventListener)|fetch|t|tr|tx|tn|tt|tl|new RegExp|RegExp|Error|new Error)$/

const args = process.argv.slice(2)
const files = args.length ? args.map((a) => path.resolve(a)) : walkFiles(SRC).filter((f) => !SKIP.test(f))
let total = 0
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const out = []
  const callName = (n) => {
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isCallExpression(p) || ts.isNewExpression(p)) return p.expression.getText(sf)
      if (ts.isTemplateExpression(p) || ts.isBinaryExpression(p) || ts.isConditionalExpression(p) || ts.isParenthesizedExpression(p) || ts.isTemplateSpan(p)) continue
      return null
    }
    return null
  }
  const visit = (n) => {
    let text = null
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) text = n.text
    else if (ts.isTemplateExpression(n)) text = [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(' ')
    else if (ts.isJsxText(n)) text = n.text.trim()
    if (text && frenchy(text) && !ts.isImportDeclaration(n.parent) && !ts.isExportDeclaration(n.parent)) {
      const call = callName(n)
      const cmp = ts.isBinaryExpression(n.parent) && /^(===|!==|==|!=)$/.test(n.parent.operatorToken.getText(sf))
      if (!(call && QUIET.test(call)) && !cmp) {
        const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
        out.push(`${path.relative(ROOT, f)}:${line}\t${text.replace(/\s+/g, ' ').slice(0, 160)}`)
      }
      if (!ts.isTemplateExpression(n)) return
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  total += out.length
  if (out.length) console.log(out.join('\n'))
}
console.error(`${total} French literals outside t()`)
