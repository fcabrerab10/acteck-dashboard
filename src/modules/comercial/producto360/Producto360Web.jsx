// Producto 360 en la web (2026-11-18, congruencia web ↔ celular): la ficha única de un SKU del celular
// (src/movil/pestanas/producto/) como HojaLateral ancha, para abrirla desde cualquier pantalla sin perder el lugar.
// Se abre con ⌘K al elegir un SKU o con `acteck:navegar { pagina: 'producto360', extra: { sku } }` (App.jsx la monta lazy).
//   Resumen    → frase del mes, 4 cifras, sell in vs sell out 12 m (piezas / $), quién lo compra, quién lo desplaza y
//                quiénes dejaron de comprarlo.
//   Inventario → nuestro stock (disponible, cobertura, en camino), por almacén, en cuentas y stock al cierre 12 m.
//   Abasto     → el S&OP de este SKU: cobertura, sugerido, POs en camino (ficha de PO), «Por qué N pz» y «Agregar a solicitud».
//   Precio     → listas vigentes; costo promedio, margen y utilidad por pieza sólo con permiso sensible.
// Mismos hooks y motor que el celular: producto360/datos.js (useProducto360), producto360/abasto.js (useAbastoSku),
// producto360/calculo.js (resumenProducto · preciosDeLista) y forecast/porQue.js. Nada de cálculo aquí.
import React, { useMemo, useState } from 'react';
import { FileText, Calculator, ClipboardList, Plus } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { moneyCompact, isoLocal } from '../../../lib/format';
import { usePerfil } from '../../../lib/perfilContext';
import { puedeVerSensible, puedeEditarPestanaGlobal } from '../../../lib/permisos';
import { marcaDeSku, normalizarMarca } from '../../../lib/marcas';
import { KpiCard, Panel, Pill, Segmented, Boton, TablaCompacta, GraficaLineas, Skeleton, Vacio, toast } from '../../../components/kit';
import { HojaLateral } from '../../../components/perfil/comun';
import CampoNumero from '../propuestas/CampoNumero';
import { useSolicitudes } from '../forecast/useSolicitudes';
import { porQue } from '../forecast/porQue';
import { diasCobertura, tonoCobertura, usdCompact, fechaCorta, cedisCorto, estatusCorto, costoDe } from '../forecast/sopCalculo';
import FichaPOHoja from '../forecast/FichaPOWeb';
import { crearDesdeCaptura } from '../../agenda5/datos';
import { useProducto360 } from './datos';
import { useAbastoSku, fraseAbasto } from './abasto';
import { mesDeLectura, resumenProducto, preciosDeLista } from './calculo';

const N = (v) => Number(v) || 0;
const int = (n) => Math.round(N(n)).toLocaleString('es-MX');
const pz = (n) => `${int(n)} pz`;
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const PROPIOS = new Set(['digitalife', 'pcel', 'dicotech']);
const CARAS = [{ id: 'resumen', label: 'Resumen' }, { id: 'inventario', label: 'Inventario' }, { id: 'abasto', label: 'Abasto' }, { id: 'precio', label: 'Precio' }];
const UNIDADES = [{ id: 'piezas', label: 'Piezas' }, { id: 'monto', label: '$' }];
const mesLbl = (k) => { const [a, m] = String(k).split('-').map(Number); return `${MESES[m - 1].toLowerCase()} ${String(a).slice(2)}`; };
const delta = (v) => (v == null ? 'nuevo' : `${v > 0 ? '+' : ''}${Math.round(v)} %`);
const TONO_INV = { agotado: 'red', riesgo: 'orange', sobre: 'purple', sano: 'green' };
const dinero = (n) => `$${N(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Dato({ k, v, sub, color }) {
  const { theme } = useTheme();
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: color || theme.text, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      {sub && <div style={{ fontSize: 10.5, color: theme.textMuted, lineHeight: 1.35 }}>{sub}</div>}
    </div>
  );
}
const rejilla = (min = 300) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`, gap: 10, alignItems: 'start' });

