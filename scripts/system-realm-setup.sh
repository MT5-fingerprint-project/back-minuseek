#!/bin/sh
# Amorce le realm administrateur minussek `minuseek-system` sur un Keycloak cible (idempotent) :
#   - le realm lui-même (thème par défaut, pas d'auto-inscription) ;
#   - le client PUBLIC `admin-minuseek` (PKCE S256) — l'app admin s'y connecte ;
#
# Local  : `make system-realm` (cible localhost, admin bootstrap depuis .env).

set -eu

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
SYSTEM_REALM="${KEYCLOAK_SYSTEM_REALM:-minuseek-system}"
ADMIN_CLIENT_ID="${ADMIN_APP_CLIENT_ID:-admin-minuseek}"
PROVISIONER_CLIENT_ID="minuseek-system-provisioner"
API_AUDIENCE="${KEYCLOAK_AUDIENCE:-minuseek-api}"
# Origine de l'app admin (redirect/web origins) ; 5174 = port hôte du dev.
ADMIN_ORIGIN="${ADMIN_ORIGIN:-http://localhost:5174}"
# HTTP local => none ; déployé derrière HTTPS => external.
SSL_REQUIRED="${SYSTEM_REALM_SSL_REQUIRED:-none}"

AUDIENCE_MAPPER='{"name":"minuseek-api-audience","protocol":"openid-connect","protocolMapper":"oidc-audience-mapper","config":{"included.custom.audience":"'"$API_AUDIENCE"'","access.token.claim":"true","id.token.claim":"false"}}'

TOKEN=$(curl -sf -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -d grant_type=password -d client_id=admin-cli \
  -d "username=$KC_BOOTSTRAP_ADMIN_USERNAME" \
  --data-urlencode "password=$KC_BOOTSTRAP_ADMIN_PASSWORD" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')

auth_get() { curl -sf -H "Authorization: Bearer $TOKEN" "$1"; }
auth_post() {
  curl -sf -o /dev/null -w '%{http_code}' -X POST "$1" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$2"
}
client_uuid() {
  auth_get "$KEYCLOAK_URL/admin/realms/$SYSTEM_REALM/clients?clientId=$1" \
    | python3 -c 'import json,sys; r=json.load(sys.stdin); print(r[0]["id"] if r else "")'
}

# 1. Realm système
if auth_get "$KEYCLOAK_URL/admin/realms/$SYSTEM_REALM" >/dev/null 2>&1; then
  echo "= realm $SYSTEM_REALM déjà présent"
else
  auth_post "$KEYCLOAK_URL/admin/realms" \
    '{"realm":"'"$SYSTEM_REALM"'","enabled":true,"displayName":"Minuseek — système","sslRequired":"'"$SSL_REQUIRED"'","registrationAllowed":false}' >/dev/null
  echo "+ realm $SYSTEM_REALM créé"
fi

# 2. Client public de l'app admin (PKCE S256 + audience)
if [ -n "$(client_uuid "$ADMIN_CLIENT_ID")" ]; then
  echo "= client $ADMIN_CLIENT_ID déjà présent"
else
  auth_post "$KEYCLOAK_URL/admin/realms/$SYSTEM_REALM/clients" '{
    "clientId":"'"$ADMIN_CLIENT_ID"'","protocol":"openid-connect","publicClient":true,
    "standardFlowEnabled":true,"implicitFlowEnabled":false,"directAccessGrantsEnabled":false,
    "redirectUris":["'"$ADMIN_ORIGIN"'/*"],"webOrigins":["'"$ADMIN_ORIGIN"'"],
    "attributes":{"pkce.code.challenge.method":"S256","post.logout.redirect.uris":"+"},
    "protocolMappers":['"$AUDIENCE_MAPPER"']}' >/dev/null
  echo "+ client public $ADMIN_CLIENT_ID créé (redirect $ADMIN_ORIGIN)"
fi

# 3. Client confidentiel provisioner (machine, client_credentials + audience)
PROVISIONER_UUID=$(client_uuid "$PROVISIONER_CLIENT_ID")
if [ -z "$PROVISIONER_UUID" ]; then
  auth_post "$KEYCLOAK_URL/admin/realms/$SYSTEM_REALM/clients" '{
    "clientId":"'"$PROVISIONER_CLIENT_ID"'","protocol":"openid-connect","publicClient":false,
    "serviceAccountsEnabled":true,"standardFlowEnabled":false,"directAccessGrantsEnabled":false,
    "protocolMappers":['"$AUDIENCE_MAPPER"']}' >/dev/null
  PROVISIONER_UUID=$(client_uuid "$PROVISIONER_CLIENT_ID")
  echo "+ client confidentiel $PROVISIONER_CLIENT_ID créé"
else
  echo "= client $PROVISIONER_CLIENT_ID déjà présent"
fi
PROVISIONER_SECRET=$(auth_get "$KEYCLOAK_URL/admin/realms/$SYSTEM_REALM/clients/$PROVISIONER_UUID/client-secret" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["value"])')

# 4. User superadmin — UNIQUEMENT si SYSTEM_ADMIN_EMAIL est fourni.
# Le `make system-realm` local en passe un (credential de dev connu, mot de
# passe NON temporaire pour se loguer direct). En déployé on ne le passe PAS :
# le superadmin s'y crée à la main avec un vrai mot de passe.
if [ -n "${SYSTEM_ADMIN_EMAIL:-}" ]; then
  ADMIN_USERNAME=$(printf '%s' "$SYSTEM_ADMIN_EMAIL" | cut -d@ -f1)
  EXISTING_ADMIN=$(auth_get "$KEYCLOAK_URL/admin/realms/$SYSTEM_REALM/users?email=$SYSTEM_ADMIN_EMAIL&exact=true" \
    | python3 -c 'import json,sys; r=json.load(sys.stdin); print(r[0]["id"] if r else "")')
  if [ -z "$EXISTING_ADMIN" ]; then
    auth_post "$KEYCLOAK_URL/admin/realms/$SYSTEM_REALM/users" '{
      "username":"'"$ADMIN_USERNAME"'","email":"'"$SYSTEM_ADMIN_EMAIL"'","emailVerified":true,"enabled":true,
      "credentials":[{"type":"password","value":"'"${SYSTEM_ADMIN_PASSWORD:-superadmin}"'","temporary":false}]}' >/dev/null
    echo "+ user superadmin $SYSTEM_ADMIN_EMAIL créé"
  else
    echo "= user superadmin $SYSTEM_ADMIN_EMAIL déjà présent"
  fi
fi

echo
echo "Realm système prêt sur $KEYCLOAK_URL."
echo "  App admin  : realm=$SYSTEM_REALM client=$ADMIN_CLIENT_ID (public PKCE)"
echo "  Provisioner: client_id=$PROVISIONER_CLIENT_ID secret=$PROVISIONER_SECRET"
if [ -n "${SYSTEM_ADMIN_EMAIL:-}" ]; then
  echo "  Superadmin : $SYSTEM_ADMIN_EMAIL / ${SYSTEM_ADMIN_PASSWORD:-superadmin} (dev — non temporaire)"
else
  echo "  ⚠ Aucun user superadmin : crée-le à la main dans $SYSTEM_REALM (console admin)."
fi
