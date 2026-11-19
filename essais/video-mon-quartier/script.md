# Vidéo « Mon quartier » v3 — la voix vivante (même image que la v2)

Retour du propriétaire sur la v2 : « pas de vie, ça sonne généré, pas d'émotion ». La v3 garde l'image, les sous-titres et la carte des testeurs de la v2, et refait **toute la voix** et le son :

- **Voix** : toujours Lea (« Lea - UGC creator », `KSyQzmsYhFbuOhqj1Xxv`), mais avec le modèle **`eleven_v3`** et ses balises d'interprétation ([excited], [laughs], [playful], [amazed], [warmly], [sighs]), stabilité « Creative » (0) ou « Natural » (0,5), `language_code: fr`. Texte réécrit en parlé d'Abidjan : une copine qui montre le jeu à sa copine (« Eeh ! », « hein », « gars », « C'est trop doux », « On est ensemble »), avec un rire, un soupir, des « oh », « ah ».
- **4 prises par réplique** (2 en Natural, 2 en Creative), choisies sur : texte exact à la transcription (aucune balise lue), étendue et variation de la mélodie (F0 en demi-tons), rires/soupirs présents (son hors des mots), rythme non régulier. Prises gardées : `voix-v3/n1..n9.mp3`.
- **Fond sonore** (ElevenLabs sound effects) sous la voix, discret (≈ −31 LUFS, abaissé quand elle parle) : oiseaux et ville à l'heure dorée, rue (moto, klaxons, gens), « pop » de terre quand le maquis sort, taxi qui passe, marché (vendeuses qui appellent, rires), maquis la nuit (coupé-décalé au loin, rires, verres, grillons), le gbaka (moteur, deux coups de klaxon) et l'apprenti qui crie « Adjamé ! Adjamé ! » (voix « David », ivoirien), la lagune, des tapotements et « pops » d'interface sur « Plan 2/3 », « Construire ici », « Maquis », « Placer » (le maquis posé), « Gérer », « Encaisser » (pièces), les outils d'« Aménager », les arbres qui poussent, les étapes de la carte de fin.
- **Image** : celle de la v2 (`-sans-voix.mp4` de la v2), recoupée par `scripts/remap3.py` pour laisser respirer les nouvelles répliques : survol d'ouverture ralenti à 5,0 s (images intermédiaires calculées), le maquis qui sort de terre 3,6 s, « Gérer/Encaisser » ralenti + 0,8 s tenue, « Aménager » 5,2 s. Les sous-titres sont dans l'image : ils suivent leur plan.
- Niveaux : voix −15 LUFS, mix final −14 LUFS ; musique de la v2 13 dB sous la voix, abaissée quand elle parle.

Durées : longue **53,2 s**, courte **30,8 s**.

## Le texte (v3)

| # | Temps (longue) | À l'écran | Voix (Lea, eleven_v3 ; les balises ne sont pas dites) |
|---|---|---|---|
| 1 | 0,35 – 5,1 | Survol du quartier | [excited] Eeh ! Y a du nouveau dans Babi Life ! [laughs] Maintenant, t'as ton propre quartier, oh ! |
| 2 | 5,3 – 8,0 | Choisis le plan (médaillon) | [playful] Tu choisis ton plan… dans le style de ta commune, hein ! |
| 3 | 8,35 – 14,1 | Construire le maquis → il sort de terre dans la rue | Tu construis ton maquis… [amazed] et regarde ! Il sort de terre, là, dans ta rue ! C'est trop doux ! |
| 4 | 14,65 – 18,5 | « Gérer », « Encaisser » | Tu rentres dedans, tu gères… [laughs] et tu ramasses l'argent, gars ! |
| 5 | 18,8 – 24,2 | Le marché, puis le maquis la nuit | [warmly] Et le quartier vit, hein ! Le marché, les vendeuses… / …et le maquis plein le soir ! [laughs] |
| — | 24,8 – 26,4 | L'arrêt de gbaka | (l'apprenti : « Adjamé ! Adjamé ! », klaxon) |
| 6 | 26,5 – 31,4 | « Aménager » | [excited] Tu traces tes routes, l'eau, les ponts… [sighs] ah, tu plantes tes arbres. C'est joli, hein ! |
| 7 | 31,7 – 39,1 | Chez Koffi → Babi → Rentrer | Tu passes chez tes gars… / [playful] tu vas à Babi… / et tu rentres chez toi. On est ensemble ! |
| 8 | 41,6 – 45,6 | Carte des testeurs | [excited] Bon, écoute bien : on lance bientôt sur le Play Store… et on cherche des testeurs ! |
| 9 | 45,7 – 49,4 | Carte des testeurs (bouton WhatsApp) | [warmly] Ça prend deux minutes seulement. Rejoins la communauté WhatsApp… on t'attend, hein ! |

