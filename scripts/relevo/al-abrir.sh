#!/bin/zsh
# Hook SessionStart (sólo laptop): trae lo último de GitHub y le dice a Claude en
# qué rama está y qué falta, antes de empezar.
cd "${CLAUDE_PROJECT_DIR:-$PWD}" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
git fetch -q --prune 2>/dev/null || { echo "Relevo: sin red, no se pudo hacer git fetch."; exit 0; }
rama=$(git symbolic-ref --short -q HEAD || echo "(HEAD separado)")
if git rev-parse -q --verify "@{u}" >/dev/null 2>&1 && [ -z "$(git status --porcelain)" ]; then
  git merge -q --ff-only "@{u}" 2>/dev/null
fi
detras_main=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
sucios=$(git status --porcelain | wc -l | tr -d ' ')
echo "Relevo: rama actual «$rama» · $detras_main commits de origin/main que esta rama no tiene · $sucios archivos sin guardar."
case "$rama" in main|master) echo "Relevo: estás en main. Antes de cambiar código crea una rama claude/<tema> (el autoguardado no corre en main).";; esac
exit 0
