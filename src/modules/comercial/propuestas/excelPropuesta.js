// excelPropuesta.js — Excel de la propuesta de venta (hoja Resumen + hojas por familia para Digitalife).
// Compartido por escritorio (PropuestasTab → VistaRevisar) y celular (PropuestaEditor):
//
//   exportarPropuestaExcel({ cliente, propuestaLista, nombre })  → descarga (escritorio) y devuelve el nombre
//   propuestaExcelBlob({ cliente, propuestaLista, nombre })      → { blob, filename } para compartir en el celular
//   construirWorkbookPropuesta(XLSX, { cliente, propuestaLista, nombre }) → { wb, filename }
//
// cliente = { key, label } · propuestaLista = [{ sku, descripcion, marca, familia, piezas, precio }]
// Nombre del archivo: "Propuesta <Cliente> <nombre> <Mes> <Año>.xlsx" (mes/año = momento del export).
import { MES_FULL, familiaHoja } from './constantes';

async function cargarXLSX() {
  const mod = await import('xlsx-js-style');
  return mod.default || mod;
}

export function construirWorkbookPropuesta(XLSX, { cliente, propuestaLista, nombre }) {
  const total = propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0) * (Number(r.precio) || 0), 0);
  const piezas = propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0), 0);
  // ─── Estilos: header negro con letra blanca en negritas ───
  const HEADER_STYLE = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' },
    fill: { fgColor: { rgb: '000000' }, patternType: 'solid' },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: {
      top:    { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left:   { style: 'thin', color: { rgb: '000000' } },
      right:  { style: 'thin', color: { rgb: '000000' } },
    },
  };
  const CELL_BORDER = {
    top:    { style: 'thin', color: { rgb: 'D9D9D9' } },
    bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
    left:   { style: 'thin', color: { rgb: 'D9D9D9' } },
    right:  { style: 'thin', color: { rgb: 'D9D9D9' } },
  };
  const CELL_STYLE = {
    font: { sz: 10.5, name: 'Calibri' },
    alignment: { vertical: 'center' },
    border: CELL_BORDER,
  };
  const NUM_STYLE = {
    ...CELL_STYLE,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: '#,##0',
  };
  const MONEY_STYLE = {
    ...CELL_STYLE,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: '"$"#,##0.00',
  };
  const TOTAL_LABEL_STYLE = {
    font: { bold: true, sz: 11, name: 'Calibri' },
    alignment: { horizontal: 'right', vertical: 'center' },
    fill: { fgColor: { rgb: 'F2F2F2' }, patternType: 'solid' },
    border: CELL_BORDER,
  };
  const TOTAL_NUM_STYLE = { ...NUM_STYLE, font: { bold: true, sz: 11, name: 'Calibri' }, fill: { fgColor: { rgb: 'F2F2F2' }, patternType: 'solid' } };
  const TOTAL_MONEY_STYLE = { ...MONEY_STYLE, font: { bold: true, sz: 11, name: 'Calibri' }, fill: { fgColor: { rgb: 'F2F2F2' }, patternType: 'solid' } };

  // ─── Helper: construir una hoja con estilo ───
  // rows es array de { sku, descripcion|desc, marca, familia, piezas, precio }
  const buildSheet = (rowsData, { incluirFamilia = true } = {}) => {
    const headers = incluirFamilia
      ? ['SKU', 'Descripción', 'Marca', 'Familia', 'Piezas', 'Precio unitario', 'Total línea']
      : ['SKU', 'Descripción', 'Marca', 'Piezas', 'Precio unitario', 'Total línea'];

    const dataRows = rowsData.map((r) => {
      const pz = Number(r.piezas) || 0;
      const px = Number(r.precio) || 0;
      return incluirFamilia
        ? [r.sku, r.descripcion || r.desc || '', r.marca || '', r.familia || '', pz, px, pz * px]
        : [r.sku, r.descripcion || r.desc || '', r.marca || '', pz, px, pz * px];
    });

    const sumPz = rowsData.reduce((s, r) => s + (Number(r.piezas) || 0), 0);
    const sumTotal = rowsData.reduce((s, r) => s + (Number(r.piezas) || 0) * (Number(r.precio) || 0), 0);
    const totalRow = incluirFamilia
      ? ['', '', '', 'TOTAL', sumPz, '', sumTotal]
      : ['', '', 'TOTAL', sumPz, '', sumTotal];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows, totalRow]);

    // Anchos
    ws['!cols'] = incluirFamilia
      ? [{ wch: 14 }, { wch: 60 }, { wch: 14 }, { wch: 20 }, { wch: 10 }, { wch: 16 }, { wch: 16 }]
      : [{ wch: 14 }, { wch: 60 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 16 }];
    ws['!rows'] = [{ hpt: 24 }]; // header más alto

    const colCount = headers.length;
    const totalRowIdx = dataRows.length + 1; // 0 = header, 1..n = data, n+1 = total

    // Aplicar estilos celda por celda
    for (let c = 0; c < colCount; c++) {
      // Header
      const hAddr = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[hAddr]) ws[hAddr].s = HEADER_STYLE;

      // Data rows
      for (let r = 1; r <= dataRows.length; r++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) continue;
        const piezasCol = incluirFamilia ? 4 : 3;
        const precioCol = incluirFamilia ? 5 : 4;
        const totalCol  = incluirFamilia ? 6 : 5;
        if (c === piezasCol) ws[addr].s = NUM_STYLE;
        else if (c === precioCol || c === totalCol) ws[addr].s = MONEY_STYLE;
        else ws[addr].s = CELL_STYLE;
      }

      // Total row
      const tAddr = XLSX.utils.encode_cell({ r: totalRowIdx, c });
      if (!ws[tAddr]) {
        ws[tAddr] = { t: 's', v: '' };
      }
      const piezasCol = incluirFamilia ? 4 : 3;
      const totalCol  = incluirFamilia ? 6 : 5;
      if (c === piezasCol) ws[tAddr].s = TOTAL_NUM_STYLE;
      else if (c === totalCol) ws[tAddr].s = TOTAL_MONEY_STYLE;
      else ws[tAddr].s = TOTAL_LABEL_STYLE;
    }

    // Autofiltro y freeze header
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: dataRows.length, c: colCount - 1 } }) };
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    // Expandir el range para incluir la fila de totales
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalRowIdx, c: colCount - 1 } });

    return ws;
  };

  // ─── Hoja Resumen ───
  const now = new Date();
  const mesLbl = MES_FULL[now.getMonth()];
  const anio = now.getFullYear();
  const nombreLimpio = (nombre || 'Cierre').trim();
  const fechaLbl = `${String(now.getDate()).padStart(2, '0')} ${MES_FULL[now.getMonth()]} ${anio}`;

  // Segmentación única de la tabla resumen:
  //   Resumen general · Monitores · Sillas · Todas las categorías (Unificadas)
  // Para clientes ≠ Digitalife, Monitores y Sillas quedan vacíos y solo se
  // muestra la fila de resumen general.
  const monitoresList = cliente.key === 'digitalife'
    ? propuestaLista.filter((r) => familiaHoja(r.familia) === 'Monitores')
    : [];
  const sillasList = cliente.key === 'digitalife'
    ? propuestaLista.filter((r) => familiaHoja(r.familia) === 'Sillas')
    : [];
  const otrasList = cliente.key === 'digitalife'
    ? propuestaLista.filter((r) => familiaHoja(r.familia) === 'Todo lo demás')
    : propuestaLista;
  const agregar = (list) => ({
    skus: list.length,
    piezas: list.reduce((s, r) => s + (Number(r.piezas) || 0), 0),
    total: list.reduce((s, r) => s + (Number(r.piezas) || 0) * (Number(r.precio) || 0), 0),
  });
  const aggGeneral = { skus: propuestaLista.length, piezas, total };
  const aggMonitores = agregar(monitoresList);
  const aggSillas = agregar(sillasList);
  const aggOtras = agregar(otrasList);

  const filasResumen = [['Resumen general', aggGeneral.skus, aggGeneral.piezas, aggGeneral.total]];
  if (cliente.key === 'digitalife') {
    filasResumen.push(
      ['Monitores', aggMonitores.skus, aggMonitores.piezas, aggMonitores.total],
      ['Sillas', aggSillas.skus, aggSillas.piezas, aggSillas.total],
      ['Todas las categorías (Unificadas)', aggOtras.skus, aggOtras.piezas, aggOtras.total],
    );
  }

  const resumenAoa = [
    ['Concepto', 'SKUs', 'Piezas', 'Total'],
    ...filasResumen,
  ];
  const wsResumen = XLSX.utils.aoa_to_sheet(resumenAoa);
  wsResumen['!cols'] = [{ wch: 34 }, { wch: 12 }, { wch: 14 }, { wch: 18 }];
  wsResumen['!rows'] = [{ hpt: 24 }];

  // Estilos: header negro + celdas
  for (let c = 0; c < 4; c++) {
    const h = XLSX.utils.encode_cell({ r: 0, c });
    if (wsResumen[h]) wsResumen[h].s = HEADER_STYLE;
    for (let r = 1; r <= filasResumen.length; r++) {
      const a = XLSX.utils.encode_cell({ r, c });
      if (!wsResumen[a]) continue;
      if (c === 0) wsResumen[a].s = CELL_STYLE;
      else if (c === 3) wsResumen[a].s = MONEY_STYLE;
      else wsResumen[a].s = NUM_STYLE;
    }
  }

  // ─── Construir el workbook ───
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

  if (cliente.key === 'digitalife') {
    // 3 hojas: Monitores, Sillas, Otras familias
    const monitores  = propuestaLista.filter((r) => familiaHoja(r.familia) === 'Monitores');
    const sillas     = propuestaLista.filter((r) => familiaHoja(r.familia) === 'Sillas');
    const otras      = propuestaLista.filter((r) => familiaHoja(r.familia) === 'Todo lo demás');
    if (monitores.length > 0) XLSX.utils.book_append_sheet(wb, buildSheet(monitores, { incluirFamilia: false }), 'Monitores');
    if (sillas.length > 0)    XLSX.utils.book_append_sheet(wb, buildSheet(sillas,    { incluirFamilia: false }), 'Sillas');
    if (otras.length > 0)     XLSX.utils.book_append_sheet(wb, buildSheet(otras,     { incluirFamilia: true }),  'Otras familias');
  } else {
    // Otros clientes: una sola hoja "Propuesta"
    XLSX.utils.book_append_sheet(wb, buildSheet(propuestaLista, { incluirFamilia: true }), 'Propuesta');
  }

  const fname = `Propuesta ${cliente.label} ${nombreLimpio} ${mesLbl} ${anio}.xlsx`;
  return { wb, filename: fname };
}

export async function exportarPropuestaExcel(opts) {
  const XLSX = await cargarXLSX();
  const { wb, filename } = construirWorkbookPropuesta(XLSX, opts);
  XLSX.writeFile(wb, filename);
  return filename;
}

/** Mismo libro que exportarPropuestaExcel pero como Blob (compartir por WhatsApp/correo desde el celular). */
export async function propuestaExcelBlob(opts) {
  const XLSX = await cargarXLSX();
  const { wb, filename } = construirWorkbookPropuesta(XLSX, opts);
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return { blob, filename };
}