Prises choisies (dans le dossier de travail `takes/lea-nX-k`, k = 0,1 Natural, 2,3 Creative) : n1-0, n2-1, n3-1, n4-2, n5-0, n6-0, n7-1, n8-1, n9-2. Écartées entre autres : n5-1 (« le maquis **pleure** le soir »), n7-3 (« Dabi »), n8-0 (« écoute **Dia** »), n6-1 (le « ah » manquant).

Vérification par transcription de la piste voix montée (longue) : tout revient mot pour mot (« maquis » est dit « maki », comme à Abidjan ; « Babi » entendu « Babi »).

**Version courte (30,8 s)** : survol + n1 → construire, le maquis sort de terre (n3) → marché et maquis le soir (n5) → « Aménager » (n6) → carte des testeurs (n8, n9), fondu de 0,4 s vers la carte.

---

# (Pour mémoire) Vidéo « Mon quartier » v2 — script (les nouveautés + l'appel aux testeurs Play Store)

Format : vertical 1080×1920, 30 i/s, 49,8 s (version courte : 26,4 s). Voix : Lea (« Lea - UGC creator »), en français parlé, réglages du HANDOFF. Musique : instrumental afro / coupé-décalé (ElevenLabs, `musique-el2.mp3`, 60 s), sous la voix.

