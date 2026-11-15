import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Logo } from '../components/ui'
import { CONTACT } from '../lib/contact'
import { t } from '../lib/i18n'

const UPDATED = t('30 octobre 2026')
// The terms were written again for the open game (they still spoke of the wish list).
const TERMS_UPDATED = t('15 novembre 2026')

/** Conditions d'utilisation and the privacy policy, linked from the sign-up and the footers. */
export function Legal() {
  const privacy = useLocation().pathname === '/confidentialite'
  // The tab's title follows the page (it kept the last page's: « Babi Pub », « Supprimer son compte »).
  useEffect(() => void (document.title = privacy ? t('Politique de confidentialité · Babi Life') : t("Conditions d'utilisation · Babi Life")), [privacy])
  return <LegalFrame updated={privacy ? UPDATED : TERMS_UPDATED}>{privacy ? <Privacy /> : <Terms />}</LegalFrame>
}

/** The frame of the site's legal pages (these two, and /suppression-compte): the logo, the back link, the card, the links between them. */
export function LegalFrame({ children, updated = UPDATED }: { children: React.ReactNode; updated?: string }) {
  return (
    <div className="min-h-full bg-[var(--color-night)] text-white">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-5 pt-[max(1rem,var(--sat,env(safe-area-inset-top)))]">
        <Logo size={32} />
        <Link to="/" className="inline-flex items-center gap-1 text-sm font-extrabold text-white/80">
          <ChevronLeft size={18} strokeWidth={2.6} /> {t('Le jeu')}
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-8 pb-[max(2rem,var(--sab,env(safe-area-inset-bottom)))]">
        <article className="card space-y-4 p-5 text-sm leading-relaxed font-semibold text-[var(--color-ink)] lg:p-8">
          <p className="text-xs font-extrabold tracking-wide text-[var(--color-ink-soft)] uppercase">{t('Babi Life ·')} {updated}</p>
          {children}
        </article>
        <nav className="mt-5 flex flex-wrap justify-center gap-x-5 text-sm font-extrabold text-white/80">
          <Link to="/conditions" className="inline-flex min-h-11 items-center underline">
            {t('Conditions')}
          </Link>
          <Link to="/confidentialite" className="inline-flex min-h-11 items-center underline">
            {t('Confidentialité')}
          </Link>
          <Link to="/suppression-compte" className="inline-flex min-h-11 items-center underline">
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
      <p>{t("Babi Life (lifeinbabi.com, et l'appli Android) est un jeu gratuit de simulation de vie à Abidjan et en Côte d'Ivoire. En créant un compte ou en jouant, tu acceptes ces conditions. Ce qu'on garde sur toi est expliqué dans la")} <Link to="/confidentialite" className="underline">{t('politique de confidentialité')}</Link>.</p>

      <H2>{t('Ton compte')}</H2>
      <List>
        <li>{t("Tu crées ton compte avec un e-mail et un mot de passe, ou avec Google. Les informations que tu donnes (prénom, nom, e-mail) doivent être les tiennes.")}</li>
        <li>{t("Un compte, c'est une personne. Garde ton mot de passe pour toi : ce qui est fait avec ton compte est sous ta responsabilité. Si tu penses que quelqu'un l'utilise, change ton mot de passe ou écris-nous.")}</li>
        <li>{t("Ton pseudo est vu par tous les joueurs. Il ne doit pas être injurieux, ni se faire passer pour quelqu'un d'autre ou pour l'équipe du jeu (les pseudos comme « admin », « support » ou « babilife » sont réservés).")}</li>
        <li>{t("Si tu as moins de 18 ans, joue avec l'accord de tes parents ou de la personne qui s'occupe de toi. La romance du jeu et les achats sont réservés à ceux qui déclarent avoir 18 ans ou plus.")}</li>
      </List>

      <H2>{t('Ce que tu publies, et comment on se comporte')}</H2>
      <p>{t("Dans le jeu, tu peux écrire à d'autres joueurs (Gbairai, le grin) et publier des posts, stories, photos, vidéos et commentaires (Tikitoko, Babigram, Flashe). Ce que tu publies reste à toi ; tu nous permets seulement de le montrer dans le jeu, aux joueurs à qui tu le destines, tant que tu ne le retires pas.")}</p>
      <p>{t('Sont interdits :')}</p>
      <List>
        <li>{t("le harcèlement, les menaces, les insultes, les propos haineux (sur l'origine, l'ethnie, la religion, le genre…) ;")}</li>
        <li>{t('les contenus sexuels ou violents, et tout ce qui met en danger un mineur ;')}</li>
        <li>{t("les arnaques, la vente ou l'achat de Djai ou de comptes contre de l'argent réel, et la publicité non autorisée ;")}</li>
        <li>{t("publier les informations personnelles de quelqu'un (numéro, adresse, photos) sans son accord ;")}</li>
        <li>{t("tricher : programmes ou robots qui jouent à ta place, failles du jeu exploitées exprès, plusieurs comptes pour gonfler tes gains ou tes parrainages ;")}</li>
        <li>{t("se faire passer pour un autre joueur ou pour l'équipe de Babi Life.")}</li>
      </List>
      <p>{t("Tu peux signaler un joueur ou un contenu dans le jeu. Pour protéger les joueurs, l'équipe peut lire les messages Gbairai (voir la politique de confidentialité). On peut retirer un contenu qui ne respecte pas ces règles, retirer ce qui a été gagné en trichant, et fermer le compte de quelqu'un qui les enfreint gravement ou plusieurs fois.")}</p>
      <p>{t("Les personnages du jeu à qui tu écris librement répondent avec une intelligence artificielle : leurs réponses sont inventées, elles peuvent se tromper, et ce ne sont pas des conseils. N'y écris pas d'informations personnelles.")}</p>

      <H2>{t("Les Djai, l'argent du jeu")}</H2>
      <p>{t("Les Djai se gagnent en jouant (le boulot, les petits boulots, les défis…) et se dépensent dans le jeu. Ils n'ont aucune valeur en dehors du jeu : ils ne se changent pas en argent réel, ne se revendent pas et ne se remboursent pas. Ce que ton perso possède (Djai, objets, maison) reste lié à ton compte. On peut ajuster l'économie du jeu (les prix, les gains) pour qu'elle reste juste pour tout le monde.")}</p>

      <H2>{t('La boutique et les dons')}</H2>
      <List>
        <li>{t("Le jeu se joue gratuitement du début à la fin. La boutique permet, si tu le veux, d'acheter avec de l'argent réel des Djai, le Babi Pass (30 jours), « Plein d'énergie » ou le Pack Prestige. Les prix sont affichés en francs CFA avant de payer. Les achats sont réservés aux comptes qui ont déclaré avoir 18 ans ou plus.")}</li>
        <li>{t("Sur le site, le paiement se fait sur la page sécurisée de GeniusPay (Wave, Orange Money, MTN, Moov, carte) ou de Stripe (carte bancaire). Dans l'appli Android, il passe par Google Play. Ce que tu achètes t'est donné dès que le service de paiement nous confirme que c'est payé.")}</li>
        <li>{t("Ce que tu achètes est un contenu numérique livré tout de suite dans le jeu : il n'est ni repris, ni échangé, ni remboursé, sauf quand la loi l'impose ou si le paiement a été pris sans que rien ne te soit donné. Dans l'appli, les remboursements suivent aussi les règles de Google Play. Supprimer ton compte ne rembourse pas les achats.")}</li>
        <li>{t("Les dons (la page « Faire un don ») soutiennent le jeu : ils ne donnent rien dans le jeu, et ne sont pas remboursés, sauf quand la loi l'impose.")}</li>
        <li>{t("Un problème avec un paiement ? Écris-nous avec la date, le montant et la référence du paiement : on regarde avec le service de paiement.")}</li>
      </List>

      <H2>{t('La pub dans le jeu (Babi Pub)')}</H2>
      <p>{t("Les panneaux de la ville montrent les affiches et vidéos d'annonceurs, les mêmes pour tous les joueurs d'une commune. Un annonceur nous contacte, on s'entend sur le prix, les communes et les dates, puis il envoie son affiche avec le lien qu'on lui donne. On vérifie chaque pub avant qu'elle passe : on refuse ce qui est illégal, trompeur, choquant ou contraire à ces règles. L'annonceur est responsable de ce que sa pub montre et doit en avoir les droits. Une campagne payée et diffusée n'est pas remboursée, sauf si elle n'a pas pu passer de notre fait.")}</p>

      <H2>{t('Le jeu')}</H2>
      <p>{t("Babi Life change souvent : on ajoute, modifie ou retire des lieux, des activités et des règles. Le jeu peut aussi être interrompu un moment (une mise à jour, une panne, le serveur qui se réveille). On fait de notre mieux pour qu'il marche bien et que ta progression soit gardée, sans pouvoir le promettre à chaque instant. Les noms des marques du jeu (Waye, Gbairai, Tikitoko…) sont inventés ; les vrais lieux et la vraie actu sont là pour faire vivre le pays.")}</p>

      <H2>{t('Supprimer ton compte')}</H2>
      <p>
        {t('Tu peux supprimer ton compte quand tu veux : dans le jeu, le téléphone › « Réglages » › « Supprimer mon compte », ou, sans pouvoir te connecter, la page')} <Link to="/suppression-compte" className="underline">{t('Supprimer son compte')}</Link>. {t("Ton perso et ce que tu as dans le jeu sont alors effacés pour de bon. Ce qui est gardé, et combien de temps, est dans la politique de confidentialité.")}
      </p>

      <H2>{t('Les changements')}</H2>
      <p>{t("Si ces conditions changent, la date en haut de la page change aussi ; un changement important est annoncé dans le jeu. Continuer à jouer après, c'est accepter les nouvelles conditions. Elles sont soumises au droit ivoirien.")}</p>

      <H2>{t('Nous écrire')}</H2>
      <p>
        {t('Une question, un problème avec ton compte, un paiement ou un joueur :')} <ContactEmail />.
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
        <li>{t('Ton temps de jeu : le jeu compte le temps passé dans la partie, pour ton profil et pour nos statistiques.')}</li>
        <li>{t('Les photos et vidéos du jeu sont des images de la scène 3D : le jeu n’utilise ni la caméra ni le micro de ton téléphone. Quand c’est ouvert, une story peut aussi être une photo de ta galerie que tu choisis toi-même : seuls tes amis du jeu la voient, pendant 24 heures.')}</li>
        <li>{t("Ce que les autres voient : ton pseudo, ton perso et ce que tu publies. Ton e-mail et ton vrai nom ne sont jamais montrés aux autres joueurs.")}</li>
      </List>

      <H2>{t('La sécurité dans Gbairai')}</H2>
      <p>{t("Pour protéger les joueurs, les plus jeunes surtout, l'équipe de Babi Life peut lire les messages Gbairai échangés entre joueurs, depuis son espace d'administration : pour traiter un signalement, ou vérifier qu'il n'y a ni harcèlement, ni arnaque, ni contenu dangereux. Chaque lecture est notée dans le journal de l'équipe. Ces messages ne sont jamais montrés à d'autres joueurs ni utilisés pour de la publicité.")}</p>

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
