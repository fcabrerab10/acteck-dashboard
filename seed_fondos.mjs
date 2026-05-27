import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = fs.readFileSync("/Users/ferrukon/Documents/Claude/Projects/Creación de Dashbords/acteck-dashboard/.env.local","utf8");
const url = env.match(/VITE_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const sb = createClient(url, key);

// 1) Actualizar lineamiento fondo_mkt con la estructura completa
const config = {
  frecuencia: "mensual",
  base: "sell_in",
  fondo_interno: {
    aporte_pct: 0.01,        // 1% siempre del sell-in mensual
    visible_para_cliente: false,
    descripcion: "Reserva interna de Acteck — NO visible al cliente"
  },
  fondo_mkt_cliente: {
    visible_para_cliente: true,
    descripcion: "Fondo MKT del cliente (lo conoce y usa)",
    tiers: [
      { min_alcance_q: 1.30, pct: 0.0125, label: "130% en adelante" },
      { min_alcance_q: 1.15, pct: 0.0100, label: "115% a 129.99%" },
      { min_alcance_q: 0.90, pct: 0.0075, label: "90% a 114.99%" }
    ],
    pct_fallback_q_bajo: 0.0075, // Si Q < 90%, igual genera 0.75%
    base_calculo: "sell_in_mes",
    alcance_referencia: "q_acumulado"
  },
  plan_mkt_contratado: {
    monto_mensual: 14007.14,
    meses_activos: [1,2,3,4,5,6,7,8,9,10,11,12], // todo el año
    orden_descuento: ["mkt_cliente", "interno"]   // cliente primero, interno si no alcanza
  }
};

const { error: e1 } = await sb.from("lineamientos_cliente").upsert(
  [{
    cliente: "dicotech", tipo: "fondo_mkt",
    config,
    descripcion: "Sistema de 2 fondos paralelos: (1) Fondo Interno 1% del sell-in mensual SIEMPRE (no visible al cliente). (2) Fondo MKT Cliente: tier % según alcance Q acumulado (0.75/1.00/1.25%); si Q<90% igual genera 0.75%. Plan MKT contratado $14,007.14 mensual sale del fondo cliente primero, del interno si no alcanza (saldo puede ir negativo).",
    notas: "Editable desde panel de Lineamientos. Cambiar montos/tiers/plan ajustando este JSON.",
    vigente_desde: "2026-01-01"
  }],
  { onConflict: "cliente,tipo" }
);
if (e1) { console.error(e1.message); process.exit(1); }
console.log("✓ Lineamiento fondo_mkt actualizado");

// 2) Quitar la provisión Q1 trimestral vieja (vamos a regenerar todo mensual)
const { error: e2 } = await sb.from("provisiones_fondo").delete().eq("cliente","dicotech");
if (e2) console.error(e2.message);
else console.log("✓ Provisión Q1 trimestral vieja eliminada (se regenera mensual)");

// Función auxiliar: encontrar tier
function tierPct(alcance) {
  if (alcance >= 1.30) return 0.0125;
  if (alcance >= 1.15) return 0.0100;
  if (alcance >= 0.90) return 0.0075;
  return 0.0075; // fallback Q<90% — igual genera
}
function tierLabel(alcance) {
  if (alcance >= 1.30) return "130% en adelante";
  if (alcance >= 1.15) return "115% a 129.99%";
  if (alcance >= 0.90) return "90% a 114.99%";
  return "<90% (fallback 0.75%)";
}

// 3) Backfill: generación mensual para meses con sell-in
const { data: si } = await sb.from("sell_in_sku").select("mes,monto_pesos").eq("cliente","dicotech").eq("anio",2026);
const { data: cuotas } = await sb.from("cuotas_mensuales").select("mes,cuota_min").eq("cliente","dicotech").eq("anio",2026);

const siByMes = {}; si.forEach(r => { siByMes[r.mes] = (siByMes[r.mes]||0) + Number(r.monto_pesos); });
const cuotaByMes = {}; cuotas.forEach(r => { cuotaByMes[r.mes] = Number(r.cuota_min); });

const movimientos = [];
const mesesConDatos = Object.keys(siByMes).filter(m => siByMes[m] !== 0).map(Number).sort((a,b) => a-b);

for (const mes of mesesConDatos) {
  const sellInMes = siByMes[mes];
  const q = Math.ceil(mes / 3);
  const mesesQ = [(q-1)*3 + 1, (q-1)*3 + 2, (q-1)*3 + 3];
  // Alcance acumulado del Q HASTA el mes actual (no futuros)
  const sellInQ = mesesQ.filter(m => m <= mes).reduce((s,m) => s + (siByMes[m]||0), 0);
  const cuotaQ = mesesQ.reduce((s,m) => s + (cuotaByMes[m]||0), 0);
  const alcanceQ = cuotaQ > 0 ? sellInQ / cuotaQ : 0;
  
  // Fondo Interno: 1% × sell-in mes SIEMPRE
  movimientos.push({
    cliente: "dicotech", anio: 2026, mes, tipo_fondo: "interno",
    tipo_movimiento: "generacion",
    monto: Math.round(sellInMes * 0.01 * 100) / 100,
    base_calculo: sellInMes, pct_aplicado: 0.01,
    alcance_q: alcanceQ, trimestre: q,
    notas: `Auto-generación: 1.00% × $${sellInMes.toLocaleString("es-MX",{maximumFractionDigits:2})}`
  });

  // Fondo MKT Cliente: tier %
  const pct = tierPct(alcanceQ);
  const lbl = tierLabel(alcanceQ);
  movimientos.push({
    cliente: "dicotech", anio: 2026, mes, tipo_fondo: "mkt_cliente",
    tipo_movimiento: "generacion",
    monto: Math.round(sellInMes * pct * 100) / 100,
    base_calculo: sellInMes, pct_aplicado: pct,
    alcance_q: alcanceQ, trimestre: q,
    notas: `Auto-generación tier ${lbl}: ${(pct*100).toFixed(2)}% × $${sellInMes.toLocaleString("es-MX",{maximumFractionDigits:2})} · alcance Q${q} ${(alcanceQ*100).toFixed(1)}%`
  });
}

console.log(`\n─── Movimientos a insertar: ${movimientos.length} ───`);
movimientos.forEach(m => console.log(`  M${m.mes} ${m.tipo_fondo}: $${Number(m.monto).toLocaleString("es-MX",{maximumFractionDigits:2})}`));

const { error: e3 } = await sb.from("fondos_mkt_movimientos").upsert(movimientos, {
  onConflict: "cliente,anio,mes,tipo_fondo,tipo_movimiento", ignoreDuplicates: false
});
if (e3) { console.error(e3.message); process.exit(1); }
console.log("\n✓ Backfill completo");

// Resumen
const totIntGen = movimientos.filter(m => m.tipo_fondo === "interno").reduce((s,m) => s + Number(m.monto), 0);
const totCliGen = movimientos.filter(m => m.tipo_fondo === "mkt_cliente").reduce((s,m) => s + Number(m.monto), 0);
console.log(`\nFondo Interno YTD generado: $${totIntGen.toLocaleString("es-MX",{minimumFractionDigits:2})}`);
console.log(`Fondo MKT Cliente YTD generado: $${totCliGen.toLocaleString("es-MX",{minimumFractionDigits:2})}`);
