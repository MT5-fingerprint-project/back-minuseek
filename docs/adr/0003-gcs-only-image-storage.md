# ADR-0003 — GCS partout : suppression du stockage local, dev par impersonation

- **Statut** : accepté
- **Date** : 2026-07-02
- **Décideurs** : fondateur + agent (bascule dev → bucket GCS, roadmap 1.7/2.2)

## Contexte

Depuis l'ADR-0002, la prod stocke les images dans un bucket GCS privé (URLs
signées V4). Le dev local, lui, utilisait encore `LocalImageStorageAdapter`
(filesystem + `useStaticAssets('/media')`) « en pont » le temps que le bucket
dev existe. Le bucket `minuseek-media-dev` existe désormais, son CORS autorise
`http://localhost:5173`, et chaque dev de l'équipe a `serviceAccountTokenCreator`
sur `back-runtime@dev-minuseek`. Maintenir deux chemins de
stockage = drift dev/prod et surface morte (`/media` sans contrôle d'accès).
Point structurant : **il n'existe pas d'émulateur GCS local** (pas d'image
Docker officielle comme MinIO l'est pour S3, et les fakes tiers ne couvrent
pas la signature V4) — la seule façon d'être représentatif de la prod (URLs
signées, CORS, IAM) est d'utiliser un vrai bucket.

## Décision

- **Supprimer `LocalImageStorageAdapter` et le montage `/media`** (même
  conditionnel) : plus aucun stockage filesystem, en aucun environnement.
- `STORAGE_DRIVER` accepte **`gcs` (défaut) | `in-memory`** ; tout autre valeur
  échoue au boot. `gcs` sans `GCS_BUCKET` échoue au boot (inchangé).
- **Le dev local utilise le vrai bucket dev en keyless**, via impersonation du
  SA runtime (une fois par poste) :

  ```bash
  gcloud auth application-default login \
    --impersonate-service-account=back-runtime@dev-minuseek.iam.gserviceaccount.com
  ```

- `in-memory` reste le mode des tests (DI dans les specs) et un mode hors-ligne
  assumé sans persistance.
- Côté front, le proxy Vite `/media` disparaît (les images arrivent en URLs
  signées absolues).

## Conséquences

- ✅ Un seul chemin de stockage, identique du poste dev à la prod ; les bugs
  GCS (CORS, signature, TTL) se voient en local, pas en prod.
- ✅ Plus d'exposition statique `/media` sans contrôle d'accès.
- ⚠️ Développer avec des images exige le réseau + le setup gcloud (droits déjà
  accordés à l'équipe). Hors-ligne : `STORAGE_DRIVER=in-memory`, sans
  persistance.
- ⚠️ Les devs partagent le bucket dev : les objets uploadés en local et depuis
  `app-dev.minuseek.fr` cohabitent.

## Alternatives écartées

- **Garder l'adapter local pour le dev** — drift dev/prod permanent, et le
  pont `/media` reste une surface sans contrôle d'accès.
- **MinIO local + adapter S3** — **explicitement délégué à plus tard**
  (backlog B3, cible on-prem/self-hosted). Un deuxième adapter et un deuxième
  comportement à maintenir, non représentatif de la prod GCP (API S3,
  signature différente), pour un dev quotidien qui a déjà un bucket dev.
- **Une clé de SA par dev** — clés longue durée à faire tourner ;
  l'impersonation est keyless et déjà câblée côté IAM.
