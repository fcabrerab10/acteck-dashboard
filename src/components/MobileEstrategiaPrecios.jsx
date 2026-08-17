// MobileEstrategiaPrecios — Listas de precios y oportunidades mobile.

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { CLIENTES } from './Sidebar';

const CLIENTE_DOT = { digitalife: '#5856D6', dicotech: '#FF9500', pcel: '#34C759' };
const fmtInt = (n) => (isFinite(n) ? Math.round(n).toLocaleString('es-MX') : '—');
const fmtCompact = (n) => { if (!isFinite(n) || !n) return '$0'; const a = Math.abs(n), s = n < 0 ? '-' : ''; if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}K`; return `${s}$${Math.round(a)}`; };
const safeQuery = async (q) => { try { const r = await q; return r.data || []; } catch { return []; } };

async function fetchAll(table, select, applyFilter = q => q) {
  // sellout_general devuelve HTTP 500 intermitente con ilike+range+order
  // (índice no cubre bien el filtro). Usamos chunks de 500 para tablas de
  // transacciones y de 1000 para el resto. También subimos retries a 6
  // porque en producción se observaron rachas de 3 500s consecutivos.
  const HEAVY_TABLES = new Set(['sellout_general', 'sellout_detalle', 'facturacion_clientes']);
  const PAGE = HEAVY_TABLES.has(table) ? 500 : 1000;
  const MAX_RETRIES = 6;
  const BACKOFF = [500, 1000, 2000, 4000, 8000, 16000];

  const acc = [];
  // BUG-FIX: cuando select === '*' o el primer campo es '*', antes se ejecutaba
    // .order('*') y Supabase respondía HTTP 400 → 6 retries fallaban → throw →
    // React Query devolvía data:[] silenciosamente.
    const orderCol = (() => {
      if (!select || select === '*') return 'id';
      if (/(^|,)\s*id\s*(,|$)/i.test(select)) return 'id';
      const first = select.split(',')[0].trim();
      return first === '*' ? 'id' : first;
    })();
  let from = 0;
  while (true) {
    let lastErr = null; let data = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let q = supabase.from(table).select(select).order(orderCol, { ascending: true }).range(from, from + PAGE - 1);
      q = applyFilter(q);
      const res = await q;
      if (!res.error) { data = res.data || []; break; }
      lastErr = res.error;
      if (attempt < MAX_RETRIES - 1) {
        console.warn(`[fetchAll] ${table} chunk from=${from} attempt ${attempt + 1} falló (retry en ${BACKOFF[attempt]}ms):`, lastErr?.message || lastErr);
        await new Promise((r) => setTimeout(r, BACKOFF[attempt]));
      }
    }
    if (data == null) {
      // Falló definitivamente. Lanzamos throw para que el useEffect muestre
      // error visible en vez de renderizar data parcial (que es exactamente
      // lo que causaba discrepancias entre usuarios).
      console.error(`[fetchAll] ${table} chunk from=${from} falló tras ${MAX_RETRIES} intentos. DATA INCOMPLETA — abortando para no mostrar números incorrectos.`);
      throw new Error(`No se pudo cargar ${table} completo (chunk ${from}). Refresca la página. Detalle: ${lastErr?.message || 'error desconocido'}`);
    }
    if (data.length === 0) break;
    acc.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return acc;
}

export default function MobileEstrategiaPrecios({ onBack, onNavegar }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const [loading, setLoading] = useState(true);
  const [precios, setPrecios] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const p = await fetchAll('precios_sku', 'sku,cliente,precio,updated_at');
      if (!alive) return;
      setPrecios(p); setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const kpis = useMemo(() => {
    const total = precios.length;
    const skusUnicos = new Set(precios.map(p => p.sku)).size;
    const now = new Date();
    const mesActual = now.getMonth();
    const anioActual = now.getFullYear();
    const cambiadosMes = precios.filter(p => {
      if (!p.updated_at) return false;
      const d = new Date(p.updated_at);
      return d.getMonth() === mesActual && d.getFullYear() === anioActual;
    }).length;
    return { total, skusUnicos, cambiadosMes };
  }, [precios]);

  const porCliente = useMemo(() => {
    const m = new Map();
    precios.forEach(p => { m.set(p.cliente, (m.get(p.cliente) || 0) + 1); });
    return Array.from(m.entries()).map(([k, v]) => ({
      k, label: CLIENTES[k]?.label || k, color: CLIENTE_DOT[k] || theme.accent, count: v,
    })).sort((a, b) => b.count - a.count);
  }, [precios, theme.accent]);
  const maxCount = Math.max(...porCliente.map(c => c.count), 1);

  const ultimos = useMemo(() => {
    return precios.filter(p => p.updated_at).slice().sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 10);
  }, [precios]);

  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100vh' }}>
      <BackHdr theme={theme} onBack={onBack} eyebrow="Interno · Clientes Propios" />
      <TitleH theme={theme} h="Precios" sub="Listas activas por cliente" />

      {loading ? <Loading theme={theme} /> : (
        <>
          <div style={{ padding: '6px 18px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Kpi theme={theme} label="Precios totales" value={fmtInt(kpis.total)} delta="registros" />
            <Kpi theme={theme} label="SKUs únicos" value={fmtInt(kpis.skusUnicos)} delta="con lista" />
            <Kpi theme={theme} label="Cambiados mes" value={fmtInt(kpis.cambiadosMes)} delta="actualizaciones" positive={kpis.cambiadosMes > 0} />
            <Kpi theme={theme} label="Clientes" value={porCliente.length} delta={`de ${Object.keys(CLIENTES).filter(k => CLIENTES[k].activo).length}`} />
          </div>

          <SecH theme={theme} title="Listas por cliente" />
          <div style={{ margin: '4px 18px 8px', padding: 14, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {porCliente.map(c => (
                <div key={c.k} style={{ display: 'grid', gridTemplateColumns: '82px 1fr 78px', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <span style={{ color: theme.text, fontWeight: 600 }}>{c.label}</span>
                  <div style={{ height: 8, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(c.count / maxCount) * 100}%`, background: c.color, borderRadius: 4, transition: 'width 400ms cubic-bezier(.32,.72,0,1)' }} />
                  </div>
                  <span style={{ textAlign: 'right', color: theme.text, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmtInt(c.count)} SKUs</span>
                </div>
              ))}
            </div>
          </div>

          <SecH theme={theme} title="Últimos cambios" sub={`${ultimos.length}`} />
          <div style={{ padding: '0 18px 24px' }}>
            {ultimos.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: theme.textMuted, fontSize: 13, background: theme.surface, border: `1px dashed ${theme.border}`, borderRadius: 12 }}>Sin cambios recientes</div>
            )}
            {ultimos.map((p, i) => {
              const d = new Date(p.updated_at);
              const fecha = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
              return (
                <div key={`${p.sku}-${p.cliente}-${i}`} style={{ padding: '10px 0', borderTop: `1px solid ${theme.divider}`, display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px' }}>
                  <div style={{ fontSize: 11.5, color: theme.textMuted, fontFamily: '"SF Mono", ui-monospace, monospace', gridColumn: 1 }}>{p.sku} · {CLIENTES[p.cliente]?.label || p.cliente}</div>
                  <div style={{ fontSize: 12, color: theme.text, gridColumn: 1 }}>{fecha} · precio actualizado</div>
                  <div style={{ gridColumn: 2, gridRow: '1 / span 2', alignSelf: 'center', textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: theme.text, fontFamily: TYPO.fontDisplay }}>{fmtCompact(Number(p.precio) || 0)}</div>
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
