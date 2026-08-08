# ADR-0009 — Chiffrement des images côté client + upload direct GCS

- **Statut** : accepté
- **Date** : 2026-08-08
- **Décideurs** : fondateur + agent (ticket A0, bloquant pour A1→A6, le parapluie « Upload de trace via URL signée GCS », le ticket 18 mobile et D1)

## Contexte

Deux exigences du produit s'opposent aujourd'hui :

1. **Les images ne doivent plus passer par le back.** Upload direct client → GCS via URL signée : le back n'a pas à
   bufferiser des données biométriques en mémoire, ni à les voir passer dans ses logs, ni à porter la bande passante.
2. **Les images doivent être chiffrées à l'envoi** (`BIO-01`, RGPD Art. 32, Directive Police-Justice (UE) 2016/680).

Si le client chiffre et que le back ne voit plus les octets, il faut trancher **qui détient la clé et qui déchiffre** —
car deux consommateurs ont besoin du clair :

- **`data-minuseek`** fait tourner SourceAFIS dans une JVM embarquée (`src/services/sourceafis.py:34-36` :
  `FingerprintTemplate(FingerprintImage(image_bytes))`). Les templates de minuties se calculent sur les **pixels** ;
  `compare`, et demain `evaluate` et `detect-ruler`, sont impossibles sur du chiffré. Tant que la comparaison tourne
  côté serveur, data voit le clair — il n'y a pas de contournement.
- **Le front** doit afficher l'image dans le carrousel et dans le canvas Konva, avec les filtres et les calques.

### État du code au moment de la décision

- **Aucune brique crypto nulle part** : `sha256|createHash|checksum|encrypt` ne renvoie rien sur les quatre repos.
  Le back reçoit et stocke les octets **en clair**.
- L'upload passe par le back : `POST /traces` et `POST /reference-prints` en multipart, buffer mémoire multer, puis
  `storage.save()` (`app/src/biometrics/infrastructure/http/biometrics.controller.ts:120-212`,
  `.../commands/upload-trace/upload-trace.handler.ts:36-58`).
- **La lecture est déjà hors du back** (ADR-0002 / ADR-0003) : URL signée V4 keyless via `signBlob` de l'identité
  runtime (`.../infrastructure/storage/gcs-image-storage.adapter.ts:59-77`), avec cache mémoire. Le front tape déjà GCS
  en direct.
- `data-minuseek` lit GCS **en direct par IAM**, reconstruit la clé par convention et **devine l'extension** par cinq
  essais successifs (`src/repositories/image_repository.py:31-40`). La convention de chemin est dupliquée entre le back
  et data, sans source de vérité.
- `TraceStatus` ne connaît que `RECEIVED | EXPLOITABLE | NOT_EXPLOITABLE` (`trace-status.vo.ts`) ; le modèle Prisma
  `Trace` n'a ni champ cryptographique ni scellé.
- **Aucune limite de taille** à l'upload : ni `MaxFileSizeValidator`, ni `limits` multer.
- Le multi-tenant existe côté auth (realm Keycloak par tenant, ADR-0001/0005) mais **aucune gestion de clé par tenant**
  n'est en place.

## Décision

### 1. Chiffrement d'enveloppe, KEK par tenant dans Cloud KMS — et le back est dépositaire

Le client chiffre l'image avec une **DEK éphémère** (une par objet) ; le back **enveloppe** cette DEK avec la
**KEK Cloud KMS du tenant** (aligné ADR-0001 §4 et `SUP-05`) et ne persiste jamais que la version enveloppée.

```
client ──chiffre (DEK éphémère AES-256-GCM)──> GCS (objet chiffré, URL signée d'écriture)
   │ DEK ──> back ──> Cloud KMS (KEK du tenant) ──> wrappedDek persistée en base tenant

data  <──URL signée + DEK── back  ;  data  <──octets chiffrés── GCS  →  déchiffre en mémoire
front <──DEK── back              ;  front <──octets chiffrés── GCS  →  WebCrypto → <img>
```

Le back ne manipule que des **clés** et des **URLs signées**, jamais d'octets d'image.

**Ce n'est pas du zero-knowledge, et l'ADR l'assume.** Le back détient les KEK : il peut techniquement déchiffrer un
objet du bucket. Deux contraintes produit l'imposent, et aucune n'est négociable :

