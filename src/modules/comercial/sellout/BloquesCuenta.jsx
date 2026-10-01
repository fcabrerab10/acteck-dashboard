// Bloques del Sell Out de UNA cuenta, apilados (no en pestañas) y elegidos por RECETA según lo que trae su fuente
// (2026-10-01, Fernando: «revisa cliente por cliente y hagámosle la pestaña de sell out personalizada a cada uno»).
// Auditoría de sellout_general 2026 (qué manda cada mayorista): CT e Ingram traen sucursal y vendedor pero no cliente
// final ni estado; CVA, GUC, DC Mayorista, Loma y Kabik traen todo (DC y Kabik sin estado); TechSmart y Exel traen
// vendedor y cliente final sin sucursal (TechSmart con estado); Arroba sólo sucursal; PCH sucursal, cliente final y
// estado sin vendedor ni factura; NS Store no tiene 2026. Ninguno de los 12 reporta inventario (sólo los propios).
// Los propios (Digitalife, PCEL, Dicotech) siguen con DrillCuenta y sus pestañas.
import React, { lazy, Suspense, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { useRoadmap } from '../../../lib/queries';
import { Segmented, TablaCompacta, Pill, DeltaPill, HeatCell, Panel, Cargando } from '../../../components/kit';
import ResumenSellOut from './ResumenSellOut';
import { useDrillSkus, useDrillInventario, useDrillSucursales, useDrillVendedores, useDrillClientesFinales, useDrillEstados } from './datos';
import { skusDeCuenta, agregarDimension as agregarDim, clientesFinalesDelMes as clientesFinales, porEstado, MESES, ultimosMeses, idxMes, yoy, N } from './calculo';
import { fmtMoney, fmtInt, fmtPct, capitalizarEstado } from './textos';

const MapaMexico = lazy(() => import('./MapaMexico'));

/** Receta por cuenta: bloques en orden + nota de cobertura. Los bloques se vuelven a filtrar con lo que la fila trae. */
export const RECETAS = {
  cva:         { bloques: ['resumen', 'cambios', 'mapa', 'sucursales', 'clientes', 'skus'] },
  guc:         { bloques: ['resumen', 'cambios', 'mapa', 'sucursales', 'clientes', 'skus'] },
  dcmayorista: { bloques: ['resumen', 'cambios', 'sucursales', 'clientes', 'skus'] },
  loma:        { bloques: ['resumen', 'cambios', 'mapa', 'sucursales', 'clientes', 'skus'], nota: 'Loma reporta desde marzo 2026; la mitad de sus líneas llega sin estado ni factura.' },
  kabik:       { bloques: ['resumen', 'cambios', 'sucursales', 'clientes', 'skus'], nota: 'Kabik reporta desde mayo 2026.' },
  ct:          { bloques: ['resumen', 'cambios', 'sucursales', 'vendedores', 'skus'], nota: 'CT no manda cliente final ni estado: el foco es su red de 56 sucursales y sus vendedores.' },
  ingram:      { bloques: ['resumen', 'cambios', 'sucursales', 'vendedores', 'skus'], nota: 'Ingram no manda cliente final ni estado.' },
  techsmart:   { bloques: ['resumen', 'cambios', 'vendedores', 'clientes', 'mapa', 'skus'], nota: 'TechSmart no reporta sucursal.' },
  exel:        { bloques: ['resumen', 'cambios', 'vendedores', 'clientes', 'skus'], nota: 'Exel no reporta sucursal ni estado.' },
  arroba:      { bloques: ['resumen', 'cambios', 'sucursales', 'skus'], nota: 'Arroba sólo reporta sucursal (6): sin vendedor, cliente final ni estado.' },
  pch:         { bloques: ['resumen', 'cambios', 'clientes', 'mapa', 'skus'], nota: 'PCH reporta desde junio 2026, sin vendedor ni folio de factura.' },
  nsstore:     { bloques: ['resumen', 'skus'], nota: 'NS Store no ha reportado en 2026: lo que se ve es histórico.' },
};
export const RECETA_DEFAULT = { bloques: ['resumen', 'cambios', 'sucursales', 'vendedores', 'clientes', 'mapa', 'skus'] };

/** Qué bloques aplican a esta cuenta: receta ∩ lo que la fila (v_sellout_cuenta_mes) dice que la fuente trae. */
export function bloquesDe(cuenta, fila) {
  const r = RECETAS[cuenta] || RECETA_DEFAULT;
  const ok = (b) => {
    if (b === 'sucursales') return fila?.sucursales != null;
    if (b === 'vendedores') return fila?.vendedores != null;
    if (b === 'clientes') return fila?.clientesFinales != null;
    if (b === 'mapa') return (fila?.estados || 0) > 0;
    return true;
  };
  return { bloques: r.bloques.filter(ok), nota: r.nota || null };
}

// ───────────────────────────── Qué cambió este mes ─────────────────────────────
// Los movimientos más grandes del mes contra el mes anterior, en pesos, mezclando SKU, sucursal y cliente final
// (sólo las dimensiones que la fuente trae). Es lo que uno preguntaría en la visita.
export function BloqueCambios({ cuenta, anio, mes, bloques }) {
  const { theme } = useTheme();
  const skuQ = useDrillSkus(cuenta, anio);
  const sucQ = useDrillSucursales(cuenta, anio, bloques.includes('sucursales'));
  const cfQ = useDrillClientesFinales(cuenta, anio, mes, bloques.includes('clientes'));
  const { data: roadmap } = useRoadmap();
  const rd = useMemo(() => { const m = new Map(); (roadmap || []).forEach((r) => m.set(r.sku, r)); return m; }, [roadmap]);

  const movs = useMemo(() => {
    const act = idxMes(anio, mes), prev = act - 1;
    const out = [];
    const acum = (rows, clave, tipo, etiqueta) => {
      const m = new Map();
      for (const r of rows) {
        const i = idxMes(N(r.anio), N(r.mes));
        if (i !== act && i !== prev) continue;
        const k = r[clave]; if (!k) continue;
        const f = m.get(k) || { k, tipo, act: 0, prev: 0 };
        if (i === act) f.act += N(r.importe); else f.prev += N(r.importe);
        m.set(k, f);
      }
      for (const f of m.values()) out.push({ ...f, delta: f.act - f.prev, etiqueta: etiqueta(f.k) });
    };
    acum(skuQ.data || [], 'sku', 'SKU', (k) => rd.get(k)?.descripcion || '');
    if (bloques.includes('sucursales')) acum(sucQ.data || [], 'sucursal', 'Sucursal', () => '');
    if (bloques.includes('clientes')) acum(cfQ.data || [], 'cliente_final', 'Cliente final', () => '');
    const conMov = out.filter((f) => Math.abs(f.delta) >= 1000);
    const suben = [...conMov].sort((a, b) => b.delta - a.delta).slice(0, 4);
    const bajan = [...conMov].sort((a, b) => a.delta - b.delta).slice(0, 4).filter((f) => f.delta < 0);
    return { suben, bajan };
  }, [skuQ.data, sucQ.data, cfQ.data, anio, mes, bloques, rd]);

  const mesPrevLbl = MESES[(mes + 10) % 12];
  const Fila = ({ f }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '80px minmax(0,1fr) 90px 80px', gap: 8, alignItems: 'center', fontSize: 11.5, padding: '3px 0', borderBottom: `1px solid ${theme.divider || theme.border}` }}>
      <Pill tone={f.tipo === 'SKU' ? 'blue' : f.tipo === 'Sucursal' ? 'purple' : 'gray'} size="xs">{f.tipo}</Pill>
      <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={`${f.k} ${f.etiqueta}`}><strong style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{f.k}</strong>{f.etiqueta ? <span style={{ color: theme.textMuted }}> · {f.etiqueta}</span> : null}</span>
      <span style={{ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: theme.textMuted }}>{fmtMoney(f.prev)} → {fmtMoney(f.act)}</span>
      <span style={{ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontWeight: 600, color: f.delta >= 0 ? theme.green : theme.red }}>{f.delta >= 0 ? '+' : '−'}{fmtMoney(Math.abs(f.delta))}</span>
    </div>
  );
  const cargando = skuQ.isLoading || sucQ.isLoading || cfQ.isLoading;
  return (
    <Panel titulo="Qué cambió este mes" meta={`${MESES[mes - 1]} vs ${mesPrevLbl} · movimientos más grandes en pesos · SKU${bloques.includes('sucursales') ? ', sucursal' : ''}${bloques.includes('clientes') ? ' y cliente final' : ''}`}>
      {cargando ? <Cargando pantalla="selloutDrill" minHeight={120} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14 }}>
          <div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.green, marginBottom: 4 }}>Suben</div>
            {!movs.suben.length && <div style={{ fontSize: 11, color: theme.textMuted }}>Sin subidas relevantes.</div>}
            {movs.suben.map((f) => <Fila key={`${f.tipo}-${f.k}`} f={f} />)}
          </div>
          <div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.red, marginBottom: 4 }}>Bajan</div>
            {!movs.bajan.length && <div style={{ fontSize: 11, color: theme.textMuted }}>Sin caídas relevantes.</div>}
            {movs.bajan.map((f) => <Fila key={`${f.tipo}-${f.k}`} f={f} />)}
          </div>
        </div>
      )}
    </Panel>
  );
}

