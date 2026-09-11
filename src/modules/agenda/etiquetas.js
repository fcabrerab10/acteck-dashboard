// Agenda · etiquetas #cliente · @persona · /categoría (lógica pura, sin React ni Supabase).
// Se prueba en Node: node scripts/test-agenda-etiquetas.mjs
//
//   parsearEtiquetas('Enviar edo. de cuenta #pcel @karolina /pagos', personas)
//     → { titulo: 'Enviar edo. de cuenta', cliente_key: 'pcel', responsables: [uuid], categoria: 'pagos', desconocidas: [] }
//   sugerencias('@kar', personas) → [{ tipo:'persona', id, label, insertar:'@karolina' }]
//   tokenActivo('hola #pc', 8) → { tipo:'cliente', texto:'pc', desde:5, hasta:8 }

export const CLIENTES_AGENDA = [
  { key: 'digitalife', label: 'Digitalife', alias: ['dl', 'digi'] },
  { key: 'pcel',       label: 'PCEL',       alias: ['pc'] },
  { key: 'dicotech',   label: 'Dicotech',   alias: ['dt', 'dico', 'revko'] },
  { key: 'interno',    label: 'Interno',    alias: ['int', 'acteck', 'nosotros'] },
];
export const CLIENTE_LABEL = Object.fromEntries(CLIENTES_AGENDA.map((c) => [c.key, c.label]));
export const nombreClienteAgenda = (k) => (k ? CLIENTE_LABEL[k] || (k === 'mercadolibre' ? 'Mercado Libre' : k[0].toUpperCase() + k.slice(1)) : '—');

export const CATEGORIAS = [
  { id: 'comercial',      label: 'Comercial',      corto: 'Com.',  tone: 'blue',   alias: ['com', 'ventas', 'venta'] },
  { id: 'marketing',      label: 'Marketing',      corto: 'Mkt',   tone: 'purple', alias: ['mkt', 'mk'] },
  { id: 'pagos',          label: 'Pagos',          corto: 'Pagos', tone: 'green',  alias: ['pago', 'cobranza', 'factura'] },
  { id: 'administracion', label: 'Administración', corto: 'Adm.',  tone: 'yellow', alias: ['admin', 'adm', 'administración'] },
  { id: 'logistico',      label: 'Logístico',      corto: 'Log.',  tone: 'orange', alias: ['log', 'logistica', 'logística', 'embarque'] },
];
export const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.label]));
export const CATEGORIA_TONE = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.tone]));

/** Sin acentos, minúsculas, sin dobles espacios. */
export const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const tokens = (q) => normalizar(q).split(/\s+/).filter(Boolean);
export const coincide = (hay, q) => tokens(q).every((t) => hay.includes(t));

/** Handle corto de una persona: 'Karolina Veliz' → 'karolina'. Si choca con otra, 'karolina.veliz'. */
export function handleDe(persona, personas = []) {
  const partes = normalizar(persona?.nombre || persona?.email?.split('@')[0] || '').split(/\s+/).filter(Boolean);
  if (!partes.length) return '';
  const corto = partes[0];
  const choca = personas.some((p) => p !== persona && p.user_id !== persona.user_id && normalizar(p.nombre || '').split(/\s+/)[0] === corto);
  return choca && partes[1] ? `${corto}.${partes[1]}` : corto;
}

/** Personas con su handle calculado (entrada: perfiles internos activos). */
export function conHandles(personas = []) {
  return personas.map((p) => ({ ...p, handle: handleDe(p, personas) }));
}

function buscarPersona(texto, personas) {
  const t = normalizar(texto).replace(/[.,;:!?)]+$/, '');
  if (!t) return null;
  const lista = conHandles(personas);
  return lista.find((p) => p.handle === t)
    || lista.find((p) => normalizar(p.nombre || '').split(/\s+/)[0] === t)
    || lista.find((p) => normalizar(p.nombre || '').replace(/\s+/g, '.') === t || normalizar(p.nombre || '').replace(/\s+/g, '') === t)
    || lista.find((p) => normalizar(p.email || '').split('@')[0] === t)
    || null;
}

export function buscarCliente(texto) {
  const t = normalizar(texto).replace(/[.,;:!?)]+$/, '');
  if (!t) return null;
  const c = CLIENTES_AGENDA.find((x) => x.key === t || normalizar(x.label) === t || x.alias.includes(t));
  return c ? c.key : t.replace(/[^a-z0-9_-]/g, '') || null; // texto libre: #mercadolibre, #proveedor
}

export function buscarCategoria(texto) {
  const t = normalizar(texto).replace(/[.,;:!?)]+$/, '');
  if (!t) return null;
  const c = CATEGORIAS.find((x) => x.id === t || normalizar(x.label) === t || x.alias.includes(t));
  return c ? c.id : null;
}

