// Actividad del equipo · textos y traducciones (sin React, sin Supabase).
//   · MAPA_ACCIONES: tabla × operación de auditoria_cambios → acción en lenguaje de negocio
//   · etiquetas de páginas/clientes de la telemetría (enums de src/lib/telemetry.js)
//   · frases del hero y formatos cortos

export const CLIENTE_LABEL = { 1: 'Digitalife', 2: 'PCEL', 3: 'Dicotech', 4: 'Mercado Libre', 99: 'Global' };
export const CLIENTE_KEY_A_ID = { digitalife: 1, pcel: 2, dicotech: 3, mercadolibre: 4 };
export const PAGINA_LABEL = {
  1: 'Home', 2: 'Análisis', 3: 'Sell In', 4: 'Sell Out', 5: 'Marketing', 6: 'Pagos', 7: 'Cartera', 8: 'Forecast',
  9: 'Sell Out global', 10: 'Inventario global', 11: 'Estrategia de precios', 12: 'Tracking Pedidos',
  13: 'Análisis de clientes', 14: 'Importador', 15: 'Actividad del equipo', 16: 'Evaluaciones', 17: 'Configuración',
};
export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const DIAS_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

// Valor "a" de un campo en un UPDATE ({campo:{de,a}}) o el valor directo en INSERT/DELETE.
const val = (cambios, campo) => {
  const c = cambios?.[campo];
  if (c && typeof c === 'object' && !Array.isArray(c) && ('a' in c || 'de' in c)) return c.a;
  return c;
};
const cambio = (cambios, campo) => {
  const c = cambios?.[campo];
  return !!(c && typeof c === 'object' && !Array.isArray(c) && ('a' in c || 'de' in c));
};

