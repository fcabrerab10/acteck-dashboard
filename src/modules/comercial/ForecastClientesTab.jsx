import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { usePerfil } from '../../lib/perfilContext';
import { toast } from '../../lib/toast';
import { formatMXN } from '../../lib/utils';
import {
  Activity, AlertTriangle, Search, Download, Package, Ship, Target,
  ChevronDown, ChevronUp, Flame, X, Users,
  CheckCircle2, Clock, DollarSign, FileText,
} from 'lucide-react';
import TransitoTimeline from './forecast/TransitoTimeline';
import NovedadesCard from './forecast/NovedadesCard';
import SolicitudesPanel from './forecast/SolicitudesPanel';
import SolicitudesModal from './forecast/SolicitudesModal';
import AgregarLineaModal from './forecast/AgregarLineaModal';
import NecesidadCard from './forecast/NecesidadCard';
import { roadmapStyle } from '../../lib/roadmapColors';
import { useSolicitudes } from './forecast/useSolicitudes';
import { exportarSolicitudExcel } from './forecast/excelSOP';
import { puedeEditarPestanaGlobal, puedeVerPestanaGlobal } from '../../lib/permisos';
import SinAcceso from '../../components/SinAcceso';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';

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
    // Whitelist activa de SKUs del Reporte de Resumen Clientes — los únicos
    // SKUs que aparecen en la tabla del Forecast (en el mismo orden).
    reporteSkus: [],
    cuotas: [],
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
      // Nota: la tabla NO tiene `eta` ni `marca`; usamos `eta_puerto` (o
      // `arribo_almacen`) como ETA del embarque, y la marca la cruzamos
      // contra v_sku_metadata por SKU.
      fetchAll(() => supabase.from('embarques_compras')
        .select('po, codigo, fecha_emision, arribo_cedis, arribo_almacen, eta_puerto, etd, po_qty, cbm, contenedor, estatus, supplier, familia, descripcion, unit_price')),
      // Solicitudes de compra del año actual (las tablas pueden no existir aún
      // — capturamos error silenciosamente en ese caso)
      supabase.from('solicitudes_compra').select('*').eq('anio', anioActual)
        .order('fecha_creacion', { ascending: false })
        .then(r => r, () => ({ data: [] })),
      supabase.from('solicitudes_compra_lineas').select('*')
        .order('orden', { ascending: true })
        .then(r => r, () => ({ data: [] })),
      // Whitelist del Reporte: SOLO estos SKUs y en este orden aparecen
      // en el Forecast. Mismo source de verdad que la tabla del Reporte.
      supabase.from('reporte_skus').select('sku, orden').eq('activo', true).order('orden'),
      // Cuotas mensuales para calcular la necesidad vs cuota en MXN
      supabase.from('cuotas_mensuales').select('cliente, anio, mes, cuota_min, cuota_ideal')
        .gte('anio', anioActual - 1),
    ]);

    const [invRes, traRes, ltRes, metaRes, demData, sugRes, rmRes, embData, solRes, solLinRes, rsRes, cmRes] = queries;

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
      reporteSkus:   rsRes.data   || [],
      cuotas:        cmRes.data   || [],
    });
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);
  return { ...state, reload };
}

