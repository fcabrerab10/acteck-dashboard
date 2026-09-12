// S&OP móvil (push · nodo forecastClientes) · planeación de compras con el MISMO motor que escritorio
// (modules/comercial/forecast/calculo.js → calcularForecast): brecha, sugerido (contenedor / consolidado,
// umbral 50 %), cobertura ERP y lead time salen idénticos a la tabla de la computadora.
//
//   · Hero: SKUs con brecha · valor en tránsito (USD, último costo) · próximo arribo · lead time promedio.
//   · Buscador de uno o varios SKUs (canasta local, como la Ficha de producto): cobertura, venta mensual,
//     tránsito con próximo arribo y piezas de ese embarque, sugerido y "Agregar al export" con cantidad editable.
//   · Próximos arribos por PO (SKUs, piezas, CEDIS); tocar una PO lista sus SKUs para agregarlos a la canasta.
//   · Mi export (SOPExport.jsx): borrador de solicitudes_compra compartido con escritorio.
// Datos SOLO vía src/lib/queries.js (fetchAll con cache 5 min) + React Query; el borrador se lee con useSolicitudes.
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Ship, Plus, Trash2, ClipboardList, Package, AlertTriangle, Lock, Factory, Anchor } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { fetchAll } from '../../lib/queries';
import { puedeVerPestanaGlobal, puedeEditarPestanaGlobal, puedeVerSensible } from '../../lib/permisos';
import { calcularForecast } from '../../modules/comercial/forecast/calculo';
import { useSolicitudes } from '../../modules/comercial/forecast/useSolicitudes';
import { useEmbarquesTiempos, resumen as resumenEmb, nombreProveedor } from '../../modules/comercial/forecast/useEmbarquesTiempos';
import { tonoCobertura, etiquetaCobertura, CEDIS_CORTO } from '../../modules/comercial/inventario/constantes';
import { useNav } from '../nav';
import { TituloGrande, Cabecera, HeroM, ListaAgrupada, Fila, BotonGrande, CampoBusqueda, Vacio, Skeleton, Pill, HojaM, toast } from '../piezas';
import { int, moneyCompact, fechaCorta, hoyISO, leerLS, guardarLS, MONO, N } from '../util';
import SOPExport, { CampoCantidad } from './SOPExport';

const STALE = 5 * 60 * 1000;
const LS_SKUS = 'movil_sop_skus_v1';
const MAX_SKUS = 20;
const ESTATUS_CORTO = { 'TRANSITO MARITIMO': 'En el mar', 'PROXIMO A ZARPAR': 'Por zarpar', 'EN PRODUCCION': 'En producción', 'EN ESPERA DE CONSOLIDAR': 'Por consolidar', 'EN RESGUARDO': 'En resguardo', 'Pendiente modular': 'Pendiente' };
const usd = (n) => moneyCompact(n);
const costoDe = (r) => Number(r.ultimoCostoUsd || r.costoPromedioUsd || r.costoUnitUsd || 0);
const cedisCorto = (c) => (c ? CEDIS_CORTO[c] || String(c).replace(/^ALMACENES\s+/i, '').toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase()) : null);