// ─── Resumen ───
function CaraResumen({ d, r, unidad, onUnidad, onCliente, onCuenta, onProponer }) {
  const { theme } = useTheme();
  const fmt = unidad === 'piezas' ? pz : moneyCompact;
  const colsCompra = [
    { key: 'nombre', label: 'Cliente', align: 'left', maxWidth: 200, render: (x) => <span title={x.nombre} style={{ color: onCliente ? theme.accent : theme.text }}>{x.nombre}</span> },
    { key: 'piezas', label: 'Piezas', width: 64, bold: true, render: (x) => int(x.piezas) },
    { key: 'deltaPz', label: 'vs mes ant.', width: 76, render: (x) => <span style={{ color: x.deltaPz == null ? theme.textMuted : x.deltaPz >= 0 ? theme.green : theme.red }}>{delta(x.deltaPz)}</span> },
    { key: 'monto', label: 'Monto', width: 70, render: (x) => moneyCompact(x.monto) },
    { key: 'mesesSeguidos', label: 'Seguidos', width: 64, render: (x) => `${x.mesesSeguidos} m` },
  ];
  const colsDesplaza = [
    { key: 'nombre', label: 'Cuenta', align: 'left', maxWidth: 190, render: (x) => <span title={x.nombre} style={{ color: onCuenta ? theme.accent : theme.text }}>{x.nombre}</span> },
    { key: 'piezas', label: 'Piezas', width: 64, bold: true, render: (x) => int(x.piezas) },
    { key: 'deltaPz', label: 'vs mes ant.', width: 76, render: (x) => (x.piezas > 0 || x.prevPz > 0 ? <span style={{ color: x.deltaPz == null ? theme.textMuted : x.deltaPz >= 0 ? theme.green : theme.red }}>{delta(x.deltaPz)}</span> : '—') },
    { key: 'share', label: '%', width: 46, render: (x) => (x.share > 0 ? `${Math.round(x.share)} %` : '—') },
    { key: 'inv', label: 'Su inventario', width: 96, align: 'center', render: (x) => (x.inv ? <Pill tone={TONO_INV[x.inv.estado] || 'gray'} size="xs">{x.inv.estado === 'agotado' ? 'agotado' : x.inv.semanas != null ? `${x.inv.semanas} sem` : pz(x.inv.piezas)}</Pill> : <span style={{ color: theme.textSubtle || theme.textMuted }}>no reporta</span>) },
  ];
  const lbl = `${MESES[r.mes - 1].toLowerCase()} ${r.anio}`;
  return (
    <>
      <GraficaLineas titulo="Sell in vs sell out · 12 meses" meta={unidad === 'piezas' ? 'piezas' : 'pesos · sell out sin IVA'} alto={200} formato={fmt} mostrarMinMax={false}
        acciones={<Segmented options={UNIDADES} value={unidad} onChange={onUnidad} />}
        datos={r.serie.map((x) => ({ x: x.label, si: x.si, so: x.so }))}
        series={[{ key: 'si', label: 'Sell in', tipo: 'principal' }, { key: 'so', label: 'Sell out', tipo: 'linea', color: theme.purple }]} />
      <div style={rejilla(340)}>
        <Panel titulo="Quién lo compra" meta={`${lbl} · ${r.compra.compran.length} cliente${r.compra.compran.length === 1 ? '' : 's'}`} padding="6px">
          <TablaCompacta dense dividir={false} maxHeight={300} rowKey={(x) => x.cliente} filas={r.compra.compran} columnas={colsCompra} onRowClick={onCliente ? (x) => onCliente(x.nombre) : undefined} vacio="Nadie lo compró en el mes." />
        </Panel>
        <Panel titulo="Quién lo desplaza" meta={`${lbl} · ${r.desplaza.filter((x) => x.piezas > 0).length} cuenta${r.desplaza.filter((x) => x.piezas > 0).length === 1 ? '' : 's'}`} padding="6px">
          <TablaCompacta dense dividir={false} maxHeight={300} rowKey={(x) => x.cuenta} filas={r.desplaza} columnas={colsDesplaza} onRowClick={onCuenta ? (x) => onCuenta(x.cuenta) : undefined} vacio="Ninguna cuenta lo reporta." />
        </Panel>
      </div>
      {r.compra.dejaron.length > 0 && (
        <Panel plegable abiertoInicial={r.compra.dejaron.length <= 6} titulo="Dejaron de comprarlo" meta={`${r.compra.dejaron.length} · compraban y llevan 6 meses sin pedirlo`} padding="6px">
          <TablaCompacta dense dividir={false} maxHeight={260} rowKey={(x) => x.cliente} filas={r.compra.dejaron.slice(0, 20)}
            columnas={[
              { key: 'nombre', label: 'Cliente', align: 'left', maxWidth: 240, render: (x) => <span title={x.nombre}>{x.nombre}</span> },
              { key: 'ultimaCompra', label: 'Última compra', width: 104, render: (x) => `${mesLbl(x.ultimaCompra)} · ${int(x.piezasUltima)} pz` },
              { key: 'piezas12m', label: '12 m', width: 70, render: (x) => pz(x.piezas12m) },
              { key: 'accion', label: '', width: 92, align: 'right', render: (x) => <Boton onClick={(e) => { e?.stopPropagation?.(); onProponer?.(x); }} title={d.cuentas.some((c) => c.erp_cliente === x.cliente && PROPIOS.has(c.cuenta)) ? 'Abrir una propuesta con este SKU' : 'Crear el pendiente en tu Agenda'}>Proponer</Boton> },
            ]} />
        </Panel>
      )}
    </>
  );
}

