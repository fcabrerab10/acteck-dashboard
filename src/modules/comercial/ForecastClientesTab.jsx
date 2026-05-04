import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { usePerfil } from '../../lib/perfilContext';
import { toast } from '../../lib/toast';
import { formatMXN } from '../../lib/utils';
import {
  Activity, AlertTriangle, Search, Download, Package, Ship, Target,
  ChevronDown, ChevronUp, Flame, X, Users,
  CheckCircle2, Clock, DollarSign,
} from 'lucide-react';
import TransitoTimeline from './forecast/TransitoTimeline';
import NovedadesCard from './forecast/NovedadesCard';

/**
 * Forecast Clientes v3 — Planeación de compras (Acteck)
 * ─────────────────────────────────────────────────────────────
 * Solo Digitalife + PCEL. Mercado Libre se gestiona desde Axon de México.
 *
 * - Demanda agregada por SKU (Digi + PCEL)
 * - Cruce con inventario comercial y tránsito (master embarques)
 * - Brecha vs horizonte configurable
 * - Sugeridos redondeados al múltiplo de contenedor del SKU
 * - Tarjeta de tránsito timeline (qué llega cada mes)
 * - Tarjeta de novedades (roadmap próximamente + tránsito 30d)
 * - Sistema de solicitudes de compra (S&OP Ferru) con borradores múltiples
 *   exportables a Excel
 */

const CLIENTES = [
  { key: 'digitalife', label: 'DGL',  full: 'Digitalife', color: '#3B82F6' },
  { key: 'pcel',       label: 'PCEL', full: 'PCEL',       color: '#EF4444' },
];

const HORIZONTES = [
  { meses: 2, label: '2 meses' },
  { meses: 3, label: '3 meses' },
  { meses: 6, label: '6 meses' },
];

// Buffer de inventario de seguridad (meses de demanda)
const BUFFER_MESES = 1;

// ────────── Hook: data loader ──────────
function useForecastData() {
  const [state, setState] = useState({
    loading: true,
    inventario: [],
    transito: [],
    leadTimes: [],
    metadata: [],
    demanda: [],
    sugeridosPendientes: [],
    roadmap: [],
    embarques: [],
    solicitudes: [],
    solicitudLineas: [],
  });

  // Helper paginador (PostgREST corta a 1000)
  async function fetchAll(qFactory, pageSize = 1000) {
    const all = [];
    let from = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await qFactory().range(from, from + pageSize - 1);
      if (error || !data || data.length === 0) break;
      all.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return all;
  }

  const reload = async () => {
    setState(s => ({ ...s, loading: true }));
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const anioCorte = new Date(hoy.getFullYear(), hoy.getMonth() - 6, 1).getFullYear();

    const queries = await Promise.all([
      supabase.from('v_inventario_comercial').select('*'),
      supabase.from('v_transito_sku').select('*'),
      supabase.from('v_lead_time_sku').select('*'),
      supabase.from('v_sku_metadata').select('*'),
      fetchAll(() => supabase.from('v_demanda_sku').select('*').gte('anio', anioCorte)),
      supabase.from('sugeridos_compra').select('*').in('estado', ['pendiente', 'exportado']).order('created_at', { ascending: false }),
      // Roadmap por SKU (estado, fechas)
      supabase.from('roadmap_sku').select('*'),
      // Master de embarques completo (para timeline tránsito + histórico compras)
      fetchAll(() => supabase.from('embarques_compras')
        .select('po, codigo, fecha_emision, arribo_cedis, eta, po_qty, cbm, contenedor, estatus, supplier, marca, familia')),
      // Solicitudes de compra del año actual (las tablas pueden no existir aún
      // — capturamos error silenciosamente en ese caso)
      supabase.from('solicitudes_compra').select('*').eq('anio', anioActual)
        .order('fecha_creacion', { ascending: false })
        .then(r => r, () => ({ data: [] })),
      supabase.from('solicitudes_compra_lineas').select('*')
        .order('orden', { ascending: true })
        .then(r => r, () => ({ data: [] })),
    ]);

    const [invRes, traRes, ltRes, metaRes, demData, sugRes, rmRes, embData, solRes, solLinRes] = queries;

    setState({
      loading: false,
      inventario:    invRes.data  || [],
      transito:      traRes.data  || [],
      leadTimes:     ltRes.data   || [],
      metadata:      metaRes.data || [],
      demanda:       demData      || [],
      sugeridosPendientes: sugRes.data || [],
      roadmap:       rmRes.data   || [],
      embarques:     embData      || [],
      solicitudes:   (solRes && solRes.data) || [],
      solicitudLineas: (solLinRes && solLinRes.data) || [],
    });
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);
  return { ...state, reload };
}

