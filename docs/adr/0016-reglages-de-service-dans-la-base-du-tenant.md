# ADR-0016 — Les réglages d'un service vivent dans sa base, sur une ligne unique, et leur écriture est un acte

- **Statut** : accepté
- **Date** : 2026-08-27
- **Décideurs** : équipe back Minuseek

## Contexte

Le haut de la première page d'un rapport doit nommer le service émetteur : l'administration dont il
dépend, son nom, son adresse, son téléphone, son courriel, et la ville qui remplit le « Fait à … » de
la signature. L'hypothèse du papier à en-tête, retenue un temps, tombe dès que le rapport circule
sous forme de fichier — c'est le cas courant. Ces valeurs doivent donc être saisies dans
l'application, une fois, et relues à chaque édition de rapport.

C'est le premier réglage de service du produit, et il arrive dans un dépôt où deux plans coexistent.
Le contexte `organization` est le control-plane (ADR-0004) : il provisionne les organisations et
leurs comptes, ses routes sont réservées au royaume système, et il parle à la base d'administration.
Le reste de l'application vit dans le plan tenant, où `TenantGuard` prouve le service à partir du
jeton et où `TenantConnectionService` ouvre la base de ce service. Un en-tête de service appartient
au premier par son vocabulaire et au second par ses données : il n'y a qu'un jeu de valeurs, il est
propre à un service, et personne d'autre que ce service n'a à le lire.

Enfin, savoir quel en-tête était en vigueur le jour où un rapport a été édité a une valeur : ce sont
les coordonnées officielles d'un service, imprimées en tête d'une pièce qui peut être versée à une
procédure.

## Décision

**Le réglage vit dans la base du tenant, sur une ligne unique.** Le modèle `ServiceSettings` rejoint
`app/prisma/models/`, jamais le schéma d'administration. Il n'a pas d'identifiant métier à inventer :
le dépôt écrit et relit toujours sous la même clé fixe, `service-settings`, par un `upsert`. Une
seconde ligne serait un défaut ; le dépôt ne peut pas en produire, et sa spec le vérifie.

**Le code reste dans le contexte `organization`, mais emprunte le patron de persistance du plan
tenant.** L'en-tête est une propriété du service, c'est-à-dire de l'organisation, et le contexte
fréquente déjà les deux bases — `ServiceUserRolesReader` et `OrganizationInitializer` écrivent
côté tenant. L'adapter injecte donc `TenantConnectionService`, `TRANSACTION_RUNNER` et `AUDIT_TRAIL`,
comme `PrismaInvestigationCaseRepository`, et non `AdminPrismaService`. Le contrôleur des réglages ne
porte pas `@SystemRealmOnly()` : il s'adresse au royaume du tenant, contrairement aux routes
d'organisation qui l'entourent.

**Un service qui n'a rien saisi a un en-tête vide, pas une absence.** La lecture rend toujours les six
champs ; ils valent la chaîne vide tant que rien n'a été enregistré. Aucun appelant n'a de cas
particulier à traiter, et un champ effacé s'écrit comme un champ jamais rempli.

**Enregistrer l'en-tête est un acte, et l'acte porte les valeurs.** Chaque enregistrement qui change
quelque chose laisse un `SERVICE_HEADER_SAVED` au journal, avec `caseId` nul — c'est un réglage de
service, rattaché à aucun dossier — et un `changes` qui nomme les champs modifiés avec leur nouvelle
valeur. Le dépôt prend l'acte en paramètre, comme ceux du dossier de preuve, ce qui satisfait le
garde fail-closed : l'`upsert` et le maillon de chaîne sont écrits dans la même transaction.
Un enregistrement qui ne change rien n'écrit rien et ne journalise rien, faute de valeur à porter.

**Le rôle se juge dans le handler.** Seul un responsable de service enregistre l'en-tête ; le handler
lève `ServiceSettingsAdministrationNotAllowedError` avant même de lire l'état courant, et le
contrôleur la traduit en 403. La lecture, elle, est ouverte à tout compte du service : l'opérateur en
a besoin pour l'aperçu de son rapport.

## Conséquences

- ✅ Le rapport de L9-8 lit six champs toujours présents, sans distinguer le service configuré de
  celui qui ne l'est pas.
- ✅ L'historique des en-têtes est reconstituable depuis la chaîne d'audit, sans table de versions.
- ✅ Le prochain réglage de service se posera au même endroit, avec le même patron.
- ⚠️ Le contexte `organization` héberge désormais des routes des deux plans. Le repère est l'injection :
  ce qui passe par `TenantConnectionService` est tenant, ce qui passe par `AdminPrismaService` ne
  l'est pas.
- ⚠️ L'unicité de la ligne repose sur la clé fixe du dépôt et sur la clé primaire de Postgres. Aucun
  test unitaire ne peut prouver qu'une seconde ligne est impossible en base ; seule une écriture
  directe hors dépôt pourrait en créer une.
- ⚠️ Un enregistrement sans changement ne laisse aucune trace. Qui voudrait compter les tentatives,
  et non les modifications, ne les trouvera pas au journal.

## Alternatives écartées

- **Un contexte borné dédié `service-settings/`** — évite de mélanger les deux plans dans
  `organization`, mais crée un contexte pour un aggregate de six chaînes, sans règle métier propre, et
  éloigne le réglage de l'organisation dont il décrit l'identité.
- **Le réglage dans la base d'administration, à côté du registre des organisations** — rendrait
  l'en-tête lisible par le control-plane, donc par un autre service, et ferait sortir une donnée de
  service de la base qui l'isole (ADR-0001).
- **Des valeurs par défaut à la création du tenant** — un en-tête prérempli avec l'identité d'un autre
  service s'imprimerait tel quel sur un rapport si personne ne le corrige.
- **Une table de versions de l'en-tête** — la chaîne d'audit porte déjà chaque changement avec ses
  valeurs et sa date ; une seconde source de vérité se désynchroniserait.
- **Un acte à chaque enregistrement, y compris sans changement** — un `changes` vide n'apprend rien à
  qui relit le journal, et le dépôt de dossier a déjà tranché dans l'autre sens.
