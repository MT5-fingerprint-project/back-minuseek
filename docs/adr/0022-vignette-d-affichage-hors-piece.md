# ADR-0022 — La vignette d'affichage est un artefact hors pièce, suffixé avant le point

- **Statut** : accepté
- **Date** : 2026-09-03

## Contexte

Les vues de liste servent les images de pièces à leur taille de dépôt. Une mesure du
carrousel de traces le chiffre : **92,3 Mo téléchargés pour des boîtes de 73 × 107 px
CSS**. Le tableau des traces (48 × 48), les emplacements d'empreintes de la fiche sujet
et la section des pièces retirées ont le même défaut. Ce n'est pas GCS qui est lent,
c'est le volume envoyé.

Aucun des leviers habituels n'est disponible ici. Les images sont des données
biométriques dans un bucket privé, servies par **URL signée V4** (ADR-0002, ADR-0003) :
il n'y a pas de transformation à la lecture, et le back ne streame pas les octets. Et
les pixels servis au comparateur ne se négocient pas : ils sont scellés
(`displayableSha256`), imprimés dans les rapports et comparés par data-minuseek.

Il faut donc **une seconde image**, produite une fois, à côté de la première.

## Décision

**Le dépôt fabrique une variante d'affichage réduite, et cette variante n'est pas une
pièce.** Elle est encodée en WebP, bornée à **640 px sur le grand côté**, ratio préservé,
jamais agrandie. Elle n'est ni hachée, ni scellée, ni journalisée : aucun acte du
catalogue ne la mentionne, et rien dans la chaîne d'audit n'en dépend. Le canevas de
comparaison, l'export et les rapports continuent de lire les pixels source.

**Le suffixe se pose AVANT le point : `<cheminSansExtension>_thumb.webp`.** C'est une
contrainte inter-dépôts, non négociable : `data-minuseek`
(`src/repositories/image_repository.py`) résout la pièce à comparer en listant le préfixe
`media/investigation-case/{caseId}/{folder}/{id}.` et prend **le premier blob**. Un
`{id}.thumb.webp` entrerait dans ce préfixe et ferait comparer une vignette de 640 px,
puis sceller le score obtenu sur elle. Le nommage ne peut donc pas être « harmonisé » d'un
seul côté ; il se change dans les deux dépôts, à la même heure, ou pas du tout.

**Le chemin de la vignette est une colonne, pas une convention devinée.** `thumbPath
String?` sur `Trace`, `ReferencePrint` et `TraceLocationPhoto` (migration additive
`20260902231010_add_image_thumb_path`). La colonne est nullable parce que la fabrication
est faillible, et son absence est l'information : une ligne à `thumbPath` vide dit qu'il
n'y a rien à servir.

**Le contrat rendu au front est figé : `thumbUrl: string | null`,** à côté de `url`,
signée de la même façon et pour la même durée, sur les dépôts comme sur les lectures
(`GET /traces`, `GET /traces/:id`, `GET /reference-prints`). Le front affiche `thumbUrl`
et **retombe sur `url`** quand elle est nulle.

**Un échec de vignette ne refuse jamais une pièce.** La fabrication est *best-effort* :
l'erreur est journalisée en `warn` — comme l'ancrage TSA et la projection des scellés — et
le dépôt se termine normalement, colonne vide. Le rattrapage est un script exposé en
`make backfill-thumbnails TENANT_DB=…`, rejouable.

**La destruction d'une image emporte sa vignette.** L'objet est supprimé **par la
convention de nommage** et non par la colonne — si un rattrapage meurt entre le stockage de
la vignette et l'écriture de la colonne, le bucket doit quand même être nettoyé — **et** la
colonne est effacée par le domaine (`ReferencePrint.markImageDestroyed`), pour qu'aucun
lecteur ne puisse signer une URL sur un objet détruit en oubliant la garde.

## Conséquences

- ✅ Les vues de liste téléchargent une fraction de ce qu'elles téléchargeaient : sur une
  boîte de 73 × 107 px, la mesure donne trois ordres de grandeur d'écart avec l'original.
- ✅ Rien ne change dans la chaîne de preuve : aucun nouvel artefact scellé, aucun type
  d'acte ajouté, les pixels comparés et imprimés sont les mêmes qu'avant.
- ✅ Une ligne ancienne, ou une vignette que le dépôt n'a pas su fabriquer, s'affiche
  toujours : le repli sur `url` est le comportement d'avant.
- ⚠️ La vignette n'est pas scellée : elle peut être remplacée dans le bucket sans laisser
  de trace. Elle ne doit donc jamais être servie comme une pièce, ni imprimée dans un
  rapport, ni comparée.
- ⚠️ Le décodage sharp au dépôt coûte de la mémoire, sur un back de prod encore à 512 Mi.
  C'est une note d'exploitation, pas un blocage : le dev est déjà à 4 Gi.
- ⚠️ Le couplage `_thumb.webp` avec data-minuseek n'est tenu que par cet ADR, un test et un
  commentaire. Aucun mécanisme n'empêche un renommage unilatéral.
- ⚠️ `thumbPath` sort dans les réponses HTTP au même titre que `path` : c'est le ménage
  global déjà connu sur `path`, pas une fuite nouvelle.
- ⚠️ 640 px est dimensionné sur les consommateurs d'aujourd'hui. Une vue plus grande
  demanderait une nouvelle valeur **et** un nouveau rattrapage sur les images déjà déposées.

## Alternatives écartées

- **Un proxy de transformation devant le bucket** (CDN, service d'images, route back qui
  redimensionne à la volée) — déjà écarté par ADR-0002 (le back ne sert pas les octets) et
  ADR-0010 : un composant de plus à autoriser sur de la biométrie, incompatible avec l'URL
  signée keyless, et un coût CPU répété à chaque affichage.
- **Fail-closed au dépôt** (refuser la pièce si la vignette échoue) — une pièce de
  procédure ne peut pas être refusée pour un artefact décoratif ; l'indisponibilité de
  sharp ou du préfixe deviendrait une panne de dépôt.
- **`{id}.thumb.webp`, plus lisible** — ferait comparer la vignette par data-minuseek.
- **Redimensionner dans le navigateur** — il faut avoir téléchargé les octets pour les
  réduire, or ce téléchargement est précisément le coût qu'on supprime.
- **Stocker la vignette sans colonne, retrouvée par convention** — obligerait à interroger
  le bucket avant chaque affichage pour savoir si elle existe.
- **Sceller la vignette comme une pièce** — alourdirait la chaîne et le registre des
  scellés pour un fichier que personne n'oppose à personne.
