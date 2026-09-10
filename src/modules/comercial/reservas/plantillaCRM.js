// Forecast CRM · plantilla exacta que pide el CRM (referencia: Plantilla_Forecast_2026-10.xlsx).
//
// Hoja "Forecast": cabecera `Tipo (directa/indirecta)` · `Cliente (codigo o nombre)` · `SKU` ·
// `Justificacion (min 15 caracteres, una por SKU)` · una columna por mes `YYYY-MM` × N.
// Una fila por cliente + SKU; piezas enteras (celda numérica); meses sin forecast = celda de texto vacía
// (así viene en la plantilla de referencia). Sin estilos, sin merges, sin freeze. Anchos de columna
// 22 · 34 · 14 · 52 · 11 × N (wch).
// Hoja "Instrucciones": el texto tal cual del archivo, con la ventana dinámica ("6 meses desde Oct 26").
//
// `construirLibro(XLSX, …)` es puro (recibe la librería) para poder verificarlo en node con xlsx-js-style.
// xlsx-js-style se carga bajo demanda (CLAUDE.md · Rendimiento).
import { ventanaCRM } from './calculo';

const MES_ABR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const ANCHOS = [22, 34, 14, 52];
const ANCHO_MES = 11;

export const CABECERA_FIJA = ['Tipo (directa/indirecta)', 'Cliente (codigo o nombre)', 'SKU', 'Justificacion (min 15 caracteres, una por SKU)'];

export function nombreArchivoPlantilla(mesInicio) { return `Plantilla_Forecast_${mesInicio}.xlsx`; }

/** Texto de la hoja Instrucciones (A1..A11), copiado del archivo de referencia; A3 lleva la ventana. */
export function instrucciones(mesInicio, meses = 6) {
  const [a, m] = String(mesInicio).split('-').map(Number);
  const desde = `${MES_ABR[m - 1]} ${String(a).slice(2)}`;
  return [
    'Como llenar la plantilla de forecast',
    '',
    `1. Una fila por cliente + SKU. Las columnas de meses ya vienen con la ventana que elegiste (${meses} meses desde ${desde}).`,
    '2. Tipo: "directa" para cuentas directas (mayoristas y retail), "indirecta" para distribuidores de submayoreo. Si lo dejas vacio se busca en ambos.',
    '3. Cliente: el codigo de cliente (ej. 00417) o el nombre exacto como aparece en el CRM. Si el nombre coincide con varios, la fila se rechaza y te lo dice.',
    '4. SKU: tal cual esta en el catalogo (ej. AC-943352). Si no existe en el catalogo, la fila se rechaza.',
    '5. Justificacion: obligatoria, minimo 15 caracteres, una por SKU (cubre todos sus meses).',
    '6. Piezas por mes: enteros. Deja en blanco los meses sin forecast. Al menos un mes debe traer piezas.',
    '7. Borra las dos filas de ejemplo antes de subir el archivo.',
    '8. Al subir, las filas validas caen a la lista "Por guardar"; revisala y pulsa Guardar. Se envian directo a autorizacion, igual que la captura manual.',
    '9. Si un mes ya existe enviado o autorizado para ese cliente + SKU, no se sobreescribe (se avisa). Los borradores y rechazados si se recapturan.',
  ];
}

/**
 * Construye el workbook. filas: [{ tipo, cliente (código o nombre), sku, justificacion, meses: { 'YYYY-MM': n|null } }]
 * ordenadas como se quieran ver. Devuelve el objeto workbook de SheetJS.
 */
export function construirLibro(XLSX, { mesInicio, meses = 6, filas }) {
  const ventana = ventanaCRM(mesInicio, meses);
  const cab = [...CABECERA_FIJA, ...ventana.map((m) => m.key)];
  const aoa = [cab];
  for (const f of filas) {
    aoa.push([
      String(f.tipo || ''), String(f.cliente || ''), String(f.sku || ''), String(f.justificacion || '').trim(),
      ...ventana.map((m) => { const v = f.meses?.[m.key]; return v == null || v === '' || Number(v) === 0 ? '' : Math.round(Number(v)); }),
    ]);
  }
  const wsF = XLSX.utils.aoa_to_sheet(aoa);
  // Meses en blanco: aoa_to_sheet omite las cadenas vacías; la referencia sí trae la celda (t:'s', v:'').
  for (let r = 1; r < aoa.length; r++) {
    for (let c = CABECERA_FIJA.length; c < cab.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!wsF[addr]) wsF[addr] = { t: 's', v: '' };
    }
  }
  wsF['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(aoa.length - 1, 0), c: cab.length - 1 } });
  wsF['!cols'] = [...ANCHOS.map((w) => ({ wch: w })), ...ventana.map(() => ({ wch: ANCHO_MES }))];

  const textos = instrucciones(mesInicio, meses);
  const wsI = XLSX.utils.aoa_to_sheet(textos.map((t) => [t]));
  if (!wsI.A2) wsI.A2 = { t: 's', v: '' };
  wsI['!ref'] = `A1:A${textos.length}`;
  wsI['!cols'] = [{ wch: 140 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsF, 'Forecast');
  XLSX.utils.book_append_sheet(wb, wsI, 'Instrucciones');
  return wb;
}

/** Workbook → Blob xlsx (en el navegador). */
export async function plantillaBlob({ mesInicio, meses = 6, filas }) {
  const mod = await import('xlsx-js-style');
  const XLSX = mod.default || mod;
  const wb = construirLibro(XLSX, { mesInicio, meses, filas });
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** Filas de forecast_crm (una por mes) → filas de plantilla (una por cliente + SKU). */
export function filasDesdeCrm(rows, ventana, { orden } = {}) {
  const keys = new Set(ventana.map((m) => m.key));
  const porFila = new Map();
  for (const r of rows || []) {
    const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
    if (!keys.has(key)) continue;
    const k = `${r.cliente_key}|${r.sku}`;
    let f = porFila.get(k);
    if (!f) { f = { clienteKey: r.cliente_key, tipo: r.tipo || 'directa', cliente: r.cliente_codigo || r.cliente_nombre || r.cliente_key, sku: r.sku, justificacion: r.justificacion || '', meses: {} }; porFila.set(k, f); }
    if (Number(r.piezas) > 0) f.meses[key] = Number(r.piezas);
    if (!f.justificacion && r.justificacion) f.justificacion = r.justificacion;
  }
  const out = [...porFila.values()].filter((f) => Object.keys(f.meses).length > 0);
  if (orden) { const idx = new Map(orden.map((s, i) => [s, i])); out.sort((a, b) => (idx.get(a.sku) ?? 1e9) - (idx.get(b.sku) ?? 1e9) || a.sku.localeCompare(b.sku)); }
  return out;
}
