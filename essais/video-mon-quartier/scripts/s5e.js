// Shot 5e (90 frames, 3 s): the player's maquis (lot 6) at night, full; a slow push in.
await S.place([98, -57], [114, -45])
S.cam5e = S.ease + `
const k = E(t / 3)
return { pos: [L(110.5, 111.8, k), L(6.2, 4.6, k), L(-64, -57.5, k)], look: [L(114, 114, k), L(2, 2.3, k), L(-40, -41, k)], fov: 50 }`
return await S.capture('s5e', 90, { cam: S.cam5e, clean: true, pre: 10 })
