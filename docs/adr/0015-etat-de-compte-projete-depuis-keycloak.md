# ADR-0015 — L'état d'un compte de service est décidé par Keycloak et projeté chez nous

- **Statut** : accepté
- **Date** : 2026-08-27
- **Décideurs** : équipe back Minuseek

## Contexte

Le responsable de service doit pouvoir désactiver un compte et corriger un profil sans passer par nous. Le geste qui compte est celui qui retire la connexion, et il n'a jamais lieu dans notre base :
le jeton est vérifié contre Keycloak, pas contre la table `User`. Un compte marqué inactif chez nous continuerait de se connecter tant que son compte Keycloak reste `enabled: true`.

Trois contraintes cadrent la décision.

Le royaume à viser vient du jeton. Les routes d'administration de compte arrivent du plan tenant, où `TenantGuard` a déjà prouvé le tenant et `TenantInterceptor` posé son slug dans l'`AsyncLocalStorage`. Accepter un slug ou un royaume dans le corps de la requête transformerait ces routes en escalade de privilèges entre services.

Le client admin Keycloak est déjà câblé, mais dans le contexte `organization`, qui est le
control-plane (ADR-0004) : `IdentityProviderPort` y prend le royaume en premier paramètre, parce que ses appelants — provisionnement, application d'administration — n'ont pas de tenant courant.

Enfin, la liste des comptes du service doit montrer l'état, et la désignation d'un opérateur doit pouvoir le refuser . Ces deux lectures ne peuvent pas interroger Keycloak à chaque requête.

## Décision

**Keycloak décide, `User.status` projette.** La colonne `status` (`ACTIVE` / `DISABLED`) est ajoutée à `User`. Les trois commandes du ticket appellent le fournisseur d'identité **d'abord**, puis écrivent notre colonne. Si Keycloak échoue, la commande échoue et rien ne change chez nous ; si notre écriture échoue après un Keycloak réussi, le compte est déjà privé de connexion et la relance de la commande rattrape la colonne.

**Deux étages de port.** `IdentityProviderPort` (contexte `organization`) gagne une seule méthode de
transport, `updateUser(realm, userId, input)`, qui ne pose **aucun** `catch` — contrairement à
`deleteUser`, volontairement idempotent. Au-dessus, `identity-access` déclare son propre port,
`ServiceAccountIdentityPort`, **sans royaume dans sa signature** : `setEnabled(identityProviderId,
enabled)` et `updateProfile(identityProviderId, profile)`. Son unique adapter résout le royaume
depuis le contexte tenant (`TenantContextService` → `TenantRegistryService.identityProviderRealm`),
et échoue plutôt que de replier sur un royaume par défaut. C'est le piège traduit en type : aucun
appelant ne peut désigner un autre service.

`IdentityAccessModule` importe donc `OrganizationModule` pour le seul `IDENTITY_PROVIDER`. C'est la
première dépendance de module du plan tenant vers le control-plane ; elle reste confinée à un
adapter d'infrastructure, comme le précédent miroir `ServiceUserRegistrar`, et ne crée aucun cycle.

**L'annuaire vu de l'affaire dit l'état, il ne le filtre pas.** `ServiceUserDirectory.exists(userId)`
devient `findById(userId): DesignatableServiceUser | null`, avec un booléen `disabled` projeté par
l'adapter. Un compte désactivé se distingue ainsi d'un compte inexistant : `DisabledOperatorError` et
`UnknownOperatorError` sont deux refus différents, avec deux remèdes différents, tous deux en 400.

**L'annuaire du service est réservé au responsable, et se filtre en base.**
`GET /api/users` accepte `search` (fragment sur nom, prénom, matricule), `role`, `grade` et `status`,
combinés par ET ; `GET /api/users/grades` rend les grades distincts, qui sont saisis à la main et
n'ont donc pas d'énumération. Les deux exigent le rôle `ADMIN`, refusé dans le handler comme pour les
écritures : le front réservait déjà l'écran au responsable, la garde était côté navigateur seulement.
La page et son total portent **la même clause**, sinon le nombre de pages mentirait dès le premier
filtre. La recherche est un `ILIKE` : insensible à la casse, **sensible aux accents** — « riviere » ne
trouve pas « Rivière ». Les jokers `%` et `_` sont échappés, une saisie n'étant pas un motif.

**Une panne du fournisseur d'identité se traduit en 502.** L'adapter enveloppe l'échec délégué dans
`IdentityProviderUnavailableError`, en conservant la cause. Le 500 ne dirait pas où est la panne, le
503 mentirait sur notre propre disponibilité.

## Conséquences

- ✅ Une désactivation retire réellement la connexion : le refus vient du fournisseur d'identité, pas
  d'un écran.
