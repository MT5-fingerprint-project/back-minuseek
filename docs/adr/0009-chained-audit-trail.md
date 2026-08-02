# ADR-0009 — Audit trail chaîné par tenant, ancrage RFC 3161, scellés de fichiers

- **Statut** : accepté
- **Date** : 2026-08-02 (brainstorm du 2026-07-04, exploration du code des 2026-07-12 et 2026-08-02)

## Contexte

Minuseek traite des pièces à valeur probante (traces papillaires, empreintes de référence) destinées
à être produites en justice. Il faut pouvoir prouver à un tiers — magistrat, expert contradictoire,
audit ISO 17020/17025 — **qui a fait quoi, quand, sur quelle pièce, et que rien n'a été altéré
depuis**. Aujourd'hui rien de tout cela n'existe : aucune trace des mutations métier, aucun scellé de
fichier, aucun horodatage opposable.

Contraintes qui forcent les décisions :

- **Valeur probante ≠ télémétrie** : un journal applicatif ordinaire (logs Cloud Run, pgAudit) est
  réinscriptible et n'engage que nous. La preuve exige une structure **append-only vérifiable par un
  tiers** et un ancrage temporel **externe**.
- **DB-per-tenant (ADR-0001)** : chaque tenant a sa base ; il n'existe ni `tenantId` discriminant ni
  vue cross-tenant côté métier.
- **État réel du code** : pas d'EventBus CQRS (les handlers orchestrent explicitement), pas de
  pattern transactionnel partagé (un seul `$transaction` local dans `prisma-matching.repository.ts`),
  `@CurrentUser()` consommé uniquement par `recordHit` (acteur nullable). Les uploads passent par le
  back (multer → buffer → GCS) : le back voit les octets à l'ingestion.
- **Cloud Run scale-to-zero** : pas de cron in-process fiable ; toute tâche périodique doit être
  déclenchée de l'extérieur (Cloud Scheduler).

## Décision

### Structure de la preuve

- **Capture explicite depuis les command handlers CQRS.** Pas de middleware HTTP, pas d'EventBus :
  chaque handler instrumenté appelle le port partagé `AuditTrailPort.append(draft)`. La chaîne capture
  les **mutations des éléments du dossier** (dépôts, calques et leurs settings, statuts from→to,
  comparaisons, hits, suppressions) et les **scellés de fichiers**. Les logs de connexion (Keycloak)
  sont de la télémétrie sécurité/ops : **hors chaîne, hors scope v1**.
- **Acteur obligatoire, snapshoté.** `AuditEventDraft` exige `actor: AuditActor` non-nullable — l'oubli
  ne compile pas. L'acteur est un **snapshot** de l'identité au moment de l'acte
  (`sub` + `username` + `displayName`) ; les rapports lisent le snapshot, jamais un lookup Keycloak a
  posteriori. Acteur `SYSTEM(name)` pour saga, cron et appels data.
- **Une hash chain par tenant.** Table `audit_event` dans la base du tenant : `seq` monotone,
  `prevHash`, `hash` = SHA-256 de la sérialisation canonique de l'événement, `caseId`/`traceId`
  indexés. Écriture **synchrone, dans la même transaction Postgres** que la commande, sérialisée par
  `pg_advisory_xact_lock`. Genesis (`seq = 1`, `prevHash = '0' × 64`) écrit par la saga de
  provisioning ; **pas de backfill** (les données actuelles sont du mock).
- **Deux classes d'événements** (`evidenceClass` dès le schéma) : `OBSERVED` (le back est
  contrepartie — valeur probante forte) vs `DECLARED` (auto-rapporté front/mobile — contexte
  méthodologique, étiqueté comme tel). Tout ce qui est forensiquement significatif passe par le back.
- **Ancrage RFC 3161 périodique** (niveau 2) : le hash de tête est horodaté par une TSA externe,
  réponse stockée dans `audit_anchor` (table prévue dès le schéma), ancrage lui-même chaîné
  (`CHAIN_ANCHORED`). Pas d'horodatage par événement (eIDAS niveau 3 écarté sauf demande juriste).
