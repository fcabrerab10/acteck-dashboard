// Producto 360 · cara «Abasto» (3.83.0 · 2026-10-05): el S&OP de UN SKU con sus propios datos (se calcula al abrir la cara
// con el mismo motor que la web, forecast/calculo.js#calcularForecast, alimentado sólo con las filas de ese SKU):
// cobertura en días y semanas, venta mensual real de 3 meses, stock, lo que llega por PO con fecha, el sugerido con su
// porqué (meses de seguridad, crecimiento, lead time real del proveedor) y «Agregar a solicitud» con las piezas editables.
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Ship } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { fetchAll } from '../../../lib/queries';
import { isoLocal } from '../../../lib/format';
import { puedeEditarPestanaGlobal } from '../../../lib/permisos';
import { calcularForecast } from '../../../modules/comercial/forecast/calculo';
import { useSolicitudes } from '../../../modules/comercial/forecast/useSolicitudes';
import { useNav } from '../../nav';
import { HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, BotonGrande, Vacio, Skeleton, toast } from '../../piezas';
import { CampoCantidad } from '../SOPExport';
import { arribosPorPo, diasCobertura, tonoCobertura, usdCompact, fechaCorta, fechaLarga, cedisCorto, estatusCorto, costoDe } from '../sop/calculo';
import FichaPO from '../sop/FichaPO';
import { int, N } from '../../util';

const STALE = 5 * 60 * 1000;
const opcional = (p) => p.catch(() => []);

export function useAbastoSku(sku, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['movil', 'abasto', sku], staleTime: STALE, enabled: enabled && !!sku,
    queryFn: async () => {
      const hoy = new Date();
      const m0 = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1);
      const filtro12m = m0.getFullYear() === hoy.getFullYear()
        ? `and(anio.eq.${hoy.getFullYear()},mes.gte.${m0.getMonth() + 1})`
        : `and(anio.eq.${m0.getFullYear()},mes.gte.${m0.getMonth() + 1}),and(anio.eq.${hoy.getFullYear()},mes.lte.${hoy.getMonth() + 1})`;
      const [inventario, transito, leadTimes, facturacion, embarques, roadmap, catalogoArticulos, skuConfig, comprasPendientes, contenedores] = await Promise.all([
        fetchAll('v_inventario_comercial', 'sku,disponible,inventario', (q) => q.eq('sku', sku)),
        fetchAll('v_transito_sku', 'sku,supplier,cantidad,eta_mas_cercana,embarques,embarques_detalle', (q) => q.eq('sku', sku)),
        opcional(fetchAll('v_lead_time_sku', 'sku,dias_promedio,muestras,supplier_principal,familia', (q) => q.eq('sku', sku))),
        fetchAll('facturacion_clientes', 'sku,cliente_nombre,canal,anio,mes,piezas', (q) => q.eq('sku', sku).or(filtro12m)),
        opcional(fetchAll('embarques_compras', 'po,codigo,fecha_emision,arribo_cedis,arribo_almacen,eta_puerto,po_qty,shp_qty,contenedor,estatus,supplier,familia,descripcion,unit_price,lt_dias,tipo_carga,tipo_contenedor,cbm_unitario', (q) => q.eq('codigo', sku))),
        fetchAll('roadmap_sku', 'sku,descripcion,marca,rdmp,categoria', (q) => q.eq('sku', sku)),
        opcional(fetchAll('catalogo_articulos', 'articulo,descripcion', (q) => q.eq('articulo', sku))),
        opcional(fetchAll('sku_config', 'sku,es_critico,meses_seguridad,crecimiento_override', (q) => q.eq('sku', sku))),
        opcional(fetchAll('v_compras_pendientes_sku', 'sku,descripcion,proveedor,po,fecha_po,piezas_pedidas,piezas_pendientes,usd_pendiente,eta,en_master_embarques,dias_desde_po', (q) => q.eq('sku', sku))),
        opcional(fetchAll('v_embarques_contenedor', 'contenedor,naviera')),
      ]);
      const rows = calcularForecast({ inventario, transito, leadTimes, metadata: [], demanda: [], roadmap, embarques, reporteSkus: [{ sku, orden: 1 }], facturacion, progArribos: [], catalogoArticulos, skuConfig, comprasPendientes }, 3);
      const row = rows.find((r) => r.sku === sku) || null;
      const navieraPor = new Map((contenedores || []).filter((c) => c.contenedor && c.naviera).map((c) => [c.contenedor, c.naviera]));
      const arribos = arribosPorPo({ transito, porSku: new Map(row ? [[sku, row]] : []), navieraPor, hoy });
      return { row, arribos };
    },
  });
}

