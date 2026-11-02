# « Les histoires se racontent » (FILM=histoires)

80 s, vertical (1080 × 1920), pour TikTok. Awa présente la nouveauté : les histoires du quartier, et leurs prologues **lus à voix haute** dans le jeu, avec des émotions. Elle parle avec la voix de Lea (ElevenLabs, Eleven v4), la même voix qui lit les prologues dans le jeu : c'est donc Awa qui « te raconte tout ».

## Le déroulé

| Temps | Plan | Ce qu'on entend |
| --- | --- | --- |
| 0 – 6,4 s | Le salon d'Awa, « Nouveau dans Babi Life : les histoires se racontent 🔊 » | « La famille ! C'est Awa ! Y a du nouveau dans Babi Life… et ça là, c'est fort ! » |
| 6,4 – 13,4 s | Le grin. Le téléphone : l'appli Demandes, « Le petit-fils du vieux Koné », chapitre 1, puis « Le lendemain… » chapitre 2 | « Les histoires du quartier : chaque jour, quelqu'un vient te voir avec son histoire… et le lendemain, il revient avec la suite ! » |
| 13,4 – 19 s | Le doigt appuie sur « Écouter », qui devient « Arrêter » | « Et maintenant, tu appuies sur Écouter… et je te raconte tout. Écoute ça… » |
| 19 – 25,3 s | **La cour hantée**, la nuit, ses mots allumés un à un | Le prologue tel que le jeu le lit : « Il se passe des choses la nuit : des pas sur le toit, des pleurs dans la chambre vide que personne ne veut louer. » |
| 25,3 – 30,3 s | Le maquis | « Y a des histoires qui font peur… et d'autres qui font rire ! » |
| 30,3 – 38,2 s | **Le défi de la Dent de Man** | « Boris se dit coach sportif sur Gbairai, avec des photos de lui torse nu. En vrai, il n'a pas couru depuis des années ! » |
| 38,2 – 40,9 s | Le vieux sous l'arbre | « Des histoires qui touchent le cœur… » |
| 40,9 – 48,2 s | **Le petit-fils du vieux Koné** | « Son petit-fils, parti en France tout bébé, revient le voir pour la première fois. Et le vieux a peur… de ne pas être à la hauteur. » |
| 48,2 – 51,7 s | La rue la nuit | « Et des mystères… de sorcellerie ! » |
| 51,7 – 57,1 s | **Le maquis maudit**, « TRAVAILLÉ » en rouge | « Un mot circule de bouche à oreille… travaillé. Quelqu'un aurait jeté un sort au maquis. » |
| 57,1 – 61,5 s | « 25 histoires », le choix parmi trois, « C'est parti ! » | « Vingt-cinq histoires ! Et c'est toi qui choisis la prochaine, parmi trois. » |
| 61,5 – 66,4 s | La carte : Abidjan → Man, Yamoussoukro, San-Pédro | « Certaines t'emmènent en voyage : Man, Yamoussoukro, San-Pédro… » |
| 66,4 – 69,9 s | +2 000 Djai, les pièces qui tombent | « Et chaque chapitre te rapporte jusqu'à deux mille Djai ! » |
| 69,9 – 74,6 s | Le salon, les commentaires qui arrivent | « Alors, tu commences par laquelle ? Dis-moi en commentaire ! Allez, à toi de jouer ! » |
| 74,6 – 80,6 s | La fin : « Les histoires se racontent 🔊 », Joue maintenant, le QR code | La musique |

## Comment c'est fait

- `histoires-voix.mjs` : les répliques d'Awa (le texte, avec les émotions pour la voix, est dans le fichier), une par MP3 dans `out/voix-histoires/`.
- `histoires-son.py` : met bout à bout les répliques et les extraits des quatre prologues (`web/public/audio/histoires/`, coupés entre deux mots), écrit `out/voix-histoires.mp3`, fait la musique dessous (`out/son-histoires.mp3` : un groove doux au balafon sous Awa, un bourdon sombre pendant les histoires, un souffle à chaque coupe) et donne les temps de chaque morceau, que suit `FILMS.histoires` dans `web/src/lab/poster.tsx`.
- `web/src/lab/histoiresFilm.tsx` : ce qui est dessiné par-dessus les scènes (le téléphone comme dans le jeu, les mots des prologues allumés au moment où ils sont dits, la carte, les Djai, les commentaires). Les temps des mots viennent de la transcription d'ElevenLabs (Scribe).
- `FILM=histoires node video.mjs` : la vidéo, `out/babi-life-video-histoires-1080x1920.mp4`.

Avec d'autres répliques : refaire `histoires-voix.mjs --force`, puis `python3 histoires-son.py`, et reporter les nouveaux temps dans `FILMS.histoires` et `CAPS`.

## Légende pour TikTok

> Les histoires du quartier se racontent maintenant dans Babi Life 🔊📖 25 histoires : la cour hantée 😱, Boris et la Dent de Man 😂, le vieux Koné 🥹, le maquis « travaillé » 👀… Tu commences par laquelle ? Dis-moi en commentaire 👇🏾
>
> #babilife #abidjan #babi #cotedivoire #225 #jeuvideo #nouchi #histoire #gbairai
