# ADR-0010 — Chiffrement des images par le back + scellé SHA-256 vérifié à la réception

- **Statut** : accepté
- **Date** : 2026-08-09
- **Décideurs** : équipe minuseek (ticket A0)

## Contexte

Deux exigences devaient être conciliées :

1. **Chiffrer les images** (`BIO-01`, RGPD Art. 32, Directive Police-Justice (UE) 2016/680) — données biométriques,
   avec une KEK par tenant (déjà annoncé en ADR-0001 §4).
2. **Sceller l'image** (`BIO-29`) : un SHA-256 doit attester que rien n'a été altéré entre la capture et le stockage.

Une piste avait été explorée : **upload direct client → GCS par URL signée d'écriture, avec chiffrement côté client**,
pour que les octets ne transitent plus par le back. Elle est **écartée** (cf. Alternatives écartées) — l'écriture est
l'opération rare, et le coût de complexité (crons de nettoyage et d'audit, CORS `PUT`, cycle de vie `PENDING`,
implémentation cryptographique dupliquée sur trois stacks clientes, validations devenues déclaratives) est sans commune
mesure avec le gain à notre volume d'utilisation.

### État du code au moment de la décision

- **Aucune brique crypto nulle part** : `sha256|createHash|checksum|encrypt` ne renvoie rien sur les quatre repos.
  Le back reçoit et stocke les octets **en clair**.
- L'upload passe par le back : `POST /traces` et `POST /reference-prints` en multipart, buffer mémoire multer, puis
  `storage.save()` (`app/src/biometrics/infrastructure/http/biometrics.controller.ts:120-212`,
  `.../commands/upload-trace/upload-trace.handler.ts:36-58`).
- **La lecture est aujourd'hui hors du back** (ADR-0002 / ADR-0003) : URL signée V4 keyless via `signBlob`
  (`.../infrastructure/storage/gcs-image-storage.adapter.ts:59-77`). Le front affiche `<img src={image.url}>` en tapant
  GCS en direct.
- `data-minuseek` lit GCS **en direct par IAM**, reconstruit la clé par convention et **devine l'extension** par cinq
  essais successifs (`src/repositories/image_repository.py:31-40`) — convention dupliquée avec le back, sans source de
  vérité.
- **Aucune limite de taille** à l'upload : ni `MaxFileSizeValidator`, ni `limits` multer.
- Le multi-tenant existe côté auth (realm Keycloak par tenant, ADR-0001/0005) mais **aucune gestion de clé par tenant**
  n'est en place.

**Point structurant, et non évident** : dès lors que les octets stockés dans GCS sont chiffrés au niveau applicatif,
une URL signée de lecture ne suffit plus à un navigateur — elle renvoie du chiffré. La décision « le back chiffre »
emporte donc mécaniquement une décision sur le **chemin de lecture** : soit le back sert les octets déchiffrés, soit il
ne donne que la clé et le client déchiffre. C'est l'objet du §5.

## Décision

### 1. L'upload reste proxy par le back — pas d'URL signée d'écriture

Les routes `POST /traces` et `POST /reference-prints` conservent leur forme multipart actuelle. Le back reçoit les
octets, les valide, les scelle, les chiffre, puis les écrit dans GCS. **Aucun client n'écrit dans le bucket.**

Ce choix est assumé comme un arbitrage complexité/volume : l'écriture est bien plus rare que la lecture, et
l'ingénierie qu'exigerait l'upload direct (cf. Alternatives écartées) ne se justifie pas à l'échelle visée.

### 2. Chiffrement d'enveloppe dans le back, KEK par tenant dans Cloud KMS

À la réception, le back tire une **DEK éphémère** (256 bits, une par objet), chiffre les octets en **AES-256-GCM**, et
**enveloppe** la DEK avec la **KEK Cloud KMS du tenant** (aligné ADR-0001 §4 et `SUP-05`). Seule la DEK enveloppée est
persistée. GCS ne stocke que du chiffré.

- **AAD KMS** : chaque `encrypt`/`decrypt` KMS porte `additionalAuthenticatedData = "<tenantSlug>|<objectKey>"`. Une
  `wrappedDek` exfiltrée d'une base tenant est inutilisable sur un autre objet ou un autre tenant.
