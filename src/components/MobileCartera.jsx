// MobileCartera — pestaña interior Cartera / Crédito y Cobranza mobile-native.
// Aplica a Digitalife, Dicotech y PCEL (reemplaza CreditoCobranzaV2 en mobile).
//
// Patrones mobile-native del mockup v3:
//   - Back header
//   - 2×2 KPI tiles (Cartera total, Vencida, DPO, Facturas abiertas)
//   - Uso de línea de crédito (si hay config) con barra
//   - Bar-list Aging con colores semánticos (verde→amarillo→naranja→rosa→rojo)
//   - Bar-list Top facturas vencidas por urgencia

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { CLIENTES } from './Sidebar';

const MES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const fmtMXN = (n) => {
  if (!isFinite(n) || !n) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
};

export default function MobileCartera({ clienteKey, onBack, onNavegar }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const cliente = CLIENTES[clienteKey];
  const hoyMs = useMemo(() => new Date().setHours(0, 0, 0, 0), []);

  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState(null);
  const [detalle, setDetalle] = useState([]);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const { data: cortes } = await supabase.from('estados_cuenta')
          .select('*').eq('cliente', clienteKey)
          .order('fecha_corte', { ascending: false }).limit(1);
        const est = cortes?.[0] || null;
        if (!alive) return;
        setEstado(est);
        if (est) {
          const { data: det } = await supabase.from('estados_cuenta_detalle')
            .select('*').eq('estado_cuenta_id', est.id);
          if (!alive) return;
          setDetalle(det || []);
        }
        const { data: cfg } = await supabase.from('clientes_credito_config')
          .select('*').eq('cliente', clienteKey).maybeSingle();
        if (alive) setConfig(cfg || null);
      } catch (e) {
        if (alive) setError(e.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [clienteKey]);

  const diasAtraso = (f) => {
    if (!f.vencimiento) return 0;
    const v = new Date(f.vencimiento + 'T00:00:00').getTime();
    return Math.max(0, Math.floor((hoyMs - v) / 86400000));
  };

  const facturasConSaldo = useMemo(
    () => (detalle || []).filter(f => Number(f.saldo_actual) > 0),
    [detalle]
  );

  const saldoActual = useMemo(() => {
    const det = facturasConSaldo.reduce((s, f) => s + (Number(f.saldo_actual) || 0), 0);
    return Number(estado?.saldo_actual) > 0 ? Number(estado.saldo_actual) : det;
  }, [facturasConSaldo, estado]);

  const saldoVencido = useMemo(() => {
    const det = facturasConSaldo.filter(f => diasAtraso(f) > 0).reduce((s, f) => s + (Number(f.saldo_actual) || 0), 0);
    return Number(estado?.saldo_vencido) > 0 ? Number(estado.saldo_vencido) : det;
  }, [facturasConSaldo, estado]);

  const vencidasCount = useMemo(
    () => facturasConSaldo.filter(f => diasAtraso(f) > 0).length,
    [facturasConSaldo]
  );

  const dso = useMemo(() => {
    let num = 0, den = 0;
    facturasConSaldo.forEach(f => {
      if (!f.fecha_emision) return;
      const s = Number(f.saldo_actual) || 0;
      const d = Math.floor((hoyMs - new Date(f.fecha_emision + 'T00:00:00').getTime()) / 86400000);
      if (d < 0) return;
      num += s * d; den += s;
    });
    return den > 0 ? Math.round(num / den) : null;
  }, [facturasConSaldo, hoyMs]);

  // Aging
  const aging = useMemo(() => {
    const b = [
      { n: '0-30d',   monto: 0, color: '#34C759' },
      { n: '31-60d',  monto: 0, color: '#FF9500' },
      { n: '61-90d',  monto: 0, color: '#FF2D55' },
      { n: '91-180d', monto: 0, color: '#FF3B30' },
      { n: '180+',    monto: 0, color: '#B00020' },
    ];
    facturasConSaldo.forEach(f => {
      const d = diasAtraso(f);
      if (d <= 0) return;
      const s = Number(f.saldo_actual) || 0;
      if (d <= 30) b[0].monto += s;
      else if (d <= 60) b[1].monto += s;
      else if (d <= 90) b[2].monto += s;
      else if (d <= 180) b[3].monto += s;
      else b[4].monto += s;
    });
    const total = b.reduce((s, x) => s + x.monto, 0);
    return { rows: b.map(x => ({ ...x, pct: total > 0 ? (x.monto / total) * 100 : 0 })), total };
  }, [facturasConSaldo]);

  // Top facturas vencidas
  const topVencidas = useMemo(() => {
    return facturasConSaldo
      .filter(f => diasAtraso(f) > 0)
      .map(f => ({
        n: f.factura || f.folio || f.no_factura || `#${f.id?.slice?.(0, 6) || ''}`,
        monto: Number(f.saldo_actual) || 0,
        dias: diasAtraso(f),
      }))
      .sort((a, b) => b.dias - a.dias)
      .slice(0, 5);
  }, [facturasConSaldo]);

  // Uso de línea
  const linea = useMemo(() => {
    if (!config) return null;
    const tc = 17; // fallback si no hay tabla
    const lineaUSD = Number(config.linea_credito_usd) || 0;
    const lineaMXNPagare = Number(config.linea_credito_mxn_pagare) || 0;
    const total = lineaUSD * tc + lineaMXNPagare;
    if (total <= 0) return null;
    const pct = Math.min(Math.round((saldoActual / total) * 100), 999);
    return { total, pct };
  }, [config, saldoActual]);

  const fechaCorte = estado?.fecha_corte
    ? new Date(estado.fecha_corte + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
    : null;

  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100vh' }}>
      {/* Back header */}
      <div style={{ padding: '10px 18px 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack}
          style={{ background: 'transparent', border: 'none', padding: '6px 10px', color: theme.accent, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}
        >
          <ChevronLeft size={16} strokeWidth={2.2} /> Cliente
        </button>
        <span style={{ fontSize: 12.5, color: theme.textMuted, fontWeight: 600 }}>{cliente?.label || clienteKey}</span>
      </div>

      {/* Título */}
      <div style={{ padding: '2px 18px 6px' }}>
        <h1 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 32, fontWeight: 700, letterSpacing: '-.03em', color: theme.text }}>Cartera</h1>
        <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 2 }}>
          {fechaCorte ? `Corte ${fechaCorte}` : 'Sin corte reciente'}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>Cargando…</div>
      ) : error ? (
        <div style={{ margin: '4px 18px', padding: 16, background: 'rgba(255,59,48,.10)', border: '1px solid rgba(255,59,48,.22)', borderRadius: 12, color: theme.red || '#FF3B30', fontSize: 12.5 }}>{error}</div>
      ) : !estado ? (
        <div style={{ margin: '4px 18px', padding: 24, background: theme.surface, border: `1px dashed ${theme.border}`, borderRadius: 12, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>
          Sin estado de cuenta cargado. Sube uno desde Actualización de datos.
        </div>
      ) : (
        <>
          {/* 2×2 KPI tiles */}
          <div style={{ padding: '10px 18px 6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <KpiTile theme={theme} label="Cartera total"
              value={fmtMXN(saldoActual)}
              delta={vencidasCount > 0 ? `${vencidasCount} facturas vencidas` : 'sin vencidas'}
              positive={vencidasCount === 0} />
            <KpiTile theme={theme} label="Vencida"
              value={fmtMXN(saldoVencido)}
              delta={saldoActual > 0 ? `${Math.round((saldoVencido / saldoActual) * 100)}% del total` : '—'}
              positive={saldoVencido === 0} />
            <KpiTile theme={theme} label="DSO real"
              value={dso != null ? `${dso}d` : '—'}
              delta={dso != null && dso <= 30 ? 'sano' : dso != null && dso <= 60 ? 'atención' : dso != null ? 'crítico' : ''}
              positive={dso != null && dso <= 30 ? true : dso != null && dso > 60 ? false : undefined} />
            <KpiTile theme={theme} label="Facturas abiertas"
              value={facturasConSaldo.length}
              delta={`${vencidasCount} vencidas`} />
          </div>

          {/* Uso línea de crédito */}
          {linea && (
            <>
              <SectionHead theme={theme} title="Línea de crédito" sub={fmtMXN(linea.total)} />
              <div style={{ margin: '4px 18px 8px', padding: 14, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 600 }}>Uso</span>
                  <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', color: theme.text, fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums' }}>{linea.pct}%</span>
                </div>
                <div style={{ height: 10, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${Math.min(100, linea.pct)}%`,
                    background: linea.pct > 90 ? (theme.red || '#FF3B30') : linea.pct > 75 ? (theme.orange || '#FF9500') : (theme.green || '#34C759'),
                    borderRadius: 5, transition: 'width 400ms cubic-bezier(.4,0,.2,1)',
                  }} />
                </div>
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Usado {fmtMXN(saldoActual)}</span>
                  <span>Disponible {fmtMXN(Math.max(0, linea.total - saldoActual))}</span>
                </div>
              </div>
            </>
          )}

          {/* Aging bar-list */}
          {aging.total > 0 && (
            <>
              <SectionHead theme={theme} title="Aging" sub={fmtMXN(aging.total)} />
              <div style={{ margin: '4px 18px 8px', padding: 14, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {aging.rows.map((r) => (
                    <div key={r.n} style={{ display: 'grid', gridTemplateColumns: '78px 1fr 78px', alignItems: 'center', gap: 10, fontSize: 12 }}>
                      <span style={{ color: theme.text, fontWeight: 600, fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 11.5 }}>{r.n}</span>
                      <div style={{ height: 8, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${r.pct}%`, background: r.color, borderRadius: 4, transition: 'width 400ms cubic-bezier(.4,0,.2,1)' }} />
                      </div>
                      <span style={{ textAlign: 'right', color: r.monto > 0 ? theme.text : theme.textSubtle, fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 12 }}>{r.monto > 0 ? fmtMXN(r.monto) : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Top facturas vencidas */}
          {topVencidas.length > 0 && (
            <>
              <SectionHead theme={theme} title="Top facturas vencidas" sub="Requieren acción" />
              <div style={{ margin: '4px 18px 8px', padding: 14, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {topVencidas.map((r) => {
                    const maxDias = topVencidas[0]?.dias || 1;
                    const pct = Math.min(100, (r.dias / maxDias) * 100);
                    const color = r.dias > 180 ? '#B00020' : r.dias > 90 ? '#FF3B30' : r.dias > 60 ? '#FF2D55' : r.dias > 30 ? '#FF9500' : '#FFCC00';
                    return (
                      <div key={r.n} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 92px', alignItems: 'center', gap: 10, fontSize: 12 }}>
                        <span style={{ color: theme.text, fontWeight: 600, fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.n}</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <div style={{ height: 8, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 400ms cubic-bezier(.4,0,.2,1)' }} />
                          </div>
                          <span style={{ fontSize: 10.5, color: theme.textMuted, fontWeight: 600 }}>{r.dias}d de atraso</span>
                        </div>
                        <span style={{ textAlign: 'right', color: theme.text, fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 12 }}>{fmtMXN(r.monto)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Detalle facturas (todas) */}
          <SectionHead theme={theme} title={`Todas las facturas · ${facturasConSaldo.length}`} />
          <div style={{ padding: '0 18px 24px' }}>
            {facturasConSaldo.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: theme.textMuted, fontSize: 13, background: theme.surface, border: `1px dashed ${theme.border}`, borderRadius: 12, marginTop: 8 }}>
                Sin facturas abiertas
              </div>
            )}
            {facturasConSaldo
              .slice()
              .sort((a, b) => diasAtraso(b) - diasAtraso(a))
              .slice(0, 40)
              .map((f, i) => {
                const dAtr = diasAtraso(f);
                const emision = f.fecha_emision ? new Date(f.fecha_emision + 'T00:00:00') : null;
                const venc = f.vencimiento ? new Date(f.vencimiento + 'T00:00:00') : null;
                const color = dAtr === 0 ? theme.green || '#34C759'
                  : dAtr <= 30 ? '#FF9500'
                  : dAtr <= 60 ? '#FF2D55'
                  : dAtr <= 180 ? '#FF3B30' : '#B00020';
                return (
                  <div key={f.id || i} style={{
                    padding: '10px 0', borderTop: `1px solid ${theme.divider}`,
                    display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px', alignItems: 'center',
                  }}>
                    <div style={{ fontSize: 11.5, color: theme.textMuted, fontFamily: '"SF Mono", ui-monospace, monospace', gridColumn: 1 }}>
                      {f.factura || f.folio || f.no_factura || '—'}
                    </div>
                    <div style={{ fontSize: 12, color: theme.text, gridColumn: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flex: '0 0 auto' }} />
                      {emision ? `${emision.getDate()} ${MES_CORTO[emision.getMonth()]}` : '—'}
                      {venc && <> · vence {venc.getDate()} {MES_CORTO[venc.getMonth()]}</>}
                      {dAtr > 0 && <span style={{ color, fontWeight: 700 }}>· {dAtr}d</span>}
                    </div>
                    <div style={{ gridColumn: 2, gridRow: '1 / span 2', alignSelf: 'center', textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: theme.text, fontFamily: TYPO.fontDisplay }}>
                        {fmtMXN(Number(f.saldo_actual))}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}

function KpiTile({ theme, label, value, delta, positive }) {
  const color = positive === true ? (theme.green || '#34C759') : positive === false ? (theme.pink || theme.red || '#FF3B30') : theme.textMuted;
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: theme.textMuted, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', marginTop: 2, color: theme.text, fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontDisplay }}>{value}</div>
      {delta && <div style={{ fontSize: 10.5, fontWeight: 600, marginTop: 1, color }}>{delta}</div>}
    </div>
  );
}

function SectionHead({ theme, title, sub }) {
  return (
    <div style={{ padding: '12px 18px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.01em', color: theme.text, fontFamily: TYPO.fontDisplay }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: theme.textMuted }}>{sub}</div>}
    </div>
  );
}
