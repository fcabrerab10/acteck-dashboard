// S&OP del celular (3.83.0 · 2026-10-05, mockup 696658b3 v2 + cambios de Fernando: PO abrible en «Lo que viene» y
// «Mis clientes» como el lado de compras del forecast que se captura en Proyectos y forecast).
//
//   Empresa      → TituloGrande + Segmented → HeroM «Lo que viene» → 4 KpiM (Llega este mes · Llega el mes siguiente ·
//                  Siguiente arribo · En camino total) → gráfica demanda vs lo que tendremos (6 meses, se lee arrastrando)
//                  → «Comprar ahora» con «+ Solicitud» por SKU y «Agregar todos» → tabla por SKU (Días · Venta/mes ·
//                  Stock · Llega · Sug.) ordenable, chips Todos · Críticos · Sin PO · marcas, buscador que entiende.
//   Mis clientes → forecast capturado de Digitalife, PCEL y Dicotech − inventario del cliente − nuestro stock − tránsito
//                  = qué pedirle a Compras (calculo.js#calcularMisClientes). Aquí no se captura: eso es Proyectos y forecast.
//   Solicitud    → el mismo borrador de solicitudes_compra que la computadora (SOPExport.jsx: Excel + compartir + cerrar).
// Mismo motor que la web (forecast/calculo.js#calcularForecast). Tocar un SKU abre Producto 360 en la cara Abasto.
import React, { useMemo, useState } from 'react';
import { ClipboardList, Lock, AlertTriangle, FileText } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { isoLocal } from '../../../lib/format';
import { puedeVerPestanaGlobal, puedeEditarPestanaGlobal, puedeVerSensible } from '../../../lib/permisos';
import { interpretarBusqueda, coincideSku, indiceSku, quitarChip } from '../../../lib/buscarSku';
import { useSolicitudes } from '../../../modules/comercial/forecast/useSolicitudes';
import { useNav } from '../../nav';
import { Cabecera, TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, Segmented, Pill, Vacio, Skeleton, GraficaScrub, LeyendaScrub, CampoBusqueda, BotonGrande, toast } from '../../piezas';
import TablaAnual from '../sellout/TablaAnual';
import { ChipsEntendido } from '../sellout/DetalleSkuAnual';
import SOPExport from '../SOPExport';
import Producto360 from '../producto/Producto360';
import LoQueViene from './LoQueViene';
import FichaPO from './FichaPO';
import { useSopEmpresa, useSopClientes } from './datos';
import { arribosPorPo, resumenEmpresa, serieDemanda, comprarAhora, filasDetalle, COLS_DETALLE, calcularMisClientes, fraseMisClientes, mesesDesde, usdCompact, fechaCorta, cedisCorto, costoDe } from './calculo';
import { int, N } from '../../util';

const VISTAS = [{ id: 'empresa', label: 'Empresa' }, { id: 'clientes', label: 'Mis clientes' }];
const FILTROS = [{ id: 'todos', label: 'Todos' }, { id: 'criticos', label: 'Críticos' }, { id: 'sinPo', label: 'Sin PO' }, { id: 'acteck', label: 'Acteck' }, { id: 'balam rush', label: 'Balam Rush' }, { id: 'audive', label: 'Audive' }];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const pz = (n) => `${int(n)} pz`;

function Seccion({ children, meta, accion, style }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px 6px 2px', ...style }}>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: theme.text }}>{children}{meta != null && <span style={{ color: theme.textMuted, fontWeight: 500 }}> · {meta}</span>}</span>
      {accion}
    </div>
  );
}

function BotonSolicitud({ ya, onClick, disabled }) {
  const { theme } = useTheme();
  return (
    <button type="button" onClick={onClick} disabled={disabled || ya} style={{ flexShrink: 0, height: 30, padding: '0 10px', borderRadius: 999, border: 0, background: ya ? `${theme.green}22` : `${theme.accent}1A`, color: ya ? theme.green : theme.accent, fontFamily: TYPO.fontText, fontSize: 12, fontWeight: 600, cursor: ya || disabled ? 'default' : 'pointer', opacity: disabled && !ya ? 0.5 : 1 }}>
      {ya ? 'En solicitud' : '+ Solicitud'}
    </button>
  );
}

