# AGENTS.md

Guide pour les agents IA **et** les humains qui travaillent sur `back-minuseek`.
API du projet Minuseek— **NestJS 11 + Prisma 7 + PostgreSQL 17**, en **DDD / architecture hexagonale**.

> Le code applicatif vit dans `app/`. Docker, Makefile et CI sont à la racine.

## Directives agents (DO / DON'T)

> **Avant de coder, explore le code avec codegraph** (`codegraph_explore`) plutôt que grep/lire à l'aveugle. Préfère les wrappers **`rtk`** aux commandes brutes pour économiser le contexte : `rtk git`, `rtk grep`, `rtk read`, `rtk pnpm`, `rtk test`, `rtk tsc`, `rtk lint`, `rtk prisma`.

✅ **À faire**
- Garder `domain/` **framework-free** (zéro `@nestjs/*`, `@prisma/*`, `class-validator`).
- Faire passer le controller par un **handler**, jamais un repository directement.
- Valider à la frontière (DTO + `ValidationPipe`) ; traduire les erreurs domaine → HTTP dans le controller.
- Communiquer entre bounded contexts **par UUID** uniquement.
- Toute évolution de schéma = **migration Prisma** (`make migrate NAME=...`).
- Lancer le skill **`back-review` avant chaque PR** ; viser un diff < 400 lignes.
- **Écrire un ADR** (`docs/adr/`, cf. `docs/adr/README.md`) dès qu'une décision structurante est prise (choix techno, trade-off d'archi, contrat d'API, sécurité, modèle de données).

❌ **À ne pas faire**
- Importer `infrastructure` depuis `application`/`domain` (sens de dépendance interdit).
- Mettre de la logique métier dans un controller, ou créer un God Service.
- Mocker un port au lieu d'utiliser un `InMemory*Repository`.
- Coder en dur un secret/une URL, ou laisser un `console.log` / code de debug.
- Éditer la DB à la main au lieu d'une migration.

## Stack

- **Runtime** : Node ≥ 22 — **Package manager** : pnpm 9 (`corepack enable`)
- **Framework** : NestJS 11 (TypeScript) — **ORM** : Prisma 7 (driver adapter `@prisma/adapter-pg`, sans query engine natif)
- **Base** : PostgreSQL 17 — **Conteneurs** : Docker Compose avec `docker compose watch` (hot-reload)
- **Tests** : Jest (`*.spec.ts` à côté du code)

## Démarrage

```bash
cp .env.example .env          # variables d'env (gitignoré)
# 1 fois par poste : les images vont dans le bucket GCS dev (ADR-0003)
gcloud auth application-default login \
  --impersonate-service-account=back-runtime@dev-minuseek.iam.gserviceaccount.com
make dev                      # build + up + watch (hot-reload)
make migrate-deploy           # OBLIGATOIRE au 1er lancement : la DB tenant démarre vide
make migrate-admin-setup      # OBLIGATOIRE au 1er lancement : crée minuseek_admin + registre des tenants
```


## Commandes (Makefile, à la racine)