// ── Datos · las mismas fuentes que useForecastData (escritorio), recortadas a lo que usa el motor ──
function useSOPDatos(enabled) {
  return useQuery({
    queryKey: ['movil', 'sop'], staleTime: STALE, enabled,
    queryFn: async () => {
      const hoy = new Date();
      const anioCorte = new Date(hoy.getFullYear(), hoy.getMonth() - 6, 1).getFullYear();
      const opcional = (p) => p.catch(() => []);
      const [inventario, transito, leadTimes, facturacion, embarques, reporteSkus, roadmap, catalogoArticulos, skuConfig] = await Promise.all([
        fetchAll('v_inventario_comercial', 'sku,disponible,inventario'),
        fetchAll('v_transito_sku', 'sku,supplier,cantidad,eta_mas_cercana,embarques,embarques_detalle'),
        fetchAll('v_lead_time_sku', 'sku,dias_promedio,muestras,supplier_principal,familia'),
        fetchAll('facturacion_clientes', 'sku,cliente_nombre,canal,anio,mes,piezas', (q) => q.gte('anio', anioCorte)),
        fetchAll('embarques_compras', 'po,codigo,fecha_emision,arribo_cedis,arribo_almacen,eta_puerto,etd,po_qty,shp_qty,contenedor,estatus,supplier,familia,descripcion,unit_price,sn,lt_dias,tipo_carga,tipo_contenedor,cbm_unitario'),
        opcional(fetchAll('reporte_skus', 'sku,orden', (q) => q.eq('activo', true))),
        fetchAll('roadmap_sku', 'sku,descripcion,marca,rdmp'),
        opcional(fetchAll('catalogo_articulos', 'articulo,descripcion')),
        opcional(fetchAll('sku_config', 'sku,es_critico,meses_seguridad,crecimiento_override')),
      ]);
      const rows = calcularForecast({ inventario, transito, leadTimes, metadata: [], demanda: [], roadmap, embarques, reporteSkus, facturacion, progArribos: [], catalogoArticulos, skuConfig }, 3);
      // Próximos arribos: todos los embarques en camino (v_transito_sku.embarques_detalle) agrupados por PO.
      const porPo = new Map();
      const desc = new Map(roadmap.map((r) => [r.sku, r.descripcion || '']));
      transito.forEach((t) => (Array.isArray(t.embarques_detalle) ? t.embarques_detalle : []).forEach((e) => {
        if (!(N(e.cantidad) > 0) || !e.po) return;
        const o = porPo.get(e.po) || { po: e.po, eta: null, piezas: 0, cedis: null, estatus: null, skus: [] };
        if (e.eta && (!o.eta || e.eta < o.eta)) o.eta = e.eta;
        if (!o.cedis && e.cedis) o.cedis = e.cedis;
        if (!o.estatus && e.estatus) o.estatus = e.estatus;
        o.piezas += N(e.cantidad);
        o.skus.push({ sku: t.sku, piezas: N(e.cantidad), descripcion: desc.get(t.sku) || '' });
        porPo.set(e.po, o);
      }));
      const arribos = [...porPo.values()].sort((a, b) => String(a.eta || '9999').localeCompare(String(b.eta || '9999')));
      return { rows, arribos, universoReporte: reporteSkus.length > 0 };
    },
  });
}

