// MobileAnalisisClientes — Análisis por Cliente mobile-native.
// Comparativa cross-cliente: KPIs consolidados + ranking + cards por cliente.

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { PCEL_REAL } from '../lib/constants';
import { CLIENTES } from './Sidebar';

const CLIENTE_DOT = { digitalife: '#5856D6', dicotech: '#FF9500', pcel: '#34C759' };
const MES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const fmtCompact = (n) => {
  if (!isFinite(n) || !n) return '$0';
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}K`;
  return `${s}$${Math.round(a)}`;
};

const safeQuery = async (q) => { try { const r = await q; return r.data || []; } catch { return []; } };

export default function MobileAnalisisClientes({ onBack, onNavegar }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const anio = new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [siSku, setSiSku] = useState([]);
  const [soSku, setSoSku] = useState([]);
  const [cuotas, setCuotas] = useState([]);
  const [dso, setDso] = useState([]);

  // Fetch page-through porque sell_in_sku puede tener miles de rows
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

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      // Alineado con desktop AnalisisCliente que usa sell_in_sku.monto_pesos
      // (más granular que v_ventas_mensuales_agg y consistente con el resto del dashboard).
      const [si, so, c, d] = await Promise.all([
        fetchAll('sell_in_sku', 'cliente,mes,monto_pesos', q => q.eq('anio', anio)),
        // sellout_sku es la tabla equivalente para SO en desktop
        fetchAll('sellout_sku', 'cliente,mes,monto_pesos', q => q.eq('anio', anio)),
        safeQuery(supabase.from('cuotas_mensuales').select('cliente,mes,cuota_min,cuota_ideal').eq('anio', anio)),
        safeQuery(supabase.from('v_dso_real').select('cliente,saldo_actual_total,saldo_vencido,dso_real,dso_erp')),
      ]);
      if (!alive) return;
      setSiSku(si); setSoSku(so); setCuotas(c); setDso(d);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [anio]);

  const mesData = useMemo(() => {
    let last = 0;
    siSku.forEach(r => { const m = Number(r.mes) || 0; if (m > last && Number(r.monto_pesos) > 0) last = m; });
    return last || new Date().getMonth() + 1;
  }, [siSku]);

  const clienteKpis = useMemo(() => {
    const out = {};
    // Sell In del mes usando monto_pesos (alineado con desktop AnalisisCliente)
    siSku.filter(r => Number(r.mes) === mesData).forEach(r => {
      if (!out[r.cliente]) out[r.cliente] = { facturado: 0, sellOut: 0, cuota: 0 };
      out[r.cliente].facturado += Number(r.monto_pesos) || 0;
    });
    soSku.filter(r => Number(r.mes) === mesData).forEach(r => {
      if (!out[r.cliente]) out[r.cliente] = { facturado: 0, sellOut: 0, cuota: 0 };
      out[r.cliente].sellOut += Number(r.monto_pesos) || 0;
    });
    // Cuota_ideal como meta principal (matching desktop) + fallback PCEL_REAL
    cuotas.filter(r => Number(r.mes) === mesData).forEach(r => {
      if (!out[r.cliente]) out[r.cliente] = { facturado: 0, sellOut: 0, cuota: 0 };
      out[r.cliente].cuota += Number(r.cuota_ideal || r.cuota_min || 0);
    });
    if ((!out.pcel || out.pcel.cuota === 0) && PCEL_REAL?.cuota50M?.[mesData]) {
      if (!out.pcel) out.pcel = { facturado: 0, sellOut: 0, cuota: 0 };
      out.pcel.cuota = PCEL_REAL.cuota50M[mesData];
    }
    dso.forEach(r => {
      if (!out[r.cliente]) out[r.cliente] = { facturado: 0, sellOut: 0, cuota: 0 };
      out[r.cliente].saldo = Number(r.saldo_actual_total) || 0;
      out[r.cliente].vencido = Number(r.saldo_vencido) || 0;
      out[r.cliente].dso = r.dso_real != null ? Math.round(Number(r.dso_real)) : (r.dso_erp != null ? Math.round(Number(r.dso_erp)) : null);
    });
    Object.entries(out).forEach(([k, v]) => {
      v.pct = v.cuota > 0 ? Math.round((v.facturado / v.cuota) * 100) : 0;
      v.gap = Math.max(0, v.cuota - v.facturado);
      v.siso = v.facturado > 0 ? Math.round((v.sellOut / v.facturado) * 100) : 0;
    });
    return out;
  }, [siSku, soSku, cuotas, dso, mesData]);

  const totales = useMemo(() => {
    const vals = Object.values(clienteKpis);
    const facturado = vals.reduce((s, v) => s + v.facturado, 0);
    const cuota = vals.reduce((s, v) => s + v.cuota, 0);
    const pct = cuota > 0 ? Math.round((facturado / cuota) * 100) : 0;
    const clientesActivos = Object.keys(clienteKpis).filter(k => (clienteKpis[k].facturado || 0) > 0).length;
    const enVerde = Object.values(clienteKpis).filter(v => v.pct >= 100).length;
    return { facturado, cuota, pct, clientesActivos, enVerde };
  }, [clienteKpis]);

  const lista = Object.keys(CLIENTES).filter(k => CLIENTES[k].activo);
  const ranking = useMemo(() => (
    lista.map(id => ({ id, cli: CLIENTES[id], kpi: clienteKpis[id] || {}, color: CLIENTE_DOT[id] || theme.accent }))
         .sort((a, b) => (b.kpi.facturado || 0) - (a.kpi.facturado || 0))
  ), [lista, clienteKpis, theme.accent]);
  const maxFact = Math.max(...ranking.map(r => r.kpi.facturado || 0), 1);

  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100vh' }}>
      <BackHdr theme={theme} onBack={onBack} eyebrow="Dirección Comercial" />
      <TitleH theme={theme} h="Análisis por Cliente" sub={`${MES_CORTO[mesData - 1]} ${anio} · comparativa`} />

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>Cargando…</div>
      ) : (
        <>
          <div style={{ padding: '6px 18px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Kpi theme={theme} label="Clientes activos" value={`${totales.clientesActivos}`} delta={`de ${lista.length} registrados`} />
            <Kpi theme={theme} label="Sell In total" value={fmtCompact(totales.facturado)} delta={`Cuota ${totales.pct}%`} positive={totales.pct >= 100} />
            <Kpi theme={theme} label="Cuota promedio" value={`${totales.pct}%`} delta={totales.pct >= 100 ? '✓ cumplida' : `gap ${fmtCompact(totales.cuota - totales.facturado)}`} positive={totales.pct >= 100} />
            <Kpi theme={theme} label="En verde" value={`${totales.enVerde}`} delta={totales.enVerde === lista.length ? 'todos ok' : `${lista.length - totales.enVerde} atrás`} positive={totales.enVerde === lista.length} />
          </div>

          <SecH theme={theme} title="Ranking · Sell In" sub={MES_CORTO[mesData - 1]} />
          <div style={{ margin: '4px 18px 8px', padding: 14, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ranking.map(r => (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '82px 1fr 68px', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <span style={{ color: theme.text, fontWeight: 600 }}>{r.cli.label}</span>
                  <div style={{ height: 8, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${((r.kpi.facturado || 0) / maxFact) * 100}%`, background: r.color, borderRadius: 4, transition: 'width 400ms cubic-bezier(.32,.72,0,1)' }} />
                  </div>
                  <span style={{ textAlign: 'right', color: theme.text, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmtCompact(r.kpi.facturado || 0)}</span>
                </div>
              ))}
            </div>
          </div>

          <SecH theme={theme} title="Comparativa" sub="tap cliente para drill" />
          <div style={{ padding: '0 18px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ranking.map(r => (
              <button key={r.id} onClick={() => onNavegar(r.id, 'home')}
                style={{
                  width: '100%', background: theme.surface, border: `1px solid ${theme.border}`,
                  borderRadius: 14, padding: 12, textAlign: 'left', cursor: 'pointer',
                  fontFamily: TYPO.fontText, transition: 'transform 160ms cubic-bezier(.34,1.56,.64,1)',
                }}
                onPointerDown={(e) => e.currentTarget.style.transform = 'scale(.99)'}
                onPointerUp={(e) => e.currentTarget.style.transform = ''}
                onPointerLeave={(e) => e.currentTarget.style.transform = ''}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: r.color, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 12 }}>{r.cli.label.slice(0, 2).toUpperCase()}</div>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 700, letterSpacing: '-.01em', color: theme.text, fontFamily: TYPO.fontDisplay }}>{r.cli.label}</div>
                  <ChevronRight size={14} style={{ color: theme.textSubtle }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <MiniKpi theme={theme} label="Cuota" value={`${r.kpi.pct || 0}%`} sub={r.kpi.gap > 0 ? `gap ${fmtCompact(r.kpi.gap)}` : 'on track'} positive={r.kpi.pct >= 100} />
                  <MiniKpi theme={theme} label="SI/SO" value={r.kpi.siso ? `${r.kpi.siso}%` : '—'} sub={r.kpi.siso >= 70 ? 'saludable' : r.kpi.siso ? 'baja' : '—'} positive={r.kpi.siso >= 70} />
                  <MiniKpi theme={theme} label="DSO" value={r.kpi.dso != null ? `${r.kpi.dso}d` : '—'} sub={r.kpi.dso != null && r.kpi.dso <= 30 ? 'al día' : r.kpi.dso ? 'atención' : '—'} positive={r.kpi.dso != null && r.kpi.dso <= 30} />
                </div>
                <div style={{ height: 3, background: isDark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.08)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, r.kpi.pct || 0)}%`, background: r.color, borderRadius: 2, transition: 'width 400ms cubic-bezier(.32,.72,0,1)' }} />
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BackHdr({ theme, onBack, eyebrow }) {
  return (
    <div style={{ padding: '10px 18px 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <button onClick={onBack} style={{ background: 'transparent', border: 'none', padding: '6px 10px', color: theme.accent, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
        <ChevronLeft size={16} strokeWidth={2.2} /> Inicio
      </button>
      <span style={{ fontSize: 12.5, color: theme.textMuted, fontWeight: 600 }}>{eyebrow}</span>
    </div>
  );
}
function TitleH({ theme, h, sub }) {
  return (
    <div style={{ padding: '2px 18px 6px' }}>
      <h1 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 30, fontWeight: 700, letterSpacing: '-.03em', color: theme.text }}>{h}</h1>
      {sub && <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function Kpi({ theme, label, value, delta, positive }) {
  const color = positive === true ? (theme.green || '#34C759') : positive === false ? (theme.pink || theme.red || '#FF3B30') : theme.textMuted;
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: theme.textMuted, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', marginTop: 2, color: theme.text, fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontDisplay }}>{value}</div>
      {delta && <div style={{ fontSize: 10.5, fontWeight: 600, marginTop: 1, color }}>{delta}</div>}
    </div>
  );
}
function MiniKpi({ theme, label, value, sub, positive }) {
  const color = positive === true ? (theme.green || '#34C759') : positive === false ? (theme.pink || theme.red || '#FF3B30') : theme.textMuted;
  return (
    <div>
      <div style={{ fontSize: 9.5, textTransform: 'uppercase', color: theme.textMuted, fontWeight: 700, letterSpacing: '.06em' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', marginTop: 2, color: theme.text, fontFamily: TYPO.fontDisplay }}>{value}</div>
      {sub && <div style={{ fontSize: 9.5, fontWeight: 600, marginTop: 1, color }}>{sub}</div>}
    </div>
  );
}
function SecH({ theme, title, sub }) {
  return (
    <div style={{ padding: '12px 18px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.01em', color: theme.text, fontFamily: TYPO.fontDisplay }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: theme.textMuted }}>{sub}</div>}
    </div>
  );
}
