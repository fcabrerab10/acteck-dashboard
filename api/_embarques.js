// api/_embarques.js — Transformaciones del Master Embarques (Google Sheet)
// compartidas entre el cron de Vercel (api/cron.js) y el puente de la Mac mini
// (bridge/). Reciben filas crudas como arrays (header en la fila 0), que es lo
// que producen tanto la exportación CSV (gviz) como la API de Google Sheets
// con valueRenderOption=FORMATTED_VALUE.
//
// El prefijo "_" evita que Vercel lo publique como serverless function.

// ═════════════════════ CSV parser ═════════════════════
export function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; continue; }
      if (c === '"') { inQuotes = false; continue; }
      cur += c;
    } else {
      if (c === '"') { inQuotes = true; continue; }
      if (c === ',') { row.push(cur); cur = ''; continue; }
      if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; continue; }
      if (c === '\r') continue;
      cur += c;
    }
  }
  if (cur !== '' || row.length > 0) { row.push(cur); rows.push(row); }
  return rows;
}

// ═════════════════════ Normalización ═════════════════════
export function snake(s) {
  return String(s || '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
export function toStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' || s === '#N/A' ? null : s;
}
export function toNum(v) {
  if (v == null || v === '' || v === '#N/A') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[$,%\s]/g, ''));
  return isNaN(n) ? null : n;
}
export function toInt(v) { const n = toNum(v); return n == null ? null : Math.round(n); }
const MESES_ES = { enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6, julio:7, agosto:8, septiembre:9, setiembre:9, octubre:10, noviembre:11, diciembre:12 };
const pad2 = (n) => String(n).padStart(2, '0');
/**
 * @param v        Date | 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'miércoles, 7 de enero [de 2026]' | serial
 * @param anioDef  año a usar cuando la celda viene en español sin año (nombre de la pestaña)
 */
export function toISODate(v, anioDef = null) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v) ? null : `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
  if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 86400) * 1000); return isNaN(d) ? null : d.toISOString().slice(0, 10); }
  const s = String(v).trim();
  const es = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/);
  if (es && MESES_ES[es[2]]) {
    const y = es[3] ? parseInt(es[3], 10) : anioDef;
    return y ? `${y}-${pad2(MESES_ES[es[2]])}-${pad2(parseInt(es[1], 10))}` : null;
  }
  if (/[A-Za-z]/.test(s) && !/\d{1,2}[\/\-]\d{1,2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) {
    const d = new Date(s);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  }
  let [, a, b, c] = m;
  const year = c.length === 2 ? `20${c}` : c;
  return `${year}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
}
export function classifyCedis(raw) {
  const s = (raw == null ? '' : String(raw)).trim();
  if (!s) return { cedis: null, entrega_directa_cliente: null };
  if (/^\d/.test(s)) return { cedis: s, entrega_directa_cliente: null };
  return { cedis: s, entrega_directa_cliente: s };
}

/**
 * Índice de la fila de encabezados: la primera (entre las 8 primeras) que
 * contenga alguna columna clave. La pestaña "Proveedores" trae la fila 1 vacía.
 */
const CLAVES_HEADER = new Set(['po', 'codigo', 'articulo', 'contenedor', 'sku']);
export function findHeaderRow(rawRows) {
  const n = Math.min(rawRows.length, 8);
  for (let i = 0; i < n; i++) {
    const cells = (rawRows[i] || []).map(snake);
    if (cells.some((c) => CLAVES_HEADER.has(c))) return i;
  }
  return 0;
}

/** rawRows (arrays, header detectado) → objetos con llaves snake_case. */
export function rowsToObjects(rawRows) {
  if (!rawRows || rawRows.length < 2) return [];
  const h = findHeaderRow(rawRows);
  const header = (rawRows[h] || []).map(snake);
  const out = [];
  for (let i = h + 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r || r.every((c) => c == null || String(c).trim() === '')) continue;
    const obj = {};
    for (let c = 0; c < header.length; c++) {
      const k = header[c];
      if (!k) continue;
      // Encabezados repetidos (ej. "Supplier #" y "SUPPLIER" → supplier, supplier_1)
      let key = k, n = 1;
      while (key in obj) key = `${k}_${n++}`;
      obj[key] = r[c] == null ? null : r[c];
    }
    out.push(obj);
  }
  return out;
}

// ═════════════════════ Hojas históricas (2026, 2025, …) → embarques_compras ═════════════════════
export const HOJAS_HISTORICAS = ['2026', '2025', '2024', '2022 - 2023', '2022-2023', '2023', '2022'];

/**
 * @param opts.anioDefault  año de la pestaña (2026, 2025…) para fechas en español sin año.
 * Diferencias reales entre pestañas del Sheet (2026-09): 2026 usa "CBM TOTAL" y
 * "FECHA EMISIÓN" en español sin año; 2022-2023 usa "FECHA DE EMISIÓN",
 * "REF FFW" y "ETA ALMACÉN"; en 2024 un complemento de QR sobrescribió los
 * encabezados de las columnas A-F (PO sigue en la columna A).
 */
