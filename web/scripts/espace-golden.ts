// The launches' golden case (lib/espace.ts LAUNCH_GOLDEN, the backend's game/espace_test.go): the phone's timetable
// the same as the server's. Run: node --experimental-strip-types scripts/espace-golden.ts
import { LAUNCH_GOLDEN as g, launchHash, launchOffset, nextLaunch, scrubbed } from '../src/lib/espace.ts'

const bad: string[] = []
if (launchHash('sassandra') !== g.hash) bad.push(`hash ${launchHash('sassandra')}`)
for (const [id, off] of Object.entries(g.offsets)) if (launchOffset(id, true) !== off) bad.push(`${id} offset ${launchOffset(id, true)}`)
for (const [id, off] of Object.entries(g.cargoOffsets)) if (launchOffset(id, false) !== off) bad.push(`${id} cargo ${launchOffset(id, false)}`)
for (const [id, at] of Object.entries(g.next)) if (nextLaunch(id, g.at).at !== at) bad.push(`${id} next ${nextLaunch(id, g.at).at}`)
const s = [...Array(12).keys()].filter((n) => scrubbed('sassandra', true, n))
if (s.join() !== g.scrubbed.join()) bad.push(`scrubbed ${s}`)
if (bad.length) {
  console.error('espace golden:', bad.join('; '))
  process.exit(1)
}
console.log('espace golden: ok')
