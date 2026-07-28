// MobileTrackingPedidos — OCs abiertas mobile (read-only).

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { CLIENTES } from './Sidebar';

const CLIENTE_DOT = { digitalife: '#5856D6', dicotech: '#FF9500', pcel: '#34C759' };
const fmtCompact = (n) => { if (!isFinite(n) || !n) return '$0'; const a = Math.abs(n), s = n < 0 ? '-' : ''; if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}K`; return `${s}$${Math.round(a)}`; };
const fmtInt = (n) => (isFinite(n) ? Math.round(n).toLocaleString('es-MX') : '—');
const safeQuery = async (q) => { try { const r = await q; return r.data || []; } catch { return []; } };

const ETAPAS = {
  cotizacion: { label: 'Cotización', color: '#5856D6' },
  procesada:  { label: 'Procesada', color: '#5AC8FA' },
  surtido:    { label: 'Surtido', color: '#FF9500' },
  enviado:    { label: 'Enviado', color: '#34C759' },
  entregado:  { label: 'Entregado', color: '#34C759' },
  facturado:  { label: 'Facturada', color: '#007AFF' },
};

export default function MobileTrackingPedidos({ onBack, onNavegar }) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [ocs, setOcs] = useState([]);
  const [skus, setSkus] = useState([]);
  const [envios, setEnvios] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [o, s, e] = await Promise.all([
        safeQuery(supabase.from('oc_clientes').select('*').order('created_at', { ascending: false })),
        safeQuery(supabase.from('oc_clientes_skus').select('oc_id,cantidad_ordenada,precio_unitario')),
        safeQuery(supabase.from('oc_envios').select('oc_id,fecha_envio')),
      ]);
      if (!alive) return;
      setOcs(o); setSkus(s); setEnvios(e); setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const ocsEnriched = useMemo(() => {
    const now = new Date();
    return ocs.map(oc => {
      const skusOc = skus.filter(x => x.oc_id === oc.id);
      const monto = skusOc.reduce((s, x) => s + ((Number(x.cantidad_ordenada) || 0) * (Number(x.precio_unitario) || 0)), 0);
      const piezas = skusOc.reduce((s, x) => s + (Number(x.cantidad_ordenada) || 0), 0);
      const enviosOc = envios.filter(x => x.oc_id === oc.id);
      // Determinar etapa por fechas
      let etapa = 'cotizacion';
      if (oc.fecha_facturacion) etapa = 'facturado';
      else if (enviosOc.length > 0) etapa = 'enviado';
      else if (oc.fecha_surtido) etapa = 'surtido';
      else if (oc.fecha_procesada) etapa = 'procesada';
      // Días sin avance
      const ultFecha = oc.fecha_facturacion || (enviosOc[0]?.fecha_envio) || oc.fecha_surtido || oc.fecha_procesada || oc.fecha_recibida;
      const dias = ultFecha ? Math.floor((now - new Date(ultFecha)) / 86400000) : 0;
      return { ...oc, monto, piezas, etapa, dias, envios: enviosOc.length };
    });
  }, [ocs, skus, envios]);

  const abiertas = useMemo(() => ocsEnriched.filter(oc => oc.etapa !== 'facturado' && oc.etapa !== 'entregado'), [ocsEnriched]);
  const retrasadas = useMemo(() => abiertas.filter(oc => oc.dias > 10), [abiertas]);
  const montoAbiertas = useMemo(() => abiertas.reduce((s, oc) => s + oc.monto, 0), [abiertas]);
  const montoRetrasadas = useMemo(() => retrasadas.reduce((s, oc) => s + oc.monto, 0), [retrasadas]);

  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100vh' }}>
      <BackHdr theme={theme} onBack={onBack} eyebrow="Interno · Clientes Propios" />
      <TitleH theme={theme} h="Tracking Pedidos" sub={`${abiertas.length} OCs abiertas · ${fmtCompact(montoAbiertas)}`} />

      {loading ? <Loading theme={theme} /> : (
        <>
          <div style={{ padding: '6px 18px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Kpi theme={theme} label="OCs abiertas" value={abiertas.length} delta={fmtCompact(montoAbiertas)} />
            <Kpi theme={theme} label="Retrasadas" value={retrasadas.length} delta={retrasadas.length > 0 ? 'urgente' : 'sin retrasos'} positive={retrasadas.length === 0} />
            <Kpi theme={theme} label="Sin factura" value={abiertas.filter(oc => !oc.numero_factura).length} delta="pendiente facturar" />
            <Kpi theme={theme} label="Envíos activos" value={abiertas.reduce((s, oc) => s + (oc.envios || 0), 0)} delta="en camino" />
          </div>

          {retrasadas.length > 0 && (
            <div style={{ margin: '4px 18px 10px', padding: '12px 14px', background: 'rgba(255,59,48,.10)', border: '1px solid rgba(255,59,48,.22)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: theme.red || '#FF3B30', color: '#fff', display: 'grid', placeItems: 'center' }}>
                <AlertTriangle size={16} strokeWidth={2.2} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{retrasadas.length} OCs con retraso &gt;10d</div>
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>Total {fmtCompact(montoRetrasadas)} en riesgo</div>
              </div>
            </div>
          )}

          <SecH theme={theme} title="OCs abiertas" sub={`${abiertas.length}`} />
          <div style={{ padding: '0 18px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {abiertas.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: theme.textMuted, fontSize: 13, background: theme.surface, border: `1px dashed ${theme.border}`, borderRadius: 12 }}>Sin OCs abiertas</div>
            )}
            {abiertas.slice(0, 25).map(oc => {
              const cliCol = CLIENTE_DOT[oc.cliente_key] || theme.accent;
              const etapa = ETAPAS[oc.etapa] || { label: oc.etapa, color: theme.textMuted };
              const isRetrasada = oc.dias > 10;
              return (
                <div key={oc.id} style={{
                  background: theme.surface,
                  border: `1px solid ${isRetrasada ? 'rgba(255,59,48,.30)' : theme.border}`,
                  borderRadius: 14, padding: '10px 12px', fontFamily: TYPO.fontText,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: cliCol, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 11, fontFamily: TYPO.fontDisplay }}>{(CLIENTES[oc.cliente_key]?.label || '?').slice(0, 2).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>
                        {oc.numero_oc ? `OC ${oc.numero_oc}` : oc.numero_oc_cliente ? `OS ${oc.numero_oc_cliente}` : '(sin número)'}
                      </div>
                      <div style={{ fontSize: 10.5, color: isRetrasada ? (theme.red || '#FF3B30') : theme.textMuted, marginTop: 2 }}>
                        {CLIENTES[oc.cliente_key]?.label} · {isRetrasada ? `Retraso ${oc.dias}d` : `${oc.dias}d en ${etapa.label}`}
                      </div>
                    </div>
                    <span style={{
                      padding: '2px 8px', borderRadius: 100,
                      background: isRetrasada ? 'rgba(255,59,48,.14)' : `${etapa.color}22`,
                      color: isRetrasada ? (theme.red || '#FF3B30') : etapa.color,
                      fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em',
                    }}>{isRetrasada ? 'Retraso' : etapa.label}</span>
                  </div>
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${theme.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: theme.textMuted, fontWeight: 700 }}>{fmtInt(oc.piezas)} pz · {oc.envios || 0} env.</span>
                    <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{fmtCompact(oc.monto)}</span>
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

function BackHdr({ theme, onBack, eyebrow }) { return (<div style={{ padding: '10px 18px 6px', display: 'flex', alignItems: 'center', gap: 10 }}><button onClick={onBack} style={{ background: 'transparent', border: 'none', padding: '6px 10px', color: theme.accent, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}><ChevronLeft size={16} strokeWidth={2.2} /> Inicio</button><span style={{ fontSize: 12.5, color: theme.textMuted, fontWeight: 600 }}>{eyebrow}</span></div>); }
function TitleH({ theme, h, sub }) { return (<div style={{ padding: '2px 18px 6px' }}><h1 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 30, fontWeight: 700, letterSpacing: '-.03em', color: theme.text }}>{h}</h1>{sub && <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 2 }}>{sub}</div>}</div>); }
function Kpi({ theme, label, value, delta, positive }) { const color = positive === true ? (theme.green || '#34C759') : positive === false ? (theme.pink || theme.red || '#FF3B30') : theme.textMuted; return (<div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12 }}><div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: theme.textMuted, fontWeight: 700 }}>{label}</div><div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', marginTop: 2, color: theme.text, fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontDisplay }}>{value}</div>{delta && <div style={{ fontSize: 10.5, fontWeight: 600, marginTop: 1, color }}>{delta}</div>}</div>); }
function SecH({ theme, title, sub }) { return (<div style={{ padding: '12px 18px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.01em', color: theme.text, fontFamily: TYPO.fontDisplay }}>{title}</div>{sub && <div style={{ fontSize: 11, color: theme.textMuted }}>{sub}</div>}</div>); }
function Loading({ theme }) { return <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>Cargando…</div>; }
