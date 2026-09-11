// Agenda · textos para compartir (WhatsApp / PDF) y etiquetas de UI. Lógica pura.
// NO tocar src/lib/whatsapp.js: los textos nuevos de Agenda viven aquí.
import { CATEGORIA_LABEL, nombreClienteAgenda } from './etiquetas.js';
import { fmtCorta, fmtHora, vecesArrastrado, ordinal } from './calculo.js';

export const ESTADO_LABEL = { abierta: 'Abierto', hecha: 'Resuelto', cancelada: 'Cancelado', arrastrada: 'Arrastrado' };
export const ESTADO_REUNION_LABEL = { programada: 'Programada', en_curso: 'En curso', cerrada: 'Cerrada' };
export const PRIORIDAD_LABEL = { baja: 'Baja', media: 'Media', alta: 'Alta' };
export const LUGARES = ['Meet', 'Oficina', 'Teams', 'Zoom', 'Cliente', 'Llamada'];

const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export function fechaLarga(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return `${DIAS_LARGO[x.getDay()]} ${x.getDate()} de ${MESES_LARGO[x.getMonth()]}`;
}

const nombreDe = (uid, personasPorId) => personasPorId?.get(uid)?.nombre || '';
const primerNombre = (s) => String(s || '').split(' ')[0];

/**
 * Minuta en texto limpio para WhatsApp.
 *   *Minuta · PCEL · 10 sep 12:00*
 *   Revisión de sell-out y promos
 *   Asistentes: Fernando, Karolina
 *
 *   *Comercial*
 *   ☐ Promo Buen Fin CL215 · @Fernando · 15 sep
 *   ☑ Fecha de arribo confirmada — quedó: 21 sep PO 7712
 */
export function textoMinuta(reunion, puntos = [], { personasPorId = new Map(), porId } = {}) {
  const f = new Date(reunion.fecha);
  const L = [];
  L.push(`*Minuta · ${nombreClienteAgenda(reunion.cliente_key)} · ${fmtCorta(f)} ${fmtHora(f)}*`);
  L.push(reunion.titulo || '');
  const asis = (reunion.asistentes || []).map((a) => a.nombre || nombreDe(a.user_id, personasPorId)).filter(Boolean);
  if (asis.length) L.push(`Asistentes: ${asis.join(', ')}`);
  if (reunion.lugar) L.push(`Lugar: ${reunion.lugar}`);
  const grupos = new Map();
  for (const p of puntos) { const k = p.categoria || '__sin__'; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(p); }
  const orden = ['comercial', 'marketing', 'pagos', 'administracion', 'logistico', '__sin__'];
  for (const k of orden) {
    const arr = grupos.get(k); if (!arr?.length) continue;
    L.push('');
    L.push(`*${k === '__sin__' ? 'Puntos' : CATEGORIA_LABEL[k]}*`);
    for (const p of arr) L.push(lineaPunto(p, personasPorId, porId));
  }
  if (reunion.notas) { L.push(''); L.push('_Notas_'); L.push(String(reunion.notas).trim()); }
  const abiertos = puntos.filter((p) => p.estado === 'abierta').length;
  L.push('');
  L.push(abiertos ? `${abiertos} punto${abiertos === 1 ? '' : 's'} abierto${abiertos === 1 ? '' : 's'} · se arrastra${abiertos === 1 ? '' : 'n'} a la siguiente reunión` : 'Todos los puntos resueltos ✅');
  return L.join('\n');
}

export function lineaPunto(p, personasPorId = new Map(), porId) {
  const caja = p.estado === 'hecha' ? '☑' : p.estado === 'cancelada' ? '✗' : '☐';
  const resp = (p.responsables || []).map((u) => primerNombre(nombreDe(u, personasPorId))).filter(Boolean).map((n) => `@${n}`).join(' ');
  const n = vecesArrastrado(p, porId);
  const extra = [resp, p.fecha_limite ? fmtCorta(p.fecha_limite) : '', n ? ordinal(n) : ''].filter(Boolean).join(' · ');
  const quedo = p.resolucion ? ` — quedó: ${p.resolucion}` : '';
  return `${caja} ${p.titulo}${extra ? ` · ${extra}` : ''}${quedo}`;
}

/** Bandeja de hoy en texto (para compartir "mi día" o el resumen del equipo). */
export function textoBandeja(b, { personasPorId = new Map(), hoy = new Date(), quien = '' } = {}) {
  const L = [`*Agenda · ${fechaLarga(hoy)}${quien ? ` · ${quien}` : ''}*`];
  const bloque = (titulo, arr) => { if (!arr.length) return; L.push(''); L.push(`*${titulo}* (${arr.length})`); for (const it of arr) L.push(lineaPunto(it, personasPorId)); };
  bloque('Vencidas', b.vencidas);
  bloque('Hoy', b.hoy);
  bloque('Próximos', b.proximos);
  if (!b.vencidas.length && !b.hoy.length && !b.proximos.length) L.push('Nada pendiente 🎉');
  return L.join('\n');
}

/** Subtítulo corto de una reunión: "PCEL · Meet · hoy 12:00 · 45 min". */
export function subReunion(r, hoy = new Date()) {
  const f = new Date(r.fecha);
  const dias = Math.round((new Date(f.getFullYear(), f.getMonth(), f.getDate()) - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) / 86400000);
  const cuando = dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : dias === -1 ? 'ayer' : fmtCorta(f);
  return [nombreClienteAgenda(r.cliente_key), r.lugar, `${cuando} ${fmtHora(f)}`, r.duracion_min ? `${r.duracion_min} min` : null].filter(Boolean).join(' · ');
}
