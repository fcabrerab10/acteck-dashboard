// Exportador a Excel S&OP Ferru — una solicitud individual.
// Nombre del archivo: "S&OP Ferru <Mes> <Año>.xlsx" donde el mes/año
// son del momento del export (cuando Fernando lo manda al equipo).

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export async function exportarSolicitudExcel(solicitud, lineas) {
  // Cargar SheetJS dinámicamente (igual que el resto del proyecto)
  const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');

  const filas = (lineas || [])
    .sort((a, b) => (a.orden || 0) - (b.orden || 0))
    .map((l) => ({
      'SKU':                  l.sku,
      'Descripción':          l.descripcion || '',
      'Cantidad':             Number(l.cantidad) || 0,
      'Proveedor':            l.proveedor || '',
      'Fecha estimada arribo': l.fecha_estimada || '',
      'Último costo USD':     l.ultimo_costo_usd != null ? Number(l.ultimo_costo_usd) : '',
      'Total USD':            (Number(l.cantidad) || 0) * (Number(l.ultimo_costo_usd) || 0),
      'Pzs / contenedor':     l.piezas_por_contenedor || '',
      'Contenedores':         l.contenedores || '',
      'Consolidado':          l.es_consolidado ? 'Sí' : '',
    }));

  // Total al final
  const totalPiezas = filas.reduce((a, f) => a + Number(f['Cantidad'] || 0), 0);
  const totalUsd    = filas.reduce((a, f) => a + Number(f['Total USD'] || 0), 0);
  filas.push({});
  filas.push({
    'SKU': 'TOTAL',
    'Cantidad': totalPiezas,
    'Total USD': totalUsd,
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(filas);
  // Auto-ancho de columnas
  const cols = Object.keys(filas[0] || {});
  ws['!cols'] = cols.map((c) => {
    const max = Math.max(c.length, ...filas.map((f) => String(f[c] ?? '').length));
    return { wch: Math.min(40, Math.max(8, max + 1)) };
  });
  XLSX.utils.book_append_sheet(wb, ws, 'S&OP Ferru');

  // Nombre del archivo basado en el momento del export
  const hoy = new Date();
  const mesLabel = MESES[hoy.getMonth()];
  const filename = `S&OP Ferru ${mesLabel} ${hoy.getFullYear()}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}
