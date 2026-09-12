# Pagos V3 · pantalla unificada (2026-09-12)

Una sola pestaña de **Pagos** para Digitalife, PCEL y Dicotech. Desde el menú de un cliente
se abre ya filtrada. El 90 % de los pagos los calcula el motor; el resto se captura a mano.
Todos siguen el mismo flujo:

```
calculado → solicitado → autorizado → folio → pagado
             (correo)      (David)   (finanzas)  (nota de crédito + PDF)
   rechazado  ← con motivo · vuelve a calculado        cancelado = "No aplica"
```

Eje de la pantalla elegido por Fernando: **calendario del mes + pipeline** (eje A del mockup)
con los bloques comunes (cálculo, fondos, reglas).

---

## 0 · Diseño B (3.27.0 · 2026-09-12)

Fernando vio la primera versión (eje A, tres clientes y cinco tipos en una sola tabla) y la encontró repetida y
revuelta. Se cambió al **diseño B**: un cliente a la vez, con un mini resumen de las tres cuentas arriba que también
sirve de selector. La pestaña Pagos **desapareció de cada cliente**: los enlaces cliente › Pagos abren la global con
ese cliente preelegido (`App.jsx` → `pagosCliente`; móvil → `inicial.cliente`). Ninguna cifra vive en dos bloques:
el hero cuenta en dinero, el flujo cuenta en pagos, la fila de KpiCards se eliminó y los filtros de cliente sobre la
tabla también. Lo secundario (Cálculo · Marketing · Fondo · Reglas · Historial) se ve una sección a la vez.

## 1 · Archivos

### Nuevos (esta entrega)

| Archivo | Qué hace |
|---|---|
| `src/modules/comercial/PagosUnificados.jsx` | Pantalla web. Hero → Flujo del mes → Calendario → Pagos del mes (tabla + drill) → Cálculo → Marketing → Fondos → Reglas → Historial. |
| `src/modules/comercial/pagosv3/motor.js` | **Puro.** Todas las fórmulas (rebates, SPIFFs, dinámica, fijos, marketing, fondos, apoyo de protección de precio) + orquestador `calcularPeriodo`. |
| `src/modules/comercial/pagosv3/reglas.js` | **Puro.** `REGLAS_DEFAULT` (copia exacta de `lineamientos_cliente`), `reglaDe`, `reglaVigenteEn`, `resumenReglas`. |
| `src/modules/comercial/pagosv3/estados.js` | **Puro.** Etapas, transiciones válidas, qué falta para avanzar, vencimientos, resumen del flujo. |
| `src/modules/comercial/pagosv3/correo.js` | **Puro.** Genera asunto + cuerpo para copiar y pegar (plantillas reales de Fernando y Karolina) y `mailto:`. |
| `src/modules/comercial/pagosv3/leerNotaCredito.js` | **Puro.** Lector de PDFs de notas de crédito (inflate + Tj/TJ + cadena original del CFDI). Sin dependencias nuevas. |
| `src/modules/comercial/pagosv3/datos.js` | Carga (`useDatosPagos`) y escrituras (estados, propuestas, reglas, dinámica, fondos, PDF a Storage, bitácora). |
| `src/modules/comercial/pagosv3/ui.jsx` | Piezas compartidas (pills de estado/tipo/cliente, barra de flujo, línea de tiempo, tabla de evidencia, campos). |
| `src/modules/comercial/pagosv3/Calendario.jsx` | Calendario del mes, color por tipo, mes anterior/siguiente. |
| `src/modules/comercial/pagosv3/DrillPago.jsx` | Detalle en línea: cálculo y evidencia, NC, timeline, acciones, correo, bitácora. |
| `src/modules/comercial/pagosv3/PanelCalculo.jsx` | Rebates con proyección al cierre, barra de niveles, SPIFFs y dinámica de vendedores con editor de meta y premios. |
| `src/modules/comercial/pagosv3/PanelMarketing.jsx` | Interruptor por actividad: **cargo a fondo** vs **paga la empresa**. |
| `src/modules/comercial/pagosv3/PanelFondos.jsx` | Saldos, estado de cuenta por fondo, movimientos, bloqueo por saldo negativo. |
| `src/modules/comercial/pagosv3/PanelReglas.jsx` | Reglas por cliente con candado ("Desbloquear para editar") e historial. |
| `src/modules/comercial/pagosv3/FormPagoManual.jsx` | Pago manual + apoyo de cálculo de protección de precio (inventario × diferencia de lista). |
| `src/modules/comercial/pagosv3/HojaRegistrarPago.jsx` | "Registrar pago": adjunta el PDF de la NC, lo lee y propone los campos; Fernando confirma. |
| `src/modules/comercial/pagosv3/siluetas.js` | Presets de silueta locales (`SIL_PAGOS`, `SIL_PAGOS_DRILL`, `SIL_MOVIL_PAGOS`). |
| `src/movil/pestanas/pagos/Pagos.jsx` | App móvil (mockup A): **bandeja por acción**. Segmented Hoy · Calendario · Fondos · Historial; grupos Por solicitar · Por autorizar · Sin folio · Por registrar (folio sin pago) · Vence en 7 días · Rechazados; chips de cliente; hero con comprometido / pagado / vence 7 d. Gestos por fila (`FilaGesto` con `mantener`): derecha = acción de la etapa, izquierda = Copiar correo. Toast con Deshacer al solicitar y al autorizar. Sin edición de reglas. |
| `src/movil/pestanas/pagos/hojas.jsx` | Hojas que abren los gestos: `HojaCorreo` (Copiar correo; al copiar marca Solicitado, o copia para reenviar si ya lo está), `HojaFolio`, `HojaRegistrar` (PDF de la NC) y `HojaConfirmar` (autorizar / reabrir). |
| `src/movil/pestanas/pagos/CalendarioM.jsx` | Calendario del mes en cuadrícula (lunes→domingo) con puntos por tipo, "hoy" resaltado, mes anterior/siguiente y la lista del día tocado. |
| `src/movil/pestanas/pagos/DetallePago.jsx` | Detalle del pago: cálculo, evidencia, bitácora y las mismas acciones desde adentro. |
| `api/_pagos.js` | Helper del cron: `taskPagosCalcular`, `calcularPagosDelPeriodo`, `aplicarPagosCalculados`, `reglasAlertasPagos` (alertas **dirigidas por persona** con `para_usuario`, como `agenda_asignado`). Reutiliza el motor de la pantalla. |
| `scripts/test-pagos-motor.mjs` · `-nc` · `-correo` · `-cron` · `-ssr` | Tests (56 comprobaciones, todas en verde). |

