import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import {
  Activity, Search, X, TrendingUp, TrendingDown, AlertTriangle, Tag, Download, ChevronDown, ChevronRight, Check, Sparkles, ArrowRight, ArrowUp,
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

function MultiSelect({ label, options, selected, onChange, width = 140 }) {
  const { theme } = useTheme();
  const P = paletteFromTheme(theme);
  const isDark = theme.mode === 'dark';
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const isAll = selected.size === 0;
  const activo = !isAll;
  const toggle = (v) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange(next);
  };
  return (
    <div style={{ position: 'relative', width, fontFamily: TYPO.fontText }} ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', height: 32, padding: '0 12px',
          background: activo ? `${P.accent}1A` : theme.surface,
          border: `1px solid ${activo ? P.accent : theme.border}`, borderRadius: 999,
          fontSize: 11, color: activo ? P.accent : theme.text,
          fontWeight: activo ? 600 : 500, fontFamily: 'inherit', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
        }}
        onMouseEnter={(e) => { if (!activo) e.currentTarget.style.borderColor = theme.textMuted; }}
        onMouseLeave={(e) => { if (!activo) e.currentTarget.style.borderColor = theme.border; }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
          {activo && <span style={{ marginLeft: 4, fontWeight: 700 }}>· {selected.size}</span>}
        </span>
        <ChevronDown style={{ width: 12, height: 12, opacity: 0.7, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }} strokeWidth={2.2} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', zIndex: 20, marginTop: 4, width: '100%',
          background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12,
          boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.08)',
          maxHeight: 280, overflow: 'auto', fontFamily: TYPO.fontText,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 10px', fontSize: 10, borderBottom: `1px solid ${theme.border}`,
            position: 'sticky', top: 0, background: theme.surface, zIndex: 1,
          }}>
            <button style={{ background: 'transparent', border: 0, color: P.accent, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 2 }}
              onClick={() => onChange(new Set(options))}>Todas</button>
            <button style={{ background: 'transparent', border: 0, color: theme.textMuted, fontSize: 10.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', padding: 2 }}
              onClick={() => onChange(new Set())}>Limpiar</button>
          </div>
          {options.map((o) => {
            const sel = selected.has(o);
            return (
              <button key={o} onClick={() => toggle(o)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', fontSize: 11.5, background: 'transparent',
                  border: 0, color: theme.text, cursor: 'pointer', fontFamily: 'inherit',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <span style={{
                  width: 16, height: 16, borderRadius: 999,
                  border: sel ? `1px solid ${P.accent}` : `1.5px solid ${isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.20)'}`,
                  background: sel ? P.accent : 'transparent',
                  color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 120ms',
                }}>
                  {sel && <Check style={{ width: 10, height: 10 }} strokeWidth={3} />}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o}</span>
              </button>
            );
          })}
          {options.length === 0 && <div style={{ padding: '10px 12px', fontSize: 11, color: theme.textMuted }}>Sin opciones</div>}
        </div>
      )}
    </div>
  );
}

