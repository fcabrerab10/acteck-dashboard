import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';
import {
  ShoppingCart, Search, Download, ChevronDown, Check,
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ReferenceLine,
  CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import * as XLSX from 'xlsx-js-style';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const ACCENT = '#0EA5E9';
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

export default function SellInDicotech() {
  const CLIENTE_KEY = 'dicotech';
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

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [fact, rdmp, ct] = await Promise.all([
        fetchAll('facturacion_clientes', 'sku,anio,mes,piezas,monto',
          (q) => q.eq('cliente_key', CLIENTE_KEY).in('anio', [anioPrev, anioActual])),
        fetchAll('roadmap_sku', 'sku,marca,descripcion,categoria,familia,rdmp,sort_order'),
        fetchAll('cuotas_mensuales', 'mes,anio,cuota_min,cuota_ideal',
          (q) => q.eq('cliente', CLIENTE_KEY).eq('anio', anioActual)),
      ]);
      setFacturacion(fact);
      setRoadmap(rdmp);
      setCuotas(ct);
      setLoading(false);
    })();
  }, [anioActual, anioPrev]);

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

  const filasTabla = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    const rows = [];
    for (const r of roadmap) {
      if (!skusFacturados.has(r.sku)) continue;
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
      rows.push({ ...r, categoriaCap: catCap, piezas, total });
    }
    return rows;
  }, [roadmap, skusFacturados, busqueda, marcaSel, roadmapSel, categoriaSel, matrizSku]);

  const totalesFila = useMemo(() => {
    const t = Array(12).fill(0);
    for (const r of filasTabla) for (let i = 0; i < 12; i++) t[i] += r.piezas[i];
    return { mes: t, total: t.reduce((a, b) => a + b, 0) };
  }, [filasTabla]);

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
    const HEADERS = ['Marca', 'SKU', 'Descripción', 'Categoría', 'Roadmap', ...MESES, 'Total'];
    const rows = filasTabla.map((r) => [
      r.marca || '', r.sku || '', r.descripcion || '', r.categoriaCap || '', r.rdmp || '',
      ...r.piezas.map((v) => v || null), r.total,
    ]);
    const totRow = ['TOTAL', `${filasTabla.length} SKUs`, '', '', '', ...totalesFila.mes.map((v) => v || null), totalesFila.total];
    const titulo = `Sell In Dicotech · ${anioActual}`;
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
      ...MESES.map(() => ({ wch: 8 })), { wch: 10 },
    ];
    ws['!freeze'] = { xSplit: 5, ySplit: 2 };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sell In');
    XLSX.writeFile(wb, `Sell In Dicotech ${anioActual}.xlsx`);
  };

  if (loading) {
    return <div className="p-12 text-center text-gray-400">Cargando Sell In de Dicotech…</div>;
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
    <div className="max-w-none mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 text-[11px] font-semibold mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
            Dicotech · Acteck
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-gray-700" /> Sell In
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Facturación al cliente · Fuente ERP Acteck · {facturacion.length.toLocaleString('es-MX')} rows cargados
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
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded" style={{ background: '#CBD5E1' }} /> {anioPrev}</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ background: ACCENT }} /> {anioActual}</span>
              {cuotaAnual.ideal > 0 && <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-0.5" style={{ background: '#6B7280', borderTop: '1px dashed #6B7280' }} /> Cuota
              </span>}
            </div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => fmtMoneyShort(v)} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={55} />
                <Tooltip
                  formatter={(v, name) => [formatMXN(v), name]}
                  labelStyle={{ color: '#374151', fontWeight: 600 }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
                />
                <Bar dataKey="monto2025" name={String(anioPrev)} fill="#CBD5E1" radius={[3, 3, 0, 0]} maxBarSize={32} />
                <Line dataKey="monto2026" name={String(anioActual)} stroke={ACCENT} strokeWidth={2.5} dot={{ r: 3.5, fill: ACCENT }} activeDot={{ r: 5 }} connectNulls={false} />
                <Line dataKey="cuotaIdeal" name="Cuota ideal" stroke="#6B7280" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
              </ComposedChart>
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
                {['Marca','SKU','Descripción','Roadmap', ...MESES, 'Total'].map((h, i) => (
                  <th key={i}
                    className="py-1.5 px-2 font-medium uppercase tracking-wider text-[9px] text-gray-500"
                    style={{
                      textAlign: i < 3 ? 'left' : i === 3 ? 'center' : 'right',
                      position: 'sticky', top: 0, background: '#F9FAFB', zIndex: 1, borderBottom: '1px solid #E5E7EB',
                      whiteSpace: 'nowrap',
                    }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filasTabla.map((r) => {
                const rmp = ROADMAP_COLOR[r.rdmp] || { bg: '#F1EFE8', text: '#2C2C2A' };
                return (
                  <tr key={r.sku} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="py-1 px-1.5 text-gray-600 text-[10px] whitespace-nowrap" style={{ width: 70 }}>{r.marca || '—'}</td>
                    <td className="py-1 px-1.5 font-mono text-gray-700 text-[10px] whitespace-nowrap" style={{ width: 96 }}>{r.sku}</td>
                    <td className="py-1 px-1.5 text-gray-800 truncate" style={{ maxWidth: 320 }} title={r.descripcion}>
                      {r.descripcion || '—'}
                    </td>
                    <td className="py-1 px-1.5 text-center" style={{ width: 60 }}>
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
                            width: 44,
                          }}>
                          {v ? fmtInt(v) : '—'}
                        </td>
                      );
                    })}
                    <td className="py-1 px-2 text-right tabular-nums font-semibold text-gray-800 bg-gray-50" style={{ width: 60 }}>
                      {fmtInt(r.total)}
                    </td>
                  </tr>
                );
              })}
              <tr className="font-semibold text-gray-800 bg-gray-50" style={{ borderTop: '2px solid #E5E7EB' }}>
                <td colSpan={4} className="py-1.5 px-2 text-[10px] uppercase tracking-wider text-gray-600">Total · {filasTabla.length} SKUs</td>
                {totalesFila.mes.map((v, i) => (
                  <td key={i} className="py-1.5 px-1.5 text-right tabular-nums">{v ? fmtInt(v) : '—'}</td>
                ))}
                <td className="py-1.5 px-2 text-right tabular-nums">{fmtInt(totalesFila.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
