// Forecast CRM · mapa cliente_key → { codigo, nombre, tipo } para la plantilla del CRM.
//
// Los códigos vienen del ERP (erp_ventas.cliente / cliente_nombre, verificado 2026-09-11):
//   digitalife → 00764 API GLOBAL · pcel → 00473 PC ONLINE · dicotech → 00708 DICOTECH MAYORISTA DE TECNOLOGIA
// La plantilla acepta "codigo o nombre"; mandamos el código (más estable que el nombre).
// `tipo` (directa/indirecta) es editable en pantalla (pill por cliente) y se recuerda en localStorage.

export const CLIENTES_CRM = {
  digitalife: { codigo: '00764', nombre: 'API GLOBAL',                       tipo: 'directa' },
  pcel:       { codigo: '00473', nombre: 'PC ONLINE',                        tipo: 'directa' },
  dicotech:   { codigo: '00708', nombre: 'DICOTECH MAYORISTA DE TECNOLOGIA', tipo: 'directa' },
};

export const TIPOS_CRM = ['directa', 'indirecta'];

const LS_KEY = 'forecastCRM.tipos';

function leerTipos() {
  try { const v = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}

/** Datos del cliente para la plantilla, con el tipo guardado por el usuario (si lo cambió). */
export function clienteCRM(clienteKey) {
  const base = CLIENTES_CRM[clienteKey] || { codigo: '', nombre: clienteKey, tipo: 'directa' };
  const t = leerTipos()[clienteKey];
  return { ...base, tipo: TIPOS_CRM.includes(t) ? t : base.tipo };
}

export function guardarTipoCRM(clienteKey, tipo) {
  if (!TIPOS_CRM.includes(tipo)) return;
  try { localStorage.setItem(LS_KEY, JSON.stringify({ ...leerTipos(), [clienteKey]: tipo })); } catch { /* sin localStorage */ }
}
