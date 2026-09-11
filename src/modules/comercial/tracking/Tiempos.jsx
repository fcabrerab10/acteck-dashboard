// Tiempos por etapa por cliente (promedio de OCs recibidas en los últimos 90 días) vs meta (METAS_DIAS).
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { TablaCompacta, Panel, Pill } from '../../../components/kit';
import { METAS_DIAS, VENTANA_TIEMPOS_DIAS, fmtDias } from './textos';
import { ClientePill } from './ui';

export default function Tiempos({ filas }) {
  const { theme } = useTheme();
  const celda = (v, meta) => (v == null ? <span style={{ color: theme.textMuted }}>—</span> : <span style={{ color: v <= meta ? theme.text : v <= meta + 1 ? theme.orange : theme.red }}>{v.toFixed(1)}</span>);
  const columnas = [
    { key: 'cliente', label: 'Cliente', align: 'left', render: (r) => <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><ClientePill k={r.cliente_key} /><span style={{ fontSize: 10, color: theme.textMuted }}>{r.n} OC · {r.entregadas} entregadas</span></span> },
    { key: 'factura', label: 'OC→factura', render: (r) => celda(r.factura, METAS_DIAS.factura) },
    { key: 'envio', label: 'Factura→envío', render: (r) => celda(r.envio, METAS_DIAS.envio) },
    { key: 'entrega', label: 'Envío→entrega', render: (r) => celda(r.entrega, METAS_DIAS.entrega) },
    { key: 'total', label: 'Total', bold: true, render: (r) => celda(r.total, METAS_DIAS.total) },
    { key: 'estado', label: `Meta ${METAS_DIAS.total} d`, align: 'left', render: (r) => <Pill tone={r.estado === 'En meta' ? 'green' : r.estado === 'Justo' ? 'orange' : r.estado === 'Fuera' ? 'red' : 'gray'} size="xs">{r.estado}</Pill> },
  ];
  return (
    <Panel titulo="Tiempos por etapa" meta={`promedio ${VENTANA_TIEMPOS_DIAS} días · vs meta`}>
      <TablaCompacta columnas={columnas} filas={filas} dense vacio="Sin OCs en la ventana." />
      <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 6, fontFamily: TYPO.fontText }}>Metas por tramo: {fmtDias(METAS_DIAS.factura, 0)} · {fmtDias(METAS_DIAS.envio, 0)} · {fmtDias(METAS_DIAS.entrega, 0)} · total {fmtDias(METAS_DIAS.total, 0)}. Sólo cuentan los tramos que ya ocurrieron.</div>
    </Panel>
  );
}
