// Ficha de un cliente propio en el celular (3.84.0 · 2026-10-06, mockup c73e7c5c v2: Digitalife, PCEL y Dicotech).
// Las ven los clientes con su usuario → sin margen, costo ni utilidad; gráficas de línea; inventario en dinero.
//   TituloGrande (cliente propio · código · atiende · ritmo de compra) → Segmented Resumen · Sell In · Sell Out
//   Resumen  → HeroM (frase + barra de cuota) → 4 KpiM (Cuota del mes · Sell out del último mes · Inventario en el cliente $
//              · Cobranza) → sell in vs sell out del año (línea con cuota punteada) → Qué le falta (agotados que vende,
//              «Armar propuesta») → Categorías (pay, la única excepción a «líneas») → Acuerdos abiertos (→ Agenda) → Marketing
//              (Pagos y apoyos NO van aquí: Fernando los quiere en su pestaña de Pagos, pendiente)
//              → Compartir ficha · Preparar visita.
//   Sell In  → la misma vista de Análisis por cliente (analisis/Pestanas.jsx#SellInVista) SIN sensible + Compartir avance.
//   Sell Out → cliente/SellOutPropio.jsx.
//   Marketing → MarketingCliente embebido (hero del año, 4 tarjetas, inversión por mes en línea, lista del mes y captura).
//   Cobranza  → CobranzaCliente embebido (hero del corte, 4 tarjetas, saldo y vencido por corte en línea, aging, facturas).
//   Pagos     → cliente/PagosPropio.jsx (uso interno: sólo con permiso de Pagos del cliente).
//   Abajo: Propuestas · Proyectos y forecast.
import React, { useMemo, useState } from 'react';
import { Share2, Megaphone, FileText, ClipboardList, CalendarCheck } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { useRoadmap } from '../../../lib/queries';
import { puedeVerPestanaCliente } from '../../../lib/permisos';
import { textoFichaCliente, textoAvance, compartir } from '../../../lib/whatsapp';
import BotonPrepararVisita from '../../../components/BotonPrepararVisita';
import { useNav } from '../../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, Cabecera, Skeleton, Vacio, ListaAgrupada, Fila, BotonGrande, TituloSeccionM, GraficaScrub, LeyendaScrub, BarraCuotaM, PayM, ChipsPay, Pill, toast } from '../../piezas';
import { nombreCliente, colorCliente } from '../../datos';
import { moneyCompact, int, deltaPct, MESES, N } from '../../util';
import { useCuotasClientes, useSellInDia, useDetalleCliente } from '../../../modules/comercial/analisis/useAnalisisData';
import { mapaCuotas, cuotaPeriodo, alcanceCuota, idxMes } from '../../../modules/comercial/analisis/calc';
import { useMensual, useDrillSkus, useDrillInventario } from '../../../modules/comercial/sellout/datos';
import { CLIENTES_CRM } from '../../../modules/comercial/reservas/clientesCRM';
import { useClienteMes, useVendedorCliente } from '../analisis/datos';
import { fraccionMes, ritmoCompras, sellOutMesCuenta, serieAnioSiSo } from '../analisis/calculo';
import { SellInVista } from '../analisis/Pestanas';
import SellOutPropio from './SellOutPropio';
import MarketingCliente from '../MarketingCliente';
import CobranzaCliente from '../CobranzaCliente';
import PagosPropio from './PagosPropio';
import Producto360 from '../producto/Producto360';
import { useCobranzaResumen, useAcuerdosCliente, useMarketingCliente, useNuestroStock } from './datos';
import { queLeFalta, lineaFalta, resumenCobranza, acuerdosAbiertos, marketingResumen, fraseResumen, fechaCortaIso } from './calculo';

const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const PESTANAS = [{ id: 'resumen', label: 'Resumen' }, { id: 'sellin', label: 'Sell In' }, { id: 'sellout', label: 'Sell Out' }, { id: 'marketing', label: 'Marketing' }, { id: 'cobranza', label: 'Cobranza' }];
const nombreBonito = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase()).trim();