// ───────────────────────────── Sucursales y vendedores ─────────────────────────────
export function BloqueSucursales({ cuenta, anio, mes }) {
  const sucQ = useDrillSucursales(cuenta, anio);
  const filas = useMemo(() => agregarDim(sucQ.data || [], 'sucursal', anio, mes), [sucQ.data, anio, mes]);
  return (
    <Panel titulo="Sucursales" meta={`${filas.length} con venta · ${MESES[mes - 1]} ${anio} · Δ contra el mismo mes de ${anio - 1}`} padding="0 0 2px">
      {sucQ.isLoading ? <Cargando pantalla="selloutDrill" minHeight={200} /> : (
        <TablaCompacta dense maxHeight={400} rowKey={(r) => r.sucursal} filas={filas} vacio="Esta cuenta no reporta sucursales."
          columnas={[
            { key: 'clave', label: 'Sucursal', align: 'left', maxWidth: 200 },
            { key: 'importe', label: MESES[mes - 1], render: (r) => fmtMoney(r.importe) },
            { key: 'yoy', label: 'Δ YoY', width: 74, render: (r) => <DeltaPill value={r.yoy} /> },
            { key: 'vendedores', label: 'Vend.', width: 52, render: (r) => (r.vendedores ? fmtInt(r.vendedores) : '—') },
            { key: 'top', label: 'Top vendedor', align: 'left', maxWidth: 160, render: (r) => r.top_vendedor || '—' },
            { key: 'tend', label: '6 m', align: 'left', width: 150, render: (r) => <span style={{ display: 'inline-flex', gap: 2 }}>{r.tendencia.map((v, i) => <HeatCell key={i} v={v} max={Math.max(...r.tendencia)} fmt={fmtMoney} />)}</span> },
          ]} />
      )}
    </Panel>
  );
}

