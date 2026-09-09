#!/usr/bin/env node
// Puente de sincronización · acteck-dashboard
//
//   node --env-file=credenciales.env sync.mjs <fuentes…> [--dry-run] [--top N] [--anios 2025,2026] [--dias 45]
//
// Fuentes: ventas inventario precios compras cuotas sellout embarques
//          erp  = ventas + inventario + precios (+ compras si está configurado)
//          all  = todo lo configurado
//          test = prueba de conexión a cada SQL Server, al Sheet y al dashboard
//
// Cada fuente lee la vista/hoja, mapea con las MISMAS reglas que uploads.html
// y sube por /api/import-central. Al terminar deja un sync_event (historial
// del uploader) con filas, duración y errores.
import * as M from './lib/mappers.mjs';
import { readView, testServer, closeAll } from './lib/mssql.mjs';
import { upsertRows, finalizeErpVentas, logSyncEvent, ping, describirTransporte, DIRECTO } from './lib/api.mjs';
import { leerHoja, listarHojas, describirModo } from './lib/sheets.mjs';
import { upsertEmbarquesCompras } from './lib/embarques.mjs';
import { HOJAS_HISTORICAS, HOJAS_SECUNDARIAS, transformEmbarques, anioDeHoja } from '../api/_embarques.js';
import { log } from './lib/util.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const dryRun = flag('--dry-run');
const top = parseInt(opt('--top') || '0', 10);
const env = (k, d = '') => (process.env[k] ?? d).trim();

// Ventas: dos modos.
//   · ventana (default): sólo los últimos ERP_VENTAS_DIAS días (o --dias N) por `periodo`;
//     se borra esa ventana en Supabase y se reinserta. Es lo que corre cada hora.
//   · completo: --anios 2025,2026 (o ERP_VENTAS_ANIOS) reemplaza el año entero.
//     Sirve para la carga inicial o para recargar un año viejo.
const aniosVentas = () => {
  const raw = opt('--anios') || env('ERP_VENTAS_ANIOS');
  const list = raw ? raw.split(',').map((a) => parseInt(a, 10)).filter(Boolean) : [];
  return [...new Set(list)].sort();
};
const diasVentas = () => parseInt(opt('--dias') || env('ERP_VENTAS_DIAS', '45'), 10) || 45;
const isoDia = (d) => d.toISOString().slice(0, 10);
const inList = (col, vals) => `${col} IN (${vals.join(',')})`;

