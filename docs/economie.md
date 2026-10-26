# L'économie du Djai

Le Djai (affiché « F » dans le jeu) se gagne en jouant, et il s'achète aussi avec de l'argent réel dans la Boutique (`backend/internal/shop/shop.go`, GeniusPay). Ce document est **la référence** pour régler l'économie : chaque chiffre du jeu qui touche à l'argent gagné en jouant y est, avec la raison. Les nombres eux-mêmes sont dans le code, à un seul endroit par sujet :

- les **plafonds du jour** (par source, par compte) : `backend/internal/game/money.go` (`Caps`, `DailyTotal`, `NewAccountHold`, `WindfallChance`) ;
- les **salaires** des métiers, les **loyers**, l'argent de départ : `backend/internal/game/economy.go` (`Careers`, `Housings`) et `backend/internal/game/life.go` (`Families`) ;
- les **petits boulots** et les **surprises** : `backend/internal/game/catalog.go` ;
- la **politique** : `backend/internal/politics/politics.go` (`Pay*`, cautions, campagne) ;
- les **réseaux** : `backend/internal/sims/tikitoko.go` (`TikiDeal*`, `TikiPaidPerDay`) ;
- les **paris** : `backend/internal/game/betting.go` (`Margin`, `price`) et `backend/internal/sims/bets.go` (`BoostMinOdds`).

Le test `backend/internal/sims/economy_test.go` vérifie les objectifs ci-dessous et affiche les totaux (`go test ./internal/sims/ -run 'TestFirstWeek|TestGrinderDay' -v`). `backend/internal/game/money_test.go` vérifie les plafonds, la rareté des coups de chance et la marge des paris et du loto.

## Le prix du Djai

| Pack | Prix | Djai | Djai par franc réel |
| --- | ---: | ---: | ---: |
| La pièce | 500 FCFA | 40 000 | 80 |
| Le gombo | 1 000 FCFA | 90 000 | 90 |
| Le djossi | 2 500 FCFA | 240 000 | 96 |
| Le boss | 5 000 FCFA | 520 000 | 104 |
| Le grotto | 10 000 FCFA | 1 120 000 | 112 |

Dans tout ce document, « ≈ X FCFA » est au prix de la pièce (80 Djai le franc, ce que paie celui qui achète pour la première fois) : 1 000 Djai ≈ 12,5 FCFA, 40 000 Djai = 500 FCFA. Au prix du grotto, divise par 1,4.

## Le temps du jeu

Une minute du jeu est une minute réelle, mais une action est raccourcie (`game.Length`) : une douche dure 2 min, un service de 8 h dure 15 min, un petit boulot de 4 h dure 10 min. Le loyer tombe chaque samedi réel. Quand l'appli est fermée, le perso ne vit pas (`sims/clock.go`, `hold`) : rien n'est gagné ni dépensé, sauf le loyer (voir plus bas).

## Avant : d'où venait l'argent (audit du 24 octobre 2026)

« Par heure » : en jouant sans arrêt cette source, la meilleure façon. « Par jour » : sur une journée réelle, dans les heures où c'est possible.

