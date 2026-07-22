import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import {
  ShoppingCart, Search, Download, ChevronDown, ChevronRight, Check, ArrowUpDown, ArrowUp, ArrowDown,
  Calendar, TrendingUp, Target, Activity,
} from 'lucide-react';
import SellInDrillDown, { DrillDownBoundary } from './SellInDrillDown';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip,
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

// ROADMAP colors iOS · mismo mapeo semántico, palette Apple system
const ROADMAP_COLOR = {
  RMI:  { bg: 'rgba(90,200,250,0.18)', text: '#0E5A80' },   // iOS teal
  RML:  { bg: 'rgba(175,82,222,0.14)', text: '#6B2F94' },   // iOS purple
  2026: { bg: 'rgba(255,149,0,0.14)',  text: '#8A4A00' },   // iOS orange
  RMS:  { bg: 'rgba(255,45,85,0.14)',  text: '#8F1330' },   // iOS pink
};
// Versiones para dark mode
const ROADMAP_COLOR_DARK = {
  RMI:  { bg: 'rgba(100,210,255,0.20)', text: '#7DDEFF' },
  RML:  { bg: 'rgba(191,90,242,0.20)',  text: '#D9A2FF' },
  2026: { bg: 'rgba(255,159,10,0.20)',  text: '#FFBB4D' },
  RMS:  { bg: 'rgba(255,55,95,0.20)',   text: '#FF7A99' },
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
  const { theme } = useTheme();
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
  const [familiaSel, setFamiliaSel] = useState(null); // familia normalizada (Cap) o null = todas

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

  // Facturación filtrada por familia seleccionada (todo lo demás intacto)
  const familiaNormFor = (sku) => {
    const fam = (roadmapMap.get(sku)?.familia || 'Sin familia').trim();
    return fam.charAt(0).toUpperCase() + fam.slice(1).toLowerCase();
  };
  const facturacionFilt = useMemo(() => {
    if (!familiaSel) return facturacion;
    return facturacion.filter((r) => familiaNormFor(r.sku) === familiaSel);
  }, [facturacion, familiaSel, roadmapMap]);

  const mensualPorAnio = useMemo(() => {
    const m = { [anioPrev]: Array(12).fill(0), [anioActual]: Array(12).fill(0) };
    const p = { [anioPrev]: Array(12).fill(0), [anioActual]: Array(12).fill(0) };
    for (const r of facturacionFilt) {
      const y = r.anio, i = r.mes - 1;
      if (i < 0 || i > 11) continue;
      m[y][i] += Number(r.monto) || 0;
      p[y][i] += Number(r.piezas) || 0;
    }
    return { monto: m, piezas: p };
  }, [facturacionFilt, anioPrev, anioActual]);

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
    for (const r of facturacionFilt) if (r.anio === anioActual) set.add(r.sku);
    return set;
  }, [facturacionFilt, anioActual]);

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
    for (const r of facturacionFilt) {
      if (r.anio !== anioActual) continue;
      if (!map.has(r.sku)) map.set(r.sku, Array(12).fill(0));
      map.get(r.sku)[r.mes - 1] += Number(r.piezas) || 0;
    }
    return map;
  }, [facturacionFilt, anioActual]);

  const roadmapOrdenado = useMemo(() => {
    if (!esGlobal) return roadmap;
    return [...roadmap].sort((a, b) => {
      const sa = a.sort_order == null ? Number.MAX_SAFE_INTEGER : Number(a.sort_order);
      const sb = b.sort_order == null ? Number.MAX_SAFE_INTEGER : Number(b.sort_order);
      if (sa !== sb) return sa - sb;
      return String(a.sku || '').localeCompare(String(b.sku || ''));
    });
  }, [roadmap, esGlobal]);

  const normText = (s) => String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();

  const filasTabla = useMemo(() => {
    const terms = normText(busqueda).split(/\s+/).filter(Boolean);
    const rows = [];
    for (const r of roadmapOrdenado) {
      if (!esGlobal && !skusFacturados.has(r.sku)) continue;
      if (marcaSel.size > 0 && !marcaSel.has(r.marca)) continue;
      if (roadmapSel.size > 0 && !roadmapSel.has(r.rdmp)) continue;
      if (familiaSel) {
        const famNorm = ((r.familia || 'Sin familia').trim());
        const famCap = famNorm.charAt(0).toUpperCase() + famNorm.slice(1).toLowerCase();
        if (famCap !== familiaSel) continue;
      }
      const catNorm = ((r.categoria || '').trim());
      const catCap = catNorm ? catNorm.charAt(0).toUpperCase() + catNorm.slice(1).toLowerCase() : '';
      if (categoriaSel.size > 0 && !categoriaSel.has(catCap)) continue;
      if (esGlobal) {
        if (terms.length > 0) {
          const hay = normText(`${r.sku} ${r.descripcion} ${r.marca} ${catCap} ${r.familia} ${r.rdmp}`);
          if (!terms.every((t) => hay.includes(t))) continue;
        }
      } else {
        const q = busqueda.trim().toUpperCase();
        if (q) {
          const hay = String(r.sku || '').toUpperCase().includes(q)
                   || String(r.descripcion || '').toUpperCase().includes(q);
          if (!hay) continue;
        }
      }
      const piezas = matrizSku.get(r.sku) || Array(12).fill(0);
      const total = piezas.reduce((a, b) => a + b, 0);
      const cerrados = piezas.slice(0, mesActual - 1);
      const conVenta = cerrados.filter((v) => v > 0);
      const promedio = conVenta.length ? conVenta.reduce((a, b) => a + b, 0) / conVenta.length : 0;
      rows.push({ ...r, categoriaCap: catCap, piezas, total, promedio });
    }
    if (orden.col && orden.dir) {
      const factor = orden.dir === 'asc' ? 1 : -1;
      const strCols = new Set(['marca', 'sku', 'descripcion', 'rdmp']);
      const mesMatch = /^mes-(\d+)$/.exec(orden.col);
      if (strCols.has(orden.col)) {
        rows.sort((a, b) => String(a[orden.col] || '').localeCompare(String(b[orden.col] || '')) * factor);
      } else if (mesMatch) {
        const i = Number(mesMatch[1]);
        rows.sort((a, b) => ((a.piezas[i] || 0) - (b.piezas[i] || 0)) * factor);
      } else {
        rows.sort((a, b) => ((a[orden.col] || 0) - (b[orden.col] || 0)) * factor);
      }
    }
    return rows;
  }, [roadmapOrdenado, skusFacturados, busqueda, marcaSel, roadmapSel, categoriaSel, familiaSel, matrizSku, orden, esGlobal]);

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

  // Pill Apple · iOS blue con 4 niveles de intensidad
  const isDarkTable = theme.mode === 'dark';
  const heatClass = (v) => {
    if (v == null || v === 0) return null;
    if (v < 0) {
      // Negativos = rojo iOS
      return { bg: isDarkTable ? 'rgba(255,69,58,0.22)' : 'rgba(255,59,48,0.16)', color: theme.red || '#FF3B30', weight: 600 };
    }
    const r = v / maxCelda;
    const b = theme.accent || (isDarkTable ? '#0A84FF' : '#007AFF');
    if (r > 0.75) return { bg: b, color: '#FFFFFF', weight: 600 };
    if (r > 0.50) return { bg: isDarkTable ? 'rgba(10,132,255,0.45)' : 'rgba(0,122,255,0.35)', color: isDarkTable ? '#FFFFFF' : theme.text, weight: 600 };
    if (r > 0.25) return { bg: isDarkTable ? 'rgba(10,132,255,0.25)' : 'rgba(0,122,255,0.18)', color: theme.text };
    return { bg: isDarkTable ? 'rgba(10,132,255,0.12)' : 'rgba(0,122,255,0.08)', color: theme.textMuted };
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

  // MoM: mes actual vs mes anterior del MISMO año (si mesActual === 1 usa dic anterior)
  const momMesIdx = mesActual - 2; // 0-indexed
  const usePrevYearForMoM = momMesIdx < 0;
  const momMontoPrev = usePrevYearForMoM
    ? mensualPorAnio.monto[anioPrev][11]
    : mensualPorAnio.monto[anioActual][momMesIdx];
  const momPiezasPrev = usePrevYearForMoM
    ? mensualPorAnio.piezas[anioPrev][11]
    : mensualPorAnio.piezas[anioActual][momMesIdx];
  const momMontoPct = momMontoPrev ? ((mesActualData.monto - momMontoPrev) / momMontoPrev * 100) : null;
  const momPiezasDelta = momPiezasPrev ? mesActualData.piezas - momPiezasPrev : null;
  const momMesAnteriorLabel = usePrevYearForMoM
    ? `${MESES_LARGO[11]} ${anioPrev}`
    : `${MESES_LARGO[momMesIdx]} ${anioActual}`;

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

  // ── Helpers Apple ──
  const isDark = theme.mode === 'dark';
  const invBg = theme.surfaceInverse || (isDark ? '#F5F5F7' : '#000000');
  const invText = theme.textOnInverse || (isDark ? '#1D1D1F' : '#F5F5F7');
  const invMuted = isDark ? 'rgba(29,29,31,0.72)' : 'rgba(245,245,247,0.72)';
  const green = theme.green || '#34C759';
  const red = theme.red || '#FF3B30';
  const blue = theme.accent || '#007AFF';
  const orange = theme.orange || '#FF9500';

  const KpiApple = ({ inverse, Icon, badgeCol, lbl, val, delta, deltaCol, sub }) => (
    <div style={{
      background: inverse ? invBg : theme.surface,
      color: inverse ? invText : theme.text,
      border: inverse ? 'none' : `1px solid ${theme.border}`,
      borderRadius: 14, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10,
      minHeight: 60, fontFamily: TYPO.fontText,
    }}>
      <div style={{ width: 26, height: 26, borderRadius: 8, background: `${badgeCol}22`, color: badgeCol, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon style={{ width: 13, height: 13 }} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: inverse ? invMuted : theme.textMuted, fontWeight: 600, margin: 0 }}>{lbl}</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
          <p style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: inverse ? invText : theme.text }}>{val}</p>
          {delta && <span style={{ fontSize: 11, fontWeight: 500, color: deltaCol, fontVariantNumeric: 'tabular-nums' }}>{delta}</span>}
        </div>
        {sub && <p style={{ fontSize: 10, color: inverse ? invMuted : theme.textMuted, margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>{sub}</p>}
      </div>
    </div>
  );

  return (
    <div style={{ padding: '10px 6px', background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%' }} className="space-y-3">
      {/* Header apple */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, padding: '0 4px', marginBottom: 4 }}>
        <div>
          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: theme.textMuted, marginBottom: 4, fontFamily: TYPO.fontText, fontWeight: 500 }}>
            Bloque · Sell In · YTD ene–{MESES[mesActual - 1]} {anioActual}
          </p>
          <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em', fontFamily: TYPO.fontDisplay, color: theme.text, margin: 0, lineHeight: 1.1 }}>
            Sell In · Facturación {esGlobal ? 'consolidada' : `al cliente`}.
          </h2>
          <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 4, fontFamily: TYPO.fontText, fontVariantNumeric: 'tabular-nums' }}>
            {esGlobal ? `${facturacion.length.toLocaleString('es-MX')} rows · Fuente ERP Acteck` : `${meta.nombre} · ${meta.marca}`} · <strong style={{ color: theme.text, fontWeight: 500 }}>{formatMXN(totalYTD.monto)}</strong> YTD
          </p>
        </div>
      </div>

      {/* KPI row · alternado inverse (2do y 4to) */}
      <div className={`grid grid-cols-1 ${esGlobal ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-3'} gap-2.5`}>
        <KpiApple
          Icon={Calendar} badgeCol={orange}
          lbl={`${MESES_LARGO[mesActual - 1]} MTD · ${pctMTD != null ? pctMTD.toFixed(0) + '% cuota' : 'sin cuota'}`}
          val={fmtMoneyShort(mesActualData.monto)}
          delta={mesActualData.cuota ? `/ ${fmtMoneyShort(mesActualData.cuota.ideal)}` : null}
          deltaCol={pctMTD == null ? theme.textMuted : pctMTD >= 90 ? green : pctMTD >= 60 ? orange : red}
          sub={`${fmtInt(mesActualData.piezas)} piezas`}
        />
        <KpiApple inverse
          Icon={TrendingUp} badgeCol={blue}
          lbl={`YTD ${anioActual} · ${pctYTD != null ? pctYTD.toFixed(0) + '% cuota' : 'sin cuota'}`}
          val={fmtMoneyShort(totalYTD.monto)}
          delta={cuotaYTD.ideal ? `/ ${fmtMoneyShort(cuotaYTD.ideal)}` : null}
          deltaCol={pctYTD == null ? invMuted : pctYTD >= 90 ? green : pctYTD >= 60 ? orange : red}
          sub={`${fmtInt(totalYTD.piezas)} piezas · ${skusFacturados.size} SKUs`}
        />
        <KpiApple
          Icon={Activity} badgeCol={theme.pink || '#FF2D55'}
          lbl={`${MESES_LARGO[mesActual - 1]} vs ${anioPrev} (YoY)`}
          val={fmtMoneyShort(mesActualData.monto)}
          delta={yoyMonto != null ? `${yoyMonto >= 0 ? '↑' : '↓'}${Math.abs(yoyMonto).toFixed(1)}%` : null}
          deltaCol={yoyMonto == null ? theme.textMuted : yoyMonto >= 0 ? green : red}
          sub={`vs ${fmtMoneyShort(mesActualData.prevMonto)}${yoyPiezas != null ? ` · ${yoyPiezas >= 0 ? '↑' : '↓'} ${fmtInt(Math.abs(yoyPiezas))} pz` : ''}`}
        />
        {esGlobal && (
          <KpiApple inverse
            Icon={Target} badgeCol={theme.purple || '#AF52DE'}
            lbl={`vs ${momMesAnteriorLabel} (MoM)`}
            val={fmtMoneyShort(mesActualData.monto)}
            delta={momMontoPct != null ? `${momMontoPct >= 0 ? '↑' : '↓'}${Math.abs(momMontoPct).toFixed(1)}%` : null}
            deltaCol={momMontoPct == null ? invMuted : momMontoPct >= 0 ? green : red}
            sub={`vs ${fmtMoneyShort(momMontoPrev)}${momPiezasDelta != null ? ` · ${momPiezasDelta >= 0 ? '↑' : '↓'} ${fmtInt(Math.abs(momPiezasDelta))} pz` : ''}`}
          />
        )}
      </div>

      {/* Chart AreaChart Apple Health + Composición familia · misma card */}
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '14px 18px', fontFamily: TYPO.fontText }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
              <h4 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, margin: 0 }}>Evolución mensual.</h4>
              <div style={{ display: 'inline-flex', gap: 10, fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 2, borderRadius: 1, background: blue }} />{anioActual}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 2, borderRadius: 1, background: theme.textMuted, opacity: 0.55 }} />{anioPrev}</span>
                {cuotaAnual.ideal > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 2, borderRadius: 1, background: orange }} />Cuota</span>}
              </div>
            </div>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <AreaChart data={chartData} margin={{ top: 6, right: 4, left: -6, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillSellIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={blue} stopOpacity={0.20} />
                      <stop offset="100%" stopColor={blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={theme.border} vertical={false} strokeOpacity={0.6} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: theme.textMuted }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tickFormatter={(v) => fmtMoneyShort(v)} tick={{ fontSize: 10, fill: theme.textMuted }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip formatter={(v) => formatMXN(v)} contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }} labelStyle={{ color: theme.textMuted, fontWeight: 500 }} />
                  {/* Cuota como línea dashed superpuesta */}
                  {cuotaAnual.ideal > 0 && <Area type="monotone" dataKey="cuotaIdeal" stroke={orange} strokeWidth={1.4} strokeDasharray="4 3" fill="none" dot={false} isAnimationActive={false} />}
                  <Area type="monotone" dataKey="monto2025" stroke={theme.textMuted} strokeOpacity={0.55} strokeWidth={1.4} fill="none" dot={false} isAnimationActive={false} />
                  <Area type="monotone" dataKey="monto2026" stroke={blue} strokeWidth={2.2} fill="url(#fillSellIn)" dot={false} activeDot={{ r: 4, fill: theme.surface, stroke: blue, strokeWidth: 2 }} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ borderLeft: `1px solid ${theme.border}`, paddingLeft: 20 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <h4 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, margin: 0 }}>
                Composición familia.
                {familiaSel && (
                  <button onClick={() => setFamiliaSel(null)}
                    style={{ marginLeft: 8, background: theme.text, color: theme.surface, border: 0, borderRadius: 999, padding: '2px 10px', fontSize: 10, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {familiaSel} · ✕
                  </button>
                )}
              </h4>
              <span style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{familiasYTD.length} · click filtra</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '112px 1fr', gap: 12, alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 112, height: 112 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={familiasYTD} dataKey="monto" cx="50%" cy="50%" innerRadius={36} outerRadius={54} paddingAngle={1} stroke="none"
                         onClick={(d) => setFamiliaSel(familiaSel === d.name ? null : d.name)}
                         cursor="pointer" isAnimationActive={false}>
                      {familiasYTD.map((c, i) => (
                        <Cell key={i} fill={c.color}
                              opacity={familiaSel && familiaSel !== c.name ? 0.25 : 1}
                              stroke={familiaSel === c.name ? theme.text : 'none'}
                              strokeWidth={familiaSel === c.name ? 2 : 0} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatMXN(v)} contentStyle={{ fontSize: 11, borderRadius: 8, background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: 8, color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{familiaSel || 'Total'}</div>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.025em', color: theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmtMoneyShort(totalYTD.monto)}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 3 }}>
                {familiasYTD.slice(0, 5).map((c, i) => {
                  const active = familiaSel === c.name;
                  const dim = familiaSel && !active;
                  return (
                    <div key={c.name}
                      onClick={() => setFamiliaSel(active ? null : c.name)}
                      style={{ display: 'grid', gridTemplateColumns: '12px 6px minmax(0, 1fr) 55px 40px', alignItems: 'center', gap: 6, padding: '2px 4px', borderRadius: 6, cursor: 'pointer',
                        background: active ? (theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)') : 'transparent',
                        opacity: dim ? 0.5 : 1, transition: 'background 120ms, opacity 120ms' }}>
                      <span style={{ fontSize: 9, color: theme.textSubtle, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>#{i + 1}</span>
                      <span style={{ width: 6, height: 6, borderRadius: 2, background: c.color }} />
                      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 500, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.name}>{c.name}</span>
                      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{fmtMoneyShort(c.monto)}</span>
                      <span style={{ fontSize: 9, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{c.pct.toFixed(1)}%</span>
                    </div>
                  );
                })}
                {familiasYTD.length > 5 && !familiaSel && (
                  <div style={{ padding: '2px 4px', display: 'grid', gridTemplateColumns: '12px 6px 1fr', alignItems: 'center', gap: 6, opacity: 0.6 }}>
                    <span></span><span></span>
                    <span style={{ fontSize: 10, color: theme.textMuted, fontStyle: 'italic' }}>+ {familiasYTD.length - 5} familias más</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla detalle SKU */}
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', borderBottom: `1px solid ${theme.border}`, background: theme.surface, flexWrap: 'wrap' }}>
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
            {esGlobal && orden.col && (
              <button onClick={() => setOrden({ col: null, dir: null })}
                title="Restablecer el orden original del roadmap"
                className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                Restablecer orden
              </button>
            )}
            <button onClick={exportarExcel} disabled={filasTabla.length === 0}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-40">
              <Download className="w-3.5 h-3.5" /> Exportar Excel
            </button>
          </div>
        </div>
        <div className="overflow-auto" style={{ maxHeight: esGlobal ? '82vh' : '65vh' }}>
          <table className="w-full text-[11px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                {[
                  { label: 'Marca',       align: 'left'   },
                  { label: 'SKU',         align: 'left'   },
                  { label: 'Descripción', align: 'left'   },
                  { label: 'Roadmap',     align: 'center' },
                  ...MESES.map((m) => ({ label: m, align: 'right' })),
                  ...(esGlobal ? [{ label: 'Trend', align: 'center' }] : []),
                  { label: 'Promedio', align: 'right', sort: 'promedio' },
                  { label: 'Total',    align: 'right', sort: 'total' },
                ].map((h, i) => (
                  <th key={i}
                    style={{
                      textAlign: h.align, padding: '8px 6px',
                      fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9,
                      textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted,
                      position: 'sticky', top: 0, background: theme.surface, zIndex: 1,
                      borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap',
                    }}>
                    {h.sort ? <SortHeader col={h.sort} label={h.label} /> : h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filasTabla.map((r) => {
                const rmpTheme = isDarkTable ? ROADMAP_COLOR_DARK : ROADMAP_COLOR;
                const rmp = rmpTheme[r.rdmp] || { bg: 'rgba(0,0,0,0.05)', text: theme.textMuted };
                const abierto = esGlobal && skuAbierto === r.sku;
                return (
                  <React.Fragment key={r.sku}>
                    <tr
                      onClick={esGlobal ? () => setSkuAbierto(abierto ? null : r.sku) : undefined}
                      style={{
                        borderTop: `1px solid ${theme.border}`,
                        background: abierto ? (isDarkTable ? 'rgba(10,132,255,0.10)' : 'rgba(0,122,255,0.06)') : 'transparent',
                        cursor: esGlobal ? 'pointer' : 'default',
                      }}
                      onMouseEnter={(e) => { if (!abierto) e.currentTarget.style.background = isDarkTable ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'; }}
                      onMouseLeave={(e) => { if (!abierto) e.currentTarget.style.background = 'transparent'; }}>
                      <td style={{ padding: '4px 6px', color: theme.textMuted, fontSize: 10, whiteSpace: 'nowrap', fontFamily: TYPO.fontText, width: esGlobal ? 60 : 70 }}>{r.marca || '—'}</td>
                      <td style={{ padding: '4px 6px', color: theme.text, fontSize: 10, fontWeight: 600, fontFamily: '-apple-system, "SF Mono", ui-monospace, monospace', whiteSpace: 'nowrap', width: esGlobal ? 88 : 96 }}>
                        {esGlobal ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <ChevronRight style={{ width: 12, height: 12, color: theme.accent || '#007AFF', flexShrink: 0, transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }} />
                            {r.sku}
                          </span>
                        ) : r.sku}
                      </td>
                      <td style={{ padding: '4px 6px', color: theme.text, fontSize: 11, fontWeight: 500, fontFamily: TYPO.fontDisplay, letterSpacing: '-0.005em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: esGlobal ? 220 : 280 }} title={r.descripcion}>
                        {r.descripcion || '—'}
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'center', width: 70 }}>
                        {r.rdmp && (
                          <span style={{
                            fontFamily: TYPO.fontText, fontSize: 9, fontWeight: 600,
                            padding: '3px 8px', borderRadius: 999,
                            background: rmp.bg, color: rmp.text,
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                            display: 'inline-block',
                          }}>{r.rdmp}</span>
                        )}
                      </td>
                      {r.piezas.map((v, i) => {
                        const h = heatClass(v);
                        return (
                          <td key={i} style={{
                            padding: '3px 3px', textAlign: 'right', whiteSpace: 'nowrap',
                            width: esGlobal ? 44 : 56, fontVariantNumeric: 'tabular-nums',
                          }}>
                            {v ? (
                              <span style={{
                                display: 'inline-block', padding: '3px 8px', borderRadius: 999,
                                fontFamily: TYPO.fontText, fontSize: 11,
                                background: h?.bg || 'transparent',
                                color: h?.color || theme.textMuted,
                                fontWeight: h?.weight || 500,
                                minWidth: 32, textAlign: 'center',
                              }}>{fmtInt(v)}</span>
                            ) : (
                              <span style={{ color: theme.textSubtle, fontFamily: TYPO.fontText, fontSize: 11 }}>—</span>
                            )}
                          </td>
                        );
                      })}
                      {esGlobal && (
                        <td style={{ padding: '3px 2px', textAlign: 'center', width: 56 }}>
                          <RowSparkline piezas={r.piezas} mesActual={mesActual} />
                        </td>
                      )}
                      <td style={{ padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: theme.textMuted, background: theme.bg, fontFamily: TYPO.fontText, fontSize: 11, fontWeight: 500, width: esGlobal ? 60 : 70 }}>
                        {r.promedio ? fmtInt(r.promedio) : '—'}
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: theme.text, background: theme.bg, fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em', width: esGlobal ? 64 : 70 }}>
                        {fmtInt(r.total)}
                      </td>
                    </tr>
                    {abierto && (
                      <tr>
                        <td colSpan={esGlobal ? 19 : 18} style={{ padding: 0, background: '#FFFFFF', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}>
                          <DrillDownBoundary sku={r.sku}>
                            <SellInDrillDown
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
                          </DrillDownBoundary>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              <tr style={{ borderTop: `2px solid ${theme.border}`, background: theme.bg }}>
                <td colSpan={4} style={{ padding: '8px 10px', fontFamily: TYPO.fontText, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.text }}>
                  Total · {filasTabla.length} SKUs
                </td>
                {totalesFila.mes.map((v, i) => (
                  <td key={i} style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: v ? theme.text : theme.textSubtle, letterSpacing: '-0.005em' }}>
                    {v ? fmtInt(v) : '—'}
                  </td>
                ))}
                {esGlobal && (
                  <td style={{ padding: '8px 2px', textAlign: 'center' }}>
                    <RowSparkline piezas={totalesFila.mes} mesActual={mesActual} />
                  </td>
                )}
                <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.text }}>
                  {totalesFila.promedio ? fmtInt(totalesFila.promedio) : '—'}
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 700, color: theme.text, letterSpacing: '-0.01em' }}>
                  {fmtInt(totalesFila.total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Sparkline compacto por fila (12 meses). Marca los meses cerrados en cyan
// y los futuros en gris. Punto en el último mes cerrado.
function RowSparkline({ piezas, mesActual }) {
  const closed = Math.max(0, mesActual - 1);
  const max = Math.max(1, ...piezas);
  const y = (v) => 18 - (v / max) * 16;
  const x = (i) => 2 + i * 4;
  const pts = piezas.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)},${y(v || 0)}`).join(" ");
  const lastIdx = closed > 0 ? closed - 1 : 0;
  return (
    <svg viewBox="0 0 50 20" preserveAspectRatio="none"
      style={{ width: 50, height: 20, display: "block", margin: "0 auto" }}>
      {pts && <path d={pts} stroke="#0EA5E9" strokeWidth="1.4" fill="none"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />}
      {piezas[lastIdx] > 0 && (
        <circle cx={x(lastIdx)} cy={y(piezas[lastIdx] || 0)} r="1.6" fill="#0EA5E9" />
      )}
    </svg>
  );
}

