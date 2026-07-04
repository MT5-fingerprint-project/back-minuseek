-include .env
export

COMPOSE = docker compose -f docker/dev/compose.yml --env-file .env
NETWORK = minuseek

.PHONY: all bootstrap keycloak-relax-ssl network dev dev-build down db exec install keycloak-setup provision migrate migrate-deploy migrate-reset migrate-admin-setup migrate-admin migrate-all test test-watch logs

## Tout, depuis zéro : install + stack + bootstrap + hot-reload. Rejouable sans danger. Ou a faire apres un reset de la DB. (make all)
all:
	@test -f .env || { echo "❌ .env manquant : cp .env.example .env d'abord"; exit 1; }
	$(MAKE) install
	$(MAKE) network
	$(COMPOSE) up --build -d
	$(MAKE) bootstrap
	$(COMPOSE) watch

## 1er lancement 
bootstrap:
	@echo "⏳ attente de Keycloak local…"
	@until curl -sf http://localhost:8080/ >/dev/null 2>&1; do sleep 2; done
	$(MAKE) keycloak-relax-ssl
	$(MAKE) migrate-admin-setup
	$(MAKE) keycloak-setup
	$(MAKE) provision SLUG=tenant-demo NAME="Tenant démo"

## DEV only : 
keycloak-relax-ssl:
	$(COMPOSE) exec -T keycloak /opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master --user $(KC_BOOTSTRAP_ADMIN_USERNAME) --password $(KC_BOOTSTRAP_ADMIN_PASSWORD)
	$(COMPOSE) exec -T keycloak /opt/keycloak/bin/kcadm.sh update realms/master -s sslRequired=NONE

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

## Client confidentiel minuseek-provisioner sur le master local (idempotent),
## secret écrit dans .env — prérequis one-time du provisioning
keycloak-setup:
	sh scripts/keycloak-setup.sh

## Provisionne une organisation via la vraie saga SUP-03 (make provision SLUG=demo2 NAME="Labo 2")
provision:
	$(COMPOSE) run --rm app pnpm ts-node src/organization/infrastructure/cli/create-organization.cli.ts $(SLUG) "$(NAME)"

## Migre le schéma admin puis fan-out du schéma métier sur chaque base tenant du registre
## (équivalent local du job de migration déployé)
migrate-all:
	$(COMPOSE) run --rm app sh scripts/migrate-all.sh

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
