# « Abidjan… dans un jeu ?! » — la bande-annonce de tout Babi (vidéo de 53 s)

Awa fait visiter **tout ce qu'on peut faire dans Babi Life**, à toute vitesse : l'avion qui arrive, le Plateau et la Tour F, la cathédrale et la messe, le basket, le foot au stade, le thé au grin, les dames, le 8 américain, le maquis, le concert, le gbaka, la maison, le téléphone, le voyage. Une image par phrase, des coupes sèches sur le beat, les mots clés frappés en gros à l'écran, ses mots en sous-titres (le mot dit en jaune), son visage dans une bulle en bas à gauche. Ton : **surexcitée, fière, qui fait visiter sa ville à des amis**, avec du rire. Débit rapide mais clair : chaque phrase doit tenir dans son créneau (colonne « Temps »).

Pour la voix (ElevenLabs ou enregistrée au téléphone) : un seul fichier, `marketing/out/voix-tout.mp3`, puis `npm run video:tout` : la vidéo ressort avec la voix par-dessus le beat (`out/son-tout.mp3`, fait par `beat.py`).

| Temps | À l'image | Awa dit |
| --- | --- | --- |
| 0 – 2,8 s | Un avion passe devant Abidjan au coucher du soleil, la Tour F plus haute que tout. **ABIDJAN… DANS UN JEU ?!** | « Attends… Abidjan… dans un jeu ?! » |
| 2,8 – 5,6 s | ✈️ L'avion se pose à l'aéroport Félix-Houphouët-Boigny | « Bienvenue à Babi ! Moi c'est Awa, suis-moi ! » |
| 5,6 – 8,8 s | 🏙️ Le drone monte le long de la Tour F en chantier jusqu'aux grues, puis recule | « Le Plateau, les tours… même la Tour F en chantier ! » |
| 8,8 – 10,6 s | ⛪ La cathédrale Saint-Paul, son toit en tente, la lagune derrière | « La cathédrale… » |
| 10,6 – 12,6 s | 🙏🏾 La nef pleine, la messe | « … et la messe du dimanche. » |
| 12,6 – 15,2 s | 🏀 Le basket au Palais des Sports | « Le basket au Palais des Sports… » |
| 15,2 – 18 s | ⚽ Le stade plein, **BUUUT !**, la foule qui rugit | « … le foot au stade : BUUUT ! » |
| 18 – 21 s | 🍵 Le grin : le thé qu'on verse de haut | « Le thé au grin : on refait le monde. » |
| 21 – 24,4 s | ⚪⚫ Le damier : un pion en prend trois d'un coup, **RAFLE ! + 5 000 F** | « Les dames : tu mises… et tu rafles tout ! » |
| 24,4 – 28,4 s | 🃏 La table de 8 américain : un joker sur Awa, **+6 ! PIOCHE !**, ses six cartes, puis son 8 : **♥ CŒUR !** | « Et le 8 américain ! Joker… tu pioches six ! » (elle rit) |
| 28,4 – 31,2 s | 💸 Le maquis la nuit, on travaille les billets | « Le soir, maquis : on travaille les billets ! » |
| 31,2 – 33,6 s | 🎤 DJ Garba Chaud en concert au stade | « Concert au stade… » |
| 33,6 – 36,2 s | 🚐 Le gbaka à la gare d'Adjamé, « Adjamé ! Adjamé ! » | « Gbaka, woro-woro… on bouge ! » |
| 36,2 – 39 s | 🏠 La maison monte, bloc par bloc | « Tu construis ta maison, brique par brique. » |
| 39 – 41,8 s | 📱 Le téléphone : Waye, Tikitoko, Babigram, Bet225, Dames, 8 américain, Kinéo, Dodo | « Waye, Tikitoko, Bet225… tout est dans ton téléphone ! » |
| 41,8 – 44,4 s | 🌍 L'avion au-dessus des nuages | « Et quand l'argent est là… tu prends l'avion ! » |
| 44,4 – 46,4 s | Tout défile, une image par quart de seconde : **TOUT ÇA… DANS UN SEUL JEU** | « Tout ça… dans un seul jeu ! » |
| 46,4 – 53 s | La fin : « Ta vie. Ton quartier. Ton Babi. », le QR code | « Babi Life : ta vie, ton quartier, ton Babi. Inscris-toi, c'est gratuit ! » |

## Le texte d'un seul tenant (pour la voix)

Attends… Abidjan… dans un jeu ?!
Bienvenue à Babi ! Moi c'est Awa, suis-moi !
Le Plateau, les tours… même la Tour F en chantier !
La cathédrale… et la messe du dimanche.
Le basket au Palais des Sports… le foot au stade : BUUUT !
Le thé au grin : on refait le monde.
Les dames : tu mises… et tu rafles tout !
Et le 8 américain ! Joker… tu pioches six !
Le soir, maquis : on travaille les billets !
Concert au stade… Gbaka, woro-woro… on bouge !
Tu construis ta maison, brique par brique.
Waye, Tikitoko, Bet225… tout est dans ton téléphone !
Et quand l'argent est là… tu prends l'avion !
Tout ça… dans un seul jeu !
Babi Life : ta vie, ton quartier, ton Babi. Inscris-toi, c'est gratuit !

