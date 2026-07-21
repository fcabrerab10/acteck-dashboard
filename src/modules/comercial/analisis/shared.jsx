// Shared para los 3 layouts de Análisis por Cliente (global).
// Hook + formatters + componentes comunes.
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { TYPO } from '../../../lib/themeTokens';

export const MESES_LBL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
export const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Canonización cliente + canal (heredada del legacy)
const ECOM_RULES = [
  { match: ['MERCADO LIBRE', 'MERCADOLIBRE', 'MELI', 'PUBLICO GENERAL MERCADO LIBRE'], nombre: 'MERCADO LIBRE' },
  { match: ['AMAZON', 'VENTA EN LINEA AMAZON'], nombre: 'AMAZON' },
  { match: ['CYBERPU'], nombre: 'CYBERPUERTA' },
  { match: ['SITIO WEB', 'SITIOWEB', 'PAGINA WEB', 'PÁGINA WEB', 'TIENDA EN LINEA', 'TIENDA EN LÍNEA'], nombre: 'SITIO WEB' },
];
const ALIAS_ERP = { 'PC ONLINE': 'PCEL', 'API GLOBAL': 'DIGITALIFE' };

export const clienteCanonico = (clienteNombre, canal) => {
  const c = String(canal || '').toUpperCase();
  const n = String(clienteNombre || '').toUpperCase().trim();
  if (c === 'MOSTRADOR') return 'MOSTRADOR';
  if (c === 'E-COMMERCE') {
    for (const r of ECOM_RULES) if (r.match.some((m) => n.includes(m))) return r.nombre;
    return 'OTROS E-COMMERCE';
  }
  if (ALIAS_ERP[n]) return ALIAS_ERP[n];
  return clienteNombre || '';
};

export const fmtCompact = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(Number(n));
  const sign = Number(n) < 0 ? '-' : '';
  if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(0) + 'K';
  return sign + '$' + Math.round(a);
};
export const fmtNumber = (n) => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('es-MX');
export const fmtPct = (n) => n == null || !isFinite(n) ? '—' : n.toFixed(1) + '%';

export function typo(t) {
  return {
    fontFamily: t === TYPO.body || t === TYPO.bodyLg || t === TYPO.eyebrow || t === TYPO.label || t === TYPO.caption
      ? TYPO.fontText : TYPO.fontDisplay,
    fontSize: t.fs, fontWeight: t.w, letterSpacing: t.ls, lineHeight: t.lh || 1.4,
  };
}

async function pageAll(table, anioVal) {
  const PAGE = 1000;
  let acc = [], from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select('*').eq('anio', anioVal).range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    acc = acc.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return acc;
}

