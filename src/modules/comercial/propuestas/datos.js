// datos.js — lecturas del armador de propuestas compartidas por escritorio y celular:
//   fetchSellout(clienteKey, mm, anioMin, anioMax) → [{ sku, cantidad, anio, mes }] de los 3 meses cerrados
//   fetchSelloutMesActual(clienteKey)              → $ facturado del mes en curso (Digitalife/Dicotech)
//   fetchSpiffsActivos()                           → { list, byKey, meta }
//   fetchCatalogo(clienteKey)                      → { skus, contexto } (roadmap + inventario + precios + costo + sell-out + SPIFF)
//   fetchPreciosVigentes(skus)                     → Map sku → { lista → precio } (para Duplicar con lista vigente)
//   fetchKpisClientes()                            → { clienteKey: { cuota, facturado, gap } } del mes en curso
import { supabase } from '../../../lib/supabase';
import { fetchAllQ, cachedQuery } from '../../../lib/queries';
import { MES_ACTUAL, CLIENTES, mesesCerrados } from './constantes';
import { indiceDe } from './filtros';

export async function fetchSelloutMesActual(clienteKey) {
  const anio = MES_ACTUAL.anio, mes = MES_ACTUAL.mes;
  if (clienteKey === 'digitalife') {
    // Vista agregada: monto_bruto = Σ(cantidad × precio) ya calculado en Postgres.
    // Antes: .limit(200000) sobre el detalle diario (PostgREST corta en 1000).
    const { data } = await cachedQuery(
      supabase.from('v_sellout_detalle_sku_mes').select('monto_bruto')
        .eq('cliente', 'digitalife').eq('anio', anio).eq('mes', mes),
    );
    return (data || []).reduce((s, r) => s + (Number(r.monto_bruto) || 0), 0);
  }
  if (clienteKey === 'dicotech') {
    const { data } = await supabase.from('sellout_general')
      .select('importe')
      .eq('mayorista', 'DICOTECH')
      .eq('anio', anio).eq('mes', mes)
      .limit(200000);
    return (data || []).reduce((s, r) => s + (Number(r.importe) || 0), 0);
  }
  return 0;
}

// Devuelve { sku, cantidad, anio, mes } — desglose por mes para poder mostrar Jul/Jun/May
// individualmente en la tabla de propuesta.
export async function fetchSellout(clienteKey, mm, anioMin, anioMax) {
  const mesesSet = new Set(mm.map((m) => `${m.anio}-${String(m.mes).padStart(2, '0')}`));

  if (clienteKey === 'digitalife') {
    // Filtrar por rango de fechas de los 3 meses target (no todo desde
    // anioMin) para reducir volumen antes de paginar. Supabase corta en
    // 1000 aunque pases .limit(200000); hay que paginar sí o sí.
    // Vista agregada por sku+mes (v_sellout_detalle_sku_mes): devuelve
    // directamente {sku, piezas, anio, mes}. Antes: detalle diario paginado.
    const aniosMm = Array.from(new Set(mm.map((m) => m.anio)));
    const data = await fetchAllQ(() =>
      supabase.from('v_sellout_detalle_sku_mes')
        .select('sku,piezas,anio,mes')
        .eq('cliente', 'digitalife')
        .in('anio', aniosMm), { label: 'propuestas' });
    return (data || [])
      .filter((r) => mesesSet.has(`${r.anio}-${String(r.mes).padStart(2, '0')}`))
      .map((r) => ({ sku: r.sku, cantidad: r.piezas, anio: Number(r.anio), mes: Number(r.mes) }));
  }
  if (clienteKey === 'pcel') {
    // sellout_pcel trae los últimos 3 meses en columnas vta_mes_actual, vta_mes_1, vta_mes_2
    // relativo a la SEMANA. `_actual` = mes cursando, `_1` = mes anterior, `_2` = 2 atrás.
    // vta_mes_3 en el archivo siempre viene null, por eso no lo usamos.
    // Además: el SKU del roadmap (AC-XXXX) vive en la columna `modelo`,
    // NO en `sku` (que trae el código interno de PCEL como "345094").
    const { data } = await supabase.from('sellout_pcel')
      .select('modelo,anio,semana,vta_mes_actual,vta_mes_1,vta_mes_2')
      .gte('anio', anioMax - 1).not('modelo', 'is', null).limit(50000);
    const byKey = new Map();
    for (const r of data || []) {
      if (!r.modelo) continue;
      const key = (Number(r.anio) || 0) * 100 + (Number(r.semana) || 0);
      const prev = byKey.get(r.modelo);
      if (!prev || prev.key < key) byKey.set(r.modelo, { key, r });
    }
    const out = [];
    for (const { r } of byKey.values()) {
      // mm[0] = mes anterior a hoy, mm[1] = 2 atrás, mm[2] = 3 atrás
      // Mapeo: vta_mes_1 = mm[0], vta_mes_2 = mm[1], vta_mes_actual = mes en curso (no lo usamos aquí)
      const cols = [Number(r.vta_mes_1) || 0, Number(r.vta_mes_2) || 0, 0];
      mm.forEach((m, i) => {
        if (cols[i] > 0) out.push({ sku: r.modelo, cantidad: cols[i], anio: m.anio, mes: m.mes });
      });
    }
    return out;
  }
  if (clienteKey === 'dicotech') {
    const { data } = await supabase.from('sellout_general')
      .select('sku,cantidad,anio,mes')
      .eq('mayorista', 'DICOTECH')
      .gte('anio', anioMin).limit(200000);
    return (data || [])
      .filter((r) => mesesSet.has(`${r.anio}-${String(r.mes).padStart(2, '0')}`))
      .map((r) => ({ sku: r.sku, cantidad: r.cantidad, anio: Number(r.anio), mes: Number(r.mes) }));
  }
  return [];
}

