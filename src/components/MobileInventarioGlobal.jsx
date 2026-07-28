// MobileInventarioGlobal — Inventario Acteck + Cliente consolidado mobile.

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';

const FAM_COLORS = ['#007AFF', '#FF2D55', '#FF9500', '#5856D6', '#AF52DE', '#34C759', '#5AC8FA', '#FFCC00'];

const fmtCompact = (n) => {
  if (!isFinite(n) || !n) return '$0';
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}K`;
  return `${s}$${Math.round(a)}`;
};
const fmtInt = (n) => (isFinite(n) ? Math.round(n).toLocaleString('es-MX') : '—');
const safeQuery = async (q) => { try { const r = await q; return r.data || []; } catch { return []; } };

async function fetchAll(table, select, applyFilter = q => q) {
  const PAGE = 1000; let acc = [], from = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(from, from + PAGE - 1);
    q = applyFilter(q);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    acc = acc.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return acc;
}

export default function MobileInventarioGlobal({ onBack, onNavegar }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const [loading, setLoading] = useState(true);
  const [invActeck, setInvActeck] = useState([]);
  const [invCliente, setInvCliente] = useState([]);
  const [roadmap, setRoadmap] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [ia, ic, r] = await Promise.all([
        fetchAll('inventario_acteck', 'sku,stock,valor_mxn'),
        fetchAll('inventario_cliente', 'sku,stock,valor,precio_venta,fecha_ultima_venta,dias_sin_venta'),
        fetchAll('roadmap_sku', 'sku,marca,descripcion,familia'),
      ]);
      if (!alive) return;
      setInvActeck(ia); setInvCliente(ic); setRoadmap(r); setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const roadmapMap = useMemo(() => { const m = new Map(); roadmap.forEach(r => m.set(r.sku, r)); return m; }, [roadmap]);

  const valorActeck = useMemo(() => invActeck.reduce((s, r) => s + (Number(r.valor_mxn) || 0), 0), [invActeck]);
  const valorCliente = useMemo(() => invCliente.reduce((s, r) => s + (Number(r.valor) || 0), 0), [invCliente]);
  const valorTotal = valorActeck + valorCliente;
  const skusTotal = useMemo(() => { const s = new Set(); invActeck.forEach(r => s.add(r.sku)); invCliente.forEach(r => s.add(r.sku)); return s.size; }, [invActeck, invCliente]);

  const agotados = useMemo(() => invActeck.filter(r => Number(r.stock) === 0 || Number(r.stock) < 0), [invActeck]);
  const bajaRotacion = useMemo(() => invCliente.filter(r => Number(r.dias_sin_venta) > 90).slice(0, 10), [invCliente]);

  const porFamilia = useMemo(() => {
    const m = new Map();
    invActeck.forEach(r => {
      const fam = (roadmapMap.get(r.sku)?.familia || 'Sin familia').trim();
      if (!m.has(fam)) m.set(fam, 0);
      m.set(fam, m.get(fam) + (Number(r.valor_mxn) || 0));
    });
    const arr = Array.from(m.entries()).map(([k, v], i) => ({ k, label: k, monto: v, color: FAM_COLORS[i % FAM_COLORS.length] })).sort((a, b) => b.monto - a.monto);
    const total = arr.reduce((s, r) => s + r.monto, 0);
    return arr.map(r => ({ ...r, pct: total > 0 ? (r.monto / total) * 100 : 0 })).slice(0, 8);
  }, [invActeck, roadmapMap]);

  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100vh' }}>
      <BackHdr theme={theme} onBack={onBack} eyebrow="Dirección Comercial" />
      <TitleH theme={theme} h="Inventario" sub="Snapshot actual" />

      {loading ? <Loading theme={theme} /> : (
        <>
          <div style={{ padding: '6px 18px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Kpi theme={theme} label="Valor total" value={fmtCompact(valorTotal)} delta="Acteck + Cliente" />
            <Kpi theme={theme} label="SKUs" value={fmtInt(skusTotal)} delta="activos" />
            <Kpi theme={theme} label="Agotados" value={fmtInt(agotados.length)} delta={agotados.length > 0 ? 'urgente' : 'sin agotados'} positive={agotados.length === 0} />
            <Kpi theme={theme} label="Valor Acteck" value={fmtCompact(valorActeck)} delta={`Cliente ${fmtCompact(valorCliente)}`} />
          </div>

          {agotados.length > 0 && (
            <button onClick={() => onNavegar(null, 'inventarioGlobal')}
              style={{ width: 'calc(100% - 36px)', margin: '4px 18px 10px', padding: '12px 14px', background: 'rgba(255,59,48,.10)', border: '1px solid rgba(255,59,48,.22)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: TYPO.fontText, textAlign: 'left' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: theme.red || '#FF3B30', color: '#fff', display: 'grid', placeItems: 'center' }}>
                <AlertTriangle size={16} strokeWidth={2.2} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{agotados.length} SKUs agotados</div>
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>Revisa reposición inmediata</div>
              </div>
            </button>
          )}

          {porFamilia.length > 0 && <BarList theme={theme} isDark={isDark} title="Por familia" sub="Acteck" data={porFamilia} />}

          <SecH theme={theme} title={`Baja rotación · >90d sin venta`} sub={`${bajaRotacion.length}`} />
          <div style={{ padding: '0 18px 24px' }}>
            {bajaRotacion.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: theme.textMuted, fontSize: 13, background: theme.surface, border: `1px dashed ${theme.border}`, borderRadius: 12 }}>Sin SKUs de baja rotación</div>
            ) : bajaRotacion.map(r => {
              const rm = roadmapMap.get(r.sku);
              return (
                <div key={r.sku} style={{ padding: '10px 0', borderTop: `1px solid ${theme.divider}`, display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px' }}>
                  <div style={{ fontSize: 11.5, color: theme.textMuted, fontFamily: '"SF Mono", ui-monospace, monospace', gridColumn: 1 }}>{r.sku}</div>
                  <div style={{ fontSize: 13, color: theme.text, fontWeight: 600, gridColumn: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{rm?.descripcion || '(sin descripción)'}</div>
                  <div style={{ gridColumn: 2, gridRow: '1 / span 2', alignSelf: 'center', textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: theme.text, fontFamily: TYPO.fontDisplay }}>{fmtCompact(Number(r.valor) || 0)}</div>
                    <div style={{ fontSize: 10.5, color: theme.pink || theme.red || '#FF3B30' }}>{r.dias_sin_venta}d</div>
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
function BarList({ theme, isDark, title, sub, data }) { const total = data.reduce((s, r) => s + r.monto, 0); return (<><SecH theme={theme} title={title} sub={sub ? `${sub} · ${fmtCompact(total)}` : fmtCompact(total)} /><div style={{ margin: '4px 18px 8px', padding: 14, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16 }}><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{data.map((r, i) => (<div key={r.k || r.label || i} style={{ display: 'grid', gridTemplateColumns: '82px 1fr 78px', alignItems: 'center', gap: 10, fontSize: 12 }}><span style={{ color: theme.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span><div style={{ height: 8, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${r.pct}%`, background: r.color || theme.accent, borderRadius: 4, transition: 'width 400ms cubic-bezier(.32,.72,0,1)' }} /></div><span style={{ textAlign: 'right', color: theme.text, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmtCompact(r.monto)}</span></div>))}</div></div></>); }