export function useAnalisisData() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [aniosDisponibles, setAniosDisponibles] = useState([]);
  const [canalAct, setCanalAct] = useState([]);
  const [canalPrev, setCanalPrev] = useState([]);
  const [clientesAct, setClientesAct] = useState([]);
  const [clientesPrev, setClientesPrev] = useState([]);
  const [cuotas, setCuotas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('v_vision_factura_canal').select('anio').order('anio', { ascending: false });
      const unique = Array.from(new Set((data || []).map(r => r.anio))).sort((a, b) => b - a);
      setAniosDisponibles(unique);
    })();
  }, []);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [a, p, c, cp, q] = await Promise.all([
        pageAll('v_vision_factura_canal', anio),
        pageAll('v_vision_factura_canal', anio - 1),
        pageAll('v_vision_factura_clientes', anio),
        pageAll('v_vision_factura_clientes', anio - 1),
        supabase.from('cuotas_canales').select('*').eq('anio', anio).then((r) => r.data || []),
      ]);
      setCanalAct(a); setCanalPrev(p); setClientesAct(c); setClientesPrev(cp); setCuotas(q);
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
    const activos = new Set(clientesAct.map((c) => clienteCanonico(c.cliente_nombre, c.canal)).filter(Boolean)).size;
    const cuotaTotal = cuotas.find((c) => c.dimension_tipo === 'TOTAL')?.meta_facturacion;
    const cumpl = cuotaTotal > 0 ? (ventaYTD / cuotaTotal) * 100 : null;
    return {
      ventaYTD, ventaMes, ventaMesPrev, ventaYTDPrev,
      deltaYTD: ventaYTDPrev > 0 ? ((ventaYTD - ventaYTDPrev) / ventaYTDPrev) * 100 : null,
      deltaMes: ventaMesPrev > 0 ? ((ventaMes - ventaMesPrev) / ventaMesPrev) * 100 : null,
      activos, cuotaTotal, cumpl,
      gap: cuotaTotal > 0 ? cuotaTotal - ventaYTD : null,
    };
  }, [canalAct, canalPrev, clientesAct, cuotas, mesMax]);

  const yoyMensual = useMemo(() => {
    const sumar = (rows) => {
      const arr = Array(12).fill(null);
      rows.forEach((r) => {
        const m = Number(r.mes);
        if (m < 1 || m > 12) return;
        arr[m - 1] = (arr[m - 1] || 0) + (Number(r.venta) || 0);
      });
      return arr;
    };
    const act = sumar(canalAct), prv = sumar(canalPrev);
    return MESES_LBL.map((mes, i) => ({ mes, actual: act[i], anterior: prv[i] }));
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
    return Array.from(m.entries()).map(([canal, venta]) => {
      const prev = mPrev.get(canal) || 0;
      return {
        canal, venta,
        share: total > 0 ? (venta / total) * 100 : 0,
        deltaYoY: prev > 0 ? ((venta - prev) / prev) * 100 : null,
      };
    }).sort((a, b) => b.venta - a.venta);
  }, [canalAct, canalPrev, mesMax]);

  const ventaTotalAct = useMemo(() => clientesAct.reduce((s, c) => s + (Number(c.venta) || 0), 0), [clientesAct]);

  const clientesRanking = useMemo(() => {
    const actMap = new Map();
    clientesAct.forEach((c) => {
      const nombre = clienteCanonico(c.cliente_nombre, c.canal);
      if (!nombre || nombre === 'Sin nombre') return;
      if (!actMap.has(nombre)) actMap.set(nombre, { cliente: nombre, canal: c.canal || 'Otros', ytd: 0 });
      actMap.get(nombre).ytd += Number(c.venta) || 0;
    });
    const prevMap = new Map();
    clientesPrev.forEach((c) => {
      const nombre = clienteCanonico(c.cliente_nombre, c.canal);
      if (!nombre) return;
      prevMap.set(nombre, (prevMap.get(nombre) || 0) + (Number(c.venta) || 0));
    });
    return Array.from(actMap.values()).map((c) => {
      const ytdPrev = prevMap.get(c.cliente) || 0;
      return {
        ...c, ytdPrev,
        deltaYoY: ytdPrev > 0 ? ((c.ytd - ytdPrev) / ytdPrev) * 100 : null,
        share: ventaTotalAct > 0 ? (c.ytd / ventaTotalAct) * 100 : 0,
      };
    }).sort((a, b) => b.ytd - a.ytd);
  }, [clientesAct, clientesPrev, ventaTotalAct]);

  return {
    loading, anio, setAnio, aniosDisponibles, mesMax,
    kpis, yoyMensual, canales, clientesRanking,
  };
}

// ─── Progress bar ───
export function ProgressBar({ theme, pct, color, height = 8 }) {
  const clamped = Math.max(0, Math.min(100, pct || 0));
  return (
    <div style={{
      width: '100%', height,
      background: theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      borderRadius: 999, overflow: 'hidden',
    }}>
      <div style={{
        width: `${clamped}%`, height: '100%',
        background: color || theme.text, borderRadius: 999,
        transition: 'width 600ms cubic-bezier(0.32, 0.72, 0, 1)',
      }} />
    </div>
  );
}

