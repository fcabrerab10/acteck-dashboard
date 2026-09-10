# Conexión de reportes vía SQL · Puente en la Mac mini (M4)

**Objetivo:** que Ventas (facturación, inventario, precios), Cuotas, Sell Out General y el Master Embarques lleguen a Supabase solos, sin subir Excel en `uploads.html`.

**Cómo funciona:** las vistas de SQL Server viven en la red de la oficina (192.168.0.x) y Supabase no puede entrar a esa red. La Mac mini se queda en la oficina como **puente**: lee las vistas, aplica el mismo mapeo que hoy hace `uploads.html` y escribe **directo en Supabase** (PostgREST con el service role key: upsert, replace por año, `refresh_facturacion_clientes`, refresh de las MVs). Vercel no participa. Si en `.env` no hay service role key, el puente cae al modo de respaldo vía `POST /api/import-central` con `SYNC_SECRET`.

```
SQL 192.168.0.151 (ERP: ventas · inventario · precios) ─┐
SQL 192.168.0.213 · RevkoBi · dbo.BP (cuotas)           ├─▶ Mac mini · bridge/sync.mjs ─▶ Supabase (PostgREST, service role key)
SQL 192.168.0.160 · SELLOUT (sell out general)          │        (launchd 06:30 + cada hora 8-19)
Google Sheets · Master Embarques (Drive) ───────────────┘
```

| Fuente | Origen | Tabla destino | Modo | Tarjeta del uploader que reemplaza |
|---|---|---|---|---|
| Ventas | `192.168.0.151` · `Vw_TablaH_Ventas` | `erp_ventas` → `facturacion_clientes` (rebuild) | Replace por año + `refresh_facturacion_clientes` | Actualizaciones ERP · Ventas |
| Inventario | `192.168.0.151` · `Vw_TablaH_Inventario` | `inventario_acteck` | Replace completo | Actualizaciones ERP · Inventario |
| Precios | `192.168.0.151` · `Vw_TablaM_Precios` | `precios_sku` | Replace completo (mes actual) | Actualizaciones ERP · Precios |
| Compras (opcional) | `192.168.0.151` · `Vw_TablaH_Compras` | `compras_oc` | Replace completo | Actualizaciones ERP · POs |
| Cuotas | `192.168.0.213` · base `RevkoBi` · `dbo.BP` | `cuotas_mensuales` | Replace por año presente | Suma por cliente (IDCLIENTE de 5 dígitos) y mes: CUOTAMINIMA → `cuota_min` (mide vendedores), IMPORTEDEVENTA → `cuota_ideal` (cuota vendor, meta del dashboard) |
| Sell Out General | `192.168.0.160` · base `SELLOUT` · vista `sell out` | `sellout_general` | Upsert por `id`, ventana de 45 días | Sellout General (mayoristas) |
| Master Embarques | Google Sheets `1m2I_oTd4EYTQ1v5KQOAZGIPmt58K3jRUbHGk0ed0JoQ` | `embarques_compras`, `programacion_arribos`, `series_generadas`, `proveedores_master`, `catalogo_articulos` | Upsert | Master Embarques |

Todo lo que corre el puente deja rastro en el historial de `uploads.html` (tabla `sync_events`, usuario "Puente SQL (Mac mini)") y actualiza el badge de última actualización (`sync_status`).

**Sobre tener el service role key en la Mac mini:** ese key salta el RLS y puede escribir cualquier tabla, así que la máquina se vuelve tan sensible como tu laptop (que ya lo tiene en `.env.local`). Por eso el Paso 4 incluye `chmod 600`, firewall, FileVault/inicio automático y acceso remoto sólo por Tailscale. Si algún día prefieres que la Mac mini no tenga el key, basta borrar `SUPABASE_SERVICE_ROLE_KEY` de `credenciales.env`, poner `SYNC_SECRET` en Vercel y en `credenciales.env`, y el puente pasa solo al modo vía Vercel.

---

## Paso 0 · Lo que necesitas tener a la mano

