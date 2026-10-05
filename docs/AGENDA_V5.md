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
  Reuniones, Minuta, FormReunion y HojaItem se reutilizan de `src/modules/agenda/` (V4) dentro del armazón nuevo.
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

## Pendiente
1. Check-in semanal del lunes y «on this day».
2. Celular: arrastrar al reloj (hoy sólo web) y hilo de reuniones V5 (hoy usa la lista V4 móvil).
3. Archivar la V4 cuando la minuta se porte al armazón nuevo.
