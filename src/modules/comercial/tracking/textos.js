// Tracking Pedidos V3 · constantes, formatos y textos compartibles (módulo puro, sin React).
// Los textos de WhatsApp viven aquí (src/lib/whatsapp.js no se toca).

export const CLIENTES = [
  { key: 'digitalife', nombre: 'Digitalife', tone: 'blue' },
  { key: 'pcel',       nombre: 'PCEL',       tone: 'red' },
  { key: 'dicotech',   nombre: 'Dicotech',   tone: 'purple' },
];
export const NOMBRE_CLIENTE = Object.fromEntries(CLIENTES.map((c) => [c.key, c.nombre]));
export const TONE_CLIENTE = Object.fromEntries(CLIENTES.map((c) => [c.key, c.tone]));
export const nombreCliente = (k) => NOMBRE_CLIENTE[k] || k || '—';

// Etapas derivadas (cotización sólo si existe). "procesada" y "surtida" ya no existen: facturada = factura del ERP.
export const ETAPAS = ['cotizacion', 'recibida', 'facturada', 'enviada', 'entregada'];
export const ETAPA_LABEL = { cotizacion: 'Cotización', recibida: 'Recibida', facturada: 'Facturada', enviada: 'Enviada', entregada: 'Entregada' };
export const ETAPA_TONE  = { cotizacion: 'purple', recibida: 'blue', facturada: 'orange', enviada: 'yellow', entregada: 'green', perdida: 'red' };
export const ETAPA_ORDEN = Object.fromEntries(ETAPAS.map((e, i) => [e, i]));

export const ESTADO_COT_LABEL = { solicitada: 'Cot. solicitada', enviada: 'Cot. enviada', aceptada: 'Cot. aceptada', perdida: 'Cot. perdida' };
export const MOTIVOS_PERDIDA = ['Precio', 'Tiempo de entrega', 'Sin stock', 'Cliente desistió', 'Otro'];

export const DIAS_DETENIDA = 3;      // > 3 días sin cambio de etapa
export const DESFASE_DIAS  = 2;      // fecha manual vs ERP difiere > 2 días
export const META_ENTREGA  = 9;      // días OC recibida → entregada
export const METAS_DIAS    = { factura: 2, envio: 2, entrega: 2, total: META_ENTREGA };
export const VENTANA_TIEMPOS_DIAS = 90;
export const VENTANA_FACTURAS_SIN_OC_DIAS = 30;

export const ALMACENES   = ['GDL', 'CDMX'];
export const PAQUETERIAS = ['Estafeta', 'DHL', 'Fedex', 'Redpack', 'Paquetexpress', 'Unidad propia', 'Otra'];