/** Texto «Por qué N pz» con los datos del motor. */
export function porQue(r, { hoy = new Date() } = {}) {
  if (!r) return '';
  const ritmo = Math.round(N(r.ritmo3m));
  const seg = N(r.mesesSeguridad);
  const objetivo = Math.round(N(r.objetivo3m));
  const inv = Math.round(N(r.inv)), tra = Math.round(N(r.traCant));
  const nec = Math.round(N(r.necesidadNeta));
  const sug = Math.round(N(r.sugerido));
  const partes = [`Venta real de ${int(ritmo)} pz/mes en los 3 meses cerrados${r.crecimientoPct > 0 ? ` (+${Math.round(r.crecimientoPct * 100)} % de tendencia)` : r.tendenciaNegativa ? ' (tendencia a la baja)' : ''} × 3 meses${seg ? ` + ${seg} de seguridad${r.esCritico ? ' por ser crítico' : ''}` : ''} = ${int(objetivo)} pz necesarias.`];
  partes.push(`Tenemos ${int(inv)}${tra ? ` + ${int(tra)} en camino = ${int(inv + tra)}` : ''}.`);
  if (nec > 0) partes.push(`Faltan ${int(nec)}${sug > 0 ? ` → ${int(sug)} pz ${r.esConsolidado ? '(consolidado, piezas exactas)' : r.piezasPorContenedor > 0 ? `(${r.contenedoresSugeridos} contenedor${r.contenedoresSugeridos === 1 ? '' : 'es'} de ${int(r.piezasPorContenedor)})` : ''}` : ', menos de medio contenedor: todavía no se sugiere'}.`);
  else partes.push('No falta nada a 3 meses.');
  if (r.ltDias > 0 && sug > 0) {
    const dias = diasCobertura(r);
    const margen = dias != null ? dias - Math.round(r.ltDias) : null;
    if (margen != null && margen <= 0) partes.push(`Con el lead time de ${Math.round(r.ltDias)} días la PO ya va tarde: llegaría después de que se agote.`);
    else if (margen != null) { const d = new Date(hoy); d.setDate(d.getDate() + margen); partes.push(`Con el lead time de ${Math.round(r.ltDias)} días, la PO debe salir antes del ${fechaLarga(isoLocal(d))}.`); }
  }
  return partes.join(' ');
}

export function fraseAbasto(r, arribos = []) {
  if (!r) return 'Este SKU no tiene venta, inventario ni tránsito en los últimos 12 meses.';
  const dias = diasCobertura(r);
  const inv = N(r.inv);
  const prox = arribos.find((p) => !p.vencida) || arribos[0] || null;
  const p1 = inv <= 0 ? (N(r.demMes) > 0 ? 'Está agotado con demanda' : 'Está agotado y sin demanda reciente') : dias != null ? `Se agota en ${int(dias)} días` : `Hay ${int(inv)} pz sin ritmo de venta`;
  const p2 = prox ? `la PO ${prox.po} llega el ${fechaLarga(prox.eta)} con ${int(prox.skus.find((s) => s.sku === r.sku)?.piezas || prox.piezas)} pz` : 'no hay nada en camino';
  const p3 = N(r.sugerido) > 0 ? `faltan ${int(r.necesidadNeta)} pz para 3 meses y el sugerido es ${int(r.sugerido)} pz` : N(r.necesidadNeta) > 0 ? `faltan ${int(r.necesidadNeta)} pz, menos de medio contenedor` : 'no hace falta comprar';
  return `${p1}; ${p2}, así que ${p3}.`;
}

