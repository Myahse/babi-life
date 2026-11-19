// S.date(name, label, plan): from the place's menu, starts the date and captures it frame by frame, answering each
// moment by plan[beat] (a choice, or a function of the line shown returning one), a tap ring on the button first.
// Ends opts.tail frames after the selfie. Writes S.F + name.
S.date = async (name, label, plan, o = {}) => {
  const page = S.page
  const fs = await import('fs')
  const dir = S.F + name
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  await page.getByText('Que faire').first().click()
  await L.sleep(1500)
  await page.evaluate(() => vclock.on())
  await page.getByText(label).first().click()
  await L.waitFor(page, () => !!document.querySelector('[data-rdv]'), 60000)
  // (Captured slower than it plays: the outing on the server kept going long enough for the score.)
  L.psql(`UPDATE sims SET activity = jsonb_set(activity, '{end}', to_jsonb((activity->>'end')::bigint + 240)) WHERE id = '${S.simId}' AND activity IS NOT NULL`)
  // the scene's first frames, its models: a few warm steps before the first saved frame
  for (let k = 0; k < (o.warm ?? 2); k++) (await page.evaluate(() => vclock.step()), await L.sleep(300))
  const log = []
  let i = 0, beat = -1, tapAt = -1, tapSel = null, tapXY = null, lineSince = -1, photoAt = -1
  const t0 = Date.now()
  while (i < 3000) {
    const st = await page.evaluate(() => {
      const r = document.querySelector('[data-rdv]')
      const hearts = [...document.querySelectorAll('[data-rdv] svg.lucide-heart')].length
      return { phase: r?.getAttribute('data-phase'), text: r ? r.querySelector('.bg-white')?.innerText : '' }
    })
    if (!st.phase) break
    if (st.phase === 'line' && lineSince < 0) { lineSince = i; beat++ }
    if (st.phase !== 'line') lineSince = -1
    if (st.phase === 'line' && tapAt < 0 && i - lineSince >= (o.read?.[beat] ?? 40)) {
      let c = plan[beat]
      if (typeof c === 'function') c = c(st.text)
      tapSel = `[data-choice="${c}"]`
      tapXY = await S.box(tapSel)
      tapAt = i
      log.push([i, beat, c, st.text.split('\n')[0]])
    }
    if (tapAt >= 0) {
      const k = i - tapAt
      await S.tapRing(tapXY[0], tapXY[1], k)
      if (k === 3) await S.click(tapSel)
      if (k > 12) (tapAt = -1, await S.tapRing(0, 0, -1))
    }
    if (o.each) await o.each(i, st)
    await page.evaluate(() => vclock.step())
    await page.screenshot({ path: `${dir}/${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 93, timeout: 0 })
    if (st.phase === 'photo' && photoAt < 0) photoAt = i
    if (photoAt >= 0 && i - photoAt > (o.tail ?? 75)) break
    log.push([i, st.phase].join(':'))
    if (i % 60 === 0) console.log(name, i, st.phase, Math.round((Date.now() - t0) / 1000) + 's')
    i++
  }
  fs.writeFileSync(dir + '.log.json', JSON.stringify(log))
  return { n: i, s: Math.round((Date.now() - t0) / 1000), picks: log.filter((x) => Array.isArray(x)) }
}
// Leaves the date (« Garder ce souvenir ») and the virtual clock.
S.dateEnd = async () => {
  await S.click('[data-rdv-done]') || (await S.click('[data-rdv] button[aria-label]'))
  for (let k = 0; k < 20; k++) await S.page.evaluate(() => vclock.step())
  await S.page.evaluate(() => vclock.off())
}
return 'ok'