export function transformEmbarques(rawRows, { anioDefault = null } = {}) {
  if (rawRows.length < 2) return [];
  const h = findHeaderRow(rawRows);
  const header = (rawRows[h] || []).map(snake);
  const idx = (names) => {
    for (const n of Array.isArray(names) ? names : [names]) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const col = {
    po: idx('po'), fecha_emision: idx(['fecha_emision', 'fecha_de_emision']), grupo: idx('grupo'),
    cbm: idx(['cbm', 'cbm_total']), f_a: idx(['f_a', 'fa']), porcentaje: idx('porcentaje'),
    familia: idx('familia'), codigo: idx('codigo'), descripcion: idx('descripcion'),
    po_qty: idx('po_qty'), shp_qty: idx('shp_qty'),
    unit_price: idx('unit_price'), total_amount: idx('total_amount'),
    metodo_pago: idx('metodo_de_pago'), supplier: idx('supplier'),
    fecha_ini_prod: idx('fecha_inicio_de_produccion'), fin_prod: idx('fin_de_produccion'),
    ref_ff: idx(['ref_ff', 'ref_ffw']), naviera: idx('naviera'),
    tipo_carga: idx('tipo_de_carga'), tipo_cont: idx('tipo_de_cont'),
    costo_flete: idx('costo_flete'), fdw: idx('fdw'), contenedor: idx('contenedor'),
    etd: idx('etd'), eta_puerto: idx('eta_puerto'),
    a_a: idx(['a_a', 'aa']), arribo_cedis: idx(['arribo_a_cedis', 'eta_almacen']),
    lt: idx('lt'), cedis: idx('cedis'), estatus: idx('estatus'),
    com_trafico: idx('comentarios_trafico'), com_diseno: idx('comentarios_diseno'),
  };
  if (col.po < 0) col.po = 0;   // PO siempre es la columna A aunque el encabezado esté sobrescrito
  if (col.codigo < 0) return [];
  const fecha = (v) => toISODate(v, anioDefault);
  const rows = [];
  for (let i = h + 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r) continue;
    const po = toStr(r[col.po]);
    const codigo = toStr(r[col.codigo]);
    if (!po || !codigo) continue;
    const { cedis, entrega_directa_cliente } = classifyCedis(r[col.cedis]);
    rows.push({
      po, codigo,
      fecha_emision:   fecha(r[col.fecha_emision]),
      grupo:           toStr(r[col.grupo]),
      cbm:             toNum(r[col.cbm]),
      fraccion_arancelaria: toStr(r[col.f_a]),
      porcentaje:      toNum(r[col.porcentaje]),
      familia:         toStr(r[col.familia]),
      descripcion:     toStr(r[col.descripcion]),
      po_qty:          toInt(r[col.po_qty]),
      shp_qty:         toInt(r[col.shp_qty]),
      unit_price:      toNum(r[col.unit_price]),
      total_amount:    toNum(r[col.total_amount]),
      metodo_pago:     toStr(r[col.metodo_pago]),
      supplier:        toStr(r[col.supplier]),
      fecha_inicio_produccion: fecha(r[col.fecha_ini_prod]),
      fin_produccion:  fecha(r[col.fin_prod]),
      ref_ff:          toStr(r[col.ref_ff]),
      naviera:         toStr(r[col.naviera]),
      tipo_carga:      toStr(r[col.tipo_carga]),
      tipo_contenedor: toStr(r[col.tipo_cont]),
      costo_flete:     toNum(r[col.costo_flete]),
      fdw:             toStr(r[col.fdw]),
      contenedor:      contenedorKey(r[col.contenedor], toInt(r[col.shp_qty]), toInt(r[col.po_qty]), fecha(r[col.fecha_emision]), fecha(r[col.fin_prod])),
      etd:             fecha(r[col.etd]),
      eta_puerto:      fecha(r[col.eta_puerto]),
      agente_aduanal:  toStr(r[col.a_a]),
      arribo_cedis:    fecha(r[col.arribo_cedis]),
      lt:              toStr(r[col.lt]),
      cedis, entrega_directa_cliente,
      estatus:         toStr(r[col.estatus]),
      comentarios_trafico: toStr(r[col.com_trafico]),
      comentarios_diseno:  toStr(r[col.com_diseno]),
    });
  }
  // Dedup por (po, codigo, contenedor): misma llave que uploads.html (postChunks) y
  // que el UNIQUE embarques_compras_po_codigo_contenedor_key de la BD. Gana la
  // última fila del Excel, igual que el uploader web. La BD también tiene UNIQUE
  // (po, codigo, arribo_cedis, shp_qty), que es el on_conflict de import-central.
  const seen = new Map();
  for (const r of rows) seen.set(`${r.po}||${r.codigo}||${r.contenedor}`, r);
  return [...seen.values()];
}

