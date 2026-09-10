// Catálogo de fuentes del importador central (Configuración → Actualización de datos).
//   · PUENTE: cargas automáticas (Mac mini). Se leen de /api/status?type=sync (sync_status + sync_events).
//   · GRUPOS / FUENTES: cargas manuales; cada fila tiene su parser en src/lib/parsers/ y
//     una cadencia con la que se calcula el anillo de frescura.
// Colores: sólo claves de theme.* (nunca hex aquí).

export const ORIGEN_PUENTE = 'Puente SQL (Mac mini)';

// Horarios launchd del puente (bridge/launchd/*.plist): 06:30 diario · cada hora 8–19 L-S.
export const HORARIO_PUENTE = { diario: { h: 6, m: 30 }, intradia: { desde: 8, hasta: 19, dias: [1, 2, 3, 4, 5, 6] }, latidoMin: 5 };

export const PUENTE = [
  { key: 'erp_sell_in',      titulo: 'Ventas ERP (facturación)', fuente: 'ERP 192.168.0.151 · Vw_TablaH_Ventas',        horario: 'Cada hora 8:00–19:00 L-S · 06:30', horaria: true, solicitud: 'ventas' },
  { key: 'erp_inventario',   titulo: 'Inventario ERP',           fuente: 'ERP 192.168.0.151 · Vw_TablaH_Inventario',    horario: 'Cada hora 8:00–19:00 L-S · 06:30', horaria: true, solicitud: 'inventario' },
  { key: 'precios',          titulo: 'Precios ERP',              fuente: 'ERP 192.168.0.151 · Vw_TablaM_Precios',       horario: 'Cada hora 8:00–19:00 L-S · 06:30', horaria: true, solicitud: 'precios' },
  { key: 'cuotas_mensuales', titulo: 'Cuotas por cliente',       fuente: 'RevkoBi 192.168.0.213 · dbo.BP',              horario: '06:30 diario', solicitud: 'cuotas',   manual: { href: '/uploads.html?fuente=cuotas-anuales', label: 'Subir a mano', title: 'Respaldo: subir "Cuotas <AÑO>.xlsx" con el parser de uploads.html' } },
  { key: 'sellout_general',  titulo: 'Sell out general',         fuente: 'SELLOUT 192.168.0.160 · dbo.sellout',         horario: '06:30 diario', solicitud: 'sellout' },
  { key: 'embarques',        titulo: 'Master Embarques',         fuente: 'Google Sheet · tarea diaria de Claude (Drive)', horario: '07:00 diario', solicitud: 'embarques', manual: { href: '/uploads.html?fuente=master-embarques', label: 'Subir a mano', title: 'Respaldo: subir "Master Embarques.xlsx" con el parser de uploads.html' } },
];

export const SOLICITUDES = [
  { id: 'ventas', label: 'Ventas ERP' }, { id: 'inventario', label: 'Inventario ERP' }, { id: 'precios', label: 'Precios ERP' },
  { id: 'cuotas', label: 'Cuotas' }, { id: 'sellout', label: 'Sell out general' }, { id: 'embarques', label: 'Master Embarques' }, { id: 'all', label: 'Todo' },
];

export const GRUPOS = [
  { id: 'globales',       label: 'Globales',          color: 'textMuted', subtitle: 'Datos generales (toda la empresa)' },
  { id: 'digitalife',     label: 'Digitalife',        color: 'accent',    subtitle: 'API GLOBAL · CAJADL01' },
  { id: 'pcel',           label: 'PCEL',              color: 'red',       subtitle: 'PC ONLINE' },
  { id: 'dicotech',       label: 'Dicotech',          color: 'green',     subtitle: 'DICOTECH MAYORISTA · REVKO' },
  { id: 'estados_cuenta', label: 'Estados de Cuenta', color: 'purple',    subtitle: 'Cortes semanales con aging por cliente' },
];

// cadencia: { tipo:'semanal', dia: 1..6 (1 = lunes) } · { tipo:'mensual', dia: N } · { tipo:'cambio' }
const LUNES = { tipo: 'semanal', dia: 1, label: 'lunes' };
const MARTES = { tipo: 'semanal', dia: 2, label: 'martes' };
const EXCEL = '.xlsx,.xls', CSV = '.csv,.txt';

