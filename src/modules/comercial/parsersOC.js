/**
 * Parsers para órdenes de compra — Sprint 3
 * ─────────────────────────────────────────────
 * - parsePCELPdf(arrayBuffer): extrae header + líneas de un PDF "Relación de OCs"
 * - parseDigitalifeExcel(arrayBuffer): extrae líneas de las hojas por categoría
 *                                       con facturación esperada por fecha + color
 */

// Fecha: "20/04/2026" o "20-04-2026" → "2026-04-20"
function parseFechaLatam(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) return null;
  let [, d, mo, y] = m;
  y = y.length === 2 ? `20${y}` : y;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// ══════════════════════════════════════════════════════
// PCEL PDF Parser
// ══════════════════════════════════════════════════════
export async function parsePCELPdf(arrayBuffer) {
  // Cargar pdfjs-dist desde CDN. El worker se sirve del mismo CDN.
  const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.mjs';

  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  // Extraer texto con posiciones (x,y) para agrupar por fila
  let lines = [];   // [{text, x, y, page}]
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    content.items.forEach(it => {
      if (!it.str.trim()) return;
      lines.push({
        text: it.str,
        x: it.transform[4],
        y: it.transform[5],
        page: p,
      });
    });
  }

  // Agrupar por fila (misma y, tolerancia de 3pt) y ordenar por x
  const rowMap = new Map();
  lines.forEach(it => {
    const key = `${it.page}_${Math.round(it.y / 3) * 3}`;
    if (!rowMap.has(key)) rowMap.set(key, []);
    rowMap.get(key).push(it);
  });
  const rows = [...rowMap.entries()]
    .sort((a, b) => {
      const [pa, ya] = a[0].split('_').map(Number);
      const [pb, yb] = b[0].split('_').map(Number);
      if (pa !== pb) return pa - pb;
      return yb - ya;   // PDF y: top=mayor
    })
    .map(([_, items]) => items.sort((a, b) => a.x - b.x).map(i => i.text).join('\t').trim());

  const fullText = rows.join('\n');
  const warnings = [];

  // ── Header ──
  let oc_numero = '';
  let fecha_oc = null;
  let proveedor = '';
  let moneda = 'MXN';
  let tipo_cambio = 1;
  let iva_pct = 16;
  let plazo_dias = 0;
  let autorizada = true;
  let lugar_entrega = '';

  // OC + fecha: "521775\t20/04/2026 03:58:09p. m.\tGeraldo..."
  const mOC = fullText.match(/(\d{5,7})\t(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}[^\t]*)\t/);
  if (mOC) {
    oc_numero = mOC[1];
    fecha_oc = parseFechaLatam(mOC[2]);
  } else {
    // Fallback: buscar primer número de 6 dígitos cerca de "Ocompra"
    const m2 = fullText.match(/\b(\d{6})\b/);
    if (m2) oc_numero = m2[1];
  }

  // Proveedor, moneda, TC, IVA, plazo, autorizada: pattern "REVKO pesos 1.0000 16.00 90 si"
  const mProv = fullText.match(/([A-Z][A-Z0-9&\s.,]{2,30})\s+(pesos|dolares|usd|mxn)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s+(si|no)/i);
  if (mProv) {
    proveedor   = mProv[1].trim();
    moneda      = mProv[2].toLowerCase().startsWith('do') || mProv[2].toLowerCase() === 'usd' ? 'USD' : 'MXN';
    tipo_cambio = Number(mProv[3]) || 1;
    iva_pct     = Number(mProv[4]) || 16;
    plazo_dias  = Number(mProv[5]) || 0;
    autorizada  = mProv[6].toLowerCase() === 'si';
  }

  // Lugar de entrega: la línea después de "cedis..." suele contenerlo
  const mLugar = fullText.match(/(cedis[^\n]*)\n([^\n]{10,200})/i);
  if (mLugar) {
    lugar_entrega = `${mLugar[1]} — ${mLugar[2]}`.replace(/\s+/g, ' ').trim();
  }

  // ── Líneas ──
  // Formato esperado: "SKU\tFOLIO\tPRODUCTO\tMODELO\tOrigen\tQTY\tUNIT_PRICE\tTOTAL\tSURTIDO\tESTATUS"
  // Ej: "AC-943338\t550458\tSILLA ACTECK...\tAC-943338\tForaneo\t100\t950.00\t95,000.00\t0\toc pendiente"
  const lineas = [];
  // Encuentra filas tipo línea: empiezan con un SKU (letras-guion-números)
  const skuRe = /^([A-Z]{2,6}-[A-Z0-9.-]+|SW[A-Z0-9-]+)\b/i;
  for (const row of rows) {
    if (!skuRe.test(row)) continue;
    const parts = row.split('\t').map(p => p.trim()).filter(Boolean);
    if (parts.length < 6) continue;

    const sku = parts[0];
    // Busca las 2 cantidades numéricas al final: qty, precio, total, surtido
    // Patrón: ... CANT PRECIO TOTAL SURTIDO ESTATUS
    // Números (enteros o decimales con coma) al final
    const numbers = parts.filter(p => /^-?[\d,]+(\.\d+)?$/.test(p.replace(/,/g, '')));
    if (numbers.length < 3) continue;

    const toNum = (s) => Number(String(s).replace(/,/g, '')) || 0;
    // Los últimos 4 números suelen ser: qty, unit_price, total, surtido
    const nums = numbers.slice(-4).map(toNum);
    let cantidad, unit_price, total, surtido;
    if (nums.length === 4) {
      [cantidad, unit_price, total, surtido] = nums;
    } else {
      [cantidad, unit_price, total] = nums.slice(-3);
      surtido = 0;
    }

    // Descripción: todo lo que no sea SKU ni números ni "Foraneo"
    const descripcion = parts
      .slice(1)
      .filter(p => !/^-?[\d,]+(\.\d+)?$/.test(p.replace(/,/g, '')))
      .filter(p => p !== sku && !/foraneo|nacional|oc pendiente|oc completa/i.test(p))
      .join(' ')
      .replace(/^\d{4,}\s*/, '') // quita folio inicial
      .trim();

    lineas.push({
      sku,
      descripcion,
      cantidad,
      costo_unitario: unit_price,
      total,
      cantidad_surtida: surtido,
      facturacion_esperada: [],
    });
  }

  if (lineas.length === 0) {
    warnings.push('No se detectaron líneas con el formato esperado. Verifica que sea un PDF de "Relación de Órdenes de Compra" de PCEL.');
  }

  return {
    header: {
      cliente: 'pcel',
      oc_numero,
      fecha_oc,
      proveedor,
      moneda,
      tipo_cambio,
      iva_pct,
      plazo_dias,
      autorizada,
      lugar_entrega,
    },
    lineas,
    warnings,
  };
}

