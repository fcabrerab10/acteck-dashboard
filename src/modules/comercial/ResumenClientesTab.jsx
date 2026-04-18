import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';
import { BarChart3 } from 'lucide-react';

const CLIENTES = [
  { key: 'digitalife',   nombre: 'Digitalife',    cuotaAnual: 0 },
  { key: 'pcel',         nombre: 'PCEL',          cuotaAnual: 600000000 },
  { key: 'mercadolibre', nombre: 'Mercado Libre', cuotaAnual: 0 }
];

function mesActual() { return new Date().getMonth() + 1; }
function anioActual() { return new Date().getFullYear(); }

function ClienteCard({ c }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      const anio = anioActual();
      const mes = mesActual();
      // Sell-In YTD desde ventas_mensuales
      const si = await supabase.from('ventas_mensuales').select('*').eq('cliente', c.key).eq('anio', anio);
      const siYTD = (si.data || []).filter(r => (r.mes || 0) <= mes).reduce((a, r) => a + (Number(r.sell_in) || 0), 0);
      const siMes = (si.data || []).find(r => r.mes === mes);
      // Sell-Out YTD desde sellout_detalle
      const so = await supabase.from('sellout_detalle').select('importe,fecha').eq('cliente', c.key).gte('fecha', anio + '-01-01').lte('fecha', anio + '-12-31');
      const soYTD = (so.data || []).reduce((a, r) => a + (Number(r.importe) || 0), 0);
      // Inventario del cliente
      const inv = await supabase.from('inventario_cliente').select('inventario').eq('cliente', c.key);
      const invTotal = (inv.data || []).reduce((a, r) => a + (Number(r.inventario) || 0), 0);
      const cuotaMes = c.cuotaAnual / 12;
      const cumpl = cuotaMes > 0 && siMes ? (Number(siMes.sell_in || 0) / cuotaMes) * 100 : null;
      setData({ siYTD, soYTD, invTotal, cuotaMes, cumpl, mes });
    })();
  }, [c.key]);
  if (!data) return <div className="bg-white rounded-lg shadow p-4 border border-gray-100"><div className="text-gray-400">Cargando {c.nombre}…</div></div>;
  const barColor = data.cumpl == null ? 'bg-gray-300' : data.cumpl >= 100 ? 'bg-green-500' : data.cumpl >= 70 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-lg font-bold text-gray-800 mb-3">{c.nombre}</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><div className="text-gray-500 text-xs">Sell-In YTD</div><div className="font-bold text-blue-700">{formatMXN(data.siYTD)}</div></div>
        <div><div className="text-gray-500 text-xs">Sell-Out YTD</div><div className="font-bold text-green-700">{formatMXN(data.soYTD)}</div></div>
        <div><div className="text-gray-500 text-xs">Inventario</div><div className="font-bold text-gray-800">{data.invTotal.toLocaleString()} u</div></div>
        <div><div className="text-gray-500 text-xs">Cuota mes</div><div className="font-semibold text-gray-700">{data.cuotaMes > 0 ? formatMXN(data.cuotaMes) : '—'}</div></div>
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Cumplimiento cuota mes {data.mes}</span>
          <span>{data.cumpl != null ? data.cumpl.toFixed(1) + '%' : 'Sin cuota'}</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className={'h-full ' + barColor} style={{ width: Math.min(100, data.cumpl || 0) + '%' }} />
        </div>
      </div>
    </div>
  );
}

export default function ResumenClientesTab() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-1 flex items-center gap-2">
        <BarChart3 className="w-6 h-6 text-gray-700" />
        Resumen de Clientes
      </h1>
      <p className="text-gray-500 text-sm mb-5">Consolidado de los 3 clientes key. Datos desde Supabase (importador central).</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CLIENTES.map(c => <ClienteCard key={c.key} c={c} />)}
      </div>
    </div>
  );
}
