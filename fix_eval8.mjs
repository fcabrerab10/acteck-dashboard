import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = fs.readFileSync("/Users/ferrukon/Documents/Claude/Projects/Creación de Dashbords/acteck-dashboard/.env.local","utf8");
const url = env.match(/VITE_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const sb = createClient(url, key);

const evalId = 8;
const { data: kpis } = await sb.from("evaluaciones_kpis_template").select("id, peso, valor_pesos").eq("activo", true);
console.log(`KPIs activos: ${kpis?.length}`);

const lineasToInsert = kpis.map((k) => ({
  evaluacion_id: evalId,
  kpi_id: k.id,
  peso_aplicado: k.peso,
  valor_pesos_aplicado: k.valor_pesos || 0,
  calificacion: 5,        // default = excelente
  auto_sugerido: 100,
  puntaje: k.peso,         // (5/5) * peso
}));

const { data, error } = await sb.from("evaluacion_lineas").insert(lineasToInsert).select();
if (error) { console.error(error); process.exit(1); }
console.log(`✓ ${data.length} líneas creadas para eval id=${evalId}`);
