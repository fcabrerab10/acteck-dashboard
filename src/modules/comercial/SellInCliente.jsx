import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';
import {
  ShoppingCart, Search, Download, ChevronDown, Check, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import * as XLSX from 'xlsx-js-style';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const CLIENTES_META = {
  dicotech:   { nombre: 'Dicotech',   marca: 'Acteck',              accent: '#0EA5E9', badgeBg: 'bg-sky-50', badgeText: 'text-sky-700', dot: 'bg-sky-500' },
  pcel:       { nombre: 'PCEL',       marca: 'Acteck',              accent: '#0EA5E9', badgeBg: 'bg-sky-50', badgeText: 'text-sky-700', dot: 'bg-sky-500' },
  digitalife: { nombre: 'Digitalife', marca: 'Acteck / Balam Rush', accent: '#0EA5E9', badgeBg: 'bg-sky-50', badgeText: 'text-sky-700', dot: 'bg-sky-500' },
};
const CAT_COLORS = ['#0EA5E9', '#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#94A3B8', '#F97316'];

const ROADMAP_COLOR = {
  RMI:  { bg:'#E1F5EE', text:'#085041' },
  RML:  { bg:'#EEEDFE', text:'#3C3489' },
  2026: { bg:'#FAEEDA', text:'#854F0B' },
  RMS:  { bg:'#FBEAF0', text:'#993556' },
};

const fmtInt = (n) => (n == null || !isFinite(n) ? '—' : Math.round(n).toLocaleString('es-MX'));
const fmtMoneyShort = (n) => {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + Math.round(n);
};

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

function MultiSelect({ label, options, selected, onChange, width = 160 }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const summary = selected.size === 0 ? `${label}: todas` : `${label}: ${selected.size}`;
  const toggle = (v) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange(next);
  };
  return (
    <div className="relative" ref={ref} style={{ width }}>
      <button onClick={() => setOpen((o) => !o)}
        className="w-full h-8 px-2.5 border border-gray-200 rounded-lg text-xs bg-white flex items-center justify-between gap-2 hover:border-gray-300">
        <span className="truncate text-gray-700">{summary}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-auto">
          <div className="flex items-center justify-between px-2 py-1.5 text-[11px] border-b border-gray-100 sticky top-0 bg-white">
            <button className="text-sky-600 hover:underline" onClick={() => onChange(new Set(options))}>Todas</button>
            <button className="text-gray-500 hover:underline" onClick={() => onChange(new Set())}>Limpiar</button>
          </div>
          {options.map((o) => {
            const sel = selected.has(o);
            return (
              <button key={o} onClick={() => toggle(o)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-gray-50 text-left">
                <span className={`w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 ${sel ? 'bg-sky-500 border-sky-500' : 'border-gray-300'}`}>
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

export default function SellInCliente({ clienteKey }) {
  const CLIENTE_KEY = clienteKey;
  const esGlobal = !CLIENTE_KEY;
  const meta = esGlobal
    ? { nombre: 'Dirección Comercial', marca: 'Consolidado de todos los clientes', accent: '#0EA5E9', badgeBg: 'bg-sky-50', badgeText: 'text-sky-700', dot: 'bg-sky-500' }
    : (CLIENTES_META[CLIENTE_KEY] || CLIENTES_META.dicotech);
  const ACCENT = meta.accent;
  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const anioPrev = anioActual - 1;
  const mesActual = hoy.getMonth() + 1;

  const [loading, setLoading] = useState(true);
  const [facturacion, setFacturacion] = useState([]);
  const [roadmap, setRoadmap] = useState([]);
  const [cuotas, setCuotas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [marcaSel, setMarcaSel] = useState(new Set());
  const [roadmapSel, setRoadmapSel] = useState(new Set());
  const [categoriaSel, setCategoriaSel] = useState(new Set());
  const [orden, setOrden] = useState({ col: null, dir: null }); // col: 'promedio' | 'total' | null
  const [skuAbierto, setSkuAbierto] = useState(null);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const facturacionPromise = esGlobal
        ? fetchAll('v_facturacion_global_sku_mes', 'sku,anio,mes,piezas,monto',
            (q) => q.in('anio', [anioPrev, anioActual]))
        : fetchAll('facturacion_clientes', 'sku,anio,mes,piezas,monto',
            (q) => q.eq('cliente_key', CLIENTE_KEY).in('anio', [anioPrev, anioActual]));
      const cuotasPromise = esGlobal
        ? fetchAll('v_cuota_global_mensual', 'mes,anio,cuota_min,cuota_ideal',
            (q) => q.eq('anio', anioActual))
        : fetchAll('cuotas_mensuales', 'mes,anio,cuota_min,cuota_ideal',
            (q) => q.eq('cliente', CLIENTE_KEY).eq('anio', anioActual));
      const [fact, rdmp, ct] = await Promise.all([
        facturacionPromise,
        fetchAll('roadmap_sku', 'sku,marca,descripcion,categoria,familia,rdmp,sort_order'),
        cuotasPromise,
      ]);
      setFacturacion(fact);
      setRoadmap(rdmp);
      setCuotas(ct);
      setLoading(false);
    })();
  }, [anioActual, anioPrev, CLIENTE_KEY, esGlobal]);

  const roadmapMap = useMemo(() => {
    const m = new Map();
    for (const r of roadmap) m.set(r.sku, r);
    return m;
  }, [roadmap]);

  const cuotaPorMes = useMemo(() => {
    const m = new Map();
    for (const c of cuotas) m.set(c.mes, { min: Number(c.cuota_min) || 0, ideal: Number(c.cuota_ideal) || 0 });
    return m;
  }, [cuotas]);

  const cuotaAnual = useMemo(() => {
    let min = 0, ideal = 0;
    for (const c of cuotas) { min += Number(c.cuota_min) || 0; ideal += Number(c.cuota_ideal) || 0; }
    return { min, ideal };
  }, [cuotas]);

  const mensualPorAnio = useMemo(() => {
    const m = { [anioPrev]: Array(12).fill(0), [anioActual]: Array(12).fill(0) };
    const p = { [anioPrev]: Array(12).fill(0), [anioActual]: Array(12).fill(0) };
    for (const r of facturacion) {
      const y = r.anio, i = r.mes - 1;
      if (i < 0 || i > 11) continue;
      m[y][i] += Number(r.monto) || 0;
      p[y][i] += Number(r.piezas) || 0;
    }
    return { monto: m, piezas: p };
  }, [facturacion, anioPrev, anioActual]);

  const chartData = useMemo(() => MESES.map((label, i) => {
    const cuota = cuotaPorMes.get(i + 1);
    return {
      mes: label,
      monto2025: Math.round(mensualPorAnio.monto[anioPrev][i]),
      monto2026: Math.round(mensualPorAnio.monto[anioActual][i]) || null,
      cuotaIdeal: cuota ? cuota.ideal : null,
      cuotaMin: cuota ? cuota.min : null,
    };
  }), [mensualPorAnio, anioPrev, anioActual, cuotaPorMes]);

  const totalYTD = useMemo(() => {
    let monto = 0, piezas = 0;
    for (let i = 0; i < mesActual; i++) {
      monto += mensualPorAnio.monto[anioActual][i];
      piezas += mensualPorAnio.piezas[anioActual][i];
    }
    return { monto, piezas };
  }, [mensualPorAnio, anioActual, mesActual]);

  const cuotaYTD = useMemo(() => {
    let min = 0, ideal = 0;
    for (let i = 0; i < mesActual; i++) {
      const c = cuotaPorMes.get(i + 1);
      if (c) { min += c.min; ideal += c.ideal; }
    }
    return { min, ideal };
  }, [cuotaPorMes, mesActual]);

  const mesActualData = useMemo(() => ({
    monto: mensualPorAnio.monto[anioActual][mesActual - 1],
    piezas: mensualPorAnio.piezas[anioActual][mesActual - 1],
    prevMonto: mensualPorAnio.monto[anioPrev][mesActual - 1],
    prevPiezas: mensualPorAnio.piezas[anioPrev][mesActual - 1],
    cuota: cuotaPorMes.get(mesActual),
  }), [mensualPorAnio, anioActual, anioPrev, mesActual, cuotaPorMes]);

  const skusFacturados = useMemo(() => {
    const set = new Set();
    for (const r of facturacion) if (r.anio === anioActual) set.add(r.sku);
    return set;
  }, [facturacion, anioActual]);

  const familiasYTD = useMemo(() => {
    const map = new Map();
    for (const r of facturacion) {
      if (r.anio !== anioActual || r.mes > mesActual) continue;
      const fam = (roadmapMap.get(r.sku)?.familia || 'Sin familia').trim();
      const norm = fam.charAt(0).toUpperCase() + fam.slice(1).toLowerCase();
      if (!map.has(norm)) map.set(norm, { name: norm, monto: 0, piezas: 0, skus: new Set() });
      const it = map.get(norm);
      it.monto += Number(r.monto) || 0;
      it.piezas += Number(r.piezas) || 0;
      it.skus.add(r.sku);
    }
    const arr = Array.from(map.values()).map((v) => ({ ...v, skus: v.skus.size })).sort((a, b) => b.monto - a.monto);
    const tot = arr.reduce((s, x) => s + x.monto, 0);
    return arr.map((v, i) => ({ ...v, pct: tot ? (v.monto / tot * 100) : 0, color: CAT_COLORS[i % CAT_COLORS.length] }));
  }, [facturacion, roadmapMap, anioActual, mesActual]);

  const marcasOpciones = useMemo(() => Array.from(new Set(roadmap.map((r) => r.marca).filter(Boolean))).sort(), [roadmap]);
  const roadmapOpciones = useMemo(() => Array.from(new Set(roadmap.map((r) => r.rdmp).filter(Boolean))).sort(), [roadmap]);
  const categoriaOpciones = useMemo(() => {
    const set = new Set();
    for (const r of roadmap) {
      const c = (r.categoria || '').trim();
      if (c) set.add(c.charAt(0).toUpperCase() + c.slice(1).toLowerCase());
    }
    return Array.from(set).sort();
  }, [roadmap]);

  const matrizSku = useMemo(() => {
    const map = new Map();
    for (const r of facturacion) {
      if (r.anio !== anioActual) continue;
      if (!map.has(r.sku)) map.set(r.sku, Array(12).fill(0));
      map.get(r.sku)[r.mes - 1] += Number(r.piezas) || 0;
    }
    return map;
  }, [facturacion, anioActual]);

  const roadmapOrdenado = useMemo(() => {
    if (!esGlobal) return roadmap;
    return [...roadmap].sort((a, b) => {
      const sa = a.sort_order == null ? Number.MAX_SAFE_INTEGER : Number(a.sort_order);
      const sb = b.sort_order == null ? Number.MAX_SAFE_INTEGER : Number(b.sort_order);
      if (sa !== sb) return sa - sb;
      return String(a.sku || '').localeCompare(String(b.sku || ''));
    });
  }, [roadmap, esGlobal]);

  const filasTabla = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    const rows = [];
    for (const r of roadmapOrdenado) {
      if (!esGlobal && !skusFacturados.has(r.sku)) continue;
      if (marcaSel.size > 0 && !marcaSel.has(r.marca)) continue;
      if (roadmapSel.size > 0 && !roadmapSel.has(r.rdmp)) continue;
      const catNorm = ((r.categoria || '').trim());
      const catCap = catNorm ? catNorm.charAt(0).toUpperCase() + catNorm.slice(1).toLowerCase() : '';
      if (categoriaSel.size > 0 && !categoriaSel.has(catCap)) continue;
      if (q) {
        const hay = String(r.sku || '').toUpperCase().includes(q)
                 || String(r.descripcion || '').toUpperCase().includes(q);
        if (!hay) continue;
      }
      const piezas = matrizSku.get(r.sku) || Array(12).fill(0);
      const total = piezas.reduce((a, b) => a + b, 0);
      const cerrados = piezas.slice(0, mesActual - 1);
      const conVenta = cerrados.filter((v) => v > 0);
      const promedio = conVenta.length ? conVenta.reduce((a, b) => a + b, 0) / conVenta.length : 0;
      rows.push({ ...r, categoriaCap: catCap, piezas, total, promedio });
    }
    if (orden.col && orden.dir) {
      const key = orden.col;
      const factor = orden.dir === 'asc' ? 1 : -1;
      rows.sort((a, b) => (a[key] - b[key]) * factor);
    }
    return rows;
  }, [roadmapOrdenado, skusFacturados, busqueda, marcaSel, roadmapSel, categoriaSel, matrizSku, orden, esGlobal]);

  const totalesFila = useMemo(() => {
    const t = Array(12).fill(0);
    for (const r of filasTabla) for (let i = 0; i < 12; i++) t[i] += r.piezas[i];
    const total = t.reduce((a, b) => a + b, 0);
    const cerrados = t.slice(0, mesActual - 1);
    const conVenta = cerrados.filter((v) => v > 0);
    const promedio = conVenta.length ? conVenta.reduce((a, b) => a + b, 0) / conVenta.length : 0;
    return { mes: t, total, promedio };
  }, [filasTabla, mesActual]);

  const toggleOrden = (col) => {
    setOrden((prev) => {
      if (prev.col !== col) return { col, dir: 'desc' };
      if (prev.dir === 'desc') return { col, dir: 'asc' };
      return { col: null, dir: null };
    });
  };

  const SortHeader = ({ col, label }) => {
    const active = orden.col === col;
    const Icon = !active ? ArrowUpDown : orden.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button onClick={() => toggleOrden(col)}
        className={`inline-flex items-center gap-1 hover:text-gray-700 ${active ? 'text-sky-700' : 'text-gray-500'}`}>
        {label}
        <Icon className="w-3 h-3" />
      </button>
    );
  };

  const maxCelda = useMemo(() => {
    let m = 0;
    for (const r of filasTabla) for (const v of r.piezas) if (v > m) m = v;
    return m || 1;
  }, [filasTabla]);

  const heatClass = (v) => {
    if (!v) return null;
    const r = v / maxCelda;
    if (r > 0.75) return { bg: '#7DD3FC', color: '#082F49', weight: 600 };
    if (r > 0.50) return { bg: '#BAE6FD', color: '#0C4A6E', weight: 500 };
    if (r > 0.25) return { bg: '#E0F2FE', color: '#0C4A6E' };
    return { bg: '#F0F9FF', color: '#334155' };
  };

  const exportarExcel = () => {
    const HEADERS = ['Marca', 'SKU', 'Descripción', 'Categoría', 'Roadmap', ...MESES, 'Promedio', 'Total'];
    const rows = filasTabla.map((r) => [
      r.marca || '', r.sku || '', r.descripcion || '', r.categoriaCap || '', r.rdmp || '',
      ...r.piezas.map((v) => v || null),
      Math.round(r.promedio) || null,
      r.total,
    ]);
    const totRow = ['TOTAL', `${filasTabla.length} SKUs`, '', '', '', ...totalesFila.mes.map((v) => v || null), Math.round(totalesFila.promedio) || null, totalesFila.total];
    const titulo = `Sell In ${meta.nombre} · ${anioActual}`;
    const aoa = [
      [titulo, ...Array(HEADERS.length - 1).fill('')],
      HEADERS, ...rows, totRow,
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const headStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    };
    const titStyle = { ...headStyle, font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 14 } };
    for (let c = 0; c < HEADERS.length; c++) {
      const t = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[t]) ws[t] = { v: '', t: 's' };
      ws[t].s = titStyle;
      const h = XLSX.utils.encode_cell({ r: 1, c });
      if (ws[h]) ws[h].s = headStyle;
    }
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: HEADERS.length - 1 } }];
    ws['!rows'] = [{ hpt: 26 }, { hpt: 24 }];
    for (let i = 0; i < rows.length; i++) {
      for (let c = 5; c < HEADERS.length; c++) {
        const a = XLSX.utils.encode_cell({ r: i + 2, c });
        if (ws[a] && typeof ws[a].v === 'number') ws[a].z = '#,##0';
      }
    }
    ws['!cols'] = [
      { wch: 10 }, { wch: 14 }, { wch: 50 }, { wch: 16 }, { wch: 9 },
      ...MESES.map(() => ({ wch: 8 })), { wch: 10 }, { wch: 10 },
    ];
    ws['!freeze'] = { xSplit: 5, ySplit: 2 };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sell In');
    XLSX.writeFile(wb, `Sell In ${meta.nombre} ${anioActual}.xlsx`);
  };

  if (loading) {
    return <div className="p-12 text-center text-gray-400">Cargando Sell In de {meta.nombre}…</div>;
  }

  const pctMTD = mesActualData.cuota?.ideal ? mesActualData.monto / mesActualData.cuota.ideal * 100 : null;
  const pctYTD = cuotaYTD.ideal ? totalYTD.monto / cuotaYTD.ideal * 100 : null;
  const yoyMonto = mesActualData.prevMonto ? ((mesActualData.monto - mesActualData.prevMonto) / mesActualData.prevMonto) * 100 : null;
  const yoyPiezas = mesActualData.prevPiezas ? mesActualData.piezas - mesActualData.prevPiezas : null;

  const KPI = ({ label, badge, badgeTone, value, valueSub, sub, progress, progressTone, extra }) => {
    const tones = {
      good: 'bg-emerald-50 text-emerald-700',
      warn: 'bg-amber-50 text-amber-700',
      bad: 'bg-rose-50 text-rose-700',
      neutral: 'bg-gray-100 text-gray-600',
    };
    const bars = { good: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-rose-500', neutral: 'bg-gray-400' };
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium mb-2">
          <span>{label}</span>
          {badge && <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${tones[badgeTone] || tones.neutral}`}>{badge}</span>}
        </div>
        <div className="text-[24px] font-semibold text-gray-800 tabular-nums leading-tight">
          {value}{valueSub && <span className="text-gray-400 font-medium"> {valueSub}</span>}
        </div>
        {progress != null && (
          <div className="mt-3">
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${bars[progressTone] || bars.neutral}`}
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
            </div>
          </div>
        )}
        {sub && <div className="mt-2 text-[11px] text-gray-500 flex justify-between items-center">{sub}</div>}
        {extra && <div className="text-[11px] text-gray-500 mt-1">{extra}</div>}
      </div>
    );
  };

  return (
    <div className="max-w-none mx-auto p-3 space-y-3">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full ${meta.badgeBg} ${meta.badgeText} text-[11px] font-semibold mb-1.5`}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
            {meta.nombre} · {meta.marca}
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-gray-700" /> Sell In
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {esGlobal ? 'Facturación consolidada de todos los clientes' : 'Facturación al cliente'} · Fuente ERP Acteck · {facturacion.length.toLocaleString('es-MX')} rows cargados
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KPI
          label={`Facturación mes actual · ${MESES_LARGO[mesActual - 1]} ${anioActual} (MTD)`}
          badge={pctMTD != null ? `${pctMTD.toFixed(0)}% cuota` : 'Sin cuota'}
          badgeTone={pctMTD == null ? 'neutral' : pctMTD >= 90 ? 'good' : pctMTD >= 60 ? 'warn' : 'bad'}
          value={formatMXN(mesActualData.monto)}
          valueSub={mesActualData.cuota ? `/ ${formatMXN(mesActualData.cuota.ideal)}` : null}
          progress={pctMTD}
          progressTone={pctMTD == null ? 'neutral' : pctMTD >= 90 ? 'good' : pctMTD >= 60 ? 'warn' : 'bad'}
          sub={<>
            <span>{fmtInt(mesActualData.piezas)} piezas</span>
            {mesActualData.cuota && <span className="text-gray-400">Min {fmtMoneyShort(mesActualData.cuota.min)} · Ideal {fmtMoneyShort(mesActualData.cuota.ideal)}</span>}
          </>}
        />
        <KPI
          label={`Facturación YTD ${anioActual} · Ene – ${MESES[mesActual - 1]}`}
          badge={pctYTD != null ? `${pctYTD.toFixed(0)}% cuota` : 'Sin cuota'}
          badgeTone={pctYTD == null ? 'neutral' : pctYTD >= 90 ? 'good' : pctYTD >= 60 ? 'warn' : 'bad'}
          value={formatMXN(totalYTD.monto)}
          valueSub={cuotaYTD.ideal ? `/ ${formatMXN(cuotaYTD.ideal)}` : null}
          progress={pctYTD}
          progressTone={pctYTD == null ? 'neutral' : pctYTD >= 90 ? 'good' : pctYTD >= 60 ? 'warn' : 'bad'}
          sub={<span>{fmtInt(totalYTD.piezas)} piezas · {skusFacturados.size} SKUs distintos</span>}
        />
        <KPI
          label={`${MESES_LARGO[mesActual - 1]} ${anioActual} vs ${MESES_LARGO[mesActual - 1]} ${anioPrev}`}
          badge={yoyMonto != null ? `${yoyMonto >= 0 ? '+' : ''}${yoyMonto.toFixed(0)}%` : 'Sin comparativo'}
          badgeTone={yoyMonto == null ? 'neutral' : yoyMonto >= 0 ? 'good' : 'bad'}
          value={formatMXN(mesActualData.monto)}
          valueSub={`vs ${formatMXN(mesActualData.prevMonto)}`}
          sub={<>
            <span>Piezas {fmtInt(mesActualData.piezas)} <span className="text-gray-400">vs {fmtInt(mesActualData.prevPiezas)}</span></span>
            {yoyPiezas != null && (
              <span className={yoyPiezas >= 0 ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                {yoyPiezas >= 0 ? '↑' : '↓'} {fmtInt(Math.abs(yoyPiezas))} pz
              </span>
            )}
          </>}
        />
      </div>

      {/* Chart + Categorías */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex justify-between items-baseline mb-2">
            <h3 className="text-sm font-semibold text-gray-800">Evolución mensual · Sell In vs Cuota vs Año anterior</h3>
            <div className="text-[11px] text-gray-500 flex gap-3">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ background: '#94A3B8' }} /> {anioPrev}</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ background: ACCENT }} /> {anioActual}</span>
              {cuotaAnual.ideal > 0 && <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-0.5" style={{ background: '#F59E0B' }} /> Cuota
              </span>}
            </div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 'auto']} allowDataOverflow={true} tickFormatter={(v) => fmtMoneyShort(v)} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={55} />
                <Tooltip
                  formatter={(v, name) => [formatMXN(v), name]}
                  labelStyle={{ color: '#374151', fontWeight: 600 }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
                />
                <Line dataKey="monto2025" name={String(anioPrev)} stroke="#94A3B8" strokeWidth={2} dot={{ r: 3, fill: '#94A3B8' }} activeDot={{ r: 5 }} connectNulls={false} />
                <Line dataKey="monto2026" name={String(anioActual)} stroke={ACCENT} strokeWidth={2.5} dot={{ r: 3.5, fill: ACCENT }} activeDot={{ r: 5 }} connectNulls={false} />
                <Line dataKey="cuotaIdeal" name="Cuota" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3, fill: '#F59E0B' }} activeDot={{ r: 5 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex justify-between items-baseline mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Composición por familia</h3>
            <span className="text-[10.5px] text-gray-500">YTD {anioActual} · {formatMXN(totalYTD.monto)}</span>
          </div>
          <div className="grid grid-cols-[130px_1fr] gap-4 items-center">
            <div style={{ width: 130, height: 130, position: 'relative' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={familiasYTD} dataKey="monto" cx="50%" cy="50%" innerRadius={40} outerRadius={62} paddingAngle={1} stroke="none">
                    {familiasYTD.map((c, i) => <Cell key={i} fill={c.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatMXN(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div className="text-[15px] font-semibold text-gray-800 tabular-nums">{familiasYTD.length}</div>
                <div className="text-[9px] uppercase tracking-widest text-gray-500 mt-0.5">familias</div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 text-[11px]">
              {familiasYTD.slice(0, 8).map((c) => (
                <div key={c.name} className="grid grid-cols-[10px_1fr_auto] gap-2 items-center">
                  <span className="w-2 h-2 rounded-sm" style={{ background: c.color }} />
                  <span className="text-gray-700 truncate">{c.name}</span>
                  <span className="text-gray-500 tabular-nums font-medium">{c.pct.toFixed(1)}%</span>
                  <span className="col-span-2 col-start-2 h-0.5 bg-gray-100 rounded-full overflow-hidden mt-0.5">
                    <span className="block h-full rounded-full" style={{ width: `${Math.min(100, c.pct)}%`, background: c.color }} />
                  </span>
                </div>
              ))}
            </div>
          </div>
          {familiasYTD.length >= 2 && (
            <div className="border-t border-gray-100 pt-2.5 mt-3 flex justify-between text-[11px] text-gray-500">
              <span>Dominante: <span className="text-gray-800 font-semibold">{familiasYTD[0].name}</span></span>
              <span>Top 2 = <span className="text-gray-800 font-semibold tabular-nums">{(familiasYTD[0].pct + (familiasYTD[1]?.pct || 0)).toFixed(1)}%</span></span>
            </div>
          )}
        </div>
      </div>

      {/* Tabla detalle SKU */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-3 border-b border-gray-200 bg-gray-50/60">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 px-2 bg-white border border-gray-200 rounded-lg h-8 flex-1 min-w-0 max-w-xs">
              <Search className="w-3.5 h-3.5 text-gray-400" />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar SKU o descripción…"
                className="flex-1 outline-none text-xs bg-transparent min-w-0" />
            </div>
            <MultiSelect label="Marca" options={marcasOpciones} selected={marcaSel} onChange={setMarcaSel} width={140} />
            <MultiSelect label="Roadmap" options={roadmapOpciones} selected={roadmapSel} onChange={setRoadmapSel} width={130} />
            <MultiSelect label="Categoría" options={categoriaOpciones} selected={categoriaSel} onChange={setCategoriaSel} width={160} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500">{filasTabla.length} SKUs</span>
            <button onClick={exportarExcel} disabled={filasTabla.length === 0}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-40">
              <Download className="w-3.5 h-3.5" /> Exportar Excel
            </button>
          </div>
        </div>
        <div className="overflow-auto" style={{ maxHeight: '65vh' }}>
          <table className="w-full text-[11px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                {[
                  { label: 'Marca',       align: 'left'   },
                  { label: 'SKU',         align: 'left'   },
                  { label: 'Descripción', align: 'left'   },
                  { label: 'Roadmap',     align: 'center' },
                  ...MESES.map((m) => ({ label: m, align: 'right' })),
                  { label: 'Promedio', align: 'right', sort: 'promedio' },
                  { label: 'Total',    align: 'right', sort: 'total' },
                ].map((h, i) => (
                  <th key={i}
                    className="py-1.5 px-2 font-medium uppercase tracking-wider text-[9px] text-gray-500"
                    style={{
                      textAlign: h.align,
                      position: 'sticky', top: 0, background: '#F9FAFB', zIndex: 1, borderBottom: '1px solid #E5E7EB',
                      whiteSpace: 'nowrap',
                    }}>
                    {h.sort ? <SortHeader col={h.sort} label={h.label} /> : h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filasTabla.map((r) => {
                const rmp = ROADMAP_COLOR[r.rdmp] || { bg: '#F1EFE8', text: '#2C2C2A' };
                const abierto = skuAbierto === r.sku;
                return (
                  <React.Fragment key={r.sku}>
                    <tr
                      onClick={() => setSkuAbierto(abierto ? null : r.sku)}
                      className={`border-t border-gray-100 cursor-pointer ${abierto ? 'bg-sky-50/70' : 'hover:bg-gray-50'}`}>
                      <td className="py-1 px-1.5 text-gray-600 text-[10px] whitespace-nowrap" style={{ width: 70 }}>{r.marca || '—'}</td>
                      <td className="py-1 px-1.5 font-mono text-gray-700 text-[10px] whitespace-nowrap" style={{ width: 96 }}>
                        <span className="inline-flex items-center gap-1">
                          <ChevronRight className="w-3 h-3 text-sky-500 flex-shrink-0 transition-transform"
                            style={{ transform: abierto ? 'rotate(90deg)' : 'none' }} />
                          {r.sku}
                        </span>
                      </td>
                      <td className="py-1 px-1.5 text-gray-800 truncate" style={{ maxWidth: 240 }} title={r.descripcion}>
                        {r.descripcion || '—'}
                      </td>
                      <td className="py-1 px-1.5 text-center" style={{ width: 70 }}>
                        {r.rdmp && (
                          <span className="text-[9px] font-medium px-1 py-0.5 rounded"
                            style={{ background: rmp.bg, color: rmp.text }}>{r.rdmp}</span>
                        )}
                      </td>
                      {r.piezas.map((v, i) => {
                        const h = heatClass(v);
                        return (
                          <td key={i} className="py-1 px-1.5 text-right tabular-nums whitespace-nowrap"
                            style={{
                              background: h?.bg,
                              color: h?.color || '#9CA3AF',
                              fontWeight: h?.weight || 400,
                              width: 56,
                            }}>
                            {v ? fmtInt(v) : '—'}
                          </td>
                        );
                      })}
                      <td className="py-1 px-2 text-right tabular-nums text-gray-700 bg-gray-50/60" style={{ width: 70 }}>
                        {r.promedio ? fmtInt(r.promedio) : '—'}
                      </td>
                      <td className="py-1 px-2 text-right tabular-nums font-semibold text-gray-800 bg-gray-50" style={{ width: 70 }}>
                        {fmtInt(r.total)}
                      </td>
                    </tr>
                    {abierto && (
                      <tr className="drilldown-row">
                        <td colSpan={4 + 12 + 2} style={{ padding: 0, background: '#F1F5FB', borderTop: '1px solid #DBE5F0' }}>
                          <DrillDownSKU
                            sku={r.sku}
                            marca={r.marca}
                            descripcion={r.descripcion}
                            categoria={r.categoriaCap}
                            familia={r.familia}
                            rdmp={r.rdmp}
                            anioActual={anioActual}
                            anioPrev={anioPrev}
                            mesActual={mesActual}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              <tr className="font-semibold text-gray-800 bg-gray-50" style={{ borderTop: '2px solid #E5E7EB' }}>
                <td colSpan={4} className="py-1.5 px-2 text-[10px] uppercase tracking-wider text-gray-600">Total · {filasTabla.length} SKUs</td>
                {totalesFila.mes.map((v, i) => (
                  <td key={i} className="py-1.5 px-1.5 text-right tabular-nums">{v ? fmtInt(v) : '—'}</td>
                ))}
                <td className="py-1.5 px-2 text-right tabular-nums">
                  {totalesFila.promedio ? fmtInt(totalesFila.promedio) : '—'}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums">{fmtInt(totalesFila.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Drill-down por SKU ─────────────────────────────────────────────────────
// Carga on-demand facturación (por cliente_nombre × mes), precios de lista
// del mes actual e inventario Acteck. Layout: 3 columnas (Quién / Cuándo /
// Precio + Stock) dentro del row expandido.
const CANAL_STYLE = {
  DISTRIBUIDOR: { bg: '#E5EAF2', color: '#334155', label: 'Distrib' },
  MAYOREO:      { bg: '#EEEDFE', color: '#3730A3', label: 'Mayoreo' },
  'E-COMMERCE': { bg: '#D1FAE5', color: '#065F46', label: 'E-com' },
  DIGITALIFE:   { bg: '#E0F2FE', color: '#075985', label: 'Digitalife' },
  PCEL:         { bg: '#E0F2FE', color: '#075985', label: 'PCEL' },
  DICOTECH:     { bg: '#E0F2FE', color: '#075985', label: 'Dicotech' },
};

function DrillDownSKU({ sku, marca, descripcion, categoria, familia, rdmp, anioActual, anioPrev, mesActual }) {
  const [cargando, setCargando] = useState(true);
  const [fact, setFact] = useState([]);
  const [precios, setPrecios] = useState([]);
  const [inv, setInv] = useState([]);
  const [promos, setPromos] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setCargando(true);
    (async () => {
      const [fRes, pRes, iRes, prRes] = await Promise.all([
        supabase.from('facturacion_clientes')
          .select('cliente_nombre,cliente_key,canal,anio,mes,piezas,monto')
          .eq('sku', sku).in('anio', [anioPrev, anioActual]),
        supabase.from('precios_sku')
          .select('lista,precio').eq('sku', sku).eq('anio', anioActual).eq('mes', mesActual),
        supabase.from('inventario_acteck')
          .select('no_almacen,disponible').eq('articulo', sku),
        supabase.from('promos_temporada')
          .select('campania,promo_pct').eq('sku', sku).eq('anio', anioActual).eq('mes', mesActual),
      ]);
      if (cancelled) return;
      setFact(fRes.data || []);
      setPrecios(pRes.data || []);
      setInv(iRes.data || []);
      setPromos(prRes.data || []);
      setCargando(false);
    })();
    return () => { cancelled = true; };
  }, [sku, anioActual, anioPrev, mesActual]);

  // ── Quién compra ──
  const clientesAgregados = useMemo(() => {
    const m = new Map();
    for (const r of fact) {
      if (r.anio !== anioActual) continue;
      const k = r.cliente_nombre || '(sin nombre)';
      if (!m.has(k)) m.set(k, { nombre: k, canal: r.canal || 'MAYOREO', clienteKey: r.cliente_key, piezas: 0, monto: 0, prevMonto: 0, prevPiezas: 0 });
      const it = m.get(k);
      it.piezas += Number(r.piezas) || 0;
      it.monto  += Number(r.monto)  || 0;
    }
    for (const r of fact) {
      if (r.anio !== anioPrev) continue;
      const k = r.cliente_nombre || '(sin nombre)';
      if (!m.has(k)) continue;
      m.get(k).prevMonto += Number(r.monto) || 0;
      m.get(k).prevPiezas += Number(r.piezas) || 0;
    }
    const arr = Array.from(m.values()).sort((a, b) => b.monto - a.monto);
    const tot = arr.reduce((s, x) => s + x.monto, 0);
    return arr.map((v) => ({
      ...v,
      pct: tot ? (v.monto / tot * 100) : 0,
      yoy: v.prevMonto > 0 ? ((v.monto - v.prevMonto) / v.prevMonto * 100) : (v.monto > 0 ? null : 0),
    }));
  }, [fact, anioActual, anioPrev]);

  const totalYTD = useMemo(() => {
    let piezas = 0, monto = 0;
    for (const r of fact) if (r.anio === anioActual) { piezas += Number(r.piezas) || 0; monto += Number(r.monto) || 0; }
    return { piezas, monto };
  }, [fact, anioActual]);

  const topN = clientesAgregados.slice(0, 8);
  const maxPct = topN.reduce((m, c) => Math.max(m, c.pct), 0) || 1;
  const top3Pct = clientesAgregados.slice(0, 3).reduce((s, c) => s + c.pct, 0);

  // ── Serie 24 meses (piezas) ──
  const serie = useMemo(() => {
    const out = [];
    for (const y of [anioPrev, anioActual]) {
      for (let mes = 1; mes <= 12; mes++) {
        let piezas = 0;
        for (const r of fact) if (r.anio === y && r.mes === mes) piezas += Number(r.piezas) || 0;
        out.push({ anio: y, mes, piezas });
      }
    }
    return out;
  }, [fact, anioActual, anioPrev]);
  const serieMax = Math.max(1, ...serie.map((x) => x.piezas));
  const y = (v) => 75 - (v / serieMax) * 70;
  const path2025 = serie.slice(0, 12).map((p, i) => `${i === 0 ? 'M' : 'L'} ${5 + i * 16},${y(p.piezas)}`).join(' ');
  const path2026 = serie.slice(12, 12 + mesActual).map((p, i) => `${i === 0 ? 'M' : 'L'} ${205 + i * 16},${y(p.piezas)}`).join(' ');

  // KPIs deltas
  const p6mAct = serie.slice(12, 12 + Math.max(0, mesActual - 1)).reduce((s, x) => s + x.piezas, 0);
  const p6mPrev = serie.slice(0, Math.max(0, mesActual - 1)).reduce((s, x) => s + x.piezas, 0);
  const yoy6m = p6mPrev > 0 ? ((p6mAct - p6mPrev) / p6mPrev * 100) : null;
  const meses3act = serie.slice(Math.max(12, 12 + mesActual - 4), 12 + mesActual - 1);
  const meses3prev = serie.slice(Math.max(12, 12 + mesActual - 7), Math.max(12, 12 + mesActual - 4));
  const sum3act = meses3act.reduce((s, x) => s + x.piezas, 0);
  const sum3prev = meses3prev.reduce((s, x) => s + x.piezas, 0);
  const trend3m = sum3prev > 0 ? ((sum3act - sum3prev) / sum3prev * 100) : null;

  // ── Precios / promo ──
  const precioMap = useMemo(() => {
    const m = {};
    for (const p of precios) m[p.lista] = Number(p.precio) || 0;
    return m;
  }, [precios]);
  const precioAAA = precioMap['Mayoreo AAA'] || null;

  const promoEfectiva = useMemo(() => {
    let factor = 1;
    for (const p of promos) factor *= (1 - Number(p.promo_pct));
    return { pct: 1 - factor, campanias: promos.map((p) => p.campania) };
  }, [promos]);
  const precioAAAneto = precioAAA != null ? precioAAA * (1 - promoEfectiva.pct) : null;

  const precioPromReal = totalYTD.piezas > 0 ? totalYTD.monto / totalYTD.piezas : null;
  const yieldPct = precioAAAneto && precioPromReal ? (precioPromReal / precioAAAneto * 100) : null;

  // ── Inventario / cobertura ──
  const stockTotal = inv.reduce((s, r) => s + (Number(r.disponible) || 0), 0);
  const numAlmacenes = inv.filter((r) => (Number(r.disponible) || 0) > 0).length;
  const ventaPromMes = mesActual > 1 ? (totalYTD.piezas / (mesActual - 1)) : (totalYTD.piezas || 0);
  const cobertura = ventaPromMes > 0 ? (stockTotal / ventaPromMes) : null;
  const covTone = cobertura == null ? 'neutral' : cobertura < 1.5 ? 'bad' : cobertura < 3 ? 'good' : cobertura < 6 ? 'good' : 'warn';
  const covLabel = cobertura == null ? '—' : `${cobertura.toFixed(1)} meses`;
  const covSub = cobertura == null ? 'Sin ventas para calcular' : cobertura < 1.5 ? 'Riesgo de faltante' : cobertura > 6 ? 'Sobre-stock vs venta actual' : 'Cobertura sana';

  if (cargando) {
    return (
      <div className="p-6 text-center text-gray-500 text-xs">Cargando datos del SKU…</div>
    );
  }

  const Eyebrow = ({ children, right }) => (
    <div className="flex items-baseline justify-between mb-3">
      <span className="text-[9.5px] uppercase tracking-widest font-semibold text-gray-500">{children}</span>
      {right && <span className="text-[10.5px] text-gray-400">{right}</span>}
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-2 px-5 pt-3.5 pb-1 text-[11px] text-gray-500 flex-wrap">
        <span className="font-semibold text-gray-800">{sku} · {descripcion}</span>
        <span className="text-gray-300">·</span>
        <span>{marca}</span>
        {categoria && <><span className="text-gray-300">·</span><span>{categoria}</span></>}
        {familia && <><span className="text-gray-300">·</span><span>{familia}</span></>}
        {rdmp && (
          <>
            <span className="text-gray-300">·</span>
            <span className="text-[9px] font-medium px-1 py-0.5 rounded"
              style={{ background: (ROADMAP_COLOR[rdmp] || { bg: '#F1EFE8', text: '#2C2C2A' }).bg, color: (ROADMAP_COLOR[rdmp] || { bg: '#F1EFE8', text: '#2C2C2A' }).text }}>{rdmp}</span>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 p-5 pt-2">
        {/* COL 1 — Quién compra */}
        <div className="lg:pr-5 lg:border-r border-[#DBE5F0]">
          <Eyebrow right={`${clientesAgregados.length} clientes distintos`}>Quién compra · YTD {anioActual}</Eyebrow>
          {topN.length === 0 ? (
            <div className="text-xs text-gray-400 italic">Sin facturación en {anioActual}.</div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {topN.map((c) => {
                  const canalKey = String(c.canal || '').toUpperCase();
                  const style = CANAL_STYLE[canalKey] || CANAL_STYLE.MAYOREO;
                  return (
                    <div key={c.nombre} className="pb-1.5 border-b border-dashed border-[#E5EAF0] last:border-b-0 last:pb-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider"
                          style={{ background: style.bg, color: style.color }}>{style.label}</span>
                        <span className="text-[11.5px] font-medium text-gray-800 truncate flex-1">{c.nombre}</span>
                        <span className="text-[11px] text-gray-500 font-medium tabular-nums">{c.pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-[3px] bg-[#E4EAF2] rounded-full overflow-hidden mt-1">
                        <span className="block h-full rounded-full"
                          style={{ width: `${(c.pct / maxPct * 100).toFixed(1)}%`, background: c.pct >= 10 ? '#0EA5E9' : '#94A3B8' }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500 mt-1 tabular-nums">
                        <span>{fmtInt(c.piezas)} pz · {formatMXN(c.monto)}</span>
                        {c.yoy != null && (
                          <span className={c.yoy >= 0 ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                            {c.yoy >= 0 ? '+' : ''}{c.yoy.toFixed(0)}% YoY
                          </span>
                        )}
                        {c.yoy == null && c.piezas > 0 && <span className="text-emerald-700 font-semibold">nuevo</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between items-end mt-3 pt-2.5 border-t border-[#DBE5F0]">
                <div>
                  <div className="text-[15px] font-semibold tabular-nums">{top3Pct.toFixed(1)}%</div>
                  <div className="text-[9.5px] uppercase tracking-widest text-gray-500">Top 3 concentran</div>
                </div>
                <div className="text-right">
                  <div className="text-[15px] font-semibold tabular-nums">{clientesAgregados.length}</div>
                  <div className="text-[9.5px] uppercase tracking-widest text-gray-500">Clientes distintos YTD</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* COL 2 — Cuándo */}
        <div className="lg:px-5 lg:border-r border-[#DBE5F0]">
          <Eyebrow right="Piezas / mes">Cuándo lo compran · 24 meses</Eyebrow>
          <svg viewBox="0 0 400 88" preserveAspectRatio="none" style={{ width: '100%', height: 88, display: 'block' }}>
            <line x1="0" y1="65" x2="400" y2="65" stroke="#E5EAF2" strokeWidth="1" />
            <line x1="200" y1="4" x2="200" y2="75" stroke="#DBE5F0" strokeWidth="1" strokeDasharray="3 3" />
            <text x="98"  y="14" fontSize="8.5" fill="#9CA3AF" textAnchor="middle" fontFamily="inherit">{anioPrev}</text>
            <text x="298" y="14" fontSize="8.5" fill="#9CA3AF" textAnchor="middle" fontFamily="inherit">{anioActual}</text>
            {path2025 && <path d={path2025} stroke="#94A3B8" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            {serie.slice(0, 12).map((p, i) => <circle key={i} cx={5 + i * 16} cy={y(p.piezas)} r="2" fill="#94A3B8" />)}
            {path2026 && <path d={path2026} stroke="#0EA5E9" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            {serie.slice(12, 12 + mesActual - 1).map((p, i) => <circle key={i} cx={205 + i * 16} cy={y(p.piezas)} r="2.6" fill="#0EA5E9" />)}
            {mesActual > 0 && serie[12 + mesActual - 1] && (
              <circle cx={205 + (mesActual - 1) * 16} cy={y(serie[12 + mesActual - 1].piezas)} r="3" fill="white" stroke="#0EA5E9" strokeWidth="2" />
            )}
          </svg>
          <div className="flex justify-between text-[9.5px] text-gray-400 mt-1 tabular-nums">
            <span>Ene {String(anioPrev).slice(-2)}</span>
            <span>Jul {String(anioPrev).slice(-2)}</span>
            <span>Ene {String(anioActual).slice(-2)}</span>
            <span>{MESES[mesActual - 1]} {String(anioActual).slice(-2)}</span>
          </div>
          <div className="flex gap-3 text-[10.5px] text-gray-500 mt-2">
            <span><span className="inline-block w-2 h-0.5 mr-1 align-middle rounded-sm" style={{ background: '#94A3B8' }} />{anioPrev}</span>
            <span><span className="inline-block w-2 h-0.5 mr-1 align-middle rounded-sm" style={{ background: '#0EA5E9' }} />{anioActual}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <div className="text-[9.5px] uppercase tracking-widest text-gray-500">YoY {mesActual - 1}m</div>
              <div className={`text-[17px] font-semibold tabular-nums ${yoy6m == null ? 'text-gray-400' : yoy6m >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {yoy6m == null ? '—' : `${yoy6m >= 0 ? '+' : ''}${yoy6m.toFixed(1)}%`}
              </div>
              <div className="text-[10px] text-gray-400 tabular-nums">{fmtInt(p6mAct)} vs {fmtInt(p6mPrev)} pz</div>
            </div>
            <div>
              <div className="text-[9.5px] uppercase tracking-widest text-gray-500">Últ. 3m vs prev</div>
              <div className={`text-[17px] font-semibold tabular-nums ${trend3m == null ? 'text-gray-400' : trend3m >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {trend3m == null ? '—' : `${trend3m >= 0 ? '+' : ''}${trend3m.toFixed(1)}%`}
              </div>
              <div className="text-[10px] text-gray-400 tabular-nums">{fmtInt(sum3act)} vs {fmtInt(sum3prev)} pz</div>
            </div>
          </div>
        </div>

        {/* COL 3 — Precio + Stock */}
        <div className="lg:pl-5">
          <Eyebrow right={precioPromReal ? `Yield ${yieldPct?.toFixed(1)}%` : ''}>A qué precio · {MESES_LARGO[mesActual - 1]} {anioActual}</Eyebrow>
          <div className="flex flex-col gap-0.5 text-[11.5px]">
            {precioAAA != null && (
              <div className="flex justify-between items-baseline py-1 px-2 rounded" style={{ background: '#FEF9C3' }}>
                <span className="text-gray-700 font-medium">Mayoreo AAA <span className="text-[10px] text-gray-500 font-normal">
                  {promoEfectiva.pct > 0 ? 'neto' : 'lista'}
                </span></span>
                <span className="tabular-nums font-semibold">{formatMXN(precioAAAneto)}</span>
              </div>
            )}
            {['DICOTECH', 'PCEL PROVISIONAL', 'API PROVISIONAL', 'DECME PROVISIONAL'].map((l) => (
              precioMap[l] != null && (
                <div key={l} className="flex justify-between py-1 text-gray-700">
                  <span className="font-medium">{l.replace(' PROVISIONAL', '')}</span>
                  <span className="tabular-nums">{formatMXN(precioMap[l])}</span>
                </div>
              )
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2.5 mt-2.5 border-t border-[#DBE5F0]">
            <div>
              <div className="text-[9.5px] uppercase tracking-widest text-gray-500">Precio prom. real {anioActual}</div>
              <div className={`text-[16px] font-semibold tabular-nums ${yieldPct == null ? 'text-gray-400' : yieldPct >= 95 ? 'text-emerald-700' : yieldPct >= 85 ? 'text-amber-700' : 'text-rose-700'}`}>
                {precioPromReal ? formatMXN(precioPromReal) : '—'}
              </div>
              <div className="text-[10px] text-gray-400">{yieldPct ? `${yieldPct.toFixed(1)}% del AAA neto` : 'Sin venta YTD'}</div>
            </div>
            <div>
              <div className="text-[9.5px] uppercase tracking-widest text-gray-500">Promo activa</div>
              <div className={`text-[16px] font-semibold tabular-nums ${promoEfectiva.pct > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                {promoEfectiva.pct > 0 ? `−${(promoEfectiva.pct * 100).toFixed(1)}%` : '—'}
              </div>
              <div className="text-[10px] text-gray-400 truncate" title={promoEfectiva.campanias.join(' · ')}>
                {promoEfectiva.campanias.length ? promoEfectiva.campanias.join(' · ') : 'Sin campaña este mes'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2.5 mt-2.5 border-t border-[#DBE5F0]">
            <div>
              <div className="text-[9.5px] uppercase tracking-widest text-gray-500">Inventario Acteck</div>
              <div className={`text-[16px] font-semibold tabular-nums ${stockTotal <= 0 ? 'text-rose-700' : 'text-gray-800'}`}>
                {fmtInt(stockTotal)} pz
              </div>
              <div className="text-[10px] text-gray-400">{numAlmacenes} almacenes</div>
            </div>
            <div>
              <div className="text-[9.5px] uppercase tracking-widest text-gray-500">Días de cobertura</div>
              <div className={`text-[16px] font-semibold tabular-nums ${covTone === 'bad' ? 'text-rose-700' : covTone === 'warn' ? 'text-amber-700' : covTone === 'good' ? 'text-emerald-700' : 'text-gray-400'}`}>
                {cobertura == null ? '—' : `≈ ${covLabel}`}
              </div>
              <div className="text-[10px] text-gray-400">{covSub}</div>
            </div>
          </div>

          {cobertura != null && (cobertura < 1.5 || cobertura > 6) && (
            <div className="mt-3 px-2.5 py-2 rounded text-[11px] font-medium border-l-4"
              style={cobertura < 1.5
                ? { background: '#FEE2E2', color: '#991B1B', borderColor: '#EF4444' }
                : { background: '#FEF3C7', color: '#92400E', borderColor: '#F59E0B' }
              }>
              {cobertura < 1.5
                ? '⚠︎ Cobertura crítica · programar reposición'
                : '⚠︎ Cobertura elevada · considerar frenar OC / activar promo'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
