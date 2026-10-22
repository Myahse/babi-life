# « 10 trucs à faire dans Babi Life » (vidéo de 51 s)

Un top 10 compté à l'envers, du N°10 au N°1, **filmé dans le jeu pendant qu'on y joue** : le vrai écran du jeu, ses boutons, son score. Une activité par numéro, qui monte comme on fait défiler TikTok ; le numéro et le nom de l'activité en haut à gauche, les dix numéros sur le côté (on veut voir le N°1), les mots d'Awa en sous-titres blancs. Awa ne se présente pas : elle raconte, comme une amie qui te montre son jeu. Ton : **énergique, fière, drôle** ; elle monte en puissance jusqu'au N°1. Chaque phrase tient dans son créneau (colonne « Temps »).

Pour la voix (ElevenLabs ou enregistrée au téléphone) : un seul fichier, `marketing/out/voix-top10.mp3`, puis `node top10.mjs` (ou seulement l'assemblage, voir plus bas) : la voix passe par-dessus le beat (`out/son-top10.mp3`).

| Temps | À l'image | Awa dit |
| --- | --- | --- |
| 0 – 2,6 s | Quatre flashs : le kart, le joker, le panier, le but. **TU T'ENNUIES ? 10 TRUCS À FAIRE DANS BABI LIFE 👇** | « Tu t'ennuies ? Voilà dix trucs à faire à Babi ! » |
| 2,6 – 6,8 s | **N°10 · LE THÉ AU GRIN** : le thé qu'on verse de haut, les trois sur leurs bancs | « Dix : le thé au grin. On refait le monde ! » |
| 6,8 – 11 s | **N°9 · LA MESSE** : la nef de la cathédrale pleine | « Neuf : la messe du dimanche, à la cathédrale. » |
| 11 – 15,2 s | **N°8 · LE ZOUGLOU** : cinq qui dansent devant le maquis la nuit, en ligne sur le beat (zouglou, gweta, moonwalk), les ampoules qui changent à chaque temps | « Huit : le zouglou avec les gars ! » |
| 15,2 – 19,4 s | **N°7 · PRENDRE L'AVION** : l'avion d'Air Lagune au-dessus de la ville, « Vol Abidjan → Yamoussoukro » | « Sept : tu prends l'avion pour Yamoussoukro. » |
| 19,4 – 23,6 s | **N°6 · LE PLATEAU** : le drone monte la Tour F en chantier jusqu'aux grues, puis recule : la Cité administrative, les tours du Plateau, la lagune | « Six : le Plateau… et la Tour F en chantier ! » |
| 23,6 – 27,8 s | **N°5 · LES DAMES** : le pion d'Awa en prend trois d'un coup, Tonton Brou répond | « Cinq : les dames. Tu mises… et tu rafles tout ! » |
| 27,8 – 32 s | **N°4 · LE 8 AMÉRICAIN** : Awa pose son 9 de cœur, Tantie Bintou sort le joker, Awa pioche six | « Quatre : le 8 américain. Joker ? Pioche six ! » |
| 32 – 36,2 s | **N°3 · LE KART** : la course, les virages, la position | « Trois : la course de karts. Dérapage ! » |
| 36,2 – 40,4 s | **N°2 · LE BASKET** : le match en cours, le panier | « Deux : le basket… et smash ! » |
| 40,4 – 44,6 s | **🏆 N°1 · LE FOOT** : le match en cours, le but | « Et numéro un… le foot avec les gars du quartier. BUUUT ! » |
| 44,6 – 50,6 s | La fin : **ET TOI, TU COMMENCES PAR LEQUEL ? 👇**, le QR code | « Et toi, tu commences par lequel ? Inscris-toi, c'est gratuit ! » |

## Le texte d'un seul tenant (pour la voix)

Tu t'ennuies ? Voilà dix trucs à faire à Babi !
Dix : le thé au grin. On refait le monde !
Neuf : la messe du dimanche, à la cathédrale.
Huit : le zouglou avec les gars !
Sept : tu prends l'avion pour Yamoussoukro.
Six : le Plateau… et la Tour F en chantier !
Cinq : les dames. Tu mises… et tu rafles tout !
Quatre : le 8 américain. Joker ? Pioche six !
Trois : la course de karts. Dérapage !
Deux : le basket… et smash !
Et numéro un… le foot avec les gars du quartier. BUUUT !
Et toi, tu commences par lequel ? Inscris-toi, c'est gratuit !

## Pour ElevenLabs

La même voix qu'Awa dans les autres vidéos (« Lea - UGC creator »). « Babi Life » n'est pas dit, sauf dans le texte à l'écran. Les nombres sont en lettres.

### Modèle Eleven v3 (avec les émotions entre crochets)

Réglages : Stability « Creative », vitesse normale. Coller tel quel :

```
[curious] Tu t'ennuies ? [excited] Voilà dix trucs à faire à Babi !
[relaxed] Dix : le thé au grin. [laughs] On refait le monde !
[softly] Neuf : la messe du dimanche, à la cathédrale.
[excited] Huit : le zouglou avec les gars !
[dreamy] Sept : tu prends l'avion pour Yamoussoukro.
[proudly] Six : le Plateau… et la Tour F en chantier !
[mischievously] Cinq : les dames. Tu mises… et tu rafles tout !
[excited] Quatre : le 8 américain. Joker ? [laughs] Pioche six !
[excited] Trois : la course de karts. Dérapage !
[excited] Deux : le basket… [shouting] et smash !
[whispers] Et numéro un… [excited] le foot avec les gars du quartier. [shouting] BUUUT !
[warmly] Et toi, tu commences par lequel ? [excited] Inscris-toi, c'est gratuit !
```

### Modèle Multilingual v2 (avec les pauses chronométrées)

Réglages : Stability 35 %, Similarity 75 %, Style 45 %, Speaker boost activé, vitesse 1,0. Chaque numéro a 4,2 secondes :

```
Tu t'ennuies ? Voilà dix trucs à faire à Babi ! <break time="0.3s" />
Dix : le thé au grin. On refait le monde ! <break time="1.2s" />
Neuf : la messe du dimanche, à la cathédrale. <break time="1.0s" />
Huit : le zouglou avec les gars ! <break time="1.6s" />
Sept : tu prends l'avion pour Yamoussoukro. <break time="1.0s" />
Six : le Plateau… et la Tour F en chantier ! <break time="0.8s" />
Cinq : les dames. Tu mises… et tu rafles tout ! <break time="0.7s" />
Quatre : le 8 américain. Joker ? Pioche six ! <break time="0.8s" />
Trois : la course de karts. Dérapage ! <break time="1.4s" />
Deux : le basket… et smash ! <break time="1.6s" />
Et numéro un… le foot avec les gars du quartier. BUUUT ! <break time="0.6s" />
Et toi, tu commences par lequel ? Inscris-toi, c'est gratuit !
```

### Après

Télécharger en MP3, le mettre dans `marketing/out/voix-top10.mp3`. La vidéo est déjà filmée : pour seulement la remettre avec la voix, relancer l'encodage (la fin de `top10.mjs`, ou demander à Claude). Le mieux : envoyer le MP3, et les créneaux sont recalés sur la voix, numéro par numéro.

## La légende du post (TikTok, Instagram, statut)

10 trucs à faire dans Babi Life 🇨🇮👇 Le N°1 c'est sûr que tu le fais aussi 😂⚽
Thé au grin, messe, zouglou, avion, Tour F, dames, 8 américain, kart, basket, foot… tout est dans le jeu 🔥
Tu commences par lequel ? Dis-le en commentaire 👇
Inscris-toi gratuitement : lifeinbabi.com/liste

#BabiLife #Abidjan #CoteDIvoire #225 #Babi #8americain #zouglou #jeuvideo #top10

## Pour que ça tourne

- La première image, c'est déjà du jeu (le kart, le joker, le panier, le but) avec « TU T'ENNUIES ? » : on ne coupe pas avant le N°10.
- Les dix numéros sur le côté font rester jusqu'au N°1.
- Épingler un commentaire : « Moi c'est le 8 américain direct 🃏 Et toi ? ».
- Publier le soir (19 h – 21 h), répondre aux premiers commentaires dans l'heure.
- Pour la semaine suivante, chaque numéro peut faire sa petite vidéo de 5 s.