// Cada entrada: { INSERT, UPDATE, DELETE } con string o función (cambios) → string.
// `area` agrupa para el resumen ("3 principales"). Fallback: humanizar(tabla, op).
export const MAPA_ACCIONES = {
  // ── Tracking / OCs ──
  oc_clientes:        { area: 'Tracking', INSERT: 'OC registrada', UPDATE: (c) => cambio(c, 'estado') ? `OC en «${val(c, 'estado')}»` : 'OC actualizada', DELETE: 'OC eliminada' },
  oc_clientes_skus:   { area: 'Tracking', INSERT: 'SKU agregado a OC', UPDATE: 'Línea de OC ajustada', DELETE: 'Línea de OC quitada' },
  oc_envios:          { area: 'Tracking', INSERT: 'Envío registrado', UPDATE: 'Envío actualizado', DELETE: 'Envío eliminado' },
  oc_envio_skus:      { area: 'Tracking', INSERT: 'SKU agregado a envío', UPDATE: 'Línea de envío ajustada', DELETE: 'Línea de envío quitada' },
  oc_facturas:        { area: 'Tracking', INSERT: 'Factura ligada a OC', UPDATE: 'Factura de OC actualizada', DELETE: 'Factura desligada' },
  oc_factura_skus:    { area: 'Tracking', INSERT: 'SKU facturado en OC', UPDATE: 'Línea de factura ajustada', DELETE: 'Línea de factura quitada' },
  oc_cotizaciones:    { area: 'Tracking', INSERT: 'Cotización registrada', UPDATE: 'Cotización actualizada', DELETE: 'Cotización eliminada' },
  // ── Propuestas ──
  propuestas_borradores: { area: 'Propuestas', INSERT: 'Propuesta creada', UPDATE: (c) => val(c, 'estado') === 'enviada' ? 'Propuesta enviada' : cambio(c, 'estado') ? `Propuesta en «${val(c, 'estado')}»` : 'Propuesta editada', DELETE: 'Propuesta eliminada' },
  propuestas_equipo:  { area: 'Propuestas', INSERT: 'Propuesta de equipo creada', UPDATE: 'Propuesta de equipo editada', DELETE: 'Propuesta de equipo eliminada' },
  // ── Pagos / Marketing ──
  pagos:              { area: 'Pagos', INSERT: 'Pago registrado', UPDATE: (c) => val(c, 'estado') === 'pagado' || val(c, 'pagado') === true ? 'Pago marcado como pagado' : 'Pago actualizado', DELETE: 'Pago eliminado' },
  spiffs:             { area: 'Pagos', INSERT: 'Spiff registrado', UPDATE: 'Spiff actualizado', DELETE: 'Spiff eliminado' },
  fondos_mkt_movimientos: { area: 'Marketing', INSERT: 'Movimiento de fondo de marketing', UPDATE: 'Movimiento de fondo editado', DELETE: 'Movimiento de fondo eliminado' },
  inversion_marketing: { area: 'Marketing', INSERT: 'Inversión de marketing registrada', UPDATE: 'Inversión de marketing editada', DELETE: 'Inversión de marketing eliminada' },
  marketing_actividades: { area: 'Marketing', INSERT: 'Actividad de marketing registrada', UPDATE: 'Actividad de marketing editada', DELETE: 'Actividad de marketing eliminada' },
  lineamientos_cliente: { area: 'Pagos', INSERT: 'Lineamiento de cliente creado', UPDATE: 'Lineamiento de cliente editado', DELETE: 'Lineamiento de cliente eliminado' },
  // ── Forecast / S&OP / Compras ──
  forecast_propuestas: { area: 'Forecast', INSERT: 'Reserva de forecast creada', UPDATE: 'Reserva de forecast editada', DELETE: 'Reserva de forecast eliminada' },
  forecast_propuesta_lineas: { area: 'Forecast', INSERT: 'SKU reservado en forecast', UPDATE: (c) => cambio(c, 'comprado_at') && val(c, 'comprado_at') ? 'Reserva marcada como comprada' : 'Línea de reserva ajustada', DELETE: 'SKU quitado de reserva' },
  forecast_avisos:    { area: 'Forecast', INSERT: 'Aviso de forecast creado', UPDATE: 'Aviso de forecast editado', DELETE: 'Aviso de forecast eliminado' },
  sugeridos_compra:   { area: 'S&OP', INSERT: 'Sugerido de compra creado', UPDATE: 'Sugerido de compra editado', DELETE: 'Sugerido de compra eliminado' },
  solicitudes_compra: { area: 'S&OP', INSERT: 'Solicitud de compra creada', UPDATE: 'Solicitud de compra editada', DELETE: 'Solicitud de compra eliminada' },
  solicitudes_compra_lineas: { area: 'S&OP', INSERT: 'SKU agregado a solicitud de compra', UPDATE: 'Línea de solicitud ajustada', DELETE: 'SKU quitado de solicitud' },
  sop_reuniones:      { area: 'S&OP', INSERT: 'Reunión de S&OP registrada', UPDATE: 'Reunión de S&OP editada', DELETE: 'Reunión de S&OP eliminada' },
  sop_reuniones_lineas: { area: 'S&OP', INSERT: 'SKU agregado a reunión de S&OP', UPDATE: 'Línea de S&OP ajustada', DELETE: 'SKU quitado de reunión de S&OP' },
  // ── Datos ──
  sync_solicitudes:   { area: 'Datos', INSERT: 'Corrida pedida', UPDATE: (c) => cambio(c, 'estado') ? `Corrida ${val(c, 'estado')}` : 'Corrida actualizada', DELETE: 'Corrida cancelada' },
  cuotas_mensuales:   { area: 'Datos', INSERT: 'Cuota mensual capturada', UPDATE: 'Cuota mensual editada', DELETE: 'Cuota mensual eliminada' },
  cuotas_canales:     { area: 'Datos', INSERT: 'Cuota de canal capturada', UPDATE: 'Cuota de canal editada', DELETE: 'Cuota de canal eliminada' },
  roadmap_sku:        { area: 'Datos', INSERT: 'SKU agregado al roadmap', UPDATE: 'Roadmap de SKU actualizado', DELETE: 'SKU quitado del roadmap' },
  sku_config:         { area: 'Datos', INSERT: 'Configuración de SKU creada', UPDATE: 'Configuración de SKU editada', DELETE: 'Configuración de SKU eliminada' },
  almacenes_config:   { area: 'Datos', INSERT: 'Almacén configurado', UPDATE: 'Almacén reconfigurado', DELETE: 'Almacén quitado' },
  ventas_mensuales:   { area: 'Datos', INSERT: 'Venta mensual capturada', UPDATE: 'Venta mensual editada', DELETE: 'Venta mensual eliminada' },
  clientes_credito_config: { area: 'Cobranza', INSERT: 'Crédito de cliente configurado', UPDATE: 'Crédito de cliente ajustado', DELETE: 'Crédito de cliente eliminado' },
  precios_competencia: { area: 'Precios', INSERT: 'Precio de competencia capturado', UPDATE: 'Precio de competencia editado', DELETE: 'Precio de competencia eliminado' },
  elasticidad_supuestos: { area: 'Precios', INSERT: 'Supuesto de elasticidad creado', UPDATE: 'Supuesto de elasticidad editado', DELETE: 'Supuesto de elasticidad eliminado' },
  // ── Agenda / Pendientes ──
  agenda_items:       { area: 'Agenda', INSERT: (c) => val(c, 'tipo') === 'punto' ? 'Punto de reunión creado' : 'Tarea creada', UPDATE: (c) => val(c, 'estado') === 'hecha' ? 'Pendiente cerrado' : val(c, 'estado') === 'cancelada' ? 'Pendiente cancelado' : val(c, 'estado') === 'abierta' && cambio(c, 'estado') ? 'Pendiente reabierto' : 'Pendiente editado', DELETE: 'Pendiente eliminado' },
  agenda_reuniones:   { area: 'Agenda', INSERT: (c) => val(c, 'tipo') === 'evento' ? 'Evento agendado' : 'Reunión agendada', UPDATE: (c) => cambio(c, 'cerrada_at') && val(c, 'cerrada_at') ? 'Reunión cerrada' : 'Reunión editada', DELETE: 'Reunión eliminada' },
  pendientes:         { area: 'Agenda', INSERT: 'Pendiente creado', UPDATE: (c) => val(c, 'completado') === true || val(c, 'estado') === 'hecha' ? 'Pendiente cerrado' : 'Pendiente editado', DELETE: 'Pendiente eliminado' },
  pendientes_equipo:  { area: 'Agenda', INSERT: 'Pendiente de equipo creado', UPDATE: (c) => val(c, 'completado') === true || val(c, 'estado') === 'hecha' ? 'Pendiente de equipo cerrado' : 'Pendiente de equipo editado', DELETE: 'Pendiente de equipo eliminado' },
  tareas_recurrentes: { area: 'Agenda', INSERT: 'Tarea recurrente creada', UPDATE: 'Tarea recurrente editada', DELETE: 'Tarea recurrente eliminada' },
  minutas:            { area: 'Agenda', INSERT: 'Minuta registrada', UPDATE: 'Minuta editada', DELETE: 'Minuta eliminada' },
  minuta_acuerdos:    { area: 'Agenda', INSERT: 'Acuerdo de minuta registrado', UPDATE: 'Acuerdo de minuta editado', DELETE: 'Acuerdo de minuta eliminado' },
  eventos_cliente:    { area: 'Agenda', INSERT: 'Evento de cliente agendado', UPDATE: 'Evento de cliente editado', DELETE: 'Evento de cliente eliminado' },
  eventos_equipo:     { area: 'Agenda', INSERT: 'Evento de equipo agendado', UPDATE: 'Evento de equipo editado', DELETE: 'Evento de equipo eliminado' },
  // ── Equipo / Administración ──
  // Ruido de UI (preferencias, tema, avatar) → null = no cuenta como acción de negocio.
  perfiles:           { area: 'Administración', INSERT: 'Usuario creado', UPDATE: (c) => cambio(c, 'permisos') ? 'Permisos cambiados' : cambio(c, 'activo') ? (val(c, 'activo') ? 'Usuario activado' : 'Usuario desactivado') : cambio(c, 'se_evalua') ? (val(c, 'se_evalua') ? 'Evaluación mensual activada' : 'Evaluación mensual desactivada') : cambio(c, 'nombre') || cambio(c, 'puesto') || cambio(c, 'tipo') || cambio(c, 'rol') ? 'Perfil editado' : null, DELETE: 'Usuario eliminado' },
  evaluaciones_mensuales: { area: 'Equipo', INSERT: 'Evaluación mensual iniciada', UPDATE: (c) => val(c, 'cerrada') === true ? 'Evaluación mensual cerrada' : 'Evaluación mensual capturada', DELETE: 'Evaluación mensual eliminada' },
  evaluaciones:       { area: 'Equipo', INSERT: 'Evaluación registrada', UPDATE: 'Evaluación editada', DELETE: 'Evaluación eliminada' },
  evaluaciones_kpis_template: { area: 'Equipo', INSERT: 'KPI de evaluación creado', UPDATE: 'KPI de evaluación editado', DELETE: 'KPI de evaluación eliminado' },
};

