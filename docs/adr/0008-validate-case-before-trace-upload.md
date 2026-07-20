# ADR-0008 — Validation de l'affaire avant l'upload d'une trace

- **Statut** : accepté
- **Date** : 2026-07-20
- **Décideurs** : fondateur + agent (branche `feat/traces-case-validation`)

## Contexte

Le ticket P1 « Lier l'image prise en mobile à une affaire » demande que `POST /traces` rattache une photo à une affaire (`caseId`) et **refuse l'upload si l'affaire n'existe pas ou n'est pas accessible**.

État de départ :

- La route `POST /traces` existe déjà et fonctionne (`UploadTraceCommand` → `UploadTraceHandler` → storage + `TraceRepository`). Elle retourne `{ id, path, url }`.
- Elle **ne vérifie ni l'existence ni le statut de l'affaire** : un `caseId` inconnu ou une affaire fermée crée quand même une `Trace` et un fichier orphelin dans le storage.
- `Trace.caseId` est un **UUID nu**, sans FK vers `InvestigationCase` : la séparation des bounded contexts `biometrics` / `investigation` interdit l'import croisé (communication par UUID uniquement, cf. AGENTS.md). `biometrics` n'importe rien de `investigation` aujourd'hui.
- Le ticket propose de faire renvoyer `{ traceId, caseId, status }`. Or la route est **déjà consommée par le front** (`front-minuseek` → `BiometricImageAPI.upload` → `mapDtoToBiometricImage`, qui lit `dto.path` via `.split('/')` et `dto.url`).

## Décision

Ajouter la validation **sans changer le contrat de sortie**.

- Le handler `UploadTraceHandler` vérifie l'affaire **avant tout écrit** (storage/repo) : si l'affaire est absente **ou** hors des statuts acceptés (`OPEN`, `IN_PROGRESS`), il lève `CaseUnavailableForTraceError` et **ne crée ni fichier ni trace**. Le controller mappe cette erreur en **404** (même pattern que `TraceNotFoundError`). « Inexistant » et « inaccessible » sont traités de façon identique (404, pas de fuite d'information).
- La vérification cross-context passe par un **port ACL local à `biometrics`** : `CaseStatusPort.findStatus(caseId): Promise<string | null>`, implémenté par `PrismaCaseStatusAdapter` (lit `investigationCase.status`, requête **tenant-scoped** via `TenantConnectionService`) et `InMemoryCaseStatusAdapter` (tests). Le port renvoie une `string` brute, pas l'enum du contexte `investigation`, pour garder la frontière propre. La liste des statuts acceptés vit dans le handler (`biometrics`).
- **On conserve le contrat `{ id, path, url }`** ; on ne suit pas la forme `{ traceId, caseId, status }` du ticket.

## Conséquences

- ✅ Plus de trace ni de fichier orphelin : un `caseId` inconnu/fermé renvoie 404 sans rien écrire.
- ✅ Frontière de contexte respectée : aucun import de `investigation` depuis `biometrics`, pas de FK, communication par UUID via un port ACL swappable et testable en In-Memory (pas de mock).
- ✅ Zéro breaking change : le front (et le futur mobile) continue de lire `id`/`path`/`url`.
- ⚠️ Le contrôle est **par tenant, pas par appartenance fine** : tout utilisateur du tenant peut uploader sur n'importe quelle affaire OPEN/IN_PROGRESS de ce tenant. Suffisant pour ce ticket ; un contrôle d'appartenance plus fin relèverait d'un durcissement RBAC/IDOR séparé.
- ⚠️ La liste `['OPEN','IN_PROGRESS']` est dupliquée par rapport à l'enum `investigation` (couplage par valeur, assumé au titre de la séparation des contextes).

## Alternatives écartées

- **Suivre le contrat `{ traceId, caseId, status }` du ticket** — casse le front (`dto.path.split` sur `undefined`) et supprime l'`url` (seule info utile pour prévisualiser l'image), pour ajouter `caseId` (redondant, le client l'envoie) et `status` (constant `RECEIVED` à la création). `id` est déjà le `traceId`. Déviation volontaire de la lettre du ticket.
- **Dispatcher `GetInvestigationCaseQuery` via le `QueryBus`** depuis le handler — fonctionne sans import de module (query enregistrée globalement) mais couple l'application `biometrics` à une classe de query d'un autre contexte. Le port ACL garde le couplage au seul UUID.
- **Exporter `InvestigationCaseReader` depuis `InvestigationModule`** et l'injecter — crée une dépendance de module croisée entre bounded contexts, contraire à la règle de communication par UUID.
- **Ajouter une FK `Trace.caseId → InvestigationCase.id`** — recouplerait les deux contextes au niveau du schéma ; rejeté pour préserver leur autonomie.
