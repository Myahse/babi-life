# « Qu'est-ce que tu veux dans Babi Life ? » — le micro-trottoir de Keke (vidéo de 48 s)

Keke, l'ami d'Awa, descend dans la rue avec son téléphone et pose **une seule question** aux gens de Babi : « Qu'est-ce que tu veux dans Babi Life ? ». Six personnes, six quartiers, six envies ; elles s'ajoutent à l'écran au fur et à mesure (la liste des envies). À la fin, Keke demande à ceux qui regardent d'écrire la leur en commentaire. Le but : faire parler la communauté et récolter des idées.

**Keke** : un jeune homme d'Abidjan, casquette orange à l'envers, maillot orange des Éléphants, chaîne au cou, toujours souriant, rapide, drôle. Il filme les gens avec son téléphone tendu (un micro-trottoir façon TikTok).

Six scènes nouvelles, une par personne, chacune dans son décor :

| Qui | Où | Le décor |
| --- | --- | --- |
| **Mariam**, étudiante | Yopougon | une rue avec des arbres, un banc |
| **Moussa**, apprenti gbaka | Adjamé | le gbaka jaune et vert garé derrière lui |
| **Tantie Adjoua**, vendeuse | Treichville | la terrasse de maquis, tables et parasol |
| **Junior**, élève | Cocody | un mur peint aux couleurs des Éléphants, un ballon |
| **Vieux Koffi**, retraité | Abobo | sous un manguier, sur sa chaise |
| **Prisca**, coiffeuse | Marcory | devant un salon de coiffure |

À l'écran en permanence : la question en haut ; le nom, le quartier et le métier de la personne ; ce qu'elle dit en sous-titre ; et à droite **la liste des envies** qui se remplit (💍 Mariage, 🚐 Gbaka, 🍗 Maquis, ⚽ CAN, 🏡 Village, 💇🏾‍♀️ Salon).

| Temps | À l'image | Qui parle | Ce qu'il dit |
| --- | --- | --- | --- |
| 0 – 5 s | Keke face caméra au carrefour, il fait coucou | Keke | « Yo la famille ! C'est Keke, l'ami d'Awa. Aujourd'hui, micro-trottoir dans Babi ! » |
| 5 – 8 s | La question s'affiche en grand | Keke | « Une seule question : qu'est-ce que tu veux dans Babi Life ? » |
| 8 – 13 s | Mariam, Yopougon | Mariam | « Moi ? Mon mariage ! La dot, le pagne, la fête… tout dans le jeu ! » |
| 13 – 18 s | Moussa devant son gbaka, Adjamé | Moussa | « Je veux conduire mon propre gbaka et crier : Adjamé ! Adjamé ! » |
| 18 – 23 s | Tantie Adjoua à son maquis, Treichville | Tantie Adjoua | « Ouvrir mon maquis, mon fils. Poisson braisé, attiéké, et tout le monde vient chez moi ! » |
| 23 – 27 s | Junior et le ballon, Cocody | Junior | « La CAN ! Jouer avec les Éléphants dans le stade ! » |
| 27 – 32 s | Vieux Koffi sous le manguier, Abobo | Vieux Koffi | « Aller au village pour les fêtes, voir la famille. C'est ça, la vie. » |
| 32 – 36 s | Prisca devant le salon, Marcory | Prisca | « Mon salon de coiffure à moi ! Faire les tresses à tout Babi. » |
| 36 – 43 s | Keke, la liste des six envies | Keke | « Mariage, gbaka, maquis, la CAN, le village, le salon… Et toi ? Dis-nous en commentaire ce que tu veux dans Babi Life. On lit tout ! » |
| 43 – 48 s | La fin : « Et toi ? 👇 », le QR code | Keke | « Les meilleures idées vont arriver dans le jeu. On est ensemble ! » |

## Pour ElevenLabs

Le plus simple : **Text to Dialogue** (modèle Eleven v3), qui fait plusieurs voix dans un seul fichier. Une voix par personne :

| Rôle | Voix à choisir (bibliothèque : « African », « Ivorian », « West African French ») |
| --- | --- |
| Keke | homme jeune, énergique, rieur |
| Mariam | jeune femme, enjouée |
| Moussa | jeune homme, voix qui porte (il crie « Adjamé ! ») |
| Tantie Adjoua | femme mûre, chaleureuse, un peu taquine |
| Junior | adolescent, excité |
| Vieux Koffi | homme âgé, posé, voix grave |
| Prisca | jeune femme, sûre d'elle |

« Babi Life » est écrit « Babi Laïf » pour que les voix le disent à l'anglaise.

