#!/bin/zsh
# Hook Stop (sólo laptop): al terminar cada respuesta de Claude, guarda y sube el
# trabajo de la rama actual para que nada se quede sólo en esta máquina.
# No hace nada en main, en la carpeta del puente ni a mitad de un rebase/merge.
cd "${CLAUDE_PROJECT_DIR:-$PWD}" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
[ -f bridge/credenciales.env ] && exit 0                     # repo del puente (Mac mini)
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
  git diff --cached --quiet || git commit -q --no-verify -m "wip: autoguardado $(date '+%Y-%m-%d %H:%M')"
fi
# Push en segundo plano para no frenar a Claude; si no hay red, sube en la siguiente.
if [ -n "$(git log --oneline "@{u}"..HEAD 2>/dev/null)" ] || ! git rev-parse -q --verify "@{u}" >/dev/null 2>&1; then
  (git push -q -u origin "$rama" >/dev/null 2>&1 &)
fi
exit 0
