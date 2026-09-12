// Una cuenta del Sell Out consolidado en el celular (pantalla empujada desde la lista).
//
// Pestañas (sólo las que la fuente de ESA cuenta trae — misma regla de disponibilidad que la web):
//   Resumen · SKUs · Inventario · Sucursales · Clientes finales · Estados
//
// Los datos son los mismos hooks del drill de la web (src/modules/comercial/sellout/datos.js):
// cada pestaña pide lo suyo sólo cuando se abre y siempre acotado a esta cuenta.
// El mapa de México no se monta en el celular: los estados van como lista con su %.
// NADA sensible: venta, piezas, inventario, cobertura y dimensiones del mayorista.
import React, { useMemo, useState } from 'react';
import { Share2, Copy, ArrowUpRight, PackageSearch } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Cargando, GraficaLineas } from '../../../components/kit';
import { disponibilidadDeCampos } from '../../../lib/disponibilidad';
import { compartir, copiar } from '../../../lib/whatsapp';
import { useNav } from '../../nav';
import {
  TituloGrande, Cabecera, ListaAgrupada, Fila, Vacio, HojaM, BotonGrande, CampoBusqueda, Pill, HeatCell, toast,
} from '../../piezas';
import { moneyCompact, int, deltaPct, tonoDelta, MESES, MESES_LARGO, MONO } from '../../util';
import TablaAnual from '../sellout/TablaAnual';
import {
  useDrillSkus, useDrillInventario, useDrillInventarioMes, useDrillSucursales,
  useDrillVendedores, useDrillClientesFinales, useDrillEstados, CUENTA_POR_CLIENTE,
} from '../../../modules/comercial/sellout/datos';
import {
  skusDeCuenta, alertasDeCuenta, porEstado, agregarDimension, clientesFinalesDelMes,
  ritmoProyectado, ultimosMeses, idxMes, N as Nc,
} from '../../../modules/comercial/sellout/calculo';
import {
  fmtMoney, fmtInt, fmtPct, capitalizarEstado, textoEstatusCuenta,
} from '../../../modules/comercial/sellout/textos';
import { TabsScroll, CajaDatos, Dato, Fuente } from './piezas';

const CLIENTE_POR_CUENTA = Object.fromEntries(Object.entries(CUENTA_POR_CLIENTE).map(([k, v]) => [v, k]));
const norm = (s) => String(s || '').toUpperCase();

