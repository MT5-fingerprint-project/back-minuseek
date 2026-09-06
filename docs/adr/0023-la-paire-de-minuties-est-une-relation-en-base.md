# ADR-0023 — La paire de minuties est une relation en base, et son numéro n'est jamais stocké

- **Statut** : accepté
- **Date** : 2026-09-03

## Contexte

Le mode démonstration du comparateur laisse l'opérateur apparier une minutie de la trace
avec sa correspondante sur l'empreinte de référence. Chaque paire porte un numéro affiché
des deux côtés, et c'est cette numérotation que la planche de démonstration de l'annexe B
imprime : sans elle, la planche est une juxtaposition d'images, pas une démonstration.

La première implémentation rangeait la paire dans la table `Layer`, en calque `ANNOTATION`
posé sur la trace, dont le JSON `settings` citait deux autres calques par identifiant.
`Layer.fingerprintId` n'a aucune relation et les deux identifiants de minuties dormaient
dans un JSON opaque : ni clé étrangère, ni cascade, ni contrôle d'existence. Supprimer une
minutie ne supprimait donc pas la paire, elle l'amputait. Trois symptômes en découlaient,
tous la même cause : le badge survivait du côté resté en place, le numéro retiré restait
consommé — la série sautait le 3 et la paire suivante prenait le 14 — et la donnée
persistée référençait un calque disparu, prête à être imprimée le jour où le rapport
cesserait de renvoyer `minutiaPairs: []`.

Un appariement n'est pas une annotation. C'est une **arête** entre deux minuties, et la vie
d'une arête dépend de celle de ses deux extrémités. Aucune discipline applicative ne
remplace cette dépendance : elle se déclare, ou elle n'existe pas.

## Décision

**La paire devient une table, `MinutiaPair`, dont les deux clés étrangères pointent vers
`Layer(id)` en `ON DELETE CASCADE`.** Supprimer une minutie emporte mécaniquement ses
paires, quel que soit le chemin emprunté — la touche Suppr, le panneau de calques, un
script, un `psql`. L'invariant est porté par le schéma, pas par les trois handlers qui
suppriment aujourd'hui, ni par ceux qui existeront demain.

**Les minuties, elles, restent des calques.** La cible de clé étrangère dont on avait
besoin, `Layer.id`, existe déjà. Sortir les minuties de `Layer` aurait rouvert
`countMinutiae` — donc le seuil des douze, donc la déclaration de hit, donc l'annexe B
elle-même — et toute la narration du journal de traçabilité, qui raconte les minuties à
travers `LAYER_CREATED` / `LAYER_UPDATED` / `LAYER_DELETED`. Ce chantier-là se fera peut-être,
mais pas au prix de ce qui est déjà démontrable.

**Les deux contraintes d'unicité portent sur un couple, pas sur une colonne** :
`@@unique([traceMinutiaLayerId, referencePrintId])` et `@@unique([referenceMinutiaLayerId,
traceId])`. Une minutie de trace peut donc être appariée à deux empreintes différentes,
parce que `hit.prisma` prévoit déjà plusieurs hits par trace et que l'annexe B produit une
planche par hit. Fermer cet usage aurait été une régression contre du code livré.

**Le numéro n'existe nulle part.** Pas de colonne, pas de champ de DTO, pas de valeur
persistée. Il est dérivé par `numberMinutiaPairs` — ordre total `createdAt` croissant puis
`id` croissant, `number = index + 1` — dans `shared/domain/forensics/`, et cette unique
implémentation est appelée aussi bien par la query qui sert le comparateur que par le
lecteur de données du rapport. Un trou dans la série n'est pas corrigé : il est
inexprimable. Et l'écran et la planche ne peuvent pas diverger, puisqu'ils comptent avec la
même fonction. `annex-b.ts` cesse de renuméroter pour son compte.

**Le rapport désigne les minuties par identifiant, plus par rang.** Un rang est une position
dans une liste : la première suppression de minutie décalait silencieusement toutes les
paires vers d'autres points, et la planche imprimait le décalage sans erreur, sous une
légende qui affirme la correspondance. `MinutiaPairData` cite désormais les deux
`layerId`, et `MinutiaData` porte le sien.

**Les deux minuties d'une paire ont le même type, arbitré en quatre branches**
(`resolvePairType`). Deux types déterminés égaux : on apparie. Deux indéterminées : on
apparie sans qualifier. Un déterminé face à une indéterminée : la minutie indéterminée est
requalifiée dans la même transaction, avec l'ancienne et la nouvelle valeur au journal, et
le front demande confirmation avant d'appeler. Deux déterminés différents : refus, en
nommant les deux libellés. L'égalité stricte aurait refusé le cas le plus fréquent —
`UNDETERMINED` est la valeur par défaut, et une trace dégradée reste souvent indéterminée
face à une empreinte qualifiée.

**`UNDETERMINED` est une réponse, pas un silence** : l'opérateur affirme qu'il y a une
minutie et qu'il ne peut pas dire laquelle. La planche l'imprime donc comme les autres, et
le libellé de type n'est plus nullable nulle part — ni dans `MinutiaData`, ni dans le repère
du modèle de vue. Il n'y a plus de branche « repère sans nom » à traverser, donc plus de
chemin par lequel un type se perdrait en silence. Ce n'est pas une entorse à « le rapport ne
narre pas l'absence » : il n'y a pas d'absence à narrer.