export function AbastoVista({ row: r, arribos = [], sensible = false, puedeEditar = false, enSolicitud = false, onAgregar, onPo, cantidad, onCantidad, ocupado = false }) {
  const { theme } = useTheme();
  if (!r) return <Vacio titulo="Sin datos de abasto" sub="Este SKU no tiene venta, inventario ni tránsito en los últimos 12 meses." style={{ padding: '24px 16px' }} />;
  const dias = diasCobertura(r);
  const inv = N(r.inv);
  const tono = tonoCobertura(dias, inv);
  const color = tono === 'red' ? theme.red : tono === 'orange' ? theme.orange : tono === 'green' ? theme.green : undefined;
  const sem = dias != null ? Math.round(dias / 7 * 10) / 10 : null;
  const ppc = N(r.piezasPorContenedor);
  return (
    <>
      <div style={{ padding: '10px 16px 0' }}>
        <HeroM eyebrow="Abasto" frase={fraseAbasto(r, arribos)} sub={[`venta ${int(r.ritmo3m)} pz/mes`, `stock ${int(inv)}`, r.supplier ? `${r.supplier}${r.ltDias ? ` · LT ${Math.round(r.ltDias)} d` : ''}` : (r.ltDias ? `LT ${Math.round(r.ltDias)} d` : null)].filter(Boolean).join(' · ')} />
      </div>
      <KpiGrid style={{ marginTop: 10 }}>
        <KpiM eyebrow="Cobertura" big={inv <= 0 ? 'Agotado' : dias != null ? `${int(dias)} d` : '—'} bigColor={color} sub={inv <= 0 ? (N(r.demMes) > 0 ? `${int(r.demMes)} pz/mes de demanda` : 'sin demanda en 3 meses') : sem != null ? `${sem} sem · meta 90 d` : 'sin ritmo de venta'} />
        <KpiM eyebrow="Sugerido" big={N(r.sugerido) > 0 ? `${int(r.sugerido)} pz` : '—'} bigColor={N(r.sugerido) > 0 ? theme.orange : undefined} sub={N(r.sugerido) > 0 ? [sensible && costoDe(r) ? `${usdCompact(N(r.sugerido) * costoDe(r))} USD` : null, r.esConsolidado ? 'consolidado' : ppc > 0 ? `${r.contenedoresSugeridos} cnt × ${int(ppc)}` : null].filter(Boolean).join(' · ') || 'piezas exactas' : N(r.necesidadNeta) > 0 ? `necesidad ${int(r.necesidadNeta)} pz` : 'sin brecha a 3 meses'} />
      </KpiGrid>
      <ListaAgrupada titulo="Lo que llega" meta={arribos.length ? `${arribos.length} PO · ${int(r.traCant)} pz` : undefined} style={{ marginTop: 18 }}>
        {!arribos.length && <Fila icon={Ship} color={theme.textMuted} titulo="Nada en camino" sub={r.poPendiente ? `PO ${r.poPendiente.po || ''} colocada al proveedor, aún sin embarcar` : 'Sin embarques pendientes de este SKU.'} chevron={false} />}
        {arribos.map((p) => {
          const mio = p.skus.find((s) => s.sku === r.sku);
          return <Fila key={p.po} icon={Ship} color={p.vencida ? theme.red : theme.accent} titulo={`PO ${p.po}${p.supplier ? ` · ${p.supplier}` : ''}`}
            sub={[estatusCorto(p.estatus) || null, p.naviera, p.eta ? `${p.vencida ? 'ETA vencida' : 'CEDIS'} ${fechaCorta(p.eta)}` : 'sin ETA', cedisCorto(p.cedis) || null].filter(Boolean).join(' · ')}
            valor={`${int(mio?.piezas || 0)} pz`} valorSub={p.nSkus > 1 ? `${p.nSkus} SKUs en la PO` : null} onClick={onPo ? () => onPo(p) : undefined} />;
        })}
      </ListaAgrupada>
      <div style={{ margin: '18px 16px 0' }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: theme.text, padding: '0 2px 6px' }}>{N(r.sugerido) > 0 ? `Por qué ${int(r.sugerido)} pz` : 'Cómo se calcula'}</div>
        <div style={{ background: theme.surface, borderRadius: 14, padding: '12px 14px', fontFamily: TYPO.fontText, fontSize: 12.5, lineHeight: 1.5, color: theme.text }}>{porQue(r)}</div>
      </div>
      <div style={{ margin: '14px 16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <CampoCantidad value={cantidad} onChange={onCantidad} paso={ppc > 0 && !r.esConsolidado ? ppc : 100} ancho={140} />
        <BotonGrande primario icon={ClipboardList} disabled={ocupado || !puedeEditar || !(cantidad > 0)} onClick={onAgregar} style={{ flex: 1, height: 44, fontSize: 15 }}>{ocupado ? 'Guardando…' : enSolicitud ? 'Actualizar solicitud' : 'Agregar a solicitud'}</BotonGrande>
      </div>
      {!puedeEditar && <div style={{ fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 6 }}>Tu perfil sólo consulta; las solicitudes se crean con permiso de edición.</div>}
    </>
  );
}

export default function Abasto({ sku, sensible = false }) {
  const nav = useNav();
  const perfil = nav.perfil;
  const puedeEditar = puedeEditarPestanaGlobal(perfil, 'forecast_solicitudes');
  const { data, isLoading } = useAbastoSku(sku);
  const sol = useSolicitudes(perfil);
  const borrador = sol.borradores[0] || null;
  const lineas = borrador ? sol.lineasDe(borrador.id) : [];
  const linea = lineas.find((l) => l.sku === sku) || null;
  const r = data?.row || null;
  const porDefecto = N(linea?.cantidad) || N(r?.sugerido) || (N(r?.piezasPorContenedor) > 0 && !r?.esConsolidado ? N(r.piezasPorContenedor) : Math.round(N(r?.necesidadNeta))) || 0;
  const [cantidad, setCantidad] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const cant = cantidad == null ? porDefecto : cantidad;
  const agregar = async () => {
    if (!r || !(cant > 0)) return;
    setOcupado(true);
    try {
      let id = borrador?.id;
      if (!id) { const nuevo = await sol.crearBorrador('S&OP celular'); id = nuevo?.id; }
      if (!id) throw new Error('No se pudo crear el borrador');
      const ppc = N(r.piezasPorContenedor);
      let fechaEstimada = null;
      if (r.ltDias > 0) { const d = new Date(); d.setDate(d.getDate() + Math.round(r.ltDias)); fechaEstimada = isoLocal(d); }
      if (linea) await sol.editarLinea(linea.id, { cantidad: cant, contenedores: ppc > 0 ? Math.ceil(cant / ppc) : null });
      else await sol.agregarLinea(id, { sku, descripcion: r.descripcion || '', cantidad: cant, proveedor: r.supplier || '', fecha_estimada: fechaEstimada, ultimo_costo_usd: costoDe(r) || null, piezas_por_contenedor: ppc || null, contenedores: ppc > 0 ? Math.ceil(cant / ppc) : null, es_consolidado: !!r.esConsolidado });
      toast.ok(`${sku} · ${int(cant)} pz en la solicitud`);
    } catch (e) { toast.error(`No se pudo agregar: ${e?.message || e}`); }
    finally { setOcupado(false); }
  };
  if (isLoading) return <div style={{ padding: '10px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={130} r={14} /><Skeleton h={90} r={14} /><Skeleton h={160} r={14} /></div>;
  return (
    <AbastoVista row={r} arribos={data?.arribos || []} sensible={sensible} puedeEditar={puedeEditar} enSolicitud={!!linea} cantidad={cant} onCantidad={setCantidad} ocupado={ocupado} onAgregar={agregar}
      onPo={(p) => nav.push(<FichaPO po={p} sensible={sensible} />, `po-${p.po}`)} />
  );
}
