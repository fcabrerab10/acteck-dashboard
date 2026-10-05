#!/bin/zsh
# Activa el autoguardado SÓLO en esta máquina (.claude/settings.local.json, no viaja
# con git). Se niega a instalarse en la Mac mini del puente.
cd "$(dirname "$0")/../.."
if [ -f bridge/credenciales.env ] || [ -d "$HOME/acteck/acteck-dashboard/bridge/logs" ]; then
  echo "✗ Esto parece la Mac mini del puente; el autoguardado es sólo para la laptop."; exit 1
fi
chmod +x scripts/relevo/*.sh
mkdir -p .claude
node -e '
const fs=require("fs"), p=".claude/settings.local.json";
const s=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,"utf8")):{};
s.hooks=s.hooks||{};
const h=(cmd,timeout)=>[{hooks:[{type:"command",command:cmd,timeout}]}];
s.hooks.Stop=h("\"$CLAUDE_PROJECT_DIR\"/scripts/relevo/autoguardar.sh",60);
s.hooks.SessionStart=h("\"$CLAUDE_PROJECT_DIR\"/scripts/relevo/al-abrir.sh",30);
fs.writeFileSync(p,JSON.stringify(s,null,2)+"\n");'
echo "✓ Autoguardado activado en $(pwd)/.claude/settings.local.json (reinicia la sesión de Claude para que lo tome)."
