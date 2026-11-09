// Puente ventas del ERP vs P&L · por mes: Venta neta del P&L (cuenta venta_neta) frente a
// Venta Neta y Fact. Neta del ERP (v_erp_medidas_mes), y Utilidad bruta del P&L frente a
// Contribución del ERP. Pill de alerta cuando |Δ| > UMBRAL_PUENTE_PCT. Ver nota en textos.js.
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, TablaCompacta, Pill } from '../../../components/kit';
import { money, moneyCompact } from '../../../lib/format';
import { UMBRAL_PUENTE_PCT } from './calculo';
import { NOTA_PUENTE, textoAlertaPuente } from './textos';
import { tooltip } from '../../../lib/medidas';

const fmtDelta = (n) => (n == null ? '—' : `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}%`);

export default function Puente({ puente, anio, mesMax, onMesClick }) {
  const { theme } = useTheme();
  if (!puente || !puente.filas.length) return null;
  const alertaTxt = textoAlertaPuente(puente, anio);
  const tot = puente.totales;
  const muted = { color: theme.textMuted };

  const dinero = (v) => (v == null ? '—' : <span title={money(v)}>{moneyCompact(v)}</span>);
  const difDinero = (v) => (v == null ? '—' : <span title={money(v)} style={{ color: Math.abs(v) < 1 ? theme.textMuted : v > 0 ? theme.green : theme.red }}>{v >= 0 ? '+' : '−'}{moneyCompact(Math.abs(v))}</span>);
  const difPct = (v, alerta) => (v == null ? <Pill tone="gray">—</Pill> : <Pill tone={alerta ? 'orange' : 'green'}>{fmtDelta(v)}</Pill>);
  const grande = (v) => v != null && Math.abs(v) > UMBRAL_PUENTE_PCT;

  const columnas = [
    { key: 'lbl', label: 'Mes', align: 'left', width: 60, render: (r) => (
      <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        {r.lbl}
        {r.soloErp && <Pill tone="gray" size="xs" title="El P&L de este mes aún no está cargado">sin P&L</Pill>}
        {r.soloPl && <Pill tone="gray" size="xs">sin ERP</Pill>}
      </span>) },
    { key: 'plVentaNeta', label: 'Venta neta P&L', render: (r) => dinero(r.plVentaNeta), fmt: moneyCompact },
    { key: 'erpVentaNeta', label: 'Venta Neta ERP', titulo: tooltip('venta_neta'), render: (r) => dinero(r.erpVentaNeta), fmt: moneyCompact },
    { key: 'difVentaNeta', label: 'Δ $', render: (r) => difDinero(r.difVentaNeta), renderTotal: (v) => difDinero(v) },
    { key: 'difVentaNetaPct', label: 'Δ %', render: (r) => difPct(r.difVentaNetaPct, r.alerta), renderTotal: (v) => difPct(v, grande(v)) },
    { key: 'erpFactNeta', label: 'Fact Neta ERP', titulo: tooltip('fact_neta'), render: (r) => <span style={muted}>{dinero(r.erpFactNeta)}</span>, fmt: moneyCompact },
    { key: 'difFactNetaPct', label: 'Δ % vs P&L', render: (r) => <span style={{ ...muted, fontVariantNumeric: 'tabular-nums' }} title={r.difFactNeta != null ? money(r.difFactNeta) : ''}>{fmtDelta(r.difFactNetaPct)}</span>, renderTotal: (v) => <span style={muted}>{fmtDelta(v)}</span> },
    { key: 'plUtilBruta', label: 'Utilidad bruta P&L', render: (r) => dinero(r.plUtilBruta), fmt: moneyCompact },
    { key: 'erpContribucion', label: 'Contribucion ERP', titulo: tooltip('contribucion'), render: (r) => dinero(r.erpContribucion), fmt: moneyCompact },
    { key: 'difContrib', label: 'Δ $', render: (r) => difDinero(r.difContrib), renderTotal: (v) => difDinero(v) },
    { key: 'difContribPct', label: 'Δ %', render: (r) => (r.difContribPct == null ? '—' : <span style={{ fontVariantNumeric: 'tabular-nums', color: theme.textMuted }}>{fmtDelta(r.difContribPct)}</span>), renderTotal: (v) => <span style={muted}>{fmtDelta(v)}</span> },
  ];

  const grupos = [
    { label: '', colSpan: 1 },
    { label: 'Ventas · P&L vs ERP', colSpan: 6, color: theme.accent },
    { label: 'Utilidad · P&L vs ERP', colSpan: 4, color: theme.green },
  ];

  const totales = tot ? {
    lbl: `YTD (${tot.meses} m)`, plVentaNeta: tot.plVentaNeta, erpVentaNeta: tot.erpVentaNeta, difVentaNeta: tot.difVentaNeta, difVentaNetaPct: tot.difVentaNetaPct,
    erpFactNeta: tot.erpFactNeta, difFactNetaPct: tot.difFactNetaPct, plUtilBruta: tot.plUtilBruta, erpContribucion: tot.erpContribucion, difContrib: tot.difContrib, difContribPct: tot.difContribPct,
  } : undefined;

  return (
    <Panel
      titulo="Ventas del ERP vs P&L"
      meta={`por mes · ${anio} · P&L hasta ${puente.filas[mesMax - 1]?.lbl || '—'} · umbral ${UMBRAL_PUENTE_PCT} % · ERP = medidas del director (Fact Neta · Venta Neta · Contribucion)`}
      plegable abiertoInicial
      acciones={alertaTxt
        ? <Pill tone="orange" dot title="Meses con diferencia mayor al umbral entre Venta neta del ERP y Venta neta del P&L">{alertaTxt}</Pill>
        : <Pill tone="green" dot>ERP y P&L cuadran dentro de {UMBRAL_PUENTE_PCT} %</Pill>}
    >
      <TablaCompacta dense columnas={columnas} filas={puente.filas} rowKey={(r) => r.mes} grupos={grupos} totales={totales}
        onRowClick={onMesClick ? (r) => { if (!r.soloErp && r.mes <= mesMax) onMesClick(r.mes); } : undefined} />
      <p style={{ margin: '10px 2px 0', fontSize: 11, lineHeight: 1.45, color: theme.textMuted, fontFamily: TYPO.fontText, maxWidth: 980 }}>
        <span style={{ fontWeight: 600, color: theme.text }}>Qué explica la diferencia.</span> {NOTA_PUENTE}
      </p>
    </Panel>
  );
}
