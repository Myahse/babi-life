import { Link, useLocation } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Logo } from '../components/ui'
import { CONTACT } from '../lib/contact'
import { t } from '../lib/i18n'

const UPDATED = t('30 octobre 2026')

/** Conditions d'utilisation and the privacy policy, linked from the sign-up, the wish list and the footers. */
export function Legal() {
  const privacy = useLocation().pathname === '/confidentialite'
  return <LegalFrame>{privacy ? <Privacy /> : <Terms />}</LegalFrame>
}

/** The frame of the site's legal pages (these two, and /suppression-compte): the logo, the back link, the card, the links between them. */
export function LegalFrame({ children, updated = UPDATED }: { children: React.ReactNode; updated?: string }) {
  return (
    <div className="min-h-full bg-[var(--color-night)] text-white">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <Logo size={32} />
        <Link to="/liste" className="inline-flex items-center gap-1 text-sm font-extrabold text-white/80">
          <ChevronLeft size={18} strokeWidth={2.6} /> {t('La liste')}
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <article className="card space-y-4 p-5 text-sm leading-relaxed font-semibold text-[var(--color-ink)] lg:p-8">
          <p className="text-xs font-extrabold tracking-wide text-[var(--color-ink-soft)] uppercase">{t('Babi Life ·')} {updated}</p>
          {children}
        </article>
        <nav className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm font-extrabold text-white/80">
          <Link to="/conditions" className="underline">
            {t('Conditions')}
          </Link>
          <Link to="/confidentialite" className="underline">
            {t('Confidentialité')}
          </Link>
          <Link to="/suppression-compte" className="underline">
            {t('Supprimer son compte')}
          </Link>
        </nav>
      </main>
    </div>
  )
}

/** The e-mail to write to (lib/contact.ts), or, until it's set, a placeholder that can't be missed. */
export function ContactEmail() {
  if (CONTACT.email)
    return (
      <a href={`mailto:${CONTACT.email}`} className="font-extrabold underline">
        {CONTACT.email}
      </a>
    )
  return <mark className="rounded bg-[#ffe066] px-1 font-extrabold text-[var(--color-ink)]">{t('[ADRESSE E-MAIL DE CONTACT À COMPLÉTER]')}</mark>
}

function Terms() {
  return (
    <>
      <h1 className="font-display text-3xl leading-tight font-extrabold">{t("Conditions d'utilisation")}</h1>
      <p>{t("Babi Life est un jeu en préparation, sur la vie à Abidjan et en Côte d'Ivoire. Il n'est pas encore ouvert. La liste d'attente sert à être prévenu·e le jour où il l'est, et à faire naître un perso qui attendra ce jour-là.")}</p>
      <p>{t("L'inscription est gratuite. Tu laisses un prénom et un contact qui est le tien : un e-mail ou un numéro WhatsApp. Une inscription par contact. La commune est facultative.")}</p>
      <p>{t("Si tu crées un perso, sa famille est tirée au sort, comme dans le jeu. Ce perso est gardé pour l'ouverture. Le créer ne donne pas accès au jeu tant qu'il n'est pas ouvert.")}</p>
      <p>{t('Tu peux demander à être retiré·e de la liste. On efface alors le prénom, le contact et le perso gardé. La demande se fait depuis le contact que tu as laissé.')}</p>
      <p>{t('On peut refuser ou retirer une inscription dont le contact est faux, ou qui sert à remplir la liste automatiquement.')}</p>
      <p>
        {t('Le détail de ce qui est gardé est dans la')} <Link to="/confidentialite" className="underline">{t('politique de confidentialité')}</Link>.
      </p>
    </>
  )
}

const H2 = ({ children }: { children: React.ReactNode }) => <h2 className="font-display pt-3 text-xl leading-tight font-extrabold">{children}</h2>
const List = ({ children }: { children: React.ReactNode }) => <ul className="list-disc space-y-2 pl-5">{children}</ul>