/** Vista pura del Resumen (SSR en pruebas). */
export function ResumenPropioVista({ nombre, anio, mes, enCurso, mtd, cuotaMes, yoyMes, so, serie = [], falta, cobranza, acuerdos, marketing, catSi = [], catSo = [], onProponer, onAgenda, onMarketing, onCobranza, onSellOut, onSku, onCompartir, visita = null }) {
  const { theme } = useTheme();
  const mesL = MESES[mes - 1];
  const pct = alcanceCuota(mtd, cuotaMes);
  const frase = fraseResumen({ nombre, mes, pctCuota: pct, soSi: so?.soSi != null ? so.soSi / 100 : null, invValor: so?.invValor ?? null, semanas: so?.semanas ?? null, vencido: cobranza ? cobranza.vencido : null, agotados: falta?.agotados || 0, enCurso });
  const [dimCat, setDimCat] = useState('si');
  const sub = [cuotaMes > 0 ? `${moneyCompact(mtd)} de ${moneyCompact(cuotaMes)}` : `${moneyCompact(mtd)} en ${mesL.toLowerCase()}`, cobranza?.proximo ? `próximo pago ${fechaCortaIso(cobranza.proximo.fecha)}` : null, so?.invPiezas != null ? `${int(so.invPiezas)} pz en piso` : null].filter(Boolean).join(' · ');
  const morado = theme.purple || '#BF5AF2';
  const series = [{ key: 'cuota', label: 'Cuota', color: theme.orange, dash: true }, { key: 'so', label: 'Sell out', color: morado }, { key: 'si', label: 'Sell in', color: theme.accent, area: true, grosor: 2.6 }];
  const tooltip = (f) => (<><b style={{ fontSize: 12.5 }}>{f.label}</b> · sell in <b style={{ fontSize: 12.5 }}>{f.si != null ? moneyCompact(f.si) : '—'}</b>{f.so != null ? ` · sell out ${moneyCompact(f.so)}` : ''}{f.soSi != null ? ` · SO/SI ${f.soSi.toFixed(1)}` : ''}{f.cuota ? ` · cuota ${moneyCompact(f.cuota)}` : ''}</>);
  return (
    <>
      <HeroM eyebrow={`${mesL} ${anio}${enCurso ? ' · a mismo día' : ''}`} frase={frase} sub={sub}>
        {cuotaMes > 0 && <BarraCuotaM valor={mtd} cuota={cuotaMes} label={`cuota ideal de ${mesL.toLowerCase()}`} />}
      </HeroM>
      <KpiGrid data-entrada-kpis style={{ marginTop: 12 }}>
        <KpiM eyebrow="Cuota del mes" big={pct != null ? `${Math.round(pct)} %` : '—'} bigColor={pct == null ? undefined : pct >= 100 ? theme.green : pct >= 85 ? theme.text : theme.orange} sub={cuotaMes > 0 ? `faltan ${moneyCompact(Math.max(0, cuotaMes - mtd))} · ideal ${moneyCompact(cuotaMes)}` : 'sin cuota cargada'} progress={pct} />
        <KpiM eyebrow={`Sell out · ${so?.mesUsado ? MESES[so.mesUsado - 1].toLowerCase() : mesL.toLowerCase()}`} big={so && so.reporta && so.importe > 0 ? moneyCompact(so.importe) : '—'} sub={so && so.reporta && so.importe > 0 ? <>{so.yoy != null ? <><span style={{ color: so.yoy >= 0 ? theme.green : theme.red }}>{deltaPct(so.yoy)}</span> vs {anio - 1}</> : `sin ${anio - 1}`}{so.soSi != null ? ` · SO/SI ${(so.soSi / 100).toFixed(1)}` : ''}</> : 'sin sell out reportado'} onClick={onSellOut} />
        <KpiM eyebrow={`Inventario en ${nombre.split(' ')[0]}`} big={so?.invValor != null ? moneyCompact(so.invValor) : '—'} sub={so?.invValor != null ? [so.semanas != null ? `${Math.round(so.semanas)} sem` : null, falta?.agotados ? `${falta.agotados} agotados que vende` : 'nada agotado que venda'].filter(Boolean).join(' · ') : 'no reporta inventario'} onClick={onSellOut} />
        <KpiM eyebrow="Cobranza" big={cobranza ? moneyCompact(cobranza.vencido) : '—'} bigColor={cobranza ? (cobranza.vencido > 0 ? theme.red : theme.green) : undefined} sub={cobranza ? `vencido · saldo ${moneyCompact(cobranza.saldo)}${cobranza.proximo ? ` · vence ${fechaCortaIso(cobranza.proximo.fecha)}` : ''}` : 'sin estado de cuenta'} onClick={onCobranza} />
      </KpiGrid>

      <TituloSeccionM style={{ margin: '18px 0 0', padding: '0 28px 6px' }} meta="arrastra para leer">Sell in vs sell out · {anio}</TituloSeccionM>
      <div style={{ margin: '0 16px', background: theme.surface, borderRadius: 14, padding: '10px 10px 6px' }}>
        <GraficaScrub series={series} datos={serie} formato={moneyCompact} tooltip={tooltip} activo={enCurso ? mes - 1 : null} />
        <LeyendaScrub items={[{ label: 'Sell in', color: theme.accent }, { label: 'Sell out', color: morado }, ...(serie.some((f) => f.cuota) ? [{ label: 'Cuota', color: theme.orange, dash: true }] : [])]} />
      </div>

      <ListaAgrupada titulo="Qué le falta" meta={falta?.total ? `${falta.total} SKU${falta.total === 1 ? '' : 's'}` : undefined} style={{ marginTop: 18 }}
        accion={falta?.total && onProponer ? <Pill tone="blue" onClick={() => onProponer(falta.lista.map((x) => x.sku))} style={{ cursor: 'pointer' }}>Armar propuesta</Pill> : null}
        pie={falta?.total ? 'SKUs que este cliente vende (3 meses cerrados) y tiene agotados o con menos de una semana en piso. Las piezas propuestas son 2 meses de su ritmo, topadas a lo que tenemos.' : undefined}>
        {!falta?.total && <Vacio titulo="Nada agotado que venda" sub="Todo lo que se mueve en su piso tiene inventario." style={{ padding: '18px 16px' }} />}
        {(falta?.lista || []).map((x) => <Fila key={x.sku} titulo={`${x.sku}${x.descripcion ? ` ${x.descripcion}` : ''}`} sub={lineaFalta(x, nombre.split(' ')[0])} valor={x.piezas > 0 ? `+ ${int(x.piezas)} pz` : '—'} chevron={!!onSku} onClick={onSku ? () => onSku(x.sku) : undefined} pill={x.agotado ? { tone: 'red', label: 'agotado' } : { tone: 'orange', label: `${x.semanas} sem` }} />)}
      </ListaAgrupada>

      {(catSi.length > 0 || catSo.length > 0) && (
        <div style={{ padding: '0 16px', marginTop: 18 }}>
          <PayM titulo="Categorías" filas={dimCat === 'si' ? catSi : catSo} formato={moneyCompact} centro={`YTD ${dimCat === 'si' ? 'SI' : 'SO'}`} vacio={dimCat === 'si' ? 'Sin sell in en el año.' : 'Sin sell out en el año.'}
            acciones={<ChipsPay opciones={[['si', 'Sell in'], ['so', 'Sell out']]} value={dimCat} onChange={setDimCat} />} />
        </div>
      )}

      <ListaAgrupada titulo="Acuerdos abiertos" meta={acuerdos?.total ? `${acuerdos.total}${acuerdos.vencidos ? ` · ${acuerdos.vencidos} vencido${acuerdos.vencidos === 1 ? '' : 's'}` : ''}` : undefined} style={{ marginTop: 18 }} accion={onAgenda ? <Pill tone="gray" onClick={onAgenda} style={{ cursor: 'pointer' }}>Agenda ›</Pill> : null}>
        {!acuerdos?.filas?.length && <Fila titulo="Sin acuerdos abiertos" sub="Los puntos de las minutas y pendientes con este cliente aparecen aquí." chevron={false} />}
        {(acuerdos?.filas || []).map((a) => <Fila key={a.id} icon={CalendarCheck} color={a.vencido ? theme.red : theme.accent} titulo={a.titulo} sub={a.sub} chevron={false} onClick={onAgenda} />)}
      </ListaAgrupada>

      <ListaAgrupada titulo="Marketing" meta={marketing?.total ? `${marketing.total} en ${anio} · ${moneyCompact(marketing.inversion)}` : undefined} style={{ marginTop: 18 }} accion={onMarketing ? <Pill tone="gray" onClick={onMarketing} style={{ cursor: 'pointer' }}>Marketing ›</Pill> : null}>
        <Fila icon={Megaphone} color={theme.accent} titulo={marketing?.proxima ? marketing.proxima.nombre : (marketing?.total ? 'Sin próxima actividad' : 'Sin actividades este año')} sub={marketing?.proxima ? `próxima · ${fechaCortaIso(marketing.proxima.fecha)}` : (marketing?.total ? `${marketing.activas} activas` : 'captúralas desde Marketing')} onClick={onMarketing} />
      </ListaAgrupada>

      <div style={{ display: 'flex', gap: 8, margin: '18px 16px 0' }}>
        {onCompartir && <BotonGrande primario icon={Share2} onClick={onCompartir} style={{ flex: 1 }}>Compartir ficha</BotonGrande>}
        {visita}
      </div>
    </>
  );
}

