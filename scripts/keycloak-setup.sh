#!/bin/sh
# Amorce l'Admin API du Keycloak LOCAL pour le provisioning (idempotent) :
# crée le client confidentiel minuseek-provisioner sur le realm master, donne
# le rôle admin à son service account, et écrit son secret dans .env
# (KEYCLOAK_ADMIN_CLIENT_SECRET). Lancé par `make keycloak-setup`.
#
# Requiert : le stack local démarré, KC_BOOTSTRAP_ADMIN_USERNAME/PASSWORD dans
# l'environnement (make les exporte depuis .env), curl et python3 sur l'hôte.
set -eu

KEYCLOAK_URL="${KEYCLOAK_LOCAL_URL:-http://localhost:8080}"
CLIENT_ID="${KEYCLOAK_ADMIN_CLIENT_ID:-minuseek-provisioner}"

authenticated_get() {
  curl -sf -H "Authorization: Bearer $TOKEN" "$1"
}

TOKEN=$(curl -sf -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -d grant_type=password -d client_id=admin-cli \
  -d "username=$KC_BOOTSTRAP_ADMIN_USERNAME" \
  --data-urlencode "password=$KC_BOOTSTRAP_ADMIN_PASSWORD" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')

lookup_client_uuid() {
  authenticated_get "$KEYCLOAK_URL/admin/realms/master/clients?clientId=$CLIENT_ID" \
    | python3 -c 'import json,sys; rows=json.load(sys.stdin); print(rows[0]["id"] if rows else "")'
}

CLIENT_UUID=$(lookup_client_uuid)
if [ -z "$CLIENT_UUID" ]; then
  curl -sf -X POST "$KEYCLOAK_URL/admin/realms/master/clients" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"clientId\":\"$CLIENT_ID\",\"protocol\":\"openid-connect\",\"publicClient\":false,\"serviceAccountsEnabled\":true,\"standardFlowEnabled\":false,\"directAccessGrantsEnabled\":false}"
  CLIENT_UUID=$(lookup_client_uuid)
  echo "client $CLIENT_ID créé"
else
  echo "client $CLIENT_ID déjà présent"
fi

# Le service account reçoit le rôle admin du master : c'est lui qui crée et
# configure les realms des organisations (re-POST d'un mapping existant = no-op).
SERVICE_ACCOUNT_ID=$(authenticated_get "$KEYCLOAK_URL/admin/realms/master/clients/$CLIENT_UUID/service-account-user" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
ADMIN_ROLE_JSON=$(authenticated_get "$KEYCLOAK_URL/admin/realms/master/roles/admin" \
  | python3 -c 'import json,sys; r=json.load(sys.stdin); print(json.dumps([{"id": r["id"], "name": r["name"]}]))')
curl -sf -X POST "$KEYCLOAK_URL/admin/realms/master/users/$SERVICE_ACCOUNT_ID/role-mappings/realm" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "$ADMIN_ROLE_JSON" || true

CLIENT_SECRET=$(authenticated_get "$KEYCLOAK_URL/admin/realms/master/clients/$CLIENT_UUID/client-secret" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["value"])')

python3 - "$CLIENT_ID" "$CLIENT_SECRET" <<'PYEOF'
import re, sys
from pathlib import Path

client_id, client_secret = sys.argv[1], sys.argv[2]
env_path = Path(".env")
content = env_path.read_text()

def upsert(content, key, value):
    line = f"{key}={value}"
    if re.search(rf"^{key}=.*$", content, flags=re.M):
        return re.sub(rf"^{key}=.*$", line, content, flags=re.M)
    return content.rstrip("\n") + f"\n{line}\n"

content = upsert(content, "KEYCLOAK_ADMIN_CLIENT_ID", client_id)
content = upsert(content, "KEYCLOAK_ADMIN_CLIENT_SECRET", client_secret)
env_path.write_text(content)
print(".env mis à jour : KEYCLOAK_ADMIN_CLIENT_ID + KEYCLOAK_ADMIN_CLIENT_SECRET")
PYEOF
