# ADR-0020 — Le mode aveugle est décidé et appliqué par le serveur, et le calque porte son auteur

- **Statut** : accepté
- **Date** : 2026-08-29
- **Décideurs** : équipe back Minuseek

## Contexte

Une vérification n'a de valeur que si celui qui la mène ignore le résultat du premier examen. Un
vérificateur qui ouvre une trace et y voit douze minuties déjà posées et une correspondance déjà
déclarée n'a plus rien à trouver : il valide.

Le dépôt ne s'y prêtait pas. Les calques d'une image sont communs — `Layer` ne portait aucun auteur,
et deux personnes qui ouvraient la même trace voyaient les mêmes annotations. La déclaration
d'exploitabilité est un champ unique sur la trace. Seule l'identification était déjà attribuée
(`Hit.declaredByUserId`).

## Décision

**Le serveur décide seul qui lit en aveugle, et l'aveuglement s'arrête à la mission.** Le garde
d'accès résout déjà l'affaire ; il rend désormais, avec le titre, un `verificationInProgress` — le
seul bit dont le masquage a besoin, lu dans la requête qui tournait déjà. Le titre, lui, ne change
pas : un vérificateur reste vérificateur, mission rendue ou non (ADR-0019), et c'est bien la mission
en cours, et elle seule, qui aveugle. Un paramètre d'adresse fourni par le client aurait été
contournable en une requête. Le décorateur `@BlindVerifierId()` rend le compte de l'appelant tant
que sa mission est ouverte, `null` sinon, et les trois lectures concernées le reçoivent.

**Le masquage est un filtre de lecture, pas un habillage.** Les calques et les correspondances sont
filtrés dans la requête SQL, par auteur ; la déclaration d'exploitabilité est vidée dans le handler
avant de sortir. Rien n'est renvoyé puis caché à l'écran : ce qui n'est pas montré n'est pas
transmis.

**`Layer` porte désormais `createdByUserId`, nullable.** Les calques antérieurs à la migration n'ont
pas d'auteur, et un calque sans auteur n'appartient à personne : il disparaît de la vue du
vérificateur au lieu de lui être attribué par défaut. L'auteur est aussi inscrit dans le journal des
actes du calque, où l'acteur ne porte que l'identifiant Keycloak — c'est ce qui permettra à l'annexe
du rapport de dire de qui vient chaque geste.

**Le journal des actes et les rapports du dossier sont fermés au vérificateur en mission.** Ils
contiennent, en clair, tout ce que le mode aveugle retire : les calques du titulaire, ses
identifications, ses déclarations. Ils rejoignent donc les routes d'administration de l'affaire
(ADR-0019) et répondent 403 tant que la mission est en cours. La déclaration d'expertise et la
saisine les y rejoignent : engager le service devant un tribunal n'est pas un geste de vérificateur.

**Ce qui n'est pas masqué l'est délibérément** : les images, les empreintes de référence, les
métadonnées de capture — le vérificateur travaille sur les mêmes pièces — et les scores du
comparateur automatique, qui sont un calcul de machine et non l'avis d'une personne.

**Le vérificateur ne touche pas au dossier de l'autre.** Masquer les lectures ne suffit pas : tant
que les deux examens partagent les mêmes lignes, le second écrase le premier. Une identification est
une ligne unique par couple trace / empreinte : déclarée une seconde fois, elle change simplement
d'auteur, et la confrontation lirait alors les conclusions du vérificateur comme étant celles du
titulaire. Toutes les écritures sur l'exploitation partagée lui sont donc fermées — déclarer ou
retirer une identification, retirer ou rétablir une pièce, recalibrer une image — et ses conclusions
passent par la table de sa mission, jamais par les `Hit` du dossier. Sur les calques, la règle est
la même par l'auteur : il ne modifie et ne supprime que les siens, et une création ne peut plus
reprendre l'identifiant d'un calque existant — le dépôt écrivait par `upsert`, si bien qu'un
identifiant choisi par le client suffisait à réécrire le calque d'un autre et à s'en attribuer la
paternité.

## Conséquences

- ✅ Le second examen part d'une image nue, et son résultat vaut quelque chose.
- ✅ Aucune vue du front ne peut, par oubli, laisser filtrer le travail du titulaire : la donnée
  n'arrive pas.
- ✅ Une fois ses conclusions rendues, le vérificateur relit le dossier entier, comme n'importe quel
  lecteur qui y a accès : le masquage tombe avec la mission, sans qu'on lui retire l'accès.
- ⚠️ Le vérificateur en mission ne peut plus éditer un rapport du dossier ni lire son journal. C'est
  voulu, et c'est un changement de comportement pour les rôles existants uniquement lorsqu'une
  mission leur est confiée. Le refus, lui, ne tombe pas avec la mission : un vérificateur n'administre
  jamais l'affaire qu'il a vérifiée.
- ⚠️ Un responsable de service ne peut pas recevoir de vérification : sa fonction lui ouvre le
  dossier entier, l'aveuglement n'aurait aucun effet sur lui. La commande le refuse en clair plutôt
  que de laisser croire à une vérification aveugle qui n'en serait pas une.
- ⚠️ Le comparateur automatique reste ouvert au vérificateur : les scores et le classement des
  empreintes sont un calcul de machine, et deux exécutions donnent le même résultat.

## Alternatives écartées

- **Masquer à l'écran** — la réponse contiendrait la donnée ; l'onglet réseau du navigateur suffit.
- **Un paramètre `?mode=blind`** — le client choisirait s'il veut être aveugle.
- **Dupliquer les calques par personne** — deux jeux de données à maintenir là où une colonne
  d'auteur suffit.
