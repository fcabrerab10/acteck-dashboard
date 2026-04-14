// Pestaña "Actualización de datos" — solo admin
// 6 tarjetas de subida manual + 1 de tránsito automático
import { useEffect, useMemo, useRef, useState } from 'react';

const XLSX_URL = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
const CHUNK_SIZE = 500;

// ---------- helpers ----------
async function loadSheetJS() {
  if (window.XLSX) return window.XLSX;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = XLSX_URL; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
  return window.XLSX;
}

const s = v => (v === null || v === undefined) ? null : String(v).trim();
const n = v => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t || /consultar/i.test(t)) return null;
    const p = parseFloat(t.replace(/[,\s$]/g, ''));
    return isNaN(p) ? null : p;
  }
  return null;
};
const d2date = v => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
const pickFirst = (row, keys) => {
  const lower = {};
  for (const k of Object.keys(row)) lower[k.trim().toLowerCase()] = row[k];
  for (const k of keys) {
    const v = lower[k.trim().toLowerCase()];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
};
const isoWeek = date => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { anio: d.getUTCFullYear(), semana: week };
};

// ---------- cliente mapping (ERP Admin_Interna → cliente tag) ----------
function mapAdminInternaToCliente(admin) {
  if (!admin) return null;
  const up = String(admin).toUpperCase().trim();
  if (up.includes('MERCADO LIBRE')) return 'mercadolibre';
  if (up.includes('DIGITALIFE') || up.includes('API GLOBAL')) return 'digitalife';
  if (up === 'PCEL' || up.includes('PC ONLINE')) return 'pcel';
  return null; // otros clientes se ignoran por ahora
}

// ---------- mappers por tipo ----------
const mappers = {
  // ERP Ventas → sell_in_sku (solo filas de clientes del dashboard)
  erp_sell_in(raw) {
    const cliente = mapAdminInternaToCliente(raw['Admin_Interna'] || raw['ClienteNombre']);
    if (!cliente) return null;
    const fecha = d2date(raw['periodo']) || d2date(raw['FechaDeCreacion']);
    const no_parte = s(raw['Articulo']);
    if (!fecha || !no_parte) return null;
    return {
      cliente,
      fecha,
      no_parte,
      descripcion: s(raw['Descripcion1']),
      marca: s(raw['Marca']),
      piezas: n(raw['Piezas']),
      precio_unitario: n(raw['PrecioPorUnidadPesos']),
      costo_unitario: n(raw['CostoPorPiezaPesos']),
      monto: n(raw['MontoVentaPesos']),
      costo_total: n(raw['CostoVentaPesos']),
      folio: s(raw['Folio']),
      canal: s(raw['Canal']),
      movimiento: s(raw['MovimientoVenta']),
      estatus: s(raw['estatusventa']),
      payload: raw,
      updated_at: new Date().toISOString()
    };
  },
  // ERP Inventario → inventario_cliente con cliente='acteck_erp'
  erp_inventario(raw) {
    const no_parte = s(raw['articulo']);
    if (!no_parte) return null;
    return {
      cliente: 'acteck_erp',
      no_parte,
      almacen: s(raw['Almacen_nombre']) || s(raw['cedis']),
      no_almacen: s(raw['No_Almacen']),
      disponible: n(raw['disponible']),
      inventario: n(raw['inventario']),
      costo_promedio: n(raw['costopromedio']),
      costo_disponible: n(raw['CostoDisponible']),
      costo_inventario: n(raw['CostoInventario']),
      payload: raw,
      updated_at: new Date().toISOString()
    };
  },
  roadmap(raw) {
    const sku = s(pickFirst(raw, ['SKU','Articulo','No_Parte','No Parte']));
    if (!sku) return null;
    return {
      sku,
      rdmp: s(pickFirst(raw, ['Roadmap','RDMP','Road Map','RDMP Q2 2026'])),
      descripcion: s(pickFirst(raw, ['Descripcion 2','Descripción 2','Descripcion','Descripción'])),
      payload: raw,
      updated_at: new Date().toISOString()
    };
  },
  precios(raw) {
    const sku = s(pickFirst(raw, ['SKU','Articulo','No_Parte','No Parte']));
    if (!sku) return null;
    return {
      sku,
      precio_aaa: n(pickFirst(raw, ['AAA','Precio AAA','PrecioAAA','Precio_AAA'])),
      descuento: n(pickFirst(raw, ['Descuento','Dcto','% Descuento','%Descuento'])),
      precio_descuento: n(pickFirst(raw, ['Precio C/Descuento','Precio con descuento','Precio Descuento','Precio Neto'])),
      payload: raw,
      updated_at: new Date().toISOString()
    };
  },
  sellout_digitalife(raw) {
    const no_parte = s(raw['NO_PARTE'] || raw['No_Parte'] || raw['SKU']);
    const fecha = d2date(raw['FECHA'] || raw['Fecha']);
    if (!no_parte || !fecha) return null;
    return {
      cliente: 'digitalife',
      fecha,
      no_parte,
      descripcion: s(raw['DESCRIPCION'] || raw['Descripcion']),
      marca: s(raw['MARCA'] || raw['Marca']),
      cantidad: n(raw['CANTIDAD'] || raw['Cantidad']),
      precio: n(raw['PRECIO'] || raw['Precio']),
      descuento: n(raw['DESCUENTO'] || raw['Descuento']),
      iva: n(raw['IVA']),
      subtotal: n(raw['SUBTOTAL'] || raw['Subtotal']),
      total: n(raw['TOTAL'] || raw['Total']),
      updated_at: new Date().toISOString()
    };
  },
  inventario_digitalife(raw) {
    const no_parte = s(raw['Parte'] || raw['SKU'] || raw['No_Parte']);
    if (!no_parte) return null;
    return {
      cliente: 'digitalife',
      no_parte,
      descripcion: s(raw['Título'] || raw['Titulo'] || raw['Descripcion']),
      marca: s(raw['Marca']),
      inventario: n(raw['Stock']),
      stock_ensambles: n(raw['Stock Ensambles']),
      costo_convenio: n(raw['Costo Convenio']),
      precio_venta: n(raw['Precio Venta']),
      fecha_ultima_venta: d2date(raw['FeCha Ultima Venta']),
      dias_sin_venta: n(raw['Días sin Venta'] || raw['Dias sin Venta']),
      ultima_entrada: d2date(raw['Ultima Entrada']),
      payload: raw,
      updated_at: new Date().toISOString()
    };
  }
};

