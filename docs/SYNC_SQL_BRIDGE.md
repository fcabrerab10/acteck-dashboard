# Conexión de reportes vía SQL · Puente en la Mac mini (M4)

**Objetivo:** que Ventas (facturación, inventario, precios), Cuotas, Sell Out General y el Master Embarques lleguen a Supabase solos, sin subir Excel en `uploads.html`.

**Cómo funciona:** las vistas de SQL Server viven en la red de la oficina (192.168.0.x) y Supabase no puede entrar a esa red. La Mac mini se queda en la oficina como **puente**: lee las vistas, aplica el mismo mapeo que hoy hace `uploads.html` y escribe **directo en Supabase** (PostgREST con el service role key: upsert, replace por año, `refresh_facturacion_clientes`, refresh de las MVs). Vercel no participa. Si en `.env` no hay service role key, el puente cae al modo de respaldo vía `POST /api/import-central` con `SYNC_SECRET`.

```
SQL 192.168.0.151 (ERP: ventas · inventario · precios) ─┐
SQL 192.168.0.213 · RevkoBi · dbo.BP (cuotas)           ├─▶ Mac mini · bridge/sync.mjs ─▶ Supabase (PostgREST, service role key)
SQL 192.168.0.160 · SELLOUT (sell out general)          │        (launchd 06:30 / 12:30 / 17:30)
Google Sheets · Master Embarques (Drive) ───────────────┘
```

| Fuente | Origen | Tabla destino | Modo | Tarjeta del uploader que reemplaza |
|---|---|---|---|---|
| Ventas | `192.168.0.151` · `Vw_TablaH_Ventas` | `erp_ventas` → `facturacion_clientes` (rebuild) | Replace por año + `refresh_facturacion_clientes` | Actualizaciones ERP · Ventas |
| Inventario | `192.168.0.151` · `Vw_TablaH_Inventario` | `inventario_acteck` | Replace completo | Actualizaciones ERP · Inventario |
| Precios | `192.168.0.151` · `Vw_TablaM_Precios` | `precios_sku` | Replace completo (mes actual) | Actualizaciones ERP · Precios |
| Compras (opcional) | `192.168.0.151` · `Vw_TablaH_Compras` | `compras_oc` | Replace completo | Actualizaciones ERP · POs |
| Cuotas | `192.168.0.213` · base `RevkoBi` · `dbo.BP` | `cuotas_mensuales` | Replace por año presente | Cuotas mensuales |
| Sell Out General | `192.168.0.160` · base `SELLOUT` · vista por confirmar | `sellout_general` | Upsert por `id`, ventana de 45 días | Sellout General (mayoristas) |
| Master Embarques | Google Sheets `1m2I_oTd4EYTQ1v5KQOAZGIPmt58K3jRUbHGk0ed0JoQ` | `embarques_compras`, `programacion_arribos`, `series_generadas`, `proveedores_master`, `catalogo_articulos` | Upsert | Master Embarques |

Todo lo que corre el puente deja rastro en el historial de `uploads.html` (tabla `sync_events`, usuario "Puente SQL (Mac mini)") y actualiza el badge de última actualización (`sync_status`).

**Sobre tener el service role key en la Mac mini:** ese key salta el RLS y puede escribir cualquier tabla, así que la máquina se vuelve tan sensible como tu laptop (que ya lo tiene en `.env.local`). Por eso el Paso 4 incluye `chmod 600`, firewall, FileVault/inicio automático y acceso remoto sólo por Tailscale. Si algún día prefieres que la Mac mini no tenga el key, basta borrar `SUPABASE_SERVICE_ROLE_KEY` de `.env`, poner `SYNC_SECRET` en Vercel y en `.env`, y el puente pasa solo al modo vía Vercel.

---

## Paso 0 · Lo que necesitas tener a la mano

- Por cada servidor SQL: **usuario y contraseña** (idealmente de sólo lectura, script abajo). Bases y objetos ya conocidos: ERP `192.168.0.151` → `Vw_TablaH_Ventas`, `Vw_TablaH_Inventario`, `Vw_TablaM_Precios` (falta el nombre de la base); cuotas `192.168.0.213` → base `RevkoBi`, tabla `dbo.BP`; sell out `192.168.0.160` → base `SELLOUT` (falta el nombre de la vista/tabla; `npm run test-conn` la lista).
- El Google Sheet de Master Embarques: `1m2I_oTd4EYTQ1v5KQOAZGIPmt58K3jRUbHGk0ed0JoQ` (ya en `.env.example`).
- El **service role key** de Supabase (el de `.env.local` de tu laptop) y acceso a la **Mac mini** con un usuario administrador.