export default function EstrategiaPrecios() {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const P = paletteFromTheme(theme);
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
    const incluyeDico = listasVisibles.includes('DICOTECH');

    const cols = [];
    cols.push({ header: 'Marca',       get: (r) => r.marca || '',       width: 12 });
    cols.push({ header: 'SKU',         get: (r) => r.sku || '',         width: 14 });
    cols.push({ header: 'Descripción', get: (r) => r.descripcion || '', width: 50 });
    cols.push({ header: 'Roadmap',     get: (r) => r.rdmp || '',        width: 10 });
    const bajoEsMenor = (r) => {
      const bajo = r.bajo?.precio_bajo;
      if (bajo == null) return false;
      const p = r.precios || {};
      const precioAAA = p['Mayoreo AAA'] ?? null;
      const precioAAAefectivo = r.promo && precioAAA != null
        ? precioAAA * (1 - Number(r.promo.promo_pct))
        : precioAAA;
      const lista = LISTAS_MOSTRAR
        .map((l) => (l === 'Mayoreo AAA' ? precioAAAefectivo : p[l]))
        .filter((v) => v != null && !isNaN(v));
      if (!lista.length) return false;
      return bajo < Math.min(...lista);
    };
    if (verPrecioBajo) {
      cols.push({ header: 'Precio Bajo Facturado', get: (r) => (bajoEsMenor(r) ? r.bajo.precio_bajo : null), width: 16, money: true });
      cols.push({ header: 'Piezas Precio Bajo',    get: (r) => (bajoEsMenor(r) ? r.bajo.piezas_bajo : null), width: 12, int: true });
    }
    if (incluyeAAA) {
      cols.push({
        header: 'Mayoreo AAA',
        get: (r) => {
          const precio = r.precios?.['Mayoreo AAA'] ?? null;
          if (precio == null) return null;
          return r.promo ? precio * (1 - Number(r.promo.promo_pct)) : precio;
        },
        width: 14, money: true, highlight: 'FEF3C7',
      });
    }
    if (incluyeDico) {
      cols.push({ header: 'DICOTECH', get: (r) => r.precios?.['DICOTECH'] ?? null, width: 12, money: true });
    }

    const HEADERS = cols.map((c) => c.header);
    const nCols = HEADERS.length;
    const rowsData = filas.map((r) => cols.map((c) => c.get(r)));

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
    const titleStyle = { ...blackHeader, font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 14 } };

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

    for (let i = 0; i < rowsData.length; i++) {
      const rowIdx = i + 2;
      for (let c = 0; c < nCols; c++) {
        const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
        const cell = ws[addr];
        const col = cols[c];
        if (!cell) {
          if (col.highlight) {
            ws[addr] = { t: 's', v: '', s: { fill: { patternType: 'solid', fgColor: { rgb: col.highlight } } } };
          }
          continue;
        }
        cell.s = cell.s || {};
        if (col.money) cell.z = moneyFmt;
        if (col.int && cell.v != null) cell.z = '#,##0';
        if (col.highlight) {
          cell.s.fill = { patternType: 'solid', fgColor: { rgb: col.highlight } };
        }
      }
    }

    ws['!cols'] = cols.map((c) => ({ wch: c.width }));
    ws['!freeze'] = { xSplit: 0, ySplit: 2 };
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 1, c: 0 }, e: { r: rowsData.length + 1, c: nCols - 1 } }) };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lista de Precios');
    XLSX.writeFile(wb, `${tituloExcel}.xlsx`);
  };

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: theme.textMuted, fontFamily: TYPO.fontText }}>
        <Activity style={{ width: 32, height: 32, marginBottom: 12 }} />
        <div style={{ fontSize: 12 }}>Cargando estrategia de precios…</div>
      </div>
    );
  }

  // KPIs consolidados
  const skusConPrecio = filas.filter((r) => Object.keys(r.precios).length > 0).length;
  const skusPrecioBajo = filas.filter((r) => {
    if (!r.bajo?.precio_bajo) return false;
    const listasVals = Object.values(r.precios || {}).filter((v) => v != null);
    if (!listasVals.length) return false;
    return r.bajo.precio_bajo < Math.min(...listasVals);
  }).length;
  const promosPorCliente = new Map();
  promos.forEach((p) => {
    const c = p.campania || 'General';
    promosPorCliente.set(c, (promosPorCliente.get(c) || 0) + 1);
  });
  const topPromo = [...promosPorCliente.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div style={{ padding: '10px 6px', background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%' }} className="space-y-3">
      {/* Header */}
      <div style={{ padding: '0 4px', marginBottom: 4 }}>
        <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: theme.textMuted, marginBottom: 4, fontFamily: TYPO.fontText, fontWeight: 500 }}>
          Dirección Comercial
        </p>
        <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em', fontFamily: TYPO.fontDisplay, color: theme.text, margin: 0, lineHeight: 1.1 }}>
          Estrategia de Precios.
        </h2>
        <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 4, fontFamily: TYPO.fontText, fontVariantNumeric: 'tabular-nums' }}>
          <strong style={{ color: theme.text, fontWeight: 500 }}>{fmtInt(roadmap.length)} SKUs</strong> · {fmtInt(precios.length)} precios · {promos.length} promos vigentes
        </p>
      </div>

      {/* 4 KPI cards Apple Fitness */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <KpiCardEP theme={theme} P={P} icon={Tag} iconColor={P.accent} chip="SKUs"
          value={fmtInt(roadmap.length)}
          note={<><strong style={{ color: theme.text }}>{fmtInt(skusConPrecio)}</strong> con precio en al menos 1 lista.</>}
        />
        <KpiCardEP theme={theme} P={P} icon={Sparkles} iconColor={P.purple} chip="Promos"
          value={fmtInt(promos.length)}
          note={topPromo ? <><strong style={{ color: theme.text }}>{topPromo[0]}</strong> concentra {topPromo[1]}.</> : <>Sin promos vigentes.</>}
        />
        <KpiCardEP theme={theme} P={P} icon={TrendingUp} iconColor={P.green} chip="Listas activas"
          value={fmtInt(LISTAS_MOSTRAR.length)}
          note={<>Mayoreo AAA + <strong style={{ color: theme.text }}>{LISTAS_MOSTRAR.length - 1} listas cliente</strong> configuradas.</>}
        />
        <KpiCardEP theme={theme} P={P} icon={AlertTriangle} iconColor={P.orange} chip="Precio bajo"
          value={fmtInt(skusPrecioBajo)}
          valueColor={skusPrecioBajo > 0 ? P.orange : theme.text}
          note={<>SKUs facturados <strong style={{ color: theme.text }}>debajo</strong> de todas las listas.</>}
        />
      </div>

      {/* Toolbar iOS pill */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{
          flex: 1, minWidth: 240, maxWidth: 380, display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 12px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 999, height: 32,
        }}>
          <Search style={{ width: 12, height: 12, color: theme.textMuted }} strokeWidth={2.2} />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar SKU o descripción (AC-943154, monitor SP270…)"
            style={{ border: 0, outline: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 12, color: theme.text, flex: 1 }} />
          {busqueda && (
            <button onClick={() => setBusqueda('')}
              style={{ background: 'transparent', border: 0, color: theme.textMuted, cursor: 'pointer', padding: 2, display: 'flex' }}>
              <X style={{ width: 12, height: 12 }} strokeWidth={2} />
            </button>
          )}
        </div>
        <MultiSelect label="Marcas" options={marcasOpciones} selected={marcaSel} onChange={setMarcaSel} width={140} />
        <MultiSelect label="Categorías" options={categoriasOpciones} selected={categoriaSel} onChange={setCategoriaSel} width={150} />
        <MultiSelect label="Roadmap" options={roadmapOpciones} selected={roadmapSel} onChange={setRoadmapSel} width={130} />
        <MultiSelect label="Listas" options={OPCIONES_LISTAS} selected={listasSel} onChange={setListasSel} width={140} />
        <button onClick={exportarExcel} disabled={filas.length === 0}
          style={{
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', height: 32, borderRadius: 999,
            background: filas.length === 0 ? theme.bg : P.accent,
            color: filas.length === 0 ? theme.textMuted : '#FFFFFF',
            border: filas.length === 0 ? `1px solid ${theme.border}` : 0,
            fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
            cursor: filas.length === 0 ? 'not-allowed' : 'pointer', letterSpacing: '-0.01em',
          }}>
          <Download style={{ width: 12, height: 12 }} strokeWidth={2} />
          Exportar ({fmtInt(filas.length)})
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
        <span style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
          <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmtInt(filas.length)}</strong> SKUs en orden del roadmap
        </span>
        <span style={{ fontSize: 10, color: theme.textMuted }}>Click en fila para drill-down</span>
      </div>

      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflow: 'auto', maxHeight: '70vh' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr>
                {[
                  { label: 'Marca',        align: 'left'   },
                  { label: 'SKU',          align: 'left'   },
                  { label: 'Descripción',  align: 'left'   },
                  { label: 'Roadmap',      align: 'center' },
                  ...(verPrecioBajo ? [{ label: 'Precio bajo', sub: 'facturado', align: 'right' }] : []),
                  ...listasVisibles.map((l) => ({ label: LISTAS_LBL[l], align: 'right' })),
                ].map((h, i) => (
                  <th key={i}
                    style={{
                      position: 'sticky', top: 0, background: theme.surface, zIndex: 1,
                      textAlign: h.align, padding: '9px 8px',
                      fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9,
                      textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted,
                      borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap',
                    }}>
                    {h.label}
                    {h.sub && (
                      <span style={{ display: 'block', fontSize: 7.5, fontWeight: 500, letterSpacing: '0.04em', color: theme.textSubtle, textTransform: 'uppercase', marginTop: 1 }}>
                        {h.sub}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((r) => {
                const rmapChip = roadmapChip(theme, P, r.rdmp);
                const promo = r.promo;
                const precioAAA = r.precios['Mayoreo AAA'];
                const precioAAAneto = promo && precioAAA != null
                  ? precioAAA * (1 - Number(promo.promo_pct))
                  : precioAAA;
                const abierto = skuAbierto === r.sku;
                const preciosLista = LISTAS_MOSTRAR
                  .map((l) => (l === 'Mayoreo AAA' ? precioAAAneto : r.precios[l]))
                  .filter((v) => v != null && !isNaN(v));
                const minLista = preciosLista.length ? Math.min(...preciosLista) : null;
                const mostrarBajo = r.bajo?.precio_bajo != null && minLista != null && r.bajo.precio_bajo < minLista;
                return (
                  <React.Fragment key={r.sku}>
                    <tr onClick={() => setSkuAbierto(abierto ? null : r.sku)}
                      style={{
                        cursor: 'pointer',
                        background: abierto ? `${P.accent}${isDark ? '1A' : '0D'}` : 'transparent',
                        height: 36, transition: 'background 100ms',
                      }}
                      onMouseEnter={(e) => { if (!abierto) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'; }}
                      onMouseLeave={(e) => { if (!abierto) e.currentTarget.style.background = 'transparent'; }}>
                      <td style={{ padding: '7px 8px', borderTop: `1px solid ${theme.border}`, color: theme.textMuted, fontSize: 10.5, fontWeight: 500, whiteSpace: 'nowrap', width: 68 }}>{r.marca || '—'}</td>
                      <td style={{ padding: '7px 8px', borderTop: `1px solid ${theme.border}`, fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap', width: 100, paddingLeft: 14 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <ChevronRight
                            style={{ width: 11, height: 11, color: P.accent, flexShrink: 0, transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }}
                            strokeWidth={2.4}
                          />
                          {r.sku}
                        </span>
                      </td>
                      <td style={{
                        padding: '7px 8px', borderTop: `1px solid ${theme.border}`,
                        fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 500, color: theme.text,
                        maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }} title={r.descripcion}>{r.descripcion || '—'}</td>
                      <td style={{ padding: '7px 8px', borderTop: `1px solid ${theme.border}`, textAlign: 'center', whiteSpace: 'nowrap', width: 70 }}>
                        {r.rdmp && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999,
                            fontSize: 10, fontWeight: 600, letterSpacing: '-0.005em',
                            fontFamily: TYPO.fontDisplay, background: rmapChip.bg, color: rmapChip.fg,
                          }}>
                            {r.rdmp}
                          </span>
                        )}
                      </td>
                      {verPrecioBajo && (
                        <td style={{ padding: '7px 8px', borderTop: `1px solid ${theme.border}`, textAlign: 'right', whiteSpace: 'nowrap', width: 96 }}>
                          {mostrarBajo ? (
                            <span
                              title={`${r.bajo.cliente_bajo} · ${fmtInt(r.bajo.piezas_bajo)} pz`}
                              style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 11.5, color: P.orange, letterSpacing: '-0.01em' }}>
                              {fmtMoney(r.bajo.precio_bajo)}
                            </span>
                          ) : (
                            <span style={{ color: theme.textSubtle }}>—</span>
                          )}
                        </td>
                      )}
                      {listasVisibles.map((l) => {
                        if (l === 'Mayoreo AAA') {
                          const promoTooltip = promo
                            ? `Promo −${(Number(promo.promo_pct) * 100).toFixed(1)}% · lista ${fmtMoney(precioAAA)}\n`
                              + (promo.promos || []).map((p) => `${p.campania}: ${Math.round(Number(p.promo_pct) * 100)}%`).join('\n')
                            : undefined;
                          return (
                            <td key={l}
                              style={{ padding: '7px 8px', borderTop: `1px solid ${theme.border}`, textAlign: 'right', whiteSpace: 'nowrap' }}
                              title={promoTooltip}>
                              {precioAAA != null ? (
                                <span style={{
                                  fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em',
                                  color: theme.text, fontVariantNumeric: 'tabular-nums',
                                  display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end',
                                }}>
                                  {fmtMoney(precioAAAneto)}
                                  {promo && (
                                    <span style={{
                                      display: 'inline-block', padding: '1px 6px', borderRadius: 999,
                                      fontSize: 8.5, fontWeight: 700, background: `${P.purple}22`, color: P.purple,
                                      letterSpacing: '0.02em',
                                    }}>
                                      −{(Number(promo.promo_pct) * 100).toFixed(0)}%
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span style={{ color: theme.textSubtle }}>—</span>
                              )}
                            </td>
                          );
                        }
                        return (
                          <td key={l} style={{
                            padding: '7px 8px', borderTop: `1px solid ${theme.border}`, textAlign: 'right',
                            fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 500, color: theme.text,
                            fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.005em', whiteSpace: 'nowrap',
                          }}>
                            {r.precios[l] != null ? fmtMoney(r.precios[l]) : <span style={{ color: theme.textSubtle, fontWeight: 400 }}>—</span>}
                          </td>
                        );
                      })}
                    </tr>
                    {abierto && (
                      <tr>
                        <td colSpan={4 + (verPrecioBajo ? 1 : 0) + listasVisibles.length} style={{ padding: 0, background: theme.bg, borderTop: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}` }}>
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
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [copilotOpen, setCopilotOpen] = useState(false);
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

  // Delta precio Enero → mes actual
  const deltaPrecioYTD = useMemo(() => {
    if (!analisis?.serieMens?.length) return null;
    const primero = analisis.serieMens.find((r) => r.precio != null);
    const ultimo  = [...analisis.serieMens].reverse().find((r) => r.precio != null);
    if (!primero || !ultimo || !primero.precio) return null;
    return ((ultimo.precio - primero.precio) / primero.precio) * 100;
  }, [analisis]);

  // Recomendaciones del Copilot · data-driven
  const recomendaciones = useMemo(() => {
    if (!analisis) return [];
    const recs = [];
    // 1) Oportunidad · lista con delta más grande vs AAA con volumen relevante
    const listasBajoAAA = Object.entries(precios || {})
      .filter(([k, v]) => k !== 'Mayoreo AAA' && k !== PRECIO_BAJO_KEY && v != null && precioAAA > 0 && v < precioAAA)
      .map(([k, v]) => ({ lista: k, precio: v, deltaAbs: precioAAA - v, deltaPct: ((v - precioAAA) / precioAAA) * 100 }))
      .sort((a, b) => b.deltaAbs - a.deltaAbs);
    if (listasBajoAAA.length > 0) {
      const l = listasBajoAAA[0];
      const impacto = l.deltaAbs * (analisis.piezasMesActual || 0);
      recs.push({
        id: 'op',
        tag: 'Oportunidad',
        tagColor: paletteFromTheme(theme).accent,
        title: `Sube ${LISTAS_LBL[l.lista] || l.lista} ${Math.abs(Math.round(l.deltaPct))}%`,
        desc: `Están $${Math.round(l.deltaAbs).toLocaleString('es-MX')} abajo de Mayoreo AAA. Impacto proyectado: $${Math.round(impacto).toLocaleString('es-MX')}/mes.`,
      });
    }
    // 2) Revisar · cliente de mayor volumen con delta < -5%
    const cli = analisis.clienteVolumen;
    if (cli && cli.deltaLista != null && cli.deltaLista < -5) {
      const impactoAnual = Math.abs(cli.deltaLista / 100) * cli.monto * (12 / (new Date().getMonth() + 1));
      recs.push({
        id: 'rev',
        tag: 'Revisar',
        tagColor: paletteFromTheme(theme).orange,
        title: `${cli.cliente} renegociar precio`,
        desc: `Paga ${Math.abs(cli.deltaLista).toFixed(1)}% bajo AAA con ${fmtInt(cli.piezas)} pz YTD. Impacto anualizado ~$${Math.round(impactoAnual / 1000).toLocaleString('es-MX')}K.`,
      });
    }
    // 3) Alerta · si hay promo activa
    if (promo && promo.campania) {
      recs.push({
        id: 'alert',
        tag: 'Alerta',
        tagColor: paletteFromTheme(theme).red,
        title: `Promo "${promo.campania}" activa`,
        desc: `Descuento vigente del ${Math.round(Number(promo.promo_pct) * 100)}%. Revisa la transición al terminar.`,
      });
    }
    return recs;
  }, [analisis, precios, precioAAA, promo, theme]);

  // ═══ Estilo Apple para el drill-down ═══
  const P = paletteFromTheme(theme);
  const heroBg = theme.heroCardBg || (isDark ? '#0F0F0F' : '#1D1D1F');
  const heroText = theme.heroCardText || '#F5F5F7';
  const heroMuted = 'rgba(255,255,255,0.7)';
  const heroSubtle = 'rgba(255,255,255,0.55)';

  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16,
      overflow: 'hidden', fontFamily: TYPO.fontText, marginTop: 4,
    }}>
      {/* Hero negro con precio héroe */}
      <div style={{ position: 'relative', background: heroBg, color: heroText }}>
        <button onClick={onClose}
          style={{ position: 'absolute', top: 12, right: 14, background: 'transparent', border: 0, color: heroMuted, fontSize: 14, cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#FFF'}
          onMouseLeave={(e) => e.currentTarget.style.color = heroMuted}>
          <X style={{ width: 14, height: 14 }} strokeWidth={2} />
        </button>
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24, alignItems: 'center' }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px',
              borderRadius: 999, background: 'rgba(255,255,255,0.10)',
              fontSize: 10, fontWeight: 500, color: heroMuted,
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontFamily: TYPO.fontText,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: P.teal }} />
              {sku.categoria || 'Sin categoría'} · {sku.familia || '—'}
              <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, color: heroSubtle, marginLeft: 6 }}>{sku.sku}</span>
            </div>
            <h3 style={{
              fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em',
              color: '#FFF', margin: '4px 0 0', lineHeight: 1.2,
            }}>
              {sku.descripcion || sku.sku}
            </h3>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: heroSubtle, fontWeight: 500, marginTop: 12 }}>
              Precio actual · Mayoreo AAA
            </div>
            <div style={{
              fontFamily: TYPO.fontDisplay, fontSize: 38, fontWeight: 600, letterSpacing: '-0.03em',
              margin: '6px 0 4px', fontVariantNumeric: 'tabular-nums', color: '#FFF',
            }}>
              {precioAAAneto != null ? fmtMoney(precioAAAneto) : '—'}
              {promo && precioAAA != null && (
                <span style={{ color: heroSubtle, textDecoration: 'line-through', fontSize: 20, marginLeft: 8, fontWeight: 500 }}>
                  {fmtMoney(precioAAA)}
                </span>
              )}
            </div>
            <p style={{ fontSize: 11, color: heroMuted, lineHeight: 1.5, maxWidth: 340, margin: 0 }}>
              {promo && (
                <><strong style={{ color: '#FFF', fontWeight: 500 }}>{Math.round(Number(promo.promo_pct) * 100)}% de descuento activo ({promo.campania}).</strong> </>
              )}
              {deltaPrecioYTD != null && (
                <>Precio {deltaPrecioYTD >= 0 ? 'subió' : 'bajó'} {Math.abs(deltaPrecioYTD).toFixed(1)}% en el año. </>
              )}
              {analisis?.clienteVolumen && analisis.clienteVolumen.deltaLista != null && (
                <>El cliente de mayor volumen ({analisis.clienteVolumen.cliente}) paga {fmtMoney(analisis.clienteVolumen.precioProm)} — {analisis.clienteVolumen.deltaLista >= 0 ? '+' : ''}{analisis.clienteVolumen.deltaLista.toFixed(1)}% vs lista.</>
              )}
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <HeroStat label="Piezas YTD" value={analisis ? fmtInt(analisis.piezasYTD) : '—'} />
            <HeroStat label="Facturado YTD" value={analisis ? fmtCompact(analisis.montoYTD) : '—'} />
            <HeroStat label={`Δ Precio ${anio}`} value={deltaPrecioYTD != null ? fmtPctDelta(deltaPrecioYTD) : '—'} valueColor={deltaPrecioYTD == null ? '#FFF' : deltaPrecioYTD >= 0 ? P.green : P.red} />
            <HeroStat label={`Sellout ${analisis ? MESES_LBL[analisis.mesMax - 1] : ''}`} value={analisis ? `${fmtInt(analisis.piezasMesActual)} pz` : '—'} />
          </div>
        </div>
      </div>

      {cargando ? (
        <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted, fontSize: 12 }}>
          <Activity style={{ width: 20, height: 20, marginBottom: 6 }} /> Cargando…
        </div>
      ) : (
        <>
        {/* Body split · 2 paneles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 0 }}>
          {/* Panel izquierdo: precios + evolución */}
          <div style={{ borderRight: `1px solid ${theme.border}`, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Precios por lista */}
            <div style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <h4 style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>Precios por lista</h4>
                <span style={{ fontSize: 10, color: theme.textMuted }}>orden de mayor a menor</span>
              </div>
              {(() => {
                const listasOrdenadas = ['Mayoreo AAA', 'DICOTECH', 'PCEL PROVISIONAL', 'API PROVISIONAL', 'DECME PROVISIONAL']
                  .filter((l) => precios[l] != null)
                  .map((l) => ({ lista: l, precio: precios[l] }))
                  .sort((a, b) => b.precio - a.precio);
                const maxPrecio = listasOrdenadas[0]?.precio || 1;
                return (
                  <>
                    {bajo && (
                      <ListaRow theme={theme} P={P} label="Precio bajo" precio={bajo.precio_bajo} maxPrecio={maxPrecio}
                        subLabel={`${bajo.cliente_bajo} · ${fmtInt(bajo.piezas_bajo)}pz`} tone="orange" />
                    )}
                    {listasOrdenadas.map(({ lista, precio }) => (
                      <ListaRow key={lista} theme={theme} P={P} label={LISTAS_LBL[lista] || lista}
                        precio={precio} maxPrecio={maxPrecio}
                        promoActiva={lista === 'Mayoreo AAA' && promo != null}
                        tone={lista === 'Mayoreo AAA' ? 'accent' : null} />
                    ))}
                  </>
                );
              })()}
            </div>

            {/* Evolución 12 meses */}
            <div style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <h4 style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>Evolución {anio} · precio + piezas</h4>
                <span style={{ fontSize: 9.5, color: theme.textMuted }}>
                  <span style={{ display: 'inline-block', width: 10, height: 2, background: P.accent, verticalAlign: 'middle', marginRight: 4 }} />Precio
                  <span style={{ display: 'inline-block', width: 10, height: 8, background: `${P.accent}33`, verticalAlign: 'middle', marginLeft: 10, marginRight: 4 }} />Piezas
                </span>
              </div>
              {analisis && analisis.serieMens.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <ComposedChart data={analisis.serieMens} margin={{ top: 6, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid stroke={theme.border} strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 9.5, fill: theme.textMuted }} interval={0} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" hide domain={['dataMin - 50', 'dataMax + 50']} />
                    <YAxis yAxisId="right" orientation="right" hide />
                    <Tooltip
                      formatter={(v, name) => name === 'Precio' ? fmtMoney(v) : `${fmtInt(v)} pz`}
                      labelStyle={{ fontSize: 10, color: theme.textMuted }}
                      contentStyle={{ fontSize: 10, padding: 8, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, fontFamily: TYPO.fontText }} />
                    <Bar yAxisId="right" dataKey="piezas" name="Piezas" fill={`${P.accent}33`} radius={[3, 3, 0, 0]} />
                    <Line yAxisId="left" type="monotone" dataKey="precio" name="Precio"
                      stroke={P.accent} strokeWidth={2.5} dot={{ r: 3, fill: theme.surface, stroke: P.accent, strokeWidth: 2 }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ fontSize: 11, color: theme.textMuted, textAlign: 'center', padding: '24px 0' }}>Sin datos históricos</div>
              )}
            </div>
          </div>

          {/* Panel derecho: clientes + promos */}
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Top clientes */}
            <div style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <h4 style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>Top clientes YTD</h4>
                <span style={{ fontSize: 10, color: theme.textMuted }}>precio · Δ vs AAA</span>
              </div>
              {!analisis || analisis.clientes.length === 0 ? (
                <div style={{ fontSize: 11, color: theme.textMuted, textAlign: 'center', padding: '12px 0' }}>Sin facturación este año.</div>
              ) : (
                <>
                  {analisis.clientes.map((c, i) => {
                    const critico = c.deltaLista != null && c.deltaLista < -8;
                    const deltaColor = c.deltaLista == null || Math.abs(c.deltaLista) < 0.5 ? theme.textMuted
                      : critico ? P.red
                      : c.deltaLista < 0 ? P.orange : P.green;
                    return (
                      <div key={c.cliente} style={{
                        display: 'grid', gridTemplateColumns: '20px 1fr auto 60px', gap: 8, alignItems: 'center',
                        padding: '6px 4px', fontSize: 11,
                      }}>
                        <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 10, color: theme.textMuted, textAlign: 'center' }}>{i + 1}</span>
                        <div>
                          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 500, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cliente}</div>
                          <div style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{fmtInt(c.piezas)} pz · {fmtCompact(c.monto)}</div>
                        </div>
                        <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 11.5, color: theme.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
                          {fmtMoney(c.precioProm)}
                        </span>
                        <span style={{ fontSize: 10, color: deltaColor, fontWeight: 500, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {c.deltaLista == null ? '—' :
                            Math.abs(c.deltaLista) < 0.5 ? '=' :
                            (c.deltaLista < 0 ? `▼ ${Math.abs(c.deltaLista).toFixed(1)}%` : `▲ ${c.deltaLista.toFixed(1)}%`)}
                        </span>
                      </div>
                    );
                  })}
                  {analisis.clientesRestantes.length > 0 && (
                    <div style={{ textAlign: 'center', fontSize: 10, color: theme.textMuted, padding: '6px 0 0', borderTop: `1px dashed ${theme.border}`, marginTop: 4 }}>
                      + {analisis.clientesRestantes.length} más · {fmtInt(analisis.clientesRestantes.reduce((s, c) => s + c.piezas, 0))} pz
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Promos timeline */}
            <div style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <h4 style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>Promos aplicadas</h4>
                <span style={{ fontSize: 10, color: theme.textMuted }}>
                  {analisis && analisis.promosCount > 0 ? `${analisis.promosHist.length} de ${analisis.promosCount}` : '—'}
                </span>
              </div>
              {!analisis || analisis.promosHist.length === 0 ? (
                <div style={{ fontSize: 11, color: theme.textMuted, textAlign: 'center', padding: '12px 0' }}>Sin promociones registradas.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {analisis.promosHist.map((p, i) => (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '58px 1fr auto', gap: 10, alignItems: 'center',
                      padding: '6px 4px', fontSize: 11,
                      borderBottom: i < analisis.promosHist.length - 1 ? `1px dashed ${theme.border}` : 'none',
                    }}>
                      <span style={{ fontSize: 9.5, color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {MESES_LBL[Number(p.mes) - 1]} {String(p.anio).slice(-2)}
                      </span>
                      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 500, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.campania}
                      </span>
                      <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12, color: P.orange, textAlign: 'right', letterSpacing: '-0.01em' }}>
                        {Math.round(Number(p.promo_pct) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Copilot Pricing · expandible */}
        <CopilotPricing theme={theme} isDark={isDark} P={P} open={copilotOpen} setOpen={setCopilotOpen} recs={recomendaciones} />
        </>
      )}
    </div>
  );
}

// ═══ Hero stat pill ═══
function HeroStat({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums', color: valueColor || '#FFF', letterSpacing: '-0.02em' }}>{value}</span>
    </div>
  );
}

// ═══ Fila de lista con barra ═══
function ListaRow({ theme, P, label, precio, maxPrecio, subLabel, promoActiva, tone }) {
  const width = maxPrecio > 0 ? Math.max(4, (precio / maxPrecio) * 100) : 0;
  const barCol = tone === 'orange' ? P.orange : tone === 'accent' ? P.accent : P.accent;
  const labelCol = tone === 'orange' ? P.orange : theme.text;
  const priceCol = tone === 'orange' ? P.orange : theme.text;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '100px 1fr auto 80px', gap: 8, alignItems: 'center',
      padding: '6px 4px', fontSize: 11, borderBottom: `1px dashed ${theme.border}`,
    }}>
      <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 500, color: labelCol, letterSpacing: '-0.005em' }}>
        {label}
      </span>
      <div style={{ height: 4, background: `${P.accent}1A`, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${width}%`, background: barCol, borderRadius: 999 }} />
      </div>
      <span style={{
        fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12, color: priceCol,
        letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', textAlign: 'right',
      }}>
        {fmtMoney(precio)}
        {promoActiva && (
          <span style={{
            display: 'inline-block', padding: '1px 6px', borderRadius: 999,
            fontSize: 8.5, fontWeight: 700, background: `${P.purple}22`, color: P.purple,
            marginLeft: 6, letterSpacing: '0.02em',
          }}>PROMO</span>
        )}
      </span>
      <span style={{ fontSize: 10, color: theme.textMuted, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {subLabel || ''}
      </span>
    </div>
  );
}

// ═══ Copilot Pricing · expandible ═══
function CopilotPricing({ theme, isDark, P, open, setOpen, recs }) {
  const grad = `linear-gradient(135deg, ${P.accent}0F, ${P.purple}0F)`;
  return (
    <div style={{
      borderTop: `1px solid ${theme.border}`,
      background: grad,
      transition: 'all 200ms ease',
    }}>
      <button onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', padding: '12px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'transparent', border: 0, cursor: 'pointer', fontFamily: 'inherit',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = `${P.accent}0A`}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 26, height: 26, borderRadius: 8,
            background: `linear-gradient(135deg, ${P.accent}, ${P.purple})`,
            color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles style={{ width: 13, height: 13 }} strokeWidth={2} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12.5, letterSpacing: '-0.01em', color: theme.text }}>Copilot Pricing</span>
            <span style={{ fontSize: 10, color: theme.textMuted, marginTop: 1 }}>
              {recs.length === 0 ? (
                <>Sin recomendaciones para este SKU · click para chat</>
              ) : (
                <><strong style={{ color: P.accent, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{recs.length} recomendaci{recs.length === 1 ? 'ón' : 'ones'}</strong> para este SKU · click para {open ? 'plegar' : 'ver'}</>
              )}
            </span>
          </div>
        </div>
        <span style={{
          width: 24, height: 24, borderRadius: 999,
          background: open ? `${P.accent}1A` : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
          color: open ? P.accent : theme.textMuted,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 200ms, background 200ms, color 200ms',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
          <ChevronDown style={{ width: 14, height: 14 }} strokeWidth={2.5} />
        </span>
      </button>

      <div style={{
        maxHeight: open ? 500 : 0, overflow: 'hidden',
        transition: 'max-height 250ms ease',
        borderTop: open ? `1px solid ${P.accent}22` : '1px solid transparent',
      }}>
        <div style={{ padding: '14px 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recs.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(recs.length, 3)}, 1fr)`, gap: 10 }}>
              {recs.map((r) => (
                <div key={r.id} style={{
                  background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12,
                  padding: '12px 14px', cursor: 'pointer', transition: 'border-color 120ms',
                }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = P.accent}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = theme.border}>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                    fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                    background: `${r.tagColor}22`, color: r.tagColor, marginBottom: 6,
                  }}>{r.tag}</span>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text, marginBottom: 4 }}>
                    {r.title}
                  </div>
                  <p style={{ fontSize: 11, color: theme.textMuted, margin: 0, lineHeight: 1.4 }}>{r.desc}</p>
                </div>
              ))}
            </div>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
            background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 999, marginTop: recs.length > 0 ? 4 : 0,
          }}>
            <Sparkles style={{ width: 12, height: 12, color: P.accent }} strokeWidth={2} />
            <input
              placeholder="Pregúntame algo sobre este SKU (próximamente)…"
              disabled
              style={{ border: 0, outline: 0, background: 'transparent', font: 'inherit', fontSize: 12, flex: 1, color: theme.text, opacity: 0.6, cursor: 'not-allowed' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ Roadmap chip colors — iOS uniforme en 3 temas ═══
function roadmapChip(theme, P, rdmp) {
  const map = {
    RMI:  { bg: `${P.teal}22`,   fg: theme.mode === 'dark' ? P.teal   : '#0F6E56' },
    RML:  { bg: `${P.purple}22`, fg: theme.mode === 'dark' ? P.purple : '#6E44A6' },
    RMS:  { bg: `${P.pink || P.red}22`, fg: theme.mode === 'dark' ? (P.pink || P.red) : '#B03050' },
    2026: { bg: `${P.orange}22`, fg: theme.mode === 'dark' ? P.orange : '#8B4E00' },
  };
  return map[rdmp] || { bg: `${theme.textMuted}18`, fg: theme.textMuted };
}

// ═══ Palette helper (mismo criterio que otras pestañas) ═══
function paletteFromTheme(theme) {
  return {
    accent: theme.accent || '#007AFF',
    green:  theme.green  || '#34C759',
    orange: theme.orange || '#FF9500',
    red:    theme.red    || '#FF3B30',
    purple: theme.purple || '#AF52DE',
    teal:   theme.teal   || '#5AC8FA',
    pink:   theme.pink   || '#FF2D55',
  };
}

// ═══ KPI card Apple Fitness para EstrategiaPrecios ═══
function KpiCardEP({ theme, P, icon: Icon, iconColor, chip, value, valueColor, note }) {
  const isDark = theme.mode === 'dark';
  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14,
      padding: '12px 14px', minHeight: 108,
      display: 'flex', flexDirection: 'column', gap: 4, fontFamily: TYPO.fontText,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: `${iconColor}22`, color: iconColor,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon style={{ width: 14, height: 14 }} strokeWidth={1.8} />
        </div>
        <span style={{
          fontSize: 9, padding: '2px 7px', borderRadius: 999,
          background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
          color: theme.textMuted, fontWeight: 500,
        }}>{chip}</span>
      </div>
      <div style={{
        fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em',
        color: valueColor || theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 6, lineHeight: 1,
      }}>{value}</div>
      <div style={{ fontSize: 11, color: theme.textMuted, lineHeight: 1.35, marginTop: 'auto' }}>{note}</div>
    </div>
  );
}
