// Tabla formal del P&L · TablaCompacta con grupos plegables (fila de grupo clicable), 12 meses del año,
// Mes vs mismo mes del año anterior, YTD vs YTD anterior y Δ; fila expandible por cuenta con la
// evolución de 24 meses (Recharts). Toda cifra completa va en el title de la celda.
import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { TablaCompacta, DeltaPill, Pill } from '../../../components/kit';
import { money, moneyCompact, pct, pp } from '../../../lib/format';
import { MESES_LBL, GRUPOS_TABLA, evolucion24 } from './calculo';

const dotColor = (theme, key) => ({ green: theme.green, red: theme.red, orange: theme.orange, pink: theme.pink, purple: theme.purple, accent: theme.accent }[key] || theme.textMuted);

const fmtCelda = (v, formato) => (v == null ? '—' : formato === 'pct' ? pct(v * 100) : moneyCompact(v));
const fmtTitle = (v, formato) => (v == null ? '' : formato === 'pct' ? pct(v * 100, 2) : money(v));

export default function TablaFormal({ idx, idxPrev, filas, anio, mesSel, mesMax, onMesClick }) {
  const { theme } = useTheme();
  const [cerrados, setCerrados] = useState(() => new Set(GRUPOS_TABLA.filter((g) => !g.defaultOpen).map((g) => g.id)));
  const [expandida, setExpandida] = useState(null);

  const visibles = useMemo(() => filas.filter((r) => r.tipo === 'grupo' || !cerrados.has(r.grupoId)), [filas, cerrados]);

  const toggleGrupo = (id) => setCerrados((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const peso = (r, base = 400) => (r.tipo === 'subtotal' ? 600 : base);
  const colorValor = (r, v) => (v == null ? theme.textSubtle || theme.textMuted : v < 0 ? theme.red : theme.text);

  const celdaMes = (m) => ({
    key: `m${m}`, label: MESES_LBL[m - 1], align: 'right', width: 74,
    render: (r) => {
      if (r.tipo === 'grupo') return '';
      const v = r.valores[m];
      const sel = m === mesSel;
      return (
        <span title={[fmtTitle(v, r.formato), r.notas?.[m]].filter(Boolean).join(' · ')}
          onClick={v != null && onMesClick ? (e) => { e.stopPropagation(); onMesClick(m); } : undefined}
          style={{ display: 'inline-block', padding: '1px 5px', borderRadius: 6, fontWeight: peso(r), color: colorValor(r, v),
            background: sel ? `${theme.accent}14` : 'transparent', cursor: v != null && onMesClick ? 'pointer' : 'default',
            textDecoration: r.notas?.[m] ? `underline dotted ${theme.textMuted}` : 'none', textUnderlineOffset: 3 }}>
          {fmtCelda(v, r.formato)}
        </span>
      );
    },
  });

  const columnas = useMemo(() => [
    { key: 'label', label: 'Cuenta', align: 'left', width: 230, render: (r) => {
      if (r.tipo === 'grupo') {
        const abierto = !cerrados.has(r.grupoId);
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted }}>
            {abierto ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span style={{ width: 6, height: 6, borderRadius: 999, background: dotColor(theme, r.dotKey), display: 'inline-block' }} />
            {r.label}
            <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: 'none', color: theme.textSubtle || theme.textMuted }}>{r.n} cuentas</span>
          </span>
        );
      }
      return (
        <span title={r.notaGeneral || r.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingLeft: r.esSubcuenta ? 14 : 0, fontWeight: peso(r), color: r.esSubcuenta ? theme.textSubtle || theme.textMuted : theme.text, fontStyle: r.esSubcuenta ? 'italic' : 'normal', fontFamily: r.tipo === 'subtotal' ? TYPO.fontDisplay : TYPO.fontText, letterSpacing: r.tipo === 'subtotal' ? '-0.01em' : 0 }}>
          {expandida === r.id ? <ChevronDown size={11} style={{ color: theme.textMuted }} /> : <ChevronRight size={11} style={{ color: theme.textSubtle || theme.textMuted }} />}
          {r.label}
          {r.notaGeneral && <Pill tone="gray" size="xs" title={r.notaGeneral}>nota</Pill>}
        </span>
      );
    } },
    ...Array.from({ length: 12 }, (_, i) => celdaMes(i + 1)),
    { key: 'mesPrev', label: `${MESES_LBL[mesSel - 1]} ${anio - 1}`, align: 'right', width: 78, render: (r) => (r.tipo === 'grupo' ? '' : <span title={fmtTitle(r.mesPrev, r.formato)} style={{ color: theme.textMuted, fontWeight: peso(r) }}>{fmtCelda(r.mesPrev, r.formato)}</span>) },
    { key: 'deltaMes', label: 'Δ mes', align: 'right', width: 70, render: (r) => (r.tipo === 'grupo' ? '' : r.formato === 'pct' ? (r.deltaMes == null ? <Pill tone="gray">—</Pill> : <Pill tone={r.deltaMes >= 0 ? 'green' : 'red'}>{pp(r.deltaMes * 100)}</Pill>) : <DeltaPill value={r.deltaMes} digits={1} />) },
    { key: 'ytd', label: `YTD ${anio}`, align: 'right', width: 80, render: (r) => (r.tipo === 'grupo' ? '' : <span title={fmtTitle(r.ytd, r.formato)} style={{ fontWeight: r.tipo === 'subtotal' ? 700 : 500, color: colorValor(r, r.ytd) }}>{r.formato === 'pct' ? '—' : fmtCelda(r.ytd, r.formato)}</span>) },
    { key: 'ytdPrev', label: `YTD ${anio - 1}`, align: 'right', width: 80, render: (r) => (r.tipo === 'grupo' ? '' : <span title={fmtTitle(r.ytdPrev, r.formato)} style={{ color: theme.textMuted, fontWeight: peso(r) }}>{r.formato === 'pct' ? '—' : fmtCelda(r.ytdPrev, r.formato)}</span>) },
    { key: 'deltaYtd', label: 'Δ YTD', align: 'right', width: 70, render: (r) => (r.tipo === 'grupo' || r.formato === 'pct' ? '' : <DeltaPill value={r.deltaYtd} digits={1} />) },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [cerrados, expandida, mesSel, anio, theme, onMesClick]);

  const rowStyle = (r) => {
    if (r.tipo === 'grupo') return { background: theme.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)' };
    if (r.tipo === 'subtotal') return { background: `${theme.accent}08` };
    return {};
  };

  return (
    <TablaCompacta
      dense
      columnas={columnas}
      filas={visibles}
      rowKey={(r) => r.id}
      rowStyle={rowStyle}
      onRowClick={(r) => (r.tipo === 'grupo' ? toggleGrupo(r.grupoId) : setExpandida((k) => (k === r.id ? null : r.id)))}
      expandidoKey={expandida}
      renderExpandido={(r) => <EvolucionCuenta idx={idx} idxPrev={idxPrev} fila={r} anio={anio} mesMax={mesMax} />}
      vacio="Sin cuentas cargadas para este año."
    />
  );
}