// ══════════════════════════════════════════════════════
// Digitalife Excel Parser
// ══════════════════════════════════════════════════════
// Formato: hojas por categoría (Monitores, Gabinetes, Fuentes de Poder, Sillas,
// Enfriamientos, Accesorios). La mitad derecha tiene:
//   "SKU | PIEZAS (fecha1) | PIEZAS (fecha2) | PIEZAS (fecha3) | TOTAL PIEZAS | PRECIO | SUB-TOTAL"
// Cada fecha es una factura esperada. La cantidad no-cero en cada fecha se guarda
// como entrada en facturacion_esperada con color = cell fill color si disponible.
export async function parseDigitalifeExcel(arrayBuffer) {
  const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellStyles: true, cellDates: true });
  const warnings = [];
  const lineas = [];

  // Intenta obtener color de celda (si cellStyles funcionó)
  const getCellColor = (cell) => {
    try {
      if (cell?.s?.fgColor?.rgb) return '#' + cell.s.fgColor.rgb.slice(-6);
      if (cell?.s?.bgColor?.rgb) return '#' + cell.s.bgColor.rgb.slice(-6);
    } catch {}
    return null;
  };

  // Normaliza fecha de header (puede ser string "3/16/26" o Date)
  const fechaHeader = (v) => {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'number') {
      // Excel serial
      const d = new Date(Math.round((v - 25569) * 86400 * 1000));
      return isNaN(d) ? null : d.toISOString().slice(0, 10);
    }
    const s = String(v).trim();
    // Formatos: "3/16/26", "3/16/2026", "16/03/2026"
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (!m) return null;
    // Si primer número > 12, es día primero
    const [, a, b, c] = m;
    const year = c.length === 2 ? `20${c}` : c;
    const ai = Number(a), bi = Number(b);
    const [mo, d] = ai > 12 ? [bi, ai] : [ai, bi];  // mes/día
    return `${year}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  };

  // Hojas a ignorar: consolidadas
  const ignorarHojas = new Set(['FACTURACION GENERAL', 'FACTURACION GENERAL ', 'Resumen', 'resumen']);

  let fechaOc = null;

  for (const sheetName of wb.SheetNames) {
    if (ignorarHojas.has(sheetName.trim()) || ignorarHojas.has(sheetName)) continue;
    const ws = wb.Sheets[sheetName];
    if (!ws || !ws['!ref']) continue;

    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
    if (grid.length < 3) continue;

    // Buscar header row (contiene "SKU" en alguna celda)
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(5, grid.length); i++) {
      if (grid[i].some(c => String(c || '').toUpperCase().trim() === 'SKU')) {
        headerRowIdx = i;
        break;
      }
    }
    if (headerRowIdx < 0) continue;

    const header = grid[headerRowIdx].map(c => String(c || '').toUpperCase().trim());
    // Columnas de la parte IZQUIERDA (sugerido)
    const colSkuIzq = header.indexOf('SKU');
    const colDesc   = header.findIndex(h => /DESCRIPCION|DESCRIPCIÓN/i.test(h));
    const colPrecio = header.findIndex(h => /PRECIO/i.test(h) && !/SUB/i.test(h));

    // Columnas de la parte DERECHA (confirmación cliente)
    // Segundo "SKU" + 3 columnas "PIEZAS" con fecha en fila de arriba + TOTAL PIEZAS
    const skuCols = [];
    header.forEach((h, idx) => { if (h === 'SKU') skuCols.push(idx); });
    const colSkuDer = skuCols.length >= 2 ? skuCols[1] : -1;

    // Fechas vienen de la fila de arriba (grid[headerRowIdx - 1])
    // Suelen ser las 3 celdas después de SKU derecha
    const fechasRow = grid[headerRowIdx - 1] || [];
    const fechaCols = []; // { colIdx, fecha }
    if (colSkuDer > 0) {
      for (let c = colSkuDer + 1; c < Math.min(colSkuDer + 5, header.length); c++) {
        if (/PIEZAS/i.test(header[c] || '')) {
          const f = fechaHeader(fechasRow[c]);
          fechaCols.push({ colIdx: c, fecha: f });
          if (!fechaOc && f) fechaOc = f;
        }
      }
    }

    // Recorrer filas de datos
    for (let r = headerRowIdx + 1; r < grid.length; r++) {
      const row = grid[r];
      if (!row) continue;
      const sku = row[colSkuIzq];
      if (!sku || typeof sku !== 'string' || sku.length < 3) continue;
      // Omitir filas totales o vacías
      if (/TOTAL/i.test(sku)) continue;

      const descripcion = colDesc >= 0 ? String(row[colDesc] || '').trim() : '';
      const precio      = colPrecio >= 0 ? Number(String(row[colPrecio] || '').replace(/[^\d.-]/g, '')) || 0 : 0;

      // Recolectar confirmaciones por fecha
      const facturacion_esperada = [];
      let totalConfirmado = 0;
      fechaCols.forEach(({ colIdx, fecha }) => {
        const val = row[colIdx];
        const cantidad = val == null ? 0 : Number(String(val).replace(/[^\d.-]/g, '')) || 0;
        if (cantidad > 0) {
          // Intenta extraer color de la celda
          const cellAddr = XLSX.utils.encode_cell({ r, c: colIdx });
          const cell = ws[cellAddr];
          const color = getCellColor(cell);
          facturacion_esperada.push({ fecha, cantidad, color });
          totalConfirmado += cantidad;
        }
      });

      // Si no hay confirmación, saltar (el sugerido no es OC)
      if (totalConfirmado <= 0) continue;

      lineas.push({
        sku: sku.trim(),
        descripcion,
        cantidad: totalConfirmado,
        costo_unitario: precio,
        total: totalConfirmado * precio,
        cantidad_surtida: 0,
        facturacion_esperada,
      });
    }
  }

  if (lineas.length === 0) {
    warnings.push('No se detectaron líneas confirmadas. El Excel debe tener cantidades en las columnas PIEZAS (parte derecha).');
  }

  return {
    header: {
      cliente: 'digitalife',
      oc_numero: '',  // no viene explícito; el usuario lo captura
      fecha_oc: fechaOc || new Date().toISOString().slice(0, 10),
      proveedor: 'API GLOBAL',
      moneda: 'MXN',
      tipo_cambio: 1,
      iva_pct: 16,
      plazo_dias: 0,
      autorizada: true,
      lugar_entrega: '',
    },
    lineas,
    warnings,
  };
}
