# ADR-0014 — Le compte du service naît avec le compte d'identité, et chaque requête porte son auteur

- **Statut** : accepté
- **Date** : 2026-08-25
- **Décideurs** : équipe back Minuseek (ticket L1-1)

## Contexte

Créer un utilisateur depuis l'application d'administration ne créait qu'un compte Keycloak.
L'application n'avait donc personne à désigner : pas d'opérateur sur une affaire, pas de
vérificateur à choisir, pas d'auteur sur un acte autre que le `sub` du jeton. La table `User`
existait, son handler d'enregistrement aussi (`RegisterUserHandler`, exposé par `POST /users`),
mais rien ne les reliait à la route d'administration.

Trois contraintes cadrent la décision.

La route d'administration arrive du **realm système** : `TenantGuard` ne lui pose aucun contexte
tenant, et `getCurrentClient()` échoue fail-closed sans contexte. Le control-plane n'a donc pas de
base « courante » — il n'a qu'un slug en paramètre d'URL.

Le fournisseur d'identité est **idempotent** : `createUser` rend le compte existant, sans mot de
passe temporaire, quand l'adresse est déjà connue du realm. Une compensation aveugle supprimerait
un compte que l'appel n'a pas créé.

Enfin, le garde d'accès aux affaires (L1-2, posé route par route en L1-4) est un `CanActivate`.
Les gardes tournent **avant** les interceptors : `TenantInterceptor`, qui ouvre le contexte tenant
dans l'`AsyncLocalStorage`, n'a pas encore tourné quand un garde s'exécute.

## Décision

1. **La création d'un compte est une saga à deux écritures, avec compensation conditionnelle.**
   `CreateOrganizationUserHandler` crée le compte d'identité, puis la ligne du service. Si la
   seconde écriture échoue, il ne supprime le compte d'identité **que si cet appel l'a créé** —
   `CreatedUser` porte pour cela un booléen `created`, sur le modèle d'`EnsureResult`. Un échec de
   la suppression est journalisé sans masquer l'erreur d'origine, qui reste celle que voit
   l'appelant.

2. **Le control-plane écrit dans la base du service par une couche anti-corruption**, le port
   `ServiceUserRegistrarPort` et son adapter `ServiceUserRegistrar`. L'adapter pose le tenant dans
   l'`AsyncLocalStorage` le temps de l'écriture, puis dispatche `RegisterUserCommand` : les dépôts
   d'`identity-access` ouvrent la base par `getCurrentClient()` sans être modifiés. L'adapter
   traduit les erreurs de domaine d'`identity-access` en `OrganizationUserConflictError`, que le
   controller rend en 409 — l'application du control-plane ne connaît aucune erreur de l'autre
   contexte.

3. **L'utilisateur courant est résolu une fois par requête, par un garde global**,
   `CurrentUserGuard`, enregistré en troisième position après `JwtAuthGuard` et `TenantGuard`. Il
   lit le compte derrière le `sub` et le pose en `request.currentUser`. Un jeton sans ligne en base
   n'est pas refusé : le garde laisse passer sans compte courant, et c'est la route qui décide ce
   qu'elle en fait. Toute autre panne remonte.

4. **Deux lectures, une seule forme.** `GET /api/users` rend les comptes du service courant,
   paginés avec le `PageDto` du dépôt ; `GET /api/me` rend celui de l'appelant, ou 404. Les deux
   rendent le même modèle de lecture `{ id, firstName, lastName, role, grade, serviceNumber }` :
   ni `identityProviderId`, ni horodatages.

5. **La liste est triée nom, prénom, puis identifiant.** Le départage par identifiant n'est pas
   cosmétique : sans lui, deux homonymes peuvent apparaître deux fois d'une page à l'autre, l'ordre
   des lignes à clé égale n'étant garanti par rien.

## Conséquences

- ✅ Un compte créé depuis l'administration est désignable immédiatement, sans que la personne se
  soit connectée une seule fois.
- ✅ Le garde d'accès de L1-4 et l'auteur des actes lisent tous deux `request.currentUser`, sans
  refaire la lecture ni la dupliquer. `BiometricsController.recordHit`, seul consommateur existant,
  y bascule dans ce ticket : il relisait la même ligne par une seconde query.
