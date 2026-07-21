// Shared para los 3 layouts de Sell In.
// Hook de datos + formatters + componentes comunes.
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { TYPO } from '../../../lib/themeTokens';

export const MESES_LBL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
export const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export const CLIENTES_META = {
  dicotech:   { nombre: 'Dicotech',   marca: 'Acteck',              color: '#0EA5E9' },
  pcel:       { nombre: 'PCEL',       marca: 'Acteck',              color: '#EF4444' },
  digitalife: { nombre: 'Digitalife', marca: 'Acteck / Balam Rush', color: '#EF4444' },
};

export const fmtCompact = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(0) + 'K';
  return sign + '$' + Math.round(a);
};
export const fmtMoney = (n) => {
  if (n == null || isNaN(n)) return '—';
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('es-MX', { maximumFractionDigits: 0 });
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

async function fetchAll(table, select, extra) {
  const PAGE = 1000;
  let acc = []; let from = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(from, from + PAGE - 1);
    if (extra) q = extra(q);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    acc = acc.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return acc;
}

export function useSellInData(clienteKey) {
  const esGlobal = !clienteKey;
  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const anioPrev = anioActual - 1;
  const mesActual = hoy.getMonth() + 1;

  const [facturacion, setFacturacion] = useState([]);
  const [roadmap, setRoadmap] = useState([]);
  const [cuotas, setCuotas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const factP = esGlobal
        ? fetchAll('v_facturacion_global_sku_mes', 'sku,anio,mes,piezas,monto', (q) => q.in('anio', [anioPrev, anioActual]))
        : fetchAll('facturacion_clientes', 'sku,anio,mes,piezas,monto', (q) => q.eq('cliente_key', clienteKey).in('anio', [anioPrev, anioActual]));
      const cuotasP = esGlobal
        ? fetchAll('v_cuota_global_mensual', 'mes,anio,cuota_min,cuota_ideal', (q) => q.eq('anio', anioActual))
        : fetchAll('cuotas_mensuales', 'mes,anio,cuota_min,cuota_ideal', (q) => q.eq('cliente', clienteKey).eq('anio', anioActual));
      const [f, r, c] = await Promise.all([
        factP, fetchAll('roadmap_sku', 'sku,marca,descripcion,categoria,familia,rdmp'), cuotasP,
      ]);
      setFacturacion(f); setRoadmap(r); setCuotas(c);
      setLoading(false);
    })();
  }, [clienteKey, anioActual, anioPrev, esGlobal]);

  const roadmapMap = useMemo(() => {
    const m = new Map();
    for (const r of roadmap) m.set(r.sku, r);
    return m;
  }, [roadmap]);

  const mensualPorAnio = useMemo(() => {
    const monto = { [anioPrev]: Array(12).fill(0), [anioActual]: Array(12).fill(0) };
    const piezas = { [anioPrev]: Array(12).fill(0), [anioActual]: Array(12).fill(0) };
    for (const r of facturacion) {
      const y = r.anio, i = r.mes - 1;
      if (i < 0 || i > 11) continue;
      monto[y][i] += Number(r.monto) || 0;
      piezas[y][i] += Number(r.piezas) || 0;
    }
    return { monto, piezas };
  }, [facturacion, anioPrev, anioActual]);

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

  const kpis = useMemo(() => {
    const montoMes = mensualPorAnio.monto[anioActual][mesActual - 1] || 0;
    const piezasMes = mensualPorAnio.piezas[anioActual][mesActual - 1] || 0;
    const montoMesPrev = mensualPorAnio.monto[anioPrev][mesActual - 1] || 0;
    const cMes = cuotaPorMes.get(mesActual);

    let ytdMonto = 0, ytdPiezas = 0, ytdMontoPrev = 0, ytdCuotaIdeal = 0;
    for (let i = 0; i < mesActual; i++) {
      ytdMonto += mensualPorAnio.monto[anioActual][i];
      ytdPiezas += mensualPorAnio.piezas[anioActual][i];
      ytdMontoPrev += mensualPorAnio.monto[anioPrev][i];
      const c = cuotaPorMes.get(i + 1);
      if (c) ytdCuotaIdeal += c.ideal;
    }

    const yoyMes = montoMesPrev > 0 ? ((montoMes - montoMesPrev) / montoMesPrev) * 100 : null;
    const yoyYTD = ytdMontoPrev > 0 ? ((ytdMonto - ytdMontoPrev) / ytdMontoPrev) * 100 : null;
    const cumplMes = cMes && cMes.ideal > 0 ? (montoMes / cMes.ideal) * 100 : null;
    const cumplYTD = ytdCuotaIdeal > 0 ? (ytdMonto / ytdCuotaIdeal) * 100 : null;
    const cumplAnual = cuotaAnual.ideal > 0 ? (ytdMonto / cuotaAnual.ideal) * 100 : null;

    return {
      montoMes, piezasMes, montoMesPrev, cuotaMes: cMes,
      ytdMonto, ytdPiezas, ytdMontoPrev, ytdCuotaIdeal,
      yoyMes, yoyYTD, cumplMes, cumplYTD, cumplAnual,
      cuotaAnualIdeal: cuotaAnual.ideal, cuotaAnualMin: cuotaAnual.min,
    };
  }, [mensualPorAnio, cuotaPorMes, cuotaAnual, anioActual, anioPrev, mesActual]);

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
    return arr.map((v) => ({ ...v, pct: tot ? (v.monto / tot) * 100 : 0 }));
  }, [facturacion, roadmapMap, anioActual, mesActual]);

  const topSkus = useMemo(() => {
    const map = new Map();
    for (const r of facturacion) {
      if (r.anio !== anioActual || r.mes > mesActual) continue;
      if (!map.has(r.sku)) map.set(r.sku, { sku: r.sku, monto: 0, piezas: 0 });
      const s = map.get(r.sku);
      s.monto += Number(r.monto) || 0;
      s.piezas += Number(r.piezas) || 0;
    }
    return Array.from(map.values())
      .map(s => {
        const rm = roadmapMap.get(s.sku);
        return { ...s, marca: rm?.marca || '—', desc: rm?.descripcion || '', familia: rm?.familia || '—' };
      })
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 15);
  }, [facturacion, roadmapMap, anioActual, mesActual]);

  const chartData = useMemo(() => MESES_LBL.map((mes, i) => ({
    mes,
    monto: mensualPorAnio.monto[anioActual][i] || null,
    montoPrev: mensualPorAnio.monto[anioPrev][i] || null,
    cuotaIdeal: cuotaPorMes.get(i + 1)?.ideal || null,
  })), [mensualPorAnio, cuotaPorMes, anioActual, anioPrev]);

  return {
    loading, esGlobal, anioActual, anioPrev, mesActual,
    facturacion, kpis, familiasYTD, topSkus, chartData,
    mensualPorAnio, cuotaPorMes, cuotaAnual,
  };
}