export function BloqueVendedores({ cuenta, anio, mes }) {
  const venQ = useDrillVendedores(cuenta, anio);
  const filas = useMemo(() => agregarDim(venQ.data || [], 'vendedor', anio, mes), [venQ.data, anio, mes]);
  return (
    <Panel titulo="Vendedores" meta={`${filas.length} con venta · ${MESES[mes - 1]} ${anio} · tendencia 6 meses`} padding="0 0 2px">
      {venQ.isLoading ? <Cargando pantalla="selloutDrill" minHeight={200} /> : (
        <TablaCompacta dense maxHeight={400} rowKey={(r) => r.clave} filas={filas} vacio="Esta cuenta no reporta vendedores."
          columnas={[
            { key: 'clave', label: 'Vendedor', align: 'left', maxWidth: 200 },
            { key: 'importe', label: MESES[mes - 1], render: (r) => fmtMoney(r.importe) },
            { key: 'yoy', label: 'Δ YoY', width: 74, render: (r) => <DeltaPill value={r.yoy} /> },
            { key: 'clientes', label: 'Clientes', width: 62, render: (r) => (r.clientes ? fmtInt(r.clientes) : '—') },
            { key: 'skus', label: 'SKUs', width: 52, render: (r) => fmtInt(r.skus) },
            { key: 'tend', label: '6 m', align: 'left', width: 150, render: (r) => <span style={{ display: 'inline-flex', gap: 2 }}>{r.tendencia.map((v, i) => <HeatCell key={i} v={v} max={Math.max(...r.tendencia)} fmt={fmtMoney} />)}</span> },
          ]} />
      )}
    </Panel>
  );
}

