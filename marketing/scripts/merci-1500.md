# « Merci la famille » — 1 500 sur TikTok (vidéo de 36 s)

Awa parle à la communauté **depuis chez elle** (son salon : le canapé, la télé, le ventilateur, la photo de famille au mur), face caméra, mais avec **un nouveau look** : tresses longues, haut et jupe en kente vert émeraude, boucles d'oreilles, collier de perles, montre et sac en bandoulière (au lieu du foulard et du kaba orange). Ton : chaleureux, souriant, comme à des grands frères et petites sœurs du quartier. Débit posé : chaque ligne doit tenir dans son créneau (la colonne « Temps »). Pour la voix (ElevenLabs ou enregistrée au téléphone) : un seul fichier, `marketing/out/voix-merci.mp3`, puis `npm run video:merci` pour la vidéo avec le son.

| Temps | À l'image | Awa dit |
| --- | --- | --- |
| 0 – 5 s | Awa dans son salon, elle fait coucou | « La famille ! Bonjour bonjour, c'est Awa de Babi Life ! » |
| 5 – 12 s | Le compteur d'abonnés monte jusqu'à **1 500**, les confettis | « Vous savez quoi ? On est maintenant **mille cinq cents** sur TikTok ! Mille cinq cents ! » |
| 12 – 17 s | Awa, les cœurs qui montent | « Merci, merci, merci ! C'est vous qui nous portez. On est ensemble ! » |
| 17 – 23 s | Le maquis, le coupé-décalé | « Et votre week-end, c'était comment ? Maquis, coupé-décalé… » |
| 23 – 27 s | Le stade, la tribune qui chante | « … le match au stade… » |
| 27 – 32 s | Le concert, les mains en l'air | « … ou bien vous étiez couchés à la maison ? Dites-nous ça en commentaire ! » |
| 32 – 39 s | Lundi matin : le gbaka, l'apprenti qui crie | « Aujourd'hui, c'est lundi : on se lève, on se met au travail. Bon début de semaine à tous ! » |
| 39 – 46 s | Awa, à voix basse, un cadeau qui se cache | « Et restez bien connectés… de bonnes nouvelles arrivent très bientôt. Je ne dis rien ! » |
| 46 – 52 s | La fin : merci, le QR code | « Abonnez-vous, partagez avec vos amis. Babi Life, c'est pour nous. Bisous ! » |

## Le texte d'un seul tenant (pour la voix)

La famille ! Bonjour bonjour, c'est Awa de Babi Life !
Vous savez quoi ? On est maintenant mille cinq cents sur TikTok ! Mille cinq cents !
Merci, merci, merci ! C'est vous qui nous portez. On est ensemble !
Et votre week-end, c'était comment ? Maquis, coupé-décalé… le match au stade… ou bien vous étiez couchés à la maison ? Dites-nous ça en commentaire !
Aujourd'hui, c'est lundi : on se lève, on se met au travail. Bon début de semaine à tous !
Et restez bien connectés… de bonnes nouvelles arrivent très bientôt. Je ne dis rien !
Abonnez-vous, partagez avec vos amis. Babi Life, c'est pour nous. Bisous !

## La légende du post (TikTok, Instagram, statut)

1 500 sur TikTok 🎉🇨🇮 Merci la famille, c'est vous qui nous portez ❤️
Votre week-end, c'était comment ? Maquis, stade ou dodo ? Dites-nous en commentaire 👇
Bon début de semaine à tous… et restez connectés : de bonnes nouvelles arrivent 🤫

#BabiLife #Abidjan #CoteDIvoire #225 #Babi #jeuvideo #famille

## Si on la publie un autre jour

- Pas lundi : « Aujourd'hui, c'est lundi » devient « Cette semaine, on se donne à fond ».
- Le nombre change : remplacer les deux « mille cinq cents » du texte, et le compteur de la vidéo (`FOLLOWERS` dans `web/src/lab/poster.tsx`).

## Pour ElevenLabs

Une voix de femme jeune, chaleureuse, francophone d'Afrique de l'Ouest (dans la bibliothèque de voix : chercher « Ivorian », « West African French » ou « African French female »). « Babi Life » est écrit « Babi Laïf » pour que la voix le dise à l'anglaise. Les nombres sont en lettres.

### Modèle Eleven v3 (avec les émotions entre crochets)

Réglages : Stability « Natural », vitesse normale. Coller tel quel :

```
[excited] La famille ! Bonjour bonjour, c'est Awa de Babi Laïf !
[curious] Vous savez quoi ? [excited] On est maintenant mille cinq cents sur TikTok ! [laughs] Mille cinq cents !
[warmly] Merci, merci, merci ! C'est vous qui nous portez. On est ensemble !
[curious] Et votre week-end, c'était comment ? Maquis, coupé-décalé… le match au stade… [laughs] ou bien vous étiez couchés à la maison ? Dites-nous ça en commentaire !
[happy] Aujourd'hui, c'est lundi : on se lève, on se met au travail. Bon début de semaine à tous !
[whispers] Et restez bien connectés… de bonnes nouvelles arrivent très bientôt. [mischievously] Je ne dis rien !
[warmly] Abonnez-vous, partagez avec vos amis. Babi Laïf, c'est pour nous. Bisous !
```

### Modèle Multilingual v2 (avec les pauses chronométrées)

Réglages : Stability 45 %, Similarity 75 %, Style 30 %, Speaker boost activé, vitesse 0,95. Les pauses calent chaque phrase sur son moment de la vidéo :

```
La famille ! Bonjour bonjour, c'est Awa de Babi Laïf ! <break time="1.0s" />
Vous savez quoi ? On est maintenant mille cinq cents sur TikTok ! Mille cinq cents ! <break time="1.2s" />
Merci, merci, merci ! C'est vous qui nous portez. On est ensemble ! <break time="1.0s" />
Et votre week-end, c'était comment ? Maquis, coupé-décalé… <break time="0.8s" /> le match au stade… <break time="0.8s" /> ou bien vous étiez couchés à la maison ? Dites-nous ça en commentaire ! <break time="1.0s" />
Aujourd'hui, c'est lundi : on se lève, on se met au travail. Bon début de semaine à tous ! <break time="1.2s" />
Et restez bien connectés… de bonnes nouvelles arrivent très bientôt. Je ne dis rien ! <break time="1.0s" />
Abonnez-vous, partagez avec vos amis. Babi Laïf, c'est pour nous. Bisous !
```

### Après

Télécharger en MP3, le mettre dans `marketing/out/voix-merci.mp3`, puis `npm run video:merci` : la vidéo ressort avec la voix. Elle doit durer environ 50 secondes ; si elle est plus longue, monter la vitesse à 1,0 ou raccourcir les pauses ; plus courte, les allonger.

## La voix enregistrée

`out/voix-merci.mp3` : ElevenLabs, voix « Lea - UGC creator », 35 s. La vidéo est calée sur elle (`FILMS.merci` dans `web/src/lab/poster.tsx`) : le bonjour 0 – 3,7 s, les 1 500 3,7 – 8,5 s (le compteur arrive à 1 500 sur « Mille cinq cents ! »), le merci 8,5 – 13 s, le week-end 13 – 21,1 s (maquis, stade, concert), le lundi 21,1 – 26 s, les bonnes nouvelles 26 – 30,6 s, la fin 30,6 – 36,5 s. Avec une autre voix, recaler ces temps sur ses pauses.