// ─── Inventario ───
function CaraInventario({ d, r, sensible, unidad, onUnidad, onCuenta }) {
  const { theme } = useTheme();
  const almacenes = useMemo(() => [...d.almacenes].sort((a, b) => N(b.inventario) - N(a.inventario)), [d.almacenes]);
  const cuentas = useMemo(() => [...d.invCuentas].sort((a, b) => b.piezas - a.piezas).map((x) => ({ ...x, nombre: d.cuentas.find((c) => c.cuenta === x.cuenta)?.nombre || x.cuenta })), [d.invCuentas, d.cuentas]);
  return (
    <>
      <Panel titulo="Nuestro inventario" meta={pz(r.invPz)} padding="12px 14px">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px 16px' }}>
          <Dato k="Disponible" v={pz(r.invDisp)} sub="en almacenes comerciales" />
          {sensible && <Dato k="Valor a costo promedio" v={moneyCompact(r.invValor)} sub={d.inv?.costo_promedio ? `${dinero(d.inv.costo_promedio)} por pieza` : undefined} />}
          <Dato k="Cobertura" v={r.semanas != null ? `${r.semanas} sem` : '—'} color={r.semanas != null && r.semanas < 2 ? theme.red : undefined} sub={r.ritmoSi > 0 ? `ritmo ${int(r.ritmoSi)} pz/mes de sell in` : 'sin ritmo de venta'} />
          <Dato k="En camino" v={r.tr ? pz(r.tr.cantidad) : '—'} sub={r.proximo ? `próximo ${fechaCorta(r.proximo.eta)} · PO ${r.proximo.po}${r.proximo.estatus ? ` · ${estatusCorto(r.proximo.estatus)}` : ''}` : 'nada en camino'} />
        </div>
      </Panel>
      <div style={rejilla(320)}>
        <Panel titulo="Por almacén" meta={`${almacenes.length} con stock`} padding="6px">
          <TablaCompacta dense dividir={false} maxHeight={280} rowKey={(a) => a.no_almacen} filas={almacenes} vacio="Sin stock en ningún almacén."
            rowStyle={(a) => (a.en_inv_actual ? undefined : { opacity: 0.6 })}
            columnas={[
              { key: 'almacen_nombre', label: 'Almacén', align: 'left', maxWidth: 200, render: (a) => <span title={a.almacen_nombre}>{a.no_almacen} · {a.almacen_nombre || 'almacén'}</span> },
              { key: 'inventario', label: 'Piezas', width: 70, bold: true, sum: true, render: (a) => int(a.inventario) },
              { key: 'disponible', label: 'Disp.', width: 64, sum: true, render: (a) => int(a.disponible) },
              { key: 'en_inv_actual', label: '', width: 92, align: 'center', render: (a) => (a.en_inv_actual ? null : <Pill tone="gray" size="xs" title="No entra en la medida [Inv Actual]">fuera de venta</Pill>) },
            ]} />
        </Panel>
        <Panel titulo="En cuentas" meta={cuentas.length ? `${pz(r.invCuentasPz)}${r.semCuentas != null ? ` · ${r.semCuentas} sem` : ''} · última foto de cada cuenta` : 'ninguna cuenta reporta inventario'} padding="6px">
          <TablaCompacta dense dividir={false} maxHeight={280} rowKey={(x) => x.cuenta} filas={cuentas} vacio="Ninguna cuenta reporta inventario de este SKU." onRowClick={onCuenta ? (x) => onCuenta(x.cuenta) : undefined}
            columnas={[
              { key: 'nombre', label: 'Cuenta', align: 'left', maxWidth: 190 },
              { key: 'piezas', label: 'Piezas', width: 70, bold: true, sum: true, render: (x) => int(x.piezas) },
              { key: 'valor', label: 'Valor', width: 74, render: (x) => moneyCompact(x.valor) },
              { key: 'semana', label: 'Semana', width: 62, render: (x) => `sem ${x.semana}` },
            ]} />
        </Panel>
      </div>
      {r.stockMeses && (sensible || unidad === 'piezas') && (
        <GraficaLineas titulo="Stock al cierre · 12 meses" meta={unidad === 'piezas' ? 'piezas al último día con foto del mes' : 'valor a costo'} alto={160} formato={unidad === 'piezas' ? pz : moneyCompact} mostrarMinMax={false}
          acciones={sensible ? <Segmented options={UNIDADES} value={unidad} onChange={onUnidad} /> : null}
          datos={r.stockMeses.cols.map((c, i) => ({ x: c.split(' ')[0], stock: r.stockMeses.vals[i] || null }))}
          series={[{ key: 'stock', label: 'Stock', tipo: 'principal' }]} />
      )}
    </>
  );
}

