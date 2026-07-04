# ADR-0004 — Organisation : bounded context métier ; superadmin : niveau d'autorisation

- **Statut** : accepté
- **Date** : 2026-07-04
- **Décideurs** : Équipe minuseek

## Contexte

Le provisioning des tenants (`SUP-03`, cf. [ADR-0001](0001-multi-tenant-db-per-tenant.md))
introduit le control-plane dans le code : créer un client (un labo PTS), son
realm, sa base. Le guide d'implémentation
(`docs/multitenancy.md` §11) avait esquissé un module **`superadmin/`** pour
porter ces commandes. À terme, une **app d'administration** consommera ces
endpoints (créer des organisations, gérer leurs utilisateurs, voir des stats).

Or « superadmin » nomme un **acteur** (un niveau d'accès), pas un domaine. Un
module nommé par un rôle finit écartelé : le jour où un admin *de tenant* peut
modifier le profil de sa propre organisation, ce use case appartient au même
domaine — seule l'autorisation diffère.

## Décision

1. **Le bounded context s'appelle `organization/`** (langage métier). Il
   possède les commandes du cycle de vie (create/delete/backup/restore).
    Le §11 de `docs/multitenancy.md` est
   amendé en conséquence.

2. **Une organisation a deux facettes de persistance** :
   - le **registre** (`minuseek_admin.tenant`) — projection technique de
     routage (slug, databaseName, realm), écrite par le provisioning **en
     dernier** (son existence = tenant prêt), lue par la machinerie
     `tenancy/` (strategy JWT, guard, connexions) ;
   - la **ligne `Organization`** dans la base **du tenant** — l'identité de
     l'organisation elle-même (displayName, futurs réglages), initialisée au
     provisioning puis vécue par le tenant.

3. **« Superadmin » est un mécanisme d'autorisation transverse**, pas un
   module : le realm système (`KEYCLOAK_SYSTEM_REALM`) + le décorateur
   `@SystemRealmOnly()`. L'aiguillage est **exclusif et fail-closed dans les
   deux sens** (IA-12) : une route marquée n'accepte que les tokens du realm
   système (aucun contexte tenant posé) ; une route métier les rejette.
   Les URLs restent nommées par la ressource (`POST /api/organizations`),
   jamais par l'acteur.

4. **Les utilisateurs vivent dans Keycloak, unique annuaire** — pas de tables
   users applicatives. Deux surfaces de gestion sur le même magasin :
   la création d'utilisateurs (y compris le **premier ADMIN**) est un use
   case distinct — create-user — consommé par l'app admin ; l'**admin
   d'organisation** gère ensuite les utilisateurs *de son propre realm*
   (routes métier tenant + contrôle de rôle). Si le domaine doit un jour
   référencer des personnes (attribution d'affaires, audit), ce sera une
   **projection légère dans la base du tenant** (sub + affichage) — jamais
   dans la base admin : le control-plane ne contient aucune PII métier


## Conséquences

- ✅ Le futur back-office n'est qu'un client de plus : realm système +
  endpoints `organization/` existants.
- ✅ L'évolution vers du RBAC fin raffine le
  guard sans toucher au contexte.
- ✅ Frontière auditable : aucun chemin de code ne mène le realm système à
  une donnée d'enquête.
- ⚠️ Le premier accès superadmin exige d'amorcer le realm système (ticket
  dédié) ; d'ici là, le CLI de provisioning sert de porte d'entrée.
- ⚠️ Tout besoin futur d'accès superadmin au contenu métier (support) devra
  passer par un pattern d'impersonation consentie et auditée — ADR dédié.

## Alternatives écartées

- **Un bounded context `superadmin/`** — nomme un acteur, pas un domaine ;
  condamne les use cases partagés (profil d'organisation) à la duplication.
- **Des routes métier bi-accès (tenant OU système)** — mécaniquement bancal
  (un token système n'a pas de tenant : il faudrait le laisser *choisir*,
  donc accès cross-tenant total) et contraire à IA-12.
- **Des tables users applicatives (une superadmin, une par contexte)** —
  duplique l'annuaire Keycloak et crée un problème de synchronisation ;
  remplacées par deux surfaces de gestion sur Keycloak.
- **Deux stratégies passport nommées (`admin-jwt`/`tenant-jwt`); notre stratégie multi-realm couvre
  déjà le realm système. Gardée comme évolution possible si la logique
  admin se complexifie.
