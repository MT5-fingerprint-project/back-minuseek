# ADR-0024 — Le travail de l'appelant est une lecture sans paramètre

- **Statut** : accepté
- **Date** : 2026-09-05

## Contexte

L'accueil de l'opérateur a besoin de cinq choses : sa production de l'année, ses dossiers en cours et
leur ancienneté, les discordances posées sur ses dossiers, et les traces qui attendent un geste.
Presque tout cela est déjà calculé par `GetServiceActivityHandler`, qui accepte même un
`operatorUserId` pour restreindre la lecture à une personne.

La tentation était d'élargir la garde de cette query — elle lève `ServiceActivityNotAllowedError`
dès que l'appelant n'est pas ADMIN — au cas « je demande mes propres chiffres ». C'est un piège
vérifié dans le code : `PrismaServiceActivityReader.read()` construit `byOperator` à partir de
`serviceOpenCases` et `serviceClosedCases`, les listes **non filtrées**, et le mappe sur tout
l'annuaire du service. Le filtre par opérateur ne s'applique qu'aux compteurs, jamais à cette
ventilation. Un opérateur autorisé à lire ce contrat y trouverait la charge nominative de chacun de
ses collègues et leur délai médian de clôture.

## Décision

**Une query neuve, `GET /api/my-work`, dont le périmètre n'est pas un paramètre.** Le controller
résout l'appelant via `@CurrentServiceUser()` et construit `GetMyWorkQuery(requester.id)` ; il n'y a
ni DTO, ni query string, ni identifiant d'opérateur à falsifier. Un compte ne peut structurellement
pas demander le travail d'un autre — la garde n'est pas un `if`, c'est l'absence d'entrée.

**Un contrat volontairement amputé.** `MyWorkReadModel` ne porte ni `byOperator`, ni
`medianClosureDays`, ni `monthlyFlow`, ni aucun ratio. Ce qui n'est pas dans le contrat ne peut pas
fuiter. La query du responsable reste inchangée et garde sa garde de rôle.

**« Identifiée » prend la définition stricte.** Une trace n'est comptée identifiée que si le
rapprochement **et** l'empreinte de référence qu'il désigne sont non retirés — celle que
`PrismaTraceReader` sert déjà à l'opérateur sur sa fiche de trace. `PrismaServiceActivityReader`
omet le second filtre ; les deux chiffres peuvent donc diverger dès qu'une empreinte de référence
est retirée d'un dossier.

**La production couvre les dossiers clos, la file non.** Une trace identifiée dans un dossier qu'on a
refermé reste du travail fait : la production de l'année porte sur tous les dossiers dont l'appelant
est titulaire. Les discordances et les traces en attente, elles, ne regardent que les dossiers
ouverts — il n'y a rien à reprendre sur un dossier clos.

**Le rattachement passe par le dossier.** `Trace` ne porte aucune colonne d'utilisateur : « mes
traces » n'existe pas en base. Le périmètre est `InvestigationCase.operatorUserId`, le titulaire seul
— pas l'union du titulaire et du relecteur que rend `CaseAccessService.visibleCaseIds`.

## Conséquences

- ✅ Aucune donnée nominative d'un collègue n'est atteignable depuis cet endpoint.
- ✅ La query du responsable n'est pas touchée : aucune régression possible sur la page de pilotage.
- ⚠️ Deux définitions d'« identifiée » cohabitent désormais explicitement dans le dépôt. Aligner
  `PrismaServiceActivityReader` reste à faire, et changera les chiffres que voit le responsable.
- ⚠️ Le titulaire et le relecteur ne voient pas le même périmètre : un opérateur qui relit beaucoup
  verra dans « ses dossiers » moins de choses que dans la liste des affaires, qui rend l'union.
- ⚠️ `MyWorkReadModel.cases.oldest` est plafonné à cinq côté serveur. Le client ne peut pas demander
  plus, et c'est voulu : au-delà, c'est la liste des affaires qui répond.

## Alternatives écartées

- **Élargir la garde de `get-service-activity` au cas `operatorUserId === requester.id`** — trois
  lignes, et une fuite de la charge nominative de tout le service par `byOperator`.
- **Filtrer le read model du responsable au moment de le servir** — une seconde vérité à maintenir,
  et une fuite au premier champ ajouté qu'on oublierait de filtrer.
- **Composer la page depuis les endpoints existants côté client** — `ListTracesDto.caseId` est
  obligatoire, il faudrait un appel par dossier pour compter les traces en attente.
