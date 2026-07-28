// MobileSOP — S&OP / Forecast mobile.

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { PCEL_REAL } from '../lib/constants';
import { CLIENTES } from './Sidebar';

const MES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const CLIENTE_DOT = { digitalife: '#5856D6', dicotech: '#FF9500', pcel: '#34C759' };
const Q_MESES = { Q1: [1,2,3], Q2: [4,5,6], Q3: [7,8,9], Q4: [10,11,12] };

const fmtCompact = (n) => {
  if (!isFinite(n) || !n) return '$0';
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}K`;
  return `${s}$${Math.round(a)}`;
};
const safeQuery = async (q) => { try { const r = await q; return r.data || []; } catch { return []; } };

export default function MobileSOP({ onBack, onNavegar }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const anio = new Date().getFullYear();
  const mesActual = new Date().getMonth() + 1;
  const qActual = mesActual <= 3 ? 'Q1' : mesActual <= 6 ? 'Q2' : mesActual <= 9 ? 'Q3' : 'Q4';
  const [qSel, setQSel] = useState(qActual);
  const [loading, setLoading] = useState(true);
  const [fact, setFact] = useState([]);
  const [cuotas, setCuotas] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [f, c] = await Promise.all([
        safeQuery(supabase.from('facturacion_clientes').select('cliente_key,mes,monto').eq('anio', anio)),
        safeQuery(supabase.from('cuotas_mensuales').select('cliente,mes,cuota_min,cuota_ideal,cuota_meta').eq('anio', anio)),
      ]);
      if (!alive) return;
      setFact(f); setCuotas(c); setLoading(false);
    })();
    return () => { alive = false; };
  }, [anio]);

  const meses = Q_MESES[qSel];
  const kpis = useMemo(() => {
    const factQ = fact.filter(r => meses.includes(Number(r.mes))).reduce((s, r) => s + (Number(r.monto) || 0), 0);
    // cuota_ideal como meta (matching desktop) + fallback PCEL_REAL
    let metaQ = 0;
    ['digitalife', 'dicotech', 'pcel'].forEach(cli => {
      meses.forEach(mes => {
        const r = cuotas.find(x => x.cliente === cli && Number(x.mes) === mes);
        let v = r ? Number(r.cuota_ideal || r.cuota_min || 0) : 0;
        if (cli === 'pcel' && v === 0 && PCEL_REAL?.cuota50M?.[mes]) v = PCEL_REAL.cuota50M[mes];
        metaQ += v;
      });
    });
    const gap = Math.max(0, metaQ - factQ);
    const pct = metaQ > 0 ? Math.round((factQ / metaQ) * 100) : 0;
    // días transcurridos del trimestre
    const now = new Date();
    const [m0, , m2] = meses;
    const inicio = new Date(anio, m0 - 1, 1);
    const fin = new Date(anio, m2, 0);
    const total = Math.max(1, Math.ceil((fin - inicio) / 86400000) + 1);
    const trans = Math.max(0, Math.min(total, Math.ceil((now - inicio) / 86400000) + 1));
    const rest = Math.max(0, total - trans);
    const confidence = pct >= 90 ? 90 : pct >= 70 ? 72 : pct >= 50 ? 55 : 35;
    return { factQ, metaQ, gap, pct, trans, rest, total, confidence };
  }, [fact, cuotas, meses, anio]);

  const porCliente = useMemo(() => {
    return Object.keys(CLIENTES).filter(k => CLIENTES[k].activo).map(id => {
      const f = fact.filter(r => r.cliente_key === id && meses.includes(Number(r.mes))).reduce((s, r) => s + (Number(r.monto) || 0), 0);
      let meta = 0;
      meses.forEach(mes => {
        const r = cuotas.find(x => x.cliente === id && Number(x.mes) === mes);
        let v = r ? Number(r.cuota_ideal || r.cuota_min || 0) : 0;
        if (id === 'pcel' && v === 0 && PCEL_REAL?.cuota50M?.[mes]) v = PCEL_REAL.cuota50M[mes];
        meta += v;
      });
      return { id, label: CLIENTES[id].label, color: CLIENTE_DOT[id] || theme.accent, real: f, meta };
    });
  }, [fact, cuotas, meses, theme.accent]);
  const maxMeta = Math.max(...porCliente.map(c => Math.max(c.real, c.meta)), 1);

  const ritmoActual = kpis.trans > 0 ? Math.round(kpis.factQ / kpis.trans) : 0;
  const ritmoNecesario = kpis.rest > 0 ? Math.round(kpis.gap / kpis.rest) : 0;

  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100vh' }}>
      <BackHdr theme={theme} onBack={onBack} eyebrow="Dirección Comercial" />
      <TitleH theme={theme} h="S&OP" sub={`Cumplimiento ${qSel} ${anio} · vista ejecutiva`} />

      <div style={{ padding: '10px 18px 8px', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {['Q1','Q2','Q3','Q4'].map(q => (
          <button key={q} onClick={() => setQSel(q)}
            style={{ flex: '0 0 auto', padding: '7px 14px', borderRadius: 999, background: qSel === q ? theme.text : theme.surface, border: `1px solid ${qSel === q ? theme.text : theme.border}`, color: qSel === q ? theme.bg : theme.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: TYPO.fontText }}
          >{q}</button>
        ))}
      </div>

      {loading ? <Loading theme={theme} /> : (
        <>
          <div style={{ padding: '6px 18px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Kpi theme={theme} label={`Fcst ${qSel}`} value={fmtCompact(kpis.metaQ)} delta="meta trimestre" />
            <Kpi theme={theme} label={`Real ${qSel}`} value={fmtCompact(kpis.factQ)} delta={`${kpis.pct}% avance`} positive={kpis.pct >= 100} />
            <Kpi theme={theme} label="Gap" value={fmtCompact(kpis.gap)} delta={`${kpis.rest}d restantes`} positive={kpis.gap === 0} />
            <Kpi theme={theme} label="Confidence" value={`${kpis.confidence}%`} delta={kpis.confidence >= 80 ? 'alta' : kpis.confidence >= 60 ? 'media' : 'baja'} positive={kpis.confidence >= 80} />
          </div>

          <SecH theme={theme} title="Forecast vs Real" sub="por cliente" />
          <div style={{ margin: '4px 18px 8px', padding: 14, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {porCliente.map(c => {
                const realPct = maxMeta > 0 ? (c.real / maxMeta) * 100 : 0;
                const metaPct = maxMeta > 0 ? (c.meta / maxMeta) * 100 : 0;
                return (
                  <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '82px 1fr 90px', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <span style={{ color: theme.text, fontWeight: 600 }}>{c.label}</span>
                    <div style={{ height: 8, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                      <div style={{ height: '100%', width: `${realPct}%`, background: c.color, borderRadius: 4, transition: 'width 400ms cubic-bezier(.32,.72,0,1)' }} />
                      <div style={{ position: 'absolute', top: -2, bottom: -2, left: `${metaPct}%`, width: 2, background: theme.red || '#FF3B30' }} />
                    </div>
                    <span style={{ textAlign: 'right', color: theme.text, fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 10.5 }}>{fmtCompact(c.real)} / {fmtCompact(c.meta)}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 10, color: theme.textMuted }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 3, background: theme.accent }} /> Real</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 2, height: 10, background: theme.red || '#FF3B30' }} /> Meta</span>
            </div>
          </div>

          <SecH theme={theme} title="Camino a la meta" />
          <div style={{ margin: '4px 18px 20px', padding: '14px 16px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, fontSize: 12, lineHeight: 1.55, color: theme.textMuted }}>
            Van <b style={{ color: theme.text }}>{kpis.trans}d transcurridos</b> del trimestre ({Math.round((kpis.trans / kpis.total) * 100)}%).<br />
            Ventas <b style={{ color: theme.text }}>{qSel}</b>: <b style={{ color: theme.text }}>{fmtCompact(kpis.factQ)}</b> de <b style={{ color: theme.text }}>{fmtCompact(kpis.metaQ)}</b> meta.
            {kpis.gap > 0 ? (
              <>
                <br /><br />Necesitas cerrar <b style={{ color: theme.red || '#FF3B30' }}>{fmtCompact(kpis.gap)} en {kpis.rest} días</b> — ritmo de {fmtCompact(ritmoNecesario)}/día. Actual: {fmtCompact(ritmoActual)}/día.
                {ritmoNecesario > ritmoActual * 2 && <><br /><br /><b style={{ color: theme.red || '#FF3B30' }}>Riesgo alto</b> · escalar propuestas cliente-por-cliente.</>}
              </>
            ) : <> · <b style={{ color: theme.green || '#34C759' }}>✓ Meta cumplida</b></>}
          </div>
        </>
      )}
    </div>
  );
}

function BackHdr({ theme, onBack, eyebrow }) { return (<div style={{ padding: '10px 18px 6px', display: 'flex', alignItems: 'center', gap: 10 }}><button onClick={onBack} style={{ background: 'transparent', border: 'none', padding: '6px 10px', color: theme.accent, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}><ChevronLeft size={16} strokeWidth={2.2} /> Inicio</button><span style={{ fontSize: 12.5, color: theme.textMuted, fontWeight: 600 }}>{eyebrow}</span></div>); }
function TitleH({ theme, h, sub }) { return (<div style={{ padding: '2px 18px 6px' }}><h1 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 30, fontWeight: 700, letterSpacing: '-.03em', color: theme.text }}>{h}</h1>{sub && <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 2 }}>{sub}</div>}</div>); }
function Kpi({ theme, label, value, delta, positive }) { const color = positive === true ? (theme.green || '#34C759') : positive === false ? (theme.pink || theme.red || '#FF3B30') : theme.textMuted; return (<div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12 }}><div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: theme.textMuted, fontWeight: 700 }}>{label}</div><div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', marginTop: 2, color: theme.text, fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontDisplay }}>{value}</div>{delta && <div style={{ fontSize: 10.5, fontWeight: 600, marginTop: 1, color }}>{delta}</div>}</div>); }
function SecH({ theme, title, sub }) { return (<div style={{ padding: '12px 18px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.01em', color: theme.text, fontFamily: TYPO.fontDisplay }}>{title}</div>{sub && <div style={{ fontSize: 11, color: theme.textMuted }}>{sub}</div>}</div>); }
function Loading({ theme }) { return <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>Cargando…</div>; }