// ── Definición de fuentes ───────────────────────────────────────────────────
// src_id / status_key = ids de las tarjetas de uploads.html (mismo historial).
const FUENTES = {
  ventas: {
    src_id: 'erp-updates', status_key: 'erp_sell_in', enabled: () => env('ERP_SQL_HOST'),
    run: async () => {
      const anios = aniosVentas();
      const completo = anios.length > 0;
      const desde = completo ? null : isoDia(new Date(Date.now() - diasVentas() * 86400000));
      const where = completo ? inList('anio', anios) : `periodo >= '${desde}'`;
      const { rows, leidas } = await readView('ERP', env('ERP_VIEW_VENTAS', 'Vw_TablaH_Ventas'), {
        where, top, mapRow: M.erpVentas, onProgress: (n) => log(`  leídas ${n}…`),
      });
      const aniosPresentes = completo ? anios.filter((a) => rows.some((r) => r.anio === a)) : [...new Set(rows.map((r) => r.anio).filter(Boolean))].sort();
      log(`  ventas: ${leidas} leídas → ${rows.length} válidas · ${completo ? 'años ' + anios.join(',') : 'ventana desde ' + desde + ' (' + diasVentas() + ' días)'}`);
      // Chunks chicos y poca concurrencia: erp_ventas dispara statement timeout (57014) en
      // Supabase con 1000 filas por request (comprobado 2026-09-09 con 63,740 filas).
      const opts = { dryRun, chunk: 200, concurrency: 2 };
      if (completo) opts.deleteAnios = aniosPresentes; else opts.deleteWhere = `periodo=gte.${desde}`;
      await upsertRows('erp_ventas', 'venta_id,venta_renglon', rows, opts);
      if (rows.length) {
        log(`  finalize: refresh_facturacion_clientes(${aniosPresentes.join(',')})`);
        const f = await finalizeErpVentas(aniosPresentes, { dryRun });
        if (f?.resumen) log('  resumen:', JSON.stringify(f.resumen).slice(0, 400));
      }
      return { filas: rows.length, detalles: { anios: aniosPresentes, leidas, ...(desde ? { desde } : {}) } };
    },
  },
  inventario: {
    src_id: 'erp-updates', status_key: 'erp_inventario', enabled: () => env('ERP_SQL_HOST'),
    run: async () => {
      const { rows, leidas } = await readView('ERP', env('ERP_VIEW_INVENTARIO', 'Vw_TablaH_Inventario'), { top, mapRow: M.erpInventario });
      log(`  inventario: ${leidas} leídas → ${rows.length} válidas`);
      await upsertRows('inventario_acteck', 'articulo,no_almacen', rows, { deleteAll: true, dryRun });
      return { filas: rows.length, detalles: { leidas } };
    },
  },
  precios: {
    src_id: 'erp-updates', status_key: 'precios', enabled: () => env('ERP_SQL_HOST'),
    run: async () => {
      const now = new Date(); const ctx = { anio: now.getFullYear(), mes: now.getMonth() + 1 };
      const { rows, leidas } = await readView('ERP', env('ERP_VIEW_PRECIOS', 'Vw_TablaM_Precios'), { top, mapRow: (r) => M.preciosERP(r, ctx) });
      log(`  precios: ${leidas} leídas → ${rows.length} válidas (listas incluidas, ${ctx.anio}-${ctx.mes})`);
      await upsertRows('precios_sku', 'sku,lista,anio,mes', rows, { deleteAll: true, dryRun });
      return { filas: rows.length, detalles: { leidas, periodo: `${ctx.anio}-${ctx.mes}` } };
    },
  },
  compras: {
    src_id: 'erp-updates', status_key: 'compras_oc', enabled: () => env('ERP_SQL_HOST') && env('ERP_VIEW_COMPRAS'),
    run: async () => {
      const { rows, leidas } = await readView('ERP', env('ERP_VIEW_COMPRAS'), { top, mapRow: M.comprasOC });
      log(`  compras: ${leidas} leídas → ${rows.length} con pendiente > 0`);
      await upsertRows('compras_oc', 'movid,articulo', rows, { deleteAll: true, dryRun });
      return { filas: rows.length, detalles: { leidas } };
    },
  },
  cuotas: {
    src_id: 'cuotas-anuales', status_key: 'cuotas_mensuales', enabled: () => env('CUOTAS_SQL_HOST') && env('CUOTAS_VIEW'),
    run: async () => {
      const cols = env('CUOTAS_COLS', 'IDCLIENTE,NOMBRECLIENTE,FECHA,CUOTAMINIMA,IMPORTEDEVENTA').split(',').map((s) => s.trim());
      if (cols.length < 4) throw new Error('CUOTAS_COLS debe ser: idcliente,nombrecliente,fecha,cuota_minima[,cuota_vendor]');
      const { rows: crudas, leidas } = await readView('CUOTAS', env('CUOTAS_VIEW'), { top, mapRow: (r) => r });
      const rows = M.cuotasDesdeBP(crudas, { cols });
      const anios = [...new Set(rows.map((r) => r.anio))].sort();
      const clientes = [...new Set(rows.map((r) => r.cliente))].sort();
      log(`  cuotas: ${leidas} leídas → ${rows.length} cliente-mes · años ${anios.join(',')} · ${clientes.length} clientes: ${clientes.join(', ')}`);
      await upsertRows('cuotas_mensuales', 'cliente,mes,anio', rows, { deleteAnios: anios, dryRun });
      return { filas: rows.length, detalles: { anios, leidas } };
    },
  },
  sellout: {
    src_id: 'sellout-general', status_key: 'sellout_general', enabled: () => env('SELLOUT_SQL_HOST') && env('SELLOUT_VIEW'),
    run: async () => {
      const dias = parseInt(env('SELLOUT_SINCE_DAYS', '45'), 10);
      const col = env('SELLOUT_FECHA_COL', 'fecha');
      if (!/^[\w\[\]]+$/.test(col)) throw new Error('SELLOUT_FECHA_COL inválido');
      const where = dias > 0 ? `${col} >= DATEADD(day, -${dias}, CAST(GETDATE() AS date))` : '';
      const { rows, leidas } = await readView('SELLOUT', env('SELLOUT_VIEW'), { where, top, mapRow: M.selloutGeneral });
      log(`  sellout: ${leidas} leídas → ${rows.length} con id · ventana ${dias} días`);
      await upsertRows('sellout_general', 'id', rows, { dryRun });
      return { filas: rows.length, detalles: { leidas, since_days: dias } };
    },
  },
  embarques: {
    src_id: 'master-embarques', status_key: 'embarques', enabled: () => env('MASTER_EMBARQUES_SHEET_ID'),
    run: async () => {
      log(`  modo: ${describirModo()}`);
      const titulos = await listarHojas();
      if (titulos) log(`  pestañas: ${titulos.join(' · ')}`);
      const existe = (n) => (titulos ? titulos.includes(n) : true);
      const detalles = {};
      // 1) Hojas históricas → embarques_compras (todas juntas, dedupe por po,codigo,contenedor)
      let hist = [];
      for (const h of HOJAS_HISTORICAS) {
        if (!existe(h)) continue;
        const raw = await leerHoja(h);
        if (!raw || raw.length < 2) continue;
        const rows = transformEmbarques(raw, { anioDefault: anioDeHoja(h) });
        log(`  hoja "${h}": ${raw.length - 1} filas → ${rows.length} válidas`);
        detalles[h] = rows.length;
        hist = hist.concat(rows);
      }
      let total = await upsertEmbarquesCompras(hist, { dryRun });
      // 2) Hojas secundarias (Programación Arribos, SN, Proveedores)
      const cacheRaw = new Map();
      for (const sec of HOJAS_SECUNDARIAS) {
        const nombre = sec.sheets.find(existe);
        if (!nombre) continue;
        if (!cacheRaw.has(nombre)) cacheRaw.set(nombre, await leerHoja(nombre));
        const raw = cacheRaw.get(nombre);
        if (!raw || raw.length < 2) continue;
        const rows = sec.transform(raw);
        log(`  hoja "${nombre}" → ${sec.table}: ${rows.length} filas`);
        detalles[sec.table] = rows.length;
        const onConflict = { programacion_arribos: 'contenedor', series_generadas: 'po,sku', proveedores_master: 'codigo,articulo', catalogo_articulos: 'articulo' }[sec.table];
        await upsertRows(sec.table, onConflict, rows, { dryRun });
        total += rows.length;
      }
      return { filas: total, detalles };
    },
  },
};
const GRUPOS = { erp: ['ventas', 'inventario', 'precios', 'compras'], all: Object.keys(FUENTES) };

