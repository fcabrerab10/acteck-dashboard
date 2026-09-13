# `guias_erp` al puente SQL — investigación y pasos (2026-09-12)

**Estado hoy:** `guias_erp` tiene **13,248 filas** y su última carga es del **2026-08-10**. Se sube
a mano desde `public/uploads.html` (hoja "Guias" del Excel *Actualizaciones ERP*). Es la **única
tabla del ERP que sigue siendo manual**: ventas, inventario, precios, compras y cuotas ya las trae
el puente de la Mac mini (`bridge/`).

**Qué se desbloquea al pasarla al puente:** el tiempo de entrega real por paquetería en Tracking
Pedidos (Estafeta ≈ 3.0 d, Almex ≈ 8.9 d, flota Acteck mismo día) y las guías automáticas por
factura, que hoy se congelaron en agosto. La RPC `oc_sincronizar_erp()` (migración
`20260911_tracking_v3.sql`) ya liga `guias_erp` → `oc_envios` sola: en cuanto la tabla se actualice,
Tracking Pedidos se pone al día sin tocar una línea de código de la app.

**No se modificó nada de `bridge/` en este trabajo.** Este documento es la preparación: qué columnas
hacen falta, el SQL propuesto y los pasos exactos que tiene que hacer Fernando en la Mac mini.

---

## 1. Lo que falta para poder hacerlo

La vista del ERP no está identificada. `bridge/credenciales.ejemplo.env` tiene una variable por
fuente (`ERP_VIEW_VENTAS`, `ERP_VIEW_INVENTARIO`, `ERP_VIEW_PRECIOS`, `ERP_VIEW_COMPRAS`) y **no hay
ninguna para guías**. El Excel manual sale del reporte del ERP llamado *"Consulta de Guías por
Factura"* / *"Reporte Guías x Factura"*, así que casi seguro existe una vista `Vw_TablaH_...` detrás,
pero hay que confirmar su nombre en `192.168.0.151`. Ése es el **único bloqueo**.

---

## 2. Columnas que espera el destino

El parser vive en `public/uploads.html` → `guiasErp(wb)` (≈ línea 2336). Lee la hoja cuyo nombre
contenga "guia" (sin acentos, insensible a mayúsculas) o, si no, la primera hoja con una columna
`Movid`. **Descarta la fila si falta `Mov` o `Movid`.** Las fechas se convierten a ISO con hora.

Tabla `public.guias_erp` · unique key **`(mov, movid)`** (`guias_erp_mov_movid_key`), que es la misma
que ya usa `api/import-central.js` (`guias_erp: 'mov,movid'`). Un mismo `Movid` puede aparecer dos
veces: una como `Factura` y otra como `Remision` (hoy: 5,800 facturas y 7,448 remisiones).

| Columna Excel / vista | Columna en `guias_erp` | Tipo | Nota |
|---|---|---|---|
| `Origen` | `origen` | text | |
| `Origenid` | `origen_id` | text | |
| `Estatus` | `estatus` | text | |
| `FechaEmision` | `fecha_emision` | timestamptz | ISO con hora |
| `agente` | `agente` | text | 99.9 % lleno |
| `NombreAgente` | `nombre_agente` | text | |
| `AlmacenEnvio` | `almacen_envio` | text | se mapea a `almacenes_config.cedis` en Tracking |
| `GrupoEnvio` | `grupo_envio` | text | |
| `cliente` | `cliente_codigo` | text | código de 5 dígitos del ERP |
| `Nombre` | `cliente_nombre` | text | de aquí sale `cliente_key` en las vistas |
| `Sector` | `sector` | text | 100 % |
| `Destino` | `destino` | integer | **entero**, no texto |
| `estado` | `estado` | text | |
| `DestinoEstado` | `destino_estado` | text | 86.5 % |
| `OrdenCompra` | `orden_compra` | text | liga por OC en `oc_sincronizar_erp()` |
| `Referencia` | `referencia` | text | |
| `Envio` | `envio` | text | |
| `EnvioId` | `envio_id` | text | |
| `Mov` | `mov` | text | **obligatorio** · `Factura` / `Remision` |
| `Movid` | `movid` | text | **obligatorio** · liga con `oc_envios.numero_factura` |
| `EnvioEstatus` | `envio_estatus` | text | |
| `EnvioFecha` | `envio_fecha` | timestamptz | |
| `Formaenvio` | `forma_envio` | text | paquetería (32.6 % lleno) |
| `fechaEnvio` | `fecha_envio` | timestamptz | |
| `PersonaRecibio` | `persona_recibio` | text | |
| `FechaRecepcion` | `fecha_recepcion` | timestamptz | con ésta se mide el tiempo de entrega |
| `guias` | `guias` | text | números de guía; los saltos de línea se colapsan a espacio |

