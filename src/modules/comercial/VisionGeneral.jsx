import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AppleLoader from '../../components/apple/AppleLoader';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import {
  Activity, TrendingUp, TrendingDown, ChevronRight, ChevronDown,
  Wallet, Package, Receipt, Target, ShoppingBag, Ship, X,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';

// ────────── Constantes ──────────
const MESES_LBL  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Paleta Bento (consistente con Estado de Resultados)
const PALETTE = {
  blue:   { bg: '#E6F1FB', text: '#042C53', mid: '#185FA5', strong: '#3B82F6' },
  teal:   { bg: '#E1F5EE', text: '#04342C', mid: '#0F6E56', strong: '#1D9E75' },
  purple: { bg: '#EEEDFE', text: '#26215C', mid: '#534AB7', strong: '#7F77DD' },
  coral:  { bg: '#FAECE7', text: '#4A1B0C', mid: '#993C1D', strong: '#D85A30' },
  amber:  { bg: '#FAEEDA', text: '#412402', mid: '#854F0B', strong: '#BA7517' },
  red:    { bg: '#FCEBEB', text: '#501313', mid: '#A32D2D', strong: '#E24B4A' },
  pink:   { bg: '#FBEAF0', text: '#4B1528', mid: '#993556', strong: '#D4537E' },
  green:  { bg: '#EAF3DE', text: '#173404', mid: '#3B6D11', strong: '#639922' },
  gray:   { bg: '#F1EFE8', text: '#2C2C2A', mid: '#5F5E5A', strong: '#888780' },
};

// Color por nombre de dimensión (canal/marca/categoría)
const CANAL_COLOR = {
  'DISTRIBUIDOR':         PALETTE.blue,
  'MAYOREO':              PALETTE.purple,
  'MERCADO LIBRE':        PALETTE.amber,
  'AMAZON':               PALETTE.coral,
  'SITIO WEB':            PALETTE.teal,
  'CYBERPURTA':           PALETTE.purple,
  'SANBORN':              PALETTE.pink,
  'WALMART':              PALETTE.purple,
  'MOSTRADOR':            PALETTE.green,
  'RETAIL REPRESENTADOS': PALETTE.coral,
  'RETAIL PROPIOS':       PALETTE.pink,
};
const colorBloque = (k) => CANAL_COLOR[String(k || '').toUpperCase()] || PALETTE.gray;

// ────────── IconBadge (patrón AirPods · 40x40 rounded, bg tinted, icon en color solido) ──────────
function IconBadge({ icon: Icon, color, size = 40 }) {
  if (!Icon) return null;
  const iconSize = Math.round(size * 0.5);
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.3),
      background: `${color}22`, color,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon style={{ width: iconSize, height: iconSize }} strokeWidth={1.75} />
    </div>
  );
}

// ────────── iOS system palette map por canal ──────────
// Ordenado por prioridad de facturación esperada. Usa colores del theme (iOS Claro/Midnight, editorial Marfil).
const IOS_CANAL_ORDER = ['purple', 'accent', 'teal', 'orange', 'pink', 'green', 'indigo', 'red'];
function colorCanalIOS(theme, key, fallbackIdx = 0) {
  const overrides = {
    'MAYOREO':              theme.purple,
    'DISTRIBUIDOR':         theme.accent,
    'E-COMMERCE':           theme.teal,
    'RETAIL REPRESENTADOS': theme.orange,
    'RETAIL PROPIOS':       theme.pink,
    'MOSTRADOR':            theme.green,
    'MERCADO LIBRE':        theme.orange,
    'AMAZON':               theme.pink,
    'SITIO WEB':            theme.teal,
    'CYBERPURTA':           theme.purple,
    'SANBORN':              theme.pink,
    'WALMART':              theme.indigo,
  };
  const norm = String(key || '').toUpperCase();
  return overrides[norm] || theme[IOS_CANAL_ORDER[fallbackIdx % IOS_CANAL_ORDER.length]] || theme.accent;
}

