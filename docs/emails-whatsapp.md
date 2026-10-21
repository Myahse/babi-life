# E-mails (Brevo) et messages WhatsApp

## 1. Les e-mails avec Brevo

Le jeu envoie un e-mail quand quelqu'un a oublié son mot de passe. Le modèle est dans `backend/internal/mail/templates/layout.html` (couleurs du jeu, logo, gros bouton orange, le lien en clair en dessous, et une version texte pour les messageries sans HTML).

On passe par **l'API HTTP de Brevo**, pas par le SMTP : l'offre gratuite de Render bloque les ports SMTP (25, 465, 587).

### Étapes

1. Crée un compte sur brevo.com (le plan gratuit envoie 300 e-mails par jour).
2. **Senders, Domains & Dedicated IPs → Domains → Add a domain** : `lifeinbabi.com`. Brevo donne des enregistrements DNS (code Brevo, DKIM, DMARC) : ajoute-les chez ton hébergeur DNS, puis clique sur « Authenticate ». Sans ça, les e-mails finissent dans les spams.
3. **Senders → Add a sender** : `Babi Life`, `noreply@lifeinbabi.com`.
4. **SMTP & API → API Keys → Generate a new API key**. Copie la clé (elle commence par `xkeysib-`), elle ne s'affiche qu'une fois.
5. Sur Render, service `babi-life-api` → **Environment** :
   - `BREVO_API_KEY` = la clé
   - `MAIL_FROM` = `Babi Life <noreply@lifeinbabi.com>`
   - (laisse `SMTP_HOST`… vides)
6. Render redémarre le service. Dans les logs, le message « e-mail not set » ne doit plus apparaître.
7. Essaie : page de connexion → « Mot de passe oublié » avec ton adresse. Dans Brevo, **Transactional → Logs** montre chaque e-mail (étiquette `mot-de-passe`).

Si Brevo refuse (adresse d'expéditeur non vérifiée, clé fausse), le joueur voit « l'e-mail n'est pas parti » et la raison exacte est dans les logs Render (`auth: reset mail: brevo: …`).

## 2. WhatsApp (la liste d'attente)

L'envoi est déjà dans le jeu : **/admin → onglet WhatsApp**. Il passe par l'API officielle de WhatsApp (Meta Cloud API). Sans configuration, la page donne des liens wa.me pour envoyer à la main.

WhatsApp n'autorise une entreprise à écrire la première qu'avec un **modèle de message approuvé par Meta**. Le jeu remplit `{{1}}` avec le prénom de la personne, et ne réécrit jamais aux numéros qui ont dit stop.

### Étapes

1. Va sur developers.facebook.com → **My Apps → Create app** → type « Business », puis ajoute le produit **WhatsApp**. Ça crée un compte WhatsApp Business (WABA).
2. Ajoute **le numéro de l'entreprise** (WhatsApp → API Setup → Add phone number). Ce numéro ne doit pas déjà servir dans l'appli WhatsApp normale. Vérifie-le par SMS.
3. Dans business.facebook.com → **Paramètres de l'entreprise → Utilisateurs système**, crée un utilisateur système (Admin), donne-lui l'appli et le compte WhatsApp, puis **Générer un token** avec les droits `whatsapp_business_messaging` et `whatsapp_business_management`, sans expiration.
4. Ajoute un moyen de paiement dans le WhatsApp Manager : les messages « marketing » sont payants (quelques dizaines de francs CFA chacun en Côte d'Ivoire ; vérifie le tarif du moment chez Meta).
5. Sur Render :
   - `WHATSAPP_TOKEN` = le token de l'utilisateur système
   - `WHATSAPP_PHONE_ID` = « Phone number ID » (WhatsApp → API Setup), pas le numéro lui-même
6. Crée le modèle (WhatsApp Manager → **Modèles de message → Créer**), voir plus bas, et attends l'approbation (quelques minutes à 24 h).
7. Dans /admin → WhatsApp : nom du modèle, langue `fr`, **envoie d'abord un test à ton propre numéro**, puis à toute la liste ou aux testeurs seulement.

### Modèle prêt à soumettre : `ouverture_babi`

- **Catégorie** : Marketing
- **Langue** : Français (`fr`)
- **En-tête** (texte) : `Babi Life est ouvert 🎉`
- **Corps** :

  ```
  Bonjour {{1}} ! Tu t'étais inscrit·e pour savoir quand Babi Life ouvre : c'est maintenant 🌴

  Crée ton perso, choisis ta commune et vis ta vie à Abidjan : boulot, maquis, amis, sorties…

  On t'attend sur www.lifeinbabi.com
  ```

- **Exemple pour {{1}}** : `Awa`
- **Pied de page** : `Réponds STOP pour ne plus recevoir de messages`
- **Bouton** (Visiter le site) : `Jouer maintenant` → `https://www.lifeinbabi.com`

Une variante pour les testeurs, `test_babi` (catégorie Marketing) :

```
Bonjour {{1}} ! Tu as dit vouloir tester Babi Life avant tout le monde. La version test est prête : on t'envoie ton accès très vite. Merci de jouer le jeu 🙏
```

Quand quelqu'un répond STOP, ajoute son numéro dans /admin → WhatsApp, case « Quelqu'un a répondu STOP ? » : il ne recevra plus rien.