`created_at` / `updated_at` los pone Supabase.

---

## 3. Cómo encontrar la vista en el ERP (T‑SQL para Fernando)

Conéctate a `192.168.0.151` (misma base que usan `Vw_TablaH_Ventas` / `Vw_TablaH_Inventario`) con
SSMS o Azure Data Studio y corre esto **tal cual**:

```sql
-- 3.1 · Vistas cuyo NOMBRE suene a guías / envíos / embarques
SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.VIEWS
WHERE TABLE_NAME LIKE '%Guia%'
   OR TABLE_NAME LIKE '%Guía%'
   OR TABLE_NAME LIKE '%Envio%'
   OR TABLE_NAME LIKE '%Embarque%'
   OR TABLE_NAME LIKE '%Paqueter%'
ORDER BY TABLE_NAME;
```

Si eso no devuelve nada, la búsqueda buena es **por columnas** (el nombre de la vista puede ser
cualquier cosa, pero las columnas son las del reporte):

```sql
-- 3.2 · Vistas que tengan a la vez Movid y guias (o PersonaRecibio) — es la firma del reporte
SELECT c.TABLE_SCHEMA, c.TABLE_NAME, COUNT(*) AS columnas_clave
FROM INFORMATION_SCHEMA.COLUMNS c
JOIN INFORMATION_SCHEMA.VIEWS v
  ON v.TABLE_SCHEMA = c.TABLE_SCHEMA AND v.TABLE_NAME = c.TABLE_NAME
WHERE c.COLUMN_NAME IN ('Movid','guias','PersonaRecibio','FechaRecepcion','EnvioId','Formaenvio')
GROUP BY c.TABLE_SCHEMA, c.TABLE_NAME
HAVING COUNT(*) >= 3
ORDER BY columnas_clave DESC;
```

Y, por si el reporte lo arma un procedimiento y no una vista:

```sql
-- 3.3 · ¿Algún objeto (vista, función o SP) menciona la columna "PersonaRecibio"?
SELECT o.type_desc, SCHEMA_NAME(o.schema_id) AS esquema, o.name
FROM sys.sql_modules m
JOIN sys.objects o ON o.object_id = m.object_id
WHERE m.definition LIKE '%PersonaRecibio%'
   OR m.definition LIKE '%EnvioEstatus%'
ORDER BY o.type_desc, o.name;
```

Cuando aparezca la candidata (llamémosla `dbo.Vw_TablaH_Guias`), verifica que trae lo que
necesitamos y que el volumen cuadra con las 13,248 filas del Excel:

```sql
-- 3.4 · Comprobación rápida
SELECT TOP (20) * FROM dbo.Vw_TablaH_Guias ORDER BY FechaEmision DESC;

SELECT COUNT(*) AS filas,
       COUNT(DISTINCT Movid) AS movids,
       MIN(FechaEmision) AS desde,
       MAX(FechaEmision) AS hasta,
       SUM(CASE WHEN guias IS NOT NULL AND LTRIM(RTRIM(guias)) <> '' THEN 1 ELSE 0 END) AS con_guia
FROM dbo.Vw_TablaH_Guias;

-- Nombres exactos de las columnas (para confirmar mayúsculas/minúsculas del mapeo)
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Vw_TablaH_Guias'
ORDER BY ORDINAL_POSITION;
```

