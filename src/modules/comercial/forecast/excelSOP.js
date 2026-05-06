// Exportador a Excel S&OP Ferru — una solicitud individual.
// Nombre del archivo: "S&OP Ferru <Mes> <Año>.xlsx" donde el mes/año
// son del momento del export (cuando Fernando lo manda al equipo).

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export async function exportarSolicitudExcel(solicitud, lineas) {
  // Cargar SheetJS dinámicamente (igual que el resto del proyecto)
  const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');

  // Explotar líneas con múltiples envíos en filas separadas (Envío 1/N, 2/N, ...)
  const filas = [];
  (lineas || [])
    .sort((a, b) => (a.orden || 0) - (b.orden || 0))
    .forEach((l) => {
      const costo = l.ultimo_costo_usd != null ? Number(l.ultimo_costo_usd) : 0;
      const tieneEnvios = Array.isArray(l.envios) && l.envios.length > 1;
      if (tieneEnvios) {
        const total = l.envios.length;
        l.envios.forEach((e, i) => {
          const qty = Number(e.cantidad) || 0;
          filas.push({
            'SKU':                  l.sku,
            'Descripción':          l.descripcion || '',
            'Envío':                `${i + 1}/${total}`,
            'Cantidad':             qty,
            'Proveedor':            l.proveedor || '',
            'Fecha estimada arribo': e.fecha_estimada || '',
            'Último costo USD':     costo || '',
            'Total USD':            qty * costo,
            'Pzs / contenedor':     l.piezas_por_contenedor || '',
            'Contenedores':         l.contenedores || '',
            'Consolidado':          l.es_consolidado ? 'Sí' : '',
            'Grupo contenedor':     l.grupo_contenedor || '',
          });
        });
      } else {
        const qty = Number(l.cantidad) || 0;
        filas.push({
          'SKU':                  l.sku,
          'Descripción':          l.descripcion || '',
          'Envío':                '1/1',
          'Cantidad':             qty,
          'Proveedor':            l.proveedor || '',
          'Fecha estimada arribo': l.fecha_estimada || '',
          'Último costo USD':     costo || '',
          'Total USD':            qty * costo,
          'Pzs / contenedor':     l.piezas_por_contenedor || '',
          'Contenedores':         l.contenedores || '',
          'Consolidado':          l.es_consolidado ? 'Sí' : '',
          'Grupo contenedor':     l.grupo_contenedor || '',
        });
      }
    });

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
