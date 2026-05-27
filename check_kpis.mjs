import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = fs.readFileSync("/Users/ferrukon/Documents/Claude/Projects/Creación de Dashbords/acteck-dashboard/.env.local","utf8");
const url = env.match(/VITE_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const sb = createClient(url, key);

const { data: kpis } = await sb.from("evaluaciones_kpis_template").select("*").order("orden", { nullsFirst: false });
console.log(`Total KPIs template: ${kpis?.length || 0}\n`);
(kpis || []).forEach(k => {
  console.log(`[${k.activo ? "ON " : "off"}] orden=${k.orden ?? "?"} peso=${k.peso} · ${k.nombre || k.descripcion || k.id}`);
  console.log(`     desc: ${(k.descripcion || "").slice(0, 130)}`);
});

const { data: evs } = await sb.from("evaluaciones").select("*").order("semana_inicio",{ascending:false}).limit(5);
console.log(`\n─── Últimas 5 evaluaciones ───`);
(evs || []).forEach(e => console.log(`  ${e.semana_inicio} cerrada=${e.cerrada} score_base=${e.score_base} bonus=${e.bonus_pts} final=${e.score_final}`));

const { data: lin } = await sb.from("evaluacion_lineas").select("*").limit(5);
console.log(`\n─── Sample líneas (${lin?.length || 0}) ───`);
(lin || []).forEach(l => console.log(`  evaluacion=${l.evaluacion_id?.slice(0,8)}... kpi=${l.kpi_id?.slice(0,8)}... peso=${l.peso_aplicado} valor=${l.valor} pts=${l.puntos}`));
