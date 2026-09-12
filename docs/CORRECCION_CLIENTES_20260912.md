# Corrección de sell-out y cargas de clientes — 2026-09-12

Aplica las decisiones de Fernando sobre `docs/AUDITORIA_CARGAS_CLIENTES.md` y
`docs/HISTORICO_CLIENTES.md`. **Sí se escribió en producción.** Aquí están los respaldos
y cómo revertir cada paso.

Migraciones: `supabase/migrations/20260912_clientes_sellout_sin_iva.sql` y
`supabase/migrations/20260912_clientes_pcel_valuacion.sql`.
Scripts puntuales (no son parte del build): `scripts/recargar-sellout-dicotech.mjs`,
`scripts/cargar-historico-clientes.mjs` (+ `scripts/_resolver.mjs`).

---

## 1 · Respaldos creados

| Tabla de respaldo | Contenido | Filas |
|---|---|---:|
| `_respaldo_sellout_detalle_20260912` | todo `sellout_detalle` de Dicotech antes de la recarga | 44,463 |
| `_respaldo_sellout_sku_20260912` | todo `sellout_sku` antes del recálculo | 9,945 |
| `_respaldo_inventario_cliente_20260912` | las 3 filas basura de `inventario_cliente` | 1,426 |
| `_respaldo_estados_cuenta_20260912` | corte PCEL sem 27/2026 antes de recargarlo | 1 |
| `_respaldo_estados_cuenta_detalle_20260912` | su detalle (estaba vacío) | 0 |

---

## 2 · Datos: qué cambió

### 2.1 Dicotech · `sellout_detalle` — recarga completa de may–sep 2026

- Se borró `cliente='dicotech' and fecha >= '2026-05-01'` (9,662 filas) y se repuso:
  - **2026-05-01 → 05-17** (semanas ISO 18 parcial, 19 y 20, que nunca se cargaron):
    900 filas desde `sellout_general` (puente SQL).
  - **2026-05-18 → 09-06**: 8,814 filas desde los 17 CSV semanales de Revko en
    `~/Downloads`, con el parser corregido.
- Origen de los duplicados: el **CSV mensual de junio subido el 2026-07-10** se traslapaba
  con las cargas semanales y el `row_hash` llevaba el índice de fila, así que insertó
  1,895 filas nuevas en vez de sobrescribir. Junio pasó de **6,452 pz** a **3,658 pz**.
- 2025 y ene–abr 2026 **no se tocaron**: cuadran fila a fila con `sellout_general`.

Antes → después, 2026 (monto sin IVA):

| Mes | pz antes | pz después | monto antes | monto después |
|---|---:|---:|---:|---:|
| 05 | 2,273 | 3,267 | 706,910 (con IVA) | 860,043 |
| 06 | 6,452 | 3,658 | 2,430,318 (con IVA, duplicado) | 1,131,158 |
| 07 | 4,078 | 4,102 | 1,370,818 (con IVA) | 1,172,851 |
| 08 | 5,731 | 5,658 | 1,807,363 (mixto) | **1,622,775** |
| 09 | 1,157 | 1,332 | **0** | 284,850 |

### 2.2 Todo el sell-out, sin IVA

Monto canónico de `sellout_detalle` = `COALESCE(subtotal, total, 0) − COALESCE(descuento, 0)`.
- Digitalife: `total` venía **con IVA**; `(subtotal − descuento)` = `total / 1.16`.
  Ene-2026 pasa de $1,646,283 a **$1,419,210**.
- Dicotech: `subtotal` ya viene sin IVA y `descuento` es 0.

`sellout_sku` se reconstruyó con esa fórmula (borrado + insert de digitalife y dicotech;
3,457 filas de dicotech y 6,517 de digitalife).

### 2.3 Limpieza de `inventario_cliente`

Borradas las filas con `anio` o `semana` NULL: 1,424 de `digitalife`, una con
`cliente='__test__'` y una con un `<!DOCTYPE html>` como cliente.

