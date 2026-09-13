// Panel plegable "Apartado por SKU" · inventario comprometido (inventario − disponible)
// dentro del universo de [Inv Actual]. Top 50 por valor. Sale de las filas que la pantalla
// ya tiene en memoria: mismo criterio que v_inventario_apartado_sku.
import React, { useMemo } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Pill, TablaCompacta } from '../../../components/kit';
import { fmtCompact, fmtInt } from './constantes';
import { topApartado } from './apartado';

const TOP = 50;

export default function ApartadoPanel({ skuRows, sensible = false, onVerSku }) {
  const { theme } = useTheme();
  const filas = useMemo(() => topApartado(skuRows, TOP), [skuRows]);
  const totalSkus = useMemo(() => (skuRows || []).filter((r) => r.totalRes > 0).length, [skuRows]);

  const columnas = [
    {
      key: 'sku', label: 'SKU', align: 'left', mono: true, bold: true, width: 120,
      render: (r) => (onVerSku
        ? <span onClick={(e) => { e.stopPropagation(); onVerSku(r.sku); }} style={{ color: theme.accent, cursor: 'pointer' }}>{r.sku}</span>
        : r.sku),
    },
    {
      key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 380,
      render: (r) => (
        <span title={r.descripcion}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 500 }}>{r.descripcion || '—'}</span>
          {r.marca && <span style={{ display: 'block', fontSize: 9.5, color: theme.textMuted }}>{r.marca}</span>}
        </span>
      ),
    },
    { key: 'apartado', label: 'Apart.', width: 80, bold: true, render: (r) => <span style={{ color: theme.orange }}>{fmtInt(r.apartado)}</span>, renderTotal: (v) => fmtInt(v) },
    { key: 'disponible', label: 'Disp.', width: 80, render: (r) => (r.disponible > 0 ? <span style={{ color: theme.green }}>{fmtInt(r.disponible)}</span> : <Pill tone="red" size="xs">0</Pill>), renderTotal: (v) => fmtInt(v) },
    { key: 'pct', label: '% del SKU', width: 84, render: (r) => <Pill tone={r.pct >= 60 ? 'orange' : 'gray'} size="xs">{r.pct.toFixed(0)}%</Pill> },
    ...(sensible ? [{ key: 'valor', label: 'Valor', width: 90, bold: true, render: (r) => fmtCompact(r.valor), renderTotal: (v) => fmtCompact(v) }] : []),
  ];

  const totales = filas.length
    ? { apartado: filas.reduce((s, r) => s + r.apartado, 0), disponible: filas.reduce((s, r) => s + r.disponible, 0), valor: filas.reduce((s, r) => s + r.valor, 0) }
    : undefined;

  const meta = totalSkus === 0
    ? 'nada apartado con los filtros actuales'
    : `${fmtInt(totalSkus)} SKUs con apartado · top ${fmtInt(filas.length)} por ${sensible ? 'valor' : 'piezas'}`;

  return (
    <Panel titulo="Apartado por SKU" meta={meta} plegable abiertoInicial={false} padding={0}>
      <div style={{ padding: '8px 12px 0', fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textMuted }}>
        Apartado = inventario − disponible: producto que está en el almacén pero ya está comprometido a una orden en curso. Un SKU con casi todo apartado y poco disponible se ve con stock y no lo tiene.
      </div>
      <div style={{ padding: '8px 12px 12px' }}>
        <TablaCompacta columnas={columnas} filas={filas} rowKey={(r) => r.sku} dense maxHeight="46vh" totales={totales}
          vacio="Ningún SKU con inventario apartado." />
      </div>
    </Panel>
  );
}
