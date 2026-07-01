---
name: architecture-review
description: "Revue de fond — architecture & principes — du backend Minuseek (NestJS 11 + Prisma 7, DDD / hexagonal / CQRS). Déclencher pour une revue approfondie de design (au-delà du process pré-PR de back-review) : respect de l'architecture hexagonale et de la dependency rule (domain ← application ← infrastructure), SOLID (SRP/OCP/LSP/ISP/DIP), DRY/KISS/YAGNI, domaine riche vs anémique, frontières de bounded context (référence par UUID, pas d'import croisé), discipline de test (pas de mocks sur les ports → implémentations InMemory), et autorisation aux frontières (RBAC/IDOR). Inspiré de Robert C. Martin (Clean Architecture, SOLID), Martin Fowler (refactoring, anemic domain, Mocks Aren't Stubs) et Udi Dahan (autonomie des bounded contexts). Applique un modèle de sévérité et un format de rapport."
---

# Architecture & Principes — Revue de fond (back-minuseek)

Revue **de design** du backend Minuseek (NestJS 11 + Prisma 7 + PostgreSQL 17, DDD / hexagonal / CQRS). Là où `back-review` est le **gate pré-PR** (process, checklist, CI) et `api-security` l'**audit OWASP**, ce skill est la couche **« est-ce bien conçu ? »** : architecture, principes SOLID/DRY/YAGNI, modèle de domaine et discipline de test.

> **Source de vérité des conventions = `AGENTS.md`** (racine du repo). Ce skill ne ré-énonce pas la stack, le nommage ni les commandes : il **pointe** vers `AGENTS.md` et ajoute des **heuristiques de design** outillées, inspirées de **Robert C. Martin**, **Martin Fowler** et **Udi Dahan**, mappées sur CE code. **Lis `AGENTS.md` d'abord. Reste tool-agnostique. Vérifie toujours le code réel** (grep) plutôt que de supposer.

## Quand utiliser

- Revue approfondie d'une PR qui touche au **design** (nouveau bounded context, nouveau use case, refactoring d'archi, nouveau port/adapter, modèle de domaine).
- Doute sur « où mettre ce code », « est-ce trop couplé », « ce test est-il honnête ».
- En complément de `back-review` (process) et `api-security` (OWASP) — pas en remplacement.

## Comment l'utiliser

Travaille **sur le diff** (`rtk git diff origin/main...HEAD`). Dérouler les 6 passes ci-dessous ; pour chacune, appliquer le **check** au code réel, classer en **🔴/⚠️/💡**, et finir par un **verdict**. Une remarque de design n'a de valeur que **concrète** : cite `fichier:ligne` et propose le refactor.

---

## 1. Architecture hexagonale & dependency rule — *Uncle Bob*

> **Clean Architecture (R. C. Martin)** : « les dépendances du code source ne pointent que **vers l'intérieur**, vers les politiques de plus haut niveau. » La base de données, le web, le framework sont des **détails** : le domaine ne doit pas les connaître.

**Check :** le sens de dépendance `infrastructure → application → domain` est-il respecté ? `domain/` reste-t-il framework-free ?

```bash
# domaine pollué par le framework / la persistance = violation directe
rtk grep -rn "@nestjs/\|@prisma/\|class-validator\|PrismaClient" app/src/*/domain
# application qui réimporte l'infrastructure (interdit)
rtk grep -rn "infrastructure/" app/src/*/application
```

- ❌ Un import `@prisma/*` ou `@nestjs/*` dans `domain/` → 🔴. Le domaine doit ignorer comment il est persisté ou exposé.
- ✅ Le domaine définit des **ports** (interfaces) ; l'infrastructure les implémente ; le câblage port→adapter se fait par **token DI** dans le module (composition root). Inverser une dépendance = un adapter, pas un import.
- **« Screaming architecture »** : l'arbo crie le métier (`investigation/`, `biometrics/`), pas le framework. Un dossier `controllers/` racine ou un `services/` fourre-tout est un signal d'odeur.

## 2. SOLID — *Uncle Bob*

Vérifier les 5, mappés au code :

