// Panel plegable "Fuera de venta" · inventario parado en almacenes exclusivos de
// "Inventario" (destrucción, paqueterías, reparaciones, producción…), es decir lo que la
// medida [Inv Actual] deja fuera a propósito. Resumen por almacén desde
// v_inventario_fuera_venta; el drill de cada fila arma sus top SKUs con las filas que la
// pantalla ya tiene en memoria. Sin permiso sensible: sólo piezas y SKUs, nada de $.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Pill, TablaCompacta } from '../../../components/kit';
import { fmtCompact, fmtInt } from './constantes';
import { useFueraDeVenta, totalFuera, topSkusDeAlmacen } from './apartado';

const TONO_MOTIVO = {
  'Destrucción': 'red', 'Robo': 'red',
  'Reparaciones': 'orange', 'Centro de servicio': 'orange', 'Devoluciones': 'orange',
  'Paqueterías': 'blue', 'Remisiones': 'blue', 'Refacturación': 'blue',
  'Producción': 'purple',
};

export default function FueraDeVenta({ filas, descripciones, sensible = false }) {
  const { theme } = useTheme();
  const { filas: almacenes, cargando } = useFueraDeVenta();
  const [abierta, setAbierta] = useState(null);
  const tot = useMemo(() => totalFuera(almacenes), [almacenes]);

  const columnas = [
    {
      key: 'nombre', label: 'Almacén', align: 'left', maxWidth: 260,
      render: (r) => (
        <span title={r.nombre}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 500, color: theme.text }}>{r.nombre}</span>
          <span style={{ display: 'block', fontSize: 9.5, color: theme.textMuted }}>almacén {r.almacen}</span>
        </span>
      ),
    },
    { key: 'motivo', label: 'Motivo', align: 'left', width: 150, render: (r) => <Pill tone={TONO_MOTIVO[r.motivo] || 'gray'} size="xs">{r.motivo}</Pill> },
    { key: 'skus', label: 'SKUs', width: 70, render: (r) => fmtInt(r.skus), renderTotal: (v) => fmtInt(v) },
    { key: 'piezas', label: 'Piezas', width: 90, render: (r) => fmtInt(r.piezas), renderTotal: (v) => fmtInt(v) },
    ...(sensible ? [{ key: 'valor', label: 'Valor', width: 90, bold: true, render: (r) => fmtCompact(r.valor), renderTotal: (v) => fmtCompact(v) }] : []),
    {
      key: 'share', label: sensible ? '% valor' : '% piezas', width: 70,
      render: (r) => {
        const base = sensible ? tot.valor : tot.piezas;
        return <span style={{ color: theme.textMuted }}>{base > 0 ? (((sensible ? r.valor : r.piezas) / base) * 100).toFixed(1) : '0.0'}%</span>;
      },
    },
  ];

  const colsSku = [
    { key: 'sku', label: 'SKU', align: 'left', mono: true, bold: true, width: 120 },
    {
      key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 360,
      render: (s) => (
        <span title={s.descripcion}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 500 }}>{s.descripcion || '—'}</span>
          {s.marca && <span style={{ display: 'block', fontSize: 9.5, color: theme.textMuted }}>{s.marca}</span>}
        </span>
      ),
    },
    { key: 'piezas', label: 'Piezas', width: 80, render: (s) => fmtInt(s.piezas), renderTotal: (v) => fmtInt(v) },
    ...(sensible ? [{ key: 'valor', label: 'Valor', width: 90, bold: true, render: (s) => fmtCompact(s.valor), renderTotal: (v) => fmtCompact(v) }] : []),
  ];

  const meta = cargando
    ? 'cargando…'
    : almacenes.length === 0
      ? 'sin inventario fuera de los almacenes de venta'
      : `${fmtInt(tot.almacenes)} almacenes · ${fmtInt(tot.piezas)} pz${sensible ? ` · ${fmtCompact(tot.valor)} a costo` : ''} · click en una fila abre sus SKUs`;

  return (
    <Panel titulo="Fuera de venta" meta={meta} plegable abiertoInicial={false} padding={0}>
      <div style={{ padding: '8px 12px 0', fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textMuted }}>
        Almacenes que la medida [Inv Actual] deja fuera por ser exclusivos de inventario: destrucción, paqueterías, reparaciones, centro de servicio, producción, refacturación… No es stock vendible, pero es dinero parado.
      </div>
      <div style={{ padding: '8px 12px 12px' }}>
        <TablaCompacta columnas={columnas} filas={almacenes} rowKey={(r) => r.almacen} dense maxHeight="40vh"
          totales={almacenes.length ? { skus: almacenes.reduce((s, r) => s + r.skus, 0), piezas: tot.piezas, valor: tot.valor } : undefined}
          vacio={cargando ? 'Cargando…' : 'Sin inventario fuera de venta.'}
          onRowClick={(r) => setAbierta((a) => (a === r.almacen ? null : r.almacen))}
          expandidoKey={abierta}
          renderExpandido={(r) => {
            const top = topSkusDeAlmacen(filas, r.almacen, descripciones);
            return (
              <div style={{ padding: '10px 14px', background: theme.bg, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, color: theme.text }}>Lo más caro en {r.nombre}</span>
                  <span style={{ fontSize: 10, color: theme.textMuted }}>top {top.length} de {fmtInt(r.skus)} SKUs</span>
                </div>
                <TablaCompacta columnas={colsSku} filas={top} rowKey={(s) => s.sku} dense maxHeight={280}
                  vacio="Sin detalle por SKU para este almacén." />
              </div>
            );
          }} />
      </div>
    </Panel>
  );
}
