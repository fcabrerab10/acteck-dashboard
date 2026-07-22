import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import {
  Activity, Boxes, MapPin, AlertTriangle, ArrowRightLeft, FileText,
  Package, TrendingUp, Percent, ChevronRight, Search, Download,
} from 'lucide-react';

const PALETTE = {
  blue:   { bg: '#E6F1FB', text: '#042C53', mid: '#185FA5', strong: '#3B82F6', soft: '#B5D4F4' },
  teal:   { bg: '#E1F5EE', text: '#04342C', mid: '#0F6E56', strong: '#1D9E75', soft: '#9FE1CB' },
  purple: { bg: '#EEEDFE', text: '#26215C', mid: '#534AB7', strong: '#7F77DD', soft: '#CECBF6' },
  coral:  { bg: '#FAECE7', text: '#4A1B0C', mid: '#993C1D', strong: '#D85A30', soft: '#F5C4B3' },
  amber:  { bg: '#FAEEDA', text: '#412402', mid: '#854F0B', strong: '#BA7517', soft: '#FAC775' },
  pink:   { bg: '#FBEAF0', text: '#4B1528', mid: '#993556', strong: '#D4537E', soft: '#F4C0D1' },
  green:  { bg: '#EAF3DE', text: '#173404', mid: '#3B6D11', strong: '#639922', soft: '#C0DD97' },
  red:    { bg: '#FCEBEB', text: '#501313', mid: '#A32D2D', strong: '#E24B4A', soft: '#F7C1C1' },
  gray:   { bg: '#F1EFE8', text: '#2C2C2A', mid: '#5F5E5A', strong: '#888780', soft: '#D3D1C7' },
};

const CEDIS_COLOR = {
  'ALMACENES GUADALAJARA': PALETTE.blue,
  'ALMACENES MEXICO':      PALETTE.teal,
  'ALMACENES COLOTLAN':    PALETTE.purple,
};
const CEDIS_CORTO = {
  'ALMACENES GUADALAJARA': 'Guadalajara',
  'ALMACENES MEXICO':      'México',
  'ALMACENES COLOTLAN':    'Colotlán',
};

// Mapping oficial (archivo "Almacenes 2026.xlsx")
const NOMBRES_ALMACEN = {
  1: 'VENTAS GENERAL GUADALAJARA',
  2: 'VENTAS GENERAL COLOTLAN',
  3: 'VENTAS GENERAL MEXICO',
  4: 'NO COMERCIAL',
  5: 'REFACTURACION',
  6: 'VENTAS DECME MEXICO',
  9: 'VENTAS CONSIGNACION MERCADO LIBRE',
  10: 'ACTIVO FIJO',
  11: 'NO COMERCIAL',
  12: 'VENTAS REFACCIONES',
  13: 'NO COMERCIAL',
  14: 'VENTAS PAGINA WEB DROSHIPPING',
  15: 'STOCK ROTATION TEMPORAL',
  16: 'VENTAS RETAIL GUADALAJARA',
  17: 'VENTAS RETAIL MEXICO',
  19: 'VENTAS DECME GUADALAJARA',
  20: 'NO COMERCIAL',
  25: 'VENTAS APARTADO ECOMMERCE',
  30: 'NO COMERCIAL',
  41: 'NO COMERCIAL',
  42: 'NO COMERCIAL',
  43: 'NO COMERCIAL',
  44: 'VENTAS EMPAQUE DANADO GUADALAJARA',
  50: 'ALMACEN MUESTRAS',
  62: 'NO COMERCIAL',
  63: 'NO COMERCIAL',
  64: 'VENTAS EMPAQUE DANADO MEXICO',
  70: 'NO COMERCIAL',
  71: 'VENTAS APARTADO ECOMMERCE TULTITLAN',
  90: 'NO COMERCIAL',
  97: 'ALMACEN DE REMISIONES',
  98: 'NO COMERCIAL',
  99: 'NO COMERCIAL',
  100: 'NO COMERCIAL',
};