// ─── Abasto ───
export function CaraAbasto({ row: r, arribos = [], sensible = false, puedeEditar = false, enSolicitud = false, cantidad, onCantidad, onAgregar, ocupado = false, onPo, cargando = false }) {
  const { theme } = useTheme();
  if (cargando) return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={70} r={12} /><Skeleton h={160} r={12} /></div>;
  if (!r) return <Vacio titulo="Sin datos de abasto" sub="Este SKU no tiene venta, inventario ni tránsito en los últimos 12 meses." />;
  const dias = diasCobertura(r);
  const inv = N(r.inv);
  const tono = tonoCobertura(dias, inv);
  const color = tono === 'red' ? theme.red : tono === 'orange' ? theme.orange : tono === 'green' ? theme.green : undefined;
  const sem = dias != null ? Math.round((dias / 7) * 10) / 10 : null;
  const ppc = N(r.piezasPorContenedor);
  const sug = N(r.sugerido);
  return (
    <>
      <Panel padding="12px 14px">
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.4, color: theme.text }}>{fraseAbasto(r, arribos)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px 16px', marginTop: 12 }}>
          <Dato k="Cobertura" v={inv <= 0 ? 'Agotado' : dias != null ? `${int(dias)} d` : '—'} color={color} sub={inv <= 0 ? (N(r.demMes) > 0 ? `${int(r.demMes)} pz/mes de demanda` : 'sin demanda en 3 meses') : sem != null ? `${sem} sem · meta 90 d` : 'sin ritmo de venta'} />
          <Dato k="Venta real" v={`${int(r.ritmo3m)} pz/mes`} sub="3 meses cerrados" />
          <Dato k="Stock + en camino" v={pz(inv + N(r.traCant))} sub={`${int(inv)} en stock · ${int(r.traCant)} en camino`} />
          <Dato k="Sugerido" v={sug > 0 ? pz(sug) : '—'} color={sug > 0 ? theme.orange : undefined}
            sub={sug > 0 ? ([sensible && costoDe(r) ? `${usdCompact(sug * costoDe(r))} USD` : null, r.esConsolidado ? 'consolidado' : ppc > 0 ? `${r.contenedoresSugeridos} cnt × ${int(ppc)}` : null].filter(Boolean).join(' · ') || 'piezas exactas') : N(r.necesidadNeta) > 0 ? `necesidad ${int(r.necesidadNeta)} pz` : 'sin brecha a 3 meses'} />
          <Dato k="Proveedor" v={<span style={{ fontSize: 13 }}>{r.supplier || '—'}</span>} sub={r.ltDias ? `lead time ${Math.round(r.ltDias)} d` : undefined} />
        </div>
      </Panel>
      <Panel titulo="Lo que llega" meta={arribos.length ? `${arribos.length} PO · ${pz(r.traCant)} · clic para la ficha de la PO` : (r.poPendiente ? `PO ${r.poPendiente.po || ''} colocada al proveedor, aún sin embarcar` : 'nada en camino')} padding="6px">
        <TablaCompacta dense dividir={false} maxHeight={240} rowKey={(p) => p.po} filas={arribos} onRowClick={onPo} vacio="Sin embarques pendientes de este SKU."
          columnas={[
            { key: 'po', label: 'PO', align: 'left', width: 96, render: (p) => <span style={{ color: theme.accent, fontWeight: 600 }}>{p.po}</span> },
            { key: 'supplier', label: 'Proveedor · naviera', align: 'left', maxWidth: 200, render: (p) => <span style={{ color: theme.textMuted }}>{[p.supplier, p.naviera, cedisCorto(p.cedis)].filter(Boolean).join(' · ') || '—'}</span> },
            { key: 'estatus', label: 'Estatus', align: 'left', width: 108, render: (p) => (p.vencida ? <Pill tone="red" size="xs">ETA vencida</Pill> : estatusCorto(p.estatus) || '—') },
            { key: 'eta', label: 'ETA', width: 66, render: (p) => (p.eta ? fechaCorta(p.eta) : 'sin ETA') },
            { key: 'mio', label: 'Piezas', width: 70, bold: true, render: (p) => int(p.skus.find((s) => s.sku === r.sku)?.piezas || 0) },
          ]} />
      </Panel>
      <Panel titulo={sug > 0 ? `Por qué ${int(sug)} pz` : 'Cómo se calcula'} padding="10px 14px">
        <div style={{ fontFamily: TYPO.fontText, fontSize: 12.5, lineHeight: 1.55, color: theme.text }}>{porQue(r)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <CampoNumero value={cantidad} onChange={onCantidad} ancho={96} alto={30} ariaLabel="Piezas para la solicitud" />
          <span style={{ fontSize: 11.5, color: theme.textMuted }}>pz</span>
          <Boton primario icon={enSolicitud ? ClipboardList : Plus} size="md" disabled={ocupado || !puedeEditar || !(cantidad > 0)} onClick={onAgregar}
            title={puedeEditar ? 'Mismo borrador de solicitud que el S&OP' : 'Tu perfil sólo consulta'}>{ocupado ? 'Guardando…' : enSolicitud ? 'Actualizar solicitud' : 'Agregar a solicitud'}</Boton>
          {!puedeEditar && <span style={{ fontSize: 11, color: theme.textMuted }}>Tu perfil sólo consulta.</span>}
        </div>
      </Panel>
    </>
  );
}

