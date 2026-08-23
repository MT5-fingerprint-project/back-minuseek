# Vérification de la chaîne d'audit

> Compagnon d'[ADR-0009 — Audit trail chaîné par tenant, ancrage RFC 3161, scellés de fichiers](adr/0009-chained-audit-trail.md).
> L'ADR fixe **la décision** : une chaîne de hachage par tenant, écrite dans la transaction de la commande. Ce document dit **ce que le vérificateur contrôle**, ce qu'un verdict vert prouve — et surtout ce qu'il ne prouve pas.

## 1. Pourquoi un vérificateur

La chaîne est écrite maillon par maillon, chacun portant l'empreinte du précédent. C'est ce qui rend une
retouche détectable, mais **la détection n'est pas automatique** : personne ne recalcule les empreintes
au fil de l'eau. Il faut un outil qui relise la chaîne entière et refasse le calcul.

Aucun test unitaire ne peut le remplacer. Les tests contraignent le code qui écrit ; le vérificateur
contrôle les données réellement en base, y compris celles écrites par une version antérieure du code,
ou modifiées en dehors de l'application.

## 2. Ce qu'il contrôle, maillon par maillon

Le vérificateur part du genesis (`seq = 1`, `prevHash` = 64 zéros) et avance par lots de 500 maillons,
dans l'ordre croissant des `seq`. Sur chaque maillon, trois contrôles, et un maillon qui échoue arrête
le parcours.

| Contrôle | Ce qu'il attrape |
|---|---|
| `seq` est exactement celui attendu | un maillon supprimé (trou), un maillon inséré, une chaîne qui ne démarre pas au genesis |
| `prevHash` est l'empreinte du maillon précédent | un réordonnancement, une greffe de maillons venus d'ailleurs |
| l'empreinte recalculée depuis le contenu du maillon est celle qui est stockée | toute retouche du payload, de l'acteur, de la date, du dossier ou de la trace visés |

Le recalcul rejoue la **sérialisation canonique** utilisée à l'écriture : même ordre de clés, même
représentation des nombres et des dates. Un maillon dont l'acteur ou la date ne se relisent plus sort
en **rupture, pas en exception** — un vérificateur doit survivre à la corruption qu'il cherche, sinon
une base abîmée le fait tomber au lieu de le faire parler.

## 3. Ce qu'il contrôle, ancre par ancre

Une ancre est un horodatage RFC 3161 obtenu auprès d'une autorité externe sur l'empreinte de tête de la
chaîne, à un instant donné. Le vérificateur pose trois questions par ancre, et les deux dernières sont
celles qui comptent.

| Contrôle | Ce qu'il attrape |
|---|---|
| le jeton horodaté est signé, et son empreinte est celle de la sérialisation canonique du maillon ancré | un jeton fabriqué, un jeton valide mais rattaché à autre chose |
| le maillon désigné par l'ancre existe encore et porte bien l'empreinte ancrée | une chaîne intégralement réécrite : ses empreintes sont cohérentes entre elles, mais plus aucune ne correspond à ce qu'un tiers a horodaté |
| la chaîne atteint au moins le maillon de la dernière ancre | une troncature : supprimer les *k* derniers maillons laisse une chaîne continue, seule cette comparaison le voit |

La chaîne de certificats X.509 du jeton n'est pas remontée jusqu'à une racine de confiance (best-effort
v1, cf. ADR-0009) : ce contrôle prouve le lien entre le jeton et la donnée, pas la qualification de
l'autorité. En production, c'est le choix d'une TSA qualifiée eIDAS qui porte cette valeur, pas le code.

## 4. Lire le rapport

```json
{
  "ok": false,
  "eventsChecked": 41,
  "firstBrokenSeq": 42,
  "anchors": { "verified": 3, "failed": 1 },
  "truncatedBelowSeq": 58
}
```

- `eventsChecked` compte les maillons validés **avant** la rupture. Ici, les 41 premiers sont intacts.
- `firstBrokenSeq` est le premier maillon fautif. Ce n'est pas forcément le seul, mais c'est celui par
  lequel commencer : la suite du parcours est sans valeur tant qu'il n'est pas expliqué.
- `anchors` compte les ancres validées et celles en échec. **Une seule ancre en échec vaut
  `ok: false`**, au même titre qu'une empreinte rompue : une ancre qui ne se rattache plus à la chaîne
  est le signe d'une réécriture, pas un détail.
- `truncatedBelowSeq` n'apparaît que si la chaîne s'arrête sous la dernière ancre — elle a été tronquée
  après avoir été horodatée. C'est aussi un `ok: false`.
