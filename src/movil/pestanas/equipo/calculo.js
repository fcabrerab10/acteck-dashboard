// Actividad del equipo en el celular · cálculo puro (3.88.0 · 2026-10-06, mockup 2c58bf4c aprobado por Fernando).
// Todo lo que se pinta en Equipo.jsx / Persona.jsx / EvaluacionM.jsx que no viene ya de src/modules/interno/equipo/calculo.js
// vive aquí, sin React ni red, para probarse con scripts/test-equipo-movil.mjs. Sin costos ni márgenes.
import { isoDia, sumarDias, TIPO_HEARTBEAT } from '../../../modules/interno/equipo/calculo.js';
import { plural, nombreCorto, fmtHmCorto, DIAS_CORTO, MESES_CORTO } from '../../../modules/interno/equipo/textos.js';
import { tienePausa } from '../../../modules/agenda5/dia/ritmo.js';

export const CLIENTE_TXT = { digitalife: 'Digitalife', pcel: 'PCEL', dicotech: 'Dicotech' };
const etiquetaCliente = (k) => CLIENTE_TXT[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ') : null);

// ─── Serie «actividad por día · 4 semanas» ───

/** Un punto por día (los últimos `dias`, hoy al final): personas distintas con eventos y horas de latido. */
export function serieActividadDias(eventos, { hoy, dias = 28, soloUsuarios = null } = {}) {
  hoy = hoy || new Date();
  const m = new Map();
  for (let i = dias - 1; i >= 0; i--) {
    const d = sumarDias(hoy, -i);
    m.set(isoDia(d), { dia: isoDia(d), fecha: d, personas: new Set(), minutos: 0 });
  }
  for (const e of eventos || []) {
    if (soloUsuarios && !soloUsuarios.has(e.user_id)) continue;
    const p = m.get(isoDia(e.ts)); if (!p) continue;
    p.personas.add(e.user_id);
    if (e.tipo === TIPO_HEARTBEAT) p.minutos += 1;
  }
  return [...m.values()].map((p) => ({
    dia: p.dia, label: `${DIAS_CORTO[p.fecha.getDay()]} ${p.fecha.getDate()} ${MESES_CORTO[p.fecha.getMonth()].toLowerCase()}`,
    lunes: p.fecha.getDay() === 1, personas: p.personas.size, horas: Math.round((p.minutos / 60) * 10) / 10,
  }));
}

/** Etiqueta del eje: «L» en cada lunes, nada el resto. */
export const etiquetaDia = (f) => (f.lunes ? 'L' : '');

// ─── Pantalla Equipo ───

/** Quién concentra los vencidos: [{ nombre, n }] desc. */
export function vencidosPorPersona(usuarios, porUsuario) {
  return (usuarios || [])
    .map((u) => ({ nombre: nombreCorto(u.nombre || u.email), n: (porUsuario?.get?.(u.user_id)?.vencidos || []).length }))
    .filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
}

export const lineaVencidos = (lista, max = 3) => (lista.length ? lista.slice(0, max).map((x) => `${x.nombre} ${x.n}`).join(' · ') : 'nadie trae vencidos');

/** Quién lleva más días sin entrar o sin cerrar: { nombre, dias, sinEntrar } o null. */
export function masRezagado(usuarios, porUsuario) {
  let mejor = null;
  for (const u of usuarios || []) {
    const inact = porUsuario?.get?.(u.user_id)?.inact; if (!inact) continue;
    const dias = inact.sinEntrar ? inact.diasSinEntrar : inact.diasSinCerrar;
    if (!mejor || dias > mejor.dias) mejor = { nombre: nombreCorto(u.nombre || u.email), dias, sinEntrar: inact.sinEntrar };
  }
  return mejor;
}

/** Última entrada del equipo: { nombre, ts } o null. */
export function ultimoEnEntrar(usuarios, porUsuario) {
  let mejor = null;
  for (const u of usuarios || []) {
    const ts = porUsuario?.get?.(u.user_id)?.tele?.ultimo; if (!ts) continue;
    if (!mejor || String(ts) > String(mejor.ts)) mejor = { nombre: nombreCorto(u.nombre || u.email), ts };
  }
  return mejor;
}

/** «hace 12 min» · «hace 3 h» · «ayer» · «hace 4 d». */
export function haceCuanto(ts, hoy) {
  if (!ts) return 'sin registro';
  const ms = (hoy || new Date()).getTime() - new Date(ts).getTime();
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24 && isoDia(ts) === isoDia(hoy || new Date())) return `hace ${h} h`;
  const d = Math.round(ms / 86400000);
  if (d <= 1) return 'ayer';
  return `hace ${d} d`;
}

