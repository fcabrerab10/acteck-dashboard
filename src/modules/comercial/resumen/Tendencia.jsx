// Tendencia 12 meses · Sell In vs cuota ideal (y mínima si difiere) vs año anterior. Recharts, misma
// estética que RentabilidadBloque (sin animación, hairlines, área con fillOpacity).
import React, { useMemo, useState } from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { money } from '../../../lib/format';
import { Panel, Segmented } from '../../../components/kit';
import { calcularTendencia, CLIENTES } from './calculo';
import { fmtCompact, fmtPct } from './textos';

const OPCIONES = [{ id: 'todos', label: 'Todos' }, ...CLIENTES.map((c) => ({ id: c.key, label: c.nombre }))];

export default function Tendencia({ data, periodo }) {
  const { theme } = useTheme();
  const [filtro, setFiltro] = useState('todos');
  const { rows, conMin, anio } = useMemo(() => calcularTendencia(data, filtro, periodo), [data, filtro, periodo]);
  const sel = rows.find((r) => r.esSeleccionado);

  const blue = theme.accent || '#007AFF', green = theme.green || '#34C759', gris = theme.textMuted;
  const orange = theme.orange || '#FF9500', red = theme.red || '#FF3B30';
  const border = `1px solid ${theme.border}`;
  const cumpl = sel && sel.cuotaIdeal > 0 && sel.sellIn > 0 ? (sel.sellIn / sel.cuotaIdeal) * 100 : null;

  const meta = sel ? (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {sel.label} {anio}: Sell In <strong style={{ color: theme.text, fontWeight: 500 }}>{fmtCompact(sel.sellIn || 0)}</strong>
      {sel.cuotaIdeal != null && <> · cuota {fmtCompact(sel.cuotaIdeal)}</>}
      {conMin && sel.cuotaMin != null && <> (mín. {fmtCompact(sel.cuotaMin)})</>}
      {sel.sellInPrev != null && <> · {anio - 1}: {fmtCompact(sel.sellInPrev)}</>}
      {cumpl != null && <> · <span style={{ color: cumpl >= 90 ? green : cumpl >= 80 ? orange : red, fontWeight: 600 }}>{fmtPct(cumpl)}</span></>}
    </span>
  ) : null;

  const leyenda = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 9.5, color: theme.textMuted, fontFamily: TYPO.fontDisplay, fontWeight: 500, marginBottom: 6 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 2, borderRadius: 1, background: blue }} />Sell In {anio}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 0, borderTop: `2px dashed ${green}` }} />Cuota ideal</span>
      {conMin && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 0, borderTop: `2px dotted ${green}` }} />Cuota mínima</span>}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 2, borderRadius: 1, background: gris, opacity: 0.6 }} />{anio - 1}</span>
    </div>
  );

  return (
    <Panel titulo={`Tendencia ${anio} · Sell In vs cuota`} meta={meta}
      acciones={<Segmented options={OPCIONES} value={filtro} onChange={setFiltro} />}>
      {leyenda}
      <div style={{ height: 190, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="resumenSellInFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={blue} stopOpacity={0.22} />
                <stop offset="1" stopColor={blue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={theme.border} strokeDasharray="2 4" />
            <XAxis dataKey="label" tick={{ fontSize: 9.5, fill: theme.textMuted, fontFamily: TYPO.fontDisplay }} axisLine={false} tickLine={false} />
            <YAxis hide domain={[0, 'auto']} />
            <Tooltip
              cursor={{ stroke: theme.border }}
              contentStyle={{ background: theme.surface, border, borderRadius: 10, fontSize: 11, fontFamily: TYPO.fontText, color: theme.text }}
              formatter={(v, n) => [money(v), n]}
              labelFormatter={(l) => `${l} ${anio}`}
            />
            {sel && <ReferenceLine x={sel.label} stroke={theme.textSubtle || theme.textMuted} strokeDasharray="3 3" />}
            <Area type="monotone" dataKey="sellIn" name={`Sell In ${anio}`} stroke={blue} strokeWidth={2.2} fill="url(#resumenSellInFill)" fillOpacity={1}
              dot={{ r: 2, strokeWidth: 0, fill: blue }} activeDot={{ r: 3.5 }} isAnimationActive={false} connectNulls={false} />
            <Line type="monotone" dataKey="cuotaIdeal" name="Cuota ideal" stroke={green} strokeWidth={1.8} strokeDasharray="4 3" dot={false} activeDot={{ r: 3 }} isAnimationActive={false} connectNulls />
            {conMin && <Line type="monotone" dataKey="cuotaMin" name="Cuota mínima" stroke={green} strokeWidth={1.4} strokeDasharray="1 3" strokeOpacity={0.8} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} connectNulls />}
            <Line type="monotone" dataKey="sellInPrev" name={String(anio - 1)} stroke={gris} strokeWidth={1.5} strokeOpacity={0.6} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
