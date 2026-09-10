// Pareto de clientes · curva de % acumulado con corte 80 % + tabla ordenada por venta acumulada.
// Recibe las filas ya aplanadas (incluida la fila-grupo "Otros · compra ocasional", expandible).
import React, { useMemo, useState } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ResponsiveContainer } from 'recharts';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, TablaCompacta, Pill } from '../../../components/kit';
import { pareto, OTROS_KEY } from './calc';
import { money, moneyFull, pct, toneCanal, labelCanal } from './formato';

const CORTE = 80;

export default function ParetoPanel({ filas, periodoLbl }) {
  const { theme } = useTheme();
  const accent = theme.accent || '#007AFF', orange = theme.orange || '#FF9500';
  const [abierto, setAbierto] = useState(null);
  const p = useMemo(() => pareto(filas, CORTE), [filas]);
  const chart = useMemo(() => p.lista.slice(0, 40).map((f) => ({ ...f, nombreCorto: f.esGrupo ? 'Otros' : String(f.nombre).slice(0, 14) })), [p]);

  const cols = [
    { key: 'rank', label: '#', align: 'left', width: 32, render: (r) => <span style={{ color: theme.textMuted }}>{r.rank}</span> },
    { key: 'nombre', label: 'Cliente', align: 'left', maxWidth: 260, render: (r) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: r.esGrupo ? 600 : 500 }}>{r.nombre}</span>
        {r.rank <= p.nCorte && <Pill tone="orange" size="xs">80 %</Pill>}
      </span>
    ) },
    { key: 'canal', label: 'Canal', align: 'left', width: 90, render: (r) => (r.esGrupo ? <span style={{ color: theme.textMuted }}>varios</span> : <Pill tone={toneCanal(r.canal)} size="xs">{labelCanal(r.canal)}</Pill>) },
    { key: 'fact_neta', label: 'Fact. neta', bold: true, render: (r) => moneyFull(r.fact_neta) },
    { key: 'pct', label: '%', width: 60, render: (r) => pct(r.pct) },
    { key: 'pctAcum', label: '% acum.', width: 70, render: (r) => <span style={{ fontWeight: 600, color: r.rank <= p.nCorte ? orange : theme.textMuted }}>{pct(r.pctAcum)}</span> },
  ];
  const tip = { fontSize: 11, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' };

  return (
    <Panel titulo="Pareto de clientes" meta={`${periodoLbl} · ${p.nCorte} cliente${p.nCorte === 1 ? '' : 's'} hacen el ${CORTE} % de ${money(p.total)}`} plegable abiertoInicial>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr)', gap: 12, fontFamily: TYPO.fontText }}>
        <div>
          <div style={{ fontSize: 10.5, color: theme.textMuted, marginBottom: 4 }}>Barras = fact. neta por cliente · línea = % acumulado · primeros 40</div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <ComposedChart data={chart} margin={{ top: 8, right: 6, left: -6, bottom: 34 }}>
                <CartesianGrid stroke={theme.border} vertical={false} strokeOpacity={0.6} />
                <XAxis dataKey="nombreCorto" tick={{ fontSize: 8.5, fill: theme.textMuted }} axisLine={false} tickLine={false} interval={0} angle={-45} textAnchor="end" height={40} />
                <YAxis yAxisId="m" tickFormatter={money} tick={{ fontSize: 9, fill: theme.textMuted }} axisLine={false} tickLine={false} width={46} />
                <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9, fill: theme.textMuted }} axisLine={false} tickLine={false} width={34} />
                <Tooltip contentStyle={tip} labelFormatter={(_, pl) => pl?.[0]?.payload?.nombre || ''} formatter={(v, n) => (n === '% acum.' ? [pct(v), n] : [moneyFull(v), n])} />
                <ReferenceLine yAxisId="p" y={CORTE} stroke={orange} strokeDasharray="4 3" />
                <Bar yAxisId="m" dataKey="fact_neta" name="Fact. neta" fill={accent} fillOpacity={0.85} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Line yAxisId="p" type="monotone" dataKey="pctAcum" name="% acum." stroke={orange} strokeWidth={2} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <TablaCompacta dense columnas={cols} filas={p.lista} rowKey={(r) => r.cliente} maxHeight={340}
          onRowClick={(r) => (r.esGrupo ? setAbierto((k) => (k === r.cliente ? null : r.cliente)) : undefined)}
          expandidoKey={abierto}
          renderExpandido={(r) => (
            <div style={{ padding: 8 }}>
              <TablaCompacta dense maxHeight={260} rowKey={(h) => h.cliente}
                columnas={[
                  { key: 'cliente', label: 'Nº', align: 'left', width: 70, mono: true },
                  { key: 'nombre', label: 'Cliente', align: 'left', maxWidth: 240 },
                  { key: 'canal', label: 'Canal', align: 'left', width: 90, render: (h) => <Pill tone={toneCanal(h.canal)} size="xs">{labelCanal(h.canal)}</Pill> },
                  { key: 'fact_neta', label: 'Fact. neta', render: (h) => moneyFull(h.fact_neta) },
                  { key: 'mesesCompra12', label: 'Meses c/compra', width: 90 },
                ]}
                filas={[...(r.hijos || [])].sort((a, b) => b.fact_neta - a.fact_neta)} />
            </div>
          )} />
      </div>
      {p.lista.some((f) => f.cliente === OTROS_KEY) && <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 6 }}>La fila "Otros · compra ocasional" agrupa a los clientes con menos de 6 meses con compra en los últimos 12 o con venta YTD menor al 0.2 % del total; clic para verlos.</div>}
    </Panel>
  );
}