/** Módulo/pestaña de negocio al que pertenece una tabla auditada (fuente: MAPA_ACCIONES[tabla].area). */
export const areaDeTabla = (tabla) => MAPA_ACCIONES[tabla]?.area || 'Otros';

const OP_HUMANO = { INSERT: 'creado', UPDATE: 'editado', DELETE: 'eliminado' };
export function humanizar(tabla, op) {
  const t = String(tabla || '').replace(/_/g, ' ');
  return `${t.charAt(0).toUpperCase()}${t.slice(1)} ${OP_HUMANO[op] || String(op || '').toLowerCase()}`;
}

/** Traduce una fila de auditoria_cambios → { label, area } · null si es ruido (no cuenta como acción). Tolerante a tablas no mapeadas. */
export function traducirAccion(fila) {
  const def = MAPA_ACCIONES[fila?.tabla];
  const op = fila?.operacion;
  if (!def) return { label: humanizar(fila?.tabla, op), area: 'Otros' };
  const v = def[op];
  if (v === undefined) return { label: humanizar(fila?.tabla, op), area: def.area || 'Otros' };
  const label = typeof v === 'function' ? v(fila?.cambios || {}) : v;
  if (label === null) return null;
  return { label: label || humanizar(fila?.tabla, op), area: def.area || 'Otros' };
}