// ───────────────────────────── Clientes finales ─────────────────────────────
export function BloqueClientesFinales({ cuenta, anio, mes, fila }) {
  const cfQ = useDrillClientesFinales(cuenta, anio, mes);
  const cf = useMemo(() => clientesFinales(cfQ.data || [], anio, mes), [cfQ.data, anio, mes]);
  return (
    <Panel titulo="Clientes finales" meta={`${MESES[mes - 1]} ${anio} · nuevos y perdidos contra el mes anterior`} padding="0 0 2px"
      acciones={(
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Pill tone="gray" size="xs">{fmtInt(cf.activos)} en el mes</Pill>
          <Pill tone="green" size="xs">+{fmtInt(cf.nuevos)} nuevos</Pill>
          <Pill tone="red" size="xs">{fmtInt(cf.perdidos)} perdidos</Pill>
          {fila?.cfRecompra != null && <Pill tone="blue" size="xs">recompra {fmtPct(fila.cfRecompra)}</Pill>}
          {fila?.cfTicket != null && <Pill tone="gray" size="xs">ticket {fmtMoney(fila.cfTicket)}</Pill>}
        </div>
      )}>
      {cfQ.isLoading ? <Cargando pantalla="selloutDrill" minHeight={200} /> : (
        <TablaCompacta dense maxHeight={400} rowKey={(r) => r.cliente_final} filas={cf.filas} vacio="Esta cuenta no reporta cliente final."
          columnas={[
            { key: 'cliente_final', label: 'Cliente final', align: 'left', maxWidth: 280 },
            { key: 'estado', label: 'Estado', align: 'left', width: 130, render: (r) => (r.estado ? capitalizarEstado(r.estado) : '—') },
            { key: 'importe', label: MESES[mes - 1], render: (r) => fmtMoney(r.importe) },
            { key: 'facturas', label: 'Facturas', width: 62, render: (r) => fmtInt(r.facturas) },
            { key: 'ticket', label: 'Ticket', width: 70, render: (r) => (r.ticket == null ? '—' : fmtMoney(r.ticket)) },
            { key: 'estatus', label: '', width: 72, align: 'left', render: (r) => (r.nuevo ? <Pill tone="green" size="xs">nuevo</Pill> : r.perdido ? <Pill tone="red" size="xs">perdido</Pill> : null) },
          ]} />
      )}
    </Panel>
  );
}

