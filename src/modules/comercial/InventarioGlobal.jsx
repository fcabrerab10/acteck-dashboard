// Inventario global · V3. Hero narrativo → 4 KpiCard → tabla SKU × almacén
// (TablaCompacta + HeatCell, drill por SKU) → secundario plegable (CEDIS / estatus / tipos).
// Datos: inventario/useInventarioDatos.js · constantes y formatos: inventario/constantes.js.
import React, { useMemo, useRef, useState } from 'react';
import { Search, SlidersHorizontal, ChevronRight } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import SinAcceso from '../../components/SinAcceso';
import ExportMenu from '../../components/ExportMenu';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaGlobal } from '../../lib/permisos';
import { Hero, KpiCard, Pill, Segmented, TablaCompacta, HeatCell, Panel, Boton, SkeletonPantalla, toast } from '../../components/kit';
import { EASE, DUR } from '../../lib/motion';
import useInventarioDatos from './inventario/useInventarioDatos';
import SkuDrillDown from './inventario/SkuDrillDown';
import ResumenSecundario from './inventario/ResumenSecundario';
import FiltrosInventario from './inventario/FiltrosInventario';
import {
  NOMBRES_ALMACEN, CEDIS_CORTO, CEDIS_LISTA, ALMACENES_GRID, shortAlmacen, tipoDe, esComercial,
  COBERTURA_CRITICA, COBERTURA_SOBRESTOCK, N,
  fmtCompact, fmtInt, fmtDias, fmtFechaCorta, diasHasta, tonoCobertura,
} from './inventario/constantes';

const MAX_FILAS = 300;

export default function InventarioGlobal() {
  const perfil = usePerfil();
  if (!puedeVerPestanaGlobal(perfil, 'inventario_global')) {
    return <SinAcceso motivo="No tienes acceso a Inventario." />;
  }
  return <InventarioGlobalPantalla />;
}