const RE_TAG = /(^|\s)([#@/])([^\s#@/]+)/g;

/**
 * Extrae etiquetas de un texto. Las etiquetas se quitan del título; lo que no se reconoce
 * (p. ej. @alguien que no existe) se conserva en el título y se reporta en `desconocidas`.
 */
export function parsearEtiquetas(texto, personas = []) {
  const out = { titulo: '', cliente_key: null, responsables: [], categoria: null, desconocidas: [] };
  let titulo = String(texto ?? '');
  const quitar = [];
  for (const m of titulo.matchAll(RE_TAG)) {
    const [full, pre, sigla, cuerpo] = m;
    if (sigla === '#') {
      const key = buscarCliente(cuerpo);
      if (key) { if (!out.cliente_key) out.cliente_key = key; quitar.push({ full, pre }); }
    } else if (sigla === '@') {
      const p = buscarPersona(cuerpo, personas);
      if (p) { if (!out.responsables.includes(p.user_id)) out.responsables.push(p.user_id); quitar.push({ full, pre }); }
      else out.desconocidas.push(`@${cuerpo}`);
    } else if (sigla === '/') {
      const cat = buscarCategoria(cuerpo);
      if (cat) { out.categoria = cat; quitar.push({ full, pre }); }
    }
  }
  for (const q of quitar) titulo = titulo.replace(q.full, q.pre ? ' ' : '');
  out.titulo = titulo.replace(/\s{2,}/g, ' ').trim();
  return out;
}

/** Token que se está escribiendo en la posición del cursor: { tipo, texto, desde, hasta } | null. */
export function tokenActivo(texto, cursor) {
  const s = String(texto ?? '');
  const pos = cursor == null ? s.length : cursor;
  const antes = s.slice(0, pos);
  const m = /(?:^|\s)([#@/])([^\s#@/]*)$/.exec(antes);
  if (!m) return null;
  const tipo = m[1] === '#' ? 'cliente' : m[1] === '@' ? 'persona' : 'categoria';
  const desde = pos - m[2].length - 1;
  return { tipo, sigla: m[1], texto: m[2], desde, hasta: pos };
}

/** Sugerencias para el token activo (máx. 8). */
export function sugerencias(token, personas = [], max = 8) {
  if (!token) return [];
  const q = normalizar(token.texto);
  if (token.tipo === 'persona') {
    return conHandles(personas)
      .filter((p) => !q || p.handle.startsWith(q) || normalizar(p.nombre || '').includes(q))
      .slice(0, max)
      .map((p) => ({ tipo: 'persona', id: p.user_id, label: p.nombre || p.email, sub: p.puesto || p.email || '', insertar: `@${p.handle}` }));
  }
  if (token.tipo === 'cliente') {
    return CLIENTES_AGENDA
      .filter((c) => !q || c.key.startsWith(q) || normalizar(c.label).startsWith(q) || c.alias.some((a) => a.startsWith(q)))
      .slice(0, max)
      .map((c) => ({ tipo: 'cliente', id: c.key, label: c.label, sub: `#${c.key}`, insertar: `#${c.key}` }));
  }
  return CATEGORIAS
    .filter((c) => !q || c.id.startsWith(q) || normalizar(c.label).startsWith(q) || c.alias.some((a) => a.startsWith(q)))
    .slice(0, max)
    .map((c) => ({ tipo: 'categoria', id: c.id, label: c.label, sub: `/${c.id}`, insertar: `/${c.id}` }));
}

/** Reemplaza el token activo por la sugerencia y devuelve { texto, cursor }. */
export function aplicarSugerencia(texto, token, sug) {
  const s = String(texto ?? '');
  const nuevo = `${s.slice(0, token.desde)}${sug.insertar} ${s.slice(token.hasta)}`;
  return { texto: nuevo, cursor: token.desde + sug.insertar.length + 1 };
}

/** Texto con etiquetas (para reeditar un ítem): 'Título #pcel @karolina /pagos'. */
export function textoConEtiquetas(item, personas = []) {
  const lista = conHandles(personas);
  const partes = [item?.titulo || ''];
  if (item?.cliente_key) partes.push(`#${item.cliente_key}`);
  for (const uid of item?.responsables || []) { const p = lista.find((x) => x.user_id === uid); if (p) partes.push(`@${p.handle}`); }
  if (item?.categoria) partes.push(`/${item.categoria}`);
  return partes.join(' ').trim();
}

// ─── Fechas en lenguaje natural (captura rápida del celular) ───
// fechaNatural('Mandar muestras #pcel el viernes a las 4 pm', hoy)
//   → { fecha: '2026-09-11', hora: '16:00', texto: 'Mandar muestras #pcel', frase: 'el viernes a las 4 pm' }
// Reconoce: hoy · mañana · pasado mañana · [el|este|próximo] lunes…domingo · 15 sep · 15 de septiembre · 15/09[/2026]
//   · en N días / semanas · la próxima semana · fin de mes · hora ("a las 12", "a las 4 pm", "12:30").
// "por la mañana" / "en la mañana" NO cuenta como fecha. Todo en hora local, sin corrimiento de zona.
const DIAS_NAT = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const MESES_NAT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const NUM_NAT = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, quince: 15 };
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const masDias = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const PRE = '(?:(?:para|hasta|el dia)\\s+)?(?:(?:el|la|este|esta)\\s+)?(?:(?:proximo|proxima|siguiente)\\s+)?';

export function fechaNatural(texto, hoy = new Date()) {
  const orig = String(texto ?? '');
  // Misma longitud que el original: NFD + quitar diacríticos no cambia índices (á → a + ́ → a).
  const n = orig.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const out = { fecha: null, hora: null, texto: orig, frase: '' };
  const quitar = [];
  let m;

  const pruebas = [
    { re: new RegExp(`(^|\\s)${PRE}pasado manana\\b`), f: () => masDias(hoy, 2) },
    { re: /(^|\s)(?:(?:para|hasta)\s+)?hoy\b/, f: () => masDias(hoy, 0) },
    { re: /(^|\s)((?:por|en|de)\s+la\s+|la\s+|esta\s+)?(?:(?:para|hasta)\s+)?manana\b/, f: (mm) => (mm[2] ? null : masDias(hoy, 1)) },
    { re: new RegExp(`(^|\\s)${PRE}(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\\b`), f: (mm) => { const objetivo = DIAS_NAT.indexOf(mm[2]); let d = (objetivo - hoy.getDay() + 7) % 7; if (d === 0) d = 7; return masDias(hoy, d); } },
    { re: new RegExp(`(^|\\s)${PRE}(\\d{1,2})\\s*(?:de\\s+)?(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*\\.?(?:\\s+(?:de\\s+)?(\\d{4}))?\\b`), f: (mm) => { const dia = Number(mm[2]); const mes = MESES_NAT.indexOf(mm[3] === 'set' ? 'sep' : mm[3]); if (dia < 1 || dia > 31) return null; let anio = mm[4] ? Number(mm[4]) : hoy.getFullYear(); let d = new Date(anio, mes, dia); if (!mm[4] && d < masDias(hoy, -45)) d = new Date(anio + 1, mes, dia); return d; } },
    { re: new RegExp(`(^|\\s)${PRE}(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{2,4}))?\\b`), f: (mm) => { const dia = Number(mm[2]), mes = Number(mm[3]) - 1; if (dia < 1 || dia > 31 || mes < 0 || mes > 11) return null; let anio = mm[4] ? Number(mm[4]) : hoy.getFullYear(); if (anio < 100) anio += 2000; let d = new Date(anio, mes, dia); if (!mm[4] && d < masDias(hoy, -45)) d = new Date(anio + 1, mes, dia); return d; } },
    { re: /(^|\s)(?:(?:para|hasta)\s+)?(?:dentro\s+de|en)\s+(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince)\s+(dias?|semanas?)\b/, f: (mm) => { const k = NUM_NAT[mm[2]] ?? Number(mm[2]); return masDias(hoy, mm[3].startsWith('sem') ? k * 7 : k); } },
    { re: /(^|\s)(?:(?:para|hasta)\s+)?(?:la\s+)?(?:proxima|siguiente)\s+semana\b/, f: () => masDias(hoy, ((8 - hoy.getDay()) % 7) || 7) },
    { re: /(^|\s)(?:(?:para|hasta)\s+)?(?:a\s+)?fin(?:al)?\s+de\s+mes\b/, f: () => new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0) },
  ];
  for (const p of pruebas) {
    m = p.re.exec(n);
    if (!m) continue;
    const d = p.f(m);
    if (!d) continue;
    out.fecha = isoLocal(d);
    quitar.push({ desde: m.index + m[1].length, hasta: m.index + m[0].length });
    break;
  }
  // Hora: "a las 12", "a las 4 pm", "a la 1", "12:30", "16 h"
  const rh = /(^|\s)(?:a\s+las?\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|hrs?|h)?\b/g;
  while ((m = rh.exec(n))) {
    const conPrefijo = /a\s+las?\s+/.test(m[0]);
    if (!conPrefijo && !m[3] && !m[4]) continue;                 // un número suelto no es hora
    if (quitar.some((q) => m.index < q.hasta && m.index + m[0].length > q.desde)) continue; // es parte de la fecha ("15 sep")
    let h = Number(m[2]); const min = m[3] ? Number(m[3]) : 0;
    if (h > 23 || min > 59) continue;
    if (m[4] === 'pm' && h < 12) h += 12;
    if (m[4] === 'am' && h === 12) h = 0;
    if (!m[4] && conPrefijo && h >= 1 && h <= 6) h += 12;       // "a las 4" → 16:00 (horario de oficina)
    out.hora = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    quitar.push({ desde: m.index + m[1].length, hasta: m.index + m[0].length });
    break;
  }
  if (!quitar.length) return out;
  quitar.sort((a, b) => b.desde - a.desde);
  out.frase = quitar.slice().sort((a, b) => a.desde - b.desde).map((q) => orig.slice(q.desde, q.hasta)).join(' ');
  let t = orig;
  for (const q of quitar) t = `${t.slice(0, q.desde)} ${t.slice(q.hasta)}`;
  out.texto = t.replace(/\s{2,}/g, ' ').trim();
  return out;
}
