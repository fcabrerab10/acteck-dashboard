#!/bin/zsh
# Quita los agentes launchd del puente.
for f in "$HOME"/Library/LaunchAgents/com.acteck.sync.*.plist; do
  [ -e "$f" ] || continue
  launchctl bootout "gui/$(id -u)/$(basename "${f%.plist}")" 2>/dev/null || true
  rm -f "$f" && echo "✓ removido $(basename "$f")"
done
