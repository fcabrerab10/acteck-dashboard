// Estado de Resultados (P&L) · "Cierre <período>.xlsx", hoja "Estado de Resultados".
// Carga sólo los meses con valores (VENTAS Y SERVICIOS A TASA GENERAL ≠ 0); no
// borra meses previos. Upsert por (razon_social, anio, mes, cuenta_norm).
import { XLSX, norm } from './_util';

const NOMBRES_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const SUBTOTALES = new Set([
  'venta_neta', 'total_costo_de_venta', 'utilidad_bruta',
  'total_gastos', 'total_gastos_proyectos',
  'uafir_con_proyectos', 'uafir_sin_proyectos',
  'total_productos_financieros',
  'uaii_contable_con_proyecctos', 'uaii_contable_con_proyectos',
  'uaii_contable_sin_proyectos',
]);
const cuentaSlug = (s) => norm(s).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const cuentaDe = (row) => { for (let c = 0; c < 3; c++) { const v = row[c]; if (typeof v === 'string' && v.trim() !== '') return v.trim(); } return null; };

export default function estadosResultados(wb) {
  const X = XLSX();
  const sh = wb.Sheets['Estado de Resultados'] || wb.Sheets['ESTADO DE RESULTADOS'] || wb.Sheets['Estado de resultados'];
  if (!sh) throw new Error('No se encontró la hoja "Estado de Resultados"');
  const arr = X.utils.sheet_to_json(sh, { defval: null, header: 1 });

  let razonSocial = 'REVKO TECHNOLOGY SA DE CV';
  for (let r = 0; r < Math.min(6, arr.length); r++) {
    for (const v of arr[r] || []) if (typeof v === 'string' && /S\.?A\.?\s*DE\s*C\.?V\.?/i.test(v)) { razonSocial = v.trim(); break; }
  }
  let anio = null;
  for (let r = 0; r < Math.min(8, arr.length) && !anio; r++) {
    for (const v of arr[r] || []) if (typeof v === 'string') { const m = v.match(/EJERCICIO\s+(\d{4})/i); if (m) { anio = parseInt(m[1], 10); break; } }
  }
  if (!anio) throw new Error('No se detectó el año del P&L (busca "EJERCICIO YYYY" en las primeras filas).');

  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(20, arr.length); r++) {
    let count = 0;
    for (const v of arr[r] || []) if (NOMBRES_MES.includes(norm(v))) count++;
    if (count >= 6) { headerRowIdx = r; break; }
  }
  if (headerRowIdx < 0) throw new Error('No se encontró la fila de headers de meses en la hoja');
  const colToMes = {};
  (arr[headerRowIdx] || []).forEach((v, c) => { const idx = NOMBRES_MES.indexOf(norm(v)); if (idx >= 0) colToMes[c] = idx + 1; });

  // Meses activos: fila VENTAS Y SERVICIOS A TASA GENERAL con valor ≠ 0.
  const mesesActivos = new Set();
  for (let r = headerRowIdx + 1; r < arr.length; r++) {
    const row = arr[r]; if (!row) continue;
    const cuenta = cuentaDe(row);
    if (cuenta && cuentaSlug(cuenta) === 'ventas_y_servicios_a_tasa_general') {
      for (const [colStr, mes] of Object.entries(colToMes)) { const v = row[Number(colStr)]; if (typeof v === 'number' && v !== 0) mesesActivos.add(mes); }
      break;
    }
  }
  if (mesesActivos.size === 0) throw new Error('No se detectaron meses con valores reales (revisa que la hoja tenga la línea VENTAS Y SERVICIOS A TASA GENERAL).');

  // Comentarios de celda → notas por (cuenta, mes) o por cuenta.
  const notasPorClave = {}, notasPorCuenta = {};
  const limpiarTexto = (t) => String(t || '').replace(/^[^:\n]+:\s*/, '').replace(/\s+/g, ' ').trim();
  Object.keys(sh).forEach((addr) => {
    if (addr[0] === '!') return;
    const cell = sh[addr];
    if (!cell || !cell.c) return;
    const ref = X.utils.decode_cell(addr);
    const texto = limpiarTexto(cell.c.map((p) => p.t || '').join(' '));
    if (!texto) return;
    const row = arr[ref.r]; if (!row) return;
    const cuenta = cuentaDe(row); if (!cuenta) return;
    const slug = cuentaSlug(cuenta); if (!slug) return;
    if (colToMes[ref.c] != null) notasPorClave[`${slug}|${colToMes[ref.c]}`] = texto; else notasPorCuenta[slug] = texto;
  });

  const out = [];
  let orden = 0;
  for (let r = headerRowIdx + 1; r < arr.length; r++) {
    const row = arr[r]; if (!row) continue;
    const cuenta = cuentaDe(row); if (!cuenta) continue;
    if (/^informacion general$/i.test(cuenta)) continue;
    const slug = cuentaSlug(cuenta); if (!slug) continue;
    orden++;
    const esSubtotal = SUBTOTALES.has(slug);
    for (const [colStr, mes] of Object.entries(colToMes)) {
      if (!mesesActivos.has(mes)) continue;
      const v = row[Number(colStr)];
      if (v == null || v === '' || typeof v === 'string') continue;
      const valor = Number(v); if (isNaN(valor)) continue;
      out.push({ razon_social: razonSocial, anio, mes, cuenta, cuenta_norm: slug, valor, orden, es_subtotal: esSubtotal, nota: notasPorClave[`${slug}|${mes}`] || notasPorCuenta[slug] || null });
    }
  }
  if (out.length === 0) throw new Error('No se extrajo ninguna celda numérica del P&L.');
  const meses = [...mesesActivos].sort((a, b) => a - b);
  return { table: 'estados_resultados', onConflict: 'razon_social,anio,mes,cuenta_norm', rows: out, resumen: `${razonSocial} · ${anio} · meses ${meses.join(', ')} · ${out.length} celdas` };
}
