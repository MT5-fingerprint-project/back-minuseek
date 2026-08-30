# ADR-0019 — La vérification est une mission portée par une table à part, et elle n'ouvre pas l'administration de l'affaire

- **Statut** : accepté
- **Date** : 2026-08-29
- **Décideurs** : équipe back Minuseek

## Contexte

La double lecture est la pratique des services de police scientifique : un dossier exploité par
quelqu'un est refait par un second, et les deux conclusions sont confrontées. Le rapport doit
pouvoir affirmer qu'un autre a regardé, et dire qui.

Le dépôt savait déjà qu'une affaire a un opérateur — une colonne `operatorUserId` sur
`InvestigationCase`, posée en L1-3 — et que l'accès à une affaire se juge par un titre, rendu par
`CaseAccessService` : `CASE_OPERATOR`, `SERVICE_MANAGER`, ou rien. Le type `CaseTitle` prévoyait
déjà `CASE_VERIFIER`, sans qu'aucune donnée ne puisse le produire.

Il fallait donc décider où vit la charge de vérifier, et ce qu'elle ouvre.

## Décision

**La mission est une table, pas une seconde colonne d'opérateur.** `CaseVerification` porte
l'affaire, le compte à qui elle est confiée, celui qui l'a confiée, un statut
(`PENDING`, `CONCORDANT`, `DISCORDANT`), la date où elle a été confiée et celle où elle s'est close.
Poser le vérificateur comme opérateur de l'affaire aurait été plus court : cela lui aurait volé la
place du titulaire, l'aurait fait ressortir dans les statistiques par opérateur et dans les
intervenants du rapport comme s'il avait exploité le dossier. Une affaire porte donc plusieurs
missions à la fois, et en garde l'historique une fois closes : c'est ce qui permet de confier un
troisième examen après une divergence.

**Le titre de vérificateur se lit, il ne se déclare pas, et il ne se perd pas.**
`PrismaCaseAccessReader` rend `CASE_VERIFIER` dès qu'une mission existe pour cet appelant sur cette
affaire, close ou non, et ajoute ces affaires à celles qu'il voit. Une fois ses conclusions rendues,
le vérificateur relit donc le dossier qu'il a vérifié : c'est le pendant de la révision d'une
conclusion, qui reste ouverte tant que le dossier l'est. Aucun paramètre de requête n'entre dans
cette décision : le serveur la prend seul, à partir de la base.

**Une mission ouvre la lecture et la contribution, jamais l'administration.** Le garde d'accès
reçoit un troisième marquage, `@CaseAdministration()`, qui résout l'affaire comme `@CaseScoped()`
puis refuse `CASE_VERIFIER` par un 403. Il couvre la correction de l'affaire, sa remise à un autre
opérateur, sa clôture, sa réouverture et le fait d'y confier une vérification. Un étranger à
l'affaire continue de recevoir 404 : le refus d'administration ne révèle jamais l'existence d'un
dossier.

**Le compte désigné est contrôlé à la frontière du domaine, pas par une clé étrangère.** La
référence à un compte reste un UUID nu, comme partout ailleurs entre contextes ; c'est la commande
qui refuse un compte inconnu ou désactivé, l'opérateur de l'affaire lui-même, et une seconde mission
en cours pour la même personne sur la même affaire.

**Confier une vérification est un acte, inscrit au journal avec ses valeurs.**
`CASE_VERIFICATION_REQUESTED` rejoint le catalogue figé, avec le compte désigné, son nom au moment
de la désignation et celui qui a confié. Le dépôt écrit la mission et l'acte dans une seule
transaction : le garde fail-closed du dépôt refuse toute mutation d'une table de preuve qui ne
serait pas chaînée, et la mission en est une.

## Conséquences

- ✅ Le titulaire reste le titulaire : ni les statistiques, ni le rapport, ni la fiche d'affaire ne
  confondent celui qui a exploité et celui qui contrôle.
- ✅ Un vérificateur accède au dossier sans qu'on lui ouvre les gestes qui engagent le service, et il
  y accède encore après avoir rendu ses conclusions.
- ⚠️ L'unicité « une seule mission en cours par personne et par affaire » est tenue par la commande,
  pas par un index : PostgreSQL sait poser un index unique partiel, Prisma ne sait pas le déclarer
  sans dérive de migration. Deux requêtes simultanées peuvent créer deux missions ; la conséquence
  est un doublon d'affichage, pas une perte.

## Alternatives écartées

- **Le vérificateur devient opérateur de l'affaire** — le plus court chemin vers l'accès, et le plus
  faux : il efface le titulaire.
- **Un rôle applicatif « vérificateur »** — un rôle est global, une mission est portée par un
  dossier. N'importe quel opérateur reçoit des vérifications sans changer de rôle.
- **Un mode aveugle demandé par le client (`?mode=blind`)** — contournable par construction.