**Manda el resultado de 3.4 (el listado de columnas y el conteo).** Con eso se cierra el mapeo y se
escribe el mapper sin adivinar nada.

---

## 4. SQL propuesto para el puente

El puente **no escribe SQL a mano**: `readView()` (`bridge/lib/mssql.mjs`) hace siempre
`SELECT * FROM [vista] [WHERE …]` por streaming y el mapeo ocurre en JavaScript. Así que lo único
que hace falta es el nombre de la vista y, opcionalmente, una ventana por fecha para no leer el
histórico completo cada mañana (igual que sell out, que lee 45 días):

```sql
-- Lo que ejecutará el puente (lo arma readView solo):
SELECT * FROM [dbo].[Vw_TablaH_Guias]
WHERE FechaEmision >= DATEADD(day, -90, CAST(GETDATE() AS date));
```

90 días es holgado: las guías se cierran en semanas y la unique key `(mov, movid)` hace el upsert
idempotente, así que releer días ya cargados no duplica nada.

### 4.1 Mapper propuesto (para `bridge/lib/mappers.mjs` — réplica exacta del de `uploads.html`)

```js
// ── Vw_TablaH_Guias → guias_erp (unique: mov, movid) ───────────────────────
// Réplica del parser guiasErp() de public/uploads.html: si cambia uno, cambiar el otro.
export function guiasErp(row) {
  const obj = {}; for (const k of Object.keys(row)) obj[snake(k)] = row[k];
  const mov = txt(obj.mov), movid = txt(obj.movid);
  if (!mov || !movid) return null;              // misma regla que el uploader
  return {
    origen:          txt(obj.origen),
    origen_id:       txt(obj.origenid),
    estatus:         txt(obj.estatus),
    fecha_emision:   isoTs(obj.fechaemision),
    agente:          txt(obj.agente),
    nombre_agente:   txt(obj.nombreagente),
    almacen_envio:   txt(obj.almacenenvio),
    grupo_envio:     txt(obj.grupoenvio),
    cliente_codigo:  txt(obj.cliente),
    cliente_nombre:  txt(obj.nombre),
    sector:          txt(obj.sector),
    destino:         int(obj.destino),
    estado:          txt(obj.estado),
    destino_estado:  txt(obj.destinoestado),
    orden_compra:    txt(obj.ordencompra),
    referencia:      txt(obj.referencia),
    envio:           txt(obj.envio),
    envio_id:        txt(obj.envioid),
    mov, movid,
    envio_estatus:   txt(obj.envioestatus),
    envio_fecha:     isoTs(obj.enviofecha),
    forma_envio:     txt(obj.formaenvio),
    fecha_envio:     isoTs(obj.fechaenvio),
    persona_recibio: txt(obj.personarecibio),
    fecha_recepcion: isoTs(obj.fecharecepcion),
    guias:           txt(obj.guias)?.replace(/[\r\n]+/g, ' ').trim() || null,
  };
}
```

Ojo con dos detalles frente a los mappers que ya existen:

1. `snake()` aplana los nombres del ERP; hay que confirmar con el paso 3.4 si `Origenid` llega como
   `origenid` u `origen_id`. Lo mismo con `FechaEmision`. El mapper de compras (`comprasOC`) ya
   resuelve esto con `obj.fecha_emision ?? obj.fechaemision`: conviene hacer igual.
2. `guias_erp` guarda **timestamptz**, no `date`. Los mappers actuales usan `isoDate()` (corta a
   día). Hace falta un helper `isoTs()` que conserve la hora, o aceptar la pérdida de hora (el
   dashboard hoy sólo compara días, así que perderla no rompe nada, pero cambia el dato).

### 4.2 Fuente propuesta (para `bridge/sync.mjs`, dentro de `FUENTES`)

