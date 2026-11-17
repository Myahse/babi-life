const c = [128, -73]
S.cams = []
for (let k = 0; k < 8; k++) {
  const az = (k / 8) * Math.PI * 2
  S.cams.push(['lot-' + k, [c[0] + Math.sin(az) * 20, 11, c[1] + Math.cos(az) * 20], [c[0], 1.2, c[1]], 45])
}
S.warm = 5
S.warmMs = 300
await S.page.evaluate(() => (__clean(true)))
return S.cams.length
