---
name: back-review
description: "Review du backend Minuseek(NestJS + Prisma + PostgreSQL, DDD/hexagonal/CQRS). À lancer avant chaque PR. Déclencher aussi pour toute demande de review de code, review de PR/diff, audit de sécurité, ou contrôle de cohérence entre bounded contexts. Vérifie le diff contre les conventions d'AGENTS.md et applique un process de review par sévérité (Critical/Warning/Info) avec un format de rapport. Couvre les pièges réels du projet : drift de migration Prisma, ordre/index des layers, typage des champs JSON, pattern reader/read-model des queries, exposition statique /media et tokens DI."
---

# Minuseek Backend Review

Skill de **process de review** pour le backend Minuseek(NestJS 11 + Prisma 7 + PostgreSQL 17, DDD / hexagonal / CQRS via `@nestjs/cqrs`).

> **Source de vérité des conventions = `AGENTS.md`** (à la racine du repo). Ce skill ne ré-énonce PAS les conventions déjà écrites dans `AGENTS.md` (stack, dependency rule, nommage des suffixes, ports/DI, workflow DB, règle de tests). Il y **pointe** et apporte uniquement ce qui n'y est pas : le **process de review**, le **modèle de sévérité**, le **format de rapport**, les **patterns réels non documentés dans AGENTS.md** (read-side CQRS), et les **risques spécifiques projet** tirés de l'historique git. **Lis `AGENTS.md` d'abord.**

## Quand utiliser

- Demande de review de code, review de PR / diff, audit.
- Avant un merge sur `main`.
- Quand un nouveau bounded context est ajouté, ou après un refactoring (cohérence inter-contextes).
- Audit de sécurité.

## Runbook — à lancer avant chaque PR

Ce skill est le **gate de review maison** du repo (il prime sur toute review générique téléchargée). À exécuter sur le **diff de la PR** (`rtk git diff origin/main...HEAD`) avant d'ouvrir la PR ou de demander une review.

1. **Portes CI locales** (bloquantes — cf. `Fingerprint/docs/15_conventions_et_workflow.md` §6) :
   - `rtk lint` (ESLint, zéro warning) — `pnpm lint`
   - `rtk test` (Jest) — `make test`
   - `pnpm build` (TypeScript sans erreur) — ou `rtk tsc`
   Si l'une échoue → corriger d'abord ; ne pas reviewer plus loin.
2. **Passes de review** : dérouler les sections ci-dessous sur le diff.
3. **Checklist auteur** (ci-dessous) : tout coché ?
4. **Verdict** : conclure par **✅ READY** (prêt à PR) ou **🔴 NOT READY** + la liste des bloquants.

### Checklist auteur de PR
- [ ] CI verte en local (lint + tests + build)
- [ ] `domain/` sans import externe ; controller → handler (pas de logique métier dans le controller)
- [ ] Fichiers dans le bon layer ; pas d'import cross-context (référence inter-contexte par UUID)
- [ ] `InMemory*Repository` utilisé (pas de mock de port) ; cas d'erreur couverts
- [ ] Toute évolution de schéma = migration Prisma
- [ ] Commits `type(scope): description` ; kebab-case fichiers ; pas de `console.log`/debug ; pas de secret
- [ ] Diff < 400 lignes ; description claire + lien ticket ; branche rebasée sur `main`
- [ ] **ADR écrit** si une décision structurante a été prise (`docs/adr/`)

## Cadrage du codebase (à re-vérifier — ne pas figer)

Le code applicatif vit dans `app/src/`. Au moment d'écrire ce skill, deux bounded contexts existent (`investigation/`, `biometrics/`) — **mais vérifie toujours `ls app/src/` plutôt que de te fier à ce chiffre.** Les invariants stables ci-dessous sont plus fiables que tout comptage :

