# Risques projet — détail historique + greps + sites non conformes

Bugs déjà survenus (refs PR). À traiter en priorité dans toute review touchant les zones concernées.

## Sommaire
- Ordre Prisma sans tie-breaker (#21) + sites encore non conformes
- Fake ≠ adapter Prisma
- Drift de migration (#19)
- Typage JSON divergent (#8bc1f)
- Validation JSON polymorphe (#20)
- Feature sans tests handler (#20)

## Ordre Prisma sans tie-breaker — `fix: layer index saved (#21)`
Quoi : `PrismaLayerReader` triait `orderBy: { zIndex: 'asc' }` sans départage → pour des `zIndex` égaux, Postgres renvoie un ordre non déterministe → empilement des calques perdu au rechargement. Fix : `orderBy: [{ zIndex: 'asc' }, { createdAt: 'asc' }]`.

**Sites encore non conformes (à corriger) :** la règle dépasse le seul `zIndex`. `createdAt` n'est pas unique non plus, donc ces deux readers ont le même risque résiduel :
- `app/src/biometrics/infrastructure/persistence/prisma-trace.reader.ts` → `orderBy: { createdAt: 'desc' }` sans `id`.
- `app/src/biometrics/infrastructure/persistence/prisma-reference-print.reader.ts` → `orderBy: { createdAt: 'desc' }` sans `id`.
Fix attendu : `orderBy: [{ createdAt: 'desc' }, { id: 'asc' }]`. (Idem `prisma-investigation-case.reader.ts` si l'ordre est exposé.) Ne pas les considérer OK sous prétexte qu'ils trient déjà par `createdAt`.

Check reviewer : tout `orderBy` sur colonne non unique (`zIndex`, `status`, `name`, `score`, `createdAt`…) DOIT finir par une clé unique (`id`). 🔴 si l'ordre est métier-significatif.
```bash
grep -rn "orderBy" app/src/*/infrastructure/persistence --include="*.ts"
# Rejeter tout tri dont la dernière clé n'est pas garantie unique.
```

## Fake ≠ adapter Prisma
Quoi : `in-memory-layer.repository.ts` triait seulement par `zIndex` (`.sort((a,b)=>a.zIndex-b.zIndex)`), sans le tie-breaker `createdAt` du reader Prisma. Les specs (`list-layers.handler.spec.ts`) n'utilisaient que des `zIndex` distincts (0/2) → régression d'ordre non détectable.
Check reviewer : le fake doit reproduire le contrat d'ordre/shape de l'adapter réel, ET un test doit couvrir le cas limite (valeurs de tri ÉGALES). ⚠️ Toute divergence fake/adapter = fausse confiance des tests.

## Drift de migration Prisma — `fix: modified migration drift db (#19)`
Quoi : migrations générées sur l'hôte (`cd app && npx prisma`) contre un état DB différent de Docker ; `app/prisma` non bind-monté ; aucun garde-fou CI. Fix : job CI `migrations` (`prisma migrate deploy` + `prisma migrate diff --from-config-datasource --to-schema prisma --exit-code`), exécution dans conteneur jetable, bind-mount `app/prisma`, `migrate deploy` au boot.
Check reviewer (🔴) :
- Toute modif `app/prisma/models/*.prisma` ⇒ dossier `app/prisma/migrations/<timestamp>_*/migration.sql` committé dans la MÊME PR.
- Commandes Prisma jamais sur l'hôte ; passer par le conteneur (`compose run --rm app pnpm prisma ...`).
- Présence du job CI `prisma migrate diff --exit-code`.
- Timestamp manuel ⇒ respecte l'ordre chronologique des dépendances de schéma.
```bash
git diff --name-only | grep -E 'app/prisma/models/.*\.prisma' && \
  echo 'modèle modifié → vérifier la migration committée'
ls app/prisma/migrations
```

## Typage JSON divergent — `fix: layer settings type (#8bc1f)`
Quoi : `settings` typé `Record<string, unknown>` à plusieurs endroits (DTO create/update + casts `row.settings as ...` dans reader et repository) alors que le domaine définit `LayerSettings`. Le JSONB pouvait transporter n'importe quelle forme sans erreur de compilation. Fix : réalignement sur `LayerSettings` importé du domaine.
Check reviewer : un champ JSON doit utiliser le type domaine canonique, identique dans DTO HTTP + read-model + cast `row.X as ...` (sites synchrones). Jamais `Record<string, unknown>`/`any`.
```bash
grep -rn "as Record<string\|Record<string, unknown>" app/src --include="*.ts"
```

## Validation JSON polymorphe — `feat: save position point appart calque (#20)`
Quoi : `settings` validé seulement par `@IsObject()` → cercle sans `x`, couleur non hex, `type` inconnu, champ en trop, crayon < 2 points… tout passait et était persisté en JSONB. Fix : `@IsLayerSettings` (discriminated union) + DTO par forme (circle/circleArrow/pencil/filter) avec `@Equals('type')`, `@IsHexColor`, `@IsPositive`, `@ArrayMinSize(4)`, `whitelist` + `forbidNonWhitelisted`.
Check reviewer (🔴) : champ JSON polymorphe ⇒ validation par forme appliquée avec `forbidNonWhitelisted` ; chemin update (pas de `type` frère) ⇒ type inféré du contenu (`pickSettingsDto`).

## Feature sans tests handler / fake — `(#20)`
Quoi : create/update/delete/list-layers ont été livrés et les `*.handler.spec.ts` + `in-memory-layer.repository.ts` n'ont été ajoutés qu'ensuite (commit de rattrapage).
**La règle de fond (handler testé via `InMemory*Repository`) est dans `AGENTS.md`** (section Tests + recette étape 7) — ne pas la recopier. Delta projet : exiger les tests + fake dans la **MÊME PR** que le handler. Sans eux = renvoyer la PR, ne pas merger sur promesse. ⚠️
```bash
# Pour chaque handler du diff, vérifier un .spec.ts frère
git diff --name-only | grep '\.handler\.ts$' | while read f; do
  s="${f%.ts}.spec.ts"; [ -f "$s" ] || echo "MANQUE test: $s"; done
```
