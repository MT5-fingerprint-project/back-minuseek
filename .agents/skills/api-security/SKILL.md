---
name: api-security
description: "Audit de sécurité de l'API back-minuseek (NestJS 11 + Prisma 7 + PostgreSQL 17, DDD/hexagonal/CQRS). Déclencher pour toute revue de sécurité ou d'autorisation : IDOR/BOLA (endpoint prenant un :id/caseId/fingerprintId sans contrôle d'appartenance), RBAC et autorisation au niveau fonction, exposition de données sensibles (DTO/read-model qui fuit des champs), mass assignment (id imposé par le client), injection (Prisma paramétré vs $queryRawUnsafe), security misconfiguration (CORS credentials, exposition statique de media/ via /media, Swagger /docs, helmet absent), uploads (FileTypeValidator sans MaxFileSizeValidator), rate-limiting absent. Couvre l'OWASP API Security Top 10 mappé sur CE repo, avec process de revue par sévérité et format de rapport."
---

# API Security Review — back-minuseek

Skill de **revue de sécurité** pour l'API Minuseek(NestJS 11 + Prisma 7 + PostgreSQL 17, DDD / hexagonal, CQRS via `@nestjs/cqrs`).

> **Source de vérité des conventions = `AGENTS.md`** (à la racine de `back-minuseek`). Ce skill ne ré-énonce PAS la stack, la dependency rule, le nommage ni le workflow Prisma. Il **pointe** vers `AGENTS.md` et ajoute uniquement : un **process d'audit sécurité**, un **modèle de sévérité**, un **format de rapport**, et le mapping **OWASP API Security Top 10 → ce code**. **Lis `AGENTS.md` d'abord.** Reste tool-agnostique.

## Constat de départ — à RE-VÉRIFIER, pas à figer

**Ne te fie pas à ce paragraphe : re-grep avant d'affirmer.** Ces faits orientent l'audit car ils changent la nature des findings.

- **Aucune autorisation n'est appliquée aujourd'hui.** Aucun controller ne porte de `@UseGuards(...)` et il n'y a **pas** d'`APP_GUARD` global : `grep -rn "UseGuards\|APP_GUARD" app/src` → vide côté `investigation`/`biometrics`. **Conséquence : toutes les routes sous `/api` sont accessibles sans authentification ni contrôle d'accès.**
- **Pas de notion de propriétaire/tenant dans le modèle.** Le schéma Prisma (`app/prisma/models/*.prisma`) n'a **aucun** champ `ownerId`/`userId`/`tenantId`. Les ressources (`InvestigationCase`, `Trace`, `ReferencePrint`, `Layer`) n'ont **aucune appartenance**. On ne peut donc pas encore « scoper » l'accès — l'audit **constate l'absence d'enforcement** et **prescrit** ce qu'il faut brancher, plutôt que de vérifier la conformité d'un mécanisme inexistant.
- **Conséquence directe sur l'IDOR/BOLA.** Tout endpoint prenant un identifiant est aujourd'hui une **IDOR par défaut** : qui connaît (ou énumère) un UUID lit/supprime la ressource correspondante.

> L'authentification et le cloisonnement multi-tenant sont **planifiés** (voir `Fingerprint/docs/20_roadmap_auth_multitenant.md`) mais **mis de côté pour l'instant**. Dès qu'un guard d'auth ou un scoping d'appartenance apparaît dans le code, bascule en mode *conformité* : vérifie que **chaque** endpoint à `:id` filtre par propriétaire/tenant + appartenance, et traite toute route volontairement publique comme un **point d'attention** (exige une justification). **Énumère toujours les endpoints depuis `app/src/**/infrastructure/http`** — ne code jamais la liste en dur.

## Quand utiliser

