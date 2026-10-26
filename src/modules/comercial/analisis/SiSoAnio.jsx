// Página del cliente · Resumen · «Sell in vs sell out del año, con la cuota» (3.96.0 · 2026-10-26, bloque 1 del mockup
// aprobado por Fernando). Sustituye al Panel «Tendencia · últimos 12 meses» del DrillCliente en vista completa:
// 12 meses del año elegido con sell in del cliente, sell out de la cuenta ligada (si reporta), sell in del año anterior
// en gris y la cuota mensual punteada; debajo, una frase de lectura. Motor puro en siso.js.
import React, { useMemo } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { Panel, GraficaLineas } from '../../../components/kit';
import { useMensual, CUENTA_POR_ERP } from '../sellout/datos';
import { serieSiSoAnio, fraseSiSo } from './siso';
import { money } from './formato';

export default function SiSoAnio({ cliente, anio, cuotas }) {
  const cuenta = CUENTA_POR_ERP[cliente.cliente] || null;
  const { data: mensualSO = [], isLoading } = useMensual(anio);
  const hoy = new Date();
  const hastaMes = anio === hoy.getFullYear() ? hoy.getMonth() + 1 : anio > hoy.getFullYear() ? 0 : 12;
  const serie = useMemo(() => serieSiSoAnio({ mensual: cliente.mensual, mensualSO, cuenta, cuotas, cliente: cliente.cliente, anio, hastaMes }), [cliente, mensualSO, cuenta, cuotas, anio, hastaMes]);
  const frase = useMemo(() => fraseSiSo(serie, { anio, hastaMes }), [serie, anio, hastaMes]);
  return <SiSoAnioVista serie={serie} frase={frase} anio={anio} tieneSellOut={!!cuenta} cargandoSellOut={!!cuenta && isLoading} />;
}

/** Vista pura (SSR en scripts/test-pagina-cliente-ssr.mjs). */
export function SiSoAnioVista({ serie = [], frase, anio, tieneSellOut, cargandoSellOut = false }) {
  const { theme } = useTheme();
  const tieneCuota = serie.some((d) => d.cuota != null);
  const meta = [
    `${anio} mes a mes`,
    tieneSellOut ? 'sell out de la cuenta ligada' : 'este cliente no reporta sell out',
    `gris = sell in ${anio - 1}`,
    tieneCuota ? 'punteado verde = cuota' : 'sin cuota cargada',
  ].join(' · ');
  const series = [
    { key: 'sellIn', label: 'Sell in', tipo: 'principal' },
    ...(tieneSellOut ? [{ key: 'sellOut', label: 'Sell out', tipo: 'linea', color: theme.purple || '#AF52DE' }] : []),
    { key: 'anterior', label: `Sell in ${anio - 1}`, tipo: 'anterior' },
    ...(tieneCuota ? [{ key: 'cuota', label: 'Cuota', tipo: 'cuota' }] : []),
  ];
  return (
    <Panel titulo="Sell in vs sell out del año, con la cuota" meta={cargandoSellOut ? `${meta} · cargando sell out…` : meta} padding="6px 8px 8px">
      <GraficaLineas datos={serie.map((d) => ({ x: d.x, sellIn: d.sellIn, sellOut: d.sellOut, anterior: d.anterior, cuota: d.cuota }))} series={series} formato={money} alto={230} />
      {frase && <div style={{ fontSize: 12, color: theme.text, lineHeight: 1.45, padding: '6px 6px 0', borderTop: `1px solid ${theme.border}`, marginTop: 4 }}>{frase}</div>}
    </Panel>
  );
}
