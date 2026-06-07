-include .env
export

COMPOSE = docker compose -f docker/dev/compose.yml --env-file .env
NETWORK = minuseek

.PHONY: network dev dev-build down db exec install migrate migrate-deploy migrate-reset test test-watch logs

## Crée le réseau Docker partagé avec le front s'il n'existe pas (idempotent)
network:
	@docker network inspect $(NETWORK) >/dev/null 2>&1 || docker network create $(NETWORK)

## Lance l'app en mode dev avec hot-reload (Docker watch)
dev: network
	$(COMPOSE) up -d && $(COMPOSE) watch

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

## Crée et applique une migration (make migrate NAME=init-investigation-case)
migrate:
	cd app && npx prisma migrate dev --name $(NAME)

## Applique les migrations en prod sans générer de fichier (make migrate-deploy)
migrate-deploy:
	cd app && npx prisma migrate deploy

## Remet la DB à zéro et réapplique toutes les migrations (make migrate-reset)
migrate-reset:
	cd app && npx prisma migrate reset

## Lance les tests — tous par défaut, ou un fichier spécifique (make test FILE=src/foo/foo.spec.ts)
test:
	cd app && pnpm jest $(FILE)

## Lance les tests en mode watch (make test-watch FILE=src/foo/foo.spec.ts)
test-watch:
	cd app && pnpm jest --watch $(FILE)

## Affiche les logs de l'app en temps réel
logs:
	$(COMPOSE) logs -f app
