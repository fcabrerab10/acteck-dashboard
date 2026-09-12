// Verificación previa al deploy (corre en `prebuild`, así que también en Vercel antes de construir).
// Falla con un mensaje claro cuando algo rompería el despliegue:
//   1. Más de 12 funciones serverless en api/ (límite del plan Hobby de Vercel).
//   2. vercel.json inválido o con más crons de los permitidos.
//   3. Algún archivo de api/ que no se pueda importar en Node (import roto, JSX, etc.).
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const LIMITE_FUNCIONES = 12;
const LIMITE_CRONS = 20;
const raiz = process.cwd();
const errores = [];

function funciones(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { out.push(...funciones(p)); continue; }
    if (n.startsWith('_')) continue; // helpers, no son funciones
    if (/\.(js|mjs|ts)$/.test(n)) out.push(p);
  }
  return out;
}

const fns = funciones(join(raiz, 'api'));
if (fns.length > LIMITE_FUNCIONES) {
  errores.push(`api/ tiene ${fns.length} funciones serverless y Vercel (plan Hobby) permite ${LIMITE_FUNCIONES}. Fusiona endpoints (p. ej. varias acciones en uno con ?action=) o quita alguno:\n  - ${fns.map((f) => relative(raiz, f)).join('\n  - ')}`);
}

try {
  const vj = JSON.parse(readFileSync(join(raiz, 'vercel.json'), 'utf8'));
  const crons = vj.crons || [];
  if (crons.length > LIMITE_CRONS) errores.push(`vercel.json tiene ${crons.length} crons (límite ${LIMITE_CRONS}).`);
  for (const c of crons) {
    if (!c.path?.startsWith('/api/')) errores.push(`cron con path inválido: ${c.path}`);
    if (!/^(\S+\s+){4}\S+$/.test(c.schedule || '')) errores.push(`cron con schedule inválido: ${c.schedule} (${c.path})`);
  }
} catch (e) { errores.push(`vercel.json no se pudo leer: ${e.message}`); }

for (const f of fns) {
  try { await import(pathToFileURL(f).href); }
  catch (e) { errores.push(`${relative(raiz, f)} no se puede importar en Node: ${String(e.message).split('\n')[0]}`); }
}

if (errores.length) {
  console.error('\n✖ Verificación de deploy fallida:\n');
  for (const e of errores) console.error(`• ${e}\n`);
  process.exit(1);
}
console.log(`✓ Deploy verificado: ${fns.length}/${LIMITE_FUNCIONES} funciones, vercel.json OK, imports OK.`);
