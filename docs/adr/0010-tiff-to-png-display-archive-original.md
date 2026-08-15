# ADR-0010 — Conversion TIFF → PNG à l'upload, original archivé

- **Statut** : accepté
- **Date** : 2026-08-15
- **Décideurs** : fondateur + agent (branche `fix/convert-tif-to-png`)

## Contexte

Les traces et empreintes de référence peuvent être uploadées en TIFF (format courant
des scanners d'empreintes), que les navigateurs n'affichent pas. Le front lit `path`/`url`
tels quels : un TIFF stocké est donc inaffichable. L'original doit néanmoins être
conservé à des fins d'archive (intégrité de la pièce d'origine).

## Décision

À l'upload (`POST /traces`, `POST /reference-prints`), un fichier `.tif`/`.tiff` est :

1. **converti en PNG** (encodage lossless : seuls les octets du conteneur changent, pas
   les pixels) — la conversion a lieu **avant toute écriture** : un TIFF illisible est
   rejeté en `400` sans laisser de fichier orphelin (même règle qu'ADR-0008) ;
2. **archivé tel quel** sous `<dossier>/<id>.tif` (jamais référencé en base, jamais servi) ;
3. le PNG est stocké sous `<dossier>/<id>.png` — c'est **ce chemin qui est persisté** et
   exposé via `path`/`url`.

Même id pour les deux fichiers, seule l'extension diffère. Les autres formats (png, jpeg)
sont stockés inchangés, sans archive.

- La convention vit dans un seul helper applicatif : `storeDisplayableImage` /
  `archivedOriginalPath` (`biometrics/application/services/displayable-image.ts`),
  utilisé par les deux handlers d'upload et les deux handlers de delete.
- La conversion passe par un port applicatif `ImageConverterPort` (token `IMAGE_CONVERTER`),
  implémenté en infrastructure par `SharpImageConverterAdapter` (sharp/libvips) et
  `InMemoryImageConverter` pour les tests (pas de mock). Un buffer indécodable lève
  `InvalidImageError`, mappée en `400 BadRequest` par le controller.
- **Suppression** : deleter une trace/empreinte supprime le PNG **et** l'archive `.tif`
  (dérivée du chemin, delete idempotent `ignoreNotFound`) — pas de biométrie orpheline
  dans le bucket.

## Conséquences

- ✅ Zéro changement de contrat : le front continue de lire `id`/`path`/`url`, qui pointent
  désormais toujours vers un format affichable.
- ✅ L'original TIFF reste disponible dans le bucket pour l'archive/expertise, retrouvable
  par convention (`même chemin, extension .tif`).
- ⚠️ L'archive n'est pas référencée en base : sa seule trace est la convention de nommage.
  Si un besoin d'accès applicatif à l'original apparaît, il faudra l'exposer explicitement.
- ⚠️ Le PNG peut être plus lourd que le TIFF source (selon la compression d'origine) ;
  acceptable pour un bucket privé.
- ⚠️ L'archive est supprimée avec l'empreinte : si une exigence légale de rétention
  au-delà de la vie de la pièce apparaît, ce choix devra être revu (nouvel ADR).

## Alternatives écartées

- **Convertir à la volée au download** — coût CPU répété à chaque affichage, URL signées
  GCS incompatibles avec une transformation à la lecture.
- **Stocker le chemin de l'archive en base** — colonne supplémentaire pour un fichier
  jamais servi ; la convention « même id, extension `.tif` » suffit.
- **JPEG au lieu de PNG** — compression avec perte, inacceptable pour de la biométrie.
