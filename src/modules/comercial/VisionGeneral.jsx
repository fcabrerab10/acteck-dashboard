import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import SinAcceso from '../../components/SinAcceso';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaGlobal } from '../../lib/permisos';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import {
  Activity, TrendingUp,
  Wallet, Package, Receipt, Target, ShoppingBag, Ship, X,
} from 'lucide-react';
import {
  BarChart, Bar, Cell,
  AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { cachedQuery } from '../../lib/queries';
import { Cargando } from '../../components/kit';
import RentabilidadBloque from './RentabilidadBloque';
import ExportMenu from '../../components/ExportMenu';
import Pill, { toneColors } from '../../components/kit/Pill';
import Segmented from '../../components/kit/Segmented';

// ────────── Constantes ──────────
const MESES_LBL  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ────────── Tonos (kit V3) ──────────
// Los fondos/textos de tile salen de toneColors(theme, tone) (Pill.jsx); el trazo "strong" del token
// semántico del tema. Nada de hex fijos fuera de este bloque: todo se deriva del tema activo.
const TONE_STRONG = { blue: 'accent', green: 'green', orange: 'orange', red: 'red', yellow: 'yellow', purple: 'purple', pink: 'pink', teal: 'teal', gray: 'textMuted' };

// '#RRGGBB' → 'rgba(r,g,b,a)'. Si el color ya viene en rgba (p. ej. textMuted en Midnight) lo deja igual.
const withAlpha = (color, a) => {
  const m = /^#([0-9a-f]{6})$/i.exec(String(color || ''));
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// { bg, text, strong } para un tono. pink/teal no existen en toneColors → se derivan del token del tema.
function tonoColores(theme, tone = 'gray') {
  const strong = theme[TONE_STRONG[tone] || 'textMuted'] || theme.textMuted;
  if (tone === 'pink' || tone === 'teal') {
    return { bg: withAlpha(strong, theme.mode === 'dark' ? 0.18 : 0.14), text: strong, strong };
  }
  const [bg, text] = toneColors(theme, tone);
  return { bg, text, strong };
}
// ────────── IconBadge (patrón AirPods · 40x40 rounded, bg tinted, icon en color solido) ──────────
function IconBadge({ icon: Icon, color, size = 40 }) {
  if (!Icon) return null;
  const iconSize = Math.round(size * 0.5);
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.3),
      background: withAlpha(color, 0.13), color,
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
    'VENTA DIRECTA':        theme.teal,
    'DIRECTO':              theme.teal,
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
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 24, color: theme.textMuted, fontFamily: TYPO.fontText, textAlign: 'center', fontSize: 13 }}>
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
  const green = theme.green;
  const red = theme.red;

  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12,
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
  const invBg = theme.surfaceInverse;
  const invText = theme.textOnInverse;
  const invMuted = isDark ? 'rgba(29,29,31,0.7)' : 'rgba(245,245,247,0.72)';
  const invDivider = isDark ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.14)';
  const border = `1px solid ${theme.border}`;
  const green = theme.green;
  const red = theme.red;
  const pink = theme.pink;

  // ── Ring cobertura
  const dias = (ventaProm > 0 && inventario?.valor_inventario)
    ? Math.round((Number(inventario.valor_inventario) / ventaProm) * 30 / 30) // días equivalentes
    : null;
  const diasCap = dias == null ? null : Math.min(90, dias);
  const ringPct = diasCap == null ? 0 : Math.min(1, diasCap / 45);
  const ringCol = dias == null ? theme.textMuted : (dias < 15 ? red : dias > 60 ? theme.orange : green);
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
      borderRadius: 12, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12, minHeight: 84,
      fontFamily: TYPO.fontText,
    }}>{children}</div>
  );

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {/* ① Inventario · ring cobertura */}
      <CardShell>
        <IconBadge icon={Package} color={theme.purple} size={32} />
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
        <IconBadge icon={Receipt} color={theme.teal} size={32} />
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
            <span style={{ display: 'block', height: '100%', width: '20%', background: theme.orange, opacity: 0.5 }} />
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
  const perfil = usePerfil();
  if (!puedeVerPestanaGlobal(perfil, 'vision_general')) {
    return <SinAcceso motivo="No tienes acceso a Visión General." />;
  }
  const { theme } = useTheme();
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [aniosDisponibles, setAniosDisponibles] = useState([]);
  const rootRef = useRef(null); // raíz para exportar PDF
  const [dimension, setDimension] = useState('canal'); // 'canal' | 'marca' | 'categoria'

  // Datos por dimensión (carga reactiva)
  const [margenAct, setMargenAct] = useState([]);
  const [margenPrev, setMargenPrev] = useState([]);
  const [margenPrev2, setMargenPrev2] = useState([]);
  const [clientesDim, setClientesDim] = useState([]);
  const [inventario, setInventario] = useState(null);
  const [inventarioMarca, setInventarioMarca] = useState([]);
  const [inventarioFamilia, setInventarioFamilia] = useState([]);
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
      // Fuente: facturacion_clientes = Fact Neta oficial reconstruida desde erp_ventas
      // (refresh_facturacion_clientes). Rentabilidad: RentabilidadBloque (v_erp_medidas_mes).
      // Por ahora solo soportamos dimension='canal' — marca/categoría
      // requieren ventas_erp completo con marca/familia.
      const [a, p, p2, c, inv, invMarca, cart, q, cRes, cCal, cProx, cSem, cRet, cProv, cAgo, cLT, cYTD,
             sCan, sCanPrev, sMay, sRot, sMen, sMenPrev, sSkus, sCli, sPromo, sPromoSkus] = await Promise.all([
        cachedQuery(supabase.from('v_vision_factura_canal').select('mes,venta,piezas,canal').eq('anio', anio)),
        cachedQuery(supabase.from('v_vision_factura_canal').select('mes,venta,piezas,canal').eq('anio', anio - 1)),
        cachedQuery(supabase.from('v_vision_factura_canal').select('mes,venta,piezas,canal').eq('anio', anio - 2)),
        cachedQuery(supabase.from('v_vision_factura_clientes').select('cliente_nombre,canal,venta,piezas,meses_activos').eq('anio', anio)),
        cachedQuery(supabase.from('v_vision_inventario_global').select('valor_inventario,skus_con_stock,piezas_disponibles,skus_agotados').single()),
        cachedQuery(supabase.from('v_vision_inventario_marca').select('marca,valor').order('valor', { ascending: false, nullsFirst: false })),
        Promise.resolve({ data: [] }), // v_vision_cartera_consolidada: la UI no lee ninguna columna (CarteraCard / calendario / próximas no se renderizan). Posición conservada para no desalinear el destructuring.
        cachedQuery(supabase.from('cuotas_canales').select('dimension_tipo,meta_facturacion').eq('anio', anio)),
        cachedQuery(supabase.from('v_vision_camino_resumen').select('bucket_estatus,valor_mxn,piezas,pos')),
        Promise.resolve({ data: [] }), // v_vision_camino_calendario: la UI no lee ninguna columna (CarteraCard / calendario / próximas no se renderizan). Posición conservada para no desalinear el destructuring.
        Promise.resolve({ data: [] }), // v_vision_camino_proximas: la UI no lee ninguna columna (CarteraCard / calendario / próximas no se renderizan). Posición conservada para no desalinear el destructuring.
        cachedQuery(supabase.from('v_vision_camino_semanal').select('semana,valor_mxn,piezas').limit(12)),
        cachedQuery(supabase.from('v_vision_camino_retrasadas').select('valor_mxn,movid,dias_retraso,dias_desde_emision')),
        cachedQuery(supabase.from('v_vision_camino_proveedores').select('proveedor,valor_mxn').limit(8)),
        cachedQuery(supabase.from('v_vision_camino_agotados').select('articulo,pzs_camino,movid,eta_estimada,dias_para_llegar').limit(10)),
        cachedQuery(supabase.from('v_vision_camino_leadtime').select('lt_total,lt_produccion,lt_transito,lt_aduana').single()),
        cachedQuery(supabase.from('v_vision_camino_compras_ytd').select('anio,valor_mxn,pos')),
        cachedQuery(supabase.from('v_vision_sellout_canal').select('canal_sellout,importe,clientes_finales,skus').eq('anio', anio)),
        cachedQuery(supabase.from('v_vision_sellout_canal').select('canal_sellout,importe,clientes_finales,skus').eq('anio', anio - 1)),
        cachedQuery(supabase.from('v_vision_sellout_mayoristas').select('mayorista,importe,canal_sellout,clientes_finales,skus').eq('anio', anio).order('importe', { ascending: false })),
        cachedQuery(supabase.from('v_vision_sellout_rotacion').select('sellin_lag_90d,sellout_ytd,rotacion_pct').order('rotacion_pct', { ascending: true, nullsFirst: false })),
        cachedQuery(supabase.from('v_vision_sellout_mensual').select('mes,importe').eq('anio', anio)),
        cachedQuery(supabase.from('v_vision_sellout_mensual').select('mes,importe').eq('anio', anio - 1)),
        cachedQuery(supabase.from('v_vision_sellout_top_skus').select('sku,importe').eq('anio', anio).order('importe', { ascending: false }).limit(10)),
        cachedQuery(supabase.from('v_vision_sellout_top_clientes').select('cliente_final,importe').eq('anio', anio).order('importe', { ascending: false }).limit(10)),
        cachedQuery(supabase.from('v_vision_sellout_promos').select('campania,skus_campania,sellout_en_promo,sellout_fuera_promo,sellout_promo_mes_prev').single()),
        cachedQuery(supabase.from('v_vision_sellout_promos_top_skus').select('sku,promo_pct,piezas,importe').order('importe', { ascending: false }).limit(5)),
      ]);
      setMargenAct(a.data || []);
      setMargenPrev(p.data || []);
      setMargenPrev2(p2.data || []);
      setClientesDim(c.data || []);
      setInventario(inv.data || null);
      setInventarioMarca(invMarca.data || []);
      // Composición por familia (join inventario_acteck × roadmap_sku)
      try {
        const [{ data: skusRoad }, { data: skusInv }] = await Promise.all([
          supabase.from('roadmap_sku').select('sku, familia'),
          cachedQuery(supabase.from('inventario_acteck').select('sku, valor_mxn')),
        ]);
        if (skusRoad && skusInv) {
          const famMap = new Map((skusRoad || []).map((r) => [String(r.sku), r.familia || 'Sin familia']));
          const byFam = {};
          (skusInv || []).forEach((i) => {
            const fam = famMap.get(String(i.sku)) || 'Sin familia';
            if (!byFam[fam]) byFam[fam] = { familia: fam, valor: 0, skus: 0 };
            byFam[fam].valor += Number(i.valor_mxn) || 0;
            byFam[fam].skus += 1;
          });
          setInventarioFamilia(Object.values(byFam).filter((f) => f.valor > 0).sort((a, b) => b.valor - a.valor));
        }
      } catch (e) { /* familia opcional */ }
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
  // Margen/costo viven en RentabilidadBloque (v_erp_medidas_mes).
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
    return <Cargando pantalla="visionGeneral" label="Cargando visión general…" sub="Trayendo facturación, inventario y sell out" />;
  }
  if (margenAct.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: theme.textMuted, background: theme.bg, minHeight: '100%', fontFamily: TYPO.fontText }}>
        <Activity style={{ width: 48, height: 48, color: theme.textSubtle, margin: '0 auto 16px', strokeWidth: 1.5 }} />
        <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 8, fontFamily: TYPO.fontDisplay, letterSpacing: '-0.02em' }}>Visión general</h2>
        <p>No hay datos para {anio}. El puente SQL lo carga solo; revisa el Importador central.</p>
      </div>
    );
  }

  // Excel: mix por canal + tendencia mensual 3 años
  const excelVision = () => ({
    titulo: `Visión general ${anio}`,
    archivo: `Vision general ${anio}`,
    hojas: [
      {
        nombre: 'Mix por canal',
        subtitulo: `YTD ene–${MESES_LBL[mesMax - 1]} ${anio}`,
        columnas: [
          { label: 'Canal', key: 'key', tipo: 'texto', ancho: 22 },
          { label: 'Venta YTD', key: 'venta', tipo: 'moneda', ancho: 16 },
          { label: 'Piezas', key: 'piezas', tipo: 'numero', ancho: 12 },
          { label: 'Share', key: 'share', tipo: 'pct', ancho: 9 },
          { label: 'Δ YoY', key: 'deltaYoY', tipo: 'pct', ancho: 9 },
          ...Array.from({ length: mesMax }, (_, i) => ({ label: MESES_LBL[i], key: `m${i + 1}`, tipo: 'moneda', ancho: 13 })),
        ],
        filas: bloques.map((b) => ({ key: b.key, venta: b.venta, piezas: b.piezas, share: b.share, deltaYoY: b.deltaYoY, ...Object.fromEntries(Array.from({ length: mesMax }, (_, i) => [`m${i + 1}`, b.byMes[i + 1] || null])) })),
        totales: { key: 'TOTAL', venta: bloques.reduce((s, b) => s + b.venta, 0), piezas: bloques.reduce((s, b) => s + b.piezas, 0), ...Object.fromEntries(Array.from({ length: mesMax }, (_, i) => [`m${i + 1}`, bloques.reduce((s, b) => s + (b.byMes[i + 1] || 0), 0)])) },
      },
      {
        nombre: 'Tendencia mensual',
        subtitulo: '3 años',
        columnas: [
          { label: 'Mes', key: 'mes', tipo: 'texto', ancho: 8 },
          { label: `${anio}`, key: `${anio}`, tipo: 'moneda', ancho: 16 },
          { label: `${anio - 1}`, key: `${anio - 1}`, tipo: 'moneda', ancho: 16 },
          { label: `${anio - 2}`, key: `${anio - 2}`, tipo: 'moneda', ancho: 16 },
        ],
        filas: tendencia,
        totales: { mes: 'TOTAL', [`${anio}`]: tendencia.reduce((s, r) => s + (r[`${anio}`] || 0), 0), [`${anio - 1}`]: tendencia.reduce((s, r) => s + (r[`${anio - 1}`] || 0), 0), [`${anio - 2}`]: tendencia.reduce((s, r) => s + (r[`${anio - 2}`] || 0), 0) },
      },
    ],
  });

  return (
    <div ref={rootRef} data-stagger className="max-w-none mx-auto p-6 space-y-4"
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
              border: `1px solid ${theme.border}`, borderRadius: 9,
              padding: '6px 12px', fontSize: 12.5, fontWeight: 600, marginTop: 4, height: 30,
              background: theme.surface, color: theme.text,
              fontFamily: TYPO.fontDisplay, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums',
            }}>
            {aniosDisponibles.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <ExportMenu titulo="Visión general" subtitulo={`YTD ene–${MESES_LBL[mesMax - 1]} ${anio}`} excel={excelVision} pdf={{ ref: rootRef }} size="md" style={{ alignSelf: 'flex-end', marginBottom: 2 }} />
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

      {/* Rentabilidad · medidas del director (v_erp_medidas_mes) */}
      <RentabilidadBloque anio={anio} mesMax={mesMax} />

      {/* Toggle dimensión */}
      <div className="flex items-center gap-3 px-1 mt-2 flex-wrap">
        <span style={{ fontSize: 11, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: TYPO.fontText }}>Ver mix por</span>
        <Segmented
          value={dimension}
          onChange={setDimension}
          options={[
            { id: 'canal',     label: 'Canal' },
            { id: 'marca',     label: 'Marca',     disabled: true, title: 'Pendiente — requiere ventas_erp completo con marca/familia' },
            { id: 'categoria', label: 'Categoría', disabled: true, title: 'Pendiente — requiere ventas_erp completo con marca/familia' },
          ]}
        />
        <Pill tone="gray">Marca / Categoría pendientes</Pill>
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
        inventarioFamilia={inventarioFamilia}
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
        Fuente: facturacion_clientes = Fact Neta oficial (Factura + Com.Ext33 + devoluciones sin nota de crédito),
        reconstruida desde el ERP renglón a renglón; rentabilidad según las medidas del director; inventario_acteck
        (almacenes comerciales). Cartera pendiente de fuente.
      </p>
    </div>
  );
}

