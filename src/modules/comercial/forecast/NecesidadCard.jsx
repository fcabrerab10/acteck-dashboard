// NecesidadCard — qué inventario necesitas comprar (en MXN) frente a la
// cuota de cada cliente, para los próximos 3 meses (90 días).
//
// Vista colapsada: una fila por cliente con cuota total · sell-in proyectado ·
//   brecha en MXN.
// Vista expandida (click en el cliente): top SKUs que más faltan ordenados
//   por VALOR descendente (precio × piezas faltantes).

import React, { useMemo, useState } from 'react';
import { Target, ChevronDown, ChevronUp } from 'lucide-react';
import { PCEL_REAL } from '../../../lib/constants';

const FMT_N    = (n) => Math.round(n || 0).toLocaleString('es-MX');
const FMT_MXN  = (n) => `$${Math.round(n || 0).toLocaleString('es-MX')}`;

const CLIENTES = [
  { key: 'digitalife', label: 'Digitalife', color: '#3B82F6' },
  { key: 'pcel',       label: 'PCEL',       color: '#EF4444' },
];

export default function NecesidadCard({ rows, cuotas, metaBySku }) {
  const [clienteAbierto, setClienteAbierto] = useState(null);

  const calc = useMemo(() => {
    const hoy = new Date();
    const mesActual = hoy.getMonth() + 1;
    const anioActual = hoy.getFullYear();

    // Cuota 3 meses (mes actual + 2 siguientes) por cliente, en MXN
    const cuotaPorCliente = { digitalife: 0, pcel: 0 };
    const meses3 = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(anioActual, mesActual - 1 + i, 1);
      meses3.push({ a: d.getFullYear(), m: d.getMonth() + 1 });
    }
    (cuotas || []).forEach((c) => {
      const k = c.cliente;
      if (!cuotaPorCliente.hasOwnProperty(k)) return;
      if (!meses3.some((mm) => mm.a === Number(c.anio) && mm.m === Number(c.mes))) return;
      cuotaPorCliente[k] += Number(c.cuota_min || 0);
    });
    // Fallback PCEL: si no hay cuota cargada, usa PCEL_REAL.cuota50M
    if (cuotaPorCliente.pcel === 0 && PCEL_REAL?.cuota50M) {
      meses3.forEach((mm) => {
        if (mm.a === anioActual) {
          cuotaPorCliente.pcel += Number(PCEL_REAL.cuota50M[mm.m] || 0);
        }
      });
    }

    // Por cliente: sumar el sell-in proyectado en MXN (demHor × costo_promedio_mxn)
    // y los SKUs que faltan ordenados por valor.
    const porCliente = {};
    CLIENTES.forEach((c) => {
      porCliente[c.key] = {
        cuota: cuotaPorCliente[c.key] || 0,
        sellInProyectadoMxn: 0,
        brechaMxn: 0,
        skusFaltantes: [],
      };
    });

    (rows || []).forEach((r) => {
      const meta = metaBySku ? metaBySku[r.sku] : null;
      const costoMxn = Number(r.costoUnitMxn || meta?.costo_promedio_mxn || 0);
      const precioVentaMxn = Number(meta?.precio_venta_mxn || meta?.precio_lista_mxn || costoMxn);
      // Para "valor del SKU" usamos costo_promedio_mxn (lo que TÚ pagas como
      // input de inventario) — es lo más relevante para la decisión de compra.
      const valorUnitario = costoMxn;

      CLIENTES.forEach((c) => {
        const piezas3m = (r.demMes?.[c.key] || 0) * 3;
        const valor3m = piezas3m * valorUnitario;
        porCliente[c.key].sellInProyectadoMxn += valor3m;

        // Calcular brecha de piezas por cliente (prorrateando inv compartido)
        if (r.demandaMesTotal > 0) {
          const ratio = (r.demMes[c.key] || 0) / r.demandaMesTotal;
          const totalDisponible = (r.inv || 0) + (r.traDentroHor || 0);
          const stockProporcionalCliente = totalDisponible * ratio;
          const brechaPiezasCliente = Math.max(0, piezas3m - stockProporcionalCliente);
          if (brechaPiezasCliente > 0 && valorUnitario > 0) {
            porCliente[c.key].brechaMxn += brechaPiezasCliente * valorUnitario;
            porCliente[c.key].skusFaltantes.push({
              sku: r.sku,
              descripcion: r.descripcion,
              piezas: Math.round(brechaPiezasCliente),
              valorUnitario,
              valorTotal: brechaPiezasCliente * valorUnitario,
            });
          }
        }
      });
    });

    // Ordenar SKUs faltantes por VALOR UNITARIO descendente (los más caros
    // primero — porque son los que más impactan).
    Object.values(porCliente).forEach((p) => {
      p.skusFaltantes.sort((a, b) => b.valorUnitario - a.valorUnitario);
    });

    return { porCliente, cuotaPorCliente };
  }, [rows, cuotas, metaBySku]);

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <Target className="w-4 h-4 text-emerald-600" />
        <h3 className="font-semibold text-gray-800 text-sm">Necesidad por cliente · próximos 90 días</h3>
        <span className="ml-auto text-[10px] text-gray-400">vs cuota mínima · valuado a costo</span>
      </div>

      <div className="divide-y divide-gray-100">
        {CLIENTES.map((c) => {
          const p = calc.porCliente[c.key];
          const abierto = clienteAbierto === c.key;
          const cumplimiento = p.cuota > 0 ? (p.sellInProyectadoMxn / p.cuota) * 100 : null;
          return (
            <div key={c.key}>
              <button
                type="button"
                onClick={() => setClienteAbierto(abierto ? null : c.key)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition text-left"
              >
                {abierto
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />}
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="font-semibold text-gray-800 text-sm w-28">{c.label}</span>
                <div className="flex-1 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] uppercase text-gray-500 tracking-wide">Cuota 3m</div>
                    <div className="font-semibold tabular-nums">{FMT_MXN(p.cuota)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-gray-500 tracking-wide">Proyectado</div>
                    <div className="font-semibold tabular-nums" style={{ color: c.color }}>
                      {FMT_MXN(p.sellInProyectadoMxn)}
                    </div>
                    {cumplimiento != null && (
                      <div className="text-[10px] text-gray-500">{cumplimiento.toFixed(0)}% cuota</div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-gray-500 tracking-wide">Brecha a comprar</div>
                    <div className="font-bold tabular-nums" style={{ color: p.brechaMxn > 0 ? '#dc2626' : '#10B981' }}>
                      {p.brechaMxn > 0 ? FMT_MXN(p.brechaMxn) : '✓ cubierto'}
                    </div>
                    {p.skusFaltantes.length > 0 && (
                      <div className="text-[10px] text-gray-500">
                        {p.skusFaltantes.length} SKU{p.skusFaltantes.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              </button>

              {abierto && (
                <SkusFaltantes cliente={c} skus={p.skusFaltantes} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SkusFaltantes({ cliente, skus }) {
  if (skus.length === 0) {
    return (
      <div className="px-4 pb-4 pt-1 text-xs text-emerald-700 italic">
        ✓ Inventario suficiente para cubrir la cuota de {cliente.label} próximos 90 días
      </div>
    );
  }
  // Mostrar todos pero con scroll interno
  return (
    <div className="px-4 pb-4 pt-1 bg-gray-50/40">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-2">
        SKUs que más hacen falta · ordenados por valor unitario (mayor → menor)
      </div>
      <div className="overflow-y-auto max-h-72 rounded border border-gray-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-[10px] text-gray-500 sticky top-0">
            <tr>
              <th className="text-left px-2 py-1.5">SKU</th>
              <th className="text-left px-2 py-1.5">Descripción</th>
              <th className="text-right px-2 py-1.5">Faltan</th>
              <th className="text-right px-2 py-1.5">$ / pza</th>
              <th className="text-right px-2 py-1.5">Total MXN</th>
            </tr>
          </thead>
          <tbody>
            {skus.map((s) => (
              <tr key={s.sku} className="border-t border-gray-100 hover:bg-blue-50/30">
                <td className="px-2 py-1 font-mono font-semibold text-gray-800">{s.sku}</td>
                <td className="px-2 py-1 text-gray-600 truncate max-w-[280px]" title={s.descripcion}>
                  {s.descripcion || '—'}
                </td>
                <td className="px-2 py-1 text-right tabular-nums">{FMT_N(s.piezas)}</td>
                <td className="px-2 py-1 text-right tabular-nums font-semibold" style={{ color: cliente.color }}>
                  {FMT_MXN(s.valorUnitario)}
                </td>
                <td className="px-2 py-1 text-right tabular-nums font-bold text-emerald-700">
                  {FMT_MXN(s.valorTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