## Paso 1 · Usuarios de sólo lectura en SQL Server (pedir a sistemas)

Ejecutar en cada servidor, ajustando base y vistas. Así el puente no puede tocar nada más:

```sql
-- En master
CREATE LOGIN acteck_dashboard_ro WITH PASSWORD = 'contraseña-larga-y-aleatoria', CHECK_POLICY = ON;
-- En la base que contiene las vistas
USE [NombreDeLaBase];
CREATE USER acteck_dashboard_ro FOR LOGIN acteck_dashboard_ro;
GRANT SELECT ON dbo.Vw_TablaH_Ventas     TO acteck_dashboard_ro;
GRANT SELECT ON dbo.Vw_TablaH_Inventario TO acteck_dashboard_ro;
GRANT SELECT ON dbo.Vw_TablaM_Precios    TO acteck_dashboard_ro;
-- 192.168.0.213 · USE [RevkoBi];  GRANT SELECT ON dbo.BP TO acteck_dashboard_ro;
-- 192.168.0.160 · USE [SELLOUT];  GRANT SELECT ON dbo.<VistaSellOut> TO acteck_dashboard_ro;
```

Además, en cada servidor: **TCP/IP habilitado** en SQL Server Configuration Manager (puerto 1433 o el que usen) y regla de firewall de Windows que permita la IP de la Mac mini a ese puerto. Autenticación en modo mixto (SQL + Windows) si el login es de SQL.

Los nombres de columna que espera el puente son los mismos que traían los Excel exportados de esas vistas (`Articulo`, `ClienteNombre`, `MontoVentaPesos`, `VentaId`… para ventas; `articulo`, `No_Almacen`, `inventario`, `disponible`… para inventario; `Lista`, `Moneda`, `Articulo`, `Precio` para precios; `id`, `idcliente`, `fecha`, `sku`, `clientenombre`, `preciounitario`, `importe`… para sell out). La comparación ignora mayúsculas y acentos. Para cuotas (`dbo.BP`), la tabla debe ser **tabular** (una fila por cliente/año/mes); los nombres de columna se configuran en `CUOTAS_COLS` después de verlos con `npm run test-conn`. Si `BP` resulta ser pivot (12 columnas de meses), se ajusta el mapper.

## Paso 2 · Credenciales de Supabase en la Mac mini

El puente escribe directo. En `bridge/.env`:

```
SUPABASE_URL=https://hrhccvuhnedahznewgaj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<el service role key, el mismo de .env.local de la laptop>
```
Se copia a mano en la Mac mini (no por chat ni git). `chmod 600 .env`. Con esto Vercel no necesita ninguna variable nueva.

*Respaldo opcional (modo vía Vercel):* si quitas el key, genera `openssl rand -hex 32`, ponlo como `SYNC_SECRET` en Vercel (24+ caracteres, redeploy) y en `.env`; el puente detecta la ausencia del key y usa `/api/import-central`.

## Paso 3 · Google Sheet de Master Embarques

Dos opciones. La **A** es la recomendada porque la hoja no queda pública.

**A) Service account (privado)**
1. En Google Cloud Console (cualquier proyecto, puede ser nuevo): **APIs y servicios → Habilitar** *Google Sheets API*.
2. **IAM → Cuentas de servicio → Crear** (ej. `acteck-sync`). Sin roles de proyecto. Crear **clave JSON** y descargarla.
3. Copiar el JSON a la Mac mini como `bridge/google-sa.json` (`chmod 600`). Está en `.gitignore`.
4. En el Google Sheet: **Compartir → agregar el correo del service account** (`acteck-sync@…iam.gserviceaccount.com`) como **Lector**.
5. En `.env`: `MASTER_EMBARQUES_SHEET_ID=<id>` y `GOOGLE_SERVICE_ACCOUNT_FILE=./google-sa.json`.

