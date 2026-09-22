# Agenda V4 — "lo que dejaste / lo que tienes"

**Fecha:** 2026-09-21 · **Decide:** Fernando Cabrera

> «La Agenda como está no me funciona»: las alertas de SKUs de la tabla `alertas` (inventario,
> ventas, forecast…) inundaban la bandeja y tapaban los pendientes reales. Karolina llegó a ver
> 90 avisos de SKUs de la empresa en su bloque "Hoy".

**Regla de oro de V4:** en la Agenda sólo hay `agenda_items` y recordatorios de cuentas.
Las alertas del sistema viven en la campana (`BandejaAlertas` / centro de notificaciones).

---

## 1. Qué se ve

```
┌──────────────────────────────────────────────────────────┐
│ Hero · "Fernando, tienes 2 vencidos, 1 para hoy…"        │
│ 4 KpiCard: Vencidos · Esta semana · Cuentas · Viajes     │
├──────────────────────────────────────────────────────────┤
│ CALENDARIO (ancho completo, mes por defecto)             │
│   ‹ › Hoy · Segmented Mes | Semana                       │
│   fuentes: Google · Reuniones · Viajes · Pendientes ·    │
│            Arribos PO · Cargas · Cotizaciones            │
│   clic en un día → Pendiente | Reunión | Viaje           │
│   arrastrar un pendiente a otro día cambia su fecha      │
├──────────────────────────────────────────────────────────┤
│ Segmented: Pendientes · Reuniones · Cuentas · Archivados │
└──────────────────────────────────────────────────────────┘
```

