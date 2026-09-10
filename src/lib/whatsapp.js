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
