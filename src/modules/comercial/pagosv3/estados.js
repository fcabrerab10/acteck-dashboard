// Flujo de un pago · Pagos V3 (2026-09-12) · PURO
//   calculado → solicitado → autorizado → folio → pagado
//   rechazado (con motivo) regresa a calculado · cancelado = "No aplica"

export const ETAPAS = [
  { id: 'calculado',  label: 'Calculado',  sub: 'motor o captura',   tone: 'gray',   accion: 'Solicitar' },
  { id: 'solicitado', label: 'Solicitado', sub: 'correo enviado',    tone: 'blue',   accion: 'Autorizar' },
  { id: 'autorizado', label: 'Autorizado', sub: 'David',             tone: 'purple', accion: 'Capturar folio' },
  { id: 'folio',      label: 'Con folio',  sub: 'finanzas',          tone: 'orange', accion: 'Registrar pago' },
  { id: 'pagado',     label: 'Pagado',     sub: 'nota de crédito',   tone: 'green',  accion: null },
];

export const ETAPAS_IDS = ETAPAS.map((e) => e.id);

export const ESTADO_META = {
  ...Object.fromEntries(ETAPAS.map((e) => [e.id, e])),
  rechazado: { id: 'rechazado', label: 'Rechazado', sub: 'con motivo', tone: 'red', accion: 'Corregir' },
  cancelado: { id: 'cancelado', label: 'No aplica', sub: 'sin pago',   tone: 'gray', accion: null },
};

export const TIPO_META = {
  rebate:            { label: 'Rebate',              color: '#FF3B30', tone: 'red' },
  spiff:             { label: 'SPIFF',               color: '#5856D6', tone: 'purple' },
  dinamica:          { label: 'Dinámica',            color: '#5856D6', tone: 'purple' },
  proteccion_precio: { label: 'Protección',          color: '#30B0C7', tone: 'blue' },
  marketing:         { label: 'Marketing',           color: '#FF9500', tone: 'orange' },
  fijo:              { label: 'Fijo',                color: '#FF9500', tone: 'orange' },
  promocion:         { label: 'Promoción',           color: '#34C759', tone: 'green' },
  bonificacion:      { label: 'Bonificación',        color: '#34C759', tone: 'green' },
  otro:              { label: 'Otro',                color: '#8E8E93', tone: 'gray' },
};

export const TIPOS_MANUALES = ['proteccion_precio', 'bonificacion', 'promocion', 'marketing', 'otro'];

export const indiceEtapa = (estado) => ETAPAS_IDS.indexOf(estado);

/** Siguiente estado del flujo (null si ya está pagado o fuera de flujo). */
export function siguienteEstado(estado) {
  const i = indiceEtapa(estado);
  if (i < 0 || i >= ETAPAS_IDS.length - 1) return null;
  return ETAPAS_IDS[i + 1];
}

/** ¿Se puede pasar de `desde` a `hacia`? Sólo avances de una etapa, rechazo y cancelación. */
export function transicionValida(desde, hacia) {
  if (hacia === 'rechazado') return ['solicitado', 'autorizado', 'folio'].includes(desde);
  if (hacia === 'cancelado') return desde !== 'pagado';
  if (desde === 'rechazado') return hacia === 'calculado' || hacia === 'solicitado';
  return siguienteEstado(desde) === hacia;
}

/** Campos que el flujo exige para poder avanzar. */
export function faltaPara(pago, hacia) {
  if (hacia === 'folio' && !String(pago?.folio || '').trim()) return 'Captura el folio que asignó finanzas.';
  if (hacia === 'pagado' && !String(pago?.nc_folio || '').trim()) return 'Captura la nota de crédito (folio) o adjunta su PDF.';
  return null;
}

const HOY = () => new Date().toISOString().slice(0, 10);

/** Días que lleva el pago en su etapa actual (para "atorados"). */
export function diasEnEtapa(pago, hoyISO = HOY()) {
  const sello = pago?.folio_at || pago?.autorizado_at || pago?.solicitado_at || pago?.created_at;
  if (!sello) return 0;
  const a = new Date(String(sello).slice(0, 10) + 'T00:00:00');
  const b = new Date(hoyISO + 'T00:00:00');
  return Math.max(0, Math.round((b - a) / 86400000));
}

/** Días para la fecha programada (negativo = vencido). */
export function diasParaPago(pago, hoyISO = HOY()) {
  const f = pago?.fecha_programada || pago?.fecha_compromiso;
  if (!f) return null;
  const a = new Date(String(f).slice(0, 10) + 'T00:00:00');
  const b = new Date(hoyISO + 'T00:00:00');
  return Math.round((a - b) / 86400000);
}

export const estaAbierto = (p) => !['pagado', 'cancelado'].includes(p?.estado);
export const estaVencido = (p, hoy = HOY()) => estaAbierto(p) && (diasParaPago(p, hoy) ?? 99) < 0;
export const venceEn = (p, dias = 7, hoy = HOY()) => {
  const d = diasParaPago(p, hoy);
  return estaAbierto(p) && d !== null && d >= 0 && d <= dias;
};

/** Conteo y monto por etapa (el panel "Flujo del mes"). */
export function resumenFlujo(pagos = []) {
  return ETAPAS.map((e) => {
    const filas = pagos.filter((p) => p.estado === e.id);
    return { ...e, n: filas.length, monto: filas.reduce((s, p) => s + (Number(p.monto) || 0), 0) };
  });
}

export default { ETAPAS, ETAPAS_IDS, ESTADO_META, TIPO_META, siguienteEstado, transicionValida, faltaPara, diasEnEtapa, diasParaPago, estaVencido, venceEn, resumenFlujo, estaAbierto, indiceEtapa };
