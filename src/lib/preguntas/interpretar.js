// «Buscar o preguntar» (2026-09-24) · intérprete PURO de preguntas en lenguaje natural.
// Sin modelo de lenguaje ni red: reglas sobre lo que el dashboard ya sabe contestar. Devuelve una
// intención { tipo, cliente?, sku?, anio?, mes?, ... } o null si el texto es una búsqueda normal.
// Pruebas: node --test scripts/test-preguntas.mjs

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();

export const CLIENTES = {
  digitalife: ['digitalife', 'digital life', 'dl', 'api global'],
  pcel: ['pcel', 'pc online', 'pc el'],
  dicotech: ['dicotech', 'dico', 'revko'],
};
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const RE_SKU = /\b([a-z]{2})-?(\d{6})\b/i;

/** ¿Parece pregunta y no búsqueda de un nombre? (para decidir si se intenta interpretar). */
export function pareceProgunta(texto) { return pareceP(texto); }
export function pareceP(texto) {
  const t = norm(texto);
  if (!t) return false;
  if (/^[¿?]/.test(String(texto).trim())) return true;
  if (RE_SKU.test(t) && /\b(stock|inventario|disponible|existencia|transito|tránsito|llega|piezas|hay)\b/.test(t)) return true;
  return /\b(cuanto|cuantos|cuantas|como va|como vamos|que hay|que tengo|cuando|pendiente|pendientes|vencid|reunion|reuniones|cuota|avance|venta|ventas|vendimos|vendio|sell in|sell out|sellout|sell-out|stock|inventario|cobranza|cartera|vencido|pagos|pago|margen|transito|llega|arribo|abre|abrir|ve a|ir a|hoy|manana|ayer|esta semana|mes pasado)\b/.test(t);
}

function clienteDe(t) {
  for (const [key, alias] of Object.entries(CLIENTES)) if (alias.some((a) => new RegExp(`\\b${a}\\b`).test(t))) return key;
  return null;
}
function periodoDe(t, hoy) {
  const anioHoy = hoy.getFullYear(), mesHoy = hoy.getMonth() + 1;
  let anio = null, mes = null, relativo = null;
  const mA = /\b(20\d{2})\b/.exec(t); if (mA) anio = Number(mA[1]);
  for (let i = 0; i < 12; i++) if (new RegExp(`\\b(${MESES[i]}|${MESES_ABR[i]})\\b`).test(t)) { mes = i + 1; break; }
  if (/\bmes pasado\b/.test(t)) { relativo = 'mesPasado'; mes = mesHoy === 1 ? 12 : mesHoy - 1; anio = anio ?? (mesHoy === 1 ? anioHoy - 1 : anioHoy); }
  else if (/\b(este mes|el mes|del mes|mes actual)\b/.test(t)) { relativo = 'esteMes'; mes = mesHoy; anio = anio ?? anioHoy; }
  else if (/\b(ytd|acumulad|en el ano|del ano|este ano|anual)\b/.test(t)) { relativo = 'anio'; anio = anio ?? anioHoy; }
  if (mes && !anio) anio = mes > mesHoy ? anioHoy - 1 : anioHoy;
  if (anio && !mes && !relativo) relativo = 'anio';
  return { anio, mes, relativo };
}

/**
 * interpretar(texto, { hoy }) → intención o null.
 * tipos: cuota · ventas · sellout · stock · transito · pendientes · reunion · pagos · cobranza · margen · inventarioEmpresa · abrir
 */
export function interpretar(texto, { hoy = new Date() } = {}) {
  const t = norm(texto);
  if (!t || !pareceP(texto)) return null;
  const cliente = clienteDe(t);
  const sku = (() => { const m = RE_SKU.exec(t); return m ? `${m[1].toUpperCase()}-${m[2]}` : null; })();
  const { anio, mes, relativo } = periodoDe(t, hoy);
  const base = { texto: String(texto).trim(), cliente, sku, anio, mes, relativo };

  // Orden: lo más específico primero.
  if (sku && /\b(transito|llega|cuando|arribo|en camino|po)\b/.test(t)) return { ...base, tipo: 'transito' };
  if (sku) return { ...base, tipo: 'stock' };
  if (/\b(abre|abrir|ve a|ir a|llevame|muestrame|muestra)\b/.test(t) && /\b(reunion|minuta)\b/.test(t)) return { ...base, tipo: 'reunion', abrir: true };
  if (/\b(reunion|reuniones|minuta|junta)\b/.test(t)) return { ...base, tipo: 'reunion', cuando: /\bmanana\b/.test(t) ? 'manana' : /\bhoy\b/.test(t) ? 'hoy' : /\bsemana\b/.test(t) ? 'semana' : 'proxima' };
  if (/\b(pendiente|pendientes|tareas|que tengo|que hay para|por hacer)\b/.test(t)) return { ...base, tipo: 'pendientes', cuando: /\bvencid/.test(t) ? 'vencidos' : /\bsemana\b/.test(t) ? 'semana' : /\bmanana\b/.test(t) ? 'manana' : 'hoy' };
  if (/\b(pagos?|bonificacion|bonificaciones|rebate|spiff)\b/.test(t) && /\b(autorizar|pendiente|solicitad|por pagar|programad|calculad|que hay|cuantos)\b/.test(t) || /^pagos?\b/.test(t)) return { ...base, tipo: 'pagos' };
  if (/\b(cobranza|cartera|vencido|vencida|saldo|debe|deben|adeudo|dso)\b/.test(t)) return { ...base, tipo: 'cobranza' };
  if (/\b(margen|contribucion|utilidad|rentabilidad)\b/.test(t)) return { ...base, tipo: 'margen' };
  if (/\b(sell ?out|sellout|desplaz|salida)\b/.test(t)) return { ...base, tipo: 'sellout' };
  if (/\b(cuota|avance|meta|objetivo|como va|como vamos|alcance)\b/.test(t)) return { ...base, tipo: 'cuota' };
  if (/\b(inventario|stock|existencia|disponible)\b/.test(t) && !cliente) return { ...base, tipo: 'inventarioEmpresa' };
  if (/\b(inventario|stock|existencia)\b/.test(t) && cliente) return { ...base, tipo: 'sellout', foco: 'inventario' };
  if (/\b(venta|ventas|vendimos|vendio|factur|sell ?in|sellin|cuanto)\b/.test(t)) return { ...base, tipo: 'ventas' };
  if (/\b(transito|en camino|arribo|llega)\b/.test(t)) return { ...base, tipo: 'transito' };
  return null;
}

/** Sugerencias para la paleta vacía (se muestran como chips). */
export const SUGERENCIAS = ['cuánto va Digitalife de cuota', 'pendientes de hoy', 'reunión de mañana', 'stock de AC-943253', 'pagos por autorizar', 'cartera vencida', 'sell out de PCEL'];