// ────────── Cálculo del forecast ──────────
function calcularForecast(data, horizonteMeses) {
  const { inventario, transito, leadTimes, metadata, demanda, roadmap, embarques } = data;

  const invBySku  = Object.fromEntries(inventario.map(r => [r.sku, r]));
  const traBySku  = Object.fromEntries(transito.map(r => [r.sku, r]));
  const ltBySku   = Object.fromEntries(leadTimes.map(r => [r.sku, r]));
  const metaBySku = Object.fromEntries(metadata.map(r => [r.sku, r]));
  const rmBySku   = Object.fromEntries((roadmap || []).map(r => [r.sku, r]));

  // Histórico de compras por SKU (todas las POs no canceladas, agregadas)
  // → para piezas_por_contenedor y conteo de contenedores
  const comprasBySku = {};
  (embarques || []).forEach((e) => {
    const sku = (e.codigo || '').trim();
    if (!sku) return;
    const est = (e.estatus || '').toLowerCase();
    if (est.includes('cancel')) return;
    if (!comprasBySku[sku]) comprasBySku[sku] = { pos: [], piezasPorContenedor: 0, contadorContenedores: 0 };
    comprasBySku[sku].pos.push(e);
  });
  // Calcular piezas_por_contenedor promedio por SKU (po_qty / contenedor)
  Object.entries(comprasBySku).forEach(([sku, info]) => {
    let totalPiezas = 0, totalContenedores = 0;
    info.pos.forEach((e) => {
      const qty = Number(e.po_qty || 0);
      const cnt = Number(e.contenedor || 0);
      if (qty > 0 && cnt > 0) {
        totalPiezas += qty;
        totalContenedores += cnt;
      }
    });
    if (totalContenedores > 0) {
      info.piezasPorContenedor = Math.round(totalPiezas / totalContenedores);
      info.contadorContenedores = totalContenedores;
    }
  });

  // Últimos 3 meses de referencia para promedio de demanda (excluyendo mes actual que puede estar incompleto)
  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();
  const mesesRef = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(anioActual, mesActual - 1 - i, 1);
    mesesRef.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 });
  }

  // demandaBySku[sku].porCliente[c] = [piezas de cada mes de referencia]
  const demandaBySku = {};
  demanda.forEach(d => {
    if (!mesesRef.some(m => m.anio === d.anio && m.mes === d.mes)) return;
    if (d.cliente !== 'digitalife' && d.cliente !== 'pcel') return; // ML excluido
    if (!demandaBySku[d.sku]) demandaBySku[d.sku] = { porCliente: { digitalife: [], pcel: [] } };
    demandaBySku[d.sku].porCliente[d.cliente].push(Number(d.piezas || 0));
  });

  const skusUniverso = new Set([
    ...Object.keys(invBySku),
    ...Object.keys(traBySku),
    ...Object.keys(demandaBySku),
  ]);

  const rows = [];
  for (const sku of skusUniverso) {
    const acc = demandaBySku[sku]?.porCliente || { digitalife: [], pcel: [] };
    const promedioMes = (arr) => (arr || []).reduce((a, b) => a + b, 0) / 3;
    const demMes = {
      digitalife: promedioMes(acc.digitalife),
      pcel:       promedioMes(acc.pcel),
    };
    const demHor = {
      digitalife: demMes.digitalife * horizonteMeses,
      pcel:       demMes.pcel       * horizonteMeses,
    };
    const demandaTotalHor = demHor.digitalife + demHor.pcel;
    const demandaMesTotal = demMes.digitalife + demMes.pcel;

    const inv = Number(invBySku[sku]?.disponible || 0);
    const tra = traBySku[sku];
    const traCant = Number(tra?.cantidad || 0);
    const traEta  = tra?.eta_mas_cercana || null;

    // Tránsito que cae dentro del horizonte
    const horizonteLimite = new Date(hoy); horizonteLimite.setMonth(horizonteLimite.getMonth() + horizonteMeses);
    const embarques = Array.isArray(tra?.embarques_detalle) ? tra.embarques_detalle : [];
    const traDentroHor = embarques.reduce((a, e) => {
      const eta = e.eta ? new Date(e.eta) : null;
      if (!eta) return a;
      return eta <= horizonteLimite ? a + Number(e.cantidad || 0) : a;
    }, 0);
    const traDespuesHor = traCant - traDentroHor;

    // Brecha = demanda − (inventario + tránsito dentro del horizonte)
    const brecha = Math.max(0, demandaTotalHor - inv - traDentroHor);

    // Sugerido = brecha + buffer (1 mes de demanda) − tránsito que llega después del horizonte
    const bufferUnidades = demandaMesTotal * BUFFER_MESES;
    let sugerido = Math.max(0, brecha + bufferUnidades - traDespuesHor);

    // Redondeo a múltiplo de contenedor (si el SKU tiene capacidad conocida)
    const compraInfo = comprasBySku[sku] || {};
    const piezasPorContenedor = compraInfo.piezasPorContenedor || 0;
    let contenedoresSugeridos = 0;
    let esConsolidado = false;
    if (sugerido > 0 && piezasPorContenedor > 0) {
      contenedoresSugeridos = Math.ceil(sugerido / piezasPorContenedor);
      sugerido = contenedoresSugeridos * piezasPorContenedor;
      // Si la cantidad por contenedor es muy chica vs el contenedor estándar
      // (~1500-3000), probablemente comparte contenedor → flag consolidado
      esConsolidado = piezasPorContenedor < 800;
    }

    // Canibalización: PCEL y Digitalife ambos tienen demanda
    const canibalizacion = demMes.digitalife > 0 && demMes.pcel > 0;

    // Preventa: PCEL+DGL en próximos 60d vs tránsito 60d + inventario
    const limite60 = new Date(hoy); limite60.setDate(limite60.getDate() + 60);
    const traDentro60 = embarques.reduce((a, e) => {
      const eta = e.eta ? new Date(e.eta) : null;
      if (!eta) return a;
      return eta <= limite60 ? a + Number(e.cantidad || 0) : a;
    }, 0);
    const demandaPcelDgl60 = (demMes.digitalife + demMes.pcel) * 2;
    const preventaDeficit = Math.max(0, demandaPcelDgl60 - traDentro60 - inv);

    // Prorrateo PCEL/DGL cuando inventario+tránsito no alcanza (ML excluido)
    const disponibleParaPcelDgl = inv + traDentro60;
    const demandaPcelDglHor = demHor.pcel + demHor.digitalife;
    let prorrateo = null;
    if (disponibleParaPcelDgl < demandaPcelDglHor && demandaPcelDglHor > 0) {
      const ratio = disponibleParaPcelDgl / demandaPcelDglHor;
      prorrateo = {
        digitalife: demHor.digitalife * ratio,
        pcel:       demHor.pcel       * ratio,
        faltante:   demandaPcelDglHor - disponibleParaPcelDgl,
      };
    }

    const meta = metaBySku[sku] || {};
    const lt = ltBySku[sku];

    const rm = rmBySku[sku] || {};

    // Demanda últimos 6 meses por cliente (para mini-gráfica del expandible)
    const demanda6m = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anioActual, mesActual - 1 - i, 1);
      const a = d.getFullYear();
      const m = d.getMonth() + 1;
      let dDigi = 0, dPcel = 0;
      demanda.forEach((row) => {
        if (row.sku !== sku) return;
        if (row.anio !== a || Number(row.mes) !== m) return;
        const p = Number(row.piezas || 0);
        if (row.cliente === 'digitalife') dDigi += p;
        else if (row.cliente === 'pcel') dPcel += p;
      });
      demanda6m.push({ anio: a, mes: m, digi: dDigi, pcel: dPcel });
    }

    // Cobertura actual: inv / (demandaMesTotal/30) → días que cubre el stock
    const demandaDiaria = demandaMesTotal / 30;
    const coberturaDias = demandaDiaria > 0 ? Math.round(inv / demandaDiaria) : null;

    // Compras históricas (top 6 más recientes)
    const comprasHistAll = (compraInfo.pos || [])
      .filter((e) => e.fecha_emision)
      .sort((a, b) => String(b.fecha_emision).localeCompare(String(a.fecha_emision)));
    const comprasHist = comprasHistAll.slice(0, 6).map((e) => ({
      po: e.po,
      fecha_emision: e.fecha_emision,
      arribo_cedis: e.arribo_cedis,
      eta: e.eta,
      qty: Number(e.po_qty || 0),
      contenedores: Number(e.contenedor || 0),
      supplier: e.supplier,
      estatus: e.estatus,
    }));

    rows.push({
      sku,
      descripcion: meta.descripcion || '',
      supplier:    meta.supplier || lt?.supplier_principal || '',
      familia:     meta.familia || lt?.familia || '',
      marca:       meta.marca || '',
      roadmapEstado: rm.estado || rm.estatus || null,
      costoUnitMxn: Number(meta.costo_promedio_mxn || 0),
      costoUnitUsd: Number(meta.unit_price_usd_ultima || 0),
      demMes, demHor, demandaTotalHor, demandaMesTotal,
      demanda6m,
      coberturaDias,
      comprasHist,
      totalComprasHist: comprasHistAll.length,
      inv,
      inventarioData: invBySku[sku] || null,
      traCant, traEta, traDentroHor, traDespuesHor,
      embarques,
      brecha, sugerido,
      sugeridoValorUsd: sugerido * Number(meta.unit_price_usd_ultima || 0),
      piezasPorContenedor,
      contenedoresSugeridos,
      esConsolidado,
      tieneCompras: (compraInfo.pos || []).length > 0,
      canibalizacion, preventaDeficit, prorrateo,
      ltDias:     lt?.dias_promedio || null,
      ltMuestras: lt?.muestras || 0,
    });
  }

  return rows.filter(r => r.demandaTotalHor > 0 || r.inv > 0 || r.traCant > 0);
}

