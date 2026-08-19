---
name: tdd
description: "Discipline TDD stricte pour le backend Minuseek (NestJS 11 + Jest, DDD / hexagonal). Déclencher AVANT d'écrire la moindre ligne de code de production : nouveau use case / handler, nouvelle entité ou Value Object, nouvelle règle métier ou invariant, nouveau port ou adapter, correction de bug, exécution d'un ticket de roadmap. Impose le cycle rouge → vert → refacto réellement exécuté (le rouge doit être observé et rapporté, pas supposé), une taxonomie de couverture obligatoire (nominal, limites, entrées invalides, transitions interdites, immuabilité, adversarial, idempotence, round-trip, régression), des assertions typées (jamais de `.toThrow()` nu), et une preuve de protection par mutation manuelle du code de production. Contient le catalogue des faux TDD observés dans ce repo et la Definition of Done d'un cycle."
---

# TDD — backend Minuseek

Skill de **discipline d'écriture**, pas de conventions. Les conventions (layers, dependency rule, `InMemory*Repository` plutôt que mocks, nommage des fichiers, workflow Prisma) vivent dans **`AGENTS.md`**, seule source de vérité — ce skill n'en ré-énonce aucune, il y pointe. Ce qu'il apporte : **l'ordre dans lequel on écrit**, **ce qu'un test doit couvrir pour protéger**, et **comment prouver qu'il protège**.

> **Le problème qu'il résout.** Écrire les tests après le code produit des tests qui *décrivent l'implémentation* au lieu de la *contraindre* : ils passent du premier coup, n'ont jamais échoué, et ne cassent pas quand le code casse. Ce n'est pas du TDD, c'est de la documentation exécutable — utile, mais qui ne protège de rien. Tout ce qui suit existe pour rendre ce résultat impossible.

## Quand utiliser

Systématiquement, avant le code de production, dès qu'il y a une **décision de comportement** :

- Entité, aggregate, Value Object, invariant, transition d'état, erreur métier.
- Handler de commande ou de query (testé via `InMemory*`, cf. `AGENTS.md`).
- Port + son fake in-memory (le fake est du code de test : il se teste par les specs qui l'utilisent, mais il doit imiter le contrat de l'adapter réel).
- Correction de bug : **le test qui reproduit le bug est écrit et rouge avant le fix**, sans exception.
- Sérialisation, hachage, calcul, tri, pagination — tout ce qui a une valeur de sortie exacte.

## Quand ne pas s'en servir

Ne pas forcer un cycle là où il n'y a pas de décision à contraindre. Le dire explicitement vaut mieux que d'écrire un test vide :