// ---------- parser PCEL (formato combinado semanal) ----------
function parsePcelFile(wb, XLSX, fileName) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  if (!rows.length) return { rows: [], anio: null, semana: null };
  // detectar columna "Vta Semana NN"
  const head = Object.keys(rows[0]);
  const semCol = head.find(h => /vta\s*semana/i.test(h));
  const semNum = semCol ? parseInt((semCol.match(/\d+/) || [])[0] || '0', 10) : null;
  // derivar año desde el filename (ej "venta-marca-ACTECK-2026-04-13-...")
  const m = fileName.match(/(\d{4})-(\d{2})-(\d{2})/);
  const anio = m ? parseInt(m[1], 10) : new Date().getFullYear();
  // columnas de meses (Vta Abr/Mar/Feb...)
  const mesCols = head.filter(h => /vta\s*(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)/i.test(h));
  const mapped = [];
  for (const r of rows) {
    const sku = s(r['Modelo']);
    if (!sku) continue;
    mapped.push({
      anio,
      semana: semNum,
      sku,
      pcel_sku: s(r['Sku']),
      marca: s(r['Marca']),
      producto: s(r['Producto']),
      familia: s(r['Familia']),
      subfamilia: s(r['Subfamilia']),
      inventario: n(r['Inventario']),
      costo_promedio: n(r['Costo Promedio']),
      antiguedad: n(r['Antiguedad']),
      transito: n(r['Transito']),
      back_order: n(r['Back Order']),
      vta_semana: n(r[semCol]),
      vta_mes_actual: n(mesCols[0] ? r[mesCols[0]] : null),
      vta_mes_1: n(mesCols[1] ? r[mesCols[1]] : null),
      vta_mes_2: n(mesCols[2] ? r[mesCols[2]] : null),
      vta_mes_3: n(mesCols[3] ? r[mesCols[3]] : null),
      updated_at: new Date().toISOString()
    });
  }
  return { rows: mapped, anio, semana: semNum };
}