// ─── Empresa (vista pura) ───
export function SopEmpresaVista({ res, serie, comprar, filas, categorias = [], sensible = false, puedeEditar = false, enSolicitud = new Set(), filtro = 'todos', onFiltro, onPo, onLoQueViene, onSku, onAgregar, onAgregarTodos, hoy = new Date() }) {
  const { theme } = useTheme();
  const [q, setQ] = useState('');
  const [todas, setTodas] = useState(false);
  const interp = useMemo(() => interpretarBusqueda(q, { categorias }), [q, categorias]);
  const indices = useMemo(() => new Map(filas.map((f) => [f.sku, indiceSku(f)])), [filas]);
  const visibles = useMemo(() => (interp.vacio ? filas : filas.filter((f) => coincideSku(f, interp, indices.get(f.sku)))), [filas, interp, indices]);
  const tabla = useMemo(() => (todas ? visibles : visibles.slice(0, 80)).map((f) => ({ ...f, onClick: onSku ? () => onSku(f.sku) : undefined })), [visibles, todas, onSku]);
  const fmtTabla = (n) => (n == null ? '—' : Math.round(n).toLocaleString('es-MX'));
  const mesLbl = (m) => MESES_LARGO[m.mes - 1];
  const sig = res.siguiente;
  return (
    <>
      <HeroM eyebrow="Lo que viene" frase={res.frase} sub={res.sub} />
      <KpiGrid data-entrada-kpis style={{ marginTop: 10 }}>
        <KpiM eyebrow={`Llega en ${mesLbl(res.mesActual)}`} big={res.mesActual.pos ? (sensible ? usdCompact(res.mesActual.usd) : pz(res.mesActual.pz)) : '—'} sub={res.mesActual.pos ? `${sensible ? `USD · ${pz(res.mesActual.pz)} · ` : ''}${res.mesActual.pos} PO` : 'nada con ETA este mes'} onClick={() => onLoQueViene?.()} />
        <KpiM eyebrow={`Llega en ${mesLbl(res.mesSiguiente)}`} big={res.mesSiguiente.pos ? (sensible ? usdCompact(res.mesSiguiente.usd) : pz(res.mesSiguiente.pz)) : '—'} sub={res.mesSiguiente.pos ? `${sensible ? `USD · ${pz(res.mesSiguiente.pz)} · ` : ''}${res.mesSiguiente.pos} PO` : 'nada con ETA el mes siguiente'} onClick={() => onLoQueViene?.()} />
        <KpiM eyebrow="Siguiente arribo" big={sig ? fechaCorta(sig.eta) : '—'} sub={sig ? [sig.contenedor || `PO ${sig.po}`, `${sig.nSkus} SKU${sig.nSkus === 1 ? '' : 's'}`, pz(sig.piezas), cedisCorto(sig.cedis) || null].filter(Boolean).join(' · ') : 'sin ETA'} onClick={sig ? () => onPo?.(sig) : undefined} bigColor={sig && sig.dias != null && sig.dias <= 3 ? theme.green : undefined} />
        <KpiM eyebrow="En camino total" big={sensible ? usdCompact(res.total.usd) : pz(res.total.pz)} sub={`${sensible ? `${pz(res.total.pz)} · ` : ''}${res.total.pos} PO${res.total.vencidas ? ` · ${res.total.vencidas} vencida${res.total.vencidas === 1 ? '' : 's'}` : ''}`} bigColor={res.total.vencidas ? theme.orange : undefined} onClick={() => onLoQueViene?.()} />
      </KpiGrid>

      <div style={{ padding: '0 16px', marginTop: 18 }}>
        <Seccion accion={<span style={{ fontSize: 11, color: theme.textMuted }}>arrastra para leer</span>}>Demanda vs lo que tendremos</Seccion>
        <div style={{ background: theme.surface, borderRadius: 14, padding: '10px 10px 6px' }}>
          <GraficaScrub series={[{ key: 'demanda', label: 'Demanda', color: theme.accent, area: true }, { key: 'tendremos', label: 'Stock + llega', color: theme.teal || '#64D2FF' }, { key: 'falta', label: 'Se queda corto', color: theme.red, dash: true }]}
            datos={serie.map((m) => ({ label: m.label.split(' ')[0], demanda: m.demanda, tendremos: m.tendremos, falta: m.falta, llega: m.llega }))} formato={(n) => int(n)}
            tooltip={(f) => <><b style={{ fontSize: 12.5 }}>{f.label}</b> · demanda <b style={{ fontSize: 12.5 }}>{pz(f.demanda)}</b> · stock + llega {int(f.tendremos)}{f.llega ? ` (llegan ${int(f.llega)})` : ''}{f.falta > 0 ? <> · faltan <b style={{ color: theme.red, fontSize: 12.5 }}>{pz(f.falta)}</b></> : ' · cubierto'}</>} />
          <LeyendaScrub items={[{ color: theme.accent, label: 'Demanda' }, { color: theme.teal || '#64D2FF', label: 'Stock + llega' }, { color: theme.red, label: 'Se queda corto', dash: true }]} derecha={serie.length ? `${serie[0].label.split(' ')[0]} → ${serie[serie.length - 1].label.split(' ')[0]}` : ''} />
        </div>
      </div>

      <ListaAgrupada titulo="Comprar ahora" meta={comprar.total ? `${comprar.total} SKU${comprar.total === 1 ? '' : 's'} · ${pz(comprar.piezas)}${sensible && comprar.usd ? ` · ${usdCompact(comprar.usd)} USD` : ''}` : undefined} style={{ marginTop: 18 }}
        accion={puedeEditar && comprar.total > 0 ? <Pill tone="blue" onClick={onAgregarTodos} style={{ cursor: 'pointer' }}>Agregar todos a la solicitud</Pill> : null}
        pie={comprar.total ? 'Sugerido del motor del S&OP: contenedor completo (o consolidado) cuando la necesidad pasa de la mitad. Los más urgentes primero.' : undefined}>
        {!comprar.total && <Vacio titulo="Nada que comprar ahora" sub="Ningún SKU del universo del S&OP tiene sugerido de compra a 3 meses." style={{ padding: '20px 16px' }} />}
        {comprar.lista.map((c) => (
          <Fila key={c.sku} titulo={`${c.sku}${c.descripcion ? ` ${c.descripcion}` : ''}`} sub={c.linea} valor={pz(c.piezas)} valorSub={sensible && c.usd ? `${usdCompact(c.usd)} USD` : null} chevron={false}
            onClick={onSku ? () => onSku(c.sku) : undefined} trailing={<BotonSolicitud ya={enSolicitud.has(c.sku)} disabled={!puedeEditar} onClick={(e) => { e?.stopPropagation?.(); onAgregar?.(c.row, c.piezas); }} />} />
        ))}
      </ListaAgrupada>

      <div style={{ padding: '0 16px', marginTop: 18 }}>
        <Seccion meta={visibles.length}>Detalle por SKU</Seccion>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', padding: '2px 0 8px' }}>
          {FILTROS.map((f) => <Pill key={f.id} tone={filtro === f.id ? 'blue' : 'gray'} onClick={() => onFiltro?.(f.id)} style={{ cursor: 'pointer', flexShrink: 0 }}>{f.label}</Pill>)}
        </div>
        <CampoBusqueda value={q} onChange={setQ} placeholder="SKU, marca, categoría, pulgadas…" />
        <ChipsEntendido chips={interp.chips} onQuitar={(c) => setQ(quitarChip(q, c, { categorias }))} />
        <div style={{ marginTop: 8 }}>
          <TablaAnual columnas={COLS_DETALLE} filas={tabla} fmt={fmtTabla} etiquetaFilas="SKU" conTotalFila={false} conTotalCol={false} conProm={false} ordenable vacio="Ningún SKU con esos filtros." />
        </div>
        {visibles.length > 80 && !todas && <button type="button" onClick={() => setTodas(true)} style={{ width: '100%', marginTop: 8, height: 40, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.accent, fontFamily: TYPO.fontText, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Mostrar los {visibles.length}</button>}
        <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 8, lineHeight: 1.4 }}>Días = cobertura con la venta real de 3 meses · Venta/mes = demanda mensual del motor · Llega = en tránsito · Sug. = sugerido de compra. Toca un encabezado para ordenar y un SKU para abrirlo.</div>
      </div>
    </>
  );
}

