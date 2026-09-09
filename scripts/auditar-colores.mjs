#!/usr/bin/env node
// Auditoría de colores fijos que rompen el modo Midnight.
//
// Recorre src/**/*.{jsx,js} y lista, por archivo, las ocurrencias de:
//   - hex        → literales #RRGGBB / #RGB
//   - rgb        → rgb(...) / rgba(...) con valores fijos (se toleran overlays
//                  rgba(0,0,0,a) / rgba(255,255,255,a) con a <= 0.12)
//   - tailwind   → clases de color (text-gray-500, bg-white, border-red-200,
//                  divide-…, ring-…, etc.)
//
// Excluye: src/lib/themeTokens.js, src/components/kit/** y las líneas que viven
// dentro de bloques de paleta declarados como objetos (PALETTE, TIPOS, MARCAS,
// CATEGORIA_META, COLS_*).
//
// Uso:   node scripts/auditar-colores.mjs
// Salida: tabla en consola + docs/AUDITORIA_COLORES.md
//
// Sin dependencias (solo node:fs / node:path).

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = join(ROOT, 'src');
const OUT_MD = join(ROOT, 'docs', 'AUDITORIA_COLORES.md');

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

const EXCLUDE_FILES = new Set(['src/lib/themeTokens.js']);
const EXCLUDE_DIRS = ['src/components/kit'];

// Nombres de constantes cuyo bloque `{ … }` se omite completo.
const PALETTE_CONST_RE = /^\s*(?:export\s+)?(?:const|let|var)\s+(PALETTE|TIPOS|MARCAS|CATEGORIA_META|COLS_[A-Z0-9_]+)\s*=\s*\{/;

const TW_COLORS = 'gray|slate|zinc|neutral|emerald|green|red|blue|indigo|amber|yellow|orange|purple|violet|pink|sky';
const TW_PREFIXES = 'text|bg|border|divide|ring|from|to|via|placeholder|outline|fill|stroke';

const RE = {
  // #RRGGBB / #RRGGBBAA / #RGB — no precedido por caracteres de palabra
  // (evita, p.ej., ids de html como "#id-123" no interfieren: exigimos hex exacto)
  hex: /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g,
  // rgb(…) / rgba(…) con valores numéricos fijos
  rgb: /\brgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)/g,
  // Clases Tailwind de color: prefijo-color-peso (con variantes hover:, dark:, md:, etc.)
  tailwind: new RegExp(
    `(?<![\\w-])(?:[a-z-]+:)*(?:(?:${TW_PREFIXES})-(?:${TW_COLORS})-\\d{2,3}|(?:bg|text|border|divide|ring)-(?:white|black))(?:\\/\\d{1,3})?(?![\\w-])`,
    'g',
  ),
};

// Overlays neutros de baja opacidad que sí funcionan en ambos temas.
const OVERLAY_MAX_ALPHA = 0.12;

// Orden sugerido: pantallas de uso diario primero, luego móviles.
const ORDEN_SUGERIDO = [
  { grupo: 'Pagos', match: /modules\/comercial\/PagosCliente/ },
  { grupo: 'Marketing', match: /modules\/comercial\/MarketingCliente/ },
  { grupo: 'Inventario global', match: /modules\/comercial\/InventarioGlobal/ },
  { grupo: 'Cobranza / Crédito', match: /modules\/comercial\/CreditoCobranza/ },
  { grupo: 'Estado de Resultados', match: /modules\/general\/EstadoResultados/ },
  { grupo: 'Configuración', match: /modules\/(configuracion|settings)\// },
  { grupo: 'Móviles', match: /components\/Mobile[A-Za-z]*\.jsx$/ },
];

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(jsx|js)$/.test(name)) acc.push(p);
  }
  return acc;
}

function rel(p) {
  return relative(ROOT, p).split(sep).join('/');
}

function isExcluded(relPath) {
  if (EXCLUDE_FILES.has(relPath)) return true;
  return EXCLUDE_DIRS.some((d) => relPath === d || relPath.startsWith(d + '/'));
}

/** Devuelve un Set con los índices (0-based) de líneas dentro de bloques de paleta. */
function paletteLines(lines) {
  const skip = new Set();
  let depth = 0;
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inBlock) {
      if (PALETTE_CONST_RE.test(line)) {
        inBlock = true;
        depth = 0;
        // caemos al conteo de llaves de esta misma línea
      } else {
        continue;
      }
    }
    skip.add(i);
    // Conteo de llaves ignorando strings simples y comentarios de línea.
    const code = stripStringsAndComments(line);
    for (const ch of code) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    if (depth <= 0) {
      inBlock = false;
      depth = 0;
    }
  }
  return skip;
}

/** Quita el contenido de strings ('…', "…", `…`) y comentarios `//` para contar llaves con seguridad. */
function stripStringsAndComments(line) {
  let out = '';
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '/' && line[i + 1] === '/') break;
    out += c;
  }
  return out;
}