- **S — Single Responsibility** : *« une classe a une seule raison de changer ».* Un handler = **un** use case (pas de God Service à 15 méthodes). Un VO valide **ses** invariants, pas ceux des autres. ❌ `XxxService` qui ouvre un dossier *et* envoie un mail *et* formate une réponse → découper.
- **O — Open/Closed** : ajouter un comportement = ajouter une implémentation de port, pas modifier le use case. ❌ un `switch (type)` qui grossit à chaque cas → polymorphisme / stratégie.
- **L — Liskov** : tout adapter d'un port (ex. `Prisma*Repository` **et** `InMemory*Repository`) doit être **substituable** sans surprise — mêmes contrats, mêmes erreurs. Un `InMemory` qui ne respecte pas la sémantique du vrai repo rend les tests menteurs → 🔴.
- **I — Interface Segregation** : des ports **fins et orientés besoin** (`save`, `findById`, `existsByCaseNumber`) plutôt qu'un gros repository générique. Cf. §4 (Udi Dahan, « generic repository »).
- **D — Dependency Inversion** : use case → **abstraction** (port), jamais l'implémentation concrète. Le `new` d'un adapter dans un handler → 🔴 ; ça doit passer par l'injection.

```bash
# DIP : un handler qui instancie un adapter concret au lieu d'injecter le port
rtk grep -rn "new Prisma\|new .*Repository(" app/src/*/application
```

## 3. DRY / KISS / YAGNI — *Martin Fowler*

- **DRY** *(Fowler, « Refactoring »)* : la duplication est un **smell**, mais attention à la **fausse DRY** — deux bouts de code qui se ressemblent par hasard ≠ même connaissance. Factoriser ce qui partage **une raison de changer**, pas ce qui se ressemble visuellement.
- **YAGNI** *(Fowler, bliki « Yagni »)* : pas d'abstraction « au cas où ». Un port avec une seule implémentation prévue *et aucun besoin de test/swap* peut être prématuré ; à l'inverse, un port qui sert **déjà** au double (Prisma + InMemory) est justifié. ❌ une couche `Manager`/`Facade`/generic `BaseRepository<T>` sans besoin réel → YAGNI.
- **KISS** : la solution la plus simple qui respecte la dependency rule. Un événement, une file, un cache « pour plus tard » sans besoin actuel = complexité à refuser.

```bash
# blocs dupliqués candidats (mapping, validation copiée-collée entre contextes)
rtk grep -rn "toPrimitives\|reconstitute\|mapTo" app/src
```

## 4. Domaine riche & frontières de contexte — *Fowler + Udi Dahan*

