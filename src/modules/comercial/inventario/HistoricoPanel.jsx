// Panel "Tendencia" · histórico diario del inventario comercial (v_inventario_historico_dia):
// valor a costo (sólo con permiso sensible) / piezas y días de inventario a la demanda actual.
// LineChart de Recharts sin animación. Con 1 sola foto muestra "histórico desde hoy".
import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Pill } from '../../../components/kit';
import { fmtCompact, fmtInt, fmtFechaCorta, N } from './constantes';

/** Fila del histórico más cercana (hacia atrás) a `hoy - dias`. null si no hay. */
export function fotoHace(historico, dias) {
  if (!historico?.length) return null;
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - dias);
  const lim = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const antes = historico.filter((h) => h.fecha <= lim);
  return antes.length ? antes[antes.length - 1] : null;
}

export default function HistoricoPanel({ historico, demandaDia, sensible }) {
  const { theme } = useTheme();
  const datos = useMemo(() => (historico || []).map((h) => ({
    fecha: h.fecha, label: fmtFechaCorta(h.fecha), piezas: N(h.piezas), valor: N(h.valor), skus: N(h.skus_con_stock),
    dias: demandaDia > 0 ? N(h.piezas) / demandaDia : null,
  })), [historico, demandaDia]);
  const n = datos.length;
  const ultimo = datos[n - 1], primero = datos[0];
  const hace30 = fotoHace(datos, 30);

  const ejeY = { fontSize: 9.5, fill: theme.textMuted, fontFamily: TYPO.fontDisplay };
  const tooltipStyle = { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, fontFamily: TYPO.fontText, fontSize: 11, color: theme.text, boxShadow: 'none' };

  const meta = n === 0 ? 'sin fotos todavía · la primera se guarda hoy con la carga del puente'
    : n === 1 ? `histórico desde ${fmtFechaCorta(primero.fecha)} · 1 foto`
    : `${fmtInt(n)} fotos · ${fmtFechaCorta(primero.fecha)} → ${fmtFechaCorta(ultimo.fecha)}${hace30 ? ` · vs ${fmtFechaCorta(hace30.fecha)}` : ''}`;

  // Función (no componente) para no remontar el chart en cada render.
  const grafica = ({ titulo, dataKey, fmt, color }) => (
    <div key={dataKey} style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 2px 4px' }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text }}>{titulo}</span>
        {ultimo && <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{fmt(ultimo[dataKey])}</span>}
      </div>
      <div style={{ height: 150 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={theme.divider || theme.border} vertical={false} />
            <XAxis dataKey="label" tick={ejeY} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tick={ejeY} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => fmt(v)} domain={['auto', 'auto']} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmt(v), titulo]} labelFormatter={(l) => l} cursor={{ stroke: theme.border }} />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={n <= 2} isAnimationActive={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <Panel titulo="Tendencia del inventario" meta={meta} plegable abiertoInicial padding="10px 12px">
      {n === 0 && <p style={{ margin: 0, fontSize: 12, color: theme.textMuted, fontFamily: TYPO.fontText }}>Aún no hay fotos diarias. El puente SQL guarda una al cierre de cada día (inventario_historico).</p>}
      {n > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: TYPO.fontText }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {n === 1 && <Pill tone="gray" size="xs" dot>histórico desde hoy · la tendencia aparece con las próximas fotos</Pill>}
            {n > 1 && !hace30 && <Pill tone="gray" size="xs" dot>aún sin 30 días de histórico · comparativo vs la primera foto</Pill>}
            {n > 1 && ['piezas', 'dias', ...(sensible ? ['valor'] : [])].map((k) => {
              const ref = hace30 || primero;
              const d = ref && ref[k] ? ((ultimo[k] - ref[k]) / ref[k]) * 100 : null;
              if (d == null) return null;
              const label = k === 'piezas' ? 'Piezas' : k === 'dias' ? 'Días de inventario' : 'Valor';
              return <Pill key={k} tone={Math.abs(d) < 0.5 ? 'gray' : d > 0 ? (k === 'dias' ? 'orange' : 'blue') : 'green'} size="xs">{label} {d > 0 ? '+' : ''}{d.toFixed(1)}% vs {fmtFechaCorta(ref.fecha)}</Pill>;
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {sensible
              ? grafica({ titulo: 'Valor a costo', dataKey: 'valor', fmt: fmtCompact, color: theme.accent })
              : grafica({ titulo: 'Piezas', dataKey: 'piezas', fmt: fmtInt, color: theme.accent })}
            {grafica({ titulo: 'Días de inventario · a demanda actual', dataKey: 'dias', fmt: (v) => (v == null ? '—' : `${fmtInt(v)} d`), color: theme.orange })}
            {sensible && grafica({ titulo: 'Piezas', dataKey: 'piezas', fmt: fmtInt, color: theme.green })}
          </div>
          <div style={{ fontSize: 10, color: theme.textMuted }}>Foto de fin de día (última corrida del puente) · almacenes comerciales · días = piezas ÷ demanda ERP diaria de 3 meses cerrados (la de hoy, aplicada a todo el histórico).</div>
        </div>
      )}
    </Panel>
  );
}
