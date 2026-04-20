/**
 * pcelAdapter — lee datos de PCEL desde su tabla propia `sellout_pcel`
 * y los transforma al formato canónico de `sellout_sku` / `inventario_cliente`,
 * para que Home / Análisis / Estrategia / Forecast / Cartera funcionen sin
 * condicionales.
 *
 * sellout_pcel columns:
 *   anio, semana, sku, pcel_sku, marca, producto, familia, subfamilia,
 *   inventario, costo_promedio, antiguedad, transito, back_order,
 *   vta_semana, vta_mes_actual, vta_mes_1, vta_mes_2, vta_mes_3
 *
 * sellout_sku columns (canonical):
 *   cliente, sku, anio, mes, piezas, monto_pesos
 *
 * inventario_cliente columns (canonical):
 *   cliente, sku, stock, titulo, marca, anio, semana, valor, costo_convenio,
 *   dias_sin_venta
 */

import { supabase } from "./supabase";

// ────────── Helpers ──────────
// Paginación: Supabase PostgREST limita a 1000 filas por request
async function fetchAllPages(qFactory, pageSize = 1000) {
  const out = [];
  let from = 0;
  for (;;) {
    const { data, error } = await qFactory().range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

// Semana ISO → mes (1-12). Usa el jueves de la semana ISO como referencia.
// ISO week 1 contiene el primer jueves de enero.
export function isoWeekToMonth(anio, semana) {
  const jan4 = new Date(anio, 0, 4); // 4 de enero siempre está en ISO week 1
  const janDay = jan4.getDay() || 7; // Lunes=1 ... Domingo=7
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - (janDay - 1));
  const targetThursday = new Date(week1Monday);
  targetThursday.setDate(week1Monday.getDate() + (semana - 1) * 7 + 3); // jueves
  return targetThursday.getMonth() + 1;
}

// ────────── Adapters para PCEL ──────────

/**
 * Lee sellout en formato sellout_sku.
 * Para PCEL: agrupa sellout_pcel.vta_semana por (sku, mes) usando isoWeekToMonth.
 * Para otros clientes: lee sellout_sku directamente.
 */
export async function fetchSelloutSku(clienteKey, anio) {
  if (clienteKey !== "pcel") {
    return fetchAllPages(() =>
      supabase.from("sellout_sku").select("*").eq("cliente", clienteKey).eq("anio", anio)
    );
  }
  // PCEL: transformar desde sellout_pcel
  const rows = await fetchAllPages(() =>
    supabase
      .from("sellout_pcel")
      .select("sku, anio, semana, vta_semana, costo_promedio")
      .eq("anio", anio)
  );

  // Agrupar por (sku, mes)
  const bucket = new Map(); // key = sku|mes
  rows.forEach((r) => {
    const sku = (r.sku || "").toString();
    if (!sku) return;
    const piezas = Number(r.vta_semana) || 0;
    if (piezas === 0) return;
    const mes = isoWeekToMonth(Number(r.anio) || anio, Number(r.semana) || 1);
    const key = `${sku}|${mes}`;
    const cur = bucket.get(key) || { sku, anio, mes, piezas: 0, monto_pesos: 0, _costoAcum: 0, _n: 0 };
    cur.piezas += piezas;
    if (r.costo_promedio) {
      cur._costoAcum += Number(r.costo_promedio) * piezas;
      cur._n += piezas;
    }
    bucket.set(key, cur);
  });

  return Array.from(bucket.values()).map((r) => ({
    cliente: "pcel",
    sku: r.sku,
    anio: r.anio,
    mes: r.mes,
    piezas: r.piezas,
    // No tenemos precio venta; monto aproximado = piezas × costo promedio (placeholder)
    monto_pesos: r._n > 0 ? Math.round((r._costoAcum / r._n) * r.piezas) : 0,
  }));
}

/**
 * Lee sellout para un rango de años (Análisis usa esto).
 */
export async function fetchSelloutSkuRango(clienteKey, anioFrom, anioTo) {
  if (clienteKey !== "pcel") {
    return fetchAllPages(() =>
      supabase
        .from("sellout_sku")
        .select("*")
        .eq("cliente", clienteKey)
        .gte("anio", anioFrom)
        .lte("anio", anioTo)
    );
  }
  const all = [];
  for (let a = anioFrom; a <= anioTo; a++) {
    const rows = await fetchSelloutSku("pcel", a);
    all.push(...rows);
  }
  return all;
}

/**
 * Lee inventario del cliente en formato inventario_cliente.
 * Para PCEL: toma la última semana cargada por SKU en sellout_pcel.
 */
export async function fetchInventarioCliente(clienteKey) {
  if (clienteKey !== "pcel") {
    return fetchAllPages(() =>
      supabase
        .from("inventario_cliente")
        .select("sku,stock,valor,costo_convenio,dias_sin_venta,anio,semana,titulo,marca")
        .eq("cliente", clienteKey)
    );
  }
  // PCEL: última semana disponible por SKU
  const rows = await fetchAllPages(() =>
    supabase
      .from("sellout_pcel")
      .select("sku, producto, marca, anio, semana, inventario, costo_promedio, antiguedad")
      .order("semana", { ascending: false })
  );

  // Tomar la primera ocurrencia por sku (gracias al order desc, es la más reciente)
  const vistos = new Set();
  const out = [];
  for (const r of rows) {
    const sku = (r.sku || "").toString();
    if (!sku || vistos.has(sku)) continue;
    vistos.add(sku);
    const stock = Number(r.inventario) || 0;
    const costo = Number(r.costo_promedio) || 0;
    out.push({
      cliente: "pcel",
      sku,
      stock,
      titulo: r.producto || sku,
      marca: r.marca || null,
      anio: r.anio,
      semana: r.semana,
      valor: stock * costo,
      costo_convenio: costo,
      dias_sin_venta: Number(r.antiguedad) || null,
    });
  }
  return out;
}
