# Multitenant — design cible (phase 2)

> État : **design**, non implémenté. La phase 1 (ce qui est en place) installe Keycloak
> et la brique de validation JWT (`src/auth/`, `JwtStrategy` + `JwtAuthGuard`, passport-jwt) — non activée
> globalement : la protection des routes viendra avec le ticket « Login ».
> Le realm de démo (`keycloak/dev/`) est une fixture
> de dev uniquement, montée par la compose dev — il n'est pas utilisé en prod.
> Ce document décrit comment on étend ça vers du
> multitenant « un client = une base de données, un même déploiement de code ».

## Principe

- **Identité** : **un realm Keycloak par client**. Le realm est porté par le claim `iss`
  de l'access token (`https://<keycloak>/realms/<tenant>`). C'est la source de vérité du
  tenant — pas de paramètre d'URL ni de header à truster côté client.
- **Données** : **une base PostgreSQL par client**, même schéma (mêmes migrations Prisma),
  même image applicative. Seule la chaîne de connexion change selon le tenant.

```
Navigateur ──login realm tenant-A──▶ Keycloak (realm: tenant-A)
   │  access token  iss=…/realms/tenant-A
   ▼
KeycloakAuthGuard  ── valide signature/iss/aud ──▶ tenant = "tenant-A"
   │                                                  │
   ▼                                                  ▼
TenantContext (AsyncLocalStorage)         registre tenant → connectionString
   │                                                  │
   ▼                                                  ▼
PrismaService  ── cache Map<tenant, PrismaClient> ──▶ DB de tenant-A
```

## Étapes d'implémentation

### 1. Résolution du tenant (déjà à portée de main)

La `JwtStrategy` (`src/auth/infrastructure/http/jwt.strategy.ts`) valide déjà l'`iss`, mais
sur un **seul realm** (passport-jwt = un issuer fixe). Pour le multitenant, remplacer son
`issuer`/`secretOrKeyProvider` fixes par un `secretOrKeyProvider` qui lit l'`iss` du token et
sélectionne le bon JWKS (un realm par client). Le tenant = nom du realm extrait de l'`iss`
validé.

### 2. TenantContext

Introduire un `AsyncLocalStorage<{ tenantId: string }>` (`src/shared/`), renseigné par le
guard après validation. Évite de propager le tenant manuellement à travers CQRS / repos.

### 3. PrismaService multi-DB

Faire évoluer `src/prisma/prisma.service.ts` du singleton `@Global` actuel
(`new PrismaPg({ connectionString: process.env.DATABASE_URL })`) vers un **cache de clients
par tenant** :

- `Map<tenantId, PrismaClient>`, instanciation paresseuse :
  `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`.
- `connectionString` résolue depuis un **registre tenant → connectionString** (cf. §5).
- exposer un accès au client du tenant courant (lu depuis le `TenantContext`).
- attention au nombre de pools `pg` ouverts : prévoir un nombre de tenants borné et/ou une
  éviction LRU si la liste grandit.

### 4. Migrations sur N bases

Les migrations Prisma sont identiques pour tous les tenants. Prévoir un script qui boucle
`prisma migrate deploy` sur chaque `DATABASE_URL` de tenant (au lieu de l'unique appel du
Dockerfile actuel). Le provisioning d'un nouveau client = créer realm + base + lancer les
migrations.

### 5. Registre tenant → connexion (à trancher)

Le seul vrai choix ouvert. Le **modèle physique des bases n'est pas encore décidé** :

| Option | Isolation | Coût / Ops | Note |
|---|---|---|---|
| **N bases sur 1 Postgres** (recommandé) | Forte | Faible | Une `database` par client, même instance. Bon compromis. |
| 1 Postgres par client | Maximale | Élevé | Conteneur/instance dédié ; orchestration plus lourde. |
| 1 schéma par client | Moyenne | Très faible | Délicat avec Prisma (`search_path`), isolation plus faible. |

Localisation du registre, deux options :
- **par variable d'environnement** (JSON `tenant → connectionString`) : simple, suffisant
  tant que le nombre de clients est petit et le déploiement statique.
- **base de contrôle dédiée** (control-plane) : une petite DB listant les tenants et leurs
  connexions ; nécessaire dès qu'on provisionne des clients dynamiquement.

## À décider avant de démarrer la phase 2

1. Modèle physique des bases (tableau ci-dessus) — **non tranché**.
2. Registre via env vs base de contrôle.
3. Stratégie de provisioning d'un nouveau client (création realm + base + migrations).