function EvolucionCuenta({ idx, idxPrev, fila, anio, mesMax }) {
  const { theme } = useTheme();
  const blue = theme.accent || '#007AFF';
  const border = `1px solid ${theme.border}`;
  const esPct = fila.formato === 'pct';
  const data = useMemo(() => evolucion24(idx, idxPrev, fila.id, anio).map((d) => ({ ...d, valor: esPct && d.valor != null ? d.valor * 100 : d.valor })), [idx, idxPrev, fila.id, anio, esPct]);
  const fmt = (v) => (esPct ? pct(v) : moneyCompact(v));
  const notas = Object.entries(fila.notas || {}).sort((a, b) => Number(a[0]) - Number(b[0]));
  const vals = data.filter((d) => d.valor != null);
  const min = vals.length ? vals.reduce((a, d) => (d.valor < a.valor ? d : a)) : null;
  const max = vals.length ? vals.reduce((a, d) => (d.valor > a.valor ? d : a)) : null;
  return (
    <div style={{ padding: '10px 12px 12px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: 14, background: theme.surface, fontFamily: TYPO.fontText }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textMuted, marginBottom: 6 }}>
          {fila.label} · evolución 24 meses · {anio - 1}–{anio}
        </div>
        <div style={{ height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={theme.border} strokeDasharray="2 4" />
              <XAxis dataKey="k" tick={{ fontSize: 9, fill: theme.textMuted, fontFamily: TYPO.fontDisplay }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={{ fontSize: 9, fill: theme.textMuted, fontFamily: TYPO.fontDisplay }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => fmt(v)} domain={['auto', 'auto']} />
              <ReferenceLine y={0} stroke={theme.divider || theme.border} />
              <Tooltip cursor={{ stroke: theme.border }} contentStyle={{ background: theme.surface, border, borderRadius: 10, fontSize: 11, fontFamily: TYPO.fontText, color: theme.text }} formatter={(v) => [fmt(v), fila.label]} />
              <Line type="monotone" dataKey="valor" stroke={blue} strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: blue }} activeDot={{ r: 4 }} connectNulls isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, color: theme.textMuted, minWidth: 0 }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textMuted }}>Resumen</div>
        <Linea theme={theme} k={`YTD ${anio}`} v={esPct ? '—' : money(fila.ytd)} />
        <Linea theme={theme} k={`YTD ${anio - 1}`} v={esPct ? '—' : money(fila.ytdPrev)} />
        <Linea theme={theme} k={`Último mes (${MESES_LBL[mesMax - 1]})`} v={fila.valores[mesMax] == null ? '—' : fmt(esPct ? fila.valores[mesMax] * 100 : fila.valores[mesMax])} />
        {max && <Linea theme={theme} k="Máximo" v={`${fmt(max.valor)} · ${max.k}`} />}
        {min && <Linea theme={theme} k="Mínimo" v={`${fmt(min.valor)} · ${min.k}`} />}
        {notas.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textMuted, marginBottom: 3 }}>Notas</div>
            {notas.map(([m, n]) => <div key={m} style={{ fontSize: 10.5, color: theme.text }}><span style={{ color: theme.textMuted }}>{MESES_LBL[Number(m) - 1]}:</span> {n}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}

function Linea({ theme, k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderBottom: `1px solid ${theme.divider || theme.border}`, padding: '2px 0' }}>
      <span>{k}</span>
      <span style={{ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', color: theme.text, fontWeight: 500, whiteSpace: 'nowrap' }}>{v}</span>
    </div>
  );
}
