# ADR-0025 — Requalifier une minutie appariée requalifie la paire

- **Statut** : accepté
- **Date** : 2026-09-05

## Contexte

ADR-0023 a fermé une porte : « requalifier une minutie déjà appariée est refusé (409), il
faut défaire la paire d'abord ». Le motif était honnête — une propagation silencieuse au
binôme aurait été une écriture invisible de plus sur une donnée qui finit dans un rapport.

À l'usage, la porte coûte plus qu'elle ne protège. Le type est ce que l'opérateur voit le
moins bien au moment où il pose la minutie ; il le corrige souvent après, une fois les deux
images côte à côte et les filtres appliqués. Or défaire la paire pour changer un libellé
n'est pas neutre : le numéro d'une paire dérive de son ordre de pose, donc la paire refaite
repart en fin de série et l'annexe B raconte une démonstration dans un autre ordre que
celui du geste. Le journal, lui, garde un `MINUTIA_UNPAIRED` suivi d'un `MINUTIA_PAIRED`
qui décrivent une hésitation sur la correspondance, alors qu'il n'y en a eu aucune : ce qui
a changé, c'est la lecture du dessin, pas l'appariement.

Le front, de son côté, ne pouvait qu'annoncer l'impasse : un toast disait « défaites la
paire avant d'en changer le type », sans rien proposer.

## Décision

**Changer le type d'une minutie appariée est accepté, et le nouveau type est écrit sur les
deux minuties de la paire dans la même transaction.** `UpdateLayerHandler` relit les paires
du calque avant d'écrire, requalifie chaque correspondante et chaîne un `LAYER_UPDATED` par
côté ; celui de la correspondante porte `previousMinutiaType`, comme le fait déjà la
branche de requalification de l'appariement. L'invariant d'ADR-0023 — les deux minuties
d'une paire portent le même type — tient donc toujours, et le type que le lecteur du
rapport dérive de la minutie de la trace ne peut plus être démenti par l'empreinte.

**Le front demande confirmation avant d'appeler**, en nommant le numéro de la paire et le
type visé : « cette minutie forme la paire 3 : la passer en îlot changera aussi le type de
la minutie correspondante sur l'autre image ». L'objection d'ADR-0023 tombe là : l'écriture
n'est plus invisible, elle est annoncée avant et journalisée avec l'ancienne et la nouvelle
valeur après.

**Le contrôle d'auteur du mode aveugle vaut pour la correspondante comme pour la minutie
suivie.** Un vérificateur en aveugle ne peut pas requalifier un calque qui n'est pas le
sien, même par ricochet ; l'appariement lui interdisant déjà les paires mixtes, la garde ne
se déclenche que sur une base déjà incohérente, mais elle est là.

## Conséquences

- ✅ Corriger un type ne consomme plus un numéro de paire ni ne réordonne l'annexe B.
- ✅ Le journal distingue enfin la correction de lecture (deux `LAYER_UPDATED`) de
  l'hésitation sur la correspondance (`MINUTIA_UNPAIRED` puis `MINUTIA_PAIRED`).
- ⚠️ Un acte de l'opérateur écrit sur une pièce qu'il n'a pas forcément sous les yeux —
  l'empreinte de référence. La confirmation le dit, et l'autre canevas ne l'affiche qu'après
  invalidation du cache de calques.
- ⚠️ Une minutie de trace appariée à deux empreintes propage sur chacune : un seul geste,
  autant d'actes que de paires.
- ⚠️ Le paragraphe « porte à sens unique » d'ADR-0023 est caduc, et l'erreur
  `PairedMinutiaTypeChangeError` disparaît avec son 409. Le reste d'ADR-0023 tient.
- ⚠️ La règle reste réimplémentée côté front pour prévenir avant d'appeler, et
  `front-minuseek` n'a toujours aucun lanceur de tests.

## Alternatives écartées

- **Défaire la paire quand le type change** — l'opérateur perdrait le numéro et l'ordre de
  la démonstration pour une correction de libellé, et le journal raconterait une hésitation
  sur la correspondance qui n'a pas eu lieu.
- **Garder le refus, mieux l'expliquer** — le message aurait été plus clair, l'impasse
  identique : c'est le geste le plus fréquent de l'atelier qui reste interdit.
- **Propager sans confirmer** — l'écriture invisible qu'ADR-0023 refusait à raison. La
  confirmation coûte un clic et rend l'acte assumé.