// ---------- parser EdC ----------
function parseEdCFile(wb, XLSX) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  // Celdas fijas: F2=código cliente, F3=nombre, F6=texto "Estado de cuenta de la Semana"
  // R7: headers de totales (Saldo Actual, Saldo Vencido, Notas Credito, Saldo a Vencer)
  // R8: valores totales + razon_social en B8
  // R10: headers de detalle
  // R11+: detalles
  const codigo = s(aoa[1] && aoa[1][5]);
  const mapCliente = { '00473': 'pcel', '00764': 'digitalife' };
  const cliente = mapCliente[codigo];
  if (!cliente) return { error: 'Código de cliente desconocido: ' + codigo };
  // Semana: extraer de texto en F6
  const textoSemana = s(aoa[5] && aoa[5][5]) || '';
  const mSem = textoSemana.match(/semana\s*(\d+)/i);
  const semana = mSem ? parseInt(mSem[1], 10) : null;
  const anio = new Date().getFullYear(); // año corriente (puede ajustarse)
  const r8 = aoa[7] || [];
  const header = {
    cliente, anio, semana,
    fecha_corte: new Date().toISOString().slice(0, 10),
    razon_social: s(r8[1]),
    saldo_actual: n(r8[5]),
    saldo_vencido: n(r8[6]),
    notas_credito: n(r8[7]),
    saldo_a_vencer: n(r8[8])
  };
  // Detalle: desde R11 en adelante (index 10)
  const detalleHeaders = aoa[9] || [];
  const detalles = [];
  for (let i = 10; i < aoa.length; i++) {
    const row = aoa[i] || [];
    if (!row[0] && !row[2]) continue; // fila vacía
    detalles.push({
      movimiento: s(row[0]),
      condicion: s(row[1]),
      referencia: s(row[2]),
      fecha_emision: d2date(row[3]),
      vencimiento: d2date(row[4]),
      importe_factura: n(row[5]),
      dias_moratorios: n(row[6]),
      saldo_actual: n(row[7]),
      aging_corriente: n(row[8]),
      aging_01_30: n(row[9]),
      aging_31_60: n(row[10]),
      aging_61_90: n(row[11]),
      aging_91_180: n(row[12]),
      aging_181_mas: n(row[13])
    });
  }
  return { header, detalles, cliente, anio, semana };
}

// ---------- Card component ----------
function Card({ title, fuente, status, children, onUpload, accept = '.xlsx,.xls', disabled, descripcion, log }) {
  const fileRef = useRef();
  const item = status?.items?.find(x => x.fuente === fuente);
  const ultima = item?.ultima_actualizacion ? new Date(item.ultima_actualizacion) : null;
  const registros = item?.registros ?? null;
  const hace = ultima ? relTime(ultima) : 'sin datos';

  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: 0 }}>{title}</h3>
          {descripcion && <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0 0' }}>{descripcion}</p>}
        </div>
        <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>Hace {hace}</span>
      </div>
      {registros !== null && <div style={{ fontSize: 12, color: '#475569' }}>{registros.toLocaleString('es-MX')} registros</div>}
      {children}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input ref={fileRef} type="file" accept={accept} style={{ display: 'none' }} onChange={e => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = '';
        }} />
        <button disabled={disabled} onClick={() => fileRef.current?.click()} style={{
          background: disabled ? '#94a3b8' : '#2563eb', color: 'white', border: 0, borderRadius: 8,
          padding: '8px 14px', fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 500
        }}>
          {disabled ? 'Subiendo…' : 'Subir archivo'}
        </button>
      </div>
      {log && <pre style={{ fontSize: 11, color: '#475569', background: '#f8fafc', padding: 8, borderRadius: 6, margin: 0, maxHeight: 120, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{log}</pre>}
    </div>
  );
}

function relTime(d) {
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'un momento';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  return `${days}d`;
}

// ---------- upload orquestador ----------
async function postChunk(type, rows, meta, chunkIndex, totalChunks, mode) {
  const r = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, rows, meta, chunkIndex, totalChunks, mode })
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
  }
  return r.json();
}