export default function SOP() {
  const { theme } = useTheme();
  const nav = useNav();
  const perfil = nav.perfil;
  const puedeVer = puedeVerPestanaGlobal(perfil, 'forecast_clientes');
  // Información sensible: costo USD (último costo) y todo lo valuado con él.
  const sensible = puedeVerSensible(perfil);
  const puedeEditar = puedeEditarPestanaGlobal(perfil, 'forecast_solicitudes');
  const { data, isLoading, error } = useSOPDatos(puedeVer);
  const sol = useSolicitudes(perfil);
  const [skus, setSkus] = useState(() => leerLS(LS_SKUS, []).filter((s) => typeof s === 'string').slice(0, MAX_SKUS));
  const [buscando, setBuscando] = useState(false);
  const [exportAbierto, setExportAbierto] = useState(false);
  const [poAbierta, setPoAbierta] = useState(null);
  useEffect(() => { guardarLS(LS_SKUS, skus); }, [skus]);

  const rows = data?.rows || [];
  const bySku = useMemo(() => new Map(rows.map((r) => [r.sku, r])), [rows]);
  const hoy = hoyISO();

  const kpis = useMemo(() => {
    if (!rows.length) return null;
    const conBrecha = rows.filter((r) => r.brecha > 0);
    const valorSugerido = rows.reduce((s, r) => s + N(r.sugerido) * costoDe(r), 0);
    const sugeridoPz = rows.reduce((s, r) => s + N(r.sugerido), 0);
    const traPz = rows.reduce((s, r) => s + N(r.traCant), 0);
    const traUsd = rows.reduce((s, r) => s + N(r.traCant) * costoDe(r), 0);
    const lts = rows.filter((r) => r.ltDias).map((r) => r.ltDias);
    const ltProm = lts.length ? lts.reduce((a, b) => a + b, 0) / lts.length : null;
    const proximo = (data?.arribos || []).find((a) => a.eta && a.eta >= hoy) || null;
    const atrasados = (data?.arribos || []).filter((a) => a.eta && a.eta < hoy).length;
    return { conBrecha: conBrecha.length, valorSugerido, sugeridoPz, traPz, traUsd, ltProm, proximo, atrasados };
  }, [rows, data, hoy]);

  const borrador = sol.borradores[0] || null;                 // mismo criterio que escritorio: el más reciente
  const lineas = borrador ? sol.lineasDe(borrador.id) : [];
  const enExport = useMemo(() => new Map(lineas.map((l) => [l.sku, l])), [lineas]);

  const agregarSku = (sku) => setSkus((c) => (c.includes(sku) ? c : [...c, sku].slice(-MAX_SKUS)));
  const quitarSku = (sku) => setSkus((c) => c.filter((s) => s !== sku));

  // Agregar/actualizar línea en el borrador activo · mismo payload que confirmarAgregarLinea (escritorio).
  const agregarAlExport = async (r, cantidad) => {
    if (!puedeEditar) { toast.error('Tu perfil no puede crear solicitudes de compra.'); return; }
    if (!(cantidad > 0)) { toast.error('Indica una cantidad mayor a 0'); return; }
    try {
      let solicitudId = borrador?.id;
      if (!solicitudId) { const nuevo = await sol.crearBorrador(); solicitudId = nuevo?.id; }
      if (!solicitudId) { toast.error('No se pudo crear el borrador'); return; }
      const ppc = N(r.piezasPorContenedor);
      const cnts = ppc > 0 ? Math.ceil(cantidad / ppc) : null;
      let fechaEstimada = null;
      if (r.ltDias > 0) { const d = new Date(); d.setDate(d.getDate() + Math.round(r.ltDias)); fechaEstimada = d.toISOString().slice(0, 10); }
      const existente = enExport.get(r.sku);
      if (existente) {
        await sol.editarLinea(existente.id, { cantidad, contenedores: cnts });
        toast.ok(`${r.sku} · ${int(cantidad)} pz actualizado en el export`);
      } else {
        await sol.agregarLinea(solicitudId, {
          sku: r.sku, descripcion: r.descripcion, cantidad, proveedor: r.supplier || '', fecha_estimada: fechaEstimada,
          ultimo_costo_usd: r.ultimoCostoUsd || r.costoUnitUsd || null, piezas_por_contenedor: ppc || null, contenedores: cnts, es_consolidado: !!r.esConsolidado,
        });
        toast.ok(`${r.sku} · ${int(cantidad)} pz agregado al export`);
      }
    } catch (e) {
      toast.error(`No se pudo agregar: ${e?.message || e}`);
    }
  };

  const botonExport = (
    <button type="button" onClick={() => setExportAbierto(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 44, padding: '0 10px', border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 15, cursor: 'pointer' }}>
      <ClipboardList size={18} strokeWidth={2.2} />Mi export
      {lineas.length > 0 && <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, background: theme.accent, color: theme.textOnDark || '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{lineas.length}</span>}
    </button>
  );

  if (!puedeVer) {
    return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="S&OP" /><Vacio icon={Lock} color={theme.textMuted} titulo="Sin acceso" sub="Tu perfil no tiene la pestaña S&OP." /></>);
  }

  const po = poAbierta ? (data?.arribos || []).find((a) => a.po === poAbierta) : null;
  return (
    <>
      <Cabecera onVolver={nav.pop} derecha={botonExport} />
      <TituloGrande titulo="S&OP" sub={kpis ? `${rows.length} SKUs${data?.universoReporte ? ' del Reporte' : ''} · sugerido ${sensible ? `${usd(kpis.valorSugerido)} USD` : `${int(kpis.sugeridoPz)} pz`}` : 'Planeación de compras'} />

      {error && <Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudo calcular el S&OP" sub={error.message} />}
      {isLoading && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton h={150} r={12} /><Skeleton h={50} r={12} /><Skeleton h={220} r={12} />
        </div>
      )}

      {kpis && (
        <HeroM eyebrow={`S&OP · ${new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}`}
          frase={kpis.conBrecha > 0 ? `${kpis.conBrecha} SKU${kpis.conBrecha === 1 ? '' : 's'} con brecha inmediata.` : 'Sin brechas de inventario a 3 meses.'}
          sub={`${int(kpis.traPz)} pz en camino${kpis.atrasados ? ` · ${kpis.atrasados} PO${kpis.atrasados === 1 ? '' : 's'} con ETA vencida` : ''}${kpis.proximo ? ` · próximo PO ${kpis.proximo.po}` : ''}`}
          stats={[
            { k: 'Con brecha', v: int(kpis.conBrecha), sub: sensible ? `${usd(kpis.valorSugerido)} sug.` : `${int(kpis.sugeridoPz)} pz sug.`, color: kpis.conBrecha > 0 ? theme.red : undefined },
            { k: 'En tránsito', v: sensible ? usd(kpis.traUsd) : int(kpis.traPz), sub: sensible ? 'USD últ. costo' : 'piezas en camino' },
            { k: 'Próx. arribo', v: kpis.proximo ? fechaCorta(kpis.proximo.eta) : '—', sub: kpis.proximo ? `${int(kpis.proximo.piezas)} pz` : 'sin ETA' },
            { k: 'LT prom.', v: kpis.ltProm != null ? `${Math.round(kpis.ltProm)} d` : '—', sub: 'lead time' },
          ]} />
      )}

      {!isLoading && !error && (
        <>
          <div style={{ padding: '12px 16px 0' }}>
            <BotonGrande icon={Search} onClick={() => setBuscando(true)}>{skus.length ? 'Agregar otro SKU' : 'Buscar SKU'}</BotonGrande>
          </div>

          {skus.length === 0 && <Vacio icon={Package} color={theme.textMuted} titulo="Consulta uno o varios SKUs" sub="Busca por SKU, descripción o proveedor: verás cobertura, venta mensual, tránsito y el sugerido de compra, y podrás agregarlo al export." style={{ padding: '24px 20px 10px' }} />}

          {skus.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '16px 28px 6px' }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted }}>SKUs <span style={{ fontFamily: MONO, letterSpacing: 0, textTransform: 'none', fontWeight: 500 }}>{skus.length}</span></span>
              <button type="button" onClick={() => setSkus([])} style={{ border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 12.5, padding: 0, cursor: 'pointer' }}>Vaciar</button>
            </div>
          )}
          {skus.map((sku) => {
            const r = bySku.get(sku);
            return r
              ? <TarjetaSop key={sku} r={r} theme={theme} hoy={hoy} linea={enExport.get(sku)} puedeEditar={puedeEditar} sensible={sensible} onQuitar={() => quitarSku(sku)} onAgregar={(n) => agregarAlExport(r, n)} />
              : <div key={sku} style={{ margin: '0 16px 10px', padding: '12px 14px', borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface, fontSize: 12.5, color: theme.textMuted, display: 'flex', justifyContent: 'space-between', gap: 10 }}><span><b style={{ color: theme.text, fontFamily: TYPO.fontDisplay }}>{sku}</b> no está en el universo del S&OP (Reporte de Resumen Clientes).</span><button type="button" onClick={() => quitarSku(sku)} style={{ border: 0, background: 'transparent', color: theme.red, fontFamily: TYPO.fontText, fontSize: 13, padding: 0, cursor: 'pointer' }}>Quitar</button></div>;
          })}

          <ListaAgrupada titulo="Próximos arribos" meta={data?.arribos?.length || undefined} style={{ marginTop: 18 }} pie="ETA = arribo a CEDIS según el master de embarques. Toca una PO para ver sus SKUs.">
            {(data?.arribos || []).length === 0 && <Vacio icon={Ship} color={theme.textMuted} titulo="Nada en camino" sub="No hay embarques pendientes en el master." style={{ padding: '22px 16px' }} />}
            {(data?.arribos || []).slice(0, 12).map((a) => {
              const vencida = a.eta && a.eta < hoy;
              return <Fila key={a.po} icon={Ship} color={vencida ? theme.orange : theme.accent} titulo={`PO ${a.po}`}
                sub={[`${a.skus.length} SKU${a.skus.length === 1 ? '' : 's'}`, cedisCorto(a.cedis), ESTATUS_CORTO[a.estatus] || a.estatus].filter(Boolean).join(' · ')}
                valor={`${int(a.piezas)} pz`} valorSub={a.eta ? `${fechaCorta(a.eta)}${vencida ? ' · vencida' : ''}` : 'sin ETA'} onClick={() => setPoAbierta(a.po)} />;
            })}
          </ListaAgrupada>

          <TiemposReales sensible={sensible} theme={theme} />
        </>
      )}

      <HojaBuscarSop abierto={buscando} onClose={() => setBuscando(false)} rows={rows} enCanasta={skus} theme={theme} onElegir={(sku) => { agregarSku(sku); setBuscando(false); }} />

      <HojaM abierto={!!po} onClose={() => setPoAbierta(null)} titulo={po ? `PO ${po.po}` : ''} sub={po ? [po.eta ? `ETA ${fechaCorta(po.eta)}` : 'sin ETA', cedisCorto(po.cedis), `${int(po.piezas)} pz`].filter(Boolean).join(' · ') : ''} alto="70vh">
        {po && (
          <ListaAgrupada pie="Toca un SKU para agregarlo a tu consulta.">
            {po.skus.map((s) => {
              const ya = skus.includes(s.sku);
              return <Fila key={s.sku} titulo={<span style={{ fontFamily: TYPO.fontDisplay }}>{s.sku}</span>} sub={s.descripcion || bySku.get(s.sku)?.descripcion || 'Sin descripción'} valor={`${int(s.piezas)} pz`} chevron={false}
                trailing={ya ? <Pill tone="gray">Consultado</Pill> : <Plus size={18} style={{ color: theme.accent }} />} onClick={ya ? undefined : () => { agregarSku(s.sku); setPoAbierta(null); }} />;
            })}
          </ListaAgrupada>
        )}
      </HojaM>

      <SOPExport sensible={sensible} abierto={exportAbierto} onClose={() => setExportAbierto(false)} sol={sol} borrador={borrador} lineas={lineas} rows={rows} puedeEditar={puedeEditar} />
    </>
  );
}

