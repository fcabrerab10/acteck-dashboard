// whatsapp.js — texto de disponibilidad y precio para compartir desde el celular (V3 móvil).
//
//   textoDisponibilidad(items, { fecha })  → string con el formato acordado con Fernando
//   compartir(texto)                       → navigator.share si existe; si no, abre wa.me
//   copiar(texto)                          → portapapeles (respaldo)
//
// items: [{ sku, descripcion, disponible, proximoArribo: { fecha:'YYYY-MM-DD', piezas } | null, enCamino, precio }]
// El texto NUNCA lleva el nombre de la lista de precios ni márgenes/costos. Precio sin IVA, formato $#,##0.00.

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const TZ = 'America/Mexico_City';

const esNum = (n) => n != null && n !== '' && Number.isFinite(Number(n));

/** 1204 → '1,204' */
export function piezas(n) {
  if (!esNum(n)) return '—';
  return Math.round(Number(n)).toLocaleString('en-US');
}

/** 312 → '$312.00' · 12345.5 → '$12,345.50' */
export function precio(n) {
  if (!esNum(n)) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** '2026-09-14' → '14 sep' (sin pasar por Date: evita el corrimiento de zona horaria). */
export function fechaCorta(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return '—';
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1]}`;
}

/** Date → '10 sep · 13:00' en hora CDMX. */
export function fechaHora(d = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: TZ, day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const p = Object.fromEntries(partes.filter((x) => x.type !== 'literal').map((x) => [x.type, x.value]));
  const hora = p.hour === '24' ? '00' : p.hour;
  return `${Number(p.day)} ${MESES[Number(p.month) - 1]} · ${hora}:${p.minute}`;
}

/** Nombre corto del producto: lo que va antes del primer " / " del roadmap, sin espacios dobles.
 *  'Mouse Óptico Entry MO230 / 1000 DPI / …' → 'Mouse Óptico Entry MO230'. */
export function nombreCorto(descripcion) {
  return String(descripcion || '').split(' / ')[0].replace(/\s+/g, ' ').trim();
}

export function textoDisponibilidad(items, { fecha = new Date(), marca = 'Acteck' } = {}) {
  const lineas = [`*${marca} · Disponibilidad y precio*`, fecha instanceof Date ? fechaHora(fecha) : String(fecha), ''];
  (items || []).forEach((it, i) => {
    const arribo = it.proximoArribo?.fecha
      ? `${fechaCorta(it.proximoArribo.fecha)} · ${piezas(it.proximoArribo.piezas)} pz${esNum(it.enCamino) && it.enCamino > 0 ? ` (${piezas(it.enCamino)} pz en camino)` : ''}`
      : '—';
    const nombre = nombreCorto(it.descripcion);
    lineas.push(`• ${it.sku}${nombre ? ` · ${nombre}` : ''}`);
    lineas.push(`  Disponible: ${piezas(it.disponible)} pz`);
    lineas.push(`  Próximo arribo: ${arribo}`);
    lineas.push(`  Precio: ${esNum(it.precio) ? `${precio(it.precio)} + IVA` : '—'}`);
    if (i < items.length - 1) lineas.push('');
  });
  return lineas.join('\n');
}

/** '2026-09-08' → '8 sep 2026' (sin Date: sin corrimiento de zona horaria). */
export function fechaCortaAnio(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return '—';
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}`;
}

/** 'Factura A10374679' → 'A10374679' (el ERP antepone el tipo de movimiento al folio). */
export function folioCorto(movimiento) {
  return String(movimiento || '').replace(/^(factura|nota|remisi[oó]n|nc|nd)\s+/i, '').trim() || '—';
}

/**
 * Estado de cuenta para el cliente (tono formal, Crédito y Cobranza móvil).
 *
 * facturas: [{ folio | movimiento, fecha (emisión, ISO), importe | saldo, dias (atraso; 0 o negativo = vigente), vencimiento? }]
 * opts: { cliente, fechaCorte (ISO), saldoTotal, totalVencido, soloVencidas = true, marca = 'Acteck' }
 *
 *   *Acteck · Estado de cuenta · Digitalife*
 *   Corte al 8 sep 2026
 *
 *   Facturas vencidas:
 *   • A10374679 · 12 jul · $48,200.00 · 58 días
 *
 *   Total vencido: $70,100.00
 *   Saldo total: $412,300.00
 *
 * Con soloVencidas = false lista todas las facturas con saldo: las vigentes llevan "vence 17 sep" en vez de días.
 * Nunca lleva línea de crédito, DSO ni comentarios internos.
 */