### 2.4 Cargas históricas

| Destino | Archivo | Resultado |
|---|---|---|
| EdC PCEL sem 49/2025 | `~/Downloads/Clientes/PCEL/Antigüedad de Saldos … PCEL.xlsx` | saldo $18,124,369 · 57 facturas (primer corte de 2025) |
| EdC PCEL sem 5/2026 | `~/Downloads/Personal/Antigüedad … PC ONLINE.xlsx` | saldo $14,683,530 · 79 facturas |
| EdC PCEL sem 17/2026 | `~/Downloads/Antigüedad … PC ONLINE.xlsx` | saldo $8,829,680 · 72 facturas |
| EdC PCEL sem 27/2026 | `~/Downloads/Antigüedad … PC ONLINE-01-07.xlsx` | saldo $17,102,984 · **80 facturas** (antes 0) |
| Inventario Dicotech sem 32 | `Reporte-Inventario_… (11).csv` | 157 SKUs + 803 filas por sucursal |
| Inventario Dicotech sem 23 | `Reporte-Inventario_….csv` | 150 SKUs + 797 filas por sucursal |
| Inventario Digitalife sem 15 | `Acteck_BalamRush_Inventario (1).xlsx` | 1,253 SKUs |

Ninguna pisó una semana existente (se verificó que estuvieran vacías antes).
El archivo de la semana 27 de PCEL trae un **tercer formato** de "Antigüedad de Saldos"
(sin cubetas de aging, con "Días Vencido"): se agregó `formatoAntiguedadSimple()` a
`src/lib/parsers/estadoCuenta.js`.

---

## 3 · Código

| Archivo | Cambio |
|---|---|
| `src/lib/parsers/dicotech.js` | mapeo del CSV nuevo, `raw:true` (la fecha ya no se corre un día), monto sin IVA, `row_hash` determinista, semana del corte en el inventario |
| `src/lib/parsers/digitalife.js` | `valor = stock × costo_convenio` cuando el archivo no trae "Valor"; semana del corte |
| `src/lib/parsers/estadoCuenta.js` | `opts.fechaCorte` / `opts.anio+semana` mandan sobre el archivo; formato "Antigüedad simple" |
| `src/lib/parsers/_util.js` | `fechaDeCorte()`, `anioSemanaISO()`, `semanaDeCorte()` |
| `src/modules/settings/importador/subir.js` · `CargasManuales.jsx` | columna **"Corte"** (selector de fecha) y confirmación de la semana antes de subir |
| `api/recalculate.js` | `sellout_sku.monto_pesos = Σ (subtotal − descuento)`; el mes se saca del texto `YYYY-MM-DD` (antes `new Date().getMonth()` movía de mes el día 1 y el último) |
| `src/lib/pcelAdapter.js` | PCEL desde `v_sellout_pcel_sku_mes` (antes devolvía `monto_pesos = 0` → Análisis de Cliente mostraba $0) |
| `src/modules/comercial/resumen/*` | PCEL con la valuación oficial; etiqueta "sin IVA" / "estimado a lista" |
| `src/modules/comercial/ReporteSection.jsx` | PCEL valuado con `v_precio_pcel_sku` |
| `SellOutDicotech.jsx` · `SellOutClienteV2.jsx` · `SellOutPcel.jsx` | "sin IVA" / "estimado a lista" en el hero; aviso de SKUs de PCEL sin mapear |
| `public/uploads.html` | réplica del parser de Dicotech y del `valor` de Digitalife |

### Mapeo del CSV nuevo de Revko (sell out semanal)

`Fecha · Usuario Cliente · Venta · Cantidad · Descripcion · Sucursal que genera venta ·
Cliente · Subfamilia · Vendedor · Marca · Distribuidor · costo_compra_antes_IVA · Moneda ·
precio_venta_antes_IVA · total_venta_antes_IVA · Numero de parte · Moneda · Costo`

