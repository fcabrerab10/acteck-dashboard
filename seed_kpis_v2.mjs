import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = fs.readFileSync("/Users/ferrukon/Documents/Claude/Projects/Creación de Dashbords/acteck-dashboard/.env.local","utf8");
const url = env.match(/VITE_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const sb = createClient(url, key);

const kpis = [
  // S1: REGISTRO Y CONCILIACIÓN ($1,500 · 25%)
  { seccion: "registro_pagos", orden: 1, peso: 8, valor_pesos: 500, automatico: false,
    nombre: "Pagos registrados en dashboard a tiempo",
    descripcion: "% de pagos del periodo dados de alta el mismo día/semana de ejecución, sin atrasos." },
  { seccion: "registro_pagos", orden: 2, peso: 9, valor_pesos: 500, automatico: false,
    nombre: "Clasificación correcta de pagos",
    descripcion: "Cada pago lleva categoría correcta (marketing/promociones/rebate/spiff), fondo del que sale y cliente correcto. Sin reclasificaciones." },
  { seccion: "registro_pagos", orden: 3, peso: 8, valor_pesos: 500, automatico: false,
    nombre: "Conciliación de fondos al cierre del mes",
    descripcion: "Saldos del Fondo MKT Cliente, Fondo Interno y caja cuadran con los movimientos del mes. Sin diferencias sin explicar." },
  // S2: EJECUCIÓN MKT ($1,500 · 25%)
  { seccion: "ejecucion_mkt", orden: 1, peso: 8, valor_pesos: 500, automatico: true,
    nombre: "% Actividades MKT Digitalife completadas",
    descripcion: "Del plan mensual MKT de Digitalife, % ejecutadas a tiempo y en formato planeado." },
  { seccion: "ejecucion_mkt", orden: 2, peso: 8, valor_pesos: 500, automatico: true,
    nombre: "% Actividades MKT PCEL completadas",
    descripcion: "Del plan mensual MKT de PCEL, % ejecutadas a tiempo." },
  { seccion: "ejecucion_mkt", orden: 3, peso: 9, valor_pesos: 500, automatico: true,
    nombre: "% Actividades MKT Dicotech completadas",
    descripcion: "Del plan mensual MKT de Dicotech (cliente nuevo, mayor foco), % ejecutadas a tiempo." },
  // S3: ATENCIÓN A CLIENTES ($1,200 · 20%)
  { seccion: "atencion_clientes", orden: 1, peso: 5, valor_pesos: 300, automatico: false,
    nombre: "Tiempo de respuesta a correos < 3h",
    descripcion: "% de correos del cliente respondidos en <3h durante jornada laboral." },
  { seccion: "atencion_clientes", orden: 2, peso: 7, valor_pesos: 400, automatico: false,
    nombre: "Reclamos gestionados < 24h",
    descripcion: "% de reclamos (productos dañados, diferencias en factura, demoras, MKT pendiente) atendidos en <24h." },
  { seccion: "atencion_clientes", orden: 3, peso: 8, valor_pesos: 500, automatico: true,
    nombre: "Seguimiento a compromisos de minutas",
    descripcion: "De los compromisos pactados en minutas con cliente, % cumplidos en la fecha pactada." },
  // S4: PROPUESTAS Y CARGAS ($600 · 10%)
  { seccion: "propuestas_cargas", orden: 1, peso: 5, valor_pesos: 300, automatico: false,
    nombre: "Calidad de propuestas armadas",
    descripcion: "Las propuestas (resurtido, introducción de nuevos productos) tienen datos sólidos, formato profesional y entregadas a tiempo." },
  { seccion: "propuestas_cargas", orden: 2, peso: 5, valor_pesos: 300, automatico: false,
    nombre: "Cargas de datos al dashboard a tiempo",
    descripcion: "Sellout, estados de cuenta, ERP y otros archivos subidos en plazo razonable (semanal/diario según aplique)." },
  // S5: APOYO COMERCIAL ($600 · 10%)
  { seccion: "apoyo_comercial", orden: 1, peso: 7, valor_pesos: 400, automatico: true,
    nombre: "% Cuotas mensuales cumplidas (3 clientes)",
    descripcion: "Promedio del cumplimiento de cuota Sell-In de Digitalife, PCEL y Dicotech (responsabilidad compartida con Fernando)." },
  { seccion: "apoyo_comercial", orden: 2, peso: 3, valor_pesos: 200, automatico: false,
    nombre: "Iniciativas / mejoras propuestas",
    descripcion: "Propuestas concretas para mejorar procesos, automatizar tareas o aumentar productividad. Mínimo 1 por mes con plan." },
  // S6: COMPETENCIAS ($600 · 10%)
  { seccion: "competencias", orden: 1, peso: 2, valor_pesos: 200, automatico: false,
    nombre: "Aprendizaje continuo",
    descripcion: "Aplicación de aprendizajes recientes en su trabajo diario. Resuelve hoy lo que antes preguntaba." },
  { seccion: "competencias", orden: 2, peso: 2, valor_pesos: 100, automatico: false,
    nombre: "Comunicación efectiva",
    descripcion: "Claridad escrita y verbal con clientes y equipo interno. Mensajes precisos, escucha activa." },
  { seccion: "competencias", orden: 3, peso: 2, valor_pesos: 100, automatico: false,
    nombre: "Trabajo en equipo y proactividad",
    descripcion: "Colaboración con equipo interno y marcas. Anticipación de necesidades sin esperar instrucción." },
  { seccion: "competencias", orden: 4, peso: 2, valor_pesos: 100, automatico: false,
    nombre: "Adaptabilidad ante cambios",
    descripcion: "Capacidad de reajustar prioridades cuando cambian los planes." },
  { seccion: "competencias", orden: 5, peso: 2, valor_pesos: 100, automatico: false,
    nombre: "Profesionalismo y ética",
    descripcion: "Responsabilidad, puntualidad, discreción con información sensible (cuota mínima interna, márgenes, etc.)." },
];

const totPeso = kpis.reduce((s,k) => s + k.peso, 0);
const totValor = kpis.reduce((s,k) => s + k.valor_pesos, 0);
console.log(`Total: ${kpis.length} KPIs · peso=${totPeso} · valor=$${totValor.toLocaleString("es-MX")}`);
if (totPeso !== 100 || totValor !== 6000) { console.error("⚠ No cuadra"); process.exit(1); }

// Borrar cualquier siembra previa de KPIs nuevos (idempotente — busca por seccion no nula y activo=true)
// Pero no quiero borrar los inactivos viejos. Borro solo los que tienen seccion populated y activo=true.
await sb.from("evaluaciones_kpis_template").delete().eq("activo", true).not("seccion","is",null);

const { data, error } = await sb.from("evaluaciones_kpis_template")
  .insert(kpis.map(k => ({ ...k, activo: true })))
  .select();
if (error) { console.error(error.message); process.exit(1); }
console.log(`✓ ${data.length} KPIs activos sembrados\n`);

const porSec = {};
data.forEach(k => {
  if (!porSec[k.seccion]) porSec[k.seccion] = { count:0, valor:0, peso:0 };
  porSec[k.seccion].count++; porSec[k.seccion].valor += Number(k.valor_pesos); porSec[k.seccion].peso += Number(k.peso);
});
for (const [s, i] of Object.entries(porSec)) {
  console.log(`  ${s.padEnd(22)} ${i.count} KPIs · ${i.peso}% · $${i.valor.toLocaleString("es-MX")}`);
}
