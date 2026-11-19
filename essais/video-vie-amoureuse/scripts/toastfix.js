// Bench only: the game's GET /amour (the bonjour) held until S.releaseAmour() is called, so it comes while filming.
S.holdAmour = async (page) => {
  let held = []
  S.releaseAmour = async () => {
    const all = held; held = []
    if (!all.length) return 0
    const last = all[all.length - 1]
    const res = await last.fetch()
    const body = await res.text()
    for (const x of all) await x.fulfill({ response: res, body }).catch(() => {})
    return all.length
  }
  await page.route(/\/amour$/, async (r) => {
    if (r.request().method() !== 'GET' || !S.hold) return r.continue()
    held.push(r)
  })
}
return 1