| Pestaña        | Qué hace |
|----------------|----------|
| **Pendientes** | Captura en una línea arriba («Mandar propuesta a CT mañana @karolina #ct») y bloques **Vencidos · Hoy · Esta semana · Más adelante · Sin fecha**. Selector **Mis pendientes · Todos · Karolina** y chips por cliente. Cada fila: palomita (→ Archivados), título, sub (fecha · #cliente · asignado por X), progreso de subtareas "3/10", avatar del responsable y posponer (mañana / próxima semana). |
| **Reuniones**  | La línea del tiempo de siempre + minuta en vivo (`Reuniones.jsx` / `Minuta.jsx`), filtrable por cliente. Sin cambios de modelo. |
| **Cuentas**    | Las cuentas que Fernando sigue como gerente de ventas (directas o vía mayorista). Semáforo del próximo seguimiento: **vencido rojo · esta semana naranja**. Hoja lateral con datos, bitácora, «Registrar contacto», cadencia editable, «Crear pendiente ligado», llamar y WhatsApp. |
| **Archivados** | Lo hecho y lo cancelado (últimos 120 días) con buscador, fecha de cierre y **Desarchivar**. |

**Subtareas.** Un pendiente se parte en pasos (`agenda_subtareas`). En la fila sale "3/10"; en la
hoja, el checklist (agregar / marcar / renombrar / reordenar / borrar). **El padre NO se cierra solo**
cuando terminan todas: aparece «todas las subtareas listas · ¿marcar como hecho?» con su botón.

**Viajes y ausencias.** Son `agenda_reuniones` con `tipo = 'viaje'` y `fecha_fin`: ocupan todos sus
días en el calendario («Viaje a Monterrey 24–26 sep») sin inventar otra tabla.

---

## 2. Base de datos — `supabase/migrations/20260921_agenda_v4.sql`

| Objeto | Qué es |
|--------|--------|
| `agenda_subtareas` | `id, item_id (fk cascade), titulo, hecha, orden, creado_por, created_at, updated_at`. RLS + auditoría + `agenda_touch()`. |
| `cuentas_seguimiento` | `nombre, contacto, telefono, email, empresa, tipo (directa\|mayorista), mayorista, vendedor, cliente_erp, notas, proximo_seguimiento, recordar_cada_dias (14), ultimo_contacto, estado (activa\|pausada\|cerrada)`. Índice único por `(lower(nombre), lower(empresa))` para que la semilla sea idempotente. |
| `cuentas_seguimiento_notas` | Bitácora: `cuenta_id (fk cascade), fecha, texto, creado_por`. |
| `agenda_reuniones.tipo` | El CHECK acepta ahora `'viaje'`. |
| `agenda_puede_ver()` / `agenda_puede_editar()` | **Ya no basta con ser interno**: piden `es_super_admin` o `permisos.globales.agenda ∈ (ver, edit)`. |

**Permisos (decisión de Fernando).** Fernando super admin · Karolina `edit` · **David Millán
`oculto`**: no ve la pestaña (`puedeVerPaginaGlobal` en `src/lib/permisos.js` perdió el atajo
`tipo === 'interno'`), no puede leer `agenda_items` por PostgREST, no se le asignan pendientes
(`asignables()` en `etiquetas.js`) y no recibe correos de agenda (`conAgenda()` en `api/cron.js`).
La lista vive en **un solo lugar por capa**: `CORREOS_SIN_AGENDA`.

**Semilla — convención CVA (correo de Fernando, 2026-09-21).** 9 contactos → **10 filas** (MyCom
son dos: David Castro de Ecommerce y Chema Pelayo de Proyectos), todas `tipo='mayorista'`,
`mayorista='CVA'`, `proximo_seguimiento = 2026-09-25`, `recordar_cada_dias = 14`, la acción acordada
en `notas`, y **un pendiente por cuenta** en `agenda_items` (responsable Fernando, 25 sep,
`origen = {fuente:'cuentas_seguimiento', cuenta_id}`).

| Contacto | Empresa | Vendedor | Acción |
|---|---|---|---|
| Luis De Viana | — | | seguimiento a los proyectos (Tec de Monterrey, gobierno, ecommerce) |
| Eduardo Macías | Compu Lan | | entender operación y portafolio |
| Soco Villalobos | Estrellas de Cómputo | | revisar el convenio de submayoreo y los rebates en especie |
| Armin Pat | Grupo Isi Sureste | | revisar el esquema de rebates |
| Saul Muñoz | VDNET | | conocer los proyectos de iniciativa privada |
| Juan José | PSA Cómputo y Papelería | Sarahi | presentar productos nuevos en la visita del viernes |
| Mario Prior | — | | retomar el contacto |
| David Castro | MyCom | | seguimiento de ecommerce |
| Chema Pelayo | MyCom | | seguimiento de proyectos |
| Victor Salas | — | | entender el proyecto de gobierno y revisar TikTok Shop |

---

## 3. Código

**Web** — `src/modules/agenda/`

| Archivo | Papel |
|---|---|
| `Agenda.jsx` | Orquestador: hero, 4 KPIs, `Calendario`, Segmented de 4 y las hojas (ítem, minuta, reunión). |
| `Calendario.jsx` | Panel de ancho completo: Mes/Semana, ‹ › Hoy, toggles de fuente, menú del día, drop de pendientes. |
| `Mes.jsx` / `Semana.jsx` | Las dos rejillas. `Semana.jsx` ya no trae Panel ni navegación: sólo la rejilla. |
| `Pendientes.jsx` | Captura en una línea + bloques por horizonte + selector de persona + chips de cliente. |
| `Cuentas.jsx` | Lista, hoja lateral de la cuenta y alta. |
| `Archivados.jsx` | Lo cerrado, con desarchivar. |
| `Subtareas.jsx` | El checklist (lo comparten web y móvil). |
| `calculo.js` | **Lógica pura** (V4: `porHorizonte`, `horizonteDe`, `archivados`, `progresoSubtareas`, `progresoPorItem`, `subtareasDe`, `estadoSeguimiento`, `cuentasOrdenadas`, `cuentasPendientes`, `registrarContacto`, `enlacesContacto`, `fraseAgenda`). |
| `datos.js` | `useAgendaV4` (ítems + reuniones + subtareas + cuentas, **sin alertas de SKUs**), CRUD de subtareas y cuentas, `useMinutasCliente`. |

Archivadas en `src/_archivo/agenda-v3/`: `Bandeja.jsx`, `Tablero.jsx`, `Equipo.jsx`. La preferencia
`agenda.modo` (Bandeja/Tablero) se retiró de Preferencias: ya no hay dos disposiciones.

**Móvil** — `src/movil/pestanas/agenda/`: mismo modelo, Segmented **Pendientes · Calendario ·
Reuniones · Cuentas · Archivados**; captura en una línea; swipe → hecho / ← posponer (`FilaGesto`);
la hoja del pendiente trae el checklist; Cuentas con «Registrar contacto», llamar y WhatsApp.
Archivadas en `src/_archivo/agenda-v3-movil/`: `Hoy.jsx`, `Tablero.jsx`, `Clientes.jsx`.

**Minutas por cliente.** El Resumen de Digitalife / PCEL / Dicotech trae el Panel **«Últimas minutas
y acuerdos»** (`home/bloques.jsx` → `MinutasCliente`, hook `useMinutasCliente`): las últimas 5
reuniones del cliente con sus acuerdos abiertos; al tocar una se dispara
`acteck:navegar { pagina:'agenda', extra:{ reunionId } }` y `App.jsx` la pasa a `Agenda` como
`inicial`. Sustituye al viejo bloque `pendientes`, que leía las tablas `pendientes`/`minutas` ya
migradas a `agenda_*` y por eso mostraba datos congelados.

**Bloque "Hoy" de Inicio.** Los pendientes van uno a uno; los avisos del sistema se **agrupan en una
línea por área** (`agruparAvisos`): «90 avisos del sistema · 3 urgentes → ver».

---

## 4. Correos (`api/cron.js`)

Dos envíos al día, sólo a quien usa la Agenda:

| Momento | Quién | Hora CDMX | Qué lleva |
|---|---|---|---|
| **mañana** «Lo que dejaste» | Karolina | 08:15 | vencidos · hoy · lo que te asignaron desde ayer |
| | Fernando | 08:30 | + cuentas con seguimiento vencido |
| **tarde** «Lo que tienes mañana» | Karolina | 15:00 | reuniones, pendientes, viajes y cargas de mañana |
| | Fernando | 17:00 | ídem |

Si no hay nada que contar **no se manda correo**. Reutiliza el SMTP y el HTML de
`resumen-programado` (`crearTransporte` · `htmlSeccion` · `htmlCorreo`).

**Entradas de cron en `vercel.json`** — dos, no cuatro: el plan Hobby no da para una por persona y
por momento, así que la task mira la hora CDMX (`destinatariosAhora`, ventana ±7 min) y manda lo que
toca. `?momento=manana|tarde`, `?para=<correo>` y `?dryRun=1` fuerzan un envío para probar.

```json
{ "path": "/api/cron?task=agenda-correo", "schedule": "15,30 14 * * 1-5" }   // 08:15 y 08:30 CDMX
{ "path": "/api/cron?task=agenda-correo", "schedule": "0 21,23 * * 1-5" }    // 15:00 y 17:00 CDMX
```

Se retiró la entrada `agenda-hoy` (08:30 L-S). La task `taskAgendaHoy` sigue existiendo y se puede
llamar a mano (`?task=agenda-hoy`), pero ya no está programada.

**Regla nueva de alertas:** `cuenta_seguimiento` (área `agenda`, dirigida a Fernando) por cada cuenta
activa cuyo `proximo_seguimiento` ya llegó; severidad alta pasados 7 días de retraso.

---

## 5. Pruebas

```bash
node --test scripts/test-agenda-calculo.mjs scripts/test-agenda-etiquetas.mjs   # 27
node --test scripts/test-agenda-ssr.mjs                                        # 9 (render con datos sembrados)
node --test scripts/test-pantallas-ssr.mjs                                     # 479 módulos
node scripts/verificar-deploy.mjs && npm run build
```

`test-agenda-ssr.mjs` renderiza Pendientes, Archivados, Cuentas, Subtareas y el Mes con datos
sembrados y falla si aparece un `NaN`, un `undefined` o un `[object Object]` en pantalla; además
comprueba el armado de los dos correos, los horarios y las entradas de cron.

---

## 6. Pendiente / a vigilar

- La cadencia del correo de la tarde lee `v_fuentes_frescura` para las «cargas de mañana»; si esa
  vista cambia de columnas, la sección se queda vacía en silencio (está en `try/catch`).
- Los pendientes de la semilla y las 10 cuentas quedaron con fecha **25 sep 2026**: el primer correo
  con contenido real será el de esa mañana.
- `taskAgendaHoy` quedó huérfana de cron. Si Fernando quiere volver al aviso único, hay que
  reponerla en `vercel.json`.
