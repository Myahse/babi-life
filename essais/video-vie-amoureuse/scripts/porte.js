const fs = await import('fs')
const runLoad = async () => { const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor; return new AsyncFunction('L', 'S', 'log', fs.readFileSync('/tmp/claude-0/land/video-vie-amoureuse/scripts/load.js', 'utf8'))(L, S, log) }
S.who = 'Awa'; S.q = '?place=home&hour=16'; S.settle = 300; S.pre = null; S.extra = { }
await runLoad()
await S.css('body.clean [data-door-hug], body.clean [data-door-hug] *{visibility:visible!important}')
let seen = -1
const r = await S.tapShot('porte', 600, [], { each: async (i) => {
  const has = await S.page.evaluate((clean) => {
    for (const e of document.querySelectorAll('div,span,p,button')) if ((e.textContent ?? '').trim() === 'Nager dans la piscine') { let t = e; while (t.parentElement && (t.parentElement.textContent ?? '').trim() === 'Nager dans la piscine' && t.parentElement !== document.body) t = t.parentElement; t.style.setProperty('visibility', 'hidden', 'important') }
    if (clean) __clean(true)
    return !!document.querySelector('[data-door-hug]')
  }, S.porteClean ?? true)
  if (has && seen < 0) seen = i
  if (seen >= 0 && i - seen > 110) return 'stop'
} })
r.seen = seen
return r
