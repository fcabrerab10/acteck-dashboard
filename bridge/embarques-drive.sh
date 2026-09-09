#!/bin/zsh
# Carga del Master Embarques a partir del JSON que devuelve el conector de Google
# Drive de Claude (download_file_content → {content: <base64 xlsx>, ...}).
# Lo usa la tarea programada "acteck-embarques-diario" de la app de Claude.
#
#   ./embarques-drive.sh <ruta-del-json-del-conector> [--dry-run]
#
# Decodifica el xlsx en bridge/Master Embarques.xlsx, verifica que sea un Excel
# válido y corre embarques-xlsx.mjs (replace de embarques_compras + upsert de las
# demás pestañas). Registra todo en logs/sync-<fecha>.log como el resto del puente.
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")"
JSON="${1:-}"; shift || true
XLSX="Master Embarques.xlsx"
LOG="logs/sync-$(date +%Y-%m-%d).log"
mkdir -p logs
{
  echo "════ $(date '+%Y-%m-%d %H:%M:%S') · embarques desde Drive ════"
  if [ -z "$JSON" ] || [ ! -f "$JSON" ]; then echo "✗ falta el JSON del conector: '$JSON'"; exit 2; fi
  if ! jq -r '.content' "$JSON" | base64 -d > "$XLSX.tmp"; then echo "✗ no se pudo decodificar el base64"; rm -f "$XLSX.tmp"; exit 3; fi
  SIZE=$(stat -f %z "$XLSX.tmp")
  if ! file "$XLSX.tmp" | grep -q 'Excel 2007+' || [ "$SIZE" -lt 500000 ]; then
    echo "✗ el archivo no parece un xlsx válido ($(file -b "$XLSX.tmp" | cut -c1-60), $SIZE bytes)"; rm -f "$XLSX.tmp"; exit 4
  fi
  mv -f "$XLSX.tmp" "$XLSX"
  echo "  xlsx: $SIZE bytes · $(jq -r '.title' "$JSON")"
  node --env-file=credenciales.env embarques-xlsx.mjs "$XLSX" "$@"
  RC=$?
  echo "exit=$RC · $(date '+%Y-%m-%d %H:%M:%S')"
  exit $RC
} 2>&1 | tee -a "$LOG"
exit ${pipestatus[1]}
