const fs = await import('fs')
fs.rmSync(S.F + 's3', { recursive: true, force: true })
let w
await S.page.evaluate(() => (globalThis.__s3 = null))
const r = await S.capture('s3', 270, { cam: S.cam3, clean: true, pre: 20, go: async () => (w = await S.walk3()) })
return [w, r]
