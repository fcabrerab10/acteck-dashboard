// ComparadorPeriodos · Sell In · Periodo A vs Periodo B (presets + libre).
// Cliente: v_fact_cliente_mes + v_erp_medidas_cliente_mes. Global (clienteKey null):
// v_facturacion_global_mensual + v_erp_medidas_mes. Movers (lazy al abrir):
// facturacion_clientes por cliente · v_facturacion_global_sku_mes en global.
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { cachedQuery, fetchAllQ } from '../../lib/queries';
import { formatMXN } from '../../lib/utils';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { ArrowLeftRight, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const PRESETS = [
  { k: 'ytd', l: 'YTD vs YTD ant.' },
  { k: 'qvq', l: 'Trimestre vs trim. ant.' },
  { k: 'qyoy', l: 'Trimestre vs mismo trim. año ant.' },
  { k: 'm3', l: 'Mes vs mismo mes (3 años)' },
  { k: 'libre', l: 'Libre' },
];
const N = (v) => Number(v) || 0;
const money = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n); const s = n < 0 ? '−' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}K`;
  return `${s}$${Math.round(a).toLocaleString('es-MX')}`;
};
const int = (n) => (n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('es-MX'));
const pctTxt = (n, d = 1) => (n == null || isNaN(n) ? '—' : `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(d)}%`);
const deltaPct = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);
const labelPeriodo = (p) => (p.desde === p.hasta ? `${MESES[p.desde - 1]} ${p.anio}` : `${MESES[p.desde - 1]}–${MESES[p.hasta - 1]} ${p.anio}`);
const enPeriodo = (r, p) => N(r.anio) === p.anio && N(r.mes) >= p.desde && N(r.mes) <= p.hasta;
const Sel = ({ value, opts, onChange, style }) => (
  <select value={value} onChange={(e) => onChange(Number(e.target.value))} style={style}>
    {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
  </select>
);

// Suma filas mensuales dentro de un periodo. Devuelve totales + serie por posición.
function sumar(fact, med, p) {
  const t = { monto: 0, piezas: 0, factNeta: 0, contribucion: 0, meses: [] };
  for (let m = p.desde; m <= p.hasta; m++) {
    const f = fact.find((r) => N(r.anio) === p.anio && N(r.mes) === m);
    t.meses.push({ mes: m, monto: N(f?.monto), piezas: N(f?.piezas) });
    t.monto += N(f?.monto); t.piezas += N(f?.piezas);
  }
  med.forEach((r) => { if (enPeriodo(r, p)) { t.factNeta += N(r.fact_neta); t.contribucion += N(r.contribucion); } });
  t.ticket = t.piezas ? t.monto / t.piezas : null;
  t.mc = t.factNeta ? (t.contribucion / t.factNeta) * 100 : null;
  t.hayMedidas = t.factNeta !== 0;
  return t;
}

// Periodos según preset, anclados al último mes con datos (anio, mes).
function periodosPreset(preset, anio, mes, libre) {
  const q0 = Math.floor((mes - 1) / 3) * 3 + 1; // primer mes del trimestre
  const len = mes - q0 + 1;
  switch (preset) {
    case 'ytd': return [{ id: 'A', anio, desde: 1, hasta: mes }, { id: 'B', anio: anio - 1, desde: 1, hasta: mes }];
    case 'qvq': {
      const pq = q0 === 1 ? { anio: anio - 1, desde: 10 } : { anio, desde: q0 - 3 };
      return [{ id: 'A', anio, desde: q0, hasta: mes }, { id: 'B', anio: pq.anio, desde: pq.desde, hasta: pq.desde + len - 1 }];
    }
    case 'qyoy': return [{ id: 'A', anio, desde: q0, hasta: mes }, { id: 'B', anio: anio - 1, desde: q0, hasta: mes }];
    case 'm3': return [0, 1, 2].map((i) => ({ id: 'ABC'[i], anio: anio - i, desde: mes, hasta: mes }));
    default: return [{ id: 'A', ...libre.A }, { id: 'B', ...libre.B }];
  }
}

export default function ComparadorPeriodos({ clienteKey = null }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const accent = theme.accent || '#007AFF', green = theme.green || '#34C759', red = theme.red || '#FF3B30';
  const border = `1px solid ${theme.border}`;
  const mono = { fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums' };

  const [fact, setFact] = useState(null);
  const [med, setMed] = useState([]);
  const [preset, setPreset] = useState('ytd');
  const [libre, setLibre] = useState(null);
  const [moversOpen, setMoversOpen] = useState(false);
  const [sku, setSku] = useState(null); // { key: años, rows }
  const [skuLoading, setSkuLoading] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let cancel = false;
    setFact(null); setSku(null); setMoversOpen(false);
    const qFact = clienteKey
      ? supabase.from('v_fact_cliente_mes').select('anio,mes,monto,piezas').eq('cliente_key', clienteKey)
      : supabase.from('v_facturacion_global_mensual').select('anio,mes,monto,piezas');
    let qMed = supabase.from(clienteKey ? 'v_erp_medidas_cliente_mes' : 'v_erp_medidas_mes').select('anio,mes,fact_neta,contribucion');
    if (clienteKey) qMed = qMed.eq('cliente_key', clienteKey);
    Promise.all([cachedQuery(qFact.order('anio').order('mes')), cachedQuery(qMed.order('anio').order('mes'))])
      .then(([f, m]) => { if (!cancel) { setFact(f.data || []); setMed(m.data || []); } })
      .catch(() => { if (!cancel) { setFact([]); setMed([]); } });
    return () => { cancel = true; };
  }, [clienteKey]);

  const ultimo = useMemo(() => {
    let best = null;
    (fact || []).forEach((r) => { if (N(r.monto) > 0 && (!best || N(r.anio) > best.anio || (N(r.anio) === best.anio && N(r.mes) > best.mes))) best = { anio: N(r.anio), mes: N(r.mes) }; });
    return best;
  }, [fact]);
  const anios = useMemo(() => Array.from(new Set((fact || []).map((r) => N(r.anio)))).sort((a, b) => b - a), [fact]);

  useEffect(() => {
    if (ultimo && !libre) setLibre({ A: { anio: ultimo.anio, desde: 1, hasta: ultimo.mes }, B: { anio: ultimo.anio - 1, desde: 1, hasta: ultimo.mes } });
  }, [ultimo, libre]);

  const periodos = useMemo(() => (ultimo && libre ? periodosPreset(preset, ultimo.anio, ultimo.mes, libre) : []), [preset, ultimo, libre]);
  const totales = useMemo(() => periodos.map((p) => sumar(fact || [], med, p)), [periodos, fact, med]);
  const A = totales[0], B = totales[1];
  const esM3 = preset === 'm3';
  const hoy = new Date();
  const mesParcial = ultimo && ultimo.anio === hoy.getFullYear() && ultimo.mes === hoy.getMonth() + 1 && periodos.some((p) => p.anio === ultimo.anio && p.hasta === ultimo.mes);

  // Movers · carga lazy al abrir la sección; se re-pide si cambian los años involucrados
  const yearsKey = useMemo(() => Array.from(new Set(periodos.map((p) => p.anio))).sort().join(','), [periodos]);
  useEffect(() => {
    if (!moversOpen || !yearsKey || (sku && sku.key === yearsKey)) return;
    let cancel = false;
    setSkuLoading(true);
    const years = yearsKey.split(',').map(Number);
    const q = clienteKey
      ? () => supabase.from('facturacion_clientes').select('sku,anio,mes,piezas,monto').eq('cliente_key', clienteKey).in('anio', years)
      : () => supabase.from('v_facturacion_global_sku_mes').select('sku,anio,mes,piezas,monto').in('anio', years);
    fetchAllQ(q, { pageSize: clienteKey ? 500 : 1000, orderCol: 'sku', label: 'comparador-sku' })
      .then((rows) => { if (!cancel) setSku({ key: yearsKey, rows }); })
      .catch(() => { if (!cancel) setSku({ key: yearsKey, rows: [] }); })
      .finally(() => { if (!cancel) setSkuLoading(false); });
    return () => { cancel = true; };
  }, [moversOpen, yearsKey, clienteKey, sku]);

  const movers = useMemo(() => {
    if (!sku || periodos.length < 2) return null;
    const pA = periodos[0], pB = periodos[1];
    const by = new Map();
    sku.rows.forEach((r) => {
      const inA = enPeriodo(r, pA), inB = enPeriodo(r, pB);
      if (!inA && !inB) return;
      const s = by.get(r.sku) || { sku: r.sku, mA: 0, pA: 0, mB: 0, pB: 0 };
      if (inA) { s.mA += N(r.monto); s.pA += N(r.piezas); }
      if (inB) { s.mB += N(r.monto); s.pB += N(r.piezas); }
      by.set(r.sku, s);
    });
    const all = Array.from(by.values()).map((s) => ({ ...s, d: s.mA - s.mB })).filter((s) => s.d !== 0);
    all.sort((a, b) => b.d - a.d);
    return { up: all.filter((s) => s.d > 0).slice(0, 8), down: all.filter((s) => s.d < 0).reverse().slice(0, 8) };
  }, [sku, periodos]);

  const chartData = useMemo(() => {
    const len = Math.max(0, ...totales.map((t) => t.meses.length));
    return Array.from({ length: len }, (_, i) => {
      const row = { pos: i };
      totales.forEach((t, k) => { const m = t.meses[i]; row[periodos[k].id] = m?.monto ?? null; row[`${periodos[k].id}_lbl`] = m ? `${MESES[m.mes - 1]} ${periodos[k].anio}` : ''; });
      row.label = row.A_lbl ? row.A_lbl.split(' ')[0] : '';
      return row;
    });
  }, [totales, periodos]);

  const copiar = () => {
    if (!A || !B) return;
    const nombre = clienteKey ? clienteKey.charAt(0).toUpperCase() + clienteKey.slice(1) : 'Global';
    const l1 = `Sell In ${nombre} · ${labelPeriodo(periodos[0])} vs ${labelPeriodo(periodos[1])}${esM3 ? ` vs ${labelPeriodo(periodos[2])}` : ''}`;
    const l2 = `Facturación ${formatMXN(A.monto)} vs ${formatMXN(B.monto)} (${pctTxt(deltaPct(A.monto, B.monto))}) · Piezas ${int(A.piezas)} vs ${int(B.piezas)} (${pctTxt(deltaPct(A.piezas, B.piezas))})`;
    const l3 = `Ticket promedio ${formatMXN(A.ticket || 0)} vs ${formatMXN(B.ticket || 0)}${A.hayMedidas && B.hayMedidas ? ` · Contribución ${formatMXN(A.contribucion)} vs ${formatMXN(B.contribucion)} (MC ${A.mc?.toFixed(1)}% vs ${B.mc?.toFixed(1)}%)` : ''}`;
    navigator.clipboard?.writeText([l1, l2, l3].join('\n')).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1600); });
  };

  const segBg = isDark ? 'rgba(120,120,128,0.24)' : 'rgba(120,120,128,0.12)';
  const segOn = isDark ? 'rgba(99,99,102,0.9)' : '#FFFFFF';
  const segOff = isDark ? 'rgba(235,235,245,0.60)' : 'rgba(60,60,67,0.60)';
  const selStyle = { ...mono, fontSize: 11, fontWeight: 600, color: theme.text, background: theme.surface, border, borderRadius: 7, padding: '3px 6px', height: 26, cursor: 'pointer' };
  const setLibreP = (id, patch) => setLibre((s) => {
    const p = { ...s[id], ...patch };
    if (p.hasta < p.desde) p[patch.desde != null ? 'hasta' : 'desde'] = patch.desde ?? patch.hasta;
    return { ...s, [id]: p };
  });
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
            <Kpi k="Contribución" get={(t) => (t.hayMedidas ? t.contribucion : null)} fmtV={money} sub={(t) => (t.mc != null ? `MC ${t.mc.toFixed(1)}%` : 'sin medidas')} />
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
