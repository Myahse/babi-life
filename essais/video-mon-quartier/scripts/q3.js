// Where the quartier's places are (world places on slots: lot -2 - i), its gbaka stop, home.
return await S.page.evaluate(() => {
  const s = __quartier.getState()
  const u = s.univ
  const at = (lot) => (lot >= 0 ? u.lots[lot] : u.slots[-2 - lot])
  return { home: u.home, built: s.built.map((b) => [b.lot, b.kind, at(b.lot)?.at?.map(Math.round), at(b.lot)?.street?.map?.(Math.round)]) }
})
