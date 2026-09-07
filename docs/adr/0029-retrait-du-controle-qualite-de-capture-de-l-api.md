# ADR-0029 — Le contrôle de netteté sort de l'API : la mesure du viseur ne décrit pas la pièce versée

- **Statut** : accepté
- **Date** : 2026-09-07
- **Décideurs** : équipe back Minuseek (ticket L3-6)

## Contexte

ADR-0013 (ticket B3) a donné au back de quoi recevoir, valider, persister et exposer un contrôle
de netteté relevé par le mobile au déclenchement : `captureQuality`, de forme
`{ blurScore, passed }`, sur `POST /traces` et dans les lectures de traces. Le code est en
production. Il n'a jamais eu de producteur : ADR-0013 concluait que « basculer
`SEND_CAPTURE_QUALITY` à `true` côté mobile suffit à remplir la colonne » — ce basculement n'a
pas eu lieu.

Entre-temps, **L3-4 a tranché l'inverse**. Le voyant de netteté du viseur analyse les images du
flux de prévisualisation, en continu, pour dire à l'opérateur quand déclencher. Ce qu'il mesure
est la netteté d'une image du viseur — basse définition, avant l'autofocus final, avant le
traitement du capteur — et non celle du JPEG effectivement versé au dossier. Les deux nombres ne
sont pas comparables, et la forme figée du champ (`blurScore` seul, sans dire de quelle image il
parle, à quelle définition, sous quel seuil) ne permet pas d'écrire cette différence dans la
donnée.

Constat vérifié le 2026-09-01 : zéro occurrence de `captureQuality` dans `front-minuseek`,
`admin-minuseek`, `mobile-minuseek` et `data-minuseek`. Le back écrit et expose un champ que
personne n'écrit ni ne lit.

Un champ mort n'est pas neutre. Il se documente dans Swagger, il invite le prochain développeur
à le remplir, et il fera croire à une donnée de qualité qui n'existe pas dans les dossiers — dans
un produit dont les sorties sont versées en procédure, c'est le mauvais genre de promesse.

## Décision

**On retire `captureQuality` du contrat de l'API et du domaine, et on garde la colonne en base.**

1. `POST /traces` n'accepte plus le champ. Il n'est pas déprécié en douceur : aucun client ne
   l'envoie, il n'y a personne à prévenir. Il repart en 400 comme n'importe quelle clé inconnue,
   par le `forbidNonWhitelisted` déjà posé sur la route — et c'est un test qui le prouve.
2. `GET /traces` et `GET /traces/:id` ne rendent plus la clé. Le read-model la perd, et le reader
   Prisma **omet explicitement la colonne** dans ses deux requêtes : les lignes sont projetées
   par diffusion (`...row`), donc ne plus typer le champ ne suffisait pas à cesser de le rendre —
   les traces déposées quand B3 était vivant portent encore une valeur.
3. Le VO `CaptureQuality`, son erreur, son DTO et leurs specs disparaissent. Les tests du champ
   sont supprimés avec le code qu'ils couvraient, pas réécrits.
4. **La colonne `captureQuality Json?` reste**, avec un commentaire qui dit qu'elle est inutilisée,
   depuis quand et pourquoi. Elle vient de la migration `20260818143721_add_trace_capture_metadata`,
   antérieure à B3 ; la retirer serait une migration destructive **en fan-out sur toutes les bases
   tenant** (ADR-0001), à trois jours de la démonstration. Une colonne nullable inutilisée ne coûte
   rien ; les valeurs déjà écrites restent là où elles sont.

ADR-0013 passe en `remplacé par ADR-0029`.

## Conséquences

- ✅ L'API ne promet plus une donnée de qualité de capture qu'aucun dossier ne porte.
- ✅ Le domaine de la trace perd un VO, une erreur et un chemin de reconstitution : `Trace` se lit
  et se relit sans eux.
- ✅ Le nombre de tests diminue — c'est le signe attendu d'un retrait réussi, pas une régression
  de couverture.
- ⚠️ La base garde une colonne morte, et les lignes antérieures gardent leur contenu. Elle n'est
  plus lue par personne : seule une requête SQL directe y accède encore.
- ⚠️ Si la mesure de netteté doit un jour remonter, elle repartira d'une forme neuve, décidée
  pour ce qu'on veut vraiment qualifier (la pièce versée), pas de celle-ci.

## Alternatives écartées

- **Garder le champ « au cas où »** — c'est ce qu'on vient de payer : dix-neuf fichiers, une
  surface Swagger et des tests entretenus pendant trois semaines pour une donnée qui n'a jamais
  existé dans un dossier.
- **Supprimer la colonne dans le même ticket** — migration destructive en fan-out sur toutes les
  bases tenant, à trois jours de la démonstration, pour un gain nul : le risque est sans rapport
  avec le bénéfice.
- **Mesurer la netteté côté serveur, sur le JPEG reçu** — c'est une autre fonctionnalité, avec une
  autre forme de donnée et une autre justification à écrire. Personne ne la demande aujourd'hui,
  et l'ajouter ici masquerait le retrait derrière un remplacement.
- **Déprécier le champ en Swagger et l'accepter encore un temps** — une dépréciation ne s'adresse
  qu'à des clients existants. Il n'y en a aucun.
