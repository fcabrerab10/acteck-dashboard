#!/bin/zsh
# Verificación de producción tras un push a main.
#   scripts/verificar-produccion.sh <version esperada> [vista ...]
# 1) espera a que Vercel sirva la versión (hasta 6 min; si no cambia, avisa: relanzar con push vacío)
# 2) comprueba que las rutas API respondan (401/405, nunca 500)
# 3) consulta cada vista indicada por REST con la anon key (< 1.5 s)
set -u
cd "$(dirname "$0")/.." || exit 1
set -a; source .env.local; set +a
ESPERADA="$1"; shift
URL="https://acteck-dashboard.vercel.app"
ok=0
for i in $(seq 1 12); do
  f=$(curl -s "$URL/" | grep -o '/assets/index-[^"]*\.js' | head -1)
  v=$(curl -s "$URL$f" | grep -o '"[0-9]\+\.[0-9]\+\.[0-9]\+"' | head -1 | tr -d '"')
  echo "  intento $i · producción sirve $v"
  if [ "$v" = "$ESPERADA" ]; then ok=1; break; fi
  sleep 30
done
[ $ok = 1 ] || { echo "✖ Vercel no sirvió $ESPERADA en 6 min: revisa el deploy o relanza con 'git commit --allow-empty' + push"; exit 2; }
echo "✓ producción en $ESPERADA"
for r in "/api/cron?task=nada" "/api/admin/sync" "/api/google-calendar?action=events"; do
  c=$(curl -s -o /dev/null -w "%{http_code}" "$URL$r")
  case "$c" in 401|403|405|400|503) echo "  $r → $c ok";; *) echo "✖ $r → $c"; exit 3;; esac
done
for vista in "$@"; do
  t=$(curl -s -o /dev/null -w "%{http_code} %{time_total}" "$VITE_SUPABASE_URL/rest/v1/$vista?limit=2" -H "apikey: $VITE_SUPABASE_ANON_KEY")
  echo "  vista $vista → $t"
  case "$t" in 200*) ;; *) echo "✖ vista $vista no responde"; exit 4;; esac
done
echo "✓ todo bien"