- **Spike / exploration** : coder pour comprendre, puis **jeter le spike** et repartir en TDD. Ne jamais promouvoir un spike en code de prod « puisqu'il marche ».
- **Wiring pur** : module NestJS (providers, tokens DI), `main.ts`, config, `.env.example`.
- **Migration Prisma, schéma, Docker, CI, Makefile.**
- **Adapter d'infra qui ne fait que traduire** (Prisma → primitives, GCS SDK → buffer) sans logique : couvert par le contrat du port et, à terme, par un test d'intégration. S'il contient une décision (mapping conditionnel, tri, cast), il redevient testable en TDD.
- **DTO/controller sans logique** : la validation est déléguée à `class-validator` — on ne teste pas la lib. On teste le **validateur maison** (`is-layer-settings.validator.spec.ts` en est l'exemple), pas les décorateurs.

## Le cycle — contrat non négociable

### 🔴 RED

1. **Un seul test à la fois**, qui décrit **un comportement** attendu, en partant du plus simple.
2. **Le lancer et regarder l'échec.** Un rouge non observé n'existe pas.
3. **Vérifier que l'échec est le bon.** En TypeScript, distinguer deux rouges :
   - *Rouge de compilation* (`Cannot find module`, `Property 'x' does not exist`) — **acceptable uniquement pour le tout premier test d'un fichier neuf**. On crée alors le squelette minimal (classe + signature qui `throw new Error('not implemented')`) et on **relance** pour obtenir un vrai rouge d'assertion.
   - *Rouge d'assertion* (`Expected … Received …`, `Received function did not throw`) — **le seul rouge valable** ensuite. C'est lui qui prouve que le test discrimine.
4. **Noter le message d'échec.** Il sera cité dans le rapport de cycle (voir plus bas). C'est la trace vérifiable que le rouge a eu lieu.

### 🟢 GREEN

5. **Le code minimal qui fait passer**, rien de plus. Pas de champ « on en aura besoin », pas de branche `if` sans test qui la réclame.
6. **Règle miroir** : toute branche du code de production (`if`, `??`, ternaire, `catch`, `throw`, `default:` d'un switch) doit avoir été **exigée par un test**. Une branche apparue sans test rouge préalable est du code non couvert par construction — soit on écrit le test, soit on supprime la branche (YAGNI).
7. Relancer : **vert**. Ne jamais enchaîner sur le test suivant avec un rouge résiduel.

### 🔧 REFACTOR

8. Tests verts, on améliore : nommage, extraction, suppression de duplication — **côté production ET côté test** (les specs sont du code de premier rang : builders, `it.each`, noms parlants).
9. **Aucun changement de comportement.** Relancer après chaque pas ; si un test devient rouge, ce n'était pas un refacto.
10. Revenir en 🔴 avec le test suivant de la liste.

## Étape 0 — la liste de tests (avant le premier rouge)

Avant d'écrire quoi que ce soit, **énumérer les cas** en déroulant la taxonomie ci-dessous. La liste va dans le message d'exécution du ticket (ou en tête de spec en commentaire, si elle est longue). Elle sert à trois choses : ordonner les cycles du plus simple au plus riche, rendre visible ce qu'on décide de **ne pas** couvrir, et empêcher l'oubli des cas hostiles — qui sont toujours ceux qu'on n'a pas listés.

> Pour chaque famille de la taxonomie : soit un cas listé, soit une ligne **« non applicable ici, parce que … »**. Sauter une famille en silence est le mécanisme n°1 des tests incomplets.

## Taxonomie de couverture — les 10 familles

Un test qui protège n'est pas un test qui décrit le succès. C'est un ensemble qui **encercle** le comportement : il dit ce qui doit arriver, et surtout **tout ce qui ne doit pas**.

| # | Famille | Question à se poser | Exemples projet |
|---|---|---|---|
| 1 | **Nominal** | Le contrat, une fois, proprement. | `EvidenceClass.observed()` → `OBSERVED` |
| 2 | **Limites** | 0, 1, n ; min, max, max±1 ; vide ; premier/dernier. | `seq = GENESIS_SEQ` vs `seq = 0n` ; page vide vs page pleine ; liste à 0/1/2 éléments |
| 3 | **Entrées invalides** | Chaque `throw` du code a-t-il son test, **avec le type d'erreur** ? | hash non hexa, hash en majuscules, date `Invalid Date`, payload non-objet |
| 4 | **Transitions interdites** | Quels états/enchaînements le domaine doit-il refuser ? | statut de trace : matrice des transitions légales **et** illégales ; double `remove-hit` |
| 5 | **Invariants & immuabilité** | Peut-on corrompre l'objet **après** construction, par l'entrée ou par la sortie ? | copie défensive du `payload` en entrée **et** en sortie ; `Date` rendue non mutable |
| 6 | **Adversarial** | Qu'est-ce qu'un appelant malveillant ou distrait enverrait ? | casse (`'observed'`), espaces (`' OBSERVED '`), chaîne vide, `null`/`undefined` castés, unicode/accents, `NaN`, `-0`, `__proto__`, très longue chaîne, doublons |
| 7 | **Idempotence & rejeu** | Deux fois la même commande = quoi ? | double `record-hit` ; ré-upload du même fichier ; retry après échec partiel |
| 8 | **Unicité & collisions** | Que voit le handler quand la contrainte est déjà violée ? | `CaseNumberAlreadyExistsError` ; `seq` déjà pris |
| 9 | **Round-trip** | `reconstitute(toPrimitives(x))` ≡ `x` ? Et avec une valeur **hors catalogue** en base ? | `AuditEvent` ; sérialisation canonique : **ordre de clés différent → même hash** |
| 10 | **Régression** | Ce bug est-il verrouillé par un test qui échouait avant le fix ? | `orderBy` sans tie-breaker : test avec **deux valeurs de tri ÉGALES**, pas seulement distinctes |

Trois pièges de couverture spécifiques à ce repo, à traiter comme des familles à part entière :

- **Cas d'égalité dans un tri.** Le bug d'index de calques (#21) est passé parce que les tests triaient des valeurs toutes distinctes. Un test de tri sans doublon ne teste pas le tri.
- **Le fake in-memory doit mentir comme l'adapter réel.** Si le fake trie autrement (ou pas) que le reader Prisma, la spec du handler donne une fausse confiance. Le fake reproduit l'ordre et la forme du contrat, y compris les cas d'égalité.
- **Champs JSON.** Le type domaine, le DTO HTTP, le read-model et le cast Prisma doivent s'accorder — un test de round-trip sur le champ JSON attrape le drift.

## Qualité des assertions

Un test mal assertif passe pour un test.

- **`.toThrow(TypeDErreur)`, jamais `.toThrow()` nu.** Un `toThrow()` nu passe sur n'importe quelle erreur — y compris un `TypeError` accidentel qui prouve que le code est cassé autrement qu'attendu. ✅ `user-role.vo.spec.ts:10` (`toThrow(InvalidUserRoleError)`) · ❌ `evidence-class.vo.spec.ts:20` et l'ensemble des `toThrow()` d'`audit-event.spec.ts`.
- **Un cas d'erreur ne s'arrête pas au throw.** Vérifier aussi que **rien n'a bougé** : le repo contient toujours 1 élément, aucun événement n'a été chaîné, le fichier n'a pas été uploadé. Sinon on ne teste que la moitié du contrat.
- **Un comportement par test**, et le nom du test **dit le comportement** (« rejette un prevHash en majuscules »), pas la mécanique (« test hash 2 »).
- **Arrange / Act / Assert** séparés par une ligne vide. **Aucune logique dans un test** : pas de `if`, pas de boucle, pas de `try/catch` — pour les variantes, `it.each` (déjà utilisé dans `audit-event.spec.ts:68`).
- **Assertions sur l'état, pas sur les appels.** Vérifier le contenu de l'`InMemory*Repository`, pas le nombre d'appels d'un mock (cf. `AGENTS.md` : pas de mock de port). `jest.fn()` reste légitime pour un pur générateur sans état (`IdGenerator`).
- **Valeurs exactes.** `toBe`/`toEqual` sur la valeur attendue ; `toBeDefined()` ou `not.toBeNull()` en assertion unique ne prouve rien.
- **Pas d'assertion sur le privé** ni sur un détail d'implémentation : si un test doit lire un champ privé, c'est le contrat public qui manque.
- Langue des descriptions : s'aligner sur le fichier voisin du même contexte (le repo est mixte ; les specs récentes sont en anglais). Ne pas mélanger dans un même fichier.

## Preuve de protection — la mutation manuelle

C'est l'étape qui répond à « est-ce que mes tests me protègent ? ». À faire **au vert, avant de committer**, sur le code écrit dans le cycle.

**Casser volontairement le code de production, une mutation à la fois, et relancer.** Au moins un test doit passer au rouge. Si tout reste vert, le test ne protège pas : il faut le compléter (pas le supprimer).

Catalogue de mutations à essayer, par ordre de rendement :

| Mutation | Ce qu'elle révèle |
|---|---|
| Inverser une condition (`!`), ou `>=` → `>` | Limites non testées (famille 2) |
| Supprimer un `throw` / un `if` de garde | Cas invalides non testés (famille 3) |
| Retourner une constante en dur | Assertions tautologiques ou trop faibles |
| Supprimer une copie défensive (entrée ou sortie) | Immuabilité non testée (famille 5) |
| Échanger deux arguments de même type | Tests qui passent les mêmes valeurs partout |
| Retirer le tie-breaker d'un `orderBy` / d'un `sort` | Tri testé sans cas d'égalité |
| Remplacer une valeur d'enum par une autre | Catalogue non exhaustivement testé |

Trois mutations survécues sur une unité = la spec est décorative. `pnpm test:cov` (aucun seuil configuré aujourd'hui) sert à **repérer** les branches jamais exécutées des fichiers touchés ; le taux de couverture n'est pas un objectif et ne prouve rien — une ligne exécutée sans assertion est couverte et non protégée.

## Faux TDD — le catalogue

À reconnaître et à refuser, chez soi comme en review :

- **Le test écrit après, dans la foulée du code.** Signature : il passe du premier coup, aucun rouge n'a jamais été observé, il reprend la structure du code ligne à ligne.
- **Le test de getter.** On construit l'objet avec des valeurs et on ré-assert ces mêmes valeurs. Ça teste l'affectation de champs, pas une règle. Utile une fois pour figer le contrat ; inutile répété quatre fois.
- **Le happy path seul.** Une unité avec un seul `it` qui réussit est presque toujours une unité non testée.
- **Le test tautologique.** L'attendu est recalculé par la même expression que l'implémentation (typiquement pour un hash ou une sérialisation). Un hash se teste par **vecteurs figés en dur** (golden tests) : entrée littérale → sortie hexa littérale, écrite à la main, qui ne doit plus jamais changer.
- **`expect(() => …).toThrow()` nu.**
- **Le mock de port** au lieu de l'`InMemory*` (interdit par `AGENTS.md`) : on teste alors sa propre hypothèse sur le port, pas le comportement.
- **Le test du framework** : vérifier que `class-validator` rejette un champ manquant, ou que Prisma sait faire un `findMany`.
- **Le builder qui cache le cas.** Un helper de construction (comme `chainEvent()` dans `audit-event.spec.ts`) est une bonne pratique — à condition que **la valeur testée soit passée en override explicite** et lisible dans le test. Si le lecteur doit remonter aux defaults pour comprendre ce qui est testé, le builder dessert.
- **Les tests livrés en commit de rattrapage** (déjà arrivé sur #20). Le test et le code qu'il contraint vont dans **le même commit**.

## Boucle outillée

```bash
make test-watch FILE=src/audit-trail/domain/audit-event/entity/audit-event.spec.ts  # boucle rouge/vert
make test FILE=src/audit-trail                                                      # un dossier
make test                                                                            # suite complète
cd app && pnpm test:cov -- --collectCoverageFrom='src/audit-trail/**/*.ts'          # branches non exécutées
rtk tsc                                                                              # tsc --noEmit
```

> `pnpm test` = Jest sur `src/**/*.spec.ts` (`rootDir: src`). **Il n'y a aucun test e2e dans le repo aujourd'hui** : pas de dossier `app/test/`, pas de script `test:e2e`, alors que `supertest` est installé. Ne pas prétendre le contraire ni inventer la commande.

## Commits & rapport de cycle

- **Le rouge ne se committe pas** (la CI doit rester verte sur chaque commit). Il se **prouve dans le rapport**.
- **Un commit = un ou plusieurs cycles complets** : spec + implémentation ensemble, atomique, message en anglais (`test(scope): …` seulement si le commit n'ajoute que des tests — sinon `feat`/`fix`, la spec fait partie de la feature).
- Un refacto substantiel part dans **son propre commit**, sans changement de comportement.

Format de rapport attendu à chaque cycle, pour que la discipline soit vérifiable et pas déclarative :

```
🔴 rejects a prevHash in uppercase
   → Expected function to throw, but it returned undefined
🟢 garde de format hexa minuscule ajoutée dans AuditEvent.chain
🔧 extraction de assertSha256Hex (3 appels), tests toujours verts
🧬 mutation : suppression de la garde → 2 tests rouges ✔
```

## Definition of Done d'un cycle

- [ ] Liste de tests écrite avant le code, les 10 familles passées en revue (couvertes ou explicitement écartées).
- [ ] Chaque test a été **vu rouge**, pour la bonne raison, avant son implémentation.
- [ ] Chaque `throw` et chaque branche du code de prod est exigé par au moins un test.
- [ ] Aucun `.toThrow()` nu ; les cas d'erreur vérifient aussi l'**absence d'effet de bord**.
- [ ] Mutation manuelle passée sur les points sensibles : chaque mutation tue au moins un test.
- [ ] Handlers testés via `InMemory*` ; fakes cohérents avec le contrat de l'adapter réel (y compris cas d'égalité de tri).
- [ ] `make test` vert, `rtk tsc` propre, `rtk lint` propre.
- [ ] Spec et implémentation dans le même commit.

## Exemple travaillé — `EvidenceClass`

Le VO fait 39 lignes : un enum à deux valeurs, deux fabriques, un `from(raw)` qui rejette l'inconnu, `getValue`, `equals`. La spec actuelle (`evidence-class.vo.spec.ts`, 4 tests) couvre le nominal, un parse, un rejet non typé et une comparaison. Elle survit à presque toutes les mutations utiles.

Ce que donne la taxonomie appliquée à ce même VO :

| Famille | Cas | Ce que ça verrouille |
|---|---|---|
| 1 Nominal | `observed()` / `declared()` rendent leur valeur | le contrat |
| 3 Invalides | `from('PROBABLE')` → **`toThrow(InvalidEvidenceClassError)`** | le **type** d'erreur, pas juste « ça pète » |
| 3 Invalides | le message cite la valeur reçue | contrat d'erreur exploitable en log/HTTP |
| 6 Adversarial | `from('observed')`, `from(' OBSERVED ')`, `from('')` | la casse et le trim ne sont **pas** tolérés (décision explicite) |
| 6 Adversarial | `from(null as unknown as string)`, `from('__proto__')`, `from('toString')` | la garde ne repose pas sur `in`/prototype |
| 9 Round-trip | pour **chaque** valeur de `Object.values(EvidenceClassEnum)` : `from(v).getValue() === v` | ajouter une valeur à l'enum sans fabrique **casse un test** |
| 5 Invariants | `equals` : réflexif, symétrique, faux entre classes différentes, vrai entre deux instances distinctes de même valeur | l'égalité est **par valeur**, pas par référence |

Sept cycles au lieu de quatre assertions, sur un VO trivial. Deux mutations qui **survivent à la spec actuelle** meurent avec celle-ci : remplacer `InvalidEvidenceClassError` par un `Error` générique (le `toThrow()` nu ne s'en aperçoit pas), et rendre `from` tolérant à la casse ou aux espaces (aucun test ne l'interdit aujourd'hui).

> Si un test de cette liste te paraît absurde à écrire, écris-le quand même une fois : le coût est de trente secondes, et c'est précisément le test que personne n'écrit qui documente la décision (« non, on ne tolère pas la casse ») que le prochain développeur va casser.