// ── Ejecución ───────────────────────────────────────────────────────────────
async function correr(nombre) {
  const f = FUENTES[nombre];
  if (!f.enabled()) { log(`▸ ${nombre}: no configurado en credenciales.env — se omite`); return { nombre, skipped: true }; }
  log(`▸ ${nombre}${dryRun ? ' (dry-run)' : ''}${top ? ` (top ${top})` : ''} · ${describirTransporte()}`);
  const t0 = Date.now();
  try {
    const r = await f.run();
    const duracion_ms = Date.now() - t0;
    log(`✓ ${nombre}: ${r.filas} filas en ${(duracion_ms / 1000).toFixed(1)}s`);
    if (!top) await logSyncEvent(tablaDe(nombre), { src_id: f.src_id, status_key: f.status_key, status: 'success', filas: r.filas, duracion_ms, detalles: { tipo: 'sync-sql', fuente: nombre, ...r.detalles } }, { dryRun });
    return { nombre, ok: true, filas: r.filas, duracion_ms };
  } catch (e) {
    const duracion_ms = Date.now() - t0;
    log(`✗ ${nombre}: ${e.message}`);
    await logSyncEvent(tablaDe(nombre), { src_id: f.src_id, status_key: f.status_key, status: 'error', duracion_ms, detalles: { tipo: 'sync-sql', fuente: nombre, mensaje: String(e.message).slice(0, 500) } }, { dryRun });
    return { nombre, ok: false, error: e.message };
  }
}
// import-central exige una tabla válida en el body aunque sólo se registre un evento.
const tablaDe = (n) => ({ ventas: 'erp_ventas', inventario: 'inventario_acteck', precios: 'precios_sku', compras: 'compras_oc', cuotas: 'cuotas_mensuales', sellout: 'sellout_general', embarques: 'embarques_compras' }[n]);