- **Plusieurs opérateurs, plusieurs postes.** L'opérateur B doit pouvoir rouvrir demain, depuis un autre poste, une
  trace uploadée par A. La DEK doit donc être récupérable côté serveur.
- **Recouvrabilité légale.** Sur un dossier judiciaire, perdre la clé, c'est perdre la pièce. Un modèle où un poste
  perdu détruit des scellés est un risque *pire* que celui qu'on couvre.

Ce que le chiffrement client apporte **réellement**, et qu'il faut savoir défendre sans exagérer :

- les octets ne transitent plus par le back — ni logs, ni RAM Cloud Run, ni buffer multer ;
- une **fuite du bucket seule est inexploitable** (le bucket ne contient aucune clé) ;
- le **crypto-shred par tenant** (`SUP-05`) devient trivial : détruire les versions de KEK suffit ;
- l'accès en clair devient un **événement discret, autorisé et audité**, au lieu d'être l'état permanent des données.

**Durcissements — ils font partie de la décision, pas du commentaire :**

- **AAD KMS** : chaque `encrypt`/`decrypt` KMS porte `additionalAuthenticatedData = "<tenantSlug>|<objectKey>"`. Une
  `wrappedDek` exfiltrée d'une base tenant est inutilisable sur un autre objet ou un autre tenant.
- **Le SA runtime du back n'a pas `storage.objects.get`.** Il a `storage.objects.create`, `storage.objects.delete` et
  `iam.serviceAccounts.signBlob` : il écrit, supprime et signe — il ne lit pas. Pour obtenir les octets d'un objet, il
  doit se signer une URL à lui-même, et **chaque `signBlob` est journalisé dans Cloud Audit Logs**. Un déchiffrement
  par le back n'est donc jamais silencieux.
- **La DEK n'est jamais persistée en clair**, nulle part : ni en base, ni en cache, ni en log. Elle n'existe en clair
  qu'en mémoire, le temps d'un wrap ou d'un unwrap.
- **Chaque unwrap est audité** : identité appelante, image concernée, date. À brancher sur le module d'audit.
- **La KEK est référencée indirectement** depuis le registre tenant de la base système (URI de CryptoKey, pas de nom
  construit en dur), pour qu'une bascule vers **Cloud EKM** — KEK détenue par le service de PTS, avec kill switch
  unilatéral — soit un changement de configuration et non une migration de données.

### 2. Format d'enveloppe — versionné et autoporteur

L'objet GCS est le **seul artefact partagé** par le mobile, le front et data. Il doit être lisible par les trois sans
qu'ils aient besoin de se reparler. Le format est donc figé ici, et versionné.

```
offset  0    4 o   magic ASCII "MNSK"
offset  4    1 o   version de format (0x01)
offset  5   12 o   IV / nonce AES-GCM (CSPRNG, unique par objet — jamais réutilisé)
offset 17    N o   ciphertext || tag GCM (16 o)
```

- **Algorithme** : AES-256-GCM, tag d'authentification de **128 bits**, DEK de 256 bits tirée d'un CSPRNG.
- **Le tag est concaténé à la fin du ciphertext.** C'est le comportement natif de WebCrypto (`crypto.subtle.encrypt`)
  et de `cryptography.hazmat.primitives.ciphers.aead.AESGCM` (Python). Node `crypto` fait exception : il expose le tag
  séparément via `getAuthTag()` / `setAuthTag()` — **c'est au back Node de découper les 16 derniers octets**, pas aux
  clients de s'adapter. Ce point est la première source de bug d'interopérabilité : il est normatif.
- **Aucune AAD au niveau de l'image.** L'AAD est utilisée au niveau KMS (cf. §1), pas au niveau du chiffrement de la
  donnée : le client n'a pas à connaître le slug du tenant pour chiffrer.
- Un lecteur qui ne reconnaît pas le magic ou la version **refuse** l'objet plutôt que de tenter une lecture.
- **Surcoût constant de 33 octets** par objet (4 + 1 + 12 + 16), indépendant de la taille de l'image.

Interopérabilité vérifiée avant adoption sur les trois runtimes cibles, avec le même objet : chiffrement WebCrypto
(front), déchiffrement `AESGCM` Python 3 / `cryptography` (data) et `node:crypto` (back), scellé SHA-256 identique de
bout en bout. Contrôles complémentaires passés : un bit modifié déclenche `InvalidTag`, et l'oubli du découpage du tag
côté Node échoue bruyamment — il ne produit jamais de clair silencieusement erroné.

