// NovedadesCard — productos nuevos del roadmap (lanzamientos próximos
// y futuros) con info de tránsito asociado.
//
// Muestra TODOS los SKUs cuyo rdmp = año actual o futuro (NVS, 2025, 2026,
// 2027...) — independiente de si ya están en tránsito o no. Esto permite
// preventer y volver a comprar para evitar rupturas de inventario.
//
// Por SKU: descripción + (piezas en tránsito · ETA · proveedor) o "pendiente
// de comprar" si no hay tránsito.

import React, { useMemo, useState } from 'react';
import { Sparkles, Search } from 'lucide-react';
import { roadmapStyle } from '../../../lib/roadmapColors';

const FMT_N = (n) => Math.round(n || 0).toLocaleString('es-MX');
const MES_NOMBRE = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function formatEta(d) {
  if (!d) return '—';
  return `${d.getDate()} ${MES_NOMBRE[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

export default function NovedadesCard({ roadmap, embarques, metaBySku }) {
  const [busqueda, setBusqueda] = useState('');

  // SKUs nuevos del roadmap (lanzamientos): cualquier rdmp que sea un año
  // ≥ actual, más los códigos de "lanzamiento" en español (proxim/camino).
  // Excluye RMI/RML (resurtidos) que NO son novedad.
  const skusNuevos = useMemo(() => {
    const anioActual = new Date().getFullYear();
    return (roadmap || [])
      .filter((r) => {
        const code = String(r.rdmp || '').trim();
        if (!code) return false;
        const m = code.match(/^(\d{4})$/);
        if (m && Number(m[1]) >= anioActual - 1) return true; // 2025, 2026, ...
        const lower = code.toLowerCase();
        if (lower === 'nvs') return true; // último bloque de lanzamiento
        return lower.includes('proxim') || lower.includes('camino');
      })
      .map((r) => ({ sku: r.sku, rdmp: r.rdmp, descripcion: r.descripcion || '' }));
  }, [roadmap]);

  // Tránsito agregado por SKU (todos los embarques activos, sin filtro de fecha)
  const transitoPorSku = useMemo(() => {
    const map = new Map();
    (embarques || []).forEach((e) => {
      const est = String(e.estatus || '').toLowerCase();
      if (est.includes('cancel') || est.includes('concluido') || est.includes('rechazada') || est.includes('perdida')) return;
      const sku = (e.codigo || '').trim();
      if (!sku) return;
      const piezas = Number(e.po_qty || 0);
      const etaStr = e.arribo_cedis || e.arribo_almacen || e.eta_puerto || e.eta;
      const eta = etaStr ? new Date(etaStr) : null;
      const yr = eta?.getFullYear();
      const etaValida = eta && !isNaN(eta) && yr >= 2020 && yr <= 2030 ? eta : null;

      if (!map.has(sku)) {
        map.set(sku, {
          totalPiezas: 0,
          arribos: [],
        });
      }
      const m = map.get(sku);
      m.totalPiezas += piezas;
      m.arribos.push({
        po: e.po,
        piezas,
        eta: etaValida,
        supplier: e.supplier,
        estatus: e.estatus,
      });
    });
    // Ordenar arribos por ETA ascendente
    map.forEach((v) => v.arribos.sort((a, b) => {
      if (!a.eta && !b.eta) return 0;
      if (!a.eta) return 1;
      if (!b.eta) return -1;
      return a.eta - b.eta;
    }));
    return map;
  }, [embarques]);

  // Combinar y filtrar por búsqueda
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return skusNuevos
      .filter((r) => {
        if (!q) return true;
        return (r.sku.toLowerCase().includes(q) ||
          r.descripcion.toLowerCase().includes(q) ||
          (r.rdmp || '').toLowerCase().includes(q));
      })
      .map((r) => ({
        ...r,
        transito: transitoPorSku.get(r.sku) || { totalPiezas: 0, arribos: [] },
      }))
      // Ordenar: primero los que TIENEN tránsito (con info para planear),
      // luego los pendientes de compra (oportunidad de prevender).
      .sort((a, b) => {
        if ((a.transito.totalPiezas > 0) !== (b.transito.totalPiezas > 0)) {
          return a.transito.totalPiezas > 0 ? -1 : 1;
        }
        return (a.rdmp || '').localeCompare(b.rdmp || '');
      });
  }, [skusNuevos, transitoPorSku, busqueda]);

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <h3 className="font-semibold text-gray-800 text-sm">Lo nuevo que viene</h3>
        <span className="text-[10px] text-gray-400 ml-auto">
          {filtrados.length} SKU{filtrados.length !== 1 ? 's' : ''}
          {filtrados.length !== skusNuevos.length && ` de ${skusNuevos.length}`}
        </span>
      </div>

      {/* Búsqueda */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/40">
        <div className="relative">
          <Search className="absolute left-2 top-2 w-3 h-3 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar SKU, descripción o roadmap..."
            className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded bg-white"
          />
        </div>
      </div>

      <div className="overflow-y-auto max-h-[60vh]">
        {filtrados.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-gray-400 italic">
            Sin productos nuevos en roadmap
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtrados.map((r) => (
              <SkuNovedadRow key={r.sku} item={r} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SkuNovedadRow({ item }) {
  const s = roadmapStyle(item.rdmp);
  const tieneTransito = item.transito.totalPiezas > 0;
  const proxArribo = item.transito.arribos.find((a) => a.eta && a.eta >= new Date());
  return (
    <li className="px-4 py-2.5 hover:bg-gray-50/60 transition">
      <div className="flex items-baseline gap-2">
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0"
          style={{ backgroundColor: s.bg, color: s.color }}
        >
          {item.rdmp}
        </span>
        <span className="font-mono font-semibold text-gray-800 text-xs shrink-0">{item.sku}</span>
        <span className="flex-1 text-xs text-gray-700 truncate" title={item.descripcion}>
          {item.descripcion || <span className="italic text-gray-400">sin descripción</span>}
        </span>
        {tieneTransito ? (
          <span className="text-[10px] font-bold text-blue-700 tabular-nums shrink-0">
            {FMT_N(item.transito.totalPiezas)} pzs
          </span>
        ) : (
          <span className="text-[10px] text-amber-600 italic shrink-0">
            pendiente de comprar
          </span>
        )}
      </div>
      {/* Detalle de arribos */}
      {tieneTransito && (
        <div className="ml-6 mt-1 flex flex-wrap gap-1.5 text-[10px]">
          {item.transito.arribos.slice(0, 4).map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
              <span className="font-mono">PO-{a.po}</span>
              <span className="tabular-nums">{FMT_N(a.piezas)}</span>
              <span className="text-blue-500">→ {formatEta(a.eta)}</span>
            </span>
          ))}
          {item.transito.arribos.length > 4 && (
            <span className="text-gray-400">+{item.transito.arribos.length - 4} más</span>
          )}
          {proxArribo && (
            <span className="text-emerald-700 font-semibold ml-auto">
              próximo: {formatEta(proxArribo.eta)}
            </span>
          )}
        </div>
      )}
    </li>
  );
}
