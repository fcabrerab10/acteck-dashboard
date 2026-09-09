// exportar.js — Exportación genérica a Excel (xlsx-js-style) y PDF ("como se ve").
//
// Reglas (CLAUDE.md · Rendimiento): xlsx-js-style se carga SOLO bajo demanda
// con `await import(...)`. Nunca importar estático desde aquí ni desde pantallas.
//
// Uso rápido:
//   await exportarExcel({ titulo: 'Sell In Digitalife', hojas: [{ nombre: 'SKUs', columnas, filas, totales }] });
//   await exportarPDF({ titulo: 'Sell In', subtitulo: 'Digitalife · 2026', elemento: ref.current });
//   const { columnas, filas } = tablaDesdeDOM(tableRef.current);

const hoyISO = () => new Date().toISOString().slice(0, 10);

const FORMATO_POR_TIPO = {
  numero: '#,##0',
  moneda: '$#,##0',
  pct: '0.0%',
  fecha: 'dd/mm/yyyy',
};

const ANCHO_POR_TIPO = { texto: 18, numero: 10, moneda: 14, pct: 9, fecha: 12 };

// Limpia el nombre de hoja según reglas de Excel (≤31 chars, sin : \ / ? * [ ]).
const nombreHoja = (s, i) =>
  String(s || `Hoja ${i + 1}`).replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || `Hoja ${i + 1}`;

