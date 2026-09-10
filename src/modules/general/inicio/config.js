// Inicio (dirección general) · constantes y destinos de navegación.
// Los datos se cargan en useInicioData.js, los cálculos viven en calc.js y los bloques en bloques.jsx.

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Clientes con pestaña propia (mismo orden que permisos.CLIENTES).
export const CLIENTES = [
  { key: 'digitalife', nombre: 'Digitalife' },
  { key: 'pcel', nombre: 'PCEL' },
  { key: 'dicotech', nombre: 'Dicotech' },
];
export const CLIENTE_NOMBRE = Object.fromEntries(CLIENTES.map((c) => [c.key, c.nombre]));

// Etiqueta display de los canales del ERP (erp_ventas.canal).
export const CANAL_LABEL = {
  'MAYOREO': 'Mayoreo', 'DISTRIBUIDOR': 'Distribuidor', 'E-COMMERCE': 'E-commerce', 'MOSTRADOR': 'Mostrador',
  'RETAIL PROPIOS': 'Retail propios', 'RETAIL REPRESENTADOS': 'Retail representados', 'otros': 'Otros',
};
export const canalLabel = (c) => CANAL_LABEL[c] || String(c || 'Otros');

// Fuentes cuya frescura se muestra en el Hero.
export const FUENTES_INICIO = ['facturacion_clientes', 'erp_ventas', 'inventario_acteck', 'estados_cuenta'];

// Destinos de onNavegar(clienteKey|null, pagina).
export const PAGINAS = {
  bandejaAlertas: 'resumen', // BandejaAlertas global (sólo super admin) · respaldo si nadie atiende EVENTO_NOTIFICACIONES
  visionGeneral: 'visionGeneral',
  cobranza: 'cobranzaGlobal',
  inventario: 'inventarioGlobal',
  sellIn: 'sellIn',
  homeCliente: 'home',
  pagosCliente: 'pagos',
};

// El centro de notificaciones es el popover de la campana (Topbar). Inicio lo pide con este evento
// cancelable en window; si nadie hace preventDefault, el super admin cae a la bandeja global.
export const EVENTO_NOTIFICACIONES = 'acteck:abrir-notificaciones';
export function abrirNotificaciones(onNavegar, perfil) {
  const ev = new CustomEvent(EVENTO_NOTIFICACIONES, { cancelable: true });
  window.dispatchEvent(ev);
  if (!ev.defaultPrevented && perfil?.es_super_admin && onNavegar) onNavegar(null, PAGINAS.bandejaAlertas);
}

export const MODOS = [{ id: 'mes', label: 'Mes' }, { id: 'anio', label: 'Año' }];
export const DIAS_AGENDA = 7;
export const MAX_ALERTAS = 5;