// ── Formatos ──
export const N = (v) => Number(v) || 0;
export const fmtInt = (n) => (n == null || !isFinite(n) ? '—' : Math.round(n).toLocaleString('es-MX'));
export const fmtPct = (n, d = 0) => (n == null || !isFinite(n) ? '—' : `${n.toFixed(d)} %`);
export const fmtDias = (n, d = 1) => (n == null || !isFinite(n) ? '—' : `${n.toFixed(d)} d`);
export const fmtMoney = (n) => (n == null || !isFinite(n) ? '—' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n));
export const fmtMoneyShort = (n) => {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)} mdp`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)} K`;
  return `${s}$${Math.round(a)}`;
};
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** ISO (con o sin hora) → '4 sep'. Nulo → '—'. Usa la fecha local para no correr el día. */
export function fmtFecha(iso) {
  const d = aFecha(iso);
  if (!d) return '—';
  return `${d.getDate()} ${MESES_CORTO[d.getMonth()]}`;
}
export function fmtFechaAnio(iso) {
  const d = aFecha(iso);
  if (!d) return '—';
  return `${d.getDate()} ${MESES_CORTO[d.getMonth()]} ${d.getFullYear()}`;
}
/** Acepta Date, 'YYYY-MM-DD' (local) o ISO con hora. */
export function aFecha(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
/** Diferencia en días (decimal) entre dos fechas; null si falta alguna. */
export function dias(desde, hasta) {
  const a = aFecha(desde), b = aFecha(hasta);
  if (!a || !b) return null;
  return (b.getTime() - a.getTime()) / 86400000;
}
/** Date → 'YYYY-MM-DD' local (para inputs type=date). */
export function isoDia(v) {
  const d = aFecha(v);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Búsqueda sin acentos ──
export const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const tokens = (q) => normalizar(q).split(/\s+/).filter(Boolean);
/** Número de OC / referencia normalizado (misma regla que oc_norm en Postgres): mayúsculas, [A-Z0-9], sin ceros a la izquierda. */
export const normOC = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '');

// ── Textos para WhatsApp (nada sensible: sin costos ni márgenes) ──
const linea = (parts) => parts.filter(Boolean).join(' · ');
const nombreCortoDesc = (d) => String(d || '').split(' / ')[0].slice(0, 60);

/** Estatus de una OC calculada (ver calculo.js → calcularOC). */
export function textoEstatusOC(oc, { fecha = new Date() } = {}) {
  const etapaTxt = oc.etapa === 'cotizacion' ? (ESTADO_COT_LABEL[oc.cotizacion?.estado] || 'Cotización')
    : oc.etapa === 'facturada' && oc.fill < 100 ? 'Facturada parcial' : (ETAPA_LABEL[oc.etapa] || oc.etapa);
  const l = [];
  l.push(`*${nombreCliente(oc.cliente_key)} · OC ${oc.numero_oc_cliente}*`);
  l.push(`Estatus: ${etapaTxt}${oc.fechaEtapa ? ` (${fmtFecha(oc.fechaEtapa)})` : ''}`);
  if (oc.fecha_recibida) l.push(`Recibida: ${fmtFecha(oc.fecha_recibida)}`);
  if (oc.facturas?.length) l.push(`Facturas: ${oc.facturas.map((f) => f.folio).join(', ')}`);
  l.push(`Piezas: ${fmtInt(oc.facturado)} de ${fmtInt(oc.pedido)} facturadas${oc.backorder > 0 ? ` · pendientes ${fmtInt(oc.backorder)}` : ''}`);
  for (const e of oc.envios || []) {
    const g = linea([e.paqueteria, e.guia_rastreo ? `guía ${e.guia_rastreo}` : null, e.fechaEnvio ? `enviado ${fmtFecha(e.fechaEnvio)}` : null, e.fechaEntrega ? `recibido ${fmtFecha(e.fechaEntrega)}${e.persona_recibio ? ` por ${e.persona_recibio}` : ''}` : null]);
    if (g) l.push(`Envío ${e.numero_envio}: ${g}`);
  }
  if (oc.etapa !== 'entregada' && oc.fechaEstimada) l.push(`Entrega estimada: ${fmtFecha(oc.fechaEstimada)}`);
  if (oc.backorderSkus?.length) {
    l.push('Pendiente por surtir:');
    for (const s of oc.backorderSkus.slice(0, 8)) l.push(`• ${s.sku}${s.descripcion ? ` ${nombreCortoDesc(s.descripcion)}` : ''}: ${fmtInt(s.backorder)} pz${s.conStock ? ' (en almacén)' : s.cubre ? ` (llega ${fmtFecha(s.cubre.eta)})` : ''}`);
  }
  l.push(`_Acteck · ${fmtFechaAnio(fecha)}_`);
  return l.join('\n');
}

/** Lista "surtir hoy" (OCs con stock completo). */
export function textoListaSurtir(filas, { fecha = new Date() } = {}) {
  const l = [`*Surtir hoy · ${fmtFechaAnio(fecha)}*`, `${filas.length} OC${filas.length === 1 ? '' : 's'} con stock completo`];
  for (const r of filas) l.push(`• ${nombreCliente(r.cliente_key)} OC ${r.numero_oc_cliente}: ${fmtInt(r.pendiente)} pz${r.almacen ? ` · ${r.almacen}` : ''} · ${Math.round(r.diasEnEtapa ?? 0)} d`);
  l.push('_Acteck_');
  return l.join('\n');
}

/** Texto explicativo del drill (una o dos frases). */
export function textoExplicativo(oc) {
  const p = [];
  if (oc.etapa === 'cotizacion') {
    const c = oc.cotizacion || {};
    p.push(`Cotización ${c.folio || ''} ${ESTADO_COT_LABEL[c.estado]?.toLowerCase() || ''}`.trim() + (c.fecha_enviada ? ` el ${fmtFecha(c.fecha_enviada)}` : c.fecha_solicitada ? ` el ${fmtFecha(c.fecha_solicitada)}` : '') + '.');
    p.push(c.estado === 'perdida' ? `Perdida${c.motivo_perdida ? `: ${c.motivo_perdida}` : ''}.` : 'Cuando el cliente la acepte, conviértela en OC desde el botón de arriba.');
    return p.join(' ');
  }
  if (!oc.facturas?.length && oc.fuenteFacturado !== 'manual') {
    p.push(`OC recibida el ${fmtFecha(oc.fecha_recibida)}${oc.diasEnEtapa != null ? ` · ${Math.round(oc.diasEnEtapa)} d sin factura` : ''}.`);
    if (oc.folioPendientes?.length) p.push(`Folio${oc.folioPendientes.length > 1 ? 's' : ''} ${oc.folioPendientes.join(', ')} capturado a mano; aún no aparece en el ERP.`);
    else p.push('La factura entrará sola desde el ERP (por referencia o por folio capturado).');
    if (oc.surtibleHoy) p.push('Hay stock completo en almacén comercial: se puede surtir hoy.');
  } else {
    const fs = oc.facturas || [];
    if (fs.length) p.push(`${fs.length === 1 ? 'La factura' : 'Las facturas'} ${fs.map((f) => f.folio).join(', ')} ${fs.length === 1 ? 'entró' : 'entraron'} ${fs.every((f) => f.fuente === 'erp') ? 'desde el ERP' : 'a mano'} con ${fmtInt(oc.facturado)} pz de ${fmtInt(oc.pedido)}.`);
    else p.push(`Surtido capturado a mano: ${fmtInt(oc.facturado)} de ${fmtInt(oc.pedido)} pz.`);
    if (oc.backorder > 0) {
      const conStock = oc.backorderSkus.filter((s) => s.conStock);
      const cubre = oc.backorderSkus.filter((s) => !s.conStock && s.cubre);
      const sinPo = oc.backorderSkus.filter((s) => !s.conStock && !s.cubre);
      const partes = [];
      if (conStock.length) partes.push(`${conStock.length === oc.backorderSkus.length ? 'todo' : `${conStock.length} SKU${conStock.length > 1 ? 's' : ''}`} con stock hoy`);
      if (cubre.length) partes.push(`${cubre.length} SKU${cubre.length > 1 ? 's' : ''} con arribo (${[...new Set(cubre.map((s) => `PO ${s.cubre.po} · ${fmtFecha(s.cubre.eta)}`))].slice(0, 2).join(', ')})`);
      if (sinPo.length) partes.push(`${sinPo.length} SKU${sinPo.length > 1 ? 's' : ''} sin PO`);
      p.push(`Faltan ${fmtInt(oc.backorder)} pz${partes.length ? `: ${partes.join(', ')}` : ''}.`);
    }
    if (oc.etapa === 'facturada') p.push('Si el ERP no trae la guía, "Registrar envío" la captura a mano; si después llega la del ERP se muestra el desfase y eliges cuál fecha vale.');
    if (oc.etapa === 'enviada') p.push(`Enviada el ${fmtFecha(oc.fechaEtapa)}${oc.envios.some((e) => e.fuente === 'erp' || e.guia_erp_id) ? ' (guía del ERP)' : ' (captura manual)'}; falta la recepción del cliente.`);
    if (oc.etapa === 'entregada') p.push(`Entregada el ${fmtFecha(oc.fechaEtapa)} · ${oc.diasTotal != null ? `${oc.diasTotal.toFixed(1)} d desde la OC` : ''}${oc.diasTotal != null ? (oc.diasTotal <= META_ENTREGA ? ' · en meta' : ` · fuera de meta (${META_ENTREGA} d)`) : ''}.`);
  }
  if (oc.detenida) p.push(`Detenida: ${Math.round(oc.diasEnEtapa)} d en ${ETAPA_LABEL[oc.etapa]?.toLowerCase()}.`);
  return p.join(' ');
}
