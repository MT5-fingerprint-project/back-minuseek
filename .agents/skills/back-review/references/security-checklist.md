# Security checklist — review

> Conventions de base dans `AGENTS.md`. Ici, les points à vérifier sur le diff. Pas d'auth/JWT/RBAC/Guard dans le code aujourd'hui (`grep -rn "Guard\|JWT\|@UseGuards" app/src` → 0) : ne pas auditer un système d'auth inexistant — si un endpoint sensible apparaît sans protection, le signaler comme **finding**, pas comme écart à une convention existante.

## Sommaire
- Validation à la frontière
- Champs JSON / JSONB
- Upload de fichiers
- Exposition des données biométriques (/media)
- Secrets / config
- Base de données
- API / exposition d'erreurs

## Validation à la frontière
- [ ] `ValidationPipe` global avec `whitelist: true` ET `forbidNonWhitelisted: true` (présent dans `main.ts` — vérifier qu'il n'est pas affaibli).
- [ ] Chaque champ de DTO a un décorateur de type `class-validator` ; optionnels avec `@IsOptional()` ; pas de `any`.
- [ ] `@Type(() => Number)` sur les champs numériques de query (pagination).

## Champs JSON / JSONB (risque récurrent — voir project-risks.md)
- [ ] 🔴 Un champ JSON polymorphe (`settings`) NE doit PAS être validé par `@IsObject()` seul : exiger une validation par forme (discriminated union sur `type`, `@Equals`/`@IsHexColor`/`@IsPositive`/`@ArrayMinSize`) avec `forbidNonWhitelisted`. Gérer le chemin update (pas de champ `type` frère → inférence depuis le contenu).
- [ ] Type domaine canonique (`LayerSettings`) identique dans DTO HTTP + read-model + cast `row.X as ...` Prisma. Jamais `Record<string, unknown>` ni `any`.

## Upload de fichiers
- [ ] `FileInterceptor` + `ParseFilePipe`/`FileTypeValidator` restreignent le MIME (PNG/JPEG/TIFF).
- [ ] 💡 Vérifier la présence d'une **taille max** (`MaxFileSizeValidator`) et idéalement une vérif magic-bytes — le MIME déclaré est falsifiable. Chemins de stockage construits sans interpolation d'entrée utilisateur non validée (pas de path traversal via `caseId`/`id`).

## Exposition des données biométriques (/media) — angle mort à pointer
- [ ] 🔴 `main.ts` sert le dossier `media/` en statique via `app.useStaticAssets(join(process.cwd(), 'media'), { prefix: '/media' })`, **sans aucun contrôle d'accès** (pas de Guard dans le code). Toute personne connaissant ou devinant l'URL télécharge une image d'empreinte (trace / reference-print) — donnée biométrique sensible. Signaler comme finding : exposition publique par URL devinable ; recommander un accès signé/protégé (token court, ou route authentifiée qui streame le fichier) plutôt qu'un montage statique brut. Vérifier aussi que les noms de fichiers ne sont pas des UUID séquentiels/prévisibles.

## Secrets / config
- [ ] `.env` gitignoré ; `.env.example` sans vrais secrets ; pas de secret en clair dans le code, Dockerfile, compose.
- [ ] Données biométriques (empreintes) traitées comme sensibles ; pas de log de fingerprints/tokens/chemins de fichiers biométriques.

## Base de données
- [ ] Pas de SQL brut non paramétré. PK en UUID (`@db.Uuid`). Index unique sur identifiants métier (`caseNumber`…).
- [ ] Référence cross-context par UUID uniquement, **pas** de `@relation` Prisma entre contextes différents.

## API / exposition d'erreurs
- [ ] Pas de stack trace / détail Prisma renvoyé au client. Swagger (`@ApiTags`/`@ApiOperation`/`@ApiResponse`) à jour sur les nouveaux endpoints.
- [ ] CORS non-wildcard en prod ; envisager rate-limiting sur upload (et sur auth si ajoutée).
