#!/bin/zsh
# Hook Stop (Mac mini y laptop): al terminar cada respuesta de Claude, guarda y sube
# el trabajo de la rama actual de la carpeta de trabajo, para que la otra máquina lo
# encuentre. Nunca en main, nunca en el repo del puente, nunca a mitad de un rebase.
CONF="$HOME/.claude/acteck-relevo/config.env"
[ -f "$CONF" ] || exit 0
source "$CONF"
[[ "${(L)${CLAUDE_PROJECT_DIR:-$PWD}}" == *acteck* ]] || exit 0
cd "$REPO" 2>/dev/null || exit 0
[ -f bridge/credenciales.env ] && exit 0                     # repo del puente
rama=$(git symbolic-ref --short -q HEAD) || exit 0           # HEAD separado
case "$rama" in main|master) exit 0;; esac
gd=$(git rev-parse --git-dir)
[ -d "$gd/rebase-merge" ] || [ -d "$gd/rebase-apply" ] || [ -f "$gd/MERGE_HEAD" ] && exit 0

if [ -n "$(git status --porcelain)" ]; then
  git add -A
  # Nunca subir secretos ni archivos pesados aunque no estén en .gitignore.
  git diff --cached --name-only -z | while IFS= read -r -d '' f; do
    if [[ "$f" == *.env* || "$f" == *credenciales* || "$f" == *token*.json || "$f" == *client_secret* || "$f" == *.pem || "$f" == *.key ]] \
       || [ "$(stat -f%z "$f" 2>/dev/null || echo 0)" -gt 5000000 ]; then
      git reset -q -- "$f"; echo "autoguardado: se omitió $f (secreto o >5 MB)" >&2
    fi
  done
  git diff --cached --quiet || git commit -q --no-verify -m "wip: autoguardado $MAQUINA $(date '+%Y-%m-%d %H:%M')"
fi
# Push en segundo plano para no frenar a Claude; si no hay red, sube en la siguiente.
if [ -n "$(git log --oneline "@{u}"..HEAD 2>/dev/null)" ] || ! git rev-parse -q --verify "@{u}" >/dev/null 2>&1; then
  (git push -q -u origin "$rama" >/dev/null 2>&1 &)
fi
exit 0
