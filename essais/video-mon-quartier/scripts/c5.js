// Candidates for the street life shot round the roundabout: low three-quarter views from four sides.
const c = [30.5, -19.5]
S.cams = []
for (const [n, az] of [['n', Math.PI], ['e', Math.PI / 2], ['s', 0], ['w', -Math.PI / 2], ['ne', 2.35], ['sw', -0.8]]) {
  const r = 30
  S.cams.push(['life-' + n, [c[0] + Math.sin(az) * r, 8, c[1] + Math.cos(az) * r], [c[0] - Math.sin(az) * 6, 1.5, c[1] - Math.cos(az) * 6], 50])
}
S.warm = 8
S.warmMs = 300
return S.cams.length
