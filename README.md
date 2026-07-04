# back-minuseek

API backend du projet **Minuseek**, construite avec [NestJS](https://nestjs.com/) et [Prisma](https://www.prisma.io/), containerisée avec Docker.

## Stack technique

- **Runtime** : Node.js
- **Framework** : NestJS 11 (TypeScript)
- **ORM** : Prisma 7 + PostgreSQL 17
- **Package manager** : pnpm
- **Containerisation** : Docker Compose avec hot-reload natif (`docker compose watch`)

## Prérequis

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- [Node.js](https://nodejs.org/) + [pnpm](https://pnpm.io/installation) (optionnel, uniquement pour le confort IDE/TypeScript en local — les migrations et l'app tournent dans Docker)

## Installation

### 1. Variables d'environnement

```bash
cp .env.example .env
```

Édite `.env` avec tes valeurs :

| Variable       | Description                          | Exemple                                           |
|----------------|--------------------------------------|---------------------------------------------------|
| `PORT`         | Port exposé par l'API                | `3000`                                            |
| `DB_HOST`      | Hôte de la base de données           | `localhost`                                       |
| `DB_PORT`      | Port PostgreSQL                      | `5432`                                            |
| `DB_NAME`      | Nom de la base                       | `minuseek_dev`                                    |
| `DB_USER`      | Utilisateur PostgreSQL               | `minuseek`                                        |
| `DB_PASSWORD`  | Mot de passe PostgreSQL              | `change_me`                                       |
| `DATABASE_URL` | URL de connexion complète (Prisma)   | `postgresql://user:pass@localhost:5432/dbname`    |
| `STORAGE_DRIVER` | Stockage des images : `gcs` (défaut) ou `in-memory` (hors-ligne, sans persistance) | `gcs` |
| `GCS_BUCKET`   | Bucket GCS des images                | `minuseek-media-dev`                              |
| `GCS_SIGNED_URL_TTL_SECONDS` | Durée de vie des URLs signées | `900`                                     |

### 2. Accès au bucket d'images : créer l'ADC (une fois par poste)

Les images vont dans le **vrai bucket GCS de dev** (`minuseek-media-dev`),
même en local — il n'existe pas d'émulateur GCS local, et utiliser le vrai
bucket rend le dev représentatif de la prod (URLs signées V4, CORS, IAM
identiques). Voir `docs/adr/0003-gcs-only-image-storage.md`.

Chaque dev de l'équipe a déjà les droits d'impersonation. Setup unique :

```bash
CLOUDSDK_CONFIG="$HOME/.config/gcloud-minuseek" gcloud auth application-default login \
  --impersonate-service-account=back-runtime@dev-minuseek.iam.gserviceaccount.com
```

Le navigateur s'ouvre : connectez-vous avec votre compte Google d'équipe
(celui qui a les droits GCP). `CLOUDSDK_CONFIG` isole ce credential dans
`~/.config/gcloud-minuseek/` pour ne pas écraser votre ADC par défaut si
vous en avez un. Le compose monte ce fichier dans le conteneur (chemin
surchargeable via la variable d'environnement `GCLOUD_ADC`).

⚠️ Lancez cette commande **avant** le premier `make dev` : si le fichier
n'existe pas, Docker crée un dossier vide à sa place (dans ce cas,
`rm -rf ~/.config/gcloud-minuseek` et recommencez).

(Prérequis : [gcloud CLI](https://cloud.google.com/sdk/docs/install) installé,
connexion avec le compte google que vous m'avez envoyé sur discord.)

### 3. Premier démarrage : `make all`

```bash
make all
```

Une seule commande, depuis zéro : installe les dépendances, lance le stack
(Postgres + Keycloak + app), attend que Keycloak soit prêt, puis **bootstrappe
le multi-tenant** :

1. crée la base système `minuseek_admin` + le registre des tenants ;
2. crée le client confidentiel `minuseek-provisioner` sur le realm `master`
   local et écrit son secret dans `.env` (`make keycloak-setup`) ;
3. provisionne l'organisation de démo via la **vraie saga SUP-03**
   (`make provision SLUG=tenant-demo NAME="Tenant démo"`) : realm
   `minuseek-tenant-demo`, base `minuseek_tenant_demo` migrée, ligne
   `Organization`, inscription au registre.

`make all` est **idempotent** : rejouable sans danger. L'API écoute ensuite sur
`http://localhost:<PORT>` ; connecte-toi sur le front (`/tenant-demo`) avec le
user `demo` / `demo` importé dans le realm (`keycloak/dev/minuseek-demo-realm.json`).

### 4. Démarrages suivants : `make dev`

```bash
make dev
```

Les données (registre, bases tenant, realms Keycloak) vivent dans des **volumes
Docker persistants** : `make down` ne les supprime pas, donc `make dev` suffit
au quotidien — il ne re-bootstrappe rien.

Deux exceptions :
- **une nouvelle migration a été ajoutée** → `make migrate-all` (fan-out du
  schéma métier sur toutes les bases tenant) ; `make dev` seul ne migre rien ;
- **tu as supprimé les volumes** (`docker volume rm dev_postgres_data dev_keycloak_data`,
  ex. pour repartir propre) → relance `make all`.

Pour ajouter d'autres organisations de test (isolation) :

```bash
make provision SLUG=demo2 NAME="Labo 2"
```

> `make dev` / `make all` créent le réseau Docker partagé `minuseek` s'il
> n'existe pas — le front le rejoint via le nom de service `app`.

---

## Commandes Makefile

### Développement

| Commande       | Description                                                    |
|----------------|----------------------------------------------------------------|
| `make all`     | **Premier lancement** : install + stack + bootstrap multi-tenant (idempotent) |
| `make install` | Installe les dépendances Node dans `app/`                     |
| `make dev`     | Lancements suivants : app en mode dev avec hot-reload (Docker watch) |
| `make dev-build` | Rebuild les images Docker puis lance en mode dev             |
| `make down`    | Arrête tous les services Docker (conserve les volumes)        |
| `make network` | Crée le réseau Docker partagé `minuseek` (idempotent)        |
| `make logs`    | Affiche les logs de l'app en temps réel                       |

### Accès aux containers

| Commande   | Description                                    |
|------------|------------------------------------------------|
| `make exec` | Ouvre un shell `sh` dans le container app    |
| `make db`   | Ouvre un shell `psql` sur la base PostgreSQL |

### Multi-tenant (bootstrap & provisioning)

| Commande                            | Description                                                              |
|-------------------------------------|--------------------------------------------------------------------------|
| `make bootstrap`                    | Registre admin + client provisioner + organisation de démo (appelé par `make all`) |
| `make keycloak-setup`               | Crée le client `minuseek-provisioner` sur le `master` local, secret → `.env` |
| `make provision SLUG=<s> NAME="<n>"` | Provisionne une organisation via la saga SUP-03 (realm + base + registre) |
| `make migrate-all`                  | Fan-out : migre le registre admin puis **chaque base tenant**            |

### Base de données & migrations

| Commande                            | Description                                                              |
|-------------------------------------|--------------------------------------------------------------------------|
| `make migrate NAME=<nom>`           | Crée une migration à partir des modèles (atelier de schéma `minuseek_dev`) |
| `make migrate-deploy`               | Applique les migrations en attente sans générer de fichier               |
| `make migrate-admin-setup`          | Crée `minuseek_admin` + migration initiale du registre                   |
| `make migrate-admin NAME=<nom>`     | Crée + applique une migration sur le schéma admin                        |
| `make migrate-reset`                | ⚠️ **DEV only, destructif** — remet la base à zéro et rejoue les migrations |

Exemple :

```bash
make migrate NAME=add-user-table
```

> Voir la section [Migrations de base de données](#migrations-de-base-de-données) pour le détail du workflow.

### Tests

| Commande                          | Description                                          |
|-----------------------------------|------------------------------------------------------|
| `make test`                       | Lance tous les tests                                 |
| `make test FILE=src/foo/foo.spec.ts` | Lance un fichier de test spécifique               |
| `make test-watch`                 | Lance les tests en mode watch                        |
| `make test-watch FILE=src/foo/foo.spec.ts` | Mode watch sur un fichier spécifique         |

---

## Migrations de base de données

Les migrations Prisma sont **versionnées dans le repo** (`app/prisma/migrations/`) et **exécutées dans Docker**. Pas besoin de Node ni de Prisma installés sur ta machine.

### Deux opérations à ne pas confondre

|            | Créer une migration                                  | Appliquer les migrations                       |
|------------|------------------------------------------------------|------------------------------------------------|
| Commande   | `make migrate NAME=<nom>`                             | automatique au `make dev`                      |
| Rôle       | Génère le SQL à partir des modèles (`schema.prisma`) | Exécute les fichiers SQL existants             |
| Quand      | Quand tu modifies un modèle                          | À chaque démarrage de l'app                    |
| Effet      | Crée un fichier `.sql` **à commiter**                | Non destructif (CREATE/ALTER/DROP, forward)    |

### Créer une migration

1. Modifie tes modèles dans `app/prisma/models/*.prisma`.
2. Génère la migration (tourne dans un conteneur jetable, écrit le fichier dans le repo) :

   ```bash
   make migrate NAME=add_layers
   ```

3. **Commite** le dossier généré `app/prisma/migrations/<timestamp>_add_layers/` avec ton code.

### Appliquer les migrations

- `make dev` applique automatiquement les migrations en attente au démarrage (`prisma migrate deploy`).
- Manuellement : `make migrate-deploy`.

### Récupérer le travail d'un collègue (après un `git pull`)

```bash
git pull
make dev
```

Les migrations sont appliquées automatiquement au démarrage : **rien d'autre à faire**.

> Si tu avais déjà une base locale avant le pull et que Prisma signale un « drift », remets ta base de dev à zéro une fois : `make migrate-reset` puis `make dev`.

### Règles d'or ⚠️

1. **Ne modifie jamais une migration déjà appliquée/commitée.** Besoin d'un changement → **nouvelle** migration.
2. **Commite toujours** le fichier de migration avec le changement de schéma : une migration absente du repo n'existe pas pour les autres.
3. La CI échoue si un changement de schéma n'a pas sa migration.

### En cas de « drift » (dev uniquement)

Le **drift** survient quand l'historique en base ne correspond plus aux fichiers (typiquement : une migration appliquée a été modifiée après coup). Prisma refuse alors de générer de nouvelles migrations. En développement, la base est jetable : on la remet à zéro et on rejoue toutes les migrations.

```bash
make migrate-reset
```

> ⚠️ Efface toutes les données locales — **jamais en production**. En respectant les règles d'or, le drift n'arrive pas.

---

## Codegraph (AI agents)

Le projet utilise [codegraph](https://github.com/anthropics/codegraph) comme serveur MCP pour permettre aux agents IA (Claude Code, Antigravity, Cursor…) d'explorer le graphe de dépendances du code (callers, callees, impact analysis…).

La configuration est déjà en place dans [`.mcp.json`](.mcp.json) — rien à faire si tu utilises un IDE compatible. Pour que ça fonctionne, `codegraph` doit être installé sur ta machine :

```bash
npm install -g @anthropics/codegraph   # installation globale
```

---

## Structure du projet

```
back-minuseek/
├── app/
│   ├── src/
│   │   ├── investigation/       # Module investigation (architecture DDD)
│   │   │   ├── application/     # Use cases, services applicatifs
│   │   │   ├── domain/          # Entités, interfaces, logique métier
│   │   │   └── infrastructure/  # Repos, adapters, controllers
│   │   ├── prisma/              # Module Prisma (client partagé)
│   │   └── app.module.ts        # Module racine NestJS
│   └── prisma/
│       ├── schema.prisma        # Schéma de la base de données
│       └── migrations/          # Historique des migrations SQL
├── docker/
│   └── dev/
│       ├── Dockerfile
│       └── compose.yml
├── Makefile
└── .env.example
```

## AI agents

### Ce que ça apporte

- **`AGENTS.md`** — conventions du repo (+ section « Directives agents » DO/DON'T) ; **`CLAUDE.md`** = `@AGENTS.md`.
- **`.agents/skills/`** — skills maison versionnés (review pré-PR, archi & principes, sécurité, etc.), exposés à Claude via le lien symbolique `.claude/skills` et lus nativement par Codex/antigravity.
- **`.agents/rules/`** — règles pour Antigravity (lien symbolique vers `AGENTS.md`).
- **`.mcp.json`** — serveur MCP **codegraph** pour le repo, n'hésitez pas à mettre d'autres mcp utiles.
- **`RTK.md`** — règle d'usage de **rtk** (proxy CLI qui économise les tokens).
- **`docs/adr/`** — gabarit d'ADR : on consigne les décisions structurantes.

### À faire par chaque dev (une fois par poste)

```bash
brew install codegraph rtk        # les 2 binaires requis
rtk init -g                       # hook d'auto-réécriture (économie de tokens) — recommandé mais pas obligatoire
```

- **Claude Code** : approuver le serveur MCP `codegraph` au 1er lancement (prompt automatique sur `.mcp.json`).
- **Codex** : ajouter une fois `[mcp_servers.codegraph]\ncommand = "codegraph"\nargs = ["serve","--mcp"]` dans `~/.codex/config.toml`.
- **Windows uniquement** : si les liens symboliques apparaissent comme des fichiers texte → `git config core.symlinks true` puis re-checkout.

### Skills IA (`.agents/skills/`)

Les **skills** sont des instructions spécialisées que l'agent IA charge automatiquement selon le contexte de votre demande. Vous n'avez **rien à activer manuellement** : l'agent détecte les mots-clés dans votre prompt et charge le skill adapté. Vous pouvez aussi les invoquer explicitement en mentionnant leur nom.

| Skill | Quand ça se déclenche | Exemple de prompt |
|---|---|---|
| `back-review` | Review de code / PR / diff back, audit sécurité, avant un merge sur `main` | *« Réalise une review complete de ma branche »* |
| `architecture-review` | Doute sur le placement du code, couplage, honnêteté des tests | *« est-ce que mon service est trop couplé ? »* |
| `api-security` | Audit sécurité OWASP, vérification d'un endpoint | *« vérifie la sécurité de cet endpoint »* |
| `clean-ddd-hexagonal` | Design d'API, refactoring, structure hexagonale / DDD / CQRS | *« refactore ce module en archi hexagonale / Est ce que mon code respecte les principes de l'architecture hexagonale ? »* |
| `domain-driven-design` | Modélisation métier, bounded contexts, agrégats | *« comment découper ce domaine en aggregates ? »* |
| `hexagonal-architecture` | Ports & adapters, découplage infra, testabilité | *« ajoute un port pour ce service externe »* |
| `product-brainstorming` | Brainstorming produit, exploration de problème | *« brainstorm avec moi sur cette feature »* |