export default function Cuenta({ fila, anio, mes, corteDia }) {
  const { theme } = useTheme();
  const nav = useNav();
  const cuenta = fila.cuenta;
  const [tab, setTab] = useState('resumen');
  const [q, setQ] = useState('');
  const [compartiendo, setCompartiendo] = useState(false);
  const [skuAbierto, setSkuAbierto] = useState(null);   // ficha del SKU como hoja desde abajo (igual que Sell Out de cliente propio)

  const skuQ = useDrillSkus(cuenta, anio, tab === 'resumen' || tab === 'skus');
  const invQ = useDrillInventario(cuenta, tab === 'resumen' || tab === 'skus' || tab === 'inventario');
  const invMesQ = useDrillInventarioMes(cuenta, tab === 'inventario');
  const sucQ = useDrillSucursales(cuenta, anio, tab === 'sucursales');
  const venQ = useDrillVendedores(cuenta, anio, tab === 'sucursales');
  const cfQ = useDrillClientesFinales(cuenta, anio, mes, tab === 'clientes');
  const edoQ = useDrillEstados(cuenta, anio, mes, tab === 'estados');

  const inv = invQ.data || [];
  const campos = useMemo(() => disponibilidadDeCampos(cuenta, inv, ['stock', 'valor', 'dias_sin_venta', 'fecha_ultima_venta'], { soloUltimaSemana: false }), [cuenta, inv]);
  const skus = useMemo(() => skusDeCuenta(skuQ.data || [], inv, anio, mes, 'piezas'), [skuQ.data, inv, anio, mes]);
  const alertas = useMemo(() => alertasDeCuenta(skus, campos.hay('dias_sin_venta')), [skus, campos]);
  const estados = useMemo(() => porEstado(edoQ.data || [], anio, mes), [edoQ.data, anio, mes]);

  // Qué pestañas existen para ESTA cuenta (la fuente manda; si no trae el dato, no hay pestaña).
  const pestanas = useMemo(() => {
    const out = [{ id: 'resumen', label: 'Resumen' }, { id: 'skus', label: 'SKUs' }];
    if (fila.invValor != null) out.push({ id: 'inventario', label: 'Inventario' });
    if (fila.sucursales != null || fila.vendedores != null) out.push({ id: 'sucursales', label: 'Sucursales' });
    if (fila.clientesFinales != null) out.push({ id: 'clientes', label: 'Clientes finales' });
    if (fila.estados > 0) out.push({ id: 'estados', label: 'Estados' });
    return out;
  }, [fila]);
  const activa = pestanas.some((p) => p.id === tab) ? tab : 'resumen';

  const clienteKey = CLIENTE_POR_CUENTA[cuenta];
  const irACliente = () => nav.navegar({ clienteKey, pagina: 'estrategia' });

  const texto = useMemo(() => textoEstatusCuenta({
    fila, anio, mes, corteDia: corteDia < 28 ? corteDia : null,
    topSkus: skus.filter((s) => s.mesActual > 0), alertas, estados,
  }), [fila, anio, mes, corteDia, skus, alertas, estados]);
  const onCompartir = async () => { if (await compartir(texto, { titulo: `${fila.nombre} · Sell Out` }) === 'share') toast.ok('Compartido'); };
  const onCopiar = async () => { if (await copiar(texto)) toast.ok('Estatus copiado'); else toast.error('No se pudo copiar'); };

  const meses12 = useMemo(() => ultimosMeses(anio, mes, 12), [anio, mes]);
  const hayInv = fila.invValor != null || inv.length > 0;
  const periodo = `${MESES[mes - 1]} ${anio}${corteDia < 28 ? ` · al día ${corteDia}` : ''} · sin IVA`;

  return (
    <>
      <Cabecera onVolver={nav.pop} etiqueta="Sell Out" />
      <TituloGrande titulo={fila.nombre} sub={`${fila.erp ? `Nº ${fila.erp} · ` : ''}${periodo}`} />

      <TabsScroll opciones={pestanas} valor={activa} onChange={setTab} style={{ marginBottom: 14 }} />

      {activa === 'resumen' && (
        <Resumen fila={fila} anio={anio} mes={mes} corteDia={corteDia} skus={skus} alertas={alertas}
          campos={campos} hayInv={hayInv} cargando={skuQ.isLoading || invQ.isLoading}
          onSku={(s) => setSkuAbierto(s.sku)} />
      )}

      {activa === 'skus' && (
        skuQ.isLoading ? <Cargando pantalla="sellInDrill" minHeight={220} /> : (
          <TabSkus skus={skus} meses12={meses12} anio={anio} hayInv={hayInv} q={q} setQ={setQ}
            onSku={(s) => setSkuAbierto(s.sku)} />
        )
      )}

      {activa === 'inventario' && (
        invQ.isLoading ? <Cargando pantalla="sellInDrill" minHeight={220} /> : (
          <TabInventario inv={inv} porMes={invMesQ.data || []} campos={campos} />
        )
      )}

      {activa === 'sucursales' && (
        sucQ.isLoading || venQ.isLoading ? <Cargando pantalla="sellInDrill" minHeight={220} /> : (
          <TabSucursales sucursales={sucQ.data || []} vendedores={venQ.data || []} anio={anio} mes={mes} />
        )
      )}

      {activa === 'clientes' && (
        cfQ.isLoading ? <Cargando pantalla="sellInDrill" minHeight={220} /> : (
          <TabClientes filas={cfQ.data || []} fila={fila} anio={anio} mes={mes} />
        )
      )}

      {activa === 'estados' && (
        edoQ.isLoading ? <Cargando pantalla="sellInDrill" minHeight={220} /> : (
          <TabEstados estados={estados} mes={mes} />
        )
      )}

      <div style={{ padding: '18px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <BotonGrande primario icon={Share2} onClick={() => setCompartiendo(true)}>Compartir estatus</BotonGrande>
        {clienteKey && <BotonGrande icon={ArrowUpRight} onClick={irACliente}>Ir a {fila.nombre.split(' ')[0]} › Sell Out</BotonGrande>}
      </div>

      <Fuente>
        Sell out sin IVA por cuenta y mes (<span style={{ fontFamily: MONO }}>mv_sellout_cuenta_sku_mes</span>) ·
        dimensiones del ERP del mayorista · inventario en casa del cliente de{' '}
        <span style={{ fontFamily: MONO }}>v_sellout_inventario_cuenta_sku</span>. Sólo aparecen las pestañas
        cuyo dato manda la fuente de esta cuenta.
      </Fuente>

      {/* Ficha del SKU en hoja desde abajo: no se sale de la cuenta */}
      <HojaM abierto={!!skuAbierto} onClose={() => setSkuAbierto(null)} titulo={skuAbierto || ''} sub={fila.nombre} alto="82vh">
        {skuAbierto && <FichaSku sku={skuAbierto} fila={fila} skus={skus} meses12={meses12} anio={anio} hayInv={hayInv} onCerrar={() => setSkuAbierto(null)} />}
      </HojaM>

      <HojaM abierto={compartiendo} onClose={() => setCompartiendo(false)} titulo="Estatus de la cuenta" sub={`${fila.nombre} · ${MESES_LARGO[mes - 1]} ${anio}`} alto="78vh">
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <pre style={{ margin: 0, padding: '12px 14px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, fontFamily: MONO, fontSize: 12, lineHeight: 1.5, color: theme.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{texto}</pre>
          <BotonGrande primario icon={Share2} onClick={onCompartir}>Compartir por WhatsApp</BotonGrande>
          <BotonGrande icon={Copy} onClick={onCopiar}>Copiar texto</BotonGrande>
        </div>
      </HojaM>
    </>
  );
}

// ── Resumen ───────────────────────────────────────────────────────────────────
function Resumen({ fila, anio, mes, corteDia, skus, alertas, campos, hayInv, cargando, onSku }) {
  const { theme } = useTheme();
  if (cargando) return <Cargando pantalla="sellInDrill" minHeight={260} />;

  const proyeccion = ritmoProyectado(fila.importe, corteDia, anio, mes);
  const serie = fila.serie12.map((p) => ({
    x: p.x, sellOut: p.importe,
    sellIn: p.sellIn == null ? null : Number(p.sellIn),
    inv: hayInv && p.inv != null ? Number(p.inv) : null,
  }));
  const series = [
    { key: 'sellOut', label: 'Sell out', tipo: 'principal' },
    { key: 'sellIn', label: 'Sell in', tipo: 'anterior' },
    ...(hayInv ? [{ key: 'inv', label: 'Inventario', tipo: 'linea', color: theme.orange }] : []),
  ];
  const top = skus.filter((s) => s.mesActual > 0).slice(0, 8);
  const maxTop = Math.max(0, ...top.map((s) => s.mesActual));

  return (
    <>
      <CajaDatos cols={2}>
        <Dato k={`Sell out · ${MESES[mes - 1]}`} v={fmtMoney(fila.importe)}
          sub={`${fmtInt(fila.cantidad)} pz${fila.yoy == null ? '' : ` · ${deltaPct(fila.yoy)} YoY`}`} />
        <Dato k="Sell out / sell in" v={fila.soSi == null ? '—' : fmtPct(fila.soSi)}
          sub={fila.sellIn == null || fila.sellIn <= 0 ? 'sin sell in en el mes' : `sell in ${fmtMoney(fila.sellIn)}`}
          color={fila.soSi != null && fila.soSi < 60 ? theme.orange : undefined} />
        {/* Cuota de sell in del mes (RevkoBi por cliente del ERP); sin cuota cargada no se pinta. */}
        {fila.cuota != null && (
          <Dato k={`Cuota sell in · ${MESES[mes - 1]}`} v={fmtPct(fila.pctCuota)}
            sub={fila.faltaCuota > 0 ? `faltan ${fmtMoney(fila.faltaCuota)} de ${fmtMoney(fila.cuota)}` : `${fmtMoney(-fila.faltaCuota)} arriba de ${fmtMoney(fila.cuota)}`}
            color={fila.pctCuota >= 100 ? theme.green : fila.pctCuota >= 85 ? undefined : theme.orange} />
        )}
        {hayInv && (
          <Dato k="Inventario del cliente" v={fmtMoney(fila.invValor)}
            sub={`${fmtInt(fila.invPiezas)} pz · ${fmtInt(fila.invSkus)} SKUs`} />
        )}
        {hayInv && (
          <Dato k="Cobertura" v={fila.invSemanas == null ? '—' : `${fila.invSemanas.toFixed(1)} sem`}
            sub="al ritmo de los últimos 3 meses"
            color={fila.invSemanas != null && (fila.invSemanas < 3 || fila.invSemanas > 12) ? theme.orange : undefined} />
        )}
        {!hayInv && proyeccion != null && corteDia < 28 && (
          <Dato k="Ritmo del mes" v={fmtMoney(proyeccion)} sub={`proyección al día ${corteDia}`} />
        )}
        {!hayInv && (!proyeccion || corteDia >= 28) && (
          <Dato k={`YTD ${anio}`} v={fmtMoney(fila.ytd)} sub={fila.yoyYtd == null ? 'sin comparativo' : `${deltaPct(fila.yoyYtd)} vs ${anio - 1}`} />
        )}
      </CajaDatos>

      {(alertas.sinStockConVenta > 0 || (campos.hay('dias_sin_venta') && alertas.sinVenta30 > 0)) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '12px 16px 0' }}>
          {alertas.sinStockConVenta > 0 && <Pill tone="orange" size="sm">{fmtInt(alertas.sinStockConVenta)} SKUs con venta y sin stock</Pill>}
          {campos.hay('dias_sin_venta') && alertas.sinVenta30 > 0 && <Pill tone="red" size="sm">{fmtInt(alertas.sinVenta30)} SKUs sin venta 30+ d</Pill>}
        </div>
      )}

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 6 }}>
            Evolución 12 meses{hayInv ? ' · sell out, sell in e inventario' : ' · sell out y sell in'}
          </div>
          <GraficaLineas compacto alto={165} datos={serie} series={series} formato={moneyCompact} />
        </div>
      </div>

      <ListaAgrupada titulo={`Top SKUs · ${MESES[mes - 1]}`} meta={`${skus.length}`} style={{ marginTop: 18 }}
        pie={hayInv ? 'Celda = piezas del mes · stock y semanas de cobertura del inventario del cliente. Toca un SKU para su ficha.' : 'Celda = piezas del mes. Toca un SKU para su ficha.'}>
        {top.length === 0 && <Vacio icon={null} titulo="Sin SKUs con venta este mes" style={{ padding: 18 }} />}
        {top.map((s) => (
          <Fila key={s.sku}
            titulo={<span style={{ fontFamily: TYPO.fontDisplay }}>{s.sku}</span>}
            sub={[s.marca, hayInv ? (s.stock == null ? 'sin stock reportado' : `stock ${int(s.stock)}${s.semanas != null ? ` · ${s.semanas.toFixed(1)} sem` : ''}`) : null].filter(Boolean).join(' · ')}
            trailing={<HeatCell v={s.mesActual} max={maxTop} fmt={fmtInt} />}
            onClick={() => onSku(s)} style={{ gap: 8 }} />
        ))}
      </ListaAgrupada>
    </>
  );
}