| Columna | Campo | Nota |
|---|---|---|
| `Fecha` | `fecha` | leída con `raw:true`; con `raw:false` SheetJS la reformatea en hora local y resta un día |
| `Venta` | — | folio; sólo entra al `row_hash` |
| `Numero de parte` | `no_parte` | SKU canónico en mayúsculas. `Clave` ya no viene |
| `Cantidad` | `cantidad` | |
| `precio_venta_antes_IVA` | `precio` | sin IVA |
| `total_venta_antes_IVA` | `subtotal` = `total` | sin IVA; si faltara, `cantidad × precio − descuento` |
| `Marca`, `Descripcion` | `marca`, `descripcion` | |
| — | `iva`, `descuento` | siempre 0 |

Ya no existen en el CSV: `total_venta` (con IVA), `Clave`, `Familia`,
`Sucursal que despacha el inventario`. `Vendedor`, `Cliente` y `Subfamilia` sí vienen pero
`sellout_detalle` no tiene columnas para ellos: viven en `sellout_general` (puente SQL).

`row_hash = hash('REVKO|' + folio + '|' + sku + '|' + fecha + '|' + cantidad + '|' + precio)`
— sin índice de fila, así que recargar un CSV (o un mensual que traslapa a los semanales)
sobrescribe en vez de duplicar.

---

## 4 · Vistas

- `v_sellout_general_dicotech` (**nueva**): `sellout_general` de DICOTECH sin doble origen.
- `v_sellout_detalle_sku_mes`, `v_sellout_digitalife_{sku,marca}_mes`,
  `v_sellout_digitalife_mensual`, `v_sellout_dicotech_sku_mes`, `v_sellout_dicotech_mensual`:
  monto sin IVA. La venta de Dicotech sale de `sellout_detalle`; `facturas` pasa de
  `count(distinct sucursal)` (11-12) a `count(distinct factura)` (~1,400/mes).
- `v_sellout_dicotech_sucursal_mes` y `v_sellout_general_vendedor_mes`: sobre la vista
  deduplicada.
- `v_precio_pcel_sku` (**nueva**): valuación única de PCEL.
- `v_sellout_pcel_sku_mes`: LEFT JOIN con `pcel_sku_map` (+ `mapeado`, `sku_pcel`).
- `v_sellout_pcel_mensual`: + `skus_sin_mapear`, `piezas_sin_mapear`.
- `v_sellout_pcel_sin_mapear` (**nueva**): SKUs de PCEL sin mapeo de los últimos 12 meses.
- `v_sellout_unificado` + `mv_sellout_unificado`: Dicotech sólo por "distribuidor";
  `sellout_detalle` sin IVA; PCEL por mes ISO (jueves) y con la lista oficial.

---

## 5 · Verificación

| Comprobación | Resultado |
|---|---|
| `mv_sellout_unificado` agosto 2026 Dicotech | **$1,622,775** (antes $3,775,165) |
| PCEL piezas por mes vs el archivo oficial | abr 3,712 · jul 4,107 · ago 3,682 · sep 628 — **exactas** (antes se perdía 3-8 % y abril salía −53 % / septiembre +413 %) |
| Dicotech ene–abr y sep vs `sellout_general` | diferencia 0.0 % |
| `sellout_sku` = `sellout_detalle` | cuadra en piezas y monto |
| `npm run build` | ✅ |

---

## 6 · Cómo revertir