- **La DEK n'est jamais persistée en clair**, nulle part : ni en base, ni en cache, ni en log. Elle n'existe en clair
  qu'en mémoire, le temps d'un chiffrement ou d'un déchiffrement.
- **La `wrappedDek` ne vit pas dans l'objet** mais en base tenant. Conséquence voulue : le bucket, même copié
  intégralement, ne donne rien — le crypto-shred et la révocation portent sur la base et sur KMS.
- **La KEK est référencée indirectement** depuis le registre tenant de la base système (URI de CryptoKey, pas de nom
  construit en dur), pour qu'une bascule vers Cloud EKM — KEK détenue par le service de PTS — reste un changement de
  configuration et non une migration de données.

Ce que ce chiffrement couvre, et qu'il faut savoir énoncer sans l'exagérer : **une fuite du bucket seule est
inexploitable**, GCP ne voit jamais le clair, et le crypto-shred par tenant devient trivial. Le back, lui, détient les
clés et voit les octets : le modèle de menace couvert est la fuite de stockage, **pas** un back compromis.

### 3. Format d'enveloppe — versionné et autoporteur

L'objet GCS est lu par le back (Node) et par `data-minuseek` (Python). Le format est figé ici, et versionné.

```
offset  0    4 o   magic ASCII "MNSK"
offset  4    1 o   version de format (0x01)
offset  5   12 o   IV / nonce AES-GCM (CSPRNG, unique par objet — jamais réutilisé)
offset 17    N o   ciphertext || tag GCM (16 o)
```

- Tag d'authentification de **128 bits**, DEK de 256 bits tirée d'un CSPRNG.
- **Le tag est concaténé à la fin du ciphertext**, ce qui est le comportement natif de WebCrypto
  (`crypto.subtle.decrypt`, côté front) et de `cryptography.hazmat.primitives.ciphers.aead.AESGCM` (Python, côté data).
  Node `crypto` fait exception : il expose le tag séparément via `getAuthTag()` / `setAuthTag()` — **c'est au back,
  qui chiffre, de le concaténer**, pas aux lecteurs de s'adapter. Ce point est la première source de bug
  d'interopérabilité : il est normatif.
- **Aucune AAD au niveau de l'image** — l'AAD est utilisée au niveau KMS (§2).
- Un lecteur qui ne reconnaît pas le magic ou la version **refuse** l'objet plutôt que de tenter une lecture.
- **Surcoût constant de 33 octets** par objet (4 + 1 + 12 + 16), indépendant de la taille de l'image.

Interopérabilité vérifiée avant adoption sur les trois runtimes concernés, avec le même objet : chiffrement
`node:crypto` (back), déchiffrement WebCrypto (front) et `AESGCM` Python 3 / `cryptography` (data), scellé SHA-256
identique de bout en bout. Contrôles complémentaires passés : un bit modifié fait échouer la vérification du tag chez
les deux lecteurs, et l'oubli de la concaténation du tag côté Node échoue bruyamment — il ne produit jamais de clair
silencieusement erroné.

### 4. Le scellé SHA-256 est vérifié par le serveur (`BIO-29`)

Le client calcule le SHA-256 **sur les octets qu'il envoie** et le transmet dans le formulaire multipart. **Le back le
recalcule sur les octets reçus et refuse en cas d'écart** (`422`), avant toute écriture — ni objet, ni ligne en base.

C'est le gain principal de cette décision par rapport à l'upload direct : le scellé est **opposable, pas déclaratif**.
Un scellé que le serveur ne peut pas vérifier ne prouve rien ; ici, il atteste que rien n'a été altéré entre le calcul
côté client et le stockage — TLS couvre le transit, le hash vérifié couvre la chaîne complète.

Le hash ainsi vérifié **est** le scellé qui entre dans la chaîne d'audit : il est persisté sur la `Trace` /
`ReferencePrint` et rejoué à chaque déchiffrement (par le back à la lecture, par data au traitement). Écart au
déchiffrement → `422` + événement d'audit.

Ce que le scellé ne prouve toujours pas : la **provenance**. Un client modifié peut envoyer une image quelconque avec
son hash correct. L'horodatage RFC 3161 et la signature de l'opérateur restent hors scope (module audit).

### 5. La lecture reste directe depuis GCS — le back ne donne que la clé