// Clasificación funcional para agrupar
const TIPO_ALMACEN = {
  1: 'General', 2: 'General', 3: 'General',
  16: 'Retail', 17: 'Retail',
  6: 'DECME', 19: 'DECME',
  25: 'E-commerce', 71: 'E-commerce',
  9: 'Mercado Libre',
  14: 'Página web',
  12: 'Refacciones',
  44: 'Empaque dañado', 64: 'Empaque dañado',
  15: 'Stock rotation',
  50: 'Muestras',
  97: 'Remisiones',
  10: 'Activo fijo',
  5: 'Refacturación',
};
const tipoDe = (n) => TIPO_ALMACEN[n] || 'No comercial';
const esComercial = (n) => TIPO_ALMACEN[n] && !['Activo fijo', 'Muestras', 'Remisiones', 'Refacturación'].includes(TIPO_ALMACEN[n]);

const COLOR_TIPO = {
  'General':        PALETTE.blue,
  'Retail':         PALETTE.purple,
  'DECME':          PALETTE.teal,
  'E-commerce':     PALETTE.coral,
  'Mercado Libre':  PALETTE.amber,
  'Página web':     PALETTE.pink,
  'Refacciones':    PALETTE.green,
  'Empaque dañado': PALETTE.red,
  'Stock rotation': PALETTE.gray,
  'Muestras':       PALETTE.gray,
  'Remisiones':     PALETTE.gray,
  'Activo fijo':    PALETTE.gray,
  'Refacturación':  PALETTE.gray,
  'No comercial':   PALETTE.gray,
};

const fmtCompact = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(Number(n));
  const sign = Number(n) < 0 ? '-' : '';
  if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(0) + 'K';
  return sign + '$' + Math.round(a);
};
const fmtMoney = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(Number(n));
  return (Number(n) < 0 ? '-' : '') + '$' + a.toLocaleString('es-MX', { maximumFractionDigits: 0 });
};
const fmtInt = (n) => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('es-MX');
const fmtPct = (n) => n == null || isNaN(n) ? '—' : n.toFixed(1) + '%';