// ────────── HERO Card ──────────
function HeroCard({ kpis, anio, mesMaxLabel }) {
  const { theme } = useTheme();
  const border = `1px solid ${theme.border}`;
  const invBg = theme.surfaceInverse;
  const invText = theme.textOnInverse;
  const invMuted = theme.mode === 'dark' ? 'rgba(29,29,31,0.72)' : 'rgba(245,245,247,0.72)';
  const invDivider = theme.mode === 'dark' ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.14)';
  // Badge sobre la card inverse: en Claro/Marfil (card negra) el azul "sobre negro" del tema; en Midnight (card blanca) el accent.
  const heroBadgeCol = theme.mode === 'dark' ? theme.accent : (theme.accentDark || theme.accent);
  const heroBadgeBg = withAlpha(heroBadgeCol, theme.mode === 'dark' ? 0.18 : 0.24);
  const green = theme.green;
  const red = theme.red;

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
        background: invBg, color: invText, borderRadius: 12, padding: '22px 26px',
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
          background: theme.surface, borderRadius: 12, padding: '16px 18px', border,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <IconBadge icon={Activity} color={theme.orange} size={36} />
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
          background: theme.surface, borderRadius: 12, padding: '16px 18px', border,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <IconBadge icon={Target} color={theme.purple} size={36} />
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

  const green = theme.green;
  const red = theme.red;

  const KBox = ({ lbl, val, sub, subColor, last }) => (
    <div style={{ padding: '2px 14px', borderRight: last ? 'none' : `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column' }}>
      <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, margin: 0 }}>{lbl}</p>
      <p style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em', color: subColor || theme.text, fontVariantNumeric: 'tabular-nums', margin: '2px 0 0' }}>{val}</p>
      {sub && <p style={{ fontSize: 10, color: subColor || theme.textMuted, fontVariantNumeric: 'tabular-nums', margin: '2px 0 0' }}>{sub}</p>}
    </div>
  );

  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12,
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

// ────────── Tendencia 3 años ──────────
function TendenciaCard({ data, anio, mesMax }) {
  const { theme } = useTheme();
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 18px', fontFamily: TYPO.fontText, display: 'flex', flexDirection: 'column' }}>
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
// ────────── Mini donut compacto reutilizable (marca / familia) ──────────
function InventarioMiniDonut({ title, meta, items, valueKey = 'valor', labelKey = 'marca', colorFn, centerLabel, centerValue, centerSub, emptyMsg }) {
  const { theme } = useTheme();
  const [hover, setHover] = useState(null);
  const list = (items || []).filter((it) => (Number(it[valueKey]) || 0) > 0);
  if (list.length === 0) {
    return (
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 18px', fontFamily: TYPO.fontText, minHeight: 168, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, margin: 0, fontFamily: TYPO.fontDisplay }}>{title}</h4>
          <span style={{ fontSize: 10, color: theme.textMuted }}>{meta}</span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textMuted, fontSize: 12, fontStyle: 'italic' }}>{emptyMsg || 'Sin datos'}</div>
      </div>
    );
  }
  const total = list.reduce((s, it) => s + (Number(it[valueKey]) || 0), 0) || 1;
  const R = 42, CIRC = 2 * Math.PI * R;
  let offsetAcc = 0;
  const arcs = list.slice(0, 8).map((it, i) => {
    const pct = (Number(it[valueKey]) || 0) / total;
    const len = pct * CIRC;
    const dash = `${len} ${CIRC}`;
    const dashOffset = -offsetAcc;
    offsetAcc += len;
    return { key: it[labelKey], color: colorFn(it[labelKey], i), dash, dashOffset };
  });
  const top = list.slice(0, 4);
  const rest = list.slice(4);
  const restVal = rest.reduce((s, it) => s + (Number(it[valueKey]) || 0), 0);

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 18px', fontFamily: TYPO.fontText }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, margin: 0, fontFamily: TYPO.fontDisplay }}>{title}</h4>
        <span style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{meta}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '112px 1fr', gap: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 112, height: 112 }}>
          <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            <circle cx="50" cy="50" r={R} fill="none" stroke={theme.border} strokeWidth="10" />
            {arcs.map((a) => {
              const active = hover === a.key;
              const other = hover && !active;
              return (
                <circle key={a.key} cx="50" cy="50" r={R} fill="none"
                  stroke={a.color} strokeWidth={active ? 12 : 10}
                  strokeDasharray={a.dash} strokeDashoffset={a.dashOffset}
                  opacity={other ? 0.25 : 1}
                  style={{ transition: 'stroke-width 120ms, opacity 120ms' }}
                  onMouseEnter={() => setHover(a.key)}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            {(() => {
              const sel = list.find((it) => it[labelKey] === hover);
              if (sel) {
                const pct = ((Number(sel[valueKey]) || 0) / total) * 100;
                return (
                  <>
                    <div style={{ fontSize: 8, color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{sel[labelKey]}</div>
                    <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.025em', color: theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmtCompact(sel[valueKey])}</div>
                    <div style={{ fontSize: 9, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{pct.toFixed(1)}%</div>
                  </>
                );
              }
              return (
                <>
                  <div style={{ fontSize: 8, color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{centerLabel}</div>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.025em', color: theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{centerValue}</div>
                  {centerSub && <div style={{ fontSize: 9, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{centerSub}</div>}
                </>
              );
            })()}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 1 }}>
          {top.map((it, i) => {
            const col = colorFn(it[labelKey], i);
            const pct = ((Number(it[valueKey]) || 0) / total) * 100;
            const active = hover === it[labelKey];
            const dim = hover && !active;
            return (
              <div key={it[labelKey]}
                onMouseEnter={() => setHover(it[labelKey])}
                onMouseLeave={() => setHover(null)}
                style={{
                  display: 'grid', gridTemplateColumns: '12px 6px minmax(0, 1fr) 60px 40px', alignItems: 'center', gap: 6,
                  padding: '3px 4px', borderRadius: 6,
                  opacity: dim ? 0.5 : 1, transition: 'opacity 120ms',
                }}>
                <span style={{ fontSize: 9, color: theme.textSubtle, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>#{i + 1}</span>
                <span style={{ width: 6, height: 6, borderRadius: 2, background: col }} />
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 500, color: theme.text, textTransform: 'uppercase', letterSpacing: '-0.005em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it[labelKey]}</span>
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', textAlign: 'right' }}>{fmtCompact(it[valueKey])}</span>
                <span style={{ fontSize: 9, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{pct.toFixed(1)}%</span>
              </div>
            );
          })}
          {rest.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '12px 6px minmax(0, 1fr) 60px 40px', alignItems: 'center', gap: 6, padding: '3px 4px', opacity: 0.6 }}>
              <span></span><span></span>
              <span style={{ fontSize: 10, color: theme.textMuted, fontStyle: 'italic' }}>+ {rest.length} más</span>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{fmtCompact(restVal)}</span>
              <span style={{ fontSize: 9, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{((restVal / total) * 100).toFixed(1)}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InventarioSection({ inventario, inventarioMarca, inventarioFamilia, caminoResumen, caminoCalendario, caminoProximas, caminoSemanal, caminoRetrasadas, caminoProveedores, caminoAgotados, caminoLeadtime, comprasYTD, anio, ventaPromMes }) {
  const { theme } = useTheme();
  // Unificado en los 3 temas: surface + strip lateral color paleta.
  const cardBgFor = () => theme.surface;
  const cardTitleFor = () => theme.text;
  const cardLabelFor = () => theme.textMuted;
  const cardBorder = `1px solid ${theme.border}`;
  // Buckets de estatus en orden de pipeline + total agregado
  const BUCKET_LABELS = {
    produccion:        { label: 'En producción',      tone: 'orange' },
    transito:          { label: 'Tránsito marítimo',  tone: 'blue' },
    pendiente_modular: { label: 'Pendiente modular',  tone: 'purple' },
    por_zarpar:        { label: 'Por zarpar',         tone: 'pink' },
    por_consolidar:    { label: 'Por consolidar',     tone: 'gray' },
    sin_embarque:      { label: 'Sin embarque',       tone: 'gray' },
    otro:              { label: 'Otro',               tone: 'gray' },
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
    'ACTECK': theme.purple,
    'BALAM RUSH': theme.orange,
    'MOBIFREE': theme.accent,
    'SWANN': theme.teal,
    'EVOROK': theme.yellow,
    'Sin marca': theme.textMuted,
    'Otras marcas': theme.textSubtle,
  };
  const colorMarca = (m) => MARCA_COLOR[String(m).toUpperCase()] || MARCA_COLOR[m] || theme.pink;

  // Color helpers iOS palette para donuts
  const IOS_ORDER = [theme.accent, theme.orange, theme.purple, theme.pink, theme.green, theme.teal, theme.indigo, theme.yellow, theme.red].filter(Boolean);
  const colorMarcaIOS = (m, i) => {
    const map = { 'ACTECK': theme.accent, 'BALAM RUSH': theme.orange, 'MOBIFREE': theme.purple, 'SWANN': theme.teal, 'EVOROK': theme.pink, 'Sin marca': theme.textMuted, 'Otras marcas': theme.textMuted };
    return map[String(m).toUpperCase()] || map[m] || IOS_ORDER[i % IOS_ORDER.length];
  };
  const colorFamiliaIOS = (_f, i) => IOS_ORDER[i % IOS_ORDER.length];

  return (
    <div className="space-y-2.5">
      {/* Header estilo Apple */}
      <div className="flex items-baseline justify-between px-1">
        <div>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: theme.textMuted, fontWeight: 600, marginBottom: 2, fontFamily: TYPO.fontText }}>Bloque · Inventario</p>
          <h3 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, margin: 0, fontFamily: TYPO.fontDisplay, lineHeight: 1.1 }}>
            Inventario · {fmtCompact(valorInv)} en stock.
          </h3>
        </div>
        <p style={{ fontSize: 11, color: theme.textMuted, margin: 0, fontFamily: TYPO.fontText, fontVariantNumeric: 'tabular-nums' }}>
          Cobertura ~{diasCob != null ? diasCob : '—'} días · {fmtInt(agotados)} SKUs agotados
        </p>
      </div>

      {/* Banner retrasadas (si aplica) */}
      {caminoRetrasadas.length > 0 && (
        <RetrasadasBanner retrasadas={caminoRetrasadas} />
      )}

      {/* Row 1: Marca donut + Familia donut + KPIs stack (3-col) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.8fr', gap: 10 }}>
        <InventarioMiniDonut
          title="Por marca"
          meta={`${marcasParaDonut.length} · ${fmtCompact(totalMarca)}`}
          items={marcasParaDonut}
          valueKey="valor" labelKey="marca"
          colorFn={colorMarcaIOS}
          centerLabel="Total" centerValue={fmtCompact(totalMarca)} centerSub={`${fmtInt(skus)} SKUs`}
          emptyMsg="Sin datos de marca"
        />
        <InventarioMiniDonut
          title="Por familia"
          meta={inventarioFamilia.length > 0 ? `${inventarioFamilia.length} · roadmap_sku` : 'roadmap_sku'}
          items={inventarioFamilia}
          valueKey="valor" labelKey="familia"
          colorFn={colorFamiliaIOS}
          centerLabel="Familias" centerValue={String(inventarioFamilia.length || 0)} centerSub="activas"
          emptyMsg="Requiere roadmap_sku cargado"
        />
        <InventarioKpiStack
          valorTransito={totalEnCamino} posTransito={totalPosEnCamino} pctStock={valorInv > 0 ? Math.round((totalEnCamino / valorInv) * 100) : 0}
          leadtime={caminoLeadtime}
          comprasYTD={comprasYTD} anio={anio}
        />
      </div>

      {/* Row 2: Lead time por etapa + Estatus actual */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10 }}>
        {caminoLeadtime && caminoLeadtime.lt_total > 0 ? (
          <LeadtimeEtapasCompact lt={caminoLeadtime} />
        ) : (
          <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 16px', color: theme.textMuted, fontSize: 12, fontFamily: TYPO.fontText, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Sin datos de lead time
          </div>
        )}
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 16px', fontFamily: TYPO.fontText }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, margin: 0, fontFamily: TYPO.fontDisplay }}>Por estatus actual</h4>
            <span style={{ fontSize: 10, color: theme.textMuted }}>5 buckets</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {BUCKET_ORDER.map((k) => {
              const cfg = BUCKET_LABELS[k];
              const r = resumenMap.get(k);
              const val = Number(r?.valor_mxn) || 0;
              const iosCol = ({
                produccion: theme.orange, transito: theme.accent, pendiente_modular: theme.indigo, por_zarpar: theme.pink, por_consolidar: theme.textMuted,
              })[k] || theme.textMuted;
              return (
                <div key={k} style={{
                  background: theme.surface, border: `1px solid ${theme.border}`,
                  borderLeft: `3px solid ${iosCol}`,
                  borderRadius: 10, padding: '8px 10px', fontFamily: TYPO.fontText,
                }}>
                  <p style={{ fontSize: 9, color: theme.textMuted, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{cfg.label}</p>
                  <p style={{ fontSize: 15, fontWeight: 600, margin: '2px 0 0', color: theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, letterSpacing: '-0.02em', fontFamily: TYPO.fontDisplay }}>
                    {val > 0 ? fmtCompact(val) : '—'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 3: Concentración semanal + Top proveedores + Agotados */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 10 }}>
        {caminoSemanal.length > 0 ? (
          <ConcentracionSemanalCompact semanas={caminoSemanal} />
        ) : (
          <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 16px', color: theme.textMuted, fontSize: 12, fontFamily: TYPO.fontText, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 128 }}>
            Sin datos de concentración semanal
          </div>
        )}
        {caminoProveedores.length > 0 ? (
          <TopProveedoresCompact proveedores={caminoProveedores} totalCamino={totalEnCamino} />
        ) : (
          <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 16px', color: theme.textMuted, fontSize: 12, fontFamily: TYPO.fontText, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 128 }}>
            Sin datos de proveedores
          </div>
        )}
        {caminoAgotados.length > 0 ? (
          <AgotadosCompact agotados={caminoAgotados} />
        ) : (
          <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 16px', color: theme.textMuted, fontSize: 12, fontFamily: TYPO.fontText, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 128 }}>
            Sin SKUs agotados con orden
          </div>
        )}
      </div>

      {/* Sin embarque asignado (legacy inline) */}
      {sinEmbarque && Number(sinEmbarque.valor_mxn) > 0 && (
        <div style={{
          background: theme.surface, border: `1px dashed ${theme.border}`, borderRadius: 12, padding: '10px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          fontFamily: TYPO.fontText,
        }}>
          <div>
            <p style={{ fontSize: 11, margin: 0, fontWeight: 500, color: theme.text }}>
              {fmtInt(sinEmbarque.pos)} POs sin embarque asignado en Master
            </p>
            <p style={{ fontSize: 10, margin: '2px 0 0', color: theme.textMuted, fontStyle: 'italic' }}>
              Probablemente compras nacionales o aún sin mapear en Master Embarques.
            </p>
          </div>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{fmtCompact(sinEmbarque.valor_mxn)}</span>
        </div>
      )}
    </div>
  );
}

// ────────── Componentes helpers Inventario Opción B ──────────
function InventarioKpiStack({ valorTransito, posTransito, pctStock, leadtime, comprasYTD, anio }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const invBg = theme.surfaceInverse;
  const invText = theme.textOnInverse;
  const invMuted = isDark ? 'rgba(29,29,31,0.7)' : 'rgba(245,245,247,0.72)';
  const red = theme.red;
  const green = theme.green;
  const ytdAct = comprasYTD.find((r) => r.anio === anio);
  const ytdPrev = comprasYTD.find((r) => r.anio === anio - 1);
  const valorYTD = Number(ytdAct?.valor_mxn) || 0;
  const valorYTDPrev = Number(ytdPrev?.valor_mxn) || 0;
  const deltaYoY = valorYTDPrev > 0 ? ((valorYTD - valorYTDPrev) / valorYTDPrev) * 100 : null;

  const Row = ({ inverse, badgeBg, badgeCol, Icon, lbl, val, sub, subColor }) => (
    <div style={{
      background: inverse ? invBg : theme.surface,
      color: inverse ? invText : theme.text,
      border: inverse ? 'none' : `1px solid ${theme.border}`,
      borderRadius: 12, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10,
      fontFamily: TYPO.fontText,
    }}>
      <div style={{ width: 26, height: 26, borderRadius: 8, background: badgeBg, color: badgeCol, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon style={{ width: 13, height: 13 }} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: inverse ? invMuted : theme.textMuted, fontWeight: 600, margin: 0 }}>{lbl}</p>
        <p style={{ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', margin: '1px 0 0', fontVariantNumeric: 'tabular-nums', color: inverse ? invText : theme.text }}>
          {val} {sub && <span style={{ fontSize: 10, color: subColor || (inverse ? invMuted : theme.textMuted), fontWeight: 500 }}>{sub}</span>}
        </p>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr 1fr', gap: 10 }}>
      <Row badgeBg={`${theme.accent}22`} badgeCol={theme.accent} Icon={Ship}
        lbl={`Valor en tránsito · ${fmtInt(posTransito)} POs`}
        val={fmtCompact(valorTransito)}
        sub={pctStock > 0 ? `· ${pctStock}% del stock` : ''}
      />
      <Row inverse badgeBg={isDark ? 'rgba(255,159,10,0.20)' : `${theme.orange}33`} badgeCol={theme.orange} Icon={Package}
        lbl="Lead time promedio"
        val={leadtime?.lt_total != null ? `${leadtime.lt_total} días` : '—'}
      />
      <Row badgeBg={`${theme.purple}22`} badgeCol={theme.purple} Icon={ShoppingBag}
        lbl={`Compras YTD ${anio} · ${fmtInt(ytdAct?.pos || 0)} PO`}
        val={fmtCompact(valorYTD)}
        sub={deltaYoY != null ? `${deltaYoY >= 0 ? '↑' : '↓'}${Math.abs(deltaYoY).toFixed(0)}%` : ''}
        subColor={deltaYoY == null ? undefined : deltaYoY >= 0 ? green : red}
      />
    </div>
  );
}

function LeadtimeEtapasCompact({ lt }) {
  const { theme } = useTheme();
  const total = Number(lt.lt_total) || 1;
  const etapas = [
    { lbl: '1 · Producción', val: Number(lt.lt_produccion) || 0, color: theme.orange },
    // v_vision_camino_leadtime expone lt_transito (eta_puerto − etd), no lt_maritimo.
    { lbl: '2 · Marítimo', val: Number(lt.lt_transito ?? lt.lt_maritimo) || 0, color: theme.accent },
    { lbl: '3 · Aduana → CEDIS', val: Number(lt.lt_aduana) || 0, color: theme.green },
  ];
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 16px', fontFamily: TYPO.fontText }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, margin: 0, fontFamily: TYPO.fontDisplay }}>Lead time por etapa</h4>
        <span style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{lt.lt_total}d</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {etapas.map((e) => {
          const pct = Math.round((e.val / total) * 100);
          return (
            <div key={e.lbl}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600 }}>
                  {e.lbl} · <strong style={{ color: theme.text }}>{e.val}d</strong>
                </span>
                <span style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
              </div>
              <div style={{ height: 4, borderRadius: 999, background: theme.border, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: e.color, borderRadius: 999 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConcentracionSemanalCompact({ semanas }) {
  const { theme } = useTheme();
  // v_vision_camino_semanal expone `semana` (date, lunes de la semana); no hay semana_label.
  const fmtSem = (d) => {
    if (!d) return '—';
    const dt = new Date(String(d).length === 10 ? `${d}T00:00:00` : d);
    return Number.isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  };
  const data = (semanas || []).slice(0, 12).map((s) => ({ semana: s.semana_label || fmtSem(s.semana), valor: Number(s.valor_mxn) || 0, piezas: Number(s.piezas) || 0 }));
  const max = Math.max(...data.map((d) => d.valor), 1);
  const maxSemana = data.find((d) => d.valor === max);
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 16px', fontFamily: TYPO.fontText }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, margin: 0, fontFamily: TYPO.fontDisplay }}>Concentración semanal</h4>
        {maxSemana && <span style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>Pico: {maxSemana.semana} · {fmtCompact(max)}</span>}
      </div>
      <div style={{ width: '100%', height: 98 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 6, right: 4, left: -6, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid stroke={theme.border} vertical={false} strokeOpacity={0.6} />
            <XAxis dataKey="semana" tick={{ fontSize: 9, fill: theme.textMuted }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => v == null ? '' : (v/1e6 >= 1 ? '$' + (v/1e6).toFixed(0) + 'M' : '$' + (v/1e3).toFixed(0) + 'K')} tick={{ fontSize: 9, fill: theme.textMuted }} axisLine={false} tickLine={false} width={38} />
            <Tooltip formatter={(v) => v != null ? fmtMoney(v) : '—'} cursor={{ fill: theme.textMuted, fillOpacity: 0.06 }} contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }} labelStyle={{ color: theme.textMuted, fontWeight: 500 }} />
            <Bar dataKey="valor" radius={[7, 7, 0, 0]} isAnimationActive={false}>
              {data.map((d, i) => <Cell key={i} fill={d.valor === max ? theme.orange : theme.accent} fillOpacity={d.valor === max ? 1 : 0.75} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TopProveedoresCompact({ proveedores, totalCamino }) {
  const { theme } = useTheme();
  const top = (proveedores || []).slice(0, 4);
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 16px', fontFamily: TYPO.fontText }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, margin: 0, fontFamily: TYPO.fontDisplay }}>Top proveedores</h4>
        <span style={{ fontSize: 10, color: theme.textMuted }}>tránsito</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, padding: '5px 6px', borderBottom: `1px solid ${theme.border}`, width: 16 }}>#</th>
            <th style={{ textAlign: 'left', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, padding: '5px 6px', borderBottom: `1px solid ${theme.border}` }}>Proveedor</th>
            <th style={{ textAlign: 'right', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, padding: '5px 6px', borderBottom: `1px solid ${theme.border}` }}>Valor</th>
          </tr>
        </thead>
        <tbody>
          {top.map((p, i) => (
            <tr key={(p.proveedor || '') + i}>
              <td style={{ padding: '3px 6px', fontSize: 10, color: theme.textSubtle, borderBottom: `1px solid ${theme.border}` }}>{i + 1}</td>
              <td style={{ padding: '3px 6px', fontSize: 11, color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 500, letterSpacing: '-0.005em', borderBottom: `1px solid ${theme.border}`, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.proveedor}>{p.proveedor}</td>
              <td style={{ padding: '3px 6px', fontSize: 12, textAlign: 'right', color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600, letterSpacing: '-0.01em', borderBottom: `1px solid ${theme.border}` }}>{fmtCompact(p.valor_mxn || p.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AgotadosCompact({ agotados }) {
  const { theme } = useTheme();
  const top = (agotados || []).slice(0, 4);
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 16px', fontFamily: TYPO.fontText }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, margin: 0, fontFamily: TYPO.fontDisplay }}>Agotados con orden</h4>
        <span style={{ fontSize: 10, color: theme.textMuted }}>{agotados.length} SKUs</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, padding: '5px 6px', borderBottom: `1px solid ${theme.border}`, width: 16 }}>#</th>
            <th style={{ textAlign: 'left', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, padding: '5px 6px', borderBottom: `1px solid ${theme.border}` }}>SKU</th>
            <th style={{ textAlign: 'right', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, padding: '5px 6px', borderBottom: `1px solid ${theme.border}` }}>Llega</th>
          </tr>
        </thead>
        <tbody>
          {top.map((a, i) => {
            // v_vision_camino_agotados expone articulo / eta_estimada (text) /
            // dias_para_llegar / pzs_camino — no sku / eta_cedis / eta_puerto.
            const sku = a.articulo || a.sku || '';
            const etaRaw = a.eta_estimada || a.eta_cedis || a.eta_puerto || null;
            const etaDate = etaRaw ? new Date(String(etaRaw).length === 10 ? `${etaRaw}T00:00:00` : etaRaw) : null;
            const etaTxt = etaDate && !Number.isNaN(etaDate.getTime())
              ? etaDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
              : (etaRaw ? String(etaRaw) : '—');
            const dias = Number(a.dias_para_llegar);
            return (
              <tr key={sku + i}>
                <td style={{ padding: '3px 6px', fontSize: 10, color: theme.textSubtle, borderBottom: `1px solid ${theme.border}` }}>{i + 1}</td>
                <td style={{ padding: '3px 6px', fontSize: 11, color: theme.text, fontFamily: '-apple-system, "SF Mono", ui-monospace, monospace', letterSpacing: 0, borderBottom: `1px solid ${theme.border}` }}>
                  {sku}
                  {Number(a.pzs_camino) > 0 && <span style={{ marginLeft: 6, fontSize: 9.5, color: theme.textMuted, fontFamily: TYPO.fontText }}>{Number(a.pzs_camino).toLocaleString('es-MX')} pz</span>}
                </td>
                <td style={{ padding: '3px 6px', fontSize: 12, textAlign: 'right', color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600, letterSpacing: '-0.01em', borderBottom: `1px solid ${theme.border}` }} title={Number.isFinite(dias) ? `${dias} días` : undefined}>
                  {etaTxt}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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

// ══════════════════════════════════════════════════
// Bloque Sell Out
// ══════════════════════════════════════════════════
const CANAL_SELLOUT_META = {
  mayoreo:      { label: 'Mayoreo',       tone: 'purple', nota: 'Con lag 90d · 13 mayoristas' },
  distribuidor: { label: 'Distribuidor',  tone: 'blue',   nota: 'Con lag 90d · Digitalife · PCEL · Dicotech' },
  directo:      { label: 'Venta directa', tone: 'orange', nota: 'Sin lag · Mostrador · E-com · Marketplaces' },
};

// ────────── Helpers para Sell Out block ──────────

const CANAL_SELLOUT_LBL = { mayoreo: 'Mayoreo', distribuidor: 'Distribuidor', directo: 'Venta Directa' };

function SellOutKpiRow({ sellOutMes, sellMayoristas, canalRows, anio }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const invBg = theme.surfaceInverse;
  const invText = theme.textOnInverse;
  const invMuted = isDark ? 'rgba(29,29,31,0.7)' : 'rgba(245,245,247,0.72)';
  const green = theme.green;
  const red = theme.red;
  const clientesTotal = canalRows.reduce((s, r) => s + (Number(r.clientes) || 0), 0);

  const Card = ({ inverse, badgeBg, badgeCol, Icon, eyebrow, kpi, delta, deltaCol, sub }) => (
    <div style={{
      background: inverse ? invBg : theme.surface,
      color: inverse ? invText : theme.text,
      border: inverse ? 'none' : `1px solid ${theme.border}`,
      borderRadius: 12, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10,
      minHeight: 52, fontFamily: TYPO.fontText,
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 8, background: badgeBg, color: badgeCol,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon style={{ width: 13, height: 13 }} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, margin: 0, color: inverse ? invMuted : theme.textMuted }}>{eyebrow}</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
          <p style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: inverse ? invText : theme.text }}>{kpi}</p>
          {delta && <span style={{ fontSize: 11, fontWeight: 500, color: deltaCol, fontVariantNumeric: 'tabular-nums' }}>{delta}</span>}
          {sub && !delta && <span style={{ fontSize: 11, color: inverse ? invMuted : theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{sub}</span>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-3 gap-2.5">
      <Card
        badgeBg={`${theme.orange}22`} badgeCol={theme.orange} Icon={ShoppingBag}
        eyebrow={`Sell-out ${MESES_LBL[sellOutMes.mesEfectivo - 1]}${sellOutMes.esEnCurso ? ' · último cerrado' : ''}`}
        kpi={fmtCompact(sellOutMes.total)}
        delta={sellOutMes.deltaYoY != null ? `${sellOutMes.deltaYoY >= 0 ? '↑' : '↓'}${Math.abs(sellOutMes.deltaYoY).toFixed(1)}%` : null}
        deltaCol={sellOutMes.deltaYoY == null ? theme.textMuted : sellOutMes.deltaYoY >= 0 ? green : red}
      />
      <Card inverse
        badgeBg={isDark ? 'rgba(0,85,181,0.20)' : `${theme.accent}33`} badgeCol={isDark ? theme.accent : theme.accent} Icon={TrendingUp}
        eyebrow="Sell-out YTD · YoY"
        kpi={fmtCompact(sellOutMes.ytd)}
        delta={sellOutMes.deltaYTD != null ? `${sellOutMes.deltaYTD >= 0 ? '↑' : '↓'}${Math.abs(sellOutMes.deltaYTD).toFixed(1)}%` : null}
        deltaCol={sellOutMes.deltaYTD == null ? invMuted : sellOutMes.deltaYTD >= 0 ? green : red}
      />
      <Card
        badgeBg={`${theme.purple}22`} badgeCol={theme.purple} Icon={ShoppingBag}
        eyebrow={`Clientes finales · en ${sellMayoristas.length || '—'} mayoristas`}
        kpi={fmtInt(clientesTotal)}
        sub="activos"
      />
    </div>
  );
}

function SellOutMix({ canalRows, totalYTD, deltaYTD, anio, expandido, onSelect }) {
  const { theme } = useTheme();
  const [hover, setHover] = useState(null);
  const items = [...(canalRows || [])].filter((c) => (c.importe || 0) > 0).sort((a, b) => (b.importe || 0) - (a.importe || 0));
  const green = theme.green;
  const red = theme.red;

  if (!items.length) {
    return (
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 24, color: theme.textMuted, fontFamily: TYPO.fontText, textAlign: 'center', fontSize: 13 }}>
        Sin datos de sell-out por canal.
      </div>
    );
  }

  const total = items.reduce((s, it) => s + (it.importe || 0), 0) || 1;
  const R = 42, CIRC = 2 * Math.PI * R;
  let offsetAcc = 0;
  const arcs = items.map((it) => {
    const pct = (it.importe || 0) / total;
    const len = pct * CIRC;
    const dash = `${len} ${CIRC}`;
    const dashOffset = -offsetAcc;
    offsetAcc += len;
    return { key: it.key, color: colorCanalIOS(theme, CANAL_SELLOUT_LBL[it.key] || it.key), dash, dashOffset };
  });

  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12,
      padding: '14px 18px', display: 'grid', gridTemplateColumns: '132px 1fr', gap: 20,
      alignItems: 'center', fontFamily: TYPO.fontText,
    }}>
      <div style={{ position: 'relative', width: 132, height: 132 }}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r={R} fill="none" stroke={theme.border} strokeWidth="10" />
          {arcs.map((a) => {
            const active = hover === a.key || expandido === a.key;
            const other = (hover || expandido) && !active;
            return (
              <circle key={a.key} cx="50" cy="50" r={R} fill="none"
                stroke={a.color} strokeWidth={active ? 12 : 10}
                strokeDasharray={a.dash} strokeDashoffset={a.dashOffset}
                opacity={other ? 0.25 : 1}
                style={{ transition: 'stroke-width 120ms, opacity 120ms', cursor: 'pointer' }}
                onMouseEnter={() => setHover(a.key)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect(a.key)}
              />
            );
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          {(() => {
            const sel = items.find((it) => it.key === (hover || expandido));
            if (sel) {
              const pct = ((sel.importe || 0) / total) * 100;
              return (
                <>
                  <div style={{ fontSize: 9, color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{CANAL_SELLOUT_LBL[sel.key] || sel.key}</div>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.03em', color: theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmtCompact(sel.importe)}</div>
                  <div style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{pct.toFixed(1)}% del total</div>
                </>
              );
            }
            return (
              <>
                <div style={{ fontSize: 9, color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>YTD Sell-Out</div>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.03em', color: theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmtCompact(totalYTD)}</div>
                {deltaYTD != null && (
                  <div style={{ fontSize: 10, fontVariantNumeric: 'tabular-nums', marginTop: 2, color: deltaYTD >= 0 ? green : red, fontWeight: 500 }}>
                    {deltaYTD >= 0 ? '↑' : '↓'} {Math.abs(deltaYTD).toFixed(1)}% vs {anio - 1}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 1 }}>
        {items.map((it, i) => {
          const col = colorCanalIOS(theme, CANAL_SELLOUT_LBL[it.key] || it.key);
          const pct = ((it.importe || 0) / total) * 100;
          const active = hover === it.key || expandido === it.key;
          const dim = (hover || expandido) && !active;
          return (
            <div key={it.key}
              onMouseEnter={() => setHover(it.key)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect(it.key)}
              style={{
                display: 'grid', gridTemplateColumns: '12px 6px minmax(0, 1fr) 50px 62px 34px', alignItems: 'center', gap: 6,
                padding: '3px 3px', borderRadius: 6,
                background: active ? (theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)') : 'transparent',
                opacity: dim ? 0.5 : 1,
                cursor: 'pointer', transition: 'background 120ms, opacity 120ms',
              }}>
              <span style={{ fontSize: 9, color: theme.textSubtle, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>#{i + 1}</span>
              <span style={{ width: 6, height: 6, borderRadius: 2, background: col }} />
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 3, minWidth: 0 }}>
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 500, color: theme.text, textTransform: 'uppercase', letterSpacing: '-0.005em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{CANAL_SELLOUT_LBL[it.key] || it.key}</span>
                <span style={{ fontSize: 9, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>· {pct.toFixed(1)}%</span>
              </span>
              <div style={{ height: 3, borderRadius: 999, background: theme.border, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.max(2, pct)}%`, background: col, borderRadius: 999 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 4 }}>
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{fmtCompact(it.importe)}</span>
              </div>
              <span style={{ fontSize: 9, fontWeight: 500, color: it.deltaYoY == null ? theme.textMuted : it.deltaYoY >= 0 ? green : red, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {it.deltaYoY == null ? '' : `${it.deltaYoY >= 0 ? '↑' : '↓'}${Math.abs(it.deltaYoY).toFixed(0)}%`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SellOutTendencia({ data, anio }) {
  const { theme } = useTheme();
  const pink = theme.pink;
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 16px', fontFamily: TYPO.fontText, display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 4 }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, margin: 0, fontFamily: TYPO.fontDisplay }}>Tendencia sell-out mensual.</h4>
        <div style={{ display: 'inline-flex', gap: 10, fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 2, borderRadius: 1, background: pink }} />{anio}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 2, borderRadius: 1, background: theme.textMuted, opacity: 0.55 }} />{anio - 1}</span>
        </div>
      </div>
      <div style={{ width: '100%', height: 132, flex: 1 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 6, right: 4, left: -6, bottom: 0 }}>
            <defs>
              <linearGradient id="fillSO" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={pink} stopOpacity={0.20} />
                <stop offset="100%" stopColor={pink} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={theme.border} vertical={false} strokeOpacity={0.6} />
            <XAxis dataKey="mes" tick={{ fontSize: 9, fill: theme.textMuted }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tickFormatter={(v) => v == null ? '' : (v/1e6 >= 1 ? '$' + (v/1e6).toFixed(0) + 'M' : '$' + (v/1e3).toFixed(0) + 'K')} tick={{ fontSize: 9, fill: theme.textMuted }} axisLine={false} tickLine={false} width={38} />
            <Tooltip formatter={(v) => v != null ? fmtMoney(v) : '—'} contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }} labelStyle={{ color: theme.textMuted, fontWeight: 500 }} />
            <Area type="monotone" dataKey={`${anio - 1}`} stroke={theme.textMuted} strokeOpacity={0.55} strokeWidth={1.4} fill="none" dot={false} isAnimationActive={false} />
            <Area type="monotone" dataKey={`${anio}`} stroke={pink} strokeWidth={2.2} fill="url(#fillSO)" dot={false} activeDot={{ r: 4, fill: theme.surface, stroke: pink, strokeWidth: 2 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SellOutRanking({ mayoristas, totalYTD, expandido, onSelect }) {
  const { theme } = useTheme();
  const blue = theme.accent;
  const items = [...(mayoristas || [])].sort((a, b) => (Number(b.importe) || 0) - (Number(a.importe) || 0));
  const half = Math.ceil(items.length / 2);
  const col1 = items.slice(0, half);
  const col2 = items.slice(half);
  const max = Math.max(...items.map((m) => Number(m.importe) || 0), 1);

  const Row = ({ m, i }) => {
    const w = (Number(m.importe) / max) * 100;
    const share = totalYTD > 0 ? (Number(m.importe) / totalYTD) * 100 : 0;
    const active = expandido === m.mayorista;
    return (
      <div onClick={() => onSelect(m.mayorista)}
        style={{
          display: 'grid', gridTemplateColumns: '16px minmax(0, 1fr) 60px 40px', alignItems: 'center', gap: 8,
          padding: '3px 4px', borderRadius: 6, cursor: 'pointer',
          background: active ? (theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)') : 'transparent',
        }}>
        <span style={{ fontSize: 9, color: theme.textSubtle, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>#{i + 1}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 500, letterSpacing: '-0.005em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: theme.text }}>{m.mayorista}</span>
          <div style={{ flex: 1, minWidth: 30, height: 3, borderRadius: 999, background: theme.border, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.max(2, w)}%`, background: blue, borderRadius: 999 }} />
          </div>
        </span>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: theme.text, letterSpacing: '-0.01em' }}>{fmtCompact(m.importe)}</span>
        <span style={{ fontSize: 9, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{share.toFixed(1)}%</span>
      </div>
    );
  };

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 16px', fontFamily: TYPO.fontText }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 8 }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, margin: 0, fontFamily: TYPO.fontDisplay }}>Ranking mayoristas</h4>
        <span style={{ fontSize: 10, color: theme.textMuted }}>{items.length} activos</span>
      </div>
      {items.length === 0 ? (
        <p style={{ fontSize: 11, color: theme.textMuted, margin: 0 }}>Sin datos.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px' }}>
          <div>{col1.map((m, i) => <Row key={m.mayorista} m={m} i={i} />)}</div>
          <div>{col2.map((m, i) => <Row key={m.mayorista} m={m} i={half + i} />)}</div>
        </div>
      )}
    </div>
  );
}

function SellOutTopTable({ title, meta, data, keyField, mono = false }) {
  const { theme } = useTheme();
  const rows = (data || []).slice(0, 6);
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 16px', fontFamily: TYPO.fontText }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 8 }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, margin: 0, fontFamily: TYPO.fontDisplay }}>{title}</h4>
        <span style={{ fontSize: 10, color: theme.textMuted }}>{meta}</span>
      </div>
      {rows.length === 0 ? (
        <p style={{ fontSize: 11, color: theme.textMuted, margin: 0 }}>Sin datos.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, padding: '5px 6px', borderBottom: `1px solid ${theme.border}`, width: 16 }}>#</th>
              <th style={{ textAlign: 'left', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, padding: '5px 6px', borderBottom: `1px solid ${theme.border}` }}>{keyField === 'sku' && mono ? 'SKU' : 'Nombre'}</th>
              <th style={{ textAlign: 'right', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, padding: '5px 6px', borderBottom: `1px solid ${theme.border}` }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={(r[keyField] || '') + i}>
                <td style={{ padding: '3px 6px', fontSize: 10, color: theme.textSubtle, borderBottom: `1px solid ${theme.border}` }}>{i + 1}</td>
                <td style={{ padding: '3px 6px', fontSize: 11, color: theme.text, fontFamily: mono ? '-apple-system, "SF Mono", ui-monospace, monospace' : TYPO.fontDisplay, fontWeight: mono ? 400 : 500, letterSpacing: mono ? 0 : '-0.005em', borderBottom: `1px solid ${theme.border}`, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r[keyField]}>{r[keyField]}</td>
                <td style={{ padding: '3px 6px', fontSize: 12, textAlign: 'right', color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600, letterSpacing: '-0.01em', borderBottom: `1px solid ${theme.border}` }}>{fmtCompact(Number(r.importe) || 0)}</td>
              </tr>
            ))}
            {data && data.length > 6 && (
              <tr><td colSpan={3} style={{ padding: '4px 6px', color: theme.textMuted, fontSize: 10, textAlign: 'center', borderBottom: 0 }}>+ {data.length - 6} más</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SellOutCanalPanel({ canalKey, canalRow, serie12m, sellMayoristas, sellTopSkus, sellTopClientes, anio, mesMax, onClose }) {
  const { theme } = useTheme();
  const label = CANAL_SELLOUT_LBL[canalKey] || canalKey;
  const canalCol = colorCanalIOS(theme, label);
  const green = theme.green;
  const red = theme.red;
  const ytdAct = canalRow?.importe || 0;
  const ytdPrev = canalRow?.prev || 0;
  const delta = ytdPrev > 0 ? ((ytdAct - ytdPrev) / ytdPrev) * 100 : null;
  const mayoristasCanal = (sellMayoristas || []).filter((m) => m.canal_sellout === canalKey || !m.canal_sellout);

  const KBox = ({ lbl, val, sub, subColor, last }) => (
    <div style={{ padding: '2px 14px', borderRight: last ? 'none' : `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column' }}>
      <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, margin: 0 }}>{lbl}</p>
      <p style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em', color: subColor || theme.text, fontVariantNumeric: 'tabular-nums', margin: '2px 0 0' }}>{val}</p>
      {sub && <p style={{ fontSize: 10, color: subColor || theme.textMuted, fontVariantNumeric: 'tabular-nums', margin: '2px 0 0' }}>{sub}</p>}
    </div>
  );

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 18px', fontFamily: TYPO.fontText }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottom: `1px solid ${theme.border}`, marginBottom: 12 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: canalCol, flexShrink: 0 }} />
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginLeft: 4 }}>
          · {mayoristasCanal.length} mayoristas · {fmtInt(canalRow?.clientes || 0)} clientes · {(canalRow?.share || 0).toFixed(1)}% del sell-out total
        </span>
        <button onClick={onClose} title="Cerrar" style={{ marginLeft: 'auto', background: 'transparent', border: 0, color: theme.textMuted, cursor: 'pointer', padding: 4, lineHeight: 1 }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 12 }}>
        <KBox lbl={`YTD ${anio}`} val={fmtCompact(ytdAct)} sub={`vs ${fmtCompact(ytdPrev)} en ${anio - 1}`} />
        <KBox lbl={`YTD ${anio - 1}`} val={fmtCompact(ytdPrev)} sub={`${mesMax} meses cerrados`} />
        <KBox lbl="Δ YoY" val={delta == null ? '—' : fmtPctDelta(delta)} sub={delta == null ? '' : `${delta >= 0 ? '+' : ''}${fmtCompact(ytdAct - ytdPrev)} vs prev`} subColor={delta == null ? theme.textMuted : delta >= 0 ? green : red} />
        <KBox lbl="Clientes finales" val={fmtInt(canalRow?.clientes || 0)} sub={`${fmtInt(canalRow?.skus || 0)} SKUs distintos`} last />
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '6px 0 6px' }}>
        <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: theme.textMuted, fontWeight: 600, margin: 0 }}>Sell-out mensual · {anio - 1} vs {anio}</p>
        <div style={{ display: 'inline-flex', gap: 10, fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: canalCol }} />{anio}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: canalCol, opacity: 0.28 }} />{anio - 1}</span>
        </div>
      </div>
      <div style={{ width: '100%', height: 130, marginBottom: 12 }}>
        <ResponsiveContainer>
          <BarChart data={serie12m} margin={{ top: 6, right: 4, left: -6, bottom: 0 }} barCategoryGap="18%" barGap={2}>
            <CartesianGrid stroke={theme.border} vertical={false} strokeOpacity={0.6} />
            <XAxis dataKey="mes" tick={{ fontSize: 9, fill: theme.textMuted }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tickFormatter={(v) => v == null ? '' : (v/1e6 >= 1 ? '$' + (v/1e6).toFixed(0) + 'M' : '$' + (v/1e3).toFixed(0) + 'K')} tick={{ fontSize: 9, fill: theme.textMuted }} axisLine={false} tickLine={false} width={38} />
            <Tooltip formatter={(v) => v != null ? fmtMoney(v) : '—'} cursor={{ fill: theme.textMuted, fillOpacity: 0.06 }} contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }} labelStyle={{ color: theme.textMuted, fontWeight: 500 }} />
            <Bar dataKey={`${anio - 1}`} fill={canalCol} fillOpacity={0.28} radius={[7, 7, 0, 0]} isAnimationActive={false} />
            <Bar dataKey={`${anio}`}     fill={canalCol}                    radius={[7, 7, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
        <div>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: theme.textMuted, fontWeight: 600, margin: '0 0 6px' }}>Top mayoristas del canal · YTD</p>
          <SellOutTopTable title="" meta="" data={mayoristasCanal.map((m) => ({ ...m, sku: m.mayorista }))} keyField="sku" />
        </div>
        <div>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: theme.textMuted, fontWeight: 600, margin: '0 0 6px' }}>Top SKUs del canal · YTD</p>
          <SellOutTopTable title="" meta="" data={sellTopSkus} keyField="sku" mono />
        </div>
      </div>
    </div>
  );
}