/**
 * Frase del hero de Equipo: «5 de 7 entraron hoy; el equipo trae 9 pendientes vencidos (6 de Karolina) y el 78 % de los
 * pendientes de 30 días se cerró a tiempo. David lleva 4 días sin entrar.»
 */
export function fraseEquipo({ pulso, total, vencidos = [], rezagado = null, agendaDisponible = true }) {
  if (!total) return 'Sin usuarios internos activos.';
  const a = pulso.activosHoy;
  const partes = [];
  partes.push(a === 0 ? 'Nadie ha entrado hoy todavía' : a === total ? `Los ${total} entraron hoy` : `${a} de ${total} entraron hoy`);
  if (agendaDisponible) {
    const v = pulso.vencidosEquipo || 0;
    const quien = vencidos[0] ? ` (${vencidos[0].n} de ${vencidos[0].nombre})` : '';
    const at = pulso.pctATiempo != null ? ` y el ${pulso.pctATiempo} % de los pendientes de 30 días se cerró a tiempo` : '';
    partes.push(v > 0 ? `el equipo trae ${plural(v, 'pendiente vencido', 'pendientes vencidos')}${quien}${at}` : `el equipo no trae pendientes vencidos${at}`);
  }
  let s = `${partes.join('; ')}.`;
  if (rezagado) s += ` ${rezagado.nombre} lleva ${plural(rezagado.dias, 'día hábil', 'días hábiles')} ${rezagado.sinEntrar ? 'sin entrar' : 'sin cerrar pendientes'}.`;
  return s;
}

/** Sub del hero: «14 h activas esta semana · 23 sesiones · 2 evaluaciones de septiembre sin cerrar». */
export function subEquipo({ pulso, evalsPendientes = [], hoy }) {
  const p = [`${fmtHmCorto(pulso.minutosSemana || 0)} activas esta semana`, plural(pulso.sesionesSemana || 0, 'sesión', 'sesiones')];
  if (evalsPendientes.length) {
    const d = hoy || new Date(); const mesAnt = (d.getMonth() + 11) % 12;
    p.push(`${plural(evalsPendientes.length, 'evaluación', 'evaluaciones')} de ${MESES_CORTO[mesAnt].toLowerCase()} sin cerrar`);
  }
  return p.join(' · ');
}

// ─── Ritmo y «su día» (fila y ficha de persona) ───

/** «9:00 → 15:00 · 17:00 → 22:00» o «9:00 → 18:00»; null sin ritmo. */
export function ritmoTexto(horas) {
  if (!horas || !horas.armar || !horas.cierre) return null;
  const h = horas;
  const t = (x) => String(x || '').replace(/^0/, '');
  return tienePausa(h) ? `${t(h.armar)} → ${t(h.pausa)} · ${t(h.retomar)} → ${t(h.cierre)}` : `${t(h.armar)} → ${t(h.cierre)}`;
}

/** Línea bajo el nombre en la lista: ritmo · si armó su día · plan vs real / hechos · cliente que más tocó. */
export function lineaPersona({ u, datos, hoy }) {
  const { tele, agenda } = datos || {};
  const p = [];
  const ritmo = ritmoTexto(u?.preferencias?.agenda?.horas);
  p.push(ritmo || 'sin ritmo configurado');
  if (agenda) {
    const deHoy = (agenda.deHoy || []).length, hechas = (agenda.hechasHoy || []).length, total = deHoy + hechas;
    if (total === 0) p.push('sin armar su día');
    else {
      p.push('día armado');
      if (agenda.minPlanHoy > 0) p.push(`plan ${fmtHmCorto(agenda.minPlanHoy)}${agenda.minRealHoy ? ` · real ${fmtHmCorto(agenda.minRealHoy)}` : ''}`);
      else p.push(`${hechas} de ${total} hechos`);
    }
  }
  if (tele?.clienteTop && !agenda) p.push(['', 'Digitalife', 'PCEL', 'Dicotech', 'Mercado Libre'][tele.clienteTop] || '');
  return p.filter(Boolean).join(' · ');
}

/** Pill de estado de la fila: activo · hace 12 min · N d sin entrar. */
export function estadoPersona({ datos, hoy, externo = false }) {
  const { tele, inact } = datos || {};
  if (!externo && inact?.sinEntrar) return { tone: 'red', label: `${inact.diasSinEntrar} d sin entrar` };
  if (!externo && inact?.sinCerrar) return { tone: 'orange', label: `${inact.diasSinCerrar} d sin cerrar` };
  if (!tele?.ultimo) return { tone: 'gray', label: 'sin entrar' };
  const min = ((hoy || new Date()).getTime() - new Date(tele.ultimo).getTime()) / 60000;
  if (min <= 5) return { tone: 'green', label: 'activo' };
  if (tele.activoHoy) return { tone: 'green', label: haceCuanto(tele.ultimo, hoy) };
  return { tone: 'gray', label: haceCuanto(tele.ultimo, hoy) };
}

