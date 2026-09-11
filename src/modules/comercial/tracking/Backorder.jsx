// Backorder por SKU (pedido − facturado en OCs abiertas) con stock hoy y arribo que lo cubre. Segmented Todos / Con arribo / Sin arribo.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { TablaCompacta, Segmented, Pill, Panel } from '../../../components/kit';
import { fmtInt, fmtFecha, nombreCliente } from './textos';

export default function Backorder({ filas, onSku }) {
  const { theme } = useTheme();
  const [modo, setModo] = useState('todos');
  const visibles = useMemo(() => filas.filter((r) => (modo === 'todos' ? true : modo === 'arribo' ? !!r.cubre : !r.cubre)), [filas, modo]);
  const columnas = [
    { key: 'sku', label: 'SKU', align: 'left', mono: true, bold: true, render: (r) => <span title={r.descripcion}>{r.sku}</span> },
    { key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 180, render: (r) => <span title={r.descripcion}>{r.descripcion || '—'}</span> },
    { key: 'backorder', label: 'Backorder', sum: true, render: (r) => <span style={{ fontWeight: 600, color: theme.orange }}>{fmtInt(r.backorder)}</span> },
    { key: 'clientes', label: 'Clientes', align: 'left', render: (r) => r.clientes.map(nombreCliente).join(', ') },
    { key: 'stock', label: 'Stock', render: (r) => <span style={{ color: r.stock >= r.backorder ? theme.green : theme.text }}>{fmtInt(r.stock)}</span> },
    { key: 'cubre', label: 'Arribo', align: 'left', render: (r) => r.stock >= r.backorder ? <Pill tone="green" size="xs">Stock hoy</Pill> : r.cubre ? <Pill tone="blue" size="xs">PO {r.cubre.po || '—'} · {fmtFecha(r.cubre.eta)}</Pill> : <Pill tone="red" size="xs">Sin PO</Pill> },
    { key: 'dias', label: 'Días', render: (r) => Math.round(r.dias) },
  ];
  return (
    <Panel titulo="Backorder por SKU" meta="pedido − facturado · OCs abiertas"
      acciones={<Segmented value={modo} onChange={setModo} options={[{ id: 'todos', label: 'Todos', badge: filas.length }, { id: 'arribo', label: 'Con arribo', badge: filas.filter((r) => r.cubre).length }, { id: 'sin', label: 'Sin arribo', badge: filas.filter((r) => !r.cubre).length }]} />}>
      <TablaCompacta columnas={columnas} filas={visibles} rowKey={(r) => r.sku} dense maxHeight={300} onRowClick={onSku ? (r) => onSku(r.sku) : undefined} vacio="Sin backorder: todo lo pedido está facturado." />
      <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 6, fontFamily: TYPO.fontText }}>Stock = disponible en almacenes comerciales (v_inventario_comercial) · Arribo = PO más próxima en tránsito (v_transito_sku). Clic en un SKU lo busca en la tabla.</div>
    </Panel>
  );
}