function SellOutMayoristaPanel({ mayorista, totalYTD, serie12m, sellTopSkus, sellTopClientes, anio, onClose }) {
  const { theme } = useTheme();
  if (!mayorista) return null;
  const canalCol = colorCanalIOS(theme, CANAL_SELLOUT_LBL[mayorista.canal_sellout] || 'MAYOREO');
  const share = totalYTD > 0 ? (Number(mayorista.importe) / totalYTD) * 100 : 0;
  const clientesN = Number(mayorista.clientes_finales) || 0;
  const skusN = Number(mayorista.skus) || 0;

  const KBox = ({ lbl, val, sub, subColor, last }) => (
    <div style={{ padding: '2px 14px', borderRight: last ? 'none' : `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column' }}>
      <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, margin: 0 }}>{lbl}</p>
      <p style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em', color: subColor || theme.text, fontVariantNumeric: 'tabular-nums', margin: '2px 0 0' }}>{val}</p>
      {sub && <p style={{ fontSize: 10, color: subColor || theme.textMuted, fontVariantNumeric: 'tabular-nums', margin: '2px 0 0' }}>{sub}</p>}
    </div>
  );

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 18px', fontFamily: TYPO.fontText }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottom: `1px solid ${theme.border}`, marginBottom: 12 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: canalCol, flexShrink: 0 }} />
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, textTransform: 'uppercase' }}>{mayorista.mayorista}</span>
        <span style={{ fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginLeft: 4 }}>
          · {CANAL_SELLOUT_LBL[mayorista.canal_sellout] || 'Mayoreo'} · {share.toFixed(1)}% del sell-out · {fmtInt(clientesN)} clientes finales
        </span>
        <button onClick={onClose} title="Cerrar" style={{ marginLeft: 'auto', background: 'transparent', border: 0, color: theme.textMuted, cursor: 'pointer', padding: 4, lineHeight: 1 }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 12 }}>
        <KBox lbl="Sell-out YTD" val={fmtCompact(mayorista.importe)} sub={`${share.toFixed(1)}% del total`} />
        <KBox lbl="Clientes finales" val={fmtInt(clientesN)} sub={`${fmtInt(skusN)} SKUs distintos`} />
        <KBox lbl="Ticket promedio" val={clientesN > 0 ? fmtCompact(Number(mayorista.importe) / clientesN) : '—'} sub="por cliente/año" />
        <KBox lbl="Rank" val={`#${mayorista._rank || '—'}`} sub="por facturación" last />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: theme.textMuted, fontWeight: 600, margin: '0 0 6px' }}>Top clientes que compran a {mayorista.mayorista}</p>
          <SellOutTopTable title="" meta="" data={sellTopClientes.map((c) => ({ ...c, sku: c.cliente_final }))} keyField="sku" />
        </div>
        <div>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: theme.textMuted, fontWeight: 600, margin: '0 0 6px' }}>Top SKUs vendidos vía {mayorista.mayorista}</p>
          <SellOutTopTable title="" meta="" data={sellTopSkus} keyField="sku" mono />
        </div>
      </div>
    </div>
  );
}

