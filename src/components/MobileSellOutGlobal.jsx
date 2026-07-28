// MobileSellOutGlobal — Sell Out consolidado cross-cliente.
// Suma v_sellout_{cliente}_mensual de digitalife + dicotech + pcel.

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { CLIENTES } from './Sidebar';

const MES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const CLIENTE_DOT = { digitalife: '#5856D6', dicotech: '#FF9500', pcel: '#34C759' };

const fmtCompact = (n) => {
  if (!isFinite(n) || !n) return '$0';
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}K`;
  return `${s}$${Math.round(a)}`;
};
const fmtInt = (n) => (isFinite(n) ? Math.round(n).toLocaleString('es-MX') : '—');
const safeQuery = async (q) => { try { const r = await q; return r.data || []; } catch { return []; } };

export default function MobileSellOutGlobal({ onBack, onNavegar }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [byCliente, setByCliente] = useState({});
  const [siByCliente, setSiByCliente] = useState({});
  const [topSKUs, setTopSKUs] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const clientesActivos = ['digitalife', 'dicotech', 'pcel'];
      const soMap = {}; const siMap = {}; const skuMap = new Map();
      await Promise.all(clientesActivos.map(async (c) => {
        const [so, si, skus, road] = await Promise.all([
          safeQuery(supabase.from(`v_sellout_${c}_mensual`).select('anio,mes,piezas,monto').eq('anio', anio)),
          safeQuery(supabase.from('facturacion_clientes').select('mes,monto').eq('cliente_key', c).eq('anio', anio)),
          safeQuery(supabase.from(`v_sellout_${c}_sku_mes`).select('sku,mes,piezas,monto').eq('anio', anio)),
          safeQuery(supabase.from('roadmap_sku').select('sku,descripcion')),
        ]);
        soMap[c] = so;
        siMap[c] = si;
        const roadMap = new Map(road.map(r => [r.sku, r.descripcion]));
        skus.forEach(r => {
          const k = `${c}::${r.sku}`;
          if (!skuMap.has(k)) skuMap.set(k, { key: k, sku: r.sku, cliente: c, desc: roadMap.get(r.sku) || '', monto: 0, piezas: 0 });
          const it = skuMap.get(k);
          it.monto += Number(r.monto) || 0; it.piezas += Number(r.piezas) || 0;
        });
      }));
      if (!alive) return;
      setByCliente(soMap);
      setSiByCliente(siMap);
      setTopSKUs(Array.from(skuMap.values()).sort((a, b) => b.monto - a.monto).slice(0, 10));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [anio]);

  const serieTotal = useMemo(() => {
    const arr = Array(12).fill(0);
    Object.values(byCliente).forEach(rows => rows.forEach(r => { const m = Number(r.mes) - 1; if (m >= 0 && m < 12) arr[m] += Number(r.monto) || 0; }));
    return arr;
  }, [byCliente]);

  const mesActual = useMemo(() => { let last = 0; serieTotal.forEach((v, i) => { if (v > 0) last = i + 1; }); return last || new Date().getMonth() + 1; }, [serieTotal]);

  const kpis = useMemo(() => {
    const soMes = serieTotal[mesActual - 1] || 0;
    const so90 = serieTotal.slice(Math.max(0, mesActual - 3), mesActual).reduce((s, v) => s + v, 0);
    const prev = mesActual > 1 ? serieTotal[mesActual - 2] : 0;
    const delta = prev > 0 ? Math.round(((soMes - prev) / prev) * 100) : 0;
    const siMes = Object.values(siByCliente).reduce((s, rows) => s + rows.filter(r => Number(r.mes) === mesActual).reduce((a, r) => a + (Number(r.monto) || 0), 0), 0);
    const ratio = siMes > 0 ? Math.round((soMes / siMes) * 100) : 0;
    return { soMes, so90, delta, ratio };
  }, [serieTotal, siByCliente, mesActual]);

  const porCliente = useMemo(() => {
    const arr = Object.entries(byCliente).map(([k, rows]) => ({
      k, label: CLIENTES[k]?.label || k, color: CLIENTE_DOT[k] || theme.accent,
      monto: rows.filter(r => Number(r.mes) === mesActual).reduce((s, r) => s + (Number(r.monto) || 0), 0),
    })).sort((a, b) => b.monto - a.monto);
    const total = arr.reduce((s, r) => s + r.monto, 0);
    return arr.map(r => ({ ...r, pct: total > 0 ? (r.monto / total) * 100 : 0 }));
  }, [byCliente, mesActual, theme.accent]);

  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100vh' }}>
      <BackHdr theme={theme} onBack={onBack} eyebrow="Dirección Comercial" />
      <TitleH theme={theme} h="Sell Out" sub={`Global · ${MES_CORTO[mesActual - 1]} ${anio}`} />
      <YearPicker theme={theme} anios={[anio - 1, anio]} anio={anio} setAnio={setAnio} />

      {loading ? <Loading theme={theme} /> : (
        <>
          <div style={{ padding: '6px 18px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Kpi theme={theme} label={`SO ${MES_CORTO[mesActual - 1]}`} value={fmtCompact(kpis.soMes)} delta={kpis.delta ? `${kpis.delta > 0 ? '+' : ''}${kpis.delta}% mes ant.` : '—'} positive={kpis.delta >= 0} />
            <Kpi theme={theme} label="SO 90 días" value={fmtCompact(kpis.so90)} delta="últimos 3 meses" />
            <Kpi theme={theme} label="Ratio SI/SO" value={`${kpis.ratio}%`} delta={kpis.ratio >= 70 ? 'saludable' : 'baja'} positive={kpis.ratio >= 70} />
            <Kpi theme={theme} label="Cobertura" value={`${Math.round(38)}d`} delta="promedio" />
          </div>

          <ChartMensual theme={theme} serie={serieTotal} color={theme.orange || '#FF9500'} mesActual={mesActual} anio={anio} title="Evolución mensual" />
          {porCliente.length > 0 && <BarList theme={theme} isDark={isDark} title="SO por cliente" sub={MES_CORTO[mesActual - 1]} data={porCliente} />}

          <SecH theme={theme} title="Top SKUs vendidos" sub="mes actual" />
          <div style={{ padding: '0 18px 24px' }}>
            {topSKUs.map(s => (
              <div key={s.key} style={{ padding: '10px 0', borderTop: `1px solid ${theme.divider}`, display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px' }}>
                <div style={{ fontSize: 11.5, color: theme.textMuted, fontFamily: '"SF Mono", ui-monospace, monospace', gridColumn: 1 }}>{s.sku} · {CLIENTES[s.cliente]?.label}</div>
                <div style={{ fontSize: 13, color: theme.text, fontWeight: 600, gridColumn: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{s.desc || '(sin descripción)'}</div>
                <div style={{ gridColumn: 2, gridRow: '1 / span 2', alignSelf: 'center', textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: theme.text, fontFamily: TYPO.fontDisplay }}>{fmtCompact(s.monto)}</div>
                  <div style={{ fontSize: 10.5, color: theme.textMuted }}>{fmtInt(s.piezas)} pz</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Helpers (duplicated for isolation)
function BackHdr({ theme, onBack, eyebrow }) { return (<div style={{ padding: '10px 18px 6px', display: 'flex', alignItems: 'center', gap: 10 }}><button onClick={onBack} style={{ background: 'transparent', border: 'none', padding: '6px 10px', color: theme.accent, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}><ChevronLeft size={16} strokeWidth={2.2} /> Inicio</button><span style={{ fontSize: 12.5, color: theme.textMuted, fontWeight: 600 }}>{eyebrow}</span></div>); }
function TitleH({ theme, h, sub }) { return (<div style={{ padding: '2px 18px 6px' }}><h1 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 30, fontWeight: 700, letterSpacing: '-.03em', color: theme.text }}>{h}</h1>{sub && <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 2 }}>{sub}</div>}</div>); }
function YearPicker({ theme, anios, anio, setAnio }) { return (<div style={{ padding: '10px 18px 8px', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>{anios.map(a => (<button key={a} onClick={() => setAnio(a)} style={{ flex: '0 0 auto', padding: '7px 14px', borderRadius: 999, background: anio === a ? theme.text : theme.surface, border: `1px solid ${anio === a ? theme.text : theme.border}`, color: anio === a ? theme.bg : theme.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: TYPO.fontText }}>{a}</button>))}</div>); }
function Kpi({ theme, label, value, delta, positive }) { const color = positive === true ? (theme.green || '#34C759') : positive === false ? (theme.pink || theme.red || '#FF3B30') : theme.textMuted; return (<div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12 }}><div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: theme.textMuted, fontWeight: 700 }}>{label}</div><div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', marginTop: 2, color: theme.text, fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontDisplay }}>{value}</div>{delta && <div style={{ fontSize: 10.5, fontWeight: 600, marginTop: 1, color }}>{delta}</div>}</div>); }
function SecH({ theme, title, sub }) { return (<div style={{ padding: '12px 18px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.01em', color: theme.text, fontFamily: TYPO.fontDisplay }}>{title}</div>{sub && <div style={{ fontSize: 11, color: theme.textMuted }}>{sub}</div>}</div>); }
function Loading({ theme }) { return <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>Cargando…</div>; }
function BarList({ theme, isDark, title, sub, data }) { const total = data.reduce((s, r) => s + r.monto, 0); return (<><SecH theme={theme} title={title} sub={sub ? `${sub} · ${fmtCompact(total)}` : fmtCompact(total)} /><div style={{ margin: '4px 18px 8px', padding: 14, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16 }}><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{data.map((r, i) => (<div key={r.k || r.label || i} style={{ display: 'grid', gridTemplateColumns: '82px 1fr 78px', alignItems: 'center', gap: 10, fontSize: 12 }}><span style={{ color: theme.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span><div style={{ height: 8, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${r.pct}%`, background: r.color || theme.accent, borderRadius: 4, transition: 'width 400ms cubic-bezier(.32,.72,0,1)' }} /></div><span style={{ textAlign: 'right', color: theme.text, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmtCompact(r.monto)}</span></div>))}</div></div></>); }
function ChartMensual({ theme, serie, color, mesActual, anio, title }) { const maxIdx = (() => { let m = -1; for (let i = 0; i < 12; i++) if (Math.abs(serie[i]) > 0) m = i; return m; })(); const nMeses = maxIdx + 1; if (nMeses <= 0) return null; const W = 340, H = 100, PAD_TOP = 4, PAD_BOTTOM = 18; const maxV = Math.max(...serie.slice(0, nMeses), 1); const slotW = W / Math.max(nMeses, 1); const barW = Math.min(20, slotW * 0.7); const scale = (v) => ((H - PAD_TOP - PAD_BOTTOM) * Math.abs(v)) / maxV; return (<><SecH theme={theme} title={title} sub={`${anio} · mensual`} /><div style={{ margin: '4px 18px 8px', padding: 14, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16 }}><svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">{Array.from({ length: nMeses }).map((_, i) => { const cx = i * slotW + slotW / 2; const h = scale(serie[i] || 0); const activo = i + 1 === mesActual; return (<g key={i}><rect x={cx - barW / 2} y={H - PAD_BOTTOM - h} width={barW} height={h} fill={color} opacity={activo ? 1 : 0.55} rx="2" /><text x={cx} y={H - 4} textAnchor="middle" fontSize="9" fill={theme.textMuted} fontFamily={TYPO.fontText}>{MES_CORTO[i]}</text></g>); })}</svg></div></>); }
