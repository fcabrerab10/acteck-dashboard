// Agenda V5 · captura rápida en lenguaje natural (pura, sin React; pruebas en scripts/test-agenda5-captura.mjs).
//   interpretarCaptura('Llamar a Juan mañana 10am 30m #Dicotech @karolina p1', personas)
//   → { titulo:'Llamar a Juan', cuando:'2026-10-05', hora:'10:00', duracion_min:30, cliente_key:'dicotech',
//       responsables:[uuid], prioridad:'alta', tipo:'tarea', chips:[…] }
// Reusa parsearEtiquetas (#cliente @persona /categoría) y fechaNatural (hoy, mañana, lunes, 15 oct, en 3 días, a las 4…)
// de la Agenda V4 y añade duración (30m · 1h · 1h30 · 45 min), prioridad (p1/p2/p3 · !!! · !!) y tipo
// (idea: · nota: · reunión: · "idea de"). Sin fecha ni hora → va a la Bandeja; con "hoy" → Hoy.
import { parsearEtiquetas, fechaNatural } from './base/etiquetas.js';

const PRIORIDAD = { p1: 'alta', p2: 'media', p3: 'baja', '!!!': 'alta', '!!': 'media', '!': 'baja' };
const TIPOS = [
  { re: /^(idea|ideas?)\s*[:\-–]\s*/i, tipo: 'idea' }, { re: /^(nota|apunte)\s*[:\-–]\s*/i, tipo: 'nota' },
  { re: /^(reuni[oó]n|junta|llamada con|cita)\s*[:\-–]\s*/i, tipo: 'reunion' }, { re: /^(acuerdo)\s*[:\-–]\s*/i, tipo: 'acuerdo' },
];

export function duracionNatural(texto) {
  const n = String(texto || '');
  const re = /(^|\s)(?:por\s+|durante\s+)?(\d{1,2})\s*(?:h|hr|hrs|hora|horas)(?:\s*(\d{1,2})\s*(?:m|min|minutos)?)?\b|(^|\s)(?:por\s+|durante\s+)?(\d{1,3})\s*(?:m|min|mins|minutos)\b/i;
  const m = re.exec(n);
  if (!m) return { min: null, texto: n, frase: '' };
  const min = m[2] != null ? Number(m[2]) * 60 + (m[3] ? Number(m[3]) : 0) : Number(m[5]);
  const desde = m.index + (m[1] || m[4] || '').length;
  return { min, texto: `${n.slice(0, desde)} ${n.slice(m.index + m[0].length)}`.replace(/\s{2,}/g, ' ').trim(), frase: n.slice(desde, m.index + m[0].length).trim() };
}

export function interpretarCaptura(texto, personas = [], hoy = new Date()) {
  let t = String(texto || '').trim();
  const chips = [];
  let tipo = 'tarea';
  for (const x of TIPOS) { if (x.re.test(t)) { tipo = x.tipo; t = t.replace(x.re, ''); chips.push({ tipo: 'tipo', label: tipo === 'reunion' ? 'Reunión' : tipo[0].toUpperCase() + tipo.slice(1) }); break; } }
  let prioridad = null;
  const mp = /(^|\s)(p[123]|!{1,3})(?=\s|$)/i.exec(t);
  if (mp) { prioridad = PRIORIDAD[mp[2].toLowerCase()]; t = `${t.slice(0, mp.index)} ${t.slice(mp.index + mp[0].length)}`.replace(/\s{2,}/g, ' ').trim(); chips.push({ tipo: 'prioridad', label: { alta: 'Prioridad alta', media: 'Prioridad media', baja: 'Prioridad baja' }[prioridad] }); }
  const dur = duracionNatural(t); t = dur.texto;
  if (dur.min) chips.push({ tipo: 'duracion', label: dur.min >= 60 ? `${Math.floor(dur.min / 60)} h${dur.min % 60 ? ` ${dur.min % 60} min` : ''}` : `${dur.min} min` });
  const f = fechaNatural(t, hoy); t = f.texto;
  if (f.fecha) chips.push({ tipo: 'fecha', label: etiquetaFecha(f.fecha, hoy) + (f.hora ? ` ${f.hora}` : '') });
  else if (f.hora) chips.push({ tipo: 'hora', label: f.hora });
  const e = parsearEtiquetas(t, personas);
  if (e.cliente_key) chips.push({ tipo: 'cliente', label: e.cliente_key });
  for (const id of e.responsables || []) { const p = personas.find((x) => x.user_id === id); chips.push({ tipo: 'persona', label: p ? (p.nombre || p.email).split(' ')[0] : 'persona' }); }
  if (e.categoria) chips.push({ tipo: 'categoria', label: e.categoria });
  const esHoy = f.fecha && f.fecha === isoLocal(hoy);
  return {
    titulo: (e.titulo || t).trim(), tipo, prioridad, duracion_min: dur.min, cuando: f.fecha || (f.hora ? isoLocal(hoy) : null), hora: f.hora,
    fecha_limite: tipo === 'tarea' && f.fecha && !esHoy ? f.fecha : null,
    cliente_key: e.cliente_key || null, responsables: e.responsables || [], categoria: e.categoria || null,
    bandeja: !f.fecha && !f.hora && tipo !== 'reunion', chips, desconocidas: e.desconocidas || [],
  };
}

const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function etiquetaFecha(iso, hoy = new Date()) {
  const d = new Date(`${iso}T00:00:00`); const h0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const dif = Math.round((d - h0) / 86400000);
  if (dif === 0) return 'Hoy'; if (dif === 1) return 'Mañana'; if (dif === -1) return 'Ayer';
  if (dif > 1 && dif < 7) return DIAS[d.getDay()];
  return `${d.getDate()} ${MESES[d.getMonth()]}${d.getFullYear() !== hoy.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
}
