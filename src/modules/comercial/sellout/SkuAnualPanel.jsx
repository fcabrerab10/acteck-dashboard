// Detalle por SKU × 12 meses de TODA la empresa (web · 2026-11-11; venía sólo en el celular). Mismo motor que el celular
// (movil/pestanas/sellout/skuAnual.js#filasSkuAnual sobre el pivote sku × año) → congruencia: $ o piezas, buscador que
// entiende, total de los 12 meses y Δ contra los mismos 12 meses del año anterior. Plegado: baja los datos al abrirse.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { useRoadmap } from '../../../lib/queries';
import { interpretarBusqueda, coincideSku, indiceSku } from '../../../lib/buscarSku';
import { moneyCompact, int } from '../../../lib/format';
import { Panel, TablaCompacta, HeatCell, Segmented, Boton, DeltaPill } from '../../../components/kit';
import BuscadorEntiende from '../sellin/BuscadorEntiende';
import { filasSkuAnual, columnasVentana, categoriasDe } from './skuAnual';

/** Resumen de actividad: SKUs con venta en el último mes de la ventana y SKUs del roadmap sin venta en los últimos 3. */
export function actividadSkus(filas = [], roadmap = []) {
  const activos = filas.filter((f) => (f.piezas?.[11] || 0) > 0 || (f.monto?.[11] || 0) > 0).length;
  const con3 = new Set(filas.filter((f) => [9, 10, 11].some((i) => (f.piezas?.[i] || 0) > 0 || (f.monto?.[i] || 0) > 0)).map((f) => f.sku));
  const sinMovimiento = roadmap.filter((r) => !con3.has(String(r.sku || '').toUpperCase())).length;
  return { activos, sinMovimiento, roadmap: roadmap.length };
}

export default function SkuAnualPanel({ titulo = 'Detalle por SKU · 12 meses', usar, anio, mes, nota }) {
  const { theme } = useTheme();
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState('monto');
  const [q, setQ] = useState('');
  const [limite, setLimite] = useState(100);
  const [orden, setOrden] = useState(null);
  const rd = useRoadmap();
  const { data: rows = [], isLoading } = usar(anio, abierto);
  const filas = useMemo(() => filasSkuAnual({ rows, anio, mes, roadmap: rd.data || [] }), [rows, anio, mes, rd.data]);
  const columnas = useMemo(() => columnasVentana(anio, mes), [anio, mes]);
  const categorias = useMemo(() => categoriasDe(rd.data || []), [rd.data]);
  const interp = useMemo(() => interpretarBusqueda(q, { categorias }), [q, categorias]);
  const act = useMemo(() => actividadSkus(filas, rd.data || []), [filas, rd.data]);
  const fmt = modo === 'monto' ? moneyCompact : int;
  const visibles = useMemo(() => {
    const total = (r) => (modo === 'monto' ? r.total : r.totalPz);
    const prev = (r) => { const p = modo === 'monto' ? r.montoPrev : r.piezasPrev; return p ? p.reduce((s, v) => s + v, 0) : null; };
    let l = (interp.vacio ? filas : filas.filter((r) => coincideSku(r, interp, indiceSku(r)))).map((r) => { const t = total(r), p = prev(r); return { ...r, _total: t, _delta: p ? ((t - p) / p) * 100 : null }; });
    const val = (r) => (orden?.col === '_delta' ? (r._delta ?? -Infinity) : orden?.col?.startsWith('m') ? (r[modo]?.[Number(orden.col.slice(1))] || 0) : r._total);
    l = l.sort((a, b) => (orden?.dir === 'asc' ? val(a) - val(b) : val(b) - val(a)));
    return l;
  }, [filas, interp, modo, orden]);
  const max = useMemo(() => Math.max(1, ...visibles.slice(0, limite).flatMap((r) => r[modo] || [])), [visibles, limite, modo]);
  const alOrdenar = (col) => setOrden((o) => (o?.col === col ? (o.dir === 'desc' ? { col, dir: 'asc' } : null) : { col, dir: 'desc' }));
  const cols = [
    { key: 'sku', label: 'SKU', align: 'left', mono: true, bold: true, width: 104 },
    { key: 'descripcion', label: 'Producto', align: 'left', maxWidth: 200, render: (r) => <span style={{ color: theme.textMuted }} title={`${r.marca} · ${r.categoria}`}>{r.descripcion || r.categoria || '—'}</span> },
    ...columnas.map((c, i) => ({ key: `m${i}`, label: c, sort: true, render: (r) => <HeatCell v={r[modo]?.[i] || 0} max={max} fmt={fmt} /> })),
    { key: '_total', label: '12 m', sort: true, bold: true, render: (r) => fmt(r._total) },
    { key: '_delta', label: 'Δ', sort: true, render: (r) => (r._delta == null ? '—' : <DeltaPill value={r._delta} />) },
  ];
  return (
    <Panel titulo={titulo} plegable abiertoInicial={false} onToggle={(o) => { if (o) setAbierto(true); }} padding="6px 12px 10px"
      meta={abierto && !isLoading ? `${int(act.activos)} SKUs activos en ${columnas[11]} de ${int(act.roadmap)} del roadmap · ${int(act.sinMovimiento)} sin movimiento en 3 meses` : 'toda la empresa, mes a mes, con el cambio contra el año anterior'}
      acciones={abierto ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <BuscadorEntiende value={q} onChange={setQ} categorias={categorias} resultados={q ? `${int(visibles.length)} SKUs` : null} width={320} />
          <Segmented size="sm" value={modo} onChange={setModo} options={[{ id: 'monto', label: '$' }, { id: 'piezas', label: 'Piezas' }]} />
        </div>
      ) : null}>
      {abierto && (isLoading ? <div style={{ fontSize: 12, color: theme.textMuted, padding: 8 }}>Cargando…</div> : (
        <>
          <TablaCompacta dense maxHeight={520} columnas={cols} filas={visibles.slice(0, limite)} rowKey={(r) => r.sku} orden={orden} onSort={alOrdenar} vacio="Sin ventas en la ventana. Revisa el período o la búsqueda." />
          {visibles.length > limite && <div style={{ marginTop: 8 }}><Boton onClick={() => setLimite((n) => n + 100)}>Mostrar más ({int(visibles.length - limite)} restantes)</Boton></div>}
          {nota && <div style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted, marginTop: 6 }}>{nota}</div>}
        </>
      ))}
    </Panel>
  );
}
