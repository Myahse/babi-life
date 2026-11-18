// Realism flashes: the gbaka stop at the street (cars passing), then the lagoon, the bridge and the Plateau.
S.camG = S.ease + `
const k = E(t / 1.6)
return { pos: [L(42, 39, k), 3.2, L(70, 66, k)], look: [L(22, 21, k), 1.8, 55], fov: 48 }`
S.camL = S.ease + `
const k = E(t / 1.6)
return { pos: [40, L(27, 22, k), L(112, 132, k)], look: [40, 0, L(255, 270, k)], fov: 50 }`
const a = await S.capture('sRg', 48, { cam: S.camG, clean: true, pre: 6 })
const b = await S.capture('sRl', 48, { cam: S.camL, clean: true, pre: 6 })
return [a, b]