| Source | Où dans le code | Par heure de jeu | Par jour réel | ≈ FCFA par jour |
| --- | --- | ---: | ---: | ---: |
| Services au travail, sans limite (15 min le service, recommencé tant que c'est l'heure) | `game/economy.go`, `sims/clock.go` | stagiaire de bureau 24 000 ; PDG 280 000 | stagiaire 96 000 (de 7 h à 11 h) ; aide-soignant·e 336 000 avec « aller au travail tout seul » (de 6 h à 20 h) ; PDG 1 120 000 | 1 200 à 14 000 |
| Pourboires au travail | `game/jobs.go`, `sims/jobs.go` | ≈ 2 400 | ≈ 20 000 | 250 |
| Petits boulots (vendre au marché 4 000, manœuvre 7 000, attiéké 3 000) | `game/catalog.go` | 24 000 à 30 000 | ≈ 290 000 (de 6 h à 18 h) | 3 600 |
| Défis (le score vient du téléphone : un faux 100 gagne toujours) | `sims/defi.go` | défi à la console +8 000 ; tournoi du samedi +36 000 | ≈ 100 000 ; 216 000 le samedi | 1 250 à 2 700 |
| Surprises qui donnent de l'argent (35 % des actions, même de 2 min ; prime de 10 000 au bureau) | `game/realtime.go`, `game/catalog.go` | ≈ 4 900 (lire les offres d'emploi en boucle au bureau) | ≈ 50 000 | 600 |
| Demander un petit djai, un petit boulot, aider un passant (un nouveau passant à chaque fois) | `sims/chat.go` | ≈ 26 000 | ≈ 300 000 | 3 750 |
| Le coup de la bande (5 000 à 19 000) | `game/social.go`, `sims/social.go` | ≈ 50 000 (casier vierge) | ≈ 150 000 avant d'être trop connu·e | 1 900 |
| Tikitoko : les marques (un quart du nombre d'abonnés par vidéo, jusqu'à 100 000, 10 vidéos payées par jour) | `sims/tikitoko.go` | — | 50 000 à 20 000 abonnés ; jusqu'à 1 000 000 | 600 à 12 500 |
| Dames et 8 américain contre les joueurs du jeu (mise jusqu'à 5 000, le pot jusqu'à 20 000) | `sims/dames.go`, `sims/huit.go` | ≈ 30 000 pour un bon joueur | ≈ 150 000 | 1 900 |
| Politique (par jour réel) | `politics/politics.go` | — | président·e 150 000, ministre 60 000, député·e 40 000, maire 50 000 | 500 à 1 900 |
| Paris combinés « boostés » de favoris (cote plancher 1,05) | `game/betting.go`, `sims/bets.go` | — | ≈ 1,17 rendu pour 1 misé : une source, pas une perte | — |
| Argent de la famille à 18 ans (une fois) | `game/life.go` | — | debout 790 000 (départ, bac, argent de poche) ; gnambro 5 000 | 62 à 9 900 |

Les **transferts entre joueurs** (Waye, la mise des parties entre amis jusqu'à 50 000, une maison louée sur Dodo jusqu'à 500 000 la nuit) n'avaient ni plafond ni délai : un compte créé pour farmer pouvait tout envoyer au compte principal.

Le **loyer** ne tombait que si le perso vivait à minuit le samedi : appli fermée ce soir-là (le cas de presque tout le monde), pas de loyer du tout.

Conclusion : n'importe qui pouvait gagner en une journée plus que le plus gros pack (1 120 000 Djai). La Boutique ne servait à rien.

## Les objectifs choisis

1. **Une heure par jour paie un loyer modeste et la nourriture, à peine plus.** Un studio (15 000 la semaine) et un garba par jour (500) : 18 500 par semaine, ≈ 2 650 par jour. Une heure tranquille (le service, un petit boulot, un repas) rapporte 3 100 par jour, soit 1,2 fois cela. On s'en sort, on met un peu de côté, sans plus.
2. **Une journée réelle ne rapporte jamais plus que la moitié de la pièce.** 20 000 Djai gagnés en jouant au plus par jour (`DailyTotal`), toutes sources ensemble, sauf le service qui n'est jamais coupé (au plus 11 200 tout en haut de l'échelle). Avec le Babi Pass, un quart de plus partout (25 000).
3. **Le grind ne paie pas.** Chaque source a son plafond du jour, par compte (tous ses persos ensemble), et ce qui est refusé est dit dans le journal : « Plus de petit boulot aujourd'hui : reviens demain. »
4. **La chance est rare et petite.** Un coup de chance qui donne de l'argent n'arrive qu'une fois sur trois quand il est tiré (`WindfallChance`), et au plus 1 000 par jour.
5. **Les paris et le loto reprennent plus qu'ils ne donnent**, sur la durée, même en choisissant les meilleures cotes.
6. **Un joueur gratuit atteint tout, plus lentement.** Acheter des Djai achète du confort et de la vitesse (une plus belle maison plus tôt, une voiture, le Pass, la couronne, une campagne électorale), jamais quelque chose d'inaccessible sans payer.
7. **La première semaine reste jouable** pour toutes les familles : l'argent donné à 18 ans et deux services du métier le moins payé paient le premier loyer et la nourriture.

## Après : ce que rapporte chaque source

