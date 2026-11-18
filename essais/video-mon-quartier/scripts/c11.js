await S.place([72, -18], [90, -18])
await S.page.evaluate(() => (vclock.on(), (globalThis.__videoCam = { pos: [70, 8, -10], look: [84, 1, -40], fov: 50 })))
await S.step(90, 150)
S.cams = [
  ['mkt', [70, 8, -10], [84, 1, -40], 50],
  ['road', [52, 6, -12], [100, 1, -24], 50],
  ['maq', [92, 7, -30], [88, 1, 0], 50],
]
S.warm = 6
S.warmMs = 300
return await S.page.evaluate(() => globalThis.__simGroup.current.position.toArray().map(Math.round))
