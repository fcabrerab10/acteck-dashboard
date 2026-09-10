// Forecast › Reservas · constantes, formatos y textos compartidos (WhatsApp de la reserva).
// La búsqueda por palabras sin acentos se reexporta de sellin/textos.js (fuente única).
import { fechaCorta, fechaHora, nombreCorto, piezas as fmtPiezasWA } from '../../../lib/whatsapp';

export { normalizar, tokens, coincide, roadmapTone, capitalizar } from '../sellin/textos';

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const CLIENTES = [
  { key: 'digitalife', label: 'Digitalife', short: 'DGL', campo: 'necesidad_dgl', tone: 'purple' },
  { key: 'pcel',       label: 'PCEL',       short: 'PCE', campo: 'necesidad_pce', tone: 'green' },
  { key: 'dicotech',   label: 'Dicotech',   short: 'DCT', campo: 'necesidad_dct', tone: 'orange' },
];
export const CLIENTE_KEYS = CLIENTES.map((c) => c.key);
export const clienteLabel = (k) => CLIENTES.find((c) => c.key === k)?.label || k;
export const clienteCampo = (k) => CLIENTES.find((c) => c.key === k)?.campo;

// ── Estados de una fila (filtro "Estado") ──
export const ESTADOS_FILA = [
  { id: 'con_brecha',   label: 'Con brecha',   tone: 'red',   title: 'Recomendación > 0 y aún sin reservar' },
  { id: 'en_propuesta', label: 'En propuesta', tone: 'blue',  title: 'Tiene piezas reservadas en la propuesta activa' },
  { id: 'confirmado',   label: 'Confirmado',   tone: 'green', title: 'Reserva confirmada (o parcial) por Acteck' },
  { id: 'sin_sellout',  label: 'Sin sell-out', tone: 'gray',  title: 'Sin sell-out en la ventana del método' },
];
export const ESTADO_LINEA_LABEL = {
  draft: '—', propuesta: 'Propuesta', pend_confirmar: 'Pendiente', confirmado: 'Confirmado', parcial: 'Parcial', no_aplica: 'N/A',
  subido_crm: 'En CRM', comprado: 'Comprado', arribado: 'Arribado',
};
export const ESTADO_LINEA_TONE = {
  draft: 'gray', propuesta: 'blue', pend_confirmar: 'blue', confirmado: 'green', parcial: 'orange', no_aplica: 'red',
  subido_crm: 'purple', comprado: 'green', arribado: 'green',
};

// ── Números / fechas ──
export const N = (v) => Number(v) || 0;
export const fmtInt = (n) => (n == null || !isFinite(Number(n)) ? '—' : Math.round(Number(n)).toLocaleString('es-MX'));
/** 0 → '—' (celdas de tabla). */
export const fmtNum = (n) => { const v = Math.round(Number(n) || 0); return v === 0 ? '—' : v.toLocaleString('es-MX'); };
export const fmtPct = (n) => (n == null || !isFinite(n) ? '—' : `${Math.round(n)}%`);
export const mesKey = (anio, mes) => `${anio}-${String(mes).padStart(2, '0')}`;
export const labelMes = (anio, mes, largo = false) => `${(largo ? MESES_LARGO : MESES)[mes - 1]} ${largo ? anio : String(anio).slice(2)}`;
export { fechaCorta, fechaHora, nombreCorto };
/** Date → 'YYYY-MM-DD' en hora local (sin corrimiento por UTC). */
export const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ── WhatsApp · reserva por cliente ──
// Sin nada sensible: cliente, SKU, nombre corto, piezas y arribo estimado. Nunca precios, costos ni márgenes.
// lineas: [{ sku, descripcion, piezas, arribo: 'YYYY-MM-DD' | null }]
export function textoReservaCliente({ cliente, lineas, nombre, fecha = new Date(), marca = 'Acteck' }) {
  const out = [`*${marca} · Reserva de arribos · ${clienteLabel(cliente)}*`, nombre ? String(nombre) : null, fechaHora(fecha), ''].filter((x) => x !== null);
  const lista = (lineas || []).filter((l) => N(l.piezas) > 0);
  if (!lista.length) out.push('Sin piezas reservadas para este cliente.');
  lista.forEach((l, i) => {
    const corto = nombreCorto(l.descripcion);
    out.push(`• ${l.sku}${corto ? ` · ${corto}` : ''}`);
    out.push(`  Reserva: ${fmtPiezasWA(l.piezas)} pz`);
    out.push(`  Arribo estimado: ${l.arribo ? fechaCorta(l.arribo) : 'por confirmar'}`);
    if (i < lista.length - 1) out.push('');
  });
  const total = lista.reduce((a, l) => a + N(l.piezas), 0);
  if (lista.length) { out.push(''); out.push(`Total: ${fmtPiezasWA(total)} pz en ${lista.length} SKU${lista.length === 1 ? '' : 's'}`); }
  return out.join('\n');
}
