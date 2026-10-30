// The codemod that put the game's French text behind t() (lib/i18n.ts).
// It can be run again on new code: what is already wrapped is left alone.
//
//   node scripts/i18n/wrap.mjs            what it would wrap, by file (nothing written)
//   node scripts/i18n/wrap.mjs --write    wraps it
//   node scripts/i18n/wrap.mjs --write src/components/Foo.tsx   only these files
//
// What it wraps: JSX text (with the expressions between its words, as {names}),
// the text props of JSX (title, placeholder, label…), and in code the string
// and template literals that read as a sentence (a space, an accent, a capital
// word), outside what is surely not text: class names, paths, ids, imports,
// comparisons, the arguments of startsWith/includes/getItem… A string that the
// code also compares (or uses as a key) somewhere is left in French: turning
// one side to English would break the comparison.
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SRC = path.join(ROOT, 'src')
const SKIP_FILE = /(\.native\.|\.web\.|\.d\.ts$|\/lab\/|\/screens\/Admin|\/screens\/admin\/|\/lib\/i18n|\/i18n\/|\/lib\/types\.ts$|\.test\.)/

const args = process.argv.slice(2)
const WRITE = args.includes('--write')
const only = args.filter((a) => !a.startsWith('--')).map((a) => path.resolve(process.cwd(), a))

export function walkFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walkFiles(p, out)
    else if (/\.(ts|tsx)$/.test(e.name) && !SKIP_FILE.test(p)) out.push(p)
  }
  return out
}

/* ---------- What reads as text ---------- */

