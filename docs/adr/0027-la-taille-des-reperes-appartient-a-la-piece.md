# ADR-0027 — La taille des repères appartient à la pièce

- **Statut** : accepté
- **Date** : 2026-09-06

## Contexte

Le rayon du cercle qui désigne une minutie était décidé une seule fois, au clic, par une règle du
front : le plus grand côté de l'image multiplié par 0,015, avec un plancher. Il suivait donc le
nombre de pixels du fichier et non la densité des crêtes. Sur les quatre pièces annotées et
calibrées du dossier de démonstration, le même geste donne de 1,16 mm à 3,97 mm de peau couverte,
un facteur 3,4 ; sur la paume droite du mis en cause, le cercle enferme sept crêtes et le lecteur
du rapport ne peut plus dire laquelle porte la minutie.

Deux faits de la base cadrent la décision. Les soixante-neuf minuties se répartissent sur sept
pièces et **chaque pièce ne porte déjà qu'un seul rayon distinct** — 11, 12, 19, 38, 71, 83, 118 —
puisque la formule est déterministe par image : la taille est déjà une propriété de l'image, il
manquait seulement le moyen de la choisir. Et `resolutionDpi` n'est renseigné que sur quatorze
pièces sur six cent soixante-sept : le millimètre ne peut pas servir d'unité de stockage.

Corriger l'affichage en reprenant les minuties une par une était le seul chemin ouvert
aujourd'hui — il n'existe aucune route de lot. Douze `PUT /layers/:id` produisent douze
`LAYER_UPDATED`, que le rapport imprime « Minutie déplacée » quel que soit le champ touché et que
le résumé du journal recompte en minuties relevées. Une correction d'affichage écrirait une
fausseté dans un document scellé.

## Décision

**La taille des repères est un réglage de la pièce, pas une propriété de la minutie.** `Trace` et
`ReferencePrint` portent une colonne `markRadius Int?`, en pixels de l'image source, à côté de
`resolutionDpi` ; un value object aux bornes 2 et 2000 la garde, et deux routes
`PATCH …/:id/mark-radius` la règlent. La chaîne est celle de la calibration, recopiée : même
forme de commande, même `@CaseAdministration()`, même traduction d'erreurs au controller. La
différence est qu'ici la garde du dossier clos est posée dès l'écriture — recalibrer ou retailler
les repères d'un dossier déjà rapporté n'a pas de sens.

**Un seul acte pour toute l'image, et non un par minutie.** `MARK_RADIUS_SET` porte
`fingerprintId`, `markRadius` et `previousMarkRadius`, et le rapport de traçabilité en tire
« Taille des repères de <pièce> fixée à 36 pixels », puis « corrigée de 36 à 48 pixels ». Un acte
unique pour les deux natures de pièce : la règle de phrase sait déjà nommer une trace ou une
empreinte à partir de `fingerprintId`.

**La colonne reste nulle sur les pièces existantes, et la nullité signifie « personne n'a
réglé ».** L'atelier comme la planche du rapport retombent alors sur la règle d'aujourd'hui, donc
une pièce jamais réglée s'affiche et s'imprime exactement comme avant. Aucun rattrapage, aucun
`UPDATE` de migration.

**Le `settings.radius` de la minutie est conservé, et change de sens** : il n'est plus ce qui
gouverne le dessin, il devient la mémoire de ce qui a été dessiné le jour de la pose. Le ticket
1.1 de `ROADMAP-AUDIT-TRAIL-V2.md`, qui prescrivait sa suppression au motif que « le rayon
persisté n'apporte rien », est dépassé par ce mécanisme plutôt qu'exécuté : le champ reste
obligatoire dans les trois DTO d'annotation, le front continue de l'écrire, et aucun contrat
existant ne bouge.

**L'ADR-0006 du front n'est pas remplacé.** Sa décision centrale — une unité de scène pour un
pixel source, ce qui appartient à l'image grandit avec elle, ce qui appartient à l'outil se
divise par l'échelle — est intacte, et c'est elle qui rend le rayon en pixels source lisible de
part et d'autre. Seul son tiret qui fait dériver la taille des marqueurs du plus grand côté de la
source est amendé : cette dérivation n'est plus la valeur écrite en base, elle n'est plus que le
repli d'une pièce jamais réglée.

## Conséquences

- ✅ Un cercle peut enfin désigner un point sur une paume comme sur une trace, et le magistrat
  destinataire lit quelle crête porte la minutie.
- ✅ Le journal reçoit un acte par réglage au lieu de douze actes de déplacement, et sa phrase dit
  ce qui s'est passé au lieu de le travestir.
- ✅ Aucune fusion simultanée n'est requise : la route et la colonne peuvent partir seules, le
  front et le rapport les lisent ensuite chacun de son côté.
- ⚠️ Deux tailles cohabitent en base sur une pièce réglée — celle de la pièce, qui gouverne, et
  celle de chaque minutie, qui témoigne. Un lecteur du dump qui ignore l'ordre de préséance verra
  une contradiction là où il n'y a qu'une histoire.
- ⚠️ Le rayon reste en pixels source. Sur une pièce non calibrée, aucune conversion en millimètres
  n'est possible, et les crans du sélecteur s'y affichent sans repère physique.
- ⚠️ Le vrai facteur limitant des planches de grande dimension n'est pas traité ici : 7887 pixels
  de haut ramenés à 150 mm réduisent tout d'un facteur 0,019, et un cercle juste y devient un
  anneau d'un millimètre et demi. Recadrer la planche autour de la zone démontrée reste à
  instruire.
- ⚠️ La garde du dossier clos posée sur ces deux routes rend plus visible son absence sur les deux
  routes de calibration, qui écrivent la même famille de réglage.

## Alternatives écartées

- **Reprendre les minuties une par une** — douze appels, douze `LAYER_UPDATED` et un rapport
  scellé qui raconte des déplacements qui n'ont pas eu lieu. C'est l'écriture d'une fausseté pour
  une correction d'affichage.
- **Stocker la taille en millimètres de peau** — l'unité est juste, mais elle suppose une pièce
  calibrée, et quatorze pièces sur six cent soixante-sept le sont. Le millimètre reste une lecture
  d'appoint sous les crans du sélecteur, pas l'unité de stockage.
- **Garder le réglage côté front, dans le navigateur** — il ne suivrait ni le poste, ni le
  rapport, ni le second regard. Or c'est précisément la planche du rapport que ce chantier vise.
- **Un réglage par minutie** — la finesse ne sert à rien : la densité des crêtes est une propriété
  de l'image, pas du point. Et chaque minutie réglée serait un acte de plus au journal.
