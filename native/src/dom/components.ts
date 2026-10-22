import { acc, declare, merge, type Acc } from './style'
import { STREET_VARS } from './theme'

// The game's own classes (web/src/index.css: .btn, .card, .tile, .input, the wish list's painted
// wall…), as they're drawn on an element: by its state (pressed, disabled, aria-pressed), and by
// where it is (.street .btn has square corners, .segmented > button, .taped .cap).

export type OwnState = { tag: string; pressed: boolean; disabled: boolean; focused: boolean; ariaPressed?: boolean; ariaSelected?: boolean; ariaInvalid?: boolean; scopes: string[]; parentOwn: string[]; own: string[] }

const css = (a: Acc, decls: Record<string, any>) => {
  for (const [k, v] of Object.entries(decls)) declare(a, k, v)
}

/** The game's own classes on one element, in our shape (they win over plain utilities, as unlayered CSS does). */
export function ownStyle(s: OwnState): Acc {
  const a = acc()
  const has = (c: string) => s.own.includes(c)
  const street = s.scopes.includes('street') || has('street')

  // Every button gives under the finger (motion.css): a class's own active: wins.
  if (s.tag === 'button' && s.pressed && !s.disabled) a.tf.scale = 0.95

  if (has('card')) css(a, { backgroundColor: 'var(--color-surface)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(22,26,43,0.06)', boxShadow: '0 12px 32px -16px rgba(22,26,43,0.28)' })
  if (has('hud')) css(a, { backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: 'rgba(22,26,43,0.06)', boxShadow: '0 6px 20px -10px rgba(15,18,48,0.45)' })
  if (has('sheet')) css(a, { backgroundColor: 'var(--color-surface)', boxShadow: '0 -8px 30px -12px rgba(15,18,48,0.35)' })

  if (has('btn')) {
    css(a, { display: 'inline-flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, paddingLeft: 20.8, paddingRight: 20.8, paddingTop: 0, paddingBottom: 0, borderRadius: street ? 4 : 14, fontFamily: 'Nunito', fontSize: 16, fontWeight: 800, lineHeight: 1, color: '#fff', backgroundColor: 'var(--color-orange)', boxShadow: '0 8px 18px -10px rgba(224,90,0,0.7)', position: 'relative' })
    if (has('btn-emerald')) css(a, { backgroundColor: 'var(--color-emerald)', boxShadow: '0 8px 18px -10px rgba(0,137,79,0.7)' })
    if (has('btn-white')) css(a, { color: 'var(--color-ink)', backgroundColor: '#fff', borderWidth: 1, borderColor: 'var(--color-line)', boxShadow: 'none' })
    if (has('btn-soft')) css(a, { minHeight: 46, color: 'var(--color-ink)', backgroundColor: 'var(--color-canvas)', boxShadow: 'none' })
    if (s.pressed && !s.disabled) {
      a.tf.scale = 0.98
      a.f.shadow = 'none'
    }
    if (s.disabled) {
      a.v.opacity = 0.45
      a.f.shadow = 'none'
      a.tf.scale = 1
    }
  }
  if (has('icon-btn')) {
    css(a, { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 12 })
    if (s.pressed) a.tf.scale = 0.94
  }
  if (has('tile')) {
    css(a, { position: 'relative', borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: 'var(--color-line)' })
    if (s.pressed && !s.disabled) a.tf.scale = 0.98
    if (s.ariaPressed) css(a, { backgroundColor: '#fff7ef', borderColor: 'var(--color-orange)', boxShadow: '0 0 0 1px var(--color-orange)' })
    if (s.disabled) {
      a.v.opacity = 0.4
      a.tf.scale = 1
    }
  }
  if (has('input')) {
    css(a, { width: '100%', height: 48, borderRadius: street ? 4 : 12, borderWidth: 1, borderColor: '#dcdfea', backgroundColor: '#fff', paddingLeft: 15.2, paddingRight: 15.2, fontFamily: 'Nunito', fontSize: 16, fontWeight: 700, color: 'var(--color-ink)' })
    if (s.focused) css(a, { borderColor: 'var(--color-orange)', boxShadow: '0 0 0 4px rgba(255,122,0,0.14)' })
    if (s.ariaInvalid) css(a, { borderColor: 'var(--color-rose)', boxShadow: '0 0 0 4px rgba(255,77,109,0.12)' })
  }
  if (has('label')) css(a, { fontSize: 11.52, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' })
  if (has('segmented')) {
    css(a, { display: 'grid', gridAutoFlow: 'column', padding: 4, borderRadius: street ? 4 : 12, backgroundColor: 'var(--color-canvas)' })
  }
  if (s.tag === 'button' && s.parentOwn.includes('segmented')) {
    css(a, { borderRadius: street ? 3 : 9, paddingTop: 8.8, paddingBottom: 8.8, fontSize: 15.2, fontWeight: 800, color: 'var(--color-ink-soft)', alignItems: 'center' })
    if (s.ariaSelected) css(a, street ? { backgroundColor: 'var(--brown)', color: 'var(--cream)', boxShadow: 'none' } : { backgroundColor: '#fff', color: 'var(--color-ink)', boxShadow: '0 1px 3px rgba(22,26,43,0.12)' })
  }
  if (has('tnum')) a.t.fontVariant = ['tabular-nums']
  if (street && has('rounded-xl')) a.v.borderRadius = 4

  // The wish list: paint on a lime-washed wall.
  if (has('street')) {
    a.vars = { ...STREET_VARS }
    css(a, { backgroundColor: 'var(--wall)', color: 'var(--brown)' })
    a.f.scopes = ['street']
  }
  if (has('worn') && street)
    css(a, { backgroundImage: 'radial-gradient(rgba(90,60,30,0.06) 1px, transparent 1.5px), radial-gradient(rgba(255,255,255,0.2) 1px, transparent 1.6px)', backgroundSize: '6px 6px, 9px 9px', backgroundPosition: '0 0, 3px 4px' })
  if (has('paint')) css(a, { fontFamily: 'Anton', textTransform: 'uppercase', letterSpacing: '0.01em', lineHeight: 0.92, fontWeight: 400 })
  if (has('slab')) css(a, { fontFamily: 'Alfa Slab One', fontWeight: 400 })
  if (has('chalk-hand')) css(a, { fontFamily: 'Caveat', fontWeight: 700 })
  if (has('ci-stripe')) css(a, { height: 8, backgroundImage: 'linear-gradient(90deg, #f07a12 0%, #f07a12 33.3%, #fbf5e6 33.3%, #fbf5e6 66.6%, #0b6b3d 66.6%, #0b6b3d 100%)' })
  if (has('sign-btn')) {
    css(a, { display: 'inline-flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Alfa Slab One', fontSize: 18, fontWeight: 400, color: '#fbf5e6', backgroundColor: '#b5432c', paddingTop: 14, paddingBottom: 14, paddingLeft: 20, paddingRight: 20, borderRadius: 3 })
    if (has('alt')) css(a, { backgroundColor: 'transparent', color: '#2b1d14', boxShadow: 'inset 0 0 0 2px #2b1d14' })
    if (has('turq')) css(a, { backgroundColor: '#1f8f88' })
    if (s.pressed) a.tf.ty = 2
    if (s.disabled) a.v.opacity = 0.55
  }
  if (has('taped')) {
    css(a, { backgroundColor: '#fff', paddingTop: 7, paddingLeft: 7, paddingRight: 7, paddingBottom: 30, position: 'relative', boxShadow: '0 1px 3px rgba(43,29,20,0.25)' })
    a.f.scopes = [...(a.f.scopes ?? []), 'taped']
  }
  if (has('cap') && s.scopes.includes('taped')) css(a, { position: 'absolute', left: 0, right: 0, bottom: 2, textAlign: 'center', fontFamily: 'Caveat', fontWeight: 700, fontSize: 22, color: '#2b1d14' })
  if (has('ardoise')) css(a, { backgroundColor: '#26332c', color: '#f1eee4', borderWidth: 9, borderColor: '#7a5534', borderRadius: 4 })
  if (has('motion-typing')) css(a, { width: 7, height: 7, borderRadius: 9999, backgroundColor: '#8696a0' })
  if (has('motion-flood')) css(a, { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'none' })
  if (has('tiki-progress')) css(a, { width: '100%', transformOrigin: 'left' })

  // Their animations, by name (anim.ts).
  for (const c of s.own) if (c.startsWith('motion-') || c.startsWith('tiki-')) a.f.anim = [...(a.f.anim ?? []), c]
  return a
}

/** Scopes the children are in (.street, .taped), adding the element's own. */
export const scopesOf = (parent: string[], own: Acc) => (own.f.scopes?.length ? [...parent, ...own.f.scopes] : parent)

export { merge }
