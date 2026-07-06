import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Activity, Search, X, TrendingUp, TrendingDown, AlertTriangle, Tag,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';

const MESES_LBL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const LISTAS_MOSTRAR = ['Mayoreo AAA', 'DICOTECH', 'PCEL PROVISIONAL', 'API PROVISIONAL', 'DECME PROVISIONAL'];
const LISTAS_LBL = {
  'Mayoreo AAA':       'Mayoreo AAA',
  'DICOTECH':          'DICOTECH',
  'PCEL PROVISIONAL':  'PCEL',
  'API PROVISIONAL':   'API',
  'DECME PROVISIONAL': 'DECME',
};

const PALETTE = {
  blue:   { bg: '#E6F1FB', text: '#042C53', mid: '#185FA5', soft: '#B5D4F4' },
  amber:  { bg: '#FAEEDA', text: '#412402', mid: '#854F0B', soft: '#FAC775' },
  teal:   { bg: '#E1F5EE', text: '#04342C', mid: '#0F6E56' },
  red:    { bg: '#FCEBEB', text: '#501313', mid: '#A32D2D' },
  emerald:{ bg: '#DCFCE7', text: '#14532D', mid: '#166534' },
};

const ROADMAP_COLOR = {
  RMI:  { bg:'#E1F5EE', text:'#085041' },
  RML:  { bg:'#EEEDFE', text:'#3C3489' },
  2026: { bg:'#FAEEDA', text:'#854F0B' },
  RMS:  { bg:'#FBEAF0', text:'#993556' },
};

const fmtMoney = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(Number(n));
  return (Number(n) < 0 ? '-$' : '$') + a.toLocaleString('es-MX', { maximumFractionDigits: 0 });
};
const fmtCompact = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(Number(n));
  const sign = Number(n) < 0 ? '-' : '';
  if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(0) + 'K';
  return sign + '$' + Math.round(a);
};
const fmtInt = (n) => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('es-MX');
const fmtPctDelta = (n) => n == null || isNaN(n) ? '—' : (n >= 0 ? '+' : '') + n.toFixed(1) + '%';

const PAGE = 1000;
async function fetchAll(table, select, extra = (q) => q) {
  let acc = []; let from = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(from, from + PAGE - 1);
    q = extra(q);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    acc = acc.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return acc;
}