async function uploadAllChunks(type, rows, meta = {}, mode = 'append', onProgress) {
  const totalChunks = Math.max(1, Math.ceil(rows.length / CHUNK_SIZE));
  let inserted = 0;
  let ids = [];
  for (let i = 0; i < totalChunks; i++) {
    const chunk = rows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const res = await postChunk(type, chunk, { ...meta, totalRegistros: rows.length }, i, totalChunks, mode);
    inserted += res.inserted || 0;
    if (res.ids) ids = ids.concat(res.ids);
    onProgress?.(i + 1, totalChunks);
  }
  return { inserted, ids };
}

// ---------- main component ----------
export default function ActualizacionDatos({ perfil }) {
  const [status, setStatus] = useState({ items: [] });
  const [busy, setBusy] = useState(null); // fuente que está subiendo
  const [logs, setLogs] = useState({});   // fuente -> string

  const refreshStatus = async () => {
    try {
      const r = await fetch('/api/sync-status');
      const j = await r.json();
      if (j.ok) setStatus(j);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => { refreshStatus(); const t = setInterval(refreshStatus, 60000); return () => clearInterval(t); }, []);

  const appendLog = (fuente, msg) => setLogs(p => ({ ...p, [fuente]: ((p[fuente] || '') + msg + '\n').split('\n').slice(-30).join('\n') }));

  // Acceso: solo admin
  if (perfil?.rol !== 'admin') {
    return <div style={{ padding: 32 }}>Esta sección está reservada para administradores.</div>;
  }

  // ---- Handlers por card ----
  async function handleERP(file) {
    const fuente = 'erp';
    setBusy(fuente); setLogs(p => ({ ...p, [fuente]: '' }));
    try {
      appendLog(fuente, `Leyendo ${file.name}…`);
      const XLSX = await loadSheetJS();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      // Ventas
      if (wb.Sheets['Vw_TablaH_Ventas']) {
        appendLog(fuente, 'Parseando Vw_TablaH_Ventas…');
        const raw = XLSX.utils.sheet_to_json(wb.Sheets['Vw_TablaH_Ventas'], { defval: null });
        const mapped = raw.map(mappers.erp_sell_in).filter(Boolean);
        appendLog(fuente, `  ${raw.length} filas → ${mapped.length} relevantes`);
        const res = await uploadAllChunks('erp_sell_in', mapped, {}, 'append', (c, t) => appendLog(fuente, `  sell_in chunk ${c}/${t}`));
        appendLog(fuente, `  sell_in: ${res.inserted} insertados`);
      }
      // Inventario
      if (wb.Sheets['Vw_TablaH_Inventario']) {
        appendLog(fuente, 'Parseando Vw_TablaH_Inventario…');
        const raw = XLSX.utils.sheet_to_json(wb.Sheets['Vw_TablaH_Inventario'], { defval: null });
        const mapped = raw.map(mappers.erp_inventario).filter(Boolean);
        const res = await uploadAllChunks('erp_inventario', mapped, {}, 'replace', (c, t) => appendLog(fuente, `  inv chunk ${c}/${t}`));
        appendLog(fuente, `  inventario: ${res.inserted} insertados`);
      }
      appendLog(fuente, '✓ ERP cargado.');
      refreshStatus();
    } catch (e) { appendLog(fuente, 'ERROR: ' + e.message); }
    setBusy(null);
  }

  async function handleCatalogo(file) {
    const fuente = 'catalogo';
    setBusy(fuente); setLogs(p => ({ ...p, [fuente]: '' }));
    try {
      appendLog(fuente, `Leyendo ${file.name}…`);
      const XLSX = await loadSheetJS();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      // Roadmap: headers fila 13
      const roadmapSheet = wb.Sheets['Roadmap Q2 2026'] || wb.Sheets[wb.SheetNames.find(n => /roadmap/i.test(n))];
      if (roadmapSheet) {
        const raw = XLSX.utils.sheet_to_json(roadmapSheet, { defval: null, range: 12 });
        const mapped = raw.map(mappers.roadmap).filter(Boolean);
        appendLog(fuente, `Roadmap: ${raw.length} filas → ${mapped.length} válidas`);
        const res = await uploadAllChunks('roadmap', mapped, {}, 'replace', (c, t) => appendLog(fuente, `  roadmap ${c}/${t}`));
        appendLog(fuente, `  roadmap insertado: ${res.inserted}`);
      }
      // Precios: headers fila 5
      const preciosSheet = wb.Sheets['BD Lista de Precios'] || wb.Sheets[wb.SheetNames.find(n => /precios/i.test(n))];
      if (preciosSheet) {
        const raw = XLSX.utils.sheet_to_json(preciosSheet, { defval: null, range: 4 });
        const mapped = raw.map(mappers.precios).filter(Boolean);
        appendLog(fuente, `Precios: ${raw.length} filas → ${mapped.length} válidas`);
        const res = await uploadAllChunks('precios', mapped, {}, 'replace', (c, t) => appendLog(fuente, `  precios ${c}/${t}`));
        appendLog(fuente, `  precios insertado: ${res.inserted}`);
      }
      appendLog(fuente, '✓ Catálogo cargado.');
      refreshStatus();
    } catch (e) { appendLog(fuente, 'ERROR: ' + e.message); }
    setBusy(null);
  }

  async function handleSelloutDigitalife(file, replaceAll = false) {
    const fuente = 'sellout_digitalife';
    setBusy(fuente); setLogs(p => ({ ...p, [fuente]: '' }));
    try {
      appendLog(fuente, `Leyendo ${file.name}${replaceAll ? ' (reemplazo total)' : ''}…`);
      const XLSX = await loadSheetJS();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: null });
      const mapped = raw.map(mappers.sellout_digitalife).filter(Boolean);
      appendLog(fuente, `  ${raw.length} filas → ${mapped.length} válidas`);
      const res = await uploadAllChunks('sellout_digitalife', mapped, {}, replaceAll ? 'replace_all' : 'append', (c, t) => appendLog(fuente, `  chunk ${c}/${t}`));
      appendLog(fuente, `✓ Sellout Digitalife: ${res.inserted}`);
      refreshStatus();
    } catch (e) { appendLog(fuente, 'ERROR: ' + e.message); }
    setBusy(null);
  }

  async function handleSelloutPcel(file) {
    const fuente = 'sellout_pcel';
    setBusy(fuente); setLogs(p => ({ ...p, [fuente]: '' }));
    try {
      appendLog(fuente, `Leyendo ${file.name}…`);
      const XLSX = await loadSheetJS();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const { rows, anio, semana } = parsePcelFile(wb, XLSX, file.name);
      if (!semana) { appendLog(fuente, 'No se detectó "Vta Semana N" en el archivo.'); setBusy(null); return; }
      appendLog(fuente, `  Semana ${semana} / Año ${anio}: ${rows.length} filas`);
      const res = await uploadAllChunks('sellout_pcel', rows, { anio, semana }, 'replace_semana', (c, t) => appendLog(fuente, `  chunk ${c}/${t}`));
      appendLog(fuente, `✓ Sellout PCEL: ${res.inserted}`);
      refreshStatus();
    } catch (e) { appendLog(fuente, 'ERROR: ' + e.message); }
    setBusy(null);
  }

  async function handleInventarioDigitalife(file) {
    const fuente = 'inventario_digitalife';
    setBusy(fuente); setLogs(p => ({ ...p, [fuente]: '' }));
    try {
      const XLSX = await loadSheetJS();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: null });
      const mapped = raw.map(mappers.inventario_digitalife).filter(Boolean);
      appendLog(fuente, `${raw.length} filas → ${mapped.length} válidas`);
      const res = await uploadAllChunks('inventario_digitalife', mapped, {}, 'replace', (c, t) => appendLog(fuente, `  chunk ${c}/${t}`));
      appendLog(fuente, `✓ Inventario Digitalife: ${res.inserted}`);
      refreshStatus();
    } catch (e) { appendLog(fuente, 'ERROR: ' + e.message); }
    setBusy(null);
  }

  async function handleEdC(file) {
    const fuente = 'edc';
    setBusy(fuente); setLogs(p => ({ ...p, [fuente]: '' }));
    try {
      const XLSX = await loadSheetJS();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const parsed = parseEdCFile(wb, XLSX);
      if (parsed.error) { appendLog(fuente, 'ERROR: ' + parsed.error); setBusy(null); return; }
      appendLog(fuente, `EdC detectado: cliente=${parsed.cliente}, semana=${parsed.semana}, ${parsed.detalles.length} facturas`);
      // Paso 1: header
      const hdr = await postChunk('edc_header', [parsed.header], { cliente: parsed.cliente, anio: parsed.anio, semana: parsed.semana }, 0, 1, 'replace');
      const id = hdr.ids?.[0]?.id;
      if (!id) { appendLog(fuente, 'ERROR: no se obtuvo id del estado_cuenta'); setBusy(null); return; }
      // Paso 2: detalle
      const detalles = parsed.detalles.map(d => ({ ...d, estado_cuenta_id: id }));
      const res = await uploadAllChunks('edc_detalle', detalles, { estado_cuenta_id: id }, 'replace', (c, t) => appendLog(fuente, `  detalle ${c}/${t}`));
      appendLog(fuente, `✓ EdC ${parsed.cliente} semana ${parsed.semana}: ${res.inserted} facturas`);
      refreshStatus();
    } catch (e) { appendLog(fuente, 'ERROR: ' + e.message); }
    setBusy(null);
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Actualización de datos</h1>
      <p style={{ color: '#64748b', margin: '0 0 20px', fontSize: 13 }}>Subidas manuales por fuente. Cada tarjeta muestra cuándo se actualizó por última vez.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>

        <Card title="ERP diario" fuente="erp_sell_in" status={status} disabled={!!busy}
          descripcion="Hojas Vw_TablaH_Ventas + Vw_TablaH_Inventario. Sell in hace upsert por fecha+SKU, inventario se reemplaza."
          onUpload={handleERP} log={logs.erp} />

        <Card title="Catálogo (Roadmap + Precios)" fuente="roadmap" status={status} disabled={!!busy}
          descripcion="Archivo con hojas 'Roadmap Q2 2026' y 'BD Lista de Precios'. Reemplaza ambas tablas."
          onUpload={handleCatalogo} log={logs.catalogo} />

        <Card title="Sellout Digitalife" fuente="sellout_digitalife" status={status} disabled={!!busy}
          descripcion="Sellout semanal crudo del cliente (10 columnas). Para subir histórico completo hay que avisar."
          onUpload={(f) => handleSelloutDigitalife(f, false)} log={logs.sellout_digitalife}>
          <label style={{ fontSize: 11, color: '#64748b' }}>
            <input type="checkbox" id={'chk_histdig'} style={{ marginRight: 4 }} onChange={e => window.__histDig = e.target.checked} />
            Este archivo es el histórico completo (reemplaza todo)
          </label>
        </Card>

        <Card title="Sellout PCEL" fuente="sellout_pcel" status={status} disabled={!!busy}
          descripcion="Archivo 'venta-marca-...xls' por marca. Año desde nombre de archivo, semana desde columna 'Vta Semana N'."
          onUpload={handleSelloutPcel} log={logs.sellout_pcel} />

        <Card title="Inventario Digitalife" fuente="inventario_digitalife" status={status} disabled={!!busy}
          descripcion="Snapshot semanal de stock por SKU. Reemplaza inventario anterior del cliente."
          onUpload={handleInventarioDigitalife} log={logs.inventario_digitalife} />

        <Card title="Estado de Cuenta (Digitalife o PCEL)" fuente="edc_digitalife" status={status} disabled={!!busy}
          descripcion="Detecta el cliente por el código en F2 (00473=PCEL, 00764=Digitalife). Reemplaza la semana si ya existía."
          onUpload={handleEdC} log={logs.edc} />

        <div style={{ background: '#f1f5f9', border: '1px dashed #cbd5e1', borderRadius: 12, padding: 20, gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>Tránsito (automático desde Drive)</h3>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Pendiente de reconfigurar — sync scheduled task contra Master Embarques.</p>
        </div>

      </div>
    </div>
  );
}
