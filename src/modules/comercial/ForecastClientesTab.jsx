// S&OP · Planeación de compras (Acteck) · V3 (kit completo, 2026-09-11).
// ─────────────────────────────────────────────────────────────────────────────────────────────
// Motor PURO compartido con el móvil: forecast/calculo.js (calcularForecast) — aquí no se calcula nada de negocio.
// Plantilla: Hero narrativo → 4 KpiCard → Buscador + filtros facetados → tabla (TablaCompacta con drill) →
// secundarios en Panel plegable (Últimas compras, Calendario de tránsito). El carrito "Mi Export" vive en una
// HojaLateral (pill flotante abajo a la derecha + KPI "Export activo"); el preview/modal de exportar es el mismo.
// Sensible (permisos.puedeVerSensible): sin él nada de USD (hero, KPIs, drill, carrito, preview, Excel/PDF).
// Foto mensual silenciosa del forecast → forecast/snapshot.js (tabla forecast_snapshots).
//
// Segmented "Forecast · Reuniones" (2026-09-11): la vista Reuniones (forecast/reuniones/) es el repositorio de la reunión
// mensual de S&OP (correo del CRM pegado → sop_reuniones) y sustituye a las solicitudes de compra: ya no se muestran
// SugeridosPendientes ni SolicitudesModal; el historial del carrito vive en "Exports anteriores" dentro de Reuniones.
//
// Piezas en ./forecast/: useForecastData (carga), motorFiltros + FiltrosSOP (buscador/pills), TablaForecast + DrillSku,
// ExportCart + ExportPreviewModal, UltimasComprasCard, TransitoTimeline, AgregarLineaModal, useSolicitudes, excelSOP,
// snapshot, reuniones/ (Reuniones, FormularioReunion, DetalleReunion, parserCorreo, cruce, useReuniones).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ShoppingCart, Plus, CalendarDays, LayoutList } from 'lucide-react';
import { usePerfil } from '../../lib/perfilContext';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { elevation, bordeFlotante } from '../../lib/elevation';
import { puedeEditarPestanaGlobal, puedeVerPestanaGlobal, puedeVerSensible } from '../../lib/permisos';
import { compartirArchivo } from '../../lib/compartirArchivo';
import SinAcceso from '../../components/SinAcceso';
import ExportMenu from '../../components/ExportMenu';
import { Hero, KpiCard, Panel, Boton, Pill, Cargando, Segmented, toast } from '../../components/kit';
import { inventarioDesdeVista, tooltip } from '../../lib/medidas';
import { useMedidasInventario } from '../../lib/queries';
import { HojaLateral } from '../../components/perfil/comun';
import Buscador from './sellin/Buscador';
import { MESES_LARGO } from './sellin/textos';
import { fmtInt } from './inventario/constantes';
import { useForecastData } from './forecast/useForecastData';
import { calcularForecast } from './forecast/calculo';
import { useSolicitudes } from './forecast/useSolicitudes';
import { exportarSolicitudExcel, solicitudExcelBlob } from './forecast/excelSOP';
import { FILTROS_VACIOS, indexar, tokensBusqueda, pasaTodos, facetas as calcularFacetas, nActivos as contarActivos } from './forecast/motorFiltros';
import FiltrosSOP from './forecast/FiltrosSOP';
import TablaForecast, { fmtEtaCorta } from './forecast/TablaForecast';
import ExportCart from './forecast/ExportCart';
import ExportPreviewModal from './forecast/ExportPreviewModal';
import UltimasComprasCard from './forecast/UltimasComprasCard';
import TransitoTimeline from './forecast/TransitoTimeline';
import Reuniones from './forecast/reuniones/Reuniones';
import AgregarLineaModal from './forecast/AgregarLineaModal';
import { guardarSnapshotMensual, esPerfilInterno } from './forecast/snapshot';

// El sugerido siempre se calcula sobre 3 meses (regla fija de la fórmula, Fase 4).
const HORIZONTE = 3;
const usd0 = (n) => `$${Math.round(n || 0).toLocaleString('es-MX')}`;

export default function ForecastClientesTab() {
  const perfil = usePerfil();
  if (!puedeVerPestanaGlobal(perfil, 'forecast_clientes')) return <SinAcceso motivo="No tienes acceso a S&OP." />;
  return <ForecastPantalla perfil={perfil} sensible={puedeVerSensible(perfil)} />;
}