**Requalifier une minutie déjà appariée est refusé** (409). C'est une porte à sens unique
assumée : il faut défaire la paire d'abord. Une propagation silencieuse au binôme aurait été
une écriture invisible de plus, sur une donnée qui finit dans un rapport. *Ce paragraphe est
caduc depuis [ADR-0025](0025-requalifier-une-minutie-appariee-requalifie-la-paire.md) : la
requalification est propagée à la paire, confirmée avant et journalisée après. Le reste de
cet ADR tient.*

**L'appariement a ses propres actes**, `MINUTIA_PAIRED` et `MINUTIA_UNPAIRED`, ajoutés en fin
de catalogue. Leur payload porte les valeurs : les deux identifiants de calque, les
coordonnées et le type des deux minuties, la trace et l'empreinte. La cascade SQL étant
muette, `DeleteLayerHandler` lit les paires **avant** de supprimer le calque et chaîne un
`MINUTIA_UNPAIRED` par paire avec la cause `MINUTIA_DELETED`, dans la même transaction :
sans ça le journal raconterait deux suppressions sans lien causal.

**Un vérificateur en aveugle n'apparie que ses propres minuties.** La création contrôle
l'auteur des deux calques, comme le font déjà la mise à jour et la suppression, et la
lecture filtre sur l'auteur des deux côtés. Sans ce contrôle, la branche de requalification
réécrivait le type d'un calque de l'opérateur au nom du vérificateur — exactement l'écriture
que le mode aveugle lui interdit ailleurs (ADR-0020).

## Conséquences

- ✅ Les trois symptômes disparaissent par construction, pas par vigilance : plus de paire
  orpheline possible, donc plus de badge survivant ni de numéro consommé pour rien.
- ✅ Ce que l'opérateur voit à l'écran est ce que la planche imprime : une seule fonction de
  numérotation, appelée des deux côtés.
- ✅ Les invariants tiennent devant un `curl`, un script de seed ou un onglet en retard.
  Vérifié sur une base jetable : la cascade emporte la paire, la double association est
  refusée, l'association vers une seconde empreinte est acceptée, une paire vers un calque
  inexistant est rejetée.
- ✅ Le seuil des douze minuties, le journal de traçabilité et le canevas ne bougent pas :
  les minuties restent des calques.
- ⚠️ Le numéro dérivé se recalcule à chaque lecture. Un rapport scellé garde les siens, mais
  l'atelier rouvert après une suppression peut montrer une autre série. C'est le
  comportement normal d'un instantané ; c'est aussi le genre d'écart qu'un magistrat relève,
  donc il doit être dit dans le rapport plutôt que découvert.
- ⚠️ Le vérificateur en aveugle numérote sur ses seules paires, l'opérateur sur toutes : la
  même paire porte deux numéros selon qui regarde, et l'annexe B retient ceux de
  l'opérateur. Conséquence directe du mode aveugle, pas de ce modèle.
- ⚠️ La règle de type est réimplémentée côté front pour pouvoir prévenir avant d'appeler, et
  `front-minuseek` n'a aucun lanceur de tests. Le back fait foi ; la duplication est nommée
  ici, elle n'est protégée par rien d'autre.
- ⚠️ Les anciens calques `pair` sont supprimés par la migration, sans conversion. Aucun
  tenant réel n'existe ; sur une base de démonstration, les appariements posés avant sont
  perdus et se refont à la main.
- ⚠️ La contrainte n'est visible d'aucun test unitaire : les fakes in-memory n'exécutent ni
  clé étrangère, ni index unique. Le fake reproduit la cascade à la main, ce qui protège de
  la régression applicative mais pas d'un DDL faux. Une couverture d'intégration sur
  `postgres-test` reste à écrire.

## Alternatives écartées

- **Garder la paire en calque et ajouter une cascade applicative** — c'était la voie la
  moins chère et elle réparait les trois symptômes, mais tous ses invariants reposaient sur
  la discipline de trois handlers. Or la cascade manquante d'aujourd'hui n'est pas un oubli
  exotique : c'est le comportement par défaut d'un `prisma.layer.delete` sur un modèle sans
  relation. Le même défaut se serait reformé au premier chemin de suppression suivant.
- **Deux tables, `Minutia` et `MinutiaPair`, avec des clés étrangères composites portant le
  type** — le modèle le plus solide, et il valide sous Prisma 7.8. Il déplace les minuties
  hors de `Layer` et rouvre `countMinutiae`, le journal et le comparateur, à une semaine de
  la démonstration. À reprendre après, si le besoin se confirme.
- **Un `correspondenceId` porté par les deux minuties, sans objet paire** — élégant, la
  moitié d'appariement meurt avec la ligne qui la porte, et aucune cascade n'est à écrire.
  Mais la cardinalité n'est contrainte par rien : un index unique par pièce n'empêche ni les
  ensembles de taille 1, ni ceux de taille 3, et l'écriture des deux moitiés n'est pas
  atomique.
- **Stocker le numéro** — la seule façon d'avoir un numéro stable dans le temps, et la
  façon la plus sûre de réintroduire des trous dans la série.