// ────────── MixDonut · donut + ranking interactivo (hover cruzado) ──────────
function MixDonut({ bloques, ventaTotal, deltaTotal, anio, expandido, onSelect, puedeSeleccionar }) {
  const { theme } = useTheme();
  const [hover, setHover] = useState(null);
  const items = [...(bloques || [])].sort((a, b) => (b.venta || 0) - (a.venta || 0));
  if (!items.length) {
    return (
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 20, padding: 24, color: theme.textMuted, fontFamily: TYPO.fontText, textAlign: 'center', fontSize: 13 }}>
        Sin datos para mostrar.
      </div>
    );
  }
  const total = items.reduce((s, it) => s + (it.venta || 0), 0) || 1;
  // Radio y perímetro del arco (r=42 igual que mockup)
  const R = 42;
  const CIRC = 2 * Math.PI * R;
  let offsetAcc = 0;
  const arcs = items.map((it) => {
    const pct = (it.venta || 0) / total;
    const len = pct * CIRC;
    const dash = `${len} ${CIRC}`;
    const dashOffset = -offsetAcc;
    offsetAcc += len;
    return { key: it.key, color: colorCanalIOS(theme, it.key, items.indexOf(it)), dash, dashOffset, pct };
  });
  const green = theme.green || '#34C759';
  const red = theme.red || '#FF3B30';

  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 20,
      padding: '20px 24px', display: 'grid', gridTemplateColumns: '180px 1fr', gap: 32,
      alignItems: 'center', fontFamily: TYPO.fontText,
    }}>
      {/* Donut */}
      <div style={{ position: 'relative', width: 180, height: 180 }}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r={R} fill="none" stroke={theme.border} strokeWidth="12" />
          {arcs.map((a) => {
            const active = hover === a.key || expandido === a.key;
            const other = (hover || expandido) && !active;
            return (
              <circle key={a.key} cx="50" cy="50" r={R} fill="none"
                stroke={a.color} strokeWidth={active ? 14 : 12}
                strokeDasharray={a.dash} strokeDashoffset={a.dashOffset}
                opacity={other ? 0.25 : 1}
                style={{ transition: 'stroke-width 120ms, opacity 120ms', cursor: puedeSeleccionar ? 'pointer' : 'default' }}
                onMouseEnter={() => setHover(a.key)}
                onMouseLeave={() => setHover(null)}
                onClick={() => puedeSeleccionar && onSelect(a.key)}
              />
            );
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          {(() => {
            const sel = items.find((it) => it.key === (hover || expandido));
            if (sel) {
              const pct = ((sel.venta || 0) / total) * 100;
              return (
                <>
                  <div style={{ fontSize: 10, color: theme.textMuted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{sel.key}</div>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', color: theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmtCompact(sel.venta)}</div>
                  <div style={{ fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{pct.toFixed(1)}% del total</div>
                </>
              );
            }
            return (
              <>
                <div style={{ fontSize: 10, color: theme.textMuted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total YTD</div>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 24, fontWeight: 600, letterSpacing: '-0.03em', color: theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmtCompact(ventaTotal)}</div>
                {deltaTotal != null && (
                  <div style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', marginTop: 2, color: deltaTotal >= 0 ? green : red, fontWeight: 500 }}>
                    {deltaTotal >= 0 ? '↑' : '↓'} {Math.abs(deltaTotal).toFixed(1)}% vs {anio - 1}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Ranking */}
      <div style={{ display: 'grid', gap: 6 }}>
        {items.map((it, i) => {
          const palMid = colorCanalIOS(theme, it.key, i);
          const pct = ((it.venta || 0) / total) * 100;
          const active = hover === it.key || expandido === it.key;
          const dim = (hover || expandido) && !active;
          return (
            <div key={it.key}
              onMouseEnter={() => setHover(it.key)}
              onMouseLeave={() => setHover(null)}
              onClick={() => puedeSeleccionar && onSelect(it.key)}
              style={{
                display: 'grid', gridTemplateColumns: '18px 10px minmax(0, 1fr) 90px 70px', alignItems: 'center', gap: 10,
                padding: '6px 8px', borderRadius: 10,
                background: active ? (theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent',
                opacity: dim ? 0.5 : 1,
                cursor: puedeSeleccionar ? 'pointer' : 'default',
                transition: 'background 120ms, opacity 120ms',
              }}>
              <span style={{ fontSize: 10, color: theme.textSubtle, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>#{i + 1}</span>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: palMid, flexShrink: 0 }} />
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 500, color: theme.text, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.key}</span>
                <span style={{ fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>· {pct.toFixed(1)}%</span>
              </span>
              <div style={{ height: 5, borderRadius: 999, background: theme.border, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.max(2, pct)}%`, background: palMid, borderRadius: 999 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 6 }}>
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em' }}>{fmtCompact(it.venta)}</span>
                {it.deltaYoY != null && (
                  <span style={{ fontSize: 10, fontWeight: 500, color: it.deltaYoY >= 0 ? green : red, fontVariantNumeric: 'tabular-nums' }}>
                    {it.deltaYoY >= 0 ? '↑' : '↓'}{Math.abs(it.deltaYoY).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────── MiniKpiRow · 3 cards horizontales 84px · Inventario · Cartera · Sell Out ──────────
function MiniKpiRow({ inventario, ventaProm, sellOutMes, sellMensual, anio }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const invBg = theme.surfaceInverse || (isDark ? '#F5F5F7' : '#000000');
  const invText = theme.textOnInverse || (isDark ? '#1D1D1F' : '#F5F5F7');
  const invMuted = isDark ? 'rgba(29,29,31,0.7)' : 'rgba(245,245,247,0.72)';
  const invDivider = isDark ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.14)';
  const border = `1px solid ${theme.border}`;
  const green = theme.green || '#34C759';
  const red = theme.red || '#FF3B30';
  const pink = theme.pink || '#FF2D55';

  // ── Ring cobertura
  const dias = (ventaProm > 0 && inventario?.valor_inventario)
    ? Math.round((Number(inventario.valor_inventario) / ventaProm) * 30 / 30) // días equivalentes
    : null;
  const diasCap = dias == null ? null : Math.min(90, dias);
  const ringPct = diasCap == null ? 0 : Math.min(1, diasCap / 45);
  const ringCol = dias == null ? theme.textMuted : (dias < 15 ? red : dias > 60 ? theme.orange || '#FF9500' : green);
  const R = 15, C = 2 * Math.PI * R;
  const ringDash = C, ringOffset = C * (1 - ringPct);

  // ── Sparkline sellout últimos 6 meses
  const sparkPts = (() => {
    if (!sellMensual?.length) return [];
    const byMes = {};
    sellMensual.forEach((r) => { const m = Number(r.mes); byMes[m] = (byMes[m] || 0) + (Number(r.importe) || 0); });
    const meses = Object.keys(byMes).map(Number).sort((a, b) => a - b);
    return meses.slice(-6).map((m) => byMes[m]);
  })();
  const sparkPath = (() => {
    if (sparkPts.length < 2) return '';
    const max = Math.max(...sparkPts, 0.001);
    const min = Math.min(...sparkPts);
    const range = max - min || 1;
    return sparkPts.map((v, i) => {
      const x = (i / (sparkPts.length - 1)) * 72;
      const y = 20 - ((v - min) / range) * 16;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  })();
  const sparkLast = sparkPts.length ? { x: 72, y: 20 - ((sparkPts[sparkPts.length - 1] - Math.min(...sparkPts)) / (Math.max(...sparkPts) - Math.min(...sparkPts) || 1)) * 16 } : null;

  const CardShell = ({ inverse, children }) => (
    <div style={{
      background: inverse ? invBg : theme.surface,
      color: inverse ? invText : theme.text,
      border: inverse ? 'none' : border,
      borderRadius: 16, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12, minHeight: 84,
      fontFamily: TYPO.fontText,
    }}>{children}</div>
  );

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {/* ① Inventario · ring cobertura */}
      <CardShell>
        <IconBadge icon={Package} color={PALETTE.purple.mid} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, margin: 0, color: theme.textMuted }}>Inventario en stock</p>
          <p style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', margin: '2px 0 0', color: theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1, fontFamily: TYPO.fontDisplay }}>
            {fmtCompact(inventario?.valor_inventario)}
          </p>
          <p style={{ fontSize: 11, color: theme.textMuted, margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>
            {fmtInt(inventario?.skus_con_stock)} SKUs
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, position: 'relative', color: ringCol }}>
            <svg width="36" height="36" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="18" cy="18" r={R} strokeWidth="3.5" fill="none" stroke={theme.border} />
              <circle cx="18" cy="18" r={R} strokeWidth="3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeDasharray={ringDash} strokeDashoffset={ringOffset} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>
              {dias != null ? `${dias}d` : '—'}
            </div>
          </div>
          <span style={{ fontSize: 10, color: theme.textMuted }}>cobertura</span>
        </div>
      </CardShell>

      {/* ② Cartera · placeholder aging INVERSE */}
      <CardShell inverse>
        <IconBadge icon={Receipt} color={theme.teal || '#5AC8FA'} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, margin: 0, color: invMuted }}>Cartera por cobrar</p>
          <p style={{ fontSize: 22, fontWeight: 500, margin: '2px 0 0', color: invText, opacity: 0.7, fontFamily: TYPO.fontDisplay, letterSpacing: '-0.02em', lineHeight: 1 }}>
            Próximamente
          </p>
          <p style={{ fontSize: 11, color: invMuted, margin: '2px 0 0', fontStyle: 'italic' }}>
            Pendiente ingesta estados_cuenta
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0, minWidth: 84 }}>
          <div style={{ display: 'flex', height: 5, borderRadius: 999, overflow: 'hidden', background: invDivider, width: 80 }}>
            <span style={{ display: 'block', height: '100%', width: '60%', background: green, opacity: 0.5 }} />
            <span style={{ display: 'block', height: '100%', width: '20%', background: theme.orange || '#FF9500', opacity: 0.5 }} />
            <span style={{ display: 'block', height: '100%', width: '12%', background: pink, opacity: 0.5 }} />
            <span style={{ display: 'block', height: '100%', width: '8%', background: red, opacity: 0.5 }} />
          </div>
          <span style={{ fontSize: 10, color: invMuted }}>aging</span>
        </div>
      </CardShell>

      {/* ③ Sell Out · mini spark 6m */}
      <CardShell>
        <IconBadge icon={ShoppingBag} color={pink} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, margin: 0, color: theme.textMuted }}>
            Sell Out {MESES_LBL[sellOutMes.mesEfectivo - 1]}
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
            <p style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', margin: 0, color: theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1, fontFamily: TYPO.fontDisplay }}>
              {fmtCompact(sellOutMes.total)}
            </p>
            {sellOutMes.deltaYoY != null && (
              <span style={{ fontSize: 11, fontWeight: 500, color: sellOutMes.deltaYoY >= 0 ? green : red, fontVariantNumeric: 'tabular-nums' }}>
                {sellOutMes.deltaYoY >= 0 ? '↑' : '↓'} {Math.abs(sellOutMes.deltaYoY).toFixed(1)}%
              </span>
            )}
          </div>
          <p style={{ fontSize: 11, color: theme.textMuted, margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>
            YTD {fmtCompact(sellOutMes.ytd)}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
          {sparkPts.length >= 2 ? (
            <svg width="72" height="22" style={{ display: 'block' }}>
              <path d={sparkPath} fill="none" stroke={pink} strokeWidth="1.5" strokeLinecap="round" />
              {sparkLast && <circle cx={sparkLast.x} cy={sparkLast.y} r="2" fill={pink} />}
            </svg>
          ) : (
            <div style={{ width: 72, height: 22 }} />
          )}
          <span style={{ fontSize: 10, color: theme.textMuted }}>6 meses</span>
        </div>
      </CardShell>
    </div>
  );
}

// ────────── Formateadores ──────────
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
const fmtPct = (n) => n == null || isNaN(n) ? '—' : n.toFixed(1) + '%';
const fmtPctDelta = (n) => n == null || isNaN(n) ? '—' : (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
const fmtInt = (n) => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('es-MX');

// ────────── Helpers ──────────
const sumYTDPor = (rows, fn, mesMax) => rows
  .filter((r) => Number(r.mes) <= mesMax)
  .reduce((s, r) => s + (Number(fn(r)) || 0), 0);

// ────────── Componente principal ──────────
export default function VisionGeneral() {
  const { theme } = useTheme();
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [aniosDisponibles, setAniosDisponibles] = useState([]);
  const [dimension, setDimension] = useState('canal'); // 'canal' | 'marca' | 'categoria'

  // Datos por dimensión (carga reactiva)
  const [margenAct, setMargenAct] = useState([]);
  const [margenPrev, setMargenPrev] = useState([]);
  const [margenPrev2, setMargenPrev2] = useState([]);
  const [clientesDim, setClientesDim] = useState([]);
  const [inventario, setInventario] = useState(null);
  const [inventarioMarca, setInventarioMarca] = useState([]);
  const [caminoResumen, setCaminoResumen] = useState([]);
  const [caminoCalendario, setCaminoCalendario] = useState([]);
  const [caminoProximas, setCaminoProximas] = useState([]);
  const [caminoSemanal, setCaminoSemanal] = useState([]);
  const [caminoRetrasadas, setCaminoRetrasadas] = useState([]);
  const [caminoProveedores, setCaminoProveedores] = useState([]);
  const [caminoAgotados, setCaminoAgotados] = useState([]);
  const [caminoLeadtime, setCaminoLeadtime] = useState(null);
  const [comprasYTD, setComprasYTD] = useState([]);
  const [cartera, setCartera] = useState([]);
  const [cuotas, setCuotas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [sellCanal, setSellCanal] = useState([]);
  const [sellCanalPrev, setSellCanalPrev] = useState([]);
  const [sellMayoristas, setSellMayoristas] = useState([]);
  const [sellRotacion, setSellRotacion] = useState([]);
  const [sellMensual, setSellMensual] = useState([]);
  const [sellMensualPrev, setSellMensualPrev] = useState([]);
  const [sellTopSkus, setSellTopSkus] = useState([]);
  const [sellTopClientes, setSellTopClientes] = useState([]);
  const [sellPromosResumen, setSellPromosResumen] = useState(null);
  const [sellPromosSkus, setSellPromosSkus] = useState([]);

  const [bloqueExpandido, setBloqueExpandido] = useState(null);

  // ── Años disponibles
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('v_vision_canal_mensual').select('anio').order('anio', { ascending: false });
      const unique = Array.from(new Set((data || []).map((r) => r.anio))).sort((a, b) => b - a);
      setAniosDisponibles(unique);
      if (unique.length > 0 && !unique.includes(anio)) setAnio(unique[0]);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Carga por dimensión + año
  useEffect(() => {
    setLoading(true);
    setBloqueExpandido(null);
    (async () => {
      // Fuente: facturacion_clientes (Excel "Venta Facturación" del ERP).
      // Por ahora solo soportamos dimension='canal' — marca/categoría
      // requieren ventas_erp completo con marca/familia.
      const [a, p, p2, c, inv, invMarca, cart, q, cRes, cCal, cProx, cSem, cRet, cProv, cAgo, cLT, cYTD,
             sCan, sCanPrev, sMay, sRot, sMen, sMenPrev, sSkus, sCli, sPromo, sPromoSkus] = await Promise.all([
        supabase.from('v_vision_factura_canal').select('*').eq('anio', anio),
        supabase.from('v_vision_factura_canal').select('*').eq('anio', anio - 1),
        supabase.from('v_vision_factura_canal').select('*').eq('anio', anio - 2),
        supabase.from('v_vision_factura_clientes').select('*').eq('anio', anio),
        supabase.from('v_vision_inventario_global').select('*').single(),
        supabase.from('v_vision_inventario_marca').select('*').order('valor', { ascending: false, nullsFirst: false }),
        supabase.from('v_vision_cartera_consolidada').select('*'),
        supabase.from('cuotas_canales').select('*').eq('anio', anio),
        supabase.from('v_vision_camino_resumen').select('*'),
        supabase.from('v_vision_camino_calendario').select('*'),
        supabase.from('v_vision_camino_proximas').select('*').limit(10),
        supabase.from('v_vision_camino_semanal').select('*').limit(12),
        supabase.from('v_vision_camino_retrasadas').select('*'),
        supabase.from('v_vision_camino_proveedores').select('*').limit(8),
        supabase.from('v_vision_camino_agotados').select('*').limit(10),
        supabase.from('v_vision_camino_leadtime').select('*').single(),
        supabase.from('v_vision_camino_compras_ytd').select('*'),
        supabase.from('v_vision_sellout_canal').select('*').eq('anio', anio),
        supabase.from('v_vision_sellout_canal').select('*').eq('anio', anio - 1),
        supabase.from('v_vision_sellout_mayoristas').select('*').eq('anio', anio).order('importe', { ascending: false }),
        supabase.from('v_vision_sellout_rotacion').select('*').order('rotacion_pct', { ascending: true, nullsFirst: false }),
        supabase.from('v_vision_sellout_mensual').select('*').eq('anio', anio),
        supabase.from('v_vision_sellout_mensual').select('*').eq('anio', anio - 1),
        supabase.from('v_vision_sellout_top_skus').select('*').eq('anio', anio).order('importe', { ascending: false }).limit(10),
        supabase.from('v_vision_sellout_top_clientes').select('*').eq('anio', anio).order('importe', { ascending: false }).limit(10),
        supabase.from('v_vision_sellout_promos').select('*').single(),
        supabase.from('v_vision_sellout_promos_top_skus').select('*').order('importe', { ascending: false }).limit(5),
      ]);
      setMargenAct(a.data || []);
      setMargenPrev(p.data || []);
      setMargenPrev2(p2.data || []);
      setClientesDim(c.data || []);
      setInventario(inv.data || null);
      setInventarioMarca(invMarca.data || []);
      setCartera(cart.data || []);
      setCuotas(q.data || []);
      setCaminoResumen(cRes.data || []);
      setCaminoCalendario(cCal.data || []);
      setCaminoProximas(cProx.data || []);
      setCaminoSemanal(cSem.data || []);
      setCaminoRetrasadas(cRet.data || []);
      setCaminoProveedores(cProv.data || []);
      setCaminoAgotados(cAgo.data || []);
      setCaminoLeadtime(cLT.data || null);
      setComprasYTD(cYTD.data || []);
      setSellCanal(sCan.data || []);
      setSellCanalPrev(sCanPrev.data || []);
      setSellMayoristas(sMay.data || []);
      setSellRotacion(sRot.data || []);
      setSellMensual(sMen.data || []);
      setSellMensualPrev(sMenPrev.data || []);
      setSellTopSkus(sSkus.data || []);
      setSellTopClientes(sCli.data || []);
      setSellPromosResumen(sPromo.data || null);
      setSellPromosSkus(sPromoSkus.data || []);
      setLoading(false);
    })();
  }, [anio, dimension]);

  // ── Mes máximo con datos
  const mesMax = useMemo(() => {
    let m = 0;
    margenAct.forEach((r) => { if (Number(r.mes) > m) m = Number(r.mes); });
    return m || 12;
  }, [margenAct]);

  // Siempre dimension = 'canal' por ahora (facturacion_clientes no trae marca/categoría).
  const dimKey = 'canal';

  // ── KPIs Hero (Venta YTD, Mes actual, Run-rate, # clientes activos)
  // Sin margen — facturacion_clientes no trae costo. Pendiente fórmula.
  const kpis = useMemo(() => {
    const ventaYTD   = sumYTDPor(margenAct, (r) => r.venta, mesMax);
    const piezasYTD  = sumYTDPor(margenAct, (r) => r.piezas, mesMax);
    const ventaPrev  = sumYTDPor(margenPrev, (r) => r.venta, mesMax);
    const ventaPrev2 = sumYTDPor(margenPrev2, (r) => r.venta, mesMax);

    // Mes actual (no acumulado)
    const ventaMes  = margenAct.filter((r) => Number(r.mes) === mesMax).reduce((s, r) => s + (Number(r.venta) || 0), 0);
    const ventaMesPrev = margenPrev.filter((r) => Number(r.mes) === mesMax).reduce((s, r) => s + (Number(r.venta) || 0), 0);

    // # clientes activos YTD
    const nClientesActivos = new Set(clientesDim.map((c) => c.cliente_nombre)).size;

    // Mejor / peor mes YTD (por total ventas del mes)
    const ventaPorMes = {};
    margenAct.filter((r) => Number(r.mes) <= mesMax).forEach((r) => {
      const m = Number(r.mes);
      ventaPorMes[m] = (ventaPorMes[m] || 0) + (Number(r.venta) || 0);
    });
    const mesesArr = Object.entries(ventaPorMes).map(([m, v]) => ({ mes: Number(m), venta: v }));
    const mejorMes = mesesArr.length ? mesesArr.reduce((a, b) => (b.venta > a.venta ? b : a)) : null;
    const peorMes  = mesesArr.length ? mesesArr.reduce((a, b) => (b.venta < a.venta ? b : a)) : null;
    const promedioMes = mesesArr.length ? ventaYTD / mesesArr.length : 0;

    // Run-rate: proyección lineal del año basada en YTD
    const runRate = mesMax > 0 ? ventaYTD * 12 / mesMax : 0;

    // Cuota total
    const cuotaTotal = cuotas.find((c) => c.dimension_tipo === 'TOTAL')?.meta_facturacion;
    const cumplYTD = cuotaTotal > 0 ? (ventaYTD / cuotaTotal) * 100 : null;
    const gapVsRunRate = cuotaTotal > 0 ? runRate - cuotaTotal : null;

    return {
      ventaYTD, piezasYTD, ventaPrev, ventaPrev2,
      ventaMes, ventaMesPrev,
      nClientesActivos,
      mejorMes, peorMes, promedioMes,
      deltaVenta:  ventaPrev > 0 ? ((ventaYTD - ventaPrev) / ventaPrev) * 100 : null,
      deltaVenta2: ventaPrev2 > 0 ? ((ventaYTD - ventaPrev2) / ventaPrev2) * 100 : null,
      deltaMes:    ventaMesPrev > 0 ? ((ventaMes - ventaMesPrev) / ventaMesPrev) * 100 : null,
      runRate,
      cuotaTotal,
      cumplYTD,
      gapVsRunRate,
      gapVsCuota: cuotaTotal > 0 ? cuotaTotal - ventaYTD : null,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [margenAct, margenPrev, margenPrev2, clientesDim, cuotas, mesMax]);

  // ── Bloques por canal (sin margen — pendiente de fórmula)
  const bloques = useMemo(() => {
    const m = new Map();
    margenAct
      .filter((r) => Number(r.mes) <= mesMax)
      .forEach((r) => {
        const k = r[dimKey] || 'Otros';
        if (!m.has(k)) m.set(k, { key: k, venta: 0, piezas: 0, byMes: {} });
        const it = m.get(k);
        it.venta  += Number(r.venta) || 0;
        it.piezas += Number(r.piezas) || 0;
        const ms = Number(r.mes);
        it.byMes[ms] = (it.byMes[ms] || 0) + (Number(r.venta) || 0);
      });
    // Δ YoY
    const prevMap = new Map();
    margenPrev
      .filter((r) => Number(r.mes) <= mesMax)
      .forEach((r) => {
        const k = r[dimKey] || 'Otros';
        prevMap.set(k, (prevMap.get(k) || 0) + (Number(r.venta) || 0));
      });
    const totalActual = Array.from(m.values()).reduce((s, c) => s + c.venta, 0);
    return Array.from(m.values())
      .map((it) => {
        const prev = prevMap.get(it.key) || 0;
        return {
          ...it,
          share: totalActual > 0 ? (it.venta / totalActual) * 100 : 0,
          deltaYoY: prev > 0 ? ((it.venta - prev) / prev) * 100 : null,
          pctMargen: null,
          spark: Array.from({ length: mesMax }, (_, i) => Number(it.byMes[i + 1]) || 0),
        };
      })
      .sort((a, b) => b.venta - a.venta);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [margenAct, margenPrev, dimKey, mesMax]);

  // ── Clientes del canal expandido (drill-down)
  const clientesDelBloque = useMemo(() => {
    if (!bloqueExpandido) return [];
    return clientesDim
      .filter((c) => c.canal === bloqueExpandido)
      .filter((c) => c.cliente_nombre && c.cliente_nombre !== 'Sin nombre')
      .sort((a, b) => Number(b.venta || 0) - Number(a.venta || 0));
  }, [clientesDim, bloqueExpandido]);

  // ── Tendencia 3 años para gráfica
  const tendencia = useMemo(() => {
    const sumarPorMes = (rows) => {
      const arr = Array(12).fill(null);
      rows.forEach((r) => {
        const m = Number(r.mes);
        if (m < 1 || m > 12) return;
        arr[m - 1] = (arr[m - 1] || 0) + (Number(r.venta) || 0);
      });
      return arr;
    };
    const act = sumarPorMes(margenAct);
    const pr1 = sumarPorMes(margenPrev);
    const pr2 = sumarPorMes(margenPrev2);
    return Array.from({ length: 12 }, (_, i) => ({
      mes: MESES_LBL[i],
      [`${anio}`]: act[i],
      [`${anio - 1}`]: pr1[i],
      [`${anio - 2}`]: pr2[i],
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [margenAct, margenPrev, margenPrev2, anio]);

  // ── Cartera consolidada
  const carteraResumen = useMemo(() => {
    const total = cartera.reduce((s, c) => s + (Number(c.saldo_actual) || 0), 0);
    const vencido = cartera.reduce((s, c) => s + (Number(c.saldo_vencido) || 0), 0);
    const aging0_30 = cartera.reduce((s, c) => s + (Number(c.aging_d0_30) || 0), 0);
    const aging31_60 = cartera.reduce((s, c) => s + (Number(c.aging_d31_60) || 0), 0);
    const aging61_90 = cartera.reduce((s, c) => s + (Number(c.aging_d61_90) || 0), 0);
    const agingMas90 = cartera.reduce((s, c) => s + (Number(c.aging_mas90) || 0), 0);
    return { total, vencido, aging0_30, aging31_60, aging61_90, agingMas90,
             pctVencido: total > 0 ? (vencido / total) * 100 : null };
  }, [cartera]);

  // ── Sell-out del último mes cerrado + comparativo mismo mes año anterior
  //   - Si mesMax coincide con el mes calendario actual, usamos mesMax-1
  //     para evitar mostrar un "mes en curso" incompleto contra el mismo mes
  //     del año pasado ya cerrado (daba falsos -80%+ en YoY).
  const sellOutMes = useMemo(() => {
    const mesCalendario = new Date().getMonth() + 1;
    const anioCalendario = new Date().getFullYear();
    const mesEfectivo = (anio === anioCalendario && mesMax === mesCalendario && mesMax > 1)
      ? mesMax - 1
      : mesMax;
    const total    = sellMensual.filter((r) => Number(r.mes) === mesEfectivo).reduce((s, r) => s + (Number(r.importe) || 0), 0);
    const prev     = sellMensualPrev.filter((r) => Number(r.mes) === mesEfectivo).reduce((s, r) => s + (Number(r.importe) || 0), 0);
    const ytd      = sellMensual.filter((r) => Number(r.mes) <= mesEfectivo).reduce((s, r) => s + (Number(r.importe) || 0), 0);
    const ytdPrev  = sellMensualPrev.filter((r) => Number(r.mes) <= mesEfectivo).reduce((s, r) => s + (Number(r.importe) || 0), 0);
    const sellinLag = sellRotacion.reduce((s, r) => s + (Number(r.sellin_lag_90d) || 0), 0);
    const sellOutYtdMayoreo = sellRotacion.reduce((s, r) => s + (Number(r.sellout_ytd) || 0), 0);
    return {
      total, prev, ytd, ytdPrev,
      mesEfectivo,
      esEnCurso: mesEfectivo !== mesMax,
      deltaYoY: prev > 0 ? ((total - prev) / prev) * 100 : null,
      deltaYTD: ytdPrev > 0 ? ((ytd - ytdPrev) / ytdPrev) * 100 : null,
      rotacionYTD: sellinLag > 0 ? (sellOutYtdMayoreo / sellinLag) * 100 : null,
      sellinLag, sellOutYtdMayoreo,
    };
  }, [sellMensual, sellMensualPrev, sellRotacion, mesMax, anio]);

  if (loading) {
    return <AppleLoader label="Cargando visión general…" />;
  }
  if (margenAct.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: theme.textMuted, background: theme.bg, minHeight: '100%', fontFamily: TYPO.fontText }}>
        <Activity style={{ width: 48, height: 48, color: theme.textSubtle, margin: '0 auto 16px', strokeWidth: 1.5 }} />
        <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 8, fontFamily: TYPO.fontDisplay, letterSpacing: '-0.02em' }}>Visión general</h2>
        <p>No hay datos para {anio}. Sube el archivo ERP en /uploads.html.</p>
      </div>
    );
  }

  return (
    <div className="max-w-none mx-auto p-6 space-y-4"
      style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%' }}>
      {/* Header estilo apple.com */}
      <div className="flex flex-wrap items-end justify-between gap-4 px-1 mb-2">
        <div>
          <p style={{
            fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em',
            color: theme.textMuted, marginBottom: 6, fontFamily: TYPO.fontText, fontWeight: 500,
          }}>
            Dirección Comercial · YTD ene–{MESES_LBL[mesMax - 1]} {anio}
          </p>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 44px)', fontWeight: 600, letterSpacing: '-0.035em',
            fontFamily: TYPO.fontDisplay, color: theme.text, margin: 0, lineHeight: 1.05,
          }}>Visión general.</h2>
          <p style={{ fontSize: 15, color: theme.textMuted, margin: '8px 0 0', fontFamily: TYPO.fontText }}>
            Cómo va el año y dónde poner el foco.
          </p>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 11, color: theme.textMuted, fontFamily: TYPO.fontText }}>
          Año
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}
            style={{
              border: `1px solid ${theme.border}`, borderRadius: 999,
              padding: '10px 20px', fontSize: 14, marginTop: 4,
              background: theme.surface, color: theme.text,
              fontFamily: TYPO.fontText,
            }}>
            {aniosDisponibles.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      {/* HERO 3-col: Facturación grande · Mes inverse · Run-rate */}
      <HeroCard kpis={kpis} anio={anio} mesMaxLabel={MESES_FULL[mesMax - 1]} />

      {/* KPIs mini · Compacto B · horizontal 84px con viz derecha */}
      <MiniKpiRow
        inventario={inventario}
        ventaProm={kpis.ventaYTD > 0 ? kpis.ventaYTD / mesMax : 0}
        sellOutMes={sellOutMes}
        sellMensual={sellMensual}
        anio={anio}
      />

      {/* Toggle dimensión */}
      <div className="flex items-center gap-3 px-1 mt-2 flex-wrap">
        <span style={{ fontSize: 11, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: TYPO.fontText }}>Ver mix por</span>
        <div style={{
          display: 'inline-flex', gap: 2, padding: 3, borderRadius: 10,
          background: theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        }}>
          {[
            { id: 'canal',     lbl: 'Canal', enabled: true },
            { id: 'marca',     lbl: 'Marca', enabled: false },
            { id: 'categoria', lbl: 'Categoría', enabled: false },
          ].map((t) => {
            const on = dimension === t.id;
            return (
              <button key={t.id}
                onClick={() => t.enabled && setDimension(t.id)}
                disabled={!t.enabled}
                title={!t.enabled ? 'Pendiente — requiere ventas_erp completo con marca/familia' : ''}
                style={{
                  padding: '6px 14px', borderRadius: 7,
                  background: on ? (theme.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'white') : 'transparent',
                  color: on ? theme.text : t.enabled ? theme.textMuted : theme.textSubtle,
                  border: 'none', fontFamily: TYPO.fontText, fontSize: 13,
                  fontWeight: on ? 600 : 500,
                  cursor: t.enabled ? 'pointer' : 'not-allowed',
                  boxShadow: on && theme.mode !== 'dark' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                }}>
                {t.lbl}
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: 10, color: theme.textSubtle, fontStyle: 'italic', fontFamily: TYPO.fontText }}>Marca / Categoría pendientes</span>
      </div>

      {/* Mix + Tendencia · misma fila */}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)' }}>
        <MixDonut
          bloques={bloques}
          ventaTotal={kpis.ventaYTD}
          deltaTotal={kpis.deltaVenta}
          anio={anio}
          expandido={bloqueExpandido}
          onSelect={(k) => setBloqueExpandido(bloqueExpandido === k ? null : k)}
          puedeSeleccionar={dimension === 'canal'}
        />
        <TendenciaCard data={tendencia} anio={anio} mesMax={mesMax} />
      </div>

      {/* Drill-down de clientes del bloque expandido (solo dimension=canal) */}
      {bloqueExpandido && dimension === 'canal' && (
        <ClientesPanel canal={bloqueExpandido} clientes={clientesDelBloque}
          mensualAct={margenAct} mensualPrev={margenPrev}
          anio={anio} mesMax={mesMax}
          onClose={() => setBloqueExpandido(null)} />
      )}

      {/* Bloque Sell Out */}
      <SellOutBloque
        sellCanal={sellCanal} sellCanalPrev={sellCanalPrev}
        sellMayoristas={sellMayoristas} sellRotacion={sellRotacion}
        sellMensual={sellMensual} sellMensualPrev={sellMensualPrev}
        sellTopSkus={sellTopSkus} sellTopClientes={sellTopClientes}
        sellPromosResumen={sellPromosResumen} sellPromosSkus={sellPromosSkus}
        sellOutMes={sellOutMes}
        anio={anio} mesMax={mesMax}
      />

      {/* Sección de inventario */}
      <InventarioSection inventario={inventario}
        inventarioMarca={inventarioMarca}
        caminoResumen={caminoResumen}
        caminoCalendario={caminoCalendario}
        caminoProximas={caminoProximas}
        caminoSemanal={caminoSemanal}
        caminoRetrasadas={caminoRetrasadas}
        caminoProveedores={caminoProveedores}
        caminoAgotados={caminoAgotados}
        caminoLeadtime={caminoLeadtime}
        comprasYTD={comprasYTD}
        anio={anio}
        ventaPromMes={mesMax > 0 ? kpis.ventaYTD / mesMax : 0} />

      <p style={{ fontSize: 11, color: theme.textSubtle, padding: '0 8px', fontFamily: TYPO.fontText }}>
        Fuente: facturacion_clientes (canal × cliente × SKU × mes), inventario_acteck
        (almacenes comerciales). Margen y cartera pendientes de fuente.
      </p>
    </div>
  );
}

// ────────── HERO Card ──────────
function HeroCard({ kpis, anio, mesMaxLabel }) {
  const { theme } = useTheme();
  const border = `1px solid ${theme.border}`;
  const invBg = theme.surfaceInverse || (theme.mode === 'dark' ? '#F5F5F7' : '#000000');
  const invText = theme.textOnInverse || (theme.mode === 'dark' ? '#1D1D1F' : '#F5F5F7');
  const invMuted = theme.mode === 'dark' ? 'rgba(29,29,31,0.72)' : 'rgba(245,245,247,0.72)';
  const invDivider = theme.mode === 'dark' ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.14)';
  const heroBadgeBg = theme.mode === 'dark' ? 'rgba(0,85,181,0.18)' : 'rgba(10,132,255,0.24)';
  const heroBadgeCol = theme.mode === 'dark' ? (theme.accent || '#0A84FF') : '#64B5FF';
  const green = theme.green || '#34C759';
  const red = theme.red || '#FF3B30';

  const cell = (label, val, delta, deltaCol) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '2px 0' }}>
      <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: invMuted, fontWeight: 500 }}>{label}</span>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, color: invText, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em' }}>{val}</span>
      {delta && <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: deltaCol || invMuted }}>{delta}</span>}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* ① Card INVERSE compacta · rail 2x2 a la derecha */}
      <div style={{
        background: invBg, color: invText, borderRadius: 22, padding: '22px 26px',
        display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 24, alignItems: 'center',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 11,
              background: heroBadgeBg, color: heroBadgeCol,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Wallet style={{ width: 18, height: 18 }} strokeWidth={1.8} />
            </div>
            <p style={{ fontSize: 11, margin: 0, color: invMuted, fontWeight: 500, fontFamily: TYPO.fontText }}>
              Facturación YTD {anio} · Dirección Comercial
            </p>
          </div>
          <p style={{ fontSize: 'clamp(44px, 5vw, 64px)', fontWeight: 600, letterSpacing: '-0.045em', margin: 0, color: invText, fontVariantNumeric: 'tabular-nums', lineHeight: 1, fontFamily: TYPO.fontDisplay }}>
            {fmtCompact(kpis.ventaYTD)}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12, marginTop: 8 }}>
            {kpis.deltaVenta != null && (
              <span style={{ fontSize: 13, fontWeight: 500, color: kpis.deltaVenta >= 0 ? green : red, fontVariantNumeric: 'tabular-nums' }}>
                {kpis.deltaVenta >= 0 ? '↑' : '↓'} {Math.abs(kpis.deltaVenta).toFixed(1)}%
              </span>
            )}
            <span style={{ fontSize: 12, color: invMuted, fontVariantNumeric: 'tabular-nums' }}>vs {fmtCompact(kpis.ventaPrev)} en {anio - 1}</span>
            {kpis.promedioMes > 0 && (
              <>
                <span style={{ fontSize: 12, color: invMuted }}>·</span>
                <span style={{ fontSize: 12, color: invMuted, fontVariantNumeric: 'tabular-nums' }}>~{fmtCompact(kpis.promedioMes)}/mes</span>
              </>
            )}
          </div>
        </div>

        {/* Rail 2x2 · vs 2025, vs 2024, mejor mes, peor mes */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px',
          paddingLeft: 24, borderLeft: `1px solid ${invDivider}`,
        }}>
          {kpis.deltaVenta != null && cell(
            `vs ${anio - 1}`,
            fmtCompact(kpis.ventaPrev),
            (kpis.deltaVenta >= 0 ? '↑' : '↓') + ' ' + Math.abs(kpis.deltaVenta).toFixed(1) + '%',
            kpis.deltaVenta >= 0 ? green : red
          )}
          {kpis.deltaVenta2 != null && cell(
            `vs ${anio - 2}`,
            fmtCompact(kpis.ventaPrev2),
            (kpis.deltaVenta2 >= 0 ? '↑' : '↓') + ' ' + Math.abs(kpis.deltaVenta2).toFixed(1) + '%',
            kpis.deltaVenta2 >= 0 ? green : red
          )}
          {kpis.mejorMes && cell(
            'Mejor mes YTD',
            fmtCompact(kpis.mejorMes.venta),
            MESES_FULL[kpis.mejorMes.mes - 1]
          )}
          {kpis.peorMes && cell(
            'Peor mes YTD',
            fmtCompact(kpis.peorMes.venta),
            MESES_FULL[kpis.peorMes.mes - 1] + (kpis.peorMes.mes === kpis.mejorMes?.mes ? '' : '')
          )}
        </div>
      </div>

      {/* ② + ③ · 2 cards blancas flat con badge inline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{
          background: theme.surface, borderRadius: 18, padding: '16px 18px', border,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <IconBadge icon={Activity} color={theme.orange || '#FF9500'} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 11, margin: 0, color: theme.textMuted, fontWeight: 500, fontFamily: TYPO.fontText }}>{mesMaxLabel} · mes en curso</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 2 }}>
              <p style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', margin: 0, color: theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1, fontFamily: TYPO.fontDisplay }}>
                {fmtCompact(kpis.ventaMes)}
              </p>
              {kpis.deltaMes != null && (
                <span style={{ fontSize: 12, fontWeight: 500, color: kpis.deltaMes >= 0 ? green : red, fontVariantNumeric: 'tabular-nums' }}>
                  {kpis.deltaMes >= 0 ? '↑' : '↓'} {Math.abs(kpis.deltaMes).toFixed(1)}%
                </span>
              )}
            </div>
            <p style={{ fontSize: 11, color: theme.textMuted, margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>
              vs {mesMaxLabel.toLowerCase()} {anio - 1} · {fmtCompact(kpis.ventaMesPrev)}
            </p>
          </div>
        </div>
        <div style={{
          background: theme.surface, borderRadius: 18, padding: '16px 18px', border,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <IconBadge icon={Target} color={PALETTE.purple.mid} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 11, margin: 0, color: theme.textMuted, fontWeight: 500, fontFamily: TYPO.fontText }}>
              {kpis.cuotaTotal > 0 ? 'Run-rate vs cuota' : 'Run-rate proyectado'}
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 2 }}>
              <p style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', margin: 0, color: theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1, fontFamily: TYPO.fontDisplay }}>
                {fmtCompact(kpis.runRate)}
              </p>
              {kpis.cuotaTotal > 0 && (
                <span style={{ fontSize: 12, fontWeight: 500, color: kpis.gapVsRunRate >= 0 ? green : red, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtPctDelta(kpis.cumplYTD - 100)}
                </span>
              )}
            </div>
            {kpis.cuotaTotal > 0 ? (
              <p style={{ fontSize: 11, color: theme.textMuted, margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                Meta {fmtCompact(kpis.cuotaTotal)} · YTD {fmtCompact(kpis.ventaYTD)}
              </p>
            ) : (
              <p style={{ fontSize: 11, color: theme.textMuted, margin: '2px 0 0', fontStyle: 'italic' }}>
                Sin cuota cargada · agrega en cuotas_canales
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────── Bento KPI ──────────
function BentoKpi({ palette, icon: Icon, label, valor, subtitulo, delta, deltaLabel, inverse = false }) {
  const { theme } = useTheme();
  const invBg = theme.surfaceInverse || (theme.mode === 'dark' ? '#F5F5F7' : '#000000');
  const invText = theme.textOnInverse || (theme.mode === 'dark' ? '#1D1D1F' : '#F5F5F7');
  const invMuted = theme.mode === 'dark' ? 'rgba(29,29,31,0.65)' : 'rgba(245,245,247,0.7)';
  const cardBg = inverse ? invBg : theme.surface;
  const txtCol = inverse ? invText : theme.text;
  const lblCol = inverse ? invMuted : theme.textMuted;
  const border = inverse ? 'none' : `1px solid ${theme.border}`;
  return (
    <div style={{
      background: cardBg, color: txtCol, borderRadius: 22, padding: 20, border,
      display: 'flex', flexDirection: 'column',
    }}>
      <IconBadge icon={Icon} color={palette.mid} size={40} />
      <p style={{ fontSize: 12, margin: '14px 0 4px', color: lblCol, fontWeight: 500, fontFamily: TYPO.fontText }}>{label}</p>
      <p style={{ fontSize: 32, fontWeight: 600, margin: '4px 0 0', color: txtCol, fontVariantNumeric: 'tabular-nums', lineHeight: 1.05, letterSpacing: '-0.03em', fontFamily: TYPO.fontDisplay }}>
        {valor}
      </p>
      <div style={{ fontSize: 12, color: lblCol, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
        {delta != null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginRight: 8, fontWeight: 500,
            color: delta >= 0 ? (theme.green || '#34C759') : (theme.red || '#FF3B30') }}>
            {delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {fmtPctDelta(delta)} {deltaLabel}
          </span>
        )}
        {subtitulo}
      </div>
    </div>
  );
}

// ────────── Bloque Bento (canal/marca/categoría) ──────────
function BloqueBento({ item, expandido, onClick, puedeExpandir, inverse = false }) {
  const { theme } = useTheme();
  const palette = colorBloque(item.key);
  const max = Math.max(...item.spark, 0) || 1;
  const min = Math.min(...item.spark, 0);
  const range = max - min || 1;
  const isDark = theme.mode === 'dark';
  const invBg = theme.surfaceInverse || (isDark ? '#F5F5F7' : '#000000');
  const invText = theme.textOnInverse || (isDark ? '#1D1D1F' : '#F5F5F7');
  const invMuted = isDark ? 'rgba(29,29,31,0.65)' : 'rgba(245,245,247,0.7)';
  const cardBg = inverse ? invBg : theme.surface;
  const txtCol = inverse ? invText : theme.text;
  const lblCol = inverse ? invMuted : theme.textMuted;
  const pillBg = inverse ? 'rgba(255,255,255,0.12)' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)');
  return (
    <button onClick={onClick}
      disabled={!puedeExpandir}
      style={{
        textAlign: 'left', display: 'block',
        background: cardBg, color: txtCol,
        border: inverse ? 'none' : ('1px solid ' + (expandido ? palette.mid : theme.border)),
        borderRadius: 22, padding: 20, cursor: puedeExpandir ? 'pointer' : 'default',
        transition: 'border 0.15s, box-shadow 0.15s',
        boxShadow: expandido && !inverse ? `0 0 0 3px ${isDark ? theme.border : palette.bg}` : 'none',
        fontFamily: TYPO.fontText,
      }}>
      <div className="flex items-center justify-between mb-1">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <IconBadge icon={TrendingUp} color={palette.mid} size={28} />
          <p style={{ fontSize: 12, margin: 0, color: theme.text, fontWeight: 500, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.key}</p>
        </div>
        <span style={{ fontSize: 10, padding: '1px 8px', background: pillBg, borderRadius: 10, color: theme.textMuted, fontWeight: 500, flexShrink: 0 }}>
          {item.share.toFixed(1)}%
        </span>
      </div>
      <p style={{ fontSize: 22, fontWeight: 600, margin: '6px 0 2px', color: theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-0.02em', fontFamily: TYPO.fontDisplay }}>
        {fmtCompact(item.venta)}
      </p>
      <div style={{ display: 'flex', gap: 10, fontSize: 11, fontVariantNumeric: 'tabular-nums', flexWrap: 'wrap' }}>
        {item.deltaYoY != null && (
          <span style={{ color: item.deltaYoY >= 0 ? theme.green : theme.red, fontWeight: 500 }}>
            {fmtPctDelta(item.deltaYoY)} YoY
          </span>
        )}
        {item.pctMargen != null && (
          <span style={{ color: palette.mid }}>
            margen {item.pctMargen.toFixed(1)}%
          </span>
        )}
      </div>
      {/* Mini sparkline */}
      {item.spark.length > 0 && (
        <svg viewBox="0 0 120 28" style={{ width: '100%', height: 28, marginTop: 8 }} preserveAspectRatio="none">
          <polyline fill="none" stroke={palette.mid} strokeWidth="1.5"
            points={item.spark.map((v, i) => {
              const x = item.spark.length > 1 ? (i / (item.spark.length - 1)) * 120 : 60;
              const y = 28 - (((v - min) / range) * 24);
              return `${x},${y}`;
            }).join(' ')} />
        </svg>
      )}
      {puedeExpandir && (
        <div className="flex items-center gap-1 mt-1" style={{ fontSize: 10, color: '#94A3B8' }}>
          {expandido ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {expandido ? 'ocultar clientes' : 'ver clientes'}
        </div>
      )}
    </button>
  );
}

// ────────── Drill-down: detalle del canal con chart y clientes ──────────
function ClientesPanel({ canal, clientes, mensualAct, mensualPrev, anio, mesMax, onClose }) {
  const { theme } = useTheme();
  const totalCanal = clientes.reduce((s, c) => s + (Number(c.venta) || 0), 0);
  const canalCol = colorCanalIOS(theme, canal);

  const ytdAct  = mensualAct.filter((r) => r.canal === canal && Number(r.mes) <= mesMax)
    .reduce((s, r) => s + (Number(r.venta) || 0), 0);
  const ytdPrev = mensualPrev.filter((r) => r.canal === canal && Number(r.mes) <= mesMax)
    .reduce((s, r) => s + (Number(r.venta) || 0), 0);
  const delta = ytdPrev > 0 ? ((ytdAct - ytdPrev) / ytdPrev) * 100 : null;
  const ventaMes  = mensualAct.filter((r) => r.canal === canal && Number(r.mes) === mesMax)
    .reduce((s, r) => s + (Number(r.venta) || 0), 0);
  const ventaMesPrev = mensualPrev.filter((r) => r.canal === canal && Number(r.mes) === mesMax)
    .reduce((s, r) => s + (Number(r.venta) || 0), 0);
  const deltaMes = ventaMesPrev > 0 ? ((ventaMes - ventaMesPrev) / ventaMesPrev) * 100 : null;
  const totalNegocio = mensualAct.reduce((s, r) => s + (Number(r.venta) || 0), 0) || 1;
  const shareCanal = (ytdAct / totalNegocio) * 100;

  const trendData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const a = mensualAct.filter((r) => r.canal === canal && Number(r.mes) === m).reduce((s, r) => s + (Number(r.venta) || 0), 0);
    const p = mensualPrev.filter((r) => r.canal === canal && Number(r.mes) === m).reduce((s, r) => s + (Number(r.venta) || 0), 0);
    return { mes: MESES_LBL[i], [`${anio - 1}`]: p || null, [`${anio}`]: m <= mesMax ? (a || null) : null };
  });

  const green = theme.green || '#34C759';
  const red = theme.red || '#FF3B30';

  const KBox = ({ lbl, val, sub, subColor, last }) => (
    <div style={{ padding: '2px 14px', borderRight: last ? 'none' : `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column' }}>
      <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, margin: 0 }}>{lbl}</p>
      <p style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em', color: subColor || theme.text, fontVariantNumeric: 'tabular-nums', margin: '2px 0 0' }}>{val}</p>
      {sub && <p style={{ fontSize: 10, color: subColor || theme.textMuted, fontVariantNumeric: 'tabular-nums', margin: '2px 0 0' }}>{sub}</p>}
    </div>
  );

  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 18,
      padding: '14px 20px', fontFamily: TYPO.fontText,
    }}>
      {/* Header inline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottom: `1px solid ${theme.border}`, marginBottom: 12 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: canalCol, flexShrink: 0 }} />
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text }}>{canal}</span>
        <span style={{ fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginLeft: 4 }}>
          · {clientes.length} clientes · {shareCanal.toFixed(1)}% del negocio total
        </span>
        <button onClick={onClose} title="Cerrar" style={{ marginLeft: 'auto', background: 'transparent', border: 0, color: theme.textMuted, cursor: 'pointer', padding: 4, lineHeight: 1 }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 4 KPIs sin bg · separados por dividers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 12 }}>
        <KBox lbl={`YTD ${anio}`} val={fmtCompact(ytdAct)} sub={`vs ${fmtCompact(ytdPrev)} en ${anio - 1}`} />
        <KBox lbl={`YTD ${anio - 1}`} val={fmtCompact(ytdPrev)} sub={`${mesMax} meses cerrados`} />
        <KBox lbl="Δ YoY" val={delta == null ? '—' : fmtPctDelta(delta)} sub={delta == null ? '' : `${delta >= 0 ? '+' : ''}${fmtCompact(ytdAct - ytdPrev)} vs prev`} subColor={delta == null ? theme.textMuted : delta >= 0 ? green : red} />
        <KBox lbl={`${MESES_FULL[mesMax - 1]} ${anio}`} val={fmtCompact(ventaMes)} sub={deltaMes != null ? `${deltaMes >= 0 ? '↑' : '↓'} ${Math.abs(deltaMes).toFixed(1)}% YoY` : ''} subColor={deltaMes == null ? theme.textMuted : deltaMes >= 0 ? green : red} last />
      </div>

      {/* Area chart Apple Health style · 2025 vs 2026 */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '8px 0 6px' }}>
        <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: theme.textMuted, fontWeight: 600, margin: 0 }}>Facturación mensual · {anio - 1} vs {anio}</p>
        <div style={{ display: 'inline-flex', gap: 10, fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 2, borderRadius: 1, background: canalCol }} />{anio}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 2, borderRadius: 1, background: theme.textMuted, opacity: 0.55 }} />{anio - 1}</span>
        </div>
      </div>
      <div style={{ width: '100%', height: 160, marginBottom: 14 }}>
        <ResponsiveContainer>
          <BarChart data={trendData} margin={{ top: 6, right: 4, left: -6, bottom: 0 }} barCategoryGap="18%" barGap={2}>
            <CartesianGrid stroke={theme.border} vertical={false} strokeOpacity={0.6} />
            <XAxis dataKey="mes" tick={{ fontSize: 9, fill: theme.textMuted }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tickFormatter={(v) => v == null ? '' : (v/1e6 >= 1 ? '$' + (v/1e6).toFixed(0) + 'M' : '$' + (v/1e3).toFixed(0) + 'K')} tick={{ fontSize: 9, fill: theme.textMuted }} axisLine={false} tickLine={false} width={38} />
            <Tooltip formatter={(v) => v != null ? fmtMoney(v) : '—'} cursor={{ fill: theme.textMuted, fillOpacity: 0.06 }} contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }} labelStyle={{ color: theme.textMuted, fontWeight: 500 }} />
            <Bar dataKey={`${anio - 1}`} fill={canalCol} fillOpacity={0.28} radius={[7, 7, 0, 0]} isAnimationActive={false} />
            <Bar dataKey={`${anio}`}     fill={canalCol}                       radius={[7, 7, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {clientes.length > 0 && (
        <>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: theme.textMuted, fontWeight: 600, margin: '4px 0 6px' }}>Top clientes · YTD {anio}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, padding: '6px 8px', borderBottom: `1px solid ${theme.border}`, width: 24 }}>#</th>
                <th style={{ textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, padding: '6px 8px', borderBottom: `1px solid ${theme.border}` }}>Cliente</th>
                <th style={{ textAlign: 'right', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, padding: '6px 8px', borderBottom: `1px solid ${theme.border}`, width: 100 }}>Venta YTD</th>
                <th style={{ textAlign: 'right', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, padding: '6px 8px', borderBottom: `1px solid ${theme.border}`, width: 110 }}>% del canal</th>
                <th style={{ textAlign: 'right', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, padding: '6px 8px', borderBottom: `1px solid ${theme.border}`, width: 80 }}>Piezas</th>
                <th style={{ textAlign: 'right', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, padding: '6px 8px', borderBottom: `1px solid ${theme.border}`, width: 60 }}>Meses</th>
              </tr>
            </thead>
            <tbody>
              {clientes.slice(0, 25).map((c, i) => {
                const venta = Number(c.venta) || 0;
                const share = totalCanal > 0 ? (venta / totalCanal) * 100 : 0;
                return (
                  <tr key={c.cliente_nombre + i}>
                    <td style={{ padding: '5px 8px', fontSize: 11, color: theme.textSubtle, fontWeight: 500, borderBottom: `1px solid ${theme.border}` }}>{i + 1}</td>
                    <td style={{ padding: '5px 8px', fontSize: 12, color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 500, letterSpacing: '-0.005em', borderBottom: `1px solid ${theme.border}`, maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.cliente_nombre}>{c.cliente_nombre}</td>
                    <td style={{ padding: '5px 8px', fontSize: 13, textAlign: 'right', color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600, letterSpacing: '-0.01em', borderBottom: `1px solid ${theme.border}` }}>{fmtCompact(venta)}</td>
                    <td style={{ padding: '5px 8px', fontSize: 12, textAlign: 'right', color: theme.text, borderBottom: `1px solid ${theme.border}` }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                        <span>{share.toFixed(1)}%</span>
                        <span style={{ width: 40, height: 4, background: theme.border, borderRadius: 999, position: 'relative', overflow: 'hidden' }}>
                          <span style={{ position: 'absolute', inset: 0, width: `${Math.min(share, 100)}%`, background: canalCol, borderRadius: 999 }} />
                        </span>
                      </span>
                    </td>
                    <td style={{ padding: '5px 8px', fontSize: 12, textAlign: 'right', color: theme.text, borderBottom: `1px solid ${theme.border}` }}>{fmtInt(c.piezas)}</td>
                    <td style={{ padding: '5px 8px', fontSize: 12, textAlign: 'right', color: theme.text, borderBottom: `1px solid ${theme.border}` }}>{c.meses_activos || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ────────── Mini KPI tile (drill-down del canal) ──────────
function MiniKpi({ palette, label, valor, sub }) {
  return (
    <div style={{ background: palette.bg, borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ fontSize: 10, margin: 0, color: palette.mid, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 500, margin: '2px 0 0', color: palette.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {valor}
      </p>
      {sub && <p style={{ fontSize: 10, color: palette.mid, margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>{sub}</p>}
    </div>
  );
}

// ────────── Tile "Próximamente" ──────────
function ProximamenteKpi({ icon: Icon, label, nota, inverse = false }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const invBg = theme.surfaceInverse || (isDark ? '#F5F5F7' : '#000000');
  const invText = theme.textOnInverse || (isDark ? '#1D1D1F' : '#F5F5F7');
  const invMuted = isDark ? 'rgba(29,29,31,0.65)' : 'rgba(245,245,247,0.7)';
  const cardBg = inverse ? invBg : theme.surface;
  const txtCol = inverse ? invText : theme.text;
  const lblCol = inverse ? invMuted : theme.textMuted;
  return (
    <div style={{
      background: cardBg, color: txtCol,
      borderRadius: 22, padding: 20,
      border: inverse ? 'none' : `1px solid ${theme.border}`,
      display: 'flex', flexDirection: 'column',
      fontFamily: TYPO.fontText,
    }}>
      <IconBadge icon={Icon} color={inverse ? (theme.accentCyan || theme.teal || '#5AC8FA') : (PALETTE.teal.mid)} size={40} />
      <p style={{ fontSize: 12, margin: '14px 0 4px', color: lblCol, fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 500, margin: '4px 0 0', color: lblCol, fontFamily: TYPO.fontDisplay, letterSpacing: '-0.02em' }}>Próximamente</p>
      {nota && <p style={{ fontSize: 11, color: lblCol, margin: '6px 0 0', fontStyle: 'italic', opacity: 0.8 }}>{nota}</p>}
    </div>
  );
}

// ────────── Cartera con aging (legacy — no se usa por ahora) ──────────
function CarteraCard({ cartera, resumen }) {
  if (cartera.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-medium text-gray-800">Cartera por cobrar</p>
        <p className="text-[11px] text-gray-400">
          Total {fmtMoney(resumen.total)} · Vencido {fmtCompact(resumen.vencido)}
          {resumen.pctVencido != null && ` (${resumen.pctVencido.toFixed(1)}%)`}
        </p>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        <AgingTile palette={PALETTE.teal}  label="0–30 días"  valor={resumen.aging0_30}  total={resumen.total} />
        <AgingTile palette={PALETTE.amber} label="31–60 días" valor={resumen.aging31_60} total={resumen.total} />
        <AgingTile palette={PALETTE.coral} label="61–90 días" valor={resumen.aging61_90} total={resumen.total} />
        <AgingTile palette={PALETTE.red}   label="+90 días"   valor={resumen.agingMas90} total={resumen.total} />
      </div>
      <table className="w-full" style={{ fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #E2E8F0' }}>
            <th style={thLeft}>Cliente</th>
            <th style={thRight}>Saldo total</th>
            <th style={thRight}>Vencido</th>
            <th style={thRight}>% vencido</th>
            <th style={thRight}>DSO</th>
            <th style={thRight}>Corte</th>
          </tr>
        </thead>
        <tbody>
          {cartera.sort((a, b) => Number(b.saldo_actual || 0) - Number(a.saldo_actual || 0)).map((c) => {
            const pctVenc = c.saldo_actual > 0 ? (Number(c.saldo_vencido) / Number(c.saldo_actual)) * 100 : 0;
            return (
              <tr key={c.cliente} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ ...tdLeft, textTransform: 'capitalize' }}>{c.cliente}</td>
                <td style={{ ...tdRight, fontWeight: 500 }}>{fmtCompact(c.saldo_actual)}</td>
                <td style={tdRight}>{fmtCompact(c.saldo_vencido)}</td>
                <td style={{ ...tdRight, color: pctVenc >= 20 ? PALETTE.red.mid : pctVenc >= 10 ? PALETTE.amber.mid : PALETTE.teal.mid, fontWeight: 500 }}>
                  {pctVenc.toFixed(1)}%
                </td>
                <td style={tdRight}>{c.dso != null ? Math.round(Number(c.dso)) + 'd' : '—'}</td>
                <td style={{ ...tdRight, color: '#94A3B8' }}>{c.fecha_corte || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AgingTile({ palette, label, valor, total }) {
  const pct = total > 0 ? (valor / total) * 100 : 0;
  return (
    <div style={{ background: palette.bg, borderRadius: 10, padding: '10px 12px' }}>
      <p style={{ fontSize: 10, color: palette.mid, margin: 0, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 500, margin: '4px 0 2px', color: palette.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {fmtCompact(valor)}
      </p>
      <p style={{ fontSize: 11, color: palette.mid, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
        {pct.toFixed(1)}%
      </p>
    </div>
  );
}

// ────────── Tendencia 3 años ──────────
function TendenciaCard({ data, anio, mesMax }) {
  const { theme } = useTheme();
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 18, padding: '14px 18px', fontFamily: TYPO.fontText, display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 6 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, margin: 0, fontFamily: TYPO.fontDisplay }}>Tendencia mensual · 3 años.</h4>
        <div style={{ display: 'inline-flex', gap: 10, fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 2, borderRadius: 1, background: theme.accent }} />{anio}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 2, borderRadius: 1, background: theme.textMuted, opacity: 0.6 }} />{anio - 1}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 2, borderRadius: 1, background: theme.textMuted, opacity: 0.3 }} />{anio - 2}</span>
        </div>
      </div>
      <div style={{ width: '100%', height: 158, flex: 1 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 6, right: 4, left: -6, bottom: 0 }}>
            <defs>
              <linearGradient id="fillNow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={theme.accent} stopOpacity={0.18} />
                <stop offset="100%" stopColor={theme.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={theme.border} vertical={false} strokeOpacity={0.6} />
            <XAxis dataKey="mes" tick={{ fontSize: 9, fill: theme.textMuted }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tickFormatter={(v) => v == null ? '' : (v/1e6 >= 1 ? '$' + (v/1e6).toFixed(0) + 'M' : '$' + (v/1e3).toFixed(0) + 'K')} tick={{ fontSize: 9, fill: theme.textMuted }} axisLine={false} tickLine={false} width={38} />
            <Tooltip formatter={(v) => v != null ? fmtMoney(v) : '—'} contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }} labelStyle={{ color: theme.textMuted, fontWeight: 500 }} />
            <Area type="monotone" dataKey={`${anio - 2}`} stroke={theme.textMuted} strokeOpacity={0.35} strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} isAnimationActive={false} />
            <Area type="monotone" dataKey={`${anio - 1}`} stroke={theme.textMuted} strokeOpacity={0.55} strokeWidth={1.4} fill="none" dot={false} isAnimationActive={false} />
            <Area type="monotone" dataKey={`${anio}`}     stroke={theme.accent} strokeWidth={2.2} fill="url(#fillNow)" dot={false} activeDot={{ r: 4, fill: theme.surface, stroke: theme.accent, strokeWidth: 2 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ────────── Sección de Inventario ──────────
function InventarioSection({ inventario, inventarioMarca, caminoResumen, caminoCalendario, caminoProximas, caminoSemanal, caminoRetrasadas, caminoProveedores, caminoAgotados, caminoLeadtime, comprasYTD, anio, ventaPromMes }) {
  const { theme } = useTheme();
  // Unificado en los 3 temas: surface + strip lateral color paleta.
  const cardBgFor = () => theme.surface;
  const cardTitleFor = () => theme.text;
  const cardLabelFor = () => theme.textMuted;
  const cardBorder = `1px solid ${theme.border}`;
  // Buckets de estatus en orden de pipeline + total agregado
  const BUCKET_LABELS = {
    produccion:        { label: 'En producción',      palette: PALETTE.amber },
    transito:          { label: 'Tránsito marítimo',  palette: PALETTE.blue },
    pendiente_modular: { label: 'Pendiente modular',  palette: PALETTE.purple },
    por_zarpar:        { label: 'Por zarpar',         palette: PALETTE.coral },
    por_consolidar:    { label: 'Por consolidar',     palette: PALETTE.gray },
    sin_embarque:      { label: 'Sin embarque',       palette: PALETTE.gray },
    otro:              { label: 'Otro',               palette: PALETTE.gray },
  };
  const BUCKET_ORDER = ['produccion', 'transito', 'pendiente_modular', 'por_zarpar', 'por_consolidar'];
  const resumenMap = new Map(caminoResumen.map((r) => [r.bucket_estatus, r]));
  const totalEnCamino = caminoResumen
    .filter((r) => ['produccion','transito','pendiente_modular','por_zarpar','por_consolidar'].includes(r.bucket_estatus))
    .reduce((s, r) => s + (Number(r.valor_mxn) || 0), 0);
  const totalPiezasEnCamino = caminoResumen
    .filter((r) => ['produccion','transito','pendiente_modular','por_zarpar','por_consolidar'].includes(r.bucket_estatus))
    .reduce((s, r) => s + (Number(r.piezas) || 0), 0);
  const totalPosEnCamino = caminoResumen
    .filter((r) => ['produccion','transito','pendiente_modular','por_zarpar','por_consolidar'].includes(r.bucket_estatus))
    .reduce((s, r) => s + (Number(r.pos) || 0), 0);
  const sinEmbarque = resumenMap.get('sin_embarque');
  const tieneCamino = totalEnCamino > 0 || totalPosEnCamino > 0;

  // KPIs strip
  const valorInv = Number(inventario?.valor_inventario) || 0;
  const piezas   = Number(inventario?.piezas_disponibles) || 0;
  const skus     = Number(inventario?.skus_con_stock) || 0;
  const agotados = Number(inventario?.skus_agotados) || 0;
  const diasCob  = ventaPromMes > 0 ? Math.round(valorInv / ventaPromMes * 30) : null;
  const cobLbl   = diasCob == null ? '—'
                  : diasCob < 60  ? 'Bajo'
                  : diasCob > 120 ? 'Alto'
                  : 'Sano';

  // Filtra marcas y agrupa pequeñas en "Otros"
  const totalMarca = inventarioMarca.reduce((s, m) => s + (Number(m.valor) || 0), 0);
  const marcasTop = inventarioMarca
    .filter((m) => (Number(m.valor) || 0) > 0)
    .slice(0, 5);
  const otrasMarcasVal = inventarioMarca
    .slice(5)
    .reduce((s, m) => s + (Number(m.valor) || 0), 0);
  const marcasParaDonut = otrasMarcasVal > 0
    ? [...marcasTop, { marca: 'Otras marcas', valor: otrasMarcasVal, skus: 0 }]
    : marcasTop;
  const MARCA_COLOR = {
    'ACTECK': PALETTE.purple.mid,
    'BALAM RUSH': PALETTE.coral.strong,
    'MOBIFREE': PALETTE.blue.mid,
    'SWANN': PALETTE.teal.mid,
    'EVOROK': PALETTE.amber.mid,
    'Sin marca': PALETTE.gray.mid,
    'Otras marcas': PALETTE.gray.strong,
  };
  const colorMarca = (m) => MARCA_COLOR[String(m).toUpperCase()] || MARCA_COLOR[m] || PALETTE.pink.mid;

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between px-1">
        <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: theme.textMuted, margin: 0, fontFamily: TYPO.fontText }}>
          <Package className="inline w-3 h-3 mr-1" style={{ verticalAlign: -1 }} />
          Inventario
        </p>
        <p style={{ fontSize: 11, color: theme.textSubtle, margin: 0, fontFamily: TYPO.fontText }}>
          Almacenes comerciales · al {inventario?.ultima_carga ? new Date(inventario.ultima_carga).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
        </p>
      </div>

      {/* 4 KPI tiles */}
      <div className="grid grid-cols-4 gap-2">
        <div style={{ background: cardBgFor(PALETTE.purple), borderRadius: 12, padding: '12px 14px', border: cardBorder, borderLeft: `3px solid ${PALETTE.purple.mid}` }}>
          <p style={{ fontSize: 10, color: cardLabelFor(PALETTE.purple), margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em', fontFamily: TYPO.fontText }}>Valor en stock</p>
          <p style={{ fontSize: 22, fontWeight: 600, margin: '4px 0 2px', color: cardTitleFor(PALETTE.purple), fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, letterSpacing: '-0.02em', fontFamily: TYPO.fontDisplay }}>
            {fmtCompact(valorInv)}
          </p>
          <p style={{ fontSize: 11, color: cardLabelFor(PALETTE.purple), margin: 0 }}>
            {fmtInt(piezas)} piezas · {fmtInt(skus)} SKUs
          </p>
        </div>
        <div style={{ background: cardBgFor(PALETTE.teal), borderRadius: 12, padding: '12px 14px', border: cardBorder, borderLeft: `3px solid ${PALETTE.teal.mid}` }}>
          <p style={{ fontSize: 10, color: cardLabelFor(PALETTE.teal), margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em', fontFamily: TYPO.fontText }}>Días cobertura</p>
          <p style={{ fontSize: 22, fontWeight: 600, margin: '4px 0 2px', color: cardTitleFor(PALETTE.teal), fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, letterSpacing: '-0.02em', fontFamily: TYPO.fontDisplay }}>
            {diasCob != null ? `~${diasCob} días` : '—'}
          </p>
          <p style={{ fontSize: 11, color: cardLabelFor(PALETTE.teal), margin: 0 }}>{cobLbl}</p>
        </div>
        <div style={{ background: cardBgFor(PALETTE.amber), borderRadius: 12, padding: '12px 14px', border: cardBorder, borderLeft: `3px solid ${PALETTE.amber.mid}` }}>
          <p style={{ fontSize: 10, color: cardLabelFor(PALETTE.amber), margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em', fontFamily: TYPO.fontText }}>SKUs agotados</p>
          <p style={{ fontSize: 22, fontWeight: 600, margin: '4px 0 2px', color: cardTitleFor(PALETTE.amber), fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, letterSpacing: '-0.02em', fontFamily: TYPO.fontDisplay }}>
            {fmtInt(agotados)}
          </p>
          <p style={{ fontSize: 11, color: cardLabelFor(PALETTE.amber), margin: 0 }}>Con venta reciente</p>
        </div>
        {tieneCamino ? (
          <div style={{ background: cardBgFor(PALETTE.blue), borderRadius: 12, padding: '12px 14px', border: cardBorder, borderLeft: `3px solid ${PALETTE.blue.mid}` }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 2 }}>
              <p style={{ fontSize: 10, color: cardLabelFor(PALETTE.blue), margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em', fontFamily: TYPO.fontText }}>Valor en camino</p>
              <Ship className="w-3.5 h-3.5" style={{ color: PALETTE.blue.mid }} />
            </div>
            <p style={{ fontSize: 22, fontWeight: 600, margin: '4px 0 2px', color: cardTitleFor(PALETTE.blue), fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, letterSpacing: '-0.02em', fontFamily: TYPO.fontDisplay }}>
              {fmtCompact(totalEnCamino)}
            </p>
            <p style={{ fontSize: 11, color: cardLabelFor(PALETTE.blue), margin: 0 }}>
              {fmtInt(totalPosEnCamino)} PO · {fmtInt(totalPiezasEnCamino)} pzs
            </p>
          </div>
        ) : (
          <ProximamenteKpi icon={Ship} label="Valor en camino" nota="Sube ERP con Vw_TablaH_Compras" />
        )}
      </div>

      {/* Composición: marca + categoría pendiente */}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-800 mb-2">Composición por marca</p>
          {marcasParaDonut.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Sin datos de marca</p>
          ) : (
            <>
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={marcasParaDonut} dataKey="valor" nameKey="marca"
                      innerRadius={48} outerRadius={80} stroke="#fff" strokeWidth={2}
                      isAnimationActive={false}>
                      {marcasParaDonut.map((m, i) => <Cell key={i} fill={colorMarca(m.marca)} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-col gap-1">
                {marcasParaDonut.map((m) => {
                  const share = totalMarca > 0 ? ((Number(m.valor) || 0) / totalMarca) * 100 : 0;
                  return (
                    <div key={m.marca} className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5">
                        <span style={{ width: 8, height: 8, background: colorMarca(m.marca), display: 'inline-block' }} />
                        {m.marca}
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: '#64748B' }}>
                        {fmtCompact(m.valor)} · {share.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div style={{
          background: '#F8FAFC', borderRadius: 12, padding: 16, border: '1px dashed #CBD5E1',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 320,
        }}>
          <Package className="w-7 h-7 mb-2" style={{ color: '#94A3B8' }} />
          <p className="text-[13px] text-gray-600 font-medium m-0">Composición por categoría</p>
          <p className="text-[14px] text-gray-800 font-medium mt-1">Próximamente</p>
          <p className="text-[11px] text-gray-400 mt-2 italic text-center" style={{ maxWidth: 280 }}>
            Pendiente confirmar fuente de categorías
          </p>
        </div>
      </div>

      {/* Inventario en camino */}
      {!tieneCamino ? (
        <div style={{
          background: '#F8FAFC', borderRadius: 12, padding: '28px 16px', border: '1px dashed #CBD5E1',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        }}>
          <Ship className="w-8 h-8 mb-2" style={{ color: '#94A3B8' }} />
          <p className="text-[13px] text-gray-600 font-medium m-0">Inventario en camino</p>
          <p className="text-[16px] text-gray-800 font-medium mt-1">Sin datos cargados</p>
          <p className="text-[11px] text-gray-400 mt-2 italic text-center" style={{ maxWidth: 420 }}>
            Sube el ERP con la hoja Vw_TablaH_Compras para ver POs pendientes con valor MXN.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
            <p className="text-sm font-medium text-gray-800">
              <Ship className="inline w-4 h-4 mr-1" style={{ verticalAlign: -2 }} />
              Inventario en camino
            </p>
            <p className="text-[11px] text-gray-400">
              Vw_TablaH_Compras × Master Embarques · {fmtInt(totalPosEnCamino)} POs activas
            </p>
          </div>

          {/* Banner alerta PO en retraso */}
          {caminoRetrasadas.length > 0 && (
            <RetrasadasBanner retrasadas={caminoRetrasadas} />
          )}

          {/* Hero: 3 KPIs grandes (Valor / Lead time / Compras YTD vs prev) */}
          <CaminoHero
            valor={totalEnCamino}
            piezas={totalPiezasEnCamino}
            pos={totalPosEnCamino}
            inventarioStock={Number(inventario?.valor_inventario) || 0}
            leadtime={caminoLeadtime}
            comprasYTD={comprasYTD}
            anio={anio}
          />

          {/* Lead time por etapa */}
          {caminoLeadtime && caminoLeadtime.lt_total > 0 && (
            <LeadtimeEtapas lt={caminoLeadtime} />
          )}

          {/* Tiles por estatus */}
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: theme.textMuted, marginBottom: 8, fontFamily: TYPO.fontText }}>Por estatus actual</p>
          <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {BUCKET_ORDER.map((k) => {
              const cfg = BUCKET_LABELS[k];
              const r = resumenMap.get(k);
              const val = Number(r?.valor_mxn) || 0;
              const piezas = Number(r?.piezas) || 0;
              const pos = Number(r?.pos) || 0;
              return (
                <div key={k} style={{
                  background: theme.surface, border: `1px solid ${theme.border}`,
                  borderLeft: `3px solid ${cfg.palette.mid}`,
                  borderRadius: 12, padding: '10px 12px', fontFamily: TYPO.fontText,
                }}>
                  <p style={{ fontSize: 9, color: theme.textMuted, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cfg.label}</p>
                  <p style={{ fontSize: 18, fontWeight: 600, margin: '4px 0 0', color: theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, letterSpacing: '-0.02em', fontFamily: TYPO.fontDisplay }}>
                    {val > 0 ? fmtCompact(val) : '—'}
                  </p>
                  <p style={{ fontSize: 10, color: theme.textMuted, margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtInt(piezas)} pzs · {pos} PO
                  </p>
                </div>
              );
            })}
          </div>

          {/* Concentración semanal (próximas semanas) */}
          {caminoSemanal.length > 0 && (
            <ConcentracionSemanal semanas={caminoSemanal} />
          )}

          {/* 2 columnas: Top proveedores + SKUs agotados con orden */}
          {(caminoProveedores.length > 0 || caminoAgotados.length > 0) && (
            <div className="grid gap-2.5 mb-4" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
              {caminoProveedores.length > 0 && (
                <TopProveedores proveedores={caminoProveedores} totalCamino={totalEnCamino} />
              )}
              {caminoAgotados.length > 0 && (
                <AgotadosConOrden agotados={caminoAgotados} />
              )}
            </div>
          )}

          {/* Próximas PO */}
          {caminoProximas.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">Próximas {Math.min(caminoProximas.length, 10)} POs en llegar</p>
              <div className="overflow-x-auto">
                <table className="w-full" style={{ fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={thLeft}>PO</th>
                      <th style={thLeft}>Proveedor</th>
                      <th style={thRight}>ETA CEDIS</th>
                      <th style={thRight}>SKUs</th>
                      <th style={thRight}>Piezas</th>
                      <th style={thRight}>Valor MXN</th>
                      <th style={thLeft}>Estatus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caminoProximas.slice(0, 10).map((r) => {
                      const cfg = BUCKET_LABELS[r.bucket_estatus] || BUCKET_LABELS.otro;
                      const eta = r.eta_cedis || r.eta_puerto;
                      return (
                        <tr key={r.movid} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={tdLeft}>{r.movid}</td>
                          <td style={{ ...tdLeft, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.proveedor}>
                            {r.proveedor}
                          </td>
                          <td style={tdRight}>{eta ? new Date(eta).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '—'}</td>
                          <td style={tdRight}>{fmtInt(r.skus)}</td>
                          <td style={tdRight}>{fmtInt(r.piezas)}</td>
                          <td style={{ ...tdRight, fontWeight: 500 }}>{fmtCompact(r.valor_mxn)}</td>
                          <td style={tdLeft}>
                            <span style={{
                              fontSize: 10, padding: '1px 6px', borderRadius: 8,
                              background: cfg.palette.bg, color: cfg.palette.text,
                            }}>{cfg.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Sin embarque asignado */}
          {sinEmbarque && Number(sinEmbarque.valor_mxn) > 0 && (
            <div className="mt-4 p-3 rounded-lg flex items-center justify-between gap-3" style={{ background: cardBgFor(PALETTE.gray), border: `1px dashed ${theme.border}`, fontFamily: TYPO.fontText }}>
              <div>
                <p className="text-[11px] m-0 font-medium" style={{ color: cardTitleFor(PALETTE.gray) }}>
                  {fmtInt(sinEmbarque.pos)} POs sin embarque asignado en Master
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: cardLabelFor(PALETTE.gray) }}>
                  Probablemente compras nacionales o aún sin mapear en Master Embarques.
                </p>
              </div>
              <span className="font-medium" style={{ fontSize: 14, color: PALETTE.gray.text, fontVariantNumeric: 'tabular-nums' }}>
                {fmtCompact(sinEmbarque.valor_mxn)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────── Sub-componentes del bloque 'Inventario en camino' ──────────

function RetrasadasBanner({ retrasadas }) {
  const { theme } = useTheme();
  const total = retrasadas.reduce((s, r) => s + (Number(r.valor_mxn) || 0), 0);
  const top = retrasadas.slice(0, 2);
  const restante = retrasadas.length - top.length;
  return (
    <div style={{
      background: theme.surface,
      border: `1px solid ${theme.border}`,
      borderLeft: `4px solid ${theme.red}`,
      borderRadius: 10,
      padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12,
      fontFamily: TYPO.fontText,
    }}>
      <i className="ti ti-alert-triangle" style={{ fontSize: 22, color: theme.red, flex: 'none' }} aria-hidden="true" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, margin: 0, color: theme.text, fontWeight: 500 }}>
          {retrasadas.length} {retrasadas.length === 1 ? 'PO' : 'POs'} en retraso · {fmtCompact(total)} atrapados
        </p>
        <p style={{ fontSize: 11, margin: '2px 0 0', color: theme.textMuted }}>
          {top.map((r, i) => (
            <span key={r.movid}>
              {i > 0 && ' · '}
              <strong>{r.movid}</strong> {r.dias_retraso}d retraso ({r.dias_desde_emision}d desde emisión) {fmtCompact(r.valor_mxn)}
            </span>
          ))}
          {restante > 0 && ` · y ${restante} más`}
        </p>
      </div>
    </div>
  );
}

function CaminoHero({ valor, piezas, pos, inventarioStock, leadtime, comprasYTD, anio }) {
  const { theme } = useTheme();
  // Unificado en los 3 temas: surface + strip lateral color paleta.
  const cardBgFor = () => theme.surface;
  const cardTitleFor = () => theme.text;
  const cardLabelFor = () => theme.textMuted;
  const cardBorder = `1px solid ${theme.border}`;

  const ratioStock = inventarioStock > 0 ? Math.round((valor / inventarioStock) * 100) : null;
  const ytdAct = comprasYTD.find((r) => r.anio === anio);
  const ytdPrev = comprasYTD.find((r) => r.anio === anio - 1);
  const valorYTD = Number(ytdAct?.valor_mxn) || 0;
  const valorYTDPrev = Number(ytdPrev?.valor_mxn) || 0;
  const deltaYoY = valorYTDPrev > 0 ? ((valorYTD - valorYTDPrev) / valorYTDPrev) * 100 : null;

  return (
    <div className="grid gap-2.5 mb-3.5" style={{ gridTemplateColumns: '1.6fr 1fr 1fr' }}>
      <div style={{ background: cardBgFor(PALETTE.blue), borderRadius: 16, padding: '14px 18px', border: cardBorder, borderLeft: `4px solid ${PALETTE.blue.mid}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <IconBadge icon={Ship} color={PALETTE.blue.mid} size={36} />
          <p style={{ fontSize: 11, margin: 0, color: cardLabelFor(PALETTE.blue), letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: TYPO.fontText }}>Valor en tránsito</p>
        </div>
        <p style={{ fontSize: 34, fontWeight: 600, margin: '4px 0 2px', color: cardTitleFor(PALETTE.blue), fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-0.03em', fontFamily: TYPO.fontDisplay }}>
          {fmtCompact(valor)}
        </p>
        <p style={{ fontSize: 11, color: cardLabelFor(PALETTE.blue), margin: 0 }}>
          {fmtInt(piezas)} piezas · {pos} órdenes{ratioStock != null ? ` · ${ratioStock}% del stock actual` : ''}
        </p>
      </div>
      <div style={{ background: cardBgFor(PALETTE.amber), borderRadius: 14, padding: '14px 18px', border: cardBorder, borderLeft: `3px solid ${PALETTE.amber.mid}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <IconBadge icon={Package} color={PALETTE.amber.mid} size={32} />
          <p style={{ fontSize: 11, margin: 0, color: cardLabelFor(PALETTE.amber), letterSpacing: '0.03em', fontFamily: TYPO.fontText }}>Lead time promedio</p>
        </div>
        <p style={{ fontSize: 24, fontWeight: 600, margin: '4px 0 2px', color: cardTitleFor(PALETTE.amber), fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, letterSpacing: '-0.02em', fontFamily: TYPO.fontDisplay }}>
          {leadtime?.lt_total != null ? `${leadtime.lt_total} días` : '—'}
        </p>
        <p style={{ fontSize: 11, color: cardLabelFor(PALETTE.amber), margin: 0 }}>
          Emisión → arribo CEDIS
        </p>
      </div>
      <div style={{ background: cardBgFor(PALETTE.purple), borderRadius: 14, padding: '14px 18px', border: cardBorder, borderLeft: `3px solid ${PALETTE.purple.mid}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <IconBadge icon={ShoppingBag} color={PALETTE.purple.mid} size={32} />
          <p style={{ fontSize: 11, margin: 0, color: cardLabelFor(PALETTE.purple), letterSpacing: '0.03em', fontFamily: TYPO.fontText }}>Compras YTD {anio}</p>
        </div>
        <p style={{ fontSize: 24, fontWeight: 600, margin: '4px 0 2px', color: cardTitleFor(PALETTE.purple), fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, letterSpacing: '-0.02em', fontFamily: TYPO.fontDisplay }}>
          {fmtCompact(valorYTD)}
        </p>
        <p style={{ fontSize: 11, margin: 0 }}>
          {deltaYoY != null && (
            <span style={{ color: deltaYoY >= 0 ? '#0F6E56' : '#A32D2D', fontWeight: 500 }}>
              {fmtPctDelta(deltaYoY)} vs {anio - 1}
            </span>
          )}
          {ytdAct && <span style={{ color: PALETTE.purple.mid }}> · {fmtInt(ytdAct.pos)} PO · {fmtInt(ytdAct.skus)} SKUs</span>}
        </p>
      </div>
    </div>
  );
}

function LeadtimeEtapas({ lt }) {
  const total = lt.lt_total || 1;
  const etapas = [
    { label: '1. Producción',       dias: lt.lt_produccion, color: '#BA7517' },
    { label: '2. Tránsito marítimo', dias: lt.lt_transito,   color: '#185FA5' },
    { label: '3. Aduana → CEDIS',    dias: lt.lt_aduana,     color: '#1D9E75' },
  ];
  return (
    <>
      <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">Lead time desglosado por etapa</p>
      <div className="grid gap-1.5 mb-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {etapas.map((e) => {
          const pct = Math.round((e.dias / total) * 100);
          return (
            <div key={e.label} style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 12px' }}>
              <div className="flex items-center justify-between">
                <p style={{ fontSize: 10, margin: 0, color: '#6B6A64', textTransform: 'uppercase' }}>{e.label}</p>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>~{pct}%</span>
              </div>
              <p style={{ fontSize: 18, fontWeight: 500, margin: '2px 0 0', color: '#1E293B', fontVariantNumeric: 'tabular-nums' }}>
                {e.dias} días
              </p>
              <div style={{ height: 4, background: '#E2E8F0', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ width: pct + '%', height: '100%', background: e.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function ConcentracionSemanal({ semanas }) {
  const data = semanas.map((r) => ({
    semana: new Date(r.semana).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
    valor: (Number(r.valor_mxn) || 0) / 1e6,
    pos: Number(r.pos) || 0,
    piezas: Number(r.piezas) || 0,
    skus: Number(r.skus) || 0,
  }));
  const max = Math.max(...data.map((d) => d.valor), 0);
  const colors = data.map((d) => d.valor === max && max > 0 ? PALETTE.coral.mid : PALETTE.blue.mid);
  const picoLabel = max > 0 ? data.find((d) => d.valor === max) : null;
  return (
    <>
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 m-0">Concentración semanal de llegadas</p>
        {picoLabel && (
          <p className="text-[10px] text-gray-400 m-0 italic">
            Pico: semana del {picoLabel.semana} · ${picoLabel.valor.toFixed(2)}M / {fmtInt(picoLabel.piezas)} pzs
          </p>
        )}
      </div>
      <div style={{ width: '100%', height: 200, marginBottom: 18 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="semana" tick={{ fontSize: 9, fill: '#6B6A64' }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
            <YAxis tickFormatter={(v) => '$' + v + 'M'} tick={{ fontSize: 10, fill: '#6B6A64' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v, name, p) => {
                if (name !== 'valor') return null;
                const d = p.payload;
                return ['$' + v.toFixed(2) + 'M MXN', `${d.pos} PO · ${fmtInt(d.skus)} SKUs · ${fmtInt(d.piezas)} pzs`];
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="valor" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((_, i) => <Cell key={i} fill={colors[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function TopProveedores({ proveedores, totalCamino }) {
  const top5 = proveedores.slice(0, 5);
  const restante = proveedores.slice(5);
  const restanteVal = restante.reduce((s, p) => s + (Number(p.valor_mxn) || 0), 0);
  const restantePos = restante.reduce((s, p) => s + (Number(p.pos) || 0), 0);
  const topPct = totalCamino > 0 ? (top5.slice(0, 3).reduce((s, p) => s + (Number(p.valor_mxn) || 0), 0) / totalCamino) * 100 : 0;
  const topProvPct = totalCamino > 0 && top5[0] ? (Number(top5[0].valor_mxn) / totalCamino) * 100 : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 m-0">Top proveedores en tránsito</p>
        <p className="text-[10px] text-gray-400 m-0 italic">Top 3 = {topPct.toFixed(0)}%</p>
      </div>
      <table className="w-full" style={{ fontSize: 11, borderCollapse: 'collapse' }}>
        <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
          {top5.map((p, i) => {
            const pct = totalCamino > 0 ? (Number(p.valor_mxn) / totalCamino) * 100 : 0;
            const isTop = i === 0;
            const barColor = isTop ? PALETTE.red.mid : PALETTE.blue.mid;
            return (
              <tr key={p.proveedor} style={{ borderBottom: '0.5px solid #E2E8F0' }}>
                <td style={{ padding: '6px 8px', color: '#1E293B', fontWeight: isTop ? 500 : 400, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.proveedor}>
                  {p.proveedor}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#6B6A64' }}>{p.pos} PO</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', width: '45%' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%' }}>
                    <span style={{ flex: 1, height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                      <span style={{ display: 'block', width: Math.min(pct, 100) + '%', height: '100%', background: barColor }} />
                    </span>
                    <span style={{ whiteSpace: 'nowrap', fontWeight: isTop ? 500 : 400 }}>
                      {fmtCompact(p.valor_mxn)} · {pct.toFixed(1)}%
                    </span>
                  </span>
                </td>
              </tr>
            );
          })}
          {restante.length > 0 && (
            <tr>
              <td style={{ padding: '6px 8px', color: '#1E293B' }}>Otros ({restante.length})</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#6B6A64' }}>{restantePos} PO</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%' }}>
                  <span style={{ flex: 1, height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                    <span style={{ display: 'block', width: Math.min(totalCamino > 0 ? (restanteVal / totalCamino) * 100 : 0, 100) + '%', height: '100%', background: '#888780' }} />
                  </span>
                  <span style={{ whiteSpace: 'nowrap' }}>{fmtCompact(restanteVal)} · {totalCamino > 0 ? ((restanteVal / totalCamino) * 100).toFixed(1) : 0}%</span>
                </span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {topProvPct >= 30 && (
        <p style={{ fontSize: 10, color: PALETTE.red.mid, margin: '6px 0 0', fontStyle: 'italic' }}>
          <i className="ti ti-alert-circle" style={{ fontSize: 11, verticalAlign: -1 }} aria-hidden="true" />{' '}
          Riesgo: {topProvPct.toFixed(1)}% concentrado en 1 proveedor
        </p>
      )}
    </div>
  );
}

function AgotadosConOrden({ agotados }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 m-0">SKUs agotados con orden</p>
        <p className="text-[10px] text-gray-400 m-0 italic">{agotados.length} agotados</p>
      </div>
      <div className="flex flex-col gap-1.5">
        {agotados.map((a) => {
          const sinOrden = a.dias_para_llegar === -1 || a.pzs_camino === 0;
          const vencido = a.dias_para_llegar === 0;
          const palette = sinOrden ? PALETTE.red : vencido ? PALETTE.amber : PALETTE.teal;
          const etaLabel = sinOrden ? 'Sin orden'
                          : vencido ? 'Vencido'
                          : `Llega en ${a.dias_para_llegar} día${a.dias_para_llegar === 1 ? '' : 's'}`;
          return (
            <div key={a.articulo} style={{
              background: palette.bg, borderLeft: `3px solid ${palette.mid}`, borderRadius: 6, padding: '8px 12px',
            }}>
              <div className="flex justify-between items-center" style={{ fontSize: 11 }}>
                <span style={{ fontWeight: 500, color: palette.text }}>{a.articulo}</span>
                <span style={{ color: palette.mid, fontWeight: 500 }}>{etaLabel}</span>
              </div>
              <p style={{ fontSize: 10, color: palette.mid, margin: '1px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                {sinOrden ? 'Agotado · acción: emitir PO'
                          : `${fmtInt(a.pzs_camino)} piezas en camino${a.movid ? ` (${a.movid})` : ''}`}
                {a.eta_estimada && !sinOrden && ` · ETA ${new Date(a.eta_estimada).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// Bloque Sell Out
// ══════════════════════════════════════════════════
const CANAL_SELLOUT_META = {
  mayoreo:      { label: 'Mayoreo',       palette: PALETTE.blue,  nota: 'Con lag 90d · 13 mayoristas' },
  distribuidor: { label: 'Distribuidor',  palette: PALETTE.teal,  nota: 'Con lag 90d · Digitalife · PCEL · Dicotech' },
  directo:      { label: 'Venta directa', palette: PALETTE.coral, nota: 'Sin lag · Mostrador · E-com · Marketplaces' },
};

function SellOutBloque({
  sellCanal, sellCanalPrev, sellMayoristas, sellRotacion,
  sellMensual, sellMensualPrev, sellTopSkus, sellTopClientes,
  sellPromosResumen, sellPromosSkus, sellOutMes,
  anio, mesMax,
}) {
  const { theme } = useTheme();
  // Unificado en los 3 temas: surface + strip lateral color paleta.
  const cardBgFor = () => theme.surface;
  const cardTitleFor = () => theme.text;
  const cardLabelFor = () => theme.textMuted;
  const cardBorder = `1px solid ${theme.border}`;
  const canalRows = useMemo(() => {
    const total = sellCanal.reduce((s, r) => s + (Number(r.importe) || 0), 0);
    const prevMap = new Map(sellCanalPrev.map((r) => [r.canal_sellout, Number(r.importe) || 0]));
    return ['mayoreo', 'distribuidor', 'directo'].map((k) => {
      const cur = sellCanal.find((r) => r.canal_sellout === k);
      const importe = Number(cur?.importe) || 0;
      const prev    = prevMap.get(k) || 0;
      return {
        key: k,
        importe, prev,
        share: total > 0 ? (importe / total) * 100 : 0,
        deltaYoY: prev > 0 ? ((importe - prev) / prev) * 100 : null,
        clientes: Number(cur?.clientes_finales) || 0,
        skus: Number(cur?.skus) || 0,
      };
    });
  }, [sellCanal, sellCanalPrev]);

  const totalYTD = canalRows.reduce((s, r) => s + r.importe, 0);

  const rotacionAlertas = useMemo(() => {
    return sellRotacion
      .filter((r) => Number(r.sellin_lag_90d) > 0 && Number(r.rotacion_pct) < 70)
      .sort((a, b) => Number(a.rotacion_pct) - Number(b.rotacion_pct))
      .slice(0, 5);
  }, [sellRotacion]);

  const serie12m = useMemo(() => {
    const sumar = (rows) => {
      const arr = Array(12).fill(0);
      rows.forEach((r) => {
        const m = Number(r.mes);
        if (m >= 1 && m <= 12) arr[m - 1] += Number(r.importe) || 0;
      });
      return arr;
    };
    const act = sumar(sellMensual);
    const prv = sumar(sellMensualPrev);
    return Array.from({ length: 12 }, (_, i) => ({
      mes: MESES_LBL[i],
      [`${anio}`]: act[i] || null,
      [`${anio - 1}`]: prv[i] || null,
    }));
  }, [sellMensual, sellMensualPrev, anio]);

  const mayoristaMax = Math.max(...sellMayoristas.map((m) => Number(m.importe) || 0), 1);

  const hayDatos = totalYTD > 0 || sellMayoristas.length > 0;

  const invBg = theme.surfaceInverse || (theme.mode === 'dark' ? '#F5F5F7' : '#000000');
  const invText = theme.textOnInverse || (theme.mode === 'dark' ? '#1D1D1F' : '#F5F5F7');
  const invMuted = theme.mode === 'dark' ? 'rgba(29,29,31,0.65)' : 'rgba(245,245,247,0.7)';
  return (
    <section className="space-y-3.5">
      <div className="flex items-baseline justify-between px-1">
        <div>
          <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em', color: theme.textMuted, marginBottom: 4, fontFamily: TYPO.fontText, fontWeight: 500 }}>Bloque · Sell Out</p>
          <h3 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, margin: 0, fontFamily: TYPO.fontDisplay, lineHeight: 1.1 }}>Sell out del canal.</h3>
        </div>
        <span style={{ fontSize: 13, color: theme.textMuted, fontFamily: TYPO.fontText }}>Ajustado por 90 días de crédito · {anio}</span>
      </div>

      {!hayDatos && (
        <div style={{
          borderRadius: 22, padding: 16,
          background: theme.mode === 'dark' ? 'rgba(255,159,10,0.14)' : 'rgba(255,149,0,0.08)',
          color: theme.orange || '#A34209',
          fontSize: 13, fontFamily: TYPO.fontText,
        }}>
          Aún no hay datos de <code>sellout_general</code> en Supabase.
          Sube el archivo Sellout General.xlsx en <code>/uploads.html</code> para activar este bloque.
        </div>
      )}

      {/* ① KPIs globales · center INVERSE (patrón AirPods) */}
      <div className="grid grid-cols-3 gap-3.5">
        <BentoKpi palette={PALETTE.coral} icon={ShoppingBag}
          label={`Sell-out ${MESES_LBL[sellOutMes.mesEfectivo - 1]}${sellOutMes.esEnCurso ? ' (último cerrado)' : ''}`}
          valor={fmtCompact(sellOutMes.total)}
          delta={sellOutMes.deltaYoY}
          deltaLabel={`vs ${MESES_LBL[sellOutMes.mesEfectivo - 1]} ${anio - 1}`}
          subtitulo={<span>{fmtCompact(sellOutMes.prev)} en {anio - 1}</span>} />
        <BentoKpi palette={PALETTE.blue} icon={TrendingUp} label="Sell-out YTD"
          valor={fmtCompact(sellOutMes.ytd)}
          delta={sellOutMes.deltaYTD}
          deltaLabel="YoY"
          subtitulo={<span>{fmtCompact(sellOutMes.ytdPrev)} en {anio - 1}</span>}
          inverse />
        <BentoKpi palette={PALETTE.purple} icon={ShoppingBag} label="Clientes finales activos"
          valor={fmtInt(sellTopClientes.length > 0
            ? canalRows.reduce((s, r) => s + r.clientes, 0)
            : 0)}
          delta={null}
          subtitulo={<span>en {sellMayoristas.length || '—'} mayoristas</span>} />
      </div>

      {/* ② Sell-out por canal · cards alternadas */}
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 22, padding: 24, fontFamily: TYPO.fontText }}>
        <div className="flex items-baseline justify-between mb-4">
          <h4 style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, margin: 0, fontFamily: TYPO.fontDisplay }}>Sell-out por canal</h4>
          <span style={{ fontSize: 12, color: theme.textMuted }}>YTD {anio}</span>
        </div>
        <div className="grid grid-cols-3 gap-3.5">
          {canalRows.map((c, i) => {
            const meta = CANAL_SELLOUT_META[c.key];
            const pal = meta.palette;
            const inv = i === 1;
            const bg = inv ? invBg : theme.surface;
            const tx = inv ? invText : theme.text;
            const lb = inv ? invMuted : theme.textMuted;
            return (
              <div key={c.key} style={{
                background: bg, color: tx,
                border: inv ? 'none' : `1px solid ${theme.border}`,
                borderRadius: 18, padding: 18, fontFamily: TYPO.fontText,
                display: 'flex', flexDirection: 'column',
              }}>
                <IconBadge icon={ShoppingBag} color={pal.mid} size={36} />
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: lb, marginTop: 12 }}>
                  {meta.label}
                </div>
                <div style={{ fontSize: 28, fontWeight: 600, color: tx, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', lineHeight: 1.05, fontFamily: TYPO.fontDisplay, marginTop: 4 }}>
                  {fmtCompact(c.importe)}
                </div>
                <div style={{ fontSize: 12, marginTop: 4, color: lb, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtPct(c.share)} del total{c.deltaYoY != null && <> · <span style={{ color: c.deltaYoY >= 0 ? (theme.green || '#34C759') : (theme.red || '#FF3B30'), fontWeight: 500 }}>{fmtPctDelta(c.deltaYoY)} YoY</span></>}
                </div>
                <div style={{ fontSize: 11, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${inv ? 'rgba(255,255,255,0.12)' : theme.border}`, color: lb, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtInt(c.clientes)} clientes · {fmtInt(c.skus)} SKUs
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ③ Ranking mayoristas */}
      {sellMayoristas.length > 0 && (
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 22, padding: 24, fontFamily: TYPO.fontText }}>
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-800">Ranking de mayoristas</h4>
            <span className="text-xs text-gray-500">{sellMayoristas.length} activos</span>
          </div>
          <div className="space-y-2">
            {sellMayoristas.slice(0, 13).map((m, i) => {
              const w = mayoristaMax > 0 ? (Number(m.importe) / mayoristaMax) * 100 : 0;
              return (
                <div key={m.mayorista} className="grid items-center gap-2 text-xs"
                  style={{ gridTemplateColumns: '24px 180px 1fr auto' }}>
                  <span className="text-gray-400">#{i + 1}</span>
                  <span className="text-gray-800 truncate">{m.mayorista}</span>
                  <div className="bg-gray-100 rounded h-3 relative">
                    <div className="absolute left-0 top-0 h-3 rounded"
                      style={{ background: PALETTE.blue.mid, width: `${Math.max(2, w)}%` }} />
                  </div>
                  <span className="text-gray-800 font-medium text-right whitespace-nowrap">
                    {fmtCompact(m.importe)}
                    <span className="ml-1 text-gray-400">
                      · {totalYTD > 0 ? fmtPct((Number(m.importe) / totalYTD) * 100) : '—'}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ⑤ Tendencia mensual */}
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 22, padding: 24, fontFamily: TYPO.fontText }}>
        <div className="flex items-baseline justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-800">Sell-out mensual {anio} vs {anio - 1}</h4>
          <div className="text-[11px] text-gray-500">
            <span className="inline-block w-2.5 h-2.5 mr-1 align-middle rounded-sm" style={{ background: PALETTE.coral.mid }} /> {anio}
            <span className="ml-2 inline-block w-2.5 h-2.5 mr-1 align-middle rounded-sm" style={{ background: PALETTE.coral.soft || PALETTE.coral.mid + '60' }} /> {anio - 1}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={serie12m} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#888' }} />
            <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: '#888' }} width={50} />
            <Tooltip formatter={(v) => v == null ? '—' : fmtMoney(v)} />
            <Line type="monotone" dataKey={`${anio - 1}`} stroke={PALETTE.coral.soft || '#F5C4B3'} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey={`${anio}`} stroke={PALETTE.coral.mid} strokeWidth={2.5} dot={{ r: 3, fill: PALETTE.coral.mid }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ⑥ + ⑦ Top SKUs + Top clientes finales */}
      <div className="grid grid-cols-2 gap-2.5">
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 22, padding: 24, fontFamily: TYPO.fontText }}>
          <h4 className="text-sm font-medium text-gray-800 mb-3">Top 10 SKUs por sell-out YTD</h4>
          {sellTopSkus.length === 0 ? (
            <div className="text-xs text-gray-500">Sin datos.</div>
          ) : (
            <div className="space-y-1">
              {sellTopSkus.map((s, i) => (
                <div key={s.sku} className="flex items-baseline gap-2 text-xs">
                  <span className="text-gray-400 w-5">{i + 1}</span>
                  <span className="font-mono text-gray-700 flex-1 truncate">{s.sku}</span>
                  <span className="text-gray-400 tabular-nums">{fmtInt(s.clientes)} cli</span>
                  <span className="text-gray-800 font-medium tabular-nums w-16 text-right">{fmtCompact(s.importe)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 22, padding: 24, fontFamily: TYPO.fontText }}>
          <h4 className="text-sm font-medium text-gray-800 mb-3">Top 10 clientes finales</h4>
          {sellTopClientes.length === 0 ? (
            <div className="text-xs text-gray-500">Sin datos.</div>
          ) : (
            <div className="space-y-1">
              {sellTopClientes.map((c, i) => (
                <div key={c.cliente_final} className="flex items-baseline gap-2 text-xs">
                  <span className="text-gray-400 w-5">{i + 1}</span>
                  <span className="text-gray-700 flex-1 truncate" title={c.cliente_final}>{c.cliente_final}</span>
                  <span className="text-gray-400 tabular-nums text-[10px]">{fmtInt(c.mayoristas_o_canales)} vía</span>
                  <span className="text-gray-800 font-medium tabular-nums w-16 text-right">{fmtCompact(c.importe)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ⑨ Efectividad de promos por temporada */}
      {sellPromosResumen && sellPromosResumen.campania && (
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 22, padding: 24, fontFamily: TYPO.fontText }}>
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-800">Efectividad de promos por temporada</h4>
            <span className="text-xs text-gray-500">{MESES_FULL[mesMax - 1]} {anio}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="rounded-lg p-3" style={{ background: cardBgFor(PALETTE.amber), border: cardBorder, borderLeft: `3px solid ${PALETTE.amber.mid}`, fontFamily: TYPO.fontText }}>
              <div className="text-[10px] tracking-widest" style={{ color: cardLabelFor(PALETTE.amber) }}>CAMPAÑA</div>
              <div className="text-sm font-medium mt-1" style={{ color: cardTitleFor(PALETTE.amber) }}>{sellPromosResumen.campania}</div>
              <div className="text-[11px] mt-1" style={{ color: cardLabelFor(PALETTE.amber) }}>
                {fmtInt(sellPromosResumen.skus_campania)} SKUs
              </div>
            </div>
            <div className="rounded-lg p-3" style={{ background: cardBgFor(PALETTE.gray), border: cardBorder, borderLeft: `3px solid ${PALETTE.gray.mid}`, fontFamily: TYPO.fontText }}>
              <div className="text-[10px] tracking-widest" style={{ color: cardLabelFor(PALETTE.gray) }}>SELLOUT EN PROMO</div>
              <div className="text-base font-medium mt-1" style={{ color: cardTitleFor(PALETTE.gray) }}>{fmtCompact(sellPromosResumen.sellout_en_promo)}</div>
              <div className="text-[11px] mt-1" style={{ color: cardLabelFor(PALETTE.gray) }}>
                {(() => {
                  const total = (Number(sellPromosResumen.sellout_en_promo) || 0) + (Number(sellPromosResumen.sellout_fuera_promo) || 0);
                  return total > 0 ? fmtPct((Number(sellPromosResumen.sellout_en_promo) / total) * 100) : '—';
                })()} del total
              </div>
            </div>
            <div className="rounded-lg p-3" style={{ background: cardBgFor(PALETTE.gray), border: cardBorder, borderLeft: `3px solid ${PALETTE.gray.mid}`, fontFamily: TYPO.fontText }}>
              <div className="text-[10px] tracking-widest" style={{ color: cardLabelFor(PALETTE.gray) }}>SELLOUT FUERA</div>
              <div className="text-base font-medium mt-1" style={{ color: cardTitleFor(PALETTE.gray) }}>{fmtCompact(sellPromosResumen.sellout_fuera_promo)}</div>
            </div>
            <div className="rounded-lg p-3 bg-emerald-50">
              <div className="text-[10px] tracking-widest text-emerald-700">LIFT VS MES ANTERIOR</div>
              {(() => {
                const cur = Number(sellPromosResumen.sellout_en_promo) || 0;
                const prev = Number(sellPromosResumen.sellout_promo_mes_prev) || 0;
                const lift = prev > 0 ? ((cur - prev) / prev) * 100 : null;
                return (
                  <>
                    <div className="text-base font-medium mt-1 text-emerald-900">{lift != null ? fmtPctDelta(lift) : '—'}</div>
                    <div className="text-[11px] mt-1 text-emerald-700">{fmtCompact(prev)} → {fmtCompact(cur)}</div>
                  </>
                );
              })()}
            </div>
          </div>
          {sellPromosSkus.length > 0 && (
            <>
              <div className="text-[11px] text-gray-600 font-medium mb-2">Top 5 SKUs de la campaña</div>
              <div className="space-y-1">
                {sellPromosSkus.map((s, i) => (
                  <div key={s.sku} className="grid gap-2 items-baseline text-xs"
                    style={{ gridTemplateColumns: '24px 1fr auto auto auto' }}>
                    <span className="text-gray-400">{i + 1}</span>
                    <span className="font-mono text-gray-700">{s.sku}</span>
                    <span className="text-gray-500 text-right">{s.promo_pct != null ? `${(Number(s.promo_pct) * 100).toFixed(0)}% off` : '—'}</span>
                    <span className="text-gray-500 text-right">{fmtInt(s.piezas)} pz</span>
                    <span className="text-gray-800 font-medium text-right w-16">{fmtCompact(s.importe)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

// ────────── Estilos comunes ──────────
const thLeft = { padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#6B6A64', fontSize: 11, whiteSpace: 'nowrap' };
const thRight = { padding: '8px 8px', textAlign: 'right', fontWeight: 500, color: '#6B6A64', fontSize: 11, whiteSpace: 'nowrap' };
const tdLeft = { padding: '8px 12px', color: '#334155', fontSize: 12 };
const tdRight = { padding: '8px 8px', textAlign: 'right', color: '#1E293B', fontSize: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
