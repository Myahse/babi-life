import { useState } from 'react'
import { Check, Copy, Gift, MessageCircle, Share2, UserCheck, UserRound } from 'lucide-react'
import type { Parrainage } from '../lib/api'
import type { ActionResult, Sim, World } from '../lib/types'
import { inviteLink } from '../lib/parrain'
import { share } from '../lib/native'
import { GiftList } from './GiftDrawer'
import { t, tx } from '../lib/i18n'

// The phone's « Inviter » app (backend sims/parrainage.go, update « parrainage »):
// the player's own link to send (WhatsApp first, that's where Babi talks; or
// copied), the friends come by it, and their gifts, the same list as the
// drawer at home: opened from here too (a child at its parents', a hotel).

export function InviteApp({ world, sim, view, onResult, onOpened }: { world: World; sim: Sim; view: Parrainage | null; onResult: (r: ActionResult) => void; onOpened: () => void }) {
  const [copied, setCopied] = useState(false)
  if (!view) return <p className="p-2 text-sm font-bold text-[var(--color-ink-soft)]">…</p>
  const link = inviteLink(view.code)
  const text = t('Viens vivre Abidjan avec moi sur Babi Life : crée ton perso, trouve un boulot, construis ta maison. Inscris-toi avec mon lien, ça me fait un cadeau : {link}', { link })
  const copy = () =>
    void navigator.clipboard?.writeText(link).then(
      () => (setCopied(true), setTimeout(() => setCopied(false), 2500)),
      () => undefined,
    )
  const wrapped = view.gifts.filter((g) => !g.opened).length
  return (
    <div className="space-y-4">
      <div className="rounded-[22px] bg-[linear-gradient(150deg,#ff9a3d,#e8590c)] p-4 text-white">
        <div className="flex items-center gap-2 text-[13px] font-extrabold text-white/85">
          <Gift size={16} strokeWidth={2.6} /> {t('Ton lien à toi')}
        </div>
        <p className="mt-1 font-display text-[19px] leading-tight font-extrabold">{t('Invite tes amis, reçois des cadeaux')}</p>
        <p className="mt-1 text-[12.5px] leading-snug font-bold text-white/90">{tx("Chaque ami qui s'inscrit avec ton lien et joue un peu ({played} min) te laisse un cadeau emballé dans ton tiroir : un habit, un meuble de déco, de quoi remplir le frigo, des Djai… et parfois une vraie surprise.", { played: view.played })}</p>
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/95 p-1.5 pl-3 text-[var(--color-ink)]">
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold select-all">{link.replace(/^https?:\/\//, '')}</span>
          <button className="btn shrink-0 !bg-[var(--color-canvas)] !px-3 !py-1.5 !text-xs !text-[var(--color-ink)]" onClick={copy}>
            {copied ? <Check size={15} strokeWidth={2.8} /> : <Copy size={15} strokeWidth={2.6} />} {copied ? t('Copié') : t('Copier')}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <a className="btn btn-emerald !py-2.5" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
          <MessageCircle size={18} strokeWidth={2.6} /> {t('Envoyer sur WhatsApp')}
        </a>
        <button className="btn !bg-[var(--color-canvas)] !px-3.5 !py-2.5 !text-[var(--color-ink)]" onClick={() => void share(text).then((ok) => ok || copy(), () => undefined)} aria-label={t('Partager autrement')}>
          <Share2 size={18} strokeWidth={2.6} />
        </button>
      </div>

      <section>
        <h4 className="label mb-2">{t('Tes cadeaux')}{wrapped ? t(' · {wrapped} à ouvrir', { wrapped }) : ''}</h4>
        <GiftList world={world} sim={sim} gifts={view.gifts} onResult={onResult} onOpened={onOpened} />
      </section>

      <section>
        <h4 className="label mb-2">{t('Venus avec ton lien')}{view.friends.length ? ` · ${view.friends.length}` : ''}</h4>
        {view.friends.length ? (
          <ul className="grid gap-1.5">
            {view.friends.map((f, i) => (
              <li key={i} className="flex items-center gap-2.5 rounded-2xl bg-[var(--color-canvas)] p-2.5">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${f.gifted ? 'bg-[#d3f9d8] text-[#2b8a3e]' : 'bg-white text-[var(--color-ink-soft)]'}`}>{f.gifted ? <UserCheck size={18} /> : <UserRound size={18} />}</span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[14px] font-extrabold">{f.name}</span>
                  <span className="block truncate text-[11.5px] font-bold text-[var(--color-ink-soft)]">{f.gifted ? t('A rejoint Babi Life : cadeau gagné') : t('Inscrit·e : son cadeau arrive quand il ou elle aura un peu joué')}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-[var(--color-canvas)] p-3 text-[13px] leading-snug font-bold text-[var(--color-ink-soft)]">{t("Personne encore. Envoie ton lien dans tes groupes WhatsApp : les amis qui s'inscrivent avec apparaissent ici.")}</p>
        )}
        <p className="mt-2 text-[11.5px] leading-snug font-bold text-[var(--color-ink-soft)]">{tx('Un cadeau par ami, {perDay} par jour au plus (les autres attendent le lendemain). Les comptes de test ne comptent pas.', { perDay: view.perDay })}</p>
      </section>
    </div>
  )
}