- Demande d'audit de sécurité de l'API, revue d'autorisation, recherche d'IDOR/BOLA.
- Ajout d'un endpoint exposant une ressource par identifiant, d'un upload, ou d'un nouveau DTO/read-model.
- Avant un merge touchant `infrastructure/http`, `main.ts`, le CORS, le serving statique `/media`, ou le schéma Prisma.
- Branchement futur d'une autorisation (guard, rôles, scoping d'appartenance).

## Surface d'attaque actuelle (re-vérifier par `ls`/grep)

- **Bootstrap** (`app/src/main.ts`) : `enableCors({ origin: process.env.ORIGIN, credentials: true })` ; `useStaticAssets(join(process.cwd(), 'media'), { prefix: '/media' })` ; `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` global ; préfixe global `/api` (`setGlobalPrefix('api', { exclude: ['/docs'] })`) ; Swagger sur `/docs` (hors préfixe `/api`). **Aucun `useGlobalGuards`, pas de `helmet`.**
- **Endpoints prenant un identifiant** (cibles BOLA prioritaires — à ré-énumérer) :
  - `investigation.controller.ts` : `POST /api/investigation-cases`, `GET /api/investigation-cases?status&page&limit`, `GET /api/investigation-cases/:id` (⚠️ `@Param('id')` **sans `ParseUUIDPipe`**, contrairement aux autres routes).
  - `biometrics.controller.ts` : `GET /api/traces?caseId=`, `GET /api/reference-prints?caseId=`, `DELETE /api/traces/:id`, `DELETE /api/reference-prints/:id`, `POST /api/traces` & `POST /api/reference-prints` (uploads, `caseId` dans le body).
  - `layers.controller.ts` : `GET /api/layers/:fingerprintId`, `POST /api/layers`, `PUT /api/layers/:id`, `DELETE /api/layers/:id` (`:id`/`:fingerprintId` validés par `ParseUUIDPipe`).

## Process d'audit

Travaille **sur le diff** (`git diff`, fichiers de la PR) pour attraper les régressions transverses ; si pas de diff, demande le scope (contexte / PR / endpoint).

### Étape 1 — Cadrer
Lister les endpoints touchés et, pour chacun, les entrées (`:id`, `@Query`, `@Body`, fichier uploadé) et la ressource exposée. Repérer si le diff touche `main.ts`, le CORS, le static serving ou le schéma Prisma.

### Étape 2 — Passer l'OWASP API Security Top 10 (section ci-dessous)
Pour chaque item, appliquer le **check concret** au code réel. Prioriser : **BOLA/IDOR → Authentification → Autorisation fonction (RBAC) → Exposition de données → Mass Assignment → Injection → Misconfiguration.**

### Étape 3 — Classer par sévérité

| Sévérité | Critère | Action |
|---|---|---|
| 🔴 **Critical** | Accès non autorisé à une ressource (IDOR/BOLA), endpoint sensible sans contrôle, fuite de données, injection, écriture de masse sur champ protégé | Corriger avant merge |
| ⚠️ **Warning** | Durcissement manquant, validation faible, misconfig à risque modéré, défense en profondeur absente | Corriger ou justifier |
| 💡 **Info** | Suggestion, hygiène, hardening optionnel | À discuter |

Down-rank les findings spéculatifs à faible confiance. Indique en tête ce qui est bloquant vs optionnel. Tant qu'aucune auth n'est branchée, l'absence systémique de contrôle d'accès est **un seul finding 🔴 structurel** (prérequis), pas un reproche répété endpoint par endpoint.

