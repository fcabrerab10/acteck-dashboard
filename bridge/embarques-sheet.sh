#!/bin/zsh
# Carga diaria del Master Embarques leyendo el Sheet directo (OAuth del usuario o
# service account). La usa launchd (com.acteck.sync.embarques). Si todavía no hay
# credenciales de Google, no hace nada (la tarea de Claude con el conector de Drive
# sigue siendo el respaldo).
cd "$(dirname "$0")"
set -a; source credenciales.env 2>/dev/null; set +a
if [ -f "${GOOGLE_OAUTH_TOKEN_FILE:-./google-oauth-token.json}" ] || [ -f "${GOOGLE_SERVICE_ACCOUNT_FILE:-./google-sa.json}" ]; then
  exec ./run.sh embarques
fi
echo "$(date '+%Y-%m-%d %H:%M:%S') embarques por Sheet: sin credenciales de Google (node google-auth.mjs); se omite" >> "logs/sync-$(date +%Y-%m-%d).log"
