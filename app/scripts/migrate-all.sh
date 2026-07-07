#!/bin/sh
# Migrations déployées, multi-tenant (docs/multitenancy.md). Exécuté par le job
# Cloud Run de migration AVANT la bascule de trafic : un échec bloque le deploy.
#
#   1. schéma admin (registre des tenants) sur ADMIN_DATABASE_URL
#   2. schéma métier rejoué sur CHAQUE base tenant listée dans le registre
#      (URL dérivée de TENANT_DATABASE_URL_TEMPLATE, {db} substitué)
#
# Le provisioning (SUP-03) migre la base d'un tenant à sa création ; ce job
# re-applique toute nouvelle migration à tous les tenants existants.
set -eu

echo "→ admin registry schema"
pnpm prisma migrate deploy --config=prisma-admin.config.ts

echo "→ tenant business schemas (from registry)"
tenant_databases=$(node scripts/list-tenant-databases.cjs)

if [ -z "$tenant_databases" ]; then
  echo "  (no tenant registered yet — nothing to fan out)"
  exit 0
fi

for database_name in $tenant_databases; do
  echo "  · $database_name"
  tenant_url=$(printf '%s' "$TENANT_DATABASE_URL_TEMPLATE" | sed "s|{db}|${database_name}|g")
  DATABASE_URL="$tenant_url" pnpm prisma migrate deploy
done

echo "✓ all tenant databases migrated"
