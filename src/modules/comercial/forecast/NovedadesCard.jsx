// NovedadesCard — qué es nuevo / qué se está moviendo
//
// Sección con dos columnas:
//   1. Roadmap próximamente: SKUs cuyo estado roadmap = "próximamente" o
//      "en camino" (productos por lanzar)
//   2. Llegando pronto: tránsito con ETA en los próximos 30 días
//
// Sirve como "lo nuevo que viene" — visión rápida de lo que está al venir.

import React, { useMemo } from 'react';
import { Sparkles, Truck } from 'lucide-react';

const MES_NOMBRE = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const FMT_N = (n) => Math.round(n || 0).toLocaleString('es-MX');

function formatEta(d) {
  if (!d) return '—';
  return `${d.getDate()} ${MES_NOMBRE[d.getMonth()]}`;
}

export default function NovedadesCard({ roadmap, embarques, metaBySku }) {
  const proximamente = useMemo(() => {
    return (roadmap || [])
      .filter((r) => {
        const e = String(r.estado || r.estatus || '').toLowerCase();
        return e.includes('proxim') || e.includes('camino');
      })
      .map((r) => {
        const meta = metaBySku ? metaBySku[r.sku] : null;
        return {
          sku: r.sku,
          descripcion: meta?.descripcion || r.descripcion || '',
          familia: meta?.familia || r.familia || '',
          marca: meta?.marca || r.marca || '',
          fechaLanzamiento: r.fecha_lanzamiento || r.fecha_estimada || null,
        };
      })
      .sort((a, b) => {
        if (a.fechaLanzamiento && b.fechaLanzamiento) {
          return a.fechaLanzamiento.localeCompare(b.fechaLanzamiento);
        }
        return 0;
      })
      .slice(0, 8);
  }, [roadmap, metaBySku]);

  const llegandoPronto = useMemo(() => {
    const hoy = new Date();
    const limite30 = new Date(hoy); limite30.setDate(limite30.getDate() + 30);
    const items = [];
    (embarques || []).forEach((e) => {
      const est = String(e.estatus || '').toLowerCase();
      if (est.includes('cancel') || e.arribo_cedis) return;
      const etaStr = e.arribo_almacen || e.eta_puerto || e.eta;
      if (!etaStr) return;
      const eta = new Date(etaStr);
      if (isNaN(eta) || eta < hoy || eta > limite30) return;
      const sku = (e.codigo || '').trim();
      const meta = metaBySku ? metaBySku[sku] : null;
      items.push({
        po: e.po,
        sku,
        eta,
        piezas: Number(e.po_qty || 0),
        marca: meta?.marca || null,
        familia: e.familia || meta?.familia || null,
        supplier: e.supplier,
      });
    });
    items.sort((a, b) => a.eta - b.eta);
    return items.slice(0, 10);
  }, [embarques, metaBySku]);

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          Lo nuevo que viene
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
        {/* Próximos lanzamientos */}
        <div className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Próximos lanzamientos
          </div>
          {proximamente.length === 0 ? (
            <div className="text-xs text-gray-400 italic">Sin SKUs en roadmap próximamente</div>
          ) : (
            <ul className="space-y-1.5">
              {proximamente.map((r) => (
                <li key={r.sku} className="text-xs flex items-baseline gap-2">
                  <span className="font-mono font-semibold text-gray-800 shrink-0">{r.sku}</span>
                  <span className="text-gray-600 truncate flex-1" title={r.descripcion}>
                    {r.descripcion || '—'}
                  </span>
                  {r.fechaLanzamiento && (
                    <span className="text-[10px] text-gray-500 shrink-0">
                      {r.fechaLanzamiento.slice(0, 10)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Llegando próximos 30 días */}
        <div className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-2 flex items-center gap-1">
            <Truck className="w-3 h-3" /> Llegando próximos 30 días
          </div>
          {llegandoPronto.length === 0 ? (
            <div className="text-xs text-gray-400 italic">Nada llega en los próximos 30 días</div>
          ) : (
            <ul className="space-y-1.5">
              {llegandoPronto.map((p, i) => (
                <li key={`${p.po}-${p.sku}-${i}`} className="text-xs flex items-baseline gap-2">
                  <span className="text-blue-700 font-semibold tabular-nums shrink-0 w-10 text-right">
                    {formatEta(p.eta)}
                  </span>
                  <span className="font-mono text-gray-800 shrink-0">{p.sku}</span>
                  <span className="tabular-nums text-gray-700 shrink-0 w-16 text-right">
                    {FMT_N(p.piezas)} pz
                  </span>
                  <span className="text-gray-500 truncate flex-1 text-right" title={p.supplier}>
                    {p.supplier || ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
