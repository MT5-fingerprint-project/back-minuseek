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

## 3. Lire le rapport

```json
{
  "ok": false,
  "eventsChecked": 41,
  "firstBrokenSeq": 42,
  "anchors": { "verified": 0, "failed": 0 }
}
```

- `eventsChecked` compte les maillons validés **avant** la rupture. Ici, les 41 premiers sont intacts.
- `firstBrokenSeq` est le premier maillon fautif. Ce n'est pas forcément le seul, mais c'est celui par
  lequel commencer : la suite du parcours est sans valeur tant qu'il n'est pas expliqué.
- Une chaîne vide rend `ok: true` avec `eventsChecked: 0`. Cela veut dire « rien à contredire », pas
  « laboratoire irréprochable » : un tenant provisionné avant l'écriture du genesis démarre sa chaîne
  en l'air, et ça ressemble à une chaîne saine.

## 4. Ce qu'un verdict vert ne prouve pas

C'est la partie du document à lire avant de citer un `ok: true` devant qui que ce soit.

1. **Une réécriture intégrale passe au vert.** Qui réécrit tous les maillons *et* recalcule toutes les
   empreintes obtient une chaîne parfaitement cohérente. Rien, à l'intérieur de la chaîne, ne la relie
   à un témoin extérieur. Seul l'ancrage horodaté par une autorité externe crée ce lien, et il faut le
   confronter à la chaîne — pas seulement vérifier que l'ancre est bien signée.
2. **Une troncature passe au vert.** Supprimer les *k* derniers maillons laisse une chaîne continue et
   cohérente. Rien dans le parcours ne dit combien de maillons devraient exister ; seule la comparaison
   avec la dernière ancre le dit.
3. **Il ne dit rien des actes qui n'ont jamais été chaînés.** Un verdict vert sur une chaîne à laquelle
   il manque des événements ne signifie pas « rien d'autre n'a été fait ». La liste des familles d'actes
   non encore instrumentées vit dans `UNAUDITED_HANDLERS`, et le rapport technique l'imprime pour cette
   raison exacte.
4. **Il ne date rien.** Les `occurredAt` sont des horodatages serveur, produits par la machine qui
   écrivait. Ils ne valent pas datation opposable : c'est le rôle de l'ancrage RFC 3161.
5. **Il vérifie la base qu'on lui désigne.** Il prouve la cohérence interne de ce qu'il lit, pas que
   cette base soit celle qui a servi au dossier.

## 5. Comment le lancer

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

## 6. Fabriquer une rupture en dev

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
pour simuler une attaque. Restaurer ensuite avec `make migrate-reset && make setup-dev`.

## 7. Coût

Le parcours est un `O(n)` en lecture avec un recalcul SHA-256 par maillon : le hachage est négligeable,
la lecture ne l'est pas. Les lots de 500 maillons bornent la mémoire, pas la durée totale, qui croît
avec la taille de la chaîne du tenant — et le fan-out multiplie cette durée par le nombre de tenants.
À garder en tête avant de brancher la vérification sur un ordonnanceur avec un délai d'attente serré.

## 8. Ce qui manque encore ici

Les deux angles morts des points 1 et 2 ci-dessus se ferment avec l'ancrage RFC 3161 (Lot 3), qui
ajoute au rapport la confrontation ancre ↔ chaîne et la détection de troncature. Tant que ce lot n'est
pas mergé, le champ `anchors` du rapport reste à zéro et **le vérificateur ne prouve que la cohérence
interne de la chaîne**.
