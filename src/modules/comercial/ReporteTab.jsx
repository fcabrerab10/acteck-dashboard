import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';
import { ClipboardList } from 'lucide-react';

// Alias mapping for inventory columns (almacen numeric codes)
const ALM_LABEL = {
  1: 'Alm 1', 2: 'Alm 2', 3: 'Alm 3', 25: 'Alm 25', 14: 'Alm 14',
  16: 'Retail-16', 17: 'Retail-17', 19: 'Decme-19', 6: 'Decme-6', 44: 'Dañado-44'
};

function sumByAlmacenes(invRows, almacenes) {
  return (invRows || []).filter(r => almacenes.includes(Number(r.no_almacen)))
    .reduce((a, r) => a + (Number(r.disponible) || 0), 0);
}

export default function ReporteTab() {
  const [roadmap, setRoadmap] = useState(null);
  const [precios, setPrecios] = useState(null);
  const [transito, setTransito] = useState(null);
  const [inventario, setInventario] = useState(null);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    Promise.all([
      supabase.from('roadmap_sku').select('*').order('sort_order', { ascending: true }),
      supabase.from('precios_sku').select('*'),
      supabase.from('transito_sku').select('*'),
      supabase.from('inventario_acteck').select('articulo,no_almacen,disponible')
    ]).then(([r, p, t, i]) => {
      if (r.error) setErr(r.error.message);
      setRoadmap(r.data || []);
      setPrecios(p.data || []);
      setTransito(t.data || []);
      setInventario(i.data || []);
    }).catch(e => setErr(String(e)));
  }, []);

  const rows = useMemo(() => {
    if (!roadmap) return null;
    const pMap = new Map((precios || []).map(x => [x.sku, x]));
    const tMap = new Map((transito || []).map(x => [x.sku, x]));
    // Group inventario by articulo (sku)
    const invMap = new Map();
    for (const r of inventario || []) {
      const k = r.articulo;
      if (!invMap.has(k)) invMap.set(k, []);
      invMap.get(k).push(r);
    }

    return roadmap.map(r => {
      const sku = r.sku;
      const p = pMap.get(sku) || {};
      const t = tMap.get(sku) || {};
      const invRows = invMap.get(sku) || [];
      const alm1 = sumByAlmacenes(invRows, [1]);
      const alm2 = sumByAlmacenes(invRows, [2]);
      const alm3 = sumByAlmacenes(invRows, [3]);
      const alm25 = sumByAlmacenes(invRows, [25]);
      const alm14 = sumByAlmacenes(invRows, [14]);
      const retail = sumByAlmacenes(invRows, [16, 17]);
      const decme = sumByAlmacenes(invRows, [19, 6]);
      const dañado = sumByAlmacenes(invRows, [44]);
      const totalInv = alm1 + alm2 + alm3 + alm25 + alm14 + retail + decme + dañado;
      return {
        sku,
        rdmp: (r.payload && (r.payload['RDMP'] || r.payload['Roadmap'] || r.payload['Estatus'])) || r.rdmp || '',
        descripcion: (r.payload && (r.payload['Descripción'] || r.payload['Descripcion'] || r.payload['Description'])) || r.descripcion || '',
        alm1, alm2, alm3, alm25, alm14, retail, decme, dañado, totalInv,
        precio_aaa: p.precio_aaa,
        descuento: p.descuento || 0,
        precio_desc: p.precio_descuento,
        transito: t.inv_transito || (t.payload && (t.payload['Transito'] || t.payload['Inv Tránsito'])) || 0,
        arribo: t.siguiente_arribo || (t.payload && (t.payload['Siguiente Arribo'] || t.payload['Arribo'])) || ''
      };
    });
  }, [roadmap, precios, transito, inventario]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    if (!filter.trim()) return rows;
    const f = filter.toLowerCase();
    return rows.filter(r => (r.sku || '').toLowerCase().includes(f)
      || String(r.rdmp).toLowerCase().includes(f)
      || (r.descripcion || '').toLowerCase().includes(f));
  }, [rows, filter]);

  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;
  if (!rows) return <div className="p-6 text-gray-400">Cargando reporte…</div>;
  if (rows.length === 0) return (
    <div className="p-10 text-center">
      <div className="mb-3"><ClipboardList className="w-12 h-12 text-gray-400 mx-auto" /></div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Reporte</h2>
      <p className="text-gray-500">No hay SKUs en roadmap_sku todavía. Sube el Excel central (botón azul abajo a la derecha) e incluye la hoja <code>Roadmap Q2 2026</code>.</p>
    </div>
  );

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-gray-700" />
          Reporte — Disponibilidad por SKU
        </h2>
        <div className="flex items-center gap-2">
          <input type="text" placeholder="Filtrar SKU / RDMP / descripción" value={filter} onChange={e => setFilter(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm w-72" />
          <span className="text-xs text-gray-500">{filtered.length} / {rows.length} filas</span>
        </div>
      </div>
      <div className="overflow-x-auto bg-white rounded-lg shadow-sm border border-gray-200">
        <table className="text-xs w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-2 py-2 text-left">SKU</th>
              <th className="px-2 py-2 text-left">RDMP</th>
              <th className="px-2 py-2 text-left">Descripción</th>
              <th className="px-2 py-2 text-right">Alm 1</th>
              <th className="px-2 py-2 text-right">Alm 2</th>
              <th className="px-2 py-2 text-right">Alm 3</th>
              <th className="px-2 py-2 text-right">Alm 25</th>
              <th className="px-2 py-2 text-right">Alm 14</th>
              <th className="px-2 py-2 text-right">Retail</th>
              <th className="px-2 py-2 text-right">Decme</th>
              <th className="px-2 py-2 text-right">E.Dañado</th>
              <th className="px-2 py-2 text-right bg-gray-100">Σ Inv</th>
              <th className="px-2 py-2 text-right">Precio AAA</th>
              <th className="px-2 py-2 text-right">Dto</th>
              <th className="px-2 py-2 text-right">Precio c/Dto</th>
              <th className="px-2 py-2 text-right">Tránsito</th>
              <th className="px-2 py-2 text-left">Sig. Arribo</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.sku + '-' + i} className={i % 2 ? 'bg-gray-50' : 'bg-white'}>
                <td className="px-2 py-1 font-mono">{r.sku}</td>
                <td className="px-2 py-1">{r.rdmp}</td>
                <td className="px-2 py-1">{r.descripcion}</td>
                <td className="px-2 py-1 text-right">{r.alm1}</td>
                <td className="px-2 py-1 text-right">{r.alm2}</td>
                <td className="px-2 py-1 text-right">{r.alm3}</td>
                <td className="px-2 py-1 text-right">{r.alm25}</td>
                <td className="px-2 py-1 text-right">{r.alm14}</td>
                <td className="px-2 py-1 text-right">{r.retail}</td>
                <td className="px-2 py-1 text-right">{r.decme}</td>
                <td className="px-2 py-1 text-right text-red-600">{r.dañado}</td>
                <td className="px-2 py-1 text-right font-semibold bg-gray-50">{r.totalInv}</td>
                <td className="px-2 py-1 text-right">{r.precio_aaa != null ? formatMXN(r.precio_aaa) : '—'}</td>
                <td className={'px-2 py-1 text-right ' + (r.descuento > 0 ? 'text-green-700 font-semibold' : 'text-gray-400')}>{r.descuento > 0 ? r.descuento + '%' : '—'}</td>
                <td className="px-2 py-1 text-right">{r.precio_desc != null ? formatMXN(r.precio_desc) : '—'}</td>
                <td className="px-2 py-1 text-right">{r.transito || '—'}</td>
                <td className="px-2 py-1">{r.arribo || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
