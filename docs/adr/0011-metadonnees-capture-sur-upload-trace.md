# ADR-0011 — Métadonnées de capture sur l'upload d'une trace

- **Statut** : accepté
- **Date** : 2026-08-18
- **Décideurs** : équipe back Minuseek (ticket B1b)

## Contexte

Le viseur caméra custom du mobile (ticket B1) connaît des informations que le back ne reçoit
pas aujourd'hui : dimensions réelles de la photo, horodatage EXIF de la prise de vue,
orientation, focale, modèle d'appareil. Le ticket B2 (contrôles qualité temps réel) produira
en plus un `CaptureQualityCheck { blurScore, perpendicularityDeviation, passed }`.

Trois contraintes cadrent la décision :

1. `main.ts` pose un `ValidationPipe` global `{ whitelist: true, forbidNonWhitelisted: true }`
   **sans `transform`**. Tout champ absent du DTO fait échouer la requête en 400 — le chemin
   est donc fermé — et, dans un `multipart/form-data`, toutes les valeurs arrivent en `string` :
   sans `transform`, le contrôleur recevrait `"3024"` même avec un `@Type(() => Number)`.
2. La persistance est **db-per-tenant** (ADR-0001) : chaque migration est rejouée
   séquentiellement sur toutes les bases tenant (`app/scripts/migrate-all.sh`). Une migration
   a un coût opérationnel réel, proportionnel au nombre de tenants.
3. L'upload par galerie (photo importée, sans viseur) ne fournira **jamais** ces informations.

## Décision

1. **Métadonnées toutes optionnelles**, portées par un Value Object `CaptureMetadata` qui valide
   ses invariants (dimensions entières ≥ 1 et **indissociables**, orientation EXIF dans 1–8,
   focale strictement positive, `capturedAt` parsable, `deviceModel` de 1 à 120 caractères).
   Le contrat existant `caseId` + `file` reste valide tel quel.
2. **Pipe de validation local à la route `POST /api/traces`**, avec `transform: true` en plus de
   `whitelist` + `forbidNonWhitelisted`. Le pipe global de `main.ts` n'est **pas** modifié.
3. **Colonnes préfixées `capture*`** sur `Trace`, toutes nullables. Le préfixe évite la collision
   avec les colonnes de chiffrement d'A2 (ADR-0010 §8) et lève l'ambiguïté avec `createdAt` :
   `capturedAt` est la date de **prise de vue**, `createdAt` la date de **réception serveur**.
4. **`captureQuality Json?` est créée vide dès maintenant**, alors que seul B2 l'alimentera.

## Conséquences

- ✅ Le contrat d'upload est ouvert sans casser le chemin galerie ni les traces existantes
  (toutes les colonnes sont nullables, `reconstitute` accepte une ligne tout-`null`).
- ✅ La protection `forbidNonWhitelisted` reste intacte : un champ inconnu renvoie toujours 400.
- ✅ B2 n'aura pas besoin d'une seconde migration en fan-out sur toutes les bases tenant.
- ⚠️ Deux pipes de validation coexistent dans l'application. Le pipe local doit rester **aligné**
  sur le global (`whitelist` + `forbidNonWhitelisted`) : le désaligner rouvrirait un trou de
  validation sur cette seule route.
- ⚠️ Les invariants existent **en double** : décorateurs `class-validator` sur le DTO (pour
  répondre 400 à la frontière) et gardes dans le VO (invariant du domaine). Toute évolution
  d'une borne doit être portée aux deux endroits, sous peine d'une erreur domaine remontant en
  500 au lieu d'un 400. `MAX_DEVICE_MODEL_LENGTH` est exporté par le VO et importé par le DTO
  pour supprimer au moins cette duplication-là.
- ⚠️ `captureQuality` est une colonne morte jusqu'à B2, et son contenu n'est ni typé ni validé
  côté domaine. Sa forme attendue est documentée en commentaire dans `trace.prisma` ; B2 devra
  lui donner un type canonique partagé DTO / domaine / read-model (risque connu du repo sur les
  champs JSON).

## Alternatives écartées

- **Activer `transform: true` sur le pipe global de `main.ts`** — change d'un coup le
  comportement de toutes les routes de l'application (coercition silencieuse des types sur
  chaque DTO existant), hors périmètre et non couvert par les tests actuels.
- **Six paramètres positionnels de plus sur `UploadTraceCommand`** — le constructeur en compte
  déjà cinq ; un objet unique `capture?` garde l'appel lisible et évite les inversions
  d'arguments de même type.
- **Attendre B2 pour créer `captureQuality`** — imposerait une seconde migration rejouée sur
  chaque base tenant pour une seule colonne nullable.
- **Colonnes sans préfixe (`width`, `height`, `orientation`)** — collision de sens avec les
  colonnes d'A2 et confusion `capturedAt` / `createdAt`.
