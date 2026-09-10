// parserCorreo.js — interpreta el correo "ACTECK - SOLICITUD DE COMPRA · Compras S&OP {Mes} {Año}" que manda
// el CRM corporativo tras la reunión mensual de S&OP. Módulo PURO (sin React, sin Supabase): se prueba en Node.
//
// Entrada: texto pegado (innerText del correo). Si trae HTML con <table> y hay DOMParser (navegador) se lee la
// tabla celda por celda (camino exacto); en texto plano se anclan las filas en el SKU (AC-/BR-/ES-…).
// Salida: { folio, anio, mes, titulo, solicita, fecha, nota, nota_autor, lineas[], siguientes[], avisos[] }.
//   lineas[]: { orden, marca, familia, sku, descripcion, cantidad, comentario }
//   siguientes[]: { rol, accion }
//   avisos[]: lo que no se pudo interpretar (para mostrar en la vista previa; nunca se lanza).
//
// `enriquecerLineas(lineas, catalogos)` completa marca/familia/descripción vacías desde roadmap_sku / metadata.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MARCAS = ['BALAM RUSH', 'ACTECK', 'TRUEBASIX', 'EVOROK', 'MOBIFREE', 'ENERGY SISTEM', 'LF ACOUSTICS', 'SWANN', 'DXT'];
// Familias conocidas (roadmap_sku); las de dos+ palabras primero para que ganen en el match.
const FAMILIAS = [
  'Alfombrillas y Almoadillas', 'Alfombrillas y Almohadillas', 'Cables y Cargadores', 'Hubs y Adaptadores', 'Sillas y Mesas', 'Bases y Soportes',
  'Gamepads y Controles', 'Fundas y Mochilas', 'Enfriamiento Liquido', 'Enfriamiento Líquido', 'Fuente de Poder', 'Memorias USB', 'Power Bank',
  'Gabinete', 'Monitor', 'Audifonos', 'Audífonos', 'Enfriamiento', 'Mouse', 'Combo', 'Teclado', 'Bocinas', 'Botaderos', 'Luces', 'Microfono', 'Micrófono',
  'Regulador', 'Swann', 'Webcam', 'Escritorio', 'Silla', 'UPS',
];

export const SKU_RE = /\b(?:AC|BR|ES|TB|EV|MF|SW|DX)-[0-9A-Z]{5,7}\b/;
const FOLIO_RE = /SOP-(\d{4})(\d{2})(?:-(\d+))?/i;

