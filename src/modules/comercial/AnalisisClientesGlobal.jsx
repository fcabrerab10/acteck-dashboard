import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import {
  Activity, TrendingUp, TrendingDown, Minus, Search, X, Users, Target, Wallet, Calendar,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';

const MESES_LBL  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const PALETTE = {
  blue:   { bg: '#E6F1FB', text: '#042C53', mid: '#185FA5', strong: '#3B82F6', soft: '#B5D4F4' },
  teal:   { bg: '#E1F5EE', text: '#04342C', mid: '#0F6E56', strong: '#1D9E75', soft: '#9FE1CB' },
  purple: { bg: '#EEEDFE', text: '#26215C', mid: '#534AB7', strong: '#7F77DD', soft: '#CECBF6' },
  coral:  { bg: '#FAECE7', text: '#4A1B0C', mid: '#993C1D', strong: '#D85A30', soft: '#F5C4B3' },
  amber:  { bg: '#FAEEDA', text: '#412402', mid: '#854F0B', strong: '#BA7517', soft: '#FAC775' },
  pink:   { bg: '#FBEAF0', text: '#4B1528', mid: '#993556', strong: '#D4537E', soft: '#F4C0D1' },
  green:  { bg: '#EAF3DE', text: '#173404', mid: '#3B6D11', strong: '#639922', soft: '#C0DD97' },
  gray:   { bg: '#F1EFE8', text: '#2C2C2A', mid: '#5F5E5A', strong: '#888780', soft: '#D3D1C7' },
};
const CANAL_COLOR = {
  'DISTRIBUIDOR':         PALETTE.teal,
  'MAYOREO':              PALETTE.blue,
  'MERCADO LIBRE':        PALETTE.amber,
  'AMAZON':               PALETTE.coral,
  'E-COMMERCE':           PALETTE.coral,
  'SITIO WEB':            PALETTE.teal,
  'MOSTRADOR':            PALETTE.amber,
  'RETAIL REPRESENTADOS': PALETTE.purple,
  'RETAIL PROPIOS':       PALETTE.pink,
  'RETAIL':               PALETTE.purple,
};
const colorCanal = (k) => CANAL_COLOR[String(k || '').toUpperCase()] || PALETTE.gray;

// ────────── iOS palette map por canal (usa theme colors) ──────────
function colorCanalIOS(theme, key, fallbackIdx = 0) {
  const overrides = {
    'MAYOREO':              theme.purple,
    'DISTRIBUIDOR':         theme.accent,
    'E-COMMERCE':           theme.teal,
    'MERCADO LIBRE':        theme.orange,
    'AMAZON':               theme.pink,
    'SITIO WEB':            theme.teal,
    'CYBERPUERTA':          theme.purple,
    'MOSTRADOR':            theme.green,
    'RETAIL REPRESENTADOS': theme.orange,
    'RETAIL PROPIOS':       theme.pink,
    'RETAIL':               theme.orange,
  };
  const norm = String(key || '').toUpperCase();
  const order = [theme.purple, theme.accent, theme.teal, theme.orange, theme.pink, theme.green, theme.indigo, theme.red].filter(Boolean);
  return overrides[norm] || order[fallbackIdx % order.length] || theme.accent;
}

// ────────── IconBadge (patrón AirPods) ──────────
function IconBadge({ icon: Icon, color, size = 26 }) {
  if (!Icon) return null;
  const iconSize = Math.round(size * 0.5);
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.3),
      background: `${color}22`, color,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Icon style={{ width: iconSize, height: iconSize }} strokeWidth={1.8} />
    </div>
  );
}