La **`wrappedDek` ne vit pas dans l'objet** mais en base tenant. Conséquence voulue : le crypto-shred et la révocation
portent sur la base et sur KMS — le bucket, même copié intégralement, ne donne rien.

### 3. Persistance

Sur `Trace` **et** sur `ReferencePrint` (migration Prisma sur les bases tenant) :

| Champ | Type | Rôle |
|---|---|---|
| `wrappedDek` | `Bytes` | DEK enveloppée par la KEK du tenant |
| `dekKeyVersion` | `String` | Version de CryptoKey KMS utilisée au wrap (audit et diagnostic) |
| `envelopeVersion` | `Int` | Version du format d'enveloppe (`1`) |
| `originalSha256` | `Char(64)` | Scellé calculé par le client **avant** chiffrement (`BIO-29`) |
| `plaintextMimeType` | `String` | MIME réel du clair (l'objet stocké, lui, est `application/octet-stream`) |
| `byteSize` | `Int` | Taille du chiffré constatée à la confirmation |

`TraceStatus` gagne **`PENDING`**, état initial d'une trace dont les octets ne sont pas encore confirmés.
Transitions : `PENDING → RECEIVED → EXPLOITABLE | NOT_EXPLOITABLE`. Rien d'exploitable ne sort d'une trace `PENDING`.

### 4. Cycle de vie de l'upload — trois temps

Le back **valide et signe**, il ne voit jamais les octets.

**a. `POST /api/traces/upload-intent`**

```jsonc
// requête
{ "caseId": "uuid", "mimeType": "image/png", "byteSize": 4194304,
  "originalSha256": "<hex 64>", "dek": "<base64 32 o>" }
// réponse 201
{ "id": "uuid", "objectKey": "media/investigation-case/<caseId>/traces/<id>.enc",
  "uploadUrl": "https://storage.googleapis.com/...", "expiresAt": "<iso8601>",
  "requiredHeaders": { "Content-Type": "application/octet-stream" },
  "maxBytes": 52428800 }
```

- L'affaire est validée **avant toute signature** (`Trace.assertCaseCanReceiveTrace`, ADR-0008) : affaire inexistante
  ou hors `OPEN`/`IN_PROGRESS` → `404`, sans rien écrire et sans signer.
- L'**id et la clé objet sont générés côté serveur**, jamais dérivés d'une entrée client — c'est ce qui interdit le
  path traversal et garantit l'isolation tenant.
- La DEK arrive **en clair dans le corps, sous TLS**, et est enveloppée immédiatement par KMS. C'est cohérent avec le
  modèle dépositaire : le back peut de toute façon unwrapper. Faire chiffrer la DEK par le client avec une clé publique
  KMS ajouterait de la cryptographie asymétrique dans trois clients sans rien changer au modèle de menace.
- La `Trace` est persistée en `PENDING`.

**b. `PUT` direct client → GCS**, sur l'URL signée, avec le `Content-Type` exact retourné.

**c. `POST /api/traces/:id/confirm`** — **idempotent** (rejouer sur une trace déjà `RECEIVED` renvoie le même `200`).

Le back vérifie ce qu'il *peut* vérifier, c'est-à-dire les métadonnées GCS du **chiffré** : existence de l'objet,
`size` dans les bornes, `contentType` attendu, `crc32c` enregistré. Puis il déclenche la validation `BIO-38` (§7).
Succès → `PENDING → RECEIVED`.

**Clé objet** : `media/investigation-case/{caseId}/traces/{traceId}.enc`, `Content-Type: application/octet-stream`.
L'objet stocké est du chiffré, **pas une image** : lui donner un `image/png` serait un mensonge et casserait tout
consommateur naïf. Le MIME réel et le nom d'origine vivent en base. Effet de bord voulu : l'extension devient **fixe**,
ce qui supprime mécaniquement l'heuristique des cinq extensions de `image_repository.py:33-40`.

Les `reference-prints` suivent exactement le même flux.

### 5. Accès au clair — deux chemins, deux mécanismes d'autorisation

**Le front demande la clé** : `POST /api/traces/:id/decryption-key`

```jsonc
// réponse 200
{ "dek": "<base64>", "envelopeVersion": 1, "expiresAt": "<iso8601>" }
```

JWT utilisateur, autorisation scopée **tenant + affaire + rôle**. Un appelant d'un autre tenant reçoit `404`, jamais
`403` : pas de fuite d'existence (même politique que `TraceNotFoundError`, ADR-0007/0008). Chaque appel est audité.

**Data ne demande rien — le back pousse.** Il n'y a **pas** d'endpoint d'unwrap pour `data-minuseek`. Le back, qui a
déjà validé l'appartenance de la trace et des empreintes à l'affaire (ADR-0007), envoie dans l'appel `compare` /
`evaluate` / `detect-ruler` : **URL signée de lecture + DEK + version d'enveloppe**, par image.

C'est la seule option cohérente avec ADR-0007 : data n'a **ni auth, ni notion de tenant, ni notion d'affaire**, il ne
peut donc pas s'autoriser lui-même sur un endpoint d'unwrap. L'alternative — faire porter par le back un *grant token*
jusqu'à data pour que data le rejoue — ajoute un jeton, un aller-retour et une surface d'attaque, pour arriver au même
résultat.

Nouveau contrat `POST /data/api/compare` :

```jsonc
{ "trace": { "url": "<signed read url>", "dek": "<base64>", "envelopeVersion": 1 },
  "referencePrints": [ { "id": "uuid", "url": "...", "dek": "...", "envelopeVersion": 1 } ],
  "top": 3 }
```

Plus de `case_id` / `trace_id`, plus de convention de chemin, plus de devinette d'extension. **`data-minuseek` perd
tout accès IAM à GCS** et la dépendance `google-cloud-storage` — c'est exactement le durcissement identifié en ⚠️ dans
l'ADR-0007 (« que le back génère des URLs signées… à traiter dans un ADR dédié ») ; cet ADR le tranche. Data déchiffre
**en mémoire uniquement** : jamais de persistance en clair, ni sur disque ni en cache. Échec de vérification du tag GCM
→ erreur typée → `422`, sans détail cryptographique dans la réponse.

### 6. Scellé SHA-256 (`BIO-29`) — ce qu'il prouve, et ce qu'il ne prouve pas

Le **client** calcule le SHA-256 sur les octets **avant chiffrement** et le transmet à l'intention ; le back le
persiste. Le back **ne peut pas le vérifier** : il ne voit jamais le clair.

Il faut donc être exact sur sa portée : le scellé atteste la **non-altération après capture**, il **ne prouve pas la
provenance** — un client modifié peut déclarer n'importe quel hash pour n'importe quelle image. Ce que le scellé
garantit réellement : si le hash recalculé au déchiffrement correspond, l'image affichée à l'écran est bit à bit celle
que le client a chiffrée ce jour-là.

Vérification : **à chaque déchiffrement**, par data et par le front. Écart → `422` côté data, refus d'affichage côté
front, et **événement d'audit** dans les deux cas. Le tag GCM couvre déjà l'intégrité du chiffré au repos ; le scellé
couvre la chaîne complète capture → affichage.

L'horodatage RFC 3161 et la signature de l'opérateur restent **hors scope** (module audit).

### 7. Validation du test millimétré (`BIO-38`) — synchrone dans `confirm`

Elle ne peut plus être synchrone à l'upload puisque le back ne voit plus les octets. Elle est déplacée dans
**`confirm`** : le back appelle `data detect-ruler` avec l'URL signée et la DEK, data déchiffre en mémoire et répond.
Refus → **l'objet GCS est supprimé, la `Trace` `PENDING` est supprimée**, `422` au client.

Le client ne peut pas appeler data lui-même : ADR-0007 pose que data n'est **jamais** joignable depuis un navigateur.
Coût assumé : `confirm` devient dépendant de la disponibilité de data.

### 8. URL signée d'écriture, taille, CORS, orphelins

- **TTL 300 s** en écriture, contre 900 s en lecture : une URL signée est une **capacité bearer**, elle doit vivre le
  temps d'un upload, pas d'une session.
- `getSignedUrl({ version: 'v4', action: 'write' })` avec **`Content-Type: application/octet-stream` bindé** dans la
  signature — l'URL ne permet d'écrire qu'un objet, à une clé exacte, d'un type exact.
- **Taille** : bornée à `confirm`, sur les métadonnées GCS réelles → hors bornes = objet supprimé + `422`. Limite
  assumée et écrite : **GCS accepte d'abord, on nettoie ensuite**. Le porteur d'une URL peut écrire un gros objet, mais
  seulement à une clé précise, pendant 5 minutes, et il sera supprimé au refus de confirmation ou par le nettoyage des
  orphelins.
- **CORS du bucket** : ajouter `PUT` aux méthodes autorisées et `Content-Type` aux en-têtes autorisés, sur les origines
  front dev et prod (le CORS `http://localhost:5173` existe déjà pour la lecture, cf. ADR-0003). Le mobile natif n'est
  pas soumis au CORS — il envoie du binaire via `expo-file-system.uploadAsync`, **pas** de `FormData`.
- **Orphelins** : job planifié côté back — toute `Trace` / `ReferencePrint` `PENDING` de plus de **24 h** entraîne la
  suppression de l'objet GCS et de la ligne. Une règle de cycle de vie du bucket ne peut pas servir ici : elle ne
  connaît pas le statut applicatif.

### 9. Conversion `tif → png`, rotation, révocation

- **La conversion `tif → png` passe côté client**, avant le hash et avant le chiffrement : le back ne peut plus
  convertir quoi que ce soit. Le scellé porte donc sur les octets convertis — c'est-à-dire sur **ce qui est réellement
  stocké**, ce qui est le comportement souhaitable.
- La **liste blanche de MIME devient déclarative** : elle se déplace de `FileTypeValidator`
  (`biometrics.controller.ts:52`) vers le DTO d'intention, et le back ne peut plus la vérifier sur les octets. Assumé.
  L'écart mobile heic/heif (accepté par le picker, refusé par le back) se résout par **conversion côté client** vers un
  format de la liste, pas par un élargissement du contrat.
- **Rotation** : versions de CryptoKey KMS. `dekKeyVersion` est persistée pour l'audit, mais le `decrypt` symétrique
  KMS résout la version tout seul → les objets anciens restent lisibles après rotation, **aucun job de re-wrap n'est
  nécessaire**.
- **Révocation** : affaire clôturée → l'unwrap est refusé par l'autorisation, sans re-chiffrement ni déplacement de
  données. Tenant supprimé (`SUP-05`) → destruction des versions de KEK = **crypto-shred** : les objets du bucket
  deviennent définitivement inexploitables, même si une copie a fuité auparavant.

## Conséquences

- ✅ Les octets d'image **ne transitent plus par le back** : plus de buffer multer, plus de bande passante, plus de
  données biométriques dans la mémoire d'un Cloud Run partagé entre tenants.
- ✅ **Une fuite du bucket seule est inexploitable** : aucune clé n'y est stockée.
- ✅ **Crypto-shred par tenant** (`SUP-05`) réel et instantané, sans toucher au bucket.
- ✅ `data-minuseek` **perd son accès IAM GCS** et la convention de chemin dupliquée : le blast radius pointé en ⚠️
  dans l'ADR-0007 se referme, et l'heuristique des cinq extensions disparaît.
- ✅ Le **format d'enveloppe est figé et versionné** : mobile, front et data l'implémentent sans se coordonner.
- ✅ La taille d'upload est enfin bornée (elle ne l'était pas du tout).
- ⚠️ **Ce n'est pas du zero-knowledge** : le back détient les KEK et peut déchiffrer. Le modèle de menace couvert est
  la fuite de stockage et l'exposition des octets en transit — **pas** un back compromis. Les durcissements (§1)
  rendent l'opération auditée et non silencieuse, ils ne la rendent pas impossible.
