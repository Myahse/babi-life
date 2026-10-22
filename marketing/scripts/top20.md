# « 20 trucs à faire dans Babi Life » (vidéo d'environ 1 min)

Un top 20 compté à l'envers, du N°20 au N°1, **filmé dans le jeu pendant qu'on y joue** : le vrai écran du jeu, ses lieux, ses boutons, son score. Une activité par numéro, qui monte comme on fait défiler TikTok ; le numéro et le nom de l'activité en haut à gauche, une barre de 20 segments en haut (comme les stories : on voit ce qui reste jusqu'au N°1), les mots d'Awa en sous-titres blancs. Awa ne se présente pas : elle raconte, vite, comme une amie qui te montre son jeu. **Chaque numéro dure le temps de sa phrase** (2,5 à 4 s) : la vidéo est calée sur la voix.

La voix est faite ici (`marketing/voice.py`), avec un modèle ouvert qu'on a le droit d'utiliser pour de la pub (Chatterbox, licence MIT), en français, énergique. Chaque phrase est dite trois fois, et on garde celle qu'une reconnaissance vocale (Whisper) comprend le mieux. Pour la voix habituelle d'Awa (ElevenLabs, « Lea - UGC creator ») : les textes à coller sont plus bas, un seul fichier pour tout ; la vidéo se recale dessus.

| N° | À l'image | Awa dit |
| --- | --- | --- |
| Accroche | Quatre flashs : le ski nautique, le joker, le panier, le but. **TU T'ENNUIES ? 20 TRUCS À FAIRE DANS BABI LIFE 👇** | « Tu t'ennuies ? Voilà vingt trucs à faire à Babi ! » |
| 20 | **LE SKI NAUTIQUE** : le bateau qui tire Awa au large de l'île Boulay | « Vingt : du ski nautique à l'île Boulay ! » |
| 19 | **PARLER NOUCHI** : Koffi, le vendeur de crédit, la fenêtre de discussion ; « On dit quoi ? », il éclate de rire | « Dix-neuf : parler nouchi avec tout le monde. » |
| 18 | **LE ZOO** : le zoo d'Abidjan, Awa en selfie devant les lions | « Dix-huit : les selfies devant les lions du zoo ! » |
| 17 | **LE THÉ AU GRIN** : le thé qu'on verse de haut, les trois sur leurs bancs | « Dix-sept : le thé au grin. » |
| 16 | **LE MARCHÉ** : les étals, les prix qu'on crie | « Seize : faire son marché. » |
| 15 | **LES PHOTOS** : l'appareil photo du téléphone, la photo prise | « Quinze : prendre Babi en photo. » |
| 14 | **LA MESSE** : la nef de la cathédrale pleine | « Quatorze : la messe du dimanche. » |
| 13 | **LA PRIÈRE DU VENDREDI** : la salle de prière de la mosquée, les rangs | « Treize : la grande prière du vendredi. » |
| 12 | **LE LÈCHE-VITRINE** : le centre commercial, ses boutiques | « Douze : le lèche-vitrine au centre commercial. » |
| 11 | **LE CINÉ** : la salle du Kinéo | « Onze : le ciné, avec le pop-corn ! » |
| 10 | **LE BRUNCH** : la terrasse face à la lagune | « Dix : bruncher face à la lagune. » |
| 9 | **LA BOÎTE** : la boîte de la rue Princesse, les lumières | « Neuf : la boîte, à la rue Princesse ! » |
| 8 | **LE ZOUGLOU** : cinq qui dansent devant le maquis la nuit, en ligne sur le beat | « Huit : le zouglou avec les gars ! » |
| 7 | **L'AVION** : l'avion d'Air Lagune, « Vol Abidjan → Yamoussoukro » | « Sept : l'avion pour Yamoussoukro. » |
| 6 | **LA TOUR F** : le drone monte la Tour F en chantier, puis recule sur le Plateau et la lagune | « Six : la tour F en chantier ! » |
| 5 | **LES DAMES** : le pion d'Awa en prend trois d'un coup | « Cinq : les dames. Tu mises, tu rafles tout ! » |
| 4 | **LE 8 AMÉRICAIN** : Tantie Bintou sort le joker, Awa pioche six | « Quatre : le 8 américain. Joker ? Pioche six ! » |
| 3 | **LE KART** : la course, les virages, la position | « Trois : la course de karts ! » |
| 2 | **LE BASKET** : le match en cours, le panier | « Deux : le basket… et panier ! » |
| 🏆 1 | **LE FOOT** : le match en cours, le but | « Et numéro un… le foot du quartier. BUUUT ! » |
| Fin | **ET TOI, TU COMMENCES PAR LEQUEL ? 👇**, le QR code, « + de 160 activités dans le jeu » | « Et il y en a plus de cent soixante dans le jeu ! Tu commences par lequel ? » |

Le jeu compte 161 activités différentes dans ses lieux (`backend/internal/game/catalog.go`) : « plus de 160 » est vrai.

## Le texte d'un seul tenant

Tu t'ennuies ? Voilà vingt trucs à faire à Babi !
Vingt : du ski nautique à l'île Boulay !
Dix-neuf : parler nouchi avec tout le monde.
Dix-huit : les selfies devant les lions du zoo !
Dix-sept : le thé au grin.
Seize : faire son marché.
Quinze : prendre Babi en photo.
Quatorze : la messe du dimanche.
Treize : la grande prière du vendredi.
Douze : le lèche-vitrine au centre commercial.
Onze : le ciné, avec le pop-corn !
Dix : bruncher face à la lagune.
Neuf : la boîte, à la rue Princesse !
Huit : le zouglou avec les gars !
Sept : l'avion pour Yamoussoukro.
Six : la tour F en chantier !
Cinq : les dames. Tu mises, tu rafles tout !
Quatre : le huit américain. Joker ? Pioche six !
Trois : la course de karts !
Deux : le basket… et panier !
Et numéro un… le foot du quartier. Buuut !
Et il y en a plus de cent soixante dans le jeu ! Tu commences par lequel ?