function Privacy() {
  return (
    <>
      <h1 className="font-display text-3xl leading-tight font-extrabold">{t('Politique de confidentialité')}</h1>
      <p>{t("Babi Life (lifeinbabi.com, et l'appli Android) est un jeu de simulation de vie en Côte d'Ivoire. Cette page dit, simplement, ce que le jeu garde sur toi, pourquoi, chez qui, combien de temps, et comment tout effacer.")}</p>
      <p>{t("On applique la loi ivoirienne n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel. L'autorité qui la fait respecter est l'ARTCI (Autorité de Régulation des Télécommunications/TIC de Côte d'Ivoire).")}</p>
      <p>{t("En bref : on ne vend pas tes données, on ne fait pas de publicité ciblée, il n'y a pas d'outil de pistage ou de mesure d'audience dans le jeu.")}</p>

      <H2>{t('Ton compte')}</H2>
      <List>
        <li>{t("Avec un e-mail : ton prénom, ton nom, ton pseudo, ton e-mail et ton mot de passe (gardé chiffré : personne ne peut le lire, pas même nous).")}</li>
        <li>{t("Avec Google : l'identifiant de ton compte Google, ton e-mail, ton nom et l'adresse de ta photo de profil Google, puis le pseudo que tu choisis. La connexion passe par Google (Google Sign-In, Firebase Authentication) : on ne voit jamais ton mot de passe Google.")}</li>
        <li>{t('Si tu as déclaré avoir 18 ans ou plus (demandé avant la romance dans le jeu) : seulement le fait que tu l’as déclaré, et quand.')}</li>
        <li>{t('La langue choisie (français ou anglais), et, si tu es venu·e par le lien d’un ami, qui t’a invité·e (pour les cadeaux du parrainage).')}</li>
        <li>{t('Tes appareils connectés : un nom simple tiré du navigateur (« Android · Chrome »), et la date de la dernière utilisation, pour que tu puisses les déconnecter depuis ton profil.')}</li>
      </List>

      <H2>{t('Ce que tu fais dans le jeu')}</H2>
      <List>
        <li>{t('Ton perso : son nom, son apparence, ses traits, sa famille tirée au sort, sa commune, son argent, sa maison, son travail, sa progression et son journal.')}</li>
        <li>{t('Tes amis et ton couple dans le jeu, tes messages Gbairai avec les autres joueurs, tes posts, stories, photos, vidéos et commentaires (Tikitoko, Babigram, Flashe), tes parties, tes paris en Djai, ta vie politique dans le jeu, les idées que tu nous envoies et les signalements que tu fais.')}</li>
        <li>{t('Les photos et vidéos du jeu sont des images de la scène 3D : le jeu n’utilise ni la caméra ni le micro de ton téléphone. Quand c’est ouvert, une story peut aussi être une photo de ta galerie que tu choisis toi-même : seuls tes amis du jeu la voient, pendant 24 heures.')}</li>
        <li>{t("Ce que les autres voient : ton pseudo, ton perso et ce que tu publies. Ton e-mail et ton vrai nom ne sont jamais montrés aux autres joueurs.")}</li>
      </List>

      <H2>{t('Parler aux personnages du jeu')}</H2>
      <p>{t("Quand tu écris librement à un personnage du jeu (un passant, tes parents dans Gbairai), ton message est envoyé à un service d'intelligence artificielle qui écrit sa réponse : Groq ou Anthropic (Claude), selon la configuration du serveur. On envoie seulement ce qu'il faut pour répondre : le prénom, le genre et la commune de ton perso, l'heure du jeu, le personnage, et la conversation en cours. Jamais ton e-mail ni ton nom de compte. N'y écris pas d'informations personnelles.")}</p>

      <H2>{t('Ta position')}</H2>
      <p>{t("À la naissance de ton perso, et seulement là, le jeu peut demander ta position pour le faire naître dans la commune la plus proche de toi. Elle sert une seule fois, sur le moment : seule la commune est gardée, jamais ta position. Tu peux refuser et choisir une commune toi-même.")}</p>

      <H2>{t('Les notifications')}</H2>
      <p>{t("Si tu acceptes les notifications, on garde l'adresse technique que ton téléphone ou ton navigateur nous donne pour t'en envoyer : un jeton Firebase Cloud Messaging (Google) dans l'appli Android, ou un abonnement « web push » dans le navigateur (transmis par le service de ton navigateur : Google, Mozilla, Apple…). Tu peux les couper à tout moment dans les réglages de ton téléphone.")}</p>

      <H2>{t('Les achats')}</H2>
      <List>
        <li>{t("Sur le site : le paiement passe par GeniusPay (Mobile Money, carte). On lui transmet ton nom et ton e-mail pour le reçu. Tes numéros de carte ou de Mobile Money vont chez GeniusPay, jamais chez nous : on garde seulement ce que tu as acheté, le prix, la référence du paiement et son état.")}</li>
        <li>{t("Dans l'appli Android : le paiement passe par Google Play. On reçoit de Google le jeton et le numéro de commande de l'achat, pour vérifier qu'il est payé et te donner ce que tu as acheté. Tes moyens de paiement restent chez Google.")}</li>
      </List>

      <H2>{t('Les e-mails')}</H2>
      <p>{t("On t'écrit pour « mot de passe oublié » et, parfois, pour des nouvelles du jeu. Ces e-mails partent par Brevo. Chaque e-mail de nouvelles a un lien « ne plus recevoir » : ton adresse est alors gardée sur une liste à ne plus jamais écrire.")}</p>

      <H2>{t('La pub dans le jeu')}</H2>
      <p>{t("Les panneaux de pub (Babi Pub) montrent les mêmes affiches à tout le monde dans une commune. On compte seulement combien de fois chaque affiche a été vue, par commune et par jour, sans savoir qui l'a vue. Aucune publicité ciblée, aucun outil publicitaire ou de mesure d'audience (pas de Google Analytics, pas de pixel Facebook) dans le jeu.")}</p>

      <H2>{t('Sur ton appareil')}</H2>
      <p>{t("Le jeu garde dans ton navigateur ou l'appli ta connexion, tes réglages et une copie de ton perso pour jouer sans réseau. Ce ne sont pas des cookies publicitaires. Ce qui concerne ton compte est effacé de l'appareil quand tu te déconnectes.")}</p>

      <H2>{t('Où sont tes données')}</H2>
      <p>{t("Chez des hébergeurs, qui les gardent pour nous et ne s'en servent pas : le site chez Vercel, le serveur du jeu chez Render, la base de données chez Neon (PostgreSQL), les photos, vidéos et affiches chez un service de stockage de fichiers (compatible S3, comme Cloudflare R2). La carte du jeu est affichée avec Mapbox : ton appareil charge les images de la carte chez eux, sans ta position. Ces serveurs peuvent être hors de Côte d'Ivoire (en Europe ou aux États-Unis).")}</p>

      <H2>{t('Combien de temps')}</H2>
      <List>
        <li>{t("Ton compte et ton perso : tant que ton compte existe. Quand tu le supprimes, tout est effacé tout de suite de la base du jeu (les copies de secours de l'hébergeur s'effacent d'elles-mêmes en quelques jours).")}</li>
        <li>{t('Tes messages Gbairai et du grin : les messages que tu as envoyés restent chez les personnes qui les ont reçus, signés « Compte supprimé », sans ton nom, ta photo ni ton perso (un ticket ou un défi partagé est retiré). Ceux du grin s’effacent au bout d’une semaine.')}</li>
        <li>{t("Les achats : le paiement (montant, date, référence) est gardé sans ton nom le temps exigé par les règles comptables (jusqu'à 10 ans). Les achats ne sont pas remboursés quand tu supprimes ton compte.")}</li>
        <li>{t('Les liens « mot de passe oublié » ne marchent que peu de temps ; la liste de tes appareils montre ceux du dernier mois.')}</li>
        <li>{t("Une demande de suppression faite sur le site : gardée jusqu'à ce qu'on la traite.")}</li>
      </List>

      <H2>{t('Tes droits')}</H2>
      <p>{t("Tu peux demander à voir ce qu'on garde sur toi, le faire corriger, t'opposer aux e-mails de nouvelles, et tout faire effacer. Pour effacer ton compte et tout ce qui va avec, deux façons :")}</p>
      <List>
        <li>{t('dans le jeu : le téléphone › « Réglages » › « Supprimer mon compte » ;')}</li>
        <li>
          {t('sans pouvoir te connecter : la page')} <Link to="/suppression-compte" className="underline">{t('Supprimer son compte')}</Link>.
        </li>
      </List>
      <p>
        {t('Pour toute autre demande, ou une question sur tes données, écris-nous :')} <ContactEmail />. {t("On répond dans le mois. Si ça ne te convient pas, tu peux t'adresser à l'ARTCI.")}
      </p>

      <H2>{t("La liste d'attente")}</H2>
      <p>{t("Babi Life (lifeinbabi.com) garde uniquement ce qu'il faut pour te prévenir de l'ouverture, et pour retrouver ton perso ce jour-là.")}</p>
      <List>
        <li>{t('Ton prénom.')}</li>
        <li>{t('Ton e-mail ou ton numéro WhatsApp.')}</li>
        <li>{t('Ta commune, si tu la donnes, et si tu veux tester le jeu avant tout le monde.')}</li>
        <li>{t("D'où vient l'inscription, quand le lien le dit (une affiche, une vidéo).")}</li>
        <li>{t('Si tu crées un perso : son nom, son apparence, ses traits, son rêve, la famille tirée au sort et la commune de naissance.')}</li>
        <li>{t("Si tu continues avec Google : l'e-mail et le prénom de ce compte, pour remplir l'inscription.")}</li>
      </List>
      <p>{t("Les messages aux numéros WhatsApp de la liste partent par WhatsApp Business (Meta). Ces informations ne sont pas vendues et ne servent pas à de la publicité. Elles ne sont pas montrées aux autres personnes inscrites.")}</p>
      <p>{t("Elles sont gardées jusqu'à l'ouverture et le message qui te la dit, ou jusqu'à ce que tu demandes leur suppression, selon ce qui arrive en premier.")}</p>
      <p>
        {t("L'inscription n'est enregistrée que si tu as coché les")} <Link to="/conditions" className="underline">{t("conditions d'utilisation")}</Link> {t('et cette politique.')}
      </p>

      <H2>{t('Les changements')}</H2>
      <p>{t('Si cette politique change, la date en haut de la page change aussi ; un changement important est annoncé dans le jeu.')}</p>
    </>
  )
}
