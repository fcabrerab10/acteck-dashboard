#!/bin/zsh
# Instala (o reinstala) los agentes launchd del puente para el usuario actual.
# Uso: cd bridge && ./launchd/install.sh
set -e
BRIDGE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/Library/LaunchAgents"
mkdir -p "$DEST" "$BRIDGE_DIR/logs"
for f in "$BRIDGE_DIR"/launchd/com.acteck.sync.*.plist; do
  name="$(basename "$f")"
  sed "s|__BRIDGE_DIR__|$BRIDGE_DIR|g" "$f" > "$DEST/$name"
  launchctl bootout "gui/$(id -u)/${name%.plist}" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$DEST/$name"
  launchctl enable "gui/$(id -u)/${name%.plist}"
  echo "✓ $name → $DEST"
done
echo
echo "Agentes cargados:"
launchctl list | grep com.acteck.sync || true
echo
echo "Probar ahora sin esperar al horario:  launchctl kickstart -k gui/$(id -u)/com.acteck.sync.intradia"
echo "Cola de solicitudes (cada 5 min):     launchctl kickstart -k gui/$(id -u)/com.acteck.sync.solicitudes"
echo "Ver log:                              tail -f $BRIDGE_DIR/logs/sync-$(date +%Y-%m-%d).log"