- Por cada servidor SQL: **usuario y contraseña** (idealmente de sólo lectura, script abajo). Bases y objetos ya conocidos: ERP `192.168.0.151` → `Vw_TablaH_Ventas`, `Vw_TablaH_Inventario`, `Vw_TablaM_Precios` (falta el nombre de la base); cuotas `192.168.0.213` → base `RevkoBi`, tabla `dbo.BP`; sell out `192.168.0.160` → base `SELLOUT`, vista `sell out`.
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
-- 192.168.0.160 · USE [SELLOUT];  GRANT SELECT ON dbo.[sell out] TO acteck_dashboard_ro;
```

Además, en cada servidor: **TCP/IP habilitado** en SQL Server Configuration Manager (puerto 1433 o el que usen) y regla de firewall de Windows que permita la IP de la Mac mini a ese puerto. Autenticación en modo mixto (SQL + Windows) si el login es de SQL.

Los nombres de columna que espera el puente son los mismos que traían los Excel exportados de esas vistas (`Articulo`, `ClienteNombre`, `MontoVentaPesos`, `VentaId`… para ventas; `articulo`, `No_Almacen`, `inventario`, `disponible`… para inventario; `Lista`, `Moneda`, `Articulo`, `Precio` para precios; `id`, `idcliente`, `fecha`, `sku`, `clientenombre`, `preciounitario`, `importe`… para sell out). La comparación ignora mayúsculas y acentos. Para cuotas (`dbo.BP`), la tabla debe ser **tabular** (una fila por cliente/año/mes); los nombres de columna se configuran en `CUOTAS_COLS` después de verlos con `npm run test-conn`. Si `BP` resulta ser pivot (12 columnas de meses), se ajusta el mapper.

## Paso 2 · Credenciales de Supabase en la Mac mini

El puente escribe directo. En `bridge/.env`:

```
SUPABASE_URL=https://hrhccvuhnedahznewgaj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<el service role key, el mismo de .env.local de la laptop>
```
Van en `bridge/credenciales.env` (lo crea `setup.sh`). Se copia a mano en la Mac mini, no por chat ni git. Con esto Vercel no necesita ninguna variable nueva.

*Respaldo opcional (modo vía Vercel):* si quitas el key, genera `openssl rand -hex 32`, ponlo como `SYNC_SECRET` en Vercel (24+ caracteres, redeploy) y en `credenciales.env`; el puente detecta la ausencia del key y usa `/api/import-central`.

## Paso 3 · Google Sheet de Master Embarques

Dos opciones. La **A** es la recomendada porque la hoja no queda pública.

**A) Service account (privado)**
1. En Google Cloud Console (cualquier proyecto, puede ser nuevo): **APIs y servicios → Habilitar** *Google Sheets API*.
2. **IAM → Cuentas de servicio → Crear** (ej. `acteck-sync`). Sin roles de proyecto. Crear **clave JSON** y descargarla.
3. Copiar el JSON a la Mac mini como `bridge/google-sa.json` (`chmod 600`). Está en `.gitignore`.
4. En el Google Sheet: **Compartir → agregar el correo del service account** (`acteck-sync@…iam.gserviceaccount.com`) como **Lector**.
5. En `credenciales.env`: `MASTER_EMBARQUES_SHEET_ID=<id>` y `GOOGLE_SERVICE_ACCOUNT_FILE=./google-sa.json`.

**B) Enlace público (rápido)**
1. Compartir la hoja como "Cualquier persona con el enlace · Lector".
2. En `credenciales.env` sólo `MASTER_EMBARQUES_SHEET_ID=<id>` (dejar `GOOGLE_SERVICE_ACCOUNT_FILE` vacío o el archivo inexistente).
3. Con esta opción también puedes activar el cron de Vercel (`MASTER_EMBARQUES_SHEET_ID` + `CRON_SECRET` en Vercel) como respaldo si la Mac mini está apagada: hace lo mismo para `embarques_compras`.

**C) Desde Claude con el conector de Drive (sin credenciales en la Mac mini)**
Claude baja el Sheet como `.xlsx` con el conector de Google Drive y corre `bridge/embarques-xlsx.mjs "Master Embarques.xlsx"`, que aplica las mismas transformaciones y escribe en Supabase. Para que corra solo (Routine diaria) el entorno cloud de Claude Code necesita `SUPABASE_SERVICE_ROLE_KEY` como variable de entorno. Verificado el 2026-09-09 con el archivo real: 3,964 embarques (2026: 895 · 2025: 1,045 · 2024: 1,001 · 2022-2023: 1,023), 236 arribos, 951 SN, 58 proveedores, 9,492 artículos.

Pestañas que se leen: `2026`, `2025`, `2024`, `2022 - 2023` (histórico → `embarques_compras`), `Programación Arribos`, `SN`, `Proveedores`. Las que no existan se omiten. Diferencias reales entre pestañas ya contempladas: 2026 usa "CBM TOTAL" y fechas de emisión en español sin año (se toma el año de la pestaña); 2022-2023 usa "FECHA DE EMISIÓN", "REF FFW" y "ETA ALMACÉN"; en 2024 un complemento de códigos QR sobrescribió los encabezados de las columnas A-F (PO sigue en la columna A); "Proveedores" tiene la fila 1 vacía.

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

**4.4 Repo y credenciales** — un solo comando deja todo en su lugar y abre el archivo donde van usuarios y contraseñas (`bridge/credenciales.env`, nunca se sube al repo):
```bash
git clone https://github.com/fcabrerab10/acteck-dashboard.git ~/acteck/acteck-dashboard
cd ~/acteck/acteck-dashboard/bridge
./setup.sh        # instala Homebrew/Node si faltan, dependencias, crea y abre credenciales.env
```
(`setup.sh` cubre también el punto 4.3; si ya hay Node 22 sólo instala dependencias.)
Líneas a llenar en `credenciales.env`:
```
SUPABASE_SERVICE_ROLE_KEY=…        # el de .env.local de la laptop
ERP_SQL_DB=…  ERP_SQL_USER=…  ERP_SQL_PASS=…            # 192.168.0.151 (falta el nombre de la base)
CUOTAS_SQL_USER=…  CUOTAS_SQL_PASS=…                    # 192.168.0.213 · RevkoBi · dbo.BP ya puestos
SELLOUT_SQL_USER=…  SELLOUT_SQL_PASS=…                  # 192.168.0.160 · SELLOUT · vista "sell out" ya puestos
```
Si los tres servidores comparten usuario, se repite el mismo en los tres bloques.
La Mac mini sólo usa la carpeta `bridge/` y `api/_embarques.js` del repo; no hay que hacer `npm install` en la raíz. Para volver a abrir el archivo de credenciales: `open -e ~/acteck/acteck-dashboard/bridge/credenciales.env`.

**4.5 Acceso remoto (para no ir a la oficina)**: activar **Compartir pantalla** y **Sesión remota (SSH)** en Configuración → General → Compartir. Para entrar desde fuera de la oficina, instalar **Tailscale** en la Mac mini y en tu laptop; no abre puertos en el router.

**4.6 Seguridad**: firewall de macOS activado, sin abrir puertos entrantes salvo SSH/Screen Sharing; `credenciales.env` y `google-sa.json` con `chmod 600`; el usuario SQL es de sólo lectura; el puente sólo puede escribir en las tablas de la whitelist de `import-central`.

## Paso 5 · Probar

```bash
cd ~/acteck/acteck-dashboard/bridge
npm run test-conn                      # conexión a cada SQL, columnas de cada vista (o lista de tablas si falta la vista), Sheet y key de Supabase
npm run sync -- inventario --dry-run          # lee y mapea, no sube nada
npm run sync -- ventas --top 2000 --dry-run   # muestra de 2,000 renglones
npm run sync -- inventario precios            # primera carga real (ligera)
npm run sync -- ventas                        # ~176K filas: 2-4 min; reconstruye facturacion_clientes
npm run sync -- cuotas sellout embarques
```
Validar en el dashboard: Sell In (facturación del mes vs. lo que ya tenías), Inventario, Precios, Cuotas en S&OP, Sell Out General y Embarques. En `uploads.html` cada tarjeta muestra el evento "Puente SQL (Mac mini)" en su historial.

Nota sobre ventas: por default cada corrida es una **ventana de 45 días** (`ERP_VENTAS_DIAS`, filtro por `periodo`; se borra la ventana en Supabase y se reinserta) y luego recalcula `facturacion_clientes` del año. La carga completa de un año se pide explícitamente: `./run.sh ventas --anios 2026`. Nota anterior: el replace era **por año** (`ERP_VENTAS_ANIOS`, vacío = año actual). Una vez cargado 2025 completo no hace falta repetirlo a diario; deja sólo el año en curso. En enero, poner `2025,2026` un par de semanas para cerrar diciembre.

## Paso 6 · Programar (launchd)

```bash
cd ~/acteck/acteck-dashboard/bridge
./launchd/install.sh
```
Instala tres agentes para el usuario actual:

| Agente | Horario | Corre |
|---|---|---|
| `com.acteck.sync.diario` | 06:30 todos los días | ventas + rebuild, inventario, precios, cuotas, sellout (embarques lo carga la tarea diaria de Claude, ver abajo) |
| `com.acteck.sync.intradia` | cada hora 8:00–19:00, lunes a sábado | ventas + rebuild, inventario, precios |
| `com.acteck.sync.solicitudes` | cada 5 minutos (desde 2026-09-11) | `sync.mjs solicitudes`: atiende la cola `sync_solicitudes` ("Pedir corrida ▾" en Configuración → Actualización de datos) y deja el **latido** del puente |

**Latido y solicitudes (2026-09-11).** Cada invocación de `sync.mjs` (cualquier comando, salvo `--dry-run`) upserta `sync_status.fuente = 'puente'` con `ultima_actualizacion = now()` y `meta { version, node, agentes, comando }`. La página Actualización de datos lo lee por `/api/status?type=sync` y muestra "puente en línea · último latido hace N min"; sin latido en 20 min marca "Puente sin señal". La cola `sync_solicitudes` (migración `supabase/migrations/20260911_sync_solicitudes.sql`; RLS: sólo super admin inserta/lee, el puente escribe con service role) se atiende así: toma las `pendiente` más viejas primero → `en_proceso` → corre la fuente (`ventas | inventario | precios | cuotas | sellout | embarques | all`) → `hecha` o `error` con `resultado { filas, duracion_ms, fuentes[], mensaje? }` y `atendida_at`. Si dos solicitudes piden lo mismo, la fuente corre una sola vez.

**Qué hacer en la Mac mini para activarlo** (una vez):
```bash
cd ~/acteck/acteck-dashboard && git pull --rebase && cd bridge && npm ci
./launchd/install.sh          # reinstala diario + intradia e instala solicitudes
launchctl list | grep com.acteck.sync   # deben aparecer los 3
tail -f logs/sync-$(date +%Y-%m-%d).log # cada 5 min: "▸ solicitudes: ninguna pendiente"
```

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

Hecho el 2026-09-11: Configuración → Actualización de datos es el importador central (kit V3): cargas automáticas del puente arriba (con latido, "Pedir corrida ▾" y log) y cargas manuales por grupo abajo (Roadmap, P&L, Sellout Revko, Digitalife, PCEL, Dicotech, estados de cuenta) con anillo de frescura por cadencia. Parsers en `src/lib/parsers/`. En `uploads.html` se retiró la tarjeta "ERP Acteck" (streaming de Vw_TablaH_Ventas); Cuotas y Master Embarques sólo se ven con `?fuente=cuotas-anuales` / `?fuente=master-embarques` (enlace "Subir a mano" en la fila automática) o `?todas=1`. `uploads.html` sigue funcionando como respaldo técnico.

## Actualizar el puente

```bash
cd ~/acteck/acteck-dashboard && git pull --rebase && cd bridge && npm ci
```
No hay que reinstalar los agentes salvo que cambien los plists (`./launchd/install.sh`). **2026-09-11: sí hay que reinstalar** para que aparezca `com.acteck.sync.solicitudes` (latido + "Pedir corrida").

## Problemas comunes

| Síntoma | Causa · solución |
|---|---|
| `ECONNREFUSED`/`ETIMEDOUT` al SQL | Firewall del servidor o TCP/IP apagado. Probar `nc -vz host 1433`. |
| `Login failed for user` | Usuario/contraseña, o autenticación mixta deshabilitada en ese SQL Server. |
| `self signed certificate` | Dejar `SQL_ENCRYPT=false` y `SQL_TRUST_CERT=true` (on-prem). |
| `falta la columna` / 0 filas válidas | La vista no trae la columna con ese nombre. `npm run test-conn` imprime las columnas reales; ajustar la vista o avisar para ajustar el mapper. |
| `HTTP 401` de Supabase | Service role key mal copiado (debe ser el `service_role`, no el `anon`). |
| `HTTP 401`/`403` del dashboard (modo Vercel) | `SYNC_SECRET` distinto entre Vercel y `credenciales.env`, o no se hizo redeploy. |
| `HTTP 413` (modo Vercel) | Chunk demasiado grande (límite 4 MB). Bajar `chunk` en `lib/api.mjs`. |
| Sheet devuelve `null` | Pestaña inexistente o sin permiso: compartir al service account (A) o como enlace público (B). |
| Agente no corre | `launchctl list | grep acteck`; revisar `logs/launchd-*.err.log`; verificar inicio de sesión automático y `pmset`. |

## Archivos

- `bridge/sync.mjs` — CLI y definición de fuentes · `bridge/lib/mappers.mjs` — mapeo SQL → Supabase (espejo de `uploads.html`) · `bridge/lib/mssql.mjs` — lectura por streaming · `bridge/lib/sheets.mjs` — Google Sheets (service account o CSV) · `bridge/lib/api.mjs` — escritura a Supabase (directo por PostgREST, o vía `/api/import-central` como respaldo).
- `api/_embarques.js` — transformaciones del Master Embarques compartidas por `api/cron.js` y el puente.
- `api/_auth.js` → `isSyncRequest()` · `api/import-central.js` → acepta `x-sync-secret` y registra `syncEvent`.

## Checklist de puesta en marcha (2026-09-09)

Lo que ya quedó en la Mac de Fernando y lo que falta para que todo corra solo:

| Pieza | Estado | Qué falta |
|---|---|---|
| Repo en `~/acteck/acteck-dashboard` (symlink en `~/Documents/Acteck`) | listo | nada. Se movió fuera de `~/Documents` porque launchd no puede leer esa carpeta (TCC) |
| `bridge/credenciales.env` | lleno | nada |
| launchd `com.acteck.sync.diario` (06:30) y `com.acteck.sync.intradia` (8–19 h L-S) | instalados y probados | nada; la Mac debe quedarse encendida (paso 4.1) |
| Ventas ERP → `erp_ventas` + rebuild `facturacion_clientes` | carga OK, rebuild se cancela por timeout | correr `supabase/migrations/20260909_bridge_statement_timeout.sql` en el SQL Editor |
| Cuotas, inventario, precios, sell out | cargados | nada |
| Master Embarques → tarea diaria de Claude (07:00) | creada; permisos del conector de Drive y del script ya autorizados | dar "Run now" una vez para confirmar; la app de Claude debe estar abierta |
| Sección "Cargas automáticas" en Actualización de datos | en la rama | mergear a `main` (Vercel despliega solo) |

La tarea diaria de Claude corre `bridge/embarques-drive.sh <json del conector>`, que decodifica el xlsx y llama a `embarques-xlsx.mjs`; deja rastro en `logs/sync-<fecha>.log` y en `sync_events` como el resto del puente.