function isAllowedOverlay(r, g, b, a) {
  const neutral = (r === 0 && g === 0 && b === 0) || (r === 255 && g === 255 && b === 255);
  if (!neutral) return false;
  if (a === undefined) return false; // rgb(0,0,0) sólido sí rompe
  return a <= OVERLAY_MAX_ALPHA;
}

// ---------------------------------------------------------------------------
// Escaneo
// ---------------------------------------------------------------------------

function scanFile(absPath) {
  const relPath = rel(absPath);
  const src = readFileSync(absPath, 'utf8');
  const lines = src.split(/\r?\n/);
  const skip = paletteLines(lines);

  const porTipo = { hex: 0, rgb: 0, tailwind: 0 };
  const porLinea = new Map(); // texto normalizado → { count, lineas: [] }
  const hallazgos = []; // { linea, tipo, token }
  let omitidasPaleta = 0;

  lines.forEach((line, idx) => {
    if (skip.has(idx)) {
      // Contamos las que hubieran sido hallazgos para informar cuántas se omiten.
      if (RE.hex.test(line) || RE.rgb.test(line) || RE.tailwind.test(line)) omitidasPaleta++;
      RE.hex.lastIndex = RE.rgb.lastIndex = RE.tailwind.lastIndex = 0;
      return;
    }
    const trimmed = line.trim();
    // Comentarios de línea completa: no rompen nada.
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

    let n = 0;
    const tokens = [];

    for (const m of line.matchAll(RE.hex)) {
      porTipo.hex++; n++; tokens.push(m[0]);
    }
    for (const m of line.matchAll(RE.rgb)) {
      const [r, g, b] = [m[1], m[2], m[3]].map(Number);
      const a = m[4] === undefined ? undefined : Number(m[4]);
      if (isAllowedOverlay(r, g, b, a)) continue;
      porTipo.rgb++; n++; tokens.push(m[0].replace(/\s+/g, ''));
    }
    for (const m of line.matchAll(RE.tailwind)) {
      porTipo.tailwind++; n++; tokens.push(m[0]);
    }

    if (n === 0) return;
    hallazgos.push({ linea: idx + 1, tokens });
    const key = trimmed.replace(/\s+/g, ' ').slice(0, 140);
    const entry = porLinea.get(key) || { count: 0, lineas: [], tokens: 0 };
    entry.count += 1;
    entry.tokens += n;
    entry.lineas.push(idx + 1);
    porLinea.set(key, entry);
  });

  const total = porTipo.hex + porTipo.rgb + porTipo.tailwind;
  const top = [...porLinea.entries()]
    .map(([texto, e]) => ({ texto, ...e }))
    .sort((a, b) => b.count - a.count || b.tokens - a.tokens || a.lineas[0] - b.lineas[0])
    .slice(0, 5);

  return { archivo: relPath, total, porTipo, top, omitidasPaleta, lineasConHallazgo: hallazgos.length };
}

const archivos = walk(SRC).map((p) => ({ abs: p, rel: rel(p) })).filter((f) => !isExcluded(f.rel));
const resultados = archivos
  .map((f) => scanFile(f.abs))
  .filter((r) => r.total > 0)
  .sort((a, b) => b.total - a.total || a.archivo.localeCompare(b.archivo));

const totalOcurrencias = resultados.reduce((s, r) => s + r.total, 0);
const totalTipo = resultados.reduce(
  (acc, r) => ({ hex: acc.hex + r.porTipo.hex, rgb: acc.rgb + r.porTipo.rgb, tailwind: acc.tailwind + r.porTipo.tailwind }),
  { hex: 0, rgb: 0, tailwind: 0 },
);
const totalOmitidas = resultados.reduce((s, r) => s + r.omitidasPaleta, 0);

// ---------------------------------------------------------------------------
// Salida consola
// ---------------------------------------------------------------------------

const pad = (s, n, right = false) => (right ? String(s).padStart(n) : String(s).padEnd(n));
const maxName = Math.min(64, Math.max(...resultados.map((r) => r.archivo.length), 10));

console.log('');
console.log(`Auditoría de colores fijos — ${archivos.length} archivos escaneados, ${resultados.length} con hallazgos, ${totalOcurrencias} ocurrencias`);
console.log(`  hex ${totalTipo.hex} · rgb ${totalTipo.rgb} · tailwind ${totalTipo.tailwind} · (omitidas en bloques de paleta: ${totalOmitidas} líneas)`);
console.log('');
console.log(`${pad('archivo', maxName)}  ${pad('total', 6, true)} ${pad('hex', 5, true)} ${pad('rgb', 5, true)} ${pad('tw', 5, true)}`);
console.log('-'.repeat(maxName + 26));
for (const r of resultados) {
  console.log(
    `${pad(r.archivo, maxName)}  ${pad(r.total, 6, true)} ${pad(r.porTipo.hex, 5, true)} ${pad(r.porTipo.rgb, 5, true)} ${pad(r.porTipo.tailwind, 5, true)}`,
  );
}
console.log('');