## Pour ElevenLabs (la voix habituelle d'Awa)

Voix « Lea - UGC creator ». **Un seul fichier** avec les 22 phrases, chacune sur sa ligne avec une ligne vide entre deux : Claude le coupe aux silences en 22 morceaux (`hook`, `ski`, … `outro`) et recale la vidéo dessus, numéro par numéro.

### Modèle Eleven v3 (le plus vivant)

Réglages : Stability « Creative », vitesse normale. Coller tel quel :

```
[excited] Tu t'ennuies ? Voilà vingt trucs à faire à Babi !

[excited] Vingt : du ski nautique à l'île Boulay !

[laughs] Dix-neuf : parler nouchi avec tout le monde.

[excited] Dix-huit : les selfies devant les lions du zoo !

[relaxed] Dix-sept : le thé au grin.

[cheerfully] Seize : faire son marché.

[playfully] Quinze : prendre Babi en photo.

[softly] Quatorze : la messe du dimanche.

[softly] Treize : la grande prière du vendredi.

[playfully] Douze : le lèche-vitrine au centre commercial.

[excited] Onze : le ciné, avec le pop-corn !

[relaxed] Dix : bruncher face à la lagune.

[excited] Neuf : la boîte, à la rue Princesse !

[excited] Huit : le zouglou avec les gars !

[dreamy] Sept : l'avion pour Yamoussoukro.

[proudly] Six : la tour F en chantier !

[mischievously] Cinq : les dames. Tu mises… tu rafles tout !

[excited] Quatre : le huit américain. Joker ? [laughs] Pioche six !

[excited] Trois : la course de karts !

[excited] Deux : le basket… [shouting] et panier !

[whispers] Et numéro un… [excited] le foot du quartier. [shouting] Buuut !

[excited] Et il y en a plus de cent soixante dans le jeu ! [warmly] Tu commences par lequel ?
```

### Modèle Multilingual v2 (si v3 coupe mal)

Réglages : Stability 35 %, Similarity 75 %, Style 45 %, Speaker boost activé, vitesse 1,0. Les pauses d'une seconde séparent les phrases :

```
Tu t'ennuies ? Voilà vingt trucs à faire à Babi ! <break time="1.0s" />
Vingt : du ski nautique à l'île Boulay ! <break time="1.0s" />
Dix-neuf : parler nouchi avec tout le monde. <break time="1.0s" />
Dix-huit : les selfies devant les lions du zoo ! <break time="1.0s" />
Dix-sept : le thé au grin. <break time="1.0s" />
Seize : faire son marché. <break time="1.0s" />
Quinze : prendre Babi en photo. <break time="1.0s" />
Quatorze : la messe du dimanche. <break time="1.0s" />
Treize : la grande prière du vendredi. <break time="1.0s" />
Douze : le lèche-vitrine au centre commercial. <break time="1.0s" />
Onze : le ciné, avec le pop-corn ! <break time="1.0s" />
Dix : bruncher face à la lagune. <break time="1.0s" />
Neuf : la boîte, à la rue Princesse ! <break time="1.0s" />
Huit : le zouglou avec les gars ! <break time="1.0s" />
Sept : l'avion pour Yamoussoukro. <break time="1.0s" />
Six : la tour F en chantier ! <break time="1.0s" />
Cinq : les dames. Tu mises… tu rafles tout ! <break time="1.0s" />
Quatre : le huit américain. Joker ? Pioche six ! <break time="1.0s" />
Trois : la course de karts ! <break time="1.0s" />
Deux : le basket… et panier ! <break time="1.0s" />
Et numéro un… le foot du quartier. Buuut ! <break time="1.0s" />
Et il y en a plus de cent soixante dans le jeu ! Tu commences par lequel ?
```

### Après

Télécharger le MP3 et l'envoyer à Claude (ou le mettre dans `marketing/out/voix-top20-elevenlabs.mp3`) : il est coupé en 22 phrases dans `marketing/out/voix-top20/`, puis `python3 voice.py --measure` et `ONLY=zouglou,overlay node top20.mjs` recalent toute la vidéo sur la voix.

## La légende du post (TikTok, Instagram, statut)

20 trucs à faire dans Babi Life 🇨🇮👇 Le N°1 c'est sûr que tu le fais aussi 😂⚽
Ski nautique, zoo, nouchi, grin, messe, prière du vendredi, ciné, boîte à la rue Princesse, zouglou, avion, Tour F, dames, 8 américain, kart, basket, foot… et + de 160 activités 🔥
Tu commences par lequel ? Dis-le en commentaire 👇
Inscris-toi gratuitement : lifeinbabi.com/liste

#BabiLife #Abidjan #CoteDIvoire #225 #Babi #nouchi #zouglou #8americain #jeuvideo #top20

## Pour que ça tourne

- La première image, c'est déjà du jeu (le ski, le joker, le panier, le but) avec « TU T'ENNUIES ? » : on ne coupe pas avant le N°20.
- La barre de 20 segments en haut fait rester jusqu'au N°1.
- Épingler un commentaire : « Moi c'est le ski nautique direct 🌊 Et toi ? ».
- Publier le soir (19 h – 21 h), répondre aux premiers commentaires dans l'heure.
- La semaine suivante, chaque numéro peut faire sa petite vidéo de 5 s.