// Nombre de archivo seguro (sin caracteres que rompan el "Guardar como").
const nombreArchivo = (s) => String(s || 'Exportación').replace(/[\\/:*?"<>|]/g, '-').trim();

// Convierte un valor crudo al valor de celda según su tipo.
function celda(valor, tipo) {
  if (valor == null || valor === '') return null;
  switch (tipo) {
    case 'numero':
    case 'moneda': {
      const n = typeof valor === 'number' ? valor : parseNumeroMX(valor);
      return n == null ? { v: String(valor), t: 's' } : { v: n, t: 'n', z: FORMATO_POR_TIPO[tipo] };
    }
    case 'pct': {
      // Se admite 0–1 (fracción) o 0–100 (porcentaje); si > 1.5 se asume porcentaje.
      let n = typeof valor === 'number' ? valor : parseNumeroMX(valor);
      if (n == null) return { v: String(valor), t: 's' };
      if (Math.abs(n) > 1.5) n = n / 100;
      return { v: n, t: 'n', z: FORMATO_POR_TIPO.pct };
    }
    case 'fecha': {
      const d = valor instanceof Date ? valor : parseFecha(valor);
      return d ? { v: d, t: 'd', z: FORMATO_POR_TIPO.fecha } : { v: String(valor), t: 's' };
    }
    default:
      return { v: typeof valor === 'object' ? JSON.stringify(valor) : String(valor), t: 's' };
  }
}

function parseFecha(s) {
  if (!s) return null;
  const str = String(s).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Parsea un número con formato es-MX ("$1,234,567", "12.5%", "−3,200", "(1,200)", "1.2M").
 * Devuelve null si no es número.
 */
export function parseNumeroMX(texto) {
  if (texto == null) return null;
  if (typeof texto === 'number') return isFinite(texto) ? texto : null;
  let s = String(texto).trim();
  if (!s || s === '—' || s === '-' || s === '–') return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/^[−–-]/.test(s)) { neg = true; s = s.slice(1); }
  if (s.startsWith('+')) s = s.slice(1);
  let mult = 1;
  const suf = /([kKmM])$/.exec(s);
  if (suf) { mult = suf[1].toLowerCase() === 'k' ? 1e3 : 1e6; s = s.slice(0, -1); }
  s = s.replace(/[$%\s,]/g, '').replace(/[a-zA-Z]+$/, '');
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const n = parseFloat(s) * mult;
  return isFinite(n) ? (neg ? -n : n) : null;
}

/**
 * Exporta a Excel con el look Ferruteck: fila título negra fusionada, header negro con
 * texto blanco, formatos por tipo, anchos, freeze panes y fila de totales opcional.
 *
 * @param {Object} opts
 * @param {string} opts.titulo
 * @param {string} [opts.archivo]  — nombre base; default = titulo
 * @param {Array}  opts.hojas — [{ nombre, columnas:[{label,key,tipo,ancho}], filas:[obj], totales?:obj, subtitulo? }]
 */
export async function exportarExcel({ titulo, archivo, hojas = [] }) {
  if (!hojas.length) throw new Error('No hay hojas que exportar');
  const xlsxMod = await import('xlsx-js-style');
  const XLSX = xlsxMod.default || xlsxMod;

  const headStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 10 },
    fill: { patternType: 'solid', fgColor: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  };
  const titStyle = { ...headStyle, font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 14, name: 'Arial' }, alignment: { horizontal: 'left', vertical: 'center' } };
  const totStyle = {
    font: { bold: true, name: 'Arial', sz: 10 },
    fill: { patternType: 'solid', fgColor: { rgb: 'F5F5F7' } },
    border: { top: { style: 'thin', color: { rgb: '000000' } } },
  };
  const bodyFont = { name: 'Arial', sz: 10 };

  const wb = XLSX.utils.book_new();
  const usados = new Set();

  hojas.forEach((hoja, hi) => {
    const columnas = (hoja.columnas || []).map((c) => (typeof c === 'string' ? { label: c, key: c, tipo: 'texto' } : { tipo: 'texto', ...c }));
    const filas = hoja.filas || [];
    const nCols = Math.max(columnas.length, 1);
    const tituloHoja = hoja.titulo || titulo || hoja.nombre || 'Exportación';
    const subt = hoja.subtitulo ? ` · ${hoja.subtitulo}` : '';

    // Armado por AOA (título + header); las celdas de datos se escriben con tipo/format.
    const aoa = [
      [`${tituloHoja}${subt}`, ...Array(nCols - 1).fill('')],
      columnas.map((c) => c.label),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    const R0 = 2; // primera fila de datos
    filas.forEach((fila, ri) => {
      columnas.forEach((col, ci) => {
        const raw = typeof col.get === 'function' ? col.get(fila) : fila?.[col.key];
        const cell = celda(raw, col.tipo);
        if (!cell) return;
        const addr = XLSX.utils.encode_cell({ r: R0 + ri, c: ci });
        ws[addr] = { ...cell, s: { font: bodyFont, alignment: { horizontal: col.tipo === 'texto' ? 'left' : 'right' } } };
      });
    });

    let ultimaFila = R0 + filas.length - 1;
    if (hoja.totales) {
      const rt = R0 + filas.length;
      columnas.forEach((col, ci) => {
        const raw = hoja.totales[col.key];
        const addr = XLSX.utils.encode_cell({ r: rt, c: ci });
        const cell = raw == null ? (ci === 0 ? { v: 'TOTAL', t: 's' } : { v: '', t: 's' }) : celda(raw, col.tipo);
        ws[addr] = { ...cell, s: { ...totStyle, alignment: { horizontal: col.tipo === 'texto' ? 'left' : 'right' } } };
      });
      ultimaFila = rt;
    }

    // Estilos título/header
    for (let c = 0; c < nCols; c++) {
      const t = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[t]) ws[t] = { v: '', t: 's' };
      ws[t].s = titStyle;
      const h = XLSX.utils.encode_cell({ r: 1, c });
      if (!ws[h]) ws[h] = { v: '', t: 's' };
      ws[h].s = headStyle;
    }
    ws['!merges'] = nCols > 1 ? [{ s: { r: 0, c: 0 }, e: { r: 0, c: nCols - 1 } }] : [];
    ws['!rows'] = [{ hpt: 26 }, { hpt: 24 }];
    ws['!cols'] = columnas.map((c) => ({ wch: c.ancho || Math.max(ANCHO_POR_TIPO[c.tipo] || 12, Math.min(String(c.label || '').length + 2, 40)) }));
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(ultimaFila, 1), c: nCols - 1 } });
    const primerasTexto = columnas.findIndex((c) => c.tipo !== 'texto');
    ws['!freeze'] = { xSplit: primerasTexto > 0 ? Math.min(primerasTexto, 3) : 1, ySplit: 2 };
    if (filas.length) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 1, c: 0 }, e: { r: 1 + filas.length, c: nCols - 1 } }) };

    let nombre = nombreHoja(hoja.nombre, hi);
    let k = 2;
    while (usados.has(nombre.toLowerCase())) nombre = `${nombre.slice(0, 28)} ${k++}`;
    usados.add(nombre.toLowerCase());
    XLSX.utils.book_append_sheet(wb, ws, nombre);
  });

  const fname = `${nombreArchivo(archivo || titulo)} · ${hoyISO()}.xlsx`;
  XLSX.writeFile(wb, fname);
  return fname;
}

/**
 * Lee un <table> real del DOM y devuelve { columnas, filas } para exportarExcel.
 * Detecta números con formato es-MX; si toda la columna (no vacía) parsea como
 * número, la marca 'numero' (o 'moneda' si el texto trae "$", 'pct' si trae "%").
 */