// ── Proveedores y navieras · tiempos reales (vistas v_embarques_*, migración 20260912) ──
// Mismos números que el Panel de escritorio: mediana de los contenedores YA arribados del año.
function TiemposReales({ sensible, theme }) {
  const anio = new Date().getFullYear();
  const { loading, proveedores, navieras } = useEmbarquesTiempos(anio, true);
  const tot = useMemo(() => resumenEmb(proveedores), [proveedores]);
  if (loading || !proveedores.length) return null;
  const d = (v) => (v == null ? '—' : `${Math.round(v)} d`);
  return (
    <>
      <ListaAgrupada titulo="Proveedores · tiempos reales" meta={proveedores.length} style={{ marginTop: 18 }}
        pie={`Mediana de los contenedores ya arribados en ${anio}: producción + tránsito ETD → CEDIS. El ciclo completo de una PO (emisión → CEDIS) va a la derecha.`}>
        {proveedores.slice(0, 8).map((r) => (
          <Fila key={r.supplier} icon={Factory} color={theme.accent} titulo={nombreProveedor(r.supplier)}
            sub={[`${int(r.embarques)} cnt`, r.dias_produccion_med != null ? `producción ${d(r.dias_produccion_med)}` : null, r.dias_transito_med != null ? `tránsito ${d(r.dias_transito_med)}` : null].filter(Boolean).join(' · ')}
            valor={d(r.dias_total_med)} valorSub="ciclo PO" chevron={false} />
        ))}
      </ListaAgrupada>

      {navieras.length > 0 && (
        <ListaAgrupada titulo="Navieras" meta={navieras.length}
          pie={sensible ? 'Flete por CBM del contenedor (el master lo captura por contenedor, no por renglón). La naviera viene capturada en 43 % de los embarques.' : 'La naviera viene capturada en 43 % de los embarques.'}>
          {navieras.slice(0, 6).map((r) => (
            <Fila key={r.naviera} icon={Anchor} color={theme.textMuted} titulo={r.naviera}
              sub={[`${int(r.contenedores)} cnt`, r.cbm ? `${int(r.cbm)} CBM` : null, sensible && r.usd_por_cbm ? `$${Math.round(r.usd_por_cbm)}/CBM` : null].filter(Boolean).join(' · ')}
              valor={d(r.dias_transito_med)} valorSub="tránsito" chevron={false} />
          ))}
        </ListaAgrupada>
      )}

      <div style={{ padding: '6px 28px 0', fontFamily: TYPO.fontText, fontSize: 11.5, color: theme.textMuted }}>
        Ciclo real de una PO ≈ {d(tot.totalMed)} · tránsito ETD → CEDIS ≈ {d(tot.transitoMed)}{sensible && tot.usdPorCbm ? ` · flete $${Math.round(tot.usdPorCbm)}/CBM` : ''}.
      </div>
    </>
  );
}