- ✅ Rien à rattraper côté schéma : aucune migration, la table `User` portait déjà rôle, grade et
  matricule.
- ⚠️ **Une lecture en base s'ajoute à chaque requête authentifiée d'un tenant.** C'est le prix de
  « toute requête sait qui la fait ». Le client Prisma est déjà en cache par tenant, la lecture est
  un `findUnique` sur un index unique.
- ⚠️ Les comptes déjà créés dans Keycloak n'ont pas de ligne en base et n'en auront pas : on les
  recrée. Rien n'est en production.
- ⚠️ **`POST /users` reste ouverte à tout jeton du tenant, et ce que ce ticket en fait change sa
  portée.** La route n'est pas touchée, mais la ligne qu'elle écrit cesse d'être inerte : elle entre
  dans `GET /api/users`, consomme un matricule que la contrainte d'unicité oppose ensuite au chemin
  d'administration, et devient le `request.currentUser` que le garde de L1-4 lira. Un compte du
  service qui n'a pas encore de ligne en base peut donc s'en écrire une, avec le rôle de son choix.
  La fermeture est L1-4 : **elle se fusionne juste après celui-ci, pas plus tard.**
- ⚠️ `GET /api/users` est ouvert au même public, comme `GET /users/by-provider-id` l'était déjà.
- ⚠️ **La création écrit dans deux magasins, la suppression n'en vide qu'un.**
  `DELETE /organizations/:slug/users/:id` — que l'application d'administration appelle déjà — ne
  supprime que le compte d'identité : la ligne du service survit, reste listée et désignable, et son
  matricule, unique en base, reste pris sans qu'aucune route puisse le libérer. Recréer la même
  personne répond alors 409 définitivement. Symétriser en effaçant la ligne irait contre la doctrine
  de L1-6, qui veut que « le compte reste en base, avec ses actes au journal et son nom dans les
  rapports déjà édités » : le geste juste est une désactivation, que L1-6 écrit pour le responsable
  de service et qui ne couvre pas la suppression par l'administration. D'ici là, rien n'est en
  production et la ligne se retire à la main. Retirer cette route jusqu'à L1-6 est la décision à
  prendre ; elle n'est pas celle de ce ticket.
- ⚠️ La dépendance d'`OrganizationModule` vers `RegisterUserHandler` n'apparaît pas dans le graphe de
  modules : elle passe par le bus CQRS, dont l'explorer balaie tous les modules chargés. Un contexte
  Nest qui chargerait `OrganizationModule` sans `IdentityAccessModule` — le CLI de provisioning le
  fait déjà — créerait le compte d'identité puis échouerait faute de handler. Le CLI n'appelle
  aujourd'hui que la création d'organisation.
- ⚠️ Le fake in-memory du lecteur trie par `localeCompare` quand Postgres trie par sa collation.
  Les deux ordres coïncident sur les noms usuels et divergent sur les cas limites (casse, accents) :
  le fake garantit le contrat — l'ordre et le départage — pas la collation.

## Alternatives écartées

- **Ouvrir un pool dédié depuis le slug, comme `OrganizationInitializer`** — le provisioning le
  fait parce qu'il tourne avant que le tenant existe dans le registre. Ici le tenant existe :
  ouvrir un second pool à chaque création de compte gaspillerait le cache de connexions.
- **Appeler `RegisterUserHandler` directement depuis le handler d'organisation** — couple
  l'application du control-plane à l'application d'un autre contexte, et fait remonter ses erreurs
  de domaine jusqu'au controller. Le bus CQRS et le port gardent la frontière.
- **Résoudre l'utilisateur courant dans un interceptor** — plus naturel puisque le contexte tenant
  y est ouvert, mais les interceptors tournent après les gardes : le garde d'accès de L1-4 ne
  verrait rien.
- **Refuser en 403 tout jeton sans ligne en base, depuis le garde** — fermerait le service à un
  compte fraîchement créé côté identité mais pas encore en base, et transformerait le 404 attendu
  sur `/api/me` en refus généralisé.
- **Déduire « le compte existait déjà » de `temporaryPassword === null`** — le signal est exact
  aujourd'hui, mais implicite : il lie une décision de compensation à un détail du contrat de mot
  de passe.
