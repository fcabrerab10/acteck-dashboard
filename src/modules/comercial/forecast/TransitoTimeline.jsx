// TransitoTimeline — tarjeta con calendario mensual de tránsito.
//
// Muestra qué inventario llega cada mes (próximos 6 meses) en piezas + USD,
// con conteo de POs abiertas. Click en un mes lo expande mostrando el
// inventario agrupado por Familia → Marca.

import React, { useMemo, useState } from 'react';
import { Ship, ChevronDown, ChevronUp } from 'lucide-react';

const MES_NOMBRE = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

const FMT_N = (n) => Math.round(n || 0).toLocaleString('es-MX');
const FMT_USD = (n) => `$${Math.round(n || 0).toLocaleString('es-MX')}`;

export default function TransitoTimeline({ embarques, metaBySku }) {
  const [mesExpandido, setMesExpandido] = useState(null);

  const data = useMemo(() => {
    // Agrupar embarques por mes de ETA — solo no-cancelados con ETA en el futuro
    // o muy reciente (últimos 30 días) para reflejar lo que está por arribar.
    const hoy = new Date();
    const limiteAtras = new Date(hoy); limiteAtras.setDate(limiteAtras.getDate() - 14);
    const limiteAdelante = new Date(hoy); limiteAdelante.setMonth(limiteAdelante.getMonth() + 6);

    const meses = new Map(); // key = 'YYYY-MM'
    let totalPiezas = 0;
    let totalUsd = 0;
    let totalPOs = new Set();

    const ahora = new Date();
    (embarques || []).forEach((e) => {
      const est = String(e.estatus || '').toLowerCase();
      // Estatus que significan "ya no está en tránsito"
      if (est.includes('cancel') || est.includes('concluido') || est.includes('rechazada') || est.includes('perdida')) return;
      // ETA real: priorizamos arribo_cedis (fecha estimada de arribo a
      // CEDIS) > arribo_almacen > eta_puerto > eta. arribo_cedis NO es
      // "ya llegó" — es la fecha programada de arribo final.
      const etaStr = e.arribo_cedis || e.arribo_almacen || e.eta_puerto || e.eta;
      if (!etaStr) return;
      const eta = new Date(etaStr);
      if (isNaN(eta)) return;
      // Filtrar fechas absurdas (años fuera de 2020-2030 son bugs del importador)
      const yr = eta.getFullYear();
      if (yr < 2020 || yr > 2030) return;
      if (eta < limiteAtras || eta > limiteAdelante) return;

      const sku = (e.codigo || '').trim();
      const meta = metaBySku ? metaBySku[sku] : null;
      // unit_price viene de embarques_compras (precio que pagamos al proveedor)
      const costoUsd = Number(e.unit_price || meta?.unit_price_usd_ultima || 0);
      const piezas = Number(e.po_qty || 0);
      const valorUsd = piezas * costoUsd;

      const monthKey = `${eta.getFullYear()}-${String(eta.getMonth() + 1).padStart(2, '0')}`;
      if (!meses.has(monthKey)) {
        meses.set(monthKey, {
          key: monthKey,
          anio: eta.getFullYear(),
          mes: eta.getMonth() + 1,
          piezas: 0,
          usd: 0,
          pos: new Set(),
          embarques: [],
        });
      }
      const m = meses.get(monthKey);
      m.piezas += piezas;
      m.usd += valorUsd;
      if (e.po) m.pos.add(e.po);
      // Derivar marca desde metadata por SKU (la tabla embarques no la trae)
      const marca = meta?.marca || '(sin marca)';
      m.embarques.push({ ...e, valorUsd, marca });

      totalPiezas += piezas;
      totalUsd += valorUsd;
      if (e.po) totalPOs.add(e.po);
    });

    // Ordenar por mes ascendente
    const lista = Array.from(meses.values()).sort((a, b) => a.key.localeCompare(b.key));

    // Próxima ETA (más cercana a hoy)
    let proxEta = null;
    (embarques || []).forEach((e) => {
      const est = String(e.estatus || '').toLowerCase();
      if (est.includes('cancel') || est.includes('concluido') || est.includes('rechazada') || est.includes('perdida')) return;
      const etaStr = e.arribo_cedis || e.arribo_almacen || e.eta_puerto || e.eta;
      if (!etaStr) return;
      const eta = new Date(etaStr);
      if (isNaN(eta)) return;
      const yr = eta.getFullYear();
      if (yr < 2020 || yr > 2030) return;
      if (eta < limiteAtras) return;
      if (!proxEta || eta < proxEta) proxEta = eta;
    });

    return {
      meses: lista,
      total: { piezas: totalPiezas, usd: totalUsd, pos: totalPOs.size },
      proxEta,
    };
  }, [embarques, metaBySku]);

  const formatEta = (d) => {
    if (!d) return '—';
    return `${d.getDate()} ${MES_NOMBRE[d.getMonth()]}`;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <Ship className="w-4 h-4 text-blue-600" />
        <h3 className="font-semibold text-gray-800 text-sm">Tránsito · próximos 6 meses</h3>
        <span className="ml-auto text-xs text-gray-500">
          Total: <span className="font-bold text-gray-800">{FMT_N(data.total.piezas)} pzs</span>
          <span className="text-gray-400"> · </span>
          <span className="font-bold text-gray-800">{FMT_USD(data.total.usd)}</span>
          <span className="text-gray-400"> · {data.total.pos} POs</span>
          {data.proxEta && (
            <>
              <span className="text-gray-400"> · próx ETA </span>
              <span className="font-semibold text-blue-700">{formatEta(data.proxEta)}</span>
            </>
          )}
        </span>
      </div>

      <div className="divide-y divide-gray-100">
        {data.meses.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-gray-400 italic">
            Sin tránsito programado en los próximos 6 meses
          </div>
        ) : (
          data.meses.map((m) => (
            <MesRow
              key={m.key}
              mes={m}
              expandido={mesExpandido === m.key}
              onToggle={() => setMesExpandido(mesExpandido === m.key ? null : m.key)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function MesRow({ mes, expandido, onToggle }) {
  const titulo = `${MES_NOMBRE[mes.mes - 1].toUpperCase()} ${mes.anio}`;
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition text-left"
      >
        {expandido ? <ChevronUp className="w-4 h-4 text-gray-400"/> : <ChevronDown className="w-4 h-4 text-gray-400"/>}
        <span className="font-semibold text-gray-700 text-sm w-24">{titulo}</span>
        <span className="font-bold text-gray-800 tabular-nums text-sm w-24 text-right">
          {FMT_N(mes.piezas)} pzs
        </span>
        <span className="font-semibold text-emerald-700 tabular-nums text-sm w-28 text-right">
          {FMT_USD(mes.usd)}
        </span>
        <span className="text-xs text-gray-500 ml-auto">
          {mes.pos.size} POs
        </span>
      </button>
      {expandido && <DesgloseFamiliaMarca embarques={mes.embarques} />}
    </div>
  );
}

function DesgloseFamiliaMarca({ embarques }) {
  // Agrupar por familia → marca
  const grupos = useMemo(() => {
    const tree = new Map(); // familia → Map(marca → {piezas, usd, skus:Set})
    embarques.forEach((e) => {
      const familia = e.familia || '(sin familia)';
      const marca = e.marca || '(sin marca)';
      if (!tree.has(familia)) tree.set(familia, new Map());
      const fmap = tree.get(familia);
      if (!fmap.has(marca)) fmap.set(marca, { piezas: 0, usd: 0, skus: new Set(), pos: new Set() });
      const cell = fmap.get(marca);
      cell.piezas += Number(e.po_qty || 0);
      cell.usd += Number(e.valorUsd || 0);
      if (e.codigo) cell.skus.add(e.codigo);
      if (e.po) cell.pos.add(e.po);
    });

    const out = [];
    for (const [familia, fmap] of tree.entries()) {
      let famPiezas = 0, famUsd = 0;
      const marcas = [];
      for (const [marca, cell] of fmap.entries()) {
        marcas.push({ marca, piezas: cell.piezas, usd: cell.usd, skus: cell.skus.size, pos: cell.pos.size });
        famPiezas += cell.piezas;
        famUsd += cell.usd;
      }
      marcas.sort((a, b) => b.piezas - a.piezas);
      out.push({ familia, piezas: famPiezas, usd: famUsd, marcas });
    }
    out.sort((a, b) => b.piezas - a.piezas);
    return out;
  }, [embarques]);

  return (
    <div className="px-4 pb-3 pt-1 space-y-2 bg-gray-50/40">
      {grupos.map((g) => (
        <div key={g.familia} className="text-xs">
          <div className="flex items-center gap-2 py-1">
            <span className="font-semibold text-gray-700 flex-1">{g.familia}</span>
            <span className="tabular-nums text-gray-700 w-20 text-right">{FMT_N(g.piezas)} pzs</span>
            <span className="tabular-nums text-emerald-700 w-24 text-right">{FMT_USD(g.usd)}</span>
          </div>
          <div className="ml-4 space-y-0.5">
            {g.marcas.map((m) => (
              <div key={m.marca} className="flex items-center gap-2 text-[11px] text-gray-600">
                <span className="flex-1 truncate">{m.marca}</span>
                <span className="tabular-nums w-16 text-right">{FMT_N(m.piezas)}</span>
                <span className="tabular-nums w-20 text-right">{FMT_USD(m.usd)}</span>
                <span className="text-gray-400 w-14 text-right">{m.skus} SKUs</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
