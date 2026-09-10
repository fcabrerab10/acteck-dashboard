// RentabilidadBloque · medidas del director (DAX → v_erp_medidas_*).
// Cascada Fact Bruta → Fact Neta → Venta Neta → Utilidad Comercial, tiles de
// margen (MC %, MUC %, Lost Profit, ticket) con YoY, y serie mensual.
// Global (Visión General): v_erp_medidas_mes. Por cliente (Sell In): v_erp_medidas_cliente_mes.
// Información sensible: sólo se renderiza con puedeVerSensible(perfil) (super admin o permisos.sensible).
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { cachedQuery } from '../../lib/queries';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerSensible } from '../../lib/permisos';
import { Percent } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const COLS = 'mes,fact_bruta,devoluciones,rmas,bonificaciones,fact_neta,venta_neta,costo_fact_neta,costo_venta_neta,contribucion,utilidad_comercial,piezas_venta_neta';

const money = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n); const s = n < 0 ? '−' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}K`;
  return `${s}$${Math.round(a).toLocaleString('es-MX')}`;
};
const pct = (n, d = 1) => (n == null || isNaN(n) ? '—' : `${n.toFixed(d)}%`);
const pp = (n) => (n == null || isNaN(n) ? null : `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)} pp`);

const N = (v) => Number(v) || 0;
const sumHasta = (rows, mesMax) => {
  const t = { fact_bruta: 0, devoluciones: 0, rmas: 0, bonificaciones: 0, fact_neta: 0, venta_neta: 0, costo_fact_neta: 0, costo_venta_neta: 0, contribucion: 0, utilidad_comercial: 0, piezas: 0 };
  rows.forEach((r) => {
    if (N(r.mes) > mesMax) return;
    t.fact_bruta += N(r.fact_bruta); t.devoluciones += N(r.devoluciones); t.rmas += N(r.rmas); t.bonificaciones += N(r.bonificaciones);
    t.fact_neta += N(r.fact_neta); t.venta_neta += N(r.venta_neta); t.costo_fact_neta += N(r.costo_fact_neta); t.costo_venta_neta += N(r.costo_venta_neta);
    t.contribucion += N(r.contribucion); t.utilidad_comercial += N(r.utilidad_comercial); t.piezas += N(r.piezas_venta_neta);
  });
  t.mc = t.fact_neta ? (t.contribucion / t.fact_neta) * 100 : null;
  t.muc = t.venta_neta ? (t.utilidad_comercial / t.venta_neta) * 100 : null;
  t.lost = t.devoluciones + t.rmas + t.bonificaciones; // negativo
  t.lostPct = t.fact_bruta ? (Math.abs(t.lost) / t.fact_bruta) * 100 : null;
  t.ticket = t.piezas ? t.venta_neta / t.piezas : null;
  return t;
};

export default function RentabilidadBloque({ anio, mesMax, clienteKey = null, titulo }) {
  const { theme } = useTheme();
  const perfil = usePerfil();
  const sensible = puedeVerSensible(perfil);
  const [rows, setRows] = useState([]);
  const [rowsPrev, setRowsPrev] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sensible) return undefined;
    let cancel = false;
    setLoading(true);
    const vista = clienteKey ? 'v_erp_medidas_cliente_mes' : 'v_erp_medidas_mes';
    const q = (a) => {
      let b = supabase.from(vista).select(COLS).eq('anio', a);
      if (clienteKey) b = b.eq('cliente_key', clienteKey);
      return cachedQuery(b.order('mes'));
    };
    Promise.all([q(anio), q(anio - 1)]).then(([a, p]) => {
      if (cancel) return;
      setRows(a.data || []); setRowsPrev(p.data || []); setLoading(false);
    }).catch(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [anio, clienteKey, sensible]);

  const mesTope = useMemo(() => {
    const ultimo = rows.reduce((m, r) => Math.max(m, N(r.mes)), 0);
    return Math.min(mesMax || 12, ultimo || 12);
  }, [rows, mesMax]);

  const ytd = useMemo(() => sumHasta(rows, mesTope), [rows, mesTope]);
  const ytdPrev = useMemo(() => sumHasta(rowsPrev, mesTope), [rowsPrev, mesTope]);

  const serie = useMemo(() => {
    const by = new Map(rows.map((r) => [N(r.mes), r]));
    return Array.from({ length: mesTope }, (_, i) => {
      const r = by.get(i + 1) || {};
      const fn = N(r.fact_neta), c = N(r.contribucion), u = N(r.utilidad_comercial);
      return { mes: MESES[i], factNeta: fn, contribucion: c, utilidad: u, mc: fn ? (c / fn) * 100 : null };
    });
  }, [rows, mesTope]);

  const isDark = theme.mode === 'dark';
  const green = theme.green || '#34C759', red = theme.red || '#FF3B30', orange = theme.orange || '#FF9500';
  const blue = theme.accent || '#007AFF';
  const border = `1px solid ${theme.border}`;
  const mono = { fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums' };

  if (!sensible) return null;
  if (!loading && !rows.length) return null;

  const base = Math.max(ytd.fact_bruta, 1);
  const cascada = [
    { k: 'Fact. Bruta', v: ytd.fact_bruta, col: blue, bold: false },
    { k: 'Devoluciones', v: ytd.devoluciones, col: red },
    { k: "RMA's", v: ytd.rmas, col: red, faint: true },
    { k: 'Fact. Neta', v: ytd.fact_neta, col: blue, bold: true, prev: ytdPrev.fact_neta },
    { k: 'Bonificaciones', v: ytd.bonificaciones, col: orange },
    { k: 'Venta Neta', v: ytd.venta_neta, col: blue, bold: true, prev: ytdPrev.venta_neta },
    { k: 'Costo de venta', v: -ytd.costo_venta_neta, col: theme.textSubtle || '#86868B' },
    { k: 'Utilidad Comercial', v: ytd.utilidad_comercial, col: green, bold: true, prev: ytdPrev.utilidad_comercial },
  ];

  const tiles = [
    { k: 'Contribución', big: money(ytd.contribucion), sub: `MC ${pct(ytd.mc)}`, delta: ytd.mc != null && ytdPrev.mc != null ? ytd.mc - ytdPrev.mc : null, col: blue },
    { k: 'Utilidad Comercial', big: money(ytd.utilidad_comercial), sub: `MUC ${pct(ytd.muc)}`, delta: ytd.muc != null && ytdPrev.muc != null ? ytd.muc - ytdPrev.muc : null, col: green },
    { k: 'Lost Profit', big: money(ytd.lost), sub: `${pct(ytd.lostPct)} de la bruta`, delta: null, col: red,
      deltaTxt: ytd.lostPct != null && ytdPrev.lostPct != null ? pp(ytd.lostPct - ytdPrev.lostPct) : null,
      deltaOk: ytd.lostPct != null && ytdPrev.lostPct != null ? ytd.lostPct <= ytdPrev.lostPct : true },
    { k: 'Ticket promedio', big: ytd.ticket != null ? `$${Math.round(ytd.ticket).toLocaleString('es-MX')}` : '—', sub: `${Math.round(ytd.piezas).toLocaleString('es-MX')} pzs netas`, delta: null, col: theme.textMuted, deltaTxt: ytd.ticket && ytdPrev.ticket ? `${ytd.ticket >= ytdPrev.ticket ? '↑' : '↓'} ${Math.abs(((ytd.ticket - ytdPrev.ticket) / ytdPrev.ticket) * 100).toFixed(1)}%` : null, deltaOk: ytd.ticket >= ytdPrev.ticket },
  ];

  return (
    <div style={{ background: theme.surface, border, borderRadius: 16, padding: '14px 16px', fontFamily: TYPO.fontText, color: theme.text }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: `${green}22`, color: green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Percent style={{ width: 15, height: 15 }} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600, fontFamily: TYPO.fontDisplay }}>
            Rentabilidad · YTD ene–{MESES[mesTope - 1]} {anio} · medidas del director
          </p>
          <h3 style={{ margin: '1px 0 0', fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', fontFamily: TYPO.fontDisplay, color: theme.text }}>
            {titulo || 'De la factura bruta a la utilidad.'}
          </h3>
        </div>
        <span style={{ fontSize: 9.5, padding: '3px 8px', borderRadius: 999, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: theme.textMuted, fontFamily: TYPO.fontDisplay, fontWeight: 600, letterSpacing: '0.04em' }}>
          ERP renglón a renglón
        </span>
      </div>

      {loading ? (
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textMuted, fontSize: 12 }}>Calculando medidas…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)', gap: 14 }}>
          {/* Cascada */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {cascada.map((r) => {
              const w = Math.min(100, (Math.abs(r.v) / base) * 100);
              const share = (r.v / base) * 100;
              const yoy = r.prev ? ((r.v - r.prev) / Math.abs(r.prev)) * 100 : null;
              return (
                <div key={r.k} style={{ display: 'grid', gridTemplateColumns: '108px minmax(0,1fr) 66px 46px', gap: 8, alignItems: 'center', padding: r.bold ? '4px 0' : '2px 0', borderTop: r.bold ? `1px solid ${theme.border}` : 'none' }}>
                  <span style={{ fontSize: 11, fontWeight: r.bold ? 600 : 500, color: r.bold ? theme.text : theme.textMuted, fontFamily: TYPO.fontDisplay, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.k}</span>
                  <div style={{ height: r.bold ? 8 : 6, borderRadius: 999, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    <div style={{ width: `${w}%`, height: '100%', borderRadius: 999, background: r.col, opacity: r.faint ? 0.45 : r.bold ? 1 : 0.8, transition: 'width 400ms' }} />
                  </div>
                  <span style={{ ...mono, fontSize: 12, fontWeight: r.bold ? 600 : 500, textAlign: 'right', color: r.v < 0 && !r.bold ? r.col : theme.text }}>{money(r.v)}</span>
                  <span style={{ ...mono, fontSize: 10, textAlign: 'right', color: yoy != null ? (yoy >= 0 ? green : red) : theme.textSubtle || theme.textMuted, fontWeight: 500 }} title={yoy != null ? `vs ${anio - 1} mismo periodo` : '% de la factura bruta'}>
                    {yoy != null ? `${yoy >= 0 ? '↑' : '↓'}${Math.abs(yoy).toFixed(0)}%` : `${share.toFixed(1)}%`}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Tiles + serie */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {tiles.map((t) => {
                const dTxt = t.deltaTxt ?? pp(t.delta);
                const ok = t.deltaTxt ? t.deltaOk : (t.delta ?? 0) >= 0;
                return (
                  <div key={t.k} style={{ border, borderRadius: 12, padding: '8px 10px', minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.07em', color: theme.textMuted, fontWeight: 600, fontFamily: TYPO.fontDisplay, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.k}</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                      <span style={{ ...mono, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1, color: t.col === theme.textMuted ? theme.text : t.col }}>{t.big}</span>
                      {dTxt && <span style={{ ...mono, fontSize: 10, fontWeight: 600, color: ok ? green : red }}>{dTxt}</span>}
                    </div>
                    <p style={{ margin: '3px 0 0', fontSize: 10.5, color: theme.textMuted, ...mono }}>{t.sub}</p>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 9.5, color: theme.textMuted, fontFamily: TYPO.fontDisplay, fontWeight: 500 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 2, borderRadius: 1, background: blue }} />Fact. Neta</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 2, borderRadius: 1, background: green }} />Contribución</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 2, borderRadius: 1, background: orange }} />MC % (eje der.)</span>
            </div>
            <div style={{ height: 96, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serie} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={theme.border} strokeDasharray="2 4" />
                  <XAxis dataKey="mes" tick={{ fontSize: 9.5, fill: theme.textMuted, fontFamily: TYPO.fontDisplay }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="m" hide domain={[0, 'auto']} />
                  <YAxis yAxisId="p" orientation="right" hide domain={[0, 60]} />
                  <Tooltip
                    cursor={{ stroke: theme.border }}
                    contentStyle={{ background: theme.surface, border, borderRadius: 10, fontSize: 11, fontFamily: TYPO.fontText, color: theme.text }}
                    formatter={(v, n) => (n === 'MC %' ? [pct(v), n] : [money(v), n])}
                  />
                  <Line yAxisId="m" type="monotone" dataKey="factNeta" name="Fact. Neta" stroke={blue} strokeWidth={2} dot={{ r: 2, strokeWidth: 0, fill: blue }} activeDot={{ r: 3.5 }} isAnimationActive={false} />
                  <Line yAxisId="m" type="monotone" dataKey="contribucion" name="Contribución" stroke={green} strokeWidth={2} dot={{ r: 2, strokeWidth: 0, fill: green }} activeDot={{ r: 3.5 }} isAnimationActive={false} />
                  <Line yAxisId="p" type="monotone" dataKey="mc" name="MC %" stroke={orange} strokeWidth={1.6} strokeDasharray="4 3" dot={{ r: 2, strokeWidth: 0, fill: orange }} activeDot={{ r: 3.5 }} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
