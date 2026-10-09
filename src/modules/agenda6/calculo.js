// Agenda «que te lleva» (V6 · 2026-10-08) · cálculo puro, sin React ni red. Pruebas: scripts/test-agenda6.mjs
//   estadoDelDia()      → momento del día (organizar · trabajar · cierre), lo que quedó de antes, avance, si ayer no se cerró
//   interpretarLibre()  → captura sin etiquetas: nombres de personas y clientes dentro del texto → chips confirmables
//   delegadas()         → lo que mandé a otros (vencidas · en curso · hechas), por persona
//   porCliente()        → lo abierto de cada cliente: tareas con el chip, acuerdos de minutas, lo mandado con ese cliente
//   movidaDe()/inversa  → qué guardar antes de cada acción y cómo deshacerla
import { interpretarCaptura } from '../agenda5/interpretar.js';
import { CLIENTES_AGENDA, normalizar, conHandles } from '../agenda5/base/etiquetas.js';
import { momentoDe, HORAS_DEFAULT } from '../agenda5/dia/proponer.js';
import { hoyDe, isoDia, sumarDias, abierto, esDe, enBandeja } from '../agenda5/calculo.js';

const N = (v) => Number(v) || 0;
export const isoDe = (d) => isoDia(d);
export const sumarDiasIso = (iso, n) => isoDia(sumarDias(new Date(`${iso}T12:00:00`), n));

// ─── Estado del día ───

/**
 * @param {object} p  items, uid, hoy, horas (ritmo), registros (agenda_registro_dia del usuario), organizadoHoy (bool)
 * @returns { momento, hoyIso, ayerIso, ayerSinCerrar, ayer: { hechas, total } | null, quedo: [vencidas+arrastradas], h: hoyDe(), avance }
 */
export function estadoDelDia({ items = [], uid, hoy = new Date(), horas = HORAS_DEFAULT, registros = [], organizadoHoy = false, reuniones = [], google = [] } = {}) {
  const hoyIso = isoDia(hoy);
  // Mi día = lo que ME toca hacer: donde soy responsable (o no hay responsable). Lo que mandé a otros vive en «Lo que mandé».
  const mios = items.filter((it) => !(it.responsables || []).length || (it.responsables || []).includes(uid) || (!it.responsables && it.propietario === uid));
  const h = hoyDe(mios, uid, hoy, { reuniones, google, ahora: hoy });
  const momento = momentoDe(hoy, horas);
  const regHoy = registros.find((r) => r.usuario === uid && r.fecha === hoyIso) || null;
  const cerradoHoy = !!regHoy?.cerrado_at;
  // Ayer (o el último día hábil con actividad): ¿se cerró? Sólo cuenta si hubo tareas ese día.
  const ayerIso = ultimoDiaConActividad(items, uid, hoyIso);
  const regAyer = ayerIso ? registros.find((r) => r.usuario === uid && r.fecha === ayerIso) : null;
  const deAyer = ayerIso ? items.filter((it) => esDe(it, uid) && ((it.cuando === ayerIso) || (!it.cuando && it.fecha_limite === ayerIso) || (it.estado === 'hecha' && String(it.completado_en || '').slice(0, 10) === ayerIso))) : [];
  const ayer = ayerIso && deAyer.length ? { fecha: ayerIso, hechas: deAyer.filter((it) => it.estado === 'hecha').length, total: deAyer.length } : null;
  const ayerSinCerrar = !!ayer && !regAyer?.cerrado_at;
  // Lo que quedó: vencidas (cuando/límite < hoy) + arrastradas, de más vieja a más nueva.
  const quedo = h.deAyer.slice().sort((a, b) => String(a.cuando || a.fecha_limite || '').localeCompare(String(b.cuando || b.fecha_limite || '')));
  const total = h.deHoy.length + h.hechasHoy.length;
  const avance = { hechas: h.hechasHoy.length, total, pct: total ? Math.round((h.hechasHoy.length / total) * 100) : 0 };
  const fase = cerradoHoy ? 'cerrado' : momento === 'cierre' ? 'cierre' : (!organizadoHoy && (momento === 'antes' || momento === 'trabajar') && !regHoy?.organizado_at) ? 'organizar' : 'trabajar';
  return { momento, fase, hoyIso, ayerIso, ayer, ayerSinCerrar, quedo, h, avance, cerradoHoy, regHoy, regAyer };
}

