// Sell Out de un cliente propio en el celular (3.84.0 · 2026-10-06, mockup c73e7c5c v2). Las ven los clientes: sin margen
// ni costo nuestro; gráficas de línea (sólo el zoom diario en barras); el dinero en su piso es la cifra grande.
//   $ · Piezas → HeroM → 4 KpiM (Sell out del mes · Inventario en el cliente $ · Agotados que vende · la cuarta según el
//   cliente: Digitalife ensambles, PCEL SKUs sin movimiento, Dicotech clientes activos) → zoom diario → sell out 12 m
//   (línea) → Dónde está el movimiento → categorías (pay) → Productos × 12 m con su inventario ($ y pz) → bloques
//   por cliente (ensambles · sin movimiento · sucursales, vendedores y clientes finales) → Armar propuesta · Compartir.
// Datos: los mismos hooks del Sell Out consolidado (sellout/datos.js) + inventario en la cuenta por SKU.
import React, { useMemo, useState } from 'react';
import { FileText, Share2, ShoppingBag } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { useRoadmap } from '../../../lib/queries';
import { useNav } from '../../nav';
import { HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, Segmented, Pill, Vacio, Skeleton, PayM, BotonGrande, CampoBusqueda, toast } from '../../piezas';
import { moneyCompact, int, deltaPct, MESES, N, MONO } from '../../util';
import { useCuentas, useDias, useMensual, useCuotas, useDrillSkus, useDrillSucursales, useDrillVendedores, useDrillClientesFinales, useDrillInventario } from '../../../modules/comercial/sellout/datos';
import { construirFilas, ultimoDiaConVenta, ultimoMesConVenta, agregarDimension, clientesFinalesDelMes, idxMes } from '../../../modules/comercial/sellout/calculo';
import { bloquesDe } from '../../../modules/comercial/sellout/BloquesCuenta';
import { movimientos } from '../../../modules/comercial/analisis/movimiento';
import { interpretarBusqueda, coincideSku, indiceSku, quitarChip } from '../../../lib/buscarSku';
import { compartir } from '../../../lib/whatsapp';
import { ZoomDiarioM, MovimientoM, Evolucion12M, DimensionM } from '../analisis/Pestanas';
import { ChipsEntendido } from '../sellout/DetalleSkuAnual';
import { categoriasDe } from '../sellout/skuAnual';
import Producto360 from '../producto/Producto360';
import { useEnsamblesModelo } from './datos';
import { queLeFalta, sinMovimiento, filasSkuInv, colsSkuInv, compact } from './calculo';

const SEG = [{ id: 'monto', label: '$' }, { id: 'piezas', label: 'Piezas' }];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const FUENTE = { digitalife: 'sell out reportado por Digitalife', pcel: 'reporte semanal venta-marca de PCEL · valuado a lista', dicotech: 'sell out por sucursal y vendedor de Dicotech' };
const fmtDe = (u) => (u === 'piezas' ? (n) => `${int(n)} pz` : moneyCompact);

