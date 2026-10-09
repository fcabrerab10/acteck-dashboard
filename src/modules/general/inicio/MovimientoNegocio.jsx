// «Dónde está el movimiento» del negocio (3.93.0 · 2026-10-08): clientes y categorías que más suben y bajan en pesos contra
// el mes anterior, con frase corta (analisis/movimiento.js, el mismo motor de la página del cliente). Datos chicos:
// v_analisis_cliente_mes del año (cliente × mes) y v_vision_factura_dimension_mes (categoría × mes), ambas cacheadas.
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../../lib/themeContext';
import { supabase } from '../../../lib/supabase';
import { cachedQuery } from '../../../lib/queries';
import { Panel, TablaCompacta, Pill } from '../../../components/kit';
import { moneyCompact as $c } from '../../../lib/format';
import { movimientos } from '../../comercial/analisis/movimiento';

const N = (v) => Number(v) || 0;
const cap = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase());

export default function MovimientoNegocio({ anio, mes, hoy = new Date(), onNavegar }) {
  const { theme } = useTheme();
  const { data, isLoading } = useQuery({
    queryKey: ['inicio', 'movimiento', anio], staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [cli, dim] = await Promise.all([
        cachedQuery(supabase.from('v_analisis_cliente_mes').select('anio,mes,cliente,cliente_nombre,fact_neta,piezas_venta_neta').in('anio', [anio - 1, anio])),
        cachedQuery(supabase.from('v_vision_factura_dimension_mes').select('anio,mes,dimension,valor,venta,piezas').eq('dimension', 'categoria').in('anio', [anio - 1, anio])),
      ]);
      return { clientes: cli.data || [], categorias: dim.data || [] };
    },
  });
  const movs = useMemo(() => {
    if (!data) return null;
    const pocoMes = anio === hoy.getFullYear() && mes === hoy.getMonth() + 1 && hoy.getDate() < 10;
    const [mAnio, mMes] = pocoMes ? (mes === 1 ? [anio - 1, 12] : [anio, mes - 1]) : [anio, mes];
    const nombre = new Map(data.clientes.map((r) => [r.cliente, cap(r.cliente_nombre || r.cliente)]));
    return { ...movimientos({ grupos: [
      { tipo: 'Cliente', filas: data.clientes, clave: 'cliente', valor: 'fact_neta', piezas: 'piezas_venta_neta', etiqueta: (k) => nombre.get(k) || k },
      { tipo: 'Categoría', filas: data.categorias.map((r) => ({ ...r, valor: cap(r.valor) })), clave: 'valor', valor: 'venta', piezas: 'piezas' },
    ], anio: mAnio, mes: mMes, top: 8, umbral: 50000 }), pocoMes };
  }, [data, anio, mes, hoy]);
  const cols = [
    { key: 'tipo', label: '', width: 78, align: 'left', render: (f) => <Pill tone={f.tipo === 'Cliente' ? 'blue' : 'orange'} size="xs">{f.tipo}</Pill> },
    { key: 'nombre', label: 'Qué', align: 'left', maxWidth: 240, render: (f) => <span style={{ fontWeight: 500 }}>{f.tipo === 'Cliente' ? (f.etiqueta || f.clave) : f.clave}</span> },
    { key: 'explicacion', label: 'Qué pasó', align: 'left', maxWidth: 220, render: (f) => <span style={{ color: theme.textMuted }}>{f.explicacion || `${$c(f.prev)} → ${$c(f.act)}`}</span> },
    { key: 'delta', label: 'Δ', bold: true, render: (f) => <span style={{ color: f.delta >= 0 ? theme.green : theme.red }}>{f.delta >= 0 ? '+' : '−'}{$c(Math.abs(f.delta))}</span> },
  ];
  return (
    <Panel titulo="Dónde está el movimiento" meta={movs ? `${movs.mesLbl} vs ${movs.mesPrevLbl} · clientes y categorías · en pesos${movs.pocoMes ? ' · el mes apenas empieza: se compara el último cerrado' : ''}` : 'cargando…'}>
      <TablaCompacta dense columnas={cols} filas={movs?.filas || []} rowKey={(f) => `${f.tipo}-${f.clave}`} vacio={isLoading ? 'Calculando…' : 'Nada cambió más de $50,000 contra el mes anterior.'}
        onRowClick={onNavegar ? (f) => (f.tipo === 'Cliente' ? onNavegar(null, 'analisisClientes') : onNavegar(null, 'sellIn')) : undefined} />
      <div style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted, marginTop: 6 }}>Lo que más subió y lo que más bajó contra el mes anterior. Toca una fila para abrir Análisis por cliente o Sell In.</div>
    </Panel>
  );
}
