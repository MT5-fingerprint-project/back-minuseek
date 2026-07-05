# ADR-0005 — Client OIDC public `minuseek-mobile` (realm Keycloak)

- **Statut** : accepté
- **Date** : 2026-07-03

## Contexte
Le login mobile (ticket #2, Auth Code + PKCE via Expo/`expo-auth-session`) doit s'authentifier en OIDC contre Keycloak, mais le realm `tenant-demo` (`keycloak/dev/minuseek-demo-realm.json`) ne déclare qu'un seul client public, `front-minuseek`, dont les redirect URIs sont web (`http://localhost:5173/*`). L'app mobile tourne sur l'appareil : elle ne peut pas garder de secret et n'utilise pas de redirect HTTP mais un scheme natif. Sans client dédié, le login mobile ne peut obtenir aucun token. Le back valide `aud: minuseek-api` (`jwt.strategy.ts`, `KEYCLOAK_AUDIENCE`), donc tout token émis pour le mobile doit porter cette audience.

## Décision
Déclarer dans le realm export un **client OIDC public** `minuseek-mobile` :
- `publicClient: true`, `standardFlowEnabled: true`, PKCE **`S256`** — Auth Code + PKCE, **aucun secret** (le code tourne sur l'appareil) ;
- redirect URIs **`mobileminuseek://*`** (build natif/dev — scheme de `mobile-minuseek/app.json`) **et `exp://*`** (Expo Go) ; `post.logout.redirect.uris` alignées ;
- `directAccessGrantsEnabled: false` — pas de password grant, uniquement le flow Auth Code + PKCE ;
- audience **`minuseek-api`** injectée par le même `oidc-audience-mapper` que `front-minuseek`, pour que la `JwtStrategy` du back accepte les tokens sans modification.

## Conséquences
- ✅ Débloque le ticket #2 (login mobile) : Keycloak peut rediriger vers l'app et émettre des tokens acceptés par l'API (audience `minuseek-api`).
- ✅ Aucun secret embarqué dans l'app (client public + PKCE), pas de password grant : posture conforme au skill `api-security`.
- ✅ Aucun changement back requis : le mapper d'audience réutilise le contrat existant.
- ⚠️ Les redirect URIs utilisent des wildcards (`exp://*` en particulier est large) : **acceptable en dev uniquement** (realm `tenant-demo`, export `keycloak/dev/`). À resserrer pour un realm de prod.
- ⚠️ `--import-realm` n'importe pas un realm déjà existant : recréer le volume `keycloak_data` (`docker compose down -v`) pour que le client apparaisse sur un environnement déjà démarré.
- ⚠️ À terme, la création de ce client devra être intégrée au **provisioning multi-tenant (#6)** pour qu'il existe dans chaque realm tenant (realms = tenants, clients = apps).

## Alternatives écartées
- **Réutiliser le client `front-minuseek`** — impossible : redirect URIs et scheme distincts (web vs natif) ; mélanger web et mobile sur un même client brouille les frontières et la surface de redirect.
- **Client confidentiel (avec secret)** — impossible sur mobile : un secret embarqué dans l'app est extractible ; le pattern OAuth pour app publique est client public + PKCE.
- **Direct Access Grants (password grant)** — écarté : anti-pattern OIDC (l'app manipule les identifiants), inutile puisque le flow Auth Code + PKCE couvre le besoin.
