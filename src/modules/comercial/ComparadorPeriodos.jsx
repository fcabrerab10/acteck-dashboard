// ComparadorPeriodos · Sell In · Periodo A vs Periodo B (presets + libre).
// Cliente: v_fact_cliente_mes + v_erp_medidas_cliente_mes. Global (clienteKey null):
// v_facturacion_global_mensual + v_erp_medidas_mes. Movers (lazy al abrir):
// facturacion_clientes por cliente · v_facturacion_global_sku_mes en global.
// Cliente del ERP (clienteNombre / clienteCodigo, Análisis por Cliente 2026-09-11):
// v_analisis_cliente_mes (fact_neta como monto) · movers desde mv_analisis_cliente_sku_mes por código.
// ocultarSensible: esconde Contribución/MC (permiso `sensible`).
// 2026-11-18: el cálculo vive en comparador/calculo.js y las consultas en comparador/datos.js (los comparte el celular:
// src/movil/pestanas/comparador/ComparadorM.jsx). Aquí sólo queda el layout de escritorio.
import React, { useEffect, useMemo, useState } from 'react';
import { formatMXN } from '../../lib/utils';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { ArrowLeftRight, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { PRESETS, MESES, deltaPct, labelPeriodo, sumar, periodosPreset, ultimoConDatos, aniosDe, libreInicial, ajustarLibre, esMesParcial, moversDe, serieComparada, textoResumen } from './comparador/calculo';
import { useComparadorBase, useComparadorSkus } from './comparador/datos';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const money = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n); const s = n < 0 ? '−' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}K`;
  return `${s}$${Math.round(a).toLocaleString('es-MX')}`;
};
const int = (n) => (n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('es-MX'));
const pctTxt = (n, d = 1) => (n == null || isNaN(n) ? '—' : `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(d)}%`);
const Sel = ({ value, opts, onChange, style }) => (
  <select value={value} onChange={(e) => onChange(Number(e.target.value))} style={style}>
    {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
  </select>
);

export default function ComparadorPeriodos({ clienteKey = null, clienteNombre = null, clienteCodigo = null, ocultarSensible = false }) {
  const erpCliente = clienteNombre || clienteCodigo ? { nombre: clienteNombre, codigo: clienteCodigo } : null;
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const accent = theme.accent || '#007AFF', green = theme.green || '#34C759', red = theme.red || '#FF3B30';
  const border = `1px solid ${theme.border}`;
  const mono = { fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums' };

  const alcance = { clienteKey, clienteNombre, clienteCodigo };
  const { fact, med } = useComparadorBase(alcance);
  const [preset, setPreset] = useState('ytd');
  const [libre, setLibre] = useState(null);
  const [moversOpen, setMoversOpen] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => { setMoversOpen(false); }, [clienteKey, clienteNombre, clienteCodigo]);

  const ultimo = useMemo(() => ultimoConDatos(fact), [fact]);
  const anios = useMemo(() => aniosDe(fact), [fact]);

  useEffect(() => {
    if (ultimo && !libre) setLibre(libreInicial(ultimo));
  }, [ultimo, libre]);

  const periodos = useMemo(() => (ultimo && libre ? periodosPreset(preset, ultimo.anio, ultimo.mes, libre) : []), [preset, ultimo, libre]);
  const totales = useMemo(() => periodos.map((p) => sumar(fact || [], med, p)), [periodos, fact, med]);
  const A = totales[0], B = totales[1];
  const esM3 = preset === 'm3';
  const mesParcial = esMesParcial(ultimo, periodos);

  // Movers · carga lazy al abrir la sección; se re-pide si cambian los años involucrados
  const yearsKey = useMemo(() => Array.from(new Set(periodos.map((p) => p.anio))).sort().join(','), [periodos]);
  const { rows: skuRows, cargando: skuLoading } = useComparadorSkus(alcance, yearsKey, moversOpen);
  const movers = useMemo(() => moversDe(skuRows, periodos), [skuRows, periodos]);

  const chartData = useMemo(() => serieComparada(totales, periodos), [totales, periodos]);

  const copiar = () => {
    if (!A || !B) return;
    const nombre = erpCliente ? (erpCliente.nombre || erpCliente.codigo) : clienteKey ? clienteKey.charAt(0).toUpperCase() + clienteKey.slice(1) : 'Global';
    const texto = textoResumen({ nombre, periodos, totales, ocultarSensible, fmt: formatMXN });
    navigator.clipboard?.writeText(texto).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1600); });
  };

  const segBg = isDark ? 'rgba(120,120,128,0.24)' : 'rgba(120,120,128,0.12)';
  const segOn = isDark ? 'rgba(99,99,102,0.9)' : '#FFFFFF';
  const segOff = isDark ? 'rgba(235,235,245,0.60)' : 'rgba(60,60,67,0.60)';
  const selStyle = { ...mono, fontSize: 11, fontWeight: 600, color: theme.text, background: theme.surface, border, borderRadius: 7, padding: '3px 6px', height: 26, cursor: 'pointer' };
  const setLibreP = (id, patch) => setLibre((s) => ajustarLibre(s, id, patch));
  const mesOpts = MESES.map((m, i) => ({ v: i + 1, l: m }));
  const anioOpts = anios.map((y) => ({ v: y, l: String(y) }));

  const Delta = ({ a, b, fmtV = money }) => {
    if (a == null || b == null) return <span style={{ color: theme.textMuted }}>—</span>;
    const d = a - b, p = deltaPct(a, b), ok = d >= 0;
    return (
      <span style={{ ...mono, fontSize: 11, fontWeight: 600, color: ok ? green : red }}>
        {ok ? '+' : '−'}{fmtV(Math.abs(d))}{p != null ? ` · ${pctTxt(p)}` : ''}
      </span>
    );
  };

  const Kpi = ({ k, get, fmtV, sub }) => (
    <div style={{ padding: '10px 12px', borderRadius: 12, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>{k}</div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${totales.length}, minmax(0, 1fr))`, gap: 6, marginTop: 6 }}>
        {totales.map((t, i) => (
          <div key={i} style={{ minWidth: 0 }}>
            <div style={{ fontFamily: TYPO.fontText, fontSize: 9.5, color: theme.textMuted }}>{esM3 ? periodos[i].anio : periodos[i].id}</div>
            <div style={{ ...mono, fontSize: i === 0 ? 17 : 13, fontWeight: 600, letterSpacing: '-0.02em', color: i === 0 ? theme.text : theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fmtV(get(t))}</div>
            {sub && <div style={{ fontFamily: TYPO.fontText, fontSize: 9.5, color: theme.textMuted }}>{sub(t)}</div>}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {esM3
          ? [1, 2].map((i) => totales[i] && <span key={i} style={{ fontSize: 10, color: theme.textMuted }}>vs {periodos[i].anio}: <Delta a={get(totales[0])} b={get(totales[i])} fmtV={fmtV} /></span>)
          : <Delta a={A ? get(A) : null} b={B ? get(B) : null} fmtV={fmtV} />}
      </div>
    </div>
  );

  const Skeleton = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
      {[0, 1, 2, 3].map((i) => <div key={i} style={{ height: 82, borderRadius: 12, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', animation: 'pulse 1.4s ease-in-out infinite' }} />)}
    </div>
  );

  const MoverTabla = ({ titulo, rows, col }) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.09em', color: col, fontWeight: 700, marginBottom: 4 }}>{titulo}</div>
      {!rows.length && <div style={{ fontSize: 10.5, color: theme.textMuted }}>Sin movimientos.</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
        <tbody>
          {rows.map((s) => (
            <tr key={s.sku} style={{ borderTop: border }}>
              <td style={{ padding: '3px 0', fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600, color: theme.text, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sku}</td>
              <td style={{ padding: '3px 4px', fontSize: 10, color: theme.textMuted, textAlign: 'right', whiteSpace: 'nowrap' }}>{money(s.mB)} → {money(s.mA)}</td>
              <td style={{ padding: '3px 4px', fontSize: 10, color: theme.textMuted, textAlign: 'right', whiteSpace: 'nowrap' }}>{int(s.pB)} → {int(s.pA)} pz</td>
              <td style={{ padding: '3px 0 3px 4px', ...mono, fontSize: 10.5, fontWeight: 700, color: col, textAlign: 'right', whiteSpace: 'nowrap' }}>{s.d >= 0 ? '+' : '−'}{money(Math.abs(s.d))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const sinDatos = fact && (!fact.length || !ultimo);

  return (
    <div style={{ background: theme.surface, border, borderRadius: 16, padding: '14px 16px', fontFamily: TYPO.fontText, color: theme.text }}>
      <style>{`@keyframes pulse{0%,100%{opacity:.55}50%{opacity:1}}`}</style>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: `${accent}22`, color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ArrowLeftRight style={{ width: 15, height: 15 }} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600 }}>Comparador de periodos</div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text }}>
            Periodo A vs Periodo B.
            {periodos.length > 0 && <span style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textMuted, fontWeight: 500, fontStyle: 'italic', marginLeft: 8 }}>{periodos.map(labelPeriodo).join(' vs ')}{mesParcial ? ` · ${MESES[ultimo.mes - 1]} parcial` : ''}</span>}
          </div>
        </div>
        <button onClick={copiar} disabled={!A || !B} title="Copiar resumen de 3 líneas"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, cursor: 'pointer', background: copiado ? green : 'transparent', color: copiado ? '#FFF' : theme.textMuted, border: `1px solid ${copiado ? green : theme.border}`, fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600, height: 28, transition: 'all 180ms' }}>
          {copiado ? <Check size={12} /> : <Copy size={12} />}{copiado ? 'Copiado' : 'Copiar resumen'}
        </button>
      </div>

      {/* Presets · segmented control iOS */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: 2, background: segBg, borderRadius: 9, height: 30, flexWrap: 'wrap' }}>
          {PRESETS.map((p) => {
            const on = preset === p.k;
            return (
              <button key={p.k} onClick={() => setPreset(p.k)} style={{ padding: '4px 10px', borderRadius: 7, cursor: 'pointer', background: on ? segOn : 'transparent', color: on ? theme.text : segOff, border: 0, boxShadow: on ? '0 3px 8px rgba(0,0,0,0.12), 0 3px 1px rgba(0,0,0,0.04)' : 'none', fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: on ? 700 : 500, letterSpacing: '-0.01em', whiteSpace: 'nowrap', transition: 'all 180ms cubic-bezier(0.4,0,0.2,1)' }}>{p.l}</button>
            );
          })}
        </div>
        {preset === 'libre' && libre && ['A', 'B'].map((id) => (
          <div key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 700, color: id === 'A' ? accent : theme.textMuted, width: 12 }}>{id}</span>
            <Sel style={selStyle} value={libre[id].desde} opts={mesOpts} onChange={(v) => setLibreP(id, { desde: v })} />
            <span style={{ fontSize: 10, color: theme.textMuted }}>→</span>
            <Sel style={selStyle} value={libre[id].hasta} opts={mesOpts} onChange={(v) => setLibreP(id, { hasta: v })} />
            <Sel style={selStyle} value={libre[id].anio} opts={anioOpts.some((o) => o.v === libre[id].anio) ? anioOpts : [...anioOpts, { v: libre[id].anio, l: String(libre[id].anio) }]} onChange={(v) => setLibreP(id, { anio: v })} />
          </div>
        ))}
      </div>

      {!fact || (!sinDatos && totales.length < 2) ? <Skeleton /> : sinDatos ? (
        <div style={{ padding: '18px 0', textAlign: 'center', fontSize: 11.5, color: theme.textMuted }}>Sin datos de facturación para comparar.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
            <Kpi k="Facturación" get={(t) => t.monto} fmtV={money} />
            <Kpi k="Piezas" get={(t) => t.piezas} fmtV={int} />
            <Kpi k="Ticket promedio" get={(t) => t.ticket} fmtV={(v) => (v == null ? '—' : `$${int(v)}`)} />
            {!ocultarSensible && <Kpi k="Contribución" get={(t) => (t.hayMedidas ? t.contribucion : null)} fmtV={money} sub={(t) => (t.mc != null ? `MC ${t.mc.toFixed(1)}%` : 'sin medidas')} />}
          </div>

          {/* Mini gráfica · A y B lado a lado por posición de mes */}
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 10, color: theme.textMuted }}>
            {periodos.map((p, i) => (
              <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: i === 0 ? accent : theme.textMuted, opacity: i === 0 ? 1 : 0.45 + (0.2 * (2 - i)) }} />{labelPeriodo(p)}
              </span>
            ))}
          </div>
          <div style={{ width: '100%', height: 90, marginTop: 4 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }} barGap={2} barCategoryGap="28%">
                <CartesianGrid stroke={theme.border} vertical={false} strokeOpacity={0.6} />
                <XAxis dataKey="label" tick={{ fontSize: 9.5, fill: theme.textMuted }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tickFormatter={money} tick={{ fontSize: 9, fill: theme.textMuted }} axisLine={false} tickLine={false} width={48} />
                <Tooltip cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}
                  formatter={(v, name, item) => [formatMXN(v), item?.payload?.[`${name}_lbl`] || name]}
                  labelFormatter={() => ''} contentStyle={{ fontSize: 11, borderRadius: 10, border, background: theme.surface, color: theme.text, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }} />
                {periodos.map((p, i) => (
                  <Bar key={p.id} dataKey={p.id} fill={i === 0 ? accent : theme.textMuted} fillOpacity={i === 0 ? 1 : 0.45 + (0.2 * (2 - i))} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Qué movió la diferencia · lazy */}
          <div style={{ marginTop: 10, borderTop: border, paddingTop: 8 }}>
            <button onClick={() => setMoversOpen((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: 0, padding: 0, cursor: 'pointer', color: theme.text, fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em' }}>
              {moversOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              Qué movió la diferencia
              <span style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textMuted, fontWeight: 500, fontStyle: 'italic', marginLeft: 4 }}>
                {esM3 ? `${periodos[0]?.anio} vs ${periodos[1]?.anio}` : 'A vs B'} · top 8 por SKU
              </span>
            </button>
            {moversOpen && (
              skuLoading || !movers ? (
                <div style={{ marginTop: 8, height: 60, borderRadius: 10, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', animation: 'pulse 1.4s ease-in-out infinite' }} />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginTop: 8 }}>
                  <MoverTabla titulo="Subieron" rows={movers.up} col={green} />
                  <MoverTabla titulo="Bajaron" rows={movers.down} col={red} />
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
