// calculo.js — motor del S&OP (planeación de compras). Función PURA compartida por la pestaña de
// escritorio (ForecastClientesTab.jsx) y la app móvil (src/movil/pestanas/SOP.jsx): las dos pantallas
// muestran EXACTAMENTE la misma brecha, el mismo sugerido, cobertura y lead time.
//
//   calcularForecast(data, horizonteMeses) → rows[]
//
// `data` = { inventario, transito, leadTimes, metadata, demanda, roadmap, embarques, reporteSkus,
//            facturacion, progArribos, catalogoArticulos, skuConfig } (todos arrays; pueden ir vacíos).
// Reglas de negocio (Fase 4): ritmo ERP de 3 meses (incluye el mes en curso), crecimiento auto (cap 40 %),
// meses de seguridad para SKUs críticos, tránsito sólo dentro de 3 meses, redondeo a contenedor con umbral 50 %.

// Buffer de inventario de seguridad (meses de demanda) · compat, ya no interviene en el sugerido.
export const BUFFER_MESES = 1;

// ────────── Cálculo del forecast ──────────
export function calcularForecast(data, horizonteMeses) {
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

    // S&OP usa `inventario` (no `disponible`) sobre almacenes comerciales
    // según v_inventario_comercial + almacenes_config, para coincidir con
    // el criterio del resto del dashboard (Propuestas, Inventario).
    const inv = Number(invBySku[sku]?.inventario || 0);
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
