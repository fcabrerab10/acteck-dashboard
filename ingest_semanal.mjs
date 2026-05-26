import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = fs.readFileSync("/Users/ferrukon/Documents/Claude/Projects/Creación de Dashbords/acteck-dashboard/.env.local","utf8");
const url = env.match(/VITE_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const sb = createClient(url, key);

function parseCSVRow(line) {
  const fields = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { q = !q; continue; }
    if (c === ',' && !q) { fields.push(cur); cur = ""; continue; }
    cur += c;
  }
  fields.push(cur);
  return fields;
}

const text = fs.readFileSync("/Users/ferrukon/Downloads/Reporte-SellOut_Ventas Semanal Acteck_Revko.csv","utf8");
const lines = text.split(/\r?\n/).filter(l => l.trim());
const cols = parseCSVRow(lines[0]).map(c => c.trim());
const detalleRows = [];
const skuMensual = {};
for (let i = 1; i < lines.length; i++) {
  const f = parseCSVRow(lines[i]);
  const r = {}; cols.forEach((c,j) => r[c] = f[j]);
  const fecha = r.Fecha;
  const noParte = r["Numero de parte"];
  if (!fecha || !noParte) continue;
  const cantidad = Number(r.Cantidad) || 0;
  const totalSinIVA = Number(r.total_venta_antes_IVA) || 0;
  const totalConIVA = Number(r.total_venta) || 0;
  const precioSinIVA = Number(r.precio_venta_antes_IVA) || 0;
  detalleRows.push({
    cliente: "dicotech",
    fecha,
    marca: r.Marca || null,
    no_parte: noParte,
    descripcion: r.Descripcion || null,
    cantidad,
    precio: precioSinIVA,
    descuento: 0,
    iva: Math.max(0, totalConIVA - totalSinIVA),
    subtotal: totalSinIVA,
    total: totalConIVA,
    row_hash: String(r.Venta || `${fecha}-${noParte}-${i}`),
  });
  const [anio, mes] = fecha.split("-");
  const key = `${anio}-${mes}-${noParte}`;
  if (!skuMensual[key]) skuMensual[key] = { cliente: "dicotech", anio: Number(anio), mes: Number(mes), sku: noParte, piezas: 0, monto_pesos: 0 };
  skuMensual[key].piezas += cantidad;
  skuMensual[key].monto_pesos += totalSinIVA;
}

console.log(`Filas válidas: ${detalleRows.length} · SKUs únicos: ${Object.keys(skuMensual).length}`);

// Para el upsert de sellout_sku, necesito SUMAR con lo que ya esté en BD
// (porque pueden haber más ventas del mismo mes en el histórico)
// Solución: hacer SELECT del mes existente, sumar y upsertar.
const mesesAfectados = new Set();
Object.values(skuMensual).forEach(r => mesesAfectados.add(`${r.anio}-${r.mes}`));
console.log(`Meses afectados: ${[...mesesAfectados].join(", ")}`);

for (const ym of mesesAfectados) {
  const [a, m] = ym.split("-").map(Number);
  // Trae lo existente para esos SKUs en ese mes
  const skusEnMes = Object.values(skuMensual).filter(r => r.anio === a && r.mes === m).map(r => r.sku);
  const { data: existing } = await sb.from("sellout_sku")
    .select("sku,piezas,monto_pesos")
    .eq("cliente","dicotech").eq("anio",a).eq("mes",m)
    .in("sku", skusEnMes);
  const existingMap = {};
  (existing || []).forEach(r => { existingMap[r.sku] = { p: Number(r.piezas)||0, m: Number(r.monto_pesos)||0 }; });
  // Suma con lo nuevo
  for (const r of Object.values(skuMensual).filter(r => r.anio === a && r.mes === m)) {
    const prev = existingMap[r.sku] || { p: 0, m: 0 };
    r.piezas = prev.p + r.piezas;
    r.monto_pesos = Math.round((prev.m + r.monto_pesos) * 100) / 100;
  }
}

// 1) Insert sellout_detalle por chunks (upsert para idempotencia si re-corres)
console.log("\n─── sellout_detalle ───");
const CHUNK = 200;
let inserted = 0;
for (let i = 0; i < detalleRows.length; i += CHUNK) {
  const slice = detalleRows.slice(i, i + CHUNK);
  const { error } = await sb.from("sellout_detalle").upsert(slice, { onConflict: "cliente,fecha,no_parte,row_hash" });
  if (error) { console.error(error.message); process.exit(1); }
  inserted += slice.length;
}
console.log(`  ✓ ${inserted} filas`);

// 2) Upsert sellout_sku (ahora con suma incluida)
console.log("\n─── sellout_sku ───");
const skuRows = Object.values(skuMensual);
let upserted = 0;
for (let i = 0; i < skuRows.length; i += CHUNK) {
  const slice = skuRows.slice(i, i + CHUNK);
  const { error } = await sb.from("sellout_sku").upsert(slice, { onConflict: "cliente,sku,anio,mes" });
  if (error) { console.error(error.message); process.exit(1); }
  upserted += slice.length;
}
console.log(`  ✓ ${upserted} filas`);
console.log("\n═══ DONE ═══");