// Placeholder determinista cuando el contenedor aún no se asigna (mismo formato
// que uploads.html): PEND-<shp_qty|po_qty|0>-<fecha_emision|X>-<fin_produccion|X>.
// La columna es NOT NULL y forma parte de la llave única.
function contenedorKey(raw, shpQty, poQty, fechaEmision, finProduccion) {
  const c = (toStr(raw) || '').trim();
  const pend = !c || /^(PENDIENTE|NA|N\/A|-)$/i.test(c);
  if (!pend) return c;
  return `PEND-${shpQty || poQty || 0}-${fechaEmision || 'X'}-${finProduccion || 'X'}`;
}

// ═════════════════════ Hojas secundarias (mismo mapeo que uploads.html) ═════════════════════
// "Programación Arribos" → programacion_arribos (PK contenedor)
export function transformProgArribos(rawRows) {
  return rowsToObjects(rawRows).map((obj) => {
    const contenedor = toStr(obj.contenedor);
    if (!contenedor) return null;
    return {
      contenedor,
      agencia:              toStr(obj.agencia),
      terminal:             toStr(obj.terminal),
      contenido:            toStr(obj.contenido),
      eta_puerto:           toISODate(obj.eta_puerto),
      piso:                 toISODate(obj.piso),
      cita:                 toISODate(obj.cita),
      hora_cita:            toNum(obj.hora_cita),
      arribo_almacen:       toISODate(obj.arribo_almacen ?? obj.arribo_almacn),
      cedis:                toStr(obj.cedis),
      linea_transportista:  toStr(obj.linea_transportista),
      empate:               toStr(obj.empate),
      custodia:             toStr(obj.custodia),
      seguro_poliza:        toStr(obj.seguro_poliza ?? obj.seguro_p_liza ?? obj.seguro),
      importacion:          toStr(obj.importacion),
      fac:                  toNum(obj.fac),
      resguardo:            toStr(obj.resguardo),
      dias_demoras:         toInt(obj.dias_de_demoras ?? obj.dias_demoras),
      ultimo_dia_demoras:   toISODate(obj.ultimo_dia_demoras),
      reconocimiento_a:     toStr(obj.reconocimiento_a),
      profepa:              toStr(obj.profepa),
      almacenajes:          toNum(obj.almacenajes),
    };
  }).filter(Boolean);
}

// "SN" → series_generadas (PK po, sku). SN INITIAL/FINAL como texto (12 dígitos).
export function transformSN(rawRows) {
  const seen = new Map();
  for (const obj of rowsToObjects(rawRows)) {
    const po = toStr(obj.po), sku = toStr(obj.sku);
    if (!po || !sku) continue;
    seen.set(`${po}||${sku}`, {
      po, sku,
      ff:            toInt(obj.ff),
      supplier_num:  toInt(obj.supplier),
      supplier:      toStr(obj.supplier_1),
      ean:           toStr(obj.ean),
      description:   toStr(obj.description),
      fecha_po:      toISODate(obj.fecha_po),
      po_qty:        toInt(obj.po_qty),
      sn_generada:   toStr(obj.sn_generada),
      sn_initial:    toStr(obj.sn_initial),
      sn_final:      toStr(obj.sn_final),
      status:        toStr(obj.status),
    });
  }
  return [...seen.values()];
}

// "Proveedores" (bi-modal): filas con codigo → proveedores_master; sin codigo → catalogo_articulos.
export function transformProveedores(rawRows) {
  const seen = new Map();
  for (const obj of rowsToObjects(rawRows)) {
    const codigo = toInt(obj.codigo), articulo = toStr(obj.articulo);
    if (codigo == null || !articulo) continue;
    seen.set(`${codigo}||${articulo}`, {
      codigo, articulo,
      nombre_proveedor:  toStr(obj.nombre_proveedor),
      codigo_intelisis:  toInt(obj.codigo_intelisis),
      descripcion1:      toStr(obj.descripcion1),
      isbn:              toStr(obj.isbn),
    });
  }
  return [...seen.values()];
}
export function transformCatalogoArticulos(rawRows) {
  const seen = new Set(); const out = [];
  for (const obj of rowsToObjects(rawRows)) {
    const codigo = toInt(obj.codigo), articulo = toStr(obj.articulo);
    if (!articulo || codigo != null) continue;
    const key = articulo.trim().toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ articulo: articulo.trim(), descripcion: toStr(obj.descripcion1), isbn: toStr(obj.isbn) });
  }
  return out;
}

/** Hojas secundarias: nombre(s) de hoja en el Google Sheet → tabla destino + transform. */
/** Año implícito de una pestaña histórica ('2026' → 2026; '2022 - 2023' → null). */
export const anioDeHoja = (nombre) => { const m = String(nombre).trim().match(/^(20\d{2})$/); return m ? parseInt(m[1], 10) : null; };

export const HOJAS_SECUNDARIAS = [
  { sheets: ['Programación Arribos', 'Programacion Arribos'], table: 'programacion_arribos', transform: transformProgArribos },
  { sheets: ['SN'],          table: 'series_generadas',   transform: transformSN },
  { sheets: ['Proveedores'], table: 'proveedores_master', transform: transformProveedores },
  { sheets: ['Proveedores'], table: 'catalogo_articulos', transform: transformCatalogoArticulos },
];