/** Último día anterior a hoy en el que el usuario tenía algo (para saber si quedó sin cerrar). Mira hasta 7 días atrás. */
export function ultimoDiaConActividad(items, uid, hoyIso) {
  for (let i = 1; i <= 7; i++) {
    const d = sumarDiasIso(hoyIso, -i);
    if (items.some((it) => esDe(it, uid) && ((it.cuando === d) || (!it.cuando && it.fecha_limite === d) || (it.estado === 'hecha' && String(it.completado_en || '').slice(0, 10) === d)))) return d;
  }
  return null;
}

/** Frase corta de la tarjeta de arriba según la fase. */
export function fraseDia(e, nombre = '') {
  const n = e.h.deHoy.length, q = e.quedo.length;
  if (e.fase === 'organizar') return `${nombre ? `${nombre}, antes` : 'Antes'} de empezar, organiza tu día${q ? `: traes ${q} de antes` : ''}.`;
  if (e.fase === 'cierre') return `Hiciste ${e.avance.hechas} de ${e.avance.total}. ${n ? `${n} se van a mañana si cierras.` : 'Nada queda abierto.'}`;
  if (e.fase === 'cerrado') return `Día cerrado: ${e.avance.hechas} de ${e.avance.total} hechas.`;
  return n ? `Vas ${e.avance.hechas} de ${e.avance.total}.${q ? ` Traes ${q} de antes.` : ''}` : (e.avance.hechas ? `Todo hecho: ${e.avance.hechas} de ${e.avance.total}.` : 'Nada planeado para hoy.');
}

// ─── Captura libre ───

const STOP = new Set(['a', 'al', 'con', 'de', 'del', 'para', 'por', 'el', 'la', 'los', 'las', 'y', 'en', 'que', 'le', 'se']);
const SUJ = /\b(pedirle|pedir|mandar|mandarle|decirle|avisarle|avisar|recordarle|preguntarle|enviarle|pasarle|ver con|hablar con|revisar con|junta con|llamar a|llamarle a)\s+a?\s*$/i;

/**
 * Captura en lenguaje natural SIN símbolos obligatorios: además de lo que ya entiende interpretarCaptura (#cliente,
 * @persona, fechas, horas, duración, prioridad, tipo) detecta nombres de personas del equipo y clientes escritos a secas
 * («Pedirle a Karolina…», «Llamar a Carlos de Digitalife», «la OC de PCEL», «Karolina: cuadrar apoyos»).
 * Devuelve lo mismo que interpretarCaptura + { clientes: [...], responsables: [...], chips: [...] } con chips confirmables.
 */
