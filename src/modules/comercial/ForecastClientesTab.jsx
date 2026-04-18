import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Target, Package } from 'lucide-react';

const CLIENTES = ['digitalife', 'pcel', 'mercadolibre'];
const NOMBRE = { digitalife: 'Digitalife', pcel: 'PCEL', mercadolibre: 'Mercado Libre' };

export default function ForecastClientesTab() {
  const [ventana, setVentana] = useState(30); // dias de forecast
  const [selloutData, setSelloutData] = useState(null);
  const [inventario, setInventario] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const hoy = new Date();
        const desde = new Date(hoy.getTime() - 90 * 86400000).toISOString().slice(0, 10);
        const { data: so, error: e1 } = await supabase.from('sellout_detalle')
          .select('cliente,no_parte,cantidad,fecha').gte('fecha', desde).in('cliente', CLIENTES);
        if (e1) throw e1;
        const { data: inv, error: e2 } = await supabase.from('inventario_acteck')
          .select('articulo,disponible').limit(50000);
        if (e2) throw e2;
        setSelloutData(so || []);
        setInventario(inv || []);
      } catch (e) { setErr(String(e)); }
    })();
  }, []);

  const reserva = useMemo(() => {
    if (!selloutData || !inventario) return null;
    // Agrupar sellout ultimos 90 dias por SKU y cliente, calcular demanda diaria promedio
    const byClienteSku = {};
    for (const r of selloutData) {
      const k = r.cliente + '|' + r.no_parte;
      byClienteSku[k] = (byClienteSku[k] || 0) + (Number(r.cantidad) || 0);
    }
    // Por SKU: sumar demanda proyectada de los 3 clientes para la ventana
    const proyPorSku = {};
    for (const [k, total90] of Object.entries(byClienteSku)) {
      const [cli, sku] = k.split('|');
      if (!sku) continue;
      const demDiaria = total90 / 90;
      const proy = demDiaria * ventana;
      if (!proyPorSku[sku]) proyPorSku[sku] = { sku, demanda: 0, porCliente: {} };
      proyPorSku[sku].demanda += proy;
      proyPorSku[sku].porCliente[cli] = proy;
    }
    // Inventario Acteck total por SKU
    const invPorSku = {};
    for (const r of inventario) {
      invPorSku[r.articulo] = (invPorSku[r.articulo] || 0) + (Number(r.disponible) || 0);
    }
    return Object.values(proyPorSku).map(x => ({
      ...x,
      inventario: invPorSku[x.sku] || 0,
      reservaSugerida: Math.ceil(x.demanda),
      gap: Math.max(0, Math.ceil(x.demanda) - (invPorSku[x.sku] || 0))
    })).sort((a, b) => b.demanda - a.demanda);
  }, [selloutData, inventario, ventana]);

  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;
  if (!reserva) return <div className="p-6 text-gray-400">Cargando forecast…</div>;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Target className="w-6 h-6 text-gray-700" />
            Forecast de Inventario a Reservar
          </h2>
          <p className="text-gray-500 text-sm">Proyección de demanda esperada de Digitalife, PCEL y Mercado Libre basada en sell-out últimos 90 días. Reserva para que otros vendedores no tomen el inventario.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Ventana:</label>
          <select value={ventana} onChange={e => setVentana(Number(e.target.value))} className="border rounded px-2 py-1 text-sm">
            <option value={15}>15 días</option>
            <option value={30}>30 días</option>
            <option value={45}>45 días</option>
            <option value={60}>60 días</option>
            <option value={90}>90 días</option>
          </select>
        </div>
      </div>
      {reserva.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-lg border border-gray-100">
          <div className="mb-2"><Package className="w-10 h-10 text-gray-400 mx-auto" /></div>
          <p className="text-gray-500">Sin histórico de sell-out para los 3 clientes en los últimos 90 días.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow-sm border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">SKU</th>
                {CLIENTES.map(c => <th key={c} className="px-3 py-2 text-right">{NOMBRE[c]}</th>)}
                <th className="px-3 py-2 text-right bg-blue-50">Demanda {ventana}d</th>
                <th className="px-3 py-2 text-right">Inv Acteck</th>
                <th className="px-3 py-2 text-right bg-green-50">Reserva sugerida</th>
                <th className="px-3 py-2 text-right bg-red-50">Gap (faltante)</th>
              </tr>
            </thead>
            <tbody>
              {reserva.slice(0, 200).map((r, i) => (
                <tr key={r.sku} className={i % 2 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="px-3 py-1 font-mono text-xs">{r.sku}</td>
                  {CLIENTES.map(c => <td key={c} className="px-3 py-1 text-right text-gray-600">{(r.porCliente[c] || 0).toFixed(1)}</td>)}
                  <td className="px-3 py-1 text-right font-semibold bg-blue-50">{r.demanda.toFixed(0)}</td>
                  <td className="px-3 py-1 text-right">{r.inventario}</td>
                  <td className="px-3 py-1 text-right font-bold text-green-700 bg-green-50">{r.reservaSugerida}</td>
                  <td className={'px-3 py-1 text-right font-bold bg-red-50 ' + (r.gap > 0 ? 'text-red-700' : 'text-gray-400')}>{r.gap > 0 ? r.gap : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {reserva.length > 200 && <div className="p-2 text-xs text-gray-500 text-center">Mostrando top 200 de {reserva.length} SKUs con demanda.</div>}
        </div>
      )}
    </div>
  );
}
