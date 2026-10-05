#!/bin/zsh
# Instala el relevo automático en ESTA máquina (una sola vez por máquina):
#   ./scripts/relevo/instalar.sh
# Copia los hooks a ~/.claude/acteck-relevo/ y los registra en ~/.claude/settings.json
# (SessionStart = inicio.sh, Stop = autoguardar.sh). Detecta solo si es la Mac mini.
set -e
aqui="$(cd "$(dirname "$0")/../.." && pwd)"
dest="$HOME/.claude/acteck-relevo"
mkdir -p "$dest"
if [ -d "$HOME/acteck/acteck-dashboard/bridge/logs" ] && [ -f "$HOME/acteck/acteck-dashboard/bridge/credenciales.env" ]; then
  MAQUINA=mini; PUENTE="$HOME/acteck/acteck-dashboard"; REPO="$HOME/acteck/acteck-dashboard-trabajo"
  [ -d "$REPO" ] || git -C "$PUENTE" worktree add -q --detach "$REPO" origin/main
else
  MAQUINA=laptop; PUENTE=""; REPO="$aqui"
fi
printf 'MAQUINA=%s\nREPO=%q\nPUENTE=%q\n' "$MAQUINA" "$REPO" "$PUENTE" > "$dest/config.env"
cp "$aqui/scripts/relevo/inicio.sh" "$aqui/scripts/relevo/autoguardar.sh" "$dest/"
chmod +x "$dest"/*.sh
node -e '
const fs=require("fs"), p=process.env.HOME+"/.claude/settings.json", d=process.env.HOME+"/.claude/acteck-relevo";
const s=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,"utf8")):{};
s.hooks=s.hooks||{};
const poner=(ev,script,timeout)=>{
  const lista=(s.hooks[ev]||[]).filter(g=>!(g.hooks||[]).some(h=>String(h.command||"").includes("acteck-relevo")));
  lista.push({hooks:[{type:"command",command:`${d}/${script}`,timeout}]});
  s.hooks[ev]=lista;
};
poner("SessionStart","inicio.sh",180);
poner("Stop","autoguardar.sh",60);
fs.writeFileSync(p,JSON.stringify(s,null,2)+"\n");'
echo "✓ Relevo instalado en $MAQUINA · carpeta de trabajo: $REPO"
echo "  Cierra y vuelve a abrir Claude para que empiece a saludarte con la máquina detectada."
