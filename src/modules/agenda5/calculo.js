// Agenda V5 · lógica pura (sin React ni red). Pruebas: scripts/test-agenda5-calculo.mjs
//   · «cuándo» (cuando) = el día en que el ítem aparece en Hoy; «vence» (fecha_limite) = deadline. Un ítem sin cuando
//     pero con fecha_limite = hoy también sale en Hoy. Lo no hecho de días anteriores con cuando < hoy = «De ayer».
//   · bandeja = capturado sin clasificar (bandeja=true) o sin cuando/fecha/proyecto.
//   · carga del día = Σ duracion_min de lo pendiente de hoy + reuniones; hora de cierre = ahora + carga.
import { isoDia, sumarDias, diasEntre, parseISO } from '../agenda/calculo.js';
export { isoDia, sumarDias, diasEntre };

const N = (v) => Number(v) || 0;
export const abierto = (it) => it.estado === 'abierta' || it.estado === 'arrastrada';
export const esDe = (it, uid) => !uid || it.propietario === uid || (Array.isArray(it.responsables) && it.responsables.includes(uid));
export const enBandeja = (it) => abierto(it) && (it.bandeja === true || (!it.cuando && !it.fecha_limite && !it.proyecto_id && it.tipo !== 'acuerdo' && it.tipo !== 'punto'));
const snoozeada = (it, hoyIso) => it.snooze_hasta && it.snooze_hasta > hoyIso;

/** Lo de hoy para una persona. */
export function hoyDe(items, uid, hoy = new Date(), { reuniones = [], google = [], ahora = hoy } = {}) {
  const hoyIso = isoDia(hoy);
  const mios = items.filter((it) => esDe(it, uid) && !snoozeada(it, hoyIso));
  const deHoy = mios.filter((it) => abierto(it) && !enBandeja(it) && ((it.cuando && it.cuando === hoyIso) || (!it.cuando && it.fecha_limite === hoyIso)));
  const deAyer = mios.filter((it) => abierto(it) && !enBandeja(it) && ((it.cuando && it.cuando < hoyIso) || (!it.cuando && it.fecha_limite && it.fecha_limite < hoyIso)));
  const hechasHoy = mios.filter((it) => (it.estado === 'hecha') && String(it.completado_en || it.updated_at || '').slice(0, 10) === hoyIso);
  const ordenar = (a, b) => (a.hora || '99') .localeCompare(b.hora || '99') || N(a.orden_dia) - N(b.orden_dia) || String(a.created_at).localeCompare(String(b.created_at));
  deHoy.sort(ordenar);
  const esHoyG = (e) => String(e.inicio || e.start || '').slice(0, 10) === hoyIso;
  const reunionesHoy = reuniones.filter((r) => String(r.fecha || '').slice(0, 10) === hoyIso && r.tipo !== 'viaje');
  const googleHoy = google.filter(esHoyG);
  const minTareas = deHoy.reduce((s, it) => s + N(it.duracion_min), 0);
  const minReuniones = reunionesHoy.reduce((s, r) => s + (N(r.duracion_min) || 60), 0) + googleHoy.reduce((s, e) => s + (e.inicio && e.fin ? Math.max(0, (new Date(e.fin) - new Date(e.inicio)) / 60000) : 0), 0);
  const minReales = hechasHoy.reduce((s, it) => s + N(it.min_real), 0) + deHoy.reduce((s, it) => s + N(it.min_real), 0);
  const cierre = new Date(ahora.getTime() + minTareas * 60000);
  return { deHoy, deAyer, hechasHoy, reunionesHoy, googleHoy, minTareas, minReuniones, minReales, cierre, hoyIso,
    sinEstimado: deHoy.filter((it) => !it.duracion_min).length };
}

