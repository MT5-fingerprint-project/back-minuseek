-include .env
export

COMPOSE = docker compose -f docker/dev/compose.yml --env-file .env

.PHONY: dev dev-build down db test test-watch logs

## Lance l'app en mode dev avec hot-reload (Docker watch)
dev:
	$(COMPOSE) up -d && $(COMPOSE) watch

## Rebuild les images puis lance en mode dev
dev-build:
	$(COMPOSE) up --build -d && $(COMPOSE) watch

## Arrête tous les services
down:
	$(COMPOSE) down

## Ouvre un shell psql sur la DB (make db)
db:
	$(COMPOSE) exec postgres psql -U $(DB_USER) -d $(DB_NAME)

## Lance les tests — tous par défaut, ou un fichier spécifique (make test FILE=src/foo/foo.spec.ts)
test:
	cd app && pnpm jest $(FILE)

## Lance les tests en mode watch (make test-watch FILE=src/foo/foo.spec.ts)
test-watch:
	cd app && pnpm jest --watch $(FILE)

## Affiche les logs de l'app en temps réel
logs:
	$(COMPOSE) logs -f app
