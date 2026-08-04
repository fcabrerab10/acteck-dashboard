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
    // Facturación por cliente (hoja "Venta Piezas" del Excel ERP) —
    // fuente REAL de todos los clientes (Steren, Office Depot, DAP…)
    // usada en el drill del S&OP.
    facturacion: [],
    // Fase 3 · logística por contenedor (hoja "Programación Arribos" del
    // Master Embarques). Mapa contenedor → detalle logístico.
    progArribos: [],
    // Fase 3 · catálogo maestro de artículos para completar descripciones.
    catalogoArticulos: [],
    // Fase 4 · configuración por SKU (crítico, meses seguridad, %crecimiento
    // override) para el cálculo del sugerido de compra.
    skuConfig: [],
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
        .select('po, codigo, fecha_emision, arribo_cedis, arribo_almacen, eta_puerto, etd, po_qty, shp_qty, cbm, cbm_total, cbm_unitario, contenedor, estatus, supplier, familia, descripcion, unit_price, sn, lt_dias, tipo_carga, tipo_contenedor')),
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
      // Facturación por cliente REAL desde hoja "Venta Piezas" del ERP.
      // Incluye TODOS los clientes (Steren, Office Depot, DAP, etc.) con su
      // canal. Ya viene con devoluciones aplicadas — no necesita filtro.
      fetchAll(() => supabase.from('facturacion_clientes')
        .select('sku, cliente_nombre, canal, anio, mes, piezas')
        .gte('anio', anioCorte)),
      // Fase 3 · logística por contenedor (Master Embarques · hoja
      // "Programación Arribos"). Enriquece los embarques en el drill.
      supabase.from('programacion_arribos')
        .select('contenedor, terminal, cita, arribo_almacen, linea_transportista, dias_demoras, cedis, reconocimiento_a, profepa'),
      // Fase 3 · catálogo maestro de artículos — fallback de descripción
      // cuando v_sku_metadata / roadmap no lo tienen.
      fetchAll(() => supabase.from('catalogo_articulos').select('articulo, descripcion')),
      // Fase 4 · overrides por SKU para el sugerido (crítico, meses seguridad,
      // crecimiento manual). Tabla puede no existir aún — silencia el error.
      supabase.from('sku_config').select('sku, es_critico, meses_seguridad, crecimiento_override, notas')
        .then(r => r, () => ({ data: [] })),
    ]);

    const [invRes, traRes, ltRes, metaRes, demData, sugRes, rmRes, embData, solRes, solLinRes, rsRes, cmRes, facData, paRes, catArtData, skuCfgRes] = queries;

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
      facturacion:   facData      || [],
      progArribos:   (paRes && paRes.data) || [],
      catalogoArticulos: catArtData || [],
      skuConfig:     (skuCfgRes && skuCfgRes.data) || [],
    });
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);
  return { ...state, reload };
}