**Les octets ne repassent pas par le back en lecture.** Le front continue de tirer le fichier de GCS par URL signée
(ADR-0002 / ADR-0003, inchangés), et demande séparément la clé au back :

```
GET /api/traces/:id/decryption-key            → { dek, envelopeVersion, originalSha256, mimeType, expiresAt }
GET /api/reference-prints/:id/decryption-key  → idem
```

- Autorisation scopée **tenant + affaire + rôle** ; `404` cross-tenant, jamais `403` (pas de fuite d'existence, même
  politique que `TraceNotFoundError`, ADR-0007/0008).
- Le back unwrap la DEK via KMS et la renvoie ; **chaque appel est audité** (identité, image, date). C'est, avec son
  pendant interne pour data (§6), le **seul endroit du système où une DEK sort du back** : d'où l'audit systématique et
  le rate-limit.
- Côté front : `fetch(signedUrl)` → parse de l'enveloppe → `crypto.subtle.decrypt` → `createObjectURL(blob)`, avec
  **révocation des object URLs au démontage** (l'éditeur charge de grosses images ; sans révocation, la fuite mémoire
  est certaine). Le champ `url` du DTO reste l'URL signée GCS : le contrat `{ id, path, url }` consommé par
  `mapDtoToBiometricImage` ne casse pas.
- Le scellé et le MIME sont renvoyés avec la clé, pour que le front vérifie l'intégrité et sache quoi construire.

C'est le point d'équilibre de cet ADR : **l'écriture, rare, est centralisée et validée côté serveur ; la lecture,
fréquente, reste hors du back.** Le back ne porte la bande passante image qu'à l'upload.

La cryptographie côté front se limite à du **déchiffrement**, ce qui ne réintroduit pas le problème de confiance qui
justifie de centraliser l'écriture : en lecture le client ne déclare rien, il ne peut déchiffrer que ce que le back a
chiffré, et toute altération est détectée par le tag GCM puis par le scellé. La cryptographie cliente n'est un risque
que quand le serveur doit la **croire** — jamais quand il l'a **produite**.

**ADR-0002 et ADR-0003 restent intégralement en vigueur** : bucket privé, URL signées V4 keyless, GCS partout, pas de
stockage local. `ImageStoragePort.getUrl` sert au front comme à data.

### 6. `data-minuseek` demande la clé lui aussi — authentifié par ID token, autorisé par un grant

**Même principe que pour le front : les octets viennent de GCS, la clé se demande au back.** Le back transmet dans
l'appel `compare` / `evaluate` / `detect-ruler` les **URLs signées de lecture** et un **grant**, mais **aucune DEK** ;
data appelle ensuite l'endpoint de clé.

```
POST /internal/traces/:id/decryption-key      → { dek, envelopeVersion, originalSha256, mimeType, expiresAt }
   Authorization: Bearer <ID token Google, audience = URL du back>
   X-Image-Grant: <grant émis par le back avec le job>
```

Il faut les deux, et ils ne servent pas à la même chose :

- **L'ID token authentifie** : il prouve « je suis le service data » (mécanisme déjà en place en sens inverse pour
  back → data, `data-fingerprint-matcher.adapter.ts`, cf. ADR-0007). Il ne prouve **rien** sur les droits d'accès.
- **Le grant autorise** : c'est un jeton court signé par le back, émis au moment où il dispatche le job, qui porte le
  **tenant**, la **liste des identifiants d'images** du job et une **expiration courte** (~2 min). Sans lui, data
  pourrait demander la clé de n'importe quelle image — il n'a ni notion de tenant ni notion d'affaire (ADR-0007) et ne
  peut donc pas justifier son droit tout seul.

L'effet recherché : **une seule porte de sortie pour les DEK dans tout le système**, avec un seul chemin d'audit et de
rate-limit, au lieu de clés qui circulent dans des corps de requête. Et le blast radius d'un data compromis se limite
aux images de ses jobs en cours, pendant la durée du grant.

`data-minuseek` **perd tout accès IAM à GCS**, la convention de chemin dupliquée et l'heuristique des cinq extensions.
C'est le durcissement identifié en ⚠️ dans l'ADR-0007 (« que le back génère des URLs signées… à traiter dans un ADR
dédié ») ; cet ADR le tranche. Data déchiffre **en mémoire uniquement**.

