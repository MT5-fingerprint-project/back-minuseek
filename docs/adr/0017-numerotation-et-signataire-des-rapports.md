# ADR-0017 — Un rapport porte un numéro pris sur un compteur unique par dossier, et le nom de celui qui le signe

- **Statut** : accepté
- **Date** : 2026-08-28
- **Décideurs** : équipe back Minuseek

## Contexte

Jusqu'ici, deux générations successives sur le même dossier produisaient deux lignes que rien ne
distinguait à l'écran, sauf leur horodatage, et deux PDF qui portaient chacun un identifiant
technique de trente-six caractères. Un magistrat qui reçoit deux exemplaires ne peut pas dire lequel
il tient. Le document ne dit pas non plus qui engage sa responsabilité sur ses conclusions : il
imprimait le nom de celui qui avait cliqué sur « Générer », ce qui n'est pas la même chose. Dans le
service, un technicien prépare couramment un document que son chef de section signe.

Deux types de documents cohabitent sur un même dossier, le rapport d'exploitation et l'annexe de
traçabilité, et rien ne les distinguait non plus dans la liste.

## Décision

**Le compteur est unique par dossier, tous types de documents confondus.** La séquence attribuée est
la plus grande séquence déjà prise sur le dossier, plus un ; le texte imprimé s'écrit
`<numéro de dossier>-R<séquence>`. Un numéro désigne donc un seul document : jamais un rapport
d'exploitation `3455-R2` et une annexe `3455-R2`. La contrainte `@@unique([caseId, sequence])` fait
foi, et deux générations concurrentes se départagent dessus — la perdante reçoit un 409 explicite et
relance, plutôt qu'un doublon silencieux.

**Le numéro est figé, et ne se recalcule jamais.** `sequence` et `number` sont deux colonnes, pas
une : la première sert à attribuer la suivante, la seconde est le texte que le PDF a imprimé. Corriger
le numéro de dossier plus tard ne réécrit pas les numéros des rapports déjà édités, sans quoi une
pièce en circulation ne correspondrait plus à sa ligne en base.

**La filiation se lit entre documents de même type.** Un rapport annonce le rapport auquel il succède,
une annexe l'annexe précédente. Une annexe éditée entre deux rapports consomme un numéro mais
n'apparaît pas comme leur antérieur : écrire « le présent rapport succède au rapport 3455-R2 » alors
que `R2` est un journal détaillé serait faux. Le document ne peut rien dire d'une version ultérieure,
qui n'existe pas encore quand il s'imprime ; c'est la page publique de vérification qui la signalera.

**On ne signe que pour soi.** Le signataire est le compte de service de l'appelant, résolu à partir du
jeton ; la route n'offre aucun moyen d'en désigner un autre, et le contrôle d'entrée refuse en 400 un
`signerUserId` glissé dans le corps. Un jeton sans compte dans le service ne peut pas éditer de
rapport — 404, avant tout écrit et tout dépôt de fichier. Le rapport imprime le grade, le nom et le
matricule du signataire au-dessus d'un espace laissé libre pour la signature manuscrite ; l'éditeur et
le signataire étant la même personne, la question de les distinguer ne se pose pas.

Le ticket prévoyait l'inverse — un technicien préparant le document que son chef de section
signerait. Cette possibilité est retirée : dès lors qu'un rapport peut circuler sous forme numérique,
il ne recevra jamais de signature manuscrite, et un document portant le nom, le grade et le matricule
de quelqu'un qui ne l'a ni relu ni validé engage cette personne sans son fait. Le seul garde-fou qui
restait était la lecture attentive de l'annexe C, où la colonne « Auteur » nomme l'éditeur : trop
faible pour ce que le document affirme. Aucune signature électronique, aucun certificat pour autant :
la signature se pose à la main sur le papier quand il y a du papier, et c'est le scellé du fichier,
vérifiable sur la page publique, qui tient lieu de preuve d'intégrité pour l'envoi numérique.

**Ceux qui ont concouru sont déduits du journal, pas saisis.** La liste dédoublonne les auteurs des
actes du dossier sur leur identifiant d'identité, écarte les acteurs automatiques — une tâche
d'ancrage n'a concouru à rien — et se trie par nom de famille. Un auteur que l'annuaire ne connaît
plus garde le nom inscrit dans le maillon, sans grade : c'est le registre qui fait foi, pas
l'annuaire. Et quand le seul auteur est le signataire, la phrase ne s'imprime pas.

## Conséquences

- ✅ Deux exemplaires d'un même dossier se distinguent, dans la liste comme sur le papier, et le pied
  de page porte le numéro sur chaque page.
- ✅ Le rapport nomme un responsable identifiable, et l'écart entre le rédacteur et le signataire
  cesse d'être invisible.
- ✅ La liste des intervenants ne peut pas mentir par omission d'une saisie oubliée : elle se déduit
  de ce qui a été fait.
- ⚠️ Un technicien ne peut plus préparer le rapport que son chef signera : c'est au signataire de
  l'éditer. Le jour où le besoin se reposera, la réponse ne sera pas une désignation à la génération
  mais un acte de signature distinct, posé par le désigné lui-même sur un projet déjà édité.
- ⚠️ Le rapport nommera **moins de monde** qu'un rapport de référence du service : seuls les
  utilisateurs de la plateforme y figurent. Déclarer à la main l'assistant sur les lieux ou l'agent du
  laboratoire photo a été retiré du périmètre (arbitrage MVP du 24 août). Le jour où on en voudra, ce
  sera une table, un écran et un acte, pas un paramètre — aucun crochet n'est prévu.
- ⚠️ Les trois colonnes sont non nulles et sans valeur par défaut : la migration ne s'applique qu'à
  une table `Report` vide. Rien n'est en production, aucune couche de compatibilité n'est écrite.
- ⚠️ Le contenu de l'acte `REPORT_GENERATED` n'a pas changé : le journal n'enregistre pas le numéro
  attribué. Qui voudra retrouver un numéro depuis la seule chaîne devra passer par le `sha256`.

## Alternatives écartées

- **Un compteur par type de document** — donnerait deux `3455-R1`, l'un rapport et l'autre annexe, et
  un numéro ne désignerait plus un document.
- **Composer le numéro à l'affichage depuis `caseNumber` et `sequence`** — le texte imprimé changerait
  le jour où le numéro de dossier est corrigé, et un exemplaire déjà transmis ne se retrouverait plus.
- **Vérifier la disponibilité du numéro avant d'écrire, comme le fait `caseNumber`** — la lecture et
  l'écriture ne sont pas atomiques ; deux générations lancées ensemble passeraient toutes deux le
  contrôle. C'est la contrainte d'unicité qui tranche, et l'adapter Prisma traduit sa violation.
- **Remplacer le rapport précédent à chaque génération** — un document transmis ne se retire pas ; la
  liste conserve chaque édition, téléchargeable.
- **Une table d'intervenants saisie à la main** — dépasse le périmètre décidé et déplace la
  responsabilité de l'exactitude du journal vers une saisie que personne ne relira.
- **Désigner librement le signataire à la génération** — c'est ce que prévoyait le ticket. Écarté : le
  document circule sous forme numérique, donc sans encre, et rien n'empêcherait alors d'éditer une
  pièce au nom d'un collègue qui ne l'a pas vue.
- **Désigner un signataire, puis le rapport imprime qui l'a établi** — documenterait l'écart au lieu de
  l'interdire. Un lecteur pressé signerait quand même la lecture au nom imprimé en bas de page.
