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
- [Node.js](https://nodejs.org/) + [pnpm](https://pnpm.io/installation) (uniquement pour les commandes Prisma en local)

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

### 2. Démarrer l'environnement de développement

```bash
make dev
```

Au premier lancement, ou après modification du `Dockerfile` ou des dépendances :

```bash
make dev-build
```

L'API est disponible sur `http://localhost:<PORT>`.

---

## Commandes Makefile

### Développement

| Commande       | Description                                                    |
|----------------|----------------------------------------------------------------|
| `make dev`     | Lance l'app en mode dev avec hot-reload (Docker watch)        |
| `make dev-build` | Rebuild les images Docker puis lance en mode dev             |
| `make down`    | Arrête tous les services Docker                               |
| `make logs`    | Affiche les logs de l'app en temps réel                       |

### Accès aux containers

| Commande   | Description                                    |
|------------|------------------------------------------------|
| `make exec` | Ouvre un shell `sh` dans le container app    |
| `make db`   | Ouvre un shell `psql` sur la base PostgreSQL |

### Base de données & migrations

| Commande                            | Description                                                         |
|-------------------------------------|---------------------------------------------------------------------|
| `make migrate NAME=<nom>`           | Crée et applique une nouvelle migration Prisma                      |
| `make migrate-deploy`               | Applique les migrations sans générer de fichier (usage production)  |
| `make migrate-reset`                | Remet la base à zéro et réapplique toutes les migrations            |

Exemple :

```bash
make migrate NAME=add-user-table
```

### Tests

| Commande                          | Description                                          |
|-----------------------------------|------------------------------------------------------|
| `make test`                       | Lance tous les tests                                 |
| `make test FILE=src/foo/foo.spec.ts` | Lance un fichier de test spécifique               |
| `make test-watch`                 | Lance les tests en mode watch                        |
| `make test-watch FILE=src/foo/foo.spec.ts` | Mode watch sur un fichier spécifique         |

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
