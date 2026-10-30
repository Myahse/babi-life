// The English catalogue's keeper (src/i18n/lang-en.json: { "the French": "the English" }).
// It finds every t('…'), tx('…') and tn(n, '…', '…') of src (by the names a file imports them under),
// and says what has no English yet.
//
//   node scripts/i18n/extract.mjs              the counts
//   node scripts/i18n/extract.mjs --check      fails (exit 1) if a string has no English, or its {names} differ
//   node scripts/i18n/extract.mjs --todo F     the strings without English, numbered, in F (id TAB file TAB French)
//   node scripts/i18n/extract.mjs --merge F --from T   F's lines (id TAB English, « a || b » for two forms) for the --todo T, into the catalogue
//   node scripts/i18n/extract.mjs --prune      drops the entries no t() uses any more
//
// An entry may be [singular, plural] (picked by {n}); "=" keeps the French as it is (a name, a brand).
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SRC = path.join(ROOT, 'src')
const CAT = path.join(SRC, 'i18n/lang-en.json')
const args = process.argv.slice(2)
const opt = (k) => {
  const i = args.indexOf(k)
  return i < 0 ? null : args[i + 1] ?? ''
}

function files(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) files(p, out)
    else if (/\.(ts|tsx)$/.test(e.name) && !p.endsWith('lib/i18n.ts')) out.push(p)
  }
  return out
}

/** Every string given to t, tx, tn: French → the files it's in. */
export function extract() {
  const found = new Map()
  const add = (s, f) => {
    if (!found.has(s)) found.set(s, new Set())
    found.get(s).add(path.relative(ROOT, f))
  }
  for (const f of files(SRC)) {
    const src = fs.readFileSync(f, 'utf8')
    if (!/lib\/i18n'/.test(src)) continue
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const names = new Map()
    for (const st of sf.statements)
      if (ts.isImportDeclaration(st) && /lib\/i18n$/.test(st.moduleSpecifier.text) && st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings))
        for (const el of st.importClause.namedBindings.elements) names.set(el.name.text, (el.propertyName ?? el.name).text)
    const lit = (n) => (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null)
    const visit = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && names.has(n.expression.text)) {
        const fn = names.get(n.expression.text)
        const xs = fn === 'tn' ? [n.arguments[1], n.arguments[2]] : fn === 't' || fn === 'tx' ? [n.arguments[0]] : []
        for (const x of xs) {
          const s = lit(x)
          if (s !== null) add(s, f)
        }
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
  return found
}

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
const forms = (e) => (Array.isArray(e) ? e : [e])

const found = extract()
const cat = fs.existsSync(CAT) ? JSON.parse(fs.readFileSync(CAT, 'utf8')) : {}
const missing = []
const bad = []
for (const [fr, where] of found) {
  const e = cat[fr]
  if (e === undefined || e === '') missing.push([fr, [...where][0]])
  else if (e !== '=') for (const en of forms(e)) if (placeholders(en) !== placeholders(fr) && !(Array.isArray(e) && placeholders(en).replace(/(^|,)n(,|$)/, '$1').replace(/^,|,$/, '') === placeholders(fr).replace(/(^|,)n(,|$)/, '$1').replace(/^,|,$/, ''))) bad.push([fr, en])
}
const unused = Object.keys(cat).filter((k) => !found.has(k))

const write = (c) => fs.writeFileSync(CAT, JSON.stringify(Object.fromEntries(Object.entries(c).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))), null, 0).replace(/","/g, '",\n"').replace(/^\{/, '{\n').replace(/\}$/, '\n}\n'))

if (opt('--todo') !== null) {
  const out = opt('--todo')
  fs.writeFileSync(out, missing.map(([fr, f], i) => `${i}\t${f}\t${fr.replace(/\n/g, '\\n')}`).join('\n') + '\n')
  fs.writeFileSync(out + '.json', JSON.stringify(missing.map(([fr]) => fr)))
  console.log(`${missing.length} strings to translate in ${out}`)
} else if (opt('--merge') !== null) {
  const inp = opt('--merge')
  // The numbering of the --todo it answers (--from F, F.json beside it).
  const list = JSON.parse(fs.readFileSync(opt('--from') + '.json', 'utf8'))
  let n = 0
  for (const line of fs.readFileSync(inp, 'utf8').split('\n')) {
    const m = line.match(/^(\d+)[\t|](.*)$/)
    if (!m) continue
    const fr = list[+m[1]]
    if (fr === undefined) continue
    const v = m[2].replace(/\\n/g, '\n')
    // « one || other »: the singular and the plural.
    cat[fr] = v.includes(' || ') ? v.split(' || ', 2) : v === fr ? '=' : v
    n++
  }
  write(cat)
  console.log(`${n} merged`)
} else if (args.includes('--prune')) {
  for (const k of unused) delete cat[k]
  write(cat)
  console.log(`${unused.length} unused entries dropped`)
}

console.log(`i18n: ${found.size} strings, ${found.size - missing.length} in English, ${missing.length} still in French only, ${bad.length} with other {names}, ${unused.length} unused`)
if (args.includes('--check')) {
  for (const [fr, en] of bad.slice(0, 20)) console.log(`  {names} differ: ${JSON.stringify(fr)} → ${JSON.stringify(en)}`)
  for (const [fr, f] of missing.slice(0, 20)) console.log(`  no English: ${f}: ${JSON.stringify(fr)}`)
  if (missing.length || bad.length) process.exit(1)
}
