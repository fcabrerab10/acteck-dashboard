// Stock al cierre por SKU × 12 meses (web · 2026-10-06; del celular, punto 8). Lee v_inventario_sku_anio (pivote sku × año
// del stock del ÚLTIMO día con foto de cada mes en almacenes comerciales, migración 20261005_inventario_sku_mes.sql) y arma
// las filas con el mismo motor que el celular (movil/pestanas/inventario/calculo.js#filasStockAnual). HeatCell por mes,
// piezas o valor a costo (sólo con permiso sensible), buscador que entiende y top 100 + «Mostrar más».
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../../lib/themeContext';
import { supabase } from '../../../lib/supabase';
import { fetchAllQ, useRoadmap } from '../../../lib/queries';
import { interpretarBusqueda, coincideSku, indiceSku } from '../../../lib/buscarSku';
import { Panel, TablaCompacta, HeatCell, Segmented, Boton, Pill } from '../../../components/kit';
import BuscadorEntiende from '../sellin/BuscadorEntiende';
import { filasStockAnual } from '../../../movil/pestanas/inventario/calculo';
import { columnasVentana } from '../../../movil/pestanas/sellout/skuAnual';
import { fmtCompact, fmtInt } from './constantes';

export default function StockCierrePanel({ sensible = false }) {
  const { theme } = useTheme();
  const hoy = useMemo(() => new Date(), []);
  const anio = hoy.getFullYear(), mes = hoy.getMonth() + 1;
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState(sensible ? 'valor' : 'piezas');
  const [q, setQ] = useState('');
  const [limite, setLimite] = useState(100);
  const rd = useRoadmap();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['inventario', 'sku_anio', anio], enabled: abierto, staleTime: 5 * 60 * 1000,
    queryFn: () => fetchAllQ(() => supabase.from('v_inventario_sku_anio').select('sku,anio,piezas,valor').in('anio', [anio - 1, anio]), { pageSize: 5000, orderCol: 'sku', label: 'inv_sku_anio' }),
  });
  const filas = useMemo(() => filasStockAnual({ rows, hoy, roadmap: rd.data || [] }), [rows, hoy, rd.data]);
  const columnas = useMemo(() => columnasVentana(anio, mes), [anio, mes]);
  const categorias = useMemo(() => [...new Set((rd.data || []).map((r) => r.categoria).filter(Boolean))], [rd.data]);
  const interp = useMemo(() => interpretarBusqueda(q, { categorias }), [q, categorias]);
  const visibles = useMemo(() => (interp.vacio ? filas : filas.filter((r) => coincideSku(r, interp, indiceSku(r)))), [filas, interp]);
  const campo = modo === 'valor' && sensible ? 'monto' : 'piezas';
  const max = useMemo(() => Math.max(1, ...visibles.slice(0, limite).flatMap((r) => r[campo] || [])), [visibles, limite, campo]);
  const fmt = campo === 'monto' ? fmtCompact : fmtInt;
  const cols = [
    { key: 'sku', label: 'SKU', align: 'left', mono: true, bold: true, width: 110 },
    { key: 'descripcion', label: 'Producto', align: 'left', maxWidth: 220, render: (r) => <span style={{ color: theme.textMuted }}>{r.descripcion || '—'}</span> },
    ...columnas.map((c, i) => ({ key: `m${i}`, label: c, render: (r) => <HeatCell v={r[campo]?.[i] || 0} max={max} fmt={fmt} /> })),
  ];
  return (
    <Panel titulo="Stock al cierre por SKU · 12 meses" meta={abierto ? `${fmtInt(visibles.length)} SKUs · foto del último día con registro de cada mes · almacenes comerciales` : 'cómo cerró cada SKU mes a mes (desde sep 2026, se llena con la foto diaria)'}
      plegable abiertoInicial={false} onToggle={(o) => { if (o) setAbierto(true); }} padding="6px 12px 10px"
      acciones={abierto ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <BuscadorEntiende value={q} onChange={setQ} categorias={categorias} resultados={q ? `${fmtInt(visibles.length)} SKUs` : null} width={360} />
          {sensible && <Segmented size="sm" value={modo} onChange={setModo} options={[{ id: 'valor', label: '$ a costo' }, { id: 'piezas', label: 'Piezas' }]} />}
        </div>
      ) : null}>
      {abierto && (isLoading ? <div style={{ fontSize: 12, color: theme.textMuted, padding: 8 }}>Cargando…</div> : (
        <>
          <TablaCompacta dense maxHeight={520} columnas={cols} filas={visibles.slice(0, limite)} rowKey={(r) => r.sku} vacio="Sin fotos de inventario todavía." />
          {visibles.length > limite && <div style={{ marginTop: 8 }}><Boton onClick={() => setLimite((n) => n + 100)}>Mostrar más ({fmtInt(visibles.length - limite)} restantes)</Boton></div>}
          <div style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted, marginTop: 6 }}><Pill tone="gray" size="xs">mv_inventario_sku_mes</Pill> último día con foto de cada mes · el mes en curso es la foto más reciente.</div>
        </>
      ))}
    </Panel>
  );
}