// ═══ Fetch de SPIFFs activos hoy ═══
export async function fetchSpiffsActivos() {
  const hoy = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase.from('spiffs')
    .select('sku,monto,vigencia_inicio,vigencia_fin,descripcion,fuente')
    .lte('vigencia_inicio', hoy).gte('vigencia_fin', hoy);
  if (error) return { list: [], byKey: new Map(), meta: null };
  const byKey = new Map();
  for (const r of data || []) byKey.set(r.sku, r);
  const meta = data && data.length > 0
    ? {
        total: data.length,
        potencial: data.reduce((s, r) => s + Number(r.monto || 0), 0), // suma monto/pz — no potencial real
        vigencia_inicio: data[0].vigencia_inicio,
        vigencia_fin: data[0].vigencia_fin,
        fuente: data[0].fuente,
      }
    : null;
  return { list: data || [], byKey, meta };
}

// ═══ Catálogo completo del armador (antes fetchAll en PropuestasTab.jsx) ═══
export async function fetchCatalogo(clienteKey) {
  const mm = mesesCerrados();
  const anioMin = Math.min(...mm.map((m) => m.anio));
  const anioMax = Math.max(...mm.map((m) => m.anio));

  // inventario_acteck tiene ~43K filas: paginado paralelo + cache central.
  const invAckDataP = fetchAllQ(() => supabase.from('inventario_acteck').select('articulo,inventario,disponible,no_almacen'), { label: 'propuestas' });

  // Inventario del cliente: PCEL vive en sellout_pcel.inventario; Digitalife/Dicotech en inventario_cliente (última semana).
  const invCliQuery = (async () => {
    if (clienteKey === 'pcel') {
      return supabase.from('sellout_pcel').select('modelo,inventario,anio,semana').not('modelo', 'is', null).limit(50000);
    }
    const { data: ult } = await supabase.from('inventario_cliente').select('anio,semana').eq('cliente', clienteKey)
      .not('anio', 'is', null).not('semana', 'is', null)
      .order('anio', { ascending: false, nullsFirst: false }).order('semana', { ascending: false, nullsFirst: false }).limit(1);
    const ultAnio = ult?.[0]?.anio, ultSemana = ult?.[0]?.semana;
    if (!ultAnio || !ultSemana) return { data: [] };
    return supabase.from('inventario_cliente').select('sku,stock,titulo,anio,semana').eq('cliente', clienteKey).eq('anio', ultAnio).eq('semana', ultSemana).limit(5000);
  })();

  const [roadmapRes, invAckData, invCliRes, preciosRes, costosRes, sellout90, selloutMes, cuotaRes, spiffsRes] = await Promise.all([
    supabase.from('roadmap_sku').select('sku,marca,familia,categoria,descripcion,rdmp'),
    invAckDataP,
    invCliQuery,
    cachedQuery(supabase.from('v_estrategia_precios_lista').select('sku,lista,precio')),
    supabase.from('precios_sku').select('sku,costo_promedio,anio,mes').gte('anio', anioMax - 1).order('anio', { ascending: false }).order('mes', { ascending: false }),
    fetchSellout(clienteKey, mm, anioMin, anioMax),
    fetchSelloutMesActual(clienteKey),
    supabase.from('cuotas_mensuales').select('cuota_min,cuota_meta').eq('cliente', clienteKey).eq('anio', MES_ACTUAL.anio).eq('mes', MES_ACTUAL.mes),
    fetchSpiffsActivos(),
  ]);

  // INV ACK = Σ inventario sobre almacenes comerciales (misma lista que almacenes_config.comercial / v_inventario_comercial).
  const ALM_COMERCIALES = new Set([1, 2, 3, 6, 9, 12, 14, 15, 16, 17, 19, 25, 44, 64, 71]);
  const invAck = new Map();
  for (const r of invAckData || []) {
    if (!ALM_COMERCIALES.has(Number(r.no_almacen))) continue;
    invAck.set(r.articulo, (invAck.get(r.articulo) || 0) + (Number(r.inventario) || 0));
  }
  for (const [k, v] of invAck.entries()) invAck.set(k, Math.round(v));

  const invCli = new Map(), invCliTitulos = new Map();
  for (const r of invCliRes.data || []) {
    const key = (Number(r.anio) || 0) * 100 + (Number(r.semana) || 0);
    const skuKey = clienteKey === 'pcel' ? r.modelo : r.sku;
    const stockVal = clienteKey === 'pcel' ? (Number(r.inventario) || 0) : (Number(r.stock) || 0);
    if (!skuKey) continue;
    const prev = invCli.get(skuKey);
    if (!prev || prev.key < key) { invCli.set(skuKey, { key, stock: stockVal }); if (r.titulo) invCliTitulos.set(skuKey, r.titulo); }
  }
  const preciosPorSku = new Map();
  for (const r of preciosRes.data || []) {
    if (!preciosPorSku.has(r.sku)) preciosPorSku.set(r.sku, {});
    preciosPorSku.get(r.sku)[r.lista] = Number(r.precio) || 0;
  }
  const costoPorSku = new Map();
  for (const r of costosRes.data || []) if (!costoPorSku.has(r.sku) && r.costo_promedio) costoPorSku.set(r.sku, Number(r.costo_promedio) || 0);

  const sellout = new Map(), selloutPorMes = new Map();
  for (const r of sellout90) {
    sellout.set(r.sku, (sellout.get(r.sku) || 0) + (Number(r.cantidad) || 0));
    if (r.anio && r.mes) {
      const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
      const mesMap = selloutPorMes.get(r.sku) || {};
      mesMap[key] = (mesMap[key] || 0) + (Number(r.cantidad) || 0);
      selloutPorMes.set(r.sku, mesMap);
    }
  }
  const mesesKeys = mm.map((m) => `${m.anio}-${String(m.mes).padStart(2, '0')}`);

  const rows = (roadmapRes.data || []).map((r) => {
    const sm = selloutPorMes.get(r.sku) || {};
    const base = {
      sku: r.sku, marca: r.marca || '', familia: r.familia || '', categoria: r.categoria || '',
      descripcion: r.descripcion || invCliTitulos.get(r.sku) || '', rdmp: r.rdmp || '',
      invActeck: invAck.get(r.sku) || 0, invCliente: invCli.get(r.sku)?.stock || 0,
      sellout90: sellout.get(r.sku) || 0, promSellout: Math.round((sellout.get(r.sku) || 0) / 3),
      selloutMes: Object.fromEntries(mesesKeys.map((k) => [k, Number(sm[k]) || 0])),
      precios: preciosPorSku.get(r.sku) || {}, costo: costoPorSku.get(r.sku) || 0,
      spiff: spiffsRes?.byKey?.get(r.sku)?.monto || 0,
    };
    base.indice = indiceDe(base);
    return base;
  });
  rows.sort((a, b) => b.sellout90 - a.sellout90);

  const cuota = (cuotaRes.data || []).reduce((s, r) => s + (Number(r.cuota_min) || Number(r.cuota_meta) || 0), 0);
  const facturado = selloutMes;
  const hoy = new Date();
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  const diasRestantes = Math.max(0, Math.ceil((finMes - hoy) / 86400000));

  // Avisos de datos faltantes: se pintan como pills en el Hero de Armar con enlace al importador.
  //   { tipo: 'error'|'warn', titulo, msg, pagina }
  const warnings = [];
  const skusConPrecios = rows.filter((r) => Object.keys(r.precios || {}).length > 0).length;
  const pctConPrecios = rows.length > 0 ? (skusConPrecios / rows.length) * 100 : 0;
  const fuentes = { sellout: sellout90.length > 0, invCliente: invCli.size > 0, precios: pctConPrecios >= 60 };
  if (rows.length === 0) warnings.push({ tipo: 'error', titulo: 'Sin SKUs cargados', msg: 'La tabla roadmap_sku está vacía. Sube el Roadmap desde Actualización de datos.', pagina: 'actualizacion' });
  else if (pctConPrecios < 10) warnings.push({ tipo: 'error', titulo: 'Sin precios de la lista', msg: `Solo ${skusConPrecios} de ${rows.length} SKUs tienen precios. Revisa la carga del puente SQL (precios).`, pagina: 'actualizacion' });
  else if (pctConPrecios < 60) warnings.push({ tipo: 'warn', titulo: 'Precios incompletos', msg: `Solo ${pctConPrecios.toFixed(0)}% de los SKUs tienen lista de precios.`, pagina: 'actualizacion' });
  if (!fuentes.sellout) warnings.push({ tipo: 'warn', titulo: 'Sin sell-out del cliente', msg: 'No hay sell-out de los 3 meses cerrados: sin sugeridos ni piezas de arranque.', pagina: 'actualizacion' });
  if (!fuentes.invCliente) warnings.push({ tipo: 'warn', titulo: 'Sin inventario del cliente', msg: 'No hay inventario reciente del cliente: no se puede calcular cobertura ni sugerir SKUs.', pagina: 'actualizacion' });

  return {
    skus: rows,
    contexto: {
      cuota, facturado, gap: Math.max(0, cuota - facturado), diasRestantes,
      skusConInv: rows.filter((r) => r.invActeck > 0).length,
      spiffsMeta: spiffsRes?.meta || null, warnings, fuentes, mesesKeys,
      diag: { totalSkus: rows.length, skusConPrecios, spiffsActivos: spiffsRes?.meta?.total || 0 },
    },
  };
}