```sql
-- Sell out de Dicotech (deja la BD como antes de la recarga)
delete from sellout_detalle where cliente = 'dicotech';
insert into sellout_detalle select * from _respaldo_sellout_detalle_20260912;

-- sellout_sku completo
delete from sellout_sku;
insert into sellout_sku select * from _respaldo_sellout_sku_20260912;

-- Filas basura de inventario_cliente
insert into inventario_cliente select * from _respaldo_inventario_cliente_20260912;

-- Estado de cuenta PCEL semana 27 (el detalle nuevo se borra con el corte)
delete from estados_cuenta_detalle where estado_cuenta_id in (select id from _respaldo_estados_cuenta_20260912);
update estados_cuenta e set saldo_actual = r.saldo_actual, saldo_vencido = r.saldo_vencido,
       saldo_a_vencer = r.saldo_a_vencer, notas_credito = r.notas_credito, dso = r.dso,
       aging_d0_30 = r.aging_d0_30, aging_d31_60 = r.aging_d31_60, aging_d61_90 = r.aging_d61_90,
       aging_mas90 = r.aging_mas90, fecha_corte = r.fecha_corte
from _respaldo_estados_cuenta_20260912 r where e.id = r.id;

-- Cargas históricas nuevas (si se quieren deshacer)
delete from estados_cuenta where cliente = 'pcel' and ((anio = 2025 and semana = 49) or (anio = 2026 and semana in (5, 17)));
delete from inventario_cliente          where (cliente = 'dicotech' and anio = 2026 and semana in (23, 32)) or (cliente = 'digitalife' and anio = 2026 and semana = 15);
delete from inventario_cliente_sucursal where  cliente = 'dicotech' and anio = 2026 and semana in (23, 32);
```

Las vistas se revierten aplicando las definiciones anteriores (están en el git del
esquema y en las tablas de `docs/AUDITORIA_CARGAS_CLIENTES.md` §3). Tras revertir
`sellout_detalle` o `v_sellout_unificado`: `refresh materialized view mv_sellout_unificado;`.

Los respaldos se pueden borrar cuando Fernando dé el visto bueno:
```sql
drop table _respaldo_sellout_detalle_20260912, _respaldo_sellout_sku_20260912,
           _respaldo_inventario_cliente_20260912, _respaldo_estados_cuenta_20260912,
           _respaldo_estados_cuenta_detalle_20260912;
```

---

## 7 · Pendientes

- **`sellout_general` de DICOTECH sigue con las dos fuentes mezcladas en la tabla**
  (may–ago 2026). Se resuelve en vista, no en datos: borrar las filas `id < 0` de esos
  meses requiere autorización aparte.
- **Fechas corridas un día en el histórico de Dicotech** anterior a 2026-05-01 y en todo
  `sellout_detalle` de Digitalife: se cargaron con el `raw:false` que quitaba un día. El
  parser ya está corregido, pero los datos viejos no se re-fecharon (movería ~1 día de
  venta en cada frontera de mes). Recargar el histórico de Digitalife con el archivo
  `~/Desktop/Actualización Dashboard/Historico Sellout Digitalife.xlsx` lo arreglaría.
- **EdC PCEL ~semana 28/2025** (`~/Downloads/Clientes/PCEL/Antigüedad … PCEL.xlsx`,
  8-jul-2025): no se cargó porque el archivo no trae fecha al pie y la semana resultante
  no es verificable. Hay que confirmar con crédito la fecha del corte.
- Hallazgos aún abiertos de la auditoría: **#12** (`SellOutPcel.jsx` consulta
  `inventario_cliente` / `inventario_cliente_sucursal`, vacías para PCEL), **#13**,
  **#14** (descuento de Digitalife sin KPI), **#15** (`Stock Ensambles`), **#16** (la hoja
  de PCEL se llama `"Ventas por Fabricante "` con espacio final), **#17**, **#18**.
- Huecos de datos que hay que pedir: inventario semana 27 (Digitalife y Dicotech),
  inventario Digitalife semana 23, EdC semanas 24/26/28 de 2026, EdC histórico de
  Digitalife, sell out de PCEL de 2025 y enero-2026, `erp_ventas` 2023-2024.
- Las 6 líneas de explotación de los datos de Dicotech (clientes finales, cohortes de
  recompra, matriz vendedor × marca, dispersión de precio) siguen sin construirse.
