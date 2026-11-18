// The big city (Cocody, real streets) from the air round the perso, then its bar with « Rentrer au quartier ».
const page = S.page
await page.getByRole('button', { name: 'Pas maintenant' }).click({ timeout: 2000 }).catch(() => {})
await L.sleep(1500)
const at = await page.evaluate(() => globalThis.__simGroup.current.position.toArray())
S.cam7 = S.ease + `
const c = [${at[0]}, 0, ${at[2]}]
const k = E(t / 3)
const az = L(2.2, 2.75, k)
const r = L(150, 120, k)
return { pos: [c[0] + Math.sin(az) * r, L(85, 70, k), c[2] + Math.cos(az) * r], look: [c[0] - Math.sin(az) * 40, 0, c[2] - Math.cos(az) * 40], fov: 45 }`
if (S.previewOnly) return await S.preview('s7', S.cam7, [0, 89], 8)
const fs = await import('fs')
fs.rmSync(S.F + 's7', { recursive: true, force: true })
return await S.capture('s7', 66, { cam: S.cam7, clean: true, pre: 8 })
