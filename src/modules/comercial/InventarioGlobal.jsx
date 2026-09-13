// Inventario global · V3. Hero narrativo → 4 KpiCard → tabla de SKUs (buscador por
// palabras + pills de filtro facetadas, canasta para compartir, drill por SKU con el
// desglose por almacén) → Próximos arribos → Apartado por SKU → Fuera de venta →
// Tendencia (histórico diario) → secundario plegable (CEDIS / estatus / tipos).
// Regla de ancho: la tabla principal cabe en su tarjeta (9 columnas, marca dentro de la
// descripción, almacenes en el drill); nada de scroll horizontal.
// Datos: inventario/useInventarioDatos.js · filtros: inventario/filtros.js · compartir: inventario/compartir.js.
// Sensible (permisos.puedeVerSensible): sin él la pantalla se lee en piezas y días; nada de $ a costo.
import React, { useMemo, useRef, useState } from 'react';
import { Search, ChevronRight, Share2, X } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import SinAcceso from '../../components/SinAcceso';
import ExportMenu from '../../components/ExportMenu';
import FrescuraPill from '../../components/FrescuraPill';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaGlobal, puedeVerSensible } from '../../lib/permisos';
import { Hero, KpiCard, Pill, Segmented, TablaCompacta, Panel, Boton, SkeletonPantalla, toast, elevation } from '../../components/kit';
import { EASE, DUR } from '../../lib/motion';
import { inventarioDesdeVista, tooltip } from '../../lib/medidas';
import useInventarioDatos from './inventario/useInventarioDatos';
import SkuDrillDown from './inventario/SkuDrillDown';
import ResumenSecundario from './inventario/ResumenSecundario';
import FiltrosPills from './inventario/FiltrosPills';
import ProximosArribos from './inventario/ProximosArribos';
import HistoricoPanel, { fotoHace } from './inventario/HistoricoPanel';
import CompartirHoja from './inventario/CompartirHoja';
import ApartadoPanel from './inventario/ApartadoPanel';
import FueraDeVenta from './inventario/FueraDeVenta';
import { FILTROS_VACIOS, estadoDe, pasaTodos, facetas as calcularFacetas, nActivos as contarActivos } from './inventario/filtros';
import {
  CEDIS_CORTO, ALMACENES_GRID, shortAlmacen, tipoDe,
  COBERTURA_CRITICA, COBERTURA_SOBRESTOCK, N,
  fmtCompact, fmtInt, fmtDias, fmtFechaCorta, diasHasta, tonoCobertura, normalizar, tokensBusqueda,
} from './inventario/constantes';

const MAX_FILAS = 300;

export default function InventarioGlobal() {
  const perfil = usePerfil();
  if (!puedeVerPestanaGlobal(perfil, 'inventario_global')) {
    return <SinAcceso motivo="No tienes acceso a Inventario." />;
  }
  return <InventarioGlobalPantalla sensible={puedeVerSensible(perfil)} />;
}

// SKU × almacén enriquecido (descripción, tránsito, lead time, demanda, cobertura, estado, índice de búsqueda)
function agregarSkus(filas, { descripciones, transito, leadTime, demanda }) {
  const m = new Map();
  filas.forEach((r) => {
    const sku = r.articulo;
    if (!sku) return;
    if (!m.has(sku)) m.set(sku, { sku, byAlm: {}, totalPz: 0, totalDisp: 0, totalRes: 0, valorRes: 0, valor: 0, costoRef: 0, cedisSet: new Set() });
    const it = m.get(sku);
    const alm = Number(r.no_almacen);
    // res = apartado (inventario − disponible) · valorRes = su costo, exactamente como
    // v_inventario_apartado_sku (costoinventario − costodisponible), no una estimación.
    const pz = N(r.inventario), disp = N(r.disponible), res = Math.max(0, pz - disp), val = N(r.costoinventario);
    const valRes = Math.max(0, val - N(r.costodisponible));
    if (!it.byAlm[alm]) it.byAlm[alm] = { pz: 0, disp: 0, res: 0, valor: 0, valorRes: 0, cedis: r.cedis };
    it.byAlm[alm].pz += pz; it.byAlm[alm].disp += disp; it.byAlm[alm].res += res; it.byAlm[alm].valor += val; it.byAlm[alm].valorRes += valRes;
    it.totalPz += pz; it.totalDisp += disp; it.totalRes += res; it.valor += val; it.valorRes += valRes;
    it.costoRef = Math.max(it.costoRef, N(r.costopromedio));
    if (pz > 0 && r.cedis) it.cedisSet.add(r.cedis);
  });
  return Array.from(m.values()).map((it) => {
    const d = descripciones.get(it.sku) || {};
    const tr = transito.get(it.sku) || null;
    const lt = leadTime.get(it.sku) || null;
    const demandaMes = demanda.get(it.sku) || 0;
    const costo = it.totalPz > 0 ? it.valor / it.totalPz : it.costoRef;
    const transitoPz = tr ? tr.cantidad : 0;
    const coberturaDias = demandaMes > 0 ? it.totalPz / (demandaMes / 30) : null;
    const tieneStock = it.totalPz > 0;
    const diasEta = tr?.eta ? diasHasta(tr.eta) : null;
    const agotado = !tieneStock && demandaMes > 0;
    const critico = tieneStock && coberturaDias != null && coberturaDias < COBERTURA_CRITICA;
    const sobrestock = tieneStock && coberturaDias != null && coberturaDias > COBERTURA_SOBRESTOCK;
    // Se agota antes de que llegue su tránsito: hay embarque pendiente y la cobertura no alcanza a la ETA
    const riesgo = transitoPz > 0 && (agotado || (critico && diasEta != null && coberturaDias < Math.max(diasEta, 0)));
    const row = {
      ...it,
      descripcion: d.descripcion || '', marca: d.marca || '', familia: d.familia || '', rdmp: d.rdmp || '', categoria: d.categoria || '',
      transito: tr, transitoPz, transitoPos: tr ? tr.pos.length : 0, transitoEta: tr?.eta || null, transitoValor: transitoPz * costo, costo,
      leadTime: lt, demandaMes, coberturaDias, agotado, critico, sobrestock, riesgo, tieneStock,
    };
    row.estado = estadoDe(row);
    // Índice de búsqueda: SKU + descripción + marca + familia + categoría, sin acentos ni mayúsculas
    row.indice = normalizar(`${row.sku} ${row.descripcion} ${row.marca} ${row.familia} ${row.categoria}`);
    return row;
  });
}