async function test() {
  log('▸ test de conexiones');
  log(`  destino: ${describirTransporte()}`);
  const checks = [
    ['ERP', env('ERP_VIEW_VENTAS', 'Vw_TablaH_Ventas')], ['ERP', env('ERP_VIEW_INVENTARIO', 'Vw_TablaH_Inventario')], ['ERP', env('ERP_VIEW_PRECIOS', 'Vw_TablaM_Precios')],
    ['CUOTAS', env('CUOTAS_VIEW')], ['SELLOUT', env('SELLOUT_VIEW')],
  ];
  let fallas = 0;
  for (const [prefix, view] of checks) {
    if (!env(`${prefix}_SQL_HOST`)) { log(`  ${prefix}: sin host en credenciales.env — omitido`); continue; }
    try { await testServer(prefix, view || null); } catch (e) { fallas++; log(`  ✗ ${prefix}: ${e.message}`); }
  }
  if (env('MASTER_EMBARQUES_SHEET_ID')) {
    try {
      log(`  Sheet: ${describirModo()}`);
      const t = await listarHojas();
      if (t) log(`  Sheet: pestañas → ${t.join(' · ')}`);
      const raw = await leerHoja(String(new Date().getFullYear()));
      log(`  Sheet: hoja ${new Date().getFullYear()} → ${raw ? raw.length - 1 : 'no encontrada'} filas`);
    } catch (e) { fallas++; log(`  ✗ Sheet: ${e.message}`); }
  }
  try { await ping(); log(DIRECTO ? '  ✓ Supabase: service role key aceptado' : '  ✓ dashboard: SYNC_SECRET aceptado por /api/import-central'); }
  catch (e) { fallas++; log(`  ✗ destino: ${e.message}`); }
  return fallas;
}

(async () => {
  const pedidas = args.filter((a) => !a.startsWith('--') && a !== opt('--top') && a !== opt('--anios') && a !== opt('--dias'));
  if (!pedidas.length) { console.log('uso: sync.mjs <ventas|inventario|precios|compras|cuotas|sellout|embarques|erp|all|test> [--dry-run] [--top N] [--anios 2025,2026] [--dias 45]'); process.exit(2); }
  let exit = 0;
  try {
    if (pedidas.includes('test')) { exit = (await test()) ? 1 : 0; }
    else {
      const lista = [...new Set(pedidas.flatMap((p) => GRUPOS[p] || [p]))];
      const desconocidas = lista.filter((n) => !FUENTES[n]);
      if (desconocidas.length) throw new Error('fuente desconocida: ' + desconocidas.join(', '));
      const res = [];
      for (const n of lista) res.push(await correr(n));   // secuencial: no saturar el ERP ni Vercel
      const fallas = res.filter((r) => r.ok === false);
      log(`resumen: ${res.filter((r) => r.ok).length} ok · ${fallas.length} error · ${res.filter((r) => r.skipped).length} omitidas`);
      exit = fallas.length ? 1 : 0;
    }
  } catch (e) { log('✗', e.message); exit = 1; }
  finally { await closeAll(); }
  process.exit(exit);
})();