- **Domaine anémique = anti-pattern** *(Fowler, « AnemicDomainModel »)* : si les entités ne sont que des sacs de getters/setters et que toute la logique vit dans les handlers/services, le « domaine » n'en est pas un. ✅ La règle métier vit **dans** l'entité/le VO (constructeur privé + factory auto-validante, méthodes qui protègent les invariants — **Tell-Don't-Ask**). ❌ `case.setStatus(x)` depuis un handler qui décide de la transition → la transition appartient à l'agrégat.
- **Autonomie des bounded contexts** *(Udi Dahan)* : `investigation/` et `biometrics/` ne s'importent **pas** directement. La référence inter-contexte se fait **par identifiant (UUID)**, pas par objet partagé. ❌ un import `biometrics/...` depuis `investigation/...` → 🔴 (couplage de contextes).
- **Pas de « generic repository »** *(Udi Dahan)* : éviter un `Repository<T>` générique exposant `getAll/query/where`. Les ports sont **spécifiques à l'agrégat** et expriment des intentions métier. Le **read-side** passe par des **readers + read-models** dédiés (CQRS), pas par le repository d'écriture.
- **Communication & couplage** *(Udi Dahan)* : pas d'appels en chaîne synchrones entre contextes « parce que c'est pratique ». Aujourd'hui il n'y a **pas** d'EventBus/Domain Events dans le code — **ne reproche pas leur absence** et **n'invente pas** un pattern d'events ; si un couplage cross-contexte apparaît, la bonne réponse est la référence par UUID (ou, plus tard, un événement — décision à acter en ADR).

```bash
# import direct entre bounded contexts (doit rester vide)
rtk grep -rn "investigation/" app/src/biometrics ; rtk grep -rn "biometrics/" app/src/investigation
# domaine anémique : entités sans méthode métier (que des get/set) — à inspecter
rtk grep -rn "set[A-Z]" app/src/*/domain
```

## 5. Discipline de test — pas de mocks, InMemory — *Fowler*

> **« Mocks Aren't Stubs » (Fowler)** : l'école *classiciste* (Detroit/Chicago) teste le **comportement observable** avec des **doublures réelles en mémoire**, pas en vérifiant des interactions sur des mocks. C'est **la règle d'équipe** (cf. `AGENTS.md` & `Fingerprint §6`).

**Check :** les tests injectent-ils un **`InMemory*Repository`** (qui implémente le **même port** que l'adapter Prisma), ou bien mockent-ils le port ?

```bash
# mocks sur les ports = à bannir au profit des InMemory
rtk grep -rn "jest.mock\|createMock\|mockResolvedValue\|jest.fn()" app/src
# les InMemory existent-ils et implémentent-ils le port ?
rtk grep -rn "InMemory.*implements\|class InMemory" app/src
```

- ❌ `jest.fn()` / `createMock<XxxRepository>()` à la place d'un `InMemory*Repository` → ⚠️/🔴 (test couplé à l'implémentation, fragile, menteur).
- ❌ Un `InMemory` qui **diverge** du contrat du vrai repo (ne lève pas la même erreur d'unicité, ne respecte pas la sémantique) → 🔴 (viole Liskov, §2).
- ✅ Test du **comportement** (étant donné un état, quand j'exécute le use case, alors l'état/le résultat est…), pas de l'implémentation. Cas d'erreur et edge cases couverts.

## 6. Autorisation aux frontières — RBAC / IDOR

> Le contrôle d'accès est une **décision de design aux frontières**, pas un détail.

**Check (résumé — l'audit complet est dans le skill `api-security`)** : tout endpoint prenant un identifiant (`:id`, `caseId`, `fingerprintId`) devra, une fois l'auth branchée, restreindre l'accès au **propriétaire/tenant** (anti-**IDOR/BOLA**) ; les opérations sensibles devront être réservées par **rôle** (**RBAC**), via un Guard côté serveur. Aujourd'hui aucun guard n'est appliqué → **IDOR par défaut**. Pour le détail OWASP (mass assignment, exposition de données, uploads, CORS, `/media`…), **déléguer à `api-security`** et ne pas dupliquer ici.

```bash
rtk grep -rn "UseGuards\|APP_GUARD" app/src/investigation app/src/biometrics   # attendu : vide aujourd'hui
```

---

## Sévérité & rapport

| Sévérité | Critère | Action |
|---|---|---|
| 🔴 **Critical** | Viole la dependency rule / la frontière de contexte / Liskov ; mock à la place d'un InMemory sur un chemin critique ; IDOR exploitable | Corriger avant merge |
| ⚠️ **Warning** | SRP/OCP/DIP entamés, abstraction prématurée (YAGNI) ou DRY mal appliqué, domaine qui s'anémie | Corriger ou justifier |
| 💡 **Info** | Suggestion de refactor, nommage, hygiène | À discuter |

Format de rapport : réutiliser celui de **`back-review`** (Résumé → Findings 🔴/⚠️/💡 avec `fichier:ligne` · principe · what · why · fix → Points positifs → Prochaines étapes), en taguant chaque finding par le **principe** (Dependency rule, SRP, Liskov, Anemic domain, Mocks-not-stubs, Context boundary, IDOR…). **Verdict final : ✅ design sain / 🔴 à retravailler + bloquants.**

Une décision de design structurante prise pendant la review (ex. introduire un événement, changer une frontière de contexte, accepter une dette) → **écrire un ADR** (`docs/adr/`).

## Heuristiques des auteurs (références — chargées au besoin)

| Auteur | Idées appliquées ici |
|---|---|
| **Robert C. Martin (Uncle Bob)** | *Clean Architecture* (dependency rule, « la DB/le web sont des détails », screaming architecture) ; **SOLID** ; *Clean Code* (noms, fonctions courtes, une seule responsabilité). |
| **Martin Fowler** | *Refactoring* & catalogue de **code smells** ; **AnemicDomainModel** (anti-pattern) ; **Tell-Don't-Ask** ; **ValueObject** ; **« Mocks Aren't Stubs »** (classicist vs mockist) ; **« Yagni »**. |
| **Udi Dahan** | **Autonomie des bounded contexts** ; référence inter-contexte **par ID** ; méfiance du **generic repository** ; couplage & frontières de service ; les **domain events** comme outil de découplage (à n'introduire que sur besoin réel, acté en ADR). |

> Citer un auteur n'est utile que **relié à un finding concret du diff**. Pas de name-dropping : « ceci viole la dependency rule (Clean Architecture) — `fichier:ligne` importe Prisma dans `domain/` ; sortir l'accès DB derrière le port `XxxRepository` ».
