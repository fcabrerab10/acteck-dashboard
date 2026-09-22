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
El Calendario del celular tiene **Mes | Semana** (`Semana.jsx`): la rejilla del mes pinta un punto por
fuente (viajes incluidos) y al tocar un día se abre su lista debajo.

**Minutas por cliente.** El Resumen de Digitalife / PCEL / Dicotech trae el Panel **«Últimas minutas
y acuerdos»** (`home/bloques.jsx` → `MinutasCliente`, hook `useMinutasCliente`): las últimas 5
reuniones del cliente con sus acuerdos abiertos; al tocar una se dispara
`acteck:navegar { pagina:'agenda', extra:{ reunionId } }` y `App.jsx` la pasa a `Agenda` como
`inicial`. Sustituye al viejo bloque `pendientes`, que leía las tablas `pendientes`/`minutas` ya
migradas a `agenda_*` y por eso mostraba datos congelados.

**Bloque "Hoy" de Inicio.** Los pendientes van uno a uno; los avisos del sistema se **agrupan en una
línea por área** (`agruparAvisos`): «90 avisos del sistema · 3 urgentes → ver».

---

### 3.1 Minuta · «Anota y reparte al cerrar» (2026-09-21, aprobado por Fernando)

En el celular la minuta ya no obliga a capturar punto por punto: hay un **área de notas libre** que se
guarda sola cada 800 ms en `agenda_reuniones.notas` (la misma columna que usa la web, así que las dos
pantallas ven lo mismo). Detrás del texto se resaltan las líneas que parecen acuerdo y arriba del botón
sale el contador «N acuerdos detectados».

**Qué cuenta como acuerdo** (`src/modules/agenda/reparto.js`, pruebas en `scripts/test-agenda-reparto.mjs`):
una línea que empieza con viñeta (`-` `•` `*` `·` `1.` `1)`), o que menciona `@persona`, o `#cliente`, o
trae una fecha en lenguaje natural (hoy · mañana · el viernes · 24/09 · la próxima semana…). Todo lo demás
es contexto y no se reparte. Los parsers son los de `etiquetas.js` (`parsearEtiquetas`, `fechaNatural`), así
que la gramática es la misma que la de la captura en una línea.

**Repartir** abre una hoja con una fila por acuerdo: palomita para incluirlo, responsable (por omisión quien
mencionó `@`, si no quien anota), fecha (chips hoy · mañana · viernes · próxima semana · fecha…) y `#cliente`
(el de la línea o el de la reunión). El pie: **«Crear N pendientes y cerrar minuta»** →
`repartirAcuerdos()` en `datos.js` crea un `agenda_items` `tipo='punto'` por fila (con `reunion_id`,
`responsables`, `fecha_limite`, `origen = {fuente:'reparto'}`) y cierra con el RPC de siempre
`agenda_cerrar_reunion`; **«Sólo guardar notas»** no crea nada. El dedupe es por título dentro de la reunión:
lo que ya existe como punto llega marcado «ya está en la minuta» y sin palomita.

| Archivo | Papel |
|---|---|
| `src/modules/agenda/reparto.js` | Lógica pura: `detectarAcuerdos`, `esAcuerdo`, `analizarLinea`, `lineasMarcadas`, `opcionesFecha`, `filasAItems`, `textoReparto`. |
| `src/modules/agenda/datos.js` | `repartirAcuerdos({ reunion, filas, orden0, cerrar }, personas)`. |
| `src/modules/agenda/HojaReparto.jsx` | La hoja lateral de la web (el nombre lleva "Hoja" porque `Reparto.jsx` chocaría con `reparto.js` en macOS). |
| `src/movil/pestanas/agenda/Reparto.jsx` | La hoja `HojaM` del celular. |
| `src/movil/pestanas/agenda/Minuta.jsx` | Notas con resaltado (`NotasMinuta`), contador y botón **Repartir**. |
| `src/modules/agenda/Minuta.jsx` | El mismo contador y botón junto a «Cerrar reunión». |

Los asistentes externos de una reunión (`agenda_reuniones.asistentes` sin `user_id`) **no** pueden ser
responsables: `agenda_items.responsables` es `uuid[]`, así que el selector sólo ofrece a los internos con
Agenda (Fernando y Karolina).

### 3.2 Seguimiento por punto · «que no se pierda nada» (2026-09-21, pedido por Fernando)

> «como seguimiento de una reunión dentro de agenda, que se pueda abrir una reunión anterior o los
> puntos que se verán en una reunión próxima, y abajo de cada punto ir poniendo los comentarios
> (seguimiento o mejora) para que no se pierda nada».