// ── SKUs ──────────────────────────────────────────────────────────────────────
function TabSkus({ skus, meses12, anio, hayInv, q, setQ, onSku }) {
  const { theme } = useTheme();
  const filtrados = useMemo(() => {
    const t = norm(q).trim();
    if (!t) return skus;
    return skus.filter((s) => norm(s.sku).includes(t) || norm(s.marca).includes(t) || norm(s.categoria).includes(t));
  }, [skus, q]);
  const columnas = meses12.map((m) => `${MESES[m.mes - 1]}${m.anio !== anio ? ` ${String(m.anio).slice(2)}` : ''}`);
  const filas = filtrados.slice(0, 60).map((s) => ({
    label: s.sku,
    sub: [s.marca, hayInv && s.stock != null ? `stock ${int(s.stock)}${s.semanas != null ? ` · ${s.semanas.toFixed(1)} sem` : ''}` : null].filter(Boolean).join(' · '),
    valores: s.meses,
  }));
  return (
    <>
      <div style={{ padding: '0 16px 12px' }}>
        <CampoBusqueda value={q} onChange={setQ} placeholder="Buscar un SKU (código, marca, categoría)" />
      </div>
      <div style={{ padding: '0 16px' }}>
        <TablaAnual columnas={columnas} filas={filas} fmt={fmtInt} etiquetaFilas={`${filtrados.length} SKUs`}
          vacio="Sin SKUs con venta en los últimos 12 meses." />
        <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '6px 12px 0', lineHeight: 1.4 }}>
          Piezas por mes (12 meses) · <strong>Prom</strong> = promedio de los meses con venta · <strong>Total</strong> = suma de la fila.
          {filtrados.length > 60 && ` Se muestran los 60 SKUs más vendidos de ${filtrados.length}; usa el buscador para el resto.`}
        </div>
      </div>
      <ListaAgrupada titulo="Abrir un SKU" meta={`${Math.min(filtrados.length, 30)}`} style={{ marginTop: 18 }}
        pie="Ficha del SKU dentro de esta cuenta: 12 meses, stock y cobertura.">
        {filtrados.slice(0, 30).map((s) => (
          <Fila key={s.sku} titulo={<span style={{ fontFamily: TYPO.fontDisplay }}>{s.sku}</span>}
            sub={[s.marca, s.categoria].filter(Boolean).join(' · ') || undefined}
            valor={fmtInt(s.mesActual)} valorSub="pz del mes" onClick={() => onSku(s)} />
        ))}
        {filtrados.length === 0 && <Vacio icon={null} titulo="Sin coincidencias" style={{ padding: 18 }} />}
      </ListaAgrupada>
    </>
  );
}

