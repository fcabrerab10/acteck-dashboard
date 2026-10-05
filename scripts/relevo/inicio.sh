#!/bin/zsh
# Hook SessionStart (Mac mini y laptop). Detecta en qué máquina estás, deja el
# código al día y le dice a Claude cómo saludarte y dónde trabajar.
# Lo instala scripts/relevo/instalar.sh en ~/.claude/acteck-relevo/.
CONF="$HOME/.claude/acteck-relevo/config.env"
[ -f "$CONF" ] || exit 0
source "$CONF"
[[ "${(L)${CLAUDE_PROJECT_DIR:-$PWD}}" == *acteck* ]] || exit 0      # sólo proyectos de Acteck

notas=()
if [ "$MAQUINA" = mini ]; then
  lugar="la Mac mini (oficina)"
  # 1) Repo del puente: siempre en main y al día (de aquí corre launchd).
  if git -C "$PUENTE" fetch -q 2>/dev/null; then
    if [ "$(git -C "$PUENTE" symbolic-ref --short -q HEAD)" = main ] && [ -z "$(git -C "$PUENTE" status --porcelain --untracked-files=no)" ]; then
      antes=$(git -C "$PUENTE" rev-parse HEAD)
      if git -C "$PUENTE" merge -q --ff-only origin/main 2>/dev/null && [ "$antes" != "$(git -C "$PUENTE" rev-parse HEAD)" ]; then
        notas+=("el puente se actualizó a lo último de main")
        if ! git -C "$PUENTE" diff --quiet "$antes" HEAD -- bridge/package-lock.json; then
          (cd "$PUENTE/bridge" && npm ci --no-audit --no-fund >/dev/null 2>&1) && notas+=("se reinstalaron las dependencias del puente")
        fi
      fi
    else
      notas+=("⚠️ el repo del puente ($PUENTE) no está limpio en main: revisarlo antes de seguir, no programar ahí")
    fi
  else
    notas+=("sin red: no se pudo revisar GitHub")
  fi
  # 2) Carpeta de trabajo (worktree). Si no existe, se crea.
  [ -d "$REPO" ] || git -C "$PUENTE" worktree add -q --detach "$REPO" origin/main 2>/dev/null
else
  lugar="la laptop (fuera de la oficina)"
fi

# 3) Carpeta de trabajo al día.
git -C "$REPO" fetch -q --prune 2>/dev/null
rama=$(git -C "$REPO" symbolic-ref --short -q HEAD)
if [ -z "$(git -C "$REPO" status --porcelain)" ]; then
  if [ -z "$rama" ]; then git -C "$REPO" checkout -q --detach origin/main 2>/dev/null
  elif git -C "$REPO" rev-parse -q --verify "@{u}" >/dev/null 2>&1; then
    git -C "$REPO" merge -q --ff-only "@{u}" 2>/dev/null || notas+=("⚠️ la rama $rama tiene cambios aquí y en GitHub que no coinciden: hay que unirlos con cuidado (git pull --rebase)")
  fi
else
  notas+=("hay $(git -C "$REPO" status --porcelain | wc -l | tr -d ' ') archivos sin guardar en la carpeta de trabajo")
fi
# Dependencias: npm ci sólo si cambió package-lock.json desde la última instalación.
hash=$(shasum "$REPO/package-lock.json" 2>/dev/null | cut -c1-12)
if [ -n "$hash" ] && [ "$(cat "$REPO/node_modules/.relevo-lock" 2>/dev/null)" != "$hash" ]; then
  (cd "$REPO" && npm ci --no-audit --no-fund >/dev/null 2>&1 && echo "$hash" > node_modules/.relevo-lock) && notas+=("se instalaron las dependencias (npm ci)")
fi

# 4) Trabajo en curso: ramas claude/* con commits que main no tiene.
en_curso=$(git -C "$REPO" for-each-ref --sort=-committerdate --format='%(refname:lstrip=3)|%(committerdate:relative)|%(subject)' 'refs/remotes/origin/claude/*' 2>/dev/null \
  | while IFS='|' read -r r cuando msg; do
      [ "$(git -C "$REPO" rev-list --count "origin/main..origin/$r" 2>/dev/null || echo 0)" -gt 0 ] || continue
      echo "  · $r — último cambio $cuando ($msg)"
    done | head -6)

rama_txt=${rama:-"ninguna (en main, sin rama)"}
echo "[Relevo Acteck] Máquina detectada: $lugar."
echo "Carpeta de trabajo: $REPO · rama actual: $rama_txt."
[ "$MAQUINA" = mini ] && echo "NO programar en $PUENTE (es el puente, siempre en main). Todo cambio de código va en $REPO."
(( ${#notas} )) && echo "Ajustes hechos al abrir: ${(j:; :)notas}."
echo "Ramas con trabajo sin publicar:"
echo "${en_curso:-  (ninguna)}"
echo ""
echo "INSTRUCCIÓN PARA CLAUDE: en tu PRIMERA respuesta de esta sesión, antes de cualquier otra cosa, dile a Fernando en una o dos líneas: «📍 Estás en $lugar. Ya dejé el código al día.» (más los ajustes o avisos de arriba si los hay) y pregúntale con AskUserQuestion: (1) si es correcto que está en $lugar, y (2) en qué tema sigue, ofreciendo como opciones las ramas con trabajo sin publicar y «Tema nuevo». Luego: tema existente → git switch <rama> en $REPO; tema nuevo → git switch -c claude/<tema> origin/main. Nunca trabajar directo en main. Al terminar cada respuesta el trabajo se guarda y sube solo (hook Stop). Para publicar, seguir «Integrar de a una» de CLAUDE.md."
exit 0
