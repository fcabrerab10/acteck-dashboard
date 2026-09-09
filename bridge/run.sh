#!/bin/zsh
# Wrapper para launchd: fija PATH (Homebrew) y corre el sync con credenciales.env.
# Uso: ./run.sh all | erp | ventas | inventario | precios | compras | cuotas | sellout | embarques
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")"
LOG="logs/sync-$(date +%Y-%m-%d).log"
{
  echo "════ $(date '+%Y-%m-%d %H:%M:%S') · sync $* ════"
  node --env-file=credenciales.env sync.mjs "$@"
  echo "exit=$? · $(date '+%Y-%m-%d %H:%M:%S')"
} >> "$LOG" 2>&1
# Conservar 60 días de logs.
find logs -name 'sync-*.log' -mtime +60 -delete 2>/dev/null
exit 0