### Migraciones aplicadas

| Archivo | Qué hace |
|---|---|
| `supabase/migrations/20260912_pagos_v3_modelo.sql` | Columnas nuevas en `pagos` (estado, origen, tipo, periodo, fecha_programada, clave_calculo, detalle, sellos de flujo, campos `nc_*`), tablas `pagos_reglas`, `pagos_reglas_historial`, `pagos_dinamica_mes`, `pagos_bitacora`, `pagos_fondos`, `pagos_fondos_movimientos`, vista `v_pagos_fondos_saldo`, RPC `pagos_guardar_regla`, columna `marketing_actividades.cobro`, bucket `pagos-nc` con RLS. |
| `supabase/migrations/20260912_pagos_v3_reglas_seed.sql` | Siembra `pagos_reglas` con los porcentajes **copiados tal cual** de `lineamientos_cliente` + fondos + dinámica de agosto 2026 + destinatarios de correo. |
| `supabase/migrations/20260912_pagos_v3_migracion.sql` | Respalda y migra los datos existentes (ver §5). |

`lineamientos_cliente`, `fondos_mkt_movimientos` y `fondo_pcel_movimientos` **no se borran**:
la pantalla vieja (`PagosCliente.jsx`) sigue funcionando mientras se decide retirarla.

---

## 2 · Diffs que hay que aplicar en los archivos compartidos

> Estos cinco archivos los edita otro agente en paralelo, así que aquí van los cambios
> exactos en vez de aplicarlos yo.

### 2.1 `src/App.jsx`

**(a) import perezoso** — junto a los demás `lazy` (línea ~25):

```diff
 const PagosCliente           = lazy(() => import('./modules/comercial/PagosCliente'));
+// Pagos V3: una sola pantalla para los tres clientes (global y por cliente).
+const PagosUnificados        = lazy(() => import('./modules/comercial/PagosUnificados'));
```

