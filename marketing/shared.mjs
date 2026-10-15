// What the logo, flyer and video scripts share: the brand, the wordmark as
// outlines (no font needed to open the files), and a browser to render PNGs.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'
import { chromium } from 'playwright-core'

export const HERE = path.dirname(fileURLToPath(import.meta.url))
export const OUT = path.join(HERE, 'out')
fs.mkdirSync(OUT, { recursive: true })

/** The game's colours (web/src/index.css). */
export const BRAND = { night: '#0f1230', ink: '#161a2b', orange: '#ff7a00', gold: '#ffc233', emerald: '#00b86b', violet: '#7b5cff', white: '#ffffff' }

/**
 * Where people sign up (lifeinbabi.com). Another address: pass it with
 * `WAITLIST_URL=https://… npm run all` and everything is made again.
 */
export const URL = process.env.WAITLIST_URL || 'https://lifeinbabi.com/liste'
/** The address as printed: short, no https://. */
export const SHORT = URL.replace(/^https?:\/\//, '').replace(/\/$/, '')

const FONT = path.join(HERE, '../web/node_modules/@fontsource/baloo-2/files/baloo-2-latin-800-normal.woff')
let font
/** Text in Baloo 2 ExtraBold as an SVG path (`d`), and its width, at a font size. */
export function textPath(text, size, x = 0, y = 0) {
  font ??= opentype.parse(fs.readFileSync(FONT).buffer.slice(0))
  const p = font.getPath(text, x, y, size)
  return { d: p.toPathData(2), width: font.getAdvanceWidth(text, size) }
}

/** The fonts as data URLs, for HTML pages rendered here (flyer, video). */
export function fontFaces() {
  const face = (family, file, weight) => {
    const p = path.join(HERE, '../web/node_modules/@fontsource', file)
    return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${fs.readFileSync(p).toString('base64')}) format('woff2')}`
  }
  return [face('Baloo 2', 'baloo-2/files/baloo-2-latin-800-normal.woff2', 800), face('Baloo 2', 'baloo-2/files/baloo-2-latin-700-normal.woff2', 700), face('Nunito', 'nunito/files/nunito-latin-700-normal.woff2', 700), face('Nunito', 'nunito/files/nunito-latin-800-normal.woff2', 800)].join('\n')
}

/** Chromium: the one installed for Playwright, or CHROMIUM=/path/to/chrome. */
export function browser() {
  const executablePath = process.env.CHROMIUM || ['/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p))
  return chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
}