- ⚠️ **`confirm` dépend de `data-minuseek`** (validation `BIO-38` synchrone) : une indisponibilité de data bloque les
  uploads. Réversible vers un statut `VALIDATING` asynchrone si le taux d'échec le justifie.
- ⚠️ **La validation de type MIME devient déclarative** : le back ne voit plus les octets, il croit le client sur
  parole. Un client modifié peut stocker n'importe quoi ; le seul garde-fou réel est la limite de taille et le fait que
  data échouera à en faire une image.
- ⚠️ **Trois implémentations cryptographiques à maintenir** (WebCrypto, React Native, Python) et un piège Node connu
  (tag séparé). Un bug de format se paie sur les trois clients à la fois.
- ⚠️ **Le chemin de lecture du front s'allonge** : `<img src={url}>` devient `fetch` → unwrap → déchiffrement WebCrypto
  → `createObjectURL`, avec révocation des object URLs au démontage. Sur des images 500 DPI de plusieurs Mo, le
  déchiffrement sur le thread principal est à surveiller (Web Worker si besoin).
- ⚠️ **Coût et quota Cloud KMS** : un appel `encrypt` par upload, un `decrypt` par accès en clair. Négligeable à
  l'échelle actuelle, à surveiller si un jour un batch traite des milliers d'images.