/** Tabla «Productos × 12 m · con su inventario»: 2 meses, total, Inv $, Inv pz. Tocar un encabezado ordena. */
function TablaSkuInv({ columnas, filas, unidad, onSku }) {
  const { theme } = useTheme();
  const [orden, setOrden] = useState({ col: 1, dir: 'desc' });
  const lista = useMemo(() => { const dir = orden.dir === 'asc' ? 1 : -1; return [...filas].sort((a, b) => (N(a.valores[orden.col]) - N(b.valores[orden.col])) * dir); }, [filas, orden]);
  const f = (i, v) => (i === 4 ? int(v) : i === 3 ? moneyCompact(v) : unidad === 'piezas' ? int(v) : moneyCompact(v));
  const th = { fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '6px 3px', textAlign: 'right', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' };
  const td = { padding: '7px 3px', textAlign: 'right', fontFamily: MONO, fontSize: 11.5, fontVariantNumeric: 'tabular-nums', borderTop: `1px solid ${theme.border}`, whiteSpace: 'nowrap' };
  return (
    <div style={{ background: theme.surface, borderRadius: 14, padding: '4px 10px 6px', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup><col style={{ width: '34%' }} />{columnas.map((c) => <col key={c} />)}</colgroup>
        <thead><tr><th style={{ ...th, textAlign: 'left', cursor: 'default', color: theme.textMuted }}>SKU</th>{columnas.map((c, i) => <th key={c} onClick={() => setOrden((o) => (o.col === i ? { col: i, dir: o.dir === 'desc' ? 'asc' : 'desc' } : { col: i, dir: 'desc' }))} style={{ ...th, color: orden.col === i ? theme.text : theme.textMuted }}>{c}{orden.col === i ? (orden.dir === 'desc' ? ' ▾' : ' ▴') : ''}</th>)}</tr></thead>
        <tbody>
          {!lista.length && <tr><td colSpan={columnas.length + 1} style={{ ...td, textAlign: 'center', fontFamily: TYPO.fontText, color: theme.textMuted }}>Sin SKUs con esos filtros.</td></tr>}
          {lista.map((r) => (
            <tr key={r.sku} onClick={onSku ? () => onSku(r.sku) : undefined} style={{ cursor: onSku ? 'pointer' : 'default' }}>
              <td style={{ ...td, textAlign: 'left', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12, color: onSku ? theme.accent : theme.text, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.sub}>{r.sku}{r.sub && <span style={{ display: 'block', fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textMuted, fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</span>}</td>
              {r.valores.map((v, i) => <td key={i} style={{ ...td, color: i === 4 && r.agotado ? theme.red : i === 4 && r.semanas != null && r.semanas < 2 ? theme.orange : v ? theme.text : theme.textMuted }}>{i === 4 && r.agotado ? '0' : v ? f(i, v) : '—'}{i === 4 && r.semanas != null && r.semanas > 0 ? <span style={{ display: 'block', fontSize: 9.5, color: theme.textMuted, fontFamily: TYPO.fontText }}>{r.semanas} sem</span> : null}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function textoSellOut({ nombre, mes, anio, fila, invValor, agotados }) {
  return [`*Acteck · Sell out ${nombre} · ${MESES[mes - 1]} ${anio}*`, `Sell out ${moneyCompact(fila.importe)} · ${int(fila.cantidad)} pz${fila.yoy != null ? ` · ${deltaPct(fila.yoy)} vs ${anio - 1}` : ''}`, invValor != null ? `Inventario en ${nombre}: ${moneyCompact(invValor)}${fila.invSemanas != null ? ` (${Math.round(fila.invSemanas)} sem)` : ''}` : null, agotados ? `${agotados} SKUs que vende están agotados` : null].filter(Boolean).join('\n');
}

/** Vista pura (SSR en pruebas). */
export function SellOutPropioVista({ ck, nombre, fila, bloques = [], anio, mes, dias = [], mensualCuenta = [], skus = [], inv = [], suc = [], ven = [], cf = [], ensambles = [], rd = new Map(), cargando = {}, onSku, onDimension, onProponer, onCompartir, hoy = new Date() }) {
  const { theme } = useTheme();
  const [unidad, setUnidad] = useState('monto');
  const [q, setQ] = useState('');
  const [verMas, setVerMas] = useState(false);
  const mesL = MESES[mes - 1];
  const campo = unidad === 'piezas' ? 'cantidad' : 'importe';
  const f = fmtDe(unidad);
  const morado = theme.purple || '#BF5AF2';
  const evol = useMemo(() => { const m = new Map(); mensualCuenta.forEach((r) => m.set(idxMes(N(r.anio), N(r.mes)), N(r[campo]))); const fin = idxMes(anio, mes); return Array.from({ length: 12 }, (_, i) => { const k = fin - 11 + i; const v = m.has(k) ? m.get(k) : null, prev = m.has(k - 12) ? m.get(k - 12) : null; return { label: `${MESES[k % 12]}${k % 12 === 0 ? ` ${String(Math.floor(k / 12)).slice(2)}` : ''}`, v, prev, anioPrev: Math.floor(k / 12) - 1, yoy: v != null && prev ? ((v - prev) / prev) * 100 : null }; }); }, [mensualCuenta, anio, mes, campo]);
  const pocoMes = anio === hoy.getFullYear() && mes === hoy.getMonth() + 1 && hoy.getDate() < 10;
  const [mAnio, mMes] = pocoMes ? (mes === 1 ? [anio - 1, 12] : [anio, mes - 1]) : [anio, mes];
  const movs = useMemo(() => ({ ...movimientos({ grupos: [
    { tipo: 'SKU', filas: skus, clave: 'sku', valor: 'importe', piezas: 'cantidad', etiqueta: (k) => rd.get(k)?.descripcion || '' },
    ...(bloques.includes('sucursales') ? [{ tipo: 'Sucursal', filas: suc, clave: 'sucursal', valor: 'importe', piezas: 'cantidad' }] : []),
    ...(bloques.includes('clientes') ? [{ tipo: 'Cliente final', filas: cf, clave: 'cliente_final', valor: 'importe', piezas: 'cantidad' }] : []),
  ], anio: mAnio, mes: mMes, top: 6 }), mesLbl: MESES[mMes - 1].toLowerCase() }), [skus, suc, cf, bloques, rd, mAnio, mMes]);
  const falta = useMemo(() => queLeFalta({ skus, inv, anio, mes, roadmap: rd, top: 10 }), [skus, inv, anio, mes, rd]);
  // Categorías como pay (Fernando 2026-10-06: la única gráfica que no es de línea, además del zoom diario).
  const catPay = useMemo(() => { const m = new Map(); skus.forEach((x) => { if (N(x.anio) !== anio || N(x.mes) > mes) return; const c = String(rd.get(x.sku)?.categoria || x.categoria || 'Sin categoría').trim() || 'Sin categoría'; m.set(c, N(m.get(c)) + N(x[campo])); }); return [...m].map(([label, v]) => ({ label, v })); }, [skus, anio, mes, campo, rd]);
  const categorias = useMemo(() => categoriasDe([...rd.values()]), [rd]);
  const filas = useMemo(() => filasSkuInv({ skus, inv, anio, mes, unidad, roadmap: rd }), [skus, inv, anio, mes, unidad, rd]);
  const interp = useMemo(() => interpretarBusqueda(q, { categorias }), [q, categorias]);
  const indices = useMemo(() => new Map(filas.map((x) => [x.sku, indiceSku(x)])), [filas]);
  const visibles = useMemo(() => { const base = interp.vacio ? filas : filas.filter((x) => coincideSku(x, interp, indices.get(x.sku))); return verMas ? base : base.slice(0, 60); }, [filas, interp, indices, verMas]);
  const sinMov = useMemo(() => (ck === 'pcel' ? sinMovimiento({ skus, inv, anio, mes, roadmap: rd }) : null), [ck, skus, inv, anio, mes, rd]);
  const clientes = useMemo(() => (bloques.includes('clientes') ? clientesFinalesDelMes(cf, anio, mes) : null), [cf, anio, mes, bloques]);
  const sucursales = useMemo(() => (bloques.includes('sucursales') ? agregarDimension(suc, 'sucursal', anio, mes) : []), [suc, anio, mes, bloques]);
  const vendedores = useMemo(() => (bloques.includes('vendedores') ? agregarDimension(ven, 'vendedor', anio, mes) : []), [ven, anio, mes, bloques]);
  const ens = useMemo(() => ({ pcs: ensambles.reduce((s, e) => s + N(e.ensambles), 0), pz: ensambles.reduce((s, e) => s + N(e.piezas), 0), monto: ensambles.reduce((s, e) => s + N(e.monto), 0), modelos: [...ensambles].sort((a, b) => N(b.ensambles) - N(a.ensambles)) }), [ensambles]);
  const invValor = fila.invValor, invPz = fila.invPiezas, sem = fila.invSemanas;
  const skusMov = new Set(skus.filter((r) => N(r.anio) === anio && N(r.mes) === mes && N(r.cantidad) > 0).map((r) => r.sku)).size;
  const mesLargo = MESES_LARGO[mes - 1];
  const frase = `Desplazó ${moneyCompact(fila.importe)} en ${mesLargo}${fila.yoy != null ? `, ${Math.abs(Math.round(fila.yoy))} % ${fila.yoy >= 0 ? 'más' : 'menos'} que en ${mesLargo} ${anio - 1}` : ''}${fila.soSi != null ? ` y ${(fila.soSi / 100).toFixed(1)} veces lo que le vendimos` : ''}; ${invValor != null ? `tiene ${compact(invValor)} en piso` : 'no reporta inventario'}${falta.agotados ? ` y ${falta.agotados} SKU${falta.agotados === 1 ? ' que vende está agotado' : 's que vende están agotados'}` : ''}.`;
  const cuarta = ck === 'digitalife'
    ? { eyebrow: `Ensambles · ${anio}`, big: ens.pcs ? `${int(ens.pcs)} PCs` : '—', sub: ens.pcs ? `${int(ens.pz)} pz nuestras · ${moneyCompact(ens.monto)} estimado` : 'sin ensambles cargados' }
    : ck === 'pcel'
      ? { eyebrow: 'SKUs sin movimiento', big: sinMov ? int(sinMov.total) : '—', sub: sinMov?.total ? `con stock y sin venta 3 meses · ${moneyCompact(sinMov.valor)}` : 'todo lo que tiene en piso se mueve', color: sinMov?.total ? theme.orange : undefined }
      : { eyebrow: `Clientes activos · ${mesL.toLowerCase()}`, big: clientes ? int(clientes.activos) : '—', sub: clientes ? `${int(clientes.nuevos)} nuevos · ${int(clientes.perdidos)} perdidos` : 'sin cliente final' };
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 20px 10px' }}>
        <span style={{ fontSize: 12, color: theme.textMuted }}>{ck === 'pcel' ? <Pill tone="orange" size="xs">valuado a lista</Pill> : `${mesL} ${anio} · todo el bloque en`}</span>
        <Segmented value={unidad} onChange={setUnidad} options={SEG} />
      </div>
      <HeroM eyebrow={`${mesL} ${anio} · último mes con datos`} frase={frase} sub={`${int(fila.cantidad)} pz · ${int(skusMov)} SKUs con movimiento · ${FUENTE[ck] || ''}`} />
      <KpiGrid data-entrada-kpis style={{ marginTop: 10 }}>
        <KpiM eyebrow={`Sell out · ${mesL.toLowerCase()}`} big={f(unidad === 'piezas' ? fila.cantidad : fila.importe)} sub={<>{fila.yoy != null ? <><span style={{ color: fila.yoy >= 0 ? theme.green : theme.red }}>{deltaPct(fila.yoy)}</span> vs {anio - 1}</> : `sin ${anio - 1}`}{fila.soSi != null ? ` · SO/SI ${(fila.soSi / 100).toFixed(1)}` : ''}</>} />
        <KpiM eyebrow={`Inventario en ${nombre.split(' ')[0]}`} big={invValor != null ? moneyCompact(invValor) : '—'} sub={invValor != null ? [sem != null ? `${Math.round(sem)} sem · ${Math.round(sem * 7)} d` : null, invPz != null ? `${int(invPz)} pz` : null].filter(Boolean).join(' · ') : 'no reporta inventario'} />
        <KpiM eyebrow="Agotados que vende" big={int(falta.agotados)} bigColor={falta.agotados > 5 ? theme.orange : falta.agotados ? theme.text : theme.green} sub={falta.agotados ? `${int(falta.riesgoMes)} pz/mes de sell out en riesgo` : 'todo lo que vende tiene stock'} />
        <KpiM eyebrow={cuarta.eyebrow} big={cuarta.big} bigColor={cuarta.color} sub={cuarta.sub} />
      </KpiGrid>

      <ZoomDiarioM titulo="Sell out por día" filas={dias.map((r) => ({ anio: r.anio, mes: r.mes, dia: r.dia, valor: r[campo] }))} anio={anio} mes={mes} formato={f} cargando={cargando.dias} hoy={hoy} />
      <Evolucion12M titulo="Sell out · 12 meses" datos={evol} unidad={unidad} anio={anio} color={morado} />
      <MovimientoM titulo="Dónde está el movimiento" movs={movs} meta={`${movs.mesLbl} vs ${movs.mesPrevLbl} · en pesos`} nota="Mayores subidas y bajadas en pesos contra el mes anterior." onSku={onSku} />

      {catPay.length > 0 && (
        <div style={{ padding: '0 16px', marginTop: 18 }}>
          <PayM titulo="Categorías" filas={catPay} formato={f} centro={`YTD ${anio}`} vacio="Sin sell out en el año." />
        </div>
      )}

      <div style={{ padding: '0 16px', marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px 6px 2px' }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: theme.text }}>Productos × 12 m · con su inventario <span style={{ color: theme.textMuted, fontWeight: 500 }}>· {filas.length}</span></span>
        </div>
        <CampoBusqueda value={q} onChange={setQ} placeholder="SKU, marca, categoría, pulgadas…" />
        <ChipsEntendido chips={interp.chips} onQuitar={(c) => setQ(quitarChip(q, c, { categorias }))} />
        <div style={{ marginTop: 8 }}>{cargando.skus ? <Skeleton h={160} r={14} /> : <TablaSkuInv columnas={colsSkuInv(anio, mes)} filas={visibles} unidad={unidad} onSku={onSku} />}</div>
        {!verMas && filas.length > 60 && <button type="button" onClick={() => setVerMas(true)} style={{ width: '100%', marginTop: 8, height: 40, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.accent, fontFamily: TYPO.fontText, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Mostrar los {filas.length}</button>}
        <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 8, lineHeight: 1.4 }}>Inv = última foto de inventario que reportó {nombre} ($ y piezas, con semanas al ritmo de 3 meses). Toca un encabezado para ordenar y un SKU para abrirlo.</div>
      </div>

      {ck === 'digitalife' && ens.modelos.length > 0 && (
        <ListaAgrupada titulo="Ensambles por modelo" meta={`${ens.modelos.length} · ${int(ens.pcs)} PCs`} style={{ marginTop: 18 }} pie="PCs que Digitalife arma con nuestros gabinetes, monitores y fuentes; las piezas ya están sumadas al sell out y el monto se estima al precio suelto del SKU.">
          {ens.modelos.slice(0, 8).map((e) => <Fila key={`${e.ensamble}-${e.sku}`} titulo={e.ensamble || e.sku} sub={[e.sku, e.descripcion].filter(Boolean).join(' · ')} valor={`${int(e.ensambles)} PCs`} valorSub={`${int(e.piezas)} pz · ${moneyCompact(e.monto)}`} chevron={false} />)}
        </ListaAgrupada>
      )}
      {ck === 'pcel' && sinMov && sinMov.total > 0 && (
        <ListaAgrupada titulo="SKUs sin movimiento" meta={`${sinMov.total} · ${moneyCompact(sinMov.valor)} en piso`} style={{ marginTop: 18 }} pie="Con stock en PCEL y sin venta en los 3 meses cerrados. Candidatos a promoción o rotación.">
          {sinMov.lista.map((x) => <Fila key={x.sku} titulo={x.sku} sub={x.descripcion || 'Sin descripción'} valor={moneyCompact(x.valor)} valorSub={`${int(x.stock)} pz`} onClick={onSku ? () => onSku(x.sku) : undefined} />)}
        </ListaAgrupada>
      )}
      {bloques.includes('sucursales') && <DimensionM titulo="Sucursales" filas={sucursales} anio={anio} mes={mes} cargando={cargando.suc} vacio="No reporta sucursales" sub={(x) => [x.vendedores ? `${int(x.vendedores)} vendedores` : null, x.skus ? `${int(x.skus)} SKUs` : null].filter(Boolean).join(' · ')} onTocar={onDimension ? (item) => onDimension('sucursal', item) : undefined} />}
      {bloques.includes('vendedores') && <DimensionM titulo="Vendedores" filas={vendedores} anio={anio} mes={mes} cargando={cargando.ven} vacio="No reporta vendedores" sub={(x) => [x.clientes ? `${int(x.clientes)} clientes` : null, x.skus ? `${int(x.skus)} SKUs` : null].filter(Boolean).join(' · ')} onTocar={onDimension ? (item) => onDimension('vendedor', item) : undefined} />}
      {bloques.includes('clientes') && clientes && (
        <ListaAgrupada titulo="Clientes finales" meta={`${int(clientes.activos)} en ${mesL.toLowerCase()} · ${int(clientes.nuevos)} nuevos · ${int(clientes.perdidos)} perdidos`} style={{ marginTop: 18 }} pie="Nuevos y perdidos contra el mes anterior.">
          {cargando.cf && <div style={{ padding: 12 }}><Skeleton h={120} r={8} /></div>}
          {!cargando.cf && !clientes.filas.length && <Vacio icon={null} titulo="Sin cliente final en este mes" style={{ padding: 16 }} />}
          {!cargando.cf && clientes.filas.filter((c) => !c.perdido).slice(0, 8).map((c) => <Fila key={c.cliente_final} titulo={c.cliente_final} sub={c.facturas ? `${int(c.facturas)} facturas` : undefined} valor={moneyCompact(c.importe)} chevron={false} pill={c.nuevo ? { tone: 'green', label: 'nuevo' } : { tone: 'gray', label: 'recurrente' }} />)}
        </ListaAgrupada>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '18px 16px 0' }}>
        {falta.total > 0 && onProponer && <BotonGrande primario icon={FileText} onClick={() => onProponer(falta.lista.map((x) => x.sku))}>Armar propuesta con lo agotado · {falta.total}</BotonGrande>}
        {onCompartir && <BotonGrande icon={Share2} onClick={onCompartir}>Compartir</BotonGrande>}
      </div>
    </>
  );
}

export default function SellOutPropio({ clienteKey: ck, nombre, anio }) {
  const nav = useNav();
  const { theme } = useTheme();
  const cuenta = ck;
  const { data: cuentas = [] } = useCuentas();
  const { data: dias = [], isLoading: lDias } = useDias(anio);
  const { data: mensual = [], isLoading: lMes } = useMensual(anio);
  const { data: cuotas = [] } = useCuotas(anio);
  const propios = useMemo(() => mensual.filter((r) => r.cuenta === cuenta && N(r.anio) === anio), [mensual, cuenta, anio]);
  const mes = useMemo(() => { const con = propios.filter((r) => N(r.importe) > 0).map((r) => N(r.mes)); if (con.length) return Math.max(...con); const u = ultimoMesConVenta(dias); return u && u.anio === anio ? u.mes : (anio === new Date().getFullYear() ? new Date().getMonth() + 1 : 12); }, [propios, dias, anio]);
  const corteDia = useMemo(() => ultimoDiaConVenta(dias, anio, mes) || 31, [dias, anio, mes]);
  const fila = useMemo(() => {
    const fl = construirFilas({ cuentas, mensual, dias, anio, mes, corteDia, cuotas }).find((x) => x.cuenta === cuenta);
    if (!fl) return null;
    const hay = (k) => propios.some((r) => r[k] != null);
    return { ...fl, sucursales: hay('sucursales') ? (fl.sucursales ?? 0) : null, vendedores: hay('vendedores') ? (fl.vendedores ?? 0) : null, clientesFinales: hay('clientes_finales') ? (fl.clientesFinales ?? 0) : null };
  }, [cuentas, mensual, dias, anio, mes, corteDia, cuotas, cuenta, propios]);
  const { bloques } = useMemo(() => (fila ? bloquesDe(cuenta, fila) : { bloques: [] }), [cuenta, fila]);
  const skuQ = useDrillSkus(cuenta, anio, !!fila);
  const invQ = useDrillInventario(cuenta, !!fila);
  const sucQ = useDrillSucursales(cuenta, anio, !!fila && bloques.includes('sucursales'));
  const venQ = useDrillVendedores(cuenta, anio, !!fila && bloques.includes('vendedores'));
  const cfQ = useDrillClientesFinales(cuenta, anio, mes, !!fila && bloques.includes('clientes'));
  const { data: ensambles = [] } = useEnsamblesModelo(ck, !!fila);
  const { data: roadmap } = useRoadmap();
  const rd = useMemo(() => { const m = new Map(); (roadmap || []).forEach((r) => m.set(r.sku, r)); return m; }, [roadmap]);
  const diasCuenta = useMemo(() => dias.filter((r) => r.cuenta === cuenta), [dias, cuenta]);
  const mensualCuenta = useMemo(() => mensual.filter((r) => r.cuenta === cuenta), [mensual, cuenta]);
  if (lDias || lMes || !fila) return <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={150} r={12} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /></div><Skeleton h={240} r={12} /></div>;
  const invRows = invQ.data || [];
  const invValor = invRows.length ? invRows.reduce((s, r) => s + N(r.valor), 0) : fila.invValor;
  const abrirSku = (sku) => nav.push(<Producto360 sku={sku} cara="sellout" />, `producto-${sku}`);
  return (
    <SellOutPropioVista ck={ck} nombre={nombre} fila={{ ...fila, invValor }} bloques={bloques} anio={anio} mes={mes} dias={diasCuenta} mensualCuenta={mensualCuenta}
      skus={skuQ.data || []} inv={invRows} suc={sucQ.data || []} ven={venQ.data || []} cf={cfQ.data || []} ensambles={ensambles} rd={rd}
      cargando={{ skus: skuQ.isLoading, suc: sucQ.isLoading, ven: venQ.isLoading, cf: cfQ.isLoading }}
      onSku={abrirSku}
      onProponer={(skus) => nav.navegar({ pagina: 'propuestas', extra: { clienteKey: ck, skus } })}
      onCompartir={async () => { const r = await compartir(textoSellOut({ nombre, mes, anio, fila: { ...fila, invValor }, invValor, agotados: queLeFalta({ skus: skuQ.data || [], inv: invRows, anio, mes }).agotados }), { titulo: `Sell out ${nombre}` }); if (r === 'share') toast.ok('Compartido'); else if (r) toast.ok('Texto copiado'); }} />
  );
}