// ─── Formatos cortos ───
export function fmtHm(mins) {
  const m = Math.round(Number(mins) || 0);
  if (m < 1) return '0 min';
  const h = Math.floor(m / 60), r = m % 60;
  return h > 0 ? `${h} h ${r} min` : `${r} min`;
}
export function fmtHmCorto(mins) {
  const m = Math.round(Number(mins) || 0);
  if (m < 1) return '0m';
  const h = Math.floor(m / 60), r = m % 60;
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
}
export function fmtHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}
export function fmtDiaLargo(isoDia) {
  if (!isoDia) return '—';
  return new Date(`${isoDia}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
}
export const plural = (n, s, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;
export const nombreCorto = (nombre) => String(nombre || '').trim().split(/\s+/)[0] || '—';

/** Frase del hero según el pulso del día. */
export function fraseHero(pulso, total) {
  if (!total) return 'Sin usuarios internos activos.';
  const a = pulso.activosHoy;
  if (a === 0) return 'Nadie ha entrado hoy todavía.';
  if (a === total) return 'Todo el equipo ha entrado hoy.';
  return `${plural(a, 'persona')} de ${total} ${a === 1 ? 'ha' : 'han'} entrado hoy.`;
}

/** Pill de inactividad: null si está al día. */
export function textoInactividad(inactividad) {
  if (!inactividad) return null;
  if (inactividad.sinEntrar) return `sin entrar ${plural(inactividad.diasSinEntrar, 'día hábil', 'días hábiles')}`;
  if (inactividad.sinCerrar) return `sin cerrar pendientes ${plural(inactividad.diasSinCerrar, 'día hábil', 'días hábiles')}`;
  return null;
}
