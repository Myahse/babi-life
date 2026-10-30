import { useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, Eye, EyeOff, HandCoins, QrCode, Receipt, Send } from 'lucide-react'
import { api } from '../lib/api'
import type { JournalEvent, Player, Sim, World } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { LOAN_INSTALLMENT, amount } from '../game/rules'
import { Chip } from '../components/ui'
import type { Act } from './phoneApps'
import { t, tx } from '../lib/i18n'

/** The balance hidden or not: kept on the device, as Wave keeps it. */
const HIDE_KEY = 'babi.waye.masque'
const hiddenBefore = () => {
  try {
    return localStorage.getItem(HIDE_KEY) === '1'
  } catch {
    return false
  }
}
const MASK = '••••••'

// Mirrors world.SendFee: 1 %, rounded up, at most 5 000 F.
const sendFee = (n: number) => Math.min(5000, Math.ceil(n / 100))
const QUICK = [1000, 2000, 5000, 10000, 25000]

/**
 * Waye, the game's mobile money (modelled on Wave): the balance, sending
 * money for 1 %, paying bills for free, and the history.
 */
export function WayeApp({ world, sim, act, journal, renderJournal, payTo }: { world: World; sim: Sim; act: Act; journal: JournalEvent[]; renderJournal: (events: JournalEvent[]) => React.ReactNode; /** A player friend to send to straight away. */ payTo?: string }) {
  // Hidden: the balance and what came in and went out with it.
  const [hidden, setHidden] = useState(hiddenBefore)
  const toggle = () =>
    setHidden((h) => {
      try {
        localStorage.setItem(HIDE_KEY, h ? '0' : '1')
      } catch {
        // (No storage: hidden for this time only.)
      }
      return !h
    })
  const [to, setTo] = useState<string | null>(payTo ?? null)
  const [sum, setSum] = useState(5000)
  // The player friends, to send them money too (it lands in their Waye at once).
  const [friends, setFriends] = useState<Player[]>([])
  useEffect(() => {
    api
      .around(sim.id)
      .then((a) => setFriends(a.friends))
      .catch(() => setFriends([]))
  }, [sim.id])
  const friend = friends.find((f) => f.id === to)
  const contact = world.contacts?.find((c) => c.id === to) ?? (friend ? { id: friend.id, name: friend.username ? `@${friend.username}` : friend.firstName, note: t("Ton ami·e {firstName} : l'argent arrive tout de suite sur son Waye.", { firstName: friend.firstName }) } : undefined)
  const fee = sendFee(sum)
  const earned = journal.reduce((s, e) => s + Math.max(0, e.money), 0)
  const spent = Math.abs(journal.reduce((s, e) => s + Math.min(0, e.money), 0))
  const installment = Math.min(LOAN_INSTALLMENT, sim.loan)

  if (contact) {
    return (
      <div className="space-y-3">
        <button className="flex items-center gap-1 text-sm font-extrabold text-[#1aa6e6]" onClick={() => setTo(null)}>
          <ChevronLeft size={16} /> {t('Retour')}
        </button>
        <div className="rounded-2xl bg-[#e8f7fe] p-4">
          <div className="label !text-[#0b7fb3]">{t('Envoyer à')}</div>
          <div className="font-display text-2xl leading-tight font-extrabold">{contact.name}</div>
          <div className="text-xs font-bold text-[var(--color-ink-soft)]">{contact.note}</div>
        </div>
        <label className="block">
          <span className="label">{t('Montant')}</span>
          <input type="number" inputMode="numeric" min={100} step={100} value={sum} onChange={(e) => setSum(Math.max(0, Number(e.target.value)))} className="field tnum mt-1 w-full font-display text-2xl font-extrabold" aria-label={t('Montant à envoyer')} />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button key={q} className={`rounded-full px-3 py-1 text-xs font-extrabold ${sum === q ? 'bg-[#1aa6e6] text-white' : 'bg-[var(--color-canvas)]'}`} onClick={() => setSum(q)}>
              {amount(q)}
            </button>
          ))}
        </div>
        <div className="rounded-2xl bg-[var(--color-canvas)] p-3 text-sm font-bold">
          <div className="flex justify-between">
            <span>{t('Frais (1 %)')}</span>
            <span className="tnum">{amount(fee)} {t('Djai')}</span>
          </div>
          <div className="mt-1 flex justify-between font-extrabold">
            <span>{t('Total débité')}</span>
            <span className="tnum">{amount(sum + fee)} {t('Djai')}</span>
          </div>
        </div>
        <button
          className="btn w-full !bg-[#1aa6e6]"
          disabled={sum < 100 || sim.money < sum + fee}
          onClick={() => act(`Envoyer à ${contact.name}`, 'send', 'social', () => api.send(sim.id, contact.id, sum)).then((ok) => ok && setTo(null))}
        >
          <Send size={18} /> {sim.money < sum + fee ? t('Solde insuffisant') : t('Envoyer {0} Djai', { 0: amount(sum) })}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-[22px] bg-[linear-gradient(160deg,#5fd3ff,#1aa6e6)] p-4 text-white">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold tracking-wider uppercase opacity-85">{t('Solde Waye')}</span>
          <button onClick={toggle} aria-label={hidden ? t('Afficher le solde') : t('Masquer le solde')}>
            {hidden ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        </div>
        <div className="tnum font-display text-4xl leading-tight font-extrabold">{hidden ? MASK : amount(sim.money)} {t('Djai')}</div>
        <div className="mt-3 flex gap-4 text-xs font-extrabold opacity-90">
          <span className="flex items-center gap-1">
            <ArrowDownLeft size={14} strokeWidth={3} /> {tx('{0} Djai reçus', { 0: hidden ? MASK : amount(earned) })}
          </span>
          <span className="flex items-center gap-1">
            <ArrowUpRight size={14} strokeWidth={3} /> {tx('{0} Djai dépensés', { 0: hidden ? MASK : amount(spent) })}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/95 p-2.5 text-[var(--color-ink)]">
          <QrCode size={44} strokeWidth={1.6} />
          <div className="text-xs font-bold">
            {t('Ton code Waye')}
            <div className="font-display text-sm font-extrabold">
              {sim.firstName} {sim.lastName}
            </div>
          </div>
        </div>
      </div>

      {friends.length > 0 && (
        <div>
          <div className="label mb-1.5">{t('Tes ami·es joueurs')}</div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {friends.map((f) => (
              <button key={f.id} className="flex w-16 shrink-0 flex-col items-center gap-1 text-center text-[11px] font-extrabold active:scale-95" onClick={() => setTo(f.id)}>
                <span className="relative block h-12 w-12 overflow-hidden rounded-full bg-gradient-to-b from-[#c9f0ff] to-[#5fd3ff] ring-2 ring-[#1aa6e6]">
                  <Portrait look={f.look} gender={f.gender} framing="head" />
                </span>
                <span className="w-full truncate">{f.username ? `@${f.username}` : f.firstName}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="label mb-1.5">{t("Envoyer de l'argent · 1 % de frais")}</div>
        <p className="mb-2 text-xs font-semibold text-[var(--color-ink-soft)]">{tx('Aux amis joueurs : {0} Djai par jour au plus, et pas avant 7 jours de compte.', { 0: amount(sim.today?.envoye?.max ?? 20000) })}</p>
        <div className="grid grid-cols-3 gap-2">
          {(world.contacts ?? []).map((c) => (
            <button key={c.id} className="flex flex-col items-center gap-1 rounded-2xl bg-[var(--color-canvas)] p-2.5 text-center text-xs font-extrabold active:scale-95" onClick={() => setTo(c.id)}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#1aa6e6] font-display text-lg text-white">{c.name.replace(/^(Ton|Un) /, '')[0].toUpperCase()}</span>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {(sim.loan > 0 || sim.rentArrears > 0) && (
        <div className="rounded-[22px] bg-[#ffe8ec] p-4">
          <div className="flex items-center justify-between">
            <div className="label !text-[#a3122f]">
              <Receipt size={12} className="mr-1 inline" />
              {t('Payer sans frais')}
            </div>
            {sim.loan > 0 && <Chip tone="bad">{tx('−{0} Djai chaque samedi', { 0: amount(LOAN_INSTALLMENT) })}</Chip>}
          </div>
          {sim.loan > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button className="btn btn-soft !py-2 !text-sm" disabled={sim.money < installment} onClick={() => act('Rembourser le microcrédit', 'hand-coins', 'market', () => api.repay(sim.id, 'loan', installment))}>
                <HandCoins size={16} /> {tx('{0} Djai', { 0: amount(installment) })}
              </button>
              <button className="btn !py-2 !text-sm" disabled={sim.money < sim.loan} onClick={() => act('Solder le microcrédit', 'hand-coins', 'market', () => api.repay(sim.id, 'loan', sim.loan))}>
                {tx('Solder {0} Djai', { 0: amount(sim.loan) })}
              </button>
            </div>
          )}
          {sim.rentArrears > 0 && (
            <button className="btn mt-2 w-full !py-2 !text-sm" disabled={sim.money < sim.rentArrears} onClick={() => act('Payer le loyer en retard', 'house', 'market', () => api.repay(sim.id, 'rent', sim.rentArrears))}>
              {tx('Loyer en retard : {0} Djai', { 0: amount(sim.rentArrears) })}
            </button>
          )}
        </div>
      )}

      <div className="label">{t('Historique')}</div>
      {renderJournal(journal.filter((e) => e.money !== 0))}
    </div>
  )
}
