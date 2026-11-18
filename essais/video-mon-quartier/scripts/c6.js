// Stills of the maquis (lot 6) in the evening.
await S.place([98, -57], [114, -45])
S.cams = [
  ['ev1', [111, 6, -63], [114, 2, -40], 50],
  ['ev2', [124, 5, -60], [112, 2, -42], 50],
  ['ev3', [103, 4, -58], [114, 2.5, -42], 55],
]
S.warm = 10
S.warmMs = 1200
return S.cams.length
