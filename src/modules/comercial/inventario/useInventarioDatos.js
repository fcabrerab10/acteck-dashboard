// Carga de datos de Inventario global · una sola fuente para la pantalla.
// 1) inventario_acteck (bloquea el render) · 2) enriquecimientos en paralelo,
// sin bloquear: descripciones (roadmap_sku), tránsito (v_transito_sku),
// lead time (v_lead_time_sku), demanda ERP (facturacion_clientes, 3 meses
// cerrados) e histórico diario (v_inventario_historico_dia). Todo pasa por lib/queries.js salvo roadmap_sku (la app la
// escribe → sin cache).
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { N } from './constantes';

const chunkBy = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, (i + 1) * n));

// 3 meses cerrados anteriores al actual (regla de la casa: "un día sin cargar no afecta")
export function mesesCerrados(hoy = new Date()) {
  return [1, 2, 3].map((i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    return { anio: d.getFullYear(), mes: d.getMonth() + 1, key: `${d.getFullYear()}-${d.getMonth() + 1}` };
  });
}

export default function useInventarioDatos() {
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [descripciones, setDescripciones] = useState(() => new Map());
  const [transito, setTransito] = useState(() => new Map());
  const [leadTime, setLeadTime] = useState(() => new Map());
  const [demanda, setDemanda] = useState(() => new Map());
  const [historico, setHistorico] = useState([]);
  const [enriqueciendo, setEnriqueciendo] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { fetchAll, fetchAllQ } = await import('../../../lib/queries');
      let acc = [];
      try {
        acc = await fetchAllQ(
          () => supabase.from('inventario_acteck').select('articulo, no_almacen, cedis, disponible, inventario, costopromedio, costodisponible, costoinventario'),
          { pageSize: 5000, orderCol: 'articulo', label: 'inventario_acteck' },
        );
      } catch (e) {
        console.error('[InventarioGlobal] inventario_acteck', e);
        acc = [];
      }
      if (cancel) return;
      setFilas(acc);
      setLoading(false);

      const skus = Array.from(new Set(acc.map((r) => r.articulo).filter(Boolean)));
      const meses = mesesCerrados();
      const setMeses = new Set(meses.map((m) => m.key));

      // Descripciones · roadmap_sku (escrita por la app → directo, sin cache)
      const pDesc = (async () => {
        const mapDesc = new Map();
        if (skus.length === 0) return mapDesc;
        for (const chunk of chunkBy(skus, 200)) {
          const { data } = await supabase.from('roadmap_sku').select('sku, descripcion, marca, familia, rdmp, categoria').in('sku', chunk);
          (data || []).forEach((r) => {
            if (!mapDesc.has(r.sku)) mapDesc.set(r.sku, {
              descripcion: r.descripcion || '', marca: r.marca || '', familia: r.familia || '',
              rdmp: r.rdmp || '', categoria: r.categoria || '',
            });
          });
        }
        return mapDesc;
      })().catch(() => new Map());

      // Tránsito · v_transito_sku (1 fila por sku; embarques_detalle = POs pendientes)
      const pTransito = fetchAll('v_transito_sku', 'sku,supplier,cantidad,eta_mas_cercana,eta_mas_lejana,embarques,embarques_detalle')
        .then((rows) => {
          const m = new Map();
          (rows || []).forEach((r) => {
            if (!r.sku) return;
            const prev = m.get(r.sku) || { cantidad: 0, pos: [], eta: null, supplier: r.supplier || '' };
            prev.cantidad += N(r.cantidad);
            const det = Array.isArray(r.embarques_detalle) ? r.embarques_detalle : [];
            det.forEach((d) => prev.pos.push({ po: d.po, estatus: d.estatus, cantidad: N(d.cantidad), eta: d.eta || null, etd: d.etd || null, cedis: d.cedis || '', contenedor: d.contenedor || '' }));
            if (r.eta_mas_cercana && (!prev.eta || r.eta_mas_cercana < prev.eta)) prev.eta = r.eta_mas_cercana;
            m.set(r.sku, prev);
          });
          m.forEach((v) => v.pos.sort((a, b) => String(a.eta || '9999').localeCompare(String(b.eta || '9999'))));
          return m;
        })
        .catch((e) => { console.warn('[InventarioGlobal] v_transito_sku', e); return new Map(); });

      // Lead time · v_lead_time_sku
      const pLead = fetchAll('v_lead_time_sku', 'sku,dias_promedio,dias_min,dias_max,muestras')
        .then((rows) => new Map((rows || []).filter((r) => r.sku).map((r) => [r.sku, { dias: N(r.dias_promedio), min: N(r.dias_min), max: N(r.dias_max), muestras: N(r.muestras) }])))
        .catch((e) => { console.warn('[InventarioGlobal] v_lead_time_sku', e); return new Map(); });

      // Demanda ERP · facturacion_clientes (todos los clientes), 3 meses cerrados → pz/mes
      // Una query por año involucrado (sólo los meses cerrados) para no bajar el año completo.
      const porAnio = new Map();
      meses.forEach((mm) => porAnio.set(mm.anio, [...(porAnio.get(mm.anio) || []), mm.mes]));
      const pDemanda = Promise.all(Array.from(porAnio.entries()).map(([a, ms]) => fetchAllQ(
        () => supabase.from('facturacion_clientes').select('id, sku, anio, mes, piezas').eq('anio', a).in('mes', ms),
        { pageSize: 5000, orderCol: 'id', label: `facturacion_clientes·inv·${a}` },
      )))
        .then((partes) => {
          const m = new Map();
          partes.flat().forEach((r) => {
            if (!r.sku || !setMeses.has(`${r.anio}-${Number(r.mes)}`)) return;
            m.set(r.sku, (m.get(r.sku) || 0) + N(r.piezas));
          });
          // promedio mensual
          m.forEach((v, k) => m.set(k, v / meses.length));
          return m;
        })
        .catch((e) => { console.warn('[InventarioGlobal] facturacion_clientes', e); return new Map(); });

      // Histórico diario · v_inventario_historico_dia (1 fila por día, sólo comerciales)
      const pHist = fetchAll('v_inventario_historico_dia', 'fecha,piezas,disponible,valor,skus_con_stock')
        .then((rows) => (rows || []).filter((r) => r.fecha).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))))
        .catch((e) => { console.warn('[InventarioGlobal] v_inventario_historico_dia', e); return []; });

      const [mDesc, mTr, mLt, mDem, hist] = await Promise.all([pDesc, pTransito, pLead, pDemanda, pHist]);
      if (cancel) return;
      setDescripciones(mDesc);
      setTransito(mTr);
      setLeadTime(mLt);
      setDemanda(mDem);
      setHistorico(hist);
      setEnriqueciendo(false);
    })();
    return () => { cancel = true; };
  }, []);

  return { filas, loading, enriqueciendo, descripciones, transito, leadTime, demanda, historico, mesesRef: mesesCerrados() };
}
