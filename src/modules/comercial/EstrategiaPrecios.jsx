import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Activity, Search, X, TrendingUp, TrendingDown, AlertTriangle, Tag, Download, ChevronDown, Check,
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import {
  BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';

const MESES_LBL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const PRECIO_BAJO_KEY = 'Precio bajo facturado';
const LISTAS_MOSTRAR = ['Mayoreo AAA', 'DICOTECH', 'PCEL PROVISIONAL', 'API PROVISIONAL', 'DECME PROVISIONAL'];
const OPCIONES_LISTAS = [PRECIO_BAJO_KEY, ...LISTAS_MOSTRAR];
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

function MultiSelect({ label, options, selected, onChange, width = 180 }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const isAll = selected.size === 0;
  const summary = isAll ? `${label}: todas` : `${label}: ${selected.size}`;
  const toggle = (v) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange(next);
  };
  return (
    <div className="relative" ref={ref} style={{ width }}>
      <button onClick={() => setOpen((o) => !o)}
        className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white flex items-center justify-between gap-2 hover:border-gray-300">
        <span className="truncate text-gray-700">{summary}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-auto">
          <div className="flex items-center justify-between px-2 py-1.5 text-[11px] border-b border-gray-100 sticky top-0 bg-white">
            <button className="text-blue-600 hover:underline" onClick={() => onChange(new Set(options))}>Todas</button>
            <button className="text-gray-500 hover:underline" onClick={() => onChange(new Set())}>Limpiar</button>
          </div>
          {options.map((o) => {
            const sel = selected.has(o);
            return (
              <button key={o} onClick={() => toggle(o)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-gray-50 text-left">
                <span className={`w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 ${sel ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                  {sel && <Check className="w-3 h-3 text-white" />}
                </span>
                <span className="truncate">{o}</span>
              </button>
            );
          })}
          {options.length === 0 && <div className="px-2 py-2 text-xs text-gray-400">Sin opciones</div>}
        </div>
      )}
    </div>
  );
}

export default function EstrategiaPrecios() {
  const [loading, setLoading] = useState(true);
  const [roadmap, setRoadmap] = useState([]);
  const [precios, setPrecios] = useState([]);
  const [preciosBajos, setPreciosBajos] = useState([]);
  const [promos, setPromos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [marcaSel, setMarcaSel] = useState(new Set());
  const [categoriaSel, setCategoriaSel] = useState(new Set());
  const [roadmapSel, setRoadmapSel] = useState(new Set());
  const [listasSel, setListasSel] = useState(new Set(OPCIONES_LISTAS));
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
  // Un SKU puede tener varias promos activas al mismo tiempo (Sell Out mensual
  // + Back to School, etc.). Se combinan multiplicativamente: (1-p1)*(1-p2).
  const promoMap = useMemo(() => {
    const m = new Map();
    for (const p of promos) {
      if (!m.has(p.sku)) m.set(p.sku, { promos: [], factorNeto: 1 });
      const it = m.get(p.sku);
      it.promos.push(p);
      it.factorNeto *= (1 - Number(p.promo_pct));
    }
    for (const [, it] of m) {
      it.promo_pct_efectivo = 1 - it.factorNeto;
      it.campania_principal = it.promos.map((p) => p.campania).join(' + ');
      it.promo_pct = it.promo_pct_efectivo;
      it.campania = it.promos.length === 1
        ? it.promos[0].campania
        : `${it.promos.length} promos activas`;
    }
    return m;
  }, [promos]);
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
        if (marcaSel.size > 0 && !marcaSel.has(r.marca)) return false;
        if (categoriaSel.size > 0 && !categoriaSel.has(r.categoria)) return false;
        if (roadmapSel.size > 0 && !roadmapSel.has(r.rdmp)) return false;
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
  }, [roadmap, preciosMap, bajoMap, promoMap, busqueda, marcaSel, categoriaSel, roadmapSel]);

  const listasVisibles = useMemo(
    () => LISTAS_MOSTRAR.filter((l) => listasSel.has(l)),
    [listasSel]
  );
  const verPrecioBajo = listasSel.has(PRECIO_BAJO_KEY);

  const exportarExcel = () => {
    const incluyeAAA = listasVisibles.includes('Mayoreo AAA');
    const otrasListas = listasVisibles.filter((l) => l !== 'Mayoreo AAA');

    const HEADERS_BASE = ['Marca', 'SKU', 'Descripción', 'Categoría', 'Roadmap'];
    const HEADERS_BAJO = verPrecioBajo
      ? ['Precio Bajo Facturado', 'Cliente Precio Bajo', 'Piezas Precio Bajo']
      : [];
    const HEADERS_AAA = incluyeAAA
      ? ['Mayoreo AAA (lista)', 'Descuento %', 'Campañas activas', 'Mayoreo AAA (neto)']
      : [];
    const HEADERS_OTRAS = otrasListas.map((l) => LISTAS_LBL[l]);
    const HEADERS = [...HEADERS_BASE, ...HEADERS_BAJO, ...HEADERS_AAA, ...HEADERS_OTRAS];
    const nCols = HEADERS.length;

    const iBajoPrecio = verPrecioBajo ? HEADERS_BASE.length : -1;
    const iBajoCliente = verPrecioBajo ? HEADERS_BASE.length + 1 : -1;
    const iBajoPiezas = verPrecioBajo ? HEADERS_BASE.length + 2 : -1;
    const aaaStart = HEADERS_BASE.length + HEADERS_BAJO.length;
    const iAAAlista  = incluyeAAA ? aaaStart : -1;
    const iDctoPct   = incluyeAAA ? aaaStart + 1 : -1;
    const iCampanias = incluyeAAA ? aaaStart + 2 : -1;
    const iAAANeto   = incluyeAAA ? aaaStart + 3 : -1;
    const iOtrasInicio = aaaStart + HEADERS_AAA.length;

    const rowsData = filas.map((r) => {
      const p = r.precios || {};
      const promo = r.promo;
      const precioAAA = p['Mayoreo AAA'] ?? null;
      const dctoPct = promo ? Number(promo.promo_pct) : null;
      const precioAAAneto = promo && precioAAA != null ? precioAAA * (1 - dctoPct) : precioAAA;
      const campanias = promo ? (promo.promos || []).map((x) => `${x.campania} (${(Number(x.promo_pct) * 100).toFixed(1)}%)`).join(' + ') : '';
      const base = [r.marca || '', r.sku || '', r.descripcion || '', r.categoria || '', r.rdmp || ''];
      const bajo = verPrecioBajo ? [r.bajo?.precio_bajo ?? null, r.bajo?.cliente_bajo ?? '', r.bajo?.piezas_bajo ?? null] : [];
      const aaa = incluyeAAA ? [precioAAA, dctoPct, campanias, precioAAAneto] : [];
      const otras = otrasListas.map((l) => p[l] ?? null);
      return [...base, ...bajo, ...aaa, ...otras];
    });

    const hoy = new Date();
    const tituloExcel = `Lista de Precios ${MESES_LARGO[hoy.getMonth()]} ${hoy.getFullYear()}`;

    const aoa = [
      [tituloExcel, ...Array(nCols - 1).fill('')],
      HEADERS,
      ...rowsData,
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    const blackHeader = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    };
    const titleStyle = {
      ...blackHeader,
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 14 },
    };

    for (let c = 0; c < nCols; c++) {
      const titleAddr = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[titleAddr]) ws[titleAddr] = { v: '', t: 's' };
      ws[titleAddr].s = titleStyle;
      const headAddr = XLSX.utils.encode_cell({ r: 1, c });
      if (ws[headAddr]) ws[headAddr].s = blackHeader;
    }
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: nCols - 1 } }];
    ws['!rows'] = [{ hpt: 26 }, { hpt: 32 }];

    const moneyFmt = '"$"#,##0';
    const pctFmt = '0.0%';
    const moneyCols = new Set();
    if (verPrecioBajo) moneyCols.add(iBajoPrecio);
    if (incluyeAAA) { moneyCols.add(iAAAlista); moneyCols.add(iAAANeto); }
    for (let k = 0; k < otrasListas.length; k++) moneyCols.add(iOtrasInicio + k);

    for (let i = 0; i < rowsData.length; i++) {
      const rowIdx = i + 2;
      const hasPromo = incluyeAAA && rowsData[i][iCampanias] !== '';
      for (let c = 0; c < nCols; c++) {
        const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
        const cell = ws[addr];
        if (!cell) continue;
        cell.s = cell.s || {};
        if (moneyCols.has(c)) cell.z = moneyFmt;
        if (c === iDctoPct) cell.z = pctFmt;
        if (c === iBajoPiezas && cell.v != null) cell.z = '#,##0';
        if (hasPromo && incluyeAAA && (c === iAAAlista || c === iDctoPct || c === iCampanias || c === iAAANeto)) {
          cell.s.fill = { patternType: 'solid', fgColor: { rgb: 'DCFCE7' } };
          if (c === iAAANeto) cell.s.font = { bold: true, color: { rgb: '14532D' } };
        }
      }
    }

    const baseWidths = [10, 12, 45, 14, 9];
    const bajoWidths = verPrecioBajo ? [14, 22, 10] : [];
    const aaaWidths = incluyeAAA ? [14, 10, 40, 16] : [];
    const otrasWidths = otrasListas.map(() => 10);
    ws['!cols'] = [...baseWidths, ...bajoWidths, ...aaaWidths, ...otrasWidths].map((w) => ({ wch: w }));
    ws['!freeze'] = { xSplit: 0, ySplit: 2 };
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 1, c: 0 }, e: { r: rowsData.length + 1, c: nCols - 1 } }) };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lista de Precios');
    const nombreArchivo = `${tituloExcel}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
  };

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
        <MultiSelect label="Marcas" options={marcasOpciones} selected={marcaSel} onChange={setMarcaSel} width={160} />
        <MultiSelect label="Categorías" options={categoriasOpciones} selected={categoriaSel} onChange={setCategoriaSel} width={180} />
        <MultiSelect label="Roadmap" options={roadmapOpciones} selected={roadmapSel} onChange={setRoadmapSel} width={140} />
        <MultiSelect label="Listas" options={OPCIONES_LISTAS} selected={listasSel} onChange={setListasSel} width={180} />
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-gray-500">
          {fmtInt(filas.length)} SKUs en orden del roadmap
        </span>
        <button
          onClick={exportarExcel}
          disabled={filas.length === 0}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed">
          <Download className="w-3.5 h-3.5" />
          Exportar Excel ({fmtInt(filas.length)} filas)
        </button>
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
                  ...(verPrecioBajo ? [{ label: 'Precio bajo\nfacturado', cls: 'text-right' }] : []),
                  ...listasVisibles.map((l) => ({ label: LISTAS_LBL[l], cls: 'text-right' })),
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
                      {verPrecioBajo && (
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
                      )}
                      {listasVisibles.map((l) => {
                        if (l === 'Mayoreo AAA') {
                          return (
                            <td key={l} className="py-1.5 px-2 text-right whitespace-nowrap"
                              style={promo ? { background: PALETTE.emerald.bg } : undefined}>
                              {precioAAA != null ? (
                                <>
                                  <div className="font-semibold" style={{ color: promo ? PALETTE.emerald.text : '#1f2937' }}>
                                    {fmtMoney(precioAAAneto)}
                                  </div>
                                  {promo && (
                                    <div className="flex flex-col items-end gap-0.5 mt-0.5"
                                      title={(promo.promos || []).map((p) => `${p.campania}: ${Math.round(Number(p.promo_pct) * 100)}%`).join('\n')}>
                                      <span className="inline-block text-[9px] font-semibold px-1 py-0.5 rounded"
                                        style={{ background: PALETTE.emerald.mid, color: '#fff' }}>
                                        −{(Number(promo.promo_pct) * 100).toFixed(1)}%
                                      </span>
                                      <span className="text-[9px] text-gray-500 line-through">{fmtMoney(precioAAA)}</span>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          );
                        }
                        return (
                          <td key={l} className="py-1.5 px-2 text-right text-gray-600 whitespace-nowrap">
                            {r.precios[l] != null ? fmtMoney(r.precios[l]) : <span className="text-gray-400">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                    {abierto && (
                      <tr>
                        <td colSpan={4 + (verPrecioBajo ? 1 : 0) + listasVisibles.length} style={{ padding: 0, background: '#F8FAFC' }}>
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
      const [fact, preciosHist, promosHist] = await Promise.all([
        fetchAll(
          'facturacion_clientes',
          'anio,mes,cliente_nombre,piezas,monto,canal',
          (q) => q.eq('sku', sku.sku).in('anio', [anio, anio - 1])
        ),
        fetchAll(
          'precios_sku',
          'anio,mes,lista,precio',
          (q) => q.eq('sku', sku.sku).gte('anio', anio - 1)
        ),
        fetchAll(
          'promos_temporada',
          'anio,mes,campania,promo_pct',
          (q) => q.eq('sku', sku.sku).order('anio', { ascending: false }).order('mes', { ascending: false })
        ),
      ]);
      setDatos({ fact, preciosHist, promosHist });
      setCargando(false);
    })();
  }, [sku.sku, anio]);

  const analisis = useMemo(() => {
    if (!datos) return null;
    const { fact, preciosHist, promosHist } = datos;

    const serieMens = Array.from({ length: 12 }, (_, i) => ({ mes: MESES_LBL[i], piezas: 0, monto: 0, precio: null }));
    fact.filter((f) => Number(f.anio) === anio).forEach((f) => {
      const m = Number(f.mes) - 1;
      if (m < 0 || m > 11) return;
      serieMens[m].piezas += Number(f.piezas) || 0;
      serieMens[m].monto  += Number(f.monto) || 0;
    });
    preciosHist.filter((p) => Number(p.anio) === anio && p.lista === 'Mayoreo AAA').forEach((p) => {
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
    const clientesAll = Array.from(clientesMap.values())
      .filter((c) => c.piezas > 0)
      .map((c) => {
        const precioProm = c.piezas > 0 ? c.monto / c.piezas : 0;
        return {
          ...c,
          precioProm,
          deltaLista: precioLista > 0 ? ((precioProm - precioLista) / precioLista) * 100 : null,
        };
      })
      .sort((a, b) => b.piezas - a.piezas);
    const clientes = clientesAll.slice(0, 5);
    const clientesRestantes = clientesAll.slice(5);
    const clienteVolumen = clientes[0];

    const mesActual = new Date().getMonth() + 1;
    const anioActual = new Date().getFullYear();
    const mesMax = (anio === anioActual && mesActual > 1) ? mesActual - 1 : (anio === anioActual ? 1 : 12);
    const piezasMesActual = serieMens[mesMax - 1]?.piezas || 0;
    const piezasPrev3m = [mesMax - 2, mesMax - 3, mesMax - 4]
      .filter((i) => i >= 0)
      .reduce((s, i) => s + (serieMens[i]?.piezas || 0), 0);
    const promPrev3m = piezasPrev3m > 0 ? piezasPrev3m / 3 : 0;
    const piezasYTD = serieMens.reduce((s, r) => s + r.piezas, 0);
    const montoYTD = serieMens.reduce((s, r) => s + r.monto, 0);

    const promosLista = [];
    const listasSet = new Set(preciosHist.map((p) => p.lista));
    for (const listaNm of listasSet) {
      const secuencia = preciosHist
        .filter((p) => p.lista === listaNm)
        .map((p) => ({ anio: Number(p.anio), mes: Number(p.mes), precio: Number(p.precio) }))
        .sort((a, b) => a.anio - b.anio || a.mes - b.mes);
      for (let i = 1; i < secuencia.length; i++) {
        const prev = secuencia[i - 1];
        const cur  = secuencia[i];
        if (prev.precio > 0 && cur.precio < prev.precio) {
          const dif = (prev.precio - cur.precio) / prev.precio;
          if (dif >= 0.02) {
            promosLista.push({
              anio: cur.anio, mes: cur.mes,
              campania: `Baja de lista · ${LISTAS_LBL[listaNm] || listaNm}`,
              promo_pct: dif,
              tipo: 'lista',
            });
          }
        }
      }
    }

    const promosUnificadas = [
      ...promosHist.map((p) => ({ ...p, tipo: 'temporada' })),
      ...promosLista,
    ].sort((a, b) => (b.anio - a.anio) || (b.mes - a.mes));

    const anioActual2 = new Date().getFullYear();
    const mesActual2  = new Date().getMonth() + 1;
    const mesCorte = anio === anioActual2 ? mesActual2 : 12;
    const primerMesConDato = serieMens.findIndex((r) => (r.piezas > 0) || r.precio != null);
    let ultimoMesConDato = -1;
    for (let i = mesCorte - 1; i >= 0; i--) {
      if (serieMens[i].piezas > 0 || serieMens[i].precio != null) { ultimoMesConDato = i; break; }
    }
    const serieMensRecortada = primerMesConDato >= 0 && ultimoMesConDato >= 0
      ? serieMens.slice(primerMesConDato, ultimoMesConDato + 1)
      : [];

    return {
      serieMens: serieMensRecortada, clientes, clientesRestantes, clienteVolumen,
      mesMax,
      piezasMesActual, promPrev3m,
      deltaVsPrev3m: promPrev3m > 0 ? ((piezasMesActual - promPrev3m) / promPrev3m) * 100 : null,
      piezasYTD, montoYTD,
      promosHist: promosUnificadas.slice(0, 6),
      promosCount: promosUnificadas.length,
    };
  }, [datos, anio, precios]);

  const precioAAA = precios['Mayoreo AAA'];
  const precioAAAneto = promo && precioAAA != null
    ? precioAAA * (1 - Number(promo.promo_pct))
    : precioAAA;

  return (
    <div className="border-t border-b border-gray-200 bg-white">
      <div className="px-3 py-1.5 flex items-center justify-between border-b border-gray-100">
        <div className="min-w-0 text-[10px]" style={{ color: PALETTE.blue.mid }}>
          <span className="uppercase tracking-widest">{sku.categoria || 'Sin categoría'} · {sku.familia || '—'}</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
          <X className="w-3.5 h-3.5 text-gray-500" />
        </button>
      </div>

      {cargando ? (
        <div className="p-6 text-center text-gray-400 text-xs">
          <Activity className="w-5 h-5 mx-auto mb-1" /> Cargando…
        </div>
      ) : (
        <div className="p-3 grid grid-cols-3 gap-4">

          <div>
            <div className="text-[9px] uppercase tracking-wider text-gray-500 mb-1.5">Precios</div>
            {bajo && (
              <div className="mb-1.5" style={{ borderLeft: `2px solid ${PALETTE.red.mid}`, paddingLeft: 8 }}>
                <div className="text-[9px]" style={{ color: PALETTE.red.mid }}>BAJO FACTURADO</div>
                <div className="text-[15px] font-medium leading-tight" style={{ color: PALETTE.red.text }}>
                  {fmtMoney(bajo.precio_bajo)}
                </div>
                <div className="text-[9px] text-gray-500">{bajo.cliente_bajo} · {fmtInt(bajo.piezas_bajo)} pz</div>
              </div>
            )}
            {precioAAA != null && (
              <div className="mb-1.5" style={{ borderLeft: `2px solid ${PALETTE.blue.mid}`, paddingLeft: 8 }}>
                <div className="text-[9px]" style={{ color: PALETTE.blue.mid }}>
                  MAYOREO AAA
                  {promo && (
                    <span className="ml-1 px-1 py-0.5 rounded" style={{ background: PALETTE.amber.bg, color: PALETTE.amber.mid, fontSize: 8 }}>
                      {promo.campania.slice(0, 12)} · {Math.round(Number(promo.promo_pct) * 100)}%
                    </span>
                  )}
                </div>
                <div className="text-[15px] font-medium leading-tight">
                  {fmtMoney(precioAAAneto)}
                  {promo && (
                    <span className="ml-1.5 text-[10px] text-gray-400 line-through font-normal">{fmtMoney(precioAAA)}</span>
                  )}
                </div>
              </div>
            )}
            {['DICOTECH', 'PCEL PROVISIONAL', 'API PROVISIONAL', 'DECME PROVISIONAL'].map((l) => (
              precios[l] != null ? (
                <div key={l} className="flex justify-between items-baseline py-0.5 border-b border-gray-50 text-[11px]">
                  <span className="text-gray-600">{LISTAS_LBL[l]}</span>
                  <span className="font-medium">{fmtMoney(precios[l])}</span>
                </div>
              ) : null
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[9px] uppercase tracking-wider text-gray-500">Evolución · {anio}</div>
              <div className="flex items-center gap-1.5 text-[9px] text-gray-500">
                <span><span style={{ display:'inline-block', width:8, height:2, background: PALETTE.blue.mid, verticalAlign:'middle', marginRight:2 }} />Precio</span>
                <span><span style={{ display:'inline-block', width:8, height:8, background: PALETTE.amber.soft, verticalAlign:'middle', marginRight:2 }} />Piezas</span>
              </div>
            </div>
            {analisis && analisis.serieMens.length > 0 ? (
              <ResponsiveContainer width="100%" height={130}>
                <ComposedChart data={analisis.serieMens} margin={{ top: 4, right: 2, left: -28, bottom: 0 }}>
                  <XAxis dataKey="mes" tick={{ fontSize: 9, fill: '#888' }} interval={0} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" hide domain={['dataMin - 50', 'dataMax + 50']} />
                  <YAxis yAxisId="right" orientation="right" hide />
                  <Tooltip formatter={(v, name) => name === 'Precio' ? fmtMoney(v) : `${fmtInt(v)} pz`}
                    labelStyle={{ fontSize: 10 }} contentStyle={{ fontSize: 10, padding: 6 }} />
                  <Bar yAxisId="right" dataKey="piezas" name="Piezas" fill={PALETTE.amber.soft} radius={[2, 2, 0, 0]} />
                  <Line yAxisId="left" type="monotone" dataKey="precio" name="Precio"
                    stroke={PALETTE.blue.mid} strokeWidth={2} dot={{ r: 2.5, fill: PALETTE.blue.mid }} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-[10px] text-gray-400 text-center py-6">Sin datos históricos</div>
            )}
            {analisis && (
              <div className="mt-2 pt-2 border-t border-gray-100 text-[11px] space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Sellout {MESES_LBL[analisis.mesMax - 1]}</span>
                  <span>
                    <span className="font-medium">{fmtInt(analisis.piezasMesActual)} pz</span>
                    {analisis.deltaVsPrev3m != null && (
                      <span className={`ml-1.5 text-[10px] ${
                        analisis.deltaVsPrev3m >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        {fmtPctDelta(analisis.deltaVsPrev3m)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">YTD</span>
                  <span className="font-medium">{fmtInt(analisis.piezasYTD)} pz · {fmtCompact(analisis.montoYTD)}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="text-[9px] uppercase tracking-wider text-gray-500 mb-1.5">Top clientes · YTD</div>
            {!analisis || analisis.clientes.length === 0 ? (
              <div className="text-[10px] text-gray-400">Sin facturación este año.</div>
            ) : (
              <>
                {analisis.clientes.map((c, i) => {
                  const critico = c.deltaLista != null && c.deltaLista < -10;
                  return (
                    <div key={c.cliente} className="flex justify-between items-baseline text-[11px] py-0.5 border-b border-gray-50">
                      <span className="text-gray-800 truncate" style={{ maxWidth: 130 }} title={c.cliente}>
                        <span className="text-gray-400 mr-1">{i + 1}.</span>{c.cliente}
                      </span>
                      <span className="whitespace-nowrap">
                        <span className="text-gray-700">{fmtInt(c.piezas)} pz</span>
                        {c.deltaLista != null && (
                          <span className={`ml-1.5 text-[10px] ${
                            critico ? 'text-rose-700 font-medium'
                            : c.deltaLista < 0 ? 'text-gray-500'
                            : 'text-emerald-700'
                          }`}>
                            {fmtPctDelta(c.deltaLista)}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
                {analisis.clientesRestantes.length > 0 && (
                  <div className="text-[10px] text-gray-400 text-center py-1">
                    + {analisis.clientesRestantes.length} más · {fmtInt(analisis.clientesRestantes.reduce((s, c) => s + c.piezas, 0))} pz
                  </div>
                )}
              </>
            )}

            <div className="text-[9px] uppercase tracking-wider text-gray-500 mt-3 mb-1.5">
              Promos aplicadas {analisis && analisis.promosCount > 0 && <span className="normal-case tracking-normal text-gray-400">· {analisis.promosCount}</span>}
            </div>
            {!analisis || analisis.promosHist.length === 0 ? (
              <div className="text-[10px] text-gray-400">Sin promociones registradas.</div>
            ) : (
              analisis.promosHist.map((p, i) => (
                <div key={i} className="flex justify-between items-baseline text-[11px] py-0.5 border-b border-gray-50">
                  <span>
                    <span className="text-gray-500 mr-1">{MESES_LBL[Number(p.mes) - 1]} {String(p.anio).slice(-2)}</span>
                    <span className={p.tipo === 'lista' ? 'text-blue-700' : 'text-gray-800'}>
                      {p.campania}
                    </span>
                  </span>
                  <span className="text-amber-800 font-medium">{Math.round(Number(p.promo_pct) * 100)}%</span>
                </div>
              ))
            )}

            {analisis && analisis.clienteVolumen && analisis.clienteVolumen.deltaLista != null && analisis.clienteVolumen.deltaLista < -8 && (
              <div className="mt-3 rounded px-2 py-1.5 flex items-center gap-1.5" style={{ background: '#FEF3C7', color: '#78350F' }}>
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <div className="text-[10px]">
                  <span className="font-medium">{analisis.clienteVolumen.cliente}</span> pagó {Math.abs(analisis.clienteVolumen.deltaLista).toFixed(1)}% menos que Mayoreo AAA
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
