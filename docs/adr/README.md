# Architecture Decision Records (ADR)

On consigne ici les **décisions structurantes** du repo : choix techno, trade-offs d'archi, contrats d'API, sécurité, modèle de données. Une décision « qui le mérite » = difficile à inverser, qui engage l'équipe, ou qu'un nouvel arrivant devrait pouvoir comprendre sans archéologie git.

## Règles
- Un fichier par décision : `NNNN-titre-en-kebab.md` (numéro incrémental, ex. `0001-...`).
- Partir de [`0000-template.md`](0000-template.md).
- Ne pas réécrire une décision passée : si elle change, créer un nouvel ADR et passer l'ancien en `Statut : remplacé par ADR-XXXX`.
- Les agents IA créent un ADR quand ils prennent ou proposent une telle décision (cf. « Directives agents » dans `AGENTS.md`).

## Index
- [ADR-0001](0001-multi-tenant-db-per-tenant.md) — Multi-tenant : une base de données par tenant
- [ADR-0002](0002-gcs-private-storage-signed-urls.md) — Stockage des images en bucket GCS privé + URLs signées V4 (keyless)
- [ADR-0003](0003-gcs-only-image-storage.md) — GCS partout : suppression du stockage local, dev par impersonation