// ---------------------------------------------------------------------------
// Salida Markdown
// ---------------------------------------------------------------------------

const hoy = new Date().toISOString().slice(0, 10);
const md = [];
md.push('# Auditoría de colores fijos (modo Midnight)');
md.push('');
md.push(`_Generado el ${hoy} con \`node scripts/auditar-colores.mjs\`. No editar a mano: se regenera al correr el script._`);
md.push('');
md.push('## Qué detecta');
md.push('');
md.push('- **hex** — literales `#RRGGBB` / `#RGB` en JSX o estilos inline.');
md.push(`- **rgb** — \`rgb(…)\` / \`rgba(…)\` con valores fijos. Se toleran overlays neutros \`rgba(0,0,0,a)\` y \`rgba(255,255,255,a)\` con \`a ≤ ${OVERLAY_MAX_ALPHA}\`.`);
md.push(`- **tailwind** — clases de color (\`text-gray-500\`, \`bg-white\`, \`border-red-200\`, \`divide-…\`, \`ring-…\`, …) con paleta \`${TW_COLORS.replace(/\|/g, ', ')}\`.`);
md.push('');
md.push('Se excluyen `src/lib/themeTokens.js`, `src/components/kit/**` y las líneas dentro de bloques `const PALETTE | TIPOS | MARCAS | CATEGORIA_META | COLS_* = { … }` (paletas declaradas a propósito).');
md.push('');
md.push('## Resumen');
md.push('');
md.push('| Métrica | Valor |');
md.push('|---|---:|');
md.push(`| Archivos escaneados | ${archivos.length} |`);
md.push(`| Archivos afectados | ${resultados.length} |`);
md.push(`| Total ocurrencias | ${totalOcurrencias} |`);
md.push(`| · hex | ${totalTipo.hex} |`);
md.push(`| · rgb/rgba | ${totalTipo.rgb} |`);
md.push(`| · tailwind | ${totalTipo.tailwind} |`);
md.push(`| Líneas omitidas por estar en bloques de paleta | ${totalOmitidas} |`);
md.push('');
md.push('## Orden sugerido');
md.push('');
md.push('Pantallas de uso diario primero; después las móviles; al final el resto ordenado por conteo.');
md.push('');

const asignados = new Set();
let paso = 1;
for (const g of ORDEN_SUGERIDO) {
  const items = resultados.filter((r) => g.match.test(r.archivo));
  if (items.length === 0) continue;
  md.push(`### ${paso++}. ${g.grupo}`);
  md.push('');
  md.push('| Archivo | Total | hex | rgb | tw |');
  md.push('|---|---:|---:|---:|---:|');
  for (const r of items) {
    asignados.add(r.archivo);
    md.push(`| \`${r.archivo}\` | ${r.total} | ${r.porTipo.hex} | ${r.porTipo.rgb} | ${r.porTipo.tailwind} |`);
  }
  md.push('');
}
const resto = resultados.filter((r) => !asignados.has(r.archivo));
if (resto.length) {
  md.push(`### ${paso++}. Resto (por conteo)`);
  md.push('');
  md.push('| Archivo | Total | hex | rgb | tw |');
  md.push('|---|---:|---:|---:|---:|');
  for (const r of resto) md.push(`| \`${r.archivo}\` | ${r.total} | ${r.porTipo.hex} | ${r.porTipo.rgb} | ${r.porTipo.tailwind} |`);
  md.push('');
}

md.push('## Tabla por archivo (orden descendente)');
md.push('');
md.push('| # | Archivo | Total | hex | rgb | tw | Líneas |');
md.push('|---:|---|---:|---:|---:|---:|---:|');
resultados.forEach((r, i) => {
  md.push(`| ${i + 1} | \`${r.archivo}\` | ${r.total} | ${r.porTipo.hex} | ${r.porTipo.rgb} | ${r.porTipo.tailwind} | ${r.lineasConHallazgo} |`);
});
md.push('');

md.push('## Detalle por archivo — 5 líneas más repetidas');
md.push('');
const esc = (s) => s.replace(/\|/g, '\\|').replace(/`/g, '\u02cb');
for (const r of resultados) {
  md.push(`### \`${r.archivo}\` — ${r.total} (hex ${r.porTipo.hex} · rgb ${r.porTipo.rgb} · tw ${r.porTipo.tailwind})`);
  md.push('');
  md.push('| Veces | Líneas | Código |');
  md.push('|---:|---|---|');
  for (const t of r.top) {
    const lineas = t.lineas.length > 8 ? `${t.lineas.slice(0, 8).join(', ')}, … (+${t.lineas.length - 8})` : t.lineas.join(', ');
    md.push(`| ${t.count} | ${lineas} | \`${esc(t.texto)}\` |`);
  }
  md.push('');
}

mkdirSync(dirname(OUT_MD), { recursive: true });
writeFileSync(OUT_MD, md.join('\n') + '\n', 'utf8');
console.log(`Reporte escrito en ${rel(OUT_MD)}`);
