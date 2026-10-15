import { Link, useLocation } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Logo } from '../components/ui'

const UPDATED = '15 octobre 2026'

/** Conditions d'utilisation and the privacy note, linked from the wish-list checkboxes. */
export function Legal() {
  const privacy = useLocation().pathname === '/confidentialite'
  return (
    <div className="min-h-full bg-[var(--color-night)] text-white">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <Logo size={32} />
        <Link to="/liste" className="inline-flex items-center gap-1 text-sm font-extrabold text-white/80">
          <ChevronLeft size={18} strokeWidth={2.6} /> La liste
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <article className="card space-y-4 p-5 text-sm leading-relaxed font-semibold text-[var(--color-ink)] lg:p-8">
          <p className="text-xs font-extrabold tracking-wide text-[var(--color-ink-soft)] uppercase">Babi Life · {UPDATED}</p>
          {privacy ? <Privacy /> : <Terms />}
        </article>
      </main>
    </div>
  )
}

function Terms() {
  return (
    <>
      <h1 className="font-display text-3xl leading-tight font-extrabold">Conditions d'utilisation</h1>
      <p>Babi Life est un jeu en préparation, sur la vie à Abidjan et en Côte d'Ivoire. Il n'est pas encore ouvert. La liste d'attente sert à être prévenu·e le jour où il l'est, et à faire naître un Sim qui attendra ce jour-là.</p>
      <p>L'inscription est gratuite. Tu laisses un prénom et un contact qui est le tien : un e-mail ou un numéro WhatsApp. Une inscription par contact. La commune est facultative.</p>
      <p>Si tu crées un Sim, sa famille est tirée au sort, comme dans le jeu. Ce Sim est gardé pour l'ouverture. Le créer ne donne pas accès au jeu tant qu'il n'est pas ouvert.</p>
      <p>Tu peux demander à être retiré·e de la liste. On efface alors le prénom, le contact et le Sim gardé. La demande se fait depuis le contact que tu as laissé.</p>
      <p>On peut refuser ou retirer une inscription dont le contact est faux, ou qui sert à remplir la liste automatiquement.</p>
      <p>
        Le détail de ce qui est gardé est dans la <Link to="/confidentialite" className="underline">politique de confidentialité</Link>.
      </p>
    </>
  )
}

function Privacy() {
  return (
    <>
      <h1 className="font-display text-3xl leading-tight font-extrabold">Politique de confidentialité</h1>
      <p>Babi Life (lifeinbabi.com) garde uniquement ce qu'il faut pour te prévenir de l'ouverture, et pour retrouver ton Sim ce jour-là.</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>Ton prénom.</li>
        <li>Ton e-mail ou ton numéro WhatsApp.</li>
        <li>Ta commune, si tu la donnes, et si tu veux tester le jeu avant tout le monde.</li>
        <li>D'où vient l'inscription, quand le lien le dit (une affiche, une vidéo).</li>
        <li>Si tu crées un Sim : son nom, son apparence, ses traits, son rêve, la famille tirée au sort et la commune de naissance.</li>
        <li>Si tu continues avec Google : l'e-mail et le prénom de ce compte, pour remplir l'inscription.</li>
      </ul>
      <p>Ces informations ne sont pas vendues et ne servent pas à de la publicité. Elles ne sont pas montrées aux autres personnes inscrites.</p>
      <p>Elles sont gardées jusqu'à l'ouverture et le message qui te la dit, ou jusqu'à ce que tu demandes leur suppression, selon ce qui arrive en premier.</p>
      <p>
        L'inscription n'est enregistrée que si tu as coché les <Link to="/conditions" className="underline">conditions d'utilisation</Link> et cette politique.
      </p>
    </>
  )
}
