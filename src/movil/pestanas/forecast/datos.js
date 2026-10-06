// Proyectos y forecast del celular · datos. 2026-10-05.
//   useForecastCliente(key, ventana) → estadoCliente() con las MISMAS fuentes que la vista Forecast de la web
//     (forecastDatos: ventas, stock, proyectos, copia del CRM; reservas/datos: forecast_crm y lotes) y el sugerido
//     de forecastCalc.js#sugerir. Lo capturado en el celular se guarda en forecast_crm como `borrador` (misma tabla
//     y misma llave que el armador web), así aparece en la laptop.
//   guardarBorrador · quitarBorrador · exportarLote (Excel exacto del CRM + copia en forecast_crm/forecast_crm_lotes,
//     compartido con navigator.share) · marcarCargado («Ya lo cargué en el CRM»).
import { useMemo } from 'react';
import { useRoadmap } from '../../../lib/queries';
import { compartirArchivo } from '../../../lib/compartirArchivo';
import { queryClient } from '../../../lib/queryClient';
import { clienteForecast, useVentasForecast, useStockForecast, useProyectosForecast, useForecastExistente, PROPIOS } from '../../../modules/comercial/proyectos/forecastDatos';
import { sugerir, filasPlantilla } from '../../../modules/comercial/proyectos/forecastCalc';
import { useForecastCrm, useLotesCrm, crearLoteDB, upsertCrmDB, borrarCrmDB, marcarLoteCargadoDB, invalidarCrm, invalidarLotes } from '../../../modules/comercial/reservas/datos';
import { construirLibro, nombreArchivoPlantilla } from '../../../modules/comercial/reservas/plantillaCRM';
import { CLIENTES } from '../../../modules/comercial/proyectos/calculo';
import { estadoCliente } from './calculo';

const N = (v) => Number(v) || 0;
export const PROPIOS_LISTA = CLIENTES.map((c) => ({ key: c.key, label: c.label, color: c.color, ...PROPIOS[c.key] }));
export const labelDe = (key) => CLIENTES.find((c) => c.key === key)?.label || key;

export function useForecastCliente(key, ventana, { enabled = true, hoy = new Date() } = {}) {
  const cliente = useMemo(() => clienteForecast(key), [key]);
  const on = enabled && !!cliente?.key;
  const { data: ventas, isLoading: l1 } = useVentasForecast(on ? cliente : null);
  const { data: stock } = useStockForecast(on ? cliente : null);
  const { data: proyectos = [] } = useProyectosForecast(on ? cliente : null);
  const { data: existente, isLoading: l2 } = useForecastExistente(on ? cliente.codigo : null);
  const { data: crm = [], isLoading: l3 } = useForecastCrm(on ? cliente.key : null);
  const { data: lotes = [] } = useLotesCrm();
  const { data: roadmap = [] } = useRoadmap();
  const rd = useMemo(() => new Map((roadmap || []).map((r) => [r.sku, r])), [roadmap]);
  const sugerido = useMemo(() => {
    if (!ventas) return [];
    const excluir = new Set(existente?.skus || []);
    for (const r of crm) if (N(r.piezas) > 0) excluir.add(r.sku);
    return sugerir({ ventanaMeses: ventana, series: ventas.series, stock: stock || new Map(), proyectos, excluir, roadmap: rd, fuente: ventas.fuente, hoy }).filas;
  }, [ventas, stock, proyectos, existente, crm, rd, ventana, hoy]);
  const estado = useMemo(() => estadoCliente({ key, label: labelDe(key), ventana, existente: existente?.filas || [], crm, sugerido, proyectos, lotes, roadmap: rd, hoy }), [key, ventana, existente, crm, sugerido, proyectos, lotes, rd, hoy]);
  return { cliente, estado, sugerido, crm, lotes, roadmap, fuente: ventas?.fuente || null, loading: l1 || l2 || l3 };
}