**(b) página global `pagos`** — junto a los otros bloques globales (después del de
`cobranzaGlobal`, línea ~616). No necesita permiso global propio: la propia pantalla
sólo muestra los clientes cuya pestaña `pagos` ve el perfil.

```diff
+          {paginaActiva === "pagos" && !clienteActivo && <PagosUnificados clienteKey={null} />}
```

**(c) pestaña `pagos` de cada cliente → la unificada, prefiltrada** (línea ~716):

```diff
-        {paginaActiva === "pagos"   && <PagosCliente cliente={c} clienteKey={clienteActivo} />}
+        {paginaActiva === "pagos"   && <PagosUnificados clienteKey={clienteActivo} />}
```

`PagosCliente` queda importado por si quieres volver atrás; si ya no se usa, borra también
su `lazy(...)` para no arrastrar el chunk viejo (171 KB / 47 KB gz).

### 2.2 `src/components/nav/arbol.js`

**(a) nodo global "Pagos" en el grupo *Clientes propios*** (línea ~68):

```diff
     id: 'clientesPropios', label: 'Clientes propios', icon: Users, color: '#34C759',
     nodos: [
       { pagina: 'resumenClientes',   label: 'Resumen de Clientes',   icon: BarChart3 },
+      // Pagos V3 · una sola pantalla para los tres clientes. Se ve si el perfil ve la
+      // pestaña `pagos` de al menos un cliente (la pantalla filtra por permiso).
+      { pagina: 'pagos',             label: 'Pagos',                 icon: Wallet,
+        ver: (perfil) => CLIENTES_ORDEN.some((k) => puedeVerPestanaCliente(perfil, k, 'pagos')) },
       { pagina: 'propuestas',        label: 'Propuestas',            icon: ClipboardList },
```

**(b) que el filtro respete `ver`** en `construirArbol` (línea ~101):

```diff
     const nodos = g.nodos
       .filter((n) => !(movil && n.soloWeb))
-      .filter((n) => (n.tipo === 'enlace' ? !!perfil.es_super_admin : puedeVerPaginaGlobal(perfil, n.pagina)))
+      .filter((n) => (typeof n.ver === 'function'
+        ? n.ver(perfil)
+        : (n.tipo === 'enlace' ? !!perfil.es_super_admin : puedeVerPaginaGlobal(perfil, n.pagina))))
```

La pestaña `pagos` de cada cliente (`PESTANAS_CLIENTE`, línea ~30) **no cambia**: ya existe
y abre `paginaActiva='pagos'` con `clienteActivo` — App.jsx la manda a la unificada filtrada.

### 2.3 `src/movil/rutas.js`

Dos entradas: la global y la de cliente (misma pantalla, con o sin `clienteKey`).

```diff
 const Tracking         = lazy(() => import('./pestanas/tracking/Tracking'));
 const FichaOC          = lazy(() => import('./pestanas/tracking/FichaOC'));
+const PagosMovil       = lazy(() => import('./pestanas/pagos/Pagos'));
```

```diff
 const GLOBALES = {
   inicio:            () => tab('inicio'),
+  // Pagos V3 · bandeja por acción, calendario, fondos e historial.
+  // `extra` viene de una alerta: { pagoId } abre ese pago · { fondoId } abre Fondos.
+  pagos:             (extra) => ({ tipo: 'push', key: 'pagos', el: h(PagosMovil, { inicial: extra || null }) }),
```

```diff
 const CLIENTE = {
   home:   (ck) => ({ tipo: 'push', key: `cliente-${ck}`, el: h(FichaCliente, { clienteKey: ck }) }),
+  pagos:  (ck, extra) => ({ tipo: 'push', key: `pagos-${ck}`, el: h(PagosMovil, { clienteKey: ck, inicial: extra || null }) }),
```

### 2.4 `src/components/kit/siluetas.js`

Los presets ya existen en `src/modules/comercial/pagosv3/siluetas.js` y la pantalla los pasa
con `<Cargando silueta={SIL_PAGOS} />`. Si prefieres centralizarlos, sustituye la línea de
`pagos` y añade las dos nuevas:

