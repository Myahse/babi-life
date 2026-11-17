// S.keep([...selectors]): in clean frames, these stay visible over the street.
S.keep = async (sels) => {
  await S.page.evaluate((sels) => {
    let st = document.getElementById('vkeep')
    if (!st) {
      st = document.createElement('style')
      st.id = 'vkeep'
      document.head.appendChild(st)
    }
    st.textContent = sels.map((s) => `body.clean ${s}, body.clean ${s} *`).join(',') + (sels.length ? '{visibility:visible!important}' : '')
  }, sels)
}
// Puts the Sim down at a point facing another (no walk), and lets the game catch up.
S.place = async (at, face) => {
  await S.page.evaluate(({ at, face }) => {
    const g = globalThis.__simGroup.current
    g.position.x = at[0]
    g.position.z = at[1]
    g.rotation.y = Math.atan2(face[0] - at[0], face[1] - at[1])
  }, { at, face })
}
S.step = async (n = 1, ms = 200) => {
  for (let i = 0; i < n; i++) {
    await S.page.evaluate(() => vclock.step())
    await L.sleep(ms)
  }
}
S.shot = async (name) => {
  await S.page.screenshot({ path: `/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/vmq/prev/${name}.jpg`, type: 'jpeg', quality: 80, timeout: 0 })
}
return 'ok'