// ═══ Precios vigentes de un conjunto de SKUs (Duplicar) ═══
export async function fetchPreciosVigentes(skus) {
  const lista = [...new Set((skus || []).filter(Boolean))];
  const out = new Map();
  for (let i = 0; i < lista.length; i += 200) {
    const { data } = await cachedQuery(supabase.from('v_estrategia_precios_lista').select('sku,lista,precio').in('sku', lista.slice(i, i + 200)));
    for (const r of data || []) { if (!out.has(r.sku)) out.set(r.sku, {}); out.get(r.sku)[r.lista] = Number(r.precio) || 0; }
  }
  return out;
}

// ═══ Cuota / facturado del mes por cliente (tarjetas de cliente en la Landing) ═══
export async function fetchKpisClientes() {
  const anio = MES_ACTUAL.anio, mes = MES_ACTUAL.mes;
  const cliKeys = CLIENTES.map((c) => c.key);
  const [cuotas, factRes] = await Promise.all([
    supabase.from('cuotas_mensuales').select('cliente,cuota_min,cuota_ideal').eq('anio', anio).eq('mes', mes).in('cliente', cliKeys),
    cachedQuery(supabase.from('v_fact_cliente_mes').select('cliente_key,monto').eq('anio', anio).eq('mes', mes).in('cliente_key', cliKeys)),
  ]);
  const out = {};
  for (const k of cliKeys) out[k] = { cuota: 0, facturado: 0, gap: 0 };
  (cuotas.data || []).forEach((r) => { if (out[r.cliente]) out[r.cliente].cuota += Number(r.cuota_min || r.cuota_ideal || 0); });
  (factRes.data || []).forEach((r) => { if (out[r.cliente_key]) out[r.cliente_key].facturado += Number(r.monto || 0); });
  Object.values(out).forEach((v) => { v.gap = Math.max(0, v.cuota - v.facturado); });
  return out;
}
