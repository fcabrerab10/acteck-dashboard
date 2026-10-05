// Acteck Ciudad · harness local sin sesión (2026-10-05).
//   node scripts/ciudad/preparar-harness.mjs            → arma .claude/proto/ con escena.js, modelo.js, el mapa y harness
//   node scripts/ciudad/preparar-harness.mjs --real     → además baja tus datos reales (SUPABASE_ACCESS_TOKEN de .env.local)
//                                                          y guarda modelo-real.json (NO se versiona: .claude/proto está en .gitignore)
// Luego: Browser pane → perfil «prototipo» (.claude/launch.json) → http://localhost:4174/ciudad-dev.html  (añade #real para tus datos)
import fs from 'node:fs'; import path from 'node:path';
const raiz = path.resolve(new URL('../..', import.meta.url).pathname);
const out = path.join(raiz, '.claude/proto'); fs.mkdirSync(out, { recursive: true });
const esc = fs.readFileSync(path.join(raiz, 'src/modules/ciudad/escena.js'), 'utf8')
  .replace("from './modelo';", "from './modelo.js';")
  .replace("from '../comercial/sellout/mexico-estados.json';", "from './mexico-estados.json' with { type: 'json' };");
fs.writeFileSync(path.join(out, 'escena.js'), esc);
fs.copyFileSync(path.join(raiz, 'src/modules/ciudad/modelo.js'), path.join(out, 'modelo.js'));
fs.copyFileSync(path.join(raiz, 'src/modules/comercial/sellout/mexico-estados.json'), path.join(out, 'mexico-estados.json'));
fs.copyFileSync(path.join(raiz, 'scripts/ciudad/harness.html'), path.join(out, 'ciudad-dev.html'));
console.log('harness listo en .claude/proto/');
if (process.argv.includes('--real')) {
  const env = Object.fromEntries(fs.readFileSync(path.join(raiz, '.env.local'), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
  const tok = env.SUPABASE_ACCESS_TOKEN; if (!tok) throw new Error('falta SUPABASE_ACCESS_TOKEN en .env.local');
  const q = async (query) => { const r = await fetch('https://api.supabase.com/v1/projects/hrhccvuhnedahznewgaj/database/query', { method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) }); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); };
  const hoy = new Date(); const anio = hoy.getFullYear(), mes = hoy.getMonth() + 1, mesPrev = mes === 1 ? 12 : mes - 1;
  const d = {
    perfiles: await q('select user_id,nombre,email,puesto,rol,tipo,activo,avatar_url from perfiles'),
    inventario: await q('select inv_actual,inv_actual_piezas,dias_inv,skus_con_stock,actualizado from v_medidas_inventario limit 1'),
    contenedores: await q('select contenedor,supplier,naviera,estatus,piezas,fob_usd,fecha_emision,fin_produccion,etd,eta_puerto,arribo_cedis from v_embarques_contenedor where arribo_cedis is null or arribo_cedis >= current_date - 40'),
    sucursales: await q(`select cuenta,anio,mes,sucursal,importe,vendedores,estado from mv_sellout_sucursal_mes where anio >= ${anio - 1}`),
    vendedoresMayoristas: await q(`select cuenta,anio,mes,vendedor,importe,sucursal from mv_sellout_vendedor_mes where anio = ${anio}`),
    vendedoresErp: await q(`select anio,vendedor,cliente_key,cliente_nombre,fact_neta from v_ventas_vendedor_cliente_mes where anio = ${anio}`),
    cuentas: await q('select cuenta,nombre,canal_sellout,erp_cliente,propio,tiene_sellout from v_sellout_cuentas'),
    facturas: await q('select cliente_key,folio,fecha,piezas,monto from v_erp_facturas_oc where fecha >= current_date - 10'),
    agendaHoy: await q('select propietario,responsables,estado,titulo,cuando,fecha_limite,inicio_real from agenda_items where cuando = current_date or fecha_limite = current_date'),
    reunionesHoy: await q('select titulo,fecha,duracion_min,tipo,cliente_key from agenda_reuniones where fecha::date = current_date'),
    cuentaMes: await q(`select cuenta,anio,mes,importe from v_sellout_cuenta_mes where anio >= ${anio - 1}`),
    clientesFinales: await q(`select cuenta,anio,mes,estado,importe from mv_sellout_cliente_final_mes where anio >= ${anio - (mes === 1 ? 1 : 0)} and mes in (${mes},${mesPrev})`),
    cartera: await q('select cliente,fecha_corte,saldo_actual,saldo_vencido,dso from v_vision_cartera_consolidada'),
    envios: await q("select e.fecha_surtida,e.fecha_entregada,e.fecha_envio_erp,e.fecha_entrega_erp,e.guia_rastreo,e.paqueteria, json_build_object('cliente_key',c.cliente_key,'numero_oc',c.numero_oc) as oc_clientes from oc_envios e join oc_clientes c on c.id=e.oc_id where coalesce(e.fecha_surtida,e.fecha_envio_erp) >= current_date - 30"),
  };
  const { construirModelo } = await import(path.join(raiz, 'src/modules/ciudad/modelo.js'));
  const m = construirModelo(d, hoy);
  fs.writeFileSync(path.join(out, 'modelo-real.json'), JSON.stringify(m));
  console.log('modelo real:', m.kpis);
}
