// parserCorreoOC.js — "Pegar correo" del Tracking Pedidos. Módulo PURO (sin React ni Supabase): scripts/test-tracking-parser.mjs
//
// No hay ejemplos reales de correo de OC todavía (2026-09-11), así que el parser es genérico y tolerante:
//   · número de OC: "OC-48211", "OC 48211", "O.C. #48211", "Orden de compra: 4500218", "Pedido 174804", "PO 12345",
//     "DT-0931", "COT-2609-04"; si no hay etiqueta, el primer número de 5-8 dígitos suelto.
//   · cliente: por palabras clave (Digitalife / API Global / CajaDL · PCEL / PC Online · Dicotech / Revko).
//   · fecha: dd/mm/yyyy, dd-mm-yy, yyyy-mm-dd, "10 de septiembre de 2026", "10 sep 2026".
//   · líneas: cualquier línea con SKU (AC|BR|ES|TB|EV|MF|SW|DX)-XXXXX; cantidad = número con "pz/pzas/piezas/unid"
//     o el primer número válido después del SKU (se descartan los que van seguidos de unidad: W, GB, ", mm…),
//     o el último antes del SKU ("200 x AC-943178"). Precio = "$1,234.00" en la misma línea (opcional).
//   · avisos[]: lo que no se pudo interpretar; nunca lanza. La vista previa es editable.
// Salida: { cliente_key, numero_oc, fecha, asunto, lineas[{sku, cantidad, precio, descripcion}], avisos[] }.

