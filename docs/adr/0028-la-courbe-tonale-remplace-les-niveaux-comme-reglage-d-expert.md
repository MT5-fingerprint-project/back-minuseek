# ADR-0028 — La courbe tonale remplace les niveaux comme réglage d'expert

- **Statut** : accepté
- **Date** : 2026-09-06

## Contexte

L'atelier propose trois réglages tonaux derrière le mode expertise : l'isolation des canaux, la
netteté locale et les niveaux — point noir, gamma, point blanc. Les trois curseurs des niveaux
balaient linéairement les 256 niveaux de l'image, sans rien montrer de leur répartition. Sur les
pièces du dossier de démonstration, cette répartition est très concentrée : la médiane d'une
empreinte livescan est à 250, celle d'une apposition simultanée à 252. Le curseur travaille donc
à vide sur presque toute sa course. Mesuré sur `mec_AD` en écart moyen par pixel et par pas de
dix crans, le point blanc ne change plus rien au-delà de 70 (0,0 à 0,1 niveau de gris par pas),
et le point noir ne fait presque rien avant 80 puis bascule tout entre 90 et 100 (141 niveaux
d'écart sur le dernier pas). Le gamma, borné à 2^±1, ne dépasse jamais 1,9 niveau d'écart sur ces
images.

Un opérateur qui ne voit pas l'histogramme ne peut pas savoir où se trouve la course utile de son
curseur : il pousse, il ne voit rien, il conclut que l'outil est cassé. Le problème n'est pas le
calcul, il est l'absence de repère.

## Décision

**Le comparateur reçoit une courbe tonale à points de contrôle libres, et c'est elle qui devient
le réglage d'expert ; les niveaux passent à tous les opérateurs.**

La courbe se règle dans un repère de 256 sur 256 où l'histogramme de la pièce est dessiné en
fond : l'opérateur pose ses points là où les pixels sont. Un clic ajoute un point, un
glisser-déposer le déplace, un double-clic le retire ; l'abscisse d'un point reste enfermée entre
celles de ses voisins, de sorte que la courbe reste une fonction. Entre deux points, l'interpolation
est une cubique monotone (Fritsch-Carlson) : une spline ordinaire déborderait et rendrait un niveau
sombre plus clair que son voisin. Au-delà du premier et du dernier point, la courbe se prolonge à
plat. Le résultat est cuit dans une table de 256 entrées appliquée aux trois canaux à l'identique.

Le réglage est **un calque comme les autres**, mais son `settings` porte `points` là où les autres
portent `value` : `{ filterKey: 'curve', points: [{ x, y }, …] }`, deux à seize points, entiers
bornés à 255. Le DTO HTTP est choisi sur la clé du filtre, le reste de la chaîne — création,
journalisation, ordre de la pile, masquage, suppression — ne change pas. Le rapport rejoue la même
table depuis les mêmes points, par une copie conforme de la fonction du front.

**La courbe est réservée à l'expertise, les niveaux ne le sont plus.** `EXPERT_FILTER_KEYS` perd
`levelsBlack`, `levelsGamma` et `levelsWhite`, et gagne `curve`. Un point noir et un point blanc
sont des réglages de lecture que tout opérateur doit pouvoir poser ; la courbe, elle, permet de
déformer le ton d'une zone précise de l'échelle, et cet acte-là engage la qualité d'expert.

Le catalogue des phrases du journal, qui ne couvrait que les six réglages ordinaires, couvre
désormais les treize réglages du comparateur plus la courbe. Un point noir s'énonce « Point noir
porté à 37 % » et non plus « Réglage d'affichage « levelsBlack » modifié » ; une courbe s'énonce
par ses points de contrôle — « Courbe tonale réglée sur 0 → 0, 90 → 170, 255 → 255 » — et par leur
nombre au-delà de cinq points, le détail restant dans le réglage enregistré avec l'acte.

## Conséquences

- ✅ L'opérateur voit enfin où sont ses pixels avant de les déplacer : le fond du repère est
  l'histogramme de la pièce, et la course utile saute aux yeux au lieu de se deviner.
- ✅ Une courbe à trois points fait en un geste ce que les trois curseurs des niveaux ne savent pas
  faire : relever les tons moyens sans toucher aux extrémités.
- ✅ Le journal dit ce qui a été fait pour les treize réglages, y compris les quatre réglages
  d'expert qui n'avaient aucune phrase et sortaient en clé technique dans le rapport de
  traçabilité.
- ⚠️ Les niveaux et la courbe se recouvrent : le gamma est une courbe à un paramètre, le point noir
  et le point blanc en sont les deux extrémités. Deux chemins mènent au même pixel, et le journal
  en gardera deux traces de forme différente.
- ⚠️ La formule vit en deux exemplaires, dans le comparateur et dans le rapport, comme les six
  autres filtres. Une retouche portée d'un seul côté ferait diverger la planche « après
  traitements » de ce que l'opérateur a vu, sans qu'aucun test ne l'attrape : les deux copies ne
  se comparent nulle part.
- ⚠️ Les calques `levelsBlack`, `levelsGamma` et `levelsWhite` déjà posés sur un dossier en
  expertise restent lisibles et rejoués à l'identique, mais leur pose n'est plus un acte réservé :
  la même clé raconte désormais deux régimes d'autorisation selon sa date.
- ⚠️ Le plafond de seize points est une borne de lisibilité du journal, pas une limite de calcul.
  Le comparateur cesse d'ajouter des points au seizième sans le dire.

## Alternatives écartées

- **Corriger la course des curseurs des niveaux** — les caler sur le minimum et le maximum de
  l'image rendrait le réglage dépendant du contenu, donc non reproductible d'une pièce à l'autre,
  et il faudrait quand même montrer l'histogramme pour que l'opérateur sache ce qu'il fait.
- **Une courbe à trois points fixes** (ombres, tons moyens, hautes lumières) — elle tenait dans le
  modèle existant, un nombre par calque, sans toucher au DTO. Mais elle impose ses abscisses, et
  c'est précisément le choix de l'abscisse — poser un point sur le pic de l'histogramme — qui fait
  l'outil.
- **Le tracé à main levée de GIMP** — le réglage devient un tableau de 256 valeurs, que le journal
  ne peut plus énoncer et que personne ne peut relire à l'audience.
- **Une courbe par canal (Valeur, R, V, B)** — quatre calques, quatre phrases et des onglets dans
  l'éditeur, sur des pièces quasi monochromes où l'isolation des canaux répond déjà au besoin.
- **Supprimer les niveaux** — ils sont posés sur des dossiers existants et rejoués par des rapports
  déjà scellés ; les retirer imposerait de décider du sort de ces calques sans rien apporter à
  l'opérateur.
