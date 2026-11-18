// S.uiShot(name, n, plan, o): a shot of the game's screens (UI shown, no camera of ours) with taps drawn as rings.
// plan: { frame: async (h) => … } with h.tapAt(i, locator, what) (the ring from frame i, on the element's middle),
// h.click(what, waitMs) (clicks where the ring is, then waits in real time with CSS animations held).
const page = S.page
S.boxOf = async (loc) => {
  const n = await loc.count()
  for (let k = n - 1; k >= 0; k--) {
    const b = await loc.nth(k).boundingBox()
    if (b && b.width > 0 && b.y >= 0 && b.y < 640) return [b.x + b.width / 2, b.y + b.height / 2]
  }
  return null
}
S.uiShot = async (name, n, plan, o = {}) => {
  const fs = await import('fs')
  fs.rmSync(S.F + name, { recursive: true, force: true })
  const notes = []
  let tap = null
  const h = {
    page: S.page,
    notes,
    tapAt: async (i, loc, what) => {
      const at = await S.boxOf(loc)
      if (!at) return notes.push(['no box', what, i])
      tap = { i, at, what }
    },
    click: async (what, ms = 60) => {
      if (!tap) return notes.push(['nothing to click', what])
      await S.page.mouse.click(tap.at[0], tap.at[1])
      await S.wait(ms)
      notes.push(['click', what, tap.at.map(Math.round)])
    },
  }
  const r = await S.capture(name, n, {
    ...o,
    before: async (i) => {
      if (plan[i]) await plan[i](h, i)
      if (tap) {
        await S.tapRing(tap.at[0], tap.at[1], i - tap.i)
        if (i - tap.i > 12) (tap = null), await S.tapRing(0, 0, -1)
      }
    },
  })
  await S.tapRing(0, 0, -1)
  return [r, notes]
}
return 'ok'
