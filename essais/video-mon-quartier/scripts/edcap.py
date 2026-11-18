p = '/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/vmq/overlays.mjs'
L = open(p).read().split('\n')
new = {
    35: """  ['c1', '<div class="card hook" style="top:1130px">Eh, imagine…<br>t’as <span class="o">ton propre quartier</span><br>à Babi</div>'],""",
    36: """  ['c2', `<div class="card" style="top:${TOP}px">Tu choisis <span class="o">ton plan</span></div>`],""",
    37: """  ['c3', `<div class="card" style="top:${LOW}px">dans le style<br>de <span class="o">ta commune</span></div>`],""",
    38: """  ['c3t', `<div class="card" style="top:${TOP}px">dans le style<br>de <span class="o">ta commune</span></div>`],""",
    42: """  ['c4', `<div class="card" style="top:${LOW}px">Ton perso <span class="o">vit là-dedans</span></div>`],""",
    43: """  ['c5', `<div class="card" style="top:${LOW}px">Tu tournes, <span class="o">tu zoomes</span></div>`],""",
    44: """  ['c6', `<div class="card" style="top:${LOW}px">La lagune, l’autoroute…<br>et <span class="o">le Plateau</span> là-bas</div>`],""",
    45: """  ['c7', `<div class="card" style="top:${TOP}px">Tu ouvres <span class="o">ton maquis</span></div>`],""",
    46: """  ['c7l', `<div class="card" style="top:${LOW}px">Tu ouvres <span class="o">ton maquis</span></div>`],""",
    47: """  ['c8', `<div class="card" style="top:${TOP}px">L’argent rentre,<br>ton quartier <span class="o">grandit</span></div>`],""",
    49: """  ['c10', `<div class="card" style="top:${LOW}px">…et <span class="o">tes gars</span> viennent te voir</div>`],""",
    50: """  ['c11', `<div class="card" style="top:${TOP}px">Tu veux bouger ?<br><span class="o">Tu vas à Babi</span></div>`],""",
}
for k, v in new.items():
    L[k - 1] = v
s = '\n'.join(L)
s = s.replace('<div class="sub">bientôt dans Babi Life</div>', '<div class="sub">Ton coin à toi.<br>Bientôt dans Babi Life</div>')
s = s.replace('.url { position: absolute; top: 1030px;', '.url { position: absolute; top: 1080px;').replace('.free { position: absolute; top: 1190px;', '.free { position: absolute; top: 1240px;')
open(p, 'w').write(s)
