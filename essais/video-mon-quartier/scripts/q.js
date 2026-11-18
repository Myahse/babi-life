return await S.page.evaluate(() => {
  const s = globalThis.__quartier.getState()
  return { built: JSON.stringify(s.built).slice(0, 1500), sim: globalThis.__simGroup.current.position.toArray().map(Math.round) }
})
