# « Keke contre Awa » : les nouveaux jeux de Babi Life (vidéo d'environ 45 s)

Juste avant la sortie du mercredi 28 octobre, Keke défie Awa à **la salle de jeux** de Babi Life, et on montre **le vrai gameplay** des nouveaux jeux, en plans courts :
- le foot au stade en 11 contre 11 ;
- le combat de rue ;
- la course à deux ;
- le kart ;
- les matchs entre amis sur les terrains ;
- et la manette.

Ton : deux potes qui se chambrent, rapide, drôle. Keke est sûr de lui et perd ; Awa gagne et se moque gentiment. À la fin, ils appellent ensemble à s'inscrire.

**Awa** : tresses, haut et jupe en kente vert, ses bijoux (le même look que « Merci la famille » et « La sortie »).
**Keke** : casquette orange à l'envers, maillot orange des Éléphants, chaîne au cou (le même que le micro-trottoir).

À l'écran en permanence :
- le score du duel en haut, « AWA 0 – 0 KEKE », qui monte à chaque jeu ;
- un autocollant « NOUVEAU » sur chaque jeu ;
- à la fin, « 📅 Mercredi 28 octobre ».

| Temps | À l'image | Qui | Texte |
| --- | --- | --- | --- |
| 0 – 3,5 s | La salle de jeux, Keke entre en montrant Awa du doigt | Keke | « Awa ! Toi et moi, à la salle de jeux. Maintenant ! » |
| 3,5 – 6 s | Awa sourit, s'assoit à la console | Awa | « Keke… tu vas pleurer, hein. » |
| 6 – 13 s | NOUVEAU · **Le foot au stade, 11 contre 11** : le stade plein, la caméra télé, Awa dribble, centre, tête, but ; la tribune saute | Keke | « Le foot comme sur les grands jeux : le stade, l'arbitre, les penalties, les cartons… » |
| 13 – 16 s | Penalty : le gardien plonge du mauvais côté, but ; score AWA 1 – 0 | Awa | « Penalty… Et c'est but ! » |
| 16 – 21 s | NOUVEAU · **Le combat de rue** : la rue de nuit, la série jab-direct-uppercut, le KO au ralenti ; AWA 2 – 0 | Keke | « Le combat de rue, en 3D ! Attends, attends… Eh ! Elle m'a mis KO ! » |
| 21 – 26 s | NOUVEAU · **La course à deux** : la ville au crépuscule, le dérapage, le nitro, Awa double sur la ligne ; AWA 3 – 0 | Awa | « La course : dérapage, nitro… et je te double sur la ligne ! » |
| 26 – 30 s | **Le kart** à Babi Karting, la peau de banane ; Keke tourne sur lui-même ; AWA 4 – 0 | Keke | « Le kart ! Qui a mis la banane là ?! » |
| 30 – 35 s | NOUVEAU · **Avec une manette** : une manette posée sur la table, puis les matchs de foot et de basket entre amis sur les terrains de quartier | Awa | « Et tu peux jouer à la manette… ou avec tes amis, sur les terrains du quartier. » |
| 35 – 39 s | Keke s'effondre sur la table, Awa fait l'avion | Keke | « Quatre à zéro… Mais mercredi, je prends ma revanche ! » |
| 39 – 45 s | La fin : « Babi Life sort mercredi 28 octobre », le QR code de la liste ; les deux ensemble | Awa et Keke | Awa : « Babi Life sort mercredi vingt-huit octobre ! » Keke : « Inscris-toi sur la liste, et viens nous défier ! » |

## Le texte d'un seul tenant (pour les voix)

KEKE : Awa ! Toi et moi, à la salle de jeux. Maintenant !
AWA : Keke… tu vas pleurer, hein.
KEKE : Le foot comme sur les grands jeux : le stade, l'arbitre, les penalties, les cartons…
AWA : Penalty… Et c'est but !
KEKE : Le combat de rue, en 3D ! Attends, attends… Eh ! Elle m'a mis KO !
AWA : La course : dérapage, nitro… et je te double sur la ligne !
KEKE : Le kart ! Qui a mis la banane là ?!
AWA : Et tu peux jouer à la manette… ou avec tes amis, sur les terrains du quartier.
KEKE : Quatre à zéro… Mais mercredi, je prends ma revanche !
AWA : Babi Life sort mercredi vingt-huit octobre !
KEKE : Inscris-toi sur la liste, et viens nous défier !