export default function EstrategiaPrecios() {
  const [loading, setLoading] = useState(true);
  const [roadmap, setRoadmap] = useState([]);
  const [precios, setPrecios] = useState([]);
  const [preciosBajos, setPreciosBajos] = useState([]);
  const [promos, setPromos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [marcaFiltro, setMarcaFiltro] = useState('TODAS');
  const [categoriaFiltro, setCategoriaFiltro] = useState('TODAS');
  const [roadmapFiltro, setRoadmapFiltro] = useState('TODOS');
  const [skuAbierto, setSkuAbierto] = useState(null);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const now = new Date();
      const [rm, pr, pb, pm] = await Promise.all([
        fetchAll('roadmap_sku', 'sku,marca,categoria,familia,rdmp,descripcion,sort_order', (q) => q.order('sort_order', { ascending: true, nullsFirst: false })),
        fetchAll('v_estrategia_precios_lista', 'sku,lista,precio,anio,mes'),
        fetchAll('v_estrategia_precios_bajo', 'sku,cliente_bajo,precio_bajo,piezas_bajo'),
        fetchAll('promos_temporada', 'sku,campania,promo_pct,anio,mes,descripcion', (q) => q.eq('anio', now.getFullYear()).eq('mes', now.getMonth() + 1)),
      ]);
      setRoadmap(rm);
      setPrecios(pr);
      setPreciosBajos(pb);
      setPromos(pm);
      setLoading(false);
    })();
  }, []);

  const bajoMap = useMemo(() => new Map(preciosBajos.map((p) => [p.sku, p])), [preciosBajos]);
  const promoMap = useMemo(() => new Map(promos.map((p) => [p.sku, p])), [promos]);
  const preciosMap = useMemo(() => {
    const m = new Map();
    for (const p of precios) {
      if (!m.has(p.sku)) m.set(p.sku, {});
      m.get(p.sku)[p.lista] = Number(p.precio);
    }
    return m;
  }, [precios]);

  const marcasOpciones = useMemo(() => Array.from(new Set(roadmap.map((r) => r.marca).filter(Boolean))).sort(), [roadmap]);
  const categoriasOpciones = useMemo(() => Array.from(new Set(roadmap.map((r) => r.categoria).filter(Boolean))).sort(), [roadmap]);
  const roadmapOpciones = useMemo(() => Array.from(new Set(roadmap.map((r) => r.rdmp).filter(Boolean))).sort(), [roadmap]);

  const filas = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    return roadmap
      .filter((r) => {
        if (marcaFiltro !== 'TODAS' && r.marca !== marcaFiltro) return false;
        if (categoriaFiltro !== 'TODAS' && r.categoria !== categoriaFiltro) return false;
        if (roadmapFiltro !== 'TODOS' && r.rdmp !== roadmapFiltro) return false;
        if (q) {
          const hay = (String(r.sku || '').toUpperCase().includes(q)
                    || String(r.descripcion || '').toUpperCase().includes(q));
          if (!hay) return false;
        }
        return true;
      })
      .map((r) => ({
        ...r,
        precios: preciosMap.get(r.sku) || {},
        bajo: bajoMap.get(r.sku),
        promo: promoMap.get(r.sku),
      }));
  }, [roadmap, preciosMap, bajoMap, promoMap, busqueda, marcaFiltro, categoriaFiltro, roadmapFiltro]);

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-400">
        <Activity className="w-10 h-10 mx-auto mb-3" />
        Cargando estrategia de precios…
      </div>
    );
  }

  return (
    <div className="max-w-none mx-auto p-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4 px-1">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">Dirección Comercial</p>
          <h2 className="text-2xl font-medium text-gray-800">Estrategia de precios</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {fmtInt(roadmap.length)} SKUs · {precios.length} precios cargados · {promos.length} promos vigentes
          </p>
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <div className="flex-1 flex items-center gap-2 px-3 bg-white border border-gray-200 rounded-lg h-10">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar SKU o descripción (AC-943154, monitor SP270…)"
            className="flex-1 outline-none text-sm bg-transparent"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <select value={marcaFiltro} onChange={(e) => setMarcaFiltro(e.target.value)}
          className="h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="TODAS">Todas las marcas</option>
          {marcasOpciones.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}
          className="h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="TODAS">Todas las categorías</option>
          {categoriasOpciones.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={roadmapFiltro} onChange={(e) => setRoadmapFiltro(e.target.value)}
          className="h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="TODOS">Roadmap: todos</option>
          {roadmapOpciones.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div className="flex items-baseline justify-between px-1">
        <span className="text-xs text-gray-500">
          {fmtInt(filas.length)} SKUs en orden del roadmap
        </span>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
          <table className="w-full text-[11px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr className="text-gray-500 bg-gray-50">
                {[
                  { label: 'Marca',        cls: 'text-left'  },
                  { label: 'SKU',          cls: 'text-left'  },
                  { label: 'Descripción',  cls: 'text-left'  },
                  { label: 'Roadmap',      cls: 'text-center' },
                  { label: 'Precio bajo\nfacturado', cls: 'text-right' },
                  ...LISTAS_MOSTRAR.map((l) => ({ label: LISTAS_LBL[l], cls: 'text-right' })),
                ].map((h, i) => (
                  <th key={i}
                    className={`${h.cls} py-1.5 px-2 font-medium uppercase tracking-wider text-[9px] whitespace-pre-line`}
                    style={{ position: 'sticky', top: 0, background: '#F9FAFB', zIndex: 1, borderBottom: '1px solid #E5E7EB' }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((r) => {
                const rmapPal = ROADMAP_COLOR[r.rdmp] || { bg:'#F1EFE8', text:'#2C2C2A' };
                const promo = r.promo;
                const precioAAA = r.precios['Mayoreo AAA'];
                const precioAAAneto = promo && precioAAA != null
                  ? precioAAA * (1 - Number(promo.promo_pct))
                  : precioAAA;
                const abierto = skuAbierto === r.sku;
                return (
                  <React.Fragment key={r.sku}>
                    <tr
                      onClick={() => setSkuAbierto(abierto ? null : r.sku)}
                      className={`border-t border-gray-100 cursor-pointer ${abierto ? 'bg-blue-50/60' : 'hover:bg-gray-50'}`}>
                      <td className="py-1.5 px-2 text-gray-600 whitespace-nowrap">{r.marca || '—'}</td>
                      <td className="py-1.5 px-2 font-mono text-gray-700 whitespace-nowrap">{r.sku}</td>
                      <td className="py-1.5 px-2 text-gray-800 truncate" style={{ maxWidth: 320 }} title={r.descripcion}>
                        {r.descripcion || '—'}
                      </td>
                      <td className="py-1.5 px-2 text-center whitespace-nowrap">
                        {r.rdmp && (
                          <span className="text-[9px] font-medium px-1 py-0.5 rounded"
                            style={{ background: rmapPal.bg, color: rmapPal.text }}>
                            {r.rdmp}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-right whitespace-nowrap">
                        {r.bajo ? (
                          <>
                            <div className="font-medium text-rose-800">{fmtMoney(r.bajo.precio_bajo)}</div>
                            <div className="text-[9px] text-gray-500 truncate" style={{ maxWidth: 120 }} title={r.bajo.cliente_bajo}>
                              {r.bajo.cliente_bajo} · {fmtInt(r.bajo.piezas_bajo)} pz
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-right whitespace-nowrap">
                        {precioAAA != null ? (
                          <>
                            <div className="font-medium text-gray-800">{fmtMoney(precioAAAneto)}</div>
                            {promo && (
                              <>
                                <div className="inline-block text-[9px] font-medium px-1 py-0.5 mt-0.5 rounded"
                                  style={{ background: PALETTE.amber.bg, color: PALETTE.amber.mid }}>
                                  {promo.campania.slice(0, 10)} · {Math.round(Number(promo.promo_pct) * 100)}%
                                </div>
                                <div className="text-[9px] text-gray-400 line-through">{fmtMoney(precioAAA)}</div>
                              </>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      {['DICOTECH', 'PCEL PROVISIONAL', 'API PROVISIONAL', 'DECME PROVISIONAL'].map((l) => (
                        <td key={l} className="py-1.5 px-2 text-right text-gray-600 whitespace-nowrap">
                          {r.precios[l] != null ? fmtMoney(r.precios[l]) : <span className="text-gray-400">—</span>}
                        </td>
                      ))}
                    </tr>
                    {abierto && (
                      <tr>
                        <td colSpan={5 + LISTAS_MOSTRAR.length} style={{ padding: 0, background: '#F8FAFC' }}>
                          <DetalleSKU
                            sku={r}
                            promo={promo}
                            bajo={r.bajo}
                            precios={r.precios}
                            onClose={() => setSkuAbierto(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DetalleSKU({ sku, promo, bajo, precios, onClose }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const anio = new Date().getFullYear();

  useEffect(() => {
    (async () => {
      setCargando(true);
      const fact = await fetchAll(
        'facturacion_clientes',
        'anio,mes,cliente_nombre,piezas,monto,canal',
        (q) => q.eq('sku', sku.sku).in('anio', [anio, anio - 1])
      );
      const preciosHist = await fetchAll(
        'precios_sku',
        'anio,mes,lista,precio',
        (q) => q.eq('sku', sku.sku).eq('lista', 'Mayoreo AAA').gte('anio', anio - 1)
      );
      setDatos({ fact, preciosHist });
      setCargando(false);
    })();
  }, [sku.sku, anio]);

  const analisis = useMemo(() => {
    if (!datos) return null;
    const { fact, preciosHist } = datos;

    const serieMens = Array.from({ length: 12 }, (_, i) => ({ mes: MESES_LBL[i], piezas: 0, monto: 0, precio: null }));
    fact.filter((f) => Number(f.anio) === anio).forEach((f) => {
      const m = Number(f.mes) - 1;
      if (m < 0 || m > 11) return;
      serieMens[m].piezas += Number(f.piezas) || 0;
      serieMens[m].monto  += Number(f.monto) || 0;
    });
    preciosHist.filter((p) => Number(p.anio) === anio).forEach((p) => {
      const m = Number(p.mes) - 1;
      if (m >= 0 && m <= 11) serieMens[m].precio = Number(p.precio);
    });
    let ultimoPrecio = null;
    for (let i = 0; i < 12; i++) {
      if (serieMens[i].precio == null) serieMens[i].precio = ultimoPrecio;
      else ultimoPrecio = serieMens[i].precio;
    }

    const clientesMap = new Map();
    fact.filter((f) => Number(f.anio) === anio && f.cliente_nombre).forEach((f) => {
      const k = f.cliente_nombre;
      if (!clientesMap.has(k)) clientesMap.set(k, { cliente: k, piezas: 0, monto: 0, canal: f.canal });
      const it = clientesMap.get(k);
      it.piezas += Number(f.piezas) || 0;
      it.monto  += Number(f.monto) || 0;
    });
    const precioLista = precios['Mayoreo AAA'];
    const clientes = Array.from(clientesMap.values())
      .filter((c) => c.piezas > 0)
      .map((c) => {
        const precioProm = c.piezas > 0 ? c.monto / c.piezas : 0;
        return {
          ...c,
          precioProm,
          deltaLista: precioLista > 0 ? ((precioProm - precioLista) / precioLista) * 100 : null,
        };
      })
      .sort((a, b) => b.piezas - a.piezas)
      .slice(0, 10);

    const clienteVolumen = clientes[0];

    return { serieMens, clientes, clienteVolumen };
  }, [datos, anio, precios]);

  const precioAAA = precios['Mayoreo AAA'];
  const precioAAAneto = promo && precioAAA != null
    ? precioAAA * (1 - Number(promo.promo_pct))
    : precioAAA;

  return (
    <div className="border-t border-b border-gray-200" style={{ background: '#F8FAFC' }}>
      <div>
        <div className="px-4 py-2 flex items-center justify-between" style={{ background: PALETTE.blue.bg }}>
          <div className="min-w-0 text-[11px]" style={{ color: PALETTE.blue.text }}>
            <span className="uppercase tracking-widest text-[9px]" style={{ color: PALETTE.blue.mid }}>
              {sku.categoria || 'Sin categoría'} · {sku.familia || '—'}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/50">
            <X className="w-4 h-4" style={{ color: PALETTE.blue.text }} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <div className="text-xs text-gray-600 mb-2">Precio actual por lista + precio bajo facturado</div>
            <div className="grid grid-cols-6 gap-2">
              <div className="rounded-lg p-2.5" style={{ background: PALETTE.red.bg }}>
                <div className="text-[9px] tracking-widest" style={{ color: PALETTE.red.mid }}>BAJO FACT</div>
                <div className="text-base font-medium mt-1" style={{ color: PALETTE.red.text }}>
                  {bajo ? fmtMoney(bajo.precio_bajo) : '—'}
                </div>
              </div>
              <div className="rounded-lg p-2.5 bg-gray-100">
                <div className="text-[9px] tracking-widest text-gray-600">MAYOREO AAA</div>
                <div className="text-base font-medium mt-1">{precioAAAneto != null ? fmtMoney(precioAAAneto) : '—'}</div>
                {promo && precioAAA != null && (
                  <div className="text-[9px] text-gray-400 line-through">{fmtMoney(precioAAA)}</div>
                )}
              </div>
              {['DICOTECH', 'PCEL PROVISIONAL', 'API PROVISIONAL', 'DECME PROVISIONAL'].map((l) => (
                <div key={l} className="rounded-lg p-2.5 bg-gray-100">
                  <div className="text-[9px] tracking-widest text-gray-600">{LISTAS_LBL[l]}</div>
                  <div className="text-base font-medium mt-1">
                    {precios[l] != null ? fmtMoney(precios[l]) : <span className="text-gray-400">—</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {promo && (
            <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: PALETTE.amber.bg, color: PALETTE.amber.text }}>
              <Tag className="w-4 h-4" style={{ color: PALETTE.amber.mid }} />
              <span className="text-xs">
                <span className="font-medium">Promo activa: {promo.campania}</span> · {Math.round(Number(promo.promo_pct) * 100)}% off en Mayoreo AAA
              </span>
            </div>
          )}

          {cargando ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              <Activity className="w-6 h-6 mx-auto mb-2" /> Cargando histórico…
            </div>
          ) : analisis ? (
            <>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm font-medium text-gray-800 mb-3">
                  Evolución del precio y sellout · {anio}
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <ComposedChart data={analisis.serieMens} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#888' }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10, fill: PALETTE.blue.mid }} width={55}
                      tickFormatter={fmtMoney} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: PALETTE.amber.mid }} width={40}
                      tickFormatter={(v) => fmtInt(v)} />
                    <Tooltip formatter={(v, name) => name === 'Precio' ? fmtMoney(v) : `${fmtInt(v)} pz`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="right" dataKey="piezas" name="Sellout (pz)" fill={PALETTE.amber.soft} radius={[3, 3, 0, 0]} />
                    <Line yAxisId="left" type="monotone" dataKey="precio" name="Precio" stroke={PALETTE.blue.mid} strokeWidth={2.5}
                      dot={{ r: 3, fill: PALETTE.blue.mid }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-800 mb-2">
                  Top clientes por volumen · YTD {anio}
                </div>
                {analisis.clientes.length === 0 ? (
                  <div className="text-xs text-gray-500">Sin facturación registrada este año.</div>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-[24px_1fr_60px_75px_85px_75px] gap-2 py-2 px-3 bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wider">
                      <span>#</span>
                      <span>Cliente</span>
                      <span className="text-right">Piezas</span>
                      <span className="text-right">$ prom</span>
                      <span className="text-right">Total $</span>
                      <span className="text-right">Δ vs lista</span>
                    </div>
                    {analisis.clientes.map((c, i) => {
                      const negativo = c.deltaLista != null && c.deltaLista < 0;
                      const critico  = c.deltaLista != null && c.deltaLista < -10;
                      return (
                        <div key={c.cliente}
                          className="grid grid-cols-[24px_1fr_60px_75px_85px_75px] gap-2 py-2 px-3 text-xs border-t border-gray-100">
                          <span className="text-gray-400">{i + 1}</span>
                          <span className="text-gray-800 truncate" title={c.cliente}>{c.cliente}</span>
                          <span className="text-right text-gray-700">{fmtInt(c.piezas)}</span>
                          <span className={`text-right ${critico ? 'text-rose-700 font-medium' : 'text-gray-700'}`}>
                            {fmtMoney(c.precioProm)}
                          </span>
                          <span className="text-right text-gray-700">{fmtCompact(c.monto)}</span>
                          <span className={`text-right ${
                            critico ? 'text-rose-700 font-medium'
                            : negativo ? 'text-gray-600'
                            : c.deltaLista != null && c.deltaLista > 0 ? 'text-emerald-700'
                            : 'text-gray-400'
                          }`}>
                            {c.deltaLista != null ? fmtPctDelta(c.deltaLista) : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {analisis.clienteVolumen && analisis.clienteVolumen.deltaLista != null && analisis.clienteVolumen.deltaLista < -8 && (
                <div className="rounded-lg px-3 py-2.5 flex items-start gap-2" style={{ background: '#FEF3C7', color: '#78350F' }}>
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-medium">{analisis.clienteVolumen.cliente}</span> pagó {Math.abs(analisis.clienteVolumen.deltaLista).toFixed(1)}% menos que Mayoreo AAA con {fmtInt(analisis.clienteVolumen.piezas)} pz · el mayor volumen del SKU.
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
