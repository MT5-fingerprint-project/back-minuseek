# ADR-0021 — Ce que « concorder » veut dire, et quand la confrontation se joue

- **Statut** : accepté
- **Date** : 2026-08-29
- **Décideurs** : équipe back Minuseek

## Contexte

La vérification ne vaut que par son résultat : deux exploitations du même dossier, confrontées, qui
se rejoignent ou qui divergent. Cette définition finit imprimée dans une pièce de procédure, et une
divergence commande un troisième examen. Il fallait donc écrire, une fois, ce qu'on compare et à
quel moment.

Côté titulaire, le dossier porte déjà sa déclaration d'exploitabilité (`Trace.status`) et ses
identifications (`Hit`, une ligne par empreinte de référence retenue). Côté vérificateur, il n'y
avait rien.

## Décision

**On compare deux choses, trace par trace : la déclaration d'exploitabilité et l'identification.**
Deux conclusions concordent quand les deux côtés déclarent la même exploitabilité *et* désignent
exactement les mêmes empreintes de référence — aucune de part et d'autre comptant comme un accord.
Les calques, les filtres, les minuties et le nombre de points ne sont pas comparés : deux experts
arrivent à la même conclusion par des chemins différents, et exiger le même chemin ferait diverger
des dossiers qui s'accordent.

**Une trace que le titulaire n'a pas encore qualifiée ne concorde avec rien.** Son statut vaut
« reçue », qui n'est pas une déclaration ; face à une conclusion du vérificateur, la confrontation
répond « discordant ». Le dossier n'est pas prêt à être vérifié, et le dire est plus honnête que
d'inventer un accord.

**La confrontation se joue à la validation, et son résultat est écrit.** Le verdict est posé sur la
mission, et le verdict de chaque trace sur sa conclusion. Le recalculer à chaque lecture donnerait
un résultat qui change tout seul quand le titulaire revient sur sa déclaration après coup — un
rapport édité le matin ne dirait pas la même chose que le même rapport édité le soir.

**Une conclusion se révise après la validation, tant que le dossier est ouvert, et la mission est
reconfrontée.** Le vérificateur n'est pas enfermé dans une erreur de saisie, et il continue de lire
le dossier qu'il a vérifié (ADR-0019). La révision inscrit une conclusion au journal, rejoue la
confrontation, pose le nouveau verdict — et n'efface pas l'ancien : les deux actes restent dans la
chaîne, dans l'ordre. La clôture du dossier ferme cette porte comme elle ferme les autres : on ne
conclut ni ne valide plus sur un dossier clos.

**Deux types d'acte rejoignent le catalogue figé** : `VERIFICATION_CONCLUSION_STATED` à chaque
conclusion rendue ou révisée, `CASE_VERIFICATION_COMPLETED` à chaque clôture, avec le verdict et les
traces qui divergent.

## Conséquences

- ✅ Le verdict imprimé dans un rapport est celui qui a été prononcé, à la date où il l'a été.
- ✅ La divergence est nominative et traçable trace par trace, ce que l'annexe du rapport pourra
  lire sans recalculer.
- ⚠️ La plateforme signale la divergence, elle ne confie pas le troisième examen : c'est le
  responsable qui décide, et rien ne le lui rappelle aujourd'hui.
- ⚠️ La validation exige une conclusion sur **toutes** les traces non retirées du dossier. Une trace
  versée pendant la vérification rouvre donc la complétude ; c'est voulu, mais le vérificateur n'en
  est pas averti.
- ⚠️ Une divergence découverte après la clôture du dossier ne se corrige plus par une révision : il
  faut rouvrir le dossier, ce qui est un acte tracé.

## Alternatives écartées

- **Comparer les minuties ou leur nombre** — c'est comparer les chemins, pas les conclusions.
- **Recalculer la concordance à chaque lecture** — le verdict deviendrait une fonction de l'état
  courant du dossier, donc instable.
- **Interdire toute révision après validation** — pousse à recréer une mission pour corriger une
  faute de frappe, et brouille l'historique au lieu de le tenir.