// ── Tarjeta por SKU · cobertura, venta mensual, tránsito + próximo arribo, sugerido y agregar al export ──
function TarjetaSop({ r, theme, hoy, linea, puedeEditar, sensible = false, onQuitar, onAgregar }) {
  const ppc = N(r.piezasPorContenedor);
  const tieneCnt = ppc > 0 && !r.esConsolidado;
  const porDefecto = N(linea?.cantidad) || N(r.sugerido) || (tieneCnt ? ppc : Math.round(N(r.necesidadNeta))) || 0;
  const [cantidad, setCantidad] = useState(porDefecto);
  useEffect(() => { setCantidad(porDefecto); }, [porDefecto]);
  const [ocupado, setOcupado] = useState(false);
  const emb = (r.embarques || []).filter((e) => N(e.cantidad) > 0).slice().sort((a, b) => String(a.eta || '9999').localeCompare(String(b.eta || '9999')));
  const proximo = emb.find((e) => e.eta && e.eta >= hoy) || emb.find((e) => e.eta) || emb[0] || null;
  const tono = tonoCobertura(r.coberturaDiasErp, r.inv);
  const sugTxt = r.sugerido > 0 ? (tieneCnt ? `${r.contenedoresSugeridos} cnt × ${int(ppc)}` : 'consolidado · pz exactas') : r.necesidadNeta > 0 ? `necesidad ${int(r.necesidadNeta)} pz (< ½ ${tieneCnt ? 'cnt' : 'PO típica'})` : 'sin brecha';
  const dato = (k, v, sub, color) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, whiteSpace: 'nowrap' }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: color || theme.text, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{v}</div>
      {sub && <div style={{ fontSize: 10.5, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );
  const enviar = async () => { setOcupado(true); try { await onAgregar(cantidad); } finally { setOcupado(false); } };
  return (
    <div style={{ margin: '0 16px 10px', borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface, fontFamily: TYPO.fontText }}>
        <div style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em' }}>{r.sku}</div>
              <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 2, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.descripcion || 'Sin descripción'}</div>
              {r.supplier && <div style={{ fontSize: 11, color: theme.textSubtle || theme.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.supplier}{r.familia ? ` · ${r.familia}` : ''}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
              <Pill tone={tono} dot>{etiquetaCobertura(r.coberturaDiasErp, r.inv)}{r.coberturaDiasErp != null ? ` · ${int(r.coberturaDiasErp)} d` : ''}</Pill>
              <button type="button" onClick={onQuitar} aria-label="Quitar" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 28, padding: '0 8px', borderRadius: 999, border: 0, background: 'transparent', color: theme.textMuted, fontFamily: TYPO.fontText, fontSize: 12, cursor: 'pointer' }}><Trash2 size={13} />Quitar</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginTop: 12 }}>
            {dato('Cobertura', r.coberturaDiasErp != null ? `${int(r.coberturaDiasErp)} d` : '—', `${int(r.inv)} pz en inventario`, r.inv > 0 ? undefined : theme.red)}
            {dato('Venta mensual', `${int(r.ritmo3m)} pz`, r.crecimientoPct > 0 ? `+${Math.round(r.crecimientoPct * 100)}% tendencia` : r.tendenciaNegativa ? 'tendencia a la baja' : 'ERP · 3 meses')}
            {dato('En tránsito', `${int(r.traCant)} pz`, proximo ? `${fechaCorta(proximo.eta)} · ${int(proximo.cantidad)} pz · PO ${proximo.po}` : 'nada en camino')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginTop: 10 }}>
            {dato('Sugerido', r.sugerido > 0 ? `${int(r.sugerido)} pz` : '—', sugTxt, r.sugerido > 0 ? theme.orange : undefined)}
            {dato('Objetivo 3 m', `${int(r.objetivo3m)} pz`, r.esCritico ? `crítico · +${r.mesesSeguridad} m seg.` : 'demanda + crecimiento')}
            {dato('Lead time', r.ltDias ? `${Math.round(r.ltDias)} d` : '—', r.ltMuestras ? `${r.ltMuestras} embarque${r.ltMuestras === 1 ? '' : 's'}` : proximo?.estatus ? ESTATUS_CORTO[proximo.estatus] || proximo.estatus : 'sin histórico')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <CampoCantidad value={cantidad} onChange={setCantidad} paso={tieneCnt ? ppc : 100} ancho={140} />
            <BotonGrande primario={!linea} icon={linea ? undefined : Plus} disabled={ocupado || !puedeEditar || !(cantidad > 0)} onClick={enviar} style={{ flex: 1, height: 44, fontSize: 15 }}>
              {ocupado ? 'Guardando…' : linea ? 'Actualizar export' : 'Agregar al export'}
            </BotonGrande>
          </div>
          {linea && <div style={{ marginTop: 8, fontSize: 11.5, color: theme.green, display: 'flex', alignItems: 'center', gap: 6 }}><ClipboardList size={13} />En el export con {int(linea.cantidad)} pz{sensible && costoDe(r) ? ` · $${int(N(linea.cantidad) * costoDe(r))} USD` : ''}</div>}
        </div>
    </div>
  );
}

