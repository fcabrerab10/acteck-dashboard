// Propuesta «en curso» de la calculadora de precios (celular · 2026-10-05).
// Se guarda DE VERDAD en propuestas_borradores con la forma canónica de propuestas/recientes.js (lineas jsonb,
// estado borrador, anio/mes, vigencia, creado_por; el trigger pone el folio al enviar), así aparece en Propuestas
// (web y celular). El id del borrador abierto se recuerda en localStorage para seguir donde se quedó.
// Las líneas NO llevan costo: el margen se recalcula en pantalla con el costo del director (sensible) y nunca viaja en el jsonb.
import { guardarPropuesta, obtenerPropuesta, actualizarPropuesta, marcarEnviada as _marcarEnviada } from '../../../modules/comercial/propuestas/recientes';
import { CLIENTES, nuevaPropuestaId, vigenciaPorDefecto, MES_ACTUAL, LISTA_POR_CLIENTE } from '../../../modules/comercial/propuestas/constantes';

export const QK_PROPUESTAS = ['movil', 'propuestas'];   // misma llave que movil/pestanas/Propuestas.jsx
const LS_KEY = 'precios_propuesta_en_curso_v1';
const N = (v) => Number(v) || 0;

/** Cliente propio de una lista natural (API → digitalife, PCEL → pcel, DICOTECH → dicotech) o null. */
export const clienteDeLista = (lista) => Object.entries(LISTA_POR_CLIENTE).find(([, l]) => l === lista)?.[0] || null;
export const labelCliente = (k) => CLIENTES.find((c) => c.key === k)?.label || k || '';

export function leerEnCurso() {
  try { const r = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); return r && r.id ? r : null; } catch { return null; }
}
export function recordarEnCurso(id, clienteKey) {
  try { if (id) localStorage.setItem(LS_KEY, JSON.stringify({ id, clienteKey })); else localStorage.removeItem(LS_KEY); } catch { /* sin storage */ }
}

/** Recupera el borrador recordado; si ya no es borrador (se envió o se cerró) lo olvida y devuelve null. */
export async function cargarEnCurso() {
  const r = leerEnCurso();
  if (!r) return null;
  try {
    const m = await obtenerPropuesta(r.id);
    if (m.estado !== 'borrador') { recordarEnCurso(null); return null; }
    return m;
  } catch { recordarEnCurso(null); return null; }
}

/**
 * Guarda las líneas en el borrador (lo crea si no existe). Devuelve el modelo tal como quedó en la base.
 *   guardarLineas({ modelo, clienteKey, lineas, perfil }) · con lineas vacías borra el borrador en curso de la memoria local
 */
export async function guardarLineas({ modelo, clienteKey, lineas, perfil }) {
  const ck = clienteKey || modelo?.clienteKey || 'digitalife';
  const base = modelo || {
    id: nuevaPropuestaId(), clienteKey: ck, clienteLabel: labelCliente(ck), nombre: 'Cierre', estado: 'borrador',
    anio: MES_ACTUAL.anio, mes: MES_ACTUAL.mes, vigencia: vigenciaPorDefecto(), origen: 'calculadora celular',
    creadoPor: perfil?.user_id || null,
  };
  const guardado = await guardarPropuesta({
    ...base, clienteKey: ck, clienteLabel: labelCliente(ck), tstamp: Date.now(), lineas,
    resumen: { mes: `${base.anio || MES_ACTUAL.anio}-${String(base.mes || MES_ACTUAL.mes).padStart(2, '0')}` },
  });
  recordarEnCurso(guardado.id, ck);
  return guardado;
}

export async function marcarEnviada(modelo, extra = {}) {
  const m = await _marcarEnviada(modelo, { enviada_at: new Date().toISOString(), ...extra });
  if (leerEnCurso()?.id === modelo.id) recordarEnCurso(null);
  return m;
}
export const anotarExcel = (id, filename) => actualizarPropuesta(id, { exported_filename: filename });

/** Líneas persistidas → filas para el Excel del armador (propuestaExcelBlob) y el texto de WhatsApp. */
export const filasExcel = (lineas = []) => lineas.map((l) => ({ sku: l.sku, piezas: N(l.piezas), precio: N(l.precio), descripcion: l.descripcion || '', marca: l.marca || '', familia: l.familia || '', listaSel: l.custom ? '__custom' : (l.lista || '') }));
