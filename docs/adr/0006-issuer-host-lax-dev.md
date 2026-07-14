# ADR-0006 — Vérification lax du host de l'issuer en dev local

- **Statut** : accepté
- **Date** : 2026-07-11

## Contexte
La `MultiRealmJwtStrategy` exige que le claim `iss` du token vaille exactement
`${KEYCLOAK_PUBLIC_URL}/realms/<realm>` (défense contre le mix-up de tokens entre
environnements). En dev local, `KEYCLOAK_PUBLIC_URL=http://localhost:8080` — or un
device physique (test mobile Expo) ne peut pas joindre `localhost` : il passe par
l'IP LAN de la machine, et Keycloak dev (`KC_HOSTNAME_STRICT=false`) émet alors un
`iss` portant cette IP. Le back rejetait donc tout token issu d'un device, et la
parade documentée (aligner `KEYCLOAK_PUBLIC_URL`, `VITE_KEYCLOAK_URL` et
`EXPO_PUBLIC_KEYCLOAK_URL` sur l'IP du moment) devait être refaite à chaque
changement de réseau et sur chaque poste — intenable en équipe, alors que le mobile
auto-détecte déjà son hôte via Metro et que Keycloak n'exige rien.

## Décision
Introduire `KEYCLOAK_ISSUER_HOST_CHECK` dans la `MultiRealmJwtStrategy` :
- **`strict` (défaut, fail-closed)** : comparaison exacte inchangée ; toute valeur
  autre que la chaîne exacte `lax` vaut `strict`.
- **`lax`** : seul le chemin `/realms/<realm attendu du tenant>` de l'`iss` est
  vérifié, le host est ignoré. S'applique aux trois points de contrôle (realm
  tenant, realm système, re-check dans `validate()`).
- Le compose dev (`docker/dev/compose.yml`) active `lax` par défaut
  (`${KEYCLOAK_ISSUER_HOST_CHECK:-lax}`) ; aucun environnement déployé ne le
  définit → strict partout ailleurs.

Le mode lax ne relâche **que** le pinning du host : la signature reste vérifiée
contre le JWKS du realm résolu via `KEYCLOAK_INTERNAL_URL` (c'est elle qui pinne le
véritable émetteur — un token forgé avec un `iss` exotique ne passe pas la
vérification de clé), l'audience `minuseek-api` et la correspondance
slug → realm du registre restent contrôlées.

## Conséquences
- ✅ Test mobile sur device : zéro config, sur n'importe quel poste et n'importe
  quel réseau (`make dev` + `expo start`, le mobile auto-détecte l'hôte Metro).
- ✅ Fin de la procédure « aligner les trois URLs sur l'IP LAN » de
  `mobile-minuseek/.env.example` (documentation mise à jour en conséquence).
- ✅ Posture déployée inchangée : fail-closed, `lax` n'est jamais posé hors compose dev.
- ⚠️ En lax, un token d'un autre *environnement* portant le même nom de realm ne
  serait plus filtré par l'`iss` seul — il reste rejeté par la signature (JWKS
  local). Acceptable en dev local uniquement ; ne jamais activer en déployé.
- Contrainte réseau restante (inhérente au dev local) : téléphone et machine sur
  le même réseau ; sinon partage de connexion ou `adb reverse` (Android USB).

## Alternatives écartées
- **Statu quo (aligner les 3 URLs sur l'IP LAN)** — friction à chaque lieu et
  chaque poste, incompatible avec le travail en équipe.
- **Nom mDNS par poste (`<machine>.local`)** — config manuelle par dev, et le mDNS
  est souvent bloqué sur les Wi-Fi d'école/entreprise.
- **Pointer le mobile sur le Keycloak dev déployé (`auth-dev.minuseek.fr`)** —
  couple le dev local à une instance partagée (realms/users divergents, internet
  requis) et oblige le back local à faire confiance à cet issuer.
- **`adb reverse` (localhost tunnelé par USB)** — fonctionne mais Android + câble
  uniquement ; conservé comme dépannage sur réseau hostile, pas comme solution.
