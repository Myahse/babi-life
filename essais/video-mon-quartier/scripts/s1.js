// Shot 1, the hook (0–3.6 s): a sweep over the quartier at golden hour, towards the lagoon and the Plateau.
S.cam1 = S.ease + `
const k = E(t / 3.6) * 0.85 + 0.15 * (t / 3.6)
const az = L(Math.PI - 0.55, Math.PI - 0.12, k)
const r = L(540, 390, k)
const h = L(210, 125, k)
const c = [60, 0, 0]
return { pos: [c[0] + Math.sin(az) * r, h, c[2] + Math.cos(az) * r], look: [60, 0, L(150, 190, k)], fov: 45 }`
return await S.capture('s1', 108, { cam: S.cam1, clean: true })
