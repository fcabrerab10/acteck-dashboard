import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import {
  Activity, Boxes, MapPin, AlertTriangle, ArrowRightLeft, FileText,
  Package, TrendingUp, Percent, ChevronRight, Search, Download,
} from 'lucide-react';
import SinAcceso from '../../components/SinAcceso';
import { FerrutekLoader } from '../../components';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaGlobal } from '../../lib/permisos';

const PALETTE = {
  blue:   { bg: '#E6F1FB', text: '#042C53', mid: '#185FA5', strong: '#3B82F6', soft: '#B5D4F4' },
  teal:   { bg: '#E1F5EE', text: '#04342C', mid: '#0F6E56', strong: '#1D9E75', soft: '#9FE1CB' },
  purple: { bg: '#EEEDFE', text: '#26215C', mid: '#534AB7', strong: '#7F77DD', soft: '#CECBF6' },
  coral:  { bg: '#FAECE7', text: '#4A1B0C', mid: '#993C1D', strong: '#D85A30', soft: '#F5C4B3' },
  amber:  { bg: '#FAEEDA', text: '#412402', mid: '#854F0B', strong: '#BA7517', soft: '#FAC775' },
  pink:   { bg: '#FBEAF0', text: '#4B1528', mid: '#993556', strong: '#D4537E', soft: '#F4C0D1' },
  green:  { bg: '#EAF3DE', text: '#173404', mid: '#3B6D11', strong: '#639922', soft: '#C0DD97' },
  red:    { bg: '#FCEBEB', text: '#501313', mid: '#A32D2D', strong: '#E24B4A', soft: '#F7C1C1' },
  gray:   { bg: '#F1EFE8', text: '#2C2C2A', mid: '#5F5E5A', strong: '#888780', soft: '#D3D1C7' },
};

const CEDIS_COLOR = {
  'ALMACENES GUADALAJARA': PALETTE.blue,
  'ALMACENES MEXICO':      PALETTE.teal,
  'ALMACENES COLOTLAN':    PALETTE.purple,
};
const CEDIS_CORTO = {
  'ALMACENES GUADALAJARA': 'Guadalajara',
  'ALMACENES MEXICO':      'México',
  'ALMACENES COLOTLAN':    'Colotlán',
};

// Mapping oficial (archivo "Almacenes 2026.xlsx")
const NOMBRES_ALMACEN = {
  1: 'VENTAS GENERAL GUADALAJARA',
  2: 'VENTAS GENERAL COLOTLAN',
  3: 'VENTAS GENERAL MEXICO',
  4: 'NO COMERCIAL',
  5: 'REFACTURACION',
  6: 'VENTAS DECME MEXICO',
  9: 'VENTAS CONSIGNACION MERCADO LIBRE',
  10: 'ACTIVO FIJO',
  11: 'NO COMERCIAL',
  12: 'VENTAS REFACCIONES',
  13: 'NO COMERCIAL',
  14: 'VENTAS PAGINA WEB DROSHIPPING',
  15: 'STOCK ROTATION TEMPORAL',
  16: 'VENTAS RETAIL GUADALAJARA',
  17: 'VENTAS RETAIL MEXICO',
  19: 'VENTAS DECME GUADALAJARA',
  20: 'NO COMERCIAL',
  25: 'VENTAS APARTADO ECOMMERCE',
  30: 'NO COMERCIAL',
  41: 'NO COMERCIAL',
  42: 'NO COMERCIAL',
  43: 'NO COMERCIAL',
  44: 'VENTAS EMPAQUE DANADO GUADALAJARA',
  50: 'ALMACEN MUESTRAS',
  62: 'NO COMERCIAL',
  63: 'NO COMERCIAL',
  64: 'VENTAS EMPAQUE DANADO MEXICO',
  70: 'NO COMERCIAL',
  71: 'VENTAS APARTADO ECOMMERCE TULTITLAN',
  90: 'NO COMERCIAL',
  97: 'ALMACEN DE REMISIONES',
  98: 'NO COMERCIAL',
  99: 'NO COMERCIAL',
  100: 'NO COMERCIAL',
};

// Clasificación funcional para agrupar
const TIPO_ALMACEN = {
  1: 'General', 2: 'General', 3: 'General',
  16: 'Retail', 17: 'Retail',
  6: 'DECME', 19: 'DECME',
  25: 'E-commerce', 71: 'E-commerce',
  9: 'Mercado Libre',
  14: 'Página web',
  12: 'Refacciones',
  44: 'Empaque dañado', 64: 'Empaque dañado',
  15: 'Stock rotation',
  50: 'Muestras',
  97: 'Remisiones',
  10: 'Activo fijo',
  5: 'Refacturación',
};
const tipoDe = (n) => TIPO_ALMACEN[n] || 'No comercial';
// Fuente única de comerciales = tabla almacenes_config (comercial=true).
// Lista actual: 1,2,3 (General), 6,19 (DECME), 9 (ML), 12 (Refacciones),
// 14,16,17 (Retail), 15 (Stock rotation), 25,71 (E-commerce),
// 44,64 (Empaque dañado).
// Editar la tabla en Supabase para agregar/quitar; luego actualizar este Set.
const ALM_COMERCIALES = new Set([1, 2, 3, 6, 9, 12, 14, 15, 16, 17, 19, 25, 44, 64, 71]);
const esComercial = (n) => ALM_COMERCIALES.has(Number(n));

const COLOR_TIPO = {
  'General':        PALETTE.blue,
  'Retail':         PALETTE.purple,
  'DECME':          PALETTE.teal,
  'E-commerce':     PALETTE.coral,
  'Mercado Libre':  PALETTE.amber,
  'Página web':     PALETTE.pink,
  'Refacciones':    PALETTE.green,
  'Empaque dañado': PALETTE.red,
  'Stock rotation': PALETTE.gray,
  'Muestras':       PALETTE.gray,
  'Remisiones':     PALETTE.gray,
  'Activo fijo':    PALETTE.gray,
  'Refacturación':  PALETTE.gray,
  'No comercial':   PALETTE.gray,
};

const fmtCompact = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(Number(n));
  const sign = Number(n) < 0 ? '-' : '';
  if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(0) + 'K';
  return sign + '$' + Math.round(a);
};
const fmtMoney = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(Number(n));
  return (Number(n) < 0 ? '-' : '') + '$' + a.toLocaleString('es-MX', { maximumFractionDigits: 0 });
};
const fmtInt = (n) => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('es-MX');
const fmtPct = (n) => n == null || isNaN(n) ? '—' : n.toFixed(1) + '%';