// ────────── Helpers visuales ──────────
const FMT_N   = (n) => Math.round(n || 0).toLocaleString('es-MX');
const FMT_USD = (n) => `$${Math.round(n || 0).toLocaleString('es-MX')}`;

function fmtFechaCorta(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d} ${meses[m-1]} ${String(y).slice(2)}`;
}
function diasHasta(iso) {
  if (!iso) return null;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  return Math.round((new Date(iso) - hoy) / 86400000);
}

// ────────── Componente principal ──────────
export default function ForecastClientesTab() {
  const perfil = usePerfil();
  const data = useForecastData();
  const [horizonte, setHorizonte] = useState(3);
  const [busqueda, setBusqueda] = useState('');
  const [filtroSupplier, setFiltroSupplier] = useState('todos');
  const [filtroFamilia, setFiltroFamilia] = useState('todas');
  const [filtroCliente, setFiltroCliente] = useState('todos');
  const [filtroFlag, setFiltroFlag] = useState('todos');
  const [expandedSku, setExpandedSku] = useState(null);
  const [sugeridosOpen, setSugeridosOpen] = useState(false);
  const [sortCol, setSortCol] = useState('brecha');
  const [sortDir, setSortDir] = useState('desc');
  const [exportando, setExportando] = useState(false);

  // Stub: la función real se agrega en Tanda 7 (sistema de solicitudes).
  // Por ahora mostramos un toast informativo cuando se da clic en "+".
  const onAgregarSolicitud = (row) => {
    toast.info(
      `Próximamente: agregar ${row.sku} (${FMT_N(row.sugerido)} pzs) a una solicitud de compra.`
    );
  };

  const rowsAll = useMemo(() => {
    if (data.loading) return [];
    return calcularForecast(data, horizonte);
  }, [data, horizonte]);

  // Mapa de metadata por SKU para pasar a las tarjetas resumen
  const metaBySku = useMemo(() =>
    Object.fromEntries((data.metadata || []).map(r => [r.sku, r]))
  , [data.metadata]);

  const rowsFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return rowsAll.filter(r => {
      if (q && !r.sku.toLowerCase().includes(q) && !r.descripcion.toLowerCase().includes(q)) return false;
      if (filtroSupplier !== 'todos' && r.supplier !== filtroSupplier) return false;
      if (filtroFamilia  !== 'todas' && r.familia  !== filtroFamilia)  return false;
      if (filtroCliente  !== 'todos' && (r.demMes[filtroCliente] || 0) <= 0) return false;
      if (filtroFlag === 'brecha'         && r.brecha <= 0) return false;
      if (filtroFlag === 'canibalizacion' && !r.canibalizacion) return false;
      if (filtroFlag === 'preventa'       && r.preventaDeficit <= 0) return false;
      return true;
    });
  }, [rowsAll, busqueda, filtroSupplier, filtroFamilia, filtroCliente, filtroFlag]);

  const rowsOrdenados = useMemo(() => {
    const arr = [...rowsFiltrados];
    const dir = sortDir === 'desc' ? -1 : 1;
    arr.sort((a, b) => {
      const va = a[sortCol] ?? 0;
      const vb = b[sortCol] ?? 0;
      if (typeof va === 'string') return dir * va.localeCompare(vb);
      return dir * (va - vb);
    });
    return arr;
  }, [rowsFiltrados, sortCol, sortDir]);

  const kpis = useMemo(() => {
    const conBrecha = rowsFiltrados.filter(r => r.brecha > 0);
    const enPreventa = rowsFiltrados.filter(r => r.preventaDeficit > 0);
    const enCanibalizacion = rowsFiltrados.filter(r => r.canibalizacion);
    const sobrestock = rowsAll.filter(r => r.inv > 0 && r.demandaMesTotal === 0);
    const valorSugeridoUsd = rowsFiltrados.reduce((a, r) => a + r.sugeridoValorUsd, 0);
    const ltValores = rowsFiltrados.filter(r => r.ltDias).map(r => r.ltDias);
    const ltPromedio = ltValores.length > 0 ? ltValores.reduce((a, b) => a + b, 0) / ltValores.length : 0;
    return {
      conBrecha: conBrecha.length,
      valorSugeridoUsd,
      enPreventa: enPreventa.length,
      enCanibalizacion: enCanibalizacion.length,
      sobrestock: sobrestock.length,
      ltPromedio,
    };
  }, [rowsFiltrados, rowsAll]);

  const suppliers = useMemo(() => {
    const set = new Set();
    rowsAll.forEach(r => r.supplier && set.add(r.supplier));
    return [...set].sort();
  }, [rowsAll]);
  const familias = useMemo(() => {
    const set = new Set();
    rowsAll.forEach(r => r.familia && set.add(r.familia));
    return [...set].sort();
  }, [rowsAll]);

  async function exportarAJunta() {
    if (data.loading || exportando) return;
    const conSugerido = rowsOrdenados.filter(r => r.sugerido > 0);
    if (conSugerido.length === 0) { toast.error('No hay sugeridos que exportar'); return; }
    setExportando(true);

    const juntaFecha = (() => {
      const d = new Date(); d.setDate(1);
      return d.toISOString().slice(0, 10);
    })();

    const payload = conSugerido.map(r => ({
      sku: r.sku,
      descripcion: r.descripcion,
      supplier: r.supplier || null,
      cantidad: Math.round(r.sugerido),
      costo_estimado: r.costoUnitUsd || null,
      horizonte_meses: horizonte,
      razon: `Demanda ${horizonte}m: ${FMT_N(r.demandaTotalHor)} | Inv: ${FMT_N(r.inv)} | Tránsito: ${FMT_N(r.traDentroHor)}`,
      junta_fecha: juntaFecha,
      estado: 'exportado',
      creado_por: perfil?.user_id || null,
    }));

    const { error } = await supabase.from('sugeridos_compra').insert(payload);
    if (error) { toast.error('Error guardando: ' + error.message); setExportando(false); return; }

    try {
      const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
      const wb = XLSX.utils.book_new();
      const resumen = conSugerido.map(r => ({
        SKU: r.sku,
        'Descripción': r.descripcion,
        Proveedor: r.supplier || '',
        Familia: r.familia || '',
        'LT días': r.ltDias || '',
        'Demanda DGL': Math.round(r.demHor.digitalife),
        'Demanda PCEL': Math.round(r.demHor.pcel),
        'Demanda total': Math.round(r.demandaTotalHor),
        'Inv Comercial': Math.round(r.inv),
        'Tránsito horizonte': Math.round(r.traDentroHor),
        Brecha: Math.round(r.brecha),
        Sugerido: Math.round(r.sugerido),
        'Costo USD': r.costoUnitUsd || 0,
        'Total USD': Math.round(r.sugeridoValorUsd),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Resumen');

      const porProv = {};
      conSugerido.forEach(r => {
        const prov = r.supplier || '(Sin proveedor)';
        if (!porProv[prov]) porProv[prov] = [];
        porProv[prov].push(r);
      });
      Object.entries(porProv).forEach(([prov, items]) => {
        const hoja = items.map(r => ({
          SKU: r.sku, Descripción: r.descripcion, Familia: r.familia || '',
          'Demanda total': Math.round(r.demandaTotalHor),
          Inv: Math.round(r.inv), Tránsito: Math.round(r.traDentroHor),
          Brecha: Math.round(r.brecha), Sugerido: Math.round(r.sugerido),
          'Costo USD': r.costoUnitUsd || 0, 'Total USD': Math.round(r.sugeridoValorUsd),
        }));
        const nombre = prov.slice(0, 31).replace(/[\\/?*[\]]/g, '');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hoja), nombre);
      });

      XLSX.writeFile(wb, `Junta_Compras_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`${conSugerido.length} sugeridos exportados y guardados`);
    } catch (e) {
      console.error(e);
      toast.success(`${conSugerido.length} sugeridos guardados (Excel falló: ${e.message})`);
    }
    setExportando(false);
    data.reload();
  }

  if (data.loading) {
    return <div className="p-6 text-gray-400">Cargando forecast de clientes…</div>;
  }

  return (
    <div className="p-6 space-y-5">
      {/* HEADER */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Activity className="w-6 h-6 text-gray-700" />
            Forecast Clientes
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Planeación de compras agregada · Digitalife + PCEL
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {HORIZONTES.map(h => (
              <button key={h.meses} onClick={() => setHorizonte(h.meses)}
                className={[
                  'px-3 py-1.5 rounded-md text-sm font-medium transition',
                  horizonte === h.meses ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900',
                ].join(' ')}>
                {h.label}
              </button>
            ))}
          </div>
          <button
            onClick={exportarAJunta} disabled={exportando}
            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> {exportando ? 'Exportando…' : 'Exportar a junta'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={AlertTriangle} label="SKUs con brecha" value={kpis.conBrecha} color="#EF4444" />
        <KpiCard icon={DollarSign} label="Valor a comprar" value={FMT_USD(kpis.valorSugeridoUsd)} color="#10B981" small />
        <KpiCard icon={Users} label="Canibalización" value={kpis.enCanibalizacion} color="#F59E0B" />
        <KpiCard icon={Target} label="En preventa" value={kpis.enPreventa} color="#8B5CF6" />
        <KpiCard icon={Package} label="Sobrestock" value={kpis.sobrestock} color="#64748B" />
        <KpiCard icon={Clock} label="LT promedio" value={`${Math.round(kpis.ltPromedio)}d`} color="#3B82F6" small />
      </div>

      {/* SUGERIDOS PENDIENTES */}
      {data.sugeridosPendientes.length > 0 && (
        <SugeridosPendientes
          sugeridos={data.sugeridosPendientes}
          open={sugeridosOpen}
          onToggle={() => setSugeridosOpen(!sugeridosOpen)}
          onRefresh={data.reload}
        />
      )}

      {/* TARJETAS RESUMEN — Novedades + Tránsito timeline */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <NovedadesCard
          roadmap={data.roadmap}
          embarques={data.embarques}
          metaBySku={metaBySku}
        />
        <TransitoTimeline
          embarques={data.embarques}
          metaBySku={metaBySku}
        />
      </div>

      {/* FILTROS */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-gray-400" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar SKU o descripción…"
            className="w-full pl-7 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white" />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="absolute right-2 top-2 text-gray-400">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select value={filtroSupplier} onChange={e => setFiltroSupplier(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white max-w-[200px]">
          <option value="todos">Todos los proveedores</option>
          {suppliers.map(s => <option key={s} value={s}>{s.slice(0, 40)}</option>)}
        </select>
        <select value={filtroFamilia} onChange={e => setFiltroFamilia(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
          <option value="todas">Todas las familias</option>
          {familias.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
          <option value="todos">Todos los clientes</option>
          {CLIENTES.map(c => <option key={c.key} value={c.key}>{c.full}</option>)}
        </select>

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'todos',         label: 'Todos' },
            { id: 'brecha',        label: 'Con brecha' },
            { id: 'canibalizacion',label: 'Canibalización' },
            { id: 'preventa',      label: 'Preventa' },
          ].map(f => (
            <button key={f.id} onClick={() => setFiltroFlag(f.id)}
              className={[
                'px-2.5 py-1 rounded-md text-xs font-medium transition',
                filtroFlag === f.id ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900',
              ].join(' ')}>
              {f.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-500 ml-auto">
          {rowsOrdenados.length} de {rowsAll.length} SKUs
        </span>
      </div>

      {/* TABLA */}
      <ForecastTable
        rows={rowsOrdenados.slice(0, 400)}
        expandedSku={expandedSku}
        setExpandedSku={setExpandedSku}
        sortCol={sortCol} sortDir={sortDir}
        onSort={(c) => {
          if (sortCol === c) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
          else { setSortCol(c); setSortDir('desc'); }
        }}
        onAgregarSolicitud={onAgregarSolicitud}
      />
      {rowsOrdenados.length > 400 && (
        <div className="text-center text-xs text-gray-500">
          Mostrando 400 de {rowsOrdenados.length}. Usa filtros o búsqueda para refinar.
        </div>
      )}
    </div>
  );
}

// ────────── KPI Card ──────────
function KpiCard({ icon: Icon, label, value, color, small }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}22`, color }}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-gray-500 truncate">{label}</div>
        <div className={small ? 'font-bold text-gray-800 text-sm truncate' : 'font-bold text-gray-800 text-lg'}>{value}</div>
      </div>
    </div>
  );
}

// ────────── Tabla — orden alineado con Reporte de Resumen Clientes ──────────
function ForecastTable({ rows, expandedSku, setExpandedSku, sortCol, sortDir, onSort, onAgregarSolicitud }) {
  const ArrowSort = ({ col }) => sortCol === col ? (
    <span className="text-blue-600">{sortDir === 'desc' ? '▼' : '▲'}</span>
  ) : <span className="text-gray-300">↕</span>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50/80 text-xs text-gray-600">
          <tr>
            <th className="w-4"></th>
            <th className="text-left px-3 py-2 cursor-pointer" onClick={() => onSort('sku')}>
              SKU <ArrowSort col="sku" />
            </th>
            <th className="text-left px-2 py-2">Roadmap</th>
            <th className="text-left px-3 py-2 min-w-[200px]">Descripción</th>
            <th className="text-left px-2 py-2">Familia</th>
            <th className="text-right px-2 py-2 cursor-pointer" onClick={() => onSort('inv')}>Inv <ArrowSort col="inv"/></th>
            <th className="text-right px-2 py-2 cursor-pointer" onClick={() => onSort('traCant')}>Tránsito <ArrowSort col="traCant"/></th>
            <th className="text-right px-2 py-2 cursor-pointer" onClick={() => onSort('demandaTotalHor')}>Dem total <ArrowSort col="demandaTotalHor"/></th>
            <th className="text-right px-1 py-2" style={{ color: '#3B82F6' }}>DGL</th>
            <th className="text-right px-1 py-2" style={{ color: '#EF4444' }}>PCEL</th>
            <th className="text-right px-2 py-2 cursor-pointer" onClick={() => onSort('brecha')}>Brecha <ArrowSort col="brecha"/></th>
            <th className="text-right px-2 py-2 cursor-pointer" onClick={() => onSort('sugerido')}>Sugerido <ArrowSort col="sugerido"/></th>
            <th className="text-right px-2 py-2 cursor-pointer" onClick={() => onSort('ltDias')}>LT <ArrowSort col="ltDias"/></th>
            <th className="text-left px-2 py-2">Banderas</th>
            <th className="px-2 py-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={15} className="text-center py-10 text-gray-400 text-sm">Sin resultados con los filtros actuales</td></tr>
          ) : rows.map(r => (
            <ForecastRow
              key={r.sku} r={r}
              expanded={expandedSku === r.sku}
              onToggle={() => setExpandedSku(expandedSku === r.sku ? null : r.sku)}
              onAgregarSolicitud={onAgregarSolicitud}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ForecastRow({ r, expanded, onToggle, onAgregarSolicitud }) {
  const brechaColor = r.brecha > 0 ? 'text-red-600 font-semibold' : 'text-gray-400';
  const eta = r.traEta ? diasHasta(r.traEta) : null;
  const etaLabel = r.traEta ? `${fmtFechaCorta(r.traEta)}${eta != null ? ` (${eta}d)` : ''}` : '—';
  const RoadmapBadge = ({ estado }) => {
    if (!estado) return <span className="text-gray-300 text-[10px]">—</span>;
    const e = String(estado).toLowerCase();
    let cls = 'bg-gray-100 text-gray-700';
    if (e.includes('vivo') || e.includes('activo') || e.includes('disponible')) cls = 'bg-emerald-100 text-emerald-700';
    else if (e.includes('proxim') || e.includes('camino')) cls = 'bg-blue-100 text-blue-700';
    else if (e.includes('descontin') || e.includes('eol') || e.includes('baja')) cls = 'bg-red-100 text-red-700';
    return <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls}`}>{estado}</span>;
  };

  return (
    <>
      <tr className="border-t border-gray-100 hover:bg-blue-50/40">
        <td className="pl-2 cursor-pointer" onClick={onToggle}>{expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400"/> : <ChevronDown className="w-3.5 h-3.5 text-gray-400"/>}</td>
        <td className="px-3 py-2 font-mono text-xs font-semibold text-gray-800 cursor-pointer" onClick={onToggle}>{r.sku}</td>
        <td className="px-2 py-2 cursor-pointer" onClick={onToggle}><RoadmapBadge estado={r.roadmapEstado}/></td>
        <td className="px-3 py-2 text-xs text-gray-600 truncate max-w-[280px] cursor-pointer" title={r.descripcion} onClick={onToggle}>{r.descripcion || '—'}</td>
        <td className="px-2 py-2 text-xs text-gray-500 truncate max-w-[110px] cursor-pointer" title={r.familia} onClick={onToggle}>{r.familia || '—'}</td>
        <td className="text-right px-2 py-2 tabular-nums text-gray-700 cursor-pointer" onClick={onToggle}>{FMT_N(r.inv)}</td>
        <td className="text-right px-2 py-2 tabular-nums text-xs text-gray-600 cursor-pointer" title={etaLabel} onClick={onToggle}>
          {r.traCant > 0 ? (<>
            {FMT_N(r.traCant)}<div className="text-[9px] text-gray-400">{etaLabel}</div>
          </>) : '—'}
        </td>
        <td className="text-right px-2 py-2 tabular-nums font-semibold text-gray-800 cursor-pointer" onClick={onToggle}>{FMT_N(r.demandaTotalHor)}</td>
        <td className="text-right px-1 tabular-nums text-xs cursor-pointer" style={{ color: r.demHor.digitalife > 0 ? '#3B82F6' : '#CBD5E1' }} onClick={onToggle}>{FMT_N(r.demHor.digitalife)}</td>
        <td className="text-right px-1 tabular-nums text-xs cursor-pointer" style={{ color: r.demHor.pcel > 0 ? '#EF4444' : '#CBD5E1' }} onClick={onToggle}>{FMT_N(r.demHor.pcel)}</td>
        <td className={`text-right px-2 py-2 tabular-nums cursor-pointer ${brechaColor}`} onClick={onToggle}>{FMT_N(r.brecha)}</td>
        <td className="text-right px-2 py-2 tabular-nums font-semibold text-emerald-700 cursor-pointer" onClick={onToggle}>
          {FMT_N(r.sugerido)}
          {r.contenedoresSugeridos > 0 && (
            <div className="text-[9px] text-gray-400 font-normal">
              {r.contenedoresSugeridos} cnt{r.esConsolidado ? ' (consol.)' : ''}
            </div>
          )}
        </td>
        <td className="text-right px-2 py-2 text-xs cursor-pointer" onClick={onToggle}>
          {r.ltDias ? <span className="text-gray-700">{Math.round(r.ltDias)}d</span> : <span className="text-gray-300">?</span>}
        </td>
        <td className="px-2 py-2 cursor-pointer" onClick={onToggle}>
          <div className="flex gap-1 flex-wrap">
            {r.canibalizacion && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-semibold" title="PCEL y Digitalife compiten por este SKU">
                <Users className="w-2.5 h-2.5"/>Canib
              </span>
            )}
            {r.preventaDeficit > 0 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-semibold" title={`Déficit ${FMT_N(r.preventaDeficit)} próximos 60d`}>
                <Target className="w-2.5 h-2.5"/>Preventa
              </span>
            )}
            {r.sugerido > 0 && r.ltDias && r.ltDias > 90 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-semibold" title={`LT largo: ${Math.round(r.ltDias)} días`}>
                <Flame className="w-2.5 h-2.5"/>Urge
              </span>
            )}
          </div>
        </td>
        <td className="px-2 py-2 text-center">
          {onAgregarSolicitud && r.sugerido > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAgregarSolicitud(r); }}
              className="inline-flex items-center justify-center w-6 h-6 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-700 transition"
              title={`Agregar a solicitud de compra (${FMT_N(r.sugerido)} pzs sugeridas)`}
            >
              +
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-gray-100 bg-gray-50/60">
          <td colSpan={15} className="p-4">
            <ExpandedDetail r={r} />
          </td>
        </tr>
      )}
    </>
  );
}

function ExpandedDetail({ r }) {
  // Cobertura color según rango (igual que Resumen Clientes)
  const colorCob = r.coberturaDias == null ? '#94A3B8'
    : r.coberturaDias < 30 ? '#EF4444'
    : r.coberturaDias <= 90 ? '#10B981'
    : r.coberturaDias <= 150 ? '#F59E0B'
    : '#EF4444';
  const labelCob = r.coberturaDias == null ? 'sin demanda'
    : r.coberturaDias < 30 ? 'stockout en riesgo'
    : r.coberturaDias <= 90 ? 'óptimo'
    : r.coberturaDias <= 150 ? 'alto'
    : 'sobreinventario';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">

      {/* 1) DEMANDA POR CLIENTE — al inicio (mini-gráfica 6 meses) */}
      <div className="bg-white rounded-lg p-3 border border-gray-200">
        <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wide mb-2">
          Demanda 6 meses por cliente (piezas)
        </h4>
        <DemandaSparkline data={r.demanda6m} />
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="flex-1 text-gray-600">Digitalife</span>
            <span className="font-semibold tabular-nums">{FMT_N(r.demMes.digitalife)}<span className="text-gray-400">/mes</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="flex-1 text-gray-600">PCEL</span>
            <span className="font-semibold tabular-nums">{FMT_N(r.demMes.pcel)}<span className="text-gray-400">/mes</span></span>
          </div>
        </div>
      </div>

      {/* 2) ARRIBOS EN TRÁNSITO — uno por uno */}
      <div className="bg-white rounded-lg p-3 border border-gray-200">
        <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wide mb-2 flex items-center gap-1">
          <Ship className="w-3.5 h-3.5" /> Arribos en tránsito
        </h4>
        {(r.embarques || []).length > 0 ? (
          <div className="space-y-1 text-xs max-h-40 overflow-y-auto">
            {r.embarques.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={[
                  'text-[9px] font-semibold px-1 py-0.5 rounded shrink-0',
                  e.estatus === 'TRANSITO MARITIMO' ? 'bg-blue-100 text-blue-700' :
                  e.estatus === 'PROXIMO A ZARPAR'  ? 'bg-amber-100 text-amber-700' :
                  e.estatus === 'EN PRODUCCION'     ? 'bg-slate-100 text-slate-600' :
                                                      'bg-gray-100 text-gray-600',
                ].join(' ')}>
                  {(e.estatus || '').slice(0, 12)}
                </span>
                <span className="font-semibold tabular-nums shrink-0">{FMT_N(e.cantidad)}</span>
                <span className="text-gray-500 truncate flex-1" title={`PO ${e.po || ''}`}>{e.po ? `PO-${e.po}` : ''}</span>
                <span className="text-gray-500 shrink-0">{fmtFechaCorta(e.eta)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-400 italic">Sin tránsito programado</div>
        )}
      </div>

      {/* 3) PROVEEDOR & COSTOS */}
      <div className="bg-white rounded-lg p-3 border border-gray-200">
        <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wide mb-2">
          Proveedor & costos
        </h4>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Proveedor</span>
            <span className="font-semibold text-gray-800 truncate ml-2 max-w-[180px]" title={r.supplier}>{r.supplier || '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Costo promedio (USD)</span>
            <span className="font-semibold tabular-nums">{r.costoUnitUsd ? `$${r.costoUnitUsd.toFixed(2)}` : '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Costo promedio (MXN)</span>
            <span className="font-semibold tabular-nums">{r.costoUnitMxn ? formatMXN(r.costoUnitMxn) : '—'}</span>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-1.5">
            <span className="text-gray-500">Piezas / contenedor</span>
            <span className="font-semibold tabular-nums">
              {r.tieneCompras
                ? (r.piezasPorContenedor > 0 ? FMT_N(r.piezasPorContenedor) : '—')
                : <span className="text-amber-600 italic">Aún no se compra</span>}
            </span>
          </div>
          {r.esConsolidado && r.tieneCompras && (
            <div className="text-[10px] text-amber-700 italic">
              Comparte contenedor con otros SKUs (consolidado)
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Lead time</span>
            <span className="font-semibold tabular-nums">
              {r.ltDias ? `${Math.round(r.ltDias)} días` : '—'}
              {r.ltMuestras > 0 && <span className="text-gray-400 ml-1">({r.ltMuestras})</span>}
            </span>
          </div>
        </div>
      </div>

      {/* 4) HISTÓRICO DE COMPRAS */}
      <div className="bg-white rounded-lg p-3 border border-gray-200">
        <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wide mb-2">
          Histórico de compras
        </h4>
        {(r.comprasHist || []).length === 0 ? (
          <div className="text-xs text-gray-400 italic">Sin historial de compras</div>
        ) : (
          <div className="space-y-1 text-xs max-h-40 overflow-y-auto">
            {r.comprasHist.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 tabular-nums shrink-0 w-16">
                  {(c.fecha_emision || '').slice(0, 10)}
                </span>
                <span className="font-semibold tabular-nums shrink-0 w-16 text-right">
                  {FMT_N(c.qty)} pz
                </span>
                <span className="text-gray-400 shrink-0 w-12 text-right text-[10px]">
                  {c.contenedores > 0 ? `${c.contenedores} cnt` : ''}
                </span>
                <span className={[
                  'text-[9px] font-semibold px-1 rounded shrink-0 ml-auto',
                  c.arribo_cedis ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700',
                ].join(' ')}>
                  {c.arribo_cedis ? 'recibida' : 'tránsito'}
                </span>
              </div>
            ))}
            {r.totalComprasHist > r.comprasHist.length && (
              <div className="text-[10px] text-gray-400 italic">
                +{r.totalComprasHist - r.comprasHist.length} compras más
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5) COBERTURA ACTUAL — barra horizontal */}
      <div className="bg-white rounded-lg p-3 border border-gray-200 lg:col-span-2">
        <div className="flex items-center justify-between mb-1.5">
          <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wide">Cobertura actual</h4>
          <div className="text-xs">
            {r.coberturaDias != null ? (
              <>
                <span className="font-bold tabular-nums" style={{ color: colorCob }}>
                  {r.coberturaDias} días
                </span>
                <span className="text-gray-500 ml-1">de venta · {labelCob}</span>
              </>
            ) : (
              <span className="text-gray-400 italic">sin demanda registrada</span>
            )}
          </div>
        </div>
        {r.coberturaDias != null && (
          <div className="h-2 bg-gray-100 rounded overflow-hidden relative">
            <div
              className="h-full rounded"
              style={{
                width: `${Math.min(100, (r.coberturaDias / 180) * 100)}%`,
                backgroundColor: colorCob,
              }}
            />
            {/* Marca del horizonte óptimo (60-90d) */}
            <div className="absolute top-0 bottom-0 border-r border-emerald-400/50" style={{ left: '33.33%' }} />
            <div className="absolute top-0 bottom-0 border-r border-emerald-400/50" style={{ left: '50%' }} />
          </div>
        )}
        <div className="text-[10px] text-gray-400 mt-1">
          Inv: <span className="font-semibold text-gray-600">{FMT_N(r.inv)}</span> pzs ÷
          <span className="font-semibold text-gray-600"> {FMT_N(r.demandaMesTotal / 30)}</span> pzs/día =
          <span className="font-semibold text-gray-600"> {r.coberturaDias != null ? r.coberturaDias : '—'}d</span>
        </div>
      </div>

      {/* Prorrateo (alerta cuando inv+tránsito < demanda) */}
      {r.prorrateo && (
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 lg:col-span-2">
          <h4 className="font-semibold text-amber-800 text-xs uppercase tracking-wide mb-1.5 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Inventario + tránsito insuficiente para la demanda
          </h4>
          <div className="text-xs text-amber-900 grid grid-cols-3 gap-3">
            <div><span className="text-amber-700">Digitalife: </span><span className="font-bold">{FMT_N(r.prorrateo.digitalife)}</span> <span className="text-[10px]">de {FMT_N(r.demHor.digitalife)} solicitadas</span></div>
            <div><span className="text-amber-700">PCEL: </span><span className="font-bold">{FMT_N(r.prorrateo.pcel)}</span> <span className="text-[10px]">de {FMT_N(r.demHor.pcel)} solicitadas</span></div>
            <div><span className="text-amber-700">Faltante: </span><span className="font-bold text-red-700">{FMT_N(r.prorrateo.faltante)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

// Mini-gráfica de barras para demanda 6 meses Digi+PCEL stack
function DemandaSparkline({ data }) {
  if (!data || data.length === 0) return <div className="text-xs text-gray-400 italic">Sin datos</div>;
  const MES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const max = Math.max(1, ...data.map(d => d.digi + d.pcel));
  const W = 280, H = 50, gap = 4;
  const barW = (W - (data.length - 1) * gap) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 12}`} className="w-full">
      {data.map((d, i) => {
        const x = i * (barW + gap);
        const total = d.digi + d.pcel;
        const hTot = (total / max) * H;
        const hDigi = (d.digi / max) * H;
        const hPcel = hTot - hDigi;
        return (
          <g key={i}>
            <rect x={x} y={H - hTot} width={barW} height={hPcel} fill="#EF4444" rx={1} />
            <rect x={x} y={H - hDigi} width={barW} height={hDigi} fill="#3B82F6" rx={1} />
            <text x={x + barW/2} y={H + 10} textAnchor="middle" fontSize={9} fill="#94A3B8">
              {MES_CORTO[d.mes - 1]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ────────── Sugeridos pendientes ──────────
function SugeridosPendientes({ sugeridos, open, onToggle, onRefresh }) {
  const totalSKUs = sugeridos.length;
  const totalValor = sugeridos.reduce((a, s) => a + (Number(s.costo_estimado || 0) * Number(s.cantidad || 0)), 0);

  async function cancelar(id) {
    if (!confirm('¿Cancelar este sugerido?')) return;
    const { error } = await supabase.from('sugeridos_compra').update({ estado: 'cancelado' }).eq('id', id);
    if (error) { toast.error('Error: ' + error.message); return; }
    toast.success('Sugerido cancelado');
    onRefresh();
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-100/50">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 text-blue-600" />
          <span className="font-semibold text-blue-900">Sugeridos exportados pendientes</span>
          <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-bold">{totalSKUs}</span>
          <span className="text-xs text-blue-700">· {FMT_USD(totalValor)}</span>
          <span className="text-xs text-blue-600 italic ml-2">desaparecen al aparecer en Master Embarques</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-blue-600" /> : <ChevronDown className="w-4 h-4 text-blue-600" />}
      </button>
      {open && (
        <div className="bg-white border-t border-blue-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600">
              <tr>
                <th className="text-left px-3 py-2">SKU</th>
                <th className="text-left px-3 py-2">Proveedor</th>
                <th className="text-right px-3 py-2">Cantidad</th>
                <th className="text-right px-3 py-2">Costo USD</th>
                <th className="text-right px-3 py-2">Valor</th>
                <th className="text-left px-3 py-2">Junta</th>
                <th className="text-left px-3 py-2">Estado</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {sugeridos.map(s => (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{s.sku}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{s.supplier || '—'}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{FMT_N(s.cantidad)}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{s.costo_estimado ? `$${Number(s.costo_estimado).toFixed(2)}` : '—'}</td>
                  <td className="text-right px-3 py-2 tabular-nums font-semibold">{FMT_USD(Number(s.costo_estimado || 0) * Number(s.cantidad || 0))}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{s.junta_fecha || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={[
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                      s.estado === 'exportado' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600',
                    ].join(' ')}>
                      {s.estado}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => cancelar(s.id)} className="p-1 text-gray-400 hover:text-red-600" title="Cancelar">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