```diff
-  pagos: [hero(3), kpis(4), fila(5, 32), fila(4, 26), tabla(10, 8), panel(1, { alto: 44 }), panel(1, { alto: 44 })],
+  // Pagos V3 · hero 4 stats · 4 KPIs · flujo de 5 etapas · calendario · filtros · tabla · cálculo · fondos · plegables
+  pagos: [hero(4), kpis(4), fila(5, 54), panel(6, { alto: 300 }), fila(4, 28), fila(8, 24), tabla(12, 8),
+          grid('repeat(2, minmax(0,1fr))', [panel(6, { alto: 220 }), panel(6, { alto: 220 })]),
+          panel(5, { alto: 170 }), panel(1, { alto: 44 }), panel(1, { alto: 44 })],
+  pagosDrill: [fila(5, 44), panel(5, { alto: 160 }), panel(4, { alto: 130 }), fila(4, 30)],
+  movilPagos: [fila(2, 26), kpis(2, 'repeat(2, minmax(0,1fr))'), panel(6, { alto: 240 }), panel(4, { alto: 160 })],
```

(Si los centralizas, cambia en `PagosUnificados.jsx` `<Cargando silueta={SIL_PAGOS} …>` por
`<Cargando pantalla="pagos" …>` y borra el import de `./pagosv3/siluetas`.)

### 2.5 `api/cron.js` · task `pagos-calcular` + reglas de alerta

**(a) import** (junto a los otros, línea ~36):

```diff
 import { calcularTodo, backorderPorSku, facturasSinOC } from '../src/modules/comercial/tracking/calculo.js';
+// Pagos V3 · el mismo motor puro que usa la pantalla (no duplicar fórmulas aquí).
+import { taskPagosCalcular as _taskPagosCalcular, reglasAlertasPagos } from './_pagos.js';
```

**(b) envoltorio con los helpers REST que ya existen en cron.js** (cerca de las demás tasks):