### Étape 4 — Boucle de validation
Avant de finaliser, relis chaque finding : est-il vérifiable dans le code/diff ? Le mécanisme cité (Guard, décorateur, champ Prisma) **existe-t-il vraiment** (grep avant d'affirmer) ? N'invente pas de Guard, de rôle ou de champ d'appartenance imaginaire. Supprime le non étayé.

### Étape 5 — Rapport
Produire le rapport au format ci-dessous. Chaque finding : **`Fichier:ligne` · sévérité · catégorie OWASP · WHAT (1 phrase) · WHY/impact (1 phrase) · FIX concret.**

## OWASP API Security Top 10 → ce projet

Pour chaque item : un check exécutable + un exemple ❌/✅ NestJS adapté au code réel.

### API1:2023 — BOLA / IDOR (priorité absolue)

**Check :** tout endpoint prenant un identifiant (`:id`, `caseId`, `fingerprintId`) doit, une fois l'autorisation en place, restreindre l'accès au **propriétaire/tenant** de la ressource. Aujourd'hui aucun ne le fait : `ParseUUIDPipe` valide le *format* de l'UUID, **pas le droit d'y accéder** — et `GET /api/investigation-cases/:id` n'a même pas `ParseUUIDPipe`. Sans contrôle, n'importe qui lit/supprime le dossier, la trace, l'empreinte ou le calque d'autrui en connaissant son UUID.

```ts
// ❌ ParseUUIDPipe ≠ contrôle d'accès — état actuel (layers.controller.ts)
@Delete(':id')
deleteLayer(@Param('id', ParseUUIDPipe) id: string) {
  return this.commandBus.execute(new DeleteLayerCommand(id)); // aucun scope d'appartenance
}

// ✅ Une fois l'autorisation + l'appartenance introduites : passer l'identité au handler
//    et FILTRER côté query/repository (where: { id, ownerId }) — jamais une vérif
//    post-fetch qui révèle l'existence (renvoyer 404, pas 403).
@Delete(':id')
@UseGuards(AuthGuard)
deleteLayer(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUser) {
  return this.commandBus.execute(new DeleteLayerCommand(id, user.ownerScope));
}
```

> Tant que le modèle n'a pas de scoping d'appartenance, le fix de fond est un **prérequis** (brancher l'auth + introduire l'appartenance), pas un patch local. Flague l'absence comme 🔴 systémique.

### API2:2023 — Broken Authentication

**Check :** existe-t-il un contrôle d'auth **appliqué** ? `grep -rn "UseGuards\|APP_GUARD" app/src/investigation app/src/biometrics` → aujourd'hui vide, donc **toutes les routes `/api` sont publiques de fait**. Vérifier aussi qu'aucun secret/token n'est en dur (`grep -rn "secret\|apiKey\|password" app/src`) et que la config sensible vient de l'env (`.env` gitignoré, cf. `AGENTS.md`).

```ts
// ❌ Aucune protection appliquée : toutes les routes /api sont accessibles sans token
@Controller('investigation-cases')
export class InvestigationController { /* ... pas de @UseGuards */ }

// ✅ Auth globale via un guard + opt-out explicite et tracé pour les rares routes publiques
{ provide: APP_GUARD, useClass: AuthGuard }
```

### API3:2023 — Broken Object Property Level Authorization (Exposition de données + Mass Assignment)

**Excessive data exposure — check :** les read-models et les retours de controller ne doivent exposer que les champs nécessaires. Le côté lecture passe par des *readers* renvoyant des read-models plats (`InvestigationCaseReadModel`, `TraceReadModel`, `ReferencePrintReadModel`, `LayerReadModel`) ; vérifier qu'aucun champ interne sensible n'y entre quand le modèle grossira. **Ne jamais sérialiser une ligne Prisma brute.**

**Mass assignment — check :** le `ValidationPipe` global (`whitelist:true`, `forbidNonWhitelisted:true`) protège déjà contre les champs surnuméraires — **ne le retire jamais.** Point d'attention réel **à vérifier** : si un DTO de création accepte un `id` fourni par le client (`@IsUUID() @IsOptional()`) et que le controller fait `new XxxCommand(dto.id ?? randomUUID(), ...)`, le client peut **imposer l'identifiant** de la ressource (collision/écrasement potentiel). Grep : `grep -rn "dto.id\|@IsOptional" app/src/**/infrastructure/http`.

```ts
// ❌ Le client choisit l'identifiant de la ressource
new CreateLayerCommand(dto.id ?? randomUUID(), /* ... */)

// ✅ Identifiant généré côté serveur, sauf besoin d'idempotence justifié
new CreateLayerCommand(randomUUID(), /* ... */)
```

### API4:2023 — Unrestricted Resource Consumption

**Check :** rate-limiting (`@nestjs/throttler` — **absent**), bornes de pagination (`ListInvestigationCasesDto` borne `page`/`limit` — OK), et **taille des uploads**. Les uploads (`POST /traces`, `POST /reference-prints`) valident le **type MIME** (`FileTypeValidator`) mais **pas la taille** → pas de `MaxFileSizeValidator`.

```ts
// ❌ Type vérifié, taille non bornée (biometrics.controller.ts)
new ParseFilePipe({ validators: [new FileTypeValidator({ fileType: IMAGE_MIME })], fileIsRequired: true })

// ✅ Borner la taille (+ idéalement valider le contenu réel, pas le mimetype déclaré)
new ParseFilePipe({ validators: [
  new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
  new FileTypeValidator({ fileType: IMAGE_MIME }),
], fileIsRequired: true })
```

### API5:2023 — Broken Function-Level Authorization (RBAC)

**Check :** les opérations destructrices/sensibles (`DELETE /traces/:id`, `DELETE /reference-prints/:id`, `DELETE /layers/:id`, `POST /investigation-cases`) devront être réservées aux rôles habilités. Aujourd'hui **aucun contrôle de rôle** n'existe → tout le monde peut tout faire. Les rôles devront être contrôlés par un Guard **côté serveur**, jamais par un flag client.

```ts
// ❌ Suppression ouverte à tous (aucun contrôle de rôle)
@Delete('traces/:id')
async deleteTrace(@Param('id', ParseUUIDPipe) id: string) { /* ... */ }

// ✅ Autorisation au niveau fonction via un RolesGuard (à créer)
@Delete('traces/:id')
@UseGuards(AuthGuard, RolesGuard)
@Roles('investigator')
async deleteTrace(/* ... */) { /* ... */ }
```

### API6:2023 — Sensitive Business Flows
**Check :** les flux métier sensibles (upload d'empreinte, ouverture de dossier) doivent être protégés contre l'automatisation abusive (rate-limit, auth). Recouvre API2/API4.

### API7:2023 — SSRF
**Check :** un appel sortant piloté par une entrée utilisateur (fetch d'URL fournie, webhook) ? `grep -rn "fetch(\|axios\|http.get\|got(" app/src`. Re-vérifier si un appel sortant à URL paramétrable est introduit.

### API8:2023 — Security Misconfiguration

**Checks concrets sur `main.ts` :**
- **CORS** : `enableCors({ origin: process.env.ORIGIN, credentials: true })`. Vérifier que `ORIGIN` est défini en prod et **non vide** : `credentials:true` avec une origine non maîtrisée (`undefined` → reflète l'Origin) est une faille. Refuser le wildcard `*` avec credentials.
- **Static serving `/media`** : `useStaticAssets(join(process.cwd(), 'media'), { prefix: '/media' })` sert **tout** `media/` sans contrôle d'accès → les images forensiques (traces, empreintes) sont publiques pour qui connaît le chemin. C'est une IDOR sur fichier statique (détaillée dans `.agents/skills/back-review/references/security-checklist.md`). 🔴 si les noms de fichiers sont devinables ; a minima, servir via une route contrôlée et garantir des noms non prévisibles.
- **Swagger `/docs`** : exposé hors préfixe `/api`. À restreindre/désactiver en production.
- **Hardening manquant** : pas de `helmet` (en-têtes de sécurité). ⚠️/💡.

```ts
// ❌ Dossier d'images forensiques servi en statique public (main.ts)
app.useStaticAssets(join(process.cwd(), 'media'), { prefix: '/media' });

// ✅ Servir les médias derrière une route contrôlée (auth + appartenance),
//    et borner CORS à une origine explicite non vide.
```

### API9:2023 — Improper Inventory Management
**Check :** endpoints non documentés/obsolètes, divergence entre les routes réelles (sous `/api`) et la doc Swagger. Vérifier qu'aucune route de debug/non préfixée ne traîne (hors `/docs` volontairement exclu).

### API10:2023 — Unsafe Consumption of APIs
**Check :** réponses d'API tierces consommées sans validation. Re-vérifier si/quand l'API consomme un service externe.

### Bonus — Injection

**Check :** Prisma paramétré par défaut (pas de concaténation SQL) → bon. Le risque réel serait l'usage de **requêtes raw** : `grep -rn "\$queryRaw\|\$executeRaw\|queryRawUnsafe\|executeRawUnsafe" app/src`. Si un `*RawUnsafe` apparaît avec interpolation d'entrée → 🔴.

```ts
// ❌ Raw non sûr — à bloquer s'il apparaît
prisma.$queryRawUnsafe(`SELECT * FROM "Trace" WHERE id = '${id}'`)

// ✅ Client typé / template tag paramétré
prisma.trace.findUnique({ where: { id } })
```

## Format du rapport

```markdown
# Audit sécurité — {scope}

**Date** : YYYY-MM-DD · **Commit/PR** : {ref} · **Auditeur** : Agent

## Résumé
| Catégorie | Résultat |
|---|---|
| BOLA / IDOR (API1) | ✅ / ⚠️ / ❌ |
| Authentification (API2) | ✅ / ⚠️ / ❌ |
| Autorisation fonction / RBAC (API5) | ✅ / ⚠️ / ❌ |
| Exposition de données / Mass assignment (API3) | ✅ / ⚠️ / ❌ |
| Injection | ✅ / ⚠️ / ❌ |
| Misconfiguration (CORS, /media, /docs, helmet) (API8) | ✅ / ⚠️ / ❌ |
| Uploads / consommation ressources (API4) | ✅ / ⚠️ / ❌ |

## Findings

### 🔴 Critical
| # | Fichier:ligne | OWASP | Finding (what) | Impact (why) | Fix proposé |
|---|---|---|---|---|---|

### ⚠️ Warning
| # | Fichier:ligne | OWASP | Finding (what) | Impact (why) | Fix proposé |
|---|---|---|---|---|---|

### 💡 Info
| # | Fichier:ligne | OWASP | Finding (what) | Impact (why) | Fix proposé |
|---|---|---|---|---|---|

## Points positifs
- ...

## Prochaines étapes (par priorité)
- ...
```

## Greps de départ (outillage)

```bash
# Auth appliquée ? (attendu aujourd'hui : vide → routes ouvertes)
grep -rn "UseGuards\|APP_GUARD" app/src/investigation app/src/biometrics

# Scoping d'appartenance ? (attendu : pas de tenantId/ownerId au schéma)
grep -rin "tenantId\|ownerId\|userId" app/prisma/models

# Endpoints prenant un identifiant (cibles BOLA)
grep -rn "@Param(\|@Query(\|:id\|caseId\|fingerprintId" app/src/**/infrastructure/http

# Mass assignment : id imposé par le client ?
grep -rn "dto.id\|@IsOptional" app/src/**/infrastructure/http

# Requêtes raw (injection) — attendu : vide
grep -rn "\$queryRaw\|\$executeRaw\|RawUnsafe" app/src

# Misconfig : CORS, static, validation, Swagger, helmet
grep -rn "enableCors\|useStaticAssets\|ValidationPipe\|SwaggerModule\|helmet" app/src/main.ts

# Uploads : type vérifié, taille non bornée ?
grep -rn "FileTypeValidator\|MaxFileSizeValidator\|ParseFilePipe" app/src
```