function InventarioGlobalPantalla({ sensible }) {
  const { theme } = useTheme();
  const rootRef = useRef(null); // raíz para exportar PDF
  const { filas, loading, enriqueciendo, descripciones, transito, leadTime, demanda, historico, medidas, mesesRef } = useInventarioDatos();
  // Medidas oficiales del director: Inv Actual, Dias de Inv, Inv Total, Costo Promedio.
  // Mandan en el hero; el resto de la pantalla (facetas por CEDIS/almacén, cobertura
  // por SKU en piezas) sigue calculándose sobre el detalle, ya filtrado con la MISMA
  // regla (`en_inv_actual`), así que la suma cuadra al peso.
  const med = useMemo(() => inventarioDesdeVista(medidas), [medidas]);

  // Alcance
  const [soloComerciales, setSoloComerciales] = useState(true);
  const [cedisFiltro, setCedisFiltro] = useState('TODOS');
  // Filtros de tabla (pills facetadas) + buscador
  const [busqueda, setBusqueda] = useState('');
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [orden, setOrden] = useState({ col: 'valor', dir: 'desc' });
  const [skuAbierto, setSkuAbierto] = useState(null);
  const [exportando, setExportando] = useState(false);
  // Canasta para compartir varios SKUs · compartirSkus = lista abierta en la hoja
  const [canasta, setCanasta] = useState(() => new Set());
  const [compartirSkus, setCompartirSkus] = useState(null);

  const f = useMemo(() => ({ ...filtros, tokens: tokensBusqueda(busqueda) }), [filtros, busqueda]);

  // ── Filas efectivas según alcance ──
  // `en_inv_actual` = regla de [Inv Actual] resuelta en Postgres. Antes esto era
  // un Set de 15 almacenes mantenido a mano en constantes.js que se desincronizaba
  // de almacenes_config y no aplicaba el filtro de Rama = PRODUCTO.
  const filasAlcance = useMemo(() => filas.filter((r) => r.cedis && (!soloComerciales || r.en_inv_actual === true)), [filas, soloComerciales]);
  const filasEfectivas = useMemo(() => (cedisFiltro === 'TODOS' ? filasAlcance : filasAlcance.filter((r) => r.cedis === cedisFiltro)), [filasAlcance, cedisFiltro]);

  const kpis = useMemo(() => {
    let valor = 0, piezas = 0;
    const skus = new Set(), almacenes = new Set(), cedis = new Set();
    filasEfectivas.forEach((r) => {
      valor += N(r.costoinventario); piezas += N(r.inventario);
      if (r.articulo) skus.add(r.articulo);
      almacenes.add(r.no_almacen); cedis.add(r.cedis);
    });
    return { valor, piezas, skus: skus.size, almacenes: almacenes.size, nCEDIS: cedis.size };
  }, [filasEfectivas]);

  const porCedis = useMemo(() => {
    const m = new Map();
    filasEfectivas.forEach((r) => {
      if (!m.has(r.cedis)) m.set(r.cedis, { cedis: r.cedis, valor: 0, piezas: 0, skus: new Set(), almacenes: new Set() });
      const it = m.get(r.cedis);
      it.valor += N(r.costoinventario); it.piezas += N(r.inventario);
      if (r.articulo) it.skus.add(r.articulo);
      it.almacenes.add(r.no_almacen);
    });
    const total = Array.from(m.values()).reduce((s, x) => s + (sensible ? x.valor : x.piezas), 0);
    return Array.from(m.values()).map((it) => ({ ...it, skus: it.skus.size, almacenes: it.almacenes.size, share: total > 0 ? ((sensible ? it.valor : it.piezas) / total) * 100 : 0 })).sort((a, b) => (sensible ? b.valor - a.valor : b.piezas - a.piezas));
  }, [filasEfectivas, sensible]);

  const porTipo = useMemo(() => {
    const m = new Map();
    filasEfectivas.forEach((r) => {
      const t = tipoDe(Number(r.no_almacen));
      if (!m.has(t)) m.set(t, { tipo: t, valor: 0, piezas: 0, skus: new Set() });
      const it = m.get(t);
      it.valor += N(r.costoinventario); it.piezas += N(r.inventario);
      if (r.articulo) it.skus.add(r.articulo);
    });
    const total = Array.from(m.values()).reduce((s, x) => s + (sensible ? x.valor : x.piezas), 0);
    return Array.from(m.values()).map((it) => ({ ...it, skus: it.skus.size, share: total > 0 ? ((sensible ? it.valor : it.piezas) / total) * 100 : 0 })).sort((a, b) => (sensible ? b.valor - a.valor : b.piezas - a.piezas));
  }, [filasEfectivas, sensible]);

  // ── SKU × almacén enriquecido: con el CEDIS elegido (pantalla) y sin él (conteo de la pill CEDIS) ──
  const ctx = useMemo(() => ({ descripciones, transito, leadTime, demanda }), [descripciones, transito, leadTime, demanda]);
  const skuRowsTodos = useMemo(() => agregarSkus(filasAlcance, ctx), [filasAlcance, ctx]);
  const skuRows = useMemo(() => (cedisFiltro === 'TODOS' ? skuRowsTodos : agregarSkus(filasEfectivas, ctx)), [skuRowsTodos, filasEfectivas, cedisFiltro, ctx]);

  // Universo = alcance + marca/familia/roadmap (hero y KPIs se calculan aquí; ignora búsqueda, estado, stock y tránsito)
  const fUniverso = useMemo(() => ({ ...f, tokens: [], estado: new Set(), soloStock: false, soloTransito: false }), [f]);
  const universo = useMemo(() => skuRows.filter((r) => pasaTodos(r, fUniverso, null)), [skuRows, fUniverso]);

  const resumen = useMemo(() => {
    const conStock = universo.filter((r) => r.tieneStock);
    const agotados = universo.filter((r) => r.agotado);
    const criticos = universo.filter((r) => r.critico);
    const sobre = universo.filter((r) => r.sobrestock);
    const enTransito = universo.filter((r) => r.transitoPz > 0);
    const riesgo = universo.filter((r) => r.riesgo);
    let pzCob = 0, demDia = 0;
    universo.forEach((r) => { if (r.demandaMes > 0) { pzCob += r.totalPz; demDia += r.demandaMes / 30; } });
    const cobertura = demDia > 0 ? pzCob / demDia : null;
    const transitoValor = enTransito.reduce((s, r) => s + r.transitoValor, 0);
    const transitoPz = enTransito.reduce((s, r) => s + r.transitoPz, 0);
    const transitoPos = new Set(enTransito.flatMap((r) => r.transito.pos.map((p) => p.po))).size;
    const transitoEta = enTransito.reduce((m, r) => (r.transitoEta && (!m || r.transitoEta < m) ? r.transitoEta : m), null);
    const valorSobre = sobre.reduce((s, r) => s + r.valor, 0);
    const piezasSobre = sobre.reduce((s, r) => s + r.totalPz, 0);
    const demandaPerdida = agotados.reduce((s, r) => s + r.demandaMes, 0);
    const conLt = universo.filter((r) => r.leadTime && r.leadTime.muestras > 0);
    const ltPond = conLt.reduce((s, r) => s + r.leadTime.dias * r.leadTime.muestras, 0) / (conLt.reduce((s, r) => s + r.leadTime.muestras, 0) || 1);
    const ltMin = conLt.length ? Math.min(...conLt.map((r) => r.leadTime.min)) : null;
    const ltMax = conLt.length ? Math.max(...conLt.map((r) => r.leadTime.max)) : null;
    const valor = universo.reduce((s, r) => s + r.valor, 0);
    const piezas = universo.reduce((s, r) => s + r.totalPz, 0);
    const reservado = universo.reduce((s, r) => s + r.totalRes, 0);
    const valorReservado = universo.reduce((s, r) => s + N(r.valorRes), 0);
    return {
      valor, piezas, nSkus: universo.length, conStock: conStock.length,
      agotados: agotados.length, criticos: criticos.length, sobrestock: sobre.length, enTransito: enTransito.length, riesgo: riesgo.length,
      cobertura, demDia, transitoValor, transitoPz, transitoPos, transitoEta, valorSobre, piezasSobre, demandaPerdida,
      leadTime: conLt.length ? ltPond : null, ltMin, ltMax, nLt: conLt.length,
      reservado, valorReservado, disponible: piezas - reservado, valorDisponible: Math.max(0, valor - valorReservado),
      pctReservado: piezas > 0 ? (reservado / piezas) * 100 : 0,
    };
  }, [universo]);

  // ── Tabla: todos los filtros + orden (el orden no cambia: valor desc por defecto) ──
  const filasTabla = useMemo(() => {
    const arr = skuRows.filter((r) => pasaTodos(r, f, null));
    const { col, dir } = orden;
    const sgn = dir === 'asc' ? 1 : -1;
    const get = (r) => {
      if (col.startsWith('alm_')) return r.byAlm[Number(col.slice(4))]?.pz || 0;
      if (col === 'coberturaDias') return r.coberturaDias == null ? (r.tieneStock ? Infinity : -1) : r.coberturaDias;
      return r[col];
    };
    return [...arr].sort((a, b) => {
      const va = get(a), vb = get(b);
      if (typeof va === 'string' || typeof vb === 'string') return sgn * String(va || '').localeCompare(String(vb || ''), 'es');
      if (va === vb) return b.valor - a.valor;
      return sgn * ((va ?? -Infinity) - (vb ?? -Infinity));
    });
  }, [skuRows, f, orden]);

  // Facetas (conteos con los demás filtros aplicados) y conteo por CEDIS (sobre todos los CEDIS)
  const facetas = useMemo(() => calcularFacetas(skuRows, f), [skuRows, f]);
  const cedisConteo = useMemo(() => {
    const m = new Map();
    skuRowsTodos.forEach((r) => { if (!pasaTodos(r, f, null)) return; r.cedisSet.forEach((c) => m.set(c, (m.get(c) || 0) + 1)); });
    return m;
  }, [skuRowsTodos, f]);

  const totales = useMemo(() => {
    const t = { totalPz: 0, totalDisp: 0, totalRes: 0, transitoPz: 0, valor: 0 };
    let pzCob = 0, demDia = 0;
    filasTabla.forEach((r) => {
      t.totalPz += r.totalPz; t.totalDisp += r.totalDisp; t.totalRes += r.totalRes; t.transitoPz += r.transitoPz; t.valor += r.valor;
      if (r.demandaMes > 0) { pzCob += r.totalPz; demDia += r.demandaMes / 30; }
    });
    t.coberturaDias = demDia > 0 ? pzCob / demDia : null;
    return t;
  }, [filasTabla]);

  const nFiltrosActivos = contarActivos(filtros) + (cedisFiltro !== 'TODOS' ? 1 : 0);
  const limpiarFiltros = () => { setFiltros(FILTROS_VACIOS()); setCedisFiltro('TODOS'); setBusqueda(''); };
  const toggleFiltro = (grupo, id) => setFiltros((prev) => { const next = new Set(prev[grupo]); if (next.has(id)) next.delete(id); else next.add(id); return { ...prev, [grupo]: next }; });
  const soloEstado = (id) => setFiltros((prev) => ({ ...prev, estado: prev.estado.size === 1 && prev.estado.has(id) ? new Set() : new Set([id]) }));
  const onSort = (col) => setOrden((o) => (o.col === col ? { col, dir: o.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: col === 'sku' || col === 'descripcion' || col === 'marca' ? 'asc' : 'desc' }));

  // Canasta
  const toggleCanasta = (sku) => setCanasta((prev) => { const next = new Set(prev); if (next.has(sku)) next.delete(sku); else next.add(sku); return next; });
  const porSku = useMemo(() => new Map(skuRowsTodos.map((r) => [r.sku, r])), [skuRowsTodos]);
  const filasCompartir = useMemo(() => (compartirSkus || []).map((s) => porSku.get(s)).filter(Boolean), [compartirSkus, porSku]);
  const abrirCompartirCanasta = () => { if (canasta.size) setCompartirSkus([...canasta]); };

  // ── Export Excel (respeta filtros y orden aplicados; sin $ si no hay permiso sensible) ──
  const handleExport = async () => {
    setExportando(true);
    try {
      const XLSX = await import('xlsx-js-style');
      const rows = filasTabla.map((r) => {
        const base = { Marca: r.marca || '', SKU: r.sku, Descripción: r.descripcion || '', Familia: r.familia || '', Categoría: r.categoria || '', Roadmap: r.rdmp || '' };
        for (const a of ALMACENES_GRID) base[shortAlmacen(a)] = Number(r.byAlm[a]?.pz || 0);
        base['Total pz'] = Number(r.totalPz || 0);
        base['Disponible'] = Number(r.totalDisp || 0);
        base['Reservado'] = Number(r.totalRes || 0);
        base['Tránsito pz'] = Number(r.transitoPz || 0);
        base['ETA tránsito'] = r.transitoEta || '';
        base['Demanda pz/mes'] = Math.round(r.demandaMes || 0);
        base['Cobertura días'] = r.coberturaDias == null ? '' : Math.round(r.coberturaDias);
        base['Estado'] = r.riesgo ? 'Riesgo' : r.estado || '';
        base['Lead time días'] = r.leadTime ? r.leadTime.dias : '';
        if (sensible) { base['Costo promedio'] = Number(r.costo || 0); base['Valor'] = Number(r.valor || 0); }
        return base;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const header = Object.keys(rows[0] || { SKU: '' });
      ws['!cols'] = header.map((h) => ({ wch: h === 'Descripción' ? 46 : h === 'Familia' || h === 'Categoría' ? 18 : 13 }));
      header.forEach((h, i) => {
        const cell = ws[XLSX.utils.encode_cell({ r: 0, c: i })];
        if (cell) cell.s = { font: { bold: true, sz: 11, color: { rgb: 'FFFFFFFF' } }, fill: { fgColor: { rgb: 'FF007AFF' } }, alignment: { vertical: 'center', horizontal: 'left' } };
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
      const now = new Date();
      const filename = `Inventario ${String(now.getDate()).padStart(2, '0')} ${String(now.getMonth() + 1).padStart(2, '0')} ${now.getFullYear()}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.ok(`Excel generado · ${fmtInt(rows.length)} SKUs`);
    } catch (e) {
      console.error('Export inventario error:', e);
      toast.error('No se pudo exportar el Excel: ' + (e.message || 'desconocido'));
    } finally {
      setExportando(false);
    }
  };

  // ── Histórico: comparativo vs hace 30 días (o la primera foto) ──
  const hist30 = useMemo(() => {
    if (!historico?.length) return null;
    const ultimo = historico[historico.length - 1];
    const ref = fotoHace(historico, 30);
    if (!ref || ref.fecha === ultimo.fecha) return { solo: historico.length, desde: historico[0].fecha };
    const pct = (k) => (N(ref[k]) > 0 ? ((N(ultimo[k]) - N(ref[k])) / N(ref[k])) * 100 : null);
    return { ref, pctValor: pct('valor'), pctPiezas: pct('piezas') };
  }, [historico]);
  const fmtDelta = (p) => (p == null ? null : `${p > 0 ? '+' : ''}${p.toFixed(1)}% vs hace 30 d`);

  // ── Hero narrativo (frase por reglas) ──
  const hero = useMemo(() => {
    const r = resumen;
    const pl = (n, s, p) => `${fmtInt(n)} ${n === 1 ? s : p}`;
    const cob = r.cobertura != null ? Math.round(r.cobertura) : null;
    let titulo;
    if (r.riesgo > 0) { titulo = `${pl(r.riesgo, 'SKU se agota', 'SKUs se agotan')} antes de que llegue su tránsito.`; }
    else if (r.agotados > 0) { titulo = `${pl(r.agotados, 'SKU con demanda está', 'SKUs con demanda están')} en cero.`; }
    else if (r.criticos > 0) { titulo = `${pl(r.criticos, 'SKU', 'SKUs')} con menos de ${COBERTURA_CRITICA} días de cobertura.`; }
    else if (cob != null && cob > COBERTURA_SOBRESTOCK) { titulo = `Sobre-stock: ${cob} días de cobertura.`; }
    else if (cob != null) { titulo = `Cobertura sana: ${cob} días.`; }
    else if (enriqueciendo) { titulo = 'Inventario Acteck · calculando cobertura…'; }
    else { titulo = `Inventario Acteck · ${sensible ? fmtCompact(r.valor) : `${fmtInt(r.piezas)} pz`}.`; }
    const partes = [];
    if (r.riesgo > 0 && r.agotados > 0) partes.push(`${fmtInt(r.agotados)} agotados con demanda`);
    if (r.criticos > 0 && r.riesgo > 0) partes.push(`${fmtInt(r.criticos)} críticos (< ${COBERTURA_CRITICA} d)`);
    if (r.sobrestock > 0) partes.push(`${fmtInt(r.sobrestock)} en sobre-stock (> ${COBERTURA_SOBRESTOCK} d)${sensible ? ` por ${fmtCompact(r.valorSobre)}` : ` · ${fmtInt(r.piezasSobre)} pz`}`);
    if (r.enTransito > 0) partes.push(`${fmtInt(r.enTransito)} SKUs con tránsito${r.transitoEta ? ` · próximo arribo ${fmtFechaCorta(r.transitoEta)}` : ''}`);
    const sub = partes.length ? partes.join(' · ') + '.' : `${fmtInt(r.piezas)} pz en ${kpis.almacenes} almacenes de ${kpis.nCEDIS} CEDIS · demanda = ERP, promedio de ${mesesRef.length} meses cerrados.`;
    return { titulo, sub };
  }, [resumen, kpis, enriqueciendo, mesesRef.length, sensible]);

  const colorTono = { red: theme.red, orange: theme.orange, green: theme.green, gray: theme.textMuted };

  if (loading) {
    return <div style={{ padding: '10px 6px', background: theme.bg, minHeight: '100%' }}><SkeletonPantalla pantalla="inventarioGlobal" /></div>;
  }
  if (filas.length === 0) {
    return (
      <div style={{ padding: '10px 6px', background: theme.bg, minHeight: '100%' }}>
        <Panel titulo="Inventario" meta="sin datos">
          <p style={{ margin: 0, fontSize: 12.5, color: theme.textMuted, fontFamily: TYPO.fontText }}>No hay datos de inventario. El puente SQL (Mac mini) lo carga cada hora; revisa Administración → Datos.</p>
        </Panel>
      </div>
    );
  }

  const alcanceLabel = `${soloComerciales ? 'Sólo comerciales' : 'Todos los almacenes'}${cedisFiltro !== 'TODOS' ? ` · ${CEDIS_CORTO[cedisFiltro] || cedisFiltro}` : ''}`;
  const tonoCob = tonoCobertura(resumen.cobertura, resumen.conStock > 0);
  const subHistorico = hist30
    ? hist30.solo ? (hist30.solo === 1 ? 'histórico desde hoy' : `histórico desde ${fmtFechaCorta(hist30.desde)}`) : fmtDelta(sensible ? hist30.pctValor : hist30.pctPiezas)
    : null;

  // ── Columnas de la tabla ──
  const dash = <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>;
  const columnas = [
    {
      key: 'sel', label: <span title="Canasta: junta SKUs para compartir su disponibilidad en un solo mensaje">☐</span>, width: 28, align: 'center',
      render: (r) => (
        <input type="checkbox" checked={canasta.has(r.sku)} onChange={() => toggleCanasta(r.sku)} onClick={(e) => e.stopPropagation()}
          title={canasta.has(r.sku) ? 'Quitar de la canasta' : 'Añadir a la canasta para compartir'} style={{ accentColor: theme.accent, cursor: 'pointer', margin: 0, verticalAlign: 'middle' }} />
      ),
    },
    {
      key: 'sku', label: 'SKU', align: 'left', width: 110, mono: true, bold: true, sort: true,
      render: (r) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ChevronRight size={12} style={{ color: theme.accent, flexShrink: 0, transform: skuAbierto === r.sku ? 'rotate(90deg)' : 'none', transition: `transform ${DUR.state}ms ${EASE}` }} />
          {r.sku}
        </span>
      ),
    },
    {
      // Marca va dentro de la celda de descripción (regla de ancho: la tabla cabe en su
      // tarjeta, sin scroll horizontal). El desglose por almacén vive en el drill.
      key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 320, sort: true,
      render: (r) => (
        <span title={`${r.descripcion || ''}${r.marca ? ` · ${r.marca}` : ''}`}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 500 }}>{r.descripcion || '—'}</span>
          {r.marca && <span style={{ display: 'block', fontSize: 9.5, color: theme.textMuted }}>{r.marca}</span>}
        </span>
      ),
    },
    { key: 'totalPz', label: 'Total pz', width: 70, sort: true, bold: true, render: (r) => fmtInt(r.totalPz), renderTotal: (v) => fmtInt(v) },
    { key: 'totalDisp', label: 'Disp.', width: 64, sort: true, render: (r) => (r.totalDisp > 0 ? <span style={{ color: theme.green }}>{fmtInt(r.totalDisp)}</span> : dash), renderTotal: (v) => fmtInt(v) },
    {
      key: 'totalRes', label: 'Apart.', width: 64, sort: true,
      render: (r) => (r.totalRes > 0 ? <span style={{ color: theme.orange }} title={`${fmtInt(r.totalRes)} pz comprometidas en órdenes en curso`}>{fmtInt(r.totalRes)}</span> : dash),
      renderTotal: (v) => fmtInt(v),
    },
    {
      key: 'transitoPz', label: 'Trán.', width: 84, sort: true,
      render: (r) => (r.transitoPz > 0
        ? <Pill tone={r.riesgo ? 'red' : 'blue'} size="xs" title={r.transitoEta ? `ETA ${fmtFechaCorta(r.transitoEta)} · ${r.transitoPos} PO${r.transitoPos > 1 ? 's' : ''}` : ''}>{fmtInt(r.transitoPz)}{r.transitoEta ? ` · ${fmtFechaCorta(r.transitoEta)}` : ''}</Pill>
        : dash),
      renderTotal: (v) => fmtInt(v),
    },
    {
      key: 'coberturaDias', label: 'Días', width: 70, sort: true,
      render: (r) => {
        if (enriqueciendo) return <span style={{ color: theme.textSubtle || theme.textMuted }}>…</span>;
        if (!r.tieneStock) return r.demandaMes > 0 ? <Pill tone="red" size="xs">Agotado</Pill> : dash;
        if (r.coberturaDias == null) return <Pill tone="gray" size="xs" title="Sin demanda ERP en 3 meses cerrados">∞</Pill>;
        return <Pill tone={tonoCobertura(r.coberturaDias, true)} size="xs">{fmtInt(r.coberturaDias)} d</Pill>;
      },
      renderTotal: (v) => (v == null ? '—' : `${fmtInt(v)} d`),
    },
    ...(sensible ? [{ key: 'valor', label: 'Valor', width: 80, sort: true, bold: true, render: (r) => fmtCompact(r.valor), renderTotal: (v) => fmtCompact(v) }] : []),
  ];
  const kpiActivo = (id) => (filtros.estado.size === 1 && filtros.estado.has(id) ? { borderColor: theme.accent } : undefined);

  return (
    <div ref={rootRef} data-stagger style={{ padding: '10px 6px', display: 'flex', flexDirection: 'column', gap: 10, background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%' }}>
      {/* Alcance */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '0 2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600, whiteSpace: 'nowrap' }}>Dirección Comercial · Snapshot actual</span>
          {enriqueciendo && <Pill tone="gray" size="xs" dot>cargando tránsito, lead time y demanda…</Pill>}
        </div>
        <Segmented value={soloComerciales ? 'com' : 'todos'} onChange={(v) => setSoloComerciales(v === 'com')}
          options={[{ id: 'com', label: 'Sólo comerciales' }, { id: 'todos', label: 'Todos los almacenes' }]} />
      </div>

      {/* Hero narrativo */}
      <Hero eyebrow={`Inventario Acteck · ${alcanceLabel}`} titulo={hero.titulo} sub={hero.sub}
        stats={[
          sensible
            ? { k: 'Inv Actual', medida: tooltip('inv_actual'), v: fmtCompact(resumen.valor), sub: subHistorico || `${fmtInt(resumen.piezas)} pz a costo` }
            : { k: 'Piezas', medida: tooltip('inv_actual', 'piezas'), v: fmtInt(resumen.piezas), sub: subHistorico || `${fmtInt(resumen.disponible)} disponibles` },
          { k: 'SKUs con stock', v: fmtInt(resumen.conStock), sub: `de ${fmtInt(resumen.nSkus)} SKUs` },
          // Apartado = inventario − disponible: comprometido a órdenes en curso, no vendible otra vez.
          {
            k: 'Apartado', medida: 'Apartado = inventario − disponible dentro de [Inv Actual]. Producto comprometido a órdenes en curso: no se puede volver a vender.',
            v: sensible ? fmtCompact(resumen.valorReservado) : fmtInt(resumen.reservado),
            sub: sensible ? `${fmtInt(resumen.reservado)} pz · ${resumen.pctReservado.toFixed(1)}% del inventario` : `pz · ${resumen.pctReservado.toFixed(1)}% del inventario`,
            color: resumen.pctReservado > 20 ? theme.orange : undefined,
          },
          soloComerciales && cedisFiltro === 'TODOS' && med?.dias_inv != null
            ? { k: 'Días de Inv', medida: tooltip('dias_inv'), v: `${fmtInt(Math.round(med.dias_inv))} d`, sub: `Inv Actual / CV 3 meses × 90`, color: med.dias_inv > 120 ? theme.orange : med.dias_inv < 30 ? theme.red : theme.green }
            : { k: 'Cobertura SKU', medida: 'Cobertura por SKU · piezas / (demanda ERP 3 meses cerrados / 30). NO es la medida Dias de Inv del director (esa es en pesos a costo).', v: resumen.cobertura != null ? `${fmtInt(resumen.cobertura)} d` : enriqueciendo ? '…' : '—', sub: 'ritmo ERP · 3 meses · piezas', color: resumen.cobertura != null ? colorTono[tonoCob] : undefined },
        ]}>
        <div style={{ marginTop: 8 }}><FrescuraPill pantalla="inventarioGlobal" inverso /></div>
      </Hero>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
        <KpiCard eyebrow="Agotados" badge={{ tone: resumen.agotados > 0 ? 'red' : 'green', l: resumen.agotados > 0 ? 'Con demanda' : 'OK' }}
          big={fmtInt(resumen.agotados)} bigSmall="SKUs" bigColor={resumen.agotados > 0 ? theme.red : theme.text}
          sub={resumen.agotados > 0 ? `${fmtInt(resumen.demandaPerdida)} pz/mes de demanda sin stock` : 'ningún SKU con demanda en cero'}
          onClick={() => soloEstado('Agotado')} style={kpiActivo('Agotado')} />
        <KpiCard eyebrow="En tránsito" badge={{ tone: 'blue', l: `${fmtInt(resumen.transitoPos)} PO${resumen.transitoPos === 1 ? '' : 's'}` }}
          big={sensible ? fmtCompact(resumen.transitoValor) : fmtInt(resumen.transitoPz)} bigSmall={sensible ? `${fmtInt(resumen.transitoPz)} pz` : 'pz'}
          sub={resumen.enTransito > 0 ? `${fmtInt(resumen.enTransito)} SKUs · próximo arribo ${fmtFechaCorta(resumen.transitoEta)}${resumen.riesgo > 0 ? ` · ${fmtInt(resumen.riesgo)} en riesgo` : ''}` : 'sin embarques pendientes'}
          onClick={() => setFiltros((p) => ({ ...p, soloTransito: !p.soloTransito }))} style={filtros.soloTransito ? { borderColor: theme.accent } : undefined} />
        <KpiCard eyebrow={`Sobre-stock > ${COBERTURA_SOBRESTOCK} días`} badge={{ tone: resumen.sobrestock > 0 ? 'orange' : 'green', l: resumen.sobrestock > 0 ? 'Inmovilizado' : 'OK' }}
          big={fmtInt(resumen.sobrestock)} bigSmall="SKUs" bigColor={resumen.sobrestock > 0 ? theme.orange : theme.text}
          sub={resumen.sobrestock > 0
            ? (sensible ? `${fmtCompact(resumen.valorSobre)} a costo · ${resumen.valor > 0 ? ((resumen.valorSobre / resumen.valor) * 100).toFixed(0) : 0}% del valor` : `${fmtInt(resumen.piezasSobre)} pz · ${resumen.piezas > 0 ? ((resumen.piezasSobre / resumen.piezas) * 100).toFixed(0) : 0}% de las piezas`)
            : 'sin SKUs con exceso de cobertura'}
          onClick={() => soloEstado('Sobre-stock')} style={kpiActivo('Sobre-stock')} />
        <KpiCard eyebrow="Lead time" badge={{ tone: 'gray', l: `${fmtInt(resumen.nLt)} SKUs` }}
          big={resumen.leadTime != null ? fmtDias(resumen.leadTime) : '—'} bigSmall="promedio"
          sub={resumen.leadTime != null ? `${fmtInt(resumen.ltMin)}–${fmtInt(resumen.ltMax)} d de emisión a CEDIS · embarques concluidos` : 'sin historial de embarques'} />
      </div>

      {/* Detalle principal · tabla SKU × almacén */}
      <Panel titulo="SKUs por almacén" meta={`${fmtInt(filasTabla.length)} SKUs · click en una fila abre el desglose por almacén`}
        padding={0}
        acciones={<ExportMenu titulo="Inventario" subtitulo={`${fmtInt(filasTabla.length)} SKUs · ${ALMACENES_GRID.length} almacenes`} excel={handleExport} pdf={{ ref: rootRef }} deshabilitado={exportando || filasTabla.length === 0} size="md" />}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: `1px solid ${theme.border}`, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: theme.bg, border: `1px solid ${busqueda ? theme.accent : theme.border}`, borderRadius: 999, height: 30, flex: 1, minWidth: 220, maxWidth: 360 }}>
            <Search size={12} style={{ color: theme.textMuted, flexShrink: 0 }} />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar: palabras en cualquier orden, sin acentos (mouse inalambrico negro, parte del SKU…)"
              style={{ border: 0, outline: 0, background: 'transparent', fontFamily: TYPO.fontText, fontSize: 12, color: theme.text, flex: 1, minWidth: 0 }} />
            {busqueda && <X size={12} style={{ color: theme.textMuted, cursor: 'pointer', flexShrink: 0 }} onClick={() => setBusqueda('')} />}
          </div>
          <span style={{ fontSize: 10.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            {fmtInt(filasTabla.length)} de {fmtInt(skuRows.length)} SKUs{canasta.size ? ` · ${fmtInt(canasta.size)} en la canasta` : ''}
          </span>
        </div>

        <FiltrosPills f={f} facetas={facetas} cedis={cedisFiltro} cedisConteo={cedisConteo} onCedis={setCedisFiltro}
          onToggle={toggleFiltro}
          onSoloStock={(v) => setFiltros((p) => ({ ...p, soloStock: v }))}
          onSoloTransito={(v) => setFiltros((p) => ({ ...p, soloTransito: v }))}
          nActivos={nFiltrosActivos} onLimpiar={limpiarFiltros} />

        <TablaCompacta
          columnas={columnas}
          filas={filasTabla.slice(0, MAX_FILAS)}
          rowKey={(r) => r.sku}
          orden={orden} onSort={onSort}
          totales={totales}
          maxHeight="62vh"
          vacio={enriqueciendo && filtros.estado.size ? 'Calculando cobertura y tránsito…' : 'Sin SKUs con estos filtros.'}
          onRowClick={(r) => setSkuAbierto((s) => (s === r.sku ? null : r.sku))}
          expandidoKey={skuAbierto}
          renderExpandido={(r) => <SkuDrillDown row={r} sensible={sensible} onCompartir={(sku) => setCompartirSkus([sku])} enCanasta={canasta.has(r.sku)} onToggleCanasta={toggleCanasta} />}
        />
        {filasTabla.length > MAX_FILAS && (
          <div style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
            Mostrando {MAX_FILAS} de {fmtInt(filasTabla.length)} SKUs · usa el buscador o los filtros · el Excel exporta todos
          </div>
        )}
      </Panel>

      {/* Próximos arribos (POs con ETA en 7/14/30 días, cruzados con la cobertura) */}
      <ProximosArribos transito={transito} skuRows={skuRows} descripciones={descripciones} sensible={sensible}
        onVerSku={(sku) => { setFiltros(FILTROS_VACIOS()); setBusqueda(sku); setSkuAbierto(sku); rootRef.current?.querySelector('input')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} />

      {/* Inventario comprometido (apartado) y fuera de venta · dos cifras que no se veían */}
      <ApartadoPanel skuRows={universo} sensible={sensible}
        onVerSku={(sku) => { setFiltros(FILTROS_VACIOS()); setBusqueda(sku); setSkuAbierto(sku); }} />
      <FueraDeVenta filas={filas} descripciones={descripciones} sensible={sensible} />

      {/* Tendencia (histórico diario) */}
      <HistoricoPanel historico={historico} demandaDia={resumen.demDia} sensible={sensible} />

      {/* Secundario */}
      <ResumenSecundario porCedis={porCedis} porTipo={porTipo} kpis={kpis} insights={resumen} cedisFiltro={cedisFiltro} onCedis={setCedisFiltro} sensible={sensible} />

      {/* Canasta flotante */}
      {canasta.size > 0 && (
        <div style={{ position: 'fixed', right: 22, bottom: 22, zIndex: 60, display: 'flex', alignItems: 'center', gap: 6, padding: 6, borderRadius: 999, background: theme.surface, border: `1px solid ${theme.border}`, boxShadow: elevation(theme, 'flotante'), fontFamily: TYPO.fontText }}>
          <Boton icon={Share2} primario size="md" onClick={abrirCompartirCanasta}>Compartir {fmtInt(canasta.size)} SKU{canasta.size === 1 ? '' : 's'}</Boton>
          <Boton icon={X} size="md" onClick={() => setCanasta(new Set())} title="Vaciar la canasta">Vaciar</Boton>
        </div>
      )}

      {/* Hoja compartir (1 SKU desde el drill o N desde la canasta) */}
      <CompartirHoja abierto={!!compartirSkus} rows={filasCompartir} onClose={() => setCompartirSkus(null)}
        onQuitar={(sku) => { setCompartirSkus((l) => (l || []).filter((s) => s !== sku)); setCanasta((prev) => { const n = new Set(prev); n.delete(sku); return n; }); }} />
    </div>
  );
}
