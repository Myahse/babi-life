// Shot 4r: in the street, the free lot 6 held in frame; the maquis built (the API, as « Placer » does) at frame 4;
// when it stands (the frames compared in the lot's box), the camera holds 40 more frames (rise.py makes it come out
// of the ground there), then pushes in while Awa walks up to it. S.popAt: the first frame with it.
const fs = await import('fs')
const { execFileSync } = await import('child_process')
const page = S.page
const name = S.s4rName ?? 's4r'
fs.rmSync(S.F + name, { recursive: true, force: true })
const V = '/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/vmq/'
S.popAt = null
await page.evaluate(() => (globalThis.__popAt = null))
await S.place(S.awaAt ?? [98, -57], [114, -45])
S.cam4r = S.ease + `
const P0 = [110, 8, -67], L0 = [114, 2, -39], P1 = [111.5, 4.8, -60], L1 = [113.5, 2.6, -42]
const p = globalThis.__popAt
const k = p === null ? 0 : E((i - p - 40) / 75)
return { pos: [L(P0[0], P1[0], k), L(P0[1], P1[1], k), L(P0[2], P1[2], k)], look: [L(L0[0], L1[0], k), L(L0[1], L1[1], k), L(L0[2], L1[2], k)], fov: 50 }`
let ref = null
let n = 400
const r = await S.capture(name, 400, {
  cam: S.cam4r,
  clean: true,
  pre: 6,
  before: async (i) => {
    if (i === 14) {
      await L.call(S.p.token, `/sims/${S.p.sim.id}/quartier/build`, 'POST', { kind: 'maquis', slot: 6 })
      ref = 13
    }
    if (S.popAt === null && ref !== null && i > 6) {
      const d = +execFileSync('python3', [V + 'popcheck.py', `${S.F}${name}/${String(ref).padStart(4, '0')}.jpg`, `${S.F}${name}/${String(i - 1).padStart(4, '0')}.jpg`, '0', '600', '1080', '1300']).toString()
      if (d > 12) {
        S.popAt = i - 1
        await page.evaluate((p) => (globalThis.__popAt = p), i - 1)
        console.log('pop at', i - 1, d)
      }
    }
    if (S.popAt !== null && i === S.popAt + 9999) {
      await page.evaluate(() => globalThis.__walkTo?.(108, -50))
    }
    if (S.popAt !== null && i >= S.popAt + 125) throw new Error('done')
  },
}).catch((e) => String(e))
return [r, S.popAt]
