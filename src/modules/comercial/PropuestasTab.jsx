// PropuestasTab.jsx — Armador de propuestas de venta por cliente.
// Flujo: elige cliente → ve tabla con SKUs enriquecidos → agrega los que quiera
// al builder de propuesta editando piezas y precio → exporta Excel.

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';

// ═══ Constantes ═══
const CLIENTES = [
  { key: 'digitalife', label: 'Digitalife', color: '#8B5CF6' },
  { key: 'pcel',       label: 'PCEL',       color: '#10B981' },
  { key: 'dicotech',   label: 'Dicotech',   color: '#0EA5E9' },
];

const FAMILIA_DIGITALIFE = {
  'Monitor':          'Monitores',
  'Sillas y Mesas':   'Sillas',
};
const familiaHoja = (familia) => FAMILIA_DIGITALIFE[familia] || 'Todo lo demás';

// Meses cerrados anteriores al actual (los últimos 3)
function mesesCerrados() {
  const hoy = new Date();
  const arr = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    arr.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 });
  }
  return arr; // [mes-1, mes-2, mes-3]
}

// ═══ Componente principal ═══
export default function PropuestasTab() {
  const [clienteKey, setClienteKey] = useState('digitalife');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data
  const [skus, setSkus] = useState([]); // roadmap + inv acteck + inv cliente + sellout prom + precios
  const [propuesta, setPropuesta] = useState({}); // { sku: { piezas, precio, listaSel } }

  // Filtros UI
  const [busqueda, setBusqueda] = useState('');
  const [filtroFamilia, setFiltroFamilia] = useState('todas');

  // Reset propuesta al cambiar cliente
  useEffect(() => { setPropuesta({}); }, [clienteKey]);

  // ═══ Fetch principal ═══
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const mm = mesesCerrados();
        const anioMin = Math.min(...mm.map((m) => m.anio));
        const anioMax = Math.max(...mm.map((m) => m.anio));

        // Paralelo: roadmap, inventarios, precios, sellout
        const [roadmapRes, invAckRes, invCliRes, preciosRes, selloutRes] = await Promise.all([
          supabase.from('roadmap_sku').select('sku,marca,familia,categoria,descripcion,rdmp'),
          supabase.from('inventario_acteck').select('articulo,disponible'),
          supabase.from('inventario_cliente')
            .select('sku,stock,titulo,anio,semana')
            .eq('cliente', clienteKey),
          supabase.from('precios_sku')
            .select('sku,lista,precio,anio,mes')
            .gte('anio', anioMax - 1)
            .order('anio', { ascending: false })
            .order('mes', { ascending: false }),
          fetchSellout(clienteKey, mm, anioMin, anioMax),
        ]);

        if (cancelled) return;

        // ─── Índices ───
        // Inventario Acteck: sumar por SKU (varios almacenes)
        const invAck = new Map();
        for (const r of invAckRes.data || []) {
          const s = r.articulo;
          invAck.set(s, (invAck.get(s) || 0) + (Number(r.disponible) || 0));
        }

        // Inventario cliente: quedarme con la fila más reciente por SKU (max anio+semana)
        const invCli = new Map();
        const invCliTitulos = new Map();
        for (const r of invCliRes.data || []) {
          const s = r.sku;
          const key = (Number(r.anio) || 0) * 100 + (Number(r.semana) || 0);
          const prev = invCli.get(s);
          if (!prev || prev.key < key) {
            invCli.set(s, { key, stock: Number(r.stock) || 0 });
            if (r.titulo) invCliTitulos.set(s, r.titulo);
          }
        }

        // Precios por SKU y lista — quedarme con el más reciente por lista
        const preciosPorSku = new Map(); // sku → { lista: precio }
        for (const r of preciosRes.data || []) {
          if (!preciosPorSku.has(r.sku)) preciosPorSku.set(r.sku, {});
          const listasSku = preciosPorSku.get(r.sku);
          if (!(r.lista in listasSku)) listasSku[r.lista] = Number(r.precio) || 0;
        }

        // Sellout: piezas totales de los 3 meses cerrados
        const sellout = new Map();
        for (const r of selloutRes) {
          sellout.set(r.sku, (sellout.get(r.sku) || 0) + (Number(r.cantidad) || 0));
        }

        // ─── Merge ───
        const rows = (roadmapRes.data || []).map((r) => ({
          sku: r.sku,
          marca: r.marca || '',
          familia: r.familia || '',
          categoria: r.categoria || '',
          descripcion: r.descripcion || invCliTitulos.get(r.sku) || '',
          rdmp: r.rdmp || '',
          invActeck: invAck.get(r.sku) || 0,
          invCliente: invCli.get(r.sku)?.stock || 0,
          sellout90: sellout.get(r.sku) || 0, // total 3 meses
          promSellout: Math.round((sellout.get(r.sku) || 0) / 3),
          precios: preciosPorSku.get(r.sku) || {},
        }));

        // Ordenar por sellout desc (más vendidos primero)
        rows.sort((a, b) => b.sellout90 - a.sellout90);

        setSkus(rows);
      } catch (e) {
        console.warn('[Propuestas] fetch error:', e);
        setError(e.message || 'Error al cargar');
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [clienteKey]);

  // ═══ Filtros ═══
  const familiasDisponibles = useMemo(() => {
    const s = new Set();
    for (const r of skus) if (r.familia) s.add(r.familia);
    return ['todas', ...Array.from(s).sort()];
  }, [skus]);

  const skusFiltrados = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    return skus.filter((r) => {
      if (filtroFamilia !== 'todas' && r.familia !== filtroFamilia) return false;
      if (q && !(String(r.sku).toUpperCase().includes(q) || String(r.descripcion).toUpperCase().includes(q))) return false;
      return true;
    });
  }, [skus, busqueda, filtroFamilia]);

  // ═══ Builder propuesta ═══
  const propuestaLista = useMemo(() => {
    return Object.entries(propuesta)
      .map(([sku, val]) => {
        const meta = skus.find((r) => r.sku === sku);
        if (!meta) return null;
        return { ...meta, ...val };
      })
      .filter(Boolean);
  }, [propuesta, skus]);

  const totalPropuesta = useMemo(() => propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0) * (Number(r.precio) || 0), 0), [propuestaLista]);
  const piezasPropuesta = useMemo(() => propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0), 0), [propuestaLista]);

  const toggleSku = (sku) => {
    setPropuesta((prev) => {
      const next = { ...prev };
      if (sku in next) { delete next[sku]; return next; }
      const meta = skus.find((r) => r.sku === sku);
      const precioDefault = meta ? Object.values(meta.precios)[0] || 0 : 0;
      const listaDefault = meta ? Object.keys(meta.precios)[0] || '' : '';
      next[sku] = {
        piezas: Math.max(0, meta?.promSellout || 0),
        precio: precioDefault,
        listaSel: listaDefault, // o 'personalizado'
      };
      return next;
    });
  };

  const editPropuesta = (sku, patch) => {
    setPropuesta((prev) => ({ ...prev, [sku]: { ...(prev[sku] || {}), ...patch } }));
  };

  const cliente = CLIENTES.find((c) => c.key === clienteKey);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header + selector cliente */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Propuestas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Arma la propuesta de venta para cada cliente y expórtala a Excel.</p>
        </div>
        <div className="inline-flex bg-gray-100 rounded-lg p-1 gap-1">
          {CLIENTES.map((c) => {
            const on = c.key === clienteKey;
            return (
              <button key={c.key} onClick={() => setClienteKey(c.key)} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition ${on ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading && <div className="text-center py-16 text-gray-400 text-sm">Cargando data de {cliente.label}…</div>}
      {error && <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-4 text-sm">{error}</div>}

      {!loading && !error && (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1fr) 380px' }}>
          {/* ═══ IZQ: Tabla maestra ═══ */}
          <div>
            {/* Filtros */}
            <div className="flex items-center gap-3 mb-3">
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar SKU o descripción…"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400" />
              <select value={filtroFamilia} onChange={(e) => setFiltroFamilia(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none bg-white cursor-pointer">
                {familiasDisponibles.map((f) => (
                  <option key={f} value={f}>{f === 'todas' ? 'Todas las familias' : f}</option>
                ))}
              </select>
              <div className="text-xs text-gray-500 whitespace-nowrap">
                {skusFiltrados.length.toLocaleString('es-MX')} SKUs
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div style={{ maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr className="text-gray-600">
                      <th className="text-left px-2 py-2 font-semibold w-8"></th>
                      <th className="text-left px-2 py-2 font-semibold" style={{ width: 100 }}>SKU</th>
                      <th className="text-left px-2 py-2 font-semibold">Descripción</th>
                      <th className="text-left px-2 py-2 font-semibold" style={{ width: 80 }}>Familia</th>
                      <th className="text-right px-2 py-2 font-semibold" style={{ width: 60 }}>Inv cli</th>
                      <th className="text-right px-2 py-2 font-semibold" style={{ width: 60 }}>Inv Ack</th>
                      <th className="text-right px-2 py-2 font-semibold" style={{ width: 70 }}>Prom SO 90d</th>
                      <th className="text-right px-2 py-2 font-semibold" style={{ width: 80 }}>Precio ref.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skusFiltrados.map((r) => {
                      const sel = r.sku in propuesta;
                      const precioRef = Object.values(r.precios)[0];
                      return (
                        <tr key={r.sku}
                          onClick={() => toggleSku(r.sku)}
                          className={`border-t border-gray-100 cursor-pointer ${sel ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                          style={{ height: 30 }}>
                          <td className="px-2 py-1 text-center">
                            <input type="checkbox" checked={sel} readOnly className="cursor-pointer" />
                          </td>
                          <td className="px-2 py-1 font-mono text-gray-700 whitespace-nowrap text-[10px]">{r.sku}</td>
                          <td className="px-2 py-1 text-gray-800" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descripcion}>
                            {r.descripcion || '—'}
                          </td>
                          <td className="px-2 py-1 text-gray-500 text-[10px] whitespace-nowrap">{r.familia || '—'}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{r.invCliente || <span className="text-gray-300">0</span>}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{r.invActeck || <span className="text-gray-300">0</span>}</td>
                          <td className="px-2 py-1 text-right tabular-nums font-medium">{r.promSellout || <span className="text-gray-300">0</span>}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-gray-600">{precioRef != null ? formatMXN(precioRef) : <span className="text-gray-300">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ═══ DER: Builder de propuesta ═══ */}
          <div>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden sticky top-4" style={{ maxHeight: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between" style={{ background: cliente.color + '11' }}>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Propuesta · {cliente.label}</div>
                  <div className="text-lg font-bold text-gray-900 tabular-nums">{formatMXN(totalPropuesta)}</div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <div>{propuestaLista.length} SKU</div>
                  <div className="tabular-nums">{piezasPropuesta.toLocaleString('es-MX')} pz</div>
                </div>
              </div>

              <div style={{ flex: 1, overflow: 'auto' }}>
                {propuestaLista.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm px-4">
                    Selecciona SKUs de la tabla para armar la propuesta.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {propuestaLista.map((r) => (
                      <BuilderRow key={r.sku} r={r}
                        onEdit={(patch) => editPropuesta(r.sku, patch)}
                        onRemove={() => toggleSku(r.sku)} />
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 p-3 flex gap-2">
                <button disabled={propuestaLista.length === 0}
                  className={`flex-1 py-2 rounded-md text-sm font-semibold ${propuestaLista.length === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-black text-white hover:bg-gray-800'}`}
                  onClick={() => alert('Export Excel — próximo push')}>
                  Exportar Excel
                </button>
                {propuestaLista.length > 0 && (
                  <button onClick={() => setPropuesta({})}
                    className="px-3 py-2 rounded-md text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ Fila del builder ═══
function BuilderRow({ r, onEdit, onRemove }) {
  const listas = Object.entries(r.precios); // [[lista, precio], ...]
  const [modo, setModo] = useState(r.listaSel === 'personalizado' ? 'personalizado' : (r.listaSel || 'personalizado'));

  const setLista = (l) => {
    setModo(l);
    if (l === 'personalizado') return;
    const precio = r.precios[l];
    if (precio != null) onEdit({ listaSel: l, precio });
    else onEdit({ listaSel: l });
  };

  const subtotal = (Number(r.piezas) || 0) * (Number(r.precio) || 0);

  return (
    <div className="px-3 py-2.5 hover:bg-gray-50">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] text-gray-500">{r.sku}</div>
          <div className="text-xs text-gray-800 truncate" title={r.descripcion}>{r.descripcion}</div>
        </div>
        <button onClick={onRemove} className="text-gray-400 hover:text-rose-500 text-sm leading-none">✕</button>
      </div>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5 items-center">
        <input type="number" min="0" value={r.piezas ?? ''}
          onChange={(e) => onEdit({ piezas: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0) })}
          className="px-2 py-1 text-xs border border-gray-200 rounded outline-none focus:border-gray-400 tabular-nums text-right"
          placeholder="piezas" />
        <div className="flex gap-1">
          <select value={modo} onChange={(e) => setLista(e.target.value)}
            className="flex-1 min-w-0 px-1 py-1 text-[10px] border border-gray-200 rounded outline-none bg-white cursor-pointer">
            {listas.map(([l, p]) => (
              <option key={l} value={l}>{l} · ${Math.round(p).toLocaleString('es-MX')}</option>
            ))}
            <option value="personalizado">Personalizado…</option>
          </select>
        </div>
        <div className="text-xs font-semibold text-right whitespace-nowrap tabular-nums" style={{ minWidth: 70 }}>
          {formatMXN(subtotal)}
        </div>
      </div>
      {modo === 'personalizado' && (
        <div className="mt-1.5 flex items-center gap-1">
          <span className="text-[10px] text-gray-500">Precio $</span>
          <input type="number" min="0" step="0.01" value={r.precio ?? ''}
            onChange={(e) => onEdit({ precio: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
            className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded outline-none focus:border-gray-400 tabular-nums text-right" />
        </div>
      )}
    </div>
  );
}

// ═══ Fetch de sellout por cliente ═══
async function fetchSellout(clienteKey, mm, anioMin, anioMax) {
  const meses = new Set(mm.map((m) => `${m.anio}-${String(m.mes).padStart(2, '0')}`));

  if (clienteKey === 'digitalife') {
    const { data } = await supabase.from('sellout_detalle')
      .select('no_parte,cantidad,fecha')
      .eq('cliente', 'digitalife')
      .gte('fecha', `${anioMin}-01-01`)
      .limit(200000);
    return (data || [])
      .filter((r) => meses.has(String(r.fecha).slice(0, 7)))
      .map((r) => ({ sku: r.no_parte, cantidad: r.cantidad }));
  }

  if (clienteKey === 'pcel') {
    // sellout_pcel tiene vta_mes_1/2/3 (últimos 3 meses cerrados)
    // Uso la fila más reciente por SKU y sumo los 3 meses
    const { data } = await supabase.from('sellout_pcel')
      .select('sku,anio,semana,vta_mes_1,vta_mes_2,vta_mes_3')
      .gte('anio', anioMax - 1)
      .limit(50000);
    // fila más reciente por SKU
    const byKey = new Map();
    for (const r of data || []) {
      const key = (Number(r.anio) || 0) * 100 + (Number(r.semana) || 0);
      const prev = byKey.get(r.sku);
      if (!prev || prev.key < key) byKey.set(r.sku, { key, r });
    }
    const out = [];
    for (const { r } of byKey.values()) {
      const total = (Number(r.vta_mes_1) || 0) + (Number(r.vta_mes_2) || 0) + (Number(r.vta_mes_3) || 0);
      if (total > 0) out.push({ sku: r.sku, cantidad: total });
    }
    return out;
  }

  if (clienteKey === 'dicotech') {
    const { data } = await supabase.from('sellout_general')
      .select('sku,cantidad,anio,mes')
      .eq('mayorista', 'DICOTECH')
      .gte('anio', anioMin)
      .limit(200000);
    return (data || [])
      .filter((r) => meses.has(`${r.anio}-${String(r.mes).padStart(2, '0')}`))
      .map((r) => ({ sku: r.sku, cantidad: r.cantidad }));
  }

  return [];
}
