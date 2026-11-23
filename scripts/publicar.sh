#!/bin/zsh
# Publica la rama actual en main: commit, integra main (resuelve sólo el choque de versión de package.json), push y
# comprueba que producción sirva la versión. Uso: scripts/publicar.sh <version> "<mensaje>"
set -e
git add -A; git commit -qm "$2

Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>" || true
for i in 1 2 3; do
  git fetch -q
  if ! git merge -q origin/main 2>/dev/null; then
    python3 - <<'P'
import re,subprocess
u=subprocess.run(['git','diff','--name-only','--diff-filter=U'],capture_output=True,text=True).stdout.split()
assert u==['package.json'], u
s=open('package.json').read()
s=re.sub(r'<<<<<<< HEAD\n(.*?)=======\n.*?>>>>>>> [^\n]*\n', r'\1', s, flags=re.S)
open('package.json','w').write(s)
P
    git add -A; git commit -qm "merge: main en $1

Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>"
  fi
  if git push -q origin HEAD:main 2>/dev/null; then echo "push ok"; break; fi
done
grep '"version"' package.json
./scripts/verificar-produccion.sh $1 2>&1 | tail -1
