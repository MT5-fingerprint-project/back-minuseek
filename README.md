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

### 2. Installer les dépendances

```bash
make install
```

Les `node_modules` sont montés en volume dans le container — cette commande est requise avant le premier `make dev` et après chaque ajout de package.

### 3. Démarrer l'environnement de développement

```bash
make dev
```

Au premier lancement, ou après modification du `Dockerfile` :

```bash
make dev-build
```

L'API est disponible sur `http://localhost:<PORT>`.

> `make dev` crée automatiquement le réseau Docker partagé `minuseek` s'il n'existe pas.
> Ce réseau permet au front (proxy Vite) de joindre le back via le nom de service `app`
> sans dépendre de l'ordre de démarrage des deux projets.

---

## Commandes Makefile

### Développement

| Commande       | Description                                                    |
|----------------|----------------------------------------------------------------|
| `make install` | Installe les dépendances Node dans `app/`                     |
| `make dev`     | Lance l'app en mode dev avec hot-reload (Docker watch)        |
| `make dev-build` | Rebuild les images Docker puis lance en mode dev             |
| `make down`    | Arrête tous les services Docker                               |
| `make network` | Crée le réseau Docker partagé `minuseek` (idempotent)        |
| `make logs`    | Affiche les logs de l'app en temps réel                       |

### Accès aux containers

| Commande   | Description                                    |
|------------|------------------------------------------------|
| `make exec` | Ouvre un shell `sh` dans le container app    |
| `make db`   | Ouvre un shell `psql` sur la base PostgreSQL |

### Base de données & migrations

| Commande                            | Description                                                              |
|-------------------------------------|--------------------------------------------------------------------------|
| `make migrate NAME=<nom>`           | Crée une migration à partir des modèles et l'applique à la DB dev        |
| `make migrate-deploy`               | Applique les migrations en attente sans générer de fichier               |
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