/** Ficha de un SKU dentro de UNA cuenta, en hoja desde abajo (usa lo que ya cargó la pantalla: nada extra que pedir). */
function FichaSku({ sku, fila, skus, meses12, anio, hayInv, onCerrar }) {
  const { theme } = useTheme();
  const nav = useNav();
  const s = skus.find((x) => x.sku === sku);
  if (!s) return <Vacio icon={null} titulo="SKU sin datos" />;
  const columnas = meses12.map((m) => `${MESES[m.mes - 1]}${m.anio !== anio ? ` ${String(m.anio).slice(2)}` : ''}`);
  return (
    <div style={{ padding: '4px 0 16px' }}>
      <div style={{ padding: '0 16px 10px', fontSize: 12.5, color: theme.textMuted }}>{[s.marca, s.categoria].filter(Boolean).join(' · ') || 'Sin marca ni categoría'}</div>
      <CajaDatos cols={hayInv ? 3 : 2}>
        <Dato k="Piezas 12 m" v={fmtInt(s.total)} sub={`prom ${fmtInt(s.prom)} / mes`} />
        <Dato k="Piezas del mes" v={fmtInt(s.mesActual)} sub={s.mesActual ? 'con venta' : 'sin venta este mes'} />
        {hayInv && (
          <Dato k="Stock del cliente" v={s.stock == null ? '—' : fmtInt(s.stock)}
            sub={s.semanas == null ? (s.stock === 0 ? 'sin stock' : 'sin ritmo') : `${s.semanas.toFixed(1)} sem`}
            color={s.stock === 0 ? theme.red : undefined} />
        )}
      </CajaDatos>
      <div style={{ padding: '18px 16px 0' }}>
        <TablaAnual columnas={columnas} filas={[{ label: 'Piezas', sub: '12 meses', valores: s.meses }]} fmt={fmtInt}
          etiquetaFilas="" conTotalFila={false} />
        <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '6px 12px 0', lineHeight: 1.4 }}>
          Piezas de sell out de {fila.nombre} · <strong>Prom</strong> = promedio de los meses con venta.
          {s.diasSinVenta != null && ` Lleva ${int(s.diasSinVenta)} días sin venta en su piso.`}
        </div>
      </div>
      <div style={{ padding: '18px 16px 0' }}>
        <BotonGrande icon={PackageSearch} onClick={() => { onCerrar?.(); nav.agregarSku(sku); nav.navegar({ pagina: 'inventarioGlobal' }); }}>Ver disponibilidad</BotonGrande>
      </div>
    </div>
  );
}

