// Tendencia 12 meses · Sell In vs cuota ideal (y mínima si difiere) vs año anterior. Recharts, misma
// estética que RentabilidadBloque (sin animación, hairlines, área con fillOpacity).
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { Panel, Segmented, GraficaLineas } from '../../../components/kit';
import { calcularTendencia, CLIENTES } from './calculo';
import { fmtCompact, fmtPct } from './textos';

const OPCIONES = [{ id: 'todos', label: 'Todos' }, ...CLIENTES.map((c) => ({ id: c.key, label: c.nombre }))];

export default function Tendencia({ data, periodo }) {
  const { theme } = useTheme();
  const [filtro, setFiltro] = useState('todos');
  const { rows, conMin, anio } = useMemo(() => calcularTendencia(data, filtro, periodo), [data, filtro, periodo]);
  const sel = rows.find((r) => r.esSeleccionado);

  const green = theme.green, orange = theme.orange, red = theme.red;
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

  return (
    <Panel titulo={`Tendencia ${anio} · Sell In vs cuota`} meta={meta}
      acciones={<Segmented options={OPCIONES} value={filtro} onChange={setFiltro} />}>
      <GraficaLineas datos={rows.map((r) => ({ x: r.label, sellIn: r.sellIn, cuotaIdeal: r.cuotaIdeal, cuotaMin: r.cuotaMin, sellInPrev: r.sellInPrev }))}
        series={[{ key: 'sellIn', label: `Sell In ${anio}`, tipo: 'principal' }, { key: 'sellInPrev', label: String(anio - 1), tipo: 'anterior' }, { key: 'cuotaIdeal', label: 'Cuota ideal', tipo: 'cuota' }, ...(conMin ? [{ key: 'cuotaMin', label: 'Cuota mínima', tipo: 'cuota', dash: '1 3' }] : [])]}
        formato={fmtCompact} alto={190} mesActivo={rows.findIndex((r) => r.esSeleccionado)} />
    </Panel>
  );
}
