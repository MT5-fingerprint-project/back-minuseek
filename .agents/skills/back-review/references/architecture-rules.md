# Architecture rules — review checklist (code réel)

> Les conventions de base (dependency rule, nommage des suffixes `.vo`/`.repository`/`.handler`/`.command`/`.dto`/`.controller`, ports/DI, recette use case) vivent dans `AGENTS.md` — **seule source de vérité**. Ce fichier ne les recopie pas : il liste ce qu'un reviewer vérifie **dans le code Minuseek réel**, en se concentrant sur les patterns et suffixes qu'`AGENTS.md` ne couvre pas (read-side CQRS : `.reader.ts`, `-read-model.ts` ; et `.error.ts`).

## Sommaire
- Structure par bounded context
- Dependency rule (pointeur AGENTS.md + exceptions réelles)
- Entités (write-side)
- Value Objects
- Domain errors
- Repositories (write-side)
- Read-side CQRS : readers + read-models (delta hors AGENTS.md)
- Commands / Queries / Handlers
- Controller → Bus
- Ports non-repository
- Composition root (module)

## Structure par bounded context
Chaque contexte sous `app/src/<ctx>/` :
```
domain/<aggregate>/{entity,value-objects?,repository,errors}/   # value-objects seulement si VO réels
application/
  commands/<use-case>/<use-case>.{command,handler}.ts
  queries/<q>/<q>.{query,handler}.ts + <entity>-read-model.ts + <entity>.reader.ts
  ports/                       # ports applicatifs non-repository (ex image-storage.port.ts)
infrastructure/
  http/                        # controller(s) à plat + dto/ (+ validators/ si besoin)
  persistence/                 # prisma-*.repository.ts, prisma-*.reader.ts, in-memory-*.{repository,reader}.ts
  storage/                     # adapters non-DB (local/in-memory image storage)
<ctx>.module.ts                # composition root
```
- [ ] Pas de fichiers à plat dans `domain/` : tout sous `domain/<aggregate>/...`.
- [ ] Un contexte PEUT avoir plusieurs aggregates et plusieurs controllers (ex. biometrics : `BiometricsController` pour traces/reference-prints, `LayersController` pour layers). Ne pas exiger l'uniformité 1 controller/contexte.
- [ ] `value-objects/` n'existe que si l'aggregate a de vrais VO (ReferencePrint et Layer n'en ont pas — OK).

## Dependency rule (pointeur AGENTS.md)
La règle complète + la liste exacte d'imports interdits sont **dans `AGENTS.md`** ; les greps de vérification sont dans `SKILL.md`. Ce que le reviewer doit savoir EN PLUS (exceptions réelles, non triviales) :
- [ ] `application/` peut importer `@nestjs/common` (`@Inject`) et `@nestjs/cqrs` (`@CommandHandler`/`@QueryHandler`/`ICommandHandler`) — exception pragmatique projet, **pas** une violation.
- [ ] Domaine n'importe ni application ni infrastructure. Application n'importe pas infrastructure. Controllers passent par `CommandBus`/`QueryBus`.

## Entités (write-side)
- [ ] Constructeur privé + factory statique (`open()`, `upload()`, `create()`).
- [ ] Propriétés privées préfixées `_`, getters publics. **Couverture des getters** : ⚠️ si des champs ne sont lisibles que via `toPrimitives()` (cas `Layer` : seuls `id`/`fingerprintId` ont un getter).
- [ ] `reconstitute()` + `toPrimitives()` pour le mapping persistence quand le repo recharge l'entité (Trace, ReferencePrint, Layer). `InvestigationCase` n'en a pas car ses lectures passent par le read-model — ne pas l'exiger.
- [ ] Pas de modèle anémique **si** le domaine a des règles : comportement métier sur l'entité (ex. `Trace.evaluate(score)` avec garde `InvalidTraceTransitionError`). Une entité sans règle métier (ReferencePrint) peut rester simple — ne pas inventer de comportement.
- [ ] Égalité par identité (`id`).

## Value Objects
- [ ] Constructeur privé, immuable, self-validating, factory nommée (`from(raw)`, `open()`…), fichier `<name>.vo.ts`.
- VO réels : `InvestigationCaseStatus`, `TraceStatus`, `ExploitabilityScore`. Ne pas exiger de VO inexistant (`CaseNumber`/`PvNumber` sont des `string`).
- [ ] L'erreur associée à un VO devrait vivre dans `errors/*.error.ts`, pas dans le `.vo.ts`. Écarts actuels : `InvalidInvestigationCaseStatusError` (dans `investigation-case-status.vo.ts`) et `InvalidTraceStatusError` (dans `trace-status.vo.ts`).

## Domain errors
- [ ] Hérite de `Error`, fichier `<description>.error.ts`, dans `domain/<aggregate>/errors/` (suffixe `.error.ts` non listé dans AGENTS.md → delta documenté ici).
- [ ] Message descriptif, **langue cohérente**. Mix FR/EN actuel à signaler (💡) : `LayerNotFoundError` EN `"Layer ${id} not found"` vs `TraceNotFoundError` FR `"Aucune trace trouvée avec l'identifiant..."`. NB : `InvalidTraceTransitionError` (transition de Trace) a un message EN ; `InvalidTraceStatusError` (validation du VO) un message FR. Grep le message exact avant de citer dans un rapport.

## Repositories (write-side)
- [ ] Port dans `domain/<aggregate>/repository/`, token exporté avec l'interface.
- [ ] Méthodes réelles : `save()`, `findById()` ou `existsBy*()`, `delete()`. **Pas** de `findAll`/`list` ici (c'est le rôle du reader). Ne pas reprocher l'absence de `findAll`.
- [ ] Le repo renvoie des entités domaine, jamais des types Prisma bruts.
- [ ] Fake `in-memory-*.repository.ts` existe pour les tests.

## Read-side CQRS : readers + read-models (delta hors AGENTS.md)
Pattern clé du projet, **absent d'`AGENTS.md`** — c'est ici qu'il est documenté :
- [ ] Chaque query a 4 fichiers dans `application/queries/<q>/` : `<q>.query.ts`, `<q>.handler.ts`, `<entity>-read-model.ts` (interface plate), `<entity>.reader.ts` (port + token).
- [ ] Le query handler injecte le reader par token et délègue ; il ne charge PAS l'entité domaine.
- [ ] Impl Prisma `prisma-*.reader.ts` + fake `in-memory-*.reader.ts` dans `infrastructure/persistence/`.
- [ ] Le read-model est un type plat ; les readers le renvoient (pas un DTO `@nestjs`).
- [ ] ⚠️ Le fake reader/repo doit reproduire le **contrat d'ordre** du reader Prisma (tri + tie-breaker). Voir `project-risks.md`.
- Note : un fake peut implémenter à la fois le port write ET read (ex. `InMemoryLayerRepository implements LayerRepository, LayerReader`) — acceptable.

## Commands / Queries / Handlers
- [ ] Command : props `public readonly`, aucune logique (nommage des suffixes : voir AGENTS.md).
- [ ] Handler : `@CommandHandler`/`@QueryHandler`, suffixe court `Handler` (pas `CommandHandler`). Orchestre, ne porte pas la règle métier.
- [ ] Command handler de création retourne l'id ; query handler retourne un read-model / `PageDto`.

## Controller → Bus
- [ ] Injecte `CommandBus`/`QueryBus`. Écritures → `commandBus.execute`, lectures → `queryBus.execute`.
- [ ] Traduction erreur domaine → HTTP dans le controller (try/catch : `*NotFoundError` → 404, `*AlreadyExistsError` → 409). Pas d'ExceptionFilter global aujourd'hui — OK.

## Ports non-repository
- [ ] Ports d'infra consommés par les use cases (ex. `ImageStoragePort`) dans `application/ports/`, adapters dans `infrastructure/storage/`. Token cohérent avec le reste.

## Composition root (module)
- [ ] Importe `CqrsModule`, enregistre les handlers en providers, lie chaque port à son adapter via `{ provide: TOKEN, useClass: PrismaAdapter }` (repository ET reader).
- [ ] Non `@Global()` (sauf shared). Le binding `ID_GENERATOR` peut venir d'un module shared — ne pas le réclamer dans le module de contexte.
- [ ] **Tokens DI — cohérence du TYPE de token** : `AGENTS.md` impose un token DI mais ne tranche pas Symbol vs string. Le code mélange : `Layer` en `Symbol`, tout le reste en string. Le flaguer comme suggestion de cohérence (💡), **sans** l'attribuer à une convention écrite d'`AGENTS.md`.
