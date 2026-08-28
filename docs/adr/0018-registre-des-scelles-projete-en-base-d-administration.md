# ADR-0018 — Le registre des scellés est une projection en base d'administration, pas une seconde vérité

- **Statut** : accepté
- **Date** : 2026-08-29
- **Décideurs** : équipe back Minuseek

> **Numérotation** : ce numéro laisse le 0017 à l'ADR sur la numérotation des rapports, écrit en
> parallèle sur une autre branche. Si cette branche-ci est fusionnée seule, le 0017 manquera à
> l'index jusqu'à ce que l'autre arrive.

## Contexte

Le rapport affirme que les images n'ont pas été modifiées et imprime leur empreinte numérique. Un
magistrat qui reçoit ce document n'a aujourd'hui aucun moyen de la recalculer et de la confronter à
autre chose que la parole du laboratoire — c'est-à-dire la partie dont on met la parole en doute.
Il faut donc une page ouverte à tous, sans compte, où déposer un fichier et savoir s'il est celui
que le laboratoire a scellé.

Deux contraintes du code interdisent d'y répondre en lisant la base d'un laboratoire.
`JwtAuthGuard` est déclaré en `APP_GUARD` et n'a pas d'échappatoire ; et surtout
`TenantConnectionService.getCurrentClient()` exige un laboratoire dans le contexte, posé à partir du
jeton. Une route non authentifiée n'en a pas — et c'est tant mieux : on ne veut pas qu'un point
d'entrée ouvert sache ouvrir une connexion vers la base d'un client. La base d'administration, elle,
ne contient qu'un registre de laboratoires et n'appartient à aucun d'eux.

## Décision

**Les empreintes scellées sont projetées dans la base d'administration, dans une table dédiée.**
`SealRegistry` porte le slug du laboratoire, l'empreinte, la nature de la pièce, le numéro
d'inscription au registre, la date de mise sous scellé, la date d'horodatage extérieur quand elle
existe, et — pour les seuls rapports — le dossier et la nature du document, dont la filiation a
besoin. La contrainte `@@unique([tenantSlug, sha256])` fait qu'un même fichier redéposé dans le même
laboratoire reste un seul scellé, et que la même empreinte dans deux laboratoires reste deux lignes.
La suppression d'un laboratoire emporte ses scellés en cascade, plutôt que de laisser des lignes qui
répondraient pour un slug mort.

**Cette table est une copie de travail, jamais une seconde vérité.** Le registre chronologique du
laboratoire fait foi. La projection s'écrit **après le commit et hors transaction**, sous
`try/catch` : un échec de projection est journalisé et n'invalide jamais un dépôt réussi. La
commande `make seals-sync` la reconstruit intégralement depuis les chaînes d'audit, et sa seconde
passe ne crée rien. Aucune décision métier ne se prend sur cette table.

**L'inscription rend son maillon.** `AuditTrailPort.append` retourne désormais `{ seq, occurredAt }`,
et les trois dépôts qui scellent un fichier — trace, empreinte de référence, rapport — rendent ce
maillon à leur appelant. Relire la chaîne après coup ne saurait pas lequel des maillons du dossier
vient d'être ajouté ; le numéro et l'horodatage projetés doivent être exactement ceux que le rapport
imprime pour le même fichier, sans quoi les deux dates se contrediraient sous les yeux d'un lecteur.

**L'horodatage extérieur se marque en une requête, à l'ancrage.** Après un ancrage réussi, tous les
scellés du laboratoire dont l'inscription est couverte reçoivent la date de l'autorité — un seul
`updateMany`, jamais une requête par pièce. La reprise applique la même règle : la date retenue est
celle de la **première** ancre qui couvre le scellé, la borne temporelle la plus serrée qu'on puisse
affirmer.

## Conséquences

- ✅ Une route publique répondra sans jamais ouvrir la base d'un laboratoire, ni poser de contexte de
  laboratoire.
- ✅ La table se reconstruit à volonté : sa perte n'est pas une perte de preuve.
- ✅ Le numéro d'inscription et l'horodatage projetés sont ceux du registre, pas une approximation.
- ⚠️ Deux sources décrivent le même fait. Elles peuvent diverger si une projection échoue et que
  personne ne lance la reprise : la page publique répondrait alors « inconnu » sur un fichier
  pourtant scellé. C'est un faux négatif, jamais un faux positif — le sens de l'erreur est le bon.
- ⚠️ La base d'administration reçoit une donnée dérivée d'un laboratoire. Elle reste muette :
  l'empreinte ne permet pas de reconstituer le fichier, et aucun nom, aucun numéro de dossier lisible
  n'y entre.
- ⚠️ La signature de `append` change pour tout le monde, alors que trois appelants seulement s'en
  servent. Le compilateur porte le changement ; les autres dépôts ignorent la valeur rendue.

## Alternatives écartées

- **Une route publique qui lit la base du laboratoire** — exigerait qu'un point d'entrée non
  authentifié sache ouvrir une connexion vers la base d'un client, ce que l'ADR-0001 isole
  précisément.
- **Projeter dans la même transaction que le dépôt** — ferait échouer un dépôt réussi parce qu'une
  base tierce est injoignable. La pièce serait perdue pour protéger une copie.
- **Relire le dernier maillon après le commit pour en connaître le numéro** — deux dépôts concurrents
  sur le même dossier liraient le maillon de l'autre.
- **Ne pas stocker le dossier ni la nature du document** — la page ne pourrait plus signaler qu'un
  rapport plus récent existe, ce qui est la seule chose utile qu'elle ait à dire au-delà du scellé.
- **Un compteur ou une date de version dans la réponse publique** — révélerait un décompte de
  documents ; on n'annonce que l'existence, jamais le nombre.