// ─── Mis clientes (vista pura) ───
export function SopClientesVista({ res, sensible = false, puedeEditar = false, enSolicitud = new Set(), onCliente, onSku, onAgregar, onAgregarTodos, onForecast }) {
  const { theme } = useTheme();
  const t = res.totales;
  const sub = [...res.porCliente.filter((c) => c.forecastPz > 0).map((c) => `${c.label} ${pz(c.forecastPz)}`), res.ventana.length ? `${res.ventana[0].label.split(' ')[0].toLowerCase()} → ${res.ventana[res.ventana.length - 1].label.split(' ')[0].toLowerCase()}` : null].filter(Boolean).join(' · ');
  return (
    <>
      <HeroM eyebrow="Forecast − inventario − tránsito" frase={fraseMisClientes(res, { sensible })} sub={sub || undefined} />
      <div style={{ padding: '0 16px', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {res.porCliente.map((c) => (
          <div key={c.key} role="button" onClick={() => onCliente?.(c.key)} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, color: theme.text }}>{c.label}</div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{c.forecastPz > 0 ? `${pz(c.forecastPz)} forecast · ${c.skus} SKU${c.skus === 1 ? '' : 's'}` : 'sin forecast capturado'}</div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{c.forecastPz > 0 ? `cubierto ${int(c.cubierto)} · ${c.falta > 0 ? `faltan ${int(c.falta)} desde ${c.primerHuecoLabel}` : 'todo cubierto'}` : 'captúralo en Proyectos y forecast'}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: c.falta > 0 ? theme.text : theme.green }}>{c.falta > 0 ? (sensible && c.usd > 0 ? usdCompact(c.usd) : pz(c.falta)) : '✓'}</div>
              <div style={{ fontSize: 10.5, color: theme.textMuted }}>{c.falta > 0 ? (sensible && c.usd > 0 ? 'USD por comprar' : 'por comprar') : 'cubierto'}</div>
            </div>
          </div>
        ))}
      </div>

      <ListaAgrupada titulo="Comprar para mis clientes" meta={t.skus ? `${t.skus} SKU${t.skus === 1 ? '' : 's'} · ${pz(t.falta)}${sensible && t.usd ? ` · ${usdCompact(t.usd)} USD` : ''}` : undefined} style={{ marginTop: 18 }}
        accion={puedeEditar && t.skus > 0 ? <Pill tone="blue" onClick={onAgregarTodos} style={{ cursor: 'pointer' }}>Agregar todos a la solicitud</Pill> : null}
        pie="Si cambias el forecast en Proyectos y forecast, esta lista se recalcula sola. El inventario del cliente consume primero su propio forecast; después nuestro stock y lo que viene cubren a los tres por orden de mes.">
        {!t.skus && <Vacio titulo={t.forecastPz > 0 ? 'Todo el forecast está cubierto' : 'Sin forecast que comprar'} sub={t.forecastPz > 0 ? 'Con lo que tienen, tenemos y viene alcanza para la ventana.' : 'Captura el forecast de tus clientes en Proyectos y forecast.'} style={{ padding: '20px 16px' }} />}
        {res.comprar.slice(0, 30).map((c) => (
          <Fila key={c.sku} titulo={`${c.sku}${c.descripcion ? ` ${c.descripcion}` : ''}`} sub={[c.clientes.map((x) => x.label).join(' + '), `falta desde ${c.desdeLabel}`, c.tienePo ? 'con PO en camino' : 'sin PO'].join(' · ')}
            valor={pz(c.piezas)} valorSub={sensible && c.usd ? `${usdCompact(c.usd)} USD` : null} chevron={false} onClick={onSku ? () => onSku(c.sku) : undefined}
            trailing={<BotonSolicitud ya={enSolicitud.has(c.sku)} disabled={!puedeEditar} onClick={(e) => { e?.stopPropagation?.(); onAgregar?.(c); }} />} />
        ))}
      </ListaAgrupada>
      <div style={{ margin: '14px 16px 0' }}>
        <BotonGrande icon={FileText} onClick={() => onForecast?.(null)}>Capturar forecast en Proyectos y forecast</BotonGrande>
      </div>
    </>
  );
}