### Text to Dialogue (Eleven v3), à coller ligne par ligne, chaque ligne avec sa voix

```
Keke: [excited] Yo la famille ! C'est Keke, l'ami d'Awa. Aujourd'hui, micro-trottoir dans Babi !
Keke: [curious] Une seule question : qu'est-ce que tu veux dans Babi Laïf ?
Mariam: [laughs] Moi ? Mon mariage ! [excited] La dot, le pagne, la fête… tout dans le jeu !
Moussa: [shouting] Je veux conduire mon propre gbaka et crier : Adjamé ! Adjamé !
Tantie Adjoua: [warmly] Ouvrir mon maquis, mon fils. Poisson braisé, attiéké, [laughs] et tout le monde vient chez moi !
Junior: [excited] La CAN ! Jouer avec les Éléphants dans le stade !
Vieux Koffi: [calm] Aller au village pour les fêtes, voir la famille. [sighs] C'est ça, la vie.
Prisca: [confident] Mon salon de coiffure à moi ! Faire les tresses à tout Babi.
Keke: [laughs] Mariage, gbaka, maquis, la CAN, le village, le salon… [curious] Et toi ? Dis-nous en commentaire ce que tu veux dans Babi Laïf. On lit tout !
Keke: [warmly] Les meilleures idées vont arriver dans le jeu. On est ensemble !
```

### Avec une seule voix (si on veut faire vite)

Keke dit tout, en imitant un peu chacun (Text to Speech, Eleven v3) :

```
[excited] Yo la famille ! C'est Keke, l'ami d'Awa. Aujourd'hui, micro-trottoir dans Babi !
[curious] Une seule question : qu'est-ce que tu veux dans Babi Laïf ?
[playfully] Mariam, à Yop, elle me dit : « Mon mariage ! La dot, le pagne, la fête… tout dans le jeu ! »
[laughs] Moussa, l'apprenti, à Adjamé : « Conduire mon gbaka et crier : Adjamé ! Adjamé ! »
[warmly] Tantie Adjoua, à Treichville : « Ouvrir mon maquis, poisson braisé, attiéké ! »
[excited] Junior, à Cocody : « La CAN ! Jouer avec les Éléphants ! »
[calm] Le vieux Koffi, à Abobo : « Aller au village pour les fêtes, voir la famille. »
[confident] Et Prisca, à Marcory : « Mon salon de coiffure à moi ! »
[laughs] Mariage, gbaka, maquis, la CAN, le village, le salon… [curious] Et toi ? Dis-nous en commentaire ce que tu veux dans Babi Laïf. On lit tout !
[warmly] Les meilleures idées vont arriver dans le jeu. On est ensemble !
```

### Après

Télécharger en MP3, le mettre dans `marketing/out/voix-keke.mp3`, puis `npm run video:keke` : la vidéo ressort avec le son. Sans voix, elle sort muette, calée sur les temps du tableau ; avec la voix, recaler les plans sur ses phrases (`FILMS.keke` dans `web/src/lab/poster.tsx`), ou l'envoyer à Claude pour qu'il le fasse.

## La légende du post (TikTok, Instagram, statut)

Micro-trottoir dans Babi 🎤🇨🇮 « Qu'est-ce que tu veux dans Babi Life ? »
💍 Le mariage · 🚐 Le gbaka · 🍗 Le maquis · ⚽ La CAN · 🏡 Le village · 💇🏾‍♀️ Le salon
Et toi ? Écris ton idée en commentaire 👇 On lit tout, et les meilleures arrivent dans le jeu !

#BabiLife #Abidjan #CoteDIvoire #225 #microtrottoir #jeuvideo #Babi

## La voix enregistrée

`out/voix-keke.mp3` : une voix ElevenLabs par personne, chacune dans son fichier, mises bout à bout dans l'ordre du dialogue (0,3 s entre deux), 55,4 s en tout : Keke (« Kéké gen ») bonjour et question, Mariam (« Fatou - Radiant and Gentle »), Moussa (« Moussa - Warm and Resonant »), Tantie Adjoua (« Aquilas »), Junior (« Ali Alioum »), Vieux Koffi (« le vieux gen »), Prisca (« Mar - Calm Deep and Gloomy »), puis Keke, le résumé et la fin. Dans la vidéo (`FILMS.keke` dans `web/src/lab/poster.tsx`) : Keke 0 s (la question à 5,6 s), Mariam 9,2 s, Moussa 15,5 s, Tantie Adjoua 20,7 s, Junior 27,6 s, Vieux Koffi 31,3 s, Prisca 37,1 s, Keke 41,6 s, la fin 52,1 s. Avec d'autres fichiers, refaire l'assemblage et recaler ces temps.