// ─── Precio ───
function CaraPrecio({ d, sensible, onCalcular }) {
  const { theme } = useTheme();
  const costo = sensible ? N(d.inv?.costo_promedio) : 0;
  const filas = useMemo(() => preciosDeLista(d.precios, costo || null), [d.precios, costo]);
  return (
    <Panel titulo="Listas de precio vigentes" meta={`${filas.length} lista${filas.length === 1 ? '' : 's'}${sensible && costo > 0 ? ` · costo promedio ${dinero(costo)}` : ''}`} padding="6px"
      acciones={<Boton icon={Calculator} onClick={onCalcular}>Calcular precio</Boton>}>
      <TablaCompacta dense dividir={false} maxHeight={360} rowKey={(p) => p.lista} filas={filas} vacio="Este SKU no tiene precio en ninguna lista."
        columnas={[
          { key: 'lista', label: 'Lista', align: 'left', maxWidth: 260 },
          { key: 'precio', label: 'Precio', width: 96, bold: true, render: (p) => dinero(p.precio) },
          ...(sensible ? [
            { key: 'margenPct', label: 'Margen', width: 76, render: (p) => (p.margenPct == null ? '—' : <span style={{ color: p.margenPct < 0 ? theme.red : p.margenPct < 15 ? theme.orange : theme.green }}>{p.margenPct.toFixed(1)} %</span>) },
            { key: 'utilidad', label: 'Utilidad / pz', width: 96, render: (p) => (p.utilidad == null ? '—' : dinero(p.utilidad)) },
          ] : []),
        ]} />
      {sensible && !(costo > 0) && <div style={{ fontSize: 10.5, color: theme.textMuted, padding: '6px 8px 2px' }}>Sin costo promedio en inventario: no se puede calcular el margen.</div>}
    </Panel>
  );
}