function SellOutBloque({
  sellCanal, sellCanalPrev, sellMayoristas, sellRotacion,
  sellMensual, sellMensualPrev, sellTopSkus, sellTopClientes,
  sellPromosResumen, sellPromosSkus, sellOutMes,
  anio, mesMax,
}) {
  const { theme } = useTheme();
  const [canalDrillDown, setCanalDrillDown] = useState(null);
  const [mayoristaDrillDown, setMayoristaDrillDown] = useState(null);
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

  const invBg = theme.surfaceInverse;
  const invText = theme.textOnInverse;
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
          borderRadius: 12, padding: 16,
          background: tonoColores(theme, 'orange').bg,
          color: tonoColores(theme, 'orange').text,
          fontSize: 13, fontFamily: TYPO.fontText,
        }}>
          Aún no hay datos de <code>sellout_general</code> en Supabase.
          Sube el archivo Sellout General.xlsx en <code>/uploads.html</code> para activar este bloque.
        </div>
      )}

      {/* ① KPI row · densidad 1 · 56px */}
      <SellOutKpiRow sellOutMes={sellOutMes} sellMayoristas={sellMayoristas} canalRows={canalRows} anio={anio} />

      {/* ② Mix (donut+ranking) + Tendencia mensual · lado a lado */}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)' }}>
        <SellOutMix
          canalRows={canalRows}
          totalYTD={totalYTD}
          deltaYTD={sellOutMes.deltaYTD}
          anio={anio}
          expandido={canalDrillDown}
          onSelect={(k) => { setCanalDrillDown(canalDrillDown === k ? null : k); setMayoristaDrillDown(null); }}
        />
        <SellOutTendencia data={serie12m} anio={anio} />
      </div>

      {/* Drill-down canal */}
      {canalDrillDown && (
        <SellOutCanalPanel
          canalKey={canalDrillDown}
          canalRow={canalRows.find((c) => c.key === canalDrillDown)}
          serie12m={serie12m}
          sellMayoristas={sellMayoristas}
          sellTopSkus={sellTopSkus}
          sellTopClientes={sellTopClientes}
          anio={anio}
          mesMax={mesMax}
          onClose={() => setCanalDrillDown(null)}
        />
      )}

      {/* ③ Ranking mayoristas · 2 col + Top SKUs + Top clientes */}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: '1.2fr 1fr 1fr' }}>
        <SellOutRanking mayoristas={sellMayoristas} totalYTD={totalYTD} expandido={mayoristaDrillDown} onSelect={(m) => { setMayoristaDrillDown(mayoristaDrillDown === m ? null : m); setCanalDrillDown(null); }} />
        <SellOutTopTable title="Top SKUs · YTD" meta="valor sell-out" data={sellTopSkus} keyField="sku" mono />
        <SellOutTopTable title="Top clientes finales" meta="valor sell-out" data={sellTopClientes.map((c) => ({ ...c, sku: c.cliente_final }))} keyField="sku" />
      </div>

      {/* Drill-down mayorista */}
      {mayoristaDrillDown && (
        <SellOutMayoristaPanel
          mayorista={sellMayoristas.find((m) => m.mayorista === mayoristaDrillDown)}
          totalYTD={totalYTD}
          serie12m={serie12m}
          sellTopSkus={sellTopSkus}
          sellTopClientes={sellTopClientes}
          anio={anio}
          onClose={() => setMayoristaDrillDown(null)}
        />
      )}

      {/* ⑨ Efectividad de promos por temporada */}
      {sellPromosResumen && sellPromosResumen.campania && (
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 24, fontFamily: TYPO.fontText }}>
          <div className="flex items-baseline justify-between mb-3">
            <h4 style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, margin: 0, fontFamily: TYPO.fontDisplay }}>Efectividad de promos por temporada</h4>
            <span style={{ fontSize: 12, color: theme.textMuted }}>{MESES_FULL[mesMax - 1]} {anio}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {(() => {
              const orange = tonoColores(theme, 'orange'), gray = tonoColores(theme, 'gray'), green = tonoColores(theme, 'green');
              const cur = Number(sellPromosResumen.sellout_en_promo) || 0;
              const prev = Number(sellPromosResumen.sellout_promo_mes_prev) || 0;
              const lift = prev > 0 ? ((cur - prev) / prev) * 100 : null;
              const total = cur + (Number(sellPromosResumen.sellout_fuera_promo) || 0);
              const tile = { borderRadius: 8, padding: 12, border: cardBorder, fontFamily: TYPO.fontText };
              const eyebrow = { fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' };
              return (
                <>
                  <div style={{ ...tile, background: cardBgFor(orange), borderLeft: `3px solid ${orange.strong}` }}>
                    <div style={{ ...eyebrow, color: cardLabelFor(orange) }}>Campaña</div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4, color: cardTitleFor(orange) }}>{sellPromosResumen.campania}</div>
                    <div style={{ fontSize: 11, marginTop: 4, color: cardLabelFor(orange), fontVariantNumeric: 'tabular-nums' }}>{fmtInt(sellPromosResumen.skus_campania)} SKUs</div>
                  </div>
                  <div style={{ ...tile, background: cardBgFor(gray), borderLeft: `3px solid ${gray.strong}` }}>
                    <div style={{ ...eyebrow, color: cardLabelFor(gray) }}>Sellout en promo</div>
                    <div style={{ fontSize: 16, fontWeight: 500, marginTop: 4, color: cardTitleFor(gray), fontVariantNumeric: 'tabular-nums' }}>{fmtCompact(cur)}</div>
                    <div style={{ fontSize: 11, marginTop: 4, color: cardLabelFor(gray), fontVariantNumeric: 'tabular-nums' }}>
                      {total > 0 ? fmtPct((cur / total) * 100) : '—'} del total
                    </div>
                  </div>
                  <div style={{ ...tile, background: cardBgFor(gray), borderLeft: `3px solid ${gray.strong}` }}>
                    <div style={{ ...eyebrow, color: cardLabelFor(gray) }}>Sellout fuera</div>
                    <div style={{ fontSize: 16, fontWeight: 500, marginTop: 4, color: cardTitleFor(gray), fontVariantNumeric: 'tabular-nums' }}>{fmtCompact(sellPromosResumen.sellout_fuera_promo)}</div>
                  </div>
                  <div style={{ ...tile, border: 'none', background: green.bg }}>
                    <div style={{ ...eyebrow, color: green.text }}>Lift vs mes anterior</div>
                    <div style={{ fontSize: 16, fontWeight: 500, marginTop: 4, color: green.text, fontVariantNumeric: 'tabular-nums' }}>{lift != null ? fmtPctDelta(lift) : '—'}</div>
                    <div style={{ fontSize: 11, marginTop: 4, color: green.text, fontVariantNumeric: 'tabular-nums' }}>{fmtCompact(prev)} → {fmtCompact(cur)}</div>
                  </div>
                </>
              );
            })()}
          </div>
          {sellPromosSkus.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500, marginBottom: 8 }}>Top 5 SKUs de la campaña</div>
              <div className="space-y-1">
                {sellPromosSkus.map((s, i) => (
                  <div key={s.sku} className="grid gap-2 items-baseline"
                    style={{ gridTemplateColumns: '24px 1fr auto auto auto', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ color: theme.textSubtle }}>{i + 1}</span>
                    <span style={{ fontFamily: '-apple-system, "SF Mono", ui-monospace, monospace', color: theme.text }}>{s.sku}</span>
                    <span style={{ color: theme.textMuted, textAlign: 'right' }}>{s.promo_pct != null ? `${(Number(s.promo_pct) * 100).toFixed(0)}% off` : '—'}</span>
                    <span style={{ color: theme.textMuted, textAlign: 'right' }}>{fmtInt(s.piezas)} pz</span>
                    <span style={{ color: theme.text, fontWeight: 500, textAlign: 'right', width: 64 }}>{fmtCompact(s.importe)}</span>
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
