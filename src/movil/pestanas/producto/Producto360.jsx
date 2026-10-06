// Producto 360 (3.81.0 · 2026-10-05, aprobado por Fernando sobre el mockup 2b9599a5): UNA ficha para un SKU con tres
// caras — Sell in (quién lo compra), Sell out (quién lo desplaza) e Inventario (nuestro, en cuentas, en camino) — y
// botones conectados: Preparar propuesta (Propuestas con la canasta precargada), Compartir disponibilidad (Ficha de
// producto), Calcular precio (Estrategia de Precios con el SKU), y cuentas/clientes tocables (Análisis por cliente).
// Cálculo puro en src/modules/comercial/producto360/calculo.js. Se abre con nav.push(<Producto360 sku cara />).
import React, { useMemo, useState } from 'react';
import { Share2, Calculator, FileText, ClipboardList, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { puedeVerSensible } from '../../../lib/permisos';
import { marcaDeSku, normalizarMarca } from '../../../lib/marcas';
import { quienLoDesplaza, quienLoCompra, serieSiSo, semanasDe, mesesCerrados } from '../../../modules/comercial/producto360/calculo';
import { crearDesdeCaptura } from '../../../modules/agenda5/datos';
import { useNav } from '../../nav';
import { Cabecera, TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, Segmented, BotonGrande, Pill, Vacio, Skeleton, GraficaScrub, LeyendaScrub, toast } from '../../piezas';
import TablaAnual from '../sellout/TablaAnual';
import FichaProducto from '../../FichaProducto';
import AnalisisFicha from '../AnalisisFicha';
import { moneyCompact, int, deltaPct, MESES, N } from '../../util';
import { useProducto360 } from './datos';
import Abasto from './Abasto';

const PROPIOS = { digitalife: 'digitalife', pcel: 'pcel', dicotech: 'dicotech' };
// Cuarta cara «Abasto» (3.83.0): el S&OP de este SKU con sus propios datos (producto/Abasto.jsx).
const CARAS = [{ id: 'sellin', label: 'Sell in' }, { id: 'sellout', label: 'Sell out' }, { id: 'inventario', label: 'Inventario' }, { id: 'abasto', label: 'Abasto' }];
const fechaCorta = (iso) => { if (!iso) return '—'; const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return `${d.getDate()} ${MESES[d.getMonth()].toLowerCase()}`; };
const mesLbl = (k) => { const [a, m] = String(k).split('-').map(Number); return `${MESES[m - 1].toLowerCase()} ${String(a).slice(2)}`; };

export default function Producto360({ sku, cara: caraInicial = 'sellout' }) {
  const { theme } = useTheme();
  const nav = useNav();
  const sensible = puedeVerSensible(nav.perfil);
  const hoy = useMemo(() => new Date(), []);
  const [cara, setCara] = useState(caraInicial);
  const [unidad, setUnidad] = useState('piezas');
  const { data: d, isLoading, error } = useProducto360(sku, { hoy });
  // Mes de lectura: el mes en curso si ya tiene movimiento; si van menos de 10 días, el último cerrado.
  const anioHoy = hoy.getFullYear(), mesHoy = hoy.getMonth() + 1;
  const pocoMes = hoy.getDate() < 10;
  const [anio, mes] = pocoMes ? (mesHoy === 1 ? [anioHoy - 1, 12] : [anioHoy, mesHoy - 1]) : [anioHoy, mesHoy];
  const r = useMemo(() => {
    if (!d) return null;
    const nombresCuenta = Object.fromEntries(d.cuentas.map((c) => [c.cuenta, c.nombre]));
    const desplaza = quienLoDesplaza(d.sellout.map((x) => ({ cuenta: x.cuenta, anio: x.anio, mes: x.mes, piezas: x.cantidad, importe: x.importe })), { anio, mes, inventario: d.invCuentas, nombres: nombresCuenta });
    const compra = quienLoCompra(d.sellin.map((x) => ({ cliente: x.cliente, cliente_nombre: x.cliente_nombre, anio: x.anio, mes: x.mes, piezas: x.piezas_venta_neta, monto: x.fact_neta })), { anio, mes });
    const serie = serieSiSo(d.sellin.map((x) => ({ anio: x.anio, mes: x.mes, piezas: x.piezas_venta_neta, monto: x.fact_neta })), d.sellout.map((x) => ({ anio: x.anio, mes: x.mes, piezas: x.cantidad, monto: x.importe })), { anio, mes, campoSi: unidad === 'piezas' ? 'piezas' : 'monto', campoSo: unidad === 'piezas' ? 'piezas' : 'monto' });
    const mesK = `${anio}-${String(mes).padStart(2, '0')}`;
    const si = serie.find((x) => x.key === mesK) || { si: 0, so: 0 };
    const cerr = new Set(mesesCerrados(anioHoy, mesHoy, 3));
    const ritmoSi = d.sellin.filter((x) => cerr.has(`${x.anio}-${String(x.mes).padStart(2, '0')}`)).reduce((s, x) => s + N(x.piezas_venta_neta), 0) / 3;
    const ritmoSo = d.sellout.filter((x) => cerr.has(`${x.anio}-${String(x.mes).padStart(2, '0')}`)).reduce((s, x) => s + N(x.cantidad), 0) / 3;
    const piezasSi = d.sellin.filter((x) => N(x.anio) === anio && N(x.mes) === mes).reduce((s, x) => s + N(x.piezas_venta_neta), 0);
    const montoSi = d.sellin.filter((x) => N(x.anio) === anio && N(x.mes) === mes).reduce((s, x) => s + N(x.fact_neta), 0);
    const piezasSo = d.sellout.filter((x) => N(x.anio) === anio && N(x.mes) === mes).reduce((s, x) => s + N(x.cantidad), 0);
    const montoSo = d.sellout.filter((x) => N(x.anio) === anio && N(x.mes) === mes).reduce((s, x) => s + N(x.importe), 0);
    const invPz = N(d.inv?.inv_actual_piezas), invDisp = N(d.inv?.inv_actual_disponible), invValor = N(d.inv?.inv_actual);
    const semanas = semanasDe(invPz, ritmoSi);
    const invCuentasPz = d.invCuentas.reduce((s, x) => s + x.piezas, 0), invCuentasValor = d.invCuentas.reduce((s, x) => s + x.valor, 0);
    const semCuentas = semanasDe(invCuentasPz, ritmoSo);
    const tr = d.transito; const proximo = Array.isArray(tr?.embarques_detalle) ? [...tr.embarques_detalle].filter((e) => e.eta).sort((a, b) => String(a.eta).localeCompare(String(b.eta)))[0] : null;
    const top2 = desplaza.filter((x) => x.piezas > 0).slice(0, 2);
    const share2 = top2.reduce((s, x) => s + x.share, 0);
    const agotadas = desplaza.filter((x) => x.inv?.estado === 'agotado' && x.prevPz > 0);
    const frase = piezasSo > 0 || piezasSi > 0
      ? `${piezasSo > 0 ? `Se desplazaron ${int(piezasSo)} pz en ${desplaza.filter((x) => x.piezas > 0).length} cuenta${desplaza.filter((x) => x.piezas > 0).length === 1 ? '' : 's'}` : 'Sin sell out reportado'}${piezasSi > 0 && piezasSo > 0 ? `, ${(piezasSo / piezasSi).toFixed(1)} veces lo que facturamos` : piezasSi > 0 ? `; facturamos ${int(piezasSi)} pz` : ''}${top2.length ? `; ${top2.map((x) => x.nombre).join(' y ')} concentra${top2.length === 1 ? '' : 'n'} el ${Math.round(share2)} %` : ''}${agotadas.length ? `, y ${agotadas[0].nombre} ya se quedó sin pieza` : ''}.`
      : 'Sin movimiento en el mes.';
    const stockMeses = (() => { const a = d.stockAnio.find((x) => N(x.anio) === anioHoy), p = d.stockAnio.find((x) => N(x.anio) === anioHoy - 1); if (!a && !p) return null; const cols = [], vals = []; for (let i = 0; i < 12; i++) { const m = ((mesHoy - 12 + i) % 12 + 12) % 12; const esPrev = mesHoy - 12 + i < 0; const src = esPrev ? p : a; const arr = unidad === 'piezas' ? src?.piezas : src?.valor; cols.push(`${MESES[m]}${esPrev ? ` ${String(anioHoy - 1).slice(2)}` : ''}`); vals.push(N(arr?.[m])); } return { cols, vals }; })();
    return { desplaza, compra, serie, piezasSi, montoSi, piezasSo, montoSo, ritmoSi, invPz, invDisp, invValor, semanas, invCuentasPz, invCuentasValor, semCuentas, proximo, tr, frase, stockMeses, mesK };
  }, [d, anio, mes, anioHoy, mesHoy, unidad]);

  const desc = d?.roadmap?.descripcion || '';
  const marca = normalizarMarca(d?.roadmap?.marca) || marcaDeSku(sku) || '';
  const fmt = unidad === 'piezas' ? (v) => `${int(v)} pz` : moneyCompact;
  const abrirCliente = (codigo, nombre) => nav.push(<AnalisisFicha codigo={codigo} clienteNombre={nombre} />, `analisis-${codigo}`);
  const abrirCuenta = (cuenta) => { const c = d?.cuentas.find((x) => x.cuenta === cuenta); if (c?.erp_cliente) abrirCliente(c.erp_cliente, c.nombre); else toast.info('Esta cuenta no tiene cliente del ERP ligado.'); };
  const compartir = () => { nav.agregarSku(sku); nav.push(<FichaProducto />, 'ficha', 'inventarioGlobal'); };
  const calcular = () => nav.navegar({ pagina: 'estrategiaPrecios', extra: { sku } });
  const proponer = (clienteKey = null) => nav.navegar({ pagina: 'propuestas', extra: { skus: [sku], clienteKey } });
  const pendiente = async (nombreCliente) => { try { await crearDesdeCaptura(`Ofrecer ${sku}${desc ? ` ${desc.slice(0, 40)}` : ''} a ${nombreCliente}`, { propietario: nav.perfil?.user_id, hoy, extra: { cuando: `${anioHoy}-${String(mesHoy).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`, origen: { hilo: 'ventas', porque: `Dejó de comprar ${sku}` } } }); toast.ok('Pendiente creado en tu Agenda'); } catch (e) { toast.error(e.message || String(e)); } };

  const cabecera = (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo={sku} sub={[desc, d?.roadmap?.categoria, marca].filter(Boolean).join(' · ') || 'Producto'} /></>);
  if (error) return (<>{cabecera}<Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudo cargar el producto" sub={String(error.message || error)} /></>);
  if (isLoading || !r) return (<>{cabecera}<div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={140} r={14} /><Skeleton h={180} r={14} /><Skeleton h={200} r={14} /></div></>);

  const lblMes = `${MESES[mes - 1].toLowerCase()}${pocoMes ? ' (último cerrado)' : ''}`;
  return (
    <div style={{ paddingBottom: 24 }}>
      {cabecera}
      <div style={{ padding: '0 16px' }}><Segmented size="md" value={cara} onChange={setCara} options={CARAS} style={{ display: 'flex', width: '100%' }} /></div>
      <div style={{ padding: '10px 16px 0' }}>
        <HeroM eyebrow={`${MESES[mes - 1]} ${anio}${pocoMes ? ' · último cerrado' : ''}`} frase={r.frase}
          sub={`Sell in ${moneyCompact(r.montoSi)} · ${int(r.piezasSi)} pz · nuestro inventario ${int(r.invPz)} pz${r.proximo ? ` · en camino ${int(r.tr?.cantidad)} pz el ${fechaCorta(r.proximo.eta)}` : ''}`} />
      </div>
      <KpiGrid data-entrada-kpis style={{ marginTop: 10 }}>
        <KpiM eyebrow={`Sell out · ${MESES[mes - 1].toLowerCase()}`} big={r.piezasSo > 0 ? `${int(r.piezasSo)} pz` : '—'} sub={r.piezasSo > 0 ? moneyCompact(r.montoSo) : 'sin sell out reportado'} onClick={() => setCara('sellout')} />
        <KpiM eyebrow={`Sell in · ${MESES[mes - 1].toLowerCase()}`} big={r.piezasSi > 0 ? `${int(r.piezasSi)} pz` : '—'} sub={r.piezasSi > 0 ? `${moneyCompact(r.montoSi)} · ${r.compra.compran.length} cliente${r.compra.compran.length === 1 ? '' : 's'}` : 'sin facturación'} onClick={() => setCara('sellin')} />
        <KpiM eyebrow="Inventario Acteck" big={`${int(r.invPz)} pz`} sub={r.semanas != null ? `${r.semanas} sem al ritmo de sell in${r.proximo ? ` · llega ${fechaCorta(r.proximo.eta)}` : ''}` : (r.proximo ? `llega ${fechaCorta(r.proximo.eta)}` : 'sin ritmo de venta')} bigColor={r.invPz <= 0 ? theme.red : r.semanas != null && r.semanas < 2 ? theme.orange : undefined} onClick={() => setCara('inventario')} />
        <KpiM eyebrow="En cuentas" big={d.invCuentas.length ? `${int(r.invCuentasPz)} pz` : '—'} sub={d.invCuentas.length ? `${r.semCuentas != null ? `${r.semCuentas} sem · ` : ''}${d.invCuentas.length} cuenta${d.invCuentas.length === 1 ? '' : 's'} reportan` : 'ninguna cuenta reporta inventario'} onClick={() => setCara('sellout')} />
      </KpiGrid>

      <div style={{ padding: '0 16px', marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px 6px 2px' }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: theme.text }}>Sell in vs sell out · 12 m</span>
          <Segmented value={unidad} onChange={setUnidad} options={[{ id: 'piezas', label: 'Piezas' }, { id: 'monto', label: '$' }]} />
        </div>
        <div style={{ background: theme.surface, borderRadius: 14, padding: '10px 10px 6px' }}>
          <GraficaScrub series={[{ key: 'si', label: 'Sell in', color: theme.accent, area: true }, { key: 'so', label: 'Sell out', color: theme.purple || '#BF5AF2' }]}
            datos={r.serie.map((x) => ({ label: x.label, si: x.si, so: x.so }))} formato={fmt}
            tooltip={(f) => <><b style={{ fontSize: 12.5 }}>{f.label}</b> · sell in <b style={{ fontSize: 12.5 }}>{fmt(f.si)}</b> · sell out {fmt(f.so)}{f.si > 0 ? ` · SO/SI ${(f.so / f.si).toFixed(2)}` : ''}</>} />
          <LeyendaScrub items={[{ color: theme.accent, label: 'Sell in' }, { color: theme.purple || '#BF5AF2', label: 'Sell out' }]} derecha="Arrastra para leer" />
        </div>
      </div>

      {cara === 'sellout' && (
        <>
          <ListaAgrupada titulo="Quién lo desplaza" meta={`${lblMes} · ${r.desplaza.filter((x) => x.piezas > 0).length}`} style={{ marginTop: 18 }} pie="Piezas del mes, cambio contra el mes anterior y semanas de inventario en cada cuenta. Toca una cuenta para abrirla en Análisis por cliente.">
            {r.desplaza.length === 0 && <Vacio icon={null} titulo="Ninguna cuenta lo reporta" style={{ padding: '18px 16px' }} />}
            {r.desplaza.slice(0, 12).map((x) => (
              <Fila key={x.cuenta} titulo={x.nombre} sub={x.inv ? <span>inventario <Pill tone={x.inv.estado === 'agotado' ? 'red' : x.inv.estado === 'riesgo' ? 'orange' : x.inv.estado === 'sobre' ? 'purple' : 'green'} size="xs">{x.inv.estado === 'agotado' ? 'agotado' : x.inv.semanas != null ? `${x.inv.semanas} sem` : `${int(x.inv.piezas)} pz`}</Pill></span> : 'no reporta inventario'}
                valor={x.piezas > 0 ? `${int(x.piezas)} pz` : '0 pz'} valorSub={x.deltaPz != null ? `${deltaPct(x.deltaPz)} vs mes ant.` : x.prevPz > 0 ? 'nuevo' : undefined} onClick={() => abrirCuenta(x.cuenta)} />
            ))}
          </ListaAgrupada>
          {r.desplaza.some((x) => x.inv?.estado === 'agotado' && (x.prevPz > 0 || x.piezas > 0)) && (
            <div style={{ margin: '12px 16px 0', fontSize: 12.5, color: theme.orange, lineHeight: 1.4 }}>
              {r.desplaza.filter((x) => x.inv?.estado === 'agotado' && (x.prevPz > 0 || x.piezas > 0)).map((x) => x.nombre).join(', ')} lo {r.desplaza.filter((x) => x.inv?.estado === 'agotado').length === 1 ? 'mueve' : 'mueven'} y ya no tiene{r.desplaza.filter((x) => x.inv?.estado === 'agotado').length === 1 ? '' : 'n'} pieza: ahí hay resurtido.
            </div>
          )}
        </>
      )}

      {cara === 'sellin' && (
        <>
          <ListaAgrupada titulo="Quién lo compra" meta={`${lblMes} · ${r.compra.compran.length}`} style={{ marginTop: 18 }} pie="Piezas del mes, cambio contra el mes anterior y meses seguidos comprándolo. Toca un cliente para abrirlo.">
            {r.compra.compran.length === 0 && <Vacio icon={null} titulo="Nadie lo compró en el mes" style={{ padding: '18px 16px' }} />}
            {r.compra.compran.slice(0, 12).map((x) => (
              <Fila key={x.cliente} titulo={x.nombre} sub={`${x.mesesSeguidos} mes${x.mesesSeguidos === 1 ? '' : 'es'} seguido${x.mesesSeguidos === 1 ? '' : 's'} · ${moneyCompact(x.monto)}`}
                valor={`${int(x.piezas)} pz`} valorSub={x.deltaPz != null ? `${deltaPct(x.deltaPz)} vs mes ant.` : 'nuevo'} onClick={() => abrirCliente(x.cliente, x.nombre)} />
            ))}
          </ListaAgrupada>
          <ListaAgrupada titulo="Dejaron de comprarlo" meta={String(r.compra.dejaron.length)} style={{ marginTop: 18 }} pie="Compraban y llevan 6 meses sin pedirlo. «Proponer» abre una propuesta si es cliente propio; si no, crea el pendiente en tu Agenda.">
            {r.compra.dejaron.length === 0 && <Vacio icon={null} titulo="Nadie lo ha dejado de comprar" style={{ padding: '18px 16px' }} />}
            {r.compra.dejaron.slice(0, 10).map((x) => {
              const cuentaPropia = d.cuentas.find((c) => c.erp_cliente === x.cliente && PROPIOS[c.cuenta]);
              return <Fila key={x.cliente} titulo={x.nombre} sub={`última compra ${mesLbl(x.ultimaCompra)} · ${int(x.piezasUltima)} pz · ${int(x.piezas12m)} pz en 12 m`} chevron={false}
                trailing={<button type="button" onClick={(e) => { e.stopPropagation(); if (cuentaPropia) proponer(cuentaPropia.cuenta); else pendiente(x.nombre); }} style={{ border: 0, borderRadius: 999, padding: '6px 11px', background: `${theme.accent}1f`, color: theme.accent, fontFamily: TYPO.fontText, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Proponer</button>}
                onClick={() => abrirCliente(x.cliente, x.nombre)} />;
            })}
          </ListaAgrupada>
        </>
      )}

      {cara === 'inventario' && (
        <>
          <ListaAgrupada titulo="Nuestro inventario" meta={`${int(r.invPz)} pz`} style={{ marginTop: 18 }}>
            <Fila titulo="Disponible" sub="en almacenes comerciales" valor={`${int(r.invDisp)} pz`} chevron={false} alto={46} />
            {sensible && <Fila titulo="Valor a costo promedio" sub={d.inv?.costo_promedio ? `$${Math.round(N(d.inv.costo_promedio)).toLocaleString('es-MX')} por pieza` : undefined} valor={moneyCompact(r.invValor)} chevron={false} alto={46} />}
            <Fila titulo="Cobertura" sub={r.ritmoSi > 0 ? `ritmo ${int(r.ritmoSi)} pz/mes de sell in` : 'sin ritmo de venta'} valor={r.semanas != null ? `${r.semanas} sem` : '—'} chevron={false} alto={46} tono={r.semanas != null && r.semanas < 2 ? theme.red : undefined} />
            <Fila titulo="En camino" sub={r.proximo ? `próximo ${fechaCorta(r.proximo.eta)} · PO ${r.proximo.po}${r.proximo.estatus ? ` · ${String(r.proximo.estatus).toLowerCase()}` : ''}` : 'nada en camino'} valor={r.tr ? `${int(r.tr.cantidad)} pz` : '—'} chevron={false} alto={46} />
          </ListaAgrupada>
          {d.almacenes.length > 0 && (
            <div style={{ margin: '14px 16px 0' }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: theme.text, padding: '0 2px 6px' }}>Por almacén <span style={{ color: theme.textMuted, fontWeight: 500 }}>· {d.almacenes.length}</span></div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
                {[...d.almacenes].sort((a, b) => N(b.inventario) - N(a.inventario)).map((a) => (
                  <div key={a.no_almacen} style={{ flex: '0 0 auto', minWidth: 120, background: theme.surface, borderRadius: 12, padding: '10px 12px', opacity: a.en_inv_actual ? 1 : 0.6 }}>
                    <div style={{ fontSize: 10.5, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>{a.no_almacen} · {a.almacen_nombre || 'almacén'}</div>
                    <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{int(a.inventario)} pz</div>
                    <div style={{ fontSize: 10.5, color: theme.textMuted }}>{int(a.disponible)} disp.{a.en_inv_actual ? '' : ' · fuera de Inv Actual'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {d.invCuentas.length > 0 && (
            <ListaAgrupada titulo="En cuentas" meta={`${int(r.invCuentasPz)} pz`} style={{ marginTop: 18 }} pie="Última foto de inventario que reportó cada cuenta.">
              {[...d.invCuentas].sort((a, b) => b.piezas - a.piezas).map((x) => <Fila key={x.cuenta} titulo={d.cuentas.find((c) => c.cuenta === x.cuenta)?.nombre || x.cuenta} sub={`semana ${x.semana} · ${moneyCompact(x.valor)}`} valor={`${int(x.piezas)} pz`} onClick={() => abrirCuenta(x.cuenta)} />)}
            </ListaAgrupada>
          )}
          {r.stockMeses && (
            <div style={{ margin: '18px 16px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px 6px' }}><span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: theme.text }}>Stock al cierre · 12 m</span><Segmented value={unidad} onChange={setUnidad} options={[{ id: 'piezas', label: 'Piezas' }, { id: 'monto', label: '$' }]} /></div>
              <TablaAnual columnas={r.stockMeses.cols} filas={[{ label: sku, sub: 'al cierre de mes', valores: r.stockMeses.vals }]} fmt={unidad === 'piezas' ? int : moneyCompact} conTotalCol={false} conTotalFila={false} conProm={false} />
            </div>
          )}
        </>
      )}

      {cara === 'abasto' && <Abasto sku={sku} sensible={sensible} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '18px 16px 0' }}>
        <BotonGrande primario icon={FileText} onClick={() => proponer(null)}>Preparar propuesta</BotonGrande>
        <div style={{ display: 'flex', gap: 8 }}>
          <BotonGrande icon={Share2} onClick={compartir}>Compartir</BotonGrande>
          <BotonGrande icon={Calculator} onClick={calcular}>Calcular precio</BotonGrande>
        </div>
        {d.precios.length > 0 && <div style={{ fontSize: 11.5, color: theme.textMuted, textAlign: 'center' }}>{d.precios.slice(0, 3).map((p) => `${p.lista} $${Math.round(N(p.precio)).toLocaleString('es-MX')}`).join(' · ')}</div>}
      </div>
    </div>
  );
}