**B) Enlace público (rápido)**
1. Compartir la hoja como "Cualquier persona con el enlace · Lector".
2. En `.env` sólo `MASTER_EMBARQUES_SHEET_ID=<id>` (dejar `GOOGLE_SERVICE_ACCOUNT_FILE` vacío o el archivo inexistente).
3. Con esta opción también puedes activar el cron de Vercel (`MASTER_EMBARQUES_SHEET_ID` + `CRON_SECRET` en Vercel) como respaldo si la Mac mini está apagada: hace lo mismo para `embarques_compras`.

Pestañas que se leen: `2026`, `2025`, `2024`, `2022 - 2023` (histórico → `embarques_compras`), `Programación Arribos`, `SN`, `Proveedores`. Las que no existan se omiten.

## Paso 4 · Preparar la Mac mini como puente

Estas configuraciones hacen que la máquina siga corriendo sola en la oficina.

**4.1 Energía y arranque** (Terminal, una vez):
```bash
sudo pmset -a sleep 0 disksleep 0 displaysleep 10 womp 1 autorestart 1 powernap 0
```
`sleep 0` = nunca duerme · `womp` = despierta por red · `autorestart` = reinicia tras corte de luz. En **Configuración → General → Inicio de sesión**: activar **inicio de sesión automático** para el usuario que correrá el puente (los agentes de launchd corren cuando ese usuario tiene sesión). FileVault debe estar **apagado** para que el inicio automático funcione tras un reinicio; si Sistemas exige FileVault, decirlo y cambiamos los agentes a *LaunchDaemons* (corren sin sesión).

**4.2 Red**: IP fija o reserva DHCP para la Mac mini (ej. `192.168.0.50`) para que las reglas de firewall de los servidores apunten siempre a la misma IP. Probar que llega a cada servidor:
```bash
nc -vz 192.168.0.151 1433
nc -vz 192.168.0.213 1433
nc -vz 192.168.0.160 1433
```
Si alguno no responde, es firewall o TCP/IP deshabilitado en ese SQL Server (Paso 1).