export function bandejaDe(items, uid, hoy = new Date()) {
  const hoyIso = isoDia(hoy);
  return items.filter((it) => esDe(it, uid) && enBandeja(it) && !snoozeada(it, hoyIso)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

/** Pendientes por horizonte (Things): Hoy · Próximos 7 · Cuando sea · Algún día(snooze) · por área/proyecto. */
export function pendientesDe(items, uid, hoy = new Date()) {
  const hoyIso = isoDia(hoy);
  const mios = items.filter((it) => esDe(it, uid) && abierto(it) && !enBandeja(it) && it.tipo !== 'idea' && it.tipo !== 'nota');
  const fechaDe = (it) => it.cuando || it.fecha_limite || null;
  const g = { vencidos: [], hoy: [], proximos: [], despues: [], cuandoSea: [], algunDia: [] };
  for (const it of mios) {
    if (snoozeada(it, hoyIso)) { g.algunDia.push(it); continue; }
    const f = fechaDe(it);
    if (!f) { g.cuandoSea.push(it); continue; }
    const d = diasEntre(hoyIso, f);
    if (d < 0) g.vencidos.push(it); else if (d === 0) g.hoy.push(it); else if (d <= 7) g.proximos.push(it); else g.despues.push(it);
  }
  const porFecha = (a, b) => String(fechaDe(a) || '9').localeCompare(String(fechaDe(b) || '9')) || String(a.hora || '99').localeCompare(String(b.hora || '99'));
  for (const k of Object.keys(g)) g[k].sort(porFecha);
  return g;
}

export function porProyecto(items, proyectos = [], areas = [], uid) {
  const mios = items.filter((it) => esDe(it, uid) && abierto(it) && !enBandeja(it));
  const porA = new Map(areas.map((a) => [a.id, { area: a, proyectos: [], sueltos: [], abiertos: 0 }]));
  const sinArea = { area: null, proyectos: [], sueltos: [], abiertos: 0 };
  const porP = new Map(proyectos.map((p) => [p.id, { proyecto: p, items: [] }]));
  for (const it of mios) {
    if (it.proyecto_id && porP.has(it.proyecto_id)) porP.get(it.proyecto_id).items.push(it);
    else (it.area_id && porA.has(it.area_id) ? porA.get(it.area_id) : sinArea).sueltos.push(it);
  }
  for (const p of porP.values()) { const dest = p.proyecto.area_id && porA.has(p.proyecto.area_id) ? porA.get(p.proyecto.area_id) : sinArea; dest.proyectos.push(p); }
  const lista = [...porA.values(), sinArea].map((a) => ({ ...a, abiertos: a.sueltos.length + a.proyectos.reduce((s, p) => s + p.items.length, 0) }));
  return lista.filter((a) => a.area || a.abiertos > 0);
}

/** Conteos por día para el mes en pequeño: Map(iso → { tareas, hechas, reuniones, google }). */
export function conteosMes(items, uid, { reuniones = [], google = [] } = {}) {
  const m = new Map();
  const get = (iso) => { if (!m.has(iso)) m.set(iso, { tareas: 0, hechas: 0, reuniones: 0, google: 0 }); return m.get(iso); };
  for (const it of items) { if (!esDe(it, uid)) continue; const f = it.cuando || it.fecha_limite; if (!f) continue; if (abierto(it)) get(f).tareas += 1; else if (it.estado === 'hecha') get(f).hechas += 1; }
  for (const r of reuniones) { const f = String(r.fecha || '').slice(0, 10); if (f) get(f).reuniones += 1; }
  for (const e of google) { const f = String(e.inicio || e.start || '').slice(0, 10); if (f) get(f).google += 1; }
  return m;
}

/** Bloques del reloj del día: reuniones, eventos de Google y tareas con hora → [{ id, tipo, titulo, ini(min), fin(min), ref }]. */
export function bloquesDia(h, { hoyIso }) {
  const min = (hhmm) => { const [a, b] = String(hhmm).split(':').map(Number); return a * 60 + (b || 0); };
  const out = [];
  for (const e of h.googleHoy) { const i = new Date(e.inicio || e.start), f = e.fin || e.end ? new Date(e.fin || e.end) : null; if (Number.isNaN(i.getTime()) || e.todoElDia) continue; const ini = i.getHours() * 60 + i.getMinutes(); out.push({ id: `g-${e.id}`, tipo: 'google', titulo: e.titulo || e.summary || 'Evento', ini, fin: f ? f.getHours() * 60 + f.getMinutes() : ini + 60, ref: e }); }
  for (const r of h.reunionesHoy) { if (r.google_event_id && out.some((b) => b.ref?.id === r.google_event_id)) continue; const d = new Date(r.fecha); const ini = d.getHours() * 60 + d.getMinutes(); out.push({ id: `r-${r.id}`, tipo: 'reunion', titulo: r.titulo, ini, fin: ini + (N(r.duracion_min) || 60), ref: r }); }
  for (const it of [...h.deHoy, ...h.hechasHoy]) { if (!it.hora) continue; const ini = min(it.hora); out.push({ id: `t-${it.id}`, tipo: it.estado === 'hecha' ? 'hecha' : 'tarea', titulo: it.titulo, ini, fin: ini + (N(it.duracion_min) || 30), ref: it }); }
  return out.sort((a, b) => a.ini - b.ini);
}

export const fmtMin = (m) => { m = Math.round(N(m)); if (m < 60) return `${m} min`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h} h ${r} min` : `${h} h`; };
export const fmtHora = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function fraseHoy(h, nombre = '') {
  const n = h.deHoy.length;
  if (!n && !h.reunionesHoy.length && !h.googleHoy.length) return h.hechasHoy.length ? `Hoy cerraste ${h.hechasHoy.length} pendiente${h.hechasHoy.length === 1 ? '' : 's'}. Nada más planeado.` : 'Nada planeado para hoy. Captura o jala algo de la Bandeja.';
  const partes = [`${n} pendiente${n === 1 ? '' : 's'}`];
  if (h.minTareas) partes.push(`${fmtMin(h.minTareas)} planeadas`);
  const reus = h.reunionesHoy.length + h.googleHoy.length; if (reus) partes.push(`${reus} reunión${reus === 1 ? '' : 'es'}`);
  if (h.deAyer.length) partes.push(`${h.deAyer.length} de ayer`);
  return `${partes.join(' · ')}${h.minTareas ? ` · con eso cierras a las ${fmtHora(h.cierre)}` : ''}.`;
}
