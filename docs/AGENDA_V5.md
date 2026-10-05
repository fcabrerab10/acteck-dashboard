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

## Pendiente (en orden)
1. Celular (barra de cinco pestañas: Hoy · Bandeja · Pendientes · Reuniones · Registro) con swipe y captura desde «+».
2. Arrastrar una tarea al reloj para bloquear hora; estirar para duración.
3. Reuniones V5: hilo por cliente con «lo que quedó de la anterior» y acuerdos → tareas con responsable (hoy usa la minuta V4).
4. Revisión semanal completa (objetivos ✓/✗, cuentas sin contacto), check-in semanal del lunes, recordatorios por cron
   (planeación 08:00, cierre 18:00, check-in 16:30).
5. Archivar la V4 (`src/modules/agenda/` queda como proveedor de Reuniones/Minuta/HojaItem hasta el punto 3).