/** Sub del título de la ficha: «asistente comercial · 8:30 → 13:00 · 14:00 → 18:00 · activa hace 8 min». */
export function subPersona({ u, tele, hoy }) {
  const p = [u?.puesto || u?.rol || (u?.tipo === 'externo' ? 'externo' : null)];
  const r = ritmoTexto(u?.preferencias?.agenda?.horas); if (r) p.push(r);
  if (tele?.ultimo) p.push(tele.activoHoy ? `${u?.genero === 'f' ? 'activa' : 'activo'} ${haceCuanto(tele.ultimo, hoy)}` : `última entrada ${haceCuanto(tele.ultimo, hoy)}`);
  else p.push('sin entrar en 28 días');
  return p.filter(Boolean).join(' · ');
}

/** Vencidos por cliente: «4 Pagos · 2 Digitalife» (cliente_key o, si no, tipo). */
export function vencidosPorGrupo(vencidos = [], max = 2) {
  const m = new Map();
  for (const i of vencidos) {
    const k = etiquetaCliente(i.cliente_key) || (i.tipo === 'punto' ? 'reuniones' : i.origen?.hilo || 'sin cliente');
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m].sort((a, b) => b[1] - a[1]).slice(0, max).map(([k, n]) => `${n} ${k}`).join(' · ');
}

/**
 * Frase del hero «Hoy» de la persona: «Armó su día a las 8:34 con 14 pendientes; lleva 11 hechos y 3 h 10 de las 5 h
 * planeadas. Trae 6 vencidos, 4 de Pagos.» Con `s` = datosSuDia() y `vencidos` = lista de vencidos (30 d).
 */
export function frasePersonaHoy({ u, s, vencidos = [], registro = null, hoy }) {
  const nombre = nombreCorto(u?.nombre || u?.email);
  const total = (s?.deHoy || []).length + (s?.hechas || []).length;
  const hechas = (s?.hechas || []).length;
  const partes = [];
  if (total === 0) partes.push(`${nombre} no ha armado su día`);
  else {
    let t = `Armó su día con ${plural(total, 'pendiente')}; lleva ${plural(hechas, 'hecho')}`;
    if (s.plan > 0) t += ` y ${fmtHmCorto(s.real || 0)} de las ${fmtHmCorto(s.plan)} planeadas`;
    partes.push(t);
  }
  const v = vencidos.length;
  if (v > 0) { const g = vencidosPorGrupo(vencidos, 1); partes.push(`Trae ${plural(v, 'vencido')}${g ? `, ${g}` : ''}`); }
  else partes.push('No trae vencidos');
  return `${partes.join('. ')}.`;
}

const ENERGIA_TXT = { 1: '1/4', 2: '2/4', 3: '3/4', 4: '4/4' };
export function fmtHoraCorta(iso) { const d = new Date(iso); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; }

/** Sub del hero de la persona: «cerró ayer a las 18:12 con energía 4/4 · «faltó cuadrar el BPRM-102»» o la semana. */
export function subPersonaHoy({ registro, tele }) {
  if (registro?.cerrado_at) {
    const p = [`cerró a las ${fmtHoraCorta(registro.cerrado_at)}${registro.energia ? ` con energía ${ENERGIA_TXT[registro.energia] || registro.energia}` : ''}`];
    if (registro.resumen) p.push(`«${registro.resumen}»`);
    return p.join(' · ');
  }
  return `${plural(tele?.diasActivosSemana ?? 0, 'día')} de 5 esta semana · ${fmtHmCorto(tele?.minutosSemana || 0)} activas`;
}

/** Días de la semana (L–D) con minutos por día: [{ dia, letra, minutos, hoy, futuro }]. */
export function diasSemana(tele, { hoy, inicio } = {}) {
  hoy = hoy || new Date();
  const hoyIso = isoDia(hoy);
  const porDia = new Map();
  for (const s of tele?.sesiones || []) porDia.set(s.dia, (porDia.get(s.dia) || 0) + s.minutos);
  const letras = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  return Array.from({ length: 7 }, (_, i) => { const d = sumarDias(inicio, i); const iso = isoDia(d); return { dia: iso, letra: letras[i], minutos: porDia.get(iso) || 0, hoy: iso === hoyIso, futuro: iso > hoyIso }; });
}

