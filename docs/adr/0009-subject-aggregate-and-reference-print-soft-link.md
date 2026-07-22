# ADR-0009 — Aggregate `Subject` (identity-access), liaison `SubjectCase` et rattachement des empreintes par lien souple

- **Statut** : proposé
- **Date** : 2026-07-22
- **Décideurs** : Adrien Quacchia, équipe back-minuseek

## Contexte

On doit modéliser les personnes (traces / empreintes) : familiers (« known associates ») et
mis en cause (MEC / « suspects »). Ces sujets portent une identité civile (nom, prénom,
naissance, filiation, téléphone, sexe). Le métier impose :
- créer un sujet **sur une affaire, sans empreinte** ;
- pouvoir retrouver le même sujet dans **plusieurs affaires** ;
- lui associer ensuite des empreintes de référence, avec leur position sur la main.

Deux contraintes structurent le choix :
- `Subject` relève du bounded context **`identity-access`** (identité des personnes).
- `ReferencePrint` existe déjà dans le bounded context **`biometrics`**, avec un `caseId`
  stocké en **UUID nu** (pas de relation Prisma cross-contexte, cf. `Trace`).
- Règle projet non négociable : **communiquer entre bounded contexts par UUID uniquement**.

## Décision

1. Créer l'aggregate **`Subject`** dans `identity-access` (VO `Sex`), calqué sur l'aggregate
   `User` (constructeur privé + factory, port repository + reader/read-model CQRS, adapters
   Prisma/In-Memory).
2. Créer la table de liaison **`SubjectCase`** (many-to-many sujet ↔ affaire) dans
   `identity-access` : `subjectId` (relation Prisma **intra**-contexte), `caseId` (**UUID nu**,
   référence cross-contexte vers `InvestigationCase`), unicité `(subjectId, caseId)`.
3. Le **type du sujet est porté par la liaison** (`SubjectCase.type`,
   `KNOWN_ASSOCIATE` | `SUSPECT`) : un même sujet peut être MEC dans une affaire et familier
   dans une autre.
4. API : **une seule route d'écriture polymorphe** — `POST /subjects` (caseId + type toujours
   obligatoires) couvre les deux gestes du front, dispatchés par le controller vers deux
   commands distinctes : **sans `subjectId`**, création du sujet (champs d'identité requis,
   validés par `ValidateIf`) + rattachement ; **avec `subjectId`**, association d'un sujet
   existant à l'affaire (404 si inconnu, 409 si déjà rattaché). `GET /subjects?caseId=...`
   liste les sujets d'une affaire ; `GET /subjects/:id` renvoie l'identité + les rattachements.
5. Rattacher une empreinte à un sujet par un **lien souple** : colonne `subjectId`
   (**UUID nu, nullable, sans `@relation`**) sur `ReferencePrint`.
6. Ajouter sur `ReferencePrint` un enum **`FingerPosition`** (nullable) pour la position :
   10 doigts + paume gauche/droite + `OTHER`.

## Conséquences

- ✅ Un sujet se crée sur une affaire **sans empreinte**, et se rattache ensuite à d'autres
   affaires ; les empreintes s'associent après coup (`subjectId` + `position` sur l'upload).
- ✅ Les bounded contexts restent découplés (aucun import ni FK physique cross-contexte),
   conformément à la règle « UUID only » — `SubjectCase.caseId` et `ReferencePrint.subjectId`
   sont des UUID nus.
- ✅ Le type Familier/MEC est contextuel à l'affaire, fidèle au métier.
- ⚠️ Pas d'intégrité référentielle en base pour les liens cross-contexte
   (`SubjectCase.caseId`, `ReferencePrint.subjectId`) : cohérence garantie applicativement.
- ⚠️ L'existence de l'affaire n'est pas vérifiée à la création du lien (à durcir plus tard,
   cf. le pattern de validation d'affaire d'ADR-0008, si le besoin se confirme).

## Alternatives écartées

- **Relation Prisma dure `ReferencePrint` → `Subject` (FK physique)** — donnerait l'intégrité
  référentielle mais codifierait un couplage DB entre `biometrics` et `identity-access`,
  en violation de la règle « UUID only ».
- **`type` global sur `Subject`, sans `SubjectCase`** (lien affaire déduit des empreintes) —
  écartée car le métier exige de créer un sujet sur une affaire **sans** empreinte, et le
  statut MEC/familier peut varier d'une affaire à l'autre.
- **Nouvelle table dédiée `SubjectFingerprint` dans `identity-access`** — dupliquerait le
  concept d'empreinte déjà porté par `ReferencePrint`.