/** Vista pura de la ficha (SSR en pruebas). `d` = useProducto360 · `abasto` = { row, arribos, cargando, … } de la cara Abasto. */
export function Producto360Vista({ sku, d, sensible = false, cara = 'resumen', onCara, unidad = 'piezas', onUnidad, hoy = new Date(), abasto = {}, onCliente, onCuenta, onProponer, onPreparar, onCalcular }) {
  const { theme } = useTheme();
  const r = useMemo(() => resumenProducto(d, { hoy, unidad }), [d, hoy, unidad]);
  const { mes, anio, pocoMes } = mesDeLectura(hoy);
  if (!r) return null;
  const mesTxt = MESES[mes - 1].toLowerCase();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: TYPO.fontText, color: theme.text }}>
      <div style={{ background: theme.surfaceInverse, color: theme.textOnInverse, borderRadius: 14, padding: '14px 16px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7 }}>{MESES[mes - 1]} {anio}{pocoMes ? ' · último mes cerrado' : ''}</div>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.35, marginTop: 4 }}>{r.frase}</div>
      </div>
      <div data-entrada-kpis style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
        <KpiCard eyebrow={`Sell out · ${mesTxt}`} big={r.piezasSo > 0 ? pz(r.piezasSo) : '—'} sub={r.piezasSo > 0 ? moneyCompact(r.montoSo) : 'sin sell out reportado'} onClick={() => onCara?.('resumen')} />
        <KpiCard eyebrow={`Sell in · ${mesTxt}`} big={r.piezasSi > 0 ? pz(r.piezasSi) : '—'} sub={r.piezasSi > 0 ? `${moneyCompact(r.montoSi)} · ${r.compra.compran.length} cliente${r.compra.compran.length === 1 ? '' : 's'}` : 'sin facturación'} onClick={() => onCara?.('resumen')} />
        <KpiCard eyebrow="Inventario Acteck" big={pz(r.invPz)} bigColor={r.invPz <= 0 ? theme.red : r.semanas != null && r.semanas < 2 ? theme.orange : undefined}
          sub={r.semanas != null ? `${r.semanas} sem al ritmo de sell in${r.proximo ? ` · llega ${fechaCorta(r.proximo.eta)}` : ''}` : (r.proximo ? `llega ${fechaCorta(r.proximo.eta)}` : 'sin ritmo de venta')} onClick={() => onCara?.('inventario')} />
        <KpiCard eyebrow="En cuentas" big={d.invCuentas.length ? pz(r.invCuentasPz) : '—'} sub={d.invCuentas.length ? `${r.semCuentas != null ? `${r.semCuentas} sem · ` : ''}${d.invCuentas.length} cuenta${d.invCuentas.length === 1 ? '' : 's'} reportan` : 'ninguna cuenta reporta inventario'} onClick={() => onCara?.('inventario')} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Segmented size="md" options={CARAS} value={cara} onChange={onCara} />
        <span style={{ marginLeft: 'auto' }}><Boton primario icon={FileText} onClick={onPreparar}>Preparar propuesta</Boton></span>
      </div>
      {cara === 'resumen' && <CaraResumen d={d} r={r} unidad={unidad} onUnidad={onUnidad} onCliente={onCliente} onCuenta={onCuenta} onProponer={onProponer} />}
      {cara === 'inventario' && <CaraInventario d={d} r={r} sensible={sensible} unidad={unidad} onUnidad={onUnidad} onCuenta={onCuenta} />}
      {cara === 'abasto' && <CaraAbasto {...abasto} sensible={sensible} />}
      {cara === 'precio' && <CaraPrecio d={d} sensible={sensible} onCalcular={onCalcular} />}
    </div>
  );
}

