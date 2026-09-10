// constantes.js — constantes del armador de propuestas, compartidas por la pestaña de escritorio
// (PropuestasTab.jsx) y la app móvil (src/movil/pestanas/Propuestas.jsx · PropuestaEditor.jsx).
export const CLIENTES = [
  { key: 'digitalife', label: 'Digitalife', iniciales: 'D', marca: 'Acteck · Balam Rush' },
  { key: 'pcel',       label: 'PCEL',       iniciales: 'P', marca: 'Acteck' },
  { key: 'dicotech',   label: 'Dicotech',   iniciales: 'Di', marca: 'Acteck · Balam Rush' },
];

const FAMILIA_DIGITALIFE_HOJA = {
  'Monitor':        'Monitores',
  'Sillas y Mesas': 'Sillas',
};
export const familiaHoja = (familia) => FAMILIA_DIGITALIFE_HOJA[familia] || 'Todo lo demás';

// Meses cerrados anteriores al actual (los últimos 3).
// Siempre incluye el mes anterior inmediato, aunque le falten 1-3 días de
// sellout. Fernando: 'un día no nos afecta tanto'.
// Ej.: cualquier día de sep → Jun/Jul/Ago.
export function mesesCerrados() {
  const hoy = new Date();
  const arr = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    arr.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 });
  }
  return arr;
}
export const MES_ACTUAL = { anio: new Date().getFullYear(), mes: new Date().getMonth() + 1 };

/** Último día del mes como 'YYYY-MM-DD' (vigencia por defecto de una propuesta). */
export function finDeMesISO(anio, mes) {
  const d = new Date(anio, mes, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Vigencia automática: último día del mes en curso. Fernando la puede cambiar en Revisar. */
export const vigenciaPorDefecto = () => finDeMesISO(MES_ACTUAL.anio, MES_ACTUAL.mes);
export const MES_LABEL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
export const MES_FULL  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/** Id de propuesta (fila de propuestas_borradores). */
export function nuevaPropuestaId() {
  return `prp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// Listas de precios (v_estrategia_precios_lista.lista) · color y abreviatura para chips.
export const LISTA_COLORS = {
  'API PROVISIONAL': '#007AFF',
  'DECME PROVISIONAL': '#AF52DE',
  'DICOTECH': '#8B5CF6',
  'Mayoreo A': '#EF4444',
  'Mayoreo AA': '#F59E0B',
  'Mayoreo AAA': '#EC4899',
  'MAYOREO B1': '#14B8A6',
  'Mayoreo PMM': '#0EA5E9',
  'PCEL PROVISIONAL': '#F97316',
};
export const LISTA_SHORT = {
  'API PROVISIONAL': 'API',
  'DECME PROVISIONAL': 'DECME',
  'DICOTECH': 'DICO',
  'Mayoreo A': 'MA',
  'Mayoreo AA': 'MAA',
  'Mayoreo AAA': 'MAAA',
  'MAYOREO B1': 'MB1',
  'Mayoreo PMM': 'PMM',
  'PCEL PROVISIONAL': 'PCEL',
};
export const listaColor = (name) => LISTA_COLORS[name] || '#6E6E73';
export const listaShort = (name) => LISTA_SHORT[name] || (name || '').slice(0, 4).toUpperCase();

// Lista "natural" de cada cliente propio (la que se propone por defecto en el celular; en escritorio el
// default por SKU es la primera lista disponible y cada línea puede cambiarla).
export const LISTA_POR_CLIENTE = { digitalife: 'API PROVISIONAL', pcel: 'PCEL PROVISIONAL', dicotech: 'DICOTECH' };

// ── Estados del ciclo de vida (V3, 2026-09-11) · minúsculas en la base ──
//   borrador → enviada (al generar el Excel final o compartir) → cerrada (el cliente facturó ≥ 1 SKU en la ventana)
export const ESTADOS = [
  { id: 'borrador', label: 'Borrador', tone: 'orange' },
  { id: 'enviada',  label: 'Enviada',  tone: 'blue' },
  { id: 'cerrada',  label: 'Cerrada',  tone: 'green' },
];
export const normalizarEstado = (e) => {
  const s = String(e || '').toLowerCase();
  if (s === 'exportada') return 'enviada';
  return ['borrador', 'enviada', 'cerrada'].includes(s) ? s : 'borrador';
};
export const estadoInfo = (e) => ESTADOS.find((x) => x.id === normalizarEstado(e)) || ESTADOS[0];

// Color por cliente derivado del tema (Digitalife accent · PCEL rojo · Dicotech morado)
export const clienteColor = (theme, key) => ({
  digitalife: theme.accent || '#007AFF',
  pcel: theme.red || '#FF3B30',
  dicotech: theme.purple || '#AF52DE',
}[key] || theme.accent || '#007AFF');