**El hilo.** Debajo de cada punto de la minuta (web y celular) hay una conversación: los comentarios
con avatar, nombre, hora y una pastilla de tipo (**Seguimiento** · **Mejora** · **Acuerdo**), y un campo
de una línea «Comentario de seguimiento… (⌘↵)» con el chip del tipo. Se guarda de golpe (optimista +
`recargarAgenda()`); no hay botón de guardar.

**El hilo no se rompe al arrastrar.** `calculo.js#hiloComentarios(comentarios, punto, porId)` junta los
comentarios del punto y los de todos los puntos de los que viene arrastrado (sigue `arrastrado_desde` y
`origen.item_anterior`, `cadenaItem`), en orden cronológico; cada comentario llega marcado `deOtroPunto`
y `deOtraReunion`. Por eso en `HojaItem` (web) y en la hoja del ítem del celular la sección
**Seguimiento** muestra la historia completa aunque el punto lleve tres reuniones rodando.

**Abrir la reunión anterior.** En el encabezado de la minuta va el panel plegable
**«Reunión anterior · <cuándo>»** (`ReunionAnterior.jsx`, móvil `PanelAnterior` dentro de `Minuta.jsx`):
lista los puntos de la última reunión del mismo cliente con su estado, su «quedó:» y su hilo; deja
elegir otra reunión del cliente (`reunionesDeCliente`), **«Traer puntos abiertos»** y
**«Ver todas las reuniones de este cliente»**. El traspaso es el RPC `agenda_traer_puntos(p_reunion,
p_desde)`: misma semántica que `agenda_arrastrar_pendientes` (la copia queda `abierta`, el original
`arrastrada`) pero eligiendo la reunión origen a mano, sin exigir que esté cerrada y dejando
`origen.item_anterior` / `origen.reunion_anterior` para que debajo del punto se lea
«viene de la reunión del 11 ago».

**Preparar una reunión próxima.** Los puntos se pueden capturar antes (la línea «Escribe un punto…»
de siempre) y **reordenar con ▲▼** (`datos.js#moverPunto`, reescribe `orden` de la lista completa).

**Pendientes ligados al punto.** `HojaItem` tiene **«Crear pendiente»** (`crearPendienteDePunto`) y el
reparto de la minuta liga la línea al punto que ya existía (`reparto.js#idsExistentes` →
`origen.punto_id`). El punto pinta la pastilla **«N pendientes»** (`calculo.js#pendientesDePunto`).

**«Ver en dashboard».** Un punto con `origen.enlace = { pagina, clienteKey }` muestra un enlace que
navega a esa pantalla (web: `onNavegar` de `Agenda.jsx`, con `acteck:navegar` de respaldo · celular:
`nav.navegar`). Así se sembraron los 12 puntos del martes.

| Objeto | Qué es |
|---|---|
| `agenda_item_comentarios` | `id, item_id (fk cascade), reunion_id (la reunión EN LA QUE se comentó; el trigger `agenda_comentario_defaults` la hereda del punto), tipo (seguimiento\|mejora\|acuerdo), texto, autor (auth.uid()), created_at`. RLS con `agenda_puede_ver()/agenda_puede_editar()` + auditoría; `anon` revocado. |
| `agenda_traer_puntos(uuid, uuid)` | Trae los puntos abiertos de UNA reunión anterior. Idempotente: no copia un punto que ya se trajo. |
| `src/modules/agenda/Comentarios.jsx` | El hilo de la web (lo usan Minuta, HojaItem y el panel de la reunión anterior). |
| `src/modules/agenda/ReunionAnterior.jsx` | El panel plegable de la minuta. |
| `src/movil/pestanas/agenda/Comentarios.jsx` | El hilo del celular (misma lógica, chips y campo de 16 px). |
| `datos.js` | `useComentarios`, `crearComentario`, `borrarComentario`, `traerPuntosDeReunion`, `crearPendienteDePunto`, `moverPunto`. |

**Semilla del martes 22-sep-2026** (`supabase/migrations/20260921_agenda_comentarios.sql`): reunión
«Reunión Digitalife · puntos del martes» (`digitalife`, 22 sep 10:00 CDMX, 60 min, `programada` = abierta
en la UI) con los **12 puntos del correo** en orden y su `origen.enlace`, más dos **proyectos** de abasto
para octubre 2026 (`probable`, responsable Fernando, sin líneas): «Bocinas Digitalife (1,000 + 500 por
confirmar)» y «Gabinetes proyecto Batauro».

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
node --test scripts/test-agenda-reparto.mjs                                     # 12 (reparto de la minuta)
node --test scripts/test-agenda-ssr.mjs                                        # 13 (render con datos sembrados)
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