// ─── Sparkline ───
export function Sparkline({ theme, series, mesMax, color, height = 24, width = 100 }) {
  const points = (series || []).slice(0, mesMax).filter((v) => v != null && !isNaN(v));
  if (points.length < 2) return <div style={{ height }} />;
  const min = Math.min(...points, 0);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const poly = points.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%', height }}>
      <polyline points={poly} fill="none" stroke={color || theme.text} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
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

// ─── Delta chip ───
export function DeltaLine({ theme, pct, label, size = 'sm', isPts }) {
  if (pct == null || !isFinite(pct)) return <span style={{ ...typo(TYPO.caption), color: theme.textMuted }}>—</span>;
  const isPos = pct >= 0;
  const col = isPos ? theme.green : theme.red;
  const t = size === 'lg' ? { fs: 21, w: 500, ls: 0 } : size === 'md' ? { fs: 15, w: 500, ls: 0 } : { fs: 12, w: 500, ls: 0 };
  return (
    <span style={{
      ...typo(t), fontFamily: TYPO.fontText,
      color: col, fontVariantNumeric: 'tabular-nums',
    }}>
      {isPos ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}{isPts ? ' pts' : '%'}
      {label && <span style={{ color: theme.textMuted, fontWeight: 400, marginLeft: 6 }}>{label}</span>}
    </span>
  );
}

// ─── Chart mensual ───
export function ChartMensual({ theme, chartData, mesMax, anioActual, anioPrev }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const W = 900, H = 240;
  const padL = 50, padR = 40, padT = 30, padB = 46;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const stepX = chartW / 11;

  const allVals = chartData.flatMap(d => [d.monto, d.montoPrev, d.cuotaIdeal]).filter(v => v > 0);
  if (allVals.length === 0) return <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textMuted }}>Sin datos</div>;
  const min = 0, max = Math.max(...allVals);
  const range = max - min || 1;
  const scaleY = (v) => padT + chartH - ((v - min) / range) * chartH;
  const scaleX = (i) => padL + i * stepX;

  const pathMonto = chartData.map((d, i) => i < mesMax && d.monto > 0 ? `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(d.monto)}` : '').filter(Boolean).join(' ');
  const pathPrev = chartData.map((d, i) => d.montoPrev > 0 ? `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(d.montoPrev)}` : '').filter(Boolean).join(' ');
  const pathCuota = chartData.map((d, i) => d.cuotaIdeal > 0 ? `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(d.cuotaIdeal)}` : '').filter(Boolean).join(' ');

  const handleMove = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
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

      {pathCuota && <path d={pathCuota} fill="none" stroke={theme.textSubtle} strokeWidth="1.5" strokeDasharray="4 3" />}
      {pathPrev && <path d={pathPrev} fill="none" stroke={theme.textMuted} strokeWidth="1.5" strokeDasharray="2 3" opacity="0.6" />}
      {pathMonto && <path d={pathMonto} fill="none" stroke={theme.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

      {chartData.map((d, i) => (i < mesMax && d.monto > 0) ? (
        <circle key={i} cx={scaleX(i)} cy={scaleY(d.monto)} r={hoverIdx === i ? 6.5 : 4.5}
          fill={theme.text} stroke={theme.surface} strokeWidth={hoverIdx === i ? 3 : 2}
          style={{ transition: 'r 180ms cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
      ) : null)}

      {hoverIdx != null && chartData[hoverIdx]?.monto > 0 && (
        <>
          <line x1={scaleX(hoverIdx)} x2={scaleX(hoverIdx)} y1={padT} y2={padT + chartH}
            stroke={theme.text} strokeOpacity="0.25" strokeWidth="1" strokeDasharray="2 3" />
          <text x={scaleX(hoverIdx)} y={scaleY(chartData[hoverIdx].monto) - 14} textAnchor="middle"
            fontSize="12" fontWeight="700" fill={theme.text} fontFamily={TYPO.fontDisplay}
            style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fmtCompact(chartData[hoverIdx].monto)}
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

// ─── FamiliasList — barras por familia con % ───
export function FamiliasList({ theme, familias, max = 6 }) {
  if (!familias?.length) return <div style={{ padding: '24px 0', textAlign: 'center', color: theme.textMuted, ...typo(TYPO.body), fontFamily: TYPO.fontText }}>Sin datos</div>;
  const items = familias.slice(0, max);
  const maxPct = items[0]?.pct || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((f) => (
        <div key={f.name}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ ...typo({ fs: 13, w: 500 }), color: theme.text, fontFamily: TYPO.fontText }}>{f.name}</span>
            <span style={{ ...typo(TYPO.caption), color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
              {fmtCompact(f.monto)} · {f.pct.toFixed(1)}%
            </span>
          </div>
          <div style={{ height: 4, background: theme.divider, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${(f.pct / maxPct) * 100}%`, height: '100%', background: theme.text, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── TopSkusTable ───
export function TopSkusTable({ theme, topSkus, maxRows = 10 }) {
  if (!topSkus?.length) return <div style={{ padding: '24px 0', textAlign: 'center', color: theme.textMuted, ...typo(TYPO.body), fontFamily: TYPO.fontText }}>Sin datos</div>;
  const items = topSkus.slice(0, maxRows);
  const maxMonto = items[0]?.monto || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((s, i) => (
        <div key={s.sku} style={{
          display: 'grid', gridTemplateColumns: '28px 1fr 90px 80px 40px',
          gap: 10, alignItems: 'center', padding: '10px 2px',
          borderBottom: i < items.length - 1 ? `1px solid ${theme.divider}` : 'none',
        }}>
          <span style={{ ...typo(TYPO.caption), color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
            {String(i + 1).padStart(2, '0')}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...typo({ fs: 13.5, w: 500 }), color: theme.text, fontFamily: TYPO.fontText,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sku}</div>
            <div style={{ ...typo(TYPO.caption), color: theme.textMuted,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.marca} {s.familia && `· ${s.familia}`}
            </div>
          </div>
          <div style={{ ...typo({ fs: 13, w: 500 }), color: theme.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {fmtCompact(s.monto)}
          </div>
          <div style={{ ...typo(TYPO.caption), color: theme.textMuted, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {fmtNumber(s.piezas)} pz
          </div>
          <div>
            <div style={{ height: 3, background: theme.divider, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${(s.monto / maxMonto) * 100}%`, height: '100%', background: theme.text, borderRadius: 999 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