// ─── Pantalla ───
export default function SopM({ inicial = null }) {
  const { theme } = useTheme();
  const nav = useNav();
  const perfil = nav.perfil;
  const puedeVer = puedeVerPestanaGlobal(perfil, 'forecast_clientes');
  const sensible = puedeVerSensible(perfil);
  const puedeEditar = puedeEditarPestanaGlobal(perfil, 'forecast_solicitudes');
  const hoy = useMemo(() => new Date(), []);
  const [vista, setVista] = useState(inicial?.vista === 'clientes' ? 'clientes' : 'empresa');
  const [filtro, setFiltro] = useState('todos');
  const [exportAbierto, setExportAbierto] = useState(false);
  const { data, isLoading, error } = useSopEmpresa(puedeVer);
  const cli = useSopClientes(puedeVer && vista === 'clientes');
  const sol = useSolicitudes(perfil);

  const rows = data?.rows || [];
  const porSku = useMemo(() => new Map(rows.map((r) => [r.sku, r])), [rows]);
  const arribos = useMemo(() => (data ? arribosPorPo({ transito: data.transito, porSku, descripciones: data.descripciones, navieraPor: data.navieraPor, hoy }) : []), [data, porSku, hoy]);
  const res = useMemo(() => (data ? resumenEmpresa({ rows, arribos, hoy, sensible }) : null), [data, rows, arribos, hoy, sensible]);
  const serie = useMemo(() => (data ? serieDemanda({ rows, llegadas: data.llegadas, hoy, meses: 6 }) : []), [data, rows, hoy]);
  const comprar = useMemo(() => comprarAhora(rows), [rows]);
  const filas = useMemo(() => filasDetalle(rows, { filtro }).sort((a, b) => (a.dias ?? 1e9) - (b.dias ?? 1e9) || b.valores[1] - a.valores[1]), [rows, filtro]);
  const categorias = useMemo(() => [...new Set(rows.map((r) => String(r.familia || '').trim()).filter(Boolean))].sort(), [rows]);
  const ventana = useMemo(() => mesesDesde(hoy, 6, 1), [hoy]);
  const costos = useMemo(() => new Map(rows.map((r) => [r.sku, costoDe(r)])), [rows]);
  const resCli = useMemo(() => (data && vista === 'clientes' ? calcularMisClientes({ clientes: cli.clientes.map((c) => ({ key: c.key, label: c.label, forecast: c.forecast, stock: c.stock })), inventario: data.inventarioMap, llegadas: data.llegadas, ventana, costos: sensible ? costos : new Map(), descripciones: data.descripciones, hoy }) : null), [data, vista, cli.clientes, ventana, costos, sensible, hoy]);

  const borrador = sol.borradores[0] || null;
  const lineas = borrador ? sol.lineasDe(borrador.id) : [];
  const enSolicitud = useMemo(() => new Set(lineas.map((l) => l.sku)), [lineas]);

  const agregar = async (r, cantidad, { silencioso = false } = {}) => {
    if (!puedeEditar) { toast.error('Tu perfil no puede crear solicitudes de compra.'); return false; }
    if (!(cantidad > 0)) return false;
    try {
      let id = borrador?.id;
      if (!id) { const nuevo = await sol.crearBorrador('S&OP celular'); id = nuevo?.id; }
      if (!id) throw new Error('No se pudo crear el borrador');
      const ppc = N(r?.piezasPorContenedor);
      let fechaEstimada = null;
      if (r?.ltDias > 0) { const d = new Date(); d.setDate(d.getDate() + Math.round(r.ltDias)); fechaEstimada = isoLocal(d); }
      const existente = lineas.find((l) => l.sku === r.sku);
      if (existente) await sol.editarLinea(existente.id, { cantidad, contenedores: ppc > 0 ? Math.ceil(cantidad / ppc) : null });
      else await sol.agregarLinea(id, { sku: r.sku, descripcion: r.descripcion || '', cantidad, proveedor: r.supplier || '', fecha_estimada: fechaEstimada, ultimo_costo_usd: costoDe(r) || null, piezas_por_contenedor: ppc || null, contenedores: ppc > 0 ? Math.ceil(cantidad / ppc) : null, es_consolidado: !!r.esConsolidado });
      if (!silencioso) toast.ok(`${r.sku} · ${pz(cantidad)} en la solicitud`);
      return true;
    } catch (e) { toast.error(`No se pudo agregar: ${e?.message || e}`); return false; }
  };
  const agregarTodos = async (items) => {
    const pendientes = items.filter((x) => !enSolicitud.has(x.sku));
    if (!pendientes.length) { toast.info('Ya están todos en la solicitud'); return; }
    let n = 0;
    for (const x of pendientes) if (await agregar(x.row || porSku.get(x.sku) || { sku: x.sku, descripcion: x.descripcion }, x.piezas, { silencioso: true })) n += 1;
    toast.ok(`${n} SKU${n === 1 ? '' : 's'} agregado${n === 1 ? '' : 's'} a la solicitud`);
  };
  const abrirSku = (sku) => nav.push(<Producto360 sku={sku} cara="abasto" />, `producto-${sku}`);
  const abrirPo = (p) => nav.push(<FichaPO po={p} sensible={sensible} />, `po-${p.po}`);
  const abrirLoQueViene = () => nav.push(<LoQueViene arribos={arribos} sensible={sensible} />, 'lo-que-viene');
  const irForecast = (cliente) => nav.navegar({ pagina: 'forecastReservas', extra: cliente ? { cliente } : null });

  const botonSolicitud = (
    <button type="button" onClick={() => setExportAbierto(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 44, padding: '0 10px', border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 15, cursor: 'pointer' }}>
      <ClipboardList size={18} strokeWidth={2.2} />Solicitud
      {lineas.length > 0 && <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, background: theme.accent, color: theme.textOnDark || '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{lineas.length}</span>}
    </button>
  );

  if (!puedeVer) return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="S&OP" /><Vacio icon={Lock} color={theme.textMuted} titulo="Sin acceso" sub="Tu perfil no tiene la pestaña S&OP." /></>);

  const mesTxt = `${MESES_LARGO[hoy.getMonth()].replace(/^./, (c) => c.toUpperCase())} ${hoy.getFullYear()}`;
  return (
    <div style={{ paddingBottom: 24 }}>
      <Cabecera onVolver={nav.pop} derecha={botonSolicitud} />
      <TituloGrande titulo="S&OP" sub={vista === 'empresa' ? `${mesTxt} · motor de 3 meses${rows.length ? ` · ${int(rows.length)} SKUs${data?.universoReporte ? ' del Reporte' : ''}` : ''}` : `${mesTxt} · lo que exige el forecast de mis clientes`} />
      <div style={{ padding: '0 16px 10px' }}><Segmented size="md" options={VISTAS} value={vista} onChange={setVista} style={{ display: 'flex', width: '100%' }} /></div>

      {error && <Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudo calcular el S&OP" sub={String(error.message || error)} />}
      {isLoading && <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={150} r={12} /><Skeleton h={120} r={12} /><Skeleton h={220} r={12} /></div>}

      {!isLoading && !error && res && vista === 'empresa' && (
        <SopEmpresaVista res={res} serie={serie} comprar={comprar} filas={filas} categorias={categorias} sensible={sensible} puedeEditar={puedeEditar} enSolicitud={enSolicitud} filtro={filtro} onFiltro={setFiltro} hoy={hoy}
          onPo={abrirPo} onLoQueViene={abrirLoQueViene} onSku={abrirSku} onAgregar={agregar} onAgregarTodos={() => agregarTodos(comprar.todos)} />
      )}
      {!isLoading && !error && vista === 'clientes' && (cli.loading || !resCli
        ? <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={150} r={12} /><Skeleton h={200} r={12} /></div>
        : <SopClientesVista res={resCli} sensible={sensible} puedeEditar={puedeEditar} enSolicitud={enSolicitud} onCliente={irForecast} onForecast={irForecast} onSku={abrirSku}
            onAgregar={(c) => agregar(porSku.get(c.sku) || { sku: c.sku, descripcion: c.descripcion }, c.piezas)} onAgregarTodos={() => agregarTodos(resCli.comprar)} />)}

      <SOPExport sensible={sensible} abierto={exportAbierto} onClose={() => setExportAbierto(false)} sol={sol} borrador={borrador} lineas={lineas} rows={rows} puedeEditar={puedeEditar} />
    </div>
  );
}
