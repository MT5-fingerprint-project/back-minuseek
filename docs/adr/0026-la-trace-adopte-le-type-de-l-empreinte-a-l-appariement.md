# ADR-0026 — À l'appariement, la trace adopte le type de l'empreinte

- **Statut** : accepté
- **Date** : 2026-09-06

## Contexte

ADR-0023 arbitrait le type d'une paire en quatre branches, dont la dernière était un refus :
deux types déterminés différents de part et d'autre, et l'appariement était rejeté en 409, en
nommant les deux libellés.

Le refus se produit exactement là où l'opérateur a le plus besoin d'avancer. Il relève ses
minuties sur une trace de scène — dégradée, partielle, souvent lue à la limite — puis les
compare à une fiche décadactylaire nette, où la même minutie se lit sans ambiguïté. Quand les
deux lectures divergent, ce n'est pas un désaccord entre deux observations de même valeur :
c'est une lecture incertaine mise en face d'une lecture sûre. Le logiciel répondait pourtant
en fermant la porte, et laissait l'opérateur ressortir de l'atelier pour corriger son relevé
avant de pouvoir apparier.

ADR-0025 a levé la moitié du problème la veille, en autorisant la requalification d'une
minutie déjà appariée. Restait celle-ci : le premier appariement lui-même.

## Décision

**L'appariement ne refuse plus jamais sur le type : la minutie de la trace adopte celui de
l'empreinte de référence.** C'est le traitement que recevait déjà une minutie de trace
indéterminée, étendu au cas où elle porte un type. `resolvePairType` descend à trois branches
et son union à deux membres : deux types égaux apparient, et sinon une minutie cède. La classe
`IncompatibleMinutiaTypesError` disparaît, ainsi que le 409 qu'elle portait.

**La seule asymétrie conservée est l'empreinte indéterminée face à une trace typée** : là,
c'est l'empreinte qui plie. Un type relevé par l'opérateur ne s'efface pas devant une
non-réponse, et l'ordre des branches le garantit — la garde « empreinte indéterminée » passe
avant le cas général.

**L'adoption entraîne les paires déjà posées sur la minutie qui cède**, dans la même
transaction, comme le fait `UpdateLayerHandler` depuis ADR-0025. Une minutie de trace appariée
à deux empreintes ne peut pas porter un libellé sur une planche et un autre sur la suivante :
l'invariant d'ADR-0023 — les deux minuties d'une paire portent le même type — tient par les
deux portes ou par aucune. Le contrôle d'auteur du mode aveugle vaut pour ces correspondantes
comme pour les deux minuties visées.

**L'acte dit d'où vient le type, et ce qu'il a écrasé.** Le `LAYER_UPDATED` de la
requalification porte la pièce et le calque sur lesquels le type a été lu, et le
`MINUTIA_PAIRED` garde la lecture que la minutie qui a cédé portait avant le geste. Sans ça,
l'acte d'appariement, lu seul, attestait une concordance de type qui n'existait pas au moment
où l'opérateur a cliqué — et rien, dans la chaîne, ne disait que la valeur venait de la fiche
du suspect plutôt que d'une relecture de la trace. C'est ce sens de circulation qu'un
contre-expert cherchera en premier.

**La requalification gagne sa phrase au rapport** : « Minutie requalifiée de « arrêt de
ligne » en « bifurcation » sur la trace … », et elle échappe au repli du mode résumé, qui est
le mode par défaut. Tant que la requalification ne touchait que des minuties indéterminées,
elle n'écrasait rien que l'opérateur eût affirmé ; elle écrase désormais une observation
déclarée, et devient le geste ordinaire. Un rapport scellé qui l'imprimerait « Minutie
déplacée » — ce que faisait la règle `LAYER_UPDATED` — décrirait un geste qui n'a pas eu lieu.
La phrase sert les trois chemins d'écriture : l'appariement, la correction manuelle du type, et
la propagation d'ADR-0025.

## Conséquences

- ✅ Le geste le plus fréquent de l'atelier ne se termine plus par un cul-de-sac. Une paire
  porte toujours un seul type, mais par adoption au lieu du refus.
- ✅ L'écrasement est lisible dans le rapport et nommé avec ses deux valeurs, ce qu'il n'était
  pas quand il ne concernait que les indéterminées.
- ✅ La correction manuelle d'un type s'imprime enfin pour ce qu'elle est, et non « Minutie
  déplacée » : `UpdateLayerHandler` porte désormais `previousMinutiaType` sur la minutie suivie
  comme sur sa correspondante.
- ✅ Le sens de l'écriture est lisible : « Minutie requalifiée de « … » en « … » sur la trace
  …, par alignement sur l'empreinte … », et l'acte d'appariement ajoute « la trace était
  relevée « … » ».
- ⚠️ Défaire la paire ne restitue pas le type d'origine à la minutie : `RemoveMinutiaPairHandler`
  ne touche à aucun calque. L'opérateur peut le retaper à la main une fois la paire défaite.
- ⚠️ Le seul avertissement avant l'écrasement est le dialogue de confirmation du front. La
  commande ne porte aucun champ de consentement : un appel direct produit le même maillon.
- ⚠️ Les deux marques de `MINUTIA_PAIRED` restent celles d'après adoption — c'est l'état de la
  paire, et le rapport en dérive le type imprimé. Ce que la minutie portait avant se lit à côté,
  dans `observedMinutiaType`, et non dans la marque.
- ⚠️ La règle reste réimplémentée côté front pour prévenir avant d'appeler, et `front-minuseek`
  n'a toujours aucun lanceur de tests. Le back fait foi.

## Alternatives écartées

- **Garder le refus et demander de corriger le type à la main d'abord** — c'est deux gestes
  pour un, sur le cas le plus courant, et le dialogue d'ADR-0025 rend la correction possible
  sans défaire la paire : le refus n'apporte plus qu'un aller-retour.
- **Faire gagner la trace** — l'empreinte de référence est la pièce nette ; c'est elle qui fait
  foi sur la forme du détail, pas le relevé fait sur une trace dégradée.
- **Ouvrir le choix du gagnant dans le dialogue** — une décision de plus à chaque clic, sur un
  geste qui se répète au moins douze fois par comparaison, pour un arbitrage dont la réponse
  est presque toujours la même.