const navegar = (detail) => window.dispatchEvent(new CustomEvent('acteck:navegar', { detail }));

/** Cara Abasto con datos: mismo hook y mismo borrador de solicitudes_compra que el S&OP. */
function useAbastoWeb(sku, { activo, perfil }) {
  const puedeEditar = puedeEditarPestanaGlobal(perfil, 'forecast_solicitudes');
  const { data, isLoading } = useAbastoSku(sku, { enabled: activo });
  const sol = useSolicitudes(perfil);
  const borrador = sol.borradores[0] || null;
  const lineas = borrador ? sol.lineasDe(borrador.id) : [];
  const linea = lineas.find((l) => l.sku === sku) || null;
  const r = data?.row || null;
  const porDefecto = N(linea?.cantidad) || N(r?.sugerido) || (N(r?.piezasPorContenedor) > 0 && !r?.esConsolidado ? N(r.piezasPorContenedor) : Math.round(N(r?.necesidadNeta))) || 0;
  const [cantidad, setCantidad] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const cant = cantidad == null ? porDefecto : cantidad;
  const onAgregar = async () => {
    if (!r || !(cant > 0)) return;
    setOcupado(true);
    try {
      let id = borrador?.id;
      if (!id) { const nuevo = await sol.crearBorrador(); id = nuevo?.id; }
      if (!id) throw new Error('No se pudo crear el borrador');
      const ppc = N(r.piezasPorContenedor);
      let fechaEstimada = null;
      if (r.ltDias > 0) { const f = new Date(); f.setDate(f.getDate() + Math.round(r.ltDias)); fechaEstimada = isoLocal(f); }
      if (linea) await sol.editarLinea(linea.id, { cantidad: cant, contenedores: ppc > 0 ? Math.ceil(cant / ppc) : null });
      else await sol.agregarLinea(id, { sku, descripcion: r.descripcion || '', cantidad: cant, proveedor: r.supplier || '', fecha_estimada: fechaEstimada, ultimo_costo_usd: costoDe(r) || null, piezas_por_contenedor: ppc || null, contenedores: ppc > 0 ? Math.ceil(cant / ppc) : null, es_consolidado: !!r.esConsolidado });
      toast.ok(`${sku} · ${int(cant)} pz en la solicitud`);
    } catch (e) { toast.error(`No se pudo agregar: ${e?.message || e}`); }
    finally { setOcupado(false); }
  };
  return { row: r, arribos: data?.arribos || [], cargando: isLoading, puedeEditar, enSolicitud: !!linea, cantidad: cant, onCantidad: (n) => setCantidad(Math.max(0, Math.round(N(n)))), onAgregar, ocupado };
}

