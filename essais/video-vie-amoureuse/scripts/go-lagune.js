const cine = '[data-rdv] > div:last-child{display:none!important} [data-rdv] button[aria-label]{visibility:hidden!important} [data-rdv] .pointer-events-none.absolute.inset-x-0{visibility:hidden!important}'
let on = false
return await S.date('lagune', 'Balade en amoureux', ['mot', 'ecouter', 'ecouter', 'mot'], {
  read: [45, 45, 45, 45],
  tail: 80,
  each: async (i, st) => {
    const want = st.phase === 'final' || st.phase === 'pose'
    if (want !== on) { on = want; await S.css(want ? cine : '') }
  },
})