// ────────── MixDonut interactivo · click canal → filtro ──────────
function MixDonutCanal({ canales, ventaTotal, deltaTotal, anio, canalActivo, onSelect }) {
  const { theme } = useTheme();
  const [hover, setHover] = useState(null);
  const items = [...(canales || [])].filter((c) => (c.venta || 0) > 0);
  if (!items.length) {
    return (
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 24, color: theme.textMuted, fontFamily: TYPO.fontText, textAlign: 'center', fontSize: 13 }}>
        Sin datos de canal.
      </div>
    );
  }
  const total = items.reduce((s, it) => s + (it.venta || 0), 0) || 1;
  const R = 42, CIRC = 2 * Math.PI * R;
  let offsetAcc = 0;
  const arcs = items.map((it, i) => {
    const pct = (it.venta || 0) / total;
    const len = pct * CIRC;
    const dash = `${len} ${CIRC}`;
    const dashOffset = -offsetAcc;
    offsetAcc += len;
    return { key: it.canal, color: colorCanalIOS(theme, it.canal, i), dash, dashOffset };
  });
  const green = theme.green || '#34C759';
  const red = theme.red || '#FF3B30';
  const activo = canalActivo && canalActivo !== 'TODOS' ? canalActivo : null;

  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16,
      padding: '14px 18px', fontFamily: TYPO.fontText,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <h4 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, margin: 0 }}>Mix por canal.</h4>
        <span style={{ fontSize: 10, color: theme.textMuted }}>{items.length} activos · click filtra</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '132px 1fr', gap: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 132, height: 132 }}>
          <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            <circle cx="50" cy="50" r={R} fill="none" stroke={theme.border} strokeWidth="10" />
            {arcs.map((a) => {
              const active = hover === a.key || activo === a.key;
              const other = (hover || activo) && !active;
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
              const sel = items.find((c) => c.canal === (hover || activo));
              if (sel) {
                const pct = ((sel.venta || 0) / total) * 100;
                return (
                  <>
                    <div style={{ fontSize: 9, color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{sel.canal}</div>
                    <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.03em', color: theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmtCompact(sel.venta)}</div>
                    <div style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{pct.toFixed(1)}% del total</div>
                  </>
                );
              }
              return (
                <>
                  <div style={{ fontSize: 9, color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total YTD</div>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.03em', color: theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmtCompact(ventaTotal)}</div>
                  {deltaTotal != null && (
                    <div style={{ fontSize: 10, fontVariantNumeric: 'tabular-nums', marginTop: 2, color: deltaTotal >= 0 ? green : red, fontWeight: 500 }}>
                      {deltaTotal >= 0 ? '↑' : '↓'} {Math.abs(deltaTotal).toFixed(1)}% vs {anio - 1}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 2 }}>
          {items.map((it, i) => {
            const col = colorCanalIOS(theme, it.canal, i);
            const pct = ((it.venta || 0) / total) * 100;
            const active = hover === it.canal || activo === it.canal;
            const dim = (hover || activo) && !active;
            return (
              <div key={it.canal}
                onMouseEnter={() => setHover(it.canal)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect(it.canal)}
                style={{
                  display: 'grid', gridTemplateColumns: '14px 8px minmax(0, 1fr) 60px 70px 42px', alignItems: 'center', gap: 8,
                  padding: '4px 4px', borderRadius: 8, cursor: 'pointer',
                  background: active ? (theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)') : 'transparent',
                  opacity: dim ? 0.5 : 1, transition: 'background 120ms, opacity 120ms',
                }}>
                <span style={{ fontSize: 10, color: theme.textSubtle, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>#{i + 1}</span>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: col }} />
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0 }}>
                  <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 500, color: theme.text, textTransform: 'uppercase', letterSpacing: '-0.005em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.canal}</span>
                  <span style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>· {pct.toFixed(1)}%</span>
                </span>
                <div style={{ height: 3, borderRadius: 999, background: theme.border, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(2, pct)}%`, background: col, borderRadius: 999 }} />
                </div>
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums', textAlign: 'right', letterSpacing: '-0.01em' }}>{fmtCompact(it.venta)}</span>
                <span style={{ fontSize: 10, fontWeight: 500, color: it.deltaYoY == null ? theme.textMuted : it.deltaYoY >= 0 ? green : red, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {it.deltaYoY == null ? '' : `${it.deltaYoY >= 0 ? '↑' : '↓'}${Math.abs(it.deltaYoY).toFixed(0)}%`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ────────── AreaChart Apple Health tendencia mensual ──────────
function TendenciaMensualArea({ data, anio }) {
  const { theme } = useTheme();
  const blue = theme.accent || '#007AFF';
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '14px 18px', fontFamily: TYPO.fontText, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h4 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, margin: 0 }}>Facturación mensual · vs {anio - 1}.</h4>
        <div style={{ display: 'inline-flex', gap: 10, fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 2, borderRadius: 1, background: blue }} />{anio}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 2, borderRadius: 1, background: theme.textMuted, opacity: 0.55 }} />{anio - 1}</span>
        </div>
      </div>
      <div style={{ width: '100%', height: 150, flex: 1 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 6, right: 4, left: -6, bottom: 0 }}>
            <defs>
              <linearGradient id="fillAnalisis" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={blue} stopOpacity={0.18} />
                <stop offset="100%" stopColor={blue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={theme.border} vertical={false} strokeOpacity={0.6} />
            <XAxis dataKey="mes" tick={{ fontSize: 9, fill: theme.textMuted }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tickFormatter={(v) => v == null ? '' : (v/1e6 >= 1 ? '$' + (v/1e6).toFixed(0) + 'M' : '$' + (v/1e3).toFixed(0) + 'K')} tick={{ fontSize: 9, fill: theme.textMuted }} axisLine={false} tickLine={false} width={38} />
            <Tooltip formatter={(v) => v != null ? fmtMoney(v) : '—'} contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }} labelStyle={{ color: theme.textMuted, fontWeight: 500 }} />
            <Area type="monotone" dataKey="anterior" name={`${anio - 1}`} stroke={theme.textMuted} strokeOpacity={0.55} strokeWidth={1.4} fill="none" dot={false} isAnimationActive={false} />
            <Area type="monotone" dataKey="actual"   name={`${anio}`}     stroke={blue} strokeWidth={2.2} fill="url(#fillAnalisis)" dot={false} activeDot={{ r: 4, fill: theme.surface, stroke: blue, strokeWidth: 2 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Reglas de canonización: muchos canales (MOSTRADOR, E-COMMERCE) tienen
// un cliente_nombre distinto por venta. Se colapsan a entidades reales.
//   - MOSTRADOR  → todo el canal a "Mostrador"
//   - E-COMMERCE → match por substring del nombre a 4 marketplaces conocidos
//                  (Mercado Libre / Amazon / Sitio Web / Cyberpuerta), resto → "Otros e-commerce"
//   - Resto      → cliente_nombre tal cual
const ECOM_RULES = [
  { match: ['MERCADO LIBRE', 'MERCADOLIBRE', 'MELI', 'PUBLICO GENERAL MERCADO LIBRE'], nombre: 'MERCADO LIBRE' },
  { match: ['AMAZON', 'VENTA EN LINEA AMAZON'], nombre: 'AMAZON' },
  { match: ['CYBERPU'], nombre: 'CYBERPUERTA' },
  { match: ['SITIO WEB', 'SITIOWEB', 'PAGINA WEB', 'PÁGINA WEB', 'TIENDA EN LINEA', 'TIENDA EN LÍNEA'], nombre: 'SITIO WEB' },
];
// Alias de ERP → nombre comercial conocido (no son canales agregados, solo display)
const ALIAS_ERP = {
  'PC ONLINE': 'PCEL',
  'API GLOBAL': 'DIGITALIFE',
};
const clienteCanonico = (clienteNombre, canal) => {
  const c = String(canal || '').toUpperCase();
  const n = String(clienteNombre || '').toUpperCase().trim();
  if (c === 'MOSTRADOR') return 'MOSTRADOR';
  if (c === 'E-COMMERCE') {
    for (const r of ECOM_RULES) {
      if (r.match.some((m) => n.includes(m))) return r.nombre;
    }
    return 'OTROS E-COMMERCE';
  }
  if (ALIAS_ERP[n]) return ALIAS_ERP[n];
  return clienteNombre || '';
};
const esColapsado = (nombre, canal) => {
  const c = String(canal || '').toUpperCase();
  return c === 'MOSTRADOR' || c === 'E-COMMERCE';
};
// Para la query del modal: dado el cliente canónico, devuelve los predicados
// que matchean a las filas raw de facturacion_clientes.
const filtroRawParaCanonico = (nombreCanonico, canal) => {
  const c = String(canal || '').toUpperCase();
  if (c === 'MOSTRADOR') return { canal: 'MOSTRADOR' };
  if (c === 'E-COMMERCE') {
    const regla = ECOM_RULES.find((r) => r.nombre === nombreCanonico);
    if (regla) return { canal: 'E-COMMERCE', ilike: regla.match };
    return { canal: 'E-COMMERCE', excludeIlike: ECOM_RULES.flatMap((r) => r.match) };
  }
  // Revertir alias: si el canónico vino de un alias, busca el nombre ERP original
  const inverso = Object.entries(ALIAS_ERP).find(([, v]) => v === nombreCanonico);
  return { clienteExacto: inverso ? inverso[0] : nombreCanonico };
};
const chipCanal = (canal) => {
  const s = String(canal || '').toUpperCase();
  if (s.startsWith('DISTRIBU')) return 'DIST';
  if (s.startsWith('MAYO')) return 'MAYO';
  if (s.startsWith('RETAIL')) return 'RETAIL';
  if (s.startsWith('E-COM') || s === 'MERCADO LIBRE' || s === 'AMAZON') return 'E-COM';
  if (s.startsWith('MOSTRA')) return 'MOST';
  if (s.startsWith('SITIO')) return 'WEB';
  return s.slice(0, 6);
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
const fmtPctDelta = (n) => n == null || isNaN(n) ? '—' : (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
const fmtPct = (n) => n == null || isNaN(n) ? '—' : n.toFixed(1) + '%';
const fmtInt = (n) => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('es-MX');

export default function AnalisisClientesGlobal() {
  const { theme } = useTheme();
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [aniosDisponibles, setAniosDisponibles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [canalAct, setCanalAct] = useState([]);
  const [canalPrev, setCanalPrev] = useState([]);
  const [clientesAct, setClientesAct] = useState([]);
  const [clientesPrev, setClientesPrev] = useState([]);
  const [clientesMes, setClientesMes] = useState([]);
  const [cuotas, setCuotas] = useState([]);

  const [busqueda, setBusqueda] = useState('');
  const [canalFiltro, setCanalFiltro] = useState('TODOS');
  const [orden, setOrden] = useState('ytd');
  const [limite, setLimite] = useState(60);
  const [clienteAbierto, setClienteAbierto] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('v_vision_factura_canal').select('anio').order('anio', { ascending: false });
      const unique = Array.from(new Set((data || []).map((r) => r.anio))).sort((a, b) => b - a);
      setAniosDisponibles(unique);
      if (unique.length > 0 && !unique.includes(anio)) setAnio(unique[0]);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    setClienteAbierto(null);
    (async () => {
      const mesActualAprox = new Date().getMonth() + 1;
      const PAGE = 1000;
      const pageAll = async (table, anioVal) => {
        let acc = [];
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from(table).select('*').eq('anio', anioVal)
            .range(from, from + PAGE - 1);
          if (error || !data || data.length === 0) break;
          acc = acc.concat(data);
          if (data.length < PAGE) break;
          from += PAGE;
        }
        return acc;
      };
      const [a, p, c, cp, q] = await Promise.all([
        pageAll('v_vision_factura_canal', anio),
        pageAll('v_vision_factura_canal', anio - 1),
        pageAll('v_vision_factura_clientes', anio),
        pageAll('v_vision_factura_clientes', anio - 1),
        supabase.from('cuotas_canales').select('*').eq('anio', anio).then((r) => r.data || []),
      ]);
      setCanalAct(a);
      setCanalPrev(p);
      setClientesAct(c);
      setClientesPrev(cp);
      setCuotas(q);

      const mesMaxCanal = Math.max(...(a.map((r) => Number(r.mes)).filter(Boolean)), 0) || mesActualAprox;
      let acc = [];
      let fromMes = 0;
      while (true) {
        const { data: page, error } = await supabase
          .from('facturacion_clientes')
          .select('cliente_nombre, monto, canal')
          .eq('anio', anio)
          .eq('mes', mesMaxCanal)
          .range(fromMes, fromMes + PAGE - 1);
        if (error || !page || page.length === 0) break;
        acc = acc.concat(page);
        if (page.length < PAGE) break;
        fromMes += PAGE;
      }
      setClientesMes(acc);
      setLoading(false);
    })();
  }, [anio]);

  const mesMax = useMemo(() => {
    let m = 0;
    canalAct.forEach((r) => { if (Number(r.mes) > m) m = Number(r.mes); });
    return m || 12;
  }, [canalAct]);

  const kpis = useMemo(() => {
    const ventaYTD = canalAct.filter((r) => Number(r.mes) <= mesMax).reduce((s, r) => s + (Number(r.venta) || 0), 0);
    const ventaYTDPrev = canalPrev.filter((r) => Number(r.mes) <= mesMax).reduce((s, r) => s + (Number(r.venta) || 0), 0);
    const ventaMes = canalAct.filter((r) => Number(r.mes) === mesMax).reduce((s, r) => s + (Number(r.venta) || 0), 0);
    const ventaMesPrev = canalPrev.filter((r) => Number(r.mes) === mesMax).reduce((s, r) => s + (Number(r.venta) || 0), 0);
    const activos = new Set(
      clientesAct.map((c) => clienteCanonico(c.cliente_nombre, c.canal)).filter(Boolean)
    ).size;
    const total = activos;
    const cuotaTotal = cuotas.find((c) => c.dimension_tipo === 'TOTAL')?.meta_facturacion;
    const cumpl = cuotaTotal > 0 ? (ventaYTD / cuotaTotal) * 100 : null;
    const gap = cuotaTotal > 0 ? cuotaTotal - ventaYTD : null;
    return {
      ventaYTD, ventaMes, ventaMesPrev, ventaYTDPrev,
      deltaYTD: ventaYTDPrev > 0 ? ((ventaYTD - ventaYTDPrev) / ventaYTDPrev) * 100 : null,
      deltaMes: ventaMesPrev > 0 ? ((ventaMes - ventaMesPrev) / ventaMesPrev) * 100 : null,
      activos, total, cuotaTotal, cumpl, gap,
    };
  }, [canalAct, canalPrev, clientesAct, cuotas, mesMax]);

  const yoyMensual = useMemo(() => {
    const sumarPorMes = (rows) => {
      const arr = Array(12).fill(null);
      rows.forEach((r) => {
        const m = Number(r.mes);
        if (m < 1 || m > 12) return;
        arr[m - 1] = (arr[m - 1] || 0) + (Number(r.venta) || 0);
      });
      return arr;
    };
    const act = sumarPorMes(canalAct);
    const prv = sumarPorMes(canalPrev);
    return Array.from({ length: 12 }, (_, i) => ({
      mes: MESES_LBL[i],
      actual: act[i],
      anterior: prv[i],
    }));
  }, [canalAct, canalPrev]);

  const canales = useMemo(() => {
    const m = new Map();
    canalAct.filter((r) => Number(r.mes) <= mesMax).forEach((r) => {
      const k = r.canal || 'Otros';
      m.set(k, (m.get(k) || 0) + (Number(r.venta) || 0));
    });
    const mPrev = new Map();
    canalPrev.filter((r) => Number(r.mes) <= mesMax).forEach((r) => {
      const k = r.canal || 'Otros';
      mPrev.set(k, (mPrev.get(k) || 0) + (Number(r.venta) || 0));
    });
    const total = Array.from(m.values()).reduce((s, v) => s + v, 0);
    return Array.from(m.entries())
      .map(([canal, venta]) => {
        const prev = mPrev.get(canal) || 0;
        return {
          canal,
          venta,
          share: total > 0 ? (venta / total) * 100 : 0,
          deltaYoY: prev > 0 ? ((venta - prev) / prev) * 100 : null,
        };
      })
      .sort((a, b) => b.venta - a.venta);
  }, [canalAct, canalPrev, mesMax]);

  const mesPorCliente = useMemo(() => {
    const m = new Map();
    clientesMes.forEach((r) => {
      const k = clienteCanonico(r.cliente_nombre, r.canal);
      if (!k) return;
      m.set(k, (m.get(k) || 0) + (Number(r.monto) || 0));
    });
    return m;
  }, [clientesMes]);

  const ventaTotalAct = useMemo(() =>
    clientesAct.reduce((s, c) => s + (Number(c.venta) || 0), 0), [clientesAct]);

  const clientesRanking = useMemo(() => {
    // Agregar año actual: si el canal está en CANALES_AGREGADOS, todos colapsan a un solo "cliente"
    const actMap = new Map();
    clientesAct.forEach((c) => {
      const nombre = clienteCanonico(c.cliente_nombre, c.canal);
      if (!nombre || nombre === 'Sin nombre') return;
      const k = nombre;
      if (!actMap.has(k)) actMap.set(k, { cliente: nombre, canal: c.canal || 'Otros', ytd: 0 });
      actMap.get(k).ytd += Number(c.venta) || 0;
    });
    const prevMap = new Map();
    clientesPrev.forEach((c) => {
      const nombre = clienteCanonico(c.cliente_nombre, c.canal);
      if (!nombre) return;
      prevMap.set(nombre, (prevMap.get(nombre) || 0) + (Number(c.venta) || 0));
    });
    let lista = Array.from(actMap.values()).map((c) => {
      const ytdPrev = prevMap.get(c.cliente) || 0;
      return {
        cliente: c.cliente,
        canal: c.canal,
        ytd: c.ytd,
        mes: mesPorCliente.get(c.cliente) || 0,
        ytdPrev,
        deltaYoY: ytdPrev > 0 ? ((c.ytd - ytdPrev) / ytdPrev) * 100 : null,
        share: ventaTotalAct > 0 ? (c.ytd / ventaTotalAct) * 100 : 0,
      };
    });
    if (canalFiltro !== 'TODOS') {
      lista = lista.filter((c) => c.canal === canalFiltro);
    }
    if (busqueda.trim()) {
      const q = busqueda.trim().toUpperCase();
      lista = lista.filter((c) => c.cliente.toUpperCase().includes(q));
    }
    lista.sort((a, b) => orden === 'mes' ? b.mes - a.mes : b.ytd - a.ytd);
    return lista;
  }, [clientesAct, clientesPrev, mesPorCliente, ventaTotalAct, canalFiltro, busqueda, orden]);

  const canalesOpciones = useMemo(() =>
    Array.from(new Set(clientesAct.map((c) => c.canal).filter(Boolean))).sort()
  , [clientesAct]);

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: theme.textMuted, background: theme.bg, minHeight: '100%', fontFamily: TYPO.fontText }}>
        <Activity style={{ width: 40, height: 40, margin: '0 auto 12px', color: theme.textSubtle, strokeWidth: 1.5 }} />
        Cargando análisis por cliente…
      </div>
    );
  }
  if (canalAct.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: theme.textMuted, background: theme.bg, minHeight: '100%', fontFamily: TYPO.fontText }}>
        <Users style={{ width: 48, height: 48, color: theme.textSubtle, margin: '0 auto 16px', strokeWidth: 1.5 }} />
        <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.text, marginBottom: 8, fontFamily: TYPO.fontDisplay, letterSpacing: '-0.02em' }}>Análisis por cliente</h2>
        <p>No hay datos para {anio}. Sube el archivo ERP en /uploads.html.</p>
      </div>
    );
  }

  return (
    <div className="max-w-none mx-auto p-6 space-y-4"
      style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%' }}>
      {/* Header estilo Apple */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, padding: '0 4px', marginBottom: 4 }}>
        <div>
          <p style={{
            fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em',
            color: theme.textMuted, marginBottom: 4, fontFamily: TYPO.fontText, fontWeight: 500,
          }}>
            Dirección Comercial · YTD ene–{MESES_LBL[mesMax - 1]} {anio}
          </p>
          <h2 style={{
            fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em',
            fontFamily: TYPO.fontDisplay, color: theme.text, margin: 0, lineHeight: 1.1,
          }}>Análisis por cliente.</h2>
          <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 4, fontFamily: TYPO.fontText, fontVariantNumeric: 'tabular-nums' }}>
            {kpis.activos.toLocaleString('es-MX')} clientes activos generaron {fmtCompact(kpis.ventaYTD)} este año.
          </p>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 11, color: theme.textMuted, fontFamily: TYPO.fontText }}>
          Año
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}
            style={{
              border: `1px solid ${theme.border}`, borderRadius: 999,
              padding: '8px 16px', fontSize: 14, marginTop: 4,
              background: theme.surface, color: theme.text,
              fontFamily: TYPO.fontText,
            }}>
            {aniosDisponibles.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      {/* Buscador apple.com pill + filtro de canal */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px',
          background: theme.surface, border: `1px solid ${theme.border}`,
          borderRadius: 999, height: 40, fontFamily: TYPO.fontText,
        }}>
          <Search style={{ width: 16, height: 16, color: theme.textMuted, flexShrink: 0 }} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar cliente (CT INTERNACIONAL, DICOTECH, PCEL…)"
            style={{
              flex: 1, outline: 'none', fontSize: 14, background: 'transparent',
              border: 'none', color: theme.text, fontFamily: 'inherit',
            }}
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: theme.textMuted, padding: 4,
            }}>
              <X style={{ width: 16, height: 16 }} />
            </button>
          )}
        </div>
        <select
          value={canalFiltro}
          onChange={(e) => setCanalFiltro(e.target.value)}
          style={{
            height: 40, padding: '0 16px',
            border: `1px solid ${theme.border}`, borderRadius: 999,
            fontSize: 13, background: theme.surface, color: theme.text,
            fontFamily: TYPO.fontText, cursor: 'pointer',
          }}
        >
          <option value="TODOS">Todos los canales</option>
          {canalesOpciones.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* KPI row Compacto B · 4 cards ~56px, Cumpl. cuota inverse */}
      {(() => {
        const isDark = theme.mode === 'dark';
        const invBg = theme.surfaceInverse || (isDark ? '#F5F5F7' : '#000000');
        const invText = theme.textOnInverse || (isDark ? '#1D1D1F' : '#F5F5F7');
        const invMuted = isDark ? 'rgba(29,29,31,0.72)' : 'rgba(245,245,247,0.72)';
        const green = theme.green || '#34C759';
        const red = theme.red || '#FF3B30';
        const KpiCard = ({ inverse, Icon, badgeCol, lbl, val, delta, deltaCol, sub, warning }) => (
          <div style={{
            background: inverse ? invBg : theme.surface,
            color: inverse ? invText : theme.text,
            border: inverse ? 'none' : `1px solid ${theme.border}`,
            borderRadius: 14, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10,
            minHeight: 56, fontFamily: TYPO.fontText,
          }}>
            <IconBadge icon={Icon} color={badgeCol} size={26} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, margin: 0, color: inverse ? invMuted : theme.textMuted }}>{lbl}</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
                <p style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: warning ? (theme.orange || '#FF9500') : (inverse ? invText : theme.text) }}>{val}</p>
                {delta && <span style={{ fontSize: 11, fontWeight: 500, color: deltaCol, fontVariantNumeric: 'tabular-nums' }}>{delta}</span>}
                {sub && !delta && <span style={{ fontSize: 11, color: inverse ? invMuted : theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{sub}</span>}
              </div>
            </div>
          </div>
        );
        return (
          <div className="grid grid-cols-4 gap-2.5">
            <KpiCard Icon={Calendar} badgeCol={theme.orange || '#FF9500'}
              lbl={`Facturación ${MESES_LBL[mesMax - 1]} · YoY`}
              val={fmtCompact(kpis.ventaMes)}
              delta={kpis.deltaMes != null ? `${kpis.deltaMes >= 0 ? '↑' : '↓'}${Math.abs(kpis.deltaMes).toFixed(1)}%` : null}
              deltaCol={kpis.deltaMes == null ? theme.textMuted : kpis.deltaMes >= 0 ? green : red}
            />
            <KpiCard Icon={TrendingUp} badgeCol={theme.accent || '#007AFF'}
              lbl={`YTD ${anio} · vs ${anio - 1}`}
              val={fmtCompact(kpis.ventaYTD)}
              delta={kpis.deltaYTD != null ? `${kpis.deltaYTD >= 0 ? '↑' : '↓'}${Math.abs(kpis.deltaYTD).toFixed(1)}%` : null}
              deltaCol={kpis.deltaYTD == null ? theme.textMuted : kpis.deltaYTD >= 0 ? green : red}
            />
            <KpiCard Icon={Users} badgeCol={theme.purple || '#AF52DE'}
              lbl={`Clientes activos · de ${kpis.total.toLocaleString('es-MX')}`}
              val={kpis.activos.toLocaleString('es-MX')}
              sub="en cartera"
            />
            <KpiCard inverse Icon={Target}
              badgeCol={isDark ? theme.orange : '#FFB454'}
              lbl="Cumplimiento cuota anual"
              val={kpis.cumpl != null ? fmtPct(kpis.cumpl) : 'Pendiente'}
              sub={kpis.gap > 0 ? `Faltan ${fmtCompact(kpis.gap)}` : 'sin cuota'}
              warning={kpis.cumpl != null && kpis.cumpl < 80}
            />
          </div>
        );
      })()}

      {/* Row 2-col: Mix donut interactivo + Tendencia mensual area */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)', gap: 10 }}>
        <MixDonutCanal
          canales={canales}
          ventaTotal={kpis.ventaYTD}
          deltaTotal={kpis.deltaYTD}
          anio={anio}
          canalActivo={canalFiltro}
          onSelect={(k) => setCanalFiltro(canalFiltro === k ? 'TODOS' : k)}
        />
        <TendenciaMensualArea data={yoyMensual} anio={anio} />
      </div>

      {/* Clientes ranking */}
      <div className="flex items-baseline justify-between mt-2 px-1">
        <h3 className="text-sm font-medium text-gray-800">
          Todos los clientes
          {canalFiltro !== 'TODOS' && (
            <span className="ml-2 text-xs font-normal text-gray-500">· {canalFiltro}</span>
          )}
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-400">
            Mostrando {Math.min(limite, clientesRanking.length).toLocaleString('es-MX')} de {clientesRanking.length.toLocaleString('es-MX')}
          </span>
          <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setOrden('ytd')}
              className={`px-2.5 py-1 rounded text-xs ${orden === 'ytd' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
            >YTD</button>
            <button
              onClick={() => setOrden('mes')}
              className={`px-2.5 py-1 rounded text-xs ${orden === 'mes' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
            >Mes</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2.5">
        {clientesRanking.slice(0, limite).map((c, i) => (
          <TarjetaCliente
            key={c.cliente}
            ranking={i + 1}
            cliente={c}
            onClick={() => setClienteAbierto({ cliente: c.cliente, canal: c.canal })}
          />
        ))}
      </div>

      {clientesRanking.length > limite && (
        <div className="text-center pt-2">
          <button
            onClick={() => setLimite((l) => l + 60)}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Ver más ({(clientesRanking.length - limite).toLocaleString('es-MX')} restantes)
          </button>
        </div>
      )}

      {clienteAbierto && (
        <ModalCliente
          clienteNombre={clienteAbierto.cliente}
          canalCliente={clienteAbierto.canal}
          anio={anio}
          mesMax={mesMax}
          onClose={() => setClienteAbierto(null)}
        />
      )}
    </div>
  );
}

function KpiTile({ label, valor, delta, subtitulo, esWarning }) {
  const { theme } = useTheme();
  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 12, padding: 14, fontFamily: TYPO.fontText,
    }}>
      <div style={{ fontSize: 11, color: theme.textMuted }}>{label}</div>
      <div style={{
        fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em',
        marginTop: 4, color: theme.text, fontFamily: TYPO.fontDisplay,
        fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
      }}>{valor}</div>
      <div style={{ fontSize: 11, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
        {delta != null && (
          <span style={{ color: delta >= 0 ? theme.green : theme.red, fontWeight: 500 }}>
            {delta >= 0 ? <TrendingUp className="w-3 h-3 inline -mt-0.5" /> : <TrendingDown className="w-3 h-3 inline -mt-0.5" />}
            {' '}{fmtPctDelta(delta)}
          </span>
        )}
        <span style={{ color: esWarning ? (theme.eyebrowColor || theme.orange) : theme.textMuted }}>{subtitulo}</span>
      </div>
    </div>
  );
}

function TarjetaCliente({ ranking, cliente, onClick }) {
  const { theme } = useTheme();
  const canalCol = colorCanalIOS(theme, cliente.canal, ranking - 1);
  const green = theme.green || '#34C759';
  const red = theme.red || '#FF3B30';
  const deltaCol = cliente.deltaYoY == null ? theme.textMuted
    : cliente.deltaYoY > 3 ? green
    : cliente.deltaYoY < -3 ? red
    : theme.textMuted;
  const deltaArrow = cliente.deltaYoY == null ? '' : (cliente.deltaYoY >= 0 ? '↑' : '↓');

  // Mini spark: interpola YTD prev → YTD actual con curva suave (visual, no datos por mes)
  const startY = 20;
  const endY = cliente.deltaYoY != null && cliente.deltaYoY >= 0
    ? Math.max(4, 20 - Math.min(16, Math.abs(cliente.deltaYoY) * 0.6))
    : Math.min(22, 20 + Math.min(6, Math.abs(cliente.deltaYoY || 0) * 0.15));
  const midY = (startY + endY) / 2 + (cliente.deltaYoY >= 0 ? -3 : 3);
  const sparkPath = `M0,${startY} Q60,${midY} 120,${endY}`;

  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left', background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 14, padding: '10px 12px', cursor: 'pointer', fontFamily: TYPO.fontText,
        display: 'flex', flexDirection: 'column', gap: 4, minHeight: 128,
        transition: 'border-color 160ms',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = theme.text)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = theme.border)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 10, color: theme.textSubtle, fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>#{ranking}</span>
        <span style={{ width: 6, height: 6, borderRadius: 2, background: canalCol, flexShrink: 0 }} />
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.005em', color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={cliente.cliente}>
          {cliente.cliente}
        </span>
      </div>
      <div style={{ fontSize: 9, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{cliente.canal}</div>
      <div style={{
        fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em',
        color: theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 2, lineHeight: 1,
      }}>
        {fmtCompact(cliente.ytd)}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 2, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
        {cliente.deltaYoY != null && (
          <span style={{ color: deltaCol, fontWeight: 500 }}>{deltaArrow} {Math.abs(cliente.deltaYoY).toFixed(1)}%</span>
        )}
        {cliente.deltaYoY == null && <span style={{ color: theme.textMuted }}>—</span>}
        <span style={{ color: theme.textMuted }}>vs {fmtCompact(cliente.ytdPrev)}</span>
      </div>
      <svg viewBox="0 0 120 24" style={{ display: 'block', width: '100%', height: 24, marginTop: 4 }} preserveAspectRatio="none">
        <path d={sparkPath} fill="none" stroke={canalCol} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="120" cy={endY} r="2" fill={canalCol} />
      </svg>
      <div style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginTop: 'auto' }}>
        Mes {fmtCompact(cliente.mes)} · {fmtPct(cliente.share)} del total
      </div>
    </button>
  );
}

function ModalCliente({ clienteNombre, canalCliente, anio, mesMax, onClose }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [descripciones, setDescripciones] = useState(new Map());
  const [costoPorSku, setCostoPorSku] = useState(new Map());

  useEffect(() => {
    (async () => {
      setCargando(true);
      const filtro = filtroRawParaCanonico(clienteNombre, canalCliente);
      let acc = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        let query = supabase
          .from('facturacion_clientes')
          .select('anio, mes, sku, monto, piezas, canal, cliente_nombre')
          .gte('anio', anio - 1)
          .lte('anio', anio)
          .range(from, from + PAGE - 1);
        if (filtro.clienteExacto) {
          query = query.eq('cliente_nombre', filtro.clienteExacto);
        } else if (filtro.canal) {
          query = query.eq('canal', filtro.canal);
          if (filtro.ilike && filtro.ilike.length) {
            const or = filtro.ilike.map((p) => `cliente_nombre.ilike.%${p}%`).join(',');
            query = query.or(or);
          }
        }
        const { data: page, error } = await query;
        if (error || !page || page.length === 0) break;
        let filtered = page;
        if (filtro.excludeIlike && filtro.excludeIlike.length) {
          filtered = page.filter((r) => {
            const n = String(r.cliente_nombre || '').toUpperCase();
            return !filtro.excludeIlike.some((p) => n.includes(p));
          });
        }
        acc = acc.concat(filtered);
        if (page.length < PAGE) break;
        from += PAGE;
      }
      setDatos(acc);
      setCargando(false);

      // Traer descripciones (compras_oc + embarques_compras) y costo (inventario_acteck)
      const skus = Array.from(new Set(acc.map((r) => r.sku).filter(Boolean)));
      if (skus.length === 0) return;
      const mapDesc = new Map();
      const mapCosto = new Map();
      const chunkBy = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, (i + 1) * n));
      for (const chunk of chunkBy(skus, 200)) {
        const [oc, emb, inv] = await Promise.all([
          supabase.from('compras_oc').select('articulo, descripcion').in('articulo', chunk),
          supabase.from('embarques_compras').select('codigo, descripcion').in('codigo', chunk),
          supabase.from('inventario_acteck').select('articulo, costopromedio, disponible').in('articulo', chunk),
        ]);
        (oc.data || []).forEach((r) => { if (r.descripcion && !mapDesc.has(r.articulo)) mapDesc.set(r.articulo, r.descripcion); });
        (emb.data || []).forEach((r) => { if (r.descripcion && !mapDesc.has(r.codigo)) mapDesc.set(r.codigo, r.descripcion); });
        // Costo promedio ponderado por disponible (si no hay disponible, simple avg)
        const tmp = new Map();
        (inv.data || []).forEach((r) => {
          const sku = r.articulo;
          const c = Number(r.costopromedio) || 0;
          const d = Number(r.disponible) || 0;
          if (!sku || c <= 0) return;
          if (!tmp.has(sku)) tmp.set(sku, { sumWC: 0, sumW: 0, sumC: 0, n: 0 });
          const t = tmp.get(sku);
          t.sumWC += c * d;
          t.sumW  += d;
          t.sumC  += c;
          t.n     += 1;
        });
        tmp.forEach((t, sku) => {
          const costo = t.sumW > 0 ? t.sumWC / t.sumW : t.sumC / t.n;
          mapCosto.set(sku, costo);
        });
      }
      setDescripciones(mapDesc);
      setCostoPorSku(mapCosto);
    })();
  }, [clienteNombre, canalCliente, anio]);

  const detalle = useMemo(() => {
    if (!datos) return null;
    const sumMensual = Array(12).fill(0);
    const sumMensualPrev = Array(12).fill(0);
    let canal = 'Otros';
    const skuAct = new Map();
    const skuPrev = new Map();
    const skuUlt3m = new Set();
    const mesesActivos = new Set();
    const ult3mDesde = Math.max(1, mesMax - 2);
    let costoYTD = 0;     // sum(piezas × costo[sku]) año actual hasta mesMax
    let ventaCubierta = 0; // sum(monto) del año actual hasta mesMax donde existe costo
    datos.forEach((r) => {
      const m = Number(r.mes) - 1;
      if (m < 0 || m > 11) return;
      const imp = Number(r.monto) || 0;
      const piezas = Number(r.piezas) || 0;
      if (Number(r.anio) === anio) {
        sumMensual[m] += imp;
        if (imp > 0) mesesActivos.add(m + 1);
        if (r.sku) {
          skuAct.set(r.sku, (skuAct.get(r.sku) || 0) + imp);
          if (m + 1 >= ult3mDesde && m + 1 <= mesMax && imp > 0) skuUlt3m.add(r.sku);
          // Margen
          if (m + 1 <= mesMax) {
            const costoU = costoPorSku.get(r.sku);
            if (costoU != null && costoU > 0 && piezas > 0) {
              costoYTD += costoU * piezas;
              ventaCubierta += imp;
            }
          }
        }
      } else {
        sumMensualPrev[m] += imp;
        if (r.sku) skuPrev.set(r.sku, (skuPrev.get(r.sku) || 0) + imp);
      }
      if (r.canal) canal = r.canal;
    });
    const ytd = sumMensual.slice(0, mesMax).reduce((s, v) => s + v, 0);
    const ytdPrev = sumMensualPrev.slice(0, mesMax).reduce((s, v) => s + v, 0);
    const mesActual = sumMensual[mesMax - 1] || 0;
    const mesActualPrev = sumMensualPrev[mesMax - 1] || 0;
    const cierreMesAnterior = mesMax >= 2 ? sumMensual[mesMax - 2] : null;
    const cierreMesAnteriorPrev = mesMax >= 2 ? sumMensualPrev[mesMax - 2] : null;

    // Movimiento por SKU (crecen / caen)
    const todosSkus = new Set([...skuAct.keys(), ...skuPrev.keys()]);
    const movs = [];
    todosSkus.forEach((sku) => {
      const a = skuAct.get(sku) || 0;
      const p = skuPrev.get(sku) || 0;
      const delta = a - p;
      const deltaPct = p > 0 ? ((a - p) / p) * 100 : (a > 0 ? null : null);
      movs.push({ sku, act: a, prev: p, delta, deltaPct });
    });
    const crecen = movs.filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5);
    const caen = movs.filter((m) => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5);

    const serie = Array.from({ length: 12 }, (_, i) => ({
      mes: MESES_LBL[i],
      [`${anio}`]: sumMensual[i],
      [`${anio - 1}`]: sumMensualPrev[i],
    }));
    const heatmap = Array.from({ length: 12 }, (_, i) => ({
      mes: MESES_LBL[i],
      act: sumMensual[i],
      prev: sumMensualPrev[i],
      actActivo: i + 1 <= mesMax && sumMensual[i] > 0,
      prevActivo: sumMensualPrev[i] > 0,
    }));
    // Margen: solo válido si tenemos costo para ≥50% de la venta YTD
    const coberturaCosto = ytd > 0 ? ventaCubierta / ytd : 0;
    const margenMonto = ventaCubierta - costoYTD;
    const margenPct = ventaCubierta > 0 ? (margenMonto / ventaCubierta) * 100 : null;

    return {
      canal, ytd, ytdPrev,
      mesActual, mesActualPrev,
      cierreMesAnterior, cierreMesAnteriorPrev,
      crecen, caen,
      mesesActivos: mesesActivos.size,
      skusDistintos: skuAct.size,
      skusUlt3m: skuUlt3m.size,
      serie, heatmap,
      margenPct, margenMonto, coberturaCosto,
      deltaYTD: ytdPrev > 0 ? ((ytd - ytdPrev) / ytdPrev) * 100 : null,
      deltaMes: mesActualPrev > 0 ? ((mesActual - mesActualPrev) / mesActualPrev) * 100 : null,
      deltaCierre: cierreMesAnteriorPrev > 0 ? ((cierreMesAnterior - cierreMesAnteriorPrev) / cierreMesAnteriorPrev) * 100 : null,
    };
  }, [datos, anio, mesMax, costoPorSku]);

  return <ModalClienteContent
    clienteNombre={clienteNombre} anio={anio} mesMax={mesMax} onClose={onClose}
    detalle={detalle} cargando={cargando} descripciones={descripciones}
  />;
}

function ModalClienteContent({ clienteNombre, anio, mesMax, onClose, detalle, cargando, descripciones }) {
  const { theme } = useTheme();
  const canalCol = detalle ? colorCanalIOS(theme, detalle.canal) : theme.textMuted;
  const green = theme.green || '#34C759';
  const red = theme.red || '#FF3B30';
  const share = detalle && detalle.ytd > 0 ? null : null; // share depende del total, no lo tenemos aquí; skip

  const KBox = ({ lbl, val, sub, subColor, last }) => (
    <div style={{ padding: '2px 14px', borderRight: last ? 'none' : `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column' }}>
      <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, margin: 0 }}>{lbl}</p>
      <p style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em', color: subColor || theme.text, fontVariantNumeric: 'tabular-nums', margin: '2px 0 0' }}>{val}</p>
      {sub && <p style={{ fontSize: 10, color: subColor || theme.textMuted, fontVariantNumeric: 'tabular-nums', margin: '2px 0 0' }}>{sub}</p>}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        style={{
          background: theme.surface, color: theme.text,
          border: `1px solid ${theme.border}`, borderRadius: 18,
          boxShadow: theme.mode === 'dark' ? '0 20px 60px rgba(0,0,0,0.5)' : '0 20px 60px rgba(0,0,0,0.15)',
          width: '100%', maxWidth: 960, margin: '32px 0',
          fontFamily: TYPO.fontText, overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header inline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: `1px solid ${theme.border}` }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: canalCol, flexShrink: 0 }} />
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clienteNombre}</span>
          {detalle && (
            <span style={{ fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginLeft: 4 }}>
              · {detalle.canal || '—'} · {fmtCompact(detalle.ytd)} YTD
            </span>
          )}
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'transparent', border: 0, color: theme.textMuted, cursor: 'pointer', padding: 4, lineHeight: 1 }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {cargando || !detalle ? (
          <div style={{ padding: 48, textAlign: 'center', color: theme.textMuted }}>
            <Activity style={{ width: 32, height: 32, margin: '0 auto 8px' }} />
            Cargando datos del cliente…
          </div>
        ) : (
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 4 KPIs sin bg */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <KBox
                lbl={`${MESES_FULL[mesMax - 1]} ${anio}`}
                val={fmtCompact(detalle.mesActual)}
                sub={detalle.deltaMes != null ? `${detalle.deltaMes >= 0 ? '↑' : '↓'} ${Math.abs(detalle.deltaMes).toFixed(1)}% vs ${MESES_LBL[mesMax - 1]} ${anio - 1}` : `vs ${fmtCompact(detalle.mesActualPrev)}`}
                subColor={detalle.deltaMes == null ? theme.textMuted : detalle.deltaMes >= 0 ? green : red}
              />
              <KBox
                lbl={mesMax >= 2 ? `Cierre ${MESES_FULL[mesMax - 2]}` : 'Cierre'}
                val={mesMax >= 2 ? fmtCompact(detalle.cierreMesAnterior) : '—'}
                sub={detalle.deltaCierre != null ? `${detalle.deltaCierre >= 0 ? '↑' : '↓'} ${Math.abs(detalle.deltaCierre).toFixed(1)}% YoY` : ''}
                subColor={detalle.deltaCierre == null ? theme.textMuted : detalle.deltaCierre >= 0 ? green : red}
              />
              <KBox
                lbl={`YTD ${anio}`}
                val={fmtCompact(detalle.ytd)}
                sub={detalle.deltaYTD != null ? `${detalle.deltaYTD >= 0 ? '↑' : '↓'} ${Math.abs(detalle.deltaYTD).toFixed(1)}% vs ${fmtCompact(detalle.ytdPrev)}` : `vs ${fmtCompact(detalle.ytdPrev)}`}
                subColor={detalle.deltaYTD == null ? theme.textMuted : detalle.deltaYTD >= 0 ? green : red}
              />
              <KBox
                lbl="Actividad"
                val={`${detalle.mesesActivos} meses`}
                sub={`${detalle.skusDistintos} SKUs distintos`}
                last
              />
            </div>

            {/* AreaChart Apple Health */}
            <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: theme.textMuted, fontWeight: 600, margin: 0 }}>Facturación mensual · vs {anio - 1}</p>
                <div style={{ display: 'inline-flex', gap: 10, fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 2, borderRadius: 1, background: canalCol }} />{anio}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 2, borderRadius: 1, background: theme.textMuted, opacity: 0.55 }} />{anio - 1}</span>
                </div>
              </div>
              <div style={{ width: '100%', height: 148 }}>
                <ResponsiveContainer>
                  <AreaChart data={detalle.serie} margin={{ top: 6, right: 4, left: -6, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`fillCli-${String(clienteNombre).replace(/\W/g, '').slice(0, 20)}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={canalCol} stopOpacity={0.20} />
                        <stop offset="100%" stopColor={canalCol} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={theme.border} vertical={false} strokeOpacity={0.6} />
                    <XAxis dataKey="mes" tick={{ fontSize: 9, fill: theme.textMuted }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tickFormatter={(v) => v == null ? '' : (v/1e6 >= 1 ? '$' + (v/1e6).toFixed(0) + 'M' : '$' + (v/1e3).toFixed(0) + 'K')} tick={{ fontSize: 9, fill: theme.textMuted }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip formatter={(v) => v != null ? fmtMoney(v) : '—'} contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }} labelStyle={{ color: theme.textMuted, fontWeight: 500 }} />
                    <Area type="monotone" dataKey={`${anio - 1}`} stroke={theme.textMuted} strokeOpacity={0.55} strokeWidth={1.4} fill="none" dot={false} isAnimationActive={false} />
                    <Area type="monotone" dataKey={`${anio}`}     stroke={canalCol} strokeWidth={2.2} fill={`url(#fillCli-${String(clienteNombre).replace(/\W/g, '').slice(0, 20)})`} dot={false} activeDot={{ r: 4, fill: theme.surface, stroke: canalCol, strokeWidth: 2 }} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3 KPIs secundarios sin bg */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <KBox
                lbl="SKUs facturados últ. 3 meses"
                val={fmtInt(detalle.skusUlt3m)}
                sub={`${MESES_LBL[Math.max(0, mesMax - 3)]}–${MESES_LBL[mesMax - 1]} ${anio}`}
              />
              {detalle.margenPct != null && detalle.coberturaCosto >= 0.2 ? (
                <KBox
                  lbl="Margen promedio YTD"
                  val={fmtPct(detalle.margenPct)}
                  sub={`${fmtCompact(detalle.margenMonto)} · cobertura ${fmtPct(detalle.coberturaCosto * 100)}`}
                />
              ) : (
                <div style={{ padding: '2px 14px', borderRight: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column' }}>
                  <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, margin: 0 }}>Margen promedio YTD</p>
                  <p style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 500, letterSpacing: '-0.02em', color: theme.textMuted, margin: '2px 0 0' }}>Próximamente</p>
                  <p style={{ fontSize: 10, color: theme.textMuted, fontStyle: 'italic', margin: '2px 0 0' }}>
                    {detalle.coberturaCosto > 0 ? `Cobertura ${fmtPct(detalle.coberturaCosto * 100)}` : 'Sin costo en inventario'}
                  </p>
                </div>
              )}
              <div style={{ padding: '2px 14px', display: 'flex', flexDirection: 'column' }}>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, margin: 0 }}>Categorías más fuertes</p>
                <p style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 500, letterSpacing: '-0.02em', color: theme.textMuted, margin: '2px 0 0' }}>Próximamente</p>
                <p style={{ fontSize: 10, color: theme.textMuted, fontStyle: 'italic', margin: '2px 0 0' }}>Pendiente familia SKU</p>
              </div>
            </div>

            {/* Calendario heatmap 12 meses */}
            <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: theme.textMuted, fontWeight: 600, margin: 0 }}>Frecuencia mensual</p>
                <span style={{ fontSize: 10, color: theme.textMuted }}>Compró {detalle.mesesActivos} de {mesMax} meses transcurridos</span>
              </div>
              <FrecuenciaCalendarioApple heatmap={detalle.heatmap} mesMax={mesMax} anio={anio} canalCol={canalCol} />
            </div>

            {/* SKUs crecen / caen */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '12px 16px' }}>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: theme.textMuted, fontWeight: 600, margin: '0 0 8px' }}>
                  <span style={{ color: green, marginRight: 4 }}>▲</span> Top SKUs que más crecen
                </p>
                {detalle.crecen.length === 0 ? (
                  <p style={{ fontSize: 11, color: theme.textMuted, margin: 0 }}>Sin movimiento positivo este año.</p>
                ) : (
                  <SkuListApple items={detalle.crecen} descripciones={descripciones} positivo />
                )}
              </div>
              <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '12px 16px' }}>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: theme.textMuted, fontWeight: 600, margin: '0 0 8px' }}>
                  <span style={{ color: red, marginRight: 4 }}>▼</span> Top SKUs que más caen
                </p>
                {detalle.caen.length === 0 ? (
                  <p style={{ fontSize: 11, color: theme.textMuted, margin: 0 }}>Sin caídas este año.</p>
                ) : (
                  <SkuListApple items={detalle.caen} descripciones={descripciones} positivo={false} />
                )}
              </div>
            </div>

            {/* Placeholders futuros */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: theme.surface, border: `1px dashed ${theme.border}`, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                <p style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, margin: 0 }}>Inventario del cliente</p>
                <p style={{ fontSize: 11, color: theme.textMuted, margin: '4px 0 0', fontStyle: 'italic' }}>Stock en piso de venta · pendiente ingesta por cliente</p>
              </div>
              <div style={{ background: theme.surface, border: `1px dashed ${theme.border}`, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                <p style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, margin: 0 }}>Sell Out del cliente</p>
                <p style={{ fontSize: 11, color: theme.textMuted, margin: '4px 0 0', fontStyle: 'italic' }}>Ventas al consumidor final · pendiente integración</p>
              </div>
            </div>

            <p style={{ fontSize: 10, color: theme.textMuted, margin: 0, padding: '0 4px', fontStyle: 'italic', textAlign: 'center' }}>
              Cuota anual por cliente: pendiente de cargar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProximoKpi({ label, nota }) {
  return (
    <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-3">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-base font-medium mt-0.5 text-gray-400">Próximamente</div>
      <div className="text-[11px] text-gray-400 mt-1">{nota}</div>
    </div>
  );
}

