// efectividad.js — qué tanto se convirtió una propuesta enviada en facturación real, y cierre automático.
//
// REGLA DE VENTANA (aprobada 2026-09-11):
//   Una propuesta enviada el día D del mes M se cruza con `facturacion_clientes` del cliente en el mes M+1.
//   Si se envió antes del día 15, también cuenta el mismo mes M (el cliente alcanza a facturar dentro del mes).
//   → ventana = [M+1]            si D ≥ 15
//   → ventana = [M, M+1]        si D < 15
//   La ventana está "completa" cuando ya pasó el último mes de la ventana (hoy > fin de M+1); antes es parcial.
//
// MEDIDAS (por SKU y en total, nada sensible: sin costo ni margen):
//   piezasProp / piezasFact · montoProp (piezas × precio propuesto) / montoFact (facturacion_clientes.monto)
//   pct de conversión = Σ min(montoFact, montoProp) / Σ montoProp   (cap por SKU al 100 %: sobre-facturar no compensa a otro SKU)
//   skusConvertidos = SKUs con piezasFact > 0
//
// CIERRE AUTOMÁTICO: enviada + skusConvertidos ≥ 1 en la ventana → estado 'cerrada' (cerrada_at = now()).
//   Se calcula en la app al cargar la landing y sólo se escribe si cambia.
import { supabase } from '../../../lib/supabase';
import { fetchAllQ } from '../../../lib/queries';
import { actualizarPropuesta, N } from './recientes';

export function ventanaEfectividad(enviadaAt) {
  if (!enviadaAt) return [];
  const d = new Date(enviadaAt);
  if (Number.isNaN(d.getTime())) return [];
  const m1 = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const out = [];
  if (d.getDate() < 15) out.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 });
  out.push({ anio: m1.getFullYear(), mes: m1.getMonth() + 1 });
  return out;
}
export const claveMes = (anio, mes) => `${anio}-${String(mes).padStart(2, '0')}`;

/** Trae facturación de los (cliente, mes) que necesitan las propuestas enviadas/cerradas. Map `cliente|YYYY-MM|sku` → { piezas, monto }. */
export async function cargarFacturacionVentanas(propuestas) {
  const porCliente = new Map();
  for (const p of propuestas) {
    if (!['enviada', 'cerrada'].includes(p.estado) || !p.enviadaAt) continue;
    const set = porCliente.get(p.clienteKey) || new Set();
    ventanaEfectividad(p.enviadaAt).forEach((m) => set.add(claveMes(m.anio, m.mes)));
    porCliente.set(p.clienteKey, set);
  }
  const map = new Map();
  await Promise.all([...porCliente.entries()].map(async ([cliente, meses]) => {
    if (!meses.size) return;
    const or = [...meses].map((k) => { const [a, m] = k.split('-').map(Number); return `and(anio.eq.${a},mes.eq.${m})`; }).join(',');
    const rows = await fetchAllQ(() => supabase.from('facturacion_clientes').select('sku,anio,mes,piezas,monto').eq('cliente_key', cliente).or(or), { label: 'propuestas-efectividad' });
    for (const r of rows || []) {
      const k = `${cliente}|${claveMes(r.anio, r.mes)}|${r.sku}`;
      const acc = map.get(k) || { piezas: 0, monto: 0 };
      acc.piezas += N(r.piezas); acc.monto += N(r.monto);
      map.set(k, acc);
    }
  }));
  return map;
}

export function calcularEfectividad(p, factMap) {
  if (!['enviada', 'cerrada'].includes(p.estado) || !p.enviadaAt) return null;
  const ventana = ventanaEfectividad(p.enviadaAt);
  if (!ventana.length) return null;
  const hoy = new Date();
  const ult = ventana[ventana.length - 1];
  const finVentana = new Date(ult.anio, ult.mes, 0, 23, 59, 59);
  const completa = hoy > finVentana;
  const lineas = (p.lineas || []).map((l) => {
    let piezasFact = 0, montoFact = 0;
    for (const m of ventana) {
      const f = factMap.get(`${p.clienteKey}|${claveMes(m.anio, m.mes)}|${l.sku}`);
      if (f) { piezasFact += f.piezas; montoFact += f.monto; }
    }
    const piezasProp = N(l.piezas), montoProp = N(l.piezas) * N(l.precio);
    return { sku: l.sku, descripcion: l.descripcion || '', piezasProp, piezasFact, montoProp, montoFact, pct: montoProp > 0 ? Math.min(100, (montoFact / montoProp) * 100) : null };
  });
  const montoProp = lineas.reduce((s, l) => s + l.montoProp, 0);
  const montoConv = lineas.reduce((s, l) => s + Math.min(l.montoFact, l.montoProp), 0);
  return {
    ventana, completa, lineas,
    piezasProp: lineas.reduce((s, l) => s + l.piezasProp, 0),
    piezasFact: lineas.reduce((s, l) => s + l.piezasFact, 0),
    montoProp, montoFact: lineas.reduce((s, l) => s + l.montoFact, 0),
    pct: montoProp > 0 ? (montoConv / montoProp) * 100 : null,
    skusConvertidos: lineas.filter((l) => l.piezasFact > 0).length,
  };
}

/** Enviadas con ≥ 1 SKU facturado en la ventana → cerrada. Devuelve la lista con los modelos ya actualizados. */
export async function aplicarCierreAutomatico(propuestas, factMap) {
  const out = [...propuestas];
  await Promise.all(out.map(async (p, i) => {
    if (p.estado !== 'enviada') return;
    const ef = calcularEfectividad(p, factMap);
    if (!ef || ef.skusConvertidos < 1) return;
    try { out[i] = await actualizarPropuesta(p.id, { estado: 'cerrada', cerrada_at: new Date().toISOString() }); }
    catch (e) { console.warn('[Propuestas] cierre automático', p.id, e); }
  }));
  return out;
}

/** Memoria por SKU: última vez propuesto (enviadas/cerradas) a un cliente → Map sku → { fecha, precio, lista, nombre }. */
export function memoriaPorSku(propuestas, clienteKey) {
  const m = new Map();
  const enviadas = propuestas.filter((p) => p.clienteKey === clienteKey && ['enviada', 'cerrada'].includes(p.estado))
    .sort((a, b) => Date.parse(b.enviadaAt || 0) - Date.parse(a.enviadaAt || 0));
  for (const p of enviadas) {
    for (const l of p.lineas || []) {
      if (!l.sku || m.has(l.sku)) continue;
      m.set(l.sku, { fecha: p.enviadaAt, precio: N(l.precio), lista: l.custom ? 'Personalizado' : (l.lista || ''), piezas: N(l.piezas), nombre: p.nombre, id: p.id });
    }
  }
  return m;
}
