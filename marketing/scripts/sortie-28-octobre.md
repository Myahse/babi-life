# « Babi Life sort mercredi 28 octobre » — Awa annonce la date (vidéo de 36 s)

La suite de « Merci la famille » : Awa avait dit que de bonnes nouvelles arrivaient. Elle revient **chez elle, dans son salon**, avec le même look (tresses, haut et jupe en kente vert, ses bijoux), face caméra, comme en direct. Le cadeau qui bougeait la dernière fois s'ouvre : une page de calendrier en sort, **mercredi 28 octobre**, les confettis. Puis le jeu en quatre images, et l'appel à s'inscrire tout de suite. Ton : excité au moment de la date, chaleureux après, comme une grande sœur qui invite tout le quartier.

À l'écran en permanence : le cadre du direct (awa.babi, « Grande nouvelle »), les commentaires qui réagissent (« ENFIN 😭🔥 », « Je prends congé mercredi 😂 », « Tag ton gars 👇 »), les cœurs ; après l'annonce, la date reste épinglée en haut : « 📅 Mercredi 28 octobre ».

| Temps | À l'image | Awa dit |
| --- | --- | --- |
| 0 – 3,7 s | Awa dans son salon, elle fait coucou | « La famille ! Bonjour bonjour, c'est Awa de Babi Life ! » |
| 3,7 – 8,7 s | Le cadeau de la dernière fois revient et bouge : « Vous vous rappelez ? » | « Vous vous rappelez ? Je vous avais dit que de bonnes nouvelles arrivaient… » |
| 8,7 – 14,7 s | Le cadeau saute et s'ouvre : la page du calendrier, **MERCREDI 28 OCTOBRE**, « Babi Life sort ! », les confettis | « Eh ben voilà : Babi Life sort le mercredi vingt-huit octobre ! Mercredi vingt-huit ! » |
| 14,7 – 17,7 s | Une maison qui monte bloc par bloc | « Ton perso, ta famille, ta maison… » |
| 17,7 – 19,5 s | Le maquis, le coupé-décalé | « … le maquis, le coupé-décalé… » |
| 19,5 – 21,2 s | Le stade | « … le match au stade… » |
| 21,2 – 24,7 s | Le gbaka, la gare | « Tout Babi dans ton téléphone, et c'est gratuit ! » |
| 24,7 – 30,2 s | Awa dans son salon, la date en haut | « Inscris-toi sur la liste maintenant : mercredi, tu seras parmi les premiers à jouer ! » |
| 30,2 – 36,5 s | La fin : « Babi Life sort mercredi 28 octobre », le QR code de la liste | « Partage avec tes amis, ta famille, tout ton quartier. Mercredi vingt-huit, on se voit à Babi ! » |

## Le texte d'un seul tenant (pour la voix)

La famille ! Bonjour bonjour, c'est Awa de Babi Life !
Vous vous rappelez ? Je vous avais dit que de bonnes nouvelles arrivaient…
Eh ben voilà : Babi Life sort le mercredi vingt-huit octobre ! Mercredi vingt-huit !
Ton perso, ta famille, ta maison… le maquis, le coupé-décalé… le match au stade… Tout Babi dans ton téléphone, et c'est gratuit !
Inscris-toi sur la liste maintenant : mercredi, tu seras parmi les premiers à jouer !
Partage avec tes amis, ta famille, tout ton quartier. Mercredi vingt-huit, on se voit à Babi !

## La légende du post (TikTok, Instagram, statut)

C'EST OFFICIEL 🎉🇨🇮 Babi Life sort le **mercredi 28 octobre** !
Ton perso, ta famille, ta maison, le maquis, le stade… tout Babi dans ton téléphone. Gratuit.
Inscris-toi sur la liste (lien en bio) pour jouer parmi les premiers 👇
Tag ceux qui seront là mercredi !

#BabiLife #Abidjan #CoteDIvoire #225 #Babi #jeuvideo #28octobre

## Pour ElevenLabs

La même voix que « Merci la famille » et « On m'a arnaquée » : **« Lea - UGC creator »**, pour qu'on reconnaisse Awa. « Babi Life » est écrit « Babi Laïf » pour que la voix le dise à l'anglaise. Les nombres sont en lettres.

### Modèle Eleven v3 (avec les émotions entre crochets)

Réglages : Stability « Natural », vitesse normale. Coller tel quel :

```
[excited] La famille ! Bonjour bonjour, c'est Awa de Babi Laïf !
[mischievously] Vous vous rappelez ? Je vous avais dit que de bonnes nouvelles arrivaient…
[excited] Eh ben voilà : Babi Laïf sort le mercredi vingt-huit octobre ! [laughs] Mercredi vingt-huit !
[happy] Ton perso, ta famille, ta maison… le maquis, le coupé-décalé… le match au stade… Tout Babi dans ton téléphone, et c'est gratuit !
[warmly] Inscris-toi sur la liste maintenant : mercredi, tu seras parmi les premiers à jouer !
[warmly] Partage avec tes amis, ta famille, tout ton quartier. [excited] Mercredi vingt-huit, on se voit à Babi !
```

### Modèle Multilingual v2 (avec les pauses chronométrées)

Réglages : Stability 45 %, Similarity 75 %, Style 30 %, Speaker boost activé, vitesse 1,0. Les pauses calent chaque phrase sur son moment de la vidéo :

```
La famille ! Bonjour bonjour, c'est Awa de Babi Laïf ! <break time="0.5s" />
Vous vous rappelez ? Je vous avais dit que de bonnes nouvelles arrivaient… <break time="0.7s" />
Eh ben voilà : Babi Laïf sort le mercredi vingt-huit octobre ! Mercredi vingt-huit ! <break time="0.8s" />
Ton perso, ta famille, ta maison… <break time="0.3s" /> le maquis, le coupé-décalé… <break time="0.3s" /> le match au stade… <break time="0.3s" /> Tout Babi dans ton téléphone, et c'est gratuit ! <break time="0.7s" />
Inscris-toi sur la liste maintenant : mercredi, tu seras parmi les premiers à jouer ! <break time="0.7s" />
Partage avec tes amis, ta famille, tout ton quartier. Mercredi vingt-huit, on se voit à Babi !
```

### Après

Télécharger en MP3, le mettre dans `marketing/out/voix-sortie.mp3`, puis `npm run video:sortie` : la vidéo ressort avec la voix. Sans voix, elle sort muette, calée sur les temps du tableau. Si la voix dure plus ou moins de 36 s, recaler les temps des plans (`FILMS.sortie` dans `web/src/lab/poster.tsx`) sur ses phrases, ou l'envoyer à Claude pour qu'il le fasse.

## Si on la publie un autre jour

La date est à un seul endroit dans la vidéo : `SORTIE` dans `web/src/lab/poster.tsx` (le jour de la semaine, le jour, le mois), plus les phrases du texte ci-dessus.