## Pour ElevenLabs

La même voix qu'Awa dans les autres vidéos (« Lea - UGC creator »), ou une voix de femme jeune, chaleureuse, francophone d'Afrique de l'Ouest (chercher « Ivorian », « West African French » ou « African French female »). « Babi Life » est écrit « Babi Laïf », « Bet225 » est écrit « Bet deux-deux-cinq », pour que la voix les dise comme il faut. Les nombres sont en lettres.

### Modèle Eleven v3 (avec les émotions entre crochets)

Réglages : Stability « Creative » (plus d'énergie), vitesse normale. Coller tel quel :

```
[whispers] Attends… [shocked] Abidjan… dans un jeu ?!
[excited] Bienvenue à Babi ! Moi c'est Awa, suis-moi !
[proudly] Le Plateau, les tours… même la Tour F en chantier !
[softly] La cathédrale… et la messe du dimanche.
[excited] Le basket au Palais des Sports… le foot au stade : [shouting] BUUUT !
[relaxed] Le thé au grin : on refait le monde.
[mischievously] Les dames : tu mises… et tu rafles tout !
[excited] Et le 8 américain ! Joker… [laughs] tu pioches six !
[excited] Le soir, maquis : on travaille les billets !
Concert au stade… Gbaka, woro-woro… on bouge !
[proudly] Tu construis ta maison, brique par brique.
Waye, Tikitoko, Bet deux-deux-cinq… tout est dans ton téléphone !
[dreamy] Et quand l'argent est là… [excited] tu prends l'avion !
[whispers] Tout ça… [shouting] dans un seul jeu !
[warmly] Babi Laïf : ta vie, ton quartier, ton Babi. [excited] Inscris-toi, c'est gratuit !
```

### Modèle Multilingual v2 (avec les pauses chronométrées)

Réglages : Stability 35 %, Similarity 75 %, Style 45 %, Speaker boost activé, vitesse 1,05. Les pauses calent chaque phrase sur son image :

```
Attends… Abidjan… dans un jeu ?! <break time="0.4s" />
Bienvenue à Babi ! Moi c'est Awa, suis-moi ! <break time="0.4s" />
Le Plateau, les tours… même la Tour F en chantier ! <break time="0.4s" />
La cathédrale… <break time="0.6s" /> et la messe du dimanche. <break time="0.5s" />
Le basket au Palais des Sports… <break time="0.4s" /> le foot au stade : BUUUT ! <break time="0.5s" />
Le thé au grin : on refait le monde. <break time="0.5s" />
Les dames : tu mises… et tu rafles tout ! <break time="0.5s" />
Et le 8 américain ! Joker… tu pioches six ! <break time="0.8s" />
Le soir, maquis : on travaille les billets ! <break time="0.3s" />
Concert au stade… <break time="0.4s" /> Gbaka, woro-woro… on bouge ! <break time="0.3s" />
Tu construis ta maison, brique par brique. <break time="0.3s" />
Waye, Tikitoko, Bet deux-deux-cinq… tout est dans ton téléphone ! <break time="0.3s" />
Et quand l'argent est là… tu prends l'avion ! <break time="0.3s" />
Tout ça… dans un seul jeu ! <break time="1.2s" />
Babi Laïf : ta vie, ton quartier, ton Babi. Inscris-toi, c'est gratuit !
```

### Après

Télécharger en MP3, le mettre dans `marketing/out/voix-tout.mp3`, puis `npm run video:tout`. La voix doit durer environ 50 secondes. Si elle est plus longue, monter la vitesse ou raccourcir les pauses ; plus courte, les allonger. Le mieux : envoyer le MP3, et la vidéo est recalée sur la voix, phrase par phrase (les `from`/`to` de `FILMS.tout` dans `web/src/lab/poster.tsx`), comme pour « Merci la famille ».

## La légende du post (TikTok, Instagram, statut)

Abidjan… dans un jeu ?! 😱🇨🇮
Le Plateau, la Tour F, la cathédrale, le grin, les dames, le 8 américain, le maquis, le gbaka… TOUT est dans Babi Life 🔥
Tu fais quoi en premier ? Dis-le en commentaire 👇
Inscris-toi gratuitement : lifeinbabi.com/liste

#BabiLife #Abidjan #CoteDIvoire #225 #Babi #8americain #jeuvideo #Plateau #TourF

## Pour que ça tourne

- **Les 2 premières secondes font tout** : l'avion devant Abidjan et « ABIDJAN… DANS UN JEU ?! ». Pas de logo avant.
- Publier le soir (19 h – 21 h), et répondre aux premiers commentaires dans l'heure.
- Épingler un commentaire : « Tu fais quoi en premier : maquis, 8 américain ou la Tour F ? 👇 ».
- Sur TikTok, on peut ajouter un son tendance très bas sous la voix (le beat est déjà dans la vidéo).
- Couper en trois petites vidéos de 15 s pour la semaine suivante : le Plateau et la cathédrale ; le grin, les dames et le 8 américain ; le maquis, le gbaka et la maison.