export function tablaDesdeDOM(tableEl) {
  const table = typeof tableEl === 'string' ? document.getElementById(tableEl) : tableEl;
  if (!table) throw new Error('No se encontró la tabla a exportar');
  const limpiar = (el) => (el?.innerText ?? el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  // Header: usa la ÚLTIMA fila del thead (la más específica); si hay rowSpan usa la primera.
  const thead = table.tHead;
  let headerCells = [];
  if (thead && thead.rows.length) {
    const rows = Array.from(thead.rows);
    if (rows.length === 1) headerCells = Array.from(rows[0].cells).map(limpiar);
    else {
      // Expande colSpan/rowSpan de forma simple: concatena grupo + subheader.
      const top = Array.from(rows[0].cells);
      const bottom = Array.from(rows[rows.length - 1].cells);
      const expand = [];
      top.forEach((c) => {
        const span = Number(c.colSpan || 1);
        const rs = Number(c.rowSpan || 1);
        for (let i = 0; i < span; i++) expand.push({ label: limpiar(c), leaf: rs >= rows.length });
      });
      let bi = 0;
      headerCells = expand.map((e) => {
        if (e.leaf) return e.label;
        const sub = bottom[bi++];
        const s = limpiar(sub);
        return e.label && s ? `${e.label} ${s}` : (s || e.label);
      });
    }
  }
  const bodyRows = table.tBodies.length ? Array.from(table.tBodies).flatMap((tb) => Array.from(tb.rows)) : Array.from(table.rows).slice(thead ? 0 : 1);
  const filasTxt = bodyRows
    .filter((tr) => !tr.hasAttribute('data-no-export') && tr.cells.length)
    .map((tr) => Array.from(tr.cells).map(limpiar));

  const nCols = Math.max(headerCells.length, ...filasTxt.map((r) => r.length), 0);
  if (!headerCells.length) headerCells = Array.from({ length: nCols }, (_, i) => `Col ${i + 1}`);
  while (headerCells.length < nCols) headerCells.push(`Col ${headerCells.length + 1}`);

  const columnas = headerCells.map((label, ci) => {
    const vals = filasTxt.map((r) => r[ci]).filter((v) => v && v !== '—' && v !== '-');
    const esNum = vals.length > 0 && vals.every((v) => parseNumeroMX(v) != null);
    let tipo = 'texto';
    if (esNum) {
      if (vals.some((v) => v.includes('%'))) tipo = 'pct';
      else if (vals.some((v) => v.includes('$'))) tipo = 'moneda';
      else tipo = 'numero';
    }
    return { label: label || `Col ${ci + 1}`, key: `c${ci}`, tipo };
  });

  const filas = filasTxt.map((r) => {
    const obj = {};
    columnas.forEach((col, ci) => {
      const v = r[ci];
      obj[col.key] = col.tipo === 'texto' ? (v ?? '') : parseNumeroMX(v);
    });
    return obj;
  });
  return { columnas, filas };
}

// ─── PDF "como se ve" ───
const CSS_IMPRESION = `
@page { size: landscape; margin: 12mm; }
html, body { background: #FFFFFF !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: "SF Pro Text", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; }
#__pdf_head { display: flex; align-items: center; gap: 10px; padding: 0 0 10px; margin-bottom: 14px; border-bottom: 1px solid rgba(0,0,0,0.15); font-size: 12px; color: #1D1D1F; }
#__pdf_head .logo { width: 22px; height: 22px; border-radius: 6px; background: #000; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; letter-spacing: -0.02em; }
#__pdf_head .t { font-weight: 600; }
#__pdf_head .sep { color: rgba(0,0,0,0.35); }
#__pdf_head .fecha { margin-left: auto; color: #6E6E73; font-variant-numeric: tabular-nums; }
#__pdf_root { width: 100%; }
#__pdf_root * { animation: none !important; transition: none !important; }
#__pdf_root [data-no-print], #__pdf_root button, #__pdf_root input[type="search"], #__pdf_root select { display: none !important; }
#__pdf_root { overflow: visible !important; }
#__pdf_root [style*="overflow"] { overflow: visible !important; max-height: none !important; }
#__pdf_root [style*="position: sticky"], #__pdf_root [style*="position:sticky"] { position: static !important; }
#__pdf_root table { page-break-inside: auto; border-collapse: collapse; }
#__pdf_root tr { page-break-inside: avoid; }
#__pdf_root thead { display: table-header-group; }
#__pdf_root svg { max-width: 100%; }
`;

function abrirVentana() {
  const w = window.open('', '_blank', 'width=1200,height=800');
  if (!w || w.closed || typeof w.closed === 'undefined') {
    throw new Error('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio e inténtalo de nuevo.');
  }
  return w;
}

function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Copia el valor actual de inputs/selects/textarea al clon (cloneNode no lo hace).
function congelarFormularios(origen, clon) {
  const a = origen.querySelectorAll('input, select, textarea');
  const b = clon.querySelectorAll('input, select, textarea');
  a.forEach((el, i) => {
    const c = b[i];
    if (!c) return;
    if (el.tagName === 'SELECT') c.value = el.value, Array.from(c.options).forEach((o) => { if (o.value === el.value) o.setAttribute('selected', ''); });
    else if (el.type === 'checkbox' || el.type === 'radio') { if (el.checked) c.setAttribute('checked', ''); else c.removeAttribute('checked'); }
    else c.setAttribute('value', el.value);
  });
  // Canvas (Recharts usa SVG, pero por si acaso) → imagen
  const ca = origen.querySelectorAll('canvas');
  const cb = clon.querySelectorAll('canvas');
  ca.forEach((cv, i) => {
    try {
      const img = document.createElement('img');
      img.src = cv.toDataURL('image/png');
      img.width = cv.width; img.height = cv.height;
      img.style.cssText = cv.style.cssText;
      cb[i]?.replaceWith(img);
    } catch { /* canvas tainted: se deja como está */ }
  });
}

/**
 * Abre una ventana con una copia del DOM del elemento (estilos incluidos), encabezado
 * "Acteck Dashboard · titulo · subtitulo · fecha" y lanza print() (Guardar como PDF).
 * Lanza Error legible si el navegador bloquea la ventana emergente.
 */
export async function exportarPDF({ titulo, subtitulo, elemento }) {
  const el = typeof elemento === 'string' ? document.getElementById(elemento) : (elemento?.current || elemento);
  if (!el || !(el instanceof HTMLElement)) throw new Error('No se encontró el contenido a imprimir');

  // La ventana se abre ANTES de cualquier await para no perder el gesto del usuario.
  const w = abrirVentana();
  const doc = w.document;

  const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  const partes = ['Acteck Dashboard', titulo, subtitulo].filter(Boolean).map(escapeHTML);

  const clon = el.cloneNode(true);
  congelarFormularios(el, clon);
  // Vars CSS del tema (--t-*) viven en <html>; se copian para que el clon las resuelva.
  const themeVars = document.documentElement.getAttribute('style') || '';

  // Hojas de estilo: <link> con href ABSOLUTO (la ventana nueva es about:blank) + <style> inline (Vite dev / Tailwind).
  const headLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((n) => (n.tagName === 'LINK' ? `<link rel="stylesheet" href="${escapeHTML(n.href)}">` : n.outerHTML)).join('\n');
  // Botones que en realidad son contenedores de contenido (acordeones con título) se imprimen como <div>;
  // el resto de botones (acciones) se ocultan por CSS. Marca `data-print` para forzar que uno se imprima.
  clon.querySelectorAll('button').forEach((b) => {
    const esContenido = b.hasAttribute('data-print') || b.querySelector('h1,h2,h3,h4,h5,h6') || (b.innerText || '').trim().length > 40;
    if (!esContenido) return;
    const d = document.createElement('div');
    for (const { name, value } of Array.from(b.attributes)) if (name !== 'type' && name !== 'disabled') d.setAttribute(name, value);
    while (b.firstChild) d.appendChild(b.firstChild);
    b.replaceWith(d);
  });

  doc.open();
  doc.write(`<!doctype html><html lang="es" style="${escapeHTML(themeVars)}"><head><meta charset="utf-8">
<title>${escapeHTML([titulo, subtitulo].filter(Boolean).join(' · ') || 'Exportación')}</title>
${headLinks}
<style>${CSS_IMPRESION}</style>
</head><body>
<div id="__pdf_head"><span class="logo">A</span>${partes.map((p, i) => `${i ? '<span class="sep">·</span>' : ''}<span class="${i === 1 ? 't' : ''}">${p}</span>`).join('')}<span class="fecha">${escapeHTML(fecha)}</span></div>
<div id="__pdf_root"></div>
</body></html>`);
  doc.close();
  doc.getElementById('__pdf_root').appendChild(doc.adoptNode ? doc.adoptNode(clon) : doc.importNode(clon, true));

  // Espera fuentes + hojas de estilo externas antes de imprimir.
  const esperaFuentes = doc.fonts?.ready ? doc.fonts.ready.catch(() => {}) : Promise.resolve();
  const esperaLinks = Promise.all(Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map((l) => new Promise((res) => {
    if (l.sheet) return res();
    l.addEventListener('load', res, { once: true });
    l.addEventListener('error', res, { once: true });
    setTimeout(res, 2500);
  })));
  await Promise.race([Promise.all([esperaFuentes, esperaLinks]), new Promise((r) => setTimeout(r, 4000))]);
  await new Promise((r) => w.requestAnimationFrame(() => setTimeout(r, 120)));

  w.focus();
  w.addEventListener('afterprint', () => { try { w.close(); } catch { /* noop */ } });
  w.print();
  return true;
}

export default { exportarExcel, exportarPDF, tablaDesdeDOM, parseNumeroMX };