export default function ClientePropioM({ clienteKey: ck, pestanaInicial = 'resumen' }) {
  const { theme } = useTheme();
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const anio = hoy.getFullYear(), mes = hoy.getMonth() + 1;
  // Pagos (rebates, apoyos, fondos) es de uso interno: sólo entra a la ficha si el perfil ve Pagos de este cliente.
  const conPagos = puedeVerPestanaCliente(nav.perfil, ck, 'pagos');
  const pestanas = conPagos ? [...PESTANAS, { id: 'pagos', label: 'Pagos' }] : PESTANAS;
  const [pestana, setPestana] = useState(pestanas.some((p) => p.id === pestanaInicial) ? pestanaInicial : 'resumen');
  const codigo = CLIENTES_CRM[ck]?.codigo || null;
  const nombre = nombreCliente(ck);
  const cuenta = ck;

  const { data: rows = [], isLoading: lMes, error } = useClienteMes(codigo, anio);
  const { data: cuotasRows = [] } = useCuotasClientes(anio);
  const { data: vendedor } = useVendedorCliente(codigo, anio);
  const { data: diario = [] } = useSellInDia(codigo, anio, !!codigo);
  const { data: soMensual = [] } = useMensual(anio);
  const { data: detalle = [] } = useDetalleCliente(codigo, anio, !!codigo && pestana !== 'sellout');
  const { data: skusSo = [] } = useDrillSkus(cuenta, anio, pestana === 'resumen');
  const { data: invCuenta = [] } = useDrillInventario(cuenta, pestana === 'resumen');
  const { data: cob } = useCobranzaResumen(ck, pestana === 'resumen');
  const { data: acuerdosRows = [] } = useAcuerdosCliente(ck, pestana === 'resumen');
  const { data: mkRows = [] } = useMarketingCliente(ck, anio, pestana === 'resumen');
  const { data: roadmap } = useRoadmap();
  const rd = useMemo(() => { const m = new Map(); (roadmap || []).forEach((r) => m.set(r.sku, r)); return m; }, [roadmap]);

  const mensual = useMemo(() => { const m = new Map(); rows.forEach((r) => { const k = idxMes(r.anio, r.mes); const o = m.get(k) || { fact_neta: 0, piezas: 0, contribucion: 0 }; o.fact_neta += N(r.fact_neta); o.piezas += N(r.piezas_venta_neta); m.set(k, o); }); return m; }, [rows]);
  const mapa = useMemo(() => mapaCuotas(cuotasRows), [cuotasRows]);
  const ritmo = useMemo(() => ritmoCompras(diario, hoy), [diario, hoy]);
  // Sell out del Resumen: en los primeros 10 días del mes se lee el mes anterior completo (regla «primeros días del mes»).
  const [soAnio, soMes] = hoy.getDate() < 10 ? (mes === 1 ? [anio - 1, 12] : [anio, mes - 1]) : [anio, mes];
  const so = useMemo(() => sellOutMesCuenta(soMensual, cuenta, soAnio, soMes, hoy), [soMensual, cuenta, soAnio, soMes, hoy]);
  const faltaBase = useMemo(() => queLeFalta({ skus: skusSo, inv: invCuenta, anio: so?.anioUsado || anio, mes: so?.mesUsado || mes, roadmap: rd, top: 10 }), [skusSo, invCuenta, so, anio, mes, rd]);
  const { data: nuestro } = useNuestroStock(faltaBase.lista.map((x) => x.sku), pestana === 'resumen');
  const falta = useMemo(() => (nuestro ? queLeFalta({ skus: skusSo, inv: invCuenta, nuestro, anio: so?.anioUsado || anio, mes: so?.mesUsado || mes, roadmap: rd, top: 10 }) : faltaBase), [nuestro, faltaBase, skusSo, invCuenta, so, anio, mes, rd]);
  const r = useMemo(() => {
    const kMes = idxMes(anio, mes), factor = fraccionMes(anio, mes, hoy);
    const mtd = N(mensual.get(kMes)?.fact_neta), prev = N(mensual.get(kMes - 12)?.fact_neta) * factor;
    const ytd = [...mensual.entries()].filter(([k]) => Math.floor(k / 12) === anio && (k % 12) + 1 <= mes).reduce((s, [, a]) => s + a.fact_neta, 0);
    const ytdPrev = [...mensual.entries()].filter(([k]) => Math.floor(k / 12) === anio - 1 && (k % 12) + 1 <= mes).reduce((s, [, a]) => s + a.fact_neta, 0);
    return { mtd, yoyMes: prev > 0 ? ((mtd - prev) / prev) * 100 : null, cuotaMes: cuotaPeriodo(mapa, codigo, anio, mes, 'mes'), serie: serieAnioSiSo({ mensual, soMensual, cuenta, mapa, codigo, anio, hoy }), ytd, yoyYtd: ytdPrev > 0 ? ((ytd - ytdPrev) / ytdPrev) * 100 : null, enCurso: true };
  }, [mensual, mapa, codigo, soMensual, cuenta, anio, mes, hoy]);
  const cobranza = useMemo(() => (cob ? resumenCobranza(cob.cortes, cob.detalle, hoy) : null), [cob, hoy]);
  const acuerdos = useMemo(() => acuerdosAbiertos(acuerdosRows, hoy), [acuerdosRows, hoy]);
  const marketing = useMemo(() => marketingResumen(mkRows, hoy), [mkRows, hoy]);
  const cats = useMemo(() => {
    const norm = (c) => String(c || 'Sin categoría').trim() || 'Sin categoría';
    const si = new Map(), so2 = new Map();
    detalle.forEach((x) => { if (N(x.anio) !== anio || N(x.mes) > mes) return; const c = norm(rd.get(x.articulo)?.categoria || x.categoria); si.set(c, N(si.get(c)) + N(x.fact_neta)); });
    skusSo.forEach((x) => { if (N(x.anio) !== anio || N(x.mes) > mes) return; const c = norm(rd.get(x.sku)?.categoria || x.categoria); so2.set(c, N(so2.get(c)) + N(x.importe)); });
    return { si: [...si].map(([label, v]) => ({ label, v })), so: [...so2].map(([label, v]) => ({ label, v })) };
  }, [detalle, skusSo, rd, anio, mes]);
  const top5 = useMemo(() => { const m = new Map(); detalle.forEach((x) => { if (N(x.anio) !== anio) return; const o = m.get(x.articulo) || { sku: x.articulo, piezas: 0, monto: 0, descripcion: rd.get(x.articulo)?.descripcion || '' }; o.piezas += N(x.piezas_venta_neta); o.monto += N(x.fact_neta); m.set(x.articulo, o); }); return [...m.values()].sort((a, b) => b.monto - a.monto).slice(0, 5); }, [detalle, anio, rd]);

  const abrirSku = (sku) => nav.push(<Producto360 sku={sku} cara="sellout" />, `producto-${sku}`);
  const compartirFicha = async () => { const res = await compartir(textoFichaCliente({ cliente: nombre, mes, anio, mtd: r.mtd, ytd: r.ytd, yoyYtd: r.yoyYtd, top: top5 }), { titulo: `Ficha ${nombre}` }); if (res === 'share') toast.ok('Compartido'); else if (res) toast.ok('Texto copiado'); };
  const compartirAvance = async () => { const res = await compartir(textoAvance({ cliente: nombre, mes, anio, mtd: r.mtd, cuota: r.cuotaMes, ytd: r.ytd, top: top5 }), { titulo: `Avance ${nombre}` }); if (res === 'share') toast.ok('Compartido'); else if (res) toast.ok('Texto copiado'); };

  const color = colorCliente(ck, theme);
  const sub = ['cliente propio', codigo ? `código ${codigo}` : null, vendedor ? `atiende ${nombreBonito(vendedor)}` : null, ritmo.cadaDias ? `compra cada ${ritmo.cadaDias} días` : null].filter(Boolean).join(' · ');
  const cargando = lMes && !rows.length;
  return (
    <div data-stagger style={{ paddingBottom: 24 }}>
      <Cabecera onVolver={nav.pop} etiqueta="Clientes" />
      <TituloGrande titulo={nombre} sub={<><span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: 'inline-block', flexShrink: 0 }} /><span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span></>} />
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', padding: '0 16px 10px' }}>
        {pestanas.map((p) => <Pill key={p.id} tone={pestana === p.id ? 'blue' : 'gray'} onClick={() => setPestana(p.id)} style={{ cursor: 'pointer', flexShrink: 0, fontSize: 12.5, padding: '6px 12px' }}>{p.label}</Pill>)}
      </div>
      {error && <Vacio titulo="No se pudo cargar el cliente" sub={String(error.message || error)} color={theme.red} />}
      {cargando && !error && <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={150} r={12} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /></div><Skeleton h={200} r={12} /></div>}
      {!cargando && !error && pestana === 'resumen' && (
        <ResumenPropioVista nombre={nombre} anio={anio} mes={mes} enCurso={r.enCurso} mtd={r.mtd} cuotaMes={r.cuotaMes} yoyMes={r.yoyMes} so={so} serie={r.serie} falta={falta} cobranza={cobranza} acuerdos={acuerdos} marketing={marketing} catSi={cats.si} catSo={cats.so}
          onProponer={(skus) => nav.navegar({ pagina: 'propuestas', extra: { clienteKey: ck, skus } })} onAgenda={() => nav.navegar({ pagina: 'agenda' })}
          onMarketing={() => setPestana('marketing')} onCobranza={() => setPestana('cobranza')} onSellOut={() => setPestana('sellout')} onSku={abrirSku} onCompartir={compartirFicha}
          visita={<BotonPrepararVisita clienteKey={ck} nombre={nombre} anio={anio} variante="bloque" />} />
      )}
      {!cargando && !error && pestana === 'sellin' && (
        <>
          <SellInVista codigo={codigo} mensual={mensual} detalle={detalle} diario={diario} cuotasRows={cuotasRows} anio={anio} mes={mes} sensible={false} rd={rd} onSku={abrirSku} hoy={hoy} />
          <div style={{ margin: '18px 16px 0' }}><BotonGrande primario icon={Share2} onClick={compartirAvance}>Compartir avance</BotonGrande></div>
        </>
      )}
      {!cargando && !error && pestana === 'sellout' && <SellOutPropio clienteKey={ck} nombre={nombre} anio={anio} />}
      {pestana === 'marketing' && <MarketingCliente clienteKey={ck} nombre={nombre} embebido />}
      {pestana === 'cobranza' && <CobranzaCliente clienteKey={ck} nombre={nombre} embebido />}
      {pestana === 'pagos' && conPagos && <PagosPropio clienteKey={ck} nombre={nombre} />}

      <ListaAgrupada titulo={`Más de ${nombre}`} style={{ marginTop: 22 }}>
        <Fila icon={FileText} color={color} titulo="Propuestas" sub="Armar y enviar una propuesta" onClick={() => nav.navegar({ pagina: 'propuestas', extra: { clienteKey: ck } })} />
        <Fila icon={ClipboardList} color={color} titulo="Proyectos y forecast" sub="Lo que va a necesitar · formato del CRM" onClick={() => nav.navegar({ pagina: 'forecastReservas', extra: { cliente: ck } })} />
      </ListaAgrupada>
    </div>
  );
}
