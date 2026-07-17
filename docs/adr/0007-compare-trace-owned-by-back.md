# ADR-0006 — Le back possède le use case de comparaison biométrique

- **Statut** : accepté
- **Date** : 2026-07-07
- **Décideurs** : fondateur + agent (revue de sécurité sur `feat/add-matching-score-route`)

## Contexte

Le front doit pouvoir lancer une comparaison biométrique entre une trace et des empreintes de référence d'une affaire. Le calcul est fait par `data-minuseek`, un service Python qui :

- reçoit `case_id` / `trace_id` / `reference_print_ids` et va chercher les images dans le bucket GCS par convention de chemin (`media/investigation-case/{caseId}/{folder}/{id}`) ;
- **fait une confiance totale aux identifiants qu'on lui passe** : il n'a aucune notion de tenant, d'affaire ni d'appartenance (`trace X ∈ case Y`), et ne peut donc pas faire d'autorisation lui-même.

Contraintes qui forcent la décision :

- **Autorisation** : seul le back connaît le modèle `InvestigationCase` et peut vérifier qu'une trace et des empreintes appartiennent bien à l'affaire demandée. Sans ce contrôle, tout utilisateur authentifié pourrait comparer des empreintes d'une autre affaire (IDOR).
- **Intégrité des scores** : un score de matching persisté doit prouver qu'une comparaison a réellement eu lieu côté serveur. Toute route qui accepterait des scores calculés côté client permettrait d'injecter un match à 100 sans jamais appeler `data-minuseek`.
- **Exposition réseau** : `data-minuseek` n'a ni authentification ni multi-tenancy ; il ne doit pas être joignable, même indirectement, depuis le navigateur.

Il faut donc décider **qui porte le use case de comparaison** : le back, le front, ou `data-minuseek` lui-même.

## Décision

Le back porte le use case métier de bout en bout — il est le seul à parler à `data-minuseek`, et la vérification d'appartenance comme la persistance des scores se font dans la même requête serveur :

- Route unique **`POST /api/traces/:id/compare`** (`biometrics.controller.ts`), DTO validé (`CompareTraceDto` : `caseId` + `referencePrintIds`, tous UUID).
- Le handler (`CompareTraceHandler`) **vérifie l'appartenance** de la trace et de chaque empreinte de référence au `caseId` donné (`trace.caseId === caseId`, idem par empreinte) avant tout appel externe ; sinon `TraceNotFoundError` / `ReferencePrintNotFoundError` → `404` (pas de fuite d'information sur l'existence d'une ressource hors-affaire).
- Le back appelle `data-minuseek` **en interne**, via un port/adapter (`FingerprintMatcherPort` / `DataFingerprintMatcherAdapter`), avec des identifiants **validés par le back**, jamais transmis bruts depuis le client.
- Le handler **persiste les scores retournés** (`MatchingRepository.upsertMany`) dans la même requête serveur. Aucune route n'accepte de scores fournis par le client ; les résultats de `data-minuseek` non demandés sont filtrés par sécurité.

Côté front : `useCompare` fait un seul appel (`BiometricImageAPI.compare`) ; le navigateur ne connaît pas `data-minuseek` (pas de client HTTP ni d'URL vers ce service dans le front).

`data-minuseek` n'est **pas modifié** : son contrat (`case_id`/`trace_id`/`reference_print_ids`, fetch GCS par convention de chemin) reste identique — il est simplement appelé uniquement par le back, avec des identifiants déjà vérifiés.

## Conséquences

- ✅ Pas d'IDOR : impossible de comparer une trace/empreinte n'appartenant pas au `caseId` fourni.
- ✅ Pas de score falsifiable : un score persisté n'existe que si le back a réellement appelé `data-minuseek` dans la même requête.
- ✅ `data-minuseek` n'est jamais exposé, même indirectement, à un client non authentifié/non autorisé par le back.
- ⚠️ `data-minuseek` garde un accès GCS large (tout le bucket, par convention de chemin) et fait confiance aux identifiants qu'on lui passe — acceptable car il n'est appelable que par le back, mais **ne règle pas** le blast radius si un bug apparaissait côté back. Piste de durcissement identifiée mais non retenue ici : que le back génère des **URLs signées** (`ImageStoragePort.getUrl`, déjà en place) et les passe à `data-minuseek` à la place des identifiants, pour que `data-minuseek` n'ait plus besoin d'accès GCS du tout. Non fait dans ce correctif car cela change le contrat HTTP et les dépendances Python de `data-minuseek` (retrait de `google-cloud-storage`, édition de `pyproject.toml`/`uv.lock`, `uv` non disponible pour régénérer le lock proprement) — à traiter dans un ADR dédié si on veut aller plus loin.

## Alternatives écartées

- **Reverse-proxy transparent du back vers `data-minuseek`** (`@All('*path')` forwardant `POST /data/api/compare`, prototypé sur cette branche mais jamais mergé) — le back ne serait qu'un tuyau : les identifiants du client seraient transmis bruts à `data-minuseek`, qui ne sait pas vérifier l'appartenance → IDOR. Et comme le proxy ne ferait que relayer, il faudrait une route séparée pour persister les scores renvoyés au front, donc des scores falsifiables côté client. Le back doit *comprendre* la requête, pas la relayer.
- **Le front appelle `data-minuseek` directement** — expose un service sans auth ni multi-tenancy au navigateur ; mêmes failles que le proxy, sans même le contrôle d'accès du back.
- **Mettre la vérification d'appartenance dans `data-minuseek`** — mettrait la logique d'autorisation métier (appartenance à une affaire) dans le service data, qui n'a pas la notion de tenant/case ownership ; contraire à la séparation des responsabilités (le back est le seul point d'entrée réseau et le seul à connaître le modèle `InvestigationCase`).
- **Une route d'upsert de scores fournis par le client (`POST /traces/:id/matchings`) en complément de `compare`** — porte dérobée pour injecter des scores arbitraires ; la persistance ne se fait que via `compare`.
- **URLs signées passées à `data-minuseek` dès ce correctif** — cf. conséquence ⚠️ ci-dessus : amélioration réelle (réduit le blast radius GCS), mais scope plus large (contrat HTTP + dépendances Python) que ce correctif de sécurité ; à faire dans un ADR séparé.