## Pour ElevenLabs

Les mêmes voix que dans les vidéos d'avant, pour qu'on les reconnaisse :

| Rôle | Voix |
| --- | --- |
| Awa | « Lea - UGC creator » (comme « Merci la famille », « On m'a arnaquée », « La sortie ») |
| Keke | « Kéké gen » (comme le micro-trottoir) |

« Babi Life » est écrit « Babi Laïf » pour que les voix le disent à l'anglaise. Les nombres sont en lettres.

### Text to Dialogue (modèle Eleven v3), une ligne par réplique, chacune avec sa voix

```
[Keke] [excited] Awa ! Toi et moi, à la salle de jeux. Maintenant !
[Awa] [mischievously] Keke… [laughs] tu vas pleurer, hein.
[Keke] [excited] Le foot comme sur les grands jeux : le stade, l'arbitre, les penalties, les cartons…
[Awa] [whispers] Penalty… [shouting] Et c'est but !
[Keke] [excited] Le combat de rue, en 3D ! Attends, attends… [surprised] Eh ! Elle m'a mis KO !
[Awa] [excited] La course : dérapage, nitro… [laughs] et je te double sur la ligne !
[Keke] [frustrated] Le kart ! Qui a mis la banane là ?!
[Awa] [happy] Et tu peux jouer à la manette… ou avec tes amis, sur les terrains du quartier.
[Keke] [sighs] Quatre à zéro… [determined] Mais mercredi, je prends ma revanche !
[Awa] [excited] Babi Laïf sort mercredi vingt-huit octobre !
[Keke] [excited] Inscris-toi sur la liste, et viens nous défier !
```

(Les crochets [Keke] / [Awa] disent seulement quelle voix choisir pour la ligne : ne pas les coller dans le texte.)

### Si on fait chaque voix à part (Multilingual v2)

Réglages : Stability 45 %, Similarity 75 %, Style 30 %, Speaker boost activé, vitesse 1,0. Une réplique par fichier, puis les mettre bout à bout dans l'ordre avec 0,3 s entre deux, comme pour le micro-trottoir.

### Après

Télécharger le MP3, le mettre dans `marketing/out/voix-jeux.mp3` et l'envoyer à Claude. Il monte la vidéo (`FILMS.jeux` dans `web/src/lab/poster.tsx`), avec de vraies parties filmées dans le jeu :
- `city.html?view=fifa11` : le stade, le centre et la tête, le penalty ;
- `?view=defi&kind=combat` : la série et le KO ;
- `?view=defi&kind=course` : le dérapage, le nitro, la ligne ;
- `?view=kart` : la banane ;
- `?view=foot5` et `?view=hoops` : les terrains entre amis.

Chaque plan est calé sur sa phrase, puis la vidéo est rendue avec `FILM=jeux node video.mjs`.

## La légende du post (TikTok, Instagram, statut)

Keke a défié Awa… 4 à 0 😂🎮 Les nouveaux jeux de Babi Life : le foot au stade en 11 contre 11 avec arbitre et penalties, le combat de rue, la course, le kart, les matchs entre amis, et même à la manette.
Babi Life sort **mercredi 28 octobre**, gratuit. Inscris-toi sur la liste (lien en bio) et viens les défier 👇

#BabiLife #Abidjan #CoteDIvoire #225 #Babi #jeuvideo #28octobre #gaming

## Pourquoi pas le casino dans cette vidéo

Les jeux d'argent (casino, machines, bingo) sont réservés aux 18 ans et plus dans le jeu. Une vidéo pour tout le monde sur TikTok ne les montre pas : on garde les jeux d'adresse.