/** «Lo que más tocó: Pagos (18 acciones) · Agenda (11) · Sell Out (6)» desde acciones por área y pantallas de la telemetría. */
export function loQueMasToco(acc, tele, { paginaLabel = {} } = {}) {
  const m = new Map();
  for (const a of acc?.lista || []) { const k = a.area || a.label; m.set(k, (m.get(k) || 0) + 1); }
  const acciones = [...m].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} (${plural(n, 'acción', 'acciones')})`);
  if (acciones.length) return `Lo que más tocó: ${acciones.join(' · ')}`;
  const pags = (tele?.paginasTop || []).map(([p, n]) => `${paginaLabel[p] || `p${p}`} ${fmtHmCorto(n)}`);
  return pags.length ? `Pantallas: ${pags.join(' · ')}` : 'Sin acciones ni pantallas registradas.';
}

// ─── Evaluación ───

/**
 * «Va en 4.2 de 5: cumplió 17 de 20 tareas y el 74 % de sus pendientes a tiempo. Bono del mes $4,200 con un ajuste de −$300.»
 */
export function fraseEvaluacion({ ratings = [], tareas = [], pctATiempo = null, bonoTotal = 0, ajustes = 0, cerrada = false, fmt = (n) => `$${Math.round(n).toLocaleString('en-US')}` }) {
  const rats = ratings.filter((r) => r > 0);
  const prom = rats.length ? Math.round((rats.reduce((s, v) => s + v, 0) / rats.length) * 10) / 10 : null;
  const cumplidas = tareas.filter((t) => t.cumplida).length;
  const p = [];
  const cab = prom != null ? `${cerrada ? 'Cerró' : 'Va'} en ${prom} de 5` : `${rats.length === 0 ? 'Sin calificar aún' : ''}`;
  const cuerpo = [];
  if (tareas.length) cuerpo.push(`cumplió ${cumplidas} de ${plural(tareas.length, 'tarea')}`);
  if (pctATiempo != null) cuerpo.push(`el ${pctATiempo} % de sus pendientes a tiempo`);
  p.push(cuerpo.length ? `${cab || 'Este mes'}: ${cuerpo.join(' y ')}` : cab || 'Sin tareas ni calificaciones todavía');
  let b = `Bono del mes ${fmt(bonoTotal)}`;
  if (ajustes) b += ` con un ajuste de ${ajustes < 0 ? '−' : '+'}${fmt(Math.abs(ajustes))}`;
  p.push(b);
  return `${p.join('. ')}.`;
}

/** Sub del hero de evaluación: «calificación promedio de los últimos 3 meses 4.0 · 2 rubros por calificar». */
export function subEvaluacion({ ratings = [], historial = [], nRubros = 5 }) {
  const porCalificar = nRubros - ratings.filter((r) => r > 0).length;
  const prev = historial.filter((h) => h != null);
  const p = [];
  if (prev.length) p.push(`promedio de los últimos ${plural(prev.length, 'mes', 'meses')} ${(Math.round((prev.reduce((s, v) => s + v, 0) / prev.length) * 10) / 10)}`);
  p.push(porCalificar > 0 ? `${plural(porCalificar, 'rubro')} por calificar` : 'todos los rubros calificados');
  return p.join(' · ');
}

/** Promedio de ratings de una evaluación (null si ninguno). */
export function promedioRatings(evaluacion, keys) {
  const r = keys.map((k) => Number(evaluacion?.[k]) || 0).filter((v) => v > 0);
  return r.length ? r.reduce((s, v) => s + v, 0) / r.length : null;
}

/** Texto para «Mandar mensaje»: los vencidos y lo de hoy de la persona, para WhatsApp. */
export function textoMensaje({ u, vencidos = [], deHoy = [], hoy }) {
  const nombre = nombreCorto(u?.nombre || u?.email);
  const l = [`Hola ${nombre},`];
  if (vencidos.length) { l.push('', `Traes ${plural(vencidos.length, 'pendiente vencido', 'pendientes vencidos')}:`); for (const i of vencidos.slice(0, 8)) l.push(`• ${i.titulo}${i.fecha_limite ? ` (límite ${String(i.fecha_limite).slice(0, 10)})` : ''}`); }
  if (deHoy.length) { l.push('', `Para hoy tienes ${plural(deHoy.length, 'pendiente')}:`); for (const i of deHoy.slice(0, 6)) l.push(`• ${i.hora ? `${i.hora} ` : ''}${i.titulo}`); }
  if (!vencidos.length && !deHoy.length) l.push('', 'No traes vencidos ni pendientes para hoy. ¡Gracias!');
  return l.join('\n');
}
