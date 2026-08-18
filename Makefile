-include .env
export

# ⚠️ Piège : make charge .env UNE FOIS (au parse) et exporte tout — or
# keycloak-setup.sh RÉÉCRIT .env (secret provisioner) pendant le bootstrap, et
# docker compose donne priorité à l'env du shell sur --env-file. Toute cible
# compose qui doit voir le .env À JOUR doit donc passer par un sous-make
# ($(MAKE) cible), qui relit .env. Ne pas "simplifier" en appels directs.

COMPOSE = docker compose -f docker/dev/compose.yml --env-file .env
NETWORK = minuseek

# Base de la suite d'intégration : jetable, hors du stack de dev, sur un port
# qui lui est propre (le 5432 de la machine est régulièrement pris par un autre
# projet). Surchargeables depuis .env si le 5433 est lui aussi occupé.
INTEGRATION_DB_NAME ?= minuseek_integration
INTEGRATION_DB_PORT ?= 5433
INTEGRATION_DATABASE_URL ?= postgresql://$(DB_USER):$(DB_PASSWORD)@localhost:$(INTEGRATION_DB_PORT)/$(INTEGRATION_DB_NAME)
COMPOSE_TEST = $(COMPOSE) --profile test

.PHONY: setup-dev bootstrap wait-postgres keycloak-relax-ssl network dev dev-build up-watch down reset db exec install keycloak-setup system-realm provision migrate migrate-deploy migrate-reset migrate-admin-setup migrate-admin migrate-all test test-watch test-integration test-integration-down logs

## Setup local complet : install + stack + bootstrap + hot-reload. Rejouable sans danger. Ou a faire apres un reset de la DB. (make setup-dev)
setup-dev:
	@test -f .env || { echo "❌ .env manquant : cp .env.example .env d'abord"; exit 1; }
	$(MAKE) install
	$(MAKE) network
	$(COMPOSE) build app
	$(COMPOSE) up -d postgres keycloak-db keycloak adminer
	$(MAKE) bootstrap
	$(MAKE) up-watch

up-watch:
	$(COMPOSE) up -d app
	$(COMPOSE) watch

## 1er lancement 
bootstrap:
	@echo "⏳ attente de Keycloak local…"
	@until curl -sf http://localhost:8080/ >/dev/null 2>&1; do sleep 2; done
	$(MAKE) keycloak-relax-ssl
	$(MAKE) wait-postgres
	$(MAKE) migrate-admin-setup
	$(MAKE) keycloak-setup
	$(MAKE) system-realm
	$(MAKE) provision SLUG=tenant-demo NAME="Tenant démo"

wait-postgres:
	@echo "⏳ attente de PostgreSQL local…"
	@until $(COMPOSE) exec -T postgres pg_isready -U $(DB_USER) -d $(DB_NAME) >/dev/null 2>&1; do sleep 1; done

## DEV only : 
keycloak-relax-ssl:
	$(COMPOSE) exec -T keycloak /opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master --user $(KC_BOOTSTRAP_ADMIN_USERNAME) --password $(KC_BOOTSTRAP_ADMIN_PASSWORD)
	$(COMPOSE) exec -T keycloak /opt/keycloak/bin/kcadm.sh update realms/master -s sslRequired=none

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

## DEV only, destructif : arrête tout ET détruit les volumes (DB métier, admin,
## bases tenant, Keycloak). À enchaîner avec make setup-dev pour repartir sain.
reset:
	$(COMPOSE) down -v

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
	@if ! $(COMPOSE) exec -T postgres psql -U $(DB_USER) -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='minuseek_admin'" | grep -q 1; then \
		$(COMPOSE) exec -T postgres createdb -U $(DB_USER) minuseek_admin; \
	fi
	$(COMPOSE) run --rm app pnpm prisma migrate deploy --config=prisma-admin.config.ts

## Crée une migration admin à partir du schéma prisma-admin (make migrate-admin NAME=...)
migrate-admin:
	$(COMPOSE) run --rm app pnpm prisma migrate dev --name $(NAME) --config=prisma-admin.config.ts

## Client confidentiel minuseek-provisioner sur le master local (idempotent),
## secret écrit dans .env — prérequis one-time du provisioning
keycloak-setup:
	sh scripts/keycloak-setup.sh

## Realm système minuseek-system + client public admin-minuseek (app admin) +
## client provisioner + user superadmin de dev (idempotent). En déployé, ne pas
## passer SYSTEM_ADMIN_* : le superadmin s'y crée à la main.
system-realm:
	SYSTEM_ADMIN_EMAIL=admin@minuseek.local SYSTEM_ADMIN_PASSWORD=admin sh scripts/system-realm-setup.sh

## Provisionne une organisation via la vraie saga SUP-03 (make provision SLUG=demo2 NAME="Labo 2")
provision:
	$(COMPOSE) run --rm app pnpm ts-node src/organization/infrastructure/cli/create-organization.cli.ts $(SLUG) "$(NAME)"

## Vérifie l'intégrité des chaînes d'audit (tous les tenants, ou make audit-verify TENANT=demo)
## Sort en code 1 dès qu'une chaîne est rompue
audit-verify:
	$(COMPOSE) run --rm app pnpm ts-node src/audit-trail/infrastructure/cli/verify-chain.cli.ts $(TENANT)

## Ancre la tête de chaîne d'audit auprès de la TSA (ou make audit-anchor TENANT=demo)
audit-anchor:
	$(COMPOSE) run --rm app pnpm ts-node src/audit-trail/infrastructure/cli/anchor-chain.cli.ts $(TENANT)

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

## Suite d'intégration contre un VRAI Postgres (advisory lock, ALS, rollback,
## trigger append-only) : lève la base jetable, y rejoue les migrations, puis
## joue app/test/integration. Séparée de `make test`, qui reste hors base.
test-integration:
	$(COMPOSE_TEST) up -d postgres-test
	@echo "⏳ attente du PostgreSQL d'intégration…"
	@until $(COMPOSE_TEST) exec -T postgres-test pg_isready -U $(DB_USER) -d $(INTEGRATION_DB_NAME) >/dev/null 2>&1; do sleep 1; done
	cd app && DATABASE_URL="$(INTEGRATION_DATABASE_URL)" pnpm prisma migrate deploy
	cd app && INTEGRATION_DATABASE_URL="$(INTEGRATION_DATABASE_URL)" pnpm jest --config jest.integration.config.js $(FILE)

## Détruit la base d'intégration (le container EST la base : rien à nettoyer d'autre)
test-integration-down:
	$(COMPOSE_TEST) rm -sfv postgres-test

## Affiche les logs de l'app en temps réel
logs:
	$(COMPOSE) logs -f app