- ⚠️ **Migration** : les images déjà stockées sont en clair et le resteront. Un chantier de re-chiffrement du stock
  existant n'est pas couvert ici (A6 traite la suppression de l'upload proxy, pas la reprise de données).

## Alternatives écartées

- **Enveloppe asymétrique par utilisateur (zero-knowledge côté back)** — chaque opérateur a une paire de clés, la DEK
  est enveloppée une fois par utilisateur autorisé, le back ne stocke que des blobs qu'il ne peut pas ouvrir.
  Cryptographiquement supérieur, mais : un poste perdu rend les scellés illisibles (sauf séquestre — qui rouvre
  exactement le débat), il faut re-wrapper à chaque ajout d'un opérateur sur une affaire (donc un pair déjà autorisé
  doit être en ligne), et c'est le back qui distribue les clés publiques (substitution possible sans vérification
  hors-bande). Sur un dossier judiciaire, perdre la clé revient à perdre la pièce : le risque introduit dépasse le
  risque couvert.
- **Cloud EKM (KEK détenue par le tenant) dès la v1** — l'argument le plus fort face à un client institutionnel : le
  service de PTS peut couper l'accès unilatéralement. Écarté **pour l'instant** seulement : impose que chaque tenant
  opère un key manager externe (Fortanix / Thales / Virtru), ce qui est bloquant pour le tenant de démo. La référence
  indirecte de KEK (§1) est posée précisément pour que la bascule reste une décision de configuration.
