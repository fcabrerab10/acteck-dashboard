// Tendencia mensual · Recharts con la estética de RentabilidadBloque (línea del año en accent,
// año anterior punteada en gris, margen bruto en naranja). Clic en un mes → ficha del mes.
import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Segmented } from '../../../components/kit';
import { moneyCompact, pct } from '../../../lib/format';

const MODOS = [
  { id: 'venta', label: 'Venta neta', key: 'ventaNeta', keyPrev: 'ventaNetaPrev', fmt: moneyCompact },
  { id: 'uafir', label: 'UAII (UAFIR)', key: 'uafir', keyPrev: 'uafirPrev', fmt: moneyCompact },
  { id: 'margen', label: 'Margen bruto', key: 'margenBrutoPct', keyPrev: 'margenBrutoPctPrev', fmt: (v) => pct(v) },
];

export default function Tendencia({ serie, anio, mesMax, onMesClick }) {
  const { theme } = useTheme();
  const [modo, setModo] = useState('venta');
  const cfg = MODOS.find((m) => m.id === modo) || MODOS[0];
  const blue = theme.accent || '#007AFF';
  const gris = theme.textSubtle || theme.textMuted;
  const border = `1px solid ${theme.border}`;
  const esPct = modo === 'margen';

  const promedio = useMemo(() => {
    const vals = serie.map((d) => d[cfg.key]).filter((v) => v != null && Number.isFinite(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [serie, cfg.key]);

  const data = useMemo(() => serie.map((d) => ({ lbl: d.lbl, mes: d.mes, actual: d[cfg.key], previo: d[cfg.keyPrev] })), [serie, cfg]);

  const onClick = (st) => {
    const i = st?.activeTooltipIndex;
    if (i == null || !onMesClick) return;
    const m = Number(i) + 1;
    if (m >= 1 && m <= mesMax) onMesClick(m);
  };

  return (
    <Panel
      titulo={`Tendencia mensual · ${cfg.label}`}
      meta={promedio != null ? `promedio ${cfg.fmt(promedio)}/mes · ${anio - 1} punteado · clic en un mes abre su ficha` : `${anio - 1} punteado`}
      acciones={<Segmented value={modo} onChange={setModo} options={MODOS.map((m) => ({ id: m.id, label: m.label }))} />}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 9.5, color: theme.textMuted, fontFamily: TYPO.fontDisplay, fontWeight: 500, marginBottom: 4 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 2, borderRadius: 1, background: blue }} />{anio}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 0, borderTop: `2px dashed ${gris}` }} />{anio - 1}</span>
      </div>
      <div style={{ height: 220, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }} onClick={onClick} style={{ cursor: onMesClick ? 'pointer' : 'default' }}>
            <CartesianGrid vertical={false} stroke={theme.border} strokeDasharray="2 4" />
            <XAxis dataKey="lbl" tick={{ fontSize: 10, fill: theme.textMuted, fontFamily: TYPO.fontDisplay }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9.5, fill: theme.textMuted, fontFamily: TYPO.fontDisplay }} axisLine={false} tickLine={false} width={52}
              tickFormatter={(v) => (esPct ? `${Math.round(v)}%` : moneyCompact(v))} domain={esPct ? [0, 'auto'] : ['auto', 'auto']} />
            {!esPct && <ReferenceLine y={0} stroke={theme.divider || theme.border} />}
            <Tooltip
              cursor={{ stroke: theme.border }}
              contentStyle={{ background: theme.surface, border, borderRadius: 10, fontSize: 11, fontFamily: TYPO.fontText, color: theme.text }}
              labelFormatter={(l) => `${l}`}
              formatter={(v, n) => [cfg.fmt(v), n]}
            />
            <Line type="monotone" dataKey="previo" name={String(anio - 1)} stroke={gris} strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 2, strokeWidth: 0, fill: gris }} activeDot={{ r: 3 }} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="actual" name={String(anio)} stroke={blue} strokeWidth={2.2} dot={{ r: 3, strokeWidth: 0, fill: blue }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
