import { useEffect, useState } from 'react'
import { Smartphone, Users, CheckCheck, X } from 'lucide-react'
import { API_BASE } from '../lib/env'
import { inApp, nativeApp } from '../lib/native'
import { t as tr } from '../lib/i18n'
import { IconTile } from './ui'

// « Deviens testeur de l'appli Android » (update « testeurs-android »): Babi Life is going on the Play Store, which
// asks for testers for 14 days first. A card to the players on an Android phone's browser or a computer (not in the
// app, not on an iPhone): join the testers' Google group, accept the test on the Play Store, install the app. The two
// links are the team's, pasted in /admin (« Testeurs de l'appli », backend admin/liens.go); while either is empty,
// no card. « Plus tard »: again in three days; « C'est fait »: never again.

export type TesterLinks = { group: string; play: string }

const KEY = 'babi.testeurs'
const LATER = 3 * 24 * 3600 * 1000

/** Where the card may show: a phone with Android or a computer, in the browser (the app's players test it already). */
export const testersHere = () => !inApp() && !nativeApp && !/iPhone|iPad|iPod/i.test(navigator.userAgent)

/** Not « C'est fait », and not « Plus tard » less than three days ago. */
function due(): boolean {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'fait') return false
    return !v || Date.now() - Number(v) > LATER
  } catch {
    return true
  }
}
function answer(v: 'fait' | 'plus-tard') {
  try {
    localStorage.setItem(KEY, v === 'fait' ? 'fait' : String(Date.now()))
  } catch {
    // Private mode: it comes back next time.
  }
}

/** The links, once both are set, while the card is due here (null otherwise). */
export function useTesterLinks(on: boolean): TesterLinks | null {
  const [links, setLinks] = useState<TesterLinks | null>(null)
  useEffect(() => {
    if (!on || !testersHere() || !due()) return
    let live = true
    fetch(`${API_BASE}/testeurs`)
      .then((r) => (r.ok ? (r.json() as Promise<TesterLinks>) : null))
      .then((l) => live && l?.group && l.play && setLinks(l))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [on])
  return links
}

export function TestersCard({ links, onClose }: { links: TesterLinks; onClose: () => void }) {
  const [step, setStep] = useState(0)
  const open = (url: string, next: number) => {
    window.open(url, '_blank', 'noopener')
    setStep((s) => Math.max(s, next))
  }
  const close = (v: 'fait' | 'plus-tard') => (answer(v), onClose())
  return (
    <div className="card animate-pop pointer-events-auto w-full p-3" data-testers>
      <div className="flex items-start gap-3">
        <IconTile icon={Smartphone} colors={['#69e2a0', '#00a862']} size={42} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="label">{tr('Babi Life arrive sur le Play Store')}</div>
          <div className="font-display text-[15px] font-extrabold">{tr('Deviens testeur de l’appli Android')}</div>
          <div className="mt-1 text-[12px] leading-snug font-semibold text-[var(--color-ink-soft)]">{tr('Il nous faut des testeurs pendant 14 jours. Garde l’appli installée jusqu’au bout : c’est ce qui compte.')}</div>
        </div>
        <button className="icon-btn !h-8 !w-8 shrink-0 bg-[var(--color-canvas)]" onClick={() => close('plus-tard')} aria-label={tr('Plus tard')} title={tr('Plus tard')}>
          <X size={16} strokeWidth={2.6} />
        </button>
      </div>
      <div className="mt-2.5 grid gap-1.5">
        <button className={`btn flex items-center justify-center gap-1.5 !py-2 !text-sm ${step > 0 ? 'btn-soft' : '!bg-[#1c7a4a]'}`} onClick={() => open(links.group, 1)}>
          {step > 0 ? <CheckCheck size={15} /> : <Users size={15} />} {tr('1. Rejoindre le groupe des testeurs')}
        </button>
        <button className={`btn flex items-center justify-center gap-1.5 !py-2 !text-sm ${step === 1 ? '!bg-[#1c7a4a]' : 'btn-soft'}`} onClick={() => open(links.play, 2)}>
          {step > 1 ? <CheckCheck size={15} /> : <Smartphone size={15} />} {tr('2. Accepter le test et installer')}
        </button>
        {step > 1 && (
          <button className="btn !bg-[#e8731f] !py-2 !text-sm" onClick={() => close('fait')}>
            {tr('C’est fait, merci !')}
          </button>
        )}
      </div>
    </div>
  )
}