- **Scellés de fichiers** : tout fichier entrant/sortant (image, rendu, PDF) est haché SHA-256 à
  l'ingestion et l'empreinte entre dans la chaîne. L'original devient **immuable** dès son entrée dans
  l'affaire (voir point 6 ci-dessous) ; ce qui précède l'entrée (EXIF, heure de prise de vue) n'est
  que du contexte `DECLARED`.
- **Vérification magistrat par page publique muette** : réponse limitée à
  `{ authentique, scellé le, ancré le }` — le lien hash↔dossier vit uniquement dans l'annexe signée.
  Hash calculé côté navigateur (le fichier ne quitte pas le poste), rate-limiting obligatoire.
- **Deux rapports PDF** : technique narratif (enquêteur) + annexe de traçabilité (chronologie
  exhaustive, hashes, ancres, attestation d'intégrité). La génération est elle-même un événement
  chaîné (`REPORT_GENERATED`, hash du PDF dans la chaîne). Le « comment générer » relève de
  l'ADR-0010.

### Points tranchés ici

1. **Lookup public multi-DB : registre des scellés dans la base admin.** La page publique reçoit un
   sha256 sans savoir dans quelle base tenant chercher. On tient un index
   `SealRegistry { sha256, sealedAt, anchoredAt?, tenantSlug }` dans la base admin, alimenté après
   commit de la transaction tenant (dual-write assumé : le registre est un index de lookup, **la
   preuve reste la chaîne**). Le hash seul ne révèle rien et la base admin est interne. On référence
   le **slug** (identifiant métier, déjà `@unique` dans le registre `Tenant`), pas le nom de base :
   celui-ci est un détail d'infrastructure dérivé (`minuseek_<slug>`), et la résolution
   slug → connexion existe déjà (`TenantConnectionService.getClient(slug)`).
2. **Auth des routes internes (ancrage, vérification) : OIDC Cloud Scheduler → Cloud Run.** Jeton
   d'identité Google d'un service account dédié, validé par le back — même mécanique que
   l'authentification back→data déjà en place. Pas de header secret statique.
3. **Lib RFC 3161 : `asn1js` + `pkijs`.** Maintenues, couvrent la construction du TimeStampReq et le
   parsing/vérification du TimeStampResp.
4. **Sérialisation canonique : implémentation maison « JCS-lite » dans le domaine.** Tri récursif des
   clés, UTF-8, pas d'espaces, nombres sans notation exponentielle, dates ISO-8601 UTC millisecondes,
   `null` explicites pour les champs optionnels absents. Figée par des golden tests (vecteurs
   entrée → hash) qui ne devront **jamais** changer. Le hash utilise `node:crypto` (stdlib).
5. **TSA : `https://freetsa.org/tsr` en dev**, TSA qualifiée eIDAS à sélectionner **avant tout usage
   probant réel** ; `TSA_URL` par variable d'environnement.
6. **Immutabilité de l'original : versioning GCS + garde anti-écrasement.** Versioning activé sur le
   bucket media (toute réécriture/suppression conserve la version d'origine) ; `ifGenerationMatch: 0`
   dans l'adapter de stockage (réécrire une clé existante est une erreur) ; toute suppression métier
   est une commande chaînée (`TRACE_DELETED`/`REFERENCE_PRINT_DELETED`), jamais un hard delete
   silencieux. La retention policy verrouillée est écartée en v1 : en tension avec le crypto-shred
   par tenant (SUP-05).

### Garde-fous contre l'oubli d'instrumentation

La capture explicite a une faiblesse connue : un handler écrit sans appeler `append` produit un
**trou silencieux**. La chaîne reste cryptographiquement intacte et le vérificateur reste vert —
c'est précisément ce qui rend l'oubli dangereux : on perd de la couverture, pas de l'intégrité, et
rien ne le signale. Deux garde-fous rendent l'oubli bruyant plutôt que silencieux :

- **Garde fail-closed dans la transaction** : le `TransactionRunner` compte les opérations mutantes
  de la transaction courante ; si des tables métier ont été écrites sans qu'aucune ligne
  `audit_event` ne l'ait été, la transaction **échoue** (`UnauditedMutationError`). Écrire en base
  sans chaîner devient une erreur d'exécution, pas un oubli.
- **Test de couverture des handlers** : tout `*.handler.ts` de `application/commands/` doit référencer
  le port `AUDIT_TRAIL` ou figurer dans une liste d'exemptions **motivées**. Un handler ajouté sans
  instrumentation fait rougir la CI.

Les deux listes blanches (tables non auditées, handlers exemptés) sont des fichiers explicites, une
ligne par entrée avec son motif : elles constituent la **déclaration relue de ce qui n'est
délibérément pas couvert**, et rétrécissent au fil de l'instrumentation.

### Écart assumé avec la spec produit

La spec (doc 17 AUD-08, doc 18 §8) décrit une chaîne **par dossier** plus une chaîne système par
tenant. On garde la décision verrouillée du 2026-07-04 : **une seule chaîne par tenant**. La timeline
par dossier reste filtrable par `caseId` (indexé), l'ancrage périodique couvre le besoin probant, et
une chaîne unique évite de multiplier les têtes à ancrer et à vérifier. Si un juriste exige la
granularité dossier, ce sera un nouvel ADR (la sérialisation canonique n'en dépend pas).

## Évolution anticipée : upload direct vers GCS par URL présignée

Les URLs signées actuelles sont en lecture seule (`action: 'read'`) et l'upload passe par le back.
Si la contrainte de taille ou de bande passante de Cloud Run impose un jour l'upload **direct-to-GCS**,
le scellé ne peut plus être « le hash du buffer reçu » — plus aucune partie de confiance ne voit les
octets à l'ingestion. Un hash calculé par le navigateur ne vaut pas scellé (même argument que pour le
device mobile : c'est le client qui l'affirme).

La migration se fait alors ainsi, **sans rien changer à la chaîne ni au calcul du hash** :

- l'URL présignée d'écriture est limitée à **une clé d'objet exacte**, TTL court, avec la condition
  `ifGenerationMatch: 0` — l'objet peut être créé une fois, jamais écrasé ;
- l'autorité de « l'upload a eu lieu » est une **notification GCS** (Pub/Sub `OBJECT_FINALIZE`,
  émise par GCP et non par le client), pas un callback du navigateur — celui-ci ne sert qu'au retour
  d'UX ;
- le back **relit l'objet depuis GCS côté serveur** et calcule lui-même le SHA-256, en épinglant la
  **génération** GCS (immuable) et non le chemin ; un hash fourni par le client ne sert au mieux
  qu'à corroborer ;
- la pièce naît en état non scellé et **n'entre pas dans le workflow forensique** (ni comparable, ni
  qualifiable, ni citable dans un rapport) tant que le scellé n'est pas chaîné.

À écrire noir sur blanc si cette bascule a lieu : la chaîne atteste alors « ces octets étaient dans
GCS à T, relus et scellés par le back », pas « ce sont les octets émis par le poste ». C'est la même
doctrine que pour le mobile — la preuve commence là où un tiers de confiance voit les octets.
Décision v1 : **on ne bascule pas** ; l'upload server-side est le design le plus simple qui soit
correct, et la contrainte ne mord pas aux volumétries actuelles.

## Conséquences

- ✅ Chaque mutation probante est attribuable (acteur snapshoté), datée, chaînée et vérifiable par
  recalcul ; l'antériorité est opposable via les ancres TSA.
- ✅ Le domaine audit reste framework-free (canonicalisation et hash en pur TypeScript + stdlib) ;
  les autres BCs ne dépendent que du port partagé.
- ✅ Un magistrat vérifie un document sans compte, sans que le service apprenne quoi que ce soit.
- ⚠️ L'écriture synchrone dans la transaction ajoute un advisory lock par commande instrumentée : les
  écritures d'un même tenant se sérialisent sur la chaîne (acceptable au volume actuel ; à surveiller).
- ⚠️ Le dual-write vers `SealRegistry` (hors transaction tenant) peut laisser un scellé non indexé en
  cas de crash entre les deux écritures — le registre n'est qu'un index de lookup, reconstructible
  depuis les chaînes ; la preuve n'est pas affectée.
- ⚠️ La sérialisation canonique est un engagement de compatibilité **à vie** : tout changement romprait
  la vérifiabilité de l'existant. D'où les golden tests intouchables.
- ⚠️ freetsa.org n'a pas de SLA ni de qualification eIDAS : suffisant pour le dev, bloquant à lever
  avant la prod (choix de TSA qualifiée à acter).
- ⚠️ La validation complète de la chaîne de certificats TSA est best-effort en v1 (signature du token
  et concordance du messageImprint vérifiées ; la chaîne X.509 complète viendra avant la prod).

## Alternatives écartées

- **Middleware HTTP / interceptor global de capture** — capture tout et n'importe quoi (GET compris),
  ne connaît ni l'intention métier ni les valeurs from→to ; impossible d'imposer l'acteur par le
  typage. La capture explicite depuis les handlers est plus verbeuse mais exacte.
- **Introduire l'EventBus CQRS pour l'occasion** — aucun mécanisme d'événements n'existe dans le code ;
  en introduire un pour l'audit ajouterait de l'asynchronisme là où la preuve exige la même
  transaction. Appel explicite du port, point.
- **Événements de domaine portés par les agrégats** (`AggregateRoot` enregistrant ses événements,
  drainés **synchroniquement** par le runner au commit — donc sans EventBus asynchrone) — écarté
  explicitement le 2026-08-02. C'est l'alternative sérieuse au problème de l'oubli : l'événement
  naîtrait dans la méthode métier plutôt que dans un appel séparé à mémoriser. Écartée parce qu'elle
  suppose des agrégats systématiquement riches (les nôtres ne le sont qu'à moitié) et qu'elle ne
  couvre de toute façon pas les actes sans mutation d'agrégat (comparaison exécutée, rapport généré,
  ancrage), qui resteraient des appels explicites — on aurait donc deux mécanismes au lieu d'un. Le
  risque d'oubli est traité par les deux garde-fous ci-dessus.
- **Chaîne par dossier (+ chaîne système)** — cf. écart assumé ci-dessus.
- **Horodatage RFC 3161 par événement (eIDAS niv. 3)** — coût par événement (latence TSA sur chaque
  commande), sans exigence juridique identifiée à ce stade.
- **Fan-out sur toutes les bases tenant pour le lookup public** — O(nombre de tenants) par requête
  anonyme rate-limitée, et donne au endpoint public une visibilité sur toutes les bases ; le registre
  admin est un index minimal, interne.
- **Header secret pour les routes internes** — secret statique à faire tourner, déjà écarté au profit
  d'OIDC pour back→data ; on réutilise le pattern existant.
- **Paquet `canonicalize` (RFC 8785)** — dépendance externe dans le domaine pour un besoin couvert par
  ~50 lignes maison figées par golden tests ; la maîtrise octet à octet prime.
- **Canonicalisation/hash derrière un port (hexagonal)** — un port sert à rendre une implémentation
  substituable derrière une frontière d'I/O ; ici c'est l'inverse qu'on veut : deux implémentations
  divergentes produiraient deux hashes et une chaîne invérifiable. La canonicalisation est une
  fonction **pure et déterministe** (zéro I/O, zéro techno à isoler) : c'est un service du domaine,
  au même titre qu'un invariant, et l'unicité de son implémentation est une exigence probante. Les
  vrais points de variation en ont un, eux (appender Prisma, TSA, stockage).
- **`node-forge` pour RFC 3161** — moins maintenu, parsing TSR moins direct que `asn1js`/`pkijs`.
- **Retention policy GCS verrouillée / event-based holds** — la rétention verrouillée interdirait le
  crypto-shred par tenant (SUP-05) ; le versioning + garde anti-écrasement donne l'immutabilité
  effective sans hypothéquer la suppression réglementaire.
- **Backfill des données existantes** — rien n'est déployé en réel, les données actuelles sont du
  mock ; la chaîne démarre au genesis de chaque tenant re-provisionné.
