// MobileCobranzaGlobal — Cartera consolidada mobile.

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { CLIENTES } from './Sidebar';

const CLIENTE_DOT = { digitalife: '#5856D6', dicotech: '#FF9500', pcel: '#34C759' };

const fmtCompact = (n) => {
  if (!isFinite(n) || !n) return '$0';
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}K`;
  return `${s}$${Math.round(a)}`;
};
const safeQuery = async (q) => { try { const r = await q; return r.data || []; } catch { return []; } };

export default function MobileCobranzaGlobal({ onBack, onNavegar }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const [loading, setLoading] = useState(true);
  const [dso, setDso] = useState([]);
  const hoyMs = useMemo(() => new Date().setHours(0, 0, 0, 0), []);
  const [agingData, setAgingData] = useState({ d0_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 });

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const d = await safeQuery(supabase.from('v_dso_real').select('cliente,saldo_actual_total,saldo_vencido,dso_real,dso_erp,aging_mas90,facturas_abiertas'));
      if (!alive) return;
      setDso(d);

      // Aging desde detalle último corte por cliente
      const clientesActivos = ['digitalife', 'dicotech', 'pcel'];
      const aging = { d0_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
      await Promise.all(clientesActivos.map(async (c) => {
        const cortes = await safeQuery(supabase.from('estados_cuenta').select('id,fecha_corte').eq('cliente', c).order('fecha_corte', { ascending: false }).limit(1));
        if (!cortes.length) return;
        const det = await safeQuery(supabase.from('estados_cuenta_detalle').select('saldo_actual,vencimiento').eq('estado_cuenta_id', cortes[0].id));
        det.forEach(f => {
          if (!f.vencimiento) return;
          const saldo = Number(f.saldo_actual) || 0;
          if (saldo <= 0) return;
          const v = new Date(f.vencimiento + 'T00:00:00').getTime();
          const dias = Math.floor((hoyMs - v) / 86400000);
          if (dias <= 0) return;
          if (dias <= 30) aging.d0_30 += saldo;
          else if (dias <= 60) aging.d31_60 += saldo;
          else if (dias <= 90) aging.d61_90 += saldo;
          else aging.d90plus += saldo;
        });
      }));
      if (alive) setAgingData(aging);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [hoyMs]);

  const cartera = useMemo(() => dso.reduce((s, r) => s + (Number(r.saldo_actual_total) || 0), 0), [dso]);
  const vencido = useMemo(() => dso.reduce((s, r) => s + (Number(r.saldo_vencido) || 0), 0), [dso]);
  const dsoAvg = useMemo(() => {
    const vals = dso.map(r => r.dso_real != null ? Number(r.dso_real) : (r.dso_erp != null ? Number(r.dso_erp) : null)).filter(Boolean);
    return vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
  }, [dso]);
  const facturasAb = useMemo(() => dso.reduce((s, r) => s + (Number(r.facturas_abiertas) || 0), 0), [dso]);

  const cli = useMemo(() => Object.keys(CLIENTES).filter(k => CLIENTES[k].activo).map(id => {
    const r = dso.find(x => x.cliente === id) || {};
    return {
      id, label: CLIENTES[id].label, color: CLIENTE_DOT[id] || theme.accent,
      cartera: Number(r.saldo_actual_total) || 0,
      vencido: Number(r.saldo_vencido) || 0,
      dso: r.dso_real != null ? Math.round(Number(r.dso_real)) : (r.dso_erp != null ? Math.round(Number(r.dso_erp)) : null),
      facturas: Number(r.facturas_abiertas) || 0,
    };
  }), [dso, theme.accent]);

  const agingTotal = agingData.d0_30 + agingData.d31_60 + agingData.d61_90 + agingData.d90plus;

  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100vh' }}>
      <BackHdr theme={theme} onBack={onBack} eyebrow="Dirección Comercial" />
      <TitleH theme={theme} h="Cobranza" sub="Global · último corte por cliente" />

      {loading ? <Loading theme={theme} /> : (
        <>
          <div style={{ padding: '6px 18px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Kpi theme={theme} label="Cartera total" value={fmtCompact(cartera)} delta={`${cli.filter(c => c.cartera > 0).length} clientes`} />
            <Kpi theme={theme} label="Vencida" value={fmtCompact(vencido)} delta={cartera > 0 ? `${Math.round((vencido / cartera) * 100)}% del total` : '—'} positive={vencido === 0} />
            <Kpi theme={theme} label="DSO promedio" value={dsoAvg != null ? `${dsoAvg}d` : '—'} delta={dsoAvg && dsoAvg <= 30 ? 'al día' : 'atención'} positive={dsoAvg != null && dsoAvg <= 30} />
            <Kpi theme={theme} label="Facturas ab." value={facturasAb} delta="todas abiertas" />
          </div>

          <SecH theme={theme} title="Por cliente" sub="tap para detalle" />
          <div style={{ padding: '0 18px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cli.map(c => (
              <button key={c.id} onClick={() => onNavegar(c.id, 'cartera')}
                style={{ width: '100%', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12, textAlign: 'left', cursor: 'pointer', fontFamily: TYPO.fontText, transition: 'transform 160ms cubic-bezier(.34,1.56,.64,1)' }}
                onPointerDown={(e) => e.currentTarget.style.transform = 'scale(.99)'}
                onPointerUp={(e) => e.currentTarget.style.transform = ''}
                onPointerLeave={(e) => e.currentTarget.style.transform = ''}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: c.color, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 12 }}>{c.label.slice(0, 2).toUpperCase()}</div>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 700, letterSpacing: '-.01em', color: theme.text, fontFamily: TYPO.fontDisplay }}>{c.label}</div>
                  <ChevronRight size={14} style={{ color: theme.textSubtle }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <MiniKpi theme={theme} label="Cartera" value={fmtCompact(c.cartera)} sub={`${c.facturas} fact.`} />
                  <MiniKpi theme={theme} label="Vencida" value={fmtCompact(c.vencido)} sub={c.vencido > 0 && c.cartera > 0 ? `${Math.round(c.vencido / c.cartera * 100)}%` : 'OK'} positive={c.vencido === 0} />
                  <MiniKpi theme={theme} label="DSO" value={c.dso != null ? `${c.dso}d` : '—'} sub={c.dso != null && c.dso <= 30 ? 'al día' : 'atención'} positive={c.dso != null && c.dso <= 30} />
                </div>
              </button>
            ))}
          </div>

          {agingTotal > 0 && (
            <>
              <SecH theme={theme} title="Aging consolidado" sub={`${fmtCompact(agingTotal)} vencido`} />
              <div style={{ margin: '4px 18px 20px', padding: 14, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { n: '0-30d', m: agingData.d0_30, c: theme.green || '#34C759' },
                    { n: '31-60d', m: agingData.d31_60, c: theme.orange || '#FF9500' },
                    { n: '61-90d', m: agingData.d61_90, c: theme.pink || '#FF2D55' },
                    { n: '90+', m: agingData.d90plus, c: theme.red || '#FF3B30' },
                  ].map(r => {
                    const pct = agingTotal > 0 ? (r.m / agingTotal) * 100 : 0;
                    return (
                      <div key={r.n} style={{ display: 'grid', gridTemplateColumns: '78px 1fr 78px', alignItems: 'center', gap: 10, fontSize: 12 }}>
                        <span style={{ color: theme.text, fontWeight: 600, fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 11.5 }}>{r.n}</span>
                        <div style={{ height: 8, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: r.c, borderRadius: 4, transition: 'width 400ms cubic-bezier(.32,.72,0,1)' }} />
                        </div>
                        <span style={{ textAlign: 'right', color: r.m > 0 ? theme.text : theme.textSubtle, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{r.m > 0 ? fmtCompact(r.m) : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
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
function MiniKpi({ theme, label, value, sub, positive }) { const color = positive === true ? (theme.green || '#34C759') : positive === false ? (theme.pink || theme.red || '#FF3B30') : theme.textMuted; return (<div><div style={{ fontSize: 9.5, textTransform: 'uppercase', color: theme.textMuted, fontWeight: 700, letterSpacing: '.06em' }}>{label}</div><div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', marginTop: 2, color: theme.text, fontFamily: TYPO.fontDisplay }}>{value}</div>{sub && <div style={{ fontSize: 9.5, fontWeight: 600, marginTop: 1, color }}>{sub}</div>}</div>); }