- **Préfixe global `api`** (`main.ts`), donc les routes sont sous `/api/...`. *(NB : `AGENTS.md` mentionne encore `POST /cases` — obsolète, le routing réel est sous `/api`.)*
- **Read-side CQRS dédié** : les queries ne passent PAS par le repository ni l'entité. Elles utilisent un **port `*.reader.ts`** (dans `application/queries/<q>/`) qui renvoie un **read-model plat `*-read-model.ts`**. Impls : `prisma-*.reader.ts` + fake `in-memory-*.reader.ts`. Pattern absent d'`AGENTS.md` → détaillé dans `references/architecture-rules.md`.
- **Repositories (write-side)** : `save()`, `findById()`/`existsBy*()`, `delete()` — **pas** de `findAll`/`list` (déporté sur le reader). Ports dans `domain/<aggregate>/repository/`.
- **Port applicatif non-repository** : `image-storage.port.ts` dans `application/ports/`, adapters dans `infrastructure/storage/`.
- **Pas de Domain Event / EventBus dans le code actuel** (`grep -rn "EventBus\|@EventsHandler" app/src` à re-vérifier — au moment d'écrire, 0 résultat). La communication inter-contextes se fait **uniquement par UUID** (`caseId`, `fingerprintId`). Ne reproche jamais l'absence d'events comme un défaut, et ne valide pas un pattern d'events imaginaire.
- **Mapping persistence** : entités avec `reconstitute()` + `toPrimitives()` quand le repo recharge l'entité (Trace, ReferencePrint, Layer). `InvestigationCase` n'en a pas (lectures via read-model) — ne pas l'exiger.

> Si de nouveaux contextes apparaissent, applique le même cadre : structure par aggregate sous `domain/`, ports → adapters par token DI, read-side via reader/read-model, référence inter-contexte par UUID. **Ne code jamais en dur la liste des contextes** — énumère-les depuis `app/src/`.

## Process de review

Travaille **sur le diff** (`git diff`, fichiers de la PR), pas sur des fichiers isolés — pour attraper les effets transverses (ex. un null-check retiré dont les appelants n'ont pas été mis à jour). Si pas de diff fourni, demande le scope (contexte / PR / commit).

### Étape 1 — Cadrer
Identifier le scope et lister les fichiers changés. Repérer s'ils touchent : `domain/`, `application/`, `infrastructure/`, `app/prisma/`, Docker/CI.

### Étape 2 — Passes ordonnées
Scanner dans cet ordre de priorité (les vrais bloquants d'abord) :
1. **Correctness / logique** — edge cases non gérés, transitions d'état invalides, ordre non déterministe, null-checks retirés sans màj des appelants.
2. **Sécurité** — validation à la frontière, secrets, injection, uploads, exposition de données. Voir `references/security-checklist.md`.
3. **Architecture / conventions** — dependency rule, pureté du domaine, ports/adapters, CQRS read/write. Vérifier **contre `AGENTS.md`**. Voir `references/architecture-rules.md`.
4. **Performance** — requêtes non bornées, `orderBy` sans tie-breaker, index manquants.

À chaque passe, consulter la section **Risques spécifiques projet** ci-dessous (les vrais bugs récurrents).

### Étape 3 — Classer par sévérité

| Sévérité | Critère | Action |
|---|---|---|
| 🔴 **Critical** | Bloque le merge : faille de sécurité, perte/corruption de données, violation de la dependency rule, drift de migration | Corriger avant merge |
| ⚠️ **Warning** | Anti-pattern, dette, écart aux conventions d'`AGENTS.md` | Corriger ou justifier |
| 💡 **Info** | Suggestion, inconsistance mineure, nit | À discuter |

Down-rank les nits stylistiques à faible confiance : un reviewer bruyant est ignoré. Précise en tête ce qui est bloquant vs optionnel.

### Étape 4 — Boucle de validation
Avant de finaliser, relire chaque finding : est-il vérifiable dans le code/diff ? est-il bien classé ? la convention citée existe-t-elle vraiment dans `AGENTS.md` ou le code (pas inventée) ? le nom de classe/erreur cité existe-t-il (grep avant d'affirmer) ? Supprimer les affirmations non étayées.

### Étape 5 — Rapport
Produire le rapport au format défini plus bas. Chaque finding a la forme fixe : **`Fichier:ligne` · sévérité · WHAT (1 phrase) · WHY/impact (1 phrase) · FIX concret**.

## Risques spécifiques projet (tirés de l'historique git)

Checks à appliquer en priorité — ce sont des bugs déjà arrivés. Détail, greps et **sites encore non conformes** dans `references/project-risks.md`.

- **`orderBy` Prisma sans tie-breaker déterministe** (bug layer index #21). Tout `orderBy` sur colonne non unique DOIT avoir un départage final par clé unique. ⚠️ Même `createdAt` seul n'est pas unique : `prisma-trace.reader.ts` et `prisma-reference-print.reader.ts` trient `orderBy: { createdAt: 'desc' }` sans `id` → déjà non conformes. 🔴 si l'ordre est métier-significatif (empilement des calques).
- **Fake in-memory qui ne reproduit pas le contrat de l'adapter Prisma** (ordre de tri, casts). Le fake doit imiter l'ordre/le shape du reader réel, et un test doit couvrir le cas limite (ex. valeurs de tri ÉGALES, pas seulement distinctes). Sinon les specs handler donnent une fausse confiance. ⚠️
- **Modèle Prisma modifié sans migration committée = drift** (#19). Toute PR touchant `app/prisma/models/*.prisma` DOIT inclure `app/prisma/migrations/<timestamp>_*/migration.sql` dans la même PR. Commandes Prisma **jamais** sur l'hôte — toujours via conteneur. Job CI `prisma migrate diff --exit-code` attendu. 🔴
- **Champ JSON/JSONB typé `Record<string, unknown>` ou `any`** (#8bc1f). Le type domaine canonique (ex. `LayerSettings`) doit être identique dans le **DTO HTTP**, le **read-model** ET le cast `row.X as ...` des adapters Prisma. Grep `as Record<string` / `Record<string, unknown>`. ⚠️→🔴
- **Champ JSON polymorphe validé par `@IsObject()` seul** (#20). Un objet libre franchit la validation et atterrit en base. Exiger une validation par forme (discriminated union sur `type`, `@Equals`/`@IsHexColor`/`@IsPositive`/`@ArrayMinSize`) avec `whitelist` + `forbidNonWhitelisted`, et gérer le chemin update où `type` est absent. 🔴 (données malformées persistées).
- **Feature livrée sans ses tests handler / fake in-memory** (#20). La **règle de fond** (handler testé via `InMemory*Repository`) est dans `AGENTS.md` (section Tests + recette étape 7) — ne pas la ré-énoncer. Le **delta projet** : sur #20 les tests sont arrivés en commit de rattrapage. Donc exiger les `*.handler.spec.ts` + fake dans la **MÊME PR** que le handler ; sans eux = renvoyer la PR, ne pas merger sur promesse. ⚠️

## Incohérences réelles à flaguer (état actuel — re-vérifier par grep)

- **Tokens DI mixtes** : `Layer` utilise `Symbol('LAYER_REPOSITORY')` / `Symbol('LAYER_READER')` ; tout le reste (`TRACE_REPOSITORY`, `REFERENCE_PRINT_REPOSITORY`, `INVESTIGATION_CASE_REPOSITORY`, les readers, `IMAGE_STORAGE`, `ID_GENERATOR`) utilise des **strings**. `AGENTS.md` impose un token DI mais **ne tranche pas Symbol vs string** : flaguer l'incohérence comme suggestion de cohérence (💡, pas comme écart à une convention écrite). Si l'équipe veut figer un type, l'ajouter d'abord à `AGENTS.md`.
- **Messages d'erreur domaine mélangent FR et EN** : `LayerNotFoundError` → `"Layer ${id} not found"` (EN) vs `TraceNotFoundError` → `"Aucune trace trouvée avec l'identifiant..."` (FR). Convention = descriptif, langue cohérente. 💡 *(Ne pas citer `InvalidTraceStatusError` comme exemple FR : c'est l'erreur de validation du VO de statut, message FR `"... n'est pas un statut valide"` ; et l'erreur de transition est `InvalidTraceTransitionError`, message EN. Vérifie le message exact par grep avant de citer.)*
- **`fingerprintId` vs `caseId`** : `biometrics` référence les calques par `fingerprintId` mais les traces/reference-prints par `caseId` — mismatch d'ubiquitous language à relever en audit DDD. 💡
- **`InvalidInvestigationCaseStatusError`** déclarée DANS `investigation-case-status.vo.ts` au lieu d'un fichier `errors/*.error.ts`. 💡
- **`caseNumber`/`pvNumber`** sont de simples `string` (entité, command, DTO) — pas de Value Object ni de format auto-généré. Ne pas exiger un VO inexistant ; si un format métier est attendu, le proposer en Info.

## Vérification de la dependency rule (greps)

La règle (`infrastructure → application → domain`, domaine framework-free) et sa liste exacte d'imports interdits sont définies **dans `AGENTS.md`** — seule source. Ci-dessous **l'outillage exécutable** pour la vérifier (les greps reprennent la liste d'`AGENTS.md` ; si elle évolue là-bas, mettre à jour ici). Cible les vrais dossiers, tolère les `.spec.ts`.

```bash
# 1. Domaine framework-free (liste d'imports interdits = celle d'AGENTS.md) : ZÉRO hors specs
grep -rn "@nestjs\|@prisma\|class-validator" app/src/*/domain --include="*.ts" | grep -v "\.spec\.ts"

# 2. Pas de Prisma dans domain/ ni application/ : ZÉRO hors specs
grep -rn "from '.*prisma\|PrismaService" app/src/*/domain app/src/*/application --include="*.ts" | grep -v "\.spec\.ts"

# 3. Application n'importe pas infrastructure : ZÉRO hors specs
grep -rn "infrastructure" app/src/*/application --include="*.ts" | grep -v "\.spec\.ts"

# 4. Imports directs entre bounded contexts (référence inter-contexte = UUID only) : doit rester vide
for ctx in $(ls -d app/src/*/ | xargs -n1 basename | grep -vE "^(shared|prisma)$"); do
  echo "=== imports dans $ctx venant d'un AUTRE contexte ==="
  grep -rhn "from '\.\./\.\./" "app/src/$ctx" --include="*.ts" \
    | grep -vE "/$ctx/|/shared/|node_modules" || echo "  (aucun)"
done
```

> Note : `application/` peut légitimement importer `@nestjs/common` (`@Inject`) et `@nestjs/cqrs` — exception pragmatique du projet, pas une violation. Voir `references/architecture-rules.md`.

## Format du rapport

```markdown
# Review — {scope}

**Date** : YYYY-MM-DD · **Commit/PR** : {ref} · **Reviewer** : Agent

## Résumé
| Passe | Résultat |
|---|---|
| Correctness | ✅ / ⚠️ / ❌ |
| Sécurité | ✅ / ⚠️ / ❌ |
| Architecture / conventions | ✅ / ⚠️ / ❌ |
| Performance | ✅ / ⚠️ / ❌ |
| Cohérence inter-contextes | ✅ / ⚠️ / ❌ / N/A |

## Findings

### 🔴 Critical
| # | Fichier:ligne | Finding (what) | Impact (why) | Fix proposé |
|---|---|---|---|---|

### ⚠️ Warning
| # | Fichier:ligne | Finding (what) | Impact (why) | Fix proposé |
|---|---|---|---|---|

### 💡 Info
| # | Fichier:ligne | Finding (what) | Impact (why) | Fix proposé |
|---|---|---|---|---|

## Points positifs
- ...

## Prochaines étapes
- ...
```

## Références (chargées à la demande)

- `references/architecture-rules.md` — hexagonal/DDD/CQRS appliqués au code réel (read-side reader/read-model, ports, entités, VO) ; ne couvre que ce qu'`AGENTS.md` ne dit pas.
- `references/security-checklist.md` — validation à la frontière, secrets, uploads, exposition statique `/media`, DB.
- `references/project-risks.md` — détail des bugs historiques + greps + sites encore non conformes.