export function interpretarLibre(texto, personas = [], hoy = new Date()) {
  const base = interpretarCaptura(texto, personas, hoy);
  const t = String(texto || '');
  const n = normalizar(t);
  const lista = conHandles(personas);
  const responsables = [...(base.responsables || [])];
  // Personas: nombre de pila, handle o «nombre: …» al inicio. Sólo cuando el texto lo nombra como destinatario o al inicio.
  for (const p of lista) {
    const nombre = normalizar(p.nombre || '').split(/\s+/)[0];
    if (!nombre || nombre.length < 3) continue;
    const re = new RegExp(`(^|[^a-z0-9])${nombre}(?=$|[^a-z0-9])`);
    const m = re.exec(n);
    if (!m) continue;
    const antes = n.slice(0, m.index + (m[1] ? 1 : 0));
    const alInicio = m.index + (m[1] ? 1 : 0) === 0 && /^[a-z]+\s*:/.test(n);
    const destinatario = SUJ.test(antes) || /(?:^|\s)(?:a|con|para|y|e)\s*$/.test(antes) || alInicio;
    if (destinatario && !responsables.includes(p.user_id)) responsables.push(p.user_id);
  }
  // Clientes: label o alias (≥ 3 letras) en cualquier parte; el primero es el principal, los demás van en `clientes`.
  const clientes = [];
  if (base.cliente_key && base.cliente_key !== 'interno') clientes.push(base.cliente_key);
  for (const c of CLIENTES_AGENDA) {
    if (c.key === 'interno') continue;
    const nombres = [normalizar(c.label), ...c.alias.filter((a) => a.length >= 3), c.key].filter(Boolean);
    const hit = nombres.some((x) => new RegExp(`(^|[^a-z0-9])${x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^a-z0-9])`).test(n));
    if (hit && !clientes.includes(c.key)) clientes.push(c.key);
  }
  // Título limpio: quitar «Karolina:» inicial y mantener el resto tal cual (los nombres dentro de la frase se quedan: son parte del pendiente).
  let titulo = base.titulo.replace(/^[A-Za-zÁÉÍÓÚáéíóúñÑ]+\s*:\s*/, (m0) => (responsables.length ? '' : m0)).trim();
  if (!titulo) titulo = base.titulo;
  const chips = base.chips.filter((c) => c.tipo !== 'persona' && c.tipo !== 'cliente');
  for (const id of responsables) { const p = lista.find((x) => x.user_id === id); chips.push({ tipo: 'persona', valor: id, label: `→ ${p ? (p.nombre || p.email).split(' ')[0] : 'persona'}` }); }
  for (const k of clientes) { const c = CLIENTES_AGENDA.find((x) => x.key === k); chips.push({ tipo: 'cliente', valor: k, label: c?.label || k }); }
  return { ...base, titulo, responsables, cliente_key: clientes[0] || null, clientes, chips };
}

// ─── Delegadas y por cliente ───

/** Lo que mandé: ítems abiertos/hechos recientes donde YO soy propietario (o creador) y hay responsables distintos a mí. */
export function delegadas(items = [], uid, hoy = new Date(), { personasPorId = new Map(), diasHechas = 7 } = {}) {
  const hoyIso = isoDia(hoy), desde = sumarDiasIso(hoyIso, -diasHechas);
  const mias = items.filter((it) => (it.propietario === uid || it.creado_por === uid) && (it.responsables || []).some((u) => u !== uid));
  const fechaDe = (it) => it.cuando || it.fecha_limite || null;
  const conInfo = (it) => ({ ...it, para: (it.responsables || []).filter((u) => u !== uid).map((u) => personasPorId.get(u)).filter(Boolean), fecha: fechaDe(it) });
  const vencidas = mias.filter((it) => abierto(it) && fechaDe(it) && fechaDe(it) < hoyIso).map(conInfo).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  const enCurso = mias.filter((it) => abierto(it) && !(fechaDe(it) && fechaDe(it) < hoyIso)).map(conInfo).sort((a, b) => String(a.fecha || '9').localeCompare(String(b.fecha || '9')));
  const hechas = mias.filter((it) => it.estado === 'hecha' && String(it.completado_en || it.updated_at || '').slice(0, 10) >= desde).map(conInfo).sort((a, b) => String(b.completado_en || '').localeCompare(String(a.completado_en || '')));
  const porPersona = new Map();
  for (const it of [...vencidas, ...enCurso]) for (const p of it.para) porPersona.set(p.user_id, (porPersona.get(p.user_id) || 0) + 1);
  return { vencidas, enCurso, hechas, total: vencidas.length + enCurso.length, porPersona: [...porPersona].map(([id, n]) => ({ persona: personasPorId.get(id), n })).filter((x) => x.persona).sort((a, b) => b.n - a.n || String(a.persona.nombre).localeCompare(String(b.persona.nombre))) };
}