// ────────── Cálculo del forecast ──────────
function calcularForecast(data, horizonteMeses) {
  const { inventario, transito, leadTimes, metadata, demanda, roadmap, embarques, reporteSkus, facturacion, progArribos, catalogoArticulos, skuConfig } = data;

  // Fase 3 · lookups de enriquecimiento.
  const progByContainer = {};
  (progArribos || []).forEach((p) => {
    if (!p || !p.contenedor) return;
    progByContainer[p.contenedor.trim()] = p;
  });
  const catalogoBySku = {};
  (catalogoArticulos || []).forEach((c) => {
    if (!c || !c.articulo) return;
    catalogoBySku[c.articulo.trim().toUpperCase()] = c;
  });
  // Fase 4 · overrides por SKU (crítico, meses seguridad, %crecimiento).
  const cfgBySku = {};
  (skuConfig || []).forEach((c) => {
    if (!c || !c.sku) return;
    cfgBySku[c.sku.trim()] = c;
  });

  // ── Demanda por cliente REAL desde facturacion_clientes (hoja "Venta Piezas") ──
  // Agrupa: sku → cliente_nombre → { canal, mensual: {"YYYY-M": piezas} }
  // Recolecta los últimos 6 meses; los últimos 3 se usan para el KPI de
  // demanda promedio y días de inventario, los 6 se muestran en la tabla
  // histórica del drill.
  const hoyRef = new Date();
  const mesesRef6 = []; // los 6 meses de referencia [más viejo → más nuevo]
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoyRef.getFullYear(), hoyRef.getMonth() - i, 1);
    mesesRef6.push({ anio: d.getFullYear(), mes: d.getMonth() + 1, key: `${d.getFullYear()}-${d.getMonth() + 1}` });
  }
  const set6 = new Set(mesesRef6.map(m => m.key));
  const setUlt3 = new Set(mesesRef6.slice(-3).map(m => m.key));

  const demandaErpBySku = {};
  (facturacion || []).forEach((row) => {
    const key = `${row.anio}-${row.mes}`;
    if (!set6.has(key)) return;
    const sku = String(row.sku || '').trim();
    if (!sku) return;
    const cliente = String(row.cliente_nombre || '').trim() || 'SIN CLIENTE';
    const piezas = Number(row.piezas || 0);
    if (piezas <= 0) return;
    if (!demandaErpBySku[sku]) demandaErpBySku[sku] = {};
    if (!demandaErpBySku[sku][cliente]) {
      demandaErpBySku[sku][cliente] = { canal: row.canal || '', mensual: {} };
    }
    const entry = demandaErpBySku[sku][cliente];
    entry.mensual[key] = (entry.mensual[key] || 0) + piezas;
    if (row.canal && !entry.canal) entry.canal = row.canal;
  });

  // Fix crítico: v_inventario_comercial puede devolver múltiples filas por SKU
  // (una por almacén). Agregamos manualmente para no perder stock de los demás
  // almacenes cuando Object.fromEntries colapsa por key duplicada.
  const invBySku = {};
  (inventario || []).forEach((r) => {
    if (!r || !r.sku) return;
    if (!invBySku[r.sku]) {
      invBySku[r.sku] = { ...r, disponible: 0, inventario: 0 };
    }
    invBySku[r.sku].disponible += Number(r.disponible || 0);
    invBySku[r.sku].inventario += Number(r.inventario || 0);
  });
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
    if (!cnt || cnt.toUpperCase() === 'PENDIENTE' || cnt.toUpperCase().startsWith('PEND-')) return;
    const sku = (e.codigo || '').trim();
    if (!sku) return;
    if (!skusPorContenedor.has(cnt)) skusPorContenedor.set(cnt, new Set());
    skusPorContenedor.get(cnt).add(sku);
  });
  const contenedorConfirmado = (cnt) => {
    if (!cnt) return false;
    const t = cnt.toString().trim().toUpperCase();
    // 'PEND-...' es el placeholder que emite el uploader cuando el contenedor
    // aún no se asigna (soporta POs partidas en varios shipments pendientes).
    return t && t !== 'PENDIENTE' && !t.startsWith('PEND-');
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

    // Helper: piezas EN ESE SHIPMENT/CONTENEDOR concreto — NO el total de la PO.
    // Una PO se puede partir en varios shipments (ej. PO=1000 en 2 contenedores
    // de 500 cada uno). shp_qty refleja lo que va en ESE embarque; po_qty es
    // el total de la PO original. Usar shp_qty es correcto para "pzs/contenedor";
    // fallback a po_qty si shp_qty viene null/0.
    const shpQty = (e) => {
      const s = Number(e.shp_qty || 0);
      return s > 0 ? s : Number(e.po_qty || 0);
    };

    // Última PO (cualquiera, aunque su contenedor esté pendiente) — info
    // visual del modal.
    const ult = ordenadas[0];
    if (ult) {
      const cntId = (ult.contenedor || '').toString().trim();
      const cntConf = contenedorConfirmado(cntId);
      info.ultimaCompra = {
        fecha: ult.fecha_emision || null,
        piezas: shpQty(ult),
        contenedor: cntConf ? cntId : null,
        contenedorPendiente: !cntConf,
        esConsolidado: cntConf && contenedorEsConsolidado(cntId),
        costoUsd: Number(ult.unit_price || 0),
        po: ult.po,
        sn: ult.sn || null,
        tipoCarga: ult.tipo_carga || null,
        tipoContenedor: ult.tipo_contenedor || null,
        cbmUnitario: Number(ult.cbm_unitario || 0),
        ltDeclarado: Number(ult.lt_dias || 0),
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
      // pzs/contenedor = shp_qty de la última PO NO consolidada. Si la última
      // confirmada fue consolidada, se busca hacia atrás.
      if (!info.esConsolidado && shpQty(ultConf) > 0) {
        info.piezasPorContenedor = Math.round(shpQty(ultConf));
      } else {
        const ultNoConsol = ordenadas.find((e) => {
          const c = (e.contenedor || '').toString().trim();
          return contenedorConfirmado(c) && !contenedorEsConsolidado(c) && shpQty(e) > 0;
        });
        if (ultNoConsol) {
          info.piezasPorContenedor = Math.round(shpQty(ultNoConsol));
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
    const embarquesBase = Array.isArray(tra?.embarques_detalle) ? tra.embarques_detalle : [];
    // Enriquecer cada embarque con la logística por contenedor (Fase 3).
    const embarques = embarquesBase.map((e) => {
      const cnt = (e.contenedor || '').toString().trim();
      const p = cnt ? progByContainer[cnt] : null;
      return p ? { ...e, prog: p } : e;
    });
    const traDentroHor = embarques.reduce((a, e) => {
      const eta = e.eta ? new Date(e.eta) : null;
      if (!eta) return a;
      return eta <= horizonteLimite ? a + Number(e.cantidad || 0) : a;
    }, 0);
    const traDespuesHor = traCant - traDentroHor;

    // ═══ Sugerido de compra · Fase 4 · fórmula nueva ═══
    // Reemplaza el cálculo anterior basado en (digitalife + pcel × horizonte)
    // por uno basado en TODOS los clientes del ERP (facturacion_clientes) con:
    //   · ritmo mensual real ERP (últimos 3m promedio)
    //   · crecimiento auto-calculado (últ 3m vs 3m anteriores), cap 40%
    //     override manual desde sku_config
    //   · meses de seguridad extra si el SKU está marcado como crítico
    //   · tránsito: sólo lo que cae en los 3 meses objetivo (opción B)
    //   · redondeo contenedor: >50% → ceil, ≤50% → floor
    const bySkuErpS = demandaErpBySku[sku] || {};
    // ritmo3m = suma últimos 3 meses / 3 (ya está como demandaMesErp más abajo,
    // pero necesitamos calcularlo aquí antes)
    let sum3m = 0, sum3mAnt = 0;
    const keys6 = mesesRef6.map(m => m.key);
    const keysUlt3 = keys6.slice(-3);   // los 3 más recientes
    const keys3Ant = keys6.slice(0, 3); // los 3 anteriores
    Object.values(bySkuErpS).forEach((v) => {
      for (const k of keysUlt3) sum3m += Number(v.mensual[k] || 0);
      for (const k of keys3Ant) sum3mAnt += Number(v.mensual[k] || 0);
    });
    const ritmo3m = sum3m / 3;
    const ritmo3mAnt = sum3mAnt / 3;
    // Config del SKU
    const cfg = cfgBySku[sku] || {};
    const esCritico = !!cfg.es_critico;
    const mesesSeguridad = esCritico ? Math.max(0, Number(cfg.meses_seguridad || 0)) : 0;
    // Crecimiento: override manual o auto-calculado desde tendencia
    let crecimiento;
    if (cfg.crecimiento_override != null) {
      crecimiento = Math.max(0, Math.min(0.40, Number(cfg.crecimiento_override)));
    } else if (ritmo3mAnt > 0) {
      const diff = (ritmo3m - ritmo3mAnt) / ritmo3mAnt;
      crecimiento = Math.max(0, Math.min(0.40, diff));   // sin negativos, cap 40%
    } else {
      crecimiento = 0;
    }
    // Objetivo 3 meses + crecimiento + seguridad
    const demanda3m = ritmo3m * 3;
    const objetivo = demanda3m * (1 + crecimiento) + ritmo3m * mesesSeguridad;
    // Necesidad: resta inventario + tránsito DENTRO del horizonte 3m
    const horizonte3m = new Date(hoy); horizonte3m.setMonth(horizonte3m.getMonth() + 3);
    const tra3m = embarques.reduce((a, e) => {
      const eta = e.eta ? new Date(e.eta) : null;
      if (!eta) return a;
      return eta <= horizonte3m ? a + Number(e.cantidad || 0) : a;
    }, 0);
    const necesidad = Math.max(0, objetivo - inv - tra3m);
    // Umbral 50% — reglas de sugerido:
    //   · Contenedor propio: necesidad > 50% del pz_por_cnt → ceil (contenedor
    //     completo). Si ≤ 50% → sugerido = 0 (no vale la pena pedir < ½ cnt).
    //   · Consolidado: necesidad > 50% del promedio de PO histórica → piezas
    //     exactas. Si ≤ 50% → sugerido = 0.
    const compraInfo = comprasBySku[sku] || {};
    const piezasPorContenedor = compraInfo.piezasPorContenedor || 0;
    const esConsolidado = !!compraInfo.esConsolidado;
    let sugerido = 0;
    let contenedoresSugeridos = 0;
    if (necesidad > 0 && !esConsolidado && piezasPorContenedor > 0) {
      const prop = necesidad / piezasPorContenedor;
      if (prop > 0.5) {
        contenedoresSugeridos = Math.ceil(prop);
        sugerido = contenedoresSugeridos * piezasPorContenedor;
      } // ≤ 0.5 → sugerido queda en 0
    } else if (necesidad > 0 && esConsolidado) {
      // Promedio de shp_qty histórico del SKU como referencia de "una PO típica".
      const posValidas = (compraInfo.pos || []).filter((e) => {
        const shp = Number(e.shp_qty || 0) || Number(e.po_qty || 0);
        return shp > 0;
      });
      const promPoRef = posValidas.length > 0
        ? posValidas.reduce((a, e) => a + (Number(e.shp_qty || 0) || Number(e.po_qty || 0)), 0) / posValidas.length
        : 0;
      if (promPoRef > 0 && necesidad / promPoRef > 0.5) {
        sugerido = necesidad; // piezas exactas (consolidado no se rellena a cnt)
      } // ≤ 0.5 o sin histórico → sugerido queda en 0
    }
    // Notas visuales (sólo informativas — nunca ajustan el número)
    const tendenciaNegativa = ritmo3mAnt > 0 && ritmo3m < ritmo3mAnt;
    // brecha para el histórico (para "SKUs con brecha" en el hero editorial)
    const brecha = Math.max(0, objetivo - inv - tra3m);
    // Compat: preservamos bufferUnidades para exportar si alguien lo consume,
    // pero ya no interviene en el sugerido.
    const bufferUnidades = ritmo3m * BUFFER_MESES;

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
    const descripcion = rm.descripcion || meta.descripcion
      || (catalogoBySku[sku.toUpperCase()]?.descripcion) || '';
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

    // Demanda REAL últimos 3 meses (todos los clientes ERP) — para KPIs y
    // cobertura en el drill. Usa facturacion_clientes que sí trae Steren,
    // Office Depot, DAP, etc. (no solo digi+pcel).
    let totalErp3m = 0;
    const bySkuErp = demandaErpBySku[sku] || {};
    Object.values(bySkuErp).forEach((v) => {
      for (const k of setUlt3) totalErp3m += Number(v.mensual[k] || 0);
    });
    const demandaMesErp = totalErp3m / 3;
    const coberturaDiasErp = demandaMesErp > 0 ? Math.round(inv / (demandaMesErp / 30)) : null;

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
      // Demanda REAL de todos los clientes ERP (últimos 3 meses promedio)
      demandaMesErp,
      coberturaDiasErp,
      // Consumo por cliente REAL del ERP · mensual (6 meses) + agregados
      demandaPorClienteErp: (() => {
        const bySku = demandaErpBySku[sku] || {};
        const entries = Object.entries(bySku);
        if (entries.length === 0) return [];
        const items = entries.map(([cliente, v]) => {
          const mensual = mesesRef6.map((m) => ({
            anio: m.anio, mes: m.mes, key: m.key, piezas: Number(v.mensual[m.key] || 0),
          }));
          const total6m = mensual.reduce((a, x) => a + x.piezas, 0);
          const total3m = mensual.slice(-3).reduce((a, x) => a + x.piezas, 0);
          return {
            cliente,
            canal: v.canal || '',
            mensual,
            total6m,
            prom6m: total6m / 6,
            ritmoMes3m: total3m / 3, // usado para % de participación y cobertura
          };
        });
        const totalRitmo3m = items.reduce((a, x) => a + x.ritmoMes3m, 0);
        items.forEach((it) => { it.pct = totalRitmo3m > 0 ? (it.ritmoMes3m / totalRitmo3m) * 100 : 0; });
        return items.sort((a, b) => b.total6m - a.total6m);
      })(),
      // Concentración alta: el cliente dominante concentra >40% del ritmo Y
      // su tendencia últimos 3m vs 3m anteriores es +20%.
      concentracionAlta: (() => {
        const bySku = demandaErpBySku[sku] || {};
        const entries = Object.entries(bySku);
        if (entries.length === 0) return null;
        // Recomputar ranking simple para no depender del IIFE anterior
        const items = entries.map(([cliente, v]) => {
          const total3m = mesesRef6.slice(-3).reduce((a, m) => a + Number(v.mensual[m.key] || 0), 0);
          const total3mAnt = mesesRef6.slice(0, 3).reduce((a, m) => a + Number(v.mensual[m.key] || 0), 0);
          return { cliente, ritmo3m: total3m / 3, ritmo3mAnt: total3mAnt / 3 };
        });
        const total = items.reduce((a, x) => a + x.ritmo3m, 0);
        if (total <= 0) return null;
        items.forEach((it) => { it.pct = (it.ritmo3m / total) * 100; });
        items.sort((a, b) => b.ritmo3m - a.ritmo3m);
        const top = items[0];
        if (top.pct <= 40) return null;
        const tendPct = top.ritmo3mAnt > 0 ? ((top.ritmo3m - top.ritmo3mAnt) / top.ritmo3mAnt) * 100 : 0;
        if (tendPct < 20) return null;
        return { cliente: top.cliente, pct: Math.round(top.pct), tendPct: Math.round(tendPct) };
      })(),
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
      // ═══ Fase 4 · metadata del sugerido ═══
      ritmo3m,
      ritmo3mAnt,
      crecimientoPct: crecimiento,                    // 0..0.40
      crecimientoCap: crecimiento === 0.40,           // true si topó al 40%
      esCritico,
      mesesSeguridad,
      objetivo3m: Math.round(objetivo),
      necesidadNeta: Math.round(necesidad),
      tendenciaNegativa,
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
  // Filtro "solo SKUs con sugerido de compra > 0" (Fase 4)
  const [soloConSugerido, setSoloConSugerido] = useState(false);
  // Flag para bloquear la UI mientras se agregan masivamente
  const [agregandoTodos, setAgregandoTodos] = useState(false);
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

  // Agregar TODOS los SKUs con sugerido > 0 al borrador activo (Fase 4).
  // Salta los que ya están en el borrador. Muestra progress + toast final.
  const agregarTodosSugeridos = async () => {
    if (!puedeEditarSol) {
      toast.error('No tienes permiso para agregar al export.');
      return;
    }
    const candidatos = rowsAll.filter((r) => Number(r.sugerido || 0) > 0);
    if (candidatos.length === 0) {
      toast('No hay SKUs con sugerido de compra.', { icon: 'ℹ️' });
      return;
    }
    // SKUs ya en el borrador activo — se saltan
    const yaEnExport = new Set((lineasBorrador || []).map((l) => l.sku));
    const nuevos = candidatos.filter((r) => !yaEnExport.has(r.sku));
    const skipped = candidatos.length - nuevos.length;
    if (nuevos.length === 0) {
      toast(`Los ${candidatos.length} sugeridos ya están en Mi Export.`, { icon: 'ℹ️' });
      return;
    }
    const totalUsd = nuevos.reduce((a, r) => a + (Number(r.sugerido || 0) * Number(r.ultimoCostoUsd || r.costoUnitUsd || 0)), 0);
    const totalPz = nuevos.reduce((a, r) => a + Number(r.sugerido || 0), 0);
    const ok = window.confirm(
      `Agregar ${nuevos.length} SKUs al export activo?\n\n` +
      `· Total piezas: ${FMT_N(totalPz)}\n` +
      `· Total USD estimado: $${FMT_N(totalUsd)}\n` +
      (skipped > 0 ? `· ${skipped} ya estaban en el export (se omiten)\n` : '')
    );
    if (!ok) return;
    setAgregandoTodos(true);
    try {
      // Borrador a usar
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
      let okCount = 0, errCount = 0;
      for (const row of nuevos) {
        const cantidad = Number(row.sugerido || 0);
        const ppc = Number(row.piezasPorContenedor || 0);
        const cnts = ppc > 0 ? Math.ceil(cantidad / ppc) : null;
        let fechaEstimada = null;
        if (row.ltDias && row.ltDias > 0) {
          const d = new Date(); d.setDate(d.getDate() + Math.round(row.ltDias));
          fechaEstimada = d.toISOString().slice(0, 10);
        }
        try {
          const linea = await sol.agregarLinea(solicitudId, {
            sku: row.sku,
            descripcion: row.descripcion,
            cantidad,
            proveedor: row.supplier || '',
            fecha_estimada: fechaEstimada,
            ultimo_costo_usd: row.ultimoCostoUsd || row.costoUnitUsd || null,
            piezas_por_contenedor: ppc || null,
            contenedores: cnts,
            es_consolidado: !!row.esConsolidado,
          });
          if (linea && linea.id) okCount++; else errCount++;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[Forecast] error agregando ${row.sku}`, err);
          errCount++;
        }
      }
      if (okCount > 0) toast.success(`✓ ${okCount} SKUs agregados al export activo`);
      if (errCount > 0) toast.error(`${errCount} SKUs no se pudieron agregar`);
    } finally {
      setAgregandoTodos(false);
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
      if (soloConSugerido && !(Number(r.sugerido || 0) > 0)) return false;
      return true;
    });
  }, [rowsAll, busqueda, filtroSupplier, filtroFamilia, filtroCliente, filtroFlag, soloConSugerido]);

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
      // Enriquecer líneas con contenedores frescos calculados desde el motor
      // actual (usa shp_qty vía compraInfo.piezasPorContenedor). Las líneas
      // guardadas en BD pueden tener contenedores/piezas_por_contenedor
      // obsoletos si se agregaron antes del fix de shp_qty — aquí los
      // recalculamos sin persistir. La cantidad de piezas se respeta
      // (elección explícita del usuario).
      const rowsBySku = Object.fromEntries((rowsAll || []).map((r) => [r.sku, r]));
      const lineasFrescas = lineasBorrador.map((l) => {
        const r = rowsBySku[l.sku];
        if (!r) return l;
        const pzCntFresh = Number(r.piezasPorContenedor || 0);
        const esConsolFresh = !!r.esConsolidado;
        const cantidad = Number(l.cantidad || 0);
        const cntsFresh = (pzCntFresh > 0 && !esConsolFresh)
          ? Math.ceil(cantidad / pzCntFresh)
          : null;
        return {
          ...l,
          piezas_por_contenedor: pzCntFresh || l.piezas_por_contenedor,
          contenedores: cntsFresh != null ? cntsFresh : l.contenedores,
          es_consolidado: esConsolFresh,
        };
      });
      const filename = await exportarSolicitudExcel(borradorActivo, lineasFrescas);
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
          {/* Stats 2x2 · el selector de horizonte fue eliminado; el sugerido
              siempre se calcula sobre 3 meses (regla fija de la fórmula). */}
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

            {/* Toggle · solo con sugerido */}
            {(() => {
              const nSugeridos = rowsAll.filter((r) => Number(r.sugerido || 0) > 0).length;
              return (
                <button
                  onClick={() => setSoloConSugerido((v) => !v)}
                  disabled={nSugeridos === 0}
                  title={nSugeridos === 0 ? 'No hay SKUs con sugerido' : 'Mostrar solo SKUs con sugerido de compra > 0'}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 999, height: 32,
                    background: soloConSugerido ? theme.accent : (isDark ? 'rgba(10,132,255,0.10)' : 'rgba(0,122,255,0.06)'),
                    color: soloConSugerido ? '#FFF' : theme.accent,
                    border: `1px solid ${soloConSugerido ? theme.accent : (isDark ? 'rgba(10,132,255,0.20)' : 'rgba(0,122,255,0.15)')}`,
                    fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, letterSpacing: '-0.005em',
                    cursor: nSugeridos === 0 ? 'not-allowed' : 'pointer',
                    opacity: nSugeridos === 0 ? 0.45 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {soloConSugerido ? '✓ ' : ''}Solo con sugerido
                  <span style={{ opacity: .8, fontWeight: 500 }}>({nSugeridos})</span>
                </button>
              );
            })()}

            {/* Botón · agregar todos al export */}
            {puedeEditarSol && (() => {
              const nSugeridos = rowsAll.filter((r) => Number(r.sugerido || 0) > 0).length;
              return (
                <button
                  onClick={agregarTodosSugeridos}
                  disabled={nSugeridos === 0 || agregandoTodos}
                  title={nSugeridos === 0 ? 'No hay SKUs con sugerido' : `Agregar ${nSugeridos} SKUs sugeridos al export activo`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 999, height: 32,
                    background: nSugeridos === 0 ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)') : theme.green,
                    color: nSugeridos === 0 ? theme.textMuted : '#FFF',
                    border: 0,
                    fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, letterSpacing: '-0.005em',
                    cursor: (nSugeridos === 0 || agregandoTodos) ? 'not-allowed' : 'pointer',
                    opacity: (nSugeridos === 0 || agregandoTodos) ? 0.55 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {agregandoTodos ? '⏳ Agregando…' : `＋ Agregar todos al export (${nSugeridos})`}
                </button>
              );
            })()}

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
              isDark={isDark}
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
              <SortHeader theme={theme} width={22} />
              <SortHeader theme={theme} col="sku" label="SKU" width={95} onSort={onSort} sortCol={sortCol} sortDir={sortDir} />
              <SortHeader theme={theme} label="Descripción" />
              <SortHeader theme={theme} col="rdmp" label="Roadmap" width={70} align="center" />
              <SortHeader theme={theme} col="inv" label="Inv" width={64} align="right" onSort={onSort} sortCol={sortCol} sortDir={sortDir} />
              <SortHeader theme={theme} col="traCant" label="Tránsito" width={64} align="right" onSort={onSort} sortCol={sortCol} sortDir={sortDir} />
              <SortHeader theme={theme} col="traEta" label="Próx arribo" width={82} align="right" onSort={onSort} sortCol={sortCol} sortDir={sortDir} />
              <SortHeader theme={theme} col="demandaMesErp" label="Dem 3m" width={78} align="right" onSort={onSort} sortCol={sortCol} sortDir={sortDir} />
              <SortHeader theme={theme} col="coberturaDiasErp" label="Días inv" width={72} align="center" onSort={onSort} sortCol={sortCol} sortDir={sortDir} />
              <SortHeader theme={theme} col="sugerido" label="Sugerido de compra" width={140} align="right" onSort={onSort} sortCol={sortCol} sortDir={sortDir} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={10} style={{ padding: '32px 16px', textAlign: 'center', color: theme.textMuted, fontSize: 11.5 }}>Sin resultados con los filtros actuales</td></tr>
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

// ────────── Sugerido de Compra · celda ──────────
// Píldora azul (agregar) / verde (edit) / gris (sin brecha) + sub-línea
// explicativa + notas visuales pequeñas (⭐ crítico · ↓ tendencia · ⚡ conc).
function SugeridoCompraCell({ r, enExport, cantidadEnExport, onAgregarSolicitud, theme, isDark }) {
  const sug = Number(r.sugerido || 0);
  const cnt = Number(r.contenedoresSugeridos || 0);
  const crecPct = Math.round(Number(r.crecimientoPct || 0) * 100);
  const seg = Number(r.mesesSeguridad || 0);
  const conc = r.concentracionAlta || null;
  const tendNeg = !!r.tendenciaNegativa;
  const critico = !!r.esCritico;
  const cap = !!r.crecimientoCap;

  // Sin brecha y no está en export → celda vacía (limpieza visual).
  if (sug <= 0 && !enExport) return null;

  let btnLabel, btnBg, btnColor;
  if (enExport) {
    btnBg = theme.green || '#34C759';
    btnColor = '#fff';
    btnLabel = `✓ ${FMT_N(cantidadEnExport)} pz`;
  } else {
    btnBg = theme.accent || '#007AFF';
    btnColor = '#fff';
    btnLabel = cnt > 0 ? `＋ ${cnt} cnt · ${FMT_N(sug)} pz` : `＋ ${FMT_N(sug)} pz`;
  }

  // Sub-línea explicativa
  let sub = '';
  if (enExport) sub = `en Mi Export`;
  else {
    const parts = [];
    if (crecPct > 0) parts.push(`+${crecPct}%${cap ? ' cap' : ''}`);
    parts.push(`3m${seg > 0 ? ` + ${seg}m seg` : ''}`);
    sub = parts.join(' · ');
  }

  const tieneNotas = critico || tendNeg || conc;
  return (
    // Alineado a la derecha del td · notas horizontal a la IZQUIERDA de la
    // píldora (no bajo, no columna) — así todas las filas tienen la misma
    // altura (2 líneas: píldora + sub) sin importar cuántas notas haya.
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
    }}>
      {tieneNotas && (
        <div style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
          {critico && <SugNota kind="crit" theme={theme} tip="SKU crítico · no puede faltar" />}
          {tendNeg && <SugNota kind="tend" theme={theme}
            tip={`Consumo bajando · últ 3m ${FMT_N(Math.round(r.ritmo3m))} pz/m vs 3m ant ${FMT_N(Math.round(r.ritmo3mAnt))} pz/m`} />}
          {conc && <SugNota kind="conc" theme={theme}
            tip={`Concentración alta: ${conc.cliente} = ${conc.pct}% del consumo con tendencia +${conc.tendPct}% vs 3m ant`} />}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onAgregarSolicitud) onAgregarSolicitud(r);
          }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 11px', borderRadius: 999,
            background: btnBg, color: btnColor, border: 0,
            fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600,
            letterSpacing: '-0.01em', cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1.2,
            transition: 'transform 120ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          title={enExport
            ? `En Mi Export con ${FMT_N(cantidadEnExport)} pz — click para editar`
            : `Sugerido: ${FMT_N(sug)} pz (${cnt} cnt) — click para agregar`}
        >
          {btnLabel}
        </button>
        <div style={{
          fontFamily: TYPO.fontText, fontSize: 9.5, color: theme.textMuted,
          fontWeight: 500, letterSpacing: '-0.005em', lineHeight: 1.1,
          paddingRight: 4,
        }}>
          {sub}
        </div>
      </div>
    </div>
  );
}

function SugNota({ kind, theme, tip }) {
  const map = {
    crit: { bg: 'rgba(255,204,0,0.18)', color: '#B8860B', ch: '⭐' },
    tend: { bg: 'rgba(255,45,85,0.16)',  color: theme.pink || '#FF2D55', ch: '↓' },
    conc: { bg: 'rgba(0,122,255,0.14)',  color: theme.accent || '#007AFF', ch: '⚡' },
  };
  const s = map[kind] || map.crit;
  return (
    <span title={tip} style={{
      width: 16, height: 16, borderRadius: '50%',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: s.bg, color: s.color, fontSize: 9, fontWeight: 700,
      cursor: 'help', userSelect: 'none',
    }}>{s.ch}</span>
  );
}

// ────────── Row ──────────
function ForecastRow({ r, expanded, onToggle, onAgregarSolicitud, enExport, cantidadEnExport, theme, isDark }) {
  const cellS = { padding: '7px 10px', fontSize: 12, color: theme.text, fontFamily: TYPO.fontText, verticalAlign: 'middle' };
  const numS = { ...cellS, fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 11.5, textAlign: 'right' };
  const boldS = { ...cellS, fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 12.5, letterSpacing: '-0.01em', textAlign: 'right' };
  const rowBg = expanded ? (isDark ? 'rgba(10,132,255,0.08)' : 'rgba(0,122,255,0.04)') :
                enExport ? 'rgba(52,199,89,0.05)' : 'transparent';
  const MES_CORTO_TABLE = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const fmtEtaCorta = (iso) => {
    if (!iso) return null;
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return `${d} ${MES_CORTO_TABLE[m - 1]} ${String(y).slice(2)}`;
  };
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
        <td style={{ ...cellS, fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 11, color: theme.accent, fontWeight: 600 }}>{r.sku}</td>
        <td style={{ ...cellS, maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descripcion}>{r.descripcion || '—'}</td>
        <td style={{ ...cellS, textAlign: 'center' }}><RoadmapChip estado={r.roadmapEstado} theme={theme} /></td>
        <td style={numS}>{FMT_N(r.inv)}</td>
        <td style={numS}>{r.traCant > 0 ? FMT_N(r.traCant) : <span style={{ color: theme.textSubtle }}>—</span>}</td>
        <td style={{ ...cellS, textAlign: 'right', fontFamily: TYPO.fontText, fontSize: 11.5, color: r.traEta ? theme.text : theme.textSubtle }}>
          {r.traEta ? fmtEtaCorta(r.traEta) : 'sin OC'}
        </td>
        <td style={numS}>{FMT_N(r.demandaMesErp)}<span style={{ color: theme.textMuted, marginLeft: 3, fontSize: 10 }}>pz/m</span></td>
        <td style={{ ...cellS, textAlign: 'center' }}><CoberturaChip dias={r.coberturaDiasErp} theme={theme} /></td>
        <td style={{ ...cellS, textAlign: 'right', padding: '6px 10px' }}>
          <SugeridoCompraCell
            r={r}
            enExport={enExport}
            cantidadEnExport={cantidadEnExport}
            onAgregarSolicitud={onAgregarSolicitud}
            theme={theme}
            isDark={isDark}
          />
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={10} style={{ padding: 0, background: theme.surface, borderTop: `1px solid ${theme.divider || theme.border}`, borderBottom: `1px solid ${theme.divider || theme.border}` }}>
            <ExpandedDetail r={r} theme={theme} isDark={isDark} onAgregarSolicitud={onAgregarSolicitud} enExport={enExport} cantidadEnExport={cantidadEnExport} />
          </td>
        </tr>
      )}
    </>
  );
}


// ────────── Drill inline (patrón Sell Out Dicotech) ──────────
function ExpandedDetail({ r, theme, isDark, onAgregarSolicitud, enExport, cantidadEnExport }) {
  const MES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const fmtFechaC = (iso) => {
    if (!iso) return '—';
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return `${d} ${MES_CORTO[m - 1]} ${String(y).slice(2)}`;
  };
  // Simulador what-if: cantidad a comprar (inicia con lo del export si ya existe,
  // sino con el sugerido, sino con 1 contenedor)
  const cntPz = Number(r.piezasPorContenedor || 0);
  const qtyInicial = Number(cantidadEnExport || r.sugerido || cntPz || 0);
  const [qty, setQty] = useState(qtyInicial);
  useEffect(() => { setQty(qtyInicial); /* eslint-disable-next-line */ }, [r.sku, cantidadEnExport]);
  // Toggle para expandir/colapsar los clientes "menores" (fila agregada
  // debajo del top-8 en la tabla histórica).
  const [mostrarOtros, setMostrarOtros] = useState(false);

  // Cálculos derivados en vivo — usa demanda REAL del ERP (todos los clientes)
  const costoUnit = Number(r.ultimoCostoUsd || 0);
  const usdComprometido = qty * costoUnit;
  const demandaMesTotalReal = Number(r.demandaMesErp || 0);
  const demDia = demandaMesTotalReal / 30;
  const cobHoy = demDia > 0 ? r.inv / demDia : null;
  const cobPost = demDia > 0 ? (r.inv + qty) / demDia : null;
  const gananciaDias = (cobPost != null && cobHoy != null) ? cobPost - cobHoy : null;
  const ltDias = Number(r.ltDias || 0);
  const diasParaProxOc = cobPost != null ? Math.max(0, cobPost - ltDias) : null;
  const proxOcFecha = diasParaProxOc != null
    ? new Date(Date.now() + diasParaProxOc * 86400000)
    : null;
  const proxOcLabel = proxOcFecha
    ? `${MES_CORTO[proxOcFecha.getMonth()]} ${proxOcFecha.getFullYear()}`
    : '—';

  // Clientes REALES del ERP · usados en la tabla histórica mensual y para
  // el contador del subtítulo de la Demanda 3m en el KPI strip.
  const CLIENTE_COLORS = [
    theme.accent, theme.purple || '#AF52DE', theme.teal || '#5AC8FA',
    theme.orange || '#FF9500', theme.pink || '#FF2D55', theme.indigo || '#5856D6',
    theme.yellow || '#FFCC00', theme.green || '#34C759', theme.red || '#FF3B30',
  ];
  const erpClientes = Array.isArray(r.demandaPorClienteErp) ? r.demandaPorClienteErp : [];

  // Presets del simulador (múltiplos de contenedor)
  const presets = cntPz > 0
    ? [0, cntPz, cntPz * 2, cntPz * 3]
    : [0, 500, 1000, 2000];
  const presetLabels = cntPz > 0
    ? ['0', '1 cnt', '2 cnt', '3 cnt']
    : ['0', '500 pz', '1,000 pz', '2,000 pz'];

  // Confirmar (agregar/editar en export)
  const onConfirmar = () => {
    if (!onAgregarSolicitud) return;
    // Inyectamos la cantidad simulada al row antes de pasar al handler
    onAgregarSolicitud({ ...r, __qtySimulada: qty });
  };

  // Estilos comunes
  const cardStyle = {
    background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '10px 14px',
  };
  const cardMd = { ...cardStyle, padding: '12px 16px' };
  const cH = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, marginBottom: 8 };
  const cHt = { fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, margin: 0 };
  const cHsub = { fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textMuted, marginTop: 1, letterSpacing: '-0.005em' };
  const cHaside = { fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, fontVariantNumeric: 'tabular-nums' };
  const semGreen = '#1C7A34';

  return (
    <div
      style={{
        padding: 10,
        background: theme.bg || (isDark ? '#000' : '#F5F5F7'),
        display: 'flex', flexDirection: 'column', gap: 8,
        // Animación de apertura estilo iOS · curve estándar Apple
        animation: 'sopDrillOpen 340ms cubic-bezier(0.32, 0.72, 0, 1) both',
        transformOrigin: 'top',
        overflow: 'hidden',
      }}
    >
      {/* Keyframes inyectadas — React de-dup el <style> tag repetido */}
      <style>{`
        @keyframes sopDrillOpen {
          0%   { opacity: 0; max-height: 0;    transform: translateY(-6px) scaleY(0.985); }
          50%  { opacity: 1;                                                              }
          100% { opacity: 1; max-height: 3200px; transform: translateY(0)   scaleY(1);    }
        }
      `}</style>

      {/* ═══ HERO card negro compacto ═══ */}
      <div style={{
        background: '#000', color: '#F5F5F7', borderRadius: 10, padding: '12px 16px',
        display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'center',
      }}>
        <div>
          <div style={{
            fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 600, letterSpacing: '0.09em',
            textTransform: 'uppercase', color: 'rgba(245,245,247,0.6)', marginBottom: 3,
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <span>{r.sku}</span>
            <span style={{ width: 4, height: 4, borderRadius: 999, background: 'rgba(245,245,247,0.4)' }} />
            <span>{(r.familia || 'SKU').toUpperCase()}</span>
            {r.roadmapEstado && (
              <>
                <span style={{ width: 4, height: 4, borderRadius: 999, background: '#FF3B30' }} />
                <span>{String(r.roadmapEstado).toUpperCase()}</span>
              </>
            )}
          </div>
          <h3 style={{
            fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em',
            margin: 0, color: '#F5F5F7', lineHeight: 1.2, maxWidth: 640,
          }}>
            {r.descripcion || r.sku}
          </h3>
          <div style={{ fontFamily: TYPO.fontText, fontSize: 11, color: 'rgba(245,245,247,0.6)', marginTop: 4, letterSpacing: '-0.005em' }}>
            {r.marca || 'Sin marca'} · <strong style={{ color: '#F5F5F7', fontWeight: 600 }}>{r.supplier || 'Sin proveedor'}</strong>
            {cntPz > 0 && ` · 1 cnt = ${FMT_N(cntPz)} pz`}
            {costoUnit > 0 && <> · <strong style={{ color: theme.green || '#30D158', fontWeight: 600 }}>${costoUnit.toFixed(2)} USD</strong></>}
          </div>
        </div>
        <button
          onClick={onConfirmar}
          style={{
            padding: '7px 14px', borderRadius: 999,
            background: enExport ? (theme.green || '#30D158') : (theme.accent || '#0A84FF'),
            color: '#fff', border: 0, fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600,
            cursor: 'pointer', letterSpacing: '-0.005em', whiteSpace: 'nowrap',
          }}>
          {enExport ? `✓ En Mi Export · ${FMT_N(cantidadEnExport)} pz` : '＋ Agregar al export'}
        </button>
      </div>

      {/* ═══ KPI strip compacto ═══ */}
      <div style={{ ...cardStyle, padding: '10px 4px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)' }}>
          <MiniKpi label="Inventario"      value={FMT_N(r.inv)}          u="pz"   sub="stock actual" theme={theme} />
          <MiniKpi label="Tránsito"        value={FMT_N(r.traCant)}      u="pz"   sub={r.traCant > 0 ? 'en camino' : 'sin POs'} theme={theme} borderLeft />
          <MiniKpi label="Próximo arribo"  value={r.traEta ? fmtFechaC(r.traEta).split(' ').slice(0, 2).join(' ') : '—'} sub={r.traEta ? 'próxima OC' : 'sin OC'} theme={theme} borderLeft dim={!r.traEta} />
          <MiniKpi label="Demanda 3m"      value={FMT_N(r.demandaMesErp)} u="pz/m" sub={`${erpClientes.length} clientes ERP`} theme={theme} borderLeft />
          <MiniKpi label="Días inv."       value={r.coberturaDiasErp == null ? '∞' : Math.round(r.coberturaDiasErp)} u={r.coberturaDiasErp == null ? '' : 'd'} sub={r.coberturaDiasErp == null ? 'sin demanda' : r.coberturaDiasErp < 30 ? 'crítica' : r.coberturaDiasErp < 60 ? 'tensa' : 'holgura sana'} color={r.coberturaDiasErp == null ? null : r.coberturaDiasErp < 30 ? '#B91C1C' : r.coberturaDiasErp < 60 ? '#B45309' : semGreen} theme={theme} borderLeft />
          <MiniKpi label="Sugerido"        value={r.sugerido > 0 ? FMT_N(r.sugerido) : '—'} u={r.sugerido > 0 ? 'pz' : ''} sub={r.sugerido > 0 ? `${r.contenedoresSugeridos || 1} cnt` : 'sin brecha'} color={r.sugerido > 0 ? '#B45309' : null} theme={theme} borderLeft dim={r.sugerido <= 0} />
        </div>
      </div>

      {/* ═══ BARRA SIMULADOR ═══ */}
      <div style={{
        background: isDark
          ? 'linear-gradient(90deg, rgba(10,132,255,0.08) 0%, rgba(10,132,255,0) 45%), ' + theme.surface
          : 'linear-gradient(90deg, rgba(0,122,255,0.05) 0%, rgba(0,122,255,0) 45%), ' + theme.surface,
        border: `1px solid ${theme.accent}33`, borderRadius: 10, padding: '10px 14px',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'auto auto 1fr auto auto auto auto',
          gap: 14, alignItems: 'center',
        }}>
          {/* Input cantidad */}
          <div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: theme.accent, marginBottom: 3 }}>
              Simulador
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <QtyBtn onClick={() => setQty((q) => Math.max(0, q - (cntPz || 100)))} theme={theme}>−</QtyBtn>
              <input
                type="text"
                value={qty > 0 ? qty.toLocaleString('es-MX') : '0'}
                onChange={(e) => {
                  const raw = String(e.target.value).replace(/[^0-9]/g, '');
                  setQty(raw ? Number(raw) : 0);
                }}
                style={{
                  width: 88, textAlign: 'center', fontFamily: TYPO.fontDisplay, fontSize: 22,
                  fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, fontVariantNumeric: 'tabular-nums',
                  border: 0, background: 'transparent', outline: 'none',
                }}
              />
              <QtyBtn onClick={() => setQty((q) => q + (cntPz || 100))} theme={theme}>+</QtyBtn>
            </div>
            <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textMuted, fontWeight: 500, textAlign: 'center', marginTop: 1, letterSpacing: '-0.005em' }}>
              pz{cntPz > 0 ? ` · ${(qty / cntPz).toFixed(qty % cntPz === 0 ? 0 : 1)} cnt` : ''}
            </div>
          </div>

          {/* Presets */}
          <div style={{ display: 'flex', gap: 5 }}>
            {presets.map((v, i) => (
              <button
                key={i}
                onClick={() => setQty(v)}
                style={{
                  padding: '6px 9px', borderRadius: 6,
                  border: `1px solid ${qty === v ? theme.text : theme.border}`,
                  background: qty === v ? theme.text : 'transparent',
                  color: qty === v ? (isDark ? '#000' : '#FFF') : theme.textMuted,
                  fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600, cursor: 'pointer',
                  letterSpacing: '-0.005em', whiteSpace: 'nowrap',
                }}>
                {presetLabels[i]}
              </button>
            ))}
          </div>

          <div />
          <div style={{ width: 1, height: 32, background: theme.divider || theme.border }} />

          {/* KPIs vivos */}
          <SimKpi lbl="USD"        val={usdComprometido > 0 ? `$${Math.round(usdComprometido).toLocaleString('es-MX')}` : '—'} sub="al últ. costo" theme={theme} subDim />
          <SimKpi lbl="Cobertura"  val={cobPost != null ? Math.round(cobPost) : '—'} valU="d" sub={gananciaDias != null ? `↑ +${Math.round(gananciaDias)} d` : ''} theme={theme} valColor={semGreen} />
          <SimKpi lbl="Próx. OC"   val={proxOcLabel.split(' ')[0]} valU={proxOcLabel.split(' ')[1] || ''} sub={diasParaProxOc != null ? `~${Math.round(diasParaProxOc)} d` : ''} theme={theme} subDim />

          {/* CTA */}
          <button
            onClick={onConfirmar}
            style={{
              padding: '9px 16px', borderRadius: 10,
              background: enExport ? (theme.green || '#30D158') : (theme.accent || '#0A84FF'),
              color: '#FFF', border: 0, fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', letterSpacing: '-0.005em', whiteSpace: 'nowrap',
            }}>
            {enExport ? 'Actualizar cantidad' : 'Agregar al export'}
          </button>
        </div>

        {/* Fila 2 · Proveedor & costos absorbidos en la barra simulador */}
        {(() => {
          const uc = r.ultimaCompra || {};
          const ltDecl = Number(uc.ltDeclarado || 0);
          const ltCalc = Number(r.ltDias || 0);
          const ltMostrar = ltDecl > 0 ? ltDecl : ltCalc;
          const ltSub = ltDecl > 0
            ? 'declarado en PO'
            : ltCalc > 0 ? `${r.ltMuestras || 0} OCs · calculado` : '';
          const tipoCargaShort = uc.tipoCarga
            ? (uc.tipoCarga.length > 8 ? uc.tipoCarga.slice(0, 8) : uc.tipoCarga)
            : '—';
          const cbmU = Number(uc.cbmUnitario || 0);
          return (
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: 16,
              paddingTop: 10, marginTop: 12, borderTop: `1px solid ${theme.divider || theme.border}`,
              alignItems: 'baseline',
            }}>
              <SimField lbl="Proveedor"       val={r.supplier || '—'} sub={r.ltMuestras > 0 ? `${r.ltMuestras} OCs históricas` : 'sin histórico'} theme={theme} truncate />
              <SimField lbl="Costo prom USD"  val={r.costoPromedioUsd > 0 ? `$${r.costoPromedioUsd.toFixed(2)}` : '—'} theme={theme} mono />
              <SimField lbl="Últ. costo USD"  val={r.ultimoCostoUsd > 0 ? `$${Number(r.ultimoCostoUsd).toFixed(2)}` : '—'} theme={theme} mono color={semGreen} />
              <SimField lbl="Pz / cnt"        val={cntPz > 0 ? FMT_N(cntPz) : (r.tieneCompras ? '—' : 'sin data')} theme={theme} mono color={cntPz > 0 ? theme.text : (theme.orange || '#FF9500')} />
              <SimField lbl="Lead time"       val={ltMostrar > 0 ? `${Math.round(ltMostrar)} d` : '—'} sub={ltSub} theme={theme} mono color={ltDecl > 0 ? theme.text : theme.textMuted} />
              <SimField lbl="Tipo carga"      val={tipoCargaShort} sub={uc.tipoContenedor || ''} theme={theme} />
              <SimField lbl="CBM unit"        val={cbmU > 0 ? cbmU.toFixed(3) : '—'} sub={cbmU > 0 && cntPz > 0 ? `${(cbmU * cntPz).toFixed(1)} m³ por cnt` : ''} theme={theme} mono />
            </div>
          );
        })()}
        {r.esConsolidado && r.tieneCompras && (
          <div style={{ fontSize: 10, color: theme.orange || '#FF9500', fontStyle: 'italic', marginTop: 6 }}>
            Comparte contenedor con otros SKUs (consolidado)
          </div>
        )}
      </div>

      {/* ═══ TABLA CLIENTES · HISTÓRICO MES A MES 6M ═══ */}
      <div style={cardMd}>
        <div style={cH}>
          <div>
            <div style={cHt}>Consumo por cliente</div>
            <div style={cHsub}>{erpClientes.length} clientes del ERP · últimos 6 meses</div>
          </div>
        </div>
        {erpClientes.length === 0 ? (
          <div style={{ padding: '20px 0', color: theme.textMuted, fontSize: 12, textAlign: 'center', fontFamily: TYPO.fontDisplay, letterSpacing: '-0.005em' }}>
            Sin ventas registradas en el ERP en los últimos 6 meses
            <div style={{ marginTop: 3, color: theme.textSubtle, fontSize: 10.5 }}>este SKU no ha facturado en el periodo</div>
          </div>
        ) : (() => {
          // Renderizado histórico mensual · top-8 + fila "otros" agregando el resto
          const TOP_N_HIST = 8;
          const top = erpClientes.slice(0, TOP_N_HIST);
          const resto = erpClientes.slice(TOP_N_HIST);
          const mesesCol = (erpClientes[0] && erpClientes[0].mensual) || [];
          // Totales globales primero — necesitamos total6mGrand para calcular
          // el % que representa cada cliente del total del SKU.
          const totalesMes = mesesCol.map((m, idx) => erpClientes.reduce((a, c) => a + Number(c.mensual[idx]?.piezas || 0), 0));
          const total6mGrand = totalesMes.reduce((a, b) => a + b, 0);

          const filas = top.map((c, i) => ({
            ...c,
            color: CLIENTE_COLORS[i % CLIENTE_COLORS.length],
            pctSku: total6mGrand > 0 ? (c.total6m / total6mGrand) * 100 : 0,
            esOtros: false,
          }));
          // Fila agregada "+ N clientes menores" (colapsada) — sólo se muestra
          // si el usuario NO ha expandido el desplegable.
          let restoAgg = null;
          if (resto.length > 0) {
            const restoMensual = mesesCol.map((m, idx) => ({
              anio: m.anio, mes: m.mes, key: m.key,
              piezas: resto.reduce((a, x) => a + Number(x.mensual[idx]?.piezas || 0), 0),
            }));
            const restoTotal6m = restoMensual.reduce((a, x) => a + x.piezas, 0);
            restoAgg = {
              cliente: `${mostrarOtros ? '▾' : '▸'} ${resto.length} clientes menores`,
              canal: '',
              mensual: restoMensual,
              total6m: restoTotal6m,
              prom6m: restoTotal6m / 6,
              color: theme.textMuted,
              pctSku: total6mGrand > 0 ? (restoTotal6m / total6mGrand) * 100 : 0,
              esOtros: true,
            };
            if (mostrarOtros) {
              // Expandido: agrega cada cliente menor como fila normal,
              // continuando el ciclo de colores desde donde quedó el top.
              resto.forEach((c, j) => {
                filas.push({
                  ...c,
                  color: CLIENTE_COLORS[(top.length + j) % CLIENTE_COLORS.length],
                  pctSku: total6mGrand > 0 ? (c.total6m / total6mGrand) * 100 : 0,
                  esOtros: false,
                  esMenor: true,
                });
              });
            }
            // Fila de toggle (colapsar/expandir) siempre al final del bloque
            filas.push(restoAgg);
          }
          // Pico por fila para resaltar
          const picoIdx = (mensual) => {
            let mx = 0, idx = -1;
            mensual.forEach((v, i) => { if (v.piezas > mx) { mx = v.piezas; idx = i; } });
            return idx;
          };
          return (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={ttH(theme, 'left')}>Cliente</th>
                  <th style={ttH(theme)}>%</th>
                  {mesesCol.map((m, i) => (
                    <th key={i} style={ttH(theme)}>{MES_CORTO[m.mes - 1]}</th>
                  ))}
                  <th style={ttH(theme)}>Prom /m</th>
                  <th style={ttH(theme)}>Total 6m</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((p, i) => {
                  const pico = picoIdx(p.mensual);
                  const isToggle = p.esOtros;
                  return (
                    <tr
                      key={i}
                      onClick={isToggle ? (() => setMostrarOtros(!mostrarOtros)) : undefined}
                      style={{
                        borderBottom: i < filas.length - 1 ? `1px solid ${theme.divider || theme.border}` : 'none',
                        cursor: isToggle ? 'pointer' : 'default',
                        background: isToggle ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)') : 'transparent',
                      }}
                      onMouseEnter={isToggle ? (e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'; } : undefined}
                      onMouseLeave={isToggle ? (e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'; } : undefined}
                    >
                      <td style={ttC(theme, 'left')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, paddingLeft: p.esMenor ? 14 : 0 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 50, background: p.color, flex: '0 0 7px' }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontFamily: TYPO.fontDisplay, fontSize: 12.5,
                              fontWeight: p.esOtros ? 500 : 500,
                              color: p.esOtros ? theme.accent : theme.text,
                              letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>{p.cliente}</div>
                            {p.canal && !p.esOtros && (
                              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textSubtle, marginTop: 1 }}>
                                {p.canal}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{
                        ...ttC(theme), padding: '6px 8px',
                        fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 500,
                        color: theme.textMuted, fontVariantNumeric: 'tabular-nums',
                        letterSpacing: '-0.005em',
                      }}>
                        {p.pctSku >= 1 ? `${Math.round(p.pctSku)}%` : p.pctSku > 0 ? `${p.pctSku.toFixed(1)}%` : '—'}
                      </td>
                      {p.mensual.map((m, mi) => (
                        <td key={mi} style={{ ...ttC(theme), padding: '6px 8px' }}>
                          <NumPill value={m.piezas} highlight={mi === pico && m.piezas > 0} theme={theme} />
                        </td>
                      ))}
                      <td style={{ ...ttC(theme), padding: '6px 8px' }}>
                        <NumPill value={p.prom6m} theme={theme} />
                      </td>
                      <td style={{ ...ttC(theme), padding: '6px 8px' }}>
                        <NumPill value={p.total6m} theme={theme} strong />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ ...ttC(theme, 'left'), paddingTop: 10, borderTop: `1px solid ${theme.divider || theme.border}`, fontFamily: TYPO.fontDisplay, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 700 }}>
                    Total {erpClientes.length} clientes
                  </td>
                  <td style={{ ...ttC(theme), padding: '10px 8px 6px', borderTop: `1px solid ${theme.divider || theme.border}`, fontFamily: TYPO.fontDisplay, fontSize: 11.5, color: theme.textMuted, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                    100%
                  </td>
                  {totalesMes.map((v, i) => (
                    <td key={i} style={{ ...ttC(theme), padding: '10px 8px 6px', borderTop: `1px solid ${theme.divider || theme.border}` }}>
                      <NumPill value={v} theme={theme} strong />
                    </td>
                  ))}
                  <td style={{ ...ttC(theme), padding: '10px 8px 6px', borderTop: `1px solid ${theme.divider || theme.border}` }}>
                    <NumPill value={total6mGrand / 6} theme={theme} strong />
                  </td>
                  <td style={{ ...ttC(theme), padding: '10px 8px 6px', borderTop: `1px solid ${theme.divider || theme.border}` }}>
                    <NumPill value={total6mGrand} theme={theme} strong />
                  </td>
                </tr>
              </tfoot>
            </table>
          );
        })()}
      </div>

      {/* ═══ TRÁNSITO (ancho completo) — proveedor absorbido en simulador ═══ */}
      <div style={cardMd}>
        <div style={cH}>
          <div>
            <div style={cHt}>Tránsito</div>
            <div style={cHsub}>próximos shipments</div>
          </div>
          <div style={cHaside}>
            {(r.embarques || []).length}<span style={{ fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textMuted, fontWeight: 500, marginLeft: 3, letterSpacing: 0 }}>POs</span>
          </div>
        </div>
        {(r.embarques || []).length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {r.embarques.slice(0, 6).map((e, i) => {
              const p = e.prog || null;
              return (
                <div key={i} style={{
                  padding: '8px 0', borderTop: i > 0 ? `1px solid ${theme.divider || theme.border}` : 'none',
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'center', fontSize: 11 }}>
                    <span style={{
                      fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.04em',
                      padding: '2px 6px', borderRadius: 4,
                      background: e.estatus === 'TRANSITO MARITIMO' ? `${theme.accent}22`
                        : e.estatus === 'PROXIMO A ZARPAR' ? `${theme.orange || '#FF9500'}22`
                        : `${theme.textMuted}22`,
                      color: e.estatus === 'TRANSITO MARITIMO' ? theme.accent
                        : e.estatus === 'PROXIMO A ZARPAR' ? (theme.orange || '#FF9500')
                        : theme.textMuted,
                    }}>{(e.estatus || 'OTRO').slice(0, 12)}</span>
                    <span style={{ fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted }}>
                      {e.po ? `PO-${e.po}` : '—'} · <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{FMT_N(e.cantidad)}</strong> pz
                      {e.contenedor && <> · <span style={{ color: theme.textSubtle }}>{e.contenedor}</span></>}
                    </span>
                    <span style={{ fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted }}>{fmtFechaC(e.eta)}</span>
                  </div>
                  {/* Fase 3 · logística por contenedor si existe en prog_arribos */}
                  {p && (
                    <div style={{
                      marginLeft: 62, marginTop: 3,
                      display: 'flex', gap: 10, flexWrap: 'wrap',
                      fontFamily: TYPO.fontText, fontSize: 10, color: theme.textSubtle,
                      letterSpacing: '-0.005em',
                    }}>
                      {p.terminal && <span>📍 {p.terminal}</span>}
                      {p.cita && <span>🕒 cita {fmtFechaC(p.cita)}</span>}
                      {p.arribo_almacen && <span style={{ color: theme.text }}>✓ almacén {fmtFechaC(p.arribo_almacen)}</span>}
                      {p.linea_transportista && <span>🚚 {p.linea_transportista}</span>}
                      {Number(p.dias_demoras) > 0 && (
                        <span style={{ color: theme.orange || '#FF9500', fontWeight: 600 }}>⚠ {p.dias_demoras}d demora</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '14px 0', color: theme.textMuted, fontSize: 11.5, fontFamily: TYPO.fontDisplay, textAlign: 'center', letterSpacing: '-0.005em' }}>
            Sin tránsito programado
            <div style={{ marginTop: 3, color: theme.textSubtle, fontSize: 10.5 }}>no hay compras en camino</div>
          </div>
        )}
      </div>

      {(r.canibalizacion || r.preventaDeficit) && (
        <div style={{
          background: `${theme.orange || '#FF9500'}0F`, borderLeft: `3px solid ${theme.orange || '#FF9500'}`,
          padding: '10px 12px', borderRadius: 6, fontSize: 11.5, lineHeight: 1.5, color: theme.text,
        }}>
          {r.canibalizacion && <div><b>⚠ Canibalización</b> · {r.canibalizacion.mensaje || 'Este SKU compite con otro de la misma familia.'}</div>}
          {r.preventaDeficit && <div style={{ marginTop: 4 }}><b>🚀 Preventa</b> · Déficit acumulado de {FMT_N(r.preventaDeficit)} pz respecto a compromiso.</div>}
        </div>
      )}
    </div>
  );
}

// ───── Helpers de la variante B compacta ─────
function MiniKpi({ label, value, u, sub, color, theme, borderLeft, dim }) {
  return (
    <div style={{ padding: '2px 12px', borderLeft: borderLeft ? `1px solid ${theme.divider || theme.border}` : 'none' }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{
        fontFamily: TYPO.fontDisplay, fontSize: dim ? 16 : 19, fontWeight: dim ? 500 : 600,
        letterSpacing: '-0.02em', lineHeight: 1, color: color || (dim ? theme.textMuted : theme.text),
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
        {u && <span style={{ fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textMuted, fontWeight: 500, marginLeft: 3 }}>{u}</span>}
      </div>
      {sub && <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textMuted, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function SimKpi({ lbl, val, valU, valColor, sub, subDim, theme }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, marginBottom: 2 }}>{lbl}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', color: valColor || theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {val}
        {valU && <span style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textMuted, fontWeight: 500, marginLeft: 2 }}>{valU}</span>}
      </div>
      {sub && <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: subDim ? theme.textMuted : '#1C7A34', fontWeight: subDim ? 500 : 600, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{sub}</div>}
    </div>
  );
}

function QtyBtn({ children, onClick, theme }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 26, height: 26, borderRadius: 7, border: `1px solid ${theme.border}`,
        background: theme.surface, fontSize: 13, color: theme.text, cursor: 'pointer',
        fontFamily: TYPO.fontDisplay, fontWeight: 600, lineHeight: 1,
      }}>{children}</button>
  );
}

// Píldora de número estilo apple.com — bg azul suave para positivos,
// rojo suave para negativos, "—" muted para ceros/nulls. Sin SF Mono:
// SF Pro Display con tabular-nums. Highlight = pico del mes (bg más
// saturado). Strong = totales/totales-columna (weight 700).
function NumPill({ value, theme, highlight, strong }) {
  const isNil = value == null || Number.isNaN(value);
  const n = Number(value || 0);
  if (isNil || n === 0) {
    return <span style={{ color: theme.textSubtle, fontSize: 12 }}>—</span>;
  }
  const neg = n < 0;
  const bg = neg
    ? (theme.mode === 'dark' ? 'rgba(255,69,58,0.15)' : 'rgba(255,59,48,0.10)')
    : highlight
      ? (theme.mode === 'dark' ? 'rgba(10,132,255,0.22)' : 'rgba(0,122,255,0.14)')
      : (theme.mode === 'dark' ? 'rgba(10,132,255,0.10)' : 'rgba(0,122,255,0.06)');
  const color = neg
    ? (theme.red || '#FF3B30')
    : highlight
      ? theme.accent
      : theme.text;
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 999,
      background: bg, color,
      fontFamily: TYPO.fontDisplay,
      fontVariantNumeric: 'tabular-nums',
      fontSize: strong ? 12.5 : 12,
      fontWeight: strong || highlight ? 700 : 500,
      letterSpacing: '-0.01em', minWidth: 42, textAlign: 'center',
    }}>
      {Math.round(n).toLocaleString('es-MX')}
    </span>
  );
}

function SimField({ lbl, val, sub, theme, mono, color, truncate }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, marginBottom: 2 }}>{lbl}</div>
      <div style={{
        fontFamily: mono ? 'SF Mono, ui-monospace, monospace' : TYPO.fontDisplay,
        fontSize: 13, fontWeight: 600, letterSpacing: mono ? 0 : '-0.01em',
        color: color || theme.text, fontVariantNumeric: 'tabular-nums',
        ...(truncate ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : {}),
      }} title={truncate ? String(val) : undefined}>{val}</div>
      {sub && <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textMuted, fontWeight: 500, marginTop: 1, letterSpacing: '-0.005em' }}>{sub}</div>}
    </div>
  );
}

function KVCompact({ k, v, theme, mono, color }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 11.5,
      borderTop: `1px solid ${theme.divider || theme.border}`, letterSpacing: '-0.005em',
    }}>
      <span style={{ color: theme.textMuted }}>{k}</span>
      <span style={{
        color: color || theme.text, fontWeight: 500,
        fontFamily: mono ? 'SF Mono, ui-monospace, monospace' : TYPO.fontText,
        fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
      }}>{v}</span>
    </div>
  );
}

function ttH(theme, align = 'right') {
  return {
    padding: '7px 10px', fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted,
    borderBottom: `1px solid ${theme.divider || theme.border}`, textAlign: align,
  };
}
function ttC(theme, align = 'right') {
  return { padding: '8px 10px', fontSize: 12, textAlign: align, verticalAlign: 'middle' };
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
  onExportar, onVerHistorial, theme, isDark,
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

  const nBorradores = sol.borradores.length;

  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 14, overflow: 'hidden',
    }}>
      {/* ═══ HEADER · eyebrow + título + autosave chip ═══ */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: `1px solid ${theme.divider || theme.border}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{
              fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 700,
              letterSpacing: '.09em', textTransform: 'uppercase', color: theme.textMuted,
              marginBottom: 2,
            }}>
              S&OP · Planeación
            </div>
            <div style={{
              fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 600,
              letterSpacing: '-0.02em', color: theme.text, display: 'flex',
              alignItems: 'center', gap: 8,
            }}>
              Mi Export
              {nBorradores > 0 && (
                <span style={{
                  padding: '2px 8px', borderRadius: 999,
                  background: `${theme.accent}1E`, color: theme.accent,
                  fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 700,
                  letterSpacing: '.02em',
                }}>{nBorradores}</span>
              )}
            </div>
          </div>
          {activo && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 8px', borderRadius: 999,
              background: `${theme.green || '#34C759'}1A`,
              fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600,
              color: theme.green || '#34C759', letterSpacing: '.02em',
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: 999,
                background: theme.green || '#34C759',
                animation: 'sopPulse 2s ease-in-out infinite',
              }} />
              Autoguardado
            </div>
          )}
        </div>
      </div>

      {/* Keyframes para el dot pulse del autosave */}
      <style>{`
        @keyframes sopPulse {
          0%, 100% { opacity: 1 }
          50% { opacity: .35 }
        }
      `}</style>

      {/* ═══ Selector borrador (solo si hay más de 1) ═══ */}
      {nBorradores > 1 && (
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${theme.divider || theme.border}` }}>
          <div style={{ position: 'relative' }}>
            <select
              value={activoId || ''}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '__NEW__') { onCrearNuevo && onCrearNuevo(); return; }
                setActivoId(v);
              }}
              style={{
                width: '100%', padding: '8px 32px 8px 12px', borderRadius: 10,
                border: `1px solid ${theme.border}`, background: theme.bg,
                fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 500,
                letterSpacing: '-0.005em', color: theme.text, outline: 'none',
                cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
              }}>
              {sol.borradores.map((b) => (
                <option key={b.id} value={b.id}>{b.nombre || 'Sin nombre'}</option>
              ))}
              {puedeEditar && <option value="__NEW__">＋ Nuevo export</option>}
            </select>
            <span style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              pointerEvents: 'none', color: theme.textMuted, fontSize: 10,
            }}>▼</span>
          </div>
        </div>
      )}

      {activo ? (
        <>
          {/* ═══ Nombre editable ═══ */}
          <div style={{ padding: '12px 16px 6px' }}>
            <input
              type="text"
              value={nombreEdit}
              onChange={(e) => setNombreEdit(e.target.value)}
              onBlur={guardarNombre}
              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
              disabled={!puedeEditar}
              style={{
                width: '100%', border: 'none', background: 'transparent',
                fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600,
                letterSpacing: '-0.02em', color: theme.text, outline: 'none',
                padding: 0,
              }}
              placeholder="Nombre del export"
            />
            <div style={{ fontFamily: TYPO.fontText, fontSize: 11, color: theme.textMuted, marginTop: 3, letterSpacing: '-0.005em' }}>
              {lineas.length} SKU{lineas.length !== 1 ? 's' : ''}
              {activo.updated_at && <> · edición {fmtRel(activo.updated_at)}</>}
            </div>
          </div>

          {/* ═══ Totales (card destacada) ═══ */}
          <div style={{ padding: '10px 16px 14px' }}>
            <div style={{
              padding: '12px 14px', borderRadius: 12,
              background: `${theme.accent}0D`, border: `1px solid ${theme.accent}22`,
              display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'baseline', gap: 8,
            }}>
              <div>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: theme.accent }}>
                  Total USD
                </div>
                <div style={{
                  fontFamily: TYPO.fontDisplay, fontSize: 24, fontWeight: 600,
                  letterSpacing: '-0.025em', color: theme.text,
                  fontVariantNumeric: 'tabular-nums', marginTop: 2, lineHeight: 1,
                }}>
                  ${FMT_N(totalUsd)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: theme.textMuted }}>
                  Piezas
                </div>
                <div style={{
                  fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600,
                  letterSpacing: '-0.015em', color: theme.text,
                  fontVariantNumeric: 'tabular-nums', marginTop: 2, lineHeight: 1,
                }}>
                  {FMT_N(totalPz)}
                </div>
              </div>
            </div>
          </div>

          {/* Líneas · agrupadas por proveedor cuando >= 3 SKUs del mismo */}
          <div style={{ maxHeight: 380, overflow: 'auto' }}>
            {lineas.length === 0 ? (
              <div style={{ padding: '30px 20px', textAlign: 'center', color: theme.textMuted, fontSize: 11.5, fontStyle: 'italic' }}>
                Sin SKUs. Da click a "＋" en la tabla para agregar.
              </div>
            ) : (() => {
              // Agrupar por proveedor
              const provKey = (l) => (l.supplier || l.proveedor || '').trim() || '—';
              const byProv = new Map();
              lineas.forEach((l) => {
                const k = provKey(l);
                if (!byProv.has(k)) byProv.set(k, []);
                byProv.get(k).push(l);
              });
              // Ordenar por: grupo (>=3) primero por USD desc, luego sueltos por USD desc
              const grouped = [];
              const singles = [];
              const usdOf = (arr) => arr.reduce((a, l) => a + Number(l.cantidad || 0) * Number(l.ultimo_costo_usd || 0), 0);
              const pzOf  = (arr) => arr.reduce((a, l) => a + Number(l.cantidad || 0), 0);
              const cntOf = (arr) => arr.reduce((a, l) => a + Number(l.contenedores || 0), 0);
              byProv.forEach((arr, prov) => {
                if (arr.length >= 3) grouped.push({ prov, arr, usd: usdOf(arr), pz: pzOf(arr), cnt: cntOf(arr) });
                else singles.push({ prov, arr, usd: usdOf(arr) });
              });
              grouped.sort((a, b) => b.usd - a.usd);
              singles.sort((a, b) => b.usd - a.usd);
              const flatSingles = singles.flatMap((s) => s.arr);
              return (
                <>
                  {grouped.map((g) => (
                    <div key={`g-${g.prov}`}>
                      <div style={{
                        padding: '10px 14px 6px', background: theme.bg,
                        borderTop: `1px solid ${theme.divider || theme.border}`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                      }}>
                        <div style={{
                          fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em',
                          textTransform: 'uppercase', color: theme.text, display: 'flex', alignItems: 'center', gap: 6,
                          minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }} title={g.prov}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.prov}</span>
                          <span style={{
                            padding: '1px 7px', borderRadius: 999, fontSize: 9.5, fontWeight: 700, letterSpacing: '.03em',
                            background: `${theme.accent}22`, color: theme.accent, letterSpacing: 0,
                          }}>{g.arr.length} SKUs</span>
                        </div>
                        <div style={{
                          fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 700,
                          letterSpacing: '-0.015em', color: theme.text, fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap', marginLeft: 8,
                        }}>
                          ${FMT_N(g.usd)}
                          <span style={{ fontFamily: TYPO.fontText, fontWeight: 500, color: theme.textMuted, fontSize: 10.5, marginLeft: 4 }}>
                            · {g.cnt > 0 ? `${g.cnt} cnt` : `${FMT_N(g.pz)} pz`}
                          </span>
                        </div>
                      </div>
                      {g.arr.map((l) => (
                        <ExportCartLine key={l.id} linea={l} puedeEditar={puedeEditar}
                          onEditarLinea={onEditarLinea} onEliminarLinea={onEliminarLinea}
                          theme={theme} indent />
                      ))}
                    </div>
                  ))}
                  {flatSingles.length > 0 && grouped.length > 0 && (
                    <div style={{
                      padding: '10px 14px 6px', background: theme.bg,
                      borderTop: `1px solid ${theme.divider || theme.border}`,
                      fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 700,
                      letterSpacing: '.06em', textTransform: 'uppercase', color: theme.textMuted,
                    }}>
                      Otros SKUs
                    </div>
                  )}
                  {flatSingles.map((l) => (
                    <ExportCartLine key={l.id} linea={l} puedeEditar={puedeEditar}
                      onEditarLinea={onEditarLinea} onEliminarLinea={onEliminarLinea}
                      theme={theme} showProv />
                  ))}
                </>
              );
            })()}
          </div>

          {/* ═══ Actions · botón principal Exportar + Cerrar ═══ */}
          <div style={{
            padding: '14px 16px', borderTop: `1px solid ${theme.divider || theme.border}`,
            background: theme.bg, display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <button
              onClick={onExportar}
              disabled={lineas.length === 0}
              style={{
                width: '100%', padding: '11px 16px', borderRadius: 12,
                background: lineas.length === 0
                  ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')
                  : (theme.green || '#34C759'),
                border: 0, color: lineas.length === 0 ? theme.textMuted : '#fff',
                fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.005em',
                cursor: lineas.length === 0 ? 'not-allowed' : 'pointer',
                opacity: lineas.length === 0 ? 0.6 : 1,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'transform 120ms',
              }}
              onMouseEnter={(e) => { if (lineas.length > 0) e.currentTarget.style.transform = 'scale(1.02)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <span style={{ fontSize: 15 }}>↓</span> Exportar a Excel
            </button>
            {puedeEditar && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => onCerrar && onCerrar(activo.id)}
                  disabled={lineas.length === 0}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 10,
                    background: 'transparent', border: `1px solid ${theme.border}`,
                    fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600,
                    color: theme.textMuted, letterSpacing: '-0.005em',
                    cursor: lineas.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: lineas.length === 0 ? 0.5 : 1,
                  }}>
                  Cerrar borrador
                </button>
                <button
                  onClick={onCrearNuevo}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 10,
                    background: 'transparent', border: `1px solid ${theme.border}`,
                    fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600,
                    color: theme.accent, letterSpacing: '-0.005em',
                    cursor: 'pointer',
                  }}>
                  ＋ Nuevo
                </button>
              </div>
            )}
          </div>

          {/* ═══ Ver histórico ═══ */}
          {sol.cerradas.length > 0 && (
            <button
              onClick={onVerHistorial}
              style={{
                width: '100%', padding: '11px 16px', border: 'none',
                background: 'transparent', color: theme.accent,
                fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600,
                cursor: 'pointer', borderTop: `1px solid ${theme.divider || theme.border}`,
                textAlign: 'center', letterSpacing: '-0.005em',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}>
              Ver historial · {sol.cerradas.length} export{sol.cerradas.length !== 1 ? 's' : ''} cerrado{sol.cerradas.length !== 1 ? 's' : ''}
              <span style={{ opacity: .5 }}>›</span>
            </button>
          )}
        </>
      ) : (
        // ═══ Empty state · sin borrador activo ═══
        <div style={{ padding: '28px 20px 24px', textAlign: 'center' }}>
          {/* Icono grande en círculo */}
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: `${theme.accent}12`, color: theme.accent,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, marginBottom: 14,
          }}>
            📋
          </div>
          <div style={{
            fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600,
            letterSpacing: '-0.02em', color: theme.text, marginBottom: 4,
          }}>
            {puedeEditar ? 'Empieza tu primer export' : 'Sin export activo'}
          </div>
          <div style={{
            fontFamily: TYPO.fontText, fontSize: 12, color: theme.textMuted,
            letterSpacing: '-0.005em', lineHeight: 1.45, maxWidth: 260, margin: '0 auto 18px',
          }}>
            {puedeEditar
              ? 'Selecciona SKUs de la tabla con el botón azul o agrega todos los sugeridos con un click.'
              : 'Un usuario con permisos debe crear un borrador.'}
          </div>
          {puedeEditar && (
            <button
              onClick={onCrearNuevo}
              style={{
                padding: '10px 20px', borderRadius: 999,
                background: theme.accent, color: '#fff', border: 0,
                fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600,
                letterSpacing: '-0.005em', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                transition: 'transform 120ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              ＋ Crear nuevo export
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ExportCartLine({ linea, puedeEditar, onEditarLinea, onEliminarLinea, theme, indent, showProv }) {
  const cantidad = Number(linea.cantidad || 0);
  const cnt = Number(linea.contenedores || 0);
  const pzPorCnt = cnt > 0 ? cantidad / cnt : 0;
  const inc = () => onEditarLinea && onEditarLinea(linea.id, { cantidad: cantidad + (pzPorCnt || 100), contenedores: cnt + 1 });
  const dec = () => {
    if (cnt <= 1) return;
    onEditarLinea && onEditarLinea(linea.id, { cantidad: Math.max(0, cantidad - (pzPorCnt || 100)), contenedores: cnt - 1 });
  };
  const subtotal = cantidad * Number(linea.ultimo_costo_usd || 0);
  const proveedor = (linea.supplier || linea.proveedor || '').trim();
  return (
    <div style={{
      padding: `10px 14px 10px ${indent ? 26 : 14}px`, borderBottom: `1px solid ${theme.divider || theme.border}`,
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
        {showProv && proveedor && (
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: theme.textSubtle, marginTop: 2 }}>
            {proveedor}
          </div>
        )}
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