// ── Inventario ────────────────────────────────────────────────────────────────
function TabInventario({ inv, porMes, campos }) {
  const { theme } = useTheme();
  const lista = useMemo(() => [...inv].sort((a, b) => Nc(b.valor) - Nc(a.valor)).slice(0, 60), [inv]);
  const meses = useMemo(() => [...porMes].sort((a, b) => idxMes(Nc(a.anio), Nc(a.mes)) - idxMes(Nc(b.anio), Nc(b.mes))), [porMes]);
  const semana = inv[0]?.semana ? `${inv[0].anio}-W${String(inv[0].semana).padStart(2, '0')}` : null;
  return (
    <>
      <ListaAgrupada titulo="Última foto por SKU" meta={semana || `${lista.length}`}
        pie="Stock en piso del cliente en la última semana cargada, ordenado por valor.">
        {lista.length === 0 && <Vacio icon={null} titulo="Este cliente no reporta inventario" style={{ padding: 18 }} />}
        {lista.map((x) => (
          <Fila key={x.sku} titulo={<span style={{ fontFamily: TYPO.fontDisplay }}>{x.sku}</span>}
            sub={[x.titulo || x.marca, campos.hay('dias_sin_venta') && x.dias_sin_venta != null ? `${int(x.dias_sin_venta)} d sin venta` : null].filter(Boolean).join(' · ') || undefined}
            valor={`${int(x.stock)} pz`} valorSub={campos.hay('valor') ? moneyCompact(x.valor) : undefined}
            chevron={false}
            pill={Nc(x.dias_sin_venta) >= 30 ? { tone: 'orange', label: 'sin rotación' } : undefined} />
        ))}
      </ListaAgrupada>

      <div style={{ padding: '18px 16px 0' }}>
        <TablaAnual columnas={meses.map((m) => `${MESES[Nc(m.mes) - 1]} ${String(m.anio).slice(2)}`)}
          filas={meses.length ? [
            { label: 'Piezas', sub: 'al cierre de mes', valores: meses.map((m) => Nc(m.piezas)), promMeses: meses.length },
            { label: 'SKUs con stock', sub: '', valores: meses.map((m) => Nc(m.skus_con_stock)), promMeses: meses.length },
          ] : []}
          fmt={fmtInt} etiquetaFilas="" conTotalCol={false} conTotalFila={false}
          vacio="Sin fotos de inventario por mes." />
        <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '6px 12px 0', lineHeight: 1.4 }}>
          Stock al cierre de cada mes (última semana ISO cuyo jueves cae en ese mes). Es un saldo, no un flujo: no hay Total.
        </div>
      </div>
    </>
  );
}