function ForecastPantalla({ perfil, sensible }) {
  const { theme } = useTheme();
  const rootRef = useRef(null);
  const data = useForecastData();
  const sol = useSolicitudes(perfil);

  // Permisos: puedeEditarSol → crear/editar/cerrar solicitudes · puedeVerSol → ver el export/historial.
  const puedeEditarSol = puedeEditarPestanaGlobal(perfil, 'forecast_solicitudes');
  const puedeVerSol = puedeVerPestanaGlobal(perfil, 'forecast_solicitudes');

  // ── Estado de UI ──
  const [busqueda, setBusqueda] = useState('');
  const [f, setF] = useState(FILTROS_VACIOS);
  const [expandedSku, setExpandedSku] = useState(null);
  // Sin sort explícito → orden del Reporte (reporte_skus.orden). Click en columna activa el sort.
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('desc');
  const [borradorActivoId, setBorradorActivoId] = useState(null);
  const [hojaExport, setHojaExport] = useState(false);
  // Vista: 'forecast' (detalle por SKU) · 'reuniones' (repositorio de reuniones S&OP).
  const [vista, setVista] = useState('forecast');
  const [previewExportOpen, setPreviewExportOpen] = useState(false);
  const [skuParaAgregar, setSkuParaAgregar] = useState(null);
  const [agregandoTodos, setAgregandoTodos] = useState(false);

  // Borrador activo: el más reciente si no hay uno elegido (o si el elegido desapareció).
  useEffect(() => {
    if (!borradorActivoId && sol.borradores.length > 0) setBorradorActivoId(sol.borradores[0].id);
    if (borradorActivoId && !sol.borradores.find((b) => b.id === borradorActivoId)) setBorradorActivoId(sol.borradores[0]?.id || null);
  }, [sol.borradores, borradorActivoId]);

  // ── Motor ──
  const rowsAll = useMemo(() => (data.loading ? [] : indexar(calcularForecast(data, HORIZONTE))), [data]);
  const metaBySku = useMemo(() => Object.fromEntries((data.metadata || []).map((r) => [r.sku, r])), [data.metadata]);

  // Foto mensual silenciosa (una vez al día por usuario, sólo internos).
  useEffect(() => { if (!data.loading && rowsAll.length) guardarSnapshotMensual(rowsAll, perfil); }, [data.loading, rowsAll, perfil]);

  // ── Búsqueda + filtros facetados ──
  useEffect(() => { setF((p) => ({ ...p, tokens: tokensBusqueda(busqueda) })); }, [busqueda]);
  const facetas = useMemo(() => calcularFacetas(rowsAll, f), [rowsAll, f]);
  const rowsFiltrados = useMemo(() => rowsAll.filter((r) => pasaTodos(r, f)), [rowsAll, f]);
  const nActivos = contarActivos(f);
  const onToggle = (g, id) => setF((p) => { const n = new Set(p[g]); if (n.has(id)) n.delete(id); else n.add(id); return { ...p, [g]: n }; });
  const limpiar = () => { setF({ ...FILTROS_VACIOS(), tokens: tokensBusqueda(busqueda) }); };

  const rowsOrdenados = useMemo(() => {
    if (!sortCol) return rowsFiltrados;
    const arr = [...rowsFiltrados];
    const dir = sortDir === 'desc' ? -1 : 1;
    arr.sort((a, b) => {
      const va = a[sortCol] ?? 0, vb = b[sortCol] ?? 0;
      if (typeof va === 'string' || typeof vb === 'string') return dir * String(va).localeCompare(String(vb));
      return dir * (va - vb);
    });
    return arr;
  }, [rowsFiltrados, sortCol, sortDir]);
  const onSort = (c) => { if (sortCol === c) setSortDir(sortDir === 'desc' ? 'asc' : 'desc'); else { setSortCol(c); setSortDir('desc'); } };

  // Medida oficial [Dias de Inv] del director (global, en pesos a costo). El motor
  // de S&OP necesita su propia cobertura POR SKU en piezas (no hay costo de venta
  // por SKU), así que se muestran LAS DOS, cada una con su etiqueta.
  const { data: medInvRow } = useMedidasInventario();
  const medInv = useMemo(() => inventarioDesdeVista(medInvRow), [medInvRow]);

  // ── KPIs (sobre el universo completo, como el hero original) ──
  const kpis = useMemo(() => {
    const conBrecha = rowsAll.filter((r) => r.brecha > 0);
    const conSugerido = rowsAll.filter((r) => Number(r.sugerido || 0) > 0);
    const sobrestock = rowsAll.filter((r) => r.inv > 0 && (r.coberturaDiasErp == null || r.coberturaDiasErp > 90));
    const criticos = rowsAll.filter((r) => r.coberturaDiasErp != null && r.coberturaDiasErp < 30);
    const conDemanda = rowsAll.filter((r) => Number(r.demandaMesErp || 0) > 0);
    const enTransito = rowsAll.filter((r) => r.traCant > 0);
    const traPz = enTransito.reduce((a, r) => a + Number(r.traCant || 0), 0);
    const proxEta = enTransito.map((r) => r.traEta).filter(Boolean).sort()[0] || null;
    const valorSugeridoUsd = conSugerido.reduce((a, r) => a + Number(r.sugerido || 0) * Number(r.ultimoCostoUsd || r.costoUnitUsd || 0), 0);
    const sugeridoPz = conSugerido.reduce((a, r) => a + Number(r.sugerido || 0), 0);
    const sugeridoCnt = conSugerido.reduce((a, r) => a + Number(r.contenedoresSugeridos || 0), 0);
    const ltValores = rowsAll.filter((r) => r.ltDias).map((r) => r.ltDias);
    const ltPromedio = ltValores.length ? ltValores.reduce((a, b) => a + b, 0) / ltValores.length : 0;
    return { conBrecha: conBrecha.length, conSugerido: conSugerido.length, sobrestock: sobrestock.length, criticos: criticos.length, conDemanda: conDemanda.length, enTransito: enTransito.length, traPz, proxEta, valorSugeridoUsd, sugeridoPz, sugeridoCnt, ltPromedio };
  }, [rowsAll]);

  // ── Export activo ──
  const borradorActivo = sol.borradores.find((b) => b.id === borradorActivoId) || null;
  const lineasBorrador = borradorActivo ? sol.lineasDe(borradorActivo.id) : [];
  const skusEnBorrador = useMemo(() => new Set(lineasBorrador.map((l) => l.sku)), [lineasBorrador]);
  const totalBorradorPz = lineasBorrador.reduce((a, l) => a + Number(l.cantidad || 0), 0);
  const totalBorradorUsd = lineasBorrador.reduce((a, l) => a + Number(l.cantidad || 0) * Number(l.ultimo_costo_usd || 0), 0);
  const totalBorradorCnt = lineasBorrador.reduce((a, l) => a + Number(l.contenedores || 0), 0);

  const asegurarBorrador = async () => {
    let id = borradorActivoId;
    if (!id && sol.borradores.length > 0) { id = sol.borradores[0].id; setBorradorActivoId(id); }
    if (!id) {
      const nuevo = await sol.crearBorrador();
      if (!nuevo || !nuevo.id) { toast.error('No se pudo crear el borrador'); return null; }
      id = nuevo.id; setBorradorActivoId(id);
    }
    return id;
  };
  const lineaDesdeRow = (row, cantidad) => {
    let fecha_estimada = null;
    if (row.ltDias && row.ltDias > 0) { const d = new Date(); d.setDate(d.getDate() + Math.round(row.ltDias)); fecha_estimada = d.toISOString().slice(0, 10); }
    const ppc = Number(row.piezasPorContenedor || 0);
    return {
      sku: row.sku, descripcion: row.descripcion, cantidad, proveedor: row.supplier || '', fecha_estimada,
      ultimo_costo_usd: row.ultimoCostoUsd || row.costoUnitUsd || null, piezas_por_contenedor: ppc || null,
      contenedores: ppc > 0 ? Math.ceil(cantidad / ppc) : null, es_consolidado: !!row.esConsolidado,
    };
  };

  // "+" de la tabla o "Agregar al export" del drill → modal con cantidad. Si viene del simulador, arranca con esa cantidad.
  const onAgregarSolicitud = (row) => {
    if (!puedeEditarSol) { toast.error('No tienes permiso para crear solicitudes de compra.'); return; }
    const qtySim = Number(row.__qtySimulada || 0);
    if (qtySim > 0) {
      const ppc = Number(row.piezasPorContenedor || 0);
      setSkuParaAgregar({ ...row, sugerido: qtySim, contenedoresSugeridos: ppc > 0 ? Math.ceil(qtySim / ppc) : 0 });
    } else setSkuParaAgregar(row);
  };

  // Confirmación del modal — si el SKU ya está en el borrador se actualiza la línea; si no, se agrega.
  const confirmarAgregarLinea = async (cantidadFinal) => {
    const row = skuParaAgregar;
    if (!row || cantidadFinal <= 0) return;
    try {
      const solicitudId = await asegurarBorrador();
      if (!solicitudId) return;
      const existente = sol.lineasDe(solicitudId).find((l) => l.sku === row.sku);
      const linea = lineaDesdeRow(row, cantidadFinal);
      if (existente) {
        await sol.editarLinea(existente.id, { cantidad: linea.cantidad, contenedores: linea.contenedores, piezas_por_contenedor: linea.piezas_por_contenedor, es_consolidado: linea.es_consolidado });
        toast.ok(`${row.sku} · ${fmtInt(cantidadFinal)} pz actualizado en el export`);
        setSkuParaAgregar(null);
        return;
      }
      const nueva = await sol.agregarLinea(solicitudId, linea);
      if (nueva && nueva.id) { toast.ok(`${row.sku} · ${fmtInt(cantidadFinal)} pz agregado al export`); setSkuParaAgregar(null); }
      else toast.error('La línea no se guardó (respuesta vacía de la BD)');
    } catch (err) {
      console.error('[S&OP] error en confirmarAgregarLinea', err);
      toast.error(`Error agregando ${row.sku}: ${err?.message || err}`);
    }
  };

  // Agregar TODOS los SKUs con sugerido > 0 al borrador activo (salta los que ya están).
  const agregarTodosSugeridos = async () => {
    if (!puedeEditarSol) { toast.error('No tienes permiso para agregar al export.'); return; }
    const candidatos = rowsAll.filter((r) => Number(r.sugerido || 0) > 0);
    if (candidatos.length === 0) { toast.info('No hay SKUs con sugerido de compra.'); return; }
    const nuevos = candidatos.filter((r) => !skusEnBorrador.has(r.sku));
    const skipped = candidatos.length - nuevos.length;
    if (nuevos.length === 0) { toast.info(`Los ${candidatos.length} sugeridos ya están en Mi Export.`); return; }
    const totalUsd = nuevos.reduce((a, r) => a + Number(r.sugerido || 0) * Number(r.ultimoCostoUsd || r.costoUnitUsd || 0), 0);
    const totalPz = nuevos.reduce((a, r) => a + Number(r.sugerido || 0), 0);
    const ok = window.confirm(
      `Agregar ${nuevos.length} SKUs al export activo?\n\n· Total piezas: ${fmtInt(totalPz)}\n`
      + (sensible ? `· Total USD estimado: ${usd0(totalUsd)}\n` : '')
      + (skipped > 0 ? `· ${skipped} ya estaban en el export (se omiten)\n` : ''),
    );
    if (!ok) return;
    setAgregandoTodos(true);
    try {
      const solicitudId = await asegurarBorrador();
      if (!solicitudId) return;
      let okCount = 0, errCount = 0;
      for (const row of nuevos) {
        try {
          const linea = await sol.agregarLinea(solicitudId, lineaDesdeRow(row, Number(row.sugerido || 0)));
          if (linea && linea.id) okCount++; else errCount++;
        } catch (err) { console.error(`[S&OP] error agregando ${row.sku}`, err); errCount++; }
      }
      if (okCount > 0) toast.ok(`${okCount} SKUs agregados al export activo`);
      if (errCount > 0) toast.error(`${errCount} SKUs no se pudieron agregar`);
    } finally { setAgregandoTodos(false); }
  };

  const onCrearNuevoBorrador = async () => {
    if (!puedeEditarSol) { toast.error('No tienes permiso para crear borradores'); return; }
    try {
      const nuevo = await sol.crearBorrador();
      if (nuevo && nuevo.id) { setBorradorActivoId(nuevo.id); toast.ok(`Borrador #${nuevo.id} creado`); } else toast.error('No se pudo crear el borrador');
    } catch (err) { console.error('[S&OP] error creando borrador', err); toast.error(`Error creando borrador: ${err?.message || err}`); }
  };
  const envolver = (fn, msg) => async (...args) => {
    if (!puedeEditarSol) return;
    try { await fn(...args); } catch (err) { console.error(`[S&OP] ${msg}`, err); toast.error(`${msg}: ${err?.message || err}`); }
  };
  const onEliminarLineaWrapped = envolver(sol.eliminarLinea, 'No se pudo eliminar');
  const onEditarLineaWrapped = envolver(sol.editarLinea, 'No se pudo editar');
  const onCerrarBorradorWrapped = envolver(async (id) => { await sol.cerrarBorrador(id); toast.ok(`Borrador #${id} cerrado como solicitud pendiente`); }, 'No se pudo cerrar');

  // Líneas con contenedores frescos del motor (las guardadas pueden traer piezas_por_contenedor viejo).
  const lineasFrescas = () => {
    const rowsBySku = Object.fromEntries(rowsAll.map((r) => [r.sku, r]));
    return lineasBorrador.map((l) => {
      const r = rowsBySku[l.sku];
      if (!r) return l;
      const ppc = Number(r.piezasPorContenedor || 0);
      const cantidad = Number(l.cantidad || 0);
      const cnts = ppc > 0 && !r.esConsolidado ? Math.ceil(cantidad / ppc) : null;
      return { ...l, piezas_por_contenedor: ppc || l.piezas_por_contenedor, contenedores: cnts != null ? cnts : l.contenedores, es_consolidado: !!r.esConsolidado };
    });
  };
  const onExportarBorrador = () => {
    if (!borradorActivo) return toast.error('No hay export activo');
    if (lineasBorrador.length === 0) return toast.error('El export está vacío');
    setPreviewExportOpen(true);
  };
  const ejecutarExportacion = async () => {
    if (!borradorActivo || lineasBorrador.length === 0) return;
    try {
      const filename = await exportarSolicitudExcel(borradorActivo, lineasFrescas(), { sinCostos: !sensible });
      toast.ok(`Excel descargado: ${filename}`);
      setPreviewExportOpen(false);
    } catch (e) { toast.error(`Error exportando: ${e.message || e}`); }
  };
  // Compartir export: mismo libro de excelSOP como Blob → hoja nativa (navigator.share) o descarga.
  const onCompartirExport = async () => {
    if (!borradorActivo || lineasBorrador.length === 0) return toast.error('El export está vacío');
    try {
      const { blob, filename } = await solicitudExcelBlob(borradorActivo, lineasFrescas(), { sinCostos: !sensible });
      const res = await compartirArchivo(blob, filename, { titulo: borradorActivo.notas || filename, texto: `S&OP · ${lineasBorrador.length} SKUs · ${fmtInt(totalBorradorPz)} pz` });
      if (res === 'share') toast.ok('Export compartido');
      else if (res === 'descarga') toast.ok(`Excel descargado: ${filename}`);
    } catch (e) { toast.error(`No se pudo compartir: ${e.message || e}`); }
  };

  // Excel de la tabla principal (columnas visibles); el export de solicitudes (excelSOP) es independiente.
  const excelTabla = () => ({
    titulo: 'S&OP · Detalle por SKU', archivo: 'SOP Detalle por SKU',
    hojas: [{
      nombre: 'Detalle por SKU',
      subtitulo: `Horizonte ${HORIZONTE} meses · ${rowsOrdenados.length} de ${rowsAll.length} SKUs${nActivos ? ` · ${nActivos} filtro${nActivos === 1 ? '' : 's'}` : ''}${busqueda ? ` · "${busqueda}"` : ''}`,
      columnas: [
        { label: 'SKU', key: 'sku', tipo: 'texto', ancho: 14 },
        { label: 'Descripción', key: 'descripcion', tipo: 'texto', ancho: 48 },
        { label: 'Roadmap', key: 'roadmapEstado', tipo: 'texto', ancho: 10 },
        { label: 'Proveedor', key: 'supplier', tipo: 'texto', ancho: 22 },
        { label: 'Inv', key: 'inv', tipo: 'numero' },
        { label: 'Tránsito', key: 'traCant', tipo: 'numero' },
        { label: 'Arribo', key: 'traEta', tipo: 'fecha' },
        { label: 'Dem 3m (pz/m)', key: 'demandaMesErp', tipo: 'numero', ancho: 13 },
        { label: 'Días inv', key: 'coberturaDiasErp', tipo: 'numero' },
        { label: 'Sugerido', key: 'sugerido', tipo: 'numero' },
        { label: 'Contenedores', key: 'contenedoresSugeridos', tipo: 'numero' },
        ...(sensible ? [{ label: 'Últ. costo USD', key: 'ultimoCostoUsd', tipo: 'numero' }, { label: 'Sugerido USD', key: 'sugeridoUsd', tipo: 'numero' }] : []),
        { label: 'En export', key: 'enExport', tipo: 'texto', ancho: 10 },
      ],
      filas: rowsOrdenados.map((r) => ({
        sku: r.sku, descripcion: r.descripcion || '', roadmapEstado: r.roadmapEstado || '', supplier: r.supplier || '',
        inv: Math.round(r.inv || 0), traCant: r.traCant > 0 ? Math.round(r.traCant) : null, traEta: r.traEta ? r.traEta.slice(0, 10) : null,
        demandaMesErp: Math.round(r.demandaMesErp || 0), coberturaDiasErp: r.coberturaDiasErp != null && isFinite(r.coberturaDiasErp) ? Math.round(r.coberturaDiasErp) : null,
        sugerido: Number(r.sugerido || 0) > 0 ? Math.round(r.sugerido) : null, contenedoresSugeridos: r.contenedoresSugeridos || null,
        ultimoCostoUsd: sensible ? Number(r.ultimoCostoUsd || 0) || null : undefined,
        sugeridoUsd: sensible ? Math.round(Number(r.sugerido || 0) * Number(r.ultimoCostoUsd || r.costoUnitUsd || 0)) || null : undefined,
        enExport: skusEnBorrador.has(r.sku) ? 'Sí' : '',
      })),
      totales: { sku: 'TOTAL', descripcion: `${rowsOrdenados.length} SKUs`, inv: rowsOrdenados.reduce((s, r) => s + (r.inv || 0), 0), traCant: rowsOrdenados.reduce((s, r) => s + (r.traCant || 0), 0), sugerido: rowsOrdenados.reduce((s, r) => s + (Number(r.sugerido) > 0 ? Number(r.sugerido) : 0), 0) },
    }],
  });

  if (data.loading) return <Cargando pantalla="forecastClientes" minHeight={520} />;

  const hoy = new Date();
  const nSugeridos = kpis.conSugerido;
  const labelExport = `Export · ${lineasBorrador.length} SKU${lineasBorrador.length === 1 ? '' : 's'}${sensible ? ` · USD ${fmtInt(totalBorradorUsd)}` : ` · ${fmtInt(totalBorradorPz)} pz`}`;

  // Carrito "Mi Export" (pill flotante + hoja + preview + modal de cantidad): compartido por las dos vistas.
  const pillExport = (puedeVerSol && (
        <button type="button" onClick={() => setHojaExport(true)} title="Abrir Mi Export"
          style={{
            position: 'fixed', right: 22, bottom: 22, zIndex: 60, display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px 0 14px', borderRadius: 999,
            background: theme.surfaceInverse || '#000', color: theme.textOnInverse || '#F5F5F7', border: bordeFlotante(theme), boxShadow: elevation(theme, 'flotante'),
            fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.01em', cursor: 'pointer', whiteSpace: 'nowrap',
            transition: `transform ${DUR.tap}ms ${EASE}`, fontVariantNumeric: 'tabular-nums',
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)'; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}>
          <ShoppingCart size={14} strokeWidth={2} />
          {labelExport}
          {lineasBorrador.length > 0 && <Pill tone="green" size="xs" style={{ marginLeft: 2 }}>{lineasBorrador.length}</Pill>}
        </button>
      )
  );
  const hojaExportUI = (
    <>
      <HojaLateral abierto={hojaExport} onClose={() => setHojaExport(false)} theme={theme} ancho={460} titulo="Mi Export"
        sub={`S&OP · Planeación${sol.borradores.length > 1 ? ` · ${sol.borradores.length} borradores` : ''}`}>
        <ExportCart sol={sol} activoId={borradorActivoId} setActivoId={setBorradorActivoId} activo={borradorActivo}
          lineas={lineasBorrador} totalPz={totalBorradorPz} totalUsd={totalBorradorUsd} totalCnt={totalBorradorCnt}
          puedeEditar={puedeEditarSol} onCrearNuevo={onCrearNuevoBorrador} onEditarLinea={onEditarLineaWrapped} onEliminarLinea={onEliminarLineaWrapped}
          onCerrar={onCerrarBorradorWrapped} onExportar={onExportarBorrador} onCompartir={onCompartirExport}
          onVerHistorial={() => { setHojaExport(false); setVista('reuniones'); }} sensible={sensible} />
      </HojaLateral>

      <ExportPreviewModal abierto={previewExportOpen} activo={borradorActivo} lineas={lineasBorrador} totalPz={totalBorradorPz} totalUsd={totalBorradorUsd}
        onEditarLinea={onEditarLineaWrapped} onEliminarLinea={onEliminarLineaWrapped} onExportar={ejecutarExportacion} onCerrar={() => setPreviewExportOpen(false)} sensible={sensible} />

      {skuParaAgregar && <AgregarLineaModal sensible={sensible} row={skuParaAgregar} onClose={() => setSkuParaAgregar(null)} onConfirm={confirmarAgregarLinea} />}
    </>
  );

  const segmented = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Segmented value={vista} onChange={setVista} options={[
        { id: 'forecast', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><LayoutList size={12} /> Forecast</span>, title: 'Detalle por SKU · planeación de compras' },
        { id: 'reuniones', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><CalendarDays size={12} /> Reuniones</span>, title: 'Repositorio de la reunión mensual de S&OP' },
      ]} />
    </div>
  );

  if (vista === 'reuniones') {
    return (
      <div ref={rootRef} style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: TYPO.fontText, color: theme.text, paddingBottom: puedeVerSol ? 64 : 0 }}>
        {segmented}
        <Reuniones perfil={perfil} puedeEditar={esPerfilInterno(perfil)} sensible={sensible} rows={rowsAll} metaBySku={metaBySku} data={data} sol={puedeVerSol ? sol : null} />
        {pillExport}
        {hojaExportUI}
      </div>
    );
  }

  return (
    <div ref={rootRef} data-stagger style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: TYPO.fontText, color: theme.text, paddingBottom: puedeVerSol ? 64 : 0 }}>
      {segmented}
      <Hero
        eyebrow={`Dirección Comercial · S&OP · ${MESES_LARGO[hoy.getMonth()]} ${hoy.getFullYear()}`}
        titulo="Detalle por SKU · Planeación de compras."
        sub={(
          <>
            <strong style={{ color: theme.textOnInverse || '#F5F5F7', fontWeight: 500 }}>{fmtInt(rowsAll.length)} SKUs</strong> del Reporte.
            {kpis.conBrecha > 0 && <> <strong style={{ color: theme.red || '#FF6961', fontWeight: 500 }}>{fmtInt(kpis.conBrecha)} con brecha</strong> a 3 meses,</>}
            {kpis.criticos > 0 && <> <strong style={{ color: theme.orange || '#FFB84D', fontWeight: 500 }}>{fmtInt(kpis.criticos)} con menos de 30 días</strong>,</>}
            {' '}<strong style={{ color: theme.green || '#34D158', fontWeight: 500 }}>{fmtInt(kpis.sobrestock)} en sobre-stock</strong>.
            {' '}Arma tu export seleccionando SKUs con la cantidad que necesites.
          </>
        )}
        stats={[
          { k: 'SKUs c/ brecha', v: fmtInt(kpis.conBrecha), sub: sensible ? `USD ${fmtInt(kpis.valorSugeridoUsd)} sugeridos` : `${fmtInt(kpis.sugeridoPz)} pz sugeridas`, color: theme.red || '#FF6961' },
          { k: 'Sobre-stock', medida: 'Cobertura por SKU · piezas / (demanda ERP de 3 meses CERRADOS / 30). No es [Dias de Inv] del director.', v: fmtInt(kpis.sobrestock), sub: '> 90 d de cobertura por SKU', color: theme.green || '#34D158' },
          { k: 'Días de Inv', medida: tooltip('dias_inv'), v: medInv?.dias_inv != null ? `${Math.round(medInv.dias_inv)} d` : '—', sub: 'medida del director · global a costo' },
          { k: 'Export activo', v: sensible ? `USD ${fmtInt(totalBorradorUsd)}` : `${fmtInt(totalBorradorPz)} pz`, sub: `${lineasBorrador.length} SKUs${sensible ? ` · ${fmtInt(totalBorradorPz)} pz` : ` · ${fmtInt(totalBorradorCnt)} cnt`}` },
        ]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <KpiCard eyebrow="Sugerido de compra" badge={{ tone: nSugeridos ? 'blue' : 'gray', l: `${nSugeridos} SKUs` }}
          big={sensible ? `USD ${fmtInt(kpis.valorSugeridoUsd)}` : `${fmtInt(kpis.sugeridoPz)} pz`}
          bigSmall={sensible ? `${fmtInt(kpis.sugeridoPz)} pz` : `${fmtInt(kpis.sugeridoCnt)} cnt`}
          sub="ritmo ERP 3 m + crecimiento + seguridad − stock − tránsito 3 m · contenedor con umbral 50 %"
          onClick={() => setF((p) => ({ ...p, soloSugerido: !p.soloSugerido }))} />
        <KpiCard eyebrow="Cobertura crítica" badge={{ tone: kpis.criticos ? 'red' : 'green', l: kpis.criticos ? 'atender' : 'ok' }}
          big={fmtInt(kpis.criticos)} bigSmall={`de ${fmtInt(kpis.conDemanda)} con demanda`} bigColor={kpis.criticos ? theme.red : undefined}
          sub="SKUs con menos de 30 días de inventario a ritmo ERP de 3 meses"
          onClick={() => onToggle('estado', 'critico')} />
        <KpiCard eyebrow="Tránsito" badge={{ tone: 'blue', l: `${kpis.enTransito} SKUs` }}
          big={`${fmtInt(kpis.traPz)} pz`} bigSmall={kpis.proxEta ? `próx. ${fmtEtaCorta(kpis.proxEta)}` : 'sin OC'}
          sub="piezas en camino (v_transito_sku) · el sugerido descuenta lo que llega en 3 meses" />
        <KpiCard eyebrow="Export activo" badge={{ tone: borradorActivo ? 'green' : 'gray', l: borradorActivo ? (borradorActivo.notas || `#${borradorActivo.id}`) : 'sin borrador' }}
          big={`${lineasBorrador.length} SKUs`} bigSmall={sensible ? `USD ${fmtInt(totalBorradorUsd)}` : `${fmtInt(totalBorradorPz)} pz`}
          sub={puedeVerSol ? `${fmtInt(totalBorradorCnt)} cnt · click para abrir Mi Export` : 'sin acceso a solicitudes'}
          onClick={puedeVerSol ? () => setHojaExport(true) : undefined} />
      </div>

      {/* Buscador + filtros + acciones */}
      <Panel padding="8px 12px">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <Buscador value={busqueda} onChange={setBusqueda} resultados={busqueda ? `${fmtInt(rowsFiltrados.length)} SKUs` : null} placeholder="Buscar: mouse inalámbrico negro, AC-93, proveedor, familia, roadmap…" width={380} />
          <span style={{ fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
            <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmtInt(rowsOrdenados.length)}</strong> de {fmtInt(rowsAll.length)} SKUs
          </span>
          {puedeEditarSol && (
            <Boton primario icon={Plus} onClick={agregarTodosSugeridos} disabled={nSugeridos === 0 || agregandoTodos} style={{ marginLeft: 'auto' }}
              title={nSugeridos === 0 ? 'No hay SKUs con sugerido' : `Agregar ${nSugeridos} SKUs sugeridos al export activo`}>
              {agregandoTodos ? 'Agregando…' : `Agregar todos al export (${nSugeridos})`}
            </Boton>
          )}
        </div>
        <FiltrosSOP f={f} facetas={facetas} onToggle={onToggle} onSoloSugerido={(v) => setF((p) => ({ ...p, soloSugerido: v }))} nActivos={nActivos} onLimpiar={limpiar} />
      </Panel>

      <Panel titulo="Detalle por SKU" meta={`${fmtInt(rowsOrdenados.length)} SKUs · click en la fila para el drill · píldora verde = en export${sortCol ? '' : ' · orden del Reporte'}`}
        acciones={<ExportMenu titulo="S&OP" subtitulo={`Detalle por SKU · horizonte ${HORIZONTE} meses`} excel={excelTabla} pdf={{ ref: rootRef }} deshabilitado={!rowsOrdenados.length} />}
        padding="6px">
        <TablaForecast rows={rowsOrdenados} expandedSku={expandedSku} setExpandedSku={setExpandedSku}
          sortCol={sortCol} sortDir={sortDir} onSort={onSort}
          onAgregarSolicitud={onAgregarSolicitud} skusEnBorrador={skusEnBorrador} lineasBorrador={lineasBorrador}
          puedeEditar={puedeEditarSol} sensible={sensible} facturacion={data.facturacion} metaBySku={metaBySku}
          vacio={busqueda || nActivos ? 'Ningún SKU coincide con la búsqueda y los filtros.' : 'Sin SKUs en el Reporte.'} />
      </Panel>

      <Panel plegable abiertoInicial={false} titulo="Últimas compras colocadas" meta="POs del Master Embarques · 6 meses · click en una PO para el detalle" padding="10px 12px">
        <UltimasComprasCard embarques={data.embarques} sensible={sensible} />
      </Panel>

      <Panel plegable abiertoInicial={false} titulo="Calendario de tránsito" meta="qué llega cada mes · próximos 6 meses · click en el mes para familia → marca" padding="8px 12px">
        <TransitoTimeline embarques={data.embarques} metaBySku={metaBySku} sensible={sensible} />
      </Panel>

      {pillExport}
      {hojaExportUI}
    </div>
  );
}