```js
// Día 2 de cada mes, 08:00 CDMX: calcula el mes cerrado y crea los pagos faltantes
// (idempotente por clave_calculo: volver a correrlo no duplica nada).
async function taskPagosCalcular({ dryRun = esDryRun() } = {}) {
  const sbPost = async (tabla, filas) => {
    const r = await fetch(`${SB_URL}/rest/v1/${tabla}`, {
      method: 'POST',
      headers: { ...SB_HEADERS(), Prefer: 'return=minimal' },
      body: JSON.stringify(normalizarFilasAlertas(filas)),   // misma normalización de llaves (PGRST102)
    });
    if (!r.ok) throw new Error(`${tabla} → HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
  };
  return _taskPagosCalcular({ sbGetAll, sbPost, hoy: hoyCDMX(), dryRun });
}
```

**(c) enrutado** (línea ~1522, junto a los demás `else if`):

```diff
     } else if (task === 'agenda-hoy') {
       result = await taskAgendaHoy({ dryRun: esDryRun() || req.query?.dryRun === '1' });
+    } else if (task === 'pagos-calcular') {
+      result = await taskPagosCalcular({ dryRun: esDryRun() || req.query?.dryRun === '1' });
     } else {
```

y en el `usage` de la respuesta de error añade `| pagos-calcular[&dryRun=1]`.

**(d) reglas de alerta** — dentro de `taskGenerarAlertas`, en el arreglo `REGLAS` (línea ~1182):

```diff
     ['equipo_inactivo',        () => reglaEquipoInactivo(hoy)],
+    // Pagos V3 · pago_por_solicitar · pago_sin_autorizar_5d · pago_sin_folio · pago_vence_7d · fondo_negativo
+    ['pagos_v3',               () => reglasAlertasPagos({ sbGetAll, hoy })],
```

`reglasAlertasPagos` devuelve las filas ya con `tipo`, `severidad`, `clave`, `titulo`,
`detalle`, `cliente_key`, `area: 'pagos'`, `accion` (navegar a Pagos) y `meta` — el mismo
formato que las demás reglas, así que el resto de `taskGenerarAlertas` (alta/baja/reapertura,
notificación de críticas) funciona sin tocar nada. Los cinco tipos entran con una sola
entrada en `REGLAS`; si prefieres que el resumen los cuente por separado, divídela en cinco
llamadas filtrando por `tipo`.

**Destinatarios (regla de Fernando, 2026-09-12).** Las alertas de Pagos van **dirigidas a una
persona** con `alertas.para_usuario`, igual que `agenda_asignado`: una fila por destinatario y el
`user_id` dentro de la `clave`. Los `user_id` se resuelven dentro de la propia regla leyendo
`perfiles` por correo (`CORREOS_PAGOS` en `api/_pagos.js`); si un perfil no se resuelve, esa alerta
cae a aviso general (sin `para_usuario`) para no perderse.

| Tipo | Destinatario |
|------|--------------|
| `pago_por_solicitar` | Fernando **y** Karolina (dos alertas dirigidas) |
| `pago_sin_autorizar_5d` | Fernando |
| `pago_sin_folio` | Karolina |
| `pago_vence_7d` (folio sin pago) | Karolina |
| `fondo_negativo` | Fernando |

En el móvil, `src/movil/pestanas/Alertas.jsx` manda estas alertas a Pagos con
`extra: { pagoId }` (o `{ fondoId }`) y la pantalla abre ese pago (o la pestaña Fondos con el
fondo arriba).

**(e) `vercel.json`** — nuevo cron (08:00 CDMX = 14:00 UTC; el día 2 de cada mes):

```diff
     {
       "path": "/api/cron?task=agenda-hoy",
       "schedule": "30 14 * * 1-6"
+    },
+    {
+      "path": "/api/cron?task=pagos-calcular",
+      "schedule": "0 14 2 * *"
     }
```

---

## 3 · Reglas iniciales por cliente (copiadas, no inventadas)

Fuente: tabla `lineamientos_cliente` (lo que usa hoy `PagosCliente.jsx`) y, donde el código
caía a un respaldo, `PCEL_REAL` de `src/lib/constants.js`. Sembradas en `pagos_reglas` con
vigencia desde 2026-01-01 y espejadas en `REGLAS_DEFAULT` (`pagosv3/reglas.js`).

### Rebate

| Cliente | Frecuencia | Base | Regla |
|---|---|---|---|
| **Digitalife** | Trimestral | Sell in por SKU y categoría | Monitores **2 %** · Sillas **2 %** · Accesorios **3 %** (todo lo que no sea monitores/sillas cae a accesorios). Pago: Q1 15-abr · Q2 15-jul · Q3 15-oct · Q4 15-ene |
| **PCEL** | Trimestral | Sell in del Q | Niveles: ≥ 90 % → **1 %** · ≥ 106 % → **1.5 %** · ≥ 120 % → **2 %**. Mínimo para pagar: 90 % |
| **Dicotech** | **Mensual** ("Fondo para Generación Sell Out") | Sell in del mes cerrado sin IVA | ≥ 90 % → **2 %** · ≥ 115 % → **2 %** · ≥ 130 % → **2 %** · **≥ 150 % → 3 %** (regla especial confirmada por Fernando). Mínimo 90 %. Se calcula el **día 2**, se paga el **15** del mes siguiente |

### SPIFF

| Cliente | Base | Regla |
|---|---|---|
| **Digitalife** | Sell out del mes | Cuota de sell out = **90 %** de la cuota de sell in. Paga si el sell out llega al **100 %** de esa cuota SO; monto = sell out × **0.18 %**. (Palancas editables: `flat_pct`, `cuota_so_factor`, `min_alcance`. Los tiers viejos 0.25/0.30/0.40 % y el tope de $4,000 se conservan como `tiers_legacy`, sin uso en modo `flat_v2`.) |
| **PCEL** | Sell in del mes | **0.21 %** del sell in, con alcance mínimo **90 %** |
| **Dicotech** | Sell in del mes | SPIFF **compradora**: **0.30 %** del sell in, sin alcance mínimo |

### Dinámica de vendedores · Dicotech

Meta mensual sin IVA y lista de premios 1º…5º se **capturan cada mes** (tabla
`pagos_dinamica_mes`, editor en el panel de Cálculo). Participan los vendedores de
`v_sellout_general_dicotech` (vía `v_sellout_general_vendedor_mes`) con importe ≥ meta;
ranking por importe; genera un pago "Premios dinámica &lt;mes&gt;" con el detalle.
Migrado: **agosto 2026 · meta $110,000** · premios Tarjeta Amazon $2,500 / $1,500 / $1,000 /
$500 y Power Bank.

> Nota: esos cinco premios son texto sin monto, así que el pago calculado sale en $0 y no se
> crea. En cuanto se capture el monto de cada premio en el editor, el pago se genera solo.

### Fondos

| Cliente | Fondo | Abono |
|---|---|---|
| Digitalife | Marketing | **manual** (el código actual no tenía regla de abono) |
| PCEL | Marketing | **1 %** del sell in, trimestral, alcance mínimo 100 %, acumula multi-año |
| PCEL | Fondo directo | manual |
| Dicotech | Marketing (cliente) | por nivel de alcance del Q acumulado: ≥ 90 % → **0.75 %** · ≥ 115 % → **1.00 %** · ≥ 130 % → **1.25 %** (respaldo 0.75 %) |
| Dicotech | Fondo interno (no visible al cliente) | **1 %** del sell in, siempre |

Plan de marketing contratado de Dicotech: **$14,007.14/mes**, se descuenta primero del fondo
del cliente y luego del interno.

### Pagos fijos

Digitalife · **Stand Sucursal Chapalita $10,000** al mes (día 1). Tomado de los registros que
ya existían en `pagos` (`categoria = pagosFijos`).

### Destinatarios de correo (`pagos_reglas` · `_global` / `destinatarios`)

| Tipo de pago | Para | Saludo |
|---|---|---|
| SPIFF · dinámica (dispersión) | Lucía | "Hola Lucy buenos días" |
| Rebate (NC / bonificaciones) | Luis Fernando Sánchez · credito.cobranza@acteck.com | "Hola equipo buenos días" |
| Marketing | Luis Fernando Sánchez | "Hola Luis Fer, buen día" |
| Resto | Luis Fernando Sánchez · credito.cobranza@acteck.com | "Buen día" |

Copia siempre: **David Millán** (david.millan@acteck.com) y **Karolina**.
Los correos que todavía no conozco quedan en `null` y se capturan desde Reglas por cliente
(sección `destinatarios`). La firma sale del perfil que solicita.

---

## 4 · Textos de correo que genera el dashboard

Botón **"Copiar correo"** (por pago) y **"Solicitar los calculados"** (lote). No se envía
nada: se copia asunto + cuerpo para pegar en el correo. Cuatro plantillas, calcadas de los
correos reales:

**1 · SPIFF / dinámica** — asunto `Spiff Julio 2026 PCEL`

```
Hola Lucy buenos días, solicito tu apoyo para hacer la dispersión de los Spiff
generados en Julio 2026 para el equipo de PCEL.

Geraldo Roman $6,177

Mes           Objetivo Sell In   Facturación   Spiff
───────────   ────────────────   ───────────   ──────
Julio 2026    $2,800,000         $2,941,000    $6,177

Total: $6,177.00

Quedo al pendiente de tus comentarios

Fernando
```

**2 · Rebates (lote de varios meses del mismo cliente)** — asunto `Rebates Dicotech Julio 2026 y Agosto 2026`

```
Hola equipo buenos días,

Envío el cálculo del rebate de Dicotech correspondiente a Julio 2026 y Agosto 2026,
sobre el sell in del mes cerrado (sin IVA) y el porcentaje vigente por nivel de alcance.
Solicito su apoyo para autorizar la aplicación vía nota de crédito.

Mes           Alcance   Rebate Pagado   Rebate Correcto   Diferencia
───────────   ───────   ─────────────   ───────────────   ──────────
Julio 2026    112 %     $80,000         $88,000           $8,000
Agosto 2026   155 %     $64,000         $96,800           $32,800

Total a aplicar: $184,800.00

Quedo al pendiente de cualquier duda o comentario

Fernando
```

**3 · Marketing (firma de Karolina)**

```
Hola Luis Fer, buen día. Me apoyas a realizar el pago correspondiente a Dicotech
sobre las campañas de este mes, por favor. Este mes sería de $6,000.00 y será por
nota de crédito.

Actividad          Total       Mes
────────────────   ─────────   ──────────────
CAMPAÑA ADS 2026   $6,000.00   Septiembre 2026

Quedo al pendiente de cualquier duda o comentario

Karolina
```

**4 · Genérico** (protección de precio, bonificaciones, fijos, ajustes): concepto, monto,
periodo, tabla de evidencia, fecha programada y "se aplicará vía nota de crédito".

Cada correo lleva cabecera `Para: … / CC: … / Asunto: …` y hay un botón "Abrir en correo"
(`mailto:`) para quien prefiera el cliente de correo.

---

## 5 · Migración de datos · conteos

Respaldos creados antes de tocar nada (no borrar hasta que Fernando valide):
`_respaldo_pagos_20260912` · `_respaldo_fondos_mkt_20260912` · `_respaldo_fondo_pcel_20260912`.

| Concepto | Antes | Después |
|---|---|---|
| Filas en `pagos` | 62 | **62** (0 borradas, 0 creadas) |
| Respaldo `_respaldo_pagos_20260912` | — | 62 |
| Pagos sin `estado` | 62 | **0** |
| Entradas en `pagos_bitacora` | 0 | **62** (una de origen por pago) |
| Movimientos de fondos (`fondos_mkt` 10 + `fondo_pcel` 4) | 14 | **14** replicados en `pagos_fondos_movimientos` (los originales intactos) |
| Reglas en `pagos_reglas` | 0 | **12** (11 por cliente + destinatarios) |
| Dinámica capturada | — | **1** (dicotech 2026-08) |
| Fondos dados de alta | — | **5** (digitalife mkt · pcel mkt/directo · dicotech mkt/interno) |

Reparto tras migrar:

| Estado | Origen | Tipo | n | Monto |
|---|---|---|---|---|
| calculado | auto | fijo | 4 | $40,000 |
| calculado | auto | spiff | 4 | $16,894 |
| solicitado | manual | otro | 1 | $82,854 |
| cancelado ("No aplica") | auto | rebate | 6 | $0 |
| cancelado ("No aplica") | auto | spiff | 6 | $0 |
| pagado | auto | fijo | 9 | $90,000 |
| pagado | auto | marketing | 18 | $727,238 |
| pagado | auto | rebate | 1 | $140,922 |
| pagado | auto | spiff | 7 | $30,985 |
| pagado | manual | promoción | 4 | $344,878 |
| pagado | manual | otro | 2 | $112,159 |

Equivalencias usadas: `pendiente`/`vencido` → **calculado** · `en_proceso` → **solicitado** ·
`pagado` → **pagado** · `cancelado`/`no_aplica` → **cancelado** ("No aplica", que no es un
rechazo del flujo). `categoria` → `tipo`: rebate, spiff, marketing, `pagosFijos`→fijo,
`promociones`→promoción, `pagosVariables`→otro. Origen `auto` para lo que calcula el motor,
`manual` para lo capturado. `fecha_programada` = `fecha_compromiso` (o la de pago real).
Las filas con `cliente = NULL` (legado) se asignaron a Digitalife, como ya hacía la pantalla.

---

## 6 · Lector de notas de crédito (PDF)

No hay `pdfjs-dist` en `node_modules` y no valía la pena sumar ~1 MB al bundle por un PDF de
una página, así que `pagosv3/leerNotaCredito.js` hace lo mínimo, **sin dependencias nuevas**:

1. Recorre los objetos `stream … endstream` y los descomprime con `DecompressionStream`
   (navegador) o `zlib` (Node, para los tests).
2. Extrae el texto de los operadores `(…) Tj` y `[…] TJ`, decodificando WinAnsi y los escapes.
3. Lee la **CADENA ORIGINAL** del CFDI (serie, folio, fecha, UUID, RFC y razón social de
   emisor y receptor, importe, total) y completa con el cuerpo (concepto, factura aplicada,
   etiquetas Importe / Impuestos / Total).

Probado contra `docs/ejemplos/nota-credito-ejemplo.pdf` (Revko → Dicotech). Campos extraídos:

| Campo | Valor |
|---|---|
| `nc_folio` | **B13719** |
| `nc_fecha` | 2026-09-09 |
| `nc_uuid` | 17FC0B3A-8237-40B4-A477-E5A4D1A95087 |
| `nc_razon_social` / `nc_rfc` | DICOTECH MAYORISTA DE TECNOLOGIA · DMT0911105L5 |
| emisor | REVKO TECHNOLOGY · AME011127HC5 |
| `nc_concepto` | Bonificación · Nota Credito 13890 · CAMPAÑA ADS 2026 (1/4) |
| `nc_factura` | **A10379702** (la factura a la que se aplicó) |
| `nc_importe` / `nc_iva` / `nc_total` | $6,000.00 · $960.00 · $6,960.00 |

Si el PDF es un escaneo o el formato cambia, `ok:false`: la hoja pide captura manual con el
PDF **ya adjunto** y muestra el texto leído para copiar a mano. Los campos que sólo vienen en
el correo de finanzas (**Servicio tipo**, **Referencia de bonificación**, **Observaciones**)
se capturan en la misma hoja y se guardan en el pago (`nc_servicio_tipo`, `nc_referencia`,
`nc_observaciones`). El PDF se sube al bucket privado `pagos-nc` (`nc_pdf_path`) y se abre con
URL firmada de 10 minutos.

---

## 7 · Permisos

* Todo se filtra por la pestaña **`pagos` de cada cliente** (`puedeVerPestanaCliente` /
  `puedeEditarPestanaCliente`). Sin permiso en un cliente, sus pagos **no aparecen** ni en la
  vista global, ni en el calendario, ni en los fondos, ni en las reglas.
* Editar (avanzar el flujo, crear pagos, mover fondos, cambiar reglas) exige nivel `edit` en
  ese cliente. El botón "Desbloquear para editar" de Reglas además pide confirmación y deja
  vigencia + autor en `pagos_reglas_historial`.
* RLS de las tablas nuevas: mismas funciones que ya usaban `pagos` y `fondos_mkt_movimientos`
  (`puede_ver_cliente_pestana` / `puede_editar_cliente_pestana`). El bucket `pagos-nc` es
  privado: lectura para autenticados, escritura sólo con `user_can_edit()`.

---

## 8 · Pendientes / decisiones abiertas

* **Correos que faltan**: Lucía, Luis Fernando Sánchez y Karolina están por nombre, sin
  dirección. Capturarlos en Reglas → destinatarios.
* **Premios de la dinámica sin monto**: hoy son texto (tarjetas Amazon, power bank). Mientras
  no tengan monto, el pago de premios sale en $0 y no se crea.
* **`PagosCliente.jsx` y `pagos/*`**: siguen en el repo y funcionando. Borrarlos cuando
  Fernando valide la unificada (y quitar su `lazy` de App.jsx).
* **`FrescuraPill`** ya está en el Hero (`pantalla="pagos"`).

---

## 9 · Cómo verificar

```bash
node scripts/test-pagos-motor.mjs    # fórmulas y flujo (los % son los de reglas.js)
node scripts/test-pagos-nc.mjs       # lector del PDF real de docs/ejemplos
node scripts/test-pagos-correo.mjs   # las 4 plantillas de correo (--ver imprime los textos)
node scripts/test-pagos-cron.mjs     # helper del cron con datos inyectados (sin red)
node scripts/test-pagos-ssr.mjs      # render SSR de la pantalla y sus paneles
npx vite build                       # bundle
```

Corrida real en seco del cron (no escribe):

```bash
set -a && source .env.local && set +a
node --input-type=module -e '
import P from "./api/_pagos.js";
const U=process.env.VITE_SUPABASE_URL, K=process.env.SUPABASE_SERVICE_ROLE_KEY;
const sbGetAll=async(p)=>{const r=await fetch(`${U}/rest/v1/${p}`,{headers:{apikey:K,Authorization:"Bearer "+K}});return r.json();};
console.log(await P.taskPagosCalcular({ sbGetAll, sbPost:async()=>{}, anio:2026, mes:8, dryRun:true }));'
```

Comprobado contra producción (agosto 2026): Dicotech sell in $1,999,417 vs cuota $1,194,559 =
**167 %** → 3 % → rebate **$59,983**; SPIFF compradora **$5,998**; SPIFF de sell out de
Digitalife **no aplica** (90.6 % de la cuota de sell out, se paga desde 100 %). Rebate
trimestral de Digitalife Q2 **$126,338** (sillas $566,800 · monitores $1,160,105 ·
accesorios $3,059,986) y PCEL Q2 **$108,820** (1 %).