| Temps | À l'écran | Voix (Lea) | Sous-titre |
|---|---|---|---|
| 0,0 – 4,2 | Survol du quartier à l'heure dorée vers la lagune et le Plateau (`s1`) | « Eh, y a du nouveau dans Babi Life ! Maintenant, t'as ton propre quartier. » | pastille **NOUVEAU** · Y a du nouveau dans **Babi Life** ! · T'as **ton propre quartier** |
| 4,2 – 7,4 | Joueur neuf de Cocody : « Choisis le plan de ton quartier », Plan 2 puis Plan 3 touchés (médaillon, `s2a`) | « Tu choisis ton plan, dans le style de ta commune. » | Tu choisis **ton plan**, dans le style de **ta commune** |
| 7,4 – 10,0 | Vue du quartier : terrain libre → « Construire ici » → « Maquis » → « Placer : Maquis » (médaillon, `s4v`) | « Tu construis ton maquis… » | Tu construis **ton maquis**… |
| 10,0 – 13,3 | Dans la rue : le maquis sort de terre sur son terrain, la caméra avance (`s4r`) | « …et il sort de terre, là, dans ta rue. » | …et il **sort de terre**, là, dans ta rue |
| 13,3 – 16,1 | « Gérer » : revenus du jour, « Encaisser », recettes du quartier (médaillon, `s4g`) | « Tu rentres dedans, tu gères, tu ramasses l'argent. » | Tu rentres, tu gères, tu **ramasses l'argent** |
| 16,1 – 19,3 | Le grand marché du monde, étals, vendeuses et clients (`s5m`) | « Et le quartier vit : le marché, les vendeuses… » | Le quartier **vit** : le marché, les vendeuses… |
| 19,3 – 22,3 | Le maquis du joueur la nuit, plein de clients (`s5e`) | « …le maquis plein le soir. » | …le maquis **plein le soir** |
| 22,3 – 23,9 | L'arrêt de gbaka : le gbaka arrive, les gens attendent (`sRg`) | (musique) | puce « Ton quartier · L'arrêt de gbaka » |
| 23,9 – 28,1 | « Aménager » : Eau, Route sur le canal (ponts), Arbre, « Valider », les arbres poussent (médaillon, `s6m`) | « Tu traces tes routes, l'eau, les ponts… tu plantes tes arbres. » | Tu traces **tes routes**, l'eau, les ponts… · …tu plantes **tes arbres** · puce « Nouveau · Aménager » |
| 28,1 – 30,2 | « Quartiers de tes amis » → Koffi : son quartier (niv. 5) se dessine (médaillon, `s7k`) | « Tu passes chez tes gars… » | Tu passes **chez tes gars**… · puce « Niv. 5 · Chez Koffi » |
| 30,2 – 33,3 | « Aller à Babi » → « Babi en ligne » (médaillon, `s6a`), puis la grande ville de Cocody vue d'en haut (`s7`) | « …tu vas à Babi… » | …tu vas **à Babi** · puce « Babi en ligne · Toute la ville » |
| 33,3 – 35,1 | « Rentrer au quartier » touché (capture fixe `babi-ville.png`, médaillon) | « …et tu rentres chez toi. » | …et tu **rentres chez toi** |
| 35,1 – 37,8 | Éclairs du rendu réaliste : la lagune, le pont et les tours du Plateau (`sRl`), un taxi de près (`s4r` fin) | (musique) | Et Babi est **plus beau** que jamais · puce « Nouveau · Lumière, eau, voitures, persos » |
| 37,8 – 49,8 | Carte de fin sur le survol (fondu) : logo Babi Life, « On cherche des testeurs ! », « Pour le lancement sur le Play Store », les 4 étapes qui arrivent une à une, le bouton vert « Rejoins la communauté WhatsApp », `chat.whatsapp.com/Lg3fgekmf6z6fS3J5jPZPi`, « Gratuit · 100 % ivoirien » | « On lance bientôt sur le Play Store, et on cherche des testeurs. Ça prend deux minutes : rejoins la communauté WhatsApp. » | (la carte) |

Étapes de la carte : 1. Rejoins la communauté WhatsApp · 2. Donne ton adresse Gmail · 3. Reçois le lien Play Store et installe · 4. Joue et donne ton avis. Pas de numéro de téléphone.

Texte de la voix (9 répliques, ≈ 30 s de parole, `voix/n1.mp3` … `n9.mp3`) :

1. Eh, y a du nouveau dans Babi Life ! Maintenant, t'as ton propre quartier.
2. Tu choisis ton plan, dans le style de ta commune.
3. Tu construis ton maquis… et il sort de terre, là, dans ta rue. (coupée à 1,2 s)
4. Tu rentres dedans, tu gères, tu ramasses l'argent.
5. Et le quartier vit : le marché, les vendeuses, le maquis plein le soir. (coupée à 2,8 s)
6. Tu traces tes routes, l'eau, les ponts… tu plantes tes arbres.
7. Tu passes chez tes gars… tu vas à Babi, et tu rentres chez toi. (coupée à 1,1 et 2,0 s)
8. On lance bientôt sur le Play Store, et on cherche des testeurs.
9. Ça prend deux minutes : rejoins la communauté WhatsApp. (coupée à 2,72 s : un souffle à la fin s'entendait « et »)

Vérification par transcription (ElevenLabs speech-to-text) des pistes voix montées (longue et courte) : tout revient mot pour mot ; « Babi » est entendu « Baby » dans les prises seules mais « Babi » dans la piste montée, « maquis » est écrit « maki » dans la prise seule (prononcé « maki », comme en Côte d'Ivoire).

**Version courte (26,4 s, TikTok/Reels)** : survol + accroche (n1) → construire et le maquis qui sort de terre (n3) → le marché et le maquis le soir (n5) → « Aménager » (n6) → carte des testeurs (n8, n9, 8,5 s).