export function textoEstadoCuenta(facturas, { cliente = '', fechaCorte, saldoTotal, totalVencido, soloVencidas = true, marca = 'Acteck' } = {}) {
  const todas = (facturas || []).map((f) => ({
    folio: folioCorto(f.folio || f.movimiento),
    fecha: f.fecha || f.fecha_emision || null,
    saldo: esNum(f.saldo) ? Number(f.saldo) : esNum(f.saldo_actual) ? Number(f.saldo_actual) : esNum(f.importe) ? Number(f.importe) : 0,
    dias: esNum(f.dias) ? Number(f.dias) : 0,
    vencimiento: f.vencimiento || null,
  })).filter((f) => f.saldo > 0);
  const vencidas = todas.filter((f) => f.dias > 0);
  const lista = (soloVencidas ? vencidas : todas).slice().sort((a, b) => (b.dias - a.dias) || String(a.fecha || '').localeCompare(String(b.fecha || '')));
  const tv = esNum(totalVencido) ? Number(totalVencido) : vencidas.reduce((s, f) => s + f.saldo, 0);
  const st = esNum(saldoTotal) ? Number(saldoTotal) : todas.reduce((s, f) => s + f.saldo, 0);

  const lineas = [`*${marca} · Estado de cuenta${cliente ? ` · ${cliente}` : ''}*`, `Corte al ${fechaCorte ? fechaCortaAnio(fechaCorte) : fechaHora(new Date()).split(' · ')[0]}`, ''];
  if (!lista.length) {
    lineas.push(soloVencidas ? 'Sin facturas vencidas a la fecha de corte.' : 'Sin facturas con saldo a la fecha de corte.');
  } else {
    lineas.push(soloVencidas ? 'Facturas vencidas:' : 'Facturas con saldo:');
    lista.forEach((f) => {
      const cola = f.dias > 0 ? `${piezas(f.dias)} día${f.dias === 1 ? '' : 's'}` : f.vencimiento ? `vence ${fechaCorta(f.vencimiento)}` : 'vigente';
      lineas.push(`• ${f.folio} · ${fechaCorta(f.fecha)} · ${precio(f.saldo)} · ${cola}`);
    });
  }
  lineas.push('', `Total vencido: ${precio(tv)}`, `Saldo total: ${precio(st)}`);
  return lineas.join('\n');
}

// ─── Cierre de mes · Análisis por cliente · Avance de cliente (V3 móvil) ───
const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES_TITULO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** 39_086_166 → '$39.1 mdp' (millones de pesos, 1 decimal; negativo con signo). */
export function mdp(n) {
  if (!esNum(n)) return '—';
  const v = Number(n) / 1e6;
  return `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(1)} mdp`;
}