const TAILWIND = new Set('flex grid block inline hidden relative absolute fixed sticky static italic uppercase lowercase capitalize truncate underline grow shrink contents table border rounded shadow ring outline transition transform invisible visible isolate antialiased container prose'.split(' '))
const isCss = (s) => {
  const toks = s.trim().split(/\s+/)
  if (!toks.every((t) => /^[!-]?[a-z0-9@\[\]#%().,:/_'&>*=-]+$/.test(t))) return false
  return toks.every((t) => /[-:[\]/]/.test(t) || TAILWIND.has(t))
}
const isUrl = (s) => /^\s*(\/|\.\.?\/|https?:|data:|blob:|mailto:|tel:|#|@|wss?:)/.test(s) || s.includes('://') || /\.(png|jpe?g|webp|svg|mp3|mp4|glb|gltf|json|woff2?|ttf|webm|ogg|wav|html|tsx?|css)\b/.test(s)
const isIdent = (s) => /^[a-z0-9_\-.:/#+]+$/.test(s) || /^[A-Z0-9_]+$/.test(s) || /^[a-z]+[A-Z][A-Za-z0-9]*$/.test(s)
const hasLetter = (s) => /[A-Za-zÀ-ÿ]/.test(s)
const technical = (s) => /\d+(px|ms|deg|vh|vw|rem|em)\b|rgba?\(|hsla?\(|^#[0-9a-f]{3,8}$|\bvar\(--|^\s*[\d.]+\s*$|=>|\bfunction\b|\bcalc\(|^[a-z-]+\(/i.test(s) || /^(Content-Type|Authorization|Bearer|POST|GET|PUT|PATCH|DELETE|Idempotency-Key)$/.test(s)

function prose(raw, loose) {
  const s = raw.trim()
  if (!s || !hasLetter(s) || isUrl(s) || isCss(s) || technical(s)) return false
  if (s.includes('{') || s.includes('}')) return false
  if (loose) return !(/^[a-z0-9_\-.:/#]+$/.test(s) && /[-_.:/#]/.test(s))
  if (isIdent(s)) return false
  return /\s/.test(s) || /[À-ÿ’]/.test(s) || /^[A-ZÀ-Ý][a-zà-ÿ'’]+[.!?…]?$/.test(s) || /[.!?…]$/.test(s)
}

/* ---------- The contexts ---------- */

const ID_PROPS = new Set('id key kind type slug path url href src to icon iconName color colors bg background className class cls style tone gender mode variant sound sfx anim animation emote engine decor npc prop props base object fill carry shape model mesh texture image img photo video audio font fontFamily fontWeight family weight align justify position side dir direction rel target method action interaction app tab route screen view state status phase size as role testid htmlFor autoComplete inputMode pattern accept encType lang cursor easing ease transition layout format unit currency locale code ref value d viewBox stroke strokeWidth transform points clipPath mask filter gradientUnits stopColor offset opacity xmlns fillRule clipRule strokeLinecap strokeLinejoin preserveAspectRatio crossOrigin loading decoding referrerPolicy sizes srcSet media poster preload playsInline muted loop autoPlay draggable spellCheck enterKeyHint autoCapitalize autoCorrect inputClass wrapClass cssClass tint hue skin hair outfit pose face mood room floor furniture item items_ids topic source category cat place commune city quartier quarter faith job jobId sport team side_ slot spot zone tier rarity level grade hex rgb'.split(' '))
const TEXT_PROPS = new Set('label title text desc description sub subtitle hint how placeholder alt aria-label ariaLabel caption message msg body note cta button verb tip help about info heading header question answer reply prompt tagline intro outro lead empty legend tooltip confirm ok cancel done error success warning line lines feedback hello bye says say greeting question q a'.split(' '))
const SKIP_CALLS = new Set('startsWith endsWith includes indexOf lastIndexOf split replace replaceAll match matchAll test search has get delete getItem setItem removeItem querySelector querySelectorAll getElementById closest matches addEventListener removeEventListener dispatchEvent CustomEvent Event postMessage fetch request send post put patch del require import useTexture useGLTF useLoader load preload loadAsync createElement setAttribute getAttribute removeAttribute setProperty getPropertyValue matchMedia Symbol log warn error info debug trace cn clsx classNames twMerge keyOpen activityOpen navigate pushState replaceState track emit on off once Intl NumberFormat DateTimeFormat toLocaleString toLocaleDateString toLocaleTimeString Date RegExp URL URLSearchParams atob btoa encodeURIComponent decodeURIComponent structuredClone sfx play playSfx haptic vibrate beep sound animate keyframes localeCompare useFeatures getContext toDataURL toBlob canPlayType createLinearGradient addColorStop measureText assertNever keep kept keepData keptData photoURL blobUrl open lazy t tx tr trx tn'.split(' '))
const COMPARE_CALLS = new Set('startsWith endsWith includes indexOf lastIndexOf has get delete localeCompare')
const SKIP_VAR = /class|cls|style|css|font|color|colou?r|shadow|gradient|^bg|ring|tone|path|url|href|key$|^key|^id$|Id$|^ids?$|regex|^re$|pattern|selector|query|mime|format|locale/i

const callName = (e) => (ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : '')
const propName = (n) => (n && (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isPrivateIdentifier(n)) ? n.text : n && ts.isComputedPropertyName(n) ? '' : '')

/** The strings the code compares or uses as keys anywhere: these stay in French. */
export function collectCompared(files) {
  const set = new Set()
  for (const f of files) {
    const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const add = (n) => {
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) set.add(n.text.trim())
      else if (ts.isConditionalExpression(n)) { add(n.whenTrue); add(n.whenFalse) }
    }
    const visit = (n) => {
      if (ts.isBinaryExpression(n) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.InKeyword].includes(n.operatorToken.kind)) { add(n.left); add(n.right) }
      if (ts.isCaseClause(n)) add(n.expression)
      if (ts.isCallExpression(n) && COMPARE_CALLS.has(callName(n.expression))) n.arguments.forEach(add)
      if (ts.isElementAccessExpression(n)) add(n.argumentExpression)
      if ((ts.isPropertyAssignment(n) || ts.isPropertySignature(n) || ts.isMethodDeclaration(n) || ts.isShorthandPropertyAssignment(n)) && n.name && !ts.isComputedPropertyName(n.name)) {
        const k = n.name.text
        // A key that reads as a word (Plateau:, 'Le Plateau':) is a lookup by that word.
        if (/^[A-ZÀ-Ý]/.test(k) || /\s/.test(k)) set.add(k)
      }
      if (ts.isLiteralTypeNode(n) && ts.isStringLiteral(n.literal)) set.add(n.literal.text.trim())
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
  return set
}

/* ---------- Writing it out ---------- */

// Single quotes, or double ones around an apostrophe (as the code writes them).
const q = (s) => {
  const b = s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r')
  return b.includes("'") && !b.includes('"') ? `"${b}"` : `'${b.replace(/'/g, "\\'")}'`
}
const ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", laquo: '«', raquo: '»', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', eacute: 'é', egrave: 'è', agrave: 'à', thinsp: ' ', middot: '·', times: '×', deg: '°', copy: '©' }
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] ?? m))
/** JSX's own whitespace: the lines trimmed and joined by a space. */
const jsxWs = (s) => s.replace(/[ \t]*\r?\n\s*/g, ' ')

function varName(e, used, sf) {
  let n = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : ''
  if (n && !/^[A-Za-z_]\w*$/.test(n)) n = ''
  const text = e.getText(sf)
  if (n) {
    if (!used.has(n)) return n
    if (used.get(n) === text) return n
    for (let i = 2; ; i++) if (!used.has(n + i) || used.get(n + i) === text) return n + i
  }
  for (let i = 0; ; i++) if (!used.has(String(i)) || used.get(String(i)) === text) return String(i)
}

function varsObject(entries) {
  // [name, exprText]
  const seen = new Set()
  const parts = []
  for (const [n, x] of entries) {
    if (seen.has(n)) continue
    seen.add(n)
    parts.push(n === x ? n : `${/^\d/.test(n) ? n : n}: ${x}`)
  }
  return `{ ${parts.join(', ')} }`
}

const hasJsx = (n) => {
  let found = false
  const v = (c) => {
    if (found) return
    if (ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c) || ts.isJsxFragment(c)) { found = true; return }
    // A function inside (a map's callback) can return elements: not inlined.
    if (ts.isArrowFunction(c) || ts.isFunctionExpression(c)) { found = true; return }
    ts.forEachChild(c, v)
  }
  v(n)
  return found
}
const inlineable = (e) => {
  if (!e) return false
  if (hasJsx(e)) return false
  if (ts.isCallExpression(e)) {
    const n = callName(e.expression)
    if (/^(map|flatMap|filter|render[A-Z]?\w*)$/.test(n) || /^[A-Z]/.test(n)) return false
  }
  return true
}

export function transform(file, compared) {
  const src = fs.readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  // Local names that would shadow t / tx: the import takes other names then.
  const locals = new Set()
  const scan = (n) => {
    if ((ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isFunctionDeclaration(n) || ts.isBindingElement(n) || ts.isClassDeclaration(n)) && n.name && ts.isIdentifier(n.name)) locals.add(n.name.text)
    if (ts.isImportSpecifier(n) && !/lib\/i18n/.test(n.parent.parent.parent.moduleSpecifier.text)) locals.add(n.name.text)
    ts.forEachChild(n, scan)
  }
  scan(sf)
  // Already imported from the i18n module (a second run): its names.
  let T = null, TX = null
  for (const st of sf.statements)
    if (ts.isImportDeclaration(st) && /lib\/i18n'?$/.test(st.moduleSpecifier.text) && st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings))
      for (const el of st.importClause.namedBindings.elements) {
        const orig = (el.propertyName ?? el.name).text
        if (orig === 't') T = el.name.text
        if (orig === 'tx') TX = el.name.text
      }
  const tName = T ?? ['t', 'tr', 'tl', 'tt'].find((n) => !locals.has(n))
  const txName = TX ?? ['tx', 'trx', 'tlx', 'ttx'].find((n) => !locals.has(n))
  if (!tName || !txName) throw new Error(`${file}: t, tr, tl and tt are all taken`)
  let usedT = false, usedTX = false
  const strings = []

  // decisions: node -> kind
  const wrap = new Map() // literal or template node -> true
  const runs = new Map() // jsx parent -> [{from, to}] child index ranges

  const isT = (n) => ts.isCallExpression(n) && [tName, txName, 't', 'tx', 'tr', 'trx', 'tn'].includes(callName(n.expression))

  const consider = (n, loose) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      if (!prose(n.text, loose) || compared.has(n.text.trim())) return
      wrap.set(n, true)
    } else if (ts.isTemplateExpression(n)) {
      const lit = [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(' ')
      if (!prose(lit, false) || !/[A-Za-zÀ-ÿ]{2,}/.test(lit) || !/\s/.test(n.head.text + n.templateSpans.map((s) => s.literal.text).join(''))) return
      if (isUrl(n.head.text) || isCss(lit)) return
      wrap.set(n, true)
    }
  }

  const visit = (n, ctx) => {
    if (isT(n)) return
    // Not text: types, imports, directives, class names, console…
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n) || ts.isImportTypeNode(n) || ts.isTypeNode(n) || ts.isExternalModuleReference(n) || ts.isEnumDeclaration(n) || ts.isTaggedTemplateExpression(n)) return
    if (ts.isExpressionStatement(n) && ts.isStringLiteral(n.expression)) return
    if (ts.isJsxAttribute(n)) {
      const name = n.name.getText(sf)
      if (ID_PROPS.has(name) || /^(data-|on[A-Z])/.test(name) || /class|Class|style|Style|color|Color|icon|Icon/.test(name)) return
      if (n.initializer && ts.isStringLiteral(n.initializer)) {
        consider(n.initializer, TEXT_PROPS.has(name) || /^aria-(label|description|roledescription|valuetext)$/.test(name))
        return
      }
      if (n.initializer) ts.forEachChild(n.initializer, (c) => visit(c, { loose: TEXT_PROPS.has(name) }))
      return
    }
    if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
      const name = callName(n.expression)
      if (name === 'console' || (ts.isPropertyAccessExpression(n.expression) && /^(console|localStorage|sessionStorage|document|JSON|Object|Reflect|Math)$/.test(n.expression.expression.getText(sf)))) return
      if (SKIP_CALLS.has(name)) {
        visit(n.expression, ctx)
        // Only the arguments' own literals are skipped; callbacks inside are still walked.
        for (const a of n.arguments ?? []) if (!(ts.isStringLiteral(a) || ts.isTemplateLiteral(a))) visit(a, ctx)
        return
      }
    }
    if (ts.isBinaryExpression(n) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.InKeyword, ts.SyntaxKind.InstanceOfKeyword].includes(n.operatorToken.kind)) {
      for (const side of [n.left, n.right]) if (!(ts.isStringLiteral(side) || ts.isTemplateLiteral(side))) visit(side, ctx)
      return
    }
    if (ts.isCaseClause(n)) {
      n.statements.forEach((s) => visit(s, ctx))
      return
    }
    if (ts.isElementAccessExpression(n)) {
      visit(n.expression, ctx)
      if (!(ts.isStringLiteral(n.argumentExpression) || ts.isTemplateLiteral(n.argumentExpression))) visit(n.argumentExpression, ctx)
      return
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && SKIP_VAR.test(n.name.text)) return
    if (ts.isPropertyAssignment(n)) {
      const k = propName(n.name)
      if (ID_PROPS.has(k) || SKIP_VAR.test(k)) return
      visit(n.initializer, { loose: TEXT_PROPS.has(k) })
      return
    }
    if (ts.isPropertyDeclaration(n) || ts.isMethodDeclaration(n) || ts.isGetAccessor(n)) {
      // Class fields: their names are not text, their values may be.
      if (n.initializer) visit(n.initializer, ctx)
      if (n.body) visit(n.body, ctx)
      return
    }
    if (ts.isJsxElement(n) || ts.isJsxFragment(n)) {
      const tag = ts.isJsxElement(n) ? n.openingElement.tagName.getText(sf) : ''
      if (ts.isJsxElement(n)) visit(n.openingElement, ctx)
      // <style>, <script>, <code>: their insides aren't the game's words.
      if (/^(style|script|code|pre|svg|path|g)$/.test(tag)) return
      const kids = n.children
      const found = []
      let i = 0
      while (i < kids.length) {
        const c = kids[i]
        if (ts.isJsxText(c) || (ts.isJsxExpression(c) && c.expression && inlineable(c.expression))) {
          let j = i
          while (j < kids.length && (ts.isJsxText(kids[j]) || (ts.isJsxExpression(kids[j]) && kids[j].expression && inlineable(kids[j].expression)))) j++
          // The run, trimmed of the expressions at its ends that aren't next to words.
          let a = i, b = j - 1
          while (a <= b && !ts.isJsxText(kids[a])) a++
          while (b >= a && !ts.isJsxText(kids[b])) b--
          const text = []
          for (let k = a; k <= b; k++) if (ts.isJsxText(kids[k])) text.push(decode(jsxWs(kids[k].text)))
          const run = a <= b && prose(text.join(' '), true) && !text.join('').includes('{') ? { from: a, to: b } : null
          if (run) found.push(run)
          for (let k = i; k < j; k++) {
            const c2 = kids[k]
            if (!ts.isJsxExpression(c2)) continue
            const inside = run && k >= run.from && k <= run.to
            // Inside a run, a literal is part of the sentence; other expressions are walked (a ternary's words).
            if (inside && (ts.isStringLiteral(c2.expression) || ts.isNoSubstitutionTemplateLiteral(c2.expression))) continue
            if (inside) visit(c2.expression, ctx)
            else visit(c2, { loose: true })
          }
          i = j
        } else {
          visit(c, ctx)
          i++
        }
      }
      if (found.length) runs.set(n, found)
      if (ts.isJsxElement(n)) visit(n.closingElement, ctx)
      return
    }
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) {
      consider(n, ctx.loose)
      if (ts.isTemplateExpression(n)) n.templateSpans.forEach((s) => visit(s.expression, { loose: false }))
      return
    }
    // A text prop's loose reading only goes one level (its value, a ternary's branches, an array's items).
    const keep = ts.isConditionalExpression(n) || ts.isArrayLiteralExpression(n) || ts.isParenthesizedExpression(n) || (ts.isBinaryExpression(n) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(n.operatorToken.kind))
    ts.forEachChild(n, (c) => visit(c, keep ? ctx : { loose: false }))
  }
  visit(sf, { loose: false })
  if (!wrap.size && !runs.size) return null

  // Generating: each node's text with the decisions inside it applied.
  const gen = (n) => {
    if (wrap.has(n)) {
      usedT = true
      if (ts.isTemplateExpression(n)) {
        const used = new Map()
        const entries = []
        let s = n.head.text
        for (const span of n.templateSpans) {
          const name = varName(span.expression, used, sf)
          const x = gen(span.expression)
          used.set(name, span.expression.getText(sf))
          entries.push([name, x])
          s += `{${name}}` + span.literal.text
        }
        strings.push(s)
        return `${tName}(${q(s)}, ${varsObject(entries)})`
      }
      strings.push(n.text)
      // A JSX attribute's string takes braces around the call.
      return ts.isJsxAttribute(n.parent) ? `{${tName}(${q(n.text)})}` : `${tName}(${q(n.text)})`
    }
    const start = n.getStart(sf)
    let out = ''
    let pos = start
    const r = runs.get(n)
    const kids = r ? n.children : null
    const children = []
    ts.forEachChild(n, (c) => { children.push(c) })
    if (r) {
      // Before the children (the opening tag), the children by runs, then the closing tag.
      const open = ts.isJsxElement(n) ? n.openingElement : n.openingFragment
      out += src.slice(start, open.getStart(sf)) + gen(open)
      pos = open.end
      let k = 0
      while (k < kids.length) {
        const run = r.find((x) => x.from === k)
        if (!run) {
          const c = kids[k]
          out += src.slice(pos, c.getStart(sf)) + gen(c)
          pos = c.end
          k++
          continue
        }
        const first = kids[run.from], last = kids[run.to]
        out += src.slice(pos, first.pos)
        const lead = first.text.match(/^\s*/)[0]
        const trail = last.text.match(/\s*$/)[0]
        const used = new Map()
        const entries = []
        let s = ''
        for (let m = run.from; m <= run.to; m++) {
          const c = kids[m]
          if (ts.isJsxText(c)) {
            let raw = c.text
            if (m === run.from) raw = raw.slice(lead.length)
            if (m === run.to) raw = raw.slice(0, raw.length - trail.length)
            s += decode(jsxWs(raw))
          } else if (ts.isStringLiteral(c.expression) || ts.isNoSubstitutionTemplateLiteral(c.expression)) {
            s += c.expression.text
          } else {
            const name = varName(c.expression, used, sf)
            used.set(name, c.expression.getText(sf))
            entries.push([name, gen(c.expression)])
            s += `{${name}}`
          }
        }
        strings.push(s)
        if (entries.length) {
          usedTX = true
          out += `${lead}{${txName}(${q(s)}, ${varsObject(entries)})}${trail}`
        } else {
          usedT = true
          out += `${lead}{${tName}(${q(s)})}${trail}`
        }
        pos = last.end
        k = run.to + 1
      }
      const close = ts.isJsxElement(n) ? n.closingElement : n.closingFragment
      out += src.slice(pos, close.getStart(sf)) + gen(close) + src.slice(close.end, n.end)
      return out
    }
    for (const c of children) {
      if (c.kind === ts.SyntaxKind.EndOfFileToken) continue
      const cs = c.getStart(sf)
      if (cs < pos) continue
      out += src.slice(pos, cs) + gen(c)
      pos = c.end
    }
    return out + src.slice(pos, n.end)
  }
  let out = src.slice(0, sf.getStart(sf)) + gen(sf)
  // The import, after the others.
  const names = []
  if (usedT && !T) names.push(tName === 't' ? 't' : `t as ${tName}`)
  if (usedTX && !TX) names.push(txName === 'tx' ? 'tx' : `tx as ${txName}`)
  if (names.length) {
    let rel = path.relative(path.dirname(file), path.join(SRC, 'lib/i18n')).replace(/\\/g, '/')
    if (!rel.startsWith('.')) rel = './' + rel
    const had = sf.statements.find((st) => ts.isImportDeclaration(st) && /lib\/i18n'?$/.test(st.moduleSpecifier.text))
    if (had) {
      // Add to it: the out text starts the same as the source up to the import.
      const old = had.getText(sf)
      const added = old.replace(/\{([^}]*)\}/, (m, inner) => `{ ${[...inner.split(',').map((x) => x.trim()).filter(Boolean), ...names].join(', ')} }`)
      out = out.replace(old, added)
    } else {
      const imports = sf.statements.filter((st) => ts.isImportDeclaration(st))
      const line = `import { ${names.join(', ')} } from '${rel}'\n`
      if (imports.length) {
        const lastImp = imports[imports.length - 1]
        // The position in `out` is the same: nothing before the last import changed (imports aren't touched).
        const at = out.indexOf('\n', lastImp.end) + 1 || out.length
        out = out.slice(0, at) + line + out.slice(at)
      } else out = line + out
    }
  }
  return { out, strings }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const all = walkFiles(SRC)
  // (NOCOMPARE=1: what the comparisons alone keep in French, to look at by hand.)
  const compared = process.env.NOCOMPARE ? new Set() : collectCompared(all)
  const files = only.length ? only : all
  let total = 0
  for (const f of files) {
    const r = transform(f, compared)
    if (!r) continue
    total += r.strings.length
    if (process.env.DUMP) fs.appendFileSync(process.env.DUMP, r.strings.map((s) => JSON.stringify([path.relative(ROOT, f), s]) + '\n').join(''))
    console.log(`${String(r.strings.length).padStart(4)} ${path.relative(ROOT, f)}`)
    if (WRITE) fs.writeFileSync(f, r.out)
  }
  console.log(`${total} strings${WRITE ? ' wrapped' : ' to wrap (dry run)'}`)
}
