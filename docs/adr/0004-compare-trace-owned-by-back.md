# ADR-0004 — Le back possède le use case de comparaison biométrique (fin du reverse-proxy transparent)

- **Statut** : accepté
- **Date** : 2026-07-07
- **Décideurs** : fondateur + agent (revue de sécurité sur `feat/add-matching-score-route`)

## Contexte

Le flux de comparaison (trace ↔ empreintes de référence) était :
1. Le front appelait `POST /data/api/compare` (`case_id`, `trace_id`, `reference_print_ids`) via un reverse-proxy transparent du back (`DataProxyController`, `@All('*path')`) vers `data-minuseek`.
2. `data-minuseek` faisait une confiance totale à ces trois identifiants pour aller chercher les images dans le bucket GCS (convention de chemin `media/investigation-case/{caseId}/{folder}/{id}`), sans vérifier qu'ils appartenaient bien ensemble.
3. Le front renvoyait ensuite les scores obtenus au back via `POST /traces/:id/matchings`, que le back persistait **tels quels**.

Deux failles découlaient de ce design :
- **IDOR** : le proxy étant transparent, tout utilisateur authentifié pouvait lancer une comparaison avec un `trace_id` / des `reference_print_ids` ne correspondant pas au `case_id`, et donc lire des empreintes d'une autre affaire.
- **Scores falsifiables** : `POST /traces/:id/matchings` acceptait des scores calculés côté client, sans jamais vérifier qu'une comparaison avait réellement eu lieu — un client pouvait injecter un match à 100 sans appeler `data-minuseek`.

## Décision

Le back porte désormais le use case métier de bout en bout :
- Nouvelle route unique **`POST /api/traces/:id/compare`** (`biometrics.controller.ts`), DTO validé (`CompareTraceDto` : `caseId` + `referencePrintIds`, tous UUID).
- Le handler (`CompareTraceHandler`) **vérifie l'appartenance** de la trace et de chaque empreinte de référence au `caseId` donné (`trace.caseId === caseId`, idem par empreinte) avant tout appel externe ; sinon `TraceNotFoundError` / `ReferencePrintNotFoundError` → `404` (pas de fuite d'information sur l'existence d'une ressource hors-affaire).
- Le back appelle `data-minuseek` **en interne**, via un port/adapter (`FingerprintMatcherPort` / `DataFingerprintMatcherAdapter`), avec les mêmes `case_id`/`trace_id`/`reference_print_ids` qu'avant — mais désormais **validés par le back**, jamais transmis bruts depuis le client.
- Le handler **persiste les scores retournés** (`MatchingRepository.upsertMany`) dans la même requête serveur, sans jamais faire confiance à un score fourni par le client. Les résultats de `data-minuseek` non demandés sont filtrés par sécurité.
- Suppression du reverse-proxy générique (`DataProxyModule`/`DataProxyController`, route `data/api/*`) : le front ne parle plus jamais directement à `data-minuseek`.
- Suppression de `POST /traces/:id/matchings` (upsert de scores arbitraires côté client) : la persistance ne se fait plus que via `compare`.

Côté front : `useCompare` fait un seul appel (`BiometricImageAPI.compare`), `DataAPI.services.ts`/`dataApiClient`/`VITE_DATA_API_URL` sont supprimés (plus jamais appelés depuis le navigateur).

`data-minuseek` n'est **pas modifié** : son contrat (`case_id`/`trace_id`/`reference_print_ids`, fetch GCS par convention de chemin) reste identique, il est simplement appelé uniquement par le back désormais, avec des identifiants déjà vérifiés.

## Conséquences

- ✅ Ferme l'IDOR : impossible de comparer une trace/empreinte n'appartenant pas au `caseId` fourni.
- ✅ Ferme la falsification de score : un score persisté n'existe que si le back a réellement appelé `data-minuseek` dans la même requête.
- ✅ `data-minuseek` n'est plus jamais exposé, même indirectement, à un client non authentifié/non autorisé par le back.
- ⚠️ `data-minuseek` garde un accès GCS large (tout le bucket, par convention de chemin) et fait confiance aux identifiants qu'on lui passe — acceptable car il n'est plus appelable que par le back, mais **ne règle pas** le blast radius si un bug apparaissait côté back. Piste de durcissement identifiée mais non retenue ici : que le back génère des **URLs signées** (`ImageStoragePort.getUrl`, déjà en place) et les passe à `data-minuseek` à la place de `case_id`/`trace_id`/`reference_print_ids`, pour que `data-minuseek` n'ait plus besoin d'accès GCS du tout. Non fait dans ce correctif car cela retire la dépendance `google-cloud-storage` de `data-minuseek` (édition de `pyproject.toml`/`uv.lock`, `uv` non disponible pour régénérer le lock proprement) — à traiter dans un ADR dédié si on veut aller plus loin.

## Alternatives écartées

- **Garder le proxy transparent + ajouter juste une vérification d'appartenance dans `data-minuseek`** — mettrait la logique d'autorisation métier (appartenance à une affaire) dans le service data, qui n'a pas la notion de tenant/case ownership ; contraire à la séparation des responsabilités (le back est le seul point d'entrée réseau et le seul à connaître le modèle `InvestigationCase`).
- **Garder `POST /traces/:id/matchings` en plus de `compare`** — laisserait une porte dérobée pour injecter des scores arbitraires ; supprimé entièrement, rien d'autre ne l'utilisait.
- **URLs signées passées à `data-minuseek` dès ce correctif** — cf. conséquence ⚠️ ci-dessus : amélioration réelle (réduit le blast radius GCS), mais scope plus large (contrat HTTP + dépendances Python) que ce correctif de sécurité ; à faire dans un ADR séparé.