- ✅ La liste et le refus de désignation lisent l'état sans interroger Keycloak.
- ✅ Un compte désactivé reste en base, avec ses actes au journal et son nom dans les rapports déjà
  édités ; il est réactivable, et son profil reste corrigible.
- ⚠️ **Les deux vérités peuvent diverger.** Quelqu'un qui désactive un compte depuis la console
  Keycloak laisse notre colonne à `ACTIVE`. On l'accepte : personne n'administre par la console, et
  relire l'état à chaque lecture coûterait un appel réseau par ligne. La réactivation est le chemin
  de réparation, elle rappelle toujours le fournisseur d'identité.
- ⚠️ **Un jeton déjà émis survit à la désactivation** jusqu'à son expiration. La validation est hors
  ligne, rien dans le pipeline ne relit `status`, et nous n'appelons pas le logout Keycloak : pendant
  cette fenêtre, le porteur garde tous ses droits. La valeur est `accessTokenLifespan = 300 s`, posée
  sur **chaque** royaume créé par le provisionnement, pas seulement en dev.

  C'est ce que ferme la garde d'auto-cible, **des deux côtés**. Sans elle, un responsable qu'on vient
  de désactiver se réactivait lui-même avec son jeton survivant — la manœuvre a été jouée sur
  l'environnement de dev avant d'être bouchée : 204, `enabled` repassé à `true`, nouveau jeton obtenu,
  et rien au journal. Le refus rend désormais 403. Se désactiver soi-même reste un accident qu'on
  évite ; se réactiver soi-même était une escalade.

  Ce qui subsiste dans la fenêtre de 300 secondes est du niveau normal d'un jeton hors ligne : le
  porteur d'un compte désactivé continue de lire ses affaires et d'agir dessus jusqu'à expiration.
  Le fermer demanderait de relire `status` dans `CurrentUserGuard` — quatre lignes, mais un
  changement de comportement sur **toutes** les routes, qui dépasse ce ticket. À instruire à part,
  avec l'appel à `users.logout` qui couperait aussi les sessions ouvertes.
- ⚠️ **La recherche ignore les accents à sa charge.** La rendre insensible aux accents demanderait
  soit l'extension `unaccent` dans chaque base tenant (ADR-0001) et le premier `$queryRaw` métier du
  dépôt, soit une colonne normalisée maintenue à l'écriture. Refusé pour un annuaire de quelques
  dizaines de lignes ; à rouvrir si l'usage le réclame.
- ⚠️ **Un opérateur ne lit plus l'annuaire de son service.** Le jour où la passation d'affaire
  (L1-9) donnera à l'opérateur un sélecteur de collègue, il faudra soit rouvrir la lecture, soit
  exposer une route étroite qui ne rende que ce qu'un sélecteur exige.
- ⚠️ **Aucun acte au journal.** `User` et `PersonalData` restent des tables de contexte exemptées du
  garde fail-closed (`UNAUDITED_TABLES`) ; les trois nouveaux handlers y sont cités. Une correction
  de grade se retrouve pourtant imprimée dans un rapport remis à un magistrat : journaliser au moins
  la correction de profil, avec ses valeurs avant/après, mérite son propre ticket.
- ⚠️ **Une affaire déjà confiée à un compte désactivé le reste.** Le refus posé ici vaut pour les
  désignations futures, pas rétroactivement, et rien ne signale ces affaires.
- ⚠️ Deux responsables peuvent se désactiver l'un l'autre et ne laisser personne pour réactiver, hors
  console Keycloak. Risque accepté : la garde coûterait un comptage des responsables actifs à chaque
  désactivation, pour un service qui n'a aucun tenant réel.

## Alternatives écartées

- **N'écrire que dans notre base, et refuser la connexion nous-mêmes** — un compte marqué inactif
  chez nous continuerait d'obtenir un jeton, et le refus dépendrait d'un garde applicatif qu'un
  oubli de marquage suffirait à contourner.
- **Injecter `IDENTITY_PROVIDER` directement dans les handlers** — chaque handler devrait alors
  connaître la notion de royaume et le résoudre lui-même, c'est-à-dire trois occasions de se tromper
  de service.
- **Dupliquer `KeycloakAdminService` dans `IdentityAccessModule`** — deux composition roots, deux
  clients admin, deux sessions `client_credentials` pour le même Keycloak.
- **Filtrer `status = ACTIVE` dans l'adapter de l'annuaire** — l'adapter mentirait sur le contrat du
  port, et un compte désactivé deviendrait indistinguable d'un compte inexistant : « ce compte
  n'existe pas » là où il faut lire « ce compte est parti ».
- **Une seule route `PATCH /users/:id`** — elle inviterait, à la première demande, un changement de
  rôle, qui est un pouvoir et non une correction. Deux routes étroites, `/status` et `/profile`, le
  disent dans l'URL.
