// Lectura de vistas en SQL Server (driver puro JS: mssql/tedious, sin ODBC).
import sql from 'mssql';
import { log } from './util.mjs';

/** Config de conexión desde variables `<PREFIX>_SQL_HOST|PORT|DB|USER|PASS`. */
export function serverConfig(prefix) {
  const e = (k) => process.env[`${prefix}_SQL_${k}`];
  const host = e('HOST');
  if (!host) throw new Error(`${prefix}_SQL_HOST no configurado en .env`);
  return {
    server: host,
    port: parseInt(e('PORT') || '1433', 10),
    database: e('DB') || undefined,
    user: e('USER'),
    password: e('PASS'),
    connectionTimeout: 20_000,
    requestTimeout: 30 * 60_000,
    pool: { max: 2, min: 0 },
    options: {
      encrypt: String(process.env.SQL_ENCRYPT || 'false') === 'true',
      trustServerCertificate: String(process.env.SQL_TRUST_CERT || 'true') === 'true',
      useUTC: false,              // DATE/DATETIME del ERP se leen tal cual (hora local)
      enableArithAbort: true,
      appName: 'acteck-sync-bridge',
    },
  };
}

/** Sanitiza un nombre de vista ([dbo].[Vw_X], dbo.Vw_X, Vw_X). */
export function viewName(v) {
  const clean = String(v || '').trim();
  if (!/^[\w\[\]\.]+$/.test(clean)) throw new Error(`Nombre de vista inválido: ${v}`);
  return clean.split('.').map((p) => `[${p.replace(/^\[|\]$/g, '')}]`).join('.');
}

const pools = new Map();
export async function getPool(prefix) {
  if (pools.has(prefix)) return pools.get(prefix);
  const cfg = serverConfig(prefix);
  log(`  conectando a ${prefix} ${cfg.server}:${cfg.port}${cfg.database ? '/' + cfg.database : ''} como ${cfg.user}…`);
  const pool = await new sql.ConnectionPool(cfg).connect();
  pools.set(prefix, pool);
  return pool;
}
export async function closeAll() {
  for (const p of pools.values()) { try { await p.close(); } catch { /* ignore */ } }
  pools.clear();
}

/**
 * Lee una vista completa por streaming y aplica `mapRow` a cada fila
 * (las que regresan null se descartan). Devuelve { rows, leidas }.
 */
export async function readView(prefix, view, { where = '', top = 0, mapRow = (r) => r, onProgress } = {}) {
  const pool = await getPool(prefix);
  const q = `SELECT ${top > 0 ? `TOP (${parseInt(top, 10)}) ` : ''}* FROM ${viewName(view)}${where ? ' WHERE ' + where : ''}`;
  log(`  SQL: ${q}`);
  const request = pool.request();
  request.stream = true;
  const rows = []; let leidas = 0;
  await new Promise((resolve, reject) => {
    request.on('row', (r) => {
      leidas++;
      const m = mapRow(r);
      if (m) rows.push(m);
      if (onProgress && leidas % 25_000 === 0) onProgress(leidas);
    });
    request.on('error', reject);
    request.on('done', resolve);
    request.query(q);
  });
  return { rows, leidas };
}

/** Prueba de conexión: SELECT @@VERSION + conteo de la vista. */
export async function testServer(prefix, view) {
  const pool = await getPool(prefix);
  const v = await pool.request().query('SELECT @@VERSION AS v');
  log(`  ${prefix}: ${String(v.recordset[0].v).split('\n')[0]}`);
  if (view) {
    const c = await pool.request().query(`SELECT COUNT(*) AS n FROM ${viewName(view)}`);
    log(`  ${prefix}: ${view} → ${c.recordset[0].n} filas`);
    const s = await pool.request().query(`SELECT TOP (1) * FROM ${viewName(view)}`);
    log(`  ${prefix}: columnas → ${Object.keys(s.recordset[0] || {}).join(', ')}`);
  }
}