function InventarioGlobalPantalla() {
  const { theme } = useTheme();
  const rootRef = useRef(null); // raíz para exportar PDF
  const { filas, loading, enriqueciendo, descripciones, transito, leadTime, demanda, mesesRef } = useInventarioDatos();

  // Alcance
  const [soloComerciales, setSoloComerciales] = useState(true);
  const [cedisFiltro, setCedisFiltro] = useState('TODOS');
  // Filtros de tabla
  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [marcaFiltro, setMarcaFiltro] = useState(() => new Set());     // Set de marcas · vacío = todas
  const [familiaFiltro, setFamiliaFiltro] = useState('');              // '' = todas
  const [roadmapFiltro, setRoadmapFiltro] = useState(() => new Set()); // Set de rdmp · vacío = todos
  const [soloConStock, setSoloConStock] = useState(false);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [orden, setOrden] = useState({ col: 'valor', dir: 'desc' });
  const [skuAbierto, setSkuAbierto] = useState(null);
  const [exportando, setExportando] = useState(false);

  // ── Filas efectivas según alcance ──
  const filasEfectivas = useMemo(() => filas.filter((r) => {
    if (!r.cedis) return false; // ignoramos sin CEDIS asignado
    if (soloComerciales && !esComercial(Number(r.no_almacen))) return false;
    if (cedisFiltro !== 'TODOS' && r.cedis !== cedisFiltro) return false;
    return true;
  }), [filas, soloComerciales, cedisFiltro]);

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
    const total = Array.from(m.values()).reduce((s, x) => s + x.valor, 0);
    return Array.from(m.values()).map((it) => ({ ...it, skus: it.skus.size, almacenes: it.almacenes.size, share: total > 0 ? (it.valor / total) * 100 : 0 })).sort((a, b) => b.valor - a.valor);
  }, [filasEfectivas]);

  const porTipo = useMemo(() => {
    const m = new Map();
    filasEfectivas.forEach((r) => {
      const t = tipoDe(Number(r.no_almacen));
      if (!m.has(t)) m.set(t, { tipo: t, valor: 0, piezas: 0, skus: new Set() });
      const it = m.get(t);
      it.valor += N(r.costoinventario); it.piezas += N(r.inventario);
      if (r.articulo) it.skus.add(r.articulo);
    });
    const total = Array.from(m.values()).reduce((s, x) => s + x.valor, 0);
    return Array.from(m.values()).map((it) => ({ ...it, skus: it.skus.size, share: total > 0 ? (it.valor / total) * 100 : 0 })).sort((a, b) => b.valor - a.valor);
  }, [filasEfectivas]);

  // ── SKU × almacén enriquecido (descripción, tránsito, lead time, demanda, cobertura) ──
  const skuRows = useMemo(() => {
    const m = new Map();
    filasEfectivas.forEach((r) => {
      const sku = r.articulo;
      if (!sku) return;
      if (!m.has(sku)) m.set(sku, { sku, byAlm: {}, totalPz: 0, totalDisp: 0, totalRes: 0, valor: 0, costoRef: 0 });
      const it = m.get(sku);
      const alm = Number(r.no_almacen);
      const pz = N(r.inventario), disp = N(r.disponible), res = Math.max(0, pz - disp), val = N(r.costoinventario);
      if (!it.byAlm[alm]) it.byAlm[alm] = { pz: 0, disp: 0, res: 0, valor: 0, cedis: r.cedis };
      it.byAlm[alm].pz += pz; it.byAlm[alm].disp += disp; it.byAlm[alm].res += res; it.byAlm[alm].valor += val;
      it.totalPz += pz; it.totalDisp += disp; it.totalRes += res; it.valor += val;
      it.costoRef = Math.max(it.costoRef, N(r.costopromedio));
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
      return {
        ...it,
        descripcion: d.descripcion || '', marca: d.marca || '', familia: d.familia || '', rdmp: d.rdmp || '', categoria: d.categoria || '',
        transito: tr, transitoPz, transitoPos: tr ? tr.pos.length : 0, transitoEta: tr?.eta || null, transitoValor: transitoPz * costo,
        leadTime: lt, demandaMes, coberturaDias, agotado, critico, sobrestock, riesgo, tieneStock,
      };
    });
  }, [filasEfectivas, descripciones, transito, leadTime, demanda]);

  // Opciones de filtros (derivadas de la data)
  const opcionesFiltros = useMemo(() => {
    const marcas = new Set(), familias = new Set(), roadmaps = new Set();
    for (const [, d] of descripciones) {
      if (d.marca) marcas.add(String(d.marca).trim());
      if (d.familia) familias.add(String(d.familia).trim());
      if (d.rdmp) roadmaps.add(String(d.rdmp).trim().toUpperCase());
    }
    return { marcas: Array.from(marcas).sort(), familias: Array.from(familias).sort(), roadmaps: Array.from(roadmaps).sort() };
  }, [descripciones]);

  // Universo = alcance + marca/familia/roadmap (hero y KPIs se calculan aquí)
  const universo = useMemo(() => skuRows.filter((r) => {
    if (marcaFiltro.size > 0 && !marcaFiltro.has(String(r.marca || '').trim().toLowerCase())) return false;
    if (familiaFiltro && String(r.familia || '').trim().toLowerCase() !== familiaFiltro.toLowerCase()) return false;
    if (roadmapFiltro.size > 0 && !roadmapFiltro.has(String(r.rdmp || '').toUpperCase())) return false;
    return true;
  }), [skuRows, marcaFiltro, familiaFiltro, roadmapFiltro]);

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
    const demandaPerdida = agotados.reduce((s, r) => s + r.demandaMes, 0);
    const conLt = universo.filter((r) => r.leadTime && r.leadTime.muestras > 0);
    const ltPond = conLt.reduce((s, r) => s + r.leadTime.dias * r.leadTime.muestras, 0) / (conLt.reduce((s, r) => s + r.leadTime.muestras, 0) || 1);
    const ltMin = conLt.length ? Math.min(...conLt.map((r) => r.leadTime.min)) : null;
    const ltMax = conLt.length ? Math.max(...conLt.map((r) => r.leadTime.max)) : null;
    const valor = universo.reduce((s, r) => s + r.valor, 0);
    const piezas = universo.reduce((s, r) => s + r.totalPz, 0);
    const reservado = universo.reduce((s, r) => s + r.totalRes, 0);
    const valorReservado = universo.reduce((s, r) => s + r.totalRes * (r.totalPz > 0 ? r.valor / r.totalPz : 0), 0);
    return {
      valor, piezas, nSkus: universo.length, conStock: conStock.length,
      agotados: agotados.length, criticos: criticos.length, sobrestock: sobre.length, enTransito: enTransito.length, riesgo: riesgo.length,
      cobertura, transitoValor, transitoPz, transitoPos, transitoEta, valorSobre, demandaPerdida,
      leadTime: conLt.length ? ltPond : null, ltMin, ltMax, nLt: conLt.length,
      reservado, valorReservado, disponible: piezas - reservado, valorDisponible: Math.max(0, valor - valorReservado),
      pctReservado: piezas > 0 ? (reservado / piezas) * 100 : 0,
    };
  }, [universo]);

  // ── Tabla: búsqueda + estado + sólo con stock + orden ──
  const filasTabla = useMemo(() => {
    let arr = universo;
    const q = busqueda.trim().toUpperCase();
    if (q) arr = arr.filter((r) => `${r.sku} ${r.descripcion} ${r.marca} ${r.familia} ${r.categoria}`.toUpperCase().includes(q));
    if (soloConStock) arr = arr.filter((r) => r.tieneStock);
    if (estadoFiltro === 'riesgo') arr = arr.filter((r) => r.riesgo);
    else if (estadoFiltro === 'agotados') arr = arr.filter((r) => r.agotado);
    else if (estadoFiltro === 'criticos') arr = arr.filter((r) => r.critico);
    else if (estadoFiltro === 'sobrestock') arr = arr.filter((r) => r.sobrestock);
    else if (estadoFiltro === 'transito') arr = arr.filter((r) => r.transitoPz > 0);
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
  }, [universo, busqueda, soloConStock, estadoFiltro, orden]);

  const maxCelda = useMemo(() => {
    let m = 0;
    filasTabla.forEach((r) => ALMACENES_GRID.forEach((a) => { const v = r.byAlm[a]?.pz || 0; if (v > m) m = v; }));
    return m || 1;
  }, [filasTabla]);

  const totales = useMemo(() => {
    const t = { totalPz: 0, totalDisp: 0, transitoPz: 0, valor: 0 };
    ALMACENES_GRID.forEach((a) => { t[`alm_${a}`] = 0; });
    let pzCob = 0, demDia = 0;
    filasTabla.forEach((r) => {
      t.totalPz += r.totalPz; t.totalDisp += r.totalDisp; t.transitoPz += r.transitoPz; t.valor += r.valor;
      ALMACENES_GRID.forEach((a) => { t[`alm_${a}`] += r.byAlm[a]?.pz || 0; });
      if (r.demandaMes > 0) { pzCob += r.totalPz; demDia += r.demandaMes / 30; }
    });
    t.coberturaDias = demDia > 0 ? pzCob / demDia : null;
    return t;
  }, [filasTabla]);

  const nFiltrosActivos = (marcaFiltro.size > 0 ? 1 : 0) + (familiaFiltro ? 1 : 0) + (roadmapFiltro.size > 0 ? 1 : 0) + (soloConStock ? 1 : 0);
  const limpiarFiltros = () => { setMarcaFiltro(new Set()); setFamiliaFiltro(''); setRoadmapFiltro(new Set()); setSoloConStock(false); };
  const onSort = (col) => setOrden((o) => (o.col === col ? { col, dir: o.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: col === 'sku' || col === 'descripcion' || col === 'marca' ? 'asc' : 'desc' }));
  const toggleEstado = (id) => setEstadoFiltro((e) => (e === id ? 'todos' : id));

  // ── Export Excel (respeta filtros y orden aplicados) ──
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
        base['Lead time días'] = r.leadTime ? r.leadTime.dias : '';
        base['Valor'] = Number(r.valor || 0);
        return base;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 14 }, { wch: 14 }, { wch: 46 }, { wch: 18 }, { wch: 18 }, { wch: 10 },
        ...ALMACENES_GRID.map(() => ({ wch: 12 })),
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      ];
      const header = Object.keys(rows[0] || { SKU: '' });
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
    else { titulo = `Inventario Acteck · ${fmtCompact(r.valor)}.`; }
    const partes = [];
    if (r.riesgo > 0 && r.agotados > 0) partes.push(`${fmtInt(r.agotados)} agotados con demanda`);
    if (r.criticos > 0 && r.riesgo > 0) partes.push(`${fmtInt(r.criticos)} críticos (< ${COBERTURA_CRITICA} d)`);
    if (r.sobrestock > 0) partes.push(`${fmtInt(r.sobrestock)} en sobre-stock (> ${COBERTURA_SOBRESTOCK} d) por ${fmtCompact(r.valorSobre)}`);
    if (r.enTransito > 0) partes.push(`${fmtInt(r.enTransito)} SKUs con tránsito${r.transitoEta ? ` · próximo arribo ${fmtFechaCorta(r.transitoEta)}` : ''}`);
    const sub = partes.length ? partes.join(' · ') + '.' : `${fmtInt(r.piezas)} pz en ${kpis.almacenes} almacenes de ${kpis.nCEDIS} CEDIS · demanda = ERP, promedio de ${mesesRef.length} meses cerrados.`;
    return { titulo, sub };
  }, [resumen, kpis, enriqueciendo, mesesRef.length]);

  const colorTono = { red: theme.red, orange: theme.orange, green: theme.green, gray: theme.textMuted };

  if (loading) {
    return <div style={{ padding: '10px 6px', background: theme.bg, minHeight: '100%' }}><SkeletonPantalla /></div>;
  }
  if (filas.length === 0) {
    return (
      <div style={{ padding: '10px 6px', background: theme.bg, minHeight: '100%' }}>
        <Panel titulo="Inventario" meta="sin datos">
          <p style={{ margin: 0, fontSize: 12.5, color: theme.textMuted, fontFamily: TYPO.fontText }}>No hay datos. Sube el archivo ERP en /uploads.html.</p>
        </Panel>
      </div>
    );
  }

  const alcanceLabel = `${soloComerciales ? 'Sólo comerciales' : 'Todos los almacenes'}${cedisFiltro !== 'TODOS' ? ` · ${CEDIS_CORTO[cedisFiltro] || cedisFiltro}` : ''}`;
  const tonoCob = tonoCobertura(resumen.cobertura, resumen.conStock > 0);

  // ── Columnas de la tabla ──
  const dash = <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>;
  const columnas = [
    { key: 'marca', label: 'Marca', align: 'left', width: 70, sort: true, render: (r) => <span style={{ color: theme.textMuted, fontSize: 10.5 }}>{r.marca || '—'}</span> },
    {
      key: 'sku', label: 'SKU', align: 'left', width: 110, mono: true, bold: true, sort: true,
      render: (r) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ChevronRight size={12} style={{ color: theme.accent, flexShrink: 0, transform: skuAbierto === r.sku ? 'rotate(90deg)' : 'none', transition: `transform ${DUR.state}ms ${EASE}` }} />
          {r.sku}
        </span>
      ),
    },
    { key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 260, sort: true, render: (r) => <span title={r.descripcion} style={{ fontFamily: TYPO.fontDisplay, fontWeight: 500 }}>{r.descripcion || '—'}</span> },
    ...ALMACENES_GRID.map((a) => ({
      key: `alm_${a}`, label: <span title={NOMBRES_ALMACEN[a]}>{shortAlmacen(a)}</span>, width: 58, sort: true,
      render: (r) => <HeatCell v={r.byAlm[a]?.pz || 0} max={maxCelda} />, renderTotal: (v) => fmtInt(v),
    })),
    { key: 'totalPz', label: 'Total pz', width: 70, sort: true, bold: true, render: (r) => fmtInt(r.totalPz), renderTotal: (v) => fmtInt(v) },
    { key: 'totalDisp', label: 'Disp.', width: 64, sort: true, render: (r) => (r.totalDisp > 0 ? <span style={{ color: theme.green }}>{fmtInt(r.totalDisp)}</span> : dash), renderTotal: (v) => fmtInt(v) },
    {
      key: 'transitoPz', label: 'Tránsito', width: 84, sort: true,
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
    { key: 'valor', label: 'Valor', width: 80, sort: true, bold: true, render: (r) => fmtCompact(r.valor), renderTotal: (v) => fmtCompact(v) },
  ];

  const opcionesEstado = [
    { id: 'todos', label: 'Todos' },
    { id: 'riesgo', label: 'Riesgo', badge: resumen.riesgo || undefined, title: 'Se agotan antes de que llegue su tránsito' },
    { id: 'agotados', label: 'Agotados', badge: resumen.agotados || undefined, title: 'Sin stock y con demanda ERP' },
    { id: 'criticos', label: 'Críticos', badge: resumen.criticos || undefined, title: `Menos de ${COBERTURA_CRITICA} días de cobertura` },
    { id: 'sobrestock', label: 'Sobre-stock', badge: resumen.sobrestock || undefined, title: `Más de ${COBERTURA_SOBRESTOCK} días de cobertura` },
    { id: 'transito', label: 'Tránsito', badge: resumen.enTransito || undefined, title: 'Con embarques pendientes' },
  ];

  return (
    <div ref={rootRef} data-stagger style={{ padding: '10px 6px', display: 'flex', flexDirection: 'column', gap: 10, background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%' }}>
      {/* Alcance */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '0 2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600, whiteSpace: 'nowrap' }}>Dirección Comercial · Snapshot actual</span>
          {enriqueciendo && <Pill tone="gray" size="xs" dot>cargando tránsito, lead time y demanda…</Pill>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Segmented value={soloComerciales ? 'com' : 'todos'} onChange={(v) => setSoloComerciales(v === 'com')}
            options={[{ id: 'com', label: 'Sólo comerciales' }, { id: 'todos', label: 'Todos los almacenes' }]} />
          <Segmented value={cedisFiltro} onChange={setCedisFiltro}
            options={[{ id: 'TODOS', label: 'Todos los CEDIS' }, ...CEDIS_LISTA.map((c) => ({ id: c, label: CEDIS_CORTO[c] }))]} />
        </div>
      </div>

      {/* Hero narrativo */}
      <Hero eyebrow={`Inventario Acteck · ${alcanceLabel}`} titulo={hero.titulo} sub={hero.sub}
        stats={[
          { k: 'Valor comercial', v: fmtCompact(resumen.valor), sub: `${fmtInt(resumen.piezas)} pz a costo` },
          { k: 'SKUs con stock', v: fmtInt(resumen.conStock), sub: `de ${fmtInt(resumen.nSkus)} SKUs` },
          { k: 'Cobertura', v: resumen.cobertura != null ? `${fmtInt(resumen.cobertura)} d` : enriqueciendo ? '…' : '—', sub: 'ritmo ERP · 3 meses', color: resumen.cobertura != null ? colorTono[tonoCob] : undefined },
        ]} />

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
        <KpiCard eyebrow="Agotados" badge={{ tone: resumen.agotados > 0 ? 'red' : 'green', l: resumen.agotados > 0 ? 'Con demanda' : 'OK' }}
          big={fmtInt(resumen.agotados)} bigSmall="SKUs" bigColor={resumen.agotados > 0 ? theme.red : theme.text}
          sub={resumen.agotados > 0 ? `${fmtInt(resumen.demandaPerdida)} pz/mes de demanda sin stock` : 'ningún SKU con demanda en cero'}
          onClick={() => toggleEstado('agotados')} style={estadoFiltro === 'agotados' ? { borderColor: theme.accent } : undefined} />
        <KpiCard eyebrow="En tránsito" badge={{ tone: 'blue', l: `${fmtInt(resumen.transitoPos)} PO${resumen.transitoPos === 1 ? '' : 's'}` }}
          big={fmtCompact(resumen.transitoValor)} bigSmall={`${fmtInt(resumen.transitoPz)} pz`}
          sub={resumen.enTransito > 0 ? `${fmtInt(resumen.enTransito)} SKUs · próximo arribo ${fmtFechaCorta(resumen.transitoEta)}${resumen.riesgo > 0 ? ` · ${fmtInt(resumen.riesgo)} en riesgo` : ''}` : 'sin embarques pendientes'}
          onClick={() => toggleEstado('transito')} style={estadoFiltro === 'transito' ? { borderColor: theme.accent } : undefined} />
        <KpiCard eyebrow={`Sobre-stock > ${COBERTURA_SOBRESTOCK} días`} badge={{ tone: resumen.sobrestock > 0 ? 'orange' : 'green', l: resumen.sobrestock > 0 ? 'Inmovilizado' : 'OK' }}
          big={fmtInt(resumen.sobrestock)} bigSmall="SKUs" bigColor={resumen.sobrestock > 0 ? theme.orange : theme.text}
          sub={resumen.sobrestock > 0 ? `${fmtCompact(resumen.valorSobre)} a costo · ${resumen.valor > 0 ? ((resumen.valorSobre / resumen.valor) * 100).toFixed(0) : 0}% del valor` : 'sin SKUs con exceso de cobertura'}
          onClick={() => toggleEstado('sobrestock')} style={estadoFiltro === 'sobrestock' ? { borderColor: theme.accent } : undefined} />
        <KpiCard eyebrow="Lead time" badge={{ tone: 'gray', l: `${fmtInt(resumen.nLt)} SKUs` }}
          big={resumen.leadTime != null ? fmtDias(resumen.leadTime) : '—'} bigSmall="promedio"
          sub={resumen.leadTime != null ? `${fmtInt(resumen.ltMin)}–${fmtInt(resumen.ltMax)} d de emisión a CEDIS · embarques concluidos` : 'sin historial de embarques'} />
      </div>

      {/* Detalle principal · tabla SKU × almacén */}
      <Panel titulo="SKUs por almacén" meta={`${fmtInt(filasTabla.length)} SKUs · ${ALMACENES_GRID.length} almacenes · click en una fila abre el drill`}
        padding={0}
        acciones={<ExportMenu titulo="Inventario" subtitulo={`${fmtInt(filasTabla.length)} SKUs · ${ALMACENES_GRID.length} almacenes`} excel={handleExport} pdf={{ ref: rootRef }} deshabilitado={exportando || filasTabla.length === 0} size="md" />}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: `1px solid ${theme.border}`, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 999, height: 30, flex: 1, minWidth: 180, maxWidth: 280 }}>
            <Search size={12} style={{ color: theme.textMuted, flexShrink: 0 }} />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar SKU, marca, familia…"
              style={{ border: 0, outline: 0, background: 'transparent', fontFamily: TYPO.fontText, fontSize: 12, color: theme.text, flex: 1, minWidth: 0 }} />
          </div>
          <Segmented options={opcionesEstado} value={estadoFiltro} onChange={setEstadoFiltro} />
          <Boton icon={SlidersHorizontal} onClick={() => setFiltrosAbiertos((v) => !v)} primario={filtrosAbiertos || nFiltrosActivos > 0}>
            Filtros{nFiltrosActivos > 0 ? ` · ${nFiltrosActivos}` : ''}
          </Boton>
          <span style={{ fontSize: 10.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            {fmtInt(filasTabla.length)} de {fmtInt(universo.length)} SKUs
          </span>
        </div>

        {filtrosAbiertos && (
          <FiltrosInventario opciones={opcionesFiltros}
            marca={marcaFiltro} setMarca={setMarcaFiltro}
            familia={familiaFiltro} setFamilia={setFamiliaFiltro}
            roadmap={roadmapFiltro} setRoadmap={setRoadmapFiltro}
            soloConStock={soloConStock} setSoloConStock={setSoloConStock}
            nActivos={nFiltrosActivos} onLimpiar={limpiarFiltros} />
        )}

        <TablaCompacta
          columnas={columnas}
          filas={filasTabla.slice(0, MAX_FILAS)}
          rowKey={(r) => r.sku}
          orden={orden} onSort={onSort}
          totales={totales}
          maxHeight="62vh"
          vacio={enriqueciendo && estadoFiltro !== 'todos' ? 'Calculando cobertura y tránsito…' : 'Sin SKUs con estos filtros.'}
          onRowClick={(r) => setSkuAbierto((s) => (s === r.sku ? null : r.sku))}
          expandidoKey={skuAbierto}
          renderExpandido={(r) => <SkuDrillDown row={r} almacenes={ALMACENES_GRID} />}
        />
        {filasTabla.length > MAX_FILAS && (
          <div style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
            Mostrando {MAX_FILAS} de {fmtInt(filasTabla.length)} SKUs · usa el buscador o los filtros · el Excel exporta todos
          </div>
        )}
      </Panel>

      {/* Secundario */}
      <ResumenSecundario porCedis={porCedis} porTipo={porTipo} kpis={kpis} insights={resumen} cedisFiltro={cedisFiltro} onCedis={setCedisFiltro} />
    </div>
  );
}