Détail dans `data-minuseek/docs/adr/0001-lecture-images-chiffrees.md`.

### 7. La validation à l'upload redevient réelle

Le back voit les octets : les contrôles qui seraient devenus déclaratifs avec un upload direct restent **effectifs**,
et sont durcis au passage :

- **Type MIME vérifié sur les octets** (`FileTypeValidator`, `biometrics.controller.ts:52`), pas sur une déclaration
  du client. L'écart mobile heic/heif se résout par un élargissement explicite du contrat back ou une conversion, mais
  dans les deux cas **le back constate** au lieu de croire.
- **Limite de taille** ajoutée (`MaxFileSizeValidator` + `limits` multer) — elle n'existait pas du tout.
- **Conversion `tif → png` conservée dans le back**, avant scellé et chiffrement. Aucun client n'a à convertir.
- **Test millimétré (`BIO-38`)** : reste synchrone à l'upload. Le back a les octets en clair en main, il appelle
  `data detect-ruler` avant d'écrire. Refus → `422`, rien n'est écrit, aucun orphelin possible.

### 8. Persistance

Sur `Trace` **et** sur `ReferencePrint` (migration Prisma sur les bases tenant) :

| Champ | Type | Rôle |
|---|---|---|
| `wrappedDek` | `Bytes` | DEK enveloppée par la KEK du tenant |
| `dekKeyVersion` | `String` | Version de CryptoKey KMS utilisée au wrap (audit et diagnostic) |
| `envelopeVersion` | `Int` | Version du format d'enveloppe (`1`) |
| `originalSha256` | `Char(64)` | Scellé vérifié à la réception (`BIO-29`) |
| `plaintextMimeType` | `String` | MIME réel du clair (l'objet stocké est `application/octet-stream`) |

`TraceStatus` est **inchangé** (`RECEIVED | EXPLOITABLE | NOT_EXPLOITABLE`) : l'upload reste atomique dans une seule
requête, il n'y a pas d'état intermédiaire à modéliser ni d'orphelin à nettoyer.

Clé objet : `media/investigation-case/{caseId}/traces/{traceId}.enc`, `Content-Type: application/octet-stream` —
l'objet stocké est du chiffré, pas une image. Le MIME réel vit en base. Effet de bord voulu : l'extension devient
**fixe**, ce qui supprime mécaniquement l'heuristique des cinq extensions de `image_repository.py:33-40`.

### 9. Rotation, révocation, crypto-shred

- **Rotation** : versions de CryptoKey KMS. `dekKeyVersion` est persistée pour l'audit, mais le `decrypt` symétrique
  KMS résout la version tout seul → les objets anciens restent lisibles après rotation, **aucun job de re-wrap n'est
  nécessaire**.
- **Révocation** : affaire clôturée → l'accès est refusé par l'autorisation sur la route de lecture, sans
  re-chiffrement ni déplacement de données.
- **Crypto-shred** (`SUP-05`) : tenant supprimé → destruction des versions de KEK. Les objets du bucket deviennent
  définitivement inexploitables, même si une copie a fuité auparavant.

## Conséquences

- ✅ **Le scellé est vérifié par le serveur**, donc opposable — c'est le gain net par rapport à l'upload direct, où le
  back n'aurait pu que croire le client sur parole.
- ✅ **Aucune cryptographie d'écriture côté client** : mobile et front ne calculent qu'un SHA-256 à l'envoi. Un seul
  chiffreur (le back), deux lecteurs (front, data).
- ✅ **Les validations à l'upload restent réelles** (MIME sur les octets, taille, conversion `tif → png`, `BIO-38`) au
  lieu de devenir déclaratives.
- ✅ **Une fuite du bucket seule est inexploitable** ; GCP ne voit jamais le clair ; crypto-shred par tenant réel.
- ✅ **Aucune infrastructure nouvelle** : pas de cycle de vie `PENDING`, pas de cron d'orphelins, pas de CORS `PUT`,
  pas de Pub/Sub, pas d'endpoints `upload-intent` / `confirm`.
- ✅ `data-minuseek` **perd son accès IAM GCS** et la convention de chemin dupliquée ; l'heuristique des cinq
  extensions disparaît.
- ✅ **La lecture ne charge pas le back** : les octets continuent d'aller de GCS au navigateur en direct, et le
  chiffré reste cacheable par le navigateur. Le back ne porte la bande passante image qu'à l'upload, l'opération rare.
- ✅ **ADR-0002 / ADR-0003 restent en vigueur sans amendement** : aucune décision de stockage n'est défaite.
- ⚠️ **Mémoire Cloud Run à l'upload** : le buffer multer charge l'image entière en RAM. La limite de taille (§7) est
  donc aussi une protection de disponibilité, pas seulement de sécurité.
- ⚠️ **Le front garde un module cryptographique**, en déchiffrement seulement. Sur une image 500 DPI de plusieurs Mo,
  `crypto.subtle.decrypt` sur le thread principal se voit à l'œil : prévoir un Web Worker si le rendu saccade.
  Mutualiser ce module (`features/shared/crypto`) plutôt que de le dupliquer entre carrousel et canvas Konva.
- ⚠️ **La DEK atterrit dans la mémoire du navigateur.** Une XSS sur le front peut l'exfiltrer — mais la même XSS
  pourrait tout aussi bien lire les images par les routes légitimes : le delta de risque est faible. L'audit de chaque
  demande de clé est ce qui rend l'abus visible.
- ✅ **Une seule porte de sortie pour les DEK**, front et data confondus : un seul point à auditer, à rate-limiter et à
  révoquer, plutôt que des clés qui circulent dans des corps de requête.
- ⚠️ **Un appel KMS `decrypt` par demande de clé.** Négligeable à l'échelle actuelle ; si la latence ou le coût
  deviennent visibles, cacher côté front la DEK pour la durée de la session d'édition plutôt que côté back.
- ⚠️ **Un aller-retour de plus par image côté data** (N+1 par comparaison), et un mécanisme de grant à écrire et à
  tester : émission, signature, expiration, rejeu. C'est le prix de la symétrie. Si la latence se voit sur les gros
  lots, la sortie est un appel **batch** scopé par le grant — une réponse, N clés — sans changer le modèle
  d'autorisation.
- ⚠️ **Le front doit tout de même changer** : `<img src={url}>` devient `fetch` → déchiffrement → `createObjectURL` +
  révocation.
- ⚠️ **Migration** : les images déjà stockées sont en clair et le resteront. Un chantier de re-chiffrement du stock
  existant n'est pas couvert ici.
- ⚠️ **Le back reste capable de déchiffrer** : ce n'est pas du zero-knowledge et l'ADR ne le prétend pas. Le modèle de
  menace couvert est la fuite de stockage, pas un back compromis.

## Alternatives écartées

- **Upload direct client → GCS par URL signée d'écriture, avec chiffrement côté client** — c'était la piste initiale du
  ticket A0. Elle sortait les octets du back, mais à un coût sans rapport avec le gain à notre volume : l'écriture est
  l'opération **rare** (la lecture est le vrai trafic), et elle imposait un cycle de vie `PENDING → RECEIVED` avec
  endpoints `upload-intent` / `confirm`, un cron de nettoyage des orphelins, du CORS `PUT`, des crons d'audit pour
  savoir ce qui atterrit réellement dans le bucket, **trois implémentations cryptographiques clientes** (WebCrypto,
  React Native, plus la lecture Python), et surtout la transformation de toutes les validations serveur en
  **déclarations du client** : MIME, taille et scellé n'auraient plus été vérifiables sur les octets. On accepte de
  perdre le gain de performance, qui est marginal ici, pour garder des contrôles réels et une seule brique crypto.
- **CMEK seul (clé KMS par tenant sur le bucket)** — quelques lignes d'infra, rien d'autre ne change, et le
  crypto-shred `SUP-05` fonctionne. Écarté parce que GCS chiffre **déjà** tout au repos par défaut : CMEK ne change pas
  « c'est chiffré », il change seulement **qui détient la clé**. GCP continue de voir le clair, et `BIO-01` se
  résumerait à un changement de propriétaire de clé. Reste une brique complémentaire possible, pas un substitut.
- **Le back sert les octets déchiffrés en lecture** (route authentifiée `GET /traces/:id/content` qui streame) —
  supprimerait toute cryptographie du navigateur et centraliserait tout dans le back. Écarté : la lecture est
  l'opération **fréquente**, et l'éditeur charge plusieurs images à chaque ouverture d'affaire. Faire transiter cette
  bande passante par Cloud Run à chaque affichage, en perdant au passage le cache navigateur, coûte bien plus que le
  module de déchiffrement que cela économise. Cela aurait de surcroît amendé le chemin de lecture d'ADR-0002/0003.
- **Enveloppe asymétrique par utilisateur (zero-knowledge côté back)** — le back ne pourrait plus déchiffrer.
  Cryptographiquement supérieur, mais un poste perdu rendrait les scellés illisibles, il faudrait re-wrapper à chaque
  ajout d'opérateur sur une affaire, et data ne pourrait plus travailler sans qu'un utilisateur autorisé soit en ligne.
  Sur un dossier judiciaire, perdre la clé revient à perdre la pièce : le risque introduit dépasse le risque couvert.
- **KEK unique + contexte tenant en AAD** — un seul CryptoKey pour tous les tenants. Rejeté : le crypto-shred par
  tenant (`SUP-05`) devient impossible sans casser tous les autres tenants.
- **Le back pousse la DEK à data dans l'appel `compare`** (sans endpoint ni grant) — un aller-retour de moins et rien
  à inventer. Écarté au profit de la symétrie : avec le pull, **une seule porte libère des DEK** dans tout le système,
  donc un seul point à auditer, à rate-limiter et à révoquer. Avec le push, des clés circulent dans les corps de
  requête de chaque comparaison, et un data compromis garde ce qu'on lui a envoyé sans qu'aucune trace ne le dise.
- **ID token seul, sans grant** — data s'authentifierait comme service et le back lui ferait confiance sur l'image
  demandée. Écarté : `data-minuseek` n'a ni notion de tenant ni notion d'affaire (ADR-0007), donc rien ne bornerait ce
  qu'il peut déverrouiller — un bug ou une compromission ouvrirait **toutes** les images de **tous** les tenants. Le
  grant est ce qui transporte l'autorisation que data ne peut pas produire lui-même.
- **Le back envoie les octets déchiffrés à `data-minuseek`** — aucune cryptographie dans data, tout resterait
  centralisé. Écarté : doublerait la bande passante sur chaque comparaison (N+1 images du bucket vers le back, puis du
  back vers data), et ferait du back un goulot sur les gros lots.

## Impact sur les tickets

- **A1** (URL signée d'écriture + `reserve`/`confirm`) et **A6** (nettoyage post-bascule) : **sans objet**, à fermer
  avec le ticket parapluie « Upload de trace via URL signée GCS ».
- **A2** (enveloppe de clés Cloud KMS) : **maintenu** — le wrap se fait dans le handler d'upload ; l'unwrap est servi
  par **un seul use case** exposé par deux routes : `/api/…/decryption-key` (JWT utilisateur) et
  `/internal/…/decryption-key` (ID token + grant). S'y ajoutent l'**émission et la vérification du grant**, et l'audit
  de chaque libération de clé.
- **A3** (mobile) : **fortement réduit** — plus de chiffrement, plus d'upload direct, il ne reste que le calcul du
  SHA-256 avant envoi. Le ticket « 18. Mobile — Chiffrement de l'image avant envoi » se réduit au scellé, et ne dépend
  plus du development build EAS (E4) qu'exigeait l'AES natif.
- **A4** (front) : **réduit** — plus de chiffrement à l'upload (SHA-256 seulement), mais le **déchiffrement à
  l'affichage reste**, avec le module `features/shared/crypto` et le passage de `<img src>` à `fetch` +
  `createObjectURL`.
- **A5** (data) : **maintenu** — URLs signées + grant reçus avec le job, **client HTTP vers l'endpoint de clé du back**
  (ID token + grant), retrait de l'IAM GCS et de `google-cloud-storage`, déchiffrement en mémoire.
- **D1** (`detect-ruler`) : se branche sur l'upload, comme aujourd'hui, et non sur une étape de confirmation.
- Nouveau : **endpoint de clé** — `GET /api/traces/:id/decryption-key` (front, JWT) et
  `POST /internal/traces/:id/decryption-key` (data, ID token + grant), plus les équivalents `reference-prints`.