- Une chaîne vide rend `ok: true` avec `eventsChecked: 0`. Cela veut dire « rien à contredire », pas
  « laboratoire irréprochable » : un tenant provisionné avant l'écriture du genesis démarre sa chaîne
  en l'air, et ça ressemble à une chaîne saine.

## 5. Ce qu'un verdict vert ne prouve pas

C'est la partie du document à lire avant de citer un `ok: true` devant qui que ce soit.

1. **Rien n'est prouvé avant la première ancre.** La confrontation aux ancres ferme le trou de la
   réécriture intégrale et celui de la troncature — mais seulement sur la portion de chaîne qu'une ancre
   couvre. Tout ce qui précède la première ancre garde une preuve d'existence *sans datation* : la
   réécriture y reste indétectable. Un tenant jamais ancré est dans ce cas pour la totalité de sa
   chaîne, et le rapport le dit par `anchors: { verified: 0, failed: 0 }`.
2. **Une ancre ne date pas chaque maillon.** Elle prouve que la chaîne existait dans cet état à
   l'instant T. Elle ne dit pas quand chaque maillon a été écrit : les `occurredAt` restent des
   horodatages serveur.
3. **Il ne dit rien des actes qui n'ont jamais été chaînés.** Un verdict vert sur une chaîne à laquelle
   il manque des événements ne signifie pas « rien d'autre n'a été fait ».
4. **Il vérifie la base qu'on lui désigne.** Il prouve la cohérence interne de ce qu'il lit, pas que
   cette base soit celle qui a servi au dossier.

## 6. Comment le lancer

```bash
make audit-verify           # tous les tenants du registre
make audit-verify TENANT=demo
```

La cible sort en **code 1** dès qu'une chaîne est rompue, pour être utilisable telle quelle par la CI
ou par un ordonnanceur. Le fan-out est séquentiel : un tenant injoignable finit en `error` dans le
récapitulatif sans priver les suivants de leur vérification.

La même vérification est exposée en HTTP, `GET /api/internal/audit/verify` (paramètre `?tenant=`
optionnel), réservée au realm système : cette protection fait l'objet d'un ADR dédié, livré dans une
autre PR.

L'ancrage se déclenche de la même façon, et c'est lui qui alimente les contrôles de la section 3 :

```bash
make audit-anchor              # ancre la tête de chaîne de chaque tenant
make audit-anchor TENANT=demo
```

Un second appel immédiat ne fait rien : on n'ancre pas une chaîne dont rien n'a bougé depuis la
dernière ancre. En production, c'est un ordonnanceur qui appellera la route équivalente.

## 7. Fabriquer une rupture en dev

Un vérificateur qu'on n'a jamais vu échouer ne vaut rien. En développement :

```bash
make db
```

```sql
ALTER TABLE "AuditEvent" DISABLE TRIGGER audit_event_append_only;
UPDATE "AuditEvent" SET payload = '{}' WHERE seq = 2;
ALTER TABLE "AuditEvent" ENABLE TRIGGER audit_event_append_only;
```

Relancer `make audit-verify` : le rapport doit pointer `firstBrokenSeq: 2`. Le trigger append-only
interdit normalement toute modification — c'est bien pour ça qu'il faut le désactiver explicitement
pour simuler une attaque.

Pour voir la détection de troncature, il faut d'abord une ancre : `make audit-anchor`, puis supprimer
les derniers maillons (même désactivation du trigger) et relancer la vérification — le rapport doit
rendre `truncatedBelowSeq` avec le numéro du maillon ancré.

Restaurer ensuite avec `make migrate-reset && make setup-dev`.

## 8. Coût

Le parcours est un `O(n)` en lecture avec un recalcul SHA-256 par maillon : le hachage est négligeable,
la lecture ne l'est pas. Les lots de 500 maillons bornent la mémoire, pas la durée totale, qui croît
avec la taille de la chaîne du tenant — et le fan-out multiplie cette durée par le nombre de tenants.
À garder en tête avant de brancher la vérification sur un ordonnanceur avec un délai d'attente serré.

## 9. Ce qui manque encore

Un tiers ne peut pas encore refaire ce calcul **hors de la plateforme** : il faudrait lui livrer les
maillons en JSON canonique, les jetons horodatés et la spécification de canonicalisation, avec un
vérificateur autonome. Tant que cet export n'existe pas, la vérification reste « le serveur qui atteste
le serveur » — ce qui suffit en interne, pas devant un expert contradictoire.