export const SKU_RE = /\b(?:AC|BR|ES|TB|EV|MF|SW|DX)-[0-9A-Z]{5,7}\b/i;
const SKU_RE_G = new RegExp(SKU_RE.source, 'gi');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const limpiar = (s) => String(s ?? '').replace(/ /g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const numero = (s) => { const n = Number(String(s ?? '').replace(/[,\s]/g, '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; };
const pad2 = (n) => String(n).padStart(2, '0');

const CLIENTES = [
  { key: 'digitalife', re: /digitalife|digita\s*life|api\s*global|cajadl/i },
  { key: 'pcel', re: /\bpcel\b|pc\s*online|pc-online/i },
  { key: 'dicotech', re: /dicotech|\brevko\b/i },
];
/** Cliente por palabras clave; null si no aparece ninguno (o aparecen varios). */
export function detectarCliente(texto) {
  const hits = CLIENTES.filter((c) => c.re.test(texto)).map((c) => c.key);
  return hits.length === 1 ? hits[0] : (hits[0] || null);
}

const OC_RES = [
  /\b((?:DT|COT|OC|PO)-\d{2,6}(?:-\d{1,4})?)\b/i,
  /\b(?:orden\s+de\s+compra|purchase\s+order)\s*(?:n[°ºo]\.?|#|no\.?|:)?\s*[:#]?\s*([A-Z]{0,4}[-\s]?\d{3,10}(?:-\d{1,4})?)/i,
  /\bO\.?\s?C\.?\s*(?:n[°ºo]\.?|#|no\.?|:)?\s*[:#-]?\s*([A-Z]{0,4}[-]?\d{3,10}(?:-\d{1,4})?)\b/i,
  /\b(?:pedido|orden|po)\s*(?:n[°ºo]\.?|#|no\.?|:)?\s*[:#-]?\s*([A-Z]{0,4}[-]?\d{3,10}(?:-\d{1,4})?)\b/i,
];
/** Número de OC en el texto (con etiqueta) o el primer número de 5-8 dígitos suelto. */
export function detectarOC(texto) {
  const t = sinAcentos(texto);
  for (const re of OC_RES) {
    const m = t.match(re);
    if (m) {
      const v = limpiar(m[1]).toUpperCase().replace(/\s+/g, '');
      if (!/^\d{1,2}$/.test(v)) return { numero_oc: v, explicito: true };
    }
  }
  // Sin etiqueta: número de 5-8 dígitos que no sea fecha ni parte de un SKU ni un teléfono largo.
  const sinSkus = t.replace(SKU_RE_G, ' ');
  const m = sinSkus.match(/(?:^|[^\d/\-.])(\d{5,8})(?=$|[^\d/\-.])/m);
  return m ? { numero_oc: m[1], explicito: false } : { numero_oc: '', explicito: false };
}

/** Primera fecha reconocible → 'YYYY-MM-DD' (o null). */
export function detectarFecha(texto) {
  const t = sinAcentos(texto);
  let m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; if (Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${y}-${pad2(m[2])}-${pad2(m[1])}`; }
  m = t.match(/\b(\d{1,2})\s+(?:de\s+)?([a-z]{3,10})\.?\s+(?:de\s+|del\s+)?(\d{4})\b/i);
  if (m) {
    const mes = m[2].toLowerCase();
    let mi = MESES.indexOf(mes); if (mi < 0) mi = MESES_CORTO.indexOf(mes.slice(0, 3));
    if (mi >= 0) return `${m[3]}-${pad2(mi + 1)}-${pad2(m[1])}`;
  }
  return null;
}

// Unidades que descalifican un número como cantidad ("500 W", "27\"", "16 GB", "7 en 1").
const UNIDAD_RE = /^\s*(?:W|Hz|ms|mm|cm|m|GB|TB|MB|mAh|"|''|x|X|pulg|in|K|Kg|kg|g|V|A|dpi|DPI|%|en\s+\d|\/|\+)(?=\s|$|[\/+,.)])/;
const CANT_RE = /(?:^|[\s,;:|x×*])(\d{1,3}(?:,\d{3})+|\d{1,6})(?=\s*(?:pz|pzas?|piezas?|unid(?:ades)?|uds?|u)\b)/i;
const PRECIO_RE = /\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/;

/** Una línea con SKU → { sku, cantidad, precio, descripcion } (cantidad 0 si no se pudo leer). */
export function parsearLinea(linea) {
  const l = limpiar(String(linea).replace(/\t+/g, ' | '));
  const m = l.match(SKU_RE);
  if (!m) return null;
  const sku = m[0].toUpperCase();
  const antes = l.slice(0, m.index), despues = l.slice(m.index + m[0].length);
  let precio = 0;
  const pm = despues.match(PRECIO_RE) || antes.match(PRECIO_RE);
  if (pm) precio = numero(pm[1]);
  const sinPrecio = (s) => s.replace(PRECIO_RE, ' ');
  const d = sinPrecio(despues), a = sinPrecio(antes);
  let cantidad = 0;
  const cm = d.match(CANT_RE) || a.match(CANT_RE);
  if (cm) cantidad = numero(cm[1]);
  else {
    const candidatos = (s) => { const out = []; const re = /(?:^|[^\w.])(\d{1,3}(?:,\d{3})+|\d{1,6})(?![\w.])/g; let x; while ((x = re.exec(s))) out.push({ val: x[1], idx: x.index + x[0].length - x[1].length }); return out; };
    const valido = (s, c) => !UNIDAD_RE.test(s.slice(c.idx + c.val.length)) && !/[\/+\-]\s*$/.test(s.slice(0, c.idx));
    const cd = candidatos(d).filter((c) => valido(d, c));
    if (cd.length) cantidad = numero(cd[0].val);
    else { const ca = candidatos(a).filter((c) => valido(a, c)); if (ca.length) cantidad = numero(ca[ca.length - 1].val); }
  }
  const descripcion = limpiar(d.replace(/(?:^|[\s,;:|x×*])(?:\d{1,3}(?:,\d{3})+|\d{1,6})\s*(?:pz|pzas?|piezas?|unid(?:ades)?|uds?|u)\b/gi, ' ').replace(/(?:^|[\s|])(?:\d{1,3}(?:,\d{3})+)(?![\w.])/g, ' ').replace(/[|]+/g, ' ').replace(/^\s*[-–·:]+\s*/, '')).slice(0, 120);
  return { sku, cantidad, precio, descripcion };
}

/** Texto pegado (innerText del correo) → OC propuesta. */
export function parsearCorreoOC(texto) {
  const avisos = [];
  const raw = String(texto || '');
  const t = raw.replace(/\r/g, '');
  if (!t.trim()) return { cliente_key: null, numero_oc: '', fecha: null, asunto: '', lineas: [], avisos: ['Pega el texto del correo (o de la OC) para leerlo.'] };
  const lineasTxt = t.split('\n');
  const asuntoM = t.match(/^\s*(?:asunto|subject)\s*:\s*(.+)$/im);
  const asunto = limpiar(asuntoM ? asuntoM[1] : (lineasTxt.find((l) => l.trim()) || '')).slice(0, 140);

  const cliente_key = detectarCliente(t);
  if (!cliente_key) avisos.push('No reconocí al cliente: elígelo.');
  const { numero_oc, explicito } = detectarOC(t);
  if (!numero_oc) avisos.push('No encontré el número de OC: captúralo.');
  else if (!explicito) avisos.push(`Tomé "${numero_oc}" como número de OC (sin etiqueta): confírmalo.`);
  const fecha = detectarFecha(t);
  if (!fecha) avisos.push('Sin fecha en el correo: se usa hoy.');

  const porSku = new Map();
  for (const l of lineasTxt) {
    // Una línea puede traer varios SKUs (tabla aplanada): se parte por SKU.
    const idx = []; SKU_RE_G.lastIndex = 0; let mm; while ((mm = SKU_RE_G.exec(l))) idx.push(mm.index);
    const partes = idx.map((i, k) => l.slice(k === 0 ? 0 : i, idx[k + 1] ?? l.length));   // el prefijo (cantidad antes del SKU) va con el primero
    for (const p of partes) {
      const x = parsearLinea(p);
      if (!x) continue;
      const prev = porSku.get(x.sku);
      if (prev) { prev.cantidad += x.cantidad; if (!prev.precio) prev.precio = x.precio; if (!prev.descripcion) prev.descripcion = x.descripcion; avisos.push(`${x.sku} venía repetido: sumé las cantidades.`); }
      else porSku.set(x.sku, x);
    }
  }
  const lineas = [...porSku.values()];
  if (!lineas.length) avisos.push('No encontré líneas con SKU (AC-, BR-, ES-…).');
  for (const x of lineas) if (!x.cantidad) avisos.push(`${x.sku}: no leí la cantidad, captúrala.`);
  return { cliente_key, numero_oc, fecha, asunto, lineas, avisos: [...new Set(avisos)] };
}
