# ADR-0009 — Aggregate `Subject` (identity-access) rattaché à une affaire, empreintes liées par lien souple

- **Statut** : proposé
- **Date** : 2026-07-22
- **Décideurs** : Adrien Quacchia, équipe back-minuseek

## Contexte

On doit modéliser les personnes (traces / empreintes) : familiers (« close associates ») et
mis en cause (MEC / « persons of interest »). Ces sujets portent une identité civile (nom, prénom,
naissance, filiation, téléphone, sexe) et une couleur d'affichage. Le métier impose :
- créer un sujet **sur une affaire, sans empreinte** (formulaire) ;
- lui associer ensuite des empreintes de référence, avec leur position sur la main.

Deux contraintes structurent le choix :
- `Subject` relève du bounded context **`identity-access`** (identité des personnes).
- `ReferencePrint` existe déjà dans le bounded context **`biometrics`**, avec un `caseId`
  stocké en **UUID nu** (pas de relation Prisma cross-contexte, cf. `Trace`).
- Règle projet non négociable : **communiquer entre bounded contexts par UUID uniquement**.

## Décision

1. Créer l'aggregate **`Subject`** dans `identity-access` (VO `Sex`, `SubjectType`), calqué
   sur l'aggregate `User` (constructeur privé + factory, port repository + reader/read-model
   CQRS, adapters Prisma/In-Memory).
2. **Un sujet appartient à une seule affaire** (many-to-one) : `Subject.caseId` (**UUID nu**,
   référence cross-contexte vers `InvestigationCase`, indexé, sans `@relation`). Pas de table
   de liaison.
3. Le **type est un attribut du sujet** (`Subject.type`,
   `CLOSE_ASSOCIATE` | `PERSON_OF_INTEREST`).
4. API : `POST /subjects` crée le sujet sur son affaire (identité + caseId + type) ;
   `GET /subjects?caseId=...` liste les sujets d'une affaire ; `GET /subjects/:id` renvoie le
   détail.
5. Rattacher une empreinte à un sujet par un **lien souple** : colonne `subjectId`
   (**UUID nu, nullable, sans `@relation`**) sur `ReferencePrint`.
6. Ajouter sur `ReferencePrint` un enum **`FingerPosition`** (nullable) pour la position :
   10 doigts + paume gauche/droite + `OTHER`.

## Conséquences

- ✅ Modèle et API minimaux : une route d'écriture, pas de table de liaison ni de dispatch.
- ✅ Un sujet se crée sur une affaire **sans empreinte** ; les empreintes s'associent après
   coup (`subjectId` + `position` sur l'upload).
- ✅ Les bounded contexts restent découplés (aucun import ni FK physique cross-contexte),
   conformément à la règle « UUID only » — `Subject.caseId` et `ReferencePrint.subjectId`
   sont des UUID nus.
- ⚠️ Une même personne présente dans plusieurs affaires = **plusieurs lignes `Subject`**
   (pas de dédoublonnage inter-affaires). Si ce besoin devient réel, re-passer par une table
   de liaison fera l'objet d'un nouvel ADR.
- ⚠️ Pas d'intégrité référentielle en base pour les liens cross-contexte
   (`Subject.caseId`, `ReferencePrint.subjectId`) : cohérence garantie applicativement.
- ⚠️ L'existence de l'affaire n'est pas vérifiée à la création du sujet (à durcir plus tard,
   cf. le pattern de validation d'affaire d'ADR-0008, si le besoin se confirme).

## Alternatives écartées

- **Relation Prisma dure `ReferencePrint` → `Subject` (FK physique)** — donnerait l'intégrité
  référentielle mais codifierait un couplage DB entre `biometrics` et `identity-access`,
  en violation de la règle « UUID only ».
- **Table de liaison `SubjectCase` (many-to-many) + `type` par affaire** — implémentée puis
  retirée : permettait de réutiliser un même sujet dans plusieurs affaires (route POST
  polymorphe avec `subjectId`), mais complexité jugée prématurée par rapport au besoin
  produit actuel (un sujet vit dans son affaire).
- **Nouvelle table dédiée `SubjectFingerprint` dans `identity-access`** — dupliquerait le
  concept d'empreinte déjà porté par `ReferencePrint`.