| Commande | Rôle |
|---|---|
| `make dev` / `make dev-build` | Lance le stack (rebuild d'image avec `dev-build`) |
| `make down` / `make logs` | Stoppe le stack / suit les logs de l'app |
| `make exec` / `make db` | Shell dans le conteneur app / `psql` sur la DB |
| `make migrate NAME=<nom>` | Crée + applique une migration Prisma (schéma métier) |
| `make migrate-deploy` | Applique les migrations métier (sans en générer) |
| `make migrate-reset` | Reset complet de la DB métier |
| `make migrate-admin-setup` | 1er lancement : crée `minuseek_admin` + migration initiale |
| `make migrate-admin NAME=<nom>` | Crée + applique une migration sur le schéma admin |
| `make test [FILE=...]` | Lance les tests (un fichier si `FILE=`) |

Scripts pnpm (depuis `app/`) : `pnpm build`, `pnpm start:dev`, `pnpm lint`, `pnpm test`.

## Architecture — où va le code

Chaque *bounded context* est un dossier sous `app/src/`, découpé en 3 couches :

```
app/src/investigation/
├── domain/                         # Cœur métier — AUCUNE dépendance externe
│   ├── investigation-case.ts       # Aggregate root (constructeur privé + factory statique)
│   ├── investigation-case-status.vo.ts   # Value Object
│   └── ports/                      # Interfaces de repository (driven ports)
├── application/                    # Use cases (orchestration)
│   └── commands/<use-case>/
│       ├── *.command.ts            # DTO d'entrée du use case
│       └── *.handler.ts            # Implémentation du use case
└── infrastructure/                 # Adapters (le monde extérieur)
    ├── http/                       # Driver adapter : controller + DTO HTTP (class-validator)
    └── persistence/                # Driven adapters : prisma-*.repository, in-memory-*.repository
```

### Règle de dépendance (non négociable)

```
infrastructure  →  application  →  domain
                                   (ne dépend de rien)
```

- **`domain/` doit rester framework-free** : zéro import de `@nestjs/*`, `@prisma/*`, `class-validator`. Si tu ajoutes un de ces imports dans `domain/`, c'est une erreur d'architecture.
- Décider où placer du code : règle/invariant métier → `domain/` ; orchestration d'un cas d'usage → `application/` ; accès à un système externe (DB, HTTP, broker) → `infrastructure/`.

## Conventions

- **Repository** : une interface par *aggregate* dans `domain/ports/`, ses implémentations dans `infrastructure/persistence/`. Le lien port → adapter se fait par **token DI** dans le module (`investigation.module.ts`) — c'est le composition root, le repo est swappable.
- **Le controller appelle un handler**, jamais un repository directement.
- **Validation à la frontière** : DTO HTTP + `ValidationPipe` global. Le domaine ne valide que ses propres invariants.
- **Erreurs traduites aux frontières** : le controller catch les erreurs du domaine et les mappe en exceptions HTTP (ex. `CaseNumberAlreadyExistsError` → `409 ConflictException`).
- **Value Objects** : immuables, constructeur privé, factory statique auto-validante.
- **Nommage de fichiers** : kebab-case avec suffixe de rôle (`.vo.ts`, `.repository.ts`, `.handler.ts`, `.command.ts`, `.dto.ts`, `.controller.ts`).

## Tests

- **Domaine & use cases** : tests unitaires purs. Les handlers se testent en injectant un `InMemory*Repository` (pas de DB, pas de mock lourd) — voir `open-investigation-case.handler.spec.ts`.
- `make test` lance les `*.spec.ts` sous `src/`. Les tests e2e (`test/*.e2e-spec.ts`) tournent via `pnpm test:e2e`.

## Ajouter un use case (recette)

1. Modéliser dans `domain/` (entité/VO + invariants), garder la couche pure.
2. Si besoin de persistance, ajouter la méthode au port `domain/ports/*.repository.ts`.
3. Créer `application/commands/<use-case>/` avec `*.command.ts` (entrée) + `*.handler.ts` (orchestration).
4. Implémenter le port dans `infrastructure/persistence/` (Prisma + In-Memory pour les tests).
5. Exposer via un controller dans `infrastructure/http/` (+ DTO validé).
6. Câbler dans le module (provider du handler + binding token → adapter).
7. Tester : domaine + handler (In-Memory).

## Base de données / Prisma

- Schéma découpé : `app/prisma/schema.prisma` (datasource/generator) + modèles dans `app/prisma/models/*.prisma`.
- Le client est généré dans `app/generated/prisma` (gitignoré) par `prisma generate` (`postinstall`).
- Toute évolution de schéma passe par une migration (`make migrate NAME=...`), jamais en éditant la DB à la main.

## Points d'attention

- La DB démarre **vide** : lancer `make migrate-deploy` après le premier `make dev`.
- Ne pas committer `.env` (secrets) ; partir de `.env.example`.
- `pnpm-lock.yaml` doit être commité pour des installs reproductibles (Docker + CI).

## Agents IA & skills (multi-outils)

L'équipe utilise plusieurs agents (Claude Code, Codex, Antigravity…). Le setup est partagé et **committé** :

- **`AGENTS.md`** (ce fichier) — standard ouvert, lu nativement par Codex, Cursor, Copilot, Windsurf, Aider, Zed… (sous l'égide de la Linux Foundation).
- **`CLAUDE.md`** — importe ce fichier via `@AGENTS.md`, car Claude Code ne lit pas `AGENTS.md` nativement (feature request `anthropics/claude-code#34235`).
- **Skills du repo** : sous `.agents/skills/` (committé) — `back-review` (gate de review pré-PR), `architecture-review` (revue de fond archi & principes : hexagonal, SOLID/DRY/YAGNI, frontières de contexte, tests sans mock — inspiré Fowler / Uncle Bob / Udi Dahan), `api-security` (audit OWASP / IDOR / RBAC), les skills d'architecture de référence (`clean-ddd-hexagonal`, `domain-driven-design`, `hexagonal-architecture`), et `product-brainstorming`. Lus nativement par **Codex** (`$REPO_ROOT/.agents/skills`, et Codex **suit les symlinks**).
- **`.agents/rules/conventions.md` → `../../AGENTS.md`** — symlink committé pour **Google Antigravity**, qui lit `.agents/rules/` (règles toujours actives).

**Claude Code** ne découvre les skills que dans `.claude/skills/`, or `.claude/` est **gitignoré** (il contient `settings.local.json`, propre à chaque dev). Pour éviter toute copie manuelle (source de dérive), `.claude/skills` est un **lien symbolique committé** vers `.agents/skills/`. Au clone, git restaure le lien : **rien à faire**.

```bash
# Les liens sont déjà versionnés. À ne (re)créer qu'en cas de besoin :
ln -s ../.agents/skills .claude/skills
ln -s ../../AGENTS.md .agents/rules/conventions.md
```

Le `.gitignore` ne partage que ces liens (`.claude/*` ignoré, `!.claude/skills` ré-inclus) ; `settings.local.json` reste privé.

> **Source de vérité unique : `.agents/`.** Tu édites un skill à un seul endroit et tous les outils le voient : **Codex** lit `.agents/skills` nativement (et suit les symlinks), **Antigravity** lit `.agents/rules/`, **Claude Code** suit le lien `.claude/skills`. Pas de copie, pas de commande de sync.
>
> **Windows** : si les liens apparaissent comme de simples fichiers texte, exécute une fois `git config core.symlinks true` puis re-checkout.

@RTK.md
