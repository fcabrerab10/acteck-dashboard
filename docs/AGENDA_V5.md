# Agenda V5 · «una app completa dentro de una pestaña» (2026-10-04)

Fernando pidió rehacer la Agenda desde cero basándonos en las mejores apps de gestión del día y elegir, con tres
prototipos (`scratchpad/agenda-prototipo.html` del 4-oct), la **propuesta A**: módulos a la izquierda, selector de persona
arriba, Hoy con lista + reloj del día + **mes completo en pequeño**. Karolina tiene su propia agenda y puede ver la de
Fernando (sólo lectura); Fernando ve todas; David Millán no entra.

## Qué se robó de cada app
- **Sunsama**: ritual de planeación (carga del día vs hora de cierre), cierre del día con reflexión y energía, planeado vs real.
- **Akiflow / Morgen**: lista a la izquierda + reloj del día a la derecha; eventos de Google en el mismo reloj.
- **Things 3**: Áreas → Proyectos → tareas; «cuándo» (`cuando`) distinto de «vence» (`fecha_limite`); Hoy · Próximos · Cuando sea · Algún día.
- **Todoist**: captura en lenguaje natural (`agenda5/interpretar.js`: fecha, hora, duración, #cliente, @persona, p1-p3, idea:/nota:).
- **Linear**: Bandeja con triage por teclas (1 hoy · 2 idea · 3 mañana · 4 cuando sea · H posponer · X descartar).
- **Granola / Fellow**: reuniones como hilo por cliente con «lo que quedó de la anterior» (se conserva la minuta de la V4).
- **Basecamp**: check-in diario «¿qué hiciste hoy?» en una sola página (Equipo).
- **Capacities / Tana**: ideas capturadas sin campos y «promovidas» a pendiente.

## Código
- `src/modules/agenda5/`: `Agenda5.jsx` (armazón, módulos, selector de persona, atajos N/Esc), `Hoy.jsx` (lista, `Reloj`,
  `MiniMes`), `Bandeja.jsx`, `Pendientes.jsx`, `Captura.jsx` (modal con chips), `interpretar.js` (parser puro),
  `calculo.js` (puro: hoyDe, bandejaDe, pendientesDe, porProyecto, conteosMes, bloquesDia, fraseHoy), `datos.js`
  (useAgenda5 = useAgendaDatos V4 + áreas/proyectos/registro/check-ins + Google normalizado; crearDesdeCaptura, triage,
  posponer, moverA, estimar, cronometro, crearArea/Proyecto, guardarRegistroDia, guardarCheckin), `comun.jsx`.
  Reuniones, Minuta, FormReunion y HojaItem se reutilizan dentro del armazón nuevo desde `src/modules/agenda5/base/`
  (ver «V5 autónoma» abajo).
- Migración `20261004_agenda_v5_modelo.sql`: columnas nuevas en `agenda_items` (propietario, cuando, duracion_min,
  min_real, inicio_real, area_id, proyecto_id, bandeja, snooze_hasta, promovido_a, orden_dia) y tablas `agenda_areas`,
  `agenda_proyectos`, `agenda_registro_dia`, `agenda_checkins`, `agenda_objetivos_semana` (RLS agenda_puede_ver/editar,
  auditoría). Áreas sembradas para Fernando.
- Pruebas: `scripts/test-agenda5-captura.mjs`, `test-agenda5-calculo.mjs`, `test-agenda5-ssr.mjs`.

## Hecho el 5-oct (3.67.0)
- Reloj del día editable: soltar una tarea de la lista le da hora (pasos de 15 min, con línea fantasma), arrastrar un
  bloque lo mueve, estirar el borde inferior cambia la duración. Los eventos de Google y las reuniones no se editan ahí.
- Reuniones V5 (`agenda5/Reuniones.jsx`): hilos por cliente (`hilosDe`), acuerdos abiertos del hilo con palomita y
  «→ Tarea» (crearPendienteDePunto), reuniones del hilo con abiertos/resueltos, «Nueva reunión · <hilo>». La minuta
  sigue siendo la V4 (ya trae «Reunión anterior» y «Traer puntos abiertos»).
- Semana: objetivos de la semana (✓/✗, `agenda_objetivos_semana`), acuerdos vencidos y cuentas sin contacto.
- Recordatorios en la campana (tipos `agenda_planear` 08:15 y `agenda_cierre` 17:00, dirigidos a cada persona, desde
  `taskAgendaCorreo` en api/cron.js); se apagan por persona en ⚙️ como cualquier alerta.

## V5 autónoma · V4 archivada (2026-10-05)
Sin cambiar comportamiento, todo lo que la V5 importaba de la V4 se movió (con `git mv`, historia conservada):
- **Web → `src/modules/agenda5/base/`**: `datos.js` (useAgendaDatos, useContadorAgenda, useMinutasCliente, useBandejaHoy,
  completarItem, fetchAgenda…), `calculo.js`, `textos.js`, `etiquetas.js` (CORREOS_SIN_AGENDA), `google.js`, `reparto.js`,
  `comun.jsx` (TagCliente, CampoEtiquetas, FilaItem…), `Minuta.jsx`, `FormReunion.jsx`, `HojaItem.jsx`, `EnviarMinuta.jsx`,
  `Comentarios.jsx`, `ReunionAnterior.jsx`, `Subtareas.jsx`, `HojaReparto.jsx`. Dentro de `agenda5/` se importan como
  `./base/x`; `agenda5/calculo.js`, `datos.js` e `interpretar.js` conviven con los de `base/` sin chocar.
- **Celular → `src/movil/pestanas/agenda5/`** (junto a `AgendaM.jsx`): `Reuniones.jsx`, `Minuta.jsx`, `Captura.jsx`
  (hoja de edición de un ítem), `Reparto.jsx`, `Comentarios.jsx`, `EnviarMinutaM.jsx` y `comun.jsx` (FAB, PalomitaM, ChipM,
  CampoM, FilaGesto, BotonMic, lbl, useBottomOffset). `AgendaCtx` / `useAgenda` se definen ahora en ese `comun.jsx`
  (antes en `pestanas/agenda/Agenda.jsx`): `AgendaM` lo provee y `Reuniones` lo lee, igual que antes.
- **Importadores fuera de la agenda que cambiaron de ruta**: `src/movil/MovilApp.jsx` (useContadorAgenda),
  `src/movil/pestanas/Alertas.jsx` y `equipo/Persona.jsx` (completarItem), `src/modules/general/inicio/bloques.jsx`
  (bloque Hoy: useBandejaHoy, FilaItem, isoDia), `src/modules/comercial/home/bloques.jsx` (MinutasCliente →
  useMinutasCliente), `src/lib/modoVisita.js`, `src/lib/preguntas/responder.js`, `src/lib/prefetch.js` (precarga
  `agenda5/Agenda5` en vez de la V4), y las pantallas móviles que toman piezas táctiles de `pestanas/agenda5/comun`:
  `tracking/Tracking.jsx`, `tracking/hojas.jsx`, `tracking/piezas.jsx`, `pagos/Pagos.jsx`, `equipo/EvaluacionM.jsx`,
  `admin/Invitar.jsx`. `api/cron.js` sólo cambió el comentario que apunta a `etiquetas.js`.
- **Archivado (no se compila)**: `src/_archivo/agenda-v4/` (Agenda, Calendario, Mes, Semana, Pendientes, Cuentas,
  Archivados, Reuniones web) y `src/_archivo/agenda-v4-movil/` (Agenda, Pendientes, Semana, Cuentas, Archivados).
- **Pruebas**: `scripts/test-agenda-ssr.mjs` ahora prueba la base (carga de módulos web y móvil, Subtareas, Reparto,
  Comentarios, ReunionAnterior, Minuta, EnviarMinuta, correo del cron, crones) y tiene un guardia que falla si algo
  compilable vuelve a importar `…/agenda/`; las pruebas de Pendientes/Archivados/Cuentas/Mes V4 se retiraron con las
  pantallas. La prueba del correo se alineó con `api/cron.js` (la sección «Reuniones de hoy» va primero cuando hay
  reunión ese día). `test-agenda-calculo`, `test-agenda-etiquetas` y `test-agenda-reparto` apuntan a `agenda5/base/`.
  Arranque medido: 181.6 KB gz → 181.2 KB gz (ya no se precarga el chunk de la V4).

## «La Agenda te lleva» (3.78 · 5-oct)
Módulo Día en web y celular: Armar el día (propuestas desde el negocio: `dia/proponer.js`) → Guía (una cosa a la vez,
cronómetro, acción, Hecha/Después) → Cierre (planeado vs real, arrastre a mañana, energía, mañana empiezo por).
Hilos: Mis clientes · Área de ventas · Internos · Personales (`agenda_areas.hilo`). Horas por persona en
`preferencias.agenda.horas`. Decisiones en `agenda_dia_decisiones`. Ver CLAUDE.md «Agenda que te lleva».

## Pendiente
0. Recordatorios del cron a las horas por persona (hoy 08:15 / 17:00 fijos).
1. Check-in semanal del lunes y «on this day».
2. Celular: arrastrar al reloj (hoy sólo web) y hilo de reuniones V5 (hoy usa la lista de reuniones heredada, en
   `pestanas/agenda5/Reuniones.jsx`).
3. Portar la minuta al armazón nuevo (hoy `agenda5/base/Minuta.jsx` es la de siempre dentro de la V5).
