# ADR-0013 — Persistance du contrôle qualité de capture sur l'upload d'une trace

- **Statut** : accepté
- **Date** : 2026-08-21
- **Décideurs** : équipe back Minuseek (ticket B3)

## Contexte

Le mobile calcule depuis B2 un `CaptureQualityCheck` au déclenchement et le transporte
jusqu'à sa couche d'envoi, mais l'émission est désarmée (`SEND_CAPTURE_QUALITY = false`) :
le back rejette le champ en 400, le pipe de la route posant `forbidNonWhitelisted`.

Trois éléments cadrent la décision :

1. La colonne `captureQuality Json?` **existe déjà**, créée vide par ADR-0011 §4 précisément
   pour éviter une seconde migration en fan-out sur toutes les bases tenant (ADR-0001).
   ADR-0011 laissait explicitement à la suite le soin de « lui donner un type canonique
   partagé DTO / domaine / read-model ».
2. **La perpendicularité (MOB-11) a été abandonnée en B2.** La forme annoncée en commentaire
   dans `trace.prisma` (`{ blurScore, perpendicularityDeviation, passed }`) ne correspond plus
   à ce que le mobile produit.
3. En `multipart/form-data`, toute valeur arrive en `string` : un objet ne peut voyager que
   sérialisé en JSON.

## Décision

1. **Un Value Object dédié `CaptureQuality`**, à côté de `CaptureMetadata` plutôt que dedans.
   Les deux n'ont ni la même nature (relevé EXIF de l'appareil vs verdict calculé on-device),
   ni la même persistance (six colonnes scalaires vs une colonne JSON), ni la même nullité :
   `CaptureMetadata` a un `empty()` toujours présent, `CaptureQuality` est `null` ou absent.
2. **Forme figée `{ blurScore: number ≥ 0, passed: boolean }`**, sans perpendicularité. Le
   commentaire de `trace.prisma` est corrigé en conséquence. **Aucune migration** : la colonne
   et son type sont inchangés.
3. **Transport en chaîne JSON**, parsée par un `@Transform` sur le DTO qui produit une
   **instance de `CaptureQualityDto`**, et non un objet nu : `@ValidateNested` cherche ses
   métadonnées sur le constructeur de la valeur, et laisserait tout passer sur un objet nu.
   Ce qui n'est pas un objet (JSON invalide, scalaire, `null`, tableau) ressort inchangé de
   `plainToInstance` et se fait rejeter par `@IsObject`, dont le message nomme la forme attendue.
4. **Exposition en lecture** : `captureQuality` entre dans `TraceReadModel`, donc dans
   `GET /traces`. C'est l'objet même du ticket — permettre au labo de trier sur la qualité de
   capture au lieu de l'évaluer à l'œil. La donnée transitait déjà à l'exécution (le reader
   Prisma renvoie la ligne entière) ; elle est désormais typée au lieu d'être implicite.
5. **Écriture via `Prisma.DbNull`** : sur une colonne `Json?`, Prisma distingue le NULL SQL du
   littéral JSON `null` et refuse un `null` TypeScript ambigu.

## Conséquences

- ✅ Basculer `SEND_CAPTURE_QUALITY` à `true` côté mobile suffit à remplir la colonne : c'est la
  seule modification mobile attendue.
- ✅ Une trace sans contrôle qualité (chemin galerie, traces antérieures) reste créée
  normalement, colonne à `null`.
- ✅ Un `captureQuality` mal formé est refusé **à la frontière HTTP**, en 400, avec un message
  par champ (`captureQuality.blurScore must be a number…`) et sans rien écrire en base.
- ⚠️ Comme pour ADR-0011, les invariants existent **en double** : décorateurs `class-validator`
  sur le DTO et gardes dans le VO. Le VO reste la défense en profondeur — un handler appelé
  hors HTTP passe par lui.
- ⚠️ `CaptureQuality.fromPersistence` **refuse** une colonne malformée au lieu de l'ignorer :
  une donnée corrompue en base fait échouer la lecture de la trace plutôt que de la rendre
  silencieusement fausse. Seul le domaine écrit cette colonne, le cas ne devrait pas survenir.
- ⚠️ Le read-model traduit la colonne par un cast (`as CaptureQualityProps | null`) : le reader
  fait confiance à ce que le domaine a écrit, il ne revalide pas.

## Alternatives écartées

- **Ajouter les deux champs à `CaptureMetadata`** — mélange un relevé d'appareil et un verdict
  calculé dans un même VO, et force `CaptureMetadata.empty()` à porter une qualité absente.
- **Deux colonnes scalaires `captureBlurScore` / `capturePassed`** — mieux typées et triables en
  SQL, mais imposent la migration en fan-out sur toutes les bases tenant que ADR-0011 avait
  justement anticipée en créant la colonne JSON à l'avance.
- **`@Type(() => CaptureQualityDto)` sans `plainToInstance` explicite** — `@Type` ne convertit
  pas une chaîne, et `@ValidateNested` sur l'objet nu qui en résulte ne trouve aucune
  métadonnée : la validation imbriquée passerait à vide. Piège vérifié, pas supposé.
- **Un validateur maison à la `IsLayerSettings`** — cohérent avec le repo, mais réduit les
  erreurs à un seul message opaque là où `@ValidateNested` en rend un par champ fautif.
