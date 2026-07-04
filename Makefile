-include .env
export

COMPOSE = docker compose -f docker/dev/compose.yml --env-file .env
NETWORK = minuseek

.PHONY: network dev dev-build down db exec install migrate migrate-deploy migrate-reset migrate-admin-setup migrate-admin seed-admin test test-watch logs

## Crée le réseau Docker partagé avec le front s'il n'existe pas (idempotent)
network:
	@docker network inspect $(NETWORK) >/dev/null 2>&1 || docker network create $(NETWORK)

## Lance l'app en mode dev avec hot-reload (Docker watch)
dev: network
	$(COMPOSE) up --build -d && $(COMPOSE) watch

## Rebuild les images puis lance en mode dev
dev-build: network
	$(COMPOSE) up --build -d && $(COMPOSE) watch

## Arrête tous les services
down:
	$(COMPOSE) down

## Installe les dépendances Node dans app/ (requis avant make dev)
install:
	pnpm install --dir app

## Ouvre un shell bash dans le container app (make exec)
exec:
	$(COMPOSE) exec app sh

## Ouvre un shell psql sur la DB (make db)
db:
	$(COMPOSE) exec postgres psql -U $(DB_USER) -d $(DB_NAME)

## 1er lancement uniquement : crée la DB admin et joue la migration initiale du registre de tenants
migrate-admin-setup:
	$(COMPOSE) exec postgres psql -U $(DB_USER) -d postgres -c 'CREATE DATABASE minuseek_admin;' || true
	$(COMPOSE) run --rm app pnpm prisma migrate deploy --config=prisma-admin.config.ts

## Crée une migration admin à partir du schéma prisma-admin (make migrate-admin NAME=...)
migrate-admin:
	$(COMPOSE) run --rm app pnpm prisma migrate dev --name $(NAME) --config=prisma-admin.config.ts

## Amorce le registre local avec le tenant de démo (upsert, rejouable) — requis pour l'auth multi-realm
seed-admin:
	$(COMPOSE) run --rm app pnpm ts-node prisma-admin/seed.ts

## Crée une migration à partir des modèles ET l'applique à la DB dev (make migrate NAME=add_layers)
## Tourne dans un conteneur jetable : le fichier généré atterrit dans app/prisma/migrations (à commiter)
migrate:
	$(COMPOSE) run --rm app pnpm prisma migrate dev --name $(NAME)

## Applique les migrations en attente sans rien générer (make migrate-deploy)
migrate-deploy:
	$(COMPOSE) run --rm app pnpm prisma migrate deploy

## Réparation ponctuelle : remet la DB à zéro et rejoue toutes les migrations (DEV ONLY, destructif)
migrate-reset:
	$(COMPOSE) run --rm app pnpm prisma migrate reset --force

## Lance les tests — tous par défaut, ou un fichier spécifique (make test FILE=src/foo/foo.spec.ts)
test:
	cd app && pnpm jest $(FILE)

## Lance les tests en mode watch (make test-watch FILE=src/foo/foo.spec.ts)
test-watch:
	cd app && pnpm jest --watch $(FILE)

## Affiche les logs de l'app en temps réel
logs:
	$(COMPOSE) logs -f app