export const FUENTES = [
  // ── Globales ──
  { id: 'roadmap', grupo: 'globales', statusKey: 'roadmap', tipo: 'updated', titulo: 'Roadmap', parser: 'roadmap', accept: EXCEL, kind: 'Excel',
    formato: ['Roadmap.xlsx · Hoja1', 'Marca · Categoría · Familia · Artículo · Roadmap · Descripción 2 · replace completo'], cadencia: { tipo: 'cambio', label: 'cuando cambie' } },
  { id: 'estados-resultados', grupo: 'globales', statusKey: 'estados_resultados', tipo: 'mes', titulo: 'Estado de Resultados (P&L)', parser: 'estadosResultados', accept: EXCEL, kind: 'Excel',
    formato: ['Cierre <período>.xlsx · hoja "Estado de Resultados"', 'sólo meses con valores · upsert por razón social, año, mes y cuenta'], cadencia: { tipo: 'mensual', dia: 10, label: 'día 10' } },
  { id: 'revko-sellout', grupo: 'globales', statusKey: 'revko_sellout', tipo: 'sellout', titulo: 'Sellout Acteck (Revko)', parser: 'revkoSellout', accept: CSV, kind: 'CSV',
    formato: ['Reporte-SellOut_Ventas … Acteck_Revko.csv', 'semanal o mensual · mayorista DICOTECH · upsert por id determinista'], cadencia: { tipo: 'mensual', dia: 3, label: 'día 3' } },
  // ── Digitalife ──
  { id: 'digitalife-sellout', grupo: 'digitalife', statusKey: 'sellout_digitalife', tipo: 'sellout', titulo: 'Sell out histórico', parser: 'digitalifeSellout', accept: EXCEL, kind: 'Excel',
    formato: ['Historico Sellout Digitalife.xlsx · hoja "Sellout Digitalife"', 'append con dedup por fecha + parte + cantidad + total'], cadencia: LUNES,
    casilla: { key: 'historico', label: 'es histórico completo (reemplaza el sell out de Digitalife)' } },
  { id: 'digitalife-inv', grupo: 'digitalife', statusKey: 'inv_digitalife', tipo: 'semana', titulo: 'Inventario semanal', parser: 'digitalifeInv', accept: EXCEL, kind: 'Excel',
    formato: ['Acteck_BalamRush_Inventario.xlsx · Hoja39', 'snapshot por (cliente, sku, año, semana)'], cadencia: LUNES },
  // ── PCEL ──
  { id: 'pcel-vm', grupo: 'pcel', statusKey: 'sellout_pcel', tipo: 'semana', titulo: 'Venta-marca semanal', parser: 'pcelVentaMarca', accept: EXCEL, kind: 'Excel',
    formato: ['venta-marca-ACTECK.xlsx · "Ventas por Fabricante"', 'semana desde "Vta Semana N" · también mensual histórico y catálogo SKU'], cadencia: MARTES },
  // ── Dicotech ──
  { id: 'dicotech-sellout', grupo: 'dicotech', statusKey: 'sellout_dicotech', tipo: 'sellout', titulo: 'Sell out semanal (CSV)', parser: 'dicotechSelloutSemanal', accept: CSV, kind: 'CSV',
    formato: ['Reporte-SellOut_Ventas Semanal Acteck_Revko.csv', 'append a sellout_detalle · recalcula sellout_sku'], cadencia: LUNES },
  { id: 'dicotech-inv', grupo: 'dicotech', statusKey: 'inv_dicotech', tipo: 'semana', titulo: 'Inventario semanal', parser: 'dicotechInventario', accept: CSV, kind: 'CSV',
    formato: ['Reporte-Inventario_Inventario Acteck Semanal.csv', '8 almacenes · agregado por SKU + desglose por sucursal'], cadencia: LUNES },
  // ── Estados de cuenta ──
  { id: 'ec-digitalife', grupo: 'estados_cuenta', statusKey: 'ec_digitalife', tipo: 'semana', titulo: 'Digitalife · Estado de cuenta', parser: 'estadoCuenta', opts: { cliente: 'digitalife' }, accept: EXCEL, kind: 'Excel',
    formato: ['00764SemanaNN.xlsx', 'upsert (cliente, año, semana) + aging en detalle'], cadencia: LUNES },
  { id: 'ec-pcel', grupo: 'estados_cuenta', statusKey: 'ec_pcel', tipo: 'semana', titulo: 'PCEL · Estado de cuenta', parser: 'estadoCuenta', opts: { cliente: 'pcel' }, accept: EXCEL, kind: 'Excel',
    formato: ['00473SemanaNN.xlsx', 'upsert (cliente, año, semana) + aging en detalle'], cadencia: LUNES },
  { id: 'ec-dicotech', grupo: 'estados_cuenta', statusKey: 'ec_dicotech', tipo: 'semana', titulo: 'Dicotech · Estado de cuenta', parser: 'estadoCuenta', opts: { cliente: 'dicotech' }, accept: EXCEL, kind: 'Excel',
    formato: ['00708SemanaNN.xlsx (REVKO TECHNOLOGY)', 'upsert (cliente, año, semana) + aging en detalle'], cadencia: LUNES },
];
