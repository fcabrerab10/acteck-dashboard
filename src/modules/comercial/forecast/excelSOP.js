// Exportador a Excel S&OP Ferru — una solicitud individual.
// Nombre del archivo: "S&OP Ferru <Mes> <Año>.xlsx" (mes/año = momento del export).
//
// Columnas (en orden, fijas):
//   SKU · Descripción · Envío · Proveedor · Fecha estimada de arribo
//   · Cantidad · # de Contenedores · Último Costo · Total
//
// Formato:
//   · Header: fondo negro, texto blanco bold, centrado
//   · Cantidad: número con miles
//   · Último Costo y Total: formato moneda USD ($#,##0.00)
//   · Fecha estimada: formato "d 'de' mmmm 'de' yyyy"
//
// Líneas con N envíos se EXPLOTAN en N filas. La columna # de
// Contenedores muestra el número de contenedores (1, 2, ...) o
// "Consolidado" si el SKU comparte contenedor.

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Estilo del header — fondo negro + texto blanco bold + centrado
const HEADER_STYLE = {
  fill:      { patternType: 'solid', fgColor: { rgb: '000000' } },
  font:      { color: { rgb: 'FFFFFF' }, bold: true, sz: 11 },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top:    { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left:   { style: 'thin', color: { rgb: '000000' } },
    right:  { style: 'thin', color: { rgb: '000000' } },
  },
};

// Formatos numéricos
const FMT_MONEDA  = '"$"#,##0.00';
const FMT_NUM     = '#,##0';
const FMT_FECHA   = 'd "de" mmmm "de" yyyy'; // ej. 6 de mayo de 2026

// Convierte 'YYYY-MM-DD' → Date (UTC al mediodía para evitar tz issues)
function parseFecha(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export async function exportarSolicitudExcel(solicitud, lineas) {
  // Cargar SheetJS con estilos (community fork compatible con la API de xlsx)
  const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/+esm');

  // Construir filas: una por línea, o N por línea si tiene envíos
  const filas = [];
  (lineas || [])
    .sort((a, b) => (a.orden || 0) - (b.orden || 0))
    .forEach((l) => {
      const costo = l.ultimo_costo_usd != null ? Number(l.ultimo_costo_usd) : 0;
      const tieneEnvios = Array.isArray(l.envios) && l.envios.length > 1;
      // # de Contenedores — si es consolidado o tiene grupo, mostrar texto
      const contenedoresLabel = (() => {
        if (l.es_consolidado || l.grupo_contenedor) {
          return l.grupo_contenedor
            ? `Consolidado (grupo ${l.grupo_contenedor})`
            : 'Consolidado';
        }
        return l.contenedores ? Number(l.contenedores) : '';
      })();

      if (tieneEnvios) {
        const total = l.envios.length;
        l.envios.forEach((e, i) => {
          const qty = Number(e.cantidad) || 0;
          filas.push({
            'SKU':                l.sku,
            'Descripción':        l.descripcion || '',
            'Envío':              `${i + 1}/${total}`,
            'Proveedor':          l.proveedor || '',
            'Fecha estimada de arribo': parseFecha(e.fecha_estimada),
            'Cantidad':           qty,
            '# de Contenedores':  contenedoresLabel,
            'Último Costo':       costo,
            'Total':              qty * costo,
          });
        });
      } else {
        const qty = Number(l.cantidad) || 0;
        filas.push({
          'SKU':                l.sku,
          'Descripción':        l.descripcion || '',
          'Envío':              '1/1',
          'Proveedor':          l.proveedor || '',
          'Fecha estimada de arribo': parseFecha(l.fecha_estimada),
          'Cantidad':           qty,
          '# de Contenedores':  contenedoresLabel,
          'Último Costo':       costo,
          'Total':              qty * costo,
        });
      }
    });

  // Total al pie
  const totalCantidad = filas.reduce((a, f) => a + Number(f['Cantidad'] || 0), 0);
  const totalUsd      = filas.reduce((a, f) => a + Number(f['Total'] || 0), 0);

  const COLUMNAS = [
    'SKU','Descripción','Envío','Proveedor','Fecha estimada de arribo',
    'Cantidad','# de Contenedores','Último Costo','Total',
  ];

  // Construir matriz AOA (array of arrays) — más control sobre estilos
  const aoa = [
    COLUMNAS, // header
    ...filas.map((f) => COLUMNAS.map((c) => f[c] ?? '')),
    [], // separador
    ['', '', '', '', 'TOTAL', totalCantidad, '', '', totalUsd],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Aplicar estilos celda por celda
  const range = XLSX.utils.decode_range(ws['!ref']);
  // Map columna nombre → índice (0-based)
  const colIdx = Object.fromEntries(COLUMNAS.map((c, i) => [c, i]));

  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell) continue;

      // Header (fila 0)
      if (R === 0) {
        cell.s = HEADER_STYLE;
        continue;
      }

      // Estilos por columna
      if (C === colIdx['Fecha estimada de arribo']) {
        if (cell.v instanceof Date) {
          cell.t = 'd';
          cell.z = FMT_FECHA;
          cell.s = { alignment: { horizontal: 'left' } };
        }
      } else if (C === colIdx['Cantidad']) {
        if (typeof cell.v === 'number') {
          cell.t = 'n';
          cell.z = FMT_NUM;
          cell.s = { alignment: { horizontal: 'right' } };
        }
      } else if (C === colIdx['Último Costo'] || C === colIdx['Total']) {
        if (typeof cell.v === 'number') {
          cell.t = 'n';
          cell.z = FMT_MONEDA;
          cell.s = { alignment: { horizontal: 'right' } };
        }
      }

      // Fila TOTAL al final — bold
      if (cell.v === 'TOTAL' || (R === range.e.r && C >= colIdx['Cantidad'])) {
        cell.s = { ...(cell.s || {}), font: { bold: true } };
        if (C === colIdx['Cantidad'] && typeof cell.v === 'number') {
          cell.z = FMT_NUM;
        }
        if (C === colIdx['Total'] && typeof cell.v === 'number') {
          cell.z = FMT_MONEDA;
        }
      }
    }
  }

  // Anchos de columna razonables
  ws['!cols'] = [
    { wch: 14 },  // SKU
    { wch: 40 },  // Descripción
    { wch: 8 },   // Envío
    { wch: 22 },  // Proveedor
    { wch: 26 },  // Fecha estimada de arribo
    { wch: 12 },  // Cantidad
    { wch: 22 },  // # de Contenedores
    { wch: 14 },  // Último Costo
    { wch: 16 },  // Total
  ];

  // Header un poco más alto para el wrap
  ws['!rows'] = [{ hpt: 22 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'S&OP Ferru');

  // Nombre del archivo
  const hoy = new Date();
  const filename = `S&OP Ferru ${MESES[hoy.getMonth()]} ${hoy.getFullYear()}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}