- **CMEK sur le bucket, sans chiffrement client** — beaucoup plus simple, crypto-shred conservé, mais l'image transite
  **en clair** par le back et GCP peut la lire. Ne satisfait ni l'exigence 1 ni `BIO-01`.
- **KEK unique + contexte tenant en AAD** — un seul CryptoKey pour tous les tenants, isolation par AAD. Rejeté : le
  crypto-shred par tenant (`SUP-05`) devient impossible sans casser tous les autres tenants.
- **Endpoint d'unwrap appelé par `data-minuseek`** (forme décrite dans les tickets A2/A5) — data n'a ni auth ni notion
  de tenant (ADR-0007), il ne peut donc pas s'autoriser. Il faudrait inventer un *grant token* que le back transporte
  jusqu'à data pour que data le rejoue : un jeton, un aller-retour et une surface de plus, et data conserverait son IAM
  GCS et sa convention de chemin. Le back pousse la clé, c'est plus court et plus étanche.
- **`generateSignedPostPolicyV4` avec `content-length-range`** — rejetterait le dépassement de taille au niveau de GCS,
  avant écriture, ce qui est strictement mieux. Écarté pour une raison client : la POST policy impose du
  `multipart/form-data`, pénible depuis React Native (`expo-file-system.uploadAsync` envoie du binaire) et verbeux
  côté front. À reconsidérer si les uploads abusifs deviennent un problème réel.
- **Notification Pub/Sub `OBJECT_FINALIZE` comme mécanisme principal de confirmation** — supprimerait l'appel `confirm`
  du client. Écarté : ajoute Pub/Sub à l'infra, rend la bascule `PENDING → RECEIVED` asynchrone, et prive le client de
  tout retour immédiat (notamment le refus `BIO-38`). Reste une piste de **réconciliation** ultérieure, en complément
  du job de nettoyage des orphelins.
- **Détection du test millimétré côté client** — rien ne transiterait, mais il faudrait porter la CV OpenCV de D1 en
  TypeScript et en React Native et la maintenir en double, pour une validation **contournable**, donc non opposable.
- **Statut `VALIDATING` asynchrone** — `confirm` resterait rapide et découplé de data, au prix d'un statut de plus,
  d'une file, et d'une UI d'attente à écrire sur le mobile **et** sur le front. Non retenu tant que la validation tient
  dans le temps d'une requête.
