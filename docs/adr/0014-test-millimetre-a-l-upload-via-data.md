# ADR-0014 — Test millimétré à l'upload d'une trace : appel `detect-ruler` avant écriture, code `RULER_NOT_DETECTED`, mode ombre

- **Statut** : proposé
- **Date** : 2026-08-26
- **Décideurs** : équipe back-minuseek

## Contexte

Spec **BIO-38** : une trace sans règle millimétrée n'a pas d'échelle et n'est pas
exploitable ; le back doit la refuser (`422`), indépendamment du contrôle client
(défense en profondeur). L'ADR-0010 §7 fixe le point d'insertion : synchrone à
l'upload, sur les octets en clair, avant toute écriture. Le service data expose
`POST /data/api/detect-ruler` (ADR-0001 de data-minuseek) qui rend un verdict brut
`{ present, confidence, engine_version }` — jamais un 422 : refuser est une règle
métier du back, comme l'interprétation des scores de `compare` (ADR-0007).

Trois points à trancher ici : le contrat d'appel (la trace n'existe pas encore,
le contrat « par IDs » de l'ADR-0007 est impossible), la forme de l'erreur HTTP
(le repo n'a aucun code d'erreur lisible par machine), et le déploiement d'un
détecteur dont le seuil n'est pas encore calibré sur photos réelles, sans
override (BIO-39) pour les photos d'archive ou d'urgence.

## Décision

1. **`RulerDetectorPort`** (`application/ports/ruler-detector.port.ts`) reçoit
   les **octets en clair et leur type MIME** ; `DataRulerDetectorAdapter` les
   envoie en multipart à data avec le même ID token Google que le matcher, et
   traduit tout échec en `502` (`BadGatewayException`), comme `compare`.
2. **La règle vit dans le domaine** : `Trace.assertRulerDetected(detection)` →
   `RulerNotDetectedError`, appelée dans `UploadTraceHandler` **après** la
   vérification de l'affaire et **avant** `storeDisplayableImage` — un refus ne
   laisse ni objet GCS ni ligne en base ni événement d'audit.
3. **Premier code d'erreur machine-readable** : le contrôleur traduit
   `RulerNotDetectedError` en `422 { statusCode, code: 'RULER_NOT_DETECTED',
   message, confidence }`. Les clients (mobile, front) discriminent sur `code`,
   pas sur le message. Les erreurs existantes ne changent pas.
4. **Le verdict est toujours audité** dans le payload de `TRACE_UPLOADED`
   (`rulerDetection: { present, confidence, engineVersion }`, classe `OBSERVED`),
   quel que soit le mode.
5. **`RULER_DETECTION_MODE`** = `shadow` (défaut) | `enforce`. En `shadow`, une
   photo sans règle est acceptée, journalisée et auditée ; c'est le mode de
   calibration. Le passage à `enforce` exige (a) une calibration de data sur
   photos réelles (`cal.≥1`) et (b) l'override BIO-39.

## Conséquences

- ✅ Aucun orphelin possible ; la détection est indépendante du stockage et du
  chiffrement à venir (ADR-0010) : le back a les octets en main.
- ✅ Même découpage que la comparaison : port, adapter data, fake in-memory, règle
  dans l'entité, traduction dans le contrôleur.
- ⚠️ Un aller-retour de plus à l'upload (~0,5-1 s pour 12 MP) ; data indisponible
  → `502` et l'upload échoue, y compris en mode ombre. À reconsidérer si les
  captures terrain doivent survivre à une panne de data (fail-open en `shadow`).
- ⚠️ `code` n'existe que sur cette erreur : généraliser (filtre d'exception) fera
  l'objet d'un ADR dédié si un second cas apparaît.

## Alternatives écartées

- **Contrat par IDs après écriture + statut `PENDING` + nettoyage** — rejeté par
  l'ADR-0010 (orphelins, confirmation client).
- **Data renvoie le 422** — mélange verdict technique et règle métier ; l'override
  et l'audit sont des décisions du back.
- **Activer `enforce` immédiatement** — bloquerait les photos d'archive et
  d'urgence sans override, sur un seuil non calibré.