// ── Buscador sobre el universo del S&OP (mismos SKUs y orden que la tabla de escritorio) ──
function HojaBuscarSop({ abierto, onClose, onElegir, rows, enCanasta, theme }) {
  const [q, setQ] = useState('');
  const nq = q.trim().toLowerCase();
  const res = useMemo(() => {
    if (!nq) return [];
    const terms = nq.split(/\s+/);
    return rows.filter((r) => { const t = `${r.sku} ${r.descripcion} ${r.supplier} ${r.familia}`.toLowerCase(); return terms.every((w) => t.includes(w)); })
      .sort((a, b) => (b.sku.toLowerCase().startsWith(nq) - a.sku.toLowerCase().startsWith(nq)) || b.sugerido - a.sugerido).slice(0, 25);
  }, [nq, rows]);
  const conSugerido = useMemo(() => rows.filter((r) => r.sugerido > 0).sort((a, b) => b.sugerido * costoDe(b) - a.sugerido * costoDe(a)).slice(0, 10), [rows]);
  const fila = (r) => {
    const ya = enCanasta.includes(r.sku);
    return <Fila key={r.sku} titulo={<span style={{ fontFamily: TYPO.fontDisplay }}>{r.sku}</span>} sub={r.descripcion || 'Sin descripción'} chevron={false}
      valor={<span style={{ fontFamily: MONO, fontSize: 13, color: r.sugerido > 0 ? theme.orange : theme.text }}>{r.sugerido > 0 ? int(r.sugerido) : int(r.inv)}</span>} valorSub={r.sugerido > 0 ? 'sugerido' : 'inv.'}
      trailing={ya ? <Pill tone="gray">Consultado</Pill> : <Plus size={18} style={{ color: theme.accent }} />} onClick={ya ? undefined : () => onElegir(r.sku)} />;
  };
  return (
    <HojaM abierto={abierto} onClose={onClose} titulo="Buscar SKU" sub={`${rows.length} SKUs en el S&OP`} alto="86vh">
      <div style={{ padding: '0 16px 12px' }}>
        <CampoBusqueda value={q} onChange={setQ} placeholder="SKU, descripción o proveedor" autoFocus={abierto} onSubmit={() => { if (res[0]) onElegir(res[0].sku); }} />
      </div>
      {!nq && conSugerido.length > 0 && <ListaAgrupada titulo="Con sugerido de compra" meta={rows.filter((r) => r.sugerido > 0).length}>{conSugerido.map(fila)}</ListaAgrupada>}
      {!nq && conSugerido.length === 0 && <Vacio icon={null} titulo="Escribe parte del SKU" sub="Por ejemplo AC-943 o “teclado”. Enter agrega el primer resultado." />}
      {nq && res.length === 0 && <Vacio icon={null} titulo="Sin coincidencias" sub="Sólo se buscan los SKUs del Reporte de Resumen Clientes." />}
      {res.length > 0 && <ListaAgrupada>{res.map(fila)}</ListaAgrupada>}
    </HojaM>
  );
}