function FrecuenciaCalendario({ heatmap, mesMax, anio, pal }) {
  return (
    <div className="grid grid-cols-12 gap-1.5">
      {heatmap.map((h, i) => {
        const esFuturo = i + 1 > mesMax;
        const compro = h.act > 0;
        const comproPrev = h.prev > 0;
        return (
          <div key={i} className="flex flex-col items-center text-center">
            <div className="text-[10px] text-gray-500 mb-1">{MESES_LBL[i]}</div>
            <div
              className="w-full rounded-lg py-1.5 px-1 text-[10px] font-medium"
              style={{
                background: esFuturo ? '#F8F8F6' : compro ? pal.bg : '#F1EFE8',
                color: esFuturo ? '#B4B2A9' : compro ? pal.text : '#888780',
                border: esFuturo ? '1px dashed #D3D1C7' : 'none',
              }}
              title={esFuturo ? 'No transcurrido' : compro ? `${anio}: ${fmtMoney(h.act)}` : 'Sin compra'}
            >
              {esFuturo ? '—' : compro ? fmtCompact(h.act) : '·'}
            </div>
            <div
              className="text-[9px] mt-0.5 text-gray-500"
              title={`${anio - 1}: ${fmtMoney(h.prev)}`}
            >
              {comproPrev ? fmtCompact(h.prev) : '·'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProximoBloque({ titulo, nota }) {
  return (
    <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4">
      <div className="text-sm font-medium text-gray-500">{titulo}</div>
      <div className="text-xs text-gray-400 mt-1.5">Próximamente</div>
      <div className="text-[11px] text-gray-400 mt-2 leading-relaxed">{nota}</div>
    </div>
  );
}

// ────────── Calendario iOS · 12 meses con intensidad por venta ──────────
function FrecuenciaCalendarioApple({ heatmap, mesMax, anio, canalCol }) {
  const { theme } = useTheme();
  const pastMax = Math.max(...heatmap.slice(0, mesMax).map((h) => Number(h.act) || 0), 1);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4 }}>
      {heatmap.map((h, i) => {
        const esFuturo = i + 1 > mesMax;
        const val = Number(h.act) || 0;
        const intensidad = val > 0 ? Math.max(0.12, Math.min(1, val / pastMax)) : 0;
        const superFuerte = intensidad >= 0.65;
        return (
          <div key={i} style={{
            position: 'relative', aspectRatio: '1 / 1', borderRadius: 8,
            background: esFuturo ? 'transparent' : (val > 0 ? `${canalCol}${Math.round(intensidad * 100).toString(16).padStart(2, '0')}` : theme.border),
            border: esFuturo ? `1px dashed ${theme.border}` : 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            opacity: esFuturo ? 0.5 : 1, fontVariantNumeric: 'tabular-nums',
          }} title={esFuturo ? 'No transcurrido' : val > 0 ? `${MESES_FULL[i]} ${anio}: ${fmtMoney(val)}` : 'Sin compra'}>
            <span style={{ fontSize: 9, color: superFuerte ? '#fff' : theme.textMuted, fontWeight: 600 }}>{MESES_LBL[i]}</span>
            {!esFuturo && val > 0 && (
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, color: superFuerte ? '#fff' : theme.text }}>
                {fmtCompact(val)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ────────── SkuList Apple compacto ──────────
function SkuListApple({ items, descripciones, positivo }) {
  const { theme } = useTheme();
  const green = theme.green || '#34C759';
  const red = theme.red || '#FF3B30';
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {items.map((s, i) => {
        const desc = descripciones.get(s.sku);
        const nombre = desc ? `${s.sku} · ${desc}` : s.sku;
        return (
          <div key={s.sku} style={{ display: 'grid', gridTemplateColumns: '14px minmax(0, 1fr) 70px 50px', alignItems: 'center', gap: 8, padding: '3px 4px', borderRadius: 6 }}>
            <span style={{ fontSize: 9, color: theme.textSubtle, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
            <span style={{ fontFamily: '-apple-system, "SF Mono", ui-monospace, monospace', fontSize: 11, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={nombre}>{nombre}</span>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', color: positivo ? green : red }}>
              {positivo ? '+' : ''}{fmtCompact(s.delta)}
            </span>
            <span style={{ fontSize: 10, fontWeight: 500, color: positivo ? green : red, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {s.deltaPct != null ? `${s.deltaPct >= 0 ? '↑' : '↓'}${Math.abs(s.deltaPct).toFixed(0)}%` : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SkuList({ items, descripciones, positivo }) {
  return (
    <div className="space-y-2">
      {items.map((s) => {
        const desc = descripciones.get(s.sku);
        const sign = positivo ? '+' : '';
        return (
          <div key={s.sku} className="text-xs">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="font-mono text-gray-700 truncate">{s.sku}</span>
              <span className={`font-medium shrink-0 ${positivo ? 'text-emerald-700' : 'text-rose-700'}`}>
                {sign}{fmtCompact(s.delta)}
              </span>
            </div>
            {desc && (
              <div className="text-[10px] text-gray-500 truncate" title={desc}>{desc}</div>
            )}
            <div className="text-[10px] text-gray-400 flex justify-between">
              <span>{fmtCompact(s.act)} este año</span>
              <span>{fmtCompact(s.prev)} año anterior</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