// ────────── Cálculo del forecast ──────────
function calcularForecast(data, horizonteMeses) {
  const { inventario, transito, leadTimes, metadata, demanda, roadmap, embarques, reporteSkus } = data;

  const invBySku  = Object.fromEntries(inventario.map(r => [r.sku, r]));
  const traBySku  = Object.fromEntries(transito.map(r => [r.sku, r]));
  const ltBySku   = Object.fromEntries(leadTimes.map(r => [r.sku, r]));
  const metaBySku = Object.fromEntries(metadata.map(r => [r.sku, r]));
  const rmBySku   = Object.fromEntries((roadmap || []).map(r => [r.sku, r]));

  // ── Histórico de compras por SKU + detección de consolidado ──
  // Modelo de embarques_compras:
  //   · Cada row = (PO, SKU) único. po_qty = piezas del SKU en esa PO.
  //   · La columna `contenedor` es el NÚMERO/identificador del contenedor
  //     (ej. "TXGU6521663"), no la cantidad. Si dos rows con SKUs distintos
  //     tienen el mismo `contenedor`, ese contenedor es compartido →
  //     consolidado.
  //
  // Para cada SKU calculamos:
  //   · pos: lista de POs del SKU (no canceladas)
  //   · piezasPorContenedor: po_qty del último embarque NO consolidado
  //     (si todas sus POs fueron consolidadas, queda null — no podemos
  //     definir "1 contenedor lleno del SKU").
  //   · esConsolidado: true si en alguna PO el contenedor del SKU lleva
  //     otros SKUs.

  // 1) Mapa contenedor → set(SKUs) para detectar consolidados.
  //    Excluye:
  //      · Canceladas / rechazadas / perdidas (no son embarques reales).
  //      · contenedor null o "PENDIENTE" (todavía no se sabe el contenedor).
  const skusPorContenedor = new Map();
  (embarques || []).forEach((e) => {
    const est = String(e.estatus || '').toLowerCase();
    if (est.includes('cancel') || est.includes('rechaz') || est.includes('perdid')) return;
    const cnt = (e.contenedor || '').toString().trim();
    if (!cnt || cnt.toUpperCase() === 'PENDIENTE') return;
    const sku = (e.codigo || '').trim();
    if (!sku) return;
    if (!skusPorContenedor.has(cnt)) skusPorContenedor.set(cnt, new Set());
    skusPorContenedor.get(cnt).add(sku);
  });
  const contenedorConfirmado = (cnt) => {
    if (!cnt) return false;
    const t = cnt.toString().trim();
    return t && t.toUpperCase() !== 'PENDIENTE';
  };
  const contenedorEsConsolidado = (cnt) => {
    if (!contenedorConfirmado(cnt)) return false;
    const set = skusPorContenedor.get(cnt.toString().trim());
    return set && set.size > 1;
  };

  // 2) Agrupar compras por SKU (excluye canceladas/rechazadas)
  const comprasBySku = {};
  (embarques || []).forEach((e) => {
    const sku = (e.codigo || '').trim();
    if (!sku) return;
    const est = (e.estatus || '').toLowerCase();
    if (est.includes('cancel') || est.includes('rechaz') || est.includes('perdid')) return;
    if (!comprasBySku[sku]) {
      comprasBySku[sku] = {
        pos: [],
        piezasPorContenedor: 0,
        esConsolidado: false,
        ultimaCompra: null,
      };
    }
    comprasBySku[sku].pos.push(e);
  });

  // 3) Calcular piezas_por_contenedor desde la última PO NO consolidada,
  //    detectar si el SKU es consolidado en general, y guardar última compra
  Object.entries(comprasBySku).forEach(([sku, info]) => {
    const ordenadas = info.pos.slice().sort((a, b) =>
      String(b.fecha_emision || '').localeCompare(String(a.fecha_emision || '')));

    // Última PO (cualquiera, aunque su contenedor esté pendiente) — info
    // visual del modal.
    const ult = ordenadas[0];
    if (ult) {
      const cntId = (ult.contenedor || '').toString().trim();
      const cntConf = contenedorConfirmado(cntId);
      info.ultimaCompra = {
        fecha: ult.fecha_emision || null,
        piezas: Number(ult.po_qty || 0),
        contenedor: cntConf ? cntId : null,
        contenedorPendiente: !cntConf,
        esConsolidado: cntConf && contenedorEsConsolidado(cntId),
        costoUsd: Number(ult.unit_price || 0),
        po: ult.po,
      };
    }

    // Para definir el PATRÓN del SKU (consolidado / pzs por contenedor)
    // usamos solo POs con contenedor CONFIRMADO. POs en producción cuyo
    // contenedor aún no se asigna no nos dicen nada del patrón.
    const ultConf = ordenadas.find((e) =>
      contenedorConfirmado((e.contenedor || '').toString().trim()));
    if (ultConf) {
      const cntId = (ultConf.contenedor || '').toString().trim();
      info.esConsolidado = contenedorEsConsolidado(cntId);
      // pzs/contenedor:
      //   - Si la última confirmada fue NO consolidada → po_qty es 1 contenedor lleno
      //   - Si fue consolidada → buscar hacia atrás la última NO consolidada
      if (!info.esConsolidado && Number(ultConf.po_qty) > 0) {
        info.piezasPorContenedor = Math.round(Number(ultConf.po_qty) || 0);
      } else {
        const ultNoConsol = ordenadas.find((e) => {
          const c = (e.contenedor || '').toString().trim();
          return contenedorConfirmado(c) && !contenedorEsConsolidado(c) && Number(e.po_qty) > 0;
        });
        if (ultNoConsol) {
          info.piezasPorContenedor = Math.round(Number(ultNoConsol.po_qty) || 0);
        }
      }
    } else {
      // Ningún PO con contenedor confirmado — no podemos inferir el patrón.
      info.esConsolidado = false;
      info.piezasPorContenedor = 0;
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

  // Universo = whitelist activa del Reporte de Resumen Clientes (mismos
  // SKUs y mismo orden). Si la whitelist está vacía caemos al universo
  // anterior (defensivo, no debería pasar).
  const whitelist = (reporteSkus || []).filter((r) => r.sku);
  let universoOrdenado;
  if (whitelist.length > 0) {
    universoOrdenado = whitelist.map((r) => r.sku);
  } else {
    universoOrdenado = Array.from(new Set([
      ...Object.keys(invBySku),
      ...Object.keys(traBySku),
      ...Object.keys(demandaBySku),
    ]));
  }

  const rows = [];
  for (const sku of universoOrdenado) {
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

    // Redondeo a múltiplo de contenedor (si el SKU tiene capacidad conocida
    // y no es consolidado — si es consolidado no se puede definir
    // "1 contenedor lleno" del SKU, así que dejamos la cantidad como brecha).
    const compraInfo = comprasBySku[sku] || {};
    const piezasPorContenedor = compraInfo.piezasPorContenedor || 0;
    const esConsolidado = !!compraInfo.esConsolidado;
    let contenedoresSugeridos = 0;
    if (sugerido > 0 && piezasPorContenedor > 0 && !esConsolidado) {
      contenedoresSugeridos = Math.ceil(sugerido / piezasPorContenedor);
      sugerido = contenedoresSugeridos * piezasPorContenedor;
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
    // Descripción y roadmap igual que en el Reporte de Resumen Clientes:
    //   1) descripción del roadmap_sku (la que se carga en el Excel del Reporte)
    //   2) fallback a v_sku_metadata.descripcion
    // El roadmap se lee de la columna `rdmp` (igual que Reporte).
    const descripcion = rm.descripcion || meta.descripcion || '';
    const roadmapEstado = rm.rdmp || rm.estado || rm.estatus || null;

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

    // Compras históricas — todas, ordenadas más recientes primero
    const comprasHistAll = (compraInfo.pos || [])
      .filter((e) => e.fecha_emision)
      .sort((a, b) => String(b.fecha_emision).localeCompare(String(a.fecha_emision)));
    const comprasHist = comprasHistAll.slice(0, 8).map((e) => {
      const cntRaw = (e.contenedor || '').toString().trim();
      const cntConf = contenedorConfirmado(cntRaw);
      const cntId = cntConf ? cntRaw : null;
      const skusEnCnt = cntId ? (skusPorContenedor.get(cntId)?.size || 1) : 0;
      const otrosSkusEnCnt = cntId
        ? Array.from(skusPorContenedor.get(cntId) || []).filter((s) => s !== sku)
        : [];
      return {
        po: e.po,
        fecha_emision: e.fecha_emision,
        arribo_cedis: e.arribo_cedis,
        eta: e.arribo_almacen || e.eta_puerto || e.eta || null,
        qty: Number(e.po_qty || 0),
        contenedorId: cntId,           // null si pendiente o sin asignar
        contenedorPendiente: !cntConf, // explícito para la UI
        skusEnCnt,                      // 1 = solo · >1 = consolidado · 0 = sin asignar
        otrosSkusEnCnt,
        unitPriceUsd: Number(e.unit_price || 0),
        supplier: e.supplier,
        estatus: e.estatus,
      };
    });

    // Costo promedio USD del SKU (ponderado por piezas) desde el histórico
    let costoPromUsdNum = 0, costoPromUsdDen = 0;
    comprasHistAll.forEach((e) => {
      const p = Number(e.po_qty || 0);
      const u = Number(e.unit_price || 0);
      if (p > 0 && u > 0) {
        costoPromUsdNum += p * u;
        costoPromUsdDen += p;
      }
    });
    const costoPromedioUsd = costoPromUsdDen > 0 ? costoPromUsdNum / costoPromUsdDen : 0;
    // Último costo USD = el de la PO más reciente con precio
    const ultimoCostoUsd = comprasHistAll.find((e) => Number(e.unit_price) > 0)?.unit_price
      || meta.unit_price_usd_ultima || 0;

    rows.push({
      sku,
      descripcion,
      supplier:    meta.supplier || lt?.supplier_principal || '',
      familia:     meta.familia || lt?.familia || '',
      marca:       meta.marca || '',
      roadmapEstado,
      costoUnitMxn: Number(meta.costo_promedio_mxn || 0),
      costoUnitUsd: Number(meta.unit_price_usd_ultima || 0),
      costoPromedioUsd,
      ultimoCostoUsd,
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
      ultimaCompra: compraInfo.ultimaCompra || null,
      canibalizacion, preventaDeficit, prorrateo,
      ltDias:     lt?.dias_promedio || null,
      ltMuestras: lt?.muestras || 0,
    });
  }

  // Si vienen del whitelist del Reporte, devolvemos TODOS (mismo orden y
  // SKUs que la tabla de Reporte). Si no hay whitelist, filtramos los
  // SKUs sin actividad para no llenar de basura.
  if (whitelist.length > 0) return rows;
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
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const heroBg = theme.heroCardBg || (isDark ? '#0F0F0F' : '#000000');
  const heroText = theme.heroCardText || '#F5F5F7';
  const heroMuted = 'rgba(255,255,255,0.72)';
  const heroSubtle = 'rgba(255,255,255,0.55)';
  if (!puedeVerPestanaGlobal(perfil, 'forecast_clientes')) {
    return <SinAcceso motivo="No tienes acceso a S&OP." />;
  }
  const data = useForecastData();
  const [horizonte, setHorizonte] = useState(3);
  const [busqueda, setBusqueda] = useState('');
  const [filtroSupplier, setFiltroSupplier] = useState('todos');
  const [filtroFamilia, setFiltroFamilia] = useState('todas');
  const [filtroCliente, setFiltroCliente] = useState('todos');
  const [filtroFlag, setFiltroFlag] = useState('todos');
  const [expandedSku, setExpandedSku] = useState(null);
  const [sugeridosOpen, setSugeridosOpen] = useState(false);
  // Por defecto sin sort explícito → respeta el orden del Reporte
  // (campo `orden` de reporte_skus). Click en una columna activa sort.
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [exportando, setExportando] = useState(false);
  const [borradorActivoId, setBorradorActivoId] = useState(null);
  const [misSolicitudesAbierto, setMisSolicitudesAbierto] = useState(false);
  // SKU pendiente de agregar — abre el modal de "agregar a solicitud"
  const [skuParaAgregar, setSkuParaAgregar] = useState(null);

  // Permisos:
  //   · puedeEditarSol  → crear/editar/cerrar solicitudes (Fernando)
  //   · puedeVerSol     → ver el listado de solicitudes (Karolina + Fernando)
  const puedeEditarSol = puedeEditarPestanaGlobal(perfil, 'forecast_solicitudes');
  const puedeVerSol    = puedeVerPestanaGlobal(perfil, 'forecast_solicitudes');

  const sol = useSolicitudes(perfil);

  // Cuando aparece un borrador nuevo, lo seleccionamos como activo.
  React.useEffect(() => {
    if (!borradorActivoId && sol.borradores.length > 0) {
      setBorradorActivoId(sol.borradores[0].id);
    }
    if (borradorActivoId && !sol.borradores.find((b) => b.id === borradorActivoId)) {
      setBorradorActivoId(sol.borradores[0]?.id || null);
    }
  }, [sol.borradores, borradorActivoId]);

  // Click en "+" de la tabla → abre el modal de "agregar a solicitud"
  // donde el usuario elige cuántos contenedores o piezas quiere pedir.
  const onAgregarSolicitud = (row) => {
    if (!puedeEditarSol) {
      toast.error('No tienes permiso para crear solicitudes de compra.');
      return;
    }
    setSkuParaAgregar(row);
  };

  // Confirmación del modal — recibe la cantidad final que el usuario eligió
  const confirmarAgregarLinea = async (cantidadFinal) => {
    const row = skuParaAgregar;
    if (!row || cantidadFinal <= 0) return;
    try {
      // Borrador a usar (preferencia: activo > más reciente > crear nuevo)
      let solicitudId = borradorActivoId;
      if (!solicitudId && sol.borradores.length > 0) {
        solicitudId = sol.borradores[0].id;
        setBorradorActivoId(solicitudId);
      }
      if (!solicitudId) {
        const nuevo = await sol.crearBorrador();
        if (!nuevo || !nuevo.id) {
          toast.error('No se pudo crear el borrador');
          return;
        }
        solicitudId = nuevo.id;
        setBorradorActivoId(solicitudId);
      }

      // Fecha estimada = hoy + lead_time
      let fechaEstimada = null;
      if (row.ltDias && row.ltDias > 0) {
        const d = new Date(); d.setDate(d.getDate() + Math.round(row.ltDias));
        fechaEstimada = d.toISOString().slice(0, 10);
      }
      // Calcular contenedores en base a la cantidad final
      const ppc = Number(row.piezasPorContenedor || 0);
      const cnts = ppc > 0 ? Math.ceil(cantidadFinal / ppc) : null;

      const linea = await sol.agregarLinea(solicitudId, {
        sku: row.sku,
        descripcion: row.descripcion,
        cantidad: cantidadFinal,
        proveedor: row.supplier || '',
        fecha_estimada: fechaEstimada,
        ultimo_costo_usd: row.ultimoCostoUsd || row.costoUnitUsd || null,
        piezas_por_contenedor: ppc || null,
        contenedores: cnts,
        es_consolidado: !!row.esConsolidado,
      });
      if (linea && linea.id) {
        toast.success(`✓ ${row.sku} · ${cantidadFinal.toLocaleString('es-MX')} pzs agregado al borrador #${solicitudId}`);
        setSkuParaAgregar(null);
      } else {
        toast.error('La línea no se guardó (respuesta vacía de la BD)');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Forecast] error en confirmarAgregarLinea', err);
      toast.error(`Error agregando ${row.sku}: ${err?.message || err}`);
    }
  };

  const onCrearNuevoBorrador = async () => {
    if (!puedeEditarSol) {
      toast.error('No tienes permiso para crear borradores');
      return;
    }
    try {
      const nuevo = await sol.crearBorrador();
      if (nuevo && nuevo.id) {
        setBorradorActivoId(nuevo.id);
        toast.success(`Borrador #${nuevo.id} creado`);
      } else {
        toast.error('No se pudo crear el borrador');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Forecast] error creando borrador', err);
      toast.error(`Error creando borrador: ${err?.message || err}`);
    }
  };

  // Eliminar borrador (con manejo de errores)
  const onEliminarSolicitudWrapped = async (id) => {
    if (!puedeEditarSol) return;
    try {
      await sol.eliminarSolicitud(id);
      toast.success(`Borrador #${id} eliminado`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Forecast] error eliminando borrador', err);
      toast.error(`No se pudo eliminar: ${err?.message || err}`);
    }
  };

  // Eliminar línea (con manejo de errores)
  const onEliminarLineaWrapped = async (lineaId) => {
    if (!puedeEditarSol) return;
    try {
      await sol.eliminarLinea(lineaId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Forecast] error eliminando línea', err);
      toast.error(`No se pudo eliminar: ${err?.message || err}`);
    }
  };

  // Cerrar borrador (con manejo de errores)
  const onCerrarBorradorWrapped = async (id) => {
    if (!puedeEditarSol) return;
    try {
      await sol.cerrarBorrador(id);
      toast.success(`Borrador #${id} cerrado como solicitud pendiente`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Forecast] error cerrando borrador', err);
      toast.error(`No se pudo cerrar: ${err?.message || err}`);
    }
  };

  // Editar línea (con manejo de errores)
  const onEditarLineaWrapped = async (lineaId, cambios) => {
    if (!puedeEditarSol) return;
    try {
      await sol.editarLinea(lineaId, cambios);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Forecast] error editando línea', err);
      toast.error(`No se pudo editar: ${err?.message || err}`);
    }
  };

  // Agregar SKU al roadmap + Reporte de Resumen Clientes.
  //   posicion: 'despues'      → exactamente después del SKU `despuesDe` (shift +1 al resto)
  //             'final-bloque' → al final del bloque del rdmp seleccionado
  //             'final-tabla'  → al final de toda la tabla
  const onAgregarRoadmap = async (sku, rdmp, descripcion, posicion = 'final-bloque', despuesDe = null) => {
    if (!perfil?.es_super_admin) {
      toast.error('Solo el super admin puede agregar al roadmap');
      return;
    }
    try {
      // 1) roadmap_sku: clasificación
      const { error: errRm } = await supabase
        .from('roadmap_sku')
        .upsert({
          sku,
          rdmp,
          descripcion: descripcion || null,
          descartado_en: null,
        }, { onConflict: 'sku' });
      if (errRm) throw errRm;

      // 2) Calcular el orden deseado
      let nuevoOrden = null;
      let mensaje = '';

      if (posicion === 'despues' && despuesDe) {
        // Posicionamiento exacto: justo después del SKU especificado
        const ref = (data.reporteSkus || []).find((r) => r.sku === despuesDe);
        if (!ref) {
          toast.error(`No se encontró el SKU de referencia ${despuesDe}`);
          return;
        }
        const ordenRef = Number(ref.orden || 0);
        nuevoOrden = ordenRef + 1;
        // Hacer espacio: shift +1 todos los SKUs con orden > ordenRef
        // Lo hacemos en orden DESCENDENTE para evitar choques de unique
        // (si la columna `orden` tuviera índice único). Aquí no lo tiene
        // pero es mejor práctica.
        const aShiftear = (data.reporteSkus || [])
          .filter((r) => Number(r.orden || 0) > ordenRef)
          .sort((a, b) => Number(b.orden || 0) - Number(a.orden || 0));
        for (const r of aShiftear) {
          await supabase
            .from('reporte_skus')
            .update({ orden: Number(r.orden) + 1 })
            .eq('sku', r.sku);
        }
        mensaje = `después de ${despuesDe} (orden ${nuevoOrden})`;
      } else if (posicion === 'final-bloque') {
        const skusDelBloque = (data.roadmap || [])
          .filter((r) => r.rdmp === rdmp && !r.descartado_en)
          .map((r) => r.sku);
        const ordenesDelBloque = (data.reporteSkus || [])
          .filter((r) => skusDelBloque.includes(r.sku))
          .map((r) => Number(r.orden || 0));
        if (ordenesDelBloque.length > 0) {
          // Insertar después del último del bloque (también shift)
          const ultimoOrdenBloque = Math.max(...ordenesDelBloque);
          nuevoOrden = ultimoOrdenBloque + 1;
          const aShiftear = (data.reporteSkus || [])
            .filter((r) => Number(r.orden || 0) > ultimoOrdenBloque)
            .sort((a, b) => Number(b.orden || 0) - Number(a.orden || 0));
          for (const r of aShiftear) {
            await supabase
              .from('reporte_skus')
              .update({ orden: Number(r.orden) + 1 })
              .eq('sku', r.sku);
          }
          mensaje = `al final del bloque ${rdmp} (orden ${nuevoOrden})`;
        } else {
          // No hay SKUs en ese bloque todavía → al final global
          const todos = (data.reporteSkus || []).map((r) => Number(r.orden || 0));
          nuevoOrden = todos.length > 0 ? Math.max(...todos) + 1 : 1;
          mensaje = `al final (orden ${nuevoOrden}) — primer SKU del bloque ${rdmp}`;
        }
      } else {
        // 'final-tabla'
        const todos = (data.reporteSkus || []).map((r) => Number(r.orden || 0));
        nuevoOrden = todos.length > 0 ? Math.max(...todos) + 1 : 1;
        mensaje = `al final (orden ${nuevoOrden})`;
      }

      // 3) Insertar el nuevo SKU
      const { error: errRs } = await supabase
        .from('reporte_skus')
        .upsert({
          sku,
          orden: nuevoOrden,
          activo: true,
          created_by: perfil?.id || null,
        }, { onConflict: 'sku' });
      if (errRs) throw errRs;

      toast.success(`✓ ${sku} agregado como ${rdmp} · ${mensaje}`);
      await data.reload();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Forecast] error agregando al roadmap', err);
      toast.error(`No se pudo agregar al roadmap: ${err?.message || err}`);
    }
  };

  // Descartar SKU (oculto de "Lo nuevo" hasta que se recupere)
  const onDescartarSku = async (sku) => {
    if (!perfil?.es_super_admin) return;
    try {
      const { error } = await supabase
        .from('roadmap_sku')
        .upsert({
          sku,
          rdmp: null,
          descartado_en: new Date().toISOString(),
        }, { onConflict: 'sku' });
      if (error) throw error;
      toast.success(`${sku} descartado`);
      await data.reload();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Forecast] error descartando', err);
      toast.error(`No se pudo descartar: ${err?.message || err}`);
    }
  };

  // Recuperar SKU descartado (vuelve a aparecer en "Lo nuevo")
  const onRecuperarSku = async (sku) => {
    if (!perfil?.es_super_admin) return;
    try {
      const { error } = await supabase
        .from('roadmap_sku')
        .delete()
        .eq('sku', sku)
        .not('descartado_en', 'is', null);
      if (error) throw error;
      toast.success(`${sku} recuperado`);
      await data.reload();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Forecast] error recuperando', err);
      toast.error(`No se pudo recuperar: ${err?.message || err}`);
    }
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
    // Si no hay sort explícito, conservar el orden del Reporte (whitelist).
    if (!sortCol) return rowsFiltrados;
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

  const borradorActivo = sol.borradores.find((b) => b.id === borradorActivoId) || null;
  const lineasBorrador = borradorActivo ? sol.lineasDe(borradorActivo.id) : [];
  const skusEnBorrador = new Set(lineasBorrador.map((l) => l.sku));
  const totalBorradorPz = lineasBorrador.reduce((a, l) => a + Number(l.cantidad || 0), 0);
  const totalBorradorUsd = lineasBorrador.reduce((a, l) => a + Number(l.cantidad || 0) * Number(l.ultimo_costo_usd || 0), 0);

  const nombreMes = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][new Date().getMonth()];
  const anioActual = new Date().getFullYear();

  const onExportarBorrador = async () => {
    if (!borradorActivo) return toast.error('No hay export activo');
    if (lineasBorrador.length === 0) return toast.error('El export está vacío');
    try {
      const filename = await exportarSolicitudExcel(borradorActivo, lineasBorrador);
      toast.success(`Excel descargado: ${filename}`);
    } catch (e) {
      toast.error(`Error exportando: ${e.message || e}`);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, padding: '10px 6px' }}>
      {/* Modal histórico de solicitudes cerradas */}
      <SolicitudesModal
        abierto={misSolicitudesAbierto}
        onCerrar={() => setMisSolicitudesAbierto(false)}
        cerradas={sol.cerradas}
        lineasDe={sol.lineasDe}
        puedeEditar={puedeEditarSol}
        onCambiarEstado={sol.cambiarEstado}
        onEditarLinea={sol.editarLinea}
        onEliminarLinea={sol.eliminarLinea}
        onEliminarSolicitud={sol.eliminarSolicitud}
      />

      {/* Modal agregar línea con cantidad custom */}
      {skuParaAgregar && (
        <AgregarLineaModal
          row={skuParaAgregar}
          onClose={() => setSkuParaAgregar(null)}
          onConfirm={confirmarAgregarLinea}
        />
      )}

      {/* HERO editorial · narrativa + stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24,
        background: heroBg, color: heroText,
        borderRadius: 14, padding: '18px 22px', marginBottom: 12,
        alignItems: 'center', position: 'relative', overflow: 'hidden',
        border: isDark ? `1px solid rgba(255,255,255,0.06)` : 'none',
      }}>
        {isDark && (
          <div style={{
            position: 'absolute', top: '-30%', right: '-10%', width: '50%', height: '100%',
            background: `radial-gradient(circle, ${theme.accent}1F 0%, transparent 70%)`, pointerEvents: 'none',
          }} />
        )}
        <div style={{ position: 'relative' }}>
          <p style={{
            fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em',
            color: heroSubtle, fontWeight: 500, fontFamily: TYPO.fontText, margin: 0,
          }}>
            Dirección Comercial · S&amp;OP · {nombreMes} {anioActual}
          </p>
          <h2 style={{
            fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em',
            color: heroText, margin: '4px 0 6px', lineHeight: 1.15,
          }}>
            Detalle por SKU · Planeación de compras.
          </h2>
          <p style={{
            color: heroMuted, fontSize: 12, lineHeight: 1.55, margin: 0, maxWidth: 600,
            fontFamily: TYPO.fontText, fontVariantNumeric: 'tabular-nums',
          }}>
            <strong style={{ color: heroText, fontWeight: 500 }}>{rowsAll.length} SKUs</strong>.
            {kpis.conBrecha > 0 && <> <strong style={{ color: '#FF6961', fontWeight: 500 }}>{kpis.conBrecha} con brecha inmediata</strong>,</>}
            {kpis.enCanibalizacion > 0 && <> <strong style={{ color: '#FFB84D', fontWeight: 500 }}>{kpis.enCanibalizacion} en canibalización</strong>,</>}
            {kpis.enPreventa > 0 && <> <strong style={{ color: heroText, fontWeight: 500 }}>{kpis.enPreventa} en preventa</strong>,</>}
            {' '}<strong style={{ color: '#34D158', fontWeight: 500 }}>{kpis.sobrestock} en sobrestock</strong>.
            Arma tu export seleccionando SKUs con la cantidad que necesites.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-end', position: 'relative' }}>
          {/* Selector de horizonte */}
          <div style={{ display: 'inline-flex', padding: 2, background: 'rgba(255,255,255,.08)', borderRadius: 999 }}>
            {HORIZONTES.map(h => {
              const on = horizonte === h.meses;
              return (
                <button key={h.meses} onClick={() => setHorizonte(h.meses)} style={{
                  padding: '4px 12px', borderRadius: 999, border: 'none',
                  background: on ? 'rgba(255,255,255,.95)' : 'transparent',
                  color: on ? '#000' : 'rgba(255,255,255,.7)',
                  fontFamily: TYPO.fontText, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}>
                  {h.label}
                </button>
              );
            })}
          </div>
          {/* Stats 2x2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', width: '100%' }}>
            <HeroStat label="SKUs c/ brecha" value={FMT_N(kpis.conBrecha)} sub={`USD ${FMT_N(kpis.valorSugeridoUsd)}`} color="#FF6961" heroText={heroText} heroSubtle={heroSubtle} />
            <HeroStat label="Sobrestock" value={FMT_N(kpis.sobrestock)} sub="&gt;90 días cobertura" color="#34D158" heroText={heroText} heroSubtle={heroSubtle} />
            <HeroStat label="Export activo" value={`USD ${FMT_N(totalBorradorUsd)}`} sub={`${lineasBorrador.length} SKUs · ${FMT_N(totalBorradorPz)} pz`} color={heroText} heroText={heroText} heroSubtle={heroSubtle} />
            <HeroStat label="LT promedio" value={`${Math.round(kpis.ltPromedio)}d`} sub="lead time" color={heroText} heroText={heroText} heroSubtle={heroSubtle} />
          </div>
        </div>
      </div>

      {/* Aviso migración pendiente */}
      {!sol.tablaExiste && puedeVerSol && (
        <div style={{
          background: `${theme.orange}14`, border: `1px solid ${theme.orange}40`,
          borderRadius: 10, padding: '8px 12px', fontSize: 11.5, color: theme.orange, marginBottom: 12,
        }}>
          ⚠ Las tablas <code>solicitudes_compra</code> aún no existen en la BD.
          Aplica la migración <code>supabase/migrations/20260504_solicitudes_compra.sql</code> desde el SQL Editor.
        </div>
      )}

      {/* GRID · main + sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 12, alignItems: 'start' }}>

        {/* MAIN COLUMN */}
        <div style={{ minWidth: 0 }}>
          {/* Toolbar filtros */}
          <div style={{
            background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12,
            padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            marginBottom: 12,
          }}>
            <div style={{
              flex: 1, minWidth: 240, maxWidth: 380, display: 'flex', alignItems: 'center', gap: 8,
              padding: '0 12px', background: theme.bg, border: `1px solid ${theme.border}`,
              borderRadius: 999, height: 32,
            }}>
              <Search size={12} style={{ color: theme.textMuted }} />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar SKU, descripción, marca…"
                style={{
                  border: 0, outline: 0, background: 'transparent', flex: 1,
                  fontFamily: TYPO.fontText, fontSize: 12, color: theme.text,
                }} />
              {busqueda && (
                <button onClick={() => setBusqueda('')}
                  style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 2, color: theme.textMuted }}>
                  <X size={12} />
                </button>
              )}
            </div>

            <ToolbarSelect value={filtroSupplier} onChange={setFiltroSupplier} theme={theme}
              options={[{ v: 'todos', l: 'Todos los proveedores' }, ...suppliers.map(s => ({ v: s, l: s.slice(0, 40) }))]} />
            <ToolbarSelect value={filtroFamilia} onChange={setFiltroFamilia} theme={theme}
              options={[{ v: 'todas', l: 'Todas las familias' }, ...familias.map(f => ({ v: f, l: f }))]} />
            <ToolbarSelect value={filtroCliente} onChange={setFiltroCliente} theme={theme}
              options={[{ v: 'todos', l: 'Todos los clientes' }, ...CLIENTES.map(c => ({ v: c.key, l: c.full }))]} />

            <span style={{ marginLeft: 'auto', fontSize: 11, color: theme.textMuted, fontFamily: 'SF Mono, ui-monospace, monospace' }}>
              <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{rowsOrdenados.length}</strong>
              &nbsp;de {rowsAll.length}
            </span>
          </div>

          {/* Sugeridos pendientes (colapsable) */}
          {data.sugeridosPendientes.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <SugeridosPendientes
                sugeridos={data.sugeridosPendientes}
                open={sugeridosOpen}
                onToggle={() => setSugeridosOpen(!sugeridosOpen)}
                onRefresh={data.reload}
              />
            </div>
          )}

          {/* Tabla principal */}
          <ForecastTable
            rows={rowsOrdenados}
            totalRows={rowsAll.length}
            expandedSku={expandedSku}
            setExpandedSku={setExpandedSku}
            sortCol={sortCol} sortDir={sortDir}
            onSort={(c) => {
              if (sortCol === c) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
              else { setSortCol(c); setSortDir('desc'); }
            }}
            onAgregarSolicitud={onAgregarSolicitud}
            skusEnBorrador={skusEnBorrador}
            lineasBorrador={lineasBorrador}
            theme={theme}
            isDark={isDark}
            horizonte={horizonte}
          />
        </div>

        {/* SIDEBAR · Export cart */}
        {puedeVerSol && (
          <div style={{ position: 'sticky', top: 12, alignSelf: 'start', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ExportCart
              sol={sol}
              activoId={borradorActivoId}
              setActivoId={setBorradorActivoId}
              activo={borradorActivo}
              lineas={lineasBorrador}
              totalPz={totalBorradorPz}
              totalUsd={totalBorradorUsd}
              puedeEditar={puedeEditarSol}
              onCrearNuevo={onCrearNuevoBorrador}
              onEditarLinea={onEditarLineaWrapped}
              onEliminarLinea={onEliminarLineaWrapped}
              onCerrar={onCerrarBorradorWrapped}
              onExportar={onExportarBorrador}
              onVerHistorial={() => setMisSolicitudesAbierto(true)}
              theme={theme}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ────────── Hero stat pill (para el hero editorial) ──────────
function HeroStat({ label, value, sub, color, heroText, heroSubtle }) {
  return (
    <div>
      <div style={{
        fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em',
        color: heroSubtle, fontWeight: 500, fontFamily: TYPO.fontText,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em',
        color: color || heroText, fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.1, marginTop: 2,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: heroSubtle, marginTop: 1 }} dangerouslySetInnerHTML={{ __html: sub }} />
      )}
    </div>
  );
}

// ────────── Select del toolbar (dropdown pill) ──────────
function ToolbarSelect({ value, onChange, options, theme }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{
      height: 32, padding: '0 10px', borderRadius: 999,
      background: theme.bg, border: `1px solid ${theme.border}`,
      fontFamily: TYPO.fontText, fontSize: 11.5, fontWeight: 500,
      color: theme.text, cursor: 'pointer', maxWidth: 200,
    }}>
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

// ────────── Chips helpers ──────────
function CoberturaChip({ dias, theme }) {
  if (dias == null || dias === Infinity) return <span style={{ color: theme.textSubtle, fontSize: 10.5 }}>—</span>;
  const bg = dias < 30 ? 'rgba(239,68,68,.14)' : dias < 60 ? 'rgba(245,158,11,.14)' : 'rgba(52,199,89,.13)';
  const fg = dias < 30 ? '#B91C1C' : dias < 60 ? '#B45309' : '#1C7A34';
  return (
    <span style={{
      display: 'inline-flex', padding: '2px 8px', borderRadius: 999,
      background: bg, color: fg,
      fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 700,
      fontVariantNumeric: 'tabular-nums',
    }}>
      {Math.round(dias)}d
    </span>
  );
}

function RoadmapChip({ estado, theme }) {
  if (!estado) return <span style={{ color: theme?.textSubtle || '#86868B', opacity: .5, fontSize: 10 }}>—</span>;
  const s = roadmapStyle(estado);
  return (
    <span style={{
      display: 'inline-block', padding: '2px 6px', borderRadius: 4,
      background: s.bg, color: s.color,
      fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
    }}>
      {estado}
    </span>
  );
}

function SortHeader({ theme, col, label, width, align = 'left', onSort, sortCol, sortDir }) {
  const active = col && sortCol === col;
  const clickable = !!onSort && col;
  return (
    <th style={{
      position: 'sticky', top: 0, background: theme.surface, zIndex: 1,
      textAlign: align, padding: '9px 10px', width,
      fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 9.5,
      textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted,
      borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap',
      cursor: clickable ? 'pointer' : 'default',
    }} onClick={clickable ? () => onSort(col) : undefined}>
      {label && (
        <span style={{ color: active ? theme.text : 'inherit', fontWeight: active ? 700 : 600 }}>
          {label}
          {active && <span style={{ marginLeft: 3, fontSize: 8 }}>{sortDir === 'desc' ? '▼' : '▲'}</span>}
        </span>
      )}
    </th>
  );
}

// ────────── Tabla principal ──────────
function ForecastTable({ rows, totalRows, expandedSku, setExpandedSku, sortCol, sortDir, onSort, onAgregarSolicitud, skusEnBorrador, lineasBorrador, theme, isDark, horizonte }) {
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{
        padding: '12px 16px', borderBottom: `1px solid ${theme.divider || theme.border}`,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
          Detalle por SKU
        </h5>
        <span style={{ marginLeft: 'auto', fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted }}>
          <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{rows.length}</strong> SKUs · click para drill · <span style={{ color: theme.green }}>■</span> en export
        </span>
      </div>
      <div style={{ overflow: 'auto', maxHeight: '75vh' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr>
              <SortHeader theme={theme} width={24} />
              <SortHeader theme={theme} col="marca" label="Marca" width={70} onSort={onSort} sortCol={sortCol} sortDir={sortDir} />
              <SortHeader theme={theme} col="sku" label="SKU" width={100} onSort={onSort} sortCol={sortCol} sortDir={sortDir} />
              <SortHeader theme={theme} label="Descripción" />
              <SortHeader theme={theme} col="rdmp" label="Roadmap" width={80} align="center" />
              <SortHeader theme={theme} col="inv" label="Inv actual" width={80} align="right" onSort={onSort} sortCol={sortCol} sortDir={sortDir} />
              <SortHeader theme={theme} col="traCant" label="Tránsito" width={80} align="right" onSort={onSort} sortCol={sortCol} sortDir={sortDir} />
              <SortHeader theme={theme} col="demandaTotalHor" label={`Dem ${horizonte}m`} width={80} align="right" onSort={onSort} sortCol={sortCol} sortDir={sortDir} />
              <SortHeader theme={theme} col="coberturaDias" label="Cobertura" width={80} align="center" onSort={onSort} sortCol={sortCol} sortDir={sortDir} />
              <SortHeader theme={theme} col="sugerido" label="Sugerido" width={90} align="right" onSort={onSort} sortCol={sortCol} sortDir={sortDir} />
              <SortHeader theme={theme} label="Acción" width={110} align="center" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={11} style={{ padding: '32px 16px', textAlign: 'center', color: theme.textMuted, fontSize: 11.5 }}>Sin resultados con los filtros actuales</td></tr>
            )}
            {rows.map((r) => {
              const enExport = skusEnBorrador.has(r.sku);
              const lineaExp = enExport ? lineasBorrador.find((l) => l.sku === r.sku) : null;
              return (
                <ForecastRow
                  key={r.sku}
                  r={r}
                  expanded={expandedSku === r.sku}
                  onToggle={() => setExpandedSku(expandedSku === r.sku ? null : r.sku)}
                  onAgregarSolicitud={onAgregarSolicitud}
                  enExport={enExport}
                  cantidadEnExport={lineaExp?.cantidad || 0}
                  theme={theme}
                  isDark={isDark}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────── Row ──────────
function ForecastRow({ r, expanded, onToggle, onAgregarSolicitud, enExport, cantidadEnExport, theme, isDark }) {
  const cellS = { padding: '7px 10px', fontSize: 12, color: theme.text, fontFamily: TYPO.fontText, verticalAlign: 'middle' };
  const numS = { ...cellS, fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 11.5, textAlign: 'right' };
  const boldS = { ...cellS, fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 12.5, letterSpacing: '-0.01em', textAlign: 'right' };
  const rowBg = expanded ? (isDark ? 'rgba(10,132,255,0.08)' : 'rgba(0,122,255,0.04)') :
                enExport ? 'rgba(52,199,89,0.05)' : 'transparent';
  const sugeridoColor = r.sugerido > 0
    ? (r.coberturaDias < 30 ? theme.red : theme.orange)
    : theme.textMuted;
  return (
    <>
      <tr onClick={onToggle} style={{
        borderTop: `1px solid ${theme.divider || theme.border}`,
        background: rowBg, cursor: 'pointer',
        transition: 'background 160ms ease',
      }}>
        <td style={{ ...cellS, width: 24, textAlign: 'center', color: expanded ? theme.accent : theme.textSubtle }}>
          {expanded ? '▾' : '▸'}
        </td>
        <td style={{ ...cellS, fontWeight: 600 }}>{r.marca || '—'}</td>
        <td style={{ ...cellS, fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 11, color: theme.accent, fontWeight: 600 }}>{r.sku}</td>
        <td style={{ ...cellS, maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descripcion}>{r.descripcion || '—'}</td>
        <td style={{ ...cellS, textAlign: 'center' }}><RoadmapChip estado={r.roadmapEstado} theme={theme} /></td>
        <td style={numS}>{FMT_N(r.inv)}</td>
        <td style={numS}>{r.traCant > 0 ? FMT_N(r.traCant) : <span style={{ color: theme.textSubtle }}>—</span>}</td>
        <td style={numS}>{FMT_N(r.demandaTotalHor)}</td>
        <td style={{ ...cellS, textAlign: 'center' }}><CoberturaChip dias={r.coberturaDias} theme={theme} /></td>
        <td style={{ ...boldS, color: sugeridoColor }}>
          {r.sugerido > 0 ? FMT_N(r.sugerido) : <span style={{ color: theme.textMuted, fontWeight: 500 }}>—</span>}
          {r.contenedoresSugeridos > 0 && (
            <div style={{ fontSize: 9.5, color: theme.textMuted, fontWeight: 500 }}>
              {r.contenedoresSugeridos}cnt{r.esConsolidado ? ' (consol.)' : ''}
            </div>
          )}
        </td>
        <td style={{ ...cellS, textAlign: 'center' }}>
          {onAgregarSolicitud && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAgregarSolicitud(r); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', borderRadius: 999,
                background: enExport ? theme.green : (isDark ? 'rgba(10,132,255,0.14)' : 'rgba(0,122,255,0.08)'),
                border: `1px solid ${enExport ? theme.green : (isDark ? 'rgba(10,132,255,0.30)' : 'rgba(0,122,255,0.20)')}`,
                color: enExport ? '#fff' : theme.accent,
                fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
              title={enExport ? `Ya en el export activo (${FMT_N(cantidadEnExport)} pz)` : 'Agregar al export activo'}
            >
              {enExport ? `✓ ${FMT_N(cantidadEnExport)}` : `＋ ${r.sugerido > 0 ? FMT_N(r.sugerido) : 'custom'}`}
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={11} style={{ padding: 0, background: theme.surface, borderTop: `1px solid ${theme.divider || theme.border}`, borderBottom: `1px solid ${theme.divider || theme.border}` }}>
            <ExpandedDetail r={r} theme={theme} isDark={isDark} onAgregarSolicitud={onAgregarSolicitud} enExport={enExport} />
          </td>
        </tr>
      )}
    </>
  );
}


// ────────── Drill inline (patrón Sell Out Dicotech) ──────────
function ExpandedDetail({ r, theme, isDark, onAgregarSolicitud, enExport }) {
  const MES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const fmtFechaC = (iso) => {
    if (!iso) return '—';
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return `${d} ${MES_CORTO[m - 1]} ${String(y).slice(2)}`;
  };
  const secLbl = {
    fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 700,
    letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted,
    paddingBottom: 8, marginBottom: 8, borderBottom: `1px solid ${theme.divider || theme.border}`,
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
  };
  const secSide = { fontFamily: TYPO.fontText, fontSize: 10.5, fontWeight: 500, color: theme.textSubtle, letterSpacing: 0, textTransform: 'none' };

  return (
    <div style={{
      padding: '20px 24px',
      background: isDark
        ? 'linear-gradient(180deg, rgba(10,132,255,0.05) 0%, rgba(10,132,255,0) 100%)'
        : 'linear-gradient(180deg, rgba(0,122,255,0.02) 0%, rgba(0,122,255,0) 100%)',
    }}>
      {/* Drill hero */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto', gap: 16,
        paddingBottom: 16, borderBottom: `1px solid ${theme.divider || theme.border}`, marginBottom: 16,
        alignItems: 'center',
      }}>
        <div>
          <h3 style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: theme.text }}>
            {r.descripcion || r.sku}
          </h3>
          <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 3, fontFamily: 'SF Mono, ui-monospace, monospace' }}>
            {r.sku} · {r.marca || 'Sin marca'} · {r.familia || 'Sin familia'} · {r.supplier || 'Sin proveedor'}
            {r.piezasPorContenedor > 0 && ` · 1 cnt = ${FMT_N(r.piezasPorContenedor)} pz`}
            {r.ultimoCostoUsd > 0 && ` · $${Number(r.ultimoCostoUsd).toFixed(2)} USD`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => onAgregarSolicitud && onAgregarSolicitud(r)}
            style={{
              padding: '8px 16px', borderRadius: 999,
              background: enExport ? theme.green : theme.accent, color: '#fff', border: 0,
              fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            {enExport ? '✓ Editar cantidad' : '＋ Agregar al export'}
          </button>
        </div>
      </div>

      {/* KPI strip 6 métricas con hairlines */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', marginBottom: 20 }}>
        <DrillKpi label="Inventario hoy" value={FMT_N(r.inv)} u="pz" sub="stock actual" theme={theme} />
        <DrillKpi label="Tránsito activo" value={FMT_N(r.traCant)} u="pz" sub={r.traEta ? `próximo ${fmtFechaC(r.traEta)}` : 'sin POs'} color={r.traCant > 0 ? '#1C7A34' : null} theme={theme} borderLeft />
        <DrillKpi label="Demanda mensual" value={FMT_N(r.demandaMesTotal)} u="pz/m" sub={`DGL ${FMT_N(r.demMes.digitalife)} · PCEL ${FMT_N(r.demMes.pcel)}`} theme={theme} borderLeft />
        <DrillKpi
          label="Cobertura"
          value={r.coberturaDias == null || r.coberturaDias === Infinity ? '∞' : Math.round(r.coberturaDias)}
          u={r.coberturaDias == null || r.coberturaDias === Infinity ? '' : 'd'}
          sub={r.coberturaDias < 30 ? 'crítica' : r.coberturaDias < 60 ? 'tensa' : 'ok'}
          color={r.coberturaDias < 30 ? '#B91C1C' : r.coberturaDias < 60 ? '#B45309' : '#1C7A34'}
          theme={theme} borderLeft
        />
        <DrillKpi label="Lead time" value={r.ltDias ? Math.round(r.ltDias) : '—'} u={r.ltDias ? 'd' : ''} sub={r.supplier ? r.supplier.slice(0, 22) : 'sin proveedor'} theme={theme} borderLeft />
        <DrillKpi
          label="Sugerido"
          value={r.sugerido > 0 ? (r.contenedoresSugeridos || 1) : '—'}
          u={r.sugerido > 0 ? `cnt · ${FMT_N(r.sugerido)}pz` : ''}
          sub={r.sugeridoValorUsd > 0 ? `USD ${FMT_N(r.sugeridoValorUsd)}` : ''}
          color={r.sugerido > 0 ? (r.coberturaDias < 30 ? '#B91C1C' : '#B45309') : null}
          theme={theme} borderLeft
        />
      </div>

      {/* Grid inferior: demanda 6m + tránsito + proveedor */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20 }}>
        <div>
          <div style={secLbl}>
            <span>📅 Demanda últimos 6 meses</span>
            <span style={secSide}>Digitalife + PCEL</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 8px', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted, textAlign: 'left', borderBottom: `1px solid ${theme.divider || theme.border}` }}>Mes</th>
                <th style={{ padding: '6px 8px', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted, textAlign: 'right', borderBottom: `1px solid ${theme.divider || theme.border}` }}>Digitalife</th>
                <th style={{ padding: '6px 8px', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted, textAlign: 'right', borderBottom: `1px solid ${theme.divider || theme.border}` }}>PCEL</th>
                <th style={{ padding: '6px 8px', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted, textAlign: 'right', borderBottom: `1px solid ${theme.divider || theme.border}` }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {(r.demanda6m || []).map((d, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${theme.divider || theme.border}` }}>
                  <td style={{ padding: '6px 8px', fontSize: 11.5, color: theme.text }}>{MES_CORTO[d.mes - 1]} {String(d.anio).slice(2)}</td>
                  <td style={{ padding: '6px 8px', fontSize: 11.5, fontFamily: 'SF Mono, ui-monospace, monospace', textAlign: 'right', color: d.digi > 0 ? theme.accent : theme.textSubtle, fontVariantNumeric: 'tabular-nums' }}>{FMT_N(d.digi)}</td>
                  <td style={{ padding: '6px 8px', fontSize: 11.5, fontFamily: 'SF Mono, ui-monospace, monospace', textAlign: 'right', color: d.pcel > 0 ? theme.red : theme.textSubtle, fontVariantNumeric: 'tabular-nums' }}>{FMT_N(d.pcel)}</td>
                  <td style={{ padding: '6px 8px', fontSize: 11.5, fontFamily: 'SF Mono, ui-monospace, monospace', textAlign: 'right', fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{FMT_N(d.digi + d.pcel)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {(r.canibalizacion || r.preventaDeficit) && (
            <div style={{
              background: `${theme.orange}0F`, borderLeft: `3px solid ${theme.orange}`,
              padding: '10px 12px', borderRadius: 6, fontSize: 11.5, lineHeight: 1.5, marginTop: 16, color: theme.text,
            }}>
              {r.canibalizacion && <div><b>⚠ Canibalización</b> · {r.canibalizacion.mensaje || 'Este SKU compite con otro de la misma familia.'}</div>}
              {r.preventaDeficit && <div style={{ marginTop: 4 }}><b>🚀 Preventa</b> · Déficit acumulado de {FMT_N(r.preventaDeficit)} pz respecto a compromiso.</div>}
            </div>
          )}
        </div>

        <div>
          <div style={secLbl}>
            <span>🚢 Tránsito · próximos shipments</span>
            <span style={secSide}>{(r.embarques || []).length} POs</span>
          </div>
          {(r.embarques || []).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {r.embarques.slice(0, 6).map((e, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'center',
                  padding: '6px 0', borderBottom: `1px solid ${theme.divider || theme.border}`, fontSize: 11,
                }}>
                  <span style={{
                    fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                    padding: '2px 6px', borderRadius: 4,
                    background: e.estatus === 'TRANSITO MARITIMO' ? `${theme.accent}22`
                      : e.estatus === 'PROXIMO A ZARPAR' ? `${theme.orange}22`
                      : e.estatus === 'EN PRODUCCION' ? `${theme.textSubtle || theme.textMuted}22`
                      : `${theme.textMuted}22`,
                    color: e.estatus === 'TRANSITO MARITIMO' ? theme.accent
                      : e.estatus === 'PROXIMO A ZARPAR' ? theme.orange
                      : theme.textMuted,
                  }}>{(e.estatus || 'OTRO').slice(0, 12)}</span>
                  <span style={{ fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted }}>
                    {e.po ? `PO-${e.po}` : '—'} · <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{FMT_N(e.cantidad)}</strong> pz
                  </span>
                  <span style={{ fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted }}>{fmtFechaC(e.eta)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '18px 0', color: theme.textMuted, fontSize: 11, fontStyle: 'italic', textAlign: 'center' }}>Sin tránsito programado</div>
          )}

          <div style={{ ...secLbl, marginTop: 20 }}>
            <span>💵 Proveedor & costos</span>
            <span style={secSide}>ref. compras</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
            <KVRow k="Proveedor" v={r.supplier || '—'} theme={theme} />
            <KVRow k="Costo promedio USD" v={r.costoPromedioUsd > 0 ? `$${r.costoPromedioUsd.toFixed(2)}` : '—'} theme={theme} mono />
            <KVRow k="Último costo USD" v={r.ultimoCostoUsd > 0 ? `$${Number(r.ultimoCostoUsd).toFixed(2)}` : '—'} theme={theme} mono color={theme.green} />
            <KVRow
              k="Piezas por contenedor"
              v={r.tieneCompras ? (r.piezasPorContenedor > 0 ? `${FMT_N(r.piezasPorContenedor)} pz` : '—') : 'Aún no se compra'}
              theme={theme} mono
              color={r.tieneCompras ? theme.text : theme.orange}
            />
            <KVRow k="Lead time" v={r.ltDias ? `${Math.round(r.ltDias)} d${r.ltMuestras > 0 ? ` (${r.ltMuestras})` : ''}` : '—'} theme={theme} mono />
            {r.esConsolidado && r.tieneCompras && (
              <div style={{ fontSize: 10, color: theme.orange, fontStyle: 'italic', marginTop: 2 }}>
                Comparte contenedor con otros SKUs (consolidado)
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DrillKpi({ label, value, u, sub, color, theme, borderLeft }) {
  return (
    <div style={{
      padding: '0 14px',
      borderLeft: borderLeft ? `1px solid ${theme.divider || theme.border}` : 'none',
    }}>
      <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 700 }}>{label}</div>
      <div style={{
        fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em',
        fontVariantNumeric: 'tabular-nums', marginTop: 3, lineHeight: 1.05, color: color || theme.text,
      }}>
        {value}
        {u && <span style={{ fontSize: 10, color: theme.textMuted, fontWeight: 500, marginLeft: 3 }}>{u}</span>}
      </div>
      {sub && <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function KVRow({ k, v, theme, mono, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0' }}>
      <span style={{ color: theme.textMuted, fontSize: 11.5 }}>{k}</span>
      <span style={{
        fontFamily: mono ? 'SF Mono, ui-monospace, monospace' : TYPO.fontText,
        fontSize: mono ? 11 : 11.5, fontWeight: 600, color: color || theme.text,
      }}>{v}</span>
    </div>
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

// ────────── Sidebar · Mi Export ──────────
function ExportCart({
  sol, activoId, setActivoId, activo, lineas, totalPz, totalUsd,
  puedeEditar, onCrearNuevo, onEditarLinea, onEliminarLinea, onCerrar,
  onExportar, onVerHistorial, theme,
}) {
  const [nombreEdit, setNombreEdit] = useState(activo?.nombre || '');
  React.useEffect(() => { setNombreEdit(activo?.nombre || ''); }, [activo?.id, activo?.nombre]);
  const guardarNombre = async () => {
    if (!activo || nombreEdit === activo.nombre) return;
    try { await sol.editarSolicitud(activo.id, { nombre: nombreEdit }); }
    catch (e) { toast.error(e.message || 'Error al renombrar'); }
  };
  const fmtRel = (iso) => {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 60000;
    if (diff < 1) return 'hace segundos';
    if (diff < 60) return `hace ${Math.round(diff)} min`;
    if (diff < 24 * 60) return `hace ${Math.round(diff / 60)} h`;
    return `hace ${Math.round(diff / (60 * 24))} d`;
  };

  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 12, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px', borderBottom: `1px solid ${theme.divider || theme.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.005em', color: theme.text }}>
          📋 Mi export
        </div>
        <div style={{ fontSize: 10, color: theme.textMuted, fontFamily: 'SF Mono, ui-monospace, monospace' }}>
          autosave
        </div>
      </div>

      {/* Selector de borrador */}
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.divider || theme.border}`, display: 'flex', gap: 6 }}>
        <select
          value={activoId || ''}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '__NEW__') { onCrearNuevo && onCrearNuevo(); return; }
            setActivoId(v);
          }}
          style={{
            flex: 1, padding: '6px 10px', borderRadius: 8,
            border: `1px solid ${theme.border}`, background: theme.bg,
            fontFamily: TYPO.fontText, fontSize: 12, color: theme.text, outline: 'none',
          }}>
          {sol.borradores.length === 0 && <option value="">Sin borradores</option>}
          {sol.borradores.map((b) => (
            <option key={b.id} value={b.id}>{b.nombre || 'Sin nombre'}</option>
          ))}
          {puedeEditar && <option value="__NEW__">＋ Nuevo export</option>}
        </select>
      </div>

      {activo ? (
        <>
          {/* Nombre editable */}
          <div style={{ padding: '10px 14px 4px' }}>
            <input
              type="text"
              value={nombreEdit}
              onChange={(e) => setNombreEdit(e.target.value)}
              onBlur={guardarNombre}
              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
              disabled={!puedeEditar}
              style={{
                width: '100%', border: 'none', background: 'transparent',
                fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600,
                letterSpacing: '-0.015em', color: theme.text, outline: 'none',
              }}
              placeholder="Nombre del export"
            />
            <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 2 }}>
              {lineas.length} SKU{lineas.length !== 1 ? 's' : ''}
              {activo.updated_at && <> · edición {fmtRel(activo.updated_at)}</>}
            </div>
          </div>

          {/* Totales */}
          <div style={{
            padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
            borderBottom: `1px solid ${theme.divider || theme.border}`,
          }}>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 700 }}>Piezas</div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', marginTop: 2, color: theme.text }}>{FMT_N(totalPz)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 700 }}>Total USD</div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', marginTop: 2, color: theme.text }}>${FMT_N(totalUsd)}</div>
            </div>
          </div>

          {/* Líneas */}
          <div style={{ maxHeight: 340, overflow: 'auto' }}>
            {lineas.length === 0 ? (
              <div style={{ padding: '30px 20px', textAlign: 'center', color: theme.textMuted, fontSize: 11.5, fontStyle: 'italic' }}>
                Sin SKUs. Da click a "＋" en la tabla para agregar.
              </div>
            ) : lineas.map((l) => (
              <ExportCartLine
                key={l.id}
                linea={l}
                puedeEditar={puedeEditar}
                onEditarLinea={onEditarLinea}
                onEliminarLinea={onEliminarLinea}
                theme={theme}
              />
            ))}
          </div>

          {/* Actions */}
          <div style={{
            padding: '12px 14px', borderTop: `1px solid ${theme.divider || theme.border}`,
            background: theme.bg, display: 'flex', gap: 6,
          }}>
            {puedeEditar && (
              <button
                onClick={() => onCerrar && onCerrar(activo.id)}
                disabled={lineas.length === 0}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: 999,
                  background: theme.surface, border: `1px solid ${theme.border}`,
                  fontFamily: TYPO.fontText, fontSize: 11, fontWeight: 600, color: theme.textMuted,
                  cursor: lineas.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: lineas.length === 0 ? 0.5 : 1,
                }}>
                Cerrar
              </button>
            )}
            <button
              onClick={onExportar}
              disabled={lineas.length === 0}
              style={{
                flex: 2, padding: '7px 10px', borderRadius: 999,
                background: theme.green, border: `1px solid ${theme.green}`, color: '#fff',
                fontFamily: TYPO.fontText, fontSize: 11.5, fontWeight: 600,
                cursor: lineas.length === 0 ? 'not-allowed' : 'pointer',
                opacity: lineas.length === 0 ? 0.5 : 1,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              📥 Exportar Excel
            </button>
          </div>

          {/* Ver histórico */}
          <button
            onClick={onVerHistorial}
            style={{
              width: '100%', padding: '10px 14px', border: 'none',
              background: 'transparent', color: theme.accent,
              fontFamily: TYPO.fontText, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', borderTop: `1px solid ${theme.divider || theme.border}`,
              textAlign: 'center',
            }}>
            📚 Ver historial completo ({sol.cerradas.length})
          </button>
        </>
      ) : (
        <div style={{ padding: '20px 16px', textAlign: 'center', color: theme.textMuted, fontSize: 12 }}>
          {puedeEditar
            ? 'Crea un nuevo export para empezar a agregar SKUs.'
            : 'Sin export activo.'}
          {puedeEditar && (
            <button
              onClick={onCrearNuevo}
              style={{
                marginTop: 12, padding: '7px 14px', borderRadius: 999,
                background: theme.accent, color: '#fff', border: 0,
                fontFamily: TYPO.fontText, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
              ＋ Nuevo export
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ExportCartLine({ linea, puedeEditar, onEditarLinea, onEliminarLinea, theme }) {
  const cantidad = Number(linea.cantidad || 0);
  const cnt = Number(linea.contenedores || 0);
  const pzPorCnt = cnt > 0 ? cantidad / cnt : 0;
  const inc = () => onEditarLinea && onEditarLinea(linea.id, { cantidad: cantidad + (pzPorCnt || 100), contenedores: cnt + 1 });
  const dec = () => {
    if (cnt <= 1) return;
    onEditarLinea && onEditarLinea(linea.id, { cantidad: Math.max(0, cantidad - (pzPorCnt || 100)), contenedores: cnt - 1 });
  };
  const subtotal = cantidad * Number(linea.ultimo_costo_usd || 0);
  return (
    <div style={{
      padding: '10px 14px', borderBottom: `1px solid ${theme.divider || theme.border}`,
      display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 11.5, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={linea.descripcion}>
          {linea.descripcion || linea.sku}
        </div>
        <div style={{ fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 10, color: theme.textMuted, marginTop: 1 }}>
          {linea.sku}
          {linea.ultimo_costo_usd > 0 && ` · $${Number(linea.ultimo_costo_usd).toFixed(2)}`}
          {subtotal > 0 && ` → $${FMT_N(subtotal)}`}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {puedeEditar && (
          <button onClick={dec} disabled={cnt <= 1} style={{
            width: 22, height: 22, borderRadius: 6, border: `1px solid ${theme.border}`,
            background: theme.surface, color: theme.textMuted, cursor: cnt <= 1 ? 'not-allowed' : 'pointer',
            fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 12, opacity: cnt <= 1 ? 0.5 : 1,
          }}>−</button>
        )}
        <div style={{ textAlign: 'center', minWidth: 30 }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: theme.text }}>
            {cnt > 0 ? cnt : FMT_N(cantidad)}
          </div>
          <div style={{ fontSize: 9, color: theme.textMuted, fontWeight: 500 }}>
            {cnt > 0 ? 'cnt' : 'pz'}
          </div>
        </div>
        {puedeEditar && (
          <button onClick={inc} style={{
            width: 22, height: 22, borderRadius: 6, border: `1px solid ${theme.border}`,
            background: theme.surface, color: theme.textMuted, cursor: 'pointer',
            fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 12,
          }}>+</button>
        )}
        {puedeEditar && (
          <button onClick={() => onEliminarLinea && onEliminarLinea(linea.id)} style={{
            width: 22, height: 22, borderRadius: 999, border: 'none',
            background: 'transparent', color: theme.textSubtle, cursor: 'pointer', marginLeft: 4, fontSize: 12,
          }} title="Quitar">×</button>
        )}
      </div>
    </div>
  );
}