function Contenido({ sku, onClose }) {
  const perfil = usePerfil();
  const sensible = puedeVerSensible(perfil);
  const hoy = useMemo(() => new Date(), []);
  const [cara, setCara] = useState('resumen');
  const [unidad, setUnidad] = useState('piezas');
  const [po, setPo] = useState(null);
  const { data: d, isLoading, error } = useProducto360(sku, { hoy });
  const abasto = useAbastoWeb(sku, { activo: cara === 'abasto', perfil });
  const desc = d?.roadmap?.descripcion || '';

  const ir = (detail) => { onClose?.(); navegar(detail); };
  const abrirCliente = (nombre) => ir({ pagina: 'analisisClientes', extra: { clienteNombre: nombre } });
  const abrirCuenta = (cuenta) => { const c = d?.cuentas.find((x) => x.cuenta === cuenta); if (c?.nombre && c.erp_cliente) abrirCliente(c.nombre); else toast.info('Esta cuenta no tiene cliente del ERP ligado.'); };
  const preparar = (clienteKey = null) => ir({ pagina: 'propuestas', clienteKey, extra: { clienteKey, skus: [sku] } });
  const proponer = async (x) => {
    const propia = d?.cuentas.find((c) => c.erp_cliente === x.cliente && PROPIOS.has(c.cuenta));
    if (propia) { preparar(propia.cuenta); return; }
    try {
      await crearDesdeCaptura(`Ofrecer ${sku}${desc ? ` ${desc.slice(0, 40)}` : ''} a ${x.nombre}`, { propietario: perfil?.user_id, hoy, extra: { cuando: isoLocal(hoy), origen: { hilo: 'ventas', porque: `Dejó de comprar ${sku}` } } });
      toast.ok('Pendiente creado en tu Agenda');
    } catch (e) { toast.error(e?.message || String(e)); }
  };

  if (error) return <Vacio titulo="No se pudo cargar el producto" sub={String(error.message || error)} />;
  if (isLoading || !d) return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={80} r={14} /><Skeleton h={90} r={12} /><Skeleton h={220} r={12} /><Skeleton h={200} r={12} /></div>;
  return (
    <>
      <Producto360Vista sku={sku} d={d} sensible={sensible} cara={cara} onCara={setCara} unidad={unidad} onUnidad={setUnidad} hoy={hoy}
        abasto={{ ...abasto, onPo: setPo }} onCliente={abrirCliente} onCuenta={abrirCuenta} onProponer={proponer} onPreparar={() => preparar(null)}
        onCalcular={() => { try { sessionStorage.setItem('nav_busqueda_sku', sku); } catch { /* sin storage */ } ir({ pagina: 'estrategiaPrecios', extra: { sku } }); }} />
      <FichaPOHoja po={po} sensible={sensible} onClose={() => setPo(null)} zIndex={90} />
    </>
  );
}

/** HojaLateral ancha. `sku` null = cerrada. La monta App.jsx (lazy) y la abre ⌘K o `acteck:navegar { pagina: 'producto360' }`. */
export default function Producto360Hoja({ sku, onClose }) {
  const { theme } = useTheme();
  const s = String(sku || '').trim().toUpperCase();
  const { data: d } = useProducto360(s, { enabled: !!s });
  const marca = normalizarMarca(d?.roadmap?.marca) || (s ? marcaDeSku(s) : '') || '';
  const sub = [d?.roadmap?.descripcion, d?.roadmap?.categoria, marca].filter(Boolean).join(' · ') || 'Producto 360';
  return (
    <HojaLateral abierto={!!s} onClose={onClose} theme={theme} ancho={940} titulo={s || 'Producto'} sub={sub}>
      {s && <Contenido key={s} sku={s} onClose={onClose} />}
    </HojaLateral>
  );
}
