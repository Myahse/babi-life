await S.page.evaluate(() => vclock.off())
await L.sleep(3000)
await S.shot('now')
return await S.page.evaluate(() => ({ q: globalThis.__quartier?.getState().active, ready: !!globalThis.__streetReady, sim: !!globalThis.__simGroup?.current, text: document.body.innerText.slice(0, 300) }))