**4.3 Herramientas**:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"   # si no hay Homebrew
brew install node@22 git
echo 'export PATH="/opt/homebrew/opt/node@22/bin:$PATH"' >> ~/.zprofile && source ~/.zprofile
node -v    # v22.x
```
No hace falta ODBC ni drivers de Microsoft: el driver (`mssql`/tedious) es JavaScript puro.

**4.4 Repo y dependencias**:
```bash
mkdir -p ~/acteck && cd ~/acteck
git clone https://github.com/fcabrerab10/acteck-dashboard.git
cd acteck-dashboard/bridge
npm ci
cp .env.example .env && chmod 600 .env
open -e .env      # service role key, usuarios/contraseñas SQL, base del ERP, vista de sell out
```
La Mac mini sólo necesita la carpeta `bridge/` y `api/_embarques.js` del repo (se importa desde ahí); no hay que hacer `npm install` en la raíz.

**4.5 Acceso remoto (para no ir a la oficina)**: activar **Compartir pantalla** y **Sesión remota (SSH)** en Configuración → General → Compartir. Para entrar desde fuera de la oficina, instalar **Tailscale** en la Mac mini y en tu laptop; no abre puertos en el router.

**4.6 Seguridad**: firewall de macOS activado, sin abrir puertos entrantes salvo SSH/Screen Sharing; `.env` y `google-sa.json` con `chmod 600`; el usuario SQL es de sólo lectura; el puente sólo puede escribir en las tablas de la whitelist de `import-central`.

## Paso 5 · Probar

```bash
cd ~/acteck/acteck-dashboard/bridge
npm run test-conn                      # conexión a cada SQL, columnas de cada vista (o lista de tablas si falta la vista), Sheet y key de Supabase
node --env-file=.env sync.mjs inventario --dry-run          # lee y mapea, no sube nada
node --env-file=.env sync.mjs ventas --top 2000 --dry-run   # muestra de 2,000 renglones
node --env-file=.env sync.mjs inventario precios            # primera carga real (ligera)
node --env-file=.env sync.mjs ventas                        # ~176K filas: 2-4 min; reconstruye facturacion_clientes
node --env-file=.env sync.mjs cuotas sellout embarques
```
Validar en el dashboard: Sell In (facturación del mes vs. lo que ya tenías), Inventario, Precios, Cuotas en S&OP, Sell Out General y Embarques. En `uploads.html` cada tarjeta muestra el evento "Puente SQL (Mac mini)" en su historial.

Nota sobre ventas: el replace es **por año** (`ERP_VENTAS_ANIOS`, vacío = año actual). Una vez cargado 2025 completo no hace falta repetirlo a diario; deja sólo el año en curso. En enero, poner `2025,2026` un par de semanas para cerrar diciembre.

## Paso 6 · Programar (launchd)

```bash
cd ~/acteck/acteck-dashboard/bridge
./launchd/install.sh
```
Instala dos agentes para el usuario actual:

| Agente | Horario | Corre |
|---|---|---|
| `com.acteck.sync.diario` | 06:30 | `all` (ventas + rebuild, inventario, precios, compras si aplica, cuotas, sellout, embarques) |
| `com.acteck.sync.intradia` | 12:30 y 17:30 | inventario, precios, sellout, embarques |

Cambiar horarios: editar `bridge/launchd/*.plist` y volver a correr `install.sh`. Si la Mac mini estaba apagada a la hora programada, launchd corre la tarea al encender.

Comandos útiles:
```bash
launchctl kickstart -k gui/$(id -u)/com.acteck.sync.intradia   # correr ahora
tail -f logs/sync-$(date +%Y-%m-%d).log                          # ver la corrida
launchctl list | grep com.acteck.sync                            # estado (0 = última salida OK)
./launchd/uninstall.sh                                           # quitar
```
Los logs viven en `bridge/logs/` y se conservan 60 días.

## Paso 7 · Retirar las cargas manuales

Cuando dos semanas de corridas cuadren, en `uploads.html` las tarjetas Ventas/Inventario/Precios, Cuotas, Sellout General y Master Embarques pasan a ser respaldo manual (siguen funcionando). Digitalife, PCEL, Dicotech, estados de cuenta y P&L siguen por archivo.

## Actualizar el puente

```bash
cd ~/acteck/acteck-dashboard && git pull --rebase && cd bridge && npm ci
```
No hay que reinstalar los agentes salvo que cambien los plists.

## Problemas comunes

| Síntoma | Causa · solución |
|---|---|
| `ECONNREFUSED`/`ETIMEDOUT` al SQL | Firewall del servidor o TCP/IP apagado. Probar `nc -vz host 1433`. |
| `Login failed for user` | Usuario/contraseña, o autenticación mixta deshabilitada en ese SQL Server. |
| `self signed certificate` | Dejar `SQL_ENCRYPT=false` y `SQL_TRUST_CERT=true` (on-prem). |
| `falta la columna` / 0 filas válidas | La vista no trae la columna con ese nombre. `npm run test-conn` imprime las columnas reales; ajustar la vista o avisar para ajustar el mapper. |
| `HTTP 401` de Supabase | Service role key mal copiado (debe ser el `service_role`, no el `anon`). |
| `HTTP 401`/`403` del dashboard (modo Vercel) | `SYNC_SECRET` distinto entre Vercel y `.env`, o no se hizo redeploy. |
| `HTTP 413` (modo Vercel) | Chunk demasiado grande (límite 4 MB). Bajar `chunk` en `lib/api.mjs`. |
| Sheet devuelve `null` | Pestaña inexistente o sin permiso: compartir al service account (A) o como enlace público (B). |
| Agente no corre | `launchctl list | grep acteck`; revisar `logs/launchd-*.err.log`; verificar inicio de sesión automático y `pmset`. |

## Archivos

- `bridge/sync.mjs` — CLI y definición de fuentes · `bridge/lib/mappers.mjs` — mapeo SQL → Supabase (espejo de `uploads.html`) · `bridge/lib/mssql.mjs` — lectura por streaming · `bridge/lib/sheets.mjs` — Google Sheets (service account o CSV) · `bridge/lib/api.mjs` — escritura a Supabase (directo por PostgREST, o vía `/api/import-central` como respaldo).
- `api/_embarques.js` — transformaciones del Master Embarques compartidas por `api/cron.js` y el puente.
- `api/_auth.js` → `isSyncRequest()` · `api/import-central.js` → acepta `x-sync-secret` y registra `syncEvent`.
