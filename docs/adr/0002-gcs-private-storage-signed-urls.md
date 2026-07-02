# ADR-0002 — Stockage des images en bucket GCS privé + URLs signées V4 (keyless)

- **Statut** : accepté
- **Date** : 2026-07-01

## Contexte
Les images (traces, empreintes de référence) sont des **données biométriques sensibles**. Aujourd'hui le back les écrit sur le filesystem local et les sert en statique via `app.useStaticAssets('/media')`, **sans aucun contrôle d'accès** : toute URL devinée expose une image (finding de la security-checklist). De plus, Cloud Run a un **filesystem éphémère** → le stockage local n'est pas durable en prod.

## Décision
Ajouter un adapter de stockage **GCS** (`@google-cloud/storage`) derrière le port existant `ImageStoragePort` :
- upload dans un **bucket GCS privé** (clé stable `media/<...>`, content-type renseigné pour l'affichage image/canvas) ;
- lecture via **URL signée V4** à TTL court, **keyless** : signature IAM `signBlob` de l'identité runtime (Workload Identity en prod, impersonation en dev) — **aucune clé privée dans l'image** ;
- sélection de l'adapter par `STORAGE_DRIVER` (`local` | `gcs`) via `useFactory` dans le module (composition root), **`local` par défaut** ; `gcs` **fail-fast** au boot si `GCS_BUCKET` est absent ;
- la DB continue de stocker la **clé objet** (`media/...`), jamais l'URL ; l'URL est dérivée à la lecture (`getUrl`).

## Conséquences
- ✅ Résout l'exposition publique de `/media` (finding sécurité) : accès time-limité et autorisé, bucket privé (UBLA + Public Access Prevention côté infra).
- ✅ Stockage durable, compatible Cloud Run (fs éphémère).
- ✅ Pas de secret/clé à gérer ou rotationner dans l'image (keyless).
- ⚠️ `local` reste un **pont transitoire** tant que le bucket dev n'existe pas ; à terme la dev tape un bucket GCS dev (aligné prod), puis `local` + `useStaticAssets('/media')` sont supprimés.
- ⚠️ La vraie signature exige l'autorisation IAM `signBlob` sur l'identité runtime (posée en Phase 3 infra) ; en local sans impersonation, seul le mode `local` fonctionne. Les tests mockent le client GCS → aucune creds requise en CI.

## Alternatives écartées
- **Bucket/URLs publiques** — inacceptable pour des données biométriques.
- **Route back authentifiée qui streame le fichier** — le back sert alors les octets (charge, pas de CDN, couplage) ; l'URL signée délègue le service à GCS.
- **Clé de service account (JSON) pour signer** — secret à embarquer/rotationner ; le keyless (`signBlob`) l'évite.
- **Config storage typée dédiée (union discriminée + loader)** — jugée overkill pour un `local` transitoire et le style env-inline du repo ; remplacée par un switch DI minimal + fail-fast.
