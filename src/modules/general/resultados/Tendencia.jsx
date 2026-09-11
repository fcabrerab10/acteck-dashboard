// Tendencia mensual · Recharts con la estética de RentabilidadBloque (línea del año en accent,
// año anterior punteada en gris, margen bruto en naranja). Clic en un mes → ficha del mes.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { Panel, Segmented, GraficaLineas } from '../../../components/kit';
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
  const esPct = modo === 'margen';

  const promedio = useMemo(() => {
    const vals = serie.map((d) => d[cfg.key]).filter((v) => v != null && Number.isFinite(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [serie, cfg.key]);

  const data = useMemo(() => serie.map((d) => ({ lbl: d.lbl, mes: d.mes, actual: d[cfg.key], previo: d[cfg.keyPrev] })), [serie, cfg]);

  const onClickMes = onMesClick ? (i) => { const m = i + 1; if (m >= 1 && m <= mesMax) onMesClick(m); } : undefined;

  return (
    <Panel
      titulo={`Tendencia mensual · ${cfg.label}`}
      meta={promedio != null ? `promedio ${cfg.fmt(promedio)}/mes · ${anio - 1} punteado · clic en un mes abre su ficha` : `${anio - 1} punteado`}
      acciones={<Segmented value={modo} onChange={setModo} options={MODOS.map((m) => ({ id: m.id, label: m.label }))} />}
    >
      <GraficaLineas datos={data.map((d) => ({ x: d.lbl, actual: d.actual, previo: d.previo }))}
        series={[{ key: 'actual', label: String(anio), tipo: 'principal' }, { key: 'previo', label: String(anio - 1), tipo: 'anterior' }]}
        formato={cfg.fmt} alto={220} desdeCero={esPct} mesActivo={mesMax - 1} onClickMes={onClickMes} />
    </Panel>
  );
}