// ───────────────────────────── Mapa ─────────────────────────────
export function BloqueMapa({ cuenta, anio, mes }) {
  const { theme } = useTheme();
  const edoQ = useDrillEstados(cuenta, anio, mes);
  const [sel, setSel] = useState(null);
  const estados = useMemo(() => porEstado(edoQ.data || [], anio, mes), [edoQ.data, anio, mes]);
  const lista = useMemo(() => [...estados].sort((a, b) => N(b.importe) - N(a.importe)).slice(0, 10), [estados]);
  const total = lista.reduce((s, e) => s + N(e.importe), 0);
  return (
    <Panel titulo="Dónde vende" meta={`${estados.length} estados con sell out · ${MESES[mes - 1]} ${anio}`}>
      {edoQ.isLoading ? <Cargando pantalla="selloutDrill" minHeight={300} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 12, alignItems: 'start' }}>
          <Suspense fallback={<Cargando pantalla="selloutDrill" minHeight={300} />}>
            <MapaMexico datos={estados} seleccion={sel} onSelect={setSel} alto={320} />
          </Suspense>
          <div style={{ display: 'grid', gap: 4 }}>
            {lista.map((e) => (
              <div key={e.estado} onClick={() => setSel(sel === e.estado ? null : e.estado)} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 70px 44px 70px', gap: 8, alignItems: 'center', fontSize: 11, cursor: 'pointer', background: sel === e.estado ? `${theme.accent || '#007AFF'}14` : 'transparent', borderRadius: 6, padding: '2px 4px' }}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{capitalizarEstado(e.estado)}</span>
                <span style={{ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontWeight: 600 }}>{fmtMoney(e.importe)}</span>
                <span style={{ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: theme.textMuted }}>{total ? `${Math.round((N(e.importe) / total) * 100)}%` : '—'}</span>
                <span style={{ textAlign: 'right' }}><DeltaPill value={yoy(N(e.importe), N(e.importePrev))} /></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

// ───────────────────────────── Detalle por SKU ─────────────────────────────
// Mismo formato que el detalle de Sell In: SKU × últimos 12 meses en piezas o monto, buscador, descripción del
// roadmap, promedio, total, YoY (12 m vs los 12 anteriores) y, si la cuenta reporta inventario, stock y semanas.
export function BloqueSkus({ cuenta, anio, mes, conInventario = false }) {
  const { theme } = useTheme();
  const skuQ = useDrillSkus(cuenta, anio);
  const invQ = useDrillInventario(cuenta, conInventario);
  const { data: roadmap } = useRoadmap();
  const [unidad, setUnidad] = useState('monto');
  const [busca, setBusca] = useState('');
  const [orden, setOrden] = useState({ col: 'total', dir: 'desc' });
  const rd = useMemo(() => { const m = new Map(); (roadmap || []).forEach((r) => m.set(r.sku, r)); return m; }, [roadmap]);
  const meses12 = useMemo(() => ultimosMeses(anio, mes, 12), [anio, mes]);

  const filas = useMemo(() => {
    const modo = unidad === 'piezas' ? 'piezas' : 'importe';
    const actual = skusDeCuenta(skuQ.data || [], invQ.data || [], anio, mes, modo);
    const prev = new Map(skusDeCuenta(skuQ.data || [], [], anio - 1, mes, modo).map((f) => [f.sku, f.total]));
    return actual.map((f) => ({ ...f, max: Math.max(0, ...f.meses), yoy: yoy(f.total, prev.get(f.sku) || 0), descripcion: rd.get(f.sku)?.descripcion || '' }));
  }, [skuQ.data, invQ.data, anio, mes, unidad, rd]);

  const visibles = useMemo(() => {
    const q = busca.trim().toUpperCase();
    const l = q ? filas.filter((f) => f.sku.includes(q) || f.descripcion.toUpperCase().includes(q) || String(f.marca || '').toUpperCase().includes(q)) : filas;
    const dir = orden.dir === 'asc' ? 1 : -1;
    return [...l].sort((a, b) => { const va = a[orden.col], vb = b[orden.col]; if (typeof va === 'string') return String(va).localeCompare(String(vb)) * dir; return ((va ?? -Infinity) - (vb ?? -Infinity)) * dir; });
  }, [filas, busca, orden]);

  const fmtU = unidad === 'piezas' ? fmtInt : fmtMoney;
  return (
    <Panel titulo="Detalle por SKU · Sell Out" meta={`${visibles.length} SKUs · últimos 12 meses · ${unidad === 'piezas' ? 'piezas' : 'importe sin IVA'}${conInventario ? ' · stock de la última foto' : ''}`}
      acciones={(
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 999, height: 28, minWidth: 200 }}>
            <Search size={12} style={{ color: theme.textMuted }} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="SKU, descripción o marca…" style={{ flex: 1, outline: 'none', fontSize: 11.5, background: 'transparent', border: 'none', color: theme.text, fontFamily: 'inherit' }} />
            {busca && <button onClick={() => setBusca('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: theme.textMuted, padding: 0, display: 'inline-flex' }}><X size={12} /></button>}
          </div>
          <Segmented options={[{ id: 'piezas', label: 'Piezas' }, { id: 'monto', label: 'Monto' }]} value={unidad} onChange={setUnidad} />
        </div>
      )} padding="0 0 2px">
      {skuQ.isLoading ? <Cargando pantalla="selloutDrill" minHeight={240} /> : (
        <TablaCompacta dense maxHeight={520} rowKey={(r) => r.sku} filas={visibles} orden={orden}
          onSort={(col) => setOrden((o) => (o.col === col ? { col, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: col === 'sku' ? 'asc' : 'desc' }))}
          vacio="Sin SKUs con sell out en los últimos 12 meses."
          columnas={[
            { key: 'sku', label: 'SKU', align: 'left', mono: true, width: 100, sort: true },
            { key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 240, render: (r) => <span style={{ color: theme.textMuted }} title={r.descripcion}>{r.descripcion || r.marca || '—'}</span> },
            ...meses12.map((m, i) => ({ key: `m${i}`, label: `${MESES[m.mes - 1]}${m.anio !== anio ? ` ${String(m.anio).slice(2)}` : ''}`, width: 50, render: (r) => <HeatCell v={r.meses[i]} max={r.max} fmt={fmtU} /> })),
            { key: 'prom', label: 'Prom', width: 60, sort: true, render: (r) => fmtU(r.prom) },
            { key: 'total', label: 'Total', width: 70, bold: true, sort: true, render: (r) => fmtU(r.total) },
            { key: 'yoy', label: 'YoY', width: 64, sort: true, render: (r) => <DeltaPill value={r.yoy} /> },
            ...(conInventario ? [
              { key: 'stock', label: 'Stock', width: 58, sort: true, render: (r) => (r.stock == null ? '—' : fmtInt(r.stock)) },
              { key: 'semanas', label: 'Sem.', width: 52, sort: true, render: (r) => (r.stock === 0 ? <Pill tone="orange" size="xs">0</Pill> : r.semanas == null ? '—' : r.semanas.toFixed(1)) },
            ] : []),
          ]} />
      )}
    </Panel>
  );
}

/** Sell Out a la medida de una cuenta no propia: bloques apilados según su receta. */
export default function SellOutPorReceta({ cuenta, fila, anio, mes, corteDia }) {
  const { theme } = useTheme();
  const { bloques, nota } = bloquesDe(cuenta, fila);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {nota && <div style={{ fontSize: 11, color: theme.textMuted, padding: '0 4px' }}>{nota}</div>}
      {bloques.map((b) => {
        if (b === 'resumen') return <Panel key={b} titulo="Resumen del mes" meta={`${fila.nombre} · ${MESES[mes - 1].toLowerCase()} ${anio} · sin IVA`}><ResumenSellOut cuenta={cuenta} anio={anio} mes={mes} corteDia={corteDia} /></Panel>;
        if (b === 'cambios') return <BloqueCambios key={b} cuenta={cuenta} anio={anio} mes={mes} bloques={bloques} />;
        if (b === 'mapa') return <BloqueMapa key={b} cuenta={cuenta} anio={anio} mes={mes} />;
        if (b === 'sucursales') return <BloqueSucursales key={b} cuenta={cuenta} anio={anio} mes={mes} />;
        if (b === 'vendedores') return <BloqueVendedores key={b} cuenta={cuenta} anio={anio} mes={mes} />;
        if (b === 'clientes') return <BloqueClientesFinales key={b} cuenta={cuenta} anio={anio} mes={mes} fila={fila} />;
        if (b === 'skus') return <BloqueSkus key={b} cuenta={cuenta} anio={anio} mes={mes} conInventario={fila.invValor != null} />;
        return null;
      })}
    </div>
  );
}