// ── Sucursales y vendedores ───────────────────────────────────────────────────
function TabSucursales({ sucursales, vendedores, anio, mes }) {
  const suc = useMemo(() => agregarDimension(sucursales, 'sucursal', anio, mes), [sucursales, anio, mes]);
  const ven = useMemo(() => agregarDimension(vendedores, 'vendedor', anio, mes), [vendedores, anio, mes]);
  return (
    <>
      <ListaAgrupada titulo={`Sucursales · ${MESES[mes - 1]}`} meta={`${suc.length}`}
        pie="Monto del mes por sucursal, su YoY, cuántos vendedores tuvieron venta y quién vendió más.">
        {suc.length === 0 && <Vacio icon={null} titulo="Esta cuenta no reporta sucursales" style={{ padding: 18 }} />}
        {suc.slice(0, 40).map((x) => (
          <Fila key={x.clave} titulo={x.clave}
            sub={[`${int(x.vendedores)} vend.`, x.top_vendedor || null].filter(Boolean).join(' · ')}
            valor={moneyCompact(x.importe)} chevron={false}
            pill={{ tone: tonoDelta(x.yoy), label: x.yoy != null ? deltaPct(x.yoy) : 'nuevo' }} />
        ))}
      </ListaAgrupada>

      <ListaAgrupada titulo={`Vendedores · ${MESES[mes - 1]}`} meta={`${ven.length}`} style={{ marginTop: 18 }}
        pie="Ranking por monto del mes · clientes finales distintos y SKUs que movió cada uno.">
        {ven.length === 0 && <Vacio icon={null} titulo="Esta cuenta no reporta vendedores" style={{ padding: 18 }} />}
        {ven.slice(0, 40).map((x, i) => (
          <Fila key={x.clave} titulo={`${i + 1}. ${x.clave}`}
            sub={`${int(x.clientes)} clientes · ${int(x.skus)} SKUs`}
            valor={moneyCompact(x.importe)} chevron={false}
            pill={{ tone: tonoDelta(x.yoy), label: x.yoy != null ? deltaPct(x.yoy) : 'nuevo' }} />
        ))}
      </ListaAgrupada>
    </>
  );
}

