# ADR-0001 — Multi-tenant : une base de données par tenant

- **Statut** : accepté <!-- proposé | accepté | déprécié | remplacé par ADR-XXXX -->
- **Date** : 2026-07-02
- **Décideurs** : Équipe minuseek (Adrien Quimbre, Adam D., Adrien Quacchia, Ayline Travers)

## Contexte

minuseek manipule des **données biométriques** (traces papillaires, empreintes de référence) pour des **clients institutionnels distincts** (Services de Police Technique et Scientifique de villes différentes). Ces données sont sensibles au sens du **RGPD Art. 9** et relèvent de la **Directive Police-Justice (UE) 2016/680**. L'étanchéité entre clients est une exigence légale, pas un confort.

La spec impose déjà des opérations **par tenant** :
- `SUP-03` : provisioning d'un tenant (création DB + realm IdP + premier ADMIN, atomique avec rollback) ;
- `SUP-05` : suppression d'un tenant avec **crypto-shred** des clés ;
- `SUP-09/10` : **backup / restauration par tenant** ;
- `IA-12` / `IA-21` : isolation stricte, gardes tenant, aucun accès cross-tenant, SUPERADMIN sans accès métier ;
- `BIO-01` : chiffrement des images avec une **KEK par tenant**.

État actuel du code (mono-tenant de bout en bout) :
- `app/src/prisma/prisma.service.ts` : `PrismaClient` en **singleton `@Global()`**, une seule `DATABASE_URL`.
- `app/src/auth/infrastructure/http/jwt.strategy.ts` : validation contre **un seul realm** Keycloak (`KEYCLOAK_REALM`). Le commentaire du code identifie déjà le claim `iss` comme point d'ancrage du tenant.
- Aucune notion de `Tenant` ni `tenantId` dans le schéma Prisma (`InvestigationCase`, `Trace`, `ReferencePrint`, `Layer`).
- Infra dev : un Postgres unique, un realm importé (`keycloak/dev/minuseek-demo-realm.json`).

## Décision

Adopter une architecture **une base de données PostgreSQL par tenant**, avec une **base système (control-plane) partagée**.

1. **Base système** (partagée, unique) : registre des tenants (`Tenant { slug, realm, dbConnectionRef, status, createdAt }`), comptes SUPERADMIN, audit superadmin. C'est la seule base connue au démarrage.
2. **Base métier par tenant** : toutes les données métier (affaires, traces, empreintes, calques, audit tenant) vivent dans la base du tenant. **Pas de colonne `tenantId`** sur les tables métier — l'isolation est physique.
3. **Un realm Keycloak par tenant** : le claim `iss` du token identifie le tenant. Le SUPERADMIN utilise un realm système dédié.
4. **Une KEK par tenant** pour le chiffrement (aligné `BIO-01`), référencée depuis la base système.
5. **Résolution à la requête** : le tenant est déduit du token, puis le `PrismaClient` correspondant est résolu et propagé via un contexte (`AsyncLocalStorage`) jusqu'aux repositories.

## Conséquences

- ✅ **Isolation physique** : un `WHERE tenantId` oublié ne peut pas faire fuiter de données cross-tenant.
- ✅ **Crypto-shred / suppression** (`SUP-05`) triviale : `DROP DATABASE` + destruction de la KEK.
- ✅ **Backup / restore par tenant** (`SUP-09/10`) natifs (dump d'une base).
- ✅ **Prisma-friendly** : un `PrismaClient` par `connectionString` est propre, là où le schema-per-tenant est mal supporté par Prisma.
- ✅ Modèles métier **inchangés** (pas de `tenantId` à propager dans le domaine).
- ⚠️ **Résolution de connexion par requête** à construire : fabrique + cache de `PrismaClient`, propagation via `AsyncLocalStorage` (délicat avec les handlers CQRS singletons).
- ⚠️ **Fan-out des migrations** : chaque migration Prisma doit être rejouée sur toutes les bases tenant (+ la base système).
- ⚠️ **Provisioning plus lourd** : créer une base + rejouer les migrations + créer le realm à chaque nouveau tenant.
- ⚠️ **Connexions Postgres** : N tenants × pool ⇒ surveiller le nombre de connexions (non bloquant à l'échelle POC/V2 ; à revoir au-delà de ~100 tenants, via pooler type PgBouncer).

## Alternatives écartées

- **Base partagée + `tenantId` + Row-Level Security** — moins d'ops et scale mieux à grand nombre de tenants, mais isolation seulement **applicative** (risque de fuite sur bug de filtre), crypto-shred et backup par tenant coûteux et risqués. Inacceptable pour des données biométriques Directive Police-Justice.
- **Schema-per-tenant (1 base, N schémas)** — bon compromis d'isolation, mais **mal supporté par Prisma** (liaison à un schéma au `generate`), et le gain d'ops ne compense pas la complexité côté ORM.

## Impact d'implémentation (tickets de suivi)

Voir les tickets Backlog générés à partir de cette décision :
1. Base système (control-plane) + registre des tenants.
2. `PrismaService` multi-tenant : fabrique + cache de client + contexte `AsyncLocalStorage`.
3. `JwtStrategy` multi-realm + résolution du tenant courant (garde).
4. Provisioning d'un tenant (`SUP-03`) : realm + DB + migrations + premier ADMIN (atomique + rollback).
5. Fan-out des migrations Prisma sur toutes les bases tenant.
6. Docker dev : support multi-DB + 2ᵉ realm de démo pour tester l'isolation.
