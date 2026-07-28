// MobilePropuestas — Landing read-only de propuestas mobile.

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { CLIENTES } from './Sidebar';

const CLIENTE_DOT = { digitalife: '#5856D6', dicotech: '#FF9500', pcel: '#34C759' };
const fmtCompact = (n) => { if (!isFinite(n) || !n) return '$0'; const a = Math.abs(n); if (a >= 1e6) return `$${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `$${(a / 1e3).toFixed(0)}K`; return `$${Math.round(a)}`; };
const fmtInt = (n) => (isFinite(n) ? Math.round(n).toLocaleString('es-MX') : '—');

const loadPropuestas = () => { try { return JSON.parse(localStorage.getItem('propuestas_recientes_v1') || '[]'); } catch { return []; } };
const timeAgo = (ts) => {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `hace ${s}s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)}m`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)}h`;
  return `hace ${Math.floor(s / 86400)}d`;
};

export default function MobilePropuestas({ onBack, onNavegar }) {
  const { theme } = useTheme();
  const [tick, setTick] = useState(0);
  const propuestas = useMemo(() => loadPropuestas(), [tick]);

  const kpis = useMemo(() => {
    const activas = propuestas.filter(p => p.estado !== 'Cerrada').length;
    const borradores = propuestas.filter(p => p.estado === 'Borrador' || !p.estado).length;
    const enviadas = propuestas.filter(p => p.estado === 'Enviada').length;
    const mesActual = new Date().getMonth() + 1;
    const enviadasMes = propuestas.filter(p => p.estado === 'Enviada' && p.tstamp && new Date(p.tstamp).getMonth() + 1 === mesActual);
    const totalMes = enviadasMes.reduce((s, p) => s + (p.resumen?.total || 0), 0);
    const cerradas = propuestas.filter(p => p.estado === 'Cerrada').length;
    const tasa = (cerradas + enviadas) > 0 ? Math.round((cerradas / (cerradas + enviadas)) * 100) : 0;
    return { activas, borradores, enviadas: enviadasMes.length, totalMes, tasa };
  }, [propuestas]);

  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100vh' }}>
      <BackHdr theme={theme} onBack={onBack} eyebrow="Interno · Clientes Propios" />
      <TitleH theme={theme} h="Propuestas" sub={`${kpis.activas} activas · ${kpis.borradores} borradores`} />

      <div style={{ padding: '6px 18px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Kpi theme={theme} label="Activas" value={kpis.activas} delta="en revisión" />
        <Kpi theme={theme} label="Borradores" value={kpis.borradores} delta="sin enviar" />
        <Kpi theme={theme} label="Enviadas mes" value={kpis.enviadas} delta={kpis.totalMes ? fmtCompact(kpis.totalMes) : '—'} positive={kpis.enviadas > 0} />
        <Kpi theme={theme} label="Tasa cierre" value={`${kpis.tasa}%`} delta="últimos 90d" positive={kpis.tasa >= 50} />
      </div>

      <SecH theme={theme} title="Recientes" sub={`${propuestas.length}`} />
      <div style={{ padding: '0 18px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {propuestas.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: theme.textMuted, fontSize: 13, background: theme.surface, border: `1px dashed ${theme.border}`, borderRadius: 12 }}>Sin propuestas todavía</div>
        )}
        {propuestas.slice(0, 20).map(p => {
          const cliCol = CLIENTE_DOT[p.clienteKey] || theme.accent;
          const badge = p.estado === 'Enviada' ? { bg: 'rgba(52,199,89,.14)', c: theme.green || '#34C759' } : p.estado === 'Cerrada' ? { bg: 'rgba(0,122,255,.14)', c: theme.accent } : { bg: 'rgba(255,149,0,.14)', c: theme.orange || '#FF9500' };
          return (
            <div key={p.id} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '12px 14px', fontFamily: TYPO.fontText }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: cliCol, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 11, fontFamily: TYPO.fontDisplay }}>{(p.clienteLabel || p.clienteKey || '?').slice(0, 2).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre || `Propuesta ${p.clienteLabel || p.clienteKey}`}</div>
                  <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 2 }}>{p.clienteLabel || p.clienteKey} · {p.tstamp ? timeAgo(p.tstamp) : ''}</div>
                </div>
                <span style={{ padding: '2px 8px', borderRadius: 100, background: badge.bg, color: badge.c, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{p.estado || 'Borrador'}</span>
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${theme.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: theme.textMuted, fontWeight: 700 }}>{p.resumen?.skus || 0} SKUs · {fmtInt(p.resumen?.piezas || 0)}pz</span>
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{fmtCompact(p.resumen?.total || 0)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <SecH theme={theme} title="Nueva propuesta" />
      <div style={{ margin: '4px 18px 24px', padding: 20, background: theme.surface, border: `1px dashed ${theme.border}`, borderRadius: 12, textAlign: 'center', color: theme.textMuted, fontSize: 12, lineHeight: 1.5 }}>
        La creación y edición se hace desde <b style={{ color: theme.text }}>desktop</b>.<br />En mobile puedes ver los borradores y su estado.
      </div>
    </div>
  );
}

function BackHdr({ theme, onBack, eyebrow }) { return (<div style={{ padding: '10px 18px 6px', display: 'flex', alignItems: 'center', gap: 10 }}><button onClick={onBack} style={{ background: 'transparent', border: 'none', padding: '6px 10px', color: theme.accent, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}><ChevronLeft size={16} strokeWidth={2.2} /> Inicio</button><span style={{ fontSize: 12.5, color: theme.textMuted, fontWeight: 600 }}>{eyebrow}</span></div>); }
function TitleH({ theme, h, sub }) { return (<div style={{ padding: '2px 18px 6px' }}><h1 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 30, fontWeight: 700, letterSpacing: '-.03em', color: theme.text }}>{h}</h1>{sub && <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 2 }}>{sub}</div>}</div>); }
function Kpi({ theme, label, value, delta, positive }) { const color = positive === true ? (theme.green || '#34C759') : positive === false ? (theme.pink || theme.red || '#FF3B30') : theme.textMuted; return (<div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12 }}><div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: theme.textMuted, fontWeight: 700 }}>{label}</div><div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', marginTop: 2, color: theme.text, fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontDisplay }}>{value}</div>{delta && <div style={{ fontSize: 10.5, fontWeight: 600, marginTop: 1, color }}>{delta}</div>}</div>); }
function SecH({ theme, title, sub }) { return (<div style={{ padding: '12px 18px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.01em', color: theme.text, fontFamily: TYPO.fontDisplay }}>{title}</div>{sub && <div style={{ fontSize: 11, color: theme.textMuted }}>{sub}</div>}</div>); }