// ─── Delta ───
export function DeltaLine({ theme, pct, label, size = 'sm' }) {
  if (pct == null || !isFinite(pct)) return <span style={{ ...typo(TYPO.caption), color: theme.textMuted }}>—</span>;
  const isPos = pct >= 0;
  const col = isPos ? theme.green : theme.red;
  const t = size === 'lg' ? { fs: 21, w: 500 } : size === 'md' ? { fs: 15, w: 500 } : { fs: 12, w: 500 };
  return (
    <span style={{ ...typo(t), fontFamily: TYPO.fontText, color: col, fontVariantNumeric: 'tabular-nums' }}>
      {isPos ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%
      {label && <span style={{ color: theme.textMuted, fontWeight: 400, marginLeft: 6 }}>{label}</span>}
    </span>
  );
}

// ─── Chart YoY mensual ───
export function ChartYoY({ theme, yoyMensual, mesMax, anioActual, anioPrev }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const W = 900, H = 240;
  const padL = 50, padR = 40, padT = 30, padB = 46;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const stepX = chartW / 11;

  const allVals = yoyMensual.flatMap((d) => [d.actual, d.anterior]).filter((v) => v > 0);
  if (allVals.length === 0) return <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textMuted }}>Sin datos</div>;
  const max = Math.max(...allVals);
  const scaleY = (v) => padT + chartH - (v / max) * chartH;
  const scaleX = (i) => padL + i * stepX;

  const pathAct = yoyMensual.map((d, i) => i < mesMax && d.actual > 0 ? `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(d.actual)}` : '').filter(Boolean).join(' ');
  const pathPrev = yoyMensual.map((d, i) => d.anterior > 0 ? `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(d.anterior)}` : '').filter(Boolean).join(' ');

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    if (x < padL || x > W - padR) { setHoverIdx(null); return; }
    const i = Math.round((x - padL) / stepX);
    if (i < 0 || i > 11) { setHoverIdx(null); return; }
    setHoverIdx(i);
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}
      onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)}>
      <line x1={padL} y1={scaleY(0)} x2={W - padR} y2={scaleY(0)} stroke={theme.divider} strokeWidth="1" />
      {pathPrev && <path d={pathPrev} fill="none" stroke={theme.textMuted} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />}
      {pathAct && <path d={pathAct} fill="none" stroke={theme.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

      {yoyMensual.map((d, i) => (i < mesMax && d.actual > 0) ? (
        <circle key={i} cx={scaleX(i)} cy={scaleY(d.actual)} r={hoverIdx === i ? 6.5 : 4.5}
          fill={theme.text} stroke={theme.surface} strokeWidth={hoverIdx === i ? 3 : 2}
          style={{ transition: 'r 180ms cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
      ) : null)}

      {hoverIdx != null && yoyMensual[hoverIdx]?.actual > 0 && (
        <>
          <line x1={scaleX(hoverIdx)} x2={scaleX(hoverIdx)} y1={padT} y2={padT + chartH}
            stroke={theme.text} strokeOpacity="0.25" strokeWidth="1" strokeDasharray="2 3" />
          <text x={scaleX(hoverIdx)} y={scaleY(yoyMensual[hoverIdx].actual) - 14} textAnchor="middle"
            fontSize="12" fontWeight="700" fill={theme.text} fontFamily={TYPO.fontDisplay}
            style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fmtCompact(yoyMensual[hoverIdx].actual)}
          </text>
        </>
      )}

      {MESES_LBL.map((m, i) => (
        <text key={m} x={scaleX(i)} y={H - 14} textAnchor="middle"
          fontSize="11" fill={i < mesMax ? theme.textMuted : theme.textSubtle}
          fontFamily={TYPO.fontText}>{m}</text>
      ))}
    </svg>
  );
}

// ─── Lista canales con share ───
export function CanalesList({ theme, canales, max = 8 }) {
  if (!canales?.length) return <div style={{ padding: '24px 0', textAlign: 'center', color: theme.textMuted, ...typo(TYPO.body), fontFamily: TYPO.fontText }}>Sin datos</div>;
  const items = canales.slice(0, max);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {items.map((c) => (
        <div key={c.canal}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ ...typo({ fs: 13, w: 500 }), color: theme.text, fontFamily: TYPO.fontText }}>{c.canal}</span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{ ...typo(TYPO.caption), color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                {c.share.toFixed(1)}%
              </span>
              {c.deltaYoY != null && (
                <span style={{
                  ...typo({ fs: 12, w: 500 }), fontFamily: TYPO.fontText,
                  color: c.deltaYoY >= 0 ? theme.green : theme.red, fontVariantNumeric: 'tabular-nums',
                }}>
                  {c.deltaYoY >= 0 ? '↑' : '↓'} {Math.abs(c.deltaYoY).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
          <div style={{ height: 4, background: theme.divider, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${c.share}%`, height: '100%', background: theme.text, borderRadius: 999 }} />
          </div>
          <div style={{ ...typo(TYPO.caption), color: theme.textMuted, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {fmtCompact(c.venta)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Ranking clientes ───
export function ClientesRanking({ theme, clientes, max = 20 }) {
  if (!clientes?.length) return <div style={{ padding: '24px 0', textAlign: 'center', color: theme.textMuted, ...typo(TYPO.body), fontFamily: TYPO.fontText }}>Sin datos</div>;
  const items = clientes.slice(0, max);
  const maxYtd = items[0]?.ytd || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((c, i) => (
        <div key={c.cliente} style={{
          display: 'grid', gridTemplateColumns: '30px 1fr 100px 70px 60px 60px',
          gap: 10, alignItems: 'center', padding: '11px 4px',
          borderBottom: i < items.length - 1 ? `1px solid ${theme.divider}` : 'none',
        }}>
          <span style={{ ...typo(TYPO.caption), color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
            {String(i + 1).padStart(2, '0')}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...typo({ fs: 13.5, w: 500 }), color: theme.text, fontFamily: TYPO.fontText,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.cliente}
            </div>
            <div style={{ ...typo(TYPO.caption), color: theme.textMuted }}>{c.canal}</div>
          </div>
          <div style={{ ...typo({ fs: 13, w: 500 }), color: theme.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {fmtCompact(c.ytd)}
          </div>
          <div style={{ ...typo(TYPO.caption), color: theme.textMuted, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {c.share.toFixed(1)}%
          </div>
          <div style={{
            ...typo({ fs: 12, w: 500 }), fontFamily: TYPO.fontText, textAlign: 'right',
            color: c.deltaYoY == null ? theme.textMuted : c.deltaYoY >= 0 ? theme.green : theme.red,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {c.deltaYoY == null ? '—' : `${c.deltaYoY >= 0 ? '↑' : '↓'} ${Math.abs(c.deltaYoY).toFixed(1)}%`}
          </div>
          <div>
            <div style={{ height: 3, background: theme.divider, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${(c.ytd / maxYtd) * 100}%`, height: '100%', background: theme.text, borderRadius: 999 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