export default function InventarioGlobal() {
  const { theme } = useTheme();
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [soloComerciales, setSoloComerciales] = useState(true);
  const [cedisFiltro, setCedisFiltro] = useState('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [skuAbierto, setSkuAbierto] = useState(null);
  const [descripciones, setDescripciones] = useState(new Map());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const PAGE = 5000;
      let acc = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('inventario_acteck')
          .select('articulo, no_almacen, cedis, disponible, inventario, costopromedio, costodisponible, costoinventario')
          .range(from, from + PAGE - 1);
        if (error || !data || data.length === 0) break;
        acc = acc.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setFilas(acc);
      setLoading(false);

      // Fetch descripciones SKUs (from roadmap_sku o compras_oc)
      try {
        const skus = Array.from(new Set(acc.map((r) => r.articulo).filter(Boolean)));
        if (skus.length === 0) return;
        const mapDesc = new Map();
        const chunkBy = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, (i + 1) * n));
        for (const chunk of chunkBy(skus, 200)) {
          const { data } = await supabase.from('roadmap_sku').select('sku, descripcion, marca').in('sku', chunk);
          (data || []).forEach((r) => {
            if (!mapDesc.has(r.sku)) mapDesc.set(r.sku, { descripcion: r.descripcion || '', marca: r.marca || '' });
          });
        }
        setDescripciones(mapDesc);
      } catch (e) { /* opcional */ }
    })();
  }, []);

  // Filas efectivas según toggle
  const filasEfectivas = useMemo(() => {
    return filas.filter((r) => {
      if (!r.cedis) return false; // ignoramos sin CEDIS asignado
      if (soloComerciales && !esComercial(Number(r.no_almacen))) return false;
      if (cedisFiltro !== 'TODOS' && r.cedis !== cedisFiltro) return false;
      return true;
    });
  }, [filas, soloComerciales, cedisFiltro]);

  const kpis = useMemo(() => {
    let valor = 0, piezas = 0;
    const skus = new Set();
    const almacenes = new Set();
    filasEfectivas.forEach((r) => {
      valor  += Number(r.costoinventario) || 0;
      piezas += Number(r.inventario) || 0;
      if (r.articulo) skus.add(r.articulo);
      almacenes.add(r.no_almacen);
    });
    const nCEDIS = new Set(filasEfectivas.map((r) => r.cedis)).size;
    return { valor, piezas, skus: skus.size, almacenes: almacenes.size, nCEDIS };
  }, [filasEfectivas]);

  const porCedis = useMemo(() => {
    const m = new Map();
    filasEfectivas.forEach((r) => {
      const c = r.cedis;
      if (!m.has(c)) m.set(c, { cedis: c, valor: 0, piezas: 0, skus: new Set(), almacenes: new Set() });
      const it = m.get(c);
      it.valor  += Number(r.costoinventario) || 0;
      it.piezas += Number(r.inventario) || 0;
      if (r.articulo) it.skus.add(r.articulo);
      it.almacenes.add(r.no_almacen);
    });
    const total = Array.from(m.values()).reduce((s, x) => s + x.valor, 0);
    return Array.from(m.values())
      .map((it) => ({ ...it, skus: it.skus.size, almacenes: it.almacenes.size, share: total > 0 ? (it.valor / total) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor);
  }, [filasEfectivas]);

  const porTipo = useMemo(() => {
    const m = new Map();
    filasEfectivas.forEach((r) => {
      const t = tipoDe(Number(r.no_almacen));
      if (!m.has(t)) m.set(t, { tipo: t, valor: 0, piezas: 0, skus: new Set() });
      const it = m.get(t);
      it.valor  += Number(r.costoinventario) || 0;
      it.piezas += Number(r.inventario) || 0;
      if (r.articulo) it.skus.add(r.articulo);
    });
    const total = Array.from(m.values()).reduce((s, x) => s + x.valor, 0);
    return Array.from(m.values())
      .map((it) => ({ ...it, skus: it.skus.size, share: total > 0 ? (it.valor / total) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor);
  }, [filasEfectivas]);

  // ── Almacenes comerciales activos (para columnas dinámicas de la tabla) ──
  const almacenesActivos = useMemo(() => {
    const s = new Set();
    filasEfectivas.forEach((r) => s.add(Number(r.no_almacen)));
    return Array.from(s).sort((a, b) => a - b);
  }, [filasEfectivas]);

  // Etiqueta corta para columnas (max 10 chars)
  const shortAlmacen = (n) => {
    const nombre = NOMBRES_ALMACEN[n] || `Alm ${n}`;
    return nombre
      .replace('VENTAS GENERAL ', 'Gen ')
      .replace('VENTAS RETAIL ', 'Retail ')
      .replace('VENTAS DECME ', 'DECME ')
      .replace('VENTAS APARTADO ', 'E-com ')
      .replace('VENTAS CONSIGNACION MERCADO LIBRE', 'ML')
      .replace('VENTAS PAGINA WEB DROSHIPPING', 'Web')
      .replace('VENTAS EMPAQUE DANADO ', 'Dañ ')
      .replace('VENTAS REFACCIONES', 'Refac')
      .replace('GUADALAJARA', 'GDL')
      .replace('MEXICO', 'MEX')
      .replace('COLOTLAN', 'COL')
      .replace('TULTITLAN', 'TUL')
      .slice(0, 12);
  };

  // ── Tabla SKU × almacén ──
  const filasTabla = useMemo(() => {
    // Agrupar por SKU con desglose por almacén
    const m = new Map();
    filasEfectivas.forEach((r) => {
      const sku = r.articulo;
      if (!sku) return;
      if (!m.has(sku)) m.set(sku, { sku, byAlm: {}, totalPz: 0, totalDisp: 0, totalRes: 0, valor: 0 });
      const it = m.get(sku);
      const alm = Number(r.no_almacen);
      const pz = Number(r.inventario) || 0;
      const disp = Number(r.disponible) || 0;
      const res = Math.max(0, pz - disp);
      const val = Number(r.costoinventario) || 0;
      if (!it.byAlm[alm]) it.byAlm[alm] = { pz: 0, disp: 0, res: 0, valor: 0, cedis: r.cedis };
      it.byAlm[alm].pz += pz;
      it.byAlm[alm].disp += disp;
      it.byAlm[alm].res += res;
      it.byAlm[alm].valor += val;
      it.totalPz += pz;
      it.totalDisp += disp;
      it.totalRes += res;
      it.valor += val;
    });
    let arr = Array.from(m.values());
    // Enriquecer con desc/marca
    arr = arr.map((it) => {
      const d = descripciones.get(it.sku) || {};
      return { ...it, descripcion: d.descripcion || '', marca: d.marca || '' };
    });
    // Filtro por búsqueda
    const q = busqueda.trim().toUpperCase();
    if (q) {
      arr = arr.filter((r) => {
        const hay = `${r.sku} ${r.descripcion} ${r.marca}`.toUpperCase();
        return hay.includes(q);
      });
    }
    // Ordenar por valor descendente
    return arr.sort((a, b) => b.valor - a.valor);
  }, [filasEfectivas, descripciones, busqueda]);

  const maxCelda = useMemo(() => {
    let m = 0;
    filasTabla.forEach((r) => {
      almacenesActivos.forEach((a) => {
        const v = r.byAlm[a]?.pz || 0;
        if (v > m) m = v;
      });
    });
    return m || 1;
  }, [filasTabla, almacenesActivos]);

  // Pill Apple para celda de valor
  const isDark = theme.mode === 'dark';
  const cellPill = (v) => {
    if (v == null || v === 0) return null;
    const r = v / maxCelda;
    const b = theme.accent || (isDark ? '#0A84FF' : '#007AFF');
    if (r > 0.75) return { bg: b, color: '#FFFFFF', weight: 600 };
    if (r > 0.50) return { bg: isDark ? 'rgba(10,132,255,0.45)' : 'rgba(0,122,255,0.35)', color: isDark ? '#FFFFFF' : theme.text, weight: 600 };
    if (r > 0.25) return { bg: isDark ? 'rgba(10,132,255,0.25)' : 'rgba(0,122,255,0.18)', color: theme.text };
    return { bg: isDark ? 'rgba(10,132,255,0.12)' : 'rgba(0,122,255,0.08)', color: theme.textMuted };
  };

  // Insights auto ──
  const insights = useMemo(() => {
    const top = porCedis[0];
    const reservado = filasEfectivas.reduce((s, r) => s + Math.max(0, (Number(r.inventario) || 0) - (Number(r.disponible) || 0)), 0);
    const valorReservado = filasEfectivas.reduce((s, r) => {
      const pz = Number(r.inventario) || 0;
      const disp = Number(r.disponible) || 0;
      const res = Math.max(0, pz - disp);
      const cu = Number(r.costopromedio) || 0;
      return s + res * cu;
    }, 0);
    return {
      valor: kpis.valor, piezas: kpis.piezas, skus: kpis.skus,
      topCedis: top,
      reservado, valorReservado,
      pctReservado: kpis.piezas > 0 ? (reservado / kpis.piezas) * 100 : 0,
    };
  }, [kpis, porCedis, filasEfectivas]);

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-400">
        <Activity className="w-10 h-10 mx-auto mb-3" />
        Cargando inventario…
      </div>
    );
  }
  if (filas.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500">
        <Boxes className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Inventario</h2>
        <p>No hay datos. Sube el archivo ERP en /uploads.html.</p>
      </div>
    );
  }

  // Colors iOS
  const blue = theme.accent || '#007AFF';
  const green = theme.green || '#34C759';
  const orange = theme.orange || '#FF9500';
  const purple = theme.purple || '#AF52DE';
  const red = theme.red || '#FF3B30';
  const teal = theme.teal || '#5AC8FA';
  const pink = theme.pink || '#FF2D55';

  const iosCanalCol = (cedis, i) => {
    const map = { 'ALMACENES GUADALAJARA': blue, 'ALMACENES MEXICO': purple, 'ALMACENES COLOTLAN': teal };
    return map[cedis] || [blue, purple, orange, teal, pink, green][i % 6];
  };

  const KpiApple = ({ Icon, iconColor, chip, kpi, kpiTone, headline }) => {
    const kpiCol = kpiTone === 'pos' ? green : kpiTone === 'neg' ? red : kpiTone === 'warn' ? orange : theme.text;
    return (
      <div style={{
        background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14,
        padding: 12, display: 'flex', flexDirection: 'column', gap: 4, minHeight: 108,
        fontFamily: TYPO.fontText,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, background: `${iconColor}22`, color: iconColor,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon style={{ width: 15, height: 15 }} strokeWidth={1.8} />
          </div>
          {chip && (
            <span style={{
              fontSize: 9, padding: '2px 7px', borderRadius: 999,
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              color: theme.textMuted, fontWeight: 500,
            }}>{chip}</span>
          )}
        </div>
        <div style={{
          fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em',
          color: kpiCol, fontVariantNumeric: 'tabular-nums', marginTop: 4, lineHeight: 1,
        }}>{kpi}</div>
        <div style={{ fontSize: 11, color: theme.textMuted, lineHeight: 1.3, marginTop: 'auto' }}>{headline}</div>
      </div>
    );
  };

  return (
    <div style={{ padding: '10px 6px', background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%' }} className="space-y-3">
      {/* Header apple */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, padding: '0 4px', marginBottom: 4, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: theme.textMuted, marginBottom: 4, fontFamily: TYPO.fontText, fontWeight: 500 }}>
            Dirección Comercial · Snapshot actual
          </p>
          <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em', fontFamily: TYPO.fontDisplay, color: theme.text, margin: 0, lineHeight: 1.1 }}>
            Inventario Acteck.
          </h2>
          <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 4, fontFamily: TYPO.fontText, fontVariantNumeric: 'tabular-nums' }}>
            <strong style={{ color: theme.text, fontWeight: 500 }}>{fmtCompact(kpis.valor)}</strong> · {fmtInt(kpis.skus)} SKUs · {kpis.almacenes} almacenes en {kpis.nCEDIS} CEDIS
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'inline-flex', gap: 1, padding: 3, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderRadius: 999 }}>
            <button onClick={() => setSoloComerciales(true)}
              style={{ padding: '6px 12px', borderRadius: 999, background: soloComerciales ? theme.surface : 'transparent', color: soloComerciales ? theme.text : theme.textMuted, fontWeight: soloComerciales ? 600 : 500, border: 0, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', boxShadow: soloComerciales ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}>
              Solo comerciales
            </button>
            <button onClick={() => setSoloComerciales(false)}
              style={{ padding: '6px 12px', borderRadius: 999, background: !soloComerciales ? theme.surface : 'transparent', color: !soloComerciales ? theme.text : theme.textMuted, fontWeight: !soloComerciales ? 600 : 500, border: 0, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', boxShadow: !soloComerciales ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}>
              Todos
            </button>
          </div>
          <select value={cedisFiltro} onChange={(e) => setCedisFiltro(e.target.value)}
            style={{ height: 32, padding: '0 14px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 999, fontSize: 12, color: theme.text, fontFamily: 'inherit', cursor: 'pointer' }}>
            <option value="TODOS">Todos los CEDIS</option>
            {Object.keys(CEDIS_CORTO).map((c) => (
              <option key={c} value={c}>{CEDIS_CORTO[c]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 4 Insight cards Apple Fitness */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <KpiApple Icon={Package} iconColor={blue} chip="Valor"
          kpi={fmtCompact(insights.valor)}
          headline={<>Total en stock · <strong style={{ color: theme.text }}>{fmtInt(insights.piezas)} piezas</strong> en {fmtInt(insights.skus)} SKUs.</>}
        />
        <KpiApple Icon={MapPin} iconColor={green} chip="Concentración"
          kpi={insights.topCedis ? `${insights.topCedis.share.toFixed(0)}%` : '—'}
          headline={insights.topCedis
            ? <><strong style={{ color: theme.text }}>{CEDIS_CORTO[insights.topCedis.cedis] || insights.topCedis.cedis}</strong> concentra {insights.topCedis.share.toFixed(1)}% · {fmtCompact(insights.topCedis.valor)}.</>
            : <>Sin CEDIS con datos.</>}
        />
        <KpiApple Icon={AlertTriangle} iconColor={orange} chip="Reservado"
          kpi={`${insights.pctReservado.toFixed(1)}%`}
          kpiTone="warn"
          headline={<><strong style={{ color: theme.text }}>{fmtInt(insights.reservado)} piezas</strong> reservadas · {fmtCompact(insights.valorReservado)} en órdenes abiertas.</>}
        />
        <KpiApple Icon={Boxes} iconColor={purple} chip="Cobertura"
          kpi={`${kpis.almacenes} alm`}
          headline={<>Distribuidos en <strong style={{ color: theme.text }}>{kpis.nCEDIS} CEDIS</strong>. {porTipo[0]?.tipo || '—'} es el tipo dominante ({porTipo[0] ? porTipo[0].share.toFixed(0) : 0}%).</>}
        />
      </div>

      {/* Row 2-col: CEDIS barras + tipo funcional */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 10 }}>
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '12px 16px', fontFamily: TYPO.fontText }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <h4 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>Distribución por CEDIS</h4>
            <span style={{ fontSize: 10, color: theme.textMuted }}>{porCedis.length} activos · click filtra</span>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {porCedis.map((c, i) => {
              const col = iosCanalCol(c.cedis, i);
              const max = porCedis[0]?.valor || 1;
              const w = (c.valor / max) * 100;
              const active = cedisFiltro === c.cedis;
              return (
                <div key={c.cedis}
                  onClick={() => setCedisFiltro(active ? 'TODOS' : c.cedis)}
                  style={{
                    display: 'grid', gridTemplateColumns: '110px 1fr 90px', gap: 12, alignItems: 'center',
                    padding: '6px 8px', borderRadius: 8, cursor: 'pointer',
                    background: active ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent',
                  }}>
                  <div>
                    <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 500, color: theme.text, letterSpacing: '-0.005em' }}>{CEDIS_CORTO[c.cedis] || c.cedis}</div>
                    <div style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{fmtInt(c.skus)} SKUs · {c.almacenes} alm.</div>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: theme.border, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${w}%`, background: col, borderRadius: 999 }} />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{fmtCompact(c.valor)}</div>
                    <div style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{c.share.toFixed(1)}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '12px 16px', fontFamily: TYPO.fontText }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <h4 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>Por tipo funcional</h4>
            <span style={{ fontSize: 10, color: theme.textMuted }}>{porTipo.length} tipos</span>
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            {porTipo.map((t, i) => {
              const iosTipoCol = [blue, purple, teal, orange, green, red, orange][i % 7];
              return (
                <div key={t.tipo} style={{ display: 'grid', gridTemplateColumns: '8px minmax(0,1fr) 60px 60px', gap: 10, alignItems: 'center', padding: '6px 6px', borderBottom: `1px dashed ${theme.border}` }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: iosTipoCol }} />
                  <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 500, color: theme.text, textTransform: 'uppercase', letterSpacing: '-0.005em' }}>{t.tipo}</span>
                  <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: theme.text, letterSpacing: '-0.01em' }}>{fmtCompact(t.valor)}</span>
                  <span style={{ fontSize: 10, color: theme.textMuted, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t.share.toFixed(1)}% · {fmtInt(t.skus)} SKUs</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabla SKU × almacén */}
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: `1px solid ${theme.border}`, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 999, height: 30, flex: 1, maxWidth: 280 }}>
            <Search style={{ width: 12, height: 12, color: theme.textMuted }} />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar SKU o descripción…"
              style={{ border: 0, outline: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 12, color: theme.text, flex: 1 }} />
          </div>
          <span style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginLeft: 4 }}>
            {fmtInt(filasTabla.length)} SKUs · {almacenesActivos.length} almacenes
          </span>
        </div>

        <div style={{ overflow: 'auto', maxHeight: '65vh' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontFamily: TYPO.fontText, fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', top: 0, background: theme.surface, zIndex: 1, textAlign: 'left', padding: '8px 10px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap', width: 60 }}>Marca</th>
                <th style={{ position: 'sticky', top: 0, background: theme.surface, zIndex: 1, textAlign: 'left', padding: '8px 6px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap', width: 100 }}>SKU</th>
                <th style={{ position: 'sticky', top: 0, background: theme.surface, zIndex: 1, textAlign: 'left', padding: '8px 6px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap', minWidth: 200 }}>Descripción</th>
                {almacenesActivos.map((a) => (
                  <th key={a} style={{ position: 'sticky', top: 0, background: theme.surface, zIndex: 1, textAlign: 'right', padding: '8px 4px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap', width: 56 }} title={NOMBRES_ALMACEN[a]}>{shortAlmacen(a)}</th>
                ))}
                <th style={{ position: 'sticky', top: 0, background: theme.surface, zIndex: 1, textAlign: 'right', padding: '8px 6px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap', width: 70 }}>Total pz</th>
                <th style={{ position: 'sticky', top: 0, background: theme.surface, zIndex: 1, textAlign: 'right', padding: '8px 6px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap', width: 80 }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {filasTabla.slice(0, 200).map((r) => {
                const abierto = skuAbierto === r.sku;
                return (
                  <React.Fragment key={r.sku}>
                    <tr onClick={() => setSkuAbierto(abierto ? null : r.sku)}
                      style={{
                        borderTop: `1px solid ${theme.border}`,
                        background: abierto ? (isDark ? 'rgba(10,132,255,0.10)' : 'rgba(0,122,255,0.06)') : 'transparent',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { if (!abierto) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'; }}
                      onMouseLeave={(e) => { if (!abierto) e.currentTarget.style.background = 'transparent'; }}>
                      <td style={{ padding: '4px 6px', color: theme.textMuted, fontSize: 10, whiteSpace: 'nowrap', width: 60 }}>{r.marca || '—'}</td>
                      <td style={{ padding: '4px 6px', color: theme.text, fontSize: 10, fontWeight: 600, fontFamily: '-apple-system, "SF Mono", ui-monospace, monospace', whiteSpace: 'nowrap', width: 100 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <ChevronRight style={{ width: 12, height: 12, color: blue, flexShrink: 0, transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }} />
                          {r.sku}
                        </span>
                      </td>
                      <td style={{ padding: '4px 6px', color: theme.text, fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 500, letterSpacing: '-0.005em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }} title={r.descripcion}>{r.descripcion || '—'}</td>
                      {almacenesActivos.map((a) => {
                        const v = r.byAlm[a]?.pz || 0;
                        const h = cellPill(v);
                        return (
                          <td key={a} style={{ padding: '3px 3px', textAlign: 'right', whiteSpace: 'nowrap', width: 56 }}>
                            {v > 0 ? (
                              <span style={{
                                display: 'inline-block', padding: '3px 8px', borderRadius: 999,
                                fontFamily: TYPO.fontText, fontSize: 11,
                                background: h?.bg || 'transparent',
                                color: h?.color || theme.textMuted,
                                fontWeight: h?.weight || 500,
                                minWidth: 32, textAlign: 'center',
                              }}>{fmtInt(v)}</span>
                            ) : (
                              <span style={{ color: theme.textSubtle, fontSize: 11 }}>—</span>
                            )}
                          </td>
                        );
                      })}
                      <td style={{ padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', background: theme.bg, fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, letterSpacing: '-0.01em', width: 70 }}>{fmtInt(r.totalPz)}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', background: theme.bg, fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, letterSpacing: '-0.01em', width: 80 }}>{fmtCompact(r.valor)}</td>
                    </tr>
                    {abierto && (
                      <tr>
                        <td colSpan={3 + almacenesActivos.length + 2} style={{ padding: 0, background: theme.bg, borderTop: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}` }}>
                          <SkuDrillDown row={r} almacenes={almacenesActivos} theme={theme} colors={{ blue, green, orange, red, purple }} isDark={isDark} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filasTabla.length > 200 && (
                <tr>
                  <td colSpan={3 + almacenesActivos.length + 2} style={{ padding: '8px', textAlign: 'center', color: theme.textMuted, fontSize: 11, borderTop: `1px solid ${theme.border}` }}>
                    Mostrando 200 de {fmtInt(filasTabla.length)} SKUs · usa el buscador para filtrar
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ────────── SKU drill-down · desglose stock por almacén ──────────
function SkuDrillDown({ row, almacenes, theme, colors, isDark }) {
  const { blue, green, orange, red, purple } = colors;
  const totalRes = row.totalRes;
  const totalDisp = row.totalDisp;
  const pctRes = row.totalPz > 0 ? (totalRes / row.totalPz) * 100 : 0;

  const KBoxSku = ({ lbl, val, sub, subColor, color }) => (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'inherit' }}>
      <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, margin: 0 }}>{lbl}</p>
      <p style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: color || theme.text, fontVariantNumeric: 'tabular-nums', margin: 0 }}>{val}</p>
      <p style={{ fontSize: 10, color: subColor || theme.textMuted, fontVariantNumeric: 'tabular-nums', margin: 0 }}>{sub}</p>
    </div>
  );

  return (
    <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12, fontFamily: TYPO.fontText }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <KBoxSku lbl="Total inventario" val={`${fmtInt(row.totalPz)} pz`} sub={`${fmtCompact(row.valor)} · ${almacenes.filter((a) => (row.byAlm[a]?.pz || 0) > 0).length} almacenes`} />
        <KBoxSku lbl="Reservado" val={`${fmtInt(totalRes)} pz`} sub={`${pctRes.toFixed(1)}% del total`} color={orange} subColor={theme.textMuted} />
        <KBoxSku lbl="Disponible" val={`${fmtInt(totalDisp)} pz`} sub={`${(100 - pctRes).toFixed(1)}% · listo para venta`} color={green} subColor={theme.textMuted} />
        <KBoxSku lbl="Estatus" val={pctRes > 40 ? 'Alta reserva' : pctRes > 20 ? 'Normal' : 'Baja reserva'} sub={pctRes > 40 ? 'Alto compromiso' : 'Rotación saludable'} color={pctRes > 40 ? orange : pctRes > 20 ? blue : green} />
      </div>

      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h4 style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>Desglose por almacén</h4>
          <span style={{ fontSize: 10, color: theme.textMuted }}>Total / Reservado / Disponible · composición · CEDIS</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 10px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}` }}>Almacén</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}` }}>CEDIS</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, width: 70 }}>Total pz</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, width: 70 }}>Reservado</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, width: 70 }}>Disponible</th>
              <th style={{ padding: '6px 8px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, width: 120 }}>Composición</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, width: 80 }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {almacenes.filter((a) => (row.byAlm[a]?.pz || 0) > 0).map((a) => {
              const d = row.byAlm[a];
              const pctR = d.pz > 0 ? (d.res / d.pz) * 100 : 0;
              const pctD = d.pz > 0 ? (d.disp / d.pz) * 100 : 0;
              return (
                <tr key={a}>
                  <td style={{ padding: '5px 10px', fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 500, color: theme.text, borderBottom: `1px solid ${theme.border}` }}>{NOMBRES_ALMACEN[a] || `Alm ${a}`}</td>
                  <td style={{ padding: '5px 8px', fontSize: 11, color: theme.textMuted, borderBottom: `1px solid ${theme.border}` }}>{CEDIS_CORTO[d.cedis] || d.cedis}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12, color: theme.text, letterSpacing: '-0.01em', borderBottom: `1px solid ${theme.border}` }}>{fmtInt(d.pz)}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 11, color: d.res > 0 ? orange : theme.textMuted, fontWeight: 500, borderBottom: `1px solid ${theme.border}` }}>{d.res > 0 ? fmtInt(d.res) : '—'}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 11, color: green, fontWeight: 500, borderBottom: `1px solid ${theme.border}` }}>{fmtInt(d.disp)}</td>
                  <td style={{ padding: '5px 8px', borderBottom: `1px solid ${theme.border}` }}>
                    <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', background: theme.border }}>
                      <span style={{ width: `${pctR}%`, background: orange }} />
                      <span style={{ width: `${pctD}%`, background: green }} />
                    </div>
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 11, color: theme.text, letterSpacing: '-0.005em', borderBottom: `1px solid ${theme.border}` }}>{fmtCompact(d.valor)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiTile({ label, valor, subtitulo, esWarning }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-xl font-medium mt-0.5 text-gray-800">{valor}</div>
      <div className={`text-[11px] mt-1 ${esWarning ? 'text-amber-600' : 'text-gray-500'}`}>{subtitulo}</div>
    </div>
  );
}

function ProximoBloque({ icon: Icon, titulo, nota }) {
  return (
    <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4">
      <div className="flex items-center gap-2 text-gray-500">
        {Icon && <Icon className="w-4 h-4" />}
        <div className="text-sm font-medium">{titulo}</div>
      </div>
      <div className="text-xs text-gray-400 mt-1.5">Próximamente</div>
      <div className="text-[11px] text-gray-400 mt-2 leading-relaxed">{nota}</div>
    </div>
  );
}
