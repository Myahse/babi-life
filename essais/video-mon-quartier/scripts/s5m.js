// Shot 5m (~3.2 s): the world's market at 17 h, its stalls, sellers and customers; a slow move in over it.
S.cam5m = S.ease + `
const k = 0
return { pos: [L(-40, -34, k), L(8, 6.2, k), L(-50, -55, k)], look: [L(-23, -20, k), 1, L(-76, -78, k)], fov: 50 }`
if (!S.go) return await S.preview('s5m', S.cam5m, [0, 98], 8)
return await S.capture('s5m', 100, { cam: S.cam5m, clean: true, pre: 8 })