const limpiar = (s) => String(s ?? '').replace(/\u00A0/g, ' ').replace(/ {2,}/g, ' ').replace(/^[ \t]+|[ \t]+$/g, '');
const sinTabs = (s) => limpiar(String(s ?? '').replace(/\t+/g, ' '));
const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const numero = (s) => { const n = Number(String(s ?? '').replace(/[,\s]/g, '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; };
const mesIndex = (nombre) => { const i = MESES.indexOf(sinAcentos(String(nombre || '').toLowerCase())); return i >= 0 ? i + 1 : null; };
const esCabecera = (l) => /^\s*MARCA\b/i.test(l) && /SKU/i.test(l) && /CANTIDAD/i.test(l);
const esTotal = (l) => /^\s*TOTAL\b/i.test(l);
const esQueSigue = (l) => /QU[EÉ] SIGUE/i.test(l);
const esFin = (l) => /^\s*(Ver el S&OP|Generado desde)/i.test(l);

/** Título "Compras S&OP Septiembre 2026" → { titulo, mes, anio }. */
function leerTitulo(texto) {
  const m = texto.match(/Compras\s+S&OP\s+([A-Za-zÁÉÍÓÚáéíóú]+)\s+(\d{4})/i);
  if (!m) return null;
  return { titulo: limpiar(m[0]), mes: mesIndex(m[1]), anio: Number(m[2]) };
}

/** Pie "Generado desde el modulo S&OP del CRM Acteck · 1 sep 2026, 1:54 p.m." → 'YYYY-MM-DD'. */
function leerFecha(texto) {
  const m = texto.match(/Generado[^\n]*?(\d{1,2})\s+([a-záéíóú]{3,10})\.?\s+(\d{4})/i);
  if (!m) return null;
  const mesTxt = sinAcentos(m[2].toLowerCase()).slice(0, 3);
  const mi = MESES_CORTO.indexOf(mesTxt);
  if (mi < 0) return null;
  return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}

/** Separa "ACTECK Fuente de Poder" en { marca, familia }. Devuelve familia vacía si no la reconoce. */
export function separarMarcaFamilia(prefijo) {
  const p = limpiar(prefijo);
  if (!p) return { marca: '', familia: '' };
  let marca = '', resto = p;
  for (const mk of MARCAS) {
    const re = new RegExp(`^${mk.replace(/ /g, '\\s+')}\\b`, 'i');
    if (re.test(sinAcentos(p))) { marca = mk; resto = limpiar(p.slice(p.match(re)[0].length)); break; }
  }
  if (!marca) {
    // Marca desconocida: primera palabra en mayúsculas.
    const m = p.match(/^([A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚ0-9]+)\b/);
    if (m) { marca = m[1]; resto = limpiar(p.slice(m[0].length)); }
  }
  let familia = resto;
  for (const f of FAMILIAS) {
    if (sinAcentos(resto).toLowerCase() === sinAcentos(f).toLowerCase()) { familia = f; break; }
  }
  return { marca, familia };
}

/** Descripción + cantidad + comentario a partir de lo que sigue al SKU en una línea SIN tabs (heurística). */
const UNIDAD_RE = /^\s*(?:W|Hz|ms|mm|cm|m|GB|TB|MB|mAh|"|''|x|X|pulg|in|K|Kg|kg|g|V|A|dpi|DPI|%|en\s+\d)(?=\s|$|[\/+,.)])/;
function separarDescCantidadComentario(resto) {
  const r = sinTabs(resto);
  const re = /(?:^|\s)(\d{1,3}(?:,\d{3})+|\d+)(?=\s|$)/g;
  let m; const candidatos = [];
  while ((m = re.exec(r))) candidatos.push({ idx: m.index + (m[0].length - m[1].length), len: m[1].length, val: m[1] });
  const valido = (c) => {
    const despues = r.slice(c.idx + c.len), antes = r.slice(0, c.idx);
    if (UNIDAD_RE.test(despues) || /^\s*[\/+]/.test(despues)) return false;   // "500 W", "180 /", "75 +", "7 en 1"
    if (/[\/+\-]\s*$/.test(antes)) return false;                                // "+ 100"
    return true;
  };
  // 1) El CRM formatea con separador de miles: el primer número con coma válido es la cantidad ("2,000 1 contenedor").
  // 2) Sin comas (< 1,000): el primer número válido de izquierda a derecha (la descripción ya filtró sus cifras por unidad / "/" / "+").
  const conComa = candidatos.filter((c) => c.val.includes(',') && valido(c));
  const elegido = conComa[0] || candidatos.find(valido);
  if (!elegido) return { descripcion: r, cantidad: 0, comentario: '' };
  return { descripcion: limpiar(r.slice(0, elegido.idx)), cantidad: numero(elegido.val), comentario: limpiar(r.slice(elegido.idx + elegido.len)) };
}

/** Fila con celdas separadas por tab (innerText de una <tr> en Chrome/Gmail): camino exacto. Null si no cuadra. */
function parsearLineaTabs(linea) {
  const celdas = String(linea).split('\t').map((c) => limpiar(c));
  if (celdas.length < 4) return null;
  const si = celdas.findIndex((c) => SKU_RE.test(c) && c.length <= 12);
  if (si < 0) return null;
  const cantTxt = celdas[si + 2] ?? '';
  if (!/^\d{1,3}(?:,\d{3})+$|^\d+$/.test(cantTxt)) return null;
  const { marca, familia } = si >= 2 ? { marca: celdas[0], familia: celdas.slice(1, si).join(' ') } : separarMarcaFamilia(celdas.slice(0, si).join(' '));
  return { marca, familia, sku: celdas[si].match(SKU_RE)[0].toUpperCase(), descripcion: celdas[si + 1] || '', cantidad: numero(cantTxt), comentario: celdas.slice(si + 3).join(' ').trim() };
}

/** Una línea de texto (o una fila ya unida) → línea de reunión, o null si no hay SKU. */
export function parsearLineaTexto(linea) {
  if (/\t/.test(String(linea))) { const t = parsearLineaTabs(linea); if (t) return t; }
  const l = sinTabs(linea);
  const m = l.match(SKU_RE);
  if (!m) return null;
  const sku = m[0].toUpperCase();
  const antes = l.slice(0, m.index);
  const despues = l.slice(m.index + m[0].length);
  const { marca, familia } = separarMarcaFamilia(antes);
  const { descripcion, cantidad, comentario } = separarDescCantidadComentario(despues);
  return { marca, familia, sku, descripcion, cantidad, comentario };
}

/** Bloque "QUE SIGUE - POR ROL" → [{ rol, accion }]. Acepta "Rol: acción" en una línea o rol y acción en líneas separadas. */
export function parsearSiguientes(lineas) {
  const out = [];
  let rolPendiente = null;
  for (const raw of lineas) {
    const l = limpiar(raw).replace(/^[•\-–·*]\s*/, '');
    if (!l) continue;
    if (esFin(l)) break;
    const m = l.match(/^([A-Za-zÁÉÍÓÚáéíóúñÑ&\/ ]{3,60}?)\s*:\s*(.+)$/);
    if (m) { out.push({ rol: limpiar(m[1]), accion: limpiar(m[2]) }); rolPendiente = null; continue; }
    if (/^[A-Za-zÁÉÍÓÚáéíóúñÑ&\/ ]{3,60}:?$/.test(l) && l.length < 60 && !rolPendiente) { rolPendiente = l.replace(/:$/, ''); continue; }
    if (rolPendiente) { out.push({ rol: rolPendiente, accion: l }); rolPendiente = null; continue; }
    if (out.length) out[out.length - 1].accion = `${out[out.length - 1].accion} ${l}`;
  }
  return out;
}

/** Camino HTML: <table> con cabecera MARCA·FAMILIA·SKU·DESCRIPCION·CANTIDAD·COMENTARIOS. Requiere DOMParser. */
function parsearHTML(html) {
  if (typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const tablas = Array.from(doc.querySelectorAll('table'));
  let lineas = null;
  for (const t of tablas) {
    const filas = Array.from(t.querySelectorAll('tr')).map((tr) => Array.from(tr.querySelectorAll('th,td')).map((c) => limpiar(c.textContent)));
    const hi = filas.findIndex((f) => f.some((c) => /^SKU$/i.test(c)) && f.some((c) => /CANTIDAD/i.test(c)));
    if (hi < 0) continue;
    const head = filas[hi].map((c) => sinAcentos(c).toUpperCase());
    const col = (nombre) => head.findIndex((h) => h.startsWith(nombre));
    const ci = { marca: col('MARCA'), familia: col('FAMILIA'), sku: col('SKU'), desc: col('DESCRIP'), cant: col('CANTIDAD'), com: col('COMENT') };
    lineas = [];
    for (const f of filas.slice(hi + 1)) {
      if (!f.length || esTotal(f[0])) continue;
      const sku = (f[ci.sku] || '').toUpperCase();
      if (!SKU_RE.test(sku)) { const alt = parsearLineaTexto(f.join(' ')); if (alt) lineas.push(alt); continue; }
      lineas.push({
        marca: ci.marca >= 0 ? f[ci.marca] || '' : '', familia: ci.familia >= 0 ? f[ci.familia] || '' : '', sku: sku.match(SKU_RE)[0],
        descripcion: ci.desc >= 0 ? f[ci.desc] || '' : '', cantidad: ci.cant >= 0 ? numero(f[ci.cant]) : 0, comentario: ci.com >= 0 ? f[ci.com] || '' : '',
      });
    }
    break;
  }
  const texto = limpiar(doc.body ? doc.body.innerText || doc.body.textContent : '');
  return { lineas, texto: (doc.body && doc.body.innerText) || textoDesdeHTML(html) };
}

// innerText no existe en DOMParser (jsdom/Node); fallback: <br>/<tr>/<p>/<div> → saltos de línea, celdas → espacio.
function textoDesdeHTML(html) {
  return String(html)
    .replace(/<\s*(br|\/tr|\/p|\/div|\/h\d|\/li)[^>]*>/gi, '\n')
    .replace(/<\s*\/t[dh]\s*>/gi, ' \t ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/**
 * Interpreta el correo pegado. Nunca lanza: devuelve lo que pudo con `avisos`.
 * @param {string} entrada texto plano (innerText) o HTML
 */
export function parsearCorreo(entrada) {
  const avisos = [];
  const raw = String(entrada || '');
  let lineasHTML = null;
  let texto = raw;
  if (/<table[\s>]/i.test(raw)) {
    const h = parsearHTML(raw);
    if (h) { lineasHTML = h.lineas; texto = h.texto || raw; } else texto = textoDesdeHTML(raw);
  }
  texto = texto.replace(/\r/g, '').replace(/ /g, ' ');
  const lineas = texto.split('\n').map(limpiar);

  // Folio · título · solicita · fecha
  const fm = texto.match(FOLIO_RE);
  const folio = fm ? `SOP-${fm[1]}${fm[2]}${fm[3] ? `-${fm[3]}` : ''}`.toUpperCase() : null;
  const tit = leerTitulo(texto);
  let anio = tit?.anio ?? (fm ? Number(fm[1]) : null);
  let mes = tit?.mes ?? (fm ? Number(fm[2]) : null);
  if (!folio) avisos.push('No encontré el folio (SOP-AAAAMM); se propondrá uno con el mes.');
  if (!tit) avisos.push('No encontré el título "Compras S&OP {Mes} {Año}".');
  if (fm && tit && (Number(fm[1]) !== tit.anio || Number(fm[2]) !== tit.mes)) avisos.push(`El folio ${folio} no coincide con el título (${tit.titulo}).`);
  const sm = texto.match(/solicita[ \t]*:?[ \t]*([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚáéíóúñÑ.]*(?:[ \t]+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚáéíóúñÑ.]*){0,3})/);
  const solicita = sm ? limpiar(sm[1]) : '';
  if (!solicita) avisos.push('No encontré quién solicita.');
  const fecha = leerFecha(texto);

  // Nota: "NOTA DE {X}" hasta la cabecera de la tabla (o hasta una línea vacía doble).
  let nota = '', nota_autor = '';
  const ni = lineas.findIndex((l) => /^NOTA DE\s+/i.test(l));
  if (ni >= 0) {
    nota_autor = limpiar(lineas[ni].replace(/^NOTA DE\s+/i, '').replace(/:$/, ''));
    const inline = lineas[ni].match(/^NOTA DE\s+[^:]+:\s*(.+)$/i);
    const buf = inline ? [inline[1]] : [];
    if (inline) nota_autor = limpiar(lineas[ni].match(/^NOTA DE\s+([^:]+):/i)[1]);
    for (let i = ni + 1; i < lineas.length; i++) {
      if (esCabecera(lineas[i]) || SKU_RE.test(lineas[i])) break;
      buf.push(lineas[i]);
    }
    nota = buf.join('\n').replace(/\n{2,}/g, '\n').trim();
  }

  // Líneas de la tabla.
  let items = lineasHTML;
  if (!items) {
    items = [];
    const hi = lineas.findIndex(esCabecera);
    const qi = lineas.findIndex(esQueSigue);
    const desde = hi >= 0 ? hi + 1 : 0;
    const hasta = qi >= 0 ? qi : lineas.length;
    // innerText de una tabla puede traer cada celda en su propia línea: se unen las líneas hasta encontrar un SKU
    // y, tras él, se sigue acumulando hasta la siguiente línea que contenga marca/SKU o Total.
    let buffer = [];
    const cerrar = () => {
      if (!buffer.length) return;
      const l = (buffer.length >= 5 && parsearLineaTexto(buffer.join('\t'))) || parsearLineaTexto(buffer.join(' '));
      if (l) items.push(l);
      else if (buffer.join(' ').trim() && hi >= 0) avisos.push(`No interpreté: "${buffer.join(' ').slice(0, 80)}"`);
      buffer = [];
    };
    for (let i = desde; i < hasta; i++) {
      const l = lineas[i];
      if (!l) continue;
      if (esTotal(l)) { cerrar(); break; }
      const empiezaFila = new RegExp(`^(${MARCAS.join('|')})\\b`, 'i').test(sinAcentos(l)) || (SKU_RE.test(l) && buffer.some((b) => SKU_RE.test(b)));
      if (empiezaFila) cerrar();
      buffer.push(l);
    }
    cerrar();
  }
  items = items.map((l, i) => ({ orden: i + 1, ...l, marca: limpiar(l.marca), familia: limpiar(l.familia), descripcion: limpiar(l.descripcion), comentario: limpiar(l.comentario) }));
  if (!items.length) avisos.push('No encontré líneas con SKU (AC-…, BR-…).');
  items.forEach((l) => { if (!(l.cantidad > 0)) avisos.push(`${l.sku}: sin cantidad.`); });
  const dup = items.map((l) => l.sku).filter((s, i, a) => a.indexOf(s) !== i);
  if (dup.length) avisos.push(`SKU repetido: ${[...new Set(dup)].join(', ')}.`);

  // Total declarado vs suma (si el correo trae fila Total).
  const totalLinea = lineas.find(esTotal);
  if (totalLinea) {
    const nums = (totalLinea.match(/\d{1,3}(?:,\d{3})+|\d+/g) || []).map(numero);
    const declarado = nums.length ? Math.max(...nums) : 0;
    const suma = items.reduce((a, l) => a + l.cantidad, 0);
    if (declarado && Math.round(declarado) !== Math.round(suma)) avisos.push(`El total del correo (${declarado.toLocaleString('es-MX')}) no coincide con la suma de líneas (${suma.toLocaleString('es-MX')}).`);
  }

  // Qué sigue por rol.
  let siguientes = [];
  const qi = lineas.findIndex(esQueSigue);
  if (qi >= 0) siguientes = parsearSiguientes(lineas.slice(qi + 1));

  return { folio, anio, mes, titulo: tit?.titulo || (mes && anio ? `Compras S&OP ${MESES[mes - 1][0].toUpperCase()}${MESES[mes - 1].slice(1)} ${anio}` : ''), solicita, fecha, nota, nota_autor, lineas: items, siguientes, avisos };
}

/**
 * Completa marca / familia / descripción vacías desde catálogos ya cargados en la pantalla.
 * @param {Array} lineas
 * @param {{ roadmap?: Array<{sku,marca,familia,descripcion}>, metaBySku?: Object, rowsBySku?: Object }} cat
 */
export function enriquecerLineas(lineas, cat = {}) {
  const rm = Object.fromEntries((cat.roadmap || []).map((r) => [String(r.sku || '').toUpperCase(), r]));
  const meta = cat.metaBySku || {};
  const rows = cat.rowsBySku || {};
  return lineas.map((l) => {
    const k = String(l.sku || '').toUpperCase();
    const r = rm[k], m = meta[k], w = rows[k];
    return {
      ...l,
      marca: l.marca || r?.marca || m?.marca || w?.marca || '',
      familia: l.familia || r?.familia || m?.familia || w?.familia || '',
      descripcion: l.descripcion || r?.descripcion || m?.descripcion || w?.descripcion || '',
      enCatalogo: !!(r || m || w),
    };
  });
}

/** Folio propuesto para mes/año. `existentes` = folios ya guardados → agrega -2, -3… */
export function proponerFolio(anio, mes, existentes = []) {
  const base = `SOP-${anio}${String(mes).padStart(2, '0')}`;
  const set = new Set(existentes.map((f) => String(f).toUpperCase()));
  if (!set.has(base)) return base;
  for (let i = 2; i < 100; i++) if (!set.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now()}`;
}

export const MESES_NOMBRE = MESES.map((m) => m[0].toUpperCase() + m.slice(1));