export default function InventarioGlobal() {
  const perfil = usePerfil();
  if (!puedeVerPestanaGlobal(perfil, 'inventario_global')) {
    return <SinAcceso motivo="No tienes acceso a Inventario." />;
  }
  const { theme } = useTheme();
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [soloComerciales, setSoloComerciales] = useState(true);
  const [cedisFiltro, setCedisFiltro] = useState('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [skuAbierto, setSkuAbierto] = useState(null);
  const [descripciones, setDescripciones] = useState(new Map());
  // Filtros nuevos
  const [marcaFiltro, setMarcaFiltro] = useState(() => new Set());       // Set de marcas seleccionadas · vacío = todas
  const [familiaFiltro, setFamiliaFiltro] = useState('');                // string · '' = todas
  const [roadmapFiltro, setRoadmapFiltro] = useState(() => new Set());   // Set de rdmp · vacío = todos
  const [soloConStock, setSoloConStock] = useState(false);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const PAGE = 5000;
      let acc = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('inventario_acteck')
          .select('articulo, no_almacen, cedis, disponible, inventario, costopromedio, costodisponible, costoinventario')
          .range(from, from + PAGE - 1);
        if (error || !data || data.length === 0) break;
        acc = acc.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setFilas(acc);
      setLoading(false);

      // Fetch descripciones SKUs (from roadmap_sku o compras_oc)
      try {
        const skus = Array.from(new Set(acc.map((r) => r.articulo).filter(Boolean)));
        if (skus.length === 0) return;
        const mapDesc = new Map();
        const chunkBy = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, (i + 1) * n));
        for (const chunk of chunkBy(skus, 200)) {
          const { data } = await supabase.from('roadmap_sku').select('sku, descripcion, marca, familia, rdmp, categoria').in('sku', chunk);
          (data || []).forEach((r) => {
            if (!mapDesc.has(r.sku)) mapDesc.set(r.sku, {
              descripcion: r.descripcion || '',
              marca: r.marca || '',
              familia: r.familia || '',
              rdmp: r.rdmp || '',
              categoria: r.categoria || '',
            });
          });
        }
        setDescripciones(mapDesc);
      } catch (e) { /* opcional */ }
    })();
  }, []);

  // Filas efectivas según toggle
  const filasEfectivas = useMemo(() => {
    return filas.filter((r) => {
      if (!r.cedis) return false; // ignoramos sin CEDIS asignado
      if (soloComerciales && !esComercial(Number(r.no_almacen))) return false;
      if (cedisFiltro !== 'TODOS' && r.cedis !== cedisFiltro) return false;
      return true;
    });
  }, [filas, soloComerciales, cedisFiltro]);

  const kpis = useMemo(() => {
    let valor = 0, piezas = 0;
    const skus = new Set();
    const almacenes = new Set();
    filasEfectivas.forEach((r) => {
      valor  += Number(r.costoinventario) || 0;
      piezas += Number(r.inventario) || 0;
      if (r.articulo) skus.add(r.articulo);
      almacenes.add(r.no_almacen);
    });
    const nCEDIS = new Set(filasEfectivas.map((r) => r.cedis)).size;
    return { valor, piezas, skus: skus.size, almacenes: almacenes.size, nCEDIS };
  }, [filasEfectivas]);

  const porCedis = useMemo(() => {
    const m = new Map();
    filasEfectivas.forEach((r) => {
      const c = r.cedis;
      if (!m.has(c)) m.set(c, { cedis: c, valor: 0, piezas: 0, skus: new Set(), almacenes: new Set() });
      const it = m.get(c);
      it.valor  += Number(r.costoinventario) || 0;
      it.piezas += Number(r.inventario) || 0;
      if (r.articulo) it.skus.add(r.articulo);
      it.almacenes.add(r.no_almacen);
    });
    const total = Array.from(m.values()).reduce((s, x) => s + x.valor, 0);
    return Array.from(m.values())
      .map((it) => ({ ...it, skus: it.skus.size, almacenes: it.almacenes.size, share: total > 0 ? (it.valor / total) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor);
  }, [filasEfectivas]);

  const porTipo = useMemo(() => {
    const m = new Map();
    filasEfectivas.forEach((r) => {
      const t = tipoDe(Number(r.no_almacen));
      if (!m.has(t)) m.set(t, { tipo: t, valor: 0, piezas: 0, skus: new Set() });
      const it = m.get(t);
      it.valor  += Number(r.costoinventario) || 0;
      it.piezas += Number(r.inventario) || 0;
      if (r.articulo) it.skus.add(r.articulo);
    });
    const total = Array.from(m.values()).reduce((s, x) => s + x.valor, 0);
    return Array.from(m.values())
      .map((it) => ({ ...it, skus: it.skus.size, share: total > 0 ? (it.valor / total) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor);
  }, [filasEfectivas]);

  // ── Almacenes comerciales fijos para la tabla ──
  // Coinciden con almacenes_config (comercial=true). El grid muestra los
  // 6 principales; el resto (12, 15, 25, 44, 64, 71) queda como "Otros"
  // agrupados en el drill del SKU si tiene stock.
  const almacenesActivos = [1, 3, 2, 6, 19, 9, 16, 17];
  const CEDIS_ALMACEN = { 1: 'ALMACENES GUADALAJARA', 3: 'ALMACENES MEXICO', 2: 'ALMACENES COLOTLAN', 6: 'ALMACENES MEXICO', 19: 'ALMACENES GUADALAJARA', 9: 'ALMACENES GUADALAJARA', 16: 'ALMACENES GUADALAJARA', 17: 'ALMACENES MEXICO' };
  const shortAlmacen = (n) => ({ 1: 'GEN GDL', 3: 'GEN MEX', 2: 'GEN COL', 6: 'DECME MEX', 19: 'DECME GDL', 9: 'ML', 16: 'RETAIL GDL', 17: 'RETAIL MEX', 14: 'RETAIL 14', 25: 'PROPIO', 44: 'EMP DAÑ GDL', 64: 'EMP DAÑ MEX', 71: 'ECOM TULT', 12: 'REFACC', 15: 'STOCK ROT' }[n] || `Alm ${n}`);

  // ── Tabla SKU × almacén ──
  const filasTabla = useMemo(() => {
    // Agrupar por SKU con desglose por almacén
    const m = new Map();
    filasEfectivas.forEach((r) => {
      const sku = r.articulo;
      if (!sku) return;
      if (!m.has(sku)) m.set(sku, { sku, byAlm: {}, totalPz: 0, totalDisp: 0, totalRes: 0, valor: 0 });
      const it = m.get(sku);
      const alm = Number(r.no_almacen);
      const pz = Number(r.inventario) || 0;
      const disp = Number(r.disponible) || 0;
      const res = Math.max(0, pz - disp);
      const val = Number(r.costoinventario) || 0;
      if (!it.byAlm[alm]) it.byAlm[alm] = { pz: 0, disp: 0, res: 0, valor: 0, cedis: r.cedis };
      it.byAlm[alm].pz += pz;
      it.byAlm[alm].disp += disp;
      it.byAlm[alm].res += res;
      it.byAlm[alm].valor += val;
      it.totalPz += pz;
      it.totalDisp += disp;
      it.totalRes += res;
      it.valor += val;
    });
    let arr = Array.from(m.values());
    // Enriquecer con desc/marca/familia/rdmp/categoria
    arr = arr.map((it) => {
      const d = descripciones.get(it.sku) || {};
      return {
        ...it,
        descripcion: d.descripcion || '',
        marca: d.marca || '',
        familia: d.familia || '',
        rdmp: d.rdmp || '',
        categoria: d.categoria || '',
      };
    });
    // Filtro por búsqueda
    const q = busqueda.trim().toUpperCase();
    if (q) {
      arr = arr.filter((r) => {
        const hay = `${r.sku} ${r.descripcion} ${r.marca} ${r.familia} ${r.categoria}`.toUpperCase();
        return hay.includes(q);
      });
    }
    // Filtro por marca
    if (marcaFiltro.size > 0) {
      arr = arr.filter((r) => marcaFiltro.has(String(r.marca || '').trim().toLowerCase()));
    }
    // Filtro por familia
    if (familiaFiltro) {
      arr = arr.filter((r) => String(r.familia || '').trim().toLowerCase() === familiaFiltro.toLowerCase());
    }
    // Filtro por roadmap
    if (roadmapFiltro.size > 0) {
      arr = arr.filter((r) => roadmapFiltro.has(String(r.rdmp || '').toUpperCase()));
    }
    // Filtro solo con stock
    if (soloConStock) {
      arr = arr.filter((r) => r.totalPz > 0);
    }
    // Ordenar por valor descendente
    return arr.sort((a, b) => b.valor - a.valor);
  }, [filasEfectivas, descripciones, busqueda, marcaFiltro, familiaFiltro, roadmapFiltro, soloConStock]);

  // Opciones de filtros (derivadas de la data)
  const opcionesFiltros = useMemo(() => {
    const marcas = new Set(), familias = new Set(), roadmaps = new Set();
    for (const [, d] of descripciones) {
      if (d.marca) marcas.add(String(d.marca).trim());
      if (d.familia) familias.add(String(d.familia).trim());
      if (d.rdmp) roadmaps.add(String(d.rdmp).trim().toUpperCase());
    }
    return {
      marcas: Array.from(marcas).sort(),
      familias: Array.from(familias).sort(),
      roadmaps: Array.from(roadmaps).sort(),
    };
  }, [descripciones]);

  const nFiltrosActivos = (marcaFiltro.size > 0 ? 1 : 0) + (familiaFiltro ? 1 : 0) + (roadmapFiltro.size > 0 ? 1 : 0) + (soloConStock ? 1 : 0);

  const limpiarFiltros = () => {
    setMarcaFiltro(new Set());
    setFamiliaFiltro('');
    setRoadmapFiltro(new Set());
    setSoloConStock(false);
  };

  // ── Export Excel (respeta filtros aplicados) ──
  const handleExport = async () => {
    setExportando(true);
    try {
      const XLSX = await import('xlsx-js-style');
      const shortAlmacenMap = { 1: 'GEN GDL', 3: 'GEN MEX', 2: 'GEN COL', 6: 'DECME MEX', 9: 'ML' };
      const rows = filasTabla.map((r) => {
        const base = {
          Marca: r.marca || '',
          SKU: r.sku,
          Descripción: r.descripcion || '',
          Familia: r.familia || '',
          Categoría: r.categoria || '',
          Roadmap: r.rdmp || '',
        };
        for (const a of almacenesActivos) {
          base[shortAlmacenMap[a] || `Alm ${a}`] = Number(r.byAlm[a]?.pz || 0);
        }
        base['Total pz'] = Number(r.totalPz || 0);
        base['Disponible'] = Number(r.totalDisp || 0);
        base['Reservado'] = Number(r.totalRes || 0);
        base['Valor'] = Number(r.valor || 0);
        return base;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      // Anchos aproximados
      ws['!cols'] = [
        { wch: 14 }, { wch: 14 }, { wch: 46 }, { wch: 18 }, { wch: 18 }, { wch: 10 },
        ...almacenesActivos.map(() => ({ wch: 12 })),
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
      ];
      // Estilo de header (bold + fondo claro)
      const header = Object.keys(rows[0] || { SKU: '' });
      header.forEach((h, i) => {
        const cell = ws[XLSX.utils.encode_cell({ r: 0, c: i })];
        if (cell) {
          cell.s = {
            font: { bold: true, sz: 11, color: { rgb: 'FFFFFFFF' } },
            fill: { fgColor: { rgb: 'FF007AFF' } },
            alignment: { vertical: 'center', horizontal: 'left' },
          };
        }
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
      // Filename: Inventario DD MM YYYY.xlsx
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const filename = `Inventario ${dd} ${mm} ${yyyy}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (e) {
      console.error('Export inventario error:', e);
      alert('Error al exportar el Excel: ' + (e.message || 'desconocido'));
    } finally {
      setExportando(false);
    }
  };

  const maxCelda = useMemo(() => {
    let m = 0;
    filasTabla.forEach((r) => {
      almacenesActivos.forEach((a) => {
        const v = r.byAlm[a]?.pz || 0;
        if (v > m) m = v;
      });
    });
    return m || 1;
  }, [filasTabla, almacenesActivos]);

  // Pill Apple para celda de valor — un solo azul, 4 niveles opacidad
  const isDark = theme.mode === 'dark';
  const cellPill = (v) => {
    if (v == null || v === 0) return null;
    const r = v / maxCelda;
    const b = theme.accent || (isDark ? '#0A84FF' : '#007AFF');
    if (r > 0.75) return { bg: b, color: '#FFFFFF', weight: 600 };
    if (r > 0.25) return { bg: isDark ? 'rgba(10,132,255,0.28)' : 'rgba(0,122,255,0.28)', color: isDark ? '#FFFFFF' : '#003D80', weight: 500 };
    if (r > 0.05) return { bg: isDark ? 'rgba(10,132,255,0.14)' : 'rgba(0,122,255,0.14)', color: theme.text, weight: 500 };
    return { bg: isDark ? 'rgba(10,132,255,0.06)' : 'rgba(0,122,255,0.06)', color: theme.textMuted };
  };

  // Insights auto ──
  const insights = useMemo(() => {
    const top = porCedis[0];
    const reservado = filasEfectivas.reduce((s, r) => s + Math.max(0, (Number(r.inventario) || 0) - (Number(r.disponible) || 0)), 0);
    const valorReservado = filasEfectivas.reduce((s, r) => {
      const pz = Number(r.inventario) || 0;
      const disp = Number(r.disponible) || 0;
      const res = Math.max(0, pz - disp);
      const cu = Number(r.costopromedio) || 0;
      return s + res * cu;
    }, 0);
    const disponible = kpis.piezas - reservado;
    const valorDisponible = Math.max(0, kpis.valor - valorReservado);
    return {
      valor: kpis.valor, piezas: kpis.piezas, skus: kpis.skus,
      topCedis: top,
      reservado, valorReservado, disponible, valorDisponible,
      pctReservado: kpis.piezas > 0 ? (reservado / kpis.piezas) * 100 : 0,
    };
  }, [kpis, porCedis, filasEfectivas]);

  if (loading) {
    return <FerrutekLoader label="Cargando inventario…" sub="Ferruteck está trayendo stock, roadmap y sucursales de los 3 clientes" minHeight={480} />;
  }
  if (filas.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500">
        <Boxes className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Inventario</h2>
        <p>No hay datos. Sube el archivo ERP en /uploads.html.</p>
      </div>
    );
  }

  // Colors iOS
  const blue = theme.accent || '#007AFF';
  const green = theme.green || '#34C759';
  const orange = theme.orange || '#FF9500';
  const purple = theme.purple || '#AF52DE';
  const red = theme.red || '#FF3B30';
  const teal = theme.teal || '#5AC8FA';
  const pink = theme.pink || '#FF2D55';

  const iosCanalCol = (cedis, i) => {
    const map = { 'ALMACENES GUADALAJARA': blue, 'ALMACENES MEXICO': purple, 'ALMACENES COLOTLAN': teal };
    return map[cedis] || [blue, purple, orange, teal, pink, green][i % 6];
  };

  const KpiApple = ({ Icon, iconColor, chip, kpi, kpiTone, headline }) => {
    const kpiCol = kpiTone === 'pos' ? green : kpiTone === 'neg' ? red : kpiTone === 'warn' ? orange : theme.text;
    return (
      <div style={{
        background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14,
        padding: 12, display: 'flex', flexDirection: 'column', gap: 4, minHeight: 108,
        fontFamily: TYPO.fontText,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, background: `${iconColor}22`, color: iconColor,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon style={{ width: 15, height: 15 }} strokeWidth={1.8} />
          </div>
          {chip && (
            <span style={{
              fontSize: 9, padding: '2px 7px', borderRadius: 999,
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              color: theme.textMuted, fontWeight: 500,
            }}>{chip}</span>
          )}
        </div>
        <div style={{
          fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em',
          color: kpiCol, fontVariantNumeric: 'tabular-nums', marginTop: 4, lineHeight: 1,
        }}>{kpi}</div>
        <div style={{ fontSize: 11, color: theme.textMuted, lineHeight: 1.3, marginTop: 'auto' }}>{headline}</div>
      </div>
    );
  };

  return (
    <div style={{ padding: '10px 6px', background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%' }} className="space-y-3">
      {/* Header apple */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, padding: '0 4px', marginBottom: 4, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: theme.textMuted, marginBottom: 4, fontFamily: TYPO.fontText, fontWeight: 500 }}>
            Dirección Comercial · Snapshot actual
          </p>
          <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em', fontFamily: TYPO.fontDisplay, color: theme.text, margin: 0, lineHeight: 1.1 }}>
            Inventario Acteck.
          </h2>
          <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 4, fontFamily: TYPO.fontText, fontVariantNumeric: 'tabular-nums' }}>
            <strong style={{ color: theme.text, fontWeight: 500 }}>{fmtCompact(kpis.valor)}</strong> · {fmtInt(kpis.skus)} SKUs · {kpis.almacenes} almacenes en {kpis.nCEDIS} CEDIS
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'inline-flex', gap: 1, padding: 3, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderRadius: 999 }}>
            <button onClick={() => setSoloComerciales(true)}
              style={{ padding: '6px 12px', borderRadius: 999, background: soloComerciales ? theme.surface : 'transparent', color: soloComerciales ? theme.text : theme.textMuted, fontWeight: soloComerciales ? 600 : 500, border: 0, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', boxShadow: soloComerciales ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}>
              Solo comerciales
            </button>
            <button onClick={() => setSoloComerciales(false)}
              style={{ padding: '6px 12px', borderRadius: 999, background: !soloComerciales ? theme.surface : 'transparent', color: !soloComerciales ? theme.text : theme.textMuted, fontWeight: !soloComerciales ? 600 : 500, border: 0, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', boxShadow: !soloComerciales ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}>
              Todos
            </button>
          </div>
          <select value={cedisFiltro} onChange={(e) => setCedisFiltro(e.target.value)}
            style={{ height: 32, padding: '0 14px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 999, fontSize: 12, color: theme.text, fontFamily: 'inherit', cursor: 'pointer' }}>
            <option value="TODOS">Todos los CEDIS</option>
            {Object.keys(CEDIS_CORTO).map((c) => (
              <option key={c} value={c}>{CEDIS_CORTO[c]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 4 Insight cards Apple Fitness */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <KpiApple Icon={Package} iconColor={blue} chip="Valor"
          kpi={fmtCompact(insights.valor)}
          headline={<>Total en stock · <strong style={{ color: theme.text }}>{fmtInt(insights.piezas)} piezas</strong> en {fmtInt(insights.skus)} SKUs.</>}
        />
        <KpiApple Icon={MapPin} iconColor={green} chip="Concentración"
          kpi={insights.topCedis ? `${insights.topCedis.share.toFixed(0)}%` : '—'}
          headline={insights.topCedis
            ? <><strong style={{ color: theme.text }}>{CEDIS_CORTO[insights.topCedis.cedis] || insights.topCedis.cedis}</strong> concentra {insights.topCedis.share.toFixed(1)}% · {fmtCompact(insights.topCedis.valor)}.</>
            : <>Sin CEDIS con datos.</>}
        />
        <KpiApple Icon={AlertTriangle} iconColor={orange} chip="Reservado"
          kpi={`${insights.pctReservado.toFixed(1)}%`}
          kpiTone="warn"
          headline={<><strong style={{ color: theme.text }}>{fmtInt(insights.reservado)} piezas</strong> reservadas · {fmtCompact(insights.valorReservado)} en órdenes abiertas.</>}
        />
        <KpiApple Icon={Boxes} iconColor={purple} chip="Cobertura"
          kpi={`${kpis.almacenes} alm`}
          headline={<>Distribuidos en <strong style={{ color: theme.text }}>{kpis.nCEDIS} CEDIS</strong>. {porTipo[0]?.tipo || '—'} es el tipo dominante ({porTipo[0] ? porTipo[0].share.toFixed(0) : 0}%).</>}
        />
      </div>

      {/* Row 2-col: CEDIS donut + ranking · Estatus del stock */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 8 }}>
        {/* Donut CEDIS + ranking */}
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '12px 14px', fontFamily: TYPO.fontText }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <h4 style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>Distribución por CEDIS</h4>
            <span style={{ fontSize: 10, color: theme.textMuted }}>{porCedis.length} activos · click filtra</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 16, alignItems: 'center' }}>
            {/* Donut SVG */}
            <div style={{ position: 'relative', width: 130, height: 130 }}>
              <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r="42" fill="none" stroke={theme.border} strokeWidth="14" />
                {(() => {
                  const total = porCedis.reduce((s, c) => s + c.valor, 0) || 1;
                  const C = 2 * Math.PI * 42;
                  let acc = 0;
                  return porCedis.map((c, i) => {
                    const len = (c.valor / total) * C;
                    const dashOff = -acc;
                    acc += len;
                    const col = iosCanalCol(c.cedis, i);
                    const dim = cedisFiltro !== 'TODOS' && cedisFiltro !== c.cedis ? 0.25 : 1;
                    return (
                      <circle key={c.cedis} cx="50" cy="50" r="42" fill="none"
                        stroke={col} strokeWidth="14"
                        strokeDasharray={`${len} ${C - len}`} strokeDashoffset={dashOff}
                        style={{ opacity: dim, cursor: 'pointer', transition: 'opacity 150ms' }}
                        onClick={() => setCedisFiltro(cedisFiltro === c.cedis ? 'TODOS' : c.cedis)}
                      />
                    );
                  });
                })()}
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 500 }}>Total</span>
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, marginTop: 1 }}>{fmtCompact(kpis.valor)}</span>
                <span style={{ fontSize: 9, color: theme.textMuted, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{kpis.nCEDIS} CEDIS · {kpis.almacenes} alm</span>
              </div>
            </div>
            {/* Ranking */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {porCedis.map((c, i) => {
                const col = iosCanalCol(c.cedis, i);
                const active = cedisFiltro === c.cedis;
                return (
                  <div key={c.cedis}
                    onClick={() => setCedisFiltro(active ? 'TODOS' : c.cedis)}
                    style={{
                      display: 'grid', gridTemplateColumns: '10px 1fr auto 36px', gap: 8, alignItems: 'center',
                      padding: '4px 6px', borderRadius: 6, cursor: 'pointer',
                      background: active ? (isDark ? 'rgba(10,132,255,0.10)' : 'rgba(0,122,255,0.06)') : 'transparent',
                    }}>
                    <span style={{ width: 6, height: 6, borderRadius: 2, background: col }} />
                    <div>
                      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 500, color: theme.text, letterSpacing: '-0.005em' }}>{CEDIS_CORTO[c.cedis] || c.cedis}</div>
                      <div style={{ fontSize: 9, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{fmtInt(c.skus)} SKUs · {c.almacenes} alm.</div>
                    </div>
                    <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', textAlign: 'right' }}>{fmtCompact(c.valor)}</div>
                    <div style={{ fontSize: 9, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{c.share.toFixed(1)}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Estatus del stock: 3 KPIs (Comercial / Reservado / Tránsito) */}
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '12px 14px', fontFamily: TYPO.fontText }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <h4 style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>Estatus del stock</h4>
            <span style={{ fontSize: 10, color: theme.textMuted }}>valor comercial neto</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[
              { ico: '✓', bg: `${green}22`, col: green, label: 'Comercial disponible', sub: `${fmtInt(kpis.skus)} SKUs · ${kpis.almacenes} alm.`, val: fmtCompact(insights.valorDisponible), vsub: `${fmtInt(insights.disponible)} pz` },
              { ico: '⏸', bg: `${orange}22`, col: orange, label: 'Reservado', sub: 'órdenes en curso', val: fmtCompact(insights.valorReservado), vsub: `${fmtInt(insights.reservado)} pz` },
              { ico: '🚢', bg: `${blue}22`, col: blue, label: 'En tránsito', sub: 'próximo arribo · OCs', val: '—', vsub: 'sin datos' },
            ].map((it, idx, arr) => (
              <div key={it.label} style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 10, alignItems: 'center', padding: '8px 4px', borderBottom: idx < arr.length - 1 ? `1px dashed ${theme.border}` : 'none' }}>
                <span style={{ width: 24, height: 24, borderRadius: 7, background: it.bg, color: it.col, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{it.ico}</span>
                <div>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 500, color: theme.text }}>{it.label}</div>
                  <div style={{ fontSize: 9, color: theme.textMuted, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{it.sub}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, color: it.col, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{it.val}</div>
                  <div style={{ fontSize: 9, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{it.vsub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla SKU × almacén */}
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: `1px solid ${theme.border}`, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 999, height: 30, flex: 1, maxWidth: 280 }}>
            <Search style={{ width: 12, height: 12, color: theme.textMuted }} />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar SKU, marca, familia…"
              style={{ border: 0, outline: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 12, color: theme.text, flex: 1 }} />
          </div>

          {/* Botón Filtros */}
          <button onClick={() => setFiltrosAbiertos((v) => !v)}
            onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = filtrosAbiertos || nFiltrosActivos > 0 ? (isDark ? 'rgba(10,132,255,0.14)' : 'rgba(0,122,255,0.10)') : 'transparent'; }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, height: 30,
              padding: '0 12px', borderRadius: 999,
              border: `1px solid ${filtrosAbiertos || nFiltrosActivos > 0 ? (theme.accent || '#007AFF') : theme.border}`,
              background: filtrosAbiertos || nFiltrosActivos > 0 ? (isDark ? 'rgba(10,132,255,0.14)' : 'rgba(0,122,255,0.10)') : 'transparent',
              color: filtrosAbiertos || nFiltrosActivos > 0 ? (theme.accent || '#007AFF') : theme.textMuted,
              fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 200ms cubic-bezier(.4,0,.2,1), border-color 200ms cubic-bezier(.4,0,.2,1), color 200ms cubic-bezier(.4,0,.2,1)',
            }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filtros
            {nFiltrosActivos > 0 && (
              <span style={{
                background: theme.accent || '#007AFF', color: '#FFF',
                fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10, fontWeight: 700,
                padding: '1px 6px', borderRadius: 999, minWidth: 16, textAlign: 'center',
              }}>{nFiltrosActivos}</span>
            )}
          </button>

          {/* Botón Export */}
          <button onClick={handleExport} disabled={exportando || filasTabla.length === 0}
            onMouseEnter={(e) => { if (!exportando && filasTabla.length > 0) { e.currentTarget.style.background = isDark ? '#0071E3' : '#0062CC'; } }}
            onMouseLeave={(e) => { if (!exportando) { e.currentTarget.style.background = theme.accent || '#007AFF'; } }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, height: 30,
              padding: '0 14px', borderRadius: 999, border: 0,
              background: exportando || filasTabla.length === 0 ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)') : (theme.accent || '#007AFF'),
              color: '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600,
              cursor: exportando || filasTabla.length === 0 ? 'not-allowed' : 'pointer',
              opacity: exportando || filasTabla.length === 0 ? 0.5 : 1,
              boxShadow: '0 2px 6px rgba(0,113,227,0.18)',
              transition: 'background 200ms cubic-bezier(.4,0,.2,1), transform 160ms cubic-bezier(.4,0,.2,1)',
            }}>
            <Download style={{ width: 12, height: 12 }} strokeWidth={2.4} />
            {exportando ? 'Exportando…' : 'Exportar Excel'}
          </button>

          <span style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginLeft: 'auto' }}>
            {fmtInt(filasTabla.length)} SKUs · {almacenesActivos.length} almacenes
          </span>
        </div>

        {/* Panel de filtros expandible */}
        {filtrosAbiertos && (
          <div style={{
            padding: '12px 14px', borderBottom: `1px solid ${theme.border}`,
            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
            display: 'flex', flexDirection: 'column', gap: 12,
            animation: 'invFilterOpen 260ms cubic-bezier(.4,0,.2,1)',
          }}>
            <style>{`@keyframes invFilterOpen{from{opacity:0; transform:translateY(-4px);} to{opacity:1; transform:translateY(0);}}`}</style>

            {/* Marca (pills multi-select) */}
            <FiltroBlock theme={theme} title="Marca" count={marcaFiltro.size}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {opcionesFiltros.marcas.map((m) => {
                  const key = m.toLowerCase();
                  const active = marcaFiltro.has(key);
                  return (
                    <FiltroPill key={m} theme={theme} isDark={isDark}
                      active={active}
                      onClick={() => {
                        const next = new Set(marcaFiltro);
                        if (active) next.delete(key); else next.add(key);
                        setMarcaFiltro(next);
                      }}>{m}</FiltroPill>
                  );
                })}
              </div>
            </FiltroBlock>

            {/* Familia (dropdown) */}
            <FiltroBlock theme={theme} title="Familia" count={familiaFiltro ? 1 : 0}>
              <select value={familiaFiltro} onChange={(e) => setFamiliaFiltro(e.target.value)}
                style={{
                  padding: '5px 10px', height: 28, borderRadius: 8,
                  border: `1px solid ${theme.border}`, background: theme.surface,
                  color: theme.text, fontFamily: TYPO.fontText, fontSize: 11.5, cursor: 'pointer',
                  minWidth: 200,
                }}>
                <option value="">Todas las familias</option>
                {opcionesFiltros.familias.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </FiltroBlock>

            {/* Roadmap (pills multi-select) */}
            <FiltroBlock theme={theme} title="Roadmap" count={roadmapFiltro.size}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {opcionesFiltros.roadmaps.map((rd) => {
                  const active = roadmapFiltro.has(rd);
                  return (
                    <FiltroPill key={rd} theme={theme} isDark={isDark}
                      active={active}
                      onClick={() => {
                        const next = new Set(roadmapFiltro);
                        if (active) next.delete(rd); else next.add(rd);
                        setRoadmapFiltro(next);
                      }}>{rd}</FiltroPill>
                  );
                })}
              </div>
            </FiltroBlock>

            {/* Solo con stock (toggle) + Limpiar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderTop: `1px dashed ${theme.border}`, paddingTop: 10 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: theme.text, fontSize: 11.5, fontFamily: TYPO.fontText }}>
                <input type="checkbox" checked={soloConStock} onChange={(e) => setSoloConStock(e.target.checked)}
                  style={{ accentColor: theme.accent || '#007AFF', width: 15, height: 15, cursor: 'pointer' }} />
                Solo SKUs con stock disponible
              </label>
              {nFiltrosActivos > 0 && (
                <button onClick={limpiarFiltros}
                  onMouseEnter={(e) => { e.currentTarget.style.color = theme.accent || '#007AFF'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = theme.textMuted; }}
                  style={{
                    background: 'transparent', border: 0, cursor: 'pointer',
                    color: theme.textMuted, fontFamily: TYPO.fontText, fontSize: 11, fontWeight: 500,
                    padding: '4px 8px', borderRadius: 6,
                    transition: 'color 200ms cubic-bezier(.4,0,.2,1)',
                  }}>Limpiar filtros ×</button>
              )}
            </div>
          </div>
        )}

        <div style={{ overflow: 'auto', maxHeight: '65vh' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontFamily: TYPO.fontText, fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', top: 0, background: theme.surface, zIndex: 1, textAlign: 'left', padding: '8px 10px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap', width: 60 }}>Marca</th>
                <th style={{ position: 'sticky', top: 0, background: theme.surface, zIndex: 1, textAlign: 'left', padding: '8px 6px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap', width: 100 }}>SKU</th>
                <th style={{ position: 'sticky', top: 0, background: theme.surface, zIndex: 1, textAlign: 'left', padding: '8px 6px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap', minWidth: 200 }}>Descripción</th>
                {almacenesActivos.map((a) => (
                  <th key={a} style={{ position: 'sticky', top: 0, background: theme.surface, zIndex: 1, textAlign: 'right', padding: '8px 4px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap', width: 56 }} title={NOMBRES_ALMACEN[a]}>{shortAlmacen(a)}</th>
                ))}
                <th style={{ position: 'sticky', top: 0, background: theme.surface, zIndex: 1, textAlign: 'right', padding: '8px 6px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap', width: 70 }}>Total pz</th>
                <th style={{ position: 'sticky', top: 0, background: theme.surface, zIndex: 1, textAlign: 'right', padding: '8px 6px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap', width: 80 }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {filasTabla.slice(0, 200).map((r) => {
                const abierto = skuAbierto === r.sku;
                return (
                  <React.Fragment key={r.sku}>
                    <tr onClick={() => setSkuAbierto(abierto ? null : r.sku)}
                      style={{
                        borderTop: `1px solid ${theme.border}`,
                        background: abierto ? (isDark ? 'rgba(10,132,255,0.10)' : 'rgba(0,122,255,0.06)') : 'transparent',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { if (!abierto) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'; }}
                      onMouseLeave={(e) => { if (!abierto) e.currentTarget.style.background = 'transparent'; }}>
                      <td style={{ padding: '4px 6px', color: theme.textMuted, fontSize: 10, whiteSpace: 'nowrap', width: 60 }}>{r.marca || '—'}</td>
                      <td style={{ padding: '4px 6px', color: theme.text, fontSize: 10, fontWeight: 600, fontFamily: '-apple-system, "SF Mono", ui-monospace, monospace', whiteSpace: 'nowrap', width: 100 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <ChevronRight style={{ width: 12, height: 12, color: blue, flexShrink: 0, transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }} />
                          {r.sku}
                        </span>
                      </td>
                      <td style={{ padding: '4px 6px', color: theme.text, fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 500, letterSpacing: '-0.005em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }} title={r.descripcion}>{r.descripcion || '—'}</td>
                      {almacenesActivos.map((a) => {
                        const v = r.byAlm[a]?.pz || 0;
                        const h = cellPill(v);
                        return (
                          <td key={a} style={{ padding: '3px 3px', textAlign: 'right', whiteSpace: 'nowrap', width: 56 }}>
                            {v > 0 ? (
                              <span style={{
                                display: 'inline-block', padding: '3px 8px', borderRadius: 999,
                                fontFamily: TYPO.fontText, fontSize: 11,
                                background: h?.bg || 'transparent',
                                color: h?.color || theme.textMuted,
                                fontWeight: h?.weight || 500,
                                minWidth: 32, textAlign: 'center',
                              }}>{fmtInt(v)}</span>
                            ) : (
                              <span style={{ color: theme.textSubtle, fontSize: 11 }}>—</span>
                            )}
                          </td>
                        );
                      })}
                      <td style={{ padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', background: theme.bg, fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, letterSpacing: '-0.01em', width: 70 }}>{fmtInt(r.totalPz)}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', background: theme.bg, fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, letterSpacing: '-0.01em', width: 80 }}>{fmtCompact(r.valor)}</td>
                    </tr>
                    {abierto && (
                      <tr>
                        <td colSpan={3 + almacenesActivos.length + 2} style={{ padding: 0, background: theme.bg, borderTop: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}` }}>
                          <SkuDrillDown row={r} almacenes={almacenesActivos} theme={theme} colors={{ blue, green, orange, red, purple }} isDark={isDark} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filasTabla.length > 200 && (
                <tr>
                  <td colSpan={3 + almacenesActivos.length + 2} style={{ padding: '8px', textAlign: 'center', color: theme.textMuted, fontSize: 11, borderTop: `1px solid ${theme.border}` }}>
                    Mostrando 200 de {fmtInt(filasTabla.length)} SKUs · usa el buscador para filtrar
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ────────── SKU drill-down · desglose transpuesto (almacenes horizontal · métricas vertical) ──────────
function SkuDrillDown({ row, almacenes, theme, colors, isDark }) {
  const { blue, green, orange } = colors;
  const totalRes = row.totalRes;
  const totalDisp = row.totalDisp;
  const pctRes = row.totalPz > 0 ? (totalRes / row.totalPz) * 100 : 0;
  const nAlm = almacenes.filter((a) => (row.byAlm[a]?.pz || 0) > 0).length;

  const CEDIS_ALM = { 1: 'Guadalajara', 3: 'México', 2: 'Colotlán', 6: 'México', 9: 'Guadalajara' };
  const shortAlm = (n) => ({ 1: 'GEN GDL', 3: 'GEN MEX', 2: 'GEN COL', 6: 'DECME MEX', 9: 'ML' }[n] || `Alm ${n}`);

  const KBoxSku = ({ lbl, val, sub, color }) => (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2, fontFamily: 'inherit' }}>
      <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, margin: 0 }}>{lbl}</p>
      <p style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: color || theme.text, fontVariantNumeric: 'tabular-nums', margin: 0, lineHeight: 1.1 }}>{val}</p>
      <p style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', margin: 0 }}>{sub}</p>
    </div>
  );

  const thBase = { padding: '8px 10px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, textAlign: 'right', whiteSpace: 'nowrap' };
  const tdBase = { padding: '6px 10px', textAlign: 'right', fontSize: 11, fontVariantNumeric: 'tabular-nums', borderTop: `1px solid ${theme.border}`, whiteSpace: 'nowrap' };
  const metricLblTd = { textAlign: 'left', fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 500, color: theme.text, paddingLeft: 14, background: theme.bg, borderRight: `1px solid ${theme.border}` };
  const metricValStyle = { fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12, color: theme.text, letterSpacing: '-0.01em' };
  const dashStyle = { color: theme.textSubtle || '#C7C7CC' };

  return (
    <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10, fontFamily: TYPO.fontText }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <KBoxSku lbl="Total inventario" val={`${fmtInt(row.totalPz)} pz`} sub={`${fmtCompact(row.valor)} · ${nAlm} almacenes`} />
        <KBoxSku lbl="Reservado" val={`${fmtInt(totalRes)} pz`} sub={`${pctRes.toFixed(1)}% del total`} color={orange} />
        <KBoxSku lbl="Disponible" val={`${fmtInt(totalDisp)} pz`} sub={`${(100 - pctRes).toFixed(1)}% · listo para venta`} color={green} />
        <KBoxSku lbl="Estatus" val={pctRes > 40 ? 'Alta reserva' : pctRes > 20 ? 'Normal' : 'Baja reserva'} sub={pctRes > 40 ? 'Alto compromiso' : 'Rotación saludable'} color={pctRes > 40 ? orange : pctRes > 20 ? blue : green} />
      </div>

      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h4 style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>Desglose por almacén</h4>
          <span style={{ fontSize: 9, color: theme.textMuted }}>métricas × {almacenes.length} almacenes comerciales</span>
        </div>
        <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr>
              <th style={{ ...thBase, textAlign: 'left', width: 150, paddingLeft: 14, background: theme.bg }}>Métrica</th>
              {almacenes.map((a) => (
                <th key={a} style={thBase}>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, color: theme.text, letterSpacing: '-0.005em' }}>{shortAlm(a)}</div>
                  <div style={{ fontFamily: TYPO.fontText, fontSize: 8.5, fontWeight: 500, color: theme.textMuted, marginTop: 1, letterSpacing: 0, textTransform: 'none' }}>{CEDIS_ALM[a] || '—'}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Total piezas */}
            <tr>
              <td style={{ ...tdBase, ...metricLblTd }}>Total <span style={{ display: 'block', fontSize: 9, color: theme.textMuted, fontWeight: 400, marginTop: 1 }}>piezas</span></td>
              {almacenes.map((a) => {
                const d = row.byAlm[a];
                return <td key={a} style={tdBase}>{d?.pz > 0 ? <span style={metricValStyle}>{fmtInt(d.pz)}</span> : <span style={dashStyle}>—</span>}</td>;
              })}
            </tr>
            {/* Reservado */}
            <tr>
              <td style={{ ...tdBase, ...metricLblTd }}>Reservado <span style={{ display: 'block', fontSize: 9, color: theme.textMuted, fontWeight: 400, marginTop: 1 }}>órdenes en curso</span></td>
              {almacenes.map((a) => {
                const d = row.byAlm[a];
                if (!d || d.pz === 0) return <td key={a} style={tdBase}><span style={dashStyle}>—</span></td>;
                return <td key={a} style={tdBase}>{d.res > 0 ? <span style={{ color: orange, fontWeight: 500 }}>{fmtInt(d.res)}</span> : <span style={{ color: theme.textMuted }}>—</span>}</td>;
              })}
            </tr>
            {/* Disponible */}
            <tr>
              <td style={{ ...tdBase, ...metricLblTd }}>Disponible <span style={{ display: 'block', fontSize: 9, color: theme.textMuted, fontWeight: 400, marginTop: 1 }}>listo para venta</span></td>
              {almacenes.map((a) => {
                const d = row.byAlm[a];
                return <td key={a} style={tdBase}>{d?.pz > 0 ? <span style={{ color: green, fontWeight: 500 }}>{fmtInt(d.disp)}</span> : <span style={dashStyle}>—</span>}</td>;
              })}
            </tr>
            {/* Valor */}
            <tr>
              <td style={{ ...tdBase, ...metricLblTd }}>Valor <span style={{ display: 'block', fontSize: 9, color: theme.textMuted, fontWeight: 400, marginTop: 1 }}>a costo</span></td>
              {almacenes.map((a) => {
                const d = row.byAlm[a];
                return <td key={a} style={tdBase}>{d?.pz > 0 ? <span style={metricValStyle}>{fmtCompact(d.valor)}</span> : <span style={dashStyle}>—</span>}</td>;
              })}
            </tr>
            {/* Composición */}
            <tr>
              <td style={{ ...tdBase, ...metricLblTd }}>Composición <span style={{ display: 'block', fontSize: 9, color: theme.textMuted, fontWeight: 400, marginTop: 1 }}>reservado / disp</span></td>
              {almacenes.map((a) => {
                const d = row.byAlm[a];
                if (!d || d.pz === 0) return <td key={a} style={tdBase}><span style={dashStyle}>—</span></td>;
                const pctR = (d.res / d.pz) * 100;
                const pctD = (d.disp / d.pz) * 100;
                return (
                  <td key={a} style={{ ...tdBase, padding: '10px 10px' }}>
                    <div style={{ display: 'flex', height: 5, borderRadius: 999, overflow: 'hidden', background: theme.border, marginLeft: 'auto', minWidth: 50 }}>
                      <span style={{ width: `${pctR}%`, background: orange }} />
                      <span style={{ width: `${pctD}%`, background: green }} />
                    </div>
                  </td>
                );
              })}
            </tr>
            {/* % del SKU */}
            <tr>
              <td style={{ ...tdBase, ...metricLblTd }}>% del SKU <span style={{ display: 'block', fontSize: 9, color: theme.textMuted, fontWeight: 400, marginTop: 1 }}>participación</span></td>
              {almacenes.map((a) => {
                const d = row.byAlm[a];
                if (!d || d.pz === 0) return <td key={a} style={tdBase}><span style={dashStyle}>—</span></td>;
                const pct = (d.pz / row.totalPz) * 100;
                return <td key={a} style={tdBase}><span style={{ color: theme.textMuted, fontWeight: 400 }}>{pct.toFixed(1)}%</span></td>;
              })}
            </tr>
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function KpiTile({ label, valor, subtitulo, esWarning }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-xl font-medium mt-0.5 text-gray-800">{valor}</div>
      <div className={`text-[11px] mt-1 ${esWarning ? 'text-amber-600' : 'text-gray-500'}`}>{subtitulo}</div>
    </div>
  );
}

function ProximoBloque({ icon: Icon, titulo, nota }) {
  return (
    <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4">
      <div className="flex items-center gap-2 text-gray-500">
        {Icon && <Icon className="w-4 h-4" />}
        <div className="text-sm font-medium">{titulo}</div>
      </div>
      <div className="text-xs text-gray-400 mt-1.5">Próximamente</div>
      <div className="text-[11px] text-gray-400 mt-2 leading-relaxed">{nota}</div>
    </div>
  );
}

// ═══════════════ Panel de filtros · helpers ═══════════════
function FiltroBlock({ theme, title, count, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{
        fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em',
        color: theme.textMuted, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        {title}
        {count > 0 && (
          <span style={{
            background: theme.accent || '#007AFF', color: '#FFF',
            fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9, fontWeight: 700,
            padding: '0 5px', borderRadius: 999, minWidth: 14, textAlign: 'center', lineHeight: '14px',
          }}>{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function FiltroPill({ theme, isDark, active, onClick, children }) {
  const [hover, setHover] = React.useState(false);
  const activeBg = isDark ? 'rgba(10,132,255,0.20)' : 'rgba(0,122,255,0.14)';
  const idleBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
  const hoverBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '4px 12px', height: 26, borderRadius: 999,
        border: `1px solid ${active ? (theme.accent || '#007AFF') : theme.border}`,
        background: active ? activeBg : hover ? hoverBg : idleBg,
        color: active ? (theme.accent || '#007AFF') : theme.text,
        fontFamily: TYPO.fontText, fontSize: 11, fontWeight: active ? 600 : 500,
        cursor: 'pointer', whiteSpace: 'nowrap',
        transition: 'background 200ms cubic-bezier(.4,0,.2,1), border-color 200ms cubic-bezier(.4,0,.2,1), color 200ms cubic-bezier(.4,0,.2,1)',
      }}>{children}</button>
  );
}