// ── Clientes finales ──────────────────────────────────────────────────────────
function TabClientes({ filas, fila, anio, mes }) {
  const cf = useMemo(() => clientesFinalesDelMes(filas, anio, mes), [filas, anio, mes]);
  return (
    <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 16px 12px' }}>
        <Pill tone="gray" size="sm">{fmtInt(cf.activos)} en el mes</Pill>
        <Pill tone="green" size="sm">+{fmtInt(cf.nuevos)} nuevos</Pill>
        <Pill tone="red" size="sm">{fmtInt(cf.perdidos)} perdidos</Pill>
        {fila.cfRecompra != null && <Pill tone="blue" size="sm">recompra {fmtPct(fila.cfRecompra)}</Pill>}
        {fila.cfTicket != null && <Pill tone="gray" size="sm">ticket {fmtMoney(fila.cfTicket)}</Pill>}
      </div>
      <ListaAgrupada titulo={`Clientes finales · ${MESES[mes - 1]}`} meta={`${cf.filas.length}`}
        pie="Ordenados por monto del mes · «nuevo» = no compró el mes anterior · «perdido» = compró el mes anterior y no éste.">
        {cf.filas.length === 0 && <Vacio icon={null} titulo="Esta cuenta no reporta cliente final" style={{ padding: 18 }} />}
        {cf.filas.slice(0, 60).map((x) => (
          <Fila key={x.cliente_final} titulo={x.cliente_final}
            sub={[capitalizarEstado(x.estado), x.facturas ? `${int(x.facturas)} facturas` : null, x.ticket ? `ticket ${moneyCompact(x.ticket)}` : null].filter(Boolean).join(' · ')}
            valor={x.perdido ? '—' : moneyCompact(x.importe)} chevron={false}
            pill={x.nuevo ? { tone: 'green', label: 'nuevo' } : x.perdido ? { tone: 'red', label: 'perdido' } : undefined} />
        ))}
      </ListaAgrupada>
    </>
  );
}

// ── Estados (sin mapa en el celular) ──────────────────────────────────────────
function TabEstados({ estados, mes }) {
  const { theme } = useTheme();
  const max = Math.max(0, ...estados.map((e) => Nc(e.importe)));
  return (
    <ListaAgrupada titulo={`Dónde vende · ${MESES[mes - 1]}`} meta={`${estados.length}`}
      pie="Reparto del sell out del mes por estado del cliente final. En el celular va como lista: el mapa sólo está en la computadora.">
      {estados.length === 0 && <Vacio icon={null} titulo="Esta fuente no manda estado" style={{ padding: 18 }} />}
      {estados.map((e) => (
        <div key={e.estado} style={{ padding: '9px 12px', fontFamily: TYPO.fontText }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{capitalizarEstado(e.estado)}</span>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0, color: theme.text }}>
              {fmtPct(e.pct)}<span style={{ fontWeight: 500, color: theme.textMuted, marginLeft: 6, fontSize: 12, fontFamily: TYPO.fontText }}>{moneyCompact(e.importe)}</span>
            </span>
          </div>
          <div style={{ marginTop: 6, height: 4, background: `${theme.text}0F`, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: 4, width: `${max > 0 ? (Nc(e.importe) / max) * 100 : 0}%`, background: theme.accent, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </ListaAgrupada>
  );
}
