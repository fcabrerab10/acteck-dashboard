// Drill del SKU · "Precio bajo por cliente": clientes que facturaron este SKU debajo de la lista que les corresponde
// (misma regla que PanelPrecioBajo / calculo.js: monto/piezas < lista − 0.5 %, por cliente/mes en facturacion_clientes,
// año en curso) con precio facturado, lista, diferencia %, piezas y "desde" (primer mes en que ocurrió).
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { Panel, Pill, DeltaPill, TablaCompacta } from '../../../components/kit';
import { listaLbl, fmtMoney, fmtInt, fmtMoneyShort, periodoLbl } from './textos';

export default function PrecioBajoSku({ filas, anio }) {
  const { theme } = useTheme();
  const dejado = filas.reduce((s, r) => s + r.dejado, 0);
  const cols = [
    { key: 'cliente', label: 'Cliente', align: 'left', maxWidth: 170, render: (r) => <span title={r.cliente} style={{ fontWeight: 500 }}>{r.cliente}</span> },
    { key: 'lista', label: 'Su lista', align: 'left', render: (r) => <Pill tone="gray" size="xs">{listaLbl(r.lista)}</Pill> },
    { key: 'real', label: 'Facturado', render: (r) => <span style={{ color: theme.orange || '#FF9500', fontWeight: 600 }}>{fmtMoney(r.real)}</span> },
    { key: 'precioLista', label: 'Lista', render: (r) => fmtMoney(r.precioLista) },
    { key: 'difPct', label: 'Dif.', render: (r) => <DeltaPill value={r.difPct} digits={1} /> },
    { key: 'piezas', label: 'Pz', render: (r) => fmtInt(r.piezas) },
    { key: 'desde', label: 'Desde', render: (r) => <span title={`${r.meses} mes${r.meses === 1 ? '' : 'es'} debajo de lista`}>{r.desde ? periodoLbl(r.desde.anio, r.desde.mes) : '—'}</span> },
  ];
  return (
    <Panel titulo="Precio bajo por cliente" meta={filas.length ? `${filas.length} cliente${filas.length === 1 ? '' : 's'} · ${fmtMoneyShort(dejado)} dejados en la mesa · ${anio}` : `${anio} · debajo de la lista que le corresponde (−0.5 %)`}>
      <TablaCompacta columnas={cols} filas={filas} rowKey={(r) => r.cliente} dense maxHeight={200} vacio={`Ningún cliente facturó este SKU debajo de su lista en ${anio}.`} />
    </Panel>
  );
}
