// «Qué le falta» en el Resumen del cliente propio (web · 2026-10-06; Fernando lo aprobó del celular, punto 6).
// Mismo motor puro que el celular (movil/pestanas/cliente/calculo.js#queLeFalta): SKUs que el cliente SÍ vende en los 3
// meses cerrados y tiene agotados o con menos de una semana en su piso; piezas = 2 meses de su ritmo − lo que tiene,
// topadas a lo que tenemos en almacenes comerciales. Datos: los hooks del Sell Out consolidado + nuestro stock.
import React, { useMemo } from 'react';
import { ClipboardList } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { useRoadmap } from '../../../lib/queries';
import { Panel, TablaCompacta, Pill, Boton } from '../../../components/kit';
import { useDrillSkus, useDrillInventario } from '../sellout/datos';
import { useNuestroStock } from '../../../movil/pestanas/cliente/datos';
import { queLeFalta } from '../../../movil/pestanas/cliente/calculo';

const int = (n) => Math.round(Number(n) || 0).toLocaleString('es-MX');

export default function QueLeFalta({ clienteKey, nombre, anio, mes, onNavegar }) {
  const { theme } = useTheme();
  const { data: skus = [], isLoading: l1 } = useDrillSkus(clienteKey, anio);
  const { data: inv = [], isLoading: l2 } = useDrillInventario(clienteKey);
  const rd = useRoadmap();
  const roadmap = useMemo(() => new Map((rd.data || []).map((r) => [r.sku, r])), [rd.data]);
  const base = useMemo(() => queLeFalta({ skus, inv, anio, mes, roadmap, top: 12 }), [skus, inv, anio, mes, roadmap]);
  const { data: nuestro } = useNuestroStock(base.lista.map((x) => x.sku));
  const falta = useMemo(() => (nuestro ? queLeFalta({ skus, inv, nuestro, anio, mes, roadmap, top: 12 }) : base), [nuestro, base, skus, inv, anio, mes, roadmap]);
  const corto = (nombre || '').split(' ')[0];

  const cols = [
    { key: 'sku', label: 'SKU', align: 'left', mono: true, bold: true, width: 110 },
    { key: 'descripcion', label: 'Producto', align: 'left', maxWidth: 260, render: (r) => <span style={{ color: theme.textMuted }}>{r.descripcion || '—'}</span> },
    { key: 'ritmo', label: 'Vende/mes', render: (r) => `${int(r.ritmo)} pz` },
    { key: 'stock', label: `En ${corto}`, render: (r) => (r.agotado ? <Pill tone="red" size="xs">agotado</Pill> : <span>{int(r.stock)} pz <span style={{ color: theme.orange, fontSize: 10 }}>{r.semanas} sem</span></span>) },
    { key: 'tenemos', label: 'Tenemos', render: (r) => (r.tenemos == null ? '—' : r.tenemos > 0 ? int(r.tenemos) : <Pill tone="orange" size="xs">sin stock</Pill>) },
    { key: 'piezas', label: 'Proponer', bold: true, render: (r) => (r.piezas > 0 ? `${int(r.piezas)} pz` : '—') },
  ];
  const meta = l1 || l2 ? 'calculando…' : falta.total
    ? `${falta.total} SKU${falta.total === 1 ? '' : 's'} que vende y tiene agotados o con menos de una semana · ${falta.agotados} agotados · ${int(falta.riesgoMes)} pz/mes en riesgo`
    : 'vende de todo lo que le hemos surtido';
  return (
    <Panel titulo="Qué le falta" meta={meta} acciones={onNavegar && falta.total > 0 ? <Boton icon={ClipboardList} onClick={onNavegar}>Armar propuesta</Boton> : null}>
      <TablaCompacta dense columnas={cols} filas={falta.lista} rowKey={(r) => r.sku} vacio={l1 || l2 ? 'Calculando…' : `No hay SKUs que ${corto} venda y tenga agotados.`} />
      <div style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted, marginTop: 6 }}>Piezas = 2 meses de su ritmo de venta (3 meses cerrados) menos lo que tiene en piso, en múltiplos de 5 y topadas a nuestro disponible.</div>
    </Panel>
  );
}
