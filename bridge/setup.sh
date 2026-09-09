#!/bin/zsh
# Preparación de la Mac mini en un solo paso. Correr desde Terminal:
#   cd ~/acteck/acteck-dashboard/bridge && ./setup.sh
# Instala Homebrew/Node si faltan, dependencias, crea credenciales.env y lo abre.
set -e
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/node@22/bin:/usr/local/bin:$PATH"

if ! command -v brew >/dev/null 2>&1; then
  echo "▸ Instalando Homebrew…"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  eval "$(/opt/homebrew/bin/brew shellenv)"
fi
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -c2-3)" -lt 22 ]; then
  echo "▸ Instalando Node 22…"
  brew install node@22
  grep -q 'node@22' ~/.zprofile 2>/dev/null || echo 'export PATH="/opt/homebrew/opt/node@22/bin:$PATH"' >> ~/.zprofile
  export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
fi
echo "▸ Node $(node -v)"

echo "▸ Instalando dependencias del puente…"
npm ci --no-audit --no-fund >/dev/null

if [ ! -f credenciales.env ]; then
  cp credenciales.ejemplo.env credenciales.env
fi
chmod 600 credenciales.env
mkdir -p logs

echo
echo "✓ Listo. Se abre credenciales.env: llena las líneas vacías y guarda."
echo "  Después:  npm run test-conn"
echo "            npm run dry            (lee todo sin subir nada)"
echo "            ./launchd/install.sh   (programa 06:30 / 12:30 / 17:30)"
open -e credenciales.env 2>/dev/null || true
