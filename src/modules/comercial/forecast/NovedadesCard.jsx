// NovedadesCard — productos nuevos del roadmap (lanzamientos), agrupados
// por mes de arribo.
//
// Lista los SKUs cuyo rdmp = año actual o futuro (NVS, 2025, 2026, 2027...).
// Cada SKU se ubica en el mes de su PRÓXIMO arribo (más cercano en tiempo);
// los que no tienen compra colocada van en una sección aparte "Sin compra
// colocada" para que Fernando pueda preventer.

import React, { useMemo, useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { roadmapStyle } from '../../../lib/roadmapColors';

const FMT_N = (n) => Math.round(n || 0).toLocaleString('es-MX');
const MES_NOMBRE = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

function fmtFechaCorta(d) {
  if (!d) return '—';
  return `${d.getDate()} ${MES_NOMBRE[d.getMonth()].toLowerCase()}`;
}

export default function NovedadesCard({ roadmap, embarques }) {
  const [mesAbierto, setMesAbierto] = useState(null);
  const [pendientesAbierto, setPendientesAbierto] = useState(false);

  // SKUs nuevos del roadmap (lanzamientos)
  const skusNuevos = useMemo(() => {
    const anioActual = new Date().getFullYear();
    return (roadmap || [])
      .filter((r) => {
        const code = String(r.rdmp || '').trim();
        if (!code) return false;
        const m = code.match(/^(\d{4})$/);
        if (m && Number(m[1]) >= anioActual - 1) return true;
        const lower = code.toLowerCase();
        if (lower === 'nvs') return true;
        return lower.includes('proxim') || lower.includes('camino');
      })
      .map((r) => ({ sku: r.sku, rdmp: r.rdmp, descripcion: r.descripcion || '' }));
  }, [roadmap]);

  // Tránsito por SKU (con todos los arribos)
  const transitoPorSku = useMemo(() => {
    const map = new Map();
    (embarques || []).forEach((e) => {
      const est = String(e.estatus || '').toLowerCase();
      if (est.includes('cancel') || est.includes('concluido') || est.includes('rechazada') || est.includes('perdida')) return;
      const sku = (e.codigo || '').trim();
      if (!sku) return;
      const piezas = Number(e.po_qty || 0);
      const etaStr = e.arribo_cedis || e.arribo_almacen || e.eta_puerto || e.eta;
      if (!etaStr) return;
      const eta = new Date(etaStr);
      const yr = eta.getFullYear();
      if (isNaN(eta) || yr < 2020 || yr > 2030) return;
      if (!map.has(sku)) map.set(sku, []);
      map.get(sku).push({
        po: e.po,
        piezas,
        eta,
        supplier: e.supplier,
        estatus: e.estatus,
      });
    });
    map.forEach((arr) => arr.sort((a, b) => a.eta - b.eta));
    return map;
  }, [embarques]);

  // Agrupar SKUs nuevos por mes de su primer arribo. Los SKUs sin
  // tránsito quedan en una lista aparte (pendientes de compra).
  const { porMes, pendientes } = useMemo(() => {
    const meses = new Map(); // 'YYYY-MM' → { anio, mes, items[] }
    const sinCompra = [];

    skusNuevos.forEach((r) => {
      const arribos = transitoPorSku.get(r.sku) || [];
      if (arribos.length === 0) {
        sinCompra.push({ ...r, arribos: [] });
        return;
      }
      // Mes del PRIMER arribo (lo más cercano)
      const primero = arribos[0];
      const k = `${primero.eta.getFullYear()}-${String(primero.eta.getMonth() + 1).padStart(2, '0')}`;
      if (!meses.has(k)) {
        meses.set(k, {
          key: k,
          anio: primero.eta.getFullYear(),
          mes: primero.eta.getMonth() + 1,
          items: [],
        });
      }
      meses.get(k).items.push({ ...r, arribos });
    });

    const lista = Array.from(meses.values()).sort((a, b) => a.key.localeCompare(b.key));
    sinCompra.sort((a, b) => (a.rdmp || '').localeCompare(b.rdmp || ''));
    return { porMes: lista, pendientes: sinCompra };
  }, [skusNuevos, transitoPorSku]);

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <h3 className="font-semibold text-gray-800 text-sm">Lo nuevo que viene</h3>
        <span className="text-[10px] text-gray-400 ml-auto">
          {skusNuevos.length} SKU{skusNuevos.length !== 1 ? 's' : ''} nuevos
        </span>
      </div>

      <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
        {porMes.length === 0 && pendientes.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-gray-400 italic">
            Sin productos nuevos en roadmap
          </div>
        )}

        {/* Pendientes de comprar — primero, porque son la oportunidad
            de preventer / colocar una compra */}
        {pendientes.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setPendientesAbierto(!pendientesAbierto)}
              className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-amber-50/40 transition text-left"
            >
              {pendientesAbierto
                ? <ChevronUp className="w-4 h-4 text-amber-500" />
                : <ChevronDown className="w-4 h-4 text-amber-500" />}
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              <span className="font-semibold text-amber-700 text-sm flex-1">
                Pendientes de comprar
              </span>
              <span className="text-xs text-amber-600 font-bold tabular-nums">
                {pendientes.length} SKU{pendientes.length !== 1 ? 's' : ''}
              </span>
            </button>
            {pendientesAbierto && <SkusList items={pendientes} pendiente />}
          </div>
        )}

        {/* Por mes de primer arribo */}
        {porMes.map((mes) => {
          const titulo = `${MES_NOMBRE[mes.mes - 1]} ${mes.anio}`;
          const totalPzs = mes.items.reduce((a, it) =>
            a + it.arribos.reduce((s, ar) => s + ar.piezas, 0), 0);
          const expandido = mesAbierto === mes.key;
          return (
            <div key={mes.key}>
              <button
                type="button"
                onClick={() => setMesAbierto(expandido ? null : mes.key)}
                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-blue-50/40 transition text-left"
              >
                {expandido
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />}
                <span className="font-semibold text-gray-700 text-sm w-24">{titulo}</span>
                <span className="text-xs text-gray-500 flex-1">
                  {mes.items.length} SKU{mes.items.length !== 1 ? 's' : ''}
                </span>
                <span className="font-bold text-blue-700 tabular-nums text-sm">
                  {FMT_N(totalPzs)} pzs
                </span>
              </button>
              {expandido && <SkusList items={mes.items} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SkusList({ items, pendiente = false }) {
  return (
    <ul className="bg-gray-50/40 divide-y divide-gray-100">
      {items.map((r) => {
        const s = roadmapStyle(r.rdmp);
        const totalPzs = r.arribos.reduce((a, ar) => a + ar.piezas, 0);
        const proximo = r.arribos[0];
        return (
          <li key={r.sku} className="px-4 py-2">
            <div className="flex items-baseline gap-2">
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0"
                style={{ backgroundColor: s.bg, color: s.color }}
              >
                {r.rdmp}
              </span>
              <span className="font-mono font-semibold text-gray-800 text-xs shrink-0">{r.sku}</span>
              <span className="flex-1 text-xs text-gray-700 truncate" title={r.descripcion}>
                {r.descripcion || <span className="italic text-gray-400">sin descripción</span>}
              </span>
              {pendiente ? (
                <span className="text-[10px] text-amber-600 italic shrink-0">
                  sin compra colocada
                </span>
              ) : (
                <span className="text-[10px] font-bold text-blue-700 tabular-nums shrink-0">
                  {FMT_N(totalPzs)} pzs · {fmtFechaCorta(proximo.eta)}
                </span>
              )}
            </div>
            {!pendiente && r.arribos.length > 1 && (
              <div className="ml-6 mt-1 flex flex-wrap gap-1.5 text-[10px]">
                {r.arribos.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-700">
                    <span className="font-mono text-gray-500">PO-{a.po}</span>
                    <span className="tabular-nums">{FMT_N(a.piezas)}</span>
                    <span className="text-blue-600">→ {fmtFechaCorta(a.eta)}</span>
                  </span>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