| Source | Ce qui a changé | Par heure de jeu | Par jour réel (sans Pass) | ≈ FCFA par jour |
| --- | --- | ---: | ---: | ---: |
| Service au travail | **un service payé par jour et par compte** (même avec « aller au travail tout seul »), salaires divisés selon l'échelon (×0,42 en bas, ×0,15 tout en haut) | — | 1 500 à 2 500 au début ; 5 200 à 11 200 en haut | 19 à 140 |
| Petits boulots | vendre au marché 1 200, manœuvre 1 800, attiéké 1 000 ; refusés une fois le plafond atteint | 1 200 à 1 800 | **2 000** | 25 |
| Pourboires | plafond | — | **800** | 10 |
| Défis | seul le gain au-dessus de ce qui a été payé compte | — | **1 000** | 12 |
| Tournoi du samedi | un par jour ; la coupe 2 000, la finale 800 (l'entrée 1 000) | — | **2 000** (le samedi) | 25 |
| Dames, 8 américain contre le jeu | mise 2 000 au plus ; le gain plafonné | — | **1 500** | 19 |
| Chance (surprises, demander un petit djai, aider un passant, la prime) | rare, montants divisés par 2 à 10 | — | **1 000** | 12 |
| Le coup de la bande | **un par jour**, 2 000 à 6 000, risque inchangé | — | ≤ 6 000 | 75 |
| Tikitoko | 200 + 1 par 100 abonnés, 1 500 au plus par vidéo, 3 vidéos payées par jour | — | **2 000** | 25 |
| Total gagné en jouant, hors service | | | **20 000** au plus | 250 |
| Politique | président·e 20 000, ministre 8 000, député·e 5 000, maire 6 000 par jour (hors plafond : un poste se gagne aux élections, chaque semaine) | — | 5 000 à 20 000 | 60 à 250 |

Ce que le test mesure (`TestFirstWeek`, `TestGrinderDay`) :

| Joueur | Avant | Après |
| --- | ---: | ---: |
| Une heure tranquille par jour (le service, un petit boulot, un garba), au début | ≈ 8 500 par jour | **3 100 par jour** (21 700 la semaine), loyer payé |
| Une journée entière à tout essayer, en haut de l'échelle (avocat·e ténor du barreau) | plus d'un million | **17 200** (le service 11 200, le reste 6 000) ; 20 700 avec le Pass |
| Paris combinés boostés des cotes les plus courtes | 1,17 rendu pour 1 misé | **0,65 à 0,85** |

À ce rythme, une heure tranquille par jour fait la pièce (40 000) en 13 jours ; le joueur le plus acharné, en deux à trois jours. Acheter fait gagner du temps, jamais quelque chose d'impossible.

## L'argent de départ (à 18 ans, une fois)

| Famille | Avant (départ + bac + argent de poche) | Après | Premier logement (loyer de la semaine) |
| --- | ---: | ---: | --- |
| Debout | 500 000 + 200 000 + 90 000 | 150 000 + 50 000 + 18 000 | villa (75 000) |
| Laté | 200 000 + 100 000 + 45 000 | 70 000 + 25 000 + 12 000 | appartement (30 000) |
| Lagnon | 100 000 + 50 000 + 24 000 | 45 000 + 15 000 + 7 500 | appartement (30 000) |
| Poignon | 60 000 + 30 000 + 15 000 | 30 000 + 10 000 + 4 500 | studio (15 000) |
| Coulé | 20 000 + 10 000 + 3 000 | 15 000 + 5 000 + 1 500 | entrer-coucher (7 000) |
| Gnambro | 5 000 | 8 000 | entrer-coucher (7 000) |

L'argent de poche : un cinquième de la somme de la semaine à chaque anniversaire, de 3 à 17 ans. Un enfant de debout tient environ trois semaines dans sa villa avant de devoir travailler dur, déménager ou acheter des Djai : c'est l'histoire de l'enfant de riche.

## Où part l'argent

| Dépense | Montant | ≈ FCFA |
| --- | ---: | ---: |
| Loyer par semaine : entrer-coucher, studio, appartement, villa | 7 000 ; 15 000 ; 30 000 ; 75 000 | 90 ; 190 ; 375 ; 940 |
| Caution en déménageant | 2 semaines de loyer | |
| Microcrédit (anciens persos) | 10 000 par semaine | 125 |
| Manger : alloco, garba, cuisiner chez soi, poulet braisé, supermarché | 300 ; 500 ; 1 500 ; 3 500 ; 8 000 | 4 à 100 |
| Woro-woro dans Abidjan ; car vers Bouaké, Korhogo ; l'avion | 400 à 500 ; 9 500, 16 000 ; à partir de 30 000 | 5 ; 120, 200 ; 375 |
| Cinéma (salle, VIP) | 4 500 ; 10 000 | 56 ; 125 |
| Hôtel, la nuit (3 étoiles ; Azalé ; Poulman ; Noum) | 35 000 ; 60 000 ; 85 000 ; 110 000 | 440 à 1 375 |
| Émote | 1 000 | 12 |
| Soirée chez soi (`game/soiree.go`, payée par l'hôte, 3 h) ; un verre au bar, les billets lancés au DJ | 5 000 ; 1 000, 5 000 | 62 ; 12, 62 |
| L'atalaku qui crie ton nom (boîte, soirée) ; la bouteille au carré VIP d'une soirée | 2 000 ; 20 000 | 25 ; 250 |
| Marchés : pagnes du Grand Marché de Treichville, mèches du marché de Cocody | 6 000 ; 5 000 | 75 ; 62 |
| Véhicule (vélo, moto, citadine, limousine) | 28 000 ; 320 000 ; 1 800 000 ; 32 000 000 | 350 à 400 000 |
| Terrain (au m², frais de 10 % en plus ; 300 m² à Yopougon) | 700 à 6 000 ; 495 000 | 6 200 |
| Politique : parti, caution présidentielle, caution de maire, gang, campagne | 50 000 ; 200 000 ; 50 000 ; 30 000 ; 20 000 à 150 000 l'action | 625 à 2 500 |
| Sectes : initiation, cotisation du lundi | 10 000 à 30 000 ; 2 000 à 7 000 | |
| Paris (marge 6 à 8 %) ; loto (rend 83 %, 62 % ou 21 % selon 1, 2 ou 3 numéros) | | |
| Machines à sous (`game/slots.go`) : maquis 100 à 500 le tour (tout montant entre les deux), casino de l'Hôtel Ivoire 500 à 2 000 ; elles rendent environ 89 % des mises sur la durée (`SlotsReturn`, vérifié par son test), un tour sur trois gagne quelque chose | | |
| Babi Bingo (`game/bingo.go`) : 100 à 1 000 le carton, 4 cartons par partie ; chaque salle rend environ 85 % des mises (`BingoReturn`, vérifié par son test : entre 80 et 90 %), un carton sur quatre ou cinq gagne quelque chose | | |
| Babi Casino (`game/casino.go`) : roulette (jetons de 100 à 5 000, tapés ou de 100 à 2 000 en un geste, 5 000 par tour au plus ; rend 36/37), le 21 (100 à 5 000 ; ≈ 98 % bien joué), tickets à gratter (200, 500, 1 000 ; rendent 62 à 66 %) | | |
| L'Envol (`game/envol.go`) : 100 à 5 000 la mise, un envol toutes les 40 s ; rend 95 % quel que soit le moment où l'on encaisse (`EnvolReturn`, vérifié par son test) | | |
| Babi Trade (`game/envol.go`) : 100 à 5 000 le pari, 3 ouverts au plus ; juste 1,85 fois la mise, rend 92,5 % (les cours sont un hasard sans tendance, vérifié par son test) | | |

Un mandat de président·e rapporte 140 000 pour 200 000 de caution et une campagne : c'est un honneur qu'on se paie, pas un métier.

## Les plafonds du jour (`game/money.go`, `Caps`)

Par compte (tous ses persos ensemble), de minuit à minuit à Abidjan. Le Babi Pass ajoute un quart aux plafonds en Djai, comme à ce qu'on gagne.

| Source (`Income`) | Plafond | Ce que dit le jeu quand c'est atteint |
| --- | --- | --- |
| `travail` | 1 service | « Tu as déjà fait ta journée de travail aujourd'hui : reviens demain. » |
| `boulot` | 2 000 | « Plus de petit boulot aujourd'hui : reviens demain. » |
| `pourboire` | 800 | « Plus de pourboire aujourd'hui. » |
| `defi` | 1 000 | « Les gars du quartier ne misent plus contre toi aujourd'hui : reviens demain. » |
| `tournoi` | 1 tournoi, 2 000 | « Tu as déjà joué le tournoi aujourd'hui. » |
| `jeux` | 1 500 | « Plus personne ne veut jouer de l'argent contre toi aujourd'hui : reviens demain. » |
| `chance` | 1 000 | (une autre surprise arrive à la place) |
| `coup` | 1 coup | « La bande a déjà fait un coup aujourd'hui : faites-vous oublier jusqu'à demain. » |
| `reseaux` | 2 000 | « Les marques ne paient plus de vidéo aujourd'hui : reviens demain. » |
| `total` | 20 000 | « Tu as assez gagné pour aujourd'hui : reviens demain. » |
| `recu` (d'autres joueurs) | 20 000 | « Son Waye ne peut plus rien recevoir aujourd'hui (20 000 Djai par jour). » |
| `envoye` (à d'autres joueurs) | 20 000 | « Waye : 20 000 Djai envoyés aux joueurs par jour, pas plus. Reviens demain. » |
| `location` (Dodo, chez un joueur) | 250 000 | « L'hôte ne peut plus être payé sur Dodo aujourd'hui : réessaie demain. » |
| `machine` (les tours de machine à sous) | 200 tours | « Assez de machine à sous pour aujourd'hui : reviens demain. » Ce qu'elles paient n'est pas compté comme gagné (comme les paris, ce sont les mises qui reviennent, moins l'avantage de la maison). |
| `bingo` (les cartons de bingo) | 120 cartons | « Assez de cartons de bingo pour aujourd'hui : reviens demain. » Ce qu'ils paient n'est pas compté comme gagné, comme les paris. |
| `casino` (les tours de Babi Casino : un tour de roue, une main, un ticket, une mise à L'Envol, un pari à Babi Trade) | 300 tours | « Le casino ferme pour toi aujourd'hui : reviens demain. » Ce qu'ils paient n'est pas compté comme gagné. |

Les comptes sont gardés dans la table `earnings` (migration `059_earnings.sql`), lus avec le perso et enregistrés avec lui dans la même transaction (`sims/money.go`). La synchronisation hors ligne (`sims/sync.go`) rejoue les actions par les mêmes fonctions : elle compte pareil, et un téléphone qui ment sur l'heure ne crée pas de jour en plus (le temps est borné entre la dernière fois que le serveur l'a entendu et maintenant). L'appli Boulot montre la journée (le service fait ou pas, les petits boulots, le total), envoyée par le serveur avec le perso (`today`).

## Contre les abus

- **Un service par jour et par compte**, compté au début du service (un service arrêté en route est payé au prorata, mais compte).
- **Les comptes neufs ne passent pas leurs Djai** : pas d'envoi Waye à un joueur, pas de mise contre un joueur, pas de réservation chez un joueur avant 7 jours de compte (`NewAccountHold`). Un perso à qui la boîte à outils des testeurs a donné de l'argent (`sims.tested`) ne peut jamais rien passer aux autres.
- **Entre joueurs, 20 000 par jour** envoyés et reçus, et les frais Waye (1 %). Mises entre amis : 10 000 au plus. Nuit sur Dodo : 60 000 au plus.
- **Le score des défis vient du téléphone** : seul le gain au-dessus de la mise compte, dans un petit plafond. Un faux score rapporte au plus 1 000 par jour.
- **Les surprises qui remboursent une activité payée** (la tontine qu'on ramasse, au plus 5 fois la cotisation) ne passent pas par le plafond de chance, car leur rareté les garde loin en dessous de ce qu'on a payé.
- **Paris** : la cote ne descend plus sous 1,00 (avant, 1,05 : un favori sûr à 94 % rendait presque sa mise, et huit d'entre eux boostés rendaient 1,17) ; le boost des combinés ne compte que les matchs à 1,30 ou plus.
- **Le loyer tombe même appli fermée** : si un samedi est passé pendant l'absence, le propriétaire passe une fois (loyer et microcrédit), une seule fois quelle que soit la durée de l'absence.
- La boîte à outils des testeurs (`sims/tester.go`) n'est ouverte qu'aux comptes testeurs ou avec le code des testeurs, que seule l'équipe a.

## Ce qui reste ouvert

- **Plusieurs comptes** : une personne avec dix comptes de plus de 7 jours peut toujours faire passer 20 000 par compte et par jour. On ne peut pas faire mieux sans vérifier l'identité (le numéro de téléphone, par exemple).
- **Deux persos du même compte joués au même instant** peuvent dépasser un plafond d'une action (les compteurs sont additionnés, pas verrouillés, pour garder une seule requête à la base par action).
- **Les anciens persos** créés avant les familles gardent leur argent de départ d'avant (« Enfant de riche » 200 000) ; personne n'en crée plus.
- **L'argent déjà gagné** avant ce changement reste aux joueurs (pas de remise à zéro) ; la liste d'attente n'est pas encore ouverte, donc il n'y a que les testeurs.
- Les **prix des packs** ne sont pas touchés. À revoir avec les vrais chiffres de vente : si personne n'achète la pièce, baisser un peu `DailyTotal` ou les plafonds par source ; si les joueurs gratuits partent, monter les salaires du bas de l'échelle d'abord.