/** 809_000 → '$809K' · 1_600_000 → '$1.6M' · 950 → '$950' (mismo criterio que format.moneyCompact). */
export function compacto(n) {
  if (!esNum(n)) return '—';
  const v = Number(n), a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`;
  return `${s}$${Math.round(a)}`;
}

const pctEntero = (n) => (esNum(n) ? `${Math.round(Number(n))}%` : '—');
const yoyTxt = (n) => (esNum(n) ? ` (${Number(n) >= 0 ? '+' : ''}${Math.round(Number(n))}% vs ` : null);

/**
 * Cierre del mes para dirección (formato exacto acordado con Fernando; mdp = millones con 1 decimal).
 * { mes (1-12), ventas, presupuesto, utilidadBruta, pctMc (0-100), uai, cobranza, stock, diasInventario, comentario }
 */
export function textoCierre({ mes, ventas, presupuesto, utilidadBruta, pctMc, uai, cobranza = '', stock, diasInventario, comentario = '' } = {}) {
  const alcance = esNum(ventas) && esNum(presupuesto) && Number(presupuesto) > 0 ? pctEntero((Number(ventas) / Number(presupuesto)) * 100) : '—';
  const lineas = [
    `Reportando el cierre de ${MESES_LARGO[(Number(mes) || 1) - 1]}.`,
    '',
    `Ventas Netas: ${mdp(ventas)}`,
    `Presupuesto: ${mdp(presupuesto)}`,
    `Alcance: ${alcance}`,
    '',
    `Utilidad bruta: ${mdp(utilidadBruta)}${esNum(pctMc) ? ` (${Number(pctMc).toFixed(1)}%)` : ''}`,
    `Pronóstico UAI: ${mdp(uai)}`,
    '',
    `Cobranza: ${String(cobranza || '').trim()}`,
    '',
    `Stock: ${esNum(stock) ? `$${Math.round(Number(stock) / 1e6)} mdp` : '—'}`,
    `Días de inventario: ${esNum(diasInventario) ? `${Math.round(Number(diasInventario))} días` : '—'}`,
  ];
  const c = String(comentario || '').trim();
  if (c) lineas.push('', c);
  return lineas.join('\n');
}

/** Líneas "• SKU · nombre corto · N pz" (máximo `max`). top: [{ sku, descripcion, piezas }] */
function lineasTop(top, max = 5) {
  return (top || []).slice(0, max).map((t) => { const n = nombreCorto(t.descripcion); return `• ${t.sku}${n ? ` · ${n}` : ''} · ${piezas(t.piezas)} pz`; });
}

/**
 * Ficha limpia de un cliente (Análisis por cliente): sin alertas, márgenes ni cartera; el YoY sólo si es positivo.
 * { cliente, mes, anio, mtd, ytd, yoyYtd, top: [{ sku, descripcion, piezas }], marca }
 */
export function textoFichaCliente({ cliente, mes, anio, mtd, ytd, yoyYtd, top = [], marca = 'Acteck' } = {}) {
  const yoy = esNum(yoyYtd) && Number(yoyYtd) > 0 ? `${yoyTxt(yoyYtd)}${anio - 1})` : '';
  const lineas = [
    `*${marca} · ${cliente} · ${MESES_TITULO[(Number(mes) || 1) - 1]} ${anio}*`,
    `Facturación del mes: ${mdp(mtd)}`,
    `Acumulado ${anio}: ${mdp(ytd)}${yoy}`,
  ];
  const t = lineasTop(top);
  if (t.length) lineas.push('Top productos del año:', ...t);
  return lineas.join('\n');
}

/**
 * Avance del mes para el cliente propio (Sell In). Sin pagos, sin márgenes.
 * { cliente, mes, anio, mtd, cuota, ytd, top: [{ sku, descripcion, piezas }], marca }
 */
export function textoAvance({ cliente, mes, anio, mtd, cuota, ytd, top = [], marca = 'Acteck' } = {}) {
  const lineas = [
    `*${marca} · Avance ${cliente} · ${MESES_TITULO[(Number(mes) || 1) - 1]} ${anio}*`,
    `Facturado del mes: ${compacto(mtd)}`,
  ];
  if (esNum(cuota) && Number(cuota) > 0) lineas.push(`Cuota: ${compacto(cuota)} · avance ${pctEntero((Number(mtd) / Number(cuota)) * 100)}`);
  lineas.push(`Acumulado ${anio}: ${compacto(ytd)}`);
  const t = lineasTop(top);
  if (t.length) lineas.push('Top productos del mes:', ...t);
  return lineas.join('\n');
}

export async function copiar(texto) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(texto); return true; }
  } catch { /* cae al textarea */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = texto; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

/** Devuelve 'share' | 'whatsapp' | false según el camino que se usó. */
export async function compartir(texto, { titulo = 'Disponibilidad y precio' } = {}) {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try { await navigator.share({ title: titulo, text: texto }); return 'share'; }
    catch (e) { if (e?.name === 'AbortError') return false; }
  }
  const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  const w = window.open(url, '_blank', 'noopener');
  if (!w) window.location.href = url;
  return 'whatsapp';
}
