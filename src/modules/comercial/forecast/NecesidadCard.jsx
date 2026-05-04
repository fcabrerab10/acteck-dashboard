// NecesidadCard — qué necesitarás comprar para cubrir la demanda por cliente.
//
// Dos vistas:
//   1. PRÓXIMOS 90 DÍAS (urgencia — comprar ya o pronto)
//   2. ADICIONAL 90-180 DÍAS (planeación, no es urgente)
//
// Siempre en piezas. Brecha por cliente = max(0, demanda_cliente − inv_compartido_proporcional − tránsito_compartido)
// Aquí lo simplifico: brecha por cliente = max(0, demanda_cliente − (inv + tránsito) × ratio_cliente).
//
// El total al final ya está redondeado a múltiplos de contenedor.

import React, { useMemo } from 'react';
import { Target } from 'lucide-react';

const FMT_N = (n) => Math.round(n || 0).toLocaleString('es-MX');

export default function NecesidadCard({ rows, demandaSrc }) {
  // rows ya viene calculado para el horizonte actual (3 meses default).
  // Pero queremos calcular AMBOS horizontes (90d y 180d) → derivamos de demMes.
  const calc = useMemo(() => {
    let dem90 = { digi: 0, pcel: 0 };
    let dem180Extra = { digi: 0, pcel: 0 };
    let brecha90 = { digi: 0, pcel: 0 };
    let brecha180Extra = { digi: 0, pcel: 0 };
    let sugeridoPiezas = 0;
    let sugeridoContenedores = 0;
    let skusEnRiesgo90 = 0;

    (rows || []).forEach((r) => {
      const d3 = r.demMes.digitalife * 3;
      const p3 = r.demMes.pcel * 3;
      const d6 = r.demMes.digitalife * 6;
      const p6 = r.demMes.pcel * 6;

      dem90.digi += d3;
      dem90.pcel += p3;
      dem180Extra.digi += (d6 - d3);
      dem180Extra.pcel += (p6 - p3);

      // Stock disponible total (inv + tránsito que llega en horizonte)
      const totalDisponible = (r.inv || 0) + (r.traDentroHor || 0);
      const totalDemanda3 = d3 + p3;

      // Brecha 90d por cliente, prorrateando inventario disponible
      let bDigi = d3, bPcel = p3;
      if (totalDemanda3 > 0) {
        const ratioDigi = d3 / totalDemanda3;
        const ratioPcel = p3 / totalDemanda3;
        const inv90Digi = totalDisponible * ratioDigi;
        const inv90Pcel = totalDisponible * ratioPcel;
        bDigi = Math.max(0, d3 - inv90Digi);
        bPcel = Math.max(0, p3 - inv90Pcel);
      }
      brecha90.digi += bDigi;
      brecha90.pcel += bPcel;

      // Brecha extra (90-180): adicional de los siguientes 3 meses
      brecha180Extra.digi += (d6 - d3);
      brecha180Extra.pcel += (p6 - p3);

      // Resumen del sugerido
      if (r.sugerido > 0) {
        sugeridoPiezas += r.sugerido;
        sugeridoContenedores += (r.contenedoresSugeridos || 0);
      }
      // SKUs con cobertura crítica (<30d)
      if (r.coberturaDias != null && r.coberturaDias < 30 && r.demandaMesTotal > 0) {
        skusEnRiesgo90 += 1;
      }
    });

    return {
      dem90, dem180Extra, brecha90, brecha180Extra,
      sugeridoPiezas, sugeridoContenedores, skusEnRiesgo90,
    };
  }, [rows]);

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <Target className="w-4 h-4 text-emerald-600" />
        <h3 className="font-semibold text-gray-800 text-sm">Necesidad por cliente</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* PRÓXIMOS 90 DÍAS */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <h4 className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
              Próximos 90 días
            </h4>
            <span className="text-[10px] text-gray-400">brecha = demanda − (inv + tránsito)</span>
          </div>
          <NecesidadFila label="Digitalife" demanda={calc.dem90.digi} brecha={calc.brecha90.digi} color="#3B82F6" />
          <NecesidadFila label="PCEL" demanda={calc.dem90.pcel} brecha={calc.brecha90.pcel} color="#EF4444" />
          <div className="border-t border-gray-100 mt-2 pt-1.5 flex items-center justify-between text-xs">
            <span className="text-gray-500 font-medium">Total a comprar (90d)</span>
            <span className="font-bold text-emerald-700 tabular-nums">
              {FMT_N(calc.brecha90.digi + calc.brecha90.pcel)} pzs
            </span>
          </div>
        </div>

        {/* ADICIONAL 90-180 DÍAS */}
        <div className="pt-3 border-t border-gray-100">
          <h4 className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-2">
            Adicional 90-180 días (planeación)
          </h4>
          <NecesidadFila label="Digitalife" demanda={calc.dem180Extra.digi} brecha={calc.brecha180Extra.digi} color="#3B82F6" muted />
          <NecesidadFila label="PCEL" demanda={calc.dem180Extra.pcel} brecha={calc.brecha180Extra.pcel} color="#EF4444" muted />
        </div>

        {/* Footer: sugerido total redondeado a contenedores */}
        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-gray-500">Sugerido (redondeado a contenedor):</span>
            <span className="font-bold text-emerald-700 tabular-nums">
              {FMT_N(calc.sugeridoPiezas)} pzs
              {calc.sugeridoContenedores > 0 && (
                <span className="text-gray-400 font-normal ml-1">· {calc.sugeridoContenedores} cnt</span>
              )}
            </span>
          </div>
          {calc.skusEnRiesgo90 > 0 && (
            <div className="mt-1 text-[10px] text-red-600">
              ⚠ {calc.skusEnRiesgo90} SKU{calc.skusEnRiesgo90 > 1 ? 's' : ''} con cobertura &lt; 30 días
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NecesidadFila({ label, demanda, brecha, color, muted = false }) {
  return (
    <div className="flex items-center gap-2 text-xs py-0.5">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="flex-1 text-gray-700">{label}</span>
      <span className="text-gray-400 tabular-nums w-20 text-right">
        Dem: {FMT_N(demanda)}
      </span>
      <span
        className={muted ? 'tabular-nums w-24 text-right text-gray-500' : 'font-semibold tabular-nums w-24 text-right'}
        style={muted ? null : { color: brecha > 0 ? '#dc2626' : '#10B981' }}
      >
        {brecha > 0 ? `Brecha: ${FMT_N(brecha)}` : '✓ cubierto'}
      </span>
    </div>
  );
}