```js
  guias: {
    src_id: 'erp-updates', status_key: 'guias_erp',
    enabled: () => env('ERP_SQL_HOST') && env('ERP_VIEW_GUIAS'),
    run: async () => {
      const dias = parseInt(env('GUIAS_SINCE_DAYS', '90'), 10);
      const where = dias > 0 ? `FechaEmision >= DATEADD(day, -${dias}, CAST(GETDATE() AS date))` : '';
      const { rows, leidas } = await readView('ERP', env('ERP_VIEW_GUIAS'), { where, top, mapRow: M.guiasErp });
      log(`  guías: ${leidas} leídas → ${rows.length} con Mov/Movid · ventana ${dias} días`);
      await upsertRows('guias_erp', 'mov,movid', rows, { dryRun });
      return { filas: rows.length, detalles: { leidas, since_days: dias } };
    },
  },
```

Y tres líneas sueltas más:

- `const GRUPOS = { erp: ['ventas', 'inventario', 'precios', 'compras', 'guias'], … }`
- `tablaDe()`: agregar `guias: 'guias_erp'`.
- `test()`: agregar `['ERP', env('ERP_VIEW_GUIAS')]` a `checks`.
- `bridge/credenciales.ejemplo.env`: agregar `ERP_VIEW_GUIAS=` y `GUIAS_SINCE_DAYS=90`.

No hay que tocar `api/import-central.js` (ya tiene `guias_erp: 'mov,movid'` en la whitelist) ni
`v_fuentes_frescura` (ya incluye `guias_erp`, umbral 7 días) ni `api/cron.js` (ya la vigila en
`FUENTES_UPLOAD`).

---

## 5. Pasos exactos en la Mac mini

1. **Encontrar la vista** — corre los queries de la sección 3 contra `192.168.0.151` y anota el
   nombre exacto y la lista de columnas (3.4).
2. **Pasarme ese resultado** para escribir `M.guiasErp` con los nombres reales (o escribirlo tú con
   la plantilla de 4.1).
3. Con el código ya en `main`:
   ```bash
   cd ~/acteck-dashboard          # la ruta donde vive el repo en la Mac mini
   git pull
   cd bridge && npm ci
   ```
4. **Configurar la vista** en `bridge/credenciales.env` (el archivo NO va a git):
   ```
   ERP_VIEW_GUIAS=dbo.Vw_TablaH_Guias
   GUIAS_SINCE_DAYS=90
   ```
5. **Probar sin escribir nada:**
   ```bash
   node --env-file=credenciales.env sync.mjs test
   node --env-file=credenciales.env sync.mjs guias --dry-run --top 50
   ```
   El `--dry-run` imprime el SQL, cuántas filas leyó y cuántas mapeó, sin tocar Supabase.
6. **Carga real de una vez:**
   ```bash
   node --env-file=credenciales.env sync.mjs guias
   ```
   Verificar en el dashboard: Administración → Datos, la fuente **"Guías ERP"** debe pasar a verde
   (umbral 7 días) y Tracking Pedidos debe mostrar guías de los últimos días.
7. **Programarla** junto con el resto del ERP: añadir `guias` al grupo `erp` en
   `bridge/launchd/*.plist` (o dejar que entre sola si el plist llama a `sync.mjs erp`) y reinstalar
   los agentes:
   ```bash
   cd ~/acteck-dashboard/bridge && ./launchd/install.sh
   ```
8. **Primera carga histórica (opcional).** Si se quiere todo el histórico y no sólo 90 días, una
   corrida con `GUIAS_SINCE_DAYS=0` lee la vista completa. Como el upsert es por `(mov, movid)`, no
   duplica lo que ya está.

---

## 6. Cuando esté hecho

- Actualizar `docs/SYNC_SQL_BRIDGE.md` (hoy no menciona guías) y el bloque de Tracking Pedidos en
  `CLAUDE.md`, que dice literalmente que falta pasar `guias_erp` al puente.
- Quitar la hoja "Guias" del Excel manual de `uploads.html` (o dejarla como respaldo, igual que
  las demás tarjetas del ERP, que ya son obsoletas pero no se borraron).
- Encender en Tracking Pedidos el tiempo de entrega por paquetería, que es lo que hoy no se puede
  calcular con datos frescos.
