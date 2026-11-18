const page = S.page
const notes = []
await page.evaluate(() => (globalThis.__streetReady = null))
await page.getByRole('button', { name: 'Y aller à pied' }).click({ timeout: 5000 }).catch((e) => notes.push(String(e).slice(0, 80)))
const t0 = Date.now()
await L.waitFor(page, () => !!globalThis.__streetReady && !!globalThis.__simGroup?.current && !globalThis.__quartier.getState().active, 420000).catch((e) => notes.push(String(e).slice(0, 80)))
notes.push(['city in', Date.now() - t0])
await L.sleep(25000)
await page.evaluate(() => window.dispatchEvent(new Event('videocam')))
await L.sleep(1000)
await S.shot('city-ui')
notes.push(await page.evaluate(() => ({ q: globalThis.__quartier.getState().active, sim: globalThis.__simGroup?.current?.position.toArray().map(Math.round), buttons: [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((t) => /Rentrer|quartier/.test(t)).slice(0, 5) })))
return notes