/** Lo abierto de cada cliente: tareas con el chip (principal o adicional), acuerdos de minutas (tipo punto) y lo mandado. */
export function porCliente(items = [], reuniones = [], uid, hoy = new Date()) {
  const hoyIso = isoDia(hoy);
  const reunionesPorId = new Map(reuniones.map((r) => [r.id, r]));
  const m = new Map();
  for (const it of items) {
    if (!abierto(it)) continue;
    const keys = [it.cliente_key, ...(it.clientes || [])].filter((k) => k && k !== 'interno');
    for (const k of new Set(keys)) {
      const g = m.get(k) || { cliente: k, items: [], acuerdos: 0, mandadas: 0, vencidas: 0, proximaReunion: null };
      const f = it.cuando || it.fecha_limite || null;
      const r = it.reunion_id ? reunionesPorId.get(it.reunion_id) : null;
      g.items.push({ ...it, fecha: f, mia: esDe(it, uid), reunionTitulo: r?.titulo || null, reunionFecha: r ? String(r.fecha).slice(0, 10) : null });
      if (it.tipo === 'punto' || it.tipo === 'acuerdo') g.acuerdos += 1;
      if ((it.responsables || []).some((u) => u !== uid) && (it.propietario === uid || it.creado_por === uid)) g.mandadas += 1;
      if (f && f < hoyIso) g.vencidas += 1;
      m.set(k, g);
    }
  }
  for (const r of reuniones) { if (r.tipo === 'viaje' || !r.cliente_key) continue; const g = m.get(r.cliente_key); if (!g) continue; const f = String(r.fecha).slice(0, 10); if (f >= hoyIso && (!g.proximaReunion || f < g.proximaReunion)) g.proximaReunion = f; }
  const lista = [...m.values()].map((g) => ({ ...g, items: g.items.sort((a, b) => String(a.fecha || '9').localeCompare(String(b.fecha || '9'))) })).sort((a, b) => b.items.length - a.items.length);
  return lista;
}

// ─── Movidas (deshacer) ───
const CAMPOS_MOVIDA = ['estado', 'cuando', 'fecha_limite', 'completado_en', 'responsables', 'bandeja', 'snooze_hasta', 'min_real'];

/** Lo que hay que guardar antes de cambiar un ítem para poder deshacer la acción. */
export function antesDe(item) { const o = {}; for (const k of CAMPOS_MOVIDA) o[k] = item?.[k] ?? null; return o; }

/** Cambios de cada acción de la Agenda V6. */
export function cambiosDe(accion, { hoyIso, destino = null, responsables = null } = {}) {
  switch (accion) {
    case 'hecha': return { estado: 'hecha', completado_en: new Date().toISOString(), bandeja: false };
    case 'reabrir': return { estado: 'abierta', completado_en: null };
    case 'hoy': return { cuando: hoyIso, bandeja: false, snooze_hasta: null, estado: 'abierta' };
    case 'manana': return { cuando: sumarDiasIso(hoyIso, 1), bandeja: false, snooze_hasta: null, estado: 'abierta' };
    case 'semana': return { cuando: destino || sumarDiasIso(hoyIso, 7), bandeja: false, snooze_hasta: null, estado: 'abierta' };
    case 'yano': return { estado: 'cancelada', bandeja: false };
    case 'mandar': return { responsables: responsables || [] };
    case 'fecha': return { cuando: destino, bandeja: false };
    default: return {};
  }
}

export const LABEL_MOVIDA = { hecha: 'hecha', reabrir: 'reabierta', hoy: 'para hoy', manana: '→ mañana', semana: '→ esta semana', yano: '«ya no»', mandar: 'mandada', fecha: 'cambió de fecha', organizada: 'organizada' };