/** Guarda (o reemplaza) el forecast de un SKU para un cliente en forecast_crm como borrador. meses: { 'YYYY-MM': pz }. */
export async function guardarBorrador({ cliente, sku, meses, justificacion, yoId, ventana }) {
  const c = clienteForecast(cliente);
  const rows = [];
  const borrar = [];
  for (const m of ventana) {
    const v = N(meses[m.key]);
    if (v > 0) rows.push({ cliente_key: c.key, cliente_codigo: c.codigo, cliente_nombre: c.nombre, tipo: c.tipo, sku, anio: m.anio, mes: m.mes, piezas: Math.round(v), justificacion: justificacion || null, estado: 'borrador', lote_id: null, creado_por: yoId });
    else borrar.push(m);
  }
  await upsertCrmDB(rows);
  // Meses que quedaron en 0 y antes tenían borrador: se quitan (sólo borradores; lo exportado no se toca).
  if (borrar.length) {
    const previas = queryClient.getQueryData(['forecast_crm', c.key]) || [];
    const ids = previas.filter((r) => r.sku === sku && r.estado === 'borrador' && borrar.some((m) => m.anio === r.anio && m.mes === r.mes)).map((r) => r.id);
    if (ids.length) await borrarCrmDB(ids);
  }
  invalidarCrm(c.key);
  return rows.length;
}

export async function quitarBorrador({ cliente, sku }) {
  const c = clienteForecast(cliente);
  const previas = queryClient.getQueryData(['forecast_crm', c.key]) || [];
  const ids = previas.filter((r) => r.sku === sku && r.estado === 'borrador').map((r) => r.id);
  if (ids.length) await borrarCrmDB(ids);
  invalidarCrm(c.key);
  return ids.length;
}

/**
 * Exporta los borradores de un cliente como la plantilla exacta del CRM: crea el lote, marca las filas como exportadas
 * y comparte el archivo (navigator.share o descarga). Devuelve { n, nombre, resultado }.
 */
export async function exportarLote({ cliente, filas, ventana, yoId }) {
  const c = clienteForecast(cliente);
  const pl = filasPlantilla(filas.map((f) => ({ sku: f.sku, meses: f.meses, justificacion: f.justificacion })), { tipo: c.tipo, clienteCodigo: c.codigo });
  if (!pl.length) throw new Error('No hay borradores con piezas en la ventana.');
  const mod = await import('xlsx-js-style');
  const XLSX = mod.default || mod;
  const mesInicio = ventana[0].key;
  const wb = construirLibro(XLSX, { mesInicio, meses: ventana.length, filas: pl });
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const nombre = nombreArchivoPlantilla(mesInicio);
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const lote = await crearLoteDB({ mesInicio, meses: ventana.length, clientes: [c.key], filas: pl.length, archivoNombre: nombre, yoId });
  const rows = [];
  for (const f of pl) for (const m of ventana) { const v = N(f.meses[m.key]); if (v > 0) rows.push({ cliente_key: c.key, cliente_codigo: c.codigo, cliente_nombre: c.nombre, tipo: c.tipo, sku: f.sku, anio: m.anio, mes: m.mes, piezas: v, justificacion: f.justificacion, estado: 'exportado', lote_id: lote.id, creado_por: yoId }); }
  await upsertCrmDB(rows);
  invalidarCrm(c.key); invalidarLotes();
  const resultado = await compartirArchivo(blob, nombre, { titulo: nombre, texto: `Forecast ${labelDe(c.key)} · ${pl.length} SKUs · súbelo en el CRM con «Cargar Excel»` });
  return { n: pl.length, nombre, resultado, loteId: lote.id };
}

export async function marcarCargado(loteId) {
  const n = await marcarLoteCargadoDB(loteId);
  invalidarLotes();
  queryClient.invalidateQueries({ queryKey: ['forecast', 'existente'] });
  return n;
}
